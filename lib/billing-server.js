// Lógica de facturación en servidor: límites de plan, precios y webhooks de Stripe,
// sincronización de suscripciones y cobro de citas con Stripe Connect (sin comisión).
import { Resend } from 'resend';
import { getStripe } from './stripe';
import { PLANS, PRICE_LOOKUP, effectivePlanId, getPlan } from './plans';
import { DEFAULT_TZ, localParts, localToUtc, formatWhenLong } from './tz';

// ---------- Ajustes de plataforma (secretos de webhook generados automáticamente) ----------
export async function getSetting(supabase, key) {
  try {
    const { data } = await supabase.from('platform_settings').select('value').eq('key', key).maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}
export async function setSetting(supabase, key, value) {
  await supabase.from('platform_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

// ---------- Límites ----------
export function monthStartIso(tz = DEFAULT_TZ) {
  const { dateStr } = localParts(new Date(), tz);
  return localToUtc(`${dateStr.slice(0, 7)}-01`, 0, tz).toISOString();
}

export async function monthlyBookingCount(supabase, tenant) {
  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .gte('created_at', monthStartIso(tenant.timezone || DEFAULT_TZ));
  return count || 0;
}

export async function getUsage(supabase, tenant) {
  const planId = effectivePlanId(tenant);
  const limits = getPlan(planId).limits;
  const [bookings, { count: employees }] = await Promise.all([
    monthlyBookingCount(supabase, tenant),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('active', true),
  ]);
  return {
    planId, limits, bookings, employees: employees || 0,
    bookingsLimitReached: limits.monthlyBookings != null && bookings >= limits.monthlyBookings,
  };
}

// Avisa al negocio por email (una vez al mes) de que ha llegado al límite de reservas
async function notifyLimitReached(supabase, tenant, limit) {
  const month = monthStartIso(tenant.timezone || DEFAULT_TZ).slice(0, 7);
  if (tenant.limit_notified_month === month || !tenant.email || !process.env.RESEND_API_KEY) return;
  try {
    await supabase.from('tenants').update({ limit_notified_month: month }).eq('id', tenant.id);
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [tenant.email],
      subject: `Has llegado a ${limit} reservas este mes — sube a Pro`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <h2 style="color:#4f46e5">Has alcanzado el límite del plan Free</h2>
        <p>Hola, <b>${tenant.name}</b> ha llegado a <b>${limit} reservas</b> este mes. Las reservas online nuevas están en pausa hasta el mes que viene.</p>
        <p>Sube al plan <b>Pro</b> (19,99 €/mes) para tener <b>reservas ilimitadas</b>, hasta 3 profesionales, reservas por WhatsApp y recordatorios automáticos.</p>
        <p>Puedes cambiar de plan en tu panel → Configuración → Plan y facturación.</p>
        <p style="color:#94a3b8;font-size:12px">Reserva360</p></div>`,
    });
  } catch (e) {
    console.error('[limit notify]', e);
  }
}

// Lanza error si el negocio no puede aceptar más reservas este mes
export async function assertCanAcceptBooking(supabase, tenant, ErrorClass = Error) {
  const limits = getPlan(effectivePlanId(tenant)).limits;
  if (limits.monthlyBookings == null) return;
  const count = await monthlyBookingCount(supabase, tenant);
  if (count >= limits.monthlyBookings) {
    await notifyLimitReached(supabase, tenant, limits.monthlyBookings);
    throw new ErrorClass('Este negocio no admite más reservas online este mes. Contacta directamente con el negocio, por favor.', 403);
  }
}

// ---------- Stripe: precios y webhooks (idempotente) ----------
const PRICE_DEFS = [
  { key: 'pro_month', plan: 'pro', interval: 'month', amount: 1999 },
  { key: 'pro_year', plan: 'pro', interval: 'year', amount: 22000 },
  { key: 'business_month', plan: 'business', interval: 'month', amount: 3999 },
  { key: 'business_year', plan: 'business', interval: 'year', amount: 44000 },
];

export async function ensurePrices() {
  const stripe = getStripe();
  const out = {};
  const products = {};
  for (const d of PRICE_DEFS) {
    const lookup = PRICE_LOOKUP[d.key];
    const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
    if (existing.data[0]) { out[d.key] = existing.data[0].id; continue; }
    if (!products[d.plan]) {
      const found = await stripe.products.search({ query: `metadata['r360_plan']:'${d.plan}'` }).catch(() => ({ data: [] }));
      products[d.plan] = found.data[0] || await stripe.products.create({
        name: `Reserva360 ${getPlan(d.plan).name}`,
        metadata: { r360_plan: d.plan },
      });
    }
    const price = await stripe.prices.create({
      product: products[d.plan].id,
      currency: 'eur',
      unit_amount: d.amount,
      recurring: { interval: d.interval },
      lookup_key: lookup,
      metadata: { r360_plan: d.plan, r360_interval: d.interval },
    });
    out[d.key] = price.id;
  }
  return out;
}

const PLATFORM_EVENTS = [
  'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'invoice.payment_failed',
];
const CONNECT_EVENTS = ['account.updated', 'checkout.session.completed', 'checkout.session.expired'];

export async function ensureWebhooks(supabase, baseUrl) {
  const stripe = getStripe();
  const results = {};
  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  for (const kind of ['platform', 'connect']) {
    const url = `${baseUrl}/api/stripe/webhook${kind === 'connect' ? '?connect=1' : ''}`;
    const settingKey = `stripe_webhook_secret_${kind}:${url}`;
    const stored = await getSetting(supabase, settingKey);
    const existing = list.data.find((w) => w.url === url);
    if (existing && stored) { results[kind] = { url, status: 'ok' }; continue; }
    if (existing) await stripe.webhookEndpoints.del(existing.id);
    const created = await stripe.webhookEndpoints.create({
      url,
      enabled_events: kind === 'connect' ? CONNECT_EVENTS : PLATFORM_EVENTS,
      connect: kind === 'connect',
      description: `Reserva360 (${kind})`,
    });
    await setSetting(supabase, settingKey, created.secret);
    results[kind] = { url, status: 'created' };
  }
  return results;
}

export async function getWebhookSecrets(supabase, baseUrl) {
  const secrets = [];
  if (process.env.STRIPE_WEBHOOK_SECRET) secrets.push(process.env.STRIPE_WEBHOOK_SECRET);
  if (process.env.STRIPE_CONNECT_WEBHOOK_SECRET) secrets.push(process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  for (const kind of ['platform', 'connect']) {
    const url = `${baseUrl}/api/stripe/webhook${kind === 'connect' ? '?connect=1' : ''}`;
    const s = await getSetting(supabase, `stripe_webhook_secret_${kind}:${url}`);
    if (s) secrets.push(s);
  }
  // También secretos guardados para otras URLs (preview / producción)
  try {
    const { data } = await supabase.from('platform_settings').select('value').like('key', 'stripe_webhook_secret_%');
    for (const r of data || []) if (r.value && !secrets.includes(r.value)) secrets.push(r.value);
  } catch {}
  return secrets;
}

// ---------- Suscripciones ----------
export async function syncSubscription(supabase, sub) {
  const tenantId = sub?.metadata?.tenant_id;
  if (!tenantId) return null;
  const item = sub.items?.data?.[0];
  const lookup = item?.price?.lookup_key || '';
  const planKey = item?.price?.metadata?.r360_plan || (lookup.includes('business') ? 'business' : lookup.includes('pro') ? 'pro' : null);
  const ended = ['canceled', 'incomplete_expired', 'unpaid'].includes(sub.status);
  const interval = item?.price?.recurring?.interval || null;
  const amount = (item?.price?.unit_amount || 0) / 100;
  const periodEnd = item?.current_period_end || sub.current_period_end || null;
  const patch = {
    plan_id: ended || !planKey ? 'plan_free' : `plan_${planKey}`,
    subscription_status: sub.status,
    stripe_subscription_id: ended ? null : sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    billing_interval: ended ? null : interval,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    mrr: ended ? 0 : interval === 'year' ? Math.round((amount / 12) * 100) / 100 : amount,
  };
  await supabase.from('tenants').update(patch).eq('id', tenantId);
  return { tenantId, ...patch };
}

// ---------- Cobro de citas (Stripe Connect, cargo directo en la cuenta del negocio, sin comisión) ----------
export function paymentAmountFor(service) {
  const price = Number(service?.price || 0);
  if (service?.payment_mode === 'deposit') {
    const dep = Number(service?.deposit_amount || 0);
    return dep > 0 ? Math.min(dep, price || dep) : 0;
  }
  return price;
}

export function onlinePaymentsEnabled(tenant) {
  return getPlan(effectivePlanId(tenant)).limits.onlinePayments && Boolean(tenant?.stripe_account_id) && Boolean(tenant?.stripe_charges_enabled);
}

export async function createAppointmentCheckout({ supabase, tenant, service, appointment, client, baseUrl }) {
  const stripe = getStripe();
  const amount = paymentAmountFor(service);
  if (!(amount > 0)) throw new Error('Importe no válido para el pago online');
  const isDeposit = service.payment_mode === 'deposit';
  const when = formatWhenLong(appointment.start_at, tenant.timezone || DEFAULT_TZ);
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(amount * 100),
          product_data: { name: `${service.name}${isDeposit ? ' (señal)' : ''} — ${tenant.name}`, description: when },
        },
      }],
      customer_email: client?.email || undefined,
      metadata: { r360_kind: 'appointment', appointment_id: appointment.id, tenant_id: tenant.id, deposit: isDeposit ? '1' : '0' },
      payment_intent_data: { metadata: { appointment_id: appointment.id, tenant_id: tenant.id } },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${baseUrl}/manage/${appointment.id}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/manage/${appointment.id}?payment=cancelled`,
      locale: 'es',
    },
    { stripeAccount: tenant.stripe_account_id }
  );
  await supabase
    .from('appointments')
    .update({ stripe_checkout_session_id: session.id, payment_method: isDeposit ? 'partial' : 'stripe', status: 'pending' })
    .eq('id', appointment.id);
  return session;
}

// Marca la cita como pagada (webhook o verificación al volver). Devuelve true si cambió algo.
export async function applyAppointmentPayment(supabase, session) {
  const apptId = session?.metadata?.appointment_id;
  if (!apptId || session.payment_status !== 'paid') return false;
  const { data: appt } = await supabase
    .from('appointments').select('id, status, payment_status, deposit_paid, stripe_checkout_session_id').eq('id', apptId).maybeSingle();
  if (!appt || (appt.stripe_checkout_session_id && appt.stripe_checkout_session_id !== session.id)) return false;
  const paidAmount = (session.amount_total || 0) / 100;
  const isDeposit = session.metadata?.deposit === '1';
  if (isDeposit ? Number(appt.deposit_paid || 0) >= paidAmount : appt.payment_status === 'paid') return false;
  await supabase.from('appointments').update({
    status: appt.status === 'cancelled' ? 'cancelled' : 'confirmed',
    payment_status: isDeposit ? 'pending' : 'paid',
    payment_method: isDeposit ? 'partial' : 'stripe',
    deposit_paid: paidAmount,
    payment_date: new Date().toISOString(),
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
  }).eq('id', apptId);
  return true;
}

export async function expireAppointmentPayment(supabase, session) {
  const apptId = session?.metadata?.appointment_id;
  if (!apptId) return;
  await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', apptId)
    .eq('stripe_checkout_session_id', session.id)
    .eq('status', 'pending')
    .neq('payment_status', 'paid')
    .is('deposit_paid', null);
}

export { PLANS };

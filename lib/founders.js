// Programa de Usuarios Fundadores (SOLO servidor).
// Toda la lógica crítica (elegibilidad, reserva, activación, ciclos) vive en funciones SQL atómicas
// (public/migration-fundadores.sql). Aquí solo se orquesta con Stripe y se exponen datos al panel.
import { getStripe } from './stripe';
import { setLaunchAt, getPlan, FOUNDER_DISCOUNT, FOUNDER_CYCLES, founderPrice, LAUNCH_FREE_MODE } from './plans';

export const FOUNDER_COUPON_ID = 'r360_fundador_30';

// ---------- Configuración del programa (con caché corta) ----------
let _cache = { at: 0, program: null };

export async function getProgram(supabase, { fresh = false } = {}) {
  if (!fresh && _cache.program !== undefined && Date.now() - _cache.at < 15000) return _cache.program;
  let program = null;
  try {
    const { data, error } = await supabase.from('founder_program').select('*').eq('id', true).maybeSingle();
    if (!error) program = data || null;
  } catch {}
  _cache = { at: Date.now(), program };
  setLaunchAt(program?.launch_at || null);
  return program;
}

export const resetProgramCache = () => { _cache = { at: 0, program: null }; };

// Sincroniza la fecha de lanzamiento (para cerrar el modo lanzamiento) y congela si toca. Nunca lanza error.
export async function syncProgram(supabase) {
  try {
    const p = await getProgram(supabase);
    if (p?.launch_at && !p.frozen_at && Date.now() >= new Date(p.launch_at).getTime()) {
      await supabase.rpc('founder_freeze');
      _cache.at = 0;
      return await getProgram(supabase, { fresh: true });
    }
    return p;
  } catch {
    return null;
  }
}

export const programLaunched = (p) => Boolean(p?.launch_at && Date.now() >= new Date(p.launch_at).getTime());

// ---------- Estado mostrado ----------
// pending | eligible | not_eligible | active | finished
export function displayStatus(b) {
  if (!b) return 'pending';
  if (b.benefit_status === 'active') return 'active';
  if (['finished', 'cancelled', 'revoked'].includes(b.benefit_status)) return 'finished';
  if (b.eligibility_status === 'eligible') return 'eligible';
  if (b.eligibility_status === 'not_eligible') return 'not_eligible';
  return 'pending';
}

export const REQUIREMENTS = [
  { key: 'account_before_launch', label: 'Cuenta creada antes del lanzamiento', view: null },
  { key: 'has_owner', label: 'Negocio asociado a tu cuenta', view: null },
  { key: 'business_data', label: 'Datos del negocio completos (nombre, teléfono y dirección)', view: 'settings' },
  { key: 'services', label: 'Al menos un servicio activo', view: 'services' },
  { key: 'business_hours', label: 'Horario de apertura configurado', view: 'settings' },
  { key: 'availability', label: 'Al menos un profesional activo (disponibilidad)', view: 'employees' },
];

export function pricesFor(planKey) {
  const p = getPlan(planKey);
  return {
    plan: p.key, name: p.name,
    month: { normal: p.monthly, founder: founderPrice(p.monthly) },
    year: { normal: p.yearly, founder: founderPrice(p.yearly) },
  };
}

// Estado completo del beneficio de un negocio (evalúa con datos reales en la BD)
export async function getFounderState(supabase, tenant) {
  const program = await syncProgram(supabase);
  if (!program) return { available: false, reason: 'migration_needed' };
  const { data: benefit, error } = await supabase.rpc('founder_evaluate', { p_tenant: tenant.id });
  if (error) return { available: false, reason: 'error', error: error.message };
  const req = benefit?.requirements || {};
  const reqs = REQUIREMENTS.map((r) => ({ ...r, done: Boolean(req[r.key]) }));
  const { data: cycles } = await supabase
    .from('founder_benefit_cycles').select('stripe_invoice_id, amount_paid, billing_reason, billing_interval, cycles_counted, created_at')
    .eq('tenant_id', tenant.id).order('created_at');
  const status = displayStatus(benefit);
  const usable = status === 'eligible' && benefit?.benefit_status === 'none';
  return {
    available: true,
    program: {
      launchAt: program.launch_at, launched: programLaunched(program), frozenAt: program.frozen_at,
      status: program.status, newEligibilityEnabled: program.new_eligibility_enabled,
      launchFreeModeEnv: LAUNCH_FREE_MODE,
    },
    status,
    benefitStatus: benefit?.benefit_status || 'none',
    eligibilityStatus: benefit?.eligibility_status || 'pending',
    frozen: Boolean(benefit?.frozen),
    endReason: benefit?.end_reason || null,
    discountPercent: Number(benefit?.discount_percent || FOUNDER_DISCOUNT),
    totalCycles: benefit?.total_cycles || FOUNDER_CYCLES,
    cyclesUsed: benefit?.cycles_used || 0,
    cyclesLeft: Math.max(0, (benefit?.total_cycles || FOUNDER_CYCLES) - (benefit?.cycles_used || 0)),
    activatedAt: benefit?.activated_at || null,
    endedAt: benefit?.ended_at || null,
    initialPlanId: benefit?.initial_plan_id || null,
    currentPlanId: benefit?.current_plan_id || null,
    billingInterval: benefit?.billing_interval || null,
    subscriptionPeriodEnd: tenant.current_period_end || null,
    cancelAtPeriodEnd: Boolean(tenant.cancel_at_period_end),
    requirements: reqs,
    requirementsDone: reqs.filter((r) => r.done).length,
    // Se ofrecerá el descuento en el primer pago (solo si es elegible y nunca lo usó)
    willApplyOnCheckout: usable && programLaunched(program) && program.status === 'active',
    usable,
    prices: { pro: pricesFor('pro'), business: pricesFor('business') },
    cycles: cycles || [],
  };
}

// ---------- Stripe ----------
export async function ensureFounderCoupon(stripe = getStripe()) {
  try {
    const c = await stripe.coupons.retrieve(FOUNDER_COUPON_ID);
    if (c && !c.deleted && c.valid !== false) return c.id;
  } catch (e) {
    if (e?.statusCode && e.statusCode !== 404) throw e;
  }
  // Cupón "para siempre": el servidor lo retira al consumirse los 3 ciclos pagados (contados por webhook)
  const c = await stripe.coupons.create({
    id: FOUNDER_COUPON_ID, percent_off: FOUNDER_DISCOUNT, duration: 'forever', name: `Fundador -${FOUNDER_DISCOUNT}%`,
    metadata: { r360: 'founder' },
  });
  return c.id;
}

export async function removeSubscriptionDiscount(stripe, subId) {
  try {
    await stripe.subscriptions.deleteDiscount(subId);
  } catch (e) {
    // Sin descuento que quitar → nada que hacer; cualquier otro error, intento alternativo
    if (!/no active discount|does not have a discount|no discount/i.test(e?.message || '')) {
      await stripe.subscriptions.update(subId, { discounts: '' });
    }
  }
}

const planKeyOf = (sub) => {
  const item = sub?.items?.data?.[0];
  const lookup = item?.price?.lookup_key || '';
  return item?.price?.metadata?.r360_plan || (lookup.includes('business') ? 'business' : lookup.includes('pro') ? 'pro' : null);
};
const intervalOf = (sub) => sub?.items?.data?.[0]?.price?.recurring?.interval || null;
const customerOf = (sub) => (typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id) || null;

// Activa el beneficio a partir de la suscripción creada con el cupón (idempotente).
// Si la suscripción lleva el cupón pero el negocio no tenía la reserva, se retira el descuento.
export async function activateFromSubscription(supabase, stripe, sub) {
  const tenantId = sub?.metadata?.tenant_id;
  if (!tenantId || sub?.metadata?.r360_founder !== '1') return null;
  if (['canceled', 'incomplete_expired'].includes(sub.status)) return null;
  const planKey = planKeyOf(sub);
  const { data: result, error } = await supabase.rpc('founder_activate', {
    p_tenant: tenantId, p_sub: sub.id, p_customer: customerOf(sub),
    p_plan: planKey ? `plan_${planKey}` : null, p_interval: intervalOf(sub), p_coupon: FOUNDER_COUPON_ID,
  });
  if (error) throw new Error(error.message);
  if (result === 'rejected') {
    const { data: b } = await supabase.from('founder_benefits').select('stripe_subscription_id, benefit_status').eq('tenant_id', tenantId).maybeSingle();
    if (b?.stripe_subscription_id !== sub.id) {
      await removeSubscriptionDiscount(stripe, sub.id);
      await supabase.from('activity_log').insert({
        tenant_id: tenantId, action: 'founder.discount_stripped', entity: 'founder_benefit',
        metadata: { subscription: sub.id, benefit_status: b?.benefit_status || null },
      });
    }
  }
  return result;
}

// Webhook: suscripción creada/actualizada/borrada
export async function onSubscriptionEvent(supabase, stripe, sub, type) {
  const tenantId = sub?.metadata?.tenant_id;
  if (!tenantId) return;
  if (type === 'customer.subscription.created') await activateFromSubscription(supabase, stripe, sub);
  const ended = type === 'customer.subscription.deleted' || ['canceled', 'incomplete_expired'].includes(sub.status);
  if (ended) {
    await supabase.rpc('founder_subscription_ended', { p_tenant: tenantId, p_sub: sub.id });
    return;
  }
  const planKey = planKeyOf(sub);
  if (planKey) await supabase.rpc('founder_plan_changed', { p_tenant: tenantId, p_sub: sub.id, p_plan: `plan_${planKey}`, p_interval: intervalOf(sub) });
}

// Webhook: factura cobrada → contabiliza ciclo y retira el cupón al terminar
export async function onInvoicePaid(supabase, stripe, invoice) {
  const subId = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  if (!subId) return null;
  const sub = await stripe.subscriptions.retrieve(typeof subId === 'string' ? subId : subId.id);
  const tenantId = sub?.metadata?.tenant_id;
  if (!tenantId) return null;
  if (sub.metadata?.r360_founder === '1') await activateFromSubscription(supabase, stripe, sub);
  const { data: r, error } = await supabase.rpc('founder_register_paid_invoice', {
    p_tenant: tenantId, p_sub: sub.id, p_invoice: invoice.id,
    p_amount: (invoice.amount_paid || 0) / 100, p_reason: invoice.billing_reason || null, p_interval: intervalOf(sub),
  });
  if (error) throw new Error(error.message);
  await stripIfConsumed(supabase, stripe, tenantId, sub);
  return r;
}

// Si el beneficio ya no está activo (terminado, cancelado o revocado), la suscripción no puede conservar el cupón
export async function stripIfConsumed(supabase, stripe, tenantId, sub) {
  const { data: b } = await supabase.from('founder_benefits')
    .select('benefit_status, stripe_subscription_id, discount_removed_at').eq('tenant_id', tenantId).maybeSingle();
  if (!b || b.benefit_status === 'active' || b.benefit_status === 'reserved') return false;
  // Solo se actúa sobre la suscripción que recibió el descuento fundador
  if (!sub?.id || b.stripe_subscription_id !== sub.id) return false;
  const hasDiscount = (sub.discounts || []).length > 0 || Boolean(sub.discount);
  if (b.discount_removed_at && !hasDiscount) return false;
  await removeSubscriptionDiscount(stripe, sub.id);
  await supabase.rpc('founder_mark_discount_removed', { p_tenant: tenantId });
  return true;
}

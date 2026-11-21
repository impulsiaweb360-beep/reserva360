import { NextResponse } from 'next/server';
import { requireTenant, errorResponse } from '@/lib/route-helpers';
import { getStripe } from '@/lib/stripe';
import { ensurePrices } from '@/lib/billing-server';
import { getBaseUrl } from '@/lib/base-url';
import { isLaunchFreeMode } from '@/lib/plans';
import { ensureFounderCoupon, FOUNDER_COUPON_ID } from '@/lib/founders';

export const dynamic = 'force-dynamic';

// POST { plan: 'pro'|'business', interval: 'month'|'year' } → { url } de Stripe Checkout
export async function POST(request) {
  const a = await requireTenant(request, ['tenant_admin', 'super_admin']);
  if (a.error) return a.error;
  if (isLaunchFreeMode()) {
    return NextResponse.json({ error: 'Durante el lanzamiento Reserva360 es gratis: las suscripciones de pago aún no están disponibles.' }, { status: 403 });
  }
  try {
    const { plan, interval } = await request.json().catch(() => ({}));
    if (!['pro', 'business'].includes(plan) || !['month', 'year'].includes(interval)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 });
    }
    const stripe = getStripe();
    const t = a.tenant;
    const base = getBaseUrl(request);

    // Si ya tiene suscripción activa, el cambio de plan se hace en el portal de Stripe
    if (t.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(t.subscription_status)) {
      const portal = await stripe.billingPortal.sessions.create({ customer: t.stripe_customer_id, return_url: `${base}/dashboard?view=settings` });
      return NextResponse.json({ url: portal.url, portal: true });
    }

    const prices = await ensurePrices();
    const priceId = prices[`${plan}_${interval}`];

    let customerId = t.stripe_customer_id;
    if (customerId) {
      try { const c = await stripe.customers.retrieve(customerId); if (c?.deleted) customerId = null; } catch { customerId = null; }
    }
    if (!customerId) {
      const c = await stripe.customers.create({ name: t.name, email: t.email || a.user.email, metadata: { tenant_id: t.id } });
      customerId = c.id;
      await a.admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', t.id);
    }

    // Programa de fundadores: reserva atómica en la BD (solo una solicitud puede ganar)
    let founder = false;
    const { data: claim, error: claimErr } = await a.admin.rpc('founder_claim', { p_tenant: t.id });
    if (claimErr && !/founder_claim|does not exist|schema cache/i.test(claimErr.message)) throw new Error(claimErr.message);
    if (claim?.reason === 'in_progress') {
      // Ya hay un pago con descuento en curso: se reutiliza esa misma sesión (no se crea otra)
      if (claim.session_id) {
        const prev = await stripe.checkout.sessions.retrieve(claim.session_id).catch(() => null);
        if (prev?.status === 'open' && prev.url) return NextResponse.json({ url: prev.url, founder: true });
      }
      return NextResponse.json({ error: 'Ya tienes un pago en curso. Espera unos segundos y vuelve a intentarlo.' }, { status: 409 });
    }
    if (claim?.ok) founder = true;

    const params = {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { tenant_id: t.id, ...(founder ? { r360_founder: '1' } : {}) } },
      metadata: { r360_kind: 'subscription', tenant_id: t.id, plan, interval, ...(founder ? { r360_founder: '1' } : {}) },
      locale: 'es',
      success_url: `${base}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard?billing=cancelled`,
    };
    if (founder) {
      // 30 % fundador (no se combina con otros códigos). La sesión caduca antes que la reserva (40 min)
      params.discounts = [{ coupon: await ensureFounderCoupon(stripe) }];
      params.expires_at = Math.floor(Date.now() / 1000) + 31 * 60;
    } else {
      params.allow_promotion_codes = true;
    }
    let session;
    try {
      session = await stripe.checkout.sessions.create(params);
    } catch (err) {
      if (founder) await a.admin.rpc('founder_release', { p_tenant: t.id, p_session: null });
      throw err;
    }
    if (founder) await a.admin.rpc('founder_set_session', { p_tenant: t.id, p_session: session.id });
    return NextResponse.json({ url: session.url, founder, coupon: founder ? FOUNDER_COUPON_ID : null });
  } catch (e) {
    return errorResponse(e);
  }
}

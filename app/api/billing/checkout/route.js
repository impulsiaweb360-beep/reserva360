import { NextResponse } from 'next/server';
import { requireTenant, errorResponse } from '@/lib/route-helpers';
import { getStripe } from '@/lib/stripe';
import { ensurePrices } from '@/lib/billing-server';
import { getBaseUrl } from '@/lib/base-url';
import { LAUNCH_FREE_MODE } from '@/lib/plans';

export const dynamic = 'force-dynamic';

// POST { plan: 'pro'|'business', interval: 'month'|'year' } → { url } de Stripe Checkout
export async function POST(request) {
  const a = await requireTenant(request, ['tenant_admin', 'super_admin']);
  if (a.error) return a.error;
  if (LAUNCH_FREE_MODE) {
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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { tenant_id: t.id } },
      metadata: { r360_kind: 'subscription', tenant_id: t.id, plan, interval },
      allow_promotion_codes: true,
      locale: 'es',
      success_url: `${base}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard?billing=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return errorResponse(e);
  }
}

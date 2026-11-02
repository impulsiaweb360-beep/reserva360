import { NextResponse } from 'next/server';
import { requireTenant, errorResponse } from '@/lib/route-helpers';
import { getStripe } from '@/lib/stripe';
import { getBaseUrl } from '@/lib/base-url';
import { effectivePlanId } from '@/lib/plans';

export const dynamic = 'force-dynamic';

async function refreshAccount(admin, tenant) {
  if (!tenant.stripe_account_id) return null;
  const acc = await getStripe().accounts.retrieve(tenant.stripe_account_id);
  const patch = { stripe_charges_enabled: Boolean(acc.charges_enabled), stripe_details_submitted: Boolean(acc.details_submitted) };
  await admin.from('tenants').update(patch).eq('id', tenant.id);
  return { chargesEnabled: patch.stripe_charges_enabled, detailsSubmitted: patch.stripe_details_submitted };
}

// GET → refresca el estado de la cuenta Stripe del negocio
export async function GET(request) {
  const a = await requireTenant(request);
  if (a.error) return a.error;
  try {
    const r = await refreshAccount(a.admin, a.tenant);
    return NextResponse.json({ connected: Boolean(r), ...(r || {}) });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST { action: 'onboard' | 'dashboard' }
export async function POST(request) {
  const a = await requireTenant(request);
  if (a.error) return a.error;
  try {
    const { action } = await request.json().catch(() => ({}));
    const stripe = getStripe();
    const t = a.tenant;
    const base = getBaseUrl(request);

    if (action === 'dashboard') {
      if (!t.stripe_account_id) return NextResponse.json({ error: 'Primero conecta Stripe' }, { status: 400 });
      const link = await stripe.accounts.createLoginLink(t.stripe_account_id);
      return NextResponse.json({ url: link.url });
    }

    if (effectivePlanId(t) !== 'plan_business') {
      return NextResponse.json({ error: 'Los pagos online están incluidos en el plan Business' }, { status: 403 });
    }
    let accountId = t.stripe_account_id;
    if (!accountId) {
      const acc = await stripe.accounts.create({
        type: 'express',
        country: 'ES',
        email: t.email || a.user.email,
        business_profile: { name: t.name, product_description: 'Servicios con cita previa' },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { tenant_id: t.id },
      });
      accountId = acc.id;
      await a.admin.from('tenants').update({ stripe_account_id: accountId }).eq('id', t.id);
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${base}/dashboard?view=settings&connect=refresh`,
      return_url: `${base}/dashboard?view=settings&connect=return`,
    });
    return NextResponse.json({ url: link.url });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from 'next/server';
import { requireTenant, errorResponse } from '@/lib/route-helpers';
import { getUsage } from '@/lib/billing-server';
import { isStripeConfigured } from '@/lib/stripe';
import { effectivePlanId, isOnTrial, trialDaysLeft, LAUNCH_FREE_MODE } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const a = await requireTenant(request, ['tenant_admin', 'super_admin', 'employee']);
  if (a.error) return a.error;
  try {
    const t = a.tenant;
    const usage = await getUsage(a.admin, t);
    return NextResponse.json({
      stripeConfigured: isStripeConfigured(),
      launchFreeMode: LAUNCH_FREE_MODE,
      planId: t.plan_id,
      effectivePlanId: effectivePlanId(t),
      onTrial: isOnTrial(t),
      trialDaysLeft: trialDaysLeft(t),
      trialEndsAt: t.trial_ends_at || null,
      subscription: {
        status: t.subscription_status || null,
        interval: t.billing_interval || null,
        currentPeriodEnd: t.current_period_end || null,
        cancelAtPeriodEnd: Boolean(t.cancel_at_period_end),
        hasCustomer: Boolean(t.stripe_customer_id),
      },
      connect: {
        accountId: t.stripe_account_id ? `…${String(t.stripe_account_id).slice(-6)}` : null,
        chargesEnabled: Boolean(t.stripe_charges_enabled),
        detailsSubmitted: Boolean(t.stripe_details_submitted),
      },
      usage,
      migrationNeeded: !('trial_ends_at' in t),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

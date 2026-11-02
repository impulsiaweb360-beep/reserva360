import { NextResponse } from 'next/server';
import { requireTenant, errorResponse } from '@/lib/route-helpers';
import { getStripe } from '@/lib/stripe';
import { syncSubscription } from '@/lib/billing-server';

export const dynamic = 'force-dynamic';

// Al volver de Stripe Checkout: verifica la sesión y activa el plan (respaldo si el webhook aún no llegó)
export async function GET(request) {
  const a = await requireTenant(request, ['tenant_admin', 'super_admin']);
  if (a.error) return a.error;
  try {
    const id = new URL(request.url).searchParams.get('session_id');
    if (!id) return NextResponse.json({ error: 'Falta session_id' }, { status: 400 });
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(id);
    if (session.metadata?.tenant_id !== a.tenant.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (session.status !== 'complete' || !session.subscription) return NextResponse.json({ ok: false, status: session.status });
    const sub = await stripe.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
    const r = await syncSubscription(a.admin, sub);
    return NextResponse.json({ ok: true, planId: r?.plan_id, status: sub.status });
  } catch (e) {
    return errorResponse(e);
  }
}

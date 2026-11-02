import { NextResponse } from 'next/server';
import { requireTenant, errorResponse } from '@/lib/route-helpers';
import { getStripe } from '@/lib/stripe';
import { getBaseUrl } from '@/lib/base-url';

export const dynamic = 'force-dynamic';

// Portal de Stripe: cambiar plan, mensual/anual, tarjeta, facturas o cancelar
export async function POST(request) {
  const a = await requireTenant(request, ['tenant_admin', 'super_admin']);
  if (a.error) return a.error;
  try {
    if (!a.tenant.stripe_customer_id) return NextResponse.json({ error: 'Todavía no tienes ninguna suscripción' }, { status: 400 });
    const portal = await getStripe().billingPortal.sessions.create({
      customer: a.tenant.stripe_customer_id,
      return_url: `${getBaseUrl(request)}/dashboard?view=settings`,
      locale: 'es',
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    return errorResponse(e);
  }
}

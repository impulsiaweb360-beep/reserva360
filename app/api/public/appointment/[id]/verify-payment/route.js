import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { applyAppointmentPayment } from '@/lib/billing-server';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { getBaseUrl } from '@/lib/base-url';

export const dynamic = 'force-dynamic';

// Al volver del pago: comprueba la sesión en la cuenta Stripe del negocio (respaldo del webhook)
export async function GET(request, { params }) {
  const { id } = await params;
  const sessionId = new URL(request.url).searchParams.get('session_id');
  const supabase = createSupabaseAdminClient();
  const { data: appt } = await supabase
    .from('appointments').select('id, stripe_checkout_session_id, payment_status, deposit_paid, tenant:tenants(stripe_account_id)')
    .eq('id', id).maybeSingle();
  if (!appt) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  if (!sessionId || sessionId !== appt.stripe_checkout_session_id || !appt.tenant?.stripe_account_id) {
    return NextResponse.json({ paid: appt.payment_status === 'paid' || Number(appt.deposit_paid || 0) > 0 });
  }
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: appt.tenant.stripe_account_id });
    const changed = await applyAppointmentPayment(supabase, session);
    if (changed) {
      const baseUrl = getBaseUrl(request);
      try { await notifyAppointment(supabase, id, 'created', { baseUrl, notifyBusiness: true }); } catch {}
      try {
        await fetch(`${baseUrl}/api/public/send-confirmation`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appointment_id: id }),
        });
      } catch {}
    }
    return NextResponse.json({ paid: session.payment_status === 'paid' });
  } catch (e) {
    return NextResponse.json({ paid: false, error: String(e?.message || e) });
  }
}

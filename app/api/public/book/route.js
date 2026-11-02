import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { createBooking, BookingError } from '@/lib/booking-server';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { getBaseUrl } from '@/lib/base-url';
import { onlinePaymentsEnabled, paymentAmountFor, createAppointmentCheckout } from '@/lib/billing-server';

export const dynamic = 'force-dynamic';

// POST /api/public/book — reserva pública validada en servidor (horario negocio + empleado + descanso + vacaciones + solapes)
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { slug, service_id, employee_id, start_at, client } = body || {};
  if (!slug || !service_id || !employee_id || !start_at) {
    return NextResponse.json({ error: 'Faltan datos de la reserva' }, { status: 400 });
  }
  if (!client?.firstName || !client?.phone) {
    return NextResponse.json({ error: 'Nombre y teléfono son obligatorios' }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  try {
    const res = await createBooking({
      supabase,
      tenantSlug: slug,
      serviceId: service_id,
      employeeId: employee_id,
      start: start_at,
      client,
      notes: client?.notes,
      source: 'online',
    });
    // Pago online (plan Business + Stripe conectado): señal o pago completo
    let checkoutUrl = null;
    const mode = res.service.payment_mode || 'onsite';
    const wantsOnline = mode === 'deposit' || mode === 'full' || (mode === 'optional' && body.pay_online === true);
    if (wantsOnline && onlinePaymentsEnabled(res.tenant) && paymentAmountFor(res.service) > 0) {
      try {
        const session = await createAppointmentCheckout({
          supabase, tenant: res.tenant, service: res.service, appointment: res.appointment, client: res.client, baseUrl: getBaseUrl(request),
        });
        checkoutUrl = session.url;
      } catch (e) {
        console.error('[book] checkout failed', e);
        if (mode === 'deposit' || mode === 'full') {
          await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', res.appointment.id);
          return NextResponse.json({ error: 'No se pudo iniciar el pago online. Inténtalo de nuevo en unos minutos.' }, { status: 502 });
        }
      }
    }
    if (checkoutUrl) {
      // Los avisos se envían cuando se confirme el pago
      return NextResponse.json({ ok: true, id: res.appointment.id, checkout_url: checkoutUrl });
    }

    // Avisos por WhatsApp (si el negocio lo tiene conectado). No bloquea la reserva si falla.
    try {
      await notifyAppointment(supabase, res.appointment.id, 'created', { baseUrl: getBaseUrl(request), notifyBusiness: true });
    } catch (e) {
      console.error('[book] whatsapp notify failed', e);
    }
    return NextResponse.json({ ok: true, id: res.appointment.id, start_at: res.appointment.start_at, end_at: res.appointment.end_at });
  } catch (e) {
    const status = e instanceof BookingError ? e.status : 500;
    return NextResponse.json({ error: e?.message || 'No se pudo crear la reserva' }, { status });
  }
}

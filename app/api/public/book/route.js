import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { createBooking, BookingError } from '@/lib/booking-server';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { getBaseUrl } from '@/lib/base-url';

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

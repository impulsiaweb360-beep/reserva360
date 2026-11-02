import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { rescheduleAppointment, cancelAppointment, BookingError } from '@/lib/booking-server';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { getBaseUrl } from '@/lib/base-url';
import { DEFAULT_TZ } from '@/lib/tz';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, start_at, end_at, status, notes, employee_id, tenant_id, service_id,
      tenant:tenants(*),
      employee:employees(first_name, last_name, specialty, schedule),
      client:clients(first_name, last_name, email, phone),
      service:services(name, duration_minutes, price, color)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Exponer solo los campos públicos del negocio
  const t = data.tenant || {};
  data.tenant = {
    name: t.name, address: t.address, phone: t.phone, email: t.email, logo: t.logo, color: t.color,
    slug: t.slug, business_hours: t.business_hours, vacations: t.vacations, timezone: t.timezone || DEFAULT_TZ,
  };
  return NextResponse.json(data);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const supabase = createSupabaseAdminClient();
  const baseUrl = getBaseUrl(request);

  try {
    if (action === 'cancel') {
      const before = await supabase.from('appointments').select('status').eq('id', id).maybeSingle();
      await cancelAppointment({ supabase, apptId: id });
      if (before?.data && before.data.status !== 'cancelled') {
        try { await notifyAppointment(supabase, id, 'cancelled', { baseUrl }); } catch (e) { console.error(e); }
      }
      return NextResponse.json({ ok: true, status: 'cancelled' });
    }

    if (action === 'reschedule') {
      if (!body.start_at) return NextResponse.json({ error: 'Falta la nueva fecha' }, { status: 400 });
      const upd = await rescheduleAppointment({ supabase, apptId: id, start: body.start_at });
      // Permitir que el recordatorio de WhatsApp se vuelva a enviar para la nueva fecha (si existe la columna)
      try { await supabase.from('appointments').update({ whatsapp_reminder_sent_at: null }).eq('id', id); } catch {}
      try { await notifyAppointment(supabase, id, 'rescheduled', { baseUrl }); } catch (e) { console.error(e); }
      return NextResponse.json({ ok: true, start_at: upd.start_at, end_at: upd.end_at });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const status = e instanceof BookingError ? e.status : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

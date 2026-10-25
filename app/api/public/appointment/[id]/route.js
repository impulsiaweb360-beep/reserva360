import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { isWithinBusinessHours } from '@/lib/booking';
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic';

// Offset (en formato getTimezoneOffset, p.ej. -60 / -120) de Europa/Madrid para una fecha
function madridOffsetMinutes(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
    return Math.round((date.getTime() - asUtc) / 60000);
  } catch {
    return -60;
  }
}

export async function GET(_request, { params }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, start_at, end_at, status, notes, employee_id, tenant_id,
      tenant:tenants(name, address, phone, email, logo, color, slug, business_hours, vacations),
      employee:employees(first_name, last_name, specialty, schedule),
      client:clients(first_name, last_name, email, phone),
      service:services(name, duration_minutes, price, color)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const action = body?.action;
  const supabase = createSupabaseAdminClient();

  if (action === 'cancel') {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'cancelled' });
  }

  if (action === 'reschedule') {
    const { start_at } = body;
    if (!start_at) return NextResponse.json({ error: 'Falta la nueva fecha' }, { status: 400 });

    // Cargar la cita + tenant + empleado + servicio para validación
    const { data: appt } = await supabase
      .from('appointments')
      .select(`
        id, employee_id, tenant_id, start_at, end_at, status,
        tenant:tenants(business_hours, vacations),
        employee:employees(schedule),
        service:services(duration_minutes)
      `)
      .eq('id', id)
      .maybeSingle();

    if (!appt) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
      return NextResponse.json({ error: 'Esta cita ya no se puede modificar' }, { status: 400 });
    }

    const duration = appt.service?.duration_minutes || 60;
    const startDate = new Date(start_at);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
    }
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const startIso = startDate.toISOString();
    const end_at = endDate.toISOString();

    // Validar que no sea en el pasado
    if (startDate.getTime() < Date.now()) {
      return NextResponse.json({ error: 'No puedes reservar en el pasado' }, { status: 400 });
    }

    // El horario del negocio está en hora LOCAL del cliente/negocio, pero el servidor corre en UTC.
    // Convertimos a hora local usando el offset enviado por el navegador (por defecto Europa/Madrid).
    let tzOffset = Number(body?.tz_offset);
    if (!Number.isFinite(tzOffset) || Math.abs(tzOffset) > 14 * 60) {
      tzOffset = madridOffsetMinutes(startDate);
    }
    const toLocalNaive = (d) =>
      dayjs(new Date(d.getTime() - tzOffset * 60000).toISOString().slice(0, 16)); // "YYYY-MM-DDTHH:mm" sin zona
    const localStart = toLocalNaive(startDate);
    const localEnd = toLocalNaive(endDate);

    // Validar horario laboral del negocio y del empleado
    const tenantCtx = {
      businessHours: appt.tenant?.business_hours,
      vacations: appt.tenant?.vacations,
    };
    const empCtx = {
      schedule:
        appt.employee?.schedule && Object.keys(appt.employee.schedule).length > 0
          ? appt.employee.schedule
          : null,
    };

    const check = isWithinBusinessHours({
      start: localStart,
      end: localEnd,
      tenant: tenantCtx,
      employee: empCtx,
    });
    // Para clientes, el descanso del negocio también está bloqueado
    if (!check.ok || check.warning === 'break') {
      return NextResponse.json({ error: check.reason || 'Horario fuera del horario laboral' }, { status: 400 });
    }

    // Comprobar solapamientos con otras citas del mismo empleado
    const { data: overlap } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', appt.tenant_id)
      .eq('employee_id', appt.employee_id)
      .neq('id', id)
      .neq('status', 'cancelled')
      .lt('start_at', end_at)
      .gt('end_at', startIso);
    if (overlap && overlap.length > 0) {
      return NextResponse.json({ error: 'Ese horario ya está ocupado' }, { status: 409 });
    }

    const { error } = await supabase
      .from('appointments')
      .update({ start_at: startIso, end_at, status: 'confirmed' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, start_at: startIso, end_at });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

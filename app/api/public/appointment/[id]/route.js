import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, start_at, end_at, status, notes,
      tenant:tenants(name, address, phone, email, logo, color, slug),
      employee:employees(first_name, last_name, specialty),
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
    if (!start_at) return NextResponse.json({ error: 'Missing start_at' }, { status: 400 });

    // Recalcular end_at usando duration del servicio
    const { data: appt } = await supabase
      .from('appointments')
      .select('employee_id, tenant_id, service:services(duration_minutes)')
      .eq('id', id).single();
    if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const duration = appt.service?.duration_minutes || 60;
    const end_at = new Date(new Date(start_at).getTime() + duration * 60000).toISOString();

    // Comprobar solapamiento
    const { data: overlap } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', appt.tenant_id)
      .eq('employee_id', appt.employee_id)
      .neq('id', id)
      .neq('status', 'cancelled')
      .lt('start_at', end_at)
      .gt('end_at', start_at);
    if (overlap && overlap.length > 0) {
      return NextResponse.json({ error: 'Horario no disponible' }, { status: 409 });
    }

    const { error } = await supabase.from('appointments').update({ start_at, end_at, status: 'confirmed' }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, start_at, end_at });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

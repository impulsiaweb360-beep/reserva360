import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSlotsRange, tenantTz } from '@/lib/booking-server';
import { localParts } from '@/lib/tz';

export const dynamic = 'force-dynamic';

// GET /api/public/<slug>/slots?date=YYYY-MM-DD&service_id=...&employee_id=any|<id>&days=1&exclude=<appointmentId>
// Calcula en servidor los huecos libres en la zona horaria del negocio.
export async function GET(request, { params }) {
  const { slug } = await params;
  const sp = new URL(request.url).searchParams;
  const date = sp.get('date');
  const serviceId = sp.get('service_id');
  const employeeId = sp.get('employee_id') || 'any';
  const days = Math.min(Math.max(Number(sp.get('days')) || 1, 1), 31);
  const exclude = sp.get('exclude');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('*').eq('slug', slug).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
  if (tenant.status !== 'active') return NextResponse.json({ error: 'Negocio no activo' }, { status: 403 });

  const { data: service } = await supabase
    .from('services').select('*').eq('id', serviceId).eq('tenant_id', tenant.id).eq('active', true).maybeSingle();
  if (!service) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 404 });

  let q = supabase.from('employees').select('*').eq('tenant_id', tenant.id).eq('active', true);
  if (employeeId !== 'any') q = q.eq('id', employeeId);
  const { data: employees } = await q;

  // "exclude" solo se acepta si la cita pertenece a este negocio (para reprogramar)
  let excludeApptId = null;
  if (exclude) {
    const { data: ex } = await supabase.from('appointments').select('id, tenant_id').eq('id', exclude).maybeSingle();
    if (ex?.tenant_id === tenant.id) excludeApptId = ex.id;
  }

  const range = await getSlotsRange({
    supabase, tenant, service, employees: employees || [], fromDate: date, days, excludeApptId,
  });
  const tz = tenantTz(tenant);
  return NextResponse.json({
    timezone: tz,
    today: localParts(new Date(), tz).dateStr,
    days: range,
    slots: range[date] || [],
  });
}

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/public/[slug]/availability?date=YYYY-MM-DD&employee_id=...
// Devuelve slots ocupados del día (sin exponer datos del cliente)
export async function GET(request, { params }) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date'); // YYYY-MM-DD
  const employeeId = searchParams.get('employee_id'); // optional

  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // Buscar tenant por slug
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('slug', slug)
    .maybeSingle();
  if (tErr || !tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
  if (tenant.status !== 'active') return NextResponse.json({ error: 'Tenant inactivo' }, { status: 403 });

  // Rango del día (UTC)
  const start = new Date(`${date}T00:00:00.000Z`).toISOString();
  const end = new Date(`${date}T23:59:59.999Z`).toISOString();

  let q = supabase
    .from('appointments')
    .select('employee_id, start_at, end_at, status')
    .eq('tenant_id', tenant.id)
    .neq('status', 'cancelled')
    .gte('start_at', start)
    .lte('start_at', end);

  if (employeeId && employeeId !== 'any') {
    q = q.eq('employee_id', employeeId);
  }

  const { data: busy, error: bErr } = await q;
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  return NextResponse.json({
    busy: (busy || []).map((b) => ({
      employee_id: b.employee_id,
      start: b.start_at,
      end: b.end_at,
    })),
  });
}

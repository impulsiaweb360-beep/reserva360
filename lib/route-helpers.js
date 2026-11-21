import { NextResponse } from 'next/server';
import { getSessionProfile, resolveTenantId } from '@/lib/auth-server';
import { syncProgram } from '@/lib/founders';

// Carga el negocio del usuario logueado. roles: lista de roles permitidos
export async function requireTenant(request, roles = ['tenant_admin', 'super_admin']) {
  const s = await getSessionProfile();
  if (!s) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  await syncProgram(s.admin); // fecha de lanzamiento (cierra el modo lanzamiento) y congelación de fundadores
  if (!roles.includes(s.profile.role)) return { error: NextResponse.json({ error: 'No tienes permiso' }, { status: 403 }) };
  const tenantId = resolveTenantId(s.profile, new URL(request.url).searchParams.get('tenant_id'));
  if (!tenantId) return { error: NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 }) };
  const { data: tenant } = await s.admin.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  if (!tenant) return { error: NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 }) };
  return { ...s, tenant };
}

export const errorResponse = (e) =>
  NextResponse.json({ error: String(e?.message || e) }, { status: e?.status && e.status >= 400 ? e.status : 500 });

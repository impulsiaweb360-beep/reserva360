// Ayudas del panel Super Admin para el programa de fundadores (solo servidor)
import { NextResponse } from 'next/server';
import { getSessionProfile } from './auth-server';
import { syncProgram } from './founders';

export async function requireSuperAdmin() {
  const s = await getSessionProfile();
  if (!s) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (s.profile.role !== 'super_admin') return { error: NextResponse.json({ error: 'Solo para super admin' }, { status: 403 }) };
  await syncProgram(s.admin);
  return s;
}

// Últimas entradas de auditoría del programa y de suscripciones
export async function founderAudit(admin, { tenantId = null, limit = 100 } = {}) {
  let q = admin.from('activity_log')
    .select('id, tenant_id, user_id, action, entity, metadata, created_at')
    .or('action.like.founder.%,action.like.subscription.%')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data } = await q;
  return data || [];
}

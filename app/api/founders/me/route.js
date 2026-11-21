import { NextResponse } from 'next/server';
import { requireTenant, errorResponse } from '@/lib/route-helpers';
import { getFounderState } from '@/lib/founders';

export const dynamic = 'force-dynamic';

// Estado del beneficio fundador del negocio del usuario (solo lectura; se calcula en servidor con datos reales)
export async function GET(request) {
  const a = await requireTenant(request, ['tenant_admin', 'super_admin']);
  if (a.error) return a.error;
  try {
    return NextResponse.json(await getFounderState(a.admin, a.tenant));
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/route-helpers';
import { requireSuperAdmin, founderAudit } from '@/lib/founders-admin';
import { removeSubscriptionDiscount, displayStatus } from '@/lib/founders';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// GET: detalle (beneficio, ciclos pagados, historial y auditoría del negocio)
export async function GET(_request, { params }) {
  const s = await requireSuperAdmin();
  if (s.error) return s.error;
  try {
    const { tenantId } = await params;
    const { data: benefit, error } = await s.admin.rpc('founder_evaluate', { p_tenant: tenantId });
    if (error) throw new Error(error.message);
    const { data: cycles } = await s.admin.from('founder_benefit_cycles').select('*').eq('tenant_id', tenantId).order('created_at');
    return NextResponse.json({ benefit, status: displayStatus(benefit), cycles: cycles || [], history: await founderAudit(s.admin, { tenantId, limit: 300 }) });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST { action: 'set_eligible' | 'set_not_eligible' | 'revoke', reason }
// La BD bloquea cualquier intento de conceder un segundo beneficio y lo deja en auditoría.
export async function POST(request, { params }) {
  const s = await requireSuperAdmin();
  if (s.error) return s.error;
  try {
    const { tenantId } = await params;
    const { action, reason } = await request.json().catch(() => ({}));
    if (!['set_eligible', 'set_not_eligible', 'revoke'].includes(action)) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    const { data: before } = await s.admin.from('founder_benefits').select('benefit_status, stripe_subscription_id').eq('tenant_id', tenantId).maybeSingle();
    const { data, error } = await s.admin.rpc('founder_admin_action', { p_tenant: tenantId, p_admin: s.user.id, p_action: action, p_reason: reason || '' });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    // Al revocar un descuento activo se retira también el cupón en Stripe
    if (action === 'revoke' && before?.benefit_status === 'active' && before.stripe_subscription_id) {
      try {
        await removeSubscriptionDiscount(getStripe(), before.stripe_subscription_id);
        await s.admin.rpc('founder_mark_discount_removed', { p_tenant: tenantId });
      } catch (e) {
        return NextResponse.json({ ok: true, benefit: data, warning: `Revocado, pero no se pudo quitar el cupón en Stripe: ${e.message}` });
      }
    }
    return NextResponse.json({ ok: true, benefit: data });
  } catch (e) {
    return errorResponse(e);
  }
}

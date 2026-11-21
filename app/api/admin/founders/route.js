import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/route-helpers';
import { requireSuperAdmin, founderAudit } from '@/lib/founders-admin';
import { getProgram, displayStatus, programLaunched, resetProgramCache, syncProgram } from '@/lib/founders';

export const dynamic = 'force-dynamic';

// GET: programa + todos los negocios con su estado de fundador + auditoría reciente
export async function GET() {
  const s = await requireSuperAdmin();
  if (s.error) return s.error;
  try {
    const admin = s.admin;
    const program = await getProgram(admin, { fresh: true });
    if (!program) return NextResponse.json({ migrationNeeded: true });
    const { data: benefits, error } = await admin.rpc('founder_evaluate_all');
    if (error) throw new Error(error.message);
    const [{ data: tenants }, { data: owners }, { data: cycles }] = await Promise.all([
      admin.from('tenants').select('id, name, slug, email, created_at, plan_id, subscription_status, billing_interval, status, stripe_subscription_id'),
      admin.from('profiles').select('id, email, first_name, last_name, tenant_id, role, created_at').eq('role', 'tenant_admin'),
      admin.from('founder_benefit_cycles').select('tenant_id, cycles_counted'),
    ]);
    const byTenant = new Map((benefits || []).filter(Boolean).map((b) => [b.tenant_id, b]));
    const rows = (tenants || []).map((t) => {
      const b = byTenant.get(t.id) || null;
      const own = (owners || []).filter((o) => o.tenant_id === t.id).sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
      return {
        tenantId: t.id, name: t.name, slug: t.slug, email: t.email, createdAt: t.created_at, tenantStatus: t.status,
        planId: t.plan_id, subscriptionStatus: t.subscription_status, billingInterval: t.billing_interval,
        registeredBeforeLaunch: !program.launch_at || new Date(t.created_at) < new Date(program.launch_at),
        owners: own.map((o) => ({ id: o.id, email: o.email, name: `${o.first_name || ''} ${o.last_name || ''}`.trim() })),
        status: displayStatus(b),
        eligibilityStatus: b?.eligibility_status || 'pending',
        benefitStatus: b?.benefit_status || 'none',
        override: Boolean(b?.eligibility_override),
        frozen: Boolean(b?.frozen),
        requirements: b?.requirements || {},
        cyclesUsed: b?.cycles_used || 0,
        totalCycles: b?.total_cycles || 3,
        cyclesRecorded: (cycles || []).filter((c) => c.tenant_id === t.id).length,
        activatedAt: b?.activated_at || null,
        endedAt: b?.ended_at || null,
        endReason: b?.end_reason || null,
        initialPlanId: b?.initial_plan_id || null,
        currentPlanId: b?.current_plan_id || null,
        stripeSubscriptionId: b?.stripe_subscription_id || null,
      };
    });
    return NextResponse.json({
      program: { ...program, launched: programLaunched(program) },
      rows,
      audit: await founderAudit(admin, { limit: 150 }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// PUT: configuración del programa { launchAt, status, newEligibilityEnabled }
export async function PUT(request) {
  const s = await requireSuperAdmin();
  if (s.error) return s.error;
  try {
    const admin = s.admin;
    const body = await request.json().catch(() => ({}));
    const program = await getProgram(admin, { fresh: true });
    if (!program) return NextResponse.json({ error: 'Falta ejecutar migration-fundadores.sql en Supabase' }, { status: 400 });
    const patch = {};
    if ('launchAt' in body) {
      const v = body.launchAt ? new Date(body.launchAt) : null;
      if (v && Number.isNaN(v.getTime())) return NextResponse.json({ error: 'Fecha de lanzamiento no válida' }, { status: 400 });
      const iso = v ? v.toISOString() : null;
      const changed = (iso || null) !== (program.launch_at ? new Date(program.launch_at).toISOString() : null);
      if (changed && program.frozen_at) {
        return NextResponse.json({ error: 'El lanzamiento ya se produjo y la elegibilidad está congelada: la fecha no se puede cambiar.' }, { status: 400 });
      }
      if (changed) patch.launch_at = iso;
    }
    if ('status' in body) {
      if (!['active', 'closed'].includes(body.status)) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
      patch.status = body.status;
    }
    if ('newEligibilityEnabled' in body) patch.new_eligibility_enabled = Boolean(body.newEligibilityEnabled);
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true, program });
    patch.updated_at = new Date().toISOString();
    patch.updated_by = s.user.id;
    const { data, error } = await admin.from('founder_program').update(patch).eq('id', true).select('*').single();
    if (error) throw new Error(error.message);
    await admin.from('activity_log').insert({
      tenant_id: null, user_id: s.user.id, action: 'founder.program_updated', entity: 'founder_program',
      metadata: { before: { launch_at: program.launch_at, status: program.status, new_eligibility_enabled: program.new_eligibility_enabled }, changes: patch },
    });
    resetProgramCache();
    await syncProgram(admin);
    return NextResponse.json({ ok: true, program: data });
  } catch (e) {
    return errorResponse(e);
  }
}

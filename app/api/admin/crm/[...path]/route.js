// API del CRM Comercial — exclusiva para Super Admin (rol comprobado en servidor en cada petición)
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/founders-admin';
import {
  CrmError, crmReady, stats, listLeads, pipeline, getLead, createLead, updateLead, changeStage, addActivity,
  leadCandidates, searchTenants, linkLead, unlinkLead, createTask, updateTask, listTasks, listActivities,
  createPrivacyRequest, resolvePrivacyRequest, leadDataExport, syncWithApp, audit,
} from '@/lib/crm/server';
import { analyzeImport, commitImport, exportLeads } from '@/lib/crm/import-export';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (data, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

async function guard(params) {
  const s = await requireSuperAdmin();
  if (s.error) return { res: s.error };
  if (!(await crmReady(s.admin))) return { res: json({ migrationNeeded: true, error: 'Falta ejecutar public/migration-crm.sql en Supabase' }, 503) };
  const { path = [] } = await params;
  for (const seg of path) if (!/^[a-z0-9-]+$/i.test(seg)) return { res: json({ error: 'Ruta no válida' }, 400) };
  return { s, path };
}
const idOr404 = (id) => { if (!UUID.test(id || '')) throw new CrmError('Identificador no válido', 400); return id; };
async function body(request) {
  const text = await request.text();
  if (text.length > 3_000_000) throw new CrmError('Petición demasiado grande', 413);
  try { return text ? JSON.parse(text) : {}; } catch { throw new CrmError('JSON no válido'); }
}
function fail(e) {
  if (e instanceof CrmError) return json({ error: e.message, ...e.extra }, e.status);
  console.error('[crm]', e);
  return json({ error: 'Error interno del CRM' }, 500);
}

export async function GET(request, { params }) {
  const g = await guard(params);
  if (g.res) return g.res;
  const { s, path } = g;
  const sp = new URL(request.url).searchParams;
  try {
    const [a, id, sub] = path;
    if (a === 'stats') { await syncWithApp(s.admin, { actorId: null }); return json(await stats(s.admin)); }
    if (a === 'leads' && !id) { await syncWithApp(s.admin, { actorId: null }); return json(await listLeads(s.admin, sp)); }
    if (a === 'leads' && id && !sub) return json(await getLead(s.admin, idOr404(id)));
    if (a === 'leads' && sub === 'candidates') return json({ candidates: await leadCandidates(s.admin, idOr404(id)) });
    if (a === 'leads' && sub === 'data') return json(await leadDataExport(s.admin, s.user, idOr404(id)));
    if (a === 'pipeline') { await syncWithApp(s.admin, { actorId: null }); return json(await pipeline(s.admin, sp)); }
    if (a === 'tasks') return json(await listTasks(s.admin, sp));
    if (a === 'activities') return json(await listActivities(s.admin, sp));
    if (a === 'tenants') return json({ rows: await searchTenants(s.admin, sp.get('q')) });
    if (a === 'export') {
      const { csv, count } = await exportLeads(s.admin, s.user, sp);
      return new NextResponse(csv, {
        headers: { ...NO_STORE, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="leads-reserva360-${new Date().toISOString().slice(0, 10)}.csv"`, 'X-Export-Count': String(count) },
      });
    }
    return json({ error: 'No encontrado' }, 404);
  } catch (e) { return fail(e); }
}

export async function POST(request, { params }) {
  const g = await guard(params);
  if (g.res) return g.res;
  const { s, path } = g;
  try {
    const [a, id, sub] = path;
    const b = await body(request);
    if (a === 'leads' && !id) return json({ lead: await createLead(s.admin, s.user, b) }, 201);
    if (a === 'leads' && sub === 'stage') {
      await changeStage(s.admin, s.user, idOr404(id), String(b.stage || ''), b.note || null, 'manual');
      return json(await getLead(s.admin, id));
    }
    if (a === 'leads' && sub === 'activities') return json({ activity: await addActivity(s.admin, s.user, idOr404(id), b) }, 201);
    if (a === 'leads' && sub === 'link') return json(await linkLead(s.admin, s.user, idOr404(id), b));
    if (a === 'leads' && sub === 'unlink') return json(await unlinkLead(s.admin, s.user, idOr404(id), b));
    if (a === 'leads' && sub === 'privacy') return json({ request: await createPrivacyRequest(s.admin, s.user, idOr404(id), b) }, 201);
    if (a === 'privacy' && sub === 'resolve') return json({ request: await resolvePrivacyRequest(s.admin, s.user, idOr404(id), b) });
    if (a === 'tasks' && !id) return json({ task: await createTask(s.admin, s.user, b) }, 201);
    if (a === 'import' && id === 'preview') {
      const res = await analyzeImport(s.admin, b.rows, { mode: b.mode === 'update' ? 'update' : 'skip' });
      return json(res);
    }
    if (a === 'import' && id === 'commit') return json(await commitImport(s.admin, s.user, b));
    if (a === 'sync') {
      const r = await syncWithApp(s.admin, { force: true, actorId: s.user.id });
      await audit(s.admin, { userId: s.user.id, action: 'crm.sync', metadata: r });
      return json(r);
    }
    return json({ error: 'No encontrado' }, 404);
  } catch (e) { return fail(e); }
}

export async function PATCH(request, { params }) {
  const g = await guard(params);
  if (g.res) return g.res;
  const { s, path } = g;
  try {
    const [a, id] = path;
    const b = await body(request);
    if (a === 'leads' && id) { await updateLead(s.admin, s.user, idOr404(id), b); return json(await getLead(s.admin, id)); }
    if (a === 'tasks' && id) return json({ task: await updateTask(s.admin, s.user, idOr404(id), b) });
    return json({ error: 'No encontrado' }, 404);
  } catch (e) { return fail(e); }
}

// No hay borrado de leads: la supresión RGPD se hace anonimizando (conserva estadísticas e historial sin datos personales)
export async function DELETE() {
  return json({ error: 'Los leads no se borran. Usa una solicitud de supresión (RGPD) para anonimizarlo.' }, 405);
}

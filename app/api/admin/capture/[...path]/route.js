// API de Captación — exclusiva para Super Admin (rol comprobado en servidor en cada petición)
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/founders-admin';
import { CrmError, audit } from '@/lib/crm/server';
import { captureReady, getLegalInfo, captureAdminClient } from '@/lib/crm/capture';
import { revalidatePath } from 'next/cache';
import { captureMetrics, channelsOverview, setChannelEnabled, listEvents, reviewList, resolveReview, saveLegalInfo, testWebForm } from '@/lib/crm/capture-admin';
import { testMetaConnection, subscribeMetaPage, retryFailedMetaEvents, MetaError } from '@/lib/crm/meta';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (data, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

async function guard(params) {
  const s = await requireSuperAdmin();
  if (s.error) return { res: s.error };
  s.admin = captureAdminClient();
  if (!(await captureReady(s.admin))) return { res: json({ migrationNeeded: true, error: 'Falta ejecutar public/migration-captacion.sql en Supabase' }, 503) };
  const { path = [] } = await params;
  for (const seg of path) if (!/^[a-z0-9-]+$/i.test(seg)) return { res: json({ error: 'Ruta no válida' }, 400) };
  return { s, path };
}
async function body(request) {
  const text = await request.text();
  if (text.length > 50000) throw new CrmError('Petición demasiado grande', 413);
  try { return text ? JSON.parse(text) : {}; } catch { throw new CrmError('JSON no válido'); }
}
function fail(e) {
  if (e instanceof CrmError) return json({ error: e.message, ...e.extra }, e.status);
  if (e instanceof MetaError) return json({ error: e.message }, 502);
  console.error('[captacion admin]', e?.message);
  return json({ error: 'Error interno de Captación' }, 500);
}

export async function GET(request, { params }) {
  const g = await guard(params);
  if (g.res) return g.res;
  const { s, path } = g;
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  try {
    const [a] = path;
    if (a === 'metrics') return json(await captureMetrics(s.admin, sp));
    if (a === 'channels') return json(await channelsOverview(s.admin));
    if (a === 'events') return json(await listEvents(s.admin, sp));
    if (a === 'review') return json({ rows: await reviewList(s.admin) });
    if (a === 'legal') return json(await getLegalInfo(s.admin));
    return json({ error: 'No encontrado' }, 404);
  } catch (e) { return fail(e); }
}

export async function POST(request, { params }) {
  const g = await guard(params);
  if (g.res) return g.res;
  const { s, path } = g;
  try {
    const b = await body(request);
    const [a, b1, b2] = path;
    if (a === 'channels') return json({ channels: await setChannelEnabled(s.admin, s.user, b) });
    if (a === 'legal') { const r = await saveLegalInfo(s.admin, s.user, b); try { revalidatePath('/privacidad'); } catch { /* */ } return json(r); }
    if (a === 'web-test') return json(await testWebForm(s.admin, s.user));
    if (a === 'meta' && b1 === 'test') {
      const r = await testMetaConnection(s.admin);
      await audit(s.admin, { userId: s.user.id, action: 'crm.meta_connection_tested', metadata: { connected: Boolean(r.connected), error: r.error ? String(r.error).slice(0, 200) : null } });
      return json(r);
    }
    if (a === 'meta' && b1 === 'subscribe') {
      const r = await subscribeMetaPage(s.admin);
      await audit(s.admin, { userId: s.user.id, action: 'crm.meta_page_subscribed', metadata: { subscribed: Boolean(r.subscribed) } });
      return json(r);
    }
    if (a === 'events' && UUID.test(b1 || '') && b2 === 'retry') {
      const r = await retryFailedMetaEvents(s.admin, { eventId: b1 });
      await audit(s.admin, { userId: s.user.id, action: 'crm.capture_event_retried', metadata: { event_id: b1, result: r[0]?.status || 'not_retryable' } });
      if (!r.length) throw new CrmError('Este evento no se puede reintentar', 409);
      return json(r[0]);
    }
    if (a === 'review' && UUID.test(b1 || '') && b2 === 'resolve') return json(await resolveReview(s.admin, s.user, b1, b));
    return json({ error: 'No encontrado' }, 404);
  } catch (e) { return fail(e); }
}

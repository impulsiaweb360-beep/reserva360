// Pruebas del webhook de Meta (auditoría): firma, pruebas de Meta, idempotencia, errores reales y logs.
// Uso: bundle con esbuild + node, con .env cargado y META_APP_SECRET/META_PAGE_ID en el entorno.
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { handleMetaWebhook } from '@/lib/crm/meta';

const BASE = 'http://localhost:3000';
const SECRET = process.env.META_APP_SECRET;
const PAGE = process.env.META_PAGE_ID;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const START = new Date().toISOString();
const TAG = `zzmeta${Date.now().toString(36)}`;
let pass = 0, fail = 0;
const ok = (c, m, extra = '') => { if (c) { pass++; console.log('✅', m); } else { fail++; console.log('❌', m, extra); } };
const sign = (raw, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
const post = async (body, sig) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const r = await fetch(`${BASE}/api/meta/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', ...(sig === undefined ? { 'x-hub-signature-256': sign(raw) } : sig ? { 'x-hub-signature-256': sig } : {}) }, body: raw });
  return [r.status, await r.json().catch(() => ({}))];
};
const payload = (v, entryId = PAGE) => ({ object: 'page', entry: [{ id: entryId, time: Math.floor(Date.now() / 1000), changes: [{ field: 'leadgen', value: v }] }] });
const SAMPLE = { ad_id: '444444444', form_id: '444444444444', leadgen_id: '444444444444', created_time: Math.floor(Date.now() / 1000), page_id: '444444444444', adgroup_id: '44444444444' };
const events = async (q) => (await q).data || [];

try {
  // ---------- 1. Firma / validación
  let [s, b] = await post({ object: 'page', entry: [] }, null);
  ok(s === 401, 'POST sin firma → 401', s);
  [s] = await post({ object: 'page', entry: [] }, 'sha256=' + 'a'.repeat(64));
  ok(s === 401, 'POST con firma incorrecta → 401', s);
  [s] = await post({ object: 'page', entry: [] }, sign('{"x":1}', 'otro-secreto'));
  ok(s === 401, 'POST firmado con otro secreto → 401', s);
  [s] = await post('{no es json', sign('{no es json'));
  ok(s === 400, 'POST firmado con JSON no válido → 400', s);
  [s, b] = await post({ object: 'user', entry: [] });
  ok(s === 200 && b.ignored, 'object ≠ page → 200 ignorado', JSON.stringify(b));

  // ---------- 2. GET verificación
  const vt = (await admin.from('platform_settings').select('value').eq('key', 'meta_verify_token').single()).data?.value?.value;
  let r = await fetch(`${BASE}/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(vt)}&hub.challenge=987654`);
  ok(r.status === 200 && (await r.text()) === '987654', 'GET con token correcto → devuelve challenge');
  r = await fetch(`${BASE}/api/meta/webhook?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=987654`);
  ok(r.status === 403, 'GET con token incorrecto → 403');

  // ---------- 3. Evento de prueba de Meta (payload de ejemplo) enviado 2 veces
  const leadsBefore = (await admin.from('crm_leads').select('id', { count: 'exact', head: true })).count;
  [s, b] = await post(payload(SAMPLE, '0'));
  ok(s === 200 && b.tests === 1 && b.processed === 0, 'Prueba de Meta #1 → 200 {tests:1}', JSON.stringify(b));
  [s, b] = await post(payload(SAMPLE, '0'));
  ok(s === 200 && b.tests === 1, 'Prueba de Meta #2 → 200 {tests:1} (ya no se descarta en silencio)', JSON.stringify(b));
  const tests = await events(admin.from('crm_capture_events').select('id,status,external_id,error').eq('channel', 'meta').eq('status', 'test').gte('received_at', START));
  ok(tests.length === 2, `Las 2 pruebas quedan como eventos visibles «test» (${tests.length})`);
  ok(tests.every((t) => t.external_id === null), 'Las pruebas no ocupan el id del lead real');
  const leadsAfter = (await admin.from('crm_leads').select('id', { count: 'exact', head: true })).count;
  ok(leadsAfter === leadsBefore, 'Las pruebas no crean leads');

  // ---------- 4. Lead real inexistente en Meta (Graph error 100 → no reintentable) vía HTTP real
  const fakeId = `9${Date.now()}`.slice(0, 15);
  [s, b] = await post(payload({ leadgen_id: fakeId, page_id: PAGE, form_id: '123456789', created_time: Math.floor(Date.now() / 1000) }));
  const ev1 = (await events(admin.from('crm_capture_events').select('*').eq('channel', 'meta').eq('external_id', fakeId)))[0];
  ok(ev1?.status === 'failed' && /Meta|error/i.test(ev1?.error || ''), `Lead que Meta rechaza → evento «failed» con motivo visible (${ev1?.status})`, ev1?.error);
  ok(s === 200 && b.failed === 1, `Error NO reintentable (permiso/parámetro) → 200, guardado como fallido (HTTP ${s})`, JSON.stringify(b));
  [s, b] = await post(payload({ leadgen_id: fakeId, page_id: PAGE, form_id: '123456789' }));
  const ev1b = (await events(admin.from('crm_capture_events').select('*').eq('channel', 'meta').eq('external_id', fakeId)));
  ok(ev1b.length === 1 && b.duplicates === 1, 'Reenvío del mismo leadgen → sin fila nueva, contado como duplicado', JSON.stringify(b));
  ok((ev1b[0]?.payload?.deliveries || 0) === 2 && ev1b[0]?.attempts > ev1.attempts, `Reenvío registrado (deliveries=${ev1b[0]?.payload?.deliveries}) y reprocesado (intentos ${ev1.attempts}→${ev1b[0]?.attempts})`);

  // ---------- 5. Escenarios con Meta simulado (llamada directa al manejador)
  const realFetch = globalThis.fetch;
  let mode = 'down', graphCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.href || input?.url || String(input);
    if (url.includes('graph.facebook.com')) {
      graphCalls++;
      if (mode === 'down') return new Response(JSON.stringify({ error: { message: 'Service temporarily unavailable', code: 2 } }), { status: 503 });
      if (url.includes('fields=name') && !url.includes('field_data')) return new Response(JSON.stringify({ name: 'Formulario test' }), { status: 200 });
      return new Response(JSON.stringify({
        id: lid, created_time: new Date().toISOString(), form_id: '555', page_id: PAGE, platform: 'fb', campaign_id: 'c1', campaign_name: 'Campaña test',
        field_data: [{ name: 'full_name', values: [`${TAG} Prueba`] }, { name: 'email', values: [`${TAG}@example.com`] }, { name: 'phone_number', values: [`+346${String(Date.now()).slice(-8)}`] }, { name: 'company_name', values: [`${TAG} SL`] }],
      }), { status: 200 });
    }
    return realFetch(input, init);
  };
  const lid = `8${Date.now()}`.slice(0, 15);
  const raw = (v) => JSON.stringify(payload(v));
  const v = { leadgen_id: lid, page_id: PAGE, form_id: '555', created_time: Math.floor(Date.now() / 1000) };
  let out = await handleMetaWebhook(admin, raw(v), sign(raw(v)), { requestId: 'test-down' });
  const evd = (await events(admin.from('crm_capture_events').select('*').eq('external_id', lid)))[0];
  ok(out.status === 500, `Meta caído (error temporal) → HTTP 500 para que Meta reenvíe (${out.status})`);
  ok(graphCalls >= 2 && evd?.attempts === 2, `Reintento en la misma petición (intentos=${evd?.attempts}, llamadas=${graphCalls})`);
  mode = 'up';
  out = await handleMetaWebhook(admin, raw(v), sign(raw(v)), { requestId: 'test-up' });
  const evu = (await events(admin.from('crm_capture_events').select('*').eq('external_id', lid)))[0];
  ok(out.status === 200 && out.body.duplicates === 1 && ['processed','review'].includes(evu?.status) && evu?.lead_id, `Reenvío de Meta con Meta disponible → lead procesado (${evu?.status})`, JSON.stringify(out.body));
  const leads = await events(admin.from('crm_leads').select('id,source').eq('email', `${TAG}@example.com`));
  ok(leads.length === 1 && leads[0].source === 'facebook_lead_ads', 'Lead creado en el CRM una sola vez, origen Facebook');
  out = await handleMetaWebhook(admin, raw(v), sign(raw(v)), { requestId: 'test-dup' });
  const leads2 = await events(admin.from('crm_leads').select('id').eq('email', `${TAG}@example.com`));
  ok(out.status === 200 && out.body.duplicates === 1 && out.body.processed === 0 && leads2.length === 1, 'Tercer envío ya procesado → 200, sin reprocesar ni duplicar', JSON.stringify(out.body));

  // Supabase caído al guardar → 500 (no se oculta tras un 200)
  const brokenAdmin = new Proxy(admin, { get(t, p) { if (p === 'from') return (tbl) => tbl === 'crm_capture_events' ? { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: 'XX000', message: 'simulado: base de datos no disponible' } }) }) }) } : t.from(tbl); return t[p]; } });
  const v2 = { ...v, leadgen_id: `7${Date.now()}`.slice(0, 15) };
  let threw = false;
  try { await handleMetaWebhook(brokenAdmin, raw(v2), sign(raw(v2)), { requestId: 'test-db' }); } catch { threw = true; }
  ok(threw, 'Fallo de Supabase al guardar → error propagado (la ruta responde 500)');
  globalThis.fetch = realFetch;

  // ---------- 6. Ruta de relleno
  r = await fetch(`${BASE}/api/ruta-que-no-existe-xyz`, { method: 'POST' });
  ok(r.status === 404, `Ruta /api inexistente → 404 (${r.status})`);
  r = await fetch(`${BASE}/api/capture/config`);
  ok(r.status === 200, 'Rutas reales siguen respondiendo (capture/config 200)');
} catch (e) {
  fail++; console.log('❌ EXCEPCIÓN', e?.stack || e);
} finally {
  // ---------- limpieza
  const { data: lds } = await admin.from('crm_leads').select('id').like('email', `${TAG}%`);
  for (const l of lds || []) await admin.from('crm_leads').delete().eq('id', l.id);
  await admin.from('crm_capture_events').delete().eq('channel', 'meta').gte('received_at', START);
  await admin.from('crm_capture_events').delete().eq('channel', 'meta').gte('updated_at', START).neq('external_id', '444444444444');
  await admin.from('activity_log').delete().like('action', 'crm.%').gte('created_at', START);
  console.log(`\nRESULTADO ${pass}/${pass + fail}`);
}

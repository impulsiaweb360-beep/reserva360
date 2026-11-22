// Pruebas de integración · Fase 3 Captación (Supabase real + API real). Borra sus datos de prueba al terminar.
// Meta: sin credenciales reales, se prueba el webhook firmado con un secreto de prueba y respuestas simuladas de Graph
// SOLO dentro de este proceso de pruebas (la app sigue mostrando Meta como «Pendiente de configuración»).
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'crypto';
import { handleMetaWebhook, retryFailedMetaEvents } from '../lib/crm/meta.js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sb = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APP = 'http://localhost:3000';
const REF = new URL(URL_).hostname.split('.')[0];
const TAG = `zzcap${Date.now().toString(36)}`;
const START = new Date().toISOString();
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: Boolean(cond) }); console.log(`${cond ? 'PASA ' : 'FALLA'} · ${name}${extra ? ` — ${extra}` : ''}`); };
const rnd = () => String(Math.floor(10000000 + Math.random() * 89999999));
const phone = () => `+34 6${rnd()}`;
const email = (k) => `${TAG}.${k}@example.com`;
const created = { users: [], tenants: [], metaIds: [] };

async function cookieFor(em, password) {
  const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: em, password });
  if (error) throw error;
  const val = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`;
  const name = `sb-${REF}-auth-token`;
  return val.length <= 3180 ? `${name}=${val}` : val.match(/.{1,3180}/g).map((p, i) => `${name}.${i}=${p}`).join('; ');
}
const adminApi = (cookie) => async (path, { method = 'GET', body } = {}) => {
  const r = await fetch(`${APP}/api/admin/${path}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* */ }
  return { status: r.status, json };
};
let ipSeq = 1;
async function submit(fields, { ip = `10.77.${ipSeq++}.1`, origin = null } = {}) {
  const body = {
    first_name: 'Ana', business_name: `${TAG} Negocio`, email: email('x'), sector: 'Otro', request_type: 'info',
    consent_privacy: true, consent_email: false, consent_whatsapp: false, submission_id: randomUUID(), page: '/contacto',
    started_at: Date.now() - 8000, ...fields,
  };
  const r = await fetch(`${APP}/api/capture/submit`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
  let json = {}; try { json = await r.json(); } catch { /* */ }
  return { status: r.status, json, body };
}
const leadByEmail = async (em) => (await sb.from('crm_leads').select('*').eq('email', em.toLowerCase()).maybeSingle()).data;
const acts = async (leadId) => (await sb.from('crm_activities').select('*').eq('lead_id', leadId).order('occurred_at')).data || [];

// ----------------------------------------------------- simulación de Graph API (solo este proceso)
const realFetch = globalThis.fetch;
let graphMode = 'ok';
const metaLeads = new Map();
globalThis.fetch = async (input, init) => {
  const u = typeof input === 'string' ? input : (input.href || input.url);
  if (!String(u).startsWith('https://graph.facebook.com/')) return realFetch(input, init);
  if (graphMode === 'down') throw new TypeError('fetch failed');
  if (graphMode === 'error') return new Response(JSON.stringify({ error: { code: 2, message: 'Service temporarily unavailable' } }), { status: 500 });
  const path = new URL(u).pathname.split('/').slice(2).join('/');
  if (metaLeads.has(path)) return new Response(JSON.stringify(metaLeads.get(path)), { status: 200 });
  if (path === '444') return new Response(JSON.stringify({ id: '444', name: 'Formulario Captación ZZ' }), { status: 200 });
  return new Response(JSON.stringify({ error: { code: 100, message: 'Unknown path' } }), { status: 400 });
};
const META_SECRET = `test_secret_${TAG}`;
const PAGE = '9990001112223';
const sign = (raw, secret = META_SECRET) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
function metaPayload(leadgenId) {
  return JSON.stringify({ object: 'page', entry: [{ id: PAGE, time: Math.floor(Date.now() / 1000), changes: [{ field: 'leadgen', value: { leadgen_id: leadgenId, page_id: PAGE, form_id: '444', ad_id: '111', adgroup_id: '222', created_time: Math.floor(Date.now() / 1000) } }] }] });
}
function addMetaLead(id, { platform = 'fb', em, ph, wa = false, campaign = `${TAG} Campaña Otoño`, extra = [] } = {}) {
  created.metaIds.push(id);
  metaLeads.set(id, {
    id, created_time: new Date().toISOString(), platform, page_id: PAGE, form_id: '444', is_organic: false,
    ad_id: '111', ad_name: 'Anuncio A', adset_id: '222', adset_name: 'Conjunto A', campaign_id: `c${TAG}`, campaign_name: campaign,
    field_data: [{ name: 'full_name', values: ['Marta Meta Prueba'] }, { name: 'email', values: [em] }, { name: 'phone_number', values: [ph] }, { name: 'company_name', values: [`${TAG} Salón Meta`] }, { name: 'city', values: ['Sevilla'] }, { name: 'tipo_de_negocio', values: ['Peluquería'] }, { name: '¿qué_necesitas?', values: ['Quiero una demo'] }, ...extra],
    custom_disclaimer_responses: [{ checkbox_key: 'acepto_whatsapp_comercial', is_checked: wa ? '1' : '0' }],
  });
}

async function main() {
  const settingsBefore = Object.fromEntries(((await sb.from('platform_settings').select('key, value').in('key', ['capture_channels', 'legal_info', 'meta_status'])).data || []).map((r) => [r.key, r.value]));
  const SA = await cookieFor('reserva360.app@gmail.com', 'Reserva360_79');
  const sa = adminApi(SA);

  // ---------- Formulario web ----------
  const cfg = await (await fetch(`${APP}/api/capture/config`)).json();
  ok('1. Formulario web disponible (config pública sin secretos)', cfg.enabled === true && !('secret' in cfg), JSON.stringify(cfg));

  const ph1 = phone();
  const s1 = await submit({ email: email('a'), phone: ph1, first_name: 'Lucía', last_name: 'Pérez', business_name: `${TAG} Fisio Norte`, city: 'Bilbao', province: 'Bizkaia', sector: 'Fisioterapia', employees_range: '4-10', current_system: 'Agenda en papel', problem: 'Muchas ausencias', interest: 'Recordatorios', request_type: 'demo', page: '/demo' });
  const L1 = await leadByEmail(email('a'));
  ok('2. Envío correcto desde el formulario web → 200', s1.status === 200 && s1.json.ok, `status=${s1.status} ${s1.json.error || ''}`);
  ok('3. Lead visible en el CRM con fuente web y etapa «Nuevo lead»', L1 && L1.source === 'web_form' && L1.stage === 'new' && L1.source_detail === 'Formulario web · /demo');
  const crmList = await sa(`crm/leads?q=${encodeURIComponent(TAG)}&source=web_form`);
  ok('   Aparece en CRM → Leads (API del CRM, filtro fuente web)', crmList.status === 200 && (crmList.json.rows || crmList.json.leads || []).some((l) => l.id === L1?.id), `status=${crmList.status}`);
  ok('4. Sin aceptar publicidad: se guarda la solicitud, sin permiso comercial', L1 && L1.comm_email === false && L1.comm_whatsapp === false && L1.legal_basis === 'pre_contract' && !L1.consent_at);
  const c1 = L1?.metadata?.last_capture?.consents;
  ok('   Consentimientos guardados por separado con versión, fecha y origen', c1?.privacy?.accepted === true && c1?.email?.accepted === false && c1?.whatsapp?.accepted === false && c1?.privacy?.version && c1?.privacy?.at && c1?.privacy?.origin);
  ok('   Datos de la solicitud guardados (tipo, sistema actual, empleados)', L1?.metadata?.last_capture?.request_type === 'demo' && L1?.metadata?.last_capture?.details?.current_system === 'Agenda en papel' && L1?.employees_estimate === 10 && /Muchas ausencias/.test(L1?.needs || ''));
  const a1 = L1 ? await acts(L1.id) : [];
  ok('5. Actividad automática «Lead recibido» con canal, formulario, fecha y estado', a1.some((a) => a.type === 'capture' && /Formulario web/.test(a.description) && /demostración/.test(a.description) && a.metadata?.outcome === 'created' && a.occurred_at));
  const { data: ev1 } = await sb.from('crm_capture_events').select('*').eq('idempotency_key', `web:${s1.body.submission_id}`).maybeSingle();
  ok('   Evento registrado (procesado, con hash de IP y sin datos personales)', ev1?.status === 'processed' && ev1?.lead_id === L1?.id && ev1?.ip_hash && !JSON.stringify(ev1.payload).includes(email('a')) && !JSON.stringify(ev1).includes('10.77.'));

  // Idempotencia: mismo envío repetido (doble clic / reintento)
  const again = await fetch(`${APP}/api/capture/submit`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.77.200.1' }, body: JSON.stringify(s1.body) });
  const { count: cntA } = await sb.from('crm_leads').select('id', { count: 'exact', head: true }).eq('email', email('a'));
  ok('6. Mismo envío repetido → no duplica lead ni actividad', again.status === 200 && cntA === 1 && (await acts(L1.id)).filter((a) => a.type === 'capture').length === 1);

  // Mismo email, nuevo formulario con consentimiento de email → actualiza, no duplica
  const s2 = await submit({ email: email('a').toUpperCase(), first_name: 'Lucía', business_name: `${TAG} Fisio Norte`, consent_email: true, request_type: 'plans' });
  const L1b = await leadByEmail(email('a'));
  const capActs = (await acts(L1.id)).filter((a) => a.type === 'capture');
  ok('7. Lead existente (mismo email) → se actualiza y se añade actividad, sin duplicar', s2.status === 200 && capActs.length === 2 && L1b.id === L1.id);
  ok('   Nuevo consentimiento de email registrado (fecha y origen)', L1b.comm_email === true && L1b.comm_whatsapp === false && L1b.legal_basis === 'consent' && L1b.consent_at && /Formulario web/.test(L1b.consent_source || ''));
  ok('   Datos previos no sobrescritos (ciudad y sector se conservan)', L1b.city === 'Bilbao' && L1b.sector === 'Fisioterapia');

  // Mismo email pero otra persona/negocio → revisión manual, sin fusionar
  const s3 = await submit({ email: email('a'), first_name: 'Roberto', business_name: `${TAG} Taller Distinto`, city: 'Cádiz' });
  const L1c = await leadByEmail(email('a'));
  const { data: ev3 } = await sb.from('crm_capture_events').select('status, review_reason').eq('idempotency_key', `web:${s3.body.submission_id}`).maybeSingle();
  ok('8. Mismo email con otro nombre y negocio → revisión manual, la ficha no cambia', s3.status === 200 && ev3?.status === 'review' && L1c.first_name === 'Lucía' && L1c.business_name === `${TAG} Fisio Norte` && L1c.city === 'Bilbao');

  // Mismo teléfono, otro email → lead nuevo + revisión (no se fusiona)
  const s4 = await submit({ email: email('b'), phone: ph1, first_name: 'Carmen', business_name: `${TAG} Estética Sur`, consent_whatsapp: true });
  const L2 = await leadByEmail(email('b'));
  const { data: ev4 } = await sb.from('crm_capture_events').select('status').eq('idempotency_key', `web:${s4.body.submission_id}`).maybeSingle();
  ok('9. Mismo teléfono con otro email → lead nuevo marcado para revisión (sin fusionar)', s4.status === 200 && L2 && L2.id !== L1.id && ev4?.status === 'review' && (L2.metadata?.possible_duplicates || []).includes(L1.id));
  ok('   Consentimiento de WhatsApp registrado de forma independiente', L2?.comm_whatsapp === true && L2?.comm_email === false && L2?.legal_basis === 'consent');

  // Límite por email (3/hora): 4.º envío del mismo email bloqueado
  const s5 = await submit({ email: email('a'), first_name: 'Lucía', business_name: `${TAG} Fisio Norte` });
  ok('10. Límite de envíos por email (4.º en una hora → 429)', s5.status === 429, `status=${s5.status}`);

  // Validaciones de servidor
  const v1 = await submit({ email: email('v1'), consent_privacy: false });
  const v2 = await submit({ email: 'no-es-un-email' });
  const v3 = await submit({ email: email('v3'), consent_whatsapp: true, phone: null });
  const v4 = await submit({ email: email('v4'), sector: 'Inventado' });
  const v5 = await submit({ email: email('v5'), phone: '12' });
  const v6 = await submit({ email: email('v6'), extra_field: 'x' });
  ok('11. Validación en servidor (privacidad, email, WhatsApp sin teléfono, sector, teléfono, campos extra → 400)', [v1, v2, v3, v4, v5, v6].every((r) => r.status === 400), [v1, v2, v3, v4, v5, v6].map((r) => r.status).join(','));
  ok('   Errores indican el campo', v2.json.field === 'email' && v3.json.field === 'phone');

  // Antispam invisible
  const h1 = await submit({ email: email('bot1'), website: 'http://spam.example' });
  const h2 = await submit({ email: email('bot2'), started_at: Date.now() - 500 });
  ok('12. Antispam: campo trampa y envío demasiado rápido → respuesta normal pero NO se crea lead', h1.status === 200 && h2.status === 200 && !(await leadByEmail(email('bot1'))) && !(await leadByEmail(email('bot2'))));
  const { count: spamCount } = await sb.from('crm_capture_events').select('id', { count: 'exact', head: true }).eq('status', 'spam').gte('received_at', START);
  ok('   Bloqueos registrados como spam (sin datos personales)', spamCount >= 2);

  // Límite por IP (5 en 10 min)
  const ipX = '10.99.99.99';
  const burst = [];
  for (let i = 0; i < 6; i += 1) burst.push(await submit({ email: email(`ip${i}`), business_name: `${TAG} Ráfaga ${i}` }, { ip: ipX }));
  ok('13. Límite por IP: 6.º envío en 10 min → 429', burst.slice(0, 5).every((r) => r.status === 200) && burst[5].status === 429, burst.map((r) => r.status).join(','));

  // Origen ajeno
  const o1 = await submit({ email: email('origin') }, { origin: 'https://evil.example.com' });
  ok('14. Envío desde otra web (Origin ajeno) → 403', o1.status === 403);

  // «Quiero empezar gratis» → registro iniciado (sin crear cuenta)
  const usersBefore = (await sb.from('profiles').select('id', { count: 'exact', head: true })).count;
  const tenantsBefore = (await sb.from('tenants').select('id', { count: 'exact', head: true })).count;
  const s6 = await submit({ email: email('free'), request_type: 'free', business_name: `${TAG} Centro Gratis` });
  const go = s6.json.signupUrl ? await realFetch(`${APP}${s6.json.signupUrl}`, { redirect: 'manual' }) : null;
  const LF = await leadByEmail(email('free'));
  ok('15. «Empezar gratis» → enlace firmado, redirige al registro actual y marca «registro iniciado»', go?.status === 302 && /\/auth\/signup/.test(go.headers.get('location') || '') && LF?.metadata?.signup_started_at);
  const bad = await realFetch(`${APP}/api/capture/signup?l=${LF.id}&s=${'0'.repeat(32)}`, { redirect: 'manual' });
  const usersAfter = (await sb.from('profiles').select('id', { count: 'exact', head: true })).count;
  const tenantsAfter = (await sb.from('tenants').select('id', { count: 'exact', head: true })).count;
  ok('   Enlace con firma falsa no marca nada; ningún formulario crea usuarios ni negocios', bad.status === 302 && usersAfter === usersBefore && tenantsAfter === tenantsBefore);

  // ---------- Super Admin: protección y configuración ----------
  const anonA = await adminApi(null)('capture/metrics');
  const { data: u } = await sb.auth.admin.createUser({ email: email('tenant'), password: 'Pw-Tenant-12345', email_confirm: true });
  created.users.push(u.user.id);
  const { data: t } = await sb.from('tenants').insert({ slug: `${TAG}-t`, name: `ZZ CAP tenant`, email: email('tenant'), status: 'active', plan_id: 'plan_free', business_hours: {}, vacations: [] }).select('id').single();
  created.tenants.push(t.id);
  await sb.from('profiles').update({ tenant_id: t.id, role: 'tenant_admin' }).eq('id', u.user.id);
  const tn = adminApi(await cookieFor(email('tenant'), 'Pw-Tenant-12345'));
  const tr = await Promise.all([tn('capture/metrics'), tn('capture/channels'), tn('capture/events'), tn('capture/channels', { method: 'POST', body: { channel: 'web', enabled: false } })]);
  ok('16. Configuración de Captación exclusiva de Super Admin (anónimo 401, negocio 403)', anonA.status === 401 && tr.every((r) => r.status === 403), `${anonA.status} / ${tr.map((r) => r.status).join(',')}`);
  const uc = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await uc.auth.signInWithPassword({ email: email('tenant'), password: 'Pw-Tenant-12345' });
  const rr = await uc.from('crm_capture_events').select('id').limit(3);
  const rw = await uc.from('crm_capture_events').insert({ channel: 'web', status: 'processed' });
  ok('   RLS: un negocio no lee ni escribe eventos de captación', (rr.data || []).length === 0 && rw.error);

  const ch = await sa('capture/channels');
  ok('17. Canales: web funcionando; Facebook/Instagram «pendiente de configuración» sin credenciales', ch.status === 200 && ch.json.web.enabled && ch.json.meta.state === 'pending_config' && ch.json.facebook.state === 'pending_config' && ch.json.instagram.state === 'pending_config' && ch.json.meta.missing.length === 4);
  ok('   No expone secretos (solo URL de webhook y token de verificación)', !JSON.stringify(ch.json).match(/appSecret|META_APP_SECRET":"|SERVICE_ROLE|sk_live|sk_test/));
  const off = await sa('capture/channels', { method: 'POST', body: { channel: 'web', enabled: false } });
  const sOff = await submit({ email: email('off') });
  const cfgOff = await (await fetch(`${APP}/api/capture/config`)).json();
  await sa('capture/channels', { method: 'POST', body: { channel: 'web', enabled: true } });
  const sOn = await submit({ email: email('on'), business_name: `${TAG} Reactivado` });
  ok('18. Desactivar la fuente web bloquea envíos (503) y reactivarla los permite', off.status === 200 && sOff.status === 503 && cfgOff.enabled === false && sOn.status === 200, `${off.status} ${JSON.stringify(off.json).slice(0,120)} / ${sOff.status} / ${cfgOff.enabled} / ${sOn.status} ${sOn.json.error||''}`);
  const wt = await sa('capture/web-test', { method: 'POST' });
  ok('19. Prueba de funcionamiento del formulario: correcta y sin crear lead', wt.status === 200 && wt.json.test && !(await leadByEmail('prueba-captacion@example.com')));
  const lg = await sa('capture/legal', { method: 'POST', body: { owner: `${TAG} Titular SL`, nif: 'B12345678', address: 'Calle Prueba 1, Madrid', email: 'reserva360.app@gmail.com' } });
  const priv = await (await realFetch(`${APP}/privacidad`)).text();
  ok('20. Datos legales editables y visibles en /privacidad', lg.status === 200 && priv.includes(`${TAG} Titular SL`) && priv.includes('B12345678'));
  const lgBad = await sa('capture/legal', { method: 'POST', body: { owner: 'x', email: 'no' } });
  ok('   Validación de datos legales', lgBad.status === 400);

  // ---------- Meta: webhook HTTP real (sin credenciales) ----------
  const vt = ch.json.meta.verifyToken;
  const g1 = await realFetch(`${APP}/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(vt)}&hub.challenge=987654`);
  const g2 = await realFetch(`${APP}/api/meta/webhook?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=987654`);
  const p0 = await realFetch(`${APP}/api/meta/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' }, body: '{}' });
  ok('21. Verificación del webhook de Meta (token correcto → challenge; incorrecto → 403)', g1.status === 200 && (await g1.text()) === '987654' && g2.status === 403);
  ok('   Sin credenciales, el webhook rechaza notificaciones (503) y no se muestra como conectado', p0.status === 503);

  // ---------- Meta: procesamiento (secreto de prueba + Graph simulado en este proceso) ----------
  Object.assign(process.env, { META_APP_ID: '123', META_APP_SECRET: META_SECRET, META_PAGE_ID: PAGE, META_PAGE_ACCESS_TOKEN: 'EAAtest' });
  const id1 = `77${rnd()}`; const emM = email('meta1'); const phM = `+346${rnd()}`;
  addMetaLead(id1, { em: emM, ph: phM, wa: true });
  const raw1 = metaPayload(id1);
  const badSig = await handleMetaWebhook(sb, raw1, sign(raw1, 'otro_secreto'));
  const noSig = await handleMetaWebhook(sb, raw1, null);
  ok('22. Firma X-Hub-Signature-256 inválida o ausente → 401 y no se procesa', badSig.status === 401 && noSig.status === 401 && !(await leadByEmail(emM)));
  const w1 = await handleMetaWebhook(sb, raw1, sign(raw1));
  const LM = await leadByEmail(emM);
  ok('23. Webhook de Meta válido → lead en el CRM como Facebook Lead Ads', w1.status === 200 && LM?.source === 'facebook_lead_ads' && LM?.external_source_id === id1 && LM?.city === 'Sevilla');
  const { data: evM } = await sb.from('crm_capture_events').select('*').eq('channel', 'meta').eq('external_id', id1).maybeSingle();
  ok('   Página, formulario, campaña, conjunto y anuncio registrados', evM?.status === 'processed' && evM.form_name === 'Formulario Captación ZZ' && evM.campaign_name === `${TAG} Campaña Otoño` && evM.adset_name === 'Conjunto A' && evM.ad_name === 'Anuncio A' && evM.platform === 'fb' && evM.page_id === PAGE);
  ok('   Solicitud y consentimiento de la casilla de Meta (WhatsApp) mapeados', LM?.metadata?.last_capture?.request_type === 'demo' && LM?.comm_whatsapp === true && LM?.comm_email === false);
  const am = await acts(LM.id);
  ok('   Actividad automática con canal y formulario de origen', am.some((a) => a.type === 'capture' && /Facebook Lead Ads/.test(a.description) && /Formulario Captación ZZ/.test(a.description)));
  const w1b = await handleMetaWebhook(sb, raw1, sign(raw1));
  const w1c = await handleMetaWebhook(sb, raw1, sign(raw1));
  const { count: cM } = await sb.from('crm_leads').select('id', { count: 'exact', head: true }).eq('email', emM);
  const { count: eM } = await sb.from('crm_capture_events').select('id', { count: 'exact', head: true }).eq('channel', 'meta').eq('external_id', id1);
  ok('24. Notificación repetida (x3) → idempotente: 1 lead, 1 evento, 1 actividad', w1b.status === 200 && w1c.status === 200 && cM === 1 && eM === 1 && (await acts(LM.id)).filter((a) => a.type === 'capture').length === 1);

  const id2 = `78${rnd()}`; const emI = email('meta-ig');
  addMetaLead(id2, { platform: 'ig', em: emI, ph: `+346${rnd()}` });
  const raw2 = metaPayload(id2);
  await handleMetaWebhook(sb, raw2, sign(raw2));
  const LI = await leadByEmail(emI);
  ok('25. Lead de Instagram → fuente Instagram Lead Ads', LI?.source === 'instagram_lead_ads' && /Instagram/.test(LI?.source_detail || ''));

  // Mismo email que un lead web → se añade al existente (nueva fuente registrada como actividad)
  const id3 = `79${rnd()}`;
  addMetaLead(id3, { em: email('b'), ph: `+346${rnd()}` });
  metaLeads.get(id3).field_data[0].values = ['Carmen Prueba']; metaLeads.get(id3).field_data[3].values = [`${TAG} Estética Sur`];
  const raw3 = metaPayload(id3);
  await handleMetaWebhook(sb, raw3, sign(raw3));
  const { count: cB } = await sb.from('crm_leads').select('id', { count: 'exact', head: true }).eq('email', email('b'));
  const aB = (await acts(L2.id)).filter((a) => a.type === 'capture');
  ok('26. Mismo contacto por otro canal → sin duplicado, nueva actividad con la nueva fuente', cB === 1 && aB.length === 2 && aB.some((a) => /Facebook Lead Ads/.test(a.description)));

  // Errores de conexión con Meta + reintento
  const id4 = `80${rnd()}`; const emE = email('meta-err');
  addMetaLead(id4, { em: emE, ph: `+346${rnd()}` });
  graphMode = 'down';
  const raw4 = metaPayload(id4);
  const w4 = await handleMetaWebhook(sb, raw4, sign(raw4));
  const { data: evE } = await sb.from('crm_capture_events').select('*').eq('channel', 'meta').eq('external_id', id4).maybeSingle();
  ok('27. Error de conexión con Meta → 200 a Meta, evento «error» guardado sin datos personales', w4.status === 200 && evE?.status === 'failed' && evE.attempts === 1 && /No se ha podido conectar/.test(evE.error) && !(await leadByEmail(emE)));
  graphMode = 'error';
  await retryFailedMetaEvents(sb, { eventId: evE.id });
  const { data: evE2 } = await sb.from('crm_capture_events').select('status, attempts, error').eq('id', evE.id).single();
  graphMode = 'ok';
  await retryFailedMetaEvents(sb, { eventId: evE.id });
  const { data: evE3 } = await sb.from('crm_capture_events').select('status, attempts, lead_id').eq('id', evE.id).single();
  ok('   Reintento: error de Meta (HTTP 500) contabilizado y después procesado correctamente', evE2.status === 'failed' && evE2.attempts === 2 && /Error de Meta/.test(evE2.error) && evE3.status === 'processed' && evE3.attempts === 3 && evE3.lead_id);

  // Canal Instagram desactivado → ignorado
  await sa('capture/channels', { method: 'POST', body: { channel: 'instagram', enabled: false } });
  const id5 = `81${rnd()}`; const emO = email('meta-off');
  addMetaLead(id5, { platform: 'ig', em: emO, ph: `+346${rnd()}` });
  const raw5 = metaPayload(id5);
  await handleMetaWebhook(sb, raw5, sign(raw5));
  await sa('capture/channels', { method: 'POST', body: { channel: 'instagram', enabled: true } });
  const { data: evO } = await sb.from('crm_capture_events').select('status').eq('channel', 'meta').eq('external_id', id5).maybeSingle();
  ok('28. Fuente Instagram desactivada → el lead se ignora (no entra en el CRM)', evO?.status === 'ignored' && !(await leadByEmail(emO)));

  // Página distinta
  const id6 = `82${rnd()}`;
  addMetaLead(id6, { em: email('otra-pagina'), ph: `+346${rnd()}` });
  const raw6 = metaPayload(id6).replaceAll(PAGE, '1112223334445');
  await handleMetaWebhook(sb, raw6, sign(raw6));
  ok('   Notificación de otra Página → ignorada', !(await leadByEmail(email('otra-pagina'))));

  // ---------- Métricas y filtros ----------
  const m = await sa('capture/metrics');
  const mFb = await sa('capture/metrics?channel=facebook');
  const today = new Date().toISOString().slice(0, 10);
  const mRange = await sa(`capture/metrics?from=${today}&to=${today}&channel=web`);
  const mPast = await sa('capture/metrics?from=2020-01-01&to=2020-01-31');
  const webExpected = (await sb.from('crm_capture_events').select('id', { count: 'exact', head: true }).eq('source', 'web_form').in('status', ['processed', 'review']).eq('is_test', false)).count;
  ok('29. Métricas reales: hoy/semana/mes, por canal, demos, campañas, registro iniciado', m.status === 200 && m.json.today >= 12 && m.json.week >= m.json.today && m.json.month >= m.json.today && m.json.bySource.web_form === webExpected && m.json.bySource.facebook_lead_ads >= 3 && m.json.bySource.instagram_lead_ads >= 1 && m.json.demoRequests >= 4 && m.json.signupStarted >= 1 && m.json.campaigns.some((c) => c.campaign_name === `${TAG} Campaña Otoño`), JSON.stringify({ today: m.json.today, src: m.json.bySource, demo: m.json.demoRequests }));
  ok('   Filtro por canal y por fechas', mFb.json.bySource.web_form === 0 && mFb.json.bySource.facebook_lead_ads >= 3 && mRange.json.bySource.facebook_lead_ads === 0 && mRange.json.received === webExpected && mPast.json.received === 0);
  const evs = await sa('capture/events?channel=meta&status=processed');
  ok('   Registro de eventos con filtros', evs.status === 200 && evs.json.rows.length >= 3 && evs.json.rows.every((e) => e.status === 'processed' && e.channel === 'meta'));
  const rv = await sa('capture/review');
  const rvRow = (rv.json.rows || []).find((r) => r.lead_id === L2.id);
  const res1 = rvRow ? await sa(`capture/review/${rvRow.id}/resolve`, { method: 'POST', body: { decision: 'different_people' } }) : { status: 0 };
  const res2 = rvRow ? await sa(`capture/review/${rvRow.id}/resolve`, { method: 'POST', body: { decision: 'same_person' } }) : { status: 0 };
  ok('30. Revisión manual de coincidencias (resolver una vez; segunda vez → 409)', rvRow && rvRow.matches.some((x) => x.id === L1.id) && res1.status === 200 && res2.status === 409);

  // ---------- Regresión ----------
  const crmStats = await sa('crm/stats');
  const crmPipe = await sa('crm/leads?pageSize=5');
  const fAdmin = await sa('founders');
  const book = await realFetch(`${APP}/book/fisiovital`);
  const home = await realFetch(`${APP}/`);
  const homeHtml = await home.text();
  const cron = await realFetch(`${APP}/api/cron/capture-retry`, { method: 'POST' });
  ok('31. Regresión: CRM fase 2, Fundadores, reservas públicas y home siguen funcionando', crmStats.status === 200 && crmPipe.status === 200 && fAdmin.status === 200 && book.status === 200 && home.status === 200 && homeHtml.includes('id="contacto"'), `${crmStats.status},${crmPipe.status},${fAdmin.status},${book.status},${home.status}`);
  ok('   Tarea de reintentos protegida (sin secreto → 401)', cron.status === 401);
  const crmLead = await sa(`crm/leads/${L1.id}`);
  ok('   Ficha del lead en el CRM muestra las actividades de captación', crmLead.status === 200 && JSON.stringify(crmLead.json).includes('Lead recibido por Formulario web'));

  return settingsBefore;
}

async function cleanup(settingsBefore) {
  const { data: leads } = await sb.from('crm_leads').select('id').or(`email.ilike.${TAG}%,business_name.ilike.${TAG}%`);
  const ids = (leads || []).map((l) => l.id);
  if (ids.length) await sb.from('crm_leads').delete().in('id', ids);
  await sb.from('crm_capture_events').delete().gte('received_at', new Date(Date.parse(START) - 3600 * 1000).toISOString()).is('lead_id', null);
  await sb.from('crm_capture_events').delete().gte('updated_at', START);
  await sb.from('activity_log').delete().like('action', 'crm.%').gte('created_at', START);
  for (const id of created.tenants) await sb.from('tenants').delete().eq('id', id);
  for (const id of created.users) await sb.auth.admin.deleteUser(id);
  for (const key of ['capture_channels', 'legal_info', 'meta_status']) {
    if (settingsBefore && key in settingsBefore) await sb.from('platform_settings').upsert({ key, value: settingsBefore[key] }, { onConflict: 'key' });
    else await sb.from('platform_settings').delete().eq('key', key);
  }
  const { count: left } = await sb.from('crm_leads').select('id', { count: 'exact', head: true }).or(`email.ilike.${TAG}%,business_name.ilike.${TAG}%`);
  const { count: evLeft } = await sb.from('crm_capture_events').select('id', { count: 'exact', head: true });
  console.log(`LIMPIEZA: leads de prueba restantes=${left} · eventos restantes=${evLeft}`);
}

let before = null;
try { before = await main(); } catch (e) { console.error('ERROR', e); results.push({ name: 'excepción', pass: false }); }
finally {
  try { await cleanup(before); } catch (e) { console.error('ERROR limpieza', e); }
  const passed = results.filter((r) => r.pass).length;
  console.log(`RESULTADO ${passed}/${results.length}`);
}

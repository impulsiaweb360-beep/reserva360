// Meta (Facebook + Instagram) Lead Ads — API oficial Graph (sin SDK). Las credenciales viven solo en el servidor.
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { CRM_SECTORS } from '@/lib/crm/constants';
import { EMPLOYEE_RANGES, employeesFromRange } from '@/lib/crm/consent';
import { recordEvent, upsertLeadFromCapture, getChannels, getSettingValue, setSettingValue } from '@/lib/crm/capture';

export const REQUIRED_SCOPES = ['leads_retrieval', 'pages_manage_metadata', 'pages_show_list', 'pages_read_engagement', 'pages_manage_ads'];
export const OPTIONAL_SCOPES = ['ads_management', 'ads_read', 'business_management'];
const MAX_ATTEMPTS = 6;

export function metaConfig() {
  const cfg = {
    version: process.env.META_GRAPH_VERSION || 'v27.0',
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    pageId: process.env.META_PAGE_ID || '',
    pageToken: process.env.META_PAGE_ACCESS_TOKEN || '',
  };
  const missing = [['META_APP_ID', cfg.appId], ['META_APP_SECRET', cfg.appSecret], ['META_PAGE_ID', cfg.pageId], ['META_PAGE_ACCESS_TOKEN', cfg.pageToken]]
    .filter(([, v]) => !v).map(([k]) => k);
  return { ...cfg, missing, configured: missing.length === 0 };
}

// Token de verificación del webhook: variable de entorno o, si no existe, uno aleatorio generado y guardado en el servidor
export async function getVerifyToken(admin) {
  if (process.env.META_WEBHOOK_VERIFY_TOKEN) return process.env.META_WEBHOOK_VERIFY_TOKEN;
  let v = await getSettingValue(admin, 'meta_verify_token');
  if (!v?.value) { v = { value: `r360_${randomBytes(18).toString('hex')}` }; await setSettingValue(admin, 'meta_verify_token', v); }
  return v.value;
}

export function verifyMetaSignature(raw, header, secret) {
  if (!secret || !header || !header.startsWith('sha256=')) return false;
  let received;
  try { received = Buffer.from(header.slice(7), 'hex'); } catch { return false; }
  const expected = createHmac('sha256', secret).update(Buffer.from(raw, 'utf8')).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Traducción de errores de Graph a mensajes claros (sin incluir tokens)
function describeGraphError(err, status) {
  const code = err?.code;
  if (code === 190) return 'El token de la Página ha caducado o se ha revocado (error 190). Genera uno nuevo de larga duración.';
  if (code === 10 || code === 200 || (code >= 200 && code < 300)) return `Faltan permisos en la app de Meta (error ${code}): ${err?.message || ''}`.trim();
  if ([4, 17, 32, 613, 80001].includes(code)) return `Meta ha limitado temporalmente las peticiones (error ${code}). Se reintentará más tarde.`;
  if (code === 100) return `Petición rechazada por Meta (error 100): ${err?.message || 'parámetro no válido'}`;
  return `Error de Meta${code ? ` ${code}` : ''}${status ? ` (HTTP ${status})` : ''}: ${err?.message || 'sin detalle'}`;
}
export class MetaError extends Error {
  constructor(message, { code = null, status = null, retryable = true } = {}) { super(message); this.code = code; this.status = status; this.retryable = retryable; }
}

export async function graph(path, { params = {}, method = 'GET', token, cfg = metaConfig(), timeoutMs = 10000 } = {}) {
  const url = new URL(`https://graph.facebook.com/${cfg.version}/${path.replace(/^\//, '')}`);
  const body = new URLSearchParams();
  const target = method === 'GET' ? url.searchParams : body;
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) target.set(k, String(v));
  if (token) target.set('access_token', token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r;
  try {
    r = await fetch(url, { method, body: method === 'GET' ? undefined : body, cache: 'no-store', signal: ctrl.signal });
  } catch (e) {
    throw new MetaError(e?.name === 'AbortError' ? 'Meta no ha respondido a tiempo (timeout). Se reintentará.' : 'No se ha podido conectar con Meta. Se reintentará.', { retryable: true });
  } finally { clearTimeout(timer); }
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json?.error) {
    const err = json?.error || {};
    throw new MetaError(describeGraphError(err, r.status), { code: err.code ?? null, status: r.status, retryable: ![190, 10, 12, 100, 200].includes(err.code) });
  }
  return json;
}

// ------------------------------------------------------------- estado / comprobación de conexión
export async function getMetaStatus(admin) { return (await getSettingValue(admin, 'meta_status')) || {}; }
async function patchMetaStatus(admin, patch) {
  try {
    const cur = await getMetaStatus(admin);
    await setSettingValue(admin, 'meta_status', { ...cur, ...patch });
  } catch (e) {
    // Solo informativo para el panel: no debe tumbar el webhook, pero queda en el log
    metaLog({ stage: 'status_write_error', error: String(e?.message || e).slice(0, 200) });
  }
}

// ------------------------------------------------------------- logs de diagnóstico seguros
// Una línea JSON por suceso. NUNCA incluir tokens, secretos, cuerpo del lead ni datos personales.
export function metaLog(obj) {
  try { console.log(JSON.stringify({ tag: 'meta_webhook', at: new Date().toISOString(), ...obj })); } catch { /* sin log */ }
}
// Ids de Meta parcialmente ocultos (no son datos personales, pero se acortan igualmente)
export const maskId = (v) => { const s = String(v || ''); return s ? (s.length > 4 ? `…${s.slice(-4)}` : s) : null; };

// Actualización estricta del evento: si Supabase falla se lanza el error (→ HTTP 500 → Meta reintenta)
async function updateEventStrict(admin, id, patch) {
  const { error } = await admin.from('crm_capture_events').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`No se pudo guardar el evento de Meta en Supabase: ${error.message}`);
}

// Payload de ejemplo del botón «Test» de Meta Developers: todos los ids son «4» repetidos (444444444444)
export function isMetaSamplePayload(v = {}) {
  const ids = [v.leadgen_id, v.page_id, v.form_id].filter(Boolean).map(String);
  return ids.length > 0 && ids.every((x) => /^4+$/.test(x));
}

export async function testMetaConnection(admin) {
  const cfg = metaConfig();
  const checkedAt = new Date().toISOString();
  if (!cfg.configured) {
    const st = { ok: false, connected: false, checked_at: checkedAt, error: `Faltan credenciales: ${cfg.missing.join(', ')}` };
    await patchMetaStatus(admin, st);
    return st;
  }
  const out = { checked_at: checkedAt, ok: false, connected: false, page: null, instagram: null, scopes: [], missing_scopes: [], token_expires_at: null, subscribed: false, forms: [], forms_error: null, error: null };
  try {
    const dbg = await graph('debug_token', { params: { input_token: cfg.pageToken }, token: `${cfg.appId}|${cfg.appSecret}`, cfg });
    const d = dbg?.data || {};
    out.token_valid = Boolean(d.is_valid);
    out.token_type = d.type || null;
    out.scopes = d.scopes || [];
    out.missing_scopes = REQUIRED_SCOPES.filter((s) => !out.scopes.includes(s));
    out.token_expires_at = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null; // 0 = no caduca
    if (String(d.app_id || '') !== String(cfg.appId)) throw new MetaError('El token no pertenece a la app de Meta configurada (META_APP_ID).', { retryable: false });
    if (!d.is_valid) throw new MetaError('El token de la Página no es válido o ha caducado.', { retryable: false });
    if (d.type && d.type !== 'PAGE') throw new MetaError(`El token configurado es de tipo ${d.type}; debe ser un token de Página.`, { retryable: false });

    const page = await graph(cfg.pageId, { params: { fields: 'id,name,instagram_business_account{id,username}' }, token: cfg.pageToken, cfg });
    out.page = { id: page.id, name: page.name };
    out.instagram = page.instagram_business_account ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username || null } : null;

    const subs = await graph(`${cfg.pageId}/subscribed_apps`, { token: cfg.pageToken, cfg });
    const mine = (subs?.data || []).find((a) => String(a.id) === String(cfg.appId));
    out.subscribed = Boolean(mine && (mine.subscribed_fields || []).includes('leadgen'));

    try {
      const forms = await graph(`${cfg.pageId}/leadgen_forms`, { params: { fields: 'id,name,status,locale,created_time', limit: 50 }, token: cfg.pageToken, cfg });
      out.forms = (forms?.data || []).map((f) => ({ id: f.id, name: f.name, status: f.status, locale: f.locale || null, created_time: f.created_time || null }));
    } catch (e) {
      out.forms_error = `${e.message} Los formularios se registrarán igualmente a medida que lleguen leads (form_id del webhook).`;
    }
    out.ok = true;
    out.connected = out.token_valid && out.missing_scopes.length === 0 && out.subscribed;
    if (!out.subscribed) out.error = 'La Página todavía no está suscrita al evento «leadgen» de la app. Pulsa «Suscribir Página».';
    else if (out.missing_scopes.length) out.error = `Faltan permisos: ${out.missing_scopes.join(', ')}`;
  } catch (e) {
    out.error = e.message;
  }
  await patchMetaStatus(admin, out);
  return out;
}

export async function subscribeMetaPage(admin) {
  const cfg = metaConfig();
  if (!cfg.configured) throw new MetaError(`Faltan credenciales: ${cfg.missing.join(', ')}`, { retryable: false });
  await graph(`${cfg.pageId}/subscribed_apps`, { method: 'POST', params: { subscribed_fields: 'leadgen' }, token: cfg.pageToken, cfg });
  return testMetaConnection(admin);
}

// ------------------------------------------------------------- mapeo de datos del formulario instantáneo
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function matchSector(v) {
  if (!v) return null;
  const n = norm(v);
  return CRM_SECTORS.find((s) => norm(s) === n || n.includes(norm(s)) || norm(s).includes(n)) || 'Otro';
}
function matchRequest(v) {
  const n = norm(v);
  if (!n) return 'info';
  if (n.includes('demo')) return 'demo';
  if (n.includes('plan') || n.includes('precio') || n.includes('pro')) return 'plans';
  if (n.includes('gratis') || n.includes('free') || n.includes('empezar') || n.includes('probar')) return 'free';
  return 'info';
}
function matchEmployees(v) {
  if (!v) return { range: null, n: null };
  const direct = EMPLOYEE_RANGES.find((r) => norm(r) === norm(v));
  if (direct) return { range: direct, n: employeesFromRange(direct) };
  const num = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return { range: String(v).slice(0, 40), n: Number.isFinite(num) && num > 0 && num < 10000 ? num : null };
}

export function mapMetaLead(lead) {
  const fields = {};
  for (const f of lead.field_data || []) fields[norm(f.name)] = Array.isArray(f.values) ? f.values.join(', ') : String(f.values ?? '');
  const pick = (...keys) => { for (const k of keys) { const hit = Object.keys(fields).find((x) => x === k || x.includes(k)); if (hit && fields[hit]) return fields[hit].trim(); } return null; };
  let first = pick('first_name', 'nombre');
  let last = pick('last_name', 'apellido');
  const full = pick('full_name', 'nombre_completo');
  if (!first && full) { const parts = full.split(/\s+/); first = parts.shift(); last = last || parts.join(' ') || null; }
  const emp = matchEmployees(pick('emplead', 'employees', 'team_size'));
  const problem = pick('problema', 'problem', 'necesidad');
  const interest = pick('interes', 'interest');
  const consents = { privacy: true, email: false, whatsapp: false, version: `meta-form-${lead.form_id || 'desconocido'}`, texts: {} };
  for (const d of lead.custom_disclaimer_responses || []) {
    const key = norm(d.checkbox_key);
    const checked = String(d.is_checked) === '1' || d.is_checked === true;
    if (key.includes('whatsapp')) { consents.whatsapp = checked; consents.texts.whatsapp = `Casilla «${d.checkbox_key}» del formulario de Meta`; }
    else if (key.includes('email') || key.includes('correo') || key.includes('marketing') || key.includes('comercial')) { consents.email = checked; consents.texts.email = `Casilla «${d.checkbox_key}» del formulario de Meta`; }
  }
  consents.texts.privacy = 'Política de privacidad aceptada en el formulario instantáneo de Meta';
  return {
    fields: {
      first_name: first ? first.slice(0, 80) : null,
      last_name: last ? last.slice(0, 120) : null,
      business_name: (pick('company_name', 'empresa', 'negocio_nombre', 'nombre_del_negocio', 'business_name') || full || first || 'Lead de Meta').slice(0, 160),
      email: pick('email', 'correo'),
      phone: (pick('phone_number', 'telefono', 'phone') || '').replace(/[^0-9+]/g, '').slice(0, 20) || null,
      city: pick('city', 'ciudad'),
      province: pick('province', 'provincia', 'state'),
      sector: matchSector(pick('tipo_de_negocio', 'sector', 'business_type', 'actividad')),
      employees_estimate: emp.n,
      needs: [problem && `Problema: ${problem}`, interest && `Le interesa: ${interest}`].filter(Boolean).join('\n') || null,
    },
    requestType: matchRequest(pick('solicitud', 'request', 'que_necesitas')),
    details: { employees_range: emp.range, current_system: pick('sistema', 'current_system', 'reservas_actual'), problem, interest, meta_fields: Object.keys(fields) },
    consents,
  };
}

// ------------------------------------------------------------- procesamiento de un evento (idempotente)
async function formName(admin, formId, cfg) {
  if (!formId) return null;
  const st = await getMetaStatus(admin);
  const known = (st.forms || []).find((f) => String(f.id) === String(formId));
  if (known?.name) return known.name;
  try { const f = await graph(formId, { params: { fields: 'name' }, token: cfg.pageToken, cfg }); return f?.name || null; } catch { return null; }
}

export async function processMetaEvent(admin, ev) {
  const cfg = metaConfig();
  const attempts = (ev.attempts || 0) + 1;
  if (!cfg.configured) { await updateEventStrict(admin, ev.id, { status: 'failed', attempts, error: `Faltan credenciales de Meta: ${cfg.missing.join(', ')}` }); return { status: 'failed' }; }
  if (cfg.pageId && ev.page_id && String(ev.page_id) !== String(cfg.pageId)) {
    await updateEventStrict(admin, ev.id, { status: 'ignored', attempts, error: 'Página distinta de la configurada', processed_at: new Date().toISOString() });
    return { status: 'ignored' };
  }
  try {
    const lead = await graph(ev.external_id, {
      params: { fields: 'created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic,page_id,custom_disclaimer_responses' },
      token: cfg.pageToken, cfg,
    });
    const platform = lead.platform === 'ig' ? 'ig' : 'fb';
    const source = platform === 'ig' ? 'instagram_lead_ads' : 'facebook_lead_ads';
    const channels = await getChannels(admin);
    const fname = await formName(admin, lead.form_id || ev.form_id, cfg);
    const campaign = {
      campaign_id: lead.campaign_id || null, campaign_name: lead.campaign_name || null, adset_id: lead.adset_id || null,
      adset_name: lead.adset_name || null, ad_id: lead.ad_id || null, ad_name: lead.ad_name || null, is_organic: lead.is_organic ?? null,
    };
    const base = { source, platform, form_id: lead.form_id || ev.form_id || null, form_name: fname, page_id: lead.page_id || ev.page_id || null, ...campaign, attempts };
    if (!channels[platform === 'ig' ? 'instagram' : 'facebook'].enabled) {
      await updateEventStrict(admin, ev.id, { ...base, status: 'ignored', error: `Canal ${platform === 'ig' ? 'Instagram' : 'Facebook'} desactivado en Captación`, processed_at: new Date().toISOString() });
      return { status: 'ignored' };
    }
    const m = mapMetaLead(lead);
    const originLabel = `${platform === 'ig' ? 'Instagram' : 'Facebook'} · ${fname || `formulario ${base.form_id || '?'}`}${campaign.campaign_name ? ` · ${campaign.campaign_name}` : ''}`;
    const res = await upsertLeadFromCapture(admin, {
      source, originLabel: originLabel.slice(0, 300), externalId: ev.external_id, eventId: ev.id,
      receivedAt: lead.created_time ? new Date(lead.created_time).toISOString() : ev.received_at,
      requestType: m.requestType, fields: m.fields, details: { ...m.details, form_id: base.form_id, platform }, consents: m.consents, campaign,
    });
    await updateEventStrict(admin, ev.id, { ...base, status: res.outcome === 'review' ? 'review' : 'processed', lead_id: res.leadId, review_reason: res.reason, request_type: m.requestType, error: null, processed_at: new Date().toISOString() });
    await patchMetaStatus(admin, { last_lead_at: new Date().toISOString(), last_sync_at: new Date().toISOString() });
    return { status: res.outcome, leadId: res.leadId };
  } catch (e) {
    const giveUp = attempts >= MAX_ATTEMPTS || (e instanceof MetaError && e.retryable === false && attempts >= 2);
    // Reintentable: fallos de red, timeouts, límites de Meta y errores de Supabase. No reintentable: token/permisos/parámetros.
    const retryable = !(e instanceof MetaError && e.retryable === false) && !giveUp;
    await updateEventStrict(admin, ev.id, { status: 'failed', attempts, error: `${String(e?.message || e).slice(0, 280)}${giveUp ? ' · Sin más reintentos automáticos' : ''}` });
    await patchMetaStatus(admin, { last_error: String(e?.message || e).slice(0, 280), last_error_at: new Date().toISOString() });
    return { status: 'failed', error: String(e?.message || e).slice(0, 200), code: e?.code ?? null, retryable, attempts };
  }
}

// Webhook: verifica firma, distingue pruebas de leads reales, registra cada leadgen una sola vez y lo procesa.
// Códigos: 200 solo si todo quedó guardado en Supabase · 500 si falló Supabase o Meta con error reintentable
// (Meta reenvía el aviso y el reenvío reprocesa el evento fallido) · 401/400/503 en errores de petición/configuración.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INLINE_RETRY_DELAY_MS = 1500;

async function processWithInlineRetry(admin, id, log) {
  const load = async () => {
    const { data, error } = await admin.from('crm_capture_events').select('*').eq('id', id).single();
    if (error) throw new Error(`No se pudo leer el evento de Meta en Supabase: ${error.message}`);
    return data;
  };
  let res = await processMetaEvent(admin, await load());
  if (res.status === 'failed' && res.retryable) {
    log({ stage: 'fetch_retry', attempt: res.attempts, error: res.error, code: res.code });
    await sleep(INLINE_RETRY_DELAY_MS);
    res = await processMetaEvent(admin, await load());
  }
  return res;
}

export async function handleMetaWebhook(admin, raw, signature, { requestId = null } = {}) {
  const t0 = Date.now();
  const log = (o) => metaLog({ req: requestId, ...o });
  const cfg = metaConfig();
  const sigState = !signature ? 'missing' : !signature.startsWith('sha256=') ? 'malformed' : null;
  if (!cfg.appSecret) {
    log({ stage: 'rejected', http: 503, reason: 'META_APP_SECRET no configurado' });
    return { status: 503, body: { error: 'Meta no configurado' } };
  }
  if (!verifyMetaSignature(raw, signature, cfg.appSecret)) {
    log({ stage: 'rejected', http: 401, signature: sigState || 'invalid', bytes: raw.length });
    return { status: 401, body: { error: 'Firma no válida' } };
  }
  let payload;
  try { payload = JSON.parse(raw); } catch {
    log({ stage: 'rejected', http: 400, signature: 'valid', reason: 'JSON no válido' });
    return { status: 400, body: { error: 'JSON no válido' } };
  }
  const changes = (payload?.entry || []).flatMap((e) => (e.changes || []).map((c) => ({ entry: e, change: c })));
  log({ stage: 'received', signature: 'valid', object: payload?.object || null, entries: (payload?.entry || []).length, changes: changes.length, fields: [...new Set(changes.map((x) => x.change?.field))] });
  await patchMetaStatus(admin, { last_webhook_at: new Date().toISOString() });
  if (payload?.object !== 'page') {
    log({ stage: 'done', http: 200, ignored: 'object distinto de page', ms: Date.now() - t0 });
    return { status: 200, body: { ok: true, ignored: true } };
  }

  const summary = { received: 0, processed: 0, review: 0, duplicates: 0, tests: 0, ignored: 0, failed: 0 };
  let mustRetry = false; // algún fallo reintentable → 500 para que Meta reenvíe el aviso
  for (const { entry, change } of changes) {
    if (change.field !== 'leadgen') { summary.ignored++; log({ stage: 'skip', field: change.field || null }); continue; }
    const v = change.value || {};
    const leadgenId = String(v.leadgen_id || '').replace(/[^0-9]/g, '');
    const pageId = String(v.page_id || entry.id || '') || null;
    if (!leadgenId) { summary.ignored++; log({ stage: 'skip', reason: 'leadgen sin leadgen_id' }); continue; }
    summary.received++;
    const meta = { leadgen: maskId(leadgenId), page: maskId(pageId), form: maskId(v.form_id) };

    // 1) Evento de prueba de Meta Developers: se guarda SIEMPRE como evento nuevo y visible, sin llamar a Graph ni crear leads
    if (isMetaSamplePayload(v)) {
      const ev = await recordEvent(admin, {
        channel: 'meta', status: 'test', external_id: null, idempotency_key: null,
        form_id: v.form_id ? String(v.form_id) : null, page_id: pageId,
        received_at: new Date().toISOString(), processed_at: new Date().toISOString(),
        error: 'Evento de prueba de Meta Developers (payload de ejemplo): no se descarga ni crea lead',
        payload: { test: true, sample: true, entry_time: entry.time || null, created_time: v.created_time || null },
      });
      summary.tests++;
      log({ stage: 'test_event', ...meta, event: ev.id || null, result: 'stored_as_test' });
      continue;
    }

    // 2) Lead real: una sola fila por leadgen_id (idempotencia)
    const ev = await recordEvent(admin, {
      channel: 'meta', external_id: leadgenId, idempotency_key: `meta:${leadgenId}`, status: 'received',
      form_id: v.form_id ? String(v.form_id) : null, page_id: pageId,
      ad_id: v.ad_id ? String(v.ad_id) : null, adset_id: v.adgroup_id ? String(v.adgroup_id) : null,
      received_at: v.created_time ? new Date(Number(v.created_time) * 1000).toISOString() : new Date().toISOString(),
      payload: { created_time: v.created_time || null, form_id: v.form_id || null, page_id: v.page_id || null, deliveries: 1 },
    });

    let eventId = ev.id;
    if (ev.duplicate) {
      // Reenvío del mismo lead: no se duplica, pero queda contado y visible
      const { data: prev, error: pErr } = await admin.from('crm_capture_events').select('id,status,attempts,payload').eq('channel', 'meta').eq('external_id', leadgenId).maybeSingle();
      if (pErr || !prev) throw new Error(`No se pudo leer el evento duplicado de Meta: ${pErr?.message || 'no encontrado'}`);
      const p = prev.payload || {};
      const { error: uErr } = await admin.from('crm_capture_events').update({ payload: { ...p, deliveries: (p.deliveries || 1) + 1, last_redelivery_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq('id', prev.id);
      if (uErr) throw new Error(`No se pudo registrar el reenvío de Meta: ${uErr.message}`);
      summary.duplicates++;
      // Si el evento anterior había fallado, el reenvío de Meta sirve como reintento
      if (['failed', 'received'].includes(prev.status) && (prev.attempts || 0) < MAX_ATTEMPTS) {
        log({ stage: 'duplicate', ...meta, previous: prev.status, action: 'reprocess' });
        eventId = prev.id;
      } else {
        log({ stage: 'duplicate', ...meta, previous: prev.status, action: 'none', deliveries: (p.deliveries || 1) + 1 });
        continue;
      }
    } else {
      log({ stage: 'stored', ...meta, event: eventId });
    }

    const res = await processWithInlineRetry(admin, eventId, (o) => log({ ...meta, ...o }));
    if (res.status === 'failed') {
      summary.failed++;
      if (res.retryable) mustRetry = true;
      log({ stage: 'processed', ...meta, result: 'failed', retryable: Boolean(res.retryable), code: res.code ?? null, error: res.error });
    } else if (res.status === 'ignored') {
      summary.ignored++;
      log({ stage: 'processed', ...meta, result: 'ignored' });
    } else {
      if (res.status === 'review') summary.review++; else summary.processed++;
      log({ stage: 'processed', ...meta, result: res.status, lead: res.leadId ? 'ok' : null });
    }
  }
  const http = mustRetry ? 500 : 200;
  log({ stage: 'done', http, ...summary, ms: Date.now() - t0 });
  if (mustRetry) return { status: 500, body: { ok: false, error: 'Fallo temporal al procesar el lead; Meta reintentará el envío', ...summary } };
  return { status: 200, body: { ok: true, ...summary } };
}

export async function retryFailedMetaEvents(admin, { limit = 20, eventId = null } = {}) {
  let q = admin.from('crm_capture_events').select('*').eq('channel', 'meta');
  if (eventId) q = q.eq('id', eventId).in('status', ['failed', 'received']);
  else q = q.in('status', ['failed', 'received']).lt('attempts', MAX_ATTEMPTS).lt('updated_at', new Date(Date.now() - 60000).toISOString()).order('received_at', { ascending: true }).limit(limit);
  const { data } = await q;
  const out = [];
  for (const ev of data || []) out.push({ id: ev.id, ...(await processMetaEvent(admin, ev)) });
  return out;
}

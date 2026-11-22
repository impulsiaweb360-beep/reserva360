// Panel Super Admin · Growth Engine → Captación (métricas, canales, eventos, revisión, datos legales)
import { createHmac } from 'crypto';
import { z } from 'zod';
import { CrmError, audit } from '@/lib/crm/server';
import { getChannels, getSettingValue, setSettingValue, getLegalInfo, CHANNEL_LABEL, processWebSubmission } from '@/lib/crm/capture';
import { metaConfig, getMetaStatus, getVerifyToken, REQUIRED_SCOPES, OPTIONAL_SCOPES } from '@/lib/crm/meta';
import { turnstileConfigured } from '@/lib/crm/turnstile';
import { absoluteUrl } from '@/lib/site';
import { requestLabel } from '@/lib/crm/consent';

const CAPTURE_SOURCES = ['web_form', 'facebook_lead_ads', 'instagram_lead_ads'];
const REAL_STATUSES = ['processed', 'review'];
const CH_TO_SOURCE = { web: 'web_form', facebook: 'facebook_lead_ads', instagram: 'instagram_lead_ads' };

// Inicio del día/semana/mes en hora de Madrid (en UTC ISO)
function madridStart(unit) {
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now).map((p) => [p.type, p.value]));
  let y = +parts.year; let m = +parts.month; let d = +parts.day;
  if (unit === 'month') d = 1;
  if (unit === 'week') { const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday); const dt = new Date(Date.UTC(y, m - 1, d - dow)); y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate(); }
  // Offset de Madrid para esa fecha
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' }).formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value || 'GMT+1';
  const off = parseInt(tzName.replace('GMT', '') || '1', 10) || 0;
  return new Date(Date.UTC(y, m - 1, d, -off)).toISOString();
}
const dayIso = (s, end = false) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T${end ? '23:59:59.999' : '00:00:00'}+01:00`).toISOString();
};

async function fetchEvents(admin, { from, to, sources }) {
  let q = admin.from('crm_capture_events')
    .select('id, channel, source, status, request_type, lead_id, campaign_id, campaign_name, form_id, form_name, platform, received_at, is_test')
    .eq('is_test', false).order('received_at', { ascending: false }).limit(20000);
  if (from) q = q.gte('received_at', from);
  if (to) q = q.lte('received_at', to);
  if (sources) q = q.in('source', sources);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function captureMetrics(admin, params = {}) {
  const channel = ['web', 'facebook', 'instagram'].includes(params.channel) ? params.channel : null;
  const sources = channel ? [CH_TO_SOURCE[channel]] : CAPTURE_SOURCES;
  const from = dayIso(params.from);
  const to = dayIso(params.to, true);
  const [monthEv, rangeEv] = await Promise.all([
    fetchEvents(admin, { from: madridStart('month') < madridStart('week') ? madridStart('month') : madridStart('week'), sources }),
    fetchEvents(admin, { from, to, sources }),
  ]);
  const real = (arr) => arr.filter((e) => REAL_STATUSES.includes(e.status));
  const since = (iso) => real(monthEv).filter((e) => e.received_at >= iso).length;
  const r = real(rangeEv);
  const bySource = Object.fromEntries(CAPTURE_SOURCES.map((s) => [s, r.filter((e) => e.source === s).length]));
  const byRequest = {};
  for (const e of r) byRequest[e.request_type || 'info'] = (byRequest[e.request_type || 'info'] || 0) + 1;
  const camp = new Map();
  for (const e of r.filter((x) => x.campaign_id || x.campaign_name)) {
    const k = e.campaign_id || e.campaign_name;
    const c = camp.get(k) || { campaign_id: e.campaign_id, campaign_name: e.campaign_name || '(sin nombre)', source: e.source, count: 0 };
    c.count += 1; camp.set(k, c);
  }
  const forms = new Map();
  for (const e of r) {
    const k = `${e.source}:${e.form_id || e.form_name || '?'}`;
    const f = forms.get(k) || { source: e.source, form: e.form_name || e.form_id || '—', count: 0 };
    f.count += 1; forms.set(k, f);
  }
  // Leads captados (de cualquier fecha si no hay filtro) → registro iniciado y negocios registrados
  let lq = admin.from('crm_leads').select('id, source, linked_tenant_id, metadata, created_at').in('source', sources).is('anonymized_at', null).limit(20000);
  if (from) lq = lq.gte('created_at', from);
  if (to) lq = lq.lte('created_at', to);
  const { data: leads } = await lq;
  const L = leads || [];
  return {
    filters: { from: params.from || null, to: params.to || null, channel: channel || 'all' },
    today: since(madridStart('day')),
    week: since(madridStart('week')),
    month: since(madridStart('month')),
    received: r.length,
    uniqueLeads: new Set(r.map((e) => e.lead_id).filter(Boolean)).size,
    bySource,
    byRequest,
    demoRequests: byRequest.demo || 0,
    infoRequests: byRequest.info || 0,
    campaigns: [...camp.values()].sort((a, b) => b.count - a.count).slice(0, 30),
    forms: [...forms.values()].sort((a, b) => b.count - a.count).slice(0, 30),
    capturedLeads: L.length,
    signupStarted: L.filter((l) => l.metadata?.signup_started_at).length,
    converted: L.filter((l) => l.linked_tenant_id).length,
    review: rangeEv.filter((e) => e.status === 'review').length,
    duplicates: rangeEv.filter((e) => e.status === 'duplicate').length,
    failed: rangeEv.filter((e) => e.status === 'failed').length,
    blocked: rangeEv.filter((e) => ['spam', 'rate_limited'].includes(e.status)).length,
  };
}

export async function channelsOverview(admin) {
  const channels = await getChannels(admin);
  const meta = metaConfig();
  const st = await getMetaStatus(admin);
  const counts = {};
  const last = {};
  for (const s of CAPTURE_SOURCES) {
    const { count } = await admin.from('crm_capture_events').select('id', { count: 'exact', head: true }).eq('source', s).in('status', REAL_STATUSES).eq('is_test', false);
    counts[s] = count || 0;
    const { data } = await admin.from('crm_capture_events').select('received_at').eq('source', s).in('status', REAL_STATUSES).eq('is_test', false).order('received_at', { ascending: false }).limit(1);
    last[s] = data?.[0]?.received_at || null;
  }
  const { data: lastTest } = await admin.from('crm_capture_events').select('received_at, payload').eq('channel', 'web').eq('is_test', true).order('received_at', { ascending: false }).limit(1);
  const { data: errs } = await admin.from('crm_capture_events').select('id, error, received_at, attempts').eq('channel', 'meta').eq('status', 'failed').order('received_at', { ascending: false }).limit(5);
  const metaConnected = Boolean(meta.configured && st.connected);
  const metaState = !meta.configured ? 'pending_config' : st.connected ? 'connected' : st.checked_at ? 'error' : 'unverified';
  return {
    web: {
      enabled: channels.web.enabled, count: counts.web_form, lastAt: last.web_form,
      lastTestAt: lastTest?.[0]?.received_at || null,
      turnstile: turnstileConfigured() ? 'configured' : 'pending_config',
      pages: ['/contacto', '/demo', '/#contacto'],
    },
    meta: {
      state: metaState,
      missing: meta.missing,
      graphVersion: meta.version,
      webhookUrl: absoluteUrl('/api/meta/webhook'),
      verifyToken: await getVerifyToken(admin),
      requiredScopes: REQUIRED_SCOPES, optionalScopes: OPTIONAL_SCOPES,
      checkedAt: st.checked_at || null, error: st.error || null, lastError: st.last_error || null, lastErrorAt: st.last_error_at || null,
      page: st.page || null, instagram: st.instagram || null, scopes: st.scopes || [], missingScopes: st.missing_scopes || [],
      tokenExpiresAt: st.token_expires_at || null, subscribed: Boolean(st.subscribed),
      forms: st.forms || [], formsError: st.forms_error || null,
      lastWebhookAt: st.last_webhook_at || null, lastSyncAt: st.last_sync_at || st.checked_at || null,
      recentErrors: errs || [],
    },
    facebook: { enabled: channels.facebook.enabled, count: counts.facebook_lead_ads, lastAt: last.facebook_lead_ads, state: metaConnected ? 'connected' : metaState },
    instagram: {
      enabled: channels.instagram.enabled, count: counts.instagram_lead_ads, lastAt: last.instagram_lead_ads,
      state: !metaConnected ? metaState : st.instagram ? 'connected' : 'no_account',
      account: st.instagram || null,
    },
  };
}

const toggleSchema = z.object({ channel: z.enum(['web', 'facebook', 'instagram']), enabled: z.boolean() }).strict();
export async function setChannelEnabled(admin, user, body) {
  const p = toggleSchema.safeParse(body || {});
  if (!p.success) throw new CrmError('Datos no válidos');
  const cur = (await getSettingValue(admin, 'capture_channels')) || {};
  const next = { ...cur, [p.data.channel]: { ...(cur[p.data.channel] || {}), enabled: p.data.enabled, updated_at: new Date().toISOString(), updated_by: user.id } };
  await setSettingValue(admin, 'capture_channels', next);
  await audit(admin, { userId: user.id, action: 'crm.capture_channel_toggled', metadata: { channel: p.data.channel, enabled: p.data.enabled } });
  return getChannels(admin);
}

export async function listEvents(admin, params = {}) {
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const size = Math.min(100, Math.max(5, parseInt(params.pageSize, 10) || 25));
  let q = admin.from('crm_capture_events')
    .select('id, channel, source, status, request_type, lead_id, form_id, form_name, page_id, platform, campaign_name, adset_name, ad_name, review_reason, reviewed_at, error, attempts, is_test, received_at, processed_at', { count: 'exact' })
    .order('received_at', { ascending: false }).range((page - 1) * size, page * size - 1);
  if (params.status && /^[a-z_]+$/.test(params.status)) q = q.eq('status', params.status);
  if (params.channel && CH_TO_SOURCE[params.channel]) q = params.channel === 'web' ? q.eq('channel', 'web') : q.eq('source', CH_TO_SOURCE[params.channel]);
  if (params.channel === 'meta') q = q.eq('channel', 'meta');
  if (params.from) q = q.gte('received_at', dayIso(params.from));
  if (params.to) q = q.lte('received_at', dayIso(params.to, true));
  const { data, count, error } = await q;
  if (error) throw error;
  const ids = [...new Set((data || []).map((e) => e.lead_id).filter(Boolean))];
  const { data: leads } = ids.length ? await admin.from('crm_leads').select('id, business_name, first_name, last_name, stage').in('id', ids) : { data: [] };
  const byId = new Map((leads || []).map((l) => [l.id, l]));
  return { rows: (data || []).map((e) => ({ ...e, lead: byId.get(e.lead_id) || null, request_label: e.request_type ? requestLabel(e.request_type) : null, channel_label: CHANNEL_LABEL[e.source] || (e.channel === 'meta' ? 'Meta' : 'Web') })), total: count || 0, page, pageSize: size };
}

export async function reviewList(admin) {
  const { data } = await admin.from('crm_capture_events').select('id, source, review_reason, lead_id, received_at, request_type, form_name').eq('status', 'review').is('reviewed_at', null).order('received_at', { ascending: false }).limit(100);
  const out = [];
  for (const e of data || []) {
    const { data: lead } = e.lead_id ? await admin.from('crm_leads').select('id, business_name, first_name, last_name, email, phone, metadata').eq('id', e.lead_id).maybeSingle() : { data: null };
    const dupIds = lead?.metadata?.possible_duplicates || [];
    const { data: dups } = dupIds.length ? await admin.from('crm_leads').select('id, business_name, first_name, last_name, email, phone, stage').in('id', dupIds) : { data: [] };
    out.push({ ...e, channel_label: CHANNEL_LABEL[e.source] || e.source, lead: lead ? { ...lead, metadata: undefined } : null, matches: dups || [] });
  }
  return out;
}

const reviewSchema = z.object({ decision: z.enum(['same_person', 'different_people', 'dismiss']), note: z.string().trim().max(500).optional().nullable() }).strict();
export async function resolveReview(admin, user, eventId, body) {
  const p = reviewSchema.safeParse(body || {});
  if (!p.success) throw new CrmError('Decisión no válida');
  const { data: ev } = await admin.from('crm_capture_events').select('id, lead_id, status, reviewed_at').eq('id', eventId).maybeSingle();
  if (!ev) throw new CrmError('Evento no encontrado', 404);
  if (ev.status !== 'review' || ev.reviewed_at) throw new CrmError('Este evento ya está revisado', 409);
  const label = { same_person: 'Es la misma persona (sin fusión automática: actualiza la ficha a mano si hace falta)', different_people: 'Son personas distintas: se mantienen como leads separados', dismiss: 'Revisión descartada' }[p.data.decision];
  await admin.from('crm_capture_events').update({ reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_reason: `${ev.review_reason || ''} → ${p.data.decision}`.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', eventId);
  if (ev.lead_id) await admin.from('crm_activities').insert({ lead_id: ev.lead_id, type: 'system', created_by: user.id, description: `Revisión de captación: ${label}${p.data.note ? ` · ${p.data.note}` : ''}`, metadata: { event_id: eventId, decision: p.data.decision } });
  await audit(admin, { userId: user.id, action: 'crm.capture_review_resolved', entityId: ev.lead_id, metadata: { event_id: eventId, decision: p.data.decision } });
  return { ok: true };
}

const legalSchema = z.object({
  owner: z.string().trim().min(2).max(160),
  nif: z.string().trim().max(20).regex(/^[A-Za-z0-9-]*$/, 'NIF/CIF no válido').optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  email: z.string().trim().email().max(200),
}).strict();
export async function saveLegalInfo(admin, user, body) {
  const p = legalSchema.safeParse(body || {});
  if (!p.success) throw new CrmError(p.error.issues?.[0]?.message || 'Datos no válidos');
  const value = { owner: p.data.owner, nif: p.data.nif || '', address: p.data.address || '', email: p.data.email, updated_at: new Date().toISOString() };
  await setSettingValue(admin, 'legal_info', value);
  await audit(admin, { userId: user.id, action: 'crm.legal_info_updated', metadata: { fields: Object.keys(p.data) } });
  return getLegalInfo(admin);
}

// Prueba de funcionamiento del formulario web: recorre validación + duplicados sin crear ningún lead
export async function testWebForm(admin, user) {
  const res = await processWebSubmission(admin, {
    first_name: 'Prueba', business_name: 'Prueba de funcionamiento', email: 'prueba-captacion@example.com', sector: 'Otro',
    request_type: 'info', consent_privacy: true, submission_id: crypto.randomUUID(), page: '/prueba', started_at: Date.now() - 10000,
  }, { test: true });
  await audit(admin, { userId: user.id, action: 'crm.capture_web_test', metadata: { result: res.wouldBe || null } });
  return res;
}

// Enlace firmado «Crear cuenta gratis» (registro iniciado) — no modifica el registro de Reserva360
export async function signupToken(admin, leadId) {
  const s = (await getSettingValue(admin, 'capture_salt'))?.value || '';
  return createHmac('sha256', `${s}:signup`).update(String(leadId)).digest('hex').slice(0, 32);
}

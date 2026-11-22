// Captación automática de leads (formulario web + Meta Lead Ads) → CRM Comercial existente (crm_leads).
// Reglas: nunca crea usuarios ni negocios, nunca envía comunicaciones, no fusiona contactos distintos.
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { sha256, normEmail, phoneDigits, isSuppressed, findDuplicates, CrmError } from '@/lib/crm/server';
import { CRM_SECTORS } from '@/lib/crm/constants';
import { CONSENT_VERSION, CONSENT_TEXTS, REQUEST_IDS, requestLabel, EMPLOYEE_RANGES, employeesFromRange, CURRENT_SYSTEMS } from '@/lib/crm/consent';
import { verifyTurnstile, turnstileConfigured } from '@/lib/crm/turnstile';
import { SITE_EMAIL } from '@/lib/site';

export const SOURCE_BY_CHANNEL = { web: 'web_form', facebook: 'facebook_lead_ads', instagram: 'instagram_lead_ads' };
export const CHANNEL_LABEL = { web_form: 'Formulario web', facebook_lead_ads: 'Facebook Lead Ads', instagram_lead_ads: 'Instagram Lead Ads' };

// Límites antispam
const IP_LIMIT = { max: 5, minutes: 10 };
const EMAIL_LIMIT = { max: 3, minutes: 60 };
const MIN_FILL_MS = 3000;

// Cliente de servidor SIN caché de datos de Next (los ajustes y eventos de captación deben leerse siempre frescos)
export function captureAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' }) },
  });
}

// ------------------------------------------------------------- ajustes (platform_settings, solo servidor)
export async function getSettingValue(admin, key) {
  const { data } = await admin.from('platform_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
export async function setSettingValue(admin, key, value) {
  const { error } = await admin.from('platform_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}
export const DEFAULT_CHANNELS = { web: { enabled: true }, facebook: { enabled: true }, instagram: { enabled: true } };
export async function getChannels(admin) {
  const v = (await getSettingValue(admin, 'capture_channels')) || {};
  return {
    web: { ...DEFAULT_CHANNELS.web, ...(v.web || {}) },
    facebook: { ...DEFAULT_CHANNELS.facebook, ...(v.facebook || {}) },
    instagram: { ...DEFAULT_CHANNELS.instagram, ...(v.instagram || {}) },
  };
}
export const DEFAULT_LEGAL = { owner: 'Reserva360', nif: '', address: '', email: SITE_EMAIL };
export async function getLegalInfo(admin) {
  try { return { ...DEFAULT_LEGAL, ...((await getSettingValue(admin, 'legal_info')) || {}) }; } catch { return { ...DEFAULT_LEGAL }; }
}
let saltCache = null;
async function salt(admin) {
  if (saltCache) return saltCache;
  let s = await getSettingValue(admin, 'capture_salt');
  if (!s?.value) {
    s = { value: randomBytes(24).toString('hex') };
    await setSettingValue(admin, 'capture_salt', s);
  }
  saltCache = s.value;
  return saltCache;
}
export async function hashIp(admin, ip) { return ip ? sha256(`${await salt(admin)}:${ip}`) : null; }

export async function captureReady(admin) {
  const { error } = await admin.from('crm_capture_events').select('id').limit(1);
  return !error;
}

// ------------------------------------------------------------- validación del formulario web
const t = (max) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const PHONE_RE = /^\+?[0-9 ()-]{9,20}$/;
export const webSchema = z.object({
  first_name: z.string().trim().min(1, 'Indica tu nombre').max(80),
  last_name: t(120),
  business_name: z.string().trim().min(2, 'Indica el nombre del negocio').max(160),
  email: z.string().trim().toLowerCase().email('Email no válido').max(200),
  phone: z.string().trim().max(20).optional().nullable().transform((v) => (v ? v : null))
    .refine((v) => !v || (PHONE_RE.test(v) && (phoneDigits(v) || '').length >= 9), 'Teléfono no válido'),
  city: t(80),
  province: t(80),
  sector: z.enum(CRM_SECTORS, { errorMap: () => ({ message: 'Elige el tipo de negocio' }) }),
  employees_range: z.enum(EMPLOYEE_RANGES).optional().nullable(),
  current_system: z.enum(CURRENT_SYSTEMS).optional().nullable(),
  problem: t(1000),
  interest: t(1000),
  request_type: z.enum(REQUEST_IDS, { errorMap: () => ({ message: 'Elige el tipo de solicitud' }) }),
  consent_privacy: z.literal(true, { errorMap: () => ({ message: 'Necesitamos tu aceptación para gestionar la solicitud' }) }),
  consent_email: z.boolean().optional().default(false),
  consent_whatsapp: z.boolean().optional().default(false),
  submission_id: z.string().uuid('Envío no válido'),
  page: z.string().trim().max(120).regex(/^\/[a-z0-9\-/]*$/i).optional().nullable(),
  started_at: z.number().int().optional().nullable(),
  website: z.string().max(200).optional().nullable(), // campo trampa (honeypot): debe llegar vacío
  turnstile_token: z.string().max(2048).optional().nullable(),
}).strict().superRefine((v, ctx) => {
  if (v.consent_whatsapp && !v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Indica tu teléfono para recibir WhatsApp' });
});

function firstIssue(err) {
  const i = err.issues?.[0];
  return { message: i?.message || 'Datos no válidos', field: i?.path?.[0] || null };
}

// ------------------------------------------------------------- núcleo: crear/actualizar lead desde un canal
const FILLABLE = ['first_name', 'last_name', 'business_name', 'phone', 'city', 'province', 'sector', 'employees_estimate', 'needs'];
const normName = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function consentBlock(consents, at, originLabel) {
  const out = {};
  for (const k of ['privacy', 'email', 'whatsapp']) {
    if (consents[k] === undefined) continue;
    out[k] = { accepted: Boolean(consents[k]), at, version: consents.version || CONSENT_VERSION, text: consents.texts?.[k] || CONSENT_TEXTS[k], origin: originLabel };
  }
  return out;
}

/**
 * capture = {
 *   source: 'web_form'|'facebook_lead_ads'|'instagram_lead_ads', originLabel, externalId (leadgen_id),
 *   fields: { first_name, last_name, business_name, email, phone, city, province, sector, employees_estimate, needs },
 *   requestType, details: {...}, consents: { privacy, email, whatsapp, version, texts }, receivedAt, eventId, campaign: {...}
 * }
 * Devuelve { leadId, outcome: 'created'|'updated'|'review', reason }
 */
export async function upsertLeadFromCapture(admin, capture) {
  const now = capture.receivedAt || new Date().toISOString();
  const f = { ...capture.fields, email: normEmail(capture.fields.email) };
  const wantsEmail = Boolean(capture.consents?.email);
  const wantsWa = Boolean(capture.consents?.whatsapp) && Boolean(f.phone);
  const anyConsent = wantsEmail || wantsWa;
  const consentInfo = consentBlock(capture.consents || {}, now, capture.originLabel);
  const channel = CHANNEL_LABEL[capture.source] || capture.source;
  const captureMeta = {
    request_type: capture.requestType || null,
    details: capture.details || {},
    campaign: capture.campaign || null,
    consents: consentInfo,
    event_id: capture.eventId || null,
    received_at: now,
    origin: capture.originLabel,
  };
  const suppressed = await isSuppressed(admin, f.email, f.phone);

  // 1) ¿Mismo email que un lead existente? → mismo contacto (salvo que el nombre y el negocio no coincidan)
  let existing = null;
  if (f.email) {
    const { data } = await admin.from('crm_leads').select('*').eq('email', f.email).is('anonymized_at', null).maybeSingle();
    existing = data;
  }
  // 1b) ¿Mismo id externo de Meta? (refuerzo de idempotencia)
  if (!existing && capture.externalId) {
    const { data } = await admin.from('crm_leads').select('*').eq('source', capture.source).eq('external_source_id', capture.externalId).maybeSingle();
    existing = data;
  }

  if (existing) {
    const nameConflict = existing.first_name && f.first_name && normName(existing.first_name) !== normName(f.first_name)
      && existing.business_name && f.business_name && normName(existing.business_name) !== normName(f.business_name);
    const meta = existing.metadata || {};
    const history = Array.isArray(meta.captures) ? meta.captures.slice(-19) : [];
    history.push({ source: capture.source, request_type: capture.requestType || null, at: now, origin: capture.originLabel, event_id: capture.eventId || null });
    const patch = { metadata: { ...meta, captures: history, last_capture: captureMeta } };
    if (!nameConflict) {
      for (const k of FILLABLE) if ((existing[k] === null || existing[k] === '' || existing[k] === undefined) && f[k] !== null && f[k] !== undefined && f[k] !== '') patch[k] = f[k];
      // Un consentimiento nuevo y expreso activa la preferencia (nunca se desactiva aquí una preferencia previa)
      if (wantsEmail) patch.comm_email = true;
      if (wantsWa) patch.comm_whatsapp = true;
      if (anyConsent) Object.assign(patch, { legal_basis: existing.legal_basis === 'contract' ? 'contract' : 'consent', consent_at: now, consent_source: `${capture.originLabel} · textos ${capture.consents?.version || CONSENT_VERSION}`, opted_out: false, opted_out_at: null });
    }
    if (patch.phone) { const dup = await findDuplicates(admin, { phone: patch.phone, excludeId: existing.id }); if (dup.length) delete patch.phone; }
    const { error } = await admin.from('crm_leads').update(patch).eq('id', existing.id);
    if (error) throw error;
    const changed = Object.keys(patch).filter((k) => k !== 'metadata');
    await admin.from('crm_activities').insert({
      lead_id: existing.id, type: 'capture', occurred_at: now,
      description: nameConflict
        ? `Nuevo formulario recibido por ${channel} (${capture.originLabel}) con el mismo email pero otro nombre/negocio («${f.first_name} · ${f.business_name}»). No se han modificado los datos: revisa si es la misma persona. Solicitud: ${requestLabel(capture.requestType)}.`
        : `Nuevo formulario recibido por ${channel} (${capture.originLabel}). Solicitud: ${requestLabel(capture.requestType)}. Lead existente actualizado${changed.length ? ` (${changed.join(', ')})` : ' (sin cambios en la ficha)'}.${anyConsent ? ' Ha dado consentimiento para comunicaciones comerciales.' : ''}`,
      metadata: { ...captureMeta, outcome: nameConflict ? 'review' : 'updated', changed },
    });
    return { leadId: existing.id, outcome: nameConflict ? 'review' : 'updated', reason: nameConflict ? 'Mismo email con otro nombre y negocio' : null };
  }

  // 2) ¿Solo coincide el teléfono? → se crea el lead y queda para revisión manual (sin fusionar)
  const phoneDups = f.phone ? await findDuplicates(admin, { phone: f.phone }) : [];
  const insert = {
    first_name: f.first_name || null, last_name: f.last_name || null, business_name: f.business_name || null,
    email: f.email || null, phone: f.phone || null, city: f.city || null, province: f.province || null,
    sector: f.sector || null, employees_estimate: f.employees_estimate ?? null, needs: f.needs || null,
    source: capture.source, source_detail: capture.originLabel?.slice(0, 300) || null, external_source_id: capture.externalId || null,
    stage: 'new', interest_level: capture.requestType === 'demo' ? 'high' : null,
    suggested_plan: capture.requestType === 'free' ? 'free' : null,
    legal_basis: anyConsent ? 'consent' : 'pre_contract',
    data_origin: `Solicitud enviada por la propia persona mediante ${channel} (${capture.originLabel})`.slice(0, 500),
    consent_at: anyConsent ? now : null,
    consent_source: anyConsent ? `${capture.originLabel} · textos ${capture.consents?.version || CONSENT_VERSION}`.slice(0, 300) : null,
    comm_email: wantsEmail, comm_whatsapp: wantsWa, comm_phone: false,
    metadata: {
      captures: [{ source: capture.source, request_type: capture.requestType || null, at: now, origin: capture.originLabel, event_id: capture.eventId || null }],
      last_capture: captureMeta,
      ...(phoneDups.length ? { possible_duplicates: phoneDups.map((d) => d.id) } : {}),
      ...(suppressed ? { previously_suppressed: true } : {}),
    },
  };
  let lead;
  {
    const { data, error } = await admin.from('crm_leads').insert(insert).select('id').single();
    if (error?.code === '23505') {
      // Carrera: otro envío creó el lead con este email/id a la vez → tratarlo como existente
      return upsertLeadFromCapture(admin, capture);
    }
    if (error) throw error;
    lead = data;
  }
  const review = phoneDups.length > 0;
  await admin.from('crm_activities').insert({
    lead_id: lead.id, type: 'capture', occurred_at: now,
    description: `Lead recibido por ${channel} (${capture.originLabel}). Solicitud: ${requestLabel(capture.requestType)}. Estado: nuevo lead creado${review ? ' · ⚠ su teléfono coincide con otro lead: pendiente de revisión manual' : ''}.${anyConsent ? ` Consentimiento comercial: ${[wantsEmail && 'email', wantsWa && 'WhatsApp'].filter(Boolean).join(' y ')}.` : ' Sin consentimiento para publicidad.'}${suppressed ? ' Este contacto había pedido la supresión de sus datos y vuelve a contactar por iniciativa propia.' : ''}`,
    metadata: { ...captureMeta, outcome: review ? 'review' : 'created', possible_duplicates: phoneDups.map((d) => d.id) },
  });
  return { leadId: lead.id, outcome: review ? 'review' : 'created', reason: review ? 'Teléfono coincidente con otro lead' : null };
}

// ------------------------------------------------------------- eventos
export async function recordEvent(admin, row) {
  const { data, error } = await admin.from('crm_capture_events').insert(row).select('id').single();
  if (error?.code === '23505') return { duplicate: true };
  if (error) throw error;
  return { id: data.id };
}
export async function updateEvent(admin, id, patch) {
  await admin.from('crm_capture_events').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}
async function countSince(admin, col, value, minutes) {
  if (!value) return 0;
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const { count } = await admin.from('crm_capture_events').select('id', { count: 'exact', head: true })
    .eq(col, value).gte('received_at', since).in('status', ['received', 'processed', 'duplicate', 'review', 'rate_limited', 'spam']);
  return count || 0;
}

// ------------------------------------------------------------- formulario web
export async function processWebSubmission(admin, raw, { ip = null, test = false } = {}) {
  if (!(await captureReady(admin))) throw new CrmError('El formulario no está disponible en este momento. Escríbenos a ' + SITE_EMAIL, 503);
  const parsed = webSchema.safeParse(raw || {});
  if (!parsed.success) { const i = firstIssue(parsed.error); throw new CrmError(i.message, 400, { field: i.field }); }
  const v = parsed.data;
  const ipHash = await hashIp(admin, ip);
  const emailHash = sha256(normEmail(v.email));

  // Antispam invisible: campo trampa y tiempo mínimo de relleno → respuesta de éxito simulada, sin guardar datos personales
  const elapsed = v.started_at ? Date.now() - v.started_at : null;
  if (v.website || (elapsed !== null && (elapsed < MIN_FILL_MS || elapsed > 6 * 3600 * 1000))) {
    await recordEvent(admin, { channel: 'web', source: 'web_form', status: 'spam', ip_hash: ipHash, is_test: test, payload: { reason: v.website ? 'honeypot' : 'timing', page: v.page || null } }).catch(() => {});
    return { ok: true, spam: true };
  }
  const channels = await getChannels(admin);
  if (!channels.web.enabled && !test) throw new CrmError('El formulario está desactivado temporalmente. Escríbenos a ' + SITE_EMAIL, 503);

  // Límite de peticiones por IP y por email
  if (!test) {
    if ((await countSince(admin, 'ip_hash', ipHash, IP_LIMIT.minutes)) >= IP_LIMIT.max || (await countSince(admin, 'email_hash', emailHash, EMAIL_LIMIT.minutes)) >= EMAIL_LIMIT.max) {
      await recordEvent(admin, { channel: 'web', source: 'web_form', status: 'rate_limited', ip_hash: ipHash, email_hash: emailHash, payload: { page: v.page || null } }).catch(() => {});
      throw new CrmError('Has enviado varias solicitudes seguidas. Espera unos minutos e inténtalo de nuevo.', 429);
    }
  }
  // Verificación de Cloudflare (obligatoria en cuanto están configuradas las claves)
  if (turnstileConfigured() && !test) {
    const ts = await verifyTurnstile(v.turnstile_token, { remoteip: ip });
    if (!ts.ok) throw new CrmError('No hemos podido verificar que no eres un robot. Vuelve a intentarlo.', 400, { field: 'turnstile', codes: ts.codes });
  }

  const receivedAt = new Date().toISOString();
  const page = v.page || '/';
  const originLabel = `Formulario web · ${page}`;
  const ev = await recordEvent(admin, {
    channel: 'web', source: 'web_form', external_id: null, idempotency_key: `web:${v.submission_id}`,
    status: test ? 'test' : 'received', request_type: v.request_type, form_id: page, form_name: originLabel,
    ip_hash: ipHash, email_hash: emailHash, is_test: test, received_at: receivedAt,
    payload: { page, consent_version: CONSENT_VERSION, consents: { privacy: true, email: v.consent_email, whatsapp: v.consent_whatsapp } },
  });
  if (ev.duplicate) return { ok: true, duplicate: true };
  if (test) {
    // Prueba de funcionamiento: valida todo el recorrido sin crear ningún lead
    const dups = await findDuplicates(admin, { email: v.email, phone: v.phone });
    await updateEvent(admin, ev.id, { processed_at: new Date().toISOString(), payload: { page, test: true, would: dups.some((d) => d.reason === 'email') ? 'update' : dups.length ? 'review' : 'create' } });
    return { ok: true, test: true, wouldBe: dups.some((d) => d.reason === 'email') ? 'updated' : dups.length ? 'review' : 'created' };
  }
  try {
    const res = await upsertLeadFromCapture(admin, {
      source: 'web_form', originLabel, externalId: null, eventId: ev.id, receivedAt, requestType: v.request_type,
      fields: {
        first_name: v.first_name, last_name: v.last_name, business_name: v.business_name, email: v.email, phone: v.phone,
        city: v.city, province: v.province, sector: v.sector, employees_estimate: employeesFromRange(v.employees_range),
        needs: [v.problem && `Problema: ${v.problem}`, v.interest && `Le interesa: ${v.interest}`].filter(Boolean).join('\n') || null,
      },
      details: { employees_range: v.employees_range || null, current_system: v.current_system || null, problem: v.problem || null, interest: v.interest || null, page },
      consents: { privacy: true, email: v.consent_email, whatsapp: v.consent_whatsapp, version: CONSENT_VERSION },
    });
    await updateEvent(admin, ev.id, { status: res.outcome === 'review' ? 'review' : 'processed', lead_id: res.leadId, review_reason: res.reason, processed_at: new Date().toISOString(), attempts: 1 });
    return { ok: true, leadId: res.leadId, outcome: res.outcome };
  } catch (e) {
    await updateEvent(admin, ev.id, { status: 'failed', error: String(e?.message || e).slice(0, 300), attempts: 1 });
    throw e;
  }
}

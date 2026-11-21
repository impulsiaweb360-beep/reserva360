// Lógica de servidor del CRM Comercial (solo Super Admin). Usa el cliente de servicio de Supabase.
// Regla: el CRM LEE tenants/profiles para vincular y sincronizar etapas, pero NUNCA los modifica.
import { createHash } from 'crypto';
import { z } from 'zod';
import {
  STAGE_IDS, OPEN_STAGES, SOURCE_IDS, LEGAL_IDS, CRM_SECTORS, MANUAL_ACTIVITY_IDS, CONTACT_ACTIVITY_IDS,
  stageLabel, taskTypeLabel, CLIENT_STAGES,
} from './constants';

export class CrmError extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

// ---------------------------------------------------------------- utilidades
export const sha256 = (v) => createHash('sha256').update(String(v)).digest('hex');
export const normEmail = (e) => (e ? String(e).trim().toLowerCase() : null);
export const phoneDigits = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (!d) return null;
  // Normaliza prefijo de España para comparar: 0034/34 + 9 dígitos → 9 dígitos
  if (d.length === 13 && d.startsWith('0034')) return d.slice(4);
  if (d.length === 11 && d.startsWith('34')) return d.slice(2);
  return d;
};
const sanitizeSearch = (q) => String(q || '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 80);
const leadName = (l) => l?.business_name || [l?.first_name, l?.last_name].filter(Boolean).join(' ') || l?.email || 'Lead';

export async function audit(admin, { userId, action, entityId = null, tenantId = null, metadata = {} }) {
  await admin.from('activity_log').insert({ tenant_id: tenantId, user_id: userId, action, entity: 'crm', entity_id: entityId, metadata });
}

export async function crmReady(admin) {
  const { error } = await admin.from('crm_leads').select('id', { head: true, count: 'exact' }).limit(1);
  return !error;
}

// ---------------------------------------------------------------- validación
const blank = (v) => (v === '' ? null : v);
const txt = (max) => z.preprocess((v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v), z.string().max(max).nullable().optional());
const dt = z.preprocess(blank, z.string().datetime({ offset: true }).nullable().optional());
const sectorSchema = z.preprocess((v) => {
  if (v === '' || v == null) return null;
  const hit = CRM_SECTORS.find((s) => s.toLowerCase() === String(v).trim().toLowerCase());
  return hit || String(v);
}, z.enum(CRM_SECTORS).nullable().optional());

export const leadSchema = z.object({
  first_name: txt(100),
  last_name: txt(150),
  business_name: txt(200),
  email: z.preprocess((v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim().toLowerCase()) : v), z.string().email('Email no válido').max(254).nullable().optional()),
  phone: z.preprocess((v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v), z.string().regex(/^[+\d\s().-]{6,25}$/, 'Teléfono no válido').nullable().optional()),
  website: txt(300),
  sector: sectorSchema,
  address: txt(300),
  city: txt(120),
  province: txt(120),
  source: z.enum(SOURCE_IDS).optional(),
  source_detail: txt(300),
  needs: txt(3000),
  employees_estimate: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int('Nº de empleados no válido').min(0).max(100000).nullable().optional()),
  interest_level: z.preprocess(blank, z.enum(['low', 'medium', 'high']).nullable().optional()),
  suggested_plan: z.preprocess(blank, z.enum(['free', 'pro', 'business']).nullable().optional()),
  notes: txt(5000),
  legal_basis: z.enum(LEGAL_IDS).optional(),
  data_origin: txt(500),
  consent_at: dt,
  consent_source: txt(300),
  comm_email: z.boolean().optional(),
  comm_phone: z.boolean().optional(),
  comm_whatsapp: z.boolean().optional(),
  opted_out: z.boolean().optional(),
  next_contact_at: dt,
}).strict();

const zodMsg = (e) => e.issues.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`).join(' · ');
export function parseLead(body, { partial = false } = {}) {
  const r = (partial ? leadSchema.partial() : leadSchema).safeParse(body || {});
  if (!r.success) throw new CrmError(zodMsg(r.error));
  return r.data;
}

// Reglas legales y de coherencia (se aplican sobre el estado final del lead)
function checkLegal(final) {
  if (!final.business_name && !final.first_name && !final.email) throw new CrmError('Indica al menos el nombre del negocio, el nombre del contacto o el email');
  if (final.legal_basis === 'consent' && (!final.consent_at || !final.consent_source)) {
    throw new CrmError('Con base jurídica «Consentimiento» debes indicar la fecha y el origen del consentimiento');
  }
  const wantsComm = final.comm_email || final.comm_whatsapp;
  if (wantsComm && !['consent', 'contract'].includes(final.legal_basis)) {
    throw new CrmError('Las comunicaciones comerciales por email o WhatsApp requieren consentimiento (LSSI). Cambia la base jurídica o desactiva esas preferencias.');
  }
}

async function isSuppressed(admin, email, phone) {
  const hashes = [];
  if (email) hashes.push(['email', sha256(normEmail(email))]);
  const d = phoneDigits(phone);
  if (d) hashes.push(['phone', sha256(d)]);
  for (const [kind, h] of hashes) {
    const { data } = await admin.from('crm_suppressions').select('id').eq('kind', kind).eq('value_hash', h).maybeSingle();
    if (data) return true;
  }
  return false;
}

// Posibles duplicados entre leads (email exacto = duplicado seguro; teléfono = posible)
export async function findDuplicates(admin, { email, phone, excludeId = null }) {
  const out = [];
  if (email) {
    let q = admin.from('crm_leads').select('id, business_name, first_name, last_name, email, phone, stage').eq('email', normEmail(email));
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    (data || []).forEach((l) => out.push({ ...l, reason: 'email' }));
  }
  const d = phoneDigits(phone);
  if (d) {
    let q = admin.from('crm_leads').select('id, business_name, first_name, last_name, email, phone, phone_digits, stage').or(`phone_digits.eq.${d},phone_digits.eq.34${d}`);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    (data || []).forEach((l) => { if (!out.some((o) => o.id === l.id)) out.push({ ...l, reason: 'phone' }); });
  }
  return out;
}

// ---------------------------------------------------------------- leads
export async function createLead(admin, user, body) {
  const { confirmDuplicates, stage: rawStage, ...rest } = body || {};
  const data = parseLead(rest);
  const final = { source: 'manual', legal_basis: 'legitimate_interest', ...data };
  if (final.opted_out) { final.comm_email = false; final.comm_phone = false; final.comm_whatsapp = false; }
  checkLegal(final);
  if (await isSuppressed(admin, final.email, final.phone)) {
    throw new CrmError('Este contacto pidió la supresión de sus datos y está en la lista de no contactar. No se puede volver a dar de alta.', 409, { code: 'suppressed' });
  }
  const dups = await findDuplicates(admin, final);
  if (dups.some((d) => d.reason === 'email')) throw new CrmError('Ya existe un lead con este email', 409, { code: 'duplicate', duplicates: dups });
  if (dups.length && !confirmDuplicates) throw new CrmError('Hay un lead con el mismo teléfono. Revísalo o confirma que es otro contacto.', 409, { code: 'possible_duplicate', duplicates: dups });
  const stage = STAGE_IDS.includes(rawStage) && !CLIENT_STAGES.includes(rawStage) ? rawStage : 'new';
  if (final.opted_out) final.opted_out_at = new Date().toISOString();

  const { data: lead, error } = await admin.from('crm_leads').insert({ ...final, stage, created_by: user.id }).select('*').single();
  if (error) {
    if (error.code === '23505') throw new CrmError('Ya existe un lead con este email', 409, { code: 'duplicate' });
    throw new CrmError(error.message, 500);
  }
  await admin.from('crm_stage_history').insert({ lead_id: lead.id, from_stage: null, to_stage: stage, origin: 'create', changed_by: user.id });
  await admin.from('crm_activities').insert({ lead_id: lead.id, type: 'system', description: `Lead creado manualmente (${stageLabel(stage)})`, created_by: user.id });
  return lead;
}

const FIELD_LABELS = {
  first_name: 'nombre', last_name: 'apellidos', business_name: 'negocio', email: 'email', phone: 'teléfono', website: 'web',
  sector: 'sector', address: 'dirección', city: 'ciudad', province: 'provincia', source: 'origen', source_detail: 'detalle de origen',
  needs: 'necesidades', employees_estimate: 'nº empleados', interest_level: 'interés', suggested_plan: 'plan sugerido', notes: 'observaciones',
  legal_basis: 'base jurídica', data_origin: 'origen de los datos', consent_at: 'fecha de consentimiento', consent_source: 'origen del consentimiento',
  comm_email: 'preferencia email', comm_phone: 'preferencia teléfono', comm_whatsapp: 'preferencia WhatsApp', opted_out: 'oposición', next_contact_at: 'próximo contacto',
};

export async function updateLead(admin, user, id, body) {
  const { data: cur } = await admin.from('crm_leads').select('*').eq('id', id).maybeSingle();
  if (!cur) throw new CrmError('Lead no encontrado', 404);
  if (cur.anonymized_at) throw new CrmError('Lead anonimizado por solicitud de supresión: no se puede editar', 409);
  const patch = parseLead(body, { partial: true });
  const final = { ...cur, ...patch };
  if (final.opted_out) { patch.comm_email = false; patch.comm_phone = false; patch.comm_whatsapp = false; final.comm_email = false; final.comm_whatsapp = false; }
  checkLegal(final);
  if (patch.email !== undefined && patch.email && patch.email !== cur.email) {
    const dups = await findDuplicates(admin, { email: patch.email, excludeId: id });
    if (dups.some((d) => d.reason === 'email')) throw new CrmError('Ya existe otro lead con este email', 409, { code: 'duplicate', duplicates: dups });
    if (await isSuppressed(admin, patch.email, null)) throw new CrmError('Ese email está en la lista de no contactar', 409, { code: 'suppressed' });
  }
  if (patch.opted_out === true && !cur.opted_out) patch.opted_out_at = new Date().toISOString();
  if (patch.opted_out === false && cur.opted_out) {
    if (cur.stage === 'do_not_contact') throw new CrmError('Para quitar la oposición, primero cambia la etapa «No contactar»', 409);
    patch.opted_out_at = null;
  }
  const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k] ?? null) !== JSON.stringify(cur[k] ?? null));
  if (!changed.length) return cur;
  const upd = Object.fromEntries(changed.map((k) => [k, patch[k]]));
  if (upd.opted_out_at === undefined && patch.opted_out_at !== undefined) upd.opted_out_at = patch.opted_out_at;
  const { data: lead, error } = await admin.from('crm_leads').update(upd).eq('id', id).select('*').single();
  if (error) {
    if (error.code === '23505') throw new CrmError('Ya existe otro lead con este email', 409, { code: 'duplicate' });
    throw new CrmError(error.message, 500);
  }
  await admin.from('crm_activities').insert({
    lead_id: id, type: 'system', created_by: user.id,
    description: `Ficha actualizada: ${changed.map((k) => FIELD_LABELS[k] || k).join(', ')}`,
    metadata: { fields: changed },
  });
  if (upd.opted_out === true) {
    await admin.from('crm_activities').insert({ lead_id: id, type: 'privacy', created_by: user.id, description: 'Registrada oposición a comunicaciones comerciales' });
  }
  return lead;
}

export async function changeStage(admin, user, id, stage, note = null, origin = 'manual') {
  if (!STAGE_IDS.includes(stage)) throw new CrmError('Etapa no válida');
  const { data, error } = await admin.rpc('crm_change_stage', { p_lead: id, p_stage: stage, p_admin: user?.id || null, p_note: note ? String(note).slice(0, 500) : null, p_origin: origin });
  if (error) throw new CrmError(error.message.replace(/^.*?: /, ''), /no encontrado/i.test(error.message) ? 404 : 409);
  return data;
}

export async function addActivity(admin, user, leadId, body) {
  const schema = z.object({
    type: z.enum(MANUAL_ACTIVITY_IDS),
    description: z.string().trim().min(1, 'Escribe una descripción').max(5000),
    occurred_at: dt,
  }).strict();
  const r = schema.safeParse(body || {});
  if (!r.success) throw new CrmError(zodMsg(r.error));
  const { data: lead } = await admin.from('crm_leads').select('id, last_contact_at, anonymized_at').eq('id', leadId).maybeSingle();
  if (!lead) throw new CrmError('Lead no encontrado', 404);
  if (lead.anonymized_at) throw new CrmError('Lead anonimizado: no admite nuevas actividades', 409);
  const occurred = r.data.occurred_at || new Date().toISOString();
  if (new Date(occurred).getTime() > Date.now() + 5 * 60000) throw new CrmError('Una actividad realizada no puede tener fecha futura. Para algo pendiente, crea una tarea.');
  const { data, error } = await admin.from('crm_activities').insert({ lead_id: leadId, type: r.data.type, description: r.data.description, occurred_at: occurred, created_by: user.id }).select('*').single();
  if (error) throw new CrmError(error.message, 500);
  if (CONTACT_ACTIVITY_IDS.includes(r.data.type) && (!lead.last_contact_at || new Date(occurred) > new Date(lead.last_contact_at))) {
    await admin.from('crm_leads').update({ last_contact_at: occurred }).eq('id', leadId);
  }
  return data;
}

// ---------------------------------------------------------------- listado
const SORTS = { created_at: 'created_at', updated_at: 'updated_at', business_name: 'business_name', last_contact_at: 'last_contact_at', next_contact_at: 'next_contact_at', stage: 'stage' };

export async function listLeads(admin, params) {
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.get('pageSize')) || 25));
  const sort = SORTS[params.get('sort')] || 'created_at';
  const asc = params.get('dir') === 'asc';
  let q = applyFilters(admin.from('crm_leads').select('*', { count: 'exact' }), params)
    .order(sort, { ascending: asc, nullsFirst: false }).order('id')
    .range((page - 1) * pageSize, page * pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw new CrmError(error.message, 500);
  const ids = (data || []).map((l) => l.id);
  let nextTasks = {};
  if (ids.length) {
    const { data: tasks } = await admin.from('crm_tasks').select('id, lead_id, title, due_at, priority').eq('status', 'pending').in('lead_id', ids).order('due_at', { ascending: true, nullsFirst: false });
    for (const t of tasks || []) if (!nextTasks[t.lead_id]) nextTasks[t.lead_id] = t;
  }
  return { rows: (data || []).map((l) => ({ ...l, next_task: nextTasks[l.id] || null })), total: count || 0, page, pageSize };
}

export function applyFilters(q, params) {
  const s = sanitizeSearch(params.get('q'));
  if (s) {
    const like = `%${s}%`;
    const d = phoneDigits(s);
    const ors = ['business_name', 'first_name', 'last_name', 'email', 'city', 'province'].map((c) => `${c}.ilike.${like}`);
    if (d && d.length >= 4) ors.push(`phone_digits.ilike.%${d}%`);
    q = q.or(ors.join(','));
  }
  const stage = params.get('stage');
  if (stage && STAGE_IDS.includes(stage)) q = q.eq('stage', stage);
  if (params.get('open') === '1') q = q.in('stage', OPEN_STAGES).eq('opted_out', false);
  const sector = params.get('sector');
  if (sector && CRM_SECTORS.includes(sector)) q = q.eq('sector', sector);
  const source = params.get('source');
  if (source && SOURCE_IDS.includes(source)) q = q.eq('source', source);
  const from = params.get('from'); const to = params.get('to');
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) q = q.gte('created_at', `${from}T00:00:00Z`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) q = q.lte('created_at', `${to}T23:59:59.999Z`);
  if (params.get('optedOut') === '1') q = q.eq('opted_out', true);
  if (params.get('linked') === '1') q = q.not('linked_tenant_id', 'is', null);
  if (params.get('linked') === '0') q = q.is('linked_tenant_id', null);
  return q;
}

export async function pipeline(admin, params) {
  const { data, error } = await applyFilters(
    admin.from('crm_leads').select('id, business_name, first_name, last_name, email, phone, city, sector, source, stage, opted_out, anonymized_at, linked_tenant_id, next_contact_at, updated_at'),
    params,
  ).order('updated_at', { ascending: false }).limit(1500);
  if (error) throw new CrmError(error.message, 500);
  return { rows: data || [] };
}

// ---------------------------------------------------------------- ficha
export async function getLead(admin, id) {
  const { data: lead } = await admin.from('crm_leads').select('*').eq('id', id).maybeSingle();
  if (!lead) throw new CrmError('Lead no encontrado', 404);
  const [acts, tasks, hist, priv] = await Promise.all([
    admin.from('crm_activities').select('*').eq('lead_id', id).order('occurred_at', { ascending: false }).limit(500),
    admin.from('crm_tasks').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    admin.from('crm_stage_history').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    admin.from('crm_privacy_requests').select('*').eq('lead_id', id).order('requested_at', { ascending: false }),
  ]);
  const actorIds = [...new Set([...(acts.data || []).map((a) => a.created_by), ...(hist.data || []).map((h) => h.changed_by), lead.created_by].filter(Boolean))];
  const actors = await actorNames(admin, actorIds);
  let tenant = null; let user = null;
  if (lead.linked_tenant_id) {
    const { data } = await admin.from('tenants').select('id, name, slug, email, phone, plan_id, subscription_status, stripe_subscription_id, billing_interval, created_at').eq('id', lead.linked_tenant_id).maybeSingle();
    tenant = data ? { ...data, real_stage: realStageOf(data), stripe_subscription_id: undefined, has_subscription: Boolean(data.stripe_subscription_id) } : null;
  }
  if (lead.linked_user_id) {
    const { data } = await admin.from('profiles').select('id, email, first_name, last_name, role, tenant_id').eq('id', lead.linked_user_id).maybeSingle();
    user = data;
  }
  return {
    lead, tenant, user, actors,
    activities: acts.data || [], tasks: tasks.data || [], history: hist.data || [], privacy: priv.data || [],
  };
}

async function actorNames(admin, ids) {
  if (!ids.length) return {};
  const { data } = await admin.from('profiles').select('id, first_name, last_name, email').in('id', ids);
  return Object.fromEntries((data || []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email]));
}

// ---------------------------------------------------------------- datos reales de la app (solo lectura)
const PAID = ['active', 'trialing', 'past_due'];
export function realStageOf(t) {
  const paid = Boolean(t?.stripe_subscription_id) && PAID.includes(t?.subscription_status);
  if (paid && t.plan_id === 'plan_business') return 'client_business';
  if (paid && t.plan_id === 'plan_pro') return 'client_pro';
  return 'free_signup';
}

async function loadAppData(admin) {
  const [{ data: tenants }, { data: owners }] = await Promise.all([
    admin.from('tenants').select('id, name, slug, email, phone, address, created_at, plan_id, subscription_status, stripe_subscription_id'),
    admin.from('profiles').select('id, email, first_name, last_name, phone, tenant_id, role, created_at').eq('role', 'tenant_admin').not('tenant_id', 'is', null),
  ]);
  const ownersByTenant = new Map();
  for (const o of (owners || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (!ownersByTenant.has(o.tenant_id)) ownersByTenant.set(o.tenant_id, []);
    ownersByTenant.get(o.tenant_id).push(o);
  }
  return { tenants: tenants || [], owners: owners || [], ownersByTenant };
}

// Candidatos reales (usuario + negocio) para un lead. El email/teléfono solo sugiere: nunca vincula solo.
export function candidatesFor(lead, app, leadsByTenant = new Map()) {
  const email = normEmail(lead.email);
  const d = phoneDigits(lead.phone);
  const out = [];
  for (const t of app.tenants) {
    const owners = app.ownersByTenant.get(t.id) || [];
    const reasons = [];
    if (email && normEmail(t.email) === email) reasons.push('email del negocio');
    const ownerHit = email ? owners.find((o) => normEmail(o.email) === email) : null;
    if (ownerHit) reasons.push('email del propietario');
    if (d && (phoneDigits(t.phone) === d || owners.some((o) => phoneDigits(o.phone) === d))) reasons.push('teléfono');
    if (reasons.length) {
      out.push({
        tenantId: t.id, name: t.name, slug: t.slug, email: t.email, createdAt: t.created_at, realStage: realStageOf(t),
        userId: (ownerHit || owners[0])?.id || null, userEmail: (ownerHit || owners[0])?.email || null, reasons,
        linkedLeadId: leadsByTenant.get(t.id) || null,
      });
    }
  }
  return out;
}

let lastSync = 0;
// Sincroniza el CRM con los negocios reales: crea leads para negocios registrados que aún no estén
// (si no hay ambigüedad) y actualiza la etapa de los leads vinculados según su plan REAL.
export async function syncWithApp(admin, { force = false, actorId = null } = {}) {
  if (!force && Date.now() - lastSync < 30000) return { skipped: true };
  lastSync = Date.now();
  const app = await loadAppData(admin);
  const { data: leads } = await admin.from('crm_leads').select('id, email, phone, phone_digits, stage, linked_tenant_id, linked_user_id, anonymized_at');
  const all = leads || [];
  const byTenant = new Map(all.filter((l) => l.linked_tenant_id).map((l) => [l.linked_tenant_id, l]));
  const stats = { created: 0, stageUpdated: 0, needsReview: 0 };

  for (const t of app.tenants) {
    const real = realStageOf(t);
    const linked = byTenant.get(t.id);
    const owners = app.ownersByTenant.get(t.id) || [];
    if (linked) {
      if (!linked.anonymized_at && linked.stage !== real && linked.stage !== 'do_not_contact') {
        const wasClient = CLIENT_STAGES.includes(linked.stage);
        await changeStage(admin, { id: actorId }, linked.id, real, null, 'sync').catch(() => null);
        if (!wasClient) {
          await admin.from('crm_activities').insert({ lead_id: linked.id, type: 'signup', created_by: actorId, description: `Registro en Reserva360 detectado: ${t.name}` });
        }
        if (real !== 'free_signup') {
          await admin.from('crm_activities').insert({ lead_id: linked.id, type: 'conversion', created_by: actorId, description: `Conversión a ${stageLabel(real)} (suscripción real activa)` });
        }
        stats.stageUpdated++;
      }
      if (!linked.linked_user_id && owners[0]) await admin.from('crm_leads').update({ linked_user_id: owners[0].id }).eq('id', linked.id);
      continue;
    }
    // ¿Hay leads sin vincular que podrían ser este negocio? → revisión manual, no se crea nada
    const emails = new Set([normEmail(t.email), ...owners.map((o) => normEmail(o.email))].filter(Boolean));
    const phones = new Set([phoneDigits(t.phone), ...owners.map((o) => phoneDigits(o.phone))].filter(Boolean));
    const possible = all.filter((l) => !l.linked_tenant_id && !l.anonymized_at && ((l.email && emails.has(l.email)) || (phoneDigits(l.phone) && phones.has(phoneDigits(l.phone)))));
    if (possible.length) { stats.needsReview++; continue; }

    const owner = owners[0] || null;
    let email = normEmail(t.email) || normEmail(owner?.email);
    if (email && all.some((l) => l.email === email)) email = null; // email ya usado por otro lead
    const suppressed = await isSuppressed(admin, email, t.phone);
    const row = {
      business_name: t.name, first_name: owner?.first_name || null, last_name: owner?.last_name || null,
      email, phone: t.phone || owner?.phone || null, address: t.address || null,
      source: 'app_signup', legal_basis: 'contract', data_origin: 'Registro del propio negocio en la app Reserva360',
      stage: real, linked_tenant_id: t.id, linked_user_id: owner?.id || null,
      opted_out: suppressed, opted_out_at: suppressed ? new Date().toISOString() : null,
      created_by: actorId,
    };
    const { data: lead, error } = await admin.from('crm_leads').insert(row).select('id').single();
    if (error) { if (error.code !== '23505') console.error('[crm sync]', error.message); continue; }
    all.push({ ...row, id: lead.id });
    await admin.from('crm_stage_history').insert({ lead_id: lead.id, from_stage: null, to_stage: real, origin: 'sync', changed_by: actorId, note: 'Creado desde un negocio registrado' });
    await admin.from('crm_activities').insert({
      lead_id: lead.id, type: 'signup', created_by: actorId,
      description: `Negocio registrado en Reserva360 el ${new Date(t.created_at).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}. Lead creado automáticamente y vinculado.`,
    });
    stats.created++;
  }
  return stats;
}

export async function leadCandidates(admin, id) {
  const { data: lead } = await admin.from('crm_leads').select('*').eq('id', id).maybeSingle();
  if (!lead) throw new CrmError('Lead no encontrado', 404);
  const app = await loadAppData(admin);
  const { data: linkedLeads } = await admin.from('crm_leads').select('id, linked_tenant_id').not('linked_tenant_id', 'is', null);
  const map = new Map((linkedLeads || []).map((l) => [l.linked_tenant_id, l.id]));
  return candidatesFor(lead, app, map).filter((c) => c.linkedLeadId !== id);
}

export async function searchTenants(admin, q) {
  const s = sanitizeSearch(q);
  if (s.length < 2) return [];
  const like = `%${s}%`;
  const { data } = await admin.from('tenants').select('id, name, slug, email, created_at, plan_id, subscription_status, stripe_subscription_id').or(`name.ilike.${like},email.ilike.${like},slug.ilike.${like}`).limit(10);
  const ids = (data || []).map((t) => t.id);
  const { data: owners } = ids.length ? await admin.from('profiles').select('id, email, first_name, last_name, tenant_id').in('tenant_id', ids).eq('role', 'tenant_admin') : { data: [] };
  const { data: linked } = ids.length ? await admin.from('crm_leads').select('id, linked_tenant_id').in('linked_tenant_id', ids) : { data: [] };
  return (data || []).map((t) => ({
    tenantId: t.id, name: t.name, slug: t.slug, email: t.email, createdAt: t.created_at, realStage: realStageOf(t),
    owners: (owners || []).filter((o) => o.tenant_id === t.id).map((o) => ({ id: o.id, email: o.email, name: [o.first_name, o.last_name].filter(Boolean).join(' ') })),
    linkedLeadId: (linked || []).find((l) => l.linked_tenant_id === t.id)?.id || null,
  }));
}

export async function linkLead(admin, user, id, body) {
  const r = z.object({ tenantId: z.string().uuid(), userId: z.string().uuid().nullable().optional() }).strict().safeParse(body || {});
  if (!r.success) throw new CrmError(zodMsg(r.error));
  const { data: lead } = await admin.from('crm_leads').select('*').eq('id', id).maybeSingle();
  if (!lead) throw new CrmError('Lead no encontrado', 404);
  if (lead.anonymized_at) throw new CrmError('Lead anonimizado: no se puede vincular', 409);
  const { data: tenant } = await admin.from('tenants').select('id, name, plan_id, subscription_status, stripe_subscription_id').eq('id', r.data.tenantId).maybeSingle();
  if (!tenant) throw new CrmError('El negocio no existe', 404);
  const { data: other } = await admin.from('crm_leads').select('id, business_name').eq('linked_tenant_id', tenant.id).neq('id', id).maybeSingle();
  if (other) throw new CrmError(`Ese negocio ya está vinculado a otro lead (${other.business_name || other.id}). Un negocio solo puede tener un lead.`, 409, { code: 'already_linked', leadId: other.id });
  let userId = r.data.userId || null;
  if (userId) {
    const { data: p } = await admin.from('profiles').select('id, tenant_id').eq('id', userId).maybeSingle();
    if (!p || p.tenant_id !== tenant.id) throw new CrmError('Ese usuario no pertenece al negocio indicado');
  } else {
    const { data: owners } = await admin.from('profiles').select('id').eq('tenant_id', tenant.id).eq('role', 'tenant_admin').order('created_at').limit(1);
    userId = owners?.[0]?.id || null;
  }
  const { error } = await admin.from('crm_leads').update({ linked_tenant_id: tenant.id, linked_user_id: userId }).eq('id', id);
  if (error) {
    if (error.code === '23505') throw new CrmError('Ese negocio ya está vinculado a otro lead', 409, { code: 'already_linked' });
    throw new CrmError(error.message, 500);
  }
  await admin.from('crm_activities').insert({ lead_id: id, type: 'link', created_by: user.id, description: `Vinculado con el negocio real «${tenant.name}»`, metadata: { tenant_id: tenant.id, user_id: userId } });
  await audit(admin, { userId: user.id, action: 'crm.lead_linked', entityId: id, metadata: { tenant_id: tenant.id, user_id: userId } });
  const real = realStageOf(tenant);
  if (lead.stage !== real && lead.stage !== 'do_not_contact') {
    await changeStage(admin, user, id, real, 'Vinculación con negocio real', 'sync');
    await admin.from('crm_activities').insert({ lead_id: id, type: real === 'free_signup' ? 'signup' : 'conversion', created_by: user.id, description: real === 'free_signup' ? `Registro en Reserva360: ${tenant.name}` : `Conversión a ${stageLabel(real)} (suscripción real activa)` });
  }
  return getLead(admin, id);
}

export async function unlinkLead(admin, user, id, body) {
  const reason = String(body?.reason || '').trim().slice(0, 300);
  if (!reason) throw new CrmError('Indica el motivo de la desvinculación');
  const { data: lead } = await admin.from('crm_leads').select('id, linked_tenant_id, linked_user_id').eq('id', id).maybeSingle();
  if (!lead) throw new CrmError('Lead no encontrado', 404);
  if (!lead.linked_tenant_id && !lead.linked_user_id) return getLead(admin, id);
  await admin.from('crm_leads').update({ linked_tenant_id: null, linked_user_id: null }).eq('id', id);
  await admin.from('crm_activities').insert({ lead_id: id, type: 'link', created_by: user.id, description: `Desvinculado del negocio real · ${reason}`, metadata: { tenant_id: lead.linked_tenant_id } });
  await audit(admin, { userId: user.id, action: 'crm.lead_unlinked', entityId: id, metadata: { tenant_id: lead.linked_tenant_id, reason } });
  return getLead(admin, id);
}

// ---------------------------------------------------------------- tareas
const taskSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un título').max(200),
  description: txt(3000),
  task_type: z.enum(['contact', 'call', 'send_info', 'demo_prep', 'follow_up', 'review', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_at: dt,
  lead_id: z.preprocess(blank, z.string().uuid().nullable().optional()),
}).strict();

export async function createTask(admin, user, body) {
  const r = taskSchema.safeParse(body || {});
  if (!r.success) throw new CrmError(zodMsg(r.error));
  if (r.data.lead_id) {
    const { data: l } = await admin.from('crm_leads').select('id, anonymized_at').eq('id', r.data.lead_id).maybeSingle();
    if (!l) throw new CrmError('Lead no encontrado', 404);
    if (l.anonymized_at) throw new CrmError('Lead anonimizado: no admite tareas', 409);
  }
  const { data, error } = await admin.from('crm_tasks').insert({ ...r.data, created_by: user.id, assigned_to: user.id }).select('*').single();
  if (error) throw new CrmError(error.message, 500);
  if (data.lead_id) {
    await admin.from('crm_activities').insert({ lead_id: data.lead_id, type: 'task', created_by: user.id, description: `Tarea creada: ${data.title} (${taskTypeLabel(data.task_type)})`, metadata: { task_id: data.id } });
    await refreshNextContact(admin, data.lead_id);
  }
  return data;
}

export async function updateTask(admin, user, id, body) {
  const r = taskSchema.partial().extend({ status: z.enum(['pending', 'completed', 'cancelled']).optional() }).strict().safeParse(body || {});
  if (!r.success) throw new CrmError(zodMsg(r.error));
  const { data: cur } = await admin.from('crm_tasks').select('*').eq('id', id).maybeSingle();
  if (!cur) throw new CrmError('Tarea no encontrada', 404);
  const patch = { ...r.data };
  if (patch.status && patch.status !== cur.status) {
    patch.completed_at = patch.status === 'completed' ? new Date().toISOString() : null;
    patch.cancelled_at = patch.status === 'cancelled' ? new Date().toISOString() : null;
  }
  const { data, error } = await admin.from('crm_tasks').update(patch).eq('id', id).select('*').single();
  if (error) throw new CrmError(error.message, 500);
  const leadId = data.lead_id;
  if (leadId && patch.status && patch.status !== cur.status) {
    const verb = { completed: 'completada', cancelled: 'cancelada', pending: 'reabierta' }[patch.status];
    await admin.from('crm_activities').insert({ lead_id: leadId, type: 'task', created_by: user.id, description: `Tarea ${verb}: ${data.title}`, metadata: { task_id: id, status: patch.status } });
  }
  if (leadId) await refreshNextContact(admin, leadId);
  return data;
}

// Próximo contacto = vencimiento de la tarea pendiente más cercana (si existe)
async function refreshNextContact(admin, leadId) {
  const { data } = await admin.from('crm_tasks').select('due_at').eq('lead_id', leadId).eq('status', 'pending').not('due_at', 'is', null).order('due_at').limit(1);
  const next = data?.[0]?.due_at || null;
  if (next) await admin.from('crm_leads').update({ next_contact_at: next }).eq('id', leadId);
}

export async function listTasks(admin, params) {
  let q = admin.from('crm_tasks').select('*, crm_leads(id, business_name, first_name, last_name)').order('due_at', { ascending: true, nullsFirst: false }).limit(500);
  const status = params.get('status');
  if (['pending', 'completed', 'cancelled'].includes(status)) q = q.eq('status', status);
  if (params.get('overdue') === '1') q = q.eq('status', 'pending').lt('due_at', new Date().toISOString());
  const lead = params.get('lead');
  if (lead && /^[0-9a-f-]{36}$/i.test(lead)) q = q.eq('lead_id', lead);
  const { data, error } = await q;
  if (error) throw new CrmError(error.message, 500);
  return { rows: data || [] };
}

export async function listActivities(admin, params) {
  let q = admin.from('crm_activities').select('*, crm_leads(id, business_name, first_name, last_name)').order('occurred_at', { ascending: false }).limit(Math.min(300, Number(params.get('limit')) || 150));
  const type = params.get('type');
  if (type && /^[a-z_]+$/.test(type)) q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw new CrmError(error.message, 500);
  const actors = await actorNames(admin, [...new Set((data || []).map((a) => a.created_by).filter(Boolean))]);
  return { rows: data || [], actors };
}

// ---------------------------------------------------------------- privacidad
export async function createPrivacyRequest(admin, user, leadId, body) {
  const r = z.object({ request_type: z.enum(['access', 'rectification', 'erasure', 'opposition', 'restriction', 'portability']), details: txt(2000) }).strict().safeParse(body || {});
  if (!r.success) throw new CrmError(zodMsg(r.error));
  const { data: lead } = await admin.from('crm_leads').select('id').eq('id', leadId).maybeSingle();
  if (!lead) throw new CrmError('Lead no encontrado', 404);
  const { data, error } = await admin.from('crm_privacy_requests').insert({ lead_id: leadId, ...r.data, handled_by: user.id }).select('*').single();
  if (error) throw new CrmError(error.message, 500);
  await admin.from('crm_activities').insert({ lead_id: leadId, type: 'privacy', created_by: user.id, description: `Solicitud RGPD registrada: ${r.data.request_type}${r.data.details ? ` · ${r.data.details}` : ''}` });
  await audit(admin, { userId: user.id, action: 'crm.privacy_request', entityId: leadId, metadata: { request_id: data.id, type: r.data.request_type } });
  return data;
}

export async function resolvePrivacyRequest(admin, user, requestId, body) {
  const r = z.object({ status: z.enum(['completed', 'rejected']), resolution: txt(2000) }).strict().safeParse(body || {});
  if (!r.success) throw new CrmError(zodMsg(r.error));
  const { data: req } = await admin.from('crm_privacy_requests').select('*').eq('id', requestId).maybeSingle();
  if (!req) throw new CrmError('Solicitud no encontrada', 404);
  if (req.status !== 'open') throw new CrmError('La solicitud ya está resuelta', 409);
  const leadId = req.lead_id;
  if (r.data.status === 'completed' && leadId) {
    if (req.request_type === 'erasure') await anonymizeLead(admin, user, leadId);
    if (req.request_type === 'opposition') {
      await admin.from('crm_leads').update({ opted_out: true, opted_out_at: new Date().toISOString(), comm_email: false, comm_phone: false, comm_whatsapp: false }).eq('id', leadId);
      await changeStage(admin, user, leadId, 'do_not_contact', 'Oposición a comunicaciones (RGPD)', 'privacy').catch(() => null);
    }
  }
  const { data, error } = await admin.from('crm_privacy_requests').update({ status: r.data.status, resolution: r.data.resolution || null, resolved_at: new Date().toISOString(), handled_by: user.id }).eq('id', requestId).select('*').single();
  if (error) throw new CrmError(error.message, 500);
  if (leadId && req.request_type !== 'erasure') {
    await admin.from('crm_activities').insert({ lead_id: leadId, type: 'privacy', created_by: user.id, description: `Solicitud RGPD (${req.request_type}) ${r.data.status === 'completed' ? 'atendida' : 'rechazada'}${r.data.resolution ? ` · ${r.data.resolution}` : ''}` });
  }
  await audit(admin, { userId: user.id, action: 'crm.privacy_resolved', entityId: leadId, metadata: { request_id: requestId, type: req.request_type, status: r.data.status } });
  return data;
}

export async function anonymizeLead(admin, user, leadId) {
  const { data: lead } = await admin.from('crm_leads').select('id, email, phone, anonymized_at').eq('id', leadId).maybeSingle();
  if (!lead) throw new CrmError('Lead no encontrado', 404);
  if (lead.anonymized_at) return lead;
  const d = phoneDigits(lead.phone);
  const { data, error } = await admin.rpc('crm_anonymize_lead', {
    p_lead: leadId, p_admin: user.id, p_email_hash: lead.email ? sha256(normEmail(lead.email)) : null, p_phone_hash: d ? sha256(d) : null, p_reason: null,
  });
  if (error) throw new CrmError(error.message, 500);
  await audit(admin, { userId: user.id, action: 'crm.lead_anonymized', entityId: leadId, metadata: {} });
  return data;
}

// Datos del lead para atender un derecho de acceso/portabilidad
export async function leadDataExport(admin, user, id) {
  const d = await getLead(admin, id);
  await audit(admin, { userId: user.id, action: 'crm.lead_data_exported', entityId: id, metadata: {} });
  const { lead } = d;
  return {
    exportado_el: new Date().toISOString(),
    datos: {
      nombre: lead.first_name, apellidos: lead.last_name, negocio: lead.business_name, email: lead.email, telefono: lead.phone, web: lead.website,
      sector: lead.sector, direccion: lead.address, ciudad: lead.city, provincia: lead.province, necesidades: lead.needs, observaciones: lead.notes,
    },
    origen_de_los_datos: { fuente: lead.source, detalle: lead.source_detail, origen_documentado: lead.data_origin, base_juridica: lead.legal_basis, consentimiento_fecha: lead.consent_at, consentimiento_origen: lead.consent_source },
    preferencias: { email: lead.comm_email, telefono: lead.comm_phone, whatsapp: lead.comm_whatsapp, oposicion: lead.opted_out, oposicion_fecha: lead.opted_out_at },
    actividades: d.activities.map((a) => ({ tipo: a.type, descripcion: a.description, fecha: a.occurred_at })),
  };
}

// ---------------------------------------------------------------- dashboard
export async function stats(admin) {
  const now = new Date();
  const [{ data: leads }, app, { data: demoActs }, { data: pending }, review] = await Promise.all([
    admin.from('crm_leads').select('id, stage, source, opted_out, linked_tenant_id, anonymized_at, created_at'),
    loadAppData(admin),
    admin.from('crm_activities').select('lead_id').eq('type', 'demo'),
    admin.from('crm_tasks').select('id, title, due_at, priority, task_type, lead_id, crm_leads(id, business_name, first_name, last_name)').eq('status', 'pending').order('due_at', { ascending: true, nullsFirst: false }).limit(300),
    reviewQueue(admin),
  ]);
  const L = leads || [];
  const by = (st) => L.filter((l) => l.stage === st).length;
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const demoDone = new Set([...(demoActs || []).map((a) => a.lead_id), ...L.filter((l) => l.stage === 'demo_done').map((l) => l.id)]);
  const prospects = L.filter((l) => l.source !== 'app_signup');
  const realStages = app.tenants.map(realStageOf);
  const tenantsTotal = app.tenants.length;
  const paidPro = realStages.filter((s) => s === 'client_pro').length;
  const paidBusiness = realStages.filter((s) => s === 'client_business').length;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const tasks = pending || [];
  return {
    leads: {
      total: L.length,
      newThisWeek: L.filter((l) => new Date(l.created_at) >= weekAgo).length,
      newStage: by('new'),
      toContact: L.filter((l) => ['new', 'to_qualify'].includes(l.stage) && !l.opted_out).length,
      interested: by('interested'),
      demoRequested: by('demo_requested'),
      demoDone: demoDone.size,
      freeSignup: by('free_signup'),
      clientPro: by('client_pro'),
      clientBusiness: by('client_business'),
      lost: by('lost'),
      optedOut: L.filter((l) => l.opted_out || l.stage === 'do_not_contact').length,
      open: L.filter((l) => OPEN_STAGES.includes(l.stage) && !l.opted_out).length,
      byStage: Object.fromEntries(STAGE_IDS.map((s) => [s, by(s)])),
      bySource: L.reduce((acc, l) => { acc[l.source] = (acc[l.source] || 0) + 1; return acc; }, {}),
    },
    app: { tenants: tenantsTotal, free: realStages.filter((s) => s === 'free_signup').length, paidPro, paidBusiness },
    conversion: {
      leadToSignup: { value: pct(prospects.filter((l) => l.linked_tenant_id).length, prospects.length), num: prospects.filter((l) => l.linked_tenant_id).length, den: prospects.length },
      freeToPro: { value: pct(paidPro, tenantsTotal), num: paidPro, den: tenantsTotal },
      freeToBusiness: { value: pct(paidBusiness, tenantsTotal), num: paidBusiness, den: tenantsTotal },
    },
    tasks: {
      pending: tasks.length,
      overdue: tasks.filter((t) => t.due_at && new Date(t.due_at) < now),
      upcoming: tasks.filter((t) => !t.due_at || new Date(t.due_at) >= now).slice(0, 8),
    },
    review,
  };
}

// Leads sin vincular con posibles coincidencias reales → revisión manual
export async function reviewQueue(admin) {
  const [{ data: leads }, app] = await Promise.all([
    admin.from('crm_leads').select('id, business_name, first_name, last_name, email, phone, stage').is('linked_tenant_id', null).is('anonymized_at', null).limit(2000),
    loadAppData(admin),
  ]);
  const { data: linked } = await admin.from('crm_leads').select('id, linked_tenant_id').not('linked_tenant_id', 'is', null);
  const map = new Map((linked || []).map((l) => [l.linked_tenant_id, l.id]));
  const out = [];
  for (const l of leads || []) {
    const c = candidatesFor(l, app, map).filter((x) => !x.linkedLeadId);
    if (c.length) out.push({ lead: { id: l.id, name: leadName(l), email: l.email, stage: l.stage }, candidates: c, ambiguous: c.length > 1 });
  }
  return out;
}

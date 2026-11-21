// Importación CSV (vista previa → confirmar) y exportación de leads. Solo Super Admin.
// La importación SOLO crea/actualiza leads del CRM: nunca toca usuarios ni negocios reales.
import { z } from 'zod';
import { CrmError, parseLead, normEmail, phoneDigits, sha256, audit, applyFilters } from './server';
import { SOURCE_IDS, LEGAL_IDS, CSV_FIELDS, stageLabel, sourceLabel, legalLabel } from './constants';

const MAX_ROWS = 1000;
const ALLOWED = CSV_FIELDS.map((f) => f.key);

// Analiza las filas sin escribir nada. Se vuelve a ejecutar en el commit (no se confía en la vista previa).
export async function analyzeImport(admin, rawRows, { mode = 'skip' } = {}) {
  if (!Array.isArray(rawRows) || !rawRows.length) throw new CrmError('El archivo no tiene filas');
  if (rawRows.length > MAX_ROWS) throw new CrmError(`Máximo ${MAX_ROWS} filas por importación`);

  const parsed = rawRows.map((raw, index) => {
    const obj = {};
    for (const k of ALLOWED) if (raw && raw[k] != null && String(raw[k]).trim() !== '') obj[k] = String(raw[k]).trim();
    const warnings = [];
    if (obj.sector) {
      try { parseLead({ sector: obj.sector }, { partial: true }); } catch { warnings.push(`Sector «${obj.sector}» no reconocido: se guardará como «Otro»`); obj.sector = 'Otro'; }
    }
    try {
      const data = parseLead(obj, { partial: true });
      if (!data.business_name && !data.first_name && !data.email) return { index, data, errors: ['Falta nombre del negocio, nombre o email'], warnings };
      return { index, data, errors: [], warnings };
    } catch (e) {
      return { index, data: obj, errors: [e.message], warnings };
    }
  });

  const emails = [...new Set(parsed.map((p) => p.data.email).filter(Boolean))];
  const digits = [...new Set(parsed.map((p) => phoneDigits(p.data.phone)).filter(Boolean))];

  // Leads existentes por email (en bloques) y por teléfono
  const existingByEmail = new Map();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await admin.from('crm_leads').select('id, email, business_name, anonymized_at').in('email', emails.slice(i, i + 200));
    (data || []).forEach((l) => existingByEmail.set(l.email, l));
  }
  const existingByPhone = new Map();
  if (digits.length) {
    const { data } = await admin.from('crm_leads').select('id, phone, business_name').not('phone_digits', 'is', null);
    (data || []).forEach((l) => { const d = phoneDigits(l.phone); if (d && digits.includes(d)) existingByPhone.set(d, l); });
  }
  // Lista de no contactar
  const suppressed = new Set();
  const hashes = [...emails.map((e) => ['email', sha256(e), e]), ...digits.map((d) => ['phone', sha256(d), d])];
  for (let i = 0; i < hashes.length; i += 200) {
    const chunk = hashes.slice(i, i + 200);
    const { data } = await admin.from('crm_suppressions').select('kind, value_hash').in('value_hash', chunk.map((h) => h[1]));
    (data || []).forEach((s) => { const hit = chunk.find((h) => h[0] === s.kind && h[1] === s.value_hash); if (hit) suppressed.add(hit[2]); });
  }
  // Usuarios/negocios reales con ese email (solo aviso: se revisa la vinculación después)
  const realEmails = new Set();
  if (emails.length) {
    for (let i = 0; i < emails.length; i += 200) {
      const part = emails.slice(i, i + 200);
      const [{ data: t }, { data: p }] = await Promise.all([
        admin.from('tenants').select('email').in('email', part),
        admin.from('profiles').select('email').in('email', part),
      ]);
      [...(t || []), ...(p || [])].forEach((x) => x.email && realEmails.add(normEmail(x.email)));
    }
  }

  const seenEmail = new Set(); const seenPhone = new Set();
  const rows = parsed.map((p) => {
    const d = phoneDigits(p.data.phone);
    const r = { index: p.index, data: p.data, errors: p.errors, warnings: [...p.warnings], status: 'create', existingId: null };
    if (r.errors.length) { r.status = 'invalid'; return r; }
    if ((p.data.email && suppressed.has(p.data.email)) || (d && suppressed.has(d))) { r.status = 'blocked'; r.warnings.push('En la lista de no contactar (supresión RGPD)'); return r; }
    if ((p.data.email && seenEmail.has(p.data.email)) || (d && seenPhone.has(d))) { r.status = 'file_duplicate'; r.warnings.push('Repetido dentro del archivo'); return r; }
    if (p.data.email) seenEmail.add(p.data.email);
    if (d) seenPhone.add(d);
    const byEmail = p.data.email ? existingByEmail.get(p.data.email) : null;
    if (byEmail) {
      r.existingId = byEmail.id;
      if (byEmail.anonymized_at) { r.status = 'blocked'; r.warnings.push('Lead anonimizado'); return r; }
      r.status = mode === 'update' ? 'update' : 'duplicate';
      r.warnings.push(`Ya existe un lead con este email (${byEmail.business_name || byEmail.email})`);
      return r;
    }
    const byPhone = d ? existingByPhone.get(d) : null;
    if (byPhone) {
      r.existingId = byPhone.id; r.status = 'duplicate';
      r.warnings.push(`Posible duplicado: mismo teléfono que «${byPhone.business_name || byPhone.id}» (no se importa automáticamente)`);
      return r;
    }
    if (p.data.email && realEmails.has(p.data.email)) r.warnings.push('Este email ya tiene cuenta en Reserva360: vincúlalo después desde la ficha');
    return r;
  });
  const summary = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  return { rows, summary, total: rows.length };
}

const commitSchema = z.object({
  rows: z.array(z.record(z.any())).min(1).max(MAX_ROWS),
  mode: z.enum(['skip', 'update']).default('skip'),
  source: z.enum(SOURCE_IDS),
  source_detail: z.string().trim().max(300).optional().nullable(),
  legal_basis: z.enum(LEGAL_IDS),
  data_origin: z.string().trim().min(5, 'Describe el origen legítimo de los datos (mín. 5 caracteres)').max(500),
  fileName: z.string().trim().max(200).optional().nullable(),
}).strict();

export async function commitImport(admin, user, body) {
  const r = commitSchema.safeParse(body || {});
  if (!r.success) throw new CrmError(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
  const { rows: raw, mode, source, source_detail, legal_basis, data_origin, fileName } = r.data;
  if (legal_basis === 'consent') throw new CrmError('Una importación masiva no puede marcarse como «Consentimiento»: regístralo lead a lead con su fecha y origen.');
  if (legal_basis === 'contract') throw new CrmError('«Cliente / usuario registrado» se asigna solo al vincular con un negocio real.');
  const analysis = await analyzeImport(admin, raw, { mode });
  const toCreate = analysis.rows.filter((x) => x.status === 'create');
  const toUpdate = analysis.rows.filter((x) => x.status === 'update');
  const result = { created: 0, updated: 0, skipped: analysis.rows.length - toCreate.length - toUpdate.length, failed: 0 };
  const createdIds = [];

  for (let i = 0; i < toCreate.length; i += 100) {
    const chunk = toCreate.slice(i, i + 100).map((x) => ({
      ...x.data, source, source_detail: source_detail || fileName || null, legal_basis, data_origin, stage: 'new', created_by: user.id,
      comm_email: false, comm_phone: false, comm_whatsapp: false,
    }));
    let { data, error } = await admin.from('crm_leads').insert(chunk).select('id');
    if (error) {
      // Conflicto (p. ej. alguien creó el mismo email a la vez): se inserta uno a uno y se omiten los duplicados
      data = [];
      for (const row of chunk) {
        const one = await admin.from('crm_leads').insert(row).select('id').single();
        if (one.error) result.failed++; else data.push(one.data);
      }
    }
    createdIds.push(...(data || []).map((d) => d.id));
  }
  result.created = createdIds.length;
  for (let i = 0; i < createdIds.length; i += 200) {
    const ids = createdIds.slice(i, i + 200);
    await admin.from('crm_stage_history').insert(ids.map((id) => ({ lead_id: id, from_stage: null, to_stage: 'new', origin: 'import', changed_by: user.id })));
    await admin.from('crm_activities').insert(ids.map((id) => ({ lead_id: id, type: 'import', created_by: user.id, description: `Importado desde CSV${fileName ? ` (${fileName})` : ''} · Origen: ${sourceLabel(source)} · ${data_origin}` })));
  }
  for (const x of toUpdate) {
    // Solo actualiza datos de contacto/comerciales; nunca etapa, vínculos ni privacidad
    const patch = Object.fromEntries(Object.entries(x.data).filter(([k, v]) => v != null && k !== 'email'));
    if (!Object.keys(patch).length) { result.skipped++; continue; }
    const { error } = await admin.from('crm_leads').update(patch).eq('id', x.existingId).is('anonymized_at', null);
    if (error) { result.failed++; continue; }
    result.updated++;
    await admin.from('crm_activities').insert({ lead_id: x.existingId, type: 'import', created_by: user.id, description: `Datos actualizados por importación CSV${fileName ? ` (${fileName})` : ''}: ${Object.keys(patch).join(', ')}` });
  }
  await audit(admin, { userId: user.id, action: 'crm.import', metadata: { fileName: fileName || null, mode, source, legal_basis, data_origin, total: analysis.total, ...result } });
  return { ...result, summary: analysis.summary };
}

// ---------------------------------------------------------------- exportación
const csvCell = (v) => {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita inyección de fórmulas en Excel
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fmt = (d) => (d ? new Date(d).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '');

export async function exportLeads(admin, user, params) {
  const { data, error } = await applyFilters(admin.from('crm_leads').select('*'), params).order('created_at', { ascending: false }).limit(5000);
  if (error) throw new CrmError(error.message, 500);
  const rows = data || [];
  const header = [...CSV_FIELDS.map((f) => f.label), 'Etapa', 'Origen', 'Detalle origen', 'Base jurídica', 'Origen de los datos', 'Oposición', 'Fecha de creación', 'Último contacto', 'Próximo contacto', 'Negocio vinculado (id)'];
  const lines = [header.map(csvCell).join(';')];
  for (const l of rows) {
    lines.push([
      ...CSV_FIELDS.map((f) => l[f.key]), stageLabel(l.stage), sourceLabel(l.source), l.source_detail, legalLabel(l.legal_basis), l.data_origin,
      l.opted_out ? 'Sí' : 'No', fmt(l.created_at), fmt(l.last_contact_at), fmt(l.next_contact_at), l.linked_tenant_id,
    ].map(csvCell).join(';'));
  }
  const filters = Object.fromEntries([...params.entries()].filter(([k]) => !['page', 'pageSize'].includes(k)));
  await audit(admin, { userId: user.id, action: 'crm.export', metadata: { count: rows.length, filters } });
  return { csv: `\uFEFF${lines.join('\r\n')}`, count: rows.length };
}

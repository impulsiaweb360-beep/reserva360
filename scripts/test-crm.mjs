// Pruebas de integración del CRM Comercial (Supabase real + API real). Borra sus datos de prueba al terminar.
// Los leads creados para negocios REALES por la sincronización se conservan (decisión del usuario).
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sb = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APP = 'http://localhost:3000';
const REF = new URL(URL_).hostname.split('.')[0];
const TAG = `zzcrm${Date.now().toString(36)}`;
const START = new Date().toISOString();
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: Boolean(cond) }); console.log(`${cond ? 'PASA ' : 'FALLA'} · ${name}${extra ? ` — ${extra}` : ''}`); };
const created = { users: [], tenants: [] };

async function cookieFor(email, password) {
  const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const val = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`;
  const name = `sb-${REF}-auth-token`;
  const cookie = val.length <= 3180 ? `${name}=${val}` : val.match(/.{1,3180}/g).map((p, i) => `${name}.${i}=${p}`).join('; ');
  return { cookie, token: data.session.access_token };
}
const mkApi = (cookie) => async (path, { method = 'GET', body } = {}) => {
  const r = await fetch(`${APP}/api/admin/crm/${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch { json = { text }; }
  return { status: r.status, json, headers: r.headers };
};
async function makeUserTenant(label, { email } = {}) {
  const em = email || `${TAG}.${label}@example.com`;
  const password = `Pw-${randomBytes(6).toString('hex')}`;
  const { data: u, error } = await sb.auth.admin.createUser({ email: em, password, email_confirm: true, user_metadata: { first_name: label } });
  if (error) throw error;
  created.users.push(u.user.id);
  const { data: t } = await sb.from('tenants').insert({ slug: `${TAG}-${label}`, name: `ZZ CRM ${label}`, email: em, status: 'active', plan_id: 'plan_free', business_hours: { 1: { enabled: true, from: '09:00', to: '18:00' } }, vacations: [] }).select('*').single();
  created.tenants.push(t.id);
  await sb.from('profiles').update({ tenant_id: t.id, role: 'tenant_admin' }).eq('id', u.user.id);
  return { user: { id: u.user.id, email: em, password }, tenant: t };
}
const snapshot = async () => {
  const [{ data: t }, { count: p }, { count: fb }] = await Promise.all([
    sb.from('tenants').select('id, plan_id, subscription_status, stripe_subscription_id, status').order('id'),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('founder_benefits').select('id', { count: 'exact', head: true }),
  ]);
  return { tenants: JSON.stringify(t), tenantCount: t.length, profiles: p, founders: fb };
};

async function main() {
  const SA = await cookieFor('reserva360.app@gmail.com', 'Reserva360_79');
  const api = mkApi(SA.cookie);

  // ---------- Acceso ----------
  const first = await api('stats');
  ok('1. Super Admin accede al CRM (dashboard)', first.status === 200 && first.json.leads, `status=${first.status}`);
  const { count: realLeads } = await sb.from('crm_leads').select('id', { count: 'exact', head: true }).eq('source', 'app_signup');
  const { count: tenantsNow } = await sb.from('tenants').select('id', { count: 'exact', head: true });
  ok('   Negocios ya registrados añadidos al CRM y vinculados', realLeads > 0 && realLeads <= tenantsNow, `${realLeads} leads de ${tenantsNow} negocios`);

  const base = await snapshot();
  const N = await makeUserTenant('normal');
  const NU = await cookieFor(N.user.email, N.user.password);
  const asNormal = mkApi(NU.cookie);
  const n1 = await asNormal('stats'); const n2 = await asNormal('leads'); const n3 = await asNormal('leads', { method: 'POST', body: { business_name: 'hack' } });
  ok('2. Usuario normal NO accede (API → 403)', [n1, n2, n3].every((r) => r.status === 403), [n1, n2, n3].map((r) => r.status).join(','));
  const userClient = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${NU.token}` } }, auth: { persistSession: false } });
  const r1 = await userClient.from('crm_leads').select('id').limit(5);
  const r2 = await userClient.from('crm_leads').insert({ business_name: 'hack' });
  const r3 = await userClient.from('crm_activities').select('id').limit(5);
  const r4 = await userClient.rpc('crm_change_stage', { p_lead: N.tenant.id, p_stage: 'lost', p_admin: N.user.id });
  ok('   Usuario normal no lee ni escribe datos comerciales en la BD', (r1.data || []).length === 0 && r2.error && (r3.data || []).length === 0 && r4.error);
  const anonC = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const r5 = await anonC.from('crm_leads').select('id').limit(1);
  ok('   Visitante anónimo sin acceso', Boolean(r5.error) || (r5.data || []).length === 0);

  // ---------- Leads ----------
  const L1 = await api('leads', { method: 'POST', body: { business_name: `${TAG} Fisio Sol`, first_name: 'Lucía', last_name: 'Prueba', email: `${TAG}.l1@example.com`, phone: '+34 611 223 344', sector: 'Fisioterapia', city: 'Madrid', province: 'Madrid', source: 'referral', legal_basis: 'pre_contract', data_origin: 'Pidió información por teléfono' } });
  ok('3. Crear lead manualmente', L1.status === 201 && L1.json.lead?.id, `status=${L1.status} ${L1.json.error || ''}`);
  const id1 = L1.json.lead.id;
  const dupE = await api('leads', { method: 'POST', body: { business_name: 'Otro', email: `${TAG.toUpperCase()}.L1@example.com` } });
  const dupP = await api('leads', { method: 'POST', body: { business_name: `${TAG} Otro`, phone: '611223344' } });
  const dupP2 = await api('leads', { method: 'POST', body: { business_name: `${TAG} Otro`, phone: '611223344', confirmDuplicates: true } });
  ok('12. Duplicados detectados (email igual = bloqueo; teléfono igual = pide confirmación)', dupE.status === 409 && dupE.json.code === 'duplicate' && dupP.status === 409 && dupP.json.code === 'possible_duplicate' && dupP2.status === 201);
  const legal1 = await api('leads', { method: 'POST', body: { business_name: `${TAG} X`, legal_basis: 'consent' } });
  const legal2 = await api('leads', { method: 'POST', body: { business_name: `${TAG} Y`, comm_email: true } });
  const bad = await api('leads', { method: 'POST', body: { business_name: `${TAG} Z`, email: 'no-es-email', hacker: 1 } });
  ok('   Validación: consentimiento sin fecha, publicidad sin consentimiento y campos inválidos → 400', legal1.status === 400 && legal2.status === 400 && bad.status === 400);

  const ed = await api(`leads/${id1}`, { method: 'PATCH', body: { needs: 'Agenda online y recordatorios', employees_estimate: 4, interest_level: 'high', suggested_plan: 'pro', notes: 'Muy interesada' } });
  ok('4. Editar información del lead', ed.status === 200 && ed.json.lead.employees_estimate === 4 && ed.json.activities.some((a) => a.type === 'system' && a.description.includes('Ficha actualizada')));

  const st = await api(`leads/${id1}/stage`, { method: 'POST', body: { stage: 'interested' } });
  ok('5. Cambiar etapa comercial', st.status === 200 && st.json.lead.stage === 'interested');
  ok('6. El cambio aparece en el historial (etapas + actividades)', st.json.history.some((h) => h.from_stage === 'new' && h.to_stage === 'interested') && st.json.activities.some((a) => a.type === 'stage_change'));
  const badStage = await api(`leads/${id1}/stage`, { method: 'POST', body: { stage: 'vip' } });
  ok('   Etapa inexistente → rechazada', badStage.status === 400);

  // Historial inalterable
  const act = st.json.activities[0];
  const u1 = await sb.from('crm_activities').update({ description: 'alterado' }).eq('id', act.id);
  const u2 = await sb.from('crm_activities').delete().eq('id', act.id);
  const u3 = await sb.from('crm_stage_history').update({ to_stage: 'lost' }).eq('lead_id', id1);
  ok('   El historial no se puede alterar ni borrar (ni con acceso total a la BD)', Boolean(u1.error && u2.error && u3.error), u1.error?.message);

  // ---------- Actividades ----------
  const c1 = await api(`leads/${id1}/activities`, { method: 'POST', body: { type: 'call', description: 'Llamada: quiere demo el martes' } });
  const c2 = await api(`leads/${id1}/activities`, { method: 'POST', body: { type: 'note', description: 'Usa agenda en papel' } });
  const fut = await api(`leads/${id1}/activities`, { method: 'POST', body: { type: 'call', description: 'x', occurred_at: new Date(Date.now() + 86400000 * 3).toISOString() } });
  const sys = await api(`leads/${id1}/activities`, { method: 'POST', body: { type: 'stage_change', description: 'falso' } });
  const after = (await api(`leads/${id1}`)).json;
  ok('8. Registrar llamadas y notas (actualiza «último contacto»)', c1.status === 201 && c2.status === 201 && Boolean(after.lead.last_contact_at) && fut.status === 400 && sys.status === 400);

  // ---------- Tareas ----------
  const tPast = await api('tasks', { method: 'POST', body: { title: `${TAG} Llamar`, task_type: 'call', priority: 'high', due_at: new Date(Date.now() - 3600000).toISOString(), lead_id: id1 } });
  const tB = await api('tasks', { method: 'POST', body: { title: `${TAG} Preparar demo`, task_type: 'demo_prep', due_at: new Date(Date.now() + 86400000).toISOString(), lead_id: id1 } });
  const tC = await api('tasks', { method: 'POST', body: { title: `${TAG} Revisar`, task_type: 'review' } });
  const done = await api(`tasks/${tB.json.task.id}`, { method: 'PATCH', body: { status: 'completed' } });
  const canc = await api(`tasks/${tC.json.task.id}`, { method: 'PATCH', body: { status: 'cancelled' } });
  const badT = await api('tasks', { method: 'POST', body: { title: '', priority: 'urgentísima' } });
  ok('7. Crear, completar y cancelar tareas', tPast.status === 201 && done.json.task?.status === 'completed' && done.json.task.completed_at && canc.json.task?.status === 'cancelled' && badT.status === 400);
  const overdue = await api('tasks?overdue=1');
  const statsNow = (await api('stats')).json;
  ok('   Tareas vencidas visibles en el dashboard', overdue.json.rows.some((t) => t.id === tPast.json.task.id) && statsNow.tasks.overdue.some((t) => t.id === tPast.json.task.id));

  // ---------- Dashboard con cifras reales ----------
  const { data: allLeads } = await sb.from('crm_leads').select('stage, opted_out');
  const { data: tens } = await sb.from('tenants').select('plan_id, subscription_status, stripe_subscription_id');
  const realPro = tens.filter((t) => t.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(t.subscription_status) && t.plan_id === 'plan_pro').length;
  ok('9. El dashboard muestra cifras reales (coinciden con la BD)', statsNow.leads.total === allLeads.length && statsNow.leads.interested === allLeads.filter((l) => l.stage === 'interested').length && statsNow.app.tenants === tens.length && statsNow.app.paidPro === realPro, `leads=${statsNow.leads.total}/${allLeads.length} negocios=${statsNow.app.tenants}`);

  // ---------- Búsqueda y filtros ----------
  const s1 = await api(`leads?q=${TAG}%20Fisio`);
  const s2 = await api(`leads?q=611%20223`);
  const s3 = await api(`leads?stage=interested&sector=Fisioterapia&source=referral`);
  const today = new Date().toISOString().slice(0, 10);
  const s4 = await api(`leads?from=${today}&to=${today}&pageSize=5&page=1&sort=business_name&dir=asc`);
  const s5 = await api(`leads?from=2000-01-01&to=2000-01-02`);
  ok('10. Buscar y filtrar leads (texto, teléfono, etapa, sector, fuente, fechas, paginación)', s1.json.rows?.some((l) => l.id === id1) && s2.json.rows?.some((l) => l.id === id1) && s3.json.rows?.some((l) => l.id === id1) && s4.json.rows.length <= 5 && s4.json.total >= 3 && s5.json.total === 0);

  // ---------- Vinculación con usuario y negocio reales ----------
  const linkEmail = `${TAG}.owner@example.com`;
  const LL = await api('leads', { method: 'POST', body: { business_name: `${TAG} Peluquería Ana`, email: linkEmail, source: 'manual', data_origin: 'Feria' } });
  const before = await snapshot();
  const R = await makeUserTenant('real', { email: linkEmail });
  const syncR = await api('sync', { method: 'POST' });
  const { data: autoLead } = await sb.from('crm_leads').select('id').eq('linked_tenant_id', R.tenant.id).maybeSingle();
  ok('   Registro con email de un lead existente → no crea un lead duplicado, queda para revisión', !autoLead && syncR.json.needsReview >= 1);
  const cands = await api(`leads/${LL.json.lead.id}/candidates`);
  ok('   Coincidencia detectada por email (sin vincular automáticamente)', cands.json.candidates?.some((c) => c.tenantId === R.tenant.id && c.reasons.includes('email del propietario')));
  const lk = await api(`leads/${LL.json.lead.id}/link`, { method: 'POST', body: { tenantId: R.tenant.id } });
  ok('14. Un lead se vincula con un usuario y negocio existentes', lk.status === 200 && lk.json.lead.linked_tenant_id === R.tenant.id && lk.json.lead.linked_user_id === R.user.id && lk.json.lead.stage === 'free_signup' && lk.json.activities.some((a) => a.type === 'link') && lk.json.activities.some((a) => a.type === 'signup'));
  const lk2 = await api(`leads/${id1}/link`, { method: 'POST', body: { tenantId: R.tenant.id } });
  const wrongUser = await api(`leads/${id1}/link`, { method: 'POST', body: { tenantId: R.tenant.id, userId: N.user.id } });
  ok('   Un negocio solo puede vincularse a un lead; usuario ajeno al negocio → rechazado', lk2.status === 409 && wrongUser.status === 409);
  const afterLink = await snapshot();
  ok('15. No se crean usuarios ni negocios duplicados', afterLink.tenantCount === before.tenantCount + 1 && afterLink.profiles === before.profiles + 1);

  // Ambigüedad: dos negocios con el mismo email
  const amb = await api('leads', { method: 'POST', body: { business_name: `${TAG} Ambiguo`, email: `${TAG}.amb@example.com` } });
  await makeUserTenant('amb1', { email: `${TAG}.amb@example.com` });
  const { data: t2 } = await sb.from('tenants').insert({ slug: `${TAG}-amb2`, name: 'ZZ CRM amb2', email: `${TAG}.amb@example.com`, status: 'active', plan_id: 'plan_free', business_hours: {}, vacations: [] }).select('id').single();
  created.tenants.push(t2.id);
  const ambStats = (await api('stats')).json;
  const ambRow = ambStats.review.find((r) => r.lead.id === amb.json.lead.id);
  ok('   Varias coincidencias → revisión manual, sin vincular', ambRow?.ambiguous === true && ambRow.candidates.length === 2);

  // ---------- Etapa ≠ plan real ----------
  const preT = (await sb.from('tenants').select('plan_id, subscription_status, stripe_subscription_id').eq('id', R.tenant.id).single()).data;
  const toPro = await api(`leads/${LL.json.lead.id}/stage`, { method: 'POST', body: { stage: 'client_pro' } });
  const postT = (await sb.from('tenants').select('plan_id, subscription_status, stripe_subscription_id').eq('id', R.tenant.id).single()).data;
  ok('16. Cambiar la etapa a «Cliente PRO» NO modifica el plan ni la suscripción reales', toPro.status === 200 && JSON.stringify(preT) === JSON.stringify(postT) && postT.plan_id === 'plan_free');
  await api('sync', { method: 'POST' });
  const resynced = (await api(`leads/${LL.json.lead.id}`)).json;
  ok('   La sincronización devuelve la etapa al estado real (Registro FREE)', resynced.lead.stage === 'free_signup' && resynced.history.some((h) => h.origin === 'sync'));

  // ---------- Importación CSV ----------
  const rows = [
    { business_name: `${TAG} Barbería Norte`, email: `${TAG}.imp1@example.com`, phone: '699000111', sector: 'barberías', city: 'Bilbao' },
    { business_name: `${TAG} Dup`, email: `${TAG}.l1@example.com` },
    { business_name: `${TAG} Mal`, email: 'correo-malo' },
    { business_name: `${TAG} Repetido`, email: `${TAG}.imp1@example.com` },
    { business_name: `${TAG} Nutri`, email: `${TAG}.imp2@example.com`, sector: 'Astrología' },
  ];
  const pv = await api('import/preview', { method: 'POST', body: { rows } });
  const stx = pv.json.rows?.map((r) => r.status).join(',');
  ok('11. Importar CSV: vista previa con validación', pv.status === 200 && stx === 'create,duplicate,invalid,file_duplicate,create', stx);
  const noOrigin = await api('import/commit', { method: 'POST', body: { rows, source: 'other', legal_basis: 'legitimate_interest', data_origin: '' } });
  const consent = await api('import/commit', { method: 'POST', body: { rows, source: 'other', legal_basis: 'consent', data_origin: 'Feria de prueba' } });
  const preImp = await snapshot();
  const cm = await api('import/commit', { method: 'POST', body: { rows, source: 'other', legal_basis: 'legitimate_interest', data_origin: 'Feria de prueba 2026', fileName: 'prueba.csv' } });
  const postImp = await snapshot();
  const { data: imported } = await sb.from('crm_leads').select('sector, source, data_origin').like('email', `${TAG}.imp%`);
  ok('   Confirmar importación: solo crea los válidos, exige origen documentado', noOrigin.status === 400 && consent.status === 400 && cm.json.created === 2 && cm.json.skipped === 3 && imported.length === 2 && imported.every((l) => l.data_origin === 'Feria de prueba 2026') && imported.some((l) => l.sector === 'Otro') && imported.some((l) => l.sector === 'Barberías'));
  ok('   La importación no toca usuarios ni negocios reales', preImp.tenantCount === postImp.tenantCount && preImp.profiles === postImp.profiles && preImp.tenants === postImp.tenants);
  const again = await api('import/commit', { method: 'POST', body: { rows, source: 'other', legal_basis: 'legitimate_interest', data_origin: 'Feria de prueba 2026' } });
  ok('   Reimportar el mismo archivo no crea duplicados', again.json.created === 0);

  // ---------- Exportación ----------
  const ex = await fetch(`${APP}/api/admin/crm/export?q=${TAG}&source=other`, { headers: { cookie: SA.cookie } });
  const csv = await ex.text();
  const exN = await fetch(`${APP}/api/admin/crm/export`, { headers: { cookie: NU.cookie } });
  ok('13. Exportar registros filtrados (solo administradores)', ex.status === 200 && csv.includes(`${TAG} Barbería Norte`) && !csv.includes(`${TAG} Fisio Sol`) && Number(ex.headers.get('x-export-count')) === 2 && exN.status === 403);

  // ---------- Privacidad: supresión ----------
  const pr = await api(`leads/${id1}/privacy`, { method: 'POST', body: { request_type: 'erasure', details: 'Lo pidió por email' } });
  const rs = await api(`privacy/${pr.json.request.id}/resolve`, { method: 'POST', body: { status: 'completed' } });
  const anon = (await api(`leads/${id1}`)).json;
  const again2 = await api('leads', { method: 'POST', body: { business_name: 'Vuelve', email: `${TAG}.l1@example.com` } });
  const pv2 = await api('import/preview', { method: 'POST', body: { rows: [{ business_name: 'Vuelve', email: `${TAG}.l1@example.com` }] } });
  ok('   Supresión RGPD: anonimiza, limpia el historial y bloquea el contacto', rs.status === 200 && anon.lead.anonymized_at && !anon.lead.email && anon.lead.stage === 'do_not_contact' && anon.activities.filter((a) => a.type !== 'privacy' && a.type !== 'stage_change').every((a) => a.description.includes('eliminado')) && again2.status === 409 && again2.json.code === 'suppressed' && pv2.json.rows[0].status === 'blocked');
  const editAnon = await api(`leads/${id1}`, { method: 'PATCH', body: { notes: 'x' } });
  ok('   Un lead anonimizado no se puede reactivar ni editar', editAnon.status === 409);

  // ---------- Auditoría ----------
  const { data: aud } = await sb.from('activity_log').select('action').like('action', 'crm.%').gte('created_at', START);
  const acts = new Set((aud || []).map((a) => a.action));
  ok('17. Operaciones sensibles registradas en auditoría', ['crm.import', 'crm.export', 'crm.lead_linked', 'crm.lead_anonymized', 'crm.privacy_request', 'crm.sync'].every((a) => acts.has(a)), [...acts].join(','));
  const del = await api(`leads/${LL.json.lead.id}`, { method: 'DELETE' });
  ok('   Los leads no se pueden borrar por la API (solo anonimizar)', del.status === 405);

  // ---------- Regresión ----------
  const after2 = await snapshot();
  const realBefore = JSON.parse(base.tenants).filter((t) => !created.tenants.includes(t.id));
  const realAfter = JSON.parse(after2.tenants).filter((t) => !created.tenants.includes(t.id));
  ok('   Negocios reales intactos (planes, suscripciones, estado) y fundadores sin cambios', JSON.stringify(realBefore) === JSON.stringify(realAfter) && after2.founders >= base.founders);
  const fm = await fetch(`${APP}/api/founders/me`, { headers: { cookie: NU.cookie } });
  const fa = await fetch(`${APP}/api/admin/founders`, { headers: { cookie: SA.cookie } });
  const bs = await fetch(`${APP}/api/billing/status`, { headers: { cookie: NU.cookie } });
  const { data: realT } = await sb.from('tenants').select('slug').eq('slug', 'fisiovital').maybeSingle();
  const bk = await fetch(`${APP}/book/${realT?.slug || 'fisiovital'}`);
  const sl = await fetch(`${APP}/api/public/${realT?.slug || 'fisiovital'}/slots`);
  ok('18. Regresión: fundadores, facturación, página de reservas y horarios siguen funcionando', fm.status === 200 && fa.status === 200 && bs.status === 200 && bk.status === 200 && sl.status === 400, `${fm.status},${fa.status},${bs.status},${bk.status},${sl.status}`);
}

async function cleanup() {
  console.log('\nLimpiando datos de prueba…');
  const { data: leads } = await sb.from('crm_leads').select('id').or(`business_name.ilike.%${TAG}%,email.ilike.%${TAG}%`);
  const ids = new Set((leads || []).map((l) => l.id));
  if (created.tenants.length) {
    const { data: linked } = await sb.from('crm_leads').select('id').in('linked_tenant_id', created.tenants);
    (linked || []).forEach((l) => ids.add(l.id));
  }
  // anonimizados de la prueba (ya sin nombre): localizarlos por las tareas/actividades de la prueba
  const { data: tasks } = await sb.from('crm_tasks').select('id, lead_id').ilike('title', `%${TAG}%`);
  (tasks || []).forEach((t) => t.lead_id && ids.add(t.lead_id));
  const { data: anonT } = await sb.from('crm_tasks').select('lead_id').eq('title', 'Tarea anonimizada').gte('created_at', START);
  (anonT || []).forEach((t) => t.lead_id && ids.add(t.lead_id));
  await sb.from('crm_tasks').delete().gte('created_at', START);
  const list = [...ids];
  if (list.length) {
    await sb.from('crm_privacy_requests').delete().in('lead_id', list);
    await sb.from('crm_leads').delete().in('id', list);
  }
  await sb.from('crm_suppressions').delete().gte('created_at', START);
  await sb.from('activity_log').delete().like('action', 'crm.%').gte('created_at', START);
  await sb.from('profiles').update({ tenant_id: null }).in('tenant_id', created.tenants);
  for (const t of created.tenants) {
    await sb.from('founder_benefits').delete().eq('tenant_id', t);
    await sb.from('activity_log').delete().eq('tenant_id', t);
    const { error } = await sb.from('tenants').delete().eq('id', t);
    if (error) console.log('  no se pudo borrar tenant', t, error.message);
  }
  for (const u of created.users) await sb.auth.admin.deleteUser(u).catch(() => {});
  console.log(`Limpieza terminada (${list.length} leads de prueba borrados)`);
}

try { await main(); } catch (e) { console.error('ERROR', e); results.push({ name: 'ejecución', pass: false }); }
finally {
  await cleanup();
  console.log(`\nRESULTADO: ${results.filter((r) => r.pass).length}/${results.length} pruebas superadas`);
}

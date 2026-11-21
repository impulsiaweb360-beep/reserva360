// Pruebas de integración del programa de Usuarios Fundadores (Supabase real + Stripe modo prueba).
// Crea datos de prueba (prefijo "ZZ Fundador"), los borra al terminar y restaura la configuración del programa.
// Ejecutar: npx esbuild scripts/test-fundadores.mjs --bundle --platform=node --format=esm --outfile=/app/.tf.mjs && node /app/.tf.mjs
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { randomBytes } from 'crypto';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sb = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('Solo con clave de PRUEBA de Stripe');
const APP = 'http://localhost:3000';
const REF = new URL(URL_).hostname.split('.')[0];
const TAG = `zzf${Date.now().toString(36)}`;
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: Boolean(cond) }); console.log(`${cond ? 'PASA ' : 'FALLA'} · ${name}${extra ? ` — ${extra}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const created = { users: [], tenants: [], clocks: [], events: [] };
const WH_KEY = `stripe_webhook_secret_platform:test-${TAG}`;
const WH_SECRET = `whsec_${randomBytes(24).toString('hex')}`;
let originalProgram = null;

// ---------- utilidades ----------
const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(`${fn}: ${error.message}`); return data; };
const benefit = async (tid) => (await sb.from('founder_benefits').select('*').eq('tenant_id', tid).maybeSingle()).data;
const H = { 1: { enabled: true, from: '09:00', to: '18:00' }, 2: { enabled: true, from: '09:00', to: '18:00' }, 0: { enabled: false } };
const NOHOURS = { 1: { enabled: false }, 2: { enabled: false }, 0: { enabled: false } };

async function makeUser(label) {
  const email = `${TAG}.${label}@example.com`;
  const password = `Pw-${randomBytes(6).toString('hex')}`;
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: label } });
  if (error) throw error;
  created.users.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function makeTenant(label, { complete = true, service = true, hours = true, staff = 1, createdAt, owner }) {
  const { data: t, error } = await sb.from('tenants').insert({
    slug: `${TAG}-${label}`, name: `ZZ Fundador ${label}`, email: `${TAG}.${label}@example.com`, status: 'active', plan_id: 'plan_free',
    phone: complete ? '600000000' : null, address: complete ? 'Calle Prueba 1' : null,
    business_hours: hours ? H : NOHOURS, vacations: [], created_at: createdAt,
  }).select('*').single();
  if (error) throw error;
  created.tenants.push(t.id);
  if (service) await sb.from('services').insert({ tenant_id: t.id, name: 'Servicio prueba', duration_minutes: 30, price: 20, active: true, created_at: createdAt });
  for (let i = 0; i < staff; i++) await sb.from('employees').insert({ tenant_id: t.id, first_name: `Pro${i}`, active: true, created_at: createdAt });
  if (owner) await sb.from('profiles').update({ tenant_id: t.id, role: 'tenant_admin' }).eq('id', owner.id);
  return t;
}

// Cookie de sesión de Supabase para llamar a la API como un usuario real
async function cookieFor(user) {
  const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  const val = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`;
  const name = `sb-${REF}-auth-token`;
  if (val.length <= 3180) return { cookie: `${name}=${val}`, token: data.session.access_token };
  const parts = val.match(/.{1,3180}/g);
  return { cookie: parts.map((p, i) => `${name}.${i}=${p}`).join('; '), token: data.session.access_token };
}
const api = async (path, { method = 'GET', body, cookie } = {}) => {
  const r = await fetch(`${APP}${path}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// Envía un evento firmado al webhook real de la app
async function sendEvent(type, object, id = `evt_${TAG}_${randomBytes(6).toString('hex')}`) {
  created.events.push(id);
  const payload = JSON.stringify({ id, object: 'event', type, data: { object }, api_version: '2026-10-28', created: Math.floor(Date.now() / 1000) });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WH_SECRET });
  const r = await fetch(`${APP}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload });
  return r.status;
}

// Stripe: cliente con reloj de prueba y suscripción con el cupón fundador
async function stripeSub(tenantId, priceId, { founder = true } = {}) {
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000) });
  created.clocks.push(clock.id);
  const cust = await stripe.customers.create({ test_clock: clock.id, payment_method: 'pm_card_visa', invoice_settings: { default_payment_method: 'pm_card_visa' }, metadata: { tenant_id: tenantId } });
  const sub = await stripe.subscriptions.create({
    customer: cust.id, items: [{ price: priceId }],
    ...(founder ? { discounts: [{ coupon: 'r360_fundador_30' }] } : {}),
    metadata: { tenant_id: tenantId, ...(founder ? { r360_founder: '1' } : {}) },
  });
  return { clock, cust, sub, t: clock.frozen_time };
}
async function advance(ctx, days) {
  ctx.t += days * 86400;
  await stripe.testHelpers.testClocks.advance(ctx.clock.id, { frozen_time: ctx.t });
  for (let i = 0; i < 90; i++) { const c = await stripe.testHelpers.testClocks.retrieve(ctx.clock.id); if (c.status === 'ready') return; await sleep(2000); }
  throw new Error('reloj de prueba sin terminar');
}
const paidInvoices = async (subId) => (await stripe.invoices.list({ subscription: subId, status: 'paid', limit: 20 })).data.reverse();
async function deliverNewPaidInvoices(ctx, seen) {
  for (const inv of await paidInvoices(ctx.sub.id)) if (!seen.has(inv.id)) { seen.add(inv.id); await sendEvent('invoice.paid', inv); }
}

async function main() {
  // ---------- preparación ----------
  originalProgram = (await sb.from('founder_program').select('*').eq('id', true).single()).data;
  await sb.from('platform_settings').upsert({ key: WH_KEY, value: WH_SECRET, updated_at: new Date().toISOString() });
  const prices = {};
  for (const k of ['pro_month', 'pro_year', 'business_month', 'business_year']) {
    prices[k] = (await stripe.prices.list({ lookup_keys: [`r360_${k.replace('_', '_eur_')}`], active: true, limit: 1 })).data[0]?.id;
  }
  await stripe.coupons.retrieve('r360_fundador_30').catch(async () => stripe.coupons.create({ id: 'r360_fundador_30', percent_off: 30, duration: 'forever', name: 'Fundador -30%' }));
  const superAdmin = (await sb.from('profiles').select('id').eq('role', 'super_admin').limit(1).single()).data;

  const before = new Date(Date.now() - 86400000).toISOString();
  await sb.from('founder_program').update({ launch_at: new Date(Date.now() + 3600000).toISOString(), frozen_at: null, status: 'active', new_eligibility_enabled: true }).eq('id', true);

  const uA = await makeUser('a'); const uA2 = await makeUser('a2'); const uE = await makeUser('e'); const uE2 = await makeUser('e2');
  const uF = await makeUser('f'); const uG = await makeUser('g'); const uB = await makeUser('b'); const uC = await makeUser('c');
  const A = await makeTenant('a', { createdAt: before, owner: uA, staff: 1 });
  const B = await makeTenant('b', { createdAt: before, owner: uB, service: false });
  const C = await makeTenant('c', { createdAt: before, owner: uC, hours: false });
  const E = await makeTenant('e', { createdAt: before, owner: uE, staff: 3 });
  await sb.from('profiles').update({ tenant_id: E.id, role: 'tenant_admin' }).eq('id', uE2.id); // 2 cuentas en el mismo negocio
  const F = await makeTenant('f', { createdAt: before, owner: uF });
  const G = await makeTenant('g', { createdAt: before, owner: uG, complete: false }); // mismo propietario (persona) con 2 negocios
  await sb.from('tenants').update({ email: F.email }).eq('id', G.id);

  // ---------- 1-3: elegibilidad antes del lanzamiento ----------
  const eA = await rpc('founder_evaluate', { p_tenant: A.id });
  const eB = await rpc('founder_evaluate', { p_tenant: B.id });
  const eC = await rpc('founder_evaluate', { p_tenant: C.id });
  ok('1. Negocio con todos los requisitos antes del lanzamiento → elegible', eA.eligibility_status === 'eligible', JSON.stringify(eA.requirements));
  ok('2. Negocio sin servicio → no elegible (pendiente)', eB.eligibility_status !== 'eligible' && eB.requirements.services === false);
  ok('3. Negocio sin horarios → no elegible (pendiente)', eC.eligibility_status !== 'eligible' && eC.requirements.business_hours === false);
  const early = await rpc('founder_claim', { p_tenant: A.id });
  ok('   Antes del lanzamiento no se puede activar', early.ok === false && early.reason === 'not_launched', early.reason);

  // ---------- lanzamiento ----------
  await sb.from('founder_program').update({ launch_at: new Date(Date.now() - 60000).toISOString() }).eq('id', true);
  const D = await makeTenant('d', { createdAt: new Date().toISOString(), owner: await makeUser('d') });
  await rpc('founder_evaluate_all', {});
  const prog = (await sb.from('founder_program').select('frozen_at').eq('id', true).single()).data;
  ok('   Elegibilidad congelada al llegar el lanzamiento', Boolean(prog.frozen_at));
  const eD = await benefit(D.id);
  ok('4. Negocio registrado después del lanzamiento → no elegible', eD?.eligibility_status === 'not_eligible' && eD.requirements.account_before_launch === false);
  await sb.from('services').insert({ tenant_id: B.id, name: 'Tarde', duration_minutes: 30, price: 10, active: true });
  const eB2 = await rpc('founder_evaluate', { p_tenant: B.id });
  ok('   Completar requisitos después del lanzamiento no da el beneficio', eB2.eligibility_status === 'not_eligible' && eB2.frozen);
  const eG = await benefit(G.id); const eF = await benefit(F.id);
  ok('13. Misma persona con dos negocios → cada uno se evalúa por separado', eF.eligibility_status === 'eligible' && eG.eligibility_status === 'not_eligible');

  // ---------- 14: solicitudes simultáneas ----------
  const claims = await Promise.all(Array.from({ length: 6 }, () => sb.rpc('founder_claim', { p_tenant: A.id })));
  const winners = claims.filter((c) => c.data?.ok).length;
  ok('14. Seis solicitudes simultáneas de activación → solo una gana', winners === 1, `ganadoras=${winners}, resto=${claims.filter((c) => !c.data?.ok).map((c) => c.data?.reason).join(',')}`);
  await rpc('founder_release', { p_tenant: A.id, p_session: null });

  // ---------- Checkout real por la API (como el propietario) ----------
  const ckA = await cookieFor(uA);
  const st = await api('/api/founders/me', { cookie: ckA.cookie });
  ok('   Panel: "Mi beneficio fundador" muestra elegible y se aplicará al pagar', st.json.status === 'eligible' && st.json.willApplyOnCheckout === true, `status=${st.json.status}`);
  const co1 = await api('/api/billing/checkout', { method: 'POST', cookie: ckA.cookie, body: { plan: 'pro', interval: 'month' } });
  const co2 = await api('/api/billing/checkout', { method: 'POST', cookie: ckA.cookie, body: { plan: 'pro', interval: 'month' } });
  ok('   Checkout con descuento creado; un segundo intento reutiliza la MISMA sesión', co1.json.founder === true && co1.json.url && co2.json.url === co1.json.url, `${co1.status}/${co2.status}`);
  const sessId = (await benefit(A.id)).reserved_session_id;
  const sess = await stripe.checkout.sessions.retrieve(sessId);
  ok('   La sesión de Stripe lleva el cupón del 30 %', (sess.discounts || []).some((d) => (d.coupon?.id || d.coupon) === 'r360_fundador_30'));
  const expired = await stripe.checkout.sessions.expire(sessId);
  await sendEvent('checkout.session.expired', expired);
  ok('   Pago abandonado (sesión caducada) → se libera la reserva', (await benefit(A.id)).benefit_status === 'none');

  // ---------- 5, 7, 8, 15: PRO mensual, cambios de plan y webhooks repetidos ----------
  ok('   Reservar de nuevo para pagar', (await rpc('founder_claim', { p_tenant: A.id })).ok === true);
  const a = await stripeSub(A.id, prices.pro_month);
  const seenA = new Set();
  await sendEvent('customer.subscription.created', a.sub);
  const inv1 = (await paidInvoices(a.sub.id))[0];
  const dupId = `evt_${TAG}_dup`;
  await sendEvent('invoice.paid', inv1, dupId); seenA.add(inv1.id);
  const dupStatus = await sendEvent('invoice.paid', inv1, dupId); // mismo evento
  await sendEvent('invoice.paid', inv1); // misma factura, evento distinto
  let bA = await benefit(A.id);
  ok('5. Elegible contrata PRO → 30 % activo (13,99 €) y 1 ciclo pagado', bA.benefit_status === 'active' && bA.cycles_used === 1 && inv1.amount_paid === 1399, `pagado=${inv1.amount_paid}`);
  ok('15. Webhook repetido (mismo evento y misma factura) no duplica ciclos', bA.cycles_used === 1 && dupStatus === 200);

  let s = await stripe.subscriptions.retrieve(a.sub.id);
  s = await stripe.subscriptions.update(a.sub.id, { items: [{ id: s.items.data[0].id, price: prices.business_month }], proration_behavior: 'always_invoice' });
  await sendEvent('customer.subscription.updated', s);
  await deliverNewPaidInvoices(a, seenA);
  bA = await benefit(A.id);
  ok('7. PRO → Business conserva el descuento y los ciclos (prorrateo no cuenta)', bA.benefit_status === 'active' && bA.cycles_used === 1 && bA.current_plan_id === 'plan_business');
  await advance(a, 32); await deliverNewPaidInvoices(a, seenA);
  s = await stripe.subscriptions.retrieve(a.sub.id);
  s = await stripe.subscriptions.update(a.sub.id, { items: [{ id: s.items.data[0].id, price: prices.pro_month }], proration_behavior: 'none' });
  await sendEvent('customer.subscription.updated', s);
  bA = await benefit(A.id);
  ok('8. Business → PRO conserva los ciclos restantes', bA.benefit_status === 'active' && bA.cycles_used === 2 && bA.current_plan_id === 'plan_pro', `ciclos=${bA.cycles_used}`);
  await advance(a, 31); await deliverNewPaidInvoices(a, seenA);
  bA = await benefit(A.id);
  const sAfter = await stripe.subscriptions.retrieve(a.sub.id);
  ok('   Tras el 3.er ciclo pagado → finalizado y cupón retirado en Stripe', bA.benefit_status === 'finished' && bA.cycles_used === 3 && (sAfter.discounts || []).length === 0);
  await advance(a, 31); await deliverNewPaidInvoices(a, seenA);
  const last = (await paidInvoices(a.sub.id)).pop();
  ok('   El 4.º cobro va a precio normal (19,99 €)', last.amount_paid === 1999 && (await benefit(A.id)).cycles_used === 3, `pagado=${last.amount_paid}`);

  // ---------- 6, 10, 11: Business anual, 2 cuentas, varios empleados ----------
  await rpc('founder_claim', { p_tenant: E.id });
  const e = await stripeSub(E.id, prices.business_year);
  await sendEvent('customer.subscription.created', e.sub);
  await deliverNewPaidInvoices(e, new Set());
  const bE = await benefit(E.id);
  const eInv = (await paidInvoices(e.sub.id))[0];
  const eS = await stripe.subscriptions.retrieve(e.sub.id);
  ok('6. Elegible contrata Business (anual) → 30 % el primer año (308 €), ciclos completos', bE.benefit_status === 'finished' && bE.cycles_used === 3 && eInv.amount_paid === 30800 && (eS.discounts || []).length === 0, `pagado=${eInv.amount_paid}`);
  const { count: rowsE } = await sb.from('founder_benefits').select('id', { count: 'exact', head: true }).eq('tenant_id', E.id);
  const ckE2 = await cookieFor(uE2);
  const meE2 = await api('/api/founders/me', { cookie: ckE2.cookie });
  ok('10. Dos cuentas del mismo negocio → un único beneficio compartido', rowsE === 1 && meE2.json.status === 'finished');
  ok('11. Propietario con 3 empleados → sin beneficios adicionales', (await rpc('founder_claim', { p_tenant: E.id })).reason === 'already_used');

  // ---------- 9: cancelar y volver a contratar ----------
  await rpc('founder_claim', { p_tenant: F.id });
  const f = await stripeSub(F.id, prices.pro_month);
  await sendEvent('customer.subscription.created', f.sub);
  await deliverNewPaidInvoices(f, new Set());
  const canceled = await stripe.subscriptions.cancel(f.sub.id);
  await sendEvent('customer.subscription.deleted', canceled);
  const bF = await benefit(F.id);
  const ckF = await cookieFor(uF);
  const coF = await api('/api/billing/checkout', { method: 'POST', cookie: ckF.cookie, body: { plan: 'pro', interval: 'month' } });
  ok('9. Cancela durante la promoción y vuelve a contratar → sin segundo descuento', bF.benefit_status === 'cancelled' && coF.json.founder === false && Boolean(coF.json.url), `estado=${bF.benefit_status}`);
  if (coF.json.url) { const id = coF.json.url.match(/cs_test_[A-Za-z0-9]+/)?.[0]; if (id) await stripe.checkout.sessions.expire(id).catch(() => {}); }

  // ---------- 12: cambio de propietario ----------
  await sb.from('profiles').update({ tenant_id: null }).eq('id', uA.id);
  await sb.from('profiles').update({ tenant_id: A.id, role: 'tenant_admin' }).eq('id', uA2.id);
  await rpc('founder_evaluate', { p_tenant: A.id });
  const bA2 = await benefit(A.id);
  ok('12. Cambia el propietario → conserva el historial y no obtiene otro beneficio', bA2.benefit_status === 'finished' && bA2.cycles_used === 3 && (await rpc('founder_claim', { p_tenant: A.id })).reason === 'already_used');

  // ---------- 16: el administrador intenta duplicar ----------
  const dupAdmin = await sb.rpc('founder_admin_action', { p_tenant: A.id, p_admin: superAdmin.id, p_action: 'set_eligible', p_reason: 'prueba duplicar' });
  const { count: blocked } = await sb.from('activity_log').select('id', { count: 'exact', head: true }).eq('tenant_id', A.id).eq('action', 'founder.admin_blocked');
  const direct = await sb.from('founder_benefits').update({ benefit_status: 'none', cycles_used: 0 }).eq('tenant_id', A.id);
  const second = await sb.from('founder_benefits').insert({ tenant_id: A.id });
  ok('16. Admin intenta conceder un 2.º beneficio → bloqueado y registrado', Boolean(dupAdmin.error) && blocked >= 1, dupAdmin.error?.message);
  ok('   Ni un UPDATE directo ni una 2.ª fila pueden reiniciar el beneficio', Boolean(direct.error) && Boolean(second.error), `${direct.error?.message} | ${second.error?.code}`);
  const corr = await sb.rpc('founder_admin_action', { p_tenant: B.id, p_admin: superAdmin.id, p_action: 'set_eligible', p_reason: 'corrección de prueba' });
  ok('   Corrección válida de admin (negocio sin usar) → permitida y auditada', !corr.error && corr.data?.eligibility_status === 'eligible');

  // ---------- Seguridad: el navegador no puede manipular ----------
  const ckB = await cookieFor(uB);
  const asUser = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${ckB.token}` } }, auth: { persistSession: false } });
  const u1 = await asUser.from('founder_benefits').update({ eligibility_status: 'eligible', benefit_status: 'none' }).eq('tenant_id', B.id).select();
  const u2 = await asUser.rpc('founder_claim', { p_tenant: B.id });
  const u3 = await asUser.from('founder_benefits').select('tenant_id');
  ok('   Un usuario no puede modificar su beneficio ni llamar a las funciones', (u1.error || (u1.data || []).length === 0) && Boolean(u2.error));
  ok('   Un negocio solo ve su propio beneficio', (u3.data || []).every((r) => r.tenant_id === B.id));
  const notSuper = await api('/api/admin/founders', { cookie: ckB.cookie });
  ok('   El panel de fundadores de Super Admin rechaza a un negocio', notSuper.status === 403);

  // ---------- Suscripción con cupón sin reserva → se retira ----------
  const rogue = await stripeSub(G.id, prices.pro_month);
  await sendEvent('customer.subscription.created', rogue.sub);
  const rg = await stripe.subscriptions.retrieve(rogue.sub.id);
  ok('   Suscripción con cupón sin derecho → el descuento se retira', (rg.discounts || []).length === 0);

  const hist = await sb.from('activity_log').select('action').eq('tenant_id', A.id);
  const acts = new Set((hist.data || []).map((h) => h.action));
  ok('   Historial: alta, cambio de plan, ciclos y activación registrados', ['subscription.started', 'subscription.plan_changed', 'founder.activated', 'founder.cycle_paid'].every((x) => acts.has(x)), [...acts].join(','));
}

async function cleanup() {
  console.log('\nLimpiando datos de prueba…');
  for (const c of created.clocks) await stripe.testHelpers.testClocks.del(c).catch(() => {});
  if (created.tenants.length) {
    await sb.from('founder_benefit_cycles').delete().in('tenant_id', created.tenants);
    await sb.from('activity_log').delete().in('tenant_id', created.tenants);
    await sb.from('profiles').update({ tenant_id: null }).in('tenant_id', created.tenants);
    for (const t of created.tenants) {
      for (const tb of ['appointments', 'services', 'employees', 'clients']) await sb.from(tb).delete().eq('tenant_id', t);
      const { error } = await sb.from('tenants').delete().eq('id', t);
      if (error) console.log('  no se pudo borrar tenant', t, error.message);
    }
  }
  for (const u of created.users) await sb.auth.admin.deleteUser(u).catch(() => {});
  if (created.events.length) await sb.from('stripe_events').delete().in('id', created.events);
  await sb.from('platform_settings').delete().eq('key', WH_KEY);
  // Restaurar el programa y deshacer la congelación de prueba en los negocios reales (ninguno lo ha activado)
  if (originalProgram) {
    await sb.from('founder_program').update({
      launch_at: originalProgram.launch_at, frozen_at: originalProgram.frozen_at, status: originalProgram.status,
      new_eligibility_enabled: originalProgram.new_eligibility_enabled,
    }).eq('id', true);
  }
  if (!originalProgram?.frozen_at) {
    await sb.from('founder_benefits').delete().is('activated_at', null);
    await sb.from('activity_log').delete().like('action', 'founder.%');
  }
  console.log('Limpieza terminada');
}

try {
  await main();
} catch (e) {
  console.error('ERROR', e);
  results.push({ name: 'ejecución', pass: false });
} finally {
  await cleanup();
  const passed = results.filter((r) => r.pass).length;
  console.log(`\nRESULTADO: ${passed}/${results.length} pruebas superadas`);
}

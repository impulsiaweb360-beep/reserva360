/* eslint-disable */
// Negocio de demostración SOLO para hacer capturas de la web de marketing.
// Uso:  node --env-file=.env scripts/demo-tenant.js create   |   node --env-file=.env scripts/demo-tenant.js delete
// Todos los datos son ficticios. No envía emails ni WhatsApp (escribe directamente en la base de datos).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const SLUG = 'demo-capturas-reserva360';
const EMAIL = 'demo.capturas@example.com';
const PASSWORD = 'DemoCapturas_2026!';

async function rest(path, opts = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H, ...opts });
  const t = await r.text();
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}
async function auth(path, opts = {}) {
  const r = await fetch(`${URL}/auth/v1/${path}`, { headers: H, ...opts });
  const t = await r.text();
  if (!r.ok) throw new Error(`auth ${path}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

// Hora local de Madrid -> ISO UTC
function madrid(dateStr, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const guess = new Date(`${dateStr}T${hhmm}:00Z`);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const [lh, lm] = fmt.format(guess).split(':').map(Number);
  const diff = (lh * 60 + lm) - (h * 60 + m);
  return new Date(guess.getTime() - diff * 60000).toISOString();
}

async function del() {
  const t = await rest(`tenants?slug=eq.${SLUG}&select=id`);
  for (const { id } of t) {
    for (const tbl of ['appointments', 'clients', 'services']) await rest(`${tbl}?tenant_id=eq.${id}`, { method: 'DELETE' });
    await rest(`profiles?tenant_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ tenant_id: null }) });
    await rest(`employees?tenant_id=eq.${id}`, { method: 'DELETE' });
    await rest(`tenants?id=eq.${id}`, { method: 'DELETE' });
  }
  const users = (await auth('admin/users?per_page=1000')).users || [];
  for (const u of users.filter((u) => u.email === EMAIL)) await auth(`admin/users/${u.id}`, { method: 'DELETE' });
  console.log('Demo eliminada');
}

async function create() {
  await del();
  const hours = {
    1: { enabled: true, from: '09:00', to: '20:00', breakFrom: '14:00', breakTo: '15:00' },
    2: { enabled: true, from: '09:00', to: '20:00', breakFrom: '14:00', breakTo: '15:00' },
    3: { enabled: true, from: '09:00', to: '20:00', breakFrom: '14:00', breakTo: '15:00' },
    4: { enabled: true, from: '09:00', to: '20:00', breakFrom: '14:00', breakTo: '15:00' },
    5: { enabled: true, from: '09:00', to: '20:00', breakFrom: '14:00', breakTo: '15:00' },
    6: { enabled: true, from: '10:00', to: '14:00' },
    0: { enabled: false },
  };
  const [tenant] = await rest('tenants', { method: 'POST', body: JSON.stringify({
    slug: SLUG, name: 'Clínica Fisio Demo', industry: 'Fisioterapia', logo: '🩺', color: '#4f46e5',
    email: EMAIL, phone: '600 000 000', address: 'Calle Ejemplo 1, Madrid', plan_id: 'plan_free', status: 'active', trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    business_hours: hours, vacations: [],
  }) });
  const user = await auth('admin/users', { method: 'POST', body: JSON.stringify({
    email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { first_name: 'Demo', last_name: 'Capturas', role: 'tenant_admin' },
  }) });
  const uid = user.id || user.user?.id;
  await new Promise((r) => setTimeout(r, 800));
  await rest(`profiles?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ tenant_id: tenant.id, role: 'tenant_admin', first_name: 'Demo', last_name: 'Capturas' }) });

  const emps = await rest('employees', { method: 'POST', body: JSON.stringify([
    { tenant_id: tenant.id, first_name: 'Laura', last_name: 'Martín', specialty: 'Fisioterapia deportiva', color: '#4f46e5', schedule: {} },
    { tenant_id: tenant.id, first_name: 'Carlos', last_name: 'Ruiz', specialty: 'Suelo pélvico', color: '#0ea5e9', schedule: {} },
    { tenant_id: tenant.id, first_name: 'Ana', last_name: 'Torres', specialty: 'Osteopatía', color: '#10b981', schedule: {} },
  ]) });
  const svcs = await rest('services', { method: 'POST', body: JSON.stringify([
    { tenant_id: tenant.id, name: 'Primera valoración', duration_minutes: 60, price: 50, color: '#6366f1', description: 'Evaluación inicial y plan de tratamiento' },
    { tenant_id: tenant.id, name: 'Sesión de fisioterapia', duration_minutes: 45, price: 40, color: '#0ea5e9', description: 'Sesión de seguimiento' },
    { tenant_id: tenant.id, name: 'Punción seca', duration_minutes: 30, price: 35, color: '#f59e0b', description: '' },
    { tenant_id: tenant.id, name: 'Masaje descontracturante', duration_minutes: 60, price: 45, color: '#10b981', description: '' },
  ]) });
  const names = [['María', 'López'], ['Javier', 'Gómez'], ['Lucía', 'Fernández'], ['Pablo', 'Sánchez'], ['Elena', 'Díaz'], ['Sergio', 'Moreno'], ['Carmen', 'Navarro'], ['David', 'Romero'], ['Irene', 'Castro'], ['Álvaro', 'Ortega']];
  const clients = await rest('clients', { method: 'POST', body: JSON.stringify(names.map(([f, l], i) => ({
    tenant_id: tenant.id, first_name: f, last_name: l, email: `cliente${i + 1}@example.com`, phone: `600 00 00 ${String(i).padStart(2, '0')}`,
  }))) });

  // Semana actual (lunes) en Madrid
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const dow = (local.getDay() + 6) % 7; // 0 = lunes
  const monday = new Date(local); monday.setDate(local.getDate() - dow);
  const dayStr = (offset) => { const d = new Date(monday); d.setDate(monday.getDate() + offset); return d.toISOString().slice(0, 10).replace(/T.*/, '') && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  const plan = [
    // [día(0=lun), hora, empleado, servicio, cliente]
    [0, '09:00', 0, 0, 0], [0, '10:15', 0, 1, 1], [0, '11:30', 0, 2, 2], [0, '16:00', 0, 1, 3],
    [0, '09:30', 1, 1, 4], [0, '12:00', 1, 3, 5], [0, '17:30', 1, 1, 6],
    [0, '10:00', 2, 3, 7], [0, '15:30', 2, 0, 8],
    [1, '09:00', 0, 1, 9], [1, '12:30', 0, 2, 0], [1, '17:00', 0, 0, 1], [1, '10:00', 1, 0, 2], [1, '16:00', 1, 1, 3], [1, '11:00', 2, 3, 4],
    [2, '09:15', 0, 1, 5], [2, '11:00', 0, 3, 6], [2, '18:00', 0, 1, 7], [2, '10:30', 1, 2, 8], [2, '15:00', 2, 1, 9], [2, '17:00', 2, 0, 0],
    [3, '09:00', 0, 0, 1], [3, '12:00', 0, 1, 2], [3, '16:30', 1, 3, 3], [3, '10:00', 2, 1, 4], [3, '18:00', 2, 2, 5],
    [4, '09:30', 0, 1, 6], [4, '11:00', 1, 0, 7], [4, '13:00', 1, 2, 8], [4, '16:00', 2, 1, 9], [4, '18:30', 0, 2, 0],
    [5, '10:00', 0, 1, 1], [5, '11:00', 1, 3, 2], [5, '12:30', 2, 1, 3],
  ];
  const appts = plan.map(([d, t, e, s, c], i) => {
    const svc = svcs[s];
    const start = madrid(dayStr(d), t);
    const end = new Date(new Date(start).getTime() + svc.duration_minutes * 60000).toISOString();
    const past = new Date(end) < now;
    return {
      tenant_id: tenant.id, employee_id: emps[e].id, client_id: clients[c].id, service_id: svc.id,
      start_at: start, end_at: end, status: past ? 'completed' : (i % 5 === 0 ? 'pending' : 'confirmed'),
      source: i % 3 === 0 ? 'admin' : 'online', payment_status: past ? 'paid' : 'pending', payment_amount: svc.price,
      payment_method: 'onsite', payment_date: past ? end : null,
    };
  });
  await rest('appointments', { method: 'POST', body: JSON.stringify(appts) });
  console.log(JSON.stringify({ tenant: tenant.id, slug: SLUG, email: EMAIL, appointments: appts.length }));
}

(process.argv[2] === 'delete' ? del() : create()).catch((e) => { console.error(e.message); process.exit(1); });

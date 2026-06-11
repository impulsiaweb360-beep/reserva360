/* eslint-disable */
// One-time: create or reset the Super Admin account
// Run: node --env-file=.env scripts/create-super-admin.js

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const EMAIL = 'reserva360.app@gmail.com';
const PASSWORD = 'Reserva360_79';

const authHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function listUsers() {
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: authHeaders });
  if (!r.ok) throw new Error(`listUsers: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.users || data;
}

async function createUser() {
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Super', last_name: 'Admin', role: 'super_admin' },
    }),
  });
  if (!r.ok) throw new Error(`createUser: ${r.status} ${await r.text()}`);
  return r.json();
}

async function updateUser(userId) {
  const r = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Super', last_name: 'Admin', role: 'super_admin' },
    }),
  });
  if (!r.ok) throw new Error(`updateUser: ${r.status} ${await r.text()}`);
  return r.json();
}

async function getProfile(userId) {
  const r = await fetch(`${URL}/rest/v1/profiles?id=eq.${userId}&select=*`, { headers: authHeaders });
  if (!r.ok) throw new Error(`getProfile: ${r.status} ${await r.text()}`);
  const arr = await r.json();
  return arr[0] || null;
}

async function upsertProfile(userId) {
  const body = {
    id: userId,
    email: EMAIL,
    first_name: 'Super',
    last_name: 'Admin',
    role: 'super_admin',
    tenant_id: null,
  };
  const r = await fetch(`${URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`upsertProfile: ${r.status} ${await r.text()}`);
  return r.json();
}

(async () => {
  console.log(`→ Setting up super admin ${EMAIL} ...`);
  const users = await listUsers();
  const found = users.find((u) => (u.email || '').toLowerCase() === EMAIL.toLowerCase());

  let userId;
  if (found) {
    console.log(`✓ User exists (${found.id}). Updating password + confirming email.`);
    await updateUser(found.id);
    userId = found.id;
  } else {
    console.log('→ Creating new user...');
    const created = await createUser();
    userId = created.id || created.user?.id;
    console.log(`✓ Created user ${userId}`);
  }

  console.log('→ Ensuring profile is super_admin...');
  await upsertProfile(userId);
  console.log('✓ Profile set (role=super_admin, tenant_id=null)');

  console.log('\n✅ Super Admin listo:');
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
})().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});

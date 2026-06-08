'use server';

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

// Devuelve el bootstrap data del usuario: profile + tenant. Si no tiene tenant, lo crea.
export async function bootstrapUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'NO_USER' };

  // Profile
  let { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (pErr) return { error: pErr.message };

  // Si no existe (trigger fallido), crearlo
  if (!profile) {
    const meta = user.user_metadata || {};
    const insert = {
      id: user.id,
      email: user.email,
      first_name: meta.first_name || '',
      last_name: meta.last_name || '',
      role: 'tenant_admin',
    };
    const { data, error } = await supabase.from('profiles').insert(insert).select().maybeSingle();
    if (error) return { error: error.message };
    profile = data;
  }

  // Si profile no tiene tenant_id Y rol es tenant_admin → crear tenant
  if (!profile.tenant_id && profile.role === 'tenant_admin') {
    const admin = createSupabaseAdminClient();
    const meta = user.user_metadata || {};
    const businessName = meta.business_name || `Negocio de ${profile.first_name || profile.email}`;
    const slug = (meta.business_name || profile.email.split('@')[0])
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);

    const businessHours = {
      1: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
      2: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
      3: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
      4: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
      5: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
      6: { enabled: true, from: '10:00', to: '14:00' },
      0: { enabled: false },
    };

    const { data: newTenant, error: tErr } = await admin
      .from('tenants')
      .insert({
        slug,
        name: businessName,
        industry: meta.industry || '',
        logo: '✨',
        color: '#6366f1',
        email: user.email,
        plan_id: 'plan_starter',
        status: 'active',
        business_hours: businessHours,
        vacations: [],
      })
      .select()
      .single();
    if (tErr) return { error: tErr.message };

    await admin.from('profiles').update({ tenant_id: newTenant.id }).eq('id', user.id);
    profile.tenant_id = newTenant.id;

    return { profile, tenant: newTenant };
  }

  // Fetch tenant si existe
  let tenant = null;
  if (profile.tenant_id) {
    const { data } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle();
    tenant = data;
  }

  return { profile, tenant };
}

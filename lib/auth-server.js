import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

// Devuelve { user, profile, admin } del usuario logueado o null
export async function getSessionProfile() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!profile) return null;
    return { user, profile, admin };
  } catch {
    return null;
  }
}

// Resuelve el tenant sobre el que puede actuar el usuario (admin del negocio o super admin con ?tenant_id)
export function resolveTenantId(profile, requestedTenantId) {
  if (profile.role === 'super_admin') return requestedTenantId || profile.tenant_id || null;
  return profile.tenant_id || null;
}

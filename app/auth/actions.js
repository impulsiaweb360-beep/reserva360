'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function loginAction(formData) {
  const supabase = await createSupabaseServerClient();
  const email = formData.get('email');
  const password = formData.get('password');
  const next = formData.get('next') || '/dashboard';

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }
  redirect(next);
}

export async function signupAction(formData) {
  const supabase = await createSupabaseServerClient();
  const email = formData.get('email');
  const password = formData.get('password');
  const firstName = formData.get('first_name') || '';
  const lastName = formData.get('last_name') || '';
  const businessName = formData.get('business_name') || '';

  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: { first_name: firstName, last_name: lastName, business_name: businessName, role: 'tenant_admin' },
    },
  });
  if (error) return { error: error.message };
  redirect('/auth/check-email');
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function forgotPasswordAction(formData) {
  const supabase = await createSupabaseServerClient();
  const email = formData.get('email');

  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function resetPasswordAction(formData) {
  const supabase = await createSupabaseServerClient();
  const password = formData.get('password');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect('/dashboard');
}

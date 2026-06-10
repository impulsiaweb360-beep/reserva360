'use server';

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const ADMIN_NOTIFY_EMAIL = 'reserva360.app@gmail.com';

async function notifyNewTenant({ tenant, ownerEmail, ownerFirstName, ownerLastName }) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    const publicUrl = `${base}/book/${tenant.slug}`;
    const ownerName = `${ownerFirstName || ''} ${ownerLastName || ''}`.trim() || ownerEmail;
    const createdAt = new Date().toLocaleString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <div style="text-align:center;padding:24px 0">
          <h2 style="margin:0;font-size:22px;color:#6366f1">🎉 Nuevo negocio registrado en Reserva360</h2>
          <p style="color:#64748b;margin:8px 0 0;font-size:14px">${createdAt}</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 16px">
          <p style="margin:0 0 12px;font-weight:600;font-size:16px">${tenant.name}</p>
          <p style="margin:4px 0;color:#475569"><strong>Industria:</strong> ${tenant.industry || '—'}</p>
          <p style="margin:4px 0;color:#475569"><strong>Slug:</strong> <code>${tenant.slug}</code></p>
          <p style="margin:4px 0;color:#475569"><strong>Plan:</strong> ${tenant.plan_id || 'plan_starter'}</p>
          <p style="margin:4px 0;color:#475569"><strong>URL pública:</strong><br/><a href="${publicUrl}" style="color:#6366f1;word-break:break-all">${publicUrl}</a></p>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px">
          <p style="margin:0 0 8px;font-weight:600;color:#0f172a">Propietario</p>
          <p style="margin:4px 0;color:#475569"><strong>Nombre:</strong> ${ownerName}</p>
          <p style="margin:4px 0;color:#475569"><strong>Email:</strong> ${ownerEmail}</p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px">Notificación automática de Reserva360</p>
      </div>`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [ADMIN_NOTIFY_EMAIL],
      subject: `🎉 Nuevo negocio: ${tenant.name}`,
      html,
    });
  } catch (err) {
    // No bloquear el signup si falla el email
    console.error('notifyNewTenant failed:', err?.message || err);
  }
}

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

    // Notificar al super-admin del nuevo negocio (no bloqueante)
    await notifyNewTenant({
      tenant: newTenant,
      ownerEmail: user.email,
      ownerFirstName: profile.first_name,
      ownerLastName: profile.last_name,
    });

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

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { DEFAULT_TZ, addDaysStr, todayStr, localToUtc, formatWhenLong } from '@/lib/tz';
import { getWhatsAppConfig, notifyAppointment } from '@/lib/whatsapp/notify';
import { getBaseUrl } from '@/lib/base-url';
import { planLimits } from '@/lib/plans';
import { syncProgram } from '@/lib/founders';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmail({ clientName, businessName, serviceName, employeeName, when, address }) {
  return {
    subject: `Recordatorio de tu cita mañana en ${businessName}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <div style="text-align:center;padding:24px 0">
          <h2 style="margin:0;font-size:22px">¡Hola ${clientName}!</h2>
          <p style="color:#64748b;margin:8px 0 0">Te recordamos que tienes una cita mañana</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 16px">
          <p style="margin:0 0 8px;font-weight:600">${serviceName}</p>
          <p style="margin:4px 0;color:#475569"><strong>Cuándo:</strong> ${when}</p>
          <p style="margin:4px 0;color:#475569"><strong>Con:</strong> ${employeeName}</p>
          <p style="margin:4px 0;color:#475569"><strong>Dónde:</strong> ${businessName}${address ? ` · ${address}` : ''}</p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px">Enviado por Reserva360</p>
      </div>`,
  };
}

export async function GET(request) {
  // Auth opcional con header / query secret
  const auth = request.headers.get('authorization');
  const querySecret = new URL(request.url).searchParams.get('secret');
  const ok =
    (auth && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (querySecret && querySecret === process.env.CRON_SECRET);
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  await syncProgram(supabase);

  // Ventana: todas las citas de MAÑANA (hora local del negocio, Europa/Madrid por defecto).
  // El cron de Vercel se ejecuta una vez al día, así que cubrimos el día completo siguiente.
  const tomorrow = addDaysStr(todayStr(DEFAULT_TZ), 1);
  const lower = localToUtc(tomorrow, 0, DEFAULT_TZ).toISOString();
  const upper = localToUtc(addDaysStr(tomorrow, 1), 0, DEFAULT_TZ).toISOString();

  const { data: appts, error } = await supabase
    .from('appointments')
    .select(`
      id, start_at, status, reminder_24h_sent_at,
      tenant:tenants(*),
      employee:employees(first_name, last_name),
      client:clients(first_name, last_name, email),
      service:services(name)
    `)
    .gte('start_at', lower)
    .lt('start_at', upper)
    .is('reminder_24h_sent_at', null)
    .in('status', ['pending', 'confirmed']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const a of appts || []) {
    // Recordatorios automáticos: solo planes Pro y Business (incluida la prueba)
    if (!planLimits(a.tenant).reminders) {
      results.push({ id: a.id, skipped: 'plan Free' });
      continue;
    }
    const email = a.client?.email;
    if (!email) {
      results.push({ id: a.id, skipped: 'no email' });
      continue;
    }
    const when = formatWhenLong(a.start_at, a.tenant?.timezone || DEFAULT_TZ);
    const payload = buildEmail({
      clientName: `${a.client?.first_name || ''} ${a.client?.last_name || ''}`.trim(),
      businessName: a.tenant?.name || 'tu negocio',
      serviceName: a.service?.name || 'tu servicio',
      employeeName: `${a.employee?.first_name || ''} ${a.employee?.last_name || ''}`.trim(),
      when,
      address: a.tenant?.address,
    });

    try {
      const { error: sendErr } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: [email],
        subject: payload.subject,
        html: payload.html,
      });
      if (sendErr) {
        results.push({ id: a.id, error: sendErr.message });
        continue;
      }
      await supabase
        .from('appointments')
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq('id', a.id);
      results.push({ id: a.id, sent: email });
    } catch (e) {
      results.push({ id: a.id, error: String(e?.message || e) });
    }
  }

  // ---------- Recordatorios por WhatsApp (negocios con YCloud conectado) ----------
  const whatsapp = [];
  try {
    const { data: wa, error: waErr } = await supabase
      .from('appointments')
      .select('id, tenant_id')
      .gte('start_at', lower)
      .lt('start_at', upper)
      .is('whatsapp_reminder_sent_at', null)
      .in('status', ['pending', 'confirmed']);
    if (!waErr) {
      const baseUrl = getBaseUrl(request);
      const tenantCache = new Map();
      for (const a of wa || []) {
        if (!tenantCache.has(a.tenant_id)) tenantCache.set(a.tenant_id, await getWhatsAppConfig(supabase, a.tenant_id));
        const cfg = tenantCache.get(a.tenant_id);
        if (!cfg || cfg.notify_reminder === false) continue;
        const r = await notifyAppointment(supabase, a.id, 'reminder', { baseUrl });
        if (r?.customer?.ok) {
          await supabase.from('appointments').update({ whatsapp_reminder_sent_at: new Date().toISOString() }).eq('id', a.id);
        }
        whatsapp.push({ id: a.id, ok: Boolean(r?.customer?.ok), error: r?.customer?.error || r?.skipped || null });
      }
    } else {
      whatsapp.push({ skipped: 'Falta ejecutar la migración SQL de WhatsApp' });
    }
  } catch (e) {
    whatsapp.push({ error: String(e?.message || e) });
  }

  return NextResponse.json({ checked: appts?.length || 0, results, whatsapp });
}

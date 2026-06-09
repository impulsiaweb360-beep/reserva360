import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmail({ clientName, businessName, serviceName, employeeName, when, address }) {
  return {
    subject: `Tu cita es en 2 horas - ${businessName}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <div style="text-align:center;padding:24px 0">
          <h2 style="margin:0;font-size:22px">¡Hola ${clientName}!</h2>
          <p style="color:#64748b;margin:8px 0 0">Tu cita es en <b>2 horas</b></p>
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
  const auth = request.headers.get('authorization');
  const querySecret = new URL(request.url).searchParams.get('secret');
  const ok =
    (auth && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (querySecret && querySecret === process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  // Ventana: citas entre 1h45m y 2h15m desde ahora, no canceladas, sin recordatorio 2h enviado.
  const now = new Date();
  const lower = new Date(now.getTime() + (2 * 60 - 15) * 60 * 1000).toISOString();
  const upper = new Date(now.getTime() + (2 * 60 + 15) * 60 * 1000).toISOString();

  const { data: appts, error } = await supabase
    .from('appointments')
    .select(`
      id, start_at, status, reminder_2h_sent_at,
      tenant:tenants(name, address),
      employee:employees(first_name, last_name),
      client:clients(first_name, last_name, email),
      service:services(name)
    `)
    .gte('start_at', lower)
    .lte('start_at', upper)
    .is('reminder_2h_sent_at', null)
    .in('status', ['pending', 'confirmed']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const a of appts || []) {
    const email = a.client?.email;
    if (!email) { results.push({ id: a.id, skipped: 'no email' }); continue; }
    const when = new Date(a.start_at).toLocaleString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
      if (sendErr) { results.push({ id: a.id, error: sendErr.message }); continue; }
      await supabase
        .from('appointments')
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq('id', a.id);
      results.push({ id: a.id, sent: email });
    } catch (e) {
      results.push({ id: a.id, error: String(e?.message || e) });
    }
  }

  return NextResponse.json({ checked: appts?.length || 0, results });
}

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { appointment_id } = await request.json();
    if (!appointment_id) return NextResponse.json({ error: 'Missing appointment_id' }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data: a, error } = await supabase
      .from('appointments')
      .select(`
        id, start_at, end_at, notes,
        tenant:tenants(name, address, phone, email),
        employee:employees(first_name, last_name),
        client:clients(first_name, last_name, email),
        service:services(name, duration_minutes, price)
      `)
      .eq('id', appointment_id)
      .single();
    if (error || !a) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const to = a.client?.email;
    if (!to) return NextResponse.json({ skipped: 'no email' });

    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    const manageUrl = `${base}/manage/${a.id}`;
    const when = new Date(a.start_at).toLocaleString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const clientName = `${a.client?.first_name || ''} ${a.client?.last_name || ''}`.trim();
    const emp = `${a.employee?.first_name || ''} ${a.employee?.last_name || ''}`.trim();

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <div style="text-align:center;padding:24px 0">
          <h2 style="margin:0;font-size:24px;color:#10b981">✓ Tu cita ha sido confirmada</h2>
          <p style="color:#64748b;margin:8px 0 0">Hola ${clientName}, gracias por reservar con ${a.tenant?.name}.</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 16px">
          <p style="margin:0 0 8px;font-weight:600;font-size:16px">${a.service?.name}</p>
          <p style="margin:4px 0;color:#475569"><strong>Cuándo:</strong> ${when}</p>
          <p style="margin:4px 0;color:#475569"><strong>Duración:</strong> ${a.service?.duration_minutes} min</p>
          <p style="margin:4px 0;color:#475569"><strong>Con:</strong> ${emp}</p>
          <p style="margin:4px 0;color:#475569"><strong>Dónde:</strong> ${a.tenant?.name}${a.tenant?.address ? ` · ${a.tenant?.address}` : ''}</p>
          ${a.tenant?.phone ? `<p style="margin:4px 0;color:#475569"><strong>Teléfono:</strong> ${a.tenant.phone}</p>` : ''}
          <p style="margin:4px 0;color:#475569"><strong>Precio:</strong> ${a.service?.price}€</p>
        </div>
        <div style="margin:24px 16px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff">
          <p style="margin:0 0 12px;font-weight:600;color:#0f172a">¿Necesitas hacer cambios?</p>
          <p style="margin:0 0 8px;font-size:14px"><strong>Modificar cita:</strong><br/><a href="${manageUrl}" style="color:#6366f1;word-break:break-all">${manageUrl}</a></p>
          <p style="margin:0;font-size:14px"><strong>Cancelar cita:</strong><br/><a href="${manageUrl}" style="color:#dc2626;word-break:break-all">${manageUrl}</a></p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px">Enviado por Reserva360 · Te enviaremos un recordatorio 24h antes</p>
      </div>`;

    const { error: sendErr } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [to],
      subject: `Cita confirmada en ${a.tenant?.name}`,
      html,
    });
    if (sendErr) return NextResponse.json({ error: sendErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

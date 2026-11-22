// Formulario público de captación → CRM. No crea usuarios ni negocios y no envía comunicaciones.
import { NextResponse } from 'next/server';
import { CrmError } from '@/lib/crm/server';
import { processWebSubmission, captureAdminClient } from '@/lib/crm/capture';
import { signupToken } from '@/lib/crm/capture-admin';

export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for');
  return (request.headers.get('cf-connecting-ip') || (xf ? xf.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || '').slice(0, 64) || null;
}

// Solo se aceptan envíos desde la propia web (si el navegador indica el origen)
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const o = new URL(origin).host;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const allowed = [host, process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_BASE_URL].filter(Boolean).map((h) => { try { return new URL(h.includes('://') ? h : `https://${h}`).host; } catch { return h; } });
    return allowed.includes(o);
  } catch { return false; }
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403, headers: H });
    const text = await request.text();
    if (text.length > 20000) return NextResponse.json({ error: 'Solicitud demasiado grande' }, { status: 413, headers: H });
    let body;
    try { body = JSON.parse(text || '{}'); } catch { return NextResponse.json({ error: 'Datos no válidos' }, { status: 400, headers: H }); }
    const admin = captureAdminClient();
    const res = await processWebSubmission(admin, body, { ip: clientIp(request) });
    const out = { ok: true };
    if (res.leadId && body?.request_type === 'free') out.signupUrl = `/api/capture/signup?l=${res.leadId}&s=${await signupToken(admin, res.leadId)}`;
    else if (body?.request_type === 'free') out.signupUrl = '/auth/signup';
    return NextResponse.json(out, { status: 200, headers: H });
  } catch (e) {
    if (e instanceof CrmError) return NextResponse.json({ error: e.message, field: e.extra?.field || null }, { status: e.status, headers: H });
    console.error('[captacion] error', e?.message);
    return NextResponse.json({ error: 'No hemos podido enviar tu solicitud. Inténtalo de nuevo o escríbenos por email.' }, { status: 500, headers: H });
  }
}

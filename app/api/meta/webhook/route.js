// Webhook oficial de Meta Lead Ads (Facebook + Instagram)
// GET: verificación de la suscripción (hub.challenge) · POST: notificaciones firmadas con X-Hub-Signature-256
import { timingSafeEqual } from 'crypto';
import { getVerifyToken, handleMetaWebhook } from '@/lib/crm/meta';
import { captureAdminClient } from '@/lib/crm/capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const safeEq = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export async function GET(request) {
  const u = new URL(request.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge');
  try {
    const admin = captureAdminClient();
    const expected = await getVerifyToken(admin);
    if (mode === 'subscribe' && challenge && /^[A-Za-z0-9_-]{1,200}$/.test(challenge) && safeEq(token, expected)) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (e) {
    console.error('[meta webhook verify]', e?.message);
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request) {
  const raw = await request.text(); // cuerpo exacto: la firma se calcula sobre estos bytes
  if (raw.length > 1_000_000) return Response.json({ error: 'Demasiado grande' }, { status: 413 });
  try {
    const admin = captureAdminClient();
    const r = await handleMetaWebhook(admin, raw, request.headers.get('x-hub-signature-256'));
    return Response.json(r.body, { status: r.status });
  } catch (e) {
    console.error('[meta webhook]', e?.message);
    // 500 → Meta reintentará la entrega (el procesamiento es idempotente por leadgen_id)
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}

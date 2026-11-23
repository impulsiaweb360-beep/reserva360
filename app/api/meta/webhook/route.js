// Webhook oficial de Meta Lead Ads (Facebook + Instagram)
// GET: verificación de la suscripción (hub.challenge) · POST: notificaciones firmadas con X-Hub-Signature-256
import { timingSafeEqual } from 'crypto';
import { getVerifyToken, handleMetaWebhook, metaLog } from '@/lib/crm/meta';
import { captureAdminClient } from '@/lib/crm/capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const safeEq = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

// Id de la petición en Vercel (permite cruzar con Vercel → Logs) o uno local
const reqId = (request) => request.headers.get('x-vercel-id') || request.headers.get('x-request-id') || `local-${Date.now().toString(36)}`;

export async function GET(request) {
  const u = new URL(request.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge');
  try {
    const admin = captureAdminClient();
    const expected = await getVerifyToken(admin);
    if (mode === 'subscribe' && challenge && /^[A-Za-z0-9_-]{1,200}$/.test(challenge) && safeEq(token, expected)) {
      metaLog({ req: reqId(request), stage: 'verify', http: 200, result: 'challenge_ok' });
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    metaLog({ req: reqId(request), stage: 'verify', http: 403, mode: mode || null, has_token: Boolean(token), has_challenge: Boolean(challenge), result: 'rejected' });
  } catch (e) {
    metaLog({ req: reqId(request), stage: 'verify', http: 403, result: 'error', error: String(e?.message || e).slice(0, 200) });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request) {
  const requestId = reqId(request);
  const raw = await request.text(); // cuerpo exacto: la firma se calcula sobre estos bytes
  if (raw.length > 1_000_000) {
    metaLog({ req: requestId, stage: 'rejected', http: 413, bytes: raw.length });
    return Response.json({ error: 'Demasiado grande' }, { status: 413 });
  }
  try {
    const admin = captureAdminClient();
    const r = await handleMetaWebhook(admin, raw, request.headers.get('x-hub-signature-256'), { requestId });
    return Response.json(r.body, { status: r.status });
  } catch (e) {
    // Error interno (p. ej. Supabase): 500 → Meta reintentará la entrega (procesamiento idempotente por leadgen_id)
    metaLog({ req: requestId, stage: 'error', http: 500, error: String(e?.message || e).slice(0, 300) });
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}

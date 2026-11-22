// Tarea programada: reintenta los leads de Meta que no se pudieron descargar (idempotente)
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { retryFailedMetaEvents, metaConfig } from '@/lib/crm/meta';
import { captureAdminClient } from '@/lib/crm/capture';

export const dynamic = 'force-dynamic';

const safeEq = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};
function authorized(request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (process.env.WEBHOOK_CRON_SECRET && safeEq(bearer, process.env.WEBHOOK_CRON_SECRET)) return true;
  const qs = new URL(request.url).searchParams.get('secret') || request.headers.get('x-cron-secret') || bearer;
  return Boolean(process.env.CRON_SECRET) && safeEq(qs, process.env.CRON_SECRET);
}

async function handler(request) {
  // Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
  if (!authorized(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (metaConfig().configured) {
    retryFailedMetaEvents(captureAdminClient()).catch((e) => console.error('[cron capture-retry]', e?.message));
  }
  return NextResponse.json({ accepted: true }, { status: 202 });
}
export const POST = handler;
export const GET = handler;

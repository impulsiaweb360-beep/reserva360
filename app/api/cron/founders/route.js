import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { syncProgram, resetProgramCache } from '@/lib/founders';

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

// Tarea programada: congela la elegibilidad al llegar el lanzamiento y, antes, guarda la evaluación de cada negocio.
async function run() {
  const supabase = createSupabaseAdminClient();
  resetProgramCache();
  await syncProgram(supabase);
  const { error } = await supabase.rpc('founder_evaluate_all');
  if (error) console.error('[cron founders]', error.message);
}

async function handler(request) {
  // Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
  if (!authorized(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // El trabajo es idempotente (congelar una sola vez y evaluar), por lo que una entrega repetida no duplica nada
  run().catch((e) => console.error('[cron founders]', e));
  return NextResponse.json({ accepted: true }, { status: 202 });
}

export const POST = handler;
export const GET = handler;

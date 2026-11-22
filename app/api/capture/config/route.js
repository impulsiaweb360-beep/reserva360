// Configuración pública del formulario (solo la clave pública de Cloudflare y si el formulario está activo)
import { NextResponse } from 'next/server';
import { getChannels, captureReady, captureAdminClient } from '@/lib/crm/capture';
import { turnstileConfigured } from '@/lib/crm/turnstile';

export const dynamic = 'force-dynamic';

export async function GET() {
  let enabled = false;
  try {
    const admin = captureAdminClient();
    enabled = (await captureReady(admin)) && (await getChannels(admin)).web.enabled;
  } catch { enabled = false; }
  return NextResponse.json({
    enabled,
    turnstileSiteKey: turnstileConfigured() ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

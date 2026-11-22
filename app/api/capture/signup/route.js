// «Crear cuenta gratis» tras el formulario: registra que el lead ha iniciado el registro y redirige al registro actual
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { signupToken } from '@/lib/crm/capture-admin';
import { captureAdminClient } from '@/lib/crm/capture';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = new URL(request.url);
  const dest = new URL('/auth/signup', url.origin);
  const leadId = url.searchParams.get('l') || '';
  const sig = url.searchParams.get('s') || '';
  try {
    if (UUID.test(leadId) && /^[0-9a-f]{32}$/.test(sig)) {
      const admin = captureAdminClient();
      const expected = await signupToken(admin, leadId);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
        const { data: lead } = await admin.from('crm_leads').select('id, metadata').eq('id', leadId).is('anonymized_at', null).maybeSingle();
        if (lead && !lead.metadata?.signup_started_at) {
          const at = new Date().toISOString();
          await admin.from('crm_leads').update({ metadata: { ...(lead.metadata || {}), signup_started_at: at } }).eq('id', leadId);
          await admin.from('crm_activities').insert({ lead_id: leadId, type: 'capture', description: 'Ha pulsado «Crear cuenta gratis» después de enviar el formulario (registro iniciado).', metadata: { signup_started_at: at } });
        }
      }
    }
  } catch (e) {
    console.error('[captacion signup]', e?.message);
  }
  return NextResponse.redirect(dest, 302);
}

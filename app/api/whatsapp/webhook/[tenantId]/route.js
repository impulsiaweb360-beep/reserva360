import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { verifyYCloudSignature } from '@/lib/whatsapp/ycloud';
import { getWhatsAppConfig } from '@/lib/whatsapp/notify';
import { handleInbound } from '@/lib/whatsapp/bot';
import { samePhone } from '@/lib/phone';
import { getBaseUrl } from '@/lib/base-url';
import { planLimits } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Webhook de YCloud por negocio: /api/whatsapp/webhook/<tenantId>
export async function POST(request, { params }) {
  const { tenantId } = await params;
  const raw = await request.text();
  const supabase = createSupabaseAdminClient();

  const cfg = await getWhatsAppConfig(supabase, tenantId);
  if (!cfg) return NextResponse.json({ error: 'WhatsApp no conectado' }, { status: 404 });

  if (!verifyYCloudSignature(raw, request.headers.get('ycloud-signature'), cfg.webhook_secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  // Idempotencia: YCloud puede reenviar el mismo evento
  if (event?.id) {
    const { error } = await supabase
      .from('whatsapp_events')
      .insert({ event_id: event.id, tenant_id: tenantId, event_type: event.type, payload: event });
    if (error && (error.code === '23505' || /duplicate/i.test(error.message))) {
      return new NextResponse(null, { status: 204 });
    }
  }

  try {
    if (event?.type === 'whatsapp.inbound_message.received') {
      const msg = event.whatsappInboundMessage;
      if (msg && (!msg.to || samePhone(msg.to, cfg.phone))) {
        const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
        if (tenant && tenant.status === 'active' && planLimits(tenant).whatsapp) {
          await handleInbound({ supabase, tenant, cfg, msg, baseUrl: getBaseUrl(request) });
        }
      }
    } else if (event?.type === 'whatsapp.message.updated') {
      const m = event.whatsappMessage;
      if (m?.id) {
        await supabase
          .from('whatsapp_messages')
          .update({ status: m.status, error: m.errorMessage || m.errorCode || null })
          .eq('ycloud_id', m.id);
      }
    }
  } catch (e) {
    console.error('[whatsapp webhook]', e);
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'Reserva360 WhatsApp webhook' });
}

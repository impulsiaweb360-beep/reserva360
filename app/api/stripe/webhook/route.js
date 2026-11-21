import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import {
  getWebhookSecrets, syncSubscription, applyAppointmentPayment, expireAppointmentPayment,
} from '@/lib/billing-server';
import { getBaseUrl } from '@/lib/base-url';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { syncProgram, activateFromSubscription, onSubscriptionEvent, onInvoicePaid, stripIfConsumed } from '@/lib/founders';

export const dynamic = 'force-dynamic';

// Webhook único de Stripe: suscripciones (plataforma) y Connect (?connect=1)
export async function POST(request) {
  const raw = await request.text();
  const sig = request.headers.get('stripe-signature');
  const supabase = createSupabaseAdminClient();
  const baseUrl = getBaseUrl(request);
  let stripe;
  try { stripe = getStripe(); } catch { return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 }); }

  let event = null;
  for (const secret of await getWebhookSecrets(supabase, baseUrl)) {
    try { event = stripe.webhooks.constructEvent(raw, sig, secret); break; } catch {}
  }
  if (!event) return NextResponse.json({ error: 'Firma no válida' }, { status: 400 });

  // Idempotencia
  const { error: dupErr } = await supabase.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dupErr && (dupErr.code === '23505' || /duplicate/i.test(dupErr.message))) return NextResponse.json({ received: true });

  const obj = event.data.object;
  await syncProgram(supabase);
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        if (obj.metadata?.r360_kind === 'appointment') {
          if (await applyAppointmentPayment(supabase, obj)) {
            const id = obj.metadata.appointment_id;
            try { await notifyAppointment(supabase, id, 'created', { baseUrl, notifyBusiness: true }); } catch {}
            try {
              await fetch(`${baseUrl}/api/public/send-confirmation`, {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appointment_id: id }),
              });
            } catch {}
          }
        } else if (obj.mode === 'subscription' && obj.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id);
          await syncSubscription(supabase, sub);
          // Fundadores: activa el beneficio reservado (idempotente)
          await activateFromSubscription(supabase, stripe, sub);
        }
        break;
      case 'checkout.session.expired':
        if (obj.metadata?.r360_kind === 'appointment') await expireAppointmentPayment(supabase, obj);
        // Fundadores: si el pago no se completó, se libera la reserva del beneficio
        if (obj.metadata?.r360_founder === '1' && obj.metadata?.tenant_id) {
          await supabase.rpc('founder_release', { p_tenant: obj.metadata.tenant_id, p_session: obj.id });
        }
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(supabase, obj);
        await onSubscriptionEvent(supabase, stripe, obj, event.type);
        if (event.type !== 'customer.subscription.deleted' && obj.metadata?.tenant_id) {
          await stripIfConsumed(supabase, stripe, obj.metadata.tenant_id, obj);
        }
        break;
      case 'invoice.paid':
        await onInvoicePaid(supabase, stripe, obj);
        break;
      case 'invoice.payment_failed': {
        const subId = obj.subscription || obj.parent?.subscription_details?.subscription;
        if (subId) await syncSubscription(supabase, await stripe.subscriptions.retrieve(subId));
        break;
      }
      case 'account.updated':
        await supabase.from('tenants').update({
          stripe_charges_enabled: Boolean(obj.charges_enabled),
          stripe_details_submitted: Boolean(obj.details_submitted),
        }).eq('stripe_account_id', event.account || obj.id);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('[stripe webhook]', event.type, e);
    await supabase.from('stripe_events').delete().eq('id', event.id); // permitir reintento
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

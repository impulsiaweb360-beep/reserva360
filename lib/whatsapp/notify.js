// Configuración por negocio + envío de avisos (confirmación, recordatorio, cambios, aviso al negocio)
import { sendWhatsApp } from './ycloud';
import { TEMPLATES, templateMessage } from './templates';
import { normalizePhone } from '../phone';
import { formatWhen, DEFAULT_TZ } from '../tz';
import { planLimits } from '../plans';

export async function getWhatsAppConfig(supabase, tenantId, { onlyEnabled = true } = {}) {
  try {
    let q = supabase.from('tenant_whatsapp').select('*').eq('tenant_id', tenantId);
    if (onlyEnabled) q = q.eq('enabled', true);
    const { data, error } = await q.maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

export async function logWhatsApp(supabase, row) {
  try {
    await supabase.from('whatsapp_messages').insert({ ...row, created_at: new Date().toISOString() });
  } catch {}
}

// Envía un mensaje con la cuenta del negocio y lo registra
export async function sendAndLog({ supabase, cfg, to, message, kind, appointmentId = null, direct = false }) {
  const toPhone = normalizePhone(to, cfg.country_code || '34');
  if (!toPhone) {
    await logWhatsApp(supabase, { tenant_id: cfg.tenant_id, appointment_id: appointmentId, to_phone: String(to || ''), kind, status: 'failed', error: 'Teléfono no válido' });
    return { ok: false, error: 'Teléfono no válido' };
  }
  try {
    const r = await sendWhatsApp(cfg.api_key, { from: cfg.phone, to: toPhone, ...message }, { direct });
    await logWhatsApp(supabase, {
      tenant_id: cfg.tenant_id, appointment_id: appointmentId, to_phone: toPhone, kind,
      template: message?.template?.name || null, status: r?.status || 'accepted', ycloud_id: r?.id || null,
    });
    return { ok: true, id: r?.id };
  } catch (e) {
    await logWhatsApp(supabase, {
      tenant_id: cfg.tenant_id, appointment_id: appointmentId, to_phone: toPhone, kind,
      template: message?.template?.name || null, status: 'failed', error: String(e?.message || e).slice(0, 500),
    });
    return { ok: false, error: String(e?.message || e) };
  }
}

const EVENT_MAP = {
  created: { tpl: 'confirmation', flag: 'notify_confirmation' },
  reminder: { tpl: 'reminder', flag: 'notify_reminder' },
  rescheduled: { tpl: 'rescheduled', flag: 'notify_changes' },
  cancelled: { tpl: 'cancelled', flag: 'notify_changes' },
};

// event: 'created' | 'reminder' | 'rescheduled' | 'cancelled'
export async function notifyAppointment(supabase, appointmentId, event, { baseUrl = '', notifyBusiness = false, skipCustomer = false } = {}) {
  const result = { customer: null, business: null };
  const { data: a } = await supabase
    .from('appointments')
    .select(`id, tenant_id, start_at, status,
      tenant:tenants(*),
      employee:employees(first_name, last_name),
      client:clients(first_name, last_name, phone),
      service:services(name)`)
    .eq('id', appointmentId)
    .maybeSingle();
  if (!a) return { skipped: 'appointment not found' };

  const cfg = await getWhatsAppConfig(supabase, a.tenant_id);
  if (!cfg) return { skipped: 'whatsapp not connected' };
  // WhatsApp solo en planes Pro y Business (incluida la prueba de 14 días)
  if (!planLimits(a.tenant).whatsapp) return { skipped: 'plan sin WhatsApp' };

  const tz = a.tenant?.timezone || DEFAULT_TZ;
  const when = formatWhen(a.start_at, tz);
  const clientName = `${a.client?.first_name || ''} ${a.client?.last_name || ''}`.trim() || 'cliente';
  const serviceName = a.service?.name || 'tu servicio';
  const businessName = a.tenant?.name || 'el negocio';
  const manageUrl = `${(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/manage/${a.id}`;

  const map = EVENT_MAP[event];
  if (map && !skipCustomer && cfg[map.flag] !== false && a.client?.phone) {
    const def = TEMPLATES[map.tpl];
    const params = event === 'cancelled'
      ? [a.client?.first_name || clientName, serviceName, businessName, when]
      : [a.client?.first_name || clientName, serviceName, businessName, when, manageUrl];
    result.customer = await sendAndLog({
      supabase, cfg, to: a.client.phone, message: templateMessage(def, params), kind: event, appointmentId: a.id,
    });
  }

  if (event === 'created' && notifyBusiness && cfg.notify_business && cfg.business_phone) {
    const emp = `${a.employee?.first_name || ''} ${a.employee?.last_name || ''}`.trim() || '-';
    result.business = await sendAndLog({
      supabase, cfg, to: cfg.business_phone,
      message: templateMessage(TEMPLATES.business_new, [businessName, serviceName, emp, when, clientName, a.client?.phone || '-']),
      kind: 'business_new', appointmentId: a.id,
    });
  }
  return result;
}

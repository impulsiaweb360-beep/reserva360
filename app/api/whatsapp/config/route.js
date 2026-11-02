import { NextResponse } from 'next/server';
import { getSessionProfile, resolveTenantId } from '@/lib/auth-server';
import {
  listPhoneNumbers, listTemplates, createTemplate, createWebhookEndpoint, deleteWebhookEndpoint, YCloudError,
} from '@/lib/whatsapp/ycloud';
import { TEMPLATES, templateCreateBody, templateMessage } from '@/lib/whatsapp/templates';
import { getWhatsAppConfig, sendAndLog } from '@/lib/whatsapp/notify';
import { normalizePhone, samePhone } from '@/lib/phone';
import { getBaseUrl } from '@/lib/base-url';
import { formatWhen } from '@/lib/tz';

export const dynamic = 'force-dynamic';

const mask = (k) => (k ? `••••${String(k).slice(-4)}` : '');

async function auth(request) {
  const s = await getSessionProfile();
  if (!s) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['tenant_admin', 'super_admin'].includes(s.profile.role)) {
    return { error: NextResponse.json({ error: 'Solo el administrador del negocio puede configurar WhatsApp' }, { status: 403 }) };
  }
  const url = new URL(request.url);
  const tenantId = resolveTenantId(s.profile, url.searchParams.get('tenant_id'));
  if (!tenantId) return { error: NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 }) };
  return { ...s, tenantId };
}

function publicConfig(cfg) {
  if (!cfg) return null;
  return {
    enabled: cfg.enabled,
    phone: cfg.phone,
    waba_id: cfg.waba_id,
    api_key_masked: mask(cfg.api_key),
    has_webhook: Boolean(cfg.webhook_secret),
    webhook_id: cfg.webhook_id,
    business_phone: cfg.business_phone || '',
    country_code: cfg.country_code || '34',
    notify_confirmation: cfg.notify_confirmation !== false,
    notify_reminder: cfg.notify_reminder !== false,
    notify_changes: cfg.notify_changes !== false,
    notify_business: cfg.notify_business !== false,
    updated_at: cfg.updated_at,
  };
}

async function ensureTemplates(apiKey, wabaId) {
  const results = [];
  for (const def of Object.values(TEMPLATES)) {
    try {
      await createTemplate(apiKey, templateCreateBody(def, wabaId));
      results.push({ name: def.name, created: true });
    } catch (e) {
      const msg = String(e?.message || e);
      results.push({ name: def.name, created: false, exists: /exist|duplicate|already/i.test(msg), error: msg });
    }
  }
  return results;
}

export async function GET(request) {
  const a = await auth(request);
  if (a.error) return a.error;
  const { admin, tenantId } = a;
  const webhookUrl = `${getBaseUrl(request)}/api/whatsapp/webhook/${tenantId}`;

  const { error: tableErr } = await admin.from('tenant_whatsapp').select('tenant_id').limit(1);
  if (tableErr) {
    return NextResponse.json({ migrationNeeded: true, webhookUrl, error: tableErr.message });
  }

  const cfg = await getWhatsAppConfig(admin, tenantId, { onlyEnabled: false });
  let templates = Object.values(TEMPLATES).map((d) => ({ name: d.name, label: d.label, status: cfg ? 'DESCONOCIDO' : null }));
  if (cfg?.api_key) {
    try {
      const res = await listTemplates(cfg.api_key, cfg.waba_id);
      const items = res?.items || [];
      templates = Object.values(TEMPLATES).map((d) => {
        const found = items.find((t) => t.name === d.name && (!t.language || t.language === 'es'));
        return { name: d.name, label: d.label, status: found?.status || 'NO_CREADA', reason: found?.reason || null };
      });
    } catch (e) {
      templates = templates.map((t) => ({ ...t, status: 'ERROR', reason: String(e?.message || e) }));
    }
  }

  const { data: messages } = await admin
    .from('whatsapp_messages')
    .select('id, to_phone, kind, template, status, error, created_at')
    .eq('tenant_id', tenantId)
    .neq('kind', 'bot')
    .order('created_at', { ascending: false })
    .limit(15);

  return NextResponse.json({ config: publicConfig(cfg), webhookUrl, templates, messages: messages || [] });
}

export async function POST(request) {
  const a = await auth(request);
  if (a.error) return a.error;
  const { admin, tenantId } = a;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const webhookUrl = `${getBaseUrl(request)}/api/whatsapp/webhook/${tenantId}`;
  const current = await getWhatsAppConfig(admin, tenantId, { onlyEnabled: false });

  try {
    if (action === 'connect') {
      const apiKey = String(body.api_key || '').trim() || current?.api_key;
      const countryCode = String(body.country_code || current?.country_code || '34').replace(/\D/g, '') || '34';
      const phone = normalizePhone(body.phone, countryCode);
      if (!apiKey) return NextResponse.json({ error: 'Introduce la clave de YCloud' }, { status: 400 });
      if (!phone) return NextResponse.json({ error: 'Introduce el número de WhatsApp en formato internacional (+34...)' }, { status: 400 });

      // 1) Validar clave y localizar el número en la cuenta YCloud
      let numbers;
      try {
        numbers = await listPhoneNumbers(apiKey);
      } catch (e) {
        if (e instanceof YCloudError && (e.status === 401 || e.status === 403)) {
          return NextResponse.json({ error: 'La clave de YCloud no es válida' }, { status: 400 });
        }
        throw e;
      }
      const items = numbers?.items || [];
      const match = items.find((n) => samePhone(n.phoneNumber || n.displayPhoneNumber, phone));
      if (!match) {
        const list = items.map((n) => n.phoneNumber || n.displayPhoneNumber).filter(Boolean).join(', ');
        return NextResponse.json({
          error: list
            ? `Ese número no está en tu cuenta YCloud. Números disponibles: ${list}`
            : 'Tu cuenta YCloud no tiene ningún número de WhatsApp conectado todavía.',
        }, { status: 400 });
      }

      // 2) Webhook (bot de reservas)
      let webhookId = current?.webhook_id || null;
      let webhookSecret = current?.webhook_secret || null;
      let webhookWarning = null;
      if (current?.webhook_id && current?.api_key) {
        try { await deleteWebhookEndpoint(current.api_key, current.webhook_id); } catch {}
        webhookId = null; webhookSecret = null;
      }
      try {
        const wh = await createWebhookEndpoint(apiKey, webhookUrl);
        webhookId = wh?.id || null;
        webhookSecret = wh?.secret || null;
      } catch (e) {
        webhookWarning = `No se pudo crear el webhook automáticamente (${String(e?.message || e)}). Créalo a mano en YCloud y pega el secreto.`;
      }

      // 3) Plantillas de avisos
      const templates = await ensureTemplates(apiKey, match.wabaId);

      const row = {
        tenant_id: tenantId,
        enabled: true,
        api_key: apiKey,
        phone: normalizePhone(match.phoneNumber || phone, countryCode),
        waba_id: match.wabaId || null,
        webhook_id: webhookId,
        webhook_secret: webhookSecret,
        business_phone: normalizePhone(body.business_phone, countryCode) || current?.business_phone || null,
        country_code: countryCode,
        notify_confirmation: body.notify_confirmation ?? current?.notify_confirmation ?? true,
        notify_reminder: body.notify_reminder ?? current?.notify_reminder ?? true,
        notify_changes: body.notify_changes ?? current?.notify_changes ?? true,
        notify_business: body.notify_business ?? current?.notify_business ?? true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await admin.from('tenant_whatsapp').upsert(row, { onConflict: 'tenant_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, config: publicConfig(row), templates, webhookWarning, webhookUrl });
    }

    if (!current) return NextResponse.json({ error: 'Primero conecta tu cuenta de YCloud' }, { status: 400 });

    if (action === 'save') {
      const cc = String(body.country_code || current.country_code || '34').replace(/\D/g, '') || '34';
      const patch = {
        business_phone: body.business_phone ? normalizePhone(body.business_phone, cc) : null,
        country_code: cc,
        notify_confirmation: Boolean(body.notify_confirmation),
        notify_reminder: Boolean(body.notify_reminder),
        notify_changes: Boolean(body.notify_changes),
        notify_business: Boolean(body.notify_business),
        updated_at: new Date().toISOString(),
      };
      if (body.webhook_secret) patch.webhook_secret = String(body.webhook_secret).trim();
      if (body.business_phone && !patch.business_phone) {
        return NextResponse.json({ error: 'El móvil del negocio no es válido' }, { status: 400 });
      }
      const { error } = await admin.from('tenant_whatsapp').update(patch).eq('tenant_id', tenantId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, config: publicConfig({ ...current, ...patch }) });
    }

    if (action === 'templates') {
      const templates = await ensureTemplates(current.api_key, current.waba_id);
      return NextResponse.json({ ok: true, templates });
    }

    if (action === 'test') {
      const to = normalizePhone(body.to, current.country_code || '34');
      if (!to) return NextResponse.json({ error: 'Número de prueba no válido' }, { status: 400 });
      const { data: tenant } = await admin.from('tenants').select('name, timezone').eq('id', tenantId).maybeSingle();
      const when = formatWhen(new Date(Date.now() + 24 * 3600 * 1000), tenant?.timezone || undefined);
      const r = await sendAndLog({
        supabase: admin, cfg: current, to, kind: 'test',
        message: templateMessage(TEMPLATES.confirmation, ['Prueba', 'Servicio de prueba', tenant?.name || 'tu negocio', when, `${getBaseUrl(request)}`]),
      });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'disconnect') {
      if (current.webhook_id) {
        try { await deleteWebhookEndpoint(current.api_key, current.webhook_id); } catch {}
      }
      await admin.from('tenant_whatsapp').delete().eq('tenant_id', tenantId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

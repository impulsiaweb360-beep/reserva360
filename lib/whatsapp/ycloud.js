// Cliente mínimo de YCloud (WhatsApp Business API) con fetch. Cada negocio usa SU propia clave.
import { createHmac, timingSafeEqual } from 'node:crypto';

const BASE = 'https://api.ycloud.com/v2';

export class YCloudError extends Error {
  constructor(status, data) {
    const msg = data?.error?.message || data?.message || JSON.stringify(data || {});
    super(`YCloud ${status}: ${msg}`);
    this.status = status;
    this.data = data;
  }
}

export async function ycloudFetch(apiKey, path, { method = 'POST', body } = {}) {
  if (!apiKey) throw new YCloudError(401, { message: 'Falta la clave de YCloud' });
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!r.ok) throw new YCloudError(r.status, data);
  return data;
}

// direct=true → envío síncrono (respuestas del bot); false → cola (notificaciones)
export function sendWhatsApp(apiKey, body, { direct = false } = {}) {
  return ycloudFetch(apiKey, direct ? '/whatsapp/messages/sendDirectly' : '/whatsapp/messages', { body });
}

export function listPhoneNumbers(apiKey) {
  return ycloudFetch(apiKey, '/whatsapp/phoneNumbers?page=1&limit=100', { method: 'GET' });
}

export function listTemplates(apiKey, wabaId) {
  const q = new URLSearchParams({ page: '1', limit: '100' });
  if (wabaId) q.set('filter.wabaId', wabaId);
  return ycloudFetch(apiKey, `/whatsapp/templates?${q.toString()}`, { method: 'GET' });
}

export function createTemplate(apiKey, body) {
  return ycloudFetch(apiKey, '/whatsapp/templates', { body });
}

export function createWebhookEndpoint(apiKey, url) {
  return ycloudFetch(apiKey, '/webhookEndpoints', {
    body: {
      url,
      enabledEvents: ['whatsapp.inbound_message.received', 'whatsapp.message.updated'],
      description: 'Reserva360 - bot de reservas y avisos',
    },
  });
}

export function deleteWebhookEndpoint(apiKey, id) {
  return ycloudFetch(apiKey, `/webhookEndpoints/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Cabecera: YCloud-Signature: t=UNIX_SECONDS,s=HEX  →  HMAC-SHA256(secret, `${t}.${rawBody}`)
export function verifyYCloudSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(',').map((x) => {
      const i = x.indexOf('=');
      return [x.slice(0, i).trim(), x.slice(i + 1).trim()];
    })
  );
  const t = parts.t;
  const s = parts.s;
  if (!t || !s || !/^\d+$/.test(t) || !/^[a-f0-9]{64}$/i.test(s)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  const supplied = Buffer.from(s, 'hex');
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

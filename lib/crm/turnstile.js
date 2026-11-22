// Verificación de Cloudflare Turnstile en servidor (opcional: si no hay claves, el formulario usa solo la protección invisible)
import { randomUUID } from 'crypto';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const turnstileConfigured = () => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

// Devuelve { ok, codes }. Nunca registra el token ni la clave.
export async function verifyTurnstile(token, { remoteip, secret = process.env.TURNSTILE_SECRET_KEY, expectedAction = 'lead_form', expectedHostnames = null } = {}) {
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== 'string' || !token || token.length > 2048) return { ok: false, codes: ['missing-input-response'] };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: remoteip || undefined, idempotency_key: randomUUID() }),
      cache: 'no-store',
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const data = r.ok ? await r.json() : { success: false, 'error-codes': ['siteverify-http-error'] };
    if (!data.success) return { ok: false, codes: data['error-codes'] || [] };
    // Las claves de prueba oficiales no devuelven action y usan hostname example.com
    const isDummy = String(secret).startsWith('1x0000000000000000000000000000000');
    if (!isDummy && data.action && expectedAction && data.action !== expectedAction) return { ok: false, codes: ['action-mismatch'] };
    const hosts = expectedHostnames || (process.env.TURNSTILE_EXPECTED_HOSTNAMES || '').split(',').map((h) => h.trim()).filter(Boolean);
    if (!isDummy && hosts.length && data.hostname && !hosts.includes(data.hostname)) return { ok: false, codes: ['hostname-mismatch'] };
    return { ok: true };
  } catch {
    return { ok: false, codes: ['internal-error'] };
  }
}

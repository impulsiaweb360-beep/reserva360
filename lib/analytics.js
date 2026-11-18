'use client';

// Envío de eventos a la capa de datos de Google Tag Manager.
// Nunca enviamos datos personales (nombres, emails, teléfonos, ids de citas).

const ALLOWED = /^[a-z0-9_]+$/;

export function track(event, params = {}) {
  if (typeof window === 'undefined' || !ALLOWED.test(event)) return;
  const clean = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && /@|\+?\d[\d\s]{7,}/.test(v)) continue; // descarta emails/teléfonos por seguridad
    clean[k] = typeof v === 'string' ? v.slice(0, 100) : v;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...clean });
}

// Dispara un evento solo una vez por navegador (p. ej. primera reserva)
export function trackOnce(key, event, params) {
  try {
    const k = `r360_evt_${key}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, '1');
  } catch {
    /* modo privado */
  }
  track(event, params);
}

export function pageType(path = '') {
  if (path === '/') return 'home';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/dashboard')) return 'app';
  if (path.startsWith('/book')) return 'booking';
  if (path.startsWith('/manage')) return 'manage';
  if (/^\/(software|programa|agenda)-/.test(path)) return 'sector';
  return 'other';
}

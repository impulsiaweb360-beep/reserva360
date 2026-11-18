'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { GTM_ID } from '@/lib/site';
import { track, pageType } from '@/lib/analytics';

const KEY = 'r360_cookie_consent'; // 'granted' | 'denied'

function loadGtm() {
  if (typeof window === 'undefined' || !GTM_ID || window.__r360GtmLoaded) return;
  window.__r360GtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(s);
}

function gtagConsent(mode, granted) {
  window.dataLayer = window.dataLayer || [];
  // Consent Mode v2: mismo formato que gtag('consent', ...)
  // eslint-disable-next-line prefer-rest-params
  function gtag() { window.dataLayer.push(arguments); }
  const v = granted ? 'granted' : 'denied';
  gtag('consent', mode, {
    analytics_storage: v,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

export function openCookieSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('r360-open-cookies'));
}

export default function ConsentManager() {
  const pathname = usePathname();
  const [choice, setChoice] = useState(undefined); // undefined = cargando
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let c = null;
    try { c = localStorage.getItem(KEY); } catch { /* */ }
    gtagConsent('default', c === 'granted');
    setChoice(c);
    if (c === 'granted') loadGtm();
    const onOpen = () => setOpen(true);
    window.addEventListener('r360-open-cookies', onOpen);
    return () => window.removeEventListener('r360-open-cookies', onOpen);
  }, []);

  // Página vista (también en navegación interna)
  useEffect(() => {
    if (!pathname) return;
    track('r360_page_view', { page_path: pathname, page_type: pageType(pathname) });
  }, [pathname]);

  const decide = (granted) => {
    const v = granted ? 'granted' : 'denied';
    try { localStorage.setItem(KEY, v); } catch { /* */ }
    gtagConsent('update', granted);
    setChoice(v);
    setOpen(false);
    if (granted) loadGtm();
  };

  // No mostrar el aviso dentro de la app privada ni en las páginas de reserva de los negocios
  const hiddenRoute = /^\/(dashboard|book|manage)/.test(pathname || '');
  const show = open || (choice === null && !hiddenRoute);
  if (!show) return null;

  return (
    <div role="dialog" aria-live="polite" aria-label="Preferencias de cookies" data-testid="cookie-banner"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:inset-x-6 md:p-5">
      <p className="text-sm text-slate-700">
        Usamos cookies de analítica (Google Analytics a través de Google Tag Manager) solo si nos das permiso, para saber qué
        páginas se visitan y mejorar la web. No usamos cookies publicitarias. Más información en la{' '}
        <Link href="/cookies" className="font-medium text-indigo-600 underline">política de cookies</Link>.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => decide(false)} data-testid="cookie-reject"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Rechazar
        </button>
        <button type="button" onClick={() => decide(true)} data-testid="cookie-accept"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Aceptar analítica
        </button>
      </div>
    </div>
  );
}

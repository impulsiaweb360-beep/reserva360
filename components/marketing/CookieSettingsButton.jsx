'use client';

import { openCookieSettings } from './ConsentManager';

export default function CookieSettingsButton({ className = '' }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className} data-testid="cookie-settings-open">
      Configurar cookies
    </button>
  );
}

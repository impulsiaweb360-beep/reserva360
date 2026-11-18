import { ArrowRight } from 'lucide-react';
import TrackedLink from './TrackedLink';
import { SIGNUP_PATH, EARLY_ACCESS } from '@/lib/site';

export function PrimaryCta({ location, label = 'Prueba Reserva360 gratis', className = '' }) {
  return (
    <TrackedLink
      href={SIGNUP_PATH}
      location={location}
      label={label}
      data-testid={`cta-signup-${location}`}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${className}`}
    >
      {label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </TrackedLink>
  );
}

export function SecondaryCta({ href = '/#como-funciona', label = 'Descubre cómo funciona', location }) {
  return (
    <TrackedLink
      href={href}
      event="cta_secondary_click"
      location={location}
      label={label}
      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      {label}
    </TrackedLink>
  );
}

export function CtaNote({ className = '' }) {
  return <p className={`text-sm text-slate-500 ${className}`}>{EARLY_ACCESS.short} · {EARLY_ACCESS.noCard}</p>;
}

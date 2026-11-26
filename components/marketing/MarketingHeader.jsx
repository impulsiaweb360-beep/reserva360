import Link from 'next/link';
import { Menu, ChevronDown } from 'lucide-react';
import { SECTORS } from '@/lib/marketing/sectors';
import { LOGIN_PATH } from '@/lib/site';
import TrackedLink from './TrackedLink';
import { EarlyAccessStrip } from './EarlyAccess';

export function Logo({ className = 'h-8 w-auto' }) {
  return (
    <img src="/brand/logo-reserva360.webp" width={399} height={96} alt="Reserva360" className={className} decoding="async" fetchPriority="high" />
  );
}

const NAV = [
  { href: '/#funcionalidades', label: 'Funcionalidades' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/asistente-virtual-reservas-whatsapp', label: 'WhatsApp' },
  { href: '/#precios', label: 'Precios' },
  { href: '/blog', label: 'Blog' },
];

export default function MarketingHeader() {
  return (
    <>
      <EarlyAccessStrip />
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" aria-label="Reserva360, ir al inicio" className="shrink-0"><Logo /></Link>

          <nav aria-label="Principal" className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            <a href="/#funcionalidades" className="hover:text-slate-900">Funcionalidades</a>
            <div className="group relative">
              <button type="button" className="inline-flex items-center gap-1 hover:text-slate-900" aria-haspopup="true">
                Sectores <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <ul className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {SECTORS.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/${s.slug}`} className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-indigo-700">{s.menuLabel}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {NAV.slice(1).map((n) => <a key={n.href} href={n.href} className="hover:text-slate-900" data-testid={n.label === 'WhatsApp' ? 'nav-whatsapp' : undefined}>{n.label}</a>)}
          </nav>

          <div className="flex items-center gap-2">
            <Link href={LOGIN_PATH} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-block">Iniciar sesión</Link>
            <TrackedLink href="/auth/signup" location="header" label="Empezar gratis" data-testid="cta-signup-header"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Empezar gratis
            </TrackedLink>
            <details className="relative lg:hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200" aria-label="Abrir menú">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </summary>
              <nav aria-label="Menú móvil" className="absolute right-0 top-12 z-50 max-h-[75vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <ul className="space-y-1 text-sm">
                  {NAV.map((n) => <li key={n.href}><a href={n.href} className="block rounded-lg px-3 py-2 font-medium hover:bg-slate-50">{n.label}</a></li>)}
                  <li className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Sectores</li>
                  {SECTORS.map((s) => <li key={s.slug}><Link href={`/${s.slug}`} className="block rounded-lg px-3 py-2 hover:bg-slate-50">{s.menuLabel}</Link></li>)}
                  <li className="border-t border-slate-100 pt-2"><Link href={LOGIN_PATH} className="block rounded-lg px-3 py-2 font-medium hover:bg-slate-50">Iniciar sesión</Link></li>
                </ul>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}

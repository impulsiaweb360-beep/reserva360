import Link from 'next/link';
import { SECTORS } from '@/lib/marketing/sectors';
import { BLOG_CATEGORIES } from '@/lib/marketing/blog';
import { SITE_EMAIL, LOGIN_PATH, SIGNUP_PATH } from '@/lib/site';
import { Logo } from './MarketingHeader';
import CookieSettingsButton from './CookieSettingsButton';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-2 md:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo className="h-8 w-auto" />
          <p className="mt-4 max-w-sm text-sm text-slate-600">
            Software de gestión de citas y reservas online para negocios que trabajan con cita previa: agenda, clientes, empleados y recordatorios en una sola plataforma.
          </p>
          <p className="mt-4 text-sm text-slate-600">Contacto: <a href={`mailto:${SITE_EMAIL}`} className="font-medium text-indigo-600 hover:underline">{SITE_EMAIL}</a></p>
        </div>
        <nav aria-label="Sectores">
          <p className="text-sm font-semibold text-slate-900">Sectores</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {SECTORS.map((s) => <li key={s.slug}><Link href={`/${s.slug}`} className="hover:text-indigo-700">{s.menuLabel}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Recursos">
          <p className="text-sm font-semibold text-slate-900">Recursos</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link href="/blog" className="hover:text-indigo-700">Blog</Link></li>
            {BLOG_CATEGORIES.map((c) => <li key={c.slug}><Link href={`/blog/categoria/${c.slug}`} className="hover:text-indigo-700">{c.name}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Producto">
          <p className="text-sm font-semibold text-slate-900">Producto</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link href="/#funcionalidades" className="hover:text-indigo-700">Funcionalidades</Link></li>
            <li><Link href="/#precios" className="hover:text-indigo-700">Precios</Link></li>
            <li><Link href="/#faq" className="hover:text-indigo-700">Preguntas frecuentes</Link></li>
            <li><Link href={SIGNUP_PATH} className="hover:text-indigo-700">Crear cuenta</Link></li>
            <li><Link href={LOGIN_PATH} className="hover:text-indigo-700">Iniciar sesión</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-slate-200">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 md:flex-row md:px-6">
          <p>© {new Date().getFullYear()} Reserva360</p>
          <div className="flex items-center gap-4">
            <Link href="/cookies" className="hover:text-slate-800">Política de cookies</Link>
            <CookieSettingsButton className="hover:text-slate-800" />
          </div>
        </div>
      </div>
    </footer>
  );
}

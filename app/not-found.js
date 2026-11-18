import Link from 'next/link';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { SECTORS } from '@/lib/marketing/sectors';

export const metadata = {
  title: { absolute: 'Página no encontrada | Reserva360' },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />
      <main id="contenido" className="container mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Error 404</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">No encontramos esta página</h1>
        <p className="mt-4 text-slate-600">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">Ir al inicio</Link>
          <Link href="/blog" className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50">Ver el blog</Link>
        </div>
        <h2 className="mt-14 text-lg font-semibold">Quizá buscabas</h2>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {SECTORS.map((s) => <li key={s.slug}><Link href={`/${s.slug}`} className="text-indigo-700 hover:underline">{s.h1}</Link></li>)}
        </ul>
      </main>
      <MarketingFooter />
    </div>
  );
}

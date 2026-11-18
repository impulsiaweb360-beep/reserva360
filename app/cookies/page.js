import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import CookieSettingsButton from '@/components/marketing/CookieSettingsButton';
import { pageMetadata, SITE_EMAIL } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Política de cookies | Reserva360',
  description: 'Qué cookies usa la web de Reserva360, para qué sirven y cómo cambiar tus preferencias.',
  path: '/cookies',
});

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />
      <main id="contenido" className="container mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Política de cookies</h1>
        <p className="mt-4 text-slate-700">Esta página explica qué cookies y tecnologías similares usa la web de Reserva360 y cómo puedes gestionarlas.</p>

        <h2 className="mt-10 text-2xl font-bold">Cookies técnicas (necesarias)</h2>
        <p className="mt-3 text-slate-700">Son imprescindibles para que la web funcione y no requieren consentimiento:</p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
          <li><strong>Sesión de usuario</strong> (cookies de Supabase con prefijo <code>sb-</code>): mantienen iniciada tu sesión en el panel.</li>
          <li><strong>r360_cookie_consent</strong> (almacenamiento local del navegador): guarda tu elección sobre las cookies de analítica.</li>
        </ul>

        <h2 className="mt-10 text-2xl font-bold">Cookies de analítica (opcionales)</h2>
        <p className="mt-3 text-slate-700">
          Solo si las aceptas, cargamos Google Tag Manager y Google Analytics 4 para conocer de forma agregada qué páginas se visitan, de dónde
          llegan las visitas y qué botones se usan. Estas herramientas pueden instalar cookies como <code>_ga</code> y <code>_ga_*</code>.
          No enviamos a estas herramientas datos personales como tu nombre, email o teléfono.
        </p>
        <p className="mt-3 text-slate-700">No usamos cookies publicitarias ni de personalización de anuncios.</p>

        <h2 className="mt-10 text-2xl font-bold">Cómo cambiar tus preferencias</h2>
        <p className="mt-3 text-slate-700">Puedes cambiar tu elección en cualquier momento:</p>
        <CookieSettingsButton className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" />
        <p className="mt-4 text-slate-700">También puedes borrar las cookies desde la configuración de tu navegador.</p>

        <h2 className="mt-10 text-2xl font-bold">Contacto</h2>
        <p className="mt-3 text-slate-700">Para cualquier duda, escríbenos a <a href={`mailto:${SITE_EMAIL}`} className="font-medium text-indigo-600 hover:underline">{SITE_EMAIL}</a>.</p>
      </main>
      <MarketingFooter />
    </div>
  );
}

import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LeadCaptureForm from '@/components/marketing/LeadCaptureForm';
import { pageMetadata } from '@/lib/site';
import { CalendarCheck, Video, Sparkles } from 'lucide-react';

export const metadata = pageMetadata({
  title: 'Solicita una demostración gratuita | Reserva360',
  description: 'Te enseñamos en 20 minutos cómo funciona Reserva360: reservas online 24/7, recordatorios por WhatsApp y agenda para todo tu equipo.',
  path: '/demo',
});

const POINTS = [
  { icon: Video, title: 'Demo en directo de 20 minutos', text: 'Por videollamada, a la hora que mejor te venga.' },
  { icon: CalendarCheck, title: 'Adaptada a tu negocio', text: 'Configuramos un ejemplo con tus servicios y horarios.' },
  { icon: Sparkles, title: 'Sin compromiso', text: 'Resolvemos tus dudas y decides con calma.' },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />
      <main id="contenido" className="bg-gradient-to-b from-indigo-50/60 to-white">
        <div className="container mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-800">Demostración gratuita</span>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">Descubre Reserva360 con tu propio negocio</h1>
              <p className="mt-4 text-lg text-slate-700">Déjanos tus datos y te contactamos para preparar una demo personalizada.</p>
              <ul className="mt-8 space-y-5">
                {POINTS.map((p) => (
                  <li key={p.title} className="flex gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200"><p.icon className="h-5 w-5 text-indigo-600" aria-hidden="true" /></span>
                    <span><strong className="block text-slate-900">{p.title}</strong><span className="text-slate-600">{p.text}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <LeadCaptureForm defaultRequest="demo" page="/demo" idPrefix="demo" />
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

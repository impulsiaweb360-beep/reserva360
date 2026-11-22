import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import LeadCaptureForm from '@/components/marketing/LeadCaptureForm';
import { pageMetadata, SITE_EMAIL } from '@/lib/site';
import { Mail, MessageCircle, Clock } from 'lucide-react';

export const metadata = pageMetadata({
  title: 'Contacto | Reserva360',
  description: 'Escríbenos para resolver tus dudas sobre Reserva360, la agenda online con reservas y recordatorios por WhatsApp para tu negocio.',
  path: '/contacto',
});

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />
      <main id="contenido" className="container mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Hablemos de tu negocio</h1>
            <p className="mt-4 text-lg text-slate-700">Cuéntanos cómo trabajas y te explicamos cómo Reserva360 puede ayudarte a llenar la agenda y reducir las ausencias.</p>
            <ul className="mt-8 space-y-4 text-slate-700">
              <li className="flex gap-3"><Clock className="mt-0.5 h-5 w-5 flex-none text-indigo-600" aria-hidden="true" /> Respondemos en menos de 24 horas laborables.</li>
              <li className="flex gap-3"><MessageCircle className="mt-0.5 h-5 w-5 flex-none text-indigo-600" aria-hidden="true" /> Si lo prefieres, te enseñamos la app en una demo de 20 minutos.</li>
              <li className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 flex-none text-indigo-600" aria-hidden="true" /> También puedes escribirnos a <a href={`mailto:${SITE_EMAIL}`} className="font-medium text-indigo-600 hover:underline">{SITE_EMAIL}</a>.</li>
            </ul>
          </div>
          <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <LeadCaptureForm defaultRequest="info" page="/contacto" idPrefix="contacto" />
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

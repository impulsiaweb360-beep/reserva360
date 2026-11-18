import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ChevronRight, Activity, Scissors, Sparkles, PawPrint, Apple, Dumbbell, Stethoscope, CalendarDays, Smartphone, Users2, MessageCircle } from 'lucide-react';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { PrimaryCta, SecondaryCta, CtaNote } from '@/components/marketing/CtaButtons';
import { EarlyAccessCard } from '@/components/marketing/EarlyAccess';
import { BrowserShot, PhoneShot } from '@/components/marketing/Screenshot';
import Faq from '@/components/marketing/Faq';
import JsonLd, { breadcrumbLd, faqLd } from '@/components/marketing/JsonLd';
import { SECTORS, getSector } from '@/lib/marketing/sectors';
import { POSTS } from '@/lib/marketing/blog';
import { pageMetadata } from '@/lib/site';

const ICONS = { Activity, Scissors, Sparkles, PawPrint, Apple, Dumbbell, Stethoscope };

export const dynamicParams = false;

export function generateStaticParams() {
  return SECTORS.map((s) => ({ sector: s.slug }));
}

export function generateMetadata({ params }) {
  const s = getSector(params.sector);
  if (!s) return {};
  return { ...pageMetadata({ title: s.title, description: s.description, path: `/${s.slug}` }), keywords: s.keywords };
}

export default function SectorPage({ params }) {
  const s = getSector(params.sector);
  if (!s) notFound();
  const Icon = ICONS[s.icon] || CalendarDays;
  const related = SECTORS.filter((x) => x.slug !== s.slug);
  const posts = [...POSTS.filter((p) => p.sector === s.slug), ...POSTS.filter((p) => !p.sector)].slice(0, 3);
  const loc = `sector-${s.slug}`;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <JsonLd data={[breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: s.name, path: `/${s.slug}` }]), faqLd(s.faqs)]} />
      <MarketingHeader />
      <main id="contenido">
        {/* HERO */}
        <section className="bg-gradient-to-b from-indigo-50/70 to-white">
          <div className="container mx-auto px-4 pb-14 pt-8 md:px-6 md:pb-20">
            <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
              <ol className="flex items-center gap-1">
                <li><Link href="/" className="hover:text-indigo-700">Inicio</Link></li>
                <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                <li aria-current="page" className="text-slate-700">{s.name}</li>
              </ol>
            </nav>
            <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" /> Reserva360 para {s.name.toLowerCase()}
                </span>
                <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">{s.h1}</h1>
                <p className="mt-5 text-lg text-slate-600">{s.lead}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <PrimaryCta location={`${loc}-hero`} />
                  <SecondaryCta href="#como-reservan" location={`${loc}-hero`} label="Ver cómo reservan tus clientes" />
                </div>
                <CtaNote className="mt-4" />
              </div>
              <BrowserShot name="panel-calendario-semanal" priority alt={`Calendario semanal de Reserva360 con la agenda de un profesional, útil para ${s.name.toLowerCase()}`} />
            </div>
          </div>
        </section>

        {/* PROBLEMAS */}
        <section aria-labelledby="problemas" className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 id="problemas" className="max-w-3xl text-3xl font-bold tracking-tight">{s.problemsTitle}</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {s.problems.map((p) => (
                <div key={p.t} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CÓMO AYUDA */}
        <section aria-labelledby="ayuda" className="bg-slate-50 py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 id="ayuda" className="max-w-3xl text-3xl font-bold tracking-tight">{s.helpTitle}</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {s.help.map((p) => (
                <div key={p.t} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="flex items-center gap-2 font-semibold"><Check className="h-5 w-5 text-emerald-600" aria-hidden="true" />{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 md:flex-row md:items-center" data-testid="sector-whatsapp">
              <MessageCircle className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-slate-900">Citas también desde el WhatsApp Business de tu negocio</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  En el plan Pro conectas el número de WhatsApp Business de tu {s.name === 'Clínicas y consultas' ? 'clínica' : 'negocio'} y tus clientes
                  pueden reservar, consultar, cambiar o cancelar sus citas con menús y botones. Además reciben la confirmación y el recordatorio por WhatsApp,
                  y tú un aviso de cada reserva nueva.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FUNCIONES + CONFIGURACIÓN */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto grid gap-12 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{s.featuresTitle}</h2>
              <ul className="mt-6 space-y-3">
                {s.features.map((f) => <li key={f} className="flex gap-3 text-slate-700"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>)}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Cómo se configura tu negocio</h2>
              <ol className="mt-6 space-y-4">
                {s.setup.map((step, i) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
                    <span className="pt-1 text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* CÓMO RESERVAN */}
        <section id="como-reservan" aria-labelledby="como-reservan-titulo" className="scroll-mt-24 bg-gradient-to-b from-slate-50 to-white py-16 md:py-20">
          <div className="container mx-auto grid items-center gap-12 px-4 md:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-4">
              <PhoneShot name="reserva-movil-servicios" alt="Primer paso de la reserva online en el móvil: elegir el servicio" />
              <PhoneShot name="reserva-movil-fecha" alt="Paso de la reserva online en el móvil: elegir el día disponible" className="mt-10" />
            </div>
            <div>
              <h2 id="como-reservan-titulo" className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                <Smartphone className="h-7 w-7 text-indigo-600" aria-hidden="true" /> Cómo reservan tus clientes
              </h2>
              <p className="mt-4 leading-relaxed text-slate-700">{s.bookingFlow}</p>
              <h2 className="mt-10 flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                <Users2 className="h-7 w-7 text-indigo-600" aria-hidden="true" /> {s.teamTitle}
              </h2>
              <p className="mt-4 leading-relaxed text-slate-700">{s.team}</p>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 md:px-6"><EarlyAccessCard location={`${loc}-early-access`} /></div>

        {/* FAQ */}
        <section aria-labelledby="faq-sector" className="py-16 md:py-20">
          <div className="container mx-auto max-w-3xl px-4 md:px-6">
            <h2 id="faq-sector" className="text-center text-3xl font-bold tracking-tight">Preguntas frecuentes sobre Reserva360 para {s.name.toLowerCase()}</h2>
            <div className="mt-10"><Faq faqs={s.faqs} /></div>
          </div>
        </section>

        {/* ENLACES INTERNOS */}
        <section aria-labelledby="mas" className="border-t border-slate-200 bg-slate-50 py-14">
          <div className="container mx-auto grid gap-10 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <h2 id="mas" className="text-xl font-bold">Reserva360 en otros sectores</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}><Link href={`/${r.slug}`} className="text-sm text-indigo-700 hover:underline">{r.h1}</Link></li>
                ))}
              </ul>
              <p className="mt-4 text-sm"><Link href="/" className="font-medium text-indigo-700 hover:underline">Ver todas las funcionalidades de Reserva360</Link></p>
            </div>
            <div>
              <h2 className="text-xl font-bold">Artículos que te pueden interesar</h2>
              <ul className="mt-4 space-y-3">
                {posts.map((p) => (
                  <li key={p.slug}><Link href={`/blog/${p.slug}`} className="text-sm font-medium text-slate-800 hover:text-indigo-700">{p.title}</Link></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 text-center md:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Prueba Reserva360 en tu negocio</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">Configura tus servicios y horarios en unos minutos y comparte tu enlace de reservas.</p>
            <div className="mt-8 flex justify-center"><PrimaryCta location={`${loc}-final`} /></div>
            <CtaNote className="mt-4" />
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

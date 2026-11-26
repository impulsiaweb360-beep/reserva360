import Link from 'next/link';
import { Check, ChevronRight, MessageCircle, CalendarCheck, BellRing, RefreshCw, ShieldCheck, Clock, MousePointerClick, CalendarDays, UserX, CircleCheck, CalendarClock, CalendarX2 } from 'lucide-react';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { PrimaryCta, SecondaryCta, CtaNote } from '@/components/marketing/CtaButtons';
import { EarlyAccessCard } from '@/components/marketing/EarlyAccess';
import Faq from '@/components/marketing/Faq';
import JsonLd, { breadcrumbLd, faqLd } from '@/components/marketing/JsonLd';
import { SECTORS } from '@/lib/marketing/sectors';
import { getPost } from '@/lib/marketing/blog';
import { pageMetadata } from '@/lib/site';

// Landing comercial del asistente de reservas por WhatsApp.
// Importante: el asistente es un flujo de botones y menús (no IA generativa). No prometer funciones que no existen.
const PATH = '/asistente-virtual-reservas-whatsapp';
const NAME = 'Asistente de reservas por WhatsApp';
const LOC = 'landing-whatsapp';

export const metadata = {
  ...pageMetadata({
    title: 'Asistente virtual y chatbot de gestión de citas por WhatsApp | Reserva360',
    description: 'Automatiza la agendación de citas por WhatsApp 24/7 con asistente virtual. Tus clientes reservan, confirman y reprograman sin llamadas.',
    path: PATH,
  }),
  keywords: ['asistente virtual reservas whatsapp', 'chatbot citas whatsapp', 'reservas automáticas por whatsapp', 'agendar citas por whatsapp', 'app de gestión de citas'],
};

const PROBLEMS = [
  { t: 'Conversaciones eternas para dar una hora', d: '"¿Tienes el jueves?" "No, ¿y el viernes?"… Cada cita son varios mensajes de ida y vuelta que te interrumpen mientras trabajas.' },
  { t: 'Mensajes fuera de horario', d: 'Muchos clientes escriben por la noche o el fin de semana. Si contestas al día siguiente, algunos ya han reservado en otro sitio.' },
  { t: 'Citas apuntadas a mano', d: 'Copiar del chat a la agenda provoca errores: horas duplicadas, nombres mal escritos o citas que nunca llegan a apuntarse.' },
  { t: 'Clientes que no aparecen', d: 'Sin recordatorio, los olvidos se convierten en huecos vacíos que ya no puedes recuperar.' },
];

const STEPS = [
  { t: 'El cliente escribe a tu WhatsApp Business', d: 'Basta con un "Hola". El asistente responde al momento, a cualquier hora, con un menú de botones: reservar cita, ver sus citas o información.' },
  { t: 'Elige servicio y profesional', d: 'Aparecen tus servicios con su duración y precio, y el profesional que prefiera (o "cualquiera").' },
  { t: 'Elige día y hora libres', d: 'Solo se muestran los huecos realmente disponibles según tus horarios, pausas, vacaciones y citas ya reservadas.' },
  { t: 'Confirma con un botón', d: 'Escribe su nombre, revisa el resumen y pulsa "Confirmar". Antes de guardar, el sistema vuelve a comprobar que la hora sigue libre.' },
  { t: 'Todo queda en tu agenda', d: 'La cita aparece al instante en tu calendario, el cliente recibe la confirmación por WhatsApp y tú un aviso de la reserva nueva.' },
];

// Avisos automáticos que envía Reserva360 por WhatsApp (plantillas r360_* en lib/whatsapp/templates.js)
const MESSAGES = [
  { icon: CircleCheck, t: 'Confirmación de cita', d: 'Nada más reservar, el cliente recibe por WhatsApp el resumen: servicio, profesional, día y hora.', when: 'Al reservar' },
  { icon: BellRing, t: 'Recordatorio 24 horas antes', d: 'El día anterior le recordamos la cita, con un enlace para cambiarla o cancelarla si le surge algo.', when: '24 h antes' },
  { icon: CalendarClock, t: 'Cita cambiada', d: 'Si la cita se cambia de día u hora, el cliente recibe al momento la nueva fecha para que no haya confusiones.', when: 'Al cambiarla' },
  { icon: CalendarX2, t: 'Cita cancelada', d: 'Si la cita se cancela, el cliente recibe la confirmación de la cancelación y el hueco queda libre en tu agenda.', when: 'Al cancelarla' },
];

const BENEFITS = [
  { icon: Clock, t: 'Agenda abierta 24/7', d: 'Tus clientes reservan a las 23:00 o un domingo, sin que tengas que coger el móvil.' },
  { icon: BellRing, t: 'Recordatorios automáticos', d: 'Confirmación, recordatorio 24 horas antes y avisos de cita cambiada o cancelada por WhatsApp, además del email.' },
  { icon: UserX, t: 'Menos ausencias (no-shows)', d: 'El recordatorio incluye un enlace para cambiar o cancelar, así el hueco se libera a tiempo para otro cliente.' },
  { icon: RefreshCw, t: 'Reprogramar sin llamadas', d: 'Desde "Mis citas", el cliente cambia la hora o cancela en el mismo chat, con botones.' },
  { icon: CalendarCheck, t: 'Sincronizado con tu agenda', d: 'WhatsApp, la página de reservas y tu panel usan la misma agenda: nunca se ofrece una hora ocupada.' },
  { icon: ShieldCheck, t: 'Sin solapes', d: 'Cada servicio bloquea su duración exacta y el sistema impide dos citas a la vez con el mismo profesional.' },
];

const FAQS = [
  { q: '¿El asistente usa inteligencia artificial?', a: 'No. Funciona con un flujo de botones y menús, como un asistente guiado. Así las respuestas son siempre predecibles, el cliente sabe qué pulsar y nunca recibe información inventada.' },
  { q: '¿Qué necesito para activarlo?', a: 'El plan Pro (o Business), un número de WhatsApp Business para tu negocio y conectarlo a través de YCloud, proveedor oficial de la API de WhatsApp Business. Reserva360 crea por ti los mensajes de confirmación y recordatorio, que Meta aprueba normalmente en poco tiempo.' },
  { q: '¿Mis clientes tienen que instalar algo?', a: 'No. Escriben a tu número de WhatsApp como siempre y el asistente les guía con botones.' },
  { q: '¿Pueden cambiar o cancelar su cita por WhatsApp?', a: 'Sí. En "Mis citas" ven sus próximas citas y pueden cambiar la hora o cancelarla. El hueco liberado vuelve a estar disponible al momento.' },
  { q: '¿Puede ofrecer una hora que ya está ocupada?', a: 'No. Solo muestra huecos libres y, justo antes de confirmar, vuelve a comprobar la disponibilidad. Si alguien ha reservado esa hora mientras tanto, propone otras horas libres.' },
  { q: '¿Qué mensajes se envían por WhatsApp?', a: 'Cuatro avisos automáticos al cliente: la confirmación de la cita al reservar, un recordatorio 24 horas antes, el aviso de cita cambiada y el aviso de cita cancelada. Además, tú recibes un aviso de cada reserva nueva. Los emails siguen funcionando igual.' },
  { q: '¿Puedo seguir usando la página de reservas web?', a: 'Sí. WhatsApp es un canal más: la página de reservas, el panel y el asistente comparten la misma agenda.' },
];

function ChatMockup() {
  const Bot = ({ children }) => <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">{children}</div>;
  const Me = ({ children }) => <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-emerald-100 px-3 py-2 text-sm text-slate-800 shadow-sm">{children}</div>;
  const Btn = ({ children }) => <span className="block rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-center text-xs font-semibold text-emerald-700">{children}</span>;
  return (
    <figure className="mx-auto w-full max-w-sm" aria-label="Ejemplo de conversación con el asistente de reservas por WhatsApp">
      <div className="overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"><MessageCircle className="h-5 w-5" aria-hidden="true" /></span>
          <div><p className="text-sm font-semibold">Barbería Centro</p><p className="text-xs text-emerald-100">Asistente de reservas</p></div>
        </div>
        <div className="space-y-2.5 bg-stone-100 p-3" aria-hidden="true">
          <Me>Hola</Me>
          <Bot>
            <p>¡Hola! 👋 ¿Qué quieres hacer?</p>
            <div className="mt-2 space-y-1.5"><Btn>📅 Reservar cita</Btn><Btn>🗑️ Mis citas</Btn><Btn>ℹ️ Información</Btn></div>
          </Bot>
          <Me>📅 Reservar cita</Me>
          <Bot><p>Elige el servicio:</p><p className="mt-1 text-xs text-slate-500">Corte + barba · 45 min · 18 €</p></Bot>
          <Bot>
            <p>Horas libres el viernes con Carlos:</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5"><Btn>10:00</Btn><Btn>10:45</Btn><Btn>12:15</Btn></div>
          </Bot>
          <Me>10:45</Me>
          <Bot><p>✅ ¡Cita confirmada! Viernes a las 10:45 con Carlos. Te recordaremos la cita el día antes.</p></Bot>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-500">Ejemplo ilustrativo del flujo con botones</figcaption>
    </figure>
  );
}

export default function WhatsAppAssistantPage() {
  const sectors = SECTORS.filter((s) => ['software-reservas-barberias', 'programa-citas-peluquerias', 'software-reservas-centros-estetica', 'software-reservas-fisioterapeutas', 'software-gestion-clinicas'].includes(s.slug));
  const posts = ['mejores-apps-gestion-citas-control-reservas', 'que-debe-tener-programa-gestion-citas', 'como-reducir-ausencias-clientes-clinica'].map(getPost).filter(Boolean);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <JsonLd data={[breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: NAME, path: PATH }]), faqLd(FAQS)]} />
      <MarketingHeader />
      <main id="contenido">
        {/* HERO */}
        <section className="bg-gradient-to-b from-emerald-50/70 to-white">
          <div className="container mx-auto px-4 pb-14 pt-8 md:px-6 md:pb-20">
            <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
              <ol className="flex items-center gap-1">
                <li><Link href="/" className="hover:text-indigo-700">Inicio</Link></li>
                <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                <li aria-current="page" className="text-slate-700">{NAME}</li>
              </ol>
            </nav>
            <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Reservas automáticas por WhatsApp
                </span>
                <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">Asistente virtual y chatbot de citas por WhatsApp</h1>
                <p className="mt-5 text-lg text-slate-600">
                  Tus clientes reservan, confirman y reprograman sus citas desde el WhatsApp Business de tu negocio, 24/7 y sin llamadas.
                  Un asistente con botones les guía paso a paso y cada cita entra directamente en tu agenda de Reserva360.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <PrimaryCta location={`${LOC}-hero`} />
                  <SecondaryCta href="#como-funciona" location={`${LOC}-hero`} label="Ver cómo funciona" />
                </div>
                <CtaNote className="mt-4" />
              </div>
              <ChatMockup />
            </div>
          </div>
        </section>

        {/* PROBLEMAS */}
        <section aria-labelledby="problemas" className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 id="problemas" className="max-w-3xl text-3xl font-bold tracking-tight">Dar citas a mano por WhatsApp te quita horas cada semana</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {PROBLEMS.map((p) => (
                <div key={p.t} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-24 bg-slate-50 py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 id="como-funciona-titulo" className="max-w-3xl text-3xl font-bold tracking-tight">Cómo funciona la reserva automática por WhatsApp</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.t} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mt-4 font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 md:flex-row md:items-center" data-testid="whatsapp-buttons-note">
              <MousePointerClick className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-slate-900">Botones y menús, no una IA que improvisa</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  El asistente sigue un flujo guiado con botones y listas. Tus clientes no tienen que escribir frases ni adivinar qué preguntar,
                  y tú tienes la tranquilidad de que nunca dará precios, horarios u horas libres inventadas: todo sale de tu configuración real.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* MENSAJES AUTOMÁTICOS */}
        <section aria-labelledby="mensajes" className="py-16 md:py-20" data-testid="whatsapp-messages">
          <div className="container mx-auto px-4 md:px-6">
            <h2 id="mensajes" className="max-w-3xl text-3xl font-bold tracking-tight">Confirmaciones y recordatorios automáticos por WhatsApp</h2>
            <p className="mt-4 max-w-3xl text-slate-600">
              Además de reservar por el chat, tus clientes reciben estos avisos en su WhatsApp sin que tengas que escribir nada.
              Se envían también cuando la cita se reserva, cambia o cancela desde tu página de reservas o desde tu panel.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {MESSAGES.map(({ icon: Icon, t, d, when }) => (
                <div key={t} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
                  <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{when}</span>
                  <h3 className="mt-3 flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-600">
              <strong>Y para ti:</strong> un aviso por WhatsApp cada vez que entra una reserva nueva. Todos los avisos vienen activados
              y puedes activar o desactivar cada uno desde Configuración → WhatsApp.
            </p>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section aria-labelledby="beneficios" className="bg-slate-50 py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 id="beneficios" className="max-w-3xl text-3xl font-bold tracking-tight">Agenda 24/7, recordatorios y menos ausencias</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, t, d }) => (
                <div key={t} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* REQUISITOS + CONFIGURACIÓN */}
        <section className="bg-gradient-to-b from-slate-50 to-white py-16 md:py-20">
          <div className="container mx-auto grid gap-12 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Qué necesitas</h2>
              <ul className="mt-6 space-y-3">
                {[
                  'Plan Pro o Business de Reserva360 (gratis durante el lanzamiento).',
                  'Un número de WhatsApp Business para tu negocio.',
                  'Conectarlo con YCloud, proveedor oficial de la API de WhatsApp Business.',
                  'Tus servicios, profesionales y horarios configurados en Reserva360.',
                ].map((f) => <li key={f} className="flex gap-3 text-slate-700"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>)}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Cómo se activa</h2>
              <ol className="mt-6 space-y-4">
                {[
                  'Crea tu cuenta y configura servicios, profesionales y horarios.',
                  'En Configuración → WhatsApp, conecta tu número de WhatsApp Business con YCloud.',
                  'Reserva360 crea los mensajes de confirmación y recordatorio para que Meta los apruebe.',
                  'Comparte tu número: tus clientes ya pueden reservar escribiendo "Hola".',
                ].map((step, i) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
                    <span className="pt-1 text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 md:px-6"><EarlyAccessCard location={`${LOC}-early-access`} /></div>

        {/* FAQ */}
        <section aria-labelledby="faq-whatsapp" className="py-16 md:py-20">
          <div className="container mx-auto max-w-3xl px-4 md:px-6">
            <h2 id="faq-whatsapp" className="text-center text-3xl font-bold tracking-tight">Preguntas frecuentes sobre las reservas por WhatsApp</h2>
            <div className="mt-10"><Faq faqs={FAQS} /></div>
          </div>
        </section>

        {/* ENLACES INTERNOS */}
        <section aria-labelledby="mas" className="border-t border-slate-200 bg-slate-50 py-14">
          <div className="container mx-auto grid gap-10 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <h2 id="mas" className="text-xl font-bold">Reservas por WhatsApp para tu sector</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {sectors.map((r) => (
                  <li key={r.slug}><Link href={`/${r.slug}`} className="text-sm text-indigo-700 hover:underline">{r.h1}</Link></li>
                ))}
              </ul>
              <p className="mt-4 text-sm"><Link href="/" className="font-medium text-indigo-700 hover:underline">Ver todas las funciones de la app de gestión de citas</Link></p>
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
            <h2 className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight"><CalendarDays className="h-8 w-8 text-indigo-600" aria-hidden="true" /> Deja que WhatsApp llene tu agenda</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">Configura tu negocio en unos minutos, conecta tu WhatsApp Business y empieza a recibir reservas automáticas.</p>
            <div className="mt-8 flex justify-center"><PrimaryCta location={`${LOC}-final`} /></div>
            <CtaNote className="mt-4" />
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

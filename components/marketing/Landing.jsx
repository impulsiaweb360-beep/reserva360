import Link from 'next/link';
import {
  CalendarDays, Globe2, Users, UserCog, BellRing, BarChart3, MessageCircle, CreditCard,
  NotebookPen, FileSpreadsheet, MessagesSquare, AlarmClockOff, Check, ShieldCheck, Clock3,
  Activity, Scissors, Sparkles, PawPrint, Apple, Dumbbell, Stethoscope, ArrowRight,
} from 'lucide-react';
import MarketingHeader from './MarketingHeader';
import MarketingFooter from './MarketingFooter';
import { PrimaryCta, SecondaryCta, CtaNote } from './CtaButtons';
import { EarlyAccessCard } from './EarlyAccess';
import { BrowserShot, PhoneShot } from './Screenshot';
import Faq from './Faq';
import JsonLd, { organizationLd, websiteLd, softwareLd, faqLd } from './JsonLd';
import { PLANS } from '@/lib/plans';
import { SECTORS } from '@/lib/marketing/sectors';
import { EARLY_ACCESS } from '@/lib/site';

const ICONS = { Activity, Scissors, Sparkles, PawPrint, Apple, Dumbbell, Stethoscope };

const PROBLEMS = [
  { icon: NotebookPen, t: 'Agenda de papel', d: 'Solo está en un sitio, no avisa a nadie y, si la comparten varias personas, las citas se cruzan.' },
  { icon: FileSpreadsheet, t: 'Hojas de Excel', d: 'No evitan los solapes, no envían recordatorios y el cliente no puede reservar solo.' },
  { icon: MessagesSquare, t: 'Citas a mano por WhatsApp', d: 'Cada cita es una conversación que contestas tú, entre cliente y cliente.' },
  { icon: AlarmClockOff, t: 'Olvidos y huecos vacíos', d: 'Sin recordatorios, las citas se olvidan y nadie aprovecha el hueco que queda libre.' },
];

const FEATURES = [
  { icon: Globe2, t: 'Reservas online 24 h', d: 'Tu propia página de reservas. El cliente elige servicio, profesional, día y hora sin llamarte.' },
  { icon: CalendarDays, t: 'Agenda sin solapes', d: 'Los huecos se calculan con tus horarios, pausas y la duración de cada servicio.' },
  { icon: UserCog, t: 'Empleados y horarios', d: 'Horario propio por profesional, días libres y vacaciones bloqueadas.' },
  { icon: BellRing, t: 'Recordatorios automáticos', d: 'Confirmación al reservar y recordatorio 24 h antes por email, y por WhatsApp en el plan Pro.' },
  { icon: Users, t: 'Clientes y servicios', d: 'Fichas de clientes con notas y número de visitas, y un catálogo de servicios con duración y precio.' },
  { icon: MessageCircle, t: 'Citas por WhatsApp Business', d: 'Conecta el WhatsApp Business de tu negocio: tus clientes reservan, ven, cambian o cancelan sus citas con menús y botones (plan Pro).' },
  { icon: CreditCard, t: 'Pagos y señales', d: 'Marca cobros como pagados o, en el plan Business, cobra online con tu propia cuenta de Stripe.' },
  { icon: BarChart3, t: 'Métricas del negocio', d: 'Citas del día, de la semana y del mes, ingresos, clientes nuevos y servicios más reservados.' },
];

const STEPS = [
  { n: '1', t: 'Crea tu cuenta', d: 'Pon el nombre y el logo de tu negocio. Sin tarjeta.' },
  { n: '2', t: 'Configura servicios y horarios', d: 'Añade tus servicios con su duración y precio, tu horario y el de tu equipo.' },
  { n: '3', t: 'Comparte tu enlace', d: 'Ponlo en Google, Instagram, WhatsApp o en un código QR. Las reservas llegan solas a tu agenda.' },
];

const FAQS = [
  { q: '¿Qué es Reserva360?', a: 'Es un software de gestión de citas y reservas online para negocios que trabajan con cita previa. Reúne en una sola plataforma la agenda, la página de reservas, los clientes, los empleados y los recordatorios.' },
  { q: '¿Cuánto cuesta?', a: `Durante la fase de lanzamiento es gratis. Cuando abramos oficialmente, quienes se hayan registrado antes tendrán un ${EARLY_ACCESS.discount} de descuento durante ${EARLY_ACCESS.months} meses. Hay un plan Free (1 profesional, hasta 50 reservas al mes), Pro (19,99 €/mes) y Business (39,99 €/mes).` },
  { q: '¿Necesito tarjeta para registrarme?', a: 'No. Creas tu cuenta con tu email y empiezas a usarlo.' },
  { q: '¿Mis clientes tienen que descargar una aplicación?', a: 'No. Reservan desde el navegador del móvil o del ordenador con tu enlace, sin crear cuenta.' },
  { q: '¿Puedo gestionar a varios empleados?', a: 'Sí. Cada profesional tiene su horario, sus días libres y sus vacaciones. El plan Pro admite hasta 3 profesionales y el Business hasta 10.' },
  { q: '¿Los clientes pueden cancelar o cambiar su cita?', a: 'Sí. El email de confirmación incluye un enlace para cambiar o cancelar la cita, y el hueco se libera al momento.' },
  { q: '¿Puedo gestionar las citas con el WhatsApp Business de mi negocio?', a: 'Sí, en el plan Pro. Conectas el número de WhatsApp Business de tu negocio a través de YCloud, un proveedor oficial de la API de WhatsApp Business. Desde ese número tus clientes pueden reservar, consultar, cambiar o cancelar sus citas con un asistente de menús y botones. Reserva360 también les envía la confirmación, el recordatorio 24 horas antes y los avisos de cambios, y a ti te avisa de cada reserva nueva.' },
  { q: '¿Mis datos están separados de los de otros negocios?', a: 'Sí. Cada negocio solo puede ver y gestionar su propia información.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <JsonLd data={[organizationLd(), websiteLd(), softwareLd(PLANS), faqLd(FAQS)]} />
      <MarketingHeader />

      <main id="contenido">
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-white">
          <div className="container mx-auto px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> {EARLY_ACCESS.badge}: {EARLY_ACCESS.short.toLowerCase()}
              </p>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-6xl">
                Software de gestión de citas y{' '}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">reservas online</span>{' '}
                para tu negocio
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
                Reserva360 reúne tu agenda, las reservas online, tus clientes y tu equipo en una sola plataforma. Tus clientes reservan
                a cualquier hora y tú dejas atrás la agenda de papel, el Excel y las citas apuntadas a mano desde WhatsApp.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <PrimaryCta location="hero" />
                <SecondaryCta location="hero" />
              </div>
              <CtaNote className="mt-4" />
            </div>

            <div className="relative mx-auto mt-14 max-w-6xl">
              <BrowserShot
                name="panel-dashboard"
                priority
                alt="Panel de Reserva360 con las citas del día, de la semana y del mes, ingresos, reservas por día y servicios más reservados"
              />
              <div className="absolute -bottom-10 right-2 hidden w-44 md:block lg:-right-6 lg:w-52">
                <PhoneShot name="reserva-movil-servicios" alt="Página de reservas de Reserva360 en el móvil: el cliente elige el servicio" />
              </div>
            </div>
            <p className="mt-14 text-center text-xs text-slate-400 md:mt-16">Capturas reales de Reserva360 con un negocio de demostración y datos ficticios.</p>
          </div>
        </section>

        {/* PROBLEMAS */}
        <section aria-labelledby="problemas" className="py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="problemas" className="text-3xl font-bold tracking-tight md:text-4xl">¿Así gestionas tus citas hoy?</h2>
              <p className="mt-3 text-slate-600">Funcionan… hasta que el negocio crece o el teléfono no para de sonar.</p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PROBLEMS.map(({ icon: I, t, d }) => (
                <div key={t} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><I className="h-5 w-5" aria-hidden="true" /></div>
                  <h3 className="mt-4 font-semibold">{t}</h3>
                  <p className="mt-2 text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-lg font-medium text-slate-800">
              Con Reserva360, todo queda en <span className="text-indigo-600">una sola agenda</span> que se actualiza sola.
            </p>
          </div>
        </section>

        {/* FUNCIONALIDADES */}
        <section id="funcionalidades" aria-labelledby="funcionalidades-titulo" className="scroll-mt-24 bg-slate-50 py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="funcionalidades-titulo" className="text-3xl font-bold tracking-tight md:text-4xl">Todo lo que necesitas para gestionar tus reservas</h2>
              <p className="mt-3 text-slate-600">Un programa de reservas online pensado para negocios con cita previa, sin complicaciones.</p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: I, t, d }) => (
                <div key={t} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><I className="h-5 w-5" aria-hidden="true" /></div>
                  <h3 className="mt-4 font-semibold">{t}</h3>
                  <p className="mt-2 text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHATSAPP BUSINESS */}
        <section id="whatsapp" aria-labelledby="whatsapp-titulo" className="scroll-mt-24 py-16 md:py-24">
          <div className="container mx-auto grid items-center gap-10 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Plan Pro
              </span>
              <h2 id="whatsapp-titulo" className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Gestiona las citas desde el WhatsApp Business de tu negocio</h2>
              <p className="mt-4 text-slate-600">
                Conecta el número de WhatsApp Business de tu negocio y deja que un asistente con menús y botones atienda las citas por ti,
                con tus mismos servicios, profesionales y horarios. Todo queda en tu agenda de Reserva360.
              </p>
              <p className="mt-3 text-sm text-slate-500">
                La conexión se hace con YCloud, un proveedor oficial de la API de WhatsApp Business, desde Configuración → WhatsApp.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="font-semibold">Tus clientes, desde WhatsApp</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {['Reservan una cita nueva', 'Consultan sus próximas citas', 'Cambian el día o la hora', 'Cancelan si no pueden venir'].map((x) => (
                    <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="font-semibold">Avisos automáticos</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {['Confirmación al reservar', 'Recordatorio 24 horas antes', 'Aviso si la cita cambia o se cancela', 'Aviso al negocio de cada reserva nueva'].map((x) => (
                    <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-24 py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="como-funciona-titulo" className="text-3xl font-bold tracking-tight md:text-4xl">Empieza a recibir reservas en tres pasos</h2>
              <p className="mt-3 text-slate-600">Sin instalaciones ni conocimientos técnicos.</p>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="relative rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">{s.n}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-slate-600">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* DEMOSTRACIÓN VISUAL */}
        <section aria-labelledby="demo" className="bg-gradient-to-b from-slate-50 to-white py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="demo" className="text-3xl font-bold tracking-tight md:text-4xl">Así se ve Reserva360 por dentro</h2>
              <p className="mt-3 text-slate-600">La agenda semanal para ti y una página de reservas sencilla para tus clientes.</p>
            </div>
            <div className="mt-12">
              <h3 className="mb-4 text-lg font-semibold">Calendario semanal por profesional</h3>
              <BrowserShot
                name="panel-calendario-semanal"
                alt="Calendario semanal de Reserva360 de lunes a domingo con las citas de una fisioterapeuta, cada una con su servicio y estado"
              />
            </div>
            <div className="mt-16">
              <h3 className="text-lg font-semibold">La reserva del cliente, desde el móvil</h3>
              <p className="mt-1 text-sm text-slate-600">Elige el servicio, el profesional y el día. Solo ve horas que de verdad están libres.</p>
              <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
                {[
                  ['reserva-movil-servicios', '1. Elige el servicio', 'Paso 1 de la reserva online: lista de servicios con duración y precio'],
                  ['reserva-movil-profesional', '2. Elige profesional', 'Paso 2 de la reserva online: elegir profesional o el primero disponible'],
                  ['reserva-movil-fecha', '3. Elige el día', 'Paso 3 de la reserva online: calendario con los días disponibles y los cerrados desactivados'],
                ].map(([n, label, alt]) => (
                  <figure key={n} className="mx-auto w-full max-w-[260px]">
                    <PhoneShot name={n} alt={alt} />
                    <figcaption className="mt-3 text-center text-sm font-medium text-slate-700">{label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTORES */}
        <section id="sectores" aria-labelledby="sectores-titulo" className="scroll-mt-24 py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="sectores-titulo" className="text-3xl font-bold tracking-tight md:text-4xl">Diseñado para negocios que trabajan con cita previa</h2>
              <p className="mt-3 text-slate-600">Descubre cómo se adapta Reserva360 a tu sector.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SECTORS.map((s) => {
                const I = ICONS[s.icon] || CalendarDays;
                return (
                  <li key={s.slug}>
                    <Link href={`/${s.slug}`} className="group flex h-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><I className="h-5 w-5" aria-hidden="true" /></span>
                      <span>
                        <span className="block font-semibold group-hover:text-indigo-700">{s.menuLabel}</span>
                        <span className="text-xs text-slate-500">{s.keywords[0].charAt(0).toUpperCase() + s.keywords[0].slice(1)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-center text-sm text-slate-500">¿Tu negocio no aparece? Si trabajas con citas, Reserva360 también te sirve.</p>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section aria-labelledby="beneficios" className="bg-slate-50 py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <h2 id="beneficios" className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight md:text-4xl">Ventajas para todo el equipo</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-8">
                <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" /><h3 className="text-xl font-semibold">Para propietarios</h3></div>
                <ul className="mt-5 space-y-3 text-sm text-slate-700">
                  {['Menos tiempo al teléfono y en WhatsApp dando citas', 'Reservas también por la noche y en fin de semana', 'Una visión clara de la semana y de los ingresos', 'Horarios y vacaciones de todo el equipo en un solo sitio', 'Página de reservas con el nombre y el logo de tu negocio'].map((x) => (
                    <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-8">
                <div className="flex items-center gap-3"><Clock3 className="h-6 w-6 text-indigo-600" aria-hidden="true" /><h3 className="text-xl font-semibold">Para empleados</h3></div>
                <ul className="mt-5 space-y-3 text-sm text-slate-700">
                  {['Cada profesional con su propio horario y sus días libres', 'Sin citas en la pausa de mediodía ni en vacaciones', 'Sin dobles reservas a la misma hora', 'Menos interrupciones mientras atienden', 'Cambios y cancelaciones que el cliente hace solo'].map((x) => (
                    <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* PRECIOS */}
        <section id="precios" aria-labelledby="precios-titulo" className="scroll-mt-24 py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="precios-titulo" className="text-3xl font-bold tracking-tight md:text-4xl">Precios claros, sin permanencia</h2>
              <p className="mt-3 text-slate-600">
                Ahora, durante el lanzamiento, es <strong>gratis</strong>. Si te registras antes de la apertura oficial, tendrás un{' '}
                <strong>{EARLY_ACCESS.discount} de descuento durante {EARLY_ACCESS.months} meses</strong> sobre estos precios.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
              {PLANS.map((p) => (
                <div key={p.id} data-testid={`landing-plan-${p.key}`} className={`relative flex flex-col rounded-2xl border bg-white p-6 ${p.popular ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-500' : 'border-slate-200'}`}>
                  {p.popular && <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">Más elegido</span>}
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-sm text-slate-500">{p.tagline}</p>
                  <p className="my-4">
                    <span className="text-4xl font-extrabold">{p.monthly ? p.monthly.toLocaleString('es-ES') : '0'} €</span>
                    <span className="text-slate-500">/mes</span>
                    {p.yearly > 0 && <span className="block text-xs text-emerald-600">o {p.yearly} €/año</span>}
                  </p>
                  <ul className="flex-1 space-y-2 text-sm">
                    {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-slate-500">Los pagos de las suscripciones se gestionan de forma segura con Stripe. Puedes cambiar de plan o cancelar cuando quieras.</p>
          </div>
        </section>

        {/* ACCESO ANTICIPADO */}
        <div className="container mx-auto px-4 md:px-6">
          <EarlyAccessCard location="early-access-home" />
        </div>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-titulo" className="scroll-mt-24 py-16 md:py-24">
          <div className="container mx-auto max-w-3xl px-4 md:px-6">
            <h2 id="faq-titulo" className="text-center text-3xl font-bold tracking-tight md:text-4xl">Preguntas frecuentes</h2>
            <div className="mt-10"><Faq faqs={FAQS} /></div>
            <p className="mt-6 text-center text-sm text-slate-600">
              ¿Tienes otra duda? Lee nuestro <Link href="/blog" className="font-medium text-indigo-600 hover:underline">blog</Link> o escríbenos a{' '}
              <a href="mailto:reserva360.app@gmail.com" className="font-medium text-indigo-600 hover:underline">reserva360.app@gmail.com</a>.
            </p>
          </div>
        </section>

        {/* CTA FINAL */}
        <section aria-labelledby="cta-final" className="pb-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl bg-slate-900 px-6 py-14 text-center text-white md:px-12">
              <h2 id="cta-final" className="text-3xl font-bold md:text-4xl">Organiza tus citas desde hoy</h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-300">Crea tu cuenta en unos minutos y comparte tu enlace de reservas con tus clientes.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <PrimaryCta location="final" />
                <Link href="/#como-funciona" className="inline-flex items-center justify-center gap-1 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:text-white">
                  Ver cómo funciona <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-400">{EARLY_ACCESS.short} · {EARLY_ACCESS.noCard}</p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

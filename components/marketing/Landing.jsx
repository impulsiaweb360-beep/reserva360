import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Users, CreditCard, Bell, BarChart3, Shield, Smartphone, Globe,
  Mail, ArrowRight, Check, Sparkles, Clock, Stethoscope, Scissors, Heart,
  Dog, Salad, Dumbbell, Star, Building2,
} from 'lucide-react';

const FEATURES = [
  { icon: Calendar, title: 'Calendario inteligente', desc: 'Vista semanal y diaria con detección automática de huecos libres y solapamientos.' },
  { icon: Globe, title: 'Reservas online 24/7', desc: 'Tu propia URL pública para que tus clientes reserven cuando quieran. Sin descargas, sin apps.' },
  { icon: Users, title: 'Multi-empleado', desc: 'Cada profesional con su agenda, horarios y vacaciones. Filtra por persona o ve todo el equipo.' },
  { icon: Bell, title: 'Recordatorios automáticos', desc: 'Email 24h antes de cada cita. WhatsApp y SMS en planes superiores. Reduce las ausencias.' },
  { icon: CreditCard, title: 'Pagos integrados', desc: 'Cobra online por Stripe o en local. Pagos completos, parciales o señales según prefieras.' },
  { icon: BarChart3, title: 'Métricas en tiempo real', desc: 'Ingresos, servicios más reservados, empleados más ocupados. Decide con datos.' },
  { icon: Shield, title: 'Datos seguros y aislados', desc: 'Aislamiento por negocio con Row Level Security. Cifrado en tránsito y reposo.' },
  { icon: Smartphone, title: 'Móvil-first', desc: 'Funciona perfectamente en móvil, tablet y escritorio. Sin instalar nada.' },
];

const INDUSTRIES = [
  { icon: Stethoscope, name: 'Fisioterapeutas', color: 'from-sky-500 to-blue-600' },
  { icon: Scissors, name: 'Peluquerías', color: 'from-pink-500 to-rose-600' },
  { icon: Heart, name: 'Centros estética', color: 'from-fuchsia-500 to-purple-600' },
  { icon: Salad, name: 'Nutricionistas', color: 'from-lime-500 to-emerald-600' },
  { icon: Dog, name: 'Veterinarios', color: 'from-emerald-500 to-teal-600' },
  { icon: Scissors, name: 'Barberías', color: 'from-amber-500 to-orange-600' },
  { icon: Dumbbell, name: 'Entrenadores personales', color: 'from-red-500 to-rose-600' },
  { icon: Building2, name: 'Clínicas y consultas', color: 'from-indigo-500 to-violet-600' },
];

const PLANS = [
  {
    name: 'Starter', price: 19, popular: false,
    desc: 'Para profesionales independientes que empiezan.',
    features: ['1 empleado', '100 reservas/mes', 'Recordatorios por email', 'Página pública de reservas', 'Soporte por email'],
  },
  {
    name: 'Pro', price: 49, popular: true,
    desc: 'Para negocios en crecimiento que necesitan más potencia.',
    features: ['Hasta 10 empleados', 'Reservas ilimitadas', 'Recordatorios Email + WhatsApp', 'Pagos online con Stripe', 'Métricas avanzadas', 'Soporte prioritario'],
  },
  {
    name: 'Business', price: 99, popular: false,
    desc: 'Para clínicas y franquicias con varias sedes.',
    features: ['Empleados ilimitados', 'Multi-sede', 'SMS + WhatsApp', 'API y Webhooks', 'Marca personalizada', 'Soporte dedicado'],
  },
];

const FAQ = [
  { q: '¿Puedo probarlo gratis?', a: 'Sí. Crea tu cuenta y prueba todas las funciones durante 14 días sin tarjeta de crédito.' },
  { q: '¿Mis clientes necesitan instalar una app?', a: 'No. Tus clientes reservan desde tu URL pública (ej: reserva360.com/tu-negocio) directamente en su navegador.' },
  { q: '¿Cómo funcionan los recordatorios?', a: 'Reserva360 envía automáticamente un email 24h antes de cada cita. En planes Pro y Business también WhatsApp y SMS.' },
  { q: '¿Los datos están seguros?', a: 'Sí. Usamos Row Level Security para aislar los datos entre negocios y cifrado AES-256. Cumplimos GDPR.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí, sin permanencia. Cancelas desde tu panel y dejas de pagar al instante.' },
  { q: '¿Hay límite de clientes?', a: 'No, todos los planes incluyen clientes ilimitados. Solo varían empleados y canales de recordatorio.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between gap-3 px-6 py-3">
          <Link href="/" className="flex items-center">
            <img src="/logo-reserva360.png" alt="Reserva360" className="h-9 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900">Funciones</a>
            <a href="#industries" className="hover:text-slate-900">Para quién</a>
            <a href="#pricing" className="hover:text-slate-900">Precios</a>
            <a href="#faq" className="hover:text-slate-900">Preguntas</a>
          </nav>
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <a href="mailto:reserva360.app@gmail.com?subject=Contacto%20Reserva360"><Mail className="h-4 w-4" /> Contacto</a>
            </Button>
            <div className="flex flex-col items-end">
              <Button size="sm" asChild>
                <Link href="/auth/login">Iniciar sesión</Link>
              </Button>
              <Link href="/auth/signup" className="mt-1 text-xs text-indigo-600 hover:underline">Crear cuenta</Link>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="container mx-auto px-6 py-20 text-center">
          <Badge className="mb-6 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
            <Sparkles className="mr-1 h-3 w-3" /> El SaaS de citas para tu negocio
          </Badge>
          <div className="mb-8 flex justify-center">
            <img src="/logo-reserva360.png" alt="Reserva360" className="h-28 w-auto sm:h-36 md:h-44 lg:h-52 drop-shadow-sm" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl max-w-4xl mx-auto">
            Gestione citas y reservas <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">para cualquier negocio</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            Fisios, peluquerías, veterinarios, barberías, nutricionistas… la plataforma todo-en-uno para gestionar agenda, clientes, empleados y pagos.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="gap-2 text-base shadow-lg">
              <Link href="/auth/signup">Empezar gratis 14 días <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-base">
              <a href="#pricing">Ver precios</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">Sin tarjeta de crédito · Cancela cuando quieras</p>
        </div>
      </section>

      {/* SOCIAL PROOF / NUMBERS */}
      <section className="border-y border-slate-100 bg-white py-10">
        <div className="container mx-auto grid grid-cols-2 gap-6 px-6 md:grid-cols-4">
          {[
            { value: '+10.000', label: 'Citas gestionadas/mes' },
            { value: '99.9%', label: 'Uptime garantizado' },
            { value: '<30s', label: 'Crea tu cuenta' },
            { value: '24/7', label: 'Reservas online' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{s.value}</div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Funcionalidades</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Todo lo que necesitas para gestionar tu negocio</h2>
            <p className="mt-4 text-slate-600">Reserva360 reemplaza tu agenda de papel, Excel y WhatsApp con una sola herramienta moderna.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="border-slate-200 transition hover:border-indigo-300 hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900">{f.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section id="industries" className="bg-slate-50 py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Para quién</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Diseñado para negocios basados en agenda</h2>
            <p className="mt-4 text-slate-600">Si tu negocio se basa en citas con clientes, Reserva360 es para ti.</p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {INDUSTRIES.map((i) => {
              const Icon = i.icon;
              return (
                <div key={i.name} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:shadow-md">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${i.color} text-white shadow`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-slate-800">{i.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Cómo funciona</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">En 3 pasos estás funcionando</h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { n: '1', title: 'Crea tu cuenta', desc: 'Regístrate gratis en menos de 30 segundos con tu email.' },
              { n: '2', title: 'Configura tu negocio', desc: 'Añade tus servicios, empleados y horarios. La app se adapta a ti.' },
              { n: '3', title: 'Empieza a recibir reservas', desc: 'Comparte tu URL pública. Tus clientes reservan online 24/7.' },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="absolute -top-4 left-6 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg">
                  {s.n}
                </div>
                <Card className="border-slate-200 pt-6">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Precios</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Planes para cada tamaño de negocio</h2>
            <p className="mt-4 text-slate-600">Empieza gratis. Paga solo cuando tu negocio crezca.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <Card key={p.name} className={p.popular ? 'border-2 border-indigo-500 shadow-2xl md:scale-105' : 'border-slate-200'}>
                <CardContent className="p-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    {p.popular && <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Más popular</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{p.desc}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{p.price}€</span>
                    <span className="text-slate-500">/mes</span>
                  </div>
                  <Button asChild className="mt-6 w-full" variant={p.popular ? 'default' : 'outline'}>
                    <Link href="/auth/signup">Empezar gratis</Link>
                  </Button>
                  <ul className="mt-8 space-y-3 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> {f}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">Todos los planes incluyen 14 días de prueba gratis · Cambia o cancela cuando quieras</p>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <Card className="mx-auto max-w-3xl border-slate-200 bg-gradient-to-br from-white to-indigo-50">
            <CardContent className="p-10 text-center">
              <div className="mb-3 flex justify-center text-amber-500">
                {[1,2,3,4,5].map((s) => <Star key={s} className="h-5 w-5 fill-current" />)}
              </div>
              <blockquote className="text-xl font-medium text-slate-800">
                “Pasamos de gestionar las citas por WhatsApp y cuaderno a tener un sistema profesional. Las ausencias bajaron un 60% gracias a los recordatorios automáticos.”
              </blockquote>
              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">LG</div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Laura García</div>
                  <div className="text-xs text-slate-500">Fisioterapeuta · Madrid</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Preguntas frecuentes</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">¿Tienes dudas?</h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl gap-4">
            {FAQ.map((item) => (
              <Card key={item.q} className="border-slate-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-slate-900">{item.q}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-slate-500">
            ¿Otra duda? Escríbenos a <a href="mailto:reserva360.app@gmail.com" className="text-indigo-600 hover:underline">reserva360.app@gmail.com</a>
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-gradient-to-br from-indigo-600 to-violet-600 py-20">
        <div className="container mx-auto px-6 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">¿Listo para gestionar tu negocio mejor?</h2>
          <p className="mt-4 text-lg text-indigo-100">Crea tu cuenta en 30 segundos. Sin tarjeta. Sin permanencia.</p>
          <Button size="lg" asChild className="mt-8 gap-2 bg-white text-indigo-700 hover:bg-indigo-50 text-base shadow-xl">
            <Link href="/auth/signup">Empezar gratis ahora <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="container mx-auto grid gap-8 px-6 md:grid-cols-4">
          <div>
            <img src="/logo-reserva360.png" alt="Reserva360" className="h-9 w-auto" />
            <p className="mt-3 text-sm text-slate-500">El SaaS de gestión de citas y reservas para profesionales y negocios basados en agenda.</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Producto</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="#features" className="hover:text-slate-900">Funciones</a></li>
              <li><a href="#pricing" className="hover:text-slate-900">Precios</a></li>
              <li><a href="#industries" className="hover:text-slate-900">Para quién</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Empresa</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="mailto:reserva360.app@gmail.com" className="hover:text-slate-900">Contacto</a></li>
              <li><a href="#faq" className="hover:text-slate-900">Preguntas</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Cuenta</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/auth/login" className="hover:text-slate-900">Iniciar sesión</Link></li>
              <li><Link href="/auth/signup" className="hover:text-slate-900">Crear cuenta</Link></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto mt-10 border-t border-slate-100 px-6 pt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Reserva360. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}

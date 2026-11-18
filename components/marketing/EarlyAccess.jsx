import { Gift, Rocket, BadgePercent } from 'lucide-react';
import { EARLY_ACCESS } from '@/lib/site';
import { PrimaryCta } from './CtaButtons';

export function EarlyAccessStrip() {
  if (!EARLY_ACCESS.active) return null;
  return (
    <div className="bg-slate-900 px-4 py-2 text-center text-xs text-white sm:text-sm">
      <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 font-semibold text-emerald-300">
        <Rocket className="h-3.5 w-3.5" aria-hidden="true" /> {EARLY_ACCESS.badge}
      </span>
      Regístrate ahora: gratis hasta el lanzamiento oficial y {EARLY_ACCESS.discount} de descuento tus {EARLY_ACCESS.months} primeros meses.
    </div>
  );
}

export function EarlyAccessCard({ location = 'early-access' }) {
  if (!EARLY_ACCESS.active) return null;
  return (
    <section aria-labelledby="acceso-anticipado" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-8 text-white md:p-12">
      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <Rocket className="h-3.5 w-3.5" aria-hidden="true" /> {EARLY_ACCESS.badge}
          </span>
          <h2 id="acceso-anticipado" className="mt-4 text-2xl font-bold md:text-3xl">Únete ahora y forma parte del lanzamiento</h2>
          <p className="mt-3 text-indigo-100">
            Reserva360 ya funciona al completo: reservas online, agenda, clientes, empleados y recordatorios. Estamos en fase de lanzamiento
            y queremos que los primeros negocios lo usen y nos ayuden a mejorarlo.
          </p>
          <div className="mt-6">
            <PrimaryCta location={location} label={EARLY_ACCESS.cta} className="bg-white !text-indigo-700 shadow-none hover:bg-indigo-50" />
          </div>
        </div>
        <ul className="space-y-4">
          <li className="flex gap-3 rounded-2xl bg-white/10 p-4">
            <Gift className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <div><p className="font-semibold">Gratis hasta el lanzamiento oficial</p><p className="text-sm text-indigo-100">Sin tarjeta y sin compromiso.</p></div>
          </li>
          <li className="flex gap-3 rounded-2xl bg-white/10 p-4">
            <BadgePercent className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <div><p className="font-semibold">{EARLY_ACCESS.discount} de descuento {EARLY_ACCESS.months} meses</p><p className="text-sm text-indigo-100">Desde la apertura oficial, en el plan que elijas.</p></div>
          </li>
        </ul>
      </div>
    </section>
  );
}

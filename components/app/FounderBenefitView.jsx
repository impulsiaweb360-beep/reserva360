'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Award, CheckCircle2, Circle, Loader2, CalendarClock, Info, ArrowRight, Lock, Sparkles } from 'lucide-react';

const eur = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fdate = (d, withTime = false) => (d ? new Date(d).toLocaleString('es-ES', {
  timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
}) : '—');
const PLAN_NAME = { plan_pro: 'Pro', plan_business: 'Business' };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

export const FOUNDER_STATUS = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  eligible: { label: 'Elegible', cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  not_eligible: { label: 'No elegible', cls: 'bg-slate-200 text-slate-700 hover:bg-slate-200' },
  active: { label: 'Descuento activo', cls: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' },
  finished: { label: 'Descuento finalizado', cls: 'bg-slate-200 text-slate-700 hover:bg-slate-200' },
};

function Message({ tone = 'info', icon: Icon = Info, children }) {
  const cls = {
    info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    muted: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${cls}`} data-testid="founder-message">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /><div>{children}</div>
    </div>
  );
}

export default function FounderBenefitView({ onNavigate }) {
  const [f, setF] = useState(null);

  useEffect(() => {
    fetch('/api/founders/me')
      .then(async (r) => (r.ok ? r.json() : { error: (await r.json().catch(() => ({}))).error || 'Error' }))
      .then(setF)
      .catch((e) => setF({ error: e.message }));
  }, []);

  if (!f) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tu beneficio…</CardContent></Card>;
  if (f.error) return <Card><CardContent className="p-6 text-sm text-rose-600">{f.error}</CardContent></Card>;
  if (!f.available) return <Card><CardContent className="p-6 text-sm text-slate-600">El programa de fundadores todavía no está disponible.</CardContent></Card>;

  const st = FOUNDER_STATUS[f.status] || FOUNDER_STATUS.pending;
  const launched = f.program.launched;
  const launchTxt = f.program.launchAt ? `el ${fdate(f.program.launchAt, true)}` : 'el día del lanzamiento oficial';
  const planKey = f.currentPlanId === 'plan_business' ? 'business' : 'pro';
  const interval = f.billingInterval === 'year' ? 'year' : 'month';
  const promo = f.prices[planKey][interval];
  const per = interval === 'year' ? '/año' : '/mes';
  const pct = Math.round((f.requirementsDone / f.requirements.length) * 100);
  // Último cobro con descuento (estimado): próxima renovación + ciclos restantes - 1
  const lastDiscounted = f.status === 'active' && f.subscriptionPeriodEnd && f.cyclesLeft > 0
    ? (interval === 'year' ? null : addMonths(f.subscriptionPeriodEnd, f.cyclesLeft - 1)) : null;

  return (
    <div className="space-y-4" data-testid="founder-view">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15"><Award className="h-7 w-7" /></div>
              <div>
                <h2 className="text-xl font-bold">Mi beneficio fundador</h2>
                <p className="text-sm text-indigo-100">Para los negocios que confían en Reserva360 desde el principio</p>
              </div>
            </div>
            <Badge className={st.cls} data-testid="founder-status">{st.label}</Badge>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div><span className="text-5xl font-extrabold" data-testid="founder-percent">{f.discountPercent} %</span> <span className="text-indigo-100">de descuento</span></div>
            <div className="text-sm text-indigo-100">durante <b className="text-white">{f.totalCycles} ciclos de facturación pagados</b> en Pro o Business (en pago anual, el primer año)</div>
          </div>
        </div>

        <CardContent className="space-y-4 p-6">
          {/* Mensaje según el estado */}
          {f.status === 'pending' && !launched && (
            <Message tone="warn" icon={CalendarClock}>
              Completa los requisitos de abajo <b>antes del lanzamiento ({launchTxt})</b> para conseguir tu beneficio. La elegibilidad se congela en ese momento.
            </Message>
          )}
          {f.status === 'eligible' && !launched && (
            <Message tone="ok" icon={CheckCircle2}>
              <b>¡Ya cumples todos los requisitos!</b> Tu beneficio quedará confirmado en el lanzamiento ({launchTxt}). Mantén tu configuración hasta entonces.
              El descuento se aplicará automáticamente la primera vez que contrates Pro o Business.
            </Message>
          )}
          {f.status === 'eligible' && launched && (
            <Message tone="ok" icon={Sparkles}>
              <b>Eres usuario fundador.</b> {f.program.status === 'active'
                ? 'Al contratar Pro o Business por primera vez se aplicará automáticamente el descuento. Verás el precio final antes de pagar.'
                : 'El programa está cerrado temporalmente: de momento no se pueden activar nuevos descuentos.'}
              {f.benefitStatus === 'reserved' && <div className="mt-1">Tienes un pago en curso con el descuento aplicado.</div>}
            </Message>
          )}
          {f.status === 'not_eligible' && launched && (
            <Message tone="muted" icon={Lock}>
              El programa de fundadores se cerró {launchTxt} y tu negocio no cumplía todos los requisitos en esa fecha. <b>Ya no puede obtener el beneficio.</b>
            </Message>
          )}
          {f.status === 'not_eligible' && !launched && (
            <Message tone="muted" icon={Lock}>Ahora mismo tu negocio no es elegible para el beneficio fundador. Si crees que es un error, escríbenos a reserva360.app@gmail.com.</Message>
          )}
          {f.status === 'active' && (
            <Message tone="info" icon={Sparkles}>
              Tu descuento está activo. Te quedan <b>{f.cyclesLeft} {f.cyclesLeft === 1 ? 'ciclo pagado' : 'ciclos pagados'}</b> con el {f.discountPercent} %.
              {lastDiscounted && <> Tu último cobro con descuento será aproximadamente el <b>{fdate(lastDiscounted)}</b>.</>}
              {' '}Después pagarás el precio normal de tu plan.
              {f.cancelAtPeriodEnd && <div className="mt-1 font-medium">Has programado la cancelación: si la suscripción termina durante la promoción, perderás el descuento restante.</div>}
            </Message>
          )}
          {f.status === 'finished' && (
            <Message tone="muted" icon={Lock}>
              {f.endReason === 'completed' && <>Ya disfrutaste de tus {f.totalCycles} ciclos con descuento. </>}
              {f.endReason === 'subscription_cancelled' && <>Cancelaste la suscripción durante la promoción. </>}
              {f.endReason === 'revoked_by_admin' && <>El beneficio fue retirado por la administración. </>}
              <b>El beneficio fundador ya se utilizó y no puede volver a usarse.</b>
            </Message>
          )}

          {/* Detalle del beneficio */}
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Plan al que se aplica</div>
              <div className="font-semibold" data-testid="founder-plan">{f.currentPlanId ? `${PLAN_NAME[f.currentPlanId] || f.currentPlanId} · ${interval === 'year' ? 'anual' : 'mensual'}` : 'Pro o Business (el que contrates)'}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Precio promocional</div>
              <div className="font-semibold" data-testid="founder-promo-price">{f.currentPlanId ? `${eur(promo.founder)}${per}` : `desde ${eur(f.prices.pro.month.founder)}/mes`}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Precio normal después</div>
              <div className="font-semibold">{f.currentPlanId ? `${eur(promo.normal)}${per}` : `desde ${eur(f.prices.pro.month.normal)}/mes`}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Ciclos pagados restantes</div>
              <div className="font-semibold" data-testid="founder-cycles-left">{f.status === 'active' || f.status === 'finished' ? `${f.cyclesLeft} de ${f.totalCycles}` : `${f.totalCycles} (al contratar)`}</div>
            </div>
            <div className="rounded-lg border p-3 sm:col-span-2">
              <div className="text-xs text-slate-500">Fecha de activación</div>
              <div className="font-semibold">{f.activatedAt ? fdate(f.activatedAt, true) : 'Se activa al contratar por primera vez Pro o Business'}</div>
            </div>
            <div className="rounded-lg border p-3 sm:col-span-2">
              <div className="text-xs text-slate-500">Lanzamiento oficial</div>
              <div className="font-semibold">{f.program.launchAt ? fdate(f.program.launchAt, true) : 'Fecha por anunciar'}</div>
            </div>
          </div>

          {f.usable && launched && f.program.status === 'active' && (
            <Button onClick={() => onNavigate?.('settings')} data-testid="founder-go-billing">
              Ver planes con mi descuento <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              Progreso de configuración <span className="text-sm font-normal text-slate-500" data-testid="founder-progress">{f.requirementsDone} de {f.requirements.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={pct} className="h-2" />
            <ul className="space-y-2">
              {f.requirements.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2 text-sm" data-testid={`founder-req-${r.key}`}>
                  <span className="flex items-center gap-2">
                    {r.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                    <span className={r.done ? 'text-slate-500' : 'font-medium text-slate-800'}>{r.label}</span>
                  </span>
                  {!r.done && r.view && !launched && (
                    <Button size="sm" variant="ghost" className="h-7 text-indigo-600" onClick={() => onNavigate?.(r.view)}>Completar <ArrowRight className="ml-1 h-3 w-3" /></Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Precios para fundadores</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="pb-2">Plan</th><th className="pb-2">Con descuento</th><th className="pb-2">Después</th></tr></thead>
              <tbody className="divide-y">
                {['pro', 'business'].flatMap((k) => ['month', 'year'].map((iv) => (
                  <tr key={`${k}-${iv}`}>
                    <td className="py-2 font-medium">{f.prices[k].name} {iv === 'year' ? 'anual' : 'mensual'}</td>
                    <td className="py-2 font-semibold text-indigo-700">{eur(f.prices[k][iv].founder)}{iv === 'year' ? ' el 1.er año' : '/mes × 3 pagos'}</td>
                    <td className="py-2 text-slate-600">{eur(f.prices[k][iv].normal)}{iv === 'year' ? '/año' : '/mes'}</td>
                  </tr>
                )))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">
              Un único beneficio por negocio. Si cambias entre Pro y Business mantienes el descuento y los ciclos que te queden. Si cancelas durante la promoción, pierdes los ciclos restantes.
              Las pruebas gratis no cuentan como ciclos pagados.
            </p>
          </CardContent>
        </Card>
      </div>

      {f.cycles?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pagos con descuento</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {f.cycles.map((c) => (
                <li key={c.stripe_invoice_id} className="flex justify-between py-2">
                  <span>{fdate(c.created_at)} · {c.billing_interval === 'year' ? 'pago anual' : 'pago mensual'}</span>
                  <span className="font-medium">{eur(c.amount_paid)} · {c.cycles_counted} {c.cycles_counted === 1 ? 'ciclo' : 'ciclos'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

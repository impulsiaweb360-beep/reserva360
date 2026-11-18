'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, Loader2, CreditCard, ExternalLink, AlertTriangle, Sparkles } from 'lucide-react';
import { PLANS } from '@/lib/plans';
import { track } from '@/lib/analytics';

const eur = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

export default function BillingSettings() {
  const [s, setS] = useState(null);
  const [interval, setInterval_] = useState('month');
  const [busy, setBusy] = useState(null);

  const load = async () => {
    const r = await fetch('/api/billing/status');
    setS(r.ok ? await r.json() : { error: (await r.json().catch(() => ({}))).error || 'Error' });
  };

  useEffect(() => {
    (async () => {
      const sp = new URLSearchParams(window.location.search);
      const sessionId = sp.get('session_id');
      if (sp.get('billing') === 'success' && sessionId) {
        const r = await fetch(`/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`);
        const j = await r.json().catch(() => ({}));
        if (j.ok) {
          toast.success('¡Suscripción activada! Gracias por confiar en Reserva360.');
          track('subscription_purchase', { plan: j.planId || 'desconocido', currency: 'EUR' });
        }
      } else if (sp.get('billing') === 'cancelled') {
        toast.info('Pago cancelado. No se ha realizado ningún cargo.');
      }
      if (sp.get('connect')) await fetch('/api/connect').catch(() => {});
      if (sp.get('billing') || sp.get('connect')) window.history.replaceState({}, '', '/dashboard');
      await load();
    })();
  }, []);

  const go = async (key, url, body) => {
    setBusy(key);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error || 'No se pudo abrir Stripe');
      window.location.href = j.url;
    } catch (e) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  if (!s) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando plan…</CardContent></Card>;
  if (s.error) return <Card><CardContent className="p-6 text-sm text-rose-600">{s.error}</CardContent></Card>;

  const current = s.effectivePlanId;
  const paid = ['active', 'trialing', 'past_due'].includes(s.subscription?.status);
  const lim = s.usage?.limits || {};

  return (
    <div className="space-y-4" data-testid="billing-settings">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Plan y facturación</CardTitle>
          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100" data-testid="billing-current-plan">
            Plan {PLANS.find((p) => p.id === current)?.name}{s.onTrial ? ' (prueba)' : ''}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {s.migrationNeeded && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mr-1 inline h-4 w-4" /> Falta ejecutar <b>migration-planes-stripe.sql</b> en Supabase para activar los planes.{' '}
              <a className="font-semibold underline" href="/migration-planes-stripe.sql" target="_blank" rel="noreferrer">Descargar SQL</a>
            </div>
          )}
          {!s.stripeConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Los pagos con Stripe aún no están activados en la plataforma.</div>
          )}
          {s.onTrial && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
              <Sparkles className="h-4 w-4" /> Te quedan <b>{s.trialDaysLeft} días</b> de prueba gratis del plan Pro.
            </div>
          )}
          {s.subscription?.status === 'past_due' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">El último cobro ha fallado. Actualiza tu tarjeta en «Gestionar suscripción».</div>
          )}

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Reservas este mes</div>
              <div className="font-semibold" data-testid="billing-usage-bookings">{s.usage.bookings}{lim.monthlyBookings ? ` / ${lim.monthlyBookings}` : ' (ilimitadas)'}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Profesionales</div>
              <div className="font-semibold">{s.usage.employees} / {lim.employees}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Suscripción</div>
              <div className="font-semibold">
                {paid
                  ? `${s.subscription.interval === 'year' ? 'Anual' : 'Mensual'}${s.subscription.currentPeriodEnd ? ` · ${s.subscription.cancelAtPeriodEnd ? 'termina' : 'renueva'} el ${new Date(s.subscription.currentPeriodEnd).toLocaleDateString('es-ES')}` : ''}`
                  : 'Sin suscripción'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 p-1 text-sm sm:w-fit">
            {[['month', 'Mensual'], ['year', 'Anual']].map(([k, l]) => (
              <button key={k} type="button" data-testid={`billing-interval-${k}`} onClick={() => setInterval_(k)}
                className={`rounded-md px-4 py-1.5 font-medium transition ${interval === k ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
                {l}{k === 'year' && <span className="ml-1 text-xs text-emerald-600">ahorra ~8%</span>}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => {
              const isCurrent = p.id === current && (p.key === 'free' ? !paid : paid || s.onTrial);
              const price = interval === 'year' ? p.yearly : p.monthly;
              return (
                <div key={p.id} data-testid={`plan-card-${p.key}`}
                  className={`relative flex flex-col rounded-xl border p-5 ${p.popular ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}>
                  {p.popular && <Badge className="absolute -top-2.5 left-4 bg-indigo-600">Más popular</Badge>}
                  <div className="text-lg font-bold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.tagline}</div>
                  <div className="my-3">
                    <span className="text-3xl font-extrabold">{eur(price)}</span>
                    <span className="text-sm text-slate-500">{p.key === 'free' ? '' : interval === 'year' ? ' /año' : ' /mes'}</span>
                  </div>
                  <ul className="mb-4 flex-1 space-y-1.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}</li>
                    ))}
                  </ul>
                  {p.key === 'free' ? (
                    <Button variant="outline" disabled>{isCurrent ? 'Plan actual' : 'Incluido al cancelar'}</Button>
                  ) : paid ? (
                    <Button variant={isCurrent ? 'outline' : 'default'} disabled={busy === 'portal' || !s.stripeConfigured}
                      onClick={() => go('portal', '/api/billing/portal')}>
                      {isCurrent ? 'Plan actual' : `Cambiar a ${p.name}`}
                    </Button>
                  ) : (
                    <Button data-testid={`plan-subscribe-${p.key}`} disabled={!!busy || !s.stripeConfigured || s.migrationNeeded}
                      onClick={() => go(p.key, '/api/billing/checkout', { plan: p.key, interval })}>
                      {busy === p.key && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                      Suscribirme a {p.name}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {s.subscription?.hasCustomer && (
            <Button variant="outline" onClick={() => go('portal', '/api/billing/portal')} disabled={busy === 'portal'}>
              <CreditCard className="mr-1 h-4 w-4" /> Gestionar suscripción, tarjeta y facturas
            </Button>
          )}
        </CardContent>
      </Card>

      <Card data-testid="connect-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Cobrar a tus clientes con Stripe</CardTitle>
          {s.connect.chargesEnabled
            ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Conectado</Badge>
            : <Badge variant="outline">{s.connect.accountId ? 'Pendiente de completar' : 'Sin conectar'}</Badge>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">
            Conecta tu propia cuenta de Stripe para cobrar las citas online (completas o una señal). El dinero llega directamente a tu cuenta;
            Reserva360 no cobra comisión (solo la tarifa de Stripe). Después elige en cada servicio cómo se paga.
          </p>
          {current !== 'plan_business' ? (
            <div className="rounded-lg bg-slate-50 p-3 text-slate-600">Los pagos online y depósitos están incluidos en el plan <b>Business</b>.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!s.connect.chargesEnabled && (
                <Button data-testid="connect-stripe" onClick={() => go('connect', '/api/connect', { action: 'onboard' })} disabled={!!busy || !s.stripeConfigured}>
                  {busy === 'connect' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {s.connect.accountId ? 'Completar datos en Stripe' : 'Conectar Stripe'}
                </Button>
              )}
              {s.connect.accountId && (
                <Button variant="outline" onClick={() => go('cdash', '/api/connect', { action: 'dashboard' })} disabled={!!busy}>
                  <ExternalLink className="mr-1 h-4 w-4" /> Abrir mi panel de Stripe
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

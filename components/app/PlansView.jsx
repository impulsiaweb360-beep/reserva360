'use client';

import { useState } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { PLANS, effectivePlanId } from '@/lib/plans';

export default function PlansView() {
  const { tenants } = useApp();
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(null);

  const runSetup = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/billing/setup', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Error');
      setSetup(j);
      toast.success('Stripe configurado: precios y webhooks listos');
    } catch (e) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  const countBy = (planId) => tenants.filter((t) => effectivePlanId({
    plan_id: t.plan, subscription_status: t.subscriptionStatus, trial_ends_at: t.trialEndsAt,
  }) === planId).length;

  return (
    <div className="space-y-6">
      <Card data-testid="stripe-setup-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4" /> Configuración de Stripe</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">
            Crea en tu cuenta de Stripe los productos y precios de Pro y Business (mensual y anual) y los webhooks de esta web
            (suscripciones y Connect). Es seguro pulsarlo varias veces. Vuelve a pulsarlo cuando publiques la app en su dominio definitivo.
          </p>
          <Button onClick={runSetup} disabled={busy} data-testid="stripe-setup-run">
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Configurar Stripe ahora
          </Button>
          {setup && (
            <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs">
              {Object.entries(setup.webhooks || {}).map(([k, w]) => <div key={k}>webhook {k}: {w.status} · {w.url}</div>)}
              {Object.entries(setup.prices || {}).map(([k, id]) => <div key={k}>precio {k}: {id}</div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.id} className={p.popular ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">{p.name}</CardTitle>
              <Badge variant="outline">{countBy(p.id)} negocios</Badge>
            </CardHeader>
            <CardContent>
              <div className="mb-3 text-2xl font-extrabold">
                {p.monthly ? `${p.monthly.toLocaleString('es-ES')} €/mes` : 'Gratis'}
                {p.yearly > 0 && <div className="text-sm font-medium text-slate-500">{p.yearly} €/año</div>}
              </div>
              <ul className="space-y-1.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-slate-500">Los negocios en prueba de 14 días cuentan como Pro.</p>
    </div>
  );
}

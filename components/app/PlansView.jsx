'use client';

import { useState } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';

// Configuración de planes (mensual + anual)
const PLAN_CONFIG = {
  plan_starter: {
    name: 'Starter',
    desc: 'Para profesionales independientes que empiezan.',
    monthly: 19,
    annual: 199,
    features: ['1 empleado', '100 reservas/mes', 'Recordatorios por email', 'Página pública de reservas', 'Soporte por email'],
    popular: false,
    hidden: false,
  },
  plan_pro: {
    name: 'Pro',
    desc: 'Para negocios en crecimiento que necesitan más potencia.',
    monthly: 29,
    annual: 299,
    features: ['Plan Starter +', 'Hasta 10 empleados', 'Reservas ilimitadas', 'Pagos online con Stripe', 'Métricas avanzadas', 'Soporte prioritario'],
    popular: true,
    hidden: false,
  },
  plan_business: {
    name: 'Business',
    desc: 'Para clínicas y franquicias con varias sedes.',
    monthly: 99,
    annual: 999,
    features: ['Plan Pro +', 'Empleados ilimitados', 'Multi-sede', 'SMS + WhatsApp', 'API y Webhooks', 'Marca personalizada', 'Soporte dedicado'],
    popular: false,
    hidden: true,
  },
};

export default function PlansView() {
  const { tenants } = useApp();
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'

  const visiblePlans = Object.entries(PLAN_CONFIG)
    .filter(([_, p]) => !p.hidden)
    .map(([id, p]) => ({ id, ...p }));

  return (
    <div className="space-y-6">
      {/* Toggle mensual / anual */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setBilling('monthly')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              billing === 'monthly' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
            }`}>
            Mensual
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition flex items-center gap-2 ${
              billing === 'annual' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
            }`}>
            Anual
            <Badge variant="secondary" className={`text-[10px] ${billing === 'annual' ? 'bg-emerald-500 text-white hover:bg-emerald-500' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'}`}>
              <Sparkles className="mr-1 h-2.5 w-2.5" /> Ahorra
            </Badge>
          </button>
        </div>
      </div>

      {/* Cards de planes */}
      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
        {visiblePlans.map((p) => {
          const price = billing === 'monthly' ? p.monthly : p.annual;
          const period = billing === 'monthly' ? '/mes' : '/año';
          const count = tenants.filter((t) => t.plan === p.id && t.status === 'active').length;
          const mrr = count * p.monthly;
          const monthlySavingsLabel = billing === 'annual'
            ? `Equivale a ${(p.annual / 12).toFixed(2)}€/mes · ahorras ${(p.monthly * 12 - p.annual)}€`
            : null;

          return (
            <Card key={p.id} className={p.popular ? 'border-2 border-indigo-500 shadow-2xl md:scale-105' : 'border-slate-200'}>
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  {p.popular && <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Más popular</Badge>}
                </div>
                <p className="mt-2 text-sm text-slate-600">{p.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">{price}€</span>
                  <span className="text-slate-500">{period}</span>
                </div>
                {monthlySavingsLabel && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">{monthlySavingsLabel}</p>
                )}

                <ul className="mt-6 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> {f}</li>
                  ))}
                </ul>

                <div className="mt-6 grid grid-cols-2 gap-2 border-t pt-4">
                  <div>
                    <div className="text-xs text-slate-500">Tenants</div>
                    <div className="text-xl font-bold">{count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">MRR</div>
                    <div className="text-xl font-bold text-emerald-600">{mrr}€</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-500">
        Los precios anuales se cobran una sola vez al año. Cambio o cancelación en cualquier momento desde el panel de cada tenant.
      </p>
    </div>
  );
}

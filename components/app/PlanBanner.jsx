'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertTriangle } from 'lucide-react';

// Aviso superior: días de prueba, límite de reservas alcanzado o pago fallido
export default function PlanBanner({ onUpgrade }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    fetch('/api/billing/status').then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  }, []);
  if (!s || s.migrationNeeded) return null;

  let tone = null;
  let text = null;
  if (s.subscription?.status === 'past_due') {
    tone = 'rose';
    text = 'No hemos podido cobrar tu suscripción. Actualiza tu tarjeta para no perder tu plan.';
  } else if (s.usage?.bookingsLimitReached) {
    tone = 'rose';
    text = `Has llegado a ${s.usage.limits.monthlyBookings} reservas este mes. Las reservas online nuevas están en pausa: sube a Pro para tener reservas ilimitadas.`;
  } else if (s.onTrial) {
    tone = 'indigo';
    text = `Estás probando el plan Pro gratis: te quedan ${s.trialDaysLeft} ${s.trialDaysLeft === 1 ? 'día' : 'días'}. Después pasarás al plan Free si no te suscribes.`;
  } else if (s.effectivePlanId === 'plan_free' && s.usage?.limits?.monthlyBookings) {
    const left = s.usage.limits.monthlyBookings - s.usage.bookings;
    if (left <= 10) {
      tone = 'amber';
      text = `Plan Free: te quedan ${left} reservas este mes.`;
    }
  }
  if (!text) return null;

  const cls = {
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  }[tone];
  const Icon = tone === 'indigo' ? Sparkles : AlertTriangle;
  return (
    <div className={`mb-4 flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${cls}`} data-testid="plan-banner">
      <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{text}</span></div>
      <Button size="sm" onClick={onUpgrade} data-testid="plan-banner-upgrade">Ver planes</Button>
    </div>
  );
}

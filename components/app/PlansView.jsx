'use client';

import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export default function PlansView() {
  const { plans, tenants } = useApp();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p, idx) => {
          const count = tenants.filter((t) => t.plan === p.id && t.status === 'active').length;
          const mrr = count * p.price;
          const featured = idx === 1;
          return (
            <Card key={p.id} className={featured ? 'border-indigo-500 shadow-xl' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  {featured && <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Popular</Badge>}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{p.price}€</span>
                  <span className="text-sm text-slate-500">/{p.interval}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {f}</li>
                  ))}
                </ul>
                <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4">
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
    </div>
  );
}

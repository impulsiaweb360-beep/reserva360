'use client';

import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { PAYMENT_STATUS } from '@/lib/mockData';
import dayjs from 'dayjs';

export default function PaymentsList({ tenantId }) {
  const { byTenant, clients, services } = useApp();
  const appts = byTenant('appointments', tenantId);

  const paid = appts.filter((a) => a.payment?.status === 'paid');
  const pending = appts.filter((a) => a.payment?.status === 'pending');
  const failed = appts.filter((a) => a.payment?.status === 'failed');
  const total = paid.reduce((s, a) => s + (a.payment?.amount || 0), 0);
  const pendingTotal = pending.reduce((s, a) => s + (a.payment?.amount || 0), 0);

  const stat = (label, value, sub, color, Icon) => (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${color}-100 text-${color}-600`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {stat('Ingresos cobrados', `${total} €`, `${paid.length} pagos`, 'emerald', TrendingUp)}
        {stat('Pendiente', `${pendingTotal} €`, `${pending.length} pagos`, 'amber', Clock)}
        {stat('Fallidos', failed.length, 'Requieren acción', 'rose', AlertCircle)}
        {stat('Stripe activo', 'Sí', 'Cuenta conectada', 'indigo', CreditCard)}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Pagos recientes</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 text-left font-medium">Fecha</th>
                <th className="text-left font-medium">Cliente</th>
                <th className="text-left font-medium">Servicio</th>
                <th className="text-left font-medium">Método</th>
                <th className="text-right font-medium">Importe</th>
                <th className="text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {appts.sort((a, b) => new Date(b.start) - new Date(a.start)).map((a) => {
                const cli = clients.find((c) => c.id === a.clientId);
                const svc = services.find((s) => s.id === a.serviceId);
                const pay = PAYMENT_STATUS[a.payment?.status];
                return (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-3">{dayjs(a.start).format('DD/MM/YY HH:mm')}</td>
                    <td>{cli?.firstName} {cli?.lastName}</td>
                    <td>{svc?.name}</td>
                    <td className="capitalize">{a.payment?.method === 'stripe' ? 'Stripe' : a.payment?.method === 'onsite' ? 'Presencial' : 'Parcial'}</td>
                    <td className="text-right font-semibold">{a.payment?.amount}€</td>
                    <td className="text-right"><Badge variant="secondary" className={pay.color}>{pay.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

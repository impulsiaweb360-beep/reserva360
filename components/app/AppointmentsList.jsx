'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { STATUS_CONFIG, PAYMENT_STATUS } from '@/lib/mockData';
import { Search, Eye } from 'lucide-react';
import AppointmentDetailDialog from './AppointmentDetailDialog';

export default function AppointmentsList({ tenantId, lockEmployeeId = null }) {
  const { byTenant, employees, clients, services } = useApp();
  const all = byTenant('appointments', tenantId);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [detailId, setDetailId] = useState(null);

  let list = all;
  if (lockEmployeeId) list = list.filter((a) => a.employeeId === lockEmployeeId);
  if (status !== 'all') list = list.filter((a) => a.status === status);
  if (q) {
    list = list.filter((a) => {
      const cli = clients.find((c) => c.id === a.clientId);
      return `${cli?.firstName} ${cli?.lastName}`.toLowerCase().includes(q.toLowerCase());
    });
  }
  list = list.sort((a, b) => new Date(b.start) - new Date(a.start));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Reservas ({list.length})</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar cliente..." value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-8" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 text-left font-medium">Fecha</th>
                <th className="text-left font-medium">Cliente</th>
                <th className="text-left font-medium">Servicio</th>
                <th className="text-left font-medium">Empleado</th>
                <th className="text-left font-medium">Estado</th>
                <th className="text-left font-medium">Pago</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const cli = clients.find((c) => c.id === a.clientId);
                const svc = services.find((s) => s.id === a.serviceId);
                const emp = employees.find((e) => e.id === a.employeeId);
                const cfg = STATUS_CONFIG[a.status];
                const pay = PAYMENT_STATUS[a.payment?.status];
                return (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3">
                      <div className="font-medium">{dayjs(a.start).format('DD MMM YYYY')}</div>
                      <div className="text-xs text-slate-500">{dayjs(a.start).format('HH:mm')} – {dayjs(a.end).format('HH:mm')}</div>
                    </td>
                    <td>{cli?.firstName} {cli?.lastName}</td>
                    <td>
                      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: svc?.color }} />{svc?.name}</span>
                    </td>
                    <td>{emp?.firstName} {emp?.lastName}</td>
                    <td><Badge variant="outline" className={cfg.color}>{cfg.label}</Badge></td>
                    <td><Badge variant="secondary" className={pay.color}>{pay.label} · {a.payment?.amount}€</Badge></td>
                    <td className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(a.id)}><Eye className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <div className="py-10 text-center text-sm text-slate-400">Sin reservas</div>}
        </div>
      </CardContent>
      <AppointmentDetailDialog appointmentId={detailId} onOpenChange={(v) => !v && setDetailId(null)} />
    </Card>
  );
}

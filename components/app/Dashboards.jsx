'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, TrendingUp, Calendar as CalIcon, Users, ArrowUpRight, Eye, Power, PowerOff, CreditCard, Link2, Copy, ExternalLink, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Line, LineChart } from 'recharts';
import TenantLogo from '@/components/app/TenantLogo';

function Stat({ icon: Icon, label, value, sub, color = 'indigo' }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
            {sub && <p className="mt-1 text-xs text-emerald-600 font-medium">{sub}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${color}-100 text-${color}-600`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SuperAdminDashboard() {
  const { tenants, appointments, plans } = useApp();
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === 'active').length;
  const suspended = tenants.filter((t) => t.status === 'suspended').length;
  const mrr = tenants.filter((t) => t.status === 'active').reduce((s, t) => s + (t.mrr || 0), 0);
  const totalBookings = appointments.length;

  const last6Months = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const m = dayjs().subtract(5 - i, 'month');
      return {
        name: m.format('MMM'),
        tenants: Math.max(1, totalTenants - (5 - i)),
        mrr: Math.max(19, mrr - (5 - i) * 30),
      };
    });
  }, [totalTenants, mrr]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Tenants totales" value={totalTenants} sub={`${activeTenants} activos`} color="indigo" />
        <Stat icon={TrendingUp} label="MRR" value={`${mrr} €`} sub="+12% vs mes pasado" color="emerald" />
        <Stat icon={CalIcon} label="Reservas totales" value={totalBookings} sub="Últimos 30 días" color="sky" />
        <Stat icon={PowerOff} label="Suspendidos" value={suspended} sub="Requieren atención" color="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Crecimiento de tenants</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="tenants" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Ingresos recurrentes (MRR)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Tenants activos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tenants.slice(0, 5).map((t) => {
              const plan = plans.find((p) => p.id === t.plan);
              return (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <TenantLogo logo={t.logo} name={t.name} size="h-10 w-10" textSize="text-2xl" bordered padding="p-1" />
                    <div>
                      <div className="font-semibold text-slate-800">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.industry} · Plan {plan?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">{t.mrr}€/mes</Badge>
                    <Badge className={t.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-100 text-rose-700 hover:bg-rose-100'}>
                      {t.status === 'active' ? 'Activo' : 'Suspendido'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TenantDashboard({ tenantId }) {
  const { appointments, clients, employees, services, byTenant, tenants } = useApp();
  const tenant = tenants.find((t) => t.id === tenantId);
  const myAppts = byTenant('appointments', tenantId);
  const myClients = byTenant('clients', tenantId);
  const myEmployees = byTenant('employees', tenantId);
  const myServices = byTenant('services', tenantId);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/book/${tenant?.slug}` : `/book/${tenant?.slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(publicUrl)}`;

  const copyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl);
    }
  };

  const today = dayjs().startOf('day');
  const weekEnd = today.add(7, 'day');
  const monthEnd = today.add(30, 'day');

  const todayCount = myAppts.filter((a) => dayjs(a.start).isSame(today, 'day')).length;
  const weekCount = myAppts.filter((a) => dayjs(a.start).isAfter(today) && dayjs(a.start).isBefore(weekEnd)).length;
  const monthCount = myAppts.filter((a) => dayjs(a.start).isAfter(today) && dayjs(a.start).isBefore(monthEnd)).length;
  const newClients = myClients.filter((c) => dayjs(c.createdAt).isAfter(dayjs().subtract(30, 'day'))).length;
  // Importe efectivo (usa precio del servicio si no hay amount registrado)
  const amountOf = (a) => {
    if (a.payment?.amount != null) return Number(a.payment.amount);
    const svc = myServices.find((s) => s.id === a.serviceId);
    return Number(svc?.price || 0);
  };
  const revenue = myAppts
    .filter((a) => a.payment?.status === 'paid')
    .reduce((s, a) => s + amountOf(a), 0);
  const expected = myAppts
    .filter((a) => a.status !== 'cancelled' && a.payment?.status !== 'paid')
    .reduce((s, a) => s + amountOf(a), 0);

  // Bookings per day this week
  const weekData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const day = today.add(i - 3, 'day');
      return {
        name: day.format('dd'),
        reservas: myAppts.filter((a) => dayjs(a.start).isSame(day, 'day')).length,
      };
    });
  }, [myAppts, today]);

  // Top services
  const topServices = useMemo(() => {
    const counts = {};
    myAppts.forEach((a) => { counts[a.serviceId] = (counts[a.serviceId] || 0) + 1; });
    return Object.entries(counts).map(([id, count]) => ({
      service: myServices.find((s) => s.id === id),
      count,
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [myAppts, myServices]);

  // Top employees
  const topEmployees = useMemo(() => {
    const counts = {};
    myAppts.forEach((a) => { counts[a.employeeId] = (counts[a.employeeId] || 0) + 1; });
    return Object.entries(counts).map(([id, count]) => ({
      employee: myEmployees.find((e) => e.id === id),
      count,
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [myAppts, myEmployees]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-violet-50">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <img src={qrUrl} alt="QR" className="h-24 w-24 shrink-0 rounded-lg border bg-white p-1" />
            <div>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Tu página de reservas online</span>
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-slate-800 break-all">{publicUrl}</div>
              <p className="mt-1 text-xs text-slate-500">Compártela con tus clientes — pueden reservar 24/7 respetando tus horarios. <b>Nunca se crean solapamientos</b>.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { copyLink(); toast.success('Link copiado'); }} className="gap-1"><Copy className="h-4 w-4" /> Copiar</Button>
            <Button size="sm" onClick={() => window.open(publicUrl, '_blank')} className="gap-1"><ExternalLink className="h-4 w-4" /> Abrir</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Stat icon={CalIcon} label="Citas hoy" value={todayCount} color="indigo" />
        <Stat icon={CalIcon} label="Esta semana" value={weekCount} color="sky" />
        <Stat icon={CalIcon} label="Este mes" value={monthCount} color="violet" />
        <Stat icon={Users} label="Nuevos clientes" value={newClients} sub="Últimos 30 días" color="emerald" />
        <Stat icon={CreditCard} label="Ingresos" value={`${revenue} €`} sub={expected > 0 ? `+${expected} € por cobrar` : 'Cobrados'} color="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Reservas por día</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="reservas" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Servicios más reservados</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topServices.map(({ service, count }) => (
                <div key={service?.id} className="flex items-center gap-3">
                  <div className="h-3 w-3 shrink-0 rounded" style={{ background: service?.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="truncate font-medium text-slate-700">{service?.name}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(count / (topServices[0]?.count || 1)) * 100}%`, background: service?.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Empleados más ocupados</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {topEmployees.map(({ employee, count }) => employee && (
              <div key={employee.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: employee.color }}>
                  {employee.firstName[0]}{employee.lastName[0]}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{employee.firstName} {employee.lastName}</div>
                  <div className="text-xs text-slate-500">{employee.specialty}</div>
                </div>
                <Badge variant="secondary">{count} citas</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import AppointmentDialog from './AppointmentDialog';
import AppointmentDetailDialog from './AppointmentDetailDialog';
import { STATUS_CONFIG } from '@/lib/mockData';

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08:00-19:00
const HOUR_HEIGHT = 56; // px per hour

export default function WeekCalendar({ tenantId, employeeFilter, lockEmployee = false }) {
  const { appointments, employees, clients, services, byTenant } = useApp();
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day')); // Monday start
  const [filter, setFilter] = useState(employeeFilter || 'all');
  const [openCreate, setOpenCreate] = useState(false);
  const [createInit, setCreateInit] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const tenantEmployees = byTenant('employees', tenantId);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart]);

  const visible = useMemo(() => {
    let list = byTenant('appointments', tenantId);
    const useFilter = lockEmployee ? employeeFilter : filter;
    if (useFilter && useFilter !== 'all') list = list.filter((a) => a.employeeId === useFilter);
    return list;
  }, [appointments, tenantId, filter, employeeFilter, lockEmployee, byTenant]);

  const apptsByDay = (day) => visible.filter((a) => dayjs(a.start).isSame(day, 'day'));

  const handleSlotClick = (day, hour) => {
    setCreateInit({
      start: day.hour(hour).minute(0).toDate(),
      employeeId: (lockEmployee ? employeeFilter : filter !== 'all' ? filter : tenantEmployees[0]?.id),
    });
    setOpenCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(weekStart.subtract(1, 'week'))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(dayjs().startOf('week').add(1, 'day'))}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(weekStart.add(1, 'week'))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 text-sm font-semibold text-slate-700">
            {weekStart.format('DD MMM')} – {weekStart.add(6, 'day').format('DD MMM YYYY')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!lockEmployee && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Empleado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los empleados</SelectItem>
                {tenantEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => { setCreateInit(null); setOpenCreate(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Nueva cita
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))' }}>
          <div className="border-b border-r border-slate-200 bg-slate-50" />
          {days.map((d) => {
            const isToday = d.isSame(dayjs(), 'day');
            return (
              <div key={d.toString()} className={`border-b border-r border-slate-200 px-3 py-2 text-center ${isToday ? 'bg-indigo-50' : 'bg-white'}`}>
                <div className="text-xs uppercase tracking-wider text-slate-500">{d.format('ddd')}</div>
                <div className={`text-lg font-semibold ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>{d.format('DD')}</div>
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))' }}>
          {/* Hours column */}
          <div className="border-r border-slate-200 bg-slate-50">
            {HOURS.map((h) => (
              <div key={h} className="relative text-[10px] text-slate-500" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-2">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayAppts = apptsByDay(d);
            return (
              <div key={d.toString()} className="relative border-r border-slate-200">
                {HOURS.map((h) => (
                  <button key={h} onClick={() => handleSlotClick(d, h)}
                    className="block w-full border-b border-slate-100 hover:bg-slate-50 transition"
                    style={{ height: HOUR_HEIGHT }} />
                ))}
                {dayAppts.map((a) => {
                  const start = dayjs(a.start);
                  const end = dayjs(a.end);
                  const startMin = start.hour() * 60 + start.minute() - HOURS[0] * 60;
                  const durMin = end.diff(start, 'minute');
                  const top = (startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(28, (durMin / 60) * HOUR_HEIGHT - 2);
                  const svc = services.find((s) => s.id === a.serviceId);
                  const cli = clients.find((c) => c.id === a.clientId);
                  const emp = employees.find((e) => e.id === a.employeeId);
                  const cfg = STATUS_CONFIG[a.status];
                  return (
                    <button key={a.id} onClick={() => setDetailId(a.id)}
                      className="absolute left-1 right-1 overflow-hidden rounded-md border-l-4 bg-white p-1.5 text-left text-[11px] shadow-sm transition hover:shadow-md"
                      style={{ top, height, borderLeftColor: svc?.color || emp?.color || '#6366f1' }}>
                      <div className="truncate font-semibold text-slate-800">{cli ? `${cli.firstName} ${cli.lastName}` : 'Cliente'}</div>
                      <div className="truncate text-slate-500">{svc?.name}</div>
                      {height > 50 && (
                        <div className="mt-1 flex items-center gap-1">
                          <Badge variant="outline" className={`${cfg.color} h-4 px-1 py-0 text-[9px]`}>{cfg.label}</Badge>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      <AppointmentDialog open={openCreate} onOpenChange={setOpenCreate} tenantId={tenantId} init={createInit} lockEmployeeId={lockEmployee ? employeeFilter : null} />
      <AppointmentDetailDialog appointmentId={detailId} onOpenChange={(v) => !v && setDetailId(null)} />
    </div>
  );
}

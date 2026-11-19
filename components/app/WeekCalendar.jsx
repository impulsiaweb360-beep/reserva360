'use client';

import { useMemo, useState, useEffect } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { useApp } from '@/lib/supabase-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, LayoutGrid, AlertTriangle } from 'lucide-react';
import AppointmentDialog from './AppointmentDialog';
import AppointmentDetailDialog from './AppointmentDetailDialog';
import { STATUS_CONFIG } from '@/lib/mockData';
import { checkMove } from '@/lib/appointment-move';
import { toast } from 'sonner';

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08:00-19:00
const HOUR_HEIGHT = 56; // px per hour
const SNAP = 15; // minutos
const DRAGGABLE = ['pending', 'confirmed'];

// Lunes de la semana de una fecha (independiente del locale: lunes → domingo)
const mondayOf = (d) => dayjs(d).startOf('day').subtract((dayjs(d).day() + 6) % 7, 'day');

export default function WeekCalendar({ tenantId, employeeFilter, lockEmployee = false }) {
  const { appointments, employees, clients, services, byTenant, tenants, appointmentsApi } = useApp();
  const [drag, setDrag] = useState(null); // { id, grabMin, duration }
  const [preview, setPreview] = useState(null); // { dayKey, minutes }
  const [weekStart, setWeekStart] = useState(() => mondayOf(dayjs())); // Lunes
  const [filter, setFilter] = useState(employeeFilter || 'all');
  const [openCreate, setOpenCreate] = useState(false);
  const [createInit, setCreateInit] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'day'
  const [selectedDay, setSelectedDay] = useState(dayjs().startOf('day'));

  // Auto switch to day mode on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const onResize = () => {
        if (window.innerWidth < 768) setViewMode('day');
        else setViewMode('week');
      };
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, []);

  const tenantEmployees = byTenant('employees', tenantId);

  const days = useMemo(() => {
    if (viewMode === 'day') return [selectedDay];
    return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  }, [weekStart, viewMode, selectedDay]);

  const visible = useMemo(() => {
    let list = byTenant('appointments', tenantId);
    const useFilter = lockEmployee ? employeeFilter : filter;
    if (useFilter && useFilter !== 'all') list = list.filter((a) => a.employeeId === useFilter);
    return list;
  }, [appointments, tenantId, filter, employeeFilter, lockEmployee, byTenant]);

  const apptsByDay = (day) => visible.filter((a) => dayjs(a.start).isSame(day, 'day'));

  // ---------- Arrastrar y soltar ----------
  const minutesFromEvent = (e, grabMin = 0) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const raw = (y / HOUR_HEIGHT) * 60 - grabMin;
    const snapped = Math.round(raw / SNAP) * SNAP;
    return Math.max(0, Math.min(HOURS.length * 60 - SNAP, snapped)) + HOURS[0] * 60;
  };

  const onDragStart = (e, a) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const grabMin = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', a.id); } catch { /* */ }
    setDrag({ id: a.id, grabMin, duration: dayjs(a.end).diff(dayjs(a.start), 'minute') });
  };

  const onDragEnd = () => { setDrag(null); setPreview(null); };

  const onDragOverDay = (e, d) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const minutes = minutesFromEvent(e, drag.grabMin);
    const dayKey = d.format('YYYY-MM-DD');
    if (!preview || preview.dayKey !== dayKey || preview.minutes !== minutes) setPreview({ dayKey, minutes });
  };

  const onDropDay = async (e, d) => {
    if (!drag) return;
    e.preventDefault();
    const minutes = minutesFromEvent(e, drag.grabMin);
    const a = appointments.find((x) => x.id === drag.id);
    setDrag(null);
    setPreview(null);
    if (!a) return;
    const newStart = d.startOf('day').add(minutes, 'minute');
    const newEnd = newStart.add(drag.duration, 'minute');
    if (newStart.isSame(dayjs(a.start))) return;
    const tenant = tenants.find((t) => t.id === a.tenantId);
    const employee = employees.find((x) => x.id === a.employeeId);
    const check = checkMove({ start: newStart, end: newEnd, tenant, employee, employeeId: a.employeeId, tenantId: a.tenantId, appointments, excludeId: a.id });
    if (!check.ok) { toast.error(check.reason); return; }
    for (const w of check.warnings) {
      if (!window.confirm(`⚠️ ${w}\n\n¿Mover la cita igualmente?`)) return;
    }
    const cli = clients.find((c) => c.id === a.clientId);
    const ok = window.confirm(
      `¿Mover la cita${cli ? ` de ${cli.firstName} ${cli.lastName || ''}`.trimEnd() : ''} al ${newStart.format('dddd D [de] MMMM')} a las ${newStart.format('HH:mm')}?\n\nSi tienes WhatsApp conectado, se avisará al cliente del cambio.`
    );
    if (!ok) return;
    try {
      await appointmentsApi.update(a.id, { start: newStart.toISOString(), end: newEnd.toISOString() });
      toast.success(`Cita movida al ${newStart.format('ddd D MMM, HH:mm')}`);
    } catch (err) {
      toast.error(`No se pudo mover la cita: ${err?.message || 'error desconocido'}`);
    }
  };

  const handleSlotClick = (day, hour) => {
    setCreateInit({
      start: day.hour(hour).minute(0).toDate(),
      employeeId: (lockEmployee ? employeeFilter : filter !== 'all' ? filter : tenantEmployees[0]?.id),
    });
    setOpenCreate(true);
  };

  // Day chips for quick navigation (mobile)
  const dayChips = useMemo(() => {
    const base = dayjs().startOf('day');
    return Array.from({ length: 14 }, (_, i) => base.add(i, 'day'));
  }, []);

  const gridCols = viewMode === 'day'
    ? '60px minmax(0, 1fr)'
    : '60px repeat(7, minmax(0, 1fr))';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'week' ? (
            <>
              <Button variant="outline" size="icon" onClick={() => setWeekStart(weekStart.subtract(1, 'week'))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekStart(mondayOf(dayjs()))}>Hoy</Button>
              <Button variant="outline" size="icon" onClick={() => setWeekStart(weekStart.add(1, 'week'))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-1 text-sm font-semibold text-slate-700">
                {weekStart.format('DD MMM')} – {weekStart.add(6, 'day').format('DD MMM YYYY')}
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" onClick={() => setSelectedDay(selectedDay.subtract(1, 'day'))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDay(dayjs().startOf('day'))}>Hoy</Button>
              <Button variant="outline" size="icon" onClick={() => setSelectedDay(selectedDay.add(1, 'day'))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-1 text-sm font-semibold text-slate-700">
                {selectedDay.format('ddd DD MMM YYYY')}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle - hidden on small screens (forced to day) */}
          <div className="hidden md:flex rounded-md border border-slate-200 p-0.5">
            <button onClick={() => setViewMode('week')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${viewMode === 'week' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Semana
            </button>
            <button onClick={() => setViewMode('day')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${viewMode === 'day' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              <CalendarDays className="h-3.5 w-3.5" /> Día
            </button>
          </div>
          {!lockEmployee && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 md:w-56"><SelectValue placeholder="Empleado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los empleados</SelectItem>
                {tenantEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => { setCreateInit(null); setOpenCreate(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva cita</span>
          </Button>
        </div>
      </div>

      {/* Day picker chips (visible in day mode) */}
      {viewMode === 'day' && (
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex gap-1 px-1">
            {dayChips.map((d) => {
              const isActive = d.isSame(selectedDay, 'day');
              const isToday = d.isSame(dayjs(), 'day');
              const count = visible.filter((a) => dayjs(a.start).isSame(d, 'day')).length;
              return (
                <button key={d.toString()} onClick={() => setSelectedDay(d)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-center transition ${
                    isActive ? 'border-slate-900 bg-slate-900 text-white' : isToday ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">{d.format('ddd')}</div>
                  <div className="text-base font-bold">{d.format('DD')}</div>
                  {count > 0 && <div className={`mt-0.5 text-[9px] font-semibold ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`}>{count} citas</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="hidden text-xs text-slate-500 md:block">
        Consejo: arrastra una cita a otra hora o a otro día para cambiarla. Solo se permite dentro del horario del negocio y del empleado. Haz clic en una cita para ver el detalle o modificarla.
      </p>

      <Card className="overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
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

        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
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
            // Detectar solapamientos: marcar cada cita con flag overlap si se solapa con otra del mismo empleado
            const overlapIds = new Set();
            for (let i = 0; i < dayAppts.length; i++) {
              for (let j = i + 1; j < dayAppts.length; j++) {
                const a = dayAppts[i], b = dayAppts[j];
                if (a.employeeId !== b.employeeId) continue;
                if (a.status === 'cancelled' || b.status === 'cancelled') continue;
                if (dayjs(a.start).isBefore(b.end) && dayjs(a.end).isAfter(b.start)) {
                  overlapIds.add(a.id);
                  overlapIds.add(b.id);
                }
              }
            }
            return (
              <div key={d.toString()} className="relative border-r border-slate-200"
                data-testid={`cal-day-${d.format('YYYY-MM-DD')}`}
                onDragOver={(e) => onDragOverDay(e, d)}
                onDrop={(e) => onDropDay(e, d)}>
                {HOURS.map((h) => (
                  <button key={h} onClick={() => handleSlotClick(d, h)}
                    className="block w-full border-b border-slate-100 hover:bg-slate-50 transition"
                    style={{ height: HOUR_HEIGHT }} />
                ))}
                {drag && preview?.dayKey === d.format('YYYY-MM-DD') && (
                  <div className="pointer-events-none absolute left-1 right-1 z-20 rounded-md border-2 border-dashed border-indigo-500 bg-indigo-100/70 p-1 text-[11px] font-semibold text-indigo-800"
                    style={{ top: ((preview.minutes - HOURS[0] * 60) / 60) * HOUR_HEIGHT, height: Math.max(28, (drag.duration / 60) * HOUR_HEIGHT - 2) }}>
                    {dayjs().startOf('day').add(preview.minutes, 'minute').format('HH:mm')} – {dayjs().startOf('day').add(preview.minutes + drag.duration, 'minute').format('HH:mm')}
                  </div>
                )}
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
                  const isOverlap = overlapIds.has(a.id);
                  const canDrag = DRAGGABLE.includes(a.status);
                  return (
                    <button key={a.id} onClick={() => setDetailId(a.id)}
                      draggable={canDrag}
                      onDragStart={canDrag ? (e) => onDragStart(e, a) : undefined}
                      onDragEnd={onDragEnd}
                      data-testid={`cal-appt-${a.id}`}
                      title={canDrag ? 'Haz clic para ver o modificar · Arrastra para cambiar la hora o el día' : 'Haz clic para ver el detalle'}
                      className={`absolute left-1 right-1 overflow-hidden rounded-md border-l-4 p-1.5 text-left text-[11px] shadow-sm transition hover:shadow-md ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${drag?.id === a.id ? 'opacity-40' : ''} ${isOverlap ? 'bg-rose-50 ring-2 ring-rose-400 ring-offset-1' : 'bg-white'}`}
                      style={{ top, height, borderLeftColor: svc?.color || emp?.color || '#6366f1' }}>
                      {isOverlap && (
                        <span className="absolute right-1 top-1 flex h-4 items-center gap-0.5 rounded bg-rose-500 px-1 text-[8px] font-bold text-white">
                          <AlertTriangle className="h-2.5 w-2.5" /> SOLAPADA
                        </span>
                      )}
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

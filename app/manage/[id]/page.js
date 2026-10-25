'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { getAvailableSlots } from '@/lib/booking';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarClock, User, Briefcase, MapPin, Phone, CheckCircle2, XCircle,
  AlertCircle,
} from 'lucide-react';

const STATUS = {
  pending:   { label: 'Pendiente',  color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completada', color: 'bg-sky-100 text-sky-800' },
  cancelled: { label: 'Cancelada',  color: 'bg-rose-100 text-rose-800' },
  no_show:   { label: 'No asistió', color: 'bg-zinc-200 text-zinc-700' },
};

export default function ManagePage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState(null);
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [date, setDate] = useState(dayjs().startOf('day'));
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/public/appointment/${id}`);
    if (r.ok) {
      const j = await r.json();
      setAppt(j);
      const apptDay = dayjs(j.start_at).startOf('day');
      setDate(apptDay.isBefore(dayjs().startOf('day')) ? dayjs().startOf('day') : apptDay);
    } else {
      setErr('Reserva no encontrada o link inválido');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Si se llega desde el email con ?action=reschedule, abrir directamente el selector de horario
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const action = new URLSearchParams(window.location.search).get('action');
    if (action === 'reschedule') setRescheduleOpen(true);
  }, []);

  // Próximos 30 días para elegir
  const dayOptions = useMemo(
    () => Array.from({ length: 30 }, (_, i) => dayjs().startOf('day').add(i, 'day')),
    []
  );

  // Carga los slots ocupados cuando se cambia de día o se abre el modo reprogramar
  useEffect(() => {
    if (!rescheduleOpen || !appt?.tenant?.slug) return;
    (async () => {
      setLoadingSlots(true);
      setSlot(null);
      const url = `/api/public/${appt.tenant.slug}/availability?date=${date.format('YYYY-MM-DD')}&employee_id=${appt.employee_id}`;
      try {
        const r = await fetch(url);
        if (r.ok) {
          const j = await r.json();
          setBusy(
            (j.busy || [])
              .filter((b) => !b.employee_id || b.employee_id === appt.employee_id)
              .map((b) => ({ start: b.start, end: b.end }))
          );
        } else {
          setBusy([]);
        }
      } catch {
        setBusy([]);
      }
      setLoadingSlots(false);
    })();
  }, [rescheduleOpen, date, appt?.tenant?.slug, appt?.employee_id]);

  // Construye tenant / employee / service con formato esperado por getAvailableSlots
  const bookingContext = useMemo(() => {
    if (!appt?.tenant) return null;
    const tenant = {
      id: appt.tenant_id,
      businessHours: appt.tenant.business_hours,
      vacations: appt.tenant.vacations,
    };
    const employee = {
      id: appt.employee_id,
      // Si tiene schedule propio, usarlo; si no, null (hereda de business hours)
      schedule:
        appt.employee?.schedule && Object.keys(appt.employee.schedule).length > 0
          ? appt.employee.schedule
          : null,
    };
    const service = { duration: appt.service?.duration_minutes || 60 };
    // Excluir la propia cita de los busy slots (para que su propio horario esté libre)
    const ownStart = new Date(appt.start_at).getTime();
    const ownEnd = new Date(appt.end_at).getTime();
    const otherBusy = busy.filter(
      (b) => !(new Date(b.start).getTime() === ownStart && new Date(b.end).getTime() === ownEnd)
    );
    return { tenant, employee, service, otherBusy };
  }, [appt, busy]);

  const slots = useMemo(() => {
    if (!bookingContext) return [];
    return getAvailableSlots({
      date: date.toDate(),
      service: bookingContext.service,
      tenant: bookingContext.tenant,
      employee: bookingContext.employee,
      appointments: bookingContext.otherBusy.map((b) => ({
        tenantId: bookingContext.tenant.id,
        employeeId: bookingContext.employee.id,
        status: 'confirmed',
        start: b.start,
        end: b.end,
      })),
    });
  }, [bookingContext, date]);

  const cancel = async () => {
    if (!window.confirm('¿Seguro que quieres CANCELAR tu cita?')) return;
    setSubmitting(true);
    const r = await fetch(`/api/public/appointment/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    setSubmitting(false);
    if (r.ok) {
      setSuccess('Tu cita ha sido cancelada.');
      await load();
    } else {
      const j = await r.json();
      setErr(j.error || 'Error');
    }
  };

  const reschedule = async () => {
    if (!slot) {
      setErr('Selecciona un horario disponible.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    const r = await fetch(`/api/public/appointment/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'reschedule',
        start_at: new Date(slot).toISOString(),
        tz_offset: new Date(slot).getTimezoneOffset(),
      }),
    });
    setSubmitting(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setSuccess('Tu cita ha sido reprogramada.');
      setRescheduleOpen(false);
      setSlot(null);
      await load();
    } else {
      setErr(j.error || 'Error al reprogramar');
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );

  if (err && !appt)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
            <h1 className="text-xl font-bold">Error</h1>
            <p className="mt-2 text-sm text-slate-500">{err}</p>
          </CardContent>
        </Card>
      </div>
    );

  if (!appt) return null;

  const cfg = STATUS[appt.status];
  const cancelled = appt.status === 'cancelled';
  const closed = appt.status === 'completed' || appt.status === 'no_show';
  const isPast = new Date(appt.start_at).getTime() < Date.now();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex items-center gap-3 px-6 py-5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden"
            style={{ background: `${appt.tenant?.color}15`, border: `2px solid ${appt.tenant?.color}30` }}
          >
            {appt.tenant?.logo && /^https?:\/\//.test(appt.tenant.logo) ? (
              <img src={appt.tenant.logo} alt={appt.tenant.name} className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-xl">{appt.tenant?.logo || '✨'}</span>
            )}
          </div>
          <div>
            <div className="font-bold" translate="no">{appt.tenant?.name}</div>
            <div className="text-xs text-slate-500">Gestiona tu reserva</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-xl px-6 py-10">
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="mr-1 inline h-4 w-4" />
            {success}
          </div>
        )}
        {err && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {err}
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Tu reserva</h1>
              <Badge className={cfg.color}>{cfg.label}</Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                <CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <div className="font-semibold text-slate-800">
                    {dayjs(appt.start_at).format('dddd D MMMM YYYY')}
                  </div>
                  <div className="text-slate-600">
                    {dayjs(appt.start_at).format('HH:mm')} – {dayjs(appt.end_at).format('HH:mm')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-slate-400" />
                <div>
                  <b>{appt.service?.name}</b> ·{' '}
                  <span className="text-slate-500">
                    {appt.service?.duration_minutes} min · {appt.service?.price}€
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-slate-400" />
                <span>
                  Con <b>{appt.employee?.first_name} {appt.employee?.last_name}</b>
                </span>
              </div>
              {appt.tenant?.address && (
                <div className="flex items-center gap-3" translate="no">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>{appt.tenant.address}</span>
                </div>
              )}
              {appt.tenant?.phone && (
                <div className="flex items-center gap-3" translate="no">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{appt.tenant.phone}</span>
                </div>
              )}
            </div>

            {!cancelled && !closed && !isPast && (
              <div className="space-y-3 border-t pt-4">
                {rescheduleOpen ? (
                  <>
                    <div className="text-sm font-semibold text-slate-800">Elige un nuevo día</div>
                    <div className="flex gap-2 overflow-x-auto pb-2" data-testid="manage-day-picker">
                      {dayOptions.map((d) => {
                        const active = d.isSame(date, 'day');
                        return (
                          <button
                            key={d.format('YYYY-MM-DD')}
                            type="button"
                            data-testid={`manage-day-${d.format('YYYY-MM-DD')}`}
                            onClick={() => setDate(d)}
                            className={`flex min-w-[56px] flex-col items-center rounded-lg border px-2 py-2 text-xs transition ${
                              active
                                ? 'border-indigo-500 bg-indigo-600 text-white'
                                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                            }`}
                          >
                            <span className="capitalize">{d.format('ddd')}</span>
                            <span className="text-base font-bold">{d.format('D')}</span>
                            <span className="capitalize">{d.format('MMM')}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-sm font-semibold capitalize text-slate-800">
                      {date.format('dddd D [de] MMMM')}
                    </div>

                    {loadingSlots ? (
                      <div className="py-6 text-center text-sm text-slate-500">Cargando horarios…</div>
                    ) : slots.length === 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700" data-testid="manage-no-slots">
                        No hay horarios disponibles este día. Prueba otro día.
                      </div>
                    ) : (
                      <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4" data-testid="manage-slots">
                        {slots.map((s) => {
                          const active = slot === s.start;
                          return (
                            <button
                              key={s.start}
                              type="button"
                              data-testid={`manage-slot-${s.label}`}
                              onClick={() => setSlot(s.start)}
                              className={`rounded-md border px-2 py-2 text-sm transition ${
                                active
                                  ? 'border-indigo-500 bg-indigo-600 text-white'
                                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button onClick={reschedule} disabled={submitting || !slot} className="flex-1" data-testid="manage-confirm-reschedule">
                        {submitting ? 'Guardando…' : 'Confirmar nueva fecha'}
                      </Button>
                      <Button variant="outline" onClick={() => { setRescheduleOpen(false); setSlot(null); setErr(null); }}>
                        Volver
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="w-full" data-testid="manage-open-reschedule" onClick={() => { setRescheduleOpen(true); setErr(null); setSuccess(null); }}>
                      Modificar cita
                    </Button>
                    <Button variant="destructive" className="w-full" data-testid="manage-cancel" onClick={cancel} disabled={submitting}>
                      <XCircle className="mr-1 h-4 w-4" /> Cancelar cita
                    </Button>
                  </>
                )}
              </div>
            )}
            {cancelled && (
              <p className="text-center text-sm text-slate-500">Esta cita ya está cancelada.</p>
            )}
            {!cancelled && (closed || isPast) && (
              <p className="text-center text-sm text-slate-500">
                Esta cita ya ha pasado y no se puede modificar. Contacta con el negocio si lo necesitas.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          ¿Dudas? Contacta con{' '}
          <a href={`mailto:${appt.tenant?.email}`} className="text-indigo-600 hover:underline">
            {appt.tenant?.email}
          </a>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock, User, Briefcase, MapPin, Phone, Mail, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const STATUS = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completada', color: 'bg-sky-100 text-sky-800' },
  cancelled: { label: 'Cancelada', color: 'bg-rose-100 text-rose-800' },
  no_show: { label: 'No asistió', color: 'bg-zinc-200 text-zinc-700' },
};

export default function ManagePage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState(null);
  const [err, setErr] = useState(null);
  const [newDateTime, setNewDateTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/public/appointment/${id}`);
    if (r.ok) {
      const j = await r.json();
      setAppt(j);
      setNewDateTime(dayjs(j.start_at).format('YYYY-MM-DDTHH:mm'));
    } else {
      setErr('Reserva no encontrada o link inválido');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const cancel = async () => {
    if (!window.confirm('¿Seguro que quieres CANCELAR tu cita?')) return;
    setSubmitting(true);
    const r = await fetch(`/api/public/appointment/${id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    setSubmitting(false);
    if (r.ok) { setSuccess('Tu cita ha sido cancelada.'); await load(); }
    else { const j = await r.json(); setErr(j.error || 'Error'); }
  };

  const reschedule = async () => {
    setSubmitting(true);
    const r = await fetch(`/api/public/appointment/${id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reschedule', start_at: new Date(newDateTime).toISOString() }),
    });
    setSubmitting(false);
    const j = await r.json();
    if (r.ok) { setSuccess('Tu cita ha sido reprogramada.'); setRescheduleOpen(false); await load(); }
    else { setErr(j.error || 'Error al reprogramar'); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;
  if (err && !appt) return <div className="flex min-h-screen items-center justify-center p-6"><Card className="max-w-md"><CardContent className="p-8 text-center"><AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-500" /><h1 className="text-xl font-bold">Error</h1><p className="mt-2 text-sm text-slate-500">{err}</p></CardContent></Card></div>;
  if (!appt) return null;

  const cfg = STATUS[appt.status];
  const cancelled = appt.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex items-center gap-3 px-6 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden" style={{ background: `${appt.tenant?.color}15`, border: `2px solid ${appt.tenant?.color}30` }}>
            {appt.tenant?.logo && /^https?:\/\//.test(appt.tenant.logo)
              ? <img src={appt.tenant.logo} alt={appt.tenant.name} className="h-full w-full object-contain p-1" />
              : <span className="text-xl">{appt.tenant?.logo || '✨'}</span>}
          </div>
          <div><div className="font-bold" translate="no">{appt.tenant?.name}</div><div className="text-xs text-slate-500">Gestiona tu reserva</div></div>
        </div>
      </header>

      <div className="container mx-auto max-w-xl px-6 py-10">
        {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4" />{success}</div>}
        {err && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}

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
                  <div className="font-semibold text-slate-800">{dayjs(appt.start_at).format('dddd D MMMM YYYY')}</div>
                  <div className="text-slate-600">{dayjs(appt.start_at).format('HH:mm')} – {dayjs(appt.end_at).format('HH:mm')}</div>
                </div>
              </div>
              <div className="flex items-center gap-3"><Briefcase className="h-4 w-4 text-slate-400" /><div><b>{appt.service?.name}</b> · <span className="text-slate-500">{appt.service?.duration_minutes} min · {appt.service?.price}€</span></div></div>
              <div className="flex items-center gap-3"><User className="h-4 w-4 text-slate-400" /><span>Con <b>{appt.employee?.first_name} {appt.employee?.last_name}</b></span></div>
              {appt.tenant?.address && <div className="flex items-center gap-3" translate="no"><MapPin className="h-4 w-4 text-slate-400" /><span>{appt.tenant.address}</span></div>}
              {appt.tenant?.phone && <div className="flex items-center gap-3" translate="no"><Phone className="h-4 w-4 text-slate-400" /><span>{appt.tenant.phone}</span></div>}
            </div>

            {!cancelled && (
              <div className="space-y-2 border-t pt-4">
                {rescheduleOpen ? (
                  <>
                    <Label className="text-xs">Nueva fecha y hora</Label>
                    <Input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)} />
                    <div className="flex gap-2">
                      <Button onClick={reschedule} disabled={submitting} className="flex-1">{submitting ? 'Guardando...' : 'Confirmar nueva fecha'}</Button>
                      <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancelar</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="w-full" onClick={() => setRescheduleOpen(true)}>Modificar cita</Button>
                    <Button variant="destructive" className="w-full" onClick={cancel} disabled={submitting}>
                      <XCircle className="mr-1 h-4 w-4" /> Cancelar cita
                    </Button>
                  </>
                )}
              </div>
            )}
            {cancelled && <p className="text-center text-sm text-slate-500">Esta cita ya está cancelada.</p>}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">¿Dudas? Contacta con <a href={`mailto:${appt.tenant?.email}`} className="text-indigo-600 hover:underline">{appt.tenant?.email}</a></p>
      </div>
    </div>
  );
}

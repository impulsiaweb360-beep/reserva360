'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { useApp } from '@/lib/supabase-store';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { STATUS_CONFIG, PAYMENT_STATUS } from '@/lib/mockData';
import { CalendarClock, User, Briefcase, CreditCard, CheckCircle2, XCircle, Clock, UserX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AppointmentDetailDialog({ appointmentId, onOpenChange }) {
  const { appointments, clients, services, employees, appointmentsApi } = useApp();
  const a = appointments.find((x) => x.id === appointmentId);
  if (!a) return null;
  const cli = clients.find((c) => c.id === a.clientId);
  const svc = services.find((s) => s.id === a.serviceId);
  const emp = employees.find((e) => e.id === a.employeeId);
  const cfg = STATUS_CONFIG[a.status];
  const pay = PAYMENT_STATUS[a.payment?.status];

  const setStatus = (status) => {
    appointmentsApi.update(a.id, { status });
    toast.success(`Cita marcada como ${STATUS_CONFIG[status].label}`);
    onOpenChange(false);
  };

  const deleteAppt = () => {
    if (!window.confirm('¿Seguro que quieres ELIMINAR esta reserva? Esta acción no se puede deshacer.')) return;
    appointmentsApi.remove(a.id);
    toast.success('Reserva eliminada');
    onOpenChange(false);
  };

  return (
    <Dialog open={!!appointmentId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalle de la cita
            <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <div className="font-semibold text-slate-800">{dayjs(a.start).format('dddd D MMM YYYY')}</div>
              <div className="text-slate-600">{dayjs(a.start).format('HH:mm')} – {dayjs(a.end).format('HH:mm')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3"><User className="h-4 w-4 text-slate-400" /> <div><b>{cli?.firstName} {cli?.lastName}</b> <span className="text-slate-500">{cli?.phone}</span></div></div>
          <div className="flex items-center gap-3"><Briefcase className="h-4 w-4 text-slate-400" /> <div><b>{svc?.name}</b> · <span className="text-slate-500">{svc?.duration} min · {svc?.price}€</span></div></div>
          <div className="flex items-center gap-3"><User className="h-4 w-4 text-slate-400" /> <span>Con <b>{emp?.firstName} {emp?.lastName}</b></span></div>
          <div className="flex items-center gap-3"><CreditCard className="h-4 w-4 text-slate-400" /> <div>Pago <Badge variant="secondary" className={pay.color}>{pay.label}</Badge> · {a.payment?.amount}€</div></div>
          {a.notes && <div className="rounded-lg border bg-slate-50 p-2 text-xs text-slate-600">{a.notes}</div>}
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          {a.status !== 'confirmed' && <Button size="sm" variant="outline" onClick={() => setStatus('confirmed')}><CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar</Button>}
          {a.status !== 'completed' && <Button size="sm" variant="outline" onClick={() => setStatus('completed')}><CheckCircle2 className="mr-1 h-4 w-4" /> Completada</Button>}
          {a.status !== 'no_show' && <Button size="sm" variant="outline" onClick={() => setStatus('no_show')}><UserX className="mr-1 h-4 w-4" /> No asistió</Button>}
          {a.status !== 'cancelled' && <Button size="sm" variant="outline" onClick={() => setStatus('cancelled')}><XCircle className="mr-1 h-4 w-4" /> Cancelar</Button>}
          <Button size="sm" variant="destructive" onClick={deleteAppt} className="ml-auto"><Trash2 className="mr-1 h-4 w-4" /> Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

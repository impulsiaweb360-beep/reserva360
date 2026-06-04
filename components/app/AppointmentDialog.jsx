'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useApp } from '@/lib/store';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function AppointmentDialog({ open, onOpenChange, tenantId, init, lockEmployeeId }) {
  const { byTenant, appointmentsApi, clientsApi, appointments } = useApp();
  const employees = byTenant('employees', tenantId);
  const services = byTenant('services', tenantId);
  const clients = byTenant('clients', tenantId);

  const [form, setForm] = useState({
    employeeId: lockEmployeeId || employees[0]?.id || '',
    clientId: clients[0]?.id || 'new',
    serviceId: services[0]?.id || '',
    start: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
    notes: '',
    status: 'confirmed',
    paymentMethod: 'onsite',
    newClient: { firstName: '', lastName: '', email: '', phone: '' },
  });

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        employeeId: lockEmployeeId || init?.employeeId || employees[0]?.id || '',
        clientId: clients[0]?.id || 'new',
        serviceId: services[0]?.id || '',
        start: init?.start ? dayjs(init.start).format('YYYY-MM-DDTHH:mm') : dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
        newClient: { firstName: '', lastName: '', email: '', phone: '' },
      }));
    }
  }, [open, init, lockEmployeeId]);

  const handleSubmit = () => {
    const service = services.find((s) => s.id === form.serviceId);
    if (!service) { toast.error('Selecciona un servicio'); return; }
    if (!form.employeeId) { toast.error('Selecciona un empleado'); return; }

    let clientId = form.clientId;
    if (clientId === 'new') {
      if (!form.newClient.firstName) { toast.error('Nombre del cliente requerido'); return; }
      const newId = `c_${Date.now()}`;
      clientsApi.add({ ...form.newClient, id: newId, tenantId, createdAt: new Date().toISOString(), notes: '' });
      clientId = newId;
    }

    const start = dayjs(form.start);
    const end = start.add(service.duration, 'minute');

    // Overlap check
    const overlap = appointments.some((a) =>
      a.tenantId === tenantId &&
      a.employeeId === form.employeeId &&
      a.status !== 'cancelled' &&
      dayjs(a.start).isBefore(end) && dayjs(a.end).isAfter(start)
    );
    if (overlap) {
      toast.error('El empleado ya tiene una cita que se solapa en ese horario');
      return;
    }

    appointmentsApi.add({
      tenantId,
      employeeId: form.employeeId,
      clientId,
      serviceId: form.serviceId,
      start: start.toISOString(),
      end: end.toISOString(),
      status: form.status,
      notes: form.notes,
      payment: { status: form.paymentMethod === 'stripe' ? 'paid' : 'pending', amount: service.price, method: form.paymentMethod },
    });
    toast.success('Reserva creada correctamente');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva cita</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Empleado</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })} disabled={!!lockEmployeeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Servicio</Label>
              <Select value={form.serviceId} onValueChange={(v) => setForm({ ...form, serviceId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.price}€</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">+ Nuevo cliente</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.clientId === 'new' && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-dashed p-3">
              <Input placeholder="Nombre" value={form.newClient.firstName} onChange={(e) => setForm({ ...form, newClient: { ...form.newClient, firstName: e.target.value } })} />
              <Input placeholder="Apellidos" value={form.newClient.lastName} onChange={(e) => setForm({ ...form, newClient: { ...form.newClient, lastName: e.target.value } })} />
              <Input placeholder="Email" value={form.newClient.email} onChange={(e) => setForm({ ...form, newClient: { ...form.newClient, email: e.target.value } })} />
              <Input placeholder="Teléfono" value={form.newClient.phone} onChange={(e) => setForm({ ...form, newClient: { ...form.newClient, phone: e.target.value } })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fecha y hora</Label>
              <Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Método de pago</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="onsite">Presencial</SelectItem>
                <SelectItem value="stripe">Online (Stripe)</SelectItem>
                <SelectItem value="partial">Pago parcial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Crear reserva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

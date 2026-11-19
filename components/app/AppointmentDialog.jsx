'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { useApp } from '@/lib/supabase-store';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { checkMove } from '@/lib/appointment-move';
import { AlertTriangle } from 'lucide-react';

// Crear una cita nueva o MODIFICAR una existente (editId)
export default function AppointmentDialog({ open, onOpenChange, tenantId, init, lockEmployeeId, editId }) {
  const { byTenant, appointmentsApi, clientsApi, appointments, tenants, employees } = useApp();
  const editing = editId ? appointments.find((a) => a.id === editId) : null;
  const tid = editing?.tenantId || tenantId;
  const tenant = tenants.find((t) => t.id === tid);
  const tenantEmployees = byTenant('employees', tid);
  const services = byTenant('services', tid);
  const clients = byTenant('clients', tid);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    employeeId: lockEmployeeId || tenantEmployees[0]?.id || '',
    clientId: clients[0]?.id || 'new',
    serviceId: services[0]?.id || '',
    start: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
    notes: '',
    status: 'confirmed',
    paymentMethod: 'onsite',
    newClient: { firstName: '', lastName: '', email: '', phone: '' },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        employeeId: editing.employeeId || '',
        clientId: editing.clientId || 'new',
        serviceId: editing.serviceId || '',
        start: dayjs(editing.start).format('YYYY-MM-DDTHH:mm'),
        notes: editing.notes || '',
        status: ['pending', 'confirmed'].includes(editing.status) ? editing.status : 'confirmed',
        paymentMethod: editing.payment?.method || 'onsite',
        newClient: { firstName: '', lastName: '', email: '', phone: '' },
      });
      return;
    }
    setForm((f) => ({
      ...f,
      employeeId: lockEmployeeId || init?.employeeId || tenantEmployees[0]?.id || '',
      clientId: clients[0]?.id || 'new',
      serviceId: services[0]?.id || '',
      start: init?.start ? dayjs(init.start).format('YYYY-MM-DDTHH:mm') : dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      notes: '',
      newClient: { firstName: '', lastName: '', email: '', phone: '' },
    }));
    // eslint-disable-next-line
  }, [open, init, lockEmployeeId, editId]);

  const handleSubmit = async () => {
    const service = services.find((s) => s.id === form.serviceId);
    if (!service) { toast.error('Selecciona un servicio'); return; }
    if (!form.employeeId) { toast.error('Selecciona un empleado'); return; }
    if (form.clientId === 'new' && !form.newClient.firstName) { toast.error('Nombre del cliente requerido'); return; }
    const employee = employees.find((e) => e.id === form.employeeId);
    const start = dayjs(form.start);
    if (!start.isValid()) { toast.error('Fecha u hora no válida'); return; }
    const end = start.add(service.duration, 'minute');

    // Mismas reglas que al arrastrar: horario del negocio y del empleado obligatorio; descanso y solape con confirmación
    const check = checkMove({ start, end, tenant, employee, employeeId: form.employeeId, tenantId: tid, appointments, excludeId: editing?.id, allowPast: !editing });
    if (!check.ok) { toast.error(check.reason); return; }
    for (const w of check.warnings) {
      if (!window.confirm(`⚠️ ${w}\n\n¿Guardar la cita igualmente?`)) return;
    }
    if (!editing && start.isBefore(dayjs()) && !window.confirm('Esta cita es en una fecha u hora que ya ha pasado. Se guardará en la agenda, pero no se avisará al cliente.\n\n¿Continuar?')) return;

    setSaving(true);
    try {
      let clientId = form.clientId;
      if (clientId === 'new') {
        const created = await clientsApi.add({ ...form.newClient, tenantId: tid, createdAt: new Date().toISOString(), notes: '' });
        clientId = created?.id;
        if (!clientId) { toast.error('No se pudo crear el cliente'); return; }
      }
      if (editing) {
        await appointmentsApi.update(editing.id, {
          employeeId: form.employeeId,
          clientId,
          serviceId: form.serviceId,
          start: start.toISOString(),
          end: end.toISOString(),
          status: form.status,
          notes: form.notes,
          payment: { ...(editing.payment || {}), amount: editing.payment?.status === 'paid' ? editing.payment.amount : service.price, method: form.paymentMethod },
        });
        toast.success('Cita modificada');
      } else {
        await appointmentsApi.add({
          tenantId: tid,
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
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(`No se pudo guardar: ${err?.message || 'error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Modificar cita' : 'Nueva cita'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Empleado</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })} disabled={!!lockEmployeeId}>
                <SelectTrigger data-testid="appt-employee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tenantEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Servicio</Label>
              <Select value={form.serviceId} onValueChange={(v) => setForm({ ...form, serviceId: v })}>
                <SelectTrigger data-testid="appt-service"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs">Fecha</Label>
              <Input data-testid="appt-date" type="date" value={form.start.slice(0, 10)} onChange={(e) => setForm({ ...form, start: `${e.target.value}T${form.start.slice(11) || '09:00'}` })} />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input data-testid="appt-time" type="time" step="900" value={form.start.slice(11, 16) || '09:00'} onChange={(e) => setForm({ ...form, start: `${form.start.slice(0, 10) || dayjs().format('YYYY-MM-DD')}T${e.target.value}` })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              La cita debe estar dentro del horario del negocio y del empleado. Si cae en el descanso o se solapa con otra, te pediremos confirmación.
              {editing && ' Si cambias el día o la hora, el cliente recibe un aviso por WhatsApp (si está conectado).'}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="appt-save">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear reserva'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

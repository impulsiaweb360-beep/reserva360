'use client';

import { useState } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeesList({ tenantId }) {
  const { byTenant, employeesApi, appointments } = useApp();
  const employees = byTenant('employees', tenantId);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const startNew = () => { setEditing({ firstName: '', lastName: '', email: '', phone: '', specialty: '', color: '#6366f1', active: true }); setOpen(true); };
  const startEdit = (e) => { setEditing({ ...e }); setOpen(true); };
  const save = () => {
    if (!editing.firstName) return toast.error('Nombre requerido');
    if (editing.id) {
      employeesApi.update(editing.id, editing);
      toast.success('Empleado actualizado');
    } else {
      employeesApi.add({ ...editing, tenantId });
      toast.success('Empleado añadido');
    }
    setOpen(false);
  };
  const remove = (id) => { employeesApi.remove(id); toast.success('Empleado eliminado'); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Empleados ({employees.length})</CardTitle>
        <Button onClick={startNew} className="gap-1"><Plus className="h-4 w-4" /> Invitar empleado</Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {employees.map((e) => {
            const count = appointments.filter((a) => a.employeeId === e.id).length;
            return (
              <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white shadow" style={{ background: e.color }}>
                      {e.firstName[0]}{e.lastName[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{e.firstName} {e.lastName}</div>
                      <div className="text-xs text-slate-500">{e.specialty}</div>
                    </div>
                  </div>
                  <Badge className={e.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-200'}>
                    {e.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div>{e.email}</div>
                  <div>{e.phone}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="secondary">{count} citas</Badge>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre</Label><Input value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></div>
                <div><Label className="text-xs">Apellidos</Label><Input value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></div>
                <div><Label className="text-xs">Email</Label><Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label className="text-xs">Teléfono</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Especialidad</Label><Input value={editing.specialty} onChange={(e) => setEditing({ ...editing, specialty: e.target.value })} /></div>
                <div><Label className="text-xs">Color calendario</Label><Input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><span className="text-sm">Activo</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

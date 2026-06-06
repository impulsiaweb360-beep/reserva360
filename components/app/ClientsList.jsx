'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';

export default function ClientsList({ tenantId }) {
  const { byTenant, clientsApi, appointments } = useApp();
  const clients = byTenant('clients', tenantId);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const filtered = clients.filter((c) =>
    `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase())
  );

  const startNew = () => { setEditing({ firstName: '', lastName: '', email: '', phone: '', notes: '' }); setOpen(true); };
  const startEdit = (c) => { setEditing({ ...c }); setOpen(true); };
  const save = () => {
    if (!editing.firstName) return toast.error('Nombre requerido');
    if (editing.id) {
      clientsApi.update(editing.id, editing);
      toast.success('Cliente actualizado');
    } else {
      clientsApi.add({ ...editing, tenantId, createdAt: new Date().toISOString() });
      toast.success('Cliente añadido');
    }
    setOpen(false);
  };
  const remove = (id) => { clientsApi.remove(id); toast.success('Cliente eliminado'); };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Clientes ({filtered.length})</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-8 sm:w-56" />
          </div>
          <Button onClick={startNew} className="gap-1 shrink-0"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo</span></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-slate-100">
          {filtered.map((c) => {
            const visits = appointments.filter((a) => a.clientId === c.id).length;
            return (
              <div key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-semibold text-slate-700">
                    {c.firstName[0]}{c.lastName?.[0] || ''}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">{c.firstName} {c.lastName}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {c.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{c.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 pl-13 sm:pl-0">
                  <Badge variant="secondary" className="shrink-0">{visits} citas</Badge>
                  <span className="hidden text-xs text-slate-400 md:inline">Desde {dayjs(c.createdAt).format('DD/MM/YY')}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-slate-400">Sin clientes</div>}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre</Label><Input value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></div>
                <div><Label className="text-xs">Apellidos</Label><Input value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></div>
                <div><Label className="text-xs">Email</Label><Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label className="text-xs">Teléfono</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              </div>
              <div><Label className="text-xs">Notas</Label><Textarea rows={3} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
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

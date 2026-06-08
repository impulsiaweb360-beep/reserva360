'use client';

import { useState } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Clock, Euro } from 'lucide-react';
import { toast } from 'sonner';

export default function ServicesList({ tenantId }) {
  const { byTenant, servicesApi } = useApp();
  const services = byTenant('services', tenantId);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const startNew = () => { setEditing({ name: '', description: '', duration: 60, price: 30, color: '#6366f1', active: true }); setOpen(true); };
  const startEdit = (s) => { setEditing({ ...s }); setOpen(true); };
  const save = () => {
    if (!editing.name) return toast.error('Nombre requerido');
    if (editing.id) {
      servicesApi.update(editing.id, { ...editing, duration: Number(editing.duration), price: Number(editing.price) });
      toast.success('Servicio actualizado');
    } else {
      servicesApi.add({ ...editing, tenantId, duration: Number(editing.duration), price: Number(editing.price) });
      toast.success('Servicio creado');
    }
    setOpen(false);
  };
  const remove = (id) => { servicesApi.remove(id); toast.success('Servicio eliminado'); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Servicios ({services.length})</CardTitle>
        <Button onClick={startNew} className="gap-1"><Plus className="h-4 w-4" /> Nuevo servicio</Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md" style={{ borderLeftWidth: 4, borderLeftColor: s.color }}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-500 line-clamp-2">{s.description}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-slate-600"><Clock className="h-3.5 w-3.5" /> {s.duration} min</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-600"><Euro className="h-3.5 w-3.5" /> {s.price}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-xs">Nombre</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label className="text-xs">Descripción</Label><Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Duración (min)</Label><Input type="number" value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} /></div>
                <div><Label className="text-xs">Precio (€)</Label><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
                <div><Label className="text-xs">Color</Label><Input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><span className="text-sm">Activo</span></div>
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

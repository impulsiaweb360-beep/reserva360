'use client';

import { useState } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Power, PowerOff, Eye, Pencil } from 'lucide-react';
import TenantLogo from '@/components/app/TenantLogo';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { toast } from 'sonner';

export default function TenantsList() {
  const { tenants, plans, addTenant, updateTenant, impersonate } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = tenants.filter((t) =>
    `${t.name} ${t.industry} ${t.email}`.toLowerCase().includes(q.toLowerCase())
  );

  const startNew = () => { setEditing({ name: '', industry: '', email: '', phone: '', logo: '🏢', color: '#6366f1', plan: 'plan_pro', address: '' }); setOpen(true); };
  const startEdit = (t) => { setEditing({ ...t }); setOpen(true); };
  const save = () => {
    if (!editing.name) return toast.error('Nombre requerido');
    if (editing.id) {
      updateTenant(editing.id, editing);
      toast.success('Tenant actualizado');
    } else {
      const plan = plans.find((p) => p.id === editing.plan);
      addTenant({ ...editing, mrr: plan?.price || 0 });
      toast.success('Tenant creado');
    }
    setOpen(false);
  };

  const toggleStatus = (t) => {
    updateTenant(t.id, { status: t.status === 'active' ? 'suspended' : 'active', mrr: t.status === 'active' ? 0 : plans.find((p) => p.id === t.plan)?.price || 0 });
    toast.success(t.status === 'active' ? 'Tenant suspendido' : 'Tenant activado');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Tenants ({filtered.length})</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-8" />
          </div>
          <Button onClick={startNew} className="gap-1"><Plus className="h-4 w-4" /> Crear tenant</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 text-left font-medium">Negocio</th>
                <th className="text-left font-medium">Plan</th>
                <th className="text-left font-medium">MRR</th>
                <th className="text-left font-medium">Alta</th>
                <th className="text-left font-medium">Estado</th>
                <th className="text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const plan = plans.find((p) => p.id === t.plan);
                return (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <TenantLogo logo={t.logo} name={t.name} size="h-9 w-9" textSize="text-xl" bordered padding="p-1" />
                        <div>
                          <div className="font-semibold text-slate-800">{t.name}</div>
                          <div className="text-xs text-slate-500">{t.industry} · {t.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="secondary">{plan?.name}</Badge></td>
                    <td className="font-mono">{t.mrr}€/mes</td>
                    <td className="text-xs text-slate-500">{dayjs(t.createdAt).format('DD/MM/YY')}</td>
                    <td>
                      <Badge className={t.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-100 text-rose-700 hover:bg-rose-100'}>
                        {t.status === 'active' ? 'Activo' : 'Suspendido'}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => impersonate(t.id)} title="Impersonar"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(t)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(t)} title={t.status === 'active' ? 'Suspender' : 'Activar'}>
                          {t.status === 'active' ? <PowerOff className="h-4 w-4 text-rose-500" /> : <Power className="h-4 w-4 text-emerald-500" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar tenant' : 'Crear tenant'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label className="text-xs">Industria</Label><Input value={editing.industry} onChange={(e) => setEditing({ ...editing, industry: e.target.value })} /></div>
                <div><Label className="text-xs">Email</Label><Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label className="text-xs">Teléfono</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Dirección</Label><Input value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
                <div><Label className="text-xs">Plan</Label>
                  <Select value={editing.plan} onValueChange={(v) => setEditing({ ...editing, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.price}€/{p.interval}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Logo (emoji)</Label><Input value={editing.logo} onChange={(e) => setEditing({ ...editing, logo: e.target.value })} /></div>
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

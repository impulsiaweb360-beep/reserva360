'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Coffee, Plane, Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_BUSINESS_HOURS } from '@/lib/booking';

const DAYS = [
  { idx: 1, label: 'Lunes' },
  { idx: 2, label: 'Martes' },
  { idx: 3, label: 'Miércoles' },
  { idx: 4, label: 'Jueves' },
  { idx: 5, label: 'Viernes' },
  { idx: 6, label: 'Sábado' },
  { idx: 0, label: 'Domingo' },
];

export default function BusinessHoursEditor({ tenantId }) {
  const { tenants, updateTenant } = useApp();
  const tenant = tenants.find((t) => t.id === tenantId);

  const [hours, setHours] = useState(() => ({ ...DEFAULT_BUSINESS_HOURS, ...(tenant?.businessHours || {}) }));
  const [vacations, setVacations] = useState(() => tenant?.vacations || []);
  const [newVac, setNewVac] = useState({ from: '', to: '', label: '' });

  const updateDay = (dow, patch) => setHours((h) => ({ ...h, [dow]: { ...h[dow], ...patch } }));

  const copyToAllWeekdays = (dow) => {
    const src = hours[dow];
    setHours((h) => {
      const next = { ...h };
      [1, 2, 3, 4, 5].forEach((d) => { if (d !== dow) next[d] = { ...src }; });
      return next;
    });
    toast.success('Horario copiado a L-V');
  };

  const addVacation = () => {
    if (!newVac.from || !newVac.to) { toast.error('Indica fecha desde y hasta'); return; }
    if (dayjs(newVac.to).isBefore(newVac.from)) { toast.error('La fecha final no puede ser anterior'); return; }
    setVacations((v) => [...v, { id: `v_${Date.now()}`, ...newVac }]);
    setNewVac({ from: '', to: '', label: '' });
  };

  const removeVacation = (id) => setVacations((v) => v.filter((x) => x.id !== id));

  const save = () => {
    updateTenant(tenantId, { businessHours: hours, vacations });
    toast.success('Horarios y vacaciones guardados');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Horarios de apertura</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Los clientes solo verán huecos disponibles dentro de estos horarios.</p>
          </div>
          <Button size="sm" onClick={save}>Guardar cambios</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {DAYS.map(({ idx, label }) => {
            const d = hours[idx] || { enabled: false };
            return (
              <div key={idx} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                <div className="flex w-28 items-center gap-2 shrink-0">
                  <Switch checked={!!d.enabled} onCheckedChange={(v) => updateDay(idx, { enabled: v })} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                {d.enabled ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500">Apertura</Label>
                      <Input type="time" value={d.from || '09:00'} onChange={(e) => updateDay(idx, { from: e.target.value })} className="w-28" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500">Cierre</Label>
                      <Input type="time" value={d.to || '19:00'} onChange={(e) => updateDay(idx, { to: e.target.value })} className="w-28" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Coffee className="h-3 w-3 text-amber-600" />
                      <Label className="text-xs text-slate-500">Descanso</Label>
                      <Input type="time" value={d.breakFrom || ''} onChange={(e) => updateDay(idx, { breakFrom: e.target.value })} className="w-24" placeholder="—" />
                      <span className="text-slate-400">–</span>
                      <Input type="time" value={d.breakTo || ''} onChange={(e) => updateDay(idx, { breakTo: e.target.value })} className="w-24" placeholder="—" />
                    </div>
                    {idx >= 1 && idx <= 5 && (
                      <Button variant="ghost" size="sm" onClick={() => copyToAllWeekdays(idx)} className="ml-auto gap-1 text-xs">
                        <Copy className="h-3 w-3" /> Copiar a L-V
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-slate-400">Cerrado</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plane className="h-4 w-4" /> Vacaciones y días cerrados</CardTitle>
          <p className="text-xs text-slate-500">Periodos en los que el negocio estará cerrado por completo (festivos, vacaciones, mudanza...).</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <div><Label className="text-xs">Desde</Label><Input type="date" value={newVac.from} onChange={(e) => setNewVac({ ...newVac, from: e.target.value })} /></div>
            <div><Label className="text-xs">Hasta</Label><Input type="date" value={newVac.to} onChange={(e) => setNewVac({ ...newVac, to: e.target.value })} /></div>
            <div><Label className="text-xs">Etiqueta (opcional)</Label><Input placeholder="Vacaciones de verano" value={newVac.label} onChange={(e) => setNewVac({ ...newVac, label: e.target.value })} /></div>
            <div className="flex items-end"><Button onClick={addVacation} className="w-full gap-1"><Plus className="h-4 w-4" /> Añadir</Button></div>
          </div>

          <div className="space-y-2">
            {vacations.length === 0 && <p className="text-sm text-slate-400">No hay vacaciones configuradas.</p>}
            {vacations.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <Plane className="h-4 w-4 text-indigo-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {dayjs(v.from).format('DD MMM YYYY')} → {dayjs(v.to).format('DD MMM YYYY')}
                    </div>
                    {v.label && <div className="text-xs text-slate-500">{v.label}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{dayjs(v.to).diff(v.from, 'day') + 1} días</Badge>
                  <Button variant="ghost" size="icon" onClick={() => removeVacation(v.id)}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={save}>Guardar cambios</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CalendarDays, Plane, Coffee } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function EmployeeSchedule({ employeeId }) {
  const { employees } = useApp();
  const employee = employees.find((e) => e.id === employeeId);
  const [schedule, setSchedule] = useState(() => DAYS.map((d, idx) => ({
    day: d,
    enabled: idx < 5,
    from: '09:00',
    to: '18:00',
  })));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Horario semanal</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {schedule.map((s, i) => (
            <div key={s.day} className="flex items-center gap-3 rounded-lg border p-2">
              <div className="w-20 text-sm font-medium">{s.day}</div>
              <Switch checked={s.enabled} onCheckedChange={(v) => { const ns = [...schedule]; ns[i].enabled = v; setSchedule(ns); }} />
              {s.enabled ? (
                <>
                  <Input type="time" value={s.from} onChange={(e) => { const ns = [...schedule]; ns[i].from = e.target.value; setSchedule(ns); }} className="w-28" />
                  <span className="text-slate-400">–</span>
                  <Input type="time" value={s.to} onChange={(e) => { const ns = [...schedule]; ns[i].to = e.target.value; setSchedule(ns); }} className="w-28" />
                </>
              ) : <span className="text-sm text-slate-400">Descanso</span>}
            </div>
          ))}
          <Button onClick={() => toast.success('Horario guardado')} className="w-full mt-2">Guardar horario</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plane className="h-4 w-4" /> Vacaciones</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div><div className="font-semibold">Vacaciones de verano</div><div className="text-xs text-slate-500">1 Ago – 15 Ago</div></div>
                <Button variant="ghost" size="sm">Eliminar</Button>
              </div>
              <Button variant="outline" className="w-full">+ Añadir vacaciones</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Coffee className="h-4 w-4 " /> Descansos diarios</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm text-slate-600">14:00 – 15:00 (comida)</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CalendarClock, RotateCcw, Building2 } from 'lucide-react';
import { DEFAULT_BUSINESS_HOURS } from '@/lib/booking';

const DAYS = [
  { dow: 1, label: 'Lunes' },
  { dow: 2, label: 'Martes' },
  { dow: 3, label: 'Miércoles' },
  { dow: 4, label: 'Jueves' },
  { dow: 5, label: 'Viernes' },
  { dow: 6, label: 'Sábado' },
  { dow: 0, label: 'Domingo' },
];

// Normaliza un schedule (que puede tener claves string o numéricas) a
// el shape interno usado por el editor.
const normalizeSchedule = (source) => {
  const out = {};
  DAYS.forEach(({ dow }) => {
    const day = source?.[dow] || source?.[String(dow)];
    out[dow] = {
      enabled: !!day?.enabled,
      from: day?.from || '09:00',
      to: day?.to || '18:00',
    };
  });
  return out;
};

const isScheduleEmpty = (s) => {
  if (!s) return true;
  if (typeof s !== 'object') return true;
  return Object.keys(s).length === 0;
};

export default function EmployeeScheduleDialog({ open, onOpenChange, employee }) {
  const { employeesApi, tenants } = useApp();
  const tenant = tenants.find((t) => t.id === employee?.tenantId);
  const businessHours = tenant?.businessHours && Object.keys(tenant.businessHours).length > 0
    ? tenant.businessHours
    : DEFAULT_BUSINESS_HOURS;

  const inheritsBusiness = isScheduleEmpty(employee?.schedule);

  const [useBusinessHours, setUseBusinessHours] = useState(inheritsBusiness);
  const [schedule, setSchedule] = useState(() => normalizeSchedule(employee?.schedule || businessHours));
  const [saving, setSaving] = useState(false);

  const previewSchedule = useMemo(
    () => (useBusinessHours ? normalizeSchedule(businessHours) : schedule),
    [useBusinessHours, businessHours, schedule]
  );

  const setDay = (dow, patch) => {
    setSchedule((prev) => ({ ...prev, [dow]: { ...prev[dow], ...patch } }));
  };

  const resetToBusiness = () => {
    setSchedule(normalizeSchedule(businessHours));
    toast.success('Horarios copiados del horario del negocio');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Si "useBusinessHours" → guardamos schedule = {} (objeto vacío) para
      // que la lógica de reservas use el horario del negocio.
      const payload = useBusinessHours ? {} : schedule;
      await employeesApi.update(employee.id, { schedule: payload });
      toast.success(
        useBusinessHours
          ? 'El empleado heredará el horario del negocio'
          : 'Horario del empleado guardado'
      );
      onOpenChange(false);
    } catch (err) {
      toast.error('Error al guardar el horario');
    } finally {
      setSaving(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
            Horario de {employee.firstName} {employee.lastName}
          </DialogTitle>
          <DialogDescription>
            Define los días y horas que trabaja este empleado. Si no defines un horario propio,
            heredará el horario general del negocio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle herencia */}
          <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
            <Switch
              checked={useBusinessHours}
              onCheckedChange={setUseBusinessHours}
              id="inherit-business"
            />
            <div className="flex-1">
              <label htmlFor="inherit-business" className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                <Building2 className="h-4 w-4" /> Usar el horario del negocio
              </label>
              <p className="mt-0.5 text-xs text-slate-600">
                Si está activado, el empleado trabaja exactamente cuando abre el negocio.
                Desactívalo para definir un horario personalizado.
              </p>
            </div>
            {useBusinessHours && (
              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Heredado</Badge>
            )}
          </div>

          {/* Editor por días */}
          <div className={`space-y-2 ${useBusinessHours ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Horario semanal</span>
              <Button variant="ghost" size="sm" onClick={resetToBusiness} className="gap-1 text-xs">
                <RotateCcw className="h-3 w-3" /> Copiar del negocio
              </Button>
            </div>
            <div className="space-y-2">
              {DAYS.map(({ dow, label }) => {
                const day = previewSchedule[dow];
                return (
                  <div key={dow} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="w-24 text-sm font-medium text-slate-700">{label}</div>
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(v) => setDay(dow, { enabled: v })}
                      disabled={useBusinessHours}
                    />
                    {day.enabled ? (
                      <>
                        <Input
                          type="time"
                          value={day.from}
                          onChange={(e) => setDay(dow, { from: e.target.value })}
                          className="w-28"
                          disabled={useBusinessHours}
                        />
                        <span className="text-slate-400">–</span>
                        <Input
                          type="time"
                          value={day.to}
                          onChange={(e) => setDay(dow, { to: e.target.value })}
                          className="w-28"
                          disabled={useBusinessHours}
                        />
                      </>
                    ) : (
                      <span className="text-sm italic text-slate-400">Descanso</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar horario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

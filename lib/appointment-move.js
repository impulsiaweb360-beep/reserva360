import dayjs from 'dayjs';
import { isWithinBusinessHours, hasOverlap } from '@/lib/booking';

// Reglas comunes al crear, modificar o arrastrar una cita desde el panel.
// Devuelve { ok:false, reason } si no se permite, o { ok:true, warnings:[...] } con avisos que el usuario debe confirmar.
export function checkMove({ start, end, tenant, employee, employeeId, tenantId, appointments, excludeId, allowPast = false }) {
  const s = dayjs(start);
  const e = dayjs(end);
  if (!allowPast && s.isBefore(dayjs())) {
    return { ok: false, reason: 'No se puede mover una cita a una fecha u hora que ya ha pasado.' };
  }
  if (!s.isSame(e.subtract(1, 'minute'), 'day')) {
    return { ok: false, reason: 'La cita no puede terminar al día siguiente.' };
  }
  const within = isWithinBusinessHours({ start: s.toDate(), end: e.toDate(), tenant, employee });
  if (!within.ok) return { ok: false, reason: within.reason || 'Fuera del horario del negocio.' };
  const warnings = [];
  if (within.warning === 'break') warnings.push(within.reason || 'La cita cae en el horario de descanso.');
  if (hasOverlap({ start: s.toDate(), end: e.toDate(), employeeId, tenantId, appointments, excludeId })) {
    warnings.push('Este empleado ya tiene otra cita que se solapa en ese horario.');
  }
  return { ok: true, warnings };
}

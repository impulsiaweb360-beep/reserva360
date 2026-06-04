// Lógica de disponibilidad y huecos libres para reservas
// Sin dependencias externas - se ejecuta en el cliente con datos del store.

import dayjs from 'dayjs';

// Horario por defecto del negocio (L-V 9-19, S 10-14, D cerrado)
export const DEFAULT_BUSINESS_HOURS = {
  1: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
  2: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
  3: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
  4: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
  5: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
  6: { enabled: true, from: '10:00', to: '14:00' },
  0: { enabled: false },
};

export const DEFAULT_EMPLOYEE_SCHEDULE = {
  1: { enabled: true, from: '09:00', to: '18:00' },
  2: { enabled: true, from: '09:00', to: '18:00' },
  3: { enabled: true, from: '09:00', to: '18:00' },
  4: { enabled: true, from: '09:00', to: '18:00' },
  5: { enabled: true, from: '09:00', to: '17:00' },
  6: { enabled: false },
  0: { enabled: false },
};

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Intersección de dos rangos [a1,a2] y [b1,b2]
const intersect = (a1, a2, b1, b2) => [Math.max(a1, b1), Math.min(a2, b2)];

// Devuelve ventanas trabajables [{startMin, endMin}] para un empleado un día concreto,
// teniendo en cuenta horario tenant + empleado + descansos.
export function getWorkingWindows(date, tenant, employee) {
  const dow = dayjs(date).day();
  const biz = (tenant?.businessHours || DEFAULT_BUSINESS_HOURS)[dow];
  const emp = (employee?.schedule || DEFAULT_EMPLOYEE_SCHEDULE)[dow];
  if (!biz?.enabled || !emp?.enabled) return [];

  const [s1, e1] = [toMin(biz.from), toMin(biz.to)];
  const [s2, e2] = [toMin(emp.from), toMin(emp.to)];
  const [start, end] = intersect(s1, e1, s2, e2);
  if (start >= end) return [];

  let windows = [{ startMin: start, endMin: end }];

  // Restar descanso de comida del negocio
  if (biz.breakFrom && biz.breakTo) {
    const bs = toMin(biz.breakFrom);
    const be = toMin(biz.breakTo);
    windows = windows.flatMap((w) => {
      if (be <= w.startMin || bs >= w.endMin) return [w];
      const out = [];
      if (bs > w.startMin) out.push({ startMin: w.startMin, endMin: bs });
      if (be < w.endMin) out.push({ startMin: be, endMin: w.endMin });
      return out;
    });
  }

  return windows;
}

// Genera slots disponibles para reservar (cada `step` minutos)
// Filtra los que se solapan con citas existentes (no canceladas).
export function getAvailableSlots({ date, service, employee, tenant, appointments, step = 15 }) {
  if (!service || !employee || !tenant) return [];
  const day = dayjs(date).startOf('day');
  const windows = getWorkingWindows(day, tenant, employee);
  const duration = service.duration;

  const busy = appointments
    .filter((a) =>
      a.tenantId === tenant.id &&
      a.employeeId === employee.id &&
      a.status !== 'cancelled' &&
      dayjs(a.start).isSame(day, 'day')
    )
    .map((a) => ({
      startMin: dayjs(a.start).diff(day, 'minute'),
      endMin: dayjs(a.end).diff(day, 'minute'),
    }));

  const slots = [];
  windows.forEach((w) => {
    for (let t = w.startMin; t + duration <= w.endMin; t += step) {
      const slotEnd = t + duration;
      const overlap = busy.some((b) => t < b.endMin && slotEnd > b.startMin);
      if (!overlap) {
        const startTs = day.add(t, 'minute');
        if (startTs.isAfter(dayjs())) {
          slots.push({ start: startTs.toISOString(), label: fromMin(t) });
        }
      }
    }
  });
  return slots;
}

// Comprueba si una franja es VÁLIDA para una reserva interna (admin/empleado)
// - Debe estar dentro del horario del negocio + empleado (incluyendo descansos? No, admin puede saltarse descansos del negocio? Sí, mejor solo respetar la apertura general del local)
export function isWithinBusinessHours({ start, end, tenant, employee }) {
  const day = dayjs(start).startOf('day');
  const dow = day.day();
  const biz = (tenant?.businessHours || DEFAULT_BUSINESS_HOURS)[dow];
  const emp = (employee?.schedule || DEFAULT_EMPLOYEE_SCHEDULE)[dow];
  if (!biz?.enabled) return { ok: false, reason: 'El negocio está cerrado ese día.' };
  if (!emp?.enabled) return { ok: false, reason: 'El empleado no trabaja ese día.' };

  const sMin = dayjs(start).diff(day, 'minute');
  const eMin = dayjs(end).diff(day, 'minute');

  const bizStart = toMin(biz.from);
  const bizEnd = toMin(biz.to);
  const empStart = toMin(emp.from);
  const empEnd = toMin(emp.to);

  if (sMin < bizStart || eMin > bizEnd) return { ok: false, reason: `Fuera del horario del negocio (${biz.from}–${biz.to}).` };
  if (sMin < empStart || eMin > empEnd) return { ok: false, reason: `Fuera del horario del empleado (${emp.from}–${emp.to}).` };
  return { ok: true };
}

// Comprueba solapamientos
export function hasOverlap({ start, end, employeeId, tenantId, appointments, excludeId }) {
  return appointments.some((a) =>
    a.id !== excludeId &&
    a.tenantId === tenantId &&
    a.employeeId === employeeId &&
    a.status !== 'cancelled' &&
    dayjs(a.start).isBefore(end) && dayjs(a.end).isAfter(start)
  );
}

// Lógica de reservas en SERVIDOR: valida horario del negocio/empleado en la zona horaria del negocio,
// calcula huecos libres y crea / reprograma / cancela citas. Usada por la web pública, /manage y el bot de WhatsApp.

import dayjs from 'dayjs';
import { getWorkingWindows, isWithinBusinessHours } from './booking';
import { DEFAULT_TZ, localParts, localToUtc, addDaysStr, hhmm } from './tz';
import { normalizePhone, findClientsByPhone } from './phone';
import { assertCanAcceptBooking } from './billing-server';
import { syncProgram } from './founders';

export class BookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const tenantTz = (t) => t?.timezone || DEFAULT_TZ;
const ctxTenant = (t) => ({ id: t?.id, businessHours: t?.business_hours, vacations: t?.vacations });
const ctxEmp = (e) => ({
  id: e?.id,
  schedule: e?.schedule && Object.keys(e.schedule).length > 0 ? e.schedule : null,
});

// Valida que [start, end) esté dentro del horario del negocio y del empleado, fuera del descanso y de vacaciones.
export function validateCustomerSlot({ start, end, tenant, employee }) {
  const tz = tenantTz(tenant);
  const ls = localParts(start, tz);
  const le = localParts(end, tz);
  const startNaive = dayjs(ls.dateStr).add(ls.minutes, 'minute');
  const endNaive = dayjs(le.dateStr).add(le.minutes, 'minute');
  const check = isWithinBusinessHours({
    start: startNaive,
    end: endNaive,
    tenant: ctxTenant(tenant),
    employee: ctxEmp(employee),
  });
  if (!check.ok) return { ok: false, reason: check.reason || 'Horario fuera del horario laboral.' };
  if (check.warning === 'break') {
    return { ok: false, reason: (check.reason || '').replace('Esta cita cae dentro del descanso', 'Ese horario coincide con el descanso') };
  }
  return { ok: true };
}

// Huecos libres para varios días. Devuelve { 'YYYY-MM-DD': [{ start, label, employeeId }] }
export async function getSlotsRange({ supabase, tenant, service, employees, fromDate, days = 1, excludeApptId = null, step = 15 }) {
  const tz = tenantTz(tenant);
  const out = {};
  const emps = (employees || []).filter(Boolean);
  if (!service || emps.length === 0) return out;
  const dateStrs = Array.from({ length: days }, (_, i) => addDaysStr(fromDate, i));
  const rangeStart = localToUtc(dateStrs[0], 0, tz).toISOString();
  const rangeEnd = localToUtc(addDaysStr(dateStrs[dateStrs.length - 1], 1), 0, tz).toISOString();

  const { data: busy } = await supabase
    .from('appointments')
    .select('id, employee_id, start_at, end_at')
    .eq('tenant_id', tenant.id)
    .in('employee_id', emps.map((e) => e.id))
    .neq('status', 'cancelled')
    .lt('start_at', rangeEnd)
    .gt('end_at', rangeStart);

  const busyList = (busy || [])
    .filter((b) => b.id !== excludeApptId)
    .map((b) => ({ emp: b.employee_id, s: new Date(b.start_at).getTime(), e: new Date(b.end_at).getTime() }));

  const now = Date.now();
  const duration = service.duration_minutes || service.duration || 60;

  for (const ds of dateStrs) {
    const seen = new Map();
    for (const emp of emps) {
      const windows = getWorkingWindows(dayjs(ds), ctxTenant(tenant), ctxEmp(emp));
      for (const w of windows) {
        for (let t = w.startMin; t + duration <= w.endMin; t += step) {
          const label = hhmm(t);
          if (seen.has(label)) continue;
          const s = localToUtc(ds, t, tz).getTime();
          const e = s + duration * 60000;
          if (s <= now) continue;
          if (busyList.some((b) => b.emp === emp.id && s < b.e && e > b.s)) continue;
          seen.set(label, { start: new Date(s).toISOString(), label, employeeId: emp.id });
        }
      }
    }
    out[ds] = [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }
  return out;
}

// Revalida en el momento un hueco concreto: devuelve el primer empleado (prioriza `preferredId`)
// que tiene libre [start, start+duración) dentro de su horario, o null si nadie lo tiene libre.
export async function findFreeEmployeeForSlot({ supabase, tenant, service, employees, preferredId, start, excludeApptId = null }) {
  const startDate = new Date(start);
  if (!start || Number.isNaN(startDate.getTime()) || startDate.getTime() <= Date.now()) return null;
  const emps = (employees || []).filter(Boolean);
  if (!service || emps.length === 0) return null;
  const endDate = new Date(startDate.getTime() + (service.duration_minutes || service.duration || 60) * 60000);
  const ordered = [...emps].sort((a, b) => (a.id === preferredId ? -1 : b.id === preferredId ? 1 : 0));

  const { data: busy } = await supabase
    .from('appointments')
    .select('id, employee_id')
    .eq('tenant_id', tenant.id)
    .in('employee_id', ordered.map((e) => e.id))
    .neq('status', 'cancelled')
    .lt('start_at', endDate.toISOString())
    .gt('end_at', startDate.toISOString());
  const busyEmp = new Set((busy || []).filter((b) => b.id !== excludeApptId).map((b) => b.employee_id));

  for (const emp of ordered) {
    if (busyEmp.has(emp.id)) continue;
    if (validateCustomerSlot({ start: startDate, end: endDate, tenant, employee: emp }).ok) return emp;
  }
  return null;
}

async function loadTenant(supabase, { tenantId, tenantSlug }) {
  await syncProgram(supabase);
  let q = supabase.from('tenants').select('*');
  q = tenantId ? q.eq('id', tenantId) : q.eq('slug', tenantSlug);
  const { data: tenant } = await q.maybeSingle();
  if (!tenant) throw new BookingError('Negocio no encontrado', 404);
  if (tenant.status !== 'active') throw new BookingError('Negocio no activo', 403);
  return tenant;
}

async function assertNoOverlap(supabase, { tenantId, employeeId, startIso, endIso, excludeId }) {
  let q = supabase
    .from('appointments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .neq('status', 'cancelled')
    .lt('start_at', endIso)
    .gt('end_at', startIso);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q;
  if (data && data.length > 0) throw new BookingError('Ese horario ya está ocupado', 409);
}

function parseFutureStart(start) {
  const d = new Date(start);
  if (!start || Number.isNaN(d.getTime())) throw new BookingError('Fecha no válida');
  if (d.getTime() < Date.now()) throw new BookingError('No puedes reservar en el pasado');
  return d;
}

// Crea una reserva de cliente (web pública o WhatsApp) validando TODO en servidor.
export async function createBooking({ supabase, tenantId, tenantSlug, serviceId, employeeId, start, client, notes, source = 'online', matchPhoneByName = false }) {
  const tenant = await loadTenant(supabase, { tenantId, tenantSlug });
  // Límite de reservas del plan (Free: 50/mes)
  await assertCanAcceptBooking(supabase, tenant, BookingError);

  const { data: service } = await supabase
    .from('services').select('*')
    .eq('id', serviceId).eq('tenant_id', tenant.id).eq('active', true).maybeSingle();
  if (!service) throw new BookingError('Servicio no disponible');

  const { data: employee } = await supabase
    .from('employees').select('*')
    .eq('id', employeeId).eq('tenant_id', tenant.id).eq('active', true).maybeSingle();
  if (!employee) throw new BookingError('Empleado no disponible');

  const startDate = parseFutureStart(start);
  const endDate = new Date(startDate.getTime() + (service.duration_minutes || 60) * 60000);
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const check = validateCustomerSlot({ start: startDate, end: endDate, tenant, employee });
  if (!check.ok) throw new BookingError(check.reason);

  await assertNoOverlap(supabase, { tenantId: tenant.id, employeeId: employee.id, startIso, endIso });

  // Buscar o crear cliente (email, si no teléfono)
  const firstName = String(client?.firstName || '').trim();
  if (!firstName) throw new BookingError('El nombre es obligatorio');
  const email = String(client?.email || '').trim() || null;
  const phone = String(client?.phone || '').trim() || null;
  let clientRow = null;
  if (email) {
    const { data } = await supabase
      .from('clients').select('*')
      .eq('tenant_id', tenant.id).ilike('email', email).limit(1);
    clientRow = data?.[0] || null;
  }
  if (!clientRow && phone) {
    const matches = await findClientsByPhone(supabase, tenant.id, phone);
    if (matchPhoneByName) {
      // WhatsApp: reutilizar solo si coincide el nombre escrito (un mismo móvil puede reservar para varias personas)
      const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const wanted = norm(`${firstName} ${client?.lastName || ''}`);
      clientRow = matches.find((c) => norm(`${c.first_name} ${c.last_name || ''}`) === wanted) || null;
    } else {
      clientRow = matches[0] || null;
    }
  }
  if (!clientRow) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenant.id,
        first_name: firstName,
        last_name: String(client?.lastName || '').trim() || null,
        email,
        phone: source === 'whatsapp' ? normalizePhone(phone) || phone : phone,
        notes: notes || null,
      })
      .select('*')
      .single();
    if (error) throw new BookingError(error.message, 500);
    clientRow = data;
  } else if (!clientRow.phone && phone) {
    await supabase.from('clients').update({ phone }).eq('id', clientRow.id);
  }

  const { data: appt, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenant.id,
      employee_id: employee.id,
      client_id: clientRow.id,
      service_id: service.id,
      start_at: startIso,
      end_at: endIso,
      status: 'confirmed',
      notes: notes || null,
      source,
      payment_status: 'pending',
      payment_method: 'onsite',
      payment_amount: service.price,
    })
    .select('*')
    .single();
  if (error) {
    // El trigger de la base de datos también bloquea si se supera el límite del plan
    if (/l[ií]mite/i.test(error.message)) throw new BookingError('Este negocio no admite más reservas online este mes. Contacta directamente con el negocio, por favor.', 403);
    throw new BookingError(error.message, 500);
  }

  return { appointment: appt, tenant, service, employee, client: clientRow };
}

// Reprograma una cita existente validando horario y solapes.
export async function rescheduleAppointment({ supabase, apptId, start }) {
  const { data: appt } = await supabase
    .from('appointments')
    .select('*, tenant:tenants(*), employee:employees(*), service:services(*)')
    .eq('id', apptId)
    .maybeSingle();
  if (!appt) throw new BookingError('Reserva no encontrada', 404);
  if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
    throw new BookingError('Esta cita ya no se puede modificar');
  }
  const startDate = parseFutureStart(start);
  const endDate = new Date(startDate.getTime() + (appt.service?.duration_minutes || 60) * 60000);
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const check = validateCustomerSlot({ start: startDate, end: endDate, tenant: appt.tenant, employee: appt.employee });
  if (!check.ok) throw new BookingError(check.reason);

  await assertNoOverlap(supabase, {
    tenantId: appt.tenant_id, employeeId: appt.employee_id, startIso, endIso, excludeId: appt.id,
  });

  const { error } = await supabase
    .from('appointments')
    .update({ start_at: startIso, end_at: endIso, status: 'confirmed', reminder_24h_sent_at: null })
    .eq('id', appt.id);
  if (error) throw new BookingError(error.message, 500);
  return { ...appt, start_at: startIso, end_at: endIso, status: 'confirmed' };
}

export async function cancelAppointment({ supabase, apptId }) {
  const { data: appt } = await supabase.from('appointments').select('id, status').eq('id', apptId).maybeSingle();
  if (!appt) throw new BookingError('Reserva no encontrada', 404);
  if (appt.status === 'cancelled') return appt;
  if (['completed', 'no_show'].includes(appt.status)) throw new BookingError('Esta cita ya no se puede cancelar');
  const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', apptId);
  if (error) throw new BookingError(error.message, 500);
  return { ...appt, status: 'cancelled' };
}

// Mock data multi-tenant para la demo SaaS de reservas
// Persiste cambios en localStorage para que la demo se sienta real.

import dayjs from 'dayjs';
import { DEFAULT_BUSINESS_HOURS, DEFAULT_EMPLOYEE_SCHEDULE } from './booking';

const today = dayjs().startOf('day');
const d = (offsetDays, hour, minute = 0) =>
  today.add(offsetDays, 'day').hour(hour).minute(minute).second(0).toISOString();

const BH = DEFAULT_BUSINESS_HOURS;
const ES = DEFAULT_EMPLOYEE_SCHEDULE;

export const PLANS = [
  { id: 'plan_starter', name: 'Starter', price: 19, currency: 'EUR', interval: 'mes', features: ['1 empleado', '100 reservas/mes', 'Recordatorios email'] },
  { id: 'plan_pro', name: 'Pro', price: 49, currency: 'EUR', interval: 'mes', features: ['10 empleados', 'Reservas ilimitadas', 'WhatsApp + SMS', 'Pagos online'] },
  { id: 'plan_business', name: 'Business', price: 99, currency: 'EUR', interval: 'mes', features: ['Empleados ilimitados', 'Multi-sede', 'API + Integraciones', 'Soporte prioritario'] },
];

export const TENANTS = [
  {
    id: 't_fisio',
    name: 'FisioVital Madrid',
    slug: 'fisiovital',
    industry: 'Fisioterapia',
    logo: '🦴',
    color: '#0ea5e9',
    plan: 'plan_pro',
    status: 'active',
    createdAt: dayjs().subtract(8, 'month').toISOString(),
    mrr: 49,
    address: 'Calle Velázquez 23, Madrid',
    phone: '+34 910 123 456',
    email: 'hola@fisiovital.es',
  },
  {
    id: 't_peluq',
    name: 'Salón Bella',
    slug: 'salonbella',
    industry: 'Peluquería',
    logo: '💇',
    color: '#ec4899',
    plan: 'plan_pro',
    status: 'active',
    createdAt: dayjs().subtract(5, 'month').toISOString(),
    mrr: 49,
    address: 'Av. Diagonal 412, Barcelona',
    phone: '+34 933 987 654',
    email: 'reservas@salonbella.es',
  },
  {
    id: 't_vet',
    name: 'Clínica Veterinaria Patitas',
    slug: 'patitas',
    industry: 'Veterinaria',
    logo: '🐾',
    color: '#10b981',
    plan: 'plan_business',
    status: 'active',
    createdAt: dayjs().subtract(11, 'month').toISOString(),
    mrr: 99,
    address: 'Calle Mayor 17, Valencia',
    phone: '+34 963 222 111',
    email: 'info@patitas.vet',
  },
  {
    id: 't_barber',
    name: 'BarberShop King',
    slug: 'kingbarber',
    industry: 'Barbería',
    logo: '💈',
    color: '#f59e0b',
    plan: 'plan_starter',
    status: 'active',
    createdAt: dayjs().subtract(2, 'month').toISOString(),
    mrr: 19,
    address: 'Calle Sierpes 8, Sevilla',
    phone: '+34 954 555 333',
    email: 'cita@kingbarber.es',
  },
  {
    id: 't_nutri',
    name: 'NutriEquilibrio',
    slug: 'nutriequilibrio',
    industry: 'Nutrición',
    logo: '🥗',
    color: '#84cc16',
    plan: 'plan_starter',
    status: 'suspended',
    createdAt: dayjs().subtract(3, 'month').toISOString(),
    mrr: 0,
    address: 'Gran Vía 55, Bilbao',
    phone: '+34 944 777 888',
    email: 'hola@nutriequilibrio.com',
  },
];

export const EMPLOYEES = [
  // FisioVital
  { id: 'e1', tenantId: 't_fisio', firstName: 'Laura', lastName: 'García', email: 'laura@fisiovital.es', phone: '+34 600 111 222', specialty: 'Fisioterapia deportiva', avatar: '👩\u200d⚕️', color: '#0ea5e9', active: true },
  { id: 'e2', tenantId: 't_fisio', firstName: 'Marcos', lastName: 'Ruiz', email: 'marcos@fisiovital.es', phone: '+34 600 111 223', specialty: 'Osteopatía', avatar: '👨\u200d⚕️', color: '#6366f1', active: true },
  { id: 'e3', tenantId: 't_fisio', firstName: 'Sara', lastName: 'Pérez', email: 'sara@fisiovital.es', phone: '+34 600 111 224', specialty: 'Suelo pélvico', avatar: '👩', color: '#f43f5e', active: true },
  // Salón Bella
  { id: 'e4', tenantId: 't_peluq', firstName: 'Carla', lastName: 'Mendoza', email: 'carla@salonbella.es', phone: '+34 600 222 111', specialty: 'Coloración', avatar: '💇\u200d♀️', color: '#ec4899', active: true },
  { id: 'e5', tenantId: 't_peluq', firstName: 'Jorge', lastName: 'Lima', email: 'jorge@salonbella.es', phone: '+34 600 222 112', specialty: 'Corte y peinado', avatar: '💇\u200d♂️', color: '#a855f7', active: true },
  // Patitas
  { id: 'e6', tenantId: 't_vet', firstName: 'Diego', lastName: 'Salas', email: 'diego@patitas.vet', phone: '+34 600 333 111', specialty: 'Veterinario general', avatar: '🧑\u200d⚕️', color: '#10b981', active: true },
  { id: 'e7', tenantId: 't_vet', firstName: 'Patricia', lastName: 'Moreno', email: 'patricia@patitas.vet', phone: '+34 600 333 112', specialty: 'Cirugía', avatar: '👩\u200d⚕️', color: '#14b8a6', active: true },
  // Barber
  { id: 'e8', tenantId: 't_barber', firstName: 'Iván', lastName: 'Romero', email: 'ivan@kingbarber.es', phone: '+34 600 444 111', specialty: 'Barbero senior', avatar: '💈', color: '#f59e0b', active: true },
  // Nutri
  { id: 'e9', tenantId: 't_nutri', firstName: 'Elena', lastName: 'Torres', email: 'elena@nutriequilibrio.com', phone: '+34 600 555 111', specialty: 'Nutricionista clínica', avatar: '🥗', color: '#84cc16', active: true },
];

export const SERVICES = [
  // Fisio
  { id: 's1', tenantId: 't_fisio', name: 'Sesión fisioterapia', description: 'Sesión individual de fisioterapia 60 min', duration: 60, price: 50, color: '#0ea5e9', active: true },
  { id: 's2', tenantId: 't_fisio', name: 'Masaje descontracturante', description: 'Masaje terapéutico 45 min', duration: 45, price: 40, color: '#06b6d4', active: true },
  { id: 's3', tenantId: 't_fisio', name: 'Punción seca', description: 'Tratamiento puntos gatillo', duration: 30, price: 35, color: '#6366f1', active: true },
  // Peluq
  { id: 's4', tenantId: 't_peluq', name: 'Corte mujer', description: 'Corte + secado', duration: 45, price: 25, color: '#ec4899', active: true },
  { id: 's5', tenantId: 't_peluq', name: 'Tinte completo', description: 'Coloración + tratamiento', duration: 120, price: 65, color: '#d946ef', active: true },
  { id: 's6', tenantId: 't_peluq', name: 'Mechas', description: 'Mechas balayage', duration: 150, price: 90, color: '#a855f7', active: true },
  // Vet
  { id: 's7', tenantId: 't_vet', name: 'Consulta general', description: 'Revisión veterinaria', duration: 30, price: 35, color: '#10b981', active: true },
  { id: 's8', tenantId: 't_vet', name: 'Vacunación', description: 'Vacuna anual', duration: 20, price: 45, color: '#14b8a6', active: true },
  { id: 's9', tenantId: 't_vet', name: 'Cirugía menor', description: 'Cirugía ambulatoria', duration: 90, price: 180, color: '#0ea5e9', active: true },
  // Barber
  { id: 's10', tenantId: 't_barber', name: 'Corte clásico', description: 'Corte tijera + máquina', duration: 30, price: 15, color: '#f59e0b', active: true },
  { id: 's11', tenantId: 't_barber', name: 'Barba + afeitado', description: 'Arreglo barba con toalla caliente', duration: 30, price: 12, color: '#ef4444', active: true },
  // Nutri
  { id: 's12', tenantId: 't_nutri', name: 'Consulta nutricional', description: 'Plan personalizado', duration: 60, price: 70, color: '#84cc16', active: true },
];

export const CLIENTS = [
  { id: 'c1', tenantId: 't_fisio', firstName: 'Ana', lastName: 'Martínez', email: 'ana.m@gmail.com', phone: '+34 611 222 333', notes: 'Lumbalgia crónica', createdAt: dayjs().subtract(6, 'month').toISOString() },
  { id: 'c2', tenantId: 't_fisio', firstName: 'Pedro', lastName: 'López', email: 'pedro@hotmail.com', phone: '+34 611 222 334', notes: 'Recuperación rodilla', createdAt: dayjs().subtract(3, 'month').toISOString() },
  { id: 'c3', tenantId: 't_fisio', firstName: 'María', lastName: 'Sanz', email: 'maria.sanz@gmail.com', phone: '+34 611 222 335', notes: 'Postparto', createdAt: dayjs().subtract(2, 'month').toISOString() },
  { id: 'c4', tenantId: 't_fisio', firstName: 'Javier', lastName: 'Núñez', email: 'javi.n@gmail.com', phone: '+34 611 222 336', notes: 'Cervicalgia', createdAt: dayjs().subtract(1, 'month').toISOString() },
  { id: 'c5', tenantId: 't_peluq', firstName: 'Lucía', lastName: 'Vidal', email: 'lucia.v@gmail.com', phone: '+34 612 333 444', notes: 'Pelo teñido rubio', createdAt: dayjs().subtract(4, 'month').toISOString() },
  { id: 'c6', tenantId: 't_peluq', firstName: 'Isabel', lastName: 'Cano', email: 'isa.c@gmail.com', phone: '+34 612 333 445', notes: '', createdAt: dayjs().subtract(2, 'month').toISOString() },
  { id: 'c7', tenantId: 't_vet', firstName: 'Roberto', lastName: 'Jiménez (Luna)', email: 'rob@gmail.com', phone: '+34 613 444 555', notes: 'Perra labrador 4 años', createdAt: dayjs().subtract(5, 'month').toISOString() },
  { id: 'c8', tenantId: 't_vet', firstName: 'Sofía', lastName: 'Reyes (Michi)', email: 'sofia@gmail.com', phone: '+34 613 444 556', notes: 'Gato persa', createdAt: dayjs().subtract(1, 'month').toISOString() },
  { id: 'c9', tenantId: 't_barber', firstName: 'Carlos', lastName: 'Beltrán', email: 'carlos@gmail.com', phone: '+34 614 555 666', notes: 'Degradado bajo', createdAt: dayjs().subtract(2, 'month').toISOString() },
  { id: 'c10', tenantId: 't_nutri', firstName: 'Raquel', lastName: 'Domínguez', email: 'raquel@gmail.com', phone: '+34 615 666 777', notes: 'Objetivo perder peso', createdAt: dayjs().subtract(1, 'month').toISOString() },
];

export const APPOINTMENTS = [
  // FisioVital - esta semana
  { id: 'a1', tenantId: 't_fisio', employeeId: 'e1', clientId: 'c1', serviceId: 's1', start: d(0, 9, 0), end: d(0, 10, 0), status: 'confirmed', payment: { status: 'paid', amount: 50, method: 'stripe' } },
  { id: 'a2', tenantId: 't_fisio', employeeId: 'e1', clientId: 'c2', serviceId: 's2', start: d(0, 10, 30), end: d(0, 11, 15), status: 'confirmed', payment: { status: 'pending', amount: 40, method: 'onsite' } },
  { id: 'a3', tenantId: 't_fisio', employeeId: 'e2', clientId: 'c3', serviceId: 's3', start: d(0, 11, 0), end: d(0, 11, 30), status: 'pending', payment: { status: 'pending', amount: 35, method: 'onsite' } },
  { id: 'a4', tenantId: 't_fisio', employeeId: 'e3', clientId: 'c4', serviceId: 's1', start: d(0, 16, 0), end: d(0, 17, 0), status: 'confirmed', payment: { status: 'paid', amount: 50, method: 'stripe' } },
  { id: 'a5', tenantId: 't_fisio', employeeId: 'e1', clientId: 'c2', serviceId: 's1', start: d(1, 9, 0), end: d(1, 10, 0), status: 'confirmed', payment: { status: 'paid', amount: 50, method: 'stripe' } },
  { id: 'a6', tenantId: 't_fisio', employeeId: 'e2', clientId: 'c1', serviceId: 's2', start: d(1, 12, 0), end: d(1, 12, 45), status: 'confirmed', payment: { status: 'pending', amount: 40, method: 'onsite' } },
  { id: 'a7', tenantId: 't_fisio', employeeId: 'e1', clientId: 'c3', serviceId: 's1', start: d(2, 10, 0), end: d(2, 11, 0), status: 'confirmed', payment: { status: 'paid', amount: 50, method: 'stripe' } },
  { id: 'a8', tenantId: 't_fisio', employeeId: 'e3', clientId: 'c4', serviceId: 's3', start: d(2, 17, 0), end: d(2, 17, 30), status: 'pending', payment: { status: 'pending', amount: 35, method: 'onsite' } },
  { id: 'a9', tenantId: 't_fisio', employeeId: 'e1', clientId: 'c1', serviceId: 's1', start: d(3, 11, 0), end: d(3, 12, 0), status: 'confirmed', payment: { status: 'paid', amount: 50, method: 'stripe' } },
  { id: 'a10', tenantId: 't_fisio', employeeId: 'e2', clientId: 'c2', serviceId: 's2', start: d(4, 9, 30), end: d(4, 10, 15), status: 'confirmed', payment: { status: 'paid', amount: 40, method: 'stripe' } },
  { id: 'a11', tenantId: 't_fisio', employeeId: 'e1', clientId: 'c3', serviceId: 's1', start: d(-1, 10, 0), end: d(-1, 11, 0), status: 'completed', payment: { status: 'paid', amount: 50, method: 'stripe' } },
  { id: 'a12', tenantId: 't_fisio', employeeId: 'e2', clientId: 'c4', serviceId: 's2', start: d(-2, 16, 0), end: d(-2, 16, 45), status: 'no_show', payment: { status: 'failed', amount: 40, method: 'onsite' } },
  // Salón Bella
  { id: 'a13', tenantId: 't_peluq', employeeId: 'e4', clientId: 'c5', serviceId: 's5', start: d(0, 10, 0), end: d(0, 12, 0), status: 'confirmed', payment: { status: 'paid', amount: 65, method: 'stripe' } },
  { id: 'a14', tenantId: 't_peluq', employeeId: 'e5', clientId: 'c6', serviceId: 's4', start: d(0, 13, 0), end: d(0, 13, 45), status: 'confirmed', payment: { status: 'pending', amount: 25, method: 'onsite' } },
  { id: 'a15', tenantId: 't_peluq', employeeId: 'e4', clientId: 'c5', serviceId: 's6', start: d(2, 16, 0), end: d(2, 18, 30), status: 'confirmed', payment: { status: 'paid', amount: 90, method: 'stripe' } },
  // Vet
  { id: 'a16', tenantId: 't_vet', employeeId: 'e6', clientId: 'c7', serviceId: 's7', start: d(0, 11, 0), end: d(0, 11, 30), status: 'confirmed', payment: { status: 'paid', amount: 35, method: 'stripe' } },
  { id: 'a17', tenantId: 't_vet', employeeId: 'e7', clientId: 'c8', serviceId: 's9', start: d(1, 9, 0), end: d(1, 10, 30), status: 'confirmed', payment: { status: 'paid', amount: 180, method: 'stripe' } },
  // Barber
  { id: 'a18', tenantId: 't_barber', employeeId: 'e8', clientId: 'c9', serviceId: 's10', start: d(0, 17, 0), end: d(0, 17, 30), status: 'confirmed', payment: { status: 'pending', amount: 15, method: 'onsite' } },
];

export const SCHEDULES = {
  // empleadoId -> array de horarios (0=Domingo, 1=Lunes, ..., 6=Sábado)
  e1: [{ day: 1, from: '09:00', to: '18:00' }, { day: 2, from: '09:00', to: '18:00' }, { day: 3, from: '09:00', to: '18:00' }, { day: 4, from: '09:00', to: '18:00' }, { day: 5, from: '09:00', to: '14:00' }],
  e2: [{ day: 1, from: '10:00', to: '19:00' }, { day: 2, from: '10:00', to: '19:00' }, { day: 3, from: '10:00', to: '19:00' }, { day: 4, from: '10:00', to: '19:00' }],
  e3: [{ day: 2, from: '15:00', to: '20:00' }, { day: 4, from: '15:00', to: '20:00' }, { day: 5, from: '09:00', to: '14:00' }],
};

export const ACTIVITY_LOG = [
  { id: 'log1', tenantId: 't_fisio', action: 'Reserva creada', user: 'Laura García', date: dayjs().subtract(2, 'hour').toISOString() },
  { id: 'log2', tenantId: 't_fisio', action: 'Cliente añadido: María Sanz', user: 'Admin', date: dayjs().subtract(5, 'hour').toISOString() },
  { id: 'log3', tenantId: 't_fisio', action: 'Pago recibido: 50€', user: 'Sistema', date: dayjs().subtract(1, 'day').toISOString() },
];

export const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  completed: { label: 'Completada', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  cancelled: { label: 'Cancelada', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  no_show: { label: 'No asistió', color: 'bg-zinc-200 text-zinc-700 border-zinc-300' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Pendiente', color: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Pagado', color: 'bg-emerald-50 text-emerald-700' },
  refunded: { label: 'Reembolsado', color: 'bg-zinc-100 text-zinc-700' },
  failed: { label: 'Fallido', color: 'bg-rose-50 text-rose-700' },
};

// Planes de suscripción de Reserva360 (fuente única de verdad, usable en cliente y servidor)

export const TRIAL_DAYS = 14;

export const PLANS = [
  {
    id: 'plan_free', key: 'free', name: 'Free', monthly: 0, yearly: 0,
    tagline: 'Para empezar',
    limits: { employees: 1, monthlyBookings: 50, whatsapp: false, reminders: false, vacations: false, analytics: false, onlinePayments: false },
    features: [
      '1 profesional', 'Agenda online', 'Hasta 50 reservas al mes', 'Perfil público del negocio',
      'Servicios y precios', 'Gestión básica de clientes', 'Reservas desde la app',
    ],
  },
  {
    id: 'plan_pro', key: 'pro', name: 'Pro', monthly: 19.99, yearly: 220, popular: true,
    tagline: 'Para negocios en crecimiento',
    limits: { employees: 3, monthlyBookings: null, whatsapp: true, reminders: true, vacations: true, analytics: true, onlinePayments: false },
    features: [
      'Reservas ilimitadas', 'Hasta 3 profesionales', 'Agenda independiente por profesional',
      'Reservas y gestión de citas con el WhatsApp Business del negocio', 'Recordatorios automáticos por email y WhatsApp',
      'Gestión avanzada de clientes', 'Historial de reservas', 'Bloqueo de horarios y vacaciones',
      'Estadísticas de ingresos y reservas', 'Gestión de cancelaciones',
    ],
  },
  {
    id: 'plan_business', key: 'business', name: 'Business', monthly: 39.99, yearly: 440,
    tagline: 'Para equipos',
    limits: { employees: 10, monthlyBookings: null, whatsapp: true, reminders: true, vacations: true, analytics: true, onlinePayments: true },
    features: [
      'Todo lo del plan Pro', 'Hasta 10 profesionales', 'Gestión de varios trabajadores',
      'Agenda independiente por profesional', 'Asignación de reservas', 'Pagos online y depósitos',
      'Informes avanzados', 'Personalización del perfil',
    ],
  },
];

export const getPlan = (id) => PLANS.find((p) => p.id === id || p.key === id) || PLANS[0];

const PAID_STATUSES = ['active', 'trialing', 'past_due'];

// MODO LANZAMIENTO: mientras la app sea gratis, todos los negocios tienen el plan Pro sin pagar,
// no hay prueba de 14 días y no se puede suscribir. Para activar los pagos:
//   1) poner NEXT_PUBLIC_LAUNCH_FREE_MODE=false (o cambiar el valor por defecto a 'false')
//   2) ejecutar en Supabase la parte "VOLVER AL MODO DE PAGO" de public/migration-modo-lanzamiento.sql
export const LAUNCH_FREE_MODE = (process.env.NEXT_PUBLIC_LAUNCH_FREE_MODE ?? 'true') !== 'false';
export const LAUNCH_PLAN_ID = 'plan_pro';

const isPaid = (tenant) => {
  const pid = tenant?.plan_id || tenant?.plan;
  const sub = tenant?.subscription_status || tenant?.subscriptionStatus;
  return PAID_STATUSES.includes(sub) && (pid === 'plan_pro' || pid === 'plan_business');
};

// Plan que se aplica de verdad: suscripción pagada > modo lanzamiento (Pro) > prueba de 14 días (Pro) > Free
export function effectivePlanId(tenant) {
  if (isPaid(tenant)) return tenant?.plan_id || tenant?.plan;
  if (LAUNCH_FREE_MODE) return LAUNCH_PLAN_ID;
  const trial = tenant?.trial_ends_at || tenant?.trialEndsAt;
  if (trial && new Date(trial).getTime() > Date.now()) return 'plan_pro';
  return 'plan_free';
}

export function isOnTrial(tenant) {
  if (LAUNCH_FREE_MODE || isPaid(tenant)) return false;
  const trial = tenant?.trial_ends_at || tenant?.trialEndsAt;
  return Boolean(trial && new Date(trial).getTime() > Date.now());
}

export function trialDaysLeft(tenant) {
  if (LAUNCH_FREE_MODE) return 0;
  const trial = tenant?.trial_ends_at || tenant?.trialEndsAt;
  if (!trial) return 0;
  return Math.max(0, Math.ceil((new Date(trial).getTime() - Date.now()) / 86400000));
}

export const planLimits = (tenant) => getPlan(effectivePlanId(tenant)).limits;

export const PRICE_LOOKUP = {
  pro_month: 'r360_pro_eur_month',
  pro_year: 'r360_pro_eur_year',
  business_month: 'r360_business_eur_month',
  business_year: 'r360_business_eur_year',
};

export const PAYMENT_MODES = {
  onsite: 'Pago en el local',
  optional: 'El cliente elige (local u online)',
  deposit: 'Señal online obligatoria',
  full: 'Pago online completo obligatorio',
};

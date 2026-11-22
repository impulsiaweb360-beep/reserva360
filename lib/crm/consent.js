// Textos legales del formulario de captación (versionados: se guarda la versión aceptada con cada envío)
export const CONSENT_VERSION = '2026-11-v1';

export const REQUEST_TYPES = [
  { id: 'info', label: 'Quiero información' },
  { id: 'demo', label: 'Quiero una demostración' },
  { id: 'free', label: 'Quiero empezar gratis' },
  { id: 'plans', label: 'Quiero conocer los planes PRO y Business' },
];
export const REQUEST_IDS = REQUEST_TYPES.map((r) => r.id);
export const requestLabel = (id) => REQUEST_TYPES.find((r) => r.id === id)?.label || id || '—';

export const EMPLOYEE_RANGES = ['Solo yo', '2-3', '4-10', '11-25', 'Más de 25'];
export const employeesFromRange = (r) => ({ 'Solo yo': 1, '2-3': 3, '4-10': 10, '11-25': 25, 'Más de 25': 50 }[r] ?? null);

export const CURRENT_SYSTEMS = ['Agenda en papel', 'WhatsApp / teléfono', 'Google Calendar / Excel', 'Otro programa de reservas', 'Ninguno'];

export const CONSENT_TEXTS = {
  privacy: 'He leído la información de privacidad y acepto que Reserva360 trate mis datos para gestionar esta solicitud.',
  email: 'Quiero recibir por email novedades y ofertas comerciales de Reserva360 (opcional).',
  whatsapp: 'Quiero recibir por WhatsApp novedades y ofertas comerciales de Reserva360 (opcional).',
  info: 'Responsable: Reserva360. Finalidad: atender tu solicitud y, solo si lo marcas, enviarte comunicaciones comerciales. Base jurídica: tu solicitud (medidas precontractuales) y tu consentimiento para la publicidad. No cedemos tus datos salvo obligación legal; usamos proveedores (alojamiento y protección antispam) con garantías. Puedes acceder, rectificar, suprimir, oponerte y retirar el consentimiento en cualquier momento escribiendo a reserva360.app@gmail.com.',
};

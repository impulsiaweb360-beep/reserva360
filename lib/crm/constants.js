// Constantes del CRM Comercial (compartidas por servidor y panel)
import { SECTORS } from '@/lib/marketing/sectors';

export const CRM_STAGES = [
  { id: 'new', label: 'Nuevo lead', color: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500', open: true },
  { id: 'to_qualify', label: 'Pendiente de cualificar', color: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-500', open: true },
  { id: 'contacted', label: 'Contactado', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500', open: true },
  { id: 'interested', label: 'Interesado', color: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-500', open: true },
  { id: 'demo_requested', label: 'Demo solicitada', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', open: true },
  { id: 'demo_done', label: 'Demo realizada', color: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500', open: true },
  { id: 'free_signup', label: 'Registro FREE', color: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-500' },
  { id: 'client_pro', label: 'Cliente PRO', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  { id: 'client_business', label: 'Cliente Business', color: 'bg-green-100 text-green-900 border-green-300', dot: 'bg-green-700' },
  { id: 'lost', label: 'Perdido', color: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  { id: 'do_not_contact', label: 'No contactar', color: 'bg-zinc-200 text-zinc-800 border-zinc-300', dot: 'bg-zinc-700' },
];
export const STAGE_IDS = CRM_STAGES.map((s) => s.id);
export const OPEN_STAGES = CRM_STAGES.filter((s) => s.open).map((s) => s.id);
export const CLIENT_STAGES = ['free_signup', 'client_pro', 'client_business'];
export const stageLabel = (id) => CRM_STAGES.find((s) => s.id === id)?.label || id;
export const stageMeta = (id) => CRM_STAGES.find((s) => s.id === id) || CRM_STAGES[0];

export const CRM_SOURCES = [
  { id: 'web_form', label: 'Formulario web Reserva360' },
  { id: 'facebook_lead_ads', label: 'Facebook Lead Ads' },
  { id: 'instagram_lead_ads', label: 'Instagram Lead Ads' },
  { id: 'google_places', label: 'Google Places / investigación comercial' },
  { id: 'referral', label: 'Referido' },
  { id: 'manual', label: 'Contacto manual' },
  { id: 'app_signup', label: 'Registro en Reserva360' },
  { id: 'other', label: 'Otros' },
];
export const SOURCE_IDS = CRM_SOURCES.map((s) => s.id);
export const sourceLabel = (id) => CRM_SOURCES.find((s) => s.id === id)?.label || id || '—';

export const CRM_SECTORS = [...SECTORS.map((s) => s.name), 'Otro'];

export const LEGAL_BASES = [
  { id: 'consent', label: 'Consentimiento', hint: 'La persona aceptó expresamente ser contactada.' },
  { id: 'pre_contract', label: 'Solicitud de información / demo', hint: 'La persona pidió información o una demo.' },
  { id: 'legitimate_interest', label: 'Interés legítimo (B2B)', hint: 'Contacto profesional; no autoriza publicidad por email/WhatsApp sin consentimiento (LSSI).' },
  { id: 'contract', label: 'Cliente / usuario registrado', hint: 'Relación contractual con Reserva360.' },
];
export const LEGAL_IDS = LEGAL_BASES.map((l) => l.id);
export const legalLabel = (id) => LEGAL_BASES.find((l) => l.id === id)?.label || id;

export const ACTIVITY_TYPES = [
  { id: 'call', label: 'Llamada realizada', manual: true },
  { id: 'email', label: 'Email enviado manualmente', manual: true },
  { id: 'meeting', label: 'Reunión', manual: true },
  { id: 'demo', label: 'Demostración', manual: true },
  { id: 'note', label: 'Nota interna', manual: true },
  { id: 'signup', label: 'Registro en Reserva360', manual: true },
  { id: 'conversion', label: 'Conversión a cliente', manual: true },
  { id: 'correction', label: 'Corrección', manual: true },
  { id: 'stage_change', label: 'Cambio de etapa' },
  { id: 'task', label: 'Tarea' },
  { id: 'import', label: 'Importación' },
  { id: 'link', label: 'Vinculación' },
  { id: 'privacy', label: 'Privacidad' },
  { id: 'system', label: 'Sistema' },
];
export const MANUAL_ACTIVITY_IDS = ACTIVITY_TYPES.filter((a) => a.manual).map((a) => a.id);
export const CONTACT_ACTIVITY_IDS = ['call', 'email', 'meeting', 'demo'];
export const activityLabel = (id) => ACTIVITY_TYPES.find((a) => a.id === id)?.label || id;

export const TASK_TYPES = [
  { id: 'contact', label: 'Contactar al negocio' },
  { id: 'call', label: 'Realizar una llamada' },
  { id: 'send_info', label: 'Enviar información' },
  { id: 'demo_prep', label: 'Preparar una demostración' },
  { id: 'follow_up', label: 'Hacer seguimiento' },
  { id: 'review', label: 'Revisar una oportunidad' },
  { id: 'other', label: 'Otra' },
];
export const taskTypeLabel = (id) => TASK_TYPES.find((t) => t.id === id)?.label || id;
export const TASK_PRIORITIES = [
  { id: 'high', label: 'Alta', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'medium', label: 'Media', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'low', label: 'Baja', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];
export const priorityMeta = (id) => TASK_PRIORITIES.find((p) => p.id === id) || TASK_PRIORITIES[1];
export const TASK_STATUSES = [
  { id: 'pending', label: 'Pendiente' },
  { id: 'completed', label: 'Completada' },
  { id: 'cancelled', label: 'Cancelada' },
];

export const PRIVACY_TYPES = [
  { id: 'access', label: 'Acceso a sus datos' },
  { id: 'rectification', label: 'Rectificación' },
  { id: 'erasure', label: 'Supresión (borrar datos)' },
  { id: 'opposition', label: 'Oposición a comunicaciones' },
  { id: 'restriction', label: 'Limitación del tratamiento' },
  { id: 'portability', label: 'Portabilidad' },
];
export const privacyLabel = (id) => PRIVACY_TYPES.find((p) => p.id === id)?.label || id;

export const INTEREST_LEVELS = [
  { id: 'low', label: 'Bajo' },
  { id: 'medium', label: 'Medio' },
  { id: 'high', label: 'Alto' },
];
export const SUGGESTED_PLANS = [
  { id: 'free', label: 'FREE' },
  { id: 'pro', label: 'PRO' },
  { id: 'business', label: 'Business' },
];

// Columnas de importación/exportación CSV (cabecera → campo)
export const CSV_FIELDS = [
  { key: 'first_name', label: 'Nombre', aliases: ['nombre', 'first name', 'first_name', 'name'] },
  { key: 'last_name', label: 'Apellidos', aliases: ['apellidos', 'apellido', 'last name', 'last_name'] },
  { key: 'business_name', label: 'Negocio', aliases: ['negocio', 'empresa', 'business', 'business_name', 'company', 'nombre del negocio'] },
  { key: 'email', label: 'Email', aliases: ['email', 'correo', 'e-mail', 'mail'] },
  { key: 'phone', label: 'Teléfono', aliases: ['telefono', 'teléfono', 'phone', 'movil', 'móvil', 'tel'] },
  { key: 'website', label: 'Web', aliases: ['web', 'website', 'url', 'sitio web'] },
  { key: 'sector', label: 'Sector', aliases: ['sector', 'actividad', 'categoria', 'categoría'] },
  { key: 'address', label: 'Dirección', aliases: ['direccion', 'dirección', 'address', 'ubicacion', 'ubicación'] },
  { key: 'city', label: 'Ciudad', aliases: ['ciudad', 'city', 'localidad', 'municipio'] },
  { key: 'province', label: 'Provincia', aliases: ['provincia', 'province', 'region', 'región'] },
  { key: 'needs', label: 'Necesidades', aliases: ['necesidades', 'needs'] },
  { key: 'employees_estimate', label: 'Empleados', aliases: ['empleados', 'employees', 'nº empleados', 'num empleados'] },
  { key: 'notes', label: 'Observaciones', aliases: ['observaciones', 'notas', 'notes', 'comentarios'] },
];

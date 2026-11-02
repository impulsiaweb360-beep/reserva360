-- =================================================================================
-- MIGRACIÓN: WhatsApp (YCloud) + horario validado en servidor
-- =================================================================================
-- Aplica en Supabase → SQL Editor → ejecuta este bloque completo.
-- Es idempotente: se puede ejecutar las veces que haga falta.
-- =================================================================================

-- 1) Zona horaria del negocio (el horario se interpreta en esta zona)
alter table public.tenants
  add column if not exists timezone text not null default 'Europe/Madrid';

-- 2) Control del recordatorio de WhatsApp (independiente del email)
alter table public.appointments
  add column if not exists whatsapp_reminder_sent_at timestamptz;

-- 3) Configuración de WhatsApp por negocio (cada negocio usa su propia cuenta YCloud)
create table if not exists public.tenant_whatsapp (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default true,
  api_key text not null,
  phone text not null,
  waba_id text,
  webhook_id text,
  webhook_secret text,
  business_phone text,
  country_code text not null default '34',
  notify_confirmation boolean not null default true,
  notify_reminder boolean not null default true,
  notify_changes boolean not null default true,
  notify_business boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Estado de cada conversación del bot
create table if not exists public.whatsapp_sessions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone text not null,
  state jsonb not null default '{}'::jsonb,
  last_inbound_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, phone)
);

-- 5) Eventos recibidos de YCloud (evita procesar dos veces el mismo mensaje)
create table if not exists public.whatsapp_events (
  event_id text primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now()
);

-- 6) Registro de mensajes enviados (para ver en el panel si se entregaron)
create table if not exists public.whatsapp_messages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  to_phone text,
  kind text,
  template text,
  status text,
  ycloud_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_whatsapp_messages_tenant on public.whatsapp_messages(tenant_id, created_at desc);
create index if not exists idx_whatsapp_messages_ycloud on public.whatsapp_messages(ycloud_id);

-- 7) Seguridad: estas tablas solo las usa el servidor (clave de servicio).
--    Sin políticas = ningún usuario ni visitante puede leerlas desde el navegador.
alter table public.tenant_whatsapp   enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.whatsapp_events   enable row level security;
alter table public.whatsapp_messages enable row level security;

-- 8) Cerrar la puerta trasera: las reservas públicas ahora pasan SIEMPRE por el servidor
--    (/api/public/book), que valida horario del negocio, del empleado, descansos y vacaciones.
revoke execute on function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, text, text, text, text
) from anon, authenticated, public;

-- ✅ Listo.

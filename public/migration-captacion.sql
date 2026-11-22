-- ============================================================================
-- Reserva360 · Fase 3 · Captación automática de leads (web, Facebook e Instagram Lead Ads)
-- Ejecutar en Supabase → SQL Editor → Run. Se puede ejecutar varias veces.
-- NO borra datos. Solo crea la tabla crm_capture_events y amplía los tipos de actividad del CRM.
-- Reversión al final del archivo (comentada).
-- ============================================================================

-- 1) Registro de envíos y notificaciones recibidos (idempotencia + métricas + límite de peticiones)
create table if not exists public.crm_capture_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('web','meta')),
  source text check (source in ('web_form','facebook_lead_ads','instagram_lead_ads')),
  external_id text,                 -- leadgen_id de Meta / id de envío del formulario web
  idempotency_key text,             -- clave única por envío
  status text not null default 'received'
    check (status in ('received','processed','duplicate','review','failed','ignored','spam','test','rate_limited')),
  lead_id uuid references public.crm_leads(id) on delete set null,
  request_type text,                -- info | demo | free | plans
  form_id text, form_name text, page_id text, platform text,
  campaign_id text, campaign_name text, adset_id text, adset_name text, ad_id text, ad_name text,
  is_organic boolean,
  review_reason text, reviewed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null,
  error text,                       -- sin datos personales
  attempts int not null default 0,
  ip_hash text, email_hash text,    -- hashes (no se guarda la IP ni el email en claro aquí)
  is_test boolean not null default false,
  payload jsonb not null default '{}'::jsonb,   -- solo metadatos técnicos (sin datos personales)
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_capture_events_ext_uniq on public.crm_capture_events (channel, external_id) where external_id is not null;
create unique index if not exists crm_capture_events_idem_uniq on public.crm_capture_events (idempotency_key) where idempotency_key is not null;
create index if not exists crm_capture_events_received_idx on public.crm_capture_events (received_at desc);
create index if not exists crm_capture_events_status_idx on public.crm_capture_events (status);
create index if not exists crm_capture_events_ip_idx on public.crm_capture_events (ip_hash, received_at desc);
create index if not exists crm_capture_events_email_idx on public.crm_capture_events (email_hash, received_at desc);
create index if not exists crm_capture_events_lead_idx on public.crm_capture_events (lead_id);

-- 2) Seguridad: lectura solo Super Admin; escritura solo desde el servidor (service role)
alter table public.crm_capture_events enable row level security;
drop policy if exists crm_capture_events_sa_select on public.crm_capture_events;
create policy crm_capture_events_sa_select on public.crm_capture_events for select using (public.is_super_admin());
revoke all on public.crm_capture_events from anon, authenticated;
grant select on public.crm_capture_events to authenticated;

-- 3) Ampliación mínima del CRM: nuevo tipo de actividad «capture» (lead recibido por un canal)
alter table public.crm_activities drop constraint if exists crm_activities_type_check;
alter table public.crm_activities add constraint crm_activities_type_check
  check (type in ('call','email','meeting','demo','note','stage_change','signup','conversion','task','import','link','privacy','correction','system','capture'));

-- ============================================================================
-- REVERSIÓN (solo si fuese necesario; borra el registro de eventos de captación):
-- delete from public.crm_activities where type = 'capture';  -- (requiere set_config('crm.redact','on',true) en la misma transacción)
-- alter table public.crm_activities drop constraint if exists crm_activities_type_check;
-- alter table public.crm_activities add constraint crm_activities_type_check check (type in ('call','email','meeting','demo','note','stage_change','signup','conversion','task','import','link','privacy','correction','system'));
-- drop table if exists public.crm_capture_events;
-- ============================================================================

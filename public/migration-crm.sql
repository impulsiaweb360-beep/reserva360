-- =====================================================================
-- Reserva360 · FASE 2 · CRM Comercial (solo Super Admin)
-- Crea SOLO tablas y funciones nuevas con prefijo crm_. No modifica ni borra
-- ninguna tabla existente (tenants, profiles, appointments, pagos, fundadores…).
-- Es idempotente: se puede ejecutar varias veces.
-- Para deshacerla, ver el bloque "ROLLBACK" al final del archivo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Leads comerciales
-- ---------------------------------------------------------------------
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  -- Contacto
  first_name text,
  last_name text,
  business_name text,
  email text,
  phone text,
  phone_digits text generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored,
  website text,
  sector text,
  address text,
  city text,
  province text,
  -- Comercial
  source text not null default 'manual'
    check (source in ('web_form','facebook_lead_ads','instagram_lead_ads','google_places','referral','manual','app_signup','other')),
  source_detail text,
  external_source_id text,                -- preparado para Meta Lead Ads / Google Places (fases 3 y 4)
  needs text,
  employees_estimate integer check (employees_estimate is null or (employees_estimate >= 0 and employees_estimate <= 100000)),
  interest_level text check (interest_level is null or interest_level in ('low','medium','high')),
  suggested_plan text check (suggested_plan is null or suggested_plan in ('free','pro','business')),
  stage text not null default 'new'
    check (stage in ('new','to_qualify','contacted','interested','demo_requested','demo_done','free_signup','client_pro','client_business','lost','do_not_contact')),
  notes text,
  -- Privacidad (RGPD / LOPDGDD / LSSI)
  legal_basis text not null default 'legitimate_interest'
    check (legal_basis in ('consent','legitimate_interest','pre_contract','contract')),
  data_origin text,                       -- de dónde se obtuvieron los datos (documentado)
  consent_at timestamptz,
  consent_source text,
  comm_email boolean not null default false,     -- preferencias de comunicación (no se envía nada en esta fase)
  comm_phone boolean not null default false,
  comm_whatsapp boolean not null default false,
  opted_out boolean not null default false,      -- oposición a comunicaciones comerciales
  opted_out_at timestamptz,
  anonymized_at timestamptz,
  -- Vinculación con datos reales de la app (solo lectura: el CRM nunca modifica estas entidades)
  linked_user_id uuid references public.profiles(id) on delete set null,
  linked_tenant_id uuid references public.tenants(id) on delete set null,
  -- Seguimiento
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  -- Preparado para fase 5 (IA)
  score integer check (score is null or (score between 0 and 100)),
  ai_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_identity check (coalesce(nullif(trim(business_name), ''), nullif(trim(first_name), ''), nullif(trim(email), '')) is not null),
  constraint crm_leads_email_lower check (email is null or email = lower(trim(email)))
);

-- Sin duplicados: un email por lead, un negocio real por lead, un id externo por fuente
create unique index if not exists crm_leads_email_uniq on public.crm_leads (email) where email is not null;
create unique index if not exists crm_leads_tenant_uniq on public.crm_leads (linked_tenant_id) where linked_tenant_id is not null;
create unique index if not exists crm_leads_external_uniq on public.crm_leads (source, external_source_id) where external_source_id is not null;
create index if not exists crm_leads_stage_idx on public.crm_leads (stage);
create index if not exists crm_leads_created_idx on public.crm_leads (created_at desc);
create index if not exists crm_leads_next_contact_idx on public.crm_leads (next_contact_at);
create index if not exists crm_leads_phone_idx on public.crm_leads (phone_digits);
create index if not exists crm_leads_sector_idx on public.crm_leads (sector);
create index if not exists crm_leads_source_idx on public.crm_leads (source);
create index if not exists crm_leads_user_idx on public.crm_leads (linked_user_id);

-- ---------------------------------------------------------------------
-- 2. Actividades (historial cronológico, solo se añade)
-- ---------------------------------------------------------------------
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  type text not null check (type in ('call','email','meeting','demo','note','stage_change','signup','conversion','task','import','link','privacy','correction','system')),
  description text not null check (length(description) between 1 and 5000),
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists crm_activities_lead_idx on public.crm_activities (lead_id, occurred_at desc);
create index if not exists crm_activities_created_idx on public.crm_activities (created_at desc);

-- ---------------------------------------------------------------------
-- 3. Tareas comerciales
-- ---------------------------------------------------------------------
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  task_type text not null default 'follow_up' check (task_type in ('contact','call','send_info','demo_prep','follow_up','review','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  due_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_tasks_status_due_idx on public.crm_tasks (status, due_at);
create index if not exists crm_tasks_lead_idx on public.crm_tasks (lead_id);

-- ---------------------------------------------------------------------
-- 4. Historial de etapas (solo se añade)
-- ---------------------------------------------------------------------
create table if not exists public.crm_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  origin text not null default 'manual' check (origin in ('manual','sync','import','create','privacy')),
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists crm_stage_history_lead_idx on public.crm_stage_history (lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Privacidad: solicitudes RGPD y lista de no contactar (hash, sin datos en claro)
-- ---------------------------------------------------------------------
create table if not exists public.crm_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  request_type text not null check (request_type in ('access','rectification','erasure','opposition','restriction','portability')),
  status text not null default 'open' check (status in ('open','completed','rejected')),
  details text,
  resolution text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists crm_privacy_lead_idx on public.crm_privacy_requests (lead_id);

create table if not exists public.crm_suppressions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email','phone')),
  value_hash text not null,               -- sha256 del email (minúsculas) o del teléfono (solo dígitos)
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, value_hash)
);

-- ---------------------------------------------------------------------
-- 6. Triggers: updated_at y protección de historiales
-- ---------------------------------------------------------------------
create or replace function public.crm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_crm_leads_touch on public.crm_leads;
create trigger trg_crm_leads_touch before update on public.crm_leads
  for each row execute function public.crm_touch_updated_at();
drop trigger if exists trg_crm_tasks_touch on public.crm_tasks;
create trigger trg_crm_tasks_touch before update on public.crm_tasks
  for each row execute function public.crm_touch_updated_at();

-- Actividades e historial de etapas: no se pueden editar ni borrar.
-- Excepciones: borrado en cascada del lead y anonimización por supresión RGPD (crm_anonymize_lead).
create or replace function public.crm_append_only_guard()
returns trigger language plpgsql as $$
begin
  if current_setting('crm.redact', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.crm_leads where id = old.lead_id) then
      return old; -- el lead ya no existe: borrado en cascada
    end if;
    raise exception 'El historial comercial no se puede borrar. Añade una actividad de corrección.';
  end if;
  raise exception 'El historial comercial no se puede modificar. Añade una actividad de corrección.';
end $$;

drop trigger if exists trg_crm_activities_guard on public.crm_activities;
create trigger trg_crm_activities_guard before update or delete on public.crm_activities
  for each row execute function public.crm_append_only_guard();
drop trigger if exists trg_crm_stage_history_guard on public.crm_stage_history;
create trigger trg_crm_stage_history_guard before update or delete on public.crm_stage_history
  for each row execute function public.crm_append_only_guard();

-- ---------------------------------------------------------------------
-- 7. Seguridad: RLS. Solo el Super Admin puede LEER desde el navegador.
--    Toda escritura pasa por el servidor (service role) tras comprobar el rol.
-- ---------------------------------------------------------------------
alter table public.crm_leads enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_stage_history enable row level security;
alter table public.crm_privacy_requests enable row level security;
alter table public.crm_suppressions enable row level security;

drop policy if exists crm_leads_super_read on public.crm_leads;
create policy crm_leads_super_read on public.crm_leads for select using (public.is_super_admin());
drop policy if exists crm_activities_super_read on public.crm_activities;
create policy crm_activities_super_read on public.crm_activities for select using (public.is_super_admin());
drop policy if exists crm_tasks_super_read on public.crm_tasks;
create policy crm_tasks_super_read on public.crm_tasks for select using (public.is_super_admin());
drop policy if exists crm_stage_history_super_read on public.crm_stage_history;
create policy crm_stage_history_super_read on public.crm_stage_history for select using (public.is_super_admin());
drop policy if exists crm_privacy_super_read on public.crm_privacy_requests;
create policy crm_privacy_super_read on public.crm_privacy_requests for select using (public.is_super_admin());
-- crm_suppressions: sin política de lectura (solo servidor)

revoke all on public.crm_leads, public.crm_activities, public.crm_tasks, public.crm_stage_history,
  public.crm_privacy_requests, public.crm_suppressions from anon;
revoke insert, update, delete, truncate on public.crm_leads, public.crm_activities, public.crm_tasks,
  public.crm_stage_history, public.crm_privacy_requests, public.crm_suppressions from authenticated;
revoke select on public.crm_suppressions from authenticated;
grant all on public.crm_leads, public.crm_activities, public.crm_tasks, public.crm_stage_history,
  public.crm_privacy_requests, public.crm_suppressions to service_role;

-- ---------------------------------------------------------------------
-- 8. Funciones (solo servidor)
-- ---------------------------------------------------------------------

-- Cambio de etapa atómico: actualiza el lead + historial + actividad.
-- NUNCA toca tenants, planes, suscripciones ni pagos.
create or replace function public.crm_change_stage(p_lead uuid, p_stage text, p_admin uuid, p_note text default null, p_origin text default 'manual')
returns public.crm_leads language plpgsql security definer set search_path = public as $$
declare
  l public.crm_leads;
  prev text;
  labels jsonb := '{"new":"Nuevo lead","to_qualify":"Pendiente de cualificar","contacted":"Contactado","interested":"Interesado","demo_requested":"Demo solicitada","demo_done":"Demo realizada","free_signup":"Registro FREE","client_pro":"Cliente PRO","client_business":"Cliente Business","lost":"Perdido","do_not_contact":"No contactar"}';
begin
  if not (labels ? p_stage) then raise exception 'Etapa no válida'; end if;
  select * into l from public.crm_leads where id = p_lead for update;
  if not found then raise exception 'Lead no encontrado'; end if;
  if l.anonymized_at is not null and p_stage <> 'do_not_contact' then
    raise exception 'Lead anonimizado por solicitud de supresión: no se puede reactivar';
  end if;
  if l.stage = p_stage then return l; end if;
  prev := l.stage;

  update public.crm_leads
     set stage = p_stage,
         opted_out = case when p_stage = 'do_not_contact' then true else opted_out end,
         opted_out_at = case when p_stage = 'do_not_contact' and not opted_out then now() else opted_out_at end
   where id = p_lead
   returning * into l;

  insert into public.crm_stage_history (lead_id, from_stage, to_stage, origin, note, changed_by)
  values (p_lead, prev, p_stage, coalesce(p_origin, 'manual'), p_note, p_admin);

  insert into public.crm_activities (lead_id, type, description, created_by, metadata)
  values (p_lead, 'stage_change',
          format('Etapa: %s → %s%s', labels->>prev, labels->>p_stage,
                 case when p_origin = 'sync' then ' (sincronizado con los datos reales de la app)' else '' end
                 || case when coalesce(p_note, '') <> '' then ' · ' || p_note else '' end),
          p_admin, jsonb_build_object('from', prev, 'to', p_stage, 'origin', coalesce(p_origin, 'manual')));
  return l;
end $$;

-- Supresión RGPD: anonimiza el lead y su historial y lo añade a la lista de no contactar.
create or replace function public.crm_anonymize_lead(p_lead uuid, p_admin uuid, p_email_hash text, p_phone_hash text, p_reason text default null)
returns public.crm_leads language plpgsql security definer set search_path = public as $$
declare
  l public.crm_leads;
  prev text;
begin
  select * into l from public.crm_leads where id = p_lead for update;
  if not found then raise exception 'Lead no encontrado'; end if;
  if l.anonymized_at is not null then return l; end if;
  prev := l.stage;

  if p_email_hash is not null then
    insert into public.crm_suppressions (kind, value_hash, reason, created_by)
    values ('email', p_email_hash, 'Supresión RGPD', p_admin) on conflict (kind, value_hash) do nothing;
  end if;
  if p_phone_hash is not null then
    insert into public.crm_suppressions (kind, value_hash, reason, created_by)
    values ('phone', p_phone_hash, 'Supresión RGPD', p_admin) on conflict (kind, value_hash) do nothing;
  end if;

  perform set_config('crm.redact', 'on', true);
  update public.crm_activities
     set description = '[Contenido eliminado por solicitud de supresión]', metadata = '{}'::jsonb
   where lead_id = p_lead;
  update public.crm_stage_history set note = null where lead_id = p_lead;
  perform set_config('crm.redact', 'off', true);

  update public.crm_tasks set title = 'Tarea anonimizada', description = null,
         status = case when status = 'pending' then 'cancelled' else status end,
         cancelled_at = case when status = 'pending' then now() else cancelled_at end
   where lead_id = p_lead;

  update public.crm_leads set
    first_name = null, last_name = null, email = null, phone = null, website = null, address = null,
    business_name = 'Contacto anonimizado', needs = null, notes = null, source_detail = null, data_origin = null,
    consent_source = null, external_source_id = null, ai_summary = null, metadata = '{}'::jsonb,
    linked_user_id = null, linked_tenant_id = null,
    comm_email = false, comm_phone = false, comm_whatsapp = false,
    opted_out = true, opted_out_at = coalesce(opted_out_at, now()),
    stage = 'do_not_contact', anonymized_at = now(), next_contact_at = null
  where id = p_lead returning * into l;

  if prev <> 'do_not_contact' then
    insert into public.crm_stage_history (lead_id, from_stage, to_stage, origin, changed_by)
    values (p_lead, prev, 'do_not_contact', 'privacy', p_admin);
  end if;
  insert into public.crm_activities (lead_id, type, description, created_by)
  values (p_lead, 'privacy', 'Datos anonimizados por solicitud de supresión (RGPD). Contacto bloqueado para futuras importaciones.', p_admin);
  return l;
end $$;

revoke all on function public.crm_change_stage(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_anonymize_lead(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.crm_change_stage(uuid, text, uuid, text, text) to service_role;
grant execute on function public.crm_anonymize_lead(uuid, uuid, text, text, text) to service_role;

-- =====================================================================
-- ROLLBACK (solo si quieres eliminar el CRM por completo; borra los datos del CRM,
-- no toca ninguna otra tabla). Descomenta y ejecuta:
-- drop function if exists public.crm_anonymize_lead(uuid, uuid, text, text, text);
-- drop function if exists public.crm_change_stage(uuid, text, uuid, text, text);
-- drop table if exists public.crm_suppressions, public.crm_privacy_requests, public.crm_stage_history,
--   public.crm_tasks, public.crm_activities, public.crm_leads cascade;
-- drop function if exists public.crm_append_only_guard();
-- drop function if exists public.crm_touch_updated_at();
-- =====================================================================

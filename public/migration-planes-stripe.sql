-- =================================================================================
-- MIGRACIÓN: Planes Free / Pro / Business + Stripe (suscripciones y Connect) + límites
-- =================================================================================
-- Aplica en Supabase → SQL Editor → ejecuta este bloque completo. Es idempotente.
-- Recomendado: ejecutar antes migration-whatsapp-horarios.sql
-- =================================================================================

-- 1) Planes
insert into public.plans (id, name, price, currency, interval, features) values
  ('plan_free', 'Free', 0, 'EUR', 'mes',
   '["1 profesional","Agenda online","Hasta 50 reservas al mes","Perfil público del negocio","Servicios y precios","Gestión básica de clientes","Reservas desde la app"]'),
  ('plan_pro', 'Pro', 19.99, 'EUR', 'mes',
   '["Reservas ilimitadas","Hasta 3 profesionales","Agenda independiente por profesional","Reservas por WhatsApp o chatbot","Recordatorios automáticos por email y WhatsApp","Gestión avanzada de clientes","Historial de reservas","Bloqueo de horarios y vacaciones","Estadísticas de ingresos y reservas","Gestión de cancelaciones"]'),
  ('plan_business', 'Business', 39.99, 'EUR', 'mes',
   '["Todo lo del plan Pro","Hasta 10 profesionales","Gestión de varios trabajadores","Agenda independiente por profesional","Asignación de reservas","Pagos online y depósitos","Informes avanzados","Personalización del perfil"]')
on conflict (id) do update set name = excluded.name, price = excluded.price, features = excluded.features;

-- 2) Columnas de facturación del negocio
alter table public.tenants add column if not exists trial_ends_at timestamptz;
alter table public.tenants add column if not exists subscription_status text;
alter table public.tenants add column if not exists billing_interval text;
alter table public.tenants add column if not exists current_period_end timestamptz;
alter table public.tenants add column if not exists cancel_at_period_end boolean not null default false;
alter table public.tenants add column if not exists stripe_account_id text;
alter table public.tenants add column if not exists stripe_charges_enabled boolean not null default false;
alter table public.tenants add column if not exists stripe_details_submitted boolean not null default false;
alter table public.tenants add column if not exists limit_notified_month text;
alter table public.tenants add column if not exists timezone text not null default 'Europe/Madrid';

-- Los negocios del plan antiguo "Starter" pasan a Free y todos los que no pagan reciben 14 días de Pro
update public.tenants set plan_id = 'plan_free' where plan_id = 'plan_starter' or plan_id is null;
update public.tenants set trial_ends_at = now() + interval '14 days'
 where trial_ends_at is null and coalesce(subscription_status, '') not in ('active', 'trialing', 'past_due');
delete from public.plans where id = 'plan_starter';

-- 3) Pago online por servicio (plan Business): onsite | optional | deposit | full
alter table public.services add column if not exists payment_mode text not null default 'onsite';
alter table public.services add column if not exists deposit_amount numeric(10,2);

-- 4) Pago online de la cita
alter table public.appointments add column if not exists stripe_checkout_session_id text;
alter table public.appointments add column if not exists deposit_paid numeric(10,2);

-- 5) Ajustes de plataforma (secretos de webhook de Stripe) y eventos procesados
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.stripe_events (
  id text primary key,
  type text,
  received_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
alter table public.stripe_events enable row level security;

-- 6) Plan efectivo (suscripción pagada > prueba de 14 días > Free)
create or replace function public.tenant_effective_plan(t public.tenants)
returns text language sql stable as $$
  select case
    when coalesce(t.subscription_status, '') in ('active', 'trialing', 'past_due')
         and t.plan_id in ('plan_pro', 'plan_business') then t.plan_id
    when t.trial_ends_at is not null and t.trial_ends_at > now() then 'plan_pro'
    else 'plan_free'
  end;
$$;

-- 7) Nadie puede cambiarse el plan desde el navegador: solo el servidor (Stripe) o el Super Admin
create or replace function public.protect_tenant_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_super_admin() then
    return new;
  end if;
  new.plan_id := old.plan_id;
  new.mrr := old.mrr;
  new.trial_ends_at := old.trial_ends_at;
  new.subscription_status := old.subscription_status;
  new.billing_interval := old.billing_interval;
  new.current_period_end := old.current_period_end;
  new.cancel_at_period_end := old.cancel_at_period_end;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.stripe_account_id := old.stripe_account_id;
  new.stripe_charges_enabled := old.stripe_charges_enabled;
  new.stripe_details_submitted := old.stripe_details_submitted;
  return new;
end; $$;
drop trigger if exists trg_protect_tenant_billing on public.tenants;
create trigger trg_protect_tenant_billing before update on public.tenants
  for each row execute function public.protect_tenant_billing();

-- 8) Límite de profesionales por plan (Free 1, Pro 3, Business 10)
create or replace function public.enforce_employee_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.tenants;
  lim int;
  cnt int;
begin
  if not new.active then return new; end if;
  if tg_op = 'UPDATE' and old.active then return new; end if;
  select * into t from public.tenants where id = new.tenant_id;
  lim := case public.tenant_effective_plan(t) when 'plan_business' then 10 when 'plan_pro' then 3 else 1 end;
  select count(*) into cnt from public.employees where tenant_id = new.tenant_id and active and id <> new.id;
  if cnt >= lim then
    raise exception 'Tu plan permite hasta % profesional(es). Sube de plan para añadir más.', lim;
  end if;
  return new;
end; $$;
drop trigger if exists trg_employee_limit on public.employees;
create trigger trg_employee_limit before insert or update of active on public.employees
  for each row execute function public.enforce_employee_limit();

-- 9) Límite de 50 reservas al mes en el plan Free (web, WhatsApp y panel)
create or replace function public.enforce_monthly_booking_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.tenants;
  cnt int;
  tz text;
begin
  select * into t from public.tenants where id = new.tenant_id;
  if public.tenant_effective_plan(t) <> 'plan_free' then return new; end if;
  tz := coalesce(t.timezone, 'Europe/Madrid');
  select count(*) into cnt from public.appointments
   where tenant_id = new.tenant_id
     and created_at >= (date_trunc('month', now() at time zone tz) at time zone tz);
  if cnt >= 50 then
    raise exception 'Has alcanzado el límite de 50 reservas este mes del plan Free. Sube a Pro para tener reservas ilimitadas.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_monthly_booking_limit on public.appointments;
create trigger trg_monthly_booking_limit before insert on public.appointments
  for each row execute function public.enforce_monthly_booking_limit();

-- ✅ Listo.

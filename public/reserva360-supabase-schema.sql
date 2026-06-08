-- =================================================================================
-- Reserva360 — Schema Multi-Tenant para Supabase (PostgreSQL)
-- =================================================================================
-- Copia este script completo en el SQL Editor de Supabase y ejecútalo.
-- Crea: tablas, RLS multi-tenant, grants, funciones helper, triggers de auditoría.
-- =================================================================================

-- =================================================================================
-- 1) EXTENSIONES
-- =================================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- =================================================================================
-- 2) TIPOS ENUM
-- =================================================================================
do $$ begin
  create type user_role as enum ('super_admin', 'tenant_admin', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenant_status as enum ('active', 'suspended', 'trial', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'paid', 'refunded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('onsite', 'stripe', 'partial');
exception when duplicate_object then null; end $$;


-- =================================================================================
-- 3) TABLAS PRINCIPALES
-- =================================================================================

-- Planes de suscripción
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  interval text not null default 'mes',
  features jsonb not null default '[]',
  stripe_price_id text,
  created_at timestamptz not null default now()
);

-- Tenants (negocios)
create table if not exists public.tenants (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  industry text,
  logo text,
  color text default '#6366f1',
  email text,
  phone text,
  address text,
  plan_id text references public.plans(id) on delete set null,
  status tenant_status not null default 'active',
  mrr numeric(10,2) not null default 0,
  business_hours jsonb not null default '{}'::jsonb,
  vacations jsonb not null default '[]'::jsonb,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tenants_slug on public.tenants(slug);
create index if not exists idx_tenants_status on public.tenants(status);

-- Perfiles de usuario (vinculado a auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  role user_role not null default 'tenant_admin',
  tenant_id uuid references public.tenants(id) on delete cascade,
  employee_id uuid,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_tenant on public.profiles(tenant_id);

-- Empleados
create table if not exists public.employees (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  specialty text,
  avatar_url text,
  color text default '#6366f1',
  schedule jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employees_tenant on public.employees(tenant_id);

-- FK diferida: profiles.employee_id → employees.id
alter table public.profiles
  drop constraint if exists profiles_employee_fk;
alter table public.profiles
  add constraint profiles_employee_fk
  foreign key (employee_id) references public.employees(id) on delete set null;

-- Servicios
create table if not exists public.services (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null default 60,
  price numeric(10,2) not null default 0,
  color text default '#6366f1',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_services_tenant on public.services(tenant_id);

-- Clientes
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_tenant on public.clients(tenant_id);
create index if not exists idx_clients_email on public.clients(tenant_id, email);

-- Reservas / citas
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status appointment_status not null default 'pending',
  notes text,
  source text default 'admin', -- 'online' | 'admin' | 'employee'
  payment_status payment_status not null default 'pending',
  payment_amount numeric(10,2),
  payment_method payment_method default 'onsite',
  stripe_payment_intent_id text,
  payment_date timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_appointments_tenant_start on public.appointments(tenant_id, start_at);
create index if not exists idx_appointments_employee_start on public.appointments(employee_id, start_at);
create index if not exists idx_appointments_client on public.appointments(client_id);
create index if not exists idx_appointments_reminder_24h on public.appointments(start_at) where reminder_24h_sent_at is null and status in ('pending','confirmed');

-- Log de actividad / auditoría
create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_tenant on public.activity_log(tenant_id, created_at desc);


-- =================================================================================
-- 4) TRIGGER updated_at
-- =================================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$ declare t text;
begin
  for t in select unnest(array['tenants','profiles','employees','services','clients','appointments']) loop
    execute format('drop trigger if exists trg_%s_updated on public.%s;', t, t);
    execute format('create trigger trg_%s_updated before update on public.%s for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;


-- =================================================================================
-- 5) FUNCIONES HELPER (claim de JWT)
-- =================================================================================

-- Devuelve el tenant_id del usuario autenticado
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- Devuelve el rol del usuario autenticado
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ¿Es super admin?
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- ¿Es tenant admin del tenant indicado?
create or replace function public.is_tenant_admin(t_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'tenant_admin' and tenant_id = t_id from public.profiles where id = auth.uid()), false);
$$;

-- ¿Es empleado del tenant indicado?
create or replace function public.is_employee_of(t_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select tenant_id = t_id from public.profiles where id = auth.uid()), false);
$$;

-- ID del empleado vinculado al usuario actual
create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select employee_id from public.profiles where id = auth.uid();
$$;


-- =================================================================================
-- 6) ROW LEVEL SECURITY — Activación
-- =================================================================================
alter table public.tenants       enable row level security;
alter table public.profiles      enable row level security;
alter table public.employees     enable row level security;
alter table public.services      enable row level security;
alter table public.clients       enable row level security;
alter table public.appointments  enable row level security;
alter table public.activity_log  enable row level security;
alter table public.plans         enable row level security;


-- =================================================================================
-- 7) POLÍTICAS RLS — TENANTS
-- =================================================================================
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select
  using (
    public.is_super_admin()
    or id = public.current_tenant_id()
  );

drop policy if exists tenants_super_insert on public.tenants;
create policy tenants_super_insert on public.tenants for insert
  with check (public.is_super_admin());

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants for update
  using (public.is_super_admin() or public.is_tenant_admin(id))
  with check (public.is_super_admin() or public.is_tenant_admin(id));

drop policy if exists tenants_super_delete on public.tenants;
create policy tenants_super_delete on public.tenants for delete
  using (public.is_super_admin());


-- =================================================================================
-- 8) POLÍTICAS RLS — PROFILES
-- =================================================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or tenant_id = public.current_tenant_id()
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid() or public.is_super_admin() or public.is_tenant_admin(tenant_id))
  with check (id = auth.uid() or public.is_super_admin() or public.is_tenant_admin(tenant_id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert
  with check (id = auth.uid());


-- =================================================================================
-- 9) POLÍTICAS RLS — EMPLOYEES, SERVICES, CLIENTS
-- =================================================================================
-- Función helper para reutilizar
create or replace function public.can_manage_tenant(t_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.is_tenant_admin(t_id);
$$;

-- EMPLOYEES
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

drop policy if exists employees_modify on public.employees;
create policy employees_modify on public.employees for all
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

-- SERVICES
drop policy if exists services_select on public.services;
create policy services_select on public.services for select
  using (true); -- públicos para el booking online

drop policy if exists services_modify on public.services;
create policy services_modify on public.services for all
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

-- CLIENTS
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

drop policy if exists clients_modify on public.clients;
create policy clients_modify on public.clients for all
  using (public.can_manage_tenant(tenant_id) or tenant_id = public.current_tenant_id())
  with check (public.can_manage_tenant(tenant_id) or tenant_id = public.current_tenant_id());


-- =================================================================================
-- 10) POLÍTICAS RLS — APPOINTMENTS
-- =================================================================================
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select
  using (
    public.is_super_admin()
    or (
      tenant_id = public.current_tenant_id()
      and (
        public.current_role() in ('tenant_admin')
        or employee_id = public.current_employee_id()
      )
    )
  );

drop policy if exists appointments_modify on public.appointments;
create policy appointments_modify on public.appointments for all
  using (
    public.is_super_admin()
    or public.is_tenant_admin(tenant_id)
    or (tenant_id = public.current_tenant_id() and employee_id = public.current_employee_id())
  )
  with check (
    public.is_super_admin()
    or public.is_tenant_admin(tenant_id)
    or (tenant_id = public.current_tenant_id() and employee_id = public.current_employee_id())
  );


-- =================================================================================
-- 11) POLÍTICAS RLS — ACTIVITY LOG, PLANS
-- =================================================================================
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

drop policy if exists activity_insert on public.activity_log;
create policy activity_insert on public.activity_log for insert
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists plans_public on public.plans;
create policy plans_public on public.plans for select using (true);

drop policy if exists plans_super on public.plans;
create policy plans_super on public.plans for all
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- =================================================================================
-- 12) GRANTS (Supabase ahora exige permisos explícitos en algunos schemas)
-- =================================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select on public.plans          to anon, authenticated;
grant select on public.tenants        to anon, authenticated;
grant select on public.services       to anon, authenticated;
grant select on public.employees      to anon, authenticated;

grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update, delete on public.tenants       to authenticated;
grant select, insert, update, delete on public.employees     to authenticated;
grant select, insert, update, delete on public.services      to authenticated;
grant select, insert, update, delete on public.clients       to authenticated;
grant select, insert, update, delete on public.appointments  to authenticated;
grant select, insert on public.activity_log to authenticated;

-- service_role bypass RLS automáticamente, pero damos grants explícitos
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Permitir a anon (booking online sin login) CREAR appointments y clientes
-- con verificaciones en funciones RPC (más seguro que dar INSERT directo).
-- Ver función public.create_public_booking abajo.

grant execute on all functions in schema public to anon, authenticated, service_role;


-- =================================================================================
-- 13) FUNCIÓN RPC PÚBLICA — Crear reserva online (sin login)
-- =================================================================================
-- Esta función permite a un cliente final (sin auth) crear una reserva,
-- pero con validación server-side: respeta horarios + evita solapamientos.
create or replace function public.create_public_booking(
  p_tenant_slug text,
  p_service_id uuid,
  p_employee_id uuid,
  p_start timestamptz,
  p_client_first_name text,
  p_client_last_name text,
  p_client_email text,
  p_client_phone text,
  p_client_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_duration int;
  v_end timestamptz;
  v_client_id uuid;
  v_appointment_id uuid;
  v_overlap boolean;
  v_tenant_active boolean;
begin
  -- Validar tenant
  select id, status = 'active'
    into v_tenant_id, v_tenant_active
  from public.tenants where slug = p_tenant_slug;

  if v_tenant_id is null then raise exception 'Negocio no encontrado'; end if;
  if not v_tenant_active then raise exception 'Negocio no activo'; end if;

  -- Validar servicio y obtener duración
  select duration_minutes into v_duration
    from public.services
   where id = p_service_id and tenant_id = v_tenant_id and active = true;
  if v_duration is null then raise exception 'Servicio no disponible'; end if;

  v_end := p_start + (v_duration || ' minutes')::interval;

  -- Validar empleado pertenece al tenant
  if not exists (
    select 1 from public.employees
    where id = p_employee_id and tenant_id = v_tenant_id and active = true
  ) then
    raise exception 'Empleado no disponible';
  end if;

  -- Comprobar solapamientos
  select exists(
    select 1 from public.appointments
    where tenant_id = v_tenant_id
      and employee_id = p_employee_id
      and status <> 'cancelled'
      and start_at < v_end
      and end_at   > p_start
  ) into v_overlap;
  if v_overlap then raise exception 'Horario no disponible'; end if;

  -- Buscar o crear cliente (por email + tenant)
  if p_client_email is not null and p_client_email <> '' then
    select id into v_client_id
      from public.clients
     where tenant_id = v_tenant_id and lower(email) = lower(p_client_email)
     limit 1;
  end if;

  if v_client_id is null then
    insert into public.clients (tenant_id, first_name, last_name, email, phone, notes)
    values (v_tenant_id, p_client_first_name, p_client_last_name, p_client_email, p_client_phone, p_client_notes)
    returning id into v_client_id;
  end if;

  -- Crear reserva
  insert into public.appointments (
    tenant_id, employee_id, client_id, service_id, start_at, end_at,
    status, notes, source, payment_status, payment_method
  ) values (
    v_tenant_id, p_employee_id, v_client_id, p_service_id, p_start, v_end,
    'confirmed', p_client_notes, 'online', 'pending', 'onsite'
  ) returning id into v_appointment_id;

  return v_appointment_id;
end; $$;

-- Permitir invocación desde anon (clientes sin login)
grant execute on function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, text, text, text, text
) to anon, authenticated;


-- =================================================================================
-- 14) FUNCIÓN RPC PÚBLICA — Listar servicios y empleados de un tenant por slug
-- =================================================================================
create or replace function public.get_public_tenant(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  select to_jsonb(t.*) into v from public.tenants t where slug = p_slug and status = 'active';
  if v is null then return null; end if;

  v := v || jsonb_build_object(
    'services', coalesce((select jsonb_agg(to_jsonb(s)) from public.services s
                          where s.tenant_id = (v->>'id')::uuid and s.active = true), '[]'::jsonb),
    'employees', coalesce((select jsonb_agg(to_jsonb(e)) from public.employees e
                           where e.tenant_id = (v->>'id')::uuid and e.active = true), '[]'::jsonb)
  );
  return v;
end; $$;

grant execute on function public.get_public_tenant(text) to anon, authenticated;


-- =================================================================================
-- 15) FUNCIÓN: crear perfil al registrarse (trigger sobre auth.users)
-- =================================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'tenant_admin')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =================================================================================
-- 16) DATOS INICIALES — Planes
-- =================================================================================
insert into public.plans (id, name, price, currency, interval, features) values
  ('plan_starter',  'Starter',  19,  'EUR', 'mes', '["1 empleado","100 reservas/mes","Recordatorios email"]'),
  ('plan_pro',      'Pro',      49,  'EUR', 'mes', '["10 empleados","Reservas ilimitadas","WhatsApp + SMS","Pagos online"]'),
  ('plan_business', 'Business', 99,  'EUR', 'mes', '["Empleados ilimitados","Multi-sede","API + Integraciones","Soporte prioritario"]')
on conflict (id) do nothing;


-- =================================================================================
-- 17) (Opcional) Promover un usuario a Super Admin
-- =================================================================================
-- Tras registrarte con tu email, ejecuta UNA VEZ esto para hacerte super admin:
--
-- update public.profiles
--    set role = 'super_admin', tenant_id = null
--  where email = 'tu-email@dominio.com';

-- =================================================================================
-- ✅ FIN. Multi-tenant aislado por RLS. Booking público vía RPC. Listo para producción.
-- =================================================================================

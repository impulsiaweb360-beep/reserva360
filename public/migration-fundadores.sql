-- ============================================================
-- Reserva360 · PROGRAMA DE USUARIOS FUNDADORES
-- Ejecutar en Supabase → SQL Editor → Run. Se puede ejecutar varias veces (idempotente).
--
-- Reglas:
--   · 30 % de descuento durante 3 ciclos de facturación PAGADOS (planes Pro y Business).
--     En pago anual: 30 % en el primer año (cuenta como los 3 ciclos).
--   · Elegibilidad calculada con datos reales y CONGELADA en la fecha oficial de lanzamiento.
--   · UN NEGOCIO = UN ÚNICO BENEFICIO (restricción UNIQUE por tenant_id + triggers que impiden reiniciarlo).
--   · Si cancela durante la promoción, pierde el descuento (no se recupera al volver).
--   · Toda escritura se hace desde el servidor (service_role). El navegador solo puede leer.
-- ============================================================

-- 1) Configuración del programa (fila única)
create table if not exists public.founder_program (
  id boolean primary key default true check (id),
  launch_at timestamptz,                                   -- fecha y hora oficial de lanzamiento
  status text not null default 'active' check (status in ('active', 'closed')),
  new_eligibility_enabled boolean not null default true,   -- permitir nuevas elegibilidades
  discount_percent numeric not null default 30 check (discount_percent > 0 and discount_percent <= 100),
  total_cycles int not null default 3 check (total_cycles > 0),
  frozen_at timestamptz,                                   -- momento en que se congeló la elegibilidad
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.founder_program (id) values (true) on conflict (id) do nothing;

-- 2) Elegibilidad + beneficio por negocio (UNO por negocio, para siempre)
create table if not exists public.founder_benefits (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  eligibility_status text not null default 'pending' check (eligibility_status in ('pending', 'eligible', 'not_eligible')),
  requirements jsonb,
  evaluated_at timestamptz,
  frozen boolean not null default false,
  eligibility_override boolean not null default false,     -- true si un super admin corrigió la elegibilidad
  benefit_status text not null default 'none' check (benefit_status in ('none', 'reserved', 'active', 'finished', 'cancelled', 'revoked')),
  reserved_at timestamptz,
  reserved_session_id text,
  activated_at timestamptz,
  initial_plan_id text,
  current_plan_id text,
  billing_interval text,
  discount_percent numeric not null default 30,
  total_cycles int not null default 3,
  cycles_used int not null default 0,
  ended_at timestamptz,
  end_reason text,
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_coupon_id text,
  discount_removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_benefits_tenant_unique unique (tenant_id),
  constraint founder_cycles_range check (cycles_used >= 0 and cycles_used <= total_cycles)
);
create index if not exists idx_founder_benefits_status on public.founder_benefits(benefit_status, eligibility_status);

-- 3) Ciclos pagados contabilizados (una fila por factura de Stripe → idempotencia)
create table if not exists public.founder_benefit_cycles (
  id uuid primary key default uuid_generate_v4(),
  benefit_id uuid not null references public.founder_benefits(id) on delete cascade,
  tenant_id uuid not null,
  stripe_invoice_id text not null,
  stripe_subscription_id text,
  amount_paid numeric not null,
  billing_reason text,
  billing_interval text,
  cycles_counted int not null,
  created_at timestamptz not null default now(),
  constraint founder_cycles_invoice_unique unique (stripe_invoice_id)
);
create index if not exists idx_founder_cycles_benefit on public.founder_benefit_cycles(benefit_id, created_at);

-- 4) Protecciones: un beneficio consumido NUNCA se reinicia ni se duplica
create or replace function public.founder_benefits_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- Solo se permite borrar si el propio negocio se ha borrado (cascada)
    if old.activated_at is not null and exists (select 1 from public.tenants where id = old.tenant_id) then
      raise exception 'No se puede borrar un beneficio fundador ya utilizado';
    end if;
    return old;
  end if;
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'El beneficio fundador pertenece a un único negocio';
  end if;
  if old.activated_at is not null and new.activated_at is distinct from old.activated_at then
    raise exception 'El beneficio fundador de este negocio ya fue activado y no puede reiniciarse';
  end if;
  if old.benefit_status in ('active', 'finished', 'cancelled', 'revoked') and new.benefit_status in ('none', 'reserved') then
    raise exception 'Este negocio ya utilizó su beneficio fundador';
  end if;
  if old.benefit_status in ('finished', 'cancelled', 'revoked') and new.benefit_status = 'active' then
    raise exception 'Este negocio ya utilizó su beneficio fundador';
  end if;
  if new.cycles_used < old.cycles_used then
    raise exception 'Los ciclos consumidos no pueden disminuir';
  end if;
  if new.total_cycles <> old.total_cycles or new.discount_percent <> old.discount_percent then
    if old.activated_at is not null then raise exception 'No se pueden cambiar las condiciones de un beneficio activado'; end if;
  end if;
  if old.frozen and new.eligibility_status <> old.eligibility_status
     and coalesce(current_setting('r360.founder_admin', true), '') <> 'on' then
    raise exception 'La elegibilidad está congelada desde el lanzamiento';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_founder_benefits_guard on public.founder_benefits;
create trigger trg_founder_benefits_guard before update or delete on public.founder_benefits
  for each row execute function public.founder_benefits_guard();

-- 5) Seguridad (RLS): lectura para el propio negocio y super admin; escritura solo servidor
alter table public.founder_program enable row level security;
alter table public.founder_benefits enable row level security;
alter table public.founder_benefit_cycles enable row level security;

drop policy if exists founder_program_select on public.founder_program;
create policy founder_program_select on public.founder_program for select to authenticated using (true);

drop policy if exists founder_benefits_select on public.founder_benefits;
create policy founder_benefits_select on public.founder_benefits for select to authenticated
  using (public.is_super_admin() or public.is_tenant_admin(tenant_id));

drop policy if exists founder_cycles_select on public.founder_benefit_cycles;
create policy founder_cycles_select on public.founder_benefit_cycles for select to authenticated
  using (public.is_super_admin() or public.is_tenant_admin(tenant_id));

revoke all on public.founder_program, public.founder_benefits, public.founder_benefit_cycles from anon, authenticated;
grant select on public.founder_program, public.founder_benefits, public.founder_benefit_cycles to authenticated;
grant all on public.founder_program, public.founder_benefits, public.founder_benefit_cycles to service_role;

-- 6) Auditoría (reutiliza activity_log)
create or replace function public.founder_audit(p_tenant uuid, p_user uuid, p_action text, p_benefit uuid, p_meta jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.activity_log (tenant_id, user_id, action, entity, entity_id, metadata)
  values (p_tenant, p_user, p_action, 'founder_benefit', p_benefit, coalesce(p_meta, '{}'::jsonb));
$$;

-- 7) Requisitos con datos REALES. p_cutoff: solo cuenta servicios/profesionales creados antes de esa fecha
create or replace function public.founder_requirements(p_tenant uuid, p_cutoff timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t public.tenants;
  v_launch timestamptz;
  v_cut timestamptz;
  r_account boolean; r_owner boolean; r_data boolean; r_services boolean; r_hours boolean; r_staff boolean;
begin
  select * into t from public.tenants where id = p_tenant;
  if not found then return null; end if;
  select launch_at into v_launch from public.founder_program where id;
  v_cut := coalesce(p_cutoff, 'infinity'::timestamptz);
  r_account := v_launch is null or t.created_at < v_launch;
  r_owner := exists (select 1 from public.profiles p where p.tenant_id = t.id and p.role = 'tenant_admin');
  r_data := coalesce(btrim(t.name), '') <> '' and coalesce(btrim(t.phone), '') <> '' and coalesce(btrim(t.address), '') <> '';
  r_services := exists (select 1 from public.services s where s.tenant_id = t.id and s.active and s.created_at < v_cut);
  r_hours := exists (
    select 1 from jsonb_each(case when jsonb_typeof(t.business_hours) = 'object' then t.business_hours else '{}'::jsonb end) d
    where jsonb_typeof(d.value) = 'object'
      and coalesce(d.value->>'enabled', 'false') = 'true'
      and coalesce(d.value->>'from', '') <> '' and coalesce(d.value->>'to', '') <> ''
      and (d.value->>'from') < (d.value->>'to'));
  r_staff := exists (select 1 from public.employees e where e.tenant_id = t.id and e.active and e.created_at < v_cut);
  return jsonb_build_object(
    'account_before_launch', r_account,
    'has_owner', r_owner,
    'business_data', r_data,
    'services', r_services,
    'business_hours', r_hours,
    'availability', r_staff,
    'all', r_account and r_owner and r_data and r_services and r_hours and r_staff
  );
end $$;

-- 8) Congelar la elegibilidad en el lanzamiento (una sola vez, con bloqueo)
create or replace function public.founder_freeze()
returns int language plpgsql security definer set search_path = public as $$
declare
  p public.founder_program;
  t record;
  req jsonb;
  prev public.founder_benefits;
  v_elig text;
  n int := 0;
begin
  select * into p from public.founder_program where id for update;
  if p.launch_at is null or now() < p.launch_at or p.frozen_at is not null then return 0; end if;
  for t in select id, created_at from public.tenants where created_at < p.launch_at loop
    req := public.founder_requirements(t.id, p.launch_at);
    select * into prev from public.founder_benefits where tenant_id = t.id;
    if found and prev.frozen then continue; end if;
    v_elig := case
      when coalesce((req->>'all')::boolean, false) and p.status = 'active'
           and (p.new_eligibility_enabled or prev.eligibility_status = 'eligible') then 'eligible'
      else 'not_eligible' end;
    insert into public.founder_benefits (tenant_id, owner_user_id, eligibility_status, requirements, evaluated_at, frozen,
                                         discount_percent, total_cycles)
    values (t.id,
            (select id from public.profiles where tenant_id = t.id and role = 'tenant_admin' order by created_at limit 1),
            v_elig, req, now(), true, p.discount_percent, p.total_cycles)
    on conflict (tenant_id) do update
      set eligibility_status = excluded.eligibility_status, requirements = excluded.requirements,
          evaluated_at = excluded.evaluated_at, frozen = true,
          owner_user_id = coalesce(excluded.owner_user_id, public.founder_benefits.owner_user_id);
    perform public.founder_audit(t.id, null, 'founder.frozen', (select id from public.founder_benefits where tenant_id = t.id),
                                 jsonb_build_object('eligibility', v_elig, 'requirements', req));
    n := n + 1;
  end loop;
  update public.founder_program set frozen_at = now(), updated_at = now() where id;
  return n;
end $$;

-- 9) Evaluar un negocio (antes del lanzamiento: estado provisional; después: congelado)
create or replace function public.founder_evaluate(p_tenant uuid)
returns public.founder_benefits language plpgsql security definer set search_path = public as $$
declare
  p public.founder_program;
  t public.tenants;
  req jsonb;
  prev public.founder_benefits;
  v_elig text;
  v_frozen boolean := false;
  v_has boolean;
  r public.founder_benefits;
begin
  perform public.founder_freeze();
  select * into p from public.founder_program where id;
  select * into t from public.tenants where id = p_tenant;
  if not found then return null; end if;
  select * into prev from public.founder_benefits where tenant_id = p_tenant;
  v_has := found;
  if v_has and prev.frozen then return prev; end if;

  if p.launch_at is not null and now() >= p.launch_at then
    -- Negocio registrado después del lanzamiento (o sin evaluar): nunca elegible
    req := public.founder_requirements(p_tenant, p.launch_at);
    v_elig := 'not_eligible';
    v_frozen := true;
  else
    req := public.founder_requirements(p_tenant, null);
    v_elig := case
      when p.status <> 'active' then (case when prev.eligibility_status = 'eligible' and coalesce((req->>'all')::boolean, false) then 'eligible' else 'not_eligible' end)
      when coalesce((req->>'all')::boolean, false) and (p.new_eligibility_enabled or prev.eligibility_status = 'eligible') then 'eligible'
      else 'pending' end;
    -- Una corrección manual del super admin se respeta hasta el lanzamiento
    if v_has and prev.eligibility_override then v_elig := prev.eligibility_status; end if;
  end if;

  insert into public.founder_benefits (tenant_id, owner_user_id, eligibility_status, requirements, evaluated_at, frozen,
                                       discount_percent, total_cycles)
  values (p_tenant,
          (select id from public.profiles where tenant_id = p_tenant and role = 'tenant_admin' order by created_at limit 1),
          v_elig, req, now(), v_frozen, p.discount_percent, p.total_cycles)
  on conflict (tenant_id) do update
    set eligibility_status = excluded.eligibility_status, requirements = excluded.requirements,
        evaluated_at = excluded.evaluated_at, frozen = excluded.frozen,
        owner_user_id = coalesce(excluded.owner_user_id, public.founder_benefits.owner_user_id)
  returning * into r;
  return r;
end $$;

-- 9b) Evaluar todos los negocios (panel super admin y tarea programada)
create or replace function public.founder_evaluate_all()
returns setof public.founder_benefits language plpgsql security definer set search_path = public as $$
declare t record;
begin
  perform public.founder_freeze();
  for t in select id from public.tenants order by created_at loop
    return next public.founder_evaluate(t.id);
  end loop;
end $$;

-- 10) Reservar el beneficio al iniciar el primer pago (bloqueo de fila → solo una solicitud gana)
create or replace function public.founder_claim(p_tenant uuid, p_ttl_minutes int default 40)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.founder_program;
  b public.founder_benefits;
begin
  perform public.founder_evaluate(p_tenant);
  select * into p from public.founder_program where id;
  select * into b from public.founder_benefits where tenant_id = p_tenant for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_eligible'); end if;
  if b.benefit_status in ('active', 'finished', 'cancelled', 'revoked') or b.activated_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if b.benefit_status = 'reserved' and b.reserved_at > now() - make_interval(mins => p_ttl_minutes) then
    return jsonb_build_object('ok', false, 'reason', 'in_progress', 'session_id', b.reserved_session_id);
  end if;
  if p.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'program_closed'); end if;
  if p.launch_at is null or now() < p.launch_at then return jsonb_build_object('ok', false, 'reason', 'not_launched'); end if;
  if b.eligibility_status <> 'eligible' then return jsonb_build_object('ok', false, 'reason', 'not_eligible'); end if;
  update public.founder_benefits
     set benefit_status = 'reserved', reserved_at = now(), reserved_session_id = null
   where id = b.id;
  perform public.founder_audit(p_tenant, null, 'founder.reserved', b.id, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'benefit_id', b.id, 'discount_percent', b.discount_percent, 'total_cycles', b.total_cycles);
end $$;

create or replace function public.founder_set_session(p_tenant uuid, p_session text)
returns void language sql security definer set search_path = public as $$
  update public.founder_benefits set reserved_session_id = p_session
   where tenant_id = p_tenant and benefit_status = 'reserved';
$$;

-- Libera la reserva si el pago no se completó (sesión caducada o error)
create or replace function public.founder_release(p_tenant uuid, p_session text)
returns boolean language plpgsql security definer set search_path = public as $$
declare b public.founder_benefits;
begin
  select * into b from public.founder_benefits where tenant_id = p_tenant for update;
  if not found or b.benefit_status <> 'reserved' then return false; end if;
  if p_session is not null and b.reserved_session_id is not null and b.reserved_session_id <> p_session then return false; end if;
  update public.founder_benefits set benefit_status = 'none', reserved_at = null, reserved_session_id = null where id = b.id;
  perform public.founder_audit(p_tenant, null, 'founder.released', b.id, jsonb_build_object('session', p_session));
  return true;
end $$;

-- 11) Activar (idempotente): solo si estaba reservado. Devuelve 'activated' | 'already' | 'rejected'
create or replace function public.founder_activate(p_tenant uuid, p_sub text, p_customer text, p_plan text, p_interval text, p_coupon text)
returns text language plpgsql security definer set search_path = public as $$
declare b public.founder_benefits;
begin
  select * into b from public.founder_benefits where tenant_id = p_tenant for update;
  if not found then return 'rejected'; end if;
  if b.benefit_status in ('active', 'finished') and b.stripe_subscription_id = p_sub then return 'already'; end if;
  if b.benefit_status <> 'reserved' or b.activated_at is not null then return 'rejected'; end if;
  update public.founder_benefits
     set benefit_status = 'active', activated_at = now(), initial_plan_id = p_plan, current_plan_id = p_plan,
         billing_interval = p_interval, stripe_subscription_id = p_sub, stripe_customer_id = p_customer,
         stripe_coupon_id = p_coupon, reserved_session_id = null
   where id = b.id;
  perform public.founder_audit(p_tenant, null, 'founder.activated', b.id,
    jsonb_build_object('plan', p_plan, 'interval', p_interval, 'subscription', p_sub, 'discount_percent', b.discount_percent, 'total_cycles', b.total_cycles));
  return 'activated';
end $$;

-- 12) Contabilizar un ciclo PAGADO (idempotente por factura)
--     Mensual: cuenta 1 por factura de alta o renovación cobrada (>0 €). Los prorrateos no cuentan.
--     Anual: el primer pago anual cobrado consume los ciclos restantes (30 % solo el primer año).
create or replace function public.founder_register_paid_invoice(
  p_tenant uuid, p_sub text, p_invoice text, p_amount numeric, p_reason text, p_interval text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.founder_benefits;
  n int;
  v_used int;
  v_finished boolean := false;
begin
  select * into b from public.founder_benefits where tenant_id = p_tenant for update;
  if not found or b.benefit_status <> 'active' or b.stripe_subscription_id is distinct from p_sub then
    return jsonb_build_object('counted', false, 'reason', 'not_active');
  end if;
  if coalesce(p_amount, 0) <= 0 then return jsonb_build_object('counted', false, 'reason', 'zero_amount'); end if;
  if p_interval = 'year' then
    n := b.total_cycles - b.cycles_used;
  elsif p_reason in ('subscription_create', 'subscription_cycle') then
    n := 1;
  else
    return jsonb_build_object('counted', false, 'reason', 'not_a_cycle');
  end if;
  if n <= 0 then return jsonb_build_object('counted', false, 'reason', 'no_cycles_left'); end if;

  insert into public.founder_benefit_cycles (benefit_id, tenant_id, stripe_invoice_id, stripe_subscription_id, amount_paid, billing_reason, billing_interval, cycles_counted)
  values (b.id, p_tenant, p_invoice, p_sub, p_amount, p_reason, p_interval, n)
  on conflict (stripe_invoice_id) do nothing;
  if not found then return jsonb_build_object('counted', false, 'reason', 'duplicate'); end if;

  v_used := least(b.total_cycles, b.cycles_used + n);
  v_finished := v_used >= b.total_cycles;
  update public.founder_benefits
     set cycles_used = v_used,
         billing_interval = coalesce(p_interval, billing_interval),
         benefit_status = case when v_finished then 'finished' else benefit_status end,
         ended_at = case when v_finished then now() else ended_at end,
         end_reason = case when v_finished then 'completed' else end_reason end
   where id = b.id;
  perform public.founder_audit(p_tenant, null, 'founder.cycle_paid', b.id,
    jsonb_build_object('invoice', p_invoice, 'amount', p_amount, 'reason', p_reason, 'interval', p_interval, 'cycles_used', v_used, 'finished', v_finished));
  return jsonb_build_object('counted', true, 'cycles_used', v_used, 'finished', v_finished);
end $$;

-- 13) Cambio de plan (Pro ⇄ Business) durante la promoción: se mantiene el contador
create or replace function public.founder_plan_changed(p_tenant uuid, p_sub text, p_plan text, p_interval text)
returns boolean language plpgsql security definer set search_path = public as $$
declare b public.founder_benefits;
begin
  select * into b from public.founder_benefits where tenant_id = p_tenant for update;
  if not found or b.benefit_status <> 'active' or b.stripe_subscription_id is distinct from p_sub then return false; end if;
  if b.current_plan_id is not distinct from p_plan and b.billing_interval is not distinct from p_interval then return false; end if;
  update public.founder_benefits set current_plan_id = p_plan, billing_interval = p_interval where id = b.id;
  perform public.founder_audit(p_tenant, null, 'founder.plan_changed', b.id,
    jsonb_build_object('from_plan', b.current_plan_id, 'to_plan', p_plan, 'from_interval', b.billing_interval, 'to_interval', p_interval, 'cycles_used', b.cycles_used));
  return true;
end $$;

-- 14) Cancelación durante la promoción: se pierde el descuento (historial conservado)
create or replace function public.founder_subscription_ended(p_tenant uuid, p_sub text)
returns boolean language plpgsql security definer set search_path = public as $$
declare b public.founder_benefits;
begin
  select * into b from public.founder_benefits where tenant_id = p_tenant for update;
  if not found or b.benefit_status <> 'active' or b.stripe_subscription_id is distinct from p_sub then return false; end if;
  update public.founder_benefits set benefit_status = 'cancelled', ended_at = now(), end_reason = 'subscription_cancelled' where id = b.id;
  perform public.founder_audit(p_tenant, null, 'founder.cancelled', b.id, jsonb_build_object('subscription', p_sub, 'cycles_used', b.cycles_used));
  return true;
end $$;

create or replace function public.founder_mark_discount_removed(p_tenant uuid)
returns void language sql security definer set search_path = public as $$
  update public.founder_benefits set discount_removed_at = coalesce(discount_removed_at, now()) where tenant_id = p_tenant;
$$;

-- 15) Correcciones del super admin (siempre auditadas; nunca pueden conceder un segundo beneficio)
create or replace function public.founder_admin_action(p_tenant uuid, p_admin uuid, p_action text, p_reason text)
returns public.founder_benefits language plpgsql security definer set search_path = public as $$
declare
  b public.founder_benefits;
  r public.founder_benefits;
begin
  if not exists (select 1 from public.profiles where id = p_admin and role = 'super_admin') then
    raise exception 'Solo un super admin puede hacer correcciones';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Indica el motivo de la corrección'; end if;
  perform public.founder_evaluate(p_tenant);
  select * into b from public.founder_benefits where tenant_id = p_tenant for update;
  if not found then raise exception 'Negocio no encontrado'; end if;
  perform set_config('r360.founder_admin', 'on', true);

  if p_action in ('set_eligible', 'set_not_eligible') then
    if b.activated_at is not null or b.benefit_status <> 'none' then
      perform public.founder_audit(p_tenant, p_admin, 'founder.admin_blocked', b.id,
        jsonb_build_object('action', p_action, 'reason', p_reason, 'benefit_status', b.benefit_status));
      raise exception 'Este negocio ya utilizó (o está usando) su beneficio fundador: no se puede conceder otro';
    end if;
    update public.founder_benefits
       set eligibility_status = case when p_action = 'set_eligible' then 'eligible' else 'not_eligible' end,
           eligibility_override = true, evaluated_at = now()
     where id = b.id returning * into r;
  elsif p_action = 'revoke' then
    if b.benefit_status not in ('active', 'reserved') then raise exception 'No hay un descuento activo que revocar'; end if;
    if b.benefit_status = 'reserved' then
      update public.founder_benefits set benefit_status = 'none', reserved_at = null, reserved_session_id = null,
             eligibility_status = 'not_eligible', eligibility_override = true where id = b.id returning * into r;
    else
      update public.founder_benefits set benefit_status = 'revoked', ended_at = now(), end_reason = 'revoked_by_admin'
       where id = b.id returning * into r;
    end if;
  else
    raise exception 'Acción no válida';
  end if;
  perform public.founder_audit(p_tenant, p_admin, 'founder.admin_' || p_action, b.id,
    jsonb_build_object('reason', p_reason, 'before', jsonb_build_object('eligibility', b.eligibility_status, 'benefit', b.benefit_status),
                       'after', jsonb_build_object('eligibility', r.eligibility_status, 'benefit', r.benefit_status)));
  return r;
end $$;

-- 16) Solo el servidor puede ejecutar estas funciones
do $$
declare f text;
begin
  foreach f in array array[
    'founder_audit(uuid,uuid,text,uuid,jsonb)', 'founder_requirements(uuid,timestamptz)', 'founder_freeze()',
    'founder_evaluate(uuid)', 'founder_evaluate_all()', 'founder_claim(uuid,int)', 'founder_set_session(uuid,text)', 'founder_release(uuid,text)',
    'founder_activate(uuid,text,text,text,text,text)', 'founder_register_paid_invoice(uuid,text,text,numeric,text,text)',
    'founder_plan_changed(uuid,text,text,text)', 'founder_subscription_ended(uuid,text)', 'founder_mark_discount_removed(uuid)',
    'founder_admin_action(uuid,uuid,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- 17) El modo lanzamiento (Pro gratis) se cierra solo en la fecha oficial de lanzamiento
create or replace function public.tenant_effective_plan(t public.tenants)
returns text language sql stable security definer set search_path = public as $$
  select case
    when coalesce(t.subscription_status, '') in ('active', 'trialing', 'past_due')
         and t.plan_id in ('plan_pro', 'plan_business') then t.plan_id
    when coalesce((select value::text from public.platform_settings where key = 'launch_free_mode'), 'false') = 'true'
         and coalesce((select now() < launch_at from public.founder_program where id and launch_at is not null), true) then 'plan_pro'
    when t.trial_ends_at is not null and t.trial_ends_at > now() then 'plan_pro'
    else 'plan_free'
  end;
$$;

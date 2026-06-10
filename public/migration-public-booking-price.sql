-- =================================================================================
-- MIGRACIÓN: Reservas públicas guardan el precio del servicio
-- =================================================================================
-- Aplica en Supabase → SQL Editor → ejecuta este bloque completo.
-- Es idempotente: se puede ejecutar las veces que haga falta.
-- =================================================================================

-- 1) Recrear función RPC create_public_booking incluyendo payment_amount
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
  v_price numeric(10,2);
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

  -- Validar servicio y obtener duración + precio
  select duration_minutes, price into v_duration, v_price
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

  -- Crear reserva con el precio del servicio
  insert into public.appointments (
    tenant_id, employee_id, client_id, service_id, start_at, end_at,
    status, notes, source, payment_status, payment_method, payment_amount
  ) values (
    v_tenant_id, p_employee_id, v_client_id, p_service_id, p_start, v_end,
    'confirmed', p_client_notes, 'online', 'pending', 'onsite', v_price
  ) returning id into v_appointment_id;

  return v_appointment_id;
end; $$;

grant execute on function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, text, text, text, text
) to anon, authenticated;

-- 2) Corregir reservas históricas que no tienen payment_amount
--    (se rellena con el precio actual del servicio asociado)
update public.appointments a
   set payment_amount = s.price
  from public.services s
 where a.service_id = s.id
   and a.payment_amount is null;

-- ✅ Listo. Las nuevas reservas públicas guardarán el precio y aparecerán correctamente
--    en la lista de reservas, pagos y dashboard del Admin.

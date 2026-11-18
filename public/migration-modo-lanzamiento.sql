-- ============================================================
-- Reserva360 · MODO LANZAMIENTO (gratis para todos con plan Pro)
-- Ejecutar en Supabase → SQL Editor → Run. Se puede ejecutar varias veces.
-- Mientras esté activo:
--   · Todos los negocios sin suscripción pagada tienen el plan Pro (hasta 3 profesionales, reservas ilimitadas, WhatsApp).
--   · No se aplica la prueba de 14 días.
-- ============================================================

-- 1) Interruptor en la base de datos
insert into public.platform_settings (key, value, updated_at)
values ('launch_free_mode', 'true'::jsonb, now())
on conflict (key) do update set value = 'true'::jsonb, updated_at = now();

-- 2) Plan efectivo: suscripción pagada > modo lanzamiento (Pro) > prueba de 14 días (Pro) > Free
create or replace function public.tenant_effective_plan(t public.tenants)
returns text language sql stable security definer set search_path = public as $$
  select case
    when coalesce(t.subscription_status, '') in ('active', 'trialing', 'past_due')
         and t.plan_id in ('plan_pro', 'plan_business') then t.plan_id
    when coalesce((select value::text from public.platform_settings where key = 'launch_free_mode'), 'false') = 'true' then 'plan_pro'
    when t.trial_ends_at is not null and t.trial_ends_at > now() then 'plan_pro'
    else 'plan_free'
  end;
$$;

-- ============================================================
-- VOLVER AL MODO DE PAGO (cuando quieras empezar a cobrar):
-- ejecuta solo esta línea en Supabase y avisa para desactivar el modo lanzamiento en la web
--
--   update public.platform_settings set value = 'false'::jsonb, updated_at = now() where key = 'launch_free_mode';
-- ============================================================

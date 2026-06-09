-- =================================================================================
-- Reserva360 — Políticas Storage para subida de logos
-- =================================================================================
-- EJECUTAR este SQL en Supabase SQL Editor para permitir subida de logos.
-- El bucket "public-logos" ya está creado (público para lectura).
-- =================================================================================

-- Permitir SUBIR archivos al bucket public-logos a usuarios autenticados
drop policy if exists "public-logos upload" on storage.objects;
create policy "public-logos upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-logos');

-- Permitir ACTUALIZAR archivos en public-logos a usuarios autenticados
drop policy if exists "public-logos update" on storage.objects;
create policy "public-logos update" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-logos')
  with check (bucket_id = 'public-logos');

-- Permitir BORRAR archivos en public-logos a usuarios autenticados
drop policy if exists "public-logos delete" on storage.objects;
create policy "public-logos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-logos');

-- Permitir LECTURA pública (anon + authenticated)
drop policy if exists "public-logos read" on storage.objects;
create policy "public-logos read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-logos');

-- ✅ Listo. Ahora cualquier tenant_admin podrá subir su logo desde el panel.

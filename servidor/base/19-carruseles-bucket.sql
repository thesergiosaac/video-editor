-- ════════════════════════════════════════════════════════════════════════════════════════
-- Dónde viven las fotos de los carruseles (27-sep-2026, fase 1 de los carruseles automáticos)
--
-- Igual que las viñetas: no van dentro del documento del carrusel (una foto son ~300 KB y viajarían
-- en CADA guardado). Bucket PRIVADO porque son fotos personales de la gente. Cada quien solo alcanza
-- su propia carpeta: la primera parte de la ruta es su id de usuario.
--   carruseles/<user_id>/<foto>.jpg
-- La página las achica antes de subir (lado mayor 1600 px) y las pinta con direcciones firmadas.
-- ════════════════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carruseles', 'carruseles', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists carruseles_ver        on storage.objects;
drop policy if exists carruseles_subir      on storage.objects;
drop policy if exists carruseles_actualizar on storage.objects;
drop policy if exists carruseles_borrar     on storage.objects;

create policy carruseles_ver on storage.objects
  for select to authenticated
  using (bucket_id = 'carruseles' and (storage.foldername(name))[1] = auth.uid()::text);

create policy carruseles_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'carruseles' and (storage.foldername(name))[1] = auth.uid()::text);

-- «x-upsert: true» reemplaza: necesita poder actualizar la suya
create policy carruseles_actualizar on storage.objects
  for update to authenticated
  using (bucket_id = 'carruseles' and (storage.foldername(name))[1] = auth.uid()::text);

create policy carruseles_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'carruseles' and (storage.foldername(name))[1] = auth.uid()::text);

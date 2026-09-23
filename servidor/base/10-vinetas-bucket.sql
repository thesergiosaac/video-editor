-- ════════════════════════════════════════════════════════════════════════════════════════
-- Dónde viven las viñetas dibujadas (23-sep-2026)
--
-- No van dentro de la ficha: una viñeta son ~80 KB y nueve por video serían casi un mega
-- viajando en CADA guardado. Eso rompe la regla de velocidad.
--
-- Bucket PRIVADO y no el `assets` que ya existe, porque una viñeta lleva la cara de alguien
-- dibujada a partir de su foto. Cada quien solo alcanza su propia carpeta: la primera parte de
-- la ruta es su id de usuario.
--   vinetas/<user_id>/<ficha>/<paso>-<sello>.jpg
-- ════════════════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vinetas', 'vinetas', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Su carpeta y nada más. `storage.foldername(name)` parte la ruta; el primer trozo es el dueño.
drop policy if exists vinetas_ver    on storage.objects;
drop policy if exists vinetas_subir  on storage.objects;
drop policy if exists vinetas_borrar on storage.objects;

create policy vinetas_ver on storage.objects
  for select to authenticated
  using (bucket_id = 'vinetas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy vinetas_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vinetas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy vinetas_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'vinetas' and (storage.foldername(name))[1] = auth.uid()::text);

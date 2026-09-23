-- Carrete · 16-sep-2026 · primer ingreso (crear contraseña una sola vez)
-- Solo el servidor (service_role) puede ejecutar estas funciones.

create or replace function public.carrete_cuenta_pendiente(correo text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(correo))
    and coalesce((u.raw_app_meta_data->>'clave_pendiente')::boolean, false)
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until < now())
  limit 1
$$;

create or replace function public.carrete_reclamar_primer_ingreso(correo text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('clave_pendiente', false)
   where lower(u.email) = lower(trim(correo))
     and coalesce((u.raw_app_meta_data->>'clave_pendiente')::boolean, false)
     and u.deleted_at is null
     and (u.banned_until is null or u.banned_until < now())
  returning u.id
$$;

create or replace function public.carrete_devolver_primer_ingreso(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('clave_pendiente', true)
   where u.id = uid
$$;

revoke all on function public.carrete_cuenta_pendiente(text) from public, anon, authenticated;
revoke all on function public.carrete_reclamar_primer_ingreso(text) from public, anon, authenticated;
revoke all on function public.carrete_devolver_primer_ingreso(uuid) from public, anon, authenticated;
grant execute on function public.carrete_cuenta_pendiente(text) to service_role;
grant execute on function public.carrete_reclamar_primer_ingreso(text) to service_role;
grant execute on function public.carrete_devolver_primer_ingreso(uuid) to service_role;

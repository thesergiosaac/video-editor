-- Cherry · 30-oct-2026 · la entrada: registrarse, confirmar el correo y recuperar la contraseña (función cuenta-entrada).
-- Nada de esto abre el registro: se abre cambiando cherry_ajustes › registro a "abierto" (y prendiendo los registros nuevos en Supabase, para Google).

-- Los códigos de 6 números: uno vigente por correo y para qué; se guarda su huella, nunca el código
create table if not exists public.codigos_correo (
  correo   text not null,
  para     text not null check (para in ('registro', 'recuperar')),
  huella   text not null,
  intentos int  not null default 0,
  vence    timestamptz not null,
  enviado  timestamptz not null default now(),
  primary key (correo, para)
);
alter table public.codigos_correo enable row level security;

-- Cuántos correos se han enviado: frena a quien pida muchos desde el mismo sitio
create table if not exists public.correo_envios (
  id     bigserial primary key,
  ip     text,
  creado timestamptz not null default now()
);
create index if not exists correo_envios_creado on public.correo_envios (creado);
alter table public.correo_envios enable row level security;

-- Qué pasa con un correo: nueva · primera (la abrimos por dentro y falta su contraseña) · sin_confirmar · google (sin contraseña) · clave
create or replace function public.cherry_estado_correo(correo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when coalesce((u.raw_app_meta_data->>'clave_pendiente')::boolean, false) then 'primera'
      when u.email_confirmed_at is null then 'sin_confirmar'
      when u.encrypted_password is null or u.encrypted_password = '' then 'google'
      else 'clave'
    end
    from auth.users u
    where lower(u.email) = lower(trim(correo)) and u.deleted_at is null
    limit 1
  ), 'nueva')
$$;

create or replace function public.cherry_id_correo(correo text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(correo)) and u.deleted_at is null limit 1
$$;

revoke all on function public.cherry_estado_correo(text) from public, anon, authenticated;
revoke all on function public.cherry_id_correo(text) from public, anon, authenticated;
grant execute on function public.cherry_estado_correo(text) to service_role;
grant execute on function public.cherry_id_correo(text) to service_role;

-- Cerrado hasta el lanzamiento. registro_prueba: los correos que sí pueden registrarse antes (para probar)
insert into public.cherry_ajustes (clave, valor) values ('registro', '"cerrado"') on conflict (clave) do nothing;
insert into public.cherry_ajustes (clave, valor) values ('registro_prueba', '[]') on conflict (clave) do nothing;

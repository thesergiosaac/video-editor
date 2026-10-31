-- Cherry · 31-oct-2026 · las tres imágenes de Crear cuenta rotan: cuántas personas vio cada una y cuántas se registraron con ella.
-- Solo la toca el servidor (función cuenta-entrada). No guarda nada de la persona: son dos contadores por imagen.
create table if not exists public.registro_versiones (
  version    text primary key,
  vistas     integer not null default 0,
  registros  integer not null default 0,
  actualizado timestamptz not null default now()
);
alter table public.registro_versiones enable row level security;
insert into public.registro_versiones (version) values ('periodico'), ('portatil'), ('particulas') on conflict (version) do nothing;

create or replace function public.cherry_suma_version(v text, campo text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.registro_versiones
     set vistas = vistas + (case when campo = 'vistas' then 1 else 0 end),
         registros = registros + (case when campo = 'registros' then 1 else 0 end),
         actualizado = now()
   where version = v;
$$;
revoke all on function public.cherry_suma_version(text, text) from public, anon, authenticated;
grant execute on function public.cherry_suma_version(text, text) to service_role;

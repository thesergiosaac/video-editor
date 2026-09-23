-- 07-herramientas.sql (19-sep-2026, aprobado por Sergio: «te apruebo todo»)
-- Lo que cada persona guarda en las herramientas del inicio (Guiones, Storyboard, Carruseles, Calendario, Identidad de marca):
-- un documento por herramienta y por cuenta. Solo la dueña lo ve y lo cambia.
create table if not exists public.herramientas_datos (
  user_id     uuid not null references auth.users(id) on delete cascade,
  herramienta text not null check (herramienta in ('guiones', 'storyboard', 'carruseles', 'calendario', 'marca')),
  datos       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, herramienta)
);
alter table public.herramientas_datos enable row level security;

drop policy if exists "herramientas: leer lo propio" on public.herramientas_datos;
drop policy if exists "herramientas: crear lo propio" on public.herramientas_datos;
drop policy if exists "herramientas: cambiar lo propio" on public.herramientas_datos;
drop policy if exists "herramientas: borrar lo propio" on public.herramientas_datos;
create policy "herramientas: leer lo propio" on public.herramientas_datos for select using (auth.uid() = user_id);
create policy "herramientas: crear lo propio" on public.herramientas_datos for insert with check (auth.uid() = user_id);
create policy "herramientas: cambiar lo propio" on public.herramientas_datos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "herramientas: borrar lo propio" on public.herramientas_datos for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.herramientas_datos to authenticated;

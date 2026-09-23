-- «Mis colores» (18-sep-2026): preferencias de cada cuenta. Solo la dueña de la fila la ve y la cambia.
create table if not exists public.preferencias_usuario (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  colores    jsonb not null default '[]'::jsonb check (jsonb_typeof(colores) = 'array' and jsonb_array_length(colores) <= 32),
  updated_at timestamptz not null default now()
);
alter table public.preferencias_usuario enable row level security;

drop policy if exists "preferencias: leer las propias" on public.preferencias_usuario;
drop policy if exists "preferencias: crear las propias" on public.preferencias_usuario;
drop policy if exists "preferencias: cambiar las propias" on public.preferencias_usuario;
create policy "preferencias: leer las propias" on public.preferencias_usuario
  for select using (auth.uid() = user_id);
create policy "preferencias: crear las propias" on public.preferencias_usuario
  for insert with check (auth.uid() = user_id);
create policy "preferencias: cambiar las propias" on public.preferencias_usuario
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.preferencias_usuario to authenticated;

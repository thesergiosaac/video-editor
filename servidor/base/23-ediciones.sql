-- 23 · La capa de edición (30-sep-2026)
-- Un proyecto puede traer una edición hecha a mano: capas de Remotion ya dibujadas (WebM con transparencia en el bucket,
-- ediciones/<proyecto>/...) con sus tiempos en el reloj del video. El ensamblador (edicion.js) las monta encima del color,
-- así el color que escoja la persona solo toca su video. Ver docs/EDICION.md.
create table if not exists public.ediciones (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  user_id      uuid not null,
  activa       boolean not null default true,
  nombre       text,
  ancho        integer not null default 1080,
  capas        jsonb not null default '[]'::jsonb,
  quieto       jsonb not null default '[]'::jsonb,
  subtitulos   jsonb not null default '[]'::jsonb,
  cortes       jsonb,
  silueta_key  text,
  creado       timestamptz not null default now()
);
create index if not exists ediciones_proyecto on public.ediciones (project_id, activa, creado desc);
alter table public.ediciones enable row level security;
drop policy if exists "ediciones: el dueño las ve" on public.ediciones;
create policy "ediciones: el dueño las ve" on public.ediciones for select using (auth.uid() = user_id);
drop policy if exists "ediciones: el dueño las apaga" on public.ediciones;
create policy "ediciones: el dueño las apaga" on public.ediciones for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══ Publicar en Instagram desde Cherry ═══════════════════════════════════════════════════════
--
-- ⚠️ INSTAGRAM NO PROGRAMA NADA. No existe «publica esto el martes a las siete»: lo único que
-- hay es «publica esto AHORA». La hora la tiene que disparar el servidor de Cherry, y de ahí
-- esta tabla y el reloj de abajo.
--
-- ⚠️ Y SE PUBLICA EN DOS TIEMPOS. Primero se le da a Instagram la dirección del video y él se lo
-- descarga y lo procesa —lo que tarda, para un reel de 40 MB, del orden de un minuto—; solo
-- cuando dice que terminó se puede publicar de verdad. Por eso esto es una máquina de estados y
-- no una función que espera: una función que se queda esperando un minuto se muere sola a la
-- mitad y deja el video en el limbo.
--
--   programada  →  el reloj la ve vencida y le pide a Instagram que se descargue el video
--   subiendo    →  Instagram lo está procesando; cada vuelta del reloj se le pregunta
--   publicada   →  hecho, con su ig_media_id para poder medirla después
--   fallida     →  con el motivo escrito, no un fallo mudo

create table if not exists public.publicaciones_programadas (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  ig_user_id    text        not null,
  -- de dónde saca Instagram el archivo. Tiene que ser una dirección PÚBLICA: él la descarga
  -- desde sus servidores, no desde el navegador de nadie.
  video_url     text        not null,
  texto         text,
  tipo          text        not null default 'REELS',
  publicar_el   timestamptz not null,
  estado        text        not null default 'programada',
  -- lo que devuelve Instagram por el camino
  container_id  text,
  ig_media_id   text,
  intentos      integer     not null default 0,
  error         text,
  creada        timestamptz not null default now(),
  actualizada   timestamptz not null default now()
);

-- El reloj pregunta por esto cada pocos minutos: que sea barato.
create index if not exists publicaciones_programadas_pendientes_idx
  on public.publicaciones_programadas (publicar_el)
  where estado in ('programada', 'subiendo');

create index if not exists publicaciones_programadas_mias_idx
  on public.publicaciones_programadas (user_id, publicar_el desc);

alter table public.publicaciones_programadas enable row level security;

-- Cada quien ve y programa lo suyo. Quien las MUEVE de estado es la función del servidor.
drop policy if exists programadas_ver on public.publicaciones_programadas;
create policy programadas_ver on public.publicaciones_programadas
  for select using (auth.uid() = user_id);

drop policy if exists programadas_poner on public.publicaciones_programadas;
create policy programadas_poner on public.publicaciones_programadas
  for insert with check (auth.uid() = user_id);

-- Solo se puede tocar lo que todavía no ha salido: una publicación ya publicada es historia.
drop policy if exists programadas_cambiar on public.publicaciones_programadas;
create policy programadas_cambiar on public.publicaciones_programadas
  for update using (auth.uid() = user_id and estado = 'programada')
         with check (auth.uid() = user_id);

drop policy if exists programadas_quitar on public.publicaciones_programadas;
create policy programadas_quitar on public.publicaciones_programadas
  for delete using (auth.uid() = user_id and estado = 'programada');

revoke truncate, references, trigger on public.publicaciones_programadas from anon, authenticated;

-- ── El tope de Instagram ─────────────────────────────────────────────────────────────────────
-- 100 publicaciones cada 24 horas por cuenta. Pasarse no devuelve un error claro: empieza a
-- rechazar sin más. Mejor contarlo nosotros y decirlo con palabras.
create or replace function public.publicadas_24h(p_ig_user_id text)
returns integer language sql stable as $$
  select count(*)::int from public.publicaciones_programadas
   where ig_user_id = p_ig_user_id and estado = 'publicada'
     and actualizada > now() - interval '24 hours'
$$;

-- 23-sep-2026 · las opciones que acepta cada tipo de contenedor de Meta.
-- En jsonb y no una columna por opcion: Meta anade parametros cada temporada.
alter table public.publicaciones_programadas
  add column if not exists opciones jsonb not null default '{}'::jsonb;

-- 23-sep-2026 · un sitio publico para lo que se sube solo para publicar.
-- ⚠️ POR QUE NO S3. Medido pidiendole a S3 escribir 4 bytes en cada carpeta: `publicar/`,
-- `clips/` y `renders/` dan 403 al ESCRIBIR, y `uploads/` —la unica donde se puede— da 403 al
-- LEER sin credenciales. Instagram descarga desde sus servidores, asi que en S3 no hay ni un
-- sitio donde dejarlo sin cambiar los permisos de AWS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicar', 'publicar', true, 314572800,
        array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 314572800;

drop policy if exists publicar_subo_lo_mio on storage.objects;
create policy publicar_subo_lo_mio on storage.objects for insert to authenticated
  with check (bucket_id = 'publicar' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists publicar_borro_lo_mio on storage.objects;
create policy publicar_borro_lo_mio on storage.objects for delete to authenticated
  using (bucket_id = 'publicar' and (storage.foldername(name))[1] = auth.uid()::text);

-- Leer lo puede cualquiera: lo necesita Meta para descargarlo.
drop policy if exists publicar_lo_ve_cualquiera on storage.objects;
create policy publicar_lo_ve_cualquiera on storage.objects for select to public
  using (bucket_id = 'publicar');

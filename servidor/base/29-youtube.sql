-- ══ YouTube: canales conectados y publicaciones programadas (25-oct-2026) ═══════════════════════
--
-- Hermana de 28-tiktok.sql: misma receta, otra red. Tablas APARTE por lo mismo que TikTok.
--
-- ⚠️ La llave de Google (token y refresh_token) es tan delicada como la contraseña de la cuenta: el navegador NO la
-- puede leer. RLS decide qué filas, los permisos de columna qué columnas. La app lee `mi_youtube`, sin llaves.
-- ⚠️ El token de Google dura 1 HORA y el refresh_token no vence (mientras la app esté «En producción» en Google
--    Cloud y la persona no le quite el permiso). Se renueva al usarlo: no hace falta reloj para eso.
-- ⚠️ La hora la dispara el reloj de la base (cron `yt-publicar`, cada minuto), igual que Instagram y TikTok.

create table if not exists public.cuentas_youtube (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  canal_id        text        not null,          -- el id del canal (UC…)
  marca           text,                          -- la marca de Cherry a la que pertenece
  usuario         text,                          -- el @ del canal (customUrl)
  nombre          text,                          -- el nombre del canal
  foto            text,
  descripcion     text,
  suscriptores    bigint,                        -- null si el canal los esconde
  vistas          bigint,
  videos          integer,
  lista_subidos   text,                          -- la lista «uploads» del canal (para leer sus videos sin gastar cupo)
  perfil_visto    timestamptz,
  token           text        not null,
  token_vence     timestamptz not null,
  refresh_token   text        not null,
  permisos        text,                          -- los scopes que la persona aceptó
  -- 'activa' | 'caducada' | 'desconectada'
  estado          text        not null default 'activa',
  conectada       timestamptz not null default now(),
  refrescado      timestamptz,
  primary key (user_id, canal_id)
);
create index if not exists cuentas_youtube_marca_idx on public.cuentas_youtube (user_id, marca);

alter table public.cuentas_youtube enable row level security;
drop policy if exists cuentas_youtube_ver on public.cuentas_youtube;
create policy cuentas_youtube_ver on public.cuentas_youtube for select using (auth.uid() = user_id);
revoke select on public.cuentas_youtube from anon, authenticated;
grant select (user_id, canal_id, marca, usuario, nombre, foto, descripcion, suscriptores, vistas, videos,
              perfil_visto, permisos, estado, conectada)
  on public.cuentas_youtube to anon, authenticated;

drop view if exists public.mi_youtube;
create view public.mi_youtube with (security_invoker = true) as
  select user_id, canal_id, marca, usuario, nombre, foto, descripcion, suscriptores, vistas, videos,
         perfil_visto, permisos, estado, conectada
    from public.cuentas_youtube;

-- ── Lo programado ────────────────────────────────────────────────────────────────────────────
-- Un video va a YouTube en tres tiempos (cada vuelta del reloj hace un paso y guarda dónde quedó):
--   1. programada → se abre la subida «reanudable» de Google (la sesión vale una semana) → 'subiendo'
--   2. se suben los pedazos; con el último, YouTube devuelve el id del video → 'procesando'
--   3. videos.list dice uploadStatus 'processed' → 'publicada' · 'rejected'/'failed' → 'fallida' con el motivo
create table if not exists public.publicaciones_youtube (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  canal_id        text        not null,
  video_url       text,                          -- dirección pública https del video (render de Cherry o archivo subido)
  render_master   uuid,                          -- si todavía se fabrica: el render que hay que esperar
  master_estado   text,                          -- 'lista' | 'preparando' | 'fallida' | 'no'
  titulo          text        not null,          -- ≤ 100 caracteres, sin < ni >
  descripcion     text        not null default '',
  privacidad      text        not null,          -- public | unlisted | private
  opciones        jsonb       not null default '{}'::jsonb, -- para_ninos, ia, etiquetas, avisar, original
  publicar_el     timestamptz not null,
  estado          text        not null default 'programada',
  subida          jsonb,                         -- {url, tam, enviado, inicio} mientras se suben los pedazos
  video_id        text,
  intentos        integer     not null default 0,
  error           text,
  bloqueo         timestamptz,
  creada          timestamptz not null default now(),
  actualizada     timestamptz not null default now()
);
create index if not exists publicaciones_youtube_pend_idx on public.publicaciones_youtube (publicar_el)
  where estado in ('programada', 'subiendo', 'procesando');
create index if not exists publicaciones_youtube_user_idx on public.publicaciones_youtube (user_id, publicar_el desc);

alter table public.publicaciones_youtube enable row level security;
drop policy if exists publicaciones_youtube_ver on public.publicaciones_youtube;
create policy publicaciones_youtube_ver on public.publicaciones_youtube for select using (auth.uid() = user_id);
-- escribir solo lo hace la función del servidor (valida el canal, las opciones y la hora)

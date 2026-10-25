-- ══ TikTok: cuentas conectadas y publicaciones programadas (25-oct-2026) ══════════════════════
--
-- Igual que Instagram (12-instagram.sql, 14-publicar.sql), pero en tablas APARTE: `publicaciones_programadas`
-- es solo de Instagram (ig_user_id NOT NULL, tipos de Meta) y meterle TikTok la llenaría de columnas que no aplican.
--
-- ⚠️ La llave de TikTok (token y refresh_token) es tan delicada como la contraseña de la cuenta: el navegador
-- NO la puede leer. Misma receta que Instagram: RLS decide qué filas, los permisos de columna qué columnas.
-- La app lee `mi_tiktok`, que trae todo MENOS las llaves.
--
-- ⚠️ TikTok no programa: «publica a las 10» lo hace el reloj de la base (cron `tt-publicar`, cada minuto).
-- ⚠️ Mientras la app no pase la auditoría de TikTok, todo lo publicado sale PRIVADO (solo lo ve el dueño) y
--    solo se puede publicar en cuentas privadas.

create table if not exists public.cuentas_tiktok (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  open_id         text        not null,          -- el id de la cuenta para ESTA app
  marca           text,                          -- la marca de Cherry a la que pertenece
  usuario         text,                          -- el @ (username)
  nombre          text,                          -- display name
  foto            text,
  bio             text,
  enlace          text,                          -- profile_deep_link
  verificada      boolean,
  seguidores      integer,
  siguiendo       integer,
  likes           bigint,
  videos          integer,
  perfil_visto    timestamptz,
  -- las llaves: token dura 24 h, refresh_token 365 días (y TikTok puede cambiarlo al refrescar)
  token           text        not null,
  token_vence     timestamptz not null,
  refresh_token   text        not null,
  refresh_vence   timestamptz not null,
  permisos        text,                          -- los scopes que la persona aceptó
  -- 'activa' | 'caducada' | 'revocada' | 'desconectada'
  estado          text        not null default 'activa',
  conectada       timestamptz not null default now(),
  refrescado      timestamptz,
  primary key (user_id, open_id)
);
create index if not exists cuentas_tiktok_marca_idx on public.cuentas_tiktok (user_id, marca);
create index if not exists cuentas_tiktok_vence_idx on public.cuentas_tiktok (token_vence) where estado = 'activa';

alter table public.cuentas_tiktok enable row level security;
drop policy if exists cuentas_tiktok_ver on public.cuentas_tiktok;
create policy cuentas_tiktok_ver on public.cuentas_tiktok for select using (auth.uid() = user_id);
revoke select on public.cuentas_tiktok from anon, authenticated;
grant select (user_id, open_id, marca, usuario, nombre, foto, bio, enlace, verificada, seguidores, siguiendo, likes,
              videos, perfil_visto, permisos, estado, conectada)
  on public.cuentas_tiktok to anon, authenticated;

drop view if exists public.mi_tiktok;
create view public.mi_tiktok with (security_invoker = true) as
  select user_id, open_id, marca, usuario, nombre, foto, bio, enlace, verificada, seguidores, siguiendo, likes,
         videos, perfil_visto, permisos, estado, conectada
    from public.cuentas_tiktok;

-- ── Lo programado ────────────────────────────────────────────────────────────────────────────
-- Un video va a TikTok en tres tiempos (cada vuelta del reloj hace un paso y guarda dónde quedó):
--   1. programada → se pide la subida (publish/video/init, FILE_UPLOAD) y se suben los pedazos → 'subiendo'
--   2. con todos los pedazos arriba → 'procesando' (TikTok lo revisa)
--   3. status/fetch dice PUBLISH_COMPLETE → 'publicada' · FAILED → 'fallida' con el motivo
create table if not exists public.publicaciones_tiktok (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  open_id         text        not null,
  video_url       text,                          -- dirección pública https del video (render de Cherry o archivo subido)
  render_master   uuid,                          -- si todavía se fabrica: el render que hay que esperar
  master_estado   text,                          -- 'lista' | 'preparando' | 'fallida' | 'no'
  texto           text        not null default '',
  privacidad      text        not null,          -- PUBLIC_TO_EVERYONE | MUTUAL_FOLLOW_FRIENDS | FOLLOWER_OF_CREATOR | SELF_ONLY
  opciones        jsonb       not null default '{}'::jsonb, -- comentarios, duo, pegar, marca_propia, contenido_marca, ia, original
  publicar_el     timestamptz not null,
  estado          text        not null default 'programada',
  publish_id      text,
  subida          jsonb,                         -- {url, tam, pedazo, pedazos, hecho} mientras se suben los pedazos
  post_id         text,
  intentos        integer     not null default 0,
  error           text,
  bloqueo         timestamptz,                   -- una vuelta del reloj la está trabajando hasta esta hora
  creada          timestamptz not null default now(),
  actualizada     timestamptz not null default now()
);
alter table public.publicaciones_tiktok add column if not exists bloqueo timestamptz;
create index if not exists publicaciones_tiktok_pend_idx on public.publicaciones_tiktok (publicar_el)
  where estado in ('programada', 'subiendo', 'procesando');
create index if not exists publicaciones_tiktok_user_idx on public.publicaciones_tiktok (user_id, publicar_el desc);

alter table public.publicaciones_tiktok enable row level security;
drop policy if exists publicaciones_tiktok_ver on public.publicaciones_tiktok;
create policy publicaciones_tiktok_ver on public.publicaciones_tiktok for select using (auth.uid() = user_id);
-- escribir solo lo hace la función del servidor (valida la cuenta, las opciones de TikTok y la hora)

-- ══ Las publicaciones de Instagram y sus números ═════════════════════════════════════════════
--
-- Hasta hoy el Laboratorio leía capturas de pantalla. Con la cuenta conectada, casi todo esto
-- llega solo: alcance, vistas, me gusta, comentarios, guardados, compartidos, tiempo medio y
-- tasa de omisión. Lo único que sigue necesitando captura es la CURVA de retención, porque la
-- API no la da — se comprobó pidiéndosela por su nombre y Meta la rechaza.
--
-- ⚠️ SE GUARDAN INSTANTÁNEAS, NO UN ÚNICO VALOR. Un reel de hace un año tiene más vistas que uno
-- de anteayer por el simple hecho de llevar más tiempo publicado. Comparar los totales de los dos
-- es comparar edades, no calidad. Guardando cada medición con su fecha se puede preguntar lo
-- único que se puede comparar de verdad: cuántas vistas llevaba CADA UNO a las 48 horas.

create table if not exists public.publicaciones_instagram (
  ig_media_id   text        primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  ig_user_id    text        not null,
  tipo          text,                    -- REELS | IMAGE | CAROUSEL_ALBUM
  publicado     timestamptz,
  enlace        text,
  texto         text,
  miniatura     text,
  -- ⚠️ La API NO da la duración: se mide leyendo los primeros kilobytes del archivo, donde el
  -- MP4 guarda su caja `mvhd`. Sin ella no hay porcentaje de retención.
  dura_seg      numeric,
  visto         timestamptz not null default now()
);

create index if not exists publicaciones_instagram_cuenta_idx
  on public.publicaciones_instagram (user_id, publicado desc);

create table if not exists public.metricas_instagram (
  ig_media_id   text        not null references public.publicaciones_instagram(ig_media_id) on delete cascade,
  medido        timestamptz not null default now(),
  horas         numeric,                 -- cuántas horas llevaba publicado al medir
  alcance       integer,
  vistas        integer,
  me_gusta      integer,
  comentarios   integer,
  guardados     integer,
  compartidos   integer,
  interacciones integer,
  -- el tiempo viene en milisegundos desde Instagram; se guarda tal cual para no perder precisión
  visto_medio_ms   integer,
  visto_total_ms   bigint,
  omision       numeric,                 -- reels_skip_rate, en porcentaje
  -- calculada aquí: tiempo medio ÷ duración. Es el número que la app NO te enseña.
  retencion     numeric,
  primary key (ig_media_id, medido)
);

alter table public.publicaciones_instagram enable row level security;
alter table public.metricas_instagram      enable row level security;

drop policy if exists publicaciones_instagram_ver on public.publicaciones_instagram;
create policy publicaciones_instagram_ver on public.publicaciones_instagram
  for select using (auth.uid() = user_id);

drop policy if exists metricas_instagram_ver on public.metricas_instagram;
create policy metricas_instagram_ver on public.metricas_instagram
  for select using (exists (
    select 1 from public.publicaciones_instagram p
     where p.ig_media_id = metricas_instagram.ig_media_id and p.user_id = auth.uid()));

-- Nadie escribe esto desde el navegador: lo llena la función del servidor.
revoke insert, update, delete, truncate, references, trigger
  on public.publicaciones_instagram, public.metricas_instagram from anon, authenticated;

-- ── La última medición de cada publicación ───────────────────────────────────────────────────
-- Es lo que pinta la pantalla. Se separa de la tabla para que nadie tenga que acordarse de
-- escribir el «distinct on» cada vez.
create or replace view public.mis_publicaciones
with (security_invoker = true) as
  select p.ig_media_id, p.user_id, p.ig_user_id, p.tipo, p.publicado, p.enlace, p.texto,
         p.miniatura, p.dura_seg,
         m.medido, m.horas, m.alcance, m.vistas, m.me_gusta, m.comentarios, m.guardados,
         m.compartidos, m.interacciones, m.visto_medio_ms, m.omision, m.retencion
    from public.publicaciones_instagram p
    left join lateral (
      select * from public.metricas_instagram x
       where x.ig_media_id = p.ig_media_id
       order by x.medido desc limit 1
    ) m on true;

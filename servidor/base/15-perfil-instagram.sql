-- ══ El perfil real de Instagram, atado a cada marca ══════════════════════════════════════════
--
-- Hasta hoy la foto, el usuario, la bio y los números de seguidores se escribían A MANO en el
-- diálogo «El perfil de tu marca», porque la API de Instagram no estaba. Ya está, así que esos
-- datos dejan de inventarse y pasan a leerse.
--
-- ⚠️ Una cuenta de Instagram pertenece a UNA marca de Cherry. Sergio lleva varias —la suya de
-- marketing y la del restaurante— y cada una tiene su perfil, su baúl y sus videos aparte. Sin
-- esta columna, el inicio enseñaría los seguidores de una marca mientras miras la otra.

alter table public.cuentas_instagram
  add column if not exists marca         text,
  add column if not exists nombre_real   text,
  add column if not exists bio           text,
  add column if not exists web           text,
  add column if not exists seguidores    integer,
  add column if not exists seguidos      integer,
  add column if not exists publicaciones integer,
  add column if not exists perfil_visto  timestamptz;

create index if not exists cuentas_instagram_marca_idx
  on public.cuentas_instagram (user_id, marca);

-- La vista que lee la aplicación: todo el perfil, nunca el token.
-- ⚠️ Se TIRA y se rehace: `create or replace` no deja cambiar el orden ni el nombre de las
-- columnas de una vista que ya existe, y aquí entran columnas nuevas por el medio.
drop view if exists public.mi_instagram;
create view public.mi_instagram
with (security_invoker = true) as
  select user_id, ig_user_id, marca, usuario, nombre, nombre_real, bio, web, foto,
         seguidores, seguidos, publicaciones, estado, conectada, token_vence, perfil_visto
    from public.cuentas_instagram;

-- Las columnas nuevas también se pueden leer; el token sigue cerrado.
grant select (user_id, ig_user_id, marca, usuario, nombre, nombre_real, bio, web, foto,
              seguidores, seguidos, publicaciones, estado, conectada, token_vence, perfil_visto)
  on public.cuentas_instagram to anon, authenticated;

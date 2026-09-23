-- ══ Las cuentas de Instagram conectadas ══════════════════════════════════════════════════════
--
-- Cuando alguien conecta su Instagram, Meta nos da una llave de acceso a SU cuenta. Con esa llave
-- se publica por él, se leen sus comentarios y se mandan sus mensajes. O sea que esa llave es
-- exactamente igual de delicada que una contraseña suya.
--
-- ⚠️ POR ESO LA TABLA NO TIENE POLÍTICA DE LECTURA. Ninguna. Ni siquiera el dueño la puede leer
-- desde el navegador: si el navegador pudiera leer el token, cualquier extensión instalada en el
-- equipo de un usuario podría llevárselo y publicar en su nombre. La única que entra aquí es la
-- función del servidor, que va con la llave de servicio.
--
-- Lo que sí puede ver la aplicación es la vista `mi_instagram`, que trae todo MENOS el token.

create table if not exists public.cuentas_instagram (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  ig_user_id    text        not null,
  usuario       text,                       -- el @ que se ve en pantalla
  nombre        text,
  foto          text,
  -- la llave y su caducidad
  token         text        not null,
  token_vence   timestamptz not null,
  refrescado    timestamptz,
  -- cómo va la conexión: 'activa' | 'caducada' | 'revocada'
  estado        text        not null default 'activa',
  conectada     timestamptz not null default now(),
  primary key (user_id, ig_user_id)
);

-- Para encontrar de quién es una cuenta cuando llega un aviso de Meta, que viene identificado por
-- el id de Instagram y no por el nuestro.
create index if not exists cuentas_instagram_ig_idx
  on public.cuentas_instagram (ig_user_id);

-- Para saber a quién hay que refrescarle la llave antes de que caduque.
create index if not exists cuentas_instagram_vence_idx
  on public.cuentas_instagram (token_vence) where estado = 'activa';

alter table public.cuentas_instagram enable row level security;
-- (a propósito, sin ninguna política: nadie lee esto desde el navegador)

-- ── Lo que la aplicación sí puede ver ─────────────────────────────────────────────────────────
create or replace view public.mi_instagram
with (security_invoker = true) as
  select user_id, ig_user_id, usuario, nombre, foto, estado, conectada, token_vence
    from public.cuentas_instagram;

-- La vista hereda RLS de la tabla, que no tiene políticas, así que haría falta una para que el
-- dueño vea LO SUYO — pero sin el token, que ni siquiera está en la vista.
drop policy if exists cuentas_instagram_ver on public.cuentas_instagram;
create policy cuentas_instagram_ver on public.cuentas_instagram
  for select using (auth.uid() = user_id);

-- ⚠️ Esa política daría acceso también a la columna `token`. Se corrige quitándole el permiso a
-- la columna: RLS decide QUÉ FILAS, los permisos de columna deciden QUÉ COLUMNAS. Hacen falta las
-- dos cosas.
revoke select on public.cuentas_instagram from anon, authenticated;
grant select (user_id, ig_user_id, usuario, nombre, foto, estado, conectada, token_vence)
  on public.cuentas_instagram to anon, authenticated;

-- ── Las reglas de «comentario → mensaje» ─────────────────────────────────────────────────────
-- Una regla es: en esta publicación (o en todas), si alguien comenta esta palabra, mándale este
-- mensaje. Es lo que el usuario configura en pantalla.
create table if not exists public.reglas_comentario (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  ig_user_id    text        not null,
  -- vacío = vale para cualquier publicación de esa cuenta
  media_id      text,
  palabra       text        not null,
  mensaje       text        not null,
  -- también contestar en público al comentario, si él quiere
  responder_publico text,
  activa        boolean     not null default true,
  creada        timestamptz not null default now()
);

create index if not exists reglas_comentario_cuenta_idx
  on public.reglas_comentario (ig_user_id) where activa;

alter table public.reglas_comentario enable row level security;

drop policy if exists reglas_comentario_suyas on public.reglas_comentario;
create policy reglas_comentario_suyas on public.reglas_comentario
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── A quién ya se le contestó ────────────────────────────────────────────────────────────────
-- ⚠️ Instagram permite UNA respuesta privada por comentario, y si se intenta dos veces la cuenta
-- empieza a acumular quejas. Además Meta reenvía el mismo aviso cuando no le respondes rápido.
-- Sin esta tabla, un reintento le manda el mensaje dos veces a la misma persona.
create table if not exists public.respuestas_comentario (
  comment_id    text        primary key,
  regla_id      uuid        references public.reglas_comentario(id) on delete set null,
  user_id       uuid        references auth.users(id) on delete cascade,
  ig_user_id    text,
  -- 'enviado' | 'fallido' | 'fuera_de_plazo' | 'repetido'
  resultado     text        not null,
  detalle       text,
  cuando        timestamptz not null default now()
);

create index if not exists respuestas_comentario_cuenta_idx
  on public.respuestas_comentario (user_id, cuando desc);

alter table public.respuestas_comentario enable row level security;

drop policy if exists respuestas_comentario_ver on public.respuestas_comentario;
create policy respuestas_comentario_ver on public.respuestas_comentario
  for select using (auth.uid() = user_id);

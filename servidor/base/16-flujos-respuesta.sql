-- ══ Flujos de respuesta automática (24-sep-2026) ══════════════════════════════════════════════
-- Sergio: una interfaz tipo ManyChat (el diseño de OpenReply, MIT) en lienzo, para unir pasos.
-- Un flujo = un grafo {nodos, lineas} dibujado en herramientas/respuestas.html. Lo que dispara el
-- flujo se copia en columnas propias (donde, media_id, palabras…) para que el webhook lo encuentre
-- rápido sin abrir el grafo. Lo ejecuta ig-aviso.

create table if not exists public.flujos_respuesta (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  ig_user_id   text,
  nombre       text not null default 'Respuesta automática',
  activa       boolean not null default false,
  grafo        jsonb not null default '{"nodos":[],"lineas":[]}'::jsonb,
  -- el disparador, copiado del grafo
  donde        text not null default 'una' check (donde in ('una','todas','proxima')),
  media_id     text,
  media_tapa   text,
  palabras     text[] not null default '{}',
  cualquiera   boolean not null default false,
  por_dm       boolean not null default false,
  activada     timestamptz,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);
create index if not exists flujos_respuesta_cuenta_idx on public.flujos_respuesta (ig_user_id) where activa;
alter table public.flujos_respuesta enable row level security;
drop policy if exists flujos_ver on public.flujos_respuesta;
drop policy if exists flujos_crear on public.flujos_respuesta;
drop policy if exists flujos_cambiar on public.flujos_respuesta;
drop policy if exists flujos_borrar on public.flujos_respuesta;
create policy flujos_ver on public.flujos_respuesta for select using (auth.uid() = user_id);
create policy flujos_crear on public.flujos_respuesta for insert with check (auth.uid() = user_id);
create policy flujos_cambiar on public.flujos_respuesta for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy flujos_borrar on public.flujos_respuesta for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.flujos_respuesta to authenticated;

-- Cada persona que entra a un flujo (por un comentario o por un mensaje)
create table if not exists public.ejecuciones_flujo (
  id              uuid primary key default gen_random_uuid(),
  flujo_id        uuid not null references public.flujos_respuesta(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  ig_user_id      text not null,
  persona_id      text,                    -- IGSID de quien comentó
  persona_usuario text,
  comentario_id   text,
  origen          text not null default 'comentario',
  estado          text not null default 'en_curso',   -- en_curso | esperando_toque | esperando_tiempo | terminada | fallida
  nodo            text,                    -- dónde quedó
  despertar       timestamptz,             -- para «Esperar»
  abierta         boolean not null default false,     -- la persona ya tocó un botón o escribió: hay conversación
  ultima_interaccion timestamptz,
  privada         boolean not null default false,   -- ya se usó la respuesta privada al comentario
  pasos           jsonb not null default '[]'::jsonb,
  creada          timestamptz not null default now(),
  actualizada     timestamptz not null default now()
);
-- ⚠️ una sola respuesta privada por comentario y flujo: Meta reenvía avisos, y la segunda cuenta como queja
-- (sin WHERE: PostgREST no sabe usar un índice parcial en on_conflict; los NULL no chocan entre sí)
create unique index if not exists ejecuciones_flujo_comentario_uq on public.ejecuciones_flujo (flujo_id, comentario_id);
create index if not exists ejecuciones_flujo_espera_idx on public.ejecuciones_flujo (despertar) where estado = 'esperando_tiempo';
create index if not exists ejecuciones_flujo_persona_idx on public.ejecuciones_flujo (ig_user_id, persona_id);
alter table public.ejecuciones_flujo enable row level security;
drop policy if exists ejecuciones_ver on public.ejecuciones_flujo;
create policy ejecuciones_ver on public.ejecuciones_flujo for select using (auth.uid() = user_id);
grant select on public.ejecuciones_flujo to authenticated;

-- Los botones con enlace: se cuentan los clics pasando por la función `ir`
create table if not exists public.enlaces_flujo (
  id        text primary key,
  flujo_id  uuid not null references public.flujos_respuesta(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  nodo      text not null,
  boton     int not null,
  url       text not null,
  clics     int not null default 0,
  creado    timestamptz not null default now()
);
alter table public.enlaces_flujo enable row level security;
drop policy if exists enlaces_ver on public.enlaces_flujo;
create policy enlaces_ver on public.enlaces_flujo for select using (auth.uid() = user_id);
grant select on public.enlaces_flujo to authenticated;

create or replace function public.sumar_clic(p_id text) returns text
language sql security definer set search_path = public as $$
  update public.enlaces_flujo set clics = clics + 1 where id = p_id returning url;
$$;
revoke all on function public.sumar_clic(text) from public, anon, authenticated;

-- Lo que muestra la lista: cuántos recibieron el mensaje y cuántos clics
create or replace view public.mis_flujos_resumen with (security_invoker = true) as
  select f.id as flujo_id, f.user_id,
         (select count(*) from public.ejecuciones_flujo e where e.flujo_id = f.id and e.estado <> 'fallida') as enviados,
         (select count(*) from public.ejecuciones_flujo e where e.flujo_id = f.id and e.estado = 'fallida') as fallidos,
         (select coalesce(sum(clics), 0) from public.enlaces_flujo l where l.flujo_id = f.id) as clics,
         (select max(creada) from public.ejecuciones_flujo e where e.flujo_id = f.id) as ultima
    from public.flujos_respuesta f;
grant select on public.mis_flujos_resumen to authenticated;

-- El reloj de los «Esperar» (24-sep-2026): cada minuto, SOLO si hay alguien dormido cuya hora ya llegó, despierta a
-- ig-aviso (?reloj=1). La llave es la misma de ig-publicar y se lee de su tarea: nunca se escribe aquí.
select cron.schedule('respuestas-reloj', '* * * * *', $cmd$
  select net.http_post(
    url := 'https://xsptcepijtnmowqauyxw.supabase.co/functions/v1/ig-aviso?reloj=1',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('llave', substring((select command from cron.job where jobname = 'ig-publicar') from '"llave":"([^"]+)"')))
  where exists (select 1 from public.ejecuciones_flujo where estado = 'esperando_tiempo' and despertar <= now())
$cmd$);

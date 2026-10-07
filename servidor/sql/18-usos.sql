-- 18 (6-oct-2026) — CONTAR LOS USOS EN EL SERVIDOR (fase 3 del plan del martes, aprobado por Sergio el 5-oct).
--
-- Hasta hoy nadie descontaba créditos: la página los mostraba y nada más. Ahora cada cosa que cuesta se apunta aquí, en el
-- servidor, con una LLAVE única (un aviso o un clic repetido nunca cobra dos veces):
--   · video          — el primero de cada proyecto en el mes. Cada plan trae sus videos al mes (15 · 30 · 100); Gratis, el
--                      de bienvenida (uno, con todo). Pasado el cupo: «video extra», 10 créditos.
--   · fabricar       — cada vez que se fabrica; las dos primeras de un proyecto en el mes van incluidas, la 3.ª y siguientes
--                      cuestan 1 crédito.
--   · graficos       — 10 créditos por video (proyecto y mes) con gráficos. En el de bienvenida van incluidos.
--   · guion_premium 10 · storyboard 5 (cada hoja) · recorte 3 · carrusel_ia 2.
-- Créditos al mes de cada plan: 30 · 120 · 350 (antes 20 · 0 · 0).
--
-- ⚠️ EL INTERRUPTOR (cherry_ajustes › cobro): 'contar' (hoy) apunta lo que costaría SIN descontar ni bloquear nada —la venta
-- está cerrada y el revisor de Meta usa una cuenta normal—; 'cobrar' (al abrir la venta) descuenta y, si no alcanza, el
-- servidor contesta «sin_creditos». El administrador nunca paga ni tiene topes (20-administradores.sql).

create table if not exists public.cherry_ajustes (
  clave       text primary key,
  valor       jsonb not null,
  actualizado timestamptz not null default now()
);
alter table public.cherry_ajustes enable row level security;
drop policy if exists cherry_ajustes_ver on public.cherry_ajustes;
create policy cherry_ajustes_ver on public.cherry_ajustes for select to authenticated using (true);
insert into public.cherry_ajustes (clave, valor) values ('cobro', '"contar"') on conflict (clave) do nothing;

-- La escalera de planes (5-oct): videos al mes y créditos al mes
alter table public.planes add column if not exists videos_mes integer not null default 0;
update public.planes set videos_mes = 15,  creditos = 30  where plan = 'basico'  and tipo = 'plan';
update public.planes set videos_mes = 30,  creditos = 120 where plan = 'creador' and tipo = 'plan';
update public.planes set videos_mes = 100, creditos = 350 where plan = 'estudio' and tipo = 'plan';

create table if not exists public.usos (
  llave    text primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  que      text not null,
  creditos integer not null default 0,      -- lo que cuesta (en modo 'contar', lo que costaría)
  cobrado  boolean not null default false,  -- si de verdad se descontó
  proyecto uuid,
  nota     text,
  creado   timestamptz not null default now()
);
create index if not exists usos_user_creado on public.usos (user_id, creado);
create index if not exists usos_proyecto on public.usos (proyecto, que, creado);
alter table public.usos enable row level security;
drop policy if exists usos_ver on public.usos;
create policy usos_ver on public.usos for select to authenticated using (auth.uid() = user_id);

create or replace function public.modo_cobro() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select valor #>> '{}' from cherry_ajustes where clave = 'cobro'), 'contar')
$$;

-- El plan con que se cuenta (las suscripciones al día) y sus videos al mes; sin plan = gratis
create or replace function public.plan_de(p_user uuid) returns table (plan text, videos_mes integer)
language sql stable security definer set search_path = public as $$
  select coalesce(s.plan, 'gratis'),
         coalesce((select max(p.videos_mes) from planes p where p.plan = s.plan and p.tipo = 'plan'), 0)
  from (select 1) x
  left join suscripciones s on s.user_id = p_user and s.estado = any (array['activa', 'en_prueba', 'en_gracia'])
  limit 1
$$;

/* Apunta y (en modo 'cobrar') descuenta UNA lista de cobros en un solo paso: o todos o ninguno. Cada cobro:
   {llave, que, creditos, nota}. Los que ya estaban apuntados no cuentan otra vez. Devuelve {ok, cobrado, cuesta, ...} o
   {ok:false, motivo:'sin_creditos', faltan, tiene, cuesta}. Se gasta primero lo del plan y después lo extra. */
create or replace function public.gastar(p_user uuid, p_proyecto uuid, p_cobros jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  adm boolean := exists (select 1 from administradores where user_id = p_user);
  modo text := modo_cobro();
  c creditos%rowtype;
  x jsonb; nuevos jsonb := '[]'::jsonb; cuesta integer := 0; del_p integer; cobrar boolean;
begin
  -- se bloquea la fila de créditos de la cuenta: dos pedidos a la vez no se cuelan
  insert into creditos (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into c from creditos where user_id = p_user for update;
  for x in select * from jsonb_array_elements(coalesce(p_cobros, '[]'::jsonb)) loop
    if not exists (select 1 from usos where llave = x->>'llave') then
      nuevos := nuevos || jsonb_build_array(x);
      cuesta := cuesta + greatest(0, coalesce((x->>'creditos')::integer, 0));
    end if;
  end loop;
  cobrar := not adm and modo = 'cobrar' and cuesta > 0;
  if cobrar and c.del_plan + c.extra < cuesta then
    return jsonb_build_object('ok', false, 'motivo', 'sin_creditos', 'faltan', cuesta - (c.del_plan + c.extra),
                              'tiene', c.del_plan + c.extra, 'cuesta', cuesta);
  end if;
  insert into usos (llave, user_id, que, creditos, cobrado, proyecto, nota)
  select e->>'llave', p_user, e->>'que', greatest(0, coalesce((e->>'creditos')::integer, 0)), cobrar, p_proyecto,
         case when adm then 'administrador' when not cobrar and coalesce((e->>'creditos')::integer, 0) > 0 then 'modo ' || modo else e->>'nota' end
  from jsonb_array_elements(nuevos) e
  on conflict (llave) do nothing;
  if cobrar then
    del_p := least(c.del_plan, cuesta);
    update creditos set del_plan = del_plan - del_p, extra = extra - (cuesta - del_p), actualizado = now() where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true, 'cobrado', cobrar, 'cuesta', cuesta, 'admin', adm, 'modo', modo,
                            'quedan', case when cobrar then c.del_plan + c.extra - cuesta else c.del_plan + c.extra end);
end $$;

/* Una FABRICACIÓN (orchestrate): arma los cobros que tocan y los pasa a gastar().
   p_version: la firma de lo que se fabrica (repetir la misma versión no cobra otra vez).
   p_recorte: el video lleva tu recorte (gráficos «te sales» / «tú delante» o el look Selectivo): 3 créditos por video. */
drop function if exists public.cobrar_fabricacion(uuid, uuid, text, boolean);
create or replace function public.cobrar_fabricacion(p_user uuid, p_proyecto uuid, p_version text, p_graficos boolean, p_recorte boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  mes text := to_char(now() at time zone 'America/Bogota', 'YYYY-MM');
  desde timestamptz := date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
  pl record; usados integer; ya_video boolean; veces integer; bienvenida boolean := false;
  cobros jsonb := '[]'::jsonb;
begin
  select * into pl from plan_de(p_user);
  ya_video := exists (select 1 from usos where llave = 'video:' || p_proyecto || ':' || mes);
  if not ya_video then
    if pl.plan = 'gratis' then
      -- Gratis: un video de bienvenida, una sola vez en la vida de la cuenta, con todo
      bienvenida := not exists (select 1 from usos where user_id = p_user and que in ('video', 'video_extra'));
      cobros := cobros || jsonb_build_array(jsonb_build_object('llave', 'video:' || p_proyecto || ':' || mes,
        'que', case when bienvenida then 'video' else 'video_extra' end, 'creditos', case when bienvenida then 0 else 10 end,
        'nota', case when bienvenida then 'bienvenida' else null end));
    else
      -- (6-oct) los videos del historial que Cherry desmonta también gastan del cupo del mes
      select count(*) into usados from usos where user_id = p_user and que in ('video', 'video_extra', 'historial') and creado >= desde;
      cobros := cobros || jsonb_build_array(jsonb_build_object('llave', 'video:' || p_proyecto || ':' || mes,
        'que', case when usados < pl.videos_mes then 'video' else 'video_extra' end,
        'creditos', case when usados < pl.videos_mes then 0 else 10 end));
    end if;
  else
    -- el video de bienvenida sigue con todo incluido mientras sea ese mismo proyecto
    bienvenida := exists (select 1 from usos where llave = 'video:' || p_proyecto || ':' || mes and nota = 'bienvenida');
  end if;
  select count(*) into veces from usos where proyecto = p_proyecto and que = 'fabricar' and creado >= desde;
  if not exists (select 1 from usos where llave = 'fab:' || p_proyecto || ':' || coalesce(p_version, '')) or p_version is null then
    cobros := cobros || jsonb_build_array(jsonb_build_object(
      'llave', 'fab:' || p_proyecto || ':' || coalesce(p_version, gen_random_uuid()::text),
      'que', 'fabricar', 'creditos', case when veces >= 2 and not bienvenida then 1 else 0 end));
  end if;
  if p_graficos then
    cobros := cobros || jsonb_build_array(jsonb_build_object('llave', 'graf:' || p_proyecto || ':' || mes,
      'que', 'graficos', 'creditos', case when bienvenida then 0 else 10 end));
  end if;
  if p_recorte then
    cobros := cobros || jsonb_build_array(jsonb_build_object('llave', 'recorte:' || p_proyecto || ':' || mes,
      'que', 'recorte', 'creditos', case when bienvenida then 0 else 3 end));
  end if;
  return gastar(p_user, p_proyecto, cobros) || jsonb_build_object('plan', pl.plan, 'videos_mes', pl.videos_mes);
end $$;

-- Un uso suelto (guion premium, storyboard, recorte, carrusel con IA)
create or replace function public.gastar_creditos(p_user uuid, p_llave text, p_que text, p_creditos integer, p_proyecto uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return gastar(p_user, p_proyecto, jsonb_build_array(jsonb_build_object('llave', p_llave, 'que', p_que, 'creditos', p_creditos)));
end $$;

-- Solo el servidor (la llave de servicio) cobra
revoke all on function public.gastar(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.cobrar_fabricacion(uuid, uuid, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.gastar_creditos(uuid, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.plan_de(uuid) from public, anon, authenticated;
grant execute on function public.gastar(uuid, uuid, jsonb) to service_role;
grant execute on function public.cobrar_fabricacion(uuid, uuid, text, boolean, boolean) to service_role;
grant execute on function public.gastar_creditos(uuid, text, text, integer, uuid) to service_role;
grant execute on function public.plan_de(uuid) to service_role;

-- Lo que la página muestra: cuántos videos van este mes (el de bienvenida cuenta como el de Gratis)
create or replace view public.mis_usos_mes with (security_invoker = true) as
  select u.user_id,
         count(*) filter (where u.que in ('video', 'video_extra')) as videos,
         count(*) filter (where u.que = 'video_extra') as videos_extra,
         coalesce(sum(u.creditos) filter (where u.cobrado), 0) as creditos_gastados
  from usos u
  where u.creado >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
  group by u.user_id;
grant select on public.mis_usos_mes to authenticated;

-- Si lo que se cobró no salió (el dibujo o el guion fallaron), se devuelve: los créditos vuelven a la bolsa «extra»
-- (la que no vence) y el uso se borra. Devuelve los créditos devueltos.
create or replace function public.devolver_uso(p_llave text) returns integer
language plpgsql security definer set search_path = public as $$
declare u usos%rowtype;
begin
  delete from usos where llave = p_llave returning * into u;
  if not found then return 0; end if;
  if u.cobrado and u.creditos > 0 then
    update creditos set extra = extra + u.creditos, actualizado = now() where user_id = u.user_id;
    return u.creditos;
  end if;
  return 0;
end $$;
revoke all on function public.devolver_uso(text) from public, anon, authenticated;
grant execute on function public.devolver_uso(text) to service_role;

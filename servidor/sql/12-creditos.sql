-- 12-creditos.sql (3-oct-2026) — los planes que decidió Sergio y los créditos.
--
-- · `planes` ahora también tiene los PAQUETES de créditos (tipo = 'paquete'), y cada fila dice cuántos créditos da:
--   el plan Basic da 20 al mes; un paquete da los suyos una sola vez. Los slugs internos siguen siendo basico /
--   creador / estudio (el guion calco usa Opus con 'estudio'). Los dos provisionales (Creador 19, Estudio 49) quedaron
--   archivados en Paddle y salen de aquí.
-- · `creditos`: el saldo de cada cuenta en DOS bolsas. `del_plan` se repone cada mes con el plan (no se acumula);
--   `extra` son los paquetes y no vencen. Se gasta primero del plan (eso lo hace el servidor cuando se cuenten los usos).
-- · `creditos_movimientos`: cada cosa que suma o repone créditos, con su transacción de Paddle como llave ÚNICA, para que
--   un aviso repetido nunca regale créditos dobles. Las dos funciones de abajo hacen el apunte y la suma en un solo paso.

alter table planes add column if not exists tipo text not null default 'plan';
alter table planes add column if not exists creditos integer not null default 0;
do $$ begin
  alter table planes add constraint planes_tipo_ok check (tipo in ('plan', 'paquete'));
exception when duplicate_object then null; end $$;

delete from planes where price_id in ('pri_01m37mggxjrjeb0133t0tgdp1w', 'pri_01m37mghxcpw59pbjj74nn564s');
insert into planes (price_id, plan, nombre, vinetas_mes, entorno, tipo, creditos) values
  ('pri_01m42d69wc7zkm2sr0ym4f23vy', 'basico',  'Basic',         32, 'sandbox', 'plan',     20),
  ('pri_01m42d6a0njr6p3drhxqzj2wbe', 'creador', 'Creator',       48, 'sandbox', 'plan',      0),
  ('pri_01m42d6a4yjd57rtsqf16wddvk', 'estudio', 'Studio',       160, 'sandbox', 'plan',      0),
  ('pri_01m42d6a9xtwbyawa7p9yspgvk', 'paquete', '60 créditos',    0, 'sandbox', 'paquete',  60),
  ('pri_01m42d6abpydz50kpvb8q7gh6q', 'paquete', '150 créditos',   0, 'sandbox', 'paquete', 150),
  ('pri_01m42d6adsvkctgd2znq8hdwfp', 'paquete', '400 créditos',   0, 'sandbox', 'paquete', 400)
on conflict (price_id) do update set plan = excluded.plan, nombre = excluded.nombre, vinetas_mes = excluded.vinetas_mes,
  entorno = excluded.entorno, tipo = excluded.tipo, creditos = excluded.creditos;

create table if not exists creditos (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  del_plan    integer not null default 0,
  extra       integer not null default 0,
  repuesto_el timestamptz,
  actualizado timestamptz not null default now()
);
alter table creditos enable row level security;
do $$ begin
  create policy creditos_ver on creditos for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create table if not exists creditos_movimientos (
  llave    text primary key,          -- la transacción de Paddle (txn_…) o lo que identifique el movimiento
  user_id  uuid not null references auth.users (id) on delete cascade,
  bolsa    text not null check (bolsa in ('del_plan', 'extra')),
  cantidad integer not null,
  price_id text,
  nota     text,
  creado   timestamptz not null default now()
);
alter table creditos_movimientos enable row level security;
do $$ begin
  create policy creditos_movimientos_ver on creditos_movimientos for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Un paquete comprado: suma a `extra`. Devuelve false si esa transacción ya se había sumado.
create or replace function sumar_paquete(p_user uuid, p_llave text, p_price text, p_creditos integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into creditos_movimientos (llave, user_id, bolsa, cantidad, price_id, nota)
  values (p_llave, p_user, 'extra', p_creditos, p_price, 'paquete') on conflict (llave) do nothing;
  if not found then return false; end if;
  insert into creditos (user_id, extra) values (p_user, p_creditos)
  on conflict (user_id) do update set extra = creditos.extra + p_creditos, actualizado = now();
  return true;
end $$;

-- Un mes pagado del plan: los créditos del plan VUELVEN a su número (no se acumulan). Devuelve false si ya se hizo.
create or replace function reponer_plan(p_user uuid, p_llave text, p_price text, p_creditos integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into creditos_movimientos (llave, user_id, bolsa, cantidad, price_id, nota)
  values (p_llave, p_user, 'del_plan', p_creditos, p_price, 'mes del plan') on conflict (llave) do nothing;
  if not found then return false; end if;
  insert into creditos (user_id, del_plan, repuesto_el) values (p_user, p_creditos, now())
  on conflict (user_id) do update set del_plan = p_creditos, repuesto_el = now(), actualizado = now();
  return true;
end $$;

-- Solo el servidor (la llave de servicio) llama estas dos.
revoke all on function sumar_paquete(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function reponer_plan(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function sumar_paquete(uuid, text, text, integer) to service_role;
grant execute on function reponer_plan(uuid, text, text, integer) to service_role;

-- Lo que ve cada cuenta de su plan: el de siempre más sus créditos.
create or replace view mi_plan with (security_invoker = true) as
  select s.user_id, s.plan, s.estado, s.renueva_el, s.termina_el,
         coalesce(p.nombre, 'Sin plan') as nombre,
         coalesce(p.vinetas_mes, 0) as vinetas_mes,
         s.estado = any (array['activa', 'en_prueba']) as al_dia
  from suscripciones s left join planes p on p.price_id = s.price_id;

create or replace view mis_creditos with (security_invoker = true) as
  select user_id, del_plan, extra, del_plan + extra as total, repuesto_el from creditos;

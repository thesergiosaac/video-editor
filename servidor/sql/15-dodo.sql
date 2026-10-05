-- 15 · Dodo Payments (5-oct-2026). Paddle no aprobó cherrysweet.app («IA generativa creativa») y Sergio decidió cobrar con
-- Dodo aunque Paddle apruebe la apelación: Dodo tiene los productos con IA dentro de lo que acepta. Todo lo de Paddle se queda
-- (tablas, funciones y filas), sin usarse.
--
-- · `planes`: los productos de Dodo van como filas nuevas con entorno 'dodo_test' (modo de prueba) o 'dodo_live'. En Dodo el
--   precio va DENTRO del producto, así que `price_id` guarda el id del producto (pdt_…).
-- · `suscripciones`: de qué pasarela es cada una y los ids de Dodo (cliente y suscripción).
-- · `dodo_avisos`: cada aviso de Dodo por su `webhook-id`, para que uno repetido no haga nada dos veces.

alter table suscripciones add column if not exists pasarela text not null default 'paddle';
alter table suscripciones add column if not exists dodo_customer_id text;
alter table suscripciones add column if not exists dodo_subscription_id text;
create index if not exists suscripciones_dodo_sub on suscripciones (dodo_subscription_id);
create index if not exists suscripciones_dodo_cli on suscripciones (dodo_customer_id);

create table if not exists dodo_avisos (
  webhook_id text primary key,
  tipo       text,
  cuerpo     jsonb,
  recibido   timestamptz not null default now()
);
alter table dodo_avisos enable row level security;
revoke all on dodo_avisos from anon, authenticated;

-- «Tu plan» necesita saber con qué pasarela se paga (para el portal y el texto del extracto). Solo se agrega al final.
create or replace view mi_plan with (security_invoker = true) as
  select s.user_id, s.plan, s.estado, s.renueva_el, s.termina_el,
         coalesce(p.nombre, 'Sin plan') as nombre,
         coalesce(p.vinetas_mes, 0) as vinetas_mes,
         s.estado = any (array['activa', 'en_prueba']) as al_dia,
         (s.estado = any (array['activa', 'en_prueba']) and s.renueva_el is null and s.termina_el is not null) as cancelado,
         s.paddle_customer_id,
         s.pasarela
  from suscripciones s left join planes p on p.price_id = s.price_id;

-- Cada CAMBIO de plan pedido desde «Tu plan» lleva una marca (cambio_id) en su cobro. El aviso de Dodo la usa para saber que
-- ese cobro es un cambio y no un mes nuevo (los cambios no tocan los créditos). La marca se ata al primer pago que la trae.
create table if not exists dodo_cambios (
  cambio_id uuid primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  plan      text,
  pago      text,
  creado    timestamptz not null default now()
);
alter table dodo_cambios enable row level security;
revoke all on dodo_cambios from anon, authenticated;
-- Si el cobro del cambio NO pasa (tarjeta sin fondos), el aviso apunta por qué: «Tu plan» lo dice en vez de esperar.
alter table dodo_cambios add column if not exists fallo text;

-- (5-oct, Sergio: «hagamos todas tus recomendaciones») DÍAS DE GRACIA: si falla el cobro del mes, Dodo pone la suscripción
-- «past_due» unos días (3) mientras reintenta. En Cherry eso es 'en_gracia': el plan SIGUE (cuenta como al día) y se avisa
-- hasta cuándo (`gracia_hasta`). Si no paga, Dodo la pasa a «on_hold» ('en_mora') y ahí sí se apaga.
alter table suscripciones add column if not exists gracia_hasta timestamptz;
create or replace view mi_plan with (security_invoker = true) as
  select s.user_id, s.plan, s.estado, s.renueva_el, s.termina_el,
         coalesce(p.nombre, 'Sin plan') as nombre,
         coalesce(p.vinetas_mes, 0) as vinetas_mes,
         s.estado = any (array['activa', 'en_prueba', 'en_gracia']) as al_dia,
         (s.estado = any (array['activa', 'en_prueba', 'en_gracia']) and s.renueva_el is null and s.termina_el is not null) as cancelado,
         s.paddle_customer_id,
         s.pasarela,
         s.gracia_hasta
  from suscripciones s left join planes p on p.price_id = s.price_id;

-- La gracia que se vence sin que llegue otro aviso: cada hora, quien sigue 'en_gracia' con la fecha ya pasada se pausa
-- ('en_mora'): sin plan, sin tope del plan y sin créditos del plan. Sus videos y los créditos de paquetes se quedan.
-- `gracia_hasta` se deja puesta: así un aviso repetido de Dodo no le vuelve a dar los 3 días.
create or replace function vencer_gracias() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with v as (
    update suscripciones set estado = 'en_mora', plan = 'ninguno', actualizado = now()
    where estado = 'en_gracia' and gracia_hasta is not null and gracia_hasta < now()
    returning user_id
  ), t as (delete from vinetas_tope where user_id in (select user_id from v)),
     c as (update creditos set del_plan = 0, actualizado = now() where user_id in (select user_id from v))
  select count(*) into n from v;
  return n;
end $$;
revoke all on function vencer_gracias() from public, anon, authenticated;
select cron.schedule('gracia-vence', '20 * * * *', $$ select vencer_gracias(); $$);

-- ══ Las suscripciones de Paddle ══════════════════════════════════════════════════════════════
--
-- Paddle es el vendedor registrado: cobra, factura y avisa. Aquí solo se guarda el resultado de
-- ese aviso, que es lo que decide si alguien entra o no.
--
-- ⚠️ SIN `check` CON LISTAS DE VALORES. La tabla `herramientas_datos` tiene uno y cuando falta un
-- valor la base rechaza el guardado EN SILENCIO: costó media tarde encontrarlo. Si mañana Paddle
-- inventa un estado nuevo, prefiero guardarlo y verlo a que se pierda el aviso.

-- ── Qué plan es cada precio ───────────────────────────────────────────────────────────────────
-- Va en una tabla y no en el código porque los identificadores de sandbox y los de la cuenta real
-- son distintos: pasar a producción es un INSERT, no un despliegue.
create table if not exists public.planes (
  price_id     text primary key,
  plan         text        not null,           -- creador | estudio
  nombre       text        not null,
  vinetas_mes  integer     not null,
  entorno      text        not null,           -- sandbox | vivo
  creado       timestamptz not null default now()
);

insert into public.planes (price_id, plan, nombre, vinetas_mes, entorno) values
  ('pri_01m37mggxjrjeb0133t0tgdp1w', 'creador', 'Cherry Creador',  45, 'sandbox'),
  ('pri_01m37mghxcpw59pbjj74nn564s', 'estudio', 'Cherry Estudio', 200, 'sandbox')
on conflict (price_id) do update
  set plan = excluded.plan, nombre = excluded.nombre,
      vinetas_mes = excluded.vinetas_mes, entorno = excluded.entorno;

-- ── La suscripción de cada cuenta ─────────────────────────────────────────────────────────────
create table if not exists public.suscripciones (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  plan                   text        not null default 'ninguno',
  estado                 text        not null default 'sin_plan',
  -- lo que dice Paddle, tal cual, para poder rastrear cualquier cobro
  paddle_customer_id     text,
  paddle_subscription_id text,
  price_id               text,
  renueva_el             timestamptz,   -- próximo cobro
  termina_el             timestamptz,   -- si canceló: hasta cuándo tiene acceso pagado
  actualizado            timestamptz not null default now()
);

create index if not exists suscripciones_paddle_idx
  on public.suscripciones (paddle_subscription_id);

-- ── Los avisos que ya se atendieron ───────────────────────────────────────────────────────────
-- Paddle reintenta un aviso hasta que le respondas 200, y a veces manda el mismo dos veces. Sin
-- esto, un reintento podría volver a encender un plan que se acaba de apagar.
create table if not exists public.paddle_avisos (
  event_id   text primary key,
  tipo       text        not null,
  recibido   timestamptz not null default now(),
  cuerpo     jsonb
);

-- ── Quién puede ver qué ───────────────────────────────────────────────────────────────────────
-- Igual que `vinetas_uso`: cada quien ve lo suyo y nadie escribe desde el navegador. Lo único
-- que escribe es la función del servidor, que va con la llave de servicio y se salta esto.
alter table public.planes        enable row level security;
alter table public.suscripciones enable row level security;
alter table public.paddle_avisos enable row level security;

drop policy if exists suscripciones_ver on public.suscripciones;
create policy suscripciones_ver on public.suscripciones
  for select using (auth.uid() = user_id);

-- El catálogo de planes lo puede leer cualquiera con sesión: es lo que pinta los precios dentro
-- de la aplicación, y no tiene nada secreto.
drop policy if exists planes_ver on public.planes;
create policy planes_ver on public.planes
  for select to authenticated using (true);

-- `paddle_avisos` se queda sin políticas a propósito: nadie lo lee desde el navegador.

-- ── Lo que ve la aplicación ───────────────────────────────────────────────────────────────────
-- Una sola pregunta, con el nombre del plan ya resuelto, para no repetir el cruce en cada sitio.
create or replace view public.mi_plan
with (security_invoker = true) as
  select s.user_id, s.plan, s.estado, s.renueva_el, s.termina_el,
         coalesce(p.nombre, 'Sin plan')  as nombre,
         coalesce(p.vinetas_mes, 0)      as vinetas_mes,
         (s.estado in ('activa', 'en_prueba')) as al_dia
    from public.suscripciones s
    left join public.planes p on p.price_id = s.price_id;

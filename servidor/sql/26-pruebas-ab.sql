-- 26 (23-oct-2026) — Pruebas A/B de ganchos. Sergio: «el mismo video pero cambiarle el gancho… publicarlas como reel de prueba
-- y la que le vaya mejor ya se publica en el perfil». Plan: https://claude.ai/artifact/BSXEqB58LoWAGYkM2ssJBr (parte 1: la
-- pantalla y los ganchos de TEXTO). Cada prueba es una fila; sus 2 o 3 versiones van en `versiones` (jsonb):
--   [{ letra:'A', gancho:'el texto', tarjeta:'https://…png', video:'https://…mp4', publicacion:'uuid', ig_media_id, enlace,
--      numeros:{vistas, omision, visto_medio, alcance, …}, medido:'fecha' }]
-- Quien la mueve de estado es la función `pruebas-ab` (con la llave del servidor): la persona solo LEE lo suyo.
-- Estados: master (esperando la calidad original) → fabricando (poniendo el texto encima) → publicando (en el reloj de
-- ig-publicar) → en_prueba (48 h) → lista (ganó una) · fallida · cancelada · ensayo (prueba interna: se fabrica y no se publica).
create table if not exists public.pruebas_ab (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  marca         text,
  ig_user_id    text        not null,
  project_id    uuid,
  render_id     uuid,                       -- el video del que salen las versiones (su master)
  fuente        text,                       -- la dirección del master, o la llave de su archivo original (tal cual)
  titulo        text,
  tapa          text,                       -- la carátula del proyecto, para la lista
  tipo          text        not null default 'texto' check (tipo in ('texto', 'visual', 'sonido', 'hablado')),
  texto         text,                       -- lo que dice la publicación: el mismo en todas las versiones
  versiones     jsonb       not null default '[]'::jsonb,
  estado        text        not null default 'fabricando',
  publicar_el   timestamptz,
  empezo        timestamptz,                -- cuando salió la última versión
  termina       timestamptz,                -- empezo + 48 h (+24 una vez si hay muy pocas vistas)
  prorroga      boolean     not null default false,
  ganadora      text,
  resultado     jsonb,
  visto         boolean     not null default false,   -- ya vio el resultado
  pasada        boolean     not null default false,   -- dice que ya pasó la ganadora a su perfil
  ensayo        boolean     not null default false,
  error         text,
  creada        timestamptz not null default now(),
  actualizada   timestamptz not null default now()
);

create index if not exists pruebas_ab_mias_idx on public.pruebas_ab (user_id, creada desc);
-- El reloj pregunta por esto cada 5 minutos: que sea barato.
create index if not exists pruebas_ab_vivas_idx on public.pruebas_ab (estado) where estado in ('master', 'fabricando', 'publicando', 'en_prueba');

alter table public.pruebas_ab enable row level security;
drop policy if exists pruebas_ab_ver on public.pruebas_ab;
create policy pruebas_ab_ver on public.pruebas_ab for select using (auth.uid() = user_id);

-- El reloj: cada 5 minutos, SOLO si hay alguna prueba andando. La llave es la del reloj de ig-publicar y se lee de su tarea:
-- nunca se escribe aquí.
select cron.unschedule('pruebas-ab-reloj') where exists (select 1 from cron.job where jobname = 'pruebas-ab-reloj');
select cron.schedule('pruebas-ab-reloj', '*/5 * * * *', $cmd$
  select net.http_post(
    url := 'https://xsptcepijtnmowqauyxw.supabase.co/functions/v1/pruebas-ab',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('accion', 'reloj', 'llave', substring((select command from cron.job where jobname = 'ig-publicar') from '"llave":"([^"]+)"')))
  where exists (select 1 from public.pruebas_ab where estado in ('master', 'fabricando', 'publicando', 'en_prueba'))
$cmd$);

-- (22-oct-2026) Cuándo se cierra y se conecta cada cuenta de Instagram. Sergio: «me la cierran a cada rato».
-- La escriben historial (al ver que Instagram cerró la sesión) e ig-conectar (al conectar). Solo el servidor.
create table if not exists instagram_sesiones (
  id bigserial primary key,
  user_id uuid not null,
  ig_user_id text not null,
  usuario text,
  evento text not null check (evento in ('cerrada', 'conectada')),
  cuando timestamptz not null default now(),
  detalle text,
  funcion text
);
create index if not exists instagram_sesiones_cuenta on instagram_sesiones (ig_user_id, cuando desc);
alter table instagram_sesiones enable row level security;

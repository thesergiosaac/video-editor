-- 14 · Los números de la CUENTA de Instagram (4-oct-2026), para la tarjeta «Tu cuenta» del inicio.
-- ig-metricas › modo «cuenta» los pide a Instagram (alcance, quién te descubre, interacción, perfil, seguidores nuevos)
-- y los guarda aquí 6 horas, para no preguntarle a Instagram cada vez que alguien abre el inicio.
-- Solo los lee y escribe el servidor (llave de servicio): la tabla no tiene permisos para nadie más.
create table if not exists ig_cuenta_resumen (
  ig_user_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  datos jsonb not null,
  medido timestamptz not null default now()
);
alter table ig_cuenta_resumen enable row level security;
revoke all on ig_cuenta_resumen from anon, authenticated;

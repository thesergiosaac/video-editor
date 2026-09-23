-- ════════════════════════════════════════════════════════════════════════════════════════
-- El contador de viñetas (23-sep-2026)
--
-- Sergio decidió pagar el modelo bueno y ponerle un tope a cada cuenta: 45 viñetas al mes,
-- repartidas entre todas sus marcas.
--
-- ⚠️ Por qué una tabla aparte y no un campo en `herramientas_datos`: esa tabla la escribe el
-- navegador, y un tope que escribe el navegador lo puede borrar el navegador. Aquí el usuario
-- solo puede MIRAR su gasto; escribir solo lo hace el servidor, que usa la llave de servicio y
-- se salta RLS.
-- ════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.vinetas_uso (
  user_id   uuid    not null references auth.users(id) on delete cascade,
  mes       text    not null,              -- '2026-09' — el mes en UTC, igual que el corte de Cloudflare
  vinetas   integer not null default 0,
  creditos  integer not null default 0,    -- lo que costó de verdad, por si cambia el modelo
  primary key (user_id, mes)
);

alter table public.vinetas_uso enable row level security;

-- Mirar su propio gasto, para poder pintarle «te quedan N». Nada más.
drop policy if exists vinetas_uso_ver on public.vinetas_uso;
create policy vinetas_uso_ver on public.vinetas_uso
  for select using (auth.uid() = user_id);

-- ── El tope de cada cuenta ──────────────────────────────────────────────────────────────
-- Hoy son 45 al mes para todos. Más adelante habrá planes —uno gratis con una marca y un par
-- de créditos, uno básico, otros con más marcas o sin tope— y cada plan escribirá aquí el
-- número que le toque a esa cuenta.
--
-- Sin fila = el tope de siempre, el que trae el servidor por defecto. Así el día que existan
-- los planes se cambia una fila, no el código.
create table if not exists public.vinetas_tope (
  user_id  uuid    not null primary key references auth.users(id) on delete cascade,
  tope_mes integer not null,               -- viñetas al mes; 0 = ninguna, -1 = sin tope
  nota     text                            -- de dónde salió: «plan pro», «recarga de sep», …
);

alter table public.vinetas_tope enable row level security;

-- El usuario ve su tope (para pintarle «te quedan N de 45»); cambiarlo, solo el servidor.
drop policy if exists vinetas_tope_ver on public.vinetas_tope;
create policy vinetas_tope_ver on public.vinetas_tope
  for select using (auth.uid() = user_id);

-- ── Apuntar una viñeta ──────────────────────────────────────────────────────────────────
-- Suma de una en una y devuelve el total del mes. Va en una sola sentencia para que dos
-- dibujos a la vez no se pisen: si se leyera y luego se escribiera, el segundo borraría al
-- primero y la gente dibujaría de más.
--
-- Recibe el usuario por parámetro (no auth.uid()) porque quien la llama es el servidor con la
-- llave de servicio, y ahí auth.uid() viene vacío.
create or replace function public.vineta_apuntar(p_user uuid, p_creditos integer)
returns table (vinetas integer, creditos integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  return query
  insert into public.vinetas_uso as u (user_id, mes, vinetas, creditos)
  values (p_user, v_mes, 1, greatest(coalesce(p_creditos, 0), 0))
  on conflict (user_id, mes) do update
     set vinetas  = u.vinetas  + 1,
         creditos = u.creditos + excluded.creditos
  returning u.vinetas, u.creditos;
end $$;

-- Que no la pueda llamar el navegador: el que apunta es el servidor.
--
-- ⚠️ El `grant` de abajo NO sobra. Postgres le da EXECUTE a PUBLIC por defecto, y `service_role`
-- lo tiene por ahí: al quitárselo a PUBLIC se lo quitamos también al servidor. Sin esa línea el
-- contador falla en silencio —el dibujo sale, la viñeta no se apunta— y el tope no serviría de
-- nada.
revoke execute on function public.vineta_apuntar(uuid, integer) from public, anon, authenticated;
grant  execute on function public.vineta_apuntar(uuid, integer) to service_role;

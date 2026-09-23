-- ════════════════════════════════════════════════════════════════════════════════════════
-- Apuntar VARIAS viñetas de una vez (23-sep-2026)
--
-- Con las tiras de tres, un dibujo trae tres viñetas: el contador tiene que sumar tres, no
-- una. Y los créditos van aparte porque ya no guardan relación con el número de viñetas —
-- una tira de tres cuesta 1.272 créditos, la tercera parte de lo que costaba UNA suelta.
-- ════════════════════════════════════════════════════════════════════════════════════════

drop function if exists public.vineta_apuntar(uuid, integer);

create or replace function public.vineta_apuntar(p_user uuid, p_vinetas integer, p_creditos integer)
returns table (vinetas integer, creditos integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_n   integer := greatest(coalesce(p_vinetas, 1), 1);
begin
  return query
  insert into public.vinetas_uso as u (user_id, mes, vinetas, creditos)
  values (p_user, v_mes, v_n, greatest(coalesce(p_creditos, 0), 0))
  on conflict (user_id, mes) do update
     set vinetas  = u.vinetas  + excluded.vinetas,
         creditos = u.creditos + excluded.creditos
  returning u.vinetas, u.creditos;
end $$;

-- ⚠️ Igual que antes: quitárselo a PUBLIC se lo quita también al servidor, y sin el grant el
-- contador fallaría en silencio.
revoke execute on function public.vineta_apuntar(uuid, integer, integer) from public, anon, authenticated;
grant  execute on function public.vineta_apuntar(uuid, integer, integer) to service_role;

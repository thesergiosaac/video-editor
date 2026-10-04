-- 13 · Lo que pasa DESPUÉS de comprar (4-oct-2026). Sergio decidió: impuestos aparte, cambiar de plan de una (Paddle cobra o
-- abona la diferencia), cancelar al final del mes pagado, y las devoluciones quitan los créditos del paquete devuelto.

-- Devolución de un paquete: se quitan sus créditos de la bolsa «extra» (los que queden; nunca baja de 0).
-- La llave es el ajuste de Paddle (adj_…): un aviso repetido no quita dos veces.
create or replace function quitar_paquete(p_user uuid, p_llave text, p_price text, p_creditos integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into creditos_movimientos (llave, user_id, bolsa, cantidad, price_id, nota)
  values (p_llave, p_user, 'extra', -abs(p_creditos), p_price, 'devolución') on conflict (llave) do nothing;
  if not found then return false; end if;
  update creditos set extra = greatest(0, extra - abs(p_creditos)), actualizado = now() where user_id = p_user;
  return true;
end $$;

-- Devolución de un mes de plan: los créditos de ese mes se van (la llave también es el ajuste).
create or replace function quitar_mes(p_user uuid, p_llave text, p_price text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into creditos_movimientos (llave, user_id, bolsa, cantidad, price_id, nota)
  values (p_llave, p_user, 'del_plan', 0, p_price, 'devolución del mes') on conflict (llave) do nothing;
  if not found then return false; end if;
  update creditos set del_plan = 0, actualizado = now() where user_id = p_user;
  return true;
end $$;

revoke all on function quitar_paquete(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function quitar_mes(uuid, text, text) from public, anon, authenticated;
grant execute on function quitar_paquete(uuid, text, text, integer) to service_role;
grant execute on function quitar_mes(uuid, text, text) to service_role;

-- «Tu plan» necesita saber si la cancelación está programada (sigue activa pero ya no renueva).
create or replace view mi_plan with (security_invoker = true) as
  select s.user_id, s.plan, s.estado, s.renueva_el, s.termina_el,
         coalesce(p.nombre, 'Sin plan') as nombre,
         coalesce(p.vinetas_mes, 0) as vinetas_mes,
         s.estado = any (array['activa', 'en_prueba']) as al_dia,
         (s.estado = any (array['activa', 'en_prueba']) and s.renueva_el is null and s.termina_el is not null) as cancelado
  from suscripciones s left join planes p on p.price_id = s.price_id;

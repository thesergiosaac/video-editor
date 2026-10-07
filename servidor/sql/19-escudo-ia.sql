-- 19 (6-oct-2026) — EL ESCUDO DE LAS RESPUESTAS CON IA (fase 4 del plan del martes, aprobado el 5-oct).
-- Las respuestas automáticas (ig-aviso) escriben con IA cada comentario. Una publicación que se vuelve viral podría
-- pedir miles: pasadas 3.000 respuestas con IA en el mes, la cuenta sigue respondiendo con su texto fijo (gratis).
-- Cada respuesta con IA se apunta en `usos` ('respuesta_ia', 0 créditos). El administrador no tiene topes.
-- No depende del interruptor de cobro: es un seguro de costo para todos.

create or replace function public.escudo_ia(p_ig text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid; n integer; tope integer := 3000;
begin
  select user_id into u from cuentas_instagram where ig_user_id = p_ig and estado = 'activa' limit 1;
  if u is null then return jsonb_build_object('lleno', false); end if;
  if exists (select 1 from administradores where user_id = u) then return jsonb_build_object('lleno', false, 'admin', true); end if;
  select count(*) into n from usos where user_id = u and que = 'respuesta_ia'
    and creado >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
  return jsonb_build_object('lleno', n >= tope, 'usadas', n, 'tope', tope);
end $$;

create or replace function public.apuntar_respuesta_ia(p_ig text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  select user_id into u from cuentas_instagram where ig_user_id = p_ig and estado = 'activa' limit 1;
  if u is null then return; end if;
  insert into usos (llave, user_id, que, creditos, nota) values ('resp:' || gen_random_uuid(), u, 'respuesta_ia', 0, p_ig);
end $$;

revoke all on function public.escudo_ia(text) from public, anon, authenticated;
revoke all on function public.apuntar_respuesta_ia(text) from public, anon, authenticated;
grant execute on function public.escudo_ia(text) to service_role;
grant execute on function public.apuntar_respuesta_ia(text) to service_role;

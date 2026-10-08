-- 23 (8-oct-2026) — LA REGLA DE LOS REEMBOLSOS: la opción B «muy estricta» que decidió Sergio el 8-oct, para que nadie use
-- Cherry a fondo y después pida la plata. Lo mismo dice reembolsos.html; si cambia una, cambia la otra.
--   · Plan: solo el PRIMER pago de la PRIMERA suscripción, dentro de 14 días, y desde ese cobro como máximo 2 videos fabricados
--     (cada vez que se fabrica cuenta, también rehacer el mismo) y UNA vez cada cosa: gráficos animados, recorte, guion
--     premium, storyboard (la hoja o redibujar una viñeta), carrusel con IA y desmontar un video del historial.
--   · Paquete de créditos: dentro de 14 días y sin haber usado NADA que gaste créditos desde la compra.
--   · Una sola vez por persona: si ya hubo una devolución, no hay otra.
--   · Las renovaciones no se devuelven. Los errores nuestros (cobro doble, caída larga) se devuelven siempre: eso no lo mide
--     esta función, lo decide Sergio.
-- Uso (solo el servidor):  select revisar_reembolso('correo@cliente.com');            -- su última compra
--                          select revisar_reembolso('correo@cliente.com', 'pay_…');   -- una compra en particular
-- Devuelve qué compra es, cuánto usó desde el cobro, si cumple y por qué no.

create or replace function public.revisar_reembolso(p_correo text, p_pago text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid; c record; usado jsonb; motivos text[] := '{}'; dias numeric; n integer; es_plan boolean;
  una_vez constant text[][] := array[['graficos', 'gráficos animados'], ['recorte', 'el recorte de su silueta'],
    ['guion_premium', 'el guion premium'], ['storyboard', 'el storyboard'], ['carrusel_ia', 'el carrusel con IA'],
    ['historial', 'desmontar un video de su historial']];
  i integer;
begin
  select id into u from auth.users where lower(email) = lower(trim(p_correo));
  if u is null then
    return jsonb_build_object('cumple', false, 'motivos', jsonb_build_array('No hay ninguna cuenta de Cherry con ese correo.'));
  end if;
  select * into c from creditos_movimientos
    where user_id = u and cantidad > 0 and nota in ('mes del plan', 'paquete') and (p_pago is null or llave = p_pago)
    order by creado desc limit 1;
  if not found then
    return jsonb_build_object('cumple', false, 'motivos', jsonb_build_array('No encontramos esa compra en su cuenta.'));
  end if;
  es_plan := c.nota = 'mes del plan';
  dias := round((extract(epoch from now() - c.creado) / 86400)::numeric, 1);

  -- lo que usó desde el cobro (la hoja del storyboard y redibujar una viñeta cuentan juntas)
  select coalesce(jsonb_object_agg(q, veces), '{}'::jsonb) into usado from (
    select case when que = 'storyboard_vineta' then 'storyboard' else que end as q, count(*) as veces
    from usos where user_id = u and creado >= c.creado group by 1) x;

  if dias > 14 then motivos := motivos || format('Pasaron %s días desde el cobro (el plazo es de 14).', dias); end if;
  select count(*) into n from creditos_movimientos where user_id = u and nota like 'devoluci%';
  if n > 0 then motivos := motivos || 'Ya tuvo una devolución antes: el reembolso es una sola vez por persona.'::text; end if;

  if es_plan then
    if exists (select 1 from creditos_movimientos where user_id = u and nota = 'mes del plan' and creado < c.creado) then
      motivos := motivos || 'No es el primer pago de su primera suscripción (las renovaciones no se devuelven).'::text;
    end if;
    n := coalesce((usado ->> 'fabricar')::integer, 0);
    if n > 2 then motivos := motivos || format('Fabricó %s veces (el máximo es 2).', n); end if;
    for i in 1 .. array_length(una_vez, 1) loop
      n := coalesce((usado ->> una_vez[i][1])::integer, 0);
      if n > 1 then motivos := motivos || format('Usó %s %s veces (el máximo es 1).', una_vez[i][2], n); end if;
    end loop;
  else
    select count(*) into n from usos where user_id = u and creado >= c.creado and creditos > 0;
    if n > 0 then motivos := motivos || format('Desde la compra usó %s %s que gasta%s créditos (para un paquete, ninguna).', n,
      case when n = 1 then 'cosa' else 'cosas' end, case when n = 1 then '' else 'n' end); end if;
  end if;

  return jsonb_build_object(
    'cumple', coalesce(array_length(motivos, 1), 0) = 0,
    'motivos', to_jsonb(motivos),
    'compra', jsonb_build_object('pago', c.llave, 'que', case when es_plan then 'plan' else 'paquete' end,
      'producto', c.price_id, 'fecha', c.creado, 'dias', dias),
    'uso_desde_el_cobro', usado,
    'administrador', exists (select 1 from administradores where user_id = u));
end $$;

revoke all on function public.revisar_reembolso(text, text) from public, anon, authenticated;
grant execute on function public.revisar_reembolso(text, text) to service_role;

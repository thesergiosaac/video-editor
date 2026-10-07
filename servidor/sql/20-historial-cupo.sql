-- 20 (6-oct-2026) — EL HISTORIAL GASTA DEL CUPO DE VIDEOS (fase 4 del plan del martes, aprobado el 5-oct).
-- «Cherry lee tu historial» desmonta tus reels publicados (Lambda + IA). Cada uno cuenta como un video del mes del plan
-- (`usos` › 'historial', 0 créditos): así un historial de 400 reels no se come el costo de 400 videos sin tope.
-- Con el cobro en 'cobrar', cuando se llena el cupo del mes los que faltan esperan al mes siguiente (no gastan créditos).
-- Con 'contar' (hoy) no hay tope. El administrador no tiene topes.

create or replace function public.cupo_historial(p_user uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare pl record; usados integer;
begin
  if exists (select 1 from administradores where user_id = p_user) or modo_cobro() <> 'cobrar' then return 1000000; end if;
  select * into pl from plan_de(p_user);
  select count(*) into usados from usos where user_id = p_user and que in ('video', 'video_extra', 'historial')
    and creado >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
  return greatest(0, pl.videos_mes - usados);
end $$;
revoke all on function public.cupo_historial(uuid) from public, anon, authenticated;
grant execute on function public.cupo_historial(uuid) to service_role;

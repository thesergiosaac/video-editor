-- 22 (6-oct-2026) — el reloj de la limpieza: todos los días a las 3:30 a. m. de Colombia (8:30 UTC) dispara la función
-- `limpieza`, que invoca al ensamblador en modo 'limpieza'. La llave es la del reloj de ig-publicar y se lee de su tarea:
-- nunca se escribe aquí. Lo que haga depende del interruptor cherry_ajustes › limpieza ('ensayo' por defecto).
select cron.unschedule('limpieza-diaria') where exists (select 1 from cron.job where jobname = 'limpieza-diaria');
select cron.schedule('limpieza-diaria', '30 8 * * *', $cmd$
  select net.http_post(
    url := 'https://xsptcepijtnmowqauyxw.supabase.co/functions/v1/limpieza',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('llave', substring((select command from cron.job where jobname = 'ig-publicar') from '"llave":"([^"]+)"')))
$cmd$);

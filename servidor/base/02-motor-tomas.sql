-- Carrete · 16-sep-2026 · motor de tomas: estado del corte guardado en la receta del proyecto
alter table public.edit_recipes add column if not exists motor_estado text;
alter table public.edit_recipes add column if not exists motor_firma  text;
alter table public.edit_recipes add column if not exists motor_inicio timestamptz;

-- IMG_0671 tiene transcripción pero quedó marcado «transcribing» (por eso la receta vieja lo dejaba fuera)
update public.clips c
   set status = 'transcribed'
 where c.status = 'transcribing'
   and exists (select 1 from public.transcriptions t where t.clip_id = c.id and jsonb_array_length(t.words) > 0);

select
  (select string_agg(column_name, ', ') from information_schema.columns where table_schema = 'public' and table_name = 'edit_recipes' and column_name like 'motor_%') as columnas_motor,
  (select count(*) from public.clips where status = 'transcribing') as clips_aun_transcribiendo;

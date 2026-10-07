-- 21 (6-oct-2026) — BORRAR LO VIEJO EN AMAZON (fase 5 del plan del martes; camino A de «guardado», aprobado el 5-oct).
-- El 6-oct el depósito tenía 127 GB y crecía solo: nada se borraba. La limpieza la hace el ensamblador (modo 'limpieza',
-- servidor/lambda-assembler/limpieza.js) una vez al día, y cada corrida deja su informe aquí.
--
-- Las reglas (las del camino A):
--   R1 intermedios — pedazos de corte (seg_*, master_*), capas de Remotion ya usadas, recortes de la persona ya
--      montados, restos de renders fallidos y archivos sin dueño. A todos (no son topes: es basura).
--   R2 versiones viejas — del video terminado solo se guarda la última versión (más su base de la vista previa y lo que
--      esté programado o en el Calendario). A todos.
--   R3 originales — 15 días después de la última fabricación (Gratis: 3) se borran los originales, las copias livianas,
--      los recortes y las bases; se queda el video terminado. NO al administrador.
--   R4 abandonados — un proyecto que nunca se fabricó y lleva 7 días sin tocarse. NO al administrador.
--   R5 tope de espacio — 20 / 50 / 150 GB (Basic / Creator / Studio; Gratis 5): si se pasa, R3 empieza por lo más viejo.
--
-- ⚠️ EL INTERRUPTOR (cherry_ajustes › limpieza): 'ensayo' (por defecto: calcula y deja el informe, no borra NADA),
-- 'intermedios' (borra R1 y R2; R3–R5 siguen en ensayo) o 'borrar' (todo). Lo decide Sergio con el informe a la vista.

insert into public.cherry_ajustes (clave, valor) values ('limpieza', '"ensayo"') on conflict (clave) do nothing;

alter table public.projects add column if not exists originales_borrados timestamptz;

create table if not exists public.limpieza_informes (
  id      bigserial primary key,
  creado  timestamptz not null default now(),
  modo    text not null,
  resumen jsonb not null,
  detalle jsonb
);
alter table public.limpieza_informes enable row level security;
revoke all on public.limpieza_informes from anon, authenticated;

/* Todo lo que la limpieza necesita saber, en UNA consulta (sin el tope de 1.000 filas de la API) */
create or replace function public.limpieza_datos() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'modo', coalesce((select valor #>> '{}' from cherry_ajustes where clave = 'limpieza'), 'ensayo'),
    'admins', coalesce((select jsonb_agg(user_id) from administradores), '[]'::jsonb),
    'planes', coalesce((select jsonb_object_agg(s.user_id, s.plan) from suscripciones s
                         where s.estado = any (array['activa', 'en_prueba', 'en_gracia'])), '{}'::jsonb),
    'proyectos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'user', p.user_id, 'borrado', p.borrado_en,
        'originales_borrados', p.originales_borrados,
        'actividad', greatest(p.created_at, p.updated_at, p.borrador_en,
                              (select max(c.created_at) from clips c where c.project_id = p.id),
                              (select max(r.created_at) from renders r where r.project_id = p.id))))
      from projects p), '[]'::jsonb),
    'renders', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'p', r.project_id, 'st', r.status, 'c', r.created_at,
        'master', coalesce(r.subtitle_config->>'calidad', '') = 'original', 'base', coalesce(r.subtitle_config->>'base', '') = 'true'))
      from renders r), '[]'::jsonb),
    'clips', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'p', c.project_id, 'user', c.user_id,
        'claves', jsonb_build_array(c.storage_path, c.mp4_path, c.audio_path), 'mini', c.thumbnail_url))
      from clips c), '[]'::jsonb),
    -- lo programado y lo del Calendario se queda aunque sea una versión vieja
    'referencias', coalesce((select jsonb_agg(distinct u) from (
        select video_url as u from publicaciones_programadas where estado in ('programada', 'subiendo')
        union all
        select jsonb_path_query(h.datos, '$.posts[*].archivo') #>> '{}' from herramientas_datos h where h.herramienta = 'calendario'
      ) x where u is not null and u <> ''), '[]'::jsonb)
  )
$$;
revoke all on function public.limpieza_datos() from public, anon, authenticated;
grant execute on function public.limpieza_datos() to service_role;

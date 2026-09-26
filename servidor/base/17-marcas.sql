-- 17-marcas.sql (25-sep-2026) — TODO va separado por marca.
-- Sergio: «el calendario debe ser dividido por marcas, igual los proyectos… TODO DEBE IR SEPARADO POR MARCAS».
--
-- Una marca es una de las `cuentas` del documento del Laboratorio (herramientas_datos › laboratorio): `{ id, nombre }`,
-- y la activa es `activa`. Los ids son textos cortos («principal», «cdc7nt2»), NO uuid: por eso la columna es `marca text`
-- y no se usa `projects.brand_id`, que apunta a una tabla vieja (`brands`) que nadie llena.
--
-- · Proyectos y respuestas automáticas: columna `marca`.
-- · Guiones, Storyboard, Carruseles y Calendario: UN documento por marca en herramientas_datos, con la herramienta
--   escrita «guiones@<marca>». Así guardar una marca nunca puede pisar lo de otra (cada página guarda su documento
--   entero). Los documentos viejos sin «@» se copian a la marca activa y se quedan de respaldo.
--
-- Lo que no tenga marca (algo que se cuele por una página vieja en caché) se muestra en la PRIMERA marca de la lista.

-- 1 · Columnas
alter table public.projects add column if not exists marca text;
alter table public.flujos_respuesta add column if not exists marca text;
create index if not exists projects_usuario_marca on public.projects (user_id, marca);

-- 2 · El CHECK de herramientas: además de las seis de siempre, «<herramienta>@<marca>» para las cuatro que van por marca.
-- ⚠️ Si falta una herramienta aquí, la base rechaza el guardado EN SILENCIO (ver memoria «La tabla herramientas_datos»).
alter table public.herramientas_datos drop constraint if exists herramientas_datos_herramienta_check;
alter table public.herramientas_datos add constraint herramientas_datos_herramienta_check check (
  herramienta = any (array['guiones','storyboard','carruseles','calendario','marca','laboratorio'])
  or herramienta ~ '^(guiones|storyboard|carruseles|calendario)@[A-Za-z0-9_-]{1,40}$'
);

-- 3 · La marca activa de cada persona, igual que la calcula la página (herramientas/cherry.js › marcaDeDoc)
create or replace function public.marca_activa_de(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  with lab as (select datos from herramientas_datos where user_id = uid and herramienta = 'laboratorio'),
       cs as (select c->>'id' as id, ord from lab, jsonb_array_elements(coalesce(lab.datos->'cuentas', '[]'::jsonb)) with ordinality as t(c, ord))
  select coalesce(
    (select lab.datos->>'activa' from lab where exists (select 1 from cs where cs.id = lab.datos->>'activa')),
    (select id from cs order by ord limit 1),
    'principal');
$$;
revoke all on function public.marca_activa_de(uuid) from public, anon, authenticated;

-- 4 · Pasar lo que ya existe a la marca activa (uid null = todas las personas). Se puede correr varias veces.
create or replace function public.migrar_marcas(uid uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_p int; n_f int; n_d int;
begin
  update projects p set marca = marca_activa_de(p.user_id)
   where p.marca is null and (uid is null or p.user_id = uid);
  get diagnostics n_p = row_count;

  -- la respuesta va con la marca de SU cuenta de Instagram; si esa cuenta no tiene marca, la activa
  update flujos_respuesta f set marca = coalesce(
      (select c.marca from cuentas_instagram c where c.user_id = f.user_id and c.ig_user_id = f.ig_user_id and c.marca is not null limit 1),
      marca_activa_de(f.user_id))
   where f.marca is null and (uid is null or f.user_id = uid);
  get diagnostics n_f = row_count;

  insert into herramientas_datos (user_id, herramienta, datos, updated_at)
  select h.user_id, h.herramienta || '@' || marca_activa_de(h.user_id), h.datos, now()
    from herramientas_datos h
   where h.herramienta in ('guiones','storyboard','carruseles','calendario')
     and (uid is null or h.user_id = uid)
  on conflict (user_id, herramienta) do nothing;
  get diagnostics n_d = row_count;

  return jsonb_build_object('proyectos', n_p, 'respuestas', n_f, 'documentos', n_d);
end $$;
revoke all on function public.migrar_marcas(uuid) from public, anon, authenticated;

-- (19-oct-2026) Dos herramientas nuevas: «Estrategias de contenido» (estrategias) y «Mi proceso» (proceso). Sin esto la base
-- RECHAZA sus guardados y los datos se quedan solo en el navegador (pasó con «laboratorio» el 22-sep). Las dos también por marca
-- (herramienta@marca), como guiones, storyboard, carruseles, historias y calendario.
alter table public.herramientas_datos drop constraint if exists herramientas_datos_herramienta_check;
alter table public.herramientas_datos add constraint herramientas_datos_herramienta_check check (
  herramienta = any (array['guiones','storyboard','carruseles','historias','calendario','marca','laboratorio','estrategias','proceso'])
  or herramienta ~ '^(guiones|storyboard|carruseles|historias|calendario|estrategias|proceso)@[A-Za-z0-9_-]{1,40}$'
);

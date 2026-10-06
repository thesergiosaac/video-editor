-- 16 · Borrar un proyecto (6-oct-2026, Sergio: «una opción para borrar un proyecto»; escogió la recomendada).
-- El proyecto desaparece al instante para la persona (borrado_en = ahora) y el reloj diario de borrar-cuenta borra sus
-- archivos (S3 y almacén) y la fila a los 7 días. Mientras tanto, soporte lo recupera poniendo borrado_en en null.
-- Toda la app lista los proyectos con borrado_en=is.null.
alter table public.projects add column if not exists borrado_en timestamptz;
comment on column public.projects.borrado_en is 'Cuándo lo borró la persona (6-oct-2026). Deja de verse al instante; el reloj de borrar-cuenta borra sus archivos y la fila a los 7 días. Mientras tanto se recupera poniéndolo en null.';
create index if not exists projects_borrado_en on public.projects (borrado_en) where borrado_en is not null;

-- 25 · (15-oct-2026) Una respuesta automática vinculada a un PROYECTO que todavía no se ha publicado.
-- La vincula cherry-mcp (vincular_automatizacion). Cuando ig-publicar publica un reel de ese proyecto (el render que sale
-- es de ese projects.id), la amarra a la publicación: donde='una', media_id, activa, activada. Ver docs/CHERRY-MCP.md.
-- La página de Respuestas automáticas no manda esta columna al guardar: la conserva.
alter table public.flujos_respuesta
  add column if not exists proyecto_id uuid references public.projects(id) on delete set null;
create index if not exists flujos_respuesta_proyecto on public.flujos_respuesta (proyecto_id) where proyecto_id is not null;

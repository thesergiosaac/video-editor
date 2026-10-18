-- (18-oct-2026) Con qué arranca un video nuevo, por marca (js/arranque.js): { "<marca>": { "recordar": "cherry"|"tal_cual"|"mis"|null, "mis": {cfg, cortes} } }.
-- Sergio: «debería haber una opción para mantener lo que he añadido para que en otros vídeos se añada automáticamente, o no añadir nada».
-- Las políticas de la tabla (leer/crear/cambiar las propias) ya cubren la columna nueva.
alter table public.preferencias_usuario add column if not exists arranque jsonb;

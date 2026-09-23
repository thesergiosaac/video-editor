-- 05-apoyo.sql (19-sep-2026) — escenas de apoyo que la IA encontró para cada video (momentos + escenas elegidas).
-- La calcula orchestrate (función biblioteca › apoyo) cuando se marcan las frases; el ensamblador y la página escogen de ahí
-- cuáles usar según «Escenas de apoyo» (subtitle_config.escenas). Se copia al camino rápido y al generar desde la base.
alter table public.renders add column if not exists apoyo jsonb;

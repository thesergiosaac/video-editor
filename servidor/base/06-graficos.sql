-- 06-graficos.sql (19-sep-2026): lo que encontró la IA para los GRÁFICOS de cada video (función biblioteca › graficos)
alter table public.renders add column if not exists graficos jsonb;

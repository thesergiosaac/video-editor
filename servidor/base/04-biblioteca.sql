-- 04-biblioteca.sql (19-sep-2026) — la BIBLIOTECA DE ESCENAS DE APOYO, ordenada y buscable por significado.
-- Una fila por escena de cada clip de media-library/ (S3). La «huella» (embedding de OpenAI text-embedding-3-small, 1536)
-- sale del texto de la escena + palabras clave + categoría: así «ser libre con tu plata» encuentra una carretera al atardecer.
-- Solo el servidor la lee y la escribe (RLS encendido y sin políticas: nada desde el navegador).

create table if not exists public.biblioteca_escenas (
  id bigserial primary key,
  clip_id text not null,                 -- el id del catálogo, p. ej. 'a12_Arte'
  categoria text,
  s3_key text not null,                  -- media-library/Arte/a12_Arte.mp4
  clip_dur real,                         -- duración real del archivo (medida)
  ancho int, alto int, fps real,
  rotar smallint not null default 0,     -- grados para enderezar la imagen (0, 90, -90): 21 clips vienen de lado
  ini real not null,                     -- segundos dentro del clip
  fin real not null,
  texto text not null,                   -- qué se ve
  palabras_clave text[] not null default '{}',
  origen text not null default 'catalogo',   -- 'catalogo' (lo que ya tenía) o 'ia' (descrito el 19-sep)
  embedding vector(1536),
  creado timestamptz not null default now()
);
create index if not exists biblioteca_escenas_clip on public.biblioteca_escenas (clip_id);
alter table public.biblioteca_escenas enable row level security;

-- Guardar huellas en bloque: [{id, v:[...]}]
create or replace function public.biblioteca_guardar_huellas(datos jsonb) returns int
language sql security definer set search_path = public as $$
  with u as (
    update public.biblioteca_escenas e set embedding = (x->>'v')::vector
    from jsonb_array_elements(datos) x where e.id = (x->>'id')::bigint
    returning 1)
  select count(*)::int from u
$$;

-- Las escenas que más se parecen a una idea (la huella de lo que se dice en el video)
create or replace function public.buscar_escenas(q vector(1536), n int default 12)
returns table (id bigint, clip_id text, categoria text, s3_key text, clip_dur real, rotar smallint, ini real, fin real, texto text, parecido real)
language sql stable security definer set search_path = public as $$
  select e.id, e.clip_id, e.categoria, e.s3_key, e.clip_dur, e.rotar, e.ini, e.fin, e.texto, (1 - (e.embedding <=> q))::real
  from public.biblioteca_escenas e
  where e.embedding is not null
  order by e.embedding <=> q
  limit greatest(1, least(n, 60))
$$;

revoke all on function public.biblioteca_guardar_huellas(jsonb) from public, anon, authenticated;
revoke all on function public.buscar_escenas(vector, int) from public, anon, authenticated;

-- (29-oct-2026) Modo Manual: las escenas de la biblioteca se escogen a mano. Sergio: «al tocar una categoría se abrirá esa
-- categoría y se verán todos los clips que hay dentro» y «haz las portadas de las 31 categorías».
-- Cada toma guarda UNA miniatura (JPG de 160 px de alto, ~4 KB, como data:image/jpeg;base64), sacada una sola vez del cuadro
-- de la mitad de su trozo y girada como sale en el video (rotar). La llena scratchpad/miniaturas/subir.py.
-- No toca nada de lo que ya existe: una columna nueva y una función nueva (solo para el servidor).

alter table public.biblioteca_escenas add column if not exists miniatura text;

-- Las categorías con cuántos videos tienen (como categorias_escenas) y su portada: la miniatura de una de sus tomas
-- (primero las que no van giradas).
create or replace function public.portadas_escenas()
returns table(categoria text, clips bigint, miniatura text)
language sql stable security definer set search_path = public as $$
  select c.categoria, c.clips, p.miniatura
  from (select e.categoria, count(distinct e.clip_id) as clips from public.biblioteca_escenas e
        where e.embedding is not null group by e.categoria) c
  left join lateral (select e.miniatura from public.biblioteca_escenas e
                     where e.categoria = c.categoria and e.miniatura is not null
                     order by (e.rotar <> 0), e.id limit 1) p on true
  order by 1
$$;
revoke all on function public.portadas_escenas() from public, anon, authenticated;
grant execute on function public.portadas_escenas() to service_role;

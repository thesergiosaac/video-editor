-- ════════════════════════════════════════════════════════════════════════════════════════
-- Lo que Cherry ve en cada foto de un carrusel (30-sep-2026, carruseles: composición)
--
-- Una fila por foto: dónde está la persona, su cara, una rejilla chiquita (120 de ancho) con cuánta persona,
-- detalle y luz hay en cada celda, y la ruta del recorte (la persona sola, PNG transparente, en el cubo
-- `carruseles`). La saca la Lambda `carrete-carruseles` UNA vez por foto; la página la usa para poner el texto
-- donde no tapa la cara y para dejar a la persona ADELANTE del texto cuando se cruzan.
-- No va en el documento del carrusel: la rejilla pesa ~60 KB y viajaría en cada guardado.
-- ════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.carrusel_fotos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  marca        text not null default 'principal',
  origen       text not null default 'subida',      -- subida | fotograma | ia | biblioteca
  ruta         text not null,                        -- en el cubo carruseles: <user_id>/<archivo>
  w            int,
  h            int,
  persona      jsonb,                                -- [x, y, w, h] en píxeles de la foto analizada
  cara         jsonb,                                -- [x, y, w, h] o null
  rejilla      jsonb,                                -- { w, h, persona, bordes, luz } (base64, un byte por celda)
  recorte_ruta text,                                 -- <user_id>/<archivo>-r.png
  recorte_caja jsonb,                                -- [x, y, w, h] del recorte dentro de la foto
  descripcion  text,                                 -- qué se ve (la llena el director cuando la mira)
  creado       timestamptz not null default now(),
  unique (user_id, ruta)
);

alter table public.carrusel_fotos enable row level security;
drop policy if exists carrusel_fotos_duena on public.carrusel_fotos;
create policy carrusel_fotos_duena on public.carrusel_fotos
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists carrusel_fotos_usuario on public.carrusel_fotos (user_id, marca, creado desc);

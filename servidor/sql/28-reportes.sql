-- (29-oct-2026) Reportar o sugerir. Sergio: «poner algo donde las personas puedan reportar errores y dar sugerencias…
-- que sientan que hay soluciones inmediatas». Propuesta aprobada: artefacto «Reportar y sugerir en Cherry»
-- (https://claude.ai/artifact/LNoAd5YshK5VoU3iJN35T2). Botón «Reportar o sugerir» en la barra y en el menú de la foto
-- (js/reportes.js); la persona ve en qué va lo suyo («Mis reportes»); Sergio responde desde la Consola (herramientas/consola).
-- No toca nada de lo que ya existe.

-- ¿Es administrador quien llama? (la tabla `administradores`, servidor/base/20-administradores.sql)
create or replace function public.soy_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.administradores where user_id = auth.uid())
$$;

-- Los reportes y las ideas. El `id` es el número que ve la persona («Reporte n.º 128»).
create table if not exists public.reportes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('error', 'idea')),
  texto       text not null check (char_length(texto) between 3 and 4000),
  para_que    text check (para_que is null or char_length(para_que) <= 2000),   -- idea: para qué le serviría
  urgente     boolean not null default false,                                     -- error: «No puedo seguir»
  area        text check (area is null or char_length(area) <= 60),             -- la parte de Cherry
  pantalla    text check (pantalla is null or char_length(pantalla) <= 300),     -- dónde estaba
  marca       text check (marca is null or char_length(marca) <= 80),
  foto        text check (foto is null or char_length(foto) <= 300),             -- en el cubo privado `reportes`
  adjunto     text check (adjunto is null or char_length(adjunto) <= 300),
  tecnico     jsonb,                                                              -- errores recientes, navegador, pantalla
  correo      text check (correo is null or char_length(correo) <= 200),
  estado      text not null default 'recibido' check (estado in ('recibido', 'arreglando', 'arreglado', 'planes', 'no')),
  respuesta   text check (respuesta is null or char_length(respuesta) <= 2000),
  respondido  timestamptz,
  visto_admin timestamptz,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists reportes_usuario on public.reportes (user_id, creado desc);
create index if not exists reportes_estado on public.reportes (estado, creado desc);

alter table public.reportes enable row level security;
-- la persona crea los suyos (siempre «recibido» y sin respuesta) y ve los suyos; el administrador ve todos
drop policy if exists reportes_crear on public.reportes;
create policy reportes_crear on public.reportes for insert to authenticated
  with check (user_id = auth.uid() and estado = 'recibido' and respuesta is null and respondido is null and visto_admin is null);
drop policy if exists reportes_ver on public.reportes;
create policy reportes_ver on public.reportes for select to authenticated
  using (user_id = auth.uid() or public.soy_admin());
-- nadie lo cambia directo: el administrador responde con responder_reporte()

-- El administrador cambia el estado y responde (o solo lo marca como visto)
create or replace function public.responder_reporte(p_id bigint, p_estado text default null, p_respuesta text default null, p_solo_visto boolean default false)
returns public.reportes language plpgsql security definer set search_path = public as $$
declare r public.reportes;
begin
  if not public.soy_admin() then raise exception 'Solo el administrador'; end if;
  if p_solo_visto then
    update public.reportes set visto_admin = coalesce(visto_admin, now()) where id = p_id returning * into r;
    return r;
  end if;
  if p_estado is not null and p_estado not in ('recibido', 'arreglando', 'arreglado', 'planes', 'no') then raise exception 'Estado no válido'; end if;
  update public.reportes set
    estado = coalesce(p_estado, estado),
    respuesta = case when p_respuesta is null then respuesta else nullif(btrim(p_respuesta), '') end,
    respondido = case when p_respuesta is not null and btrim(p_respuesta) <> '' then now() else respondido end,
    visto_admin = coalesce(visto_admin, now()),
    actualizado = now()
  where id = p_id returning * into r;
  return r;
end $$;
revoke all on function public.responder_reporte(bigint, text, text, boolean) from public;
grant execute on function public.responder_reporte(bigint, text, text, boolean) to authenticated;

-- Las fotos de la pantalla (y lo que adjunte la persona): cubo PRIVADO, cada quien en su carpeta; el administrador las ve
insert into storage.buckets (id, name, public, file_size_limit)
values ('reportes', 'reportes', false, 52428800)
on conflict (id) do nothing;
drop policy if exists reportes_subir on storage.objects;
create policy reportes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'reportes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists reportes_leer on storage.objects;
create policy reportes_leer on storage.objects for select to authenticated
  using (bucket_id = 'reportes' and ((storage.foldername(name))[1] = auth.uid()::text or public.soy_admin()));

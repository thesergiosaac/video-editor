-- (27-oct-2026) Esconder comentarios malos (Respuestas automáticas). Sergio: «hazlas todas» / «si dale».
-- Con el interruptor prendido, ig-aviso esconde en Instagram los comentarios con insultos fuertes, enlaces o spam (los que
-- traen la palabra de una respuesta automática nunca se tocan) y los apunta aquí; la pantalla los lista con «Mostrar».
-- No toca nada de lo que ya existe.

-- El interruptor, por cuenta de Instagram. Lo cambia la persona desde la pantalla (solo el suyo).
create table if not exists moderacion_instagram (
  ig_user_id  text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  esconder    boolean not null default false,
  actualizado timestamptz not null default now()
);
alter table moderacion_instagram enable row level security;
drop policy if exists moderacion_ver on moderacion_instagram;
create policy moderacion_ver on moderacion_instagram for select using (auth.uid() = user_id);
drop policy if exists moderacion_crear on moderacion_instagram;
create policy moderacion_crear on moderacion_instagram for insert with check (
  auth.uid() = user_id and exists (select 1 from cuentas_instagram c where c.ig_user_id = moderacion_instagram.ig_user_id and c.user_id = auth.uid()));
drop policy if exists moderacion_cambiar on moderacion_instagram;
create policy moderacion_cambiar on moderacion_instagram for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Los que Cherry escondió. Los escribe el servidor (ig-aviso); la persona solo ve los suyos. «Mostrar» lo hace ig-metricas.
create table if not exists comentarios_escondidos (
  comentario_id text primary key,
  ig_user_id    text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  media_id      text,
  usuario       text,
  texto         text,
  motivo        text,          -- insulto · enlace · spam
  escondido_el  timestamptz not null default now(),
  mostrado_el   timestamptz
);
create index if not exists comentarios_escondidos_cuenta on comentarios_escondidos (ig_user_id, escondido_el desc);
alter table comentarios_escondidos enable row level security;
drop policy if exists escondidos_ver on comentarios_escondidos;
create policy escondidos_ver on comentarios_escondidos for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- Las cuentas de administrador (29-sep-2026)
--
-- Sergio: «marca mi cuenta como una cuenta de administrador y quita ese tope. El administrador no tiene nunca
-- topes de nada». Se le acabaron las 45 viñetas del mes (gastadas con Cloudflare antes del cambio a GPT) y no pudo
-- dibujar su propio storyboard.
--
-- ⚠️ LA REGLA: todo tope que ponga Cherry por cuenta (hoy solo las viñetas, en `sb-vineta`) mira PRIMERO esta
-- tabla. Si la cuenta está aquí, no hay tope. Un tope nuevo que no la mire rompe la regla.
--
-- No cuentan como topes de Cherry, y NO se saltan: los de Instagram (180 mensajes automáticos por hora, 100
-- publicaciones al día: si se pasan, Instagram bloquea la cuenta) y los tamaños máximos de archivo de cada servicio.
--
-- Se mira con la llave de servicio. Cada quien puede leer su propia fila (para que la página sepa si es
-- administrador), nadie la escribe desde el navegador.
-- ════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.administradores (
  user_id uuid        not null primary key references auth.users(id) on delete cascade,
  nota    text,
  creado  timestamptz not null default now()
);

alter table public.administradores enable row level security;

drop policy if exists administradores_ver on public.administradores;
create policy administradores_ver on public.administradores
  for select to authenticated using (auth.uid() = user_id);

-- Sergio (creatorspremium.co@gmail.com)
insert into public.administradores (user_id, nota)
values ('c40d9dbf-a9ad-4247-9932-fc65f4f969e2', 'Sergio, dueño de Cherry (29-sep-2026)')
on conflict (user_id) do nothing;

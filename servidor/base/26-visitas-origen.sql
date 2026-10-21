-- ════════════════════════════════════════════════════════════════════════════════════════
-- De dónde llega la gente a las guías (21-oct-2026)
--
-- Sergio: «tenemos que tener un enlace personalizado para ver cuántas personas llegaron a la página desde Instagram y
-- cuántas desde otras redes: YouTube, Facebook, TikTok…». En Instagram el enlace va en la respuesta automática; en las
-- otras redes, en la biografía. Cada red lleva su propio enlace (?de=ig | tt | yt | fb) y la página suma la visita aquí.
--
-- · Solo se cuenta: día (hora de Colombia) + página + red + cuántas visitas. Nada de la persona, sin cookies.
-- · El navegador solo puede SUMAR (función sumar_visita, con la llave pública); leer es solo de administradores.
-- · Lo llama js/origen.js (en /guias/ y en las páginas de video guía).
-- ════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.visitas_origen (
  dia     date not null default ((now() at time zone 'America/Bogota')::date),
  pagina  text not null,
  origen  text not null,
  visitas int  not null default 0,
  primary key (dia, pagina, origen)
);

alter table public.visitas_origen enable row level security;
drop policy if exists visitas_admin on public.visitas_origen;
create policy visitas_admin on public.visitas_origen for select
  using (exists (select 1 from public.administradores a where a.user_id = auth.uid()));
grant select on public.visitas_origen to authenticated;

create or replace function public.sumar_visita(p_pagina text, p_origen text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pagina is null or p_pagina !~ '^[a-z0-9/_-]{1,60}$' then return; end if;
  if p_origen is null or p_origen not in ('instagram', 'tiktok', 'youtube', 'facebook', 'whatsapp', 'otro', 'directo') then
    p_origen := 'otro';
  end if;
  insert into public.visitas_origen (pagina, origen, visitas) values (p_pagina, p_origen, 1)
  on conflict (dia, pagina, origen) do update set visitas = public.visitas_origen.visitas + 1;
end $$;
revoke all on function public.sumar_visita(text, text) from public;
grant execute on function public.sumar_visita(text, text) to anon, authenticated;

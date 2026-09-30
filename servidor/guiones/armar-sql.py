# Arma base/22-biblioteca-guiones.sql desde guiones/biblioteca.json. Correr tras cada tanda nueva de referencias.
import json, os
aqui = os.path.dirname(os.path.abspath(__file__))
b = json.load(open(os.path.join(aqui, 'biblioteca.json'), encoding='utf-8'))
q = lambda s: "'" + str(s).replace("'", "''") + "'"
j = lambda o: q(json.dumps(o, ensure_ascii=False)) + '::jsonb'
out = ["""-- 22 · Biblioteca de guiones (30-sep-2026). Generado por servidor/guiones/armar-sql.py — NO editar a mano.
-- Plantillas, pasos y ganchos: los lee cualquiera con sesión. Calcos: solo el servidor (el usuario nunca
-- ve el guion ni el creador de la referencia). Nadie escribe desde el navegador: se cargan con este archivo.
create table if not exists public.guion_pasos (id text primary key, nombre text not null, hace text not null, activa boolean not null default true);
create table if not exists public.guion_plantillas (id text primary key, nombre text not null, resumen text not null, orden int not null default 0,
  respaldo jsonb not null default '{}'::jsonb, pasos jsonb not null, pantalla jsonb not null default '[]'::jsonb,
  activa boolean not null default true, actualizado timestamptz not null default now());
create table if not exists public.guion_ganchos (id text primary key, nombre text not null, orden int not null default 0, emocion text, molde text not null,
  ejemplo text, ve text, respaldo int not null default 0, activa boolean not null default true, actualizado timestamptz not null default now());
create table if not exists public.guion_calcos (id text primary key, plantilla text not null references public.guion_plantillas(id), gancho text references public.guion_ganchos(id),
  dur int, vistas int, tramos jsonb not null, activa boolean not null default true, actualizado timestamptz not null default now());
alter table public.guion_pasos enable row level security;
alter table public.guion_plantillas enable row level security;
alter table public.guion_ganchos enable row level security;
alter table public.guion_calcos enable row level security;
drop policy if exists guion_pasos_ver on public.guion_pasos;
create policy guion_pasos_ver on public.guion_pasos for select to authenticated using (true);
drop policy if exists guion_plantillas_ver on public.guion_plantillas;
create policy guion_plantillas_ver on public.guion_plantillas for select to authenticated using (true);
drop policy if exists guion_ganchos_ver on public.guion_ganchos;
create policy guion_ganchos_ver on public.guion_ganchos for select to authenticated using (true);
-- guion_calcos: sin políticas a propósito. Solo la llave del servidor la lee.
"""]
for k, p in b['pasos'].items():
    out.append(f"insert into public.guion_pasos (id, nombre, hace) values ({q(k)}, {q(p['nombre'])}, {q(p['hace'])}) on conflict (id) do update set nombre = excluded.nombre, hace = excluded.hace, activa = true;")
for p in b['plantillas']:
    out.append(f"insert into public.guion_plantillas (id, nombre, resumen, orden, respaldo, pasos, pantalla) values ({q(p['id'])}, {q(p['nombre'])}, {q(p['resumen'])}, {p['orden']}, {j(p['respaldo'])}, {j(p['pasos'])}, {j(p['pantalla'])}) on conflict (id) do update set nombre = excluded.nombre, resumen = excluded.resumen, orden = excluded.orden, respaldo = excluded.respaldo, pasos = excluded.pasos, pantalla = excluded.pantalla, activa = true, actualizado = now();")
for g in b['ganchos']:
    out.append(f"insert into public.guion_ganchos (id, nombre, orden, emocion, molde, ejemplo, ve, respaldo) values ({q(g['id'])}, {q(g['nombre'])}, {g['orden']}, {q(g['emocion'])}, {q(g['molde'])}, {q(g['ejemplo'])}, {q(g['ve'])}, {g['respaldo']}) on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden, emocion = excluded.emocion, molde = excluded.molde, ejemplo = excluded.ejemplo, ve = excluded.ve, respaldo = excluded.respaldo, activa = true, actualizado = now();")
for c in b['calcos']:
    out.append(f"insert into public.guion_calcos (id, plantilla, gancho, dur, vistas, tramos) values ({q(c['id'])}, {q(c['plantilla'])}, {q(c['gancho'])}, {c['dur']}, {c['vistas']}, {j(c['tramos'])}) on conflict (id) do update set plantilla = excluded.plantilla, gancho = excluded.gancho, dur = excluded.dur, vistas = excluded.vistas, tramos = excluded.tramos, activa = true, actualizado = now();")
open(os.path.join(aqui, '..', 'base', '22-biblioteca-guiones.sql'), 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('ok', len(b['plantillas']), 'plantillas', len(b['ganchos']), 'ganchos', len(b['calcos']), 'calcos')

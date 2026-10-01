// Cierre — pantalla completa. El remate del video: la frase final grande y, debajo, lo que quieres que
// haga la gente en una pastilla encendida. Es lo último que se ve, así que va solo, sin nada más.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, golpe, sp, useG, useT} from '../lib/anim';
import {Chispas, Escribir, Letras} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

export const Cierre: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const frase = String(d.texto || '');
  const accion = String(d.accion || '');
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const ta = p.marcas[1] != null ? p.marcas[1] : tc + 1.5;
  const {op, dy, sale} = usePresenciaGrupo();
  const k = sp(t, tc, {damping: 15, stiffness: 92, mass: 1});
  const ka = sp(t, ta, {damping: 12, stiffness: 130, mass: 0.85});
  const latido = golpe(t, ta + 0.5, 5, 2.4);
  const tam = frase.length > 46 ? 74 : frase.length > 28 ? 88 : 104;
  const top = Math.round(Hd * 0.44);
  if (op <= 0.001) return null;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op,
      transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      {d.etiqueta ? (
        <div style={{position: 'absolute', left: 80, right: 80, top: top - 56, textAlign: 'center', fontFamily: MONO,
          fontWeight: 500, fontSize: 26, letterSpacing: '0.24em', textTransform: 'uppercase', color: pal.acento,
          whiteSpace: 'nowrap'}}>
          <Escribir texto={String(d.etiqueta)} t0={p.t0 + 0.35} velocidad={1.5} />
        </div>
      ) : null}

      <div style={{position: 'absolute', left: 70, right: 70, top: top, textAlign: 'center', fontFamily: OUTFIT,
        fontWeight: 900, fontSize: tam, lineHeight: 1.08, letterSpacing: '-0.04em', color: pal.tinta,
        opacity: clamp(k * 1.5), textShadow: '0 16px 50px rgba(0,0,0,.75)'}}>
        <Letras texto={frase} t0={tc} paso={0.8 / 30} subir={40} />
      </div>

      {accion ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: top + 300, display: 'flex', justifyContent: 'center',
          opacity: clamp(ka * 1.6), transform: `scale(${(0.8 + 0.2 * ka) * (1 + 0.04 * latido)})`}}>
          <div style={{padding: '26px 52px', borderRadius: 99, fontFamily: OUTFIT, fontWeight: 900, fontSize: 46,
            letterSpacing: '-0.02em', color: pal.sobre, whiteSpace: 'nowrap',
            background: `linear-gradient(140deg, ${pal.claro}, ${pal.acento})`,
            boxShadow: `0 24px 60px -18px ${pal.a(0.9)}, inset 0 2px 0 rgba(255,255,255,.4)`}}>
            {accion}
          </div>
        </div>
      ) : null}
      <Chispas t0={ta + 0.3} x={540} y={top + 340} n={24} semilla="cierre" fuerza={820} />
    </div>
  );
};

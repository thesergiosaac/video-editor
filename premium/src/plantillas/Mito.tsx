// Mito / Realidad — encima del video. Dos paneles que llegan girando: arriba el mito (se tacha solo con una raya que se
// dibuja) y abajo la realidad (con su check y el color de tu marca). Para los «no es X, es Y» dichos con datos.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Chispas} from '../lib/Piezas';

const X = 78, AN = 924, ALTO = 236;
const CHEQUE = 'M 14 30 L 26 42 L 48 16';

export const Mito: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const tMito = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const tReal = p.marcas[1] != null ? p.marcas[1] : tMito + 1.4;
  const salida = rampa(t, p.t1 - 0.75, p.t1 - 0.3, EASE.sale);
  const top = 190;
  const k1 = sp(t, tMito, {damping: 14, stiffness: 120, mass: 0.85});
  const k2 = sp(t, tReal, {damping: 13, stiffness: 115, mass: 0.9});
  const tacha = rampa(t, tMito + 0.55, tMito + 1.15, EASE.llega);
  const apaga = rampa(t, tReal - 0.1, tReal + 0.4) * 0.45;
  const cheque = rampa(t, tReal + 0.25, tReal + 0.7, EASE.llega);
  const tamM = String(d.mito || '').length > 30 ? 46 : 54;
  const tamR = String(d.realidad || '').length > 30 ? 50 : 60;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1080, opacity: 1 - salida, perspective: 1500}}>
      {/* MITO */}
      <div style={{position: 'absolute', left: X, top: top + (1 - k1) * 40, width: AN, height: ALTO, opacity: clamp(k1 * 1.6) * (1 - apaga),
        transform: `rotateX(${(1 - k1) * 26}deg) scale(${0.94 + 0.06 * k1})`, transformOrigin: '50% 100%'}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 30, background: 'linear-gradient(150deg, rgba(46,34,40,.9), rgba(14,10,12,.92))',
          boxShadow: '0 30px 70px -26px rgba(0,0,0,.95), inset 0 0 0 1px rgba(255,255,255,.08)'}} />
        <div style={{position: 'absolute', left: 34, top: 26, fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: '0.2em', color: 'rgba(244,236,231,.5)'}}>MITO</div>
        <div style={{position: 'absolute', left: 34, right: 34, top: 74, fontFamily: OUTFIT, fontWeight: 800, fontSize: tamM, lineHeight: 1.08,
          letterSpacing: '-0.02em', color: 'rgba(244,236,231,.86)'}}>
          <span style={{position: 'relative', display: 'inline-block'}}>
            {String(d.mito || '')}
            {/* la raya tacha justo el ancho del texto */}
            <span style={{position: 'absolute', left: '-0.02em', right: '-0.02em', top: '52%', height: 7, borderRadius: 9,
              background: 'rgba(244,236,231,.88)', transform: `scaleX(${tacha})`, transformOrigin: '0% 50%'}} />
          </span>
        </div>
      </div>
      {/* REALIDAD */}
      <div style={{position: 'absolute', left: X, top: top + ALTO + 34 + (1 - k2) * 50, width: AN, height: ALTO + 16, opacity: clamp(k2 * 1.6),
        transform: `rotateX(${(1 - k2) * -22}deg) scale(${0.94 + 0.06 * k2})`, transformOrigin: '50% 0%'}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 30, overflow: 'hidden',
          background: `linear-gradient(150deg, ${pal.a(0.22)}, rgba(14,10,12,.94))`,
          boxShadow: `0 34px 80px -24px rgba(0,0,0,.95), inset 0 0 0 1.5px ${pal.a(0.5)}`}}>
          <Brillo t0={tReal + 0.4} w={AN} h={ALTO} dur={0.9} fuerza={1.2} />
        </div>
        <div style={{position: 'absolute', left: 34, top: 26, display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: '0.2em', color: pal.acento}}>
          <svg width={60} height={52} style={{overflow: 'visible'}}>
            <path d={CHEQUE} fill="none" stroke={pal.acento} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" {...evolvePath(cheque, CHEQUE)} />
          </svg>
          REALIDAD
        </div>
        <div style={{position: 'absolute', left: 34, right: 34, top: 96, fontFamily: OUTFIT, fontWeight: 900, fontSize: tamR, lineHeight: 1.06, letterSpacing: '-0.03em', color: pal.tinta}}>
          {String(d.realidad || '')}
        </div>
      </div>
      <Chispas t0={tReal + 0.3} x={X + 70} y={top + ALTO + 70} n={16} semilla="mito" fuerza={640} />
    </div>
  );
};

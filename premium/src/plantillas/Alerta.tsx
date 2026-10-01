// Alerta — encima del video. Un aviso con su triángulo que se dibuja y un borde que respira. Para el
// «cuidado con esto», el error que todo el mundo comete, lo que te puede costar caro.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 46;
const TRI = 'M 44 8 L 82 74 L 6 74 Z';

export const Alerta: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const texto = String(d.texto || '');
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const tam = texto.length > 54 ? 48 : texto.length > 34 ? 56 : 66;
  const lineas = Math.max(1, Math.ceil(texto.length / Math.max(10, Math.floor((ANCHO - PAD * 2 - 130) / (tam * 0.52)))));
  const h = 132 + lineas * tam * 1.15 + (d.pie ? 56 : 0) + PAD;
  const k = sp(t, tc, {damping: 14, stiffness: 110, mass: 0.9});
  const tri = rampa(t, tc + 0.1, tc + 0.6, EASE.llega);
  // el borde respira despacio, como un aviso encendido
  const pulso = 0.5 + 0.5 * Math.sin((t - tc) * 3.4);

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={h} entra={ENTRA} sale={SALE} semilla="aler" brillos={[tc + 0.6]}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 54, pointerEvents: 'none',
        boxShadow: `inset 0 0 0 2.5px ${pal.a(0.35 + 0.35 * pulso)}`, opacity: clamp(k)}} />
      <svg width={92} height={84} style={{position: 'absolute', left: PAD, top: 54, overflow: 'visible'}}>
        <path d={TRI} fill={pal.a(0.16)} opacity={clamp(k)} />
        <path d={TRI} fill="none" stroke={pal.acento} strokeWidth={6} strokeLinejoin="round"
          {...evolvePath(tri, TRI)} style={{filter: `drop-shadow(0 0 16px ${pal.a(0.6)})`}} />
        {tri > 0.9 ? (
          <>
            <rect x={40} y={30} width={8} height={22} rx={4} fill={pal.acento} />
            <circle cx={44} cy={62} r={4.6} fill={pal.acento} />
          </>
        ) : null}
      </svg>
      <div style={{position: 'absolute', left: PAD + 130, right: PAD, top: 38, fontFamily: MONO, fontWeight: 500,
        fontSize: 24, letterSpacing: '0.2em', textTransform: 'uppercase', color: pal.acento,
        opacity: clamp(k * 1.5)}}>
        {String(d.etiqueta || 'Cuidado')}
      </div>
      <div style={{position: 'absolute', left: PAD + 130, right: PAD, top: 84, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: tam, lineHeight: 1.15, letterSpacing: '-0.03em', color: pal.tinta,
        opacity: clamp(k * 1.6), transform: `translateY(${(1 - k) * 22}px)`}}>
        <Letras texto={texto} t0={tc + 0.1} paso={0.7 / 30} subir={28} />
      </div>
      {d.pie ? (
        <div style={{position: 'absolute', left: PAD + 130, right: PAD, top: 108 + lineas * tam * 1.15,
          fontFamily: OUTFIT, fontWeight: 700, fontSize: 34, letterSpacing: '-0.015em', color: pal.tinta2,
          opacity: clamp(sp(t, tc + 0.9, RESORTES.carta) * 1.5)}}>
          {String(d.pie)}
        </div>
      ) : null}
    </Tarjeta>
  );
};

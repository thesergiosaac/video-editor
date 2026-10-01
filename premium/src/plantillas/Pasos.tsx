// Pasos 1·2·3 — «al lado»: tu video se corre a la izquierda y los pasos van cayendo a la derecha como tarjetas 3D,
// cada una cuando la dices. La que se está diciendo se levanta y brilla; las anteriores se apagan un poco.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Escribir} from '../lib/Piezas';

const X = 560, AN = 452, ALTO = 186, GAP = 26;

export const Pasos: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const pasos: string[] = (d.pasos || d.items || []).slice(0, 4);
  const tm: number[] = p.marcas || [];
  const salida = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);
  const top = Math.round(Hd * 0.16);
  const tTit = p.t0 + 0.35;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - salida}}>
      <div style={{position: 'absolute', left: X, top: top - 84, width: AN, fontFamily: MONO, fontWeight: 500, fontSize: 26,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: pal.tinta2, textShadow: '0 4px 16px rgba(0,0,0,.8)'}}>
        <Escribir texto={String(d.titulo || 'Paso a paso')} t0={tTit} velocidad={1.4} />
      </div>
      <div style={{position: 'absolute', left: X - 60, top: top - 40, width: AN + 120, height: pasos.length * (ALTO + GAP) + 80, perspective: 1400, perspectiveOrigin: '30% 40%'}}>
        {pasos.map((txt, i) => {
          const ti = tm[i] != null ? tm[i] : p.t0 + 0.8 + i * 1.2;
          const k = sp(t, ti, {damping: 13, stiffness: 110, mass: 0.9});
          const sig = tm[i + 1];
          const apaga = sig != null ? rampa(t, sig - 0.05, sig + 0.35) * 0.45 : 0;
          const fl = noise2D('paso' + i, t * 0.3, i) * 4;
          const y = 40 + i * (ALTO + GAP);
          const tam = txt.length > 34 ? 32 : txt.length > 22 ? 37 : 42;
          return (
            <div key={i} style={{position: 'absolute', left: 60, top: y + (1 - k) * 60 + fl, width: AN, height: ALTO,
              opacity: clamp(k * 1.6) * (1 - apaga), transformStyle: 'preserve-3d',
              transform: `rotateY(${-16 + (1 - k) * -30}deg) rotateX(${(1 - k) * 18}deg) translateZ(${k * (12 - i * 4) - (1 - k) * 160}px) scale(${0.9 + 0.1 * k})`}}>
              <div style={{position: 'absolute', inset: 0, borderRadius: 26, background: 'linear-gradient(150deg, rgba(48,36,42,.92), rgba(16,11,14,.94))',
                boxShadow: `0 34px 70px -22px rgba(0,0,0,.95), inset 0 0 0 1px rgba(255,255,255,.10)`, overflow: 'hidden'}}>
                <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: `linear-gradient(180deg, ${pal.claro}, ${pal.acento})`, opacity: apaga ? 0.5 : 1}} />
                <Brillo t0={ti + 0.25} w={AN} h={ALTO} dur={0.8} fuerza={1.1} />
              </div>
              <div style={{position: 'absolute', left: 34, top: 26, width: 62, height: 62, borderRadius: 18, display: 'grid', placeItems: 'center',
                fontFamily: OUTFIT, fontWeight: 900, fontSize: 34, color: pal.sobre, background: `linear-gradient(180deg, ${pal.claro}, ${pal.acento})`,
                boxShadow: `0 10px 24px -8px ${pal.a(0.8)}`, transform: `translateZ(18px) scale(${sp(t, ti + 0.08, RESORTES.pop)})`}}>
                {i + 1}
              </div>
              <div style={{position: 'absolute', left: 120, right: 26, top: 30, fontFamily: OUTFIT, fontWeight: 800, fontSize: tam, lineHeight: 1.12,
                letterSpacing: '-0.02em', color: pal.tinta, transform: 'translateZ(10px)'}}>
                {txt}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

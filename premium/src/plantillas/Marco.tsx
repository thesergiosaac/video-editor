// Marco y título — con profundidad. Un marco fino se dibuja solo alrededor del cuadro y el título entra DETRÁS de ti,
// arriba; abajo, DELANTE, una línea con el pie. Es el recurso de portada: abre el video o abre un capítulo.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';

const M = 44;                 // separación del marco al borde

export const Marco: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte} = useG();
  const d = p.datos || {};
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.35;
  const sale = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);
  const dibuja = rampa(t, p.t0 + 0.15, p.t0 + 1.25, EASE.llega);
  const k = sp(t, tc, {damping: 16, stiffness: 84, mass: 1});

  if (parte === 'atras') {
    const titulo = String(d.titulo || '');
    const tam = titulo.length > 22 ? 96 : titulo.length > 13 ? 124 : 152;
    return (
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
        <div style={{position: 'absolute', left: 78, right: 78, top: Math.round(Hd * 0.13), textAlign: 'center',
          opacity: clamp(k * 1.6), transform: `translateY(${(1 - k) * 38}px)`,
          filter: k < 0.98 ? `blur(${((1 - k) * 18).toFixed(1)}px)` : undefined}}>
          {d.ojo ? (
            <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 26, letterSpacing: '0.3em',
              textTransform: 'uppercase', color: pal.acento, marginBottom: 20}}>{String(d.ojo)}</div>
          ) : null}
          <div style={{fontFamily: OUTFIT, fontWeight: 900, fontSize: tam, lineHeight: 1.02, letterSpacing: '-0.045em',
            color: pal.tinta, textShadow: '0 24px 70px rgba(0,0,0,.8)'}}>{titulo}</div>
        </div>
      </div>
    );
  }

  const W = 1080, H = Hd;
  const largo = 2 * (W - 2 * M) + 2 * (H - 2 * M);
  const kp = sp(t, tc + 0.85, {damping: 17, stiffness: 92, mass: 1});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: 1 - sale}}>
      {d.pie ? <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(H * 0.26), opacity: clamp(kp),
        background: 'linear-gradient(0deg, rgba(8,5,7,.88) 0%, rgba(8,5,7,.5) 48%, transparent 100%)'}} /> : null}
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} rx={26} fill="none" stroke={pal.a(0.9)} strokeWidth={3}
          strokeDasharray={largo} strokeDashoffset={largo * (1 - dibuja)} strokeLinecap="round"
          style={{filter: `drop-shadow(0 0 14px ${pal.a(0.45)})`}} />
      </svg>
      {d.pie ? (
        <div style={{position: 'absolute', left: 96, right: 96, top: Math.round(H * 0.845), textAlign: 'center',
          fontFamily: OUTFIT, fontWeight: 700, fontSize: 42, lineHeight: 1.12, letterSpacing: '-0.015em',
          color: pal.tinta, opacity: clamp(kp * 1.5), transform: `translateY(${(1 - kp) * 20}px)`,
          textShadow: '0 6px 26px rgba(0,0,0,.95)'}}>
          {String(d.pie)}
        </div>
      ) : null}
    </div>
  );
};

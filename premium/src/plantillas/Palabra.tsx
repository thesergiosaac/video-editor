// Palabra clave gigante — encima del video, sin tarjeta. La idea del momento en letras enormes con volumen 3D (varias
// capas detrás hacen el relieve), entra girando desde abajo y late en la palabra que se dice. Para los momentos SIN cifras.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';

const CAPAS = 14;                                  // capas del relieve 3D

export const Palabra: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const texto = String(d.texto || '').toUpperCase();
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const k = sp(t, tc, {damping: 12, stiffness: 120, mass: 0.9});
  const sale = rampa(t, p.t1 - 0.7, p.t1 - 0.25, EASE.sale);
  const latido = golpe(t, tc + 0.45, 6, 2.6);
  const gy = noise2D('pal-y', t * 0.3, 0) * 2.2, gx = noise2D('pal-x', 0, t * 0.28) * 1.6;
  const largo = texto.length;
  const tam = Math.min(largo > 22 ? 118 : largo > 14 ? 150 : largo > 8 ? 190 : 230, Math.floor(930 / Math.max(3, largo * 0.72)));
  const apoyo = String(d.apoyo || '');
  const kA = sp(t, tc + 0.5, RESORTES.carta);
  if (t < p.t0) return null;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1080, opacity: (1 - sale), perspective: 1600}}>
      {/* fondo suave para que la letra se lea sobre cualquier video */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 900, opacity: clamp(k) * 0.92,
        background: 'linear-gradient(180deg, rgba(8,5,7,.82) 0%, rgba(8,5,7,.55) 45%, rgba(8,5,7,0) 100%)'}} />
      <div style={{position: 'absolute', left: 60, right: 60, top: 210, textAlign: 'center', transformStyle: 'preserve-3d',
        transform: `rotateX(${(1 - k) * 42 + gy}deg) rotateY(${gx}deg) translateY(${(1 - k) * 90 - sale * 60}px) scale(${(0.86 + 0.14 * k) * (1 + 0.035 * latido)})`}}>
        {/* etiqueta */}
        <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 26, letterSpacing: '0.24em', textTransform: 'uppercase', color: pal.a(0.95), marginBottom: 18, opacity: clamp(k * 2)}}>
          {String(d.etiqueta || '')}
        </div>
        <div style={{position: 'relative', display: 'inline-block'}}>
          {/* relieve: capas detrás, de oscuro a color */}
          {Array.from({length: CAPAS}).map((_, i) => {
            const z = (CAPAS - i) * 3.4;
            const mez = i / CAPAS;
            return (
              <div key={i} aria-hidden="true" style={{position: 'absolute', inset: 0, fontFamily: OUTFIT, fontWeight: 900, fontSize: tam, lineHeight: 1.02,
                letterSpacing: '-0.045em', color: i === CAPAS - 1 ? pal.hondo : `rgba(${18 + mez * 40},${10 + mez * 8},${14 + mez * 20},1)`,
                transform: `translate3d(${-z * 0.5}px, ${z * 0.62}px, ${-z}px)`, whiteSpace: 'pre-wrap'}}>
                {texto}
              </div>
            );
          })}
          <div style={{position: 'relative', fontFamily: OUTFIT, fontWeight: 900, fontSize: tam, lineHeight: 1.02, letterSpacing: '-0.045em',
            color: pal.tinta, whiteSpace: 'pre-wrap', textShadow: `0 0 60px ${pal.a(0.45)}`}}>
            {texto}
          </div>
        </div>
        {apoyo ? (
          <div style={{marginTop: 26, fontFamily: OUTFIT, fontWeight: 700, fontSize: 46, letterSpacing: '-0.02em', color: pal.tinta2,
            opacity: clamp(kA * 1.5), transform: `translateY(${(1 - kA) * 20}px)`}}>
            {apoyo}
          </div>
        ) : null}
      </div>
    </div>
  );
};

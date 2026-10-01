// Rejilla de tomas — con profundidad. Tres o cuatro tomas tuyas entran DETRÁS de ti, en marcos finos, una tras otra.
// Sirve para enseñar trabajos, platos, antes y después, mientras sigues hablando delante.
import React from 'react';
import {OffthreadVideo} from 'remotion';
import {MONO} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';

type Toma = {video?: string; desde?: number; pie?: string};

export const Galeria: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte} = useG();
  const d = p.datos || {};
  const tomas: Toma[] = (d.tomas || []).slice(0, 4);
  const tm: number[] = p.marcas || [];
  const sale = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);
  if (parte === 'delante' || !tomas.length) return null;

  const cols = tomas.length > 2 ? 2 : 1;
  const an = cols === 2 ? 372 : 520;
  const al = Math.round(an * 1.18);
  const gap = 26;
  const x0 = Math.round((1080 - (cols * an + (cols - 1) * gap)) / 2);
  const y0 = Math.round(Hd * 0.135);

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
      <div style={{position: 'absolute', left: 80, right: 80, top: y0 - 52, textAlign: 'center', fontFamily: MONO,
        fontWeight: 500, fontSize: 26, letterSpacing: '0.26em', textTransform: 'uppercase', color: pal.tinta2,
        opacity: clamp(sp(t, p.t0 + 0.3, {damping: 16, stiffness: 90, mass: 1}) * 1.6)}}>
        {String(d.titulo || '')}
      </div>
      {tomas.map((toma, i) => {
        const ti = tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 0.85;
        const k = sp(t, ti, {damping: 14, stiffness: 105, mass: 0.92});
        const x = x0 + (i % cols) * (an + gap);
        const y = y0 + Math.floor(i / cols) * (al + gap);
        const lado = i % 2 === 0 ? -1 : 1;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: an, height: al, borderRadius: 22,
            overflow: 'hidden', opacity: clamp(k * 1.8),
            transform: `translate(${lado * (1 - k) * 46}px, ${(1 - k) * 26}px) scale(${0.9 + 0.1 * k})`,
            filter: k < 0.98 ? `blur(${((1 - k) * 14).toFixed(1)}px)` : undefined,
            boxShadow: `inset 0 0 0 1.5px rgba(244,236,231,.30), 0 34px 80px -34px rgba(0,0,0,.95)`}}>
            {toma.video ? (
              <OffthreadVideo src={String(toma.video)} startFrom={Math.max(0, Math.round(Number(toma.desde || 0) * 30))}
                muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            ) : <div style={{width: '100%', height: '100%', background: `linear-gradient(150deg, ${pal.a(0.3)}, rgba(14,10,12,.9))`}} />}
            {toma.pie ? (
              <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, padding: '46px 18px 14px',
                background: 'linear-gradient(0deg, rgba(8,5,7,.88), transparent)', fontFamily: MONO, fontWeight: 500,
                fontSize: 21, letterSpacing: '0.12em', textTransform: 'uppercase', color: pal.tinta, textAlign: 'center'}}>
                {toma.pie}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

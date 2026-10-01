// Panel de puntos — con profundidad. Un panel de vidrio esmerilado se abre DETRÁS de ti y los puntos van cayendo
// uno a uno, cada uno cuando lo dices. Letra fina, sin cajas: se lee como una lámina de cristal en la habitación.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';

export const Panel: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte} = useG();
  const d = p.datos || {};
  const puntos: string[] = (d.puntos || d.items || []).slice(0, 4);
  const tm: number[] = p.marcas || [];
  const sale = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);
  if (parte === 'delante' || !puntos.length) return null;

  const abre = sp(t, p.t0 + 0.25, {damping: 17, stiffness: 72, mass: 1});
  const top = Math.round(Hd * 0.13);
  const alto = 156 + puntos.length * 104;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
      <div style={{position: 'absolute', left: 84, right: 84, top: top, height: alto * abre, overflow: 'hidden',
        borderRadius: 34, transformOrigin: '50% 0%',
        background: 'linear-gradient(155deg, rgba(16,11,14,.80), rgba(9,6,8,.72))',
        boxShadow: `inset 0 0 0 1.5px rgba(244,236,231,.22), 0 40px 90px -40px rgba(0,0,0,.95)`}}>
        <div style={{position: 'absolute', left: 46, top: 42, fontFamily: MONO, fontWeight: 500, fontSize: 25,
          letterSpacing: '0.26em', textTransform: 'uppercase', color: pal.acento, opacity: clamp(abre * 2)}}>
          {String(d.titulo || '')}
        </div>
        {puntos.map((txt, i) => {
          const ti = tm[i] != null ? tm[i] : p.t0 + 0.9 + i * 1.3;
          const k = sp(t, ti, {damping: 15, stiffness: 100, mass: 0.9});
          const y = 128 + i * 104;
          const tam = String(txt).length > 28 ? 42 : 50;
          return (
            <div key={i} style={{position: 'absolute', left: 46, right: 40, top: y, display: 'flex', alignItems: 'center', gap: 22,
              opacity: clamp(k * 1.7), transform: `translateY(${(1 - k) * 26}px)`,
              filter: k < 0.98 ? `blur(${((1 - k) * 10).toFixed(1)}px)` : undefined}}>
              <span style={{flex: 'none', width: 12, height: 12, borderRadius: 99, background: pal.acento,
                boxShadow: `0 0 20px ${pal.a(0.8)}`, transform: `scale(${clamp(k * 1.4)})`}} />
              <span style={{fontFamily: OUTFIT, fontWeight: 700, fontSize: tam, lineHeight: 1.1, letterSpacing: '-0.02em',
                color: pal.tinta, textShadow: '0 6px 24px rgba(0,0,0,.6)'}}>{txt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

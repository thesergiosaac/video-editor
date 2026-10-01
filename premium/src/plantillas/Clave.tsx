// Palabra clave — con profundidad. Las palabras van DETRÁS de ti y se relevan: cada una entra desde abajo con
// desenfoque mientras la anterior se va hacia arriba. Una raya fina las acompaña. Nada más: es su fuerza.
import React from 'react';
import {OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';

export const Clave: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte} = useG();
  const d = p.datos || {};
  const palabras: string[] = (d.palabras || d.items || []).slice(0, 4);
  const tm: number[] = p.marcas || [];
  const sale = rampa(t, p.t1 - 0.8, p.t1 - 0.28, EASE.sale);
  if (parte === 'delante' || !palabras.length) return null;

  const y = Math.round(Hd * 0.17);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
      {palabras.map((w, i) => {
        const ti = tm[i] != null ? tm[i] : p.t0 + 0.5 + i * 1.6;
        const tf = tm[i + 1] != null ? tm[i + 1] : p.t1 - 0.6;
        const k = sp(t, ti, {damping: 15, stiffness: 95, mass: 0.95});
        const fuera = rampa(t, tf - 0.25, tf + 0.3, EASE.sale);
        if (t < ti - 0.5 || fuera >= 0.999) return null;
        const texto = String(w).toUpperCase();
        const tam = Math.min(210, Math.floor(1000 / Math.max(3, texto.length * 0.62)));
        const op = clamp(k * 1.7) * (1 - fuera);
        const dy = (1 - k) * 80 - fuera * 70;
        return (
          <div key={i} style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', opacity: op,
            transform: `translateY(${dy}px)`, filter: k < 0.985 || fuera > 0.01 ? `blur(${((1 - k) * 20 + fuera * 16).toFixed(1)}px)` : undefined}}>
            <div style={{fontFamily: OUTFIT, fontWeight: 900, fontSize: tam, lineHeight: 1.02, letterSpacing: '-0.05em',
              color: pal.tinta, textShadow: '0 22px 60px rgba(0,0,0,.75)'}}>
              {texto}
            </div>
            <div style={{margin: '26px auto 0', width: Math.round(texto.length * tam * 0.44), maxWidth: 820, height: 3,
              background: pal.acento, borderRadius: 9, boxShadow: `0 0 26px ${pal.a(0.6)}`,
              transform: `scaleX(${clamp(rampa(t, ti + 0.18, ti + 0.7, EASE.llega))})`, transformOrigin: '50% 50%'}} />
          </div>
        );
      })}
    </div>
  );
};

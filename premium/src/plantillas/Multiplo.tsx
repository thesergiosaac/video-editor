// Múltiplo — encima del video. «×3»: una fila de figuras se va repitiendo hasta llegar al número, para que
// se VEA cuántas veces es, no solo se oiga. Para «el triple», «la mitad», «cinco veces más».
import React from 'react';
import {OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Etiqueta, Letras, Tambor, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 546, PAD = 50;

export const Multiplo: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const veces = Math.max(2, Math.min(8, Math.round(Number(d.veces) || 3)));
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const llega = tc + 0.28 * veces + 0.45;
  const latido = golpe(t, llega, 5, 2.4);
  const num = rampa(t, tc, llega - 0.1, EASE.llega) * veces;
  const an = Math.min(152, Math.floor((ANCHO - PAD * 2 - 24 * (veces - 1)) / veces));

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={ALTO} entra={ENTRA} sale={SALE} semilla="mult" brillos={[llega + 0.35]}>
      <div style={{position: 'absolute', left: PAD, top: 34}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>

      {/* el número, enorme */}
      <div style={{position: 'absolute', left: PAD, top: 92, display: 'flex', alignItems: 'baseline',
        fontFamily: OUTFIT, fontWeight: 900, letterSpacing: '-0.05em', color: pal.acento,
        transform: `scale(${1 + 0.05 * latido})`, transformOrigin: '0% 50%', textShadow: `0 0 56px ${pal.a(0.4)}`}}>
        <span style={{fontSize: 96, opacity: 0.55, marginRight: 4}}>×</span>
        <span style={{fontSize: 168, lineHeight: 1}}>
          <Tambor pos={num} final={veces} vel={num - rampa(t - 1 / 30, tc, llega - 0.1, EASE.llega) * veces} />
        </span>
      </div>
      <div style={{position: 'absolute', left: PAD + 300, right: PAD, top: 126, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 18 ? 46 : 56, lineHeight: 1.06, letterSpacing: '-0.03em',
        color: pal.tinta}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.4} paso={0.8 / 30} subir={38} />
      </div>

      {/* las figuras que se repiten */}
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 286, display: 'flex', gap: 24, alignItems: 'flex-end'}}>
        {Array.from({length: veces}).map((_, i) => {
          const ti = tc + i * 0.28;
          const k = sp(t, ti, {damping: 12, stiffness: 150, mass: 0.85});
          const ultimo = i === veces - 1;
          return (
            <div key={i} style={{width: an, height: an * 1.12, borderRadius: 22, flex: 'none',
              background: ultimo ? `linear-gradient(170deg, ${pal.claro}, ${pal.acento})` : 'rgba(244,236,231,.13)',
              boxShadow: ultimo ? `0 14px 34px -12px ${pal.a(0.85)}, inset 0 2px 0 rgba(255,255,255,.35)`
                                : 'inset 0 0 0 1.5px rgba(244,236,231,.18)',
              opacity: clamp(k * 1.8), transform: `translateY(${(1 - k) * 34}px) scale(${0.7 + 0.3 * k})`}} />
          );
        })}
      </div>
      {d.pie ? (
        <div style={{position: 'absolute', left: PAD, right: PAD, top: 286 + Math.round(an * 1.12) + 30, fontFamily: OUTFIT, fontWeight: 700,
          fontSize: 32, letterSpacing: '-0.01em', color: pal.tinta2,
          opacity: clamp(sp(t, llega + 0.2, RESORTES.carta) * 1.5)}}>
          {String(d.pie)}
        </div>
      ) : null}
      <Chispas t0={llega} x={PAD + (an + 24) * (veces - 0.5)} y={286 + an * 0.56} n={18} semilla="mult" fuerza={700} />
    </Tarjeta>
  );
};

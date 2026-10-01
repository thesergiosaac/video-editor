// Cuota — pantalla partida. «De cada diez, cuatro»: diez figuras y se encienden las que cuentan, una a una.
// Es el hermano de mano del porcentaje: cuando hablas de personas o de veces, se entiende mucho mejor así.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, golpe, sp, useG, useT} from '../lib/anim';
import {Chispas, Cifra, Escribir} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const COLS = 5, AN = 116, ALTO_F = 150, HUECO = 22;

export const Cuota: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const total = Math.max(2, Math.min(10, Math.round(Number(d.total) || 10)));
  const llenas = Math.max(0, Math.min(total, Math.round(Number(d.llenas) || 0)));
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const {op, dy, sale} = usePresenciaGrupo();
  const paso = 0.17;
  const llega = tc + paso * llenas + 0.4;
  const latido = golpe(t, llega, 5, 2.3);
  const top = Math.round(Hd * 0.45);
  const anchoRejilla = COLS * AN + (COLS - 1) * HUECO;
  const x0 = Math.round((1080 - anchoRejilla) / 2);
  if (op <= 0.001) return null;

  return (
    <div style={{position: 'absolute', left: 0, top: top, width: 1080, height: Math.round(Hd * 0.5), opacity: op,
      transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      <div style={{position: 'absolute', left: 70, right: 70, top: 0, textAlign: 'center', fontFamily: MONO,
        fontWeight: 500, fontSize: 26, letterSpacing: '0.2em', textTransform: 'uppercase', color: pal.tinta2,
        whiteSpace: 'nowrap'}}>
        <Escribir texto={String(d.etiqueta || '')} t0={p.t0 + 0.35} velocidad={1.4} />
      </div>

      {/* la cuenta, grande */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 46, textAlign: 'center', fontFamily: OUTFIT,
        fontWeight: 900, fontSize: 92, lineHeight: 1, letterSpacing: '-0.04em', color: pal.tinta,
        transform: `scale(${1 + 0.05 * latido})`}}>
        <span style={{color: pal.acento, textShadow: `0 0 40px ${pal.a(0.45)}`}}>
          <Cifra texto={String(llenas)} t0={tc} dur={0.8} />
        </span>
        <span style={{fontSize: 52, color: pal.tinta3, margin: '0 14px'}}>de</span>
        <span style={{color: pal.tinta2}}>{total}</span>
      </div>

      {/* las figuras */}
      <div style={{position: 'absolute', left: x0, top: 176, width: anchoRejilla, display: 'flex', flexWrap: 'wrap', gap: HUECO}}>
        {Array.from({length: total}).map((_, i) => {
          const on = i < llenas;
          const ti = on ? tc + i * paso : tc;
          const k = sp(t, ti, {damping: 12, stiffness: 160, mass: 0.85});
          return (
            <svg key={i} width={AN} height={ALTO_F} viewBox="0 0 116 150" style={{display: 'block', overflow: 'visible',
              opacity: clamp(k * 2) * (on ? 1 : 0.5), transform: `translateY(${(1 - k) * 26}px) scale(${on ? 0.72 + 0.28 * k : 1})`}}>
              <circle cx={58} cy={34} r={27} fill={on ? pal.acento : 'rgba(244,236,231,.16)'}
                style={{filter: on ? `drop-shadow(0 0 16px ${pal.a(0.6)})` : undefined}} />
              <path d="M12 146 V102 C12 74 32 58 58 58 C84 58 104 74 104 102 V146 Q104 150 99 150 H17 Q12 150 12 146 Z"
                fill={on ? pal.acento : 'rgba(244,236,231,.16)'}
                style={{filter: on ? `drop-shadow(0 6px 20px ${pal.a(0.45)})` : undefined}} />
            </svg>
          );
        })}
      </div>

      {d.titulo ? (
        <div style={{position: 'absolute', left: 80, right: 80, top: 176 + ALTO_F * 2 + HUECO + 26, textAlign: 'center',
          fontFamily: OUTFIT, fontWeight: 900, fontSize: String(d.titulo).length > 26 ? 48 : 58, lineHeight: 1.06,
          letterSpacing: '-0.03em', color: pal.tinta, opacity: clamp(sp(t, llega + 0.15, RESORTES.carta) * 1.5),
          transform: `translateY(${(1 - sp(t, llega + 0.15, RESORTES.carta)) * 20}px)`,
          textShadow: '0 10px 40px rgba(0,0,0,.8)'}}>
          {String(d.titulo)}
        </div>
      ) : null}
      <Chispas t0={llega} x={x0 + ((llenas - 1) % COLS) * (AN + HUECO) + AN / 2}
        y={176 + Math.floor((llenas - 1) / COLS) * (ALTO_F + HUECO) + 70} n={18} semilla="cuota" fuerza={680} />
    </div>
  );
};

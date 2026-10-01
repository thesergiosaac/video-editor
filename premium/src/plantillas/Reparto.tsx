// Reparto — pantalla partida. Un anillo que se va llenando por trozos, cada trozo cuando lo dices, con su
// nombre y su porcentaje al lado. Para «de cada 100, tanto va aquí y tanto allá».
import React, {useMemo} from 'react';
import {evolvePath, getLength} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Cifra, Escribir} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const CX = 300, R = 150, GRUESO = 52;
const ANILLO = `M ${CX} ${CX - R} A ${R} ${R} 0 1 1 ${CX} ${CX + R} A ${R} ${R} 0 1 1 ${CX} ${CX - R}`;

export const Reparto: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const items: [string, number][] = (d.items || []).slice(0, 4);
  const tm: number[] = p.marcas || [];
  const {op, dy, sale} = usePresenciaGrupo();
  const total = items.reduce((a, [, v]) => a + v, 0) || 100;
  const largo = useMemo(() => getLength(ANILLO), []);
  const top = Math.round(Hd * 0.45);
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.6 + i * 1.1);
  const TONOS = [1, 0.62, 0.38, 0.22];
  if (op <= 0.001 || !items.length) return null;

  let acumulado = 0;
  const trozos = items.map(([nombre, valor], i) => {
    const desde = acumulado / total;
    acumulado += valor;
    const hasta = acumulado / total;
    return {nombre, valor, desde, hasta, i};
  });

  return (
    <div style={{position: 'absolute', left: 0, top: top, width: 1080, height: Math.round(Hd * 0.5), opacity: op,
      transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      <div style={{position: 'absolute', left: 78, right: 78, top: -6, fontFamily: MONO, fontWeight: 500, fontSize: 26,
        letterSpacing: '0.2em', textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap'}}>
        <Escribir texto={String(d.titulo || '')} t0={p.t0 + 0.35} velocidad={1.4} />
      </div>

      <svg width={600} height={600} style={{position: 'absolute', left: 30, top: 44, overflow: 'visible'}}>
        <path d={ANILLO} fill="none" stroke="rgba(244,236,231,.08)" strokeWidth={GRUESO} strokeLinecap="butt" />
        {trozos.map(({desde, hasta, i}) => {
          const k = clamp(rampa(t, cuando(i), cuando(i) + 0.7, EASE.llega));
          const fin = desde + (hasta - desde) * k;
          if (fin <= desde + 0.0005) return null;
          const d1 = evolvePath(fin, ANILLO);
          const off = largo * desde;
          return (
            <path key={i} d={ANILLO} fill="none" stroke={pal.acento} strokeOpacity={TONOS[i % TONOS.length]}
              strokeWidth={GRUESO} strokeLinecap="butt"
              strokeDasharray={`${Math.max(0.01, largo * (fin - desde))} ${largo}`}
              strokeDashoffset={-off}
              style={{filter: i === 0 ? `drop-shadow(0 0 18px ${pal.a(0.5)})` : undefined}} />
          );
        })}
      </svg>

      {/* el trozo grande, en el centro */}
      <div style={{position: 'absolute', left: 30, top: 44, width: 600, height: 600, display: 'grid', placeItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: OUTFIT, fontWeight: 900, fontSize: 104, lineHeight: 1, letterSpacing: '-0.04em',
            color: pal.tinta, textShadow: `0 0 40px ${pal.a(0.3)}`}}>
            <Cifra texto={`${Math.round((items[0][1] / total) * 100)}%`} t0={cuando(0)} dur={0.9} />
          </div>
          <div style={{marginTop: 6, fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: pal.tinta3, opacity: clamp(sp(t, cuando(0) + 0.4, RESORTES.carta) * 1.4)}}>
            {items[0][0]}
          </div>
        </div>
      </div>

      {/* la lista, al lado */}
      <div style={{position: 'absolute', left: 620, right: 60, top: 116}}>
        {trozos.map(({nombre, valor, i}) => {
          const k = sp(t, cuando(i), RESORTES.carta);
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30,
              opacity: clamp(k * 1.6), transform: `translateX(${(1 - k) * 34}px)`}}>
              <span style={{flex: 'none', width: 18, height: 18, borderRadius: 6, background: pal.acento,
                opacity: TONOS[i % TONOS.length], boxShadow: i === 0 ? `0 0 16px ${pal.a(0.8)}` : undefined}} />
              <span style={{flex: 1, fontFamily: OUTFIT, fontWeight: 800, fontSize: 34, letterSpacing: '-0.015em',
                color: pal.tinta, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{nombre}</span>
              <span style={{fontFamily: OUTFIT, fontWeight: 900, fontSize: 36, color: pal.tinta2,
                fontVariantNumeric: 'tabular-nums'}}>{Math.round((valor / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

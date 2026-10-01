// Ranking — encima del video. Barras que crecen una tras otra, cada una cuando la dices; la primera se lleva
// el color de tu marca y su chispazo. Para «los que más», «los que menos», «el top de…».
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Cifra, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, CAB = 172, FILA = 96, PAD = 44;

export const Ranking: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const items: [string, number][] = (d.items || []).slice(0, 5);
  const n = items.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 0.85);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const max = Math.max(...items.map(([, v]) => v), 1);
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const alto = (tt: number) => CAB + 48 + FILA * items.reduce((a, _, i) => a + sp(tt, cuando(i) - 0.16, RESORTES.carta), 0);
  const tamTit = String(d.titulo || '').length > 24 ? 46 : 56;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={alto} hMax={CAB + 48 + FILA * n} entra={ENTRA} sale={SALE} semilla="rank"
      brillos={[cuando(n - 1) + 0.5]}>
      <div style={{position: 'absolute', left: PAD, top: 34}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 82, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: tamTit, lineHeight: 1.05, letterSpacing: '-0.03em', color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={38} />
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: ANCHO, height: alto(t), overflow: 'hidden', borderRadius: 54}}>
        {items.map(([nombre, valor], i) => {
          const ti = cuando(i);
          const k = sp(t, ti, {damping: 15, stiffness: 105, mass: 0.9});
          const barra = rampa(t, ti + 0.05, ti + 0.85, EASE.llega) * (valor / max);
          const primero = i === 0;
          const y = CAB + i * FILA;
          return (
            <div key={i} style={{position: 'absolute', left: PAD, right: PAD, top: y, height: FILA - 20,
              opacity: clamp(k * 1.7), transform: `translateX(${(1 - k) * -60}px)`}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 10}}>
                <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: '0.14em',
                  color: primero ? pal.acento : pal.tinta3, width: 34, flex: 'none'}}>{i + 1}</span>
                <span style={{flex: 1, fontFamily: OUTFIT, fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em',
                  color: primero ? pal.tinta : 'rgba(244,236,231,.78)', whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis'}}>{nombre}</span>
                <span style={{fontFamily: OUTFIT, fontWeight: 900, fontSize: 42, letterSpacing: '-0.03em',
                  color: primero ? pal.acento : pal.tinta2, fontVariantNumeric: 'tabular-nums',
                  textShadow: primero ? `0 0 26px ${pal.a(0.45)}` : undefined}}>
                  <Cifra texto={`${Math.round(valor)}${sufijo}`} t0={ti + 0.1} dur={0.75} />
                </span>
              </div>
              <div style={{position: 'relative', height: 12, borderRadius: 99, background: 'rgba(244,236,231,.09)', overflow: 'hidden'}}>
                <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(barra * 100).toFixed(1)}%`,
                  borderRadius: 99, background: primero ? `linear-gradient(90deg, ${pal.claro}, ${pal.acento})` : 'rgba(244,236,231,.34)',
                  boxShadow: primero ? `0 0 20px ${pal.a(0.6)}` : undefined}} />
              </div>
            </div>
          );
        })}
      </div>
      {n ? <Chispas t0={cuando(0) + 0.75} x={ANCHO - 120} y={CAB + 26} n={16} semilla="rank" fuerza={620} /> : null}
    </Tarjeta>
  );
};

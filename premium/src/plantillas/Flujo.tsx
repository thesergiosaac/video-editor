// Flujo — encima del video. Tres o cuatro pasos encadenados con su flecha: lo que pasa primero, lo que pasa
// después y en qué acaba. Para explicar un proceso corto, no una lista suelta.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 46;

export const Flujo: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const pasos: string[] = (d.pasos || d.items || []).slice(0, 4);
  const n = pasos.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 1.2);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const CAJA = 108, HUECO = 52;
  const cab = 150;
  const h = cab + n * CAJA + (n - 1) * HUECO + PAD;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={h} entra={ENTRA} sale={SALE} semilla="flujo" brillos={[cuando(n - 1) + 0.5]}>
      <div style={{position: 'absolute', left: PAD, top: 32}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 80, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 24 ? 46 : 56, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={38} />
      </div>

      {pasos.map((txt, i) => {
        const ti = cuando(i);
        const k = sp(t, ti, {damping: 14, stiffness: 115, mass: 0.9});
        const y = cab + i * (CAJA + HUECO);
        const ultimo = i === n - 1;
        const flecha = rampa(t, ti + 0.35, ti + 0.75, EASE.llega);
        const FL = `M ${ANCHO / 2} 6 L ${ANCHO / 2} ${HUECO - 16}`;
        return (
          <div key={i}>
            <div style={{position: 'absolute', left: PAD, right: PAD, top: y, height: CAJA, borderRadius: 26,
              display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px', overflow: 'hidden',
              opacity: clamp(k * 1.7), transform: `translateY(${(1 - k) * 26}px) scale(${0.96 + 0.04 * k})`,
              background: ultimo ? `linear-gradient(120deg, ${pal.a(0.22)}, rgba(16,11,14,.5))` : 'rgba(255,255,255,.055)',
              boxShadow: ultimo ? `inset 0 0 0 1.5px ${pal.a(0.5)}` : 'inset 0 0 0 1px rgba(255,255,255,.08)'}}>
              <span style={{flex: 'none', width: 52, height: 52, borderRadius: 99, display: 'grid', placeItems: 'center',
                fontFamily: MONO, fontWeight: 500, fontSize: 24, color: ultimo ? pal.sobre : pal.tinta2,
                background: ultimo ? pal.acento : 'rgba(255,255,255,.10)'}}>{i + 1}</span>
              <span style={{flex: 1, fontFamily: OUTFIT, fontWeight: 800, fontSize: txt.length > 26 ? 36 : 42,
                letterSpacing: '-0.02em', color: pal.tinta, whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis'}}>{txt}</span>
            </div>
            {i < n - 1 ? (
              <svg width={ANCHO} height={HUECO} style={{position: 'absolute', left: 0, top: y + CAJA, overflow: 'visible'}}>
                <path d={FL} stroke={pal.a(0.75)} strokeWidth={4} strokeLinecap="round" fill="none" {...evolvePath(flecha, FL)} />
                {flecha > 0.85 ? (
                  <path d={`M ${ANCHO / 2 - 9} ${HUECO - 24} L ${ANCHO / 2} ${HUECO - 12} L ${ANCHO / 2 + 9} ${HUECO - 24}`}
                    stroke={pal.a(0.75)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ) : null}
              </svg>
            ) : null}
          </div>
        );
      })}
      {n ? <Chispas t0={cuando(n - 1) + 0.4} x={ANCHO / 2} y={cab + (n - 1) * (CAJA + HUECO) + CAJA / 2}
        n={18} semilla="flujo" fuerza={640} /> : null}
    </Tarjeta>
  );
};

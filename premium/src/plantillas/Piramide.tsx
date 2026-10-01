// Pirámide — encima del video. Capas apiladas que se construyen de abajo arriba: lo que va primero, lo que va
// encima y qué hay en la cima. Para prioridades, niveles y «esto no se sostiene sin aquello».
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, sp, useG, useT} from '../lib/anim';
import {Chispas, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 46, CAPA = 92, SEP = 12;

export const Piramide: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  // se dan de abajo arriba: la base primero
  const capas: string[] = (d.capas || d.items || []).slice(0, 4);
  const n = capas.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 1.0);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const cab = 148;
  const h = cab + n * (CAPA + SEP) + PAD;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={h} entra={ENTRA} sale={SALE} semilla="pir" brillos={[cuando(n - 1) + 0.5]}>
      <div style={{position: 'absolute', left: PAD, top: 32}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 80, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 24 ? 46 : 56, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={38} />
      </div>

      {capas.map((txt, i) => {
        const ti = cuando(i);
        const k = sp(t, ti, {damping: 13, stiffness: 120, mass: 0.9});
        // la base es la más ancha; se dibuja abajo del todo
        const desdeArriba = n - 1 - i;
        const y = cab + desdeArriba * (CAPA + SEP);
        const an = ANCHO - PAD * 2 - i * 96;   // i = 0 es la base: la más ancha
        const x = (ANCHO - an) / 2;
        const cima = i === n - 1;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: an, height: CAPA, borderRadius: 18,
            display: 'grid', placeItems: 'center', padding: '0 22px', overflow: 'hidden',
            opacity: clamp(k * 1.7), transform: `translateY(${(1 - k) * 30}px) scale(${0.94 + 0.06 * k})`,
            background: cima ? `linear-gradient(150deg, ${pal.claro}, ${pal.acento})`
                             : `rgba(255,255,255,${(0.05 + i * 0.03).toFixed(3)})`,
            boxShadow: cima ? `0 16px 40px -14px ${pal.a(0.8)}, inset 0 2px 0 rgba(255,255,255,.35)`
                            : 'inset 0 0 0 1px rgba(255,255,255,.10)'}}>
            <span style={{fontFamily: OUTFIT, fontWeight: cima ? 900 : 800, fontSize: txt.length > 22 ? 34 : 40,
              letterSpacing: '-0.02em', color: cima ? pal.sobre : pal.tinta, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis'}}>{txt}</span>
          </div>
        );
      })}
      {n ? <Chispas t0={cuando(n - 1) + 0.35} x={ANCHO / 2} y={cab + CAPA / 2} n={18} semilla="pir" fuerza={660} /> : null}
    </Tarjeta>
  );
};

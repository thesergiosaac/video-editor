// Claves — encima del video. Tres tarjetitas en fila que entran una por una, cada una con su número y su
// frase corta. Es el resumen de lo dicho: lo que hay que recordar cuando acabe el video.
import React from 'react';
import {OUTFIT} from '../tema';
import {RESORTES, clamp, sp, useG, useT} from '../lib/anim';
import {Chispas, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 40;

export const Claves: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const claves: string[] = (d.claves || d.items || []).slice(0, 3);
  const n = claves.length || 1;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 0.85);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const hueco = 18;
  const an = Math.floor((ANCHO - PAD * 2 - hueco * (n - 1)) / n);
  const cab = 158, CAJA = 260;
  const h = cab + CAJA + PAD;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={h} entra={ENTRA} sale={SALE} semilla="clav" brillos={[cuando(n - 1) + 0.5]}>
      <div style={{position: 'absolute', left: PAD, top: 32}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 80, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 24 ? 46 : 56, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={38} />
      </div>

      {claves.map((txt, i) => {
        const ti = cuando(i);
        const k = sp(t, ti, {damping: 13, stiffness: 125, mass: 0.88});
        const x = PAD + i * (an + hueco);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: cab, width: an, height: CAJA, borderRadius: 26,
            padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden',
            opacity: clamp(k * 1.7), transform: `translateY(${(1 - k) * 34}px) scale(${0.92 + 0.08 * k})`,
            background: 'linear-gradient(160deg, rgba(255,255,255,.085), rgba(255,255,255,.03))',
            boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,.10), 0 22px 50px -22px rgba(0,0,0,.9)`}}>
            <span style={{flex: 'none', width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center',
              fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: pal.sobre,
              background: `linear-gradient(180deg, ${pal.claro}, ${pal.acento})`,
              boxShadow: `0 10px 24px -8px ${pal.a(0.8)}`,
              transform: `scale(${sp(t, ti + 0.08, RESORTES.pop).toFixed(3)})`}}>
              {i + 1}
            </span>
            <span style={{flex: 1, fontFamily: OUTFIT, fontWeight: 800, fontSize: txt.length > 30 ? 30 : 36,
              lineHeight: 1.14, letterSpacing: '-0.02em', color: pal.tinta}}>{txt}</span>
          </div>
        );
      })}
      <Chispas t0={cuando(n - 1) + 0.35} x={PAD + (n - 0.5) * (an + hueco) - hueco} y={cab + CAJA / 2}
        n={18} semilla="clav" fuerza={640} />
    </Tarjeta>
  );
};

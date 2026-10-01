// Tabla — encima del video. Dos columnas y unas cuantas filas: lo que sí trae una y lo que no trae la otra,
// con su visto y su cruz dibujándose. Para comparar dos opciones punto por punto.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 40, FILA = 84;
const COL = 150;                                   // ancho de cada columna de marcas
const CHEQUE = 'M 10 21 L 18 29 L 32 13';
const CRUZ1 = 'M 12 12 L 30 30', CRUZ2 = 'M 30 12 L 12 30';

export const Tabla: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  // cada fila: [texto, ¿la tiene A?, ¿la tiene B?]
  const filas: [string, boolean, boolean][] = (d.filas || []).slice(0, 5);
  const n = filas.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.8 + i * 0.75);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const cab = 210;
  const h = cab + n * FILA + PAD;
  const xA = ANCHO - PAD - COL * 2, xB = ANCHO - PAD - COL;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={h} entra={ENTRA} sale={SALE} semilla="tabla" brillos={[cuando(n - 1) + 0.5]}>
      <div style={{position: 'absolute', left: PAD, top: 30}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 76, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 24 ? 44 : 52, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={36} />
      </div>

      {/* los nombres de las dos columnas */}
      {[[xA, String(d.a || 'Uno'), false], [xB, String(d.b || 'Otro'), true]].map(([x, txt, es], i) => (
        <div key={i} style={{position: 'absolute', left: Number(x), top: 148, width: COL, textAlign: 'center',
          fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: es ? pal.acento : pal.tinta3, opacity: clamp(sp(t, ENTRA + 0.55, RESORTES.carta) * 1.5),
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
          {String(txt)}
        </div>
      ))}
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 190, height: 2,
        background: 'rgba(244,236,231,.14)', transform: `scaleX(${clamp(rampa(t, ENTRA + 0.5, ENTRA + 1.1, EASE.llega))})`,
        transformOrigin: '0% 50%'}} />

      {filas.map(([txt, ma, mb], i) => {
        const ti = cuando(i);
        const k = sp(t, ti, {damping: 14, stiffness: 120, mass: 0.85});
        const marca = rampa(t, ti + 0.2, ti + 0.6, EASE.llega);
        const y = cab + i * FILA;
        return (
          <div key={i} style={{position: 'absolute', left: PAD, right: PAD, top: y, height: FILA - 12,
            display: 'flex', alignItems: 'center', opacity: clamp(k * 1.7),
            transform: `translateX(${(1 - k) * -40}px)`}}>
            <span style={{flex: 1, fontFamily: OUTFIT, fontWeight: 800, fontSize: txt.length > 26 ? 32 : 38,
              letterSpacing: '-0.015em', color: pal.tinta, whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis', paddingRight: 20}}>{txt}</span>
            {[ma, mb].map((si, j) => (
              <span key={j} style={{flex: 'none', width: COL, display: 'grid', placeItems: 'center'}}>
                <svg width={42} height={42} style={{overflow: 'visible'}}>
                  {si ? (
                    <path d={CHEQUE} fill="none" stroke={j === 1 ? pal.acento : 'rgba(244,236,231,.62)'}
                      strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" {...evolvePath(marca, CHEQUE)} />
                  ) : (
                    <>
                      <path d={CRUZ1} fill="none" stroke="rgba(244,236,231,.30)" strokeWidth={4.5}
                        strokeLinecap="round" {...evolvePath(marca, CRUZ1)} />
                      <path d={CRUZ2} fill="none" stroke="rgba(244,236,231,.30)" strokeWidth={4.5}
                        strokeLinecap="round" {...evolvePath(Math.max(0, marca * 1.3 - 0.3), CRUZ2)} />
                    </>
                  )}
                </svg>
              </span>
            ))}
          </div>
        );
      })}
    </Tarjeta>
  );
};

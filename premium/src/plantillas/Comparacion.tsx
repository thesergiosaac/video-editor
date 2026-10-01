// Antes y después — pantalla completa (tu cara en un círculo arriba). Cada barra crece cuando dices su cifra; si la
// segunda es mucho más grande, una flecha la señala y sale la insignia («×5»).
import React, {useMemo} from 'react';
import {evolvePath, getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Chispas, Cifra, Escribir, tamPara} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const ANCHO_BARRA = 214;
const CXS = [322, 758];

export const Comparacion: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos;
  const [ta, tb] = p.marcas;
  const {op, dy, sale} = usePresenciaGrupo();
  const BASE = Math.round(Hd * 0.552), ALTO_MAX = Math.round(Hd * 0.26);
  const max = Math.max(d.a.valor, d.b.valor) || 1;
  const altos = [ALTO_MAX * Math.max(0.06, d.a.valor / max), ALTO_MAX * Math.max(0.06, d.b.valor / max)];
  const p1 = sp(t, ta, {damping: 12, stiffness: 115, mass: 1});
  const p2 = sp(t, tb, {damping: 10, stiffness: 78, mass: 1.1});
  const aparece = sp(t, p.t0 + 0.35, RESORTES.suave);
  // flecha por el espacio entre las dos barras: de la punta de la de antes a la punta de la de hoy (nunca sube hasta la cara)
  const x0 = CXS[0] + 120, y0 = BASE - altos[0] - 30, x1 = CXS[1] - 130, y1 = BASE - altos[1] + 40;
  const FLECHA = `M ${x0} ${y0} C ${x0 + 30} ${y0 - 170}, ${x1 - 90} ${y1 + 40}, ${x1} ${y1}`;
  const largo = useMemo(() => getLength(FLECHA), [FLECHA]);
  const tf = tb + 0.47, tx = tb + 0.8;
  const pf = d.insignia ? rampa(t, tf, tf + 0.47, EASE.llega) : 0;
  const fin = getPointAtLength(FLECHA, largo * Math.max(0.001, pf)) ?? {x: 0, y: 0};
  const tan = getTangentAtLength(FLECHA, largo * Math.max(0.001, pf)) ?? {x: 1, y: 0};
  const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
  const medio = getPointAtLength(FLECHA, largo * 0.5) ?? {x: 540, y: BASE - ALTO_MAX};
  const xk = sp(t, tx, RESORTES.pop);
  const textos = [d.a, d.b].map((c: any) => (d.prefijo || '') + GRAF.cifra(c.valor, d.decimales) + (d.sufijo || ''));
  const tamValor = Math.min(tamPara(textos[0], 400, 88, 0.62), tamPara(textos[1], 400, 88, 0.62));
  if (op <= 0.001) return null;

  const Barra = (i: number, k: number) => {
    const h = Math.max(0, altos[i] * k);
    const color = i === 1;
    return (
      <React.Fragment key={'b' + i}>
        {color ? <div style={{position: 'absolute', left: CXS[i] - 220, top: BASE - 60, width: 440, height: 120, borderRadius: '50%', background: `radial-gradient(closest-side, ${pal.a(0.45)}, ${pal.a(0)})`, opacity: clamp(k)}} /> : null}
        <div style={{position: 'absolute', left: CXS[i] - ANCHO_BARRA / 2, width: ANCHO_BARRA, top: BASE - h, height: h, borderRadius: '34px 34px 10px 10px', overflow: 'hidden',
          background: color ? `linear-gradient(180deg, ${pal.claro} 0%, ${pal.acento} 38%, ${pal.hondo} 100%)` : 'linear-gradient(180deg, rgba(244,236,231,.46), rgba(244,236,231,.2))',
          boxShadow: color ? `0 0 ${70 * clamp(k)}px ${pal.a(0.45)}, inset 0 2px 0 rgba(255,255,255,.4)` : 'inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1.5px rgba(255,255,255,.1)'}}>
          <div style={{position: 'absolute', left: 16, top: 10, bottom: 0, width: 26, borderRadius: 20, background: 'linear-gradient(90deg, rgba(255,255,255,.28), rgba(255,255,255,0))', opacity: color ? 0.9 : 0.5}} />
          {color ? <Brillo t0={tx + 0.33} w={ANCHO_BARRA} h={Math.max(h, 1)} dur={0.8} fuerza={1.6} /> : null}
        </div>
        <div style={{position: 'absolute', left: CXS[i] - 220, width: 440, top: BASE - altos[i] * k - tamValor * 1.34, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900, fontSize: tamValor,
          lineHeight: 1.2, letterSpacing: '-0.04em', color: color ? pal.acento : pal.tinta, opacity: clamp(k * 3), whiteSpace: 'nowrap',
          textShadow: color ? `0 0 30px ${pal.a(0.35)}` : '0 8px 24px rgba(0,0,0,.4)'}}>
          {k > 0.001 ? <Cifra texto={textos[i]} t0={i === 0 ? ta : tb} dur={0.9} /> : null}
        </div>
      </React.Fragment>
    );
  };

  return (
    <>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd}}>
        <div style={{position: 'absolute', inset: 0, opacity: op, transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 12).toFixed(1)}px)` : undefined}}>
          <div style={{position: 'absolute', top: BASE - ALTO_MAX - 190, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontWeight: 500, fontSize: 28,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap'}}>
            <Escribir texto={d.etiqueta || ''} t0={p.t0 + 0.4} velocidad={1.2} />
          </div>
          <svg width={1080} height={Hd} style={{position: 'absolute', inset: 0}}>
            {[0, 0.25, 0.5, 0.75, 1].map((u, i) => {
              const y = BASE - u * ALTO_MAX;
              const dd = `M 150 ${y} L 930 ${y}`;
              return <path key={i} d={dd} stroke={i === 0 ? 'rgba(244,236,231,.2)' : 'rgba(244,236,231,.07)'} strokeWidth={i === 0 ? 3 : 2} strokeLinecap="round" {...evolvePath(rampa(t, p.t0 + 0.27 + i * 0.1, p.t0 + 0.87 + i * 0.1, EASE.llega), dd)} />;
            })}
          </svg>
          {CXS.map((cx, i) => (
            <div key={i} style={{position: 'absolute', left: cx - ANCHO_BARRA / 2, width: ANCHO_BARRA, top: BASE - ALTO_MAX, height: ALTO_MAX, borderRadius: '34px 34px 10px 10px',
              background: 'linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.05)', opacity: aparece,
              transform: `scaleY(${0.6 + 0.4 * aparece})`, transformOrigin: '50% 100%'}} />
          ))}
          {Barra(0, p1)}
          {Barra(1, p2)}
          {[d.a.texto, d.b.texto].map((tx0: string, i: number) => (
            <div key={i} style={{position: 'absolute', left: CXS[i] - 170, width: 340, top: BASE + 22, textAlign: 'center', fontFamily: MONO, fontWeight: 500, fontSize: 28, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: i === 1 ? pal.tinta : pal.tinta2, opacity: sp(t, i === 0 ? ta - 0.2 : tb - 0.4, RESORTES.suave), whiteSpace: 'nowrap'}}>
              {tx0}
            </div>
          ))}
          <svg width={1080} height={Hd} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            {pf > 0 ? (
              <>
                <path d={FLECHA} fill="none" stroke="rgba(244,236,231,.6)" strokeWidth={5} strokeLinecap="round" {...evolvePath(pf, FLECHA)} />
                {pf > 0.85 ? <path d="M -22 -13 L 0 0 L -22 13" fill="none" stroke="rgba(244,236,231,.6)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"
                  transform={`translate(${fin.x} ${fin.y}) rotate(${ang}) scale(${clamp((pf - 0.85) / 0.15)})`} /> : null}
              </>
            ) : null}
          </svg>
          {d.insignia ? (
            <div style={{position: 'absolute', left: medio.x - 130, top: medio.y - 56, width: 260, display: 'flex', justifyContent: 'center'}}>
              <div style={{position: 'relative', overflow: 'hidden', fontFamily: OUTFIT, fontWeight: 900, fontSize: 66, lineHeight: 1, color: pal.sobre, whiteSpace: 'nowrap',
                background: `linear-gradient(180deg, ${pal.claro}, ${pal.acento})`, borderRadius: 99, padding: '16px 34px 18px', opacity: clamp(xk * 2),
                transform: `scale(${xk}) rotate(${(1 - xk) * -16}deg)`, boxShadow: `0 14px 40px -10px ${pal.a(0.8 * clamp(xk))}, inset 0 2px 0 rgba(255,255,255,.4)`}}>
                {d.insignia}
                <Brillo t0={tx + 0.4} w={200} h={100} dur={0.67} fuerza={2.2} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {d.insignia ? <Chispas t0={tx + 0.03} x={medio.x} y={medio.y} n={24} semilla="x5" fuerza={950} /> : null}
    </>
  );
};

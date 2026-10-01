// Número gigante — encima del video. La cifra rueda en tambores justo cuando la dices; detrás, una curva que crece.
import React, {useMemo} from 'react';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {noise2D} from '@remotion/noise';
// @ts-ignore
import GRAF from '../graficos.js';
import {OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Chispas, Cifra, Etiqueta, Tarjeta, tamPara} from '../lib/Piezas';

const curvaDe = (w: number, h: number) => {
  const pts: [number, number][] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    pts.push([46 + u * (w - 92), h - 48 - Math.pow(u, 1.7) * (h * 0.6) + noise2D('curva', u * 3.2, 0) * 26 * (1 - u * 0.6)]);
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

export const Numero: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos;
  const tc = p.marcas[0];
  const conChip = !!d.chip;
  const T = {x: 86, y: 150, w: 908, h: conChip ? 420 : 340};
  const ENTRA = p.t0, SALE = p.t1 - 0.5, LLEGA = tc + 1.35;
  const texto = (d.prefijo || '') + GRAF.cifra(d.valor, d.decimales) + (d.sufijo || '');
  const tam = tamPara(texto, 800, 200, 0.6);

  const curva = useMemo(() => curvaDe(T.w, T.h), [T.w, T.h]);
  const largo = useMemo(() => getLength(curva), [curva]);
  const pc = rampa(t, tc, LLEGA + 0.13, EASE.llega);
  const punta = getPointAtLength(curva, Math.max(0.01, largo * pc));
  const area = `${curva} L ${T.w - 46} ${T.h} L 46 ${T.h} Z`;
  const latido = golpe(t, LLEGA, 5, 2.4);
  const bloom = t < LLEGA - 0.13 ? 0 : rampa(t, LLEGA - 0.13, LLEGA + 0.1) * (1 - 0.6 * rampa(t, LLEGA + 0.1, LLEGA + 1.33));
  const pil = sp(t, tc + 1.25, RESORTES.pop);

  return (
    <>
      <Tarjeta {...T} entra={ENTRA} sale={SALE} semilla="num" brillos={[LLEGA + 0.4]} muestras={10}>
        <div style={{position: 'absolute', inset: 0, opacity: 0.6, clipPath: `inset(0 ${(1 - pc) * 100}% 0 0)`}}>
          <svg width={T.w} height={T.h} style={{position: 'absolute', inset: 0}}>
            <defs>
              <linearGradient id="n-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={pal.acento} stopOpacity={0.22} />
                <stop offset="1" stopColor={pal.acento} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#n-area)" />
          </svg>
        </div>
        <svg width={T.w} height={T.h} style={{position: 'absolute', inset: 0, opacity: 0.62}}>
          <defs>
            <linearGradient id="n-linea" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={pal.acento} stopOpacity={0.1} />
              <stop offset="1" stopColor={pal.claro} stopOpacity={1} />
            </linearGradient>
          </defs>
          <path d={curva} fill="none" stroke="url(#n-linea)" strokeWidth={5} strokeLinecap="round" {...evolvePath(pc, curva)} />
          {pc > 0.01 && punta ? (
            <>
              <circle cx={punta.x} cy={punta.y} r={24} fill={pal.acento} opacity={0.28} />
              <circle cx={punta.x} cy={punta.y} r={9} fill="#fff" />
            </>
          ) : null}
        </svg>
        <div style={{position: 'absolute', left: T.w / 2 - 330, top: 90, width: 660, height: 260, borderRadius: '50%',
          background: `radial-gradient(closest-side, ${pal.a(0.42)}, ${pal.a(0)})`, opacity: bloom, transform: `scale(${0.7 + 0.3 * clamp(bloom * 1.5)})`}} />
        <div style={{position: 'absolute', top: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <Etiqueta texto={d.etiqueta} t0={ENTRA + 0.13} />
        </div>
        <div style={{position: 'absolute', top: 92 + (200 - tam) * 0.6, left: 0, right: 0, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900, fontSize: tam,
          lineHeight: 1.2, letterSpacing: '-0.045em', color: pal.tinta, textShadow: '0 12px 34px rgba(0,0,0,.45)', transform: `scale(${1 + 0.05 * latido})`, whiteSpace: 'nowrap'}}>
          <Cifra texto={texto} t0={tc} />
        </div>
        {conChip ? (
          <div style={{position: 'absolute', top: 334, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
            <div style={{position: 'relative', overflow: 'hidden', fontFamily: OUTFIT, fontWeight: 800, fontSize: 42, color: pal.sobre, whiteSpace: 'nowrap',
              background: `linear-gradient(180deg, ${pal.claro}, ${pal.acento})`, borderRadius: 99, padding: '10px 30px 12px', opacity: clamp(pil * 2),
              transform: `translateY(${(1 - pil) * 30}px) scale(${pil}) rotate(${(1 - pil) * -12}deg)`, boxShadow: `0 10px 30px -8px ${pal.a(0.65 * clamp(pil))}, inset 0 2px 0 rgba(255,255,255,.35)`}}>
              {d.chip}
              <Brillo t0={tc + 1.65} w={320} h={70} dur={0.73} fuerza={2.2} />
            </div>
          </div>
        ) : null}
      </Tarjeta>
      <Chispas t0={LLEGA} x={540} y={T.y + 92 + (200 - tam) * 0.6 + tam * 0.6} n={26} semilla="num" fuerza={1050} />
    </>
  );
};

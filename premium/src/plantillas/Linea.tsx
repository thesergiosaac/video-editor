// Línea de tiempo — encima del video. El camino sube en escalones y un cometa de luz llega a cada fecha justo cuando la dices.
import React, {useMemo} from 'react';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Etiqueta, Letras, Tarjeta, tamPara} from '../lib/Piezas';

const T = {x: 86, y: 150, w: 908, h: 400};

export const Linea: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos;
  const hitos: {fecha: string; texto: string}[] = d.hitos;
  const n = hitos.length;
  const tm: number[] = p.marcas;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const pos = hitos.map((_, i) => ({x: 150 + (n > 1 ? (i * 608) / (n - 1) : 304), y: 262 - (n > 1 ? (i * 70) / (n - 1) : 0)}));
  const camino = useMemo(() => {
    let s = `M ${pos[0].x} ${pos[0].y}`;
    for (let i = 1; i < n; i++) {
      const a = pos[i - 1], b = pos[i], m = (b.x - a.x) / 2;
      s += ` C ${a.x + m} ${a.y}, ${b.x - m} ${b.y}, ${b.x} ${b.y}`;
    }
    return s;
  }, [n]);
  const largo = useMemo(() => getLength(camino), [camino]);
  // el trazo llega a cada fecha justo cuando se dice (acelera y frena en cada tramo)
  let pc = 0;
  for (let i = 1; i < n; i++) {
    const a = tm[i - 1] + 0.05, b = Math.max(a + 0.3, tm[i]);
    pc += rampa(t, a, b, EASE.inOut) / (n - 1);
  }
  const pista = rampa(t, ENTRA + 0.3, ENTRA + 0.95, EASE.llega);
  const cabeza = getPointAtLength(camino, Math.max(0.01, largo * pc)) ?? {x: 0, y: 0};
  const moviendose = tm.slice(1).some((b, i) => t > tm[i] + 0.05 && t < b + 0.07);
  const ancho = n > 1 ? 608 / (n - 1) - 12 : 400;
  const ult = n - 1;
  return (
    <>
      <Tarjeta {...T} entra={ENTRA} sale={SALE} semilla="linea" brillos={[tm[ult] + 0.87]} muestras={8}>
        <div style={{position: 'absolute', left: 50, top: 40}}>
          <Etiqueta texto={d.titulo || 'Paso a paso'} t0={ENTRA + 0.13} />
        </div>
        <svg width={T.w} height={T.h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <defs>
            <linearGradient id="l-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={pal.claro} />
              <stop offset="1" stopColor={pal.acento} />
            </linearGradient>
          </defs>
          <path d={camino} fill="none" stroke="rgba(244,236,231,.1)" strokeWidth={10} strokeLinecap="round" {...evolvePath(pista, camino)} />
          {pc > 0.001 ? <path d={camino} fill="none" stroke={pal.acento} strokeWidth={22} strokeLinecap="round" opacity={0.35} style={{filter: 'blur(9px)'}} {...evolvePath(pc, camino)} /> : null}
          {pc > 0.001 ? <path d={camino} fill="none" stroke="url(#l-grad)" strokeWidth={10} strokeLinecap="round" {...evolvePath(pc, camino)} /> : null}
          {moviendose ? (
            <>
              <circle cx={cabeza.x} cy={cabeza.y} r={26} fill={pal.acento} opacity={0.35} />
              <circle cx={cabeza.x} cy={cabeza.y} r={10} fill="#fff" />
            </>
          ) : null}
        </svg>
        {hitos.map((h, i) => {
          const ultimo = i === ult;
          const ti = tm[i];
          const k = sp(t, ti - 0.03, RESORTES.pop);
          const pulso = rampa(t, ti, ti + 0.73, EASE.llega);
          const fantasma = sp(t, ENTRA + 0.27 + i * 0.1, RESORTES.suave);
          const cap = sp(t, ti + 0.17, RESORTES.carta);
          const rN = ultimo ? 20 : 16;
          const {x, y} = pos[i];
          const tamF = tamPara(h.fecha, ancho, 56, 0.6);
          return (
            <React.Fragment key={i}>
              {pulso > 0 && pulso < 1 ? <div style={{position: 'absolute', left: x - 70, top: y - 70, width: 140, height: 140, borderRadius: 99, border: `3px solid ${ultimo ? pal.acento : pal.tinta}`, opacity: (1 - pulso) * 0.7, transform: `scale(${0.25 + 0.75 * pulso})`}} /> : null}
              <div style={{position: 'absolute', left: x - rN, top: y - rN, width: rN * 2, height: rN * 2, borderRadius: 99, boxShadow: 'inset 0 0 0 3px rgba(244,236,231,.22)', background: 'rgba(11,7,9,.6)', opacity: fantasma}} />
              <div style={{position: 'absolute', left: x - rN, top: y - rN, width: rN * 2, height: rN * 2, borderRadius: 99, transform: `scale(${k})`,
                background: ultimo ? `radial-gradient(circle at 35% 30%, ${pal.claro}, ${pal.acento})` : `radial-gradient(circle at 35% 30%, #fff, ${pal.tinta})`,
                boxShadow: ultimo ? `0 0 0 ${10 * clamp(k)}px ${pal.a(0.25)}, 0 0 30px ${pal.a(0.8)}` : '0 0 18px rgba(255,255,255,.45)'}} />
              <div style={{position: 'absolute', left: x - ancho / 2, width: ancho, top: y - 42 - tamF * 1.2, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900, fontSize: tamF, lineHeight: 1.2,
                letterSpacing: '-0.02em', color: ultimo ? pal.acento : pal.tinta, textShadow: ultimo ? `0 0 26px ${pal.a(0.4)}` : undefined, whiteSpace: 'nowrap'}}>
                <Letras texto={h.fecha} t0={ti - 0.03} paso={1.6 / 30} subir={36} giroX={-80} />
              </div>
              {h.texto ? (
                <div style={{position: 'absolute', left: x - ancho / 2, width: ancho, top: y + 34, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 700, fontSize: n > 3 ? 30 : 36,
                  lineHeight: 1.1, letterSpacing: '-0.01em', color: pal.tinta, opacity: clamp(cap * 1.4) * 0.82, transform: `translateY(${(1 - cap) * 18}px)`}}>
                  {h.texto}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </Tarjeta>
      <Chispas t0={tm[ult]} x={T.x + pos[ult].x} y={T.y + pos[ult].y} n={24} semilla="linea" fuerza={900} />
    </>
  );
};

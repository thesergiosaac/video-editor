// Medidor — pantalla partida (tu video arriba, el medidor abajo). Una aguja de tablero que sube hasta el porcentaje,
// con sus marcas y el arco encendido. Otra forma de contar un porcentaje, distinta al anillo.
import React, {useMemo} from 'react';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, golpe, sp, useG, useT} from '../lib/anim';
import {Chispas, Escribir, Tambor, posDigito} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

/* Todo se dibuja en una caja de 1080 × 560; el centro del tablero está en (540, 330) */
const CX = 540, CY = 330, R = 232, GRADO = 224;
const ang = (u: number) => ((180 - (GRADO - 180) / 2) + GRADO * u) * Math.PI / 180;
const pto = (u: number, r: number): [number, number] => [CX + Math.cos(ang(u)) * r, CY + Math.sin(ang(u)) * r];

export const Medidor: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const val = Math.max(0, Math.min(100, Number(d.valor) || 0));
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.6;
  const {op, dy, sale} = usePresenciaGrupo();
  const muelle = {damping: 12, stiffness: 60, mass: 1.1};
  const k = sp(t, tc, muelle, 45);
  const kAntes = sp(t - 1 / 30, tc, muelle, 45);
  const u = k * (val / 100);
  const latido = golpe(t, tc + 1.1, 6, 2.4);
  const ARCO = useMemo(() => {
    const [x0, y0] = pto(0, R), [x1, y1] = pto(1, R);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }, []);
  const largo = useMemo(() => getLength(ARCO), [ARCO]);
  const cabeza = getPointAtLength(ARCO, Math.max(0.01, largo * Math.min(u, 0.999)));
  const [ax, ay] = pto(u, R - 46);
  const final = String(Math.round(val));
  const top = Math.round(Hd * 0.45);
  if (op <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, top: top, width: 1080, height: 560, opacity: op, transform: `translateY(${dy}px)`,
      filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      <svg width={1080} height={560} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id="med-arco" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={pal.claro} /><stop offset="1" stopColor={pal.acento} />
          </linearGradient>
        </defs>
        {Array.from({length: 21}).map((_, i) => {
          const uu = i / 20;
          const [x1, y1] = pto(uu, R + 16), [x2, y2] = pto(uu, R + (i % 5 === 0 ? 38 : 26));
          const on = uu <= u + 0.001;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? pal.acento : 'rgba(244,236,231,.25)'}
            strokeWidth={i % 5 === 0 ? 6 : 3} strokeLinecap="round" opacity={clamp(sp(t, p.t0 + 0.4 + i * 0.02, RESORTES.pop))} />;
        })}
        <path d={ARCO} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={30} strokeLinecap="round" />
        {u > 0.002 ? <path d={ARCO} fill="none" stroke={pal.acento} strokeWidth={46} strokeLinecap="round" opacity={0.38} style={{filter: 'blur(17px)'}} {...evolvePath(u, ARCO)} /> : null}
        {u > 0.002 ? <path d={ARCO} fill="none" stroke="url(#med-arco)" strokeWidth={30} strokeLinecap="round" {...evolvePath(u, ARCO)} /> : null}
        {cabeza && u > 0.01 ? (<><circle cx={cabeza.x} cy={cabeza.y} r={28} fill={pal.acento} opacity={0.35} /><circle cx={cabeza.x} cy={cabeza.y} r={11} fill="#fff" /></>) : null}
        <g style={{transform: `scale(${clamp(sp(t, p.t0 + 0.5, RESORTES.carta))})`, transformOrigin: `${CX}px ${CY}px`}}>
          <line x1={CX} y1={CY} x2={ax} y2={ay} stroke={pal.tinta} strokeWidth={11} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={27} fill={pal.tinta} />
          <circle cx={CX} cy={CY} r={12} fill={pal.acento} />
        </g>
      </svg>
      {/* cifra dentro del tablero, encima del eje */}
      <div style={{position: 'absolute', left: 0, right: 0, top: CY - 206, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900,
        fontSize: 112, lineHeight: 1, letterSpacing: '-0.04em', color: pal.tinta, transform: `scale(${1 + 0.05 * latido})`, textShadow: '0 10px 30px rgba(0,0,0,.5)'}}>
        {final.split('').map((ch, i) => (
          <Tambor key={i} pos={posDigito(val * k, Math.pow(10, final.length - 1 - i))} final={ch}
            vel={posDigito(val * k, Math.pow(10, final.length - 1 - i)) - posDigito(val * kAntes, Math.pow(10, final.length - 1 - i))} />
        ))}
        <span style={{fontSize: 60, color: pal.tinta2, marginLeft: 6}}>%</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: CY + 58, textAlign: 'center', fontFamily: MONO, fontWeight: 500,
        fontSize: 27, letterSpacing: '0.18em', textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap'}}>
        <Escribir texto={String(d.etiqueta || '')} t0={p.t0 + 0.6} velocidad={1.3} />
      </div>
      {d.titulo ? (
        <div style={{position: 'absolute', left: 70, right: 70, top: CY + 112, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900,
          fontSize: String(d.titulo).length > 26 ? 50 : 60, lineHeight: 1.05, letterSpacing: '-0.03em', color: pal.tinta,
          opacity: clamp(sp(t, tc + 0.9, RESORTES.carta) * 1.4), transform: `translateY(${(1 - sp(t, tc + 0.9, RESORTES.carta)) * 18}px)`}}>
          {String(d.titulo)}
        </div>
      ) : null}
      {cabeza ? <Chispas t0={tc + 1.05} x={cabeza.x} y={cabeza.y} n={16} semilla="medidor" fuerza={700} /> : null}
    </div>
  );
};

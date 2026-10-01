// Rango — encima del video. Una regla con dos topes que se separan: «de tanto a tanto». Para precios,
// plazos, sueldos, tiempos… cuando la respuesta no es un número sino una horquilla.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Cifra, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 432, PAD = 56;
const REGLA = ANCHO - PAD * 2;

export const Rango: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const tA = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const tB = p.marcas[1] != null ? p.marcas[1] : tA + 1.1;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const kA = sp(t, tA, {damping: 15, stiffness: 100, mass: 0.95});
  const kB = sp(t, tB, {damping: 14, stiffness: 95, mass: 0.95});
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const prefijo = d.prefijo != null ? String(d.prefijo) : '';
  const marcas = rampa(t, ENTRA + 0.35, ENTRA + 1.1, EASE.llega);
  // los topes: el de la izquierda entra primero y el de la derecha se va abriendo
  const xA = PAD + REGLA * 0.12;
  const xB = PAD + REGLA * 0.88;
  const abierto = xA + (xB - xA) * clamp(kB);

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={ALTO} entra={ENTRA} sale={SALE} semilla="rango" brillos={[tB + 0.5]}>
      <div style={{position: 'absolute', left: PAD - 10, top: 34}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD - 10, right: PAD - 10, top: 86, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 24 ? 48 : 58, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={38} />
      </div>

      {/* las dos cifras */}
      {[[xA, d.desde, kA, false], [abierto, d.hasta, kB, true]].map(([x, v, k, fuerte], i) => (
        <div key={i} style={{position: 'absolute', left: Number(x) - 150, top: 190, width: 300, textAlign: 'center',
          opacity: clamp(Number(k) * 1.6), transform: `translateY(${(1 - Number(k)) * 22}px)`}}>
          <div style={{fontFamily: OUTFIT, fontWeight: 900, fontSize: fuerte ? 82 : 70, lineHeight: 1,
            letterSpacing: '-0.04em', color: fuerte ? pal.acento : pal.tinta2,
            textShadow: fuerte ? `0 0 34px ${pal.a(0.45)}` : undefined, fontVariantNumeric: 'tabular-nums'}}>
            <Cifra texto={`${prefijo}${v != null ? v : ''}${sufijo}`} t0={i === 0 ? tA : tB} dur={0.8} />
          </div>
        </div>
      ))}

      {/* la regla */}
      <svg width={ANCHO} height={120} style={{position: 'absolute', left: 0, top: 300, overflow: 'visible'}}>
        {Array.from({length: 21}).map((_, i) => {
          const x = PAD + (REGLA * i) / 20;
          const alta = i % 5 === 0;
          const on = x <= abierto + 1 && x >= xA - 1;
          return <line key={i} x1={x} y1={alta ? 6 : 14} x2={x} y2={alta ? 34 : 28}
            stroke={on ? pal.a(0.85) : 'rgba(244,236,231,.20)'} strokeWidth={alta ? 4 : 2.5} strokeLinecap="round"
            opacity={clamp(marcas * 21 - i)} />;
        })}
        <line x1={PAD} y1={20} x2={PAD + REGLA} y2={20} stroke="rgba(244,236,231,.14)" strokeWidth={3} strokeLinecap="round" />
        <line x1={xA} y1={20} x2={abierto} y2={20} stroke={pal.acento} strokeWidth={7} strokeLinecap="round"
          style={{filter: `drop-shadow(0 0 14px ${pal.a(0.7)})`}} opacity={clamp(kA)} />
        {[[xA, kA, false], [abierto, kB, true]].map(([x, k, fuerte], i) => (
          <g key={i} opacity={clamp(Number(k) * 1.5)}>
            <circle cx={Number(x)} cy={20} r={fuerte ? 19 : 15} fill={pal.tinta} />
            <circle cx={Number(x)} cy={20} r={fuerte ? 9 : 7} fill={pal.acento} />
          </g>
        ))}
      </svg>

      {d.pie ? (
        <div style={{position: 'absolute', left: PAD - 10, right: PAD - 10, top: 366, textAlign: 'center',
          fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: pal.tinta3, opacity: clamp(sp(t, tB + 0.45, RESORTES.carta) * 1.4)}}>
          {String(d.pie)}
        </div>
      ) : null}
      <Chispas t0={tB + 0.35} x={abierto} y={320} n={16} semilla="rango" fuerza={620} />
    </Tarjeta>
  );
};

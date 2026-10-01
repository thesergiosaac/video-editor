// Porcentaje en anillo — pantalla partida (tu video arriba en su caja, el gráfico abajo). El arco se dibuja cuando dices
// el número; si hablas de personas («de cada 10…»), salen 10 figuras con las que cuentan encendidas.
import React, {useMemo} from 'react';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Escribir, Letras, Tambor, posDigito} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const ANILLO = 340;
const CX = ANILLO / 2;
const R = 124;
const CIRC = `M ${CX} ${CX - R} A ${R} ${R} 0 1 1 ${CX} ${CX + R} A ${R} ${R} 0 1 1 ${CX} ${CX - R}`;
const DE_PERSONAS = /persona|gente|de cada|colombian|usuario|cliente|emprendedor|creador|estudiante|mujer|hombre|joven|adult/i;

const Persona: React.FC<{llena: boolean; k: number}> = ({llena, k}) => {
  const {pal} = useG();
  const c = llena ? pal.acento : 'rgba(244,236,231,.16)';
  return (
    <svg width={34} height={50} viewBox="0 0 34 50" style={{display: 'block', opacity: clamp(k * 2), transform: `translateY(${(1 - k) * 22}px) scale(${0.4 + 0.6 * k})`, transformOrigin: '50% 100%', overflow: 'visible'}}>
      <circle cx={17} cy={9} r={8.5} fill={c} />
      <path d="M3 43 V32 C3 24 9 20 17 20 C25 20 31 24 31 32 V43 Q31 48 26 48 H8 Q3 48 3 43 Z" fill={c} style={{filter: llena ? `drop-shadow(0 0 8px ${pal.a(0.55)})` : undefined}} />
    </svg>
  );
};

const Contenido: React.FC<{top: number}> = ({top}) => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos;
  const tc = p.marcas[0];
  const frac = clamp(d.valor / 100);
  const largo = useMemo(() => getLength(CIRC), []);
  const pista = rampa(t, tc - 0.4, tc + 0.13, EASE.llega);
  const pa = sp(t, tc, {damping: 11, stiffness: 52, mass: 1}, 40) * frac;
  const punta = getPointAtLength(CIRC, Math.max(0.01, largo * Math.min(pa, 0.9999)));
  const valor = frac > 0 ? (Math.min(pa, frac) / frac) * d.valor : 0;
  const paAntes = sp(t - 1 / 30, tc, {damping: 11, stiffness: 52, mass: 1}, 40) * frac;
  const valorAntes = frac > 0 ? (Math.min(paAntes, frac) / frac) * d.valor : 0;
  const entrada = sp(t, tc - 0.45, RESORTES.carta);
  const llega = tc + 1.2;
  const latido = golpe(t, llega, 5, 2.3);
  const final = String(Math.round(d.valor));
  const personas = DE_PERSONAS.test(`${d.etiqueta} ${d.titulo}`);
  const llenas = Math.round(d.valor / 10);
  const tTitulo = tc + 1.1;
  const tamTit = String(d.titulo || '').length > 26 ? 56 : 66;
  return (
    <div style={{position: 'absolute', left: 60, right: 40, top}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: ANILLO, height: ANILLO, opacity: clamp(entrada * 1.6),
        transform: `perspective(1400px) rotateY(${(1 - entrada) * -35}deg) scale(${(0.8 + 0.2 * entrada) * (1 + 0.03 * latido)})`}}>
        <svg width={ANILLO} height={ANILLO} style={{position: 'absolute', inset: 0, filter: 'blur(16px)', opacity: 0.55}}>
          {pa > 0.002 ? <path d={CIRC} fill="none" stroke={pal.acento} strokeWidth={38} strokeLinecap="round" {...evolvePath(pa, CIRC)} /> : null}
        </svg>
        <svg width={ANILLO} height={ANILLO} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <defs>
            <linearGradient id="a-arco" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={pal.claro} />
              <stop offset="0.6" stopColor={pal.acento} />
              <stop offset="1" stopColor={pal.hondo} />
            </linearGradient>
          </defs>
          {Array.from({length: 10}).map((_, i) => {
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const m = sp(t, tc - 0.3 + i * 0.05, RESORTES.pop);
            const r1 = R + 24, r2 = R + 24 + 9 * m;
            return (
              <line key={i} x1={CX + Math.cos(a) * r1} y1={CX + Math.sin(a) * r1} x2={CX + Math.cos(a) * r2} y2={CX + Math.sin(a) * r2}
                stroke={pa >= (i + 1) * 0.1 - 0.001 ? pal.acento : 'rgba(244,236,231,.25)'} strokeWidth={5} strokeLinecap="round" opacity={m > 0.02 ? 1 : 0} />
            );
          })}
          <path d={CIRC} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={28} strokeLinecap="round" {...evolvePath(pista, CIRC)} />
          {pa > 0.002 ? <path d={CIRC} fill="none" stroke="url(#a-arco)" strokeWidth={28} strokeLinecap="round" {...evolvePath(pa, CIRC)} /> : null}
          {pa > 0.01 && punta ? (
            <>
              <circle cx={punta.x} cy={punta.y} r={27} fill={pal.acento} opacity={0.35} />
              <circle cx={punta.x} cy={punta.y} r={10} fill="#fff" opacity={0.95} />
            </>
          ) : null}
        </svg>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: OUTFIT, fontWeight: 900,
          fontSize: final.length > 2 ? 84 : 100, lineHeight: 1.2, letterSpacing: '-0.04em', color: pal.tinta, paddingLeft: 10}}>
          {final.split('').map((ch, i) => (
            <Tambor key={i} pos={posDigito(valor, Math.pow(10, final.length - 1 - i))} final={ch}
              vel={posDigito(valor, Math.pow(10, final.length - 1 - i)) - posDigito(valorAntes, Math.pow(10, final.length - 1 - i))} />
          ))}
          <span style={{fontSize: 52, marginLeft: 6, marginTop: 28, color: pal.tinta2, letterSpacing: 0}}>%</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: ANILLO + 34, right: 0, top: 30}}>
        <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 25, letterSpacing: '0.15em', textTransform: 'uppercase', color: pal.tinta2, height: 32, whiteSpace: 'nowrap'}}>
          <Escribir texto={d.etiqueta || ''} t0={tc + 0.25} velocidad={1.3} />
        </div>
        <div style={{marginTop: 12, fontFamily: OUTFIT, fontWeight: 900, fontSize: tamTit, lineHeight: 1.02, letterSpacing: '-0.035em', color: pal.tinta}}>
          <Letras texto={d.titulo || ''} t0={tTitulo} color={(w) => (/\d/.test(w) ? pal.acento : undefined)} />
        </div>
        {personas ? (
          <div style={{display: 'flex', gap: 9, marginTop: 22}}>
            {Array.from({length: 10}).map((_, i) => (
              <Persona key={i} llena={i < llenas} k={sp(t, tTitulo + 0.4 + i * 0.067, RESORTES.pop)} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Porcentaje: React.FC = () => {
  const t = useT();
  const {p, Hd} = useG();
  const {op, dy, sale} = usePresenciaGrupo();
  const tc = p.marcas[0];
  const top = Math.round(Hd * 0.46);
  const frac = Math.min(1, p.datos.valor / 100);
  const ang = frac * Math.PI * 2 - Math.PI / 2;
  if (op <= 0.001) return null;
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: top - 40, width: 1080, height: 460}}>
        <div style={{position: 'absolute', inset: 0, top: 40, opacity: op, transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 12).toFixed(1)}px)` : undefined}}>
          <Contenido top={0} />
        </div>
      </div>
      {t >= tc + 1.1 ? <Chispas t0={tc + 1.2} x={60 + CX + Math.cos(ang) * R} y={top + CX + Math.sin(ang) * R} n={20} semilla="anillo" fuerza={800} /> : null}
    </>
  );
};

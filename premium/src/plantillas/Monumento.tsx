// Cifra monumental — con profundidad. La cifra enorme va DETRÁS de ti, como pintada en la pared; la raya fina y el
// pie van DELANTE. Cuatro estilos de letra para escoger (datos.estilo): serif, alta, contorno o bloque.
import React from 'react';
import {ANTON, ARCHIVO, MONO, OUTFIT, PLAYFAIR_RECTO} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escribir} from '../lib/Piezas';

/* Cada estilo trae su letra, su tamaño y cómo se trata el texto */
const ESTILOS: Record<string, {fuente: string; ancho: number; techo: number; esp: string; trato: 'lleno' | 'relieve' | 'contorno'}> = {
  serif:    {fuente: PLAYFAIR_RECTO, ancho: 0.66, techo: 380, esp: '-0.02em',  trato: 'lleno'},
  alta:     {fuente: ANTON,          ancho: 0.52, techo: 470, esp: '-0.01em',  trato: 'lleno'},
  contorno: {fuente: OUTFIT,         ancho: 0.60, techo: 410, esp: '-0.05em',  trato: 'contorno'},
  bloque:   {fuente: ARCHIVO,        ancho: 0.72, techo: 360, esp: '-0.035em', trato: 'relieve'},
};
const CAPAS = 10;

export const Monumento: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte} = useG();
  const d = p.datos || {};
  const e = ESTILOS[String(d.estilo || 'serif')] || ESTILOS.serif;
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const k = sp(t, tc, {damping: 16, stiffness: 78, mass: 1});
  const sale = rampa(t, p.t1 - 0.85, p.t1 - 0.3, EASE.sale);
  const cifra = String(d.valor != null ? d.valor : d.texto || '');
  const tam = Math.round(Math.min(e.techo, 940 / Math.max(1.5, cifra.length * e.ancho)));
  const y = Math.round(Hd * 0.11);
  const op = clamp(k * 1.5) * (1 - sale);
  const kp = sp(t, tc + 0.75, {damping: 17, stiffness: 90, mass: 1});

  if (parte === 'atras') {
    const base: React.CSSProperties = {fontFamily: e.fuente, fontWeight: e.fuente === ANTON || e.fuente === ARCHIVO ? 400 : 900,
      fontSize: tam, lineHeight: 1, letterSpacing: e.esp, whiteSpace: 'pre'};
    return (
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op,
        filter: k < 0.99 ? `blur(${((1 - k) * 22).toFixed(1)}px)` : undefined}}>
        <div style={{position: 'absolute', left: 60, right: 60, top: y - 52, textAlign: 'center', fontFamily: MONO,
          fontWeight: 500, fontSize: 28, letterSpacing: '0.3em', textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap'}}>
          <Escribir texto={String(d.etiqueta || '')} t0={tc + 0.15} velocidad={1.6} />
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: y + (1 - k) * 46, textAlign: 'center'}}>
          <span style={{position: 'relative', display: 'inline-block'}}>
            {e.trato === 'relieve' ? Array.from({length: CAPAS}).map((_, i) => {
              const z = (CAPAS - i) * 3.2, m = i / CAPAS;
              return <span key={i} aria-hidden="true" style={{...base, position: 'absolute', left: -z * 0.34, top: z * 0.58,
                color: `rgba(${16 + m * 22},${9 + m * 5},${12 + m * 14},1)`}}>{cifra}</span>;
            }) : null}
            {e.trato === 'contorno' ? (
              <span style={{...base, position: 'relative', color: 'transparent',
                WebkitTextStroke: `${Math.max(4, Math.round(tam * 0.022))}px ${pal.acento}`,
                filter: `drop-shadow(0 0 40px ${pal.a(0.45)})`}}>{cifra}</span>
            ) : (
              <span style={{...base, position: 'relative', color: pal.acento,
                textShadow: e.trato === 'lleno' ? `0 0 90px ${pal.a(0.3)}, 0 26px 60px rgba(0,0,0,.55)` : `0 0 90px ${pal.a(0.35)}`}}>
                {cifra}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  const raya = rampa(t, tc + 0.5, tc + 1.15, EASE.llega);
  const pie = String(d.titulo || '');
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(Hd * 0.30), opacity: clamp(kp),
        background: 'linear-gradient(0deg, rgba(8,5,7,.88) 0%, rgba(8,5,7,.55) 45%, transparent 100%)'}} />
      <div style={{position: 'absolute', left: 150, right: 150, top: Math.round(Hd * 0.795), height: 2,
        background: pal.a(0.75), transform: `scaleX(${raya})`, transformOrigin: '50% 50%'}} />
      <div style={{position: 'absolute', left: 90, right: 90, top: Math.round(Hd * 0.815), textAlign: 'center',
        fontFamily: OUTFIT, fontWeight: 800, fontSize: pie.length > 30 ? 46 : 56, lineHeight: 1.12,
        letterSpacing: '-0.025em', color: pal.tinta, opacity: clamp(kp * 1.6),
        transform: `translateY(${(1 - kp) * 22}px)`, textShadow: '0 6px 30px rgba(0,0,0,.95)'}}>
        {pie}
      </div>
    </div>
  );
};

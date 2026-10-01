// Antes y después — con profundidad. Dos cifras alineadas a la misma línea, DETRÁS de ti: la de antes se apaga,
// la de después crece con tu color. La flecha y las etiquetas van DELANTE. Todo a la misma altura, sin torcer.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Cifra} from '../lib/Piezas';

/* Dos columnas iguales, con el mismo borde de abajo: así las dos cifras se apoyan en la misma línea */
const COL = 444, X1 = 52, X2 = 584, CAJA = 236;

export const Contraste: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte} = useG();
  const d = p.datos || {};
  const tA = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const tB = p.marcas[1] != null ? p.marcas[1] : tA + 1.5;
  const sale = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);
  const kA = sp(t, tA, {damping: 16, stiffness: 88, mass: 1});
  const kB = sp(t, tB, {damping: 14, stiffness: 96, mass: 0.95});
  const apaga = rampa(t, tB - 0.15, tB + 0.5) * 0.42;
  const top = Math.round(Hd * 0.125);
  const antes = String(d.antes != null ? d.antes : '');
  const despues = String(d.despues != null ? d.despues : '');
  const tam = (txt: string, base: number) => Math.round(Math.min(base, 1180 / Math.max(2.2, txt.length * 0.62)));

  if (parte === 'atras') {
    const columna = (x: number, k: number, hijo: React.ReactNode, estilo: React.CSSProperties) => (
      <div style={{position: 'absolute', left: x, top, width: COL, height: CAJA, display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center', opacity: clamp(k * 1.6),
        transform: `translateY(${(1 - k) * 34}px)`, filter: k < 0.98 ? `blur(${((1 - k) * 16).toFixed(1)}px)` : undefined}}>
        <div style={{fontFamily: OUTFIT, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em', ...estilo}}>{hijo}</div>
      </div>
    );
    return (
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
        {columna(X1, kA, antes, {fontSize: tam(antes, 168), color: `rgba(244,236,231,${(0.5 - apaga * 0.5).toFixed(2)})`,
          textShadow: '0 16px 50px rgba(0,0,0,.7)'})}
        {columna(X2, kB, <Cifra texto={despues} t0={tB} dur={0.9} />, {fontSize: tam(despues, 212), color: pal.acento,
          textShadow: `0 0 90px ${pal.a(0.45)}, 0 20px 60px rgba(0,0,0,.6)`})}
      </div>
    );
  }

  const flecha = rampa(t, tB - 0.2, tB + 0.45, EASE.llega);
  const kt = sp(t, tB + 0.6, {damping: 17, stiffness: 90, mass: 1});
  const eti = (txt: string, x: number, k: number, punto: boolean) => (
    <div style={{position: 'absolute', left: x, top: top - 52, width: COL, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 11, opacity: clamp(k * 1.5)}}>
      {punto ? <span style={{flex: 'none', width: 10, height: 10, borderRadius: 99, background: pal.acento,
        boxShadow: `0 0 16px ${pal.a(0.9)}`}} /> : null}
      <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: punto ? pal.tinta : 'rgba(244,236,231,.78)', textShadow: '0 3px 14px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,.9)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{txt}</span>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
      {eti(String(d.etiquetaAntes || 'Antes'), X1, kA, false)}
      {eti(String(d.etiquetaDespues || 'Después'), X2, kB, true)}
      <svg width={92} height={52} style={{position: 'absolute', left: 494, top: top + CAJA - 92, overflow: 'visible'}}>
        <path d="M 4 26 L 80 26 M 62 10 L 80 26 L 62 42" fill="none" stroke={pal.acento} strokeWidth={7}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray={160} strokeDashoffset={160 * (1 - flecha)}
          style={{filter: `drop-shadow(0 0 16px ${pal.a(0.7)})`}} />
      </svg>
      {d.titulo ? (<>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(Hd * 0.28), opacity: clamp(kt),
          background: 'linear-gradient(0deg, rgba(8,5,7,.88) 0%, rgba(8,5,7,.5) 46%, transparent 100%)'}} />
        <div style={{position: 'absolute', left: 90, right: 90, top: Math.round(Hd * 0.80), textAlign: 'center',
          fontFamily: OUTFIT, fontWeight: 800, fontSize: String(d.titulo).length > 30 ? 44 : 54, lineHeight: 1.1,
          letterSpacing: '-0.025em', color: pal.tinta, textShadow: '0 6px 30px rgba(0,0,0,.95)',
          opacity: clamp(kt * 1.5), transform: `translateY(${(1 - kt) * 20}px)`}}>
          {String(d.titulo)}
        </div>
      </>) : null}
    </div>
  );
};

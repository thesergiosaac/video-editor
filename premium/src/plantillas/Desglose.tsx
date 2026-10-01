// Desglose (recibo) — pantalla completa. Un recibo de papel que se desenrolla y va escribiendo a qué se va tu plata,
// con su barra y su porcentaje. La última fila (lo que queda) se marca con el color de la marca y un sello.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Chispas, Cifra, Escribir} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const AN = 760, X = (1080 - AN) / 2;

export const Desglose: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const items: [string, number][] = (d.items || []).slice(0, 5);
  const tm: number[] = p.marcas || [];
  const {op, sale} = usePresenciaGrupo();
  const filaH = 96, cab = 128, pie = 140;            // pie = margen de abajo del papel, donde cae el sello
  const alto = cab + items.length * filaH + pie;
  const top = Math.round((Hd - alto) / 2 + Hd * 0.06);   // el recibo centrado, un poco por debajo del video redondo
  const desenrolla = sp(t, p.t0 + 0.3, {damping: 16, stiffness: 70, mass: 1});
  const ultimo = items.length - 1;
  if (op <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op, filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      <div style={{position: 'absolute', left: X, top: top, width: AN, height: alto * desenrolla, overflow: 'hidden',
        transformOrigin: '50% 0%', transform: `perspective(1400px) rotateX(${(1 - desenrolla) * 34}deg)`}}>
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#F8F3EC,#E9E1D6)', borderRadius: 10,
          boxShadow: '0 40px 90px -30px rgba(0,0,0,.9), inset 0 0 0 1px rgba(0,0,0,.06)'}} />
        {/* borde dentado de abajo */}
        <div style={{position: 'absolute', left: 0, right: 0, bottom: -1, height: 18,
          background: 'repeating-linear-gradient(90deg, #E9E1D6 0 18px, transparent 18px 20px)',
          WebkitMaskImage: 'radial-gradient(12px 18px at 10px 18px, transparent 96%, #000 100%)', maskImage: 'radial-gradient(12px 18px at 10px 18px, transparent 96%, #000 100%)', maskSize: '20px 18px'}} />
        <div style={{position: 'absolute', left: 40, top: 34, right: 40}}>
          <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 25, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(22,14,18,.55)'}}>
            <Escribir texto={String(d.titulo || 'De cada venta')} t0={p.t0 + 0.55} velocidad={1.5} />
          </div>
          <div style={{marginTop: 18, height: 2, background: 'repeating-linear-gradient(90deg, rgba(22,14,18,.35) 0 10px, transparent 10px 18px)'}} />
        </div>
        {items.map(([etq, val], i) => {
          const ti = tm[i] != null ? tm[i] : p.t0 + 1 + i * 0.7;
          const k = sp(t, ti, RESORTES.carta);
          const es = i === ultimo;
          const y = cab + i * filaH;
          return (
            <div key={i} style={{position: 'absolute', left: 40, right: 40, top: y, height: filaH - 16, opacity: clamp(k * 1.6), transform: `translateX(${(1 - k) * -26}px)`}}>
              <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontFamily: OUTFIT, fontWeight: es ? 900 : 800,
                fontSize: es ? 46 : 40, color: es ? pal.acento : '#160E12', letterSpacing: '-0.02em'}}>
                <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420}}>{etq}</span>
                <span style={{fontVariantNumeric: 'tabular-nums'}}><Cifra texto={`${Math.round(val)}%`} t0={ti} dur={0.7} /></span>
              </div>
              {/* barra */}
              <div style={{position: 'absolute', left: 0, right: 0, bottom: 6, height: 10, borderRadius: 99, background: 'rgba(22,14,18,.10)', overflow: 'hidden'}}>
                <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(2, Math.min(100, val))}%`, borderRadius: 99,
                  background: es ? `linear-gradient(90deg, ${pal.claro}, ${pal.acento})` : 'rgba(22,14,18,.45)',
                  transform: `scaleX(${clamp(sp(t, ti + 0.1, RESORTES.carta))})`, transformOrigin: '0% 50%',
                  boxShadow: es ? `0 0 22px ${pal.a(0.65)}` : undefined}} />
              </div>
            </div>
          );
        })}
        <Brillo t0={(tm[ultimo] != null ? tm[ultimo] : p.t0 + 2) + 0.5} w={AN} h={alto} dur={1} fuerza={0.8} />
      </div>
      {/* sello en la última fila */}
      {items.length ? (() => {
        const ti = (tm[ultimo] != null ? tm[ultimo] : p.t0 + 2) + 0.45;
        const s = sp(t, ti, RESORTES.pop);
        return (
          <div style={{position: 'absolute', left: X, top: top + cab + items.length * filaH + 14, width: AN, textAlign: 'center',
            fontFamily: OUTFIT, fontWeight: 900, fontSize: 34, color: pal.sobre, opacity: clamp(s * 2),
            transform: `rotate(${-11 + (1 - s) * 22}deg) scale(${0.6 + 0.4 * s})`}}>
            <span style={{display: 'inline-block', background: pal.acento, borderRadius: 14, padding: '8px 18px',
              boxShadow: `0 12px 30px -10px ${pal.a(0.8)}`, letterSpacing: '0.04em'}}>{String(d.sello || 'TU GANANCIA')}</span>
          </div>
        );
      })() : null}
      <Chispas t0={(tm[ultimo] != null ? tm[ultimo] : p.t0 + 2) + 0.5} x={540} y={top + cab + items.length * filaH + 46} n={18} semilla="recibo" fuerza={700} />
    </div>
  );
};

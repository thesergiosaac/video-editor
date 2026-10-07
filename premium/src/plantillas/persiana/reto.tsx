// «La barra del reto» (2-oct-2026): la barra «El reto» del Proyecto 25 y del Día 2 vuelta pieza de Cherry. Cuando la persona
// habla de una meta con número y de dónde va («quiero llegar a 200 mil seguidores», «voy en 50 mil»), sube una tarjeta de
// vidrio ARRIBA de su cabeza: dónde va (cuenta), «la meta» en cursiva con su número y la barra que se llena hasta donde va.
// Sin @usuario ni logos (regla de Sergio para redes). El brillo de la barra es blanco tenue, nunca del color de la barra.
import React from 'react';
import {useG, useT} from '../../lib/anim';
import {vidrioPlano} from '../../lib/Piezas';
import {INTER, PLAYFAIR} from '../../tema';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const outCubic = (k: number) => 1 - Math.pow(1 - clamp(k), 3);

/* 49800 → «49,8 mil»; 1200000 → «1,2 M»; 312 → «312» */
const corto = (n: number) => {
  if (n >= 1e6) return (Math.round(n / 1e5) / 10).toString().replace('.', ',') + ' M';
  if (n >= 1e4) return (Math.round(n / 100) / 10).toString().replace('.', ',') + ' mil';
  return Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
};
const entero = (n: number) => Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

export const PeReto: React.FC = () => {
  const t = useT();
  const g = useG();
  const {p, pal, vista} = g;
  const d: any = p.datos || {};
  const m: number[] = (Array.isArray(p.marcas) ? p.marcas : []).map(Number);
  const actual = Math.max(0, Number(d.actual) || 0), meta = Math.max(1, Number(d.meta) || 1);
  const tMeta = m.length > 1 ? m[1] : p.t0 + 0.9;
  const v = clamp((t - p.t0) / 0.35) * (1 - clamp((t - (p.t1 - 0.3)) / 0.3));
  if (v <= 0) return null;
  const cuenta = outCubic(clamp((t - p.t0 - 0.15) / 0.8));
  const pm = outCubic(clamp((t - tMeta + 0.05) / 0.4));
  const cuentaMeta = outCubic(clamp((t - tMeta + 0.05) / 0.6));
  const barra = outCubic(clamp((t - tMeta - 0.1) / 0.8));
  // el vidrio: en la nube lo hace el ensamblador (desenfoca el video bajo la transparencia); en la vista previa, los mismos valores
  // (8-oct) en la vista previa, si la página lo pinta con la tarjeta gráfica (js/vidriogl.js), sin backdrop-filter
  const conGL = vidrioPlano(g as any, t, 'reto', 80, 250, 920, 300, 44, lerp(40, 0, v), clamp(v * 1.3));
  const vidrio = vista && !conGL ? {backdropFilter: 'blur(24.5px) saturate(1.4) brightness(.9)', WebkitBackdropFilter: 'blur(24.5px) saturate(1.4) brightness(.9)'} : {};
  return (
    <div style={{position: 'absolute', left: 80, top: 250, width: 920, height: 300, borderRadius: 44, padding: 34, boxSizing: 'border-box',
      background: 'rgba(16,14,14,.78)', border: '1.5px solid rgba(255,255,255,.14)', color: '#f6f0e8', fontFamily: INTER, boxShadow: '0 30px 70px rgba(0,0,0,.42)',
      opacity: clamp(v * 1.3), filter: `blur(${lerp(10, 0, clamp(v))}px)`, transform: `translateY(${lerp(40, 0, v)}px)`, ...vidrio}}>
      <div style={{fontWeight: 700, fontSize: 24, letterSpacing: '.16em', textTransform: 'uppercase', color: pal.acento, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
        {String(d.etiqueta || 'La meta')}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18}}>
        <div>
          {actual > 0 ? (
            <>
              <div style={{fontWeight: 800, fontSize: 84, letterSpacing: '-.03em', lineHeight: 1}}>{corto(actual * cuenta)}</div>
              <div style={{fontSize: 26, color: 'rgba(246,240,232,.62)', marginTop: 6}}>{String(d.unidad || '')}{d.unidad ? ' hoy' : 'hoy'}</div>
            </>
          ) : null}
        </div>
        <div style={{textAlign: 'right', opacity: clamp(pm * 1.3), transform: `translateY(${lerp(20, 0, pm)}px)`}}>
          <div style={{fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 700, fontSize: 40, color: pal.acento, lineHeight: 1}}>la meta</div>
          <div style={{fontWeight: 800, fontSize: 84, letterSpacing: '-.03em', lineHeight: 1, color: pal.acento}}>{entero(meta * cuentaMeta)}</div>
        </div>
      </div>
      <div style={{position: 'relative', height: 18, borderRadius: 9, background: 'rgba(255,255,255,.12)', marginTop: 22, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (actual / meta) * 100) * barra}%`, borderRadius: 9,
          background: `linear-gradient(90deg, ${pal.acento}, ${pal.hondo})`, boxShadow: '0 0 16px rgba(255,255,255,.4)'}} />
      </div>
    </div>
  );
};

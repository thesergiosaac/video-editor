// «La tarjeta plena» (2-oct-2026): las tarjetas de las horas del Día 2 («7:00 PM de la noche», «9:00 AM de la mañana»…), vueltas
// pieza de Cherry. Cuando la persona dice de 2 a 4 valores seguidos (horas, precios, cifras, días), el video se oscurece y
// aparece una tarjeta de COLOR PLENO con el valor gigante; en cada valor siguiente la tarjeta cambia DE GOLPE de color y de
// dato (un pequeño golpe de escala y un giro que se endereza). Refs. de Sergio: vanogre.edits, theeditroomx.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useG, useT} from '../../lib/anim';
import {ANTON, INTER, PLAYFAIR} from '../../tema';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const outCubic = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const outBack = (k: number) => { const c = 1.70158, x = clamp(k) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

/* Si el acento es claro, la letra va oscura (y al revés) */
const tintaSobre = (hex: string) => {
  const n = parseInt(String(hex || '#000000').slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#121212' : '#ffffff';
};
/* Tamaño del valor: hasta 4 caracteres va enorme; más largo, más chico para que quepa en la tarjeta (840 px) */
const tamValor = (v: string) => {
  const n = Math.max(1, v.length);
  return Math.min(380, 760 / (n * 0.52));
};

export const PePlena: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d: any = p.datos || {};
  const items: any[] = Array.isArray(d.items) ? d.items : [];
  const m: number[] = (Array.isArray(p.marcas) ? p.marcas : []).map(Number);
  if (!items.length) return null;
  // los colores van turnándose: azul, papel, ámbar y el acento al final (el remate)
  const colores = [{f: '#1E3BFF', l: '#ffffff'}, {f: '#f4f1ea', l: '#121212'}, {f: '#FFB23F', l: '#121212'}];
  const deIndice = (i: number) => (i === items.length - 1 && items.length > 1 ? {f: pal.acento, l: tintaSobre(pal.acento)} : colores[i % colores.length]);
  // la tarjeta de ahora: la del último valor ya dicho (la primera desde que empieza la pieza)
  let i = 0;
  for (let k = 0; k < items.length; k++) if (m[k] != null && t >= m[k] - 0.06) i = k;
  const a = i === 0 ? p.t0 : m[i] - 0.06;
  const fondo = clamp((t - p.t0) / 0.15) * (1 - clamp((t - (p.t1 - 0.15)) / 0.15));
  const golpe = outBack(clamp((t - a) / 0.25)), k = outCubic(clamp((t - a) / 0.2));
  const sale = 1 - clamp((t - (p.t1 - 0.18)) / 0.18);
  const it = items[i] || {}, c = deIndice(i);
  const valor = String(it.valor || ''), sub = String(it.sub || ''), nota = String(it.nota || '');
  const tam = tamValor(valor);
  const giro = (i % 2 ? -1 : 1) * 2.5;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `rgba(0,0,0,${0.45 * fondo})`}} />
      <div style={{position: 'absolute', left: 120, top: 300, width: 840, height: 930, borderRadius: 56, background: c.f, color: c.l, opacity: sale,
        boxShadow: '0 40px 90px rgba(0,0,0,.45)', overflow: 'hidden',
        transform: `scale(${lerp(1.07, 1, golpe) * lerp(0.94, 1, sale)}) rotate(${lerp(giro, 0, k)}deg)`}}>
        {d.etiqueta ? (
          <div style={{position: 'absolute', left: 64, right: 64, top: 64, display: 'flex', alignItems: 'center', gap: 16, fontFamily: INTER, fontWeight: 800, fontSize: 30,
            letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.8}}>
            <span style={{width: 16, height: 16, borderRadius: '50%', background: c.l, flex: 'none'}} />{String(d.etiqueta)}
          </div>
        ) : null}
        <div style={{position: 'absolute', left: 0, right: 0, top: 210 + (380 - tam) * 0.5, textAlign: 'center', fontFamily: ANTON, fontSize: tam, lineHeight: 0.95,
          letterSpacing: '-.01em', whiteSpace: 'nowrap'}}>{valor}</div>
        {sub ? <div style={{position: 'absolute', left: 0, right: 0, top: 590, textAlign: 'center', fontFamily: ANTON, fontSize: 130, letterSpacing: '.06em'}}>{sub}</div> : null}
        {nota ? <div style={{position: 'absolute', left: 40, right: 40, top: sub ? 760 : 640, textAlign: 'center', fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 700, fontSize: 74, lineHeight: 1.05}}>{nota}</div> : null}
        {/* puntos: cuál de cuántas */}
        {items.length > 1 ? (
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center', gap: 14}}>
            {items.map((_, j) => <span key={j} style={{width: j === i ? 44 : 14, height: 14, borderRadius: 7, background: c.l, opacity: j === i ? 0.9 : 0.35}} />)}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

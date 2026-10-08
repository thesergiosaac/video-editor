// La línea de tiempo EN LIENZO (8-oct-2026): la misma de Linea.tsx con el motor de nodos (lib/escena.tsx).
import React, {useMemo} from 'react';
import {getLength, getPointAtLength} from '@remotion/paths';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {bloque, caja, chispasNodo, comillas, etiquetaNodo, letrasNodos, lineaDe, sinVidrioCss, tarjetaNodos, vidrioTarjeta} from '../lib/tarjetaEscena';
import {tamPara} from '../lib/Piezas';
import {sombra} from '../lib/lienzo';

const T = {x: 86, y: 150, w: 908, h: 400};
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '700'], [MONO, '500']];

export const LineaGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos;
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
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
  const trazo = useMemo(() => new Path2D(camino), [camino]);
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
  const xs = pos.map((q) => q.x), x0 = Math.min(...xs), x1 = Math.max(...xs);

  // el camino: la pista, el brillo desenfocado (blur 9) y el trazo con degradado; la cabeza mientras avanza
  const camNodo: Nodo = {id: 'camino', x: 0, y: 0, w: T.w, h: T.h, m: 40,
    firma: `${camino}|${Math.round(pista * 1000)}|${Math.round(pc * 2000)}|${moviendose}|${pal.acento}`, pintar: (g) => {
      const k = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const parcial = (p0: number) => { if (p0 < 1) g.setLineDash([largo * p0, largo * 2]); else g.setLineDash([]); };
      if (pista > 0) { parcial(pista); g.strokeStyle = 'rgba(244,236,231,.1)'; g.lineWidth = 10; g.stroke(trazo); }
      if (pc > 0.001) {
        g.save(); parcial(pc); g.globalAlpha = 0.35; g.filter = `blur(${(9 * k).toFixed(2)}px)`; g.strokeStyle = pal.acento; g.lineWidth = 22; g.stroke(trazo); g.restore();
        parcial(pc);
        const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, pal.claro); gr.addColorStop(1, pal.acento);
        g.strokeStyle = gr; g.lineWidth = 10; g.stroke(trazo);
      }
      g.setLineDash([]);
      if (moviendose) {
        g.globalAlpha = 0.35; g.fillStyle = pal.acento; g.beginPath(); g.arc(cabeza.x, cabeza.y, 26, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(cabeza.x, cabeza.y, 10, 0, Math.PI * 2); g.fill();
      }
    }};

  const hitosNodos = (ts: number): Nodo[] => {
    const out: Nodo[] = [];
    hitos.forEach((hh, i) => {
      const ultimo = i === ult;
      const ti = tm[i];
      const k = sp(t, ti - 0.03, RESORTES.pop);
      const pulso = rampa(t, ti, ti + 0.73, EASE.llega);
      const fantasma = sp(t, ENTRA + 0.27 + i * 0.1, RESORTES.suave);
      const cap = sp(t, ti + 0.17, RESORTES.carta);
      const rN = ultimo ? 20 : 16;
      const {x, y} = pos[i];
      const tamF = tamPara(hh.fecha, ancho, 56, 0.6);
      const color = ultimo ? pal.acento : pal.tinta;
      if (pulso > 0 && pulso < 1) out.push({id: 'pulso' + i, x: x - 70, y: y - 70, w: 140, h: 140, tr: [['s', 0.25 + 0.75 * pulso]], op: (1 - pulso) * 0.7,
        firma: color, pintar: (g) => { g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); g.arc(70, 70, 68.5, 0, Math.PI * 2); g.stroke(); }});
      out.push({id: 'fant' + i, x: x - rN, y: y - rN, w: rN * 2, h: rN * 2, op: fantasma, firma: String(rN), pintar: (g) =>
        caja(g, 0, 0, rN * 2, rN * 2, 99, 'rgba(11,7,9,.6)', [{spread: 3, color: 'rgba(244,236,231,.22)', inset: true}])});
      out.push({id: 'punto' + i, x: x - rN, y: y - rN, w: rN * 2, h: rN * 2, m: 60, tr: [['s', k]], firma: `${ultimo}|${Math.round(clamp(k) * 100)}|${pal.acento}`, pintar: (g) => {
        const D = rN * 2, kk = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
        if (ultimo) {
          sombra(g, kk, 0, 0, D, D, 99, 0, 30, 0, pal.a(0.8));
          sombra(g, kk, 0, 0, D, D, 99, 0, 0, 10 * clamp(k), pal.a(0.25));
        } else sombra(g, kk, 0, 0, D, D, 99, 0, 18, 0, 'rgba(255,255,255,.45)');
        const cx = 0.35 * D, cy = 0.3 * D, R = Math.hypot(D - cx, D - cy);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
        gr.addColorStop(0, ultimo ? pal.claro : '#fff'); gr.addColorStop(1, ultimo ? pal.acento : pal.tinta);
        caja(g, 0, 0, D, D, 99, gr);
      }});
      const fF = `900 ${tamF}px ${comillas(OUTFIT)}`;
      out.push(...letrasNodos({id: 'f' + i, texto: hh.fecha, t: ts, t0: ti - 0.03, paso: 1.6 / 30, subir: 36, giroX: -80, fuente: fF, tam: tamF, lh: 1.2,
        ls: -0.02 * tamF, color, x: x - ancho / 2, y: y - 42 - tamF * 1.2, anchoMax: ancho, alinear: 'center',
        sombra: ultimo ? {blur: 26, color: pal.a(0.4)} : undefined, listo}).nodos);
      if (hh.texto) {
        const tamT = n > 3 ? 30 : 36;
        const fT = `700 ${tamT}px ${comillas(OUTFIT)}`;
        out.push({id: 'tx' + i, x: x - ancho / 2, y: y + 34, w: ancho, h: lineaDe(fT, tamT, 1.1, listo).alto * 3, m: 4, tr: [['t', 0, (1 - cap) * 18]],
          op: clamp(cap * 1.4) * 0.82, firma: `${hh.texto}|${listo}`, pintar: (g) =>
            bloque(g, {texto: hh.texto, x: 0, y: 0, ancho, fuente: fT, tam: tamT, lh: 1.1, ls: -0.01 * tamT, color: pal.tinta, alinear: 'center', listo})});
      }
    });
    return out;
  };

  const contenido = (ts: number): (Nodo | null)[] => [
    etiquetaNodo({id: 'etq', texto: d.titulo || 'Paso a paso', t: ts, t0: ENTRA + 0.13, x: 50, y: 40, pal, listo}),
    camNodo,
    ...hitosNodos(ts),
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: T.x, y: T.y, w: T.w, h: T.h, entra: ENTRA, sale: SALE, semilla: 'linea', brillos: [tm[ult] + 0.87], muestras: 8,
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, T.x, T.y, T.w, T.h, 54, tj.placaOp, 'linea', Dh);
  // las chispas van fuera de la tarjeta (sin 3D)
  const nodos = [...tj.nodos, chispasNodo({id: 'chispas', t, t0: tm[ult], x: T.x + pos[ult].x, y: T.y + pos[ult].y, n: 24, semilla: 'linea', fuerza: 900, pal})];
  return <Escena nodos={nodos} Dh={Dh} letras={LETRAS} />;
};

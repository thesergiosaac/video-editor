// La cita EN LIENZO (8-oct-2026): la misma de Cita.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT, PLAYFAIR} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {ruido2D} from '../lib/ruido';
import {anchoTexto, caja, comillas, escribir, escribirMaquina, estadoMaquina, gradiente, lineaDe, lineaNormal, medidor, sinVidrioCss, tarjetaNodos, trazar,
  vidrioTarjeta} from '../lib/tarjetaEscena';

const LETRAS: Letra[] = [[PLAYFAIR, '700'], [PLAYFAIR, '900'], [OUTFIT, '800'], [MONO, '500']];

export const CitaGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos;
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const tq = p.marcas[0];
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const palabras: string[] = String(d.texto).split(/\s+/).filter(Boolean);
  const n = palabras.length;
  const dur = Math.max(1.2, (p.fin || tq + 2) - tq);
  const largo = String(d.texto).length;
  const tam = largo > 80 ? 50 : largo > 50 ? 56 : 62;
  const porLinea = Math.floor(800 / (tam * 0.47));
  const lineas = Math.max(1, Math.ceil(largo / porLinea));
  const T = {x: 86, y: 136, w: 908, h: 80 + lineas * tam * 1.17 + 150};
  const subrayar = Math.min(3, Math.max(1, Math.floor(n / 3)));
  const tSub = tq + dur + 0.2;
  const q = sp(t, ENTRA + 0.1, RESORTES.pop);
  const qx = ruido2D('comilla-x', t * 0.5, 0) * 4, qy = ruido2D('comilla-y', 0, t * 0.45) * 5, qr = ruido2D('comilla-r', t * 0.4, 3) * 3;
  const tN = ENTRA + 0.5;
  const aro = rampa(t, tN - 0.07, tN + 0.53, EASE.llega);
  const raya = rampa(t, tN + 0.07, tN + 0.4, EASE.llega);
  const avatar = sp(t, tN - 0.1, RESORTES.pop);
  const iniciales = String(d.autor).split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join('');

  // la comilla gigante (Playfair 900, 310 px, line-height 1)
  const fQ = `900 310px ${comillas(PLAYFAIR)}`;
  const g0 = medidor(); g0.font = fQ;
  const anQ = g0.measureText('“').width;
  const LQ = lineaDe(fQ, 310, 1, listo);
  const comilla: Nodo = {id: 'comilla', x: 28, y: -122, w: anQ, h: 310, m: 120,
    tr: [['t', qx, qy + (1 - q) * -50], ['s', q], ['rz', (1 - q) * -35 + qr]], origen: [anQ * 0.4, 310 * 0.6], op: clamp(q * 2),
    firma: `${pal.acento}|${listo}`, pintar: (g) => {
      const k = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
      g.shadowColor = pal.a(0.45); g.shadowBlur = 40 * k; g.shadowOffsetY = 10 * k;
      escribir(g, '“', 0, LQ.base, fQ, 0, pal.acento);
    }};

  // las palabras (inline-block) en renglones de 800 px; cada una entra subiendo, girando y enfocándose
  const fP = `italic 700 ${tam}px ${comillas(PLAYFAIR)}`;
  const lsP = -0.005 * tam;
  const LP = lineaDe(fP, tam, 1.17, listo);
  const g1 = medidor(); g1.font = fP;
  const espacio = g1.measureText(' ').width + lsP;
  const cajas: {x: number; y: number; w: number}[] = [];
  let cx = 0, cy = 0;
  palabras.forEach((w) => {
    const an = anchoTexto(w, fP, lsP);
    if (cx > 0 && cx + an > 800 + 0.5) { cx = 0; cy += LP.alto; }
    cajas.push({x: cx, y: cy, w: an});
    cx += an + espacio;
  });
  const textoNodos = (ts: number): Nodo[] => palabras.map((w, i) => {
    const t0 = tq + (dur * i) / Math.max(1, n);
    const pp = sp(ts, t0 - 0.03, {damping: 16, stiffness: 150, mass: 0.6});
    const borroso = (1 - clamp(pp)) * 12;
    const subraya = i >= n - subrayar ? tSub + (i - (n - subrayar)) * 0.13 : null;
    const u = subraya != null ? sp(ts, subraya, {damping: 18, stiffness: 140, mass: 0.7}) : 0;
    const ultima = i === n - 1;
    const c = cajas[i];
    return {id: 'w' + i, x: 58 + c.x, y: 80 + c.y, w: c.w, h: LP.alto, m: Math.ceil(0.4 * tam) + 20, tr: [['t', 0, (1 - pp) * 30], ['rz', (1 - pp) * -5]],
      op: clamp(pp * 1.6), blur: borroso > 0.3 ? borroso : 0, firma: `${w}|${Math.round(u * 1000)}|${pal.acento}|${listo}`, pintar: (g) => {
        if (subraya != null && u > 0) {
          const k = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
          const x0 = -0.02 * tam, x1 = c.w - (ultima ? 0.05 * tam : -0.27 * tam);
          const y1 = LP.alto - 0.02 * tam;
          g.save();
          g.globalAlpha = clamp(u * 3);
          const wr = (x1 - x0) * u;
          g.shadowColor = pal.a(0.6); g.shadowBlur = 14 * k;
          // scaleX(u) desde la izquierda: el degradado entero cabe en lo que se ve
          caja(g, x0, y1 - 7, wr, 7, 9, gradiente(g, x0, y1 - 7, Math.max(0.01, wr), 7, 90, [[0, pal.acento], [1, pal.claro]]));
          g.restore();
        }
        escribir(g, w, 0, LP.base, fP, lsP, pal.tinta);
      }} as Nodo;
  });

  // el autor: avatar con iniciales y su aro, la raya, el nombre que se escribe (flex, align-items: center, gap 18)
  const fA = `500 27px ${comillas(MONO)}`;
  const LA = lineaNormal(fA, listo);
  const altoFila = Math.max(62, LA.alto);
  const yFila = T.h - 36 - altoFila;
  const autor = String(d.autor).toUpperCase();
  const autorNodos = (ts: number): Nodo[] => [
    {id: 'avatar', x: 56, y: yFila + (altoFila - 62) / 2, w: 62, h: 62, m: 6, tr: [['s', avatar]], firma: `${iniciales}|${Math.round(aro * 1000)}|${pal.acento}|${listo}`,
      pintar: (g) => {
        caja(g, 5, 5, 52, 52, 99, gradiente(g, 5, 5, 52, 52, 160, [[0, 'rgba(255,255,255,.14)'], [1, 'rgba(255,255,255,.03)']]));
        const fI = `800 21px ${comillas(OUTFIT)}`;
        const LI = lineaNormal(fI, listo);
        const an = anchoTexto(iniciales, fI, 0.02 * 21);
        escribir(g, iniciales, 5 + (52 - an) / 2, 5 + (52 - LI.alto) / 2 + LI.asc, fI, 0.02 * 21, pal.tinta);
        g.strokeStyle = pal.acento; g.lineWidth = 3; g.lineCap = 'round';
        trazar(g, [['a', 31, 31, 29, -Math.PI / 2, Math.PI * 1.5]], aro);
      }},
    {id: 'raya', x: 56 + 62 + 18, y: yFila + (altoFila - 4) / 2, w: 40, h: 4, m: 4, firma: String(Math.round(raya * 1000)), pintar: (g) => {
      g.strokeStyle = 'rgba(244,236,231,.45)'; g.lineWidth = 3; g.lineCap = 'round';
      trazar(g, [['l', 0, 2, 40, 2]], raya);
    }},
    {id: 'autor', x: 56 + 62 + 18 + 40 + 18, y: yFila + (altoFila - LA.alto) / 2, w: anchoTexto(autor, fA, 0.17 * 27) + 30, h: LA.alto, m: 10,
      firma: `${autor}|${estadoMaquina(autor, ts, tN + 0.13, 1.2)}|${pal.acento}|${listo}`, pintar: (g) => {
        escribirMaquina(g, {texto: autor, t: ts, t0: tN + 0.13, velocidad: 1.2, x: 0, base: LA.asc, fuente: fA, tam: 27, ls: 0.17 * 27, color: pal.tinta2, acento: pal.acento});
      }},
  ];

  const contenido = (ts: number): (Nodo | null)[] => [comilla, ...textoNodos(ts), ...autorNodos(ts)];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: T.x, y: T.y, w: T.w, h: T.h, entra: ENTRA, sale: SALE, semilla: 'cita', brillos: [tSub + 0.55],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, T.x, T.y, T.w, T.h, 54, tj.placaOp, 'cita', Dh);
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

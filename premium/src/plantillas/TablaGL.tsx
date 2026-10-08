// La tabla EN LIENZO (8-oct-2026): la misma de Tabla.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {bloque, comillas, etiquetaNodo, letrasNodos, lineaNormal, sinVidrioCss, tarjetaNodos, trazar, vidrioTarjeta} from '../lib/tarjetaEscena';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 40, FILA = 84;
const COL = 150;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const TablaGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const filas: [string, boolean, boolean][] = (d.filas || []).slice(0, 5);
  const n = filas.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.8 + i * 0.75);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const cab = 210;
  const h = cab + n * FILA + PAD;
  const xA = ANCHO - PAD - COL * 2, xB = ANCHO - PAD - COL;
  const tamTit = String(d.titulo || '').length > 24 ? 44 : 52;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const fCol = `500 22px ${comillas(MONO)}`;
  const LCol = lineaNormal(fCol, listo);
  const kCol = clamp(sp(t, ENTRA + 0.55, RESORTES.carta) * 1.5);
  const linea = clamp(rampa(t, ENTRA + 0.5, ENTRA + 1.1, EASE.llega));
  const AN = ANCHO - PAD * 2;

  const columnas: Nodo[] = [[xA, String(d.a || 'Uno'), false], [xB, String(d.b || 'Otro'), true]].map(([x, txt, es]: any, i) => ({
    id: 'col' + i, x: Number(x), y: 148, w: COL, h: LCol.alto, op: kCol, firma: `${txt}|${es}|${pal.acento}|${listo}`, pintar: (g) =>
      bloque(g, {texto: String(txt).toUpperCase(), x: 0, y: 0, ancho: COL, fuente: fCol, tam: 22, lh: LCol.alto / 22, ls: 0.12 * 22,
        color: es ? pal.acento : pal.tinta3, alinear: 'center', partir: false, puntos: true, listo}),
  }));
  const nodosFilas: Nodo[] = filas.map(([txt, ma, mb], i) => {
    const ti = cuando(i);
    const k = sp(t, ti, {damping: 14, stiffness: 120, mass: 0.85});
    const marca = rampa(t, ti + 0.2, ti + 0.6, EASE.llega);
    const tam = txt.length > 26 ? 32 : 38;
    const fTxt = `800 ${tam}px ${comillas(OUTFIT)}`;
    const LT = lineaNormal(fTxt, listo);
    const altoF = FILA - 12;
    return {id: 'fila' + i, x: PAD, y: cab + i * FILA, w: AN, h: altoF, m: 8, tr: [['t', (1 - k) * -40, 0]], op: clamp(k * 1.7),
      firma: `${txt}|${ma}|${mb}|${Math.round(marca * 1000)}|${pal.acento}|${listo}`, pintar: (g) => {
        bloque(g, {texto: txt, x: 0, y: (altoF - LT.alto) / 2, ancho: AN - COL * 2 - 20, fuente: fTxt, tam, lh: LT.alto / tam, ls: -0.015 * tam, color: pal.tinta,
          partir: false, puntos: true, listo});
        [ma, mb].forEach((si, j) => {
          g.save();
          g.translate(AN - COL * 2 + j * COL + (COL - 42) / 2, (altoF - 42) / 2);
          g.lineCap = 'round'; g.lineJoin = 'round';
          if (si) {
            g.strokeStyle = j === 1 ? pal.acento : 'rgba(244,236,231,.62)'; g.lineWidth = 5;
            trazar(g, [['l', 10, 21, 18, 29], ['l', 18, 29, 32, 13]], marca);
          } else {
            g.strokeStyle = 'rgba(244,236,231,.30)'; g.lineWidth = 4.5;
            trazar(g, [['l', 12, 12, 30, 30]], marca);
            trazar(g, [['l', 30, 12, 12, 30]], Math.max(0, marca * 1.3 - 0.3));
          }
          g.restore();
        });
      }} as Nodo;
  });

  const contenido = (ts: number): (Nodo | null)[] => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD, y: 30, pal, listo}),
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.35, paso: 0.8 / 30, subir: 36, fuente: fTit, tam: tamTit, lh: 1.05,
      ls: -0.03 * tamTit, color: pal.tinta, x: PAD, y: 76, listo}).nodos,
    ...columnas,
    {id: 'raya', x: PAD, y: 190, w: AN, h: 2, tr: [['s2', linea, 1]], origen: [0, 1], firma: 'r', pintar: (g) => { g.fillStyle = 'rgba(244,236,231,.14)'; g.fillRect(0, 0, AN, 2); }},
    ...nodosFilas,
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h, entra: ENTRA, sale: SALE, semilla: 'tabla', brillos: [cuando(n - 1) + 0.5],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, h, 54, tj.placaOp, 'tabla', Dh);
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

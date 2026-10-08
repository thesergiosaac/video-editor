// Las claves EN LIENZO (8-oct-2026): las mismas de Claves.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {OUTFIT} from '../tema';
import {RESORTES, clamp, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {bloque, caja, chispasNodo, comillas, escribir, etiquetaNodo, gradiente, letrasNodos, lineaDe, lineaNormal, medidor, sinVidrioCss, tarjetaNodos,
  vidrioTarjeta} from '../lib/tarjetaEscena';
import {MONO} from '../tema';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 40;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const ClavesGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const claves: string[] = (d.claves || d.items || []).slice(0, 3);
  const n = claves.length || 1;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 0.85);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const hueco = 18;
  const an = Math.floor((ANCHO - PAD * 2 - hueco * (n - 1)) / n);
  const cab = 158, CAJA = 260;
  const h = cab + CAJA + PAD;
  const tamTit = String(d.titulo || '').length > 24 ? 46 : 56;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const LT = lineaDe(fTit, tamTit, 1.05, listo);

  // las cajas (el resorte lo calculaba la plantilla: va en t)
  const cajas: Nodo[] = claves.map((txt, i) => {
    const ti = cuando(i);
    const k = sp(t, ti, {damping: 13, stiffness: 125, mass: 0.88});
    const b = sp(t, ti + 0.08, RESORTES.pop);
    const tam = txt.length > 30 ? 30 : 36;
    const fTxt = `800 ${tam}px ${comillas(OUTFIT)}`;
    return {id: 'caja' + i, x: PAD + i * (an + hueco), y: cab, w: an, h: CAJA, m: 60, tr: [['t', 0, (1 - k) * 34], ['s', 0.92 + 0.08 * k]], op: clamp(k * 1.7),
      firma: `${txt}|${an}|${listo}`,
      pintar: (g) => {
        caja(g, 0, 0, an, CAJA, 26, gradiente(g, 0, 0, an, CAJA, 160, [[0, 'rgba(255,255,255,.085)'], [1, 'rgba(255,255,255,.03)']]),
          [{spread: 1.5, color: 'rgba(255,255,255,.10)', inset: true}, {y: 22, blur: 50, spread: -22, color: 'rgba(0,0,0,.9)'}]);
        g.save();
        g.beginPath(); g.rect(0, 0, an, CAJA); g.clip();
        bloque(g, {texto: txt, x: 24, y: 24 + 56 + 16, ancho: an - 48, fuente: fTxt, tam, lh: 1.14, ls: -0.02 * tam, color: pal.tinta, listo});
        g.restore();
      },
      hijos: [{id: 'num' + i, x: 24, y: 24, w: 56, h: 56, m: 40, tr: [['s', b]], firma: `${i}|${pal.acento}|${listo}`, pintar: (g) => {
        caja(g, 0, 0, 56, 56, 18, gradiente(g, 0, 0, 56, 56, 180, [[0, pal.claro], [1, pal.acento]]), [{y: 10, blur: 24, spread: -8, color: pal.a(0.8)}]);
        const f = `900 30px ${comillas(OUTFIT)}`;
        const L = lineaNormal(f, listo);
        const g0 = medidor(); g0.font = f;
        escribir(g, String(i + 1), (56 - g0.measureText(String(i + 1)).width) / 2, (56 - L.alto) / 2 + L.asc, f, 0, pal.sobre);
      }}]};
  });

  const contenido = (ts: number) => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD, y: 32, pal, listo}),
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.35, paso: 0.8 / 30, subir: 38, fuente: fTit, tam: tamTit, lh: 1.05,
      ls: -0.03 * tamTit, color: pal.tinta, x: PAD, y: 80, listo}).nodos,
    ...cajas,
    chispasNodo({id: 'chispas', t: ts, t0: cuando(n - 1) + 0.35, x: PAD + (n - 0.5) * (an + hueco) - hueco, y: cab + CAJA / 2, n: 18, semilla: 'clav', fuerza: 640, pal}),
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h, entra: ENTRA, sale: SALE, semilla: 'clav', brillos: [cuando(n - 1) + 0.5],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, h, 54, tj.placaOp, 'clav', Dh);
  void LT;
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

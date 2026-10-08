// La lista EN LIENZO (8-oct-2026): la MISMA de Lista.tsx (tiempos, medidas, colores y movimientos), con el motor de nodos
// (lib/escena.tsx): cada pieza se pinta una vez o cuando cambia, y los giros, opacidades y desenfoques los hace el
// navegador (celular) o el compositor WebGL (nube). Sergio: «el gráfico que dice 1. gancho 2. conector… va lento».
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {OUTFIT} from '../tema';
import type {Paleta} from '../tema';
import {EASE, RESORTES, clamp, giro, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {anchoTexto, comillas, escalaDe, escribir, letrasNodos, lineaDe, medidor, pintarTambor, sufijoMuestra, tarjetaNodos, trazar, vidrioTarjeta} from '../lib/tarjetaEscena';
import {redondeado, sombra, bordeInterior, metricas} from '../lib/lienzo';
import {vidrioGL} from '../lib/Piezas';

const X0 = 86, Y0 = 130, ANCHO = 908, FILA0 = 190, PASO = 80;
const NEGATIVO = /error|equivoc|fall|mito|mal[oa]?s?\b|peor|evita|no hag|nunca|problema|riesgo|pecad|trampa|culpa|razones por las que no/i;
const POSITIVO = /consejo|clave|tip|paso|forma|manera|secreto|beneficio|ventaja|regla|h[aá]bito|idea|herramienta|app|truco|estrategia|cosas que s[ií]/i;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800']];
const R3 = (v: number) => Math.round(v * 1000);

/* el número de la fila: círculo con degradado, sombra de color y el número */
const pintarInsignia = (i: number, pal: Paleta) => (g: CanvasRenderingContext2D) => {
  const k = escalaDe(g);
  sombra(g, k, 0, 0, 54, 54, 27, 8, 22, -6, pal.a(0.7));
  redondeado(g, 0, 0, 54, 54, 27);
  const bg = g.createLinearGradient(0, 0, 0, 54);
  bg.addColorStop(0, pal.claro); bg.addColorStop(1, pal.acento);
  g.fillStyle = bg; g.fill();
  bordeInterior(g, 0, 0, 54, 54, 27, 2, 0, 'rgba(255,255,255,.35)');
  const fuente = `900 30px ${comillas(OUTFIT)}`;
  g.font = fuente; (g as any).letterSpacing = '0px';
  const {asc, desc} = metricas(medidor(), fuente);
  g.fillStyle = pal.sobre; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const tw = g.measureText(String(i + 1)).width;
  g.fillText(String(i + 1), (54 - tw) / 2, (54 - (asc + desc)) / 2 + asc);
};

/* el texto de la fila (con «…» si no cabe) y su marca ✕ / ✓ que se dibuja de a poco */
const pintarFila = (o: {texto: string; tam: number; ancho: number; marca: 'x' | 'v' | null; aro: number; c1: number; c2: number; pal: Paleta; listo: boolean}) => (g: CanvasRenderingContext2D) => {
  const {pal} = o;
  const fuente = `800 ${o.tam}px ${comillas(OUTFIT)}`;
  const ls = -0.015 * o.tam;
  let texto = o.texto;
  if (anchoTexto(texto, fuente, ls) > o.ancho) {
    while (texto.length > 1 && anchoTexto(texto + '…', fuente, ls) > o.ancho) texto = texto.slice(0, -1);
    texto = texto.trimEnd() + '…';
  }
  const {asc, desc} = metricas(medidor(), fuente, o.listo);
  escribir(g, texto, 78, (72 - (asc + desc)) / 2 + asc, fuente, ls, pal.tinta);
  if (!o.marca) return;
  g.save();
  g.translate(820 - 44, 14);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = o.marca === 'v' ? pal.a(0.5) : 'rgba(244,236,231,.22)'; g.lineWidth = 2.5;
  trazar(g, [['a', 22, 22, 20, -Math.PI / 2, Math.PI * 1.5]], o.aro);
  if (o.marca === 'x') {
    g.strokeStyle = 'rgba(244,236,231,.8)'; g.lineWidth = 4;
    if (o.c1 > 0) trazar(g, [['l', 15, 15, 29, 29]], o.c1);
    if (o.c2 > 0) trazar(g, [['l', 29, 15, 15, 29]], o.c2);
  } else if (o.c1 > 0) {
    g.strokeStyle = pal.acento; g.lineWidth = 4.5;
    trazar(g, [['l', 12, 23, 19, 30], ['l', 19, 30, 32, 15]], o.c1);
  }
  g.restore();
};

/* el resalte de la fila que estás diciendo: se pinta una vez y se mueve */
const pintarFoco = (pal: Paleta) => (g: CanvasRenderingContext2D) => {
  const w = ANCHO - 44;
  redondeado(g, 0, 0, w, 76, 26);
  const bg = g.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0, 'rgba(255,255,255,.075)'); bg.addColorStop(1, 'rgba(255,255,255,.025)');
  g.fillStyle = bg; g.fill();
  bordeInterior(g, 0, 0, w, 76, 26, 0, 1, 'rgba(255,255,255,.06)');
  const k = escalaDe(g);
  g.save();
  g.shadowColor = pal.a(0.9); g.shadowBlur = 14 * k;
  redondeado(g, -1, 20, 5, 36, 9); g.fillStyle = pal.acento; g.fill();
  g.restore();
};

export const ListaGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, vista, W, H, esc, inicio, fps} = G;
  const d = p.datos;
  const items: string[] = d.items;
  const n = items.length;
  const tm: number[] = p.marcas;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const listo = useLetras(LETRAS);
  const juntos = Math.max(tm[n - 1] + 0.9, SALE - 0.95);
  const marca: 'x' | 'v' | null = NEGATIVO.test(d.titulo || '') ? 'x' : POSITIVO.test(d.titulo || '') ? 'v' : null;
  const altoEn = (tt: number) => 212 + PASO * tm.reduce((acc, ti) => acc + sp(tt, ti - 0.17, RESORTES.carta), 0);
  const alto = altoEn(t);
  const tamTit = String(d.titulo || '').length > 22 ? 46 : 58;
  // lo que calculaba la plantilla misma va en t (el número, la línea, el resalte y el alto del recorte); lo que llevaba su
  // propio reloj (las letras del título y las filas) va en el instante de cada muestra del desenfoque (ver tarjetaNodos)
  const num = giro(t, ENTRA + 0.07, 0.67, 10 + n);
  const linea = rampa(t, ENTRA + 0.4, ENTRA + 1.07, EASE.llega);
  const foco = sp(t, tm[0] - 0.03, RESORTES.carta) * (1 - rampa(t, juntos, juntos + 0.4));
  const yFoco = FILA0 + PASO * tm.slice(1).reduce((acc, ti) => acc + sp(t, ti - 0.03, RESORTES.carta), 0);

  // la fila de arriba: el número que rueda (128 px) y el título con letras cinéticas, en la misma línea base
  const fNum = `900 128px ${comillas(OUTFIT)}`, lsNum = -0.04 * 128;
  const LN = lineaDe(fNum, 128, 1.2, listo);
  const g0 = medidor(); g0.font = fNum; (g0 as any).letterSpacing = '0px';
  const celda = g0.measureText(String(n)).width + lsNum;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const LT = lineaDe(fTit, tamTit, 1.2, listo);
  const base = 14 + LN.base;
  const tambor: Nodo = {id: 'num', x: 44 - 0.4 * celda, y: 14, w: 1.8 * celda, h: 1.2 * 128, firma: `${R3(num)}|${n}|${pal.acento}|${listo}`,
    pintar: (g) => pintarTambor(g, {pos: num, x: 0.4 * celda, top: 0, cw: celda, tam: 128, fuente: fNum, ls: lsNum, linea: LN.base, color: pal.acento,
      sombra: (gg, k) => { gg.shadowColor = pal.a(0.35); gg.shadowBlur = 40 * k; }, listo})};
  const divisor: Nodo | null = linea > 0 ? {id: 'div', x: 0, y: 168, w: ANCHO, h: 4, m: 4, firma: String(R3(linea)), pintar: (g) => {
    g.strokeStyle = 'rgba(244,236,231,.14)'; g.lineWidth = 2; g.lineCap = 'round';
    trazar(g, [['l', 44, 2, ANCHO - 44, 2]], linea);
  }} : null;
  const anchoTxt = 820 - 78 - (marca ? 24 + 44 : 0);
  const focoNodo: Nodo | null = foco > 0.01 ? {id: 'foco', x: 22, y: 0, w: ANCHO - 44, h: 76, m: 24, tr: [['t', 0, yFoco - 2]], origen: [0, 0], op: clamp(foco), firma: pal.acento, pintar: pintarFoco(pal)} : null;

  const contenido = (ts: number, im: number, nm: number) => {
    const suf = sufijoMuestra(im, nm);
    const titulo = letrasNodos({id: 'tit', texto: d.titulo || '', t: ts, t0: ENTRA + 0.2, paso: 0.8 / 30, subir: 40, fuente: fTit, tam: tamTit, lh: 1.2,
      ls: -0.025 * tamTit, ws: 0.1 * tamTit, color: pal.tinta, x: 44 + celda + 20, y: base - LT.base, listo});
    // las filas: cada una entra girando en Y con su perspective; el número da una vuelta; la marca se dibuja
    const filas: Nodo[] = items.map((it, i) => {
      const ti = tm[i], sig = tm[i + 1];
      const r = sp(ts, ti - 0.03, {damping: 13, stiffness: 125, mass: 0.8});
      const b = sp(ts, ti + 0.07, RESORTES.pop);
      const aro = rampa(ts, ti + 0.2, ti + 0.6, EASE.llega);
      const c1 = rampa(ts, ti + 0.33, ti + 0.53, EASE.llega);
      const c2 = rampa(ts, ti + 0.47, ti + 0.67, EASE.llega);
      const atenuar = sig != null ? rampa(ts, sig - 0.03, sig + 0.27) * (1 - rampa(ts, juntos, juntos + 0.4)) : 0;
      const tam = it.length > 24 ? 38 : 44;
      return {id: 'fila' + i, fuente: 'fila' + i + suf, x: 44, y: FILA0 + i * PASO, w: 820, h: 72, m: 12, tr: [['p', 900], ['t', (1 - r) * -80, 0], ['ry', (1 - r) * -38]],
        origen: [0, 36], op: clamp(r * 1.6) * (1 - 0.55 * atenuar),
        firma: `${it}|${marca}|${R3(aro)}|${R3(c1)}|${R3(c2)}|${pal.acento}|${listo}`,
        pintar: pintarFila({texto: it, tam, ancho: anchoTxt, marca, aro, c1, c2, pal, listo}),
        hijos: [{id: 'ins' + i, x: 0, y: 9, w: 54, h: 54, m: 30, tr: [['s', b], ['rz', (1 - b) * -120]], firma: `${i}|${pal.acento}|${listo}`, pintar: pintarInsignia(i, pal)}]} as Nodo;
    });
    return [tambor, ...titulo.nodos, divisor, {id: 'filas', x: 0, y: 0, w: ANCHO, h: alto, recorte: 54, hijos: [focoNodo, ...filas]} as Nodo];
  };

  const sinVidrioGL = vista && !((p.forma === 'encima' || p.forma === 'profundo') && vidrioGL());
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h: altoEn, entra: ENTRA, sale: SALE, semilla: 'lista', brillos: [juntos + 0.13],
    contenido, Dh, vidrioCss: sinVidrioGL});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, alto, 54, tj.placaOp, 'lista', Dh);
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

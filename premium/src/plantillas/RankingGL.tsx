// El ranking EN LIENZO (8-oct-2026): el mismo de Ranking.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {anchoTabular, anchoTexto, bloque, caja, chispasNodo, cifraNodo, comillas, escribir, etiquetaNodo, gradiente, letrasNodos, lineaNormal, medidor,
  sinVidrioCss, tarjetaNodos, vidrioTarjeta} from '../lib/tarjetaEscena';

const X0 = 86, Y0 = 150, ANCHO = 908, CAB = 172, FILA = 96, PAD = 44;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const RankingGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const items: [string, number][] = (d.items || []).slice(0, 5);
  const n = items.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 0.85);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const max = Math.max(...items.map(([, v]) => v), 1);
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const altoEn = (tt: number) => CAB + 48 + FILA * items.reduce((a, _, i) => a + sp(tt, cuando(i) - 0.16, RESORTES.carta), 0);
  const alto = altoEn(t);
  const tamTit = String(d.titulo || '').length > 24 ? 46 : 56;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;

  // el renglón de cada puesto (flex con align-items: baseline): número, nombre, cifra
  const fNum = `500 22px ${comillas(MONO)}`, fNom = `800 40px ${comillas(OUTFIT)}`, fVal = `900 42px ${comillas(OUTFIT)}`;
  const LNum = lineaNormal(fNum, listo), LNom = lineaNormal(fNom, listo), LVal = lineaNormal(fVal, listo);
  const base = Math.max(LNum.asc, LNom.asc, LVal.asc);
  const altoRenglon = base + Math.max(LNum.desc, LNom.desc, LVal.desc);
  const tab = anchoTabular(fVal, listo);

  const filas = (ts: number): Nodo[] => items.map(([nombre, valor], i) => {
    const ti = cuando(i);
    const k = sp(t, ti, {damping: 15, stiffness: 105, mass: 0.9});
    const barra = rampa(t, ti + 0.05, ti + 0.85, EASE.llega) * (valor / max);
    const primero = i === 0;
    const texto = `${Math.round(valor)}${sufijo}`;
    const g0 = medidor(); g0.font = fVal;
    const anVal = texto.split('').reduce((a, ch) => a + (/\d/.test(ch) ? tab : g0.measureText(ch).width) - 0.03 * 42, 0);
    const anNom = 820 - 34 - 16 - 16 - anVal;
    const yBarra = altoRenglon + 10;
    return {id: 'r' + i, x: PAD, y: CAB + i * FILA, w: 820, h: FILA - 20, m: 30, tr: [['t', (1 - k) * -60, 0]], op: clamp(k * 1.7),
      firma: `${nombre}|${Math.round(barra * 4000)}|${primero}|${pal.acento}|${listo}`,
      pintar: (g) => {
        escribir(g, String(i + 1), 0, base, fNum, 0.14 * 22, primero ? pal.acento : pal.tinta3);
        bloque(g, {texto: nombre, x: 34 + 16, y: base - LNom.asc, ancho: anNom, fuente: fNom, tam: 40, lh: LNom.alto / 40, ls: -0.02 * 40,
          color: primero ? pal.tinta : 'rgba(244,236,231,.78)', partir: false, puntos: true, listo});
        // la barra (la pista recorta el brillo del relleno)
        g.save();
        caja(g, 0, yBarra, 820, 12, 99, 'rgba(244,236,231,.09)');
        redondear(g, 0, yBarra, 820, 12); g.clip();
        if (barra > 0) {
          const wf = 820 * barra;
          caja(g, 0, yBarra, wf, 12, 99, primero ? gradiente(g, 0, yBarra, wf, 12, 90, [[0, pal.claro], [1, pal.acento]]) : 'rgba(244,236,231,.34)',
            primero ? [{blur: 20, color: pal.a(0.6)}] : []);
        }
        g.restore();
      },
      hijos: [cifraNodo({id: 'v' + i, texto, t: ts, t0: ti + 0.1, dur: 0.75, fuente: fVal, tam: 42, ls: -0.03 * 42, color: primero ? pal.acento : pal.tinta2,
        x: 820 - anVal, y: base - LVal.asc, w: anVal, alinear: 'left', lh: LVal.alto / 42, tabular: true,
        sombra: primero ? {blur: 26, color: pal.a(0.45)} : undefined, listo})]} as Nodo;
  });

  const contenido = (ts: number) => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD, y: 34, pal, listo}),
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.35, paso: 0.8 / 30, subir: 38, fuente: fTit, tam: tamTit, lh: 1.05,
      ls: -0.03 * tamTit, color: pal.tinta, x: PAD, y: 82, listo}).nodos,
    {id: 'filas', x: 0, y: 0, w: ANCHO, h: alto, recorte: 54, hijos: filas(ts)} as Nodo,
    n ? chispasNodo({id: 'chispas', t: ts, t0: cuando(0) + 0.75, x: ANCHO - 120, y: CAB + 26, n: 16, semilla: 'rank', fuerza: 620, pal}) : null,
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h: altoEn, entra: ENTRA, sale: SALE, semilla: 'rank', brillos: [cuando(n - 1) + 0.5],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, alto, 54, tj.placaOp, 'rank', Dh);
  void anchoTexto;
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};
const redondear = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  const r = Math.min(h / 2, w / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};

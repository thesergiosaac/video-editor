// La meta EN LIENZO (8-oct-2026): la misma de Meta.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, golpe, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {anchoTexto, caja, chispasNodo, cifraNodo, comillas, escribir, etiquetaNodo, gradiente, letrasNodos, lineaNormal, sinVidrioCss, tarjetaNodos,
  vidrioTarjeta} from '../lib/tarjetaEscena';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 428, PAD = 46;
const BARRA = ANCHO - PAD * 2, GRUESO = 30;
const LETRAS: Letra[] = [[OUTFIT, '900'], [MONO, '500']];

export const MetaGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const valor = Math.max(0, Number(d.valor) || 0);
  const meta = Math.max(valor, Number(d.meta) || 100);
  const frac = Math.min(1, valor / meta);
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const avance = sp(t, tc, {damping: 16, stiffness: 62, mass: 1.1}, 45) * frac;
  const llega = tc + 1.25;
  const latido = golpe(t, llega, 5, 2.3);
  const kMeta = sp(t, ENTRA + 0.6, RESORTES.pop);
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const x = PAD + BARRA * avance;
  const tamTit = String(d.titulo || '').length > 22 ? 52 : 64;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const fPie = `500 22px ${comillas(MONO)}`;
  const LPie = lineaNormal(fPie, listo);
  const pieMeta = String(d.pieMeta || `meta ${Math.round(meta)}${sufijo}`).toUpperCase();
  const anPieMeta = anchoTexto(pieMeta, fPie, 0.16 * 22);
  const xCifra = Math.max(PAD, Math.min(x - 110, ANCHO - PAD - 220));
  const fCifra = `900 86px ${comillas(OUTFIT)}`;

  const contenido = (ts: number): (Nodo | null)[] => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD, y: 36, pal, listo}),
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.35, paso: 0.8 / 30, subir: 40, fuente: fTit, tam: tamTit, lh: 1.04,
      ls: -0.035 * tamTit, color: pal.tinta, x: PAD, y: 92, listo}).nodos,
    // la cifra, encima del punto al que llegó
    cifraNodo({id: 'cifra', texto: `${Math.round(valor)}${sufijo}`, t: ts, t0: tc, dur: 1.1, fuente: fCifra, tam: 86, ls: -0.04 * 86, color: pal.acento,
      x: xCifra, y: 196, w: 220, alinear: 'center', lh: 1, tabular: true, sombra: {blur: 40, color: pal.a(0.45)}, tr: [['s', 1 + 0.06 * latido]], listo}),
    // la barra: la pista, el relleno con su brillo, la cabeza y dónde está la meta
    {id: 'pista', x: PAD, y: 306, w: BARRA, h: GRUESO, m: 4, firma: 'p', pintar: (g) =>
      caja(g, 0, 0, BARRA, GRUESO, 99, 'rgba(244,236,231,.10)', [{spread: 1, color: 'rgba(255,255,255,.06)', inset: true}])},
    avance > 0 ? {id: 'relleno', x: PAD, y: 306, w: BARRA * avance, h: GRUESO, m: 60, firma: `${Math.round(avance * 8000)}|${pal.acento}`, pintar: (g) => {
      const wf = BARRA * avance;
      caja(g, 0, 0, wf, GRUESO, 99, gradiente(g, 0, 0, wf, GRUESO, 90, [[0, pal.hondo], [1, pal.claro]]), [{blur: 26, color: pal.a(0.7)}]);
    }} : null,
    avance > 0.01 ? {id: 'cabeza', x: PAD, y: 306 - 8, w: 26, h: GRUESO + 16, m: 50, tr: [['t', BARRA * avance - 13, 0]], origen: [0, 0], firma: pal.acento, pintar: (g) =>
      caja(g, 0, 0, 26, GRUESO + 16, 99, pal.tinta, [{blur: 22, color: pal.a(0.9)}])} : null,
    {id: 'tope', x: PAD + BARRA - 3, y: 306 - 30, w: 6, h: GRUESO + 60, tr: [['s2', 1, clamp(kMeta)]], firma: 't', pintar: (g) =>
      caja(g, 0, 0, 6, GRUESO + 60, 9, 'rgba(244,236,231,.42)')},
    {id: 'pieMeta', x: ANCHO - (PAD - 10) - anPieMeta, y: 372, w: anPieMeta, h: LPie.alto, op: clamp(kMeta * 1.4), firma: `${pieMeta}|${listo}`, pintar: (g) =>
      escribir(g, pieMeta, 0, LPie.asc, fPie, 0.16 * 22, pal.tinta3)},
    d.pie ? {id: 'pie', x: PAD, y: 372, w: 600, h: LPie.alto, op: clamp(sp(t, tc + 0.5, RESORTES.carta) * 1.4), firma: `${d.pie}|${listo}`, pintar: (g) =>
      escribir(g, String(d.pie).toUpperCase(), 0, LPie.asc, fPie, 0.16 * 22, pal.tinta3)} : null,
    chispasNodo({id: 'chispas', t: ts, t0: llega, x: Math.min(x, ANCHO - PAD), y: 306 + GRUESO / 2, n: 18, semilla: 'meta', fuerza: 700, pal}),
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h: ALTO, entra: ENTRA, sale: SALE, semilla: 'meta', brillos: [llega + 0.35],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, ALTO, 54, tj.placaOp, 'meta', Dh);
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

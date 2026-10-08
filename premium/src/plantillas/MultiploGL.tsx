// El múltiplo EN LIENZO (8-oct-2026): el mismo de Multiplo.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {bloque, caja, chispasNodo, comillas, escribir, etiquetaNodo, gradiente, letrasNodos, lineaDe, lineaNormal, medidor, pintarTambor, sinVidrioCss,
  tarjetaNodos, vidrioTarjeta} from '../lib/tarjetaEscena';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 546, PAD = 50;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '700'], [MONO, '500']];

export const MultiploGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const veces = Math.max(2, Math.min(8, Math.round(Number(d.veces) || 3)));
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const llega = tc + 0.28 * veces + 0.45;
  const latido = golpe(t, llega, 5, 2.4);
  const num = rampa(t, tc, llega - 0.1, EASE.llega) * veces;
  const vel = num - rampa(t - 1 / 30, tc, llega - 0.1, EASE.llega) * veces;
  const an = Math.min(152, Math.floor((ANCHO - PAD * 2 - 24 * (veces - 1)) / veces));
  const tamTit = String(d.titulo || '').length > 18 ? 46 : 56;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;

  // «×» (96 px, line-height normal) y el número (168 px, line-height 1) en un flex con align-items: baseline
  const fX = `900 96px ${comillas(OUTFIT)}`, fN = `900 168px ${comillas(OUTFIT)}`;
  const LX = lineaNormal(fX, listo);
  const LN = lineaDe(fN, 168, 1, listo);
  // el letter-spacing -0.05em está en el contenedor, que no tiene font-size propio: el navegador lo resuelve con la letra
  // de base (16 px) y los dos <span> heredan -0,8 px (no -0,05 × 96 ni × 168)
  const LS = -0.05 * 16;
  const g0 = medidor(); g0.font = fX;
  const anX = g0.measureText('×').width + LS;
  g0.font = fN;
  const celda = g0.measureText(String(veces)).width + LS;
  const baseGrupo = Math.max(LX.asc, LN.base);
  const altoGrupo = baseGrupo + Math.max(LX.desc, 168 - LN.base);
  const anGrupo = anX + 4 + celda;
  const brilloN = (g: CanvasRenderingContext2D) => { const m = g.getTransform(); g.shadowColor = pal.a(0.4); g.shadowBlur = 56 * (Math.hypot(m.a, m.b) || 1); };

  const figuras: Nodo[] = Array.from({length: veces}).map((_, i) => {
    const k = sp(t, tc + i * 0.28, {damping: 12, stiffness: 150, mass: 0.85});
    const ultimo = i === veces - 1;
    const alto = an * 1.12;
    return {id: 'f' + i, x: PAD + i * (an + 24), y: 286, w: an, h: alto, m: 50, tr: [['t', 0, (1 - k) * 34], ['s', 0.7 + 0.3 * k]], op: clamp(k * 1.8),
      firma: `${ultimo}|${an}|${pal.acento}`, pintar: (g) => {
        if (ultimo) caja(g, 0, 0, an, alto, 22, gradiente(g, 0, 0, an, alto, 170, [[0, pal.claro], [1, pal.acento]]),
          [{y: 14, blur: 34, spread: -12, color: pal.a(0.85)}, {y: 2, color: 'rgba(255,255,255,.35)', inset: true}]);
        else caja(g, 0, 0, an, alto, 22, 'rgba(244,236,231,.13)', [{spread: 1.5, color: 'rgba(244,236,231,.18)', inset: true}]);
      }};
  });

  const contenido = (ts: number): (Nodo | null)[] => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD, y: 34, pal, listo}),
    // el número, enorme (con el brillo de 56 px y el latido, desde el borde izquierdo)
    {id: 'num', x: PAD, y: 92, w: anGrupo, h: altoGrupo, m: 130, tr: [['s', 1 + 0.05 * latido]], origen: [0, altoGrupo / 2],
      firma: `${Math.round(num * 1000)}|${Math.round(vel * 200)}|${veces}|${pal.acento}|${listo}`, pintar: (g) => {
        g.save(); g.globalAlpha = 0.55; brilloN(g);
        escribir(g, '×', 0, baseGrupo, fX, 0, pal.acento);
        g.restore();
        const top = baseGrupo - LN.base;
        pintarTambor(g, {pos: num, x: anX + 4, top, cw: celda, tam: 168, fuente: fN, ls: LS, linea: lineaDe(fN, 168, 1.2, listo).base, color: pal.acento,
          borroso: Math.min(7, Math.abs(vel) * 5) > 0.4 ? Math.round(Math.min(7, Math.abs(vel) * 5) * 2) / 2 : 0, alto: 168,
          sombra: (gg, k) => { gg.shadowColor = pal.a(0.4); gg.shadowBlur = 56 * k; }, listo});
      }},
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.4, paso: 0.8 / 30, subir: 38, fuente: fTit, tam: tamTit, lh: 1.06,
      ls: -0.03 * tamTit, color: pal.tinta, x: PAD + 300, y: 126, anchoMax: ANCHO - PAD - (PAD + 300), listo}).nodos,
    ...figuras,
    d.pie ? {id: 'pie', x: PAD, y: 286 + Math.round(an * 1.12) + 30, w: ANCHO - PAD * 2, h: 120, op: clamp(sp(t, llega + 0.2, RESORTES.carta) * 1.5),
      firma: `${d.pie}|${listo}`, pintar: (g) => bloque(g, {texto: String(d.pie), x: 0, y: 0, ancho: ANCHO - PAD * 2, fuente: `700 32px ${comillas(OUTFIT)}`, tam: 32,
        lh: lineaNormal(`700 32px ${comillas(OUTFIT)}`, listo).alto / 32, ls: -0.01 * 32, color: pal.tinta2, listo})} : null,
    chispasNodo({id: 'chispas', t: ts, t0: llega, x: PAD + (an + 24) * (veces - 0.5), y: 286 + an * 0.56, n: 18, semilla: 'mult', fuerza: 700, pal}),
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h: ALTO, entra: ENTRA, sale: SALE, semilla: 'mult', brillos: [llega + 0.35],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, ALTO, 54, tj.placaOp, 'mult', Dh);
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

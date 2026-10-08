// Antes y después EN LIENZO (8-oct-2026): el mismo de Comparacion.tsx con el motor de nodos (lib/escena.tsx).
import React, {useMemo} from 'react';
import {getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {tamPara} from '../lib/Piezas';
import {anchoTexto, brilloNodo, caja, chispasNodo, cifraNodo, comillas, escribir, escribirMaquina, estadoMaquina, gradiente, lineaNormal, medidor, redondeado4,
  trazar} from '../lib/tarjetaEscena';
import {usePresenciaGrupo} from '../lib/Fondo';
import {elipse} from '../lib/lienzo';

const ANCHO_BARRA = 214;
const CXS = [322, 758];
const LETRAS: Letra[] = [[OUTFIT, '900'], [MONO, '500']];

export const ComparacionGL: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const listo = useLetras(LETRAS);
  const d = p.datos;
  const [ta, tb] = p.marcas;
  const {op, dy, sale} = usePresenciaGrupo();
  const BASE = Math.round(Hd * 0.552), ALTO_MAX = Math.round(Hd * 0.26);
  const max = Math.max(d.a.valor, d.b.valor) || 1;
  const altos = [ALTO_MAX * Math.max(0.06, d.a.valor / max), ALTO_MAX * Math.max(0.06, d.b.valor / max)];
  const p1 = sp(t, ta, {damping: 12, stiffness: 115, mass: 1});
  const p2 = sp(t, tb, {damping: 10, stiffness: 78, mass: 1.1});
  const aparece = sp(t, p.t0 + 0.35, RESORTES.suave);
  const x0 = CXS[0] + 120, y0 = BASE - altos[0] - 30, x1 = CXS[1] - 130, y1 = BASE - altos[1] + 40;
  const FLECHA = `M ${x0} ${y0} C ${x0 + 30} ${y0 - 170}, ${x1 - 90} ${y1 + 40}, ${x1} ${y1}`;
  const largo = useMemo(() => getLength(FLECHA), [FLECHA]);
  const flechaP = useMemo(() => new Path2D(FLECHA), [FLECHA]);
  const tf = tb + 0.47, tx = tb + 0.8;
  const pf = d.insignia ? rampa(t, tf, tf + 0.47, EASE.llega) : 0;
  const fin = getPointAtLength(FLECHA, largo * Math.max(0.001, pf)) ?? {x: 0, y: 0};
  const tan = getTangentAtLength(FLECHA, largo * Math.max(0.001, pf)) ?? {x: 1, y: 0};
  const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
  const medio = getPointAtLength(FLECHA, largo * 0.5) ?? {x: 540, y: BASE - ALTO_MAX};
  const xk = sp(t, tx, RESORTES.pop);
  const textos = [d.a, d.b].map((c: any) => (d.prefijo || '') + GRAF.cifra(c.valor, d.decimales) + (d.sufijo || ''));
  const tamValor = Math.min(tamPara(textos[0], 400, 88, 0.62), tamPara(textos[1], 400, 88, 0.62));
  if (op <= 0.001) return null;

  const fE = `500 28px ${comillas(MONO)}`;
  const LE = lineaNormal(fE, listo);
  const etiqueta = String(d.etiqueta || '').toUpperCase();
  const anE = anchoTexto(etiqueta, fE, 0.16 * 28);
  const lineas = [0, 0.25, 0.5, 0.75, 1].map((u, i) => rampa(t, p.t0 + 0.27 + i * 0.1, p.t0 + 0.87 + i * 0.1, EASE.llega));
  const fV = `900 ${tamValor}px ${comillas(OUTFIT)}`;

  const barra = (i: number, k: number): (Nodo | null)[] => {
    const h = Math.max(0, altos[i] * k);
    const color = i === 1;
    const cx = CXS[i];
    return [
      color ? {id: 'halo', x: cx - 220, y: BASE - 60, w: 440, h: 120, op: clamp(k), firma: pal.acento, pintar: (g) =>
        elipse(g, 0, 0, 440, 120, 220, 60, 220, 60, [[0, pal.a(0.45)], [1, pal.a(0)]])} : null,
      h > 0 ? {id: 'barra' + i, x: cx - ANCHO_BARRA / 2, y: BASE - h, w: ANCHO_BARRA, h, m: 90, firma: `${Math.round(h * 10)}|${Math.round(clamp(k) * 100)}|${pal.acento}`, pintar: (g) => {
        const forma = () => redondeado4(g, 0, 0, ANCHO_BARRA, h, [34, 34, 10, 10]);
        const kk = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
        if (color) {
          g.save(); forma(); g.rect(-400, -400, ANCHO_BARRA + 800, h + 800); g.clip('evenodd');
          g.shadowColor = pal.a(0.45); g.shadowBlur = 70 * clamp(k) * kk; g.shadowOffsetX = 20000 * kk;
          g.translate(-20000, 0); forma(); g.fillStyle = '#000'; g.fill(); g.restore();
        }
        forma();
        g.fillStyle = color ? gradiente(g, 0, 0, ANCHO_BARRA, h, 180, [[0, pal.claro], [0.38, pal.acento], [1, pal.hondo]])
          : gradiente(g, 0, 0, ANCHO_BARRA, h, 180, [[0, 'rgba(244,236,231,.46)'], [1, 'rgba(244,236,231,.2)']]);
        g.fill();
        g.save(); forma(); g.clip();
        const franja = (y: number, c: string) => { const q = new Path2D(); q.rect(-50, -50, ANCHO_BARRA + 100, h + 100);
          const r2 = new Path2D(); r2.moveTo(34, y); r2.arcTo(ANCHO_BARRA, y, ANCHO_BARRA, y + h, 34); r2.arcTo(ANCHO_BARRA, y + h, 0, y + h, 10); r2.arcTo(0, y + h, 0, y, 10); r2.arcTo(0, y, ANCHO_BARRA, y, 34); r2.closePath();
          q.addPath(r2); g.fillStyle = c; g.fill(q, 'evenodd'); };
        if (color) franja(2, 'rgba(255,255,255,.4)');
        else { franja(2, 'rgba(255,255,255,.3)'); caja(g, 0, 0, ANCHO_BARRA, h, 0, null, [{spread: 1.5, color: 'rgba(255,255,255,.1)', inset: true}]); }
        // el reflejo vertical
        g.globalAlpha = color ? 0.9 : 0.5;
        caja(g, 16, 10, 26, Math.max(0, h - 10), 20, gradiente(g, 16, 10, 26, Math.max(1, h - 10), 90, [[0, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']]));
        g.restore();
      }, hijos: color ? [brilloNodo('brilloB', t, tx + 0.33, ANCHO_BARRA, Math.max(h, 1), 10, 0.8, 1.6)] : []} as Nodo : null,
      k > 0.001 ? cifraNodo({id: 'v' + i, texto: textos[i], t, t0: i === 0 ? ta : tb, dur: 0.9, fuente: fV, tam: tamValor, ls: -0.04 * tamValor,
        color: color ? pal.acento : pal.tinta, x: cx - 220, y: BASE - altos[i] * k - tamValor * 1.34, w: 440, alinear: 'center', lh: 1.2,
        sombra: color ? {blur: 30, color: pal.a(0.35)} : {y: 8, blur: 24, color: 'rgba(0,0,0,.4)'}, op: clamp(k * 3), listo}) : null,
    ];
  };

  // la insignia (×4): chip con degradado, entra girando; su barrido de luz
  const fI = `900 66px ${comillas(OUTFIT)}`;
  const g0 = medidor(); g0.font = fI;
  const anI = d.insignia ? g0.measureText(String(d.insignia)).width + 68 : 0;
  const LI = lineaDe1(fI, 66, listo);
  const insignia: Nodo | null = d.insignia && xk > 0.001 ? {id: 'ins', x: medio.x - anI / 2, y: medio.y - 56, w: anI, h: 66 + 34, m: 60,
    tr: [['s', xk], ['rz', (1 - xk) * -16]], op: clamp(xk * 2), firma: `${d.insignia}|${Math.round(clamp(xk) * 100)}|${pal.acento}|${listo}`, pintar: (g) => {
      caja(g, 0, 0, anI, 100, 99, gradiente(g, 0, 0, anI, 100, 180, [[0, pal.claro], [1, pal.acento]]),
        [{y: 14, blur: 40, spread: -10, color: pal.a(0.8 * clamp(xk))}, {y: 2, color: 'rgba(255,255,255,.4)', inset: true}]);
      escribir(g, String(d.insignia), 34, 16 + LI.base, fI, 0, pal.sobre);
    }, hijos: [brilloNodo('brilloI', t, tx + 0.4, 200, 100, 99, 0.67, 2.2, 100, anI)]} : null;

  const grupo: Nodo = {id: 'grupo', x: 0, y: 0, w: 1080, h: Hd, op, tr: [['t', 0, dy]], blur: sale > 0.02 ? sale * 12 : 0, hijos: [
    {id: 'etq', x: (1080 - anE) / 2, y: BASE - ALTO_MAX - 190, w: anE + 30, h: LE.alto, m: 6, firma: `${etiqueta}|${estadoMaquina(etiqueta, t, p.t0 + 0.4, 1.2)}|${pal.acento}|${listo}`,
      pintar: (g) => escribirMaquina(g, {texto: etiqueta, t, t0: p.t0 + 0.4, velocidad: 1.2, x: 0, base: LE.asc, fuente: fE, tam: 28, ls: 0.16 * 28, color: pal.tinta2, acento: pal.acento})},
    {id: 'rejilla', x: 0, y: 0, w: 1080, h: Hd, firma: lineas.map((v) => Math.round(v * 1000)).join(','), pintar: (g) => {
      lineas.forEach((v, i) => {
        if (v <= 0) return;
        const y = BASE - [0, 0.25, 0.5, 0.75, 1][i] * ALTO_MAX;
        g.strokeStyle = i === 0 ? 'rgba(244,236,231,.2)' : 'rgba(244,236,231,.07)'; g.lineWidth = i === 0 ? 3 : 2; g.lineCap = 'round';
        trazar(g, [['l', 150, y, 930, y]], v);
      });
    }},
    ...CXS.map((cx, i) => ({id: 'col' + i, x: cx - ANCHO_BARRA / 2, y: BASE - ALTO_MAX, w: ANCHO_BARRA, h: ALTO_MAX, tr: [['s2', 1, 0.6 + 0.4 * aparece]] as any,
      origen: [ANCHO_BARRA / 2, ALTO_MAX] as [number, number], op: aparece, firma: 'c', pintar: (g: CanvasRenderingContext2D) => {
        redondeado4(g, 0, 0, ANCHO_BARRA, ALTO_MAX, [34, 34, 10, 10]);
        g.fillStyle = gradiente(g, 0, 0, ANCHO_BARRA, ALTO_MAX, 180, [[0, 'rgba(255,255,255,.05)'], [1, 'rgba(255,255,255,.02)']]); g.fill();
        g.save(); redondeado4(g, 0, 0, ANCHO_BARRA, ALTO_MAX, [34, 34, 10, 10]); g.clip();
        const q = new Path2D(); q.rect(-50, -50, ANCHO_BARRA + 100, ALTO_MAX + 100);
        const r2 = new Path2D(); const s = 1.5; r2.moveTo(34, s); r2.arcTo(ANCHO_BARRA - s, s, ANCHO_BARRA - s, ALTO_MAX - s, 32.5); r2.arcTo(ANCHO_BARRA - s, ALTO_MAX - s, s, ALTO_MAX - s, 8.5);
        r2.arcTo(s, ALTO_MAX - s, s, s, 8.5); r2.arcTo(s, s, ANCHO_BARRA - s, s, 32.5); r2.closePath(); q.addPath(r2);
        g.fillStyle = 'rgba(255,255,255,.05)'; g.fill(q, 'evenodd'); g.restore();
      }} as Nodo)),
    ...barra(0, p1),
    ...barra(1, p2),
    ...[d.a.texto, d.b.texto].map((tx0: string, i: number) => {
      const txt = String(tx0).toUpperCase();
      const an = anchoTexto(txt, fE, 0.16 * 28);
      return {id: 'nom' + i, x: CXS[i] - an / 2, y: BASE + 22, w: an, h: LE.alto, op: sp(t, i === 0 ? ta - 0.2 : tb - 0.4, RESORTES.suave),
        firma: `${txt}|${i}|${listo}`, pintar: (g: CanvasRenderingContext2D) => escribir(g, txt, 0, LE.asc, fE, 0.16 * 28, i === 1 ? pal.tinta : pal.tinta2)} as Nodo;
    }),
    pf > 0 ? {id: 'flecha', x: 0, y: 0, w: 1080, h: Hd, m: 10, firma: `${Math.round(pf * 1000)}`, pintar: (g) => {
      g.strokeStyle = 'rgba(244,236,231,.6)'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
      if (pf < 1) g.setLineDash([largo * pf, largo * 2]);
      g.stroke(flechaP); g.setLineDash([]);
      if (pf > 0.85) {
        g.save(); g.translate(fin.x, fin.y); g.rotate((ang * Math.PI) / 180); const s = clamp((pf - 0.85) / 0.15); g.scale(s, s);
        g.lineWidth = 5; g.beginPath(); g.moveTo(-22, -13); g.lineTo(0, 0); g.lineTo(-22, 13); g.stroke(); g.restore();
      }
    }} : null,
    insignia,
  ]};
  const nodos: (Nodo | null)[] = [grupo, d.insignia ? chispasNodo({id: 'chispas', t, t0: tx + 0.03, x: medio.x, y: medio.y, n: 24, semilla: 'x5', fuerza: 950, pal}) : null];
  return <Escena nodos={nodos} Dh={Hd} letras={LETRAS} />;
};
const lineaDe1 = (f: string, tam: number, listo: boolean) => {
  const L = lineaNormal(f, listo);
  return {base: (tam - L.alto) / 2 + L.asc};
};

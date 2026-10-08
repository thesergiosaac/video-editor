// El rango EN LIENZO (8-oct-2026): el mismo de Rango.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {bloque, chispasNodo, cifraNodo, comillas, etiquetaNodo, letrasNodos, lineaNormal, sinVidrioCss, tarjetaNodos, vidrioTarjeta} from '../lib/tarjetaEscena';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 432, PAD = 56;
const REGLA = ANCHO - PAD * 2;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const RangoGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const tA = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const tB = p.marcas[1] != null ? p.marcas[1] : tA + 1.1;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const kA = sp(t, tA, {damping: 15, stiffness: 100, mass: 0.95});
  const kB = sp(t, tB, {damping: 14, stiffness: 95, mass: 0.95});
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const prefijo = d.prefijo != null ? String(d.prefijo) : '';
  const marcas = rampa(t, ENTRA + 0.35, ENTRA + 1.1, EASE.llega);
  const xA = PAD + REGLA * 0.12;
  const xB = PAD + REGLA * 0.88;
  const abierto = xA + (xB - xA) * clamp(kB);
  const tamTit = String(d.titulo || '').length > 24 ? 48 : 58;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const larga = sufijo.trim().length > 2;
  const fSuf = `800 28px ${comillas(OUTFIT)}`;
  const LSuf = lineaNormal(fSuf, listo);

  // las dos cifras (el grupo de cada una lo movía la plantilla: en t; la Cifra de adentro lleva su reloj: en ts)
  const cifras = (ts: number): Nodo[] => [[xA, d.desde, kA, false], [abierto, d.hasta, kB, true]].map(([x, v, k, fuerte]: any, i) => {
    const cifra = `${prefijo}${v != null ? v : ''}${larga ? '' : sufijo}`;
    const tam = Math.min(fuerte ? 82 : 70, 290 / Math.max(1, cifra.length * 0.58));
    const fC = `900 ${tam}px ${comillas(OUTFIT)}`;
    const color = fuerte ? pal.acento : pal.tinta2;
    return {id: 'c' + i, x: Number(x) - 150, y: larga ? 168 : 190, w: 300, h: tam + (larga ? 6 + LSuf.alto : 0), tr: [['t', 0, (1 - Number(k)) * 22]], op: clamp(Number(k) * 1.6),
      hijos: [
        cifraNodo({id: 'cn' + i, texto: cifra, t: ts, t0: i === 0 ? tA : tB, dur: 0.8, fuente: fC, tam, ls: -0.04 * tam, color, x: 0, y: 0, w: 300, alinear: 'center', lh: 1,
          tabular: true, sombra: fuerte ? {blur: 34, color: pal.a(0.45)} : undefined, listo}),
        larga ? {id: 'cs' + i, x: 0, y: tam + 6, w: 300, h: LSuf.alto, op: 0.9, firma: `${sufijo}|${color}|${listo}`, pintar: (g) =>
          bloque(g, {texto: sufijo.trim(), x: 0, y: 0, ancho: 300, fuente: fSuf, tam: 28, lh: LSuf.alto / 28, ls: 0.01 * 28, color, alinear: 'center', partir: false, listo})} : null,
      ]} as Nodo;
  });

  const regla: Nodo = {id: 'regla', x: 0, y: 300, w: ANCHO, h: 60, m: 40,
    firma: `${Math.round(marcas * 2000)}|${Math.round(abierto * 10)}|${Math.round(kA * 1000)}|${Math.round(kB * 1000)}|${pal.acento}`, pintar: (g) => {
      g.lineCap = 'round';
      for (let i = 0; i < 21; i++) {
        const x = PAD + (REGLA * i) / 20;
        const alta = i % 5 === 0;
        const on = x <= abierto + 1 && x >= xA - 1;
        const op = clamp(marcas * 21 - i);
        if (op <= 0) continue;
        g.globalAlpha = op;
        g.strokeStyle = on ? pal.a(0.85) : 'rgba(244,236,231,.20)'; g.lineWidth = alta ? 4 : 2.5;
        g.beginPath(); g.moveTo(x, alta ? 6 : 14); g.lineTo(x, alta ? 34 : 28); g.stroke();
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(244,236,231,.14)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(PAD, 20); g.lineTo(PAD + REGLA, 20); g.stroke();
      if (clamp(kA) > 0) {
        const m = g.getTransform(), k = Math.hypot(m.a, m.b) || 1;
        g.save();
        g.globalAlpha = clamp(kA);
        g.filter = `drop-shadow(0 0 ${(14 * k).toFixed(2)}px ${pal.a(0.7)})`;
        g.strokeStyle = pal.acento; g.lineWidth = 7;
        g.beginPath(); g.moveTo(xA, 20); g.lineTo(abierto, 20); g.stroke();
        g.restore();
      }
      [[xA, kA, false], [abierto, kB, true]].forEach(([x, k, fuerte]: any) => {
        const op = clamp(Number(k) * 1.5);
        if (op <= 0) return;
        g.globalAlpha = op;
        g.fillStyle = pal.tinta; g.beginPath(); g.arc(x, 20, fuerte ? 19 : 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = pal.acento; g.beginPath(); g.arc(x, 20, fuerte ? 9 : 7, 0, Math.PI * 2); g.fill();
      });
      g.globalAlpha = 1;
    }};

  const fPie = `500 24px ${comillas(MONO)}`;
  const contenido = (ts: number): (Nodo | null)[] => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD - 10, y: 34, pal, listo}),
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.35, paso: 0.8 / 30, subir: 38, fuente: fTit, tam: tamTit, lh: 1.05,
      ls: -0.03 * tamTit, color: pal.tinta, x: PAD - 10, y: 86, listo}).nodos,
    ...cifras(ts),
    regla,
    d.pie ? {id: 'pie', x: PAD - 10, y: 366, w: ANCHO - 2 * (PAD - 10), h: 60, op: clamp(sp(t, tB + 0.45, RESORTES.carta) * 1.4), firma: `${d.pie}|${listo}`, pintar: (g) =>
      bloque(g, {texto: String(d.pie).toUpperCase(), x: 0, y: 0, ancho: ANCHO - 2 * (PAD - 10), fuente: fPie, tam: 24, lh: lineaNormal(fPie, listo).alto / 24,
        ls: 0.18 * 24, color: pal.tinta3, alinear: 'center', listo})} : null,
    chispasNodo({id: 'chispas', t: ts, t0: tB + 0.35, x: abierto, y: 320, n: 16, semilla: 'rango', fuerza: 620, pal}),
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h: ALTO, entra: ENTRA, sale: SALE, semilla: 'rango', brillos: [tB + 0.5],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, ALTO, 54, tj.placaOp, 'rango', Dh);
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

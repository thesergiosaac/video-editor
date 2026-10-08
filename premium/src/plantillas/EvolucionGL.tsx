// La evolución EN LIENZO (8-oct-2026): la misma de Evolucion.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {clamp, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {bloque, caja, chispasNodo, cifraNodo, comillas, etiquetaNodo, gradiente, letrasNodos, lineaNormal, redondeado4, sinVidrioCss, tarjetaNodos,
  vidrioTarjeta} from '../lib/tarjetaEscena';
import {bordeInterior, sombra} from '../lib/lienzo';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 508, PAD = 50;
const BASE = 424, MAX_ALTO = 238;
const LETRAS: Letra[] = [[OUTFIT, '900'], [MONO, '500']];

export const EvolucionGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const items: [string, number][] = (d.items || []).slice(0, 7);
  const n = items.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.6 + i * 0.4);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const max = Math.max(...items.map(([, v]) => v), 1);
  const hueco = 20;
  const an = n ? Math.floor((ANCHO - PAD * 2 - hueco * (n - 1)) / n) : 0;
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const ultimo = n - 1;
  const tamTit = String(d.titulo || '').length > 24 ? 48 : 58;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const fEt = `500 21px ${comillas(MONO)}`;
  const LEt = lineaNormal(fEt, listo);

  const columnas = (ts: number): Nodo[] => {
    const out: Nodo[] = [];
    items.forEach(([nombre, valor], i) => {
      const ti = cuando(i);
      const k = sp(t, ti, {damping: 14, stiffness: 115, mass: 0.9});
      const alto = MAX_ALTO * (0.16 + 0.84 * (valor / max)) * clamp(k);
      const x = PAD + i * (an + hueco);
      const es = i === ultimo;
      const hb = Math.max(3, alto);
      out.push({id: 'b' + i, x, y: BASE - alto, w: an, h: hb, m: 50, op: clamp(k * 2), firma: `${Math.round(hb * 20)}|${es}|${pal.acento}`, pintar: (g) => {
        const forma = () => redondeado4(g, 0, 0, an, hb, [14, 14, 5, 5]);
        if (es) {
          // 0 0 34px a(.5): la sombra por fuera de la barra
          g.save();
          const fuera = new Path2D(); fuera.rect(-200, -200, an + 400, hb + 400);
          const p2 = new Path2D(); p2.addPath(fuera);
          g.restore();
          g.save();
          forma(); g.rect(-400, -400, an + 800, hb + 800); g.clip('evenodd');
          g.shadowColor = pal.a(0.5); g.shadowBlur = 34 * escala(g); g.shadowOffsetX = 20000 * escala(g);
          g.translate(-20000, 0); forma(); g.fillStyle = '#000'; g.fill();
          g.restore();
          forma(); g.fillStyle = gradiente(g, 0, 0, an, hb, 180, [[0, pal.claro], [1, pal.acento]]); g.fill();
          g.save(); forma(); g.clip(); interior(g, an, hb, 2, 'rgba(255,255,255,.4)'); g.restore();
        } else {
          forma(); g.fillStyle = 'rgba(244,236,231,.20)'; g.fill();
          g.save(); forma(); g.clip(); interior(g, an, hb, 1.5, 'rgba(255,255,255,.14)'); g.restore();
        }
      }});
      const fVal = `900 ${es ? 38 : 30}px ${comillas(OUTFIT)}`, tamV = es ? 38 : 30;
      const LV = lineaNormal(fVal, listo);
      out.push(cifraNodo({id: 'v' + i, texto: `${Math.round(valor)}${sufijo}`, t: ts, t0: ti, dur: 0.6, fuente: fVal, tam: tamV, ls: -0.02 * tamV,
        color: es ? pal.acento : pal.tinta2, x: x - 12, y: BASE - alto - 48, w: an + 24, alinear: 'center', lh: LV.alto / tamV, tabular: true,
        sombra: es ? {blur: 24, color: pal.a(0.5)} : undefined, op: clamp(k * 2.4), listo}));
      out.push({id: 'e' + i, x: x - 10, y: BASE + 16, w: an + 20, h: LEt.alto * 2, op: clamp(k * 1.6), firma: `${nombre}|${es}|${listo}`, pintar: (g) =>
        bloque(g, {texto: String(nombre).toUpperCase(), x: 0, y: 0, ancho: an + 20, fuente: fEt, tam: 21, lh: LEt.alto / 21, ls: 0.1 * 21,
          color: es ? pal.tinta2 : pal.tinta3, alinear: 'center', listo})});
    });
    return out;
  };

  const contenido = (ts: number) => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD, y: 34, pal, listo}),
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.35, paso: 0.8 / 30, subir: 38, fuente: fTit, tam: tamTit, lh: 1.05,
      ls: -0.03 * tamTit, color: pal.tinta, x: PAD, y: 86, listo}).nodos,
    {id: 'suelo', x: PAD, y: BASE, w: ANCHO - PAD * 2, h: 2, firma: 's', pintar: (g) => { g.fillStyle = 'rgba(244,236,231,.16)'; g.fillRect(0, 0, ANCHO - PAD * 2, 2); }} as Nodo,
    ...columnas(ts),
    n ? chispasNodo({id: 'chispas', t: ts, t0: cuando(ultimo) + 0.3, x: PAD + ultimo * (an + hueco) + an / 2, y: BASE - MAX_ALTO * 0.9, n: 18, semilla: 'evol', fuerza: 680, pal}) : null,
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h: ALTO, entra: ENTRA, sale: SALE, semilla: 'evol', brillos: [cuando(ultimo) + 0.5],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, ALTO, 54, tj.placaOp, 'evol', Dh);
  void caja; void sombra; void bordeInterior;
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};
const escala = (g: CanvasRenderingContext2D) => { const m = g.getTransform(); return Math.hypot(m.a, m.b) || 1; };
/* inset 0 Ypx 0 color: la franja de arriba (la forma menos la misma corrida y px hacia abajo), ya recortada a la forma */
const interior = (g: CanvasRenderingContext2D, an: number, hb: number, y: number, color: string) => {
  const p = new Path2D();
  p.rect(-50, -50, an + 100, hb + 100);
  const q = new Path2D();
  const r = [14, 14, 5, 5];
  const m = Math.min(an / 2, hb / 2);
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, m)));
  q.moveTo(a, y); q.arcTo(an, y, an, y + hb, b); q.arcTo(an, y + hb, 0, y + hb, c); q.arcTo(0, y + hb, 0, y, d); q.arcTo(0, y, an, y, a); q.closePath();
  p.addPath(q);
  g.fillStyle = color; g.fill(p, 'evenodd');
};

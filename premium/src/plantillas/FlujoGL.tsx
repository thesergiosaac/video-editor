// El flujo EN LIENZO (8-oct-2026): el mismo de Flujo.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {bloque, caja, chispasNodo, comillas, escribir, etiquetaNodo, gradiente, letrasNodos, lineaNormal, medidor, sinVidrioCss, tarjetaNodos, trazar,
  vidrioTarjeta} from '../lib/tarjetaEscena';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 46;
const CAJA = 108, HUECO = 52, CAB = 150;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const FlujoGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc, inicio, fps} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const pasos: string[] = (d.pasos || d.items || []).slice(0, 4);
  const n = pasos.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 1.2);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const h = CAB + n * CAJA + (n - 1) * HUECO + PAD;
  const tamTit = String(d.titulo || '').length > 24 ? 46 : 56;
  const fTit = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const fNum = `500 24px ${comillas(MONO)}`;
  const LNum = lineaNormal(fNum, listo);
  const AN = ANCHO - PAD * 2;

  const nodosPasos: Nodo[] = [];
  pasos.forEach((txt, i) => {
    const ti = cuando(i);
    const k = sp(t, ti, {damping: 14, stiffness: 115, mass: 0.9});
    const y = CAB + i * (CAJA + HUECO);
    const ultimo = i === n - 1;
    const flecha = rampa(t, ti + 0.35, ti + 0.75, EASE.llega);
    const tam = txt.length > 26 ? 36 : 42;
    const fTxt = `800 ${tam}px ${comillas(OUTFIT)}`;
    const LT = lineaNormal(fTxt, listo);
    nodosPasos.push({id: 'paso' + i, x: PAD, y, w: AN, h: CAJA, m: 4, tr: [['t', 0, (1 - k) * 26], ['s', 0.96 + 0.04 * k]], op: clamp(k * 1.7),
      firma: `${txt}|${ultimo}|${pal.acento}|${listo}`, pintar: (g) => {
        caja(g, 0, 0, AN, CAJA, 26, ultimo ? gradiente(g, 0, 0, AN, CAJA, 120, [[0, pal.a(0.22)], [1, 'rgba(16,11,14,.5)']]) : 'rgba(255,255,255,.055)',
          [ultimo ? {spread: 1.5, color: pal.a(0.5), inset: true} : {spread: 1, color: 'rgba(255,255,255,.08)', inset: true}]);
        g.save();
        g.beginPath(); g.rect(0, 0, AN, CAJA); g.clip();
        // el número en su círculo
        caja(g, 26, 28, 52, 52, 99, ultimo ? pal.acento : 'rgba(255,255,255,.10)');
        const g0 = medidor(); g0.font = fNum;
        escribir(g, String(i + 1), 26 + (52 - g0.measureText(String(i + 1)).width) / 2, 28 + (52 - LNum.alto) / 2 + LNum.asc, fNum, 0, ultimo ? pal.sobre : pal.tinta2);
        bloque(g, {texto: txt, x: 100, y: (CAJA - LT.alto) / 2, ancho: AN - 26 * 2 - 52 - 22, fuente: fTxt, tam, lh: LT.alto / tam, ls: -0.02 * tam, color: pal.tinta,
          partir: false, puntos: true, listo});
        g.restore();
      }});
    if (i < n - 1 && flecha > 0) {
      nodosPasos.push({id: 'flecha' + i, x: 0, y: y + CAJA, w: ANCHO, h: HUECO, m: 6, firma: `${Math.round(flecha * 1000)}|${pal.acento}`, pintar: (g) => {
        g.strokeStyle = pal.a(0.75); g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
        trazar(g, [['l', ANCHO / 2, 6, ANCHO / 2, HUECO - 16]], flecha);
        if (flecha > 0.85) {
          g.beginPath(); g.moveTo(ANCHO / 2 - 9, HUECO - 24); g.lineTo(ANCHO / 2, HUECO - 12); g.lineTo(ANCHO / 2 + 9, HUECO - 24); g.stroke();
        }
      }});
    }
  });

  const contenido = (ts: number): (Nodo | null)[] => [
    etiquetaNodo({id: 'etq', texto: String(d.etiqueta || ''), t: ts, t0: ENTRA + 0.2, x: PAD, y: 32, pal, listo}),
    ...letrasNodos({id: 'tit', texto: String(d.titulo || ''), t: ts, t0: ENTRA + 0.35, paso: 0.8 / 30, subir: 38, fuente: fTit, tam: tamTit, lh: 1.05,
      ls: -0.03 * tamTit, color: pal.tinta, x: PAD, y: 80, listo}).nodos,
    ...nodosPasos,
    n ? chispasNodo({id: 'chispas', t: ts, t0: cuando(n - 1) + 0.4, x: ANCHO / 2, y: CAB + (n - 1) * (CAJA + HUECO) + CAJA / 2, n: 18, semilla: 'flujo', fuerza: 640, pal}) : null,
  ];
  const tj = tarjetaNodos({t, inicio, fps, pal, x: X0, y: Y0, w: ANCHO, h, entra: ENTRA, sale: SALE, semilla: 'flujo', brillos: [cuando(n - 1) + 0.5],
    contenido, Dh, vidrioCss: sinVidrioCss(G)});
  if (tj.visible) vidrioTarjeta(G as any, t, tj.pose, X0, Y0, ANCHO, h, 54, tj.placaOp, 'flujo', Dh);
  return <Escena nodos={tj.nodos} Dh={Dh} letras={LETRAS} />;
};

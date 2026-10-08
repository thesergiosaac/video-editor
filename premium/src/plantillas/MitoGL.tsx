// Mito / realidad EN LIENZO (8-oct-2026): el mismo de Mito.tsx con el motor de nodos (lib/escena.tsx). No lleva la tarjeta
// de vidrio: dos cajas que se inclinan en X con la perspective 1500 del contenedor.
import React from 'react';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {anchoTexto, bloque, brilloNodo, caja, chispasNodo, comillas, escribir, gradiente, lineaDe, lineaNormal, partirTexto, trazar} from '../lib/tarjetaEscena';

const X = 78, AN = 924, ALTO = 236, TOP = 190;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const MitoGL: React.FC = () => {
  const t = useT();
  const G = useG();
  const {p, pal, W, H, esc} = G;
  const d = p.datos || {};
  const listo = useLetras(LETRAS);
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;
  const tMito = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const tReal = p.marcas[1] != null ? p.marcas[1] : tMito + 1.4;
  const salida = rampa(t, p.t1 - 0.75, p.t1 - 0.3, EASE.sale);
  const k1 = sp(t, tMito, {damping: 14, stiffness: 120, mass: 0.85});
  const k2 = sp(t, tReal, {damping: 13, stiffness: 115, mass: 0.9});
  const tacha = rampa(t, tMito + 0.55, tMito + 1.15, EASE.llega);
  const apaga = rampa(t, tReal - 0.1, tReal + 0.4) * 0.45;
  const cheque = rampa(t, tReal + 0.25, tReal + 0.7, EASE.llega);
  const mito = String(d.mito || ''), real = String(d.realidad || '');
  const tamM = mito.length > 30 ? 46 : 54;
  const tamR = real.length > 30 ? 50 : 60;
  const fEt = `500 24px ${comillas(MONO)}`;
  const LEt = lineaNormal(fEt, listo);
  const fM = `800 ${tamM}px ${comillas(OUTFIT)}`, fR = `900 ${tamR}px ${comillas(OUTFIT)}`;

  const cajaMito: Nodo = {id: 'mito', x: X, y: TOP, w: AN, h: ALTO, m: 110, tr: [['t', 0, (1 - k1) * 40], ['rx', (1 - k1) * 26], ['s', 0.94 + 0.06 * k1]],
    origen: [AN / 2, ALTO], op: clamp(k1 * 1.6) * (1 - apaga), firma: `${mito}|${Math.round(tacha * 1000)}|${listo}`, pintar: (g) => {
      caja(g, 0, 0, AN, ALTO, 30, gradiente(g, 0, 0, AN, ALTO, 150, [[0, 'rgba(46,34,40,.9)'], [1, 'rgba(14,10,12,.92)']]),
        [{y: 30, blur: 70, spread: -26, color: 'rgba(0,0,0,.95)'}, {spread: 1, color: 'rgba(255,255,255,.08)', inset: true}]);
      escribir(g, 'MITO', 34, 26 + LEt.asc, fEt, 0.2 * 24, 'rgba(244,236,231,.5)');
      // el texto (inline-block: tan ancho como su renglón más largo) y la raya que lo tacha a la mitad de su alto
      const ren = partirTexto(mito, fM, -0.02 * tamM, AN - 68);
      const L = lineaDe(fM, tamM, 1.08, listo);
      const ancho = Math.max(...ren.map((r) => anchoTexto(r, fM, -0.02 * tamM)), 0);
      bloque(g, {texto: mito, x: 34, y: 74, ancho: AN - 68, fuente: fM, tam: tamM, lh: 1.08, ls: -0.02 * tamM, color: 'rgba(244,236,231,.86)', listo});
      if (tacha > 0) {
        const x0 = 34 - 0.02 * tamM, wr = (ancho + 0.04 * tamM) * tacha;
        caja(g, x0, 74 + ren.length * L.alto * 0.52, wr, 7, 9, 'rgba(244,236,231,.88)');
      }
    }};
  const altoR = ALTO + 16;
  const cajaReal: Nodo = {id: 'real', x: X, y: TOP + ALTO + 34, w: AN, h: altoR, m: 120, tr: [['t', 0, (1 - k2) * 50], ['rx', (1 - k2) * -22], ['s', 0.94 + 0.06 * k2]],
    origen: [AN / 2, 0], op: clamp(k2 * 1.6), firma: `${pal.acento}`, pintar: (g) =>
      caja(g, 0, 0, AN, altoR, 30, gradiente(g, 0, 0, AN, altoR, 150, [[0, pal.a(0.22)], [1, 'rgba(14,10,12,.94)']]),
        [{y: 34, blur: 80, spread: -24, color: 'rgba(0,0,0,.95)'}, {spread: 1.5, color: pal.a(0.5), inset: true}]),
    hijos: [
      brilloNodo('brillo', t, tReal + 0.4, AN, ALTO, 30, 0.9, 1.2, altoR),
      {id: 'realTexto', x: 0, y: 0, w: AN, h: altoR, m: 10, firma: `${real}|${Math.round(cheque * 1000)}|${pal.acento}|${listo}`, pintar: (g) => {
        // ✓ REALIDAD (flex, align-items: center, gap 12) y el texto
        g.save();
        g.translate(34, 26);
        g.strokeStyle = pal.acento; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
        trazar(g, [['l', 14, 30, 26, 42], ['l', 26, 42, 48, 16]], cheque);
        g.restore();
        escribir(g, 'REALIDAD', 34 + 60 + 12, 26 + (52 - LEt.alto) / 2 + LEt.asc, fEt, 0.2 * 24, pal.acento);
        bloque(g, {texto: real, x: 34, y: 96, ancho: AN - 68, fuente: fR, tam: tamR, lh: 1.06, ls: -0.03 * tamR, color: pal.tinta, listo});
      }},
    ]};
  const nodos: Nodo[] = [{id: 'raiz', x: 0, y: 0, w: 1080, h: 1080, op: 1 - salida, persp: 1500, hijos: [
    cajaMito, cajaReal,
    chispasNodo({id: 'chispas', t, t0: tReal + 0.3, x: X + 70, y: TOP + ALTO + 70, n: 16, semilla: 'mito', fuerza: 640, pal}),
  ]}];
  return <Escena nodos={nodos} Dh={Dh} letras={LETRAS} />;
};

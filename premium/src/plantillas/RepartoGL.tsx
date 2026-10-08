// El reparto EN LIENZO (8-oct-2026): el mismo de Reparto.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {anchoTabular, anchoTexto, bloque, caja, cifraNodo, comillas, escribir, escribirMaquina, estadoMaquina, lineaNormal} from '../lib/tarjetaEscena';
import {usePresenciaGrupo} from '../lib/Fondo';

const CX = 300, R = 150, GRUESO = 52;
const TONOS = [1, 0.62, 0.38, 0.22];
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const RepartoGL: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const listo = useLetras(LETRAS);
  const d = p.datos || {};
  const items: [string, number][] = (d.items || []).slice(0, 4);
  const tm: number[] = p.marcas || [];
  const {op, dy, sale} = usePresenciaGrupo();
  const total = items.reduce((a, [, v]) => a + v, 0) || 100;
  const top = Math.round(Hd * 0.45);
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.6 + i * 1.1);
  if (op <= 0.001 || !items.length) return null;
  let acumulado = 0;
  const trozos = items.map(([nombre, valor], i) => {
    const desde = acumulado / total;
    acumulado += valor;
    return {nombre, valor, desde, hasta: acumulado / total, i};
  });
  const ks = trozos.map(({i}) => clamp(rampa(t, cuando(i), cuando(i) + 0.7, EASE.llega)));

  const fT = `500 26px ${comillas(MONO)}`;
  const LT = lineaNormal(fT, listo);
  const titulo = String(d.titulo || '').toUpperCase();
  const anillo: Nodo = {id: 'anillo', x: 30, y: 44, w: 600, h: 600, m: 60, firma: `${ks.map((v) => Math.round(v * 1000)).join(',')}|${pal.acento}`, pintar: (g) => {
    const k = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
    g.lineCap = 'butt'; g.lineWidth = GRUESO;
    g.strokeStyle = 'rgba(244,236,231,.08)'; g.beginPath(); g.arc(CX, CX, R, 0, Math.PI * 2); g.stroke();
    trozos.forEach(({desde, hasta, i}) => {
      const fin = desde + (hasta - desde) * ks[i];
      if (fin <= desde + 0.0005) return;
      g.save();
      if (i === 0) g.filter = `drop-shadow(0 0 ${(18 * k).toFixed(2)}px ${pal.a(0.5)})`;
      g.globalAlpha = TONOS[i % TONOS.length];
      g.strokeStyle = pal.acento;
      g.beginPath(); g.arc(CX, CX, R, -Math.PI / 2 + Math.PI * 2 * desde, -Math.PI / 2 + Math.PI * 2 * fin); g.stroke();
      g.restore();
    });
  }};
  // el trozo grande en el centro: la cifra (104 px, line-height 1) y su nombre debajo
  const fC = `900 104px ${comillas(OUTFIT)}`;
  const fN = `500 22px ${comillas(MONO)}`;
  const LN = lineaNormal(fN, listo);
  const nombre0 = String(items[0][0]).toUpperCase();
  const altoCentro = 104 + 6 + LN.alto;
  const yC = 44 + 300 - altoCentro / 2;
  const fNom = `800 34px ${comillas(OUTFIT)}`, fPc = `900 36px ${comillas(OUTFIT)}`;
  const LNom = lineaNormal(fNom, listo), LPc = lineaNormal(fPc, listo);
  const altoFila = Math.max(18, LNom.alto, LPc.alto);
  const tab = anchoTabular(fPc, listo);

  const grupo: Nodo = {id: 'grupo', x: 0, y: top, w: 1080, h: Math.round(Hd * 0.5), op, tr: [['t', 0, dy]], blur: sale > 0.02 ? sale * 10 : 0, hijos: [
    {id: 'tit', x: 78, y: -6, w: anchoTexto(titulo, fT, 0.2 * 26) + 30, h: LT.alto, m: 6, firma: `${titulo}|${estadoMaquina(titulo, t, p.t0 + 0.35, 1.4)}|${pal.acento}|${listo}`,
      pintar: (g) => escribirMaquina(g, {texto: titulo, t, t0: p.t0 + 0.35, velocidad: 1.4, x: 0, base: LT.asc, fuente: fT, tam: 26, ls: 0.2 * 26, color: pal.tinta2, acento: pal.acento})},
    anillo,
    cifraNodo({id: 'centro', texto: `${Math.round((items[0][1] / total) * 100)}%`, t, t0: cuando(0), dur: 0.9, fuente: fC, tam: 104, ls: -0.04 * 104, color: pal.tinta,
      x: 30, y: yC, w: 600, alinear: 'center', lh: 1, sombra: {blur: 40, color: pal.a(0.3)}, listo}),
    {id: 'centroNom', x: 30, y: yC + 104 + 6, w: 600, h: LN.alto, op: clamp(sp(t, cuando(0) + 0.4, RESORTES.carta) * 1.4), firma: `${nombre0}|${listo}`, pintar: (g) =>
      bloque(g, {texto: nombre0, x: 0, y: 0, ancho: 600, fuente: fN, tam: 22, lh: LN.alto / 22, ls: 0.16 * 22, color: pal.tinta3, alinear: 'center', partir: false, listo})},
    ...trozos.map(({nombre, valor, i}) => {
      const k = sp(t, cuando(i), RESORTES.carta);
      const pc = `${Math.round((valor / total) * 100)}%`;
      const anPc = pc.split('').reduce((a, ch) => a + (/\d/.test(ch) ? tab : anchoTexto(ch, fPc, 0)), 0);
      return {id: 'fila' + i, x: 620, y: 116 + i * (altoFila + 30), w: 400, h: altoFila, m: 30, tr: [['t', (1 - k) * 34, 0]], op: clamp(k * 1.6),
        firma: `${nombre}|${pc}|${pal.acento}|${listo}`, pintar: (g) => {
          g.save(); g.globalAlpha = TONOS[i % TONOS.length];
          caja(g, 0, (altoFila - 18) / 2, 18, 18, 6, pal.acento, i === 0 ? [{blur: 16, color: pal.a(0.8)}] : []);
          g.restore();
          bloque(g, {texto: nombre, x: 36, y: (altoFila - LNom.alto) / 2, ancho: 400 - 36 - 18 - anPc, fuente: fNom, tam: 34, lh: LNom.alto / 34, ls: -0.015 * 34,
            color: pal.tinta, partir: false, puntos: true, listo});
          // el % con tabular-nums: cada dígito centrado en su ancho fijo
          let x = 400 - anPc;
          g.font = fPc; (g as any).letterSpacing = '0px'; g.fillStyle = pal.tinta2; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
          for (const ch of pc) {
            const an = g.measureText(ch).width;
            const celda = /\d/.test(ch) ? tab : an;
            g.fillText(ch, x + (celda - an) / 2, (altoFila - LPc.alto) / 2 + LPc.asc);
            x += celda;
          }
        }} as Nodo;
    }),
  ]};
  void escribir;
  return <Escena nodos={[grupo]} Dh={Hd} letras={LETRAS} />;
};

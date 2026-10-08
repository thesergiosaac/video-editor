// La cuota EN LIENZO (8-oct-2026): la misma de Cuota.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, golpe, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {anchoTexto, bloque, chispasNodo, cifraNodo, comillas, escribir, escribirMaquina, estadoMaquina, lineaDe, lineaNormal, medidor} from '../lib/tarjetaEscena';
import {usePresenciaGrupo} from '../lib/Fondo';

const COLS = 5, AN = 116, ALTO_F = 150, HUECO = 22;
const LETRAS: Letra[] = [[OUTFIT, '900'], [MONO, '500']];
const CUERPO = new Path2D('M12 146 V102 C12 74 32 58 58 58 C84 58 104 74 104 102 V146 Q104 150 99 150 H17 Q12 150 12 146 Z');

export const CuotaGL: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const listo = useLetras(LETRAS);
  const d = p.datos || {};
  const total = Math.max(2, Math.min(10, Math.round(Number(d.total) || 10)));
  const llenas = Math.max(0, Math.min(total, Math.round(Number(d.llenas) || 0)));
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const {op, dy, sale} = usePresenciaGrupo();
  const paso = 0.17;
  const llega = tc + paso * llenas + 0.4;
  const latido = golpe(t, llega, 5, 2.3);
  const top = Math.round(Hd * 0.45);
  const anchoRejilla = COLS * AN + (COLS - 1) * HUECO;
  const x0 = Math.round((1080 - anchoRejilla) / 2);
  if (op <= 0.001) return null;

  const fE = `500 26px ${comillas(MONO)}`;
  const LE = lineaNormal(fE, listo);
  const etiqueta = String(d.etiqueta || '').toUpperCase();
  const anE = anchoTexto(etiqueta, fE, 0.2 * 26);
  // «4 de 10»: en línea, con la línea base del renglón de 92 px (line-height 1); el letter-spacing -0.04em se resuelve
  // con los 92 px del contenedor y lo heredan los <span> (también «de», de 52 px)
  const LS = -0.04 * 92;
  const fG = `900 92px ${comillas(OUTFIT)}`, fDe = `900 52px ${comillas(OUTFIT)}`;
  const L92 = lineaDe(fG, 92, 1, listo);
  const g0 = medidor(); g0.font = fG;
  const txtLlenas = String(llenas), txtTotal = String(total);
  const anLlenas = txtLlenas.split('').reduce((a, ch) => a + g0.measureText(ch).width + LS, 0);
  const anTotal = anchoTexto(txtTotal, fG, LS);
  const anDe = anchoTexto('de', fDe, LS);
  const anFila = anLlenas + 14 + anDe + 14 + anTotal;
  const xF = (1080 - anFila) / 2;
  const tituloK = sp(t, llega + 0.15, RESORTES.carta);
  const tamT = String(d.titulo || '').length > 26 ? 48 : 58;
  const fT = `900 ${tamT}px ${comillas(OUTFIT)}`;

  const grupo: Nodo = {id: 'grupo', x: 0, y: top, w: 1080, h: Math.round(Hd * 0.5), op, tr: [['t', 0, dy]], blur: sale > 0.02 ? sale * 10 : 0, hijos: [
    {id: 'etq', x: (1080 - anE) / 2, y: 0, w: anE + 30, h: LE.alto, m: 6, firma: `${etiqueta}|${estadoMaquina(etiqueta, t, p.t0 + 0.35, 1.4)}|${pal.acento}|${listo}`,
      pintar: (g) => escribirMaquina(g, {texto: etiqueta, t, t0: p.t0 + 0.35, velocidad: 1.4, x: 0, base: LE.asc, fuente: fE, tam: 26, ls: 0.2 * 26, color: pal.tinta2, acento: pal.acento})},
    {id: 'cuenta', x: 0, y: 46, w: 1080, h: 92, m: 60, tr: [['s', 1 + 0.05 * latido]], firma: `${llenas}|${total}|${listo}`, pintar: (g) => {
      escribir(g, 'de', xF + anLlenas + 14, L92.base, fDe, LS, pal.tinta3);
      escribir(g, txtTotal, xF + anLlenas + 14 + anDe + 14, L92.base, fG, LS, pal.tinta2);
    }, hijos: [cifraNodo({id: 'llenas', texto: txtLlenas, t, t0: tc, dur: 0.8, fuente: fG, tam: 92, ls: LS, color: pal.acento, x: xF, y: 0, w: anLlenas,
      alinear: 'left', lh: 1, sombra: {blur: 40, color: pal.a(0.45)}, listo})]},
    ...Array.from({length: total}).map((_, i) => {
      const on = i < llenas;
      const ti = on ? tc + i * paso : tc;
      const k = sp(t, ti, {damping: 12, stiffness: 160, mass: 0.85});
      return {id: 'f' + i, x: x0 + (i % COLS) * (AN + HUECO), y: 176 + Math.floor(i / COLS) * (ALTO_F + HUECO), w: AN, h: ALTO_F, m: 40,
        tr: [['t', 0, (1 - k) * 26], ['s', on ? 0.72 + 0.28 * k : 1]], op: clamp(k * 2) * (on ? 1 : 0.5), firma: `${on}|${pal.acento}`, pintar: (g) => {
          const c = on ? pal.acento : 'rgba(244,236,231,.16)';
          const kk = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
          g.fillStyle = c;
          if (on) g.filter = `drop-shadow(0 0 ${(16 * kk).toFixed(2)}px ${pal.a(0.6)})`;
          g.beginPath(); g.arc(58, 34, 27, 0, Math.PI * 2); g.fill();
          if (on) g.filter = `drop-shadow(0 ${(6 * kk).toFixed(2)}px ${(20 * kk).toFixed(2)}px ${pal.a(0.45)})`;
          g.fill(CUERPO);
          g.filter = 'none';
        }} as Nodo;
    }),
    d.titulo ? {id: 'titulo', x: 80, y: 176 + ALTO_F * 2 + HUECO + 26, w: 920, h: 3 * 1.06 * tamT, m: 60, tr: [['t', 0, (1 - tituloK) * 20]], op: clamp(tituloK * 1.5),
      firma: `${d.titulo}|${listo}`, pintar: (g) => {
        const k = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
        g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 40 * k; g.shadowOffsetY = 10 * k;
        bloque(g, {texto: String(d.titulo), x: 0, y: 0, ancho: 920, fuente: fT, tam: tamT, lh: 1.06, ls: -0.03 * tamT, color: pal.tinta, alinear: 'center', listo});
      }} : null,
    chispasNodo({id: 'chispas', t, t0: llega, x: x0 + ((llenas - 1) % COLS) * (AN + HUECO) + AN / 2, y: 176 + Math.floor((llenas - 1) / COLS) * (ALTO_F + HUECO) + 70,
      n: 18, semilla: 'cuota', fuerza: 680, pal}),
  ]};
  return <Escena nodos={[grupo]} Dh={Hd} letras={LETRAS} />;
};

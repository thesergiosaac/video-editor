// El porcentaje en anillo EN LIENZO (8-oct-2026): el mismo de Porcentaje.tsx con el motor de nodos (lib/escena.tsx).
import React, {useMemo} from 'react';
import {getLength, getPointAtLength} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {posDigito} from '../lib/Piezas';
import {anchoTexto, chispasNodo, comillas, escribirMaquina, estadoMaquina, letrasNodos, lineaDe, lineaNormal, medidor, pintarTambor} from '../lib/tarjetaEscena';
import {usePresenciaGrupo} from '../lib/Fondo';

const ANILLO = 340, CX = ANILLO / 2, R = 124;
const CIRC = `M ${CX} ${CX - R} A ${R} ${R} 0 1 1 ${CX} ${CX + R} A ${R} ${R} 0 1 1 ${CX} ${CX - R}`;
const DE_PERSONAS = /persona|gente|de cada|colombian|usuario|cliente|emprendedor|creador|estudiante|mujer|hombre|joven|adult/i;
const LETRAS: Letra[] = [[OUTFIT, '900'], [MONO, '500']];
const CUERPO = new Path2D('M3 43 V32 C3 24 9 20 17 20 C25 20 31 24 31 32 V43 Q31 48 26 48 H8 Q3 48 3 43 Z');

export const PorcentajeGL: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const listo = useLetras(LETRAS);
  const {op, dy, sale} = usePresenciaGrupo();
  const d = p.datos;
  const tc = p.marcas[0];
  const top = Math.round(Hd * 0.46);
  const frac = clamp(d.valor / 100);
  const largo = useMemo(() => getLength(CIRC), []);
  const pista = rampa(t, tc - 0.4, tc + 0.13, EASE.llega);
  const muelle = {damping: 11, stiffness: 52, mass: 1};
  const pa = sp(t, tc, muelle, 40) * frac;
  const punta = getPointAtLength(CIRC, Math.max(0.01, largo * Math.min(pa, 0.9999)));
  const valor = frac > 0 ? (Math.min(pa, frac) / frac) * d.valor : 0;
  const paAntes = sp(t - 1 / 30, tc, muelle, 40) * frac;
  const valorAntes = frac > 0 ? (Math.min(paAntes, frac) / frac) * d.valor : 0;
  const entrada = sp(t, tc - 0.45, RESORTES.carta);
  const llega = tc + 1.2;
  const latido = golpe(t, llega, 5, 2.3);
  const final = String(Math.round(d.valor));
  const personas = DE_PERSONAS.test(`${d.etiqueta} ${d.titulo}`);
  const llenas = Math.round(d.valor / 10);
  const tTitulo = tc + 1.1;
  const tamTit = String(d.titulo || '').length > 26 ? 56 : 66;
  const ang = frac * Math.PI * 2 - Math.PI / 2;
  if (op <= 0.001) return null;

  // la cifra del centro: tambores y «%» en un flex centrado (padding-left 10)
  const fs = final.length > 2 ? 84 : 100;
  const fN = `900 ${fs}px ${comillas(OUTFIT)}`, lsN = -0.04 * fs;
  const g0 = medidor(); g0.font = fN;
  const celdas = final.split('').map((ch) => g0.measureText(ch).width + lsN);
  const fP = `900 52px ${comillas(OUTFIT)}`;
  g0.font = fP;
  const anP = g0.measureText('%').width;
  const totalN = celdas.reduce((a, b) => a + b, 0) + 6 + anP;
  const xN = 10 + (330 - totalN) / 2;
  const LN12 = lineaDe(fN, fs, 1.2, listo);
  const LP = lineaDe(fP, 52, 1.2, listo);
  const pos = final.split('').map((_, i) => posDigito(valor, Math.pow(10, final.length - 1 - i)));
  const vel = final.split('').map((_, i) => pos[i] - posDigito(valorAntes, Math.pow(10, final.length - 1 - i)));

  const anillo: Nodo = {id: 'anillo', x: 0, y: 0, w: ANILLO, h: ANILLO, m: 70,
    tr: [['p', 1400], ['ry', (1 - entrada) * -35], ['s', (0.8 + 0.2 * entrada) * (1 + 0.03 * latido)]], op: clamp(entrada * 1.6),
    firma: `${Math.round(pa * 4000)}|${Math.round(pista * 1000)}|${pos.map((v) => Math.round(v * 1000)).join(',')}|${vel.map((v) => Math.round(v * 100)).join(',')}|` +
      `${Array.from({length: 10}).map((_, i) => Math.round(sp(t, tc - 0.3 + i * 0.05, RESORTES.pop) * 100)).join(',')}|${pal.acento}|${listo}`,
    pintar: (g) => {
      const k = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
      const arco = (ancho: number, p0: number) => { g.lineWidth = ancho; g.lineCap = 'round'; g.beginPath(); g.arc(CX, CX, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p0)); g.stroke(); };
      if (pa > 0.002) { g.save(); g.globalAlpha = 0.55; g.filter = `blur(${(16 * k).toFixed(2)}px)`; g.strokeStyle = pal.acento; arco(38, pa); g.restore(); }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const m = sp(t, tc - 0.3 + i * 0.05, RESORTES.pop);
        if (m <= 0.02) continue;
        const r1 = R + 24, r2 = R + 24 + 9 * m;
        g.strokeStyle = pa >= (i + 1) * 0.1 - 0.001 ? pal.acento : 'rgba(244,236,231,.25)'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(CX + Math.cos(a) * r1, CX + Math.sin(a) * r1); g.lineTo(CX + Math.cos(a) * r2, CX + Math.sin(a) * r2); g.stroke();
      }
      if (pista > 0) { g.strokeStyle = 'rgba(255,255,255,.08)'; arco(28, pista); }
      if (pa > 0.002) {
        const gr = g.createLinearGradient(CX - R, CX - R, CX + R, CX + R);
        gr.addColorStop(0, pal.claro); gr.addColorStop(0.6, pal.acento); gr.addColorStop(1, pal.hondo);
        g.strokeStyle = gr; arco(28, pa);
      }
      if (pa > 0.01 && punta) {
        g.globalAlpha = 0.35; g.fillStyle = pal.acento; g.beginPath(); g.arc(punta.x, punta.y, 27, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.95; g.fillStyle = '#fff'; g.beginPath(); g.arc(punta.x, punta.y, 10, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      // la cifra (los tambores centrados en el alto de su renglón) y el «%» con su margen de arriba
      let x = xN;
      const topN = (ANILLO - 1.2 * fs) / 2;
      celdas.forEach((cw, i) => {
        const b = Math.min(7, Math.abs(vel[i]) * 5);
        pintarTambor(g, {pos: pos[i], x, top: topN, cw, tam: fs, fuente: fN, ls: lsN, linea: LN12.base, color: pal.tinta,
          borroso: b > 0.4 ? Math.round(b * 2) / 2 : 0, listo});
        x += cw;
      });
      g.font = fP; (g as any).letterSpacing = '0px'; g.fillStyle = pal.tinta2; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillText('%', x + 6, (ANILLO - (LP.alto + 28)) / 2 + 28 + LP.base);
    }};

  // la columna de la derecha: la etiqueta que se escribe, el título (letras cinéticas) y las personas
  const fE = `500 25px ${comillas(MONO)}`;
  const LE = lineaNormal(fE, listo);
  const etiqueta = String(d.etiqueta || '').toUpperCase();
  const fT = `900 ${tamTit}px ${comillas(OUTFIT)}`;
  const titulo = letrasNodos({id: 'tit', texto: d.titulo || '', t, t0: tTitulo, fuente: fT, tam: tamTit, lh: 1.02, ls: -0.035 * tamTit,
    color: (w) => (/\d/.test(w) ? pal.acento : pal.tinta), x: 0, y: 32 + 12, anchoMax: 606, listo});
  const yPers = 32 + 12 + titulo.renglones * 1.02 * tamTit + 22;
  const derecha: Nodo = {id: 'der', x: ANILLO + 34, y: 30, w: 606, h: 400, hijos: [
    {id: 'etq', x: 0, y: 0, w: anchoTexto(etiqueta, fE, 0.15 * 25) + 30, h: 32, m: 6, firma: `${etiqueta}|${estadoMaquina(etiqueta, t, tc + 0.25, 1.3)}|${pal.acento}|${listo}`,
      pintar: (g) => escribirMaquina(g, {texto: etiqueta, t, t0: tc + 0.25, velocidad: 1.3, x: 0, base: LE.asc, fuente: fE, tam: 25, ls: 0.15 * 25, color: pal.tinta2, acento: pal.acento})},
    ...titulo.nodos,
    ...(personas ? Array.from({length: 10}).map((_, i) => {
      const kk = sp(t, tTitulo + 0.4 + i * 0.067, RESORTES.pop);
      const llena = i < llenas;
      const c = llena ? pal.acento : 'rgba(244,236,231,.16)';
      return {id: 'per' + i, x: i * (34 + 9), y: yPers, w: 34, h: 50, m: 20, tr: [['t', 0, (1 - kk) * 22], ['s', 0.4 + 0.6 * kk]], origen: [17, 50], op: clamp(kk * 2),
        firma: `${llena}|${pal.acento}`, pintar: (g) => {
          g.fillStyle = c; g.beginPath(); g.arc(17, 9, 8.5, 0, Math.PI * 2); g.fill();
          if (llena) { const k = Math.hypot(g.getTransform().a, g.getTransform().b) || 1; g.filter = `drop-shadow(0 0 ${(8 * k).toFixed(2)}px ${pal.a(0.55)})`; }
          g.fill(CUERPO); g.filter = 'none';
        }} as Nodo;
    }) : []),
  ]};

  const nodos: (Nodo | null)[] = [
    {id: 'grupo', x: 0, y: top, w: 1080, h: 420, op, tr: [['t', 0, dy]], blur: sale > 0.02 ? sale * 12 : 0, hijos: [
      {id: 'cont', x: 60, y: 0, w: 980, h: 420, hijos: [anillo, derecha]},
    ]},
    t >= tc + 1.1 ? chispasNodo({id: 'chispas', t, t0: tc + 1.2, x: 60 + CX + Math.cos(ang) * R, y: top + CX + Math.sin(ang) * R, n: 20, semilla: 'anillo', fuerza: 800, pal}) : null,
  ];
  return <Escena nodos={nodos} Dh={Hd} letras={LETRAS} />;
};

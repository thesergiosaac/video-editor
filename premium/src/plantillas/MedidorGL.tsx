// El medidor EN LIENZO (8-oct-2026): el mismo de Medidor.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, golpe, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {posDigito} from '../lib/Piezas';
import {anchoTexto, bloque, chispasNodo, comillas, escribirMaquina, estadoMaquina, lineaDe, lineaNormal, medidor, pintarTambor} from '../lib/tarjetaEscena';
import {usePresenciaGrupo} from '../lib/Fondo';

const CX = 540, CY = 330, R = 232, GRADO = 224;
const ang = (u: number) => ((180 - (GRADO - 180) / 2) + GRADO * u) * Math.PI / 180;
const pto = (u: number, r: number): [number, number] => [CX + Math.cos(ang(u)) * r, CY + Math.sin(ang(u)) * r];
const LETRAS: Letra[] = [[OUTFIT, '900'], [MONO, '500']];

export const MedidorGL: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const listo = useLetras(LETRAS);
  const d = p.datos || {};
  const val = Math.max(0, Math.min(100, Number(d.valor) || 0));
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.6;
  const {op, dy, sale} = usePresenciaGrupo();
  const muelle = {damping: 12, stiffness: 60, mass: 1.1};
  const k = sp(t, tc, muelle, 45);
  const kAntes = sp(t - 1 / 30, tc, muelle, 45);
  const u = k * (val / 100);
  const latido = golpe(t, tc + 1.1, 6, 2.4);
  const cabeza = {x: CX + Math.cos(ang(Math.min(u, 0.999))) * R, y: CY + Math.sin(ang(Math.min(u, 0.999))) * R};
  const [ax, ay] = pto(u, R - 46);
  const final = String(Math.round(val));
  const top = Math.round(Hd * 0.45);
  if (op <= 0.001) return null;
  const marcas = Array.from({length: 21}).map((_, i) => clamp(sp(t, p.t0 + 0.4 + i * 0.02, RESORTES.pop)));
  const aguja = clamp(sp(t, p.t0 + 0.5, RESORTES.carta));

  const tablero: Nodo = {id: 'tablero', x: 0, y: 0, w: 1080, h: 560, m: 60,
    firma: `${Math.round(u * 4000)}|${marcas.map((v) => Math.round(v * 100)).join(',')}|${Math.round(aguja * 1000)}|${pal.acento}`, pintar: (g) => {
      const kk = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
      g.lineCap = 'round';
      for (let i = 0; i < 21; i++) {
        if (marcas[i] <= 0) continue;
        const uu = i / 20;
        const [x1, y1] = pto(uu, R + 16), [x2, y2] = pto(uu, R + (i % 5 === 0 ? 38 : 26));
        g.globalAlpha = marcas[i];
        g.strokeStyle = uu <= u + 0.001 ? pal.acento : 'rgba(244,236,231,.25)'; g.lineWidth = i % 5 === 0 ? 6 : 3;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      }
      g.globalAlpha = 1;
      const arco = (p0: number) => { g.beginPath(); g.arc(CX, CY, R, ang(0), ang(0) + (GRADO * Math.PI / 180) * p0); g.stroke(); };
      g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 30; arco(1);
      if (u > 0.002) {
        g.save(); g.globalAlpha = 0.38; g.filter = `blur(${(17 * kk).toFixed(2)}px)`; g.strokeStyle = pal.acento; g.lineWidth = 46; arco(u); g.restore();
        const gr = g.createLinearGradient(CX - R, 0, CX + R, 0); gr.addColorStop(0, pal.claro); gr.addColorStop(1, pal.acento);
        g.strokeStyle = gr; g.lineWidth = 30; arco(u);
      }
      if (u > 0.01) {
        g.globalAlpha = 0.35; g.fillStyle = pal.acento; g.beginPath(); g.arc(cabeza.x, cabeza.y, 28, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(cabeza.x, cabeza.y, 11, 0, Math.PI * 2); g.fill();
      }
      // la aguja (crece desde el eje)
      if (aguja > 0) {
        g.save(); g.translate(CX, CY); g.scale(aguja, aguja); g.translate(-CX, -CY);
        g.strokeStyle = pal.tinta; g.lineWidth = 11; g.beginPath(); g.moveTo(CX, CY); g.lineTo(ax, ay); g.stroke();
        g.fillStyle = pal.tinta; g.beginPath(); g.arc(CX, CY, 27, 0, Math.PI * 2); g.fill();
        g.fillStyle = pal.acento; g.beginPath(); g.arc(CX, CY, 12, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }};

  // la cifra (112 px, line-height 1): tambores y «%» (60 px, el letter-spacing heredado del contenedor de 112 px)
  const LS = -0.04 * 112;
  const fN = `900 112px ${comillas(OUTFIT)}`, fP = `900 60px ${comillas(OUTFIT)}`;
  const L1 = lineaDe(fN, 112, 1, listo), L12 = lineaDe(fN, 112, 1.2, listo);
  const g0 = medidor(); g0.font = fN;
  const celdas = final.split('').map((ch) => g0.measureText(ch).width + LS);
  const anP = anchoTexto('%', fP, LS);
  const anCifra = celdas.reduce((a, b) => a + b, 0) + 6 + anP;
  const x0 = (1080 - anCifra) / 2;
  const pos = final.split('').map((_, i) => posDigito(val * k, Math.pow(10, final.length - 1 - i)));
  const vel = final.split('').map((_, i) => pos[i] - posDigito(val * kAntes, Math.pow(10, final.length - 1 - i)));
  const cifra: Nodo = {id: 'cifra', x: 0, y: CY - 206, w: 1080, h: 112, m: 60, tr: [['s', 1 + 0.05 * latido]],
    firma: `${pos.map((v) => Math.round(v * 1000)).join(',')}|${vel.map((v) => Math.round(v * 100)).join(',')}|${listo}`, pintar: (g) => {
      const k2 = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
      // todo con la sombra 0 10px 30px rgba(0,0,0,.5): sin sombra en una capa y la capa con su sombra
      const capa = document.createElement('canvas');
      capa.width = Math.ceil(1200 * k2); capa.height = Math.ceil(232 * k2);
      const gc = capa.getContext('2d')!;
      gc.setTransform(k2, 0, 0, k2, 60 * k2, 60 * k2);
      let x = x0;
      celdas.forEach((cw, i) => {
        const b = Math.min(7, Math.abs(vel[i]) * 5);
        pintarTambor(gc, {pos: pos[i], x, top: 0, cw, tam: 112, fuente: fN, ls: LS, linea: L12.base, color: pal.tinta, borroso: b > 0.4 ? Math.round(b * 2) / 2 : 0, alto: 112, listo});
        x += cw;
      });
      gc.font = fP; (gc as any).letterSpacing = `${LS}px`; gc.fillStyle = pal.tinta2; gc.textBaseline = 'alphabetic'; gc.textAlign = 'left';
      gc.fillText('%', x + 6, L1.base);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30 * k2; g.shadowOffsetY = 10 * k2;
      g.drawImage(capa, 0, 0);
      g.restore();
    }};

  const fE = `500 27px ${comillas(MONO)}`;
  const LE = lineaNormal(fE, listo);
  const etiqueta = String(d.etiqueta || '').toUpperCase();
  const anE = anchoTexto(etiqueta, fE, 0.18 * 27);
  const kT = sp(t, tc + 0.9, RESORTES.carta);
  const tamT = String(d.titulo || '').length > 26 ? 50 : 60;
  const fT = `900 ${tamT}px ${comillas(OUTFIT)}`;
  const grupo: Nodo = {id: 'grupo', x: 0, y: top, w: 1080, h: 560, op, tr: [['t', 0, dy]], blur: sale > 0.02 ? sale * 10 : 0, hijos: [
    tablero,
    cifra,
    {id: 'etq', x: (1080 - anE) / 2, y: CY + 58, w: anE + 30, h: LE.alto, m: 6, firma: `${etiqueta}|${estadoMaquina(etiqueta, t, p.t0 + 0.6, 1.3)}|${pal.acento}|${listo}`,
      pintar: (g) => escribirMaquina(g, {texto: etiqueta, t, t0: p.t0 + 0.6, velocidad: 1.3, x: 0, base: LE.asc, fuente: fE, tam: 27, ls: 0.18 * 27, color: pal.tinta2, acento: pal.acento})},
    d.titulo ? {id: 'titulo', x: 70, y: CY + 112, w: 940, h: 3 * 1.05 * tamT, m: 6, tr: [['t', 0, (1 - kT) * 18]], op: clamp(kT * 1.4), firma: `${d.titulo}|${listo}`, pintar: (g) =>
      bloque(g, {texto: String(d.titulo), x: 0, y: 0, ancho: 940, fuente: fT, tam: tamT, lh: 1.05, ls: -0.03 * tamT, color: pal.tinta, alinear: 'center', listo})} : null,
    chispasNodo({id: 'chispas', t, t0: tc + 1.05, x: cabeza.x, y: cabeza.y, n: 16, semilla: 'medidor', fuerza: 700, pal}),
  ]};
  return <Escena nodos={[grupo]} Dh={Hd} letras={LETRAS} />;
};

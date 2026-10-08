// La balanza EN LIENZO (8-oct-2026): la misma de Balanza.tsx con el motor de nodos (lib/escena.tsx).
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {RESORTES, clamp, sp, useG, useT} from '../lib/anim';
import {Escena, Letra, Nodo, useLetras} from '../lib/escena';
import {anchoTexto, bloque, caja, chispasNodo, cifraNodo, comillas, escribirMaquina, estadoMaquina, gradiente, lineaNormal, medidor, partirTexto} from '../lib/tarjetaEscena';
import {usePresenciaGrupo} from '../lib/Fondo';

const CX = 540, BRAZO = 292, MASTIL = 138;
const LETRAS: Letra[] = [[OUTFIT, '900'], [OUTFIT, '800'], [MONO, '500']];

export const BalanzaGL: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const listo = useLetras(LETRAS);
  const d = p.datos || {};
  const A = d.a || {}, B = d.b || {};
  const tA = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const tB = p.marcas[1] != null ? p.marcas[1] : tA + 1.2;
  const {op, dy, sale} = usePresenciaGrupo();
  const va = Number(A.valor) || 0, vb = Number(B.valor) || 0;
  const ganaB = d.ganador ? String(d.ganador) === 'b' : vb >= va;
  const dif = Math.min(1, Math.abs(vb - va) / Math.max(1, Math.max(va, vb)));
  const k = sp(t, tB, {damping: 12, stiffness: 70, mass: 1.1});
  const ang = (ganaB ? 1 : -1) * 13 * dif * k;
  const top = Math.round(Hd * 0.42);
  const kA = sp(t, tA, RESORTES.carta);
  const kB = sp(t, tB, RESORTES.carta);
  if (op <= 0.001) return null;

  const fV = `900 52px ${comillas(OUTFIT)}`;
  const LV = lineaNormal(fV, listo);
  const fL = `800 30px ${comillas(OUTFIT)}`;
  const plato = (lado: -1 | 1, txt: string, valor: string, kk: number, gana: boolean): Nodo => {
    const x = CX + lado * BRAZO;
    const y = top + MASTIL + 30 + (lado === 1 ? ang : -ang) * 5.2;
    const g0 = medidor(); g0.font = fV;
    const anV = valor.split('').reduce((a, ch) => a + g0.measureText(ch).width - 0.03 * 52, 0);
    const ren = partirTexto(txt, fL, -0.015 * 30, 340);
    return {id: 'plato' + lado, x: x - 170, y, w: 340, h: 96 + 14 + ren.length * 1.12 * 30, m: 50, tr: [['t', 0, (1 - kk) * 26]], op: clamp(kk * 1.6),
      firma: `${txt}|${gana}|${pal.acento}|${listo}`, pintar: (g) => {
        caja(g, 0, 0, 340, 96, 22, gana ? gradiente(g, 0, 0, 340, 96, 150, [[0, pal.claro], [1, pal.acento]]) : 'rgba(255,255,255,.09)',
          gana ? [{y: 18, blur: 44, spread: -16, color: pal.a(0.8)}, {y: 2, color: 'rgba(255,255,255,.35)', inset: true}] : [{spread: 1.5, color: 'rgba(255,255,255,.12)', inset: true}]);
        bloque(g, {texto: txt, x: 0, y: 96 + 14, ancho: 340, fuente: fL, tam: 30, lh: 1.12, ls: -0.015 * 30, color: gana ? pal.tinta : pal.tinta2, alinear: 'center', listo});
      }, hijos: [cifraNodo({id: 'v' + lado, texto: valor, t, t0: gana ? tB : tA, dur: 0.8, fuente: fV, tam: 52, ls: -0.03 * 52, color: gana ? pal.sobre : pal.tinta,
        x: (340 - anV) / 2, y: (96 - LV.alto) / 2, w: anV, alinear: 'left', lh: LV.alto / 52, listo})]};
  };

  const fE = `500 26px ${comillas(MONO)}`;
  const LE = lineaNormal(fE, listo);
  const etiqueta = String(d.etiqueta || '').toUpperCase();
  const anE = anchoTexto(etiqueta, fE, 0.2 * 26);
  const tamT = String(d.titulo || '').length > 28 ? 48 : 58;
  const fT = `900 ${tamT}px ${comillas(OUTFIT)}`;
  const grupo: Nodo = {id: 'grupo', x: 0, y: 0, w: 1080, h: Hd, op, tr: [['t', 0, dy]], blur: sale > 0.02 ? sale * 10 : 0, hijos: [
    {id: 'etq', x: (1080 - anE) / 2, y: top - 46, w: anE + 30, h: LE.alto, m: 6, firma: `${etiqueta}|${estadoMaquina(etiqueta, t, p.t0 + 0.35, 1.4)}|${pal.acento}|${listo}`,
      pintar: (g) => escribirMaquina(g, {texto: etiqueta, t, t0: p.t0 + 0.35, velocidad: 1.4, x: 0, base: LE.asc, fuente: fE, tam: 26, ls: 0.2 * 26, color: pal.tinta2, acento: pal.acento})},
    {id: 'mastil', x: 0, y: top, w: 1080, h: MASTIL + 80, m: 20, firma: 'm', pintar: (g) => {
      g.strokeStyle = 'rgba(244,236,231,.30)'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(CX, MASTIL); g.lineTo(CX, 22); g.stroke();
      g.fillStyle = 'rgba(244,236,231,.30)'; g.beginPath(); g.arc(CX, MASTIL, 13, 0, Math.PI * 2); g.fill();
    }},
    {id: 'brazo', x: 0, y: top, w: 1080, h: MASTIL + 80, m: 40, tr: [['rz', ang]], origen: [CX, 22], firma: pal.acento, pintar: (g) => {
      const kk = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
      g.save();
      g.filter = `drop-shadow(0 0 ${(16 * kk).toFixed(2)}px ${pal.a(0.6)})`;
      g.strokeStyle = pal.acento; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(CX - BRAZO, 22); g.lineTo(CX + BRAZO, 22); g.stroke();
      g.restore();
      g.fillStyle = pal.tinta;
      g.beginPath(); g.arc(CX - BRAZO, 22, 11, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(CX + BRAZO, 22, 11, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(244,236,231,.35)'; g.lineWidth = 4; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(CX - BRAZO, 22); g.lineTo(CX - BRAZO, 56); g.moveTo(CX + BRAZO, 22); g.lineTo(CX + BRAZO, 56); g.stroke();
    }},
    plato(-1, String(A.texto || ''), `${d.prefijo || ''}${va}${d.sufijo || ''}`, kA, !ganaB),
    plato(1, String(B.texto || ''), `${d.prefijo || ''}${vb}${d.sufijo || ''}`, kB, ganaB),
    d.titulo ? {id: 'titulo', x: 90, y: top + MASTIL + 302, w: 900, h: 3 * 1.06 * tamT, m: 60, op: clamp(sp(t, tB + 0.6, RESORTES.carta) * 1.5), firma: `${d.titulo}|${listo}`,
      pintar: (g) => {
        const kk = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
        g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 40 * kk; g.shadowOffsetY = 10 * kk;
        bloque(g, {texto: String(d.titulo), x: 0, y: 0, ancho: 900, fuente: fT, tam: tamT, lh: 1.06, ls: -0.03 * tamT, color: pal.tinta, alinear: 'center', listo});
      }} : null,
    chispasNodo({id: 'chispas', t, t0: tB + 0.4, x: CX + (ganaB ? BRAZO : -BRAZO), y: top + MASTIL + 60, n: 18, semilla: 'bal', fuerza: 680, pal}),
  ]};
  return <Escena nodos={[grupo]} Dh={Hd} letras={LETRAS} />;
};

// El fondo de la pantalla partida y completa EN LIENZO (8-oct-2026): el mismo FondoHueco de Fondo.tsx (brillo que se mueve
// con ruido, retícula de puntos, grano, viñeta, la sombra alrededor del video encogido y el hueco por donde se ve), el filo
// de luz del borde del video y el aro de pantalla completa. El fondo se repinta solo cuando el brillo se movió más de un px
// del dibujo o cuando el hueco cambia (al encogerse y al volver el video).
import React from 'react';
import {evolvePath} from '@remotion/paths';
// @ts-ignore
import GRAF from '../graficos.js';
import {EASE, rampa, useG, useT} from './anim';
import {Escena, Nodo} from './escena';
import {ruido2D} from './ruido';
import {caja, paradasCss} from './tarjetaEscena';
import {grano, redondeado, sombra} from './lienzo';

const R1 = (v: number) => Math.round(v);
/* radial-gradient(rx ry at cx cy, …) sobre toda la caja w × h */
const radial = (g: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, rx: number, ry: number, paradas: [number, string][]) => {
  g.save();
  g.beginPath(); g.rect(0, 0, w, h); g.clip();
  g.translate(cx, cy); g.scale(rx, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  paradasCss(paradas).forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(-1e4, -1e4, 2e4, 2e4);
  g.restore();
};

export const FondoHuecoGL: React.FC<{parte?: string}> = ({parte = 'todo'}) => {
  const t = useT();
  const {p, pal, W, H, esc, Hd} = useG();
  const hu = GRAF.hueco(p, t, W, H);
  if (!hu || hu.k <= 0) return null;
  const x = hu.x / esc, y = hu.y / esc, w = hu.w / esc, h = hu.h / esc, r = hu.r / esc, k = hu.k;
  const cx = 540 + ruido2D('fondo-x', t * 0.05, 0) * 180;
  const cy = Hd * 0.47 + ruido2D('fondo-y', 0, t * 0.05) * 200;
  const aro = p.forma === 'completa' ? rampa(k, 0.8, 1, EASE.llega) : 0;
  const R = w / 2 + 12;
  const latido = 0.5 + 0.5 * Math.sin(t * 3.3);
  const hueco = `${x.toFixed(2)}|${y.toFixed(2)}|${w.toFixed(2)}|${h.toFixed(2)}|${r.toFixed(2)}|${k.toFixed(4)}`;
  const nodos: (Nodo | null)[] = [];
  if (parte !== 'contenido') {
    nodos.push({id: 'fondo', x: 0, y: 0, w: 1080, h: Hd, firma: `${R1(cx)}|${R1(cy)}|${hueco}|${pal.acento}`, pintar: (g) => {
      const kk = Math.hypot(g.getTransform().a, g.getTransform().b) || 1;
      // los fondos de CSS (el primero va encima): degradado de arriba abajo, el brillo de abajo y el que se mueve
      const lin = g.createLinearGradient(0, 0, 0, Hd);
      lin.addColorStop(0, '#150C12'); lin.addColorStop(0.55, '#0B0709'); lin.addColorStop(1, '#070406');
      g.fillStyle = lin; g.fillRect(0, 0, 1080, Hd);
      radial(g, 1080, Hd, 540, Hd + 160, 1500, 900, [[0, pal.a(0.12)], [0.7, pal.a(0)]]);
      radial(g, 1080, Hd, cx, cy, 820, 820, [[0, pal.a(0.19)], [0.7, pal.a(0)]]);
      // la retícula de puntos (cada 44 px, desde 22 10) con opacidad .3
      g.save();
      g.globalAlpha = 0.3;
      g.fillStyle = 'rgba(255,255,255,.10)';
      for (let py = 32 - 44; py < Hd + 44; py += 44) for (let px = 44 - 44; px < 1080 + 44; px += 44) { g.beginPath(); g.arc(px, py, 1.85, 0, Math.PI * 2); g.fill(); }
      g.restore();
      // el grano y la viñeta
      g.save(); g.globalAlpha = 0.045; g.fillStyle = g.createPattern(grano(), 'repeat')!; g.fillRect(0, 0, 1080, Hd); g.restore();
      radial(g, 1080, Hd, 540, Hd * 0.45, 1.3 * 1080, 0.95 * Hd, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.6)']]);
      // la sombra alrededor del video encogido (solo por fuera del hueco)
      sombra(g, kk, x, y, w, h, r, 12 * k, 22 * k, 0, `rgba(0,0,0,${0.4 * k})`);
      sombra(g, kk, x, y, w, h, r, 30 * k, 48 * k, 0, `rgba(0,0,0,${0.62 * k})`);
      // y el hueco
      g.save();
      g.globalCompositeOperation = 'destination-out';
      redondeado(g, x, y, w, h, r); g.fillStyle = '#000'; g.fill();
      g.restore();
    }});
  }
  if (parte !== 'fondo') {
    // el filo de luz en el borde del video
    nodos.push({id: 'filo', x, y, w, h, m: 4, firma: hueco, pintar: (g) =>
      caja(g, 0, 0, w, h, r, null, [{spread: 1.5, color: `rgba(255,255,255,${0.12 * k})`, inset: true}, {y: 2, color: `rgba(255,255,255,${0.16 * k})`, inset: true}])});
    if (aro > 0.001) {
      const M = R + 40, ccx = x + w / 2, ccy = y + h / 2;
      const ARO = `M ${M} ${M - R} A ${R} ${R} 0 1 1 ${M} ${M + R} A ${R} ${R} 0 1 1 ${M} ${M - R}`;
      const trazo = (g: CanvasRenderingContext2D, ancho: number, redondo: boolean) => {
        const ev = evolvePath(aro, ARO);
        g.strokeStyle = pal.acento; g.lineWidth = ancho; g.lineCap = redondo ? 'round' : 'butt';
        const L = Number(String(ev.strokeDasharray).split(' ')[0]);
        if (aro < 1) { g.setLineDash([L * aro, L * 2]); }
        g.beginPath(); g.arc(M, M, R, -Math.PI / 2, Math.PI * 1.5); g.stroke();
        g.setLineDash([]);
      };
      // el brillo (desenfoque 10 px, opacidad que late: va como opacidad del nodo, el lienzo no se repinta) y el aro
      nodos.push({id: 'aroBrillo', x: ccx - M, y: ccy - M, w: 2 * M, h: 2 * M, m: 40, op: 0.25 + 0.12 * latido, blur: 10, firma: `${R.toFixed(1)}|${aro.toFixed(4)}|${pal.acento}`,
        pintar: (g) => trazo(g, 20, false)});
      nodos.push({id: 'aro', x: ccx - M, y: ccy - M, w: 2 * M, h: 2 * M, m: 10, firma: `${R.toFixed(1)}|${aro.toFixed(4)}|${pal.acento}`, pintar: (g) => trazo(g, 7, true)});
    }
  }
  return <Escena nodos={nodos} Dh={Hd} letras={[]} />;
};

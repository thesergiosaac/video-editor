// Número gigante EN LIENZO (8-oct-2026, piloto de «los gráficos para la tarjeta gráfica»).
// El MISMO gráfico de Numero.tsx (mismos tiempos, medidas, colores y movimientos), pero dibujado en un lienzo:
//   · la cara de la tarjeta (fondo, grano, curva, resplandor, etiqueta, cifra en tambores, chip, bordes y barrido) se
//     pinta en 2D una sola vez por cuadro;
//   · la placa (su sombra y su tinte) se pinta una sola vez y se guarda;
//   · las dos se ponen en 3D con WebGL (lib/lienzo.ts › elProyector) con la misma perspectiva del CSS; el desenfoque de
//     movimiento de la entrada son 5 proyecciones de la MISMA cara (antes: la tarjeta entera dibujada 5 veces);
//   · las chispas, encima, en 2D.
// Así va fluido en la vista previa y el navegador lo puede fabricar (sin páginas web dentro del gráfico).
import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {continueRender, delayRender, interpolate, random} from 'remotion';
import {getLength, getPointAtLength} from '@remotion/paths';
import {noise2D} from '@remotion/noise';
import {makeSpark} from '@remotion/shapes';
// @ts-ignore
import GRAF from '../graficos.js';
import {MONO, OUTFIT} from '../tema';
import type {Paleta} from '../tema';
import {EASE, RESORTES, clamp, giro, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {poseTarjeta, tamPara, vidrioGL} from '../lib/Piezas';
import {curvaDe} from './Numero';
import {barrido, bordeInterior, elProyector, elipse, esquinasDe, grano, lienzo, metricas, preparar, proyectar, redondeado, sombra} from '../lib/lienzo';

const MC = 60;    // margen alrededor de la cara (lo que se sale: sombras de las letras, desenfoque de salida)
const MP = 170;   // margen alrededor de la placa (su sombra baja hasta ~130 px)
const SEMILLA = 'num';

// lienzos de trabajo: se dibuja de a un gráfico a la vez, así que se comparten
const TRABAJO: Record<string, HTMLCanvasElement> = {};
const L = (n: string) => TRABAJO[n] || (TRABAJO[n] = lienzo());
const escalaDe = (g: CanvasRenderingContext2D) => { const m = g.getTransform(); return Math.hypot(m.a, m.b) || 1; };
const comillas = (f: string) => (/^["']/.test(f) ? f : `"${f}"`);
const fuentes = (chip: boolean) => [`900 100px ${comillas(OUTFIT)}`, `500 27px ${comillas(MONO)}`].concat(chip ? [`800 42px ${comillas(OUTFIT)}`] : []);
const listas = (l: string[]) => typeof document === 'undefined' || !document.fonts || l.every((f) => document.fonts.check(f));

type Estado = {
  t: number; p: any; pal: Paleta; vista: boolean; inicio: number; fps: number; kFijo: number; Dh: number;
  T: {x: number; y: number; w: number; h: number; r: number}; ENTRA: number; SALE: number; LLEGA: number; tc: number;
  curva: string; curvaP: Path2D; areaP: Path2D; largo: number; arriba: number;
};
type Mio = {k: number; veces: number; placa: HTMLCanvasElement | null; placaV: string};

/* ── la cara de la tarjeta, en px del dibujo con origen en su esquina de arriba a la izquierda ── */
function cara(g: CanvasRenderingContext2D, e: Estado) {
  const {t, pal, T, tc, ENTRA, LLEGA} = e;
  const d = e.p.datos || {};
  const w = T.w, h = T.h, r = T.r;

  // fondo: degradado de arriba abajo + luz blanca arriba a la izquierda + el color abajo a la derecha, y el grano
  g.save();
  redondeado(g, 0, 0, w, h, r); g.clip();
  const lin = g.createLinearGradient(0, 0, 0, h);
  lin.addColorStop(0, 'rgba(42,32,38,.50)'); lin.addColorStop(1, 'rgba(16,11,14,.64)');
  g.fillStyle = lin; g.fillRect(0, 0, w, h);
  elipse(g, 0, 0, w, h, 0.12 * w, -0.28 * h, 1.2 * w, 0.7 * h, [[0, 'rgba(255,255,255,.11)'], [0.6, 'rgba(255,255,255,0)']]);
  elipse(g, 0, 0, w, h, w, 1.18 * h, 0.7 * w, 0.9 * h, [[0, pal.a(0.17)], [0.62, pal.a(0)]]);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07;
  g.fillStyle = g.createPattern(grano(), 'repeat')!; g.fillRect(0, 0, w, h);
  g.restore();

  // la curva que crece: el área (opacidad .6, se descubre de izquierda a derecha) y la línea con su punta (opacidad .62)
  const pc = rampa(t, tc, LLEGA + 0.13, EASE.llega);
  if (pc > 0) {
    g.save();
    g.beginPath(); g.rect(0, 0, pc * w, h); g.clip();
    g.globalAlpha = 0.6;
    const ga = g.createLinearGradient(0, e.arriba, 0, h);
    ga.addColorStop(0, pal.a(0.22)); ga.addColorStop(1, pal.a(0));
    g.fillStyle = ga; g.fill(e.areaP);
    g.restore();

    const lc = L('linea');
    const k = escalaDe(g);
    const gl = preparar(lc, (w + 2 * MC) * k, (h + 2 * MC) * k);
    gl.setTransform(k, 0, 0, k, MC * k, MC * k);
    const gr = gl.createLinearGradient(46, 0, w - 46, 0);
    gr.addColorStop(0, pal.a(0.1)); gr.addColorStop(1, pal.claro);
    gl.strokeStyle = gr; gl.lineWidth = 5; gl.lineCap = 'round';
    if (pc < 1) gl.setLineDash([e.largo * pc, e.largo * 2]);
    gl.stroke(e.curvaP);
    gl.setLineDash([]);
    if (pc > 0.01) {
      const q = getPointAtLength(e.curva, Math.max(0.01, e.largo * pc));
      if (q) {
        gl.globalAlpha = 0.28; gl.fillStyle = pal.acento;
        gl.beginPath(); gl.arc(q.x, q.y, 24, 0, Math.PI * 2); gl.fill();
        gl.globalAlpha = 1; gl.fillStyle = '#fff';
        gl.beginPath(); gl.arc(q.x, q.y, 9, 0, Math.PI * 2); gl.fill();
      }
    }
    g.save();
    g.globalAlpha = 0.62;
    g.drawImage(lc, -MC, -MC, w + 2 * MC, h + 2 * MC);
    g.restore();
  }

  // el resplandor detrás de la cifra cuando llega
  const bloom = t < LLEGA - 0.13 ? 0 : rampa(t, LLEGA - 0.13, LLEGA + 0.1) * (1 - 0.6 * rampa(t, LLEGA + 0.1, LLEGA + 1.33));
  if (bloom > 0.001) {
    const s = 0.7 + 0.3 * clamp(bloom * 1.5);
    g.save();
    g.globalAlpha = bloom;
    elipse(g, w / 2 - 330 * s, 220 - 130 * s, 660 * s, 260 * s, 330 * s, 130 * s, 330 * s, 130 * s, [[0, pal.a(0.42)], [1, pal.a(0)]]);
    g.restore();
  }

  etiqueta(g, e, String(d.etiqueta || ''), ENTRA + 0.13);
  cifra(g, e);
  if (d.chip) chip(g, e, String(d.chip));

  // los bordes de luz (inset) y el barrido
  bordeInterior(g, 0, 0, w, h, r, -1, 0, 'rgba(255,255,255,.04)');
  bordeInterior(g, 0, 0, w, h, r, 0, 1.5, 'rgba(255,255,255,.10)');
  bordeInterior(g, 0, 0, w, h, r, 2, 0, 'rgba(255,255,255,.15)');
  const b0 = LLEGA + 0.4;
  const pb = rampa(t, b0, b0 + 0.93, EASE.inOut);
  if (pb > 0 && pb < 1) {
    g.save();
    redondeado(g, 0, 0, w, h, r); g.clip();
    barrido(g, pb, w, h, 1);
    g.restore();
  }
}

/* la etiqueta en DM Mono con su punto «en vivo» (Etiqueta + Escribir de Piezas) */
function etiqueta(g: CanvasRenderingContext2D, e: Estado, crudo: string, t0: number) {
  const texto = crudo.toUpperCase();
  if (!texto) return;
  const {t, pal, T} = e;
  const a = sp(t, t0, RESORTES.pop);
  const latido = 0.5 + 0.5 * Math.sin(((t - t0) * 30) / 4.5);
  const fuente = `500 27px ${comillas(MONO)}`;
  g.font = fuente; (g as any).letterSpacing = '0px';
  const ls = 0.16 * 27;
  const paso = g.measureText('M').width + ls;
  const {asc, desc} = metricas(g, fuente);
  const lh = asc + desc, alto = Math.max(13, lh);
  const x0 = (T.w - (13 + 16 + texto.length * paso)) / 2;
  const cy = 40 + alto / 2;
  if (a > 0.001) {
    g.save();
    g.translate(x0 + 6.5, cy); g.scale(a, a);
    const k = escalaDe(g);
    // 0 0 18px a(.8) (debajo), el anillo 0 0 0 (4 + 6·latido)px a(.28 − .2·latido) y el punto
    g.save();
    g.shadowColor = pal.a(0.8); g.shadowBlur = 18 * k; g.shadowOffsetX = 20000 * k;
    g.beginPath(); g.arc(-20000, 0, 6.5, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill();
    g.restore();
    g.fillStyle = pal.a(0.28 - 0.2 * latido);
    g.beginPath(); g.arc(0, 0, 6.5 + 4 + 6 * latido, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal.acento;
    g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // máquina de escribir: 1,4 letras por cuadro de 30, con su cursor que parpadea
  const f = (t - (t0 + 2 / 30)) * 30;
  const n = clamp(Math.floor(f * 1.4), 0, texto.length);
  const escribiendo = f >= -3 && f < texto.length / 1.4 + 7;
  const parpadeo = n < texto.length || Math.floor((t * 30) / 4) % 2 === 0;
  const tx = x0 + 13 + 16, base = 40 + (alto - lh) / 2 + asc;
  g.fillStyle = pal.tinta2; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  for (let i = 0; i < n; i++) g.fillText(texto[i], tx + i * paso, base);
  if (escribiendo && parpadeo) {
    redondeado(g, tx + n * paso + 0.08 * 27, base - 0.82 * 27, 0.5 * 27, 0.95 * 27, 3);
    g.fillStyle = pal.acento; g.fill();
  }
}

/* la sombra de las letras de la cifra (0 12px 34px rgba(0,0,0,.45)): el lienzo no la escala, se le da en px reales */
const sombraLetra = (g: CanvasRenderingContext2D, k: number) => {
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 34 * k; g.shadowOffsetX = 0; g.shadowOffsetY = 12 * k;
};

/* la cifra: cada dígito rueda en su tambor (Cifra + Tambor de Piezas); lo demás entra de un salto */
function cifra(g: CanvasRenderingContext2D, e: Estado) {
  const {t, pal, T, tc, LLEGA} = e;
  const d = e.p.datos || {};
  const texto = (d.prefijo || '') + GRAF.cifra(d.valor, d.decimales) + (d.sufijo || '');
  const tam = tamPara(texto, 800, 200, 0.6);
  const s = sp(t, tc - 0.05, RESORTES.pop);
  const alfa = clamp(s * 1.6);
  if (alfa <= 0.001) return;
  const fuente = `900 ${tam}px ${comillas(OUTFIT)}`;
  g.font = fuente; (g as any).letterSpacing = '0px';
  const ls = -0.045 * tam;
  const {asc, desc} = metricas(g, fuente);
  const hl = (1.2 * tam - (asc + desc)) / 2;
  const arriba = 92 + (200 - tam) * 0.6;
  const base = arriba + hl + asc;
  const chars = texto.split('');
  const anchos = chars.map((ch: string) => g.measureText(ch).width + ls);
  let x = (T.w - anchos.reduce((a: number, b: number) => a + b, 0)) / 2;
  const sl = 1 + 0.05 * golpe(t, LLEGA, 5, 2.4);
  const digitos = chars.filter((c: string) => /\d/.test(c)).length;
  let j = 0;
  g.save();
  g.translate(T.w / 2, arriba + 0.6 * tam); g.scale(sl, sl); g.translate(-T.w / 2, -(arriba + 0.6 * tam));
  chars.forEach((ch: string, i: number) => {
    const cw = anchos[i];
    if (/\d/.test(ch)) {
      const kd = j++;
      const vueltas = digitos <= 1 ? 1 : Math.min(2, Math.round((kd / Math.max(1, digitos - 1)) * 2));
      const total = vueltas * 10 + Number(ch);
      const dur = 1.15 + kd * 0.1;
      const pos = giro(t, tc, dur, total);
      tambor(g, pal, fuente, x, arriba, cw, tam, ls, hl + asc, pos, pos - giro(t - 1 / 30, tc, dur, total), alfa);
    } else {
      const sc = 0.6 + 0.4 * s;
      const cx = x + cw / 2, cy = arriba + 0.6 * tam;
      g.save();
      g.globalAlpha = alfa;
      g.translate(cx, cy); g.scale(sc, sc); g.translate(-cx, -cy);
      sombraLetra(g, escalaDe(g));
      g.fillStyle = pal.tinta; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillText(ch, x, base);
      g.restore();
    }
    x += cw;
  });
  g.restore();
}

/* un tambor: la ventana (1,8 veces el ancho del dígito, el alto de la línea) con 4 dígitos que ruedan, desenfocada
   si gira rápido y desvanecida arriba y abajo (la máscara 0 → 17 % → 83 % → 100 %) */
function tambor(g: CanvasRenderingContext2D, pal: Paleta, fuente: string, x: number, arriba: number, cw: number, tam: number,
  ls: number, linea: number, pos: number, vel: number, alfa: number) {
  const k = escalaDe(g);
  const vx = x - 0.4 * cw, vw = 1.8 * cw, vh = 1.2 * tam;
  const b = Math.floor(pos), frac = pos - b;
  const c1 = L('tambor');
  const g1 = preparar(c1, vw * k, vh * k);
  g1.setTransform(k, 0, 0, k, 0, 0);
  g1.font = fuente; (g1 as any).letterSpacing = '0px';
  g1.fillStyle = pal.tinta; g1.textBaseline = 'alphabetic'; g1.textAlign = 'left';
  sombraLetra(g1, k);
  for (let kq = -1; kq <= 2; kq++) {
    const dg = String((((b + kq) % 10) + 10) % 10);
    const an = g1.measureText(dg).width + ls;
    g1.fillText(dg, (vw - an) / 2, linea + (kq - frac) * vh);
  }
  let fuenteC = c1;
  const borroso = Math.min(7, Math.abs(vel) * 5);
  if (borroso > 0.4) {
    const c2 = L('tambor2');
    const g2 = preparar(c2, c1.width, c1.height);
    g2.filter = `blur(${(borroso * k).toFixed(2)}px)`;
    g2.drawImage(c1, 0, 0);
    g2.filter = 'none';
    fuenteC = c2;
  }
  const gm = fuenteC.getContext('2d')!;
  gm.setTransform(1, 0, 0, 1, 0, 0);
  // sin sombra: con destination-in, la sombra del rectángulo de la máscara también recorta (dejaba los dígitos grises)
  gm.shadowColor = 'rgba(0,0,0,0)'; gm.shadowBlur = 0; gm.shadowOffsetY = 0;
  gm.globalCompositeOperation = 'destination-in';
  const m = gm.createLinearGradient(0, 0, 0, fuenteC.height);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.17, '#000'); m.addColorStop(0.83, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
  gm.fillStyle = m; gm.fillRect(0, 0, fuenteC.width, fuenteC.height);
  gm.globalCompositeOperation = 'source-over';
  g.save();
  g.globalAlpha = alfa;
  g.drawImage(fuenteC, vx, arriba, vw, vh);
  g.restore();
}

/* el chip de abajo («en 30 días»): entra con resorte, girando, con su barrido de luz */
function chip(g: CanvasRenderingContext2D, e: Estado, texto: string) {
  const {t, pal, T, tc} = e;
  const pil = sp(t, tc + 1.25, RESORTES.pop);
  const op = clamp(pil * 2);
  if (op <= 0.001 || Math.abs(pil) < 0.001) return;
  const fuente = `800 42px ${comillas(OUTFIT)}`;
  g.font = fuente; (g as any).letterSpacing = '0px';
  const tw = g.measureText(texto).width;
  const {asc, desc} = metricas(g, fuente);
  const cw = tw + 60, ch = asc + desc + 22, m = 50;
  const k = escalaDe(g);
  const c = L('chip');
  const gc = preparar(c, (cw + 2 * m) * k, (ch + 2 * m) * k);
  gc.setTransform(k, 0, 0, k, m * k, m * k);
  sombra(gc, k, 0, 0, cw, ch, 99, 10, 30, -8, pal.a(0.65 * clamp(pil)));
  redondeado(gc, 0, 0, cw, ch, 99);
  const bg = gc.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, pal.claro); bg.addColorStop(1, pal.acento);
  gc.fillStyle = bg; gc.fill();
  bordeInterior(gc, 0, 0, cw, ch, 99, 2, 0, 'rgba(255,255,255,.35)');
  gc.save();
  redondeado(gc, 0, 0, cw, ch, 99); gc.clip();
  gc.font = fuente; gc.fillStyle = pal.sobre; gc.textBaseline = 'alphabetic'; gc.textAlign = 'left';
  gc.fillText(texto, 30, 10 + asc);
  barrido(gc, rampa(t, tc + 1.65, tc + 1.65 + 0.73, EASE.inOut), 320, 70, 2.2);
  gc.restore();
  g.save();
  g.globalAlpha = op;
  g.translate(T.w / 2, 334 + ch / 2);
  g.translate(0, (1 - pil) * 30); g.scale(pil, pil); g.rotate(((1 - pil) * -12 * Math.PI) / 180);
  g.drawImage(c, -cw / 2 - m, -ch / 2 - m, cw + 2 * m, ch + 2 * m);
  g.restore();
}

/* las chispas (Chispas + Particulas de Piezas), en px del dibujo */
function chispas(g: CanvasRenderingContext2D, pal: Paleta, tt: number, t0: number, x: number, y: number, n: number, semilla: string, fuerza: number) {
  const t = tt - t0;
  if (t < 0 || t > 1.6) return false;
  const colores = [pal.tinta, pal.acento, pal.claro, pal.tinta];
  for (let i = 0; i < n; i++) {
    const r = (q: string) => random(`${semilla}-${q}-${i}`);
    const ang = r('a') * Math.PI * 2;
    const vel = fuerza * (0.3 + 0.7 * r('v'));
    const arrastre = 3.3;
    const donde = (u: number) => {
      const kk = (1 - Math.exp(-arrastre * u)) / arrastre;
      return [x + Math.cos(ang) * vel * kk + noise2D(`${semilla}${i}`, u * 1.6, 0) * 12, y + Math.sin(ang) * vel * kk * 0.9 + 300 * u * u];
    };
    const [px, py] = donde(t);
    const [qx, qy] = donde(Math.max(0, t - 0.045));
    const vida = 0.6 + 0.6 * r('l');
    const u = t / vida;
    if (u >= 1) continue;
    const op = interpolate(u, [0, 0.05, 0.55, 1], [0, 1, 0.9, 0]);
    const tam = 12 + 26 * r('s');
    const esc = interpolate(u, [0, 0.1, 1], [0.3, 1, 0.3]);
    const color = colores[Math.floor(r('c') * colores.length)];
    g.globalAlpha = op * 0.55; g.strokeStyle = color; g.lineCap = 'round'; g.lineWidth = Math.max(1, tam * 0.2 * esc);
    g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke();
    g.globalAlpha = op; g.fillStyle = color;
    if (i % 3 === 0) {
      g.beginPath(); g.arc(px, py, Math.max(0.1, tam * 0.17 * esc), 0, Math.PI * 2); g.fill();
    } else {
      const rot = (r('r') - 0.5) * 520 * t;
      g.save();
      g.translate(px, py); g.rotate((rot * Math.PI) / 180); g.scale(esc, esc); g.translate(-tam / 2, -tam / 2);
      g.fill(new Path2D(makeSpark({width: tam, height: tam}).path));
      g.restore();
    }
  }
  g.globalAlpha = 1;
  return true;
}

/* ── un cuadro entero ── */
function pintar(c: HTMLCanvasElement, yo: Mio, e: Estado) {
  const {t, T, ENTRA, SALE, LLEGA, inicio, fps, pal} = e;
  // los px reales: en la nube, los de la capa; en el celular, los que de verdad se ven (no tiene sentido pintar 1080)
  let k = e.kFijo;
  if (e.vista) {
    if (!yo.k || ++yo.veces % 45 === 0) {
      const rc = c.getBoundingClientRect();
      if (rc.width > 0) yo.k = clamp((rc.width * (window.devicePixelRatio || 1)) / 1080, 0.25, e.kFijo);
    }
    k = yo.k || e.kFijo;
  }
  const Pw = Math.max(2, Math.round(1080 * k)), Ph = Math.max(2, Math.round(e.Dh * k));
  const out = preparar(c, Pw, Ph);
  const w = T.w, h = T.h, r = T.r;
  const pose = poseTarjeta(t, ENTRA, SALE, SEMILLA);
  const tarjeta = !(t < ENTRA - 0.03 || pose.x >= 1);

  if (tarjeta) {
    // la placa: sombra + tinte, una sola vez por tamaño
    const pv = `${w}|${h}|${r}|${k.toFixed(4)}`;
    const placaL = yo.placa || (yo.placa = lienzo());
    if (yo.placaV !== pv) {
      const gp = preparar(placaL, (w + 2 * MP) * k, (h + 2 * MP) * k);
      gp.setTransform(k, 0, 0, k, MP * k, MP * k);
      sombra(gp, k, 0, 0, w, h, r, 22, 44, -22, 'rgba(0,0,0,.6)');
      sombra(gp, k, 0, 0, w, h, r, 60, 110, -38, 'rgba(0,0,0,.92)');
      redondeado(gp, 0, 0, w, h, r); gp.fillStyle = 'rgba(10,7,9,.30)'; gp.fill();
      yo.placaV = pv;
    }
    const placaOp = clamp(pose.e) ** 2.2 * (1 - pose.x);

    // la cara
    const cc = L('cara');
    const gc = preparar(cc, (w + 2 * MC) * k, (h + 2 * MC) * k);
    gc.setTransform(k, 0, 0, k, MC * k, MC * k);
    cara(gc, e);
    let caraF = cc;
    if (pose.x > 0.02) {
      const cb = L('borrosa');
      const gb = preparar(cb, cc.width, cc.height);
      gb.filter = `blur(${(pose.x * 14 * k).toFixed(2)}px)`;
      gb.drawImage(cc, 0, 0);
      gb.filter = 'none';
      caraF = cb;
    }

    // en 3D: el origen es el 50 % 60 % de la tarjeta (transform-origin del CSS)
    const ox = w * 0.5, oy = h * 0.6, OX = T.x + ox, OY = T.y + oy;
    const muestras: {c: any; alfa: number}[] = [];
    if (t >= ENTRA && t <= ENTRA + 0.6) {
      // el desenfoque de movimiento de CameraMotionBlur (Desenfoque: 10 muestras × 0,5 = 5, obturador 210°)
      const f = Math.round((t - inicio) * fps);
      const sf = 210 / 360, S = 5, maxOff = sf * S;
      const n = Math.max(1, Math.round(Math.min(clamp((f - maxOff) / maxOff + 1) * S, S)));
      for (let i = 1; i <= n; i++) {
        const ps = poseTarjeta(inicio + (f - sf * (i / n) + 1) / fps, ENTRA, SALE, SEMILLA);
        muestras.push({c: esquinasDe(-MC, -MC, w + MC, h + MC, ox, oy, OX, OY, ps.n), alfa: ps.op / n});
      }
    } else muestras.push({c: esquinasDe(-MC, -MC, w + MC, h + MC, ox, oy, OX, OY, pose.n), alfa: pose.op});
    const placaC = esquinasDe(-MP, -MP, w + MP, h + MP, ox, oy, OX, OY, pose.n);

    const P = elProyector();
    if (P && P.empezar(Pw, Ph, 1080, e.Dh)) {
      P.placa(caraF, '', muestras, 'suma');
      P.placa(placaL, yo.placaV, [{c: placaC, alfa: placaOp}], 'detras');
      out.drawImage(P.lienzo, 0, 0);
    } else {
      // sin WebGL (no debería pasar): plana, sin el giro
      const plano = (src: HTMLCanvasElement, m: number, alfa: number) => {
        out.save();
        out.globalAlpha = alfa;
        out.setTransform(k * pose.n.sc, 0, 0, k * pose.n.sc, k * (OX + pose.n.fx - ox * pose.n.sc), k * (OY + pose.n.ty - oy * pose.n.sc));
        out.drawImage(src, -m, -m, w + 2 * m, h + 2 * m);
        out.restore();
      };
      plano(placaL, MP, placaOp);
      plano(caraF, MC, pose.op);
    }
  }

  // las chispas, encima de todo (sin 3D), con su resplandor (drop-shadow 0 0 7px)
  const d = e.p.datos || {};
  const texto = (d.prefijo || '') + GRAF.cifra(d.valor, d.decimales) + (d.sufijo || '');
  const tam = tamPara(texto, 800, 200, 0.6);
  if (t >= LLEGA && t <= LLEGA + 1.6) {
    const ch = L('chispas');
    const gch = preparar(ch, Pw, Ph);
    gch.setTransform(k, 0, 0, k, 0, 0);
    if (chispas(gch, pal, t, LLEGA, 540, T.y + 92 + (200 - tam) * 0.6 + tam * 0.6, 26, SEMILLA, 1050)) {
      out.save();
      out.filter = `drop-shadow(0 0 ${(7 * k).toFixed(2)}px ${pal.a(0.7)})`;
      out.drawImage(ch, 0, 0);
      out.restore();
    }
  }
}

export const NumeroGL: React.FC = () => {
  const t = useT();
  const {p, pal, vista, W, H, esc, inicio, fps, dibujo} = useG();
  const d = p.datos || {};
  const tc = p.marcas[0];
  const conChip = !!d.chip;
  const T = {x: 86, y: 150, w: 908, h: conChip ? 420 : 340, r: 54};
  const ENTRA = p.t0, SALE = p.t1 - 0.5, LLEGA = tc + 1.35;
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;

  const curva = useMemo(() => curvaDe(T.w, T.h), [T.w, T.h]);
  const geo = useMemo(() => {
    const largo = getLength(curva);
    let arriba = T.h;
    for (let i = 0; i <= 64; i++) arriba = Math.min(arriba, (getPointAtLength(curva, (largo * i) / 64) || {y: T.h}).y);
    return {largo, arriba, curvaP: new Path2D(curva), areaP: new Path2D(`${curva} L ${T.w - 46} ${T.h} L 46 ${T.h} Z`)};
  }, [curva, T.w, T.h]);

  const ref = useRef<HTMLCanvasElement>(null);
  const yo = useRef<Mio>({k: 0, veces: 0, placa: null, placaV: ''});

  // el vidrio (lo de atrás desenfocado): en el celular lo pinta la página (js/vidriogl.js); en la nube, el ensamblador
  const pose = poseTarjeta(t, ENTRA, SALE, SEMILLA);
  const tarjeta = !(t < ENTRA - 0.03 || pose.x >= 1);
  const placaOp = clamp(pose.e) ** 2.2 * (1 - pose.x);
  const vg = vista && (p.forma === 'encima' || p.forma === 'profundo') ? vidrioGL() : null;
  if (vg && tarjeta) {
    try {
      vg.poner({k: p.tipo + '@' + (p as any).desde + '#' + SEMILLA, pieza: p.tipo + '@' + (p as any).desde, t, o: [T.x + T.w * 0.5, T.y + T.h * 0.6],
        c: [[0, 0], [T.w, 0], [T.w, T.h], [0, T.h]].map(([px, py]) => proyectar(px, py, T.w * 0.5, T.h * 0.6, pose.n)),
        w: T.w, h: T.h, r: T.r, op: placaOp, Dw: 1080, Dh});
    } catch (_) { /* sin vidrio esta vez */ }
  }

  const estado: Estado = {t, p, pal, vista, inicio, fps, kFijo: dibujo || esc, Dh, T, ENTRA, SALE, LLEGA, tc, curva, ...geo};
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const lista = fuentes(conChip);
    if (!listas(lista)) {
      // las letras todavía no llegan: se espera (en la nube el cuadro no se toma hasta que estén) y se vuelve a pintar
      const h = delayRender('Letras del Número gigante');
      Promise.all(lista.map((f) => document.fonts.load(f))).catch(() => null).then(() => {
        if (ref.current) pintar(ref.current, yo.current, estado);
        continueRender(h);
      });
    }
    pintar(c, yo.current, estado);
  });
  useEffect(() => () => {
    const P = elProyector();
    if (P && yo.current.placa) P.soltar(yo.current.placa);
  }, []);

  return (
    <>
      {vista && !vg && tarjeta ? (
        // sin el vidrio de la página: el desenfoque de lo de atrás con CSS, como siempre (solo eso; el resto va en el lienzo)
        <div style={{position: 'absolute', left: T.x, top: T.y, width: T.w, height: T.h, borderRadius: T.r, transform: pose.transform, transformOrigin: '50% 60%',
          opacity: placaOp, backdropFilter: 'blur(24.5px) saturate(1.4) brightness(.9)', WebkitBackdropFilter: 'blur(24.5px) saturate(1.4) brightness(.9)'}} />
      ) : null}
      <canvas ref={ref} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Dh}} />
    </>
  );
};

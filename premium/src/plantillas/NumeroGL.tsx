// Número gigante EN LIENZO (8-oct-2026). El MISMO gráfico de Numero.tsx (mismos tiempos, medidas, colores y movimientos),
// dibujado en lienzos en vez de una página web:
//   · la cara de la tarjeta se arma con capas guardadas: el fondo y los bordes se pintan UNA vez; lo que se mueve (curva,
//     resplandor, etiqueta, cifra en tambores, chip) solo se repinta cuando cambia de verdad; encima, el punto que late,
//     el cursor y el barrido de luz;
//   · la cifra se pinta sin sombra y lleva UNA sola sombra al final (antes: una por letra y por dígito del tambor);
//   · en el CELULAR (vista) la inclinación en 3D, el desenfoque de movimiento, el desenfoque de salida y el brillo de las
//     chispas los hace el navegador por su lado (transform / filter / mix-blend en CSS, como la tarjeta de siempre): el
//     hilo de la página no hace esas cuentas y el video y el audio no se traban (8-oct: con todo en WebGL se trababa);
//   · en la NUBE y al fabricar en el navegador (sin 3D en CSS) lo pone en 3D el proyector WebGL (lib/lienzo.ts) con la
//     misma cuenta del CSS: lo que se ve es lo que sale.
import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {continueRender, delayRender, interpolate, random} from 'remotion';
import {getLength, getPointAtLength} from '@remotion/paths';
import {createNoise2D} from 'simplex-noise';
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
const MEDIR = (() => { let g: CanvasRenderingContext2D | null = null; return () => g || (g = lienzo(4, 4).getContext('2d')!); })();
const escalaDe = (g: CanvasRenderingContext2D) => { const m = g.getTransform(); return Math.hypot(m.a, m.b) || 1; };
const comillas = (f: string) => (/^["']/.test(f) ? f : `"${f}"`);
/* ¿llegaron las letras? Se busca cada cara (familia + peso) YA cargada. (document.fonts.check dice «sí» cuando la cara
   todavía no está registrada, y lo pintado con la letra de reemplazo quedaba guardado) */
const familia = (f: string) => f.replace(/["']/g, '').split(',')[0].trim();
const LETRAS: [string, string][] = [[familia(OUTFIT), '900'], [familia(MONO), '500'], [familia(OUTFIT), '800']];
let letrasYa = false;
const listas = () => {
  if (letrasYa || typeof document === 'undefined' || !document.fonts) return true;
  const hay = (fam: string, peso: string) => {
    let ok = false;
    document.fonts.forEach((f) => { if (!ok && f.family.replace(/["']/g, '') === fam && String(f.weight) === peso && f.status === 'loaded') ok = true; });
    return ok;
  };
  letrasYa = LETRAS.every(([fam, peso]) => hay(fam, peso));
  return letrasYa;
};
/* espera a que lleguen (máximo 15 s) */
const esperarLetras = (listo: () => void) => {
  const t0 = Date.now();
  const mirar = () => { if (listas() || Date.now() - t0 > 15000) listo(); else setTimeout(mirar, 50); };
  try { LETRAS.forEach(([fam, peso]) => { document.fonts.load(`${peso} 40px "${fam}"`).catch(() => null); }); } catch (_) { /* nada */ }
  mirar();
};
/* el mismo ruido de @remotion/noise › noise2D (createNoise2D(() => random(semilla))), pero guardando TODAS las semillas:
   aquel guarda solo 10 y las chispas usan 26, así que lo rehacía todo en cada cuadro (≈ 13 ms por cuadro, medido) */
const RUIDOS = new Map<string, (x: number, y: number) => number>();
const ruido2D = (semilla: string, x: number, y: number) => {
  let f = RUIDOS.get(semilla);
  if (!f) { f = createNoise2D(() => random(semilla)); RUIDOS.set(semilla, f); }
  return f(x, y);
};

type C = HTMLCanvasElement;
type Estado = {
  t: number; p: any; pal: Paleta; vista: boolean; inicio: number; fps: number; kFijo: number; Dh: number;
  T: {x: number; y: number; w: number; h: number; r: number}; ENTRA: number; SALE: number; LLEGA: number; tc: number;
  curva: string; curvaP: Path2D; areaP: Path2D; largo: number; arriba: number;
};
// lienzos guardados de ESTE gráfico
type Mio = {k: number; lienzos: Record<string, C>; claves: Record<string, string>; filas: {clave: string; et: FilaEtq | null; ci: FilaCifra} | null};
const L = (yo: Mio, n: string) => yo.lienzos[n] || (yo.lienzos[n] = lienzo());

/* ── lo que se mueve, calculado una vez por cuadro ── */
type FilaEtq = {texto: string; t0: number; paso: number; x0: number; cy: number; base: number};
type FilaCifra = {texto: string; tam: number; fuente: string; ls: number; linea: number; arriba: number; base: number; chars: string[]; anchos: number[]; x0: number; maxCelda: number};
type Vivo = {
  pc: number; bloom: number;
  et: FilaEtq | null; etA: number; etLatido: number; etN: number; etCursor: boolean;
  ci: FilaCifra; s: number; alfa: number; sl: number; pos: number[]; borroso: number[];
  pil: number; pChip: number; pb: number;
};

function filaEtiqueta(e: Estado): FilaEtq | null {
  const texto = String((e.p.datos || {}).etiqueta || '').toUpperCase();
  if (!texto) return null;
  const g = MEDIR();
  const fuente = `500 27px ${comillas(MONO)}`;
  g.font = fuente; (g as any).letterSpacing = '0px';
  const paso = g.measureText('M').width + 0.16 * 27;
  const {asc, desc} = metricas(g, fuente, listas());
  const lh = asc + desc, alto = Math.max(13, lh);
  return {texto, t0: e.ENTRA + 0.13, paso, x0: (e.T.w - (13 + 16 + texto.length * paso)) / 2, cy: 40 + alto / 2, base: 40 + (alto - lh) / 2 + asc};
}
function filaCifra(e: Estado): FilaCifra {
  const d = e.p.datos || {};
  const texto = (d.prefijo || '') + GRAF.cifra(d.valor, d.decimales) + (d.sufijo || '');
  const tam = tamPara(texto, 800, 200, 0.6);
  const fuente = `900 ${tam}px ${comillas(OUTFIT)}`;
  const g = MEDIR();
  g.font = fuente; (g as any).letterSpacing = '0px';
  const ls = -0.045 * tam;
  const {asc, desc} = metricas(g, fuente, listas());
  const hl = (1.2 * tam - (asc + desc)) / 2;
  const arriba = 92 + (200 - tam) * 0.6;
  const chars = texto.split('');
  const anchos = chars.map((ch: string) => g.measureText(ch).width + ls);
  let maxCelda = 0;
  for (let i = 0; i <= 9; i++) maxCelda = Math.max(maxCelda, g.measureText(String(i)).width + ls);
  return {texto, tam, fuente, ls, linea: hl + asc, arriba, base: arriba + hl + asc, chars, anchos,
    x0: (e.T.w - anchos.reduce((a: number, b: number) => a + b, 0)) / 2, maxCelda};
}
/* las medidas de las letras solo cambian si cambia el texto o llegan las letras */
function filas(yo: Mio, e: Estado) {
  const d = e.p.datos || {};
  const clave = [d.etiqueta, d.prefijo, d.valor, d.decimales, d.sufijo, e.ENTRA, listas()].join('|');
  if (!yo.filas || yo.filas.clave !== clave) yo.filas = {clave, et: filaEtiqueta(e), ci: filaCifra(e)};
  return yo.filas;
}
function vivo(yo: Mio, e: Estado): Vivo {
  const {t, tc, LLEGA} = e;
  const pc = rampa(t, tc, LLEGA + 0.13, EASE.llega);
  const bloom = t < LLEGA - 0.13 ? 0 : rampa(t, LLEGA - 0.13, LLEGA + 0.1) * (1 - 0.6 * rampa(t, LLEGA + 0.1, LLEGA + 1.33));
  const {et, ci} = filas(yo, e);
  let etA = 0, etLatido = 0, etN = 0, etCursor = false;
  if (et) {
    etA = sp(t, et.t0, RESORTES.pop);
    etLatido = 0.5 + 0.5 * Math.sin(((t - et.t0) * 30) / 4.5);
    const f = (t - (et.t0 + 2 / 30)) * 30;
    etN = clamp(Math.floor(f * 1.4), 0, et.texto.length);
    etCursor = f >= -3 && f < et.texto.length / 1.4 + 7 && (etN < et.texto.length || Math.floor((t * 30) / 4) % 2 === 0);
  }
  const s = sp(t, tc - 0.05, RESORTES.pop);
  const digitos = ci.chars.filter((c) => /\d/.test(c)).length;
  const pos: number[] = [], borroso: number[] = [];
  let j = 0;
  ci.chars.forEach((ch) => {
    if (!/\d/.test(ch)) return;
    const kd = j++;
    const vueltas = digitos <= 1 ? 1 : Math.min(2, Math.round((kd / Math.max(1, digitos - 1)) * 2));
    const total = vueltas * 10 + Number(ch);
    const dur = 1.15 + kd * 0.1;
    const ps = giro(t, tc, dur, total);
    pos.push(ps);
    // el desenfoque del giro rápido, en pasos de medio px (cada tamaño distinto de desenfoque le cuesta a la tarjeta gráfica)
    const b = Math.min(7, Math.abs(ps - giro(t - 1 / 30, tc, dur, total)) * 5);
    borroso.push(b > 0.4 ? Math.round(b * 2) / 2 : 0);
  });
  const pil = (e.p.datos || {}).chip ? sp(t, tc + 1.25, RESORTES.pop) : 0;
  return {pc, bloom, et, etA, etLatido, etN, etCursor, ci, s, alfa: clamp(s * 1.6), sl: 1 + 0.05 * golpe(t, LLEGA, 5, 2.4), pos, borroso,
    pil, pChip: rampa(t, tc + 1.65, tc + 1.65 + 0.73, EASE.inOut), pb: rampa(t, LLEGA + 0.4, LLEGA + 0.4 + 0.93, EASE.inOut)};
}
const firma = (v: Vivo) => [v.pc, v.bloom, v.etN, v.s, v.sl, v.pil, v.pChip, ...v.pos, ...v.borroso].map((x) => Math.round(x * 1000)).join(',');

/* ── capas de la cara (en px del dibujo, origen en la esquina de la tarjeta; k = px reales por px del dibujo) ── */
const enCara = (g: CanvasRenderingContext2D, k: number) => g.setTransform(k, 0, 0, k, MC * k, MC * k);

/* el fondo (degradados + grano) y los bordes de luz: no cambian, se pintan una vez */
function fondoYBordes(yo: Mio, e: Estado, k: number) {
  const {pal, T} = e;
  const w = T.w, h = T.h, r = T.r;
  const clave = `${w}|${h}|${k}|${pal.acento}`;
  if (yo.claves.fondo === clave) return;
  const gf = preparar(L(yo, 'fondo'), (w + 2 * MC) * k, (h + 2 * MC) * k);
  enCara(gf, k);
  redondeado(gf, 0, 0, w, h, r); gf.clip();
  const lin = gf.createLinearGradient(0, 0, 0, h);
  lin.addColorStop(0, 'rgba(42,32,38,.50)'); lin.addColorStop(1, 'rgba(16,11,14,.64)');
  gf.fillStyle = lin; gf.fillRect(0, 0, w, h);
  elipse(gf, 0, 0, w, h, 0.12 * w, -0.28 * h, 1.2 * w, 0.7 * h, [[0, 'rgba(255,255,255,.11)'], [0.6, 'rgba(255,255,255,0)']]);
  elipse(gf, 0, 0, w, h, w, 1.18 * h, 0.7 * w, 0.9 * h, [[0, pal.a(0.17)], [0.62, pal.a(0)]]);
  gf.globalCompositeOperation = 'overlay'; gf.globalAlpha = 0.07;
  gf.fillStyle = gf.createPattern(grano(), 'repeat')!; gf.fillRect(0, 0, w, h);
  const gb = preparar(L(yo, 'bordes'), (w + 2 * MC) * k, (h + 2 * MC) * k);
  enCara(gb, k);
  bordeInterior(gb, 0, 0, w, h, r, -1, 0, 'rgba(255,255,255,.04)');
  bordeInterior(gb, 0, 0, w, h, r, 0, 1.5, 'rgba(255,255,255,.10)');
  bordeInterior(gb, 0, 0, w, h, r, 2, 0, 'rgba(255,255,255,.15)');
  yo.claves.fondo = clave;
}

/* lo que se mueve dentro de la tarjeta: solo se repinta si cambió */
function contenido(yo: Mio, e: Estado, k: number, v: Vivo) {
  const {pal, T} = e;
  const w = T.w, h = T.h;
  const clave = `${k}|${pal.acento}|${listas()}|${firma(v)}`;
  if (yo.claves.contenido === clave) return;
  const g = preparar(L(yo, 'contenido'), (w + 2 * MC) * k, (h + 2 * MC) * k);
  enCara(g, k);

  // la curva que crece: el área (opacidad .6, se descubre de izquierda a derecha) y la línea con su punta (opacidad .62)
  if (v.pc > 0) {
    g.save();
    g.beginPath(); g.rect(0, 0, v.pc * w, h); g.clip();
    g.globalAlpha = 0.6;
    const ga = g.createLinearGradient(0, e.arriba, 0, h);
    ga.addColorStop(0, pal.a(0.22)); ga.addColorStop(1, pal.a(0));
    g.fillStyle = ga; g.fill(e.areaP);
    g.restore();
    const lc = L(yo, 'linea');
    const gl = preparar(lc, (w + 2 * MC) * k, (h + 2 * MC) * k);
    enCara(gl, k);
    const gr = gl.createLinearGradient(46, 0, w - 46, 0);
    gr.addColorStop(0, pal.a(0.1)); gr.addColorStop(1, pal.claro);
    gl.strokeStyle = gr; gl.lineWidth = 5; gl.lineCap = 'round';
    if (v.pc < 1) gl.setLineDash([e.largo * v.pc, e.largo * 2]);
    gl.stroke(e.curvaP);
    gl.setLineDash([]);
    if (v.pc > 0.01) {
      const q = getPointAtLength(e.curva, Math.max(0.01, e.largo * v.pc));
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
  if (v.bloom > 0.001) {
    const s = 0.7 + 0.3 * clamp(v.bloom * 1.5);
    g.save();
    g.globalAlpha = v.bloom;
    elipse(g, w / 2 - 330 * s, 220 - 130 * s, 660 * s, 260 * s, 330 * s, 130 * s, 330 * s, 130 * s, [[0, pal.a(0.42)], [1, pal.a(0)]]);
    g.restore();
  }

  // la etiqueta que se escribe (el punto que late y el cursor van encima, en cada cuadro)
  if (v.et && v.etN > 0) {
    g.font = `500 27px ${comillas(MONO)}`; (g as any).letterSpacing = '0px';
    g.fillStyle = pal.tinta2; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    for (let i = 0; i < v.etN; i++) g.fillText(v.et.texto[i], v.et.x0 + 29 + i * v.et.paso, v.et.base);
  }

  if (v.alfa > 0.001) cifra(yo, g, e, k, v);
  if (v.pil && Math.abs(v.pil) >= 0.001 && clamp(v.pil * 2) > 0.001) chip(yo, g, e, k, v);
  yo.claves.contenido = clave;
}

/* la cifra: los tambores y los signos en una capa SIN sombra; la capa entra con UNA sombra (0 12px 34px rgba(0,0,0,.45)),
   la opacidad y el latido */
function cifra(yo: Mio, g: CanvasRenderingContext2D, e: Estado, k: number, v: Vivo) {
  const {pal, T} = e;
  const f = v.ci;
  const MX = 30, MY = 0.12 * f.tam, alto = 1.2 * f.tam;
  const capa = L(yo, 'cifra');
  const gc = preparar(capa, (T.w + 2 * MX) * k, (alto + 2 * MY) * k);
  gc.setTransform(k, 0, 0, k, MX * k, (MY - f.arriba) * k);
  gc.font = f.fuente; (gc as any).letterSpacing = '0px';
  gc.fillStyle = pal.tinta; gc.textBaseline = 'alphabetic'; gc.textAlign = 'left';
  let x = f.x0, j = 0;
  f.chars.forEach((ch, i) => {
    const cw = f.anchos[i];
    if (/\d/.test(ch)) {
      tambor(yo, gc, pal, f, k, x, cw, v.pos[j], v.borroso[j]);
      j++;
    } else {
      const sc = 0.6 + 0.4 * v.s;
      const cx = x + cw / 2, cy = f.arriba + 0.6 * f.tam;
      gc.save();
      gc.translate(cx, cy); gc.scale(sc, sc); gc.translate(-cx, -cy);
      gc.fillText(ch, x, f.base);
      gc.restore();
    }
    x += cw;
  });
  g.save();
  g.globalAlpha = v.alfa;
  const cx = T.w / 2, cy = f.arriba + 0.6 * f.tam;
  g.translate(cx, cy); g.scale(v.sl, v.sl); g.translate(-cx, -cy);
  const kk = escalaDe(g);
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 34 * kk; g.shadowOffsetY = 12 * kk;
  g.drawImage(capa, -MX, f.arriba - MY, T.w + 2 * MX, alto + 2 * MY);
  g.restore();
}

/* un tambor: la ventana (1,8 veces el ancho del dígito, el alto de la línea) con los dígitos que ruedan, desenfocada si gira
   rápido y desvanecida arriba y abajo (máscara 0 → 17 % → 83 % → 100 %). Los dígitos salen de una TIRA pintada una sola
   vez (9, 0, 1 … 9, 0, 1, 2 uno debajo del otro): cada cuadro es copiar un pedazo de la tira, no escribir 4 letras. */
function tira(yo: Mio, pal: Paleta, f: FilaCifra, k: number, vw: number) {
  const vh = 1.2 * f.tam;
  const nombre = 'tira' + vw.toFixed(2);
  const c = L(yo, nombre);
  const clave = `${f.fuente}|${k}|${pal.tinta}|${f.linea}|${listas()}`;
  if (yo.claves[nombre] !== clave) {
    const g = preparar(c, vw * k, 13 * vh * k);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.font = f.fuente; (g as any).letterSpacing = '0px';
    g.fillStyle = pal.tinta; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    for (let i = 0; i < 13; i++) {
      const dg = String((i + 9) % 10);
      g.fillText(dg, (vw - (g.measureText(dg).width + f.ls)) / 2, f.linea + i * vh);
    }
    yo.claves[nombre] = clave;
  }
  return c;
}
function tambor(yo: Mio, gc: CanvasRenderingContext2D, pal: Paleta, f: FilaCifra, k: number, x: number, cw: number, pos: number, borroso: number) {
  const vw = 1.8 * cw, vh = 1.2 * f.tam, vx = x - 0.4 * cw;
  const Wm = 1.8 * f.maxCelda * k, Hm = vh * k, pw = vw * k, ph = vh * k;
  const b = Math.floor(pos), frac = pos - b;
  const t = tira(yo, pal, f, k, vw);
  // el dígito b está en la fila (b mod 10) + 1 de la tira; la ventana empieza frac de fila más abajo
  const y0 = ((((b % 10) + 10) % 10) + 1 + frac) * ph;
  const c1 = L(yo, 'tambor');
  const g1 = preparar(c1, Wm, Hm);
  if (borroso > 0) g1.filter = `blur(${(borroso * k).toFixed(2)}px)`;
  g1.drawImage(t, 0, y0, pw, ph, 0, 0, pw, ph);
  g1.filter = 'none';
  g1.globalCompositeOperation = 'destination-in';
  const m = g1.createLinearGradient(0, 0, 0, ph);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.17, '#000'); m.addColorStop(0.83, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g1.fillStyle = m; g1.fillRect(0, 0, pw, ph);
  g1.globalCompositeOperation = 'source-over';
  gc.drawImage(c1, 0, 0, pw, ph, vx, f.arriba, vw, vh);
}

/* el chip de abajo («en 30 días»): el chip y su sombra se pintan una vez; entra con resorte, girando, con su barrido */
function chip(yo: Mio, g: CanvasRenderingContext2D, e: Estado, k: number, v: Vivo) {
  const {pal, T} = e;
  const texto = String((e.p.datos || {}).chip);
  const fuente = `800 42px ${comillas(OUTFIT)}`;
  const gm = MEDIR();
  gm.font = fuente; (gm as any).letterSpacing = '0px';
  const tw = gm.measureText(texto).width;
  const {asc, desc} = metricas(gm, fuente, listas());
  const cw = tw + 60, ch = asc + desc + 22, m = 50;
  const clave = `${texto}|${k}|${pal.acento}|${cw}|${ch}|${listas()}`;
  if (yo.claves.chip !== clave) {
    const gs = preparar(L(yo, 'chipSombra'), (cw + 2 * m) * k, (ch + 2 * m) * k);
    gs.setTransform(k, 0, 0, k, m * k, m * k);
    sombra(gs, k, 0, 0, cw, ch, 99, 10, 30, -8, pal.a(0.65));
    const gp = preparar(L(yo, 'chip'), (cw + 2 * m) * k, (ch + 2 * m) * k);
    gp.setTransform(k, 0, 0, k, m * k, m * k);
    redondeado(gp, 0, 0, cw, ch, 99);
    const bg = gp.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, pal.claro); bg.addColorStop(1, pal.acento);
    gp.fillStyle = bg; gp.fill();
    bordeInterior(gp, 0, 0, cw, ch, 99, 2, 0, 'rgba(255,255,255,.35)');
    gp.font = fuente; gp.fillStyle = pal.sobre; gp.textBaseline = 'alphabetic'; gp.textAlign = 'left';
    gp.fillText(texto, 30, 10 + asc);
    yo.claves.chip = clave;
  }
  const pil = v.pil, op = clamp(pil * 2);
  g.save();
  g.translate(T.w / 2, 334 + ch / 2);
  g.translate(0, (1 - pil) * 30); g.scale(pil, pil); g.rotate(((1 - pil) * -12 * Math.PI) / 180);
  g.translate(-cw / 2, -ch / 2);
  g.globalAlpha = op * clamp(pil);
  g.drawImage(L(yo, 'chipSombra'), -m, -m, cw + 2 * m, ch + 2 * m);
  g.globalAlpha = op;
  g.drawImage(L(yo, 'chip'), -m, -m, cw + 2 * m, ch + 2 * m);
  if (v.pChip > 0 && v.pChip < 1) {
    redondeado(g, 0, 0, cw, ch, 99); g.clip();
    barrido(g, v.pChip, 320, 70, 2.2);
  }
  g.restore();
}

/* la cara del cuadro: fondo + lo que se mueve + bordes + barrido + el punto que late y el cursor */
function cara(yo: Mio, destino: C, e: Estado, k: number, v: Vivo) {
  const {pal, T} = e;
  const w = T.w, h = T.h, r = T.r;
  fondoYBordes(yo, e, k);
  contenido(yo, e, k, v);
  const g = preparar(destino, (w + 2 * MC) * k, (h + 2 * MC) * k);
  g.drawImage(L(yo, 'fondo'), 0, 0);
  g.drawImage(L(yo, 'contenido'), 0, 0);
  g.drawImage(L(yo, 'bordes'), 0, 0);
  enCara(g, k);
  if (v.pb > 0 && v.pb < 1) {
    g.save();
    redondeado(g, 0, 0, w, h, r); g.clip();
    barrido(g, v.pb, w, h, 1);
    g.restore();
  }
  const et = v.et;
  if (et && v.etA > 0.001) {
    // el punto: brillo 0 0 18px a(.8), el anillo 0 0 0 (4 + 6·latido)px a(.28 − .2·latido) y el punto, a escala del resorte
    g.save();
    g.translate(et.x0 + 6.5, et.cy); g.scale(v.etA, v.etA);
    const kk = escalaDe(g);
    g.save();
    g.shadowColor = pal.a(0.8); g.shadowBlur = 18 * kk; g.shadowOffsetX = 20000 * kk;
    g.beginPath(); g.arc(-20000, 0, 6.5, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill();
    g.restore();
    g.fillStyle = pal.a(0.28 - 0.2 * v.etLatido);
    g.beginPath(); g.arc(0, 0, 6.5 + 4 + 6 * v.etLatido, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal.acento;
    g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  if (et && v.etCursor) {
    redondeado(g, et.x0 + 29 + v.etN * et.paso + 0.08 * 27, et.base - 0.82 * 27, 0.5 * 27, 0.95 * 27, 3);
    g.fillStyle = pal.acento; g.fill();
  }
}

/* la placa: sombra + tinte, una vez por tamaño (la clave va en el mismo lienzo: si React lo cambia por otro, se repinta) */
function placa(yo: Mio, destino: C, cual: string, e: Estado, k: number) {
  const {T} = e;
  const clave = `${T.w}|${T.h}|${T.r}|${k}`;
  if ((destino as any).__clave === clave) return;
  (destino as any).__clave = clave;
  const gp = preparar(destino, (T.w + 2 * MP) * k, (T.h + 2 * MP) * k);
  gp.setTransform(k, 0, 0, k, MP * k, MP * k);
  sombra(gp, k, 0, 0, T.w, T.h, T.r, 22, 44, -22, 'rgba(0,0,0,.6)');
  sombra(gp, k, 0, 0, T.w, T.h, T.r, 60, 110, -38, 'rgba(0,0,0,.92)');
  redondeado(gp, 0, 0, T.w, T.h, T.r); gp.fillStyle = 'rgba(10,7,9,.30)'; gp.fill();
  yo.claves[cual] = clave;
}

/* las chispas (Chispas + Particulas de Piezas), en px del dibujo. Lo de cada chispa (ángulo, fuerza, vida, tamaño, color,
   giro, su forma) se calcula una vez; en cada cuadro solo se mueven */
type Chispa = {ang: number; vel: number; vida: number; tam: number; color: number; giro: number; forma: Path2D | null; semilla: string};
const CHISPAS = new Map<string, Chispa[]>();
const lasChispas = (semilla: string, n: number, fuerza: number) => {
  const clave = `${semilla}|${n}|${fuerza}`;
  let l = CHISPAS.get(clave);
  if (!l) {
    l = Array.from({length: n}, (_, i) => {
      const r = (q: string) => random(`${semilla}-${q}-${i}`);
      const tam = 12 + 26 * r('s');
      return {ang: r('a') * Math.PI * 2, vel: fuerza * (0.3 + 0.7 * r('v')), vida: 0.6 + 0.6 * r('l'), tam, color: Math.floor(r('c') * 4),
        giro: (r('r') - 0.5) * 520, forma: i % 3 === 0 ? null : new Path2D(makeSpark({width: tam, height: tam}).path), semilla: `${semilla}${i}`};
    });
    CHISPAS.set(clave, l);
  }
  return l;
};
function chispas(g: CanvasRenderingContext2D, pal: Paleta, tt: number, t0: number, x: number, y: number, n: number, semilla: string, fuerza: number) {
  const t = tt - t0;
  if (t < 0 || t > 1.6) return false;
  const colores = [pal.tinta, pal.acento, pal.claro, pal.tinta];
  const arrastre = 3.3;
  lasChispas(semilla, n, fuerza).forEach((c) => {
    const u = t / c.vida;
    if (u >= 1) return;
    const donde = (q: number) => {
      const kk = (1 - Math.exp(-arrastre * q)) / arrastre;
      return [x + Math.cos(c.ang) * c.vel * kk + ruido2D(c.semilla, q * 1.6, 0) * 12, y + Math.sin(c.ang) * c.vel * kk * 0.9 + 300 * q * q];
    };
    const [px, py] = donde(t);
    const [qx, qy] = donde(Math.max(0, t - 0.045));
    const op = interpolate(u, [0, 0.05, 0.55, 1], [0, 1, 0.9, 0]);
    const esc = interpolate(u, [0, 0.1, 1], [0.3, 1, 0.3]);
    const color = colores[c.color];
    g.globalAlpha = op * 0.55; g.strokeStyle = color; g.lineCap = 'round'; g.lineWidth = Math.max(1, c.tam * 0.2 * esc);
    g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke();
    g.globalAlpha = op; g.fillStyle = color;
    if (!c.forma) {
      g.beginPath(); g.arc(px, py, Math.max(0.1, c.tam * 0.17 * esc), 0, Math.PI * 2); g.fill();
    } else {
      g.save();
      g.translate(px, py); g.rotate((c.giro * t * Math.PI) / 180); g.scale(esc, esc); g.translate(-c.tam / 2, -c.tam / 2);
      g.fill(c.forma);
      g.restore();
    }
  });
  g.globalAlpha = 1;
  return true;
}
const centroChispas = (e: Estado) => {
  const d = e.p.datos || {};
  const tam = tamPara((d.prefijo || '') + GRAF.cifra(d.valor, d.decimales) + (d.sufijo || ''), 800, 200, 0.6);
  return e.T.y + 92 + (200 - tam) * 0.6 + tam * 0.6;
};

/* las muestras del desenfoque de movimiento de la entrada: las de CameraMotionBlur (Desenfoque: 10 × 0,5 = 5, obturador
   210°, adelantadas un cuadro); fuera de la entrada, una sola (la del instante) */
function muestrasDe(e: Estado) {
  const {t, ENTRA, SALE, inicio, fps} = e;
  if (t >= ENTRA && t <= ENTRA + 0.6) {
    const f = Math.round((t - inicio) * fps);
    const sf = 210 / 360, S = 5, maxOff = sf * S;
    const n = Math.max(1, Math.round(Math.min(clamp((f - maxOff) / maxOff + 1) * S, S)));
    return Array.from({length: n}, (_, i) => ({pose: poseTarjeta(inicio + (f - sf * ((i + 1) / n) + 1) / fps, ENTRA, SALE, SEMILLA), n}));
  }
  return [{pose: poseTarjeta(t, ENTRA, SALE, SEMILLA), n: 1}];
}

/* ── un cuadro en la NUBE / al fabricar: todo en un lienzo, la tarjeta en 3D con WebGL ── */
function pintarNube(c: C, yo: Mio, e: Estado) {
  const {t, T, ENTRA, SALE, LLEGA, pal} = e;
  const k = e.kFijo;
  const Pw = Math.max(2, Math.round(1080 * k)), Ph = Math.max(2, Math.round(e.Dh * k));
  const out = preparar(c, Pw, Ph);
  const w = T.w, h = T.h;
  const pose = poseTarjeta(t, ENTRA, SALE, SEMILLA);
  if (!(t < ENTRA - 0.03 || pose.x >= 1)) {
    const placaL = L(yo, 'placa');
    placa(yo, placaL, 'placa', e, k);
    const placaOp = clamp(pose.e) ** 2.2 * (1 - pose.x);
    const cc = L(yo, 'cara');
    cara(yo, cc, e, k, vivo(yo, e));
    let caraF = cc;
    if (pose.x > 0.02) {
      const cb = L(yo, 'borrosa');
      const gb = preparar(cb, cc.width, cc.height);
      gb.filter = `blur(${(pose.x * 14 * k).toFixed(2)}px)`;
      gb.drawImage(cc, 0, 0);
      gb.filter = 'none';
      caraF = cb;
    }
    const ox = w * 0.5, oy = h * 0.6, OX = T.x + ox, OY = T.y + oy;
    const muestras = muestrasDe(e).map(({pose: ps, n}) => ({c: esquinasDe(-MC, -MC, w + MC, h + MC, ox, oy, OX, OY, ps.n), alfa: ps.op / n}));
    const P = elProyector();
    if (P && P.empezar(Pw, Ph, 1080, e.Dh)) {
      P.placa(caraF, '', muestras, 'suma');
      P.placa(placaL, yo.claves.placa || '', [{c: esquinasDe(-MP, -MP, w + MP, h + MP, ox, oy, OX, OY, pose.n), alfa: placaOp}], 'detras');
      out.drawImage(P.lienzo, 0, 0);
    } else {
      // sin WebGL (no debería pasar): plana, sin el giro
      const plano = (src: C, m: number, alfa: number) => {
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
  if (t >= LLEGA && t <= LLEGA + 1.6) {
    const ch = L(yo, 'chispas');
    const gch = preparar(ch, Pw, Ph);
    gch.setTransform(k, 0, 0, k, 0, 0);
    if (chispas(gch, pal, t, LLEGA, 540, centroChispas(e), 26, SEMILLA, 1050)) {
      out.save();
      out.filter = `drop-shadow(0 0 ${(7 * k).toFixed(2)}px ${pal.a(0.7)})`;
      out.drawImage(ch, 0, 0);
      out.restore();
    }
  }
}

/* ── un cuadro en el CELULAR: los lienzos son elementos de la página; 3D, opacidades y filtros los pone el CSS ── */
function pintarVista(yo: Mio, e: Estado, placaC: C | null, caras: (C | null)[], chispasC: C | null) {
  const {t, LLEGA, pal} = e;
  if (!yo.k && chispasC) {
    // los px que de verdad se ven (una sola vez: medir en cada cuadro obliga a la página a recalcular todo)
    const rc = chispasC.getBoundingClientRect();
    if (rc.width > 0) yo.k = clamp(Math.round(((rc.width * (window.devicePixelRatio || 1)) / 1080) * 20) / 20, 0.25, e.kFijo);
  }
  const k = yo.k || e.kFijo;
  if (placaC) placa(yo, placaC, 'placaVista', e, k);
  const vivas = caras.filter(Boolean) as C[];
  if (vivas.length) {
    cara(yo, vivas[0], e, k, vivo(yo, e));
    for (let i = 1; i < vivas.length; i++) {
      const g = preparar(vivas[i], vivas[0].width, vivas[0].height);
      g.drawImage(vivas[0], 0, 0);
    }
  }
  if (chispasC) {
    const activa = t >= LLEGA && t <= LLEGA + 1.6;
    if (activa || chispasC.width > 2) {
      const g = preparar(chispasC, activa ? Math.round(1080 * k) : 2, activa ? Math.round(e.Dh * k) : 2);
      if (activa) { g.setTransform(k, 0, 0, k, 0, 0); chispas(g, pal, t, LLEGA, 540, centroChispas(e), 26, SEMILLA, 1050); }
    }
  }
}

export const NumeroGL: React.FC = () => {
  const t = useT();
  const {p, pal, vista, W, H, esc, inicio, fps, dibujo} = useG();
  const d = p.datos || {};
  const tc = p.marcas[0];
  const T = {x: 86, y: 150, w: 908, h: d.chip ? 420 : 340, r: 54};
  const ENTRA = p.t0, SALE = p.t1 - 0.5, LLEGA = tc + 1.35;
  const Dh = GRAF.cajaPremium(p, W, H).h / esc;

  const curva = useMemo(() => curvaDe(T.w, T.h), [T.w, T.h]);
  const geo = useMemo(() => {
    const largo = getLength(curva);
    let arriba = T.h;
    for (let i = 0; i <= 64; i++) arriba = Math.min(arriba, (getPointAtLength(curva, (largo * i) / 64) || {y: T.h}).y);
    return {largo, arriba, curvaP: new Path2D(curva), areaP: new Path2D(`${curva} L ${T.w - 46} ${T.h} L 46 ${T.h} Z`)};
  }, [curva, T.w, T.h]);

  const yo = useRef<Mio>({k: 0, lienzos: {}, claves: {}, filas: null});
  const nubeRef = useRef<C>(null);
  const placaRef = useRef<C>(null);
  const carasRef = useRef<(C | null)[]>([]);
  const chispasRef = useRef<C>(null);

  const pose = poseTarjeta(t, ENTRA, SALE, SEMILLA);
  const tarjeta = !(t < ENTRA - 0.03 || pose.x >= 1);
  const placaOp = clamp(pose.e) ** 2.2 * (1 - pose.x);
  // el vidrio (lo de atrás desenfocado): en el celular lo pinta la página (js/vidriogl.js); en la nube, el ensamblador
  const vg = vista && (p.forma === 'encima' || p.forma === 'profundo') ? vidrioGL() : null;
  if (vg && tarjeta) {
    try {
      vg.poner({k: p.tipo + '@' + (p as any).desde + '#' + SEMILLA, pieza: p.tipo + '@' + (p as any).desde, t, o: [T.x + T.w * 0.5, T.y + T.h * 0.6],
        c: [[0, 0], [T.w, 0], [T.w, T.h], [0, T.h]].map(([px, py]) => proyectar(px, py, T.w * 0.5, T.h * 0.6, pose.n)),
        w: T.w, h: T.h, r: T.r, op: placaOp, Dw: 1080, Dh});
    } catch (_) { /* sin vidrio esta vez */ }
  }

  const estado: Estado = {t, p, pal, vista, inicio, fps, kFijo: dibujo || esc, Dh, T, ENTRA, SALE, LLEGA, tc, curva, ...geo};
  const muestras = vista && tarjeta ? muestrasDe(estado) : [];
  const pintar = () => {
    if (vista) pintarVista(yo.current, estado, placaRef.current, carasRef.current.slice(0, muestras.length), chispasRef.current);
    else if (nubeRef.current) pintarNube(nubeRef.current, yo.current, estado);
  };
  useLayoutEffect(() => {
    if (!listas()) {
      // las letras todavía no llegan: se espera (en la nube el cuadro no se toma hasta que estén) y se vuelve a pintar
      const h = delayRender('Letras del Número gigante');
      esperarLetras(() => {
        yo.current.claves = {}; yo.current.filas = null;
        pintar();
        continueRender(h);
      });
    }
    pintar();
  });
  useEffect(() => {
    const otraVez = () => { yo.current.k = 0; };
    window.addEventListener('resize', otraVez);
    return () => {
      window.removeEventListener('resize', otraVez);
      const P = elProyector();
      if (P && yo.current.lienzos.placa) P.soltar(yo.current.lienzos.placa);
    };
  }, []);

  if (!vista) return <canvas ref={nubeRef} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Dh}} />;

  // en el celular: la placa y la cara son lienzos con el MISMO transform del CSS de la tarjeta de siempre
  const origen = (m: number) => `${m + T.w * 0.5}px ${m + T.h * 0.6}px`;
  const borrosa = pose.x > 0.02 ? `blur(${(pose.x * 14).toFixed(1)}px)` : undefined;
  return (
    <>
      {!vg && tarjeta ? (
        // sin el vidrio de la página: el desenfoque de lo de atrás con CSS, como siempre
        <div style={{position: 'absolute', left: T.x, top: T.y, width: T.w, height: T.h, borderRadius: T.r, transform: pose.transform, transformOrigin: '50% 60%',
          opacity: placaOp, backdropFilter: 'blur(24.5px) saturate(1.4) brightness(.9)', WebkitBackdropFilter: 'blur(24.5px) saturate(1.4) brightness(.9)'}} />
      ) : null}
      {tarjeta ? (
        <canvas ref={placaRef} style={{position: 'absolute', left: T.x - MP, top: T.y - MP, width: T.w + 2 * MP, height: T.h + 2 * MP,
          transform: pose.transform, transformOrigin: origen(MP), opacity: placaOp}} />
      ) : null}
      {tarjeta ? (
        <div style={{position: 'absolute', inset: 0, isolation: 'isolate'}}>
          {muestras.map((m, i) => (
            <canvas key={i} ref={(el) => { carasRef.current[i] = el; }} style={{position: 'absolute', left: T.x - MC, top: T.y - MC, width: T.w + 2 * MC, height: T.h + 2 * MC,
              transform: m.pose.transform, transformOrigin: origen(MC), opacity: m.pose.op / m.n, mixBlendMode: m.n > 1 ? ('plus-lighter' as any) : undefined, filter: borrosa}} />
          ))}
        </div>
      ) : null}
      <canvas ref={chispasRef} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Dh, filter: `drop-shadow(0 0 7px ${pal.a(0.7)})`,
        visibility: t >= LLEGA && t <= LLEGA + 1.6 ? 'visible' : 'hidden'}} />
    </>
  );
};

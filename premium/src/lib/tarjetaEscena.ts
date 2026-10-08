/* tarjetaEscena.ts — las piezas de la familia del VIDRIO para el motor de nodos (lib/escena.tsx), 8-oct-2026.
 * Las mismas medidas, colores y movimientos de Piezas.tsx (Tarjeta, CaraTarjeta, Brillo, Tambor, Letras), en nodos:
 *   · tarjetaNodos: la placa (sombra + tinte, se pinta una vez por tamaño) y la cara (fondo + grano y bordes de luz, una
 *     vez por tamaño) con la pose 3D de poseTarjeta, el desenfoque de movimiento de la entrada (las muestras de
 *     CameraMotionBlur, con plus-lighter) y el de salida; el barrido de luz es una banda que se mueve, no se repinta.
 *   · letrasNodos: las letras cinéticas (cada letra un nodo con su giro en X y la perspective de su palabra).
 *   · pintarTambor: un dígito que rueda, desde una tira de dígitos pintada una vez.
 */
import {interpolate, random} from 'remotion';
import {makeSpark} from '@remotion/shapes';
import {clamp, EASE, giro, rampa, lerp, sp, RESORTES} from './anim';
import {MONO} from '../tema';
import {ruido2D} from './ruido';
import {poseTarjeta, vidrioGL} from './Piezas';
import type {Paleta} from '../tema';
import type {Nodo, Op} from './escena';
import {bordeInterior, elipse, grano, lienzo, metricas, preparar, proyectar, redondeado, sombra} from './lienzo';

export const escalaDe = (g: CanvasRenderingContext2D) => { const m = g.getTransform(); return Math.hypot(m.a, m.b) || 1; };
export const comillas = (f: string) => (/^["']/.test(f) ? f : `"${f}"`);
const MEDIR = (() => { let g: CanvasRenderingContext2D | null = null; return () => g || (g = lienzo(4, 4).getContext('2d')!); })();
export const medidor = MEDIR;

/* la pose de la tarjeta como transform de nodo (la misma lista del CSS de poseTarjeta) */
export const opsPose = (n: {fx: number; ty: number; rotX: number; ry: number; sc: number}): Op[] =>
  [['p', 1700], ['t3', n.fx, n.ty, 0], ['rx', n.rotX], ['ry', n.ry], ['s', n.sc]];

/* ── pintores de la tarjeta ── */
export const pintarPlaca = (w: number, h: number, r: number) => (g: CanvasRenderingContext2D) => {
  const k = escalaDe(g);
  sombra(g, k, 0, 0, w, h, r, 22, 44, -22, 'rgba(0,0,0,.6)');
  sombra(g, k, 0, 0, w, h, r, 60, 110, -38, 'rgba(0,0,0,.92)');
  redondeado(g, 0, 0, w, h, r); g.fillStyle = 'rgba(10,7,9,.30)'; g.fill();
};
export const pintarFondo = (w: number, h: number, r: number, pal: Paleta) => (g: CanvasRenderingContext2D) => {
  g.save();
  redondeado(g, 0, 0, w, h, r); g.clip();
  g.fillStyle = gradiente(g, 0, 0, w, h, 180, [[0, 'rgba(42,32,38,.50)'], [1, 'rgba(16,11,14,.64)']]); g.fillRect(0, 0, w, h);
  elipse(g, 0, 0, w, h, 0.12 * w, -0.28 * h, 1.2 * w, 0.7 * h, [[0, 'rgba(255,255,255,.11)'], [0.6, 'rgba(255,255,255,0)']]);
  elipse(g, 0, 0, w, h, w, 1.18 * h, 0.7 * w, 0.9 * h, [[0, pal.a(0.17)], [0.62, pal.a(0)]]);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07;
  g.fillStyle = g.createPattern(grano(), 'repeat')!; g.fillRect(0, 0, w, h);
  g.restore();
};
export const pintarBordes = (w: number, h: number, r: number) => (g: CanvasRenderingContext2D) => {
  bordeInterior(g, 0, 0, w, h, r, -1, 0, 'rgba(255,255,255,.04)');
  bordeInterior(g, 0, 0, w, h, r, 0, 1.5, 'rgba(255,255,255,.10)');
  bordeInterior(g, 0, 0, w, h, r, 2, 0, 'rgba(255,255,255,.15)');
};
/* la banda del barrido de luz (Brillo): se pinta una vez; se mueve con el transform */
export const pintarBanda = (banda: number, alto: number, fuerza: number) => (g: CanvasRenderingContext2D) => {
  const gr = g.createLinearGradient(0, 0, banda, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.35, `rgba(255,255,255,${0.07 * fuerza})`);
  gr.addColorStop(0.5, `rgba(255,255,255,${0.2 * fuerza})`);
  gr.addColorStop(0.65, `rgba(255,255,255,${0.07 * fuerza})`);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, banda, alto);
};
/* Brillo de Piezas: una banda inclinada 20° que cruza la caja w × h entre t0 y t0 + dur, en «screen», recortada por el radio */
export const brilloNodo = (id: string, t: number, t0: number, w: number, h: number, r: number, dur = 0.93, fuerza = 1, altoCaja?: number): Nodo | null => {
  const p = rampa(t, t0, t0 + dur, EASE.inOut);
  if (p <= 0 || p >= 1) return null;
  const banda = Math.max(220, w * 0.42);
  const x = lerp(-banda - h * 0.4, w + h * 0.4, p);
  // altoCaja: el alto de la caja que recorta (si el Brillo recibe otro alto que el de su caja)
  return {id, x: 0, y: 0, w, h: altoCaja ?? h, recorte: r, hijos: [
    {id: id + 'b', x: 0, y: -h, w: banda, h: h * 3, tr: [['t', x, 0], ['rz', 20]], mezcla: 'screen',
      firma: `${banda}|${h}|${fuerza}`, pintar: pintarBanda(banda, h * 3, fuerza)},
  ]};
};

/* el instante con que se dibuja lo de DENTRO de la cara: durante el desenfoque de movimiento, CameraMotionBlur dibuja la cara
   en varios instantes (hasta un cuadro adelante) y los mezcla; aquí se pinta una sola vez, en el promedio de esos instantes */
type OpcTiempo = {t: number; inicio: number; fps: number; entra: number; ventanas?: [number, number][]; muestras?: number};
/* los instantes de las muestras del desenfoque (o solo t si no está activo) */
export function tiemposCara(o: OpcTiempo): number[] {
  const ventanas: [number, number][] = [[o.entra, o.entra + 0.6], ...(o.ventanas || [])];
  if (!ventanas.some(([a, b]) => o.t >= a && o.t <= b)) return [o.t];
  const S = Math.max(3, Math.round((o.muestras ?? 8) * 0.5));
  const f = Math.round((o.t - o.inicio) * o.fps);
  const sf = 210 / 360, maxOff = sf * S;
  const n = Math.max(1, Math.round(Math.min(clamp((f - maxOff) / maxOff + 1) * S, S)));
  return Array.from({length: n}, (_, i) => o.inicio + (f - sf * ((i + 1) / n) + 1) / o.fps);
}
export const tiempoCara = (o: OpcTiempo) => { const l = tiemposCara(o); return l.reduce((a, b) => a + b, 0) / l.length; };

/* ── la tarjeta de vidrio con profundidad 3D (Tarjeta + CaraTarjeta + Desenfoque de Piezas) ── */
export type OpcTarjeta = {
  t: number; inicio: number; fps: number; pal: Paleta;
  x: number; y: number; w: number; r?: number; entra: number; sale: number; semilla: string;
  h: number | ((ts: number) => number);             // el alto (puede crecer: se pide en el instante de cada muestra)
  brillos?: number[]; ventanas?: [number, number][]; muestras?: number;
  /* los hijos de la cara, en coordenadas de la tarjeta, para el instante ts de la muestra i del desenfoque de movimiento.
     Como en Desenfoque/CameraMotionBlur: lo que en la plantilla de siempre llevaba su propio reloj (useT: Letras, Fila,
     Cifra, Etiqueta…) se calcula en ts; lo que calculaba la plantilla misma, en t. Si el lienzo de un nodo cambia con ts,
     su `fuente` debe llevar la muestra (sufijoMuestra) para no pisarse entre muestras. */
  contenido: (ts: number, i: number, n: number) => (Nodo | null | false | undefined)[];
  Dh: number;                                        // el alto del dibujo (la capa entera)
  vidrioCss?: boolean;                               // celular sin el vidrio de la página: el backdrop-filter de siempre
};
export const sufijoMuestra = (i: number, n: number) => (n > 1 ? '#' + i : '');
export function tarjetaNodos(o: OpcTarjeta): {nodos: (Nodo | null)[]; pose: ReturnType<typeof poseTarjeta>; placaOp: number; visible: boolean; alto: number} {
  const {t, x, y, w, entra, sale, semilla, pal} = o;
  const r = o.r ?? 54;
  const altoEn = (ts: number) => (typeof o.h === 'function' ? o.h(ts) : o.h);
  const alto = altoEn(t);
  const pose = poseTarjeta(t, entra, sale, semilla);
  const visible = !(t < entra - 0.03 || pose.x >= 1);
  const placaOp = clamp(pose.e) ** 2.2 * (1 - pose.x);
  if (!visible) return {nodos: [], pose, placaOp, visible, alto};
  // el desenfoque de movimiento: el de CameraMotionBlur (muestras × 0,5, obturador 210°, adelantadas un cuadro)
  const ts = tiemposCara({t, inicio: o.inicio, fps: o.fps, entra, ventanas: o.ventanas, muestras: o.muestras});
  const n = ts.length;
  const caras: Nodo[] = ts.map((tsi, i) => {
    const ps = n > 1 ? poseTarjeta(tsi, entra, sale, semilla) : pose;
    const hs = altoEn(tsi), suf = sufijoMuestra(i, n);
    return {
      id: 'cara' + i, x, y, w, h: hs, tr: opsPose(ps.n), origen: [w * 0.5, hs * 0.6] as [number, number], op: ps.op / n,
      mezcla: n > 1 ? 'plus-lighter' as const : undefined, blur: ps.x > 0.02 ? ps.x * 14 : 0,
      hijos: [
        {id: 'fondo', fuente: 'fondo' + suf, x: 0, y: 0, w, h: hs, firma: `${w}|${hs}|${r}|${pal.acento}`, pintar: pintarFondo(w, hs, r, pal)},
        ...o.contenido(tsi, i, n),
        {id: 'bordes', fuente: 'bordes' + suf, x: 0, y: 0, w, h: hs, firma: `${w}|${hs}|${r}`, pintar: pintarBordes(w, hs, r)},
        ...(o.brillos || []).map((b, j) => brilloNodo('brillo' + j, tsi, b, w, hs, r)),
      ],
    };
  });
  return {
    nodos: [
      o.vidrioCss ? {id: 'vidrio', x, y, w, h: alto, tr: opsPose(pose.n), origen: [w * 0.5, alto * 0.6] as [number, number], op: placaOp, vidrioCss: r} : null,
      {id: 'placa', x, y, w, h: alto, tr: opsPose(pose.n), origen: [w * 0.5, alto * 0.6], op: placaOp, m: 170, firma: `${w}|${alto}|${r}`, pintar: pintarPlaca(w, alto, r)},
      {id: 'caras', x: 0, y: 0, w: 1080, h: o.Dh, aislar: n > 1, hijos: caras},
    ],
    pose, placaOp, visible, alto,
  };
}

/* ── letras: alto de línea y línea base como las pone el navegador (line-height = lh × tamaño) ── */
export const lineaDe = (fuente: string, tam: number, lh: number, listo: boolean) => {
  const g = MEDIR();
  const {asc, desc} = metricas(g, fuente, listo);
  return {alto: lh * tam, base: (lh * tam - (asc + desc)) / 2 + asc, asc, desc};
};
/* el ancho de un texto con letter-spacing (como el navegador: el espaciado va después de cada letra) */
/* (8-oct) con el letter-spacing del lienzo y el texto entero: así lleva el kerning, como el navegador (letra por letra
   quedaba hasta 9 px más ancho en «CONSTANCIA»). El espaciado va después de cada letra, también de la última. */
export const anchoTexto = (texto: string, fuente: string, ls: number) => {
  const g = MEDIR();
  g.font = fuente; (g as any).letterSpacing = `${ls}px`;
  const w = g.measureText(texto).width;
  (g as any).letterSpacing = '0px';
  return w;
};
/* escribe un texto letra por letra con su espaciado (x = izquierda, y = línea base) */
export const escribir = (g: CanvasRenderingContext2D, texto: string, x: number, y: number, fuente: string, ls: number, color: string) => {
  g.font = fuente; (g as any).letterSpacing = `${ls}px`;
  g.fillStyle = color; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillText(texto, x, y);
  (g as any).letterSpacing = '0px';
};

/* los anchos de cada letra de un texto (se miden una vez por texto y letra) */
const MEDIDAS = new Map<string, {palabras: {texto: string; letras: number[]}[]; espacio: number}>();
const medidasLetras = (texto: string, fuente: string, ls: number, ws: number, listo: boolean) => {
  const clave = `${texto}|${fuente}|${ls}|${ws}|${listo}`;
  let m = MEDIDAS.get(clave);
  if (!m) {
    const g = MEDIR();
    g.font = fuente; (g as any).letterSpacing = '0px';
    m = {palabras: texto.split(' ').map((pal) => ({texto: pal, letras: pal.split('').map((ch) => g.measureText(ch).width + ls)})),
      espacio: g.measureText(' ').width + ls + ws};
    if (MEDIDAS.size > 200) MEDIDAS.clear();
    MEDIDAS.set(clave, m);
  }
  return m;
};
/* Letras de Piezas: entran una por una (resorte «letra»), subiendo `subir` px y girando en X desde `giroX`°, con la
   perspective 600 de su palabra. x, y = esquina de arriba a la izquierda de la línea; devuelve los nodos y el ancho. */
export function letrasNodos(o: {id: string; texto: string; t: number; t0: number; paso?: number; subir?: number; giroX?: number;
  fuente: string; tam: number; lh: number; ls: number; ws?: number; color: string | ((palabra: string, i: number) => string | undefined); x: number; y: number;
  anchoMax?: number; alinear?: 'left' | 'center'; sombra?: Sombra; listo: boolean}): {nodos: Nodo[]; ancho: number; renglones: number} {
  const paso = o.paso ?? 1 / 30, subir = o.subir ?? 46, giroX = o.giroX ?? -75;
  const L = lineaDe(o.fuente, o.tam, o.lh, o.listo);
  const M = medidasLetras(String(o.texto || ''), o.fuente, o.ls, o.ws || 0, o.listo);
  // los renglones: las palabras (inline-block) bajan de renglón si no caben en anchoMax
  const renglones: {palabras: number[]; ancho: number}[] = [{palabras: [], ancho: 0}];
  M.palabras.forEach((pw, pi) => {
    const an = pw.letras.reduce((a, b) => a + b, 0);
    let r = renglones[renglones.length - 1];
    const con = r.palabras.length ? r.ancho + M.espacio + an : an;
    if (o.anchoMax != null && r.palabras.length && con > o.anchoMax + 0.5) { r = {palabras: [], ancho: 0}; renglones.push(r); }
    r.ancho = r.palabras.length ? r.ancho + M.espacio + an : an;
    r.palabras.push(pi);
  });
  const nodos: Nodo[] = [];
  let idx = 0, maxAncho = 0;
  const m = Math.ceil(o.tam * 0.3) + (o.sombra ? Math.ceil((o.sombra.blur || 0) + Math.abs(o.sombra.y || 0)) : 0);
  renglones.forEach((r, ri) => {
    maxAncho = Math.max(maxAncho, r.ancho);
    let x = o.x + (o.alinear === 'center' && o.anchoMax != null ? (o.anchoMax - r.ancho) / 2 : 0);
    r.palabras.forEach((pi) => {
      const {letras: anchos, texto: pal} = M.palabras[pi];
      const color = (typeof o.color === 'function' ? o.color(pal, pi) : o.color) || '#fff';
      const letras: Nodo[] = [];
      let lx = 0;
      pal.split('').forEach((ch, ci) => {
        const aw = anchos[ci];
        const p = sp(o.t, o.t0 + idx++ * paso, RESORTES.letra);
        letras.push({id: `${o.id}l${pi}_${ci}`, x: lx, y: 0, w: aw, h: L.alto, m,
          tr: [['t', 0, (1 - p) * subir], ['rx', (1 - p) * giroX]], origen: [aw / 2, L.alto], op: clamp(p * 1.8),
          firma: `${ch}|${o.fuente}|${color}|${L.base}|${o.sombra ? JSON.stringify(o.sombra) : ''}`,
          pintar: (gg) => {
            if (o.sombra) ponerSombraTexto(gg, o.sombra);
            escribir(gg, ch, 0, L.base, o.fuente, 0, color);
          }});
        lx += aw;
      });
      nodos.push({id: `${o.id}p${pi}`, x, y: o.y + ri * L.alto, w: lx, h: L.alto, persp: 600, hijos: letras});
      x += lx + M.espacio;
    });
  });
  return {nodos, ancho: maxAncho, renglones: renglones.length};
}

/* ── el tambor: una tira con los dígitos 9, 0, 1 … 9, 0, 1, 2 (pintada una vez) y la ventana que la recorre ── */
const TIRAS = new Map<string, HTMLCanvasElement>();
export function pintarTambor(g: CanvasRenderingContext2D, o: {pos: number | number[]; x: number; top: number; cw: number; tam: number; fuente: string; ls: number;
  linea: number; color: string; borroso?: number; sombra?: (gg: CanvasRenderingContext2D, k: number) => void; listo: boolean;
  alto?: number;        // el alto de la ventana (el line-height de la cifra; por defecto 1,2 em como sus renglones)
  tabular?: number}) {  // ancho de los dígitos con tabular-nums (0 = cada uno el suyo)
  const k = escalaDe(g);
  const paso = 1.2 * o.tam;                  // los renglones de la tira, como los <span> del Tambor (1,2 em)
  const vw = 1.8 * o.cw, vh = o.alto ?? paso, vx = o.x - 0.4 * o.cw;
  const pw = Math.ceil(vw * k), ph = Math.ceil(vh * k);
  const clave = `${o.fuente}|${o.color}|${vw.toFixed(2)}|${k}|${o.linea}|${o.ls}|${o.listo}|${o.sombra ? 's' : ''}|${o.tabular || 0}`;
  let tira = TIRAS.get(clave);
  if (!tira) {
    tira = lienzo();
    const gt = preparar(tira, pw, 14 * paso * k);
    gt.setTransform(k, 0, 0, k, 0, 0);
    if (o.sombra) o.sombra(gt, k);
    for (let i = 0; i < 14; i++) {
      const dg = String((i + 9) % 10);
      gt.font = o.fuente; (gt as any).letterSpacing = '0px';
      gt.fillStyle = o.color; gt.textBaseline = 'alphabetic'; gt.textAlign = 'left';
      const an = gt.measureText(dg).width;
      // con tabular-nums el dígito va centrado en su ancho fijo
      const x = o.tabular ? (vw - (o.tabular + o.ls)) / 2 + (o.tabular - an) / 2 : (vw - (an + o.ls)) / 2;
      gt.fillText(dg, x, o.linea + i * paso);
    }
    if (TIRAS.size > 40) TIRAS.clear();
    TIRAS.set(clave, tira);
  }
  // varias posiciones (las muestras del desenfoque de movimiento): se suman con 1/n cada una, como CameraMotionBlur
  const posiciones = Array.isArray(o.pos) ? o.pos : [o.pos];
  const v = ventana();
  const gv = preparar(v, pw, ph);
  if (o.borroso && o.borroso > 0) gv.filter = `blur(${(o.borroso * k).toFixed(2)}px)`;
  if (posiciones.length > 1) { gv.globalCompositeOperation = 'lighter'; gv.globalAlpha = 1 / posiciones.length; }
  posiciones.forEach((ps) => {
    const b = Math.floor(ps), frac = ps - b;
    const y0 = ((((b % 10) + 10) % 10) + 1 + frac) * paso * k;
    gv.drawImage(tira!, 0, y0, pw, ph, 0, 0, pw, ph);
  });
  gv.globalAlpha = 1; gv.globalCompositeOperation = 'source-over';
  gv.filter = 'none';
  gv.globalCompositeOperation = 'destination-in';
  const m = gv.createLinearGradient(0, 0, 0, ph);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.17, '#000'); m.addColorStop(0.83, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
  gv.fillStyle = m; gv.fillRect(0, 0, pw, ph);
  gv.globalCompositeOperation = 'source-over';
  g.drawImage(v, 0, 0, pw, ph, vx, o.top, vw, vh);
}
const ventana = (() => { let c: HTMLCanvasElement | null = null; return () => c || (c = lienzo()); })();

/* un trazo que se dibuja de a poco (evolvePath): segmentos rectos y arcos, con su largo */
export type Tramo = ['l', number, number, number, number] | ['a', number, number, number, number, number];   // línea x0 y0 x1 y1 · arco cx cy r a0 a1 (radianes, sentido del reloj)
export function trazar(g: CanvasRenderingContext2D, tramos: Tramo[], p: number) {
  if (p <= 0) return;
  const largo = (t: Tramo) => (t[0] === 'l' ? Math.hypot(t[3] - t[1], t[4] - t[2]) : Math.abs(t[5] - t[4]) * t[3]);
  const total = tramos.reduce((a, t) => a + largo(t), 0);
  let resta = total * Math.min(1, p);
  g.beginPath();
  let primero = true;
  for (const t of tramos) {
    if (resta <= 0) break;
    const L = largo(t), u = Math.min(1, resta / L);
    if (t[0] === 'l') {
      if (primero) g.moveTo(t[1], t[2]);
      g.lineTo(t[1] + (t[3] - t[1]) * u, t[2] + (t[4] - t[2]) * u);
    } else {
      g.arc(t[1], t[2], t[3], t[4], t[4] + (t[5] - t[4]) * u, t[5] < t[4]);
    }
    primero = false;
    resta -= L;
  }
  g.stroke();
}

/* el vidrio (lo de atrás desenfocado) de una tarjeta: en el celular lo pinta la página (js/vidriogl.js) con las 4 esquinas
   de la placa; en la nube lo pone el ensamblador. Solo «encima» y «detrás de ti». */
export function vidrioTarjeta(g: {vista: boolean; p: any}, t: number, pose: ReturnType<typeof poseTarjeta>, x: number, y: number, w: number, h: number, r: number,
  op: number, semilla: string, Dh: number) {
  const vg = g.vista && (g.p.forma === 'encima' || g.p.forma === 'profundo') ? vidrioGL() : null;
  if (!vg) return false;
  try {
    vg.poner({k: g.p.tipo + '@' + g.p.desde + '#' + semilla, pieza: g.p.tipo + '@' + g.p.desde, t, o: [x + w * 0.5, y + h * 0.6],
      c: [[0, 0], [w, 0], [w, h], [0, h]].map(([px, py]) => proyectar(px, py, w * 0.5, h * 0.6, pose.n)), w, h, r, op, Dw: 1080, Dh});
  } catch (_) { /* sin vidrio esta vez */ }
  return true;
}

/* ══ más piezas de la familia (8-oct, tanda 2) ══ */
const R3 = (v: number) => Math.round(v * 1000);
export type Sombra = {x?: number; y?: number; blur?: number; spread?: number; color: string; inset?: boolean};
/* text-shadow: el lienzo no escala la sombra con la transformación: se le da en px reales */
export const ponerSombraTexto = (g: CanvasRenderingContext2D, s: Sombra) => {
  const k = escalaDe(g);
  g.shadowColor = s.color; g.shadowBlur = (s.blur || 0) * k; g.shadowOffsetX = (s.x || 0) * k; g.shadowOffsetY = (s.y || 0) * k;
};
const quitarSombra = (g: CanvasRenderingContext2D) => { g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; };

/* el navegador mezcla los degradados con la transparencia ya aplicada (premultiplicada); el lienzo, sin aplicarla, así que
   de un color casi transparente a uno oscuro se veía mucho más el primero. Se agregan pasos intermedios con la cuenta del
   navegador (solo entre paradas de distinta opacidad) */
const colorDe = (c: string): [number, number, number, number] => {
  c = c.trim();
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const v = m[1].split(',').map((x) => parseFloat(x));
    return [v[0], v[1], v[2], v[3] == null || isNaN(v[3]) ? 1 : v[3]];
  }
  return [0, 0, 0, 1];
};
export const paradasCss = (paradas: [number, string][], pasos = 10): [number, string][] => {
  const out: [number, string][] = [];
  paradas.forEach((pa, i) => {
    out.push(pa);
    const sig = paradas[i + 1];
    if (!sig) return;
    const a = colorDe(pa[1]), b = colorDe(sig[1]);
    if (Math.abs(a[3] - b[3]) < 1e-3) return;
    for (let s = 1; s < pasos; s++) {
      const u = s / pasos, al = a[3] + (b[3] - a[3]) * u;
      const c = (j: number) => (al > 0 ? (a[j] * a[3] + (b[j] * b[3] - a[j] * a[3]) * u) / al : 0).toFixed(1);
      out.push([pa[0] + (sig[0] - pa[0]) * u, `rgba(${c(0)},${c(1)},${c(2)},${al.toFixed(4)})`]);
    }
  });
  return out;
};
/* linear-gradient(Ndeg, …) de CSS sobre la caja (x, y, w, h) */
export const gradiente = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, grados: number, paradas: [number, string][]) => {
  const a = (grados * Math.PI) / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const L = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2, cy = y + h / 2;
  const gr = g.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
  paradasCss(paradas).forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
/* una caja de CSS: sus sombras de afuera (box-shadow), su fondo y sus sombras de adentro (inset), en ese orden */
export function caja(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
  fondo: string | CanvasGradient | null, sombras: Sombra[] = []) {
  const k = escalaDe(g);
  const fuera = sombras.filter((s) => !s.inset), dentro = sombras.filter((s) => s.inset);
  for (let i = fuera.length - 1; i >= 0; i--) {
    const s0 = fuera[i];
    sombra(g, k, x + (s0.x || 0), y, w, h, r, s0.y || 0, s0.blur || 0, s0.spread || 0, s0.color);
  }
  if (fondo) { redondeado(g, x, y, w, h, r); g.fillStyle = fondo; g.fill(); }
  for (let i = dentro.length - 1; i >= 0; i--) {
    const s0 = dentro[i];
    g.save();
    redondeado(g, x, y, w, h, r); g.clip();
    // lo de adentro menos la caja corrida y encogida: con desenfoque, por el truco de la sombra lejana
    const sp0 = s0.spread || 0, lejos = 20000;
    const hueco = new Path2D();
    hueco.rect(x - 400 - lejos, y - 400, w + 800, h + 800);
    redondeado(hueco, x + (s0.x || 0) + sp0 - lejos, y + (s0.y || 0) + sp0, w - 2 * sp0, h - 2 * sp0, Math.max(0, r - sp0));
    if (s0.blur) {
      g.shadowColor = s0.color; g.shadowBlur = s0.blur * k; g.shadowOffsetX = lejos * k;
      g.fillStyle = '#000';
    } else {
      g.translate(lejos, 0);
      g.fillStyle = s0.color;
    }
    g.fill(hueco, 'evenodd');
    g.restore();
  }
}

/* texto con renglones (como un bloque de CSS con line-height lh): devuelve los renglones; alinear left | center | right */
export function partirTexto(texto: string, fuente: string, ls: number, ancho: number) {
  const g = MEDIR();
  g.font = fuente; (g as any).letterSpacing = '0px';
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const ren: string[] = [];
  let cur = '';
  palabras.forEach((w) => {
    const prueba = cur ? cur + ' ' + w : w;
    if (cur && anchoTexto(prueba, fuente, ls) > ancho + 0.5) { ren.push(cur); cur = w; } else cur = prueba;
  });
  if (cur) ren.push(cur);
  return ren;
}
export function bloque(g: CanvasRenderingContext2D, o: {texto: string; x: number; y: number; ancho: number; fuente: string; tam: number; lh: number; ls: number;
  color: string; alinear?: 'left' | 'center' | 'right'; partir?: boolean; puntos?: boolean; listo: boolean}) {
  const L = lineaDe(o.fuente, o.tam, o.lh, o.listo);
  let ren = o.partir === false ? [String(o.texto || '')] : partirTexto(o.texto, o.fuente, o.ls, o.ancho);
  if (o.puntos) {
    // text-overflow: ellipsis (un renglón)
    let t0 = ren.join(' ');
    if (anchoTexto(t0, o.fuente, o.ls) > o.ancho) {
      while (t0.length > 1 && anchoTexto(t0 + '…', o.fuente, o.ls) > o.ancho) t0 = t0.slice(0, -1);
      t0 = t0.trimEnd() + '…';
    }
    ren = [t0];
  }
  ren.forEach((r, i) => {
    const an = anchoTexto(r, o.fuente, o.ls);
    const x = o.alinear === 'center' ? o.x + (o.ancho - an) / 2 : o.alinear === 'right' ? o.x + o.ancho - an : o.x;
    escribir(g, r, x, o.y + i * L.alto + L.base, o.fuente, o.ls, o.color);
  });
  return ren.length;
}

/* el ancho de los dígitos con tabular-nums (lo mide el navegador una vez por letra) */
const TABULAR = new Map<string, number>();
export const anchoTabular = (fuente: string, listo: boolean) => {
  let a = TABULAR.get(fuente);
  if (a == null) {
    const s = document.createElement('span');
    s.style.cssText = `font: ${fuente}; font-variant-numeric: tabular-nums; position: absolute; left: -9999px; top: 0; white-space: pre; letter-spacing: 0`;
    s.textContent = '0';
    document.body.appendChild(s);
    a = s.getBoundingClientRect().width;
    s.remove();
    if (listo) TABULAR.set(fuente, a);
  }
  return a;
};

/* Etiqueta de Piezas: el punto «en vivo» (resorte pop, latido) y el texto en DM Mono que se escribe con su cursor.
   (x, y) = esquina de arriba a la izquierda del renglón (el div con display: flex) */
export function etiquetaNodo(o: {id: string; texto: string; t: number; t0: number; x: number; y: number; pal: Paleta; tam?: number; punto?: boolean; listo: boolean}): Nodo | null {
  const texto = String(o.texto || '').toUpperCase();
  if (!texto) return null;
  const tam = o.tam ?? 27, punto = o.punto ?? true, pal = o.pal;
  const fuente = `500 ${tam}px ${comillas(MONO)}`;
  const g0 = MEDIR(); g0.font = fuente; (g0 as any).letterSpacing = '0px';
  const pasoL = g0.measureText('M').width + 0.16 * tam;
  const {asc, desc} = metricas(g0, fuente, o.listo);
  const lh = asc + desc, alto = Math.max(punto ? 13 : 0, lh);
  const tx = punto ? 13 + 16 : 0;
  const a = sp(o.t, o.t0, RESORTES.pop);
  const latido = 0.5 + 0.5 * Math.sin(((o.t - o.t0) * 30) / 4.5);
  const f = (o.t - (o.t0 + 2 / 30)) * 30;
  const n = clamp(Math.floor(f * 1.4), 0, texto.length);
  const cursor = f >= -3 && f < texto.length / 1.4 + 7 && (n < texto.length || Math.floor((o.t * 30) / 4) % 2 === 0);
  const base = (alto - lh) / 2 + asc;
  return {id: o.id, x: o.x, y: o.y, w: tx + texto.length * pasoL, h: alto, m: 34,
    firma: `${texto}|${n}|${cursor}|${punto ? R3(a) + '|' + Math.round(latido * 100) : ''}|${pal.acento}|${o.listo}`,
    pintar: (g) => {
      if (punto && a > 0.001) {
        g.save();
        g.translate(6.5, alto / 2); g.scale(a, a);
        const kk = escalaDe(g);
        g.save();
        g.shadowColor = pal.a(0.8); g.shadowBlur = 18 * kk; g.shadowOffsetX = 20000 * kk;
        g.beginPath(); g.arc(-20000, 0, 6.5, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill();
        g.restore();
        g.fillStyle = pal.a(0.28 - 0.2 * latido);
        g.beginPath(); g.arc(0, 0, 6.5 + 4 + 6 * latido, 0, Math.PI * 2); g.fill();
        g.fillStyle = pal.acento;
        g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.font = fuente; (g as any).letterSpacing = '0px';
      g.fillStyle = pal.tinta2; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      for (let i = 0; i < n; i++) g.fillText(texto[i], tx + i * pasoL, base);
      if (cursor) { redondeado(g, tx + n * pasoL + 0.08 * tam, base - 0.82 * tam, 0.5 * tam, 0.95 * tam, 3); g.fillStyle = pal.acento; g.fill(); }
    }};
}

/* Escribir de Piezas (máquina de escribir) dentro de un pintor: devuelve el ancho total (el texto entero, como el <span> oculto) */
export function escribirMaquina(g: CanvasRenderingContext2D, o: {texto: string; t: number; t0: number; velocidad?: number; cursor?: boolean; x: number; base: number;
  fuente: string; tam: number; ls: number; color: string; acento: string}) {
  const vel = o.velocidad ?? 1;
  const f = (o.t - o.t0) * 30;
  const n = clamp(Math.floor(f * vel), 0, o.texto.length);
  const escribiendo = f >= -3 && f < o.texto.length / vel + 7;
  const parpadeo = n < o.texto.length || Math.floor((o.t * 30) / 4) % 2 === 0;
  const visto = o.texto.slice(0, n);
  escribir(g, visto, o.x, o.base, o.fuente, o.ls, o.color);
  const av = anchoTexto(visto, o.fuente, o.ls);
  if ((o.cursor ?? true) && escribiendo && parpadeo) {
    redondeado(g, o.x + av + 0.08 * o.tam, o.base - 0.82 * o.tam, 0.5 * o.tam, 0.95 * o.tam, 3);
    g.fillStyle = o.acento; g.fill();
  }
  return {n, firma: `${n}|${escribiendo && parpadeo}`};
}
export const estadoMaquina = (texto: string, t: number, t0: number, vel = 1) => {
  const f = (t - t0) * 30;
  const n = clamp(Math.floor(f * vel), 0, texto.length);
  return `${n}|${f >= -3 && f < texto.length / vel + 7 && (n < texto.length || Math.floor((t * 30) / 4) % 2 === 0)}`;
};

/* Cifra de Piezas: «+10.000», «$2,5M»… cada dígito rueda en su tambor; lo demás entra de un salto. Un nodo con la caja
   del renglón (x, y, w, alto = lh × tam); la sombra de las letras (text-shadow) va UNA vez sobre todo */
export function cifraNodo(o: {id: string; texto: string; t: number; t0: number; dur?: number; fuente: string; tam: number; ls: number; color: string;
  x: number; y: number; w: number; alinear?: 'left' | 'center' | 'right'; lh?: number; tabular?: boolean; sombra?: Sombra;
  tr?: Op[]; origen?: [number, number]; op?: number; listo: boolean}): Nodo {
  const dur = o.dur ?? 1.15, lh = o.lh ?? 1.2, tam = o.tam;
  const g0 = MEDIR(); g0.font = o.fuente; (g0 as any).letterSpacing = '0px';
  const {asc, desc} = metricas(g0, o.fuente, o.listo);
  const tab = o.tabular ? anchoTabular(o.fuente, o.listo) : 0;
  const chars = String(o.texto).split('');
  const anchos = chars.map((ch) => (/\d/.test(ch) && tab ? tab : g0.measureText(ch).width) + o.ls);
  const total = anchos.reduce((a, b) => a + b, 0);
  const x0 = o.alinear === 'left' ? 0 : o.alinear === 'right' ? o.w - total : (o.w - total) / 2;
  const altoV = lh * tam;
  const base = (altoV - (asc + desc)) / 2 + asc;
  const linea12 = (1.2 * tam - (asc + desc)) / 2 + asc;     // la línea base dentro de los renglones de 1,2 em del tambor
  const s = sp(o.t, o.t0 - 0.05, RESORTES.pop);
  const alfa = clamp(s * 1.6);
  const digitos = chars.filter((c) => /\d/.test(c)).length;
  const pos: number[] = [], bor: number[] = [];
  let j = 0;
  chars.forEach((ch) => {
    if (!/\d/.test(ch)) return;
    const kd = j++;
    const vueltas = digitos <= 1 ? 1 : Math.min(2, Math.round((kd / Math.max(1, digitos - 1)) * 2));
    const totalD = vueltas * 10 + Number(ch);
    const d = dur + kd * 0.1;
    const p = giro(o.t, o.t0, d, totalD);
    pos.push(p);
    const b = Math.min(7, Math.abs(p - giro(o.t - 1 / 30, o.t0, d, totalD)) * 5);
    bor.push(b > 0.4 ? Math.round(b * 2) / 2 : 0);
  });
  const sb = o.sombra;
  const m = Math.ceil(0.5 * tam + (sb ? (sb.blur || 0) + Math.abs(sb.y || 0) : 0));
  return {id: o.id, x: o.x, y: o.y, w: o.w, h: altoV, m, tr: o.tr, origen: o.origen, op: o.op,
    firma: `${o.texto}|${o.fuente}|${o.color}|${R3(s)}|${pos.map(R3).join(',')}|${bor.join(',')}|${sb ? JSON.stringify(sb) : ''}|${o.listo}`,
    pintar: (g) => {
      if (alfa <= 0.001) return;
      const k = escalaDe(g);
      // todo sin sombra en una capa aparte; después la capa con su sombra y la opacidad
      const capa = capaCifra();
      const gc = preparar(capa, (o.w + 2 * m) * k, (altoV + 2 * m) * k);
      gc.setTransform(k, 0, 0, k, m * k, m * k);
      gc.font = o.fuente; (gc as any).letterSpacing = '0px';
      gc.fillStyle = o.color; gc.textBaseline = 'alphabetic'; gc.textAlign = 'left';
      let x = x0, jj = 0;
      chars.forEach((ch, i) => {
        const cw = anchos[i];
        if (/\d/.test(ch)) {
          pintarTambor(gc, {pos: pos[jj], x, top: 0, cw, tam, fuente: o.fuente, ls: o.ls, linea: linea12, color: o.color, borroso: bor[jj],
            alto: altoV, tabular: tab, listo: o.listo});
          jj++;
        } else {
          const sc = 0.6 + 0.4 * s;
          const cx = x + cw / 2, cy = altoV / 2;
          gc.save();
          gc.translate(cx, cy); gc.scale(sc, sc); gc.translate(-cx, -cy);
          gc.font = o.fuente; gc.fillStyle = o.color; gc.textBaseline = 'alphabetic'; gc.textAlign = 'left';
          gc.fillText(ch, x, base);
          gc.restore();
        }
        x += cw;
      });
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = alfa;
      if (sb) { g.shadowColor = sb.color; g.shadowBlur = (sb.blur || 0) * k; g.shadowOffsetX = (sb.x || 0) * k; g.shadowOffsetY = (sb.y || 0) * k; }
      g.drawImage(capa, 0, 0);
      g.restore();
    }};
}
const capaCifra = (() => { let c: HTMLCanvasElement | null = null; return () => c || (c = lienzo()); })();

/* Chispas de Piezas: estallido con física (velocidad, arrastre, gravedad) y su estela; lo de cada chispa se calcula una vez */
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
export function pintarChispas(g: CanvasRenderingContext2D, pal: Paleta, tt: number, t0: number, x: number, y: number, n: number, semilla: string, fuerza: number) {
  const t = tt - t0;
  if (t < 0 || t > 1.6) return;
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
}
/* el nodo de las chispas (con su resplandor drop-shadow 0 0 7px); null fuera de su momento */
export function chispasNodo(o: {id: string; t: number; t0: number; x: number; y: number; n?: number; semilla: string; fuerza?: number; radio?: number; pal: Paleta}): Nodo | null {
  const t = o.t - o.t0;
  if (t < 0 || t > 1.6) return null;
  const R = o.radio ?? 520, n = o.n ?? 24, fuerza = o.fuerza ?? 950;
  return {id: o.id, x: o.x - R, y: o.y - R, w: 2 * R, h: 2 * R, m: 160, firma: String(R3(t)), resplandor: [7, o.pal.a(0.7)],
    pintar: (g) => pintarChispas(g, o.pal, o.t, o.t0, R, R, n, o.semilla, fuerza)};
}

/* ¿el celular tiene que poner el vidrio con CSS? (sin el vidrio WebGL de la página o en formas que no lo llevan) */
export const sinVidrioCss = (G: {vista: boolean; p: any}) => !!G.vista && !((G.p.forma === 'encima' || G.p.forma === 'profundo') && vidrioGL());
/* la línea con line-height normal (asc + desc de la letra) */
export const lineaNormal = (fuente: string, listo: boolean) => {
  const {asc, desc} = metricas(MEDIR(), fuente, listo);
  return {asc, desc, alto: asc + desc};
};
/* un rectángulo con un radio por esquina (arriba-izq, arriba-der, abajo-der, abajo-izq) */
export const redondeado4 = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: [number, number, number, number]) => {
  const m = Math.min(w / 2, h / 2);
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, m)));
  g.beginPath();
  g.moveTo(x + a, y);
  g.arcTo(x + w, y, x + w, y + h, b);
  g.arcTo(x + w, y + h, x, y + h, c);
  g.arcTo(x, y + h, x, y, d);
  g.arcTo(x, y, x + w, y, a);
  g.closePath();
};

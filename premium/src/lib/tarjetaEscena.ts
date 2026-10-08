/* tarjetaEscena.ts — las piezas de la familia del VIDRIO para el motor de nodos (lib/escena.tsx), 8-oct-2026.
 * Las mismas medidas, colores y movimientos de Piezas.tsx (Tarjeta, CaraTarjeta, Brillo, Tambor, Letras), en nodos:
 *   · tarjetaNodos: la placa (sombra + tinte, se pinta una vez por tamaño) y la cara (fondo + grano y bordes de luz, una
 *     vez por tamaño) con la pose 3D de poseTarjeta, el desenfoque de movimiento de la entrada (las muestras de
 *     CameraMotionBlur, con plus-lighter) y el de salida; el barrido de luz es una banda que se mueve, no se repinta.
 *   · letrasNodos: las letras cinéticas (cada letra un nodo con su giro en X y la perspective de su palabra).
 *   · pintarTambor: un dígito que rueda, desde una tira de dígitos pintada una vez.
 */
import {clamp, EASE, rampa, lerp, sp, RESORTES} from './anim';
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
  const lin = g.createLinearGradient(0, 0, 0, h);
  lin.addColorStop(0, 'rgba(42,32,38,.50)'); lin.addColorStop(1, 'rgba(16,11,14,.64)');
  g.fillStyle = lin; g.fillRect(0, 0, w, h);
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
export const brilloNodo = (id: string, t: number, t0: number, w: number, h: number, r: number, dur = 0.93, fuerza = 1): Nodo | null => {
  const p = rampa(t, t0, t0 + dur, EASE.inOut);
  if (p <= 0 || p >= 1) return null;
  const banda = Math.max(220, w * 0.42);
  const x = lerp(-banda - h * 0.4, w + h * 0.4, p);
  return {id, x: 0, y: 0, w, h, recorte: r, hijos: [
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
export const anchoTexto = (texto: string, fuente: string, ls: number) => {
  const g = MEDIR();
  g.font = fuente; (g as any).letterSpacing = '0px';
  let w = 0;
  for (const ch of texto) w += g.measureText(ch).width + ls;
  return w;
};
/* escribe un texto letra por letra con su espaciado (x = izquierda, y = línea base) */
export const escribir = (g: CanvasRenderingContext2D, texto: string, x: number, y: number, fuente: string, ls: number, color: string) => {
  g.font = fuente; (g as any).letterSpacing = '0px';
  g.fillStyle = color; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  if (!ls) { g.fillText(texto, x, y); return; }
  for (const ch of texto) { g.fillText(ch, x, y); x += g.measureText(ch).width + ls; }
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
  fuente: string; tam: number; lh: number; ls: number; ws?: number; color: string; x: number; y: number; listo: boolean}): {nodos: Nodo[]; ancho: number} {
  const paso = o.paso ?? 1 / 30, subir = o.subir ?? 46, giroX = o.giroX ?? -75;
  const L = lineaDe(o.fuente, o.tam, o.lh, o.listo);
  const M = medidasLetras(String(o.texto || ''), o.fuente, o.ls, o.ws || 0, o.listo);
  const nodos: Nodo[] = [];
  let x = o.x, idx = 0;
  const palabras = M.palabras;
  palabras.forEach(({letras: anchos, texto: pal}, pi) => {
    const letras: Nodo[] = [];
    let lx = 0;
    pal.split('').forEach((ch, ci) => {
      const aw = anchos[ci];
      const p = sp(o.t, o.t0 + idx++ * paso, RESORTES.letra);
      letras.push({id: `${o.id}l${pi}_${ci}`, x: lx, y: 0, w: aw, h: L.alto, m: Math.ceil(o.tam * 0.3),
        tr: [['t', 0, (1 - p) * subir], ['rx', (1 - p) * giroX]], origen: [aw / 2, L.alto], op: clamp(p * 1.8),
        firma: `${ch}|${o.fuente}|${o.color}|${L.base}`, pintar: (gg) => escribir(gg, ch, 0, L.base, o.fuente, 0, o.color)});
      lx += aw;
    });
    nodos.push({id: `${o.id}p${pi}`, x, y: o.y, w: lx, h: L.alto, persp: 600, hijos: letras});
    x += lx + (pi < palabras.length - 1 ? M.espacio : 0);
  });
  return {nodos, ancho: x - o.x};
}

/* ── el tambor: una tira con los dígitos 9, 0, 1 … 9, 0, 1, 2 (pintada una vez) y la ventana que la recorre ── */
const TIRAS = new Map<string, HTMLCanvasElement>();
export function pintarTambor(g: CanvasRenderingContext2D, o: {pos: number | number[]; x: number; top: number; cw: number; tam: number; fuente: string; ls: number;
  linea: number; color: string; borroso?: number; sombra?: (gg: CanvasRenderingContext2D, k: number) => void; listo: boolean}) {
  const k = escalaDe(g);
  const vw = 1.8 * o.cw, vh = 1.2 * o.tam, vx = o.x - 0.4 * o.cw;
  const pw = Math.ceil(vw * k), ph = Math.ceil(vh * k);
  const clave = `${o.fuente}|${o.color}|${vw.toFixed(2)}|${k}|${o.linea}|${o.ls}|${o.listo}|${o.sombra ? 's' : ''}`;
  let tira = TIRAS.get(clave);
  if (!tira) {
    tira = lienzo();
    const gt = preparar(tira, pw, 13 * vh * k);
    gt.setTransform(k, 0, 0, k, 0, 0);
    if (o.sombra) o.sombra(gt, k);
    for (let i = 0; i < 13; i++) {
      const dg = String((i + 9) % 10);
      gt.font = o.fuente; (gt as any).letterSpacing = '0px';
      gt.fillStyle = o.color; gt.textBaseline = 'alphabetic'; gt.textAlign = 'left';
      gt.fillText(dg, (vw - (gt.measureText(dg).width + o.ls)) / 2, o.linea + i * vh);
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
    const y0 = ((((b % 10) + 10) % 10) + 1 + frac) * vh * k;
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

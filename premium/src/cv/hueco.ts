// (30-oct-2026) Cámara viva — LAS CUENTAS de la lámina, sin nada de React: la cámara de cada lámina, cómo entra su objeto, el paso a la
// siguiente y DÓNDE va tu video cuando va en el recuadro. Las usan el dibujo (laminas.tsx: vista previa y video final) y el ensamblador
// (cv-hueco.js, este mismo archivo empaquetado), que lleva tu video a ese recuadro con ffmpeg. Lo que se ve es lo que sale.
import type {Momento, Material, Rect} from './laminas';

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const p = (t: number, a: number, d = 0.4) => clamp((t - a) / d);
const sale = (x: number, n: number) => 1 - Math.pow(1 - x, n);

/* ── la cámara de una lámina: arranca cerca, llega al 90 % con la curva de salida y el resto lo recorre despacio ── */
export type Cam = {z: number; x: number; y: number};
export const camLamina = (t: number, a: number, b: number, z: [number, number] = [1.3, 1], x: [number, number] = [0, 0], y: [number, number] = [0, 0], asienta = 0.9): Cam => {
  const k = t < a + asienta ? 0.9 * sale(clamp((t - a) / asienta), 4) : 0.9 + 0.1 * Math.sin((clamp((t - a - asienta) / Math.max(0.2, b - a - asienta)) * Math.PI) / 2);
  return {z: lerp(z[0], z[1], k), x: lerp(x[0], x[1], k), y: lerp(y[0], y[1], k)};
};

export const TARJETA_TOP = 710;
export const PASO = 0.55;       // lo que tarda la cámara en pasar de una lámina a la siguiente (medido en la referencia de kayn)
export const GRAFICOS_IDS = ['contador', 'barras', 'porcentaje', 'linea', 'antes_despues', 'multiplicador', 'reloj', 'temporizador', 'calendario',
  'seguir', 'comentario', 'me_gusta', 'notificaciones', 'chat', 'guardar', 'buscador', 'flecha', 'chequeos', 'sello', 'precio'];

export const pasoK = (t: number, m: Momento) => {
  const u = clamp((clamp((t - m.t0) / PASO) - 0.14) / 0.86);
  return 1 - Math.pow(1 - u, 3.2);
};
export const lado = (m: Momento) => ((m.ladoG ?? m.semilla ?? 0) % 2 ? 1 : -1);

/* ── LAS ENTRADAS (29-oct). Sergio: «hace un par de movimientos y repite el mismo ciclo». Cada lámina entra con una de
   cinco, por turno (dos seguidas nunca iguales):
     sube   — el objeto sube a su sitio y la cámara se asienta corrida a un lado (la de siempre)
     barre  — el objeto entra de lado y la cámara lo sigue
     aleja  — arranca muy cerca del objeto y la cámara se abre (lo revela)
     cae    — el objeto baja desde arriba
     acerca — la cámara entra despacio durante toda la lámina
   Con tu video en el recuadro todo va más suave y sin zoom inmediato (lo agrandaba casi a pantalla completa); la tarjeta de
   un gráfico es ancha: también más suave. Los mismos números dibujan y ubican tu video en el hueco (clipVideo). ── */
type Entrada = 'sube' | 'barre' | 'aleja' | 'cae' | 'acerca';
const ENTRADAS: Entrada[] = ['sube', 'barre', 'aleja', 'cae', 'acerca'];
export const entradaDe = (m: Momento): Entrada => ENTRADAS[(m.orden ?? m.semilla ?? 0) % ENTRADAS.length];
const fuerza = (m: Momento) => (m.clip ? 0.55 : m.objeto?.tipo === 'grafico' ? 0.5 : 1);
export const camDe = (t: number, m: Momento): Cam => {
  if (m.paso) return {z: 1 + 0.025 * Math.sin((clamp((t - m.t0) / Math.max(0.5, m.t1 - m.t0)) * Math.PI) / 2), x: 0, y: 0};   // ya llegó viajando: solo sigue viva
  const e = entradaDe(m), l = lado(m), f = fuerza(m), z = (a: number) => 1 + (a - 1) * f;
  if (e === 'acerca') {
    const k = Math.sin((clamp((t - m.t0) / Math.max(0.5, m.t1 - m.t0)) * Math.PI) / 2);
    return {z: lerp(1, z(1.08), k), x: 0, y: lerp(0, -24 * f, k)};
  }
  if (e === 'aleja') return camLamina(t, m.t0, m.t1, [z(1.5), 1.0], [0, 0], [-40 * f, 0], 0.8);
  if (e === 'barre') return camLamina(t, m.t0, m.t1, [z(1.12), 1.0], [120 * l * f, 0], [0, 0], 0.8);
  if (e === 'cae') return camLamina(t, m.t0, m.t1, [z(1.15), 1.0], [-30 * l * f, 0], [-60 * f, 0], 0.9);
  return camLamina(t, m.t0, m.t1, [z(1.2), 1.0], [46 * l * f, 0], [70 * f, 0], 0.9);     // sube
};
// el zoom inmediato en la palabra que nombra el objeto: no con tu video (crecía de más); con la tarjeta de un gráfico, y
// cuando la cámara ya viene entrando («acerca»), menos (sumados lo agrandaban de más)
export const zoomDe = (t: number, m: Momento) => (m.zoomT != null && t >= m.zoomT && !m.clip
  ? (m.objeto?.tipo === 'grafico' ? 1.1 : entradaDe(m) === 'acerca' ? 1.14 : 1.22) * (1 + 0.03 * clamp((t - m.zoomT) / 1.5)) : 1);
export const entraDe = (t: number, m: Momento) => (m.paso ? 1 : outCubic((t - m.t0) / 0.55));   // 0 → 1: el objeto llega a su sitio (con desenfoque)
// dónde va el objeto mientras llega: corrido (dx, dy) y de qué tamaño (s, desde su centro OBJ_Y)
export const OBJ_Y = 1080;
export const objetoDe = (t: number, m: Momento) => {
  if (m.paso) return {dx: 0, dy: 0, s: 1};
  const e = entradaDe(m), u = 1 - entraDe(t, m), l = lado(m);
  if (e === 'barre') return {dx: 260 * l * u, dy: 0, s: 1};
  if (e === 'cae') return {dx: 0, dy: -120 * u, s: 1};
  if (e === 'acerca') return {dx: 0, dy: 0, s: 1 - 0.08 * u};
  if (e === 'aleja') return {dx: 0, dy: 0, s: 1 + 0.06 * u};
  return {dx: 0, dy: 140 * u, s: 1};                                                     // sube
};
/* el objeto crece desde su borde de arriba (hacia abajo y a los lados): ni la cámara ni el zoom lo montan sobre el rótulo */
export const origenY = (m: Momento) => (m.objeto?.tipo === 'grafico' ? TARJETA_TOP : 550);

/* ── CLIP: tu video en un rectángulo de esquinas redondas: el rectángulo después de su entrada (corrido y de su tamaño, desde OBJ_Y),
   de la cámara de la lámina y del zoom inmediato: el mismo orden que Encuadre ── */
export const CLIP = {x: 150, y: 560, w: 780, h: 1040, r: 52};
export const clipVideo = (t: number, m: Momento): Rect => {
  const cam = camDe(t, m), o = objetoDe(t, m), k = cam.z * zoomDe(t, m), oy = origenY(m);
  const x0 = 540 + (CLIP.x + CLIP.w / 2 - 540) * o.s + o.dx, y0 = OBJ_Y + (CLIP.y + CLIP.h / 2 - OBJ_Y) * o.s + o.dy;
  const cx = 540 + (x0 - 540) * k + cam.x, cy = oy + (y0 - oy) * k + cam.y, s = k * o.s;
  return {left: cx - (CLIP.w * s) / 2, top: cy - (CLIP.h * s) / 2, width: CLIP.w * s, height: CLIP.h * s, radio: CLIP.r * s, rot: 0};
};

/* ── qué lleva la lámina: tu video va en el recuadro si es un clip, una imagen que aún no existe o un gráfico desconocido ── */
export const usaClip = (m: Momento, mat: Material) => m.objeto?.tipo === 'clip' || (m.objeto?.tipo === 'imagen' && !mat.objeto) || (m.objeto?.tipo === 'grafico' && GRAFICOS_IDS.indexOf(m.objeto.grafico || '') < 0);
export const conClip = (m: Momento, mat: Material): Momento => (m.clip === usaClip(m, mat) ? m : {...m, clip: usaClip(m, mat)});

/* ── el paso de una lámina a la otra ── */
export const enPaso = (t: number, m: Momento) => !!m.paso && t < m.t0 + PASO;
const dirDe = (m: Momento) => (m.paso?.dir === 'izq' ? [-1, 0] : m.paso?.dir === 'abajo' ? [0, 1] : [1, 0]);
export const offAnt = (t: number, m: Momento) => { const k = pasoK(t, m), d = dirDe(m); return {x: -1080 * d[0] * k, y: -1920 * d[1] * k}; };
export const offCur = (t: number, m: Momento) => { const k = 1 - pasoK(t, m), d = dirDe(m); return {x: 1080 * d[0] * k, y: 1920 * d[1] * k}; };
export const anteriorDe = (m: Momento) => ({m: conClip(m.paso!.ant.m, m.paso!.ant.mat), mat: m.paso!.ant.mat});

/* DÓNDE VA TU VIDEO en este instante: null = la lámina lo tapa · Rect = en ese recuadro */
export const recuadroDe = (t: number, m0: Momento, mat: Material): Rect | null => {
  const m = conClip(m0, mat);
  if (enPaso(t, m)) {
    const a = anteriorDe(m), mueve = (r: Rect, d: {x: number; y: number}): Rect => ({...r, left: r.left + d.x, top: r.top + d.y});
    return m.clip ? mueve(clipVideo(t, m), offCur(t, m)) : a.m.clip ? mueve(clipVideo(t, a.m), offAnt(t, m)) : null;
  }
  return m.clip ? clipVideo(t, m) : null;
};

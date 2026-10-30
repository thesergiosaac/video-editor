// (30-oct-2026) Cámara viva v4 — LA LÁMINA, una sola. Sergio, 29-oct: «Fondo con sombras + Objeto (imagen, clip o gráfico)
// + títulos y subtítulos con sombras y animaciones de entrada y salida + movimientos de cámara. Esa es la esencia de Cámara
// viva, no más… menos es más». Referencias: su reel del Día 4 y el de kayn.marketing (fondo plano con una sombra grande
// desenfocada, una línea chica y una gruesa que entran palabra por palabra, y UN objeto con sombra suave).
//   · fondo: un color plano (crema, o el que escoja la persona) con la sombra de la persiana;
//   · objeto (uno solo):
//       imagen  — un recorte sin fondo que sube a su sitio con sombra de sol y su sombra en el piso;
//       clip    — TU video, más pequeño, en un rectángulo de esquinas redondas con sombra (el video va en el hueco);
//       grafico — una tarjeta blanca: un contador, barras, un comentario que se escribe solo o el botón de seguir;
//   · texto: una línea chica y una gruesa (kit › Rotulo);
//   · cámara: entra cerca y se asienta (nunca quieta); el fondo se mueve menos que el objeto (profundidad) y en la palabra
//     que nombra el objeto, zoom inmediato.
// Cada lámina recibe el momento del plan (m) y su material (mat: el recorte, que es de EJEMPLO mientras la persona no ponga
// el suyo). Todo en el cuadro de 1080 × 1920; t = segundo del video.
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {EstiloTexto, camLamina, Cam, Capa, FondoPlano, Rotulo, esOscuro, sombraDe, sombraCaja, clamp, lerp} from './kit';
import {GRAFICOS, TARJETA_TOP, PASO, desenfoqueEntrada} from './graficos';

export type Objeto = {tipo: 'imagen' | 'clip' | 'grafico'; grafico?: string; barras?: {k: string; v: number}[]; es?: string; ve?: string; [campo: string]: any};
export type Momento = {plantilla: string; t0: number; t1: number; fondo?: string | null; texto: {chica?: string; gruesa?: string; rojas?: string[]};
  objeto: Objeto; zoomT?: number | null; tiempos: {chica: number; gruesa: number}; semilla?: number;
  orden?: number;     // (29-oct) el n.º de la lámina en el video: le toca la entrada ENTRADAS[orden % 5]
  estiloTexto?: EstiloTexto | null;   // (30-oct) la letra y los colores de una plantilla de subtítulos
  acento?: string | null;   // (30-oct) el color de acento de los gráficos y las palabras clave (tema.ts); sin él, rubí
  // (30-oct) Sergio: «a veces puede ser lámina y lámina… parece una sola lámina y el resto está fuera de pantalla». La lámina que
  // sigue pegada a otra no entra: la cámara viaja hasta ella (camara-viva.js › piezas decide cuándo)
  paso?: {dir: 'der' | 'izq' | 'abajo'; ant: {m: Momento; mat: Material}} | null;
  sigue?: boolean;    // la cámara se va de aquí a la siguiente: el texto no se apaga, se queda en su sitio
  t00?: number;       // cuándo empezó este tramo de láminas pegadas (el fondo es uno solo)
  nPasos?: number; ladoG?: number;
  clip?: boolean};    // va tu video en el recuadro (lo pone la plantilla con usaClip): movimientos más suaves, sin zoom
export type Material = {objeto?: string; foto?: string; ejemplo?: boolean; cuenta?: {usuario?: string; seguidores?: number; seguidos?: number; publicaciones?: number}};
type P = {t: number; m: Momento; mat: Material};
export type Rect = {left: number; top: number; width: number; height: number; radio: number; rot: number};

const outCubicLocal = (x: number) => 1 - Math.pow(1 - x, 3);
export const pasoK = (t: number, m: Momento) => {
  const u = clamp((clamp((t - m.t0) / PASO) - 0.14) / 0.86);
  return 1 - Math.pow(1 - u, 3.2);
};
const lado = (m: Momento) => ((m.ladoG ?? m.semilla ?? 0) % 2 ? 1 : -1);
const CENTRO = {x: 540, y: 1120};                       // el centro del objeto (debajo del rótulo, encima de la zona que tapa Instagram)
const TEXTO_TOP = 300, TEXTO_TOP_GRAFICO = 470;

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
const entradaDe = (m: Momento): Entrada => ENTRADAS[(m.orden ?? m.semilla ?? 0) % ENTRADAS.length];
const fuerza = (m: Momento) => (m.clip ? 0.55 : m.objeto?.tipo === 'grafico' ? 0.5 : 1);
const camDe = (t: number, m: Momento): Cam => {
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
const zoomDe = (t: number, m: Momento) => (m.zoomT != null && t >= m.zoomT && !m.clip
  ? (m.objeto?.tipo === 'grafico' ? 1.1 : entradaDe(m) === 'acerca' ? 1.14 : 1.22) * (1 + 0.03 * clamp((t - m.zoomT) / 1.5)) : 1);
const entraDe = (t: number, m: Momento) => (m.paso ? 1 : outCubicLocal(clamp((t - m.t0) / 0.55)));   // 0 → 1: el objeto llega a su sitio (con desenfoque)
// dónde va el objeto mientras llega: corrido (dx, dy) y de qué tamaño (s, desde su centro OBJ_Y)
const OBJ_Y = 1080;
const objetoDe = (t: number, m: Momento) => {
  if (m.paso) return {dx: 0, dy: 0, s: 1};
  const e = entradaDe(m), u = 1 - entraDe(t, m), l = lado(m);
  if (e === 'barre') return {dx: 260 * l * u, dy: 0, s: 1};
  if (e === 'cae') return {dx: 0, dy: -120 * u, s: 1};
  if (e === 'acerca') return {dx: 0, dy: 0, s: 1 - 0.08 * u};
  if (e === 'aleja') return {dx: 0, dy: 0, s: 1 + 0.06 * u};
  return {dx: 0, dy: 140 * u, s: 1};                                                     // sube
};
/* el objeto crece desde su borde de arriba (hacia abajo y a los lados): ni la cámara ni el zoom lo montan sobre el rótulo */
const origenY = (m: Momento) => (m.objeto?.tipo === 'grafico' ? TARJETA_TOP : 550);
const Encuadre: React.FC<{t: number; m: Momento; children: React.ReactNode}> = ({t, m, children}) => {
  const cam = camDe(t, m), o = objetoDe(t, m), k = cam.z * zoomDe(t, m);
  return (
    <AbsoluteFill style={{transformOrigin: `540px ${origenY(m)}px`, transform: `translate(${cam.x}px,${cam.y}px) scale(${k})`}}>
      <AbsoluteFill style={{transformOrigin: `540px ${OBJ_Y}px`, transform: `translate(${o.dx}px,${o.dy}px) scale(${o.s})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
/* el fondo va detrás y se mueve menos (profundidad) */
const Fondo: React.FC<{t: number; m: Momento}> = ({t, m}) => (
  // un tramo de láminas pegadas es UN solo fondo: su persiana sigue corriendo y se desliza un poco cuando la cámara viaja
  <Capa cam={camDe(t, m)} prof={0.35} extra={0.04}><FondoPlano t={t - (m.t00 ?? m.t0) - 4 + 4 * ((m.nPasos || 0) - (m.paso ? 1 - pasoK(t, m) : 0))} color={m.fondo} lado={lado(m)} /></Capa>
);
const esGrafico = (m: Momento, mat: Material) => m.objeto?.tipo === 'grafico' && !usaClip(m, mat);
const Texto: React.FC<{t: number; m: Momento; mat: Material}> = ({t, m, mat}) => (
  <Rotulo t={t} t1={m.sigue ? m.t1 + 99 : m.t1} chica={m.texto.chica} gruesa={m.texto.gruesa} rojas={m.texto.rojas} a={m.tiempos} oscuro={esOscuro(m.fondo)} estilo={m.estiloTexto} acento={m.acento}
    top={esGrafico(m, mat) ? TEXTO_TOP_GRAFICO : TEXTO_TOP} />
);

/* ── IMAGEN: el recorte sube a su sitio, con sombra de sol y su sombra en el piso; flota apenas (nunca se tuerce) ── */
const Imagen: React.FC<P> = ({t, m, mat}) => {
  const osc = esOscuro(m.fondo);
  return (
    <div style={{position: 'absolute', inset: 0, ...desenfoqueEntrada(t, m)}}>
      <Img src={mat.objeto!} style={{position: 'absolute', left: 110, top: 540, width: 860, height: 1120, objectFit: 'contain', objectPosition: '50% 45%',
        filter: sombraDe(osc), transform: `translateY(${Math.sin((t - m.t0) * 1.1) * 7}px)`}} />
    </div>
  );
};

/* ── CLIP: tu video en un rectángulo de esquinas redondas. Debajo (fondo) va su sombra; tu video se pone en el hueco ── */
const CLIP = {x: 150, y: 560, w: 780, h: 1040, r: 52};
const ClipSombra: React.FC<{t: number; m: Momento}> = ({t, m}) => (
  <div style={{position: 'absolute', left: CLIP.x, top: CLIP.y, width: CLIP.w, height: CLIP.h, borderRadius: CLIP.r, background: esOscuro(m.fondo) ? '#000' : '#2a2420', boxShadow: sombraCaja(esOscuro(m.fondo))}} />
);
const clipVideo = (t: number, m: Momento): Rect => {
  // el rectángulo después de su entrada (corrido y de su tamaño, desde OBJ_Y), de la cámara de la lámina y del zoom
  // inmediato: el mismo orden que Encuadre
  const cam = camDe(t, m), o = objetoDe(t, m), k = cam.z * zoomDe(t, m), oy = origenY(m);
  const x0 = 540 + (CLIP.x + CLIP.w / 2 - 540) * o.s + o.dx, y0 = OBJ_Y + (CLIP.y + CLIP.h / 2 - OBJ_Y) * o.s + o.dy;
  const cx = 540 + (x0 - 540) * k + cam.x, cy = oy + (y0 - oy) * k + cam.y, s = k * o.s;
  return {left: cx - (CLIP.w * s) / 2, top: cy - (CLIP.h * s) / 2, width: CLIP.w * s, height: CLIP.h * s, radio: CLIP.r * s, rot: 0};
};

/* ── LA LÁMINA: qué objeto lleva y dónde va tu video ── */
/* ── EL PASO DE UNA LÁMINA A LA OTRA. Medido en la referencia (kayn.marketing, seg. 2,50): arranca suave, en 0,3 s ya recorrió el
   85 % y luego se asienta; todo se va junto (objeto y texto), como si fuera un solo lienzo y la cámara se moviera por él ── */
const usaClip = (m: Momento, mat: Material) => m.objeto?.tipo === 'clip' || (m.objeto?.tipo === 'imagen' && !mat.objeto) || (m.objeto?.tipo === 'grafico' && !GRAFICOS[m.objeto.grafico || '']);
const conClip = (m: Momento, mat: Material): Momento => (m.clip === usaClip(m, mat) ? m : {...m, clip: usaClip(m, mat)});
const enPaso = (t: number, m: Momento) => !!m.paso && t < m.t0 + PASO;
const dirDe = (m: Momento) => (m.paso?.dir === 'izq' ? [-1, 0] : m.paso?.dir === 'abajo' ? [0, 1] : [1, 0]);
const offAnt = (t: number, m: Momento) => { const k = pasoK(t, m), d = dirDe(m); return {x: -1080 * d[0] * k, y: -1920 * d[1] * k}; };
const offCur = (t: number, m: Momento) => { const k = 1 - pasoK(t, m), d = dirDe(m); return {x: 1080 * d[0] * k, y: 1920 * d[1] * k}; };
const Mundo: React.FC<{d: {x: number; y: number}; children: React.ReactNode}> = ({d, children}) => <AbsoluteFill style={{transform: `translate(${d.x}px,${d.y}px)`}}>{children}</AbsoluteFill>;
const Panel: React.FC<P> = ({t, m, mat}) => {
  if (m.clip) return <Texto t={t} m={m} mat={mat} />;   // tu video va debajo, en el hueco
  const G = m.objeto.tipo === 'grafico' ? GRAFICOS[m.objeto.grafico || ''] : null;
  return <><Encuadre t={t} m={m}>{G ? <G t={t} m={m} mat={mat} /> : <Imagen t={t} m={m} mat={mat} />}</Encuadre><Texto t={t} m={m} mat={mat} /></>;
};
const anteriorDe = (m: Momento) => ({m: conClip(m.paso!.ant.m, m.paso!.ant.mat), mat: m.paso!.ant.mat});
const LaminaFrente: React.FC<P> = (pr0) => {
  const pr = {...pr0, m: conClip(pr0.m, pr0.mat)}, {t, m, mat} = pr;
  if (enPaso(t, m)) {
    const a = anteriorDe(m);
    return (
      <AbsoluteFill>
        {!a.m.clip && !m.clip && <Fondo t={t} m={m} />}
        <Mundo d={offAnt(t, m)}><Panel t={t} m={a.m} mat={a.mat} /></Mundo>
        <Mundo d={offCur(t, m)}><Panel t={t} m={m} mat={mat} /></Mundo>
      </AbsoluteFill>
    );
  }
  if (m.clip) return <AbsoluteFill><Texto t={t} m={m} mat={mat} /></AbsoluteFill>;
  return (
    <AbsoluteFill>
      <Fondo t={t} m={m} />
      <Panel t={t} m={m} mat={mat} />
    </AbsoluteFill>
  );
};
const LaminaFondo: React.FC<P> = ({t, m: m0, mat}) => {
  const m = conClip(m0, mat);
  if (enPaso(t, m)) {
    const a = anteriorDe(m);
    return (
      <AbsoluteFill>
        <Fondo t={t} m={m} />
        {a.m.clip && <Mundo d={offAnt(t, m)}><Encuadre t={t} m={a.m}><ClipSombra t={t} m={a.m} /></Encuadre></Mundo>}
        {m.clip && <Mundo d={offCur(t, m)}><Encuadre t={t} m={m}><ClipSombra t={t} m={m} /></Encuadre></Mundo>}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Fondo t={t} m={m} />
      <Encuadre t={t} m={m}><ClipSombra t={t} m={m} /></Encuadre>
    </AbsoluteFill>
  );
};

/* ── el registro: lo que se dibuja ENCIMA de tu video (frente), DEBAJO (fondo) y dónde va tu video ──
   video: null = tu video no se ve (la lámina lo tapa todo) · 'camara' = sigue con su cámara · Rect = en ese hueco */
type Plantilla = {frente: React.FC<P>; fondo?: React.FC<P>; video: (t: number, m: Momento, mat: Material) => null | 'camara' | Rect};
export const PLANTILLAS: Record<string, Plantilla> = {
  lamina: {frente: LaminaFrente, fondo: LaminaFondo, video: (t, m0, mat) => {
    const m = conClip(m0, mat);
    if (enPaso(t, m)) {
      const a = anteriorDe(m), mueve = (r: Rect, d: {x: number; y: number}): Rect => ({...r, left: r.left + d.x, top: r.top + d.y});
      return m.clip ? mueve(clipVideo(t, m), offCur(t, m)) : a.m.clip ? mueve(clipVideo(t, a.m), offAnt(t, m)) : null;
    }
    return m.clip ? clipVideo(t, m) : null;
  }},
};
export const tieneFondo = (m: Momento, mat: Material) => !!PLANTILLAS[m.plantilla]?.fondo && PLANTILLAS[m.plantilla].video(m.t0, m, mat) !== null;

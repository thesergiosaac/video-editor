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
import {EstiloTexto, Capa, FondoPlano, Rotulo, esOscuro, sombraDe, sombraCaja} from './kit';
import {GRAFICOS, desenfoqueEntrada} from './graficos';
import {CLIP, OBJ_Y, TARJETA_TOP, anteriorDe, camDe, conClip, enPaso, lado, objetoDe, offAnt, offCur, origenY, pasoK, recuadroDe, usaClip, zoomDe} from './hueco';

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

const TEXTO_TOP = 300, TEXTO_TOP_GRAFICO = 470;

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
const ClipSombra: React.FC<{t: number; m: Momento}> = ({t, m}) => (
  <div style={{position: 'absolute', left: CLIP.x, top: CLIP.y, width: CLIP.w, height: CLIP.h, borderRadius: CLIP.r, background: esOscuro(m.fondo) ? '#000' : '#2a2420', boxShadow: sombraCaja(esOscuro(m.fondo))}} />
);

/* ── LA LÁMINA: qué objeto lleva y dónde va tu video ── */
const Mundo: React.FC<{d: {x: number; y: number}; children: React.ReactNode}> = ({d, children}) => <AbsoluteFill style={{transform: `translate(${d.x}px,${d.y}px)`}}>{children}</AbsoluteFill>;
const Panel: React.FC<P> = ({t, m, mat}) => {
  if (m.clip) return <Texto t={t} m={m} mat={mat} />;   // tu video va debajo, en el hueco
  const G = m.objeto.tipo === 'grafico' ? GRAFICOS[m.objeto.grafico || ''] : null;
  return <><Encuadre t={t} m={m}>{G ? <G t={t} m={m} mat={mat} /> : <Imagen t={t} m={m} mat={mat} />}</Encuadre><Texto t={t} m={m} mat={mat} /></>;
};
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
  lamina: {frente: LaminaFrente, fondo: LaminaFondo, video: (t, m, mat) => recuadroDe(t, m, mat)},
};
export const tieneFondo = (m: Momento, mat: Material) => !!PLANTILLAS[m.plantilla]?.fondo && PLANTILLAS[m.plantilla].video(m.t0, m, mat) !== null;

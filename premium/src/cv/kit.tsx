// (29-oct-2026) Cámara viva — EL KIT común de las láminas y los títulos. Copiado del reel del Día 4 («Cherry 9»,
// Cherry Taller\camara-viva\codigo\remotion\kit9.tsx y C9.tsx) para que cualquier video salga con el mismo lenguaje:
// la cámara que entra cerca y se asienta (nunca quieta), capas a distinta profundidad, zoom inmediato, papel con persiana,
// fondo oscuro con luces rubí, sombra de sol, textos que entran palabra por palabra con desenfoque y caja rubí.
// Todo en el cuadro de 1080 × 1920; t = segundo del video.
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {loadFont as cargarUrbanist} from '@remotion/google-fonts/Urbanist';
import {loadFont as cargarCaslon} from '@remotion/google-fonts/LibreCaslonText';

export const urb = cargarUrbanist('normal', {weights: ['600', '800'], subsets: ['latin']}).fontFamily;
// Libre Caslon itálica solo existe en 400 (pedir otro peso tumba el visor)
export const cas = cargarCaslon('italic', {weights: ['400'], subsets: ['latin']}).fontFamily;
export const R = {rubi: '#9B111E', rubiClaro: '#c8283a', tinta: '#16120F', blanco: '#ffffff', oro: '#e9b45a'};
export const MARGEN = {lado: 96, arriba: 260, abajo: 420};

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
/* varios puntos: entre uno y otro, curva de salida; corte = ZOOM INMEDIATO (salta en un cuadro) */
export type KF = {t: number; z: number; x?: number; y?: number; d?: number; corte?: boolean};
export const camKF = (t: number, kfs: KF[]): Cam => {
  let z = kfs[0].z, x = kfs[0].x ?? 0, y = kfs[0].y ?? 0, desde = kfs[0].t;
  for (let i = 1; i < kfs.length; i++) {
    const k = kfs[i];
    if (t < k.t) break;
    const d = k.d ?? 0.7;
    const e = k.corte ? 1 : clamp((t - k.t) / d) < 1 ? 0.9 * (1 - Math.pow(1 - clamp((t - k.t) / d), 4)) : 0.9 + 0.1 * Math.min(1, (t - k.t - d) / 1.2);
    z = lerp(z, k.z, e); x = lerp(x, k.x ?? 0, e); y = lerp(y, k.y ?? 0, e);
    desde = k.t + (k.corte ? 0 : d);
    if (e < 1) return {z, x, y};
  }
  return {z: z * (1 + 0.012 * Math.max(0, t - desde)), x, y};
};
/* una capa se mueve con la cámara según su profundidad (fondo ≈ 0,5; medio 0,8–1; frente 1,3–1,8) */
export const Capa: React.FC<{cam: Cam; prof: number; extra?: number; children: React.ReactNode}> = ({cam, prof, extra = 0, children}) => (
  <AbsoluteFill style={{transformOrigin: '50% 50%', transform: `translate(${cam.x * prof}px,${cam.y * prof}px) scale(${1 + (cam.z - 1) * prof + extra})`}}>{children}</AbsoluteFill>
);
/* zoom inmediato: en «a» la escena salta (un cuadro) a ×k sobre (ox, oy) y sigue acercándose un poco; en «b» vuelve */
export const Zoom: React.FC<{t: number; a: number | null; b?: number; k: number; ox: number; oy: number; children: React.ReactNode}> = ({t, a, b = 999, k, ox, oy, children}) => {
  const dentro = a != null && t >= a && t < b;
  const s = dentro ? k * (1 + 0.03 * clamp((t - (a as number)) / 1.5)) : 1;
  return <AbsoluteFill style={{transformOrigin: `${ox}px ${oy}px`, transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};

/* ── fondos ── */
export const Fondo: React.FC<{src: string; brillo?: number}> = ({src, brillo = 1}) => (
  <Img src={src} style={{position: 'absolute', left: -60, top: -110, width: 1200, height: 2140, objectFit: 'cover', filter: brillo !== 1 ? `brightness(${brillo})` : undefined}} />
);
export const Grano: React.FC<{o?: number}> = ({o = 0.16}) => (
  <AbsoluteFill style={{opacity: o, mixBlendMode: 'overlay', backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .6  0 0 0 0 .55  0 0 0 0 .5  0 0 0 .7 0"/></filter><rect width="300" height="300" filter="url(#g)"/></svg>')}")`}} />
);
export const Vineta: React.FC<{o?: number}> = ({o = 0.75}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 70% at 50% 45%, transparent 45%, rgba(0,0,0,${o}) 100%)`}} />
);
/* ⭐ recurso aprobado (29-sep): la sombra de una persiana sobre un fondo liso, que se desliza despacio */
export const SombraPersiana: React.FC<{t: number; fuerza?: number; angulo?: number; tinte?: string; desenfoque?: number}> = ({t, fuerza = 0.5, angulo = -68, tinte = '0,0,25', desenfoque = 30}) => {
  const mascara = 'linear-gradient(195deg, #000 0%, rgba(0,0,0,.55) 38%, transparent 70%)';
  return <AbsoluteFill style={{background: `repeating-linear-gradient(${angulo}deg, rgba(${tinte},${fuerza}) 0 95px, rgba(${tinte},0) 95px 230px)`, filter: `blur(${desenfoque}px)`,
    transform: `translate(${-60 + t * 14}px, -140px) scale(1.3)`, WebkitMaskImage: mascara, maskImage: mascara}} />;
};
/* papel beige con luz, persiana, viñeta suave y grano (las sombras de sol se notan) */
export const Papel: React.FC<{t: number; tono?: string}> = ({t, tono = '#e9e0cf'}) => (
  <AbsoluteFill style={{background: tono}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 60% at 45% 35%, rgba(255,255,255,.55), transparent 70%)'}} />
    <SombraPersiana t={t} fuerza={0.32} tinte="60,35,20" />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(80,50,30,.28) 100%)'}} />
    <Grano o={0.22} />
  </AbsoluteFill>
);
/* fondo oscuro de diseño: rubí y oro desenfocados que se mueven, viñeta y grano */
export const FondoDiseno: React.FC<{t: number; tono?: number}> = ({t, tono = 0}) => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 55% at 50% 45%, #2a0b0e 0%, #12070a 55%, #050304 100%)'}}>
    <div style={{position: 'absolute', left: -260 + Math.sin(t * 0.6 + tono) * 40, top: 260, width: 760, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,17,30,.55), transparent 62%)', filter: 'blur(50px)'}} />
    <div style={{position: 'absolute', left: 560 + Math.cos(t * 0.5 + tono) * 40, top: 1050, width: 720, height: 720, borderRadius: '50%', background: 'radial-gradient(circle, rgba(233,180,90,.25), transparent 62%)', filter: 'blur(60px)'}} />
    <Grano />
  </AbsoluteFill>
);
/* la pared blanca de galería con luz de techo */
export const Galeria: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{background: '#f4f1ea'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 60% 40% at 50% 8%, rgba(255,255,255,.95), transparent 70%)'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 1500, bottom: 0, background: 'linear-gradient(180deg, #d9d2c4, #c8bfae)'}} />
    <SombraPersiana t={t} fuerza={0.16} tinte="70,50,30" />
    <Grano o={0.14} />
  </AbsoluteFill>
);
/* polvo o chispas en primer plano, desenfocadas: dan la profundidad que pide el estilo */
export const Particulas: React.FC<{t: number; cam: Cam; color?: string; n?: number; semilla?: number}> = ({t, cam, color = 'rgba(255,220,160,.55)', n = 14, semilla = 3}) => (
  <AbsoluteFill>
    {Array.from({length: n}, (_, i) => {
      const r = (k: number) => { const s = Math.sin((i + 1) * 12.9898 * (k + semilla)) * 43758.5453; return s - Math.floor(s); };
      const prof = 1.6 + r(1) * 1.2, x0 = r(2) * 1080, y0 = r(3) * 1920, tam = 10 + r(4) * 34;
      const s = 1 + (cam.z - 1) * prof;
      return <div key={i} style={{position: 'absolute', left: 540 + (x0 - 540) * s + cam.x * prof + Math.sin(t * 0.7 + i) * 18, top: 960 + (y0 - 960) * s + cam.y * prof - (t * 26 * prof) % 220,
        width: tam, height: tam, borderRadius: '50%', background: color, filter: `blur(${4 + prof * 3}px)`}} />;
    })}
  </AbsoluteFill>
);

/* ── objetos ── */
export const SOL = 'drop-shadow(34px 44px 30px rgba(70,40,20,.38)) drop-shadow(8px 10px 10px rgba(70,40,20,.22))';
export const SOL_OSCURO = 'drop-shadow(30px 40px 30px rgba(0,0,0,.65))';

/* ── textos: entran con desenfoque (nunca solo opacidad) ── */
export const entra = (t: number, a: number, b = 999, d = 34, desde: 'abajo' | 'izq' | 'der' = 'abajo'): React.CSSProperties => {
  const e = outCubic(p(t, a, 0.42)), s = p(t, b, 0.22), k = e * (1 - s), m = (1 - e) * d;
  return {opacity: clamp(k * 1.3), filter: k < 1 ? `blur(${lerp(16, 0, k)}px)` : undefined, transform: desde === 'abajo' ? `translateY(${m}px)` : `translateX(${desde === 'izq' ? -m : m}px)`};
};
export const Etiqueta: React.FC<{n?: string; children: React.ReactNode; tam?: number; color?: string}> = ({n, children, tam = 30, color = R.blanco}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, fontFamily: urb, fontWeight: 800, fontSize: tam, letterSpacing: '.14em', textTransform: 'uppercase', color, textShadow: color === R.blanco ? '0 6px 26px rgba(0,0,0,.55)' : undefined}}>
    {n && <span style={{border: `3px solid ${color}`, padding: '2px 12px', letterSpacing: '.04em'}}>{n}</span>}<span>{children}</span>
  </div>
);
/* caja rubí con volumen (degradado, brillo arriba, sombra y un destello que la recorre) */
export const CajaRubi: React.FC<{t: number; a: number; children: React.ReactNode; tam?: number; style?: React.CSSProperties}> = ({t, a, children, tam = 46, style}) => {
  const k = outCubic(p(t, a, 0.32));
  return (
    <div style={{position: 'relative', display: 'inline-block', overflow: 'hidden', padding: '16px 30px', borderRadius: 14, background: 'linear-gradient(180deg,#c3202f 0%,#9B111E 50%,#6e0a14 100%)',
      boxShadow: '0 18px 40px rgba(0,0,0,.55), 0 0 30px rgba(155,17,30,.45), inset 0 2px 0 rgba(255,255,255,.3), inset 0 -3px 6px rgba(0,0,0,.35)', clipPath: `inset(0 ${(1 - k) * 100}% 0 0 round 14px)`, ...style}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: '45%', background: 'linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0))'}} />
      <div style={{position: 'absolute', top: -20, bottom: -20, width: 90, left: lerp(-160, 1000, p(t, a + 0.45, 0.6)), background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)', transform: 'skewX(-20deg)'}} />
      <div style={{position: 'relative', fontFamily: urb, fontWeight: 800, fontSize: tam, letterSpacing: '-0.02em', color: '#fff', whiteSpace: 'nowrap', transform: `translateX(${lerp(-60, 0, outCubic(p(t, a + 0.08, 0.4)))}px)`}}>{children}</div>
    </div>
  );
};

/* tamaño que cabe: baja la letra hasta que la palabra más larga entre en el ancho (mide con canvas, ya con la letra) */
let lienzo: CanvasRenderingContext2D | null = null;
export function tamQueCabe(texto: string, ancho: number, max: number, familia: string, estilo = 'normal', peso: string | number = 800, apretado = -0.045) {
  if (!lienzo && typeof document !== 'undefined') lienzo = document.createElement('canvas').getContext('2d');
  if (!lienzo || !texto) return max;
  lienzo.font = `${estilo} ${peso} ${max}px ${familia}`;
  const largo = Math.max(...texto.split(' ').map((w) => lienzo!.measureText(w).width + w.length * apretado * max)) * 1.06;
  return largo > ancho ? Math.max(24, Math.floor((max * ancho) / largo)) : max;
}

type TipoLetra = 'gruesa' | 'remate' | 'etiqueta' | 'chica';
const limpia = (w: string) => w.replace(/[.,¿?¡!…«»"]/g, '').toLowerCase();
/* palabras que entran UNA A UNA con desenfoque fuerte. «rojas»: sobre oscuro o video en caja rubí (letra blanca); sobre
   claro, la letra va en rubí */
/* (30-oct) la letra y los colores de una plantilla de subtítulos (subtitulos.js › estiloTitulo). Sin estilo, lo de siempre */
export type LetraEstilo = {fam: string; peso: number; it?: boolean; esp?: number; mayus?: boolean};
export type EstiloTexto = {id: string; gruesa: LetraEstilo; chica: LetraEstilo; texto: string; acento: string};
const esClaro = (hex: string) => { const n = parseInt(String(hex).slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255 > 0.6; };
export const Palabras: React.FC<{t: number; a: number; texto: string; rojas?: string[]; claro?: boolean; tipo?: TipoLetra; tam: number; alinear?: 'left' | 'right' | 'center'; paso?: number; estilo?: EstiloTexto | null; style?: React.CSSProperties}> = ({
  t, a, texto, rojas = [], claro = false, tipo = 'gruesa', tam, alinear = 'left', paso = 0.07, estilo = null, style,
}) => {
  const le = estilo ? (tipo === 'gruesa' ? estilo.gruesa : estilo.chica) : null;
  const fam: React.CSSProperties = le ? {fontFamily: le.fam, fontWeight: le.peso, fontStyle: le.it ? 'italic' : 'normal', lineHeight: 1.05,
      letterSpacing: tipo === 'etiqueta' ? '.12em' : `${le.esp || 0}em`, textTransform: tipo === 'etiqueta' || le.mayus ? 'uppercase' : undefined}
    : tipo === 'gruesa' ? {fontFamily: urb, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.95}
    : tipo === 'remate' ? {fontFamily: cas, fontStyle: 'italic', fontWeight: 400, lineHeight: 1.05}
    : tipo === 'chica' ? {fontFamily: urb, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1}
    : {fontFamily: urb, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', lineHeight: 1.2};
  const rojasL = rojas.map(limpia);
  const sombra = claro ? '0 10px 24px rgba(60,30,20,.18)' : '0 6px 26px rgba(0,0,0,.55)';
  // con estilo: la palabra clave va en su color, sin caja (sobre el fondo claro de una lámina, un acento claro no se leería)
  const colorEst = estilo ? (claro ? (esClaro(estilo.acento) ? R.rubi : estilo.acento) : estilo.acento) : null;
  return (
    <div style={{...fam, fontSize: tam, color: claro ? R.tinta : estilo ? estilo.texto : R.blanco, textAlign: alinear, ...style}}>
      {texto.split(' ').map((pal, i) => {
        const e = outCubic(p(t, a + i * paso, 0.5));
        const roja = rojasL.includes(limpia(pal)) && tipo !== 'etiqueta';
        const conCaja = roja && !claro && !estilo;
        const caja = conCaja ? outCubic(p(t, a + i * paso + 0.12, 0.35)) : 0;
        return (
          <span key={i} style={{display: 'inline-block', position: 'relative', marginRight: '0.24em', opacity: clamp(e * 2.2), filter: e < 1 ? `blur(${(1 - e) * 22}px)` : undefined,
            transform: `translateY(${(1 - e) * 34}px) scale(${lerp(1.14, 1, e)})`, transformOrigin: '50% 80%', color: roja && estilo ? colorEst! : roja && claro ? R.rubi : undefined, textShadow: conCaja ? 'none' : sombra}}>
            {conCaja && <span style={{position: 'absolute', left: '-0.1em', right: '-0.1em', top: '0.08em', bottom: '-0.02em', borderRadius: '0.12em', zIndex: -1,
              background: 'linear-gradient(180deg,#c3202f,#9B111E 55%,#760b16)', boxShadow: '0 10px 24px rgba(0,0,0,.45)', transformOrigin: '0 50%', transform: `scaleX(${caja})`}} />}
            <span style={{position: 'relative'}}>{pal}</span>
          </span>
        );
      })}
    </div>
  );
};

/* el título de una lámina arriba y centrado: etiqueta, gruesa y remate en SUS tiempos (los de las palabras dichas) */
export type TextoLamina = {etiqueta?: string; gruesa?: string; remate?: string; rojas?: string[]};
export const Encabezado: React.FC<{t: number; tx: TextoLamina; tiempos: {etiqueta: number; gruesa: number; remate: number}; claro?: boolean; top?: number; maxG?: number; alinear?: 'center' | 'left'}> = ({t, tx, tiempos, claro, top = MARGEN.arriba, maxG = 132, alinear = 'center'}) => {
  const ancho = 1080 - 2 * MARGEN.lado;
  return (
    <div style={{position: 'absolute', left: MARGEN.lado, top, width: ancho, textAlign: alinear}}>
      {tx.etiqueta && <Palabras t={t} a={tiempos.etiqueta} texto={tx.etiqueta} tipo="etiqueta" claro={claro} tam={32} alinear={alinear} />}
      {tx.gruesa && <Palabras t={t} a={tiempos.gruesa} texto={tx.gruesa} rojas={tx.rojas} claro={claro} tam={tamQueCabe(tx.gruesa, ancho, maxG, urb)} alinear={alinear} style={{marginTop: tx.etiqueta ? 16 : 0}} />}
      {tx.remate && <Palabras t={t} a={tiempos.remate} texto={tx.remate} tipo="remate" rojas={tx.rojas} claro={claro} tam={tamQueCabe(tx.remate, ancho, 78, cas, 'italic', 400, 0)} alinear={alinear} style={{marginTop: 14}} />}
    </div>
  );
};

/* ══ (30-oct-2026) v4 · LA LÁMINA SIMPLE (Sergio, 29-oct: «fondo con sombras + objeto + títulos con sombras y animaciones
   de entrada y salida + movimientos de cámara; menos es más») ══ */

/* el color del fondo: crema si la persona no escoge otro. Con un color oscuro las letras van en blanco */
export const CREMA = '#ECE4D6';
const rgbDe = (hex: string) => {
  const h = String(hex || CREMA).replace('#', ''), c = h.length === 3 ? h.split('').map((x) => x + x).join('') : h, n = parseInt(c, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const esOscuro = (hex?: string | null) => { const [r, g, b] = rgbDe(hex || CREMA); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5; };
/* el fondo plano: el color, una luz suave, la sombra de la persiana que se desliza (del lado que toque) y grano */
export const FondoPlano: React.FC<{t: number; color?: string | null; lado?: number}> = ({t, color: c0, lado = 1}) => {
  const color = c0 || CREMA, osc = esOscuro(color), [r, g, b] = rgbDe(color);
  const tinte = osc ? '0,0,0' : `${Math.round(r * 0.3)},${Math.round(g * 0.26)},${Math.round(b * 0.24)}`;
  return (
    <AbsoluteFill style={{background: color}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 55% at 45% 40%, rgba(255,255,255,${osc ? 0.07 : 0.5}), transparent 70%)`}} />
      <AbsoluteFill style={{transform: lado < 0 ? 'scaleX(-1)' : undefined}}><SombraPersiana t={t} fuerza={osc ? 0.5 : 0.3} tinte={tinte} /></AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(${tinte},${osc ? 0.45 : 0.2}) 100%)`}} />
      <Grano o={osc ? 0.14 : 0.2} />
    </AbsoluteFill>
  );
};
/* la sombra suave de un objeto según el fondo */
export const sombraDe = (oscuro: boolean) => oscuro ? SOL_OSCURO : SOL;
export const sombraCaja = (oscuro: boolean) => oscuro ? '0 40px 70px rgba(0,0,0,.6), 0 10px 18px rgba(0,0,0,.4)' : '34px 46px 60px rgba(70,40,20,.32), 8px 12px 16px rgba(70,40,20,.2)';

/* el tamaño para que TODA la línea quepa en un renglón (no la palabra más larga): nunca se parte en dos */
export function tamLinea(texto: string, ancho: number, max: number, peso: number = 800, apretado = -0.04, familia: string = urb, estilo = 'normal') {
  if (!lienzo && typeof document !== 'undefined') lienzo = document.createElement('canvas').getContext('2d');
  if (!lienzo || !texto) return max;
  lienzo.font = `${estilo} ${peso} ${max}px ${familia}`;
  const largo = (lienzo.measureText(texto).width + texto.length * apretado * max) * 1.08;
  return largo > ancho ? Math.max(28, Math.floor((max * ancho) / largo)) : max;
}

/* EL RÓTULO de la lámina: UNA línea chica y UNA gruesa, centradas arriba (como la referencia). Cada palabra entra con
   desenfoque en el segundo en que la dices; justo antes del corte, todo sale desenfocándose. Tamaños fijos (46 y 112): solo
   bajan si la línea no cabe en el renglón */
export const TAM = {chica: 46, gruesa: 112, arriba: 300};
export const Rotulo: React.FC<{t: number; t1: number; chica?: string; gruesa?: string; rojas?: string[]; a: {chica: number; gruesa: number}; oscuro?: boolean; top?: number; estilo?: EstiloTexto | null}> = ({
  t, t1, chica, gruesa, rojas, a, oscuro = false, top = TAM.arriba, estilo = null,
}) => {
  const ancho = 1080 - 2 * MARGEN.lado, sale = clamp((t - (t1 - 0.24)) / 0.24);
  // con estilo, el tamaño se mide con SU letra (si no, una serif ancha se saldría del renglón)
  const tamC = (x: string) => (estilo ? tamLinea(x, ancho, TAM.chica, estilo.chica.peso, estilo.chica.esp || 0, estilo.chica.fam, estilo.chica.it ? 'italic' : 'normal') : tamLinea(x, ancho, TAM.chica, 600, -0.01));
  const tamG = (x: string) => (estilo ? tamLinea(x, ancho, TAM.gruesa, estilo.gruesa.peso, estilo.gruesa.esp || 0, estilo.gruesa.fam, estilo.gruesa.it ? 'italic' : 'normal') : tamLinea(x, ancho, TAM.gruesa));
  return (
    <div style={{position: 'absolute', left: MARGEN.lado, top, width: ancho, textAlign: 'center', whiteSpace: 'nowrap', opacity: 1 - sale, filter: sale > 0 ? `blur(${sale * 18}px)` : undefined}}>
      {chica && <Palabras t={t} a={a.chica} texto={chica} tipo="chica" claro={!oscuro} estilo={estilo} tam={tamC(chica)} alinear="center" paso={0.06} style={{opacity: 0.86}} />}
      {gruesa && <Palabras t={t} a={a.gruesa} texto={gruesa} rojas={rojas} claro={!oscuro} estilo={estilo} tam={tamG(gruesa)} alinear="center" style={{marginTop: chica ? 10 : 0}} />}
    </div>
  );
};

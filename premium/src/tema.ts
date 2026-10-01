// Letras y colores de los gráficos premium de Cherry. El color sale de «Gráficos» (Cherry, Dorado… o uno de «Mis colores»).
import {loadFont as cargarOutfit} from '@remotion/google-fonts/Outfit';
import {loadFont as cargarMono} from '@remotion/google-fonts/DMMono';
import {loadFont as cargarPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as cargarAnton} from '@remotion/google-fonts/Anton';
import {loadFont as cargarBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as cargarArchivo} from '@remotion/google-fonts/ArchivoBlack';
import {loadFont as cargarMontserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as cargarInter} from '@remotion/google-fonts/Inter';
// @ts-ignore — el mismo graficos.js de la página y del ensamblador
import GRAF from './graficos.js';

export const OUTFIT = cargarOutfit('normal', {weights: ['700', '800', '900'], subsets: ['latin']}).fontFamily;
export const MONO = cargarMono('normal', {weights: ['400', '500'], subsets: ['latin']}).fontFamily;
export const PLAYFAIR = cargarPlayfair('italic', {weights: ['700'], subsets: ['latin']}).fontFamily;
export const PLAYFAIR_RECTO = cargarPlayfair('normal', {weights: ['900'], subsets: ['latin']}).fontFamily;
// letras para las cifras monumentales (Sergio escoge cuál)
export const ANTON = cargarAnton('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;
export const BEBAS = cargarBebas('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;
export const ARCHIVO = cargarArchivo('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;
// la de las referencias de Sergio: una grotesca geométrica muy pesada
export const MONTSERRAT = cargarMontserrat('normal', {weights: ['800', '900'], subsets: ['latin']}).fontFamily;
export const INTER = cargarInter('normal', {weights: ['800', '900'], subsets: ['latin']}).fontFamily;

export type Paleta = {
  acento: string; claro: string; hondo: string; sobre: string; fondo: string; tinta: string; tinta2: string; tinta3: string;
  a: (alfa: number) => string; // el acento con transparencia
};

const aRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mezcla = (hex: string, con: [number, number, number], k: number) => {
  const c = aRgb(hex).map((v, i) => Math.round(v + (con[i] - v) * k));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

export const paletaDe = (color: string): Paleta => {
  const p = GRAF.paleta(color);
  const [r, g, b] = aRgb(p.acento);
  return {
    acento: p.acento,
    claro: mezcla(p.acento, [255, 255, 255], 0.35),
    hondo: mezcla(p.acento, [0, 0, 0], 0.2),
    sobre: p.sobre,
    fondo: p.fondo,
    tinta: p.tinta,
    tinta2: 'rgba(244,236,231,.62)',
    tinta3: 'rgba(244,236,231,.4)',
    a: (alfa: number) => `rgba(${r},${g},${b},${alfa})`,
  };
};

// Grano fino sin archivos (sirve igual en Lambda y en la vista del celular)
export const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23g)'/%3E%3C/svg%3E\")";

// Familia «La persiana» (29-sep-2026) — piezas comunes. Viene del taller (Cherry Taller/remotion/src/tg/persianaBase.tsx),
// aprobada por Sergio con sus 9 piezas: IMPLEMENTAR-LA-PERSIANA.md.
//
// LA IDENTIDAD (lo que nunca cambia): la sombra de persiana SIEMPRE; la palabra gruesa (Rubik 700) CAE con estela y se
// asienta con relieve; la cursiva pequeña (Instrument Serif) entra después; todo lo que aparece lleva sombra propia; entra
// y sale con corte seco y la tarjeta crece un 3,5 % mientras está.
// LO QUE CAMBIA: el fondo. «marca» (en el taller era el vino de Sergio: aquí es el color de la marca de quien edita),
// «blanco» y «papel». Sobre fondos claros la sombra y el relieve van en café/tono de la marca, nunca gris puro.
//
// En Cherry cada pieza se dibuja SOLA (el video va aparte): el cuadro 0 es el instante en que entra la tarjeta.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {loadFont as cargarRubik} from '@remotion/google-fonts/Rubik';
import {loadFont as cargarSerif} from '@remotion/google-fonts/InstrumentSerif';
import {SombraPersiana} from '../../lib/persiana';

export const RUBIK = cargarRubik('normal', {weights: ['700'], subsets: ['latin']}).fontFamily;
export const SERIF = cargarSerif('italic', {weights: ['400'], subsets: ['latin']}).fontFamily;

export type Fondo = 'marca' | 'blanco' | 'papel';
export type Estilo = {fondo: string; tinte: string; fuerza: number; letra: string; relieve: string; chica: string; sombraChica: string; vineta: string};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

const aRgb = (hex: string): [number, number, number] => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const aHex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mezcla = (hex: string, con: number[], k: number) => aHex(aRgb(hex).map((v, i) => v + (con[i] - v) * k));
const oscuro = (hex: string, k: number) => mezcla(hex, [0, 0, 0], k);
const rgbStr = (hex: string) => aRgb(hex).join(',');
const luz = (hex: string) => { const c = aRgb(hex); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };

/* El relieve: capas de sombra dura de 1 px, cada una un poco más oscura, y dos sombras suaves. Como en el taller:
   sobre el color de la marca, grises cálidos tirando al color; sobre fondo claro, el tono oscuro de la marca. */
const relieveDe = (base: string, hacia: string, capas: number, suave: string, a1 = 0.36, a2 = 0.26) =>
  Array.from({length: capas}, (_, i) => `0 ${i + 1}px 0 ${mezcla(base, aRgb(hacia), 0.14 + i * 0.1)}`).join(', ') +
  `, 0 14px 22px rgba(${suave},${a1}), 0 26px 50px rgba(${suave},${a2})`;

/** Los tres fondos, con el color de la marca en lugar del vino del taller */
export const estiloDe = (fondo: Fondo, marca: string): Estilo => {
  const m = /^#[0-9a-fA-F]{6}$/.test(marca) ? marca : '#6b1424';
  /* La letra sobre fondo claro es la marca; si la marca es clara (amarillo, lima, crema) no se leería: su tono oscuro */
  const tinta = luz(m) > 0.5 ? oscuro(m, 0.62) : m;
  if (fondo === 'blanco') {
    return {fondo: '#fbfbf8', tinte: '40,30,20', fuerza: 0.2, letra: tinta, chica: tinta,
      relieve: relieveDe(oscuro(tinta, 0.12), '#000000', 4, rgbStr(oscuro(tinta, 0.5)), 0.22, 0.16),
      sombraChica: `0 4px 12px rgba(${rgbStr(oscuro(tinta, 0.5))},.15)`, vineta: 'rgba(60,40,20,.12)'};
  }
  if (fondo === 'papel') {
    return {fondo: '#ebe4d6', tinte: '60,40,15', fuerza: 0.26, letra: '#26221f', chica: tinta,
      relieve: '0 1px 0 #3a3531, 0 2px 0 #46403b, 0 3px 0 #524b45, 0 4px 0 #5c554e, 0 14px 22px rgba(40,30,20,.25), 0 26px 50px rgba(40,30,20,.16)',
      sombraChica: '0 4px 12px rgba(40,30,20,.15)', vineta: 'rgba(60,40,20,.14)'};
  }
  /* «marca»: el fondo es el color de la marca. Letra crema sobre marcas oscuras (como el vino aprobado) y el tono
     muy oscuro de la marca sobre marcas claras. La persiana es la marca casi negra. */
  const clara = luz(m) > 0.55;
  const letra = clara ? oscuro(m, 0.72) : '#f5f1ee';
  const sombra = rgbStr(oscuro(m, 0.78));
  return {fondo: m, tinte: rgbStr(oscuro(m, 0.82)), fuerza: clara ? 0.34 : 0.5, letra, chica: letra,
    relieve: clara ? relieveDe(oscuro(m, 0.62), '#000000', 4, sombra) : relieveDe('#ded4d2', oscuro(m, 0.35), 5, sombra),
    sombraChica: `0 6px 16px rgba(${sombra},.4)`, vineta: `rgba(${sombra},.3)`};
};

/** El fondo: el color, la persiana y la viñeta suave. Va debajo de todo. */
export const FondoPersiana: React.FC<{e: Estilo; t: number; zoom?: number; children?: React.ReactNode}> = ({e, t, zoom = 1, children}) => (
  <AbsoluteFill style={{backgroundColor: e.fondo, transform: `scale(${zoom})`}}>
    <SombraPersiana t={t} tinte={e.tinte} fuerza={e.fuerza} />
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 55%, transparent 55%, ${e.vineta} 100%)`}} />
    {children}
  </AbsoluteFill>
);

/* La palabra que cae: baja «desde» px en «baja» s frenando al final, con estela vertical (18 copias desenfocadas) y se
   asienta con relieve. «desde» positivo = sube desde abajo (antes y ahora). La estela arranca desde el primer cuadro. */
const y = (s: number, desde: number, baja: number) => lerp(desde, 0, outCubic(clamp(s / baja)));
export const PalabraQueCae: React.FC<{texto: string; tt: number; e: Estilo; tam: number; fps: number; desde?: number; baja?: number; estilo?: React.CSSProperties}> = ({
  texto, tt, e, tam, fps, desde = -620, baja = 0.5, estilo,
}) => {
  if (tt < 0) return null;
  const dt = 1 / 60;   // la estela se calcula a 60 cps (así la aprobó Sergio), aunque el video vaya a 30
  const vel = Math.max(Math.abs(y(tt, desde, baja) - y(tt - dt, desde, baja)), Math.abs(y(tt + dt, desde, baja) - y(tt, desde, baja)));
  const letra: React.CSSProperties = {fontFamily: RUBIK, fontWeight: 700, fontSize: tam, lineHeight: 1, letterSpacing: '-0.03em', color: e.letra, whiteSpace: 'nowrap', textShadow: e.relieve};
  void fps;
  return (
    <div style={{position: 'relative', ...estilo}}>
      {vel > 0.5 && Array.from({length: 18}, (_, i) => (
        <div key={i} style={{...letra, position: 'absolute', left: 0, top: 0, opacity: 0.11, textShadow: 'none', filter: 'blur(7px)',
          transform: `translateY(${y(tt - (i / 18) * dt * 2.6, desde, baja)}px)`}}>{texto}</div>
      ))}
      <div style={{...letra, transform: `translateY(${y(tt, desde, baja)}px)`, opacity: vel > 0.5 ? lerp(1, 0.35, clamp(vel / 30)) : 1,
        filter: `blur(${Math.min(10, vel * 0.3)}px)`}}>{texto}</div>
    </div>
  );
};

/** La cursiva pequeña: de borrosa a nítida subiendo 14 px en 0,3 s */
export const Cursiva: React.FC<{texto: string; tt: number; e: Estilo; tam?: number; estilo?: React.CSSProperties}> = ({texto, tt, e, tam = 84, estilo}) => {
  if (!texto) return null;
  const p = outCubic(clamp(tt / 0.3));
  return (
    <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: tam, color: e.chica, lineHeight: 1, whiteSpace: 'nowrap', opacity: p,
      filter: `blur(${lerp(10, 0, p)}px)`, transform: `translateY(${lerp(14, 0, p)}px)`, textShadow: e.sombraChica, ...estilo}}>{texto}</div>
  );
};

/** Tamaño de la palabra para que quepa siempre: min(tope, ancho / (letras × k)) */
export const tamDe = (texto: string, tope = 270, ancho = 880, k = 0.56) => Math.min(tope, ancho / (Math.max(1, String(texto).length) * k));

/** El fondo de la pieza según sus datos (la marca por defecto) */
export const fondoDe = (d: any): Fondo => (d && (d.fondo === 'blanco' || d.fondo === 'papel') ? d.fondo : 'marca');

/** Las posiciones del taller son para 1920 de alto: se llevan al alto real del dibujo */
export const Yv = (Hd: number) => (v: number) => (v * Hd) / 1920;

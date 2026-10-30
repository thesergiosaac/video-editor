// (29-oct-2026) Cámara viva — EL TÍTULO de cuando hablas: al lado de tu cara (o arriba), palabra por palabra con desenfoque,
// las palabras clave en caja rubí. Copiado del kit del reel del Día 4 («Cherry 9», Cherry Taller\camara-viva\codigo\remotion\
// kit9.tsx › Palabras y C9.tsx › AlLado/Arriba). El lugar (caja) y los tiempos (a, b) los calcula js/camara-viva.js, el mismo
// archivo en la página y en el ensamblador. Todo en el cuadro de 1080 × 1920; t = segundo del video.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Palabras, tamQueCabe, urb, cas} from './kit';

export type Titulo = {etiqueta?: string; gruesa: string; remate?: string; rojas?: string[]};
export type Caja = {left: number; top: number; width: number; align: 'left' | 'right' | 'center'; donde: string};
export type PiezaTitulo = {a: number; b: number; caja: Caja; titulo: Titulo};

/* un título en su caja: etiqueta, gruesa y remate escalonados; al salir se desenfoca y se apaga en 0,25 s */
export const UnTitulo: React.FC<{t: number; pz: PiezaTitulo}> = ({t, pz}) => {
  const {a, b, caja, titulo} = pz;
  if (t < a - 0.05 || t > b + 0.3) return null;
  const arriba = caja.donde === 'arriba';
  const maxG = arriba ? 132 : 100, maxR = arriba ? 78 : 62;
  const tamG = tamQueCabe(titulo.gruesa, caja.width, maxG, urb);
  const tamR = titulo.remate ? tamQueCabe(titulo.remate, caja.width, maxR, cas, 'italic', 400, 0) : maxR;
  const sale = Math.max(0, Math.min(1, (t - b) / 0.25));
  let paso = a;
  const aE = paso; if (titulo.etiqueta) paso += 0.15;
  const aG = paso, aR = aG + 0.35 + titulo.gruesa.split(' ').length * 0.07;
  return (
    <div style={{position: 'absolute', left: caja.left, top: caja.top, width: caja.width, textAlign: caja.align,
      opacity: 1 - sale, filter: sale > 0 ? `blur(${sale * 16}px)` : undefined}}>
      {titulo.etiqueta && <Palabras t={t} a={aE} texto={titulo.etiqueta} tipo="etiqueta" tam={arriba ? 34 : 28} alinear={caja.align} style={{marginBottom: 10}} />}
      <Palabras t={t} a={aG} texto={titulo.gruesa} rojas={titulo.rojas} tam={tamG} alinear={caja.align} />
      {titulo.remate && <Palabras t={t} a={aR} texto={titulo.remate} tipo="remate" tam={tamR} alinear={caja.align} style={{marginTop: 12}} />}
    </div>
  );
};

/* LA CAPA para la vista previa: todos los títulos que tocan en el segundo t (encima de tu video, debajo de nada) */
export const CapaTitulos: React.FC<{t: number; titulos: PiezaTitulo[]}> = ({t, titulos}) => (
  <AbsoluteFill style={{width: 1080, height: 1920}}>
    {(titulos || []).map((pz, i) => <UnTitulo key={i} t={t} pz={pz} />)}
  </AbsoluteFill>
);

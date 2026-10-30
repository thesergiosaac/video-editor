// (29-oct-2026) Cámara viva — LAS DOS CAPAS que rodean tu video en cada instante:
//   · fondo: lo que va DEBAJO de tu video (el papel de las láminas que llevan tu video en un hueco);
//   · frente: lo que va ENCIMA (la lámina entera, o los adornos alrededor de tu video, o los títulos cuando hablas).
// videoEn dice dónde va tu video: null = tapado por la lámina · 'camara' = con su cámara viva · Rect = en el hueco.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PLANTILLAS, Momento, Material, Rect} from './laminas';
import {CapaTitulos, PiezaTitulo} from './Titulo';

export type Pieza = {m: Momento; mat: Material};
const activa = (t: number, piezas: Pieza[]) => (piezas || []).find((x) => t >= x.m.t0 && t < x.m.t1) || null;

export function videoEn(t: number, piezas: Pieza[]): null | 'camara' | Rect {
  const a = activa(t, piezas);
  if (!a || !PLANTILLAS[a.m.plantilla]) return 'camara';
  return PLANTILLAS[a.m.plantilla].video(t, a.m, a.mat);
}

export const CapaFondo: React.FC<{t: number; piezas: Pieza[]}> = ({t, piezas}) => {
  const a = activa(t, piezas), P = a && PLANTILLAS[a.m.plantilla];
  if (!a || !P || !P.fondo || P.video(t, a.m, a.mat) === null) return null;
  const F = P.fondo;
  return <AbsoluteFill style={{width: 1080, height: 1920}}><F t={t} m={a.m} mat={a.mat} /></AbsoluteFill>;
};

export const CapaFrente: React.FC<{t: number; piezas: Pieza[]; titulos: PiezaTitulo[]}> = ({t, piezas, titulos}) => {
  const a = activa(t, piezas), P = a && PLANTILLAS[a.m.plantilla];
  if (a && P) { const F = P.frente; return <AbsoluteFill style={{width: 1080, height: 1920, overflow: 'hidden'}}><F t={t} m={a.m} mat={a.mat} /></AbsoluteFill>; }
  return <CapaTitulos t={t} titulos={titulos} />;
};

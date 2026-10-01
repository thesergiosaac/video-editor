// El tiempo de los gráficos premium va en SEGUNDOS DEL VIDEO (t), no en cuadros: así el mismo gráfico sale igual a 25, 30
// o 60 cuadros por segundo, y los momentos (p.t0, p.marcas…) son los mismos que usa graficos.js.
// Por dentro, los resortes se calculan en «cuadros de 30» (como la propuesta que Sergio aprobó).
import React, {createContext, useContext} from 'react';
import {Easing, interpolate, spring, useCurrentFrame} from 'remotion';
import type {Paleta} from '../tema';

export type Pieza = {
  t0: number; t1: number; tipo: string; forma: 'encima' | 'partida' | 'completa' | 'lado' | 'profundo' | 'tapa' | 'tarjeta' | 'ventana' | 'empuja' | 'sales' | 'tu'; datos: any; marcas: number[]; fin?: number;
};
export type Ctx = {
  p: Pieza; pal: Paleta; inicio: number; fps: number; W: number; H: number; esc: number; Hd: number; vista: boolean; parte?: string;
};
export const G = createContext<Ctx | null>(null);
export const useG = (): Ctx => {
  const c = useContext(G);
  if (!c) throw new Error('Gráfico sin contexto');
  return c;
};
/** El instante del video que se está dibujando (en segundos) */
export const useT = () => {
  const f = useCurrentFrame();
  const {inicio, fps} = useG();
  return inicio + f / fps;
};

type Resorte = {damping?: number; stiffness?: number; mass?: number; overshootClamping?: boolean};
export const RESORTES = {
  suave: {damping: 200} as Resorte,
  carta: {damping: 14, stiffness: 115, mass: 0.9} as Resorte,
  pop: {damping: 9, stiffness: 170, mass: 0.6} as Resorte,
  letra: {damping: 13, stiffness: 170, mass: 0.5} as Resorte,
  palabra: {damping: 15, stiffness: 190, mass: 0.55} as Resorte,
};

/** Resorte que arranca en el segundo t0 (0 antes de empezar) */
export const sp = (t: number, t0: number, config: Resorte = RESORTES.carta, duracion?: number) =>
  t < t0 ? 0 : spring({frame: (t - t0) * 30, fps: 30, config, durationInFrames: duracion});

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const EASE = {
  sale: Easing.bezier(0.55, 0, 0.9, 0.35),
  suave: Easing.bezier(0.4, 0, 0.2, 1),
  llega: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.45, 0, 0.2, 1),
};

/** 0→1 entre los segundos a y b */
export const rampa = (t: number, a: number, b: number, easing = EASE.suave) =>
  b <= a ? (t >= b ? 1 : 0) : interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

/** Un golpe que rebota y se apaga (decaimiento y periodo en cuadros de 30) */
export const golpe = (t: number, t0: number, decaimiento = 5, periodo = 2.2) => {
  const f = (t - t0) * 30;
  return f < 0 ? 0 : Math.exp(-f / decaimiento) * Math.sin(f / periodo);
};

/** Tambor de dígitos: arranca suave, gira rápido y frena con un «clic» (dur en segundos) */
export const giro = (t: number, t0: number, dur: number, total: number) => {
  const p = rampa(t, t0, t0 + dur, Easing.bezier(0.55, 0, 0.22, 1));
  return p * total + 0.2 * golpe(t, t0 + dur - 1 / 30, 3.5, 1.5);
};

export const Ninguno: React.FC = () => null;

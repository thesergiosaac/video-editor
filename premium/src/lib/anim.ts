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
  dibujo?: number; // (8-oct) px de ESTA capa por px del dibujo de 1080 (los gráficos en lienzo dibujan a ese tamaño)
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

/* (8-oct) El MISMO resorte de Remotion (spring → springCalculation → advance, copiados tal cual), pero sin repetir la
   cuenta: Remotion lo simula desde el cuadro 0 hasta el actual en CADA llamada (un resorte en el cuadro 120 son 120 pasos,
   por cada letra y en cada cuadro) y guarda cada resultado en un objeto que crece sin parar. Aquí los pasos enteros se
   guardan una vez por configuración y cada llamada solo da el último paso fraccionario: mismos números, casi sin costo. */
type EstadoResorte = {current: number; velocity: number; lastTimestamp: number};
const TABLAS_RESORTE = new Map<string, EstadoResorte[]>();
const avanzarResorte = (a: EstadoResorte, now: number, c2: number, m: number, k: number): EstadoResorte => {
  const toValue = 1;
  const deltaTime = Math.min(now - a.lastTimestamp, 64);
  const v0 = -a.velocity;
  const x0 = toValue - a.current;
  const zeta = c2 / (2 * Math.sqrt(k * m));
  const omega0 = Math.sqrt(k / m);
  const omega1 = omega0 * Math.sqrt(1 - zeta ** 2);
  const t = deltaTime / 1000;
  const sin1 = Math.sin(omega1 * t);
  const cos1 = Math.cos(omega1 * t);
  const underDampedEnvelope = Math.exp(-zeta * omega0 * t);
  const underDampedFrag1 = underDampedEnvelope * (sin1 * ((v0 + zeta * omega0 * x0) / omega1) + x0 * cos1);
  const underDampedPosition = toValue - underDampedFrag1;
  const underDampedVelocity = zeta * omega0 * underDampedFrag1 - underDampedEnvelope * (cos1 * (v0 + zeta * omega0 * x0) - omega1 * x0 * sin1);
  const criticallyDampedEnvelope = Math.exp(-omega0 * t);
  const criticallyDampedPosition = toValue - criticallyDampedEnvelope * (x0 + (v0 + omega0 * x0) * t);
  const criticallyDampedVelocity = criticallyDampedEnvelope * (v0 * (t * omega0 - 1) + t * x0 * omega0 * omega0);
  return {lastTimestamp: now, current: zeta < 1 ? underDampedPosition : criticallyDampedPosition, velocity: zeta < 1 ? underDampedVelocity : criticallyDampedVelocity};
};
export const resorte = (frame: number, fps: number, config: Resorte) => {
  const c2 = config.damping ?? 10, m = config.mass ?? 1, k = config.stiffness ?? 100;
  if (c2 <= 0) throw new Error('Spring damping must be greater than 0');
  const clave = `${fps}|${c2}|${m}|${k}`;
  let tabla = TABLAS_RESORTE.get(clave);
  if (!tabla) { tabla = []; TABLAS_RESORTE.set(clave, tabla); }
  const fc = Math.max(0, frame);
  const n = Math.floor(fc);
  // tabla[f] = el resorte después de los pasos enteros 0 … f (como el bucle de springCalculation)
  while (tabla.length <= n && tabla.length < 20000) {
    const f = tabla.length;
    const antes = f === 0 ? {current: 0, velocity: 0, lastTimestamp: 0} : tabla[f - 1];
    tabla.push(avanzarResorte(antes, (f / fps) * 1000, c2, m, k));
  }
  let a = tabla[Math.min(n, tabla.length - 1)];
  if (fc % 1 > 0) a = avanzarResorte(a, (fc / fps) * 1000, c2, m, k);
  return config.overshootClamping ? Math.min(a.current, 1) : a.current;
};

/** Resorte que arranca en el segundo t0 (0 antes de empezar) */
export const sp = (t: number, t0: number, config: Resorte = RESORTES.carta, duracion?: number) =>
  t < t0 ? 0 : duracion !== undefined ? spring({frame: (t - t0) * 30, fps: 30, config, durationInFrames: duracion}) : resorte((t - t0) * 30, 30, config);

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

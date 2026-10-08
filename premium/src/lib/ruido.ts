// El ruido de @remotion/noise › noise2D (createNoise2D(() => random(semilla))), con los MISMOS números, pero guardando
// TODAS las semillas: aquel guarda solo 10 y con más (las chispas usan hasta 26, más la pose de la tarjeta) rehace el
// ruido de cada semilla en cada cuadro (≈ 13 ms por cuadro medido en el Número gigante, 8-oct-2026).
import {random} from 'remotion';
import {createNoise2D} from 'simplex-noise';

const RUIDOS = new Map<string, (x: number, y: number) => number>();
export const ruido2D = (semilla: string, x: number, y: number) => {
  let f = RUIDOS.get(semilla);
  if (!f) { f = createNoise2D(() => random(semilla)); RUIDOS.set(semilla, f); }
  return f(x, y);
};

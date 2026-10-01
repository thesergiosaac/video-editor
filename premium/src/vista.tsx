// La VISTA EN VIVO de los gráficos premium dentro del celular de la página: el mismo componente que dibuja Remotion en la
// nube, pero aquí se le dice qué cuadro mostrar según el segundo del video que se está viendo. Sin motion blur (vista: true)
// para que vaya fluido; en el video final sí lo lleva.
import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {Thumbnail} from '@remotion/player';
import {Grafico} from './Grafico';
// @ts-ignore
import GRAF from './graficos.js';

type Pieza = any;
type Dibujo = {p: Pieza; color: string; W: number; H: number; fps: number; t: number};

const raices = new WeakMap<HTMLElement, Root>();

function dibujar(el: HTMLElement, d: Dibujo) {
  const c = GRAF.cuadros(d.p, d.fps);
  const caja = GRAF.cajaPremium(d.p, d.W, d.H);
  const cuadro = Math.max(0, Math.min(c.total - 1, Math.round((d.t - c.inicio) * d.fps)));
  let raiz = raices.get(el);
  if (!raiz) { raiz = createRoot(el); raices.set(el, raiz); }
  raiz.render(
    <Thumbnail
      component={Grafico as any}
      compositionWidth={Math.round(d.W / 2) * 2}
      compositionHeight={Math.round(caja.h / 2) * 2}
      frameToDisplay={cuadro}
      durationInFrames={Math.max(1, c.total)}
      fps={d.fps}
      inputProps={{p: d.p, color: d.color, W: d.W, H: d.H, fps: d.fps, inicio: c.inicio, vista: true}}
      style={{width: '100%', height: '100%'}}
      className="gr-premium-vista"
    />
  );
}

function quitar(el: HTMLElement) {
  const raiz = raices.get(el);
  if (raiz) { raiz.unmount(); raices.delete(el); }
}

(window as any).CherryPremiumVista = {dibujar, quitar, alto: (p: Pieza, W: number, H: number) => GRAF.cajaPremium(p, W, H).h};

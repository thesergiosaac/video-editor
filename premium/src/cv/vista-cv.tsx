// (29-oct-2026) La vista en vivo de la Cámara viva dentro del celular de la página: el MISMO componente que dibuja Remotion
// en el video final, aquí con el segundo del video que se está viendo.
//   CherryCVVista.dibujar(elFondo, elFrente, { t, piezas, titulos })   · CherryCVVista.videoEn(t, piezas) → null | 'camara' | Rect
import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {Thumbnail} from '@remotion/player';
import {CapaFondo, CapaFrente, videoEn, Pieza} from './capas';
import {PiezaTitulo} from './Titulo';

const raices = new WeakMap<HTMLElement, Root>();
function pintar(el: HTMLElement, componente: any, props: any) {
  let raiz = raices.get(el);
  if (!raiz) { raiz = createRoot(el); raices.set(el, raiz); }
  raiz.render(<Thumbnail component={componente} compositionWidth={1080} compositionHeight={1920} frameToDisplay={0}
    durationInFrames={1} fps={30} inputProps={props} style={{width: '100%', height: '100%'}} />);
}
function dibujar(elFondo: HTMLElement | null, elFrente: HTMLElement, d: {t: number; piezas: Pieza[]; titulos: PiezaTitulo[]}) {
  if (elFondo) pintar(elFondo, CapaFondo, {t: d.t, piezas: d.piezas});
  pintar(elFrente, CapaFrente, {t: d.t, piezas: d.piezas, titulos: d.titulos});
}
function quitar(el: HTMLElement) { const r = raices.get(el); if (r) { r.unmount(); raices.delete(el); } }
(window as any).CherryCVVista = {dibujar, quitar, videoEn};

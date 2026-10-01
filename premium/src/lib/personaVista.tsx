// (2-oct-2026) TU RECORTE EN LA VISTA PREVIA. En la nube, las plantillas que te ponen delante dibujan tu recorte con
// transparencia (d.persona, un WebM que saca el ensamblador). En la vista previa del celular ese WebM no existe todavía: la
// página arma tu recorte en vivo en un lienzo (js/personavivo.js) y aquí se monta ESE lienzo en el mismo lugar, con el
// mismo estilo y la misma animación que tendría el video. Así la vista previa es exactamente el video final.
import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill} from 'remotion';

export const PersonaVista: React.FC<{estilo?: React.CSSProperties}> = ({estilo}) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const pv = (window as any).CherryPersonaVista;
    const lienzo: HTMLCanvasElement | null = pv && pv.lienzo ? pv.lienzo() : null;
    if (lienzo && ref.current && lienzo.parentNode !== ref.current) ref.current.appendChild(lienzo);
  });
  return (
    <AbsoluteFill style={estilo}>
      <div ref={ref} style={{position: 'absolute', inset: 0}} />
    </AbsoluteFill>
  );
};

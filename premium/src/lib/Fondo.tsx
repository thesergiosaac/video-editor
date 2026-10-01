// Pantalla partida y pantalla completa: el fondo oscuro de Cherry (brillo que se mueve con ruido, retícula de puntos,
// grano) con el HUECO por donde se ve tu video. El hueco sale de graficos.js (hueco), el mismo que usa el ensamblador
// para encoger el video: así el borde del fondo y el video encogido coinciden cuadro a cuadro.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {noise2D} from '@remotion/noise';
import {evolvePath} from '@remotion/paths';
// @ts-ignore
import GRAF from '../graficos.js';
import {GRANO} from '../tema';
import {EASE, rampa, useG, useT} from './anim';

// rectángulo redondeado como trazo de SVG (para el recorte «todo menos el hueco»)
const rred = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
};

export const FondoHueco: React.FC<{parte?: string}> = ({parte = 'todo'}) => {
  const t = useT();
  const {p, pal, W, H, esc, Hd} = useG();
  const hu = GRAF.hueco(p, t, W, H);
  if (!hu || hu.k <= 0) return null;
  // en coordenadas de diseño (1080 de ancho)
  const x = hu.x / esc, y = hu.y / esc, w = hu.w / esc, h = hu.h / esc, r = hu.r / esc;
  const recorte = `path(evenodd, "M 0 0 H 1080 V ${Hd} H 0 Z ${rred(x, y, w, h, r)}")`;
  // el fondo casi no cambia de un cuadro a otro (así el navegador no lo vuelve a pintar entero en cada cuadro): el brillo
  // se mueve despacio y el grano va quieto
  const cx = 540 + noise2D('fondo-x', t * 0.05, 0) * 180;
  const cy = Hd * 0.47 + noise2D('fondo-y', 0, t * 0.05) * 200;
  const cx2 = 540;
  // aro del color alrededor de la cara (pantalla completa): se dibuja cuando el círculo llega y se borra al volver
  const aro = p.forma === 'completa' ? rampa(hu.k, 0.8, 1, EASE.llega) : 0;
  const R = w / 2 + 12;
  // el aro se dibuja en un recuadro justo de su tamaño (un SVG con desenfoque del tamaño de todo el cuadro pesa muchísimo)
  const M = R + 40, ARO = `M ${M} ${M - R} A ${R} ${R} 0 1 1 ${M} ${M + R} A ${R} ${R} 0 1 1 ${M} ${M - R}`;
  const ccx = x + w / 2, ccy = y + h / 2;
  const latido = 0.5 + 0.5 * Math.sin(t * 3.3);
  return (
    <>
      {parte === 'contenido' ? null : (
      <AbsoluteFill style={{height: Hd, clipPath: recorte, WebkitClipPath: recorte}}>
        <AbsoluteFill style={{background: `radial-gradient(820px 820px at ${cx}px ${cy}px, ${pal.a(0.19)}, ${pal.a(0)} 70%), radial-gradient(1500px 900px at ${cx2}px ${Hd + 160}px, ${pal.a(0.12)}, ${pal.a(0)} 70%), linear-gradient(180deg, #150C12 0%, #0B0709 55%, #070406 100%)`}} />
        <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(255,255,255,.10) 1.7px, rgba(255,255,255,0) 2px)', backgroundSize: '44px 44px', backgroundPosition: '22px 10px', opacity: 0.3}} />
        <AbsoluteFill style={{backgroundImage: GRANO, opacity: 0.045}} />
        <AbsoluteFill style={{background: 'radial-gradient(130% 95% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.6) 100%)'}} />
        {/* sombra alrededor del video encogido (solo por fuera del hueco) */}
        <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r,
          boxShadow: `0 ${30 * hu.k}px ${48 * hu.k}px rgba(0,0,0,${0.62 * hu.k}), 0 ${12 * hu.k}px ${22 * hu.k}px rgba(0,0,0,${0.4 * hu.k})`}} />
      </AbsoluteFill>
      )}
      {/* filo de luz en el borde del video */}
      {parte === 'fondo' ? null : (
        <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,${0.12 * hu.k}), inset 0 2px 0 rgba(255,255,255,${0.16 * hu.k})`}} />
      )}
      {aro > 0.001 && parte !== 'fondo' ? (
        <svg width={2 * M} height={2 * M} style={{position: 'absolute', left: ccx - M, top: ccy - M, overflow: 'visible'}}>
          <path d={ARO} fill="none" stroke={pal.acento} strokeWidth={20} opacity={0.25 + 0.12 * latido} style={{filter: 'blur(10px)'}} {...evolvePath(aro, ARO)} />
          <path d={ARO} fill="none" stroke={pal.acento} strokeWidth={7} strokeLinecap="round" {...evolvePath(aro, ARO)} />
        </svg>
      ) : null}
    </>
  );
};

/** Aparece un poco después de que el video empieza a encogerse y se va antes de que vuelva (como animGrupo de graficos.js) */
export const usePresenciaGrupo = () => {
  const t = useT();
  const {p} = useG();
  const entra = rampa(t, p.t0 + 0.35, p.t0 + 0.8, EASE.llega);
  const sale = rampa(t, p.t1 - GRAF.SALIDA - 0.1, p.t1 - GRAF.SALIDA + 0.25, EASE.sale);
  return {op: entra * (1 - sale), sale, dy: (1 - entra) * 40 + sale * 70};
};

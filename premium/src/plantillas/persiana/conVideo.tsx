// «La persiana con tu video» (29-sep-2026, tanda 2 del taller: PV2 La ventana, PV4 Te sales, PV6 Empuja, y la pieza 5 de la
// tanda 1, Tú delante). El video NUNCA se corta: lo mueve el ensamblador (así conserva tu color y tu look) con la MISMA
// cuenta que usa esta pieza (graficos.js › rectVideo), y aquí se dibuja todo lo que va alrededor, con transparencia donde
// se ve tu video. Te sales y Tú delante llevan tu recorte con transparencia (d.persona), que saca el ensamblador.
import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile} from 'remotion';
// @ts-ignore
import GRAF from '../../graficos.js';
import {useG, useT} from '../../lib/anim';
import {PersonaVista} from '../../lib/personaVista';
import {SombraPersiana} from '../../lib/persiana';
import {Cursiva, FondoPersiana, PalabraQueCae, clamp, estiloDe, fondoDe, lerp, outCubic} from './base';

const usePiezaVideo = () => {
  const t = useT();
  const {p, pal, fps, Hd, vista} = useG();
  const d: any = p.datos || {};
  const tt = t - p.t0;
  const dura = Math.max(0.5, p.t1 - p.t0);
  const e = estiloDe(fondoDe(d), pal.acento);
  // el texto se va 0,35 s antes de que el video vuelva (como en el taller)
  const texto = tt < dura - 0.35 ? 1 : 1 - clamp((tt - (dura - 0.35)) / 0.2);
  return {t, p, d, tt, dura, e, fps, Hd, texto, vista};
};

/* El tamaño de la palabra en MAYÚSCULAS: la cuenta del taller hasta 8 letras («SERVICIO» igual que la aprobada) y, más
   larga, más chica para que nunca se salga del cuadro (las mayúsculas de Rubik son más anchas). */
const tamMayus = (texto: string, ancho: number) => {
  const n = Math.max(1, texto.length);
  return Math.min(250, ancho / (n * 0.62), n > 8 ? 900 / (n * 0.66) : 999);
};
/* Un rectángulo redondeado como trazo de SVG (para el hueco con evenodd) */
const rectRedondo = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
};
/* Lo de adentro tapa todo el cuadro MENOS el rectángulo (ahí se ve tu video) */
const ConHueco: React.FC<{Hd: number; x: number; y: number; w: number; h: number; r: number; children: React.ReactNode}> = ({Hd, x, y, w, h, r, children}) => {
  const corte = `path(evenodd, "M0 0H1080V${Hd}H0Z${rectRedondo(x, y, w, h, r)}")`;
  return <AbsoluteFill style={{clipPath: corte, WebkitClipPath: corte}}>{children}</AbsoluteFill>;
};
/* Tu recorte con transparencia, en el cuadro del video (1080 × Hd), desde el segundo en que empieza su clip */
const Persona: React.FC<{d: any; fps: number; estilo?: React.CSSProperties}> = ({d, fps, estilo}) => {
  const {inicio, vista} = useG();
  // (2-oct) en la vista previa, el recorte que arma la página en vivo, en el mismo lugar y con el mismo estilo
  if (vista) return <PersonaVista estilo={estilo} />;
  if (!d.persona) return null;
  const desde = Math.max(0, Math.round((inicio - Number(d.personaDesde || 0)) * fps));
  return (
    <AbsoluteFill style={estilo}>
      <OffthreadVideo src={/^(https?:|data:|blob:)/.test(String(d.persona)) ? String(d.persona) : staticFile(String(d.persona))} transparent muted startFrom={desde} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    </AbsoluteFill>
  );
};

/* ══ Nueva 2 · La ventana: tu video se encoge a una ventana 9:16 y la palabra cae debajo ══ */
export const PeVentana: React.FC = () => {
  const {t, p, d, tt, e, fps, Hd, texto} = usePiezaVideo();
  const R = GRAF.rectVideo(p, t, 1080, Hd), k = R.k;
  if (k <= 0.001) return null;
  const mv = GRAF.MUEVE.ventana;
  const fin = {y: mv.oy * Hd, h: mv.s * Hd};
  const grande = String(d.grande || ''), tam = Math.min(230, 860 / (Math.max(1, grande.length) * 0.56));
  const r = 34 * k;
  return (
    <AbsoluteFill>
      <ConHueco Hd={Hd} x={R.x} y={R.y} w={R.w} h={R.h} r={r}>
        <FondoPersiana e={e} t={Math.max(0, tt)}>
          <div style={{position: 'absolute', left: 0, right: 0, top: fin.y + fin.h + 60, display: 'flex', justifyContent: 'center', opacity: texto}}>
            <div style={{position: 'relative'}}>
              <PalabraQueCae texto={grande} tt={tt - 0.45} e={e} tam={tam} fps={fps} desde={-420} />
              <Cursiva texto={String(d.chica || '')} tt={tt - 1.15} e={e} tam={80} estilo={{position: 'absolute', right: -10, top: -62}} />
            </div>
          </div>
        </FondoPersiana>
      </ConHueco>
      {/* la sombra de la ventana sobre la tarjeta (por dentro no pinta: ahí sigue tu video) */}
      <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: r,
        boxShadow: `0 ${30 * k}px ${60 * k}px rgba(${e.tinte},.5), 0 ${8 * k}px ${16 * k}px rgba(${e.tinte},.35)`}} />
      {/* la luz de la persiana también cae dentro de la ventana, sobre ti */}
      <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: r, overflow: 'hidden', opacity: k}}>
        <SombraPersiana t={Math.max(0, tt)} tinte="10,0,3" fuerza={0.4} />
      </div>
    </AbsoluteFill>
  );
};

/* ══ Nueva 6 · La tarjeta empuja tu video: sube desde abajo pegada a él; al final tu video la empuja de vuelta ══ */
export const PeEmpuja: React.FC = () => {
  const {t, p, d, tt, dura, e, fps, Hd} = usePiezaVideo();
  const borde = (tc: number) => { const R = GRAF.rectVideo(p, tc, 1080, Hd); return R.y + R.h; };
  const y = borde(t);
  if (y >= Hd - 0.5) return null;
  const vel = Math.abs(y - borde(t - 1 / 60));
  const blur = Math.min(16, vel * 0.12);
  const DUR = GRAF.MUEVE.empuja.a;
  const grande = String(d.grande || ''), tam = Math.min(270, 880 / (Math.max(1, grande.length) * 0.56));
  const ti = tt - DUR;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `translateY(${y}px)`, boxShadow: `0 -24px 50px rgba(${e.tinte},.55)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined}}>
        {ti < 0 ? (
          <FondoPersiana e={e} t={Math.max(0, tt)} />
        ) : (
          <FondoPersiana e={e} t={ti} zoom={lerp(1, 1.035, clamp(ti / Math.max(0.5, dura - DUR)))}>
            <div style={{position: 'absolute', left: 0, right: 0, top: (860 * Hd) / 1920, display: 'flex', justifyContent: 'center'}}>
              <div style={{position: 'relative'}}>
                <PalabraQueCae texto={grande} tt={ti} e={e} tam={tam} fps={fps} />
                <Cursiva texto={String(d.chica || '')} tt={ti - 0.75} e={e} estilo={{position: 'absolute', right: -6, top: -58}} />
              </div>
            </div>
          </FondoPersiana>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ══ Nueva 4 · Te sales de la tarjeta: tu video en una tarjeta a la altura del pecho y tu cabeza se sale por arriba ══ */
export const PeSales: React.FC = () => {
  const {t, p, d, tt, e, fps, Hd, texto} = usePiezaVideo();
  const R = GRAF.rectVideo(p, t, 1080, Hd), k = R.k;
  if (k <= 0.001) return null;
  const s = R.w / 1080;
  const tope = lerp(0, (1080 * Hd) / 1920, k);
  const abajo = R.y + R.h;
  const r = 34 * k;
  const grande = String(d.grande || '').toUpperCase(), tam = tamMayus(grande, 960);
  return (
    <AbsoluteFill>
      <ConHueco Hd={Hd} x={R.x} y={tope} w={R.w} h={abajo - tope} r={r}>
        <FondoPersiana e={e} t={Math.max(0, tt)}>
          {/* la palabra, detrás de ti, a la altura de la cabeza */}
          <div style={{position: 'absolute', left: 0, right: 0, top: (650 * Hd) / 1920, display: 'flex', justifyContent: 'center', opacity: texto}}>
            <PalabraQueCae texto={grande} tt={tt - 0.4} e={e} tam={tam} fps={fps} desde={-480} />
          </div>
        </FondoPersiana>
      </ConHueco>
      {/* la tarjeta: tu video adentro se oscurece (55 %) y le cae la persiana; su sombra sobre el fondo */}
      <div style={{position: 'absolute', left: R.x, top: tope, width: R.w, height: abajo - tope, borderRadius: r,
        boxShadow: `0 ${30 * k}px ${60 * k}px rgba(${e.tinte},.5)`}} />
      <div style={{position: 'absolute', left: R.x, top: tope, width: R.w, height: abajo - tope, borderRadius: r, overflow: 'hidden',
        background: `rgba(0,0,0,${(0.45 * k).toFixed(3)})`}}>
        <AbsoluteFill style={{opacity: k}}><SombraPersiana t={Math.max(0, tt)} tinte="10,0,3" fuerza={0.35} /></AbsoluteFill>
      </div>
      {/* tú encima, con la misma escala del video: la cabeza se sale por arriba del borde */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, transformOrigin: '0 0',
        transform: `translate(${R.x}px, ${R.y}px) scale(${s})`, filter: `drop-shadow(22px 26px 22px rgba(${e.tinte},.45))`, opacity: clamp(k * 3)}}>
        <Persona d={d} fps={fps} />
      </div>
      {/* la persiana también sobre ti */}
      <AbsoluteFill style={{opacity: 0.5 * k}}><SombraPersiana t={Math.max(0, tt)} tinte={e.tinte} fuerza={e.fuerza} /></AbsoluteFill>
      <div style={{opacity: texto}}>
        <Cursiva texto={String(d.chica || '')} tt={tt - 1.1} e={e} tam={84} estilo={{position: 'absolute', right: 130, top: abajo + 30}} />
      </div>
    </AbsoluteFill>
  );
};

/* ══ 5 · Tú delante de la palabra: corte seco a la tarjeta, la palabra cae y apareces tú delante, con sombra ══ */
export const PeTu: React.FC = () => {
  const {tt, dura, d, e, fps, Hd, vista} = usePiezaVideo();
  const grande = String(d.grande || '').toUpperCase(), tam = tamMayus(grande, 1000);
  const pT = outCubic(clamp((tt - 0.5) / 0.35));
  return (
    <FondoPersiana e={e} t={tt} zoom={lerp(1, 1.035, clamp(tt / dura))}>
      <div style={{position: 'absolute', left: 0, right: 0, top: (690 * Hd) / 1920, display: 'flex', justifyContent: 'center'}}>
        <PalabraQueCae texto={grande} tt={tt} e={e} tam={tam} fps={fps} />
      </div>
      {pT > 0 && (d.persona || vista) ? (
        <Persona d={d} fps={fps} estilo={{opacity: pT, transform: `translateY(${lerp(50, 0, pT)}px) scale(${lerp(1.04, 1, pT)})`, transformOrigin: '50% 100%',
          filter: `blur(${lerp(12, 0, pT)}px) drop-shadow(26px 30px 26px rgba(${e.tinte},.45))`}} />
      ) : null}
      <AbsoluteFill style={{opacity: 0.6 * pT}}><SombraPersiana t={tt} tinte={e.tinte} fuerza={e.fuerza} /></AbsoluteFill>
      <Cursiva texto={String(d.chica || '')} tt={tt - 1.1} e={e} tam={84} estilo={{position: 'absolute', right: 70, top: (600 * Hd) / 1920}} />
    </FondoPersiana>
  );
};

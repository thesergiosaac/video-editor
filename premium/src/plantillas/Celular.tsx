// Celular 3D (mockup) — pantalla completa. Tu cara queda en el círculo de arriba y el celular llega girando con OTRO video
// adentro (el que quieras mostrar: un clip tuyo, una grabación de pantalla o una escena de la biblioteca).
// Todo el 3D es del navegador (perspective + preserve-3d): el celular tiene grosor, brillo de vidrio y sombra que se mueve.
import React from 'react';
import {OffthreadVideo} from 'remotion';
import {noise2D} from '@remotion/noise';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Escribir} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

/* Dos formas: «encima» = tu video sigue a pantalla completa y el celular flota a un lado mientras hablas;
   «completa» = tu cara queda en el círculo de arriba y el celular manda en el centro. */
const MEDIDAS = {
  lado:     { an: 392, al: 800, x: 790, y: 190, giroY: -17, giroX: 6, etqX: 74, etqY: 1012 },
  encima:   { an: 372, al: 760, x: 660, y: 150, giroY: -15, giroX: 6, etqX: 96, etqY: 940 },
  completa: { an: 420, al: 860, x: 540, y: 350, giroY: -11, giroX: 7, etqX: 540, etqY: 292 },
};
const R = 54, BORDE = 13;

export const Celular: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const {op, sale} = usePresenciaGrupo();
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const entra = sp(t, p.t0 + 0.25, {damping: 15, stiffness: 90, mass: 1.1});
  const x = rampa(t, p.t1 - 0.85, p.t1 - 0.35, EASE.sale);
  // flotación orgánica: nunca está quieto
  const fx = noise2D('cel-x', t * 0.28, 0) * 10, fy = noise2D('cel-y', 0, t * 0.26) * 12;
  const gy = noise2D('cel-ry', t * 0.22, 3) * 3, gx = noise2D('cel-rx', 2, t * 0.2) * 2;
  const M0 = (MEDIDAS as any)[p.forma] || MEDIDAS.completa;
  const rotY = (1 - entra) * -52 + (M0.giroY + gy) * entra + x * 38;
  const rotX = (1 - entra) * 16 + (M0.giroX + gx) * entra - x * 10;
  const esc = (0.78 + 0.22 * entra) * (1 - 0.1 * x);
  const ty = (1 - entra) * 260 + fy - x * 180;
  const M = (MEDIDAS as any)[p.forma] || MEDIDAS.completa;
  const top = M.y, alto = M.al, ancho = M.an;
  const luz = tc + 0.35;                                  // barrido de luz cuando el celular llega
  if (op <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op * (1 - x)}}>
      {/* etiqueta: al lado del celular (encima) o debajo de tu cara (completa) */}
      <div style={{position: 'absolute', top: M.etqY, left: p.forma !== 'completa' ? M.etqX : 0, right: p.forma !== 'completa' ? undefined : 0,
        display: 'flex', justifyContent: p.forma !== 'completa' ? 'flex-start' : 'center', maxWidth: p.forma !== 'completa' ? 480 : undefined,
        fontFamily: MONO, fontWeight: 500, fontSize: 27, letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap',
        textShadow: '0 4px 18px rgba(0,0,0,.8)'}}>
        <Escribir texto={String(d.etiqueta || '')} t0={p.t0 + 0.5} velocidad={1.3} />
      </div>
      {/* resplandor detrás */}
      <div style={{position: 'absolute', left: M.x - 430, top: top + 60, width: 860, height: 700, borderRadius: '50%',
        background: `radial-gradient(closest-side, ${pal.a(0.3)}, ${pal.a(0)})`, opacity: clamp(entra), filter: 'blur(6px)'}} />
      <div style={{position: 'absolute', left: 0, top: top, width: 1080, height: alto + 160, perspective: 1500, perspectiveOrigin: '50% 45%'}}>
        <div style={{position: 'absolute', left: M.x - ancho / 2 + fx, top: ty, width: ancho, height: alto,
          transformStyle: 'preserve-3d', transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${esc})`}}>
          {/* sombra en el piso */}
          <div style={{position: 'absolute', left: -60, right: -60, bottom: -70, height: 150, borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(0,0,0,.75), rgba(0,0,0,0))', transform: 'translateZ(-60px) rotateX(78deg)', opacity: clamp(entra) * 0.9}} />
          {/* canto del celular (grosor) */}
          <div style={{position: 'absolute', inset: 0, borderRadius: R, transform: 'translateZ(-16px)',
            background: 'linear-gradient(120deg,#6b6b73,#2a2a30 35%,#55555e 60%,#1d1d22)', boxShadow: '0 60px 120px -30px rgba(0,0,0,.95)'}} />
          {/* cuerpo */}
          <div style={{position: 'absolute', inset: 0, borderRadius: R, overflow: 'hidden',
            background: 'linear-gradient(140deg,#d8d8de 0%,#8f8f99 18%,#3a3a42 45%,#8b8b95 70%,#c9c9d1 88%,#54545c 100%)',
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.35), 0 40px 90px -25px rgba(0,0,0,.9)'}}>
            {/* pantalla */}
            <div style={{position: 'absolute', inset: BORDE, borderRadius: R - 10, overflow: 'hidden', background: '#000'}}>
              {d.video ? (
                <OffthreadVideo src={String(d.video)} startFrom={Math.max(0, Math.round(Number(d.desde || 0) * 30))} muted
                  style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              ) : (
                <div style={{position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${pal.a(0.5)}, #14090f)`}} />
              )}
              {/* viñeta y reflejo de vidrio */}
              <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,0,.45) 100%)'}} />
              <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 72%, rgba(255,255,255,.10) 100%)', mixBlendMode: 'screen'}} />
              <Brillo t0={luz} w={ancho} h={alto} dur={1.1} fuerza={1.4} />
              {/* isla dinámica */}
              <div style={{position: 'absolute', top: 16, left: '50%', width: 108, height: 30, marginLeft: -54, borderRadius: 99, background: '#07070a'}} />
            </div>
            {/* filo de luz del marco */}
            <div style={{position: 'absolute', inset: 0, borderRadius: R, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.55), inset 0 -2px 0 rgba(255,255,255,.15)'}} />
          </div>
          {/* botones */}
          <div style={{position: 'absolute', right: -5, top: 190, width: 5, height: 96, borderRadius: 4, background: 'linear-gradient(180deg,#9a9aa4,#4a4a52)', transform: 'translateZ(-8px)'}} />
          <div style={{position: 'absolute', left: -5, top: 150, width: 5, height: 56, borderRadius: 4, background: 'linear-gradient(180deg,#9a9aa4,#4a4a52)', transform: 'translateZ(-8px)'}} />
        </div>
      </div>
      {/* pie: de qué es el video */}
      {d.titulo ? (
        <div style={{position: 'absolute', top: p.forma !== 'completa' ? M.etqY + 54 : top + alto + 46,
          left: p.forma !== 'completa' ? M.etqX : 90, right: p.forma !== 'completa' ? 480 : 90,
          textAlign: p.forma !== 'completa' ? 'left' : 'center', textShadow: p.forma !== 'completa' ? '0 6px 26px rgba(0,0,0,.85)' : undefined,
          fontFamily: OUTFIT, fontWeight: 900,
          fontSize: String(d.titulo).length > 26 ? 46 : 56, lineHeight: 1.05, letterSpacing: '-0.03em', color: pal.tinta,
          opacity: clamp(sp(t, tc + 0.5, RESORTES.carta) * 1.4), transform: `translateY(${(1 - sp(t, tc + 0.5, RESORTES.carta)) * 24}px)`}}>
          {String(d.titulo)}
        </div>
      ) : null}
    </div>
  );
};

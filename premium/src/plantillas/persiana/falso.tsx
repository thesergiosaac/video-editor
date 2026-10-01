// «La pantalla con sello» (2-oct-2026): el gancho del Día 2 («Hora perfecta para publicar» + el sello FALSO), vuelto pieza de
// Cherry. Cuando la persona dice una creencia que va a desmentir, sube una pantalla del celular DETRÁS de ella con la creencia
// escrita; con una hora, es la alarma con la rueda que gira y frena en esa hora; sin hora, unos ajustes con un interruptor
// que se prende. En la palabra donde empieza la corrección cae el sello rojo («FALSO», «MITO» o «NO») y tiembla.
// Nada tapa la cara: la persona (su recorte, d.persona) se dibuja ENCIMA de la pantalla, y solo dentro de la pantalla (fuera
// de ella se ve el video tal cual, con sus subtítulos). Familias: Interfaz en movimiento + Papel recortado (el sello).
import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile} from 'remotion';
// @ts-ignore
import GRAF from '../../graficos.js';
import {useG, useT} from '../../lib/anim';
import {INTER, ANTON} from '../../tema';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const outCubic = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const ROJO = '#FF3B30';
const FILA = 74;

/* La caja de la pantalla, en el dibujo de 1080 de ancho (alto Hd) */
const caja = (Hd: number) => ({x: 100, y: (150 * Hd) / 1920, w: 880, h: 820});

const Rueda: React.FC<{x: number; w: number; valores: string[]; pos: number}> = ({x, w, valores, pos}) => {
  const n = valores.length, base = Math.floor(pos), frac = pos - base;
  return (
    <div style={{position: 'absolute', left: x, top: 0, width: w, height: FILA * 5, overflow: 'hidden'}}>
      {[-3, -2, -1, 0, 1, 2, 3].map((k) => {
        const v = valores[(((base + k) % n) + n) % n], y = (k - frac + 2) * FILA, d = Math.abs(k - frac);
        return <div key={k} style={{position: 'absolute', left: 0, right: 0, top: y, height: FILA, display: 'grid', placeItems: 'center', fontFamily: INTER,
          fontWeight: d < 0.5 ? 800 : 800, fontSize: d < 0.5 ? 58 : 50, color: d < 0.5 ? '#fff' : 'rgba(255,255,255,.38)',
          transform: `scaleY(${1 - Math.min(0.45, d * 0.16)})`}}>{v}</div>;
      })}
    </div>
  );
};

/* Reloj (el ícono de la alarma) y engranaje (el de los ajustes), en trazo */
const Icono: React.FC<{tipo: 'reloj' | 'ajustes'; color: string}> = ({tipo, color}) => (
  <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    {tipo === 'reloj' ? (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)
      : (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" /></>)}
  </svg>
);

/* La hora «7:00 p. m.» → [hora 1-12, minutos de 5 en 5, pm] */
const partesHora = (h: string) => {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])/i.exec(String(h || '').trim());
  if (!m) return null;
  return {h: Math.max(1, Math.min(12, Number(m[1]))), m: Math.round(Number(m[2] || 0) / 5) % 12, pm: /p/i.test(m[3])};
};

const Persona: React.FC<{d: any; fps: number; Hd: number; k: number}> = ({d, fps, Hd, k}) => {
  const {inicio} = useG();
  if (!d.persona || k <= 0) return null;
  const desde = Math.max(0, Math.round((inicio - Number(d.personaDesde || 0)) * fps));
  const c = caja(Hd);
  /* solo donde la pantalla y su sombra tocan (la sombra baja ~130 px): fuera de ahí el video de abajo ya es la persona, y
     así los subtítulos, que van más abajo, se siguen viendo */
  const corte = `inset(${Math.max(0, c.y - 60)}px 0px ${Math.max(0, Hd - c.y - c.h - 150)}px 0px)`;
  return (
    <AbsoluteFill style={{clipPath: corte, WebkitClipPath: corte, opacity: k}}>
      <OffthreadVideo src={/^(https?:|data:|blob:)/.test(String(d.persona)) ? String(d.persona) : staticFile(String(d.persona))} transparent muted startFrom={desde}
        style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    </AbsoluteFill>
  );
};

export const PeFalso: React.FC = () => {
  const t = useT();
  const {p, pal, fps, Hd} = useG();
  const d: any = p.datos || {};
  const tt = t - p.t0, dura = Math.max(0.5, p.t1 - p.t0);
  const ts = GRAF.selloDe ? GRAF.selloDe(p) - p.t0 : Math.max(1.2, dura - 1.4);     // cuándo cae el sello
  const sube = outCubic(clamp(tt / 0.4));
  const sale = 1 - clamp((tt - (dura - 0.3)) / 0.3);
  const c = caja(Hd);
  const hora = partesHora(d.hora);
  const titulo = String(d.titulo || '');
  const tamTit = titulo.length > 26 ? 44 : 50;
  // la rueda: rápido al principio y frena justo antes del sello
  const k = 1 - Math.pow(1 - clamp((tt - 0.15) / Math.max(0.3, ts - 0.27)), 2.4);
  const sello = clamp((tt - ts) / 0.12);
  const temblor = sello >= 1 ? Math.sin((tt - ts) * 90) * 9 * Math.max(0, 1 - (tt - ts - 0.14) / 0.25) : 0;
  const interruptor = outCubic(clamp((tt - 0.65) / 0.25));
  const palabra = String(d.sello || 'FALSO').toUpperCase();
  const tamSello = palabra.length <= 2 ? 380 : palabra.length <= 4 ? 320 : 300;
  return (
    <AbsoluteFill style={{opacity: sale, transform: `translate(${temblor}px,${temblor * 0.5}px)`}}>
      <div style={{position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: 52, background: '#1c1c1e', color: '#fff', fontFamily: INTER,
        boxShadow: '0 40px 90px rgba(0,0,0,.5)', transform: `translateY(${lerp(500, 0, sube)}px)`, opacity: clamp(sube * 3), overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 44, right: 44, top: 34, display: 'flex', justifyContent: 'space-between', fontSize: 34}}>
          {hora ? (<><span style={{color: '#ff9f0a'}}>Cancelar</span><b>Editar alarma</b><span style={{color: '#ff9f0a', fontWeight: 800}}>Guardar</span></>)
            : (<><span style={{color: '#0a84ff'}}>‹ Ajustes</span><b>General</b><span style={{width: 120}} /></>)}
        </div>
        <div style={{position: 'absolute', left: 44, right: 44, top: 108, display: 'flex', alignItems: 'center', gap: 18}}>
          <div style={{width: 70, height: 70, borderRadius: 20, background: pal.acento, display: 'grid', placeItems: 'center', flex: 'none'}}>
            <Icono tipo={hora ? 'reloj' : 'ajustes'} color={pal.sobre} /></div>
          <div style={{fontWeight: 800, fontSize: tamTit, lineHeight: 1.05, letterSpacing: '-.01em'}}>{titulo}</div>
        </div>
        {hora ? (
          <div style={{position: 'absolute', left: 40, right: 40, top: 230, height: FILA * 5}}>
            <div style={{position: 'absolute', left: 0, right: 0, top: FILA * 2, height: FILA, borderRadius: 18, background: '#2c2c2e'}} />
            <Rueda x={150} w={180} valores={Array.from({length: 12}, (_, i) => String(i + 1))} pos={lerp(hora.h - 1 - 29, hora.h - 1, k)} />
            <Rueda x={340} w={180} valores={Array.from({length: 12}, (_, i) => String(i * 5).padStart(2, '0'))} pos={lerp(hora.m - 40, hora.m, k)} />
            {['a. m.', 'p. m.'].map((v, i) => {
              const pm = hora.pm ? outCubic(clamp((k - 0.55) / 0.2)) : 0;
              const fila = 2 + i - pm, dd = Math.abs(fila - 2);
              return <div key={v} style={{position: 'absolute', left: 540, width: 200, top: fila * FILA, height: FILA, display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: dd < 0.5 ? 58 : 50, color: dd < 0.5 ? '#fff' : 'rgba(255,255,255,.38)'}}>{v}</div>;
            })}
          </div>
        ) : (
          <div style={{position: 'absolute', left: 44, right: 44, top: 250}}>
            {[titulo, 'Para todos', 'Siempre'].map((fila, i) => (
              <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '30px 0', borderBottom: '2px solid #3a3a3c', fontSize: 36}}>
                <span style={{maxWidth: 560, color: i ? 'rgba(255,255,255,.6)' : '#fff', fontWeight: i ? 500 : 700}}>{i ? fila : 'Activar'}</span>
                {i === 0 ? (
                  <div style={{width: 112, height: 66, borderRadius: 40, background: interruptor > 0.5 ? '#34c759' : '#39393d', position: 'relative'}}>
                    <div style={{position: 'absolute', top: 5, left: lerp(5, 51, interruptor), width: 56, height: 56, borderRadius: '50%', background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,.3)'}} />
                  </div>
                ) : <span style={{color: 'rgba(255,255,255,.4)'}}>✓</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{position: 'absolute', left: 44, right: 44, top: 640, borderTop: '2px solid #3a3a3c', paddingTop: 26, display: 'flex', justifyContent: 'space-between', fontSize: 34}}>
          <span>Etiqueta</span><span style={{color: 'rgba(255,255,255,.55)', maxWidth: 520, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{titulo}</span>
        </div>
      </div>
      {sello > 0 && (
        <div style={{position: 'absolute', left: 540, top: c.y + 370, transform: `translate(-50%,-50%) scale(${lerp(2.4, 1, outCubic(sello))}) rotate(-12deg)`, filter: 'url(#tintaFalso)',
          border: `22px solid ${ROJO}`, borderRadius: 40, padding: '6px 64px 0', color: ROJO, fontFamily: ANTON, fontSize: tamSello, lineHeight: 1.05,
          background: 'rgba(28,28,30,.25)', opacity: clamp(sello * 3), whiteSpace: 'nowrap'}}>{palabra}</div>
      )}
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="tintaFalso"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={3} /><feDisplacementMap in="SourceGraphic" scale={10} /></filter>
      </svg>
      {/* tu recorte encima de la pantalla: nada te tapa la cara */}
      <Persona d={d} fps={fps} Hd={Hd} k={sube} />
    </AbsoluteFill>
  );
};

// «Noche y amanecer» (2-oct-2026): la madrugada del Día 2 vuelta pieza de Cherry. Cuando la persona habla de la noche o de
// una hora de madrugada («lo subo a las 3 de la mañana», «mientras todos duermen»), el video se vuelve NOCHE (lo pinta el
// ensamblador: graficos.js › filtroNoche, la misma cuenta en la vista previa) y aquí van las estrellas, la notificación y un
// reloj grande; si dice que amanece o que pasa el tiempo, el reloj corre hasta la hora final y la imagen amanece.
// Todo va ARRIBA de la cabeza: nada cruza la cara.
import React from 'react';
import {AbsoluteFill} from 'remotion';
// @ts-ignore
import GRAF from '../../graficos.js';
import {useG, useT} from '../../lib/anim';
import {ANTON, INTER} from '../../tema';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const outCubic = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const outBack = (k: number) => { const c = 1.70158, x = clamp(k) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

/* «3:00» → minutos desde la medianoche (las horas de la madrugada y la mañana: a. m.) */
const minutosDe = (h: string) => {
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(String(h || ''));
  return m ? (Number(m[1]) % 24) * 60 + Number(m[2] || 0) : null;
};
const textoHora = (min: number) => {
  const h24 = Math.floor(min / 60) % 24, mm = Math.round(min % 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {hh: h12 + ':' + String(mm).padStart(2, '0'), ap: h24 < 12 ? 'a. m.' : 'p. m.'};
};

/* El ícono de la notificación: un botón de play en un cuadro de degradado (nada de logos) */
const IconoApp: React.FC = () => (
  <div style={{width: 92, height: 92, borderRadius: 24, background: 'linear-gradient(140deg,#7b4bff,#ff2d8a 60%,#ffb23f)', display: 'grid', placeItems: 'center', flex: 'none'}}>
    <svg width={46} height={46} viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="#fff" /></svg>
  </div>
);

export const PeNoche: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d: any = p.datos || {};
  const k = GRAF.nocheEn ? GRAF.nocheEn(p, t) : {noche: 0, amanece: 0};
  const m: number[] = (Array.isArray(p.marcas) ? p.marcas : []).map(Number);
  const o = clamp((t - p.t0) / 0.3) * (1 - clamp((t - (p.t1 - 0.3)) / 0.3));
  if (o <= 0) return null;
  const notif = outCubic(clamp((t - p.t0 - 0.1) / 0.4));
  const grande = outBack(clamp((t - p.t0 - 0.45) / 0.4));
  const i0 = minutosDe(d.hora), i1 = minutosDe(d.horaFin);
  const corre = i0 != null && i1 != null && m.length > 1 ? outCubic(clamp((t - (m[0] + 0.5)) / Math.max(0.6, m[1] + 1 - (m[0] + 0.5)))) : 0;
  const ahora = i0 != null ? textoHora(i1 != null ? lerp(i0, i1 < i0 ? i1 + 1440 : i1, corre) : i0) : null;
  const estrellas = Array.from({length: 34}, (_, i) => ({x: (i * 241) % 1040 + 20, y: (i * 157) % 760 + 40, s: 2 + (i % 3) * 2, f: (i * 0.37) % 1}));
  return (
    <AbsoluteFill style={{opacity: o}}>
      {k.noche > 0.05 && estrellas.map((e, i) => (
        <div key={i} style={{position: 'absolute', left: e.x, top: e.y, width: e.s, height: e.s, borderRadius: '50%', background: '#fff',
          opacity: k.noche * (0.5 + 0.5 * Math.sin(t * 3 + e.f * 6.28))}} />
      ))}
      {d.aviso ? (
        <div style={{position: 'absolute', left: 60, right: 60, top: lerp(-200, 60, notif), height: 150, borderRadius: 40, background: 'rgba(240,240,245,.92)',
          boxShadow: '0 20px 50px rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 30px', fontFamily: INTER}}>
          <IconoApp />
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontWeight: 800, fontSize: 34, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{String(d.aviso)}</div>
            {d.detalle ? <div style={{fontWeight: 500, fontSize: 28, color: '#555', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{String(d.detalle)}</div> : null}
          </div>
          {ahora ? <div style={{fontWeight: 600, fontSize: 26, color: '#777', alignSelf: 'flex-start', marginTop: 34}}>{ahora.hh} {ahora.ap}</div> : null}
        </div>
      ) : null}
      {ahora ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 260, textAlign: 'center', transform: `scale(${grande})`, transformOrigin: '50% 30%'}}>
          <div style={{fontFamily: ANTON, fontSize: 230, lineHeight: 0.95, color: '#fff', textShadow: '0 10px 40px rgba(0,0,0,.5)'}}>{ahora.hh}</div>
          <div style={{fontFamily: ANTON, fontSize: 70, letterSpacing: '.08em', color: k.amanece > 0.4 ? '#FFC46B' : pal.acento}}>{ahora.ap.toUpperCase()}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

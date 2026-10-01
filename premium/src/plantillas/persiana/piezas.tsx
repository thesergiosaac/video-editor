// Las piezas de «La persiana» (29-sep-2026), tal como las aprobó Sergio en el taller (P01…P09), dibujadas SOLAS: aquí
// no va el video de fondo (lo pone el ensamblador) y el cuadro 0 es el instante en que entra la tarjeta (p.t0).
// Todas tapan el cuadro entero (forma «tarjeta»): corte seco al entrar y al salir, y la voz sigue sonando debajo.
import React from 'react';
import {AbsoluteFill, Freeze, Img, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {useG, useT} from '../../lib/anim';
import {SombraPersiana} from '../../lib/persiana';
import {Cursiva, FondoPersiana, PalabraQueCae, Yv, clamp, estiloDe, fondoDe, lerp, outCubic, tamDe} from './base';

/* Lo común: el tiempo desde que entra (tt), lo que dura, el estilo del fondo y el crecimiento del 3,5 % */
const usePieza = () => {
  const t = useT();
  const {p, pal, fps, Hd} = useG();
  const d: any = p.datos || {};
  const tt = t - p.t0;
  const dura = Math.max(0.5, p.t1 - p.t0);
  const e = estiloDe(fondoDe(d), pal.acento);
  return {t, p, d, tt, dura, e, fps, Y: Yv(Hd), zoom: lerp(1, 1.035, clamp(tt / dura))};
};
const medioDe = (u: string) => (u && !/^(https?:|data:|blob:)/.test(u) ? staticFile(u) : u);

/* ══ 1 · La tarjeta (P01): palabra centrada y cursiva arriba a la derecha ══ */
export const PeTarjeta: React.FC = () => {
  const {d, tt, e, fps, Y, zoom} = usePieza();
  const grande = String(d.grande || ''), tam = tamDe(grande, 270);
  return (
    <FondoPersiana e={e} t={tt} zoom={zoom}>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(860), display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative'}}>
          <PalabraQueCae texto={grande} tt={tt} e={e} tam={tam} fps={fps} />
          <Cursiva texto={String(d.chica || '')} tt={tt - 0.75} e={e} estilo={{position: 'absolute', right: -6, top: -58}} />
        </div>
      </div>
    </FondoPersiana>
  );
};

/* ══ 7 · La lista que cae (P07): cada palabra en su segundo, con su número en cursiva ══ */
export const PeLista: React.FC = () => {
  const {t, p, d, tt, e, fps, Y, zoom} = usePieza();
  const items: string[] = (Array.isArray(d.items) ? d.items : []).map((x: any) => String(x || ''));
  const largo = Math.max(1, ...items.map((i) => i.length));
  const tam = Math.min(200, 760 / (largo * 0.56));
  const paso = tam * 1.12;
  const top = Y(960) - (paso * items.length) / 2;
  return (
    <FondoPersiana e={e} t={tt} zoom={zoom}>
      {items.map((it, i) => {
        const s = p.marcas[i] != null ? p.marcas[i] : p.t0 + i * 0.45;
        const ti = t - s + 0.04;
        return (
          <div key={i} style={{position: 'absolute', left: 220, top: top + i * paso}}>
            <Cursiva texto={String(i + 1)} tt={ti - 0.05} e={e} tam={tam * 0.5} estilo={{position: 'absolute', left: -92, top: -tam * 0.06}} />
            <PalabraQueCae texto={it} tt={ti} e={e} tam={tam} fps={fps} desde={-420} baja={0.42} />
          </div>
        );
      })}
    </FondoPersiana>
  );
};

/* ══ 8 · La cifra que cae y cuenta (P08): cifras de ancho fijo para que no baile ══ */
const fmt = (n: number, dec: number) => {
  const x = Number(n.toFixed(dec));
  const [ent, frac] = Math.abs(x).toFixed(dec).split('.');
  return (x < 0 ? '-' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (frac ? ',' + frac : '');
};
export const PeCifra: React.FC = () => {
  const {d, tt, dura, e, fps, Y, zoom} = usePieza();
  const hasta = Number(d.valor) || 0, dec = Math.max(0, Math.min(2, Number(d.decimales) || 0));
  const cuenta = Math.min(1.7, Math.max(0.8, dura - 0.7));
  const k = clamp(tt / cuenta);
  const valor = lerp(0, hasta, 1 - Math.pow(1 - k, 3));
  const prefijo = String(d.prefijo || ''), sufijo = String(d.sufijo || '');   // «$» delante; «%», «M», «k» detrás
  const final = prefijo + fmt(hasta, dec) + sufijo;
  const tam = Math.min(270, 900 / (final.length * 0.6));
  return (
    <FondoPersiana e={e} t={tt} zoom={zoom}>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(820), display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative'}}>
          <PalabraQueCae texto={prefijo + fmt(valor, dec) + sufijo} tt={tt} e={e} tam={tam} fps={fps}
            estilo={{minWidth: final.length * tam * 0.6, textAlign: 'center', fontVariantNumeric: 'tabular-nums'}} />
          <Cursiva texto={String(d.unidad || '')} tt={tt - cuenta + 0.1} e={e} tam={92} estilo={{position: 'absolute', right: 0, bottom: -96}} />
        </div>
      </div>
    </FondoPersiana>
  );
};

/* ══ 9 · Antes y ahora (P09): una palabra cae, la otra sube, «vs» en medio ══ */
export const PeVs: React.FC = () => {
  const {d, tt, e, fps, Y, zoom} = usePieza();
  const arriba = String(d.arriba || ''), abajo = String(d.abajo || '');
  const tam = Math.min(250, 880 / (Math.max(arriba.length, abajo.length, 1) * 0.56));
  return (
    <FondoPersiana e={e} t={tt} zoom={zoom}>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(960) - tam * 1.28, display: 'flex', justifyContent: 'center'}}>
        <PalabraQueCae texto={arriba} tt={tt} e={e} tam={tam} fps={fps} desde={-700} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(960) - 78, display: 'flex', justifyContent: 'center'}}>
        <Cursiva texto={String(d.medio || 'vs')} tt={tt - 0.85} e={e} tam={150} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(960) + tam * 0.3, display: 'flex', justifyContent: 'center'}}>
        <PalabraQueCae texto={abajo} tt={tt - 0.3} e={e} tam={tam} fps={fps} desde={700} />
      </div>
    </FondoPersiana>
  );
};

/* El clip de la persona dentro de la tarjeta: arranca en SU segundo y, si se acaba antes, queda en su último cuadro */
const ClipDentro: React.FC<{d: any; fps: number; posicion?: string}> = ({d, fps, posicion}) => {
  const cuadro = useCurrentFrame();
  const medio = medioDe(String(d.medio || ''));
  if (!medio) return null;
  // una captura (imagen) va quieta en el mismo marco
  if (d.imagen) return <Img src={medio} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicion}} />;
  const desde = Math.max(0, Number(d.desde || 0));
  const v = <OffthreadVideo src={medio} muted startFrom={Math.round(desde * fps)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicion}} />;
  const dur = Number(d.dur || 0);
  const ultimo = dur > 0 ? Math.floor((dur - desde - 0.12) * fps) : Infinity;
  return cuadro > ultimo && ultimo > 0 ? <Freeze frame={ultimo}>{v}</Freeze> : v;
};

/* ══ 2 · Tu clip vertical al lado (P02): cae girando (-16° → -4°) y sigue reproduciéndose ══ */
export const PeClipV: React.FC = () => {
  const {d, tt, e, fps, Y, zoom} = usePieza();
  const W = 600, H = 930, X = (1080 - W) / 2, top = Y(150);
  const pos = (s: number) => outCubic(clamp(s / 0.55));
  const yC = (s: number) => lerp(-1500, 0, pos(s));
  const vel = Math.abs(yC(tt) - yC(tt - 1 / 60));
  const grande = String(d.grande || ''), tam = tamDe(grande, 250);
  return (
    <FondoPersiana e={e} t={tt} zoom={zoom}>
      <div style={{position: 'absolute', left: X, top, width: W, height: H, borderRadius: 34, overflow: 'hidden', background: '#111',
        transform: `translateY(${yC(tt)}px) rotate(${lerp(-16, -4, pos(tt))}deg)`, filter: vel > 0.5 ? `blur(${Math.min(14, vel * 0.25)}px)` : undefined,
        boxShadow: `0 30px 60px rgba(${e.tinte},.45), 0 8px 16px rgba(${e.tinte},.3)`}}>
        <ClipDentro d={d} fps={fps} />
        <SombraPersiana t={tt} tinte={e.tinte} fuerza={0.38} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(1170), display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative'}}>
          <PalabraQueCae texto={grande} tt={tt - 0.4} e={e} tam={tam} fps={fps} desde={-500} />
          <Cursiva texto={String(d.chica || '')} tt={tt - 1.1} e={e} tam={80} estilo={{position: 'absolute', right: -10, bottom: -78}} />
        </div>
      </div>
    </FondoPersiana>
  );
};

/* ══ 3 · Clip horizontal con título (P03): entra deslizándose desde la derecha ══ */
export const PeClipH: React.FC = () => {
  const {d, tt, e, fps, Y, zoom} = usePieza();
  const W = 940, H = Math.round((940 * 9) / 16), X = (1080 - W) / 2, top = Y(820);
  const xC = (s: number) => lerp(1300, 0, outCubic(clamp(s / 0.5)));
  const vel = Math.abs(xC(tt) - xC(tt - 1 / 60));
  const grande = String(d.grande || ''), tam = tamDe(grande, 250);
  return (
    <FondoPersiana e={e} t={tt} zoom={zoom}>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(560), display: 'flex', justifyContent: 'center'}}>
        <PalabraQueCae texto={grande} tt={tt - 0.3} e={e} tam={tam} fps={fps} desde={-560} />
      </div>
      <div style={{position: 'absolute', left: X, top, width: W, height: H, borderRadius: 30, overflow: 'hidden', background: '#111',
        transform: `translateX(${xC(tt)}px)`, filter: vel > 0.5 ? `blur(${Math.min(14, vel * 0.22)}px)` : undefined,
        boxShadow: `0 30px 60px rgba(${e.tinte},.4), 0 8px 16px rgba(${e.tinte},.28)`}}>
        <ClipDentro d={d} fps={fps} posicion="50% 38%" />
        <SombraPersiana t={tt} tinte={e.tinte} fuerza={0.34} />
      </div>
      <Cursiva texto={String(d.chica || '')} tt={tt - 1.05} e={e} tam={84} estilo={{position: 'absolute', right: X + 10, top: top + H + 34}} />
    </FondoPersiana>
  );
};

/* ══ 6 · La foto que cae (P06): polaroid con estela que queda torcida (-8° → 6°) ══ */
export const PeFoto: React.FC = () => {
  const {d, tt, e, fps, Y, zoom} = usePieza();
  const W = 640, X = (1080 - W) / 2, top = Y(200), BORDE = 26, PIE = 110, ESTELA = 10;
  const p = (s: number) => outCubic(clamp(s / 0.5));
  const yF = (s: number) => lerp(-1300, 0, p(s));
  const rot = (s: number) => lerp(-8, 6, p(s));
  const vel = Math.abs(yF(tt) - yF(tt - 1 / 60));
  const grande = String(d.grande || ''), tam = tamDe(grande, 250);
  const src = medioDe(String(d.medio || ''));
  const polaroid = (s: number, extra: React.CSSProperties, k: string) => (
    <div key={k} style={{position: 'absolute', left: X, top, width: W, padding: `${BORDE}px ${BORDE}px ${PIE}px`, background: '#fdfcf8', borderRadius: 8,
      transform: `translateY(${yF(s)}px) rotate(${rot(s)}deg)`, ...extra}}>
      <div style={{position: 'relative', width: W - BORDE * 2, height: W - BORDE * 2, overflow: 'hidden', borderRadius: 3}}>
        {src ? <Img src={src} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : null}
        <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 30px rgba(0,0,0,.25)'}} />
      </div>
    </div>
  );
  return (
    <FondoPersiana e={e} t={tt} zoom={zoom}>
      {vel > 0.5 && Array.from({length: ESTELA}, (_, i) => polaroid(tt - (i / ESTELA) * (1 / 60) * 3, {opacity: 0.1, filter: 'blur(8px)'}, 'e' + i))}
      {polaroid(tt, {opacity: vel > 0.5 ? lerp(1, 0.45, clamp(vel / 40)) : 1, filter: vel > 0.5 ? `blur(${Math.min(10, vel * 0.25)}px)` : undefined,
        boxShadow: `0 30px 50px rgba(${e.tinte},.35), 0 6px 12px rgba(${e.tinte},.25)`}, 'foto')}
      <AbsoluteFill style={{opacity: 0.6}}><SombraPersiana t={tt} tinte={e.tinte} fuerza={e.fuerza} /></AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y(1110), display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative'}}>
          <PalabraQueCae texto={grande} tt={tt - 0.35} e={e} tam={tam} fps={fps} desde={-460} />
          <Cursiva texto={String(d.chica || '')} tt={tt - 1.05} e={e} tam={84} estilo={{position: 'absolute', right: -14, bottom: -82}} />
        </div>
      </div>
    </FondoPersiana>
  );
};

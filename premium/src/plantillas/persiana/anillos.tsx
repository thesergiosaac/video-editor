// «Anillos alrededor de ti» (2-oct-2026): el anillo de alcance del Día 2 vuelto pieza de Cherry. Cuando la persona explica que
// algo llega a la gente por NIVELES («primero a tus seguidores, luego a gente parecida, luego a todo el mundo»), aparece un
// anillo en perspectiva por nivel alrededor de su pecho, con personitas encima, y arriba un contador que sube con cada nivel;
// en el último salen ondas. La mitad de ATRÁS de cada anillo va detrás de la persona y la de ADELANTE encima: su recorte
// (d.persona) se dibuja entre las dos. Forma «rodea» (graficos.js). Nada tapa la cara: los anillos van a la altura del pecho.
import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile} from 'remotion';
import {useG, useT} from '../../lib/anim';
import {PersonaVista} from '../../lib/personaVista';
import {ANTON, INTER} from '../../tema';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const outCubic = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const outBack = (k: number) => { const c = 1.70158, x = clamp(k) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

const CX = 540, ACH = 0.3;
const RAD = [300, 520, 760];
const CUANTOS = [8, 14, 24];
type Punto = {ang: number; r: number};
const puntos = (n: number, r: number, gira: number): Punto[] => Array.from({length: n}, (_, i) => ({ang: gira + (i / n) * Math.PI * 2, r}));
const GIRO = [0.2, 0.05, 0.11];

/* La personita: círculo con cabeza y hombros (nada de emoji) */
const Personita: React.FC<{tam: number; color: string; fondo: string}> = ({tam, color, fondo}) => (
  <div style={{width: tam, height: tam, borderRadius: '50%', background: fondo, border: `${Math.max(2, tam * 0.06)}px solid ${color}`, boxSizing: 'border-box', overflow: 'hidden'}}>
    <svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="9.3" r="4.2" fill={color} /><path d="M3.8 23c.8-5 4.2-7.6 8.2-7.6s7.4 2.6 8.2 7.6z" fill={color} /></svg>
  </div>
);

/* «1200000» → «1,2 M»; «31600» → «31,6 mil» */
const corto = (n: number) => {
  if (n >= 1e6) return (Math.round(n / 1e5) / 10).toString().replace('.', ',') + ' M';
  if (n >= 1e4) return (Math.round(n / 100) / 10).toString().replace('.', ',') + ' mil';
  return Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
};

const Persona: React.FC<{d: any; fps: number}> = ({d, fps}) => {
  const {inicio, vista} = useG();
  if (vista) return <PersonaVista />;     // (2-oct) en la vista previa, el recorte que arma la página en vivo
  if (!d.persona) return null;
  const desde = Math.max(0, Math.round((inicio - Number(d.personaDesde || 0)) * fps));
  return (
    <AbsoluteFill>
      <OffthreadVideo src={/^(https?:|data:|blob:)/.test(String(d.persona)) ? String(d.persona) : staticFile(String(d.persona))} transparent muted startFrom={desde}
        style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    </AbsoluteFill>
  );
};

export const PeAnillos: React.FC = () => {
  const t = useT();
  const {p, pal, fps, Hd} = useG();
  const d: any = p.datos || {};
  const items: any[] = Array.isArray(d.items) ? d.items.slice(0, 3) : [];
  const m: number[] = (Array.isArray(p.marcas) ? p.marcas : []).map(Number);
  if (!items.length) return null;
  const CY = (1320 * Hd) / 1920;     // a la altura del pecho, lejos de la barbilla
  const salida = 1 - clamp((t - (p.t1 - 0.35)) / 0.35);
  const llega = (i: number) => (m[i] != null ? m[i] - 0.1 : p.t0 + 0.1 + i * 1.2);
  const kAnillo = items.map((_, i) => outCubic(clamp((t - llega(i)) / 0.55)) * salida);
  const acento = pal.acento;
  const xy = (q: Punto) => ({x: CX + Math.cos(q.ang) * q.r, y: CY + Math.sin(q.ang) * q.r * ACH});
  // el nivel de ahora y el contador, que rueda del anterior al nuevo
  let nivel = 0;
  items.forEach((_, i) => { if (t >= llega(i)) nivel = i; });
  const val = (i: number) => Math.max(0, Number(items[i] && items[i].valor) || 0);
  const kRueda = outCubic(clamp((t - llega(nivel)) / 0.9));
  const contador = lerp(nivel ? val(nivel - 1) : 0, val(nivel), kRueda);
  const hayNumeros = items.some((_, i) => val(i) > 0);
  const ultimo = items.length - 1;

  // (una función, no un componente: así no se vuelve a montar en cada cuadro)
  const dibujarMitad = (mitad: 'atras' | 'delante') => {
    const enMitad = (q: Punto) => (Math.sin(q.ang) < 0) === (mitad === 'atras');
    return (
      <AbsoluteFill>
        <svg width={1080} height={Hd} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          {items.map((_, i) => {
            const k = kAnillo[i];
            if (k <= 0) return null;
            const rx = RAD[i], ry = rx * ACH;
            const dd = mitad === 'atras' ? `M ${CX - rx} ${CY} A ${rx} ${ry} 0 0 1 ${CX + rx} ${CY}` : `M ${CX + rx} ${CY} A ${rx} ${ry} 0 0 1 ${CX - rx} ${CY}`;
            // el brillo es blanco tenue, nunca del color del anillo
            return <path key={i} d={dd} fill="none" stroke={acento} strokeWidth={7 - i} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k}
              style={{filter: 'drop-shadow(0 0 8px rgba(255,255,255,.45))'}} opacity={0.95} />;
          })}
          {/* ondas en el último nivel */}
          {[0, 0.35, 0.7].map((dt, j) => {
            const k = clamp((t - llega(ultimo) - 0.6 - dt) / 0.9);
            if (k <= 0 || k >= 1 || salida <= 0) return null;
            const rx = lerp(RAD[ultimo], 1500, outCubic(k)), ry = rx * ACH;
            const dd = mitad === 'atras' ? `M ${CX - rx} ${CY} A ${rx} ${ry} 0 0 1 ${CX + rx} ${CY}` : `M ${CX + rx} ${CY} A ${rx} ${ry} 0 0 1 ${CX - rx} ${CY}`;
            return <path key={'o' + j} d={dd} fill="none" stroke={pal.a(0.8 * (1 - k))} strokeWidth={lerp(10, 2, k)} />;
          })}
        </svg>
        {items.map((_, i) => puntos(CUANTOS[i], RAD[i], GIRO[i]).filter(enMitad).map((q, j) => {
          const k = outBack(clamp((t - llega(i) - 0.15 - j * (0.35 / CUANTOS[i])) / 0.35)) * salida;
          if (k <= 0) return null;
          const {x, y} = xy(q), tam = [74, 66, 58][i];
          const escala = lerp(0.75, 1.15, (Math.sin(q.ang) + 1) / 2);   // los de adelante se ven más grandes
          return (
            <div key={i + '-' + j} style={{position: 'absolute', left: x - tam / 2, top: y - tam / 2, transform: `scale(${k * escala})`, opacity: clamp(k * 2)}}>
              <Personita tam={tam} color={acento} fondo="rgba(0,0,0,.55)" />
            </div>
          );
        }))}
      </AbsoluteFill>
    );
  };

  const etiqueta = String((items[nivel] && items[nivel].etiqueta) || '');
  const kEt = outCubic(clamp((t - llega(nivel)) / 0.3));
  return (
    <AbsoluteFill style={{opacity: clamp((t - p.t0) / 0.2)}}>
      {dibujarMitad('atras')}
      <Persona d={d} fps={fps} />
      {dibujarMitad('delante')}
      {/* el contador y el nivel, arriba (nunca sobre la cara) */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: salida}}>
        {hayNumeros ? (
          <div style={{fontFamily: ANTON, fontSize: 120, lineHeight: 1, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,.55)'}}>
            {corto(contador)}{d.unidad ? <span style={{fontSize: 54, marginLeft: 14, color: acento}}>{String(d.unidad)}</span> : null}
          </div>
        ) : null}
        {etiqueta ? (
          <div style={{marginTop: 14, padding: '12px 30px', borderRadius: 999, background: 'rgba(16,14,14,.78)', border: '1px solid rgba(255,255,255,.14)', color: '#fff',
            fontFamily: INTER, fontWeight: 800, fontSize: 34, letterSpacing: '.02em', opacity: kEt, transform: `translateY(${lerp(14, 0, kEt)}px)`}}>
            <span style={{display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: acento, marginRight: 14, verticalAlign: 'middle'}} />{etiqueta}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

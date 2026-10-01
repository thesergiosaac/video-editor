// Piezas compartidas de los gráficos premium: tambor de dígitos, letras cinéticas, máquina de escribir, chispas,
// barrido de luz y la tarjeta de vidrio con profundidad 3D. Todo con los tiempos en segundos del video.
import React from 'react';
import {interpolate, random} from 'remotion';
import {noise2D} from '@remotion/noise';
import {makeSpark} from '@remotion/shapes';
import {GRANO, MONO} from '../tema';
import {EASE, RESORTES, clamp, giro, lerp, rampa, sp, useG, useT} from './anim';
import {Desenfoque} from './Desenfoque';

/* ───────── Tambor: un dígito que rueda como un contador mecánico ───────── */
// Dónde va el tambor de un dígito cuando el número entero vale `v`. Las unidades ruedan todo el tiempo (v/1);
// las decenas y de ahí para arriba se quedan quietas y solo giran un paso completo en el último 10% del de abajo,
// como un odómetro de verdad. Así SIEMPRE terminan en un número entero (antes 17 dejaba las decenas en 1,7: a medio girar).
export const posDigito = (v: number, p: number) => {
  const q = v / p;
  if (p <= 1) return q;
  const b = Math.floor(q);
  return b + Math.max(0, q - b - 0.9) * 10;
};
// vel = cuántos dígitos avanza por cuadro de 30: con giro rápido se desenfoca un poco (como el motion blur, pero liviano)
export const Tambor: React.FC<{pos: number; final: number | string; alto?: number; vel?: number}> = ({pos, final, alto = 1.2, vel = 0}) => {
  const base = Math.floor(pos);
  const frac = pos - base;
  const mascara = 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 17%, #000 83%, rgba(0,0,0,0) 100%)';
  const borroso = Math.min(7, Math.abs(vel) * 5);
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      <span style={{visibility: 'hidden'}}>{final}</span>
      <span style={{position: 'absolute', left: '-40%', right: '-40%', top: 0, bottom: 0, overflow: 'hidden', WebkitMaskImage: mascara, maskImage: mascara, filter: borroso > 0.4 ? `blur(${borroso.toFixed(1)}px)` : undefined}}>
        {[-1, 0, 1, 2].map((k) => {
          const d = (((base + k) % 10) + 10) % 10;
          return (
            <span key={k} style={{position: 'absolute', left: 0, right: 0, top: 0, height: `${alto}em`, lineHeight: alto, textAlign: 'center', transform: `translateY(${(k - frac) * alto}em)`}}>
              {d}
            </span>
          );
        })}
      </span>
    </span>
  );
};

/** Una cifra ya escrita («+10.000», «$2,5M», «70») donde cada dígito rueda hasta su valor; lo demás entra de un salto */
export const Cifra: React.FC<{texto: string; t0: number; dur?: number}> = ({texto, t0, dur = 1.15}) => {
  const t = useT();
  const chars = texto.split('');
  const digitos = chars.filter((c) => /\d/.test(c)).length;
  let j = 0;
  const s = sp(t, t0 - 0.05, RESORTES.pop);   // todo aparece justo cuando dices la cifra
  return (
    <>
      {chars.map((ch, i) => {
        if (/\d/.test(ch)) {
          const k = j++;
          const vueltas = digitos <= 1 ? 1 : Math.min(2, Math.round((k / Math.max(1, digitos - 1)) * 2));
          const total = vueltas * 10 + Number(ch);
          const pos = giro(t, t0, dur + k * 0.1, total);
          return (
            <span key={i} style={{display: 'inline-block', opacity: clamp(s * 1.6)}}>
              <Tambor pos={pos} final={ch} vel={pos - giro(t - 1 / 30, t0, dur + k * 0.1, total)} />
            </span>
          );
        }
        return (
          <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: clamp(s * 1.6), transform: `scale(${0.6 + 0.4 * s})`}}>
            {ch}
          </span>
        );
      })}
    </>
  );
};

/* ───────── Letras cinéticas: entran una por una ───────── */
export const Letras: React.FC<{
  texto: string; t0: number; paso?: number; subir?: number; giroX?: number; color?: (palabra: string, i: number) => string | undefined;
}> = ({texto, t0, paso = 1 / 30, subir = 46, giroX = -75, color}) => {
  const t = useT();
  let idx = 0;
  const palabras = String(texto || '').split(' ');
  return (
    <>
      {palabras.map((pal, pi) => (
        <React.Fragment key={pi}>
          <span style={{display: 'inline-block', whiteSpace: 'nowrap', perspective: 600}}>
            {pal.split('').map((ch, ci) => {
              const p = sp(t, t0 + idx++ * paso, RESORTES.letra);
              return (
                <span key={ci} style={{display: 'inline-block', opacity: clamp(p * 1.8), transform: `translateY(${(1 - p) * subir}px) rotateX(${(1 - p) * giroX}deg)`, transformOrigin: '50% 100%', color: color ? color(pal, pi) : undefined}}>
                  {ch}
                </span>
              );
            })}
          </span>
          {pi < palabras.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </>
  );
};

/* ───────── Máquina de escribir (velocidad en letras por cuadro de 30) ───────── */
export const Escribir: React.FC<{texto: string; t0: number; velocidad?: number; cursor?: boolean}> = ({texto, t0, velocidad = 1, cursor = true}) => {
  const t = useT();
  const {pal} = useG();
  const f = (t - t0) * 30;
  const n = clamp(Math.floor(f * velocidad), 0, texto.length);
  const escribiendo = f >= -3 && f < texto.length / velocidad + 7;
  const parpadeo = n < texto.length || Math.floor((t * 30) / 4) % 2 === 0;
  return (
    <span style={{whiteSpace: 'pre'}}>
      <span>{texto.slice(0, n)}</span>
      {cursor && escribiendo && parpadeo ? (
        <span style={{position: 'relative', display: 'inline-block', width: 0}}>
          <span style={{position: 'absolute', left: '0.08em', top: '-0.82em', width: '0.5em', height: '0.95em', background: pal.acento, borderRadius: 3}} />
        </span>
      ) : null}
      <span style={{visibility: 'hidden'}}>{texto.slice(n)}</span>
    </span>
  );
};

/* ───────── Etiqueta pequeña en DM Mono con punto «en vivo» ───────── */
export const Etiqueta: React.FC<{texto: string; t0: number; punto?: boolean; tam?: number}> = ({texto, t0, punto = true, tam = 27}) => {
  const t = useT();
  const {pal} = useG();
  const a = sp(t, t0, RESORTES.pop);
  const latido = 0.5 + 0.5 * Math.sin(((t - t0) * 30) / 4.5);
  if (!texto) return null;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontWeight: 500, fontSize: tam, letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.tinta2, position: 'relative', whiteSpace: 'nowrap'}}>
      {punto ? (
        <span style={{width: 13, height: 13, borderRadius: 99, background: pal.acento, transform: `scale(${a})`, boxShadow: `0 0 0 ${4 + 6 * latido}px ${pal.a(0.28 - 0.2 * latido)}, 0 0 18px ${pal.a(0.8)}`, flex: 'none'}} />
      ) : null}
      <Escribir texto={texto} t0={t0 + 2 / 30} velocidad={1.4} />
    </div>
  );
};

/* ───────── Chispas: estallido con física (velocidad, arrastre, gravedad) + motion blur ───────── */
export const Chispas: React.FC<{t0: number; x: number; y: number; n?: number; semilla: string; fuerza?: number; radio?: number}> = ({
  t0, x, y, n = 24, semilla, fuerza = 950, radio = 520,
}) => {
  const t = useT();
  const fin = t0 + 1.6;
  if (t < t0 - 0.05 || t > fin) return null;
  // sin motion blur de verdad: cada chispa deja una estela (su posición de hace un instante), que se ve igual y pesa casi nada
  return (
    <div style={{position: 'absolute', left: x - radio, top: y - radio, width: radio * 2, height: radio * 2}}>
      <Particulas t0={t0} n={n} semilla={semilla} fuerza={fuerza} radio={radio} />
    </div>
  );
};

const Particulas: React.FC<{t0: number; n: number; semilla: string; fuerza: number; radio: number}> = ({t0, n, semilla, fuerza, radio}) => {
  const tt = useT();
  const {pal} = useG();
  const colores = [pal.tinta, pal.acento, pal.claro, pal.tinta];
  const t = tt - t0;
  if (t < 0) return null;
  return (
    <svg width={radio * 2} height={radio * 2} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: `drop-shadow(0 0 7px ${pal.a(0.7)})`}}>
      {Array.from({length: n}).map((_, i) => {
        const r = (k: string) => random(`${semilla}-${k}-${i}`);
        const ang = r('a') * Math.PI * 2;
        const vel = fuerza * (0.3 + 0.7 * r('v'));
        const arrastre = 3.3;
        const donde = (tt: number) => {
          const k = (1 - Math.exp(-arrastre * tt)) / arrastre;
          return [radio + Math.cos(ang) * vel * k + noise2D(`${semilla}${i}`, tt * 1.6, 0) * 12, radio + Math.sin(ang) * vel * k * 0.9 + 300 * tt * tt];
        };
        const [px, py] = donde(t);
        const [qx, qy] = donde(Math.max(0, t - 0.045));
        const vida = 0.6 + 0.6 * r('l');
        const u = t / vida;
        if (u >= 1) return null;
        const op = interpolate(u, [0, 0.05, 0.55, 1], [0, 1, 0.9, 0]);
        const tam = 12 + 26 * r('s');
        const esc = interpolate(u, [0, 0.1, 1], [0.3, 1, 0.3]);
        const color = colores[Math.floor(r('c') * colores.length)];
        const estela = <line x1={qx} y1={qy} x2={px} y2={py} stroke={color} strokeWidth={Math.max(1, tam * 0.2 * esc)} strokeLinecap="round" opacity={op * 0.55} />;
        if (i % 3 === 0) return <g key={i}>{estela}<circle cx={px} cy={py} r={Math.max(0.1, tam * 0.17 * esc)} fill={color} opacity={op} /></g>;
        const chispa = makeSpark({width: tam, height: tam});
        const rot = (r('r') - 0.5) * 520 * t;
        return <g key={i}>{estela}<path d={chispa.path} fill={color} opacity={op} transform={`translate(${px} ${py}) rotate(${rot}) scale(${esc}) translate(${-tam / 2} ${-tam / 2})`} /></g>;
      })}
    </svg>
  );
};

/* ───────── Barrido de luz ───────── */
export const Brillo: React.FC<{t0: number; w: number; h: number; dur?: number; fuerza?: number}> = ({t0, w, h, dur = 0.93, fuerza = 1}) => {
  const t = useT();
  const p = rampa(t, t0, t0 + dur, EASE.inOut);
  if (p <= 0 || p >= 1) return null;
  const banda = Math.max(220, w * 0.42);
  const x = lerp(-banda - h * 0.4, w + h * 0.4, p);
  return (
    <div style={{position: 'absolute', top: -h, height: h * 3, left: x, width: banda, transform: 'rotate(20deg)', mixBlendMode: 'screen',
      background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${0.07 * fuerza}) 35%, rgba(255,255,255,${0.2 * fuerza}) 50%, rgba(255,255,255,${0.07 * fuerza}) 65%, rgba(255,255,255,0) 100%)`}} />
  );
};

/* ───────── Tarjeta de vidrio con profundidad 3D ─────────
   En el celular la placa desenfoca el video de verdad (backdrop-filter). En el video final no hay video detrás de la capa:
   el ensamblador desenfoca el video debajo de todo lo que tiene la capa (su transparencia hace de máscara). */
type Pose = {transform: string; op: number; e: number; x: number};
export const poseTarjeta = (t: number, entra: number, sale: number, semilla: string): Pose => {
  const e = sp(t, entra, RESORTES.carta);
  const x = rampa(t, sale, sale + 0.43, EASE.sale);
  const fx = noise2D(`${semilla}x`, t * 0.33, 0) * 6;
  const fy = noise2D(`${semilla}y`, 0, t * 0.3) * 7;
  const rx = noise2D(`${semilla}rx`, t * 0.27, 1) * 1.8;
  const ry = noise2D(`${semilla}ry`, 2, t * 0.25) * 2.6;
  const ty = (1 - e) * 170 - x * 160 + fy;
  const rotX = (1 - e) * 50 + rx - x * 28;
  const sc = 0.82 + 0.18 * e - 0.07 * x;
  const op = clamp(e * 1.7) * (1 - x);
  return {transform: `perspective(1700px) translate3d(${fx}px, ${ty}px, 0) rotateX(${rotX}deg) rotateY(${ry}deg) scale(${sc})`, op, e, x};
};

const MARGEN_X = 170;
const MARGEN_Y = 230;

export const Tarjeta: React.FC<{
  x: number; y: number; w: number; h: number | ((t: number) => number); hMax?: number; r?: number; entra: number; sale: number; semilla: string;
  brillos?: number[]; ventanas?: [number, number][]; muestras?: number; children: React.ReactNode;
}> = ({x, y, w, h, hMax, r = 54, entra, sale, semilla, brillos = [], ventanas = [], muestras = 8, children}) => {
  const t = useT();
  const {vista} = useG();
  const pose = poseTarjeta(t, entra, sale, semilla);
  const alto = typeof h === 'function' ? h(t) : h;
  const maximo = hMax ?? (typeof h === 'function' ? 640 : h);
  // el desenfoque de lo de atrás solo sirve en el celular (en la nube no hay video detrás; lo hace el ensamblador)
  const vidrio = vista ? {backdropFilter: 'blur(42px) saturate(1.55) brightness(.82)', WebkitBackdropFilter: 'blur(42px) saturate(1.55) brightness(.82)'} : {};
  if (t < entra - 0.03 || pose.x >= 1) return null;
  const placaOp = clamp(pose.e) ** 2.2 * (1 - pose.x);
  return (
    <>
      <div style={{position: 'absolute', left: x, top: y, width: w, height: alto, borderRadius: r, transform: pose.transform, transformOrigin: '50% 60%', opacity: placaOp, ...vidrio,
        background: 'rgba(10,7,9,.30)', boxShadow: '0 60px 110px -38px rgba(0,0,0,.92), 0 22px 44px -22px rgba(0,0,0,.6)'}} />
      <Desenfoque ventanas={[[entra, entra + 0.6], ...ventanas]} muestras={muestras}
        escenario={{left: x - MARGEN_X, top: y - MARGEN_Y, width: w + MARGEN_X * 2, height: maximo + MARGEN_Y * 2}}>
        <CaraTarjeta w={w} h={h} r={r} entra={entra} sale={sale} semilla={semilla} brillos={brillos}>
          {children}
        </CaraTarjeta>
      </Desenfoque>
    </>
  );
};

const CaraTarjeta: React.FC<{w: number; h: number | ((t: number) => number); r: number; entra: number; sale: number; semilla: string; brillos: number[]; children: React.ReactNode}> = ({
  w, h, r, entra, sale, semilla, brillos, children,
}) => {
  const t = useT();
  const {pal} = useG();
  const pose = poseTarjeta(t, entra, sale, semilla);
  const alto = typeof h === 'function' ? h(t) : h;
  const fondo = `radial-gradient(70% 90% at 100% 118%, ${pal.a(0.17)}, ${pal.a(0)} 62%), radial-gradient(120% 70% at 12% -28%, rgba(255,255,255,.11), rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(42,32,38,.50) 0%, rgba(16,11,14,.64) 100%)`;
  return (
    <div style={{position: 'absolute', left: MARGEN_X, top: MARGEN_Y, width: w, height: alto, transform: pose.transform, transformOrigin: '50% 60%', opacity: pose.op,
      filter: pose.x > 0.02 ? `blur(${(pose.x * 14).toFixed(1)}px)` : undefined}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: r, overflow: 'hidden', background: fondo}}>
        <div style={{position: 'absolute', inset: 0, backgroundImage: GRANO, opacity: 0.07, mixBlendMode: 'overlay'}} />
      </div>
      {children}
      <div style={{position: 'absolute', inset: 0, borderRadius: r, overflow: 'hidden', boxShadow: 'inset 0 2px 0 rgba(255,255,255,.15), inset 0 0 0 1.5px rgba(255,255,255,.10), inset 0 -1px 0 rgba(255,255,255,.04)'}}>
        {brillos.map((b) => <Brillo key={b} t0={b} w={w} h={alto} />)}
      </div>
    </div>
  );
};

/** Cuánto le cabe a una letra: tamaño para que `texto` quepa en `ancho` px (aprox. por número de letras) */
export const tamPara = (texto: string, ancho: number, maximo: number, porLetra = 0.6) =>
  Math.max(maximo * 0.45, Math.min(maximo, ancho / Math.max(1, String(texto).length * porLetra)));

/* La zona donde puede dibujar el mockup, segun la forma (20-sep):
   · encima / abajo → la mitad de arriba (la capa solo mide el 56% del alto)
   · partida        → debajo de la caja donde se encogio tu video
   Devuelve {y0, y1}: de donde a donde hay sitio. */
export const zonaMockup = (forma: string, Hd: number) => {
  if (forma === 'partida') return {y0: Hd * 0.47, y1: Hd * 0.93};
  // (24-sep) pantallas «tu arriba»: tu video ocupa la mitad de arriba entera; la ventana, justo debajo
  if (forma === 'mitad') return {y0: Hd * 0.5, y1: Hd * 0.96};
  // (24-sep) «pantalla arriba, tú abajo»: la mitad de arriba (la barra de Instagram tapa el borde de arriba)
  if (forma === 'mitadAbajo') return {y0: Hd * 0.04, y1: Hd * 0.5};
  // «profundo»: el gráfico va detrás de ti, así que puede bajar más — tu cuerpo lo tapa
  if (forma === 'profundo') return {y0: 0, y1: Hd * 0.62};
  return {y0: 0, y1: Hd * 0.56};
};

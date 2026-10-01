// Placa — pantalla aparte: el video se esconde y queda una lámina con el texto, como un rótulo de diseño.
// Se escogen por separado el fondo (datos.fondo), la letra (datos.letra) y cómo entra el texto (datos.entrada).
// Si datos.escenas trae varias paradas, la lámina se vuelve un lienzo grande y la cámara VIAJA de una a otra
// (izquierda-derecha, arriba-abajo y acercándose o alejándose), dejando lo anterior en su sitio.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {ANTON, ARCHIVO, BEBAS, INTER, MONO, MONTSERRAT, PLAYFAIR, PLAYFAIR_RECTO} from '../tema';
import {EASE, clamp, lerp, rampa, sp, useG, useT} from '../lib/anim';
import {staticFile} from 'remotion';

/* ── los fondos ──
   luz = cuánto se nota la ventana · mezcla = multiply (oscurece) o screen (aclara, para el fondo negro)
   sombra = el color de la sombra que proyecta todo: nunca gris neutro, siempre el tono del fondo */
type Fondo = {base: string; tinta: string; tinta2: string; grano: number; luz: number;
  mezcla: 'multiply' | 'screen'; sombra: string};
const FONDOS: Record<string, (ac: string) => Fondo> = {
  crema:  () => ({base: 'linear-gradient(160deg,#F5F1E9,#E9E3D8)', tinta: '#16100F', tinta2: 'rgba(22,16,15,.55)',
                  grano: 0.10, luz: 1, mezcla: 'multiply', sombra: '52,38,30'}),
  tinta:  () => ({base: 'linear-gradient(160deg,#141013,#080507)', tinta: '#F4ECE7', tinta2: 'rgba(244,236,231,.55)',
                  grano: 0.14, luz: 0.85, mezcla: 'screen', sombra: '0,0,0'}),
  marca:  (ac) => ({base: `linear-gradient(155deg, ${ac}, ${mezclaOscura(ac)})`, tinta: '#FFFFFF', tinta2: 'rgba(255,255,255,.66)',
                  grano: 0.09, luz: 1, mezcla: 'multiply', sombra: '34,6,20'}),
  papel:  () => ({base: 'linear-gradient(150deg,#EFE7D9,#DFD4C2)', tinta: '#1A1310', tinta2: 'rgba(26,19,16,.5)',
                  grano: 0.22, luz: 1, mezcla: 'multiply', sombra: '58,44,32'}),
};
function mezclaOscura(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * 0.45));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const SOMBRA: Record<string, string> = {multiply: '#3E352C', screen: '#B9B6C4'};

/* ── las letras ── */
const LETRAS: Record<string, {f: string; peso: number; esp: string; alto: number}> = {
  gruesa:   {f: MONTSERRAT,      peso: 900, esp: '-0.035em', alto: 1.02},   // la de tus referencias
  seca:     {f: INTER,           peso: 900, esp: '-0.04em',  alto: 1.0},
  alta:     {f: ANTON,           peso: 400, esp: '-0.005em', alto: 1.0},
  bloque:   {f: ARCHIVO,         peso: 400, esp: '-0.03em',  alto: 1.02},
  serif:    {f: PLAYFAIR_RECTO,  peso: 900, esp: '-0.02em',  alto: 1.0},
  condensa: {f: BEBAS,           peso: 400, esp: '0.005em',  alto: 0.94},
};
const ANCHOS: Record<string, number> = {gruesa: 0.68, seca: 0.62, alta: 0.54, bloque: 0.70, serif: 0.60, condensa: 0.47};

/* La sombra de algo que flota sobre la pared con el sol de frente: no es un bulto pegado, es una estela que
   se va hacia abajo-derecha y se deshace. Las primeras van casi juntas (el cuerpo), las últimas son penumbra. */
function estela(c: string, tam: number) {
  // siete pasos, no once: los desenfoques enormes cuestan carísimo de dibujar y el ojo no los distingue
  const pasos: [number, number, number][] = [
    [0.012, 0.014, 0.52], [0.038, 0.05, 0.44], [0.090, 0.11, 0.36],
    [0.170, 0.18, 0.26], [0.290, 0.30, 0.19], [0.460, 0.48, 0.13],
    [0.700, 0.72, 0.085],
  ];
  return pasos.map(([d, b, o]) => {
    const v = Math.max(1, Math.round(d * tam));
    return `${v}px ${v}px ${Math.max(2, Math.round(b * tam))}px rgba(${c},${o})`;
  }).join(', ');
}

/* ── cómo entra cada línea ── */
function entrada(modo: string, t: number, t0: number, t1: number) {
  const fuera = rampa(t, t1 - 0.55, t1 - 0.12, EASE.sale);
  let op = 0, dx = 0, dy = 0, s = 1, blur = 0;
  if (modo === 'golpe') {
    const k = sp(t, t0, {damping: 13, stiffness: 190, mass: 0.8});
    op = clamp(k * 2.2); s = 0.82 + 0.18 * k; dy = (1 - k) * 14;
  } else if (modo === 'suave') {
    const k = rampa(t, t0, t0 + 0.75, EASE.llega);
    op = k; s = 0.985 + 0.015 * k;
  } else if (modo === 'rebote') {
    const k = sp(t, t0, {damping: 11, stiffness: 120, mass: 0.9});
    op = clamp(k * 2.4); s = 1.55 - 0.55 * k; blur = (1 - clamp(k * 1.3)) * 26;
  } else {
    const k = sp(t, t0, {damping: 16, stiffness: 95, mass: 1});
    op = clamp(k * 1.9); dx = (1 - k) * 150; blur = (1 - clamp(k * 1.15)) * 34;
  }
  return {op: op * (1 - fuera), dx: dx + fuera * -26, dy, s: s * (1 - fuera * 0.04), blur: blur + fuera * 22};
}

/* ── por dónde pasa la cámara ── */
const PASO = 940;
const DESVIO = [0, 185, -155, 205, -125, 150];      // cuánto sube o baja en cada parada
const CERCA = [1, 1.08, 0.93, 1.11, 0.96, 1.05];    // y cuánto se acerca o se aleja
const VIAJE = 0.8;                                   // lo que tarda en ir de una parada a la otra
const donde = (i: number) => ({x: i * PASO, y: DESVIO[i % DESVIO.length], z: CERCA[i % CERCA.length]});

type Escena = {etiqueta?: string; arriba?: string; titulo?: string; abajo?: string; objeto?: string; ladoObjeto?: string};

export const Placa: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const f = (FONDOS[String(d.fondo || 'crema')] || FONDOS.crema)(pal.acento);
  const L = LETRAS[String(d.letra || 'gruesa')] || LETRAS.gruesa;
  const an = ANCHOS[String(d.letra || 'gruesa')] || 0.68;
  const modo = String(d.entrada || 'desenfoque');
  const tm: number[] = p.marcas || [];
  const t1 = p.t1;
  const abre = rampa(t, p.t0, p.t0 + 0.3, EASE.llega);
  const cierra = rampa(t, t1 - 0.35, t1 - 0.02, EASE.sale);

  // una parada o varias
  const escenas: Escena[] = (d.escenas && d.escenas.length ? d.escenas : [{
    etiqueta: d.etiqueta, arriba: d.arriba, titulo: d.titulo, abajo: d.abajo, objeto: d.objeto,
  }]) as Escena[];
  const llega = escenas.map((_, i) => (tm[i] != null ? tm[i] : p.t0 + 0.4 + i * 2.6));

  /* la cámara: quieta en una parada y viajando a la siguiente, con un vaivén para que respire */
  let i = 0;
  for (let j = 0; j < llega.length; j++) if (t >= llega[j] - VIAJE) i = j;
  const a = donde(Math.max(0, i - 1)), b = donde(i);
  const k = i === 0 ? 1 : clamp(rampa(t, llega[i] - VIAJE, llega[i], EASE.llega));
  const vaiven = Math.sin(Math.PI * k);
  const camX = lerp(a.x, b.x, k) + noise2D('cam-x', t * 0.16, 0) * 16;
  const camY = lerp(a.y, b.y, k) + noise2D('cam-y', 0, t * 0.14) * 13;
  const camZ = lerp(a.z, b.z, k) * (1 - 0.13 * vaiven);            // se aleja al pasar y vuelve a acercarse
  const giro = noise2D('cam-g', t * 0.1, 3) * 0.5 - vaiven * 0.7;
  const anchoLienzo = (escenas.length - 1) * PASO + 2600;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, overflow: 'hidden',
      opacity: abre * (1 - cierra)}}>
      {/* el papel con su luz y su grano: dibujado una vez y quieto, como la pared que es */}
      <img src={staticFile(`fondos/${String(d.fondo || 'crema')}-${String(d.colorObjeto || 'cherry')}.jpg`)} alt=""
        style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd}} />

      {/* el texto y los objetos viajan con la cámara */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1, height: 1, transformOrigin: '0 0',
        transform: `translate(540px, ${Hd / 2}px) scale(${camZ.toFixed(4)}) rotate(${giro.toFixed(2)}deg) translate(${(-camX).toFixed(1)}px, ${(-camY).toFixed(1)}px)`}}>
        {/* las paradas: cada una se queda en su sitio cuando la cámara sigue de largo */}
        {escenas.map((e, n) => {
          const pos = donde(n);
          const t0 = llega[n] - 0.25;
          const tFin = t1;
          const eEti = entrada(modo, t, t0 + 0.10, tFin);
          const eArr = entrada(modo, t, t0 + 0.22, tFin);
          const eTit = entrada(modo, t, t0 + 0.38, tFin);
          const eAba = entrada(modo, t, t0 + 0.62, tFin);
          const titulo = String(e.titulo || '');
          const tam = Math.round(Math.min(230, 900 / Math.max(2.2, titulo.length * an)));
          const capa = (x: ReturnType<typeof entrada>): React.CSSProperties => ({
            opacity: x.op, transform: `translate(${x.dx.toFixed(1)}px, ${x.dy.toFixed(1)}px) scale(${x.s.toFixed(3)})`,
            filter: x.blur > 0.4 ? `blur(${x.blur.toFixed(1)}px)` : undefined,
          });
          const kObj = sp(t, t0, {damping: 14, stiffness: 110, mass: 0.95});
          const flota = noise2D('obj' + n, t * 0.35, n) * 9;
          if (t < t0 - 0.7) return null;
          return (
            <div key={n} style={{position: 'absolute', left: pos.x - 540, top: pos.y - Hd / 2, width: 1080, height: Hd}}>
              <div style={{position: 'absolute', left: 84, right: 84, top: 0, bottom: 0, display: 'flex',
                flexDirection: 'column', justifyContent: 'center'}}>
                {e.objeto ? (
                  <img src={staticFile(`objetos/${e.objeto}-${String(d.colorObjeto || 'cherry')}-${String(d.fondo) === 'tinta' ? 'oscuro' : 'claro'}.png`)} alt=""
                    style={{alignSelf: e.ladoObjeto === 'izquierda' ? 'flex-start' : 'flex-end', width: 620, height: 620,
                      marginBottom: -170, marginTop: -140,
                      marginRight: e.ladoObjeto === 'izquierda' ? 0 : -60, marginLeft: e.ladoObjeto === 'izquierda' ? -60 : 0,
                      opacity: clamp(kObj * 1.6),
                      transform: `translateY(${((1 - kObj) * 40 + flota).toFixed(1)}px) scale(${(0.8 + 0.2 * kObj).toFixed(3)})`}} />
                ) : null}
                {e.etiqueta ? (
                  <div style={{alignSelf: 'flex-start', marginBottom: 26, padding: '7px 15px', borderRadius: 8,
                    background: pal.acento, color: pal.sobre, fontFamily: MONO, fontWeight: 500, fontSize: 21,
                    letterSpacing: '0.16em', textTransform: 'uppercase', ...capa(eEti)}}>
                    {String(e.etiqueta)}
                  </div>
                ) : null}
                {e.arriba ? (
                  <div style={{fontFamily: L.f, fontWeight: L.peso, fontSize: Math.round(tam * 0.42), lineHeight: 1.02,
                    letterSpacing: L.esp, color: f.tinta, marginBottom: 4,
                    textShadow: estela(f.sombra, Math.round(tam * 0.42)), ...capa(eArr)}}>
                    {String(e.arriba)}
                  </div>
                ) : null}
                {titulo ? (
                  <div style={{fontFamily: L.f, fontWeight: L.peso, fontSize: tam, lineHeight: L.alto, letterSpacing: L.esp,
                    color: f.tinta, textShadow: estela(f.sombra, tam), ...capa(eTit)}}>
                    {titulo}
                  </div>
                ) : null}
                {e.abajo ? (
                  <div style={{fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 700, fontSize: Math.round(tam * 0.34),
                    lineHeight: 1.12, marginTop: 14, color: f.tinta2,
                    textShadow: estela(f.sombra, Math.round(tam * 0.34)), ...capa(eAba)}}>
                    {String(e.abajo)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* el grano va pegado a la cámara, como el de una película */}
      <svg width={1080} height={Hd} style={{position: 'absolute', inset: 0, opacity: f.grano, mixBlendMode: 'overlay'}}>
        <defs>
          <filter id="pl-grano">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#pl-grano)" />
      </svg>
    </div>
  );
};

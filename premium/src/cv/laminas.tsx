// (30-oct-2026) Cámara viva v4 — LA LÁMINA, una sola. Sergio, 29-oct: «Fondo con sombras + Objeto (imagen, clip o gráfico)
// + títulos y subtítulos con sombras y animaciones de entrada y salida + movimientos de cámara. Esa es la esencia de Cámara
// viva, no más… menos es más». Referencias: su reel del Día 4 y el de kayn.marketing (fondo plano con una sombra grande
// desenfocada, una línea chica y una gruesa que entran palabra por palabra, y UN objeto con sombra suave).
//   · fondo: un color plano (crema, o el que escoja la persona) con la sombra de la persiana;
//   · objeto (uno solo):
//       imagen  — un recorte sin fondo que sube a su sitio con sombra de sol y su sombra en el piso;
//       clip    — TU video, más pequeño, en un rectángulo de esquinas redondas con sombra (el video va en el hueco);
//       grafico — una tarjeta blanca: un contador, barras, un comentario que se escribe solo o el botón de seguir;
//   · texto: una línea chica y una gruesa (kit › Rotulo);
//   · cámara: entra cerca y se asienta (nunca quieta); el fondo se mueve menos que el objeto (profundidad) y en la palabra
//     que nombra el objeto, zoom inmediato.
// Cada lámina recibe el momento del plan (m) y su material (mat: el recorte, que es de EJEMPLO mientras la persona no ponga
// el suyo). Todo en el cuadro de 1080 × 1920; t = segundo del video.
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {EstiloTexto, camLamina, Cam, Capa, FondoPlano, Rotulo, esOscuro, sombraDe, sombraCaja, Palabras, urb, R, clamp, lerp, outCubic, p} from './kit';

export type Objeto = {tipo: 'imagen' | 'clip' | 'grafico'; grafico?: 'contador' | 'barras' | 'comentario' | 'seguir'; hasta?: number; unidad?: string;
  barras?: {k: string; v: number}[]; sufijo?: string; texto?: string; cuenta?: string; seguidores?: number; es?: string; ve?: string};
export type Momento = {plantilla: string; t0: number; t1: number; fondo?: string | null; texto: {chica?: string; gruesa?: string; rojas?: string[]};
  objeto: Objeto; zoomT?: number | null; tiempos: {chica: number; gruesa: number}; semilla?: number;
  orden?: number;     // (29-oct) el n.º de la lámina en el video: le toca la entrada ENTRADAS[orden % 5]
  estiloTexto?: EstiloTexto | null;   // (30-oct) la letra y los colores de una plantilla de subtítulos
  clip?: boolean};    // va tu video en el recuadro (lo pone la plantilla con usaClip): movimientos más suaves, sin zoom
export type Material = {objeto?: string; foto?: string; ejemplo?: boolean};
type P = {t: number; m: Momento; mat: Material};
export type Rect = {left: number; top: number; width: number; height: number; radio: number; rot: number};

const lado = (m: Momento) => ((m.semilla || 0) % 2 ? 1 : -1);
const CENTRO = {x: 540, y: 1120};                       // el centro del objeto (debajo del rótulo, encima de la zona que tapa Instagram)
const TEXTO_TOP = 300, TEXTO_TOP_GRAFICO = 470, TARJETA_TOP = 710;

/* ── LAS ENTRADAS (29-oct). Sergio: «hace un par de movimientos y repite el mismo ciclo». Cada lámina entra con una de
   cinco, por turno (dos seguidas nunca iguales):
     sube   — el objeto sube a su sitio y la cámara se asienta corrida a un lado (la de siempre)
     barre  — el objeto entra de lado y la cámara lo sigue
     aleja  — arranca muy cerca del objeto y la cámara se abre (lo revela)
     cae    — el objeto baja desde arriba
     acerca — la cámara entra despacio durante toda la lámina
   Con tu video en el recuadro todo va más suave y sin zoom inmediato (lo agrandaba casi a pantalla completa); la tarjeta de
   un gráfico es ancha: también más suave. Los mismos números dibujan y ubican tu video en el hueco (clipVideo). ── */
type Entrada = 'sube' | 'barre' | 'aleja' | 'cae' | 'acerca';
const ENTRADAS: Entrada[] = ['sube', 'barre', 'aleja', 'cae', 'acerca'];
const entradaDe = (m: Momento): Entrada => ENTRADAS[(m.orden ?? m.semilla ?? 0) % ENTRADAS.length];
const fuerza = (m: Momento) => (m.clip ? 0.55 : m.objeto?.tipo === 'grafico' ? 0.5 : 1);
const camDe = (t: number, m: Momento): Cam => {
  const e = entradaDe(m), l = lado(m), f = fuerza(m), z = (a: number) => 1 + (a - 1) * f;
  if (e === 'acerca') {
    const k = Math.sin((clamp((t - m.t0) / Math.max(0.5, m.t1 - m.t0)) * Math.PI) / 2);
    return {z: lerp(1, z(1.08), k), x: 0, y: lerp(0, -24 * f, k)};
  }
  if (e === 'aleja') return camLamina(t, m.t0, m.t1, [z(1.5), 1.0], [0, 0], [-40 * f, 0], 0.8);
  if (e === 'barre') return camLamina(t, m.t0, m.t1, [z(1.12), 1.0], [120 * l * f, 0], [0, 0], 0.8);
  if (e === 'cae') return camLamina(t, m.t0, m.t1, [z(1.15), 1.0], [-30 * l * f, 0], [-60 * f, 0], 0.9);
  return camLamina(t, m.t0, m.t1, [z(1.2), 1.0], [46 * l * f, 0], [70 * f, 0], 0.9);     // sube
};
// el zoom inmediato en la palabra que nombra el objeto: no con tu video (crecía de más); con la tarjeta de un gráfico, y
// cuando la cámara ya viene entrando («acerca»), menos (sumados lo agrandaban de más)
const zoomDe = (t: number, m: Momento) => (m.zoomT != null && t >= m.zoomT && !m.clip
  ? (m.objeto?.tipo === 'grafico' ? 1.1 : entradaDe(m) === 'acerca' ? 1.14 : 1.22) * (1 + 0.03 * clamp((t - m.zoomT) / 1.5)) : 1);
const entraDe = (t: number, m: Momento) => outCubic(p(t, m.t0, 0.55));   // 0 → 1: el objeto llega a su sitio (con desenfoque)
// dónde va el objeto mientras llega: corrido (dx, dy) y de qué tamaño (s, desde su centro OBJ_Y)
const OBJ_Y = 1080;
const objetoDe = (t: number, m: Momento) => {
  const e = entradaDe(m), u = 1 - entraDe(t, m), l = lado(m);
  if (e === 'barre') return {dx: 260 * l * u, dy: 0, s: 1};
  if (e === 'cae') return {dx: 0, dy: -120 * u, s: 1};
  if (e === 'acerca') return {dx: 0, dy: 0, s: 1 - 0.08 * u};
  if (e === 'aleja') return {dx: 0, dy: 0, s: 1 + 0.06 * u};
  return {dx: 0, dy: 140 * u, s: 1};                                                     // sube
};
/* el objeto crece desde su borde de arriba (hacia abajo y a los lados): ni la cámara ni el zoom lo montan sobre el rótulo */
const origenY = (m: Momento) => (m.objeto?.tipo === 'grafico' ? TARJETA_TOP : 550);
const Encuadre: React.FC<{t: number; m: Momento; children: React.ReactNode}> = ({t, m, children}) => {
  const cam = camDe(t, m), o = objetoDe(t, m), k = cam.z * zoomDe(t, m);
  return (
    <AbsoluteFill style={{transformOrigin: `540px ${origenY(m)}px`, transform: `translate(${cam.x}px,${cam.y}px) scale(${k})`}}>
      <AbsoluteFill style={{transformOrigin: `540px ${OBJ_Y}px`, transform: `translate(${o.dx}px,${o.dy}px) scale(${o.s})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
/* el fondo va detrás y se mueve menos (profundidad) */
const Fondo: React.FC<{t: number; m: Momento}> = ({t, m}) => (
  <Capa cam={camDe(t, m)} prof={0.35} extra={0.04}><FondoPlano t={t - m.t0} color={m.fondo} lado={lado(m)} /></Capa>
);
const esGrafico = (m: Momento, mat: Material) => m.objeto?.tipo === 'grafico' && !usaClip(m, mat);
const Texto: React.FC<{t: number; m: Momento; mat: Material}> = ({t, m, mat}) => (
  <Rotulo t={t} t1={m.t1} chica={m.texto.chica} gruesa={m.texto.gruesa} rojas={m.texto.rojas} a={m.tiempos} oscuro={esOscuro(m.fondo)} estilo={m.estiloTexto}
    top={esGrafico(m, mat) ? TEXTO_TOP_GRAFICO : TEXTO_TOP} />
);
const desenfoqueEntrada = (t: number, m: Momento): React.CSSProperties => {
  const e = entraDe(t, m);
  return {opacity: clamp(e * 1.6), filter: e < 1 ? `blur(${(1 - e) * 14}px)` : undefined};
};

/* ── IMAGEN: el recorte sube a su sitio, con sombra de sol y su sombra en el piso; flota apenas (nunca se tuerce) ── */
const Imagen: React.FC<P> = ({t, m, mat}) => {
  const osc = esOscuro(m.fondo);
  return (
    <div style={{position: 'absolute', inset: 0, ...desenfoqueEntrada(t, m)}}>
      <Img src={mat.objeto!} style={{position: 'absolute', left: 110, top: 540, width: 860, height: 1120, objectFit: 'contain', objectPosition: '50% 45%',
        filter: sombraDe(osc), transform: `translateY(${Math.sin((t - m.t0) * 1.1) * 7}px)`}} />
    </div>
  );
};

/* ── CLIP: tu video en un rectángulo de esquinas redondas. Debajo (fondo) va su sombra; tu video se pone en el hueco ── */
const CLIP = {x: 150, y: 560, w: 780, h: 1040, r: 52};
const ClipSombra: React.FC<{t: number; m: Momento}> = ({t, m}) => (
  <div style={{position: 'absolute', left: CLIP.x, top: CLIP.y, width: CLIP.w, height: CLIP.h, borderRadius: CLIP.r, background: esOscuro(m.fondo) ? '#000' : '#2a2420', boxShadow: sombraCaja(esOscuro(m.fondo))}} />
);
const clipVideo = (t: number, m: Momento): Rect => {
  // el rectángulo después de su entrada (corrido y de su tamaño, desde OBJ_Y), de la cámara de la lámina y del zoom
  // inmediato: el mismo orden que Encuadre
  const cam = camDe(t, m), o = objetoDe(t, m), k = cam.z * zoomDe(t, m), oy = origenY(m);
  const x0 = 540 + (CLIP.x + CLIP.w / 2 - 540) * o.s + o.dx, y0 = OBJ_Y + (CLIP.y + CLIP.h / 2 - OBJ_Y) * o.s + o.dy;
  const cx = 540 + (x0 - 540) * k + cam.x, cy = oy + (y0 - oy) * k + cam.y, s = k * o.s;
  return {left: cx - (CLIP.w * s) / 2, top: cy - (CLIP.h * s) / 2, width: CLIP.w * s, height: CLIP.h * s, radio: CLIP.r * s, rot: 0};
};

/* ── GRÁFICOS: una tarjeta blanca con sombra, centrada; lo de adentro se anima en el segundo en que lo dices ── */
const TINTA = R.tinta, GRIS = '#8a8079', AZUL = '#0095F6';
const Tarjeta: React.FC<{t: number; m: Momento; ancho?: number; children: React.ReactNode}> = ({t, m, ancho = 900, children}) => (
  <div style={{position: 'absolute', left: CENTRO.x - ancho / 2, top: TARJETA_TOP, width: ancho, ...desenfoqueEntrada(t, m)}}>
    <div style={{width: '100%', boxSizing: 'border-box', padding: '64px 66px', borderRadius: 48, background: '#fff', boxShadow: sombraCaja(esOscuro(m.fondo)), fontFamily: urb, color: TINTA}}>{children}</div>
  </div>
);
/* íconos de línea (nunca emojis) */
const Icono: React.FC<{n: string; tam?: number; color?: string; grosor?: number}> = ({n, tam = 44, color = '#fff', grosor = 2.4}) => {
  const d: Record<string, React.ReactNode> = {
    persona: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
    ojo: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    corazon: <path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.3 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.7 0 5.8 3.9 4.5 7.2C19.5 16.4 12 21 12 21z" />,
    moneda: <><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.6-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.5 5.8 4.3 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.5-3-1.4M12 6v1.8M12 16.3V18" /></>,
    sube: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    check: <path d="M4 12.5l5 5L20 6.5" />,
  };
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round">{d[n] || d.sube}</svg>;
};
const iconoDe = (unidad = '') => /seguidor|persona|cliente|gente|usuario/i.test(unidad) ? 'persona' : /vista|reproduc|visual/i.test(unidad) ? 'ojo'
  : /like|me gusta|corazon|corazón/i.test(unidad) ? 'corazon' : /peso|dólar|dolar|plata|dinero|venta|\$|usd|cop/i.test(unidad) ? 'moneda' : 'sube';
const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');

/* el contador: la cifra sube durante la frase y LLEGA a su número cuando lo dices (la gruesa); termina SIEMPRE antes del
   corte (al menos 0,6 s quieta para leerla); la barra se llena con ella */
const Contador: React.FC<P> = ({t, m}) => {
  const o = m.objeto, hasta = Number(o.hasta) || 0, a = m.t0 + 0.3;
  const fin = clamp(Math.max((m.tiempos.gruesa || 0) + 0.35, a + 0.6), a + 0.6, Math.max(a + 0.6, m.t1 - 0.6));
  const x = p(t, a, fin - a), k = fin - a > 1.6 ? Math.sin((x * Math.PI) / 2) : outCubic(x);
  const txt = fmt(hasta), tam = txt.length > 9 ? 150 : txt.length > 7 ? 176 : 210;
  return (
    <Tarjeta t={t} m={m}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <div style={{width: 100, height: 100, borderRadius: 30, display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#c3202f,#9B111E 60%,#7a0c17)', boxShadow: '0 12px 24px rgba(155,17,30,.35)'}}>
          <Icono n={iconoDe(o.unidad)} tam={56} /></div>
        {o.unidad && <div style={{fontWeight: 600, fontSize: 52, color: GRIS}}>{o.unidad}</div>}
      </div>
      <div style={{position: 'relative', marginTop: 30, fontWeight: 800, fontSize: tam, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums'}}>
        <span style={{visibility: 'hidden'}}>{txt}</span>
        <span style={{position: 'absolute', left: 0, top: 0, filter: k < 1 ? `blur(${(1 - k) * 3}px)` : undefined}}>{fmt(hasta * k)}</span>
      </div>
      <div style={{marginTop: 38, height: 22, borderRadius: 11, background: 'rgba(22,18,15,.08)', overflow: 'hidden'}}>
        <div style={{width: `${k * 100}%`, height: '100%', borderRadius: 11, background: 'linear-gradient(90deg,#9B111E,#e0394a)'}} />
      </div>
    </Tarjeta>
  );
};

const Barras: React.FC<P> = ({t, m}) => {
  const bs = (m.objeto.barras || []).slice(0, 4), max = Math.max(1, ...bs.map((b) => Number(b.v) || 0)), a = m.t0 + 0.35, suf = m.objeto.sufijo || '';
  return (
    <Tarjeta t={t} m={m}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 40}}>
        {bs.map((b, i) => {
          const v = Number(b.v) || 0, k = outCubic(p(t, a + i * 0.2, 0.9)), top = v === max;
          return (
            <div key={i}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 46}}>
                <span style={{fontWeight: 600, color: top ? TINTA : GRIS}}>{b.k}</span>
                <span style={{fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: top ? R.rubi : TINTA}}>{fmt(v * k)}{suf}</span>
              </div>
              <div style={{marginTop: 16, height: 36, borderRadius: 18, background: 'rgba(22,18,15,.07)', overflow: 'hidden'}}>
                <div style={{width: `${(v / max) * k * 100}%`, height: '100%', borderRadius: 18, background: top ? 'linear-gradient(90deg,#9B111E,#e0394a)' : '#cdc3b6'}} />
              </div>
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
};

/* la foto de la cuenta: la tuya (un cuadro de tu video) o un círculo con la inicial */
const Avatar: React.FC<{tam: number; foto?: string; cuenta: string; anillo?: boolean}> = ({tam, foto, cuenta, anillo}) => (
  <div style={{width: tam, height: tam, borderRadius: '50%', padding: anillo ? 5 : 0, background: anillo ? 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' : undefined, boxSizing: 'border-box', flex: 'none'}}>
    <div style={{width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: anillo ? '4px solid #fff' : undefined, boxSizing: 'border-box', background: '#d9cfc2',
      display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: tam * 0.4, color: '#fff'}}>
      {foto ? <Img src={foto} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%'}} /> : (cuenta[0] || 'c').toUpperCase()}
    </div>
  </div>
);

const Comentario: React.FC<P> = ({t, m, mat}) => {
  const texto = m.objeto.texto || 'me encantó', cuenta = m.objeto.cuenta || 'tu_cuenta';
  const a = m.t0 + 0.55, vel = 20, n = Math.max(0, Math.min(texto.length, Math.floor((t - a) * vel))), fin = a + texto.length / vel, pub = t > fin + 0.35;
  const e = outCubic(p(t, fin + 0.35, 0.45));
  return (
    <Tarjeta t={t} m={m}>
      <div style={{width: 90, height: 9, borderRadius: 5, background: 'rgba(22,18,15,.15)', margin: '-22px auto 22px'}} />
      <div style={{textAlign: 'center', fontWeight: 800, fontSize: 36}}>Comentarios</div>
      <div style={{height: 1.5, background: 'rgba(22,18,15,.1)', margin: '26px -60px 30px'}} />
      <div style={{minHeight: 150}}>
        {pub && (
          <div style={{display: 'flex', gap: 22, alignItems: 'flex-start', opacity: clamp(e * 1.5), filter: e < 1 ? `blur(${(1 - e) * 12}px)` : undefined, transform: `translateY(${(1 - e) * 40}px)`}}>
            <Avatar tam={78} foto={mat.foto} cuenta={cuenta} />
            <div style={{flex: 1}}>
              <div style={{fontSize: 30}}><span style={{fontWeight: 800}}>{cuenta}</span> <span style={{fontWeight: 600, color: GRIS}}>ahora</span></div>
              <div style={{marginTop: 6, fontWeight: 600, fontSize: 40, lineHeight: 1.2}}>{texto}</div>
            </div>
            <div style={{paddingTop: 18}}><Icono n="corazon" tam={40} color={GRIS} grosor={2} /></div>
          </div>
        )}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 26}}>
        <Avatar tam={70} foto={mat.foto} cuenta={cuenta} />
        <div style={{flex: 1, display: 'flex', alignItems: 'center', minHeight: 80, padding: '0 26px', borderRadius: 40, border: '2px solid rgba(22,18,15,.14)', fontWeight: 600, fontSize: 34,
          color: n && !pub ? TINTA : 'rgba(22,18,15,.4)', whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {!pub && n > 0 ? texto.slice(0, n) : 'Agrega un comentario…'}{!pub && n > 0 && Math.floor(t * 3) % 2 === 0 ? '|' : ''}
        </div>
        <div style={{fontWeight: 800, fontSize: 34, color: AZUL, opacity: n && !pub ? 1 : 0.35}}>Publicar</div>
      </div>
    </Tarjeta>
  );
};

/* el puntero que llega y toca (dibujado, no un emoji) */
const Puntero: React.FC<{x: number; y: number; toca: number}> = ({x, y, toca}) => (
  <svg width={74} height={74} viewBox="0 0 24 24" style={{position: 'absolute', left: x, top: y, transform: `scale(${1 - 0.14 * toca})`, transformOrigin: '20% 15%', filter: 'drop-shadow(4px 8px 8px rgba(0,0,0,.3))'}}>
    <path d="M5 2.5l13.5 11.2-6.3.7 3.6 6.9-2.6 1.3-3.6-6.9L5 20.2z" fill="#fff" stroke={TINTA} strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);
const Seguir: React.FC<P> = ({t, m, mat}) => {
  const cuenta = m.objeto.cuenta || 'tu_cuenta', base = Number(m.objeto.seguidores) || 12400;
  const llega = outCubic(p(t, m.t0 + 0.45, 0.6)), clic = m.t0 + 1.1, toca = clamp(1 - Math.abs(t - clic) / 0.12), sigue = t >= clic;
  const pulso = sigue ? 1 + 0.05 * Math.sin(clamp((t - clic) / 0.3) * Math.PI) : 1;
  return (
    <Tarjeta t={t} m={m}>
      <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
        <Avatar tam={170} foto={mat.foto} cuenta={cuenta} anillo />
        <div style={{flex: 1, display: 'flex', justifyContent: 'space-between', textAlign: 'center'}}>
          {[['publicaciones', 128], ['seguidores', base + (sigue ? 1 : 0)], ['seguidos', 312]].map(([k, v], i) => (
            <div key={i}><div style={{fontWeight: 800, fontSize: 46, fontVariantNumeric: 'tabular-nums', color: i === 1 && sigue ? R.rubi : TINTA}}>{fmt(v as number)}</div>
              <div style={{fontWeight: 600, fontSize: 28, color: GRIS, marginTop: 4}}>{k}</div></div>
          ))}
        </div>
      </div>
      <div style={{marginTop: 30, fontWeight: 800, fontSize: 40}}>{cuenta}</div>
      <div style={{position: 'relative', marginTop: 34}}>
        <div style={{height: 92, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontWeight: 800, fontSize: 38,
          background: sigue ? '#efefef' : AZUL, color: sigue ? TINTA : '#fff', transform: `scale(${pulso * (1 - 0.03 * toca)})`}}>
          {sigue && <Icono n="check" tam={40} color={TINTA} grosor={2.8} />}{sigue ? 'Siguiendo' : 'Seguir'}
        </div>
        <Puntero x={lerp(620, 380, llega) + (t > clic ? (t - clic) * 60 : 0)} y={lerp(260, 30, llega) + (t > clic ? (t - clic) * 40 : 0)} toca={toca} />
      </div>
    </Tarjeta>
  );
};
const GRAFICOS: Record<string, React.FC<P>> = {contador: Contador, barras: Barras, comentario: Comentario, seguir: Seguir};

/* ── LA LÁMINA: qué objeto lleva y dónde va tu video ── */
const usaClip = (m: Momento, mat: Material) => m.objeto?.tipo === 'clip' || (m.objeto?.tipo === 'imagen' && !mat.objeto) || (m.objeto?.tipo === 'grafico' && !GRAFICOS[m.objeto.grafico || '']);
const conClip = (m: Momento, mat: Material): Momento => (m.clip === usaClip(m, mat) ? m : {...m, clip: usaClip(m, mat)});
const LaminaFrente: React.FC<P> = (pr0) => {
  const pr = {...pr0, m: conClip(pr0.m, pr0.mat)}, {t, m, mat} = pr;
  if (m.clip) return <AbsoluteFill><Texto t={t} m={m} mat={mat} /></AbsoluteFill>;   // tu video va debajo, en el hueco
  const G = m.objeto.tipo === 'grafico' ? GRAFICOS[m.objeto.grafico || ''] : null;
  return (
    <AbsoluteFill>
      <Fondo t={t} m={m} />
      <Encuadre t={t} m={m}>{G ? <G {...pr} /> : <Imagen {...pr} />}</Encuadre>
      <Texto t={t} m={m} mat={mat} />
    </AbsoluteFill>
  );
};
const LaminaFondo: React.FC<P> = ({t, m: m0, mat}) => {
  const m = conClip(m0, mat);
  return (
    <AbsoluteFill>
      <Fondo t={t} m={m} />
      <Encuadre t={t} m={m}><ClipSombra t={t} m={m} /></Encuadre>
    </AbsoluteFill>
  );
};

/* ── el registro: lo que se dibuja ENCIMA de tu video (frente), DEBAJO (fondo) y dónde va tu video ──
   video: null = tu video no se ve (la lámina lo tapa todo) · 'camara' = sigue con su cámara · Rect = en ese hueco */
type Plantilla = {frente: React.FC<P>; fondo?: React.FC<P>; video: (t: number, m: Momento, mat: Material) => null | 'camara' | Rect};
export const PLANTILLAS: Record<string, Plantilla> = {
  lamina: {frente: LaminaFrente, fondo: LaminaFondo, video: (t, m, mat) => (usaClip(m, mat) ? clipVideo(t, conClip(m, mat)) : null)},
};
export const tieneFondo = (m: Momento, mat: Material) => !!PLANTILLAS[m.plantilla]?.fondo && PLANTILLAS[m.plantilla].video(m.t0, m, mat) !== null;

// (30-oct-2026) Cámara viva — LOS GRÁFICOS de las láminas (los 20 que aprobó Sergio, propuesta del 30-oct). Sergio: «esos gráficos
// siempre van a ser los mismos, lo único que cambia es el estilo». Aquí solo está QUÉ se mueve y cuándo; los colores y la tarjeta
// salen del tema (tema.ts). Lo de adentro se anima en el segundo en que lo dices y termina SIEMPRE antes del corte: reloj() aprieta
// la animación si la lámina es corta. Nunca se inventan cifras: los datos vienen del plan (lo que dijo la persona).
// Todo en el cuadro de 1080 × 1920; t = segundo del video.
import React from 'react';
import {Img} from 'remotion';
import {esOscuro, urb, clamp, lerp, outCubic, p} from './kit';
import {temaCamaraViva, TemaG} from './tema';
import type {Momento, Material} from './laminas';

export type PG = {t: number; m: Momento; mat: Material};
export const TARJETA_TOP = 710;
export const PASO = 0.55;       // lo que tarda la cámara en pasar de una lámina a la siguiente (medido en la referencia de kayn)
const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
const num = (v: unknown, siNo = 0) => { const x = Number(v); return isFinite(x) ? x : siNo; };
const lista = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x ?? '').trim()).filter(Boolean);
export const temaDe = (m: Momento): TemaG => temaCamaraViva(m.acento, esOscuro(m.fondo));

/* el reloj del gráfico: 0 cuando la lámina ya llegó; si la lámina dura menos de lo que pide la animación, va más rápido */
const reloj = (t: number, m: Momento, nominal: number) => {
  const a = m.t0 + (m.paso ? PASO * 0.7 : 0), d = m.t1 - a;
  return (t - a) / clamp((d - 0.45) / nominal, 0.25, 1);
};
export const entraDe = (t: number, m: Momento) => (m.paso ? 1 : outCubic(p(t, m.t0, 0.55)));   // 0 → 1: el objeto llega a su sitio
export const desenfoqueEntrada = (t: number, m: Momento): React.CSSProperties => {
  const e = entraDe(t, m);
  return {opacity: clamp(e * 1.6), filter: e < 1 ? `blur(${(1 - e) * 14}px)` : undefined};
};
const borroso = (e: number, b = 12) => (e < 1 ? `blur(${(1 - e) * b}px)` : undefined);
const entra = (u: number, a: number, d = 0.45, y = 36): React.CSSProperties => {
  const e = outCubic(p(u, a, d));
  return {opacity: clamp(e * 1.6), filter: borroso(e), transform: `translateY(${(1 - e) * y}px)`};
};

/* ── las piezas comunes ── */
const Tarjeta: React.FC<{t: number; m: Momento; pad?: string; children: React.ReactNode}> = ({t, m, pad = '64px 66px', children}) => {
  const G = temaDe(m);
  return (
    <div style={{position: 'absolute', left: 90, top: TARJETA_TOP, width: 900, ...desenfoqueEntrada(t, m)}}>
      <div style={{position: 'relative', width: '100%', boxSizing: 'border-box', padding: pad, borderRadius: G.radio, background: G.sup, boxShadow: G.sombra, fontFamily: urb, color: G.tinta}}>{children}</div>
    </div>
  );
};
/* íconos de línea (nunca emojis) */
const TRAZOS: Record<string, React.ReactNode> = {
  persona: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  ojo: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  corazon: <path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.3 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.7 0 5.8 3.9 4.5 7.2C19.5 16.4 12 21 12 21z" />,
  moneda: <><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.6-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.5 5.8 4.3 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.5-3-1.4M12 6v1.8M12 16.3V18" /></>,
  sube: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  campana: <><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  mensaje: <path d="M4 5h16v11H9l-5 4z" />,
  guardar: <path d="M6 3h12v18l-6-5-6 5z" />,
  compartir: <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />,
  comentar: <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />,
  lupa: <><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></>,
  play: <path d="M8 5l11 7-11 7z" />,
};
const Icono: React.FC<{n: string; tam?: number; color?: string; grosor?: number; relleno?: string}> = ({n, tam = 44, color = '#fff', grosor = 2.4, relleno = 'none'}) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill={relleno} stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" style={{display: 'block', flex: 'none'}}>{TRAZOS[n] || TRAZOS.sube}</svg>
);
const iconoDe = (unidad = '') => /seguidor|persona|cliente|gente|usuario/i.test(unidad) ? 'persona' : /vista|reproduc|visual/i.test(unidad) ? 'ojo'
  : /like|me gusta|corazon|corazón/i.test(unidad) ? 'corazon' : /peso|dólar|dolar|plata|dinero|venta|\$|usd|cop/i.test(unidad) ? 'moneda' : 'sube';
const iconoAviso = (txt = '') => /seguid/i.test(txt) ? 'persona' : /venta|pago|compra|plata|dinero|peso/i.test(txt) ? 'moneda' : /mensaje|chat|escrib|coment/i.test(txt) ? 'mensaje' : /like|gusta/i.test(txt) ? 'corazon' : 'campana';
const Insignia: React.FC<{G: TemaG; n: string; tam?: number}> = ({G, n, tam = 100}) => (
  <div style={{width: tam, height: tam, borderRadius: tam * 0.3, display: 'grid', placeItems: 'center', flex: 'none', background: G.degradado}}><Icono n={n} tam={tam * 0.56} color={G.sobre} /></div>
);
const Riel: React.FC<{G: TemaG; k: number; alto?: number}> = ({G, k, alto = 22}) => (
  <div style={{height: alto, borderRadius: alto / 2, background: G.riel, overflow: 'hidden'}}><div style={{width: `${k * 100}%`, height: '100%', borderRadius: alto / 2, background: G.barra}} /></div>
);
const Anillo: React.FC<{G: TemaG; k: number; tam: number; grosor: number; children: React.ReactNode}> = ({G, k, tam, grosor, children}) => {
  const r = 50 - grosor / 2, c = 2 * Math.PI * r;
  return (
    <div style={{position: 'relative', width: tam, height: tam}}>
      <svg viewBox="0 0 100 100" width={tam} height={tam} style={{display: 'block', transform: 'rotate(-90deg)'}}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={G.riel} strokeWidth={grosor} />
        {k > 0.002 && <circle cx="50" cy="50" r={r} fill="none" stroke={G.letra} strokeWidth={grosor} strokeLinecap="round" strokeDasharray={`${c * k} ${c}`} />}
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>{children}</div>
    </div>
  );
};
/* la foto de la cuenta: la tuya (un cuadro de tu video) o el ícono de una persona */
const Avatar: React.FC<{G: TemaG; tam: number; foto?: string; anillo?: boolean}> = ({G, tam, foto, anillo}) => (
  <div style={{width: tam, height: tam, borderRadius: '50%', padding: anillo ? 6 : 0, background: anillo ? G.barra : undefined, boxSizing: 'border-box', flex: 'none'}}>
    <div style={{width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: anillo ? `4px solid ${G.sup}` : undefined, boxSizing: 'border-box', background: '#e7e0d6', display: 'grid', placeItems: 'center'}}>
      {foto ? <Img src={foto} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%'}} /> : <Icono n="persona" tam={tam * 0.52} color={G.gris} grosor={1.8} />}
    </div>
  </div>
);
/* el puntero que llega y toca (dibujado, no un emoji) */
const Puntero: React.FC<{x: number; y: number; toca: number}> = ({x, y, toca}) => (
  <svg width={74} height={74} viewBox="0 0 24 24" style={{position: 'absolute', left: x, top: y, transform: `scale(${1 - 0.14 * toca})`, transformOrigin: '20% 15%', filter: 'drop-shadow(4px 8px 8px rgba(0,0,0,.3))'}}>
    <path d="M5 2.5l13.5 11.2-6.3.7 3.6 6.9-2.6 1.3-3.6-6.9L5 20.2z" fill="#fff" stroke="#16120F" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);
const Linea: React.FC<{G: TemaG; margen?: string}> = ({G, margen = '26px -60px 30px'}) => <div style={{height: 2, background: G.riel, margin: margen}} />;
const Tachado: React.FC<{G: TemaG; k: number; alto?: number}> = ({G, k, alto = 11}) => (
  <span style={{position: 'absolute', left: -8, right: -8, top: '52%', height: alto, borderRadius: alto / 2, background: G.letra, transformOrigin: '0 50%', transform: `scaleX(${k})`}} />
);

/* ═══ CIFRAS Y ESTADÍSTICAS ═══ */
/* el contador: la cifra sube durante la frase y LLEGA a su número cuando lo dices (la gruesa); al menos 0,6 s quieta para leerla */
const Contador: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), o = m.objeto, hasta = num(o.hasta), a = m.t0 + 0.3 + (m.paso ? PASO * 0.6 : 0);
  const fin = clamp(Math.max((m.tiempos.gruesa || 0) + 0.35, a + 0.6), a + 0.6, Math.max(a + 0.6, m.t1 - 0.6));
  const x = p(t, a, fin - a), k = fin - a > 1.6 ? Math.sin((x * Math.PI) / 2) : outCubic(x);
  const txt = fmt(hasta), tam = txt.length > 9 ? 150 : txt.length > 7 ? 176 : 210;
  return (
    <Tarjeta t={t} m={m}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <Insignia G={G} n={iconoDe(o.unidad)} />
        {o.unidad && <div style={{fontWeight: 600, fontSize: 52, color: G.gris}}>{o.unidad}</div>}
      </div>
      <div style={{position: 'relative', marginTop: 30, fontWeight: 800, fontSize: tam, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums'}}>
        <span style={{visibility: 'hidden'}}>{txt}</span>
        <span style={{position: 'absolute', left: 0, top: 0, filter: k < 1 ? `blur(${(1 - k) * 3}px)` : undefined}}>{fmt(hasta * k)}</span>
      </div>
      <div style={{marginTop: 38}}><Riel G={G} k={k} /></div>
    </Tarjeta>
  );
};
const Barras: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), bs = (m.objeto.barras || []).slice(0, 4), max = Math.max(1, ...bs.map((b) => num(b.v))), u = reloj(t, m, 1.5), suf = m.objeto.sufijo || '';
  return (
    <Tarjeta t={t} m={m}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 40}}>
        {bs.map((b, i) => {
          const v = num(b.v), k = outCubic(p(u, 0.35 + i * 0.2, 0.9)), top = v === max;
          return (
            <div key={i}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 46}}>
                <span style={{fontWeight: 600, color: top ? G.tinta : G.gris}}>{b.k}</span>
                <span style={{fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: top ? G.letra : G.tinta}}>{fmt(v * k)}{suf}</span>
              </div>
              <div style={{marginTop: 16, height: 36, borderRadius: 18, background: G.riel, overflow: 'hidden'}}>
                <div style={{width: `${(v / max) * k * 100}%`, height: '100%', borderRadius: 18, background: top ? G.barra : '#cdc3b6'}} />
              </div>
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
};
const Porcentaje: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), v = clamp(num(m.objeto.hasta) / 100), k = Math.sin((p(reloj(t, m, 2.2), 0.3, 1.9) * Math.PI) / 2);
  return (
    <Tarjeta t={t} m={m} pad="60px 66px">
      <div style={{display: 'grid', justifyItems: 'center'}}>
        <Anillo G={G} k={k * v} tam={520} grosor={10}><div style={{fontWeight: 800, fontSize: 150, letterSpacing: '-.04em', fontVariantNumeric: 'tabular-nums'}}>{fmt(100 * v * k)} %</div></Anillo>
      </div>
    </Tarjeta>
  );
};
/* la línea es una forma, no un dato: solo lleva los dos valores que dijiste (ini y fin) */
const LineaSube: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), o = m.objeto, u = reloj(t, m, 2.6), k = outCubic(p(u, 0.35, 2)), f = outCubic(p(u, 2.2, 0.4));
  const P = [[40, 370], [300, 350], [430, 250], [720, 60]], v = 1 - k;
  const q = [0, 1].map((j) => v * v * v * P[0][j] + 3 * v * v * k * P[1][j] + 3 * v * k * k * P[2][j] + k * k * k * P[3][j]);
  return (
    <Tarjeta t={t} m={m}>
      <svg viewBox="0 0 768 460" style={{display: 'block', width: '100%', overflow: 'visible', fontFamily: urb}}>
        <path d="M0 410H768" stroke={G.riel} strokeWidth={4} />
        <path d="M40 370C300 350 430 250 720 60" fill="none" stroke={G.letra} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} />
        <circle cx={q[0]} cy={q[1]} r={20} fill={G.letra} />
        {o.ini && <text x={40} y={340} fontWeight={600} fontSize={44} fill={G.gris}>{o.ini}</text>}
        <text x={590} y={70} textAnchor="end" fontWeight={800} fontSize={74} letterSpacing={-2} fill={G.tinta} opacity={f} transform={`translate(0 ${(1 - f) * 24})`}>{o.fin}</text>
      </svg>
    </Tarjeta>
  );
};
const AntesDespues: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), o = m.objeto, u = reloj(t, m, 2.1), va = num(o.antes), vb = num(o.ahora), max = Math.max(1, va, vb), a = outCubic(p(u, 0.3, 0.9)), d = outCubic(p(u, 1.2, 0.8)), suf = o.sufijo || '';
  const col = (et: string, v: number, k: number, fondo: string) => (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: 560}}>
      <div style={{fontWeight: 800, fontSize: 104, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', opacity: clamp(k * 2)}}>{fmt(v * k)}{suf}</div>
      <div style={{marginTop: 16, width: '100%', height: Math.max(10, (v / max) * 340 * k), borderRadius: 26, background: fondo}} />
      <div style={{marginTop: 20, fontWeight: 600, fontSize: 44, color: G.gris}}>{et}</div>
    </div>
  );
  return <Tarjeta t={t} m={m} pad="50px 66px"><div style={{display: 'flex', gap: 40, alignItems: 'flex-end'}}>{col('Antes', va, a, G.riel)}{col('Ahora', vb, d, G.degradado)}</div></Tarjeta>;
};
const Multiplicador: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), veces = Math.max(2, Math.round(num(m.objeto.veces, 2))), u = reloj(t, m, 2.5), k = p(u, 0.4, 1.7), n = Math.max(1, Math.round(1 + (veces - 1) * k));
  const pulso = 1 + 0.08 * Math.sin(p(u, 2.1, 0.3) * Math.PI), caben = veces <= 10;
  return (
    <Tarjeta t={t} m={m}>
      <div style={{textAlign: 'center', fontWeight: 800, fontSize: 290, lineHeight: 1, letterSpacing: '-.05em', fontVariantNumeric: 'tabular-nums', color: G.letra, transform: `scale(${pulso})`}}>×{n}</div>
      <div style={{marginTop: 44}}>
        {caben ? <div style={{display: 'flex', justifyContent: 'center', gap: 16}}>{Array.from({length: veces}, (_, i) => <Icono key={i} n="persona" tam={62} color={i < n ? G.letra : G.riel} />)}</div> : <Riel G={G} k={k} />}
      </div>
    </Tarjeta>
  );
};

/* ═══ TIEMPO ═══ */
const horaDe = (s = '') => {
  const x = String(s).match(/(\d{1,2})(?::(\d{2}))?/);
  return x ? {h: Number(x[1]) % 12, mi: Number(x[2] || 0)} : {h: 0, mi: 0};
};
const Reloj: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), u = reloj(t, m, 2.6), k = outCubic(p(u, 0.3, 2)), f = outCubic(p(u, 2.1, 0.4)), {h, mi} = horaDe(m.objeto.hora);
  return (
    <Tarjeta t={t} m={m} pad="54px 66px">
      <div style={{display: 'grid', justifyItems: 'center'}}>
        <svg viewBox="0 0 100 100" width={500} height={500} style={{display: 'block'}}>
          <circle cx="50" cy="50" r="48" fill="none" stroke={G.riel} strokeWidth="2" />
          {Array.from({length: 12}, (_, i) => <path key={i} d={`M50 6V${i % 3 ? 10 : 13}`} stroke={G.gris} strokeWidth={i % 3 ? 1 : 1.8} strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`} />)}
          <path d="M50 50V26" stroke={G.tinta} strokeWidth="3.6" strokeLinecap="round" transform={`rotate(${(h * 30 + mi * 0.5) * k} 50 50)`} />
          <path d="M50 50V13" stroke={G.letra} strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${(1080 + mi * 6) * k} 50 50)`} />
          <circle cx="50" cy="50" r="3.4" fill={G.tinta} />
        </svg>
        <div style={{marginTop: 22, fontWeight: 800, fontSize: 92, letterSpacing: '-.03em', opacity: f}}>{m.objeto.hora}</div>
      </div>
    </Tarjeta>
  );
};
const Temporizador: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), seg = Math.max(1, num(m.objeto.segundos, 30)), u = reloj(t, m, 3.4), x = p(u, 0.45, 2.8), n = Math.ceil(seg * (1 - x)), pu = n === 0 ? 1 + 0.05 * Math.sin(p(u, 3.25, 0.3) * Math.PI) : 1;
  const txt = String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  return (
    <Tarjeta t={t} m={m} pad="60px 66px">
      <div style={{display: 'grid', justifyItems: 'center', transform: `scale(${pu})`}}>
        <Anillo G={G} k={1 - x} tam={560} grosor={7}><div style={{fontWeight: 800, fontSize: 150, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', color: n === 0 ? G.letra : G.tinta}}>{txt}</div></Anillo>
      </div>
    </Tarjeta>
  );
};
const Calendario: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), dias = clamp(Math.round(num(m.objeto.dias, 30)), 1, 35), n = Math.floor(dias * Math.sin((p(reloj(t, m, 2.9), 0.35, 2.5) * Math.PI) / 2));
  const celdas = Math.max(7, Math.ceil(dias / 7) * 7);
  return (
    <Tarjeta t={t} m={m} pad="50px 56px">
      <div style={{fontWeight: 800, fontSize: 58, letterSpacing: '-.02em', marginBottom: 26, fontVariantNumeric: 'tabular-nums'}}>Día {n} de {dias}</div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12}}>
        {Array.from({length: celdas}, (_, i) => {
          const v = i < dias, on = i < n;
          return <div key={i} style={{aspectRatio: '1', borderRadius: 22, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 36, fontVariantNumeric: 'tabular-nums', background: !v ? 'transparent' : on ? G.acento : G.riel, color: on ? G.sobre : G.gris}}>{v ? i + 1 : ''}</div>;
        })}
      </div>
    </Tarjeta>
  );
};

/* ═══ REDES Y CELULAR (sin logos de ninguna marca) ═══ */
const Comentario: React.FC<PG> = ({t, m, mat}) => {
  const G = temaDe(m), texto = m.objeto.texto || 'me encantó', cuenta = m.objeto.cuenta || mat.cuenta?.usuario || 'tu_cuenta';
  const a = m.t0 + 0.55 + (m.paso ? PASO * 0.6 : 0), vel = 20, n = Math.max(0, Math.min(texto.length, Math.floor((t - a) * vel))), fin = a + texto.length / vel, pub = t > fin + 0.35;
  const e = outCubic(p(t, fin + 0.35, 0.45));
  return (
    <Tarjeta t={t} m={m}>
      <div style={{width: 90, height: 9, borderRadius: 5, background: G.riel, margin: '-22px auto 22px'}} />
      <div style={{textAlign: 'center', fontWeight: 800, fontSize: 36}}>Comentarios</div>
      <Linea G={G} />
      <div style={{minHeight: 150}}>
        {pub && (
          <div style={{display: 'flex', gap: 22, alignItems: 'flex-start', opacity: clamp(e * 1.5), filter: e < 1 ? `blur(${(1 - e) * 12}px)` : undefined, transform: `translateY(${(1 - e) * 40}px)`}}>
            <Avatar G={G} tam={78} foto={mat.foto} />
            <div style={{flex: 1}}>
              <div style={{fontSize: 30}}><span style={{fontWeight: 800}}>{cuenta}</span> <span style={{fontWeight: 600, color: G.gris}}>ahora</span></div>
              <div style={{marginTop: 6, fontWeight: 600, fontSize: 40, lineHeight: 1.2}}>{texto}</div>
            </div>
            <div style={{paddingTop: 18}}><Icono n="corazon" tam={40} color={G.gris} grosor={2} /></div>
          </div>
        )}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 26}}>
        <Avatar G={G} tam={70} foto={mat.foto} />
        <div style={{flex: 1, display: 'flex', alignItems: 'center', minHeight: 80, padding: '0 26px', borderRadius: 40, boxShadow: `inset 0 0 0 2px ${G.riel}`, fontWeight: 600, fontSize: 34,
          color: n && !pub ? G.tinta : G.gris, whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {!pub && n > 0 ? texto.slice(0, n) : 'Agrega un comentario…'}{!pub && n > 0 && Math.floor(t * 3) % 2 === 0 ? '|' : ''}
        </div>
        <div style={{fontWeight: 800, fontSize: 34, color: G.azul, opacity: n && !pub ? 1 : 0.35}}>Publicar</div>
      </div>
    </Tarjeta>
  );
};
/* Seguir: tus cifras de verdad (la cuenta conectada); si no hay cuenta, no se muestra ningún número */
const Seguir: React.FC<PG> = ({t, m, mat}) => {
  const G = temaDe(m), c = mat.cuenta || {}, usuario = m.objeto.cuenta || c.usuario, a = m.t0 + (m.paso ? PASO * 0.6 : 0);
  const llega = outCubic(p(t, a + 0.45, 0.6)), clic = a + 1.1, toca = clamp(1 - Math.abs(t - clic) / 0.12), sigue = t >= clic, pulso = sigue ? 1 + 0.05 * Math.sin(clamp((t - clic) / 0.3) * Math.PI) : 1;
  const cifras = c.seguidores != null ? [['publicaciones', c.publicaciones], ['seguidores', Number(c.seguidores) + (sigue ? 1 : 0)], ['seguidos', c.seguidos]].filter((x) => x[1] != null) : [];
  const despues = Math.min(1, Math.max(0, t - clic));
  return (
    <Tarjeta t={t} m={m}>
      <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
        <Avatar G={G} tam={170} foto={mat.foto} anillo />
        {cifras.length ? (
          <div style={{flex: 1, display: 'flex', justifyContent: 'space-between', textAlign: 'center'}}>
            {cifras.map(([k, v], i) => (
              <div key={i}><div style={{fontWeight: 800, fontSize: 46, fontVariantNumeric: 'tabular-nums', color: k === 'seguidores' && sigue ? G.letra : G.tinta}}>{fmt(v as number)}</div>
                <div style={{fontWeight: 600, fontSize: 28, color: G.gris, marginTop: 4}}>{k as string}</div></div>
            ))}
          </div>
        ) : usuario ? <div style={{fontWeight: 800, fontSize: 56, letterSpacing: '-.02em'}}>{usuario}</div> : null}
      </div>
      {cifras.length > 0 && usuario && <div style={{marginTop: 30, fontWeight: 800, fontSize: 40}}>{usuario}</div>}
      <div style={{position: 'relative', marginTop: 34}}>
        <div style={{height: 92, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontWeight: 800, fontSize: 38,
          background: sigue ? G.suave : G.azul, color: sigue ? G.tinta : '#fff', transform: `scale(${pulso * (1 - 0.03 * toca)})`}}>
          {sigue && <Icono n="check" tam={40} color={G.tinta} grosor={2.8} />}{sigue ? 'Siguiendo' : 'Seguir'}
        </div>
        <Puntero x={lerp(620, 380, llega) + despues * 60} y={lerp(260, 30, llega) + despues * 40} toca={toca} />
      </div>
    </Tarjeta>
  );
};
const MeGusta: React.FC<PG> = ({t, m, mat}) => {
  const G = temaDe(m), u = reloj(t, m, 2.4), clic = 1.3, toca = clamp(1 - Math.abs(u - clic) / 0.12), si = u >= clic, g = p(u, clic, 0.9), esc = !si ? 0 : g < 0.25 ? lerp(0.4, 1.15, g / 0.25) : g < 0.4 ? lerp(1.15, 1, (g - 0.25) / 0.15) : 1, op = g < 0.7 ? 1 : 1 - (g - 0.7) / 0.3, ll = outCubic(p(u, 0.5, 0.7));
  return (
    <Tarjeta t={t} m={m} pad="48px 56px">
      <div style={{display: 'flex', alignItems: 'center', gap: 20, marginBottom: 26}}><Avatar G={G} tam={72} foto={mat.foto} /><div style={{fontWeight: 800, fontSize: 36}}>{mat.cuenta?.usuario || 'tu_cuenta'}</div></div>
      <div style={{position: 'relative', height: 500, borderRadius: 32, background: G.riel, display: 'grid', placeItems: 'center'}}>
        <Icono n="play" tam={110} color={G.gris} grosor={1.6} />
        {si && <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: op, transform: `scale(${esc})`}}><Icono n="corazon" tam={300} color={G.acento} grosor={1} relleno={G.acento} /></div>}
        {u < clic + 0.5 && <Puntero x={lerp(640, 350, ll)} y={lerp(460, 230, ll)} toca={toca} />}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 26}}>
        <Icono n="corazon" tam={62} color={si ? G.acento : G.tinta} grosor={2.2} relleno={si ? G.acento : 'none'} /><Icono n="comentar" tam={60} color={G.tinta} grosor={2.2} /><Icono n="compartir" tam={58} color={G.tinta} grosor={2.2} />
        <div style={{marginLeft: 'auto', fontWeight: 700, fontSize: 36, color: si ? G.letra : G.gris}}>{si ? 'Te gusta' : ''}</div>
      </div>
    </Tarjeta>
  );
};
/* cada aviso: «Título · detalle» */
const Notificaciones: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), ns = lista(m.objeto.avisos).slice(0, 3), u = reloj(t, m, 2.4);
  return (
    <div style={{position: 'absolute', left: 90, top: TARJETA_TOP, width: 900, display: 'grid', gap: 26, fontFamily: urb, color: G.tinta}}>
      {ns.map((x, i) => {
        const a = 0.4 + i * 0.75, e = outCubic(p(u, a, 0.45)), [ti, de] = x.split('·').map((s) => s.trim());
        return (
          <div key={i} style={{display: 'flex', gap: 28, alignItems: 'center', padding: '36px 40px', borderRadius: 44, background: G.sup, boxShadow: G.sombra, opacity: clamp(e * 1.6), filter: borroso(e), transform: `translateY(${(1 - e) * -70}px)`}}>
            <Insignia G={G} n={iconoAviso(x)} tam={96} />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}><span style={{fontWeight: 800, fontSize: 44}}>{ti}</span><span style={{fontWeight: 600, fontSize: 30, color: G.gris}}>ahora</span></div>
              {de && <div style={{marginTop: 6, fontWeight: 600, fontSize: 38, color: G.gris}}>{de}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
/* cada mensaje: lo que dice el otro; si lo dices tú, empieza con «yo:» */
const Chat: React.FC<PG> = ({t, m, mat}) => {
  const G = temaDe(m), ms = lista(m.objeto.mensajes).slice(0, 3), u = reloj(t, m, 3.2), nombre = m.objeto.nombre || 'Cliente';
  const pasos = ms.map((_, i) => 0.9 + i * 0.8);
  return (
    <Tarjeta t={t} m={m} pad="50px 60px">
      <div style={{display: 'flex', alignItems: 'center', gap: 20, marginBottom: 26}}><Avatar G={G} tam={76} /><div><div style={{fontWeight: 800, fontSize: 38, lineHeight: 1.1}}>{nombre}</div><div style={{fontWeight: 600, fontSize: 28, color: G.gris}}>en línea</div></div></div>
      <Linea G={G} margen="0 -60px 30px" />
      <div style={{display: 'grid', gap: 20, minHeight: 400, alignContent: 'start'}}>
        {ms.map((x, i) => {
          const yo = /^yo:/i.test(x), a = pasos[i], tx = x.replace(/^yo:\s*/i, '');
          const antes = i === 0 ? 0.35 : pasos[i - 1] + 0.35;
          if (u < antes) return null;
          if (u < a) return yo ? null : (
            <div key={i} style={{display: 'flex', gap: 10, padding: '30px 34px', borderRadius: 38, background: G.suave, width: 'max-content'}}>
              {[0, 1, 2].map((j) => <span key={j} style={{width: 18, height: 18, borderRadius: '50%', background: G.gris, opacity: 0.35 + 0.65 * Math.abs(Math.sin(u * 5 + j))}} />)}
            </div>
          );
          return <div key={i} style={{display: 'flex', justifyContent: yo ? 'flex-end' : 'flex-start', ...entra(u, a, 0.35)}}><div style={{maxWidth: 560, padding: '24px 34px', borderRadius: 38, fontWeight: 600, fontSize: 42, lineHeight: 1.15, background: yo ? G.acento : G.suave, color: yo ? G.sobre : G.tinta}}>{tx}</div></div>;
        })}
      </div>
    </Tarjeta>
  );
};
const GuardarCompartir: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), comparte = m.objeto.accion === 'compartir', u = reloj(t, m, 2.4), clic = 1.5, toca = clamp(1 - Math.abs(u - clic) / 0.12), si = u >= clic, ll = outCubic(p(u, 0.6, 0.8));
  const pu = si ? 1 + 0.14 * Math.sin(p(u, clic, 0.3) * Math.PI) : 1, cf = (on: boolean) => (on && si ? G.acento : G.tinta), lleno = (on: boolean) => (on && si ? G.acento : 'none');
  return (
    <Tarjeta t={t} m={m} pad="50px 56px">
      <div style={{height: 360, borderRadius: 32, background: G.riel, display: 'grid', placeItems: 'center'}}><Icono n="play" tam={100} color={G.gris} grosor={1.6} /></div>
      <div style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 30, marginTop: 30}}>
        <Icono n="corazon" tam={72} color={G.tinta} grosor={2.2} /><Icono n="comentar" tam={70} color={G.tinta} grosor={2.2} />
        <div style={{transform: comparte ? `scale(${pu})` : undefined}}><Icono n="compartir" tam={68} color={cf(comparte)} grosor={2.2} relleno={lleno(comparte)} /></div>
        <div style={{marginLeft: 'auto', transform: comparte ? undefined : `scale(${pu})`}}><Icono n="guardar" tam={76} color={cf(!comparte)} grosor={2.2} relleno={lleno(!comparte)} /></div>
        {u < clic + 0.7 && <Puntero x={lerp(420, comparte ? 214 : 720, ll)} y={lerp(160, 34, ll)} toca={toca} />}
      </div>
      <div style={{marginTop: 26, height: 84, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontWeight: 800, fontSize: 38, background: G.suave, ...(si ? entra(u, clic + 0.1, 0.35) : {opacity: 0})}}>
        <Icono n="check" tam={38} color={G.letra} grosor={3} />{comparte ? 'Compartido' : 'Guardado'}
      </div>
    </Tarjeta>
  );
};

/* ═══ IDEAS Y ORDEN ═══ */
const Buscador: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), tx = m.objeto.texto || '', u = reloj(t, m, 0.5 + tx.length / 14 + 1.2), a = 0.5, n = Math.max(0, Math.min(tx.length, Math.floor((u - a) * 14))), fin = a + tx.length / 14;
  const fila = (i: number) => {
    const b = fin + 0.2 + i * 0.28;
    if (u < b) return null;
    return (
      <div key={i} style={{padding: '26px 0', borderTop: `2px solid ${G.riel}`, ...entra(u, b, 0.35)}}>
        <div style={{height: 30, width: `${[78, 66, 72][i]}%`, borderRadius: 15, background: G.barra}} />
        <div style={{height: 20, width: '94%', borderRadius: 10, background: G.riel, marginTop: 18}} />
        <div style={{height: 20, width: '60%', borderRadius: 10, background: G.riel, marginTop: 12}} />
      </div>
    );
  };
  return (
    <Tarjeta t={t} m={m} pad="50px 56px">
      <div style={{display: 'flex', alignItems: 'center', gap: 22, minHeight: 104, padding: '0 34px', borderRadius: 52, boxShadow: `inset 0 0 0 3px ${G.riel}`, fontWeight: 600, fontSize: 44, whiteSpace: 'nowrap', overflow: 'hidden'}}>
        <Icono n="lupa" tam={50} color={G.gris} /><span>{tx.slice(0, n)}{u < fin + 0.3 && Math.floor(u * 3) % 2 === 0 ? '|' : ''}</span>
      </div>
      <div style={{marginTop: 30, minHeight: 430}}>{[0, 1, 2].map(fila)}</div>
    </Tarjeta>
  );
};
const Flecha: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), o = m.objeto, u = reloj(t, m, 2.1), k = outCubic(p(u, 0.75, 1)), f = outCubic(p(u, 1.65, 0.35));
  const caja = (x: number, y: number, tx: string | undefined, on: boolean, e: number) => (
    <div style={{position: 'absolute', left: x, top: y, width: 320, height: 120, borderRadius: 30, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 50, letterSpacing: '-.02em', background: on ? G.acento : G.suave, color: on ? G.sobre : G.tinta, opacity: clamp(e * 1.6), filter: borroso(e)}}>{tx}</div>
  );
  return (
    <Tarjeta t={t} m={m} pad="50px 66px">
      <div style={{position: 'relative', height: 540}}>
        <svg viewBox="0 0 768 540" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
          <path d="M170 150C170 340 240 440 420 440" fill="none" stroke={G.letra} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} />
          <path d="M394 410L430 440L394 470" fill="none" stroke={G.letra} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={f} />
        </svg>
        {caja(10, 30, o.de, false, outCubic(p(u, 0.3, 0.4)))}
        {caja(440, 380, o.a, true, f)}
      </div>
    </Tarjeta>
  );
};
/* máximo 3 puntos, cada uno se marca a su turno (Sergio: la lista larga «sumamente aburrida») */
const Chequeos: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), xs = lista(m.objeto.puntos).slice(0, 3), u = reloj(t, m, 0.55 + xs.length * 0.9 + 0.3);
  return (
    <Tarjeta t={t} m={m}>
      <div style={{display: 'grid', gap: 44}}>
        {xs.map((x, i) => {
          const a = 0.55 + i * 0.9, on = u >= a + 0.25, e = outCubic(p(u, a, 0.4)), c = outCubic(p(u, a + 0.25, 0.3));
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 34, opacity: clamp(e * 1.6), filter: borroso(e)}}>
              <div style={{width: 96, height: 96, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: on ? G.acento : G.riel, transform: `scale(${on ? lerp(0.8, 1, c) : 1})`}}>{on && <Icono n="check" tam={58} color={G.sobre} grosor={3} />}</div>
              <div style={{fontWeight: 800, fontSize: 66, letterSpacing: '-.025em', lineHeight: 1.05}}>{x}</div>
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
};
/* el sello va derecho (Sergio: nada torcido) */
const Sello: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), o = m.objeto, u = reloj(t, m, 1.8), r = outCubic(p(u, 0.9, 0.45)), a = o.frase ? 1.35 : 0.6, s = p(u, a, 0.22), e = outCubic(s), palabra = String(o.sello || '').toUpperCase();
  return (
    <Tarjeta t={t} m={m} pad="64px 50px 40px">
      <div style={{position: 'relative', textAlign: 'center', paddingBottom: o.frase ? 300 : 260}}>
        {o.frase && <span style={{position: 'relative', display: 'inline-block', fontWeight: 800, fontSize: 80, lineHeight: 1.1, letterSpacing: '-.03em'}}>{o.frase}<Tachado G={G} k={r} /></span>}
        {u >= a && <div style={{position: 'absolute', left: '50%', bottom: 30, transform: `translateX(-50%) scale(${lerp(1.7, 1, e)})`, opacity: clamp(s * 2), padding: '18px 48px', borderRadius: 26, boxShadow: `inset 0 0 0 12px ${G.letra}`, color: G.letra, fontWeight: 800, fontSize: palabra.length > 9 ? 96 : 128, lineHeight: 1, letterSpacing: '.01em', whiteSpace: 'nowrap'}}>{palabra}</div>}
      </div>
    </Tarjeta>
  );
};
const Precio: React.FC<PG> = ({t, m}) => {
  const G = temaDe(m), o = m.objeto, u = reloj(t, m, 1.9), r = outCubic(p(u, 0.75, 0.45)), a = o.antes ? 1.3 : 0.5, e = outCubic(p(u, a, 0.4)), pu = 1 + 0.06 * Math.sin(p(u, a + 0.1, 0.35) * Math.PI), tamH = String(o.ahora || '').length > 8 ? 150 : 186;
  return (
    <Tarjeta t={t} m={m}>
      {o.antes && <>
        <div style={{fontWeight: 600, fontSize: 48, color: G.gris}}>Antes</div>
        <div style={{marginTop: 8}}><span style={{position: 'relative', display: 'inline-block', fontWeight: 800, fontSize: 124, letterSpacing: '-.03em', color: G.gris}}>{o.antes}<Tachado G={G} k={r} alto={12} /></span></div>
        <Linea G={G} margen="38px -66px 38px" />
      </>}
      <div style={{fontWeight: 600, fontSize: 48, color: G.gris, opacity: u >= a ? 1 : 0}}>Hoy</div>
      <div style={{marginTop: 6, fontWeight: 800, fontSize: tamH, lineHeight: 1, letterSpacing: '-.04em', color: G.letra, transformOrigin: '0 50%', opacity: clamp(e * 1.6), filter: borroso(e), transform: `scale(${pu})`}}>{o.ahora}</div>
    </Tarjeta>
  );
};

export const GRAFICOS: Record<string, React.FC<PG>> = {
  contador: Contador, barras: Barras, porcentaje: Porcentaje, linea: LineaSube, antes_despues: AntesDespues, multiplicador: Multiplicador,
  reloj: Reloj, temporizador: Temporizador, calendario: Calendario,
  seguir: Seguir, comentario: Comentario, me_gusta: MeGusta, notificaciones: Notificaciones, chat: Chat, guardar: GuardarCompartir,
  buscador: Buscador, flecha: Flecha, chequeos: Chequeos, sello: Sello, precio: Precio,
};

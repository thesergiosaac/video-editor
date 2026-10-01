// Meta — encima del video. Una barra que avanza hasta donde vas y deja marcado dónde está la meta.
// Para «vamos por la mitad», «nos falta poco», «ya llegamos a…».
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Cifra, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 428, PAD = 46;
const BARRA = ANCHO - PAD * 2, GRUESO = 30;

export const Meta: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const valor = Math.max(0, Number(d.valor) || 0);
  const meta = Math.max(valor, Number(d.meta) || 100);
  const frac = Math.min(1, valor / meta);
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const avance = sp(t, tc, {damping: 16, stiffness: 62, mass: 1.1}, 45) * frac;
  const llega = tc + 1.25;
  const latido = golpe(t, llega, 5, 2.3);
  const kMeta = sp(t, ENTRA + 0.6, RESORTES.pop);
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const x = PAD + BARRA * avance;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={ALTO} entra={ENTRA} sale={SALE} semilla="meta" brillos={[llega + 0.35]}>
      <div style={{position: 'absolute', left: PAD, top: 36}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 92, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 22 ? 52 : 64, lineHeight: 1.04, letterSpacing: '-0.035em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={40} />
      </div>

      {/* la cifra, encima del punto al que llegó */}
      <div style={{position: 'absolute', left: Math.max(PAD, Math.min(x - 110, ANCHO - PAD - 220)), top: 196,
        width: 220, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900, fontSize: 86, lineHeight: 1,
        letterSpacing: '-0.04em', color: pal.acento, transform: `scale(${1 + 0.06 * latido})`,
        textShadow: `0 0 40px ${pal.a(0.45)}`, fontVariantNumeric: 'tabular-nums'}}>
        <Cifra texto={`${Math.round(valor)}${sufijo}`} t0={tc} dur={1.1} />
      </div>

      {/* la barra */}
      <div style={{position: 'absolute', left: PAD, top: 306, width: BARRA, height: GRUESO, borderRadius: 99,
        background: 'rgba(244,236,231,.10)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)'}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(avance * 100).toFixed(2)}%`,
          borderRadius: 99, background: `linear-gradient(90deg, ${pal.hondo}, ${pal.claro})`,
          boxShadow: `0 0 26px ${pal.a(0.7)}`}} />
        {/* la cabeza */}
        {avance > 0.01 ? (
          <div style={{position: 'absolute', left: BARRA * avance - 13, top: -8, width: 26, height: GRUESO + 16,
            borderRadius: 99, background: pal.tinta, boxShadow: `0 0 22px ${pal.a(0.9)}`}} />
        ) : null}
        {/* dónde está la meta */}
        <div style={{position: 'absolute', left: BARRA - 3, top: -30, width: 6, height: GRUESO + 60, borderRadius: 9,
          background: 'rgba(244,236,231,.42)', transform: `scaleY(${clamp(kMeta)})`}} />
      </div>
      <div style={{position: 'absolute', right: PAD - 10, top: 372, fontFamily: MONO, fontWeight: 500, fontSize: 22,
        letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.tinta3, opacity: clamp(kMeta * 1.4)}}>
        {String(d.pieMeta || `meta ${Math.round(meta)}${sufijo}`)}
      </div>
      {d.pie ? (
        <div style={{position: 'absolute', left: PAD, top: 372, fontFamily: MONO, fontWeight: 500, fontSize: 22,
          letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.tinta3,
          opacity: clamp(sp(t, tc + 0.5, RESORTES.carta) * 1.4)}}>
          {String(d.pie)}
        </div>
      ) : null}
      <Chispas t0={llega} x={Math.min(x, ANCHO - PAD)} y={306 + GRUESO / 2} n={18} semilla="meta" fuerza={700} />
    </Tarjeta>
  );
};

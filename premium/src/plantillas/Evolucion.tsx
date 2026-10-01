// Evolución — encima del video. Columnas por periodo que van subiendo una tras otra, con la última
// encendida. Para «en enero tanto, en febrero tanto…», ventas por mes, crecimiento.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Cifra, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 508, PAD = 50;
const BASE = 424, MAX_ALTO = 238;

export const Evolucion: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const items: [string, number][] = (d.items || []).slice(0, 7);
  const n = items.length;
  const tm: number[] = p.marcas || [];
  const cuando = (i: number) => (tm[i] != null ? tm[i] : p.t0 + 0.6 + i * 0.4);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const max = Math.max(...items.map(([, v]) => v), 1);
  const hueco = 20;
  const an = n ? Math.floor((ANCHO - PAD * 2 - hueco * (n - 1)) / n) : 0;
  const sufijo = d.sufijo != null ? String(d.sufijo) : '';
  const ultimo = n - 1;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={ALTO} entra={ENTRA} sale={SALE} semilla="evol" brillos={[cuando(ultimo) + 0.5]}>
      <div style={{position: 'absolute', left: PAD, top: 34}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 86, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 24 ? 48 : 58, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={38} />
      </div>

      {/* la línea del suelo */}
      <div style={{position: 'absolute', left: PAD, right: PAD, top: BASE, height: 2,
        background: 'rgba(244,236,231,.16)'}} />

      {items.map(([nombre, valor], i) => {
        const ti = cuando(i);
        const k = sp(t, ti, {damping: 14, stiffness: 115, mass: 0.9});
        const alto = MAX_ALTO * (0.16 + 0.84 * (valor / max)) * clamp(k);
        const x = PAD + i * (an + hueco);
        const es = i === ultimo;
        return (
          <div key={i}>
            <div style={{position: 'absolute', left: x, top: BASE - alto, width: an, height: Math.max(3, alto),
              borderRadius: '14px 14px 5px 5px', opacity: clamp(k * 2),
              background: es ? `linear-gradient(180deg, ${pal.claro}, ${pal.acento})` : 'rgba(244,236,231,.20)',
              boxShadow: es ? `0 0 34px ${pal.a(0.5)}, inset 0 2px 0 rgba(255,255,255,.4)`
                            : 'inset 0 1.5px 0 rgba(255,255,255,.14)'}} />
            <div style={{position: 'absolute', left: x - 12, top: BASE - alto - 48, width: an + 24, textAlign: 'center',
              fontFamily: OUTFIT, fontWeight: 900, fontSize: es ? 38 : 30, letterSpacing: '-0.02em',
              color: es ? pal.acento : pal.tinta2, opacity: clamp(k * 2.4), fontVariantNumeric: 'tabular-nums',
              textShadow: es ? `0 0 24px ${pal.a(0.5)}` : undefined}}>
              <Cifra texto={`${Math.round(valor)}${sufijo}`} t0={ti} dur={0.6} />
            </div>
            <div style={{position: 'absolute', left: x - 10, top: BASE + 16, width: an + 20, textAlign: 'center',
              fontFamily: MONO, fontWeight: 500, fontSize: 21, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: es ? pal.tinta2 : pal.tinta3, opacity: clamp(k * 1.6)}}>
              {nombre}
            </div>
          </div>
        );
      })}
      {n ? <Chispas t0={cuando(ultimo) + 0.3} x={PAD + ultimo * (an + hueco) + an / 2} y={BASE - MAX_ALTO * 0.9}
        n={18} semilla="evol" fuerza={680} /> : null}
    </Tarjeta>
  );
};

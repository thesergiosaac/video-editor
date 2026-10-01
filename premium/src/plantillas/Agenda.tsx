// Agenda — encima del video. Una semana en casillas y se van marcando los días que cuentan. Para rutinas,
// plazos y «hazlo tres veces por semana»: se ve de un golpe cuántos son y cuáles.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Etiqueta, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, ALTO = 400, PAD = 40;
const CHEQUE = 'M 11 22 L 19 30 L 33 14';

export const Agenda: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const dias: string[] = (d.dias || ['L', 'M', 'X', 'J', 'V', 'S', 'D']).slice(0, 7);
  const marcados: number[] = (d.marcados || []).map((x: any) => Math.round(Number(x))).filter((x: number) => x >= 0 && x < dias.length);
  const tm: number[] = p.marcas || [];
  const cuando = (k: number) => (tm[k] != null ? tm[k] : p.t0 + 0.8 + k * 0.5);
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const hueco = 14;
  const an = Math.floor((ANCHO - PAD * 2 - hueco * (dias.length - 1)) / dias.length);
  const cab = 168;
  const ultimo = marcados.length ? cuando(marcados.length - 1) : ENTRA + 1;

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={ALTO} entra={ENTRA} sale={SALE} semilla="agen" brillos={[ultimo + 0.5]}>
      <div style={{position: 'absolute', left: PAD, top: 32}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 80, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo || '').length > 24 ? 46 : 56, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: pal.tinta, whiteSpace: 'nowrap'}}>
        <Letras texto={String(d.titulo || '')} t0={ENTRA + 0.35} paso={0.8 / 30} subir={38} />
      </div>

      {dias.map((dia, i) => {
        const donde = marcados.indexOf(i);
        const on = donde >= 0;
        const ti = on ? cuando(donde) : ENTRA + 0.4;
        const k = sp(t, ti, {damping: 13, stiffness: 140, mass: 0.85});
        const marca = on ? rampa(t, ti + 0.12, ti + 0.5, EASE.llega) : 0;
        const x = PAD + i * (an + hueco);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: cab, width: an, height: an * 1.18,
            borderRadius: 20, display: 'grid', placeItems: 'center',
            opacity: clamp(k * 1.7) * (on ? 1 : 0.62), transform: `translateY(${(1 - k) * 22}px) scale(${on ? 0.86 + 0.14 * k : 1})`,
            background: on ? `linear-gradient(160deg, ${pal.claro}, ${pal.acento})` : 'rgba(255,255,255,.055)',
            boxShadow: on ? `0 14px 34px -12px ${pal.a(0.8)}, inset 0 2px 0 rgba(255,255,255,.3)`
                          : 'inset 0 0 0 1.5px rgba(255,255,255,.10)'}}>
            <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: '0.1em',
              color: on ? pal.sobre : pal.tinta3, position: 'absolute', top: 14}}>{dia}</span>
            {on ? (
              <svg width={44} height={44} style={{marginTop: 18, overflow: 'visible'}}>
                <path d={CHEQUE} fill="none" stroke={pal.sobre} strokeWidth={6} strokeLinecap="round"
                  strokeLinejoin="round" {...evolvePath(marca, CHEQUE)} />
              </svg>
            ) : null}
          </div>
        );
      })}

      {d.pie ? (
        <div style={{position: 'absolute', left: PAD, right: PAD, top: cab + Math.round(an * 1.18) + 30,
          textAlign: 'center', fontFamily: OUTFIT, fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em',
          color: pal.tinta2, opacity: clamp(sp(t, ultimo + 0.3, RESORTES.carta) * 1.5)}}>
          {String(d.pie)}
        </div>
      ) : null}
      {marcados.length ? (
        <Chispas t0={ultimo + 0.25} x={PAD + marcados[marcados.length - 1] * (an + hueco) + an / 2}
          y={cab + an * 0.6} n={16} semilla="agen" fuerza={620} />
      ) : null}
    </Tarjeta>
  );
};

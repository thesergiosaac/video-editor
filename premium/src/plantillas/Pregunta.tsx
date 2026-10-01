// Pregunta — encima del video. La pregunta entra con su signo grande latiendo, y cuando la contestas
// aparece la respuesta debajo, subrayada. Para el momento de «¿y entonces qué hago?».
import React from 'react';
import {OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Letras, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 48;

export const Pregunta: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const preg = String(d.pregunta || '');
  const resp = String(d.respuesta || '');
  const tq = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const tr = p.marcas[1] != null ? p.marcas[1] : tq + 1.6;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const tamQ = preg.length > 46 ? 52 : preg.length > 28 ? 62 : 72;
  const tamR = resp.length > 34 ? 56 : 68;
  const lineasQ = Math.ceil(preg.length / Math.max(10, Math.floor((ANCHO - PAD * 2 - 130) / (tamQ * 0.52))));
  const h = 150 + lineasQ * tamQ * 1.14 + 60 + tamR * 1.2 + PAD;
  const kq = sp(t, tq, {damping: 15, stiffness: 100, mass: 1});
  const kr = sp(t, tr, {damping: 13, stiffness: 110, mass: 0.9});
  const latido = golpe(t, tq + 0.45, 5, 2.4);
  const raya = rampa(t, tr + 0.25, tr + 0.75, EASE.llega);

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={h} entra={ENTRA} sale={SALE} semilla="preg" brillos={[tr + 0.4]}>
      {/* el signo, grande y latiendo */}
      <div style={{position: 'absolute', left: PAD, top: 56, fontFamily: OUTFIT, fontWeight: 900, fontSize: 130,
        lineHeight: 1, color: pal.acento, opacity: clamp(kq * 1.5) * 0.9,
        transform: `scale(${(0.6 + 0.4 * kq) * (1 + 0.08 * latido)})`, transformOrigin: '50% 50%',
        textShadow: `0 0 50px ${pal.a(0.5)}`}}>
        ?
      </div>
      <div style={{position: 'absolute', left: PAD + 120, right: PAD, top: 92, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: tamQ, lineHeight: 1.14, letterSpacing: '-0.03em', color: pal.tinta,
        opacity: clamp(kq * 1.6), transform: `translateY(${(1 - kq) * 22}px)`}}>
        <Letras texto={preg} t0={tq} paso={0.7 / 30} subir={30} />
      </div>

      {/* la respuesta, debajo y subrayada */}
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 150 + lineasQ * tamQ * 1.14 + 30,
        opacity: clamp(kr * 1.6), transform: `translateY(${(1 - kr) * 26}px)`}}>
        <div style={{position: 'relative', display: 'inline-block', fontFamily: OUTFIT, fontWeight: 900,
          fontSize: tamR, lineHeight: 1.1, letterSpacing: '-0.035em', color: pal.acento,
          textShadow: `0 0 44px ${pal.a(0.45)}`}}>
          {resp}
          <span style={{position: 'absolute', left: 0, right: 0, bottom: '-0.14em', height: 5, borderRadius: 99,
            background: pal.acento, transform: `scaleX(${raya.toFixed(3)})`, transformOrigin: '0% 50%',
            boxShadow: `0 0 20px ${pal.a(0.8)}`}} />
        </div>
      </div>
      <Chispas t0={tr + 0.3} x={ANCHO * 0.4} y={h - 90} n={18} semilla="preg" fuerza={660} />
    </Tarjeta>
  );
};

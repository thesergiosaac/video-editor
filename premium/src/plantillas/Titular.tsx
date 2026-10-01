// Titular — encima del video. La frase entera, y la palabra que importa se subraya sola con un trazo de
// marcador. Para rematar una idea sin números: lo que quieres que se le quede grabado.
import React from 'react';
import {OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Etiqueta, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 150, ANCHO = 908, PAD = 48;

export const Titular: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos || {};
  const frase = String(d.texto || '');
  const clave = String(d.clave || '').trim();
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const tk = p.marcas[1] != null ? p.marcas[1] : tc + 1.0;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const largo = frase.length;
  const tam = largo > 60 ? 54 : largo > 40 ? 64 : largo > 24 ? 76 : 88;
  const h = 160 + Math.ceil(largo / Math.max(12, Math.floor(ANCHO / (tam * 0.52)))) * tam * 1.16 + PAD;
  // se parte la frase en tres: lo de antes, la palabra clave y lo de después
  const i = clave ? frase.toLowerCase().indexOf(clave.toLowerCase()) : -1;
  const antes = i >= 0 ? frase.slice(0, i) : frase;
  const medio = i >= 0 ? frase.slice(i, i + clave.length) : '';
  const luego = i >= 0 ? frase.slice(i + clave.length) : '';
  const k = sp(t, tc, {damping: 15, stiffness: 95, mass: 1});
  const raya = rampa(t, tk, tk + 0.5, EASE.llega);

  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={h} entra={ENTRA} sale={SALE} semilla="titu" brillos={[tk + 0.4]}>
      <div style={{position: 'absolute', left: PAD, top: 34}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={ENTRA + 0.2} />
      </div>
      <div style={{position: 'absolute', left: PAD, right: PAD, top: 116, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: tam, lineHeight: 1.16, letterSpacing: '-0.035em', color: pal.tinta,
        opacity: clamp(k * 1.6), transform: `translateY(${(1 - k) * 26}px)`}}>
        {antes}
        {medio ? (
          <span style={{position: 'relative', display: 'inline-block', color: pal.acento,
            textShadow: `0 0 40px ${pal.a(0.4)}`}}>
            {medio}
            {/* el trazo de marcador, que se pinta de un lado al otro */}
            <span style={{position: 'absolute', left: '-0.06em', right: '-0.06em', bottom: '0.02em',
              height: '0.14em', borderRadius: 99, background: pal.acento, opacity: 0.85,
              transform: `scaleX(${raya.toFixed(3)})`, transformOrigin: '0% 50%',
              boxShadow: `0 0 20px ${pal.a(0.7)}`}} />
          </span>
        ) : null}
        {luego}
      </div>
      <Chispas t0={tk + 0.45} x={ANCHO * 0.62} y={h * 0.62} n={16} semilla="titu" fuerza={640} />
    </Tarjeta>
  );
};

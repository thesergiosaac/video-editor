// Dato — pantalla partida. Un dato que no es tuyo, con su fuente citada debajo entre líneas. Para cuando
// te apoyas en un estudio o en una cifra oficial: se nota que no te lo inventaste.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Letras} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

export const Dato: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const texto = String(d.texto || '');
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const tf = p.marcas[1] != null ? p.marcas[1] : tc + 1.4;
  const {op, dy, sale} = usePresenciaGrupo();
  const top = Math.round(Hd * 0.46);
  const k = sp(t, tc, {damping: 15, stiffness: 95, mass: 1});
  const kf = sp(t, tf, RESORTES.carta);
  const raya = rampa(t, tf, tf + 0.6, EASE.llega);
  const tam = texto.length > 70 ? 52 : texto.length > 46 ? 62 : 74;
  if (op <= 0.001) return null;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op,
      transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      {/* la barra de color a la izquierda: marca que esto es una cita de fuera */}
      <div style={{position: 'absolute', left: 74, top: top, width: 7, height: 200, borderRadius: 99,
        background: `linear-gradient(180deg, ${pal.claro}, ${pal.acento})`, boxShadow: `0 0 24px ${pal.a(0.7)}`,
        transform: `scaleY(${clamp(k)})`, transformOrigin: '50% 0%'}} />

      <div style={{position: 'absolute', left: 116, right: 74, top: top - 8, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: tam, lineHeight: 1.16, letterSpacing: '-0.035em', color: pal.tinta,
        opacity: clamp(k * 1.5), textShadow: '0 12px 40px rgba(0,0,0,.7)'}}>
        <Letras texto={texto} t0={tc} paso={0.7 / 30} subir={30} />
      </div>

      {/* la fuente, entre dos líneas finas */}
      <div style={{position: 'absolute', left: 116, right: 74, top: top + 230, display: 'flex', alignItems: 'center',
        gap: 18, opacity: clamp(kf * 1.5)}}>
        <span style={{flex: 'none', width: 46, height: 2, background: pal.a(0.6),
          transform: `scaleX(${raya.toFixed(3)})`, transformOrigin: '0% 50%'}} />
        <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis'}}>
          {String(d.fuente || '')}
        </span>
        <span style={{flex: 1, height: 2, background: 'rgba(244,236,231,.16)',
          transform: `scaleX(${raya.toFixed(3)})`, transformOrigin: '0% 50%'}} />
      </div>
      <Chispas t0={tc + 0.5} x={80} y={top + 30} n={14} semilla="dato" fuerza={560} />
    </div>
  );
};

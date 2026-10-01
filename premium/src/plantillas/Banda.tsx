// Banda de dato — con profundidad. Un resplandor suave se enciende DETRÁS de ti y, DELANTE, entra una banda baja con
// la cifra y su etiqueta, como el rótulo de un noticiero pero limpio. Para soltar un dato sin tapar la cara.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Cifra} from '../lib/Piezas';

export const Banda: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte} = useG();
  const d = p.datos || {};
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.4;
  const sale = rampa(t, p.t1 - 0.7, p.t1 - 0.25, EASE.sale);
  const k = sp(t, tc, {damping: 16, stiffness: 92, mass: 1});

  if (parte === 'atras') {
    const halo = clamp(sp(t, tc - 0.25, {damping: 20, stiffness: 60, mass: 1})) * (1 - sale);
    return (
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: halo * 0.85}}>
        <div style={{position: 'absolute', left: -160, right: -160, top: Hd * 0.18, height: Hd * 0.62, borderRadius: '50%',
          background: `radial-gradient(closest-side, ${pal.a(0.5)}, transparent 72%)`, filter: 'blur(60px)'}} />
      </div>
    );
  }

  const cifra = String(d.valor != null ? `${d.valor}${d.sufijo != null ? d.sufijo : ''}` : d.texto || '');
  const y = Math.round(Hd * 0.735);
  const dentro = clamp(k * 1.4);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: 1 - sale}}>
      <div style={{position: 'absolute', left: 74, right: 74, top: y, display: 'flex', alignItems: 'stretch',
        borderRadius: 26, overflow: 'hidden', opacity: dentro,
        transform: `translateX(${(1 - k) * -70}px)`,
        boxShadow: '0 34px 80px -30px rgba(0,0,0,.95), inset 0 0 0 1px rgba(244,236,231,.14)',
        background: 'linear-gradient(120deg, rgba(20,14,18,.90), rgba(12,8,10,.86))',
        backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)'}}>
        <div style={{flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 30px', minWidth: 220,
          background: `linear-gradient(160deg, ${pal.claro}, ${pal.acento})`, color: pal.sobre,
          fontFamily: OUTFIT, fontWeight: 900, fontSize: cifra.length > 4 ? 66 : 84, letterSpacing: '-0.035em',
          whiteSpace: 'nowrap'}}>
          <Cifra texto={cifra} t0={tc + 0.1} dur={0.85} />
        </div>
        <div style={{flex: 1, minWidth: 0, padding: '26px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8}}>
          <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: pal.acento}}>{String(d.etiqueta || '')}</div>
          <div style={{fontFamily: OUTFIT, fontWeight: 800, fontSize: String(d.titulo || '').length > 28 ? 40 : 48,
            lineHeight: 1.08, letterSpacing: '-0.025em', color: pal.tinta}}>{String(d.titulo || '')}</div>
        </div>
      </div>
    </div>
  );
};

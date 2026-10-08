// Cita con nombre — encima del video. La comilla cae girando, la frase aparece palabra por palabra al ritmo en que la
// dices y al final se subraya su remate; abajo, las iniciales con un aro que se dibuja y el nombre a máquina.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {ruido2D as noise2D} from '../lib/ruido';   // (8-oct) el mismo noise2D sin el tope de 10 semillas
import {MONO, OUTFIT, PLAYFAIR} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Escribir, Tarjeta} from '../lib/Piezas';

const Palabra: React.FC<{w: string; t0: number; ultima: boolean; subraya: number | null}> = ({w, t0, ultima, subraya}) => {
  const t = useT();
  const {pal} = useG();
  const p = sp(t, t0 - 0.03, {damping: 16, stiffness: 150, mass: 0.6});
  const borroso = (1 - clamp(p)) * 12;
  const u = subraya != null ? sp(t, subraya, {damping: 18, stiffness: 140, mass: 0.7}) : 0;
  return (
    <>
      <span style={{display: 'inline-block', position: 'relative', opacity: clamp(p * 1.6), transform: `translateY(${(1 - p) * 30}px) rotate(${(1 - p) * -5}deg)`, filter: borroso > 0.3 ? `blur(${borroso}px)` : undefined}}>
        {subraya != null ? (
          <span style={{position: 'absolute', left: '-0.02em', right: ultima ? '0.05em' : '-0.27em', bottom: '0.02em', height: 7, borderRadius: 9, background: `linear-gradient(90deg, ${pal.acento}, ${pal.claro})`,
            boxShadow: `0 0 14px ${pal.a(0.6)}`, transform: `scaleX(${u})`, transformOrigin: '0% 50%', opacity: clamp(u * 3)}} />
        ) : null}
        <span style={{position: 'relative'}}>{w}</span>
      </span>
      {ultima ? null : ' '}
    </>
  );
};

export const Cita: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos;
  const tq = p.marcas[0];
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const palabras: string[] = String(d.texto).split(/\s+/).filter(Boolean);
  const n = palabras.length;
  const dur = Math.max(1.2, (p.fin || tq + 2) - tq);
  const largo = String(d.texto).length;
  const tam = largo > 80 ? 50 : largo > 50 ? 56 : 62;
  const porLinea = Math.floor(800 / (tam * 0.47));
  const lineas = Math.max(1, Math.ceil(largo / porLinea));
  const T = {x: 86, y: 136, w: 908, h: 80 + lineas * tam * 1.17 + 150};
  const subrayar = Math.min(3, Math.max(1, Math.floor(n / 3)));
  const tSub = tq + dur + 0.2;
  const q = sp(t, ENTRA + 0.1, RESORTES.pop);
  const qx = noise2D('comilla-x', t * 0.5, 0) * 4, qy = noise2D('comilla-y', 0, t * 0.45) * 5, qr = noise2D('comilla-r', t * 0.4, 3) * 3;
  const tN = ENTRA + 0.5;
  const aro = rampa(t, tN - 0.07, tN + 0.53, EASE.llega);
  const raya = rampa(t, tN + 0.07, tN + 0.4, EASE.llega);
  const avatar = sp(t, tN - 0.1, RESORTES.pop);
  const ARO = 'M 31 2 A 29 29 0 1 1 31 60 A 29 29 0 1 1 31 2';
  const iniciales = String(d.autor).split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join('');
  return (
    <Tarjeta {...T} entra={ENTRA} sale={SALE} semilla="cita" brillos={[tSub + 0.55]}>
      <div style={{position: 'absolute', left: 28, top: -122, fontFamily: PLAYFAIR, fontWeight: 900, fontSize: 310, lineHeight: 1, color: pal.acento, textShadow: `0 10px 40px ${pal.a(0.45)}`,
        opacity: clamp(q * 2), transform: `translate(${qx}px, ${qy + (1 - q) * -50}px) scale(${q}) rotate(${(1 - q) * -35 + qr}deg)`, transformOrigin: '40% 60%'}}>
        “
      </div>
      <div style={{position: 'absolute', left: 58, right: 50, top: 80, fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 700, fontSize: tam, lineHeight: 1.17, color: pal.tinta, letterSpacing: '-0.005em'}}>
        {palabras.map((w, i) => (
          <Palabra key={i} w={w} t0={tq + (dur * i) / Math.max(1, n)} ultima={i === n - 1} subraya={i >= n - subrayar ? tSub + (i - (n - subrayar)) * 0.13 : null} />
        ))}
      </div>
      <div style={{position: 'absolute', left: 56, bottom: 36, display: 'flex', alignItems: 'center', gap: 18}}>
        <div style={{position: 'relative', width: 62, height: 62, transform: `scale(${avatar})`}}>
          <div style={{position: 'absolute', inset: 5, borderRadius: 99, background: 'linear-gradient(160deg, rgba(255,255,255,.14), rgba(255,255,255,.03))', display: 'grid', placeItems: 'center',
            fontFamily: OUTFIT, fontWeight: 800, fontSize: 21, letterSpacing: '0.02em', color: pal.tinta}}>
            {iniciales}
          </div>
          <svg width={62} height={62} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <path d={ARO} fill="none" stroke={pal.acento} strokeWidth={3} strokeLinecap="round" {...evolvePath(aro, ARO)} />
          </svg>
        </div>
        <svg width={40} height={4} style={{overflow: 'visible'}}>
          <path d="M 0 2 L 40 2" stroke="rgba(244,236,231,.45)" strokeWidth={3} strokeLinecap="round" {...evolvePath(raya, 'M 0 2 L 40 2')} />
        </svg>
        <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 27, letterSpacing: '0.17em', textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap'}}>
          <Escribir texto={d.autor} t0={tN + 0.13} velocidad={1.2} />
        </div>
      </div>
    </Tarjeta>
  );
};

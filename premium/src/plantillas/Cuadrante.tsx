// Cuadrante — pantalla partida. Dos ejes y cuatro casillas; un punto cae en una de ellas y la enciende.
// Para «barato pero malo», «caro y bueno»: situar algo entre dos cosas que se miden.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, golpe, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Escribir} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const LADO = 560, X0 = (1080 - LADO) / 2;

export const Cuadrante: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const casillas: string[] = (d.casillas || []).slice(0, 4);   // arriba-izq, arriba-der, abajo-izq, abajo-der
  const cual = Math.max(0, Math.min(3, Math.round(Number(d.cual) || 0)));
  const tc = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.6;
  const tp = p.marcas[1] != null ? p.marcas[1] : tc + 1.2;
  const {op, dy, sale} = usePresenciaGrupo();
  const top = Math.round(Hd * 0.42);
  const ejes = rampa(t, p.t0 + 0.3, p.t0 + 1.1, EASE.llega);
  const kp = sp(t, tp, {damping: 12, stiffness: 95, mass: 1});
  const latido = golpe(t, tp + 0.55, 5, 2.3);
  const col = cual % 2, fil = Math.floor(cual / 2);
  const px = X0 + LADO * (col ? 0.75 : 0.25), py = top + LADO * (fil ? 0.75 : 0.25);
  if (op <= 0.001) return null;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op,
      transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      <div style={{position: 'absolute', left: 80, right: 80, top: top - 54, textAlign: 'center', fontFamily: MONO,
        fontWeight: 500, fontSize: 26, letterSpacing: '0.2em', textTransform: 'uppercase', color: pal.tinta2,
        whiteSpace: 'nowrap'}}>
        <Escribir texto={String(d.titulo || '')} t0={p.t0 + 0.35} velocidad={1.4} />
      </div>

      {/* las cuatro casillas */}
      {casillas.map((txt, i) => {
        const c = i % 2, f = Math.floor(i / 2);
        const es = i === cual;
        const k = sp(t, tc + i * 0.16, RESORTES.carta);
        return (
          <div key={i} style={{position: 'absolute', left: X0 + c * (LADO / 2) + 6, top: top + f * (LADO / 2) + 6,
            width: LADO / 2 - 12, height: LADO / 2 - 12, borderRadius: 20, padding: 18, display: 'grid',
            placeItems: 'center', textAlign: 'center', opacity: clamp(k * 1.6) * (es ? 1 : 0.75),
            transform: `scale(${0.93 + 0.07 * k})`,
            background: es ? `linear-gradient(150deg, ${pal.a(0.3)}, rgba(16,11,14,.5))` : 'rgba(255,255,255,.045)',
            boxShadow: es ? `inset 0 0 0 2px ${pal.a(0.75)}, 0 0 44px -10px ${pal.a(0.55)}`
                          : 'inset 0 0 0 1px rgba(255,255,255,.08)'}}>
            <span style={{fontFamily: OUTFIT, fontWeight: es ? 900 : 700, fontSize: txt.length > 16 ? 30 : 36,
              lineHeight: 1.12, letterSpacing: '-0.02em', color: es ? pal.tinta : pal.tinta2}}>{txt}</span>
          </div>
        );
      })}

      {/* los ejes */}
      <svg width={1080} height={LADO + 80} style={{position: 'absolute', left: 0, top: top, overflow: 'visible'}}>
        <line x1={X0} y1={LADO / 2} x2={X0 + LADO * ejes} y2={LADO / 2} stroke="rgba(244,236,231,.30)" strokeWidth={3} />
        <line x1={X0 + LADO / 2} y1={0} x2={X0 + LADO / 2} y2={LADO * ejes} stroke="rgba(244,236,231,.30)" strokeWidth={3} />
      </svg>

      {/* las etiquetas de los ejes */}
      <div style={{position: 'absolute', left: X0, top: top + LADO + 16, width: LADO, display: 'flex',
        justifyContent: 'space-between', fontFamily: MONO, fontWeight: 500, fontSize: 21, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: pal.tinta3, opacity: clamp(ejes)}}>
        <span>{String(d.ejeX0 || '')}</span><span>{String(d.ejeX1 || '')}</span>
      </div>

      {/* el punto */}
      {kp > 0.01 ? (
        <div style={{position: 'absolute', left: px - 26, top: py - 26, width: 52, height: 52, borderRadius: 99,
          background: pal.tinta, boxShadow: `0 0 34px ${pal.a(0.95)}, 0 0 0 10px ${pal.a(0.22)}`,
          transform: `scale(${(clamp(kp) * (1 + 0.12 * latido)).toFixed(3)})`}} >
          <div style={{position: 'absolute', inset: 16, borderRadius: 99, background: pal.acento}} />
        </div>
      ) : null}

      {d.pie ? (
        <div style={{position: 'absolute', left: 80, right: 80, top: top + LADO + 66, textAlign: 'center',
          fontFamily: OUTFIT, fontWeight: 900, fontSize: String(d.pie).length > 28 ? 46 : 54, lineHeight: 1.06,
          letterSpacing: '-0.03em', color: pal.tinta, textShadow: '0 10px 40px rgba(0,0,0,.8)',
          opacity: clamp(sp(t, tp + 0.5, RESORTES.carta) * 1.5)}}>
          {String(d.pie)}
        </div>
      ) : null}
      <Chispas t0={tp + 0.3} x={px} y={py} n={20} semilla="cuad" fuerza={700} />
    </div>
  );
};

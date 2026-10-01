// Balanza — pantalla partida. Dos platos que se inclinan hacia el lado que pesa más. Para cuando comparas
// dos opciones y una gana: «te sale más a cuenta esto que aquello».
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Chispas, Cifra, Escribir} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const CX = 540, BRAZO = 292, MASTIL = 138;

export const Balanza: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const A = d.a || {}, B = d.b || {};
  const tA = p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.5;
  const tB = p.marcas[1] != null ? p.marcas[1] : tA + 1.2;
  const {op, dy, sale} = usePresenciaGrupo();
  const va = Number(A.valor) || 0, vb = Number(B.valor) || 0;
  // quién gana lo decide el guion: a veces gana el número más chico (lo que cuesta menos)
  const ganaB = d.ganador ? String(d.ganador) === 'b' : vb >= va;
  const dif = Math.min(1, Math.abs(vb - va) / Math.max(1, Math.max(va, vb)));
  const k = sp(t, tB, {damping: 12, stiffness: 70, mass: 1.1});
  const ang = (ganaB ? 1 : -1) * 13 * dif * k;   // el lado que pesa baja
  const top = Math.round(Hd * 0.42);
  const kA = sp(t, tA, RESORTES.carta);
  const kB = sp(t, tB, RESORTES.carta);
  if (op <= 0.001) return null;

  const plato = (lado: -1 | 1, txt: string, valor: string, kk: number, gana: boolean) => {
    const x = CX + lado * BRAZO;
    const y = top + MASTIL + 30 + (lado === 1 ? ang : -ang) * 5.2;
    return (
      <div style={{position: 'absolute', left: x - 170, top: y, width: 340, textAlign: 'center',
        opacity: clamp(kk * 1.6), transform: `translateY(${(1 - kk) * 26}px)`}}>
        <div style={{height: 96, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: gana ? `linear-gradient(150deg, ${pal.claro}, ${pal.acento})` : 'rgba(255,255,255,.09)',
          boxShadow: gana ? `0 18px 44px -16px ${pal.a(0.8)}, inset 0 2px 0 rgba(255,255,255,.35)`
                          : 'inset 0 0 0 1.5px rgba(255,255,255,.12)',
          fontFamily: OUTFIT, fontWeight: 900, fontSize: 52, letterSpacing: '-0.03em', whiteSpace: 'nowrap',
          color: gana ? pal.sobre : pal.tinta}}>
          <Cifra texto={valor} t0={gana ? tB : tA} dur={0.8} />
        </div>
        <div style={{marginTop: 14, fontFamily: OUTFIT, fontWeight: 800, fontSize: 30, letterSpacing: '-0.015em',
          color: gana ? pal.tinta : pal.tinta2, lineHeight: 1.12}}>{txt}</div>
      </div>
    );
  };

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op,
      transform: `translateY(${dy}px)`, filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      <div style={{position: 'absolute', left: 80, right: 80, top: top - 46, textAlign: 'center', fontFamily: MONO,
        fontWeight: 500, fontSize: 26, letterSpacing: '0.2em', textTransform: 'uppercase', color: pal.tinta2,
        whiteSpace: 'nowrap'}}>
        <Escribir texto={String(d.etiqueta || '')} t0={p.t0 + 0.35} velocidad={1.4} />
      </div>

      {/* el mástil y el brazo */}
      <svg width={1080} height={MASTIL + 80} style={{position: 'absolute', left: 0, top: top, overflow: 'visible'}}>
        <line x1={CX} y1={MASTIL} x2={CX} y2={22} stroke="rgba(244,236,231,.30)" strokeWidth={7} strokeLinecap="round" />
        <circle cx={CX} cy={MASTIL} r={13} fill="rgba(244,236,231,.30)" />
        <g transform={`rotate(${ang.toFixed(2)} ${CX} 22)`}>
          <line x1={CX - BRAZO} y1={22} x2={CX + BRAZO} y2={22} stroke={pal.acento} strokeWidth={8}
            strokeLinecap="round" style={{filter: `drop-shadow(0 0 16px ${pal.a(0.6)})`}} />
          <circle cx={CX - BRAZO} cy={22} r={11} fill={pal.tinta} />
          <circle cx={CX + BRAZO} cy={22} r={11} fill={pal.tinta} />
          <line x1={CX - BRAZO} y1={22} x2={CX - BRAZO} y2={56} stroke="rgba(244,236,231,.35)" strokeWidth={4} />
          <line x1={CX + BRAZO} y1={22} x2={CX + BRAZO} y2={56} stroke="rgba(244,236,231,.35)" strokeWidth={4} />
        </g>
      </svg>

      {plato(-1, String(A.texto || ''), `${d.prefijo || ''}${va}${d.sufijo || ''}`, kA, !ganaB)}
      {plato(1, String(B.texto || ''), `${d.prefijo || ''}${vb}${d.sufijo || ''}`, kB, ganaB)}

      {d.titulo ? (
        <div style={{position: 'absolute', left: 90, right: 90, top: top + MASTIL + 302, textAlign: 'center',
          fontFamily: OUTFIT, fontWeight: 900, fontSize: String(d.titulo).length > 28 ? 48 : 58, lineHeight: 1.06,
          letterSpacing: '-0.03em', color: pal.tinta, textShadow: '0 10px 40px rgba(0,0,0,.8)',
          opacity: clamp(sp(t, tB + 0.6, RESORTES.carta) * 1.5)}}>
          {String(d.titulo)}
        </div>
      ) : null}
      <Chispas t0={tB + 0.4} x={CX + (ganaB ? BRAZO : -BRAZO)} y={top + MASTIL + 60} n={18} semilla="bal" fuerza={680} />
    </div>
  );
};

// Podio (top 3) — pantalla completa. Tres bloques con volumen de verdad (cara de arriba y costado en 3D) que suben en
// orden, del tercero al primero; el primero se corona con el color de tu marca y su chispazo.
import React from 'react';
import {MONO, OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Chispas, Cifra, Escribir} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const AN = 268, GAP = 26, ORDEN = [1, 0, 2];               // en pantalla: 2º · 1º · 3º

export const Podio: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d = p.datos || {};
  const puestos: [string, number][] = (d.puestos || d.items || []).slice(0, 3);
  const tm: number[] = p.marcas || [];
  const {op, dy, sale} = usePresenciaGrupo();
  const base = Math.round(Hd * 0.64);
  const maxAlto = Math.round(Hd * 0.2);
  const max = Math.max(...puestos.map(([, v]) => v), 1);
  const alturas = [1, 0.78, 0.6];
  if (op <= 0.001 || !puestos.length) return null;
  const x0 = 540 - (puestos.length * AN + (puestos.length - 1) * GAP) / 2;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op, transform: `translateY(${dy}px)`,
      filter: sale > 0.02 ? `blur(${(sale * 10).toFixed(1)}px)` : undefined}}>
      <div style={{position: 'absolute', left: 80, right: 80, top: base - maxAlto - 260, textAlign: 'center', fontFamily: MONO, fontWeight: 500,
        fontSize: 27, letterSpacing: '0.18em', textTransform: 'uppercase', color: pal.tinta2, whiteSpace: 'nowrap'}}>
        <Escribir texto={String(d.titulo || '')} t0={p.t0 + 0.45} velocidad={1.3} />
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, perspective: 1600, perspectiveOrigin: '50% 62%'}}>
        {ORDEN.filter((i) => i < puestos.length).map((i, col) => {
          const [nombre, valor] = puestos[i];
          const ti = tm[i] != null ? tm[i] : p.t0 + 0.9 + (2 - i) * 0.8;
          const k = sp(t, ti, {damping: 13, stiffness: 95, mass: 1});
          const alto = maxAlto * alturas[i] * (0.35 + 0.65 * (valor / max));
          const x = x0 + col * (AN + GAP);
          const primero = i === 0;
          const h = alto * k;
          return (
            <div key={i} style={{position: 'absolute', left: x, top: base - h, width: AN, height: Math.max(2, h), transformStyle: 'preserve-3d',
              transform: 'rotateX(16deg) rotateY(-12deg)', opacity: clamp(k * 2)}}>
              {/* costado (volumen) */}
              <div style={{position: 'absolute', left: -22, top: 14, width: 26, height: '100%', transform: 'skewY(-14deg)',
                background: primero ? `linear-gradient(180deg, ${pal.hondo}, rgba(20,12,16,.9))` : 'linear-gradient(180deg, rgba(90,78,86,.75), rgba(18,12,15,.85))'}} />
              {/* cara */}
              <div style={{position: 'absolute', inset: 0, borderRadius: '12px 12px 4px 4px', overflow: 'hidden',
                background: primero ? `linear-gradient(180deg, ${pal.claro} 0%, ${pal.acento} 55%, ${pal.hondo} 100%)` : 'linear-gradient(180deg, rgba(244,236,231,.42), rgba(244,236,231,.16))',
                boxShadow: primero ? `0 0 70px ${pal.a(0.5)}, inset 0 2px 0 rgba(255,255,255,.45)` : 'inset 0 2px 0 rgba(255,255,255,.35), inset 0 0 0 1px rgba(255,255,255,.08)'}}>
                {primero ? <Brillo t0={ti + 0.5} w={AN} h={Math.max(40, h)} dur={0.9} fuerza={1.6} /> : null}
              </div>
              {/* tapa de arriba */}
              <div style={{position: 'absolute', left: -22, right: 0, top: -16, height: 26, transform: 'skewX(-40deg)',
                background: primero ? pal.claro : 'rgba(244,236,231,.55)', borderRadius: 4, opacity: 0.9}} />
              {/* puesto */}
              <div style={{position: 'absolute', left: 0, right: 0, top: 22, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900,
                fontSize: primero ? 76 : 60, color: primero ? pal.sobre : 'rgba(22,14,18,.75)', transform: 'translateZ(10px)'}}>
                {i + 1}
              </div>
              {/* valor y nombre */}
              <div style={{position: 'absolute', left: -30, right: -30, top: -96, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 900,
                fontSize: 58, letterSpacing: '-0.03em', color: primero ? pal.acento : pal.tinta, whiteSpace: 'nowrap',
                textShadow: primero ? `0 0 34px ${pal.a(0.5)}` : '0 8px 26px rgba(0,0,0,.6)', opacity: clamp(k * 3)}}>
                <Cifra texto={`${Math.round(valor)}${d.sufijo != null ? String(d.sufijo) : '%'}`} t0={ti} dur={0.8} />
              </div>
              <div style={{position: 'absolute', left: -34, right: -34, top: `calc(100% + 22px)`, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 800,
                fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.01em', color: pal.tinta, opacity: clamp(sp(t, ti + 0.2, RESORTES.carta) * 1.4)}}>
                {nombre}
              </div>
            </div>
          );
        })}
      </div>
      <Chispas t0={(tm[0] != null ? tm[0] : p.t0 + 2.5) + 0.35} x={540} y={base - maxAlto * alturas[0]} n={22} semilla="podio" fuerza={820} />
    </div>
  );
};

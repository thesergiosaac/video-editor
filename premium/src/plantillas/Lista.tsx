// Lista que aparece — encima del video. Cada punto entra justo cuando lo dices; la tarjeta crece con él.
// La marca de cada punto se adapta a lo que dices: ✕ si son errores o cosas que evitar, ✓ si son consejos o pasos.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {OUTFIT} from '../tema';
import {EASE, RESORTES, clamp, giro, rampa, sp, useG, useT} from '../lib/anim';
import {Letras, Tambor, Tarjeta} from '../lib/Piezas';

const X0 = 86, Y0 = 130, ANCHO = 908, FILA0 = 190, PASO = 80;
const NEGATIVO = /error|equivoc|fall|mito|mal[oa]?s?\b|peor|evita|no hag|nunca|problema|riesgo|pecad|trampa|culpa|razones por las que no/i;
const POSITIVO = /consejo|clave|tip|paso|forma|manera|secreto|beneficio|ventaja|regla|h[aá]bito|idea|herramienta|app|truco|estrategia|cosas que s[ií]/i;

const CRUZ_ARO = 'M 22 2 A 20 20 0 1 1 22 42 A 20 20 0 1 1 22 2';
const CRUZ_1 = 'M 15 15 L 29 29', CRUZ_2 = 'M 29 15 L 15 29';
const CHEQUE = 'M 12 23 L 19 30 L 32 15';

const Fila: React.FC<{i: number; texto: string; ti: number; siguiente?: number; juntos: number; marca: 'x' | 'v' | null}> = ({i, texto, ti, siguiente, juntos, marca}) => {
  const t = useT();
  const {pal} = useG();
  const r = sp(t, ti - 0.03, {damping: 13, stiffness: 125, mass: 0.8});
  const b = sp(t, ti + 0.07, RESORTES.pop);
  const aro = rampa(t, ti + 0.2, ti + 0.6, EASE.llega);
  const c1 = rampa(t, ti + 0.33, ti + 0.53, EASE.llega);
  const c2 = rampa(t, ti + 0.47, ti + 0.67, EASE.llega);
  const atenuar = siguiente != null ? rampa(t, siguiente - 0.03, siguiente + 0.27) * (1 - rampa(t, juntos, juntos + 0.4)) : 0;
  const tam = texto.length > 24 ? 38 : 44;
  return (
    <div style={{position: 'absolute', left: 44, right: 44, top: FILA0 + i * PASO, height: 72, display: 'flex', alignItems: 'center', gap: 24,
      opacity: clamp(r * 1.6) * (1 - 0.55 * atenuar), transform: `perspective(900px) translateX(${(1 - r) * -80}px) rotateY(${(1 - r) * -38}deg)`, transformOrigin: '0% 50%'}}>
      <div style={{flex: 'none', width: 54, height: 54, borderRadius: 99, display: 'grid', placeItems: 'center', background: `linear-gradient(180deg, ${pal.claro}, ${pal.acento})`,
        color: pal.sobre, fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, transform: `scale(${b}) rotate(${(1 - b) * -120}deg)`,
        boxShadow: `0 8px 22px -6px ${pal.a(0.7)}, inset 0 2px 0 rgba(255,255,255,.35)`}}>
        {i + 1}
      </div>
      <div style={{flex: 1, fontFamily: OUTFIT, fontWeight: 800, fontSize: tam, letterSpacing: '-0.015em', color: pal.tinta, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
        {texto}
      </div>
      {marca ? (
        <svg width={44} height={44} style={{flex: 'none', overflow: 'visible'}}>
          <path d={CRUZ_ARO} fill="none" stroke={marca === 'v' ? pal.a(0.5) : 'rgba(244,236,231,.22)'} strokeWidth={2.5} {...evolvePath(aro, CRUZ_ARO)} />
          {marca === 'x' ? (
            <>
              <path d={CRUZ_1} fill="none" stroke="rgba(244,236,231,.8)" strokeWidth={4} strokeLinecap="round" {...evolvePath(c1, CRUZ_1)} opacity={c1 > 0 ? 1 : 0} />
              <path d={CRUZ_2} fill="none" stroke="rgba(244,236,231,.8)" strokeWidth={4} strokeLinecap="round" {...evolvePath(c2, CRUZ_2)} opacity={c2 > 0 ? 1 : 0} />
            </>
          ) : (
            <path d={CHEQUE} fill="none" stroke={pal.acento} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" {...evolvePath(c1, CHEQUE)} opacity={c1 > 0 ? 1 : 0} />
          )}
        </svg>
      ) : null}
    </div>
  );
};

export const Lista: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d = p.datos;
  const items: string[] = d.items;
  const n = items.length;
  const tm: number[] = p.marcas;
  const ENTRA = p.t0, SALE = p.t1 - 0.5;
  const juntos = Math.max(tm[n - 1] + 0.9, SALE - 0.95);
  const marca = NEGATIVO.test(d.titulo || '') ? 'x' : POSITIVO.test(d.titulo || '') ? 'v' : null;
  const alto = (tt: number) => 212 + PASO * tm.reduce((acc, ti) => acc + sp(tt, ti - 0.17, RESORTES.carta), 0);
  const tamTit = String(d.titulo || '').length > 22 ? 46 : 58;
  const num = giro(t, ENTRA + 0.07, 0.67, 10 + n);
  const linea = rampa(t, ENTRA + 0.4, ENTRA + 1.07, EASE.llega);
  const DIV = `M 44 0 L ${ANCHO - 44} 0`;
  const foco = sp(t, tm[0] - 0.03, RESORTES.carta) * (1 - rampa(t, juntos, juntos + 0.4));
  const yFoco = FILA0 + PASO * tm.slice(1).reduce((acc, ti) => acc + sp(t, ti - 0.03, RESORTES.carta), 0);
  return (
    <Tarjeta x={X0} y={Y0} w={ANCHO} h={alto} hMax={212 + PASO * n} entra={ENTRA} sale={SALE} semilla="lista" brillos={[juntos + 0.13]}>
      <div style={{position: 'absolute', left: 44, top: 14, right: 44, fontFamily: OUTFIT, fontWeight: 900, lineHeight: 1.2, whiteSpace: 'nowrap', color: pal.tinta}}>
        <span style={{fontSize: 128, color: pal.acento, letterSpacing: '-0.04em', textShadow: `0 0 40px ${pal.a(0.35)}`}}>
          <Tambor pos={num} final={n} />
        </span>
        <span style={{fontSize: tamTit, letterSpacing: '-0.025em', wordSpacing: '0.1em', marginLeft: 20}}>
          <Letras texto={d.titulo || ''} t0={ENTRA + 0.2} paso={0.8 / 30} subir={40} />
        </span>
      </div>
      <svg width={ANCHO} height={4} style={{position: 'absolute', left: 0, top: 170, overflow: 'visible'}}>
        <path d={DIV} stroke="rgba(244,236,231,.14)" strokeWidth={2} strokeLinecap="round" {...evolvePath(linea, DIV)} />
      </svg>
      <div style={{position: 'absolute', left: 0, top: 0, width: ANCHO, height: alto(t), overflow: 'hidden', borderRadius: 54}}>
        {foco > 0.01 ? (
          <div style={{position: 'absolute', left: 22, right: 22, top: yFoco - 2, height: 76, borderRadius: 26, opacity: clamp(foco),
            background: 'linear-gradient(90deg, rgba(255,255,255,.075), rgba(255,255,255,.025))', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)'}}>
            <div style={{position: 'absolute', left: -1, top: 20, width: 5, height: 36, borderRadius: 9, background: pal.acento, boxShadow: `0 0 14px ${pal.a(0.9)}`}} />
          </div>
        ) : null}
        {items.map((it, i) => (
          <Fila key={i} i={i} texto={it} ti={tm[i]} siguiente={tm[i + 1]} juntos={juntos} marca={marca} />
        ))}
      </div>
    </Tarjeta>
  );
};

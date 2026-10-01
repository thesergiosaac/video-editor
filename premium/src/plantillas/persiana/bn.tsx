// «Blanco y negro + un solo color» (2-oct-2026): el cronómetro neón del Día 2 vuelto pieza de Cherry. Mientras la persona dice
// EL dato que no se puede olvidar, el video pasa a blanco y negro (lo hace el ensamblador: forma «bn», graficos.js) y lo único
// con color es el dato: el número contando dentro de un anillo que se llena, con su etiqueta, y una nota escrita a mano que
// se resalta con marcador. Todo va ARRIBA de la cabeza: nada cruza la cara. Refs. de Sergio: vanogre, hossein. El brillo NUNCA es del color de la letra (regla de Sergio).
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {loadFont as cargarCaveat} from '@remotion/google-fonts/Caveat';
import {useG, useT} from '../../lib/anim';
import {ANTON, INTER} from '../../tema';

const MANO = cargarCaveat('normal', {weights: ['700'], subsets: ['latin']}).fontFamily;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const outCubic = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const outBack = (k: number) => { const c = 1.70158, x = clamp(k) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

/* «30 min» → cuenta 0→30 y deja « min»; «2:30» → cuenta los segundos 0:00→2:30; un texto sin número se queda quieto */
const valorEn = (v: string, k: number) => {
  const reloj = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (reloj) {
    const s = Math.round((Number(reloj[1]) * 60 + Number(reloj[2])) * k);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  const m = /^([\d.,]+)(.*)$/.exec(v);
  if (!m) return v;
  const crudo = m[1], dec = /[.,]\d+$/.test(crudo) && !/^\d{1,3}([.,]\d{3})+$/.test(crudo) ? (crudo.split(/[.,]/).pop() || '').length : 0;
  const n = Number(crudo.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  if (!isFinite(n)) return v;
  const x = n * k;
  const txt = dec ? x.toFixed(dec).replace('.', ',') : Math.round(x).toLocaleString('es-CO').replace(/,/g, '.');
  return txt + m[2];
};

export const PeBn: React.FC = () => {
  const t = useT();
  const {p, pal} = useG();
  const d: any = p.datos || {};
  const m: number[] = (Array.isArray(p.marcas) ? p.marcas : []).map(Number);
  const tt = t - p.t0, dura = p.t1 - p.t0;
  const o = clamp(tt / 0.3) * (1 - clamp((tt - (dura - 0.25)) / 0.25));
  if (o <= 0) return null;
  const a = 0.1;                                                    // el anillo entra apenas empieza el blanco y negro
  const avance = outCubic(clamp((tt - a) / 1.6));
  const valor = valorEn(String(d.valor || ''), avance);
  const tn = (m.length > 1 && m[1] - p.t0 > 0.6 && m[1] - p.t0 < dura - 0.8 ? m[1] - p.t0 : Math.min(1.4, dura - 1));
  const nota = outBack(clamp((tt - tn) / 0.4)), marcador = outCubic(clamp((tt - tn - 0.25) / 0.45));
  const R = 210, L = 2 * Math.PI * R;
  const acento = pal.acento;
  const tam = Math.min(150, 360 / Math.max(1, valor.length * 0.58));
  return (
    <AbsoluteFill style={{opacity: o}}>
      <div style={{position: 'absolute', left: 540 - 260, top: 90, width: 520, height: 520, transform: `scale(${lerp(0.85, 1, outBack(clamp((tt - a) / 0.4)))})`}}>
        {/* el brillo es blanco tenue, nunca del color del dato */}
        <svg width={520} height={520} viewBox="0 0 520 520" style={{filter: 'drop-shadow(0 0 16px rgba(255,255,255,.35))'}}>
          <circle cx={260} cy={260} r={R} stroke={pal.a(0.18)} strokeWidth={18} fill="rgba(0,0,0,.35)" />
          <circle cx={260} cy={260} r={R} stroke={acento} strokeWidth={18} fill="none" strokeLinecap="round"
            strokeDasharray={L} strokeDashoffset={L * (1 - avance)} transform="rotate(-90 260 260)" />
        </svg>
        <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
          <div style={{textAlign: 'center', maxWidth: 380}}>
            <div style={{fontFamily: ANTON, fontSize: tam, color: acento, lineHeight: 1, whiteSpace: 'nowrap', textShadow: '0 0 22px rgba(255,255,255,.45)'}}>{valor}</div>
            {d.etiqueta ? <div style={{fontFamily: INTER, fontWeight: 800, fontSize: 21, letterSpacing: '.12em', color: '#fff', marginTop: 8, textTransform: 'uppercase'}}>{String(d.etiqueta)}</div> : null}
          </div>
        </div>
      </div>
      {d.nota && nota > 0 ? (
        <div style={{position: 'absolute', left: 540, top: 575, transform: `translateX(-50%) rotate(-6deg) scale(${nota})`, transformOrigin: '50% 50%'}}>
          <div style={{position: 'absolute', left: -14, right: -14, top: 52, height: 46, transformOrigin: '0 50%', transform: `scaleX(${marcador})`, background: acento, borderRadius: 10, opacity: 0.85}} />
          <div style={{position: 'relative', fontFamily: MANO, fontWeight: 700, fontSize: 84, color: '#fff', whiteSpace: 'nowrap', textShadow: '0 4px 10px rgba(0,0,0,.5)'}}>{String(d.nota)}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

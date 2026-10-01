// El papel de la placa —color, luz de ventana y grano— dibujado UNA vez como imagen. En el servidor,
// desenfocar esto en cada cuadro costaba más que todo lo demás junto.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {paletaDe} from './tema';

const AN = 1080, AL = 1920;
type F = {base: string; grano: number; luz: number; mezcla: 'multiply' | 'screen'};
export const FONDOS_IMG: Record<string, (ac: string) => F> = {
  crema: () => ({base: 'linear-gradient(160deg,#F5F1E9,#E9E3D8)', grano: 0.10, luz: 1, mezcla: 'multiply'}),
  tinta: () => ({base: 'linear-gradient(160deg,#141013,#080507)', grano: 0.14, luz: 0.85, mezcla: 'screen'}),
  marca: (ac) => ({base: `linear-gradient(155deg, ${ac}, ${osc(ac)})`, grano: 0.09, luz: 1, mezcla: 'multiply'}),
  papel: () => ({base: 'linear-gradient(150deg,#EFE7D9,#DFD4C2)', grano: 0.22, luz: 1, mezcla: 'multiply'}),
};
function osc(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * 0.45).toString(16).padStart(2, '0')).join('');
}
const TINTE: Record<string, string> = {multiply: '#3E352C', screen: '#B9B6C4'};

export const FondoPlaca: React.FC<{fondo?: string; color?: string}> = ({fondo = 'crema', color = 'cherry'}) => {
  const pal = paletaDe(color);
  const f = (FONDOS_IMG[fondo] || FONDOS_IMG.crema)(pal.acento);
  return (
    <AbsoluteFill style={{background: f.base, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, mixBlendMode: f.mezcla, opacity: f.luz}}>
        <svg width={AN} height={AL}>
          <defs>
            <filter id="fp-pen" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="62" /></filter>
            <radialGradient id="fp-des" cx="0.42" cy="0.12" r="0.95">
              <stop offset="0" stopColor="#fff" stopOpacity="1" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="fp-mask"><rect width={AN} height={AL} fill="url(#fp-des)" /></mask>
          </defs>
          <g filter="url(#fp-pen)" mask="url(#fp-mask)" fill={TINTE[f.mezcla]}>
            <g transform={`rotate(-14 540 ${Math.round(AL * 0.2)})`}>
              <rect x={-40} y={Math.round(AL * -0.06)} width={450} height={Math.round(AL * 0.44)} rx={130} opacity={0.42} />
              <rect x={880} y={Math.round(AL * -0.04)} width={410} height={Math.round(AL * 0.40)} rx={130} opacity={0.40} />
            </g>
            <ellipse cx={240} cy={Math.round(AL * 0.045)} rx={210} ry={128} opacity={0.52} />
            <ellipse cx={486} cy={Math.round(AL * 0.135)} rx={142} ry={86} opacity={0.38} />
            <ellipse cx={1062} cy={Math.round(AL * 0.085)} rx={228} ry={146} opacity={0.50} />
            <ellipse cx={892} cy={Math.round(AL * 0.215)} rx={128} ry={74} opacity={0.32} />
            <ellipse cx={1290} cy={Math.round(AL * 0.285)} rx={158} ry={104} opacity={0.30} />
            <ellipse cx={120} cy={Math.round(AL * 0.255)} rx={118} ry={82} opacity={0.28} />
            <ellipse cx={700} cy={Math.round(AL * 0.035)} rx={176} ry={70} opacity={0.24} />
          </g>
        </svg>
      </div>
      <svg width={AN} height={AL} style={{position: 'absolute', inset: 0, opacity: f.grano, mixBlendMode: 'overlay'}}>
        <defs>
          <filter id="fp-grano">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#fp-grano)" />
      </svg>
    </AbsoluteFill>
  );
};

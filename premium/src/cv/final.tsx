// (30-oct-2026) Cámara viva — EL VIDEO FINAL. El MISMO dibujo de la vista previa (capas.tsx), como una capa con transparencia de Remotion que
// el ensamblador pone encima de tu video después del color y antes de los subtítulos (camaraviva.js). Una lámina tapa el cuadro entero,
// menos el recuadro de tu video: ahí se abre un hueco y debajo queda tu video, que ffmpeg lleva a ese mismo sitio. Cuando hablas, solo el título.
import React, {useState} from 'react';
import {AbsoluteFill, Composition, continueRender, delayRender, registerRoot, useCurrentFrame, useVideoConfig} from 'remotion';
import {CapaFondo, CapaFrente, Pieza, videoEn} from './capas';
import {PiezaTitulo} from './Titulo';

export type PropsCV = {piezas: Pieza[]; titulos: PiezaTitulo[]; inicio: number; cuadros: number; letras?: {fam: string; peso: number; it?: boolean}[]};

/* las letras de la plantilla de títulos que escogió la persona (en la página ya están cargadas; aquí hay que pedirlas) */
const usarLetras = (letras?: PropsCV['letras']) => {
  const [marca] = useState(() => (letras && letras.length ? delayRender('letras de los títulos', {timeoutInMilliseconds: 25000}) : null));
  useState(() => {
    if (marca == null) return null;
    const fin = () => continueRender(marca);
    const nombres = letras!.map((l) => ({...l, nombre: String(l.fam).replace(/['"]/g, '').split(',')[0].trim()}));
    const familias = nombres.map((l) => `family=${encodeURIComponent(l.nombre).replace(/%20/g, '+')}:ital,wght@${l.it ? 1 : 0},${l.peso}`).join('&');
    const enlace = document.createElement('link');
    enlace.rel = 'stylesheet';
    enlace.href = `https://fonts.googleapis.com/css2?${familias}&display=block`;
    enlace.onerror = fin;
    enlace.onload = () => {
      Promise.all(nombres.map((l) => document.fonts.load(`${l.it ? 'italic ' : ''}${l.peso} 80px "${l.nombre}"`))).then(fin, fin);
    };
    document.head.appendChild(enlace);
    return null;
  });
};

const CapaCV: React.FC<PropsCV> = ({piezas, titulos, inicio, letras}) => {
  usarLetras(letras);
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = inicio + frame / fps, d = videoEn(t, piezas);
  if (d === 'camara' || d === null) return <AbsoluteFill><CapaFrente t={t} piezas={piezas} titulos={titulos} /></AbsoluteFill>;
  // el recuadro de tu video: un hueco de esquinas redondas en el fondo de la lámina
  const r = d.radio, l = d.left, a = d.top, w = d.width, h = d.height, f = (n: number) => n.toFixed(2);
  const hueco = `M0 0H1080V1920H0Z M${f(l + r)} ${f(a)}H${f(l + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(l + w)} ${f(a + r)}V${f(a + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(l + w - r)} ${f(a + h)}H${f(l + r)}A${f(r)} ${f(r)} 0 0 1 ${f(l)} ${f(a + h - r)}V${f(a + r)}A${f(r)} ${f(r)} 0 0 1 ${f(l + r)} ${f(a)}Z`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{clipPath: `path(evenodd, "${hueco}")`}}><CapaFondo t={t} piezas={piezas} /></AbsoluteFill>
      <CapaFrente t={t} piezas={piezas} titulos={titulos} />
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <Composition id="CamaraViva" component={CapaCV as any} width={1080} height={1920} fps={30} durationInFrames={30}
    defaultProps={{piezas: [], titulos: [], inicio: 0, cuadros: 30} as any}
    calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Number((props as any).cuadros) || 1)})} />
);
registerRoot(Root);

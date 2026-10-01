import React from 'react';
import {Composition} from 'remotion';
import {Grafico, PropsGrafico, medidas} from './Grafico';
import {EJEMPLOS} from './ejemplos';

// Una sola composición: «Grafico». Las medidas salen de la pieza (calculateMetadata).
// Las demás son solo para mirarlas en el estudio de Remotion con datos de ejemplo.
export const Root: React.FC = () => (
  <>
    <Composition id="FondoPlaca" lazyComponent={(() => import('./FondoPlaca').then((m) => ({default: m.FondoPlaca}))) as any}
      defaultProps={{fondo: 'crema', color: 'cherry'} as any} width={1080} height={1920} fps={30} durationInFrames={30} />
    <Composition id="UnObjeto" lazyComponent={(() => import('./UnObjeto').then((m) => ({default: m.UnObjeto}))) as any}
      defaultProps={{nombre: 'bombilla', color: 'cherry', tono: 'claro'} as any} width={1024} height={1024} fps={30} durationInFrames={30} />
    <Composition id="Prueba3D" lazyComponent={(() => import('./Prueba3D').then((m) => ({default: m.Prueba3D}))) as any}
      defaultProps={{color: 'cherry'} as any} width={1080} height={1920} fps={30} durationInFrames={60} />
    <Composition id="Grafico" component={Grafico as any} defaultProps={EJEMPLOS.numero as any} width={1080} height={1920} fps={30} durationInFrames={150}
      calculateMetadata={({props}) => medidas(props as unknown as PropsGrafico)} />
    {Object.keys(EJEMPLOS).map((k) => (
      <Composition key={k} id={'Ejemplo-' + k} component={Grafico as any} defaultProps={(EJEMPLOS as any)[k]} width={1080} height={1920} fps={30} durationInFrames={150}
        calculateMetadata={({props}) => medidas(props as unknown as PropsGrafico)} />
    ))}
  </>
);

// Motion blur real (CameraMotionBlur) solo en los momentos de movimiento rápido (ventanas en SEGUNDOS del video).
// En la vista del celular (vista) no se usa: allá se ve a tiempo real y el desenfoque de movimiento pesa mucho.
import React, {createContext, useContext} from 'react';
import {AbsoluteFill} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {useG, useT} from './anim';

const DentroDeBlur = createContext(false);
// En la nube cada muestra vuelve a dibujar todo el gráfico: con la mitad de las muestras de la propuesta se ve casi igual
// y cada cuadro tarda la mitad (medido en Lambda el 19-sep: 4,4 s por cuadro con 12 muestras, 0,65 s sin desenfoque).
const FACTOR_MUESTRAS = 0.5;

export const Desenfoque: React.FC<{
  ventanas: [number, number][];
  muestras?: number;
  obturador?: number;
  escenario: {left: number; top: number; width: number; height: number};
  children: React.ReactNode;
}> = ({ventanas, muestras = 8, obturador = 210, escenario, children}) => {
  const dentro = useContext(DentroDeBlur);
  const t = useT();
  const {vista} = useG();
  const activo = !vista && !dentro && ventanas.some(([a, b]) => t >= a && t <= b);
  return (
    <div style={{position: 'absolute', ...escenario}}>
      {activo ? (
        <DentroDeBlur.Provider value>
          <CameraMotionBlur samples={Math.max(3, Math.round(muestras * FACTOR_MUESTRAS))} shutterAngle={obturador}>
            {children}
          </CameraMotionBlur>
        </DentroDeBlur.Provider>
      ) : (
        <AbsoluteFill>{children}</AbsoluteFill>
      )}
    </div>
  );
};

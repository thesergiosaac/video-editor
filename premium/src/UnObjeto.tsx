// Un objeto 3D CON su sombra ya dibujada, sobre fondo transparente. Se renderiza una vez y se reutiliza:
// calcular esa sombra en cada cuadro costaba 3,4 segundos, y así cuesta cero.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Escena3D} from './lib/Tres';
import {paletaDe} from './tema';

const LIENZO = 1024;
const TONOS: Record<string, string> = {claro: '52,38,30', oscuro: '0,0,0'};

export const UnObjeto: React.FC<{nombre?: string; color?: string; tono?: string}> =
  ({nombre = 'bombilla', color = 'cherry', tono = 'claro'}) => (
    <AbsoluteFill style={{background: 'transparent'}}>
      {/* el objeto va arriba a la izquierda para que quepa la estela, que cae abajo a la derecha */}
      <Escena3D ancho={LIENZO} alto={LIENZO} puestos={[{nombre, x: -95, y: -95, escala: 1.6, giro: 0}]}
        pal={paletaDe(color)} camX={0} camY={0} camZ={1} giro={0} sombra={TONOS[tono] || TONOS.claro} />
    </AbsoluteFill>
  );

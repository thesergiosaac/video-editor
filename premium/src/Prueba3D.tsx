// Banco de pruebas: los objetos 3D en fila sobre el papel, para mirarlos de cerca
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {NOMBRES_3D, Objeto3D} from './lib/Tres';
import {paletaDe} from './tema';

export const Prueba3D: React.FC<{color?: string; cual?: string}> = ({color = 'cherry', cual}) => {
  const pal = paletaDe(color);
  const lista = cual ? [cual] : NOMBRES_3D;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(160deg,#F5F1E9,#E9E3D8)', display: 'flex',
      flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 0}}>
      {lista.map((n) => (
        <div key={n} style={{width: 360, height: 360, display: 'grid', placeItems: 'center'}}>
          <Objeto3D nombre={n} tam={340} pal={pal} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

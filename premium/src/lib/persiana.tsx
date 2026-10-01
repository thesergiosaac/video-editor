import React from 'react';
import { AbsoluteFill } from 'remotion';

// ⭐ RECURSO APROBADO (Sergio, 29-sep): «Sombra de persiana» — luz de ventana cayendo sobre un fondo de color.
// Salió en la tarjeta de color (réplica de vanogre.edits). Sirve sobre cualquier fondo liso (tarjetas, fondos de gráficos).
// Cómo funciona: franjas diagonales oscuras (repeating-linear-gradient) muy desenfocadas (blur), agrandadas y corridas
// hacia arriba, con una máscara que las deja fuertes arriba a la derecha y las borra hacia abajo. Se desliza despacio.
//
// t        → segundos desde que aparece el fondo (para el deslizamiento)
// fuerza   → oscuridad de las franjas (0,5 = la aprobada)
// angulo   → inclinación de las franjas (-68° = la aprobada)
// tinte    → color de la sombra (azul casi negro = la aprobada; sobre fondos cálidos, un café oscuro)
export const SombraPersiana: React.FC<{ t: number; fuerza?: number; angulo?: number; tinte?: string; desenfoque?: number }> = ({
  t, fuerza = 0.5, angulo = -68, tinte = '0,0,25', desenfoque = 30,
}) => {
  const mascara = 'linear-gradient(195deg, #000 0%, rgba(0,0,0,.55) 38%, transparent 70%)';
  return (
    <AbsoluteFill style={{
      background: `repeating-linear-gradient(${angulo}deg, rgba(${tinte},${fuerza}) 0 95px, rgba(${tinte},0) 95px 230px)`,
      filter: `blur(${desenfoque}px)`,
      transform: `translate(${-60 + t * 14}px, -140px) scale(1.3)`,
      WebkitMaskImage: mascara, maskImage: mascara,
    }} />
  );
};

// La estela: la sombra larga que proyectan las letras y los objetos sobre la pared. Sin three: esto se usa
// en todos los gráficos y no debe arrastrar la librería 3D al paquete que se manda al servidor.
export function estelaObjeto(c: string, tam: number) {
  return [[0.012, 0.014, 0.44], [0.038, 0.05, 0.37], [0.090, 0.11, 0.30],
          [0.175, 0.18, 0.21], [0.300, 0.31, 0.15], [0.470, 0.50, 0.10]]
    .map(([d, b, o]) => `drop-shadow(${Math.round(d * tam)}px ${Math.round(d * tam)}px ${Math.max(2, Math.round(b * tam))}px rgba(${c},${o}))`)
    .join(' ');
}

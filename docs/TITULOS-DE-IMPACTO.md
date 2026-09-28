# Títulos de impacto fijados desde el Guion

Con «solo frases de impacto» (Texto → ¿Dónde usar la plantilla?), Cherry escoge qué frases salen como título grande.
Desde el 27-sep-2026 se puede corregir título por título en la tarjeta **Guion**:

- **«Resaltada ×»**: al tocarla, esa línea queda sin título y sale como subtítulo normal («a tu gusto»).
- **«Sin título»** (tachada): al tocarla, el título vuelve.
- **«Mover título»**: sube o baja SOLO ese título. Los demás siguen a la altura de Texto → Tamaño y posición.
  «Como los demás» le quita su altura propia.

Con la plantilla en todo el video no hay títulos aparte: la marca se ve, pero no se toca.

## Cómo viaja

`guionFijos.titulos = [{ desde, hasta, tipo: 'si' | 'no', y? }]`, por número de palabra (la línea exacta del Guion).
`y` usa los mismos puntos que `subtitulos.y` (−45 arriba … 45 abajo, relativo a la altura de la plantilla) y, en esa
frase, reemplaza la altura de todos.

- A una frase le toca el fijado que tiene la mayoría de sus palabras. La regla está en dos sitios que deben dar lo
  mismo: `js/state.js › C.aplicarTitulos` y `servidor/orchestrate.ts › ponerTitulos`.
- La página lo manda en `subtitulos.titulos`, al generar y en el camino rápido. En el camino rápido también van las
  frases ya aplicadas. Orchestrate (v241) lo aplica en los tres caminos (completo, desde la base, rápido) y lo guarda
  en `subtitle_config.titulos`. Al abrir el video, `C.restaurarDeRender` lo devuelve al Guion.
- La altura de un video anterior no se hereda: sin fijado, la frase va con la de todos.
- **carrete-layer2** (Lambda, 28-sep-2026) conserva `y` al repasar las frases y la usa en la página de esa frase.
  `js/frases-servidor.js` es la copia del repaso de esa Lambda: se regenera, no se edita a mano.
- Vista en vivo: `cortesvivo.js › subsActuales` aplica los fijados. `subtitulos.js › paginasVivo` pasa `vista.dy` y
  `armarPagina` pone esa altura solo en ese título.

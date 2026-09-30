# Familias de gráficos y «La persiana» (29-sep-2026)

Sergio: *«que no haya un solo tipo de gráficos… escogemos entre familias de gráficos así como escogemos las plantillas
de los subtítulos… y que haya la opción de mezclar familias»*. La primera familia nueva es **La persiana**, diseñada y
aprobada en el taller (`Downloads\Cherry Taller\tarjetas\persiana\IMPLEMENTAR-LA-PERSIANA.md`).

## Las familias

| Familia | Tipos | Qué es |
|---|---|---|
| `vidrio` | los 19 de siempre (`numero` … `claves`) | tarjetas de vidrio encima del video |
| `persiana` | `pe_tarjeta`, `pe_lista`, `pe_cifra`, `pe_vs` (la IA) · `pe_clipv`, `pe_cliph`, `pe_foto` (material de la persona) | corte seco a una tarjeta a pantalla completa con la sombra de una persiana; la palabra cae con estela y se asienta |

- `subtitle_config.graficos` lleva `familias` (una o varias) y `fondo` (`marca` · `blanco` · `papel` · `alterna`).
- `graficos.js › familiaDe(tipo)`: todo lo que empieza por `pe_` es de la persiana. `elegir()` salta las familias que no
  están puestas y, **con varias**, a igual fuerza pone primero la familia que menos lleva (así salen las dos).
- `ponerFondos()` pone el fondo de cada tarjeta (el mismo para todas o alternando marca → blanco → papel).
- La tarjeta de la persiana tiene forma **`tarjeta`**: tapa el cuadro entero, el video no se mueve, entra en la
  palabra marcada (`marcas[0] − 0,04 s`) y dura lo de la pieza (`DURA_PE`, 2,1 a 2,5 s; la lista, hasta su última
  palabra, tope 4,5 s).

## La IA (`servidor/biblioteca.ts`)

- Cada familia se marca **aparte** con su propio prompt (`FAMILIAS_GRAFICOS`), en paralelo. `SISTEMA_PERSIANA` no busca
  datos sino la palabra que pesa en la frase; si hay cifra, lista o dos cosas opuestas, escoge esa pieza.
- `renders.graficos.familias` dice qué familias están marcadas. **`MOTOR_GRAFICOS` sigue en 4 a propósito**: con solo
  vidrio no se vuelve a marcar nada.
- Acción `marcar-familias` (la página, al escoger una familia que el video no tiene): marca SOLO la que falta y la suma.
- `regenerar-graficos` recibe `familias`: regenera las puestas y guarda lo de las demás.
- `orchestrate.ts › graficosAlDia` (v246): antes de F2 marca lo que falte (motor viejo o familia nueva).
- Respaldo en `graficos.js`: una `pe_tarjeta` sin palabra grande usa la palabra que se dice en la marca.

## El ensamblador

- `premium.js`: forma `tarjeta` = una capa `todo` sin vidrio.
- `pedazos.js` y la pasada única: las tarjetas van **después del `ass`** → mientras está la tarjeta, los subtítulos no se ven.
- Si sale alguna tarjeta, todo va en premium (solo Remotion la dibuja). Si Remotion falla, el clásico sale **sin** las
  tarjetas (`sinTarjetas`).
- Sitio de Remotion: `cherry-graficos-premium-v4` (variable `REMOTION_SITIO`). Costo medido: USD 0,006 por tarjeta, ~34 s.

## Remotion (`scratchpad\premium`, fuera del repo)

`src/plantillas/persiana/base.tsx` (estilos derivados del color de marca: si la marca es clara, la letra se oscurece),
`piezas.tsx` (7 piezas), `lib/persiana.tsx` (la sombra aprobada). `js/premium-vista.js` se rearma con esbuild (IIFE, sin
`--global-name`). Publicar el sitio: `node publicar_sitio.mjs <nombre>` con las llaves de Remotion en el entorno.

## La página

- Gráficos: galería de familias (`FAMILIAS_GRAF`, muestras en `assets/graficos/familia-*.mp4`), fondo de la persiana,
  «Estilo del vidrio» y «Detrás de ti» solo si Vidrio está puesta.
- Cada `pe_tarjeta` de la lista trae **«Poner foto o clip»**: crea una pantalla con forma `tarjeta` en su palabra, con su
  palabra grande y su cursiva, y abre el selector de archivo (`pantallas.js › nuevaEn`). Video horizontal → `pe_cliph`,
  vertical → `pe_clipv`, foto → `pe_foto`. Ya puesto, la fila trae «Quitar».
- Guion → Pantalla: forma nueva «En una tarjeta (La persiana)» con palabra grande y cursiva.
- Vista previa: la persiana siempre en premium (`movvivo.js`), por encima de los subtítulos en vivo (`.gr-vivo--tarjeta`).
- Arreglado de paso: la lista de gráficos metía el texto en la columna del minuto (`.ap-item.gr-item`).

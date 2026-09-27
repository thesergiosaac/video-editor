# El color del video

Edición → **Look**. Tres capas, en este orden, dentro de UNA tabla de color (LUT 3D de 33 puntos):

1. **Revelado** (interruptor): mide el material y le quita el velo (negro negro, balance, exposición).
2. **Look**: una receta del catálogo (`CATALOGO` en `js/motor-color.js`) más «Intensidad y ajustes».
3. **Corrección general** (27-sep-2026): exposición, brillo, contraste, luces, sombras, saturación, temperatura y
   tinte, de −100 a +100. Va DESPUÉS del look y no cambia sus valores; sirve también con «Sin look».

## Un solo motor

`js/motor-color.js` es el MISMO archivo en la página y en el ensamblador (la Lambda `carrete-assembler` lleva una
copia en la raíz de su código). Si se cambia aquí, se copia allá. Lo que se ve en el celular es lo que sale.

- Página: `js/components/colorvivo.js` pinta el video con WebGL (tabla 3D + viñeta en el shader).
- Servidor: `revelado.js` del ensamblador escribe el `.cube` y ffmpeg lo aplica con `lut3d`.
- `servidor/orchestrate.ts › limpiarColor` deja pasar SOLO los looks de su lista (`LOOKS`) y las llaves de
  `correccion`. Un look nuevo que no esté en esa lista se pierde en silencio.

Lo que viaja en `color` (lo arma `C.colorCfg()` en `js/state.js`, solo lo que se movió):

```json
{ "revelado": true, "look": "selectivo", "intensidad": 0.8,
  "ajustes": { "dorado": 20 }, "correccion": { "saturacion": 25, "luces": -10 } }
```

## Looks

| id | qué hace |
|---|---|
| `cherry_gold` | luz ámbar, negros ciruela, piel natural |
| `selectivo` | solo se avivan naranjas y cafés (h≈72°), verdes (140°) y fucsias (350°); negros, blancos y grises neutros; la piel va aparte |

## Looks con máscara (`mascara: true`, hoy solo Selectivo)

La piel y la madera tienen el mismo tono (65–87°): un look parejo no las separa. Por eso el look trae dos recetas,
`base` (el fondo) y `persona`, y se mezclan con la **silueta de la persona**:

- **La silueta** es un video en gris junto al video: `<video>_silueta.mp4` (misma carpeta del cubo). Se saca UNA vez
  por video con `carrete-recorte` (el mismo modelo de los gráficos «detrás de ti»), por tramos de 12 s en paralelo,
  a 304×540 (`ancho`/`alto` en el evento de `carrete-recorte`). Lo hace el módulo `silueta.js` del ensamblador.
- **En el video final** el ensamblador aplica el color PRIMERO (antes del movimiento y de las escenas de apoyo): una
  tabla para el fondo, otra para la persona, y la persona encima por su silueta (`alphamerge`). Las escenas de apoyo
  van con la tabla del fondo. La viñeta va donde siempre.
  - Trampa: el ffmpeg de la Lambda (2018) empareja los cuadros del `alphamerge` en ORDEN, no por tiempo. La silueta
    va encima de un lienzo negro de la misma rejilla (overlay sí sincroniza por tiempo) y ese lienzo es la máscara.
    En los pedazos paralelos el lienzo arranca en el cuadro del pedazo (`setpts=PTS+c0`).
  - Si no se pudo recortar, sale con la receta de la persona en todo el cuadro (nunca piel naranja) y queda en el log.
- **En la página** `colorvivo.js` pide la silueta a la Edge Function `color-silueta` (comprueba que el video sea
  de quien lo pide; si no existe, le pide al ensamblador `{ modo: 'silueta', key }` sin esperar) y pregunta a S3
  cada 4 s. La silueta se reproduce escondida al mismo segundo que el video. Mientras llega, la etiqueta del
  celular dice «recortando a la persona…» y va la receta de la persona en todo el cuadro.
  El umbral de la máscara es el mismo del servidor: `(Y − 50) / 150` sobre la Y del video de la silueta.

## Límites

- Una tabla de color no inventa colores que no están en la escena.
- Los clips HDR de 10 bits (iPhone 16 Pro) se reducen a 8 bits en el primer corte; conservar los 10 bits no está hecho.
- El recorte hace que el primer video con Selectivo tarde más en armarse; los siguientes con la misma base reusan
  la silueta.

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

## Igualar tomas (28-sep-2026, fase 1 del color «como DaVinci»)

Un colorista iguala cada toma **por la persona**. Antes el revelado medía el video entero una vez: un clip con luz de
ventana y otro de lámpara recibían la misma corrección. Ahora:

1. **Al subir cada clip** (`carrete-media-processor › medirColorToma`, también `mode: 'medirColor'` para clips ya
   subidos): 8 cuadros chicos de la copia liviana + un cuadro con la silueta de la persona (carrete-recorte, ~1 s). Con
   eso, `motor-color.js › medirToma` guarda en `clips.color_toma`: el negro y el blanco de la toma, sus luces (64
   franjas), cuánto ocupa la persona y su piel (Lab, medida DENTRO de la silueta: la madera tiene el mismo tono).
2. **Al cortar (F1)**, el coordinador junta las medidas de TODAS las tomas del video (`igualarTomas`): la piel objetivo
   del video. Cada toma con persona (≥ 12 % del cuadro) lleva su piel a esa luz (±1 paso) y ese tono (±5 en a/b, solo
   cerca del tono de piel). Las tomas sin persona (manos, pantallas) quedan con la luz de todo el video. Cada trozo se
   corta con su tabla (`prim_i.cube`, 33 puntos) y `segments_json.igualado = true`.
   - Si a un clip le falta la medida, NO se iguala ninguna (se usa el revelado de antes).
   - Con el «Revelado» apagado (`subtitle_config.color.revelado === false`) tampoco.
3. **El ensamblador**, con `segments_json.igualado`, no vuelve a medir el video entero (sería corregir dos veces). El
   look y la corrección general van igual.
4. **La página**: la vista de cortes (antes del primer video) aplica a cada toma su corrección con la MISMA cuenta
   (`cortesvivo.js › primariaActual`, las medidas llegan con `getClips`). Un video ya igualado no se revela otra vez
   (`fondoIgualado`, `BA.datos.igualado`, `RV.datos.igualado`).

`js/motor-color.js` va copiado en `carrete-media-processor` y en `carrete-assembler`: si cambia, se copia a los dos.
Probado con los 17 clips de «Lo que reviso…»: las medidas de la nube son las mismas que las locales y la vista previa da
la misma tabla que el motor (diferencia de 2/255).

## Fondo, piel y ropa (28-sep-2026, zonas)

Sergio: «un controlador para el fondo y otro para la piel… lo que nunca debe cambiar es el borde entre la persona y el
fondo». Edición → «Fondo, piel y ropa»: tres zonas con los 8 controles de la corrección general, encima del look.

- `color.zonas = { fondo: {…}, piel: {…}, ropa: {…} }` (−100..100, solo lo que se movió). La página guarda
  `zf_* / zp_* / zr_*`; orchestrate (v242) las deja pasar.
- **Fondo contra persona:** la silueta del look Selectivo (`silueta.js`). La tabla del fondo lleva la zona «fondo»; la de
  la persona, «piel» y «ropa» (con la receta de persona del look si la tiene, si no con la misma receta).
- **Piel contra ropa:** por el color, suave (`motor-color.js › pesoPiel`: tono de piel con color, ni negro ni blanco). La
  cara, los brazos y las manos son piel; la camiseta blanca, el pelo, la barba y el pantalón, ropa.
- **El borde:** la silueta NATURAL del recorte, encogida 2/360 del ancho y suavizada 3/360 (`filtrosMascara`; la vista
  previa hace lo mismo en el shader). Antes se endurecía y quedaba por fuera del pelo: con las zonas dejaba un halo claro.
  Esto también mejora el borde de Selectivo.
- Sin silueta (si el recorte falla), el video sale sin zonas: no se pueden separar.

## Un color: HSL (28-sep-2026)

Sergio: «seleccionar un color y modificarlo: si hay una planta verde, selecciono verde y ese verde lo puedo cambiar a rojo
o al color que quiera, o subirle o bajarle la saturación, pero solamente de ese color». Y: «en otras aplicaciones, si
cambias un verde a morado queda muy falso, como pintado; que tenga una transición natural entre tonos».

- **Dónde:** en «Corrección general» y en cada zona de «Fondo, piel y ropa», con la pestaña «Un color (HSL)». Ocho colores
  (rojos, naranjas, amarillos, verdes, aguamarinas, azules, morados, magentas) y **«Tu color»**: se escoge tocando el
  video. Cada uno con Tono (hasta media vuelta), Saturación y Luz. Las pistas de los controles muestran a qué color va.
- **Guardado:** `color.hsl = { verde: {tono, sat, luz}, propio: {h, l0, l1, tono, sat, luz} }` y `color.zonas.<zona>.hsl`
  igual (−100..100, solo lo que se movió). La página: `hg_* / hf_* / hp_* / hr_*` (`<prefijo><color>_<control>`).
  orchestrate (v243, `limpiarHsl`) lo deja pasar.
- **Natural** (`motor-color.js › aplicarHsl`): en Lab; el tono no gira a medias en el borde de la banda (se MEZCLA hacia el
  color ya girado), la luz no se toca al girar, y si el color nuevo no cabe en el video baja su intensidad en vez de
  recortarse (`enGamut`). Los casi grises casi no se mueven (subir la saturación de una pared blanca hacía manchas).
- **Va ANTES del look**, como en DaVinci: Cherry Gold vuelve casi café el verde oliva de la planta de Sergio (croma 17 →
  7) y después del look ya no había qué girar. Los controles de luz de las zonas y la corrección general siguen encima.
- **«Tu color»** (`muestraDeColor`): el toque lee un parche de 11×11 (en 720 de ancho), manda el centro y lo que tiene
  color, y guarda el tono del objeto y su rango de LUZ (`l0–l1`). Escoge por tono Y por luz, como el calificador de
  DaVinci: la escalera beige tiene casi el tono de la hoja oliva, pero es mucho más clara. Si se toca la parte más
  apagada de la hoja (del mismo color que la madera), agarra también la madera: para eso está **«Ver qué cambia»** (la
  vista previa enseña en color lo que agarra y en gris lo demás; nunca va al video).
- **Tabla de 64 puntos con HSL** (33 sin HSL): con 33, entre dos puntos de la tabla caben colores de tonos muy distintos
  cerca del gris y al girar uno la mezcla teñía la pared (ΔE 4; con 64, 0,8). 64 es el máximo del ffmpeg de las Lambdas.
  La vista previa muestra la de 33 al instante y la de 64 un momento después (en un Web Worker).

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

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

**(29-sep) La piel se mide en el PEDAZO que se usa, con ~8 cuadros.** Sergio: «algunos clips tenían la piel diferente».
Medido en Proyecto 25: la igualación dejaba el tono parejo pero la LUZ de la piel variaba 8,7 entre tomas (y el tono de
algunas quedaba peor que sin igualar). La causa: la piel se medía en UN cuadro a la mitad del clip, con una silueta en frío
de 0,5 s; si él se movía o cambiaba la luz, esa medida no era la del pedazo cortado. Ahora (`carrete-media-processor`):
- **Al subir** (`medirColorToma` › `pielEnVentana`): ~8 cuadros repartidos por el clip, cada uno con su silueta (fps entero,
  los 2 primeros sin calentar se descartan). Es la que usa la vista de cortes.
- **Al cortar (F1)** (`primariasDe` › `medidaDelPedazo`): cada pedazo se mide en hasta 8 s alrededor de su centro, con 1 s de
  `calentar` en el recorte (que calza cuadro a cuadro porque el fps es entero). Si un pedazo no se pudo medir, va la del clip.
  El log dice `[F1] igualar: N de M pedazos medidos en X s` (~20 s de más).
- Resultado en Proyecto 25 (simulado con sus 18 pedazos y las mismas siluetas): luz de la piel entre tomas 8,7 → 1,8; tono
  10–11 → 4. Los 18 clips se volvieron a medir con `mode: 'medirColor'`.

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

## 10 bits de punta a punta (28-sep-2026, fase 2 del color)

El iPhone graba en 10 bits. Antes, el master pasaba a 8 bits en cada paso: HDR → video normal, la corrección de la toma,
la base reducida a 1080 y el look. Cada paso redondea, y en los degradados lisos (techo, paredes, cielo) quedaban manchas
y escalones. Medido con su clip `IMG_0939` (techo con la luz cálida, contraste ×8): el camino nuevo sale liso y pesa
16 % menos.

- **F1 del master** (`carrete-media-processor`): el HLG sale de la tabla BT.2446 en RGB de 16 bits; la corrección de la
  toma va encima en 16 bits (antes `rgb24`); una sola conversión, a **H.264 High 10** (`yuv420p10le`, crf 17). También
  las tarjetas SAAC y los silencios del master (se pegan con `-c copy`). La copia liviana sigue en 8 bits: el navegador
  no reproduce H.264 de 10 bits.
- **Ensamblador:** la base reducida a 1080 (v18) sigue en 10 bits. **La tabla del color va PRIMERO**, sobre la base tal
  cual y en `rgb48le`, también sin máscara (`filtroTabla`); las escenas de apoyo llevan la misma tabla. Lo de después
  (movimiento, escenas, gráficos, subtítulos) ya no toca la precisión. La viñeta va aparte, después del movimiento, y
  ahora **con tramado** (con `dither=0` dejaba anillos en lo oscuro). La entrega sigue en 8 bits (Instagram y los
  reproductores).
- **La vista previa:** la base del master es de 10 bits y el navegador no la puede mostrar. El master no la deja como
  `video_sin_subtitulos`: orchestrate (v244) guarda en `subtitle_config.vista_base` la base del video de donde salió
  (mismos cortes) y el ensamblador pone esa. Si no hay, la página (`api.getLatestRender`) toma la del video más reciente
  que tenga base.
- El ffmpeg de las Lambdas (johnvansickle, 2018) comprime en 10 bits con libx264 (probado en la nube: 5 % más lento).

## Tu referencia (28-sep-2026, fase 3 del color)

Sergio: «subes una foto o un video cuyo color te guste, una IA lo mira y Cherry lleva tus tomas a ese color, respetando
la piel». Es lo que se hizo A MANO con Cherry Gold (`carrete-docs/looks/LOOK-CHERRY-GOLD.md`), automático:

- **La IA** (`servidor/color-referencia.ts`, Gemini `gemini-flash-latest`): marca en cajas (0–1000) lo que NO es escena
  (texto encima, logos, íconos, interfaz, barras) y dice en palabras qué color tiene. Probado con la referencia de Cherry
  Gold sin tapar: marcó exactamente lo que se tapó a mano (la barra de estado, los dos íconos, el texto, la barra de
  comentarios). Si falla, se mide la imagen entera.
- **La medida** (`motor-color.js › medirParaReferencia`): la referencia y tu video (las muestras de la vista previa, ya
  con su revelado o la corrección de su toma), objeto por objeto: piel, luz cálida, verdes, los NEGROS (lo oscuro y sin
  color; no todo lo oscuro: en un cuarto en penumbra eso es media imagen con la luz encima), luces neutras, la curva y
  la viñeta.
- **La receta** (`recetaDeReferencia`): del mismo tipo que las del catálogo, así que es un look más, con intensidad y
  ajustes. La curva copia la FORMA (piso de los negros, dónde queda la piel, techo de las luces), no la exposición de la
  escena: con cuantiles un video de día quedaba a oscuras. **La piel** se mueve ≤ 8° y siempre dentro de un tono
  natural (40–60°), y su color queda entre 0,75 y 1 vez el tuyo: nunca más viva (con 1,15 ya se veía naranja al lado de
  Cherry Gold). Probado con la referencia de Cherry Gold: salió una receta muy parecida a la hecha a mano.
- **Viaja** en `color.referencia = { receta, img (miniatura), desc }`; orchestrate (v245, `limpiarReferencia`) la limpia
  con los mismos topes que `recetaSegura`; `motor-color.js › lookDe` la convierte en look (página y `revelado.js`).
- Página: `js/components/referencia.js` (el archivo, hasta 3 cuadros de un video, la IA, la medida); en Color, la
  tarjeta «Tu referencia», «Lo que Cherry vio» y «Cambiar la referencia».

## Osciloscopios (28-sep-2026, fase 4 del color)

En Edición → Color → «Osciloscopios» (`js/components/osciloscopio.js`), sobre lo que se ve en el celular (el cuadro ya
con el color, leído justo después de pintarlo: el lienzo WebGL solo se puede leer ahí):

- **Forma de onda** (la luz de cada columna, 0 a 100) y **vectorscopio** con el color de cada pixel y la **línea de
  piel** (123°).
- **Avisos con arreglo de un toque**, con los controles de siempre: blancos quemados (> 1,5 % de blanco puro → Luces −20),
  negros lavados (lo más oscuro > 30/255 → Sombras −15), piel muy saturada o gris (zona piel, saturación ∓20) y piel
  fuera de la línea (zona piel, temperatura ±15).
- **«Revisar todo el video»**: los mismos avisos sobre cuadros de varios momentos (las muestras de la vista previa con la
  tabla de ahora, sin la viñeta).
- **HDR a Instagram:** por la API NO se puede. Meta pide H.264 o HEVC, 4:2:0, sin HDR ni 10 bits; los que publican por
  API lo confirman («HDR format (iPhone) is not compatible with video publishing through the API», Metricool). Solo la
  app de Instagram sube HDR (HLG de 10 bits). Cherry sigue entregando SDR, con la conversión BT.2446.

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
  a **608×1080** con **1 s de calentar** por tramo (`calentar` en el evento de `carrete-recorte`: arranca antes y no guarda
  esos cuadros; el modelo recuerda el cuadro anterior y en frío salía peor). Lo hace el módulo `silueta.js` del ensamblador.
  (29-sep) Antes iba a 304×540 (el modelo por dentro a ~122×216) y se perdía la mano apoyada en el escritorio y el
  antebrazo: esa piel quedaba del lado del fondo y se pintaba con su color (Proyecto 25, rojos +100 en el fondo). Se
  guarda como `<video>_silueta2.mp4`: las `_silueta.mp4` (304×540) ya no se reusan. El primer armado tarda ~1 min más.
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
- El recorte hace que el primer video con Selectivo tarde más en armarse; los siguientes con la misma base reusan
  la silueta.

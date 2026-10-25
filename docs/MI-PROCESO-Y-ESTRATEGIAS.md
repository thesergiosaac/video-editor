# Mi proceso y Estrategias de contenido (20-oct-2026)

Sergio, 19-oct: «para un usuario nuevo, e incluso para mí, no está claro a dónde tengo que entrar». Dos herramientas
nuevas, las primeras en el inicio (tarjetas y banner) y en la barra de la izquierda (`js/lado.js`): «Mi proceso» va
después de Inicio y «Estrategias de contenido» encima de Calendario.

## Mi proceso — `herramientas/proceso.html`

El paso a paso de cada video, como un **tablero** (Sergio escogió la opción «A · Tablero» el 20-oct; la lista de 7 filas
no le gustó: «no en lista: bloques, mosaico, tablero… que al entrar se vea el proceso y sepa qué hacer»).

Los 7 pasos: 1 Conoce tu cuenta · 2 Busca una referencia · 3 Decide qué grabar · 4 Graba y edita · 5 Revísalo antes de
subir · 6 Publícalo · 7 Mide a las 24 h (y vuelve al 3).

- **«Hoy te toca»** (la única tarjeta oscura): el paso, el video, qué hacer y por qué, la barra de 7 y su botón a la
  herramienta de ese paso. «Ya lo hice / Ya lo grabé / Me lo salto / Ya lo medí» marca a mano lo que Cherry no puede ver.
- **«Esta semana»**: lo publicado o programado en el Calendario (lunes a domingo) contra `estrategias.semana`; sin
  estrategia, invita a armarla.
- **«Así va cada video»**: columna «Antes de empezar» (pasos 1–2, de la cuenta) y una columna por paso 3–7; cada plan del
  Laboratorio de la marca activa es una tarjeta en la columna de SU paso. «AHORA» = el más avanzado que se puede hacer ya.
- Las reglas para saber en qué paso va cada video están escritas en el comentario del principio del script (guion
  escrito, `grabado`, `antes`, publicado o programado en el Calendario, `retencion` del video atado). Qué tarjetas salen:
  sin publicar de los últimos 60 días; publicados sin medir de los últimos 7 días («En espera» hasta 24 h); medidos de
  los últimos 7 días («✓ Listo»); los más viejos sin medir solo cuentan en «+N sin medir».
- **(20-oct) También lo que se sube directo al Calendario** (sin plan del Laboratorio; Sergio: «que muestre de verdad lo
  que está haciendo, empiece o no en el laboratorio»): los posts `tipo:'video'` de la marca sin plan son tarjetas. Programado →
  columna 6 (PROGRAMADO si ya tiene respuesta automática); falló → columna 6 «NO SALIÓ» (gana «AHORA»: algo se dañó);
  publicado → columna 7 («En espera» 24 h, luego «Mídelo»; «Ya lo medí» = `cal:<postId>` en el documento). Estado real del
  servidor: `publicaciones_programadas` (por `igProgramada`); números: videos del Laboratorio o `mis_publicaciones`.
- **(20-oct) Con el historial** (`historial › lista`, solo lectura): un reel que el servidor ya midió (retención, medido ≥ 24 h
  después de publicar) pasa solo a «✓ Listo»; los reels subidos directo desde la app de Instagram también son tarjetas (columna 7,
  «Ver su desmontaje» si ya está desmontado; «Ya lo medí» = `ig:<mediaId>`). **Un reel = una tarjeta:** plan, post del Calendario
  y reel del historial que apuntan al mismo media id se juntan (gana el plan con contenido, si no el post, si no el historial).
- Documento `proceso@<marca>` (solo las marcas a mano): `{ v:1, cuenta:{'1':{f,v}}, videos:{<planId>:{'4':{f,v}}} }`.
- Nada de IA ni de créditos: solo lee (`laboratorio`, `calendario`, `estrategias`, `mi_instagram`) y guarda `proceso`.

## Estrategias de contenido — `herramientas/estrategias.html`

Cuánto y qué se publica cada semana, por marca. Pestañas General · Historias · Reels · Carruseles. La persona decide;
«Cherry sugiere» trae 4 bases (Equilibrada por defecto: 4 reels, 2 carruseles, 7 historias; Crecer; Vender; Comunidad),
sin IA. «Cómo vas» compara con el Calendario de esta semana.

- Documento `estrategias@<marca>` (se guarda entero; lo que no conoce lo conserva): `{ v:1, base, cambiada,
  semana:{reels,carruseles,historias}, tipos:{reels:{tipo:n}, carruseles:{tipo:n}}, reelsDias, carruselesDias,
  historias:{lun:[tipos]…dom:[]}, pilares:[], nota, actualizado }`. `semana.historias` = la suma de los días.
- El Calendario NO guarda el tipo (educativo, venta…) de cada publicación: «te faltan» cuenta solo por formato.

### (24-oct) Al entrar: «Tu semana, dibujada»
Sergio, viéndola como un cliente: «lo único que veo es blanco y letras por montones, no entiendo nada». Propuesta «Estrategias
de un vistazo» (https://claude.ai/artifact/CpkuxyK1gNCzNsDs1FWS6h): escogió la **A**.
- **Al entrar** (`data-vista="semana"`, sin nada en la dirección): el tablero de la semana, una fila por formato (con su dibujo y
  su color) y una columna por día (`pintarTablero`). Lo que está en el Calendario sale con su **portada** (lo programado, con
  borde punteado); lo que el plan pide y no está es un hueco: «se pasó» en rosado si el día ya pasó, «+» si todavía se puede
  (lleva al Calendario). Arriba, en etiquetas: «Reels ✓ · Faltan 2 carruseles · Faltan 7 historias»; abajo, un solo botón
  («Programar lo que falta»). En el celular cabe una portada por casilla y «+N». Reemplaza la tarjeta negra «Cómo vas».
- **A la derecha** (`pintarMezcla`): de qué hablas (los 5 tipos con más + «Otros») y tu plan (las 4 bases en chiquito; tocar
  una la pone, con «Deshacer») y «Cambiar mi plan».
- **«Cambiar mi plan»** (`data-vista="plan"`, `#plan`, `#historias`, `#reels`, `#carruseles`): lo de antes (pestañas, tu meta,
  tu mezcla, pilares, nota, cómo se conecta y las bases con su explicación), con «‹ Volver a mi semana». Los enlaces viejos a
  una pestaña siguen abriendo esa pestaña.
- Para mirarlo sin cuenta: `herramientas/_demo-estrategias.html` con `_stub-estrategias.js` (la semana real de Cobra del
  19 al 25 de octubre; nada se guarda).

## La base

`servidor/sql/25-estrategias-proceso.sql`: el CHECK de `herramientas_datos` acepta `estrategias` y `proceso` (y con
`@<marca>`). `POR_MARCA` de `herramientas/cherry.js` también las tiene.

## Tu próximo video — `herramientas/proximo.html` (20-oct-2026)

Reemplaza el trabajo de «Lo siguiente» del Laboratorio. Sergio escogió la forma de **tres preguntas**, una a la vez:
«Escoge el estilo de tu video» → «Escoge la idea» → «Escoge el gancho», y al final el video armado con UNA frase de por
qué («Tu idea de «X» sacó N vistas con otro estilo. Con el estilo de «Y» puede llegar mucho más lejos.») y «Escribir el
guion». Reglas suyas: cada paso dice QUÉ se escoge y qué es, con palabras de todos los días; cada opción es un video suyo
(portada, nombre, vistas) con una barrita de color contra la mejor y una estrella en la mejor; siempre clara; **nada
torcido**. Sale de `historial › lista` (piezas.estilo / tema / gancho + gancho_frase), de la marca activa.
- «✦ Escribir el guion · 10 créditos» guarda `sessionStorage['cherry-receta']` y abre `laboratorio.html?modo=guiones&nuevo=1`.
  **(20-oct) Con la receta no se pregunta nada** (Sergio: «venimos de donde ya escogimos el estilo, la idea y el gancho… ¿no
  es contradictorio?»): `lab-guiones.js` (`tomarReceta` / `recetaDirecta`) no abre «Nuevo guion», escoge la primera forma
  firme de Cherry y llama `premium(f, plantilla, receta)`; la ventanita del calco del Laboratorio (`escribirCalco`, variable
  `recetaCalco`) se salta «¿De qué va este video?» (la idea es el texto) y «Escoge cómo empieza», piensa y escribe de una,
  mostrando «Tu idea / Arranca así / Se ve como». Solo si la marca no tiene sus datos sale «Cuéntale a Cherry de tu cuenta»
  (una vez por marca). El gancho va como `ganchoTipo {nombre, ejemplo}` a `guion-calco` (planear y escribir): el tipo que
  escogió («Contar una escena») copiando la FORMA de la frase de su video, no el tema. Entrar a Guiones directo sigue igual.
- Llegan aquí: la carta y el banner «Qué grabar después» del inicio, y el paso 3 / «Empezar el próximo video» /
  «+ Planear otro video» de Mi proceso.

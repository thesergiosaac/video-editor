# Mi proceso y Estrategias de contenido (20-oct-2026)

Sergio, 19-oct: «para un usuario nuevo, e incluso para mí, no está claro a dónde tengo que entrar». Dos herramientas
nuevas, las primeras en el inicio (tarjetas y banner) y en la barra de la izquierda (`js/lado.js`): «Mi proceso» va
después de Inicio y «Estrategias de contenido» encima de Calendario.

## Mi proceso — `herramientas/proceso.html`

### (26-oct) «Tu camino para crecer»
Sergio: «Mi proceso no es un paso a paso de lo que hay que hacer en la plataforma (para eso va un recorrido de bienvenida):
es el proceso de CRECIMIENTO, como en una mentoría: identidad de marca, nicho, ideas, referentes → publicar → mirar
resultados → qué funcionó y qué falló → cambiar lo que falló, seguir lo que funcionó → hasta una fórmula que funcione». Y
«la pantalla negra debe ser más sutil». Escogió mis pasos (https://claude.ai/artifact/SS9KvBpPZ9ahjFpb6d5VFn) y aprobó la
pantalla (https://claude.ai/artifact/8BptGwF6QMQkn2S6RVPc9B). Estilo del Calendario en papel.

- **La meta: crecer** (arriba a la derecha): el nivel de `CherryResumen.nivel` (el mismo del inicio; desde el 26-oct vive en
  `js/resumen-cuenta.js`) con los seguidores y los últimos 10 reels de la red escogida, y los seguidores ganados: desde que
  empezó (`proceso.inicio = {f, s, red}`, se guarda la primera vez que se ven) cuando ya pasaron 28 días; antes, los de los
  últimos 28 días (`ig-metricas › cuenta` o `yt-conectar › cuenta`).
- **Tu siguiente paso** (la franja; antes la tarjeta negra gigante), en este orden: conectar Instagram · un video que no
  salió · medir un video (con «Ya lo medí») · armar la identidad de marca · escribir los temas · desmontar referentes (hasta
  3 piezas) · un video a medias (su paso) · publicar lo que falta de la estrategia esta semana · cambiar una pieza inerte ·
  grabar con tu fórmula. La etapa de ese paso sale en rosado con «Ahora».
- **La base**: 1 Define quién eres (identidad de marca guardada —colores o letras— y temas en la estrategia) · 2 Estudia a
  tus referentes (piezas del baúl guardadas desde «Desmontar»; lista con 3).
- **El ciclo**: 3 Publica con constancia (esta semana contra la estrategia y las 4 de antes) · 4 Descubre qué funcionó
  (las piezas de los reels medidos del historial —formato, idea, gancho, estructura, las de «Tu próximo video»— con la
  regla del baúl: acierta si la retención pasa `CherryResumen.corte`; magnética = 2+ usos sin fallar; inerte = nunca
  acertó) · 5 Afina tu fórmula (la mejor magnética de cada tipo; lista con 3 de 4; «Grabar con mi fórmula» → proximo.html).
- Se fue el tablero de cada video. La lógica de en qué va cada video (`calcular`, abajo) se queda: de ahí sale el paso.
- Demo sin cuenta: `herramientas/_demo-proceso.html` con `_stub-proceso.js` (`?base=0`: sin identidad ni referentes).

### Antes (19 al 25-oct): el tablero de 7 pasos por video
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

Qué se publica cada semana, por marca, día por día. La persona la arma (o le pide a Cherry que la arme según su objetivo);
sin IA y sin créditos. Lee el Calendario de esta semana para decir qué salió y qué falta.

### (26-oct) «Arma tu estrategia» (la A de https://claude.ai/artifact/E16kvfqRYfRu5Zkp1iNKGL)
Sergio: «entré y ya está hecho un plan que yo no he armado; debe aparecer vacío: armarla manual o que Cherry te la arme
dependiendo del objetivo», y «Cambiar mi plan» llevaba a la misma pantalla de pestañas. Antes, sin nada guardado, se cargaba
la base «Equilibrada» como si fuera suya. Y del diseño: «se ve muy saturado»; el modelo son el **Calendario y «Tus
proyectos»**, así que la página usa los colores (papel), las tarjetas `.vol`, las fichas, los días en pastilla y los botones
del Calendario. Se fueron las pestañas, la mezcla de colores, las bases en chiquito, «Cómo se conecta» y la tarjeta negra.

Las pantallas (`vista`; una sola página, sin nada en la dirección):
1. **`vacia`** (no hay nada guardado en la cuenta): «Que Cherry la arme» o «Armarla yo». Mientras llega lo de la cuenta,
   `cargando` («Trayendo tu estrategia…»); nada se inventa.
2. **`objetivo`** «¿Qué quieres lograr?»: Crecer, Vender, Comunidad y Constancia (la que era «Equilibrada»), con cuánto de
   cada formato. Fijos en `OBJ` (cuántos, de qué tipo, qué días; `repartir` intercala los tipos en los días).
3. **`previa`** «Tu semana ideal»: la semana del objetivo y, al lado, el total. **No se guarda** hasta «Guardar estrategia»;
   «Cambiar algo» la abre para cambiarla (y «Cancelar» vuelve aquí); «‹ Otro objetivo».
4. **`semana`** «Tu semana» (lo que se ve al entrar si ya tiene estrategia): días con fecha (hoy en rosado) y en cada día lo
   del Calendario con su portada (punto verde publicado, azul programado) y, punteado, lo que la estrategia pide y no está
   («se pasó» con punto rojo si el día ya fue; si no, lleva al Calendario). Las historias que faltan van juntas («2 historias»).
   Al lado: «8 de 19 que te propusiste», cada formato, «Programar lo que falta» y «Cambiar mi estrategia».
5. **`editar`** (la A, sobre la semana): cada ficha abre su menú «¿De qué es?» (los tipos; reels y carruseles también «Sin
   tipo») y «Quitar»; el «+» de cada día agrega un reel, un carrusel o una historia (hasta 3, 2 y 5 por día) y abre de una vez
   su menú. Al lado: el objetivo («Cambiar» → la pantalla 2; pone esa semana con «Deshacer»), los temas y una nota. Todo es un
   borrador: «Listo» guarda, «Cancelar» lo bota. Armándola en blanco, «Listo» sin nada puesto vuelve a la pantalla 1.
- En el celular la semana es una lista de días (como la Lista del Calendario) y el resumen va arriba (cambiándola, abajo).
- Documento `estrategias@<marca>` (se guarda entero; lo que no conoce lo conserva): `{ v:2, objetivo:'crecer'|…|'',
  cambiada, reels:{lun:[tipo]…dom:[]}, carruseles:{…}, historias:{…}, semana:{reels,carruseles,historias}, pilares:[], nota,
  actualizado }`. `semana` son los totales (los lee Mi proceso). Un tipo `''` es «sin tipo».
- **La v1** (19 al 25-oct: `base`, `tipos`, `reelsDias`, `carruselesDias`) se convierte al leerla (`normal`): los reels y
  carruseles se reparten en sus días como antes, `base:'equilibrada'` pasa a `objetivo:'constancia'`.
- El Calendario NO guarda el tipo (educativo, venta…) de cada publicación: lo que falta se cuenta por formato y por día.
- Para mirarla sin cuenta: `herramientas/_demo-estrategias.html` con `_stub-estrategias.js` (la semana real de Cobra del 19 al
  25 de octubre corrida a la semana de hoy; nada se guarda). Sin nada: no tiene estrategia · `?con=1`: una v1 (Crecer) ·
  `?con=2`: una v2 armada a mano.

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

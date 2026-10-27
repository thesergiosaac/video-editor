# Guiones (6-oct-2026): una vista del Laboratorio

Sergio: la pantalla de Guiones «no se entiende» frente a la de guiones del Laboratorio, donde él sí trabaja; que se
conecten, que se pueda partir de una idea que ya funcionó, que esté el guion premium y que se vea el storyboard ahí
mismo, todo sin bajar y con arte de la marca. Propuesta aprobada entera («sigo todas tus recomendaciones… hazlo y
publícalo»): https://claude.ai/artifact/LevuT9ecMSSf3fT2aU3ua7

## Cómo está hecho
- **No tiene datos ni motor propios.** Guiones es `herramientas/laboratorio.html?modo=guiones`. La vista `#vg` la pinta
  `herramientas/lab-guiones.js` (+ `lab-guiones.css`, todo bajo `.lg`), como `lab-ficha.js` y `lab-baul.js`, con
  `window.LabAPI`. Los guiones son los planes del Laboratorio (`laboratorio.planes`, «Por grabar / Grabados /
  Publicados» de la marca activa): lo que se escribe aquí está en Laboratorio › Mis videos, y al revés.
- **El estado magnético** de cada pieza (★ magnética, ● temporal, ○ nunca probada, ✕ inerte) es el que calcula el
  Laboratorio (`estadoPieza`), no una copia.
- **Para escribir, revisar y dibujar se usan las funciones del Laboratorio** (`LabAPI.menuPieza`, `escribir`,
  `premium`, `dibujar`, `verStoryboard`, `abrirEscena`, `marcarGrabado`…, agregadas el 6-oct). La ficha «escena por
  escena» (v7) y el storyboard grande (v8) son las del Laboratorio; en modo Guiones su «volver» dice «‹ Guiones» y
  regresa a la vista. La ficha avisa a Guiones cada vez que se repinta (`pintarFicha` envuelto antes de `LabAPI`).
- `herramientas/guiones.html` solo redirige (enlaces viejos y el «+» de la carta del inicio, conservando `?nuevo=1`).
  La barra de herramientas (`js/lado.js`) lleva directo a `laboratorio.html?modo=guiones` y ahí marca «Guiones».
  El «+» abre «Nuevo guion» (`cherry.js` toca `#lg-nuevo` en modo Guiones).

## La pantalla
- Franja bajita con el astronauta de la carta del inicio (`assets/inicio/v2/guiones-chica.webp`), los conteos
  (por grabar, grabados, publicados) y «＋ Nuevo guion» / «✦ Que Cherry lo escriba · Premium».
- Izquierda, **Tus guiones** con las tres pestañas; cada guion dice qué piezas tiene y cuáles son magnéticas.
- Centro, **el guion abierto**: título, estado, «✦ Que Cherry lo escriba» (con una forma de Cherry abre el calco ahí
  mismo; si no, en la ficha, donde se ve avanzar), «Escena por escena · revisar ›» (la ficha v7: auditar, mejorar,
  escribir cada escena), «▶ Teleprompter» (vino de la pantalla vieja), «✓ Ya lo grabé»; las 4 piezas con su estado
  (tocar una abre el desplegable del baúl del Laboratorio); la duración a 3,4 palabras por segundo contra `dur`; y las
  escenas con lo que dices y lo que se ve, editables ahí mismo (se guarda solo), con «Mis frases» de la marca.
- Derecha, **el storyboard**: las viñetas del plan, «Dibujar» (las que faltan, con `sb-vineta` del Laboratorio y su
  tope de viñetas), «Ver el storyboard grande» y «Grabar con el Editor Pro» (crea el proyecto con el texto y el plan
  lo recuerda en `plan.proyecto`: la segunda vez abre el mismo).
- En computador (≥1181 px y ≥600 de alto) cabe en una pantalla; más angosto se apila y baja.

## Nuevo guion: cuatro caminos
1. **Desde una idea magnética**: las ideas del baúl ordenadas por estado y con las mejores vistas de sus videos →
   «Lo escribo yo» (plan con esa idea y la ficha) o «✦ Premium».
2. **Guion premium**: se escoge una forma de Cherry (plantillas de `guion-calco` › `biblioteca`, la primera «firme»
   marcada) → plan con esa estructura → el calco del Laboratorio (`escribirCalco`), que pregunta de qué va el video y
   lo escribe con su modelo más avanzado. ⚠️ Hoy NO descuenta créditos (el cobro está pendiente; ver `js/pagos.js`).
3. **Desde una fórmula** del baúl: `planConPiezas` con sus 4 piezas.
4. **Lo escribo yo**: plan en blanco y la ficha.
Cada opción lleva un personaje de las cartas del inicio (Tesla, el astronauta, Van Gogh y la mujer cámara).

## Lo de la pantalla vieja
La primera vez que se abre en modo Guiones, `importar()` trae a «Por grabar» los guiones del documento
`guiones@marca`: sin los de ejemplo (`g1`…`g8`), sin repetir uno que ya tenga plan con el mismo título, con sus escenas
(las del calco si las tenía; si no gancho, puntos y cierre). Marca cada uno con `plan` para no traerlo dos veces. El
Storyboard (`storyboard.html`) sigue leyendo ese documento viejo para «Crear desde un guion».
La carta de Guiones del inicio cuenta los planes por grabar de la marca (`inicio.js › armarDatos`).

## En el celular (23-oct-2026)
Sergio: «ahora diseñemos la pantalla de guiones en celular». Antes era la del computador apilada: se salía de lado (453 px
en una pantalla de 390) y medía casi 3.000 px. Propuesta «Guiones en el celular»
(https://claude.ai/artifact/H6ghNT2pP9B3r5s8D1JpQG), con la regla del editor del celular (docs/EDITOR-CELULAR.md): pantalla
fija, barra abajo, hojas que suben. Del guion abierto había dos formas (A y B) y escogió las dos: «que el usuario pueda
cambiar la vista».
- **Solo en ≤760 px** (`celular()` con `matchMedia`): `pintar()` llama a `pintarCel()`; en el computador no cambia nada
  (comparado píxel por píxel). Girar el celular o achicar la ventana vuelve a pintar. Todo bajo `.lg-cel` / `.lgc-*`.
- **La lista** va en la página: «Guiones» con el astronauta, las tres pestañas y cada guion con su miniatura (su primer
  dibujo), cuánto dura, cuántas escenas, cuántas dibujadas y su estructura. «＋ Nuevo guion» fijo abajo (`#lg-nuevo`, el mismo
  id que toca cherry.js); abre la ventana de los cuatro caminos, que en el celular es una hoja que sube.
- **El guion abierto** (`est.abierto`) es una pantalla fija: ‹ (volver), el título (se edita ahí) y «Grabar». La barra de
  abajo: **Lista** · **Una a una** (las dos vistas; la escogida se guarda en ese celular, `localStorage › cherry-guion-vista`)
  · **Storyboard** · **Cherry ✦**.
  - *Lista*: la duración con su barra (raya fucsia donde se pasa), las piezas en una tira (abren la hoja «Las piezas») y
    todas las escenas con su dibujo, su tramo y lo que dices.
  - *Una a una*: el dibujo de la escena a pantalla completa, lo que dices encima, rayitas arriba como las historias;
    se pasa con las flechas o deslizando. «✎ Escribirla» y «✦ Mejorarla».
  - *Storyboard*: los dibujos en tres columnas, «Dibujar las que faltan» / «Dibujarlo otra vez» y «Verlo en grande».
- **Hojas** (`est.hoja`): la escena (su dibujo con el plano y por qué, lo que dices con «Mis frases», lo que se ve, «‹
  Anterior», «✦ Mejorarla», «Siguiente ›»; se guarda solo), «Grabar» (teleprompter, Editor Pro, «Ya lo grabé»), «Cherry ✦»
  (que lo escriba, revisarlo escena por escena, las piezas) y «Las piezas» (el desplegable del baúl del Laboratorio, dentro
  de la hoja). La hoja sube solo al abrirse: el Laboratorio repinta por su cuenta mientras trae el historial.
- **El «atrás» del celular**: abrir un guion empuja un paso en el historial; «atrás» cierra primero la hoja y después el
  guion; desde la ficha o el storyboard grande vuelve al guion.
- Con un desplegable de piezas abierto, `LabGuiones.repintar` espera (si no, el repintado del historial se lo llevaba).
- ⚠️ La ficha «escena por escena» (v7), adonde llevan «✦ Mejorarla» y «Revisarlo escena por escena», sigue siendo la del
  computador: en el celular se sale de lado. Falta adaptarla.

## Las piezas en el celular, una a la vez (24-oct-2026)
Sergio: «diseñar la pantalla de celular del guion donde estamos escogiendo la idea, el gancho, el formato, la estructura, para que
sea mucho más cómodo». Antes era la hoja «Las piezas» con cuatro filas y, dentro, el desplegable negro del Laboratorio: se salía
por abajo, sus letras oscuras casi no se leían y ninguna opción tenía portada. Propuesta «Escoger las piezas en el celular»
(https://claude.ai/artifact/CPauHUfLfa7fVZ51DCSKX8): escogió **la A, una a la vez** (la B era las cuatro filas que se deslizan).
- **Solo en el celular** (`celPiezas` en `lab-guiones.js`, estilos `.lgc-hpz` / `.lgc-op` / `.lgc-pasos`). El computador sigue
  con el desplegable de siempre.
- Se abre casi a pantalla completa **directo en la pieza que se tocó** en la tira del guion (o en la primera que falta, desde
  «Cherry ✦ › Idea, estructura, gancho y formato»). Arriba, cuatro rayitas con su nombre de todos los días (De qué habla · En
  qué orden · Cómo arranca · Cómo lo grabas): tocar una salta a esa. Abajo, «‹ Atrás» y «Paso N de 4».
- **Una pregunta por pantalla** («¿Cómo arranca tu video?») con una línea que dice qué es. Las opciones del baúl de la marca
  van primero («Tuyas»), ordenadas como el desplegable (★ te funciona → te fue bien → sin probar → no te funcionó) y por vistas;
  cada una con **la portada del video donde mejor le fue** (`videosDeCuenta`, que trae el historial), sus vistas con una barrita,
  cómo le fue en palabras de todos los días (`estadoLlano`) y una línea: qué es ese tipo de gancho o de formato, la frase del
  gancho si la tiene, o las partes de la estructura («7 partes: La primera frase → …»). La primera, si funciona, lleva
  «★ La que mejor te funciona». Sin video: «sin video todavía»; con video sin portada: «sin portada».
- **«De Cherry · funcionaron en otras cuentas»** aparte (estructuras y arranques del calco; se cargan la primera vez). Lo que
  salió de Cherry y nunca se ha usado no se repite en «Tuyas».
- **Al tocar una se marca y pasa sola a la pieza que falta**; si no falta ninguna, vuelve al guion. «＋ Escribir … nuevo» al final
  (la ventana del Laboratorio). Escoger hace lo mismo que el desplegable (`LabAPI.escogerPieza`, `escogerCalco`,
  `piezaNuevaPlan`, agregadas el 24-oct): cambiar la estructura rearma las escenas y conserva lo escrito en las del mismo tipo.
- Para mirarlo sin cuenta: `herramientas/_demo-lab4.html?modo=guiones` (copia del Laboratorio del 24-oct con `_lab-falso.js`).
- **En el computador** sigue el desplegable de la receta, pero en claro (Sergio: «arregla también la del computador»): su fondo es `--tarjeta`, que el modo papel nunca redefine, así que salía con el de noche y letras oscuras. Se arregla solo dentro de Guiones (`.lg .menu` en `lab-guiones.css`): el token no se toca para no mover otras pantallas del Laboratorio.

## El guion abierto, más claro (computador, 23-oct-2026)
Sergio: «la parte de arriba que dice Guiones es perfecta, pero la parte donde se ve el guion está un poco confusa» (se veían
tres escenas, cada texto cortado a dos renglones con flechitas de estirar, cuatro botones parecidos y «Temporal · 1 de 2»).
Propuesta «El guion, más claro» (https://claude.ai/artifact/P9H64gx7au8QNf9PVbdsLC): escogió **las dos formas**, y cada quien
cambia la vista (se recuerda en ese navegador: `localStorage › cherry-guion-vista-pc`). La barra de arriba, «Tus guiones» y
«Storyboard» no cambian; el celular tampoco.
- **Arriba del guion**: el título, el estado, «La hoja / Escena por escena», «✦ Que Cherry lo escriba» y **«Grabar»**, que
  abre el teleprompter, el Editor Pro y «Ya lo grabé» (antes eran cuatro botones; «Escena por escena · revisar» pasó a
  «✦ Mejorarla» en cada escena, que abre la ficha).
- **La receta** en una línea (la letra a mano «la receta» y las cuatro piezas con el desplegable del baúl de siempre). El
  estado en palabras de todos los días (`estadoLlano`): «sin probar», «te fue bien 1 de 2 veces», «★ te funciona…».
- **La regla de tiempo** (`reglaHtml`): un tramo por escena, del largo de lo que se dice (3,4 palabras por segundo), la
  raya fucsia en la meta (`f.dur`) y en fucsia las escenas que se pasan. Tocar un tramo lleva a esa escena.
- **La hoja** (`hojaHtml`): todo el guion seguido; cada escena con su número, su nombre, lo que dices entero en letra
  grande (el texto crece, sin flechitas), «Se ve» debajo y su dibujo al lado (o «✦ dibujarla»), que abre la ficha.
- **Escena por escena** (`escenaHtml`): la lista a la izquierda y la escena en grande con su dibujo, el plano y por qué,
  lo que dices, lo que se ve, «‹ Anterior», «✦ Mejorarla con Cherry» y «Siguiente ›».
- **Nombres de todos los días** (`LLANO`, de la propuesta del 20-oct): «La primera frase» con «gancho» chiquito debajo; los
  nombres que no están en la lista salen como vienen.
- El panel es una rejilla cuya última fila (la hoja o la escena) baja por dentro: con flex el panel crecía y se cortaba.
  Repintar guarda lo que la persona bajó (se devuelve DESPUÉS de que crecen los textos).

## El guion, protagonista en computador (26 y 27-oct-2026)
Sergio: «las líneas están cortadas», luego «el guion es el protagonista, no puede ser una cajita pequeñita», «no quiero
quitar nada… que se siga viendo el storyboard a la derecha» y «que el bloque de tus guiones sea más angosto». Se mide en SU
pantalla: Windows al 125 % → **1525 × 728** (y se revisa en 1366 × 700 y 1900 × 890). Propuesta con fotos:
https://claude.ai/artifact/X9Dtu15Q7NtDeMQKSgHQeh. Se quedan las tres columnas y toda la información; solo se compacta.
- **El panel del guion** es `minmax(0, 1fr)` con `container: lg2 / inline-size` (antes se salía: 944 px en un panel de 624).
  Las reglas de ancho son `@container lg2` (≤1300: arriba en dos filas con «Mis frases» `.lg2-frases-ar` junto a
  «✦ Que Cherry lo escriba» y «Grabar»; ≤900 y ≤560 para lo más angosto), no `@media`.
- **«Tus guiones» más angosto**: `.lg-cuerpo` = `clamp(192px, 13vw, 236px) | 1fr | clamp(232px, 16.5vw, 300px)`; las
  pestañas con el número arriba y la palabra debajo para que quepan las tres.
- **Lo compacto va AL FINAL de `lab-guiones.css`** (después de `/* @@fin-de-la-hoja@@ */`, dentro de
  `@media (min-width: 1181px)`): la franja de arriba bajita (astronauta 76 px), la receta en una rejilla de una fila con
  cada pieza en dos renglones, `.lg2-der` oculto, escenas con dibujo de 50 × 89. Puesto antes, las reglas del contenedor
  lo pisaban.
- **Storyboard**: tres columnas con `grid-auto-rows: max-content` (en pantallas bajas las viñetas se montaban).
- **Escena por escena**: lista de 200 px y el dibujo de 110 px AL LADO del texto (encima tapaba lo que dices).
- Resultado en su pantalla: guion de 923 px de ancho y unos 330 px de hoja (antes 783 y 238).

## Sin la ficha vieja (27-oct-2026)
Sergio: «a veces estoy haciendo guiones y de repente aparece esta vista (la ficha del Laboratorio); siempre debería ser la
que ya diseñamos». Fotos aprobadas: https://claude.ai/artifact/98QwRpaRYqcigSL3NZ6boK. En Guiones ya NADA llama a
`LabAPI.abrirEscena` (el script lo comprueba: `abrirEscena` no aparece en `lab-guiones.js`).
- **El dibujo** de una escena (La hoja) y el **cuadrito vacío** del storyboard → esa escena en «Escena por escena»
  (`data-a-escena`, guarda `cherry-guion-vista-pc = escena`). En la escena grande el dibujo ya no se toca (es un `div`);
  sin dibujo dice «sin dibujo».
- **El storyboard grande** (`pintarStoryboard`): en Guiones dice «‹ Volver a Guiones» y vuelve a `vg` (`VOLVER_SB`).
- **«Nuevo guion › Lo escribo yo»** (y «idea › lo escribo yo»): el guion queda en «Por grabar», en Guiones, con un aviso.
- **«✦ Mejorarla» y «✓ Revisarla»** (`preguntar`, `propHtml`, `accionProp`): la petición es la misma de la ficha, sacada a
  `pedirEscena(f, i, modo)` en `laboratorio.html` y expuesta como `LabAPI.escenaIA`. Lo que dice Cherry sale debajo de la
  escena (caja rosada `.lg2-prop`; en el celular, en la hoja de la escena): mejorar → «Usar esta · Otra versión · Dejar la
  mía»; revisar (`modo auditar`) → puntos verde/amarillo/rosado y «✦ Arréglalo por mí». Sin texto, mejorar = escribir desde
  cero. Guiones baja solo hasta la caja (una vez por respuesta). El menú del celular «Revisarlo escena por escena» abre la
  escena 1 y la revisa.
- **«Que Cherry lo escriba» con estructura propia**: `LabAPI.escribir` ya no va a la ficha; `escribirGuion` pone una ventana
  «Escribiendo tu guion…» con el tiempo que falta (como la del premium) si se escribe desde Guiones.

## Para mirarlo sin cuenta
`herramientas/_demo-lab2.html?modo=guiones` con `_lab-falso.js` (un documento parecido al de Sergio, videos de
ejemplo para que se calculen los estados, nada gasta). Sin seguimiento; nunca se publica.

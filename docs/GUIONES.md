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

## Para mirarlo sin cuenta
`herramientas/_demo-lab2.html?modo=guiones` con `_lab-falso.js` (un documento parecido al de Sergio, videos de
ejemplo para que se calculen los estados, nada gasta). Sin seguimiento; nunca se publica.

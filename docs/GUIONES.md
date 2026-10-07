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

## Para mirarlo sin cuenta
`herramientas/_demo-lab2.html?modo=guiones` con `_lab-falso.js` (un documento parecido al de Sergio, videos de
ejemplo para que se calculen los estados, nada gasta). Sin seguimiento; nunca se publica.

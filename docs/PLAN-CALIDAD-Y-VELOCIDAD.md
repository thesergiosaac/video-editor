# Plan: calidad original y edición instantánea

*Noche del 23 al 24 de septiembre de 2026. Sergio dejó las dos misiones y se fue a dormir: se ejecuta de corrido.*

## Las dos misiones

1. **El video final sale siempre en la calidad en que se grabó** (resolución y cuadros del clip original).
2. **Editar es lo más rápido posible**: subir, cortar, subtítulos, gráficos, escenas. Aunque lo que se vea mientras se edita sea de menos calidad.

## Lo medido antes de tocar nada (proyecto real de 22 clips)

| Etapa | Hoy | Por qué |
|---|---|---|
| Subir y convertir un clip de 26 s | **~3 min** | 4K60 HEVC → 1080p30 H.264 `preset fast crf 18`, y **se procesa dos veces** (S3 dispara la Lambda y la página también) |
| Transcribir | empieza solo cuando termina lo anterior | el disparador espera `status = processed`, que se pone al final |
| Cortar 30 trozos (F1) | **~90 s** | una sola Lambda, en serie, cada trozo por HTTP con seek |
| Pasada final (subtítulos, color) | **~35 s** | ya va en 10 pedazos paralelos |
| Compresiones | **3** | subir + cortar + final, y la del medio es la peor (`ultrafast crf 23`) |
| Resultado | 1080p **30 fps** 3,3 Mbps | la cámara graba 4K **60 fps** 72 Mbps |

Instagram por API (verificado en su documentación): ancho máximo 1920 px, 23–60 fps, ≤25 Mbps, ≤300 MB, H.264/HEVC. **4K no entra; 60 fps sí.**

## El diseño

Dos copias de cada clip, y entre ellas solo viaja **la lista de cortes**:

- **Copia liviana** (`mp4_path`): 720×1280, 30 fps, `ultrafast crf 26`. Con ella se hace TODO lo de editar. Se hace al subir, después del audio.
- **Original** (`storage_path`): el .MOV tal cual. Nunca se toca. De ahí se corta el **máster** cuando se exporta o publica.

Cherry decide dónde cortar **escuchando el audio**, no mirando el video → la copia liviana no afecta el corte en nada.

## Pasos de ejecución (cada uno deja el sistema funcionando)

- **A. Configuración y disparador duplicado.** Quitar la notificación de S3 (la página ya llama `process-upload` con reintentos). Lambda `media-processor` a 10 GB de memoria (6 CPU en vez de 2). Ensamblador a 10 GB de disco.
- **B. Subida rápida.** `handleProcess`: audio primero → `status=processed` (la transcripción arranca) → copia liviana → `mp4_path` → si el clip ya está transcrito, avisar al motor. Guardar `resolution` y `fps` del original en la fila (las columnas existían vacías).
- **C. F1 rápido y F1 máster.** Copias livianas bajadas una vez y cortadas en local, en paralelo. Modo `fuente: 'original'`: corta del .MOV a su resolución y sus cuadros, `crf 17`, repartido en varias Lambdas.
- **D. Ensamblador para el máster.** Pedazos más cortos cuando hay más píxeles; tope de bitrate proporcional a los píxeles; salida para Instagram (1080×1920 a los cuadros originales, ≤300 MB) además del original.
- **E. Exportar y publicar en original.** `calidad: 'original'` en orchestrate; botón en el resultado; el calendario no publica nada que no sea máster.
- **F. Prueba de punta a punta** en un proyecto de prueba con los clips de Sergio (copiados, no los suyos), midiendo cada tiempo.

Lo que se fue haciendo y lo que se midió queda anotado abajo, en «Bitácora».

## Bitácora

**A — hecho.** Notificación S3→Lambda quitada (respaldo en el scratchpad); la página y el calendario ya llamaban `process-upload` con reintentos. Disco del ensamblador 2→10 GB. ⚠️ La memoria de la Lambda **no** se pudo subir: la cuenta la topa en 3008 MB (2 CPU). La velocidad viene de repartir en Lambdas, no de una más grande.

**B — hecho y medido** (3 clips copiados de Sergio, 7–9 s, 4K60): audio y transcripción listos a los **10–15 s** (antes ~3 min), copia liviana a los **25–34 s**, `resolution=2160x3840 fps=59.96` guardados, el motor arrancó solo cuando llegó la copia (avisado por la Lambda). Para un clip de 26 s la copia tarda ~90 s en la Lambda (35 s aquí con 2 hilos): es decodificar 4K60 HEVC, y `-skip_frame noref` lo baja de 59 a 35 s.

**C — hecho.** F1 proxy: copias bajadas una vez, 3 cortes a la vez. F1 original: **una Lambda por trozo** (medido: un trozo de 2 s en 4K60 tarda 26–84 s en 2 CPU y dos a la vez solo se estorban), `veryfast crf 17`, autorrotación. ⚠️ Los clips anteriores al 24-sep no traen `resolution/fps`: F1 mide el original por URL (solo la cabecera) y lo deja guardado — descubierto en la primera prueba real, donde el máster salió a 1080p30 por eso.

**D — hecho.** Pedazos: para el máster hasta 40, de ≥3 s, espera hasta 12 min; `crf 18` con tope de bitrate proporcional a los píxeles (4K60 → 40 Mbps); la versión para Instagram sale en la misma pasada (split) con tope que respeta los 300 MB.

**E — hecho.** `calidad: 'original'`; `cortes_json` en cada render; exportar exacto con o sin `subtitulos` en el pedido; botón «Calidad original»; Descargar baja el máster; el calendario pide el máster y espera antes de publicar. Los renders anteriores al 24-sep no tienen `cortes_json`: pedirles original cae al camino completo (frases nuevas), nunca a un export normal a escondidas.

**F — medido.**
- Proyecto de prueba: copia de edición de punta a punta **74 s** (720p30); máster **155 s**: 2160×3840 a 60 fps (34 Mbps) + Instagram 1080×1920 a 60 fps (7,8 Mbps). Cuadros comprobados a la vista: derechos y con los subtítulos bien escalados a 4K.
- Proyecto real de Sergio (22 clips, 36 trozos): copia de edición **192 s**, 91,5 s de video con los 22 clips apretados por el mapa de voz (`con_bloques=22`).
- **Máster del video real de Sergio: 295 s** (F1 original ~115 s con una Lambda por trozo; ensamblador ~170 s en pedazos a 4K). Salida: **2160×3840 a 60 fps, 22,7 Mbps, 264 MB** + Instagram **1080×1920 a 60 fps, 6 Mbps, 71 MB**. Los 22 clips quedaron con `resolution/fps` guardados. Cuadro comprobado a la vista.
- El proyecto de prueba se borró al terminar para no dejarlo en su lista.

## Lo que queda (por orden de valor)

1. **Sacar el audio en el navegador antes de subir** (mp4box.js, sin recomprimir: ~400 KB): la transcripción arrancaría cuando el video lleva un 1 % subido. Es lo que falta para que subir sea instantáneo de verdad; hoy el suelo es la subida del original (5 GB para 22 clips en 4K60) y decodificarlo (~90 s por clip de 26 s).
2. **Gráficos premium a 4K**: hoy Remotion los dibuja a 1080×1920 y el ensamblador los reescala sobre el máster (se ven un poco blandos solo en esas escenas). Es parametrizar la composición y pagar 4× en esa parte.
3. **Los pedazos leyendo la base por HTTP** en vez de bajarla entera (cada pedazo de un máster baja ~260 MB): ahorraría ~15 s por pedazo.
4. **El máster en segundo plano** cuando el corte lleva unos minutos sin cambiar (hoy se pide con el botón o lo pide el calendario).
5. Quitar el diagnóstico temporal (`diag`) de orchestrate.


## ⚠️ 24-sep, noche: salió la copia de 720p a Instagram

El calendario pedía el master **en el navegador** y se lo saltaba. Al guardar, el video ya había salido de la bandeja, así que `buscarProy` daba null y se programó la copia de edición (720p a 30 cuadros). Se publicó a las 20:21 y Sergio la borró.

Arreglado en el **servidor** (`ig-publicar` v2, columnas `render_master` y `master_estado`), como propuso Sergio: **«apenas se toca en programar, en segundo plano lo procesa (aunque se cierre la página), y cuando llegue la hora ya está listo»**.

- Al programar, si la dirección es de un render de Cherry que no es master, se pide el master a orchestrate en ese momento.
- Cada vuelta del reloj (cada minuto) revisa los que se están preparando y cambia la dirección por la del master.
- A la hora, sin master, **se espera**. Si en 40 min no salió, queda «fallida» y dice por qué.
- Última defensa: antes de mandarle a Instagram una dirección de un render, se comprueba que sea master.
- El calendario ya no marca «súbelo tú» lo que Cherry programó: muestra lo que dice el servidor (`sincronizarIG`, modo `mias`).

## ✅ «Así debe ser siempre» (24-sep, 20:30)

Se publicó el master en sergiosaac.co: **1080×1920 a 60 cuadros**. Sergio: **«se subió con una calidad hermosa, así debe ser siempre»**. En la pantalla principal:

- **Descargar** ya no da la copia de edición: da el **master**. Si el video ya lo es, lo baja directo (`output_original_url`). Si no, pide el master de ESE video (orchestrate `reusar_render` + `calidad: original`), muestra «Preparando original · m:ss» y, cuando está, el mismo botón lo baja. Está en `js/adelantado.js`, `botonOriginal`.
- **Publicar →** (antes no hacía nada) lleva al Calendario con este video listo para programar (`?programar=vid:<proyecto>`). Mientras hay cambios sin aplicar se espera, para no programar el video anterior. El servidor publica siempre el master.

## ⚠️ 25-sep: la lista de cortes se perdía en el camino «desde la base» (orchestrate v239)

La calidad original (Descargar y publicar) vuelve a cortar los clips originales con la **lista de cortes** (`cortes_json`)
del render. El camino rápido «desde la base» (v184) copiaba de la base las piezas del video pero **no** la lista, así que
un proyecto armado solo por ese camino no podía sacar la calidad original: caía al camino completo y ahí la función se
caía con «Cannot access 'diag' before initialization» (el diagnóstico se usaba antes de crearse).

Arreglado en v239: «desde la base» copia `cortes_json`, y el diagnóstico de los caminos que no sirven va en
`caminoPrevio` (sale en `diag.camino_previo`). Se rellenó la lista a los renders que ya existían desde su base (solo el
«Video de prueba» de la cuenta del revisor la necesitaba). El proyecto de Sergio la tenía porque se exportó una vez por el
camino completo el 24-sep y las versiones siguientes la heredaron.

# El editor en el celular (como CapCut)

*22-oct-2026*

Sergio: **«sigamos con la pantalla de el editor de tal manera que se pueda apreciar de buena manera tanto la manera
automática como la manual, así como CapCut»**. Propuesta aprobada con «sí a las tres, constrúyelo» (artefacto «Editor en
el celular»). Todo vale solo a **≤ 760 px**; en el computador el editor queda igual (las clases nuevas no hacen nada allá).

---

## La pantalla fija (los dos modos)

- **Una sola pantalla, sin bajar** (`.app` a `100dvh`).
- **Barra de arriba**: `‹` (al inicio) · el proyecto ▾ · **«✓ Fabricar»** (`.tb-fab`, nuevo en `topbar.js`); debajo, el
  interruptor **Automático / Manual**. Se esconden el logo, «Guardado», los créditos y el avatar (están en el inicio).
- **«✓ Fabricar»** abre su hoja (`s.fabHoja` → `.zone--hoja` en `main.js`) con la misma franja de multimedia
  (`C.franjaFabricar` = `genStrip` de `media.js`): fabricar, descargar, publicar, el avance. Sirve en los dos modos.
- **El video sin el marco del celular.** ⚠️ La pantalla (`.screen`) se deja del **90 % del ancho del video**, igual que en
  el computador (allá el video 9:16 es más ancho que la pantalla del iPhone): todo lo que se mide con `cqw` (subtítulos,
  títulos, gráficos) sale **del mismo tamaño** que en el video final. Se esconden la isla, el difuminado y la barra de
  Instagram (y el botón de la vista de Instagram).
- **Las hojas**: suben desde abajo, el video se achica arriba y sigue a la vista (cambia al instante). Se cierran con
  **«Listo»** o **bajándolas con el dedo** (`C.hojaDedo` en `main.js`, solo en el celular).

## Automático

- Debajo del video: ▶, tiempo y la barrita para correrlo.
- **Tus tomas** en una fila que se desliza; el «＋» sube clips. (El ✕ de cada toma no se ve: es muy fácil tocarlo sin
  querer en 44 px.)
- **Los módulos** (Edición, Texto, Movimiento, Sonido, Salida, Marca, Gráficos, Guion) son la **barra de abajo**, con
  ícono de línea (`ICONOS` en `config.js`) y se desliza de lado. Tocar uno abre su hoja con el mismo panel del computador
  (`s.openCard`, clase `.app--carta`).
- La franja de «con qué arrancó el video» **no va encima de la barra** (Sergio: «le está quitando mucho espacio a toda la
  parte de abajo de los clips y las opciones»; que vaya «donde podamos tocarlo si queremos o si no ignorarlo»). Es una
  **pastilla** en la fila de tus tomas («● Editado con Cherry ›», `arranque.js › pastilla`); tocarla abre la hoja «Cómo
  arrancó este video» con la franja entera, sus botones y una nota de qué hace cada uno (`main.js › HojaArranque`).
- No se ven en el celular: el guion de multimedia (está en el módulo Guion), «Tomas mías / Video de escenas» y la franja de
  fabricar (va en la hoja de «✓ Fabricar»; asoma solo para avisar de una subida: `.strip--avisa`).

### Subir clips desde el iPhone (22-oct)

Sergio: escoge 5 videos, toca el ✓ y «no sale ningún aviso… una persona normalmente se saldría de esa pantalla». El
iPhone **alista (comprime) los videos antes de entregárselos a la página** y con varios tarda; «Subiendo…» solo podía salir
cuando llegaban. Ahora (`media.js › triggerUpload`):
- desde que se abre el selector, la franja dice **«Preparando tus videos…»** con la explicación y «No salgas de esta
  pantalla» (`s.esperandoClips`); cuando llegan pasa a «Subiendo 5 clips… %» y después a «Cherry está revisando tus
  clips…» (antes decía «Subiendo procesando 5 clip(s)……»);
- si se cancela el selector se quita solo (evento `cancel`), y abajo hay «No escogí ninguno» por si el celular no avisa;
- el selector va **dentro de la página** (escondido): suelto, el iPhone a veces lo bota mientras está abierto y la subida
  nunca empieza.

### Subida rápida, etapa 1: ninguna subida se queda trabada en silencio (22-oct)

Plan aprobado en el artefacto «Subida rápida de Cherry» (https://claude.ai/artifact/XnadWQBG6RiKTecZ6RbYxv, «sí a las
cuatro»): 1) esto; 2) el audio primero y los cortes sin esperar el video; 3) la vista previa con los clips del celular.

Lo que pasó: Sergio subió 5 clips en 4K desde el iPhone y 2 se quedaron en `status: 'uploading'` para siempre. El motor de
tomas espera a TODOS los clips del proyecto (`motor-tomas` › `pendientes`), así que el video entero esperaba sin decirlo.
⚠️ Un clip sigue en «uploading» también DESPUÉS de terminar de subir, hasta que el procesador lo toma (`process-upload`):
un clip trabado puede no haber subido o haber subido sin que nadie pidiera procesarlo.

- **Si una subida falla con la página abierta** (`media.js › subirArchivos`): `uploadClipViaS3` dice qué clip creó
  (`alCrear`, `e.clipId`); al acabar, los que fallaron se quitan ya (`C.api.quitarClips(ids, true)` →
  `multipart-upload` v3 › `quitar` + el motor arma con los que sí están) y la franja dice «No subió…» con **Reintentar**
  (los mismos archivos, sin escogerlos otra vez) y «Dejarlos así».
- **Los trabados de antes** (`revisarTrabados`, cada vez que se cargan los clips): «uploading» sin subirse aquí y viejo
  (90 s después de terminar de subir aquí, o 10 min desde que se creó) → se pide procesarlo UNA vez (`process-upload`):
  si el archivo está, sigue solo; si no, el procesador lo marca «error». Los «error» (y los que siguen igual 2 min
  después) salen en la franja: «no terminó de subir… tu video los está esperando» con **Escoger otra vez** (se quitan y
  se suben los escogidos) y **Quitarlos** (se quitan y el motor arma con los demás). En la fila de tomas llevan «!».
- **Subida detenida:** si en 30 s no avanza nada, la franja dice «La subida está detenida. Si saliste de Cherry, quédate
  en esta pantalla: sigue sola.» (no hay diálogo del navegador al salir: regla de Sergio).
- En el celular, cuando la franja asoma por un aviso, solo se ve el aviso (lo de fabricar va en su hoja).
- `multipart-upload` v3 (versión 27 en Supabase, 22-oct): `quitar` solo borra clips del usuario que siguen «uploading» o
  «error» (nunca uno procesado), con sus transcripciones si las hubiera. Las partes que alcanzaron a subir a S3 de una
  subida incompleta no se cancelan desde aquí (no hay modo en la Lambda): quedan hasta la limpieza de S3.
- Probado en el demo con subidas de mentira: falla una → se quita y sale «Reintentar»; Reintentar → sube y el aviso se
  va; un «error» viejo → aviso con «Escoger otra vez / Quitarlo» y «!»; un «uploading» de hace 20 min → se pide procesar.

### La fila de subida se quedaba parada a la mitad (29-oct)

Sergio subió 18 clips 4K/60 del iPhone desde Chrome en Windows y la subida se quedó en 7 (39 %, «La subida está
detenida»). No era el internet (7 videos, ~600 MB, en 3,5 min: ~23 Mbps). Tras CADA video, `api.js › subirClipS3` esperaba
la duración con un `<video preload=metadata>` SIN tiempo límite y sin soltar el reproductor; desde el 5.º Chrome dejó de
contestar y los 3 obreros (`media.js › subirArchivos`, `FILE_WORKERS = 3`) quedaron esperando para siempre. Los registros
lo mostraban: «complete OK» y «process-upload» de los videos 5–7, pero ni el PATCH de su duración ni el «initiate» del 8.º.
Ahora `medirDuracion()` va aparte (la fila sigue de una), con 8 s de tope, y suelta el `<video>` siempre
(`removeAttribute('src')` + `load()`). La duración real la escribe igual el procesador. **Regla: nada que se espere dentro
de la fila de subida puede quedarse sin tiempo límite.**

### Subida rápida, etapa 2: el audio primero (22-oct) — para todos desde el 29-oct

`media.js › RAPIDA_PARA_TODOS = true` (29-oct, Sergio: «ábrela para todos»; antes solo administradores, mientras se probaba).

- **La página** (`subirArchivos` → `alCrear` → `audioPrimero`): apenas se crea cada clip, saca su audio en el celular
  (`extractAudioForWhisper`: WAV 16 kHz mono, ~2 MB por minuto; trae `duracion`), de a uno (`colaAudio`: leer un video
  entero ocupa memoria; los de más de 400 MB van como siempre) y lo sube (`C.api.subirAudioRapido`). El clip toma su
  puesto por nombre desde que se crea (`C.api.ordenClip`): el corte se arma antes de que acabe la subida y sigue ese orden.
  La franja dice «Cherry ya está armando tus cortes con el audio (2 de 5)».
- **`multipart-upload` v4** (versión 28): `audio` da la dirección firmada para `uploads/<proyecto>/<clip>/audio_rapido.wav`;
  `audio_listo` deja el clip `processed` con ese `audio_path` (y su duración) SOLO si sigue «uploading» y sin video →
  el disparador `trg_auto_transcribe` llama a `transcribe-clip` (Whisper en la Lambda) → `motor-tomas`. `quitar` ahora
  también quita un clip sin `mp4_path` (transcribió con el audio y su video no llegó).
- **`motor-tomas` v7** (versión 33): ya no exige `mp4_path` (con las palabras basta; la firma nunca lo usó). Cuando la copia
  llega, el procesador (`carrete-media-processor` v7, SIN cambios: saca el audio, marca `processed`, hace la copia y, si la
  transcripción ya estaba, avisa al motor) llama al motor → `completarVideo` pone el `mp4_path` en los cortes guardados
  (sin IA), sube la versión (escribe solo si nadie la cambió: varios clips terminan a la vez) y la página lo nota.
- ⚠️ **(22-oct, noche) el aviso del procesador se puede perder:** «El reloj de Instagram · tal cual» (subido por el chat)
  quedó con la receta sin `mp4_path` aunque el clip ya tenía su copia (receta 22:06:54.9, transcripción 22:06:54.5): nadie
  volvió a llamar al motor y la página esperaba «que terminen de subir tus videos» para siempre. `cortesvivo.js ›
  conCopias` toma el `mp4_path` del clip cuando la receta no lo trae; al pedir la base, orchestrate llama al motor y
  `completarVideo` lo deja en la receta guardada.
- **La vista previa** (`cortesvivo.js › sinVideo`): con un corte sin video no arma la vista rápida (sería a medias); la
  pantalla dice «tus cortes ya están listos · Cherry los armó con el audio. Se ven aquí apenas terminen de subir tus
  videos». La etapa 3 los muestra con los clips del celular.
- **Trabados** (etapa 1, ajustado): lo que dice si el video llegó es `mp4_path`, no el estado (con el audio primero el clip
  ya está «processed»). Los que transcribieron y esperan su video se rescatan a los 6 min (la copia de un 4K tarda).
- Probado en el demo (subidas de mentira, audio de verdad): «armando tus cortes con el audio (2 de 2)» mientras sube,
  6 s de video → 188 KB de audio, el puesto por nombre, y la pantalla de «tus cortes ya están listos». ⚠️ La transcripción
  real del WAV no se probó (gasta IA): se prueba con la primera subida de Sergio.

### Subida rápida, etapa 3: la vista con los clips del celular (22-oct) — para todos desde el 29-oct

- **`media.js › guardarLocal`** (en `alCrear`, con la subida rápida): cada clip escogido en ESTE aparato queda como
  `C.clipsLocales[clipId] = URL.createObjectURL(file)`, solo si el navegador lo puede mostrar (se prueba su
  `loadedmetadata` con `videoWidth > 0`; en Windows los .MOV del iPhone a veces no traen imagen → se espera la copia). Se
  pierden al recargar.
- **`cortesvivo.js › armarPlan`**: un corte sin `mp4_path` usa el clip del celular (`urlDeCorte`); si a alguno le falta
  todo, no hay vista (como en la etapa 2). El plan lleva `local: true` → sin el lienzo de color (pintar el original 4K pesa
  en el celular y el HDR del iPhone se vería lavado en el lienzo), etiqueta «Vista rápida · desde tu celular · cargando el
  color y el movimiento…». La vista completa (base) no se pide mientras falten copias (`asegurarBase`). `leer` vuelve a
  armar el plan cuando aparece un clip local (va en `claveClips`).
- **`fabricar.js`**: mientras faltan copias, la franja dice «Esperando que terminen de subir tus videos… Ya lo puedes ver
  y ajustar. Se puede fabricar apenas tus videos lleguen a Cherry» (fabricar ya exigía la vista completa).
- Cuando llega la copia, la receta sube de versión (`motor-tomas › completarVideo`) y la vista pasa sola a los videos del
  servidor, con color.
- Probado en el demo: corte sin copia → se reproduce el clip local, sin lienzo, con su etiqueta y la franja de espera;
  llega la copia → los tres reproductores del servidor, vuelve el color.

### La etiqueta dice qué está cargando (22-oct)

Sergio probó en el iPhone justo después de subir y creyó que Cherry no había puesto las escenas ni el movimiento: los
veía en la **vista rápida**, que no los trae (llegan con la versión completa, ~1 min después), y la etiqueta solo decía
«la fluida llega pronto». Con el modo diagnóstico (`app.html?diag=1`, `movvivo.js`) se vio que en el iPhone SÍ salen
cuando llega la versión completa. Él: «que diga cargando gráficos o cargando movimientos, así la persona sabe que no
está mal sino que ya está cargando». Ahora (`cortesvivo.js › cargandoTexto`): «Vista rápida · cargando el movimiento,
las escenas y los gráficos» (solo lo que se escogió, con «faltan ≈ 0:40» cuando se sabe), y ya en la versión completa
«Vista previa · cargando las escenas de apoyo» si aún faltan. La etiqueta baja a un segundo renglón si no cabe.

### 29-oct (tarde): los clips se ven mientras suben

Sergio subió 18 clips y «multimedia» dijo «Sin clips aún» toda la subida: la lista solo se volvía a leer al final (tras
esperar hasta 5 min a que se procesaran). Ahora (`media.js`):
- cada clip aparece apenas se crea (`alCrear` → `refrescar`: vuelve a leer la lista, de a una vez aunque lleguen varios
  avisos juntos), con «Subiendo» y cuánto va (`SUB.pct`, `pctClip`: se escribe directo en `.js-clip-pct`, sin redibujar);
  mientras sube no se arrastra ni se quita (✕). Al terminar sale de «Subiendo» y queda la ruedita hasta que Cherry lo
  procesa; el sondeo de «revisando» pone la lista al día cada 4 s.
- su foto sale del ARCHIVO (`guardarLocal` › `fotoLocal`: un cuadro a los 0,5 s, 240 px, en `C.miniLocal`) mientras llega
  la del servidor. Si el navegador no da el cuadro (algunos celulares sin tocar «play»; .MOV del iPhone en Windows), queda
  el color de siempre. Se pierde al recargar.
- Probado en el demo (`_demo-subida.html` + `_subida-falsa.js`, subida de mentira con 6 clips reales): «Sin clips aún» →
  a los 6 s «3 clips» con foto y «Subiendo 65 %» → a los 14 s «6 clips» (3 revisando, 3 subiendo) → al final «6 clips ·
  00:45», sin ruedas.

### 29-oct (tarde): la vista previa ya no acapara las conexiones con Amazon

El navegador abre máximo **6 conexiones a la vez con cada dirección** (Amazon S3 no usa HTTP/2), y un `<video>` cargado,
aunque esté pausado y escondido, puede dejar una ocupada. Todo iba por la misma dirección del cubo
(`…editorvideo.s3.us-east-1.amazonaws.com`): tu video, las escenas, los sonidos y las subidas. Ahora:
- **Escenas de apoyo** (`movvivo.js`): se piden con `enlacesBiblioteca(keys, true)` → la dirección **dualstack**
  (`…s3.dualstack.us-east-1…`, la misma del modo Manual). Solo se cargan por adelantado las 2 siguientes que empiezan en
  los próximos 6 s (antes, todas las de 15 s) y la que ya pasó se SUELTA (`soltarEscena`: sin dirección y fuera de la
  página). Medido en el demo (`_demo-escenas.html?diag=1`, 3 escenas en 43 s): antes los reproductores subían a 3 y nunca
  se soltaban; ahora máximo 1 y 0 al final, y las escenas se ven en los mismos segundos.
- **Capas de la edición a mano** (`edicionvivo.js`): igual, la capa que ya pasó o queda lejos se suelta (`soltarVideo`).
- **Subidas** (`multipart-upload` y `get-upload-url`, firma «firma de subidas» igual en las dos): se firman para la
  dirección **global** del mismo cubo (`…editorvideo.s3.amazonaws.com`), con su propia fila de 6 conexiones. Las partes
  de la subida grande ya no usan la firma de la Lambda (queda de respaldo, `url_r`); el audio y la subida pequeña traen
  también la de siempre (`url_r` / `upload_url_r`). `api.js`: si una parte falla, los reintentos van por la de siempre.
  La firma codifica la llave (RFC 3986): un archivo pequeño con espacios o tildes en el nombre ya no daña la firma (antes
  sí). Comprobada: 12 de 12 firmas idénticas a las de botocore (llaves de ejemplo; `scratchpad/subida/comparar_firma.py`)
  y, con la llave real, Amazon responde «NoSuchUpload» (firma aceptada) a una parte de una subida que no existe, sin
  escribir nada. Las tres direcciones tienen el mismo CORS (`*`, PUT, ETag visible).

## Manual

- El video arriba (34 % del alto); debajo ▶ · tiempo · ↶ ↷; la línea de tiempo; la barra de abajo.
- **La línea blanca se queda quieta en el centro** y el dedo corre la línea por debajo (`manual.js › medir`, `PAD`: el
  espacio antes del segundo 0 = media pantalla). Al correrla, el video va al momento del centro (`irAlCentro`); al
  reproducir, la línea se corre sola (`centrar`). Tocar la línea mientras suena la detiene.
- **Dos dedos acercan o alejan**, siempre alrededor de la línea blanca. Arranca con unos **12 s a lo ancho**.
- De cada pista solo se ve su color (26 px). **«Ver pistas»** abre los interruptores.
- **Tocar** (sin deslizar) escoge; **mantener el dedo quieto medio segundo y arrastrar** mueve (de lugar o de línea),
  como el mouse en el computador; las **asas blancas** de la toma (y la derecha de la escena) escogida la recortan.
- **La barra de abajo cambia** según lo escogido (lo mismo de «Lo escogido»):
  - nada: Agregar · Tus clips · Partir (la toma bajo la línea blanca) · Ver pistas;
  - toma: Partir · Duplicar · Más · Quitar; voz: Volumen · Quitar; subtítulo: Corregir · Quitar;
    gráfico: Otro · Editar · Quitar; escena: Otra toma · Editar · Quitar; efecto: Cambiar · Quitar;
  - «‹» suelta lo escogido.
- «Más / Editar / Corregir / Agregar / Tus clips» abren **la hoja** (el panel de arriba del computador, a una columna,
  sin la foto: lo escogido se pone en el video de arriba). En el celular se agrega con «＋ Agregar» (no se arrastran las
  fichas).

### ⚠️ Lo que costó (para no repetirlo)

- Los bloques tenían `touch-action:none` (en el computador se arrastran con el mouse): con el dedo encima **no se podía
  correr la línea**. En el celular van `pan-x pan-y`.
- Para mover con el dedo hay que **impedir que el navegador corra la línea**: eso solo se puede si ya había un oyente
  `touchmove` no pasivo **antes** de que el dedo bajara (uno fijo en `.mn-tl`); si se pone después, el navegador corre la
  línea sin preguntar y manda `pointercancel`.
- Al acercar, la línea se vuelve a pintar y el elemento tocado sale de la página: el navegador le sigue mandando a **él**
  los movimientos del dedo (ya no llegan a la línea). Por eso también se le ponen los oyentes al elemento tocado.
- `pointercancel` ya no vuelve a pintar toda la línea si no se estaba arrastrando nada (pasaba al empezar cada deslizada).

## Pruebas (22-oct, Chrome con dedos simulados, 390 × 844)

Deslizar → la línea se corre 255 px y el video va a 8,8 s · tocar una toma → la barra cambia · asa derecha → «Toma
recortada · 3,2 s» · «Más» abre la hoja · tocar un subtítulo → Corregir · Quitar · dos dedos → de 1205 a 402 px y sigue
en 3,0 s · reproducir → la línea sigue al video · mantener y arrastrar la toma 2 → «La toma 2 pasó a ser la 3» · bajar
la hoja de Texto → se cierra · el menú del proyecto cabe. En el computador: Automático y Manual iguales que antes.

## Archivos

`css/styles.css` (el bloque «EL EDITOR EN EL CELULAR», al final), `css/manual.css` («MANUAL EN EL CELULAR», al final),
`js/main.js` (clases de las zonas, `HojaFabricar`, `C.hojaDedo`), `js/components/topbar.js` (`.tb-fab` y clases),
`js/components/config.js` (íconos, «Listo»), `js/components/media.js` (`C.franjaFabricar`, `.strip--avisa`),
`js/components/manual.js` (todo lo de Manual).

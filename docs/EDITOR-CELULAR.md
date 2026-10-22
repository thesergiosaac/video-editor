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

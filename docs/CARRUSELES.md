# Carruseles automáticos

Lo que Sergio pidió (26-sep-2026): carruseles «de la manera más automatizada posible»: unos 100 % con IA, otros con
fotos y videos suyos que Cherry edita sola (recortar, grano, transparencias, opacidad) para que queden del estilo que
propone. Se construye SOBRE la herramienta que ya existía (`herramientas/carruseles.html`), no aparte.

- Referencias analizadas (8 carruseles, 61 láminas): `Downloads\Cherry Carruseles\Referencias\` y el análisis en
  https://claude.ai/artifact/AWjABXjLHmZRavMxrnfYbc (copia: `Downloads\Cherry Carruseles\ANALISIS-Y-PROPUESTA.html`).
- Comparación de bibliotecas de imágenes: https://claude.ai/artifact/6PFrJP1x5RjjBkVohkRS9X
- La fase 1 enseñada antes de publicar: https://claude.ai/artifact/WWwx1YY8HUiW2dtZsH8qAD

## Lo decidido por Sergio

- **Lámina por lámina.** Escoge cuántas (3 a 10, con portada y cierre) y cada una va en **Cherry** (la escribe sola),
  **Descrito** (dice de qué trata) o **Textual** (sale letra por letra). Se puede partir de un guion o de un tema.
- **El objetivo decide el cierre.** Enseñar, Conversación, Inspirar, Llevar a algo, Vender, Ganar seguidores. La palabra
  clave (y más adelante la respuesta automática) SOLO con «Llevar a algo» y «Vender».
- **Primero imágenes; animaciones y video después.** «Empecemos de lo más básico».
- Estilos para empezar: los que yo escogiera → Diario personal, Revista y Frase con foto.

## Fase 1 (hecha el 27-sep, en prueba)

### «Nuevo carrusel» — 6 pasos
1. De dónde sale (guion / video / tema) · 2. La fuente · 3. **Lámina por lámina** (`E.crear.total`, `E.crear.plan`
[{modo, texto}]) · 4. **Objetivo** (`E.crear.objetivo`, `E.crear.palabra`) · 5. **Fotos** (opcional, hasta 10) ·
6. Estilo y colores.

- `planNormal()` mantiene portada (0) y cierre (último) al cambiar el total; las del medio son ideas.
- `aplicarPlan()`: lo **Textual** se pone encima de lo que devuelve la IA, tal cual, y borra el texto de apoyo
  (la lámina dice exactamente lo que se escribió).
- Sin IA: `cierrePorObjetivo()` pone el cierre del objetivo (`OBJETIVOS[].ej`, `{P}` = la palabra).

### Fotos
- Se achican en el navegador (lado mayor 1600 px, JPG 0,88) y suben al cubo PRIVADO **`carruseles`**
  (`carruseles/<user_id>/<foto>.jpg`, `servidor/base/19-carruseles-bucket.sql`). Se pintan con direcciones firmadas de
  12 h (`firmarFotos`); en la sesión, desde la copia local (`LOCAL`).
- El carrusel guarda poco por foto: `{id, ruta, w, h, cara:[x,y], libre, luz, desc}`. Cada lámina: `foto` (id),
  `clave` (palabra a destacar) y `trato` ({osc, grano, bn, blur, pos, partida}).
- **Cherry las mira**: acción `carrusel_fotos` (gpt-5-mini con imagen, `detail: low`, miniaturas de 384 px): qué
  muestra cada una, el centro de la cara (encuadre), la franja libre para el texto y a qué lámina va. Sin IA: la franja
  con menos detalle (`mirarFranjas`, en el navegador) y las fotos en el orden en que se subieron.
- `borrar-cuenta` borra también el cubo `carruseles` (v4).

### Los 3 estilos con foto (`CON_FOTO`, `htmlLaminaFoto`)
- **Diario personal** (de Conexión): foto oscurecida con grano, la palabra clave en Anton amarilla (`--c-dos`), lo
  que va entre `_guiones bajos_` en Yellowtail, «1/4» arriba.
- **Revista** (de Dolor): mayúsculas limpias, marco de selección sobre la palabra clave, flecha; «texto arriba, foto
  abajo» (`partida`).
- **Frase con foto** (de Aesthetic): frase grande crema arriba, la palabra clave en Playfair cursiva de color, firma
  con el nombre de la marca; alterna izquierda y derecha; el cierre en papel claro con la foto desvanecida.
- La palabra clave: la que da la IA (`clave`) si sigue en el título; si no, la más larga. La puntuación que la sigue
  va pegada a ella (si no, «?» caía sola en otra línea).
- ⚠️ Al escribir encima de la lámina se lee con la clase `.leyendo` (sin `text-transform`): `innerText` devuelve las
  mayúsculas del diseño y las guardaría.

### 6 estilos más (27-sep, pedidos para revisar: «primero dame más estilos, yo los reviso»)
Catálogo con los 9: https://claude.ai/artifact/EDecoApDQjrr18xEUQHBfK
- **Resaltador** (de Guía): título en barras (`.l-barra`, ⚠️ NO `.barra`: ese nombre ya es la barra de arriba de Cherry y
  la volvía `display: flex`), clave en `--c-dos`, texto en caja blanca, firma abajo a la izquierda.
- **Póster** (de Novedades): papel `assets/carruseles/papel-blanco.jpg` (Pexels 28380286, 1080×1350), foto enmarcada y
  torcida, clave enorme en Anton del color de la marca; cierre a todo color. Sin flecha a mano: la de dominio público
  que hay es geométrica, no de marcador.
- **Paso a paso** (de Tutorial): negro, «Paso N» en degradado (`background-clip: text`, sale bien en la descarga), foto
  en marco con brillo.
- **Tuit**: la idea como tuit con el nombre de la marca (`FIRMA`) y un @ sacado de él, sobre la foto desenfocada. Sin
  palomita de verificado.
- **Chat** (de Guía estilo redes): título en burbuja gris, texto en burbuja del color de la marca.
- **Álbum**: polaroid sobre el mismo papel, título en Caveat en el borde, texto en Playfair cursiva debajo.
- `TEXTO_APARTE` (Póster, Álbum): el texto va en `.l-bajo`, fuera del bloque del título (no lo achica `ajustar`; se
  limita a 4-5 líneas).
- El servidor (v40) pide textos cortos para los 9 estilos con foto.
- Faltan Collage y Cuaderno: necesitan papel rasgado, cinta y clips con licencia clara; no se dibujan en código.

### Editor · Diseño → «Esta lámina»
Foto (cambiar, «Sin foto», subir otra), Oscurecer, Grano, Desenfoque, Color / Blanco y negro, Dónde va el texto (donde
quepa / arriba / centro / abajo), Encuadre en Revista, y «Usar este ajuste en todas».

### Servidor (`herramientas`, v40)
- `carrusel_armar` recibe `objetivo`, `palabra`, `plan`, `estilo`; devuelve además `clave`, la clave de cada idea y
  `palabra`. Con estilo de foto pide textos de 90 letras. **Nunca corta a la mitad de una frase** (tope 190): si la IA
  se pasa, la página achica la letra. Sin los campos nuevos responde igual que antes.
- `carrusel_fotos` (nueva).

### Arreglo de paso: las descargas salían con letras genéricas
html-to-image no puede leer la hoja de Google Fonts (otro dominio: `SecurityError … cssRules`) y devolvía `''`; las
láminas salían con Arial. Pasaba también con los 4 estilos de texto. Ahora `letrasIncrustadas()` baja la hoja, se
queda con los bloques `latin` y mete cada archivo de letra en base64 (`fontEmbedCSS`).

### Cómo se prueba sin tocar nada
Copia de prueba en el scratchpad de la sesión: `ve/carr/` (servidor «cherry-prueba», puerto 8777) con
`_falso_carr.js` (base, almacén e IA falsos; `#real=1` usa respuestas REALES grabadas en `_ia_grabada.json`) y
`_sync.py` (copia la herramienta del repo). Recorrido automático: `#auto=crear` o
`#auto=editor&estilo=diario&lam=2&panel=diseno&descargar=1`.

## Lo que falta
- **Bibliotecas**: la biblioteca de Cherry (escogida a mano: Kaboompics, museos, 3D) y la búsqueda en Pixabay y Pexels
  (necesitan dos llaves gratis de cuentas de Sergio) y en The Met / Art Institute (sin llave). Espera su decisión.
- **Fase 2**: imágenes con IA (con personaje: Gemini Nano Banana 2, pago que activa Sergio; sin personaje: el dibujante
  de las viñetas), con tope por cuenta, y los estilos que necesitan texturas (Collage).
- **Fase 3**: animaciones y video en las láminas.
- **Fase 4 (después de Meta)**: programar el carrusel en el Calendario (tipo CAROUSEL en `ig-publicar`) y ofrecer la
  respuesta automática de la palabra del cierre.

## ⭐ El giro: COMPOSICIÓN (27-sep-2026, noche)

Sergio vio los 9 estilos: «están bien, pero las veo muy pobres, no es algo que yo usaría… las referencias sí me
impactan». Y lo precisó: «las referencias tienen diseño: una imagen convertida a blanco y negro y granito, tipo
editorial, otras como notificaciones, otras en pantallas, otras en papel, otras en el cielo, se pueden recortar unos
labios, un cerebro… necesita más COMPOSICIÓN» y «el problema no son las imágenes, es cómo las estás usando».

Prueba APROBADA («exceleeeeente»): las MISMAS fotos en 6 composiciones — https://claude.ai/artifact/P9Vasur1464vcDGK9etXh6
(fuente en `Downloads/Cherry Carruseles/banco-de-pruebas/impacto/composicion.html`):
1. Editorial B/N con grano sobre papel, círculo de color detrás de la cabeza, palabra gigante detrás, etiqueta de papel.
2. Notificaciones (estilo iOS) sobre la foto en B/N desenfocada; los mensajes los escribe la IA.
3. La foto dentro de un teléfono torcido, la palabra detrás del teléfono, un dato en pastilla.
4. Recortes sobre papel: franja de los ojos + mano con el café como sticker (borde blanco) + etiqueta de color.
5. La persona recortada sobre un cielo de la biblioteca + frase a mano.
6. La boca recortada en un marco blanco + pregunta + palabra clave.

**La idea para construirlo:** «recetas de composición» (un diseño con huecos anclados a la cara/cuerpo) + la IA como
director de arte (escoge receta por lámina según lo que dice, sin repetir; escribe los textos de adentro; escoge la
foto). Material que Cherry prepara sola: persona (MediaPipe en el navegador), objetos (rembg `isnet-general-use`, MIT,
en el servidor), detalles de la cara (MediaPipe Face Landmarker), B/N, grano, encuadre.

## Mañana (28-sep), lo que pidió Sergio
1. **Familias de estilos** como la composición aprobada, **varias, cada una con sus características**.
2. **Que a cada marca le queden diferentes sus carruseles** (no que todas las marcas saquen el mismo diseño).

Dos familias que pidió Sergio antes de irse (27-sep):
- **Recortes de revista:** todo como recortado de revistas: letras, fotos y pedazos con bordes de tijera, en collage.
- **Calcomanías:** lo que se quiere representar va como una calcomanía pegada. «Si estamos hablando de conocimiento
  puede ser la calcomanía de un cerebro pegada»: la IA escoge el objeto según la idea de cada lámina.

Sus referencias de esas dos familias (en `Downloads/Cherry Carruseles/Referencias/`):
- `RECORTES DE REVISTA/revista-01.png`: póster collage punk/editorial «DISRUPT». Capas de papel rasgado, fotos en blanco
  y negro (edificio, multitud, una cara con franja negra sobre los ojos), un ojo en rojo en primer plano, letra enorme
  roja desgastada, etiquetas de máquina de escribir, notas a mano, código de barras. Rojo, negro y papel.
- `CALCOMANIAS/calcomanias-01.png`: hoja de calcomanías troqueladas con borde blanco sobre gris, amontonadas: objetos
  (labios, cerezas, leopardo, bola 8, luna, billetes, carro), letreros, números (444, 11:11), una señal de ruta; mezcla de
  blanco y negro y color. ⚠️ Trae logos de marcas (LA, The North Face, Rip Curl, DC): esos NO se usan.

La fase 1 (paso por lámina, objetivo, fotos, 9 estilos) sigue en esta rama SIN publicar; el servidor sí está en main.

## Familias de estilos (28-sep-2026)

Hechas y publicadas para que Sergio escoja: https://claude.ai/artifact/SWKssgp4niQEh2DbnLMK6W. Once familias con la
misma historia en 3 láminas (portada, idea, cierre) y las mismas fotos, para comparar solo el estilo. Sergio dejó más
referencias en `Downloads/Cherry Carruseles/Referencia Estilos/` (carpetas Cinematografico, Conceptual, Griego, Neon,
«Ponle nombre a este estilo» y «Nueva carpeta»).

| Familia | De dónde sale | Lo que la define |
|---|---|---|
| Editorial | la aprobada del 27-sep | B/N con grano, papel, círculo de color, palabra detrás de la cabeza, notificaciones, detalle recortado |
| Recortes de revista | la pidió él (ref. DISRUPT) | papel rasgado real, persona en semitono, franja negra en los ojos, letras de secuestro, letra roja gastada, máquina de escribir, código de barras |
| Calcomanías | la pidió él (ref. hoja de calcas) | todo troquelado con borde blanco sobre gris; el objeto sale de la idea (reloj, billetes, cerebro, labios) |
| Cinematográfico | carpeta Cinematografico | foto oscura y cálida con viñeta, frase chica + palabra gigante en serif, la palabra detrás de la cabeza, botoncitos arriba y línea legal abajo |
| Conceptual | carpeta Conceptual | negro con cuadrícula tenue, pesos mezclados, selección morada, persona B/N + un objeto a color surrealista (el cerebro en la taza), tabla de pasos |
| Bitácora (nombre propuesto) | carpeta «Ponle nombre» | papel de lino, serif angosta en cursiva, fotos en fila con flechas a mano, cierre con la palabra entre comillas enormes |
| Clásico | carpeta Griego | papel de fibra, letra gótica gigante, círculo rojo oscuro, estatua del Met en semitono, columna angosta |
| Neón | carpeta Neon | fondo plano, la persona en 5 manchas de color, letra negra gigante también vertical, número de capítulo |
| Póster urbano (nombre propuesto) | carpeta «Nueva carpeta» | papel crema, palabra negra gigante, persona a color, paneles rojos, frames de ciudad de la biblioteca de clips |
| Cuaderno | propuesta mía | cuadriculado, polaroids, notas adhesivas, resaltador, cuentas a mano |
| Pantallas | propuesta mía | buscador con sugerencias, chat, caja de comentario con la palabra clave; sin logos |

**Herramientas nuevas** (en `Downloads/Cherry Carruseles/banco-de-pruebas/familias/`, ver su LEEME):
`semitono.py` (semitono de imprenta real: puntos a 45° cuyo tamaño sigue lo oscuro; gamma < 1 para pieles oscuras),
`neon.py` (posterizado a 5 colores planos con bordes suavizados, OpenCV), `_render.sh` (Chrome sin ventana → láminas).
En Cherry, lo del servidor iría junto a rembg; lo del navegador (grano, B/N, viñeta, letra gastada) es CSS.

**Material y licencias:** estatuas del Met (Open Access, CC0, API sin llave), flechas a mano de freesvg.org (CC0; las
fuentes de letra a mano de Google NO traen flechas), papel de lino y de fibra de Pexels, iconos Tabler (MIT), frames
de la **biblioteca de clips de Cherry** (Sergio dio permiso el 28-sep: «esos son nuestros»). La biblioteca se lee de
`biblioteca_escenas` y los archivos están en S3 `remotionlambda-useast1-editorvideo/media-library/`.
⚠️ Algunos clips son escenas de películas con actores conocidos (p. ej. `a34_Cinematico`): esos NO van en carruseles.

**Lo que no quedó igual a las referencias (dicho en la página):** el neón es foto posterizada, no ilustración a mano;
el Conceptual usa a la persona en B/N en vez de fotos antiguas de los 50 (se pueden sumar fotos viejas de dominio
público); el papel de la Bitácora es liso (la referencia está doblada).

**Que cada marca se vea distinta (propuesta en la misma página):** A) la marca escoge 1 a 3 familias; B) su firma
(colores, letras y un elemento fijo); C) tratamiento de foto; D) perilla sobria ↔ atrevida; E) semilla propia de
composición; F) su propio material primero; G) aprender de sus carruseles de referencia. Recomendado: **A + B + E + F**
primero; C y D como perillas; G después.

**Esperando a Sergio:** qué familias se quedan, si le sirven los nombres «Bitácora» y «Póster urbano», y si vamos con
A + B + E + F.

## Prueba de verdad: dos carruseles de 9 (28-sep-2026) — EN PAUSA

Sergio pidió uno Editorial (editar en automático con Cherry) y uno de Calcomanías (nunca es tarde para empezar de
cero), «como si fuera para mis redes»: https://claude.ai/artifact/TAGMCNW12NXqLXTxTsh27G (fuente en
`Downloads/Cherry Carruseles/banco-de-pruebas/reales/`, LEEME).
- v1: le gustó el editorial, pero NO un modelo de stock como protagonista («yo no puedo poner esa persona en mis
  redes») y el cielo no decía lo del texto. Calcomanías: «le falta impacto, color, diseño».
- v2: editorial sin personas (una mano con el celular, pantallas hechas en HTML dentro de la foto, calendario tachado,
  subtítulos karaoke); calcomanías con fondo de amanecer y más calcas.
- **Veredicto:** calcomanías v2 «horrible»; editorial «está bien», pero no lo publicaría porque **no tiene su identidad
  de marca**. Lo dejó en pausa. Al retomar: empezar por la identidad de la marca (colores, letras, cómo se ve la
  cuenta), que es la parte 2 («que cada marca se vea distinta»).

## ⭐ Versión 2 (30-sep-2026): composición con control total — LA QUE MANDA

Diseño completo y aprobado en `Downloads\Cherry Carruseles\PARA-IMPLEMENTAR\INTEGRACION.md` (+ prototipo). Sergio dijo
«sí, inicia» y se implementó en la rama `carruseles-composicion` (worktree aparte, `C:\Prueba Claude Code\cherry-carruseles`,
para no pisar al chat que trabaja el editor en `main`). **Sin publicar** hasta que Sergio lo diga.

### La pantalla (`herramientas/carruseles.html` + `herramientas/carruseles/`)
- `app.js`: lista → **Empezar** (Dame ideas · Te cuento la idea · Lámina por lámina · Desde un video) → Ideas → Estilo →
  **Editor**. Guarda en `herramientas_datos › carruseles@<marca>` con `v:2`. Los carruseles `v:1` salen en la lista como
  «versión anterior» y se rehacen con sus textos. Nunca diálogos del navegador (ventana propia).
- `lienzo.js`: cada lámina es una **lista de elementos**; tocar = seleccionar (marco, esquinas, lados, giro), arrastrar con
  imán y guías, doble toque para escribir, teclado (Supr, flechas, Ctrl+D/Z/Y), barra fija arriba (duplicar, adelante,
  atrás, bloquear, borrar), deshacer de 60 pasos, `LZ.tipo()` para tipos propios de una familia. Letras y colores por
  papel (`@titular @mano @cuerpo @principal @acento @fondo @texto`).
- `familias.js`: catálogo de las 18 familias aprobadas + **Guardable** (la primera en vivo) + utilidades (`encuadre`,
  `mapa` de la rejilla, `fotoEl`, `recorteEl`, `mejorFoto`). Cada familia nueva vive en `familias/<id>.js` y se registra.
- `tapas/<id>.jpg` (portada de muestra de cada familia), `piezas/` (flechas y texturas), `iconos.js` (lucide).
- Panel de UN elemento al tocarlo (texto, foto, celular, forma, rayas, flecha, barra, grano) + pestañas Texto (todos los
  textos, «Pídele a Cherry», texto de la publicación), Material (biblioteca de fotos y cuadros de clips), Diseño (estilo,
  tamaño 3:4/4:5, rearmar/duplicar/quitar/mover lámina), Letras (kit del carrusel, combinaciones, guardar en la identidad
  de marca) y Capas.
- Descarga en el navegador: html-to-image con las letras en base64 y TODAS las imágenes/máscaras incrustadas.
  ⚠️ La textura de grano debe ir como `url('data:…')` codificada: con comillas dobles rompía el atributo style y la
  descarga fallaba («[object Event]»).

### El servidor
- **Función propia `carruseles`** (`servidor/carruseles.ts`, NO toca `herramientas`): `foto_analizar`, `fotos`, `ideas`,
  `dirigir` (llena el ESQUEMA que manda la familia, campo por campo con su tope de letras), `desde_video`, `reescribir` y
  transcripción de un video subido (multipart con el audio WAV → Whisper con segundos por palabra).
  Acepta la llave interna + cabecera `x-prueba-uid` solo para pruebas.
- **Lambda `carrete-carruseles`** (`servidor/lambda-carruseles/index.js`; se empaqueta con `rvm.onnx`, `yunet.onnx` y
  `node_modules/onnxruntime-node`, capa `carrete-ffmpeg:1`): silueta RVM (6 pasadas sobre la misma foto para que «caliente»),
  cara YuNet (decodificada a mano, igual que OpenCV), rejilla 120×N de persona/detalle/luz y el recorte PNG del rectángulo
  de la persona. ~3 s por foto. Permiso de invocación para el usuario `carrete-servidor` (política de la función).
- **Tabla `carrusel_fotos`** (`servidor/base/21-carrusel-fotos.sql`): lo que Cherry vio en cada foto; RLS por dueña.
- Fotos y recortes en el cubo privado `carruseles/<user_id>/…` con direcciones firmadas de 12 h (se renuevan al abrir).

### Cómo se prueba sin tocar la cuenta de nadie
Copia en el scratchpad de la sesión (`prueba-car/`, servidor «carruseles-prueba-real», puerto 8796) con un CherryApp de
prueba que usa la cuenta de desarrollo `dev@carrete.app` (sin datos). `ver.html?f=<id>` dibuja una familia con 4 fotos
analizadas; `ver.sh <id>` saca la captura. Nunca va al repo.

### Las 12 familias en vivo (30-sep)
Guardable (en `familias.js`) + `familias/`: aire, letra, charla, marca, cintas, brillo, revista2, libreta, crema, frase,
stickers. Probadas las 12 con la IA de verdad (10–19 s cada una) y con fotos reales. Reglas que salieron de esa prueba:
- **Fotos para texto encima**: solo las que tienen la cara < 7 % del cuadro. Los primeros planos (y los fotogramas de
  videos viejos) van como «clips» (celulares, tarjetas). Sin esto el texto quedaba escondido detrás de la cabeza.
- **Texto chico nunca detrás del recorte** (tam < 56): se come las letras. Los grandes sí (regla 13).
- **El director corta en palabra entera** (`cabe()`), sin conectores colgando («u», «para», «con lo») y con los
  asteriscos en pares; respeta los saltos de línea que pide el esquema.
- `_cabe: N` en un texto = cabe en UN renglón de N px (se achica al medir). `LZ.listas` espera a que llegue la hoja de
  Google y carga 400–900 y cursiva (antes se medía con la letra de reemplazo).
- Nombre de la marca → el director (firmas y rúbricas). Ningún ejemplo del esquema lleva el nombre de Sergio.
- Libreta: fondo (granito/madera/concreto/mármol) y libreta (espiral/hoja/rasgada) en `catalogo.opciones`; la familia lee
  `contenido.opciones` — FALTA el selector en la pestaña Diseño.
- Paso con brillo necesita capturas de pantalla reales (regla 7): hoy usa una foto si no hay `mat.capturas`.

### Lo que falta de la fase A
- Probar con la cuenta de Sergio SOLO cuando él lo diga (su identidad de marca está sin llenar).
- Publicar: juntar con `main` (traer lo del otro chat primero), revisar bloques duplicados y subir.

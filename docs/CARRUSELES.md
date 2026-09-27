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

# Letras de marca — 4 plantillas de subtítulos (30-sep-2026)

Las 4 plantillas de @sergiosaac.co aprobadas en el taller (`Downloads\Cherry Taller\titulares\IMPLEMENTAR-LETRAS-DE-MARCA.md`):
**BLUR** (la principal), **Cinematic**, **Citadel** y **Pairings**. Son copias fieles MEDIDAS de sus referencias de
Pinterest: cada línea ocupa una fracción del ancho y todo va arriba, sobre la cabeza (del 8 % al 28 % del alto). No
«mejorarlas».

| id | Nombre | Qué tiene |
|---|---|---|
| `marca_blur` | BLUR | C fina arriba · A en Archivo Expanded negra cursiva MAYÚSCULAS que entra deslizándose con estela · BL/BR a los lados |
| `marca_cinematic` | Cinematic | A grande blanca · B en Instrument Serif cursiva · C pequeña, las dos a la derecha |
| `marca_citadel` | Citadel | B en caligrafía (Pinyon Script) montada sobre A · C debajo |
| `marca_pairings` | Pairings | C arriba a la derecha · A en Playfair cursiva · B en una caja del acento que se abre |

## Los papeles (sin cambiar la IA)
- **A** = la palabra clave que ya marca la IA de frases (orchestrate › SISTEMA_FRASES).
- **C** = lo que va antes de A.
- **B** = el remate de lo que sigue a A: después de la última coma, sin las palabras vacías del comienzo, máximo 3
  («de una notificación» → «notificación»; «externa, emocional» → «emocional»; «su estado de ánimo» → «estado de ánimo»).
- **BLUR**: lo que sigue a A partido en dos (BL izquierda, BR derecha; una sola palabra va a la derecha).
- Las palabras que no caen en ningún papel no se dibujan (así es la referencia).

## Movimiento
Cada palabra entra **en su segundo** (−0,04 s) en 0,22 s de borrosa a nítida subiendo (la grande el doble); la frase se va
0,22 s antes de la siguiente desenfocándose en 0,18 s. BLUR: A entra desde −260 px en 0,3 s y deja estela. Pairings: la
caja se abre de izquierda a derecha en 0,25 s.

**Cambio del 30-sep (noche, Sergio: «desaparece muy rápido», «disperso», «la grande más grande»):**
- La frase entra **0,45 s antes** de su primera palabra (`ANTICIPO_MARCA`; la anterior conserva ≥ 0,6 s) y **todas las
  palabras entran juntas** con ella (la grande ya no espera a decirse). El subtítulo anterior se va 0,22 s antes de que entre.
- BLUR compacta: A hasta 92 % del ancho (tope 330 px); C pegada encima de A y BL|BR pegadas debajo, juntas al centro,
  según el tamaño REAL de A (`0,42·pxA + 0,6·px`). Servidor (`componerMarca`) y página (`paginaMarca`) iguales.

## Color
`simple.colores[plantilla]` = `{ acento, texto, pinta }`: acento (lima `#C8F556` por omisión; paleta aprobada de 13 +
cualquiera), letra base `#FFFFFF` o `#111111`, y `pinta` = qué papeles van con el acento (`'BC'`, `'AC'`…). BLUR: a los
lados la primera de la izquierda va con la base y la de la derecha con el acento. El video nunca se oscurece.

**Sombra (30-sep)** — `simple.colores[plantilla].sombra` = `sin | suave | media | fuerte` (por omisión **fuerte**), chips
«Sombra» en el panel de colores. Se pidió porque el lima no se leía sobre fondos claros. Capas (px del video de 1080):
suave `2/7/.32` · media `2/3/.5 + 6/14/.6` · **fuerte `4/4/.81 + 4/16/.67`** (dy/blur/opacidad). Desde la noche del 30-sep
viene en **Fuerte** (Sergio escogió la «A»; es la MISMA sombra de los subtítulos normales, `componerSimple`). Con letra oscura es un brillo
blanco. La palabra grande de BLUR ahora también la lleva, ENCIMA de su estela lima (misma capa que la letra, escrita
antes): debajo, la estela la tapaba. Espejo exacto: `SOMBRAS_MARCA` en la Lambda y en la página (CSS blur = 2× ASS).

## Dónde vive
- **Video final:** Lambda `carrete-layer2` › `subtitulos.js` (`MARCA`, `rolesMarca`, `componerMarca`, una capa por palabra
  con `\move`, `\blur` y `\t`). Fuente actual (30-sep, sombra): `Downloads\Cherry Contenido\P25-editado/trabajo\l2_nuevo` (zip `l2_sombra.zip`; respaldo
  del anterior en S3 `deploy/carrete-layer2-respaldo-20260930-RSTD0tM.zip`). ⚠️ `desplegar_layer2.py`
  apunta a una carpeta VIEJA (18-sep): no usarlo.
- **Letras:** `InterTight-Bold/SemiBold/LightItalic`, `PinyonScript-Regular`, `PlayfairDisplay-ExtraBoldItalic`,
  `ArchivoExpanded-BlackItalic` (estática al 125 %), en `letras/` de la Lambda y en `fonts/` de S3 (el ensamblador las baja
  todas en cada video).
- **Página:** `js/components/subtitulos.js` (`MARCA`, `rolesMarca`, `paginaMarca`, `MUESTRAS_MARCA`; en vivo cada página
  lleva `tiempos`), `css/styles.css` (`.sp-marca`, `spMarcaIn/Desliza/Caja/Sale`), `config.js › panelColoresMarca`,
  `app.html` (Google Fonts), fondo de las fichas `assets/plantillas/marca.webp`.
- Probado: local contra `LETRA-P1…P4.mp4` del taller (mismos cuadros) y en la nube con el ffmpeg de la Lambda.

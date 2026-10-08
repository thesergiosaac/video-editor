# Todo separado por marca (25-sep-2026)

Sergio: *«este desplegable no debería existir, si una persona tiene varias marcas las cambia desde el menú, el
calendario debe ser dividido por marcas, igual los proyectos… TODO DEBE IR SEPARADO POR MARCAS»*.

Una **marca** es una de las `cuentas` del documento del Laboratorio (`herramientas_datos › laboratorio`): `{ id, nombre }`.
La activa es `activa`. Se cambia desde el menú de la foto (`js/cuenta.js`), en todas las páginas, y al cambiar la página
se recarga. **Ninguna herramienta tiene un desplegable de «con qué cuenta»**: la cuenta de Instagram es la de la marca
activa; para publicar en otra se cambia de marca.

## La marca activa se cuenta igual en todas partes

La `activa` si existe en la lista; si no, la primera; si no hay lista, `principal`. Está escrita cuatro veces y tienen
que decir lo mismo:

| Dónde | Función |
|---|---|
| `herramientas/cherry.js` | `marcaDeDoc`, `marcaActual`, `esDeMarca` |
| `js/cuenta.js` | `marcaNormal`, `marcaDefecto` |
| `js/api.js` (editor e inicio) | `marcaDeDoc`, `leerMarca`, `esDeMarca` → `C.session.marca` |
| la base | `marca_activa_de(uid)` |

Lo que no tenga marca (algo viejo, o que se cuele por una página vieja en caché) es de la **primera** marca.

## Qué va por marca y cómo

| Qué | Cómo se separa |
|---|---|
| Proyectos | columna `projects.marca`. `getProjects`, «Mis proyectos», «Seguir editando», el proyecto que abre el editor, `videosListos` (calendario) y la carpeta «Subidas para publicar» filtran por marca. Lo nuevo nace con la marca activa. |
| Guiones, Storyboard, Carruseles, Calendario | UN documento por marca: la herramienta se guarda como `guiones@<marca>`. Lo hace `cherry.js` (`llave(h)`) sin que la página se entere. Así guardar una marca nunca pisa la otra. |
| Respuestas automáticas | columna `flujos_respuesta.marca`; la cuenta es la de la marca. |
| Cuentas de Instagram | `cuentas_instagram.marca` (ya existía). |
| Identidad de marca | `{ porMarca: { <id>: … } }` dentro del documento `marca` (ya existía). |
| Laboratorio | sus videos y su baúl ya iban por marca dentro de su documento. |

«Pasar a otra marca»: en «Mis proyectos», cada tarjeta tiene **Otra marca** (solo con dos marcas o más).

## ⚠️ Trampas

- **La marca de los documentos se fija la primera vez que se usa** (`marcaDocs` en `cherry.js`) y no cambia mientras la
  página esté abierta. Si cambiara a mitad, lo de una marca se guardaría con la llave de la otra.
- **Sin saber la marca no se guarda nada.** En un navegador sin la copia del Laboratorio, `cargar()` lee primero el
  Laboratorio y `guardar()` deja lo suyo pendiente.
- **Si la marca cambió en otro equipo**, este navegador abre con la vieja; cuando llega el documento de verdad,
  `cuenta.js` recarga la página (una vez cada 15 s como máximo). Por eso `cuenta.js` guarda la copia del Laboratorio al
  recibirlo: si no, el inicio (que lee por `api.js`) recargaría una y otra vez.
- El CHECK de `herramientas_datos` acepta `^(guiones|storyboard|carruseles|calendario)@[A-Za-z0-9_-]{1,40}$`. Una
  herramienta nueva que vaya por marca tiene que entrar ahí y en `POR_MARCA` de `cherry.js`.
- `projects.brand_id` es de una tabla vieja (`brands`) que nadie llena. **No** es la marca.

## Lo que ya existía

`servidor/base/17-marcas.sql` (`migrar_marcas`): lo viejo pasó a la marca activa de cada persona. Lo de Sergio quedó
en sergiosaac.co (`cdc7nt2`) y cobrapos.co empezó vacía. Los documentos viejos sin `@` se quedaron de respaldo.


## Letras de la identidad (8-oct-2026)

La pantalla de identidad (`herramientas/marca.html`) tiene tres grupos de letras: títulos (`letraTitulos`), texto
(`letraTexto`) y **remate** (`letraRemate`, nuevo). El remate es la palabra clave que va debajo de la gruesa, en otra
letra; `ninguno` = la misma de títulos. Opciones: `caslon` (Libre Caslon Text Bold Italic), `playfair-i`.

Se agregaron **Urbanist** (`urbanist` para títulos, peso 800; `urbanist-t` para texto, 500/700) por el manual de
sergiosaac.co (Urbanist ExtraBold + Libre Caslon itálica, modo rojo #9B111E). Carruseles (`carruseles/app.js`) ya
reconoce `urbanist` y `urbanist-t`; **el remate todavía no se usa en carruseles ni subtítulos** (lo lee solo la pantalla).
Un id que no esté en las listas cae en la primera opción (Montserrat / DM Sans) sin avisar: al agregar una letra
hay que sumarla en `marca.html` (LETRAS_TIT/TXT/REM + la hoja de Google Fonts) y en `carruseles/app.js`.

## La pantalla rediseñada (8-oct-2026)

Sergio: campos «todos redondos, todos extraños», «el logo no es algo necesario en redes» y «que todo se vea dentro de la
parte visible sin necesidad de hacer scroll». Con el lenguaje de Historias (`css/cabecera-herramienta.css`): cabecera
oscura con el Van Gogh del aerosol + tarjeta «Tu marca» con Guardar; seis pestañas (Colores, Letras, Tu marca —antes
«Tu negocio»—, Tu voz, Tus frases, Dónde va) y la vista previa fija a la derecha.
- **Sin logo**: la sección `#sec-logo` queda `hidden` (los datos se conservan) y las insignias no salen en la vista previa.
- **Sin bajar**: `ajustarPanel()` achica la pestaña abierta con `zoom` (mínimo 0.72) y `ajustarVista()` angosta la
  vista previa. En pantallas bajas (≤820 / ≤760 px de alto) la cabecera se vuelve franja y se esconden las explicaciones.
  Medido sin nada que se salga en 1900×890, 1600×900 y 1366×700.
- Letras: las 9 de títulos en una fila de 9 columnas (antes una fila que se corría de lado y escondía la escogida).

## Letras propias (8-oct-2026)

Sergio: «una opción para subir tipografías personalizadas». En la pestaña Letras, cada fila (títulos, texto, remate)
tiene un **+ Tuya** a la derecha: sube un .ttf, .otf, .woff o .woff2 (hasta 5 MB), la deja escogida en esa fila y la
suma al final de las TRES filas. Se quita con la x de su esquina (Deshacer la devuelve: el archivo NO se borra).
**Tope: 2** (`CherryLetras.TOPE`): con 3, en un portátil de 1366×700 la pestaña ya no cabe sin bajar.

- Código compartido: `js/letras-propias.js` (`window.CherryLetras`). Lo cargan `marca.html` y `carruseles.html`.
- En la identidad: `letrasPropias: [{ id: 'lp-…', nombre, tipo }]` y el rol guarda el id (`letraTitulos: 'lp-…'`).
- El archivo: depósito PRIVADO `carruseles`, `<user_id>/letras/<id>` (sin extensión; `servidor/base/19-carruseles-bucket.sql`
  acepta `font/ttf|otf|woff|woff2`). Borrar la cuenta lo borra con la carpeta.
- En el navegador: familia `Cherry letra <id>`, registrada con `FontFace` con pesos `1 1000` (sin negrita inventada).
  Queda en la caché del navegador (`cherry-letras-v1`): la segunda vez está al instante.
- Carruseles e Historias: `kitDe()` pone la familia en el kit; `lienzo.js › cargarLetra` la pide a `CherryLetras`; la
  descarga mete los `@font-face` con el archivo adentro (`CherryLetras.css()` en `letrasIncrustadas`). Comprobado:
  la lámina descargada sale igual que el editor. En los selectores sale con su nombre (`nomLetra`), no con el código.
- ⚠️ Una lámina guardada con una letra propia la sigue encontrando aunque la quites de la identidad (la ruta sale del id).

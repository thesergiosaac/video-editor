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

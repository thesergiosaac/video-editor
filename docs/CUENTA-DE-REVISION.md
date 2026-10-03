# La cuenta del revisor de Meta ve Cherry congelado

*3-oct-2026*

Sergio: **«etiquetemos la cuenta del revisor como cuenta de revisor y en su cuenta no cambiará nada, y en Cherry podemos
hacer varias modificaciones de diseño pero que él la siga viendo igual»**.

Mientras Meta revisa los permisos de la app de Cherry, el revisor entra con su cuenta y compara lo que ve con los videos
que se mandaron. Si las pantallas cambian, puede rechazar y toca volver a hacer fila. Con esto, el revisor sigue viendo
Cherry tal como estaba, y para todos los demás se puede rediseñar.

## Cómo funciona

- **La etiqueta:** la cuenta `review@cherrysweet.app` (id `abbac53b-547f-400b-8fe1-ba54d4a8ecc1`) tiene
  `app_metadata.cuenta_revision = true` en Supabase (puesta con la API de administración; `app_metadata` no lo puede
  cambiar el usuario). Su id también va escrito en `js/revision.js` (`REVISORES`), por si la sesión guardada es de antes
  de la etiqueta.
- **La copia congelada:** `revision/` = Cherry tal como estaba publicado el 3-oct (commit 4cf49e3): `app.html`,
  `index.html`, las páginas legales, `js/`, `css/`, `herramientas/` y `assets/`. Solo se le agregó
  `<meta name="robots" content="noindex">`. **No trae `js/revision.js`**: allá no se redirige nada. **NO se edita.**
- **El aviso:** `js/revision.js` va de PRIMERO en el `<head>` de `app.html` y de cada `herramientas/*.html` del Cherry de
  siempre. Lee la sesión guardada (`carrete-sesion`); si es la cuenta de revisión, hace
  `location.replace('/revision/' + la misma página + la misma dirección)`. También corre en `js/api.js › guardarSesion`
  (el momento en que el revisor entra).
- **La vuelta de Instagram:** `ig-conectar` vuelve a `app.html` o a `herramientas/x.html` del sitio (lista fija en
  `volverA`). Desde ahí `revision.js` sigue a la copia con `?instagram=ok…` intacto, y la copia muestra el aviso como
  siempre. Probado en local: la dirección y sus datos llegan completos.

## Lo que hay que cuidar mientras dure

- **La pantalla de entrada (antes de iniciar sesión) NO se cambia:** el revisor la ve en el Cherry de siempre, antes de
  que se sepa quién es.
- **Lo del servidor es compartido** (funciones, base, ensamblador): la copia congelada llama a las mismas funciones. Todo
  cambio del servidor tiene que seguir sirviéndole a la copia (no quitar ni renombrar campos que la copia usa).
- **Lo que se guarda en el navegador también es compartido** (mismo dominio): un diseño nuevo no debe reutilizar llaves de
  `localStorage` que la copia lea para verse (p. ej. `cherry-inicio-modo`). Usar llaves nuevas.
- El resto del Cherry de siempre (diseño, pantallas, colores) se puede cambiar.

## Cuando Meta apruebe

Borrar `revision/`, `js/revision.js`, su `<script>` en `app.html` y en `herramientas/*.html`, la línea de
`guardarSesion` en `js/api.js`, y quitarle `cuenta_revision` a la cuenta (o dejarla: sin `revision.js` no hace nada).

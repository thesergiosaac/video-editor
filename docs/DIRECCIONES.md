# Direcciones sin «.html» (29-oct-2026)

Sergio: «¿hay manera de que en nuestros enlaces de Cherry no aparezca .html? Se ve poco profesional… y las que vuelven de una
conexión (Instagram, YouTube, etc.) que regresen bien, solo que en la barra ya no se vea el html».

## Cómo funciona

- **GitHub Pages ya sirve cada página sin «.html»**: `cherrysweet.app/app` abre `app.html`,
  `cherrysweet.app/herramientas/laboratorio` abre `herramientas/laboratorio.html`. Los enlaces viejos con «.html» siguen
  abriendo.
- **Los enlaces internos van sin «.html»** (`href`, `location.href`, el menú de `js/lado.js`, los botones armados en JS).
  `index.html` → `./` (o `../`). El script que lo hizo: `scratchpad/sinhtml/quitar_html.py` (sesión 4af4f650).
- **Cada página limpia la barra al abrir**: una línea al principio del `<head>` (después del `charset`) que, solo en
  cherrysweet.app, cambia la dirección visible con `history.replaceState` (sin recargar; conserva `?` y `#`). Así también
  quedan limpias las direcciones a las que vuelven Instagram, TikTok, YouTube y los pagos, y los enlaces viejos.

## Lo que NO cambió (a propósito)

- **Lo que se manda a `ig-conectar`, `tt-conectar` y `yt-conectar` como `volver`**: sus servidores solo aceptan `app.html` o
  `herramientas/<página>.html`. `js/cuenta.js › paginaActual()` le vuelve a poner «.html»; Calendario y Respuestas mandan el
  texto fijo con «.html».
- **`conectar-youtube.html`** (la dirección registrada en Google) y las direcciones registradas en Meta y TikTok.
- **`manifest.webmanifest`** (`id` y `start_url` = `app.html`): cambiar el `id` volvería «otra app» la que ya está instalada.
- **`revision/`** (la copia congelada para el revisor de Meta), `premium/` y los archivos de prueba («_»).
- Los pagos (Dodo) vuelven a `location.origin + location.pathname` (ya limpia); el servidor solo exige que sea cherrysweet.app.

## Lo que dependía de «.html» en la dirección (arreglado)

- `herramientas/cherry.js`: el regreso al iniciar sesión (`../app?volver=herramientas/<página>`) y el «+» de las cartas
  (`BOTON`, por el nombre de la página sin «.html»).
- `js/main.js`: `?volver=` acepta la herramienta con o sin «.html».
- `js/cuenta.js`: Calendario y Pruebas A/B se reconocen con o sin «.html».

⚠️ Al crear una página nueva: el enlace va sin «.html» y la página lleva la línea que limpia la barra (copiarla de cualquier
herramienta).

# Storyboard (`herramientas/storyboard.html`)

## Rediseño y storyboards de los guiones (8-oct-2026)

Sergio pidió tres cosas: cambiar el diseño, que no hubiera que bajar y que se vieran sus storyboards. La cabecera gigante los empujaba fuera de la pantalla, y además los storyboards que dibujó en Guiones no aparecían.

### La pantalla

Usa el lenguaje de Historias (`css/cabecera-herramienta.css`):

- **Lista.** Cabecera ámbar, el color de Storyboard en el inicio, con `assets/inicio/v2/storyboard.webp`. Al lado va «Así vas», con tres anillos: storyboards, escenas grabadas y listos para el Editor. Debajo van las tarjetas con sus viñetas, en 4 columnas, y en 2 filas si la pantalla mide 821 px de alto o más.
- **Un storyboard abierto.** Arriba, la cabecera con el título y las acciones. Luego una sección con la duración, la barra de tiempo, el consejo y la **tira de escenas**: tocar una la abre, arrastrar cambia el orden. Debajo va **una sola escena abierta**: la viñeta grande a la izquierda y los campos a la derecha. Con ‹ › se pasa a la escena anterior o a la siguiente; con ← → se cambia de puesto.
- **Sin bajar.** Aplica en pantalla grande: `.app.fija`, con al menos 1101 px de ancho y 640 de alto.
  - `medirZona()` le da a la lista o a la escena el alto que queda, en `--alto-zona`.
  - `ajustarEsc()` achica con `zoom` los campos de la escena si no caben (mínimo 0.72).
  - Por debajo de 820 px de alto, la cabecera y la tira se compactan.
  - Se mide directo, sin `requestAnimationFrame`, que no corre con la pestaña oculta.

Medido sin nada que se salga en 1900×890, 1600×900 y 1366×700. En celular todo se apila y se baja.

### Una sola copia (Sergio la escogió)

Los storyboards que se dibujan en Guiones viven **dentro de cada guion**. Están en el documento `laboratorio`, en `planes[].guion[]`, con los campos `escena`, `dice`, `ve`, `vineta` y `planoVineta`. Storyboard los muestra y los edita ahí mismo y nunca hace copias.

- **Cuáles salen.** Los guiones de la marca activa (`lab.activa`) que tengan al menos una viñeta dibujada. Su id en esta pantalla es `g-<id del plan>`. Los propios de Storyboard siguen en `storyboard@marca`.
- **Qué se edita aquí.**
  - Se edita lo que dice, lo que se ve, el orden, el título (solo si se tocó), la meta (`dur`) y qué escenas están grabadas (`guion[].grabada`; si no está, cuenta `plan.grabado`).
  - El nombre de la escena y el plano los pone Guiones: aquí solo se leen.
  - Agregar, duplicar o borrar escenas, redibujar o borrar el guion se hace en Guiones. Para eso está el botón «Abrir en Guiones» → `laboratorio.html?modo=guiones&guion=<id>`, que `lab-guiones.js` abre en su pestaña.
- **Cómo guarda (`guardarGuion` / `subirLab`).**
  - Espera 800 ms y trae el Laboratorio más nuevo de la base (`CherryApp.cargar('laboratorio')`).
  - En ese guion solo cambia `guion`, `titulo` y `dur`, y guarda el documento.
  - Así no se pisa lo que se haya hecho en otra pestaña. Si dos pantallas cambian el mismo guion a la vez, gana la última.
- **El tiempo.** Una escena de guion dura lo que tarda en decirse a 3,4 palabras por segundo, el ritmo de Guiones.

### Revisar en local

El script `scratchpad/resp/demo_sb.py` arma `herramientas/_demo-sb.html`, que usa `_stub-sb.js`. Esa vista usa los datos reales exportados por `sb_datos.py` a `_sb-datos.json`, con las viñetas en `_sb-vinetas/`. **Nada de eso se publica.**

### Más rápida (8-oct-2026)

Sergio dijo que se sentía «un poco lenta». Había tres causas:

1. **Las viñetas se volvían a bajar en cada visita.** Cada visita firmaba las viñetas de nuevo: la dirección cambiaba y el navegador volvía a bajar todas (1,4 MB).
   - Ahora `js/vinetas.js` recuerda las firmas en este navegador, en `cherry-vinetas-firmas-v1-<usuario>`, mientras sirvan (12 h). Lo mismo aplica en Guiones y en el Laboratorio.
   - Las viñetas nuevas se suben con `cache-control: max-age=31536000`; su nombre es único.
2. **Se repintaba todo varias veces.** Lo que llega de la base solo repinta si es distinto: `huellaGuiones()` y la comparación del documento de Storyboard.
3. **Medir recalculaba la página entera.** `--alto-zona` iba en `.app`; ahora va en la zona misma, solo si cambió, y se mide una vez al abrir.

Las imágenes llevan `decoding="async"`, y las chicas, además, `loading="lazy"`. Con todo eso, abrir un storyboard pasó de unos 100 ms a unos 25 ms.

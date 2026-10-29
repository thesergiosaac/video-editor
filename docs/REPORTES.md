# Reportar o sugerir · y la Consola del administrador

29-oct-2026. Sergio: «poner algo donde las personas puedan reportar errores y dar sugerencias… que sientan que hay
soluciones inmediatas». Propuesta aprobada: https://claude.ai/artifact/LNoAd5YshK5VoU3iJN35T2. Sus decisiones: el nombre
**«Reportar o sugerir»**; la promesa **«te respondemos en menos de 24 horas»**; los reportes se ven en una **Consola de
administrador** que después recibe más datos; votar ideas, para después del lanzamiento.

## Lo que ve la persona

| Dónde | Qué |
|---|---|
| Barra de la izquierda (`js/lado.js`) | Botón rosado «Reportar o sugerir», **pegado abajo** (`position: sticky`): en pantallas bajas (la de Sergio, 728 px) la barra no cabe y se mueve. Punto amarillo = le respondieron algo. |
| Menú de la foto (`js/cuenta.js`) | «Reportar un error» y «Sugerir una idea» (abren la ventana ya en ese camino). Es la entrada en el celular, donde no hay barra. |
| Cuando algo falla | Aviso «¿Algo falló? Repórtalo» al lado del botón rosado (máx. una vez cada 2 min). Sale con un error de la página o una función del servidor que responde 5xx. |
| La ventana (`js/reportes.js`) | Elegir → «¿Qué pasó?» + «¿Te deja seguir?» (urgente) · o «Tu idea» + «¿Para qué?» + parte de Cherry → «¡Recibido! Reporte n.º X» → «Mis reportes» (estado y respuesta). |

Va sola con el reporte: foto de la pantalla (html-to-image 1.11.11 de jsdelivr; si no sale en 7 s, va sin foto; la
persona la puede quitar), la pantalla y la marca, las últimas 10 fallas de la pestaña (sessionStorage `cherry-errores`), el
navegador, el tamaño y la hora. Puede adjuntar otra foto o un video (hasta 50 MB).

`js/reportes.js` va después de `js/lado.js` en las 12 pantallas que cargan la barra y en `app.html`. Funciona con
`CherryApp.rest` (herramientas) o `CARRETE.api.rest` (el inicio; `rest: apiFetch` en `js/api.js`). Expone
`window.CherryReportes.abrir('error' | 'idea')`; cualquier `[data-reportar]` de una página lo abre.

## La base (`servidor/sql/28-reportes.sql`, corrida el 29-oct)

- Tabla `reportes`: el `id` es el número que ve la persona. Estados: `recibido`, `arreglando`, `arreglado` (en una idea:
  «Ya está»), `planes`, `no`.
- Reglas: cada quien crea los suyos (siempre «recibido», sin respuesta) y ve los suyos; el administrador (`soy_admin()`, tabla
  `administradores`) ve todos. Nadie los cambia directo: se responde con `responder_reporte(p_id, p_estado, p_respuesta,
  p_solo_visto)`.
- Cubo **privado** `reportes`: cada quien sube a su carpeta (`<uid>/…`); el administrador lee todo con direcciones firmadas
  de una hora.

## La Consola (`herramientas/consola.html`)

Solo administradores (en la barra, con un número rojo de reportes sin mirar). Hoy: «Reportes y sugerencias».
- Filtros: Por atender · Urgentes · Errores · Ideas · Todos. Los urgentes sin resolver arriba; «pasaron las 24 h» en rojo.
- Al abrir uno se marca visto. Estado, respuestas de un toque, «Guardar y responder» (la persona lo ve en «Mis reportes»
  con el punto amarillo) y «Copiar todo» (para pegárselo a Claude y arreglarlo).
- `?r=<número>` abre ese reporte.
- Pendiente: sumarle los demás datos que Sergio hoy no tiene dónde ver (preguntarle cuáles primero).

## Probarlo sin la base

`herramientas/_demo-cal-rep.html` y `herramientas/_demo-consola.html?admin=1` con `herramientas/_rep-falso.js` (datos de
mentira). Nunca se publican.

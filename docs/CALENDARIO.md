# El Calendario de Cherry y la barra de herramientas (6-oct-2026)

## La barra de herramientas: UNA sola para todo Cherry (`js/lado.js`)
Sergio: «esa barra de herramientas va a ir en todas las páginas excepto en el editor» y, al ver que la había copiado,
«no deberías duplicarla: debe ser un mismo elemento compartido en todas las páginas», en el mismo punto que en el inicio.
- `js/lado.js` (`window.CherryLado`) tiene la lista, los íconos, el estilo (`.ck-lado*`) y `html(aqui)`. La usan el inicio
  (`inicio.js › barraLateral` la pinta dentro de `.ci-marco` y atiende sin recargar Inicio, Mis proyectos y Editor Pro;
  en `styles.css` solo queda su sitio: `.ci-marco>.ck-lado`) y las 7 herramientas (la cargan en el `<head>` justo después
  de `cherry.js`, `../js/lado.js?v=…`, y se arma sola). Al cambiarla, subir la versión en `app.html` y en las 7 páginas.
- **El mismo marco del inicio** en las herramientas (≥1101 px): `.app` con 20 px arriba y abajo, 16 a la izquierda y 20 a
  la derecha; la caja de la página llega hasta 1880 px y deja a la izquierda el sitio de la barra (68 + 16); la barra de
  arriba se estira por encima. Medido: barra de arriba en x=16 y la de herramientas en x=16, y=98, en el inicio y en las
  herramientas; el contenido empieza en x=100. La barra va fija; al bajar la página sube hasta quedar a 20 px del borde.
  Respuestas quitó sus topes de 1180/1480 px en computador para llenar igual; Storyboard, el de sus vistas internas.
- Solo en pantalla ancha (≥1101 px), como en el inicio: 68 px con los íconos, se despliega a 240 px ENCIMA del contenido
  al pasar el ratón o con el teclado; marca en rosa dónde estás.
- ⚠️ Las reglas del marco llevan `.app ` delante: la `.vol{position:relative}` de cada página venía después y le ganaba.
- «Mis proyectos» y «Editor Pro» llevan a `app.html?ir=proyectos` y `app.html?ir=editor` (los lee `js/main.js`).

## Sin migas de pan (6-oct, Sergio: «no quiero breadcrumbs en mi página; para ir a algún lugar está la barra de herramientas»)
- Se quitaron de la barra de arriba de las 7 herramientas «‹ Inicio» y el nombre de la página, y el indicador de pasos
  Guion → Storyboard → Editor Pro → Calendario (Calendario, Guiones y Storyboard). No volver a ponerlos.
- Se quedan, porque llevan a donde la barra de la izquierda no lleva: «‹ Inicio» del editor (no tiene barra),
  «‹ Laboratorio» dentro de la ficha de un video y «‹ Mis storyboards» dentro de un storyboard.
- En celular y tableta no hay barra de herramientas: el logo de Cherry lleva al inicio. `lado.js` pone los créditos a la
  derecha y en el celular los deja en «◆ 20» para que la barra quepa en una fila.

## El calendario en UNA pantalla (`herramientas/calendario.html`)
Sergio: «que todo quede dentro de la parte visible sin necesidad de hacer scroll». Desde 1181 px de ancho y 600 de
alto (`UNA` en el JS; por debajo, la página de dos columnas que baja, como antes):
- La cabecera grande («Calendario de contenido. Tu mes, en orden.») se esconde en computador.
- El mes tiene el alto que queda. `ajustarMes()` mide: si la casilla mide menos de 100 px, las fichas van sin la fila de
  íconos (`.mes.apretado`), y las que no caben se esconden y lo dice «+N más» (nunca se esconde nada sin aviso). Se
  vuelve a medir al cambiar el tamaño y al terminar de cargar las letras.
- La semana y la lista bajan por dentro.
- Hasta 1099 px de alto (`BAJA`), «Tu semana» se aprieta: el número al lado del título, sin las fechas de arriba ni
  los tipos, la caja del hueco más baja, la constancia con barras bajitas y sin la frase.
- «Listos para programar» siempre tiene al menos 190 px; la lista baja por dentro y la última fila se desvanece si
  sigue (`.listos.sigue`).

## Lo demás de este día
- **Listos en filas pequeñas** (en todas las pantallas): portada, nombre en una línea, detalle y un reloj (`.listo-prog`).
- **Fuera el bloque «Dónde se publica»** (Sergio: «se conectan desde otro lado y por ahora solo tenemos Instagram»).
  `pintarCuentas()` quedó con guarda; Instagram se conecta desde el menú de la foto.
- **Einstein en el día de hoy** (idea 1 que escogió): si hoy no tiene nada, la casilla lleva `.sin-nada`, el personaje
  del Calendario (`assets/inicio/v2/calendario-chica.webp`) asoma abajo y dice «¿y hoy qué?» a mano. Solo ≥1101 px.
- **La portada del video en cada ficha** (idea 3): `tapaDe(p)` usa la `tapa` que guardó la publicación o la del
  proyecto en «listos». Carruseles e historias, sin foto.
- **La idea 2 (constancia con cerezas) se rechazó**: las cerezas de los niveles son SOLO para los niveles.
- **El mural del día** (Sergio: «cuando en un día haya varias cosas, al tocarlo se abre un mural que muestre a detalle
  qué hay ese día»): `#velo-dia`, `abrirDia()` / `pintarDia()`. Se abre con «+N más», tocando la casilla de un día con
  2 o más (fuera de las fichas), con los días de «Tu semana» que tienen 2 o más y con el día de arriba en la vista de
  semana (lleva un globito con el número). Cada publicación es una pieza con su portada, hora, estado, título, tipo,
  redes, el texto y «Abrir y editar»; al cerrar esa publicación se vuelve al mural. Abajo: «Programar otra este día» y
  «Ver la semana». Esc o tocar afuera lo cierra. En celular sale de abajo, en una columna.
- **Arreglos**: la raya punteada de la meta en «Constancia» usaba la clase `igop-fila` (la de las filas del formulario
  de publicar) y no se dibujaba → `meta-l`. En Carruseles, con poco contenido quedaba una franja negra abajo
  (`html:has(.app[data-modo="papel"])` en `carruseles/carruseles.css`).

## Para mirarlo sin cuenta
`herramientas/_demo-cal.html` (sin seguimiento, NUNCA se publica) usa `_cal-falso.js` (datos parecidos a los de Sergio;
`?lleno=1` agrega un día con 4 publicaciones). Las otras herramientas: `_demo-<herramienta>.html` con `_stub.js`.

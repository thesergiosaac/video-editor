# Familias de gráficos y «La persiana» (29-sep-2026)

Sergio: *«que no haya un solo tipo de gráficos… escogemos entre familias de gráficos así como escogemos las plantillas
de los subtítulos… y que haya la opción de mezclar familias»*. La primera familia nueva es **La persiana**, diseñada y
aprobada en el taller (`Downloads\Cherry Taller\tarjetas\persiana\IMPLEMENTAR-LA-PERSIANA.md`).

## Las familias

| Familia | Tipos | Qué es |
|---|---|---|
| `vidrio` | los 19 de siempre (`numero` … `claves`) | tarjetas de vidrio encima del video |
| `persiana` | `pe_tarjeta`, `pe_lista`, `pe_cifra`, `pe_vs` (la IA) · `pe_clipv`, `pe_cliph`, `pe_foto` (material de la persona) | corte seco a una tarjeta a pantalla completa con la sombra de una persiana; la palabra cae con estela y se asienta |

- `subtitle_config.graficos` lleva `familias` (una o varias) y `fondo` (`marca` · `blanco` · `papel` · `alterna`).
- `graficos.js › familiaDe(tipo)`: todo lo que empieza por `pe_` es de la persiana. `elegir()` salta las familias que no
  están puestas y, **con varias**, a igual fuerza pone primero la familia que menos lleva (así salen las dos).
- `ponerFondos()` pone el fondo de cada tarjeta (el mismo para todas o alternando marca → blanco → papel).
- La tarjeta de la persiana tiene forma **`tarjeta`**: tapa el cuadro entero, el video no se mueve, entra en la
  palabra marcada (`marcas[0] − 0,04 s`) y dura lo de la pieza (`DURA_PE`, 2,1 a 2,5 s; la lista, hasta su última
  palabra, tope 4,5 s).

## La IA (`servidor/biblioteca.ts`)

- Cada familia se marca **aparte** con su propio prompt (`FAMILIAS_GRAFICOS`), en paralelo. `SISTEMA_PERSIANA` no busca
  datos sino la palabra que pesa en la frase; si hay cifra, lista o dos cosas opuestas, escoge esa pieza.
- `renders.graficos.familias` dice qué familias están marcadas. **`MOTOR_GRAFICOS` sigue en 4 a propósito**: con solo
  vidrio no se vuelve a marcar nada.
- Acción `marcar-familias` (la página, al escoger una familia que el video no tiene): marca SOLO la que falta y la suma.
- `regenerar-graficos` recibe `familias`: regenera las puestas y guarda lo de las demás.
- `orchestrate.ts › graficosAlDia` (v246): antes de F2 marca lo que falte (motor viejo o familia nueva).
- Respaldo en `graficos.js`: una `pe_tarjeta` sin palabra grande usa la palabra que se dice en la marca.

## El ensamblador

- `premium.js`: forma `tarjeta` = una capa `todo` sin vidrio.
- `pedazos.js` y la pasada única: las tarjetas van **después del `ass`** → mientras está la tarjeta, los subtítulos no se ven.
- Si sale alguna tarjeta, todo va en premium (solo Remotion la dibuja). Si Remotion falla, el clásico sale **sin** las
  tarjetas (`sinTarjetas`).
- Sitio de Remotion: `cherry-graficos-premium-v4` (variable `REMOTION_SITIO`). Costo medido: USD 0,006 por tarjeta, ~34 s.

## Remotion (`scratchpad\premium`, fuera del repo)

`src/plantillas/persiana/base.tsx` (estilos derivados del color de marca: si la marca es clara, la letra se oscurece),
`piezas.tsx` (7 piezas), `lib/persiana.tsx` (la sombra aprobada). `js/premium-vista.js` se rearma con esbuild (IIFE, sin
`--global-name`). Publicar el sitio: `node publicar_sitio.mjs <nombre>` con las llaves de Remotion en el entorno.

## La página

- Gráficos: galería de familias (`FAMILIAS_GRAF`, muestras en `assets/graficos/familia-*.mp4`), fondo de la persiana,
  «Estilo del vidrio» y «Detrás de ti» solo si Vidrio está puesta.
- Cada `pe_tarjeta` de la lista trae **«Poner foto o clip»**: crea una pantalla con forma `tarjeta` en su palabra, con su
  palabra grande y su cursiva, y abre el selector de archivo (`pantallas.js › nuevaEn`). Video horizontal → `pe_cliph`,
  vertical → `pe_clipv`, foto → `pe_foto`. Ya puesto, la fila trae «Quitar».
- Guion → Pantalla: forma nueva «En una tarjeta (La persiana)» con palabra grande y cursiva.
- Vista previa: la persiana siempre en premium (`movvivo.js`), por encima de los subtítulos en vivo (`.gr-vivo--tarjeta`).
- Arreglado de paso: la lista de gráficos metía el texto en la columna del minuto (`.ap-item.gr-item`).

## Tanda 2 · La persiana con tu video (29-sep, noche)

Del taller (segunda tanda, `PV…`) más la pieza 5 de la primera. El video **nunca se corta**: se transforma y vuelve.

| Tipo | Forma | Qué hace | Del taller |
|---|---|---|---|
| `pe_ventana` | `ventana` | tu video se encoge a una ventana 9:16 (580×1031 en 250,170) y la palabra cae debajo | PV2 |
| `pe_empuja` | `empuja` | la tarjeta sube desde abajo empujando tu video; al final tu video la empuja de vuelta | PV6 |
| `pe_sales` | `sales` | tu video al 78 % en una tarjeta a la altura del pecho; tu cabeza se sale por encima de la palabra | PV4 |
| `pe_tu` | `tu` | la tarjeta con la palabra y tú, recortado, delante | P05 |

- **Quién mueve el video:** el ensamblador (`graficos.js › MUEVE`, `objetivo`, `avance` con la curva inOutPow del taller),
  así el video conserva el color y el look. La pieza de Remotion (`plantillas/persiana/conVideo.tsx`) dibuja lo de
  alrededor con **la misma cuenta** (`rectVideo`): fondo con hueco redondeado (`clip-path` evenodd), sombra, persiana
  dentro de la ventana. Empuja: desenfoque por velocidad en la tarjeta (Remotion) y en el video (`tramosEmpuje` → `gblur`).
- **Tu recorte (Te sales y Tú delante):** el ensamblador pide la silueta del tramo a `carrete-recorte` apenas sabe las
  piezas; con el color listo arma un WebM con transparencia **con tu color** (la tabla de la persona si el look tiene
  máscara), lo sube a `renders/<id>/persona_<i>.webm` y recién ahí pide esas piezas a Remotion (`OffthreadVideo
  transparent`). Si algo falla: te sales → la ventana, tú delante → la tarjeta. Costo medido: USD 0,018 y ~65 s por pieza.
- **Subtítulos:** mientras está cualquier pieza de la persiana se callan (`pedazos.js › callarAss`: la línea que empieza
  dentro se quita y la que viene de antes se corta). La vista previa también (`.gr-callado`).
- **Cámara quieta** mientras está una pieza que mueve el video o usa tu recorte (`MOV.quieto`).
- **Cambiar la pieza:** cada gráfico de una palabra trae chips (Tarjeta · Ventana · Empuja · Te sales · Tú delante);
  se guarda en `subtitle_config.graficos.variantes` = {palabra donde empieza: tipo} (orchestrate v248).
- La IA las escoge por situación (cambio de tema → empuja; habla de sí → te sales / tú delante; sigue mostrando →
  ventana) y no repite el mismo tipo seguido.
- En la vista previa, Te sales y Tú delante se ven sin tu recorte (se calcula al hacer el video).
- Sitio de Remotion: `cherry-graficos-premium-v5`. `src/graficos.js` de Remotion es ahora COPIA EXACTA de `js/graficos.js`.
- La «Nueva 8 · duotono» está aprobada como idea pero el taller no la ha construido: no está.

## La pantalla con sello · `pe_falso` (2-oct-2026)

El gancho del Día 2 («Hora perfecta para publicar» + el sello FALSO) vuelto pieza de la persiana. Cuando la persona dice una
creencia y la desmiente, sube una pantalla del celular DETRÁS de ella con la creencia escrita y en la corrección cae el sello
rojo (FALSO, MITO, NO o MENTIRA) con temblor.
- **Con hora** (`datos.hora`, «7:00 p. m.»): la alarma de iOS con la rueda que gira y frena en esa hora. **Sin hora**: unos
  ajustes con un interruptor que se prende.
- **Forma `falso`**: tu video de fondo, la pantalla encima y TU RECORTE encima de la pantalla (y de su sombra), solo en esa
  franja: fuera de ella el video ya es la persona y los subtítulos siguen (no está en CALLAN). Está en CON_PERSONA: el
  ensamblador saca el recorte en alta. **Sin recorte, la pieza no sale** (te taparía la cara).
- **Tiempos** (`graficos.js › selloDe`): entra en la creencia; el sello cae en la corrección si llega entre 1,2 y 5 s
  después, si no a los 2 s; sale 1,4 s después del sello.
- **Sonidos** (`sonidos-auto.js`): whoosh al subir, tic de la rueda cada vez más espaciado (o clic del interruptor), golpe doble
  del sello, whoosh suave al salir.
- **IA** (`servidor/biblioteca.ts`, v34): `pe_falso` con `creencia`, `hora`, `sello`; máximo una por video. Probado con el Día 2:
  la marcó en el gancho con «Hora perfecta para publicar».
- Plantilla: `premium/src/plantillas/persiana/falso.tsx`. Sitio de Remotion **v6** (REMOTION_SITIO); volver = poner v5.
- Vista previa: la pantalla te tapa (no hay recorte en el navegador); en el video final quedas delante.

## La tarjeta plena · `pe_plena` (2-oct-2026)

Las tarjetas de las horas del Día 2, vueltas pieza. De 2 a 4 valores concretos dichos seguidos (horas, precios, cifras, días):
el video se oscurece y una tarjeta de COLOR PLENO (840 × 930) muestra el valor gigante en Anton, lo de debajo en grande (PM,
%, MIL) y una nota en cursiva; en cada valor siguiente cambia DE GOLPE de color y de dato (golpe de escala + giro que se
endereza). Colores en turno: azul, papel, ámbar y el acento de Gráficos en la última. Puntos abajo: cuál de cuántas.
- Forma `tarjeta` (calla los subtítulos y va después de ellos), sin recorte. Dura hasta 1,5 s después del último valor (2,4 a 8 s).
- Sonidos: corte doble al entrar, un whoosh seco en cada cambio, whoosh suave al salir.
- IA (biblioteca v35): `pe_plena` con `etiqueta` e `items` [{valor, sub, nota}]; gana a pe_cifra y pe_lista. Probado con el Día 2:
  la marcó en «7:00 PM de la noche / 9:00 AM / 2:00 PM».
- Plantilla `premium/src/plantillas/persiana/plena.tsx`. Sitio de Remotion **v7**; volver = v6.
- ⚠️ La tarjeta tapa la cara mientras está (como en el Día 2, que Sergio aprobó): es un corte a la tarjeta, no algo encima.

## Blanco y negro + tu color · `pe_bn` (2-oct-2026)

El cronómetro neón del Día 2, vuelto pieza. Para EL dato del video (con o sin número) dicho con énfasis y un remate («y casi
nadie lo sabe»): el video pasa a blanco y negro y lo único a color es el dato, en un anillo que se llena (si es número o
«mm:ss», cuenta), con su etiqueta, y el remate escrito a mano con marcador. Todo va ARRIBA de la cabeza (anillo arriba, la
nota justo debajo): nada cruza la cara. El brillo es blanco tenue, nunca del color del dato.
- **Forma `bn`**: capa del cuadro entero encima del video; los subtítulos siguen. El blanco y negro lo pone el ENSAMBLADOR con
  `graficos.js › filtroBN` (ffmpeg `hue=s='…'` con el tiempo del video completo, entra 0,3 s y sale 0,25 s), en `pedazos.js`
  (después del color, antes de los gráficos) y en la pasada única. Si la persiana cae al estilo clásico, la pieza no sale y
  el video no se pone gris. La vista previa (`movvivo.js`) pone `grayscale()` al video con la misma cuenta.
- Tiempos: entra en el dato, la nota en la segunda marca (si cae dentro), dura hasta 1,8 s después (3,2 a 6 s).
- Sonidos: reverso cinematográfico (se va el color), ui (cuenta), campanita (aterriza), swish (nota), whoosh (vuelve el color).
- IA (biblioteca v36): `pe_bn` con `valor` (cifra o una palabra), `etiqueta`, `nota`; máx. dos por video. Probado con el Día 2:
  «Minutos · primeros después de publicar · casi nadie lo sabe».
- Plantilla `premium/src/plantillas/persiana/bn.tsx`. Sitio de Remotion **v8**; volver = v7.

## Anillos alrededor de ti · `pe_anillos` (2-oct-2026)

El anillo de alcance del Día 2, vuelto pieza. Cuando la persona explica que algo llega a la gente por NIVELES («primero a
tus seguidores, luego a gente parecida, luego a todo el mundo»): un anillo en perspectiva por nivel alrededor del PECHO
(centro a 1320/1920, lejos de la barbilla), con personitas (círculo con silueta, nada de emoji), y arriba el contador que
rueda de un nivel al otro (si dijo números) con el nombre del nivel; en el último salen ondas.
- **Forma `rodea`**: capa del cuadro entero: la mitad de ATRÁS de los anillos, encima TU RECORTE (el cuadro entero) y encima
  la mitad de ADELANTE. Está en CON_PERSONA; sin recorte la pieza no sale. Los subtítulos siguen.
- Tiempos: un anillo en cada marca; dura hasta 2,2 s después del último (3 a 14 s).
- Sonidos: whoosh grave por anillo, tic del contador, whoosh largo con las ondas, salida suave.
- IA (biblioteca v37): `pe_anillos` con `items` [{valor, etiqueta}] y `unidad`; máx. uno por video. Probado con el Día 2:
  tres niveles en «grupo pequeño / más gente / anillo más grande» (sin números: sin contador).
- Plantilla `premium/src/plantillas/persiana/anillos.tsx`. Sitio de Remotion **v9**; volver = v8.
- Vista previa: los anillos van encima de ti (no hay recorte en el navegador).

## La vista previa = el video final, también con tu recorte (2-oct-2026)

Sergio: **«siempre la vista previa debe mostrar exactamente como va a quedar el video final, sin excepción»**. Hasta aquí, en
la vista previa la pantalla con sello y los anillos te tapaban, y en Te sales / Tú delante se veía la tarjeta sin ti.
- `js/personavivo.js`: arma tu recorte EN VIVO: la silueta de todo el video que ya usa el color por zonas
  (`colorvivo.js › siluetaPara`, la misma del ensamblador) corre escondida al mismo segundo; se pinta tu imagen (con el
  color de la vista de color si está activa) y se le quita el fondo con el mismo corte del ensamblador.
- `premium/src/lib/personaVista.tsx`: en modo vista, las plantillas montan ESE lienzo donde va tu recorte, con el mismo
  estilo y animación (falso: la franja de la pantalla; anillos: entre las dos mitades; Te sales / Tú delante: como en la nube).
- «Detrás de ti» (vidrio, forma `profundo`): el lienzo va encima del gráfico y debajo de los subtítulos (`movvivo.js ›
  personaCuadro`).
- Mientras la silueta no está (la primera vez se recorta, 1-2 min), la vista previa lo DICE con un aviso; nunca muestra otra cosa.
- De paso, la cámara: la vista previa solo la dejaba quieta en las pantallas; ahora usa la misma regla que el ensamblador.
  Y el ensamblador ahora deja la cámara quieta también con la pantalla con sello, los anillos y «Detrás de ti» (el recorte
  sale de la base sin zoom: con zoom no encajaba).
- Sitio de Remotion **v10** (solo cambia la vista; el video final igual que v9).
- (2-oct, después) La vista previa también lleva el **desenfoque de movimiento** de la nube (`lib/Desenfoque.tsx`, ~10 ms por
  cuadro: fluida) y el **vidrio** con los valores del ensamblador (capa.js: blur 24,5 px, saturación 1,4, brillo -0,05; antes
  42 px y más oscuro). Sitio **v11** (el video final igual).

## Noche y amanecer · `pe_noche` (2-oct-2026)

La madrugada del Día 2, vuelta pieza. Cuando la persona habla de la noche o de una hora de madrugada: el video se vuelve
NOCHE (azul marino oscuro, medido contra el Día 2) con estrellas, llega una notificación (si encaja) y sale un reloj grande
ARRIBA de la cabeza; si en la segunda marca pasa el tiempo o amanece, el reloj corre hasta la hora final y la imagen AMANECE
(cálida) y vuelve a la normalidad.
- El color lo pone el ENSAMBLADOR: `graficos.js › filtroNoche` (una copia con `colorchannelmixer` NOCHE_M y otra AMANECE_M que
  entran y salen con `fade` de transparencia, en pedazos.js y en la pasada única). Probado en el ffmpeg de la nube (Lambda
  temporal, borrada): brillo 123 → 53 de noche → 120 al amanecer → 123.
- La vista previa usa la MISMA matriz y la misma mezcla (`movvivo.js › matrizNoche`, feColorMatrix en sRGB; medido: la cuenta
  da igual al decimal) y la misma cuenta del tiempo (`graficos.js › nocheEn`).
- Forma `noche`: capa del cuadro entero; los subtítulos siguen. Dura hasta 2,6 s después del amanecer (o 4 s sin amanecer).
- Sonidos: reverso (se apaga), notificación, ui (reloj), whoosh largo (amanece), salida suave.
- IA (biblioteca v38): `pe_noche` con `hora`, `horaFin`, `aviso`, `detalle`; máx. uno por video. Probado con el Día 2: «3:00».
- Plantilla `premium/src/plantillas/persiana/noche.tsx`. Sitio de Remotion **v12** (con el arreglo del rango); volver = v11.

## Rango: «10 minut / os» (2-oct)
La cifra con una unidad de palabra («minutos») se partía en dos líneas (caja de 300 px). Ahora el número va grande y la
palabra debajo en pequeño (los símbolos cortos, %, $, k, M, siguen pegados); igual en el dibujo clásico (`graficos.js`).

## La barra del reto · `pe_reto` (2-oct-2026)

La barra «El reto» del Proyecto 25 y del Día 2, vuelta pieza. Cuando la persona dice una meta con número (y, si lo dice,
dónde va): tarjeta de vidrio ARRIBA de la cabeza con lo que lleva (cuenta), «la meta» en cursiva con su número y la barra
que se llena hasta donde va. SIN @usuario ni logos (regla de Sergio para redes); el brillo de la barra es blanco tenue.
- Forma `encima` con vidrio (lo desenfoca el ensamblador; la vista previa con los mismos valores). Dura hasta 2,2 s después
  de la meta (3 a 7 s). Sin «dónde va» (actual 0) solo sale la meta y la barra vacía.
- Sonidos: entra, cuenta, la meta (ficha), la barra llena (remate), salida.
- IA (biblioteca v39): `pe_reto` con `etiqueta`, `actual`, `meta`, `unidad`; gana a pe_cifra; máx. uno por video. Probado con
  el Día 2: «hasta llegar a 200 mil seguidores».
- De paso: la tarjeta plena pasa «19:00 PM» a «7:00 PM» (la IA a veces mezcla 24 h con AM/PM).
- Plantilla `premium/src/plantillas/persiana/reto.tsx`. Sitio de Remotion **v13**; volver = v12.

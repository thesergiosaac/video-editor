# Las grabaciones de pantalla en la plantilla del navegador

*24-sep-2026*

Sergio: **«voy a explicar algo en la pantalla del computador; esa pantalla tiene que ir en la plantilla, no a pantalla completa»**. Escogió dos formas del navegador:

| forma | cómo queda | `forma` |
|---|---|---|
| **Tú arriba, pantalla abajo** | tu video se encoge a un recuadro arriba; la grabación, abajo en su ventana | `partida` |
| **Pantalla arriba, detrás de ti** | la ventana arriba, y tu cabeza y tu pelo **por delante** (recorte de tu silueta) | `profundo` |

---

## Cómo se usa

En **Guion**, cada línea tiene un tercer botón: **Pantalla**. Se toca en la línea donde empieza la explicación → se sube la grabación (video o imagen) → se escoge la forma → **Dura __ segundos**. Título y dirección son opcionales.

⚠️ **Se pide la DURACIÓN, no el segundo de arranque** (24-sep). Sergio: «me pregunta desde qué segundo empieza, pero es ilógico porque justamente estoy seleccionando la parte del guion donde empieza». Ese campo era el segundo de la GRABACIÓN desde el que se mostraba, y se leía como el segundo del video. Ahora la pantalla trae la duración de la grabación (una imagen, 5 s) y `hastaPorDuracion()` busca la última palabra que cabe: la pantalla aparece 0,35 s antes de su primera palabra y se va 0,6 s después de la última, así que todo junto dura lo pedido. Cruza las líneas que haga falta y puede terminar a mitad de una. Cada línea del Guion trae el segundo de cada palabra (`tp`) para eso.

Queda atada a las **palabras** (de la 22 a la 40), no a segundos: si cambian los cortes o las pausas, la pantalla se mueve con la frase. Y sale igual en el máster 4K.

---

## La cadena

| pieza | qué hace |
|---|---|
| `js/pantallas.js` | el botón, el editor, la subida por trozos; se guardan solas en `projects.pantallas` |
| `servidor/pantalla.ts` | abre y cierra la subida a `uploads/<proyecto>/pantallas/<id>/` y pide a la Lambda que la prepare. **No** crea fila en `clips`: no es un clip, no se transcribe ni se corta |
| Lambda, modo `pantalla` | H.264 ≤1920 px, ≤60 fps, sin audio (o PNG ≤2560 px) en `clips/pantallas/<id>.*`, pública, con su `<id>.json` |
| `servidor/orchestrate.ts` | copia las pantallas (las del pedido o, si no vienen, las del proyecto) en `subtitle_config.pantallas` de cada render |
| `js/graficos.js › conPantallas` | palabras → segundos con el mismo reloj que los gráficos; **mandan**: el gráfico de la IA que se cruce, no sale. El mismo archivo en la página, el ensamblador y Remotion |
| ensamblador | las pone aunque los gráficos de la IA estén apagados, siempre en premium; «detrás de ti» en tres capas (ventana, tu silueta, título) |
| Remotion `Navegador.tsx` | sitio `cherry-graficos-premium-v2` (variable `REMOTION_SITIO` del ensamblador: quitarla vuelve al anterior) |

---

## Lo que se descubrió al probar, y cómo quedó

⚠️ **El título se perdía en «tú arriba».** Un cambio del 23-sep para «detrás de ti» lo quitaba en toda capa con `parte`, y la pantalla partida usa `parte='contenido'`. Ahora solo se quita en `'atras'`.

⚠️ **En «detrás de ti» el título caía sobre la cara.** La ventana baja hasta el 62 % del alto y la cara empieza ahí. El título va arriba, bajo la etiqueta.

⚠️ **En «tú arriba» los subtítulos tapaban la grabación.** Mientras dura esa pantalla, cada frase sube a tu recuadro y se encoge lo justo para caber (nunca más del 72 %): `subirSubtitulos()` transforma `\pos`, `\move`, `\clip`, `\fs`… de la frase entera.

⚠️ **La pasada única monta mal las capas con transparencia** (hueco negro, brillo como marco sólido) y no sabe poner nada detrás de la persona. Los videos desde 4 s van ahora por pedazos, que es el camino comprobado. La pasada única queda solo como respaldo.

⚠️ **Dos llamadas a `capa.filtros` en el mismo pedazo repetían etiquetas** (`[gc0]`, `[go0]`…) y ffmpeg rechazaba el pedazo entero. `filtros()` lleva ahora un prefijo por llamada.

⚠️ **La vista previa premium del editor nunca funcionó.** `premium-vista.js` se armaba con `--global-name`, que declara `var CherryPremiumVista` y, al terminar, lo pisa con lo que devuelve el paquete (nada). Se arma sin ese nombre; el propio paquete se pone en `window.CherryPremiumVista`. Comprobado cargándolo como lo carga el navegador: el viejo quedaba `undefined`, el nuevo es la API.

⚠️ En la vista previa, «detrás de ti» **tapa** la cabeza: el recorte de la silueta solo existe en la nube. El editor lo avisa.

---

## Lo que Sergio vio en la primera prueba y cómo quedó (24-sep, tarde)

Revisó el proyecto de prueba y reclamó cinco cosas. Todas eran reales:

1. **«El video de arriba no rellena la pantalla, queda una franja vacía».** «Tú arriba» usaba el recuadro de la pantalla partida de los gráficos (con margen) y una etiqueta entre tu video y la ventana. Ahora es la forma `mitad`: tu video llena la mitad de arriba de borde a borde (corrido 17 % hacia arriba, sin escalar) y la ventana va pegada debajo. Sin etiqueta.
2. **«La pantalla se mueve, debe quedarse quieta».** La ventana flotaba (ruido de ±6 px), crecía al entrar y tenía un destello. En una pantalla ahora solo aparece y se va. Y `MOV.quieto()` deja sin movimiento de cámara todo pedazo que toque una pantalla (en la vista previa y en el video). *La grabación de prueba se deslizaba por dentro: eso era la prueba, no la plantilla.*
3. **«Se corta a los lados».** Instagram, en un celular alto, llena el alto y recorta ~9 % por lado. La ventana de las pantallas mide 840 de 1080.
4. **«La pantalla de arriba debería estar más arriba».** En «detrás de ti» va al 4,5 % del alto, sin etiqueta ni título encima (no hay sitio que no tape la cara).
5. **«El recorte quedó mal».** ⚠️ **La trampa gorda.** La silueta estaba bien calculada, pero el ffmpeg de la Lambda es de **2018** (`N-47683`) y su `alphamerge` **empareja los cuadros en orden, no por tiempo**. La silueta va a 30 cuadros, el máster a 60, y empieza en otro momento que el pedazo: se desfasaba hasta un segundo (fantasma, pelo cortado, cara a medias). Ahora la silueta se arma sobre la **misma rejilla** que el video —lienzo negro con exactamente los cuadros del pedazo y la silueta encima en su tiempo con `overlay`, que sí sincroniza por tiempo— y se endurece (bajo ~35 % fondo, sobre ~67 % persona, 1 px de suavizado): sin halo de la lámpara ni cara transparente. Comprobado en el máster 4K a 60.

## Medido

- Preparar una grabación de 12 s a 1920×1080: **8 s**.
- Las 4 capas de Remotion para dos pantallas: **20 s y 3 centavos de dólar**; la silueta, 27 s.
- Video de prueba de 21 s con dos pantallas: **~100 s** de punta a punta.

## El Guion con el video ya hecho (24-sep, tarde)

Sergio abrió **Guion** en su proyecto 21 para poner la primera pantalla y salió vacío («Aparece cuando tu video está cortado»). El panel solo leía la base adelantada, que con el video terminado ya no se lee. Ahora, si hay un video hecho, las líneas salen **de ese video** (`datosGuion()` en `js/components/cortesvivo.js`): sus palabras, sus frases, sus gráficos y el reloj real de sus cortes. Son las mismas palabras que usa el ensamblador al exportar, así que la pantalla puesta en la palabra 22 cae en la palabra 22 del video final. Mientras llegan, el panel dice «Leyendo lo que dices en tu video…».

Y **Exportar desde un máster** (orchestrate v231): si el video anterior es de calidad original y se exporta normal, ya no reutiliza la base de 4K (lenta y a 5 Mbps): vuelve a cortar de las copias livianas con la misma lista. Solo «Calidad original» hace 4K.

## El color de la ventana (24-sep, tarde)

Sergio quería cambiar el color de acento de la pantalla: el brillo, el borde y la barra de la ventana. Iba atado al color de Gráficos, y con los gráficos apagados (su caso) el ensamblador lo fijaba en «cherry» sin forma de cambiarlo.

Ahora cada pantalla trae **«Color de la ventana»**: los mismos colores de Gráficos, «Mis colores» y «Otro» (cualquier color, con «+ Guardar color»). Una pantalla nueva hereda el color de la anterior. Sin escoger, sigue saliendo el de Gráficos.

| pieza | qué hace con el color |
|---|---|
| `js/pantallas.js` | el selector; `paraServidor()` lo manda |
| `js/graficos.js` | `colorPantalla()`: un nombre de la lista o `#RRGGBB`; si no, nada. La pieza lo lleva en `color` |
| `servidor/orchestrate.ts` | `limpiarPantallasSrv` lo guarda (v232) |
| ensamblador `premium.js` | `color: j.p.color || o.color` en cada capa de Remotion (v14c) |
| `js/components/movvivo.js` | la vista previa pinta cada pieza con su color |

La plantilla de Remotion no cambió: ya recibía el color por pedido. Probado con una pantalla dorada en una copia del proyecto 21.

## La tercera forma: pantalla arriba, tú abajo (24-sep, tarde)

Sergio: «una opción para que la pantalla dividida sea al revés: el video abajo y la grabación de pantalla arriba».

| pieza | qué hace |
|---|---|
| `js/pantallas.js` | la forma `invertida` («Pantalla arriba, tú abajo»), con título y nota propia |
| `js/graficos.js` | `invertida` → pieza `mitadAbajo`: el hueco es la mitad de ABAJO y el video va corrido 24 % |
| `servidor/orchestrate.ts` | acepta la forma (v233) |
| Remotion `Piezas.tsx` / `Navegador.tsx` | zona 4 %–50 %; la ventana pegada a tu video y el título ENCIMA de ella |
| ensamblador | `subirSubtitulos(…, abajo)`: cada frase baja a la franja 51,5 %–57,5 %, entre la ventana y tu pelo (v14d) |

⚠️ **24 % y no 33 %.** El cálculo general corría el video 33 % (el mismo trozo que en «tú arriba») y la boca caía al 87 % del alto, justo donde Instagram pone el nombre y el texto de la publicación. Con 24 % la barbilla queda ~82 %.

⚠️ **Sitio de Remotion `cherry-graficos-premium-v3`** (variable `REMOTION_SITIO` del ensamblador). Volver al anterior = poner `…-v2`. `graficos.js` de Remotion NO es el del repo: tiene tipos propios (teléfono, navegador, marcador); se le aplican los cambios a mano, nunca se copia encima. `js/premium-vista.js` se rearmó con esbuild **sin** `--global-name`.

En la vista previa del celular los subtítulos todavía no se mueven con las pantallas (tampoco en «tú arriba»); en el video final sí.


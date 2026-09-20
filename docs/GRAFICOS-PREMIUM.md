# Gráficos premium — qué está aprobado y qué no

Estado al **19 de septiembre de 2026**. Este archivo manda sobre cualquier otra lista: si una plantilla no
aparece como aprobada aquí, no se conecta ni se le ofrece al usuario.

## La regla nueva

Los gráficos que vengan de ahora en adelante **salen de referencias en video que manda Sergio**, no de
propuestas nuestras. Él manda el video, nosotros miramos el gráfico que aparece ahí y lo recreamos tal cual.
De siete diseños propuestos a ciegas solo pasaron dos: proponer de nuestra cosecha sale caro y no da en el
blanco.

## Los seis de la primera tanda — en producción

| Plantilla | Archivo | Forma | Estado |
|---|---|---|---|
| Número gigante | `premium/src/plantillas/Numero.tsx` | Encima del video | ✅ en uso |
| Porcentaje (anillo) | `premium/src/plantillas/Porcentaje.tsx` | Pantalla partida | ✅ en uso |
| Lista | `premium/src/plantillas/Lista.tsx` | Encima del video | ✅ en uso |
| Antes y después | `premium/src/plantillas/Comparacion.tsx` | Pantalla completa | ✅ en uso |
| Línea de tiempo | `premium/src/plantillas/Linea.tsx` | Encima del video | ✅ en uso |
| Cita | `premium/src/plantillas/Cita.tsx` | Encima del video | ✅ en uso |

## Los siete de la segunda tanda — veredicto de Sergio

| Plantilla | Archivo | Forma | Veredicto |
|---|---|---|---|
| Medidor de aguja | `premium/src/plantillas/Medidor.tsx` | Pantalla partida | ✅ **aprobado** — falta conectarlo |
| Mito / Realidad | `premium/src/plantillas/Mito.tsx` | Encima del video | ✅ **aprobado** — falta conectarlo |
| Celular 3D (mockup) | `premium/src/plantillas/Celular.tsx` | Tu video a un lado | 🟡 **por pulir** — le gusta la idea, no cómo quedó |
| Recibo / desglose | `premium/src/plantillas/Desglose.tsx` | Pantalla completa | ❌ descartado |
| Pasos 1·2·3 | `premium/src/plantillas/Pasos.tsx` | Tu video a un lado | ❌ descartado |
| Palabra gigante | `premium/src/plantillas/Palabra.tsx` | Encima del video | ❌ descartado |
| Podio top 3 | `premium/src/plantillas/Podio.tsx` | Pantalla completa | ❌ descartado |

Las descartadas siguen en el repositorio y registradas en `premium/src/Grafico.tsx`, pero **no** están en el
prompt de la IA (`deploy/biblioteca.ts`), **no** tienen dibujo clásico en `js/graficos.js` y **no** aparecen
en la pestaña Gráficos. Quedan ahí por si algún día una referencia se parece a alguna.

## Para conectar una plantilla de punta a punta

1. `deploy/biblioteca.ts` — enseñarle a la IA el tipo nuevo y qué datos pedir.
2. `js/graficos.js` — el dibujo del estilo Clásico (el de respaldo, sin costo de render) y la forma.
3. `js/components/config.js` — que salga en la pestaña Gráficos.
4. La plantilla de Remotion ya construida, y volver a publicar el sitio:
   `npx remotion lambda sites create src/index.ts --site-name=cherry-graficos-premium`

## Un fallo arreglado el 19-sep

El tambor de dígitos dejaba las decenas a medio girar con cualquier número que no terminara en 0 (17, 25,
43…): el «17 %» se veía como un glifo partido. Afectaba a **Porcentaje**, que ya estaba en producción, y al
Medidor nuevo. Arreglado con `posDigito()` en `premium/src/lib/Piezas.tsx`, que hace rodar las decenas solo
en el último 10 % del dígito de abajo, como un odómetro de verdad, y así siempre aterrizan en un entero.

---

# Profundidad: el gráfico detrás de la persona

Añadido el **19 de septiembre de 2026**, a partir de cuatro videos de referencia que mandó Sergio. En las
ediciones que él quiere, el texto y los objetos **no van encima del video: van detrás de la persona**. Eso
pide separar al que habla del fondo en cada cuadro.

## Cómo se recorta

Modelo **Robust Video Matting** (`rvm_mobilenetv3_fp32.onnx`, 15 MB, del repositorio oficial del proyecto),
corriendo con `onnxruntime` en CPU. Es un modelo pensado para video: arrastra un estado entre cuadros, así
que el borde no tiembla y el pelo sale limpio.

Medido sobre el video real de Sergio:

| | |
|---|---|
| Resolución de cálculo | 608 × 1080 (media); la silueta se amplía al montar |
| Tiempo | **107 ms por cuadro** |
| Un gráfico de 5 s | 150 cuadros ≈ 16 s de proceso |
| Costo estimado en Lambda | **≈ $0,001 por gráfico** |

La clave del costo: **solo se recortan los segundos que dura el gráfico**, nunca el video entero.

Banco de pruebas: `scratchpad/mascaras.py` (saca la silueta a un mp4 en blanco y negro) y
`premium/montar_profundo.mjs` (monta video + capa detrás + persona + capa delante con ffmpeg `alphamerge`).

## La forma `profundo`

Forma nueva en `graficos.js`, junto a `encima`, `partida`, `completa` y `lado`:

- El video **no se encoge** (`objetivo()` devuelve `null` y `video()` la ignora).
- La capa ocupa el cuadro entero.
- Cada gráfico se renderiza en **dos capas**: `parte: 'atras'` y `parte: 'delante'`. La plantilla lee `parte`
  del contexto y dibuja una u otra. Las que no necesitan capa delante devuelven `null`.

El orden al montar es: video → capa `atras` → persona recortada → capa `delante`.

## Las siete plantillas de la tanda — veredicto

Todas en `premium/src/plantillas/`, registradas en `Grafico.tsx`, con datos de ejemplo en
`premium/piezas_profundo.json`.

| Plantilla | Archivo | Capas | Costo medido | Veredicto |
|---|---|---|---|---|
| Palabra clave | `Clave.tsx` | atrás | $0,008 | ✅ aprobado |
| Panel de puntos | `Panel.tsx` | atrás | $0,010 | ✅ aprobado |
| Rejilla de tomas | `Galeria.tsx` | atrás | $0,027 | ✅ aprobado |
| Banda de dato | `Banda.tsx` | atrás + delante | $0,011 | ✅ aprobado |
| Marco y título | `Marco.tsx` | atrás + delante | $0,012 | ✅ aprobado |
| Cifra monumental | `Monumento.tsx` | atrás + delante | $0,012 | ❌ descartado |
| Antes y después | `Contraste.tsx` | atrás + delante | $0,013 | ❌ descartado |

## Trampas encontradas

- **`backdrop-filter` no sirve** en una capa transparente: no hay nada detrás dentro de la propia capa. El
  vidrio esmerilado de verdad necesita el truco `vidrio` del ensamblador (la capa marca la zona y ffmpeg
  desenfoca el video debajo). En `Panel.tsx` se resolvió con un fondo oscuro translúcido.
- **`display: grid` parte una cifra en renglones**: cada dígito que devuelve `<Cifra>` cae en su propia fila.
  Usar `flex` con `alignItems: center`.
- **Lo que va delante sobre ropa clara desaparece.** Las capas `delante` con texto abajo llevan un degradado
  oscuro suave desde el borde inferior.
- `render_profundo.mjs` con filtro de tipo reescribe `out/prof/lista.json` solo con ese tipo; por eso
  `montar_profundo.mjs` ya no lee ese archivo y busca las capas en disco.


---

# Lo que falta por implementar

**Nada de esto está conectado todavía.** Sergio va a mandar más gráficos y pidió construirlos **todos
juntos** cuando cierre la lista, en vez de ir uno por uno.

## Los siete aprobados

| Plantilla | De dónde salió |
|---|---|
| Medidor de aguja | tanda 2 |
| Mito / Realidad | tanda 2 |
| Palabra clave | profundidad · referencias |
| Panel de puntos | profundidad · referencias |
| Rejilla de tomas | profundidad · referencias |
| Banda de dato | profundidad · propuesta propia |
| Marco y título | profundidad · referencias |

## Lo que hay que hacer con cada uno

1. `deploy/biblioteca.ts` — enseñarle a la IA el tipo nuevo, qué datos pedir y cuándo escogerlo.
2. `js/graficos.js` — el dibujo del estilo Clásico (respaldo sin costo de render) y la forma.
3. `js/components/config.js` — que salga en la pestaña Gráficos.
4. Publicar el sitio: `npx remotion lambda sites create src/index.ts --site-name=cherry-graficos-premium`

## Y además, para los cinco de profundidad

El recorte de la persona **solo existe como banco de pruebas local**. Para producción hay que:

- Meter el modelo (15 MB) y `onnxruntime` en la función que procesa el video.
- Calcular la silueta **solo en los segundos de cada gráfico con forma `profundo`**, nunca el video entero.
- Pasar la silueta al ensamblador y montar en orden: video → capa `atras` → persona → capa `delante`.
- Decidir dónde se coloca cada gráfico para que no tape la cara.

## Pendiente aparte

- **Celular 3D**: aprobado a medias, falta saber qué pulirle y de dónde sale el video de adentro.
- **Objetos en 3D** (llave, bombilla, cerebro): de las referencias, sin empezar. Necesita una biblioteca de
  objetos; va en su propia tanda.
- **Palabra clave en neón**: es un estilo de subtítulo, no un gráfico. Sin empezar.

---

# La placa de texto (forma `tapa`)

Construida el **19-sep-2026** a partir de la segunda referencia de Sergio (un paquete de presets de texto para
Premiere). El video se esconde y queda una lámina con el texto, como un rótulo de diseño.

Archivo: `premium/src/plantillas/Placa.tsx` · datos de ejemplo: `premium/piezas_placa.json` ·
render y montaje: `premium/placas.mjs` · **pendiente del veredicto de Sergio**.

## No es una plantilla: son tres ejes

Cualquier combinación vale, así que con un solo componente salen 80 resultados distintos.

| Eje | Dato | Valores |
|---|---|---|
| Fondo | `datos.fondo` | `crema`, `tinta`, `marca`, `papel` |
| Letra | `datos.letra` | `gruesa` (Outfit), `alta` (Anton), `bloque` (Archivo Black), `serif` (Playfair), `condensa` (Bebas) |
| Entrada | `datos.entrada` | `desenfoque`, `golpe`, `suave`, `rebote` |

Las cuatro entradas salieron de mirar la referencia cuadro por cuadro: `desenfoque` = llega de un lado muy
borrosa y se enfoca; `golpe` = salto seco con escala; `suave` = solo opacidad, sin mover; `rebote` = entra
grande y borrosa y se encoge. Todas **salen** con desenfoque.

## El texto: cuatro ranuras

`etiqueta` (cajita de color), `arriba` (línea pequeña), `titulo` (el grande) y `abajo` (cursiva). Las tres
primeras marcas de tiempo (`p.marcas`) disparan cada ranura, así que la placa se escribe al ritmo de lo que
dice el usuario en vez de aparecer como una diapositiva.

## Detalles del acabado

- **La sombra de ventana con persiana**: un SVG con el marco y siete lamas, rotado −16°, con
  `feGaussianBlur stdDeviation=13`. Cada fondo trae su propia opacidad (`luz`), porque sobre papel se ve mucho
  más que sobre negro.
- **El grano**: `feTurbulence` en `mixBlendMode: overlay`, con su propia intensidad por fondo.
- **La sombra de las letras**: `text-shadow` desplazado hacia abajo, más fuerte cuanto más grande el texto.

## Trampas

- Un hijo `display: inline-block` dentro de un contenedor flex en columna **se estira a todo el ancho**: la
  etiqueta de color necesita `alignSelf: 'flex-start'`.
- La forma `tapa` se comporta como `profundo` en `graficos.js` (el video no se encoge), pero **no necesita la
  silueta**: la capa es opaca y tapa el video ella sola.

## Costo medido

$0,011 – $0,028 por placa en Lambda (media **$0,020**). Las seis del ejemplo, $0,119.

---

# La placa de texto: DESCARTADA

Sergio la descartó el 20-sep-2026 después de varias rondas. Se queda todo el código (`Placa.tsx`,
`lib/Tres.tsx`, `lib/Objetos.tsx`, `FondoPlaca.tsx`, `UnObjeto.tsx`, `Prueba3D.tsx`, las formas `tapa` y los
PNG de `public/objetos` y `public/fondos`) pero **no se conecta ni se ofrece**.

Lo que sí sirve de ahí, por si algún día hace falta:

- **El 3D de verdad funciona en Remotion** (`@remotion/three`), pero **no se puede renderizar en el
  servidor**: sin tarjeta gráfica tarda más de tres minutos solo en montar un fotograma. La única vía es
  renderizar cada objeto **una vez** como PNG y reutilizarlo.
- **`filter: drop-shadow` con desenfoques grandes es carísimo.** Medido: la sombra de un objeto costaba
  3,4 de los 3,7 segundos de cada cuadro. Horneada dentro del PNG, el mismo resultado sale 22 veces más
  rápido. Lo mismo vale para el `text-shadow` de muchas capas.
- Existe una función Lambda con 900 s de timeout (`remotion-render-4-0-526-mem3008mb-disk2048mb-900sec`)
  desplegada para esas pruebas. La de producción sigue siendo la de 240 s.

**La regla que queda:** el estilo de Cherry es la tarjeta de vidrio premium. Los gráficos nuevos se hacen
copiando ese ADN, no inventando mundos visuales nuevos.

---

# Tanda de números (pendiente de veredicto)

Siete plantillas nuevas del estilo premium, construidas el 20-sep-2026, para cuando el guion habla de cifras.
Datos de ejemplo en `premium/piezas_tanda1.json`.

| Plantilla | Archivo | Forma | Costo | Para qué |
|---|---|---|---|---|
| Ranking | `Ranking.tsx` | encima | $0,017 | ordenar de mayor a menor |
| Meta | `Meta.tsx` | encima | $0,017 | por dónde vas respecto a una meta |
| Reparto | `Reparto.tsx` | partida | $0,018 | repartir un total en trozos |
| Rango | `Rango.tsx` | encima | $0,019 | de tanto a tanto |
| Múltiplo | `Multiplo.tsx` | encima | $0,020 | «el triple», «cinco veces más» |
| Evolución | `Evolucion.tsx` | encima | $0,017 | cómo ha ido en el tiempo |
| Cuota | `Cuota.tsx` | partida | $0,018 | «4 de cada 10» |

Los siete juntos: **$0,128** y 29 segundos de render.

Quedan por construir la tanda de **explicar o comparar** (flujo, balanza, pirámide, cuadrante, tabla, agenda)
y la de **rematar una idea** (titular, pregunta, aviso, cierre, dato con fuente, tres claves).

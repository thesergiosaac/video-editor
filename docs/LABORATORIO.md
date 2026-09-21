# El Laboratorio (20-sep-2026)

Herramienta del inicio, como Guiones o Storyboard: `herramientas/laboratorio.html`, con su tarjeta
en el bento (`.ci-lab`, rejilla `1/8` en la fila de abajo, junto al mapa).

Responde a una sola pregunta: **por qué un video retuvo y otro no.**

## La regla que ordena todo

> Lo único que hace que un video funcione es la retención. La hora de publicación no retiene.

De ahí sale que la pantalla abra con *qué falta por saber*, no con las visitas.

## Las seis zonas

| Zona | Qué hace |
|---|---|
| **El experimento** | La receta del próximo video, con **una sola** variable cambiada |
| **El embudo** | Qué sospechosos siguen vivos y cuáles ya se descartaron |
| **Desmontar** | Saca de un video: gancho, estructura, formato, open loop, idea, ritmo |
| **El baúl** | Las fichas guardadas, con marcador y tendencia |
| **Mis videos** | Lo publicado con su retención y el segundo de caída |
| **Auditar** | Si el video nuevo sirve como experimento o cambió de más |

## Tres decisiones que no hay que deshacer

**1 · Lo medible se mide; a la IA solo se le pregunta lo interpretable.**
En `lab_desmontar`, las palabras por minuto y la duración las calcula el servidor con los números
reales. Si se le piden a la IA, devuelve cifras que *parecen* medidas y no lo son. La IA solo saca
el tipo de gancho, los tramos, el formato, el open loop y la idea.

**2 · El embudo se cierra por coincidencia, no por acumulación.**
Se compara el video que MÁS retuvo con el que MENOS. *Lo que es igual en los dos no puede explicar
la diferencia*, así que se descarta solo — por eso funciona desde el primer par de videos y no hace
falta esperar a tener veinte.

Y el atajo de la curva: si se van **antes de que acabe el gancho** (`caida <= gancho.seg + 1`), se
descarta todo lo demás de un golpe, porque no alcanzaron a verlo. Ese umbral se mide contra el
gancho de *ese* video, nunca contra un número fijo de segundos.

**3 · Tendencia, no promedio.**
Los gustos cambian con el tiempo; la gente lo llama «cambió el algoritmo». Una ficha usada 8 veces
con media del 39% puede estar retiniendo 31% en las últimas 4: se está gastando. El promedio lo
esconde, por eso cada ficha lleva primera mitad contra segunda mitad y avisa cuando cae 5 puntos.

## Los open loops son una cadena, no uno

Corregido por Sergio el 20-sep. Un open loop es **cuando el video hace creer que ya va a revelar
algo y no lo revela**, o revela una parte y deja otra sin cerrar, de modo que el espectador sigue
para averiguarlo. Los videos que retienen **encadenan varios hasta el final**.

Yo lo tenía como uno solo que se abre y se cierra, y eso perdía lo importante. Medido con un video
real de 51 s: el modelo viejo habría encontrado **uno**; el nuevo encuentra **cuatro**, uno cada
14 segundos, el último a 3 segundos del final.

Lo que de verdad dice algo no es cuántos hay, sino **cuánto video queda después del último**
(`cadena.huecoFinal`): ahí ya no hay nada tirando del espectador, y suele ser justo donde se cae la
curva. Si ese hueco pasa de un tercio del video, `cadena.seSuelta` se pone en true y la pantalla lo
avisa: *«el último open loop está en 0:18 y al video le quedan 33 segundos después»*.

Cada loop se guarda como su propia ficha (uno bueno sirve para otro video) **y** la cadena entera
como otra, porque «4 encadenados, uno cada 14 s» es un patrón reutilizable por sí mismo.

El auditor los compara **por cantidad**, admitiendo una de diferencia: encadenar tres o encadenar
uno retiene de forma muy distinta.

### Las tres señales las busca el código, no la IA

Sergio marcó a mano los cuatro open loops de un video y se midió contra su lista, repitiendo cuatro
veces (lo que importa no es acertar una vez con suerte). Pidiéndoselo solo a la IA:

| señal | salía |
|---|---|
| la frase se corta — «y esto crea un sesgo psicológico…» | 4/4 |
| señala y no nombra — «lo único que realmente importa es esto» | **1/4** |
| remite a otro sitio — «comenta y te lo mando» | 3/4 |

Afinar el prompt no lo arregló en dos intentos, así que las tres se buscan con reglas fijas
(`senalesDeLoop`) y lo que la IA no coge se añade igual. Después: **4/4 en las tres, cuatro veces
seguidas.**

Dos trampas que costaron un rato:

- **`trozoPrometedor`**: en «te dirán que hagas contenido de valor *cuando lo único que realmente
  importa es esto*», la promesa va al final. Copiar el principio de la frase da un loop inútil, así
  que se corta por el último conector.
- **El orden de las ramas**: «señala y no nombra» tiene que mirarse ANTES que «frase cortada»,
  porque esas frases acaban en «esto» y «esto» también está en la lista de palabras colgantes. Con
  el orden al revés devolvía la frase entera en vez del trozo, y ese era justo el caso que fallaba.

### El CTA no es un open loop

Corregido por Sergio al ver el video real. «Comenta la palabra X y te lo mando» al final es el
**cierre**, no un aplazamiento del guion: un open loop aplaza algo DENTRO del video para que sigas
viéndolo; el CTA manda fuera, cuando ya se acabó.

Se distingue midiendo: si la única señal es «remite a otro sitio» y cae en el **último 20%** del
video, es el cierre — se saca de `loops` y, si la IA lo devolvió igual, se quita. Con eso los tres
open loops que marcó Sergio salen 3/3 en cuatro intentos y el CTA no se cuela en ninguno.

Lo desmontado antes del 20-sep guardaba `loop` en singular. `loopsDe()` lee las dos formas y el
servidor sigue devolviendo `loop` con el primero, así que nada de lo guardado se rompe.

## La idea y la estructura, como las lee Sergio

**La idea va partida en tres**: `tema` + `creencia` + `realidad` («cómo ser viral, qué cree la gente
y qué sirve en realidad»). Así es una plantilla que se lleva a otro tema, y deja a la vista si el
video llega a decir la realidad. `realidad` se deja **vacía** cuando el video no la dice: muchos la
prometen y nunca la sueltan, y rellenarla con lo que la IA suponga sería inventar.

**La estructura es un recorrido**, no cuatro tramos planos: cuerpos de información ALTERNANDO con
open loops, y el final no es un cierre sino un CTA que suele generar necesidad. Los loops ya están
detectados, así que `mapa.pasos` los intercala por su segundo en vez de pedírselos otra vez a la IA
y arriesgarse a que salgan distintos. Un tramo que empieza con la misma frase que un loop se quita:
es el mismo momento contado dos veces.

Cada cuerpo lleva `sobre`: creencia, error, mito, dato, historia o realidad. De ahí sale
`soloCreencias`, que es una observación de Sergio: cuando todos los cuerpos hablan de lo que la
gente cree y ninguno dice qué funciona, **el video le deja la pregunta puesta al espectador** («yo
hago eso y dice que no basta, ¿entonces qué me falta?»). La pantalla lo dice.

## Desmontar un video que no es tuyo

Es el caso importante —el baúl se llena con referencias de otros— y el que peor resuelto estaba:
un video ajeno no tiene transcripción en ninguna parte.

Se suelta el archivo y **el navegador le saca el audio**: lo decodifica con Web Audio, lo pasa a
mono de 16 kHz (lo que oye Whisper; más no sirve de nada) y lo manda en WAV. Un reel de 52 s pasa de
21 MB de video a **1,66 MB de audio, en medio segundo**. La duración sale del propio archivo, así
que tampoco hay que escribirla.

El servidor es `lab-transcribir`, una función aparte porque manda un archivo y no JSON —
`CherryApp.funcionArchivo()` en `cherry.js`. **No tiene nada que ver con `transcribe-clip`**, que
vive dentro del pipeline de proyectos (clips, renders, motor de tomas) y no sirve para un video
suelto que solo se desmonta y se tira.

No se descargan videos de TikTok ni de Instagram desde el servidor: es frágil y depende de lo que
cada plataforma permita. El video se descarga por fuera y se suelta.

## Cherry mira el video

Lo visual no está en la transcripción, así que **Gemini ve el video entero de forma nativa** —imagen
y movimiento, con marcas de tiempo— en vez de fotogramas sueltos: con fotogramas habría que adivinar
dónde mirar; así ve el tren porque ve que se mueve. Función `lab-ver-video`.

Busca el **gancho visual** (qué se ve en los 2 primeros segundos, antes de entender lo que dice) y
los **open loops visuales** con la definición de Sergio: algo inesperado que irrumpe y rompe la
expectativa, y que suele caer justo cuando la voz deja una frase a medias. Los separa de los apoyos
normales (una captura, un b-roll) y de los simples cambios de plano.

**Oírlo y mirarlo van en paralelo**, porque tardan distinto: el audio son segundos, la vista unos
veinte. Medido de punta a punta con un video de 21 MB: **24 segundos en total**, no la suma. Si la
vista falla, el desmontaje del texto sale igual y se avisa.

Lo que se ve entra en **el mismo recorrido** que lo que se dice, cada cosa en su segundo (en ámbar),
que es como se lee un video de verdad y no en dos listas sueltas.

Trampas del modelo: `gemini-2.5-flash` y `gemini-2.0-flash` ya **no admiten usuarios nuevos** y
devuelven 404. Por eso la lista empieza por `gemini-flash-latest`, que es un alias y no se cae cuando
Google retira una versión. El video se sube por la **Files API** (en base64 un reel de 30 MB pasa de
40 y revienta el límite) y **se borra de Google al terminar**.

Probado con un video de plano fijo: dijo «mantiene un único plano fijo sin cortes» y **no inventó
open loops visuales donde no los hay**, que era el riesgo.

### Los cortes de voz los ve Gemini, no se leen

**El fallo de raíz, encontrado por Sergio.** En su video de referencia la frase se corta en «…lo más
importante, el…» y **Whisper se inventó la palabra que faltaba**: transcribió «el gancho». Esa
palabra no se dice ahí.

Eso hunde cualquier regla sobre el texto. La frase llega completa, bien puntuada y con una palabra
que nadie dijo: no queda colgando, no tiene puntos suspensivos, no hay nada que detectar. Por eso el
detector daba 4/4 con el texto de prueba (escrito a mano, con los «…») y cero con el video real.

Pero Gemini está viendo el video: **oye que la voz se corta y ve lo que la interrumpe**. Así que
`lab-ver-video` devuelve `vozCortada` —qué alcanza a decir, en qué segundo y qué lo corta— y de ahí
salen los open loops hablados que la transcripción no puede dar. Se le pide expresamente que **no
complete nunca** la frase, ni aunque sea obvio cómo seguiría.

Se fusionan con los del texto descartando los que caigan a menos de 3 s de uno ya detectado, para no
contar el mismo momento dos veces.

Probado con un video de plano fijo: **0 cortes de voz**, que es lo correcto — ahí nadie interrumpe.

> Lección general: cuando el dato de entrada puede estar inventado, ninguna regla sobre ese dato lo
> arregla. Hay que ir a una fuente que vea el original.

### La transcripción se arregla antes de analizar

Medido con el video de Sergio: **Whisper escribe «lo más importante, el gancho» y Gemini
transcribiendo escribe lo mismo** (y encima alucina «Gary Vaynerchuk» donde se dice «sesgo»).
Ninguna transcripción literal da los cortes: los modelos completan las frases porque es lo que
hacen. Cambiar de transcriptor no arregla nada.

Lo que sí funciona es **preguntar por los cortes**, que es otra pregunta distinta. Con eso,
`arreglarTexto()` corta la frase en el texto antes de desmontarlo: busca las últimas 3–4 palabras de
lo que se alcanza a decir (el principio puede estar transcrito distinto; el final es lo que importa)
y tira lo que venía después dentro de esa frase. La pantalla enseña qué se quitó.

Por eso **desmontar ya no va en paralelo con mirar**: espera a los dos. Si no, todo el análisis —la
idea, la estructura, los open loops— se haría sobre una palabra que nadie dijo.

### Arreglar la transcripción: qué funciona y qué no

El problema de raíz: **Whisper completa las frases que se cortan e inventa la palabra que falta**
(«lo más importante, el gancho» — esa palabra no se dice). Cuatro enfoques probados:

| enfoque | resultado |
|---|---|
| Que transcriba Gemini en vez de Whisper | **no** — completa igual y encima alucinó «Gary Vaynerchuk» |
| Recortar el texto por conteo de palabras | **no** — cortó «se va a caer», que sí se dice |
| Aceptar de Gemini el texto reescrito entero | **no** — cambia cosas que no declara, imposible de auditar |
| Barrer todo el video por pedazos | **no** — un pedazo que acaba a mitad de frase sale con «...» y se toma por corte: se comió la frase del CEO entera |

Lo que **sí** funciona, y es lo que quedó:

1. **Gemini declara correcciones `{antes, despues}`** y el servidor las aplica una a una, solo si el
   trozo `antes` existe literalmente en la transcripción. Acotado y auditable: la pantalla enseña
   cada cambio.
2. **Lee los subtítulos quemados** (idea de Sergio): son texto escrito por quien hizo el video, así
   que mandan sobre lo que parezca oírse. Un subtítulo a medias es la prueba más clara de un corte.
3. **Solo donde Gemini oye un corte**, ese pedazo se vuelve a transcribir SOLO. Sin el texto de
   alrededor, Whisper no completa la frase: el trozo 20–29 s del video de Sergio da «lo más
   importante, el...», con los puntos y sin la palabra inventada. El cosido trabaja con **frases
   enteras**, nunca contando palabras — las dos versiones que lo hacían así duplicaron texto una y
   se comieron trozos la otra.
4. `temperature: 0`, porque dos pasadas del mismo video tienen que dar lo mismo.

Queda una variabilidad de fondo: **Whisper no transcribe igual dos veces** (una pasada da «¡Se va a
salir!» donde otra da «se va a caer»), así que el resultado final tampoco es idéntico siempre.

### La regla de los visuales

De Sergio: *«antes de cada open loop visual hay un open loop del guion»*. Tiene sentido —el visual
irrumpe justo para tapar lo que la voz no llega a decir— y **no hay que adivinarlo**: un tramo
hablado que cae a menos de 4 s de un open loop visual pasa a ser open loop.

Hacía falta porque `vozCortada` es variable: en una pasada marcaba «Y estos ganchos son [sesgos]
psicológicos…» y en la siguiente no. Con la regla sale siempre.

Resultado con su video de referencia: **sus tres open loops del guion, cada uno seguido de su open
loop visual**, el CTA aparte, y 13 tarjetas con su fotograma.

## El desglose es un storyboard

Una lista de frases no deja VER el gancho visual ni el open loop visual, que es justo lo que se
acaba de poder detectar. Así que el recorrido se pinta como un storyboard: **cada momento con su
fotograma**, el segundo en una pastilla encima y el tipo en color (rosa los open loops hablados,
ámbar los visuales, teal el gancho y el CTA).

Los fotogramas **los saca el navegador** del archivo que ya tiene en la mano: un video oculto,
saltar al segundo y dibujar en un canvas. No se sube nada más. Tres detalles que costaron:

- **De uno en uno.** Un salto tiene que terminar (`seeked`) antes de pedir el siguiente; a la vez,
  el video devuelve el cuadro equivocado.
- **Un pelo después del segundo exacto** (+0,12 s): justo en el corte a veces cae el cuadro anterior.
- **Se pintan encima del storyboard ya dibujado**, para poder ir leyendo el desglose mientras salen.

La proporción sale del propio video (`--prop`), así que un vertical no se deforma y un horizontal
tampoco.

**La ficha visual se guarda con su fotograma**, encogido a 96 px de ancho: unos 4 KB, contra los
~20 del storyboard. Sin la imagen, «open loop visual: cae un carro del cielo» no se puede comparar
con nada; y como todo vive en un solo documento de la cuenta, no puede engordar sin motivo. Las
fichas **se recalculan al pulsar guardar**, no se usan las de cuando se pintó: los fotogramas llegan
unos segundos más tarde y la lista de entonces todavía no los tenía.

## Cuentas

Cada cuenta lleva **su propio embudo**: el mismo gancho puede retener en soysergiosaac y no en
Cobra. Las fichas del baúl se guardan una sola vez (una idea buena sirve en cualquier parte) pero
**su marcador se calcula por cuenta**.

## Dónde vive cada cosa

- **Página**: `herramientas/laboratorio.html`
- **Tarjeta del bento**: `js/components/inicio.js` (`const lab = tarjeta('ci-lab', …)`) y
  `css/styles.css` (`.ci-lab`, `.ci-curva`)
- **Servidor**: acciones `lab_desmontar` y `lab_auditar` en la función `herramientas`; funciones
  propias `lab-transcribir` (Whisper) y `lab-ver-video` (Gemini). Copia de las dos en `servidor/`,
  para que no vivan solo en el portátil — se despliegan por la API de Supabase, no desde aquí.
- **Llave**: `GEMINI_API_KEY` en los secretos de Supabase (capa gratuita de Google AI Studio)
- **Lo guardado**: tabla `herramientas_datos`, herramienta `laboratorio`. **No hay tablas nuevas**:
  usa el mismo documento por usuario que Guiones, Storyboard y las demás.

## Lo que falta

- **Leer las capturas de estadísticas.** Hoy los números de cada video se escriben a mano. Para
  leerlos de una captura hace falta ver primero las capturas reales de cada plataforma y saber qué
  campos salen de verdad en cada una.
- **Entrenar el desmontaje con los desmontajes de Sergio.** Mientras no existan, la IA desmonta
  como una IA genérica y no con su criterio.
- **Dos estatuas**: una de laboratorio para la tarjeta del experimento y una de cofre para el baúl.
  Hoy la tarjeta del bento usa la curva de retención en su lugar, y la del experimento reutiliza
  `sonido_boca.webp`, que estaba sin usar.

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

## Las tres cosas que hay que saber (22-sep-2026)

Sergio lo dijo así: *«que el usuario sepa exactamente 3 cosas: 1. ya sé cómo le fue a mi video
2. ohh entiendo que debo cambiar o probar 3. ya sé qué mejorar para el próximo»*. El panel del
experimento se rehizo con esas tres preguntas como títulos, y el orden importa.

**1 · Cómo le fue.** *Todas* las estadísticas, no solo la retención: retención, omisiones,
visitas, cuentas alcanzadas, me gusta, comentarios, reposts, enviados, guardados y seguidores
nuevos. Cada número lleva su juicio al lado (*baja*, *pocos*, *ninguno*, *buena*) porque un número
suelto no dice si está bien o mal. **Reposts y enviados son métricas distintas** —las flechas en
círculo y el avión— y no se juntan. Lo que la captura no traía no se pinta: `Number(null)` es 0, y
un 0 inventado miente.

**2 · Lo que probablemente no funcionó.** Sale de `veredicto()`, que recoge evidencia de sitios
distintos: los peldaños fallados, la cadena de open loops, la zona y el lenguaje, la emoción del
gancho, si la idea promete y no suelta, y el ritmo de corte.

**3 · Lo que sí funciona — no lo toques.** La misma función, del otro lado. Pesa tanto como el
anterior: sin esta lista se cambia lo que estaba bien y se pierde lo que ya se había ganado.

**Y un cuarto cubo que no pidió pero hace falta:** *esto todavía no se puede saber*. Lo que está
tapado por un peldaño de más abajo no entra ni en el 2 ni en el 3 — sus números están medidos
sobre los pocos que pasaron el filtro anterior, así que aún no significan nada. Decirlos como
hechos sería mentir con números de verdad.

---

## La ficha técnica del próximo video (22-sep-2026)

El veredicto termina en un botón que lleva aquí. Es lo que pidió Sergio: *«una especie de tabla
con el espacio para poner su nuevo guion, con secciones, estructura, guías visuales, consejos…
es como una ficha técnica, donde el usuario entienda y sienta que la necesita para poder grabar
y seguir midiendo»*.

Vive en la vista `v7`, se guarda en `D.planes[]` y el que está en marcha es el primero sin
`grabado`. Tiene cuatro apartados:

| apartado | qué guarda |
|---|---|
| arriba, el experimento | lo único que cambia, lo que NO se toca, y el número a mirar — heredado del veredicto |
| **1 · La idea** | el tema, qué cree la gente, qué pasa en realidad, y la zona |
| **2 · El formato y la emoción** | los 11 formatos y las 8 emociones de Sergio, más la duración prevista |
| **3 · El guion** | una fila por sección: **qué dices** y **qué se ve**, con el consejo debajo |
| **4 · Auditar** | manda la ficha a `lab_guion` y pinta el resultado ahí mismo |

**Lo que hereda del veredicto no es decorativo.** Si el veredicto dijo que el formato funcionaba,
la ficha nace con ese formato puesto. Si dijo que el gancho fallaba, nace en blanco: eso es lo que
se va a cambiar. Así la ficha *es* el experimento, no un papel aparte.

**La columna de la derecha es el punto.** «Qué se ve» es la que casi nadie escribe y la que decide
si el video se ve o se pasa. Si está vacía, en la grabación sale lo de siempre: hablando de frente.

**Los consejos no los escribe la IA.** Están en `TIPOS`, uno por clase de sección, y son el
criterio de Sergio puesto donde hace falta leerlo — los cuatro ganchos en el gancho, el truco de la
contra en la creencia, las tres señales de loop en el open loop, el CTA que no es un loop en el
cierre.

### Auditar el guion: `lab_guion`

Distinta de `lab_auditar`, que compara dos videos ya grabados. Esta mira el guion **escrito**,
antes de gastar una grabación. Casi todo se cuenta en código, que es lo que no se inventa:

- **el gancho** cabe o no en tres segundos (a 2,6 palabras/segundo, que es ritmo de reel)
- **los open loops**, con `senalesDeLoop()` — las mismas tres señales de siempre, y el CTA fuera
- **el CTA** pide algo concreto o no
- **la idea** tiene sus tres partes
- **lo que se ve** está escrito en cuántas secciones
- **la duración**: si el guion cabe en los segundos que se puso

La IA solo juzga las tres que no se pueden contar: la zona, el lenguaje y la emoción del gancho.

**La zona costó un ajuste.** El primer prompt hacía que el modelo juzgara si el consejo era
*novedoso*, no a cuánta gente le sirve, y tachaba de «mainstream» un guion que está en zona segura
—2 de 3 veces con el guion real de Sergio—. El prompt ahora dice explícitamente que no juzgue
calidad ni originalidad, con un ejemplo de cada zona. Medido después: el guion bueno pasa 3 de 3.

**Medido con dos guiones**, uno flojo y uno bueno, porque una auditoría que aprueba todo o suspende
todo no está mirando nada (`_probar_guion.py`):

| | flojo | bueno |
|---|---|---|
| bien | 2–3 | 9 |
| mal | 3–4 | 0 |
| dudas | 3 | 0 |

---

## La tanda de 4 (22-sep-2026)

Es el punto 2 del ciclo de la guía, hecho código.

**Una variable solo se puede juzgar si hay dos videos con valores distintos de ella.** Si todos los
videos llevan siempre el mismo formato, ese formato no está *bien*: está **sin probar**, que no es
lo mismo. `queSePuedeJuzgar()` recorre `VARIABLES` y cuenta cuántos valores distintos tiene cada
una entre los videos con datos.

No es lo mismo que el embudo. El embudo compara el que más retuvo con el que menos y descarta lo
que coincide en los dos. Esto responde a otra pregunta: *¿alguna vez has probado a cambiar esto?*

**Si no hay ninguna variable probada**, el veredicto no propone un video: propone la tanda.
`armarTanda()` crea cuatro fichas de golpe, con la misma marca `tanda`, y cada una:

- deja **en blanco** su propia variable — eso es lo que hay que inventar
- hereda **todo lo demás** del video de control — eso es lo que hay que repetir igual
- lleva escrito en `noTocar` cuáles son las otras tres

Las cuatro se ven como pestañas arriba de la ficha, con su estado (sin empezar / escrito / grabado).
La edición no entra en la tanda: no se decide al escribir la ficha, sale del montaje.

Medido en Node con casos donde la respuesta se sabe (`_probar_tanda.js`, en el scratchpad): un
video solo → ninguna variable probada; tres videos que solo cambian la idea → solo la idea probada;
y las cuatro fichas dejan en blanco exactamente su variable.

### Lo que falta de la guía

- **la palabra** para la mitad probada del baúl — «ganador» no vale (ver `CRITERIO-SERGIO.md` §9)
- **el baúl en dos mitades**, que depende de esa palabra
- **bautizar las estructuras de guion** — Sergio dirá qué define cada una

---

## La recomendación, dicha como a una persona

Estaba todo bien calculado y no se entendía, que es lo mismo que no servir. Lo que fallaba:

- Decía **categorías, no instrucciones**: «Primer plano: otra cosa en pantalla» no se puede grabar.
- **No decía qué tiene AHORA**, que es contra lo que se compara todo lo demás.
- «Igual = igual» repetido cuatro veces era ruido.
- Las etiquetas en mayúsculas (PRIMER PLANO, GANCHO VISUAL) sonaban a ficha técnica.

Ahora son cuatro bloques, en el orden en que los necesita quien va a grabar:

1. **Ahora tienes esto** — sale del análisis del propio video («tu video empieza así: un hombre de
   camisa negra habla a cámara en un restaurante»).
2. **Prueba con esto** — frases que se pueden grabar, no categorías. Y **una sale del baúl**: «como
   en tu baúl: un hombre en traje pisa una cáscara de plátano». Ahí es donde la referencia entra en
   la recomendación.
3. **No toques nada más** — en una línea.
4. **Cuando lo subas, mira esto** — el número **con el valor de hoy al lado**, para poder comparar:
   *«la gente que se lo salta · 82,8% hoy · la meta es por debajo del 55%»*.

Los cuatro peldaños ya no están en primer plano: viven en un plegable, **«¿Por qué esto y no otra
cosa?»**, para quien quiera el razonamiento.

## El umbral de despegue

A partir de qué retención despega ESA cuenta. No «qué retención es buena» según nadie: el número de
esa audiencia, porque cada una tiene el suyo.

El método es simple a propósito: se ordenan los videos por retención y se busca **el mayor salto de
visitas entre dos videos consecutivos**. Ahí está el escalón.

**La trampa que costó:** primero comparaba las medianas de los dos grupos, y eso **premia siempre
los cortes altos** —al subir el corte, la mediana de arriba sube más rápido que la de abajo—, así
que colocaba el umbral por encima del salto real. Probado con ocho videos cuyo escalón estaba entre
38% y 44%: con medianas daba 48%, con saltos consecutivos da **41%**.

Se exigen al menos **5 videos** con retención y visitas, y **2 a cada lado** del corte para que un
video con suerte no invente un escalón. Por debajo de 10 videos lo dice: *«esto es una pista, no una
ley»*. Y si no hay escalón, lo dice también, en vez de inventar un número.

A propósito **no se calculan correlaciones**: con diez videos una correlación es una casualidad con
apariencia de ciencia.

## Los cuatro peldaños y el tablero

El embudo de comparar esperaba a tener dos videos. Este **dirige desde el primero**, porque la curva
no juzga el video entero: **juzga cada tramo, y cada tramo lo gobierna una variable distinta.**

### Los peldaños se tapan unos a otros

Lo que hace que esto funcione. No se puede saber si la idea es buena hasta que la gente llegue a
oírla, ni si el guion aguanta si el gancho no deja pasar a nadie:

| # | peldaño | lo mide | manda |
|---|---|---|---|
| 1 | ¿Paran el scroll? | las omisiones | el gancho visual y el primer fotograma |
| 2 | ¿Pasan de la entrada? | la curva al acabar el gancho | el gancho verbal |
| 3 | ¿Aguantan el cuerpo? | cuántos de los que entran llegan al final | el guion, el ritmo, los open loops |
| 4 | ¿Vale la pena? | guardados y compartidos por visita | la idea |

**Cherry propone siempre el más bajo sin resolver.** Todo lo de arriba es aire hasta que ese se
arregle, y por eso la orden no es una opinión: es lo único que puede dar información.

Dos reglas que se aplican en el código y son fáciles de romper sin querer:

- **Un peldaño TAPADO no mueve el tablero**, ni para bien ni para mal. Si solo entra el 35%, lo que
  haga ese 35% en el cuerpo no dice nada del cuerpo. (Este fallo estuvo dentro un rato: señalaba «el
  guion» por una caída medida sobre cuatro gatos.)
- **El peldaño 3 es una proporción, no un absoluto.** De los que *entran*, cuántos llegan al final.
  Si al gancho llega el 35% y al final queda el 18%, aguantó la mitad — y eso es bueno, no malo.

Los cortes (`CORTE` en el código) son míos y discutibles: 55% de omisiones, 50% que pasa la entrada,
45% que aguanta el cuerpo, 1% que lo mueve. Están en un solo sitio para cambiarlos fácil, **y los
números los decide Sergio**.

### El tablero de evidencia

Seis variables con su estado, movido por todos los videos. Con uno solo ya se mueve, porque **la
forma de la curva descarta sola**: si se van dentro del gancho, la idea y el formato no pueden ser
la causa — nadie llegó a verlos.

Una casilla **solo empeora**: si un video la señaló, hace falta otro video que la limpie, no que
pase el tiempo. Eso está en `PESO`.

### Medido con el primer video de Cobra

Datos reales: 26% de retención, se van en el 0:05, 82,8% de omisiones, 93 visitas.

- **Peldaño 1 sin resolver** y los otros tres tapados.
- Tablero: **solo el gancho señalado**; todo lo demás sin evaluar.
- La orden: *«cambia lo que se VE en el primer segundo»* — **no lo que dice**. Con 82,8% de
  omisiones el problema está un peldaño por debajo del gancho verbal, que es donde yo mismo lo había
  puesto mirándolo a ojo.
- Y qué mirar después: *«el porcentaje de omisiones: si baja de 55%, era lo que se veía»*.

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

### Quién puede cortar una frase

Gemini corregía «...pensaste, se va a caer.» por «...pensaste...», cortando una frase que SÍ se
termina. Así que se separaron las dos cosas y el servidor lo hace cumplir:

- **Gemini solo arregla PALABRAS** («zedos» → «sesgos»). Toda corrección suya que acabe en «...» y
  sea un recorte de lo anterior se descarta, esté en el prompt o no.
- **Los cortes de frase los decide volver a transcribir ese pedazo**, que sí se puede comprobar: el
  pedazo se pide **varios segundos MÁS ALLÁ** del corte, y entonces se verifica solo. Medido:
  «se va a caer» parecía cortada hasta el segundo 13 y se completa al pedir hasta el 17; «lo más
  importante, el...» sigue cortada aunque el pedazo llegue al 32. Por eso la frase cortada puede
  quedar en medio del pedazo, y el cosido busca todas las que acaben en «...», no solo la última.

### Guardar desde el storyboard

Pedido por Sergio: el storyboard ya enseña cada momento con su fotograma, así que una lista aparte
repetía lo mismo sin imagen. Cada tarjeta lleva su casilla, y **vienen marcadas las reutilizables**
—gancho, open loops, visuales— pero no los cuerpos ni el CTA, que son el contenido de ese video y
casi nunca sirven para otro.

Abajo quedan solo las que no pasan en un segundo concreto y por eso no tienen fotograma: estructura,
formato, ritmo y la idea.

### La regla de los visuales

De Sergio: *«antes de cada open loop visual hay un open loop del guion»*. Tiene sentido —el visual
irrumpe justo para tapar lo que la voz no llega a decir— y **no hay que adivinarlo**: un tramo
hablado que cae a menos de 4 s de un open loop visual pasa a ser open loop.

Hacía falta porque `vozCortada` es variable: en una pasada marcaba «Y estos ganchos son [sesgos]
psicológicos…» y en la siguiente no. Con la regla sale siempre.

Resultado con su video de referencia: **sus tres open loops del guion, cada uno seguido de su open
loop visual**, el CTA aparte, y 13 tarjetas con su fotograma.

## Cherry mira CÓMO está hecho

Pedido por Sergio. Hasta ahora Cherry oía lo que se dice y veía lo que irrumpe, pero no miraba la
producción — y ahí está media respuesta a «por qué ese retiene y el mío no». Gemini ya tenía el
video delante: solo había que pedírselo.

Saca: **formato, tomas, encuadres, cortes y cortes por minuto, plano más largo, apoyo, gráficos,
subtítulos (estilo, sitio y pinta), color, luz, sonido y encuadre**.

**Y resuelve el formato**, que el texto no puede. Desde la transcripción no se distingue «A cámara»
de «Dinámico» —eso se ve, no se lee— así que el desmontaje ponía «A cámara» ante la duda. Ahora el
formato VISTO manda sobre el leído. Medido con el video del plátano: el texto decía «A cámara»,
mirándolo dice **«Dinámico», 6 encuadres, 18 cortes, 21 por minuto**.

### La firma visual

De 3 a 5 cosas que harían reconocible el video como de esa cuenta: el sitio, la ropa, un color, el
estilo de los subtítulos, un objeto. Del plátano salió *traje azul · maletín negro · subtítulos
centrados · entorno urbano · ritmo rápido*.

Sirve para la identidad de marca, que **solo se ve comparando varios videos entre sí**: cuando haya
firmas guardadas de varios, se podrá avisar del que se sale («este lleva subtítulos amarillos en el
centro y los otros cuatro blancos abajo: parece de otra cuenta»). La captura de la firma está hecha;
la comparación entre videos, todavía no.

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

## La ventana del formulario iba fuera del tema

Se veía gris, lavada y con un grano horrible. Tres causas juntas, y la de fondo es la que hay que
recordar:

1. **Colgaba de `document.body`.** Los colores del tema viven en `.app`, así que fuera de ahí la
   ventana se quedaba **sin ninguna variable**: de ahí el gris. Y tampoco cambiaba con Noche/Papel.
   Ahora se cuelga de `.app` — sigue tapando la pantalla porque es `position: fixed`.
2. **Llevaba la clase `.vol`**, cuyo grano usa `mix-blend-mode: overlay` y se mezclaba con el velo
   borroso de detrás. La ventana tiene ahora su propio fondo, opaco y sin grano.
3. **No fijaba el `color`**, así que en Papel salía el texto crema sobre fondo claro. Medido después
   del arreglo: contraste de 213 en Noche y 235 en Papel.

> Regla: cualquier cosa que se añada por JavaScript tiene que colgar de `.app`, no del `body`, o se
> queda sin tema.

## Mis videos: el video también se suelta ahí

Faltaba, y era un hueco grande: en «Mis videos» solo se podían soltar las capturas, así que un video
propio se quedaba **sin producción, sin gancho visual y sin open loops visuales** — y el primer
peldaño, ¿paran el scroll?, depende justo de lo que se ve.

Ahora el análisis entero está en `analizarVideo()` y lo usan los dos sitios. Un video propio queda
igual de desarmado que una referencia, y encima con sus números.

### El modal pide dos cosas y nada más

Pedido por Sergio. Antes tenía siete campos que había que revisar dentro de una ventana pequeña.
Ahora solo pide **el video y las capturas**, las dos obligatorias —sin las dos el análisis va cojo—
y el botón de guardar no se enciende hasta tener ambas.

**Todo lo demás se deduce**: el título sale de `idea.tema` del propio video (más descriptivo que lo
que se escribiría a mano), la fecha y los números de las capturas, la duración de la gráfica o del
archivo, y el desmontaje del video.

**Y el resultado no se enseña dentro del modal**: el modal se cierra y aparece en la pantalla, que
es donde hay sitio para leerlo — las cifras, la curva y los cuatro peldaños con su diagnóstico.

## Leer las capturas de estadísticas

Provisional a propósito: cuando estén los permisos de Meta, los números vendrán de la API de
Insights. Pero escribirlos a mano era lo que frenaba todo —sin números no hay embudo—, así que
mientras tanto se sueltan las capturas y Gemini las lee. Función `lab-leer-metricas`.

Se pueden soltar **varias a la vez** (en Instagram nunca cabe todo en una pantalla) y se leen como
si fueran una sola. También valen pegadas con Ctrl+V, que es como llegan del móvil.

Medido con capturas reales de Sergio, **10 de 10 datos correctos en los dos videos probados**, en
unos 4 segundos.

### Dos trampas que costaron

**Las dos gráficas.** Instagram enseña dos que se parecen y solo una sirve:
- ✗ «Visualizaciones en el tiempo» — el eje va en HORAS desde que se publicó y la línea SUBE. No es
  retención.
- ✓ «Durante cuánto tiempo las personas vieron tu reel» — el eje va en segundos del video y la línea
  BAJA desde 100%. Esa es.

La regla que se le da: si el eje está en horas o la línea sube, no es.

**El cero que miente.** `Number(null)` es 0, así que un dato que no estaba en la captura se colaba
como «retención 0%» o «se van en el segundo 0». Ahora null es null, y la pantalla dice «no estaba en
la captura».

### Lo que se deduce sin inventar

Instagram casi nunca da el porcentaje de retención, pero da el «tiempo promedio de reproducción» en
segundos. Y la gráfica de retención **llega hasta el final del video**, así que su último segundo es
la duración. Con las dos cosas sale la retención, y la pantalla enseña de dónde: *«26% · 13 s de
media sobre 50 s»*. Es una división, no una estimación — y por eso se hace fuera de la IA, a la que
se le prohíbe calcular nada.

Lo leído **rellena** los campos, no los sustituye: lo que ya esté escrito manda, y todo se puede
revisar antes de guardar. Un número mal leído que entre sin que nadie lo mire estropea el embudo.

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

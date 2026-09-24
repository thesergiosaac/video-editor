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

---

## Las piezas (22-sep-2026)

**El cambio de fondo.** Idea, estructura, gancho y formato dejan de ser texto suelto y pasan a ser
entidades con identidad: se eligen de un desplegable, se reutilizan entre videos y arrastran su
historial. Sin esto Cherry no puede decir «esa idea ya la grabaste dos veces y nunca funcionó»,
porque dos videos con la misma idea escrita distinto serían dos ideas.

`llave()` normaliza antes de comparar (minúsculas, sin tildes, sin signos), así que «Cómo ser
rentable» y «como ser RENTABLE!» son la misma pieza. `crearPieza()` busca antes de crear.

El vínculo video↔pieza viene del plan cuando el video se planeó; si no, `vincularPiezas()` lo saca
del desmontaje al guardarlo. Los videos anteriores se vincularon solos al abrir.

### Una pieza tapada no cuenta como fallo

Lo más importante de todo esto, y salió de abrir la página: con el único video de Sergio, la
auditoría marcaba la idea y la estructura como **inertes**. Pero ese video se lo saltó el 83% —
la idea no falló, es que nadie la vio.

Cada pieza se juzga en su peldaño (`PELDANO_DE`): el **gancho** siempre cuenta, porque es el primer
filtro y nada lo tapa; la **estructura** y el **formato**, solo si la gente entró; la **idea**, solo
si llegaron al final. Un video que no llega no suma ni resta, se cuenta aparte, y la pantalla dice
«tapada, no se ha podido juzgar», que no es lo mismo que «sin estrenar».

Es el mismo principio que ordena los peldaños, y el baúl se lo estaba saltando.

### El baúl manda por pieza, no por estado

Uno busca «una idea», no «una magnética»: el estado es el punto de color de la ficha, no su carpeta.
Cuatro columnas, y dentro de cada una las fichas ordenadas con lo que funciona arriba. Las demás
fichas —ritmo, subtítulos, firma visual— no son piezas con las que se arme un video: bajan a «otras
observaciones», plegadas.

---

## La ficha y el guion (22-sep-2026)

Dos columnas para que quepa sin scroll ([[feedback-sin-scroll]] en la memoria): la ficha a la
izquierda, el guion a la derecha.

**Los campos son desplegables, nunca texto libre.** Cada uno enseña el estado de la pieza al lado, y
al final del menú está «＋ nueva». Las inertes también salen: a veces se quiere repetir una a
propósito, y esconderla sería decidir por él.

**El guion sale de los pasos de la estructura.** Al cambiar de estructura cambian los campos, y lo
escrito se conserva emparejando por tipo de paso **y contando repeticiones**: el segundo «Open loop»
recupera lo del segundo, no lo del primero. Esa es la parte que se rompe si se hace a la ligera.

**Los open loops no son un campo de la tabla**: son pasos dentro de la estructura. La estructura
decide cuántos hay y dónde.

### Auditar mira dos cosas distintas

1. **Si cada pieza vale por su historial** — «esa idea la has usado 2 veces y no ha retenido
   ninguna: cámbiala».
2. **Si el video sirve como experimento** — y esto es lo que se pierde de vista: si contra el video
   de control cambian dos piezas, no se podrá saber cuál fue. Con una sola, sí.

### Las estructuras se bautizan de un catálogo

Los pasos se eligen de `catalogoPasos()`, nunca se escriben. Si uno escribe «gancho», otro «hook» y
otro «entrada», dos estructuras iguales parecen distintas y no se pueden comparar. El catálogo crece
con lo que traigan las referencias, y lo nuevo queda para todos los guiones.

Las estructuras nacen bautizadas (`nombreEstructura()`: El desmentido, Lista con trampa, La cadena)
y quedan marcadas «sin bautizar» para que Sergio les ponga el suyo.

---

## Lo que salió de las referencias (22-sep-2026)

Once virales, vistas fotograma a fotograma. Tres cambios en Cherry:

**1 · La creencia ya no es obligatoria.** El prompt de `lab_desmontar` pedía «qué cree la gente»
siempre, así que la inventaba: once creencias de once videos cuando la mayoría no desmiente nada.
Ahora solo sale si el video habla de ello. Medido: vacía en dos de tres, y en el del ranking pone
«ChatGPT es la mejor», que es la que ese video sí desmonta.

**2 · Los pasos, de tres a once, con hueco para los nuevos.** Con Gancho / Cuerpo / CTA toda
estructura salía «Gancho → Cuerpo ×6 → CTA» y no se podía comparar con ninguna otra — que era
justo el objetivo. El prompt devuelve `parte: "Otro"` + `nuevo: "<nombre>"` cuando ve uno que no
encaja, y el servidor lo acepta con su nombre en vez de meterlo en «Cuerpo». Los siete nuevos están
en `CRITERIO-SERGIO.md` §11.

**3 · Los recursos de pantalla.** `lab-ver-video` los detecta (lista cerrada de doce, validada en
el servidor: un nombre libre no se podría comparar entre videos) y el storyboard los **recomienda**
con `recursosPara()`, como mucho dos — uno bien puesto vale más que cinco amontonados.

### Dos cosas que costaron

- **El orden dentro del JSON importa.** Con `recursos` al final de la respuesta, Gemini no devolvía
  ninguno. Moviéndolo al principio y subiendo `maxOutputTokens` a 9000, empezó a verlos.
- **«Lista con huecos» y «ranking al revés» eran indistinguibles** para el modelo: metía los dos en
  el primero. Se fusionaron en **«marcador que se rellena»**, y el orden de llenado se pide en el
  texto libre — así sí sale: *«7 puestos, el 1 al final»*.

**Lo que no funciona:** la barra de progreso con nombres de sección la confunde con otra cosa. Sale
en 1 de 11, así que no compensa seguir afinando el prompt por ella.

---

## El storyboard (22-sep-2026)

Cherry propone el plano de cada paso según el formato: un dinámico corta cada 2–4 s y alterna
medio, contrapicado, b-roll y primer plano; una entrevista no mueve la cámara en todo el video; un
VS va estático y partido en dos.

**Las viñetas se dibujan** (`bocetoSB`), papel claro y trazo a lápiz. Un dibujo dice «contrapicado,
plano medio, texto arriba» de un vistazo, sale instantáneo y cuesta cero. Generarlas con IA serían
~250 imágenes al mes que no dirían más. El **ejemplo real** sí es un fotograma, y saldrá de las
referencias que Sergio desmonta — para eso hay que guardar sus fotogramas etiquetados, que todavía
no se hace.

`RECETA_FORMATO` es una aproximación mía hasta que Sergio dé un video de cada formato.

---

## El ciclo del video (22-sep-2026)

**Un video no es una foto.** Los números cambian durante días, así que se mide varias veces
(`medicionesDe`, `traccion`). Con unos cuantos videos medidos así, Cherry sabrá cuánto tarda *su*
audiencia en reaccionar — un dato que no tiene nadie más porque sale de sus cuentas.

- «Mis videos» abre con tres carriles: **por grabar**, **grabados sin publicar** y **publicados**.
  Un video grabado y sin publicar es trabajo hecho que no está midiendo nada: por eso tiene carril
  propio en vez de esconderse entre los planes.
- las fechas de la ficha generan los avisos al entrar (`recordatorios()`): «¿ya lo grabaste?», «¿ya
  lo publicaste?» y «lleva 5 días sin medir»
- `cuandoVolverAMedir()` apaga el botón si se midió hoy: apenas se está mostrando
- dos mediciones del mismo día se reemplazan, no se acumulan
- al medir de nuevo **el diálogo no pide el video**: lo que cambia son los números

**Una trampa que costó:** ya existía un `pintarTablero(tb)` (el del embudo). La función nueva se
llamaba igual, la pisaba, y al llamarla sin argumentos reventaba — de paso rompiendo el embudo. El
comprobador ahora avisa de funciones declaradas dos veces, que no se ve leyendo.

---

## El baúl magnético (22-sep-2026)

La palabra la escogió Sergio (`CRITERIO-SERGIO.md` §9). Lo que importa de la implementación es que
**el estado no se pone a mano**: sale de los datos, en `estadoDe(m)`.

```
neutra     → nunca usada                       (n = 0)
temporal   → la usó y acertó al menos una vez   (aciertos ≥ 1)
magnética  → usada 2+ veces y aciertos === n    (nunca falló)
inerte     → usada y nunca acertó               (aciertos = 0)
```

«Acertar» es quedar por encima de `corteAcierto()`: el **umbral de despegue** si ya se puede
calcular, y si no el corte del cuerpo (45%). Los dos números son de Sergio.

**Por qué esto importa más que la palabra:** una magnética que falla una vez deja de serlo *sola*,
porque `aciertos !== n`. No hay que degradar nada a mano, y no existe el caso de un baúl lleno de
etiquetas viejas que ya no son verdad. Era justo lo que se le pedía a la palabra — «se desimanta»
— y sale gratis del cálculo.

Dos avisos distintos, que no son lo mismo:

- **se está desimantando** — sigue siendo magnética pero la tendencia va cuesta abajo (`sube === false`)
- **ya no es magnética** — falló, y se dice con el marcador: «acertó 3 de 4»

Las palabras viven en `MAG`, en un solo sitio. Las cerezas las dibuja `cereza(estado, alto)`: las
limaduras de hierro alrededor cuentan el estado antes de que se lea la palabra.

Medido en Node con 11 casos (`_probar_magnetico.js`, en el scratchpad), incluido el que importa:
tres aciertos → magnética; el cuarto video falla → baja a temporal sin tocar nada.

### La trampa de las clases cortas

`.t` es **la tarjeta del bento** y trae `min-height: 250px`. Un `<span class="t">` pintado por el
JS dentro de cualquier otra cosa hereda esa regla y abre un hueco de 250 px que no se explica
mirando el código de al lado. Pasó con la guía del baúl vacío.

Regla: lo que pinta el JS lleva nombre propio con prefijo (`.gc-t`, `.fic-pe`, `.est-c`), y las
clases de una o dos letras se anidan siempre bajo un padre (`.asomo .af`, no `.af`). Un
comprobador estático no lo caza bien —lo intenté y daba falsos positivos—: esto se ve abriendo la
página.

### Lo que falta de la guía

- **confirmar la palabra del medio** — hoy «temporales», provisional
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

---

# La tarjeta «Tu cuenta» (inicio) — 22-sep-2026

Arriba a la derecha del bento, donde antes estaba Guiones. Tiene dos caras y va rotando sola:
la réplica del perfil de Instagram con el resumen de la cuenta, y los videos publicados.

## Qué enseña, y de dónde sale cada cosa

| Lo que se ve | De dónde sale |
|---|---|
| Usuario, foto, publicaciones, seguidos, biografía | `D.cuentas[]` — se escriben a mano en el Laboratorio (botón **✎ perfil**) |
| Seguidores | El último video registrado que traiga `seguidores`. **No se escribe a mano**: un número que se pueda poner en dos sitios acaba diciendo dos cosas |
| El aro | Con pocos videos, los cuatro peldaños del mejor video. Cuando ya se ve el umbral de despegue, la mejor retención contra ese umbral |
| Videos, visitas, interacciones, retención | Suma de los videos medidos de la cuenta activa. Interacciones = me gusta + comentarios + reposts + enviados + guardados |
| Las flechas (↑38 %) | La mitad reciente contra la mitad antigua. Hacen falta 4 videos: dos no son una racha |
| La gráfica del avance | Una barra por video, en orden, sumando visitas e interacciones. En raíz, no en línea recta: de 820 a 18.400 las primeras quedarían en un píxel |
| «↑ 4,2× más que el primero» | El último contra el primero, con esa misma suma |
| La cara del video | Título, retención, visitas, interacciones y dónde se fue la mitad de la gente |

Nada se inventa: lo que no está medido sale como guion, nunca como cero.

## Los tres estados

- **Cuenta nueva** (sin videos): el perfil sí, el resto en guiones, «Completa tu perfil →» y los
  botones *Desmontar un video* / *Ya publiqué uno*. No rota.
- **Un video**: el aro vuelve a los peldaños, no hay gráfica ni tendencia — no hay con qué comparar.
- **Con varios**: todo lleno.

## Cómo funciona por dentro

- `js/resumen-cuenta.js` — **calcula**. Lee el documento del Laboratorio y no escribe nada.
  ⚠️ `CORTE`, `MINIMO_UMBRAL`, `peldanos` y `umbral` están **copiados** de `laboratorio.html`, para
  que el inicio no tenga que cargar sus 300 KB. Si cambian allí, hay que cambiarlos aquí.
- `js/components/inicio-cuenta.js` — **pinta y rota**. Expone `C.tarjetaCuenta()`.
- `js/api.js` › `getDatosHerramienta(herr)` — lee `herramientas_datos` de esa persona.
- `css/styles.css` — `.ci-cuenta` y todo lo que empieza por `.cic-`.

**Primero lo local, después el servidor**: se pinta con la copia que el Laboratorio dejó en este
navegador (`cherry-herr-laboratorio-<uid>`) y solo después se pide la de la cuenta. Sin conexión se
queda con la local, que es lo correcto.

**El nodo es uno solo para toda la vida de la página.** `C.render()` reconstruye la app entera en
cada cambio de estado; un nodo nuevo cada vez reiniciaría la rotación con cada tecla del buscador.

## El botón

Uno solo, abajo a la derecha, pequeño y en gris. En un video dice **«volver al resumen»**: lleva al
resumen y lo deja fijo (la barra de tiempo se apaga). Desde el resumen dice **«ver los videos»** y
la suelta. Mientras rota normal y ya estás en el resumen, no aparece: no hay nada que estorbe.
Los iconos de navegación se quitaron — esos son de la tarjeta de herramientas.

## La tarjeta que rota entre las herramientas

Debajo de «Tu cuenta», en la misma columna. Una sola tarjeta que va pasando por **Guiones,
Storyboard, Carruseles, Calendario de contenido, Identidad de marca y Laboratorio**, en vez de seis
tarjetas sueltas llenando el bento. Abajo lleva un icono por herramienta: tocar uno va directo a
esa y **para la rotación** — si siguiera girando, lo que acabas de elegir se iría solo.

El bento queda como la maqueta que aprobó Sergio: **Editor Pro** grande a la izquierda, y a la
derecha **Tu cuenta** arriba y **la que rota** debajo. El mapa («Así trabajan juntas») y «Seguir
editando» pasan a ancho completo.

- `js/components/inicio-gira.js` — `C.tarjetaGira(lista)`. Cada herramienta lleva `{nombre, icono,
  etq, titulo, texto, estatua|adorno, abrir}`.
- Las que no tienen estatua llevan **su propio dibujo** (`adorno`): la semana del Calendario y la
  curva de retención del Laboratorio, que es lo que enseñaban de sueltas.
- Las seis funciones sueltas siguen en `inicio.js` pero ya no van al bento: están marcadas.

## Cuatro trampas que costaron una vuelta cada una

0. **El nombre de clase ya existía y rompió la barra de arriba.** `.ci-cuenta` era el contenedor
   del avatar en la barra; le puse ese mismo nombre a la tarjeta del bento y mis reglas
   (`grid-column`, `min-height:388px`, `padding:0`) cayeron sobre la barra y la estiraron. Nada
   avisa: el CSS no da errores. La tarjeta pasó a `.ci-perfil` / `cp-`, y el comprobador
   `_colisiones.py` busca ahora clases definidas dos veces **al nivel de arriba** del archivo —
   redefinir dentro de un `@media` es normal, hacerlo fuera es siempre un choque.


1. **`-webkit-line-clamp` no sobrevive dentro de un flex.** Un hijo directo de un contenedor flex se
   «blockifica»: el navegador le cambia `display:-webkit-box` a `flow-root` y el recorte deja el
   párrafo en **cero de alto**. La biografía no se veía. Se recorta con `max-height`.
2. **`.ci-t p` gana a `.cic-bio`.** La regla de todas las tarjetas del bento (`max-width:30ch`,
   `margin:0`) tiene más especificidad que una clase sola: la biografía salía cortada a 30
   caracteres y el pie del video no bajaba al fondo. Se arregla prefijando con `.ci-cuenta`.
3. **Los hijos de un flex en columna se encogen.** La frase del umbral salía aplastada a 14 px con
   la letra cortada por la mitad, sin ningún error. `.cic-cara > * { flex: none }`.

## Lo que falta

- **El fotograma del video.** Hoy no se guarda ninguno, así que el marco vertical enseña la curva de
  retención a tamaño completo. Cuando se guarde, la curva baja al tercio inferior y el fotograma va
  detrás (el marco ya lo contempla: clase `cic-marco--curva`).
- **La API de Instagram.** El día que estén los permisos, el perfil se rellena solo y el diálogo
  **✎ perfil** se queda de repuesto.

---

# Las marcas (22-sep-2026)

Una **marca** es una cuenta de redes con todo lo suyo aparte: sus videos, su baúl de piezas, sus
fichas, sus planes y su perfil. Los videos de Cobra no se planean con el baúl de sergiosaac.co —
**un gancho que retiene en una cuenta no retiene en otra**, que es la regla con la que empezó el
Laboratorio. Al cambiar de marca la pantalla no cambia: cambian los datos.

**Dónde se cambian:** en el menú de la foto, arriba a la derecha, en las **seis** herramientas
(`herramientas/cuenta.js`). Ahí está el perfil de la marca —foto, usuario, biografía, publicaciones,
seguidos—, crear otra marca y, cuando Meta apruebe los permisos, la conexión con Instagram. Salieron
de la cabecera del Laboratorio porque lo importante tiene que verse sin bajar.

**El puente.** Si el Laboratorio está abierto, el documento está en su memoria; escribirlo también
desde `cuenta.js` haría que uno pisara al otro. Por eso el Laboratorio registra
`CherryApp.marcas({lista, activa, cambiar, crear, guardar})` y `cuenta.js` lo usa en vez de escribir
por detrás. En las demás herramientas no hay puente y `cuenta.js` carga el documento él mismo.

**Lo que se separó por marca en este cambio:** las piezas del baúl y las fichas no lo estaban — al
crear la segunda marca habría aparecido el baúl entero de la primera. Se filtran con `piezasDe(tipo)`
y `fichasDeMarca()`, y lo guardado antes se sella con la marca activa al abrir (`migrarAMarcas`).
`piezaPorId` **no** filtra a propósito: un video viejo puede apuntar a una pieza de otra marca y, si
filtrara, se quedaría sin nombre en pantalla.

**En los datos siguen llamándose `cuentas`** (`D.cuentas`, `v.cuenta`, `p.cuenta`): renombrar el
campo obligaría a migrar todo lo guardado sin ganar nada. Lo visible dice «marca».

# La cabecera, fuera del bento

Al entrar a una vista de trabajo (la ficha, desmontar, mis videos…) la cabecera se encoge a una
línea con el «volver»: el título grande y el párrafo empujaban **170 px** lo que vienes a hacer. Es
`app[data-vista="trabajo"]`, que pone `ver()`. Medido: la ficha pasa de empezar en 328 px a 158.

# Un solo menú de la foto (22-sep-2026)

`js/cuenta.js`, cargado por el inicio **y** por las seis herramientas. Antes había dos menús
distintos —el del inicio con «Mis proyectos / Cerrar sesión» y el de las herramientas con las
marcas— y saltaba a la vista.

Vive en los dos mundos: las herramientas traen `CherryApp`, el inicio trae `CARRETE`. Lo poco que
cambia (leer el documento, guardarlo, quién es el usuario) está traducido arriba del archivo; el
menú es el mismo. Cada página le añade sus entradas con `CherryCuenta.opciones([…])`.

**El clic va delegado en el `document`, no en el avatar.** El inicio reconstruye la app entera en
cada cambio de estado y un listener puesto sobre ese nodo se iría con él. Por lo mismo, un
`MutationObserver` repinta el avatar tras cada redibujo — y `pintaAvatar` es **idempotente**: si ya
está como debe no toca el DOM, porque si escribiera siempre el observer se dispararía por su propio
cambio y no pararía nunca.

# Dos cosas que estaban mal y se vieron en pantalla

**«1 seguidores» con 50 mil detrás.** Saqué los seguidores del último video, pero ese campo se
llama «Seguidores **nuevos**»: son los que trajo ese video, no el total de la cuenta. Ahora se
escriben en el perfil de la marca, como las publicaciones y los seguidos.

**Los desplegables de la ficha salían transparentes.** `var(--tarjeta)` no existía — el token se
llama `--tarjeta-a`. **Una variable CSS que nadie define no da ningún error**: el navegador descarta
la propiedad y el fondo se queda sin pintar. Estaba en cinco sitios. Se definió `--tarjeta` como lo
que siempre quiso ser: la superficie opaca que va *encima* de un panel. El comprobador
`_vars.py` del scratchpad las busca.

# La tabla, y un guardado que nunca ocurrió (22-sep-2026)

`herramientas_datos` tiene un **CHECK con la lista de herramientas permitidas**, y `'laboratorio'`
no estaba en ella. Desde el 20-sep la base de datos rechazó **todos** los guardados del Laboratorio
y sus datos vivieron solo en el `localStorage` del navegador. Arreglado el 22-sep:

```sql
ALTER TABLE herramientas_datos DROP CONSTRAINT herramientas_datos_herramienta_check;
ALTER TABLE herramientas_datos ADD CONSTRAINT herramientas_datos_herramienta_check
  CHECK (herramienta IN ('guiones','storyboard','carruseles','calendario','marca','laboratorio'));
```

**Al añadir una herramienta nueva hay que meterla en ese CHECK**, o pasará lo mismo.

**Por qué no se notó durante dos días:** `CherryApp.guardar()` escribe la copia local primero y
manda al servidor después; el fallo iba a `console.warn`. Ahora el Laboratorio le pasa el tercer
argumento —el avisador— y lo enseña en pantalla. No basta con mirar el error: hay que **ponerlo
donde el usuario lo vea**.

**Y el daño que causó:** como no había fila, `cuenta.js` leía `null` y lo trataba como «esta persona
no tiene marcas», creando una inventada que además se escribió sobre la copia local — el único
sitio donde estaban los datos de verdad. **Un `null` que significa «todavía no se sabe» no es el
mismo que significa «está vacío».** Ahora `cuenta.js` distingue los dos y no crea nada hasta tener
una respuesta real del servidor.

# «Mis videos» es una lista de videos (22-sep-2026)

Tenía dos gráficos enormes arriba y pedía pantalla y media de scroll. Los dos se fueron, por dos
razones distintas que conviene no mezclar:

- **La nube del umbral** («a partir de qué retención despega esta cuenta») es estadística de la
  **cuenta**, no de un video. El número ya sale en el aro del resumen del inicio; la nube entera
  espera a una pantalla de estadísticas de la cuenta, que está por hacer. `pintarUmbral` y
  `nubeSVG` se quedan sin usar a propósito, marcadas — son el único sitio donde está escrito cómo
  se dibuja.
- **La curva del mejor y el peor** es comparativa entre videos, o sea también de cuenta. Va al
  mismo sitio.

Ahora la vista es el ciclo arriba y la lista debajo. **Se toca un video y se entra a ese video**:
sus cifras, su curva y sus peldaños. Mientras hay uno abierto, la lista y el tablero se esconden —
o estás en la lista o estás en un video, y así ninguna de las dos pantallas pide scroll.

**La curva del video es la de verdad.** `curvaSVG` inventa una forma a partir de la retención final
y el segundo de caída: sirve para comparar dos videos de un vistazo, no para mirar uno — salía un
pico vertical que no se parece a cómo cae la gente. `curvaReal(v, W, H)` dibuja **los puntos
medidos**, suavizados con Catmull-Rom a Bézier: pasa por los mismos puntos, solo redondea el camino
entre ellos.

El video abierto va **en dos columnas** (cifras y peldaños a un lado, curva al otro). En una sola
pedía 1308 px de alto; ahora son 894 y cabe en pantalla.

## El tablero ES la lista (22-sep-2026)

La lista de abajo repetía la columna «Publicados» del tablero. Se fue; a esas tarjetas les faltaba
solo la **miniatura**, que ahora llevan. **Tocar una tarjeta publicada** entra a las estadísticas de
ese video, igual que las de «Por grabar» entran a su ficha. La vista pasa de 855 px a **592**.

**«Ya lo publiqué» no se cree nada.** Marcaba el plan como publicado y se quedaba tan tranquilo —
pero un video publicado del que no hay ni el archivo ni las capturas no está midiendo nada, que es
justo lo que dice el texto de esa columna. Ahora abre el modal de subir el video y las capturas, y
el plan pasa a publicado **cuando el video existe** (`planPublicando`). Si se cancela, el plan se
queda donde estaba.

## Ninguna barra que solo repita dónde estás (22-sep-2026)

Al encoger la cabecera quedó una franja entera con un solo botón dentro. Sigue ocupando sitio para
no decir nada que no diga ya la barra de arriba. Así que **fuera del bento la cabecera desaparece
del todo**, no se encoge, y el «volver» se mete en la ruta: `‹ Inicio  ‹ Laboratorio`. El contenido
empieza 100 px más arriba.

**Y la tercera colisión de nombres del día:** `.ruta` era a la vez la navegación de la barra (flex)
y la línea de tiempo del recorrido de un video (grid). La segunda pisaba a la primera y los dos
botones salían apilados. El recorrido pasa a `.recorrido`, y `_colisiones.py` revisa ahora también
los `<style>` de las seis herramientas — antes solo miraba `css/styles.css`, que es por lo que esta
se le escapó.

## Un guardado que iba bien y avisaba de que iba mal (22-sep-2026)

`Prefer: return=minimal` hace que PostgREST conteste **204 sin cuerpo**, y `apiFetch` terminaba con
`res.json()`: parsear un cuerpo vacío lanza, así que un guardado **correcto** salía por el catch de
quien llamara. Se comprobó mirando la tabla — la fila estaba escrita, con el nombre, las dos marcas
y el video.

`apiFetch` trata ahora 204 y cuerpo vacío como `null`, que es lo que son. Aplica a toda la app, no
solo a esto.

**Y el aviso salía en un `alert()` del navegador**, que es justo lo que no se hace en Cherry. Va en
una tira propia (`.ch-tira`) con el diseño del producto. En `js/cuenta.js` no queda ningún `alert`.

## El aviso de abajo salía gris y con grano (22-sep-2026)

Dos cosas encadenadas, y la segunda es la que importa:

1. Llevaba la clase `vol`, la superficie de las tarjetas: degradado **más** una capa de grano en
   `mix-blend-mode: overlay`. En una pastilla pequeña eso no da volumen, da suciedad.
2. Y el div vivía **fuera de `.app`**. Los tokens del tema (`--fondo`, `--tinta`, `--tarjeta-a`…)
   se declaran en `.app`, no en `:root`, así que sus `var()` no resolvían y el fondo se quedaba
   transparente. **El grano sí resolvía**, porque `--grano` está en `:root` — de ahí el gris sucio:
   era grano encima de nada.

Es exactamente la trampa que ya estaba escrita en este archivo para el diálogo («DENTRO de .app, no
en el body: los colores del tema viven en .app»). El aviso se había quedado fuera. Ahora está
dentro y es una pastilla sólida: fondo claro, letra oscura, sin grano — como las de Storyboard y
Carruseles, que ya lo hacían bien.

# La ficha, un paso a la vez (22-sep-2026)

Antes: la ficha entera a la izquierda y los **nueve pasos apilados** a la derecha, cada uno con sus
dos campos. **2.140 px** de alto. Ahora **747**, y cabe en pantalla.

- **La ficha va en una línea** arriba —idea, estructura, gancho, formato, duración—, y se despliega
  solo para cambiarla. Es algo que se decide una vez y no se vuelve a tocar mientras escribes.
- **La tira de pasos**: rosa dónde estás, verde lo escrito, **ámbar los open loops**.
- **El paso en el que estás**, con sus dos campos, y al lado **la escena de su storyboard** — la
  misma viñeta de `bocetoSB`, no una copia. Grabas desde aquí o desde el Storyboard.
- **Las flechas ← →** cambian de paso. Dentro de un campo no (ahí mueven el cursor); con **Alt**
  sí. Al cambiar con el teclado **no se enfoca** el campo a propósito: si se enfocara, la siguiente
  flecha ya movería el cursor y te quedarías atascado en el paso siguiente. Con los botones sí se
  enfoca, porque vienes a escribir.
- **El tramo de segundos** de cada paso se reparte por pesos: el gancho pesa 0,6 y el CTA 0,8, no
  una novena parte cada uno.

## Los tres caminos de un paso

Una sola acción del servidor, `lab_paso`, con tres modos — los tres necesitan el mismo contexto:

| Modo | Qué hace |
|---|---|
| `auditar` | Lo miras tú y Cherry dice qué cambiar |
| `mejorar` | Cherry lo reescribe manteniendo lo que dices |
| `escribir` | Cherry lo escribe desde cero |

**El contexto es lo que hace que sirva.** Van la idea, la estructura, el paso, su tramo, y **los dos
pasos de antes y los dos de después**. Un paso suelto no se puede juzgar: «hay un número que no
estás mirando» es un open loop excelente en el paso 4 y una frase huérfana en el 9.

**Lo que se cuenta, se cuenta en código**: el largo del gancho a 2,6 palabras por segundo y la
frase de valla se detectan con reglas, y se le dicen al modelo como «ya detectado, no lo repitas».
Un modelo no cuenta palabras bien, y ese número manda.

---

## Las viñetas de IA — `sb-vineta` (23-sep-2026)

Dibuja las viñetas del storyboard con **Cloudflare Workers AI**, modelo `@cf/leonardo/lucid-origin`.

### Cinco estilos, uno solo escoge el usuario

`Animado`, `Semi-real` (el de por defecto), `Realista`, `Cómic`, `Plano`. Los cinco salen del
**mismo modelo**: lo que cambia es cómo se le pide. El catálogo lo sirve el propio servidor
(`modo: 'estilos'`) para que los nombres no vivan repetidos en el HTML.

### Las tiras de tres — idea de Sergio

⚠️ **Cloudflare cobra por píxeles, no por llamadas**: por cada baldosa de 512×512 que ocupe el
dibujo. De ahí todo lo demás.

| | baldosas | créditos | por viñeta |
|---|---|---|---|
| Una viñeta a 768×1344 (como se hacía antes) | 6 | 3.816 | 3.816 |
| Una viñeta a 256×448 | 1 | 636 | 636 |
| **Una tira de tres a 768×448** | 2 | 1.272 | **424** |

Un storyboard de nueve pasó de **34.344 créditos a 3.816** — lo que costaba UNA viñeta. De 8
storyboards gratis al mes a 78.

Dos razones más, aparte del precio:

- **La misma cara en las tres.** Se dibujan de una pasada, así que salen con el mismo pelo, la
  misma ropa y la misma luz. Pasarle una foto de referencia no lo conseguía (FLUX 2 la acepta y
  la ignora).
- **Tres y no nueve.** A partir de la cuarta o quinta escena estos modelos empiezan a mezclarlas
  entre sí. Y si una tira sale mal se repite esa: las otras seis no se mueven.

El tamaño es 256×448 por viñeta porque en la ficha se ve a **176 px de ancho**. 768×1344 era
cuatro veces más imagen de la que se alcanza a ver.

### El corte — `ve/js/vinetas.js`

La tira llega entera y la parte el navegador con un canvas, gratis.

⚠️ **Cortar por tercios no basta.** La primera versión lo hacía y dejaba un filo blanco en el
lado izquierdo de la segunda y la tercera viñeta: el tamaño lo pedimos nosotros, así que los
tercios caen bien, pero **la franja que separa los paneles la pinta el modelo del ancho que
quiere y hacia el lado que quiere**. Un margen fijo se queda corto o se come media cara.

Así que la franja **se busca**: alrededor de cada tercio se miran las columnas claras de arriba
abajo y se corta por fuera de ellas. Sin franja, se cae al tercio exacto con un margen pequeño.

Probado en `ve/_prueba-tira.html` con cuatro casos, comprobando los píxeles de los bordes:
franja fina corrida, franja gruesa, sin franja, y una pared blanca dentro de un panel (que **no**
es una franja).

### El tope — `deploy/08-vinetas-uso.sql` y `09-apuntar-varias.sql`

**45 viñetas al mes por CUENTA**, repartidas entre todas sus marcas.

⚠️ Se cuenta **en el servidor**, con la llave de servicio. Si lo contara el navegador, el
navegador podría borrar la cuenta — y cada dibujo es plata. Por eso va en tablas propias y no en
`herramientas_datos`, que la escribe el navegador.

- `vinetas_uso` — lo gastado por cuenta y mes. Solo lectura para el usuario.
- `vinetas_tope` — el tope de cada cuenta. **Sin fila valen las 45.** Ahí escribirán los planes
  cuando existan, para no tener que tocar el código.
- `vineta_apuntar(user, vinetas, creditos)` — suma en una sola sentencia, para que dos dibujos a
  la vez no se pisen. ⚠️ Lleva `grant execute to service_role` **a propósito**: quitárselo a
  PUBLIC se lo quita también al servidor, y sin eso el contador fallaría en silencio.

### Lo que hay que saber de Cloudflare

Los **10.000 créditos diarios** que regala son de la **cuenta de Cherry**, no de cada usuario, y
**no se acumulan**: lo que no se gasta hoy se pierde. Con el plan **Workers Paid** (US$5/mes) esos
10.000 siguen siendo gratis y lo que pase de ahí se cobra a US$0,011 por cada 1.000.

Un 429 con el plan pagado no debería salir nunca. Si sale, lo que falta es el plan.

### Cómo se le habla al dibujante (probado el 23-sep, una tira por hallazgo)

**Decirle QUÉ LLENA el cuadro, nunca qué falta.** `detalle` decía *«person out of frame or
cropped»* y salía el cuerpo entero: las negaciones se las salta. Con *«the object and a pair of
hands fill the whole panel»* sale bien a la primera.

**La frase que fuerza la consistencia iba en contra.** Decía *«el mismo personaje aparece en
TODOS los cuadros»*, o sea que obligaba a meter la cara justo donde el encuadre pedía un objeto.
Ahora va condicionada: *«en los cuadros que muestran a una persona es siempre el mismo
personaje… otros cuadros son primeros planos de un objeto»*.

⚠️ **El filtro de contenido de Cloudflare es ALEATORIO** (código 3030, error 400, sin dibujo).
Medido: el MISMO prompt, palabra por palabra, dio **PASA / NSFW / PASA** en tres intentos
seguidos, y troceándolo cada parte pasa por separado. Un prompt rechazado no gasta créditos, así
que el servidor **reintenta hasta 4 veces** y solo entonces se rinde.

Corrección de una conclusión anterior: llegué a escribir que lo disparaba nombrar partes del
cuerpo que no salen en el cuadro. Era falso — fue un rechazo suelto que coincidió con ese cambio.
El arreglo del encuadre `detalle` sigue siendo bueno por su cuenta (la imagen mejoró), pero no
tenía nada que ver con el filtro.

**Lo que sale variable:** `contrapicado` obedeció en una tirada y en otra salió casi frontal. No
es el texto, es el modelo. Si importa mucho, se repite la tira.

### El corte, segunda trampa

⚠️ **`img.decode()` puede no resolver NUNCA con la pestaña en segundo plano.** Dejaba el corte
colgado para siempre, sin error y sin nada que mirar — y es justo cuando va a pasar de verdad:
uno manda a dibujar y se va a otra pestaña. Ahora se corre con un plazo de 300 ms y se sigue;
`onload` ya garantiza que se puede dibujar.

### El marco que el modelo pinta igual

Aunque el prompt diga «no frame, no border», dibuja un recuadro por cuadro. Medido en la primera
tira: **arriba y abajo un margen BLANCO** (luz 254,8) y **a los lados una línea OSCURA**. Así que
«marco» no es claro ni oscuro, es las dos cosas, y la regla es *«esta línea no es dibujo»*.

Dos formas de buscarlo que NO sirven, las dos probadas:

- pararse en la primera línea que no es marco → el corte deja a veces un filo de dibujo por fuera
  de la línea oscura, y el marco se quedaba puesto;
- buscar la línea de marco más profunda → se comía 54 píxeles de un cielo claro.

Lo que sirve: recorrer desde el borde tolerando **2 líneas seguidas** sin marco, y ni una más.

### El selector de estilo, en el panel de la escena (23-sep-2026)

Una **tira de cinco miniaturas** con el nombre del elegido debajo, dentro del panel de la escena
—el estilo es del dibujo, y el dibujo está ahí—. Al lado, el botón de dibujar y cuántas viñetas
quedan.

**El estilo se guarda en la FICHA** (`f.estilo`), no en la marca: así un video puede ir en Cómic
y el siguiente en Realista. Las nueve viñetas de un mismo video salen iguales porque comparten
ficha.

Las miniaturas son archivos reales en `assets/estilos/*.jpg`, dibujados una vez con **la misma
escena para los cinco** — comparar estilos con escenas distintas es comparar escenas. Se rehacen
con `_muestras.py` si cambian los textos de estilo de `sb-vineta`.

⚠️ **Todo esto costó 85 píxeles de alto y devolvió el scroll a la ficha.** Medido: sin la tira
cabía justa en 900 px; con ella se iba a 985. De dónde salieron los 85:

| | |
|---|---|
| hueco entre bloques de la escena, 10 → 8 px | 12 px |
| vista previa, 176 → 134 px de ancho | 49 px |
| el saldo se pasó a la fila del botón | 22 px |
| el eco de «lo que se ve», a UNA línea | 18 px |

Dos trampas por el camino:

- El saldo llevaba `min-width: 78px` y el panel mide **194 px por dentro**, no 244: con el botón
  de 133 no cabían y se bajaba a otra línea, así que el apretujón no servía de nada.
- El eco de la descripción a dos líneas dejaba el panel en 444 px en cinco pasos y 462 en el que
  tenía el texto largo. A una línea mide **lo mismo siempre**, que además es mejor: la columna
  deja de dar saltos al cambiar de paso.

⚠️ `.esc-d` es hijo directo de un flex, así que **nada de `-webkit-line-clamp`**: un hijo directo
de flex se convierte en bloque y el clamp lo deja con altura cero. Ya pasó con la bio del perfil.

**Dónde viven las viñetas:** bucket privado `vinetas` (ver `10-vinetas-bucket.sql`), ruta
`<user_id>/<ficha>/<paso>-<sello>.jpg`. Privado porque llevan la cara de alguien dibujada a
partir de su foto; cada quien solo alcanza su carpeta. Una viñeta pesa ~28 KB. En la ficha queda
solo la ruta, y el navegador pide direcciones firmadas de golpe al arrancar.

**Banco de pruebas.** `herramientas/_cherry-falso.js` es un CherryApp de mentira con una ficha ya
escrita. La página se arma copiando la de verdad y cambiando el script:

```python
s = open('ve/herramientas/laboratorio.html', encoding='utf-8').read()
open('ve/herramientas/_lab-prueba.html', 'w', encoding='utf-8').write(
    s.replace('<script src="cherry.js?v=20260923d"></script>', '<script src="_cherry-falso.js"></script>', 1))
```

⚠️ La ficha abierta sale de **`D.planes`**, no de `D.fichas` — `planVivo()` mira ahí.

---

## Cherry escribe guiones (23-sep-2026)

Sergio rechazó lo que escribía Cherry con ejemplos concretos, y de comparar su guion aprobado
con los que rechazó salieron tres cambios.

### 1. Ejemplos completos, no más reglas

Dos días metiéndole reglas al prompt no movieron nada. **Un modelo imita mucho mejor de lo que
obedece.** Ahora van dos guiones enteros dentro del prompt (`EJEMPLOS` en `herramientas.ts`): el
que Sergio aprobó el 22-sep y el de la taquería de sus «Referencias Virales».

⚠️ Si se cambian esos ejemplos, se cambia lo que escribe Cherry. Pesan más que las reglas.

### 2. El guion ENTERO de una vez — `lab_escribir`

Escena por escena no funcionaba, y no era cuestión de afinar el prompt: **un giro no se puede
improvisar**. Para plantar algo en la escena 3 que se pague en la 5 hay que saber qué va a pasar
en la 5. De ahí salió el «Día 3» contra el «Día 1» que pilló Sergio — y el gancho SÍ iba en el
contexto.

⚠️ **El orden de las claves del JSON no es decorativo.** `momento` y `remate` van ANTES que
`escenas` porque el modelo escribe en ese orden, y el orden en que escribe es el orden en que
piensa. Si las escenas fueran primero, decidiría el remate cuando ya no le queda nada que
rematar.

Lo que escribió Sergio no se toca: si el gancho ya estaba escrito viaja como `pieGancho`, se
devuelve igual y **queda fuera del filtro**.

### 3. Un filtro en código — `revisarGuion()`

Lo que se puede comprobar con una regla no se le pide por favor al modelo. Cada uno de estos
fallos lo cometió Cherry de verdad:

| | |
|---|---|
| le habla al guion | *«espera, en el siguiente paso todo empieza a ordenarse»* |
| voseo | *«Empezás a notar las comandas»* |
| folleto | dijo «plataforma» mientras juraba que no la decía |
| frase de valla | la de siempre |
| sin anclas | un guion entero sin una hora ni un día: eso es una explicación |

Si falla, se le devuelve con los fallos delante y **una sola** pasada de corrección: si con eso
tampoco sale, insistir gasta el tiempo de Sergio. Probado en `_probar_filtro.mjs` contra los
seis casos, incluido el guion aprobado (que no debe dar quejas).

⚠️ El filtro **no corrige lo que escribió Sergio**. Su gancho dice «mi plataforma inteligente» y
«plataforma» está en la lista de folleto — con razón, lo es — pero la palabra es suya.

### El ritmo: 3,35 y no 2,6

Medido contra los diez guiones de «Referencias Virales»: **2.658 palabras en 793 segundos**.
Estaba en 2,6 y con eso cada guion salía un 23 % corto (en 50 s pedía 130 palabras cuando caben
168). Es **un solo número**, `PAL_POR_SEG`: antes había dos constantes y así es como una se
cambia y la otra no.

### «Pasos» pasaron a ser «escenas»

No es cosmético: «paso» suena a procedimiento, y describir un procedimiento en vez de contar una
escena es justo el error que cometía Cherry. La palabra tira del modelo.

⚠️ **«escena» ya estaba cogido**: así se llamaba el panel del dibujo. Antes de renombrar nada se
liberó el nombre — el panel pasó a `.vineta` / `.vin-*`. Dos cosas con el mismo nombre es el
fallo que ya costó tres ratos esta semana.

Lo que NO se renombró, a propósito: `d.mapa.pasos` y la clase `.paso` del mapa del desmontaje.
Eso viene del servidor (`lab_desmontar`) y es el desmontaje de un video de OTRO, no la ficha.

⚠️ **Lo guardado se convierte al entrar** (`aEscenas` y `estructuraAEscenas`, dentro de
`normaliza`). Sin eso las fichas que ya existen se abren vacías. Se deja puesto para siempre:
puede haber una copia vieja en un navegador que no se abre en meses.

⚠️ **Trampa del renombrado:** `b.dataset.paso` se quedó atrás cuando el atributo pasó a
`data-escena`. `Number(undefined)` da NaN y salía «escena NaN de 6» sin lanzar ningún error. Lo
pilló la prueba en el navegador, no el revisor de sintaxis.

### El objetivo del video

Lo pidió Sergio: *«dame un objetivo por video para que sea más fácil»*. Y es verdad: el guion del
día 1 salió porque el objetivo estaba claro desde el principio. Va en la ficha (`f.objetivo`),
el primero del panel plegable y de ancho completo, y el botón de abrir lo nombra — lo que no se
nombra no se llena.

### La espina: el momento y el remate

Viven en la ficha (`f.momento`, `f.remate`), no en un aviso. Los había metido en la caja de la
auditoría y **desaparecían al repintar** — o sea al cambiar de escena. Y no son un aviso: si el
momento y el remate están flojos, el guion va a estar flojo por mucho que se retoquen frases.

Costaban 43 px y devolvían el scroll. Se pagaron quitando `.pista-pie`, que decía cosas ciertas
pero generales; el atajo de las flechas se mudó a la misma línea. Y el séptimo botón del pie lo
mandaba a dos filas, así que las etiquetas se acortaron. Medido: **0 px de scroll en las seis
escenas**.

### Las cinco del primer guion de verdad (23-sep-2026)

Cherry escribió su primer guion completo y salió con cinco problemas. Cada uno dejó una regla:

**1. Copió el ejemplo.** «Ya no, gracias» era el remate de MI guion, literal; «son las seis» era
mi «son las siete»; «dices ya le contesto» era mi frase. El ejemplo le enseñó **qué** escribir
en vez de **cómo**. ⚠️ Ahora los ejemplos llevan encima, con todas las letras, que son de OTROS
videos y que copiar su momento o su remate está mal.

**2. Nombró la estructura.** *«Hoy te muestro la cadena que te hace perder pedidos.»* «La
cadena» es el nombre de la estructura que escogió Sergio, no algo que el espectador conozca.
Dos comprobaciones: una lista fija (gancho, conector, open loop, CTA…) y el **nombre de la
estructura de esa ficha**, que llega como parámetro. ⚠️ «oferta» se sacó de la lista: un
restaurante hace ofertas de verdad y prohibirla sería corregirle al usuario su oficio.

**3. El remate no se pagaba.** Decidió «Ya no, gracias» y no lo dijo en ninguna escena: lo dejó
en el «se ve» del CTA, después del «Sígueme». Eso es una posdata. `remateSinPagar()` comprueba
que el remate esté en lo que se DICE de alguna escena (literal o el 70 % de sus palabras).

**4. La misma lista al derecho y al revés.** Escena 5: «no llega la comanda, las mesas esperan,
la caja no cierra, el domiciliario sin ruta». Escena 7: las mismas cuatro, bien. `repetidas()`
compara los sustantivos de cada par de escenas. ⚠️ El umbral está en **un tercio**, no en la
mitad: con la mitad no saltaba el caso real (compartían 4 de 10).

**5. Los reparos se borraban.** El filtro SÍ cazó lo de «plataforma» y se lo dijo a Cherry — que
lo ignoró — pero el aviso vivía en `#fic-aud-r`, que `pintarFicha` repinta con cada tecla.
Sergio nunca llegó a leerlos, y eran cuatro. Ahora viven en la ficha (`f.quejas`) y se van
cuando él los da por vistos. **Es el tercer sitio donde cometo el mismo error**: poner algo
duradero en un recuadro que se repinta.

Probado en `_probar_cinco.mjs` contra el guion que escribió Cherry (las cinco saltan) y contra
el que aprobó Sergio (limpio).

⚠️ Con las piezas de verdad, la línea de la ficha se iba a dos filas y devolvía el scroll: las
pastillas pasaron de 280 a 178 px de ancho. Medido con los datos reales de la cuenta: **0 px de
scroll en las nueve escenas**.

### La segunda tanda de críticas de Sergio (23-sep-2026)

**⚠️ La primera fue deshacer una regla mía.** Había puesto «si no hay una hora concreta, queja»,
y con eso convertí en obligación un recurso que usé **una vez en un guion**. Cherry empezó a
meter un reloj a la fuerza en todos. Palabras suyas: *«poner la hora en TODOS LOS GUIONES es
algo súper extraño y antinatural»*. Generalizar desde un solo ejemplo es como se hacen las
reglas malas. Ahora la comprobación es que el guion nombre **cosas que se puedan filmar** — un
teléfono, una comanda, una caja — y una hora es solo una de las maneras.

Las otras cuatro, con su forma detectable:

| Crítica | Cómo se caza |
|---|---|
| el gancho de 8,4 s | palabras ÷ ritmo > 3,2 s. No se comprobaba al escribir el guion entero, solo al reescribir una escena suelta |
| «cada pregunta hace fila» | sustantivo **sin cuerpo** (pregunta, tiempo, plata, cadena) seguido de verbo **de cuerpo** (camina, hace fila, se enfría). Misma forma que «el papel camina hasta la cocina» |
| los open loops que no aplazan | acaba en `?`, o no tiene ninguna marca de aplazamiento («el último», «lo de», «cuando», «a las») |
| «señalando el logo del perfil» | se mira el **«se ve»**, no solo lo que se dice. Regla de Sergio: en redes nunca logos |

Y de propina, los huecos sin rellenar: «Día X», `[nombre]`, «XX».

⚠️ **Tres veces me mordió lo mismo escribiendo estos regex:**

- **`\b` dentro de una plantilla `` ` `` de JavaScript NO es un límite de palabra**: es el
  carácter de retroceso. `CONCRETO` quedó buscando un retroceso seguido de «whatsapp» y no
  casaba nada, así que la queja salía en todos los guiones, incluido el bueno.
- **Un literal `/…/` no puede ocupar varias líneas.** Partirlo para que se lea bonito no compila.
- **Escribir barras invertidas desde Python a un archivo JS** falló dos veces con anclas que no
  encontraban su texto. Se arreglan escribiendo la línea entera con `chr(92)` y armando el regex
  con `new RegExp` y cadenas normales, no con plantillas.

Probado en `_probar_filtros2.mjs`: ocho reparos en el guion de los comprobantes y **cero** en el
que aprobó Sergio.

---

## El contexto completo (23-sep-2026)

Sergio, después de leer el primer guion de verdad: *«primero necesita un contexto completo»*. Y
lo genérico es medible — sobre sus once referencias:

| | palabras | números | nombres propios |
|---|---|---|---|
| sus 10 referencias (media) | 266 | **4,0** | **6,9** |
| el guion que aprobó | 164 | 2 | 2 |
| el de los comprobantes | 163 | **0** | **0** |

Ocho de diez sueltan un número y nueve nombran cosas propias: «la carne, las tortillas, el
empaque y el taquero», «7546 veces», «Jordan Belfort». Cherry no tenía ninguno **porque no
tenía nada concreto que contar**.

### La identidad es POR MARCA

⚠️ Era un fallo de origen: `marca` se guardaba como **un documento por usuario**, así que el
tono y las frases de El Parche se aplicaban también a Cobra. Palabras de Sergio: *«si se llama
identidad DE MARCA debe ser una por marca… no es lo mismo planear mis videos en mi marca de
marketing que en mi marca de Cobra»*.

Ahora el documento es `{ porMarca: { <id>: {...} } }` y `CherryApp.marca()` devuelve la de la
marca activa, para que quien la pida no se entere. Se comprobó antes de tocar nada: **no existía
ninguna fila de `marca`**, así que no había nada que migrar; la conversión se deja puesta por si
hay una copia vieja en algún navegador.

⚠️ De dónde sale la marca activa: vive dentro del documento de `laboratorio`, que es donde la
puso `cuenta.js`. Por eso `cherry.js` lo lee. Acoplamiento feo y anotado.

⚠️ Al cambiar de marca **dentro** del Laboratorio no se recarga la página, así que hay que
soltar la identidad cacheada (`olvidarMarca()`). Sin eso se escribe con el tono de la anterior.

### «Tu negocio», dentro de la identidad

Cinco campos: **de dónde eres** (el tú o el usted y las palabras de ahí), **de qué va el
negocio**, **cómo se llama tu producto** (para que diga «Cobra» y no «mi plataforma»), **las
palabras del oficio** y **números que puede soltar**.

### El tipo de video

Un tipo se define por lo que **NO** hace: un educativo que vende ya no es educativo, un
motivacional que explica pasos es un tutorial con música. Cada uno trae su lista de
prohibiciones y se comprueban.

⚠️ **La oferta y el CTA quedan fuera de la prohibición de vender**: todo guion acaba pidiendo
algo y eso no lo convierte en un anuncio.

⚠️ **Prohibir palabras de oficio es corregirle al usuario su trabajo.** «Precio», «promoción» y
«descuento» son de un restaurante de toda la vida; lo que delata una venta es el imperativo —
«cómpralo», «link en la bio». Lo mismo pasó antes con «oferta».

### El tipo de escena

**Visual** — manda el plano y la boca se calla: la casilla de «lo que dices» no sale. **Hablada**
— las dos casillas. El gancho visual nace visual; las demás nacen habladas y Sergio cambia la
que quiera. Además el servidor **vacía** el `dice` de una escena visual aunque el modelo escriba
algo: en el primer guion metió 16 palabras en el «gancho visual».

### Cinco trampas de este día

- **`TIPOS` ya existía** — son los tipos de plano del boceto. Le puse el mismo nombre a los
  tipos de video. **Quinta colisión de nombres de la semana**; ahora es `TIPOS_VIDEO`.
- **`x` no existe en `atarFicha`** — es una variable local de `pintarFicha`. La escena se coge
  de `f.guion[escenaAbierta]`. Mismo fallo que el de `e` contra `esc`.
- **Cuatro restos del renombrado** de «paso» a «escena» creaban escenas con la clave vieja. No
  reventaba nada porque el servidor lee las dos formas, y por eso mismo habría durado meses.
- ⚠️ **`_revisar.py` tenía la ruta CLAVADA** y se comía el argumento: le pasabas `marca.html` y
  te revisaba `laboratorio.html`, siempre con su «todo cuadra». Una herramienta que siempre
  aprueba es peor que ninguna. Ya acepta el archivo.
- ⚠️ **`_colisiones.py` no bajaba de nivel** salvo que el `}` cayera justo donde miraba, así que
  a partir de la primera regla daba todo por anidado y no cazaba nada. Por eso `.vineta` pasó.

---

## 23-sep · Los videos son de Instagram, y el storyboard se dibuja entero

### Dos listas de videos, y la diferencia importa

`normaliza()` nunca pasaba por `igEnDoc`, así que la ficha seguía enseñando lo escrito a mano:
**244 visitas cuando Instagram decía 258**. La capa estaba hecha y funcionando —por eso la foto
de perfil y el aro sí salían de verdad— pero solo la usaban las cuentas, no los videos.

- **`D.videos`** es lo GUARDADO, y es lo que `guardar()` sube a la cuenta.
- **`videosVista()`** es lo que se ENSEÑA: las publicaciones de Instagram con lo de Cherry
  encima — el guion, las piezas, el desmontaje y la curva de la captura.

⚠️ **Mezclarlo dentro de `D` era más corto y estaba mal.** `guardar()` sube `D` entero, así que
las vistas y la retención de Instagram acabarían escritas en el documento, y al día siguiente no
se sabría cuáles son de verdad y cuáles una copia vieja de hace una semana.

⚠️ **Un video mezclado lleva el `id` de la PUBLICACIÓN** (`ig:123…`) y el de Cherry pasa a
`idCherry`. Las cuatro búsquedas por id miraban solo `id` y no habrían encontrado nada en cuanto
el video se atara: van todas por `videoPorId()`, que mira los dos.

### El lado derecho de la tarjeta

Estaba vacío bajo la curva. Se le enseñaron cuatro maquetas y escogió **la mezcla A + B + D**:

1. **Qué pasó** — una frase contra el video anterior.
2. **Contra los tuyos** — cada número frente a la mediana; medio riel *es* la mediana.
3. **Lo que añade Instagram** — alcance, me gusta, guardados, compartidos, comentarios y vistas
   por persona.

⚠️ **Las visitas no encabezan aunque se muevan más.** Con sus dos primeros videos las visitas
subían un 86 % y la omisión caía un 49 %, y la frase grande decía «lo vio más gente», que es lo
de menos. Cuánta gente te llega lo decide el algoritmo; cuánta se queda lo decide el video.

⚠️ **Ningún bloque se pinta sin con qué compararlo.** Un «+0 %» contra nada es mentira, y con
estos números decide qué grabar.

### El botón de dibujar no estaba roto: el modelo estaba caído

`@cf/leonardo/lucid-origin` respondía **500 con `code: 4009`** a todo. Medido desde dentro de la
función —los secretos de Supabase solo se leen como hash, así que desde fuera no se puede
probar— a seis tamaños distintos y sin tamaño: **todos 500**. No era el tamaño, ni el prompt, ni
el tope. Y el reintento que había solo cubría el rechazo por contenido (3030), así que un 500 se
caía a la primera.

Ahora es una **cadena de modelos**. `lucid-origin` sigue el primero a propósito —es con el que
Sergio juzgó la calidad— y detrás va `phoenix-1.0`.

⚠️ **Los dos devuelven la imagen de forma distinta**: lucid-origin en JSON con base64 dentro de
`result.image`, phoenix los bytes del JPEG tal cual. Leer `result.image` de una respuesta binaria
da vacío, y el error que salía —«Cloudflare no devolvió ninguna imagen»— no dice dónde mirar.

### Dibujar el guion entero

Sergio: «aparte del botón de dibujar esa escena debe aparecer un botón para dibujar todo el
guion, así el usuario toma la decisión de si hacerlo 1 por 1 o hacerlo todo».

⚠️ **De tres en tres**, porque Cloudflare cobra por PÍXELES: tres viñetas en una imagen cuestan
1.272 créditos y tres imágenes sueltas 1.908.

⚠️ **Cada tanda se guarda en cuanto llega.** Si la cuarta falla —el tope del mes, Cloudflare
caído— las tres primeras ya están puestas: no se pierde ni lo dibujado ni lo que costó.

---

## 23-sep (tarde) · El storyboard dibujaba a cualquiera

Sergio: «el storyboard peeesimooooooo. Debería tener mis rasgos, el personaje debería ser como
yo, aparte de eso se está tomando una chica y poniendo cualquier cosa. Hay unas escenas que le
estoy diciendo que el cuerpo completo y aparece sólo las manos».

Tres quejas, tres causas distintas.

### La chica: `rasgos` estaba vacío y nadie lo llenaba

El modo `rasgos` de `sb-vineta` —Gemini mira una foto y describe a la persona— existe desde el
primer día. **El navegador no lo llamaba nunca.** Así que el prompt iba sin descripción del
personaje y el modelo se inventaba a quien quería.

⚠️ **La foto de la MARCA no sirve**, comprobado mirando las dos: la de sergiosaac.co es su cara,
la de cobrapos.co es el logo de Cobra. El avatar es de la marca; quién sale en cámara es otra
cosa. Por eso `personaFoto` aparte, **una por marca** (lo escogió él).

⚠️ **Sin rasgos no se dibuja.** Dibujar a un desconocido gasta una viñeta de su tope y sale mal:
es exactamente lo que pasó.

### Las manos: cuerpo entero no existía

Su escena decía «pantalla» y la regla de palabras clave la mandaba a `dividida`. Y además
**`entero` no estaba en `ENCUADRES`**: pedía algo que no había, así que caía en `medio` (de
cintura para arriba) o en `detalle` (macro de manos). Ahora están `entero` y `ambiente`.

### El prompt: iba su frase en español, tal cual

Tenía razón y era literal. Ahora pasa por **el guionista de imagen** (Gemini), que la traduce a
la frase inglesa que el dibujante entiende y **escoge el encuadre leyendo lo que él pidió**, no
buscando palabras sueltas. Medido con sus escenas: «Plano de cuerpo completo…» pasó de `detalle`
a `entero`, y «caminando por la salsa» lo entendió como *the dining room*.

⚠️ Si Gemini falla, se dibuja igual con el texto tal cual. Un mejorador caído no puede dejar sin
dibujar: sería cambiar un storyboard feo por ninguno.

### Las tiras de tres se retiran

Medido dibujando y mirando el resultado:

| lo que se pidió | lo que hizo |
|---|---|
| 3 cuadros en una fila | **4** — partió el tercero en dos |
| + «cada cuadro de borde a borde» | **5** — uno alto y una reja de 2×2 |
| 1 cuadro | limpio |

`cortar()` busca las franjas **verticales**, así que una tira partida en horizontal mete dos
escenas dentro de la misma viñeta. Por eso `TANDA_VINETAS = 1`.

Cuesta un 50 % más a Cherry (636 créditos por viñeta en vez de 424; un storyboard de 9 pasa de
~170 a ~250 pesos). **El tope de Sergio no cambia**: se cuenta en viñetas, no en créditos.

La tira se inventó por el precio y porque las tres salían con la misma cara de una pasada. Lo
segundo ya no hace falta: los rasgos van escritos en el prompt. El servidor sigue sabiendo
dibujar tiras; si algún día sale un modelo que respete la reja, se sube ese número.

### Desplegar una función: el cuerpo va por archivo

⚠️ `curl -d "$BODY"` **falla en Windows** cuando el `.ts` pasa de unos 32 KB, y el error —«el
nombre del archivo o la extensión es demasiado largo»— no se parece en nada a la causa. Va con
`--data-binary @archivo`.

### POV, y que no se pierda lo que él nombra

Sergio: «sigue sin darme lo que estoy describiendo. Le dije que estoy sentado en el computador y
no se ve ni el computador ni la mesa. Y las escenas POV no las entiende: en un POV no se ve el
personaje, solo las manos».

- **`pov` no existía.** Escribía «POV» y el guionista lo trataba como una escena normal.
- **El guionista resumía.** Su frase pasaba a una frase inglesa bonita y por el camino se perdían
  el computador y la mesa. Ahora la regla es explícita: lo que él nombra, sale.

⚠️ **En POV los rasgos NO van.** El prompt empieza por «A character with \<pelo rizado, barba
cerrada, cara ovalada…\>», que es lo que hace que el personaje se le parezca — y es justo lo que
no puede ir donde su cara no sale. **Probado dibujando**: con los rasgos delante el modelo lee
todas esas palabras de cara y pinta una cara mirando al frente, aunque el encuadre diga primera
persona. Sin ellos, salen las manos y lo que tienen delante.

⚠️ **Al describir un encuadre nunca se enumeran las partes del cuerpo que quedan fuera.**
Cloudflare rechaza el prompt entero por NSFW (3030). Se dice lo que SÍ se ve.

### Sin guionista no se dibuja

Antes, si Gemini no contestaba, se seguía con el texto en español tal cual. Sonaba prudente y era
al revés: ese dibujo sin traducir es el problema del que veníamos, y sale de su tope de 45. Ahora
son **dos vueltas de tres modelos** y, si no hay manera, se para con un aviso — sin gastar viñeta.

### La viñeta era casi cuadrada

`.vin-v` estaba en `aspect-ratio: 128/152` porque ese era el tamaño del boceto dibujado a mano de
antes. El dibujo de verdad es 256×448 y salía aplastado. Ahora **9/16**, la misma que
`.sb-c .foto` del montaje.

### La ficha, más corta

Sergio: «todos los botones deben ir más arriba, justo debajo del cuadro donde escribo, no tan
abajo porque hay espacio desperdiciado. El módulo del storyboard lo hacemos más corto: quitamos
todos los botones, solo dejamos la foto de nosotros y el estilo. Y auditar no debería ser el más
importante; el más importante es uno que haga el siguiente paso».

- **El pie sube.** `.fic-pie` estaba **fuera** de la rejilla de dos columnas, así que caía por
  debajo del panel de la derecha —que es más alto— y dejaba ese hueco. Ahora va dentro de
  `.fic-izq`, pegado al cuadro de escribir.
- **El panel se queda en lo suyo**: el dibujo, lo que se ve, el estilo y quién sale.
  ⚠️ De paso salió un duplicado: `pu-sb` («Abrir el storyboard») y `fic-sb` («Cómo grabarlo»)
  llamaban los dos a `verStoryboard`.
- **El principal es `fic-crear`**, que dibuja lo que falte y abre el storyboard. Dice «Crear» o
  «Ver» según lo que vaya a hacer, para no gastar viñetas por sorpresa.

⚠️ **`verStoryboard` no enseñaba las viñetas.** Pintaba `bocetoSB()` —monigotes SVG dibujados a
mano— y el único sitio donde se veía un dibujo era el panel de la ficha, de una en una. Ahora la
tarjeta enseña `x.vineta` cuando existe y el boceto cuando no.

⚠️ **Y quitar los botones dejaba una viñeta fea sin forma de repetirla.** `dibujarEscena` se
quedaba sin quien la llamara. Ahora recibe **cuál** escena y **qué** botón, y la llama el
storyboard, que es donde se ven las nueve juntas y se nota cuál salió mal.

### Enseñar una pantalla sin la sesión de Sergio

Para que viera esto antes de publicarlo hice una maqueta con el `<style>` del laboratorio tal
cual. Salió **negro sobre negro**: ⚠️ la paleta entera y `color: var(--tinta)` cuelgan de `.app`,
no de `:root`. Sin ese envoltorio los tokens quedan sin definir.

## «Ya lo grabé» y varios guiones a la vez (24-sep-2026)

Sergio: **«toqué el botón que dice ya lo grabé y no se pasó al otro lado»** y **«incluso si tengo un guion pendiente que no lo he grabado debería dejarme hacer otro guion nuevo»**.

- ⚠️ **«Ya lo grabé» sí guardaba**, pero solo repintaba la ficha: el tablero de «Mis videos» seguía con lo de antes hasta recargar. Ahora repinta todo con `pintar()`, como el aviso «¿ya lo grabaste?», y la ficha se queda en ese guion con el botón en «Grabado ✓». Además `ver('v5')` repinta el tablero cada vez que se entra.
- ⚠️ **«Otra ficha» daba por GRABADO el guion abierto** para poder empezar otro. Ahora se llama «Nuevo guion», crea uno y el anterior se queda en «Por grabar». El tablero trae «＋ Nuevo guion» en esa columna.
- «Armar la ficha del próximo video», desde el experimento, ya no reabre cualquier guion pendiente. Reabre el que salió de esa misma orden si sigue sin grabar; si no, crea uno nuevo.
- Con varios guiones sin grabar, la tarjeta de la ficha en el inicio abre el más nuevo. Los demás se abren tocándolos en «Por grabar».

## «Ver el storyboard» no hacía nada, y las viñetas se rompían a la hora (24-sep-2026)

Sergio, para grabar la pantalla del storyboard en su video: **«al tocar ver storyboard no pasa nada»**.

- ⚠️ **`crearStoryboard()` llamaba a `guardaEscena()`, que vive DENTRO de `atarFicha()`.** Desde el 23-sep (dcfd3ed) el botón moría con `guardaEscena is not defined`, sin nada a la vista: fallaban «Crear el storyboard» y «Ver el storyboard». Ahora la escena se guarda en el clic, dentro de `atarFicha`. Revisado: ninguna otra función de afuera usa las de adentro.
- ⚠️ **Las viñetas se firmaban por una hora y se recordaban para siempre.** Con la pestaña abierta más de una hora salían rotas (Sergio vio la de «La escena» con el texto alternativo). `js/vinetas.js` firma ahora por 12 h, sabe cuándo vence cada firma, la renueva sola cada 5 min si le queda menos de media hora, y si una imagen falla igual la vuelve a firmar y le cambia la dirección en su sitio, sin repintar (una vez por minuto como mucho).


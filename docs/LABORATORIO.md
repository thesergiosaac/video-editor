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

## Cuentas

Cada cuenta lleva **su propio embudo**: el mismo gancho puede retener en soysergiosaac y no en
Cobra. Las fichas del baúl se guardan una sola vez (una idea buena sirve en cualquier parte) pero
**su marcador se calcula por cuenta**.

## Dónde vive cada cosa

- **Página**: `herramientas/laboratorio.html`
- **Tarjeta del bento**: `js/components/inicio.js` (`const lab = tarjeta('ci-lab', …)`) y
  `css/styles.css` (`.ci-lab`, `.ci-curva`)
- **Servidor**: acciones `lab_desmontar` y `lab_auditar` en la función `herramientas`
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

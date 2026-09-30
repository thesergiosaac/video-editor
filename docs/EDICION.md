# La capa de edición

*30-sep-2026*

Sergio: **«necesito que el video lo dejes en Cherry con todos los gráficos, pero que yo pueda colorizar solamente el video
sin que se coloricen los gráficos… y cambiarle la plantilla de subtítulos… que se mantengan los sonidos, los gráficos,
todo, y yo desde Cherry poder terminarlo»**.

Y el plan de ahora en adelante: **cada video nuevo que grabe se lo pasa a Claude, que le hace gráficos nuevos según lo que
dice. Si se parecen a una familia que ya existe, entran a esa familia; si son de un estilo nuevo, arman una familia nueva.
Así se llena la biblioteca poco a poco.**

---

## Qué es

Un proyecto puede traer una **edición hecha a mano**: capas de Remotion ya dibujadas (WebM con transparencia) con sus
tiempos en el reloj del video. Viven en el bucket (`ediciones/<proyecto>/<versión>/*.webm`) y se anotan en la tabla
`ediciones` (migración `servidor/base/23-ediciones.sql`).

El ensamblador (`edicion.js`, v19) las monta **después del color y del movimiento y antes de los subtítulos**. Por eso:

- el color que escoja la persona **solo toca su video**: los gráficos no se tiñen;
- la plantilla de subtítulos se cambia como siempre (los subtítulos se corren solos en las ventanas de la edición);
- la voz de estudio y los efectos de sonido siguen siendo los del proyecto (los de la edición van en
  `subtitle_config.sonidos`, así que se ven y se editan en el Guion).

## Las tres formas de capa

| forma | qué hace |
|---|---|
| `capa` | va encima del video |
| `dividida` | va encima y, mientras dura, el video se encoge a su tarjeta (`MUEVE.dividida` de `graficos.js`: 1008 × 904 px con la cara adentro, curva inOutPow 3, 0,5 s entrando y saliendo). La capa trae el panel con el **hueco** justo ahí |
| `profundo` | va detrás de la persona: sobre el fondo, y la persona (su silueta, `silueta_key`) queda delante |

## Lo demás que manda la edición

- **Cámara quieta** donde hay pantalla dividida o algo detrás de la persona (la silueta se calculó sobre el video quieto),
  más las ventanas de `quieto`.
- **Subtítulos** por ventanas (`subtitulos`): `tarjeta` (dentro de la tarjeta del video, abajo), `abajo` (los que
  estaban arriba, donde van los gráficos, bajan a 66–78 %) y `oculto` (se callan, p. ej. cuando las palabras salen como
  fichas).
- Con una edición **no van** los gráficos de la IA, las pantallas ni las escenas de apoyo.
- Si los **cortes** del video cambiaron (`cortes` guarda los de la edición: clip, inicio y fin), la edición NO se usa y
  el log lo dice: los gráficos quedarían corridos.

## Cómo se arma una edición

1. El video se edita en Remotion (`Downloads\Cherry Taller\remotion\src\p25\`, composición `P25`): tu video, el color y la
   cámara de Cherry, los subtítulos portados y los gráficos palabra por palabra.
2. La composición `P25Capa` saca las capas sin tu video: `parte: 'encima'` y `parte: 'detras'`, en VP9 con transparencia,
   por tramos (`--frames`), a 1080 × 1920.
3. Las capas suben al bucket y la edición se anota en `ediciones`.

La receta paso a paso está en `Downloads\Cherry Contenido\P25-editado\LEEME.md`.

## El color, de paso (30-sep)

- **Proyecto nuevo = color en cero.** Al abrir un proyecto sin video, el color del proyecto anterior se quedaba puesto
  (el Proyecto 25 nuevo heredó las zonas del fondo del viejo sin que Sergio tocara nada). `cambiarProyecto` ahora lo deja
  en cero (`C.colorDesdeCfg(null)`).
- **El video sale como se grabó.** El revelado viene **apagado** de entrada y se manda `{ revelado: false }`: el servidor
  no iguala las tomas. Se prende a propósito en Edición → Look.
- Con el revelado apagado, la **firma de los cortes** lleva `crudo: 1`: una base igualada (con la corrección de cada toma
  adentro) ya no se reutiliza.

## Silueta en alta para lo que va detrás (30-sep)
La silueta de Cherry (`sin_subtitulos_silueta2.mp4`, 608×1080) deja un halo del fondo alrededor del pelo y un borde duro
arriba de la cabeza. Para una edición hecha en el taller se sube la SUYA en `silueta_key`: los recortes cuadro a cuadro de
Remotion (`public/<video>/persona_crudo/NNNN.png`, alfa a 1080×1920) armados como video gris desde el cuadro 0 (negro fuera
de sus cuadros), con el alfa **compensado** `v = 90 + a·80/255` (0 si a<2), porque el armador hace `(v−90)·255/80` y así
recupera el borde suave de los rizos. H.264 crf 8, 30 cuadros. P25: `ediciones/5240cf27…/silueta_hd_v1.mp4`.
Comprobar antes que el recorte N calce con el cuadro N de la base (diferencia mínima en N).

## Subtítulos «abajo» (30-sep, noche)
`moverSubtitulos` ya NO encoge las frases en la ventana `abajo`: las baja enteras, a su tamaño, con el borde de arriba al
64 % del alto. Solo mueve las que siguen arriba (borde de arriba < 33 %): si la persona movió un título con «Mover título»,
se respeta. Cuenta también la que empieza hasta 0,6 s antes de la ventana (las frases de impacto ahora entran antes).
Ensamblador desplegado con este `edicion.js` (sha APW6EUFm…; respaldo `deploy/carrete-assembler-respaldo-20260930-VcTTOC.zip`).

## Títulos en la pantalla dividida (30-sep, noche)
En la ventana `tarjeta`, las frases que van ARRIBA (borde de arriba < 45 %: los títulos de impacto) ya no se meten en la
franja de abajo: viajan con el video (mismo encogido y corrimiento que `MUEVE.dividida`: s 0,935, ox 35,1, oy 671,45) y
quedan sobre la cabeza dentro de la tarjeta; si caen en la parte que tapa el panel, bajan al borde de la tarjeta (980 px
+ 1,2 %). Así «Mover título» sirve también ahí. Los subtítulos normales siguen en la franja de abajo. Ensamblador sha
0wXYIHbL…; respaldo `deploy/carrete-assembler-respaldo-20260930-APW6EU.zip`.

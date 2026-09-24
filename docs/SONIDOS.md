# Los efectos de sonido desde el Guion

*24-sep-2026*

Sergio: **«donde editamos desde el guion, aparte de escena, gráfico o pantalla, también añadir sonido: ahí colocas la librería de sonidos para que en una parte específica podamos colocar ese sonido»**. Y: **«ayúdame a pensar cómo colocarlo en el momento exacto: una línea es larga pero el sonido es corto, un whoosh»**.

⚠️ **Hasta este día la tarjeta «Sonido» era solo de muestra.** Su «librería de SFX» era una lista de nombres sin archivos (`D.sfxNames`), y el ensamblador no mezclaba ni música ni efectos: el selector de música tampoco hace nada todavía.

---

## La librería

- **100 efectos de VideoEditingSFX** (videoeditingsfx.com), licencia **CC0**: uso comercial libre, sin crédito. Sergio autorizó descargarlos el 24-sep.
- 8 categorías: Whooshes y transiciones (26), Clics y avisos (19), Cámara (12), Impactos (11), Reversos (11), Subidas (9), Cinemáticos (7), Risers (5).
- Todos con el pico a −3 dBFS, 44,1 kHz estéreo, MP3 160k. Los que duran más de 8 s después de su golpe se cortan con medio segundo de salida (5 de 100).
- Viven **públicos** en el bucket: `sonidos/<cat>/<id>.mp3`. Catálogo: `js/sonidos.js` (el mismo archivo sirve en la página y en node).

## Dónde cae: el GOLPE, no el principio

Cada efecto tiene medido su **golpe**: el segundo en que suena más fuerte (ventanas de 50 ms). La persona toca la PALABRA; Cherry hace caer ahí el golpe, no el principio del archivo.

| categoría | dónde está su golpe (mediana) | qué pasa |
|---|---|---|
| Impactos, clics | al 10 % | pega en la palabra |
| Whooshes | al 35 % | pasa justo sobre la palabra |
| Risers | al 62 % | sube y revienta en ella |
| Subidas, reversos | al ~90 % | arrancan antes y terminan en la palabra |

Además, «− 0,1 s / + 0,1 s» lo corre una décima (hasta ±2 s). Queda atado al número de palabra: si cambian los cortes, se mueve con la frase.

## La cadena

| pieza | qué hace |
|---|---|
| `js/sonidos-guion.js` | «Sonido» en cada línea, su marca y su panel: las palabras de la línea para escoger dónde cae, categoría, lista con ▶ para escuchar, volumen (0–150 %), ajuste fino, «Quitar sonido». El nuevo sale de la categoría del último usado |
| `js/state.js` | `sonidos` en el estado; `C.sonidosCfg()` viaja con generar, el camino rápido y exportar |
| `js/adelantado.js` | los sonidos cuentan en la firma: cambiarlos rehace el video solo |
| `servidor/orchestrate.ts` (v236) | `limpiarSonidosSrv` (solo archivos de `sonidos/`) y `ponerPantallas` los deja en `subtitle_config.sonidos` |
| ensamblador (v15) | ubica cada golpe con el reloj de los subtítulos y los mezcla en el video final (y en el de Instagram si ya salió) |

⚠️ **El ffmpeg de la Lambda es de 2018: su `amix` no tiene `normalize`** y bajaría la voz a la mitad. Se suma con `amerge` + `pan` (suma exacta) y `alimiter`.

⚠️ **`alimiter` trae el nivelado automático encendido** (`level`): subía TODO el audio 1/0,95 = +5,2 %. Va con `level=0`. Medido en la nube: la voz queda igual (0,0 %) y los golpes caen a 5 ms de lo pedido.

## Recuperar al recargar

`C.restaurarDeRender` ahora recupera, del video cargado, los sonidos **y lo fijado en el Guion** (`guionFijos` de escenas y gráficos). ⚠️ Antes no se recuperaba: al recargar, el Guion salía en blanco y el siguiente video hecho en segundo plano perdía las escenas fijadas.

## ⚠️ No viajaban al servidor (arreglado el 24-sep, noche)

`api.js` nunca mandaba los sonidos a orchestrate: se oían en la vista previa (en vivo) pero el video descargado salía sin ellos, y al recargar se perdían. Las pruebas del ensamblador los metían directo en la base y por eso no se vio. Ahora viajan con generar, el camino rápido y exportar (orchestrate v237). Con la voz de estudio prendida, los efectos se corren lo mismo que cambió la voz: ver `docs/VOZ-DE-ESTUDIO.md`.

## Pendiente

- La tarjeta «Sonido» (música de fondo y su volumen) sigue siendo de muestra.

## En la vista previa (24-sep, noche)

Sergio: «que los sonidos también se oigan en la vista previa». `js/sonidos-vivo.js` los toca en vivo, sincronizados con el `<video>` del celular (cada 40 ms), con el mismo cálculo que el ensamblador: el golpe en su palabra. Si el cruce se detecta tarde, el efecto arranca adelantado lo que se atrasó (medido: 14–20 ms, recuperados).

⚠️ **Que nada suene dos veces.** Sobre la base (antes de generar, o con color y movimiento en vivo) no hay sonidos horneados: se tocan todos. Sobre el video ya hecho, `datosVideo()` dice cuáles trae horneados (`subtitle_config.sonidos`) y solo se tocan los nuevos o cambiados. Uno quitado sigue sonando en ese video hasta que Cherry lo rehace, sola.

Pausa o video silenciado: se para lo que sonaba. Al darle play, al volver a empezar (bucle) o al mover la barra, lo que en ese punto ya debía estar sonando arranca desde su punto, como en una línea de tiempo.

⚠️ **Antes se esperaba al siguiente golpe, y un sonido en la primera palabra no sonaba nunca** (Sergio, 24-sep: «puse un sonido en el inicio y no se escucha»). Su golpe cae en la primera palabra, así que el efecto arranca ANTES del segundo 0; el video en reposo está en 0 y el cruce «antes de 0 → después de 0» no se veía nunca.

## Varios sonidos en la misma línea (24-sep, noche)

Sergio: «ya que una línea tiene varias palabras, quisiera poder agregar varios sonidos por línea». El panel muestra arriba los sonidos de la línea (se toca uno para editarlo) y «+ Otro sonido»: el nuevo cae en la primera palabra de la línea que todavía no tiene sonido. Las palabras que ya tienen otro sonido salen con ♪. «Quitar este sonido» borra solo el abierto y deja el panel en el siguiente de la línea. El botón de la línea dice «Sonidos · N».

El ensamblador y la vista previa ya recibían una lista: no cambiaron.


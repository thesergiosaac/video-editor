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

## Pendiente

- En la vista previa del celular los sonidos no suenan en vivo: se oyen en el video que Cherry rehace en segundo plano.
- La tarjeta «Sonido» (música de fondo y su volumen) sigue siendo de muestra.

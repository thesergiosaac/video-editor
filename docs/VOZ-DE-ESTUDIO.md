# La voz de estudio

*24-sep-2026*

Sergio: **«quiero una limpieza profesional, la que hace Adobe Podcast, que reconstruye el audio de tal manera que suene excelente. Es lo único que falta para que el video quede perfecto para publicarlo»**.

## Cómo se escogió

Se procesaron 45 s de su voz del proyecto 21 de cuatro formas y se compararon de oído, todas al mismo volumen (cabina: https://claude.ai/artifact/AgL8ELEpAUkrzrVv8xsYuu):

| versión | qué hace | voz sobre el ruido |
|---|---|---|
| Original | como sale del teléfono | 20,9 dB |
| **Estudio** ✅ | Auphonic «Studio Voice»: reconstruye la voz como grabada en estudio | 24,1 dB |
| Limpio | Auphonic: aísla la voz + Voice AutoEQ y extensión de banda, sin rehacerla | 25,9 dB |
| Gratis | filtros de ffmpeg (afftdn, anlmdn, ecualizador, de-esser, puerta) | 22,1 dB |

Sergio: **«estudio me encantó»**. Y propuso: **«lo más conveniente sería pasarle el audio ya cortado»**.

## Por qué el audio YA CORTADO

Auphonic cobra **mínimo 3 minutos por producción**. El proyecto 21 tiene 22 grabaciones de ~10 s: mandarlas una por una serían 66 min por video. Mandando la voz ya cortada del video final va **una producción por video** (~3 min).

Lo que cuesta: si cambian los CORTES, la voz cambia y se vuelve a mandar. Cambiar sonidos, gráficos, subtítulos, pantallas o color NO la cambia: se reutiliza sin costo (se guarda por la huella del sonido). Conviene prenderla cuando los cortes ya están listos.

## La cadena

| pieza | qué hace |
|---|---|
| tarjeta **Sonido** (`js/components/config.js`, `P.audio`) | el interruptor «Voz de estudio» y cómo salió el video que se ve (`renders.voz_estudio`) |
| `js/state.js` | `vozEstudio`; `C.vozCfg()` = `'estudio'` o `''`; viaja con generar, el camino rápido y exportar; vuelve al abrir el proyecto |
| `js/adelantado.js` | cuenta en la firma: prenderla o apagarla rehace el video solo |
| `js/api.js` | la manda a orchestrate (⚠️ ver «Los sonidos no viajaban») |
| `servidor/orchestrate.ts` v237 | `subtitle_config.voz` (en `ponerPantallas`); `null` = no vino, se deja la que haya |
| ensamblador v16 (`voz.js`) | apenas está la base saca la voz, la manda a Auphonic MIENTRAS dibuja el video y al final la cambia, antes de los efectos |
| `servidor/voz-estudio.ts` v3 | la ÚNICA que tiene la llave de Auphonic: crea la producción, revisa, y sube el resultado a S3 con una dirección firmada que le da el ensamblador |

En S3: `voz/estudio/<huella>.json` (estado), `<huella>_entrada.flac`, `<huella>.flac` (la de estudio).

## Medido

- **Retardo**: Studio Voice atrasa la voz **10 ms, parejo** (sin irse corriendo). Se mide en cada video (envolventes cada 2 ms, 10 ventanas) y se quita. Limpio: 0 ms.
- ⚠️ **El atraso se quita con `-ss` en la entrada**. Con `atrim=start=` el ffmpeg de 2018 de la Lambda NO lo corría (0 ms en vez de 10; en local sí).
- **Volumen**: la voz va TAL CUAL la masteriza Auphonic (−13 LUFS). Los **efectos siguen a la voz**: si la de estudio quedó 3 dB más baja que la original, los efectos bajan 3 dB, y el balance que Sergio ajustó oyendo su voz original sigue igual.
- ⚠️ Se probó subir la voz de estudio hasta la original (+3 dB): el limitador le aplastaba los picos (−1,4 dB de cuerpo). Se descartó.
- Auphonic contestó en menos de un minuto para 91 s de voz: la espera queda escondida detrás del dibujo del video.

## ⚠️ La cortinilla de la cuenta gratis

La cuenta **gratis** de Auphonic le pega **su cortinilla (~6,4 s) al principio** de cada audio (el resultado sale más largo que la entrada). Esa voz NO se usa: el video sale con la voz normal y la tarjeta Sonido lo dice. Para que funcione hace falta **crédito pago** en Auphonic (plan S ≈ 13 USD/mes, 9 h). Nunca se le quita la cortinilla a un resultado gratis.

Si algo falla o Auphonic tarda más de 9 min, el video sale con la voz normal. Nunca se cae un video por esto.

## Los sonidos no viajaban (24-sep, noche)

Arreglado junto con esto: `api.js` **nunca mandaba los efectos de sonido** a orchestrate. Se oían en la vista previa (suenan en vivo, `sonidos-vivo.js`), pero el video que se descargaba salía sin ellos. Las pruebas del ensamblador v15 los metían directo en la base, y por eso no se vio. Además, al recargar se perdían: los que no están en un video no se guardan.

## Pendiente

- En las tarjetas de color y movimiento en vivo, el celular reproduce la base: ahí se oye la voz normal.
- Con la voz de estudio prendida, el «Calidad original» vuelve a cortar del original: es otra voz (otra huella) y se manda otra vez.

# Guiones por calco (30-sep-2026)

Sergio: *«actualmente crea unos guiones muy genéricos… analiza estructuras que han funcionado muy bien y tienen alta
retención… determina cómo podemos hacer guiones exactamente iguales»*.

Informe de las 12 primeras referencias (colección de Instagram «Referencia guiones», todas de @herasmedia):
https://claude.ai/artifact/9vsbG6T3oXNkFRq9mhTUV4 · Plan: https://claude.ai/artifact/XsGxryX9rddUZiN56BCrqr ·
Patrón de oro (dos guiones escritos a mano con el método): https://claude.ai/artifact/UtH47EKF2pj1cCMp1G8G8R

## La idea

A la IA no se le pide que se *inspire* en una estructura: se le entrega **el calco**, la transcripción de una
referencia que funcionó, partida en tramos, con las palabras **fijas** fuera de corchetes y los **huecos** entre
corchetes. Solo llena huecos. Es la regla de las letras de Sergio aplicada al guion: *copiar midiendo*.

**Por qué salían genéricos antes:** `guion_escribir` pedía gancho + puntos + cierre y calculaba 2,5 palabras por
segundo (las referencias van a 3,5); `lab_escribir` recibía solo los *nombres* de los pasos, sin qué hace cada uno,
cuánto dura ni con qué frases se dice.

## Dónde vive

| Qué | Dónde |
|---|---|
| La biblioteca (fuente de verdad) | `servidor/guiones/biblioteca.json` |
| La migración que la carga | `servidor/base/22-biblioteca-guiones.sql` — **generada** por `servidor/guiones/armar-sql.py`, no se edita a mano |
| El motor | `servidor/guion-calco.ts` → función `guion-calco` (separada de `herramientas` a propósito: no puede romper Guiones, Storyboard ni el Laboratorio) |

Tablas: `guion_pasos`, `guion_plantillas`, `guion_ganchos` (las lee cualquiera con sesión) y `guion_calcos` (sin
políticas: **solo la llave del servidor**). Nadie escribe desde el navegador.

## Decisiones de Sergio (30-sep)

1. **El descarte se permite** cuando nombra creencias concretas del público («no te voy a hablar de hashtags, ni de
   audios, ni de la hora»). El eslogan abstracto («no es X, es Y») sigue prohibido. Está en `ESTILO` de `guion-calco.ts`.
2. **Groserías: interruptor por marca, apagado por defecto** (`cuenta.groserias`). Encendido, las de Colombia.
3. **Nombres**: los provisionales se quedan (La sigla, La lista con trampa, El sketch, El ejemplo en casa ajena).
4. **El usuario nunca ve la referencia**: ni el creador, ni su transcripción. Ve la plantilla, sus moldes y los números
   («salió de un reel con 640 mil vistas»). El calco literal se queda en el servidor.

## Los cuatro modos de contar el video (Sergio, 30-sep)

*«debe haber algo donde el usuario describa su video porque si no Cherry cómo sabría de qué hablar»*.

| Modo | El usuario da | Cherry pone |
|---|---|---|
| `tema` | solo el tema | el ángulo (el problema más común del público), el concepto y el ejemplo |
| `describo` | lo que quiere decir, con sus palabras | la forma del calco; respeta sus ideas, sus ejemplos y su llamado a la acción, y no mete ideas que él no dijo |
| `objetivo` | qué quiere lograr (vender X, comentarios, seguidores) | el tema: un problema grande del público que su oferta resuelva |
| **No tengo ideas** | de qué habla su cuenta y a quién | la lista de los problemas más grandes y comunes de ese público (`problemas`) → cada uno se vuelve 3 ideas (`ideas`) con plantilla y gancho sugeridos → la escogida entra como modo `describo` |

El ejemplo de Sergio para su cuenta: *no saben editar, sus videos no tienen vistas, no saben de qué hablar, no saben
organizarse, están estancados*.

## Los datos de la cuenta

`cuenta: {nombre, deQueHabla, publico, credencial, oferta, palabra, groserias}` — se escriben una vez por marca.
Si falta la credencial o la oferta, **el motor deja el hueco entre corchetes en vez de inventarlo** (regla de
siempre: nada inventado que parezca un dato real).

## El revisor (lo mide el código, no la IA)

`medir()` en `guion-calco.ts`: palabras y segundos a 3,4 por segundo · % del llamado a la acción (las referencias:
15–25 %) · open loops · **fidelidad** = cuántas palabras fijas del calco sobreviven en orden (subsecuencia común más
larga; pide ≥ 60 %) · huecos que quedan · groserías si la marca no las usa · frases de valla · logos en «ve». Con
quejas, una sola segunda vuelta; se queda la versión con menos quejas.

## Cómo entra una tanda nueva de referencias

1. Sergio guarda los reels (o me pasa la colección).
2. Se descargan, se transcriben con Whisper local (`Descargas\Referencia Guiones\transcribir.py`) y se sacan hojas de
   un fotograma por segundo. **Se miran los fotogramas**: el cebo interrumpido (el gancho que un carro atropella) no
   está en la transcripción.
3. Informe en artefacto → Sergio corrige y bautiza.
4. Se agregan a `biblioteca.json` los calcos (y plantillas o ganchos nuevos, con su `respaldo`), se corre
   `python servidor/guiones/armar-sql.py` y se ejecuta la migración. **Sin tocar código.** El motor guarda la
   biblioteca 5 minutos en memoria.

Una plantilla es **firme** con 3 videos o más de respaldo; antes, **provisional**.

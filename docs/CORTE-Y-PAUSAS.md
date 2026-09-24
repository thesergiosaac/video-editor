# Cómo Cherry quita las pausas

*24-sep-2026*

Sergio lo describió mejor que nadie: **«cuando yo edito a mano corto donde las ondas se acaban, es visual»**. Esto es eso, automático.

---

## La cadena, de punta a punta

| Pieza | Qué hace |
|---|---|
| **Lambda `carrete-media-processor`, modo `mapaVoz`** | Sigue la onda del audio y devuelve los **bloques de voz**. Solo mide: no decide dónde cortar. |
| **`servidor/mapa-voz.ts`** | Se lo pide clip por clip y lo guarda en `clip_metadata.voz`. Una vez por clip, y se queda guardado. |
| **`servidor/motor-tomas.ts`** | Adjunta a cada corte los bloques que caen dentro (`cut.bloques`). |
| **`servidor/orchestrate.ts`** | Arma los trozos con esos bloques cuando «Sin pausas» está a la izquierda. |

`orchestrate` llama a `mapa-voz` antes de armar el corte, así que un clip nuevo se mide solo. **No** vuelve a llamar a Whisper ni toca la transcripción.

---

## Por qué no bastaba con detectar silencio

Hasta el 24-sep los trozos salían de `silencedetect` (−40 dB, mínimo 0,3 s). Un silencio solo dice **«no suena»**, y un chasquido de labios sí suena — así que contaba como voz.

Medido en el clip de Sergio (`IMG_2340`, la escena de «Ideas, ganchos, guiones…»):

```
tramo de «ganchos»   10,079 - 11,877   1,80 s     ← los demás medían 1,0
   la palabra        10,082 - 10,920    -9,8 dB
   un chasquido      11,328 - 11,717   -29,2 dB
   la cola           11,720 - 11,877   -48,2 dB
```

Ese medio segundo largo era el «espacio mínimo» que él seguía oyendo entre *ideas* y *ganchos*.

### Por volumen no se separan

La trampa: **la cola de una palabra está al mismo nivel que el chasquido**. El «-nes» final de «guiones» va de −21 a −30 dB. Un umbral que mate el chasquido se come el final de las palabras.

### Se separan por la forma

Con ventanas de 20 ms se ve solo:

```
ganchos   10,08  ##############  continuo hasta 10,90, de −2 a −25 dB
          10,92  .....           valle a −33/−46
          11,06  #               bulto suelto
          11,34  #               otro bulto suelto
guiones   13,43  ##############  continuo hasta 14,26, de −1,7 a −30 dB
```

Una palabra es **un bloque continuo que decae**. El ruido son **bultos sueltos entre valles hondos**.

---

## Los ajustes, y por qué valen lo que valen

En la Lambda (`VOZ_*`):

| | valor | por qué |
|---|---|---|
| paso | 0,02 s | ventanas de 20 ms |
| margen | 28 dB bajo el pico del clip | a 20 dB corta el final de la palabra; a 28 lo respeta y mata el chasquido |
| hueco | 0,12 s | un silencio más corto no parte una palabra (el cierre de una /t/ o /k/ es real) |
| mínimo | 0,15 s | más corto que esto es un ruidito, no una palabra |

El pico es el **p98**, no el máximo: un golpe suelto no manda.

En `orchestrate`:

| | qué es |
|---|---|
| `T` | dos bloques separados por menos de esto son la misma frase. Lo manda «Eliminar silencios largos». Suelo 0,22 s. |
| `MARGIN` | el aire alrededor de la voz. Lo manda «Aire entre cortes». Mínimo 25 ms: el bloque empieza donde el sonido sube y una consonante floja arranca un pelo antes. |
| `MIN_TROZO` | 0,12 s. **No se sube**: tirar un trozo es tirar audio, y una palabra corta cabe ahí. |

---

## Trampas conocidas

⚠️ **El mp3 no es el audio del mp4.** El audio que se mide es el mp3 mono de 64 kbps que se extrae para Whisper. Ahí el ruido está más bajo que en el mp4 y `silencedetect` no separa lo mismo. Si se mide una cosa y se corta otra, no cuadra: **medir siempre sobre el mismo archivo que se va a cortar**.

⚠️ **Al tocar el corte en el servidor, subir `VERSION_CORTE`** en `js/state.js`. Si no, el editor reutiliza la base ya cortada y el cambio no se ve — y parece que no funcionó.

⚠️ **Un corte apretado ya no pasa por el recorte de `voz`** de más abajo (`vozDe`), porque no lleva ese campo. Es a propósito: sus bordes ya vienen del mapa, que es más fino.

---

## Antes y después, con sus 22 clips

```
                      cortes que se podían apretar     duración
por silencios medidos            7 de 22               120,09 → 105,13 s
por mapa de voz                 22 de 22               120,09 →  94,65 s
la escena de la enumeración      18,66 s → 6,01 s
```

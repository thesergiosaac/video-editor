# La voz pegada a la imagen, y el reloj de las palabras

*24-sep-2026*

Sergio, viendo su video del proyecto 21: **«después de ideas, ganchos, guiones, formatos, de ahí en adelante todo sale con el audio mal, no concuerda con el video»**. Y los subtítulos venían atrasados. Eran dos fallas distintas que se sumaban.

## Lo que se midió en su video

Se buscó el sonido de cada trozo dentro del video final (correlación con su propio audio) y se comparó con dónde empieza su imagen y dónde pone el ensamblador su primera palabra:

| palabra | la voz se adelanta a la imagen | el subtítulo sale después de la voz |
|---|---|---|
| Ideas | 0,17 s | 1,31 s |
| ganchos | 0,31 s | 1,41 s |
| guiones | 0,29 s | 1,73 s |
| formatos | 0,44 s | 1,80 s |

Script: `scratchpad/av/medir_todo.py <render_id> <video_final>` (en la carpeta temporal de la sesión).

---

## Falla 1: la voz se adelantaba

⚠️ **Cada trozo de F1 traía más imagen que sonido.** Con `-t` solo en la ENTRADA, el ffmpeg de la Lambda (2018) rellenaba el final repitiendo el último cuadro: en el 4K hasta 11 cuadros congelados sin sonido (0,18 s); en la copia liviana 1 o 2 cuadros por redondeo.

⚠️ **Al pegar con `-c copy`, el hueco de sonido no queda como silencio.** El MP4 lo guarda como un paquete de audio «estirado», y los reproductores (el celular, Instagram, el navegador) lo ignoran y tocan el sonido de corrido. La voz se va adelantando un poco en cada corte. En su video había 12 paquetes estirados (1,3 s).

**Arreglo:**
- **F1 v9** lee el trozo con aire (`-t dur+0,4` en la entrada) y lo corta EXACTO en la salida (`-t dur`). Medido: imagen y sonido de cada trozo difieren menos de 7 milésimas (antes hasta 0,21 s).
- **Ensamblador v14** une los trozos pasando el sonido por `aresample=async=1:min_hard_comp=0.001:first_pts=0`: el sonido de cada trozo va donde empieza su imagen y cualquier hueco queda como silencio. Lo mismo en el armado final (`unir` de los pedazos y la pasada única), así que un video viejo queda bien al volver a exportarlo.

## Falla 2: todo lo atado a palabras llegaba tarde

⚠️ **F1 recorta 0,05 s en cada borde de cada corte** (`marginTrim`, cuando `clipGap_ms < 0`) y guardaba en `segments_json.duration_sec` el largo ya recortado. Pero las palabras (`subtitle_phrases`) y el `.ass` se arman sobre el largo de cada CORTE (`cortes_json`). El ensamblador ubica cada palabra en su trozo con esos largos: con 0,1 s de menos por trozo, cada trozo sumaba 0,1 s de atraso. En su video, la última palabra caía después del final del video.

Lo mismo movía **escenas, gráficos, pantallas e impactos de movimiento**: todos usan ese reloj. El arreglo del desfase de la noche anterior (`cortesEnLaVoz`) quitó el recorte por silencios, pero este quedó.

**Arreglo:**
- **F1 v9** guarda `duration_sec` = largo del CORTE y marca `segments_json.reloj = 'cortes'`. Queda un corrimiento fijo de 0,05 s (lo recortado al principio de cada trozo), que no se acumula.
- **Renders viejos:** el ensamblador v14 (`relojDeCortes`) y la página (`conRelojDeCortes` en `js/api.js`) usan el largo de cada corte de `cortes_json` cuando la diferencia es ese recorte, parejo en todos los trozos. Si no es parejo, no se toca nada.

---

## El Guion marcaba propuestas, no lo que salía

Sergio: **«¿por qué algunas líneas están marcadas con escena, número gigante, pero es falso?»**. El Guion marcaba todos los momentos que propuso la IA, y en todas las líneas que abarcaba cada uno. En su video los gráficos estaban apagados (ninguno de los 5 salió) y de 13 escenas entraron 6: nada en los primeros 2 s, un tope por minuto y aire entre una y otra.

Ahora `colocados()` en `js/components/cortesvivo.js` las pone con los mismos pasos, orden y ajustes que la vista previa y el ensamblador (gráficos, pantallas que mandan, escenas que esquivan a los dos), y una línea se marca solo si lo colocado se ve mientras se dice.

### Un tercer detalle que salió al probar: los «largos reales» eran aproximados

La capa de ffmpeg de la Lambda no trae ffprobe, y `duracionReal()` lee el texto «Duration: 00:00:03.49»: redondeado a centésimas y sin el relleno del sonido (1.024 muestras por trozo) que el concat sí cuenta. En la prueba sumaban 90,83 s y la base dura 90,94: los subtítulos terminaban 0,1 s adelantados.

**Ensamblador v14b:** tras unir, cuenta los cuadros de cada trozo y lee en la base el tiempo del primer cuadro de cada uno (`largosEnLaBase()`, con `framecrc` y copia, sin decodificar: 0,5 s en la copia liviana, 3 s en 4K). Si el número de cuadros no cuadra, se queda la medida anterior.

## Cómo se probó

Sin tocar lo de Sergio: funciones aparte (`carrete-media-processor-prueba`, `carrete-assembler-prueba`) y una copia del proyecto 21, cortada en 4K del original y también en la copia liviana. Se midieron los 36 trozos del video final.

| | antes (su video) | después |
|---|---|---|
| voz contra imagen en «formatos» | la voz 0,44 s antes | 0,002 s |
| voz contra imagen, todos los cortes visibles | se acumulaba | menos de 0,02 s |
| subtítulo contra voz en «formatos» | 1,80 s tarde | 0,027 s, fijo en los 36 trozos |
| huecos de sonido que el reproductor se salta | 12 (1,3 s) | 0 |
| imagen contra sonido dentro de cada trozo 4K | hasta 0,21 s | menos de 0,007 s |

Los 0,027 s fijos son el recorte del principio de cada trozo menos el arranque del codificador de sonido: no se acumulan.

⚠️ **Al medir, un corte «tapado» engaña.** Dentro de una escena de apoyo, o donde termina una, el salto grande entre cuadros es de la escena, no del corte. Se comprobó en la base (sin escenas, movimiento ni subtítulos): esos cortes también quedan a menos de 0,006 s.

Respaldo de lo que había antes: `RESPALDO_cortador_v8.zip` y `RESPALDO_ensamblador_v13.zip` en la carpeta temporal de la sesión.

# Plan: calidad original y edición instantánea

*Noche del 23 al 24 de septiembre de 2026. Sergio dejó las dos misiones y se fue a dormir: se ejecuta de corrido.*

## Las dos misiones

1. **El video final sale siempre en la calidad en que se grabó** (resolución y cuadros del clip original).
2. **Editar es lo más rápido posible**: subir, cortar, subtítulos, gráficos, escenas. Aunque lo que se vea mientras se edita sea de menos calidad.

## Lo medido antes de tocar nada (proyecto real de 22 clips)

| Etapa | Hoy | Por qué |
|---|---|---|
| Subir y convertir un clip de 26 s | **~3 min** | 4K60 HEVC → 1080p30 H.264 `preset fast crf 18`, y **se procesa dos veces** (S3 dispara la Lambda y la página también) |
| Transcribir | empieza solo cuando termina lo anterior | el disparador espera `status = processed`, que se pone al final |
| Cortar 30 trozos (F1) | **~90 s** | una sola Lambda, en serie, cada trozo por HTTP con seek |
| Pasada final (subtítulos, color) | **~35 s** | ya va en 10 pedazos paralelos |
| Compresiones | **3** | subir + cortar + final, y la del medio es la peor (`ultrafast crf 23`) |
| Resultado | 1080p **30 fps** 3,3 Mbps | la cámara graba 4K **60 fps** 72 Mbps |

Instagram por API (verificado en su documentación): ancho máximo 1920 px, 23–60 fps, ≤25 Mbps, ≤300 MB, H.264/HEVC. **4K no entra; 60 fps sí.**

## El diseño

Dos copias de cada clip, y entre ellas solo viaja **la lista de cortes**:

- **Copia liviana** (`mp4_path`): 720×1280, 30 fps, `ultrafast crf 26`. Con ella se hace TODO lo de editar. Se hace al subir, después del audio.
- **Original** (`storage_path`): el .MOV tal cual. Nunca se toca. De ahí se corta el **máster** cuando se exporta o publica.

Cherry decide dónde cortar **escuchando el audio**, no mirando el video → la copia liviana no afecta el corte en nada.

## Pasos de ejecución (cada uno deja el sistema funcionando)

- **A. Configuración y disparador duplicado.** Quitar la notificación de S3 (la página ya llama `process-upload` con reintentos). Lambda `media-processor` a 10 GB de memoria (6 CPU en vez de 2). Ensamblador a 10 GB de disco.
- **B. Subida rápida.** `handleProcess`: audio primero → `status=processed` (la transcripción arranca) → copia liviana → `mp4_path` → si el clip ya está transcrito, avisar al motor. Guardar `resolution` y `fps` del original en la fila (las columnas existían vacías).
- **C. F1 rápido y F1 máster.** Copias livianas bajadas una vez y cortadas en local, en paralelo. Modo `fuente: 'original'`: corta del .MOV a su resolución y sus cuadros, `crf 17`, repartido en varias Lambdas.
- **D. Ensamblador para el máster.** Pedazos más cortos cuando hay más píxeles; tope de bitrate proporcional a los píxeles; salida para Instagram (1080×1920 a los cuadros originales, ≤300 MB) además del original.
- **E. Exportar y publicar en original.** `calidad: 'original'` en orchestrate; botón en el resultado; el calendario no publica nada que no sea máster.
- **F. Prueba de punta a punta** en un proyecto de prueba con los clips de Sergio (copiados, no los suyos), midiendo cada tiempo.

Lo que se fue haciendo y lo que se midió queda anotado abajo, en «Bitácora».

## Bitácora

*(se rellena durante la ejecución)*

# Cherry lee tu historial (plan aprobado el 28-sep-2026)

Propuesta con sus opciones: https://claude.ai/artifact/MZVHVqND2cfpHBY87oSeMw. Sergio: «sí, dale con absolutamente
todo lo que me recomendaste». Se construye **después de terminar las fases 2, 3 y 4 del color** (orden que él pidió).

## El problema

Sergio, con la ficha de un video: *«Cherry cree que esta idea es nueva, pero tal vez en otros videos ya he hablado de
esa idea, solo que no lo hice mediante Cherry… que se dé cuenta y lo vincule y diga: esta idea la has grabado 20 veces
y ya ha funcionado; ese formato lo has grabado 30 veces»*.

Tres causas:
1. Cherry solo conoce los videos que pasaron por ella (planeados en el Laboratorio o desmontados a mano). «Desmontar
   solo» (rama `desmontar-solo`, espera a Meta) los hace de uno en uno y solo con el Laboratorio abierto.
2. `llave()` junta dos piezas solo si el texto normalizado es igual: «Cómo hacer un buen guión» y «3 errores al escribir
   tu guion» son dos ideas.
3. Compara contra los últimos 15 reels (`lab-ficha.js › medias`).

## Lo que se decidió (las cinco opciones recomendadas)

| Decisión | Escogido |
|---|---|
| Orden de las tandas | Los mejores (10 %), luego los peores (10 %), luego el resto de mejor a peor |
| Qué es «la misma idea» | Dos niveles: **tema** («guiones») y **ángulo** («cómo escribir el gancho»). Cherry dice «hablaste de guiones 20 veces; de este ángulo, 3» |
| Qué cuenta como «funcionó» | Puntaje 0–100 frente a su época: cada video contra los 30 publicados alrededor de su fecha (vistas, retención, guardados + compartidos) |
| Gemini | De pago (≈ US$0,01 por reel; 100 videos ≈ US$1 y 15 min) |
| Cuándo se ve | Construir ya; el servidor lee la historia desde ya. Los conteos en el baúl y la ficha salen **junto con «Desmontar solo»**, cuando Meta apruebe |

## Cómo se construye

1. **Traer toda la historia** (servidor, en segundo plano): paginar `me/media` hasta el final (hoy `ig-metricas` trae
   ≤ 50), con los números de cada reel. Para los reels viejos Instagram no da todo (`reels_skip_rate` es reciente): se
   ordena con lo que haya. Ojo con el límite de llamadas de la API: repartir en horas.
2. **Puntaje por época**: mediana de los 30 vecinos por fecha; puntaje combinado de vistas, retención y
   (guardados + compartidos) / alcance.
3. **Cola de desmontaje en el servidor**: tabla de cola + trabajador (no en el navegador). Mismo desmontaje de hoy (oír,
   mirar, arreglar transcripción, desmontar). 5 a la vez. Tanda 1 → tanda 2 → tanda 3.
4. **Juntar piezas**:
   - Formato, gancho y estructura: clasificar en los catálogos (formatos y ganchos del criterio de Sergio, estructuras con
     nombre). Conteo exacto.
   - Idea: embeddings por significado contra las ideas de la marca. Muy parecida → la misma; zona gris → la IA lee las dos
     y decide; lejos → nueva. Cada idea cuelga de un **tema**. En el baúl: juntar y separar a mano.
5. **Lo que ve Sergio**: el baúl y la ficha cuentan con toda la historia («grabada 20 veces · funcionó 14»); la
   recomendación del próximo video se apoya en decenas de videos por pieza.

## Lo que ya está hecho (28-sep-2026, noche)

Todo en el servidor; ninguna pantalla cambia todavía.

- **Tabla `historial_reels`** (una fila por reel publicado): sus números, `puntaje`, `tanda`, `estado` (pendiente ·
  desmontando · listo · fallo), `desmonte` (lo mismo que produce Desmontar en el Laboratorio) y `piezas` ({tema, angulo,
  idea, gancho, gancho_frase, formato, estructura}). RLS: cada quien lee lo suyo.
- **Función `historial`** (`servidor/historial.ts`):
  - `traer`: todas las páginas de `me/media` (la página siguiente llega como dirección completa y con OTRA versión de la
    API: se usa tal cual) y los números de a 45 por llamada (Instagram deja ~200 por hora). La duración, de la caja
    `mvhd` (como ig-metricas).
  - `puntuar`: por CUENTA (cada marca aparte). Cada reel contra los 30 de alrededor de su fecha: vistas (en logaritmo,
    peso 0,5), retención (0,25) y guardados + compartidos por alcance (0,25), en desviaciones robustas (mediana y MAD) →
    0–100. Tanda 1 = el 10 % mejor, 2 = el 10 % peor, 3 = el resto. Lo publicado hace menos de 3 días espera (sus
    números no se han asentado).
  - `avanzar`: de a 4 a la vez; tanda 1 del mejor al peor, tanda 2 del peor al mejor, tanda 3 del mejor al peor. Lo que
    se queda «desmontando» más de 20 min vuelve a la fila; al tercer intento, «fallo».
  - `agrupar`: la idea en TEMA y ÁNGULO con Gemini, todas las ideas de la cuenta a la vez (y las del Laboratorio si la
    página las manda en `lab`: devuelve a qué tema y ángulo va cada una). Gancho, formato y estructura ya salen de listas
    cerradas. Probado: «Como hacer un buen guión» del Laboratorio → tema «guiones», ángulo «cómo hacer un buen guion».
  - `ciclo` (pg_cron `historial-reloj`, cada 3 min, con la llave `HISTORIAL_LLAVE`): traer → puntuar → avanzar →
    agrupar (con 10 sin agrupar o al terminar). A las 9:00 UTC trae los reels nuevos.
  - Ajuste del 29-sep (v13): el TEMA nunca es el nicho de toda la cuenta («marketing» juntaba 30 de 110 videos, con
    guiones, viralidad e ideas mezclados); si un tema junta más de la quinta parte, se parte. Los reels SIN VOZ también
    se agrupan: su idea sale del texto de la publicación y de lo que se ve (el mejor reel de Sergio, puntaje 97,9, no
    tiene voz y había quedado por fuera). `agrupar` con `desde_cero: true` rehace los grupos ignorando los de antes.
- **Lambda `carrete-media-processor` › `desmontarReel`**: el video fresco de Instagram, ffmpeg saca el audio y los trozos,
  y la MISMA cadena del Laboratorio: lab-transcribir → lab-ver-video → volver a oír donde se corta → coser →
  herramientas › lab_desmontar → portada. Un reel sin voz queda con lo que se ve (`sinVoz`). ~70 s por reel.
- **La cuenta de Sergio** (28-sep): 112 reels (109 de sergiosaac.co y 3 de cobrapos.co), todos medidos y puntuados; el
  reloj los está desmontando.

## Lo que falta

- **La página** (sale con «Desmontar solo», cuando Meta apruebe): al abrir el Laboratorio, juntar `historial_reels` con
  sus videos (hoy la lista solo trae ~33 de `mis_publicaciones`), crear las piezas desde `piezas` (idea = ángulo dentro
  de su tema) y mandar sus ideas a `agrupar` para atarlas a las del historial. Con eso el baúl y la ficha cuentan con
  toda la historia.

## Pendiente de decidir más adelante

- Cuántos videos del historial entran en cada plan para los clientes (Starter / Pro).

## Revisión de Meta

El servidor y la cola no cambian ninguna pantalla del camino del revisor. Lo visible sale con «Desmontar solo» al aprobar.

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

## Pendiente de decidir más adelante

- Cuántos videos del historial entran en cada plan para los clientes (Starter / Pro).

## Revisión de Meta

El servidor y la cola no cambian ninguna pantalla del camino del revisor. Lo visible sale con «Desmontar solo» al aprobar.

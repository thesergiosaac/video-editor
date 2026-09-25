# Respuestas automáticas (24-sep-2026)

Alguien comenta una palabra (por ejemplo CEREZA) en una publicación → Cherry le contesta en público, le manda un
mensaje privado con botones, revisa si te sigue, espera, le entrega el enlace… Como ManyChat, dibujado en un lienzo.

- **Pantalla:** `herramientas/respuestas.html` (en el inicio, en la tarjeta que rota y en «Así trabajan juntas»).
- **Motor:** `servidor/ig-aviso.ts` (el mismo webhook de Instagram de siempre).
- **Esquema:** `servidor/base/16-flujos-respuesta.sql`.
- **Diseño:** inspirado en OpenReply (github.com/diwenne/openreply, MIT). Solo se tomó la idea de la interfaz:
  el programa es de Cherry.

## La pantalla

Lista de respuestas (tapa del post, palabra, cuántos la recibieron, clics, última vez) → **Editar** abre el editor:

| Izquierda | Centro | Derecha |
|---|---|---|
| Vista previa fija: Publicación / Comentarios / Mensaje, siguiendo el camino hasta el paso que se toca | El lienzo: tarjetas que se arrastran por el título, puntos ○ que se unen, **+** para el paso siguiente, zoom | El panel del paso tocado; sin paso: cuenta, lo que falta para activar, resultados y «Lo último» |

Los pasos: **Cuando alguien comenta** (una publicación / cualquiera / la próxima; palabras o cualquier comentario;
también por mensaje directo), **Contestar en público** (variantes al azar), **Mensaje privado** (texto de hasta 640
letras, `{usuario}`, hasta 3 botones de 20 letras: «sigue el flujo» o «abre un enlace»), **¿Te sigue?** (sí / no),
**Esperar** (1 a 1.440 minutos).

«+ Nueva respuesta» ofrece tres bases: *Comenta y recibe el enlace*, *Comenta, sígueme y recibe* y *En blanco*.
**▶ Probar** simula el flujo en un teléfono sin mandar nada.

## Las reglas de Instagram (la pantalla las revisa ANTES de activar)

1. **Un solo mensaje privado por comentario** (la «respuesta privada», `recipient: {comment_id}`).
2. Lo demás solo sale cuando la persona **toca un botón** (eso abre la conversación 24 horas: `recipient: {id}`).
3. Sin conversación, «después» de un mensaje **no sigue**, y «¿Te sigue?» no se puede preguntar (toma «sí»).

La pantalla recorre el grafo con tres estados (cerrada sin mensaje / cerrada con el mensaje ya usado / abierta),
igual que el motor. Un mensaje que no se podría mandar **bloquea** Activar y Guardar si está en vivo; un paso que
nunca sale solo lleva un aviso en su tarjeta.

## Cómo se guarda

- `flujos_respuesta`: el grafo `{nodos:[{id,tipo,x,y,d}], lineas:[{de,p,a}], post:{texto,enlace}}` y, copiado en
  columnas para que el webhook lo encuentre rápido: `donde`, `media_id`, `media_tapa`, `palabras`, `cualquiera`,
  `por_dm`, `activa`, `activada`. Puertos: `sig`, `b0..b2`, `si`, `no`.
  - ⚠️ «La próxima»: `media_id` lo pone el motor con la primera publicación hecha después de `activada`. La pantalla
    no lo pisa al guardar si la respuesta ya era «la próxima».
- `ejecuciones_flujo`: una por persona y comentario (índice único `flujo_id, comentario_id`: Meta reenvía avisos).
  `pasos` guarda cada llamada; `estado`: en_curso · esperando_toque · esperando_tiempo · terminada · fallida.
- `enlaces_flujo` + función `ir`: los botones con enlace apuntan a `…/functions/v1/ir?e=<id>`, que suma el clic y
  redirige. Así la lista dice cuántos clics tuvo cada una.
- `mis_flujos_resumen`: recibieron / no salieron / clics / última.

## Los relojes y los avisos

- **`respuestas-reloj`** (pg_cron, cada minuto): despierta a `ig-aviso?reloj=1` **solo si** hay alguien dormido en un
  «Esperar» cuya hora llegó. La llave se lee de la tarea `ig-publicar`.
- La cuenta tiene que estar suscrita a `comments,messages,messaging_postbacks` (lo hace `ig-conectar` al conectar y
  la acción `suscribir` al activar una respuesta). ⚠️ **Y en el panel de Meta** (Webhooks → Instagram) tienen que estar
  marcados `comments`, `messages` y `messaging_postbacks`: sin eso Instagram no avisa aunque la cuenta esté suscrita.
- Las publicaciones para escoger salen en vivo de Instagram: `ig-metricas` modo `recientes`.

## Probar sin mandar nada

`POST ig-aviso?prueba=1` con la llave interna (la `SUPABASE_KEY` del ensamblador) corre el motor en seco: no llama a
Instagram, apunta en `pasos` lo que habría mandado (`seco: true`). Lo usan `scratchpad/respuestas/_probar_motor.py`
(comentario → público → privado con botón → no te sigue → ya te sigo → enlace contado → esperar → gracias → mensaje
directo) y la prueba de la pantalla con un usuario de prueba. **Nunca** se prueba activando una respuesta sobre una
cuenta real: se usa una cuenta falsa.

## Mientras Meta no apruebe

Con la app en desarrollo, Instagram solo entrega avisos de **cuentas con rol en la app** (Sergio, cobrapos.co). A los
seguidores de verdad les empieza a contestar cuando Meta apruebe `instagram_business_manage_comments` y
`instagram_business_manage_messages` con acceso avanzado.

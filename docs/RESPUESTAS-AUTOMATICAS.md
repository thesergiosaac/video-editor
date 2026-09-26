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

## Para que no sea spam (25-sep)

Lo que Meta vigila: que la app no le escriba a quien no lo pidió y que las cuentas no se llenen de respuestas iguales.

| Protección | Dónde |
|---|---|
| Solo le escribe a quien comentó la palabra o escribió primero; no hay envíos masivos | motor |
| Un solo mensaje privado por comentario; lo demás solo tras un toque de botón, dentro de 24 h | motor + pantalla |
| **Una vez por persona** en cada respuesta (por `persona_id` o por usuario; las fallidas no cuentan) | `yaLaRecibio` en `ig-aviso` |
| **Palabra para salir**: «stop», «basta», «no más», «ya no», «cancelar»… (mensaje entero, sin tildes). Solo si Cherry ya le había escrito desde esa cuenta. Se apunta en `bajas_respuestas`, se cierran sus conversaciones y se le confirma una vez | `darDeBaja` / `deBaja` |
| **Tope de 60 respuestas públicas por hora** por cuenta (columna `publica`); pasado el tope se omite la pública y el privado sí sale | `muchasPublicas` |
| Tope de 180 mensajes por hora por cuenta (Instagram corta cerca de 200) | `hayTope` |
| **El mismo botón no repite**: si la persona toca otra vez un botón que ya tocó en esa conversación, no se vuelve a mandar nada (25-sep, por @nandy_manzano que recibió el enlace 3 veces) | `atenderToque` |
| **Al menos 2 variantes** en «Contestar en público» (bloquea activar) | pantalla |
| **«¿Te sigue?» invita, no condiciona**: el enlace tiene que llegar por los dos caminos; si el «sí» entrega un enlace que el «no» no entrega, no deja activar. La plantilla es «Comenta, recibe y sígueme»: al que no te sigue, antes lo invita con un botón a tu perfil | pantalla (`condiciona`) |
| **El enlace dice cherrysweet.app**: los botones llevan a `cherrysweet.app/ir/?e=…` (página `ir/index.html`), que cuenta el clic con la función `ir` en modo `json` y redirige. Los mensajes viejos con la dirección de supabase.co siguen funcionando | `ir/index.html` + `servidor/ir.ts` |
| Los términos de uso lo prohíben por escrito (Uso aceptable) | `terminos.html` |

Probado en seco: `scratchpad/respuestas/_probar_antispam.py`.

## ⚠️ En instagram.com los botones NO se ven

Comprobado el 25-sep con @cobrapos.co: en la web de Instagram (computador) los mensajes con botones llegan solo con el
texto, aunque nadie haya tocado nada; en la app del celular sí salen los botones. Por eso la parte del seguidor del video
para Meta se graba en el celular, y las instrucciones del revisor le piden usar la app. Si alguien dice «me llegó el
mensaje sin el botón», lo primero es preguntar si lo miró en el computador.

## ⚠️ La app de Meta tiene que estar en Live

En modo Development Meta no manda ningún aviso real: ni comentarios, ni mensajes, ni toques de botón. Las cuentas
estaban suscritas y los campos marcados, y aun así no llegaba nada hasta pasar la app a Live (25-sep). Si un día deja
de contestar, lo primero es mirar el modo de la app. Las cuentas se comprueban preguntando `me/subscribed_apps` desde
la base con `net.http_get`, para que la llave no salga de ahí.

Prueba real (25-sep, 12:13): @cobrapos.co comentó CEREZA → pública → privado con botón (3 s) → toque → ¿te sigue? sí
→ enlace → 1 clic contado.

## Mientras Meta no apruebe

Con la app en desarrollo, Instagram solo entrega avisos de **cuentas con rol en la app** (Sergio, cobrapos.co). A los
seguidores de verdad les empieza a contestar cuando Meta apruebe `instagram_business_manage_comments` y
`instagram_business_manage_messages` con acceso avanzado.


## ⚠️ A quien NO te sigue (26-sep-2026)

Instagram **no deja mandar un mensaje con botones** como respuesta privada a quien no sigue la cuenta (error
`1545133`: «You can't send media to X unless they follow you»). En el Reel «Deja de usar CapCut», a 14 de 51 personas de
CEREZA no les llegó nada: justo a los que no conocían la cuenta.

- **Ahora (ig-aviso v8):** si pasa eso, Cherry manda en el acto el mismo contenido **en texto**: el saludo (sin la frase
  que pide tocar el botón) y lo que venía detrás del botón, con los enlaces escritos (se cuentan igual por `/ir`). En
  «¿Te sigue?» toma «no» (`textoPlano`).
- **Una respuesta privada por comentario.** El intento con botón gasta la de ese comentario (luego da `2534025`, «The
  comment is invalid for a private reply»). Por eso:
  - si ni el texto se puede mandar, Cherry contesta **en público**: «Te escribí por privado 📩 Confírmame aquí si te
    llegó; si no, te lo envío de nuevo.» (palabras de Sergio: que se forme conversación, no solo «cereza»);
  - **cualquier comentario nuevo** de esa persona en la misma publicación («no me llegó», «ya»…) le trae el mensaje en
    texto, como respuesta privada a ese comentario nuevo (`entregarPendiente`).
- `?reintentar=1` (llave interna; `&seco=1` no manda nada) reintenta las fallidas de un flujo. Con el autor de un
  comentario hay que leer `from` (con acceso estándar `username` viene vacío para los demás).
- Lo que se hizo con las 14 de CapCut: a 3 les llegó el texto; a 13 se les contestó en público (con el texto viejo,
  «Comenta CEREZA otra vez»); lo que respondan les trae el mensaje.

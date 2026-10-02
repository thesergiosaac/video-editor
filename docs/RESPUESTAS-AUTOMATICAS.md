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

## ⚠️ Quitar a Cherry desde Instagram BORRA los datos de esa cuenta (comprobado el 26-sep-2026)

En Instagram → Configuración → Apps y sitios web → quitar «Cherry Very Sweet-IG» (Instagram la muestra con el número
1406860281651232: es la app que Meta creó sola para el inicio de sesión de Instagram — **no borrarla en Meta**), Meta
manda a `ig-conectar?aviso=borrar` y Cherry borra TODO lo de esa cuenta de Instagram, de todas las personas que la
tengan conectada: `flujos_respuesta` (las respuestas automáticas), `ejecuciones_flujo` (el historial),
`publicaciones_instagram` y sus números, y `cuentas_instagram`. Pasó con @cobrapos.co: se fueron sus 3 reels y la
respuesta GUIA (se rehizo desde el respaldo). **Con @sergiosaac.co habría borrado CEREZA y todo su historial.**
Es lo que dice la política de privacidad, así que está bien que pase; lo que no puede pasar es hacerlo sin saberlo.
Para que Instagram vuelva a enseñar la pantalla de permisos completa, usar una cuenta SIN automatizaciones.

Y una cuenta recién conectada (o vuelta a conectar) no traía sus publicaciones hasta el día siguiente si otra cuenta ya
se había medido ese día: arreglado en ig-metricas v8 (commit 3dddc95).

## Respuestas rápidas + el interruptor «conversar» (26-sep-2026, noche) — ig-aviso v9

**El error de verdad no era «no te sigue»:** Instagram dice *«You can't send media to X unless they follow you»*
(1545133). La PLANTILLA con botones cuenta como multimedia, y a quien no te sigue y nunca te escribió no se la deja
pasar. Sergio lo detectó: en ManyChat los botones sí llegan a quien no sigue. 5 personas que no seguían sí recibieron el
botón (ya tenían chat). Por eso: **si ningún botón del mensaje lleva enlace, sale como texto con RESPUESTAS RÁPIDAS**
(quick_replies), que Instagram cuenta como texto. El toque llega como mensaje con `quick_reply.payload` (`CH:…`) y sigue
el flujo igual que un botón (`atenderMensaje` → `atenderToque`). Los mensajes con enlace siguen con plantilla (ya con la
conversación abierta, pasan). Red de seguridad: si la respuesta rápida falla por otra razón, se manda con plantilla.
⚠️ **Falta la prueba real** con una cuenta que no siga a @sergiosaac.co y nunca le haya escrito.

**Lo que NO se puede (comprobado con los datos):** reenviar por el comentario a quien le falló (Instagram deja UNA
respuesta privada por comentario; el intento fallido casi siempre la gasta: 15 de 18) ni responder en privado a una
respuesta («@sergiosaac.co no»: 4 de 4 rechazadas, 2534025). Tampoco saber si alguien te sigue antes de que te escriba
(«User consent is required», code 230).

**El interruptor `conversar`** (columna de `flujos_respuesta`, `servidor/base/18-conversar.sql`; Sergio: «otras personas
quieren flujos simples: palabra clave → respuesta y ya… se debe poder activar y desactivar»). **Apagado por defecto.**
Encendido (hoy: las 2 CEREZA de Sergio; GUIA del revisor apagado):
- falló el privado → CONFIRMA en público («Confírmame aquí si te llegó»);
- quien no recibió vuelve a comentar lo que sea → se reintenta y se contesta SIEMPRE, en el comentario principal si era
  una respuesta: «¡Listo! Te lo envié otra vez 📩…» o, si Instagram no deja, «Instagram no me deja enviártelo por aquí 😔
  Escríbeme CEREZA por mensaje directo…»;
- quien no recibió escribe la palabra por mensaje directo → le llega el flujo aunque la respuesta no tenga `por_dm`;
- quien SÍ recibió dice «no me llegó» o repite la palabra → «Te lo mandé por privado 📩… revisa «Solicitudes»» (máx. 3
  respuestas de ayuda por persona).
«No me llegó» se reconoce con reglas fijas (`diceNoLlego`), **sin IA y sin costo**. Sergio (26-sep): contestar de forma
conversacional tiene costo → más adelante, extra o de otro plan.
⚠️ **El interruptor todavía no está en la pantalla**: Respuestas automáticas es una de las pantallas que revisa Meta
(congelada). Se enciende por la base mientras tanto.

**Probado sin red:** `scratchpad/respuestas/prueba_rapidas/probar.mjs` (base e Instagram falsos, 10 casos).

**Enlaces a WhatsApp e Instagram, DIRECTOS (v11, aprobado por Sergio).** Pasando por `cherrysweet.app/ir/`, Instagram
abría su navegador y WhatsApp mostraba su página web con otro botón; desde la historia y la bio abre la app directo.
`DIRECTOS` en `enlaceContado`: whatsapp.com, wa.me e instagram.com no pasan por `ir`. **Meta no avisa de los toques en
botones con enlace**, así que esos clics no se cuentan: se mide con quién recibió el enlace (por persona, en
`ejecuciones_flujo`) y los seguidores del canal. Los demás enlaces (cherrysweet.app, la GUIA del revisor) siguen contados.
En texto (a quien no te sigue), el botón que el texto nombra («Toca «Unirme al canal»») se cambia por el enlace escrito y
los pasos se conservan (`enTexto`).

**La pantalla del canal: `cherrysweet.app/canal/` (26-sep, aprobada por Sergio).** Probado en su iPhone: aun con el
enlace directo, Instagram abre SU navegador para cualquier enlace de un mensaje privado, y ahí WhatsApp muestra su página
web. Por eso el botón «Unirme al canal» del 2.º mensaje de las 2 CEREZA ahora lleva a `https://cherrysweet.app/canal/`
(pasa por `ir`, así que los toques vuelven a contarse). La página (`canal/index.html` + `canal/img/`, sin recoger datos):
- explica Cherry con 4 animaciones hechas en Remotion (edita sola, efectos y gráficos, publica por ti, te dice qué
  grabar); los 4 chips de arriba bajan a cada una;
- «Unirme al canal» de arriba y el fijo de abajo NO abren WhatsApp: bajan a «Así te unes» (`#unirte`, brilla rosado)
  con los 3 pasos y «Lo que recibes en el canal»;
- el ÚNICO botón que abre WhatsApp es el de `#unirte`: en celular usa `whatsapp://channel/0029Vb8xw0WCRs1wSMOitV35`
  (abre la app, sale del navegador de Instagram) y a los 1,8 s, si la página sigue a la vista, la dirección web;
- promete «créditos de regalo» de tester con un código que se publica en el canal: ⚠️ **es una promesa**, hay que
  construir el canje antes del lanzamiento. El número de créditos lo decide Sergio más adelante («eso lo decidimos
  después»).
- ✅ Probada por Sergio en su iPhone (26-sep): «todo perfecto», el botón abre la app de WhatsApp en el canal.
- SIN ZOOM (pedido de Sergio): etiqueta viewport con `user-scalable=no`, `touch-action: pan-x pan-y` y se cancelan los
  gestos de pellizco (Safari del iPhone ignora la etiqueta a propósito).
Las filas viejas de `enlaces_flujo` de ese botón (n5, botón 0) también apuntan a la página. Respaldo del grafo de antes:
`scratchpad/respaldo-cereza-antes-canal-26sep.json` de la sesión. Las fuentes de las animaciones: `src_canal/` en la
instalación de Remotion del taller (no están en el repo).

**La pantalla de la BIO: `cherrysweet.app/unete/` (27-sep, aprobada por Sergio).** Es el enlace de la biografía de
Instagram. Copia EXACTA de `canal/index.html` salvo la portada, porque quien llega desde la bio no recibió ningún mensaje:
- etiqueta «Mensaje privado · Automático» → «Editor de video con IA»;
- título «El mensaje que te llegó lo mandó Cherry» → «Tu próximo reel lo edita Cherry»;
- las rutas `img/…` → `../canal/img/…` (usa las mismas imágenes y videos, no se duplican).
⚠️ `unete/index.html` NO se edita a mano: cualquier cambio se hace en `canal/index.html` y se vuelve a armar la bio con
esas 3 sustituciones (script `_bio.py` en el scratchpad de la sesión). No cuenta visitas.

## Respuesta pública escrita por la IA + los emojis de la cuenta (27-sep-2026) — ig-aviso v13

Para el video donde Sergio pide «coméntame qué tipo de contenido creas»: **cualquier comentario** en **la próxima
publicación** de @sergiosaac.co dispara la respuesta «Cualquier comentario · próximo video» (`ac18db1b…`), que manda el
mismo mensaje privado del canal que las CEREZA. La respuesta pública la escribe la IA para ESE comentario: nombra el nicho,
dice algo bueno de él, que con Cherry lo va a potenciar y que revise sus mensajes.

- Se enciende por paso: `grafo.nodos[publico].d.ia` (la instrucción) y `d.emojis` (los ÚNICOS emojis permitidos; Sergio:
  «mis emojis, no genéricos»: ⚡ 🚀 🔥 🫶). Sin `d.ia`, todo igual que antes (la GUIA del revisor no cambia).
- `gpt-4o-mini`, 6 s de espera como mucho; si falla o tarda, sale una de las variantes de siempre (que también llevan
  sus emojis). En cada respuesta se le sugiere un emoji al azar de la lista para que no repita siempre el mismo, y todo
  emoji fuera de la lista se borra (`soloSusEmojis`).
- Las respuestas de ayuda de `conversar` (CONFIRMA, ESCRIBEME…) cambian cada emoji ajeno por el primero de la cuenta, y
  en una respuesta sin palabra dicen «Escríbeme HOLA» (cualquier mensaje directo sirve).
- En `pasos` queda `{tipo:'publico', ia:true, texto}` con lo que escribió la IA.
- ⚠️ La pantalla no muestra ni conserva a propósito `ia` y `emojis` (congelada por Meta): **no editar esa respuesta en la
  pantalla** hasta que exista el campo; se cambia por la base.
- Probado en seco con un flujo temporal sobre una publicación que no existe (borrado después): fitness, repostería,
  arquitectura, maquillaje, viajes y un «hola». ⚠️ El modo prueba con un flujo «la próxima» SÍ amarra el `media_id`
  (no mira `seco`): por eso la prueba se hace con un flujo «una» sobre una publicación falsa.

## CHERRY para el video de esta noche; la conversacional queda en pausa (27-sep-2026, 9:05 p. m.)

Sergio: «la automatización conversacional aplázala para otro video; en este video crea una con la palabra cherry…
que les llegue lo mismo que les llegó a los otros».

- **Nueva:** «Comenta, recibe y sígueme · CHERRY (próximo video)» (`5e22e323…`): copia EXACTA del grafo de la CEREZA
  «Deja de usar CapCut» (mismas respuestas públicas, mismos mensajes y el canal). Solo cambia el disparador: palabra
  `CHERRY`, **la próxima publicación** (activada 27-sep 21:05). `conversar` encendido, como las CEREZA.
  Toma «Cherry», «CHERRY!», «Chérry», «cherry 🍒»; no toma palabras mal escritas («cheri»).
- **En pausa:** «Cualquier comentario · próximo video» (`ac18db1b…`), la de la respuesta escrita por la IA. Sigue
  intacta (con `d.ia` y `d.emojis`). ⚠️ **No reactivarla desde la pantalla:** «Activar» abre el editor y vuelve a guardar
  el grafo sin la IA ni los emojis. Se reactiva por la base con `activa = true, activada = now()` justo antes de publicar
  el video de «coméntame qué tipo de contenido creas»: así se amarra a ESE video y no a otro.

## La conversacional, encendida para el video de «¿de qué tema creas contenido?» (28-sep-2026, 4:20 p. m.)

Sergio: «vincúlala al reel que voy a subir: las personas comentarán de qué tema crean contenido, les respondemos y les
enviamos el flujo al DM». Se reactivó `ac18db1b…` por la base (`activa = true, activada = now(), media_id = null`), con
su grafo intacto (`d.ia` y los emojis ⚡ 🚀 🔥 🫶). El motor la amarra a la PRIMERA publicación de @sergiosaac.co hecha
después de las 21:20:58 UTC. CHERRY (`5e22e323…`) sigue amarrada a su video (`18409223596089403`) y no toca el nuevo.


## La IA entiende la intención y ya no responde todo igual (30-sep-2026) — ig-aviso v17

Sergio: «cuando una persona dice cualquier palabra random, por ejemplo "tabla", igual se dispara… tiene que identificar la
intención del comentario… si dice "piedra", decirle que piedra no es un tema de contenido o que se explique… y está muy
genérico: a todo el mundo le contesta casi lo mismo».

**La intención (`d.pregunta`).** El paso público con IA puede llevar `grafo.nodos[publico].d.pregunta` (lo que se le
preguntó a la gente; hoy: «de qué tema crea contenido (su nicho)»). Con eso la IA contesta en JSON
`{respuesta, tema, nicho}` y decide si el comentario de verdad responde la pregunta:
- **Sí** («arte», «medicina», «hago videos de cocina saludable», «finanzas personales»): respuesta pública hecha para
  ese nicho y el flujo sigue igual (mensaje privado con el paso a paso, «¿me sigues?», el canal).
- **No** («piedra», «tabla», «laptop», «hola», «🔥🔥»): respuesta pública pidiéndole, de buena forma, que cuente de qué
  tema crea contenido. **No se manda mensaje privado.** La ejecución queda en el estado nuevo **`aclarar`** y su
  PRÓXIMO comentario en esa publicación arranca el flujo otra vez (`yaLaRecibio` y `ayudarAQuienRecibio` no cuentan
  `aclarar`; `yaPidioAclarar` sí).
- **Una sola aclaración por persona.** Si ya se le pidió una vez y vuelve a comentar algo que no es un tema, se le
  agradece (nunca otra pregunta; si la IA igual pregunta, sale una frase fija de `GRACIAS`) y el flujo sigue.
- Sin `d.pregunta`, todo como antes (sin compuerta de intención).
- `mis_flujos_resumen` (`servidor/base/24-aclarar.sql`): «enviados» ya no cuenta `aclarar`.

**La variedad.** Antes todas salían con la misma estructura («¡Qué nicho tan…! Con Cherry lo vas a potenciar, revisa
tus mensajes»). Ahora:
- Cada respuesta toma al azar un enfoque (`ENFOQUES`: una pregunta curiosa sobre su tema, un formato de video que le
  funcionaría, algo concreto del nicho…), un cierre (`CIERRES`) y, si hay que aclarar, un ángulo (`ACLARAR`).
- Se le pasan a la IA las **últimas 10 respuestas públicas** de la cuenta (`recientesPublicas`) para que no las repita,
  y tiene prohibidos los arranques gastados («¡Qué», «Genial», «¡Increíble», «¡Eso es», «Me encanta»…), «lo vas a
  potenciar» y hablar de edición (de eso se encarga el mensaje privado).
- Si aun así arranca (4 primeras palabras) o cierra (5 últimas) igual que una reciente, se le pide **una** versión
  distinta. `temperature 1`, 6 s de espera por llamada; si falla, sale una variante fija como siempre.
- Arreglado: `soloSusEmojis` usaba una variable `cambio` que no existía (ahora es un parámetro con valor por defecto).

**Probado en seco** (`ig-aviso-prueba`, cuenta y publicación falsas, borradas al final): Piedra, Tabla, hola y 🔥🔥
quedaron en `aclarar` sin mensaje privado; Arte, Medicina, Comics, cocina saludable y finanzas recibieron respuestas
distintas entre sí y su mensaje privado; «jaja no, hago contenido de fitness» (de quien había dicho «Piedra») siguió el
flujo completo; «mesa» (de quien ya había aclarado con «Tabla») recibió el agradecimiento y siguió.

**Dónde está encendida** (instrucción nueva + `pregunta`, cambiadas por la base; respaldo del grafo anterior fuera del repo):
- `ac18db1b…` «Cualquier comentario · próximo video»: el reel `18129747529808872`.
- **Nueva** `62bc5f53…` «Cualquier comentario · carrusel «A Instagram no le importa…»»: copia exacta del grafo de la
  anterior, amarrada con «una» al carrusel `18117725174052004` (activada 30-sep). El carrusel no tenía comentarios al
  amarrarla, así que nadie quedó por fuera.
- ⚠️ Igual que antes: la pantalla no conserva `ia`, `emojis` ni `pregunta` (congelada por Meta). **No editar estas dos
  en la pantalla**; se cambian por la base.

## Cada respuesta con su propia pregunta: el carrusel pide «lo más difícil» (30-sep-2026, noche) — ig-aviso v18

Sergio: «la automatización de este carrusel no era la de qué tema: lo que pregunté fue dime lo que más se te dificulta a la
hora de crear contenido y te mando la herramienta». Una persona comentó «Con tar una historia» (bien dicho) y Cherry le
pidió «de qué tema hablas». Se arregló así:

- **El motor ya no da por hecho la pregunta del tema.** El paso público puede traer, además de `ia` y `pregunta`:
  `si` y `no` (qué cuenta como respuesta y qué no, con ejemplos), `enfoques`, `aclarar`, `cierres` y `gracias` (listas
  de las que sale una al azar), `evitar` (lo que no debe decir) y `promesa` (lo que se le manda: «el acceso a la
  herramienta»). Lo que falte sale con lo de «de qué tema crea contenido», así la del reel sigue igual.
- **Segundo comentario de quien ya aclaró:** la IA también dice si ahora sí respondió; si no, sale una frase fija de
  `gracias` (antes podía inventarle algo).
- **Frases hechas:** si la respuesta trae «es clave», «no te preocupes», «déjame saber», «checa», «anímate», «eso es
  complicado, pero…» (y parecidas), se pide otra versión (una vez). El emoji ya no sale pegado a la palabra.
- **Modelo:** `gpt-4.1-mini` (antes `gpt-4o-mini`): da consejos concretos y suena más colombiano, igual de rápido.
- `62bc5f53…` quedó como «Lo más difícil al crear · carrusel «A Instagram no le importa…»»: misma cadena de mensajes
  privados (botón «Quiero usar Cherry», ¿me sigues?, el canal); las respuestas fijas ya no hablan de «nicho». La
  configuración está en `scratchpad/respuestas/config_dificultad.py` de la sesión (fuera del repo); para cambiarla,
  leer el grafo de la base, cambiar el paso `publico` y guardarlo.
- Probado en seco con 13 comentarios (Con tar una historia, editar, el tiempo, el gancho… → respuesta concreta y privado;
  Piedra, hola, 🔥🔥, Tabla → aclarar sin privado) y el reel con sus 12 de siempre (sin cambios de comportamiento).
- El comentario de @josephmedina.x quedó en `aclarar`: Sergio le escribe a mano. Si vuelve a comentar, el flujo arranca
  con el enfoque nuevo.

## Reel de prueba «Día 1 del reto» (1-oct-2026)

Primer reel de prueba publicado desde Cherry (`opciones.prueba = 'MANUAL'`; en Instagram `is_shared_to_feed: false`):
`18146455000563932`. Texto: «¿Quieres la herramienta con la que planeé el guion? Comenta de qué creas contenido y te la
mando». Nueva `372350c6…` «Cualquier comentario · reel de prueba «Día 1 del reto»»: copia del grafo de `ac18db1b…`
(la del tema, mismos mensajes privados), «una» sobre ese reel, con la promesa de ESTE video (`d.promesa = 'la herramienta'`,
cierres, agradecimientos y fijas que hablan de «la herramienta» o «el acceso», nunca de «paso a paso»). Probada en seco
con 12 comentarios. El reel no tenía comentarios al amarrarla.

## Reel «Le pregunté a un editor…»: lo que más cuesta al editar, con el tono de Sergio (2-oct-2026) — ig-aviso v20

Reel `18146370853562890`: «Comenta qué es lo que más te cuesta a la hora de editar tu contenido y te mando la herramienta
por mensaje». Nueva `3f9c3486…` «Lo que más cuesta al editar · reel «Le pregunté a un editor…»»: copia del grafo de
`ac18db1b…` (mismos mensajes privados: botón «Quiero usar Cherry», ¿me sigues?, el canal), «una» sobre ese reel.

- **El tono sale de las 3 respuestas que Sergio escribió a mano en ese video** («Editar de la forma tradicional tarda
  demasiaaado!! 🫠…», «Ahora los vas a poder hacer literalmente tocando un botón 😌🔥…», «Jajaja suele suceder…»): van en
  la instrucción como ejemplo de tono y en `d.usadas` para que NO las repita.
- **`d.usadas` (nuevo en el motor):** frases que cuentan como respuestas recientes (la IA las ve como «no repitas» y el
  control de repeticiones las compara).
- **Control de repeticiones más fino:** compara las 3 primeras palabras (antes 4) y además pide otra versión si la primera
  palabra ya abrió 2 de las 6 últimas respuestas («Ey…», «Uff…»).
- Segundo comentario que tampoco responde: la IA puede dejar la respuesta vacía y sale el agradecimiento fijo.
- Fuera «cheques», «chequees», «alivianes» (no son de Colombia); «cheques» se cambia por «revises».
- Emojis de esta respuesta: 🔥 🫠 😌 ⚡ 🚀 🫶 (Sergio usó 🫠 y 😌 en sus respuestas a mano).
- Cuenta como respuesta también pedir la herramienta («la quiero», «¿cuál es la herramienta?»).
- Probada en seco con 16 comentarios. Al amarrarla ya había 3 comentarios que Sergio contestó a mano prometiendo el enlace
  «en un momento»: a esos no les llega nada solo (el aviso de Instagram ya pasó).
- **Los 3 de antes ya lo recibieron (2-oct, ig-aviso v21):** Sergio: «sí, envíales a ellos 3 el flujo». Acción interna nueva
  `ig-aviso?entregar=1` (solo llave interna; `&seco=1` no manda nada ni deja rastro) con `{flujo_id, comentarios:[{id,
  persona_id, usuario, texto}]}`: crea la ejecución y arranca DESPUÉS del paso público (no se les contesta otra vez en
  público), así que les llega el mismo privado de siempre por respuesta privada a su comentario (Instagram da 7 días y una
  sola por comentario). Respeta bajas y a quien ya lo recibió. @pipe21e, @ares.vantablack y @lucasotrera: mensaje entregado,
  esperando que toquen «Quiero usar Cherry». Para leer quién escribió cada comentario: `comments?fields=id,text,from{id,username}`
  con `curl -g`.

## Respuestas a una HISTORIA (2-oct-2026) — ig-aviso v22

Sergio: «una automatización conversacional que se vincule a la próxima historia que voy a subir… pregunté ¿para qué usarían
esa herramienta?… Cherry le debe contestar a lo que dijo y enviarle el flujo. No debe quedarse conversando».

- **Cómo llegan:** responder una historia es un mensaje directo con `message.reply_to.story.id`. `atenderMensaje` lo manda a
  `atenderHistoria` antes que nada.
- **Qué respuesta la toma:** solo las marcadas de historia (`grafo.nodos[disparador].d.historia = true`; `por_dm = false`,
  `cualquiera = true`, `conversar = false`). `esDeHistoria` las saca de `flujoParaComentario` y del camino de mensajes
  sueltos: nunca toman un comentario ni un mensaje que no responda una historia.
- **«La próxima historia»** (`donde = 'proxima'`, `media_id` vacío): la primera historia publicada DESPUÉS de activarla
  (hora de `/{historia}?fields=timestamp`; si no la da, de `/{cuenta}/stories`) se queda con ella (`media_id` = id de la
  historia). Una historia de antes de activarla no la toma.
- **El paso «Contestar»** en una historia: no hay comentario, así que se le contesta por mensaje directo (`tipo:
  'respuesta_dm'`, con `publicaConIA(..., { dm: true })`). Nunca pide aclarar: si dijo para qué la usaría, la IA le contesta
  sobre eso; si no (un 😍, «wow»), sale una frase de `gracias`. Después, el flujo de siempre con la conversación abierta
  (botón «Quiero usar Cherry» → ¿me sigues? → canal). Una vez por persona: si vuelve a escribir, no se le repite nada.
- `recientesPublicas` también mira las respuestas de historia (`origen = 'historia'`), para no repetirse.
- **Encendida:** `efb573e7…` «Respuesta a historia · ¿para qué usarías la herramienta? (gráficos)», activada el 2-oct 19:40
  UTC. El primer mensaje ya no dice «¡Hola {usuario}!» (la respuesta de arriba ya le habló). Instrucción con el tono de las
  3 respuestas de Sergio a mano (`d.usadas`).
- Probada en seco con una historia falsa: un comentario en un reel y un mensaje suelto no la tocan; 8 respuestas a la
  historia → respuesta + botón; la segunda vez de la misma persona → nada.
- ⚠️ No editarla en la pantalla (congelada por Meta): la pantalla no conoce `d.historia` y la mostraría como «la próxima
  que publiques».
- (2-oct, v23) Segundo respaldo para amarrarla: Instagram no documenta que el id de `reply_to.story` sea el mismo de
  `/{cuenta}/stories`; si no aparece, pero TODAS las historias vivas son de después de activarla, se amarra igual. Su
  historia del 2-oct (`18129887884744786`, 19:42:59 UTC) es posterior a la activación (19:40:34): se amarra con la primera
  respuesta.

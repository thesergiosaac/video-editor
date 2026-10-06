# Cherry — el estado del lanzamiento

Lo que hace falta para que Cherry cobre y publique, y en qué va cada cosa.
**Última revisión: 24 de septiembre de 2026.**

Este documento es el mapa. Cuando algo cambie de estado, se cambia aquí.

---

## ⏳ Los relojes que corren solos

Son las dos cosas que esperan a terceros. Nada de lo que programemos las acelera.

| Qué | Estado | Desde | Qué pasa después |
|---|---|---|---|
| **Meta · Verificación de acceso** | 🟡 **En revisión** | 23-sep-2026 | Escriben en 5 días si les falta algo |
| **Paddle · Verificación de la cuenta** | 🟡 Enviada el 4-oct-2026 | Paddle avisa por correo | Sole Trader (persona natural), nombre comercial «Cherry Very Sweet». Dominio cherrysweet.app «In review» |

> ⚠️ **FECHA LÍMITE: 22 de noviembre de 2026.** Es de Meta, y sale en su propia pantalla:
> si la verificación de acceso no está completa para entonces, la cuenta queda **restringida a una
> sola aplicación**. Faltan dos meses; no es urgente hoy, pero tampoco es infinito.

---

## 💳 El cobro — Paddle

Paddle es **vendedor registrado** (*merchant of record*): cobra, factura, calcula los impuestos de
cada país y aparece en el extracto del cliente. Nosotros no vemos tarjetas nunca.

### Hecho

- Cuenta creada. Registrado como **Individual · Colombia · ingresos $0–$100.000**.
- **Sandbox**, que es donde se construye. ⚠️ Es una cuenta APARTE, con su propio inicio de sesión
  en `sandbox-vendors.paddle.com`.
- **Los planes que decidió Sergio (3-oct-2026)**, en el catálogo de pruebas. Los slugs internos (columna `plan`)
  siguen siendo `basico` / `creador` / `estudio`, que es lo que lee el resto del código (p. ej. el guion calco usa Opus
  con `estudio`). Impuesto «saas». Los dos provisionales (Creador 19, Estudio 49) quedaron **archivados**.

  | Plan | Precio | `price_id` (sandbox) |
  |---|---|---|
  | Cherry Basic | 19 USD/mes | `pri_01m42d69wc7zkm2sr0ym4f23vy` |
  | Cherry Creator | 49 USD/mes | `pri_01m42d6a0njr6p3drhxqzj2wbe` |
  | Cherry Studio | 149 USD/mes | `pri_01m42d6a4yjd57rtsqf16wddvk` |
  | 60 créditos | 15 USD, pago único | `pri_01m42d6a9xtwbyawa7p9yspgvk` |
  | 150 créditos | 30 USD, pago único | `pri_01m42d6abpydz50kpvb8q7gh6q` |
  | 400 créditos | 75 USD, pago único | `pri_01m42d6adsvkctgd2znq8hdwfp` |

  Qué trae cada plan y de dónde salen los números: https://claude.ai/artifact/NhRJykTGEim13stEpdbbQv
  («Lo que cuesta Cherry»: costos medidos en Amazon, 10 / 20 / 50 videos, todo cuesta 10 créditos, y el plan
  **Gratis para siempre** —freemium—: calendario y publicar 30 al mes, respuestas con palabra clave sin límite,
  5 carruseles con plantilla y 10 textos con IA al mes, y un primer video completo de bienvenida).
- **⛔ LA VENTA ESTÁ CERRADA A PROPÓSITO** (Sergio, 3-oct: «por ahora no vayas a dejar que puedan registrarse en
  ninguno de los planes»). En la portada, todos los botones de empezar abren el aviso «Cherry abre muy pronto» con el
  botón al canal de WhatsApp. El interruptor es `VENTA_ABIERTA = false` en `index.html`. Lo de adentro (cobro, «Tu
  plan», créditos) se construye detrás del mismo aviso.
- **El aviso de vuelta funciona**, que es la pieza que no puede fallar: función `paddle-aviso`,
  probada de punta a punta, 16 comprobaciones de 16. Firma falsa → 401. Aviso viejo reenviado →
  401. Alta → plan encendido y tope de viñetas subido solo. Aviso repetido → no hace nada. Baja →
  plan apagado y tope devuelto.
- Tablas: `suscripciones`, `planes` (precio ↔ plan, en tabla y no en el código, para que pasar a
  producción sea un INSERT) y `paddle_avisos` (evita que un reintento haga daño). Vista `mi_plan`.
- Las páginas que Paddle exige, publicadas: precios a la vista, términos, privacidad, reembolsos
  a 14 días y contacto.

### Falta

- ✅ **El botón que cobra (4-oct)**: `js/pagos.js` → pantalla «Tu plan» (los 4 planes, los créditos en dos bolsas, los
  paquetes) y la ventanita de Paddle con `custom_data.user_id`. Se abre desde la pastilla de créditos (inicio y las 8
  herramientas, que ahora muestran el plan y los créditos DE VERDAD), desde «Mi plan y créditos» en los menús y desde el
  aviso de viñetas agotadas del Laboratorio. Con `VENTA_ABIERTA = false` todo botón de comprar abre «Cherry abre muy
  pronto». Para probar el cobro SOLO en el computador: `localhost:8778/app.html?probarpago=1`.
- ✅ **Prueba de punta a punta (4-oct, Sergio, tarjeta de prueba)**: compra de Basic → `subscription.created`,
  `subscription.activated` y `transaction.completed` → plan basico activo + 20 créditos del plan + tope 32. Ojo: Paddle
  exige la *Default payment link* (Checkout → Checkout settings) o falla con `transaction_default_checkout_url_not_set`.
- ✅ **Impuestos APARTE (4-oct, Sergio: «si, aparte»)**: los 6 precios con `tax_mode: external`. En Colombia un Basic
  sale USD 19 + IVA = 22,61 y los 19 son de Cherry (antes de la comisión). La portada ya decía «los impuestos de tu país
  se calculan al pagar»; «Tu plan» dice «USD 19 al mes + impuestos».
- ✅ **Lo de después de comprar (4-oct)**, función `paddle-cuenta` + `paddle-aviso` v11 + `servidor/sql/13-cobro-despues.sql`:
  - **Cambiar de plan** sobre la MISMA suscripción, de una, y Paddle cobra o abona la diferencia (`prorated_immediately`).
    Antes de confirmar se muestra lo que se paga hoy (vista previa de Paddle). Ese cobro (`origin: subscription_update`)
    no toca los créditos; los del plan se reponen con cada mes (Creator y Studio reponen en 0).
  - **«Administrar»** en «Tu plan»: la página de cliente de Paddle (tarjeta, facturas, cancelar).
  - **Cancelar** = al final del mes pagado (Paddle). «Tu plan termina el …» + «Seguir con mi plan» (quita la cancelación).
  - **«No pudimos cobrarte»** (en mora) con «Actualizar mi tarjeta», y **«en pausa»**.
  - **Devoluciones**: avisos `adjustment.created/updated` (agregados al destino). Aprobada: un paquete quita sus créditos
    (parcial = proporcional), un mes deja en 0 los del plan. ⚠️ Si se devuelve un PLAN, cancelar también la suscripción.
  - Pruebas: `_probar_despues.py` 10/10 (avisos firmados) + de verdad en la cuenta de prueba con la suscripción de Sergio:
    subir a Creator (cobró 39,20), bajar a Basic (abonó 35,59), portal, cancelar al final, seguir, devolver el paquete
    (queda «pendiente de aprobar» en Paddle) y cancelarla (4-oct, decisión 4 de Sergio).
- ⏰ **El martes 6**: contar el uso de cada plan y lo que incluye cada uno (sin eso, quien paga recibe lo mismo que quien no).
- Migrar los productos a la cuenta real y **cambiar los `price_id` en la tabla `planes`**.
  Al pasar: `PADDLE_API_KEY_LIVE` (la guarda Sergio), `ENTORNO`/dirección de la API en `paddle-cuenta` y `paddle-aviso`,
  `tax_mode: external` en los precios reales y los avisos `adjustment.*` en el destino real.
- ✅ **Listo para pasar a la cuenta real (4-oct, la guía «Switch your account to live» de Paddle)**:
  - `paddle-aviso` solo acepta avisos desde las direcciones de Paddle (su lista `/ips`, real y de prueba, pedida cada hora;
    si no se puede traer, decide la firma). Acepta la clave de la cuenta real (`PADDLE_WEBHOOK_SECRET_LIVE`) además de la de
    prueba. Probado: desde otro computador → 403; un aviso de verdad de Paddle (la devolución aprobada) → 200.
  - `paddle-cuenta`: la cuenta que manda sale del secreto `PADDLE_ENTORNO` (`live`; sin él, la de prueba). La mudanza:
    `admin_migrar` (3 planes + 3 paquetes con impuestos aparte → filas `planes` con entorno `live`), `admin_destino_real`
    (el destino de avisos; su clave se guarda directo en Supabase), `admin_token_real` (el token `live_…`).
  - `pagos.js` pasa `pwCustomer` (Paddle Retain) con el `ctm_…` de quien ya compró.
  - Falta de Sergio en vendors.paddle.com: la llave de la API guardada en Supabase como `PADDLE_API_KEY_LIVE`, el dominio
    cherrysweet.app en Website approval, el Default payment link `https://cherrysweet.app/app.html` y la verificación.
  - Al cambiar: `PADDLE_ENTORNO=live` (secreto de Supabase) y en `pagos.js` `ENTORNO='production'` (el token ya está).
- ✅ **La mudanza, hecha (4-oct)**: Sergio guardó `PADDLE_API_KEY_LIVE`; `admin_migrar` creó en la real los 6 precios
  (impuestos aparte) y sus filas `planes` con entorno `live` (Basic `pri_01m43zstj53369fkwrcjq6p7da`, Creator
  `pri_01m43zstss2cx4cdpza6w92bd8`, Studio `pri_01m43zsv1qfvz2wkn2vyetxycy`, 60 `pri_01m43zsv9rw8kf769vcan325fr`,
  150 `pri_01m43zsvdjshgpankamqjxttc7`, 400 `pri_01m43zsvgfbfzp7dc083s3r7s8`; descuentos: ninguno). Destino de avisos
  real `ntfset_01m43ztfmcwbfdb71aeps9fbdp` (12 avisos; su clave guardada directo en `PADDLE_WEBHOOK_SECRET_LIVE`). Token
  `live_dc9eff7ea2ae993cabb90d8416c` en `pagos.js`. cherrysweet.app enviado a Website approval («In review»).
  Falta de Sergio: el Default payment link (cuando aprueben el dominio) y la verificación.
- Enviar la verificación de Paddle.

> Los precios ya son los de Sergio (3-oct). Si cambian, hay que cambiarlos en **dos sitios**: la portada y el
> catálogo de Paddle. Si no coinciden, Paddle lo marca.

---

## 📱 Instagram — la app de Meta

| | |
|---|---|
| App de Meta | `1072319438844536` |
| App de Instagram | `945011301459783` — es otro, y es el que usa la conexión |
| Cartera de negocios | **Sergio Abadía**, ya verificada |
| Camino | **Instagram API con inicio de sesión de Instagram** |

**Por qué esa cartera y no la de Cobra POS**, que estaba más completa: una cartera es un mismo
dueño ante Meta. Si la app de Cherry se gana una sanción —y una automatización de comentario a DM
es de lo que más vigilan por spam— cae sobre la cartera entera, y ahí dentro está el negocio que
factura. Escoger una ya verificada además ahorró semanas.

### Los cinco permisos

Todos en **«Ready for testing»**, o sea que **se puede construir y probar el flujo entero con la
cuenta de Sergio sin esperar ninguna aprobación**.

```
instagram_business_basic              perfil y publicaciones
instagram_business_content_publish    publicar lo programado
instagram_business_manage_comments    leer y contestar comentarios
instagram_business_manage_insights    estadísticas
instagram_business_manage_messages    el mensaje privado
```

### Tres trampas de esa pantalla

1. **Hay dos familias de permisos y se confunden.** Los `instagram_business_*` son los del inicio
   de sesión con Instagram. Los `instagram_*` **sin** «business» son los del camino con Facebook y
   exigen que la cuenta esté enganchada a una página — lo dicen sus propias descripciones
   («linked to a Page»). Pedir uno de esos arrastra el requisito de Facebook.
2. **«Ready for testing» no significa «lo pedí».** Meta concede casi todo por defecto sobre las
   cuentas propias mientras la app está en desarrollo. Lo que cuenta es la lista de App Review.
3. **Human Agent queda fuera**, aunque se planeó el 17-sep. El flujo de Cherry es *respuesta
   privada a un comentario*, que ya cubre `manage_messages`. Human Agent alarga la conversación a
   7 días **solo cuando contesta una persona**, y usarlo para automatizar está prohibido. Volvería
   a hacer falta el día que Cherry tenga bandeja de entrada atendida a mano.

### Lo que la API puede y no puede leer

- **Los videos de la cuenta conectada, sí**, con su archivo. Así el Laboratorio podría desmontar
  los videos propios sin que nadie suba nada, y cerrar el ciclo entero: publicar → medir →
  entender → decidir qué grabar.
- **Los de otra gente, no.** No hay permiso que dé un video ajeno desde su enlace; *oEmbed* solo
  devuelve el recuadro para incrustar. Las referencias virales se siguen descargando a mano.

### El usuario necesita cuenta profesional

De empresa o de creador. Con una personal la API no funciona ni para leer. Cambiarla es gratis,
**pero la vuelve pública**, y eso hay que avisarlo ANTES. La inducción tiene que detectar el tipo
de cuenta, o la gente se cae en el primer minuto sin entender por qué.

### Hecho el 24-sep (para la revisión)

- **«Conectar Instagram» de verdad** (`servidor/ig-conectar.ts`). Antes las cuentas se conectaban a mano desde el panel
  de Meta. Ahora: la persona toca el botón (perfil de la marca o Calendario) → inicio de sesión de Instagram → acepta los
  permisos → vuelve a Cherry con la cuenta atada a su marca y suscrita a los avisos de comentarios.
  - La llave de 60 días se **renueva sola** (reloj `ig-refrescar`, cada día a las 8:15 UTC, cuando le quedan <20 días).
    Las de sergiosaac.co y cobrapos.co vencían el 22-nov.
  - Atiende también los avisos de Meta: desautorizar y borrar datos (`?aviso=desautorizar` / `?aviso=borrar`, firmados).
  - ⚠️ En el panel de Meta hay que registrar las tres direcciones (Business login settings): OAuth redirect URI
    `…/functions/v1/ig-conectar`, Deauthorize `…?aviso=desautorizar`, Data deletion `…?aviso=borrar`.
- **«Borrar mi cuenta»** en el menú de la foto, como promete la política (`servidor/borrar-cuenta.ts`). En el momento:
  Instagram cortado, programadas canceladas, sin acceso. A los 30 días (reloj `cuentas-borrar`): archivos de S3 (los
  borra la Lambda, modo `borrarArchivos`, que solo acepta carpetas con el identificador completo) y del almacén, y el
  usuario (toda la base cae en cascada). Probado de punta a punta con usuarios de prueba.
  El mismo reloj borra también los **proyectos** que la persona borró hace 7 días (6-oct; ver «Tus proyectos» en
  `docs/INICIO.md`).
- **Publicar siempre el master** (`ig-publicar` v2): ver `docs/PLAN-CALIDAD-Y-VELOCIDAD.md`.
- **Respuestas automáticas** (`herramientas/respuestas.html` + motor en `ig-aviso`): comentario → respuesta pública →
  mensaje privado con botones → ¿te sigue? → esperar → enlace con clics contados. Ver `docs/RESPUESTAS-AUTOMATICAS.md`.
  ✅ Prueba real el 25-sep: @cobrapos.co comentó CEREZA → respuesta pública → privado con botón (3 s) → toque →
  «¿te sigue?» sí → enlace → 1 clic contado.
- ⚠️ **La app tiene que estar en Live** (se pasó el 25-sep). En Development Meta no manda NINGÚN aviso real, aunque
  las cuentas estén suscritas y los campos marcados. Con Cobra pasó lo mismo.

- **25-sep, para grabar la revisión:** «Desconectar» del perfil de la marca ahora desconecta DE VERDAD (acción
  `desconectar` de `ig-conectar`: solo las filas de esa persona; pausa sus respuestas y cancela sus programadas).
  Antes solo soltaba la cuenta de la marca. Cuenta del revisor creada: `review@cherrysweet.app`
  (la contraseña la crea Sergio en el primer ingreso). Auphonic agregado a la política de privacidad.
  Plan completo con los tres videos: https://claude.ai/artifact/UTyUiQYbsbpwaEUri986i7

### Falta

- Grabar el video del flujo funcionando (el mismo recorrido desde @cobrapos.co) y enviar manage_comments y
  manage_messages a revisión: sin acceso avanzado solo contesta a cuentas con rol en la app.
- Grabar el video del flujo funcionando.
- Enviar App Review con los cinco permisos. **Enviar antes de que la función exista es rechazo y
  cola nueva.**
- El icono de la app: se subió a Meta con dificultad (`Something went wrong` repetido). El archivo
  está en `assets/marca/cherry-icono-1024.png`.

---

## 🌐 El dominio

`cherrysweet.app`, comprado en Porkbun, sirviendo desde GitHub Pages.

- Los cuatro registros A de GitHub en el dominio, `www` por CNAME.
- Certificado de Let's Encrypt, renovación automática.
- `soporte@cherrysweet.app` reenvía al correo de Sergio (Email Forwarding de Porkbun, gratis).
- La dirección del sitio de Supabase apunta aquí.

⚠️ **La aplicación se movió de `index.html` a `app.html`**, misma carpeta, porque la raíz del
dominio tenía que ser una portada pública: tanto Paddle como Meta entran ahí a revisar, y lo que
había era una tarjeta pidiendo correo.

⚠️ **Un dominio `.app` está en la lista HSTS**: el navegador se niega a abrirlo sin HTTPS. Mientras
GitHub no emita el certificado, el dominio da error. Es normal.

---

## 📄 Las páginas públicas

| Página | Para qué |
|---|---|
| `index.html` | qué es Cherry, las seis herramientas, **Instagram**, precios y contacto |
| `terminos.html` | condiciones, cobro, cancelación, lo que genera la IA, uso aceptable |
| `privacidad.html` | qué se guarda, **los siete proveedores reales**, Instagram (#instagram) y cómo borrar (#borrar) |
| `reembolsos.html` | 14 días, cómo se pide, cuándo se ve el dinero |

**Las tres tienen que contar la misma historia**: lo que dice el formulario de Meta, lo que dice
la web y lo que dice la política de privacidad. Es lo que comprueba quien revisa. Si se cambia una,
se revisan las otras.

Los proveedores listados salieron del código, no de una plantilla: Supabase, OpenAI, Google
(Gemini), Cloudflare, AWS, Paddle, Meta y GitHub Pages.

---

## Lo que queda por construir, en orden

1. **El detector de comentarios.** Es lo que Meta tiene que ver funcionando, así que abre la cola
   de App Review antes.
2. **El botón que cobra.** Esperando la decisión de Sergio.
3. **El botón «Borrar mi cuenta»** dentro de Cherry. La política de privacidad ya lo promete; si
   el revisor lo busca y no lo encuentra, eso tumba la solicitud.
4. **La inducción y la prueba gratis.** Registro libre → paso a paso → al llegar al storyboard,
   modal ofreciendo 7 días con «lo decido después» → al agotar el cupo, modal otra vez. Un video
   completo gratis, **una sola vez por cuenta**.
5. **Guardar `cost_usd` en cada render.** La columna existe y está vacía en las 966 filas:
   Remotion devuelve el coste y lo estamos tirando. Sin eso, el tope de la prueba gratis se pone
   a ojo.

### Y una cuenta pendiente

«No hemos pagado nada» quiere decir que seguimos dentro de capas gratuitas, y cada una se acaba
distinto. **AWS regala 12 meses a las cuentas nuevas** y la de Cherry es de este año: cuando se
cumpla el plazo, los renders empiezan a costar sin aviso previo. **OpenAI no tiene capa gratis.**
Gemini sí. Supabase va en plan gratis hasta el primer cliente que pague.

Para medir el coste real de un render falta un permiso en AWS: el usuario `carrete-servidor` puede
lanzar Lambdas pero no leer sus métricas. Se arregla añadiéndole `cloudwatch:GetMetricStatistics`.

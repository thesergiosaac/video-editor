# Cobros de Cherry con Dodo Payments (5-oct-2026)

## Por qué Dodo
Paddle no aprobó cherrysweet.app el 5-oct («Artificial Intelligence / Creative Generative AI»). Sergio apeló, pero decidió
cobrar con **Dodo Payments** aunque Paddle apruebe: Dodo tiene los productos con IA dentro de lo que acepta y con Paddle
quedaría siempre el riesgo de que congelen la cuenta. Todo lo de Paddle se queda en el código (`paddle-aviso`,
`paddle-cuenta`, tablas y filas), sin usarse. Volver a Paddle = `PASARELA = 'paddle'` en `js/pagos.js`.

Dodo es el vendedor registrado (como Paddle): cobra, paga los impuestos de cada país y gira la plata. Cuenta: «Cherry Very
Sweet», particular, Colombia. Retiros por **transferencia local en COP** a la cuenta de Sergio (sin SWIFT).
Comisión publicada: 4 % + 0,40 USD, +1,5 % tarjeta de fuera de EE. UU., +0,5 % suscripción. Reembolso USD 1, contracargo
USD 30, retiro USD 5 si es de menos de USD 1.000. Paga cada 15 días (18 y 4). PayPal está suspendido en Dodo por ahora.

## Cómo está armado
| Pieza | Qué hace |
|---|---|
| `servidor/dodo-cuenta.ts` | Lo que pide la persona: `pagar` (crea el pago de Dodo con `metadata.user_id`), `ver_cambio` / `cambiar` (cambio de plan sobre la misma suscripción, cobro proporcional inmediato, `prevent_change`), `estado_cambio`, `tarjeta` (formulario de tarjeta nueva dentro de Cherry), `portal` (portal de cliente de Dodo), `seguir` (quitar la cancelación). Acciones `admin_*` con la llave interna: `admin_productos`, `admin_aviso`, `admin_get`, `admin_ver`, y solo en prueba `admin_devolver`, `admin_cancelar`, `admin_renovar`. |
| `servidor/dodo-aviso.ts` | Los avisos de Dodo (firma Standard Webhooks; se rechaza lo que no cuadra). `subscription.*` → estado del plan y tope de viñetas; `payment.succeeded` → créditos (paquete suma a «extra»; mes del plan repone «del plan»; el cobro de un cambio de plan NO toca créditos, lo marca `metadata.cambio_id`); `payment.failed` de un cambio → `dodo_cambios.fallo`; `refund.succeeded` / `dispute.lost` → quita los créditos de ese pago. |
| `servidor/sql/15-dodo.sql` | Columnas de Dodo en `suscripciones` (`pasarela`, `dodo_customer_id`, `dodo_subscription_id`, `gracia_hasta`), tablas `dodo_avisos` y `dodo_cambios`, la vista `mi_plan` (en gracia cuenta como al día) y la función `vencer_gracias()` con su tarea `gracia-vence` (cada hora, minuto 20). |
| `planes` | Los 6 productos de Dodo como filas con entorno `dodo_test` (o `dodo_live`). `price_id` guarda el id del producto (`pdt_…`). |
| `js/pagos.js` | `PASARELA = 'dodo'`, `DODO_MODO = 'test'`. El recuadro de Dodo (SDK `dodopayments-checkout@1.9.9`, inline) va dentro de la pantalla de pago de Cherry. |
| `js/components/inicio.js` | La franja roja del Inicio cuando falla el cobro del mes. |

**Cuando falla un cobro (decidido por Sergio el 5-oct: «hagamos todas tus recomendaciones»):**
- Primera compra o paquete: Dodo rechaza la tarjeta en su recuadro; no se activa nada.
- Cambio de plan: el plan no cambia; «Tu plan» dice «No pudimos cobrar a tu tarjeta. Tu plan sigue igual» con «Cambiar mi tarjeta».
- Cobro del mes: **3 días de gracia** con el plan prendido (`en_gracia`). Se usa el periodo de gracia de Dodo (`past_due`);
  si no estuviera prendido, Cherry da sus propios 3 días al llegar `on_hold`. Franja roja en el Inicio y aviso en «Tu plan»
  con «Actualizar mi tarjeta» (formulario de Dodo dentro de Cherry). Si no paga, se pausa (`en_mora`): sin plan ni créditos
  del plan; videos y créditos de paquetes se quedan. Al pagar, el plan vuelve solo.

## Probado en modo de prueba (5-oct, cuenta de Sergio, tarjeta 4242…)
- Compra de Basic (página de Dodo) → plan activo, 20 créditos, tope de Basic; 4 avisos en < 2 s. ✅
- Paquete de 150 créditos con el checkout de Cherry → +150. ✅
- Cambio a Creator → cobró USD 30,01 (49 − lo no usado de Basic), mes nuevo desde ese día, créditos intactos. ✅
- Devolución del paquete → −150 créditos. ✅
- Pendiente: cobro del mes que falla (tarjeta 4000 0000 0000 0341) + «Actualizar mi tarjeta», y cancelar desde el portal.

## ⭐ PARA PASAR A COBRAR DE VERDAD (modo real / «Modo activo»)
Todo lo de Dodo es **por modo**: productos, llaves, avisos y ajustes se configuran otra vez en «Modo activo».

**En el panel de Dodo, con «Modo activo» (lo hace Sergio):**
1. Verificación aprobada (producto, identidad, banco).
2. **Configuración → Suscripciones** («Ajustes de suscripciones»):
   - Permitir suscripciones múltiples: **APAGADO**
   - Prevent Trial Misuse: apagado (no hay pruebas gratis)
   - Permitir actualizaciones de suscripción (desde el portal): **APAGADO** (los cambios se hacen en Cherry)
   - Cobrar pagos de cambio de plan mediante enlace de pago: **APAGADO** (se cobra a la tarjeta guardada)
   - Permitir cancelación inmediata: **APAGADO** (cancelar deja el plan hasta el final del mes pagado)
   - Permitir cancelación en la próxima fecha de facturación: **PRENDIDO**
   - Permitir pausar la suscripción: **APAGADO**
   - Recordatorio de método de pago: 3 días
3. **Configuración → Recuperación de ingresos**:
   - Activar reintentos de pago: **PRENDIDO**
   - Periodo de gracia de la suscripción: **PRENDIDO, 3 días**, al final → **on hold** (no cancelar)
   - Activar cobro de impagos (correos): **PRENDIDO**
   - Recuperación de carrito abandonado: apagado hasta revisar qué dicen esos correos (decisión de Sergio al abrir la venta)
4. **Desarrollador → Claves API**: crear la llave real y guardarla él mismo en Supabase como `DODO_API_KEY_LIVE`.
5. Apple Pay dentro de nuestra página: **Configuración → Métodos de pago → Apple Pay → dominios**: agregar `cherrysweet.app` y
   publicar el archivo `/.well-known/apple-developer-merchantid-domain-association` que da Dodo.
6. Revisar **Marca y apariencia** (tema del checkout y del portal) y **Comunicación** (correos a clientes, idioma).
7. **Pagos → Calendario y ajustes de pagos salientes** (solo se ve en modo activo y con la verificación aprobada; el 5-oct
   salía «pagos salientes inactivos» y la cuenta de Falabella «En revisión»): pago mínimo (Dodo cobra USD 5 por giro de menos
   de USD 1.000; decide Sergio entre girar seguido o juntar USD 1.000), ciclo (cada 15 días por defecto) y moneda.
   **Cuenta activa:** Dodo admite hasta 3 cuentas y gira SIEMPRE a la «activa» (la primera aprobada queda activa sola).
   Sergio paga herramientas en dólares, así que la activa debe ser su cuenta en USD de Payoneer en EE. UU. (número de ruta
   local → transferencia doméstica, sin cobro de SWIFT); Falabella en COP queda de respaldo.

**En el servidor (lo hago yo):**
1. Secreto `DODO_ENTORNO=live` en Supabase.
2. `admin_productos` → crea los 6 productos reales y los apunta en `planes` con entorno `dodo_live`.
3. `admin_aviso` con la url de `dodo-aviso` → crea el destino de avisos real; su clave se guarda directo como
   `DODO_WEBHOOK_SECRET_LIVE` sin mostrarse (script `scratchpad/dash/dodo_montar.py`, cambiando el nombre del secreto).
4. Volver a desplegar `dodo-cuenta` y `dodo-aviso` (leen los secretos nuevos al arrancar).

✅ **HECHO el 8-oct-2026** (con «Modo activo» ya configurado por Sergio: suscripciones, recuperación, Payoneer ****3712 activa
con pago mínimo USD 100, la llave real y el dominio de Apple Pay):
- `DODO_ENTORNO=live`. Productos reales: Basic `pdt_0NpIuS6ChdFh0Yc7ATyiJ` (USD 19/mes), Creator `pdt_0NpIuSB78sXl0Sr3mqBkZ`
  (USD 49/mes), Studio `pdt_0NpIuSEeEQayBWxaCptwI` (USD 149/mes), 60 créditos `pdt_0NpIuSIUC7b9UunOoV655` (USD 15),
  150 créditos `pdt_0NpIuSMdpuT4YuZEggUMz` (USD 30), 400 créditos `pdt_0NpIuSRGu03YhYlg4eWgy` (USD 75).
- ⚠️ `CATALOGO` tenía los créditos de antes de la escalera del 5-oct (los de prueba se habían corregido en la base): las filas
  `dodo_live` de los planes se igualaron a las de prueba (15 · 30 · 100 videos y 30 · 120 · 350 créditos al mes) y el
  `CATALOGO` quedó con esos números y con `videos_mes`.
- Destino de avisos real `ep_3KQ2xijpYD3iGdypqXMmz8mdaYO` (los 15 eventos); su clave quedó en `DODO_WEBHOOK_SECRET_LIVE`
  (script `scratchpad/dash/dodo_montar_live.py`). `dodo-cuenta` y `dodo-aviso` desplegados de nuevo.
- Apple Pay: el archivo está en `/.well-known/apple-developer-merchantid-domain-association`; `_config.yml` le dice a Jekyll
  que incluya esa carpeta (sin eso, GitHub Pages ignora las carpetas que empiezan con punto).
- La página pública sigue con el cobro cerrado (`js/pagos.js` con Dodo aún SIN publicar; `VENTA_ABIERTA = false`).

**En la página (lo hago yo, mostrándoselo antes):**
1. `js/pagos.js`: `DODO_MODO = 'live'`. `VENTA_ABIERTA = true` solo cuando Sergio diga.
2. Cambiar los textos que dicen Paddle (mientras la apelación de Paddle siga abierta, NO se tocan):
   - `index.html`: «Pago seguro con Paddle», la pregunta «¿Quién cobra?» y el pie de contacto.
   - `terminos.html`: el resumen y la sección del vendedor registrado (Paddle.com Market Ltd → Dodo Payments).
   - `privacidad.html`: la fila de Paddle en la tabla de encargados, la sección del cobro y las facturas.
   - `reembolsos.html`: quién ejecuta la devolución y el enlace del correo del recibo.
3. Una compra real pequeña y su reembolso, como con Paddle.

## ⭐ Reembolsos: la regla B «muy estricta» (Sergio, 8-oct-2026)
- **Plan:** solo el PRIMER pago de la PRIMERA suscripción, dentro de 14 días, y desde ese cobro máximo **2 fabricaciones** y **una
  vez** cada cosa (gráficos, recorte, guion premium, storyboard u hoja/viñeta, carrusel con IA, desmontar del historial).
- **Paquete:** dentro de 14 días y sin nada que gaste créditos desde la compra. **Una sola devolución por persona.**
- Renovaciones y cambios de plan NO. Errores nuestros (cobro doble, caída larga) SÍ, siempre (lo decide Sergio).
- **Revisar un pedido:** `select revisar_reembolso('correo@cliente.com');` (o con `'pay_…'` de segundo dato) →
  `cumple` + `motivos` + lo usado desde el cobro (`servidor/sql/23-reembolsos.sql`; solo el servidor). Si cumple, Sergio da
  «Reembolsar» en el panel de Dodo y `dodo-aviso` hace el resto.
- **Devolver un mes completo o perder un contracargo cancela la suscripción en Dodo al instante** (`dodo-aviso` ›
  `cancelarSuscripcionDe`), para que no vuelva a cobrar; una devolución parcial no cancela. Antes del 8-oct NO cancelaba.
- Los avisos firmados por el otro modo (prueba, con `DODO_ENTORNO=live`) se anotan como «· ignorado (test)» y no tocan nada.
- La página (`reembolsos.html`, la frase de la pantalla de pago en `js/pagos.js` y la portada) dice lo mismo: si cambia una, cambia la otra.

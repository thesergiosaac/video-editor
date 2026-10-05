# Pauta en Meta y medición (5-oct-2026)

Sergio quiere escalar más adelante con anuncios en Meta; hoy la estrategia es orgánica. Desde el 5-oct todo queda listo
para el día que se paute, sin gastar nada: Claude lo maneja con el **conector oficial de Meta Ads**
(`https://mcp.facebook.com/ads`, conectado sin el permiso financiero). Plan y decisiones:
https://claude.ai/artifact/5H1PmDwxLwnt2ahvb1SHEy

## Lo que hay en Meta
| | |
|---|---|
| Portafolio | **Sergio Abadía** (`966135291127455`), el mismo de la app de Meta de Cherry |
| Cuenta publicitaria | **Cherry** `2127937548117695`, **USD** (no se puede cambiar), zona Bogotá, SIN método de pago todavía (lo pone Sergio; idea: tarjeta de Payoneer en dólares) |
| Instagram | **@sergiosaac.co** (`17841467677722044`) enlazado a la cuenta Cherry. Los anuncios salen desde ahí (decisión de Sergio) |
| Conjunto de datos (píxel) | **Cherry** `4573870822884825`, conectado a la cuenta Cherry, con Dataset Quality API |
| Públicos (gratis) | interactuaron con @sergiosaac.co 365 d · interactuaron con publicaciones 90 d · le escribieron por DM 365 d · parecidos 1 % al primero |

⚠️ En el mismo portafolio hay cuentas viejas **desactivadas por pagos** («Shoppy Family Escala» y «Shoppy Family 2», esta
de El Parche) y conjuntos de datos viejos (Shoppy Family, Four x 4, Test de Ventas). No se usan ni se tocan.
Nada de Cobra Pos ni de El Parche.

**Reglas:** todo lo que Claude crea nace EN PAUSA; presupuesto, países y cuándo arrancar los decide Sergio; las campañas
no se crean sin un presupuesto dicho por él. Anuncios candidatos: los reels que mejor funcionaron («Deja de usar CapCut»
`18111337241006255` —nombra otra marca, Meta podría frenarlo— y «100 dólares» `18146370853562890`), pautando la MISMA
publicación para que la respuesta CEREZA siga funcionando (comprobar con una prueba pequeña).

## La medición en la página
- `js/medir.js` en `index.html`, `canal/index.html` y `unete/index.html` (la bio se arma desde el canal; ver
  RESPUESTAS-AUTOMATICAS.md). La copia del revisor (`/revision/`) NO lo lleva.
- Aviso de cookies **discreto** (Sergio: «muy explícito» el primero): pastilla oscura abajo, «Usamos cookies para mejorar
  tu experiencia. Más información · Ahora no · Aceptar». El código de Meta carga SOLO con «Aceptar»
  (`localStorage['cherry-cookies'] = 'si' | 'no'`). «Ahora no» se queda (Cherry le vende también a Europa).
- Eventos del navegador: `PageView` y `Lead` al tocar cualquier `[data-canal]` (abrir el canal de WhatsApp).
- `privacidad.html`: sección 8 «Cookies y anuncios de Meta» (`#cookies`), fila «Meta (anuncios)» en la tabla de
  proveedores y el consentimiento como base legal. Lo de Paddle no se tocó (apelación abierta).

## Las compras, desde el servidor (API de Conversiones)
- `js/pagos.js` → `medicion()`: si la persona aceptó las cookies, el pago lleva `medir: 'si'`, `_fbp` y `_fbc`.
- `dodo-cuenta` → `medicionDe()`: los pone en la metadata del pago de Dodo, con la IP y el navegador.
- `dodo-aviso` → `avisarMeta()`: cuando entra un paquete o el PRIMER mes de un plan (no renovaciones ni cambios de plan),
  manda `Purchase` a Meta con el valor sin impuestos, el correo cifrado (SHA-256) y `event_id` = id del pago.
  Sin `META_CAPI_TOKEN` o `META_PIXEL_ID` no hace nada; en modo de prueba solo sale con `META_TEST_CODE` (el código de
  «Test events» del Administrador de eventos) y no cuenta como venta. Si Meta falla, se anota y el aviso sigue.
- Secretos en Supabase: `META_PIXEL_ID`, `META_CAPI_TOKEN` (5-oct). Desplegado: dodo-aviso v8, dodo-cuenta v9.

## Falta
1. Publicar el aviso de cookies y la política (esperando el sí de Sergio).
2. Verificar el dominio cherrysweet.app en Meta (Configuración del negocio → Seguridad de la marca → Dominios).
3. Probar una compra de prueba con `META_TEST_CODE` cuando se publique la pantalla de pago.
4. Cuando Sergio diga presupuesto y países: la campaña de la etapa 1 en pausa con los reels ganadores.

/* dodo-aviso — lo que Dodo Payments nos cuenta cuando alguien paga, renueva, cambia de plan, cancela o le devuelven (5-oct-2026)
 *
 * Dodo es el vendedor registrado: cobra, factura y paga los impuestos de cada país. Nosotros no vemos tarjetas. Lo único que
 * llega aquí es un aviso diciendo qué pasó, y de ese aviso sale si una cuenta entra o no entra y cuántos créditos tiene.
 * Hace lo mismo que paddle-aviso (que se queda, sin usarse).
 *
 * ⚠️ ESTA ES LA PIEZA QUE NO PUEDE FALLAR. Las mismas tres precauciones de Paddle:
 *   1. LA FIRMA SE COMPRUEBA SIEMPRE (formato «Standard Webhooks»): HMAC-SHA256 de `<webhook-id>.<webhook-timestamp>.<cuerpo
 *      CRUDO>` con la clave del destino (whsec_… en base64). El cuerpo se lee como texto y solo se interpreta después.
 *   2. EL MISMO AVISO DOS VECES NO HACE DAÑO: cada aviso se apunta por su `webhook-id` en `dodo_avisos` y el segundo se ignora;
 *      y los créditos llevan como llave el pago (pay_…) o la devolución, así que tampoco se suman dos veces.
 *   3. SI ALGO FALLA, SE RESPONDE 500 A PROPÓSITO para que Dodo lo reintente (8 veces, hasta un día y medio).
 *
 * Qué dice cada aviso (la documentación de Dodo):
 *   · subscription.* → el estado de la suscripción. Cada uno trae el estado MÁS RECIENTE, así que el orden no importa.
 *   · payment.succeeded → plata que entró. Un paquete suma sus créditos; un mes de plan (el primero y cada renovación) repone
 *     los créditos del plan; el cobro de un CAMBIO de plan no los toca (lo marca `metadata.cambio_id`, ver dodo_cambios).
 *   · refund.succeeded / dispute.lost → se quitan los créditos que dio ese pago; si era un mes de plan devuelto completo, la
 *     suscripción se cancela en Dodo al instante (8-oct) para que no vuelva a cobrar.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MODOS = {
  test: { url: 'https://test.dodopayments.com', llave: Deno.env.get('DODO_API_KEY_TEST') ?? '', clave: Deno.env.get('DODO_WEBHOOK_SECRET_TEST') ?? '' },
  live: { url: 'https://live.dodopayments.com', llave: Deno.env.get('DODO_API_KEY_LIVE') ?? '', clave: Deno.env.get('DODO_WEBHOOK_SECRET_LIVE') ?? '' },
}
type Modo = 'test' | 'live'
/* (8-oct) El modo en que cobra Cherry (el mismo secreto que lee dodo-cuenta). Un aviso firmado por el OTRO modo se anota y se
   ignora: con el cobro real prendido, lo que quede vivo del modo de prueba ya no toca ninguna cuenta. */
const ACTUAL: Modo = Deno.env.get('DODO_ENTORNO') === 'live' ? 'live' : 'test'
const JSONH = { 'Content-Type': 'application/json' }

async function tabla(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, { ...opciones,
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) } })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}
async function rpc(nombre: string, cuerpo: unknown) {
  return await tabla(`rpc/${nombre}`, { method: 'POST', body: JSON.stringify(cuerpo) })
}
async function dodo(modo: Modo, ruta: string, metodo = 'GET', cuerpo?: unknown) {
  const c = MODOS[modo]
  if (!c.llave) throw new Error(`Falta la llave de Dodo (${modo}) para ${metodo} ${ruta}`)
  const r = await fetch(`${c.url}${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${c.llave}`, ...(cuerpo ? JSONH : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) })
  if (!r.ok) throw new Error(`Dodo respondió ${r.status} a ${metodo} ${ruta}`)
  return await r.json()
}

/* ── La firma ── */
async function firmaValida(id: string, ts: string, firmas: string, crudo: string, clave: string) {
  if (!clave || !id || !ts || !firmas) return false
  /* Un aviso de hace horas es un aviso reproducido. Cinco minutos de margen. */
  const edad = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(edad) || edad > 300) return false
  let bytes: Uint8Array
  try { bytes = Uint8Array.from(atob(clave.replace(/^whsec_/, '')), (c) => c.charCodeAt(0)) } catch (_) { return false }
  const llave = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${id}.${ts}.${crudo}`)))
  const mia = btoa(String.fromCharCode(...mac))
  /* Comparación en tiempo constante, contra cada firma que traiga (`v1,<base64>` separadas por espacio) */
  return firmas.split(' ').some((p) => {
    const [v, s] = p.split(',')
    if (v !== 'v1' || !s || s.length !== mia.length) return false
    let dif = 0
    for (let i = 0; i < s.length; i++) dif |= s.charCodeAt(i) ^ mia.charCodeAt(i)
    return dif === 0
  })
}
/* Con cuál de las dos claves cuadra: el modo de prueba o el real */
async function modoDe(req: Request, crudo: string): Promise<Modo | null> {
  const id = req.headers.get('webhook-id') || '', ts = req.headers.get('webhook-timestamp') || '', f = req.headers.get('webhook-signature') || ''
  if (await firmaValida(id, ts, f, crudo, MODOS.test.clave)) return 'test'
  if (await firmaValida(id, ts, f, crudo, MODOS.live.clave)) return 'live'
  return null
}

/* ── De lo que dice Dodo a lo que entendemos aquí ──
   Si apareciera un estado nuevo se guarda tal cual en vez de perderlo: prefiero verlo raro a no verlo. */
const ESTADOS: Record<string, string> = {
  active: 'activa', pending: 'pendiente', on_hold: 'en_mora', past_due: 'en_gracia', paused: 'pausada',
  cancelled: 'cancelada', expired: 'vencida', failed: 'fallida',
}
/* (5-oct) 'en_gracia' (past_due): falló el cobro del mes pero Dodo sigue reintentando unos días; el plan SIGUE prendido */
const AL_DIA = new Set(['activa', 'en_prueba', 'en_gracia'])

/* A qué cuenta de Cherry pertenece este aviso. El camino bueno es `metadata.user_id`, que se pone al abrir el pago; si no
   viene, se busca por la suscripción o por el cliente que ya conocemos. */
async function deQuienEs(d: any): Promise<string> {
  const puesto = d?.metadata?.user_id
  if (typeof puesto === 'string' && puesto.length === 36) return puesto
  const subs = [d?.subscription_id, ...(Array.isArray(d?.subscription_ids) ? d.subscription_ids : [])].map((x: unknown) => String(x || '')).filter(Boolean)
  for (const sub of subs) {
    const ya = await tabla(`suscripciones?dodo_subscription_id=eq.${encodeURIComponent(sub)}&select=user_id`)
    if (ya?.length) return ya[0].user_id
  }
  const cli = String(d?.customer?.customer_id || '')
  if (cli) {
    const ya = await tabla(`suscripciones?dodo_customer_id=eq.${encodeURIComponent(cli)}&select=user_id`)
    if (ya?.length) return ya[0].user_id
  }
  return ''
}

/* El tope de viñetas del plan (igual que con Paddle): al perder el plan se quita la fila y la cuenta vuelve al de siempre. */
async function ponerTope(user: string, producto: string, alDia: boolean) {
  if (!alDia) { await tabla(`vinetas_tope?user_id=eq.${user}`, { method: 'DELETE' }); return null }
  const pl = await tabla(`planes?price_id=eq.${encodeURIComponent(producto)}&select=plan,vinetas_mes,nombre`)
  if (!pl?.length) { console.warn(`[dodo-aviso] producto desconocido: ${producto}. Añádelo a la tabla «planes».`); return null }
  await tabla('vinetas_tope?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: user, tope_mes: pl[0].vinetas_mes, nota: `plan ${pl[0].nombre}` }) })
  return pl[0]
}

async function atenderSuscripcion(tipo: string, d: any) {
  const user = await deQuienEs(d)
  if (!user) {
    console.error(`[dodo-aviso] ${tipo} sin cuenta que lo reclame. sub=${d?.subscription_id} cliente=${d?.customer?.customer_id}. HAY QUE MIRARLO A MANO.`)
    return { atendido: false, porque: 'sin user_id' }
  }
  const sub = String(d?.subscription_id || '')
  let estado = ESTADOS[String(d?.status || '')] || String(d?.status || 'sin_plan')
  const actual = (await tabla(`suscripciones?user_id=eq.${user}&select=dodo_subscription_id,estado,pasarela,gracia_hasta`))?.[0]

  /* (5-oct) LOS 3 DÍAS DE GRACIA DE CHERRY. Si Dodo tiene su propio periodo de gracia (past_due) se usa el suyo; si no, cuando
     falla el cobro del mes Dodo pasa directo a «on_hold» y aquí se le dan 3 días con el plan prendido para que cambie la
     tarjeta. La gracia se cuenta UNA vez por suscripción: si ya se le dio (de Dodo o nuestra) y se venció, va a pausa. Que se
     venza sin que llegue otro aviso lo hace la tarea `vencer_gracias` (cada hora). */
  let gracia: string | null = estado === 'en_gracia' ? (d?.past_due_ends_at || null) : null
  if (estado === 'en_mora') {
    const misma = actual?.dodo_subscription_id === sub
    const hasta = misma && actual?.gracia_hasta ? Date.parse(actual.gracia_hasta) : 0
    if (!hasta) { estado = 'en_gracia'; gracia = new Date(Date.now() + 3 * 864e5).toISOString() }
    else if (hasta > Date.now()) { estado = 'en_gracia'; gracia = actual.gracia_hasta }
  }
  const alDia = AL_DIA.has(estado)

  /* Una suscripción VIEJA (ya reemplazada por otra que está al día) no puede apagar la nueva */
  if (actual?.pasarela === 'dodo' && actual.dodo_subscription_id && actual.dodo_subscription_id !== sub && AL_DIA.has(actual.estado) && !alDia) {
    console.log(`[dodo-aviso] ${tipo} de una suscripción vieja (${sub}); la vigente es ${actual.dodo_subscription_id}: no se toca`)
    return { atendido: false, porque: 'suscripción vieja' }
  }

  const producto = String(d?.product_id || '')
  const plan = await ponerTope(user, producto, alDia)
  /* Sin plan al día, los créditos del plan se acaban; los de paquetes siguen (ya los pagó). */
  if (!alDia) await tabla(`creditos?user_id=eq.${user}`, { method: 'PATCH', body: JSON.stringify({ del_plan: 0, actualizado: new Date().toISOString() }) })

  /* Si canceló pero el mes pagado sigue corriendo, `termina_el` dice hasta cuándo entra (la vista `mi_plan` lo dice en `cancelado`) */
  const alFinal = !!d?.cancel_at_next_billing_date
  const termina = alFinal ? (d?.next_billing_date || null)
    : ['cancelada', 'vencida'].includes(estado) ? (d?.cancelled_at || d?.expires_at || d?.next_billing_date || null) : null
  await tabla('suscripciones?on_conflict=user_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: user, plan: alDia && plan ? plan.plan : 'ninguno', estado, pasarela: 'dodo',
      dodo_customer_id: d?.customer?.customer_id || null, dodo_subscription_id: sub || null, price_id: producto || null,
      renueva_el: alFinal ? null : (d?.next_billing_date || null), termina_el: termina,
      gracia_hasta: estado === 'en_gracia' ? gracia : (estado === 'en_mora' ? (actual?.gracia_hasta || null) : null), actualizado: new Date().toISOString(),
    }),
  })
  console.log(`[dodo-aviso] ${tipo} · ${user} · ${estado} · ${plan?.plan || 'sin plan'}${alFinal ? ' · termina ' + termina : ''}`)
  return { atendido: true, user, estado }
}

/* ── (5-oct) La API de Conversiones de Meta ──
   Cuando alguien que ACEPTÓ las cookies (metadata.medir = 'si', lo pone dodo-cuenta al abrir el pago) compra un paquete o
   paga el PRIMER mes de un plan, se le cuenta a Meta desde aquí, que sabe que el pago de verdad entró. Las renovaciones y
   los cambios de plan no se cuentan: no son clientes nuevos. Sin META_CAPI_TOKEN o sin META_PIXEL_ID no hace nada. En modo
   de prueba solo sale con META_TEST_CODE (se ve en «Probar eventos» de Meta y no cuenta como venta). Nunca tumba el aviso:
   si Meta falla, se anota y sigue. El correo va cifrado (SHA-256), como pide Meta; event_id = el pago, para no contar dos. */
const META_PIXEL = Deno.env.get('META_PIXEL_ID') ?? ''
const META_TOKEN = Deno.env.get('META_CAPI_TOKEN') ?? ''
const META_PRUEBA = Deno.env.get('META_TEST_CODE') ?? ''

async function sha256(t: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

async function avisarMeta(d: any, modo: Modo, nombre: string) {
  const m = d?.metadata || {}
  if (m.medir !== 'si' || !META_PIXEL || !META_TOKEN) return
  if (modo === 'test' && !META_PRUEBA) return
  try {
    const user_data: Record<string, unknown> = { external_id: [await sha256(String(m.user_id || ''))] }
    const correo = String(d?.customer?.email || '').trim().toLowerCase()
    if (correo) user_data.em = [await sha256(correo)]
    const pais = String(d?.billing?.country || '').trim().toLowerCase()
    if (pais) user_data.country = [await sha256(pais)]
    if (m.fbp) user_data.fbp = m.fbp
    if (m.fbc) user_data.fbc = m.fbc
    if (m.ip) user_data.client_ip_address = m.ip
    if (m.ua) user_data.client_user_agent = m.ua
    const valor = Math.max(0, (Number(d?.total_amount) || 0) - (Number(d?.tax) || 0)) / 100
    const cuerpo: Record<string, unknown> = {
      data: [{
        event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: String(d?.payment_id || ''),
        action_source: 'website', event_source_url: 'https://cherrysweet.app/app.html', user_data,
        custom_data: { currency: String(d?.currency || 'USD'), value: valor, content_name: nombre },
      }],
    }
    if (modo === 'test') cuerpo.test_event_code = META_PRUEBA
    const r = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(META_PIXEL)}/events?access_token=${encodeURIComponent(META_TOKEN)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) console.error(`[dodo-aviso] Meta no recibió la compra (${r.status}): ${JSON.stringify(j).slice(0, 300)}`)
    else console.log(`[dodo-aviso] Meta: compra «${nombre}» USD ${valor} (${j?.events_received ?? '?'} recibida${modo === 'test' ? ', de prueba' : ''})`)
  } catch (e) {
    console.error(`[dodo-aviso] Meta falló: ${e}`)
  }
}

/* ── Los CRÉDITOS: un pago que entró ── */
async function atenderPago(d: any, modo: Modo) {
  if (String(d?.status || 'succeeded') !== 'succeeded') return { atendido: false, porque: `pago ${d?.status}` }
  /* el cobro de $0 que guarda la tarjeta, o un cambio de tarjeta: no es plata */
  if (!(Number(d?.total_amount) > 0) || d?.is_update_payment_method) return { atendido: false, porque: 'pago sin monto' }
  const user = await deQuienEs(d)
  const pago = String(d?.payment_id || '')
  if (!user || !pago) {
    console.error(`[dodo-aviso] pago ${pago} sin cuenta que lo reclame. cliente=${d?.customer?.customer_id}. HAY QUE MIRARLO A MANO.`)
    return { atendido: false, porque: 'sin user_id' }
  }
  const sub = String(d?.subscription_id || (Array.isArray(d?.subscription_ids) ? d.subscription_ids[0] : '') || '')

  if (!sub) {
    /* un PAQUETE: sus créditos se suman a la bolsa «extra» (no vencen) */
    const linea = Array.isArray(d?.product_cart) ? d.product_cart[0] : null
    const producto = String(linea?.product_id || '')
    const p = (await tabla(`planes?price_id=eq.${encodeURIComponent(producto)}&select=tipo,nombre,creditos`))?.[0]
    if (!p || p.tipo !== 'paquete') {
      console.warn(`[dodo-aviso] pago ${pago} de un producto desconocido o que no es paquete: ${producto}`)
      return { atendido: false, porque: 'producto desconocido' }
    }
    const cuantos = Math.max(1, Number(linea?.quantity) || 1)
    const nuevo = await rpc('sumar_paquete', { p_user: user, p_llave: pago, p_price: producto, p_creditos: p.creditos * cuantos })
    console.log(`[dodo-aviso] paquete ${p.nombre} × ${cuantos} · ${user} · ${nuevo ? 'sumado' : 'ya estaba'}`)
    if (nuevo) await avisarMeta(d, modo, p.nombre)
    return { atendido: true, user, paquete: p.nombre, nuevo }
  }

  /* ¿El cobro de un CAMBIO de plan? Lo dice la marca que puso dodo-cuenta al pedirlo. La marca se ata al PRIMER pago que la
     trae: si un cobro posterior (una renovación) la heredara, ya no cuenta como cambio. */
  const marca = String(d?.metadata?.cambio_id || '')
  if (/^[0-9a-f-]{36}$/.test(marca)) {
    const c = (await tabla(`dodo_cambios?cambio_id=eq.${marca}&select=pago,plan`))?.[0]
    if (c && (!c.pago || c.pago === pago)) {
      if (!c.pago) await tabla(`dodo_cambios?cambio_id=eq.${marca}&pago=is.null`, { method: 'PATCH', body: JSON.stringify({ pago }) })
      console.log(`[dodo-aviso] cobro del cambio a ${c.plan} · ${user} · los créditos no se tocan`)
      return { atendido: true, user, porque: 'cambio de plan' }
    }
  }

  /* Un mes del plan (el primero o una renovación): la bolsa del plan VUELVE al número del plan. El producto se le pregunta a
     Dodo, porque el pago de una suscripción no lo trae. */
  const s = await dodo(modo, `/subscriptions/${encodeURIComponent(sub)}`)
  const producto = String(s?.product_id || '')
  const p = (await tabla(`planes?price_id=eq.${encodeURIComponent(producto)}&select=tipo,plan,nombre,creditos`))?.[0]
  if (!p) {
    console.warn(`[dodo-aviso] pago ${pago} de un plan desconocido: ${producto}. Añádelo a la tabla «planes».`)
    return { atendido: false, porque: 'plan desconocido' }
  }
  const nuevo = await rpc('reponer_plan', { p_user: user, p_llave: pago, p_price: producto, p_creditos: Math.max(0, Number(p.creditos) || 0) })
  console.log(`[dodo-aviso] mes de ${p.nombre} · ${user} · créditos del plan ${nuevo ? 'repuestos (' + p.creditos + ')' : 'ya estaban'}`)
  /* a Meta solo el PRIMER mes (la suscripción nació hace menos de 6 h): las renovaciones no son clientes nuevos */
  const nacio = Date.parse(String(s?.created_at || ''))
  if (nuevo && nacio && Date.now() - nacio < 6 * 3600 * 1000) await avisarMeta(d, modo, p.nombre)
  return { atendido: true, user, plan: p.plan, nuevo }
}

/* ── Un cobro que NO pasó. Solo importa si es el de un cambio de plan (con on_payment_failure: prevent_change el plan no
   cambia): se apunta en dodo_cambios para que «Tu plan» le diga a la persona que no se pudo, en vez de quedarse esperando.
   Los cobros mensuales fallidos los cuenta la suscripción (on_hold / past_due). */
async function atenderPagoFallido(d: any) {
  const marca = String(d?.metadata?.cambio_id || '')
  if (!/^[0-9a-f-]{36}$/.test(marca)) return { atendido: false, porque: 'pago fallido que no es de un cambio' }
  const porque = String(d?.error_message || d?.error_code || 'la tarjeta no pasó').slice(0, 300)
  await tabla(`dodo_cambios?cambio_id=eq.${marca}&pago=is.null`, { method: 'PATCH', body: JSON.stringify({ fallo: porque }) })
  console.log(`[dodo-aviso] el cobro del cambio ${marca} no pasó: ${porque}`)
  return { atendido: true, porque: 'cambio sin cobrar' }
}

/* ── Las DEVOLUCIONES (y los contracargos perdidos) ──
   Se busca qué dio ese pago en `creditos_movimientos`: un paquete → se quitan sus créditos (si devuelven parte, la parte
   proporcional); un mes de plan → la bolsa del plan queda en 0. La devolución es la llave: repetida no quita dos veces. */
async function cancelarSuscripcionDe(modo: Modo, pago: string) {
  const sub = String((await dodo(modo, `/payments/${encodeURIComponent(pago)}`))?.subscription_id || '')
  if (!sub) { console.error(`[dodo-aviso] devolución del mes ${pago} sin suscripción en Dodo. HAY QUE MIRARLO A MANO.`); return null }
  const s = await dodo(modo, `/subscriptions/${encodeURIComponent(sub)}`)
  if (['cancelled', 'expired', 'failed'].includes(String(s?.status || ''))) return { sub, ya: String(s.status) }
  const d = await dodo(modo, `/subscriptions/${encodeURIComponent(sub)}`, 'PATCH', { status: 'cancelled' })
  console.log(`[dodo-aviso] devolución del pago ${pago}: suscripción ${sub} cancelada en Dodo (${d?.status})`)
  return { sub, estado: d?.status }
}
async function atenderDevolucion(d: any, modo: Modo, llave: string, parcial: boolean, monto: number) {
  const pago = String(d?.payment_id || '')
  const mov = (await tabla(`creditos_movimientos?llave=eq.${encodeURIComponent(pago)}&select=user_id,bolsa,cantidad,price_id`))?.[0]
  if (!mov) { console.warn(`[dodo-aviso] devolución ${llave} del pago ${pago}: ese pago no dio créditos`); return { atendido: true, porque: 'el pago no dio créditos' } }
  if (mov.bolsa === 'del_plan') {
    /* (8-oct) Devuelto TODO el mes (o perdido el contracargo): la suscripción se cancela en Dodo YA, para que no vuelva a cobrar
       el mes siguiente, y su aviso (subscription.cancelled) deja la cuenta sin plan. Lo dice la política de reembolsos. Una
       devolución PARCIAL (un gesto, p. ej. por una caída) no cancela. */
    const cancelada = parcial ? null : await cancelarSuscripcionDe(modo, pago)
    const hecho = await rpc('quitar_mes', { p_user: mov.user_id, p_llave: llave, p_price: mov.price_id })
    console.log(`[dodo-aviso] devolución de un mes · ${mov.user_id} · créditos del plan ${hecho ? 'en 0' : 'ya estaban'}`)
    return { atendido: true, user: mov.user_id, devuelto: 'mes', hecho, cancelada }
  }
  let quitar = Math.abs(Number(mov.cantidad) || 0)
  if (parcial) {
    const total = Number((await dodo(modo, `/payments/${encodeURIComponent(pago)}`))?.total_amount || 0)
    if (!total || !monto) { console.error(`[dodo-aviso] devolución PARCIAL ${llave} del pago ${pago}: no supe cuánto era. HAY QUE MIRARLO A MANO.`); return { atendido: false, porque: 'parcial sin total' } }
    quitar = Math.round(quitar * Math.min(1, monto / total))
  }
  const hecho = await rpc('quitar_paquete', { p_user: mov.user_id, p_llave: llave, p_price: mov.price_id, p_creditos: quitar })
  console.log(`[dodo-aviso] devolución de un paquete · ${mov.user_id} · −${quitar} créditos ${hecho ? 'quitados' : 'ya estaban quitados'}`)
  return { atendido: true, user: mov.user_id, devuelto: 'paquete', quitar, hecho }
}

const DE_SUSCRIPCION = new Set(['subscription.active', 'subscription.renewed', 'subscription.updated', 'subscription.plan_changed',
  'subscription.on_hold', 'subscription.past_due', 'subscription.paused', 'subscription.unpaused', 'subscription.cancelled',
  'subscription.expired', 'subscription.failed'])

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Solo POST', { status: 405 })
  /* ⚠️ El cuerpo CRUDO primero. La firma se calcula sobre estos bytes exactos. */
  const crudo = await req.text()
  const modo = await modoDe(req, crudo)
  if (!modo) {
    console.warn('[dodo-aviso] firma que no cuadra: se rechaza')
    return new Response('Firma inválida', { status: 401 })
  }
  let aviso: any
  try { aviso = JSON.parse(crudo) } catch { return new Response('JSON ilegible', { status: 400 }) }
  const id = req.headers.get('webhook-id') || ''
  const tipo = String(aviso?.type || '')
  const d = aviso?.data || {}

  try {
    /* Ya atendido: 200 para que Dodo deje de reintentar, y no se toca nada. */
    const ya = await tabla(`dodo_avisos?webhook_id=eq.${encodeURIComponent(id)}&select=webhook_id`)
    if (ya?.length) {
      console.log(`[dodo-aviso] ${tipo} repetido (${id}): no se hace nada`)
      return new Response(JSON.stringify({ ok: true, repetido: true }), { headers: JSONH })
    }
    if (modo !== ACTUAL) {
      console.log(`[dodo-aviso] ${tipo} del modo ${modo} con Cherry cobrando en ${ACTUAL}: se anota y no se hace nada`)
      await tabla('dodo_avisos?on_conflict=webhook_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ webhook_id: id, tipo: `${tipo} · ignorado (${modo})`, cuerpo: aviso }) })
      return new Response(JSON.stringify({ ok: true, ignorado: `aviso del modo ${modo}` }), { headers: JSONH })
    }
    const r = tipo === 'payment.succeeded' ? await atenderPago(d, modo)
      : tipo === 'payment.failed' ? await atenderPagoFallido(d)
      : tipo === 'refund.succeeded' ? await atenderDevolucion(d, modo, String(d?.refund_id || id), !!d?.is_partial, Number(d?.amount || 0))
      : tipo === 'dispute.lost' ? await atenderDevolucion(d, modo, String(d?.dispute_id || id), false, 0)
      : DE_SUSCRIPCION.has(tipo) ? await atenderSuscripcion(tipo, d)
      : { atendido: false, porque: 'no cambia el acceso' }
    /* Se apunta DESPUÉS de atenderlo: si lo de arriba revienta, el reintento de Dodo lo vuelve a intentar. */
    await tabla('dodo_avisos?on_conflict=webhook_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ webhook_id: id, tipo, cuerpo: aviso }) })
    return new Response(JSON.stringify({ ok: true, modo, ...r }), { headers: JSONH })
  } catch (e) {
    /* 500 a propósito: Dodo lo reintenta y así no se pierde un pago. */
    console.error(`[dodo-aviso] ${tipo} falló: ${e instanceof Error ? e.message : e}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: JSONH })
  }
})

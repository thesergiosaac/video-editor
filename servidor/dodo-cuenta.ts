// dodo-cuenta v1 (5-oct-2026) — todo lo que la persona hace con su plan, ahora con Dodo Payments.
// Paddle no aprobó Cherry («IA generativa») y Sergio decidió cobrar con Dodo aunque Paddle apruebe: Dodo tiene los productos
// con IA dentro de lo que acepta. Hace lo mismo que paddle-cuenta, más abrir el pago (en Dodo el pago se crea en el servidor).
// Lo que decidió Sergio (4-oct) sigue igual: cambiar de plan entra DE UNA y se cobra o se descuenta la diferencia; cancelar deja
// el plan hasta el final del mes pagado; los impuestos van APARTE del precio.
//
// Con sesión de usuario. Acciones:
//   · pagar {producto, volver}  → crea el pago de Dodo (checkout) con `metadata.user_id` y devuelve {checkout_url}; la página lo
//                                 abre DENTRO de la pantalla de pago de Cherry. Lo que se activa lo decide el aviso (dodo-aviso).
//   · ver_cambio {plan}         → lo que pagaría HOY por pasarse a ese plan, sin cambiar nada (la vista previa de Dodo):
//                                 {plan, nombre, accion: 'cobra'|'abona'|'nada', hoy, moneda, desde, mensual}
//   · cambiar {plan}            → lo cambia sobre la MISMA suscripción (nunca una segunda). Si el cobro falla no cambia nada
//                                 (on_payment_failure: prevent_change). El cobro va marcado con `cambio_id` (tabla dodo_cambios)
//                                 para que el aviso sepa que es un cambio de plan y no toque los créditos.
//   · estado_cambio {cambio}    → 'listo' | 'fallo' (la tarjeta no pasó: el plan sigue igual) | 'esperando'.
//   · tarjeta {volver}          → el formulario de Dodo para poner una tarjeta NUEVA, que Cherry abre dentro de su pantalla.
//                                 Si el plan estaba en gracia o en pausa por un cobro fallido, Dodo cobra el mes pendiente y
//                                 el plan vuelve solo (lo dicen los avisos).
//   · portal                    → la dirección del portal de cliente de Dodo (cancelar, cambiar la tarjeta, facturas).
//   · seguir                    → quita la cancelación programada (sigue con su plan).
// Solo con la llave interna:
//   · admin_productos           → crea en Dodo los 3 planes y los 3 paquetes (si faltan) y los apunta en `planes`.
//   · admin_aviso {url}         → crea en Dodo el destino de avisos (si falta) y devuelve su clave UNA vez, para guardarla en
//                                 Supabase sin mostrarla.
//   · admin_ver {pago|sub}      → lo que Dodo sabe de un pago o una suscripción (para las pruebas).
//   · admin_devolver {pago}     → devolución completa de un pago (solo en modo de prueba).
//   · admin_cancelar {ahora?}   → cancela la suscripción de la cuenta de x-prueba-uid (solo en modo de prueba).
//   · admin_renovar {minutos}   → adelanta la próxima renovación (solo en modo de prueba): para probar un cobro que falla.
// El modo sale del secreto DODO_ENTORNO ('live' o, sin él, el de prueba).

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MODOS = {
  test: { url: 'https://test.dodopayments.com', llave: Deno.env.get('DODO_API_KEY_TEST') ?? '', entorno: 'dodo_test' },
  live: { url: 'https://live.dodopayments.com', llave: Deno.env.get('DODO_API_KEY_LIVE') ?? '', entorno: 'dodo_live' },
}
const MODO: 'test' | 'live' = Deno.env.get('DODO_ENTORNO') === 'live' ? 'live' : 'test'
const ENTORNO = MODOS[MODO].entorno
const INTERNAS = [SB_SERVICIO, Deno.env.get('SVC_JWT') || ''].filter(Boolean)
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-prueba-uid',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

/* Los 6 productos: los mismos planes y paquetes de la portada (en centavos de dólar). Los planes son mensuales; Dodo pide
   además un «periodo» de la suscripción, que tiene que ser más largo que el cobro o la suscripción se vence al primer mes:
   se pone el máximo razonable (20 años) y se renueva cada mes hasta que la cancelen. */
const CATALOGO = [
  { plan: 'basico',  nombre: 'Basic',        tipo: 'plan',    centavos: 1900,  creditos: 20,  vinetas_mes: 32 },
  { plan: 'creador', nombre: 'Creator',      tipo: 'plan',    centavos: 4900,  creditos: 0,   vinetas_mes: 48 },
  { plan: 'estudio', nombre: 'Studio',       tipo: 'plan',    centavos: 14900, creditos: 0,   vinetas_mes: 160 },
  { plan: 'paquete', nombre: '60 créditos',  tipo: 'paquete', centavos: 1500,  creditos: 60,  vinetas_mes: 0 },
  { plan: 'paquete', nombre: '150 créditos', tipo: 'paquete', centavos: 3000,  creditos: 150, vinetas_mes: 0 },
  { plan: 'paquete', nombre: '400 créditos', tipo: 'paquete', centavos: 7500,  creditos: 400, vinetas_mes: 0 },
]
const AVISOS = ['payment.succeeded', 'payment.failed', 'subscription.active', 'subscription.renewed', 'subscription.updated',
  'subscription.plan_changed', 'subscription.on_hold', 'subscription.past_due', 'subscription.paused', 'subscription.unpaused',
  'subscription.cancelled', 'subscription.expired', 'subscription.failed', 'refund.succeeded', 'dispute.lost']

async function usuario(req: Request): Promise<{ id: string | null, email: string, interna: boolean }> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { id: null, email: '', interna: false }
  // pruebas del servidor con la llave interna: la cuenta va en la cabecera (nunca llega así desde la página)
  if (INTERNAS.includes(token)) {
    const p = req.headers.get('x-prueba-uid') || ''
    if (!/^[0-9a-f-]{36}$/.test(p)) return { id: null, email: '', interna: true }
    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${p}`, { headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` } })
    const u = r.ok ? await r.json() : null
    return { id: p, email: String(u?.email || ''), interna: true }
  }
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return { id: null, email: '', interna: false }
    const u = await r.json()
    return { id: typeof u?.id === 'string' ? u.id : null, email: String(u?.email || ''), interna: false }
  } catch (_) { return { id: null, email: '', interna: false } }
}

async function tabla(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, { ...opciones,
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) } })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

async function dodo(metodo: string, ruta: string, cuerpo?: unknown) {
  const c = MODOS[MODO]
  if (!c.llave) throw Object.assign(new Error(`Falta la llave ${MODO === 'live' ? 'real' : 'de prueba'} de Dodo en Supabase.`), { status: 500 })
  const r = await fetch(`${c.url}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${c.llave}`, 'Content-Type': 'application/json' },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  })
  const t = await r.text()
  const j = t ? (() => { try { return JSON.parse(t) } catch (_) { return null } })() : null
  if (!r.ok) {
    const e: any = new Error(String(j?.message || j?.code || `Dodo respondió ${r.status}`))
    e.codigo = j?.code; e.status = r.status
    throw e
  }
  return j
}

// los montos de Dodo vienen en centavos y como número (1900 = 19,00)
const plata = (v: unknown) => Math.round(Number(v || 0)) / 100

async function miSuscripcion(user: string) {
  const s = (await tabla(`suscripciones?user_id=eq.${user}&select=plan,estado,price_id,pasarela,dodo_subscription_id,dodo_customer_id`))?.[0]
  if (!s?.dodo_subscription_id || s.pasarela !== 'dodo') throw Object.assign(new Error('No tienes un plan pagado.'), { status: 404 })
  return s
}
async function productoDe(plan: string) {
  const p = (await tabla(`planes?entorno=eq.${ENTORNO}&tipo=eq.plan&plan=eq.${encodeURIComponent(plan)}&select=price_id,nombre`))?.[0]
  if (!p) throw Object.assign(new Error('Ese plan no existe.'), { status: 400 })
  return p
}
const cambioDe = (productId: string) => ({ product_id: productId, quantity: 1, proration_billing_mode: 'prorated_immediately' })
/* Solo se vuelve a Cherry (cherrysweet.app o el computador de desarrollo) */
function volverA(u: unknown) {
  try {
    const x = new URL(String(u || ''))
    if (x.hostname === 'cherrysweet.app' || x.hostname === 'www.cherrysweet.app' || ['localhost', '127.0.0.1'].includes(x.hostname)) return x.toString()
  } catch (_) { /* nada */ }
  return 'https://cherrysweet.app/app.html'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Solo POST' }, 405)
  const { id: user, email, interna } = await usuario(req)
  let b: any = {}
  try { b = await req.json() } catch (_) { /* nada */ }
  const accion = String(b?.accion || '')

  try {
    /* ── Solo con la llave interna ── */
    if (accion.startsWith('admin_')) {
      if (!interna) return responder({ error: 'No' }, 403)
      if (accion === 'admin_productos') {
        const ya = (await tabla(`planes?entorno=eq.${ENTORNO}&select=price_id,nombre`)) || []
        const hechos = []
        for (const p of CATALOGO) {
          if (ya.some((f: any) => f.nombre === p.nombre)) { hechos.push({ nombre: p.nombre, ya: true }); continue }
          const precio = p.tipo === 'plan'
            ? { type: 'recurring_price', price: p.centavos, currency: 'USD', tax_inclusive: false, payment_frequency_count: 1,
                payment_frequency_interval: 'Month', subscription_period_count: 20, subscription_period_interval: 'Year' }
            : { type: 'one_time_price', price: p.centavos, currency: 'USD', tax_inclusive: false }
          const nombre = p.tipo === 'plan' ? `Cherry ${p.nombre}` : `Cherry · ${p.nombre}`
          const d = await dodo('POST', '/products', { name: nombre, tax_category: 'saas', price: precio,
            description: p.tipo === 'plan' ? `Plan ${p.nombre} de Cherry, mensual.` : `${p.creditos} créditos de Cherry. Pago único; no vencen.`,
            metadata: { plan: p.plan, tipo: p.tipo, creditos: String(p.creditos) } })
          await tabla('planes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ price_id: d.product_id, plan: p.plan,
            nombre: p.nombre, vinetas_mes: p.vinetas_mes, entorno: ENTORNO, tipo: p.tipo, creditos: p.creditos }) })
          hechos.push({ nombre: p.nombre, producto: d.product_id })
        }
        return responder({ modo: MODO, hechos })
      }
      if (accion === 'admin_aviso') {
        const url = String(b?.url || '')
        if (!/^https:\/\//.test(url)) return responder({ error: 'Falta la url' }, 400)
        const lista = await dodo('GET', '/webhooks?limit=50')
        const ya = (lista?.data || []).find((w: any) => w.url === url)
        const w = ya || await dodo('POST', '/webhooks', { url, description: 'Cherry · dodo-aviso', filter_types: AVISOS })
        const s = await dodo('GET', `/webhooks/${w.id}/secret`)
        return responder({ modo: MODO, id: w.id, ya: !!ya, eventos: w.filter_types, clave: s?.secret })
      }
      if (accion === 'admin_get') {
        const ruta = String(b?.ruta || '')
        if (!/^\/[a-z_\-\/0-9A-Za-z?=&.]+$/.test(ruta)) return responder({ error: 'Ruta rara' }, 400)
        return responder(await dodo('GET', ruta))
      }
      if (accion === 'admin_ver') {
        if (b?.pago) return responder(await dodo('GET', `/payments/${encodeURIComponent(String(b.pago))}`))
        if (b?.sub) return responder(await dodo('GET', `/subscriptions/${encodeURIComponent(String(b.sub))}`))
        return responder({ error: 'Falta pago o sub' }, 400)
      }
      if (accion === 'admin_devolver') {
        if (MODO !== 'test') return responder({ error: 'Solo en modo de prueba' }, 403)
        const d = await dodo('POST', '/refunds', { payment_id: String(b?.pago || ''), reason: String(b?.motivo || 'prueba de devolución') })
        return responder({ devolucion: d?.refund_id, estado: d?.status, monto: plata(d?.amount) })
      }
      if (accion === 'admin_cancelar') {
        if (MODO !== 'test' || !user) return responder({ error: 'Solo en modo de prueba y con x-prueba-uid' }, 403)
        const s = await miSuscripcion(user)
        const d = await dodo('PATCH', `/subscriptions/${s.dodo_subscription_id}`, b?.ahora ? { status: 'cancelled' } : { cancel_at_next_billing_date: true })
        return responder({ estado: d?.status, al_final: d?.cancel_at_next_billing_date })
      }
      if (accion === 'admin_renovar') {
        if (MODO !== 'test' || !user) return responder({ error: 'Solo en modo de prueba y con x-prueba-uid' }, 403)
        const s = await miSuscripcion(user)
        const cuando = new Date(Date.now() + Math.max(1, Number(b?.minutos) || 2) * 60000).toISOString()
        const d = await dodo('PATCH', `/subscriptions/${s.dodo_subscription_id}`, { next_billing_date: cuando })
        return responder({ proxima: d?.next_billing_date, estado: d?.status })
      }
      return responder({ error: 'Acción desconocida' }, 400)
    }

    if (!user) return responder({ error: 'Inicia sesión otra vez.' }, 401)

    if (accion === 'pagar') {
      const prod = (await tabla(`planes?entorno=eq.${ENTORNO}&price_id=eq.${encodeURIComponent(String(b?.producto || ''))}&select=price_id,plan,nombre,tipo`))?.[0]
      if (!prod) return responder({ error: 'Ese producto no existe.' }, 400)
      const s = (await tabla(`suscripciones?user_id=eq.${user}&select=estado,pasarela,dodo_subscription_id`))?.[0]
      const conPlan = !!(s && s.pasarela === 'dodo' && s.dodo_subscription_id && ['activa', 'en_prueba', 'en_gracia', 'en_mora', 'pausada'].includes(s.estado))
      /* nunca una SEGUNDA suscripción: quien ya tiene plan se cambia de plan (acción «cambiar») */
      if (prod.tipo === 'plan' && conPlan) return responder({ error: 'Ya tienes un plan. Cámbiate desde «Tu plan».' }, 409)
      if (prod.tipo === 'paquete' && !conPlan) return responder({ error: 'Los paquetes de créditos son para quien tiene un plan.' }, 409)
      /* (pruebas) `minimo` con la llave interna: el pago sin ninguna opción, para descartar que una opción sea la que falla */
      const d = interna && b?.minimo ? await dodo('POST', '/checkouts', { product_cart: [{ product_id: prod.price_id, quantity: 1 }],
        ...(email ? { customer: { email } } : {}), metadata: { user_id: user, tipo: prod.tipo, plan: prod.plan }, return_url: volverA(b?.volver) })
      : await dodo('POST', '/checkouts', {
        product_cart: [{ product_id: prod.price_id, quantity: 1 }],
        ...(email ? { customer: { email } } : {}),
        minimal_address: true,
        allowed_payment_method_types: ['credit', 'debit', 'apple_pay', 'google_pay'],
        metadata: { user_id: user, tipo: prod.tipo, plan: prod.plan },
        return_url: volverA(b?.volver),
        customization: { theme: 'light', force_language: 'es', show_order_details: false },
        feature_flags: { allow_discount_code: false, allow_phone_number_collection: false, allow_customer_editing_email: false,
          allow_currency_selection: false },
      })
      if (!d?.checkout_url) throw new Error('Dodo no devolvió el pago.')
      console.log(`[dodo-cuenta] pago abierto · ${user} · ${prod.nombre} · ${d.session_id}`)
      return responder({ checkout_url: d.checkout_url, sesion: d.session_id, modo: MODO })
    }

    if (accion === 'ver_cambio' || accion === 'cambiar') {
      const s = await miSuscripcion(user)
      if (!['activa', 'en_prueba'].includes(s.estado)) return responder({ error: 'Tu plan no está al día. Actualiza tu tarjeta primero.' }, 409)
      const destino = await productoDe(String(b?.plan || ''))
      if (destino.price_id === s.price_id) return responder({ error: 'Ya estás en ese plan.' }, 409)
      if (accion === 'ver_cambio') {
        const v = await dodo('POST', `/subscriptions/${s.dodo_subscription_id}/change-plan/preview`, cambioDe(destino.price_id))
        const r = v?.immediate_charge?.summary || {}
        const hoy = plata(r.total_amount), aFavor = plata(r.customer_credits)
        return responder({
          plan: b.plan, nombre: destino.nombre,
          accion: hoy > 0 ? 'cobra' : aFavor > 0 ? 'abona' : 'nada',
          hoy: hoy > 0 ? hoy : aFavor, moneda: String(r.currency || 'USD'),
          desde: v?.new_plan?.next_billing_date || null,
          mensual: plata(v?.new_plan?.recurring_pre_tax_amount), impuestos_aparte: true,
        })
      }
      /* el cobro del cambio lleva su propia marca, apuntada antes de pedirlo: así el aviso lo reconoce aunque llegue antes */
      const cambio = crypto.randomUUID()
      await tabla('dodo_cambios', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ cambio_id: cambio, user_id: user, plan: b.plan }) })
      await dodo('POST', `/subscriptions/${s.dodo_subscription_id}/change-plan`, { ...cambioDe(destino.price_id), on_payment_failure: 'prevent_change',
        metadata: { user_id: user, tipo: 'cambio', plan: String(b.plan), cambio_id: cambio } })
      console.log(`[dodo-cuenta] ${user} pidió pasarse a ${destino.nombre}`)
      return responder({ ok: true, plan: b.plan, nombre: destino.nombre, cambio })
    }

    /* cómo va un cambio de plan: 'listo' (cobró y cambió), 'fallo' (la tarjeta no pasó; el plan sigue igual) o 'esperando' */
    if (accion === 'estado_cambio') {
      const c = (await tabla(`dodo_cambios?cambio_id=eq.${encodeURIComponent(String(b?.cambio || ''))}&user_id=eq.${user}&select=pago,fallo,plan`))?.[0]
      if (!c) return responder({ error: 'No encontramos ese cambio.' }, 404)
      const s = (await tabla(`suscripciones?user_id=eq.${user}&select=plan`))?.[0]
      return responder({ estado: c.fallo ? 'fallo' : (c.pago && s?.plan === c.plan) ? 'listo' : 'esperando', porque: c.fallo || null })
    }

    if (accion === 'tarjeta') {
      const s = await miSuscripcion(user)
      const d = await dodo('POST', `/subscriptions/${s.dodo_subscription_id}/update-payment-method`, {
        type: 'new', return_url: volverA(b?.volver), allowed_payment_method_types: ['credit', 'debit', 'apple_pay', 'google_pay'] })
      if (!d?.payment_link) throw new Error('Dodo no devolvió el formulario de la tarjeta.')
      console.log(`[dodo-cuenta] ${user} abrió el cambio de tarjeta (${s.estado})`)
      return responder({ link: d.payment_link, estado: s.estado })
    }

    if (accion === 'portal') {
      const s = await miSuscripcion(user)
      if (!s.dodo_customer_id) return responder({ error: 'No encontramos tu cuenta de cliente en Dodo.' }, 404)
      const d = await dodo('POST', `/customers/${s.dodo_customer_id}/customer-portal/session?return_url=${encodeURIComponent(volverA(b?.volver))}`)
      return responder({ general: d?.link || null, cancelar: d?.link || null, tarjeta: d?.link || null })
    }

    if (accion === 'seguir') {
      const s = await miSuscripcion(user)
      await dodo('PATCH', `/subscriptions/${s.dodo_subscription_id}`, { cancel_at_next_billing_date: false })
      console.log(`[dodo-cuenta] ${user} quitó la cancelación`)
      return responder({ ok: true })
    }

    return responder({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    const err: any = e
    console.error(`[dodo-cuenta] ${accion}: ${err?.message || err}`)
    const status = Number(err?.status) || 500
    const pago = /payment|declined|card/i.test(String(err?.message))
    return responder({ error: pago ? 'No se pudo hacer el cobro con tu tarjeta. Revisa tu tarjeta en «Administrar mi suscripción».' : String(err?.message || err) },
      status >= 400 && status < 600 ? status : 500)
  }
})

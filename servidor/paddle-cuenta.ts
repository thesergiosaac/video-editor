// paddle-cuenta v1 (4-oct-2026) — lo que la persona hace con su suscripción DESPUÉS de comprar, desde «Tu plan».
// Lo que decidió Sergio (4-oct): cambiar de plan entra DE UNA y Paddle cobra o abona la diferencia proporcional; cancelar
// deja el plan hasta el final del mes pagado; los impuestos van APARTE del precio.
// Con sesión de usuario. Acciones:
//   · ver_cambio {plan}  → cuánto pagaría HOY por pasarse a ese plan, sin cambiar nada (la «vista previa» de Paddle):
//                          {plan, nombre, accion: 'cobra'|'abona'|'nada', hoy, moneda, desde, mensual}
//   · cambiar {plan}     → lo cambia sobre la MISMA suscripción (nunca una segunda). Si el cobro falla, Paddle no cambia
//                          nada (on_payment_failure: prevent_change). Lo demás lo hace el aviso de vuelta (paddle-aviso).
//   · portal             → las direcciones de la página de cliente de Paddle (cancelar, cambiar la tarjeta, facturas).
//   · seguir             → quita la cancelación programada (sigue con su plan).
// Solo con la llave interna (pruebas en la cuenta de prueba de Paddle):
//   · admin_impuestos {modo: 'external'|'internal'} → pone los 6 precios con los impuestos aparte o adentro.
//   · admin_avisos {agregar?: string[]}             → qué avisos manda Paddle al destino y, si se pide, agrega los que falten.
//   · admin_devolver {txn, motivo}                   → pide la devolución completa de un cobro (para probar las devoluciones).
//   · admin_cancelar {ahora?: boolean}               → cancela la suscripción de la cuenta de x-prueba-uid.
//   · admin_reenviar                                 → Paddle (prueba) vuelve a mandar su último aviso: comprueba que la lista
//                                                      de direcciones de paddle-aviso deja pasar a Paddle de verdad.
// La MUDANZA a la cuenta real (lo que pide Paddle), con la llave real ya guardada por Sergio (PADDLE_API_KEY_LIVE):
//   · admin_migrar                                   → copia los 3 planes y los 3 paquetes de la cuenta de prueba a la real
//                                                      (impuestos aparte) y apunta sus filas en `planes` con entorno 'live'.
//   · admin_destino_real                             → crea en la real el destino de avisos (mismos avisos que la de prueba)
//                                                      y devuelve su clave UNA vez, para guardarla en Supabase.
//   · admin_token_real                               → crea el token del navegador (live_…), que es público.
// La cuenta que usan las acciones de la persona sale del secreto PADDLE_ENTORNO ('live' o, sin él, la de prueba).

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CUENTAS = {
  sandbox: { url: 'https://sandbox-api.paddle.com', llave: Deno.env.get('PADDLE_API_KEY_SANDBOX') ?? '' },
  live: { url: 'https://api.paddle.com', llave: Deno.env.get('PADDLE_API_KEY_LIVE') ?? '' },
}
const ENTORNO: 'sandbox' | 'live' = Deno.env.get('PADDLE_ENTORNO') === 'live' ? 'live' : 'sandbox'
const INTERNAS = [SB_SERVICIO, Deno.env.get('SVC_JWT') || ''].filter(Boolean)
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-prueba-uid',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

async function usuario(req: Request): Promise<{ id: string | null, interna: boolean }> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { id: null, interna: false }
  // pruebas del servidor con la llave interna: la cuenta va en la cabecera (nunca llega así desde la página)
  if (INTERNAS.includes(token)) { const p = req.headers.get('x-prueba-uid') || ''; return { id: /^[0-9a-f-]{36}$/.test(p) ? p : null, interna: true } }
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return { id: null, interna: false }
    const u = await r.json()
    return { id: typeof u?.id === 'string' ? u.id : null, interna: false }
  } catch (_) { return { id: null, interna: false } }
}

async function tabla(ruta: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, { headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` } })
  if (!r.ok) throw new Error(`La base respondió ${r.status}`)
  return await r.json()
}

async function paddle(metodo: string, ruta: string, cuerpo?: unknown, cuenta: 'sandbox' | 'live' = ENTORNO) {
  const c = CUENTAS[cuenta]
  if (!c.llave) throw Object.assign(new Error(`Falta la llave de la cuenta ${cuenta === 'live' ? 'real' : 'de prueba'} de Paddle en Supabase.`), { status: 500 })
  const r = await fetch(`${c.url}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${c.llave}`, 'Content-Type': 'application/json', 'Paddle-Version': '1' },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  })
  const j = await r.json().catch(() => null)
  if (!r.ok) {
    const e: any = new Error(String(j?.error?.detail || j?.error?.code || `Paddle respondió ${r.status}`))
    e.codigo = j?.error?.code; e.status = r.status
    throw e
  }
  return j?.data
}

// los montos de Paddle vienen en centavos y en texto («1520» = 15,20)
const plata = (v: unknown) => Math.round(Number(v || 0)) / 100

async function miSuscripcion(user: string) {
  const s = (await tabla(`suscripciones?user_id=eq.${user}&select=plan,estado,price_id,paddle_subscription_id,paddle_customer_id`))?.[0]
  if (!s?.paddle_subscription_id) throw Object.assign(new Error('No tienes un plan pagado.'), { status: 404 })
  return s
}
async function precioDe(plan: string) {
  const p = (await tabla(`planes?entorno=eq.${ENTORNO}&tipo=eq.plan&plan=eq.${encodeURIComponent(plan)}&select=price_id,nombre`))?.[0]
  if (!p) throw Object.assign(new Error('Ese plan no existe.'), { status: 400 })
  return p
}
const cambioDe = (priceId: string) => ({ items: [{ price_id: priceId, quantity: 1 }], proration_billing_mode: 'prorated_immediately' })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Solo POST' }, 405)
  const { id: user, interna } = await usuario(req)
  let b: any = {}
  try { b = await req.json() } catch (_) { /* nada */ }
  const accion = String(b?.accion || '')

  try {
    /* ── Solo con la llave interna ── */
    if (accion.startsWith('admin_')) {
      if (!interna) return responder({ error: 'No' }, 403)
      if (accion === 'admin_impuestos') {
        const modo = b?.modo === 'internal' ? 'internal' : 'external'
        const precios = (await tabla(`planes?entorno=eq.${ENTORNO}&select=price_id,nombre`)) || []
        const hechos = []
        for (const p of precios) {
          const d = await paddle('PATCH', `/prices/${p.price_id}`, { tax_mode: modo })
          hechos.push({ nombre: p.nombre, tax_mode: d?.tax_mode })
        }
        return responder({ hechos })
      }
      if (accion === 'admin_avisos') {
        const destinos = (await paddle('GET', '/notification-settings')) || []
        const out = []
        for (const d of destinos) {
          let eventos = (d.subscribed_events || []).map((e: any) => e.name)
          const faltan = (b?.agregar || []).filter((e: string) => !eventos.includes(e))
          if (faltan.length) {
            const n = await paddle('PATCH', `/notification-settings/${d.id}`, { subscribed_events: [...eventos, ...faltan] })
            eventos = (n?.subscribed_events || []).map((e: any) => e.name)
          }
          out.push({ id: d.id, destino: d.destination, activo: d.active, eventos, agregados: faltan })
        }
        return responder({ destinos: out })
      }
      if (accion === 'admin_devolver') {
        if (ENTORNO !== 'sandbox') return responder({ error: 'Solo en la cuenta de prueba' }, 403)
        const d = await paddle('POST', '/adjustments', { action: 'refund', type: 'full', transaction_id: String(b?.txn || ''), reason: String(b?.motivo || 'prueba de devolución') })
        return responder({ ajuste: d?.id, estado: d?.status, total: plata(d?.totals?.total) })
      }
      if (accion === 'admin_reenviar') {
        const ult = ((await paddle('GET', '/notifications?per_page=1&order_by=id[DESC]', undefined, 'sandbox')) || [])[0]
        if (!ult) return responder({ error: 'No hay avisos para reenviar' }, 404)
        const d = await paddle('POST', `/notifications/${ult.id}/replay`, {}, 'sandbox')
        return responder({ reenviado: ult.id, tipo: ult.type, nuevo: d?.notification_id || null })
      }
      if (accion === 'admin_migrar') {
        const ya = (await tabla(`planes?entorno=eq.live&select=price_id,nombre`)) || []
        if (ya.length) return responder({ ya: true, planes: ya })
        const filas = (await tabla(`planes?entorno=eq.sandbox&select=*`)) || []
        const mapa: any[] = []
        const productos: Record<string, string> = {}
        for (const f of filas) {
          const pr = await paddle('GET', `/prices/${f.price_id}`, undefined, 'sandbox')
          if (!pr || pr.status !== 'active') continue                                        // lo archivado no se muda
          if (!productos[pr.product_id]) {
            const po = await paddle('GET', `/products/${pr.product_id}`, undefined, 'sandbox')
            const nuevo = await paddle('POST', '/products', { name: po.name, tax_category: po.tax_category, description: po.description || undefined,
              type: po.type || 'standard', image_url: po.image_url || undefined, custom_data: po.custom_data || undefined }, 'live')
            productos[pr.product_id] = nuevo.id
          }
          const np = await paddle('POST', '/prices', { product_id: productos[pr.product_id], description: pr.description, name: pr.name || undefined,
            unit_price: pr.unit_price, billing_cycle: pr.billing_cycle || undefined, trial_period: pr.trial_period || undefined,
            tax_mode: 'external', quantity: pr.quantity || undefined, custom_data: pr.custom_data || undefined }, 'live')
          const fila = { ...f, price_id: np.id, entorno: 'live' }
          const r = await fetch(`${SB_URL}/rest/v1/planes`, { method: 'POST', headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(fila) })
          if (!r.ok) throw new Error(`No se pudo apuntar ${f.nombre} en planes: ${r.status} ${(await r.text()).slice(0, 200)}`)
          mapa.push({ nombre: f.nombre, prueba: f.price_id, real: np.id })
        }
        const descuentos = ((await paddle('GET', '/discounts?status=active', undefined, 'sandbox')) || []).length
        return responder({ mapa, descuentos_en_prueba: descuentos })
      }
      if (accion === 'admin_destino_real') {
        const prueba = ((await paddle('GET', '/notification-settings', undefined, 'sandbox')) || [])[0]
        const eventos = (prueba?.subscribed_events || []).map((e: any) => e.name)
        for (const e of ['adjustment.created', 'adjustment.updated']) if (!eventos.includes(e)) eventos.push(e)
        const ya = ((await paddle('GET', '/notification-settings', undefined, 'live')) || []).find((d: any) => d.destination === prueba?.destination)
        if (ya) return responder({ ya: true, id: ya.id })
        const d = await paddle('POST', '/notification-settings', { description: 'Cherry · paddle-aviso', type: 'url', destination: prueba?.destination,
          subscribed_events: eventos, api_version: 1, include_sensitive_fields: false, traffic_source: 'all' }, 'live')
        return responder({ id: d?.id, eventos: eventos.length, clave: d?.endpoint_secret_key })
      }
      if (accion === 'admin_token_real') {
        const d = await paddle('POST', '/client-tokens', { name: 'Cherry · página', description: 'pagos.js en cherrysweet.app' }, 'live')
        return responder({ token: d?.token, id: d?.id })
      }
      if (accion === 'admin_cancelar') {
        if (ENTORNO !== 'sandbox' || !user) return responder({ error: 'Solo en la cuenta de prueba y con x-prueba-uid' }, 403)
        const s = await miSuscripcion(user)
        const d = await paddle('POST', `/subscriptions/${s.paddle_subscription_id}/cancel`, { effective_from: b?.ahora ? 'immediately' : 'next_billing_period' })
        return responder({ estado: d?.status, cambio: d?.scheduled_change })
      }
      return responder({ error: 'Acción desconocida' }, 400)
    }

    if (!user) return responder({ error: 'Inicia sesión otra vez.' }, 401)

    if (accion === 'ver_cambio' || accion === 'cambiar') {
      const s = await miSuscripcion(user)
      if (!['activa', 'en_prueba'].includes(s.estado)) return responder({ error: 'Tu plan no está al día. Actualiza tu tarjeta primero.' }, 409)
      const destino = await precioDe(String(b?.plan || ''))
      if (destino.price_id === s.price_id) return responder({ error: 'Ya estás en ese plan.' }, 409)
      if (accion === 'ver_cambio') {
        const v = await paddle('PATCH', `/subscriptions/${s.paddle_subscription_id}/preview`, cambioDe(destino.price_id))
        const res = v?.update_summary?.result || {}
        const accionP = String(res.action || '')
        return responder({
          plan: b.plan, nombre: destino.nombre,
          accion: accionP === 'charge' ? 'cobra' : accionP === 'credit' ? 'abona' : 'nada',
          hoy: plata(res.amount), moneda: String(res.currency_code || v?.currency_code || 'USD'),
          desde: v?.next_billed_at || null,
          mensual: plata(v?.recurring_transaction_details?.totals?.total),
        })
      }
      const d = await paddle('PATCH', `/subscriptions/${s.paddle_subscription_id}`, { ...cambioDe(destino.price_id), on_payment_failure: 'prevent_change' })
      console.log(`[paddle-cuenta] ${user} pasó a ${destino.nombre}`)
      return responder({ ok: true, plan: b.plan, nombre: destino.nombre, estado: d?.status })
    }

    if (accion === 'portal') {
      const s = await miSuscripcion(user)
      if (!s.paddle_customer_id) return responder({ error: 'No encontramos tu cuenta de cliente en Paddle.' }, 404)
      const d = await paddle('POST', `/customers/${s.paddle_customer_id}/portal-sessions`, { subscription_ids: [s.paddle_subscription_id] })
      const sub = (d?.urls?.subscriptions || [])[0] || {}
      return responder({ general: d?.urls?.general?.overview || null, cancelar: sub.cancel_subscription || null, tarjeta: sub.update_subscription_payment_method || null })
    }

    if (accion === 'seguir') {
      const s = await miSuscripcion(user)
      await paddle('PATCH', `/subscriptions/${s.paddle_subscription_id}`, { scheduled_change: null })
      console.log(`[paddle-cuenta] ${user} quitó la cancelación`)
      return responder({ ok: true })
    }

    return responder({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    const err: any = e
    console.error(`[paddle-cuenta] ${accion}: ${err?.message || err}`)
    const status = Number(err?.status) || 500
    const pago = err?.codigo === 'subscription_update_transaction_balance_less_than_charge_limit' || /payment|declined/i.test(String(err?.message))
    return responder({ error: pago ? 'No se pudo hacer el cobro con tu tarjeta. Revisa tu tarjeta en «Administrar mi suscripción».' : String(err?.message || err) },
      status >= 400 && status < 600 ? status : 500)
  }
})

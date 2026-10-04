/* paddle-aviso — lo que Paddle nos cuenta cuando alguien paga, renueva o cancela (23-sep-2026)
 *
 * Paddle es el vendedor registrado: cobra, factura y aparece en el extracto del cliente. Nosotros
 * no vemos tarjetas. Lo único que llega aquí es un aviso diciendo qué pasó, y de ese aviso sale
 * si una cuenta entra o no entra.
 *
 * ⚠️ ESTA ES LA PIEZA QUE NO PUEDE FALLAR. Si este aviso se pierde, alguien paga y se queda
 * fuera. De ahí las tres precauciones:
 *
 *   1. LA FIRMA SE COMPRUEBA SIEMPRE. Sin eso, cualquiera que sepa la dirección se regala el plan
 *      Estudio mandando un JSON. Se calcula un HMAC del cuerpo CRUDO, así que el cuerpo se lee
 *      como texto y solo se interpreta después: volver a serializar el JSON cambia un espacio y
 *      la firma ya no cuadra.
 *   2. EL MISMO AVISO DOS VECES NO HACE DAÑO. Paddle reintenta hasta que le respondas 200, y a
 *      veces manda repetido. Cada aviso se apunta por su `event_id` en `paddle_avisos` y el
 *      segundo se ignora.
 *   3. SI ALGO FALLA, SE RESPONDE 500 A PROPÓSITO, para que Paddle lo reintente. El único caso
 *      en que se responde 200 sin hacer nada es cuando el aviso no trae a qué cuenta pertenece:
 *      ahí reintentar no arregla nada y lo que hace falta es mirarlo a mano.
 *
 * Qué NO hace: no toca `vinetas_uso` (lo gastado es lo gastado) y no borra nada. Al perder el
 * plan solo se quita el tope de su plan y la cuenta vuelve al de siempre.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SECRETO = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? ''
/* (4-oct) La cuenta REAL de Paddle tiene su propio destino de avisos con su propia clave. Se aceptan las dos: la de prueba
   sigue sirviendo para probar. La que cuadra dice de qué cuenta es el aviso (y a qué API preguntar). */
const SECRETO_REAL = Deno.env.get('PADDLE_WEBHOOK_SECRET_LIVE') ?? ''
const API = {
  sandbox: { url: 'https://sandbox-api.paddle.com', llave: Deno.env.get('PADDLE_API_KEY_SANDBOX') ?? '' },
  live: { url: 'https://api.paddle.com', llave: Deno.env.get('PADDLE_API_KEY_LIVE') ?? '' },
}
const INTERNAS = [SB_SERVICIO, Deno.env.get('SVC_JWT') || ''].filter(Boolean)

/* (4-oct) Lo pide Paddle para la cuenta real: solo se aceptan avisos que salgan de SUS direcciones. La lista la da Paddle en
   /ips (la real y la de prueba) y puede cambiar: se pide cada hora, nunca se escribe a mano. Si no se pudo traer, decide la
   firma sola: rechazar un pago de verdad por no tener la lista sería peor. Las pruebas de los scripts (con la llave interna)
   no salen de Paddle y pasan por la firma igual. */
let IPS: { cidrs: string[], hasta: number } | null = null
async function ipsDePaddle(): Promise<string[]> {
  if (IPS && IPS.hasta > Date.now()) return IPS.cidrs
  const cidrs: string[] = []
  for (const base of [API.live.url, API.sandbox.url]) {
    try { const j = await (await fetch(`${base}/ips`)).json(); cidrs.push(...(j?.data?.ipv4_cidrs || []).map(String)) } catch (_) { /* sin lista */ }
  }
  if (cidrs.length) IPS = { cidrs, hasta: Date.now() + 3600000 }
  return cidrs
}
const ipNum = (ip: string) => ip.split('.').reduce((a, x) => (a * 256) + (Number(x) & 255), 0)
function dentro(ip: string, cidrs: string[]) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false
  return cidrs.some((c) => {
    const [base, bits] = c.split('/'), b = Number(bits ?? 32)
    const mask = b === 0 ? 0 : (0xFFFFFFFF << (32 - b)) >>> 0
    return ((ipNum(ip) & mask) >>> 0) === ((ipNum(base) & mask) >>> 0)
  })
}

/* Paddle no manda sesión de Supabase: la puerta de esta función es la firma, no un JWT. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, paddle-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/* Una llamada con la llave de servicio, que se salta RLS. Es lo único que escribe estas tablas. */
async function tabla(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`,
      'Content-Type': 'application/json', ...(opciones.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const txt = await r.text()
  return txt ? JSON.parse(txt) : null
}

/* ── La firma ────────────────────────────────────────────────────────────────────────────────
   Paddle manda `Paddle-Signature: ts=1700000000;h1=<hex>`, donde h1 es el HMAC-SHA256 de
   `<ts>:<cuerpo crudo>` con el secreto del destino. */
/* (4-oct) Con cuál de las dos claves cuadra: 'sandbox', 'live' o null */
async function firmaDe(cabecera: string, crudo: string): Promise<'sandbox' | 'live' | null> {
  if (await firmaValida(cabecera, crudo, SECRETO)) return 'sandbox'
  if (SECRETO_REAL && await firmaValida(cabecera, crudo, SECRETO_REAL)) return 'live'
  return null
}
async function firmaValida(cabecera: string, crudo: string, SECRETO: string) {
  if (!SECRETO) { console.error('[paddle-aviso] falta PADDLE_WEBHOOK_SECRET'); return false }
  const partes = Object.fromEntries(
    String(cabecera || '').split(';').map(p => {
      const i = p.indexOf('=')
      return i < 0 ? ['', ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    }))
  const ts = partes.ts, h1 = partes.h1
  if (!ts || !h1) return false

  /* Un aviso de hace horas es un aviso reproducido. Cinco minutos de margen por si los relojes
     no van igual. */
  const edad = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(edad) || edad > 300) {
    console.warn(`[paddle-aviso] aviso viejo o con fecha rara: ${edad}s`)
    return false
  }

  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRETO),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${ts}:${crudo}`))
  const mio = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')

  /* Comparación en tiempo constante: comparar con === deja escapar cuánto acertó quien prueba. */
  if (mio.length !== h1.length) return false
  let dif = 0
  for (let i = 0; i < mio.length; i++) dif |= mio.charCodeAt(i) ^ h1.charCodeAt(i)
  return dif === 0
}

/* ── De lo que dice Paddle a lo que entendemos aquí ──────────────────────────────────────────
   Los estados de Paddle son: active, trialing, past_due, paused, canceled. Se traducen, pero si
   apareciera uno nuevo se guarda tal cual en vez de perderlo: prefiero verlo raro a no verlo. */
const ESTADOS: Record<string, string> = {
  active: 'activa',
  trialing: 'en_prueba',
  past_due: 'en_mora',
  paused: 'pausada',
  canceled: 'cancelada',
}
const AL_DIA = new Set(['activa', 'en_prueba'])

function primerPrecio(d: any): string {
  const it = Array.isArray(d?.items) ? d.items : []
  return String(it[0]?.price?.id || it[0]?.price_id || '')
}

/* A qué cuenta de Cherry pertenece este aviso.
   El camino bueno es `custom_data.user_id`, que se le pone al abrir el pago. Si no viene —un
   cobro creado a mano desde el panel, por ejemplo— se busca por la suscripción que ya
   conocemos. */
async function deQuienEs(d: any): Promise<string> {
  const puesto = d?.custom_data?.user_id
  if (typeof puesto === 'string' && puesto.length === 36) return puesto

  /* (3-oct) un cobro (txn_…) trae su suscripción en `subscription_id`; una suscripción, en `id` */
  for (const sub of [d?.subscription_id, d?.id].map((x: unknown) => String(x || '')).filter(Boolean)) {
    const ya = await tabla(`suscripciones?paddle_subscription_id=eq.${sub}&select=user_id`)
    if (ya?.length) return ya[0].user_id
  }
  const cli = String(d?.customer_id || '')
  if (cli) {
    const ya = await tabla(`suscripciones?paddle_customer_id=eq.${cli}&select=user_id`)
    if (ya?.length) return ya[0].user_id
  }
  return ''
}

/* El tope de viñetas del plan. Al perderlo se quita la fila y la cuenta vuelve al tope de
   siempre: quitarle a alguien lo que ya tenía por dejar de pagar un mes es más castigo del que
   pidió nadie. */
async function ponerTope(user: string, priceId: string, alDia: boolean) {
  if (!alDia) {
    await tabla(`vinetas_tope?user_id=eq.${user}`, { method: 'DELETE' })
    return null
  }
  const pl = await tabla(`planes?price_id=eq.${priceId}&select=plan,vinetas_mes,nombre`)
  if (!pl?.length) {
    console.warn(`[paddle-aviso] precio desconocido: ${priceId}. Añádelo a la tabla «planes».`)
    return null
  }
  await tabla('vinetas_tope?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: user, tope_mes: pl[0].vinetas_mes,
                           nota: `plan ${pl[0].nombre}` }),
  })
  return pl[0]
}

async function atender(tipo: string, d: any) {
  const user = await deQuienEs(d)
  if (!user) {
    console.error(`[paddle-aviso] ${tipo} sin cuenta que lo reclame. ` +
      `sub=${d?.id} cliente=${d?.customer_id}. HAY QUE MIRARLO A MANO.`)
    return { atendido: false, porque: 'sin user_id' }
  }

  const priceId = primerPrecio(d)
  const crudo = String(d?.status || '')
  const estado = ESTADOS[crudo] || crudo || 'sin_plan'
  const alDia = AL_DIA.has(estado)
  const plan = await ponerTope(user, priceId, alDia)
  /* (3-oct) Sin plan al día, los créditos del plan se acaban; los de paquetes siguen (ya los pagó). */
  if (!alDia) await tabla(`creditos?user_id=eq.${user}`, { method: 'PATCH', body: JSON.stringify({ del_plan: 0, actualizado: new Date().toISOString() }) })

  /* Si canceló pero el mes pagado sigue corriendo, `termina_el` dice hasta cuándo entra.
     (4-oct) Solo cuando de verdad termina: antes caía al fin del mes de CUALQUIER suscripción activa, y «Tu plan» no
     podía distinguir «se renueva» de «termina». La vista `mi_plan` lo dice en `cancelado`. */
  const cambio = d?.scheduled_change
  const termina = (cambio?.action === 'cancel' ? cambio?.effective_at : null)
    || (estado === 'cancelada' ? (d?.canceled_at || d?.current_billing_period?.ends_at) : null) || null

  await tabla('suscripciones?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: user,
      plan: alDia && plan ? plan.plan : 'ninguno',
      estado,
      paddle_customer_id: d?.customer_id || null,
      paddle_subscription_id: d?.id || null,
      price_id: priceId || null,
      renueva_el: d?.next_billed_at || null,
      termina_el: termina,
      actualizado: new Date().toISOString(),
    }),
  })

  console.log(`[paddle-aviso] ${tipo} · ${user} · ${estado} · ${plan?.plan || 'sin plan'}`)
  return { atendido: true, user, estado }
}

/* ── (3-oct) Los CRÉDITOS ─────────────────────────────────────────────────────────────────────
   `transaction.completed` = Paddle ya cobró. Si lo cobrado es un PAQUETE, sus créditos se suman a la bolsa «extra»
   (no vencen). Si es un mes de un plan que da créditos (Basic: 20), la bolsa «del plan» VUELVE a ese número.
   La transacción (txn_…) es la llave: `sumar_paquete` y `reponer_plan` la apuntan en `creditos_movimientos` y, si ya
   estaba, no hacen nada. Así un aviso repetido, o uno reintentado después de un error, nunca regala créditos dobles. */
async function rpc(nombre: string, cuerpo: unknown) {
  return await tabla(`rpc/${nombre}`, { method: 'POST', body: JSON.stringify(cuerpo) })
}

async function atenderCobro(d: any) {
  const user = await deQuienEs(d)
  const txn = String(d?.id || '')
  if (!user || !txn) {
    console.error(`[paddle-aviso] cobro ${txn} sin cuenta que lo reclame. cliente=${d?.customer_id}. HAY QUE MIRARLO A MANO.`)
    return { atendido: false, porque: 'sin user_id' }
  }
  const priceId = primerPrecio(d)
  const pl = await tabla(`planes?price_id=eq.${priceId}&select=tipo,plan,nombre,creditos`)
  if (!pl?.length) {
    console.warn(`[paddle-aviso] cobro con precio desconocido: ${priceId}. Añádelo a la tabla «planes».`)
    return { atendido: false, porque: 'precio desconocido' }
  }
  const p = pl[0]
  const cuantos = Math.max(1, Number(d?.items?.[0]?.quantity) || 1)
  if (p.tipo === 'paquete') {
    const nuevo = await rpc('sumar_paquete', { p_user: user, p_llave: txn, p_price: priceId, p_creditos: p.creditos * cuantos })
    console.log(`[paddle-aviso] paquete ${p.nombre} × ${cuantos} · ${user} · ${nuevo ? 'sumado' : 'ya estaba'}`)
    return { atendido: true, user, paquete: p.nombre, nuevo }
  }
  /* (4-oct) Cambiar de plan a mitad de mes (Sergio: «de una, y se cobra o abona la diferencia») genera un cobro con
     origen `subscription_update`: ese NO toca los créditos (se queda con los del mes que ya pagó). Los créditos se
     reponen con el mes nuevo: el primer cobro y cada renovación. Un plan sin créditos (Creator, Studio) también repone,
     en 0: si alguien subió de Basic, sus 20 del mes se le acaban al renovar y no se quedan para siempre. */
  if (String(d?.origin || '') === 'subscription_update') {
    console.log(`[paddle-aviso] cambio de plan a ${p.nombre} · ${user} · los créditos no se tocan`)
    return { atendido: true, user, plan: p.plan, porque: 'cambio de plan a mitad de mes' }
  }
  const nuevo = await rpc('reponer_plan', { p_user: user, p_llave: txn, p_price: priceId, p_creditos: Math.max(0, Number(p.creditos) || 0) })
  console.log(`[paddle-aviso] mes de ${p.nombre} · ${user} · créditos del plan ${nuevo ? 'repuestos (' + p.creditos + ')' : 'ya estaban'}`)
  return { atendido: true, user, plan: p.plan, nuevo }
}

/* ── (4-oct) Las DEVOLUCIONES ──────────────────────────────────────────────────────────────────
   Un ajuste (adj_…) aprobado de tipo devolución o contracargo. Se busca qué dio ese cobro en `creditos_movimientos`:
   un paquete → se quitan sus créditos de la bolsa «extra» (si devuelven parte, la parte proporcional); un mes de plan →
   la bolsa del plan queda en 0. El plan en sí lo apaga la suscripción (si se cancela llega su propio aviso).
   El ajuste es la llave: repetido no quita dos veces. */
async function totalDelCobro(txn: string, cuenta: 'sandbox' | 'live') {
  const a = API[cuenta]
  if (!a.llave) return 0
  const r = await fetch(`${a.url}/transactions/${txn}`, { headers: { Authorization: `Bearer ${a.llave}`, 'Paddle-Version': '1' } })
  if (!r.ok) return 0
  return Number((await r.json())?.data?.details?.totals?.total || 0)
}

async function atenderAjuste(d: any, cuenta: 'sandbox' | 'live') {
  const accion = String(d?.action || ''), estado = String(d?.status || '')
  if (!['refund', 'chargeback'].includes(accion) || estado !== 'approved') return { atendido: false, porque: `ajuste ${accion} ${estado}` }
  const adj = String(d?.id || ''), txn = String(d?.transaction_id || '')
  const mov = (await tabla(`creditos_movimientos?llave=eq.${encodeURIComponent(txn)}&select=user_id,bolsa,cantidad,price_id`))?.[0]
  if (!mov) {
    console.warn(`[paddle-aviso] devolución ${adj} del cobro ${txn}: ese cobro no dio créditos`)
    return { atendido: true, porque: 'el cobro no dio créditos' }
  }
  if (mov.bolsa === 'del_plan') {
    const hecho = await rpc('quitar_mes', { p_user: mov.user_id, p_llave: adj, p_price: mov.price_id })
    console.log(`[paddle-aviso] devolución de un mes · ${mov.user_id} · créditos del plan ${hecho ? 'en 0' : 'ya estaban'}`)
    return { atendido: true, user: mov.user_id, devuelto: 'mes', hecho }
  }
  let quitar = Math.abs(Number(mov.cantidad) || 0)
  if (String(d?.type || 'full') !== 'full') {
    const total = await totalDelCobro(txn, cuenta), devuelto = Number(d?.totals?.total || 0)
    if (!total || !devuelto) {
      console.error(`[paddle-aviso] devolución PARCIAL ${adj} del cobro ${txn}: no supe cuánto era el cobro. HAY QUE MIRARLO A MANO.`)
      return { atendido: false, porque: 'devolución parcial sin el total del cobro' }
    }
    quitar = Math.round(quitar * Math.min(1, devuelto / total))
  }
  const hecho = await rpc('quitar_paquete', { p_user: mov.user_id, p_llave: adj, p_price: mov.price_id, p_creditos: quitar })
  console.log(`[paddle-aviso] devolución de un paquete · ${mov.user_id} · −${quitar} créditos ${hecho ? 'quitados' : 'ya estaban quitados'}`)
  return { atendido: true, user: mov.user_id, devuelto: 'paquete', quitar, hecho }
}

/* Los avisos que cambian el acceso. Los demás se apuntan y se dejan pasar: `transaction.*` no
   decide nada por sí solo —lo que manda es el estado de la suscripción— y llenar la tabla de
   ruido hace más difícil encontrar lo que importa. */
const NOS_IMPORTAN = new Set([
  'subscription.created', 'subscription.activated', 'subscription.updated',
  'subscription.canceled', 'subscription.paused', 'subscription.resumed',
  'subscription.past_due', 'subscription.trialing',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Solo POST', { status: 405, headers: CORS })

  /* ⚠️ El cuerpo CRUDO primero. La firma se calcula sobre estos bytes exactos. */
  const crudo = await req.text()

  /* (4-oct) Primero de dónde viene: solo de las direcciones de Paddle (salvo las pruebas con la llave interna) */
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || ''
  const llave = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!INTERNAS.includes(llave)) {
    const cidrs = await ipsDePaddle()
    if (cidrs.length && !dentro(ip, cidrs)) {
      console.warn(`[paddle-aviso] aviso desde ${ip || 'una dirección desconocida'}, que no es de Paddle: se rechaza`)
      return new Response('No', { status: 403, headers: CORS })
    }
  }

  const cuenta = await firmaDe(req.headers.get('Paddle-Signature') || '', crudo)
  if (!cuenta) {
    console.warn('[paddle-aviso] firma que no cuadra: se rechaza')
    return new Response('Firma inválida', { status: 401, headers: CORS })
  }

  let aviso: any
  try { aviso = JSON.parse(crudo) } catch {
    return new Response('JSON ilegible', { status: 400, headers: CORS })
  }

  const id = String(aviso?.event_id || '')
  const tipo = String(aviso?.event_type || '')

  try {
    /* Ya atendido: se responde 200 para que Paddle deje de reintentar, y no se toca nada. */
    if (id) {
      const ya = await tabla(`paddle_avisos?event_id=eq.${id}&select=event_id`)
      if (ya?.length) {
        console.log(`[paddle-aviso] ${tipo} repetido (${id}): no se hace nada`)
        return new Response(JSON.stringify({ ok: true, repetido: true }),
          { headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    const r = tipo === 'transaction.completed'
      ? await atenderCobro(aviso?.data || {})
      : tipo === 'adjustment.created' || tipo === 'adjustment.updated'
        ? await atenderAjuste(aviso?.data || {}, cuenta)
      : NOS_IMPORTAN.has(tipo)
        ? await atender(tipo, aviso?.data || {})
        : { atendido: false, porque: 'no cambia el acceso' }

    /* Se apunta DESPUÉS de atenderlo: si lo de arriba revienta, el aviso queda sin apuntar y el
       reintento de Paddle vuelve a intentarlo. Apuntarlo antes sería perderlo. */
    if (id) {
      await tabla('paddle_avisos?on_conflict=event_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ event_id: id, tipo, cuerpo: aviso }),
      })
    }

    return new Response(JSON.stringify({ ok: true, ...r }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (e) {
    /* 500 a propósito: Paddle lo reintenta durante horas y así no se pierde un pago. */
    console.error(`[paddle-aviso] ${tipo} falló: ${e instanceof Error ? e.message : e}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})

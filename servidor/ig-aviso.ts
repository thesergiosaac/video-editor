/* ig-aviso — lo que Instagram nos cuenta cuando alguien comenta (23-sep-2026)
 *
 * Alguien comenta «guía» en una publicación y esta función le manda el mensaje que el dueño de la
 * cuenta dejó configurado. Es lo que hace ManyChat, y es la razón de pedirle a Meta los permisos
 * de comentarios y mensajes.
 *
 * ⚠️ HAY UN RELOJ CORRIENDO. Instagram solo deja mandar UNA respuesta privada por comentario, y
 * solo durante una ventana desde que se comentó. Por eso esto responde en el momento, no en un
 * repaso nocturno: lo que se atiende tarde ya no se puede atender.
 *
 * Dos puertas, las dos en la misma dirección:
 *
 *   GET   · la comprobación de Meta al guardar el webhook. Devuelve el `hub.challenge` si el
 *           `hub.verify_token` coincide con el nuestro. Sin esto Meta no acepta la dirección.
 *   POST  · el aviso de verdad. Firmado con el secreto de la app, en `X-Hub-Signature-256`.
 *
 * ⚠️ LA FIRMA SE COMPRUEBA SOBRE EL CUERPO CRUDO, igual que en `paddle-aviso`. Volver a
 * serializar el JSON cambia un espacio y la firma deja de cuadrar.
 *
 * ⚠️ Y SE RESPONDE 200 CASI SIEMPRE, a propósito, que es lo contrario de lo que hace Paddle.
 * Meta desactiva un webhook que falla repetidamente, y con él se cae la función entera para todos
 * los usuarios. Un comentario perdido es un comentario; un webhook desactivado son todos. Así que
 * los fallos se apuntan en `respuestas_comentario` y se miran ahí, no se le devuelven a Meta.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const IG_SECRETO = Deno.env.get('IG_APP_SECRET') ?? ''
/* Lo escoge uno y se pega igual en Meta. No es una llave suya: es una contraseña compartida para
   que nadie más pueda dar de alta esta dirección como si fuera nuestra. */
const IG_VERIFICAR = Deno.env.get('IG_VERIFY_TOKEN') ?? ''

const GRAFO = 'https://graph.instagram.com/v23.0'

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

/* ── La firma de Meta ────────────────────────────────────────────────────────────────────────
   `X-Hub-Signature-256: sha256=<hex>`, que es el HMAC del cuerpo crudo con el secreto de la app. */
async function firmaValida(cabecera: string, crudo: string) {
  if (!IG_SECRETO) { console.error('[ig-aviso] falta IG_APP_SECRET'); return false }
  const esperado = String(cabecera || '').replace(/^sha256=/, '').trim()
  if (!esperado) return false

  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(IG_SECRETO),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(crudo))
  const mio = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')

  if (mio.length !== esperado.length) return false
  let dif = 0
  for (let i = 0; i < mio.length; i++) dif |= mio.charCodeAt(i) ^ esperado.charCodeAt(i)
  return dif === 0
}

/* ── Buscar la regla que aplica ──────────────────────────────────────────────────────────────
   Gana la más específica: una regla puesta para ESA publicación manda sobre una regla general de
   la cuenta. Así se puede tener «guía» para todo y «descuento» solo en el reel del martes.

   La comparación es por palabra suelta, sin tildes y sin mayúsculas: quien comenta escribe
   «GUIA!!», «guía» o «Guia porfa», y las tres tienen que valer. */
const llano = (t: string) => String(t || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()

function laQueAplica(reglas: any[], mediaId: string, texto: string) {
  const dicho = ` ${llano(texto)} `
  const casan = reglas.filter(r => dicho.includes(` ${llano(r.palabra)} `))
  if (!casan.length) return null
  return casan.find(r => r.media_id && r.media_id === mediaId) || casan.find(r => !r.media_id) || null
}

/* ── Contestar ───────────────────────────────────────────────────────────────────────────────
   La respuesta privada va dirigida al COMENTARIO, no a la persona. Es lo que permite escribirle
   a alguien con quien no había conversación abierta. */
async function responderPrivado(igUserId: string, token: string, commentId: string, mensaje: string) {
  const r = await fetch(`${GRAFO}/${igUserId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: mensaje } }),
  })
  const txt = await r.text()
  return { ok: r.ok, detalle: txt.slice(0, 400) }
}

/* Y, si él lo pidió, también una respuesta pública debajo del comentario. Que la haya visto
   contestar en público es parte del truco: los demás ven que responde. */
async function responderPublico(token: string, commentId: string, mensaje: string) {
  const r = await fetch(`${GRAFO}/${commentId}/replies`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: mensaje }),
  })
  return { ok: r.ok, detalle: (await r.text()).slice(0, 400) }
}

async function apuntar(fila: Record<string, unknown>) {
  try {
    await tabla('respuestas_comentario?on_conflict=comment_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(fila),
    })
  } catch (e) {
    console.error('[ig-aviso] no se pudo apuntar:', e instanceof Error ? e.message : e)
  }
}

async function atenderComentario(igUserId: string, c: any) {
  const commentId = String(c?.id || '')
  const texto = String(c?.text || '')
  const mediaId = String(c?.media?.id || '')
  const deQuien = String(c?.from?.id || '')
  if (!commentId || !texto) return

  /* ⚠️ Cuando el dueño de la cuenta contesta a alguien, Instagram nos avisa igual. Sin esto,
     Cherry se respondería a sí misma. */
  if (deQuien && deQuien === igUserId) return

  /* Ya atendido: Meta reenvía el mismo aviso si tardamos, y la segunda respuesta privada no solo
     falla, cuenta como queja contra la cuenta. */
  const ya = await tabla(`respuestas_comentario?comment_id=eq.${commentId}&select=comment_id`)
  if (ya?.length) return

  const cuenta = await tabla(`cuentas_instagram?ig_user_id=eq.${igUserId}` +
    `&estado=eq.activa&select=user_id,token`)
  if (!cuenta?.length) {
    console.warn(`[ig-aviso] llega un comentario de ${igUserId} y esa cuenta no está conectada`)
    return
  }
  const { user_id, token } = cuenta[0]

  const reglas = await tabla(`reglas_comentario?ig_user_id=eq.${igUserId}&activa=is.true` +
    `&select=id,media_id,palabra,mensaje,responder_publico`)
  const regla = laQueAplica(reglas || [], mediaId, texto)
  if (!regla) return

  const priv = await responderPrivado(igUserId, token, commentId, regla.mensaje)
  if (regla.responder_publico) {
    await responderPublico(token, commentId, regla.responder_publico)
  }

  await apuntar({
    comment_id: commentId, regla_id: regla.id, user_id, ig_user_id: igUserId,
    resultado: priv.ok ? 'enviado' : 'fallido',
    detalle: priv.ok ? null : priv.detalle,
  })
  console.log(`[ig-aviso] ${igUserId} · «${regla.palabra}» · ${priv.ok ? 'enviado' : 'FALLÓ: ' + priv.detalle}`)
}

Deno.serve(async (req) => {
  const u = new URL(req.url)

  /* ── La comprobación de Meta al guardar la dirección ── */
  if (req.method === 'GET') {
    const modo = u.searchParams.get('hub.mode')
    const reto = u.searchParams.get('hub.challenge')
    const ficha = u.searchParams.get('hub.verify_token')
    if (modo === 'subscribe' && ficha && IG_VERIFICAR && ficha === IG_VERIFICAR) {
      console.log('[ig-aviso] Meta comprobó la dirección y cuadró')
      return new Response(reto ?? '', { headers: { 'Content-Type': 'text/plain' } })
    }
    console.warn('[ig-aviso] comprobación rechazada: la contraseña no cuadra')
    return new Response('No', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Solo GET o POST', { status: 405 })

  const crudo = await req.text()
  if (!await firmaValida(req.headers.get('X-Hub-Signature-256') || '', crudo)) {
    console.warn('[ig-aviso] firma que no cuadra: se rechaza')
    return new Response('Firma inválida', { status: 401 })
  }

  try {
    const aviso = JSON.parse(crudo)
    for (const entrada of (aviso?.entry || [])) {
      const igUserId = String(entrada?.id || '')
      for (const cambio of (entrada?.changes || [])) {
        if (cambio?.field === 'comments') await atenderComentario(igUserId, cambio?.value)
      }
    }
  } catch (e) {
    /* ⚠️ Se traga el error y responde 200 igualmente. Meta desactiva los webhooks que fallan, y
       eso apagaría la función para TODOS. El fallo queda en el registro. */
    console.error('[ig-aviso] falló atendiendo el aviso:', e instanceof Error ? e.message : e)
  }

  return new Response('ok', { headers: { 'Content-Type': 'text/plain' } })
})

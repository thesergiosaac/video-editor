/* ig-aviso v3 — lo que Instagram nos cuenta cuando alguien comenta (23-sep-2026)
 *
 * v3 (24-sep-2026) · LOS FLUJOS. Sergio quiso una interfaz tipo ManyChat en lienzo (el diseño de OpenReply, MIT):
 * pasos unidos con líneas en herramientas/respuestas.html, guardados en `flujos_respuesta`. Aquí se ejecutan:
 *   · un COMENTARIO con la palabra → se crea una ejecución (una por comentario y flujo) y se recorre el flujo:
 *     «contestar en público» → «mensaje» (el primero va como RESPUESTA PRIVADA al comentario, con sus botones) …
 *   · al TOCAR un botón (messaging_postbacks, payload CH:<ejecución>:<paso>:<botón>) se abre la conversación y
 *     el flujo sigue por la línea de ese botón: más mensajes, «¿te sigue?» (is_user_follow_business), «esperar»…
 *   · un MENSAJE DIRECTO con la palabra (si el flujo lo permite) arranca el flujo con la conversación ya abierta.
 *   · «esperar» deja la ejecución dormida; el reloj (?reloj, cada minuto) la despierta.
 * ⚠️ Reglas de Instagram: UNA respuesta privada por comentario; lo demás solo con la conversación abierta (la
 * persona tocó un botón o escribió) y dentro de 24 h. Botones: máximo 3, títulos de 20 caracteres.
 * ⚠️ Tope propio: TOPE_HORA mensajes automáticos por cuenta y hora (Instagram corta cerca de 200).
 * Prueba sin mandar nada: POST ?prueba=1 con la llave interna → no llama a Instagram, apunta lo que habría mandado.
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
const LLAVE_RELOJ = Deno.env.get('IG_RELOJ_SECRETO') ?? ''
const INTERNAS = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v) as string[]
/* (25-sep) El botón lleva a cherrysweet.app/ir/ y esa página cuenta el clic (función `ir`) y redirige. Antes el enlace
   decía supabase.co: una dirección rara es lo primero que miran los filtros de spam de Instagram y el revisor de Meta. */
const IR = 'https://cherrysweet.app/ir/?e='
const TOPE_HORA = 180
const MAX_PASOS = 25
/* ── Contra el spam (25-sep) ──
   · Una vez por persona: quien ya recibió una respuesta no la vuelve a recibir aunque comente la palabra otra vez.
   · Palabra para salir: quien escribe «stop», «basta», «no más»… no vuelve a recibir nada automático de esa cuenta.
   · Respuestas públicas espaciadas: más de TOPE_PUBLICAS en una hora y se omiten (el mensaje privado sí sale).
     Muchos comentarios iguales en pocos minutos es lo que Instagram marca como spam en la cuenta. */
const TOPE_PUBLICAS = 60
const PALABRAS_SALIR = ['stop', 'basta', 'no mas', 'no mas gracias', 'ya no', 'ya no mas', 'no quiero', 'no quiero mas',
  'no me escribas', 'no me escribas mas', 'parar', 'detener', 'cancelar', 'baja', 'darme de baja', 'unsubscribe']

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

async function reglaVieja(igUserId: string, c: any) {
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


/* ══════════════════════ LOS FLUJOS (v3) ══════════════════════ */
type Ctx = { flujo: any, ej: any, token: string, igUserId: string, seco: boolean, sigueSeco?: boolean }

const ahoraISO = () => new Date().toISOString()
function apuntarPaso(ctx: Ctx, paso: Record<string, unknown>) {
  ctx.ej.pasos = [...(ctx.ej.pasos || []), { t: ahoraISO(), ...paso }].slice(-60)
}
async function guardarEj(ctx: Ctx) {
  const e = ctx.ej
  await tabla(`ejecuciones_flujo?id=eq.${e.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ estado: e.estado, nodo: e.nodo ?? null, despertar: e.despertar ?? null, abierta: !!e.abierta,
      privada: !!e.privada, persona_id: e.persona_id ?? null, persona_usuario: e.persona_usuario ?? null,
      ultima_interaccion: e.ultima_interaccion ?? null, pasos: e.pasos || [], publica: !!e.publica, actualizada: ahoraISO() }),
  })
}

/* Instagram (o, en prueba, solo apuntar lo que se habría mandado) */
async function igLlamar(ctx: Ctx, metodo: string, ruta: string, cuerpo?: unknown): Promise<{ ok: boolean, j: any, detalle?: string }> {
  if (ctx.seco) {
    apuntarPaso(ctx, { seco: true, metodo, ruta, cuerpo })
    if (ruta.includes('is_user_follow_business')) return { ok: true, j: { is_user_follow_business: ctx.sigueSeco !== false } }
    return { ok: true, j: { id: 'seco', message_id: 'seco', recipient_id: 'seco' } }
  }
  const r = await fetch(`${GRAFO}/${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${ctx.token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  })
  const t = await r.text()
  let j: any = null
  try { j = JSON.parse(t) } catch (_) { /* no es JSON */ }
  return { ok: r.ok, j, detalle: r.ok ? undefined : t.slice(0, 300) }
}

const nodoDe = (f: any, id: string) => (f.grafo?.nodos || []).find((x: any) => x.id === id) || null
const siguiente = (f: any, id: string, p: string) => {
  const l = (f.grafo?.lineas || []).find((x: any) => x.de === id && x.p === p)
  return l ? nodoDe(f, l.a) : null
}
const disparadorDe = (f: any) => (f.grafo?.nodos || []).find((x: any) => x.tipo === 'disparador') || null
const conUsuario = (t: string, u: string) => String(t || '').replace(/\{usuario\}/g, u || '').replace(/[ \t]{2,}/g, ' ').trim()

async function hex(t: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
/* Un botón con enlace pasa por la función `ir`, que cuenta el clic */
async function enlaceContado(ctx: Ctx, nodo: any, i: number, url: string) {
  const id = (await hex(ctx.flujo.id + ':' + nodo.id + ':' + i)).slice(0, 14)
  await tabla('enlaces_flujo?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, flujo_id: ctx.flujo.id, user_id: ctx.flujo.user_id, nodo: nodo.id, boton: i, url }),
  })
  return IR + id
}
async function mensajeDe(ctx: Ctx, nodo: any) {
  const texto = conUsuario(nodo.d?.texto || '', ctx.ej.persona_usuario || '')
  const botones = (nodo.d?.botones || []).map((b: any, i: number) => ({ ...b, i })).filter((b: any) => String(b.t || '').trim()).slice(0, 3)
  if (!botones.length) return { text: (texto || '👋').slice(0, 1000) }
  const buttons = []
  for (const b of botones) {
    if (b.url && /^https?:\/\//.test(b.url)) buttons.push({ type: 'web_url', url: await enlaceContado(ctx, nodo, b.i, b.url), title: String(b.t).slice(0, 20) })
    else buttons.push({ type: 'postback', title: String(b.t).slice(0, 20), payload: `CH:${ctx.ej.id}:${nodo.id}:${b.i}` })
  }
  return { attachment: { type: 'template', payload: { template_type: 'button', text: (texto || '👇').slice(0, 640), buttons } } }
}

/* ── (26-sep) A quien no te sigue ──
   Instagram no deja mandar un mensaje CON BOTONES como respuesta privada a quien no sigue la cuenta (error 1545133).
   Con CEREZA, a 14 de 51 no les llegó nada: justo a los que no te conocían. En ese caso se manda el mismo contenido en
   texto: el saludo del mensaje (sin la frase que pide tocar el botón) y lo que venía detrás del botón, con sus enlaces
   escritos. En «¿Te sigue?» se toma «no»: si Instagram lo rechazó por eso, es que no te sigue. */
const NO_TE_SIGUE = 1545133
const esNoTeSigue = (r: { j?: any, detalle?: string }) =>
  Number(r?.j?.error?.error_subcode) === NO_TE_SIGUE || String(r?.detalle || '').includes(String(NO_TE_SIGUE))
function sinPedirToque(t: string) {
  // fuera las frases que piden tocar un botón que en texto no existe
  return String(t || '').split(/(?<=[.!?…])\s+/).filter((f) => !/\b(toca|tócalo|tocá|pulsa|presiona|dale clic|haz clic|botón|boton)\b/i.test(f)).join(' ').trim()
}
async function textoPlano(ctx: Ctx, nodo: any) {
  const f = ctx.flujo, u = ctx.ej.persona_usuario || ''
  const partes: string[] = []
  const enlaces = async (nd: any) => {
    const ls: string[] = []
    for (const [i, b] of (nd.d?.botones || []).entries()) {
      if (String(b?.t || '').trim() && b.url && /^https?:\/\//.test(b.url)) ls.push(String(b.t).trim() + ': ' + await enlaceContado(ctx, nd, i, b.url))
    }
    return ls
  }
  const saludo = conUsuario(sinPedirToque(nodo.d?.texto || ''), u)
  const propios = await enlaces(nodo)
  if (saludo || propios.length) partes.push([saludo, ...propios].filter(Boolean).join('\n'))
  // lo que venía detrás del primer botón que seguía el flujo
  const i0 = (nodo.d?.botones || []).findIndex((b: any) => String(b?.t || '').trim() && !b.url)
  let x = i0 >= 0 ? siguiente(f, nodo.id, 'b' + i0) : null, vueltas = 0
  while (x && vueltas++ < 12) {
    if (x.tipo === 'sigue') { x = siguiente(f, x.id, 'no') || siguiente(f, x.id, 'si'); continue }
    if (x.tipo === 'mensaje') {
      const t = conUsuario(sinPedirToque(x.d?.texto || ''), u)
      const ls = await enlaces(x)
      if (t || ls.length) partes.push([t, ...ls].filter(Boolean).join('\n'))
      const j = (x.d?.botones || []).findIndex((b: any) => String(b?.t || '').trim() && !b.url)
      x = j >= 0 ? siguiente(f, x.id, 'b' + j) : siguiente(f, x.id, 'sig'); continue
    }
    if (x.tipo === 'espera' || x.tipo === 'publico' || x.tipo === 'disparador') { x = siguiente(f, x.id, 'sig'); continue }
    break
  }
  return partes.join('\n\n').slice(0, 1000) || '👋'
}

const enc = encodeURIComponent
async function deBaja(igUserId: string, personaId: string) {
  if (!personaId) return false
  const r = await tabla(`bajas_respuestas?ig_user_id=eq.${enc(igUserId)}&persona_id=eq.${enc(personaId)}&select=persona_id&limit=1`)
  return !!r?.length
}
/* ¿Esta persona ya pasó por esta respuesta? (las que fallaron no cuentan: no recibió nada) */
async function yaLaRecibio(flujoId: string, personaId: string, usuario: string) {
  const o = [personaId && `persona_id.eq.${enc(personaId)}`, usuario && `persona_usuario.eq."${enc(usuario)}"`].filter(Boolean)
  if (!o.length) return false
  const r = await tabla(`ejecuciones_flujo?flujo_id=eq.${flujoId}&estado=neq.fallida&or=(${o.join(',')})&select=id&limit=1`)
  return !!r?.length
}
async function muchasPublicas(igUserId: string) {
  const desde = new Date(Date.now() - 3600000).toISOString()
  const r = await fetch(`${SB_URL}/rest/v1/ejecuciones_flujo?ig_user_id=eq.${enc(igUserId)}&publica=is.true&creada=gte.${desde}&select=id`, {
    method: 'HEAD', headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, Prefer: 'count=exact' },
  })
  return Number((r.headers.get('content-range') || '').split('/')[1] || 0) >= TOPE_PUBLICAS
}
/* Escribió «stop»: se apunta, se cierran sus conversaciones abiertas y se le confirma UNA vez. Solo si Cherry le había
   escrito alguna vez desde esta cuenta; un «stop» de alguien a quien nunca se le escribió no es para Cherry. */
async function darDeBaja(igUserId: string, quien: string, seco: boolean) {
  const suyas = (await tabla(`ejecuciones_flujo?ig_user_id=eq.${enc(igUserId)}&persona_id=eq.${enc(quien)}&select=id,estado,pasos`)) || []
  if (!suyas.length) return
  await tabla('bajas_respuestas?on_conflict=ig_user_id,persona_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ ig_user_id: igUserId, persona_id: quien }),
  })
  for (const e of suyas.filter((x: any) => ['en_curso', 'esperando_toque', 'esperando_tiempo'].includes(x.estado))) {
    await tabla(`ejecuciones_flujo?id=eq.${e.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: 'terminada', despertar: null, actualizada: ahoraISO(),
        pasos: [...(e.pasos || []), { t: ahoraISO(), tipo: 'baja', detalle: 'pidió que no le escribieran' }].slice(-60) }),
    })
  }
  if (!seco) {
    const cuenta = await cuentaDe(igUserId)
    if (cuenta) await fetch(`${GRAFO}/${igUserId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${cuenta.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: quien }, message: { text: 'Listo, no te vuelvo a escribir de forma automática.' } }),
    }).catch(() => null)
  }
  console.log(`[ig-aviso] ${igUserId}: ${quien} pidió que no le escribieran${seco ? ' (prueba)' : ''}`)
}

/* Recorre el flujo desde la salida `puerto` del paso `desdeId` hasta que haya que esperar o se acabe */
async function avanzar(ctx: Ctx, desdeId: string, puerto: string) {
  const f = ctx.flujo, ej = ctx.ej
  let n = siguiente(f, desdeId, puerto), pasos = 0, esperaToque = false
  if (ej.persona_id && await deBaja(ctx.igUserId, ej.persona_id)) {
    ej.estado = 'terminada'; ej.despertar = null
    apuntarPaso(ctx, { tipo: 'fin', detalle: 'la persona pidió que no le escribieran' })
    await guardarEj(ctx); return
  }
  ej.estado = 'en_curso'; ej.despertar = null
  while (n && pasos++ < MAX_PASOS) {
    if (n.tipo === 'disparador') { n = siguiente(f, n.id, 'sig'); continue }
    if (n.tipo === 'publico') {
      if (ej.comentario_id) {
        const vs = (n.d?.respuestas || []).map((x: string) => String(x || '').trim()).filter(Boolean)
        if (vs.length && await muchasPublicas(ctx.igUserId)) {
          apuntarPaso(ctx, { nodo: n.id, tipo: 'publico', omitida: true, detalle: `más de ${TOPE_PUBLICAS} respuestas públicas en una hora: esta se omite` })
        } else if (vs.length) {
          const r = await igLlamar(ctx, 'POST', `${ej.comentario_id}/replies`, { message: conUsuario(vs[Math.floor(Math.random() * vs.length)], ej.persona_usuario).slice(0, 2200) })
          apuntarPaso(ctx, { nodo: n.id, tipo: 'publico', ok: r.ok, detalle: r.detalle })
          if (r.ok) ej.publica = true
        }
      }
      n = siguiente(f, n.id, 'sig'); continue
    }
    if (n.tipo === 'mensaje') {
      const destino = ej.abierta && ej.persona_id ? { id: ej.persona_id } : (!ej.privada && ej.comentario_id ? { comment_id: ej.comentario_id } : null)
      if (!destino) {
        apuntarPaso(ctx, { nodo: n.id, tipo: 'mensaje', ok: false, detalle: 'Instagram no deja mandarlo: la persona todavía no ha tocado un botón.' })
        break
      }
      const r = await igLlamar(ctx, 'POST', `${ctx.igUserId}/messages`, { recipient: destino, message: await mensajeDe(ctx, n) })
      apuntarPaso(ctx, { nodo: n.id, tipo: 'mensaje', via: destino.comment_id ? 'comentario' : 'conversacion', ok: r.ok, detalle: r.detalle })
      if (!r.ok && destino.comment_id && esNoTeSigue(r)) {
        // (26-sep) no te sigue: el mismo contenido en texto, con los enlaces escritos
        const r2 = await igLlamar(ctx, 'POST', `${ctx.igUserId}/messages`, { recipient: destino, message: { text: await textoPlano(ctx, n) } })
        apuntarPaso(ctx, { nodo: n.id, tipo: 'mensaje', via: 'comentario', texto_plano: true, ok: r2.ok,
          detalle: r2.ok ? 'no te sigue: se mandó en texto, con los enlaces' : r2.detalle })
        if (r2.ok) {
          ej.privada = true; ej.nodo = n.id
          if (r2.j?.recipient_id && r2.j.recipient_id !== 'seco' && !ej.persona_id) ej.persona_id = r2.j.recipient_id
          ej.estado = 'terminada'; await guardarEj(ctx); return
        }
      }
      if (!r.ok) {
        ej.estado = 'fallida'; ej.nodo = n.id
        // (26-sep) no le llegó: se le pide en público que confirme; lo que responda le trae el mensaje (entregarPendiente)
        if (destino.comment_id && !await muchasPublicas(ctx.igUserId)) {
          const rp = await igLlamar(ctx, 'POST', `${destino.comment_id}/replies`, { message: conUsuario(CONFIRMA, ej.persona_usuario || '') })
          apuntarPaso(ctx, { tipo: 'publico', pedido_de_nuevo: true, ok: rp.ok, detalle: rp.ok ? 'no le llegó: se le pidió en público que confirme' : rp.detalle })
        }
        await guardarEj(ctx); return
      }
      if (destino.comment_id) ej.privada = true
      if (r.j?.recipient_id && r.j.recipient_id !== 'seco' && !ej.persona_id) ej.persona_id = r.j.recipient_id
      ej.nodo = n.id
      if ((n.d?.botones || []).some((b: any) => String(b.t || '').trim() && !b.url)) esperaToque = true
      const despues = siguiente(f, n.id, 'sig')
      if (despues && ej.abierta) { n = despues; continue }
      break
    }
    if (n.tipo === 'sigue') {
      let sigue = true
      if (ej.abierta && ej.persona_id) {
        const r = await igLlamar(ctx, 'GET', `${ej.persona_id}?fields=is_user_follow_business`)
        if (r.ok && typeof r.j?.is_user_follow_business === 'boolean') sigue = r.j.is_user_follow_business
        apuntarPaso(ctx, { nodo: n.id, tipo: 'sigue', sigue, ok: r.ok, detalle: r.detalle })
      } else apuntarPaso(ctx, { nodo: n.id, tipo: 'sigue', sigue, detalle: 'sin conversación: se toma el camino «sí»' })
      ej.nodo = n.id
      n = siguiente(f, n.id, sigue ? 'si' : 'no'); continue
    }
    if (n.tipo === 'espera') {
      const min = Math.max(1, Math.min(1440, Number(n.d?.minutos) || 1))
      ej.estado = 'esperando_tiempo'; ej.nodo = n.id; ej.despertar = new Date(Date.now() + min * 60000).toISOString()
      apuntarPaso(ctx, { nodo: n.id, tipo: 'espera', minutos: min })
      await guardarEj(ctx); return
    }
    n = null
  }
  ej.estado = esperaToque ? 'esperando_toque' : 'terminada'
  await guardarEj(ctx)
}

async function cuentaDe(igUserId: string) {
  const c = await tabla(`cuentas_instagram?ig_user_id=eq.${encodeURIComponent(igUserId)}&estado=eq.activa&select=user_id,token`)
  return c?.[0] || null
}
async function hayTope(igUserId: string) {
  const desde = new Date(Date.now() - 3600000).toISOString()
  const r = await fetch(`${SB_URL}/rest/v1/ejecuciones_flujo?ig_user_id=eq.${encodeURIComponent(igUserId)}&creada=gte.${desde}&select=id`, {
    method: 'HEAD', headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, Prefer: 'count=exact' },
  })
  const n = Number((r.headers.get('content-range') || '').split('/')[1] || 0)
  return n >= TOPE_HORA
}
const casaPalabra = (f: any, texto: string) => {
  if (f.cualquiera) return true
  const dicho = ` ${llano(texto)} `
  return (f.palabras || []).some((p: string) => llano(p) && dicho.includes(` ${llano(p)} `))
}
async function nuevaEjecucion(fila: Record<string, unknown>) {
  const r = await tabla('ejecuciones_flujo?on_conflict=flujo_id,comentario_id', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(fila),
  }).catch(async (e) => {
    // el índice único es parcial (solo con comentario): si choca, es que ya se atendió
    if (/duplicate|23505|409/.test(String(e))) return []
    throw e
  })
  return Array.isArray(r) && r[0] ? r[0] : null
}

/* Un comentario: ¿algún flujo activo lo toma? Gana el de ESA publicación, luego «la próxima», luego «cualquiera» */
async function flujoParaComentario(ctx0: { token: string, seco: boolean }, igUserId: string, mediaId: string, texto: string) {
  const fs = (await tabla(`flujos_respuesta?ig_user_id=eq.${encodeURIComponent(igUserId)}&activa=is.true&select=*`)) || []
  const casan = fs.filter((f: any) => casaPalabra(f, texto))
  const exacto = casan.find((f: any) => (f.donde === 'una' || f.donde === 'proxima') && f.media_id && f.media_id === mediaId)
  if (exacto) return exacto
  for (const f of casan.filter((x: any) => x.donde === 'proxima' && !x.media_id)) {
    // «la próxima que publiques»: la primera publicación hecha DESPUÉS de activar el flujo se queda con él
    let nueva = ctx0.seco
    if (!ctx0.seco) {
      const r = await fetch(`${GRAFO}/${mediaId}?fields=timestamp`, { headers: { Authorization: `Bearer ${ctx0.token}` } })
      const j = await r.json().catch(() => null)
      nueva = !!(j?.timestamp && new Date(j.timestamp).getTime() > new Date(f.activada || f.creado).getTime())
    }
    if (nueva) {
      await tabla(`flujos_respuesta?id=eq.${f.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ media_id: mediaId }) })
      return { ...f, media_id: mediaId }
    }
  }
  return casan.find((f: any) => f.donde === 'todas') || null
}

/* (26-sep) Una respuesta que no le llegó a alguien se le entrega en cuanto vuelva a comentar en la misma
   publicación, diga lo que diga. Instagram deja UNA respuesta privada por comentario: el comentario nuevo abre otra. */
const CONFIRMA = '@{usuario} Te escribí por privado 📩 Confírmame aquí si te llegó; si no, te lo envío de nuevo.'
async function entregarPendiente(cuenta: any, igUserId: string, mediaId: string, commentId: string, quien: string, usuario: string, texto: string, seco: boolean) {
  const o = [quien && `persona_id.eq.${enc(quien)}`, usuario && `persona_usuario.eq."${enc(usuario)}"`].filter(Boolean)
  if (!o.length || !mediaId) return false
  const pend = (await tabla(`ejecuciones_flujo?ig_user_id=eq.${enc(igUserId)}&estado=eq.fallida&or=(${o.join(',')})&select=*&order=creada.desc&limit=5`)) || []
  for (const ej of pend) {
    if (String((ej.pasos || [])[0]?.media || '') !== mediaId || ej.comentario_id === commentId) continue
    const flujo = (await tabla(`flujos_respuesta?id=eq.${ej.flujo_id}&select=*`))?.[0]
    if (!flujo || !flujo.activa) continue
    if (quien && await deBaja(igUserId, quien)) return true
    const ctx: Ctx = { flujo, ej, token: cuenta.token, igUserId, seco }
    const nodo = nodoDe(flujo, ej.nodo) || nodoDe(flujo, ((ej.pasos || []).filter((p: any) => p.tipo === 'mensaje').slice(-1)[0] || {}).nodo)
    if (!nodo) continue
    apuntarPaso(ctx, { tipo: 'comentario', texto: texto.slice(0, 200), media: mediaId, volvio: true })
    const r = await igLlamar(ctx, 'POST', `${igUserId}/messages`, { recipient: { comment_id: commentId }, message: { text: await textoPlano(ctx, nodo) } })
    apuntarPaso(ctx, { nodo: nodo.id, tipo: 'mensaje', via: 'comentario', texto_plano: true, ok: r.ok,
      detalle: r.ok ? 'volvió a comentar: se le mandó en texto, con los enlaces' : r.detalle })
    if (r.ok) {
      ej.estado = 'terminada'; ej.privada = true
      if (r.j?.recipient_id && r.j.recipient_id !== 'seco' && !ej.persona_id) ej.persona_id = r.j.recipient_id
    }
    if (!seco) await guardarEj(ctx)
    else console.log('[ig-aviso] (prueba) ' + JSON.stringify((ej.pasos || []).slice(-2)).slice(0, 900))
    console.log(`[ig-aviso] «${flujo.nombre}» · @${usuario || quien} volvió a comentar · ${r.ok ? 'entregada' : 'otra vez falló'}${seco ? ' (prueba)' : ''}`)
    if (r.ok) return true
  }
  return false
}

async function atenderComentario(igUserId: string, c: any, seco = false) {
  const commentId = String(c?.id || c?.comment_id || '')
  const texto = String(c?.text || '')
  const mediaId = String(c?.media?.id || c?.media_id || '')
  const deQuien = String(c?.from?.id || '')
  const deUsuario = String(c?.from?.username || '')
  if (!commentId || !texto) return
  if (deQuien && deQuien === igUserId) return                                  // el dueño contestando: no
  const cuenta = await cuentaDe(igUserId)
  if (!cuenta) { console.warn(`[ig-aviso] comentario de ${igUserId}: esa cuenta no está conectada`); return }
  // (26-sep) primero: ¿le debemos una respuesta que no le llegó en esta publicación?
  if (await entregarPendiente(cuenta, igUserId, mediaId, commentId, deQuien, deUsuario, texto, seco)) return
  const flujo = await flujoParaComentario({ token: cuenta.token, seco }, igUserId, mediaId, texto)
  if (!flujo) return await reglaVieja(igUserId, c)
  if (await deBaja(igUserId, deQuien)) return
  if (await yaLaRecibio(flujo.id, deQuien, deUsuario)) { console.log(`[ig-aviso] «${flujo.nombre}»: @${deUsuario || deQuien} ya la recibió, no se repite`); return }
  if (!seco && await hayTope(igUserId)) { console.warn(`[ig-aviso] ${igUserId}: tope de ${TOPE_HORA}/hora, se deja pasar`); return }
  const disp = disparadorDe(flujo)
  if (!disp) return
  const ej = await nuevaEjecucion({ flujo_id: flujo.id, user_id: flujo.user_id, ig_user_id: igUserId, persona_id: deQuien || null,
    persona_usuario: deUsuario || null, comentario_id: commentId, origen: 'comentario', estado: 'en_curso', pasos: [] })
  if (!ej) return                                                               // ya se atendió
  const ctx: Ctx = { flujo, ej, token: cuenta.token, igUserId, seco }
  apuntarPaso(ctx, { tipo: 'comentario', texto: texto.slice(0, 200), media: mediaId })
  await avanzar(ctx, disp.id, 'sig')
  console.log(`[ig-aviso] flujo «${flujo.nombre}» · @${deUsuario || deQuien} · ${ej.estado}${seco ? ' (prueba)' : ''}`)
}

/* Tocó un botón: la conversación queda abierta y el flujo sigue por la línea de ese botón */
async function atenderToque(igUserId: string, m: any, seco = false, sigueSeco?: boolean) {
  const payload = String(m?.postback?.payload || '')
  const quien = String(m?.sender?.id || '')
  const k = /^CH:([0-9a-f-]{36}):([^:]+):(\d+)$/.exec(payload)
  if (!k || !quien) return
  const ej = (await tabla(`ejecuciones_flujo?id=eq.${k[1]}&ig_user_id=eq.${encodeURIComponent(igUserId)}&select=*`))?.[0]
  if (!ej) return
  /* (25-sep) El mismo botón, otra vez: no se repite. Instagram deja el botón a la vista y la gente lo toca varias veces;
     @nandy_manzano recibió el enlace tres veces por tocar tres veces «Quiero verlo». */
  if ((ej.pasos || []).some((p: any) => p.tipo === 'toque' && p.nodo === k[2] && Number(p.boton) === Number(k[3]))) {
    console.log(`[ig-aviso] ${ej.persona_usuario || quien} tocó otra vez «${String(m?.postback?.title || '').slice(0, 30)}»: no se repite`)
    return
  }
  const flujo = (await tabla(`flujos_respuesta?id=eq.${ej.flujo_id}&select=*`))?.[0]
  const cuenta = await cuentaDe(igUserId)
  if (!flujo || !cuenta) return
  ej.abierta = true; ej.persona_id = quien; ej.ultima_interaccion = ahoraISO()
  const ctx: Ctx = { flujo, ej, token: cuenta.token, igUserId, seco, sigueSeco }
  apuntarPaso(ctx, { tipo: 'toque', nodo: k[2], boton: Number(k[3]), titulo: String(m?.postback?.title || '').slice(0, 40) })
  await avanzar(ctx, k[2], 'b' + k[3])
}

/* Un mensaje directo: si algún flujo lo permite y casa la palabra, arranca con la conversación abierta */
async function atenderMensaje(igUserId: string, m: any, seco = false) {
  const msg = m?.message
  if (!msg || msg.is_echo || msg.is_deleted) return
  const quien = String(m?.sender?.id || '')
  const texto = String(msg.text || '')
  if (!quien || !texto || quien === igUserId) return
  if (PALABRAS_SALIR.includes(llano(texto))) return await darDeBaja(igUserId, quien, seco)
  if (await deBaja(igUserId, quien)) return
  const fs = (await tabla(`flujos_respuesta?ig_user_id=eq.${encodeURIComponent(igUserId)}&activa=is.true&por_dm=is.true&select=*`)) || []
  const flujo = fs.find((f: any) => casaPalabra(f, texto))
  if (!flujo) return
  // una vez por persona (25-sep; antes, una vez cada 12 h)
  if (await yaLaRecibio(flujo.id, quien, '')) return
  const cuenta = await cuentaDe(igUserId)
  if (!cuenta || (!seco && await hayTope(igUserId))) return
  const disp = disparadorDe(flujo)
  if (!disp) return
  let usuario = ''
  if (!seco) {
    try { const r = await fetch(`${GRAFO}/${quien}?fields=username`, { headers: { Authorization: `Bearer ${cuenta.token}` } }); usuario = String((await r.json())?.username || '') } catch (_) { /* sin nombre */ }
  }
  const ej = await nuevaEjecucion({ flujo_id: flujo.id, user_id: flujo.user_id, ig_user_id: igUserId, persona_id: quien, persona_usuario: usuario || null,
    origen: 'mensaje', estado: 'en_curso', abierta: true, ultima_interaccion: ahoraISO(), pasos: [] })
  if (!ej) return
  const ctx: Ctx = { flujo, ej, token: cuenta.token, igUserId, seco }
  apuntarPaso(ctx, { tipo: 'mensaje_recibido', texto: texto.slice(0, 200) })
  await avanzar(ctx, disp.id, 'sig')
}

/* (26-sep) Reintenta en texto las que fallaron porque la persona no sigue la cuenta. Solo con la llave interna.
   La respuesta privada a un comentario vale hasta 7 días, y la que falló no cuenta como enviada. */
async function reintentarNoSigue(flujoId: string, seco: boolean) {
  const flujo = (await tabla(`flujos_respuesta?id=eq.${enc(flujoId)}&select=*`))?.[0]
  if (!flujo) return { error: 'no existe ese flujo' }
  const cuenta = await cuentaDe(flujo.ig_user_id)
  if (!cuenta?.token) return { error: 'la cuenta no está conectada' }
  const fallidas = (await tabla(`ejecuciones_flujo?flujo_id=eq.${enc(flujoId)}&estado=eq.fallida&select=*&order=creada.asc&limit=100`)) || []
  const hechas: any[] = []
  /* Cada comentario admite UNA respuesta privada, y el intento con botón pudo gastarla (error 2534025). Si la persona
     volvió a comentar (p. ej. «no me llegó nada»), ese comentario nuevo sirve: se buscan sus otros comentarios en la
     publicación y las respuestas debajo del suyo, del más nuevo al más viejo. */
  const tokenIG = cuenta.token
  const listar = async (ruta: string) => {
    const out: any[] = []
    let url: string | null = `${GRAFO}/${ruta}${ruta.includes('?') ? '&' : '?'}fields=id,from,username,timestamp,text&limit=50&access_token=${tokenIG}`
    for (let k = 0; url && k < 12; k++) {
      const r = await fetch(url); const j = await r.json().catch(() => null)
      if (!r.ok || !j) break
      out.push(...(j.data || [])); url = j.paging?.next || null
    }
    return out
  }
  const delMedio: Record<string, any[]> = {}
  const otrosDe = async (ej: any) => {
    const media = String((ej.pasos || [])[0]?.media || flujo.media_id || '')
    if (media && !delMedio[media]) delMedio[media] = await listar(`${media}/comments`)
    const u = String(ej.persona_usuario || '').toLowerCase()
    const respuestas = await listar(`${ej.comentario_id}/replies`)
    return [...(delMedio[media] || []), ...respuestas]
      // ⚠️ el autor viene en `from` (con acceso estándar `username` sale vacío para los demás)
      .filter((c: any) => (String(c.from?.username || c.username || '').toLowerCase() === u || (ej.persona_id && c.from?.id === ej.persona_id)) && c.id !== ej.comentario_id)
      .sort((a: any, b: any) => String(b.timestamp).localeCompare(String(a.timestamp)))
  }
  for (const ej of fallidas) {
    const ultimo = (ej.pasos || []).slice(-1)[0] || {}
    const porSeguir = String(ultimo.detalle || '').includes(String(NO_TE_SIGUE))
    const gastado = String(ultimo.detalle || '').includes('2534025')
    if ((!porSeguir && !gastado) || !ej.comentario_id) continue
    if (Date.now() - new Date(ej.creada).getTime() > 7 * 24 * 3600000) { hechas.push({ usuario: ej.persona_usuario, ok: false, detalle: 'pasaron 7 días' }); continue }
    const ctx: Ctx = { flujo, ej, token: cuenta.token, igUserId: flujo.ig_user_id, seco }
    const n = nodoDe(flujo, ultimo.nodo || ej.nodo)
    if (!n) continue
    if (ej.persona_id && await deBaja(flujo.ig_user_id, ej.persona_id)) { hechas.push({ usuario: ej.persona_usuario, ok: false, detalle: 'pidió que no le escribieran' }); continue }
    const texto = await textoPlano(ctx, n)
    // primero su comentario original (si no se gastó); si no, sus otros comentarios, del más nuevo al más viejo
    const candidatos = [...(gastado ? [] : [ej.comentario_id]), ...(await otrosDe(ej)).map((c: any) => c.id)]
    let r: any = { ok: false, detalle: 'no hay otro comentario suyo donde contestarle' }, usado = ''
    for (const cid of candidatos) {
      r = await igLlamar(ctx, 'POST', `${flujo.ig_user_id}/messages`, { recipient: { comment_id: cid }, message: { text: texto } })
      if (r.ok) { usado = cid; break }
    }
    apuntarPaso(ctx, { nodo: n.id, tipo: 'mensaje', via: 'comentario', texto_plano: true, reintento: true, ok: r.ok, comentario: usado || undefined,
      detalle: r.ok ? 'no te sigue: se reenvió en texto, con los enlaces' + (usado !== ej.comentario_id ? ' (en otro comentario suyo)' : '') : r.detalle })
    if (r.ok && !seco) {
      ej.privada = true; ej.estado = 'terminada'
      if (r.j?.recipient_id && !ej.persona_id) ej.persona_id = r.j.recipient_id
    }
    if (!seco) await guardarEj(ctx)
    hechas.push({ usuario: ej.persona_usuario, ok: r.ok, detalle: r.ok ? (seco ? 'prueba' : 'enviado') : r.detalle, texto: seco ? texto : undefined })
  }
  return { flujo: flujo.nombre, intentadas: hechas.length, enviadas: hechas.filter((x) => x.ok).length, hechas }
}

/* El reloj: despierta los «esperar» vencidos (dentro de las 24 h de la conversación) */
async function reloj() {
  const vencidas = (await tabla(`ejecuciones_flujo?estado=eq.esperando_tiempo&despertar=lte.${ahoraISO()}&select=*&limit=30`)) || []
  let hechas = 0
  for (const ej of vencidas) {
    try {
      const flujo = (await tabla(`flujos_respuesta?id=eq.${ej.flujo_id}&select=*`))?.[0]
      const cuenta = await cuentaDe(ej.ig_user_id)
      const ctx: Ctx = { flujo, ej, token: cuenta?.token || '', igUserId: ej.ig_user_id, seco: false }
      if (!flujo || !cuenta || !flujo.activa) { ej.estado = 'terminada'; apuntarPaso(ctx, { tipo: 'fin', detalle: 'flujo pausado o cuenta desconectada' }); await guardarEj(ctx); continue }
      if (ej.ultima_interaccion && Date.now() - new Date(ej.ultima_interaccion).getTime() > 24 * 3600000) {
        ej.estado = 'terminada'; apuntarPaso(ctx, { tipo: 'fin', detalle: 'pasaron 24 h: Instagram ya no deja escribirle' }); await guardarEj(ctx); continue
      }
      await avanzar(ctx, ej.nodo, 'sig'); hechas++
    } catch (e) { console.error('[ig-aviso] reloj:', e instanceof Error ? e.message : e) }
  }
  return { despertadas: hechas }
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
  const llave = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

  /* El reloj de «esperar» (cada minuto) */
  if (u.searchParams.get('reloj')) {
    let b: any = {}
    try { b = JSON.parse(crudo) } catch (_) { /* nada */ }
    if (!LLAVE_RELOJ || String(b?.llave || '') !== LLAVE_RELOJ) return new Response('No', { status: 403 })
    return new Response(JSON.stringify(await reloj()), { headers: { 'Content-Type': 'application/json' } })
  }

  /* (26-sep) Reintentar en texto las que fallaron porque no te siguen (solo con la llave interna; ?seco=1 no manda nada) */
  if (u.searchParams.get('reintentar')) {
    if (!INTERNAS.includes(llave)) return new Response('No', { status: 403 })
    let b: any = {}
    try { b = JSON.parse(crudo) } catch (_) { /* nada */ }
    const out = await reintentarNoSigue(String(b?.flujo_id || ''), u.searchParams.get('seco') === '1')
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } })
  }

  /* Prueba sin mandar nada (solo con la llave interna): el mismo aviso de Meta, pero apuntando lo que se habría mandado */
  const seco = u.searchParams.get('prueba') === '1'
  if (seco) {
    if (!INTERNAS.includes(llave)) return new Response('No', { status: 403 })
    const aviso = JSON.parse(crudo)
    for (const entrada of (aviso?.entry || [])) {
      const igUserId = String(entrada?.id || '')
      for (const cambio of (entrada?.changes || [])) if (cambio?.field === 'comments') await atenderComentario(igUserId, cambio?.value, true)
      for (const m of (entrada?.messaging || [])) {
        if (m?.postback) await atenderToque(igUserId, m, true, aviso?.sigue !== false)
        else if (m?.message) await atenderMensaje(igUserId, m, true)
      }
    }
    return new Response('ok')
  }

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
      // v3: los toques de botón y los mensajes directos
      for (const m of (entrada?.messaging || [])) {
        try {
          if (m?.postback) await atenderToque(igUserId, m)
          else if (m?.message) await atenderMensaje(igUserId, m)
        } catch (e) { console.error('[ig-aviso] mensajería:', e instanceof Error ? e.message : e) }
      }
    }
  } catch (e) {
    /* ⚠️ Se traga el error y responde 200 igualmente. Meta desactiva los webhooks que fallan, y
       eso apagaría la función para TODOS. El fallo queda en el registro. */
    console.error('[ig-aviso] falló atendiendo el aviso:', e instanceof Error ? e.message : e)
  }

  return new Response('ok', { headers: { 'Content-Type': 'text/plain' } })
})

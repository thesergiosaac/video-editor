/* ig-conectar — «Conectar Instagram» de verdad (24-sep-2026)
 *
 * Hasta hoy las cuentas se conectaban A MANO desde el panel de Meta (un token generado ahí y pegado
 * en la base). Eso sirve para la cuenta de Sergio, pero ningún cliente podría conectar la suya, y es
 * lo PRIMERO que el revisor de Meta tiene que ver en el video de la revisión: la persona toca
 * «Conectar Instagram», entra con su Instagram, acepta los permisos y vuelve a Cherry.
 *
 * Camino: «Instagram API con inicio de sesión de Instagram» (la app de Instagram 945011301459783,
 * ver docs/LANZAMIENTO.md). ⚠️ Los permisos son los `instagram_business_*`: los `instagram_*` sin
 * «business» son del camino con Facebook y exigen una página enganchada.
 *
 * Puertas (todas en esta misma dirección, que es la que se registra en Meta):
 *   POST {accion:'enlace', marca?, volver?}  · con sesión → la dirección de Instagram a la que se manda a la persona
 *   GET  ?code=…&state=…                     · la vuelta de Instagram: cambia el código por la llave de 60 días,
 *                                              guarda la cuenta, la suscribe a los avisos y devuelve a Cherry
 *   GET  ?error=…                            · canceló: vuelve a Cherry diciéndolo
 *   POST {accion:'refrescar', llave}         · el reloj diario: renueva las llaves antes de que venzan (60 días)
 *   POST {accion:'suscribir'}                · con sesión: vuelve a pedirle a Instagram los avisos de SUS cuentas
 *                                              (comentarios, mensajes y toques de botón). Lo llama la pantalla de
 *                                              respuestas automáticas al activar un flujo.
 *   POST ?aviso=desautorizar (signed_request)· Meta avisa que quitó a Cherry desde Instagram: se corta
 *   POST ?aviso=borrar (signed_request)      · Meta pide borrar lo de esa cuenta: se borra y se devuelve el código
 *
 * ⚠️ La llave de Instagram es tan delicada como una contraseña: solo vive en `cuentas_instagram`, que el
 * navegador no puede leer (ver servidor/base/12-instagram.sql).
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const IG_APP_ID = Deno.env.get('IG_APP_ID') ?? ''
const IG_SECRETO = Deno.env.get('IG_APP_SECRET') ?? ''
const LLAVE_RELOJ = Deno.env.get('IG_RELOJ_SECRETO') ?? ''

const VUELTA = `${SB_URL}/functions/v1/ig-conectar`      // ⚠️ idéntica a la registrada en Meta (OAuth redirect URIs)
const SITIO = 'https://cherrysweet.app/'
const GRAFO = 'https://graph.instagram.com/v23.0'
/* Lo que se le pide a la persona. Los cinco que usa Cherry: perfil, publicar, estadísticas, comentarios y el mensaje
   privado. ⚠️ Mientras Meta no apruebe uno, solo lo pueden conceder las cuentas con rol en la app. */
const PERMISOS = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
]
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const enc = new TextEncoder()

async function tabla(ruta: string, op: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...op,
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json', ...(op.headers || {}) },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

async function quienEs(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } })
  if (!r.ok) return null
  const u = await r.json().catch(() => null)
  return typeof u?.id === 'string' ? u.id : null
}

/* ── El «state»: quién pidió conectar, firmado (así nadie puede colgar su Instagram en la cuenta de otro) ── */
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const desdeB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
async function hmac(datos: string | Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', enc.encode(IG_SECRETO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, typeof datos === 'string' ? enc.encode(datos) : datos))
}
async function firmarEstado(o: Record<string, unknown>) {
  const p = b64url(enc.encode(JSON.stringify(o)))
  return p + '.' + b64url(await hmac(p))
}
async function leerEstado(s: string): Promise<any | null> {
  const [p, f] = String(s || '').split('.')
  if (!p || !f || b64url(await hmac(p)) !== f) return null
  try {
    const o = JSON.parse(new TextDecoder().decode(desdeB64url(p)))
    return Date.now() - Number(o.t) < 30 * 60 * 1000 ? o : null      // media hora para entrar y aceptar
  } catch (_) { return null }
}
/* A dónde se vuelve: solo páginas de Cherry */
const volverA = (v: unknown) => /^(app\.html|herramientas\/[a-z-]+\.html)$/.test(String(v || '')) ? String(v) : 'app.html'
const redirigir = (url: string) => new Response(null, { status: 302, headers: { Location: url } })

/* Los avisos que Cherry le pide a Instagram de cada cuenta: los comentarios, los mensajes y los toques de botón
   (messaging_postbacks: sin él, el «Quiero el acceso» de un flujo no llega). ⚠️ Además hay que tenerlos marcados en el
   panel de Meta (Webhooks → Instagram), si no, Instagram no manda nada aunque la cuenta esté suscrita. */
const AVISOS = 'comments,messages,messaging_postbacks'
const suscribir = (token: string) => ig(`me/subscribed_apps?subscribed_fields=${AVISOS}&access_token=${encodeURIComponent(token)}`, { method: 'POST' })

/* ── El signed_request de Meta (desautorizar / borrar datos) ── */
async function leerSignedRequest(req: Request): Promise<any | null> {
  const f = await req.formData().catch(() => null)
  const sr = String(f?.get('signed_request') || '')
  const [firma, carga] = sr.split('.')
  if (!firma || !carga) return null
  if (b64url(await hmac(carga)) !== firma) return null
  try { return JSON.parse(new TextDecoder().decode(desdeB64url(carga))) } catch (_) { return null }
}

async function ig(ruta: string, op: RequestInit = {}) {
  const r = await fetch(ruta.startsWith('http') ? ruta : `${GRAFO}/${ruta}`, op)
  const t = await r.text()
  let j: any = null
  try { j = JSON.parse(t) } catch (_) { /* no es JSON */ }
  if (!r.ok) throw new Error((j?.error?.message || j?.error_message || t).slice(0, 300))
  return j
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
  const u = new URL(req.url)

  try {
    /* ── Meta: alguien quitó a Cherry desde su Instagram ── */
    const aviso = u.searchParams.get('aviso')
    if (aviso === 'desautorizar' || aviso === 'borrar') {
      const d = await leerSignedRequest(req)
      if (!d?.user_id) return responder({ error: 'firma inválida' }, 400)
      const igu = String(d.user_id)
      await tabla(`cuentas_instagram?ig_user_id=eq.${encodeURIComponent(igu)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'revocada', token: 'revocado' }),
      })
      await tabla(`publicaciones_programadas?ig_user_id=eq.${encodeURIComponent(igu)}&estado=eq.programada`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'cancelada', error: 'Se quitó el permiso de Cherry desde Instagram.' }),
      }).catch(() => null)
      console.log(`[ig-conectar] ${aviso}: ${igu}`)
      if (aviso === 'desautorizar') return responder({ ok: true })
      // borrar: lo que Cherry trajo de esa cuenta
      for (const t of ['ejecuciones_flujo', 'flujos_respuesta', 'reglas_comentario', 'respuestas_comentario', 'metricas_instagram', 'publicaciones_instagram']) {
        await tabla(`${t}?ig_user_id=eq.${encodeURIComponent(igu)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null)
      }
      await tabla(`cuentas_instagram?ig_user_id=eq.${encodeURIComponent(igu)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null)
      const codigo = 'CH' + b64url(await hmac('borrar:' + igu + ':' + Date.now())).slice(0, 12)
      return responder({ url: SITIO + 'privacidad.html#borrar', confirmation_code: codigo })
    }

    /* ── La vuelta de Instagram ── */
    if (req.method === 'GET') {
      const est = await leerEstado(u.searchParams.get('state') || '')
      const volver = SITIO + volverA(est?.v)
      if (u.searchParams.get('error')) return redirigir(volver + '?instagram=cancelado')
      const code = String(u.searchParams.get('code') || '').replace(/#_$/, '')
      if (!est?.u || !code) return redirigir(volver + '?instagram=error')

      // 1. el código por una llave corta
      const f = new URLSearchParams({ client_id: IG_APP_ID, client_secret: IG_SECRETO, grant_type: 'authorization_code', redirect_uri: VUELTA, code })
      const corta = await ig('https://api.instagram.com/oauth/access_token', { method: 'POST', body: f })
      const c0 = Array.isArray(corta?.data) ? corta.data[0] : corta
      if (!c0?.access_token) throw new Error('Instagram no dio la llave.')
      // 2. la corta por la de 60 días
      const larga = await ig(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(IG_SECRETO)}&access_token=${encodeURIComponent(c0.access_token)}`)
      const token = larga?.access_token || c0.access_token
      const vence = new Date(Date.now() + (Number(larga?.expires_in) || 3600) * 1000).toISOString()
      // 3. de quién es
      const yo = await ig(`me?fields=user_id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website,account_type&access_token=${encodeURIComponent(token)}`)
      const igu = String(yo?.user_id || c0.user_id || '')
      if (!igu) throw new Error('Instagram no dijo qué cuenta es.')
      await tabla('cuentas_instagram?on_conflict=user_id,ig_user_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: est.u, ig_user_id: igu, usuario: yo.username || null, nombre: yo.name || null, nombre_real: yo.name || null,
          foto: yo.profile_picture_url || null, bio: yo.biography || null, web: yo.website || null,
          seguidores: yo.followers_count ?? null, seguidos: yo.follows_count ?? null, publicaciones: yo.media_count ?? null,
          token, token_vence: vence, refrescado: new Date().toISOString(), estado: 'activa', conectada: new Date().toISOString(),
          perfil_visto: new Date().toISOString(),
          ...(est.m ? { marca: String(est.m).slice(0, 60) } : {}),
        }),
      })
      // 4. que Instagram nos avise de sus comentarios y mensajes (para las respuestas automáticas)
      try { await suscribir(token) }
      catch (e) { console.warn(`[ig-conectar] ${igu}: sin avisos todavía (${String(e).slice(0, 120)})`) }
      console.log(`[ig-conectar] conectada @${yo.username} (${igu}) para ${String(est.u).slice(0, 8)}`)
      return redirigir(volver + '?instagram=ok&cuenta=' + encodeURIComponent(yo.username || ''))
    }

    const b = await req.json().catch(() => ({}))

    /* ── El reloj diario: las llaves duran 60 días; se renuevan cuando les quedan menos de 20 ── */
    if (b?.accion === 'refrescar') {
      const esServicio = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') === SB_SERVICIO
      if (!esServicio && (!LLAVE_RELOJ || String(b.llave || '') !== LLAVE_RELOJ)) return responder({ error: 'No' }, 403)
      const limite = new Date(Date.now() + 20 * 86400000).toISOString()
      const cuentas = await tabla(`cuentas_instagram?estado=eq.activa&token_vence=lt.${limite}&select=user_id,ig_user_id,usuario,token,refrescado`)
      const hecho: string[] = [], mal: string[] = []
      for (const c of (cuentas || [])) {
        // Instagram solo renueva llaves de más de 24 horas
        if (c.refrescado && Date.now() - new Date(c.refrescado).getTime() < 24 * 3600000) continue
        try {
          const r = await ig(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.token)}`)
          await tabla(`cuentas_instagram?user_id=eq.${c.user_id}&ig_user_id=eq.${c.ig_user_id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ token: r.access_token, token_vence: new Date(Date.now() + Number(r.expires_in) * 1000).toISOString(), refrescado: new Date().toISOString() }),
          })
          hecho.push(c.usuario || c.ig_user_id)
        } catch (e) {
          mal.push((c.usuario || c.ig_user_id) + ': ' + String(e).slice(0, 120))
          if (/expired|invalid|OAuth/i.test(String(e))) {
            await tabla(`cuentas_instagram?user_id=eq.${c.user_id}&ig_user_id=eq.${c.ig_user_id}`, {
              method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'caducada' }),
            }).catch(() => null)
          }
        }
      }
      console.log(`[ig-conectar] refrescadas ${hecho.length}${mal.length ? ' · fallas: ' + mal.join(' | ') : ''}`)
      return responder({ refrescadas: hecho, fallas: mal })
    }

    /* ── Volver a pedir los avisos de las cuentas de la persona (al activar una respuesta automática) ── */
    if (b?.accion === 'suscribir') {
      const user = await quienEs(req)
      if (!user) return responder({ error: 'Inicia sesión en Cherry.' }, 401)
      const cuentas = await tabla(`cuentas_instagram?user_id=eq.${user}&estado=eq.activa&select=ig_user_id,usuario,token`)
      const hecho: string[] = [], mal: string[] = []
      for (const c of (cuentas || [])) {
        try { await suscribir(c.token); hecho.push(c.usuario || c.ig_user_id) }
        catch (e) { mal.push((c.usuario || c.ig_user_id) + ': ' + String(e).slice(0, 120)) }
      }
      return responder({ suscritas: hecho, fallas: mal })
    }

    /* ── La dirección a la que se manda a la persona ── */
    if (b?.accion === 'enlace') {
      const user = await quienEs(req)
      if (!user) return responder({ error: 'Inicia sesión en Cherry.' }, 401)
      if (!IG_APP_ID || !IG_SECRETO) return responder({ error: 'Falta configurar la app de Instagram.' }, 500)
      const state = await firmarEstado({ u: user, m: b.marca ? String(b.marca).slice(0, 60) : null, v: volverA(b.volver), t: Date.now() })
      const q = new URLSearchParams({ force_reauth: 'true', client_id: IG_APP_ID, redirect_uri: VUELTA, response_type: 'code', scope: PERMISOS.join(','), state })
      return responder({ url: 'https://www.instagram.com/oauth/authorize?' + q.toString() })
    }

    return responder({ error: 'acción desconocida' }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ig-conectar]', msg)
    if (req.method === 'GET') {
      const est = await leerEstado(u.searchParams.get('state') || '').catch(() => null)
      return redirigir(SITIO + volverA(est?.v) + '?instagram=error&por=' + encodeURIComponent(msg.slice(0, 120)))
    }
    return responder({ error: msg }, 500)
  }
})

// yt-conectar — conecta el canal de YouTube de una marca de Cherry y lee lo que YouTube deja ver de él
/* yt-conectar v1 (25-oct-2026) · Hermana de tt-conectar.ts: misma forma, otra red.
 *
 *   POST {accion:'enlace', marca, volver}      · (con sesión) la dirección de Google para pedir permiso
 *   GET  ?code&state                           · la vuelta de Google: llaves → canal → `cuentas_youtube` → de vuelta a Cherry
 *   GET  ?error                                · la persona canceló
 *   POST {accion:'cuentas'}                    · (con sesión) mis canales conectados, sin llaves
 *   POST {accion:'metricas', canal_id}         · (con sesión) el canal con números + sus últimos videos con vistas/likes
 *   POST {accion:'desconectar', canal_id}      · (con sesión) le quita el permiso a Cherry y cancela lo programado
 *
 * ⚠️ El token de Google dura 1 HORA; el refresh_token no vence mientras la app esté «En producción» en Google Cloud
 *    (en «Prueba» vence a los 7 días). Se renueva solo antes de usarlo (tokenVivo).
 * ⚠️ Google solo entrega refresh_token la PRIMERA vez que la persona acepta: por eso se pide con prompt=consent.
 * ⚠️ Mientras Google no verifique la app, al conectar sale «Google no ha verificado esta app» (Configuración avanzada →
 *    Ir a Cherry) y hay tope de 100 personas.
 * ⚠️ Las llaves solo viven en `cuentas_youtube`, que el navegador no puede leer (servidor/base/29-youtube.sql).
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const YT_ID = (Deno.env.get('YT_CLIENT_ID') ?? '').trim()
const YT_SECRETO = (Deno.env.get('YT_CLIENT_SECRET') ?? '').trim()

const VUELTA = `${SB_URL}/functions/v1/yt-conectar`       // ⚠️ idéntica a la registrada en Google Cloud (cliente «Cherry web»)
const SITIO = 'https://cherrysweet.app/'
const API = 'https://www.googleapis.com/youtube/v3'

/* Lo que se le pide a la persona. ⚠️ Cada uno está registrado en Google Cloud → Acceso a los datos. youtube.force-ssl
   (comentarios) también está registrado, pero se pedirá cuando Cherry responda comentarios (include_granted_scopes). */
const PERMISOS = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
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

/* ── El «state» firmado: quién pidió conectar. Igual que tt-conectar. ── */
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const desdeB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
async function hmac(datos: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', enc.encode(YT_SECRETO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(datos)))
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
    return Date.now() - Number(o.t) < 30 * 60 * 1000 ? o : null
  } catch (_) { return null }
}
const volverA = (v: unknown) => /^(app\.html|herramientas\/[a-z-]+\.html)$/.test(String(v || '')) ? String(v) : 'app.html'
const redirigir = (url: string) => new Response(null, { status: 302, headers: { Location: url } })
/* (25-oct) Los registros de Supabase ya no se pueden leer desde fuera: lo que sale mal en la vuelta de Google queda en
   `rastros` (tabla que el navegador no ve), sin llaves ni códigos. */
const rastro = (mensaje: string) => tabla('rastros', { method: 'POST', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({ fn: 'yt-conectar', mensaje: mensaje.slice(0, 500) }) }).catch(() => null)

/* La foto del canal COPIADA a nuestro almacén. ⚠️ Misma idea que fotoPropia de tt-conectar. */
async function fotoPropia(cid: string, url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const r = await fetch(url)
    const tipo = (r.headers.get('content-type') || '').split(';')[0].trim()
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(tipo)) return url
    const ruta = `perfiles/yt-${cid.replace(/[^A-Za-z0-9_-]/g, '')}.jpg`
    const s = await fetch(`${SB_URL}/storage/v1/object/assets/${ruta}`, {
      method: 'POST', body: new Uint8Array(await r.arrayBuffer()),
      headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': tipo, 'x-upsert': 'true', 'cache-control': 'max-age=3600' },
    })
    if (!s.ok) return url
    return `${SB_URL}/storage/v1/object/public/assets/${ruta}?v=${Date.now()}`
  } catch (_) { return url }
}

/* ── Google ── */
async function gg(ruta: string, token: string | null, op: RequestInit = {}) {
  const r = await fetch(ruta.startsWith('http') ? ruta : `${API}${ruta}`, {
    ...op,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(op.headers || {}) },
  })
  const t = await r.text()
  let j: any = null
  try { j = JSON.parse(t) } catch (_) { /* no es JSON */ }
  if (!r.ok) {
    const err = j?.error
    const e: any = new Error(String((typeof err === 'object' ? err?.message : j?.error_description) || t).slice(0, 300))
    e.codigo = (typeof err === 'object' ? err?.errors?.[0]?.reason || err?.status : err) || r.status
    throw e
  }
  return j
}
const formulario = (o: Record<string, string>) => ({
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString(),
})
const venceEn = (seg: unknown, porDefecto: number) => new Date(Date.now() + (Number(seg) || porDefecto) * 1000).toISOString()
const filtro = (c: any) => `cuentas_youtube?user_id=eq.${c.user_id}&canal_id=eq.${encodeURIComponent(c.canal_id)}`

/* Renueva la llave si vence en menos de 5 minutos. ⚠️ La misma función está en yt-publicar.ts: si cambias una, cambia la otra. */
async function tokenVivo(c: any): Promise<string> {
  if (new Date(c.token_vence).getTime() - Date.now() > 5 * 60 * 1000) return c.token
  try {
    const d = await gg('https://oauth2.googleapis.com/token', null, formulario({ client_id: YT_ID, client_secret: YT_SECRETO, grant_type: 'refresh_token', refresh_token: c.refresh_token }))
    const campos = { token: d.access_token, token_vence: venceEn(d.expires_in, 3600), ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}),
      refrescado: new Date().toISOString(), estado: 'activa' }
    await tabla(filtro(c), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos) })
    Object.assign(c, campos)
    return c.token
  } catch (e: any) {
    if (/invalid_grant/i.test(String(e.codigo) + e.message)) {
      await tabla(filtro(c), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'caducada' }) })
      throw new Error('YouTube ya no acepta la conexión de Cherry. Vuelve a conectar el canal.')
    }
    throw e
  }
}

/* El canal de la cuenta que dio permiso (Google le pide escoger el canal si la cuenta tiene varios) */
async function leerCanal(token: string) {
  const d = await gg('/channels?part=snippet,statistics,contentDetails&mine=true', token)
  return d?.items?.[0] || null
}
const filaCanal = async (ch: any) => ({
  usuario: ch.snippet?.customUrl || null, nombre: ch.snippet?.title || null,
  foto: await fotoPropia(String(ch.id || ''), ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.default?.url),
  descripcion: ch.snippet?.description ?? null,
  suscriptores: ch.statistics?.hiddenSubscriberCount ? null : Number(ch.statistics?.subscriberCount ?? 0),
  vistas: Number(ch.statistics?.viewCount ?? 0), videos: Number(ch.statistics?.videoCount ?? 0),
  lista_subidos: ch.contentDetails?.relatedPlaylists?.uploads || null,
  perfil_visto: new Date().toISOString(),
})

async function cuentaDe(user: string, canalId: unknown) {
  const c = (await tabla(`cuentas_youtube?user_id=eq.${user}&canal_id=eq.${encodeURIComponent(String(canalId || ''))}&select=*`))?.[0]
  if (!c) throw new Error('Ese canal de YouTube no está conectado.')
  if (c.estado !== 'activa') throw new Error('La conexión con YouTube no está activa. Vuelve a conectar el canal.')
  return c
}

/* «PT1M5S» → 65 */
const segundos = (iso: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(String(iso || ''))
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
  const u = new URL(req.url)

  try {
    /* ── La vuelta de Google ── */
    if (req.method === 'GET') {
      const est = await leerEstado(u.searchParams.get('state') || '')
      const volver = SITIO + volverA(est?.v)
      if (u.searchParams.get('error')) {
        const por = u.searchParams.get('error') === 'access_denied' ? 'cancelado' : 'youtube'
        await rastro(`vuelta con error de Google: ${u.searchParams.get('error')}`)
        return redirigir(`${volver}?youtube=error&por=${por}`)
      }
      if (!est) { await rastro('state vencido o mal firmado'); return redirigir(`${SITIO}app.html?youtube=error&por=vencido`) }
      const d = await gg('https://oauth2.googleapis.com/token', null, formulario({
        client_id: YT_ID, client_secret: YT_SECRETO, code: u.searchParams.get('code') || '', grant_type: 'authorization_code', redirect_uri: VUELTA }))
      const permisos = String(d.scope || '')
      if (!permisos.includes('youtube.upload')) {
        // en la pantalla de Google se puede desmarcar cada permiso: sin el de subir, Cherry no sirve para YouTube
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(d.access_token)}`, { method: 'POST' }).catch(() => null)
        await rastro(`sin permiso de subir · aceptó: ${permisos}`)
        return redirigir(`${volver}?youtube=error&por=permisos`)
      }
      const ch = await leerCanal(d.access_token)
      if (!ch) { await rastro(`la cuenta no tiene canal · permisos: ${permisos}`); return redirigir(`${volver}?youtube=error&por=sincanal`) }
      if (!d.refresh_token) {
        // ya había dado permiso antes y Google no repite el refresh_token: si ya lo tenemos guardado, sirve el viejo
        const vieja = (await tabla(`cuentas_youtube?user_id=eq.${est.u}&canal_id=eq.${encodeURIComponent(ch.id)}&select=refresh_token`))?.[0]
        if (!vieja?.refresh_token || vieja.refresh_token === 'quitado') { await rastro('Google no mandó refresh_token y no hay uno guardado'); return redirigir(`${volver}?youtube=error&por=youtube`) }
        d.refresh_token = vieja.refresh_token
      }
      await tabla('cuentas_youtube?on_conflict=user_id,canal_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: est.u, canal_id: ch.id, ...(est.m ? { marca: est.m } : {}), ...(await filaCanal(ch)),
          token: d.access_token, token_vence: venceEn(d.expires_in, 3600), refresh_token: d.refresh_token,
          permisos, estado: 'activa', conectada: new Date().toISOString(),
        }),
      })
      console.log(`[yt-conectar] conectado ${ch.id} (${ch.snippet?.customUrl || ch.snippet?.title || '?'}) · permisos: ${permisos}`)
      return redirigir(`${volver}?youtube=ok&cuenta=${encodeURIComponent(ch.snippet?.customUrl || ch.snippet?.title || '')}`)
    }

    const b = await req.json().catch(() => ({}))
    const user = await quienEs(req)
    if (!user) return responder({ error: 'Falta la sesión.' }, 401)

    if (b.accion === 'enlace') {
      if (!YT_ID || !YT_SECRETO) return responder({ error: 'YouTube todavía no está configurado en el servidor.' }, 503)
      const state = await firmarEstado({ u: user, m: b.marca ? String(b.marca).slice(0, 80) : null, v: volverA(b.volver), t: Date.now() })
      const q = new URLSearchParams({ client_id: YT_ID, redirect_uri: VUELTA, response_type: 'code', scope: PERMISOS.join(' '),
        access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state })
      return responder({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` })
    }

    /* Los canales conectados de esta persona (sin llaves): el calendario los filtra por la marca activa */
    if (b.accion === 'cuentas') {
      const cs = await tabla(`cuentas_youtube?user_id=eq.${user}&estado=neq.desconectada&select=canal_id,marca,usuario,nombre,foto,suscriptores,vistas,videos,estado,conectada,permisos&order=conectada.desc`)
      return responder({ cuentas: cs || [] })
    }

    if (b.accion === 'metricas') {
      const c = await cuentaDe(user, b.canal_id)
      const token = await tokenVivo(c)
      const ch = await leerCanal(token)
      if (!ch) throw new Error('No se encontró el canal.')
      const fila = await filaCanal(ch)
      await tabla(filtro(c), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fila) })
      let videos: any[] = []
      let cursor: string | null = null
      if (fila.lista_subidos) {
        // la lista «uploads» cuesta 1 unidad de cupo (buscar con search.list cuesta 100)
        const l = await gg(`/playlistItems?part=contentDetails&maxResults=20&playlistId=${encodeURIComponent(fila.lista_subidos)}${b.cursor ? `&pageToken=${encodeURIComponent(b.cursor)}` : ''}`, token)
        cursor = l?.nextPageToken || null
        const ids = (l?.items || []).map((x: any) => x.contentDetails?.videoId).filter(Boolean)
        if (ids.length) {
          const v = await gg(`/videos?part=snippet,statistics,contentDetails,status&id=${ids.join(',')}`, token)
          videos = (v?.items || []).map((x: any) => ({
            id: x.id, titulo: x.snippet?.title || '', fecha: x.snippet?.publishedAt || null,
            portada: x.snippet?.thumbnails?.high?.url || x.snippet?.thumbnails?.default?.url || null,
            enlace: `https://www.youtube.com/watch?v=${x.id}`, duracion: segundos(x.contentDetails?.duration),
            privacidad: x.status?.privacyStatus || null,
            vistas: Number(x.statistics?.viewCount ?? 0), likes: Number(x.statistics?.likeCount ?? 0),
            comentarios: Number(x.statistics?.commentCount ?? 0),
          }))
        }
      }
      const { lista_subidos: _l, ...perfil } = fila
      return responder({ perfil, videos, cursor, hay_mas: !!cursor })
    }

    if (b.accion === 'desconectar') {
      const c = (await tabla(`cuentas_youtube?user_id=eq.${user}&canal_id=eq.${encodeURIComponent(String(b.canal_id || ''))}&select=*`))?.[0]
      if (!c) return responder({ ok: true })
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(c.refresh_token)}`, { method: 'POST' }).catch(() => null)
      await tabla(filtro(c), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'desconectada', token: 'quitado', refresh_token: 'quitado' }) })
      await tabla(`publicaciones_youtube?user_id=eq.${user}&canal_id=eq.${encodeURIComponent(c.canal_id)}&estado=eq.programada`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'cancelada', error: 'Se desconectó el canal de YouTube.' }) }).catch(() => null)
      return responder({ ok: true })
    }

    return responder({ error: 'acción desconocida' }, 400)
  } catch (e: any) {
    console.error('[yt-conectar]', e?.codigo || '', String(e?.message || e).slice(0, 300))
    if (req.method === 'GET') { await rastro(`falló la vuelta: ${e?.codigo || ''} ${String(e?.message || e)}`); return redirigir(`${SITIO}app.html?youtube=error&por=servidor`) }
    return responder({ error: String(e?.message || e) }, 400)
  }
})

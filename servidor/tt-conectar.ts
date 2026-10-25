// tt-conectar — conecta la cuenta de TikTok de una marca de Cherry y lee lo que TikTok deja ver de ella
/* tt-conectar v1 (25-oct-2026) · Hermana de ig-conectar.ts: misma forma, otra red.
 *
 *   POST {accion:'enlace', marca, volver}      · (con sesión) la dirección de TikTok para pedir permiso
 *   GET  ?code&state                           · la vuelta de TikTok: llaves → perfil → `cuentas_tiktok` → de vuelta a Cherry
 *   GET  ?error                                · la persona canceló, o TikTok no la deja (cuenta no apta)
 *   POST {accion:'cuentas'}                    · (con sesión) mis cuentas de TikTok conectadas, sin llaves
 *   POST {accion:'creador', open_id}           · (con sesión) lo que la pantalla de publicar TIENE que mostrar: nombre,
 *                                                foto, opciones de privacidad, si comentarios/dúo/pegar están apagados y
 *                                                cuánto puede durar un video. TikTok lo exige antes de cada publicación.
 *   POST {accion:'metricas', open_id}          · (con sesión) perfil con números + sus últimos videos con vistas/likes
 *   POST {accion:'desconectar', open_id}       · (con sesión) le quita el permiso a Cherry y cancela lo programado
 *   POST {accion:'refrescar', llave}           · el reloj: renueva las llaves que vencen pronto
 *
 * ⚠️ La llave de TikTok dura 24 HORAS (la de Instagram, 60 días) y el refresh_token 365 días. Se renueva sola antes de
 *    usarla (tokenVivo) y el reloj la renueva cada pocas horas para que nunca llegue vencida a una publicación.
 * ⚠️ Mientras la app no pase la auditoría de TikTok, solo cuentas PRIVADAS pueden publicar y todo sale privado.
 * ⚠️ Las llaves solo viven en `cuentas_tiktok`, que el navegador no puede leer (servidor/base/28-tiktok.sql).
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
/* (25-oct) Dos juegos de llaves: las del modo de pruebas de TikTok (Sandbox «Cherry pruebas») y las reales. Manda
   TT_ENTORNO: 'produccion' usa TT_CLIENT_KEY/TT_CLIENT_SECRET; cualquier otra cosa (o sin poner) usa las TT_SANDBOX_*.
   ⚠️ Una cuenta conectada en pruebas NO sirve en producción: al cambiar, cada persona vuelve a conectar su TikTok. */
const TT_ENTORNO = (Deno.env.get('TT_ENTORNO') ?? 'sandbox') === 'produccion' ? 'produccion' : 'sandbox'
const TT_KEY = ((TT_ENTORNO === 'produccion' ? Deno.env.get('TT_CLIENT_KEY') : Deno.env.get('TT_SANDBOX_CLIENT_KEY')) ?? '').trim()   // (25-oct) se pegó con un salto de línea al final
const TT_SECRETO = ((TT_ENTORNO === 'produccion' ? Deno.env.get('TT_CLIENT_SECRET') : Deno.env.get('TT_SANDBOX_CLIENT_SECRET')) ?? '').trim()
const LLAVE_RELOJ = Deno.env.get('TT_RELOJ_SECRETO') ?? ''

const VUELTA = `${SB_URL}/functions/v1/tt-conectar`       // ⚠️ idéntica a la registrada en TikTok (Login Kit → Redirect URI)
const SITIO = 'https://cherrysweet.app/'
const API = 'https://open.tiktokapis.com/v2'

/* Lo que se le pide a la persona: todo lo que TikTok deja a una app como Cherry. ⚠️ Cada uno tiene que salir en el video
   de la revisión de TikTok; si alguno sobra, se quita también del portal. */
const PERMISOS = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list', 'video.publish', 'video.upload']

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

/* ── El «state» firmado: quién pidió conectar (así nadie cuelga su TikTok en la cuenta de otro). Igual que ig-conectar. ── */
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const desdeB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
async function hmac(datos: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', enc.encode(TT_SECRETO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
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

/* La foto de perfil COPIADA a nuestro almacén (la de TikTok vence en horas). ⚠️ Misma idea que fotoPropia de ig-conectar. */
async function fotoPropia(oid: string, url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const r = await fetch(url)
    const tipo = (r.headers.get('content-type') || '').split(';')[0].trim()
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(tipo)) return url
    const ruta = `perfiles/tt-${oid.replace(/[^A-Za-z0-9_-]/g, '')}.jpg`
    const s = await fetch(`${SB_URL}/storage/v1/object/assets/${ruta}`, {
      method: 'POST', body: new Uint8Array(await r.arrayBuffer()),
      headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': tipo, 'x-upsert': 'true', 'cache-control': 'max-age=3600' },
    })
    if (!s.ok) return url
    return `${SB_URL}/storage/v1/object/public/assets/${ruta}?v=${Date.now()}`
  } catch (_) { return url }
}

/* ── TikTok ── */
async function tt(ruta: string, token: string | null, op: RequestInit = {}) {
  const r = await fetch(ruta.startsWith('http') ? ruta : `${API}${ruta}`, {
    ...op,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(op.headers || {}) },
  })
  const t = await r.text()
  let j: any = null
  try { j = JSON.parse(t) } catch (_) { /* no es JSON */ }
  const code = j?.error?.code
  if (!r.ok || (code && code !== 'ok')) {
    const e: any = new Error(String(j?.error?.message || j?.error_description || j?.message || t).slice(0, 300))
    e.codigo = code || j?.error || r.status
    throw e
  }
  return j
}
/* Lo que creator_info contesta cuando la cuenta no puede publicar en este momento */
const NO_PUEDE: Record<string, string> = {
  spam_risk_too_many_posts: 'Tu cuenta llegó al tope de publicaciones de hoy en TikTok. Vuelve a intentarlo mañana.',
  spam_risk_user_banned_from_posting: 'TikTok no está dejando publicar a esta cuenta por ahora.',
  reached_active_user_cap: 'TikTok no deja publicar más cuentas desde Cherry por hoy. Vuelve a intentarlo más tarde.',
}
const formulario = (o: Record<string, string>) => ({
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString(),
})
const venceEn = (seg: unknown, porDefecto: number) => new Date(Date.now() + (Number(seg) || porDefecto) * 1000).toISOString()

/* Renueva la llave si vence en menos de 10 minutos. ⚠️ TikTok puede devolver un refresh_token NUEVO: se guarda siempre.
   ⚠️ La misma función está en tt-publicar.ts: si cambias una, cambia la otra. */
async function tokenVivo(c: any): Promise<string> {
  if (new Date(c.token_vence).getTime() - Date.now() > 10 * 60 * 1000) return c.token
  if (new Date(c.refresh_vence).getTime() < Date.now()) {
    await tabla(`cuentas_tiktok?user_id=eq.${c.user_id}&open_id=eq.${encodeURIComponent(c.open_id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'caducada' }) })
    throw new Error('La conexión con TikTok venció. Vuelve a conectar la cuenta.')
  }
  try {
    const d = await tt('/oauth/token/', null, formulario({ client_key: TT_KEY, client_secret: TT_SECRETO, grant_type: 'refresh_token', refresh_token: c.refresh_token }))
    const campos = { token: d.access_token, token_vence: venceEn(d.expires_in, 86400), refresh_token: d.refresh_token || c.refresh_token,
      refresh_vence: venceEn(d.refresh_expires_in, 31536000), refrescado: new Date().toISOString(), estado: 'activa' }
    await tabla(`cuentas_tiktok?user_id=eq.${c.user_id}&open_id=eq.${encodeURIComponent(c.open_id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos) })
    Object.assign(c, campos)
    return c.token
  } catch (e: any) {
    if (/invalid_grant|access_token_invalid|refresh/i.test(String(e.codigo) + e.message)) {
      await tabla(`cuentas_tiktok?user_id=eq.${c.user_id}&open_id=eq.${encodeURIComponent(c.open_id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'caducada' }) })
      throw new Error('TikTok ya no acepta la conexión de Cherry. Vuelve a conectar la cuenta.')
    }
    throw e
  }
}

/* El perfil: pide solo los campos de los permisos que la persona aceptó (si se pide uno sin permiso, TikTok falla todo). */
async function leerPerfil(token: string, permisos: string) {
  const campos = ['open_id', 'avatar_url', 'display_name']
  if (permisos.includes('user.info.profile')) campos.push('username', 'bio_description', 'profile_deep_link', 'is_verified')
  if (permisos.includes('user.info.stats')) campos.push('follower_count', 'following_count', 'likes_count', 'video_count')
  const d = await tt(`/user/info/?fields=${campos.join(',')}`, token)
  return d?.data?.user || {}
}
const filaPerfil = async (u: any) => ({
  usuario: u.username || null, nombre: u.display_name || null, foto: await fotoPropia(String(u.open_id || ''), u.avatar_url),
  bio: u.bio_description ?? null, enlace: u.profile_deep_link ?? null, verificada: u.is_verified ?? null,
  seguidores: u.follower_count ?? null, siguiendo: u.following_count ?? null, likes: u.likes_count ?? null, videos: u.video_count ?? null,
  perfil_visto: new Date().toISOString(),
})

async function cuentaDe(user: string, openId: unknown) {
  const c = (await tabla(`cuentas_tiktok?user_id=eq.${user}&open_id=eq.${encodeURIComponent(String(openId || ''))}&select=*`))?.[0]
  if (!c) throw new Error('Esa cuenta de TikTok no está conectada.')
  if (c.estado !== 'activa') throw new Error('La conexión con TikTok no está activa. Vuelve a conectar la cuenta.')
  return c
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
  const u = new URL(req.url)

  try {
    /* ── La vuelta de TikTok ── */
    if (req.method === 'GET') {
      const est = await leerEstado(u.searchParams.get('state') || '')
      const volver = SITIO + volverA(est?.v)
      if (u.searchParams.get('error')) {
        const por = u.searchParams.get('error') === 'access_denied' ? 'cancelado' : 'tiktok'
        console.log('[tt-conectar] vuelta con error:', u.searchParams.get('error'), u.searchParams.get('error_description'))
        return redirigir(`${volver}?tiktok=error&por=${por}`)
      }
      if (!est) return redirigir(`${SITIO}app.html?tiktok=error&por=vencido`)
      const code = u.searchParams.get('code') || ''
      const d = await tt('/oauth/token/', null, formulario({ client_key: TT_KEY, client_secret: TT_SECRETO, code, grant_type: 'authorization_code', redirect_uri: VUELTA }))
      const permisos = String(d.scope || u.searchParams.get('scopes') || '')
      const perfil = await leerPerfil(d.access_token, permisos)
      const oid = String(d.open_id || perfil.open_id || '')
      await tabla('cuentas_tiktok?on_conflict=user_id,open_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: est.u, open_id: oid, ...(est.m ? { marca: est.m } : {}), ...(await filaPerfil({ ...perfil, open_id: oid })),
          token: d.access_token, token_vence: venceEn(d.expires_in, 86400), refresh_token: d.refresh_token,
          refresh_vence: venceEn(d.refresh_expires_in, 31536000), permisos, estado: 'activa', conectada: new Date().toISOString(),
        }),
      })
      console.log(`[tt-conectar] conectada ${oid} (@${perfil.username || '?'}) · permisos: ${permisos}`)
      return redirigir(`${volver}?tiktok=ok&cuenta=${encodeURIComponent('@' + (perfil.username || perfil.display_name || ''))}`)
    }

    const b = await req.json().catch(() => ({}))

    /* ── El reloj: renueva lo que vence en las próximas 6 horas ── */
    if (b.accion === 'refrescar') {
      const ok = (LLAVE_RELOJ && b.llave === LLAVE_RELOJ) || (req.headers.get('Authorization') || '') === `Bearer ${SB_SERVICIO}`
      if (!ok) return responder({ error: 'no' }, 401)
      const pronto = new Date(Date.now() + 6 * 3600 * 1000).toISOString()
      const cs = await tabla(`cuentas_tiktok?estado=eq.activa&token_vence=lt.${encodeURIComponent(pronto)}&select=*`)
      let bien = 0, mal = 0
      for (const c of cs || []) {
        try { c.token_vence = new Date(0).toISOString(); await tokenVivo(c); bien++ } catch (e) { mal++; console.warn('[tt-conectar] refrescar', c.open_id, String(e).slice(0, 120)) }
      }
      return responder({ ok: true, renovadas: bien, fallidas: mal })
    }

    const user = await quienEs(req)
    if (!user) return responder({ error: 'Falta la sesión.' }, 401)

    if (b.accion === 'enlace') {
      if (!TT_KEY || !TT_SECRETO) return responder({ error: 'TikTok todavía no está configurado en el servidor.' }, 503)
      const state = await firmarEstado({ u: user, m: b.marca ? String(b.marca).slice(0, 80) : null, v: volverA(b.volver), t: Date.now() })
      const q = new URLSearchParams({ client_key: TT_KEY, scope: PERMISOS.join(','), response_type: 'code', redirect_uri: VUELTA, state, disable_auto_auth: '1' })
      return responder({ url: `https://www.tiktok.com/v2/auth/authorize/?${q}` })
    }

    /* Las cuentas conectadas de esta persona (sin llaves): el calendario las filtra por la marca activa */
    if (b.accion === 'cuentas') {
      const cs = await tabla(`cuentas_tiktok?user_id=eq.${user}&estado=neq.desconectada&select=open_id,marca,usuario,nombre,foto,seguidores,likes,videos,estado,conectada,permisos&order=conectada.desc`)
      return responder({ cuentas: cs || [] })
    }

    if (b.accion === 'creador') {
      const c = await cuentaDe(user, b.open_id)
      const token = await tokenVivo(c)
      /* (25-oct) Si TikTok dice que esta cuenta no puede publicar ahora (tope del día, bloqueo, o el tope diario de cuentas
         de Cherry), la pantalla de publicar lo dice y no deja programar. Lo exige TikTok (Content Sharing Guidelines). */
      let d: any
      try {
        d = await tt('/post/publish/creator_info/query/', token, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' } })
      } catch (e: any) {
        const motivo = NO_PUEDE[String(e?.codigo)]
        if (!motivo) throw e
        return responder({ open_id: c.open_id, usuario: c.usuario, nombre: c.nombre, foto: c.foto, no_puede: motivo })
      }
      const x = d?.data || {}
      return responder({
        open_id: c.open_id, usuario: x.creator_username || c.usuario, nombre: x.creator_nickname || c.nombre,
        foto: x.creator_avatar_url || c.foto, privacidad: x.privacy_level_options || [],
        comentarios_apagados: !!x.comment_disabled, duo_apagado: !!x.duet_disabled, pegar_apagado: !!x.stitch_disabled,
        duracion_max: Number(x.max_video_post_duration_sec) || null,
      })
    }

    if (b.accion === 'metricas') {
      const c = await cuentaDe(user, b.open_id)
      const token = await tokenVivo(c)
      const perfil = await leerPerfil(token, c.permisos || '')
      const fila = await filaPerfil({ ...perfil, open_id: c.open_id })
      await tabla(`cuentas_tiktok?user_id=eq.${user}&open_id=eq.${encodeURIComponent(c.open_id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fila) })
      let videos: any[] = []
      if ((c.permisos || '').includes('video.list')) {
        const campos = 'id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count'
        const v = await tt(`/video/list/?fields=${campos}`, token, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ max_count: 20, ...(b.cursor ? { cursor: b.cursor } : {}) }) })
        videos = (v?.data?.videos || []).map((x: any) => ({
          id: x.id, titulo: x.title || x.video_description || '', fecha: x.create_time ? new Date(x.create_time * 1000).toISOString() : null,
          portada: x.cover_image_url, enlace: x.share_url, duracion: x.duration, vistas: x.view_count, likes: x.like_count,
          comentarios: x.comment_count, compartidos: x.share_count,
        }))
        return responder({ perfil: fila, videos, cursor: v?.data?.cursor ?? null, hay_mas: !!v?.data?.has_more })
      }
      return responder({ perfil: fila, videos })
    }

    if (b.accion === 'desconectar') {
      const c = (await tabla(`cuentas_tiktok?user_id=eq.${user}&open_id=eq.${encodeURIComponent(String(b.open_id || ''))}&select=*`))?.[0]
      if (!c) return responder({ ok: true })
      await fetch(`${API}/oauth/revoke/`, formulario({ client_key: TT_KEY, client_secret: TT_SECRETO, token: c.token })).catch(() => null)
      await tabla(`cuentas_tiktok?user_id=eq.${user}&open_id=eq.${encodeURIComponent(c.open_id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'desconectada', token: 'quitado', refresh_token: 'quitado' }) })
      await tabla(`publicaciones_tiktok?user_id=eq.${user}&open_id=eq.${encodeURIComponent(c.open_id)}&estado=eq.programada`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'cancelada', error: 'Se desconectó la cuenta de TikTok.' }) }).catch(() => null)
      return responder({ ok: true })
    }

    return responder({ error: 'acción desconocida' }, 400)
  } catch (e: any) {
    console.error('[tt-conectar]', e?.codigo || '', String(e?.message || e).slice(0, 300))
    if (req.method === 'GET') return redirigir(`${SITIO}app.html?tiktok=error&por=servidor`)
    return responder({ error: String(e?.message || e) }, 400)
  }
})

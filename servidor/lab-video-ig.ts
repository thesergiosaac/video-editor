// lab-video-ig v1 (28-sep-2026) — el archivo de UN reel de la cuenta conectada, para que el Laboratorio lo desmonte solo.
//
// Sergio: «es ilógico que me pida cargar el video en archivo si tiene acceso directo a mi cuenta». El Laboratorio le
// pedía subir el MP4 a mano para desmontar un reel que no se planeó en Cherry, cuando Cherry ya lee su cuenta. Con
// esto la página pide el video aquí y le pasa por el MISMO análisis de siempre (oír, mirar, desmontar), sin botón.
//
// Es una función APARTE a propósito: `ig-metricas` es la que ve el revisor de Meta y no se toca mientras revisan.
//
// Recibe: POST JSON { ig_media_id }. Devuelve el MP4 tal cual, en chorro: no se carga entero en memoria, así que
// un reel de 40 MB pasa igual que uno de 4.
//
// ⚠️ Solo publicaciones de la cuenta del que pregunta. Se busca la publicación en `publicaciones_instagram` CON su
// user_id, y con el token de ESA cuenta se le pide a Instagram el `media_url` fresco: el que se guardó al medir
// caduca a los pocos días (lleva firma con fecha), así que no sirve el guardado.

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GRAFO = 'https://graph.instagram.com/v23.0'
const TOPE = 400 * 1024 * 1024      // lo mismo que acepta el Laboratorio al subir a mano

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, content-type',
}

async function tabla(ruta: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}.`)
  return await r.json()
}

/* Quién pregunta. Las pruebas internas entran con la llave del servidor y dicen de quién es el reel (`user_id`):
   así se prueba de punta a punta sin la contraseña de nadie. */
async function quienEs(req: Request, b: any): Promise<string> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) throw new Error('Falta la sesión.')
  const internas = [Deno.env.get('SVC_JWT'), SB_SERVICIO].filter(Boolean)
  if (internas.includes(jwt)) {
    const u = String(b?.user_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(u)) throw new Error('Falta de quién es el reel.')
    return u
  }
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } })
  if (!r.ok) throw new Error('La sesión no vale.')
  const u = await r.json()
  if (!u?.id) throw new Error('La sesión no vale.')
  return u.id as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const error = (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const b = await req.json().catch(() => ({}))
    const user = await quienEs(req, b)
    const id = String(b?.ig_media_id || '')
    if (!/^\d{5,30}$/.test(id)) return error('Falta la publicación.', 400)

    const pub = await tabla(`publicaciones_instagram?ig_media_id=eq.${id}&user_id=eq.${user}&select=ig_user_id,tipo&limit=1`)
    if (!pub?.length) return error('Esa publicación no es de tu cuenta o todavía no se ha traído de Instagram.', 404)

    const cta = await tabla(`cuentas_instagram?user_id=eq.${user}&ig_user_id=eq.${pub[0].ig_user_id}` +
      `&estado=eq.activa&select=token&limit=1`)
    if (!cta?.length) return error('La cuenta de Instagram de esa publicación ya no está conectada.', 409)

    const m = await fetch(`${GRAFO}/${id}?fields=media_type,media_product_type,media_url&access_token=${cta[0].token}`)
    const mt = await m.json().catch(() => ({}))
    if (!m.ok) return error('Instagram no entregó la publicación: ' + String(mt?.error?.message || m.status).slice(0, 200), 502)
    if (mt.media_type !== 'VIDEO' || !mt.media_url) return error('Esa publicación no es un video.', 400)

    const v = await fetch(mt.media_url)
    if (!v.ok || !v.body) return error('Instagram no dejó bajar el video (' + v.status + ').', 502)
    const largo = Number(v.headers.get('content-length') || 0)
    if (largo > TOPE) return error('Ese video pesa demasiado para desmontarlo.', 413)

    return new Response(v.body, {
      headers: {
        ...CORS,
        'Content-Type': v.headers.get('content-type') || 'video/mp4',
        ...(largo ? { 'Content-Length': String(largo) } : {}),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[lab-video-ig]', msg)
    return error(msg, /sesión/i.test(msg) ? 401 : 500)
  }
})

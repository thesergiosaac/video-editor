// pantalla v1 — subir una grabación de pantalla para la plantilla del navegador (24-sep-2026)
//
// Sergio graba su pantalla para explicar algo y quiere que salga DENTRO de la plantilla del
// navegador (tú arriba y la pantalla abajo, o la pantalla arriba detrás de ti). No es un clip: no
// se transcribe ni se corta ni entra al motor de tomas. Por eso NO pasa por `multipart-upload`, que
// crea una fila en `clips`.
//
//   action=iniciar   → abre la subida por trozos a uploads/<proyecto>/pantallas/<id>/ y da las URLs
//   action=completar → la cierra y le pide a la Lambda (modo `pantalla`) que la prepare
//
// La Lambda la deja pública en clips/pantallas/<id>.mp4|png con un <id>.json que la página lee
// para saber cuándo está lista y cuánto mide.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SVC_JWT")!
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SESION_ANON = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ'
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function usuarioDeSesion(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SESION_ANON, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' && ES_UUID.test(u.id) ? u.id : null
  } catch (_) { return null }
}

async function proyectoDelUsuario(id: unknown, userId: string): Promise<boolean> {
  if (typeof id !== 'string' || !ES_UUID.test(id)) return false
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${id}&user_id=eq.${userId}&select=id&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
    if (!r.ok) return false
    const f = await r.json()
    return Array.isArray(f) && f.length > 0
  } catch (_) { return false }
}

async function lambda(payload: object, sync = true): Promise<any> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/invoke-lambda`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sync, payload }),
  })
  const data = await resp.json() as any
  if (!resp.ok) throw new Error(`invoke-lambda ${resp.status}: ${JSON.stringify(data).slice(0, 200)}`)
  if (data.functionError) throw new Error(`Lambda: ${JSON.stringify(data.result).slice(0, 300)}`)
  return sync ? data.result : data
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const userId = await usuarioDeSesion(req)
    if (!userId) return json({ error: "Inicia sesión para subir tu grabación" }, 401)
    const b = await req.json().catch(() => ({})) as any
    const projectId = b.project_id
    if (!(await proyectoDelUsuario(projectId, userId))) return json({ error: "Ese proyecto no es tuyo" }, 403)

    if (b.action === 'iniciar') {
      const partes = Math.max(1, Math.min(1000, Number(b.partes) || 1))
      const nombre = (String(b.nombre || 'pantalla').split(/[\\/]/).pop() || 'pantalla').replace(/[^\w.\-]+/g, '_').slice(-80)
      const id = crypto.randomUUID()
      const key = `uploads/${projectId}/pantallas/${id}/${nombre}`
      const r = await lambda({ mode: 'multipartInitiate', s3_key: key, num_parts: partes })
      if (!r?.ok) throw new Error('No se pudo abrir la subida: ' + JSON.stringify(r).slice(0, 200))
      return json({ id, key, upload_id: r.upload_id, part_urls: r.part_urls })
    }

    if (b.action === 'completar') {
      const id = String(b.id || ''), key = String(b.key || '')
      if (!ES_UUID.test(id) || !key.startsWith(`uploads/${projectId}/pantallas/${id}/`)) return json({ error: "Esa subida no es tuya" }, 403)
      if (!b.upload_id || !Array.isArray(b.parts) || !b.parts.length) return json({ error: "Faltan los trozos" }, 400)
      const r = await lambda({ mode: 'multipartComplete', s3_key: key, upload_id: b.upload_id, parts: b.parts })
      if (!r?.ok) throw new Error('No se pudo cerrar la subida: ' + JSON.stringify(r).slice(0, 200))
      // prepararla en segundo plano: la página mira el <id>.json público
      await lambda({ mode: 'pantalla', key, id }, false)
      console.log(`[pantalla] ${id.slice(0, 8)} subida; preparándola`)
      return json({ ok: true, id })
    }

    return json({ error: "action desconocida" }, 400)
  } catch (e) {
    console.error('[pantalla]', String(e))
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500)
  }
})

// camara-viva — (29-oct-2026) lo que la página pide de la CÁMARA VIVA para un video base (renders.graficos):
//   { accion: 'plan', render_id }          → el plan del director: { plan, caras? } o { pendiente: true } (orchestrate lo pidió al
//                                            preparar la base; aquí se recoge. Si no hay o falló, se pide de nuevo)
//   { accion: 'caras', render_id, caras }  → guarda dónde está la cara (js/caras.js: [[t, x, y, ancho, alto], …] cada 0,25 s)
// Todo vive en renders.graficos = { v, estilo: 'camara_viva', rev, pendiente | plan, avisos?, uso?, caras?, imagenes? }.
// «rev» sube con cada escritura y solo se escribe si nadie escribió en el medio (la página y el director no se pisan).
// Exige sesión y que el video sea de un proyecto de la persona. El director se llama con la llave de servicio.

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const SESION_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SESION_ANON = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ'
const SESION_SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOTOR_GRAFICOS = 4                 // el de orchestrate: un número menor haría que se volvieran a marcar los de vidrio
const ESPERA_MAX_MS = 10 * 60 * 1000     // un plan pendiente hace más de 10 min se da por perdido y se pide otra vez

const hSrv = (extra: Record<string, string> = {}) => ({ apikey: SESION_SRV, Authorization: `Bearer ${SESION_SRV}`, 'Content-Type': 'application/json', ...extra })

async function usuarioDeSesion(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  try {
    const r = await fetch(`${SESION_URL}/auth/v1/user`, { headers: { apikey: SESION_ANON, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' && ES_UUID.test(u.id) ? u.id : null
  } catch (_) { return null }
}

// La fila del video si es de un proyecto de la persona; null si no existe o es de otro.
async function renderDelUsuario(renderId: unknown, userId: string): Promise<any | null> {
  if (typeof renderId !== 'string' || !ES_UUID.test(renderId)) return null
  const r = await fetch(`${SESION_URL}/rest/v1/renders?id=eq.${renderId}&select=id,project_id,graficos,palabras:subtitle_phrases->palabras&limit=1`, { headers: hSrv() })
  const filas = r.ok ? await r.json() : []
  const fila = Array.isArray(filas) ? filas[0] : null
  if (!fila || !ES_UUID.test(String(fila.project_id))) return null
  const p = await fetch(`${SESION_URL}/rest/v1/projects?id=eq.${fila.project_id}&user_id=eq.${userId}&select=id&limit=1`, { headers: hSrv() })
  const ps = p.ok ? await p.json() : []
  return Array.isArray(ps) && ps.length ? fila : null
}

// Cambia renders.graficos sin pisar lo que otro escribió en el medio (por «rev»). Devuelve lo que quedó guardado.
async function guardar(renderId: string, cambio: (g: any) => any): Promise<any> {
  for (let intento = 0; intento < 5; intento++) {
    const r = await fetch(`${SESION_URL}/rest/v1/renders?id=eq.${renderId}&select=graficos&limit=1`, { headers: hSrv() })
    const filas = r.ok ? await r.json() : []
    const g = Array.isArray(filas) && filas[0] && filas[0].graficos && typeof filas[0].graficos === 'object' ? filas[0].graficos : null
    const rev = g && Number.isFinite(Number(g.rev)) ? Number(g.rev) : 0
    const nuevo = { ...cambio(g && g.estilo === 'camara_viva' ? g : { v: MOTOR_GRAFICOS, estilo: 'camara_viva' }), rev: rev + 1 }
    const filtro = !g ? '&graficos=is.null' : rev ? `&graficos->>rev=eq.${rev}` : '&graficos->>rev=is.null'
    const w = await fetch(`${SESION_URL}/rest/v1/renders?id=eq.${renderId}${filtro}`, {
      method: 'PATCH', headers: hSrv({ Prefer: 'return=representation' }), body: JSON.stringify({ graficos: nuevo }),
    })
    const hechas = w.ok ? await w.json() : []
    if (Array.isArray(hechas) && hechas.length) return nuevo
    await new Promise((ok) => setTimeout(ok, 150 + Math.random() * 250))
  }
  throw new Error('no se pudo guardar (lo estaban cambiando a la vez)')
}

const palabrasDe = (fila: any) => (Array.isArray(fila.palabras) ? fila.palabras : [])
  .map((w: any) => ({ word: w.word, start: w.start, end: w.end }))

async function director(cuerpo: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SESION_URL}/functions/v1/director`, { method: 'POST', headers: hSrv(), body: JSON.stringify({ estilo: 'camara_viva', ...cuerpo }) })
  const d = await r.json().catch(() => null)
  if (!d) throw new Error(`el director no contestó (${r.status})`)
  return d
}

// El plan: recoger el que dejó pedido orchestrate; pedirlo si no hay, si falló o si se perdió.
async function plan(fila: any): Promise<Record<string, unknown>> {
  const g = fila.graficos && fila.graficos.estilo === 'camara_viva' ? fila.graficos : null
  if (g && g.plan) return { plan: g.plan, avisos: g.avisos || [], caras: g.caras || null }
  const palabras = palabrasDe(fila)
  if (palabras.length < 5) return { pendiente: true, estado: 'sin_palabras' }   // la base aún no tiene sus palabras
  const perdido = g && g.pendiente && Date.now() - Date.parse(String(g.pedido || 0)) > ESPERA_MAX_MS
  if (g && g.pendiente && !perdido) {
    const d = await director({ accion: 'resultado', id: g.pendiente, palabras })
    if (d.pendiente) return { pendiente: true, estado: d.estado || 'pendiente' }
    if (!d.ok || !d.plan) {   // OpenAI falló: se anota y la próxima vez se pide de nuevo
      await guardar(fila.id, (x) => { const { pendiente: _p, ...resto } = x; return { ...resto, error: String(d.error || 'el director falló').slice(0, 300) } })
      return { pendiente: true, estado: 'reintentar' }
    }
    const quedo = await guardar(fila.id, (x) => {
      if (x.plan) return x   // otro pedido ya lo guardó
      const { pendiente: _p, error: _e, ...resto } = x
      return { ...resto, plan: d.plan, avisos: (d.avisos || []).slice(0, 60), uso: d.uso || null, listo: new Date().toISOString() }
    })
    console.log(`[cv] plan listo ${fila.id}: ${(d.plan.momentos || []).length} momentos, US$${d.uso?.usd ?? '?'}`)
    return { plan: quedo.plan, avisos: quedo.avisos || [], caras: quedo.caras || null }
  }
  // no hay plan pedido (base hecha antes de la Cámara viva), falló o se perdió: se pide ahora (máx. 3 veces: cada pedido se paga)
  if (g && Number(g.intentos || 0) >= 3) return { error: 'No se pudo armar el plan de este video. Escríbenos y lo revisamos.' }
  const d = await director({ accion: 'plan', palabras })
  if (!d.pendiente) throw new Error(String(d.error || 'el director no aceptó el pedido').slice(0, 300))
  await guardar(fila.id, (x) => { const { error: _e, ...resto } = x; return { ...resto, v: MOTOR_GRAFICOS, pendiente: String(d.pendiente), pedido: new Date().toISOString(), intentos: Number(x.intentos || 1) + 1 } })
  console.log(`[cv] plan pedido desde la página ${fila.id}`)
  return { pendiente: true, estado: 'pedido' }
}

// Las caras: [[t, x, y, ancho, alto], …] en el cuadro de 1080 × 1920, ordenadas por tiempo (máx. 1 cada 0,1 s, 20 min).
function limpiarCaras(c: any): number[][] | null {
  if (!Array.isArray(c) || !c.length || c.length > 12000) return null
  const lista = c.filter((f: any) => Array.isArray(f) && f.length === 5 && f.every((n: any) => Number.isFinite(Number(n))))
    .map((f: any[]) => f.map((n) => Math.round(Number(n) * 100) / 100))
    .filter((f: number[]) => f[0] >= 0 && f[3] > 0 && f[4] > 0)
    .sort((a: number[], b: number[]) => a[0] - b[0])
  return lista.length ? lista : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, status = 200) => Response.json(d, { status, headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'solo POST' }, 405)
  const usuario = await usuarioDeSesion(req)
  if (!usuario) return responder({ error: 'Inicia sesión' }, 401)
  try {
    const b = await req.json()
    const fila = await renderDelUsuario(b.render_id, usuario)
    if (!fila) return responder({ error: 'No encuentro ese video' }, 404)
    if (b.accion === 'plan') return responder({ ok: true, ...(await plan(fila)) })
    if (b.accion === 'caras') {
      const caras = limpiarCaras(b.caras)
      if (!caras) return responder({ error: 'caras vacías o mal formadas' }, 400)
      const version = String(b.version || '').slice(0, 40)
      await guardar(fila.id, (x) => ({ ...x, caras, caras_version: version || null }))
      return responder({ ok: true, guardadas: caras.length })
    }
    return responder({ error: 'acción desconocida' }, 400)
  } catch (e) {
    console.warn('[cv] ' + String(e).slice(0, 300))
    return responder({ ok: false, error: String(e).slice(0, 300) }, 500)
  }
})

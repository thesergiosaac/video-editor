// mapa-voz v1 — mide DÓNDE hay voz de verdad en cada clip (24-sep-2026)
//
// Sergio: «cuando yo edito a mano corto donde las ondas se acaban, es visual». Esto le da al
// editor esa vista.
//
// Hasta hoy el sistema solo sabía «suena / no suena»: un chasquido de labios sonaba, así que
// contaba como voz y el trozo se quedaba con medio segundo de cola. Medido en el clip de Sergio,
// la cola de «guiones» y el chasquido están al MISMO nivel (-29 dB), así que por volumen no se
// pueden separar — se separan por la FORMA de la onda, y eso lo hace la Lambda (modo `mapaVoz`).
//
// Aquí solo se orquesta: para cada clip del proyecto que aún no tenga su mapa, se le pide a la
// Lambda y se guarda en `clip_metadata.voz`. Se calcula UNA vez por clip y queda guardado.
//
// ⚠️ NO vuelve a llamar a Whisper ni toca la transcripción: solo AÑADE `voz` a clip_metadata.

import { createClient } from "npm:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SVC_JWT")!

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

const A_LA_VEZ = 4   // cuántos clips se miden en paralelo

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}

// ── Solo llamadas internas del servidor ──────────────────────────────────────
async function esLlamadaInterna(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  const conocidas = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v)
  if (conocidas.includes(token)) return true
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    })
    return r.ok
  } catch (_) { return false }
}

async function invokeLambdaSync(payload: object): Promise<any> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/invoke-lambda`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sync: true, payload }),
  })
  const data = await resp.json() as any
  if (!resp.ok) throw new Error(`invoke-lambda ${resp.status}: ${JSON.stringify(data).slice(0, 200)}`)
  if (data.functionError) throw new Error(`Lambda: ${JSON.stringify(data.result).slice(0, 250)}`)
  return data.result
}

async function medirUno(clip: any): Promise<string> {
  const ruta = clip.audio_path || clip.mp4_path
  if (!ruta) return 'sin-audio'
  const r = await invokeLambdaSync({ mode: 'mapaVoz', audio_path: ruta })
  if (!r?.ok || !Array.isArray(r.bloques)) throw new Error('respuesta rara: ' + JSON.stringify(r).slice(0, 150))

  const meta = { ...(clip.clip_metadata ?? {}),
    voz: { bloques: r.bloques, pico: r.pico, dur: r.dur, medido_en: new Date().toISOString() } }
  const { error } = await sb.from('clips').update({ clip_metadata: meta }).eq('id', clip.id)
  if (error) throw new Error('no se pudo guardar: ' + error.message)
  return `${r.bloques.length} bloques`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResp({ ok: true })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!(await esLlamadaInterna(req))) return jsonResp({ error: 'No autorizado' }, 401)

  const body = await req.json().catch(() => ({})) as any
  const projectId = body.project_id
  const clipId    = body.clip_id
  const forzar    = !!body.forzar
  if (!projectId && !clipId) return jsonResp({ error: 'project_id o clip_id requerido' }, 400)

  let q = sb.from('clips').select('id,audio_path,mp4_path,clip_metadata,status')
  q = clipId ? q.eq('id', clipId) : q.eq('project_id', projectId)
  const { data: clips, error } = await q
  if (error) return jsonResp({ error: error.message }, 500)
  if (!clips?.length) return jsonResp({ ok: true, medidos: 0, ya_estaban: 0, fallos: [] })

  const faltan = clips.filter((c: any) =>
    forzar || !Array.isArray(c?.clip_metadata?.voz?.bloques))
  const yaEstaban = clips.length - faltan.length

  const fallos: any[] = []
  let medidos = 0
  for (let i = 0; i < faltan.length; i += A_LA_VEZ) {
    const tanda = faltan.slice(i, i + A_LA_VEZ)
    await Promise.all(tanda.map(async (c: any) => {
      try {
        const cuantos = await medirUno(c)
        medidos++
        console.log(`[mapa-voz] ${String(c.id).slice(0, 8)} → ${cuantos}`)
      } catch (e) {
        fallos.push({ clip: String(c.id).slice(0, 8), por: String((e as Error).message).slice(0, 160) })
        console.warn(`[mapa-voz] ${String(c.id).slice(0, 8)} falló: ${e}`)
      }
    }))
  }

  console.log(`[mapa-voz] proyecto ${String(projectId || clipId).slice(0, 8)}: ${medidos} medidos, ${yaEstaban} ya estaban, ${fallos.length} fallos`)
  return jsonResp({ ok: true, medidos, ya_estaban: yaEstaban, fallos })
})

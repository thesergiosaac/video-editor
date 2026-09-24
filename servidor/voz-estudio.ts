// voz-estudio v3 (24-sep-2026) — LA VOZ DE ESTUDIO con Auphonic.
//   Sergio: «quiero una limpieza profesional, la que hace Adobe Podcast, que reconstruye el audio de tal manera que suene
//   excelente». Auphonic hace lo mismo por API: «Studio Voice» reconstruye la voz; «bwe» (Voice AutoEQ + extensión de
//   banda) es la versión conservadora. La llave AUPHONIC_API_KEY solo se puede usar aquí (Supabase no la devuelve).
//
//   Acciones (llamada interna o con sesión de usuario):
//   · cuenta {}                           → los créditos que quedan (horas)
//   · crear {url, modo: estudio|limpio}   → crea y arranca la producción (Auphonic baja el audio de `url`) → {uuid}
//   · estado {uuid, guardar?: 'ruta.wav'} → {estado, listo, error?, url?}; lista y con `guardar`, deja el resultado en
//                                           Storage (bucket público `voz`) y devuelve su dirección.
//
//   v3 · la usa el ENSAMBLADOR (Sergio escogió «Estudio» de oído y pidió mandarle «el audio ya cortado»):
//   · crear {…, formato: 'flac'}                → la salida sin pérdida y sin el retardo del AAC
//   · estado {uuid, dur, subir: url firmada PUT} → lista: la sube a S3 (carpeta voz/) y responde {listo: true}.
//     ⚠️ Si Auphonic devuelve MÁS audio del que entró (la cuenta GRATIS le pega su cortinilla de ~6,4 s al principio)
//     responde {cortinilla: true} y NO sube nada: esa voz no puede ir en un video publicado.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const KEY = Deno.env.get('AUPHONIC_API_KEY') ?? ''
const API = 'https://auphonic.com/api'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

/* Los dos modos. Nivelado y volumen parejo en los dos (el ensamblador luego la deja tan fuerte como la original). */
const MODOS: Record<string, Record<string, unknown>> = {
  estudio: { filtering: true, filtermethod: 'studiovoice', leveler: true, normloudness: true, loudnesstarget: -13,
             denoise: true, denoisemethod: 'speech_isolation', denoiseamount: 0, deverbamount: 0 },
  limpio:  { filtering: true, filtermethod: 'bwe', leveler: true, normloudness: true, loudnesstarget: -14,
             denoise: true, denoisemethod: 'speech_isolation', denoiseamount: 0, deverbamount: 0 },
}

async function permitido(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  const conocidas = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v)
  if (conocidas.includes(token)) return true
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || token, Authorization: `Bearer ${token}` } })
    if (r.ok) return true
    const a = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, { headers: { apikey: token, Authorization: `Bearer ${token}` } })
    return a.ok
  } catch (_) { return false }
}

async function auphonic(ruta: string, op: RequestInit = {}): Promise<any> {
  const r = await fetch(API + ruta, { ...op, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(op.headers ?? {}) } })
  const txt = await r.text()
  let j: any = null
  try { j = JSON.parse(txt) } catch (_) { /* no es JSON */ }
  if (!r.ok) throw new Error(`auphonic ${r.status}: ${(j?.error_message || txt).slice(0, 300)}`)
  return j?.data ?? j
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    if (!KEY) return responder({ error: 'falta AUPHONIC_API_KEY' }, 500)
    if (!(await permitido(req))) return responder({ error: 'inicia sesión' }, 401)
    const b = await req.json()

    if (b.accion === 'cuenta') {
      const u = await auphonic('/user.json')
      return responder({ creditos: u?.credits, recurrentes: u?.recharge_amount ?? null, usuario: u?.username ?? null })
    }

    if (b.accion === 'crear') {
      const url = String(b.url || '')
      if (!/^https:\/\/[a-z0-9.-]+\.(amazonaws\.com|supabase\.co)\//.test(url)) return responder({ error: 'url no permitida' }, 400)
      const modo = MODOS[String(b.modo)] ? String(b.modo) : 'estudio'
      const formato = b.formato === 'flac' ? 'flac' : 'wav'
      const p = await auphonic('/productions.json', {
        method: 'POST',
        body: JSON.stringify({
          metadata: { title: String(b.titulo || 'Cherry · voz de estudio').slice(0, 120) },
          input_file: url,
          output_files: [{ format: formato }],
          algorithms: MODOS[modo],
          action: 'start',
        }),
      })
      console.log(`[voz] ${modo}: ${p?.uuid} ← ${url.slice(-50)}`)
      return responder({ uuid: p?.uuid, modo })
    }

    if (b.accion === 'estado') {
      const uuid = String(b.uuid || '')
      if (!/^[A-Za-z0-9]{10,40}$/.test(uuid)) return responder({ error: 'uuid inválido' }, 400)
      const p = await auphonic(`/production/${uuid}.json`)
      const estado = Number(p?.status)
      if (estado === 2) return responder({ estado, listo: false, error: p?.error_message || p?.status_string || 'error' })
      if (estado !== 3) return responder({ estado, listo: false, texto: p?.status_string ?? '' })
      const salida = (p?.output_files ?? [])[0]
      if (!salida?.download_url) return responder({ estado, listo: false, error: 'sin archivo de salida' })
      // v3: la cortinilla de la cuenta gratis alarga el audio: no se usa
      const largo = Number(p?.length) || 0, durIn = Number(b.dur) || 0
      if (durIn > 0 && largo - durIn > 1) {
        console.log(`[voz] ${uuid}: salió de ${largo.toFixed(2)} s para ${durIn.toFixed(2)} s de entrada: trae la cortinilla de la cuenta gratis`)
        return responder({ estado, listo: false, cortinilla: true, largo, dur: durIn })
      }
      // v3: el ensamblador manda dónde dejarla (una dirección firmada de SU carpeta voz/ en S3)
      const subir = String(b.subir || '')
      if (subir) {
        if (!/^https:\/\/remotionlambda-useast1-editorvideo\.s3\.(us-east-1\.)?amazonaws\.com\/voz\//.test(subir)) return responder({ error: 'destino no permitido' }, 400)
        const d = await fetch(salida.download_url, { headers: { Authorization: `Bearer ${KEY}` } })
        if (!d.ok) return responder({ estado, listo: false, error: 'no se pudo bajar el resultado: ' + d.status })
        const cuerpo = new Uint8Array(await d.arrayBuffer())
        const up = await fetch(subir, { method: 'PUT', headers: { 'Content-Type': salida.format === 'flac' ? 'audio/flac' : 'audio/wav' }, body: cuerpo })
        if (!up.ok) return responder({ estado, listo: false, error: 'no se pudo subir a S3: ' + up.status + ' ' + (await up.text()).slice(0, 200) })
        console.log(`[voz] listo ${uuid} → S3 (${Math.round(cuerpo.length / 1024)} KB, ${largo.toFixed(2)} s)`)
        return responder({ estado, listo: true, largo, kb: Math.round(cuerpo.length / 1024) })
      }
      const guardar = String(b.guardar || '').replace(/[^a-zA-Z0-9/_.-]/g, '').replace(/\.\.+/g, '.')
      if (!guardar) return responder({ estado, listo: true, url: null })
      const d = await fetch(salida.download_url, { headers: { Authorization: `Bearer ${KEY}` } })
      if (!d.ok) return responder({ estado, listo: false, error: 'no se pudo bajar el resultado: ' + d.status })
      const cuerpo = new Uint8Array(await d.arrayBuffer())
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/voz/${guardar}`, {
        method: 'POST',
        headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'audio/wav', 'x-upsert': 'true' },
        body: cuerpo,
      })
      if (!up.ok) return responder({ estado, listo: false, error: 'no se pudo guardar: ' + up.status + ' ' + (await up.text()).slice(0, 200) })
      const pub = `${SUPABASE_URL}/storage/v1/object/public/voz/${guardar}`
      console.log(`[voz] listo ${uuid} → ${guardar} (${Math.round(cuerpo.length / 1024)} KB)`)
      return responder({ estado, listo: true, url: pub, kb: Math.round(cuerpo.length / 1024) })
    }

    if (b.accion === 'detalle') {
      const uuid = String(b.uuid || '')
      if (!/^[A-Za-z0-9]{10,40}$/.test(uuid)) return responder({ error: 'uuid inválido' }, 400)
      const p = await auphonic(`/production/${uuid}.json`)
      return responder({ status: p?.status, length: p?.length, intro: p?.intro ?? null, outro: p?.outro ?? null,
        algorithms: p?.algorithms, output_files: (p?.output_files ?? []).map((o: any) => ({ format: o.format, size: o.size, ending: o.ending })),
        warning: p?.warning_message ?? null, statistics: p?.statistics ?? null, input_length: p?.input_length ?? null })
    }

    return responder({ error: 'acción desconocida' }, 400)
  } catch (e) {
    return responder({ error: String(e).slice(0, 400) }, 500)
  }
})

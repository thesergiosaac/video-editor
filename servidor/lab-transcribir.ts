// lab-transcribir v1 (20-sep-2026) — lo que se dice en un video SUELTO, para el Laboratorio.
//
// No tiene nada que ver con transcribe-clip: aquel vive dentro del pipeline de proyectos (clips,
// renders, motor de tomas). Esto es para un video de referencia de otro creador, que no es de nadie
// y no entra al editor: solo se desmonta y se tira.
//
// La página manda YA el audio, no el video: lo saca con Web Audio, lo pasa a mono de 16 kHz y lo
// manda en WAV. Un reel de un minuto son unos 2 MB en vez de los 40 del video, así que sube rápido
// y cabe de sobra en lo que acepta Whisper (25 MB).
//
// Recibe: multipart/form-data con el campo «audio» (y, si hay, «pista»: el texto de la publicación o lo que se lee en
// pantalla, que se le da al modelo como contexto).
// Devuelve: { texto, dur, palabras, modelo }
//
// (28-oct) Sergio: el reel decía «así es como los ricos se hacen más ricos con la DEUDA» y el desmontaje quedó «…con la
// DROGA». Whisper (whisper-1) solo oye y, con música de fondo, confunde palabras que suenan parecido. Ahora oye primero
// gpt-4o-transcribe (el modelo nuevo de OpenAI para voz a texto: se equivoca menos con ruido; mismo precio) y, si falla,
// Whisper de respaldo. «modelo» en la entrada fuerza uno (solo para probar: lab-transcribir-prueba).

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const TOPE = 25 * 1024 * 1024        // lo que aceptan los dos modelos
const MODELOS = ['gpt-4o-transcribe', 'whisper-1']   // en orden: si el primero falla, el segundo

async function usuario(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  if ([Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter(Boolean).includes(token)) return 'interno'
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' ? u.id : null
  } catch (_) { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)

    const entrada = await req.formData()
    const audio = entrada.get('audio')
    if (!(audio instanceof File)) return responder({ error: 'No llegó el audio del video.' }, 400)
    if (audio.size > TOPE) {
      return responder({ error: 'El video es demasiado largo. Para desmontar basta con un reel: prueba con uno de menos de 10 minutos.' }, 400)
    }
    if (audio.size < 2000) return responder({ error: 'Ese video no trae voz, o no se pudo leer el audio.' }, 400)

    const dur = Math.max(0, Math.round(Number(entrada.get('dur')) || 0))

    const idioma = String(entrada.get('idioma') || 'es')
    // la pista: contexto para que oiga mejor (el texto de la publicación, lo que se lee en pantalla). Corta: el modelo solo
    // mira el final de lo que se le da.
    const pista = String(entrada.get('pista') || '').replace(/\s+/g, ' ').trim().slice(0, 800)
    const forzado = String(entrada.get('modelo') || '')
    const orden = MODELOS.includes(forzado) ? [forzado] : MODELOS

    let texto = '', usado = ''
    for (const modelo of orden) {
      const forma = new FormData()
      forma.append('file', audio, 'audio.wav')
      forma.append('model', modelo)
      forma.append('response_format', 'json')
      if (idioma) forma.append('language', idioma)
      if (pista) forma.append('prompt', pista)
      const control = new AbortController()
      const reloj = setTimeout(() => control.abort(), 110000)
      try {
        const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST', signal: control.signal,
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: forma,
        })
        if (!r.ok) { console.warn(`[lab-transcribir] ${modelo} ${r.status}: ${(await r.text()).slice(0, 200)}`); continue }
        const j = await r.json()
        texto = String(j?.text ?? '').replace(/\s+/g, ' ').trim()
        usado = modelo
        if (texto) break
      } catch (e) {
        console.warn(`[lab-transcribir] ${modelo}: ${String((e as Error)?.message || e).slice(0, 200)}`)
      } finally { clearTimeout(reloj) }
    }
    if (!usado) return responder({ error: 'No se pudo transcribir el video. Intenta otra vez.' }, 502)
    if (!texto) return responder({ error: 'Ese video no trae voz que se pueda transcribir.' }, 422)

    const palabras = texto.split(/\s+/).filter(Boolean).length
    console.log(`[lab-transcribir] ${uid.slice(0, 8)}: ${palabras} palabras de ${dur || '?'} s (${Math.round(audio.size / 1e6)} MB) · ${usado}${pista ? ' · con pista' : ''}`)
    return responder({ texto, dur, palabras, modelo: usado })
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

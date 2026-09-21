// lab-ver-video v1 (20-sep-2026) — lo que se VE en un video, para el Laboratorio.
//
// El desmontaje por texto no puede ver el gancho visual ni los open loops visuales: el tren que
// atropella al que habla, el carro que cae del cielo, el rayo. Eso no está en la transcripción y es
// justo lo que sostiene la atención entre frase y frase.
//
// Gemini procesa el video ENTERO de forma nativa —imagen y movimiento, con marcas de tiempo— en vez
// de fotogramas sueltos. Con fotogramas habría que adivinar dónde mirar; así ve el tren porque ve
// que se mueve.
//
// El video va por la Files API de Google, no metido en la petición: en base64 un reel de 30 MB pasa
// de 40 y revienta el límite. Además así vale para videos largos.
//
// Recibe: multipart/form-data con «video» (y opcional «dur»).
// Devuelve: { gancho, visuales:[{seg, que, porque}], vozCortada:[{seg, dice}], cortes, nota }
//
// vozCortada existe porque una transcripción NO sirve para esto: cuando la voz se corta a media
// frase, Whisper la completa por su cuenta y a veces se inventa la palabra que falta. Gemini lo oye
// y lo ve, así que lo marca.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const BASE = 'https://generativelanguage.googleapis.com'
/* gemini-flash-latest es un alias: apunta siempre al mejor flash disponible, y así esto no se cae
   cada vez que Google retira un modelo (2.5-flash dejó de admitir usuarios nuevos en cuanto se
   probó). Los otros dos son por si el primero está saturado. */
const MODELOS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
const TOPE = 120 * 1024 * 1024          // 120 MB: de sobra para un reel

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

/* Sube el video a la Files API y espera a que Google termine de prepararlo. Sin esa espera, pedir el
   análisis devuelve «el archivo no está listo» y se pierde la subida entera. */
async function subirVideo(datos: Uint8Array, tipo: string): Promise<string> {
  const inicio = await fetch(`${BASE}/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(datos.byteLength),
      'X-Goog-Upload-Header-Content-Type': tipo,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'referencia' } }),
  })
  if (!inicio.ok) throw new Error(`Google no aceptó la subida (${inicio.status}): ${(await inicio.text()).slice(0, 160)}`)
  const destino = inicio.headers.get('X-Goog-Upload-URL')
  if (!destino) throw new Error('Google no devolvió dónde subir el video.')

  const sube = await fetch(destino, {
    method: 'POST',
    headers: { 'Content-Length': String(datos.byteLength), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: datos,
  })
  if (!sube.ok) throw new Error(`Falló la subida del video (${sube.status})`)
  const j = await sube.json()
  const nombre = j?.file?.name
  const uri = j?.file?.uri
  if (!nombre || !uri) throw new Error('Google no devolvió el video subido.')

  // esperar a que esté listo (un reel tarda unos segundos)
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${BASE}/v1beta/${nombre}?key=${GEMINI_API_KEY}`)
    const f = await r.json()
    if (f?.state === 'ACTIVE') return uri
    if (f?.state === 'FAILED') throw new Error('Google no pudo procesar ese video.')
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('El video tardó demasiado en prepararse. Prueba con uno más corto.')
}

async function borrarVideo(uri: string) {
  try {
    const nombre = uri.split('/files/')[1]
    if (nombre) await fetch(`${BASE}/v1beta/files/${nombre}?key=${GEMINI_API_KEY}`, { method: 'DELETE' })
  } catch (_) { /* si no se borra, Google lo tira solo a las 48 h */ }
}

/* Lo que se le pide mirar. La definición de open loop visual es la de Sergio: algo que aparece y
   rompe la expectativa, y hace seguir viendo aunque no diga nada. */
const INSTRUCCION = `Miras videos cortos de redes para entender qué RETIENE la atención con la imagen, no con lo que se dice.
Devuelves SOLO JSON:
{"gancho":{"que":"...","porque":"...","seg":0},"visuales":[{"seg":7,"que":"...","porque":"...","tipo":"loop"}],"vozCortada":[{"seg":6,"dice":"...","porque":"..."}],"cortes":12,"nota":"..."}

- gancho: qué se VE en los primeros 2 segundos, antes de que dé tiempo a entender lo que dice. que = lo que aparece en pantalla (máx. 14 palabras). porque = por qué hace parar el scroll (máx. 12 palabras).
- visuales: los momentos donde la IMAGEN hace seguir viendo. Sobre todo los OPEN LOOPS VISUALES: algo inesperado o absurdo que irrumpe y rompe la expectativa — a la persona la atropella un tren, cae un carro del cielo, un rayo parte el cielo, aparece de golpe un objeto que no pinta nada. Suelen caer justo cuando la voz deja una frase a medias, y hacen seguir viendo aunque no digan nada.
  tipo: "loop" si es una irrupción inesperada que rompe la expectativa; "apoyo" si solo ilustra lo que se dice (una captura, un gráfico, un b-roll normal); "cambio" si es solo un cambio de plano o de encuadre de la misma persona.
  seg: el segundo en que ocurre. que: qué se ve, máx. 14 palabras. porque: por qué hace seguir viendo, máx. 12 palabras.
  Ordénalos por segundo. Máximo 12. Si el video no tiene ninguno, visuales = [].
- vozCortada: los momentos donde la VOZ DEJA UNA FRASE A MEDIAS y no la termina. La persona va a decir algo concreto —el dato, la clave, la palabra que promete— y justo ahí la interrumpe un corte de edición, un elemento que irrumpe, o simplemente se calla y cambia de tema. ESCUCHA el audio: cuenta lo que de verdad se oye, no lo que tendría sentido.
  dice: lo que ALCANZA a decir antes de cortarse, copiado tal cual se oye y terminado en «...» (máx. 16 palabras). No lo completes NUNCA, ni aunque sea obvio cómo seguiría.
  seg: el segundo en que se corta. porque: qué lo interrumpe, máx. 10 palabras (ej.: «lo atropella un tren», «corta a otro plano»).
  Esto es importante y no se puede sacar de una transcripción: las transcripciones automáticas completan las frases cortadas por su cuenta, a veces inventando la palabra que falta. Tú lo oyes, así que márcalo.
  Ordénalos por segundo. Máximo 8. Si la voz nunca se corta, vozCortada = [].
- cortes: cuántos cortes de plano tiene el video en total, contados.
- nota: en una frase, cómo sostiene la atención este video con la imagen (máx. 20 palabras). Sin elogios.
Describe lo que hay, no lo que te parece bueno. En español.`

async function mirar(uri: string, tipo: string, dur: number): Promise<any> {
  const cuerpo = {
    contents: [{
      role: 'user',
      parts: [
        { fileData: { fileUri: uri, mimeType: tipo } },
        { text: `El video dura ${dur || '?'} segundos. Analízalo entero.` },
      ],
    }],
    systemInstruction: { parts: [{ text: INSTRUCCION }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 4000 },
  }
  let ultimo = ''
  for (const modelo of MODELOS) {
    const r = await fetch(`${BASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    })
    if (!r.ok) { ultimo = `${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`; console.warn('[lab-ver-video] ' + ultimo); continue }
    const j = await r.json()
    const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
    try { const o = JSON.parse(txt); if (o && typeof o === 'object') return o } catch (_) { ultimo = `${modelo}: no devolvió JSON` }
  }
  throw new Error('No se pudo analizar el video. ' + ultimo.slice(0, 120))
}

const t = (s: any, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  let uri = ''
  try {
    if (!GEMINI_API_KEY) return responder({ error: 'Falta la llave de Google (GEMINI_API_KEY) para poder ver videos.' }, 503)
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)

    const entrada = await req.formData()
    const video = entrada.get('video')
    if (!(video instanceof File)) return responder({ error: 'No llegó el video.' }, 400)
    if (video.size > TOPE) return responder({ error: 'Ese video pesa demasiado. Con el reel basta.' }, 400)
    const dur = Math.max(0, Math.round(Number(entrada.get('dur')) || 0))
    const tipo = video.type || 'video/mp4'

    const t0 = Date.now()
    uri = await subirVideo(new Uint8Array(await video.arrayBuffer()), tipo)
    const o = await mirar(uri, tipo, dur)

    const g = o?.gancho || {}
    const visuales = (Array.isArray(o.visuales) ? o.visuales : [])
      .map((v: any) => ({
        seg: Math.max(0, Math.min(dur || 9999, Math.round(Number(v?.seg) || 0))),
        que: t(v?.que, 160), porque: t(v?.porque, 140),
        tipo: ['loop', 'apoyo', 'cambio'].includes(v?.tipo) ? v.tipo : 'apoyo',
      }))
      .filter((v: any) => v.que)
      .sort((a: any, b: any) => a.seg - b.seg)
      .slice(0, 12)

    const vozCortada = (Array.isArray(o.vozCortada) ? o.vozCortada : [])
      .map((v: any) => ({
        seg: Math.max(0, Math.min(dur || 9999, Math.round(Number(v?.seg) || 0))),
        // si se ha dejado llevar y la ha completado, al menos queda claro que estaba cortada
        dice: t(v?.dice, 200).replace(/[.…]*$/, '') + '…',
        porque: t(v?.porque, 120),
      }))
      .filter((v: any) => v.dice.length > 6)
      .sort((a: any, b: any) => a.seg - b.seg)
      .slice(0, 8)

    const loopsVisuales = visuales.filter((v: any) => v.tipo === 'loop')
    console.log(`[lab-ver-video] ${uid.slice(0, 8)}: ${visuales.length} momentos (${loopsVisuales.length} loops) de ${dur || '?'} s en ${((Date.now() - t0) / 1000).toFixed(1)} s`)

    return responder({
      gancho: g?.que ? { que: t(g.que, 160), porque: t(g.porque, 140), seg: Math.max(0, Math.round(Number(g?.seg) || 0)) } : null,
      visuales,
      vozCortada,
      loopsVisuales: loopsVisuales.length,
      cortes: Math.max(0, Math.round(Number(o?.cortes) || 0)),
      nota: t(o?.nota, 200),
      segundos: (Date.now() - t0) / 1000,
    })
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  } finally {
    if (uri) await borrarVideo(uri)      // no dejar los videos de nadie en Google
  }
})

// color-silueta v1 (27-sep-2026) — la silueta de la persona para la VISTA PREVIA del look «Selectivo».
//
// El look Selectivo colorea el fondo con una receta y a la persona con otra (la piel y la madera tienen el mismo
// tono: un look parejo no las separa). La página necesita la silueta de TODO el video que está mostrando para pintar
// lo mismo que va a salir. Esta función:
//   · comprueba que el video es de quien lo pide (un render suyo o un clip suyo);
//   · si la silueta ya existe (`<video>_silueta.mp4`, la guarda el ensamblador), la devuelve;
//   · si no, le pide al ensamblador (modo «silueta», sin esperar) que la saque. La página vuelve a preguntar.
// La misma silueta la usa después el ensamblador al generar el video: se recorta una sola vez por video.

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BUCKET = 'remotionlambda-useast1-editorvideo'
const REGION = Deno.env.get('AWS_REGION') || 'us-east-1'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })
const urlDe = (key: string) => `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`

async function tabla(ruta: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, { headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` } })
  return r.ok ? await r.json() : []
}

/* Invocar el ensamblador sin esperar (misma firma SigV4 que invoke-lambda) */
async function invocarSinEsperar(functionName: string, payload: object) {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') || ''
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''
  const bodyStr = JSON.stringify(payload)
  const enc = new TextEncoder()
  const now = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const host = `lambda.${REGION}.amazonaws.com`
  const path = `/2015-03-31/functions/${encodeURIComponent(functionName)}/invocations`
  const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
  const bodyHash = hex(await crypto.subtle.digest('SHA-256', enc.encode(bodyStr)))
  const canonHeaders = `host:${host}\nx-amz-date:${amzDate}\nx-amz-invocation-type:Event\n`
  const signedHeaders = 'host;x-amz-date;x-amz-invocation-type'
  const canonReq = `POST\n${path}\n\n${canonHeaders}\n${signedHeaders}\n${bodyHash}`
  const credScope = `${dateStamp}/${REGION}/lambda/aws4_request`
  const strToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${hex(await crypto.subtle.digest('SHA-256', enc.encode(canonReq)))}`
  const hmac = async (key: ArrayBuffer, msg: string) => {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return crypto.subtle.sign('HMAC', k, enc.encode(msg))
  }
  let sigKey = await hmac(enc.encode('AWS4' + secretAccessKey).buffer, dateStamp)
  sigKey = await hmac(sigKey, REGION)
  sigKey = await hmac(sigKey, 'lambda')
  sigKey = await hmac(sigKey, 'aws4_request')
  const signature = hex(await hmac(sigKey, strToSign))
  return fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Host': host, 'X-Amz-Date': amzDate, 'X-Amz-Invocation-Type': 'Event',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: bodyStr,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } })
    if (!u.ok) return responder({ ok: false, error: 'Entra otra vez' }, 401)
    const usuario = await u.json()
    const body = await req.json().catch(() => ({}))
    const url = String(body?.url || '').split('?')[0]
    const key = url.includes('.amazonaws.com/') ? decodeURIComponent(url.split('.amazonaws.com/')[1]) : ''
    if (!key || !/^[\w\-./]+\.mp4$/i.test(key) || key.includes('..')) return responder({ ok: false, error: 'Video no válido' }, 400)

    // ¿es suyo? un render de un proyecto suyo (su video sin subtítulos) o un clip suyo
    let suyo = false
    const renders = await tabla(`renders?video_sin_subtitulos=eq.${encodeURIComponent(urlDe(key))}&select=project_id&limit=1`)
    if (renders.length) {
      const pr = await tabla(`projects?id=eq.${renders[0].project_id}&user_id=eq.${usuario.id}&select=id&limit=1`)
      suyo = pr.length > 0
    }
    if (!suyo) {
      const clips = await tabla(`clips?mp4_path=eq.${encodeURIComponent(key)}&user_id=eq.${usuario.id}&select=id&limit=1`)
      suyo = clips.length > 0
    }
    if (!suyo) return responder({ ok: false, error: 'Ese video no es tuyo' }, 403)

    const claveSil = key.replace(/(\.mp4)?$/i, '_silueta2.mp4')   // (29-sep) 608x1080; las «_silueta» eran de 304x540
    const ya = await fetch(urlDe(claveSil), { method: 'HEAD' })
    if (ya.ok) return responder({ ok: true, listo: true, url: urlDe(claveSil) })
    const r = await invocarSinEsperar('carrete-assembler', { modo: 'silueta', key })
    return responder({ ok: r.status >= 200 && r.status < 300, listo: false, url: urlDe(claveSil) })
  } catch (e) {
    return responder({ ok: false, error: String(e).slice(0, 200) }, 500)
  }
})

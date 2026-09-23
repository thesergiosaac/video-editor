// invoke-lambda v3 — solo llamadas internas y solo la Lambda de procesamiento (16-sep-2026)
// invoke-lambda v2 - SigV4 nativo (sin npm:@aws-sdk), compatible con Deno/Edge Runtime
const CORS_H = { 'Content-Type': 'application/json' };

async function invokeLambdaSigV4(functionName: string, payload: object, isSync: boolean) {
  const region = Deno.env.get('AWS_REGION') || 'us-east-1'
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') || ''
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''

  const bodyStr = JSON.stringify(payload)
  const enc = new TextEncoder()

  const now = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'

  const host = `lambda.${region}.amazonaws.com`
  const path = `/2015-03-31/functions/${encodeURIComponent(functionName)}/invocations`
  const invType = isSync ? 'RequestResponse' : 'Event'

  const bodyHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(bodyStr)))
  ).map(b => b.toString(16).padStart(2, '0')).join('')

  const canonHeaders = `host:${host}\nx-amz-date:${amzDate}\nx-amz-invocation-type:${invType}\n`
  const signedHeaders = 'host;x-amz-date;x-amz-invocation-type'
  const canonReq = `POST\n${path}\n\n${canonHeaders}\n${signedHeaders}\n${bodyHash}`

  const credScope = `${dateStamp}/${region}/lambda/aws4_request`
  const reqHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(canonReq)))
  ).map(b => b.toString(16).padStart(2, '0')).join('')
  const strToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${reqHash}`

  async function hmac(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return crypto.subtle.sign('HMAC', k, enc.encode(msg))
  }

  let sigKey = await hmac(enc.encode('AWS4' + secretAccessKey).buffer, dateStamp)
  sigKey = await hmac(sigKey, region)
  sigKey = await hmac(sigKey, 'lambda')
  sigKey = await hmac(sigKey, 'aws4_request')

  const sigBytes = await hmac(sigKey, strToSign)
  const signature = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const resp = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': host,
      'X-Amz-Date': amzDate,
      'X-Amz-Invocation-Type': invType,
      'Authorization': authHeader,
    },
    body: bodyStr,
  })

  return resp
}


// ── Solo llamadas internas del servidor (16-sep-2026) ───────────────────────
// La usan la base de datos (disparador de clips) y otras funciones con la llave de servicio.
const INTERNA_URL = Deno.env.get('SUPABASE_URL') ?? ''
async function esLlamadaInterna(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  const conocidas = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v)
  if (conocidas.includes(token)) return true
  try {
    // Solo la llave de servicio puede leer la lista de usuarios: si responde, es interna.
    const r = await fetch(`${INTERNA_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    })
    return r.ok
  } catch (_) { return false }
}

const LAMBDAS_PERMITIDAS = ['carrete-media-processor']

Deno.serve(async (req) => {
  if (!(await esLlamadaInterna(req))) {
    return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), { status: 401, headers: CORS_H })
  }
  try {
    const body = await req.json()
    const isSync = body.sync === true
    const payload = body.payload !== undefined ? body.payload : body
    const functionName = body.functionName || 'carrete-media-processor'
    if (!LAMBDAS_PERMITIDAS.includes(functionName)) {
      return new Response(JSON.stringify({ ok: false, error: 'Lambda no permitida' }), { status: 400, headers: CORS_H })
    }

    const resp = await invokeLambdaSigV4(functionName, payload, isSync)
    const statusCode = resp.status

    let result = null
    if (isSync) {
      try { result = await resp.json() } catch(_) { result = await resp.text().catch(() => null) }
    }

    return new Response(
      JSON.stringify({ ok: statusCode >= 200 && statusCode < 300, statusCode, result }),
      { headers: CORS_H }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: CORS_H }
    )
  }
})

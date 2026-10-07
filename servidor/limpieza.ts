// limpieza v1 (6-oct-2026) — dispara la limpieza diaria del depósito (fase 5 del plan del martes; reglas en
// servidor/sql/21-limpieza.sql y el trabajo en servidor/lambda-assembler/limpieza.js).
//
// La llama pg_cron una vez al día con la llave del reloj (la misma de ig-publicar, que se lee de su tarea: nunca se
// escribe). Solo invoca al ensamblador en modo 'limpieza', sin esperar: el ensamblador tiene los permisos del
// depósito y deja su informe en `limpieza_informes`. Con el interruptor (cherry_ajustes › limpieza) en 'ensayo' no se
// borra nada.

const LLAVE_RELOJ = Deno.env.get('IG_RELOJ_SECRETO') ?? ''
const AWS_REGION = Deno.env.get('AWS_REGION') ?? 'us-east-1'
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
const AWS_SESSION_TOKEN = Deno.env.get('AWS_SESSION_TOKEN') ?? ''

async function hmac(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key)
  const k = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
}
async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
const hexEncode = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')

/* La misma invocación firmada (SigV4) que usa orchestrate, en modo Event: no espera a que termine */
async function invocar(funcion: string, payload: object): Promise<number> {
  const body = JSON.stringify(payload)
  const host = `lambda.${AWS_REGION}.amazonaws.com`
  const path = `/2015-03-31/functions/${funcion}/invocations`
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = `${ymd}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`
  const payloadHash = await sha256hex(body)
  const headers: Record<string, string> = {
    host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash,
    'x-amz-invocation-type': 'Event', 'content-type': 'application/json',
  }
  if (AWS_SESSION_TOKEN) headers['x-amz-security-token'] = AWS_SESSION_TOKEN
  const firmados = Object.keys(headers).sort().join(';')
  const canon = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')
  const canonReq = ['POST', path, '', canon, firmados, payloadHash].join('\n')
  const alcance = `${ymd}/${AWS_REGION}/lambda/aws4_request`
  const aFirmar = `AWS4-HMAC-SHA256\n${amzDate}\n${alcance}\n${await sha256hex(canonReq)}`
  let k: ArrayBuffer = await hmac(`AWS4${AWS_SECRET_ACCESS_KEY}`, ymd)
  k = await hmac(k, AWS_REGION); k = await hmac(k, 'lambda'); k = await hmac(k, 'aws4_request')
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${alcance}, SignedHeaders=${firmados}, Signature=${hexEncode(await hmac(k, aFirmar))}`
  const r = await fetch(`https://${host}${path}`, { method: 'POST', headers, body })
  return r.status
}

Deno.serve(async (req) => {
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } })
  try {
    const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    if (!LLAVE_RELOJ || String(b?.llave || '') !== LLAVE_RELOJ) return responder({ error: 'No' }, 403)
    // `modo` solo para una corrida a mano (p. ej. un ensayo aunque el interruptor diga otra cosa)
    const modo = ['ensayo', 'intermedios', 'borrar'].includes(String(b?.modo)) ? String(b.modo) : undefined
    const status = await invocar('carrete-assembler', { modo: 'limpieza', ...(modo ? { modo_forzado: modo } : {}) })
    console.log(`[limpieza] ensamblador invocado (${status})${modo ? ' · ' + modo : ''}`)
    return responder({ ok: status === 202, status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[limpieza]', msg)
    return responder({ error: msg }, 500)
  }
})

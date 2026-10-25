// tt-publicar — publica en TikTok lo que Cherry programó (videos), con las opciones que TikTok exige
/* tt-publicar v1 (25-oct-2026) · Hermana de ig-publicar.ts.
 *
 * Modos:
 *   programar · (con sesión) apunta un video para una fecha, con privacidad y opciones escogidas por la persona
 *   ahora     · lo mismo, para ya
 *   mias      · (con sesión) lo mío: programado, publicado y fallido de los últimos 60 días
 *   quitar    · (con sesión) cancela uno que todavía no ha empezado a subir
 *   tanda     · lo que llama el reloj (cron `tt-publicar`, cada minuto). Va con la llave TT_RELOJ_SECRETO.
 *
 * ⚠️ TIKTOK NO PROGRAMA. La hora la dispara el reloj, igual que en Instagram.
 * ⚠️ TIKTOK NO BAJA EL VIDEO DE NUESTRAS DIRECCIONES: «PULL_FROM_URL» solo sirve con dominios verificados en su portal, y
 *    los videos viven en S3 / Supabase. Así que se SUBE (FILE_UPLOAD) en pedazos: cada pedazo se lee del original con
 *    Range y se le entrega a TikTok en orden. Reglas de TikTok: pedazos de 5–64 MB, el último puede llevar el sobrante
 *    (hasta 128 MB), menos de 64 MB va en uno solo; la dirección de subida vale UNA hora.
 * ⚠️ Y EN TRES TIEMPOS, cada vuelta del reloj un paso, con `bloqueo` para que dos vueltas no suban lo mismo:
 *    programada → (init + pedazos) subiendo → procesando → publicada | fallida
 * ⚠️ Sin la auditoría de TikTok: solo cuentas privadas, y todo sale como «solo yo» (TikTok lo fuerza).
 * ⚠️ Lo que se manda en post_info lo ESCOGIÓ la persona en el calendario (privacidad sin valor por defecto, comentarios,
 *    dúo, pegar, contenido comercial, IA): lo exige TikTok. Aquí solo se valida, nunca se inventa.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
/* (25-oct) Dos juegos de llaves: las del modo de pruebas de TikTok (Sandbox «Cherry pruebas») y las reales. Manda
   TT_ENTORNO: 'produccion' usa TT_CLIENT_KEY/TT_CLIENT_SECRET; cualquier otra cosa (o sin poner) usa las TT_SANDBOX_*.
   ⚠️ Una cuenta conectada en pruebas NO sirve en producción: al cambiar, cada persona vuelve a conectar su TikTok. */
const TT_ENTORNO = (Deno.env.get('TT_ENTORNO') ?? 'sandbox') === 'produccion' ? 'produccion' : 'sandbox'
const TT_KEY = ((TT_ENTORNO === 'produccion' ? Deno.env.get('TT_CLIENT_KEY') : Deno.env.get('TT_SANDBOX_CLIENT_KEY')) ?? '').trim()   // (25-oct) se pegó con un salto de línea al final
const TT_SECRETO = ((TT_ENTORNO === 'produccion' ? Deno.env.get('TT_CLIENT_SECRET') : Deno.env.get('TT_SANDBOX_CLIENT_SECRET')) ?? '').trim()
const LLAVE_RELOJ = Deno.env.get('TT_RELOJ_SECRETO') ?? ''
const API = 'https://open.tiktokapis.com/v2'

const MB = 1024 * 1024
const PEDAZO = 10 * MB                 // tamaño de cada pedazo cuando el video pasa de 64 MB
const UNO_SOLO = 64 * MB               // hasta aquí va en un solo pedazo
const TOPE_VIDEO = 4096 * MB           // lo que acepta TikTok
const PRESUPUESTO_MS = 110_000         // lo que una vuelta del reloj se permite subir antes de soltar
const VIGENCIA_SUBIDA_MS = 55 * 60_000 // la dirección de subida de TikTok vale 1 h: pasado esto se pide otra
const TOPE_INTENTOS = 60               // ~1 h mirando si TikTok terminó de procesar
const PRIVACIDADES = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function tabla(ruta: string, op: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...op,
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json', ...(op.headers || {}) },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}
async function quienEs(req: Request): Promise<string> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) throw new Error('Falta la sesión.')
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } })
  const u = r.ok ? await r.json().catch(() => null) : null
  if (!u?.id) throw new Error('La sesión no vale.')
  return u.id as string
}
const anotar = (id: string, campos: Record<string, unknown>) =>
  tabla(`publicaciones_tiktok?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...campos, actualizada: new Date().toISOString() }) })

async function tt(ruta: string, token: string | null, op: RequestInit = {}) {
  const r = await fetch(ruta.startsWith('http') ? ruta : `${API}${ruta}`, {
    ...op, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(op.headers || {}) } })
  const t = await r.text()
  let j: any = null
  try { j = JSON.parse(t) } catch (_) { /* no es JSON */ }
  const code = j?.error?.code
  if (!r.ok || (code && code !== 'ok')) {
    const e: any = new Error(String(j?.error?.message || j?.error_description || t).slice(0, 300))
    e.codigo = code || j?.error || r.status
    throw e
  }
  return j
}
const venceEn = (seg: unknown, porDefecto: number) => new Date(Date.now() + (Number(seg) || porDefecto) * 1000).toISOString()

/* ⚠️ La misma función está en tt-conectar.ts: si cambias una, cambia la otra. */
async function tokenVivo(c: any): Promise<string> {
  if (new Date(c.token_vence).getTime() - Date.now() > 10 * 60 * 1000) return c.token
  if (new Date(c.refresh_vence).getTime() < Date.now()) {
    await tabla(`cuentas_tiktok?user_id=eq.${c.user_id}&open_id=eq.${encodeURIComponent(c.open_id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'caducada' }) })
    throw new Error('La conexión con TikTok venció. Vuelve a conectar la cuenta.')
  }
  const d = await tt('/oauth/token/', null, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: TT_KEY, client_secret: TT_SECRETO, grant_type: 'refresh_token', refresh_token: c.refresh_token }).toString() })
  const campos = { token: d.access_token, token_vence: venceEn(d.expires_in, 86400), refresh_token: d.refresh_token || c.refresh_token,
    refresh_vence: venceEn(d.refresh_expires_in, 31536000), refrescado: new Date().toISOString(), estado: 'activa' }
  await tabla(`cuentas_tiktok?user_id=eq.${c.user_id}&open_id=eq.${encodeURIComponent(c.open_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos) })
  Object.assign(c, campos)
  return c.token
}

/* ── El archivo original firmado (tal cual). ⚠️ Copiado de ig-publicar.ts (firmarS3, originalEsSuyo): si cambias uno, cambia el otro. ── */
const CUBO = 'remotionlambda-useast1-editorvideo'
const REGION_S3 = 'us-east-1'
const LLAVE_ORIGINAL = /^uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[^?#\\]+$/i
const enc3986 = (t: string) => encodeURIComponent(t).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const hexDe = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
async function hmacS3(llave: Uint8Array | ArrayBuffer, texto: string) {
  const k = await crypto.subtle.importKey('raw', llave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto))
}
async function firmarS3(key: string, segundos = 7200): Promise<string> {
  const id = Deno.env.get('AWS_ACCESS_KEY_ID') || '', secreto = Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''
  if (!id || !secreto) throw new Error('El servidor no tiene las llaves de AWS.')
  const host = `${CUBO}.s3.${REGION_S3}.amazonaws.com`
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dia = amz.slice(0, 8), alcance = `${dia}/${REGION_S3}/s3/aws4_request`
  const ruta = '/' + key.split('/').map(enc3986).join('/')
  const q: [string, string][] = [['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'], ['X-Amz-Credential', `${id}/${alcance}`], ['X-Amz-Date', amz],
    ['X-Amz-Expires', String(segundos)], ['X-Amz-SignedHeaders', 'host']]
  const sesion = Deno.env.get('AWS_SESSION_TOKEN') || ''
  if (sesion) q.push(['X-Amz-Security-Token', sesion])
  const canonQ = q.map(([k, v]) => [enc3986(k), enc3986(v)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('&')
  const canon = ['GET', ruta, canonQ, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const resumen = hexDe(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon)))
  let k: ArrayBuffer = await hmacS3(new TextEncoder().encode('AWS4' + secreto), dia)
  k = await hmacS3(k, REGION_S3); k = await hmacS3(k, 's3'); k = await hmacS3(k, 'aws4_request')
  const firma = hexDe(await hmacS3(k, ['AWS4-HMAC-SHA256', amz, alcance, resumen].join('\n')))
  return `https://${host}${ruta}?${canonQ}&X-Amz-Signature=${firma}`
}
async function originalEsSuyo(user: string, key: string) {
  if (!LLAVE_ORIGINAL.test(key)) return false
  const c = await tabla(`clips?storage_path=eq.${encodeURIComponent(key)}&user_id=eq.${user}&select=id&limit=1`)
  return Array.isArray(c) && c.length > 0
}

/* ── El MASTER. ⚠️ Misma lógica que prepararMaster de ig-publicar.ts (allá sobre publicaciones_programadas): si cambias una,
   cambia la otra. Nunca se publica la copia de edición: si el video es un render de Cherry que no es master, se pide. ── */
const ES_RENDER = /\/renders\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//
const renderDe = (url: string) => { const m = ES_RENDER.exec(String(url || '')); return m ? m[1] : null }
const esMaster = (r: any) => !!r && (((r.subtitle_config || {}) as Record<string, unknown>).calidad === 'original' || !!r.output_original_url)
async function prepararMaster(fila: any): Promise<string> {
  if (fila.master_estado === 'lista' || fila.master_estado === 'no') return fila.master_estado
  if ((fila.opciones || {}).original) { await anotar(fila.id, { master_estado: 'no' }); return 'no' }
  const rid = renderDe(fila.video_url)
  if (!rid && !fila.render_master) { await anotar(fila.id, { master_estado: 'no' }); fila.master_estado = 'no'; return 'no' }
  if (!fila.render_master) {
    const r = (await tabla(`renders?id=eq.${rid}&select=id,project_id,subtitle_config,output_original_url,output_url,status`))?.[0]
    if (!r) { await anotar(fila.id, { master_estado: 'no' }); fila.master_estado = 'no'; return 'no' }
    if (esMaster(r)) { await anotar(fila.id, { master_estado: 'lista' }); fila.master_estado = 'lista'; return 'lista' }
    const p = (await tabla(`projects?id=eq.${r.project_id}&select=user_id`))?.[0]
    if (!p || p.user_id !== fila.user_id) throw new Error('Ese video no es de esta cuenta.')
    const res = await fetch(`${SB_URL}/functions/v1/orchestrate`, { method: 'POST',
      headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: r.project_id, user_id: fila.user_id, reusar_render: rid, calidad: 'original' }) })
    const d: any = await res.json().catch(() => null)
    if (!res.ok || !d?.render_id) throw new Error('No se pudo pedir la calidad original: ' + JSON.stringify(d).slice(0, 200))
    await anotar(fila.id, { render_master: d.render_id, master_estado: 'preparando' })
    fila.render_master = d.render_id; fila.master_estado = 'preparando'
    return 'preparando'
  }
  const m = (await tabla(`renders?id=eq.${fila.render_master}&select=status,output_url,output_original_url,subtitle_config,error_message`))?.[0]
  if (m && m.status === 'done' && m.output_url && esMaster(m)) {
    await anotar(fila.id, { video_url: m.output_url, master_estado: 'lista' })
    fila.video_url = m.output_url; fila.master_estado = 'lista'
    return 'lista'
  }
  if (!m || m.status === 'error') {
    await anotar(fila.id, { master_estado: 'fallida', estado: 'fallida', error: ('No salió la calidad original: ' + (m?.error_message || 'el render no existe')).slice(0, 400) })
    return 'fallida'
  }
  return 'preparando'
}

/* ── Subir ── */
async function direccionDelVideo(fila: any): Promise<string> {
  const o = fila.opciones || {}
  return o.original ? await firmarS3(String(o.original)) : String(fila.video_url || '')
}
async function pesoDe(url: string): Promise<number> {
  const r = await fetch(url, { headers: { Range: 'bytes=0-0' } })
  await r.body?.cancel().catch(() => null)
  if (r.status !== 206 && r.status !== 200) throw new Error(`No se pudo leer el video (${r.status}).`)
  return Number(String(r.headers.get('content-range') || '').split('/')[1]) || Number(r.headers.get('content-length')) || 0
}
function pedazos(tam: number) {
  if (tam <= UNO_SOLO) return { chunk: tam, n: 1 }
  return { chunk: PEDAZO, n: Math.floor(tam / PEDAZO) }   // el último se lleva el sobrante (< 2 pedazos, < 128 MB)
}
const rango = (s: any, i: number) => {
  const ini = i * s.chunk
  return [ini, i === s.n - 1 ? s.tam - 1 : ini + s.chunk - 1]
}

/* Paso 1: pedir la subida a TikTok */
async function iniciar(fila: any, c: any) {
  const token = await tokenVivo(c)
  const url = await direccionDelVideo(fila)
  if (!/^https:/.test(url)) throw new Error('El video no tiene una dirección válida.')
  const tam = await pesoDe(url)
  if (!tam) throw new Error('No se pudo saber cuánto pesa el video.')
  if (tam > TOPE_VIDEO) throw new Error('El video pesa más de 4 GB, el tope de TikTok.')
  const { chunk, n } = pedazos(tam)
  const o = fila.opciones || {}
  const d = await tt('/post/publish/video/init/', token, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: String(fila.texto || '').slice(0, 2200),
        privacy_level: fila.privacidad,
        disable_comment: !o.comentarios, disable_duet: !o.duo, disable_stitch: !o.pegar,
        brand_content_toggle: !!o.contenido_marca, brand_organic_toggle: !!o.marca_propia,
        is_aigc: !!o.ia,
      },
      source_info: { source: 'FILE_UPLOAD', video_size: tam, chunk_size: chunk, total_chunk_count: n },
    }),
  })
  const subida = { url: d.data.upload_url, tam, chunk, n, siguiente: 0, inicio: Date.now() }
  await anotar(fila.id, { estado: 'subiendo', publish_id: d.data.publish_id, subida, error: null })
  fila.estado = 'subiendo'; fila.publish_id = d.data.publish_id; fila.subida = subida
  console.log(`[tt-publicar] ${fila.id} · subida pedida (${(tam / MB).toFixed(1)} MB en ${n} pedazo(s))`)
}

/* Paso 2: subir pedazos hasta terminar o hasta que se acabe el tiempo de esta vuelta */
async function subirPedazos(fila: any, hasta: number) {
  const s = fila.subida
  const origen = await direccionDelVideo(fila)
  while (s.siguiente < s.n && Date.now() < hasta) {
    const [a, b] = rango(s, s.siguiente)
    const r = await fetch(origen, { headers: { Range: `bytes=${a}-${b}` } })
    if (r.status !== 206 && r.status !== 200) throw new Error(`No se pudo leer el pedazo ${s.siguiente + 1} (${r.status}).`)
    const datos = new Uint8Array(await r.arrayBuffer())
    if (datos.byteLength !== b - a + 1) throw new Error(`El pedazo ${s.siguiente + 1} llegó incompleto.`)
    const p = await fetch(s.url, { method: 'PUT', body: datos,
      headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${a}-${b}/${s.tam}` } })
    if (![200, 201, 206].includes(p.status)) throw new Error(`TikTok no aceptó el pedazo ${s.siguiente + 1} (${p.status}): ${(await p.text()).slice(0, 200)}`)
    await p.body?.cancel().catch(() => null)
    s.siguiente++
    await anotar(fila.id, { subida: s })
  }
  if (s.siguiente >= s.n) {
    await anotar(fila.id, { estado: 'procesando', intentos: 0 })
    console.log(`[tt-publicar] ${fila.id} · subido completo, TikTok lo procesa`)
  }
}

/* Paso 3: preguntar cómo va */
async function mirar(fila: any, c: any) {
  const token = await tokenVivo(c)
  const d = await tt('/post/publish/status/fetch/', token, { method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ publish_id: fila.publish_id }) })
  const st = d?.data?.status
  if (st === 'PUBLISH_COMPLETE') {
    const pid = (d.data.publicaly_available_post_id || [])[0]
    await anotar(fila.id, { estado: 'publicada', post_id: pid ? String(pid) : null, error: null })
    console.log(`[tt-publicar] ${fila.id} · publicada ${pid || '(privada: sin id público)'}`)
  } else if (st === 'FAILED') {
    await anotar(fila.id, { estado: 'fallida', error: `TikTok no la publicó: ${d.data.fail_reason || 'sin motivo'}` })
  } else if ((fila.intentos || 0) + 1 >= TOPE_INTENTOS) {
    await anotar(fila.id, { estado: 'fallida', error: 'TikTok lleva más de una hora procesándola sin terminar.' })
  } else {
    await anotar(fila.id, { intentos: (fila.intentos || 0) + 1 })
  }
}

/* Que dos vueltas del reloj no trabajen la misma fila: se la «toma» solo si nadie la tiene (o se le venció) */
async function tomar(id: string, segundos: number): Promise<boolean> {
  const ahora = new Date().toISOString()
  const r = await tabla(`publicaciones_tiktok?id=eq.${id}&or=(bloqueo.is.null,bloqueo.lt.${encodeURIComponent(ahora)})`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ bloqueo: new Date(Date.now() + segundos * 1000).toISOString() }) })
  return Array.isArray(r) && r.length > 0
}
const soltar = (id: string) => tabla(`publicaciones_tiktok?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ bloqueo: null }) })

async function tanda() {
  const hasta = Date.now() + PRESUPUESTO_MS
  const ahora = new Date().toISOString()
  // los que esperan su master (aunque falte para la hora: así está listo a tiempo)
  for (const f of (await tabla(`publicaciones_tiktok?estado=eq.programada&master_estado=is.null&select=*&limit=20`)) || [])
    await prepararMaster(f).catch((e) => console.warn('[tt-publicar] master', f.id, String(e).slice(0, 150)))
  for (const f of (await tabla(`publicaciones_tiktok?estado=eq.programada&master_estado=eq.preparando&select=*&limit=20`)) || [])
    await prepararMaster(f).catch((e) => console.warn('[tt-publicar] master', f.id, String(e).slice(0, 150)))

  const filas = (await tabla(`publicaciones_tiktok?estado=in.(programada,subiendo,procesando)&publicar_el=lte.${encodeURIComponent(ahora)}&select=*&order=publicar_el.asc&limit=10`)) || []
  for (const f of filas) {
    if (Date.now() > hasta) break
    if (f.estado === 'programada' && !['lista', 'no'].includes(f.master_estado)) continue
    if (!(await tomar(f.id, 150))) continue
    try {
      const c = (await tabla(`cuentas_tiktok?user_id=eq.${f.user_id}&open_id=eq.${encodeURIComponent(f.open_id)}&select=*`))?.[0]
      if (!c || c.estado !== 'activa') { await anotar(f.id, { estado: 'fallida', error: 'La cuenta de TikTok ya no está conectada.' }); continue }
      if (f.estado === 'subiendo' && Date.now() - Number(f.subida?.inicio || 0) > VIGENCIA_SUBIDA_MS) {
        // la dirección de subida venció a medias: se empieza de nuevo (TikTok descarta la subida vieja)
        await anotar(f.id, { estado: 'programada', subida: null, publish_id: null, intentos: (f.intentos || 0) + 1 }); f.estado = 'programada'
        if ((f.intentos || 0) + 1 > 3) { await anotar(f.id, { estado: 'fallida', error: 'No se pudo terminar de subir el video a TikTok.' }); continue }
      }
      if (f.estado === 'programada') await iniciar(f, c)
      if (f.estado === 'subiendo') await subirPedazos(f, hasta)
      else if (f.estado === 'procesando') await mirar(f, c)
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 400)
      console.error('[tt-publicar]', f.id, e?.codigo || '', msg)
      const fatal = ['unaudited_client_can_only_post_to_private_accounts', 'privacy_level_option_mismatch', 'spam_risk_user_banned_from_posting',
        'scope_not_authorized', 'invalid_param'].includes(String(e?.codigo))
      const n = (f.intentos || 0) + 1
      await anotar(f.id, fatal || n >= 5
        ? { estado: 'fallida', error: e?.codigo === 'unaudited_client_can_only_post_to_private_accounts'
            ? 'TikTok todavía no aprueba a Cherry: por ahora solo se puede publicar en cuentas privadas.' : msg }
        : { intentos: n, error: msg })
    } finally { await soltar(f.id).catch(() => null) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const b = await req.json().catch(() => ({}))

    if (b.modo === 'tanda') {
      if (!LLAVE_RELOJ || b.llave !== LLAVE_RELOJ) return responder({ error: 'no' }, 401)
      // se responde ya y se sigue trabajando (el reloj no espera; subir un video puede tomar más de un minuto)
      // deno-lint-ignore no-explicit-any
      const er = (globalThis as any).EdgeRuntime
      const trabajo = tanda().catch((e) => console.error('[tt-publicar] tanda', String(e).slice(0, 300)))
      if (er?.waitUntil) { er.waitUntil(trabajo); return responder({ ok: true, en_curso: true }) }
      await trabajo
      return responder({ ok: true })
    }

    const user = await quienEs(req)

    if (b.modo === 'mias') {
      const desde = new Date(Date.now() - 60 * 86400 * 1000).toISOString()
      const filas = await tabla(`publicaciones_tiktok?user_id=eq.${user}&publicar_el=gte.${encodeURIComponent(desde)}&select=id,open_id,texto,privacidad,publicar_el,estado,post_id,error,creada&order=publicar_el.desc&limit=200`)
      return responder({ publicaciones: filas || [] })
    }

    if (b.modo === 'quitar') {
      await tabla(`publicaciones_tiktok?id=eq.${encodeURIComponent(String(b.id || ''))}&user_id=eq.${user}&estado=eq.programada`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'cancelada', actualizada: new Date().toISOString() }) })
      return responder({ ok: true })
    }

    if (b.modo === 'programar' || b.modo === 'ahora') {
      const c = (await tabla(`cuentas_tiktok?user_id=eq.${user}&open_id=eq.${encodeURIComponent(String(b.open_id || ''))}&select=open_id,estado`))?.[0]
      if (!c || c.estado !== 'activa') return responder({ error: 'Esa cuenta de TikTok no está conectada.' }, 400)
      if (!PRIVACIDADES.includes(b.privacidad)) return responder({ error: 'Escoge quién puede ver el video.' }, 400)
      const o = b.opciones || {}
      const opciones: Record<string, unknown> = {
        comentarios: !!o.comentarios, duo: !!o.duo, pegar: !!o.pegar,
        marca_propia: !!o.marca_propia, contenido_marca: !!o.contenido_marca, ia: !!o.ia,
      }
      if (opciones.contenido_marca && b.privacidad === 'SELF_ONLY')
        return responder({ error: 'El contenido de marca no puede ser privado: cambia quién puede verlo.' }, 400)
      const texto = String(b.texto || '')
      if (texto.length > 2200) return responder({ error: 'El texto pasa de 2.200 caracteres, el tope de TikTok.' }, 400)
      let video_url: string | null = b.video_url ? String(b.video_url) : null
      const render_master = b.render_master ? String(b.render_master) : null
      if (b.original) {
        if (!(await originalEsSuyo(user, String(b.original)))) return responder({ error: 'Ese archivo no es tuyo.' }, 400)
        opciones.original = String(b.original)
      }
      if (!render_master && !opciones.original && !/^https:\/\//.test(video_url || '')) return responder({ error: 'Falta el video.' }, 400)
      const cuando = b.modo === 'ahora' ? new Date() : new Date(b.publicar_el)
      if (isNaN(cuando.getTime())) return responder({ error: 'La fecha no vale.' }, 400)
      const fila = (await tabla('publicaciones_tiktok', { method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: user, open_id: c.open_id, video_url: video_url || (render_master ? `https://cherrysweet.app/fabricando/${render_master}` : null),
          render_master, master_estado: render_master ? 'preparando' : null, texto, privacidad: b.privacidad, opciones, publicar_el: cuando.toISOString() }) }))?.[0]
      return responder({ publicacion: { id: fila.id, estado: fila.estado, publicar_el: fila.publicar_el } })
    }

    return responder({ error: 'modo desconocido' }, 400)
  } catch (e: any) {
    console.error('[tt-publicar]', String(e?.message || e).slice(0, 300))
    return responder({ error: String(e?.message || e) }, 400)
  }
})

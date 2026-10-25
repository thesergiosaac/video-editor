// yt-publicar — publica en YouTube lo que Cherry programó (videos y Shorts)
/* yt-publicar v1 (25-oct-2026) · Hermana de tt-publicar.ts.
 *
 * Modos:
 *   programar · (con sesión) apunta un video para una fecha, con título, privacidad y «¿es para niños?»
 *   ahora     · lo mismo, para ya
 *   mias      · (con sesión) lo mío: programado, publicado y fallido de los últimos 60 días
 *   quitar    · (con sesión) cancela uno que todavía no ha empezado a subir
 *   tanda     · lo que llama el reloj (cron `yt-publicar`, cada minuto). Va con la llave YT_RELOJ_SECRETO.
 *
 * ⚠️ La hora la dispara el reloj, igual que Instagram y TikTok (no se usa status.publishAt de YouTube: así las tres redes
 *    salen por el mismo camino y lo programado se puede mover o quitar desde Cherry hasta el último minuto).
 * ⚠️ Se SUBE con la «subida reanudable» de Google: se abre una sesión (vale una semana) y se mandan pedazos de 8 MB
 *    (múltiplos de 256 KB, el último con lo que sobre). YouTube contesta 308 con hasta dónde recibió; con el último
 *    pedazo devuelve el video. Si una vuelta del reloj no alcanza, la siguiente sigue donde quedó.
 * ⚠️ YouTube decide solo si es Short: vertical (o cuadrado) y de 3 minutos o menos.
 * ⚠️ «¿Es para niños?» lo exige YouTube (ley COPPA): lo escoge la persona, aquí nunca se inventa.
 * ⚠️ Cupo: cada subida gasta del cupo «Video Uploads» del proyecto de Google Cloud (100 por día).
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const YT_ID = (Deno.env.get('YT_CLIENT_ID') ?? '').trim()
const YT_SECRETO = (Deno.env.get('YT_CLIENT_SECRET') ?? '').trim()
const LLAVE_RELOJ = Deno.env.get('YT_RELOJ_SECRETO') ?? ''
const API = 'https://www.googleapis.com/youtube/v3'

const MB = 1024 * 1024
const PEDAZO = 8 * MB                  // múltiplo de 256 KB, como pide Google
const TOPE_VIDEO = 256 * 1024 * MB     // lo que acepta YouTube (256 GB)
const PRESUPUESTO_MS = 110_000         // lo que una vuelta del reloj se permite subir antes de soltar
const VIGENCIA_SUBIDA_MS = 6 * 86400_000 // la sesión de subida vale una semana: pasado esto se abre otra
const TOPE_INTENTOS = 60               // ~1 h mirando si YouTube terminó de procesar
const PRIVACIDADES = ['public', 'unlisted', 'private']

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
  tabla(`publicaciones_youtube?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...campos, actualizada: new Date().toISOString() }) })

async function gg(ruta: string, token: string | null, op: RequestInit = {}) {
  const r = await fetch(ruta.startsWith('http') ? ruta : `${API}${ruta}`, {
    ...op, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(op.headers || {}) } })
  const t = await r.text()
  let j: any = null
  try { j = JSON.parse(t) } catch (_) { /* no es JSON */ }
  if (!r.ok) {
    const err = j?.error
    const e: any = new Error(String((typeof err === 'object' ? err?.message : j?.error_description) || t).slice(0, 300))
    e.codigo = (typeof err === 'object' ? err?.errors?.[0]?.reason || err?.status : err) || r.status
    throw e
  }
  return { j, r }
}
const venceEn = (seg: unknown, porDefecto: number) => new Date(Date.now() + (Number(seg) || porDefecto) * 1000).toISOString()
const filtro = (c: any) => `cuentas_youtube?user_id=eq.${c.user_id}&canal_id=eq.${encodeURIComponent(c.canal_id)}`

/* ⚠️ La misma función está en yt-conectar.ts: si cambias una, cambia la otra. */
async function tokenVivo(c: any): Promise<string> {
  if (new Date(c.token_vence).getTime() - Date.now() > 5 * 60 * 1000) return c.token
  try {
    const { j: d } = await gg('https://oauth2.googleapis.com/token', null, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: YT_ID, client_secret: YT_SECRETO, grant_type: 'refresh_token', refresh_token: c.refresh_token }).toString() })
    const campos = { token: d.access_token, token_vence: venceEn(d.expires_in, 3600), ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}),
      refrescado: new Date().toISOString(), estado: 'activa' }
    await tabla(filtro(c), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos) })
    Object.assign(c, campos)
    return c.token
  } catch (e: any) {
    if (/invalid_grant/i.test(String(e.codigo) + e.message)) {
      await tabla(filtro(c), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'caducada' }) })
      throw new Error('YouTube ya no acepta la conexión de Cherry. Vuelve a conectar el canal.')
    }
    throw e
  }
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

/* ── El MASTER. ⚠️ Misma lógica que prepararMaster de ig-publicar.ts y tt-publicar.ts: si cambias una, cambia las otras. ── */
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

/* Paso 1: abrir la subida reanudable con los datos del video */
async function iniciar(fila: any, c: any) {
  const token = await tokenVivo(c)
  const url = await direccionDelVideo(fila)
  if (!/^https:/.test(url)) throw new Error('El video no tiene una dirección válida.')
  const tam = await pesoDe(url)
  if (!tam) throw new Error('No se pudo saber cuánto pesa el video.')
  if (tam > TOPE_VIDEO) throw new Error('El video pesa más de lo que acepta YouTube.')
  const o = fila.opciones || {}
  const cuerpo = {
    snippet: {
      title: String(fila.titulo || '').slice(0, 100), description: String(fila.descripcion || '').slice(0, 5000),
      ...(Array.isArray(o.etiquetas) && o.etiquetas.length ? { tags: o.etiquetas } : {}), categoryId: '22',
    },
    status: { privacyStatus: fila.privacidad, selfDeclaredMadeForKids: !!o.para_ninos, containsSyntheticMedia: !!o.ia, embeddable: true },
  }
  const avisar = o.avisar === false ? 'false' : 'true'
  const { r } = await gg(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${avisar}`, token, {
    method: 'POST', body: JSON.stringify(cuerpo),
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(tam), 'X-Upload-Content-Type': 'video/mp4' } })
  const sesion = r.headers.get('location')
  if (!sesion) throw new Error('YouTube no abrió la subida.')
  const subida = { url: sesion, tam, enviado: 0, inicio: Date.now() }
  await anotar(fila.id, { estado: 'subiendo', subida, error: null })
  fila.estado = 'subiendo'; fila.subida = subida
  console.log(`[yt-publicar] ${fila.id} · subida abierta (${(tam / MB).toFixed(1)} MB)`)
}

/* Paso 2: mandar pedazos hasta terminar o hasta que se acabe el tiempo de esta vuelta */
async function subirPedazos(fila: any, c: any, hasta: number) {
  const s = fila.subida
  const origen = await direccionDelVideo(fila)
  while (s.enviado < s.tam && Date.now() < hasta) {
    const a = s.enviado, b = Math.min(a + PEDAZO, s.tam) - 1
    const r = await fetch(origen, { headers: { Range: `bytes=${a}-${b}` } })
    if (r.status !== 206 && r.status !== 200) throw new Error(`No se pudo leer el video desde ${a} (${r.status}).`)
    const datos = new Uint8Array(await r.arrayBuffer())
    if (datos.byteLength !== b - a + 1) throw new Error('Un pedazo del video llegó incompleto.')
    const token = await tokenVivo(c)
    const p = await fetch(s.url, { method: 'PUT', body: datos,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${a}-${b}/${s.tam}` } })
    if (p.status === 308) {
      // «recibí hasta aquí»: se sigue desde lo que YouTube dice que tiene (no desde lo que creemos haber mandado)
      const rg = /bytes=0-(\d+)/.exec(p.headers.get('range') || '')
      s.enviado = rg ? Number(rg[1]) + 1 : 0
      await p.body?.cancel().catch(() => null)
      await anotar(fila.id, { subida: s })
      continue
    }
    const t = await p.text()
    if (p.status === 200 || p.status === 201) {
      const v = JSON.parse(t)
      s.enviado = s.tam
      await anotar(fila.id, { estado: 'procesando', subida: s, video_id: v.id, intentos: 0 })
      fila.estado = 'procesando'; fila.video_id = v.id
      console.log(`[yt-publicar] ${fila.id} · subido completo, video ${v.id}; YouTube lo procesa`)
      return
    }
    if (p.status === 404 || p.status === 410) {
      // la sesión de subida murió: se empieza de nuevo en la próxima vuelta
      await anotar(fila.id, { estado: 'programada', subida: null })
      throw new Error('YouTube cerró la subida a mitad de camino; se vuelve a intentar.')
    }
    let j: any = null
    try { j = JSON.parse(t) } catch (_) { /* no es JSON */ }
    const e: any = new Error(`YouTube no aceptó el pedazo (${p.status}): ${String(j?.error?.message || t).slice(0, 200)}`)
    e.codigo = j?.error?.errors?.[0]?.reason || p.status
    throw e
  }
}

/* Paso 3: preguntar cómo va */
async function mirar(fila: any, c: any) {
  const token = await tokenVivo(c)
  const { j: d } = await gg(`/videos?part=status,processingDetails&id=${encodeURIComponent(fila.video_id)}`, token)
  const v = d?.items?.[0]
  const st = v?.status?.uploadStatus
  if (st === 'processed') {
    const quedo = v.status.privacyStatus
    await anotar(fila.id, { estado: 'publicada', error: quedo && quedo !== fila.privacidad ? `YouTube la dejó como «${quedo}».` : null })
    console.log(`[yt-publicar] ${fila.id} · publicada https://youtu.be/${fila.video_id} (${quedo})`)
  } else if (st === 'rejected' || st === 'failed' || st === 'deleted') {
    const por = v.status.rejectionReason || v.status.failureReason || st
    await anotar(fila.id, { estado: 'fallida', error: `YouTube no la publicó: ${por}` })
  } else if (!v) {
    await anotar(fila.id, { estado: 'fallida', error: 'El video ya no está en YouTube.' })
  } else if ((fila.intentos || 0) + 1 >= TOPE_INTENTOS) {
    // ya está arriba y con su enlace: si YouTube tarda en procesarlo no es una falla, se da por publicado
    await anotar(fila.id, { estado: 'publicada', error: 'YouTube todavía lo está procesando.' })
  } else {
    await anotar(fila.id, { intentos: (fila.intentos || 0) + 1 })
  }
}

/* Que dos vueltas del reloj no trabajen la misma fila. ⚠️ Igual que en tt-publicar. */
async function tomar(id: string, segundos: number): Promise<boolean> {
  const ahora = new Date().toISOString()
  const r = await tabla(`publicaciones_youtube?id=eq.${id}&or=(bloqueo.is.null,bloqueo.lt.${encodeURIComponent(ahora)})`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ bloqueo: new Date(Date.now() + segundos * 1000).toISOString() }) })
  return Array.isArray(r) && r.length > 0
}
const soltar = (id: string) => tabla(`publicaciones_youtube?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ bloqueo: null }) })

const FATALES: Record<string, string> = {
  uploadLimitExceeded: 'El canal llegó al tope de subidas de YouTube por hoy.',
  quotaExceeded: 'Cherry llegó al tope diario de subidas a YouTube. Se puede volver a programar mañana.',
  youtubeSignupRequired: 'Esa cuenta de Google todavía no tiene canal de YouTube.',
  insufficientPermissions: 'Cherry no tiene permiso para subir a ese canal. Vuelve a conectarlo.',
  invalidTitle: 'YouTube no aceptó el título.', invalidDescription: 'YouTube no aceptó la descripción.',
  invalidTags: 'YouTube no aceptó las etiquetas.', forbidden: 'YouTube no dejó subir el video a ese canal.',
}

async function tanda() {
  const hasta = Date.now() + PRESUPUESTO_MS
  const ahora = new Date().toISOString()
  for (const f of (await tabla(`publicaciones_youtube?estado=eq.programada&master_estado=is.null&select=*&limit=20`)) || [])
    await prepararMaster(f).catch((e) => console.warn('[yt-publicar] master', f.id, String(e).slice(0, 150)))
  for (const f of (await tabla(`publicaciones_youtube?estado=eq.programada&master_estado=eq.preparando&select=*&limit=20`)) || [])
    await prepararMaster(f).catch((e) => console.warn('[yt-publicar] master', f.id, String(e).slice(0, 150)))

  const filas = (await tabla(`publicaciones_youtube?estado=in.(programada,subiendo,procesando)&publicar_el=lte.${encodeURIComponent(ahora)}&select=*&order=publicar_el.asc&limit=10`)) || []
  for (const f of filas) {
    if (Date.now() > hasta) break
    if (f.estado === 'programada' && !['lista', 'no'].includes(f.master_estado)) continue
    if (!(await tomar(f.id, 150))) continue
    try {
      const c = (await tabla(`cuentas_youtube?user_id=eq.${f.user_id}&canal_id=eq.${encodeURIComponent(f.canal_id)}&select=*`))?.[0]
      if (!c || c.estado !== 'activa') { await anotar(f.id, { estado: 'fallida', error: 'El canal de YouTube ya no está conectado.' }); continue }
      if (f.estado === 'subiendo' && Date.now() - Number(f.subida?.inicio || 0) > VIGENCIA_SUBIDA_MS) {
        await anotar(f.id, { estado: 'programada', subida: null }); f.estado = 'programada'
      }
      if (f.estado === 'programada') await iniciar(f, c)
      if (f.estado === 'subiendo') await subirPedazos(f, c, hasta)
      else if (f.estado === 'procesando') await mirar(f, c)
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 400)
      console.error('[yt-publicar]', f.id, e?.codigo || '', msg)
      const fatal = FATALES[String(e?.codigo)]
      const n = (f.intentos || 0) + 1
      await anotar(f.id, fatal || n >= 5 ? { estado: 'fallida', error: fatal || msg } : { intentos: n, error: msg })
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
      // deno-lint-ignore no-explicit-any
      const er = (globalThis as any).EdgeRuntime
      const trabajo = tanda().catch((e) => console.error('[yt-publicar] tanda', String(e).slice(0, 300)))
      if (er?.waitUntil) { er.waitUntil(trabajo); return responder({ ok: true, en_curso: true }) }
      await trabajo
      return responder({ ok: true })
    }

    const user = await quienEs(req)

    if (b.modo === 'mias') {
      const desde = new Date(Date.now() - 60 * 86400 * 1000).toISOString()
      const filas = await tabla(`publicaciones_youtube?user_id=eq.${user}&publicar_el=gte.${encodeURIComponent(desde)}&select=id,canal_id,titulo,privacidad,publicar_el,estado,video_id,error,creada&order=publicar_el.desc&limit=200`)
      return responder({ publicaciones: filas || [] })
    }

    if (b.modo === 'quitar') {
      await tabla(`publicaciones_youtube?id=eq.${encodeURIComponent(String(b.id || ''))}&user_id=eq.${user}&estado=eq.programada`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'cancelada', actualizada: new Date().toISOString() }) })
      return responder({ ok: true })
    }

    if (b.modo === 'programar' || b.modo === 'ahora') {
      const c = (await tabla(`cuentas_youtube?user_id=eq.${user}&canal_id=eq.${encodeURIComponent(String(b.canal_id || ''))}&select=canal_id,estado`))?.[0]
      if (!c || c.estado !== 'activa') return responder({ error: 'Ese canal de YouTube no está conectado.' }, 400)
      if (!PRIVACIDADES.includes(b.privacidad)) return responder({ error: 'Escoge quién puede ver el video.' }, 400)
      const o = b.opciones || {}
      if (typeof o.para_ninos !== 'boolean') return responder({ error: 'Escoge si el video es para niños (YouTube lo exige).' }, 400)
      const titulo = String(b.titulo || '').replace(/[<>]/g, '').trim()
      if (!titulo) return responder({ error: 'El video necesita un título.' }, 400)
      if (titulo.length > 100) return responder({ error: 'El título pasa de 100 caracteres, el tope de YouTube.' }, 400)
      const descripcion = String(b.descripcion || '').replace(/[<>]/g, '')
      if (descripcion.length > 5000) return responder({ error: 'La descripción pasa de 5.000 caracteres, el tope de YouTube.' }, 400)
      const etiquetas = (Array.isArray(o.etiquetas) ? o.etiquetas : []).map((t: unknown) => String(t).replace(/[<>,]/g, '').trim()).filter(Boolean)
      if (etiquetas.join(',').length > 500) return responder({ error: 'Las etiquetas pasan de 500 caracteres, el tope de YouTube.' }, 400)
      const opciones: Record<string, unknown> = { para_ninos: o.para_ninos, ia: !!o.ia, avisar: o.avisar !== false, ...(etiquetas.length ? { etiquetas } : {}) }
      let video_url: string | null = b.video_url ? String(b.video_url) : null
      const render_master = b.render_master ? String(b.render_master) : null
      if (b.original) {
        if (!(await originalEsSuyo(user, String(b.original)))) return responder({ error: 'Ese archivo no es tuyo.' }, 400)
        opciones.original = String(b.original)
      }
      if (!render_master && !opciones.original && !/^https:\/\//.test(video_url || '')) return responder({ error: 'Falta el video.' }, 400)
      const cuando = b.modo === 'ahora' ? new Date() : new Date(b.publicar_el)
      if (isNaN(cuando.getTime())) return responder({ error: 'La fecha no vale.' }, 400)
      if (!video_url && render_master) video_url = `https://cherrysweet.app/fabricando/${render_master}`
      const fila = (await tabla('publicaciones_youtube', { method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: user, canal_id: c.canal_id, video_url, render_master, master_estado: render_master ? 'preparando' : null,
          titulo, descripcion, privacidad: b.privacidad, opciones, publicar_el: cuando.toISOString() }) }))?.[0]
      return responder({ publicacion: { id: fila.id, estado: fila.estado, publicar_el: fila.publicar_el } })
    }

    return responder({ error: 'modo desconocido' }, 400)
  } catch (e: any) {
    console.error('[yt-publicar]', String(e?.message || e).slice(0, 300))
    return responder({ error: String(e?.message || e) }, 400)
  }
})

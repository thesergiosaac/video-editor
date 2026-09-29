// historial v1 (28-sep-2026) — Cherry lee tu historial. Plan aprobado por Sergio: docs/HISTORIAL.md.
//
// Sergio: «que Cherry analice los videos que ya han sido publicados por tandas… analice primero los que más
// funcionaron… los desglose: qué ideas, qué ganchos, qué estructura y qué formato… y los agrupe con lo que ya existe:
// esta idea la has grabado 20 veces y ya ha funcionado; ese formato lo has grabado 30 veces».
//
// Acciones (POST JSON):
//   traer    — todos los reels de sus cuentas de Instagram (todas las páginas, no solo los 50 últimos) y sus números.
//              Mide de a MAX_MEDIR por llamada: Instagram deja ~200 llamadas por hora y por cuenta.
//   puntuar  — el puntaje 0–100 de cada reel frente a SU ÉPOCA (los 30 publicados alrededor de su fecha: una cuenta
//              que creció no se compara con sus vistas de hace dos años) y su tanda: 1 = el 10 % mejor,
//              2 = el 10 % peor, 3 = el resto.
//   avanzar  — manda a desmontar los siguientes (carrete-media-processor › desmontarReel), de a VARIOS a la vez, en el
//              orden de las tandas. Lo que salga, lo escribe la Lambda en la fila.
//   estado   — cuántos hay en cada paso.
//   ciclo    — el reloj (pg_cron, con la llave): traer → puntuar → avanzar para quien ya empezó su historial.
//
// Se entra con la sesión (la persona, sobre lo suyo) o con la llave del reloj / la del servidor.

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LLAVE_RELOJ = Deno.env.get('HISTORIAL_LLAVE') ?? ''
const AWS_REGION = Deno.env.get('AWS_REGION') ?? 'us-east-1'
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
const GRAFO = 'https://graph.instagram.com/v23.0'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODELOS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
const MAX_MEDIR = 45          // números por llamada (una llamada a Instagram por reel)
const A_LA_VEZ = 4            // desmontajes a la vez por persona
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const DE_REEL = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions',
                 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'reels_skip_rate']

async function tabla(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const txt = await r.text()
  return txt ? JSON.parse(txt) : null
}
async function ig(camino: string) {
  // la página siguiente llega como dirección completa (y con otra versión de la API): se usa tal cual
  const r = await fetch(/^https:\/\//.test(camino) ? camino : `${GRAFO}/${camino}`)
  const txt = await r.text()
  if (!r.ok) throw new Error(txt.slice(0, 300))
  return JSON.parse(txt)
}
async function quienEs(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  if ([SB_SERVICIO, Deno.env.get('SVC_JWT')].filter(Boolean).includes(jwt)) return 'servidor'
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } })
  if (!r.ok) return null
  const u = await r.json()
  return typeof u?.id === 'string' ? u.id : null
}

/* La duración: Instagram no la da; un MP4 la lleva en su caja `mvhd`, al principio (igual que ig-metricas). */
async function duracionDe(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-200000' } })
    if (!r.ok) return null
    const b = new Uint8Array(await r.arrayBuffer())
    let i = -1
    for (let k = 0; k + 3 < b.length; k++) if (b[k] === 0x6d && b[k + 1] === 0x76 && b[k + 2] === 0x68 && b[k + 3] === 0x64) { i = k; break }
    if (i < 0) return null
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
    const version = b[i + 4]
    const escala = version === 1 ? v.getUint32(i + 24) : v.getUint32(i + 16)
    const dura = version === 1 ? Number(v.getBigUint64(i + 28)) : v.getUint32(i + 20)
    return escala ? Math.round((dura / escala) * 10) / 10 : null
  } catch { return null }
}
async function numerosDe(mediaId: string, token: string) {
  const leer = (d: any) => Object.fromEntries((d?.data || []).map((x: any) => [x.name, x.values?.[0]?.value]))
  try { return leer(await ig(`${mediaId}/insights?metric=${DE_REEL.join(',')}&access_token=${token}`)) }
  catch {
    const salida: Record<string, unknown> = {}
    for (const m of DE_REEL) {
      try { Object.assign(salida, leer(await ig(`${mediaId}/insights?metric=${m}&access_token=${token}`))) } catch { /* no aplica */ }
    }
    return salida
  }
}

/* ── traer: la lista completa y los números de a poco ── */
async function traer(user: string) {
  const cuentas = await tabla(`cuentas_instagram?user_id=eq.${user}&estado=eq.activa&select=ig_user_id,usuario,token`)
  if (!cuentas?.length) return { error: 'No hay ninguna cuenta de Instagram conectada.' }
  const resumen: any[] = []
  for (const c of cuentas) {
    // 1 · la lista: todas las páginas (lo nuevo entra; lo que ya estaba no se toca)
    const ya = new Set(((await tabla(`historial_reels?user_id=eq.${user}&ig_user_id=eq.${c.ig_user_id}&select=ig_media_id`)) || []).map((x: any) => x.ig_media_id))
    let url = `me/media?fields=id,media_type,media_product_type,timestamp,permalink,caption,thumbnail_url&limit=50&access_token=${c.token}`
    let nuevos = 0, paginas = 0
    while (url && paginas < 40) {
      const m = await ig(url)
      paginas++
      const filas = (m?.data || []).filter((p: any) => String(p.media_product_type || '') === 'REELS' && !ya.has(p.id)).map((p: any) => ({
        ig_media_id: p.id, user_id: user, ig_user_id: c.ig_user_id, publicado: p.timestamp, enlace: p.permalink,
        texto: String(p.caption || '').slice(0, 2200), miniatura: p.thumbnail_url || null,
      }))
      if (filas.length) {
        await tabla('historial_reels?on_conflict=ig_media_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(filas) })
        nuevos += filas.length
      }
      const sig = m?.paging?.next ? String(m.paging.next) : ''
      url = sig
    }
    // 2 · los números de los que no se han medido (de a MAX_MEDIR: el límite de Instagram)
    const faltan = (await tabla(`historial_reels?user_id=eq.${user}&ig_user_id=eq.${c.ig_user_id}&medido=is.null&select=ig_media_id,publicado&order=publicado.desc&limit=${MAX_MEDIR}`)) || []
    let medidos = 0
    for (const f of faltan) {
      try {
        const [nums, info] = await Promise.all([numerosDe(f.ig_media_id, c.token), ig(`${f.ig_media_id}?fields=media_url&access_token=${c.token}`).catch(() => null)])
        const dura = info?.media_url ? await duracionDe(info.media_url) : null
        const medio = Number((nums as any).ig_reels_avg_watch_time) || null
        await tabla(`historial_reels?ig_media_id=eq.${f.ig_media_id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            vistas: (nums as any).views ?? null, alcance: (nums as any).reach ?? null, me_gusta: (nums as any).likes ?? null,
            comentarios: (nums as any).comments ?? null, guardados: (nums as any).saved ?? null, compartidos: (nums as any).shares ?? null,
            visto_medio_ms: medio, omision: (nums as any).reels_skip_rate ?? null, dura_seg: dura,
            retencion: medio && dura ? Math.round((medio / 1000 / dura) * 1000) / 10 : null,
            medido: new Date().toISOString(), actualizado: new Date().toISOString(),
          }),
        })
        medidos++
      } catch (e) { console.warn('[historial] no se midió ' + f.ig_media_id + ': ' + String(e).slice(0, 160)) }
    }
    resumen.push({ cuenta: c.usuario, nuevos, paginas, medidos, faltan_por_medir: Math.max(0, faltan.length - medidos) })
  }
  return { cuentas: resumen }
}

/* ── puntuar: cada reel frente a los 30 publicados alrededor de su fecha ── */
const mediana = (v: number[]) => { const s = v.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const dispersion = (v: number[], m: number) => Math.max(0.05, mediana(v.map((x) => Math.abs(x - m))) * 1.4826)
function fi(z: number) {            // la normal acumulada (Abramowitz–Stegun): el puntaje 0–100
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}
/* cada cuenta (cada marca) aparte: sus tandas y su época son suyas («Las marcas de Cherry: TODO separado por marca») */
async function puntuar(user: string) {
  // lo publicado hace menos de 3 días todavía no tiene sus números asentados (Instagram tarda ~48 h): espera
  const hace3 = Date.now() - 3 * 24 * 3600 * 1000
  const todas = ((await tabla(`historial_reels?user_id=eq.${user}&medido=not.is.null&select=ig_media_id,ig_user_id,publicado,vistas,alcance,retencion,guardados,compartidos&order=publicado.asc`)) || [])
    .filter((f: any) => Number(f.vistas) > 0 && Date.parse(f.publicado) < hace3)
  // (y si ya tenían tanda de antes, se les quita hasta que se asienten)
  await tabla(`historial_reels?user_id=eq.${user}&publicado=gt.${new Date(hace3).toISOString()}&estado=eq.pendiente`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tanda: null, puntaje: null }) })
  const cuentas = [...new Set(todas.map((f: any) => f.ig_user_id))] as string[]
  const salida: any[] = []
  for (const c of cuentas) salida.push({ ig_user_id: c, ...(await puntuarCuenta(todas.filter((f: any) => f.ig_user_id === c))) })
  return { puntuados: todas.length, cuentas: salida }
}
async function puntuarCuenta(filas: any[]) {
  if (!filas.length) return { puntuados: 0 }
  const lv = filas.map((f: any) => Math.log(Number(f.vistas)))
  const rt = filas.map((f: any) => f.retencion == null ? NaN : Number(f.retencion))
  const vl = filas.map((f: any) => Number(f.alcance) > 0 ? Math.log(1 + (Number(f.guardados || 0) + Number(f.compartidos || 0)) / Number(f.alcance) * 1000) : NaN)
  const pts = filas.map((_: any, i: number) => {
    const a = Math.max(0, i - 15), b = Math.min(filas.length, i + 16)
    const vec = (arr: number[]) => arr.slice(a, b).filter((_, k) => a + k !== i)
    const parte = (arr: number[], peso: number) => {
      if (!Number.isFinite(arr[i])) return null
      const v = vec(arr).filter((x) => Number.isFinite(x)); if (v.length < 3) return null
      const m = mediana(v); return { z: (arr[i] - m) / dispersion(v, m), peso }
    }
    const ps = [parte(lv, 0.5), parte(rt, 0.25), parte(vl, 0.25)].filter(Boolean) as { z: number; peso: number }[]
    const tot = ps.reduce((s, p) => s + p.peso, 0)
    const z = tot ? ps.reduce((s, p) => s + p.z * p.peso, 0) / tot : 0
    return Math.round(fi(Math.max(-4, Math.min(4, z))) * 1000) / 10
  })
  // las tandas: el 10 % mejor, el 10 % peor y el resto
  const orden = pts.map((p: number, i: number) => ({ p, i })).sort((x: any, y: any) => y.p - x.p)
  const n10 = Math.max(1, Math.round(filas.length * 0.1))
  const tanda = new Array(filas.length).fill(3)
  orden.slice(0, n10).forEach((o: any) => { tanda[o.i] = 1 })
  orden.slice(-n10).forEach((o: any) => { if (tanda[o.i] === 3) tanda[o.i] = 2 })
  for (let i = 0; i < filas.length; i++) {
    await tabla(`historial_reels?ig_media_id=eq.${filas[i].ig_media_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ puntaje: pts[i], tanda: tanda[i] }) })
  }
  return { puntuados: filas.length, tanda1: n10, tanda2: n10 }
}

/* ── avanzar: los siguientes a desmontar, en el orden de las tandas ── */
async function hmac(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key)
  const k = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
}
async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
async function lambdaAsync(nombre: string, payload: object) {
  const body = JSON.stringify(payload), host = `lambda.${AWS_REGION}.amazonaws.com`, path = `/2015-03-31/functions/${nombre}/invocations`
  const now = new Date(), ymd = now.toISOString().slice(0, 10).replace(/-/g, ''), amz = `${ymd}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`
  const ph = await sha256hex(body)
  const h: Record<string, string> = { host, 'x-amz-date': amz, 'x-amz-content-sha256': ph, 'x-amz-invocation-type': 'Event', 'content-type': 'application/json' }
  const nombres = Object.keys(h).sort().join(';'), canon = Object.keys(h).sort().map((k) => `${k}:${h[k]}\n`).join('')
  const scope = `${ymd}/${AWS_REGION}/lambda/aws4_request`
  const firmar = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${await sha256hex(['POST', path, '', canon, nombres, ph].join('\n'))}`
  let k: ArrayBuffer = await hmac(`AWS4${AWS_SECRET_ACCESS_KEY}`, ymd)
  k = await hmac(k, AWS_REGION); k = await hmac(k, 'lambda'); k = await hmac(k, 'aws4_request')
  h['Authorization'] = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${scope}, SignedHeaders=${nombres}, Signature=${hex(await hmac(k, firmar))}`
  const r = await fetch(`https://${host}${path}`, { method: 'POST', headers: h, body })
  if (r.status !== 202) throw new Error(`Lambda ${nombre}: ${r.status} ${(await r.text()).slice(0, 200)}`)
}
async function avanzar(user: string) {
  const ahora = Date.now()
  // los que se quedaron a medias (más de 20 min «desmontando»): vuelven a la fila, o fallan al tercer intento
  const colgados = (await tabla(`historial_reels?user_id=eq.${user}&estado=eq.desmontando&select=ig_media_id,intentos,actualizado`)) || []
  for (const c of colgados) {
    if (ahora - Date.parse(c.actualizado) < 20 * 60 * 1000) continue
    await tabla(`historial_reels?ig_media_id=eq.${c.ig_media_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: c.intentos >= 3 ? 'fallo' : 'pendiente', error: 'se quedó a medias', actualizado: new Date().toISOString() }) })
  }
  const enCurso = ((await tabla(`historial_reels?user_id=eq.${user}&estado=eq.desmontando&select=ig_media_id`)) || []).length
  const cupo = Math.max(0, A_LA_VEZ - enCurso)
  if (!cupo) return { lanzados: 0, en_curso: enCurso }
  // tanda 1 del mejor al peor, tanda 2 del peor al mejor, tanda 3 del mejor al peor
  const sig: any[] = []
  for (const [t, ord] of [[1, 'desc'], [2, 'asc'], [3, 'desc']] as [number, string][]) {
    if (sig.length >= cupo) break
    const f = (await tabla(`historial_reels?user_id=eq.${user}&estado=eq.pendiente&tanda=eq.${t}&select=ig_media_id,intentos&order=puntaje.${ord}&limit=${cupo - sig.length}`)) || []
    sig.push(...f)
  }
  for (const f of sig) {
    await tabla(`historial_reels?ig_media_id=eq.${f.ig_media_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: 'desmontando', intentos: (f.intentos || 0) + 1, actualizado: new Date().toISOString() }) })
    await lambdaAsync('carrete-media-processor', { mode: 'desmontarReel', user_id: user, ig_media_id: f.ig_media_id })
  }
  return { lanzados: sig.length, en_curso: enCurso + sig.length }
}

/* ── agrupar: las cuatro piezas de cada reel desmontado. Formato, gancho y estructura ya salen de listas cerradas
   (herramientas › lab_desmontar: GANCHOS, FORMATOS y los pasos del mapa): se juntan solos. La IDEA es texto libre: la IA
   la agrupa en dos niveles (escogido por Sergio): el TEMA («guiones») y el ÁNGULO («cómo escribir un buen guion»).
   Dos videos que dicen lo mismo con otras palabras quedan en el mismo ángulo. Se agrupan TODAS las ideas de la cuenta a
   la vez (y las del Laboratorio si la página las manda: `lab`), así los nombres quedan parejos entre corridas. ── */
async function gemini(sistema: string, datos: unknown) {
  const cuerpo = {
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(datos) }] }],
    systemInstruction: { parts: [{ text: sistema }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 16000 },
  }
  const fallas: string[] = []
  for (const vuelta of [0, 1]) {
    if (vuelta) await new Promise((r) => setTimeout(r, 5000))
    for (const modelo of MODELOS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      if (!r.ok) { fallas.push(`${modelo} ${r.status}${r.status === 429 ? ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 220) : ''}`); continue }
      const j = await r.json()
      const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
      // a veces llega envuelto en ```json … ``` o con texto alrededor: se lee de la primera { a la última }
      try { return JSON.parse(txt) } catch (_) { /* sigue */ }
      try { return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)) } catch (_) { fallas.push(`${modelo}: no devolvió JSON (${j?.candidates?.[0]?.finishReason || '?'}, ${txt.length} letras)`) }
    }
  }
  throw new Error('No se pudieron agrupar las ideas: ' + fallas.join(' · '))
}
const SIS_IDEAS = `Eres estratega de contenido. Te doy las ideas de los videos de UNA cuenta (id + tema + frase) y, si hay, los grupos que ya existen. Agrúpalas en dos niveles:
- TEMA: el asunto general, 1 a 3 palabras en minúscula (ej.: «guiones», «ganchos», «crecer en seguidores», «rentabilidad del restaurante»). El tema NUNCA es el nicho de toda la cuenta: si casi todo lo que publica es de marketing o de redes, «marketing», «redes sociales» o «contenido» no dicen nada; usa el asunto concreto («guiones», «viralidad», «ideas de contenido», «organización», «ventas»). Si un tema junta más de la quinta parte de los videos, es demasiado general: pártelo.
  Para una cuenta de unos 100 videos salen entre 8 y 14 temas. PROHIBIDO un tema o un ángulo cajón («otros», «varios», «general», «temas varios…»): cada idea va en su tema real, aunque ese tema tenga un solo video.
- ÁNGULO: la idea concreta dentro del tema, máximo 8 palabras (ej.: «cómo escribir un buen guion»). Un ángulo es un GRUPO: junta todas las ideas que el espectador sentiría como el mismo video aunque usen otras palabras. «cómo aumentar la retención en videos», «cómo mejorar la retención» y «cómo lograr retención viral» son UN ángulo; «cómo viralizar tu contenido» y «cómo lograr videos virales» son UNO; «cómo hacer un buen guion» = «los pasos de un guion que funciona». Si defienden otra cosa, es otro ángulo del mismo tema («errores al escribir un guion»). Nunca copies la idea de cada video como su ángulo: un ángulo con un solo video está bien solo cuando ningún otro dice lo mismo. Y al revés: un ángulo es UNA idea que se puede grabar; si dos ideas darían dos videos distintos («cómo encontrar ideas de contenido» y «cómo organizar la creación de contenido»), son dos ángulos.
Nombra el ángulo como lo diría el creador en su video («cómo crear ganchos que funcionen»), nunca con fórmulas como «realidad sobre…» o «la verdad de…».
Algunos videos no tienen voz: de esos llega «sin_voz» con el texto de la publicación y lo que se ve; saca de ahí de qué trata el video.
Reutiliza EXACTAMENTE los nombres de los grupos existentes cuando la idea encaje (salvo un tema demasiado general: ese se parte). No inventes ideas. Español de Colombia.
Devuelve SOLO JSON {"temas":[{"tema":"...","angulos":[{"angulo":"...","ids":["..."]}]}]}: cada id va en UN solo ángulo y TODAS las ids aparecen.`
/* de qué trata un reel sin voz: el texto de la publicación y lo que se ve (el gancho y el texto en pantalla) */
function sinVozDe(f: any) {
  const v = f.desmonte?.vista || {}
  return [String(f.texto || '').replace(/\s+/g, ' ').slice(0, 300), v.texto, v.gancho?.que].filter(Boolean).join(' · ')
}
const CAJON = /^(otros?|otras?|varios?|varias?|general(es)?|miscel|temas? varios|sin tema|resto)\b/i
async function agrupar(user: string, ig_user_id: string, lab: any[], desdeCero = false, ensayo = false) {
  const filtro = ig_user_id ? `&ig_user_id=eq.${ig_user_id}` : ''
  const filas = ((await tabla(`historial_reels?user_id=eq.${user}${filtro}&estado=eq.listo&select=ig_media_id,ig_user_id,texto,desmonte,piezas`)) || [])
  if (!filas.length) return { agrupados: 0, lab: [] }
  const porCuenta: Record<string, any[]> = {}
  filas.forEach((f: any) => { (porCuenta[f.ig_user_id] = porCuenta[f.ig_user_id] || []).push(f) })
  const labSalida: any[] = [], ensayos: any[] = []
  let n = 0
  for (const [cuenta, fs] of Object.entries(porCuenta)) {
    const ideas = fs.map((f: any) => f.desmonte?.idea?.tema
      ? { id: f.ig_media_id, tema: f.desmonte.idea.tema, frase: f.desmonte.idea.frase || '' }
      : (sinVozDe(f) ? { id: f.ig_media_id, sin_voz: sinVozDe(f) } : null)).filter(Boolean)
    const deLab = (ig_user_id === cuenta ? lab : []).filter((x: any) => x && x.id && x.texto).slice(0, 200)
      .map((x: any) => ({ id: 'lab:' + x.id, tema: String(x.texto).slice(0, 160), frase: '' }))
    const existentes: Record<string, Set<string>> = {}
    if (!desdeCero) fs.forEach((f: any) => { if (f.piezas?.tema && f.piezas?.angulo) (existentes[f.piezas.tema] = existentes[f.piezas.tema] || new Set()).add(f.piezas.angulo) })
    const grupos = Object.entries(existentes).map(([tema, a]) => ({ tema, angulos: [...a] }))
    const asign: Record<string, { tema: string; angulo: string }> = {}
    const leer = (r: any) => {
      for (const tm of (Array.isArray(r?.temas) ? r.temas : [])) {
        const tema = String(tm?.tema || '').trim().toLowerCase().slice(0, 40)
        for (const an of (Array.isArray(tm?.angulos) ? tm.angulos : [])) {
          const angulo = String(an?.angulo || '').trim().slice(0, 80)
          if (tema && angulo) (Array.isArray(an?.ids) ? an.ids : []).forEach((id: any) => { if (id) asign[String(id)] = { tema, angulo } })
        }
      }
    }
    const todas = [...ideas, ...deLab]
    if (todas.length) {
      leer(await gemini(SIS_IDEAS, { grupos_existentes: grupos, ideas: todas }))
      // lo que cayó en un cajón o quedó sin tema vuelve a pasar, contra los grupos ya armados (hasta dos veces)
      for (const _ of [0, 1]) {
        const sueltas = todas.filter((x: any) => { const a = asign[x.id]; return !a || CAJON.test(a.tema) || CAJON.test(a.angulo) })
        if (!sueltas.length) break
        sueltas.forEach((x: any) => { delete asign[x.id] })
        const arbol: Record<string, Set<string>> = {}
        Object.values(asign).forEach((a) => { (arbol[a.tema] = arbol[a.tema] || new Set()).add(a.angulo) })
        leer(await gemini(SIS_IDEAS, { grupos_existentes: Object.entries(arbol).map(([tema, a]) => ({ tema, angulos: [...a] })), ideas: sueltas }))
      }
    }
    if (ensayo) {   // solo mirar: el árbol con la idea de cada video, sin escribir nada
      const arbol: Record<string, Record<string, string[]>> = {}
      ;[...ideas, ...deLab].forEach((x: any) => {
        const a = asign[x.id] || { tema: '(sin tema)', angulo: '(sin ángulo)' }
        ;((arbol[a.tema] = arbol[a.tema] || {})[a.angulo] = arbol[a.tema][a.angulo] || []).push(x.tema || ('[sin voz] ' + String(x.sin_voz).slice(0, 60)))
      })
      ensayos.push({ cuenta, temas: Object.entries(arbol).map(([tema, as]) => ({ tema, n: Object.values(as).flat().length,
        angulos: Object.entries(as).map(([angulo, ids]) => ({ angulo, n: ids.length, ideas: ids })).sort((a, b) => b.n - a.n) })).sort((a, b) => b.n - a.n) })
      continue
    }
    for (const f of fs) {
      const d = f.desmonte || {}, pd = d.vista?.produccion || {}
      const pasos = (d.mapa?.pasos || []).map((x: any) => x.tipo).filter(Boolean)
      const lista = pasos.length ? pasos : (d.estructura || []).map((e: any) => e.parte).filter(Boolean)
      const piezas = {
        tema: asign[f.ig_media_id]?.tema || (desdeCero ? null : f.piezas?.tema) || null,
        angulo: asign[f.ig_media_id]?.angulo || (desdeCero ? null : f.piezas?.angulo) || null,
        idea: d.idea?.tema || null,
        gancho: d.gancho?.tipo || null, gancho_frase: String(d.gancho?.texto || '').slice(0, 200) || null,
        formato: pd.formato || d.formato?.nombre || null,
        estructura: lista.length ? lista.join(' → ') : null,
      }
      await tabla(`historial_reels?ig_media_id=eq.${f.ig_media_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ piezas }) })
      n++
    }
    deLab.forEach((x: any) => { const a = asign[x.id]; if (a) labSalida.push({ id: x.id.slice(4), ...a }) })
  }
  return ensayo ? { ensayo: ensayos } : { agrupados: n, lab: labSalida }
}

/* ── Lo que pide la página del Laboratorio ──
   lista: los reels con sus números, su tanda y sus piezas, con los MISMOS nombres de campo que ig-metricas › videos
          (así el Laboratorio los trata igual que a los suyos). La tapa es la portada del desmontaje, guardada en
          `clips/historial/<id>.jpg` del CDN (la de Instagram caduca en unos días; en base64 la lista pesaba 1 MB).
   uno:   el desmontaje completo de un reel (pesa: se pide al abrir su ficha).
   lab:   las ideas del Laboratorio, en el tema y el ángulo del historial de esa cuenta (sin rehacer el historial). */
async function lista(user: string) {
  const [filas, cuentas] = await Promise.all([
    tabla(`historial_reels?user_id=eq.${user}&select=ig_media_id,ig_user_id,publicado,enlace,texto,miniatura,dura_seg,vistas,alcance,me_gusta,comentarios,guardados,compartidos,visto_medio_ms,omision,retencion,medido,puntaje,tanda,estado,piezas,tapa&order=publicado.desc&limit=2000`),
    tabla(`cuentas_instagram?user_id=eq.${user}&select=ig_user_id,marca`),
  ])
  const marcaDe: Record<string, string> = {}
  ;(cuentas || []).forEach((c: any) => { if (c.marca) marcaDe[c.ig_user_id] = c.marca })
  return {
    videos: (filas || []).map((x: any) => ({
      id: 'ig:' + x.ig_media_id, igMediaId: x.ig_media_id, cuenta: marcaDe[x.ig_user_id] || null, igUserId: x.ig_user_id,
      titulo: (x.texto || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin texto',
      fecha: (x.publicado || '').slice(0, 10), creado: x.publicado,
      tapa: x.tapa || x.miniatura || null, enlace: x.enlace, dur: x.dura_seg,
      visitas: x.vistas, alcance: x.alcance, retencion: x.retencion, omisiones: x.omision,
      meGusta: x.me_gusta, comentarios: x.comentarios, guardados: x.guardados, reposts: x.compartidos, enviados: null,
      medido: x.medido, texto: x.texto || '', tipo: 'REELS',
      vistoMedio: x.visto_medio_ms != null ? Math.round(Number(x.visto_medio_ms) / 100) / 10 : null,
      historial: { puntaje: x.puntaje, tanda: x.tanda, estado: x.estado, piezas: x.piezas || null },
    })),
  }
}
async function uno(user: string, id: string) {
  if (!/^\d+$/.test(id)) return { error: 'Falta el reel.' }
  const f = (await tabla(`historial_reels?user_id=eq.${user}&ig_media_id=eq.${id}&select=desmonte`))?.[0]
  return { desmontaje: f?.desmonte || null }
}
const SIS_LAB = `Eres estratega de contenido. Te doy los GRUPOS de ideas de una cuenta (tema → ángulos) y unas ideas sueltas (id + texto).
Pon cada idea suelta en el tema y el ángulo existentes que digan LO MISMO (aunque con otras palabras). Si ninguno encaja, crea uno nuevo con el mismo estilo: tema de 1 a 3 palabras en minúscula; ángulo de máximo 8 palabras, dicho como lo diría el creador.
Devuelve SOLO JSON {"asignacion":[{"id":"...","tema":"...","angulo":"..."}]} con TODAS las ids.`
async function lab(user: string, ig_user_id: string, ideas: any[]) {
  const sueltas = (ideas || []).filter((x: any) => x && x.id && x.texto).slice(0, 200).map((x: any) => ({ id: String(x.id), texto: String(x.texto).slice(0, 160) }))
  if (!sueltas.length || !/^\d+$/.test(ig_user_id)) return { asignacion: [] }
  const filas = (await tabla(`historial_reels?user_id=eq.${user}&ig_user_id=eq.${ig_user_id}&piezas=not.is.null&select=piezas`)) || []
  const g: Record<string, Set<string>> = {}
  filas.forEach((f: any) => { if (f.piezas?.tema && f.piezas?.angulo) (g[f.piezas.tema] = g[f.piezas.tema] || new Set()).add(f.piezas.angulo) })
  const r = await gemini(SIS_LAB, { grupos: Object.entries(g).map(([tema, a]) => ({ tema, angulos: [...a] })), ideas: sueltas })
  return { asignacion: (Array.isArray(r?.asignacion) ? r.asignacion : []).map((a: any) => ({
    id: String(a?.id || ''), tema: String(a?.tema || '').trim().toLowerCase().slice(0, 40), angulo: String(a?.angulo || '').trim().slice(0, 80),
  })).filter((a: any) => a.id && a.tema && a.angulo) }
}

/* ── formato (29-sep): Cherry vuelve a mirar SOLO el formato de un reel ──
   Sergio (29-sep) fijó los formatos: «A cámara» pasa a llamarse «Estático» y hay uno nuevo, «Plano fijo» (la cámara quieta
   y él se mueve: se acerca, se aleja, cambia de lugar). Cherry confundía los cortes de edición con cambios de toma: 91 de
   107 reels salían «Dinámico». Ahora se le preguntan dos cosas que se VEN y el código decide entre Estático, Plano fijo y
   Dinámico; los formatos especiales (Podcast, VS, Top…) los reconoce directo. Detalle en docs/CRITERIO-SERGIO.md. */
const FORMATOS = ['Estático', 'Plano fijo', 'Dinámico', 'Podcast', 'VS', 'Top', 'B-roll', 'Entrevista random', 'Entrevista',
  'Pantalla dividida', 'Pantalla verde', 'Storytelling']
const BASICOS = ['Estático', 'Plano fijo', 'Dinámico']
const SIS_FORMATO = `Miras un video corto de redes y dices CÓMO ESTÁ GRABADO. Devuelve SOLO JSON:
{"camaraCambia":false,"personaSeMueve":false,"especial":"","porque":"..."}
- camaraCambia: true SOLO si la cámara está en OTRO LUGAR o con OTRO ÁNGULO en distintas tomas: el fondo cambia de sitio, la escena se ve desde otra dirección, otra habitación, otro plano grabado aparte. NO cuentan: los cortes que quitan pausas dentro de la misma toma (el fondo sigue igual), los acercamientos o zooms hechos en edición (la misma imagen, más grande), las imágenes, capturas, textos o videos que se ponen encima, ni que la persona se acerque o se aleje de una cámara quieta.
- personaSeMueve: con la cámara quieta, ¿la persona cambia de lugar dentro del cuadro? true si se acerca y se aleja de verdad (de cuerpo entero a cerca), camina de un lado a otro, sale y entra, o habla desde distintos puntos del mismo sitio. false si se queda hablando en la misma posición (los gestos y las manos no cuentan).
- especial: SOLO si el video entero está hecho así, su nombre; si no, "": «Podcast» (simula un podcast: micrófono de podcast a la vista, audífonos o dos sillas) · «VS» (enfrenta dos cosas a ver cuál gana, las dos en pantalla) · «Top» (el video es un ranking: numera cosas de mayor a menor o al revés; un contador de pasos NO lo hace Top) · «B-roll» (NO se ve a la persona hablando: voz en off sobre escenas de apoyo) · «Entrevista random» (grabado en POV: alguien llega y le pregunta, con la cámara en la mano de quien pregunta) · «Entrevista» (cámara quieta y en cuadro aparece la mano con el micrófono o la persona que pregunta) · «Pantalla dividida» (la imagen partida en dos buena parte del video: la persona en una mitad, una grabación o ejemplos en la otra) · «Pantalla verde» (la persona recortada sobre un video o una imagen de fondo) · «Storytelling» (cuenta algo mientras hace una acción natural con las manos: cocinar, maquillarse, afeitarse, conducir, entrenar).
- porque: en qué te fijaste para camaraCambia y personaSeMueve, máx. 25 palabras.
Mira el video entero antes de decidir. En español.`
function formatoDe(o: any) {
  const esp = String(o?.especial || '').trim()
  if (FORMATOS.includes(esp) && !BASICOS.includes(esp)) return esp
  if (o?.camaraCambia === true) return 'Dinámico'
  if (o?.personaSeMueve === true) return 'Plano fijo'
  return 'Estático'
}
const GBASE = 'https://generativelanguage.googleapis.com'
async function subirVideo(datos: Uint8Array, tipo: string): Promise<string> {
  const inicio = await fetch(`${GBASE}/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(datos.byteLength),
      'X-Goog-Upload-Header-Content-Type': tipo, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: { display_name: 'formato' } }),
  })
  if (!inicio.ok) throw new Error(`Google no aceptó la subida (${inicio.status})`)
  const destino = inicio.headers.get('X-Goog-Upload-URL')
  if (!destino) throw new Error('Google no devolvió dónde subir el video.')
  const sube = await fetch(destino, { method: 'POST', headers: { 'Content-Length': String(datos.byteLength), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: datos })
  if (!sube.ok) throw new Error(`Falló la subida del video (${sube.status})`)
  const j = await sube.json()
  if (!j?.file?.name || !j?.file?.uri) throw new Error('Google no devolvió el video subido.')
  for (let i = 0; i < 40; i++) {
    const f = await (await fetch(`${GBASE}/v1beta/${j.file.name}?key=${GEMINI_API_KEY}`)).json()
    if (f?.state === 'ACTIVE') return j.file.uri
    if (f?.state === 'FAILED') throw new Error('Google no pudo procesar ese video.')
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('El video tardó demasiado en prepararse.')
}
async function borrarVideo(uri: string) {
  try { const n = uri.split('/files/')[1]; if (n) await fetch(`${GBASE}/v1beta/files/${n}?key=${GEMINI_API_KEY}`, { method: 'DELETE' }) } catch (_) { /* Google lo borra a las 48 h */ }
}
async function mirarVideo(sistema: string, uri: string) {
  const cuerpo = {
    contents: [{ role: 'user', parts: [{ fileData: { fileUri: uri, mimeType: 'video/mp4' } }, { text: 'Analízalo entero.' }] }],
    systemInstruction: { parts: [{ text: sistema }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4000 },
  }
  const fallas: string[] = []
  for (const vuelta of [0, 1]) {
    if (vuelta) await new Promise((r) => setTimeout(r, 8000))
    for (const modelo of MODELOS) {
      const r = await fetch(`${GBASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      if (!r.ok) { fallas.push(`${modelo} ${r.status}`); continue }
      const j = await r.json()
      const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
      try { return JSON.parse(txt) } catch (_) { /* sigue */ }
      try { return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)) } catch (_) { fallas.push(`${modelo}: no devolvió JSON`) }
    }
  }
  throw new Error('No se pudo mirar el video: ' + fallas.join(' · '))
}
const SIS_HOJA = `Te doy UNA imagen con 16 fotogramas de un video corto, en orden: la fila de arriba de izquierda a derecha (1 a 8) y luego la de abajo (9 a 16), tomados a intervalos iguales.
Ignora todo lo que está pegado encima: textos, subtítulos, capturas de celular, imágenes, stickers, balones. Fíjate en el FONDO y en la persona.
Devuelve SOLO JSON {"fotos":[{"n":1,"fondo":"clóset blanco, maleta negra, piso claro","camara":"A","persona":"medio","postura":"sentado"}],"porque":"..."} con los 16.
- fondo: PRIMERO describe lo que se ve detrás de la persona, máx. 8 palabras: el sitio, los muebles, la pared, desde qué altura se ve. Compara cada fondo con los anteriores antes de poner la letra.
- camara: una letra por posición de cámara, según el fondo que describiste. La MISMA letra solo si el fondo es el mismo sitio visto desde el mismo lugar y con el mismo ángulo (los mismos muebles en el mismo lugar del cuadro), aunque la persona esté más cerca o más lejos. Otra letra si el fondo es otro sitio, o el mismo sitio visto desde otro lugar u otro ángulo. Si la imagen solo se agrandó en edición (el fondo también se ve más grande, mismo encuadre), es la misma letra.
- persona: "lejos" (se le ve el cuerpo entero o casi), "medio" (de la cintura para arriba), "cerca" (la cara y los hombros llenan la pantalla), "no está". Si la imagen solo se agrandó en edición, pon la misma distancia del fotograma anterior con esa cámara.
- postura: "sentado", "de pie", "acostado" o "no se ve".
- porque: máx. 25 palabras.`
function formatoDeHoja(o: any) {
  const fotos = (Array.isArray(o?.fotos) ? o.fotos : []).filter((f: any) => f && f.camara)
  if (!fotos.length) return { formato: '', detalle: null }
  const cuenta: Record<string, number> = {}
  fotos.forEach((f: any) => { cuenta[f.camara] = (cuenta[f.camara] || 0) + 1 })
  const [principal, n] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]
  const parte = n / fotos.length, camaras = Object.keys(cuenta).length
  const en = fotos.filter((f: any) => f.camara === principal && f.persona !== 'no está')
  const distancias = new Set(en.map((f: any) => f.persona)), posturas = new Set(en.map((f: any) => f.postura).filter((x: any) => x && x !== 'no se ve'))
  const mueve = distancias.size >= 2 || posturas.size >= 2
  const formato = parte < 0.6 ? 'Dinámico' : mueve ? 'Plano fijo' : camaras >= 4 ? 'Dinámico' : 'Estático'
  return { formato, detalle: { parte: Math.round(parte * 100), camaras, distancias: [...distancias], posturas: [...posturas], mueve } }
}
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
/* (ensayo) la misma hoja con el modelo de visión de OpenAI: Gemini flash no distingue bien las posiciones de cámara */
async function formatoHojaOpenAI(datos: string, modelo: string) {
  const cuerpo: Record<string, unknown> = { model: modelo, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: SIS_HOJA }, { role: 'user', content: [
      { type: 'text', text: 'Estos son los 16 fotogramas.' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + datos, detail: 'high' } }] }] }
  if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = 'medium'; cuerpo.max_completion_tokens = 16000 }
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  if (!r.ok) return { error: `${modelo} ${r.status} ${(await r.text()).slice(0, 200)}` }
  const j = await r.json()
  let o: any = null
  try { o = JSON.parse(j.choices?.[0]?.message?.content ?? '') } catch (_) { return { error: `${modelo}: no devolvió JSON` } }
  return { ...formatoDeHoja(o), fotos: o.fotos, porque: o.porque, modelo, uso: j.usage }
}
/* El formato de un reel desde su hoja de 16 fotogramas (la arma quien tiene el video: el Laboratorio o la Lambda). Sergio
   escogió el modelo económico (29-sep: gpt-5-mini, 6 de 7 contra lo que él dijo; gpt-5 acertó 7 de 7 pero cuesta 5 veces
   más). Con `ig_media_id` y sin `ensayo`, queda escrito en el historial: desmonte.formatoV2, la producción y la pieza. */
const MOTOR_FORMATO = 'gpt-5-mini'
async function fijarFormato(user: string, id: string, imagen: string, ensayo: boolean) {
  if (!/^\d+$/.test(id)) return { error: 'Falta el reel.' }
  const r: any = await formatoHoja(imagen, MOTOR_FORMATO)
  if (!r?.formato) return { error: r?.error || 'No salió el formato.' }
  const mirada = { formato: r.formato, detalle: r.detalle, motor: r.modelo, porque: String(r.porque || '').slice(0, 200), cuando: new Date().toISOString() }
  if (!ensayo) {
    const f = (await tabla(`historial_reels?user_id=eq.${user}&ig_media_id=eq.${id}&select=desmonte,piezas`))?.[0]
    if (!f) return { error: 'No está en el historial.' }
    const d = f.desmonte || {}, vista = d.vista || {}
    const desmonte = { ...d, formatoV2: mirada, vista: { ...vista, produccion: { ...(vista.produccion || {}), formato: r.formato } } }
    await tabla(`historial_reels?ig_media_id=eq.${id}&user_id=eq.${user}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ desmonte, piezas: f.piezas ? { ...f.piezas, formato: r.formato } : f.piezas }) })
  }
  return mirada
}
async function formatoHoja(imagen: string, motor = '') {
  const datos = String(imagen || '').replace(/^data:image\/\w+;base64,/, '')
  if (datos.length < 1000) return { error: 'Falta la hoja.' }
  if (motor.startsWith('gpt')) return await formatoHojaOpenAI(datos, motor)
  const cuerpo = {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: datos } }, { text: 'Estos son los 16 fotogramas.' }] }],
    systemInstruction: { parts: [{ text: SIS_HOJA }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 6000 },
  }
  const fallas: string[] = []
  for (const modelo of MODELOS) {
    const r = await fetch(`${GBASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    if (!r.ok) { fallas.push(`${modelo} ${r.status}`); continue }
    const j = await r.json()
    const txt = j?.candidates?.[0]?.content?.parts?.map((x: any) => x?.text || '').join('') ?? ''
    let o: any = null
    try { o = JSON.parse(txt) } catch (_) { try { o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)) } catch (_) { /* nada */ } }
    if (o) return { ...formatoDeHoja(o), fotos: o.fotos, porque: o.porque, modelo }
    fallas.push(`${modelo}: no devolvió JSON`)
  }
  return { error: 'No se pudo mirar la hoja: ' + fallas.join(' · ') }
}
async function verFormato(user: string, id: string, ensayo: boolean) {
  if (!/^\d+$/.test(id)) return { error: 'Falta el reel.' }
  const f = (await tabla(`historial_reels?user_id=eq.${user}&ig_media_id=eq.${id}&select=ig_user_id,desmonte,piezas`))?.[0]
  if (!f) return { error: 'No está en el historial.' }
  const c = (await tabla(`cuentas_instagram?user_id=eq.${user}&ig_user_id=eq.${f.ig_user_id}&estado=eq.activa&select=token`))?.[0]
  if (!c?.token) return { error: 'La cuenta de Instagram no está conectada.' }
  const info = await ig(`${id}?fields=media_url&access_token=${c.token}`)
  if (!info?.media_url) return { error: 'Instagram no dio el video.' }
  const v = await fetch(info.media_url)
  if (!v.ok) return { error: `No se pudo bajar el video (${v.status}).` }
  const uri = await subirVideo(new Uint8Array(await v.arrayBuffer()), 'video/mp4')
  let o: any
  try { o = await mirarVideo(SIS_FORMATO, uri) } finally { await borrarVideo(uri) }
  const formato = formatoDe(o)
  const mirada = { formato, camaraCambia: o?.camaraCambia === true, personaSeMueve: o?.personaSeMueve === true,
    especial: String(o?.especial || '').slice(0, 30), porque: String(o?.porque || '').replace(/\s+/g, ' ').slice(0, 200), cuando: new Date().toISOString() }
  if (!ensayo) {
    const d = f.desmonte || {}, vista = d.vista || {}
    const desmonte = { ...d, formatoV2: mirada, vista: { ...vista, produccion: { ...(vista.produccion || {}), formato } } }
    await tabla(`historial_reels?ig_media_id=eq.${id}&user_id=eq.${user}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ desmonte, piezas: f.piezas ? { ...f.piezas, formato } : f.piezas }) })
  }
  return mirada
}

async function estado(user: string) {
  const filas = (await tabla(`historial_reels?user_id=eq.${user}&select=estado,tanda,medido`)) || []
  const cuenta = (fn: (f: any) => boolean) => filas.filter(fn).length
  return {
    total: filas.length, medidos: cuenta((f) => !!f.medido),
    listos: cuenta((f) => f.estado === 'listo'), desmontando: cuenta((f) => f.estado === 'desmontando'),
    pendientes: cuenta((f) => f.estado === 'pendiente'), fallos: cuenta((f) => f.estado === 'fallo'),
    por_tanda: [1, 2, 3].map((t) => ({ tanda: t, total: cuenta((f) => f.tanda === t), listos: cuenta((f) => f.tanda === t && f.estado === 'listo') })),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const b = await req.json().catch(() => ({}))
    const accion = String(b?.accion || 'estado')
    // el reloj: cada pocos minutos, para quien ya empezó su historial
    if (accion === 'ciclo') {
      if (!LLAVE_RELOJ || b?.llave !== LLAVE_RELOJ) return responder({ error: 'llave' }, 401)
      const usuarios = [...new Set((((await tabla('historial_reels?select=user_id&estado=in.(pendiente,desmontando)&limit=5000')) || []) as any[]).map((x) => x.user_id))]
      const sinMedir = [...new Set((((await tabla('historial_reels?select=user_id&medido=is.null&limit=5000')) || []) as any[]).map((x) => x.user_id))]
      const sinAgrupar = [...new Set((((await tabla('historial_reels?select=user_id&estado=eq.listo&piezas=is.null&limit=5000')) || []) as any[]).map((x) => x.user_id))]
      // una vez al día (9:00 UTC), los reels nuevos de todos los que ya empezaron su historial
      const d = new Date(), diario = d.getUTCHours() === 9 && d.getUTCMinutes() < 3
      const todos = diario ? [...new Set((((await tabla('historial_reels?select=user_id&limit=10000')) || []) as any[]).map((x) => x.user_id))] : []
      const hechos: any[] = []
      for (const u of new Set([...usuarios, ...sinMedir, ...sinAgrupar, ...todos])) {
        try {
          const t = sinMedir.includes(u) || todos.includes(u) ? await traer(u as string) : null
          const p = t ? await puntuar(u as string) : null
          const a = await avanzar(u as string)
          // las ideas se agrupan cuando ya hay 10 sin agrupar, o al terminar (sin nada pendiente)
          let g = null
          if (sinAgrupar.includes(u)) {
            const falta = ((await tabla(`historial_reels?user_id=eq.${u}&estado=eq.listo&piezas=is.null&select=ig_media_id`)) || []).length
            if (falta >= 10 || !a.en_curso) g = await agrupar(u as string, '', [])
          }
          hechos.push({ u, traer: !!t, puntuados: p?.puntuados ?? null, agrupados: g?.agrupados ?? null, ...a })
        } catch (e) { hechos.push({ u, error: String(e).slice(0, 200) }) }
      }
      return responder({ ciclo: hechos })
    }
    const quien = await quienEs(req)
    if (!quien) return responder({ error: 'Inicia sesión en Cherry' }, 401)
    const user = quien === 'servidor' ? String(b?.user_id || '') : quien
    if (!/^[0-9a-f-]{36}$/.test(user)) return responder({ error: 'Falta la persona.' }, 400)
    if (accion === 'traer') return responder(await traer(user))
    if (accion === 'puntuar') return responder(await puntuar(user))
    if (accion === 'avanzar') return responder(await avanzar(user))
    if (accion === 'agrupar') return responder(await agrupar(user, String(b?.ig_user_id || ''), Array.isArray(b?.lab) ? b.lab : [], b?.desde_cero === true, b?.ensayo === true))
    if (accion === 'lista') return responder(await lista(user))
    if (accion === 'uno') return responder(await uno(user, String(b?.ig_media_id || '')))
    if (accion === 'formato') return responder(await verFormato(user, String(b?.ig_media_id || ''), b?.ensayo === true))
    if (accion === 'formatoHoja') return responder(b?.ig_media_id
      ? await fijarFormato(user, String(b.ig_media_id), String(b?.imagen || ''), b?.ensayo === true)
      : await formatoHoja(String(b?.imagen || ''), String(b?.motor || MOTOR_FORMATO)))
    if (accion === 'lab') return responder(await lab(user, String(b?.ig_user_id || ''), Array.isArray(b?.ideas) ? b.ideas : []))
    return responder(await estado(user))
  } catch (e) {
    console.error('[historial]', e)
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

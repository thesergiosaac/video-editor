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
//   (20-oct, «Cherry ve todos tus videos») cada hora los reels nuevos (la primera página) y una vez al día la lista
//   entera; cada cuenta por separado (la que Instagram cerró queda 'vencida' y las demás siguen); números a las 24 h y
//   otra vez a las 48 h; los reels nuevos se desmontan primero. Con `seco: true` traer/avanzar dicen qué harían.
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
/* (20-oct) Instagram cerró la sesión (cambio de clave, cierre de Meta por seguridad, o venció): code 190 */
const sesionCerrada = (m: string) => /"code"\s*:\s*190|session has been invalidated|Error validating access token|Session has expired/i.test(m)
const HORA = 3600 * 1000
/* ¿le toca medir? A las 24 h la primera vez (antes son números a medias) y otra vez a las 48 h (cuando se asientan) */
function tocaMedir(f: any, ahora: number) {
  const edad = ahora - Date.parse(f.publicado)
  if (!f.medido) return edad >= 24 * HORA
  return Date.parse(f.medido) - Date.parse(f.publicado) < 48 * HORA && edad >= 48 * HORA
}
async function traer(user: string, rapido = false, seco = false) {
  const cuentas = await tabla(`cuentas_instagram?user_id=eq.${user}&estado=eq.activa&select=ig_user_id,usuario,token`)
  if (!cuentas?.length) return { error: 'No hay ninguna cuenta de Instagram conectada.' }
  const resumen: any[] = []
  /* (20-oct) cada cuenta por separado: antes la primera que fallaba (sesión cerrada) frenaba a todas las demás y desde el
     17-oct no entraba ningún reel nuevo de ninguna cuenta */
  for (const c of cuentas) try {
    // 1 · la lista: todas las páginas (lo nuevo entra; lo que ya estaba no se toca). `rapido` (cada hora): solo la primera
    const ya = new Set(((await tabla(`historial_reels?user_id=eq.${user}&ig_user_id=eq.${c.ig_user_id}&select=ig_media_id`)) || []).map((x: any) => x.ig_media_id))
    let url = `me/media?fields=id,media_type,media_product_type,timestamp,permalink,caption,thumbnail_url&limit=50&access_token=${c.token}`
    let nuevos = 0, paginas = 0
    while (url && paginas < (rapido ? 1 : 40)) {
      const m = await ig(url)
      paginas++
      const filas = (m?.data || []).filter((p: any) => String(p.media_product_type || '') === 'REELS' && !ya.has(p.id)).map((p: any) => ({
        ig_media_id: p.id, user_id: user, ig_user_id: c.ig_user_id, publicado: p.timestamp, enlace: p.permalink,
        texto: String(p.caption || '').slice(0, 2200), miniatura: p.thumbnail_url || null,
      }))
      if (filas.length) {
        if (!seco) await tabla('historial_reels?on_conflict=ig_media_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(filas) })
        nuevos += filas.length
      }
      const sig = m?.paging?.next ? String(m.paging.next) : ''
      url = sig
    }
    // 2 · los números (de a MAX_MEDIR: el límite de Instagram). (20-oct) Los de los últimos 10 días, cuando les toca (24 h y
    //     48 h); los más viejos sin medir, como siempre
    const ahora = Date.now(), corte = new Date(ahora - 10 * 24 * HORA).toISOString()
    const recientes = ((await tabla(`historial_reels?user_id=eq.${user}&ig_user_id=eq.${c.ig_user_id}&publicado=gte.${corte}&select=ig_media_id,publicado,medido&order=publicado.desc`)) || [])
      .filter((f: any) => tocaMedir(f, ahora))
    const viejos = (await tabla(`historial_reels?user_id=eq.${user}&ig_user_id=eq.${c.ig_user_id}&medido=is.null&publicado=lt.${corte}&select=ig_media_id,publicado&order=publicado.desc&limit=${MAX_MEDIR}`)) || []
    const faltan = recientes.concat(viejos).slice(0, MAX_MEDIR)
    if (seco) { resumen.push({ cuenta: c.usuario, nuevos, paginas, por_medir: faltan.length }); continue }
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
  } catch (e) {
    const msg = String((e as Error)?.message || e)
    const cerrada = sesionCerrada(msg)
    // (20-oct) la sesión que Instagram cerró queda 'vencida': nadie la vuelve a intentar y Cherry pide reconectarla
    //          (ig-conectar la deja otra vez 'activa' al volver a entrar)
    if (cerrada && !seco) {
      const cambio = await tabla(`cuentas_instagram?user_id=eq.${user}&ig_user_id=eq.${c.ig_user_id}&estado=eq.activa`, { method: 'PATCH',
        headers: { Prefer: 'return=representation' }, body: JSON.stringify({ estado: 'vencida' }) }).catch(() => null)
      console.warn(`[historial] Instagram cerró la sesión de @${c.usuario}: queda «vencida»`)
      /* (22-oct) Sergio: «anota la hora en que se cierra cada cuenta». Una vez por cierre (solo si estaba activa): la hora
         es la de la revisión que lo notó, que pasa cada hora. */
      if (Array.isArray(cambio) && cambio.length) {
        await tabla('instagram_sesiones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          user_id: user, ig_user_id: c.ig_user_id, usuario: c.usuario, evento: 'cerrada', detalle: msg.slice(0, 400), funcion: 'historial',
        }) }).catch((e) => console.warn('[historial] no se anotó el cierre:', String(e).slice(0, 120)))
      }
    }
    resumen.push({ cuenta: c.usuario, error: msg.slice(0, 200), sesion_cerrada: cerrada })
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
async function avanzar(user: string, seco = false) {
  const ahora = Date.now()
  // los que se quedaron a medias (más de 20 min «desmontando»): vuelven a la fila, o fallan al tercer intento
  const colgados = (await tabla(`historial_reels?user_id=eq.${user}&estado=eq.desmontando&select=ig_media_id,intentos,actualizado`)) || []
  for (const c of colgados) {
    if (seco || ahora - Date.parse(c.actualizado) < 20 * 60 * 1000) continue
    await tabla(`historial_reels?ig_media_id=eq.${c.ig_media_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: c.intentos >= 3 ? 'fallo' : 'pendiente', error: 'se quedó a medias', actualizado: new Date().toISOString() }) })
  }
  const enCurso = ((await tabla(`historial_reels?user_id=eq.${user}&estado=eq.desmontando&select=ig_media_id`)) || []).length
  /* (6-oct) cada reel desmontado gasta un video del cupo del mes (sql/20-historial-cupo.sql). Con el cobro en 'contar'
     y para el administrador no hay tope; si no se puede saber, se sigue como antes. */
  let delMes = 1000000
  try { delMes = Number(await tabla('rpc/cupo_historial', { method: 'POST', body: JSON.stringify({ p_user: user }) })) } catch (_) { /* sin tope */ }
  if (!Number.isFinite(delMes)) delMes = 1000000
  const cupo = Math.max(0, Math.min(A_LA_VEZ - enCurso, delMes))
  if (!cupo) return { lanzados: 0, en_curso: enCurso, ...(delMes <= 0 ? { cupo_lleno: true } : {}) }
  /* (20-oct) primero los de la última semana, del más nuevo al más viejo, sin esperar a su puntaje (que llega a los 3 días):
     así un reel queda desmontado más o menos una hora después de publicarlo. Después, las tandas:
     tanda 1 del mejor al peor, tanda 2 del peor al mejor, tanda 3 del mejor al peor */
  const sig: any[] = ((await tabla(`historial_reels?user_id=eq.${user}&estado=eq.pendiente&publicado=gte.${new Date(ahora - 7 * 24 * HORA).toISOString()}&select=ig_media_id,intentos,publicado&order=publicado.desc&limit=${cupo}`)) || [])
  for (const [t, ord] of [[1, 'desc'], [2, 'asc'], [3, 'desc']] as [number, string][]) {
    if (sig.length >= cupo) break
    const ya = new Set(sig.map((x: any) => x.ig_media_id))
    const f = ((await tabla(`historial_reels?user_id=eq.${user}&estado=eq.pendiente&tanda=eq.${t}&select=ig_media_id,intentos&order=puntaje.${ord}&limit=${cupo}`)) || [])
      .filter((x: any) => !ya.has(x.ig_media_id))
    sig.push(...f.slice(0, cupo - sig.length))
  }
  if (seco) return { lanzaria: sig.map((x: any) => x.ig_media_id), en_curso: enCurso, cupo }
  for (const f of sig) {
    await tabla(`historial_reels?ig_media_id=eq.${f.ig_media_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: 'desmontando', intentos: (f.intentos || 0) + 1, actualizado: new Date().toISOString() }) })
    await lambdaAsync('carrete-media-processor', { mode: 'desmontarReel', user_id: user, ig_media_id: f.ig_media_id })
    // (6-oct) apuntado como un video del mes (una sola vez por reel, aunque se reintente)
    tabla('rpc/gastar', { method: 'POST', body: JSON.stringify({ p_user: user, p_proyecto: null,
      p_cobros: [{ llave: 'hist:' + f.ig_media_id, que: 'historial', creditos: 0 }] }) }).catch(() => null)
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
        // (20-oct) lo que no es de aquí (el estilo, sus gemelos) se queda
        estilo: f.piezas?.estilo ?? null, estilo_desc: f.piezas?.estilo_desc ?? null, gemelos: f.piezas?.gemelos ?? [],
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
/* ── estilos (20-oct): CÓMO SE VE cada reel, descubierto sin lista fija ──
   Sergio: «que Cherry analice qué tiene el video sin yo enseñárselo… otro usuario puede subir un formato que no conozcamos
   y Cherry tiene que poder decir: este formato, tal cual así como se ve, le fue bien, lo repitió en tal video y también».
   Una mirada de la IA a las portadas (la `tapa` del desmontaje, guardada en CloudFront: no depende de Instagram) describe
   cada reel y junta en GRUPOS con nombre los que se ven igual; reusa los nombres que ya hay. Se guarda en `piezas`:
   estilo (el grupo), estilo_desc ({estilo, rasgos, mundo}) y gemelos (los reels que dicen casi lo mismo, por el texto).
   De a LOTE portadas por llamada (Gemini, resolución baja): ≈ US$0,01 por cada 40. */
const SIS_ESTILO = `Miras las portadas de los reels de UNA cuenta; cada imagen viene después de su id. No hay lista de estilos: los describes tú, tal cual se ven.
Para cada reel:
- "estilo": de 3 a 7 palabras que digan cómo se ve, como lo diría alguien que lo ve por primera vez («ciudad 3D vista desde arriba, de noche», «caricatura luminosa con fondo crema», «persona hablando a cámara en una cocina»).
- "rasgos": de 3 a 6 rasgos visuales concretos que se podrían repetir en otro video: la técnica (grabado real, 3D, ilustración, captura de pantalla), el punto de vista, la luz y los colores, qué hay en la escena, cómo va el texto en pantalla.
- "mundo": uno de «real», «animado 3D», «ilustrado», «pantalla», «mixto».
Después junta en GRUPOS los que se ven igual a simple vista (misma técnica, mismo punto de vista, misma luz y paleta): alguien que vea dos portadas del mismo grupo diría «es el mismo estilo». El tema del video NO cuenta, solo cómo se ve. Un grupo puede tener un solo reel. Nombra cada grupo con 3 a 6 palabras de lo que se ve; nunca «otros», «varios» ni «general».
Si te paso grupos que ya existen, reusa EXACTAMENTE su nombre cuando el reel se vea así.
Devuelve SOLO JSON {"reels":[{"id":"...","estilo":"...","rasgos":["..."],"mundo":"..."}],"grupos":[{"nombre":"...","ids":["..."]}]} con TODOS los id, cada uno en UN solo grupo.`
const LOTE = 40
function b64(bytes: Uint8Array) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
async function geminiPartes(sistema: string, partes: unknown[]) {
  const cuerpo = { contents: [{ role: 'user', parts: partes }], systemInstruction: { parts: [{ text: sistema }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 16000, mediaResolution: 'MEDIA_RESOLUTION_LOW' } }
  const fallas: string[] = []
  for (const vuelta of [0, 1]) {
    if (vuelta) await new Promise((r) => setTimeout(r, 5000))
    for (const modelo of MODELOS) {
      const r = await fetch(`${GBASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      if (!r.ok) { fallas.push(`${modelo} ${r.status}`); continue }
      const j = await r.json()
      const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
      try { return { o: JSON.parse(txt), uso: j?.usageMetadata, modelo } } catch (_) { /* sigue */ }
      try { return { o: JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)), uso: j?.usageMetadata, modelo } } catch (_) { fallas.push(`${modelo}: no devolvió JSON`) }
    }
  }
  throw new Error('No se pudieron ver los estilos: ' + fallas.join(' · '))
}
/* los gemelos: dos reels que dicen casi lo mismo (las mismas palabras), aunque se vean distinto */
const palabrasDe = (t: string) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-zñ0-9]+/).filter((w) => w.length > 3))
function parecido(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0
  let comun = 0; a.forEach((w) => { if (b.has(w)) comun++ })
  return comun / (a.size + b.size - comun)
}
/* `nuevos`: solo los que aún no tienen estilo (los pone en los grupos que ya hay o en uno nuevo), de a `max` por llamada,
   y guarda cada tanda al terminarla: así una cuenta grande se hace en varias llamadas sin pasarse del tiempo. */
async function estilos(user: string, igu: string, seco = false, nuevos = false, max = 400) {
  if (!/^\d+$/.test(igu)) return { error: 'Falta la cuenta.' }
  const filas = ((await tabla(`historial_reels?user_id=eq.${user}&ig_user_id=eq.${igu}&estado=eq.listo&select=ig_media_id,tapa,miniatura,desmonte,piezas&order=publicado.desc&limit=400`)) || []) as any[]
  const yaHay = [...new Set(filas.map((f) => f.piezas?.estilo).filter(Boolean))] as string[]
  const toca = (nuevos ? filas.filter((f) => !f.piezas?.estilo) : filas).slice(0, Math.max(1, max))
  const desc: Record<string, any> = {}, grupo: Record<string, string> = {}
  let uso: any = null, modelo = ''
  for (let i = 0; i < toca.length; i += LOTE) {
    const partes: unknown[] = []
    for (const f of toca.slice(i, i + LOTE)) {
      const url = f.tapa || f.miniatura
      if (!url) continue
      try {
        const r = await fetch(url)
        if (!r.ok) continue
        partes.push({ text: 'id ' + f.ig_media_id }, { inlineData: { mimeType: r.headers.get('content-type') || 'image/jpeg', data: b64(new Uint8Array(await r.arrayBuffer())) } })
      } catch (_) { /* sin portada: se queda sin estilo */ }
    }
    if (!partes.length) continue
    const nombres = [...new Set([...yaHay, ...Object.values(grupo)])]
    if (nombres.length) partes.unshift({ text: 'Grupos que ya existen: ' + JSON.stringify(nombres) })
    const res = await geminiPartes(SIS_ESTILO, partes)
    uso = res.uso; modelo = res.modelo
    ;(Array.isArray(res.o?.reels) ? res.o.reels : []).forEach((x: any) => {
      const id = String(x?.id || '').replace(/^id\s*/, '')
      if (id) desc[id] = { estilo: String(x?.estilo || '').slice(0, 80), rasgos: (Array.isArray(x?.rasgos) ? x.rasgos : []).map((r: any) => String(r).slice(0, 60)).slice(0, 6), mundo: String(x?.mundo || '').slice(0, 20) }
    })
    ;(Array.isArray(res.o?.grupos) ? res.o.grupos : []).forEach((g: any) => {
      const n = String(g?.nombre || '').trim().slice(0, 60)
      if (!n || /^(otros?|varios?|general)/i.test(n)) return
      ;(Array.isArray(g?.ids) ? g.ids : []).forEach((id: any) => { grupo[String(id).replace(/^id\s*/, '')] = n })
    })
    if (!seco) {   // la tanda se guarda ya, por si la llamada se corta en la siguiente
      for (const f of toca.slice(i, i + LOTE)) {
        if (!grupo[f.ig_media_id]) continue
        f.piezas = { ...(f.piezas || {}), estilo: grupo[f.ig_media_id], estilo_desc: desc[f.ig_media_id] || null }
        await tabla(`historial_reels?ig_media_id=eq.${f.ig_media_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ piezas: f.piezas }) })
      }
    }
  }
  // los gemelos, por el texto de lo que se dice
  const txt = filas.map((f) => ({ id: f.ig_media_id, w: palabrasDe(f.desmonte?.texto || '') }))
  const gemelos: Record<string, string[]> = {}
  for (let a = 0; a < txt.length; a++) for (let b = a + 1; b < txt.length; b++) {
    if (parecido(txt[a].w, txt[b].w) >= 0.6) { (gemelos[txt[a].id] ||= []).push(txt[b].id); (gemelos[txt[b].id] ||= []).push(txt[a].id) }
  }
  const salida = filas.map((f) => ({ id: f.ig_media_id, estilo: grupo[f.ig_media_id] || f.piezas?.estilo || null, desc: desc[f.ig_media_id] || f.piezas?.estilo_desc || null, gemelos: gemelos[f.ig_media_id] || [] }))
  if (!seco) {   // los gemelos: solo donde cambiaron
    for (const x of salida) {
      const f = filas.find((y) => y.ig_media_id === x.id)
      if (JSON.stringify(f?.piezas?.gemelos || []) === JSON.stringify(x.gemelos)) continue
      await tabla(`historial_reels?ig_media_id=eq.${x.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ piezas: { ...(f?.piezas || {}), gemelos: x.gemelos } }) })
    }
  }
  const grupos: Record<string, number> = {}
  salida.forEach((x) => { if (x.estilo) grupos[x.estilo] = (grupos[x.estilo] || 0) + 1 })
  return { reels: salida.length, con_estilo: salida.filter((x) => x.estilo).length, faltan: salida.filter((x) => !x.estilo).length, grupos, gemelos: Object.keys(gemelos).length, modelo, uso, salida }
}

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
/* (28-oct) Sergio: «que Cherry reconozca y cree formatos… los videos animados donde habla David los categoriza en dinámico o
   estático». La HUELLA —quién sale, quién habla, de qué está hecha la imagen— decide el formato cuando no hay nadie hablándole a
   la cámara; con alguien a cámara manda la cámara (Estático, Plano fijo, Dinámico) o el montaje especial. Los 12 de siempre se
   quedan con su nombre y las huellas nuevas se nombran solas («Animado con voz en off», «Pantalla con voz en off»…): el mismo
   estilo cae siempre en el mismo formato (artefacto «Formatos que Cherry aprende», docs/CRITERIO-SERGIO.md § 7).
   ⚠️ Copiada en historial.ts, lab-ver-video.ts y herramientas.ts: si se cambia, se cambia en las tres. */
const ESPECIALES = ['Podcast', 'VS', 'Top', 'Entrevista random', 'Entrevista', 'Pantalla dividida', 'Pantalla verde']
const DE_HUELLA = ['Animado con voz en off', 'Animado con diálogos', 'Animado con textos', 'Pantalla con voz en off', 'Pantalla con textos',
  'Clips con voz en off', 'Clips con textos', 'Manos con voz en off', 'Manos con textos']
function huellaLimpia(h: any) {
  const de = (v: any, ok: string[]) => (ok.includes(String(v || '')) ? String(v) : '')
  return { quien: de(h?.quien, ['persona', 'accion', 'manos', 'nadie']), habla: de(h?.habla, ['persona', 'off', 'varios', 'nadie']),
    imagen: de(h?.imagen, ['real', 'animacion', 'pantalla', 'clips']) }
}
/* previo: el que ya decía Cherry (la cámara o el montaje especial); camara: Estático / Plano fijo / Dinámico, si se sabe */
function formatoPorHuella(h: any, previo: string, camara = '') {
  const { quien, habla, imagen } = huellaLimpia(h)
  const voz = habla === 'nadie' ? 'con textos' : 'con voz en off'
  /* sin nadie grabado manda la huella: los montajes especiales son con alguien a cámara, y en los animados Gemini los ve un
     día sí y otro no (28-oct: «VS» en 2 de 4 reels que una hora antes había dicho animados) */
  if (quien === 'nadie' || quien === 'manos' || (!quien && imagen && imagen !== 'real')) {
    if (imagen === 'animacion') return 'Animado ' + (habla === 'varios' ? 'con diálogos' : voz)   // varios personajes que conversan ≠ un narrador
    if (imagen === 'pantalla') return 'Pantalla ' + voz
    if (imagen === 'clips') return 'Clips ' + voz
    return quien === 'manos' ? 'Manos ' + voz : 'B-roll'
  }
  if (ESPECIALES.includes(previo)) return previo                         // con alguien a cámara, los montajes especiales mandan
  if (quien === 'accion') return habla === 'persona' || habla === 'varios' ? 'Storytelling' : 'B-roll'
  if (quien === 'persona' && !['Estático', 'Plano fijo', 'Dinámico'].includes(previo) && camara) return camara
  return previo || camara
}
const FORMATOS = ['Estático', 'Plano fijo', 'Dinámico', 'Podcast', 'VS', 'Top', 'B-roll', 'Entrevista random', 'Entrevista',
  'Pantalla dividida', 'Pantalla verde', 'Storytelling', ...DE_HUELLA]
const BASICOS = ['Estático', 'Plano fijo', 'Dinámico']
const SIS_FORMATO = `Miras un video corto de redes y dices CÓMO ESTÁ GRABADO. Devuelve SOLO JSON:
{"camaraCambia":false,"personaSeMueve":false,"especial":"","porque":"..."}
- camaraCambia: true SOLO si la cámara está en OTRO LUGAR o con OTRO ÁNGULO en distintas tomas: el fondo cambia de sitio, la escena se ve desde otra dirección, otra habitación, otro plano grabado aparte. NO cuentan: los cortes que quitan pausas dentro de la misma toma (el fondo sigue igual), los acercamientos o zooms hechos en edición (la misma imagen, más grande), las imágenes, capturas, textos o videos que se ponen encima, ni que la persona se acerque o se aleje de una cámara quieta.
- personaSeMueve: con la cámara quieta, ¿la persona cambia de lugar dentro del cuadro? true si se acerca y se aleja de verdad (de cuerpo entero a cerca), camina de un lado a otro, sale y entra, o habla desde distintos puntos del mismo sitio. false si se queda hablando en la misma posición (los gestos y las manos no cuentan).
- especial: SOLO si el video entero está hecho así, su nombre; si no, "": «Podcast» (simula un podcast: micrófono de podcast a la vista, audífonos o dos sillas) · «VS» (enfrenta dos cosas a ver cuál gana, las dos en pantalla) · «Top» (el video es un ranking: numera cosas de mayor a menor o al revés; un contador de pasos NO lo hace Top) · «B-roll» (NO se ve a la persona hablando: voz en off sobre escenas de apoyo) · «Entrevista random» (grabado en POV: alguien llega y le pregunta, con la cámara en la mano de quien pregunta) · «Entrevista» (cámara quieta y en cuadro aparece la mano con el micrófono o la persona que pregunta) · «Pantalla dividida» (la imagen partida en dos buena parte del video: la persona en una mitad, una grabación o ejemplos en la otra) · «Pantalla verde» (la persona recortada sobre un video o una imagen de fondo) · «Storytelling» (cuenta algo mientras hace una acción natural con las manos: cocinar, maquillarse, afeitarse, conducir, entrenar).
- porque: en qué te fijaste para camaraCambia y personaSeMueve, máx. 25 palabras.
Mira el video entero antes de decidir. En español.`
const SIS_HUELLA = `Miras un video corto de redes (lo ves y lo oyes entero) y dices CÓMO ESTÁ HECHO. Devuelve SOLO JSON:
{"quien":"persona","habla":"persona","imagen":"real","camaraCambia":false,"personaSeMueve":false,"especial":"","porque":"..."}
- quien: quién sale la mayor parte del video. «persona» = alguien le habla a la cámara · «accion» = alguien sale haciendo algo (cocinar, caminar, entrenar, conducir) sin hablarle a la cámara · «manos» = solo se ven manos u objetos · «nadie» = no sale ninguna persona grabada. Las ilustraciones, dibujos, estatuas, fotos recortadas o personajes animados NO cuentan como persona.
- habla: quién se oye. «persona» = la que sale en cámara (se le ve hablar) · «off» = una voz que cuenta sin que se vea quién habla · «varios» = dos o más que conversan · «nadie» = no hay voz: solo música, sonidos o textos.
- imagen: de qué está hecho lo que se ve la mayor parte del tiempo. «real» = grabado con una cámara · «animacion» = animación, ilustraciones, fotos o recortes que se mueven, collage, textos animados, imágenes hechas con IA · «pantalla» = grabación de la pantalla de un celular o computador · «clips» = pedazos de videos de otros (películas, TikToks, noticias).
` + SIS_FORMATO.split('\n').slice(2).join('\n')
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
/* (28-oct) modelos y cuánto «piensa»: la huella va con gemini-3.6-flash pensando poco (lab-ver-video: 7–13 s contra 49–97 s) */
const MODELOS_HUELLA = ['gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']   // (28-oct, noche) con 429 de cuota se salta al siguiente; Lite al final (otra cuota)
async function mirarVideo(sistema: string, uri: string, modelos = MODELOS, pensar = '') {
  const cuerpo = {
    contents: [{ role: 'user', parts: [{ fileData: { fileUri: uri, mimeType: 'video/mp4' } }, { text: 'Analízalo entero.' }] }],
    systemInstruction: { parts: [{ text: sistema }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4000, ...(pensar ? { thinkingConfig: { thinkingLevel: pensar } } : {}) },
  }
  const fallas: string[] = []
  for (const vuelta of [0, 1]) {
    if (vuelta) await new Promise((r) => setTimeout(r, 8000))
    let cuota = false
    for (const [i, modelo] of modelos.entries()) {
      if (i && modelos[i - 1] === modelo && cuota) continue   // (28-oct) con 429 de cuota, insistirle al mismo no sirve
      const r = await fetch(`${GBASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      cuota = r.status === 429
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
Devuelve SOLO JSON {"fotos":[{"n":1,"fondo":"clóset blanco, maleta negra, piso claro","camara":"A","persona":"medio","postura":"sentado","imagen":"real"}],"porque":"..."} con los 16.
- fondo: PRIMERO describe lo que se ve detrás de la persona, máx. 8 palabras: el sitio, los muebles, la pared, desde qué altura se ve. Compara cada fondo con los anteriores antes de poner la letra.
- camara: una letra por posición de cámara, según el fondo que describiste. La MISMA letra solo si el fondo es el mismo sitio visto desde el mismo lugar y con el mismo ángulo (los mismos muebles en el mismo lugar del cuadro), aunque la persona esté más cerca o más lejos. Otra letra si el fondo es otro sitio, o el mismo sitio visto desde otro lugar u otro ángulo. Si la imagen solo se agrandó en edición (el fondo también se ve más grande, mismo encuadre), es la misma letra.
- persona: "lejos" (se le ve el cuerpo entero o casi), "medio" (de la cintura para arriba), "cerca" (la cara y los hombros llenan la pantalla), "manos" (solo se ven manos u objetos), "no está". Las ilustraciones, dibujos, estatuas o personajes animados NO son una persona: "no está".
- imagen: de qué está hecho el fotograma (aquí SÍ cuenta lo que está encima si llena la pantalla): "real" (grabado con una cámara), "animacion" (animación, ilustraciones, fotos o recortes, collage, textos animados, imágenes hechas con IA), "pantalla" (la pantalla de un celular o computador), "clips" (un pedazo de video de otros). Si la imagen solo se agrandó en edición, pon la misma distancia del fotograma anterior con esa cámara.
- postura: "sentado", "de pie", "acostado" o "no se ve".
- porque: máx. 25 palabras.`
function formatoDeHoja(o: any, voz = true) {
  const fotos = (Array.isArray(o?.fotos) ? o.fotos : []).filter((f: any) => f && f.camara)
  if (!fotos.length) return { formato: '', detalle: null }
  /* (28-oct) la huella desde la hoja: sin audio, quién habla sale de si hay voz (lo dice quien manda la hoja) */
  const sinNadie = fotos.filter((f: any) => f.persona === 'no está' || f.persona === 'manos'), manos = fotos.filter((f: any) => f.persona === 'manos').length
  const quien = sinNadie.length >= 0.6 * fotos.length ? (manos > sinNadie.length - manos ? 'manos' : 'nadie') : 'persona'
  const imgs: Record<string, number> = {}
  fotos.forEach((f: any) => { const k = ['real', 'animacion', 'pantalla', 'clips'].includes(f.imagen) ? f.imagen : 'real'; imgs[k] = (imgs[k] || 0) + 1 })
  const imagen = Object.entries(imgs).sort((a, b) => b[1] - a[1])[0][0]
  const huella = { quien, habla: !voz ? 'nadie' : quien === 'persona' ? 'persona' : 'off', imagen }
  const cuenta: Record<string, number> = {}
  fotos.forEach((f: any) => { cuenta[f.camara] = (cuenta[f.camara] || 0) + 1 })
  const [principal, n] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]
  const parte = n / fotos.length, camaras = Object.keys(cuenta).length
  const en = fotos.filter((f: any) => f.camara === principal && f.persona !== 'no está' && f.persona !== 'manos')
  const distancias = new Set(en.map((f: any) => f.persona)), posturas = new Set(en.map((f: any) => f.postura).filter((x: any) => x && x !== 'no se ve'))
  const mueve = distancias.size >= 2 || posturas.size >= 2
  // la raya en 75 % (29-sep, con 13 etiquetas de Sergio): el modelo económico ve menos cambios de cámara de los que hay,
  // y sus Dinámicos quedaban entre 60 y 69 %; su único Plano fijo con varias cámaras tenía la principal en 81 %
  const camara = parte < 0.75 ? 'Dinámico' : mueve ? 'Plano fijo' : camaras >= 4 ? 'Dinámico' : 'Estático'
  const formato = formatoPorHuella(huella, camara, camara)
  return { formato, huella, detalle: { parte: Math.round(parte * 100), camaras, distancias: [...distancias], posturas: [...posturas], mueve } }
}
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
/* (ensayo) la misma hoja con el modelo de visión de OpenAI: Gemini flash no distingue bien las posiciones de cámara */
async function formatoHojaOpenAI(datos: string, modelo: string, voz = true) {
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
  return { ...formatoDeHoja(o, voz), fotos: o.fotos, porque: o.porque, modelo, uso: j.usage }
}
/* El formato de un reel desde su hoja de 16 fotogramas (la arma quien tiene el video: el Laboratorio o la Lambda). Sergio
   escogió el modelo económico (29-sep: gpt-5-mini, 6 de 7 contra lo que él dijo; gpt-5 acertó 7 de 7 pero cuesta 5 veces
   más). Con `ig_media_id` y sin `ensayo`, queda escrito en el historial: desmonte.formatoV2, la producción y la pieza. */
const MOTOR_FORMATO = 'gpt-5-mini'
async function fijarFormato(user: string, id: string, imagen: string, ensayo: boolean, voz = true) {
  if (!/^\d+$/.test(id)) return { error: 'Falta el reel.' }
  const r: any = await formatoHoja(imagen, MOTOR_FORMATO, voz)
  if (!r?.formato) return { error: r?.error || 'No salió el formato.' }
  const mirada = { formato: r.formato, huella: r.huella || null, detalle: r.detalle, motor: r.modelo, porque: String(r.porque || '').slice(0, 200), cuando: new Date().toISOString() }
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
/* (29-sep) Sergio corrige el formato desde la ficha: queda como fuente «usuario» y manda sobre lo que dijo Cherry. */
async function corregirFormato(user: string, id: string, formato: string) {
  const fmt = String(formato || '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!/^\d+$/.test(id) || !fmt) return { error: 'Falta el reel o el formato.' }
  const f = (await tabla(`historial_reels?user_id=eq.${user}&ig_media_id=eq.${id}&select=desmonte,piezas`))?.[0]
  if (!f) return { ok: false }
  const d = f.desmonte || {}, antes = d.formatoV2 || {}
  d.formatoV2 = { formato: fmt, fuente: 'usuario', cherry: antes.fuente ? antes.cherry : antes.formato, detalle: antes.detalle || null, cuando: new Date().toISOString() }
  if (d.vista?.produccion) d.vista.produccion.formato = fmt
  if (d.formato && typeof d.formato === 'object') d.formato.nombre = fmt
  await tabla(`historial_reels?ig_media_id=eq.${id}&user_id=eq.${user}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ desmonte: d, piezas: f.piezas ? { ...f.piezas, formato: fmt } : f.piezas }) })
  return { ok: true }
}
async function formatoHoja(imagen: string, motor = '', voz = true) {
  const datos = String(imagen || '').replace(/^data:image\/\w+;base64,/, '')
  if (datos.length < 1000) return { error: 'Falta la hoja.' }
  if (motor.startsWith('gpt')) return await formatoHojaOpenAI(datos, motor, voz)
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
    if (o) return { ...formatoDeHoja(o, voz), fotos: o.fotos, porque: o.porque, modelo }
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

/* (28-oct) La huella de los reels ya desmontados: Cherry baja el reel de Instagram, lo ve y lo oye entero, y el formato sale
   de la huella. Lo que corrigió la persona a mano no se toca. La cámara: la de la hoja de 16 fotogramas si ya estaba (acierta
   más que mirando el video entero), si no la del video. */
async function huellaDeReel(user: string, f: any, token: string, ensayo: boolean) {
  const info = await ig(`${f.ig_media_id}?fields=media_url&access_token=${token}`)
  if (!info?.media_url) return { error: 'Instagram no dio el video.' }
  const v = await fetch(info.media_url)
  if (!v.ok) return { error: `No se pudo bajar el video (${v.status}).` }
  const uri = await subirVideo(new Uint8Array(await v.arrayBuffer()), 'video/mp4')
  let o: any
  try { o = await mirarVideo(SIS_HUELLA, uri, MODELOS_HUELLA, 'low') } finally { await borrarVideo(uri) }
  const d = f.desmonte || {}, vista = d.vista || {}, antes = (f.piezas && f.piezas.formato) || d.formatoV2?.formato || ''
  const esp = String(o?.especial || '').trim(), camara = formatoDe({ camaraCambia: o?.camaraCambia, personaSeMueve: o?.personaSeMueve })
  const huella = huellaLimpia(o)
  const formato = formatoPorHuella(huella, ESPECIALES.includes(esp) ? esp : BASICOS.includes(antes) ? antes : camara, BASICOS.includes(antes) ? antes : camara)
  const r = { id: f.ig_media_id, formato, antes, huella, porque: String(o?.porque || '').replace(/\s+/g, ' ').slice(0, 200) }
  if (!ensayo) {
    const formatoV2 = { ...(d.formatoV2 || {}), formato, huella, especial: esp.slice(0, 30), porqueHuella: r.porque, cuandoHuella: new Date().toISOString() }
    const desmonte: any = { ...d, formatoV2, vista: { ...vista, produccion: { ...(vista.produccion || {}), formato } } }
    if (d.formato && typeof d.formato === 'object') desmonte.formato = { ...d.formato, nombre: formato }
    await tabla(`historial_reels?ig_media_id=eq.${f.ig_media_id}&user_id=eq.${user}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ desmonte, piezas: f.piezas ? { ...f.piezas, formato } : f.piezas }) })
  }
  return r
}
async function huellas(user: string, max = 2, ensayo = false, soloId = '', hasta = Date.now() + 100000) {
  const filas: any[] = (await tabla(`historial_reels?user_id=eq.${user}&estado=eq.listo&select=ig_media_id,ig_user_id,fv:desmonte->formatoV2&order=publicado.desc&limit=1000`)) || []
  const faltan = filas.filter((x) => soloId ? x.ig_media_id === soloId && (ensayo || x.fv?.fuente !== 'usuario')
    : x.fv?.fuente !== 'usuario' && !x.fv?.huella && (x.fv?.huellaFallos || 0) < 2)
  const tokens: Record<string, string> = {}
  for (const c of ((await tabla(`cuentas_instagram?user_id=eq.${user}&estado=eq.activa&select=ig_user_id,token`)) || []) as any[]) tokens[c.ig_user_id] = c.token
  const hechos: any[] = []
  for (const x of faltan.slice(0, Math.max(1, Math.min(8, max)))) {
    if (Date.now() > hasta) break
    const f = (await tabla(`historial_reels?user_id=eq.${user}&ig_media_id=eq.${x.ig_media_id}&select=ig_media_id,desmonte,piezas`))?.[0]
    let r: any = !f ? { error: 'No está.' } : !tokens[x.ig_user_id] ? { error: 'La cuenta de Instagram no está conectada.' } : null
    if (!r) { try { r = await huellaDeReel(user, f, tokens[x.ig_user_id], ensayo) } catch (e) { r = { error: String(e).slice(0, 160) } } }
    if (r.error && f && !ensayo && !/\b(429|503)\b/.test(String(r.error))) {   // dos intentos y se deja (Google lleno no cuenta)
      const d = f.desmonte || {}
      await tabla(`historial_reels?ig_media_id=eq.${x.ig_media_id}&user_id=eq.${user}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ desmonte: { ...d, formatoV2: { ...(d.formatoV2 || {}), huellaFallos: (d.formatoV2?.huellaFallos || 0) + 1, huellaError: String(r.error).slice(0, 120) } } }) })
    }
    hechos.push({ id: x.ig_media_id, ...r })
  }
  return { hechos, faltan: Math.max(0, faltan.length - hechos.length) }
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
      // (20-oct) sin medir Y ya con sus 24 h (antes de eso no le toca: si no, traería cada 3 minutos durante un día)
      const sinMedir = [...new Set((((await tabla(`historial_reels?select=user_id&medido=is.null&publicado=lt.${new Date(Date.now() - 24 * HORA).toISOString()}&limit=5000`)) || []) as any[]).map((x) => x.user_id))]
      const sinAgrupar = [...new Set((((await tabla('historial_reels?select=user_id&estado=eq.listo&piezas=is.null&limit=5000')) || []) as any[]).map((x) => x.user_id))]
      // (28-oct) los que tienen reels sin la huella del formato (y sin corrección a mano)
      const sinHuella = [...new Set((((await tabla('historial_reels?select=user_id&estado=eq.listo&desmonte->formatoV2->>huella=is.null&limit=5000')) || []) as any[]).map((x) => x.user_id))]
      const t0 = Date.now()
      // (20-oct) cada hora, los reels nuevos de todos los que ya empezaron su historial (solo la primera página); a las
      //          9:00 UTC, la lista entera (antes: solo una vez al día, y un reel de las 10 a. m. esperaba casi un día)
      const d = new Date(), enPunto = d.getUTCMinutes() < 3, diario = d.getUTCHours() === 9 && enPunto
      const todos = enPunto ? [...new Set((((await tabla('historial_reels?select=user_id&limit=10000')) || []) as any[]).map((x) => x.user_id))] : []
      const hechos: any[] = []
      for (const u of new Set([...usuarios, ...sinMedir, ...sinAgrupar, ...sinHuella, ...todos])) {
        try {
          const t = sinMedir.includes(u) || todos.includes(u) ? await traer(u as string, !diario) : null
          const p = t ? await puntuar(u as string) : null
          const a = await avanzar(u as string)
          // las ideas se agrupan cuando ya hay 10 sin agrupar, o al terminar (sin nada pendiente)
          let g = null
          if (sinAgrupar.includes(u)) {
            const falta = ((await tabla(`historial_reels?user_id=eq.${u}&estado=eq.listo&piezas=is.null&select=ig_media_id`)) || []).length
            if (falta >= 10 || !a.en_curso) g = await agrupar(u as string, '', [])
          }
          // (20-oct) el estilo de los reels ya desmontados que aún no lo tienen (de a 40 por cuenta y por vuelta)
          let est = 0
          const sinEstilo = [...new Set((((await tabla(`historial_reels?user_id=eq.${u}&estado=eq.listo&piezas->>estilo=is.null&select=ig_user_id&limit=200`)) || []) as any[]).map((x) => x.ig_user_id))]
          for (const igu of sinEstilo) {
            try { const r = await estilos(u as string, igu as string, false, true, 40); est += (r as any)?.con_estilo ? 1 : 0 } catch (e) { console.warn('[historial] estilos:', String(e).slice(0, 160)) }
          }
          // (28-oct) la huella del formato: de a 2 reels por persona, y nada si la vuelta ya va larga
          let hu = 0
          if (sinHuella.includes(u) && Date.now() - t0 < 80000) {
            try { hu = (await huellas(u as string, 2, false, '', t0 + 110000)).hechos.filter((x: any) => x.formato).length } catch (e) { console.warn('[historial] huellas:', String(e).slice(0, 160)) }
          }
          hechos.push({ u, traer: !!t, puntuados: p?.puntuados ?? null, agrupados: g?.agrupados ?? null, estilos: est, huellas: hu, ...a })
        } catch (e) { hechos.push({ u, error: String(e).slice(0, 200) }) }
      }
      return responder({ ciclo: hechos })
    }
    const quien = await quienEs(req)
    if (!quien) return responder({ error: 'Inicia sesión en Cherry' }, 401)
    const user = quien === 'servidor' ? String(b?.user_id || '') : quien
    if (!/^[0-9a-f-]{36}$/.test(user)) return responder({ error: 'Falta la persona.' }, 400)
    if (accion === 'traer') return responder(await traer(user, b?.rapido === true, b?.seco === true))
    if (accion === 'puntuar') return responder(await puntuar(user))
    if (accion === 'avanzar') return responder(await avanzar(user, b?.seco === true))
    if (accion === 'agrupar') return responder(await agrupar(user, String(b?.ig_user_id || ''), Array.isArray(b?.lab) ? b.lab : [], b?.desde_cero === true, b?.ensayo === true))
    if (accion === 'lista') return responder(await lista(user))
    if (accion === 'uno') return responder(await uno(user, String(b?.ig_media_id || '')))
    if (accion === 'formato') return responder(await verFormato(user, String(b?.ig_media_id || ''), b?.ensayo === true))
    if (accion === 'corregirFormato') return responder(await corregirFormato(user, String(b?.ig_media_id || ''), String(b?.formato || '')))
    if (accion === 'formatoHoja') return responder(b?.ig_media_id
      ? await fijarFormato(user, String(b.ig_media_id), String(b?.imagen || ''), b?.ensayo === true, b?.voz !== false)
      : await formatoHoja(String(b?.imagen || ''), String(b?.motor || MOTOR_FORMATO), b?.voz !== false))
    // (28-oct) la huella del formato: de un reel (ig_media_id) o de los que faltan (max, hasta 8 por llamada)
    if (accion === 'huellas') return responder(await huellas(user, Number(b?.max) || 2, b?.ensayo === true, String(b?.ig_media_id || '')))
    if (accion === 'lab') return responder(await lab(user, String(b?.ig_user_id || ''), Array.isArray(b?.ideas) ? b.ideas : []))
    // (20-oct) el estilo de cada reel y sus gemelos; por ahora solo el servidor (la prueba con Cobra)
    if (accion === 'estilos') return quien === 'servidor' ? responder(await estilos(user, String(b?.ig_user_id || ''), b?.seco === true, b?.nuevos === true, Number(b?.max) || 400)) : responder({ error: 'solo el servidor' }, 403)
    return responder(await estado(user))
  } catch (e) {
    console.error('[historial]', e)
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

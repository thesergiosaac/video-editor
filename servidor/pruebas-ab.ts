/* pruebas-ab — las Pruebas A/B de ganchos (23-oct-2026)
 *
 * Sergio: «tener exactamente el mismo vídeo pero cambiarle el gancho… que Cherry te proponga [la] prueba… publicarlas como
 * reel de prueba… cuando la que le vaya mejor ya se publica en el perfil; si no se puede, que le avise para que el mismo
 * usuario desde su celular [la] publique». Sus decisiones: 2 o 3 versiones las escoge el usuario; todos los tipos de gancho
 * (hablado, de texto, visual, de sonido); herramienta propia «Pruebas A/B»; resultado a las 48 horas.
 * Plan: https://claude.ai/artifact/BSXEqB58LoWAGYkM2ssJBr. Esto es la PARTE 1: la pantalla y los ganchos de TEXTO.
 *
 * Cómo anda una prueba (tabla `pruebas_ab`, sql/26-pruebas-ab.sql):
 *   master      · el video todavía no está en calidad original: se pide a orchestrate y se espera
 *   fabricando  · la Lambda `cherry-pruebas-ab` pone el texto de cada versión encima de los primeros segundos (una llamada
 *                 por versión, en paralelo). Cada una deja clips/pruebas/<user>/<prueba>/<letra>.json en S3 (público)
 *   publicando  · cada versión es una fila de `publicaciones_programadas` como REEL DE PRUEBA (trial_params MANUAL): las
 *                 publica el reloj de ig-publicar, como cualquier otra
 *   en_prueba   · 48 horas. Se mide cada 6 h para que la página enseñe cómo va
 *   lista       · ganó una: la de MENOS OMISIÓN (`reels_skip_rate`: quién pasó de largo en los primeros segundos, que es
 *                 justo lo que mide un gancho). Si dos quedan a menos de 2 puntos, desempata el tiempo medio visto.
 *                 Con muy pocas vistas (< MIN_VISTAS en alguna) se espera 24 h más, una sola vez.
 *   fallida · cancelada · ensayo (prueba interna: se fabrica y NO se publica)
 *
 * ⚠️ Instagram NO deja pasar un reel de prueba al perfil por la API (ni dice si un reel es de prueba): por eso las versiones
 * van con MANUAL (con SS_PERFORMANCE podrían pasar dos solas y quedarían repetidas) y Cherry AVISA cuál ganó, con su enlace,
 * para que la persona la pase desde la app. Las demás se quedan como reels de prueba: solo las vio gente que no la sigue.
 *
 * Acciones: proponer · crear · lista · avisos · medir · visto · pasada · cancelar · reloj (sin sesión: con la llave del reloj de
 * ig-publicar, que el cron lee de la tarea de ig-publicar). Por ahora SOLO administradores (como se pidió: probarla primero).
 * ⏳ Créditos: no se cobra nada hasta que Sergio decida cuánto cuesta una prueba.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LLAVE_RELOJ = Deno.env.get('IG_RELOJ_SECRETO') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''

const GRAFO = 'https://graph.instagram.com/v23.0'
const CUBO = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/'
const LAMBDA = 'cherry-pruebas-ab'
const REGION = 'us-east-1'
const HORAS = 48, PRORROGA_H = 24, MEDIR_CADA_H = 6
const MIN_VISTAS = 200        // menos que esto en alguna versión: todavía no se puede decir nada
const EMPATE_PUNTOS = 2       // omisiones a menos de 2 puntos: desempata el tiempo visto
const LETRAS = ['A', 'B', 'C']
const VIVAS = ['master', 'fabricando', 'publicando', 'en_prueba']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-prueba-uid',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function tabla(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`,
      'Content-Type': 'application/json', ...(opciones.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const txt = await r.text()
  return txt ? JSON.parse(txt) : null
}

async function quienEs(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) throw new Error('Falta la sesión.')
  // pruebas del servidor con la llave interna: la cuenta va en la cabecera (nunca llega así desde la página)
  if ([SB_SERVICIO, Deno.env.get('SVC_JWT') || ''].filter(Boolean).includes(jwt)) {
    const p = req.headers.get('x-prueba-uid') || ''
    if (UUID.test(p)) return p
    throw new Error('Falta la cuenta de prueba.')
  }
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } })
  if (!r.ok) throw new Error('La sesión no vale.')
  const u = await r.json()
  if (!u?.id) throw new Error('La sesión no vale.')
  return u.id as string
}
const esAdmin = async (uid: string) => !!(await tabla(`administradores?user_id=eq.${uid}&select=user_id`))?.length

const anotar = (id: string, campos: Record<string, unknown>) =>
  tabla(`pruebas_ab?id=eq.${id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...campos, actualizada: new Date().toISOString() }),
  })

/* ── La Lambda, sin esperarla (misma firma SigV4 que color-silueta) ── */
async function lanzarLambda(payload: object) {
  const id = Deno.env.get('AWS_ACCESS_KEY_ID') || '', secreto = Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''
  if (!id || !secreto) throw new Error('El servidor no tiene las llaves de AWS.')
  const enc = new TextEncoder(), cuerpo = JSON.stringify(payload)
  const ahora = new Date()
  const dia = ahora.toISOString().slice(0, 10).replace(/-/g, '')
  const amz = ahora.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const host = `lambda.${REGION}.amazonaws.com`
  const ruta = `/2015-03-31/functions/${encodeURIComponent(LAMBDA)}/invocations`
  const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
  const firmar = async (k: ArrayBuffer, m: string) =>
    crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(m))
  const canon = `POST\n${ruta}\n\nhost:${host}\nx-amz-date:${amz}\nx-amz-invocation-type:Event\n\nhost;x-amz-date;x-amz-invocation-type\n` +
    hex(await crypto.subtle.digest('SHA-256', enc.encode(cuerpo)))
  const alcance = `${dia}/${REGION}/lambda/aws4_request`
  const aFirmar = `AWS4-HMAC-SHA256\n${amz}\n${alcance}\n${hex(await crypto.subtle.digest('SHA-256', enc.encode(canon)))}`
  let k = await firmar(enc.encode('AWS4' + secreto).buffer, dia)
  k = await firmar(k, REGION); k = await firmar(k, 'lambda'); k = await firmar(k, 'aws4_request')
  const r = await fetch(`https://${host}${ruta}`, {
    method: 'POST', body: cuerpo,
    headers: { 'Content-Type': 'application/json', 'X-Amz-Date': amz, 'X-Amz-Invocation-Type': 'Event',
      Authorization: `AWS4-HMAC-SHA256 Credential=${id}/${alcance}, SignedHeaders=host;x-amz-date;x-amz-invocation-type, Signature=${hex(await firmar(k, aFirmar))}` },
  })
  const txt = await r.text()
  if (r.status !== 202 && !r.ok) throw new Error(`la Lambda respondió ${r.status}: ${txt.slice(0, 200)}`)
}

/* ── IA: gpt-5-mini (esfuerzo bajo) con respaldo gpt-4o-mini, como «carruseles» ── */
async function ia(sistema: string, usuario: string): Promise<any> {
  for (const modelo of ['gpt-5-mini', 'gpt-4o-mini']) {
    const cuerpo: Record<string, unknown> = { model: modelo, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }] }
    if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = 'low'; cuerpo.max_completion_tokens = 8000 }
    else { cuerpo.temperature = 0.8; cuerpo.max_tokens = 1500 }
    const control = new AbortController(), reloj = setTimeout(() => control.abort(), 55000)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: control.signal,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      })
      if (!r.ok) { console.warn(`[pruebas-ab] ${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      const j = await r.json()
      const out = JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
      if (out && typeof out === 'object') return out
    } catch (e) { console.warn(`[pruebas-ab] ${modelo} falló:`, String(e)) }
    finally { clearTimeout(reloj) }
  }
  throw new Error('La IA no respondió. Intenta otra vez.')
}
const corto = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/* Los tipos de gancho de Cherry (los de herramientas.ts › GANCHO_DEF, docs/CRITERIO-SERGIO.md §4b), recortados al texto en
   pantalla. Si cambian allá, cambiarlos aquí. */
const TIPOS = `Historia = arranca dentro de algo que pasó (un lugar, una hora, alguien). · Contradicción = dice lo contrario de lo que la
gente cree. · Pregunta = le pregunta algo directamente a quien mira, sobre él mismo. · Dato = un número o un hecho concreto que
sorprende (SOLO si ese número lo dice el video). · Orden = le dice qué hacer o qué dejar de hacer. · Confesión = algo propio
que da vergüenza o que nadie admite. · Promesa = lo que va a ganar si se queda. · Error común = algo que casi todos hacen mal. ·
Misterio = anuncia algo concreto sin decir qué es.`

async function proponer(user: string, b: any) {
  const n = Number(b?.n) === 3 ? 3 : 2
  let dice = corto(b?.transcripcion, 6000)
  const rid = String(b?.render_id || '')
  if (!dice && UUID.test(rid)) {
    const r = (await tabla(`renders?id=eq.${rid}&select=project_id,subtitle_phrases,clean_words_json`))?.[0]
    const p = r && (await tabla(`projects?id=eq.${r.project_id}&select=user_id`))?.[0]
    if (r && p?.user_id === user) {
      const pal = (r.subtitle_phrases && r.subtitle_phrases.palabras) || r.clean_words_json || []
      dice = corto((Array.isArray(pal) ? pal : []).map((w: any) => w.word || w.text || '').join(' '), 6000)
    }
  }
  if (!dice && !b?.titulo) throw new Error('No sé de qué habla ese video: no tiene palabras guardadas.')
  const antes = (Array.isArray(b?.ya) ? b.ya : []).map((x: unknown) => corto(x, 90)).filter(Boolean).slice(0, 6)
  const sistema = `Escribes TEXTOS EN PANTALLA para el arranque de un reel de Instagram, en español de Colombia. Es lo primero que la gente
LEE mientras el video empieza (los primeros 3 segundos), en letras grandes encima del video. Va a hacerse una prueba A/B: el
mismo video con ${n} textos distintos, para ver con cuál menos gente pasa de largo.
Reglas (obligatorias):
- Cada texto, de 3 a 9 palabras (máximo 55 caracteres). Que se lea de un vistazo.
- Cada uno de un TIPO DE GANCHO distinto, para que la prueba enseñe qué tipo le funciona a esta cuenta. Tipos: ${TIPOS}
- Sale de lo que dice ESTE video: nada que el video no cumpla, nada inventado. Ningún número que el video no diga.
- Como lo diría una persona: con verbo, frase completa. PROHIBIDAS las frases de valla publicitaria: «No es X, es Y», «Sin X, sin Y»,
  tres palabras sueltas por ritmo, «¿El secreto? …», «Así de simple», «Punto.». Sin emojis, sin hashtags, sin comillas.
- No repitas palabra por palabra la primera frase que se dice: el texto la acompaña.
Responde SOLO JSON: {"ganchos":[{"texto":"…","tipo":"uno de los nueve","porque":"una frase corta y sencilla: qué prueba este texto"}]}`
  const usuario = `Lo que se dice en el video:\n${dice || '(sin palabras guardadas)'}\n\nTítulo del video: ${corto(b?.titulo, 120) || '(sin título)'}` +
    (b?.tono ? `\nTono de la marca: ${corto(b.tono, 300)}` : '') +
    (antes.length ? `\nYa se le propusieron estos (escribe OTROS distintos): ${antes.join(' · ')}` : '') +
    `\n\nEscribe ${n} textos.`
  const out = await ia(sistema, usuario)
  const ganchos = (Array.isArray(out?.ganchos) ? out.ganchos : []).map((g: any) => ({
    texto: corto(g?.texto, 80).replace(/^[«"“']+|[»"”']+$/g, ''), tipo: corto(g?.tipo, 30), porque: corto(g?.porque, 160),
  })).filter((g: any) => g.texto).slice(0, n)
  if (ganchos.length < n) throw new Error('Cherry no alcanzó a proponer todos los textos. Intenta otra vez.')
  return { ganchos }
}

/* ── El video del que salen las versiones ── */
const esMaster = (r: any) => !!r && (((r.subtitle_config || {}) as Record<string, unknown>).calidad === 'original' || !!r.output_original_url)
async function fuenteDe(user: string, projectId: string) {
  const p = (await tabla(`projects?id=eq.${projectId}&user_id=eq.${user}&borrado_en=is.null&select=id,title,original:borrador->cortes->original,borrador_en`))?.[0]
  if (!p) throw new Error('Ese video no es de esta cuenta.')
  const r = (await tabla(`renders?project_id=eq.${projectId}&status=eq.done&order=created_at.desc&limit=1&select=id,created_at,output_url,output_original_url,subtitle_config`))?.[0]
  // tal cual (js/arranque.js): UN clip con su archivo original, más nuevo que su último video hecho
  if (p.original === true && (!r || String(r.created_at) < String(p.borrador_en || ''))) {
    const cs = await tabla(`clips?project_id=eq.${projectId}&select=storage_path&limit=3`)
    const key = String(cs?.[0]?.storage_path || '')
    if (cs?.length === 1 && key.indexOf(`uploads/${user}/`) === 0) return { fuente: { key }, render: null, estado: 'fabricando' }
  }
  if (!r) throw new Error('Ese video todavía no está fabricado: fabrícalo en el editor y vuelve.')
  if (esMaster(r) && /^https:\/\//.test(String(r.output_url || ''))) return { fuente: { url: String(r.output_url) }, render: r.id, estado: 'fabricando' }
  // la calidad original se pide YA, aquí (aunque se cierre la página); el reloj la espera
  const res = await fetch(`${SB_URL}/functions/v1/orchestrate`, {
    method: 'POST',
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, user_id: user, reusar_render: r.id, calidad: 'original' }),
  })
  const d: any = await res.json().catch(() => null)
  if (!res.ok || !d?.render_id) throw new Error('No se pudo pedir la calidad original del video. Intenta otra vez.')
  return { fuente: null, render: d.render_id, estado: 'master' }
}

async function lanzar(f: any) {
  const vs = (f.versiones || []) as any[]
  for (const v of vs) {
    await lanzarLambda({ modo: 'version', prueba: f.id, user: f.user_id, letra: v.letra, fuente: f.fuente_obj,
      tarjeta: v.tarjeta || null, segundos: f.segundos || 3 })
    v.pedida = new Date().toISOString()
  }
  await anotar(f.id, { estado: 'fabricando', versiones: vs })
  f.estado = 'fabricando'
}

async function crear(user: string, b: any) {
  const pid = String(b?.project_id || '')
  if (!UUID.test(pid)) throw new Error('Escoge un video.')
  const igUser = String(b?.ig_user_id || '')
  const mia = await tabla(`cuentas_instagram?user_id=eq.${user}&ig_user_id=eq.${igUser}&estado=eq.activa&select=ig_user_id`)
  if (!mia?.length) throw new Error('Esa cuenta de Instagram no es tuya o no está conectada.')
  const PNG = `${SB_URL}/storage/v1/object/public/publicar/${user}/`
  const crudas = (Array.isArray(b?.versiones) ? b.versiones : []).slice(0, 3)
  if (crudas.length < 2) throw new Error('Una prueba necesita 2 o 3 versiones.')
  const vistos: Record<string, boolean> = {}
  const versiones = crudas.map((v: any, i: number) => {
    const gancho = corto(v?.gancho, 120), tarjeta = String(v?.tarjeta || '')
    if (gancho && (tarjeta.indexOf(PNG) !== 0 || !/\.png$/i.test(tarjeta) || tarjeta.length > 400)) throw new Error('Falta el dibujo del texto de la versión ' + LETRAS[i] + '.')
    const clave = gancho.toLowerCase()
    if (vistos[clave]) throw new Error('Dos versiones dicen lo mismo: cambia una.')
    vistos[clave] = true
    return { letra: LETRAS[i], gancho, tipo: corto(v?.tipo, 30) || null, tarjeta: gancho ? tarjeta : null }
  })
  const segundos = Math.max(2, Math.min(6, Number(b?.segundos) || 3))
  const cuando = b?.publicar_el && !isNaN(Date.parse(String(b.publicar_el))) ? new Date(String(b.publicar_el)).toISOString() : new Date().toISOString()
  const src = await fuenteDe(user, pid)
  const fila = (await tabla('pruebas_ab', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: user, marca: corto(b?.marca, 40) || null, ig_user_id: igUser, project_id: pid, render_id: src.render,
      fuente: src.fuente ? JSON.stringify(src.fuente) : null, titulo: corto(b?.titulo, 120) || null, tapa: corto(b?.tapa, 600) || null,
      tipo: 'texto', texto: String(b?.texto || '').slice(0, 2200), versiones, estado: src.estado, publicar_el: cuando,
      resultado: { segundos }, ensayo: !!b?.ensayo,
    }),
  }))?.[0]
  if (!fila) throw new Error('No se pudo guardar la prueba.')
  if (src.estado === 'fabricando') {
    try { await lanzar({ ...fila, fuente_obj: src.fuente, segundos }) }
    catch (e) { await anotar(fila.id, { estado: 'fallida', error: 'No se pudo empezar a fabricar las versiones.' }); throw e }
  }
  return { ok: true, prueba: (await tabla(`pruebas_ab?id=eq.${fila.id}`))?.[0] }
}

/* ── Los números de una versión en Instagram (los de ig-metricas › DE_REEL) ── */
const METRICAS = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'ig_reels_avg_watch_time', 'reels_skip_rate']
async function grafo(camino: string) {
  const r = await fetch(`${GRAFO}/${camino}`)
  const t = await r.text()
  if (!r.ok) throw new Error(t.slice(0, 300))
  return JSON.parse(t)
}
async function numerosDe(media: string, token: string) {
  const leer = (d: any) => Object.fromEntries((d?.data || []).map((x: any) => [x.name, x.values?.[0]?.value]))
  let n: Record<string, any> = {}
  try { n = leer(await grafo(`${media}/insights?metric=${METRICAS.join(',')}&access_token=${token}`)) }
  catch {
    for (const m of METRICAS) { try { Object.assign(n, leer(await grafo(`${media}/insights?metric=${m}&access_token=${token}`))) } catch { /* no aplica */ } }
  }
  const num = (x: any) => (x == null || isNaN(Number(x)) ? null : Number(x))
  return {
    vistas: num(n.views), alcance: num(n.reach), omision: num(n.reels_skip_rate),
    visto_medio: num(n.ig_reels_avg_watch_time) == null ? null : Math.round(Number(n.ig_reels_avg_watch_time) / 100) / 10,
    me_gusta: num(n.likes), comentarios: num(n.comments), guardados: num(n.saved), compartidos: num(n.shares),
  }
}
async function tokenDe(f: any) {
  const c = await tabla(`cuentas_instagram?user_id=eq.${f.user_id}&ig_user_id=eq.${f.ig_user_id}&estado=eq.activa&select=token`)
  if (!c?.[0]?.token) throw new Error('La cuenta de Instagram se desconectó.')
  return String(c[0].token)
}
async function medir(f: any) {
  const token = await tokenDe(f)
  const vs = (f.versiones || []) as any[]
  for (const v of vs) {
    if (!v.ig_media_id) continue
    try { v.numeros = await numerosDe(v.ig_media_id, token); v.medido = new Date().toISOString() }
    catch (e) { console.warn(`[pruebas-ab] ${f.id} ${v.letra}: no se pudo medir: ${String(e).slice(0, 200)}`) }
  }
  f.versiones = vs
  return vs
}

/* La ganadora: la de MENOS omisión; a menos de EMPATE_PUNTOS, la que se vio más tiempo */
function decidir(vs: any[]) {
  const con = vs.filter((v) => v.ig_media_id && v.numeros)
  const om = con.filter((v) => v.numeros.omision != null)
  if (om.length >= 2) {
    om.sort((a, b) => a.numeros.omision - b.numeros.omision)
    const [g, s] = om
    const dif = Math.round((s.numeros.omision - g.numeros.omision) * 10) / 10
    if (dif < EMPATE_PUNTOS && g.numeros.visto_medio != null && s.numeros.visto_medio != null && s.numeros.visto_medio > g.numeros.visto_medio) {
      return { ganadora: s.letra, por: 'visto_medio', diferencia: dif, empate: true }
    }
    return { ganadora: g.letra, por: 'omision', diferencia: dif, empate: dif < EMPATE_PUNTOS }
  }
  const vm = con.filter((v) => v.numeros.visto_medio != null).sort((a, b) => b.numeros.visto_medio - a.numeros.visto_medio)
  if (vm.length >= 2) return { ganadora: vm[0].letra, por: 'visto_medio', diferencia: null, empate: false }
  return null
}

const json = (u: string) => fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null)
const horas = (desde: string | null) => (desde ? (Date.now() - Date.parse(desde)) / 3600000 : 0)

async function avanzar(f: any) {
  const vs = (f.versiones || []) as any[]
  if (f.estado === 'master') {
    const m = (await tabla(`renders?id=eq.${f.render_id}&select=status,output_url,error_message,subtitle_config,output_original_url`))?.[0]
    if (m && m.status === 'done' && /^https:\/\//.test(String(m.output_url || '')) && esMaster(m)) {
      const fuente = { url: String(m.output_url) }
      await anotar(f.id, { fuente: JSON.stringify(fuente) })
      await lanzar({ ...f, fuente_obj: fuente, segundos: f.resultado?.segundos })
      return 'lanzada'
    }
    if (!m || m.status === 'error') { await anotar(f.id, { estado: 'fallida', error: 'No salió la calidad original del video: ' + corto(m?.error_message || 'el video no existe', 200) }); return 'fallida' }
    if (horas(f.creada) > 1) { await anotar(f.id, { estado: 'fallida', error: 'La calidad original del video tardó demasiado. Vuelve a intentarlo.' }); return 'fallida' }
    return 'esperando master'
  }

  if (f.estado === 'fabricando') {
    const base = `${CUBO}clips/pruebas/${f.user_id}/${f.id}/`
    for (const v of vs) {
      if (v.video) continue
      const d = await json(base + v.letra + '.json')
      if (d && d.ok && d.video) { v.video = String(d.video); v.tam = d.tam || null }
      else if (d && d.ok === false) {
        const hdr = /hdr/.test(String(d.error || ''))
        await anotar(f.id, { estado: 'fallida', versiones: vs, error: hdr
          ? 'Ese video viene en HDR (así graba el iPhone): por ahora la prueba solo sirve con videos fabricados en Cherry.'
          : 'No se pudo hacer la versión ' + v.letra + '. Vuelve a intentarlo.' })
        return 'fallida'
      }
    }
    if (vs.some((v) => !v.video)) {
      const desde = vs.map((v) => v.pedida).filter(Boolean).sort()[0] || f.actualizada
      if (horas(desde) > 0.5) { await anotar(f.id, { estado: 'fallida', versiones: vs, error: 'Las versiones tardaron demasiado. Vuelve a intentarlo.' }); return 'fallida' }
      await anotar(f.id, { versiones: vs })
      return 'fabricando'
    }
    if (f.ensayo) { await anotar(f.id, { estado: 'ensayo', versiones: vs }); return 'ensayo' }
    // cada versión, un reel de prueba en el reloj de ig-publicar (a la hora escogida, o ya)
    const cuando = new Date(Math.max(Date.now(), Date.parse(f.publicar_el || '') || 0)).toISOString()
    for (const v of vs) {
      if (v.publicacion) continue
      const p = (await tabla('publicaciones_programadas', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: f.user_id, ig_user_id: f.ig_user_id, video_url: v.video, texto: f.texto || '', tipo: 'REELS',
          publicar_el: cuando, master_estado: 'no', opciones: { prueba: 'MANUAL', ab: f.id, ab_letra: v.letra } }),
      }))?.[0]
      v.publicacion = p?.id || null
    }
    await anotar(f.id, { estado: 'publicando', versiones: vs })
    return 'publicando'
  }

  if (f.estado === 'publicando') {
    const ids = vs.map((v) => v.publicacion).filter(Boolean)
    const ps = ids.length ? await tabla(`publicaciones_programadas?id=in.(${ids.join(',')})&select=id,estado,ig_media_id,error`) : []
    const de: Record<string, any> = {}; (ps || []).forEach((p: any) => { de[p.id] = p })
    let token = ''
    for (const v of vs) {
      const p = de[v.publicacion]
      if (!p) { v.error = 'La publicación se borró.'; continue }
      if (p.estado === 'fallida') { v.error = corto(p.error || 'Instagram no la publicó.', 300); continue }
      if (p.ig_media_id && !v.ig_media_id) {
        v.ig_media_id = String(p.ig_media_id); v.publicada = new Date().toISOString()
        try { token = token || await tokenDe(f); v.enlace = (await grafo(`${v.ig_media_id}?fields=permalink&access_token=${token}`))?.permalink || null }
        catch { /* el enlace se puede pedir después */ }
      }
    }
    const pendientes = vs.filter((v) => !v.ig_media_id && !v.error)
    if (pendientes.length) { await anotar(f.id, { versiones: vs }); return 'publicando' }
    const salieron = vs.filter((v) => v.ig_media_id)
    if (salieron.length < 2) {
      await anotar(f.id, { estado: 'fallida', versiones: vs, error: 'Instagram no publicó las versiones: ' + (vs.find((v) => v.error)?.error || 'sin explicación') })
      return 'fallida'
    }
    const empezo = new Date().toISOString()
    await anotar(f.id, { estado: 'en_prueba', versiones: vs, empezo, termina: new Date(Date.now() + HORAS * 3600000).toISOString() })
    return 'en_prueba'
  }

  if (f.estado === 'en_prueba') {
    const fin = Date.now() >= Date.parse(f.termina || '')
    const ultimo = vs.map((v) => v.medido).filter(Boolean).sort().pop() || null
    if (!fin && ultimo && horas(ultimo) < MEDIR_CADA_H) return 'en prueba'
    await medir(f)
    if (!fin) { await anotar(f.id, { versiones: vs }); return 'medida' }
    const salieron = vs.filter((v) => v.ig_media_id)
    const pocas = salieron.some((v) => (v.numeros?.vistas ?? 0) < MIN_VISTAS)
    if (pocas && !f.prorroga) {
      await anotar(f.id, { versiones: vs, prorroga: true, termina: new Date(Date.now() + PRORROGA_H * 3600000).toISOString() })
      return 'prorroga'
    }
    const d = decidir(vs)
    await anotar(f.id, { estado: 'lista', versiones: vs, ganadora: d?.ganadora || null,
      resultado: { ...(f.resultado || {}), ...(d || { sin_datos: true }), pocas_vistas: pocas, decidida: new Date().toISOString() } })
    // Instagram ya tiene su copia: los videos de las versiones no se guardan más
    try { await lanzarLambda({ modo: 'borrar', prueba: f.id, user: f.user_id }) } catch (e) { console.warn('[pruebas-ab] borrar:', String(e)) }
    return 'lista'
  }
  return f.estado
}

async function reloj() {
  const fs = await tabla(`pruebas_ab?estado=in.(${VIVAS.join(',')})&order=creada.asc&limit=40`)
  const hechas: Record<string, string> = {}
  for (const f of fs || []) {
    if (f.fuente) { try { f.fuente_obj = JSON.parse(f.fuente) } catch { /* vieja */ } }
    try { hechas[f.id] = await avanzar(f) }
    catch (e) { hechas[f.id] = 'error: ' + String(e).slice(0, 160); console.error('[pruebas-ab] reloj', f.id, String(e)) }
  }
  return { ok: true, pruebas: hechas }
}

const PUBLICO = 'id,marca,ig_user_id,project_id,titulo,tapa,tipo,texto,versiones,estado,publicar_el,empezo,termina,prorroga,ganadora,resultado,visto,pasada,ensayo,error,creada'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const accion = String(b?.accion || '')

    if (accion === 'reloj') {
      if (!LLAVE_RELOJ || String(b?.llave || '') !== LLAVE_RELOJ) return responder({ error: 'No' }, 403)
      return responder(await reloj())
    }

    const user = await quienEs(req)
    if (!(await esAdmin(user))) return responder({ error: 'Las Pruebas A/B todavía no están abiertas.' }, 403)

    if (accion === 'proponer') return responder(await proponer(user, b))
    if (accion === 'crear') return responder(await crear(user, b))
    if (accion === 'lista') {
      const marca = corto(b?.marca, 40)
      const fs = await tabla(`pruebas_ab?user_id=eq.${user}${marca ? `&or=(marca.eq.${encodeURIComponent(marca)},marca.is.null)` : ''}&order=creada.desc&limit=40&select=${PUBLICO}`)
      return responder({ pruebas: fs || [] })
    }
    // las que terminaron y la persona todavía no ha visto (el aviso del inicio y el punto en la barra, js/cuenta.js)
    if (accion === 'avisos') {
      const fs = await tabla(`pruebas_ab?user_id=eq.${user}&estado=eq.lista&visto=eq.false&order=creada.desc&limit=5&select=id,titulo,ganadora`)
      return responder({ pruebas: fs || [] })
    }

    const id = String(b?.id || '')
    if (!UUID.test(id)) throw new Error('Esa prueba no existe.')
    const f = (await tabla(`pruebas_ab?id=eq.${id}&user_id=eq.${user}`))?.[0]
    if (!f) throw new Error('Esa prueba no existe.')

    if (accion === 'medir') {
      // a pedido de la página, como mucho cada 30 minutos (Instagram tiene topes por hora)
      const ultimo = ((f.versiones || []) as any[]).map((v) => v.medido).filter(Boolean).sort().pop() || null
      if ((f.estado === 'en_prueba' || f.estado === 'lista') && (!ultimo || horas(ultimo) > 0.5)) {
        await medir(f)
        await anotar(f.id, { versiones: f.versiones })
      }
      return responder({ prueba: (await tabla(`pruebas_ab?id=eq.${id}&select=${PUBLICO}`))?.[0] })
    }
    if (accion === 'visto') { await anotar(id, { visto: true }); return responder({ ok: true }) }
    if (accion === 'pasada') { await anotar(id, { pasada: b?.valor !== false, visto: true }); return responder({ ok: true }) }
    if (accion === 'cancelar') {
      if (!['master', 'fabricando', 'publicando', 'ensayo', 'fallida'].includes(f.estado)) throw new Error('Esa prueba ya está publicada: se deja terminar.')
      const ids = ((f.versiones || []) as any[]).map((v) => v.publicacion).filter(Boolean)
      // solo lo que todavía no ha salido; lo que ya salió se queda como reel de prueba
      if (ids.length) await tabla(`publicaciones_programadas?id=in.(${ids.join(',')})&user_id=eq.${user}&estado=eq.programada`, { method: 'DELETE' })
      await anotar(id, { estado: 'cancelada' })
      try { await lanzarLambda({ modo: 'borrar', prueba: id, user }) } catch (e) { console.warn('[pruebas-ab] borrar:', String(e)) }
      return responder({ ok: true })
    }
    throw new Error('No sé qué hacer con «' + accion + '».')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[pruebas-ab]', msg)
    return responder({ error: msg }, /sesión/i.test(msg) ? 401 : 500)
  }
})

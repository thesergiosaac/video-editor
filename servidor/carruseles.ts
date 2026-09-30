// carruseles v1 (30-sep-2026) — el servidor de los carruseles con composición (estilos aprobados por Sergio).
// Función PROPIA (no toca «herramientas», que la comparten otras pantallas). Con sesión de usuario. Acciones:
//   · foto_analizar {ruta}                         → la Lambda carrete-carruseles mira la foto (persona, cara, rejilla,
//                                                     recorte); sube el recorte al cubo y guarda la fila en carrusel_fotos.
//   · fotos {ids[]}                                 → las filas de carrusel_fotos del usuario (para volver a abrir un carrusel)
//   · ideas {nicho, negocio?, voz?, catalogo[]}     → 3 carruseles propuestos: {ideas:[{titulo, gancho, familia, n, objetivo, lleva, falta}]}
//   · dirigir {modo, texto?, plan?, n?, objetivo, palabra?, familia, esquema, voz?, negocio?, material?}
//                                                   → el contenido de ESE estilo, campo por campo, como pide su esquema
//   · desde_video {palabras[{w,s,e}], duracion, extraer, familia, esquema, voz?}
//                                                   → {ideas:[{t_ini, t_fin, titulo, frase}], contenido} (la frase de cada
//                                                     lámina sale de lo que la persona DIJO: se resume, no se inventa)
//   · reescribir {texto, pedido, voz?}              → {texto}
//   · (multipart con «audio») → {texto, dur, palabras[{w,s,e}]}: lo que se dice en un video subido, palabra por palabra
// gpt-5-mini (esfuerzo bajo) con respaldo gpt-4o-mini, igual que «herramientas».

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const REGION = Deno.env.get('AWS_REGION') || 'us-east-1'
const LAMBDA = 'carrete-carruseles'
const CUBO = 'carruseles'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-prueba-uid', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

async function usuario(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  // pruebas del servidor con la llave interna: el usuario va en la cabecera (nunca llega así desde la página)
  if ([SB_SERVICIO, Deno.env.get('SVC_JWT') || ''].filter(Boolean).includes(token)) { const p = req.headers.get('x-prueba-uid') || ''; return /^[0-9a-f-]{36}$/.test(p) ? p : null }
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' ? u.id : null
  } catch (_) { return null }
}
const servicio = { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` }

/* ── Lambda con respuesta (misma firma SigV4 que invoke-lambda, pero esperando) ── */
async function invocar(functionName: string, payload: object): Promise<any> {
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
  const canonHeaders = `host:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-date'
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
  const r = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Host': host, 'X-Amz-Date': amzDate,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}` },
    body: bodyStr,
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`la Lambda respondió ${r.status}: ${txt.slice(0, 160)}`)
  return JSON.parse(txt)
}

/* ── IA ── */
const ESTILO = `Escribes en español de Colombia, cercano y claro, para carruseles de Instagram de creadores y emprendedores.
Reglas de estilo (obligatorias):
- Frases cortas que se entiendan al leerlas una vez. Nada de palabras rebuscadas ni de jerga de marketing.
- PROHIBIDAS las fórmulas de valla publicitaria: «No es X, es Y», «Sin X, sin Y», tríos por ritmo («rápido, fácil y barato»), «¿El secreto? …», «Así de simple», «Spoiler:», «Punto.». Si suena a anuncio, cámbialo.
- Concreto: ejemplos y situaciones reales antes que ideas abstractas. NUNCA inventes números, cifras ni datos que parezcan reales.
- Sin emojis, sin hashtags dentro de las láminas, sin logos ni @usuario.`

function voz(v: any): string {
  if (!v || typeof v !== 'object') return ''
  const t = v.tono || {}
  const nivel = (x: any, a: string, b: string) => { const n = Number(x); return !Number.isFinite(n) ? '' : n <= 25 ? a : n >= 75 ? b : `entre ${a} y ${b}` }
  const partes = [nivel(t.formal, 'cercano (tutea)', 'formal (usa usted)'), nivel(t.serio, 'divertido', 'serio'), nivel(t.experto, 'sencillo', 'experto'), nivel(t.energia, 'calmado', 'enérgico')].filter(Boolean)
  const frases = Array.isArray(v.frases) ? v.frases.filter((f: any) => f && f.texto).slice(0, 8).map((f: any) => `${f.tipo || 'frase'}: «${String(f.texto).slice(0, 140)}»`) : []
  return (partes.length ? `Tono de la marca: ${partes.join(', ')}.` : '') + (frases.length ? `\nFrases de la marca (úsalas tal cual si encajan, sin forzarlas):\n${frases.join('\n')}` : '')
}
function negocio(n: any): string {
  if (!n || typeof n !== 'object') return ''
  const p = [n.que && `Qué hace: ${t(n.que, 200)}`, n.producto && `Qué vende: ${t(n.producto, 200)}`, n.lugar && `Dónde: ${t(n.lugar, 80)}`, n.palabras && `Palabras suyas: ${t(n.palabras, 200)}`].filter(Boolean)
  return p.length ? `Sobre la marca:\n${p.join('\n')}` : ''
}

async function ia(sistema: string, usuarioTxt: string, esfuerzo = 'low'): Promise<any> {
  for (const modelo of ['gpt-5-mini', 'gpt-4o-mini']) {
    const cuerpo: Record<string, unknown> = { model: modelo, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuarioTxt }] }
    if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = esfuerzo; cuerpo.max_completion_tokens = 14000 }
    else { cuerpo.temperature = 0.7; cuerpo.max_tokens = 4000 }
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), 55000)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: control.signal,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      })
      if (!r.ok) { console.warn(`[carruseles] ${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      const j = await r.json()
      const out = JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
      if (out && typeof out === 'object') return out
    } catch (e) { console.warn(`[carruseles] ${modelo} falló:`, String(e)) }
    finally { clearTimeout(reloj) }
  }
  throw new Error('La IA no respondió. Intenta otra vez.')
}
const t = (s: any, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

const OBJETIVOS: Record<string, string> = {
  auto: 'decide tú el objetivo según el tema',
  tutorial: 'ENSEÑAR: pasos o ejemplos concretos que se puedan aplicar; el cierre invita a guardarlo',
  motivacion: 'MOTIVAR: frases que inspiran y una idea que se queda; el cierre invita a mandárselo a alguien',
  opinion: 'OPINIÓN: una postura clara que invita a comentar; el cierre es una pregunta',
  venta: 'VENDER: el problema, cómo se ve resuelto y la llamada a la acción; el cierre invita a comentar la PALABRA',
  llevar: 'LLEVAR A ALGO: el cierre lleva a comentar la PALABRA para recibir por privado lo que el carrusel promete',
  tendencia: 'TENDENCIAS: formatos o ideas del momento, cada uno con cómo grabarlo',
}

/* El esquema lo manda la página (sale de familias.js): qué campos tiene cada lámina y cuántas letras caben. Así el
   mismo director sirve para todos los estilos y la página nunca recibe un texto que no le cabe. */
function describirEsquema(e: any): string {
  const uno = (v: any) => `"${v.desc}${v.max ? ` (máx. ${v.max} letras)` : ''}"`
  const campos = (c: any) => Object.entries(c || {}).map(([k, v]: any) => `    "${k}": ${v.lista
    ? `[ ${v.lista} elementos (${v.desc}), cada uno ${v.campos ? `{ ${Object.entries(v.campos).map(([kk, vv]: any) => `"${kk}": ${uno(vv)}`).join(', ')} }` : uno(v)} ]`
    : uno(v)}`).join(',\n')
  return `{\n  "nombre": "nombre corto para guardar el carrusel (máx. 60 letras)",\n  "portada": {\n${campos(e.portada)}\n  },\n  "items": [ {\n${campos(e.item)}\n  } ],\n  "cierre": {\n${campos(e.cierre)}\n  },\n  "comun": {\n${campos(e.comun)}\n  },\n  "caption": "texto para debajo de la publicación (2 a 4 frases, sin hashtags)",\n  "tags": ["8 a 12 hashtags en minúscula, sin #"]\n}`
}
// cada campo recortado a su tope (y las listas a su número): lo que no cabe no llega a la página
function limpiar(obj: any, campos: any): any {
  const out: any = {}
  for (const [k, v] of Object.entries(campos || {}) as any) {
    const x = obj?.[k]
    if (v.lista) {
      const arr = Array.isArray(x) ? x : []
      // si la IA manda solo el texto (sin el objeto), se vuelve objeto con su primer campo
      out[k] = arr.slice(0, v.lista).map((y: any) => v.campos ? limpiar(typeof y === 'string' ? { [Object.keys(v.campos)[0]]: y } : y, v.campos) : t(y, v.max || 60))
    } else out[k] = t(x, v.max || 200)
  }
  return out
}

async function dirigir(b: any) {
  const e = b.esquema || {}
  const n = Math.max(2, Math.min(10, Math.round(Number(b.n) || Number(e.nItems) || 5)))
  const obj = OBJETIVOS[b.objetivo] ? b.objetivo : 'auto'
  const palabra = t(b.palabra, 20).toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, '')
  const plan = (Array.isArray(b.plan) ? b.plan : []).slice(0, n + 2).map((p: any) => t(p, 220))
  const planTxt = plan.some(Boolean) ? '\nLámina por lámina (OBLIGATORIO; lo que va entre comillas «» va TAL CUAL; lo vacío lo decides tú):\n' +
    plan.map((p: string, i: number) => `- ${i === 0 ? 'Portada' : i === plan.length - 1 ? 'Cierre' : 'Lámina ' + (i + 1)}: ${p || '(tú decides)'}`).join('\n') : ''
  const sis = `${ESTILO}
Eres el director de un carrusel con un estilo YA escogido: «${t(e.nombre, 40)}». ${t(e.guia, 600)}
Devuelves SOLO JSON con esta forma exacta (items: exactamente ${n}):
${describirEsquema(e)}
- Objetivo del carrusel: ${OBJETIVOS[obj]}.${palabra ? ` La PALABRA es «${palabra}».` : ''}
- Donde un campo diga *resaltado*, pon UNA o dos palabras entre asteriscos (*así*): salen con el color de acento.
- Los íconos solo pueden ser de esta lista: ${(e.iconos || []).join(', ')}.
- Cada lámina dice UNA idea; nada se repite entre láminas.`
  const base = b.modo === 'nicho' ? `Tema: propón tú uno bueno para este nicho: ${t(b.nicho, 200)}` : `Lo que pidió el creador: ${t(b.texto, 3000)}`
  const o = await ia(sis, `${base}${planTxt}\n${negocio(b.negocio)}\n${voz(b.voz)}`)
  return {
    nombre: t(o.nombre, 70),
    portada: limpiar(o.portada, e.portada), items: (Array.isArray(o.items) ? o.items : []).slice(0, n).map((x: any) => limpiar(x, e.item)),
    cierre: limpiar(o.cierre, e.cierre), comun: limpiar(o.comun, e.comun),
    caption: t(o.caption, 900), tags: (Array.isArray(o.tags) ? o.tags : []).map((x: any) => t(x, 40).replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 14),
  }
}

async function ideas(b: any) {
  const cat = (Array.isArray(b.catalogo) ? b.catalogo : []).slice(0, 30).map((f: any) => `${t(f.id, 20)}: ${t(f.nombre, 40)} — ideal para ${t(f.ideal, 80)}`).join('\n')
  const sis = `${ESTILO}
Propones 3 carruseles distintos para la cuenta de un creador. Devuelves SOLO JSON {"ideas":[{"titulo":"...","gancho":"...","familia":"id","n":7,"objetivo":"tutorial|motivacion|opinion|venta|llevar|tendencia","lleva":"qué material usaría, en una frase","falta":"lo que tendría que grabar o subir, o \\"\\""}]}.
- titulo: el gancho de la portada (máx. 60 letras). gancho: una línea de qué cuenta (máx. 110).
- familia: el id del estilo que mejor le va, de esta lista:\n${cat}
- n: cuántas láminas del medio (3 a 8). Las 3 ideas con objetivos distintos.`
  const o = await ia(sis, `Nicho: ${t(b.nicho, 300)}\n${negocio(b.negocio)}\n${voz(b.voz)}`)
  return { ideas: (Array.isArray(o.ideas) ? o.ideas : []).slice(0, 3).map((x: any) => ({ titulo: t(x.titulo, 70), gancho: t(x.gancho, 130), familia: t(x.familia, 20), n: Math.max(3, Math.min(8, Number(x.n) || 5)), objetivo: t(x.objetivo, 12), lleva: t(x.lleva, 120), falta: t(x.falta, 120) })) }
}

async function desdeVideo(b: any) {
  const pal = (Array.isArray(b.palabras) ? b.palabras : []).slice(0, 6000)
  if (!pal.length) throw new Error('Ese video no tiene lo que se dice (transcripción).')
  // el texto con marcas de tiempo cada ~5 s, para que la IA diga DÓNDE está cada idea
  let txt = '', marca = -99
  for (const w of pal) { const s = Number(w.s) || 0; if (s - marca >= 5) { txt += ` [${s.toFixed(1)}]`; marca = s } txt += ' ' + t(w.w, 40) }
  const extraer = ({ ideas: 'sus ideas, en el mismo orden en que las dice', pasos: 'el paso a paso de lo que explica o muestra', frases: 'las frases más fuertes que dice', auto: 'lo que mejor funcione para un carrusel' } as any)[b.extraer] || 'sus ideas en orden'
  const e = b.esquema || {}
  const sis = `${ESTILO}
Conviertes un video en un carrusel del estilo «${t(e.nombre, 40)}». ${t(e.guia, 500)}
Saca ${extraer}. Devuelves SOLO JSON {"tema":"...","ideas":[{"t_ini":12.3,"t_fin":15.8,"titulo":"...","frase":"lo que dijo, casi textual"}],"contenido": ${describirEsquema(e)}}
- ideas: entre 3 y 8, con el segundo donde empieza y termina cada una (usa las marcas [segundos] del texto).
- frase: lo que la persona DIJO en ese tramo, resumido sin cambiarle el sentido. NO inventes nada que no esté en el video, y menos números.
- contenido.items: uno por idea, en el mismo orden. Donde un campo diga *resaltado*, pon una o dos palabras entre asteriscos.
- Los íconos solo pueden ser de esta lista: ${(e.iconos || []).join(', ')}.
- La transcripción automática a veces inventa una palabra que no se oye bien: si una palabra no tiene sentido en la frase, no la uses.`
  const o = await ia(sis, `Duración del video: ${Math.round(Number(b.duracion) || 0)} s.\nLo que dice:${t(txt, 16000)}\n${voz(b.voz)}`)
  const c = o.contenido || {}
  const dur = Number(b.duracion) || 1e9
  return {
    tema: t(o.tema, 120),
    ideas: (Array.isArray(o.ideas) ? o.ideas : []).slice(0, 8).map((x: any) => ({ t_ini: Math.max(0, Math.min(dur, Number(x.t_ini) || 0)), t_fin: Math.max(0, Math.min(dur, Number(x.t_fin) || 0)), titulo: t(x.titulo, 70), frase: t(x.frase, 200) })),
    contenido: { nombre: t(c.nombre, 70), portada: limpiar(c.portada, e.portada), items: (Array.isArray(c.items) ? c.items : []).slice(0, 8).map((x: any) => limpiar(x, e.item)), cierre: limpiar(c.cierre, e.cierre), comun: limpiar(c.comun, e.comun), caption: t(c.caption, 900), tags: (Array.isArray(c.tags) ? c.tags : []).map((x: any) => t(x, 40).replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 14) },
  }
}

async function reescribir(b: any) {
  const pedidos: Record<string, string> = { corto: 'más corto (la mitad o menos), sin perder la idea', directo: 'más directo, sin rodeos', gancho: 'con otro gancho que dé más ganas de seguir leyendo', como_yo: 'como lo diría el creador, con su tono' }
  const o = await ia(`${ESTILO}\nReescribes UN texto de una lámina de carrusel. Devuelves SOLO JSON {"texto":"..."}. Si el original tiene palabras entre *asteriscos*, deja asteriscos en la palabra más importante.`,
    `Texto: ${t(b.texto, 600)}\nCómo: ${pedidos[b.pedido] || pedidos.corto}\n${voz(b.voz)}`)
  return { texto: t(o.texto, 600) }
}

/* ── Fotos ── */
async function fotoAnalizar(uid: string, b: any) {
  const ruta = String(b.ruta || '')
  if (!ruta.startsWith(uid + '/') || ruta.includes('..') || !/\.(jpe?g|png|webp)$/i.test(ruta)) throw new Error('Esa foto no es tuya.')
  const ya = await fetch(`${SB_URL}/rest/v1/carrusel_fotos?user_id=eq.${uid}&ruta=eq.${encodeURIComponent(ruta)}&select=*`, { headers: servicio })
  const filas = ya.ok ? await ya.json() : []
  if (filas.length && filas[0].rejilla) return { foto: filas[0] }
  const f = await fetch(`${SB_URL}/storage/v1/object/sign/${CUBO}/${ruta}`, { method: 'POST', headers: { ...servicio, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }) })
  if (!f.ok) throw new Error('No encontré la foto.')
  const firmada = (await f.json()).signedURL
  const r = await invocar(LAMBDA, { accion: 'analizar', url: `${SB_URL}/storage/v1${firmada}` })
  if (!r?.ok) throw new Error(r?.error || 'No pude mirar la foto.')
  let recorte_ruta = null, recorte_caja = null
  if (r.recorte?.png) {
    recorte_ruta = ruta.replace(/\.[a-z]+$/i, '') + '-r.png'
    const png = Uint8Array.from(atob(r.recorte.png), (c) => c.charCodeAt(0))
    const s = await fetch(`${SB_URL}/storage/v1/object/${CUBO}/${recorte_ruta}`, { method: 'POST', headers: { ...servicio, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: png })
    if (!s.ok) throw new Error('No pude guardar el recorte.')
    recorte_caja = [r.recorte.x, r.recorte.y, r.recorte.w, r.recorte.h]
  }
  const fila = { user_id: uid, marca: t(b.marca, 60) || 'principal', origen: ['subida', 'fotograma', 'ia', 'biblioteca'].includes(b.origen) ? b.origen : 'subida', ruta,
    w: r.w, h: r.h, persona: r.persona, cara: r.cara, rejilla: r.rejilla, recorte_ruta, recorte_caja }
  const g = await fetch(`${SB_URL}/rest/v1/carrusel_fotos?on_conflict=user_id,ruta`, { method: 'POST', headers: { ...servicio, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(fila) })
  if (!g.ok) throw new Error('No pude guardar lo que vi en la foto.')
  return { foto: (await g.json())[0] }
}
async function fotos(uid: string, b: any) {
  const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x: any) => /^[0-9a-f-]{36}$/.test(String(x))).slice(0, 60)
  if (!ids.length) return { fotos: [] }
  const r = await fetch(`${SB_URL}/rest/v1/carrusel_fotos?user_id=eq.${uid}&id=in.(${ids.join(',')})&select=*`, { headers: servicio })
  return { fotos: r.ok ? await r.json() : [] }
}

/* Lo que se dice en un video SUBIDO, con el segundo de cada palabra (para saber dónde está cada idea). La página
   manda solo el audio (WAV mono de 16 kHz, lo saca con Web Audio): un minuto son ~2 MB. */
async function transcribir(form: FormData) {
  const audio = form.get('audio')
  if (!(audio instanceof File) || !audio.size) throw new Error('No llegó el audio del video.')
  if (audio.size > 25 * 1024 * 1024) throw new Error('El video es muy largo para escucharlo de una vez (máx. unos 13 minutos).')
  const f = new FormData()
  f.append('file', audio, 'audio.wav'); f.append('model', 'whisper-1'); f.append('language', 'es')
  f.append('response_format', 'verbose_json'); f.append('timestamp_granularities[]', 'word')
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: f })
  if (!r.ok) throw new Error('No pude escuchar el video (' + r.status + ').')
  const j = await r.json()
  return { texto: t(j.text, 20000), dur: Number(j.duration) || 0, palabras: (Array.isArray(j.words) ? j.words : []).map((w: any) => ({ w: t(w.word, 40), s: Number(w.start) || 0, e: Number(w.end) || 0 })) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Entra otra vez: se cerró tu sesión.' }, 401)
    if ((req.headers.get('content-type') || '').includes('multipart/form-data')) return responder(await transcribir(await req.formData()))
    const b = await req.json().catch(() => ({}))
    const acc = String(b.accion || '')
    const r = acc === 'foto_analizar' ? await fotoAnalizar(uid, b)
      : acc === 'fotos' ? await fotos(uid, b)
      : acc === 'ideas' ? await ideas(b)
      : acc === 'dirigir' ? await dirigir(b)
      : acc === 'desde_video' ? await desdeVideo(b)
      : acc === 'reescribir' ? await reescribir(b)
      : null
    if (!r) return responder({ error: 'Acción desconocida' }, 400)
    return responder(r)
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

// camara-viva — (29-oct-2026) lo que la página pide de la CÁMARA VIVA para un video base (renders.graficos):
//   { accion: 'plan', render_id }          → el plan del director: { plan, caras? } o { pendiente: true } (orchestrate lo pidió al
//                                            preparar la base; aquí se recoge. Si no hay o falló, se pide de nuevo)
//   { accion: 'caras', render_id, caras }  → guarda dónde está la cara (js/caras.js: [[t, x, y, ancho, alto], …] cada 0,25 s)
//   { accion: 'imagen', render_id, momento, estilo, descripcion?, referencias? } → crea UNA imagen con Nano Banana sobre verde
//       (1 crédito; si falla, se devuelve) y la devuelve en base64: la página la recorta y la sube
//   { accion: 'subir_imagen', render_id, tipo } → dónde subir un archivo (uploads/<proyecto>/imagenes/, privada: se lee con enlace firmado)
//   { accion: 'guardar_imagen', render_id, momento, key, estilo, origen, desc? } · { accion: 'quitar_imagen', render_id, momento }
//   { accion: 'editar_momento', render_id, momento, cambios } → corrige un momento del plan (texto, título, cámara o quitarlo);
//       la primera vez guarda en m.orig lo que armó el director: de ahí salen los turnos de cámara (editar uno no mueve los demás)
//   Una base que sale de un recorte (subtitle_config.mano) HEREDA el plan de la anterior: ver «heredarPlan».
//   { accion: 'heredar', render_id, ver? } → lo mismo a mano, para un plan que nadie ha tocado (ver: solo cuenta, no escribe)
// Todo vive en renders.graficos = { v, estilo: 'camara_viva', rev, pendiente | plan, avisos?, uso?, caras?, imagenes? };
// imagenes = { "<n.º de momento>": { key, estilo, origen: 'cherry' | 'tuya', desc?, en } }; la página recibe además su «url» firmada.
// «rev» sube con cada escritura y solo se escribe si nadie escribió en el medio (la página y el director no se pisan).
// Exige sesión y que el video sea de un proyecto de la persona. El director se llama con la llave de servicio.

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const SESION_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SESION_ANON = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ'
const SESION_SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOTOR_GRAFICOS = 4                 // el de orchestrate: un número menor haría que se volvieran a marcar los de vidrio
const ESPERA_MAX_MS = 10 * 60 * 1000     // un plan pendiente hace más de 10 min se da por perdido y se pide otra vez

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODELO_IMAGEN = 'gemini-nano-banana-2.1'   // medido el 29-oct: US$0,058 por imagen, figura limpia sobre verde
const FICHA_URL = 'https://cherrysweet.app/estilos/camara-viva/ficha.json'
const AWS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
const AWS_SECRET = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
const AWS_REGION = Deno.env.get('AWS_REGION') ?? 'us-east-1'
const BUCKET = Deno.env.get('REMOTION_BUCKET_NAME') ?? 'remotionlambda-useast1-editorvideo'

const hSrv = (extra: Record<string, string> = {}) => ({ apikey: SESION_SRV, Authorization: `Bearer ${SESION_SRV}`, 'Content-Type': 'application/json', ...extra })

async function usuarioDeSesion(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  try {
    const r = await fetch(`${SESION_URL}/auth/v1/user`, { headers: { apikey: SESION_ANON, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' && ES_UUID.test(u.id) ? u.id : null
  } catch (_) { return null }
}

// La fila del video si es de un proyecto de la persona; null si no existe o es de otro.
async function renderDelUsuario(renderId: unknown, userId: string): Promise<any | null> {
  if (typeof renderId !== 'string' || !ES_UUID.test(renderId)) return null
  const r = await fetch(`${SESION_URL}/rest/v1/renders?id=eq.${renderId}&select=id,project_id,created_at,graficos,palabras:subtitle_phrases->palabras,mano:subtitle_config->mano&limit=1`, { headers: hSrv() })
  const filas = r.ok ? await r.json() : []
  const fila = Array.isArray(filas) ? filas[0] : null
  if (!fila || !ES_UUID.test(String(fila.project_id))) return null
  const p = await fetch(`${SESION_URL}/rest/v1/projects?id=eq.${fila.project_id}&user_id=eq.${userId}&select=id&limit=1`, { headers: hSrv() })
  const ps = p.ok ? await p.json() : []
  return Array.isArray(ps) && ps.length ? fila : null
}

// Cambia renders.graficos sin pisar lo que otro escribió en el medio (por «rev»). Devuelve lo que quedó guardado.
async function guardar(renderId: string, cambio: (g: any) => any): Promise<any> {
  for (let intento = 0; intento < 5; intento++) {
    const r = await fetch(`${SESION_URL}/rest/v1/renders?id=eq.${renderId}&select=graficos&limit=1`, { headers: hSrv() })
    const filas = r.ok ? await r.json() : []
    const g = Array.isArray(filas) && filas[0] && filas[0].graficos && typeof filas[0].graficos === 'object' ? filas[0].graficos : null
    const rev = g && Number.isFinite(Number(g.rev)) ? Number(g.rev) : 0
    const nuevo = { ...cambio(g && g.estilo === 'camara_viva' ? g : { v: MOTOR_GRAFICOS, estilo: 'camara_viva' }), rev: rev + 1 }
    const filtro = !g ? '&graficos=is.null' : rev ? `&graficos->>rev=eq.${rev}` : '&graficos->>rev=is.null'
    const w = await fetch(`${SESION_URL}/rest/v1/renders?id=eq.${renderId}${filtro}`, {
      method: 'PATCH', headers: hSrv({ Prefer: 'return=representation' }), body: JSON.stringify({ graficos: nuevo }),
    })
    const hechas = w.ok ? await w.json() : []
    if (Array.isArray(hechas) && hechas.length) return nuevo
    await new Promise((ok) => setTimeout(ok, 150 + Math.random() * 250))
  }
  throw new Error('no se pudo guardar (lo estaban cambiando a la vez)')
}

const palabrasDe = (fila: any) => (Array.isArray(fila.palabras) ? fila.palabras : [])
  .map((w: any) => ({ word: w.word, start: w.start, end: w.end }))

async function director(cuerpo: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SESION_URL}/functions/v1/director`, { method: 'POST', headers: hSrv(), body: JSON.stringify({ estilo: 'camara_viva', ...cuerpo }) })
  const d = await r.json().catch(() => null)
  if (!d) throw new Error(`el director no contestó (${r.status})`)
  return d
}

/* ── HEREDAR ── (30-oct) Sergio recortó dos tomas y «desaparecieron» sus gráficos: cada recorte crea una base nueva y el plan estaba
   amarrado a la anterior; se volvía a pagar al director y se perdían las imágenes y lo editado. Las palabras casi no cambian: se
   alinean las dos listas y cada momento sigue con las palabras que le quedaron. El momento que se quedó sin palabras se va; las palabras
   nuevas (una toma que se alargó) quedan contigo hablando. Las caras no se heredan: los tiempos cambiaron y la página las vuelve a buscar. */
const normal = (w: unknown) => String(w ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u00f1]/g, '')
function alinear(a: string[], b: string[]): number[] | null {
  const mapa = new Array(a.length).fill(-1)
  let ini = 0, fa = a.length, fb = b.length
  while (ini < fa && ini < fb && a[ini] === b[ini]) { mapa[ini] = ini; ini++ }
  while (fa > ini && fb > ini && a[fa - 1] === b[fb - 1]) { fa--; fb--; mapa[fa] = fb }
  const n = fa - ini, m = fb - ini
  if (!n || !m) return mapa
  if (n * m > 9000000) return null   // cambió casi todo: no es un recorte, mejor un plan nuevo
  const t = new Uint16Array((n + 1) * (m + 1)), f = m + 1
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    t[i * f + j] = a[ini + i] === b[ini + j] ? t[(i + 1) * f + j + 1] + 1 : Math.max(t[(i + 1) * f + j], t[i * f + j + 1])
  }
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[ini + i] === b[ini + j]) { mapa[ini + i] = ini + j; i++; j++ }
    else if (t[(i + 1) * f + j] >= t[i * f + j + 1]) i++
    else j++
  }
  return mapa
}
function heredarMomentos(viejo: any, pa: any[], pb: any[]): { momentos: any[], imagenes: Record<string, unknown>, quitados: number, nuevos: number } | null {
  const mapa = alinear(pa.map((w) => normal(w.word)), pb.map((w) => normal(w.word)))
  if (!mapa) return null
  const iguales = mapa.filter((x) => x >= 0).length
  if (iguales < Math.max(5, 0.5 * Math.max(pa.length, pb.length))) return null   // cambió más de la mitad: no es un recorte
  const salida: any[] = [], imagenes: Record<string, unknown> = {}
  let prev = -1, quitados = 0, nuevos = 0
  const tuyo = (a: number, b: number) => ({ tipo: 'hablando', desde: a, hasta: b, t0: pb[a].start, t1: pb[b].end, camara: 'suave' })
  const hueco = (hasta: number) => {   // palabras nuevas: una o dos se quedan con el momento anterior; más, contigo hablando
    if (hasta <= prev) return
    const ult = salida[salida.length - 1]
    if (ult && hasta - prev <= 2) { ult.hasta = hasta; ult.t1 = pb[hasta].end } else { salida.push(tuyo(prev + 1, hasta)); nuevos++ }
    prev = hasta
  }
  ;(viejo.plan.momentos || []).forEach((m0: any, i: number) => {
    const quedan: number[] = []
    for (let k = m0.desde; k <= m0.hasta && k < mapa.length; k++) if (mapa[k] > prev) quedan.push(mapa[k])
    if (!quedan.length) { quitados++; return }
    hueco(quedan[0] - 1)
    const m = { ...m0, desde: quedan[0], hasta: quedan[quedan.length - 1], t0: pb[quedan[0]].start, t1: pb[quedan[quedan.length - 1]].end }
    if (Array.isArray(m0.zoom)) m.zoom = m0.zoom.map((z: number) => mapa[z]).filter((z: number) => z >= m.desde && z <= m.hasta)
    if (viejo.imagenes && viejo.imagenes[String(i)]) imagenes[String(salida.length)] = viejo.imagenes[String(i)]
    salida.push(m)
    prev = m.hasta
  })
  hueco(pb.length - 1)
  return salida.length ? { momentos: salida, imagenes, quitados, nuevos } : null
}
const conPalabra = (l: any[]) => l.filter((w) => String(w.word ?? '').trim())   // como el director: numera sin las vacías
/* De dónde sale: el plan más reciente del proyecto (la «de» de la base puede ser más vieja que el último recorte) */
async function heredarPlan(fila: any, escribir = true): Promise<any | null> {
  if (!fila.mano) return null
  const r = await fetch(`${SESION_URL}/rest/v1/renders?project_id=eq.${fila.project_id}&created_at=lt.${encodeURIComponent(fila.created_at)}&graficos->>estilo=eq.camara_viva&graficos->plan=not.is.null&select=id,graficos,palabras:subtitle_phrases->palabras&order=created_at.desc&limit=1`, { headers: hSrv() })
  const fuentes = r.ok ? await r.json() : []
  const f0 = Array.isArray(fuentes) ? fuentes[0] : null
  if (!f0) return null
  const pb = conPalabra(palabrasDe(fila))
  if (pb.length < 5) return null
  const h = heredarMomentos(f0.graficos, conPalabra(palabrasDe(f0)), pb)
  if (!h) return null
  const planNuevo = { ...f0.graficos.plan, momentos: h.momentos }
  if (!escribir) return { de: f0.id, ...h, plan: planNuevo }
  const quedo = await guardar(fila.id, (x) => {
    const { pendiente: _p, error: _e, caras: _c, caras_version: _v, ...resto } = x
    return { ...resto, plan: planNuevo, imagenes: h.imagenes, avisos: f0.graficos.avisos || [], uso: f0.graficos.uso || null, heredado_de: f0.id, listo: new Date().toISOString() }
  })
  console.log(`[cv] plan heredado ${fila.id} de ${f0.id}: ${h.momentos.length} momentos, ${h.quitados} quitados, ${h.nuevos} nuevos`)
  return quedo
}
/* ── FIN HEREDAR ── */

// El plan: el heredado si la base sale de un recorte; si no, recoger el que dejó pedido orchestrate, o pedirlo si no hay, falló o se perdió.
async function plan(fila: any): Promise<Record<string, unknown>> {
  const g = fila.graficos && fila.graficos.estilo === 'camara_viva' ? fila.graficos : null
  if (g && g.plan) return { plan: g.plan, avisos: g.avisos || [], caras: g.caras || null, imagenes: await conEnlaces(g.imagenes) }
  const her = await heredarPlan(fila).catch((e) => { console.warn('[cv] no se pudo heredar: ' + String(e).slice(0, 200)); return null })
  if (her) return { plan: her.plan, avisos: her.avisos || [], caras: null, imagenes: await conEnlaces(her.imagenes) }
  const palabras = palabrasDe(fila)
  if (palabras.length < 5) return { pendiente: true, estado: 'sin_palabras' }   // la base aún no tiene sus palabras
  const perdido = g && g.pendiente && Date.now() - Date.parse(String(g.pedido || 0)) > ESPERA_MAX_MS
  if (g && g.pendiente && !perdido) {
    const d = await director({ accion: 'resultado', id: g.pendiente, palabras })
    if (d.pendiente) return { pendiente: true, estado: d.estado || 'pendiente' }
    if (!d.ok || !d.plan) {   // OpenAI falló: se anota y la próxima vez se pide de nuevo
      await guardar(fila.id, (x) => { const { pendiente: _p, ...resto } = x; return { ...resto, error: String(d.error || 'el director falló').slice(0, 300) } })
      return { pendiente: true, estado: 'reintentar' }
    }
    const quedo = await guardar(fila.id, (x) => {
      if (x.plan) return x   // otro pedido ya lo guardó
      const { pendiente: _p, error: _e, ...resto } = x
      return { ...resto, plan: d.plan, avisos: (d.avisos || []).slice(0, 60), uso: d.uso || null, listo: new Date().toISOString() }
    })
    console.log(`[cv] plan listo ${fila.id}: ${(d.plan.momentos || []).length} momentos, US$${d.uso?.usd ?? '?'}`)
    return { plan: quedo.plan, avisos: quedo.avisos || [], caras: quedo.caras || null, imagenes: await conEnlaces(quedo.imagenes) }
  }
  // no hay plan pedido (base hecha antes de la Cámara viva), falló o se perdió: se pide ahora (máx. 3 veces: cada pedido se paga)
  if (g && Number(g.intentos || 0) >= 3) return { error: 'No se pudo armar el plan de este video. Escríbenos y lo revisamos.' }
  const d = await director({ accion: 'plan', palabras })
  if (!d.pendiente) throw new Error(String(d.error || 'el director no aceptó el pedido').slice(0, 300))
  await guardar(fila.id, (x) => { const { error: _e, ...resto } = x; return { ...resto, v: MOTOR_GRAFICOS, pendiente: String(d.pendiente), pedido: new Date().toISOString(), intentos: Number(x.intentos || 1) + 1 } })
  console.log(`[cv] plan pedido desde la página ${fila.id}`)
  return { pendiente: true, estado: 'pedido' }
}

// Las caras: [[t, x, y, ancho, alto], …] en el cuadro de 1080 × 1920, ordenadas por tiempo (máx. 1 cada 0,1 s, 20 min).
function limpiarCaras(c: any): number[][] | null {
  if (!Array.isArray(c) || !c.length || c.length > 12000) return null
  const lista = c.filter((f: any) => Array.isArray(f) && f.length === 5 && f.every((n: any) => Number.isFinite(Number(n))))
    .map((f: any[]) => f.map((n) => Math.round(Number(n) * 100) / 100))
    .filter((f: number[]) => f[0] >= 0 && f[3] > 0 && f[4] > 0)
    .sort((a: number[], b: number[]) => a[0] - b[0])
  return lista.length ? lista : null
}

/* ── LAS IMÁGENES ── */
// La lámina a la que va la imagen: las de imagen y las de tu video en el recuadro (un gráfico no lleva imagen)
function laminaDe(fila: any, momento: unknown): any | null {
  const plan = fila.graficos && fila.graficos.estilo === 'camara_viva' ? fila.graficos.plan : null
  const m = plan && Array.isArray(plan.momentos) ? plan.momentos[Number(momento)] : null
  return m && m.tipo === 'lamina' && m.objeto?.tipo !== 'grafico' ? m : null
}
let cacheFicha: any = null
async function ficha(): Promise<any> {
  if (cacheFicha) return cacheFicha
  const r = await fetch(`${FICHA_URL}?t=${Date.now()}`)
  if (!r.ok) throw new Error('No encuentro los estilos de imagen.')
  return (cacheFicha = await r.json())
}
async function rpc(nombre: string, cuerpo: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SESION_URL}/rest/v1/rpc/${nombre}`, { method: 'POST', headers: hSrv(), body: JSON.stringify(cuerpo) })
  return r.ok ? await r.json().catch(() => ({ ok: true })) : { ok: true }   // un error del registro nunca bloquea (como en sb-vineta)
}
async function crearImagen(fila: any, usuario: string, b: any): Promise<Record<string, unknown>> {
  const m = laminaDe(fila, b.momento)
  if (!m) return { error: 'Esa lámina no lleva imagen.' }
  const ve = String(b.descripcion || '').trim().slice(0, 240) || String(m.objeto?.ve || '').replace(/,?\s*cast shadow\.?/i, '').trim().replace(/\.$/, '')
  if (!ve) return { error: 'Escribe qué debe verse en esta imagen.' }
  const f = (await ficha()).imagenes || {}
  const refs = b.estilo === 'ref' ? (Array.isArray(b.referencias) ? b.referencias : []).slice(0, 3)
    .filter((x: any) => /^image\/(jpeg|png|webp)$/.test(String(x?.mime)) && typeof x?.datos === 'string' && x.datos.length < 2500000) : []
  const est = (f.estilos || []).find((e: any) => e.id === b.estilo)
  if (b.estilo === 'ref' && !refs.length) return { error: 'Sube al menos una imagen de referencia.' }
  if (b.estilo !== 'ref' && !est) return { error: 'Ese estilo no existe.' }
  const texto = `${ve}, ${b.estilo === 'ref' ? f.texto_referencia : est.texto} ${f.fondo_verde}`
  // se cobra ANTES de gastar en el modelo y se devuelve si falla (el administrador nunca paga; con 'contar' solo se apunta)
  const llave = `img:${fila.project_id}:${crypto.randomUUID()}`
  const c = await rpc('gastar_creditos', { p_user: usuario, p_llave: llave, p_que: 'imagen_cv', p_creditos: 1, p_proyecto: fila.project_id })
  if (c && c.ok === false) return { sin_creditos: true, error: `Te faltan ${c.faltan} créditos para crear esta imagen (cuesta ${c.cuesta}; tienes ${c.tiene}).` }
  try {
    const partes = [{ text: texto }, ...refs.map((x: any) => ({ inline_data: { mime_type: x.mime, data: x.datos } }))]
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_IMAGEN}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY }, signal: AbortSignal.timeout(130000),
      body: JSON.stringify({ contents: [{ role: 'user', parts: partes }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '2K' } } }),
    })
    const d = await r.json()
    const parte = (d?.candidates?.[0]?.content?.parts || []).find((x: any) => x.inlineData || x.inline_data)
    const img = parte ? (parte.inlineData || parte.inline_data) : null
    if (!r.ok || !img) {
      const motivo = String(d?.candidates?.[0]?.finishReason || d?.error?.message || r.status)
      console.warn('[cv] imagen sin salir: ' + motivo.slice(0, 200))
      await rpc('devolver_uso', { p_llave: llave })
      // (30-oct) sin saldo en Google: quien administra Cherry ve qué hacer; a los demás no se les pide reintentar en vano
      if (r.status === 402 || r.status === 429 || /RESOURCE_EXHAUSTED|prepayment/i.test(motivo)) {
        return { error: c && c.admin ? 'Se acabó el saldo de Google: recarga en AI Studio (ai.studio/projects). No se cobró.' : 'Por ahora no se pueden crear imágenes. No se cobró: inténtalo más tarde.' }
      }
      return { error: /SAFETY|PROHIBITED|IMAGE_OTHER/i.test(motivo) ? 'El modelo no quiso dibujar eso. Cambia lo que debe verse. No se cobró.' : 'No salió la imagen. No se cobró: inténtalo otra vez.' }
    }
    return { ok: true, datos: img.data, mime: img.mimeType || img.mime_type, desc: ve }
  } catch (e) {
    await rpc('devolver_uso', { p_llave: llave })
    console.warn('[cv] imagen: ' + String(e).slice(0, 200))
    return { error: 'No salió la imagen. No se cobró: inténtalo otra vez.' }
  }
}

// ── La firma de get-upload-url: PUT por 1 h (por la dirección de subidas y, de respaldo, la de siempre) y GET por 7 días ──
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
async function firmar(metodo: 'PUT' | 'GET', key: string, host: string, segundos: number, extra: Record<string, string> = {}): Promise<string> {
  const enc = new TextEncoder(), ahora = new Date()
  const dia = ahora.toISOString().slice(0, 10).replace(/-/g, '')
  const dt = ahora.toISOString().replace(/[:\-]/g, '').replace(/\.\d+Z/, '') + 'Z'
  const scope = `${dia}/${AWS_REGION}/s3/aws4_request`
  const q: Record<string, string> = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${AWS_KEY_ID}/${scope}`, 'X-Amz-Date': dt, 'X-Amz-Expires': String(segundos), 'X-Amz-SignedHeaders': 'host', ...extra }
  const qs = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join('&')
  const ruta = '/' + key.split('/').map(codificar).join('/')
  const toSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${hex(await crypto.subtle.digest('SHA-256', enc.encode(`${metodo}\n${ruta}\n${qs}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`)))}`
  let k: ArrayBuffer = enc.encode('AWS4' + AWS_SECRET).buffer as ArrayBuffer
  for (const m of [dia, AWS_REGION, 's3', 'aws4_request', toSign]) {
    const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    k = await crypto.subtle.sign('HMAC', ck, enc.encode(m))
  }
  return `https://${host}${ruta}?${qs}&X-Amz-Signature=${hex(k)}`
}
/* Un momento editado: solo lo que se puede corregir, con textos cortos (como los del director). m.orig = lo que él armó */
const corto = (v: unknown, n = 60) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const rojasDe = (r: unknown) => (Array.isArray(r) ? r : []).map((w) => corto(w, 40)).filter(Boolean).slice(0, 4)
/* Lo que lleva la lámina: una imagen, tu clip o un gráfico con sus datos (solo textos cortos, números y listas pequeñas) */
function objetoLimpio(o: any): any {
  if (o?.tipo === 'imagen') return { tipo: 'imagen', es: corto(o.es, 140), ve: corto(o.ve, 600) }
  if (o?.tipo !== 'grafico' || !/^[a-z_]{3,20}$/.test(String(o.grafico))) return { tipo: 'clip' }
  const s: any = { tipo: 'grafico', grafico: String(o.grafico) }
  for (const k of Object.keys(o).slice(0, 12)) {
    if (k === 'tipo' || k === 'grafico' || !/^[a-z_]{1,16}$/.test(k)) continue
    const v = o[k]
    if (typeof v === 'number' && isFinite(v)) s[k] = v
    else if (typeof v === 'string') s[k] = corto(v, 60)
    else if (Array.isArray(v)) s[k] = v.slice(0, 4).map((x: any) => (x && typeof x === 'object' ? { k: corto(x.k, 22), v: Number(x.v) || 0 } : corto(x, 60)))
  }
  return s
}
function limpiarCambios(m: any, c: any): any {
  if (!m.orig) m.orig = { tipo: m.tipo, camara: m.camara }
  if (c.tipo === 'hablando' || c.tipo === 'lamina') m.tipo = c.tipo   // quitar una lámina, devolverla, o volver lámina un tramo tuyo
  if (c.objeto) m.objeto = objetoLimpio(c.objeto)
  if (['corre', 'golpe', 'suave'].includes(c.camara)) m.camara = c.camara
  if (typeof c.camaraFija === 'boolean') { if (c.camaraFija) m.camaraFija = true; else { delete m.camaraFija; m.camara = m.orig.camara } }
  if ('titulo' in c) {
    const t = c.titulo, g = t ? corto(t.gruesa) : ''
    if (!g) delete m.titulo
    else {
      m.titulo = { gruesa: g, rojas: rojasDe(t.rojas) }
      if (corto(t.etiqueta)) m.titulo.etiqueta = corto(t.etiqueta)
      if (corto(t.remate)) m.titulo.remate = corto(t.remate)
    }
  }
  if (c.texto) {
    m.texto = { gruesa: corto(c.texto.gruesa), rojas: rojasDe(c.texto.rojas) }
    if (corto(c.texto.chica)) m.texto.chica = corto(c.texto.chica)
  }
  return m
}
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const HOST_SIEMPRE = `${BUCKET}.s3.${AWS_REGION}.amazonaws.com`
async function conEnlaces(imagenes: any): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const i of Object.keys(imagenes || {})) out[i] = { ...imagenes[i], url: await firmar('GET', imagenes[i].key, HOST_SIEMPRE, 604800) }
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, status = 200) => Response.json(d, { status, headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'solo POST' }, 405)
  const usuario = await usuarioDeSesion(req)
  if (!usuario) return responder({ error: 'Inicia sesión' }, 401)
  try {
    const b = await req.json()
    const fila = await renderDelUsuario(b.render_id, usuario)
    if (!fila) return responder({ error: 'No encuentro ese video' }, 404)
    if (b.accion === 'plan') return responder({ ok: true, ...(await plan(fila)) })
    // A mano: solo sobre un plan que nadie ha tocado (sin editar y sin imágenes). Con «ver» solo cuenta lo que haría
    if (b.accion === 'heredar') {
      const g = fila.graficos && fila.graficos.estilo === 'camara_viva' ? fila.graficos : null
      const tocado = g && g.plan && ((g.plan.momentos || []).some((m: any) => m.orig) || Object.keys(g.imagenes || {}).length > 0)
      if (tocado) return responder({ error: 'Este plan ya tiene cambios: no se reemplaza.' })
      const d = await heredarPlan(fila, false)
      if (!d) return responder({ error: 'No hay de dónde heredar.' })
      if (b.ver) return responder({ ok: true, de: d.de, quitados: d.quitados, nuevos: d.nuevos, momentos: d.momentos.length, editados: d.momentos.filter((m: any) => m.orig).length, imagenes: Object.keys(d.imagenes), resumen: d.momentos.map((m: any) => [m.tipo === 'lamina' ? (m.objeto?.grafico || m.objeto?.tipo) : 'tu', m.desde, m.hasta, m.t0, m.t1]) })
      const q = await heredarPlan(fila)
      return responder({ ok: true, plan: q.plan, avisos: q.avisos || [], caras: null, imagenes: await conEnlaces(q.imagenes) })
    }
    if (b.accion === 'caras') {
      const caras = limpiarCaras(b.caras)
      if (!caras) return responder({ error: 'caras vacías o mal formadas' }, 400)
      const version = String(b.version || '').slice(0, 40)
      await guardar(fila.id, (x) => ({ ...x, caras, caras_version: version || null }))
      return responder({ ok: true, guardadas: caras.length })
    }
    // Las imágenes contestan 200 aunque no salgan: la página muestra el motivo en la lámina
    if (b.accion === 'imagen') return responder(await crearImagen(fila, usuario, b))
    if (b.accion === 'subir_imagen') {
      const ext = EXT[String(b.tipo)]
      if (!ext) return responder({ error: 'Sube una imagen PNG, JPG o WEBP.' })
      const key = `uploads/${fila.project_id}/imagenes/${crypto.randomUUID()}.${ext}`
      return responder({ ok: true, key, put: await firmar('PUT', key, `${BUCKET}.s3.amazonaws.com`, 3600), put_r: await firmar('PUT', key, HOST_SIEMPRE, 3600) })
    }
    if (b.accion === 'editar_momento') {
      const i = Number(b.momento), c = b.cambios || {}
      const quedo = await guardar(fila.id, (x) => {
        const momentos = (x.plan && Array.isArray(x.plan.momentos) ? x.plan.momentos : []).slice()
        if (!Number.isInteger(i) || !momentos[i]) throw new Error('Ese momento ya no existe.')
        const m = limpiarCambios({ ...momentos[i] }, c)
        momentos[i] = m
        return { ...x, plan: { ...x.plan, momentos } }
      })
      return responder({ ok: true, momento: quedo.plan.momentos[i] })
    }
    if (b.accion === 'guardar_imagen') {
      const key = String(b.key || '')
      if (!laminaDe(fila, b.momento) || !key.startsWith(`uploads/${fila.project_id}/imagenes/`)) return responder({ error: 'No se pudo guardar esa imagen.' })
      const i = String(Number(b.momento))
      const quedo = await guardar(fila.id, (x) => ({ ...x, imagenes: { ...(x.imagenes || {}), [i]: {
        key, estilo: String(b.estilo || '').slice(0, 24), origen: b.origen === 'tuya' ? 'tuya' : 'cherry', desc: String(b.desc || '').slice(0, 240), en: new Date().toISOString() } } }))
      return responder({ ok: true, imagenes: await conEnlaces(quedo.imagenes) })
    }
    if (b.accion === 'quitar_imagen') {
      const i = String(Number(b.momento))
      const quedo = await guardar(fila.id, (x) => { const im = { ...(x.imagenes || {}) }; delete im[i]; return { ...x, imagenes: im } })
      return responder({ ok: true, imagenes: await conEnlaces(quedo.imagenes) })
    }
    return responder({ error: 'acción desconocida' }, 400)
  } catch (e) {
    console.warn('[cv] ' + String(e).slice(0, 300))
    return responder({ ok: false, error: String(e).slice(0, 300) }, 500)
  }
})

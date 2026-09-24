// orchestrate v201 — «Sin pausas» ya no se come las palabras. Dos causas en el mismo bloque: el margen
//   al cortar un grupo eran 0,05 s y los tiempos de Whisper se desvían ~±80 ms, así que el corte entraba
//   DENTRO de la palabra; y el suelo del umbral eran 0,15 s, que no es un silencio sino el ritmo de alguien
//   enumerando. Ahora el margen es 0,14 s pero NUNCA pasa de la mitad del silencio de ese lado — no puede
//   invadir la palabra vecina — y ningún trozo baja de 0,34 s.
// orchestrate v200 — SIN CORTES: `sin_cortes: true` deja el video TAL CUAL y solo le pone lo de encima
//   (subtítulos, color, gráficos, escenas, movimiento). Sergio sube videos que ya editó él y Cherry se los
//   recortaba. ⚠️ El corte pasa por DOS sitios —`corteLimpio()` (motor-tomas) y `cleanTranscription()`
//   (repeticiones y muletillas)— y apagar solo uno seguía quitando partes. Las palabras SÍ se leen: lo que
//   se apaga es el recorte, no la transcripción, o no habría subtítulos.
// orchestrate v199 — el aire viaja también a F1 (`aire_s`): al cortar cada clip deja EXACTAMENTE esos segundos de
//   silencio en los bordes (medido con el audio, -35 dB). Comprobado el 19-sep con el video de Sergio: las palabras
//   siguen cuadrando con la voz (desfase medio 0,1 s, sin acumularse) y el aire entre cortes queda en 0,00 s.
// orchestrate v198 — AIRE ENTRE CORTES: `aire` (segundos, 0 a 0,5; por defecto 0,12) recorta el silencio del principio
//   y del final de cada corte usando la voz que midió el motor (cuts[].voz). Con 0, un corte empieza justo donde
//   empieza la voz y acaba donde acaba. Antes el silencio de los bordes se quedaba tal cual (medido: 0,22 a 0,39 s por junta).
// orchestrate v197 — GRÁFICOS PREMIUM: `graficos.estilo` ('clasico' | 'premium') viaja en subtitle_config.graficos; con
//   'premium' el ensamblador le pide cada gráfico a Remotion Lambda (premium.js) en vez de dibujarlo con el canvas.
// orchestrate v196 — GRÁFICOS: `graficos` ({cantidad, color}) → subtitle_config.graficos; renders.graficos = lo que marcó la IA
//   (función biblioteca › graficos: cifras, porcentajes, listas, antes y después, fechas y citas), a la vez que las frases y las
//   escenas; se copia al camino rápido y desde la base. El ensamblador los dibuja con graficos.js (el mismo de la página).
// orchestrate v195 — ESCENAS DE APOYO: `escenas` ({cantidad}) → subtitle_config.escenas; renders.apoyo = momentos + escenas de la
//   biblioteca que encontró la IA (función biblioteca › apoyo), junto con las frases; se copia al camino rápido y desde la base.
// orchestrate v194 — MOVIMIENTO de cámara: `movimiento` ({efectos, curva, intensidad, ritmo}) se guarda limpio en
//   subtitle_config.movimiento en los tres caminos; el ensamblador v7 reparte los efectos por pedazo entre cortes.
// orchestrate v193 — con los subtítulos apagados por el camino rápido, ninguna frase lleva plantilla propia (se dibujaban los titulares).
// orchestrate v192 — cambiar un detalle ya no regenera todo: en el camino rápido viaja el modo de impacto (modo, impacto,
//   plantilla_impacto) y, si cambió el nivel o se pasó a «solo impacto», se piden SOLO los titulares sobre las frases que ya
//   hay (`marcar_titulares`), en segundo plano. Desde la base con otro nivel: también solo los titulares.
// orchestrate v191 — el titular se lleva sus palabras pegadas que quedaron justo antes («no», «ni», «nunca», artículos y
//   posesivos: «[no] has viajado…», «[el] premio no se lo lleva…») sin pasar de 7 palabras, y la IA de titulares no puede
//   dejar por fuera una negación (sin el «no» se invertía el sentido).
// orchestrate v189 — los TITULARES de impacto los escoge una llamada aparte (esfuerzo medio, respuesta corta) en paralelo con
//   la IA de frases, que ahora solo parte el texto. Luego los titulares se meten en su sitio y las frases vecinas se recortan.
//   probar_frases acepta también {esfuerzo_titulares}.
// orchestrate v188 — el esfuerzo de la IA de frases vuelve a «low» (con «medium» dejó palabras sin frase: 36 frases salteadas
//   en vez de 74, y tardó ~150 s). Nuevo `probar_frases` {esfuerzo} junto a preparar_base: solo corre la IA, guarda las
//   frases y el tiempo en la fila (status «prueba», nunca sirve de base) y no corta video. Para comparar sin gastar.
// orchestrate v187 — frases de impacto con sentido (18-sep-2026, Sergio: «¡fracasaste como ser humano veinticinco» no tiene
//   lógica sola): la IA lee el TEXTO seguido además de la lista numerada, ve las pausas cortas (·) además de las largas (⏸),
//   piensa con esfuerzo medio y tiene una regla nueva: la frase de impacto se lee sola como un titular (empieza y termina
//   donde empieza y termina la idea, nunca toma la primera palabra de la oración siguiente, de 2 a 6 palabras).
// orchestrate v186 — en la base adelantada la IA de frases corre en paralelo con el corte de los clips y se guarda
//   (frases + correcciones + palabras corregidas para la vista previa). Generar desde la base ya no la espera (~53 s
//   menos) y la vista previa muestra las frases de verdad. Se marcan con impacto «medio»; otro nivel la vuelve a pedir.
// orchestrate v184 — BASE ADELANTADA (18-sep-2026): `preparar_base` recorre el MISMO camino de generar (motor, orden
//   de los clips, «eliminar silencios», palabras al tiempo final) pero solo corta y pega: F1 → ensamblador, que al ver
//   subtitle_config.base sube la base sin subtítulos y NO hace la pasada final (status 'base'). La página la pide apenas
//   el motor decide los cortes, así la vista previa es UN video fluido (no 20 clips saltando). `reusar_base`: generar
//   sobre esa base = IA de frases + F2 + pasada final en pedazos, sin volver a cortar los clips.
// orchestrate v183 — CHERRY GOLD (18-sep-2026): el catálogo de looks pasa a ser solo `cherry_gold` (los 5 fijos
//   del 17-sep se quitaron) y viajan los `ajustes` de la persona (luz, contraste, dorado, sombras, piel, viñeta;
//   -100 a +100). El ensamblador hornea el look en cada render con motor-color.js. Una sola función
//   (limpiarColor) sirve a los dos caminos: render normal y exportar rápido.
// orchestrate v182 — REVELADO (18-sep-2026): el ensamblador mide cada video y le quita el velo
//   (cada canal arranca en su punto negro), balancea los blancos y ajusta la exposición ANTES del
//   look. Va encendido siempre; `color.revelado === false` lo apaga. Sin eso, un look encima de
//   material sucio se ve sucio — que fue justo lo que pasó con los primeros 5 looks.
// orchestrate v181 — looks de color: `color` ({look, intensidad}) se guarda en subtitle_config.color y el
//   ensamblador aplica el LUT antes de quemar los subtítulos (17-sep-2026)
// orchestrate v180 — las plantillas también se mueven a los lados (subtitulos.x, -35 a +35 puntos del ancho)
//   y se pueden subir más (y hasta ±45) (17-sep-2026)
// orchestrate v179 — tamaño y posición de las plantillas: subtitulos.escala (0,7–1,5) y subtitulos.y
//   (-30 a +30 puntos del alto) viajan a F2 y quedan en subtitle_config (17-sep-2026)
// orchestrate v178 — exportar rápido: con `reusar_render` (y frases del editor) reutiliza cortes + base sin subtítulos
//   de ese render y solo rehace subtítulos y quemada final (17-sep-2026)
// orchestrate v177 — modo «solo frases de impacto»: subtitulos.modo='impacto' + impacto pocas|medio|muchas → la IA marca
//   las más llamativas (estilo = plantilla) y el resto sale con «a tu gusto» (17-sep-2026)
// orchestrate v176 — palabras mal oídas: la IA de frases propone correcciones (1 palabra por 1, tiempos intactos)
//   y el editor manda `subtitulos.textos` con las aceptadas + las corregidas a mano (17-sep-2026)
// orchestrate v175 — el editor manda frases con estilo por frase; se descartan si ya no coinciden con las palabras (17-sep-2026)
// orchestrate v173 — plantillas de subtítulos (16-sep-2026): si llega `subtitulos` ({plantilla, simple, frases}),
//   la IA marca frases + palabra clave y F2 dibuja la plantilla; sin `subtitulos` todo sigue como antes
// orchestrate v172 — gráficos APAGADOS (16-sep-2026): no se analizan escenas ni se invoca carrete-graphics;
//   el render nace con f3_done=true para que F1/F2 disparen el ensamblador. Se encienden con el secreto CARRETE_GRAFICOS=on
// orchestrate v171 — usa el corte limpio del motor de tomas (sin intentos fallidos); acepta llamadas internas con user_id (16-sep-2026)
// orchestrate v168 — exige sesión iniciada y que el proyecto sea del usuario (16-sep-2026)
// orchestrate v167 — Ronda 15 iteración 19
// v155 + unicode escapes explícitos en normalizeForMatch (evita chars combinatorios en regex)
// + cleanTranscription expone removedSet para guardar transcript completo en renders
// + guarda clean_words_json (palabras + removed) para el editor de resultado
// + acepta scenesOverride (salta GPT si ya existen escenas editadas por el usuario)
// + acepta cutsOverride (salta recipe si el usuario reordenó/recortó clips en el editor)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_KEY = Deno.env.get('SVC_JWT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
// Gráficos de escena (F3): apagados hasta tener un motor de gráficos bueno
const GRAFICOS_ACTIVOS = (Deno.env.get('CARRETE_GRAFICOS') ?? '') === 'on'
const AWS_REGION = Deno.env.get('AWS_REGION') ?? 'us-east-1'
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
const AWS_SESSION_TOKEN = Deno.env.get('AWS_SESSION_TOKEN') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}


// ── Sesión obligatoria (16-sep-2026) ─────────────────────────────────────────
// Solo pasa quien inició sesión de verdad: el servidor de Auth valida el token.
// La llave pública de la página (anon) NO es una sesión y se rechaza.
const SESION_URL  = Deno.env.get('SUPABASE_URL') ?? ''
const SESION_ANON = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ'
const SESION_SRV  = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* Color del video: revelado (limpiar) + look (receta con ajustes). Lo usan el render normal y el
   exportar rápido — antes cada uno tenía su propia copia y era fácil que quedaran distintas. */
const LOOKS = ['cherry_gold']
const AJUSTES_LOOK = ['luz', 'contraste', 'dorado', 'sombras', 'piel', 'vineta']
function limpiarColor(color: any): Record<string, unknown> | null {
  if (!color || typeof color !== 'object') return null
  const revelado = color.revelado !== false
  const cfg: Record<string, unknown> = { revelado }
  if (LOOKS.includes(String(color.look))) {
    cfg.look = String(color.look)
    cfg.intensidad = Math.max(0, Math.min(1, Number(color.intensidad ?? 1) || 0))
    const aj: Record<string, number> = {}
    if (color.ajustes && typeof color.ajustes === 'object') {
      for (const k of AJUSTES_LOOK) {
        const v = Number(color.ajustes[k])
        if (Number.isFinite(v) && v) aj[k] = Math.max(-100, Math.min(100, Math.round(v)))
      }
    }
    if (Object.keys(aj).length) cfg.ajustes = aj
  }
  return (cfg.look || !revelado) ? cfg : null
}

/* Movimiento de cámara (v194): qué efectos, con qué curva de velocidad y qué intensidad. Sin efectos = sin movimiento. */
const EFECTOS_MOV = ['lento', 'aleja', 'golpe', 'impacto', 'mano', 'sacude']
function limpiarMovimiento(m: any): Record<string, unknown> | null {
  if (!m || typeof m !== 'object' || !Array.isArray(m.efectos)) return null
  const efectos = EFECTOS_MOV.filter((e) => m.efectos.includes(e))
  if (!efectos.length) return null
  return {
    efectos,
    curva: ['suave', 'energico', 'rebote', 'parejo'].includes(String(m.curva)) ? String(m.curva) : 'suave',
    intensidad: ['sutil', 'media', 'fuerte'].includes(String(m.intensidad)) ? String(m.intensidad) : 'media',
    ritmo: Math.max(0, Math.min(100, Number(m.ritmo) || 50)),
  }
}

/* Escenas de apoyo (v195): cuántas quiere la persona. Sin cantidad = apagadas. */
/* Lo que la persona fijó desde el guion (20-sep): {si:[{desde,hasta}], no:[...]} en números de palabra.
   Se deja pasar tal cual hasta apoyo.js y graficos.js, que lo honran antes que a la IA. Con tope, para
   que un cliente raro no mande mil zonas. */
function limpiarFijos(f: any): Record<string, unknown> | undefined {
  if (!f || typeof f !== 'object') return undefined
  const zonas = (v: any) => (Array.isArray(v) ? v : []).slice(0, 60)
    .map((z: any) => ({ desde: Math.round(Number(z?.desde)), hasta: Math.round(Number(z?.hasta)) }))
    .filter((z: any) => Number.isFinite(z.desde) && Number.isFinite(z.hasta) && z.hasta >= z.desde && z.desde >= 0)
  const si = zonas(f.si), no = zonas(f.no)
  return si.length || no.length ? { si, no } : undefined
}

function limpiarEscenas(e: any): Record<string, unknown> | null {
  if (!e || typeof e !== 'object') return null
  return ['pocas', 'medio', 'muchas'].includes(String(e.cantidad)) ? { cantidad: String(e.cantidad), fijos: limpiarFijos(e.fijos) } : null
}
/* Lo que encontró la IA en la biblioteca para estas palabras (función biblioteca › apoyo). null si falla: el video sigue sin escenas. */
async function apoyoDe(words: any[]): Promise<Record<string, unknown> | null> {
  if (!Array.isArray(words) || words.length < 8) return null
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), 90000)
  try {
    const t0 = Date.now()
    const r = await fetch(`${SESION_URL}/functions/v1/biblioteca`, {
      method: 'POST', signal: control.signal,
      headers: { Authorization: `Bearer ${SESION_SRV}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'apoyo', palabras: words.map((w: any) => ({ word: w.word, start: w.start, end: w.end })) }),
    })
    if (!r.ok) { console.warn(`[v195] apoyo: ${r.status} ${(await r.text()).slice(0, 160)}`); return null }
    const a = await r.json()
    console.log(`[v195] Escenas de apoyo: ${Array.isArray(a?.momentos) ? a.momentos.length : 0} momentos en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    return a && Array.isArray(a.momentos) ? a : null
  } catch (e) { console.warn('[v195] apoyo falló:', String(e)); return null }
  finally { clearTimeout(reloj) }
}

/* Gráficos (v196): cuántos y de qué color. Sin cantidad = apagados. */
function limpiarGraficos(g: any): Record<string, unknown> | null {
  if (!g || typeof g !== 'object' || !['pocos', 'medio', 'muchos'].includes(String(g.cantidad))) return null
  const c = String(g.color || 'cherry')
  return { cantidad: String(g.cantidad), color: /^#[0-9a-fA-F]{6}$/.test(c) || /^[a-z]{3,12}$/.test(c) ? c : 'cherry',
           estilo: g.estilo === 'premium' ? 'premium' : 'clasico', detras: !!g.detras, fijos: limpiarFijos(g.fijos) }
}
/* 20-sep: los momentos de graficos se guardaban una vez y se heredaban para siempre, asi que mejorar el
   motor no llegaba a los proyectos que ya existian: Sergio subio los graficos a «muchos» y seguia viendo
   los 3 de la version vieja. Ahora se comparan versiones y se vuelven a marcar si el motor cambio. */
const MOTOR_GRAFICOS = 4
const graficosViejos = (g: any) => !g || Number((g as Record<string, unknown>)?.v ?? 1) < MOTOR_GRAFICOS

/* Lo que marcó la IA para los gráficos (función biblioteca › graficos). null si falla: el video sigue sin gráficos. */
async function graficosDe(words: any[]): Promise<Record<string, unknown> | null> {
  if (!Array.isArray(words) || words.length < 8) return null
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), 90000)
  try {
    const t0 = Date.now()
    const r = await fetch(`${SESION_URL}/functions/v1/biblioteca`, {
      method: 'POST', signal: control.signal,
      headers: { Authorization: `Bearer ${SESION_SRV}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'graficos', palabras: words.map((w: any) => ({ word: w.word, start: w.start, end: w.end })) }),
    })
    if (!r.ok) { console.warn(`[v196] graficos: ${r.status} ${(await r.text()).slice(0, 160)}`); return null }
    const a = await r.json()
    console.log(`[v196] Gráficos: ${Array.isArray(a?.momentos) ? a.momentos.length : 0} momentos en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    return a && Array.isArray(a.momentos) ? a : null
  } catch (e) { console.warn('[v196] graficos falló:', String(e)); return null }
  finally { clearTimeout(reloj) }
}

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

// Devuelve la fila si pertenece al usuario; null si no existe o es de otro.
async function filaDelUsuario(tabla: 'projects' | 'clips', id: unknown, userId: string, campos = 'id'): Promise<any | null> {
  if (typeof id !== 'string' || !ES_UUID.test(id)) return null
  try {
    const r = await fetch(`${SESION_URL}/rest/v1/${tabla}?id=eq.${id}&user_id=eq.${userId}&select=${campos}&limit=1`, {
      headers: { apikey: SESION_SRV, Authorization: `Bearer ${SESION_SRV}` },
    })
    if (!r.ok) return null
    const filas = await r.json()
    return Array.isArray(filas) && filas[0] ? filas[0] : null
  } catch (_) { return null }
}

// ── Llamadas internas del servidor (pruebas y trabajos programados) ──────────
async function esLlamadaInterna(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  const conocidas = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v)
  if (conocidas.includes(token)) return true
  try {
    const r = await fetch(`${SESION_URL}/auth/v1/admin/users?page=1&per_page=1`, { headers: { apikey: token, Authorization: `Bearer ${token}` } })
    return r.ok
  } catch (_) { return false }
}

// ── Supabase DB ───────────────────────────────────────────────────────────────
function db(path: string, method = 'GET', body?: unknown) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(r => r.json())
}

// ── SigV4 Lambda invoke ───────────────────────────────────────────────────────
async function hmac(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key)
  const k = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
}
async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function invokeLambdaAsync(functionName: string, payload: object): Promise<void> {
  const body = JSON.stringify(payload)
  const host = `lambda.${AWS_REGION}.amazonaws.com`
  const path = `/2015-03-31/functions/${functionName}/invocations`
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const hms = now.toISOString().slice(11, 19).replace(/:/g, '')
  const amzDate = `${ymd}T${hms}Z`
  const payloadHash = await sha256hex(body)
  const headers: Record<string, string> = {
    host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash,
    'x-amz-invocation-type': 'Event', 'content-type': 'application/json',
  }
  if (AWS_SESSION_TOKEN) headers['x-amz-security-token'] = AWS_SESSION_TOKEN
  const signedNames = Object.keys(headers).sort().join(';')
  const canonHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')
  const canonReq = ['POST', path, '', canonHeaders, signedNames, payloadHash].join('\n')
  const credScope = `${ymd}/${AWS_REGION}/lambda/aws4_request`
  const strToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${await sha256hex(canonReq)}`
  let sigKey: ArrayBuffer = await hmac(`AWS4${AWS_SECRET_ACCESS_KEY}`, ymd)
  sigKey = await hmac(sigKey, AWS_REGION)
  sigKey = await hmac(sigKey, 'lambda')
  sigKey = await hmac(sigKey, 'aws4_request')
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credScope}, SignedHeaders=${signedNames}, Signature=${hexEncode(await hmac(sigKey, strToSign))}`
  const res = await fetch(`https://${host}${path}`, { method: 'POST', headers, body })
  console.log(`[v153] Lambda ${functionName} invoked | status=${res.status}`)
}

// ── OpenAI: analiza transcript y devuelve N escenas impactantes ───────────────
async function analyzeTranscript(words: any[], duration: number, N: number): Promise<any[]> {
  if (!OPENAI_API_KEY || words.length === 0) return []
  const transcriptWithTimes = words
    .map((w: any) => `[${Number(w.start).toFixed(1)}s] ${w.word}`)
    .join(' ')
    .slice(0, 3500)
  const prompt =
    'Analiza esta transcripcion de video (' + duration.toFixed(0) + 's) e identifica exactamente ' + N + ' momentos impactantes.\n\n' +
    'La transcripcion tiene tiempos en SEGUNDOS como [17.1s]. Para timestamp_ms convierte a MILISEGUNDOS x1000. Ejemplo: [17.1s] → 17100\n\n' +
    'Para cada momento devuelve:\n' +
    '- timestamp_ms: tiempo en MILISEGUNDOS del inicio del momento\n' +
    '- hero: UNA palabra temática del momento (MAXIMO 8 CARACTERES, sin puntuacion, minusculas). El hero puede NO aparecer en el support — de hecho DEBE ser una palabra DIFERENTE a las del support.\n' +
    '- support: EXACTAMENTE 3, 4 o 5 palabras LITERALES Y CONSECUTIVAS de la transcripcion que se digan CERCA del timestamp (maximo +-20 segundos). Copia las palabras exactas. Forma una idea completa que cierra sola. Prohibido inventar.\n' +
    '- theme: 2-4 keywords visuales en espanol\n\n' +
    'PROCESO OBLIGATORIO para elegir hero y support:\n' +
    '  PASO 1: Identifica el momento impactante y anota la frase mas impactante de ese segundo → ese es el SUPPORT.\n' +
    '  PASO 2: Elige el hero = una palabra TEMATICA del momento que NO aparezca en el support.\n' +
    '  PASO 3: Si el hero que quieres usar esta dentro del support, busca OTRA frase del mismo momento o cambia el hero a una palabra que no este en el support.\n\n' +
    'REGLA CRITICA — hero JAMAS en support, tampoco palabras de la misma raiz:\n' +
    '  MAL: hero="tarde" support="es tarde o temprano" → "tarde" repetido\n' +
    '  MAL: hero="logros" support="hayas logrado al menos" → "logr" es raiz de ambas\n' +
    '  MAL: hero="camino" support="es disfrutar el camino" → "camino" repetido\n' +
    '  MAL: hero="premio" support="el premio no se" → "premio" repetido\n' +
    '  BIEN: hero="logros" support="se lo llevan todos" → ninguna raiz compartida\n' +
    '  BIEN: hero="tarde" support="la comparacion es inevitable" → "tarde" NO esta en support\n' +
    '  BIEN: hero="camino" support="sin importar el puesto" → "camino" NO esta en support\n\n' +
    'ADVERTENCIA CRITICA: El support debe copiarse TEXTUALMENTE de la transcripcion. Busca 3, 4 o 5 palabras CONSECUTIVAS que aparezcan EXACTAMENTE en el texto. NO parafrasees, NO cambies el orden.\n\n' +
    'REGLA — idea COMPLETA (la frase debe cerrar sola sin depender de palabras externas):\n' +
    '  MAL (cortada): support="el no se lo lleva" — falta quién\n' +
    '  MAL (cortada): support="que a ti" — fragmento sin sentido solo\n' +
    '  BIEN (completa): support="se lo llevan todos" — cierra sola\n' +
    '  BIEN (completa): support="sin importar el puesto" — cierra sola\n\n' +
    'REGLA — 4 momentos BIEN DISTRIBUIDOS. Cada uno con hero DIFERENTE y support COMPLETAMENTE DIFERENTE. Los 4 supports deben ser FRASES DISTINTAS del transcript, no repetidas ni parecidas.\n\n' +
    'REGLA — support con verbo CONJUGADO (no infinitivo). MAL: "disfrutar el camino" (infinitivo). BIEN: "se lo llevan todos" (conjugado).\n\n' +
    'VERIFICACION FINAL (antes de responder): revisa que los 4 support son frases DISTINTAS entre si. Si dos escenas tienen el mismo support, cambia una a un momento diferente del video con una frase diferente.\n\n' +
    'Responde SOLO con JSON: {"scenes":[{"timestamp_ms":17100,"hero":"exito","support":"la comparacion es inevitable","theme":"comparacion, presion"}]}\n\n' +
    'Transcripcion:\n' + transcriptWithTimes
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Eres un editor de video experto en redes sociales. Detectas momentos impactantes y extraes texto LITERAL del guion. REGLAS CRITICAS: (1) El support debe ser texto copiado LITERALMENTE de la transcripcion — jamas inventas frases. (2) El hero NUNCA aparece en el support. (3) El support forma una idea completa que cierra. Respondes SOLO con JSON valido.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600, temperature: 0.3,
      }),
    })
    if (!res.ok) { console.error('[v153] analyzeTranscript error ' + res.status); return [] }
    const data: any = await res.json()
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}')
    const scenes: any[] = Array.isArray(parsed.scenes) ? parsed.scenes : []
    // Timestamp safeguard: if all timestamps < 500 (GPT returned seconds not ms), multiply by 1000
    const maxTs = scenes.reduce((m: number, s: any) => Math.max(m, s.timestamp_ms || 0), 0)
    if (maxTs < 500 && maxTs > 0) {
      console.warn('[v153] timestamps look like seconds, converting to ms (max was ' + maxTs + ')')
      for (const scene of scenes) { scene.timestamp_ms = Math.round((scene.timestamp_ms || 0) * 1000) }
    }
    // Hero length safeguard: truncate to 8 chars if GPT violated the limit
    for (const scene of scenes) {
      if (scene.hero && scene.hero.length > 8) {
        console.warn('[v153] hero "' + scene.hero + '" exceeds 8 chars, truncating')
        scene.hero = scene.hero.slice(0, 8)
      }
    }
    console.log('[v153] scenes raw: ' + JSON.stringify(scenes.map((s: any) => ({ hero: s.hero, ts: s.timestamp_ms, support: s.support }))))
    return scenes
  } catch(e) { console.error('[v153] analyzeTranscript failed:', String(e)); return [] }
}

// ── Validar y corregir support de cada escena (RF6) ──────────────────────────
// Fase 1: heurística rápida (palabras, última palabra, hero incluido)
// Fase 2: evaluación LLM de completitud semántica
// Fase 3: segunda llamada GPT con instrucción específica si falla
const DANGLING_ENDS = new Set([
  'de','en','con','para','por','que','a','y','o','pero','si','ni','e','u',
  'el','la','los','las','un','una','unos','unas',
  'al','del','sus','mi','tu','su','mis','tus',
  'desde','hasta','hacia','entre','sobre','bajo','ante','tras',
  'menos','mas','tambien','todavia','ya','asi','solo','aun','casi','incluso',
  'tanto','tan','muy','nunca','siempre','aunque','pues','entonces','cuando','donde',
  'ese','esa','esto','eso','aquel','aquella','algo','todo','cada','otro','otra',
  'mismo','misma','igual','similar','tal',
  'yo','el','ella','tu','nos','vos',  // pronombres sueltos sin predicado
])

function hasConjugatedVerb(support: string): boolean {
  const VERBS = /\b(es|son|est[aá]|estan|han|hay|tiene|tienen|va|van|hace|hacen|empieza[n]?|lleguen|llevan|compares|disfruta|pares|importar|llegar|viajado|empezamos|determina|vives|tienes|has|puede[n]?|llev[oó]|fue|ser[aá]s?)\b/i
  const ENDINGS = /\b\w+(as|amos|ais|an|es|en|emos|eis|aron|eron|ieron|ado|ido)\b/i
  // Infinitivos motivacionales válidos como frase completa (ej: "disfrutar el camino")
  const INFINITIVES = /\b(disfrutar|lograr|ganar|avanzar|luchar|creer|vivir|alcanzar|superar|comparar|aceptar|mejorar|trabajar|seguir|llegar|importar|esforzar|celebrar|valorar|empezar|cruzar|competir|enfrentar|superar|recordar|aprender|compartir|ayudar|construir|crecer)\b/i
  return VERBS.test(support) || ENDINGS.test(support) || INFINITIVES.test(support)
}

function supportHeuristicOk(support: string, hero: string): { ok: boolean; reason: string } {
  if (!support || !support.trim()) return { ok: false, reason: 'vacio' }
  const words = support.trim().split(/\s+/)
  if (words.length < 3) return { ok: false, reason: 'menos de 3 palabras (' + words.length + ')' }
  if (words.length > 6) return { ok: false, reason: 'demasiadas palabras (' + words.length + ')' }
  const last = words[words.length - 1].toLowerCase().replace(/[¿?!.,;:"']/g, '')
  if (DANGLING_ENDS.has(last)) return { ok: false, reason: 'termina en "' + last + '" (colgada)' }
  const h = hero.toLowerCase().trim()
  const heroRoot = h.length > 4 ? h.slice(0, h.length - 2) : h
  if (support.toLowerCase().includes(h) || (heroRoot.length > 3 && support.toLowerCase().includes(heroRoot))) {
    return { ok: false, reason: 'contiene el hero "' + h + '"' }
  }
  if (!hasConjugatedVerb(support)) {
    return { ok: false, reason: 'sin verbo conjugado (frase incompleta)' }
  }
  return { ok: true, reason: '' }
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?!.,;:"']/g, '').replace(/\s+/g, ' ').trim()
}

function isLiteralInTranscript(support: string, transcriptText: string): boolean {
  if (!support || !transcriptText) return false
  return normalizeForMatch(transcriptText).includes(normalizeForMatch(support))
}

// Devuelve el tiempo (segundos) en que el support aparece en la transcripción, o null si no se encuentra
function supportTime(support: string, wordTimes: Array<{word: string, start: number}>): number | null {
  const supportWords = normalizeForMatch(support).split(' ').filter(Boolean)
  if (supportWords.length === 0) return null
  const normWords = wordTimes.map(w => normalizeForMatch(w.word))
  for (let i = 0; i <= normWords.length - supportWords.length; i++) {
    const chunk = normWords.slice(i, i + supportWords.length)
    if (chunk.join(' ') === supportWords.join(' ')) return wordTimes[i].start
  }
  return null
}

// Búsqueda programática determinista: encuentra la secuencia de 3-5 palabras MÁS CERCANA
// al timestamp que pasa supportHeuristicOk + no está usada + dentro del ±windowSec
function findProgrammaticSupport(
  hero: string,
  timestampMs: number,
  wordTimes: Array<{word: string, start: number}>,
  usedSupports: Set<string>,
  windowSec: number = 25
): string | null {
  const tsSec = timestampMs / 1000
  // Recolectar todos los candidatos válidos dentro de la ventana
  const candidates: Array<{phrase: string, diff: number}> = []
  for (let i = 0; i < wordTimes.length; i++) {
    const phStart = wordTimes[i].start
    if (Math.abs(phStart - tsSec) > windowSec) continue
    for (let len = 3; len <= 5; len++) {
      if (i + len > wordTimes.length) break
      const chunk = wordTimes.slice(i, i + len)
      const phrase = chunk.map(w => w.word).join(' ')
      const key = phrase.toLowerCase().trim()
      if (usedSupports.has(key)) continue
      const check = supportHeuristicOk(phrase, hero)
      if (check.ok) {
        candidates.push({ phrase, diff: Math.abs(phStart - tsSec) })
      }
    }
  }
  // Ordenar por proximidad al timestamp (más cercano primero)
  candidates.sort((a, b) => a.diff - b.diff)
  if (candidates.length > 0) {
    const best = candidates[0]
    console.log('[v167] programmaticFix: "' + best.phrase + '" diff=' + best.diff.toFixed(1) + 's (' + candidates.length + ' candidatos)')
    return best.phrase
  }
  return null
}

// transcriptPlainText = solo palabras (para isLiteralInTranscript)
// transcriptWithTs = palabras con timestamps [Xs] (para el prompt del fix)
// wordTimes = array de {word, start} para verificar proximidad temporal (RF7)
async function validateAndFixScenes(
  scenes: any[],
  transcriptPlainText: string,
  transcriptWithTs: string,
  wordTimes: Array<{word: string, start: number}>
): Promise<any[]> {
  const fixed: any[] = []
  const usedSupports = new Set<string>()
  const usedHeroes = new Set<string>()
  for (const scene of scenes) {
    const heroKey = (scene.hero || '').toLowerCase().trim()
    const supportKey = (scene.support || '').toLowerCase().trim()
    const h1 = supportHeuristicOk(scene.support || '', scene.hero || '')
    let needsFix = !h1.ok
    let failReason = h1.reason
    if (!needsFix && usedHeroes.has(heroKey)) { needsFix = true; failReason = 'hero duplicado' }
    if (!needsFix && usedSupports.has(supportKey)) { needsFix = true; failReason = 'support duplicado' }
    if (!needsFix && !isLiteralInTranscript(scene.support || '', transcriptPlainText)) {
      needsFix = true; failReason = 'no es texto literal del guion'
    }
    // RF7: soporte debe decirse cerca del timestamp (±25s)
    if (!needsFix && wordTimes.length > 0) {
      const sTime = supportTime(scene.support || '', wordTimes)
      if (sTime !== null) {
        const diff = Math.abs(sTime - (scene.timestamp_ms || 0) / 1000)
        if (diff > 25) {
          needsFix = true
          failReason = `desfase temporal: soporte dicho en ${sTime.toFixed(1)}s pero escena en ${(scene.timestamp_ms/1000).toFixed(1)}s (diff=${diff.toFixed(1)}s)`
        }
      }
    }

    if (!needsFix) {
      usedSupports.add(supportKey)
      usedHeroes.add(heroKey)
      fixed.push(scene)
      continue
    }

    console.warn('[v159] FALLO ("' + scene.support + '"): ' + failReason + ' — corrigiendo con gpt-4o-mini')
    const ts = Math.round(scene.timestamp_ms / 1000)
    // Para duplicados buscamos en TODO el transcript (el problema no es el momento, es la frase)
    const isDupeFix = failReason === 'support duplicado'

    // Hasta 3 reintentos con temperatura creciente
    let resolvedScene = scene
    let resolved = false
    for (let attempt = 0; attempt < 3 && !resolved; attempt++) {
      const temp = 0.3 + attempt * 0.2
      const avoidSupports = Array.from(usedSupports).join('", "')
      try {
        const fixRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [{
              role: 'user',
              content:
                'Transcript (con tiempos en segundos):\n' + transcriptWithTs + '\n\n' +
                'Hero: "' + scene.hero + '" (segundo ' + ts + '). Fallo: ' + failReason + '\n' +
                (avoidSupports ? 'Supports YA USADOS (NO repetir): "' + avoidSupports + '"\n' : '') +
                '\nElige en el transcript un fragmento LITERAL de 3, 4 o 5 palabras CONSECUTIVAS que:\n' +
                '1. NO contenga "' + scene.hero + '" ni ninguna variacion (ni raiz de la palabra)\n' +
                '2. Sea una idea completa: tenga verbo conjugado O sea un infinitivo con sujeto/objeto\n' +
                '3. NO termine en preposicion, articulo, conjuncion, pronombre suelto ni adverbio relativo\n' +
                '   Prohibido al final: de en con para por que a y o pero si ni e u el la los las un una unos unas al del sus mi tu su mis tus desde hasta hacia entre sobre bajo ante tras menos mas tambien todavia ya asi solo aun casi incluso tanto tan muy nunca siempre aunque pues entonces cuando donde ese esa esto eso aquel aquella algo todo cada otro otra mismo misma igual similar tal yo el ella tu nos vos\n' +
                '   BUENAS: "es una competencia contra nosotros", "sin importar el puesto", "se lo llevan todos"\n' +
                '   MALAS: "todos no empezamos desde", "tiene exito y yo", "hayas logrado al menos"\n' +
                '4. DIFERENTE a los supports ya usados\n' +
                '5. Copia las palabras EXACTAS del transcript, sin cambiar ni una\n' +
                (isDupeFix
                  ? '6. Puede ser de CUALQUIER parte del transcript (no importa el segundo)\n\n'
                  : '6. Preferiblemente cerca del segundo ' + ts + ' (maximo +-30 segundos)\n\n') +
                'JSON: {"support":"frase"}'
            }],
            max_tokens: 80, temperature: temp,
          }),
        })
        if (fixRes.ok) {
          const fixData: any = await fixRes.json()
          const fixParsed = JSON.parse(fixData?.choices?.[0]?.message?.content || '{}')
          const newSupport = (fixParsed.support || '').trim()
          const newKey = newSupport.toLowerCase().trim()
          const h2 = supportHeuristicOk(newSupport, scene.hero || '')
          const notDupe = !usedSupports.has(newKey)
          const isLit = isLiteralInTranscript(newSupport, transcriptPlainText)
          let timeOk = true
          if (!isDupeFix && isLit && wordTimes.length > 0) {
            const sTime = supportTime(newSupport, wordTimes)
            if (sTime !== null) {
              const diff = Math.abs(sTime - (scene.timestamp_ms || 0) / 1000)
              if (diff > 30) { timeOk = false }
            }
          }
          if (h2.ok && notDupe && isLit && timeOk) {
            console.log('[v160] Fix OK (intento ' + (attempt+1) + '): "' + scene.support + '" -> "' + newSupport + '"')
            usedSupports.add(newKey)
            usedHeroes.add(heroKey)
            resolvedScene = { ...scene, support: newSupport }
            resolved = true
          } else {
            const whyFail = !isLit ? 'no literal' : (!h2.ok ? h2.reason : (!timeOk ? 'desfase temporal' : 'dupe'))
            console.warn('[v160] Fix intento ' + (attempt+1) + ' insuficiente ("' + newSupport + '") reason=' + whyFail)
          }
        }
      } catch(e) {
        console.error('[v160] fix error intento ' + (attempt+1) + ':', String(e))
      }
    }
    // Hero-swap fallback: si el único problema fue hero-en-support y el support en sí es válido,
    // intentar cambiar el hero en lugar del support
    if (!resolved && h1.reason.includes('contiene el hero')) {
      try {
        const swapRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content:
              'Support: "' + scene.support + '"\n' +
              'Hero actual: "' + scene.hero + '" (aparece dentro del support — problema)\n' +
              'Heroes ya usados: ' + Array.from(usedHeroes).join(', ') + '\n\n' +
              'Dame UNA sola palabra temática alternativa para usar como hero (max 8 caracteres, minusculas, sin tildes) que:\n' +
              '1. NO aparezca en el support\n' +
              '2. NO esté en la lista de heroes ya usados\n' +
              '3. Tenga relación temática con el momento\n\n' +
              'JSON: {"hero":"palabra"}'
            }],
            max_tokens: 40, temperature: 0.5,
          }),
        })
        if (swapRes.ok) {
          const swapData: any = await swapRes.json()
          const swapParsed = JSON.parse(swapData?.choices?.[0]?.message?.content || '{}')
          const newHero = (swapParsed.hero || '').toLowerCase().trim().slice(0, 8)
          if (newHero && !newHero.split('').every((c: string) => c === newHero[0])) {
            const checkWithNewHero = supportHeuristicOk(scene.support, newHero)
            const heroDupe = usedHeroes.has(newHero)
            if (checkWithNewHero.ok && !heroDupe) {
              console.log('[v162] Hero-swap OK: "' + scene.hero + '" -> "' + newHero + '" (support sin cambio)')
              usedSupports.add(supportKey)
              usedHeroes.add(newHero)
              resolvedScene = { ...scene, hero: newHero }
              resolved = true
            } else {
              console.warn('[v162] Hero-swap insuficiente: "' + newHero + '" reason=' + checkWithNewHero.reason)
            }
          }
        }
      } catch(e) {
        console.error('[v162] hero-swap error:', String(e))
      }
    }
    // Fallback programático: busca deterministicamente en el transcript
    if (!resolved && wordTimes.length > 0) {
      const windowSec = isDupeFix ? 9999 : 30  // duplicados buscan en todo el transcript
      const progSupport = findProgrammaticSupport(scene.hero, scene.timestamp_ms, wordTimes, usedSupports, windowSec)
      if (progSupport) {
        const progKey = progSupport.toLowerCase().trim()
        console.log('[v166] Fallback programático OK: "' + scene.support + '" -> "' + progSupport + '"')
        usedSupports.add(progKey)
        usedHeroes.add(heroKey)
        resolvedScene = { ...scene, support: progSupport }
        resolved = true
      }
    }
    if (!resolved) {
      console.warn('[v160] Sin fix valido para "' + scene.support + '" — conservando original')
      usedHeroes.add(heroKey)
    }
    fixed.push(resolvedScene)
  }
  return fixed
}


// ── Motor de tomas (v171) ─────────────────────────────────────────────────────
// Corte limpio del proyecto: sin intentos fallidos, arranques en falso ni muletillas.
// Normalmente ya está calculado (se arma al terminar de transcribir) y responde al instante.
/* ⚠️ `quiereSilencios`: el corte GUARDADO de un proyecto viejo no trae los silencios medidos, y
   sin ellos no se pueden quitar las pausas (se cae al método de las palabras, que es el que se
   comía la voz). Cuando la persona PIDE quitar pausas y el corte no los trae, se vuelve a
   calcular una vez. Solo entonces: recalcular cuesta una llamada a la IA. */
/* ⚠️ EL MAPA DE VOZ (24-sep). Dice dónde hay VOZ, no solo dónde hay sonido — que es lo que
   decían los silencios, y por eso un chasquido de labios contaba como palabra. Lo mide la Lambda
   siguiendo la onda; aquí solo se pide. Es idempotente: el clip que ya lo tiene no se vuelve a
   medir, y si falla se sigue con los silencios de siempre. */
async function pedirMapaVoz(projectId: string): Promise<void> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/mapa-voz`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })
    const d: any = await r.json().catch(() => null)
    console.log(`[v225] mapa de voz: ${JSON.stringify(d).slice(0, 180)}`)
  } catch (e) {
    console.warn('[v225] mapa-voz no contestó (se sigue con los silencios): ' + String(e))
  }
}

/* v228: lo que F1 necesita de cada clip además del corte: de dónde cortar el original y a qué tamaño
   van todos. Y se deja guardado en la fila del render (`cortes_json`) para poder rehacer ESE video del
   original más tarde, idéntico, sin IA. */
async function cortesParaF1(cuts: any[], renderId: string, params: Record<string, unknown>): Promise<any[]> {
  const ids = [...new Set(cuts.map((c: any) => c.clipId).filter((x: any) => x && ES_UUID.test(String(x))))]
  const porClip = new Map<string, any>()
  if (ids.length) {
    try {
      const filas: any = await db(`/clips?id=in.(${ids.join(',')})&select=id,storage_path,resolution,fps`)
      for (const f of (Array.isArray(filas) ? filas : [])) porClip.set(f.id, f)
    } catch (e) { console.warn('[v228] no se pudieron leer los originales de los clips: ' + String(e)) }
  }
  const listos = cuts.map((c: any) => {
    const f = porClip.get(c.clipId)
    return f ? { ...c, storage_path: f.storage_path || null, resolution: f.resolution || null, fps: f.fps || null } : c
  })
  try { await db(`/renders?id=eq.${renderId}`, 'PATCH', { cortes_json: { cuts: listos, ...params } }) } catch (_) { /* no bloquea */ }
  return listos
}

/* ══ PANTALLAS (24-sep) ══ las grabaciones de pantalla que la persona pone en su guion. La misma revision
   que `limpiarPantallas` de graficos.js: solo direcciones de clips/pantallas/ y textos cortos. */
const URL_PANTALLA = /^https:\/\/[a-z0-9.-]+\.amazonaws\.com\/clips\/pantallas\/[0-9a-f-]{36}\.(mp4|png)$/
function limpiarPantallasSrv(v: unknown): any[] {
  const txt = (x: unknown, k: number) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, k)
  return (Array.isArray(v) ? v : []).map((x: any) => {
    if (!x || typeof x !== 'object') return null
    const d = Math.round(Number(x.desde)), h = Math.round(Number(x.hasta))
    if (!Number.isFinite(d) || !Number.isFinite(h) || d < 0 || h < d || !URL_PANTALLA.test(String(x.url || ''))) return null
    return { id: txt(x.id, 40), desde: d, hasta: h, forma: x.forma === 'profundo' ? 'profundo' : 'partida',
             url: String(x.url), tipo: x.tipo === 'imagen' ? 'imagen' : 'video', tapa: txt(x.tapa, 300),
             ancho: Number(x.ancho) || 1920, alto: Number(x.alto) || 1080, dur: Number(x.dur) || 0, inicio: Math.max(0, Number(x.inicio) || 0),
             titulo: txt(x.titulo, 60), etiqueta: txt(x.etiqueta, 30), dir: txt(x.dir, 60),
             // (24-sep) su color: uno de la lista de Gráficos o #RRGGBB
             color: /^(cherry|dorado|oceano|lima|coral|lila|crema)$/.test(String(x.color || '')) ? String(x.color)
               : (/^#[0-9a-fA-F]{6}$/.test(String(x.color || '')) ? String(x.color).toLowerCase() : '') }
  }).filter(Boolean).slice(0, 30) as any[]
}
async function pantallasDelProyecto(projectId: string): Promise<any[]> {
  try {
    const f: any = await db(`/projects?id=eq.${projectId}&select=pantallas`)
    return limpiarPantallasSrv(Array.isArray(f) ? f[0]?.pantallas : null)
  } catch (_) { return [] }
}
/* Las deja en el subtitle_config del render recien creado (lo lee el ensamblador al final) */
async function ponerPantallas(renderId: string, pantallas: any[]): Promise<void> {
  if (!renderId || !pantallas.length) return
  try {
    const f0: any = await db(`/renders?id=eq.${renderId}&select=subtitle_config`)
    const cfg0 = ((Array.isArray(f0) ? f0[0]?.subtitle_config : null) ?? {}) as Record<string, unknown>
    await db(`/renders?id=eq.${renderId}`, 'PATCH', { subtitle_config: { ...cfg0, pantallas } })
    console.log(`[v230] ${pantallas.length} pantalla(s) en ${renderId.slice(0, 8)}`)
  } catch (e) { console.warn('[v230] no se pudieron poner las pantallas: ' + String(e)) }
}

async function corteLimpio(projectId: string, quiereSilencios = false): Promise<any | null> {
  let rehacer = false;
  for (let intento = 0; intento < 20; intento++) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/motor-tomas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, guardar: true, forzar: rehacer }),
      })
      const d: any = await r.json().catch(() => null)
      if (r.ok && d?.ok && Array.isArray(d.cuts) && d.cuts.length) {
        /* Si se piden los silencios y el corte guardado no los trae, se rehace UNA vez. */
        /* ⚠️ SE PIDEN LOS BLOQUES, NO «BLOQUES O SILENCIOS». El corte guardado ya trae
           silencios de antes, así que con un «o» la condición nunca se cumple, el corte no se
           rehace y los bloques no llegan — y el arreglo parece que no funciona. Pasó: Sergio
           generó tres veces y salió igual. */
        if (quiereSilencios && !rehacer && !d.cuts.some((c: any) => Array.isArray(c?.bloques) && c.bloques.length)) {
          console.log('[v226] el corte guardado no trae los bloques de voz: se rehace')
          rehacer = true
          continue
        }
        console.log(`[v171] motor-tomas: ${d.al_dia ? 'corte guardado' : 'corte nuevo'} | ${d.cuts.length} cortes | ${d.total_s}s`)
        return d
      }
      if (d?.en_proceso) { await new Promise((res) => setTimeout(res, 5000)); continue }
      console.warn(`[v171] motor-tomas sin corte: ${r.status} ${JSON.stringify(d).slice(0, 200)}`)
      break
    } catch (e) {
      console.warn('[v171] motor-tomas error: ' + String(e))
      break
    }
  }
  // Respaldo: el último corte que el motor dejó guardado
  try {
    const filas: any = await db(`/edit_recipes?project_id=eq.${projectId}&select=recipe,generated_by&order=created_at.desc&limit=1`)
    const rec = Array.isArray(filas) ? filas[0] : null
    if (rec && String(rec.generated_by || '').startsWith('motor-tomas') && rec.recipe?.cuts?.length) {
      console.log('[v171] usando el último corte guardado del motor')
      return { cuts: rec.recipe.cuts, total_s: rec.recipe.total_duration_sec, transcripcion: rec.recipe.transcripcion || [] }
    }
  } catch (_) { /* sin respaldo */ }
  return null
}

async function fetchFaithfulWords(clipIds: string[]): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>()
  if (clipIds.length === 0) return map
  try {
    const rows: any = await db(
      `/transcriptions?clip_id=in.(${clipIds.join(',')})&select=clip_id,words`
    )
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row.clip_id && Array.isArray(row.words) && row.words.length > 0) {
          map.set(row.clip_id, row.words)
        }
      }
    }
    console.log(`[v153] fetchFaithfulWords: ${map.size}/${clipIds.length} clips con transcripción`)
  } catch(e) {
    console.error('[v153] fetchFaithfulWords error:', String(e))
  }
  return map
}

// ── Construir palabras fieles en espacio de salida (output time) ──────────────
// Para cada cut, toma sus palabras fieles del clip (tiempo clip) y las mapea
// al espacio de salida del video ensamblado (output time).
// Si un clip no tiene transcripción fiel, usa las palabras del recipe.
function buildFaithfulOutputWords(clipsPayload: any[], faithfulMap: Map<string, any[]>): any[] {
  const result: any[] = []
  let outputCursor = 0
  for (const cut of clipsPayload) {
    const cutOutStart = outputCursor
    outputCursor += cut.duration
    const clipWords: any[] = faithfulMap.get(cut.clipId) || []
    if (clipWords.length === 0) {
      // Sin transcripción fiel: usar palabras del recipe (ya están en output time)
      result.push(...(cut.words || []))
      continue
    }
    // Filtrar palabras fieles que caen dentro del rango de este cut (tiempo clip)
    const BUF = 0.15
    const inRange = clipWords.filter((w: any) =>
      Number(w.end) >= cut.startTime - BUF &&
      Number(w.start) <= cut.endTime + BUF
    )
    // Mapear de tiempo clip → tiempo output
    for (const w of inRange) {
      const outStart = cutOutStart + (Number(w.start) - cut.startTime)
      const outEnd   = cutOutStart + (Number(w.end)   - cut.startTime)
      result.push({
        word:  w.word,
        start: Math.max(cutOutStart, Math.min(outStart, cutOutStart + cut.duration)),
        end:   Math.max(cutOutStart, Math.min(outEnd,   cutOutStart + cut.duration)),
      })
    }
  }
  return result
}

// ── Limpieza de repeticiones y muletillas (GPT-4o) ────────────────────────────
// Recibe: clipsPayload (cortes originales), wordsForDetection (palabras fieles
// en output time para que GPT-4o detecte repeticiones).
/* Repeticiones LITERALES, sin IA (20-sep). Cuando alguien se traba repite la frase igual hasta que
   le sale: «Segun mi poca y traumatica experiencia... Segun mi poca y traumatica experiencia...
   Segun mi poca y traumatica experiencia, no me gusta...». La IA acierta el sitio pero falla el
   borde por una palabra y deja huerfanas — a Sergio le quedo un «experiencia» suelto. Contar no
   falla: si una secuencia se repite JUSTO DESPUES, la primera copia sobra. */
function repeticionesLiterales(words: any[]): Set<number> {
  const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '')
  const fuera = new Set<number>()
  const n = words.length
  let i = 0
  while (i < n) {
    let mejor = 0
    const tope = Math.min(14, Math.floor((n - i) / 2))
    for (let L = tope; L >= 3; L--) {            // la repetición más larga primero
      let igual = true
      for (let k = 0; k < L; k++) {
        const a = norm(words[i + k]?.word), b = norm(words[i + L + k]?.word)
        if (!a || a !== b) { igual = false; break }
      }
      if (igual) { mejor = L; break }
    }
    if (mejor) { for (let k = 0; k < mejor; k++) fuera.add(i + k); i += mejor }
    else i++
  }
  return fuera
}

// Devuelve: cleanWords (palabras filtradas + tiempos recalculados para F2/F3)
//           cleanCuts  (cortes partidos para excluir segmentos malos, para F1)
// Si falla: devuelve los originales sin modificar.
async function cleanTranscription(
  clipsPayload: any[],
  wordsForDetection: any[]
): Promise<{ cleanWords: any[]; cleanCuts: any[]; removedSet: Set<number> }> {
  const fallback = { cleanWords: wordsForDetection, cleanCuts: clipsPayload, removedSet: new Set<number>() }
  if (!OPENAI_API_KEY || wordsForDetection.length === 0) return fallback

  const transcriptText = wordsForDetection
    .map((w: any, i: number) => `${i}\t[${Number(w.start).toFixed(2)}s]\t${w.word}`)
    .join('\n')
    .slice(0, 7000)

  const systemPrompt =
    'Eres un editor de video experto. Analizas transcripciones e identificas SOLO dos cosas para eliminar:\n' +
    '1. REPETICIONES/ERRORES: cuando el hablante intenta la misma frase varias veces (2 o 3 intentos). ' +
    'Se conserva SOLO el intento más completo y coherente. Los intentos fallidos/incompletos se eliminan. ' +
    'IMPORTANTE: una frase es repetición solo si aparece múltiples veces seguidas — no elimines nada que aparezca una sola vez.\n' +
    '2. RELLENO PURO SIN SENTIDO: únicamente sonidos vacíos sin contenido ("ehhh", "mmm", "uhh", "ahh"). ' +
    'Solo estos. Nada más.\n\n' +
    'NUNCA eliminas:\n' +
    '- Palabras del guión aunque suenen informales: "ajá", "aja", "ah", "ok", "oye".\n' +
    '- Conectores del discurso: "este", "esto", "o sea", "pues", "bueno", "entonces", "o sea que", "es que".\n' +
    '- Ninguna palabra que aparezca una sola vez, aunque parezca muletilla.\n' +
    '- Ningún fragmento que esté bien dicho (aunque sea breve).\n\n' +
    'Respondes SOLO con JSON válido.'

  const userPrompt =
    'Analiza la transcripción e indica qué rangos eliminar.\n\n' +
    'Formato: índice[TAB][tiempo][TAB]palabra\n' +
    transcriptText + '\n\n' +
    'JSON:\n{"removals":[{"reason":"repeat_attempt","startIndex":N,"endIndex":M},{"reason":"filler","startIndex":N,"endIndex":N}]}\n' +
    'Sin nada que eliminar: {"removals":[]}'

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000, temperature: 0.1,
      }),
    })
    if (!res.ok) {
      console.error('[v153] cleanTranscription error ' + res.status)
      return fallback
    }
    const data: any = await res.json()
    const content = data?.choices?.[0]?.message?.content || '{"removals":[]}'
    const parsed = JSON.parse(content)
    const removals: Array<{ reason: string; startIndex: number; endIndex: number }> =
      Array.isArray(parsed.removals) ? parsed.removals : []

    console.log(`[v153] cleanTranscription: ${removals.length} removals`)
    for (const r of removals) {
      const preview = wordsForDetection
        .slice(Math.max(0, r.startIndex), Math.min(wordsForDetection.length, r.endIndex + 1))
        .map((w: any) => w.word).join(' ')
      console.log(`  [${r.reason}] idx ${r.startIndex}-${r.endIndex}: "${preview.slice(0, 80)}"`)
    }
    // (20-sep) aunque la IA no marque nada, las repeticiones literales se quitan igual
    if (removals.length === 0 && repeticionesLiterales(wordsForDetection).size === 0) {
      return { cleanWords: wordsForDetection, cleanCuts: clipsPayload, removedSet: new Set<number>() }
    }

    // Índices a eliminar
    const removeSet = new Set<number>()
    for (const r of removals) {
      for (let i = Math.max(0, r.startIndex); i <= Math.min(wordsForDetection.length - 1, r.endIndex); i++) {
        removeSet.add(i)
      }
    }
    /* Y las repeticiones literales, contadas (20-sep): pillan lo que a la IA se le escapa por el
       borde. Se suman a lo suyo — nunca quitan de menos. */
    const literales = repeticionesLiterales(wordsForDetection)
    let extra = 0
    for (const i of literales) if (!removeSet.has(i)) { removeSet.add(i); extra++ }
    if (extra) console.log(`[repeticiones] ${literales.size} literales, ${extra} que la IA no había marcado`)

    /* Rangos de tiempo a eliminar. Se arman desde removeSet (la IA MÁS las literales), no solo desde
       lo que dijo la IA: si no, el video se cortaría distinto de como suenan las palabras. */
    const rawRanges: Array<{ start: number; end: number }> = []
    const orden = [...removeSet].sort((a, b) => a - b)
    let ini: number | null = null, fin: number | null = null
    for (const i of orden) {
      if (ini === null) { ini = i; fin = i; continue }
      if (i === (fin as number) + 1) { fin = i; continue }
      rawRanges.push({ start: Number(wordsForDetection[ini]?.start ?? 0), end: Number(wordsForDetection[fin as number]?.end ?? 0) })
      ini = i; fin = i
    }
    if (ini !== null) rawRanges.push({ start: Number(wordsForDetection[ini]?.start ?? 0), end: Number(wordsForDetection[fin as number]?.end ?? 0) })
    for (let i = rawRanges.length - 1; i >= 0; i--) if (!(rawRanges[i].end > rawRanges[i].start)) rawRanges.splice(i, 1)
    rawRanges.sort((a, b) => a.start - b.start)
    const merged: Array<{ start: number; end: number }> = []
    for (const rng of rawRanges) {
      const last = merged[merged.length - 1]
      if (!last || rng.start > last.end) merged.push({ ...rng })
      else last.end = Math.max(last.end, rng.end)
    }

    // Función: restar duración eliminada antes de T
    function remapTime(t: number): number {
      let removed = 0
      for (const rng of merged) {
        if (rng.end <= t) removed += rng.end - rng.start
        else if (rng.start < t) { removed += t - rng.start; break }
      }
      return Math.max(0, t - removed)
    }

    // Palabras limpias con tiempos recalculados (para F2/F3)
    const cleanWords = wordsForDetection
      .filter((_: any, i: number) => !removeSet.has(i))
      .map((w: any) => ({ ...w, start: remapTime(Number(w.start)), end: remapTime(Number(w.end)) }))

    // Cortes limpios para F1: partir cuts donde hay eliminaciones
    const MARGIN = 0.05
    const cleanCuts: any[] = []
    let cursor = 0
    for (const cut of clipsPayload) {
      const cutOutStart = cursor
      const cutOutEnd   = cursor + cut.duration
      cursor = cutOutEnd
      const overlaps = merged.filter(r => r.start < cutOutEnd && r.end > cutOutStart)
      if (overlaps.length === 0) { cleanCuts.push(cut); continue }
      const toOrig = (outT: number) => cut.startTime + (outT - cutOutStart)
      let segCursor = cutOutStart
      for (const r of overlaps) {
        const rStart = Math.max(r.start, cutOutStart)
        const rEnd   = Math.min(r.end,   cutOutEnd)
        if (segCursor < rStart) {
          const oStart = Math.max(cut.startTime, toOrig(segCursor) - MARGIN)
          const oEnd   = Math.min(cut.endTime,   toOrig(rStart)   + MARGIN)
          if (oEnd - oStart > 0.08) cleanCuts.push({ ...cut, startTime: oStart, endTime: oEnd, duration: oEnd - oStart, words: [], text: '' })
        }
        segCursor = rEnd
      }
      if (segCursor < cutOutEnd) {
        const oStart = Math.max(cut.startTime, toOrig(segCursor) - MARGIN)
        const oEnd   = cut.endTime
        if (oEnd - oStart > 0.08) cleanCuts.push({ ...cut, startTime: oStart, endTime: oEnd, duration: oEnd - oStart, words: [], text: '' })
      }
    }

    console.log(`[v153] Limpieza: cuts ${clipsPayload.length}→${cleanCuts.length} | words ${wordsForDetection.length}→${cleanWords.length}`)
    return { cleanWords, cleanCuts, removedSet }

  } catch(e) {
    console.error('[v153] cleanTranscription excepción — usando originales:', String(e))
    return fallback
  }
}


// ── Plantillas de subtítulos (v173): frases cortas + palabra clave de cada una ──────────────────────
// La IA divide lo dicho en frases para pantalla y marca la palabra que carga el sentido.
// Si no responde a tiempo, F2 arma las frases solo (por pausas y longitud); el video nunca se detiene.
const SISTEMA_FRASES =
  'Eres editor de subtítulos para videos verticales de creadores de contenido. Recibes lo que dice la persona dos veces: ' +
  'primero el TEXTO seguido (léelo como un párrafo para entender dónde empieza y termina cada oración) y después las mismas ' +
  'palabras numeradas (⏸ marca una pausa larga y · una pausa corta: la persona habla rápido, y una pausa corta suele ser el ' +
  'cambio de oración). Divídelas en frases cortas para mostrar en pantalla y marca en cada una su palabra clave.\n' +
  'Reglas:\n' +
  '1. Cubre TODAS las palabras en orden, sin saltar ni repetir: cada frase empieza justo después de la anterior y la última termina en la última palabra.\n' +
  '2. Cada frase tiene de 1 a 6 palabras (lo ideal, 3 a 5) y corta donde se respira o cambia la idea. Nunca termines una frase en ' +
  'artículo, preposición o conjunción (de, la, el, que, un, y, a, en, por, para...). Una palabra sola solo si es una exclamación o una idea fuerte.\n' +
  '3. clave_desde..clave_hasta: de 1 a 3 palabras seguidas DENTRO de la frase que cargan el sentido o la emoción (sustantivo, verbo fuerte, ' +
  'número, nombre, adjetivo potente). Nunca una palabra vacía (de, la, que, y, es, un, no...).\n' +
  '4. cierra = true si la frase termina una oración afirmativa o exclamativa (llevaría punto final); false si la oración sigue o si es pregunta.\n' +
  '5. La transcripción casi no trae puntos: detecta tú por el sentido dónde termina cada oración y nunca juntes en una frase el final de una oración con el comienzo de la siguiente.\n' +
  'Ejemplo: «si a tus veinticinco años no vives solo no tienes carro» → [si a tus VEINTICINCO AÑOS] [no vives SOLO] [no tienes CARRO].\n' +
  '6. correcciones: la transcripción automática a veces oye mal una palabra (p. ej. «pracasaste» en vez de «fracasaste»). ' +
  'Lista SOLO las palabras que claramente están mal oídas (no existen o no tienen sentido en la frase), con su número i y la palabra correcta. ' +
  'Siempre UNA palabra por UNA palabra: nunca juntes, separes, agregues ni quites palabras. ' +
  'No corrijas jerga, anglicismos, nombres propios, marcas, muletillas ni la forma de hablar de la persona. Si no hay errores, lista vacía.\n' +
  '7. impacto = true solo en las frases MÁS llamativas, las que irán como título grande: el gancho del inicio, afirmaciones fuertes, ' +
  'cifras, preguntas que enganchan y remates. El pedido dice cuántas marcar; repártelas a lo largo del video y nunca dos seguidas. ' +
  'Si el pedido dice que no se usan, impacto = false en todas.\n' +
  '8. Una frase de impacto sale SOLA en pantalla grande, como un titular: tiene que tener sentido completo leída sin nada más. ' +
  'Empieza donde empieza la idea (nunca a mitad de una oración ni con la cola de la idea anterior) y termina donde termina la idea ' +
  '(nunca con la primera palabra de la oración siguiente). De 2 a 6 palabras. Si la idea es más larga, marca como impacto la parte ' +
  'que se entiende sola, o escoge otra frase. Antes de marcarla, léela sola: si suena cortada o sin lógica, arréglala.\n' +
  'Ejemplos: «¡perdiste todo tu dinero treinta días después vuelves a empezar» → [¡PERDISTE todo tu dinero] (impacto) ' +
  '[treinta DÍAS después] [vuelves a EMPEZAR]. MAL: [¡perdiste todo tu dinero treinta] (se lleva el comienzo de la oración siguiente). ' +
  '«hay gente que arranca a mil metros de la línea y le toca correr el doble» → MAL como impacto: [de la línea y le toca correr] ' +
  '(empieza a mitad de la idea); BIEN: [le toca correr el DOBLE] (impacto), que se entiende sola.\n' +
  'Responde solo el JSON.'

const ESQUEMA_FRASES = {
  name: 'frases_subtitulos',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['frases', 'correcciones'],
    properties: {
      frases: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['desde', 'hasta', 'clave_desde', 'clave_hasta', 'cierra', 'impacto'],
          properties: {
            desde: { type: 'integer' }, hasta: { type: 'integer' },
            clave_desde: { type: 'integer' }, clave_hasta: { type: 'integer' },
            cierra: { type: 'boolean' },
            impacto: { type: 'boolean' },
          },
        },
      },
      correcciones: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['i', 'palabra'],
          properties: { i: { type: 'integer' }, palabra: { type: 'string' } },
        },
      },
    },
  },
}

// ── Palabras mal oídas (v176): la IA propone y aquí se filtra; el editor puede corregir a mano ──
// Solo cambia el texto de UNA palabra: nunca sus tiempos ni cuántas hay (los cortes y subtítulos no se mueven).
// Cada palabra cambiada guarda `original` para que el editor la muestre marcada.
function distanciaTexto(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = arriba
    }
  }
  return fila[b.length]
}

function aplicarCorrecciones(words: any[], cambios: { i: number, palabra: string }[], origen: 'ia' | 'editor'): number {
  let hechas = 0
  for (const c of cambios || []) {
    const i = Number(c?.i)
    const nueva = String(c?.palabra ?? '').trim()
    if (!Number.isInteger(i) || i < 0 || i >= words.length || !nueva || nueva.length > 40) continue
    const w = words[i]
    const antes = String(w.word ?? '')
    const original = typeof w.original === 'string' ? w.original : antes
    if (origen === 'editor') {
      // Lo que escribió la persona manda (si vuelve al texto original, deja de estar marcada)
      const { original: _quitar, ...resto } = w
      words[i] = nueva === original ? { ...resto, word: original } : { ...w, word: nueva, original }
      if (nueva !== antes) hechas++
      continue
    }
    if (/\s/.test(nueva)) continue
    const partes = antes.match(/^([¡¿"«“(]*)(.*?)([.,;:!?…"»”)]*)$/) || ['', '', antes, '']
    const cuerpo = partes[2]
    let limpia = nueva.replace(/^[¡¿"«“(]+/, '').replace(/[.,;:!?…"»”)]+$/, '')
    if (!limpia || !cuerpo || limpia.toLocaleLowerCase('es') === cuerpo.toLocaleLowerCase('es')) continue
    // Una corrección de oído cambia pocas letras; si cambia media palabra o más, la IA estaría reescribiendo
    if (distanciaTexto(limpia.toLocaleLowerCase('es'), cuerpo.toLocaleLowerCase('es')) > Math.max(2, Math.ceil(cuerpo.length * 0.5))) continue
    limpia = /^[A-ZÁÉÍÓÚÑ]/.test(cuerpo) ? limpia.charAt(0).toLocaleUpperCase('es') + limpia.slice(1) : limpia.charAt(0).toLocaleLowerCase('es') + limpia.slice(1)
    words[i] = { ...w, word: partes[1] + limpia + partes[3], original }
    hechas++
  }
  return hechas
}

const ESFUERZO_FRASES = 'low'
async function frasesDeBloque(words: any[], base: number, impactoCada: number | null, esfuerzo = ESFUERZO_FRASES): Promise<{ frases: any[], correcciones: any[] } | null> {
  // v187: la pausa va ANTES de la palabra (ahí cambia la oración) y también las cortas (· ≥ 0,1 s): quien habla rápido
  // casi no hace pausas largas, y esa es la única pista de dónde termina la oración
  const marcaPausa = (k: number) => {
    const prev = words[k - 1]
    const pausa = prev ? Number(words[k].start || 0) - Number(prev.end || prev.start || 0) : 0
    return pausa >= 0.4 ? '⏸ ' : pausa >= 0.1 ? '· ' : ''
  }
  const lineas = words.map((w: any, k: number) => `${base + k} ${marcaPausa(k)}${String(w.word || '').trim()}`).join('\n')
  const texto = words.map((w: any, k: number) => marcaPausa(k) + String(w.word || '').trim()).join(' ')
  // Cuántas frases de impacto pide este bloque (una cada `impactoCada` segundos)
  const segundos = words.length ? Number(words[words.length - 1].end || 0) - Number(words[0].start || 0) : 0
  const pedidoImpacto = impactoCada
    ? `Frases de impacto: marca unas ${Math.max(1, Math.round(segundos / impactoCada))} en este bloque (${Math.round(segundos)} s).`
    : 'Frases de impacto: no se usan (impacto = false en todas).'
  const usuario = `${pedidoImpacto}\nTexto seguido:\n${texto}\n\nPalabras ${base} a ${base + words.length - 1}:\n${lineas}`
  for (const modelo of ['gpt-5-mini', 'gpt-4o-mini']) {
    const cuerpo: Record<string, unknown> = {
      model: modelo,
      messages: [{ role: 'system', content: SISTEMA_FRASES }, { role: 'user', content: usuario }],
      response_format: { type: 'json_schema', json_schema: ESQUEMA_FRASES },
    }
    // v188: el esfuerzo se puede pedir para probar; por defecto «low» (con «medium» dejaba palabras sin frase)
    if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = esfuerzo; cuerpo.max_completion_tokens = 30000 }
    else { cuerpo.temperature = 0.2; cuerpo.max_tokens = 12000 }
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), 120000)
    try {
      const t0 = Date.now()
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: control.signal,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      if (!r.ok) { console.warn(`[v173] frases ${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      const data = await r.json()
      const respuesta = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
      const lista = respuesta?.frases
      if (!Array.isArray(lista) || !lista.length) { console.warn(`[v173] frases ${modelo}: respuesta vacía`); continue }
      const correcciones = Array.isArray(respuesta?.correcciones) ? respuesta.correcciones : []
      console.log(`[v173] frases ${modelo}: ${lista.length} frases, ${correcciones.length} correcciones propuestas, ${words.length} palabras en ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      return {
        frases: lista.map((f: any) => ({ desde: f.desde, hasta: f.hasta, clave: [f.clave_desde, f.clave_hasta], cierra: !!f.cierra, impacto: !!impactoCada && !!f.impacto })),
        correcciones,
      }
    } catch (e) {
      console.warn(`[v173] frases ${modelo}: ${String(e).slice(0, 120)}`)
    } finally {
      clearTimeout(reloj)
    }
  }
  return null
}

// ── Titulares de impacto (v189): una llamada aparte, dedicada solo a escogerlos ──
// Con la IA de frases haciendo las dos cosas a la vez salían titulares cortados («¡fracasaste como ser humano veinticinco»,
// «y tú empiezas a cien», «todos los que lleguen»). Esta ve el texto entero y solo responde unos pocos tramos.
const SISTEMA_TITULARES =
  'Eres editor de videos verticales para redes. Recibes lo que dice una persona: primero el TEXTO seguido y después las mismas ' +
  'palabras numeradas (⏸ marca una pausa larga y · una corta). Escoge los TITULARES de impacto: frases que saldrán SOLAS, ' +
  'en letra grande, en la pantalla.\n' +
  'Reglas:\n' +
  '1. Cada titular es un tramo SEGUIDO de palabras (desde..hasta) de 2 a 7 palabras que se entiende solo, como el titular de un ' +
  'periódico: una idea completa.\n' +
  '2. Empieza donde empieza la idea: nunca a mitad de una oración ni con la cola de la idea anterior.\n' +
  '3. Termina donde termina la idea: nunca separes una cifra de lo que cuenta («cien metros», «veinticinco años»), ni un verbo ' +
  'de lo que necesita para tener sentido, ni te lleves la primera palabra de la oración siguiente. Una pregunta va completa ' +
  '(nunca «¿por qué nadie te» sin el resto); si es muy larga, escoge otra frase.\n' +
  '4. Escoge lo más llamativo: el gancho del inicio, afirmaciones fuertes, cifras, preguntas que enganchan y remates. ' +
  'Repártelos a lo largo del video y nunca dos seguidos.\n' +
  '5. clave_desde..clave_hasta: 1 o 2 palabras seguidas DENTRO del titular que cargan el sentido (nunca de, la, que, y, es, un, no...).\n' +
  '6. cierra = true si el titular termina una oración afirmativa o exclamativa.\n' +
  '7. Nunca dejes por fuera una negación ni el artículo de la primera palabra: si la idea es «no hay nada que hacer», el titular ' +
  'empieza en «no» (sin él dice lo contrario); si es «el precio sube», empieza en «el».\n' +
  '8. Antes de escoger uno, léelo solo: si suena cortado o sin lógica, escoge otro tramo o ajusta dónde empieza y termina.\n' +
  'Ejemplos (de otro video): «¡perdiste todo tu dinero treinta días después vuelves a empezar» → BIEN [¡PERDISTE todo tu dinero]; ' +
  'MAL [¡perdiste todo tu dinero treinta]. «yo corrí diez kilómetros sin parar y al final me caí» → BIEN [corrí diez KILÓMETROS sin parar]; ' +
  'MAL [y yo corrí diez] (separa la cifra). «el trofeo se lo lleva cualquiera que lo intente de verdad» → BIEN [el TROFEO se lo ' +
  'lleva cualquiera]; MAL [que lo intente de verdad] (es la cola de la idea).\n' +
  'Responde solo el JSON.'

const ESQUEMA_TITULARES = {
  name: 'titulares_impacto',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['titulares'],
    properties: {
      titulares: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['desde', 'hasta', 'clave_desde', 'clave_hasta', 'cierra'],
          properties: {
            desde: { type: 'integer' }, hasta: { type: 'integer' },
            clave_desde: { type: 'integer' }, clave_hasta: { type: 'integer' },
            cierra: { type: 'boolean' },
          },
        },
      },
    },
  },
}

const ESFUERZO_TITULARES = 'medium'
async function titularesConIA(words: any[], impactoCada: number, esfuerzo = ESFUERZO_TITULARES): Promise<any[] | null> {
  const marcaPausa = (k: number) => {
    const prev = words[k - 1]
    const pausa = prev ? Number(words[k].start || 0) - Number(prev.end || prev.start || 0) : 0
    return pausa >= 0.4 ? '⏸ ' : pausa >= 0.1 ? '· ' : ''
  }
  const texto = words.map((w: any, k: number) => marcaPausa(k) + String(w.word || '').trim()).join(' ')
  const lineas = words.map((w: any, k: number) => `${k} ${marcaPausa(k)}${String(w.word || '').trim()}`).join('\n')
  const segundos = words.length ? Number(words[words.length - 1].end || 0) - Number(words[0].start || 0) : 0
  const cuantos = Math.max(1, Math.round(segundos / impactoCada))
  const usuario = `Escoge unos ${cuantos} titulares (el video dura ${Math.round(segundos)} s).\nTexto seguido:\n${texto}\n\nPalabras 0 a ${words.length - 1}:\n${lineas}`
  for (const modelo of ['gpt-5-mini', 'gpt-4o-mini']) {
    const cuerpo: Record<string, unknown> = {
      model: modelo,
      messages: [{ role: 'system', content: SISTEMA_TITULARES }, { role: 'user', content: usuario }],
      response_format: { type: 'json_schema', json_schema: ESQUEMA_TITULARES },
    }
    if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = esfuerzo; cuerpo.max_completion_tokens = 30000 }
    else { cuerpo.temperature = 0.2; cuerpo.max_tokens = 4000 }
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), 120000)
    try {
      const t0 = Date.now()
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: control.signal,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      if (!r.ok) { console.warn(`[v189] titulares ${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      const data = await r.json()
      const lista = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')?.titulares
      if (!Array.isArray(lista)) { console.warn(`[v189] titulares ${modelo}: respuesta vacía`); continue }
      console.log(`[v189] titulares ${modelo} («${esfuerzo}»): ${lista.length} de ${cuantos} pedidos en ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      return lista
    } catch (e) {
      console.warn(`[v189] titulares ${modelo}: ${String(e).slice(0, 120)}`)
    } finally {
      clearTimeout(reloj)
    }
  }
  return null
}

// Los titulares entran en su sitio: las frases que tocan se recortan alrededor (el repaso de F2 junta lo que quede suelto).
// Se descartan los que no sirven: fuera de rango, de más de 7 palabras, cruzados o pegados a otro titular.
const PEGADAS_AL_TITULAR = new Set('no ni nunca jamás el la los las un una unos unas mi mis tu tus su sus este esta estos estas ese esa esos esas'.split(' '))
function meterTitulares(frases: any[], titulares: any[], N: number, words: any[] = []): any[] {
  const buenos: any[] = []
  const limpia = (i: number) => String(words[i]?.word ?? '').replace(/[¡!¿?.,;:…"«»“”]/g, '').trim().toLocaleLowerCase('es')
  for (const t of [...titulares].sort((a: any, b: any) => a.desde - b.desde)) {
    const d = Number(t?.desde), h = Number(t?.hasta)
    if (!Number.isInteger(d) || !Number.isInteger(h) || d < 0 || h >= N || h < d || h - d + 1 > 7) continue
    const prev = buenos[buenos.length - 1]
    if (prev && d <= prev.hasta + 1) continue
    // v191: «[no] has viajado», «[el] premio…» — la palabra pegada que quedó justo antes entra al titular (hasta 8: F2 los deja así)
    let d2 = d
    while (d2 > 0 && h - d2 + 2 <= 8 && PEGADAS_AL_TITULAR.has(limpia(d2 - 1)) && !(prev && d2 - 1 <= prev.hasta + 1)) d2--
    let kd = Number(t.clave_desde), kh = Number(t.clave_hasta)
    if (!Number.isInteger(kd) || kd < d || kd > h) kd = kh = h
    if (!Number.isInteger(kh) || kh < kd || kh > h) kh = kd
    buenos.push({ desde: d2, hasta: h, clave: [kd, kh], cierra: !!t.cierra, impacto: true })
  }
  const out: any[] = []
  for (const f of frases) {
    let piezas: number[][] = [[f.desde, f.hasta]]
    for (const t of buenos) {
      piezas = piezas.flatMap(([a, b]) => (t.hasta < a || t.desde > b) ? [[a, b]] : [[a, t.desde - 1], [t.hasta + 1, b]].filter(([x, y]) => y >= x))
    }
    for (const [a, b] of piezas) {
      const c = Array.isArray(f.clave) && f.clave[0] >= a && f.clave[0] <= b ? [f.clave[0], Math.min(f.clave[1], b)] : [a, a]
      out.push({ desde: a, hasta: b, clave: c, cierra: b === f.hasta ? f.cierra : false, impacto: false, recorte: piezas.length > 1 || a !== f.desde || b !== f.hasta })
    }
  }
  // Un sobrante corto del recorte («veinticinco» entre el titular y «años es la edad…») se une a la frase normal vecina
  const todas = [...out, ...buenos].sort((x: any, y: any) => x.desde - y.desde)
  for (let i = 0; i < todas.length; i++) {
    const f = todas[i]
    if (f.impacto || !f.recorte || f.hasta - f.desde + 1 > 2) continue
    const sig = todas[i + 1], ant = todas[i - 1]
    if (sig && !sig.impacto && sig.desde === f.hasta + 1 && sig.hasta - f.desde + 1 <= 7) { sig.desde = f.desde; todas.splice(i--, 1) }
    else if (ant && !ant.impacto && ant.hasta === f.desde - 1 && f.hasta - ant.desde + 1 <= 7) { ant.hasta = f.hasta; ant.cierra = f.cierra; todas.splice(i--, 1) }
  }
  return todas.map(({ recorte: _r, ...f }: any) => f)
}

async function frasesConIA(words: any[], impactoCada: number | null = null, esfuerzo = ESFUERZO_FRASES, esfuerzoTitulares = ESFUERZO_TITULARES): Promise<{ frases: any[] | null, correcciones: any[] }> {
  if (!OPENAI_API_KEY || !words.length) return { frases: null, correcciones: [] }
  // Videos largos: bloques de ~220 palabras cortados en pausas, en paralelo
  const bloques: { base: number, words: any[] }[] = []
  let ini = 0
  while (ini < words.length) {
    let fin = Math.min(words.length, ini + 220)
    if (fin < words.length) {
      let mejor = fin, mayorPausa = -1
      for (let k = Math.max(ini + 150, 1); k < fin; k++) {
        const pausa = Number(words[k].start || 0) - Number(words[k - 1].end || words[k - 1].start || 0)
        if (pausa > mayorPausa) { mayorPausa = pausa; mejor = k }
      }
      fin = mejor
    }
    bloques.push({ base: ini, words: words.slice(ini, fin) })
    ini = fin
  }
  // v189: las frases se parten sin impacto y, a la vez, otra llamada escoge los titulares
  const [partes, titulares] = await Promise.all([
    Promise.all(bloques.map((b) => frasesDeBloque(b.words, b.base, null, esfuerzo))),
    impactoCada ? titularesConIA(words, impactoCada, esfuerzoTitulares) : Promise.resolve(null),
  ])
  let todas = partes.flatMap((p) => p?.frases ?? [])
  if (todas.length && titulares && titulares.length) todas = meterTitulares(todas, titulares, words.length, words)
  return { frases: todas.length ? todas : null, correcciones: partes.flatMap((p) => p?.correcciones ?? []) }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    let usuarioId = await usuarioDeSesion(req)
    if (!usuarioId && await esLlamadaInterna(req)) {
      // Llamada interna: el dueño del proyecto viene en el pedido (se verifica igual abajo)
      const previo = await req.clone().json().catch(() => null)
      if (previo && ES_UUID.test(String(previo.user_id || ''))) usuarioId = previo.user_id
    }
    if (!usuarioId) {
      return new Response(JSON.stringify({ error: 'Inicia sesión para usar Carrete' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const {
      project_id,
      captions = true,
      captionStyle = 'carrete',
      captionPosition = 'bottom',
      captionTypo = {} as Record<string, unknown>,
      clipGap = 0,
      clipStart = 100,
      aire = 0.12,
      combo = 'Creativ',
      heroColor = '#d2492f',
      supColor = '#d2492f',
      bg = 'Ventana',
      grain = false,
      lowFps = false,
      paper = false,
      scenesOverride = null,
      sin_cortes = false,
      cutsOverride = null,
      subtitulos: subtitulosPedidos = null as Record<string, unknown> | null,
      color = null as Record<string, unknown> | null,
      movimiento = undefined as unknown,
      escenas = undefined as unknown,
      graficos = undefined as unknown,
      reusar_render = null as string | null,
      preparar_base = false,
      reusar_base = null as string | null,
      firma_cortes = null as string | null,
      probar_frases = null as Record<string, unknown> | null,
      calidad = null as string | null,
      pantallas: pantallasPedidas = undefined as unknown,
    } = await req.json()
    const soloBase = preparar_base === true
    /* v228: «calidad: original» = el video final se corta del archivo tal como se grabó (misión 1). */
    const quiereOriginal = calidad === 'original'
    let subtitulos: Record<string, unknown> | null = subtitulosPedidos

    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id es obligatorio' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // El proyecto tiene que ser del usuario que inició sesión
    if (!(await filaDelUsuario('projects', project_id, usuarioId))) {
      return new Response(JSON.stringify({ error: 'Ese proyecto no es tuyo' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }
    /* (24-sep) las pantallas de este video: las que manda la pagina (acaba de cambiarlas) o las del proyecto */
    const pantallasR = Array.isArray(pantallasPedidas) ? limpiarPantallasSrv(pantallasPedidas) : await pantallasDelProyecto(project_id)
    const user_id = usuarioId

    /* v228: «este mismo video, en calidad original». Si la página (o el calendario) no manda `subtitulos`,
       se toman tal cual del render anterior: mismas frases, misma plantilla, mismo todo. */
    if (quiereOriginal && reusar_render && ES_UUID.test(String(reusar_render)) && !(subtitulos && Array.isArray((subtitulos as any).frases))) {
      const pv: any = await db(`/renders?id=eq.${reusar_render}&project_id=eq.${project_id}&select=subtitle_phrases,subtitle_config`)
      const p0 = Array.isArray(pv) ? pv[0] : null
      const fr = p0?.subtitle_phrases?.frases, pal = p0?.subtitle_phrases?.palabras, cfg0 = (p0?.subtitle_config ?? {}) as Record<string, any>
      if (Array.isArray(fr) && Array.isArray(pal) && pal.length) {
        subtitulos = { frases: fr, num_palabras: pal.length, plantilla: cfg0.plantilla ?? 'editorial', simple: cfg0.simple ?? null,
          escala: cfg0.escala ?? 1, y: cfg0.y ?? 0, x: cfg0.x ?? 0,
          ...(cfg0.modo === 'impacto' ? { modo: 'impacto', impacto: cfg0.impacto ?? 'medio', plantilla_impacto: cfg0.plantilla_impacto ?? null } : {}),
          ...(cfg0.apagados ? { apagados: true } : {}) }
        console.log('[v228] calidad original de ' + String(reusar_render).slice(0, 8) + ': se reutilizan sus ' + fr.length + ' frases')
      }
    }

    // ── Exportar rápido desde el editor (v178) ─────────────────────────────────────────────────────────
    // Reutiliza los cortes y la base sin subtítulos de un render anterior del MISMO proyecto: solo se rehacen los
    // subtítulos (F2) y la quemada final. No se revisan tomas, no se corta y no se llama a la IA.
    if (reusar_render && ES_UUID.test(String(reusar_render)) && subtitulos && typeof subtitulos === 'object' && Array.isArray(subtitulos.frases)) {
      const previas = await db(`/renders?id=eq.${reusar_render}&project_id=eq.${project_id}&select=id,segments_json,video_sin_subtitulos,duraciones_reales,subtitle_phrases,clean_words_json,subtitle_config,apoyo,graficos,cortes_json`)
      const previo = Array.isArray(previas) ? previas[0] : null
      const palabrasPrevias = previo?.subtitle_phrases?.palabras
      /* v228: el master no reutiliza la base (es la copia liviana): vuelve a cortar del original con la MISMA lista */
      const cj = previo?.cortes_json
      /* (24-sep) si el video anterior ES un master y se exporta normal, su base es la de 4K: se vuelve a cortar de
         las copias livianas con la misma lista (rapido). Solo «Calidad original» corta del original. */
      const previoMaster = ((previo?.subtitle_config ?? {}) as Record<string, unknown>).calidad === 'original'
      const hayLista = !!(cj && Array.isArray(cj.cuts) && cj.cuts.length)
      const recortar = hayLista && (quiereOriginal || previoMaster)
      const master = recortar && quiereOriginal
      if (quiereOriginal && !master) console.warn('[v228] ese render no guardó su lista de cortes: se hace el camino completo en original')
      /* si se pidió original y ese render no guardó sus cortes, NO se hace un export normal a escondidas:
         se cae al camino completo en original (los renders anteriores al 24-sep no traen cortes_json) */
      const listo = !!(previo && (recortar || (!quiereOriginal && previo.video_sin_subtitulos && Array.isArray(previo.duraciones_reales) && previo.segments_json)) &&
        Array.isArray(palabrasPrevias) && palabrasPrevias.length === Number(subtitulos.num_palabras))
      if (listo) {
        const palabras = palabrasPrevias.map((w: any) => ({ ...w }))
        const textos = subtitulos.textos && typeof subtitulos.textos === 'object' ? subtitulos.textos as Record<string, unknown> : {}
        aplicarCorrecciones(palabras, Object.entries(textos).map(([i, palabra]) => ({ i: Number(i), palabra: String(palabra) })), 'editor')
        const plantilla = typeof subtitulos.plantilla === 'string' ? subtitulos.plantilla : 'editorial'
        const escalaR = Number(subtitulos.escala) ? Math.max(0.7, Math.min(1.5, Number(subtitulos.escala))) : 1
        const yR = Number(subtitulos.y) ? Math.max(-45, Math.min(45, Number(subtitulos.y))) : 0
        const xR = Number(subtitulos.x) ? Math.max(-35, Math.min(35, Number(subtitulos.x))) : 0
        // v192: el modo de impacto viaja desde la página (antes se heredaba del video anterior y cambiarlo regeneraba todo).
        // Una página vieja no manda `modo`: se hereda como antes.
        const cfgPrevio = { ...((previo.subtitle_config ?? {}) as Record<string, unknown>) }
        delete cfgPrevio.calidad   // v228: un export normal de un master NO es master (su base sería la liviana)
        const traeModo = typeof subtitulos.modo === 'string'
        const nivelR = ['pocas', 'medio', 'muchas'].includes(String(subtitulos.impacto)) ? String(subtitulos.impacto) : 'medio'
        const plantillaImpR = typeof subtitulos.plantilla_impacto === 'string' ? subtitulos.plantilla_impacto : null
        const enImpacto = traeModo && subtitulos.modo === 'impacto' && !!plantillaImpR
        if (traeModo) { delete cfgPrevio.modo; delete cfgPrevio.impacto; delete cfgPrevio.plantilla_impacto }
        // v192: subtítulos apagados sin regenerar: F2 recibe «ninguno»; la configuración guarda la plantilla elegida + `apagados`
        const apagados = subtitulos.apagados === true
        delete cfgPrevio.apagados
        const marcar = enImpacto && !apagados && subtitulos.marcar_titulares === true
        const nuevas = await db('/renders', 'POST', {
          project_id, status: 'rendering',
          f1_done: !recortar, f2_done: false, f3_done: true,
          segments_json: recortar ? null : previo.segments_json,
          video_sin_subtitulos: recortar ? null : previo.video_sin_subtitulos,
          duraciones_reales: recortar ? null : previo.duraciones_reales,
          clean_words_json: previo.clean_words_json ?? null,
          cortes_json: cj ?? null,
          subtitle_config: { ...cfgPrevio, ...(master ? { calidad: 'original' } : {}), plantilla, simple: subtitulos.simple ?? null, escala: escalaR, y: yR, x: xR,
            ...(enImpacto ? { modo: 'impacto', impacto: nivelR, plantilla_impacto: plantillaImpR } : {}),
            ...(apagados ? { apagados: true } : {}),
            color: color && typeof color === 'object' ? limpiarColor(color) : ((previo.subtitle_config as Record<string, unknown> | null)?.color ?? null),
            movimiento: movimiento !== undefined ? limpiarMovimiento(movimiento) : ((previo.subtitle_config as Record<string, unknown> | null)?.movimiento ?? null),
            escenas: escenas !== undefined ? limpiarEscenas(escenas) : ((previo.subtitle_config as Record<string, unknown> | null)?.escenas ?? null),
            graficos: graficos !== undefined ? limpiarGraficos(graficos) : ((previo.subtitle_config as Record<string, unknown> | null)?.graficos ?? null) },
          apoyo: previo.apoyo ?? null,
          graficos: previo.graficos ?? null,
        })
        const nuevoId = Array.isArray(nuevas) ? nuevas[0]?.id : nuevas?.id
        if (!nuevoId) throw new Error('No se pudo crear fila de render (exportar rápido)')
        await ponerPantallas(nuevoId, pantallasR)
        if (recortar) {
          /* F1 corta del original con la lista guardada; F2 hace los subtítulos; el ensamblador arma el master */
          await invokeLambdaAsync('carrete-media-processor', {
            mode: 'renderSegments', ...(master ? { fuente: 'original' } : {}), render_id: nuevoId, project_id, user_id,
            clips: cj.cuts, clipGap_ms: cj.clipGap_ms ?? 0, clipStart: cj.clipStart ?? 100, aire_s: cj.aire_s ?? null,
          })
          console.log(`[v228] MASTER ${nuevoId}: F1 en original con ${cj.cuts.length} cortes`)
        }
        // v195: con escenas encendidas y un video anterior sin escenas buscadas, se buscan antes de F2 (el ensamblador las lee)
        const escenasR = escenas !== undefined ? limpiarEscenas(escenas) : ((previo.subtitle_config as Record<string, unknown> | null)?.escenas ?? null)
        if (escenasR && !previo.apoyo) {
          const ap = await apoyoDe(palabras)
          if (ap) await db(`/renders?id=eq.${nuevoId}`, 'PATCH', { apoyo: ap }).catch(() => null)
        }
        // lo mismo con los gráficos: se re-marcan si faltan o si los marcó un motor viejo (20-sep)
        const graficosR = graficos !== undefined ? limpiarGraficos(graficos) : ((previo.subtitle_config as Record<string, unknown> | null)?.graficos ?? null)
        if (graficosR && graficosViejos(previo.graficos)) {
          const gr = await graficosDe(palabras)
          if (gr) await db(`/renders?id=eq.${nuevoId}`, 'PATCH', { graficos: gr }).catch(() => null)
        }
        const lanzarF2 = async (frases: any[]) => {
          // F2 ve f1_done y f3_done en true: al terminar llama sola al ensamblador, que usa la base sin subtítulos
          await invokeLambdaAsync('carrete-layer2', {
            render_id: nuevoId, words: palabras, duration: 0, caption_config: {},
            // apagados: ninguna frase se dibuja (las de impacto llevan su plantilla propia y F2 las dibujaría igual)
            subtitulos: { plantilla: apagados ? 'ninguno' : plantilla, simple: subtitulos.simple ?? null, escala: escalaR, y: yR, x: xR,
              frases: apagados ? frases.map(({ estilo: _e, ...r }: any) => r) : frases },
          })
        }
        const frasesPagina = subtitulos.frases as any[]
        if (marcar) {
          // Solo los titulares, en segundo plano (la página sigue el progreso como siempre); si la IA falla, quedan los de antes
          EdgeRuntime.waitUntil((async () => {
            try {
              const cada = ({ pocas: 20, medio: 10, muchas: 5 } as Record<string, number>)[nivelR] ?? 10
              const t0 = Date.now()
              const titulares = await titularesConIA(palabras, cada)
              let frases = frasesPagina
              if (titulares && titulares.length) {
                const limpias = frasesPagina.map((f: any) => ({ desde: f.desde, hasta: f.hasta, clave: Array.isArray(f.clave) ? [...f.clave] : [f.desde, f.desde], cierra: f.cierra }))
                frases = meterTitulares(limpias, titulares, palabras.length, palabras)
                  .map(({ impacto, ...r }: any) => (impacto ? { ...r, estilo: plantillaImpR } : r))
              }
              console.log(`[v192] Titulares otra vez («${nivelR}»): ${titulares?.length ?? 0} en ${((Date.now() - t0) / 1000).toFixed(1)} s, sin volver a cortar`)
              await lanzarF2(frases)
            } catch (e) {
              await db(`/renders?id=eq.${nuevoId}`, 'PATCH', { status: 'error', error_message: '[v192] titulares/F2: ' + String(e).slice(0, 300) }).catch(() => null)
            }
          })())
        } else {
          try {
            await lanzarF2(frasesPagina)
          } catch (e) {
            await db(`/renders?id=eq.${nuevoId}`, 'PATCH', { status: 'error', error_message: '[v178] F2: ' + String(e).slice(0, 300) }).catch(() => null)
            throw e
          }
        }
        console.log(`[v178] Exportar rápido: ${reusar_render} → ${nuevoId} (${palabras.length} palabras, ${subtitulos.frases.length} frases)`)
        return new Response(JSON.stringify({ render_id: nuevoId, status: 'rendering', rapido: true }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
        })
      }
      diag.camino = 'exportar-rapido-no'
      console.warn(`[v178] Exportar rápido no disponible para ${reusar_render} (sin base sin subtítulos o cambiaron las palabras): video completo`)
    }

    // Plantilla solo en las frases de impacto (v177): la IA marca las más llamativas; el resto sale con «a tu gusto»
    const plantillaElegida = subtitulos && typeof subtitulos.plantilla === 'string' ? subtitulos.plantilla : 'editorial'
    // Look de color (LUT): lo aplica el ensamblador antes de quemar los subtítulos.
    // `revelado` es aparte: limpia el material (velo, balance, exposición) y va
    // encendido siempre, con look o sin look, salvo que se apague a propósito.
    const colorCfg = limpiarColor(color)
    const movCfg = limpiarMovimiento(movimiento)
    const escCfg = limpiarEscenas(escenas)
    const grafCfg = limpiarGraficos(graficos)
    // Tamaño y posición que eligió la persona para la plantilla
    const escalaSubs = subtitulos && Number(subtitulos.escala) ? Math.max(0.7, Math.min(1.5, Number(subtitulos.escala))) : 1
    const ySubs = subtitulos && Number(subtitulos.y) ? Math.max(-45, Math.min(45, Number(subtitulos.y))) : 0
    const xSubs = subtitulos && Number(subtitulos.x) ? Math.max(-35, Math.min(35, Number(subtitulos.x))) : 0
    const IMPACTO_CADA: Record<string, number> = { pocas: 20, medio: 10, muchas: 5 }
    const impactoCada = subtitulos && subtitulos.modo === 'impacto' && plantillaElegida !== 'simple' && plantillaElegida !== 'ninguno'
      ? (IMPACTO_CADA[String(subtitulos.impacto)] ?? 10)
      : null

    // ── Generar sobre una BASE ADELANTADA (v184) ──────────────────────────────────────────────────────
    // La base ya tiene los clips cortados y pegados (y las palabras en su tiempo final): solo faltan las frases
    // con IA, los subtítulos (F2) y la pasada final. Si la base no sirve, sigue el camino completo.
    if (!soloBase && reusar_base && ES_UUID.test(String(reusar_base)) && !GRAFICOS_ACTIVOS && !quiereOriginal) {
      const bases = await db(`/renders?id=eq.${reusar_base}&project_id=eq.${project_id}&status=eq.base&select=id,segments_json,video_sin_subtitulos,duraciones_reales,subtitle_phrases,clean_words_json,apoyo,graficos`)
      const base = Array.isArray(bases) ? bases[0] : null
      const palabrasBase = base?.subtitle_phrases?.palabras
      if (base && base.video_sin_subtitulos && Array.isArray(base.duraciones_reales) && base.segments_json && Array.isArray(palabrasBase) && palabrasBase.length) {
        const conSubs = captions !== false && subtitulos && typeof subtitulos === 'object'
        const nuevas = await db('/renders', 'POST', {
          project_id, status: 'rendering',
          f1_done: true, f2_done: false, f3_done: true,
          segments_json: base.segments_json,
          video_sin_subtitulos: base.video_sin_subtitulos,
          duraciones_reales: base.duraciones_reales,
          clean_words_json: base.clean_words_json ?? null,
          subtitle_config: conSubs
            ? (impactoCada
                ? { plantilla: 'simple', simple: subtitulos!.simple ?? null, modo: 'impacto', plantilla_impacto: plantillaElegida, impacto: subtitulos!.impacto ?? 'medio', escala: escalaSubs, y: ySubs, x: xSubs, color: colorCfg, movimiento: movCfg, escenas: escCfg, graficos: grafCfg, firma_cortes }
                : { plantilla: plantillaElegida, simple: subtitulos!.simple ?? null, escala: escalaSubs, y: ySubs, x: xSubs, color: colorCfg, movimiento: movCfg, escenas: escCfg, graficos: grafCfg, firma_cortes })
            : { color: colorCfg, movimiento: movCfg, escenas: escCfg, graficos: grafCfg, firma_cortes },
          apoyo: base.apoyo ?? null,
          graficos: base.graficos ?? null,
        })
        const nuevoId = Array.isArray(nuevas) ? nuevas[0]?.id : nuevas?.id
        if (!nuevoId) throw new Error('No se pudo crear fila de render (desde la base)')
        await ponerPantallas(nuevoId, pantallasR)
        EdgeRuntime.waitUntil((async () => {
          try {
            const palabras = palabrasBase.map((w: any) => ({ ...w }))
            let subsF2: Record<string, unknown> | null = null
            if (conSubs) {
              // v186: las frases que la IA ya marcó en la base sirven si el modo de impacto es el mismo con que se marcaron
              const fb = base.subtitle_phrases
              const hayFrases = Array.isArray(fb?.frases) && fb.frases.length
              const guardadas = hayFrases && (!impactoCada || impactoCada === fb.impacto_cada)
              const copia = () => fb.frases.map((f: any) => ({ ...f, clave: Array.isArray(f.clave) ? [...f.clave] : f.clave }))
              let ia: { frases: any[] | null, correcciones: any[] }
              if (guardadas) ia = { frases: copia(), correcciones: fb.correcciones || [] }
              else if (hayFrases && impactoCada) {
                // v192: otro nivel de impacto → solo los titulares sobre las frases de la base (no la IA de frases completa)
                const limpias = copia().map((f: any) => ({ desde: f.desde, hasta: f.hasta, clave: f.clave, cierra: f.cierra }))
                const titulares = await titularesConIA(palabrasBase, impactoCada)
                ia = { frases: titulares && titulares.length ? meterTitulares(limpias, titulares, palabrasBase.length, palabrasBase) : limpias, correcciones: fb.correcciones || [] }
              } else ia = await frasesConIA(palabrasBase, impactoCada)
              console.log(`[v192] Frases ${guardadas ? 'guardadas en la base' : hayFrases && impactoCada ? 'de la base + titulares nuevos' : 'pedidas a la IA ahora'}`)
              const n = aplicarCorrecciones(palabras, ia.correcciones, 'ia')
              if (ia.correcciones.length) console.log(`[v184] Palabras mal oídas: ${n} corregidas de ${ia.correcciones.length} propuestas`)
              const frases = ia.frases
              if (impactoCada && frases) for (const f of frases) { if (f.impacto) f.estilo = plantillaElegida }
              subsF2 = { plantilla: impactoCada ? 'simple' : plantillaElegida, simple: subtitulos!.simple ?? null, escala: escalaSubs, y: ySubs, x: xSubs, frases }
            }
            // v195: base sin escenas buscadas (hecha antes de v195) y escenas encendidas → se buscan antes de F2
            if (escCfg && !base.apoyo) {
              const ap = await apoyoDe(palabrasBase)
              if (ap) await db(`/renders?id=eq.${nuevoId}`, 'PATCH', { apoyo: ap }).catch(() => null)
            }
            // base sin gráficos, o marcados por un motor viejo (20-sep), y gráficos encendidos → se vuelven a marcar antes de F2
            if (grafCfg && graficosViejos(base.graficos)) {
              const gr = await graficosDe(palabrasBase)
              if (gr) await db(`/renders?id=eq.${nuevoId}`, 'PATCH', { graficos: gr }).catch(() => null)
            }
            // F2 ve f1_done y f3_done en true: al terminar llama al ensamblador, que usa la base sin volver a cortar
            await invokeLambdaAsync('carrete-layer2', {
              render_id: nuevoId, words: conSubs ? palabras : [], duration: 0, caption_config: { enabled: !!conSubs },
              ...(subsF2 ? { subtitulos: subsF2 } : {}),
            })
            console.log(`[v184] Desde la base ${reusar_base} → ${nuevoId} (${palabras.length} palabras)`)
          } catch (e) {
            console.error('[v184] Error generando desde la base:', e)
            await db(`/renders?id=eq.${nuevoId}`, 'PATCH', { status: 'error', error_message: '[v184] ' + String(e).slice(0, 300) }).catch(() => null)
          }
        })())
        return new Response(JSON.stringify({ render_id: nuevoId, status: 'rendering', rapido: true, desde_base: true }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
        })
      }
      diag.camino = 'base-no-sirve'
      console.warn(`[v184] La base ${reusar_base} no sirve (no está lista o sin palabras): video completo`)
    }

    const renders = await db('/renders', 'POST', {
      project_id, status: 'rendering',
      f1_done: false, f2_done: soloBase, f3_done: soloBase || !GRAFICOS_ACTIVOS,
      ...(soloBase ? { subtitle_config: { base: true, firma_cortes } } : subtitulos && typeof subtitulos === 'object'
        ? {
            subtitle_config: impactoCada
              ? { plantilla: 'simple', simple: subtitulos.simple ?? null, modo: 'impacto', plantilla_impacto: plantillaElegida, impacto: subtitulos.impacto ?? 'medio', escala: escalaSubs, y: ySubs, x: xSubs, color: colorCfg, movimiento: movCfg, escenas: escCfg, graficos: grafCfg }
              : { plantilla: plantillaElegida, simple: subtitulos.simple ?? null, escala: escalaSubs, y: ySubs, x: xSubs, color: colorCfg, movimiento: movCfg, escenas: escCfg, graficos: grafCfg },
          }
        : (colorCfg || movCfg || escCfg || grafCfg) ? { subtitle_config: { color: colorCfg, movimiento: movCfg, escenas: escCfg, graficos: grafCfg } } : {}),
    })
    const render_id = Array.isArray(renders) ? renders[0]?.id : renders?.id
    if (!render_id) throw new Error('No se pudo crear fila de render')
    if (!soloBase) await ponerPantallas(render_id, pantallasR)
    if (quiereOriginal && !soloBase) {
      try {
        const f0: any = await db(`/renders?id=eq.${render_id}&select=subtitle_config`)
        const cfg0 = ((Array.isArray(f0) ? f0[0]?.subtitle_config : null) ?? {}) as Record<string, unknown>
        await db(`/renders?id=eq.${render_id}`, 'PATCH', { subtitle_config: { ...cfg0, calidad: 'original' } })
      } catch (e) { console.warn('[v228] no se pudo marcar el master: ' + String(e)) }
    }

    /* ⚠️ DIAGNÓSTICO TEMPORAL (23-sep). Se quita en cuanto se sepa por qué el recorte de
       pausas no se aplica. Los registros de la función no devuelven nada, así que se anota en
       la propia fila del render y se lee de la base. */
    const diag: Record<string, unknown> = { clipGap: Number(clipGap), aire: Number(aire) };
    const anotar2 = async () => {
      try { await db(`/renders?id=eq.${render_id}`, 'PATCH', { diag }) } catch (_) { /* da igual */ }
    };

    const pipeline = async () => {
      try {
        // ── Obtener recipe o clips ─────────────────────────────────────────
        // Motor de tomas: corte limpio; si no responde, la receta anterior (como antes)
        /* ⚠️ Con `sin_cortes` NO se le pregunta al motor de tomas ni se busca receta guardada: el
           video entra entero. Cualquiera de los dos traería cortes y el clip volvería a salir picado. */
        /* El mapa de voz es lo que permite cortar donde acaba la palabra y no donde acaba
           el ruido. Se calcula UNA vez por clip y queda guardado; si ya está, no cuesta nada. */
        if (!sin_cortes && Number(clipGap) < 0) await pedirMapaVoz(project_id)
        const motor = sin_cortes ? null : await corteLimpio(project_id, Number(clipGap) < 0)
        diag.camino = 'completo'
        diag.motor = motor ? (motor.cuts || []).length : 0
        diag.con_silencios = motor
          ? (motor.cuts || []).filter((c: any) => Array.isArray(c?.silencios) && c.silencios.length).length
          : 0
        diag.con_bloques = motor
          ? (motor.cuts || []).filter((c: any) => Array.isArray(c?.bloques) && c.bloques.length).length
          : 0
        let recipe: any = null
        if (sin_cortes) {
          console.log('[v200] sin_cortes: el video entra entero, sin motor de tomas ni receta')
        } else if (motor) {
          recipe = { cuts: motor.cuts.map((c: any) => ({ ...c })), total_duration_sec: motor.total_s }
        } else {
          const recipes = await db(
            `/edit_recipes?project_id=eq.${project_id}&select=recipe&order=created_at.desc&limit=1`
          )
          recipe = Array.isArray(recipes) && recipes[0]?.recipe?.cuts?.length ? recipes[0].recipe : null
        }

        /* ⚠️ CUANDO LOS CORTES YA ESTÁN PUESTOS SOBRE LA VOZ, LA LAMBDA NO DEBE RECORTAR OTRA VEZ.
           Al renderizar, F1 le quita por su cuenta el silencio de la entrada y la salida a cada
           trozo. Eso ya lo hizo el editor aquí arriba — y ADEMÁS descuadra los subtítulos: el
           trozo sale más corto de lo planeado y el reloj de las palabras no se entera.

           Medido en el video de Sergio: el editor planeaba 101,47 s, el video salió de 97,97 s.
           3,5 s de retraso repartidos en 30 trozos, y por eso al principio cuadraba y luego no.
           Sergio: «los subtítulos, después de “no es que haya abandonado”, se atrasan». */
        let cortesEnLaVoz = false
        let clipsPayload: any[]
        let allWords: any[] = []
        let totalDur = 0

        if (recipe) {
          const cuts: any[] = recipe.cuts
          const uniqueClipIds = [...new Set(cuts.map((c: any) => c.clipId))]
          const clipRows = await db(`/clips?id=in.(${uniqueClipIds.join(',')})&select=id,order_index`)
          const orderMap: Record<string, number> = {}
          if (Array.isArray(clipRows)) {
            for (const row of clipRows) orderMap[row.id] = row.order_index ?? 999
          }
          cuts.sort((a: any, b: any) => {
            const oa = orderMap[a.clipId] ?? 999
            const ob = orderMap[b.clipId] ?? 999
            if (oa !== ob) return oa - ob
            return a.startTime - b.startTime
          })

          diag.entra_recorte = (clipGap < 0 && cuts.length > 0)
          diag.cortes_antes = cuts.length
          diag.dur_antes = Number(cuts.reduce((a2: number, c: any) => a2 + (c.endTime - c.startTime), 0).toFixed(2))
          if (clipGap < 0 && cuts.length > 0) {
            /* ⚠️ SUELO 0,22 y no 0,15. Una pausa de 0,15 s no es un silencio: es el ritmo normal
               de alguien enumerando. Cortar ahí es cortar en mitad del habla y sale un corte por
               palabra. Sergio: «puse sin pausas y se comió esas palabras». */
            const T = Math.max(0.22, 2.5 + clipGap * 0.025)
            /* ⚠️ EL MARGEN ES EL AIRE ALREDEDOR DE LA VOZ, y lo manda «Aire entre cortes».
               En «Pegado» quedan 25 ms por lado — 50 ms entre palabra y palabra, inaudible — y
               nunca menos: el bloque de voz empieza donde el sonido sube, y una consonante floja
               arranca un pelo antes de eso.

               Sergio: «¿hay manera de quitar también ese mínimo espacio, para que quede realmente
               pegada la frase?». Lo que lo dejaba largo no era este margen: era que el trozo se
               medía por «dónde suena» en vez de «dónde hay voz». Eso se arregla abajo. */
            const MARGIN = Math.min(0.25, Math.max(0.025, Number(aire) * 0.6))
            /* Con el mapa de voz los bloques ya vienen filtrados, así que esto solo descarta
               restos. NO se sube: tirar un trozo es tirar audio, y una palabra corta cabe aquí. */
            const MIN_TROZO = 0.12
            let outputCursor = 0
            const tightCuts: any[] = []
            for (const cut of cuts) {
              const words: any[] = cut.words || []
              if (words.length < 2) { tightCuts.push(cut); outputCursor += (cut.endTime - cut.startTime); continue }
              const outputStart = outputCursor
              const origWords = words.map((w: any) => ({
                word: w.word,
                origStart: cut.startTime + (w.start - outputStart),
                origEnd: cut.startTime + (w.end - outputStart),
              }))
              /* ⚠️ LOS TROZOS SALEN DEL MAPA DE VOZ. Un silencio solo dice «no suena», y un
                 chasquido de labios sí suena: por eso el trozo de «ganchos» arrastraba 0,65 s
                 de cola que Sergio seguía oyendo como un espacio. Medido en su clip, la
                 palabra acaba en 10,920 y lo de después está a −29 y −48 dB.

                 Por volumen no se separan — la cola de «guiones» también está a −29 dB —;
                 se separan por la FORMA, y eso es lo que trae `bloques`.

                 Sergio: «cuando yo edito a mano corto donde las ondas se acaban, es visual». */
              const bl: Array<{ a: number; b: number }> = (cut.bloques || [])
                .map((x: any) => ({ a: Math.max(cut.startTime, Number(x.a)), b: Math.min(cut.endTime, Number(x.b)) }))
                .filter((x: any) => x.b - x.a > 0.02)
                .sort((p: any, q: any) => p.a - q.a)

              const tramos: Array<{ ini: number; fin: number }> = []
              if (bl.length) {
                /* Dos bloques separados por menos de T son la misma frase: esa pausa se
                   respeta, que es lo que manda «Eliminar silencios largos». */
                let act = { ini: bl[0].a, fin: bl[0].b }
                for (let i2 = 1; i2 < bl.length; i2++) {
                  if (bl[i2].a - act.fin <= T) act.fin = bl[i2].b
                  else { tramos.push(act); act = { ini: bl[i2].a, fin: bl[i2].b } }
                }
                tramos.push(act)
              } else {
                /* Respaldo para un clip sin mapa todavía: los silencios medidos, como antes. */
                const sil: any[] = (cut.silencios || [])
                  .filter((sx: any) => (sx.end - sx.start) > T)
                  .sort((a2: any, b2: any) => a2.start - b2.start)
                if (!sil.length) { tightCuts.push(cut); outputCursor += (cut.endTime - cut.startTime); continue }
                let desde = cut.startTime
                for (const sx of sil) {
                  if (sx.start - desde >= MIN_TROZO) tramos.push({ ini: desde, fin: sx.start })
                  desde = Math.max(desde, sx.end)
                }
                if (cut.endTime - desde >= MIN_TROZO) tramos.push({ ini: desde, fin: cut.endTime })
              }

              const utiles = tramos.filter((t) => t.fin - t.ini >= MIN_TROZO)
              if (!utiles.length) { tightCuts.push(cut); outputCursor += (cut.endTime - cut.startTime); continue }

              /* Si no hay nada que quitar se deja el corte como estaba: así un clip que ya
                 venía editado a mano no se toca, y no se parte en trozos para nada. */
              const quitaria = (cut.endTime - cut.startTime) -
                utiles.reduce((z, t) => z + (t.fin - t.ini) + 2 * MARGIN, 0)
              if (quitaria < 0.08) { tightCuts.push(cut); outputCursor += (cut.endTime - cut.startTime); continue }

              for (const tr of utiles) {
                /* El margen es el aire alrededor de la voz, y lo manda «Aire entre cortes».
                   Nunca baja de 25 ms: el bloque empieza donde el sonido sube, y una
                   consonante floja arranca un pelo antes. */
                const st = Math.max(cut.startTime, tr.ini - MARGIN)
                const et = Math.min(cut.endTime, tr.fin + MARGIN)
                /* Y el texto: las palabras que caen dentro. Whisper solo decide QUÉ se dice aquí,
                   no cuándo — si una cae a caballo, va donde tenga más cuerpo. */
                const suyas = origWords.filter((w: any) => {
                  const dentro = Math.min(w.origEnd, tr.fin) - Math.max(w.origStart, tr.ini)
                  return dentro > 0 && dentro >= (w.origEnd - w.origStart) * 0.5
                })
                tightCuts.push({ clipId: cut.clipId, mp4_path: cut.mp4_path,
                  startTime: Number(st.toFixed(3)), endTime: Number(et.toFixed(3)),
                  duration: Number((et - st).toFixed(3)), words: [],
                  text: suyas.map((w: any) => w.word).join(' '), is_saac: false })
              }
              outputCursor += (cut.endTime - cut.startTime)
            }
            cuts.splice(0, cuts.length, ...tightCuts)
            /* Los bordes ya salen de la medición: que F1 no vuelva a moverlos. */
            cortesEnLaVoz = true
            diag.cortes_despues = cuts.length
            diag.dur_despues = Number(cuts.reduce((a2: number, c: any) => a2 + (c.endTime - c.startTime), 0).toFixed(2))
          }
          diag.cortes_en_la_voz = cortesEnLaVoz
          await anotar2()

          clipsPayload = cuts.map((cut: any) => ({
            clipId: cut.clipId, mp4_path: cut.mp4_path,
            startTime: cut.startTime, endTime: cut.endTime, duration: cut.duration,
            words: cut.words || [], text: cut.words?.map((w: any) => w.word).join(' ') || '', is_saac: false,
          }))
          totalDur = recipe.total_duration_sec || cuts.reduce((s: number, c: any) => s + (c.endTime - c.startTime), 0)
          allWords = clipsPayload.flatMap((c: any) => c.words || [])
          console.log(`[v153] Recipe: ${cuts.length} cortes | dur=${totalDur.toFixed(1)}s | words=${allWords.length}`)
        } else {
          const clips = await db(`/clips?project_id=eq.${project_id}&mp4_path=not.is.null&select=id,mp4_path,duration_sec&order=order_index.asc,created_at.asc`)
          const clipsList: any[] = Array.isArray(clips) ? clips : []
          if (clipsList.length === 0) {
            await db(`/renders?id=eq.${render_id}`, 'PATCH', { status: 'error', error_message: 'No hay clips procesados' })
            return
          }
          clipsPayload = clipsList.map((c: any) => ({
            clipId: c.id, mp4_path: c.mp4_path, startTime: 0, endTime: c.duration_sec || 30,
            duration: c.duration_sec || 30, words: [], text: '', is_saac: false,
          }))
          totalDur = clipsPayload.reduce((s: number, c: any) => s + (c.duration || 0), 0)
          allWords = []
        }

        // ── NUEVO (Ronda 13): Limpieza de repeticiones y muletillas ──────────
        // 1. Obtener transcripciones fieles de DB (con repeticiones reales)
        // 2. Mapear a espacio output usando los cut ranges del recipe
        // 3. GPT-4o detecta qué eliminar sobre esas palabras fieles
        // 4. Aplicar eliminaciones: cleanCuts → F1, cleanWords → F2/F3
        // Aplicar cutsOverride si el usuario editó los clips en el editor
        if (cutsOverride && Array.isArray(cutsOverride) && cutsOverride.length > 0) {
          clipsPayload = cutsOverride
          totalDur = cutsOverride.reduce((s: number, c: any) => s + (c.duration || 0), 0)
          allWords = clipsPayload.flatMap((c: any) => c.words || [])
          console.log(`[v153] cutsOverride aplicado: ${cutsOverride.length} cuts, dur=${totalDur.toFixed(1)}s`)
        }

        /* AIRE ENTRE CORTES (v198): cada corte se queda con su voz más el aire que pidió la persona. El motor midió
           dónde empieza y acaba la voz de cada corte (cuts[].voz, con los silencios del audio); aquí solo se recorta,
           nunca se agranda más allá de lo que el motor dejó. */
        const aireSeg = Math.max(0, Math.min(0.5, Number(aire)))
        if (Number.isFinite(aireSeg) && recipe && Array.isArray(recipe.cuts)) {
          const vozDe = new Map<string, { ini: number; fin: number }>()
          for (const c of recipe.cuts) if (c && c.voz && c.clipId) vozDe.set(`${c.clipId}@${Number(c.startTime).toFixed(3)}`, c.voz)
          if (vozDe.size) {
            let recortado = 0
            clipsPayload = clipsPayload.map((cut: any) => {
              const v = vozDe.get(`${cut.clipId}@${Number(cut.startTime).toFixed(3)}`)
              if (!v || !Number.isFinite(v.ini) || !Number.isFinite(v.fin)) return cut
              const st = Math.max(Number(cut.startTime), Math.min(v.ini - aireSeg, v.ini))
              const en = Math.min(Number(cut.endTime), Math.max(v.fin + aireSeg, v.fin))
              if (!(en - st >= 0.25)) return cut
              recortado += (Number(cut.endTime) - Number(cut.startTime)) - (en - st)
              return { ...cut, startTime: Number(st.toFixed(3)), endTime: Number(en.toFixed(3)), duration: Number((en - st).toFixed(3)) }
            })
            totalDur = clipsPayload.reduce((sum: number, c: any) => sum + (c.duration || 0), 0)
            allWords = clipsPayload.flatMap((c: any) => c.words || [])
            console.log(`[v198] Aire ${aireSeg.toFixed(2)}s: ${recortado.toFixed(2)}s de silencio fuera | dur=${totalDur.toFixed(1)}s`)
          }
        }

        let activeWords = allWords
        let activeCuts  = clipsPayload
        let activeDur   = totalDur

        if (motor && clipsPayload.length > 0) {
          // Palabras del motor en tiempo de clip (las de una toma oculta ya vienen corridas a su tramo)
          const enClip: any[] = []
          for (const c of motor.cuts) {
            for (const w of (c.words || [])) {
              enClip.push({ clipId: c.clipId, word: w.word, cs: c.startTime + (Number(w.start) - c.outputStart), ce: c.startTime + (Number(w.end) - c.outputStart) })
            }
          }
          // Llevarlas al tiempo de salida de los cortes finales (pueden venir partidos por «Eliminar silencios»)
          const palabras: any[] = []
          let cursorSalida = 0
          for (const cut of clipsPayload) {
            for (const w of enClip) {
              const medio = (w.cs + w.ce) / 2
              if (w.clipId === cut.clipId && medio >= cut.startTime && medio <= cut.endTime) {
                palabras.push({
                  word: w.word,
                  start: cursorSalida + Math.max(0, w.cs - cut.startTime),
                  end: cursorSalida + Math.min(cut.duration, Math.max(0, w.ce - cut.startTime)),
                })
              }
            }
            cursorSalida += cut.duration
          }
          activeWords = palabras
          activeCuts = clipsPayload
          activeDur = cursorSalida
          // Transcripción completa para «Editar resultado»: conservadas con su tiempo final, quitadas en su lugar
          try {
            let k = 0
            const transcriptData = (motor.transcripcion || []).map((w: any) => {
              if (w.removed) {
                const t = palabras[k]?.start ?? cursorSalida
                return { word: w.word, start: t, end: t, removed: true }
              }
              const p = palabras[k++]
              return { word: w.word, start: p ? p.start : cursorSalida, end: p ? p.end : cursorSalida, removed: false }
            })
            await db(`/renders?id=eq.${render_id}`, 'PATCH', { clean_words_json: transcriptData })
          } catch (e) {
            console.warn('[v171] Error guardando clean_words_json:', String(e))
          }
          console.log(`[v171] Corte limpio: ${clipsPayload.length} cortes | ${palabras.length} palabras | ${cursorSalida.toFixed(1)}s`)
        } else if (clipsPayload.length > 0) {
          console.log(`[v153] Obteniendo transcripciones fieles de DB...`)
          const uniqueIds = [...new Set(clipsPayload.map((c: any) => c.clipId))] as string[]
          const faithfulMap = await fetchFaithfulWords(uniqueIds)

          // Construir palabras fieles en espacio output
          const faithfulOutputWords = buildFaithfulOutputWords(clipsPayload, faithfulMap)
          console.log(`[v153] Palabras fieles en output space: ${faithfulOutputWords.length}`)

          // Usar fieles para detección; si no hay fieles usar las del recipe
          const wordsForClean = faithfulOutputWords.length > 0 ? faithfulOutputWords : allWords

          /* ⚠️ EL SEGUNDO SITIO DONDE SE CORTA. `cleanTranscription` no solo limpia palabras: devuelve
             `cleanCuts`, que van a F1 y recortan el video. Con `sin_cortes` se queda el clip entero y
             las palabras tal cual — que son las que necesitan los subtítulos. */
          if (sin_cortes) {
            activeWords = wordsForClean
            activeCuts = clipsPayload
            activeDur = totalDur
            console.log(`[v200] sin_cortes: ${clipsPayload.length} clip(s) enteros | ` +
              `${activeWords.length} palabras | ${activeDur.toFixed(1)}s`)
            try {
              await db(`/renders?id=eq.${render_id}`, 'PATCH', {
                clean_words_json: wordsForClean.map((w: any) => ({
                  word: w.word, start: w.start, end: w.end, removed: false,
                })),
              })
            } catch (e) {
              console.warn('[v200] Error guardando clean_words_json:', String(e))
            }
          } else if (wordsForClean.length > 0) {
            console.log(`[v153] Iniciando cleanTranscription con ${wordsForClean.length} palabras...`)
            const cleaned = await cleanTranscription(clipsPayload, wordsForClean)
            activeWords = cleaned.cleanWords
            activeCuts  = cleaned.cleanCuts
            activeDur   = activeCuts.reduce((s: number, c: any) => s + c.duration, 0)
            console.log(
              `[v153] Tras limpieza: dur ${totalDur.toFixed(1)}s→${activeDur.toFixed(1)}s | ` +
              `words ${wordsForClean.length}→${activeWords.length} | cuts ${clipsPayload.length}→${activeCuts.length}`
            )
            // Guardar transcript completo (con removed flags) para el editor de resultado
            try {
              const transcriptData = wordsForClean.map((w: any, i: number) => ({
                word: w.word, start: w.start, end: w.end,
                removed: cleaned.removedSet.has(i),
              }))
              await db(`/renders?id=eq.${render_id}`, 'PATCH', { clean_words_json: transcriptData })
              console.log(`[v153] clean_words_json guardado: ${transcriptData.length} palabras`)
            } catch(e) {
              console.warn('[v153] Error guardando clean_words_json:', String(e))
            }
          }
        }

        // ── Base adelantada (v184): hasta aquí es idéntico a generar. Se guardan las palabras y solo se corta y pega.
        // v188: prueba de la IA de frases — no corta video; la fila queda en «prueba» (nunca sirve de base)
        if (soloBase && probar_frases && typeof probar_frases === 'object') {
          const esfuerzo = ['minimal', 'low', 'medium', 'high'].includes(String(probar_frases.esfuerzo)) ? String(probar_frases.esfuerzo) : ESFUERZO_FRASES
          const t0 = Date.now()
          const esfuerzoT = ['minimal', 'low', 'medium', 'high'].includes(String(probar_frases.esfuerzo_titulares)) ? String(probar_frases.esfuerzo_titulares) : ESFUERZO_TITULARES
          const ia = await frasesConIA(activeWords, IMPACTO_CADA.medio, esfuerzo, esfuerzoT)
          await db(`/renders?id=eq.${render_id}`, 'PATCH', {
            status: 'prueba', subtitle_config: { base: true, prueba: true },
            subtitle_phrases: { palabras: activeWords, frases: ia.frases || [], correcciones: ia.correcciones || [],
              prueba: { esfuerzo, esfuerzo_titulares: esfuerzoT, segundos: Math.round((Date.now() - t0) / 100) / 10 } },
          }).catch(() => null)
          console.log(`[v188] Prueba de frases ${render_id}: ${(ia.frases || []).length} frases con «${esfuerzo}» en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
          return
        }
        if (soloBase) {
          // db() lee la respuesta como JSON y un PATCH no devuelve nada: el error es de lectura, la escritura sí queda
          await db(`/renders?id=eq.${render_id}`, 'PATCH', { subtitle_phrases: { palabras: activeWords, frases: [], base: true } }).catch(() => null)
          const paramsF1b = { clipGap_ms: clipGap, clipStart: cortesEnLaVoz ? 100 : clipStart, aire_s: cortesEnLaVoz ? null : aireSeg }
          const clipsF1b = await cortesParaF1(activeCuts, render_id, paramsF1b)
          await invokeLambdaAsync('carrete-media-processor', {
            mode: 'renderSegments', render_id, project_id, user_id, clips: clipsF1b, ...paramsF1b,
          })
          console.log(`[v184] Base adelantada ${render_id}: ${activeCuts.length} cortes, ${activeWords.length} palabras, ${activeDur.toFixed(1)}s`)
          // v186: la IA de frases mientras F1 corta (~50 s contra ~85 s): generar ya no la espera
          if (activeWords.length) {
            try {
              const cada = IMPACTO_CADA.medio
              // v195: las escenas de apoyo se buscan a la vez que las frases (la vista previa las muestra apenas se enciendan)
              // v196: los gráficos por su lado (no demoran las frases de la base)
              EdgeRuntime.waitUntil(graficosDe(activeWords).then((gr) => (gr ? db(`/renders?id=eq.${render_id}`, 'PATCH', { graficos: gr }).catch(() => null) : null)))
              const [ia, ap] = await Promise.all([frasesConIA(activeWords, cada), apoyoDe(activeWords)])
              if (ap) await db(`/renders?id=eq.${render_id}`, 'PATCH', { apoyo: ap }).catch(() => null)
              const vista = activeWords.map((w: any) => ({ ...w }))
              aplicarCorrecciones(vista, ia.correcciones, 'ia')
              await db(`/renders?id=eq.${render_id}`, 'PATCH', { subtitle_phrases: {
                palabras: activeWords, frases: ia.frases || [], correcciones: ia.correcciones || [], impacto_cada: cada,
                palabras_vista: vista, base: true,
              } }).catch(() => null)
              console.log(`[v186] Base ${render_id}: ${(ia.frases || []).length} frases de la IA guardadas`)
            } catch (e) { console.warn('[v186] IA de frases en la base falló (generar la volverá a pedir):', String(e)) }
          }
          return
        }

        // Caption config para F2
        const captionConfig = {
          font: (captionTypo.font as string) ?? 'montserrat',
          color: (captionTypo.color as string) ?? '#FFFFFF',
          fontSize: (captionTypo.fontSize as number) ?? 56,
          italic: (captionTypo.italic as boolean) ?? false,
          uppercase: (captionTypo.uppercase as boolean) ?? true,
          bold: (captionTypo.bold as boolean) ?? true,
          shadowX: (captionTypo.shadowX as number) ?? 0,
          shadowY: (captionTypo.shadowY as number) ?? 2,
          shadowBlur: (captionTypo.shadowBlur as number) ?? 8,
          shadowOpacity: (captionTypo.shadowOpacity as number) ?? 0.75,
          outlineColor: (captionTypo.outlineColor as string) ?? '#000000',
          outlineSize: (captionTypo.outlineSize as number) ?? 1.5,
          glow: (captionTypo.glow as number) ?? 0,
          position: captionPosition ?? 'bottom',
          enabled: captions !== false,
        }

        // ── Escenas para F3: usar override del editor o analizar con GPT ─────
        const N = Math.max(1, Math.min(4, Math.floor(activeDur / 60 * 4)))
        let aiScenes: any[] = []
        if (!GRAFICOS_ACTIVOS) {
          console.log('[v172] Gráficos apagados: sin escenas')
        } else if (scenesOverride && Array.isArray(scenesOverride) && scenesOverride.length > 0) {
          aiScenes = scenesOverride
          console.log(`[v153] scenesOverride aplicado: ${aiScenes.length} escenas del editor`)
        } else if (activeWords.length > 0) {
          console.log(`[v159] Analizando ${N} escenas con GPT (support LITERAL)...`)
          aiScenes = await analyzeTranscript(activeWords, activeDur, N)
          console.log(`[v159] OpenAI: ${aiScenes.length} escenas — validando supports...`)
          const transcriptWithTs = activeWords.map((w: any) => `[${Number(w.start).toFixed(1)}s] ${w.word}`).join(' ').slice(0, 3000)
          const transcriptPlain = activeWords.map((w: any) => w.word).join(' ')
          const wordTimes = activeWords.map((w: any) => ({ word: String(w.word || ''), start: Number(w.start || 0) }))
          aiScenes = await validateAndFixScenes(aiScenes, transcriptPlain, transcriptWithTs, wordTimes)
          console.log(`[v159] Escenas tras validación: ${JSON.stringify(aiScenes.map((s: any) => ({ hero: s.hero, support: s.support })))}`)
        }

        const f3Tweaks = { combo, heroColor, supColor, bg, grain, lowFps, paper }

        // ── Lanzar F1 + F2 + F3 en paralelo con datos limpios ────────────
        console.log(`[v153] Lanzando F1+F2+F3 | cuts=${activeCuts.length} words=${activeWords.length} dur=${activeDur.toFixed(1)}s`)

        // F1 arranca ya; las frases de los subtítulos se piden mientras tanto
        const paramsF1 = { clipGap_ms: clipGap, clipStart: cortesEnLaVoz ? 100 : clipStart, aire_s: cortesEnLaVoz ? null : aireSeg }
        const clipsF1 = await cortesParaF1(activeCuts, render_id, paramsF1)
        const f1Lanzada = invokeLambdaAsync('carrete-media-processor', {
          mode: 'renderSegments', render_id, project_id, user_id, clips: clipsF1, ...paramsF1,
          ...(quiereOriginal ? { fuente: 'original' } : {}),
        }).catch(e => { console.error('[v153] F1 invoke error:', e) })

        // v195: las escenas de apoyo se buscan mientras la IA marca las frases
        const apoyoP = activeWords.length ? apoyoDe(activeWords) : Promise.resolve(null)
        const guardarApoyo = apoyoP.then((ap) => (ap ? db(`/renders?id=eq.${render_id}`, 'PATCH', { apoyo: ap }).catch(() => null) : null))
        if (!escCfg) EdgeRuntime.waitUntil(guardarApoyo)
        // v196: los gráficos también (con gráficos encendidos, quedan guardados antes de F2)
        const graficosP = activeWords.length ? graficosDe(activeWords) : Promise.resolve(null)
        const guardarGraficos = graficosP.then((gr) => (gr ? db(`/renders?id=eq.${render_id}`, 'PATCH', { graficos: gr }).catch(() => null) : null))
        if (!grafCfg) EdgeRuntime.waitUntil(guardarGraficos)

        let subtitulosF2: Record<string, unknown> | null = null
        // Palabras de los subtítulos: copia de activeWords donde se corrigen las mal oídas (los tiempos no cambian)
        let palabrasSubs: any[] = activeWords
        if (subtitulos && typeof subtitulos === 'object' && captions !== false && activeWords.length > 0) {
          // Frases del editor: solo sirven si se refieren a las mismas palabras (si cambiaron los clips, las marca la IA de nuevo)
          const mismas = subtitulos.num_palabras == null || Number(subtitulos.num_palabras) === activeWords.length
          if (!mismas) console.warn(`[v175] Frases del editor descartadas: eran para ${subtitulos.num_palabras} palabras y ahora hay ${activeWords.length}`)
          const propias = mismas && Array.isArray(subtitulos.frases) && subtitulos.frases.length ? subtitulos.frases : null
          palabrasSubs = activeWords.map((w: any) => ({ ...w }))
          let frases: any[] | null = propias
          if (propias) {
            // Textos que vienen del editor: correcciones de la IA ya aceptadas + las hechas a mano
            const textos = mismas && subtitulos.textos && typeof subtitulos.textos === 'object' ? subtitulos.textos as Record<string, unknown> : {}
            const n = aplicarCorrecciones(palabrasSubs, Object.entries(textos).map(([i, palabra]) => ({ i: Number(i), palabra: String(palabra) })), 'editor')
            if (n) console.log(`[v176] ${n} palabras corregidas desde el editor`)
          } else {
            const ia = await frasesConIA(activeWords, impactoCada)
            frases = ia.frases
            const n = aplicarCorrecciones(palabrasSubs, ia.correcciones, 'ia')
            if (ia.correcciones.length) console.log(`[v176] Palabras mal oídas: ${n} corregidas de ${ia.correcciones.length} propuestas`)
            if (impactoCada && frases) {
              // Las de impacto llevan la plantilla como estilo propio; la general es «a tu gusto»
              let marcadas = 0
              for (const f of frases) { if (f.impacto) { f.estilo = plantillaElegida; marcadas++ } }
              console.log(`[v177] Frases de impacto: ${marcadas} de ${frases.length} con ${plantillaElegida} (una cada ~${impactoCada}s)`)
            }
          }
          subtitulosF2 = {
            // En modo impacto la general es «a tu gusto»; con frases del editor manda lo que trae el editor
            plantilla: impactoCada && !propias ? 'simple' : plantillaElegida,
            simple: subtitulos.simple ?? null,
            escala: escalaSubs,
            y: ySubs,
            x: xSubs,
            frases,
          }
          console.log(`[v173] Subtítulos: plantilla=${subtitulosF2.plantilla} frases=${frases ? frases.length + (propias ? ' (del editor)' : ' (IA)') : 'automáticas en F2'}`)
        }

        // con escenas encendidas, quedan guardadas ANTES de F2 (F2 → ensamblador, que las lee)
        if (escCfg) await guardarApoyo
        if (grafCfg) await guardarGraficos

        await Promise.all([
          f1Lanzada,

          invokeLambdaAsync('carrete-layer2', {
            render_id,
            words: captions !== false ? palabrasSubs : [],
            duration: activeDur,
            caption_config: captionConfig,
            ...(subtitulosF2 ? { subtitulos: subtitulosF2 } : {}),
          }).catch(e => { console.error('[v153] F2 invoke error:', e) }),

          GRAFICOS_ACTIVOS
            ? invokeLambdaAsync('carrete-graphics', {
                render_id,
                words: activeWords,
                duration: activeDur,
                scenes: aiScenes,
                tweaks: f3Tweaks,
              }).catch(e => { console.error('[v153] F3 invoke error:', e) })
            : Promise.resolve(),
        ])

        console.log('[v153] F1+F2+F3 lanzadas — Assembler se invocara cuando todas terminen')

      } catch(err) {
        console.error('[v153] Error en pipeline:', err)
        await db(`/renders?id=eq.${render_id}`, 'PATCH', { status: 'error', error_message: String(err) })
      }
    }

    EdgeRuntime.waitUntil(pipeline())

    return new Response(
      JSON.stringify({ render_id, status: 'rendering' }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch(err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})

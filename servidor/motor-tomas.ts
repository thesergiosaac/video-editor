// motor-tomas v5 (23-sep-2026): cada corte trae también los SILENCIOS que hay dentro de él, medidos en el
//   audio. orchestrate los necesita para quitar pausas cortando donde de verdad no suena: antes lo adivinaba
//   por los tiempos de palabra de Whisper, que en las palabras cortas fallan tanto que dejaba huecos donde no
//   los había y cortaba dentro de la palabra.
// motor-tomas v4 (19-sep-2026): cada corte trae su VOZ (dónde empieza y acaba lo que se oye, medido con los silencios)
//   para que orchestrate pueda dejar el aire que pida la persona; y si la transcripción de un clip salió mal
//   (Whisper en bucle, palabras de duración cero o que cubren mucho menos de lo que suena), ese clip NO se recorta por
//   palabras: se conserva toda su voz. Antes, un clip mal transcrito se podía quedar en puro silencio.
// motor-tomas v3 (16-sep-2026): guarda el corte como receta del proyecto (firma + candado); se dispara al terminar de transcribir
// motor-tomas v2 (16-sep-2026): red de seguridad por palabras con contenido, reparación de bordes y tomas ocultas
// motor-tomas v1 (16-sep-2026) — arma el corte continuo de un proyecto quitando los errores.
// Lee TODOS los clips del proyecto en orden (palabra por palabra, con tiempos y silencios),
// la IA decide qué conservar (la última versión bien dicha de cada frase, sin arranques en falso,
// intentos repetidos ni muletillas vacías) y una red de seguridad restaura cualquier contenido
// que no se repita en otro lado. Devuelve cortes con el mismo formato de edit_recipes.
// Solo acepta llamadas internas del servidor.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const MODELOS_POR_DEFECTO = ['gpt-5', 'gpt-4.1', 'gpt-4o']

// ── Solo llamadas internas del servidor ──────────────────────────────────────
async function esLlamadaInterna(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  const conocidas = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v)
  if (conocidas.includes(token)) return true
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, { headers: { apikey: token, Authorization: `Bearer ${token}` } })
    return r.ok
  } catch (_) { return false }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function dbEscribir(path: string, method: string, body: unknown): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method, body: JSON.stringify(body),
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  })
  if (!r.ok) throw new Error(`db ${method} ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json().catch(() => null)
}

// Firma de los clips (orden + transcripción): si no cambia, el corte guardado sigue sirviendo
async function firmaDe(clips: Clip[]): Promise<string> {
  const base = JSON.stringify(clips.map((c) => [c.id, c.words.length, c.words.length ? Math.round(c.words[c.words.length - 1].end * 100) : 0]))
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base + '|motor-v4'))
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

async function db(path: string): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
  if (!r.ok) throw new Error(`db ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

type Palabra = { word: string; start: number; end: number }
type Silencio = { start: number; end: number }
type Clip = { id: string; file_name: string; mp4_path: string; duration: number; words: Palabra[]; silences: Silencio[] }

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RELLENO = /^(e+h*|e+m+|m+|a+h+|u+h+|u+m+|h+m+)$/
// Palabras sin contenido propio: no cuentan para decidir si algo quitado se vuelve a decir
const VACIAS = new Set(('a al algo ante asi aun bien como con cual cuando de del desde donde e el ella ello ellos en entre era es esa ese eso esta este esto fue ha hay la las le les lo los mas me mi muy nada ni no nos o para pero por porque que quien se sea ser si sin sobre solo su sus tambien te ti tu tus un una uno unos y ya yo aja pues bueno entonces osea').split(' '))

function normalizar(p: string): string {
  return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]/g, '')
}

/* ── 1. Instrucciones para la IA ───────────────────────────────────────────── */
const SISTEMA =
  'Eres editor de video de contenido hablado para redes sociales. Recibes la transcripción palabra por palabra ' +
  'de varios clips grabados EN ORDEN por la misma persona. Mientras graba, la persona se equivoca y repite ' +
  'frases hasta que le salen bien. Tu trabajo es decidir qué palabras CONSERVAR para que el video final sea ' +
  'un solo discurso continuo y limpio.\n\n' +
  'ELIMINA:\n' +
  '1. Intentos repetidos: si una frase (o su comienzo) se dice varias veces, conserva SOLO la ÚLTIMA versión ' +
  'que la persona terminó; elimina las anteriores aunque parezcan completas.\n' +
  '2. Arranques en falso: palabras que empiezan una idea, se cortan y la idea se retoma desde el principio.\n' +
  '3. Muletillas vacías sin contenido: "eh", "ehh", "mmm", "ahh".\n' +
  '4. Un clip entero que sea un intento fallido de lo que se dice completo en el clip siguiente (el MISMO contenido).\n\n' +
  'Cuando conserves una versión, consérvala COMPLETA: desde su primera palabra hasta la última (no le cortes el arranque).\n\n' +
  'NO ELIMINES:\n' +
  '- Repeticiones intencionales que agregan información nueva cada vez: enumeraciones ("no vives solo, no ' +
  'tienes carro, no has viajado") o paralelismos ("a un metro de la meta… a cien metros de la meta").\n' +
  '- Conectores y palabras informales que forman parte del discurso ("ajá", "o sea", "bueno", "pues", "entonces").\n' +
  '- Nada que se diga una sola vez y esté bien dicho.\n' +
  '- Frases cortas distintas (remates, cierres, preguntas de una línea): si dicen algo diferente al clip vecino, se conservan.\n\n' +
  'Pistas: un reintento suele venir después de una pausa (⏸) o de una palabra estirada (⏳), y repite el MISMO ' +
  'arranque; la versión anterior queda cortada o idéntica. Nunca inventes ni reordenes: solo eliges rangos de ' +
  'índices a conservar dentro de cada clip, en orden. Los índices son los de cada clip (empiezan en 0).'

function armarTranscripcion(clips: Clip[]): string {
  return clips.map((c, ci) => {
    const lineas = c.words.map((w, i) => {
      const pausa = i === 0 ? 0 : w.start - c.words[i - 1].end
      const dur = w.end - w.start
      return `${i} ${w.word}` + (pausa >= 0.5 ? ` ⏸${pausa.toFixed(1)}s` : '') + (dur >= 0.9 ? ` ⏳${dur.toFixed(1)}s` : '')
    })
    return `CLIP ${ci} (${c.file_name})\n${lineas.join('\n')}`
  }).join('\n\n')
}

const ESQUEMA = {
  name: 'corte_limpio',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['clips'],
    properties: {
      clips: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['clip', 'conservar', 'motivo'],
          properties: {
            clip: { type: 'integer' },
            conservar: { type: 'array', items: { type: 'array', items: { type: 'integer' } } },
            motivo: { type: 'string' },
          },
        },
      },
    },
  },
}

async function preguntarIA(clips: Clip[], modelos: string[], esfuerzo: string) {
  const usuario =
    'Decide qué conservar en cada clip. Responde con TODOS los clips (aunque no quites nada) y, en "conservar", ' +
    'los rangos [inicio, fin] de índices inclusivos. "motivo": en pocas palabras qué quitaste (o "nada").\n\n' +
    armarTranscripcion(clips)
  const errores: string[] = []
  for (const modelo of modelos) {
    const cuerpo: Record<string, unknown> = {
      model: modelo,
      messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: usuario }],
      response_format: { type: 'json_schema', json_schema: ESQUEMA },
      max_completion_tokens: 12000,
    }
    if (modelo.startsWith('gpt-5') || /^o\d/.test(modelo)) cuerpo.reasoning_effort = esfuerzo
    else cuerpo.temperature = 0.1
    const t0 = Date.now()
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    if (!r.ok) { errores.push(`${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
    const data = await r.json()
    const texto = data?.choices?.[0]?.message?.content
    try {
      const parsed = JSON.parse(texto)
      if (!Array.isArray(parsed?.clips)) throw new Error('sin clips')
      return { modelo, segundos: Math.round((Date.now() - t0) / 100) / 10, decision: parsed.clips, errores, uso: data?.usage }
    } catch (e) {
      errores.push(`${modelo}: respuesta inválida ${String(e).slice(0, 80)}`)
    }
  }
  throw new Error('Ningún modelo respondió: ' + errores.join(' | '))
}

/* ── 2. Validar la decisión y proteger el contenido ────────────────────────── */
function conservadasPorClip(clips: Clip[], decision: any[]): boolean[][] {
  return clips.map((c, ci) => {
    const d = decision.find((x) => x && x.clip === ci)
    const marca = new Array(c.words.length).fill(false)
    if (!d || !Array.isArray(d.conservar)) return marca.fill(true)   // sin decisión: se conserva todo
    for (const rango of d.conservar) {
      if (!Array.isArray(rango) || rango.length < 2) continue
      const a = Math.max(0, Math.min(rango[0], rango[1])), b = Math.min(c.words.length - 1, Math.max(rango[0], rango[1]))
      for (let i = a; i <= b; i++) marca[i] = true
    }
    return marca
  })
}

// Red de seguridad: lo que se quita tiene que volver a decirse (en el mismo clip o en los vecinos).
// Si la IA quitó contenido que no aparece en ningún otro lado, se restaura.
function protegerContenido(clips: Clip[], keep: boolean[][]) {
  const restaurados: string[] = []
  const tokensConservados = (ci: number) => {
    const set = new Set<string>()
    for (let k = Math.max(0, ci - 1); k <= Math.min(clips.length - 1, ci + 1); k++) {
      clips[k].words.forEach((w, i) => { if (keep[k][i]) set.add(normalizar(w.word)) })
    }
    return set
  }
  clips.forEach((c, ci) => {
    let i = 0
    while (i < c.words.length) {
      if (keep[ci][i]) { i++; continue }
      let j = i
      while (j + 1 < c.words.length && !keep[ci][j + 1]) j++
      const contenido = c.words.slice(i, j + 1).map((w) => normalizar(w.word)).filter((t) => t && !RELLENO.test(t) && !VACIAS.has(t))
      if (contenido.length >= 1) {
        const set = tokensConservados(ci)
        const repetidas = contenido.filter((t) => set.has(t)).length
        if (repetidas / contenido.length < 0.6) {
          for (let k = i; k <= j; k++) keep[ci][k] = true
          restaurados.push(`clip ${ci}: "${c.words.slice(i, j + 1).map((w) => w.word).join(' ')}"`)
        }
      }
      i = j + 1
    }
  })
  return restaurados
}

// Bordes: si a una toma conservada le falta su primera (o última) palabra, se recupera.
// Se nota porque esa palabra + el arranque (o final) de la toma aparece igual en otro intento del mismo clip.
function repararBordes(clips: Clip[], keep: boolean[][]) {
  const reparados: string[] = []
  clips.forEach((c, ci) => {
    const n = c.words.map((w) => normalizar(w.word))
    const aparece = (seq: string[], evitar: number) => {
      for (let s = 0; s + seq.length <= n.length; s++) {
        if (s === evitar) continue
        if (seq.every((tok, k) => n[s + k] === tok)) return true
      }
      return false
    }
    for (let i = 0; i < c.words.length; i++) {
      if (!keep[ci][i] || (i > 0 && keep[ci][i - 1])) continue
      // i = primera palabra de una toma conservada; mirar hasta 3 palabras quitadas justo antes
      for (let largo = 1; largo <= 3 && i - largo >= 0; largo++) {
        const a = i - largo
        if (keep[ci][a]) break
        if (c.words[i].start - c.words[i - 1].end > 0.8) break
        const seq = n.slice(a, i + 2)
        if (seq.length >= largo + 2 && aparece(seq, a)) {
          for (let k = a; k < i; k++) keep[ci][k] = true
          reparados.push(`clip ${ci} arranque: "${c.words.slice(a, i).map((w) => w.word).join(' ')}"`)
          break
        }
      }
    }
    for (let j = c.words.length - 1; j >= 0; j--) {
      if (!keep[ci][j] || (j + 1 < c.words.length && keep[ci][j + 1])) continue
      // j = última palabra de una toma conservada; mirar hasta 2 palabras quitadas justo después
      for (let largo = 1; largo <= 2 && j + largo < c.words.length; largo++) {
        const b = j + largo
        if (keep[ci][b]) break
        if (c.words[j + 1].start - c.words[j].end > 0.6) break
        const inicio = Math.max(0, j - 1)
        const seq = n.slice(inicio, b + 1)
        if (seq.length >= largo + 2 && aparece(seq, inicio)) {
          for (let k = j + 1; k <= b; k++) keep[ci][k] = true
          reparados.push(`clip ${ci} final: "${c.words.slice(j + 1, b + 1).map((w) => w.word).join(' ')}"`)
          break
        }
      }
    }
  })
  return reparados
}

/* ¿La transcripción de este clip es de fiar? Whisper a veces repite en bucle el texto de ayuda («Pues sí, ¿no?») o deja
   palabras con duración cero. Se compara además con lo que SUENA (los silencios del audio): si las palabras cubren mucho
   menos que la voz, no es de fiar. */
function transcripcionDudosa(c: Clip): string | null {
  const n = c.words.length
  if (!n) return 'sin palabras'
  const cero = c.words.filter((w) => w.end - w.start <= 0.001).length
  if (n >= 6 && cero / n >= 0.5) return `${cero} de ${n} palabras sin duración`
  // bucle: el mismo grupo de 2 a 4 palabras repetido 3 veces o más, seguido
  const t = c.words.map((w) => normalizar(w.word))
  for (let k = 2; k <= 4; k++) {
    let repes = 1
    for (let i = k; i + k <= t.length; i += k) {
      let igual = true
      for (let j = 0; j < k; j++) if (t[i + j] !== t[i - k + j]) { igual = false; break }
      if (igual) { repes++; if (repes >= 3) return `«${c.words.slice(i, i + k).map((w) => w.word).join(' ')}» repetido ${repes} veces` }
      else repes = 1
    }
  }
  // cobertura: cuánto de la voz del audio tiene palabras encima
  const voz = tramosDeVoz(c)
  const vozTotal = voz.reduce((a, v) => a + (v.end - v.start), 0)
  if (vozTotal >= 3) {
    const conPalabras = voz.reduce((a, v) => a + (c.words.some((w) => w.end > v.start + 0.15 && w.start < v.end - 0.15) ? v.end - v.start : 0), 0)
    if (conPalabras / vozTotal < 0.45) return `las palabras solo cubren ${Math.round((conPalabras / vozTotal) * 100)} % de lo que suena`
  }
  return null
}

// Tramos de voz según los silencios detectados en el audio
function tramosDeVoz(c: Clip): Silencio[] {
  const sil = [...c.silences].sort((x, y) => x.start - y.start)
  const voz: Silencio[] = []
  let t = 0
  for (const s of sil) { if (s.start - t > 0.05) voz.push({ start: t, end: s.start }); t = Math.max(t, s.end) }
  if (c.duration - t > 0.05) voz.push({ start: t, end: c.duration })
  return voz
}

/* La voz que hay dentro de un rango (para que orchestrate pueda ajustar el aire con precisión).
   Se busca el tramo de voz de la PRIMERA palabra (si cae en un silencio, el tramo que viene después) y el de la ÚLTIMA:
   así el corte empieza donde de verdad se empieza a oír, aunque el motor haya dejado margen de sobra. */
function vozEnRango(c: Clip, a: number, b: number, pri: Palabra | null, ult: Palabra | null) {
  const w0 = pri ? pri.start : a, w1 = ult ? ult.end : b
  const tramos = tramosDeVoz(c).filter((v) => v.end > a + 0.02 && v.start < b - 0.02)
  let ini = Math.max(a, w0), fin = Math.min(b, w1)
  if (tramos.length) {
    const deInicio = tramos.find((v) => w0 >= v.start - 0.05 && w0 <= v.end + 0.05) || tramos.find((v) => v.start >= w0 - 0.05) || tramos[0]
    const deFin = [...tramos].reverse().find((v) => w1 >= v.start - 0.05 && w1 <= v.end + 0.05) || [...tramos].reverse().find((v) => v.end <= w1 + 0.05) || tramos[tramos.length - 1]
    ini = Math.max(a, Math.min(deInicio.start, w0))
    fin = Math.min(b, Math.max(deFin.end, w1))
  }
  /* Palabra estirada (⏳): Whisper le pone a la primera palabra un comienzo ANTES de la pausa. Si dentro de esa palabra
     hay un silencio de verdad, la voz arranca al acabar ese silencio (si no, el corte empieza con un hueco). Igual al final. */
  if (pri) {
    const sil = c.silences.find((s) => s.end > pri.start + 0.05 && s.start < pri.end - 0.05 && s.end <= pri.end + 0.05 && s.end - s.start >= 0.25)
    if (sil) ini = Math.max(ini, sil.end)
  }
  if (ult) {
    const sil = c.silences.find((s) => s.start >= ult.start - 0.05 && s.start < ult.end - 0.05 && s.end > ult.end - 0.05 && s.end - s.start >= 0.25)
    if (sil) fin = Math.min(fin, sil.start)
  }
  if (fin - ini < 0.2) { ini = Math.max(a, w0); fin = Math.min(b, w1) }
  return { ini: Number(ini.toFixed(3)), fin: Number(fin.toFixed(3)) }
}

/* Clip con transcripción que no es de fiar: se conserva TODA su voz, de la primera a la última palabra que suena */
function rangoDeTodaLaVoz(c: Clip) {
  const voz = tramosDeVoz(c)
  if (!voz.length) return []
  const a = Math.max(0, voz[0].start - 0.12)
  const b = Math.min(c.duration || voz[voz.length - 1].end + 0.2, voz[voz.length - 1].end + 0.2)
  if (b - a < 0.3) return []
  return [{ a, b, i: 0, j: Math.max(0, c.words.length - 1), voz: { ini: Number(voz[0].start.toFixed(3)), fin: Number(voz[voz.length - 1].end.toFixed(3)) } }]
}

/* ── 3. Palabras conservadas → rangos de tiempo cortando en silencios ───────── */
function rangosDeTiempo(c: Clip, keep: boolean[]) {
  const rangos: Array<{ a: number; b: number; i: number; j: number }> = []
  let i = 0
  while (i < c.words.length) {
    if (!keep[i]) { i++; continue }
    let j = i
    while (j + 1 < c.words.length && keep[j + 1]) j++
    const w0 = c.words[i], w1 = c.words[j]
    const previa = i > 0 ? c.words[i - 1] : null
    const siguiente = j + 1 < c.words.length ? c.words[j + 1] : null

    // Inicio: si un silencio tapa el comienzo de la primera palabra, la voz arranca al final del silencio
    let a = w0.start - 0.08
    const tapa = c.silences.find((s) => s.start <= w0.start + 0.3 && s.end > w0.start && s.end < w0.end + 0.05)
    if (tapa) a = tapa.end - 0.10
    else if (previa) a = Math.max(a, previa.end + 0.01)
    a = Math.max(0, a)

    // Fin: un poco después de la última palabra, sin pisar la palabra siguiente
    let b = w1.end + (siguiente ? 0.12 : 0.22)
    if (siguiente) {
      const silencioDespues = c.silences.find((s) => s.start >= w1.end - 0.15 && s.start < siguiente.start)
      b = silencioDespues ? Math.min(b + 0.08, silencioDespues.end, siguiente.start) : Math.min(b, siguiente.start - 0.01)
    }
    b = Math.min(c.duration || b, b)
    if (b - a >= 0.25) rangos.push({ a, b, i, j })
    i = j + 1
  }
  // Unir rangos casi pegados del mismo clip
  const unidos: Array<{ a: number; b: number; i: number; j: number; oculta?: boolean; voz?: { ini: number; fin: number } }> = []
  for (const r of rangos) {
    const u = unidos[unidos.length - 1]
    if (u && r.a - u.b < 0.12) { u.b = Math.max(u.b, r.b); u.j = r.j } else unidos.push({ ...r })
  }

  // Toma oculta: Whisper a veces no transcribe una frase que se repite idéntica.
  // Si DESPUÉS de la última toma conservada hay voz sin transcribir de duración parecida, es la retoma: se usa esa.
  const ultima = unidos[unidos.length - 1]
  if (ultima && ultima.j === c.words.length - 1) {
    const ultimaPalabra = c.words[c.words.length - 1]
    const durToma = ultima.b - ultima.a
    const candidata = tramosDeVoz(c).find((v) =>
      v.start > ultimaPalabra.end + 0.2 && v.end - v.start >= 0.8 &&
      (v.end - v.start) / durToma >= 0.65 && (v.end - v.start) / durToma <= 1.5)
    if (candidata) {
      ultima.a = Math.max(0, candidata.start - 0.1)
      ultima.b = Math.min(c.duration || candidata.end + 0.15, candidata.end + 0.15)
      ultima.oculta = true
    }
  }
  // dónde empieza y acaba la voz dentro de cada rango
  unidos.forEach((u) => { u.voz = vozEnRango(c, u.a, u.b, c.words[u.i] || null, c.words[u.j] || null) })
  return unidos
}

/* Repeticiones LITERALES (20-sep). Cuando alguien se traba repite la frase igual hasta que le sale:
   «Segun mi poca y traumatica experiencia... Segun mi poca y traumatica experiencia... Segun mi poca
   y traumatica experiencia, no me gusta...». La IA acierta el sitio pero falla el borde por una
   palabra y deja huerfanas — a Sergio le quedo un «experiencia» suelto en medio de la frase.
   Contar no falla: si una secuencia de 3+ palabras se repite JUSTO DESPUES, la primera copia sobra.
   Se aplica sobre `keep`, que es lo que decide que entra al video. */
function quitarRepeticiones(clips: Clip[], keep: boolean[][]): number {
  const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '')
  let total = 0
  clips.forEach((c, ci) => {
    const w = c.words || []
    const n = w.length
    let i = 0
    while (i < n) {
      let mejor = 0
      const tope = Math.min(14, Math.floor((n - i) / 2))
      for (let L = tope; L >= 3; L--) {                 // la repetición más larga primero
        let igual = true
        for (let k = 0; k < L; k++) {
          const a = norm(w[i + k]?.word), b = norm(w[i + L + k]?.word)
          if (!a || a !== b) { igual = false; break }
        }
        if (igual) { mejor = L; break }
      }
      if (mejor) {
        for (let k = 0; k < mejor; k++) if (keep[ci][i + k]) { keep[ci][i + k] = false; total++ }
        i += mejor
      } else i++
    }
  })
  return total
}

async function calcular(clips: Clip[], sinUsar: string[], modelos: string[], esfuerzo: string): Promise<any> {
  const ia = await preguntarIA(clips, modelos, esfuerzo)
  const keep = conservadasPorClip(clips, ia.decision)
  const reparados = repararBordes(clips, keep)
  const restaurados = protegerContenido(clips, keep)
  /* Al final, porque protegerContenido puede devolver palabras: lo que se repite literalmente sobra
     aunque «parezca contenido». (20-sep) */
  const repetidas = quitarRepeticiones(clips, keep)
  if (repetidas) console.log(`[motor] ${repetidas} palabras quitadas por repetirse literalmente`)

  // Cortes (formato edit_recipes) + transcripción completa con marcas de eliminado
  const cuts: any[] = []
  const transcripcion: any[] = []
  const resumen: any[] = []
  let cursor = 0
  const dudosos: string[] = []
  clips.forEach((c, ci) => {
    const duda = transcripcionDudosa(c)
    if (duda) dudosos.push(`${c.file_name}: ${duda}`)
    const rangos = duda ? rangoDeTodaLaVoz(c) : rangosDeTiempo(c, keep[ci])
    const antes = c.words.length ? c.words[c.words.length - 1].end - c.words[0].start : 0
    let despues = 0
    let r = 0
    c.words.forEach((w, wi) => {
      // Palabras eliminadas: quedan en la transcripción, en la posición del corte donde irían
      if (!keep[ci][wi] || !rangos.some((x) => wi >= x.i && wi <= x.j)) {
        transcripcion.push({ word: w.word, start: Number(cursor.toFixed(3)), end: Number(cursor.toFixed(3)), removed: true })
      }
      while (r < rangos.length && wi === rangos[r].i) {
        const rg = rangos[r]
        const outputStart = cursor
        const dur = rg.b - rg.a
        // En una toma oculta las palabras son las mismas, corridas al tramo nuevo
        const base = rg.oculta ? Math.max(0, c.words[rg.i].start - 0.1) : rg.a
        const palabras = c.words.slice(rg.i, rg.j + 1).map((x) => ({
          word: x.word,
          start: Number(Math.min(outputStart + dur, Math.max(outputStart, outputStart + (x.start - base))).toFixed(3)),
          end: Number(Math.min(outputStart + dur, Math.max(outputStart, outputStart + (x.end - base))).toFixed(3)),
        }))
        /* ⚠️ Los silencios DE VERDAD que hay dentro de este corte, medidos en el audio. Sin
           esto, orchestrate adivinaba las pausas por los tiempos de palabra de Whisper — que en
           las palabras cortas fallan tanto que dejaba huecos donde no los había y cortaba dentro
           de la palabra. Van en coordenadas del clip, como `startTime`. */
        const silDentro = (c.silences || [])
          .filter((sx) => sx.end > rg.a + 0.02 && sx.start < rg.b - 0.02)
          .map((sx) => ({ start: Number(Math.max(rg.a, sx.start).toFixed(3)),
                          end: Number(Math.min(rg.b, sx.end).toFixed(3)) }))
          .filter((sx) => sx.end - sx.start >= 0.12)

        cuts.push({
          clipId: c.id, mp4_path: c.mp4_path,
          startTime: Number(rg.a.toFixed(3)), endTime: Number(rg.b.toFixed(3)), duration: Number(dur.toFixed(3)),
          voz: (rg as any).voz || null,
          silencios: silDentro,
          outputStart: Number(outputStart.toFixed(3)), words: palabras, text: palabras.map((x) => x.word).join(' '),
        })
        palabras.forEach((x) => transcripcion.push({ ...x, removed: false }))
        cursor += dur
        despues += dur
        r++
      }
    })
    const d = ia.decision.find((x: any) => x && x.clip === ci)
    resumen.push({
      clip: ci, archivo: c.file_name,
      conserva: rangos.map((x) => c.words.slice(x.i, x.j + 1).map((w) => w.word).join(' ')).join(' ⟂ '),
      quita: c.words.filter((_, wi) => !keep[ci][wi]).map((w) => w.word).join(' '),
      tramos: rangos.map((x) => `${x.a.toFixed(2)}-${x.b.toFixed(2)}` + (x.oculta ? ' (toma oculta)' : '')),
      voz_antes_s: Number(antes.toFixed(1)), queda_s: Number(despues.toFixed(1)),
      motivo_ia: d?.motivo ?? '(sin decisión)',
    })
  })

  return {
    ok: true, modelo: ia.modelo, segundos_ia: ia.segundos, uso: ia.uso, errores_modelos: ia.errores,
    total_s: Number(cursor.toFixed(2)), cortes: cuts.length, sin_usar: sinUsar, reparados, restaurados, dudosos, resumen,
    cuts, transcripcion,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  if (!(await esLlamadaInterna(req))) return json({ error: 'No autorizado' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const projectId = String(body.project_id ?? '')
    if (!ES_UUID.test(projectId)) return json({ error: 'project_id inválido' }, 400)
    const modelos: string[] = Array.isArray(body.modelos) && body.modelos.length ? body.modelos : MODELOS_POR_DEFECTO
    const esfuerzo = ['minimal', 'low', 'medium', 'high'].includes(body.esfuerzo) ? body.esfuerzo : 'medium'

    const filas: any[] = await db(`/clips?project_id=eq.${projectId}&select=id,file_name,order_index,created_at,duration_sec,mp4_path,clip_metadata,status&order=order_index.asc.nullslast,created_at.asc`)
    if (!filas.length) return json({ error: 'El proyecto no tiene clips' }, 400)
    const tx: any[] = await db(`/transcriptions?clip_id=in.(${filas.map((f) => f.id).join(',')})&select=clip_id,words`)
    const palabrasDe = new Map(tx.map((t) => [t.clip_id, Array.isArray(t.words) ? t.words : []]))

    const clips: Clip[] = []
    const sinUsar: string[] = []
    for (const f of filas) {
      const words = (palabrasDe.get(f.id) || [])
        .map((w: any) => ({ word: String(w.word ?? ''), start: Number(w.start), end: Number(w.end) }))
        .filter((w: Palabra) => w.word && isFinite(w.start) && isFinite(w.end))
      if (!f.mp4_path) { sinUsar.push(`${f.file_name} (sin video procesado)`); continue }
      const silences = ((f.clip_metadata && f.clip_metadata.silences) || [])
        .map((s: any) => ({ start: Number(s.start), end: Number(s.end) }))
        .filter((s: Silencio) => isFinite(s.start) && isFinite(s.end))
      clips.push({ id: f.id, file_name: f.file_name, mp4_path: f.mp4_path, duration: Number(f.duration_sec) || 0, words, silences })
    }
    if (!clips.length) return json({ error: 'Ningún clip tiene video procesado y transcripción', sinUsar }, 400)

    // Solo calcular y devolver (pruebas)
    if (body.guardar !== true) return json(await calcular(clips, sinUsar, modelos, esfuerzo))

    // ── Modo guardar: el corte limpio queda como la receta del proyecto ──────────
    // Esperar a que todos los clips terminen de procesarse y transcribirse
    const pendientes = filas
      .filter((f) => f.status !== 'error' && (!f.mp4_path || !(palabrasDe.get(f.id) || []).length))
      .map((f) => f.file_name)
    if (pendientes.length && body.forzar !== true) return json({ ok: true, esperando: true, pendientes })

    const firma = await firmaDe(clips)
    const recetas: any[] = await db(`/edit_recipes?project_id=eq.${projectId}&select=id,version,recipe,generated_by,motor_estado,motor_firma&order=created_at.desc&limit=1`)
    let fila: any = recetas[0] || null

    // Ya calculado para estos mismos clips: se devuelve sin volver a preguntar a la IA
    if (fila && body.forzar !== true && fila.motor_firma === firma && fila.motor_estado === 'listo' && fila.recipe?.cuts?.length) {
      return json({ ok: true, al_dia: true, firma, cuts: fila.recipe.cuts, total_s: fila.recipe.total_duration_sec,
        transcripcion: fila.recipe.transcripcion || [], resumen: fila.recipe.resumen || [] })
    }

    // Candado: si otra ejecución con la misma firma empezó hace menos de 3 min, no se repite
    const ahora = new Date().toISOString()
    const hace3 = new Date(Date.now() - 180000).toISOString()
    if (!fila) {
      const creada = await dbEscribir('/edit_recipes', 'POST', {
        project_id: projectId, version: 1, recipe: {}, status: 'processing', generated_by: 'motor-tomas',
        motor_estado: 'procesando', motor_firma: firma, motor_inicio: ahora,
      })
      fila = Array.isArray(creada) ? creada[0] : creada
    } else {
      const q = new URLSearchParams({
        id: `eq.${fila.id}`,
        or: `(motor_estado.is.null,motor_estado.neq.procesando,motor_firma.neq.${firma},motor_inicio.lt."${hace3}")`,
      })
      const tomada = await dbEscribir(`/edit_recipes?${q.toString()}`, 'PATCH', { motor_estado: 'procesando', motor_firma: firma, motor_inicio: ahora })
      if (!Array.isArray(tomada) || !tomada.length) return json({ ok: true, en_proceso: true, firma })
    }

    const trabajo = async () => {
      try {
        const r = await calcular(clips, sinUsar, modelos, esfuerzo)
        await dbEscribir(`/edit_recipes?id=eq.${fila.id}`, 'PATCH', {
          recipe: {
            cuts: r.cuts, total_duration_sec: r.total_s, words_total: r.transcripcion.length,
            words_removed: r.transcripcion.filter((w: any) => w.removed).length, analyzed_at: new Date().toISOString(),
            generated_by: 'motor-tomas-v3', modelo: r.modelo, transcripcion: r.transcripcion, resumen: r.resumen,
          },
          version: (Number(fila.version) || 0) + 1, status: 'ready', generated_by: 'motor-tomas-v3',
          motor_estado: 'listo', motor_firma: firma,
        })
        return r
      } catch (e) {
        await dbEscribir(`/edit_recipes?id=eq.${fila.id}`, 'PATCH', { motor_estado: 'error' }).catch(() => null)
        throw e
      }
    }

    if (body.enSegundoPlano === true) {
      // @ts-ignore EdgeRuntime existe en las funciones de Supabase
      EdgeRuntime.waitUntil(trabajo().catch((e: unknown) => console.error('[motor-tomas] segundo plano:', String(e))))
      return json({ ok: true, aceptado: true, firma })
    }
    return json({ ...(await trabajo()), guardado: true, firma })
  } catch (e) {
    console.error('[motor-tomas] error:', String(e))
    return json({ ok: false, error: String(e).slice(0, 500) }, 500)
  }
})

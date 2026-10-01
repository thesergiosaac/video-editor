// guion-calco v30 (escribe Claude según el plan) (con la vía de prueba hacia Claude) (motor 2: planear → ganchos del plan → escribir) (30-sep-2026) — Cherry escribe guiones CALCANDO referencias que ya funcionaron.
// Guía completa: docs/GUIONES-CALCO.md. La biblioteca (plantillas, ganchos, calcos) vive en la base
// (migración 22) y sale de servidor/guiones/biblioteca.json. Los calcos NUNCA salen al navegador.
// Con sesión de usuario. Acciones:
//   · biblioteca {}                                         → {plantillas[], ganchos[], pasos{}}
//   · problemas {deQueHabla, publico}                       → {problemas:[{texto, frase, emocion}]}
//   · ideas {problema, deQueHabla, publico}                 → {ideas:[{titulo, tema, explica, creencia, plantilla, gancho, porque}]}
//   · ganchos {plantilla, modo, texto, cuenta}              → {ganchos:[{id, nombre, dice, ve}]}
//   · escribir {plantilla, gancho, ganchoTexto?, calco?, modo, texto, dur?, cuenta, voz}
//                                                          → {titulo, concepto, escenas[{paso, nombre, dice, ve}], huecos[], medidas, quejas[], calco}
//   modo: 'tema' (solo el tema) | 'describo' (el creador cuenta lo que quiere decir) | 'objetivo' (Cherry escoge el resto)
//   cuenta: {nombre, deQueHabla, publico, credencial, oferta, palabra, groserias}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const PAL_POR_SEG = 3.4
// El guion lo escribe gpt-5: en la prueba del 30-sep gpt-5-mini perdía las ideas del creador y dejaba frases sin sentido.
const MODELO_ESCRIBIR = 'gpt-5'   /* respaldo; el que escribe de verdad sale de escritorDe() */
/* Sergio (30-sep), tras la comparación a ciegas: plan Estudio y administradores → Claude Opus 5.5 (el mejor: ~US$0,23 por
   guion, ~2 min); plan Creador y sin plan → Claude Sonnet 5 (~US$0,07, ~85 s). El administrador nunca tiene topes. */
async function escritorDe(uid: string): Promise<string> {
  if (uid === 'interno') return 'claude-opus-5-5'
  try {
    const h = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` }
    const [a, su] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/administradores?user_id=eq.${uid}&select=user_id`, { headers: h }).then((r) => r.ok ? r.json() : []),
      fetch(`${SUPABASE_URL}/rest/v1/suscripciones?user_id=eq.${uid}&select=plan,estado`, { headers: h }).then((r) => r.ok ? r.json() : []),
    ])
    if (Array.isArray(a) && a.length) return 'claude-opus-5-5'
    const s0 = Array.isArray(su) ? su[0] : null
    if (s0 && s0.plan === 'estudio' && !/cancel|venc|paus|sin_plan/i.test(String(s0.estado || ''))) return 'claude-opus-5-5'
  } catch (_) { /* si no se puede saber, el básico */ }
  return 'claude-sonnet-5'
}

async function usuario(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  if ([Deno.env.get('SVC_JWT'), SERVICIO, Deno.env.get('CALCO_PRUEBA')].filter((v) => !!v).includes(token)) return 'interno'
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' ? u.id : null
  } catch (_) { return null }
}

/* ── La biblioteca, leída de la base con la llave del servidor (5 min en memoria) ── */
let cache: { t: number; b: any } | null = null
async function tabla(nombre: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${nombre}?activa=eq.true&select=*`, { headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` } })
  if (!r.ok) throw new Error(`No se pudo leer ${nombre}: ${r.status}`)
  return await r.json()
}
async function biblioteca() {
  if (cache && Date.now() - cache.t < 300000) return cache.b
  const [plantillas, ganchos, calcos, pasosF] = await Promise.all([tabla('guion_plantillas'), tabla('guion_ganchos'), tabla('guion_calcos'), tabla('guion_pasos')])
  const pasos: Record<string, any> = {}
  for (const p of pasosF) pasos[p.id] = { nombre: p.nombre, hace: p.hace }
  plantillas.sort((a: any, b: any) => a.orden - b.orden); ganchos.sort((a: any, b: any) => a.orden - b.orden)
  const b = { plantillas, ganchos, calcos, pasos }
  cache = { t: Date.now(), b }
  return b
}
const estado = (p: any) => (p?.respaldo?.videos ?? 0) >= 3 ? 'firme' : 'provisional'

/* ── La IA ── */
/* (30-sep) La comparación de motores que pidió Sergio: gpt-5 (rápido y pensando más) contra Claude Sonnet 5 y Claude
   Opus 5.5. Solo las llamadas internas del banco de pruebas pueden escoger motor (MODELO_PRUEBA / ESFUERZO_PRUEBA), y
   solo cambia el que ESCRIBE (principal = MODELO_ESCRIBIR): los revisores siguen en gpt-5-mini para que juzguen igual. */
let MODELO_PRUEBA = ''
let ESFUERZO_PRUEBA = ''
let anthropic: any = null
let USO = { entrada: 0, salida: 0 }
async function iaClaude(modelo: string, sistema: string, usuarioTxt: string, esfuerzo: string): Promise<any> {
  if (!anthropic) {
    /* import dinámico: si el paquete fallara, solo falla la prueba con Claude, no el arranque de la función */
    const { default: Anthropic } = await import('npm:@anthropic-ai/sdk')
    anthropic = new Anthropic()   /* lee ANTHROPIC_API_KEY de los secretos de Supabase */
  }
  const msg = await anthropic.messages.stream({
    model: modelo, max_tokens: 16000, system: sistema,
    thinking: { type: 'adaptive' },
    output_config: { effort: ['low', 'medium', 'high'].includes(esfuerzo) ? esfuerzo : 'medium' },
    messages: [{ role: 'user', content: `${usuarioTxt}\n\nResponde SOLO con el JSON pedido, sin texto antes ni después.` }],
  }).finalMessage()
  USO.entrada += msg.usage?.input_tokens || 0; USO.salida += msg.usage?.output_tokens || 0   /* para medir el costo real por guion */
  if (msg.stop_reason === 'refusal') throw new Error('Claude no quiso responder')
  const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  const ini = texto.indexOf('{'), fin = texto.lastIndexOf('}')
  if (ini < 0 || fin < ini) throw new Error('Claude no devolvió JSON')
  return JSON.parse(texto.slice(ini, fin + 1))
}
async function ia(sistema: string, usuarioTxt: string, esfuerzo = 'low', principal = 'gpt-5-mini'): Promise<any> {
  const escribe = principal !== 'gpt-5-mini'
  let primero = principal
  if (escribe && MODELO_PRUEBA) { primero = MODELO_PRUEBA; if (ESFUERZO_PRUEBA) esfuerzo = ESFUERZO_PRUEBA }
  if (primero.startsWith('claude-')) {
    try { return await iaClaude(primero, sistema, usuarioTxt, esfuerzo) }
    catch (e) {
      if (MODELO_PRUEBA) throw e   /* en pruebas, sin respaldo: la comparación tiene que ser limpia */
      console.warn(`[guion-calco] ${primero} falló, sigue gpt-5:`, String(e).slice(0, 200)); primero = 'gpt-5'
    }
  }
  for (const modelo of [...new Set([primero, 'gpt-5-mini', 'gpt-4o-mini'])]) {
    const cuerpo: Record<string, unknown> = { model: modelo, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuarioTxt }] }
    if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = esfuerzo; cuerpo.max_completion_tokens = 16000 }
    else { cuerpo.temperature = 0.7; cuerpo.max_tokens = 4000 }
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), 85000)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: control.signal,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      })
      if (!r.ok) { console.warn(`[guion-calco] ${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      const j = await r.json()
      const out = JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
      if (out && typeof out === 'object') return out
    } catch (e) { console.warn(`[guion-calco] ${modelo} falló:`, String(e)) }
    finally { clearTimeout(reloj) }
  }
  throw new Error('La IA no respondió. Intenta otra vez.')
}
const t = (s: any, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/* Las reglas de estilo de Cherry, con la excepción que aprobó Sergio el 30-sep: el DESCARTE que nombra
   creencias concretas se permite; el eslogan abstracto sigue prohibido. */
const ESTILO = `Escribes en español de Colombia, como se habla, para videos cortos de redes (Reels, TikTok).
- Frases cortas que se entiendan al oírlas una vez. Cero jerga de marketing y cero palabras técnicas: lo tiene que entender un niño de diez años y una señora de setenta.
- PROHIBIDAS las fórmulas de valla publicitaria: «No es X, es Y», «Sin X, sin Y», «¿El secreto? …», «Así de simple», «Spoiler:», «Punto.», los tríos de adjetivos por ritmo («rápido, fácil y barato»).
- SÍ se permite el DESCARTE cuando nombra cosas concretas que el público cree que funcionan («no te voy a hablar de hashtags, ni de audios en tendencia, ni de la mejor hora para publicar»). Lo prohibido es el eslogan abstracto, no la lista de creencias concretas.
- Concreto: cosas que se pueden tocar y filmar, situaciones reales, números de ejemplo claros.
- Nada inventado que parezca un dato real: ni cifras de resultados, ni clientes, ni estudios.
- Sin emojis, sin hashtags, sin saludos. Tutea salvo que la marca use usted.`

function voz(v: any): string {
  if (!v || typeof v !== 'object') return ''
  const tn = v.tono || {}
  const nivel = (x: any, a: string, b: string) => { const n = Number(x); return !Number.isFinite(n) ? '' : n <= 25 ? a : n >= 75 ? b : `entre ${a} y ${b}` }
  const partes = [nivel(tn.formal, 'cercano (tutea)', 'formal (usa usted)'), nivel(tn.serio, 'divertido', 'serio'), nivel(tn.experto, 'sencillo', 'experto'), nivel(tn.energia, 'calmado', 'enérgico')].filter(Boolean)
  return partes.length ? `Tono de la marca: ${partes.join(', ')}.` : ''
}
function cuentaTxt(c: any): string {
  c = c || {}
  const l = [
    c.nombre && `QUIÉN GRABA: ${t(c.nombre, 60)}`,
    c.deQueHabla && `DE QUÉ HABLA SU CUENTA: ${t(c.deQueHabla, 400)}`,
    c.publico && `A QUIÉN LE HABLA: ${t(c.publico, 300)}`,
    c.credencial ? `SU CREDENCIAL REAL (úsala tal cual, sin inflarla): ${t(c.credencial, 300)}` : 'SU CREDENCIAL: no la dio. Donde el calco pida una, deja un hueco entre corchetes.',
    c.oferta ? `LO QUE OFRECE: ${t(c.oferta, 300)}` : 'LO QUE OFRECE: no lo dio. Si el calco pide una oferta, deja un hueco entre corchetes.',
    c.palabra ? `SU PALABRA CLAVE PARA COMENTAR: ${t(c.palabra, 30)}` : 'PALABRA CLAVE: escoge tú una palabra corta y rara que tenga que ver con el tema.',
  ]
  return l.filter(Boolean).join('\n')
}
function contenidoTxt(modo: string, texto: string): string {
  const x = t(texto, 3000)
  if (modo === 'describo') return `LO QUE EL CREADOR QUIERE DECIR, con sus palabras. Respeta sus ideas, su razonamiento, sus ejemplos y su llamado a la acción; acomódalos en el calco. Lo que no quepa se queda fuera, pero no metas ideas que él no dijo:\n«${x}»`
  if (modo === 'objetivo') return `EL OBJETIVO DE ESTE VIDEO: ${x}\nEscoge tú el tema: un problema grande y común de su público que lo que ofrece resuelva de verdad. El llamado a la acción sirve a ese objetivo.`
  return `EL TEMA: ${x}\nEscoge tú el ángulo: el problema más común de quien consume este tema, dicho como lo dice la gente. Tú pones el concepto y el ejemplo, y tienen que ser verdad.`
}

/* Sergio (30-sep), después del primer guion en el Laboratorio: «hay muchas partes que no entendí… una de las razones
   para que a un video le vaya bien es que cualquier persona pueda entender lo que se dice». El guion había explicado el
   open loop con metáforas («hambre», «una llave», «una puerta en la cabeza») y nunca decía qué es. */
const CLARIDAD = `LO MÁS IMPORTANTE: QUE SE ENTIENDA A LA PRIMERA.
· Si el video explica algo, di QUÉ ES en una frase simple, como se lo dirías a un amigo en la calle («Un open loop es cuando dices que vas a contar algo y no lo cuentas todavía»), y enseguida un ejemplo concreto que se pueda ver o imaginar.
· Nada de metáforas abstractas ni poéticas (hambre, llave, puerta en la cabeza, picazón, chispa, semilla) salvo que el creador las haya usado. Si una comparación necesita explicación, sobra.
· Cada letra de una sigla es una palabra de todos los días y se explica con un ejemplo, no con otra idea abstracta.
· Nada de dichos ni refranes («morderse la lengua», «pan comido»), nada de palabras de España («vale», «coño», «mola») y nada que suene a traducción.
· Nada se da por sabido: «que la gente no se vaya DE TU VIDEO», «tu cuenta DE INSTAGRAM», «retener A LA gente». Cada verbo con su complemento («se quedan viendo tu video», no «se quedan»; «subir un video», no «subir») y cada frase dice de qué habla, como si el que oye no supiera nada del tema.
· Frases cortas: una idea por frase, pero COMPLETAS, con sus artículos, como se habla: «para mejorar la retención», nunca «para mejorar retención». Nada de estilo telegrama.
· Nunca digas «el primero», «lo segundo», «el tercero» ni un número suelto sin decir DE QUÉ, en esa misma frase: «el primer truco es…», «abres tres preguntas y cierras una en la mitad», nunca «el primero: arranca con…» ni «abres 3, cierras 1». Lo mismo con «esto», «eso», «ahí»: que se sepa a qué se refieren sin pensar.
· Del calco NO se arrastran contenidos del video de la referencia que no tengan que ver con este tema: si una frase del calco habla de callar a alguien, de repartir el tiempo en 80 y 20, de biografías o de visitas, y aquí no pega, quítala y cumple su función con algo de ESTE tema.`
/* Sergio (30-sep): «uno de los ganchos decía que todo el mundo piensa que para retener hay que hacer un video largo, y
   eso es mentira: todo el mundo sabe que se hacen cortos. Cherry está mintiendo en ese gancho». */
const VERDAD = `NADA FALSO.
· Todo lo que se afirma tiene que ser verdad para alguien que sabe del tema.
· Cuando el guion tumba una creencia (la contra, el descarte, «Mentira.»), esa creencia tiene que ser una que la gente DE VERDAD tiene y que de verdad es un error. Bien: «La calidad del video es lo que hace que la gente se quede. Mentira.» (mucha gente lo cree). Mal: «Todo el mundo piensa que para retener hay que hacer videos largos» (nadie lo cree: es inventado). Si no se te ocurre una creencia real, usa otra forma de empezar.`
const MUESTRA = `ASÍ SUENA UN GUION BIEN HECHO (es de OTRO video: copia cómo suena, lo claro y concreto que es, NO su contenido ni sus frases):
«Si tu video está bien editado y tiene muy buena calidad, Instagram se lo va a mostrar a muchísima gente. Mentira. A Instagram no le importa si tu video es hermoso, si te demoraste tres días editándolo o si lo grabaste con la mejor cámara. Lo único que le interesa es una sola cosa, y casi nadie la está mirando. Se llama el grupito de prueba. Cuando subes un video, Instagram ya lo está mostrando. Primero a un grupito pequeño. Por ejemplo: si se lo muestra a cien personas y noventa lo pasan en el primer segundo, ahí se muere, por lindo que esté. Pero si de esas cien se quedan setenta, le abre la puerta a mil más. Entonces deja de preguntarte cómo hacer que Instagram te muestre. Ya te está mostrando. Pregúntate por qué la gente lo pasa si está tan bien hecho. Y casi siempre es por una de dos cosas…»`

/* ── Las mediciones (el código, no la IA) ── */
const palabrasDe = (s: string) => (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9ñ]+/g) || [])
function lcs(a: string[], b: string[]) {
  const m = a.length, n = b.length
  if (!m || !n) return 0
  let prev = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1).fill(0)
    for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    prev = cur
  }
  return prev[n]
}
const fijas = (s: string) => palabrasDe(s.replace(/\[[^\]]*\]/g, ' '))
const GROSERIAS = /(?<![\p{L}])(mierdas?|jodid[oa]s?|joder|co[ñn]os?|cojones|putas?|put[oa]s?|carajos?|hijueputas?|maricas?|gonorreas?|vergas?)(?![\p{L}])/iu
const VALLA = [/\bno es [^.?!,;:]{1,40}[,;:] es\b/i, /\bsin [^.?!,]{1,25}, sin\b/i, /el secreto\s*\?/i, /as[ií] de simple/i, /\bspoiler\b/i]
const SENAL_LOOP = /(…|\.\.\.)\s*$|lo [uú]nico que (realmente )?importa|la m[aá]s importante|ya te (lo )?digo|ahora te|m[aá]s adelante|al final|sin (ella|[eé]l|eso) nada|¿c[oó]mo\b|la pregunta (aqu[ií] |ahora )?es/i

function medir(escenas: any[], tramos: any[], objetivoPal: number, groserias: boolean, ctaPropio = false, sinCredencial = false) {
  const todo = escenas.map((e) => e.dice).join(' ')
  const pal = palabrasDe(todo).length
  const seg = Math.round(pal / PAL_POR_SEG)
  const palCta = escenas.filter((e) => e.paso === 'O' || e.paso === 'R').reduce((s, e) => s + palabrasDe(e.dice).length, 0)
  const ctaPct = pal ? Math.round(palCta / pal * 100) : 0
  const loops = escenas.filter((e) => e.paso === 'A' || e.paso === 'P' || e.paso === 'B' || SENAL_LOOP.test(e.dice)).length
  const fij = tramos.flatMap((tr: any) => fijas(tr[1]))
  const fidelidad = fij.length ? Math.round(lcs(fij, palabrasDe(todo)) / fij.length * 100) : 100
  const huecos = escenas.flatMap((e, i) => (String(e.dice).match(/\[[^\]]+\]/g) || []).map((h: string) => ({ escena: i + 1, que: h.slice(1, -1) })))
  const quejas: string[] = []
  if (escenas.length !== tramos.length) quejas.push(`Tiene ${escenas.length} escenas y el calco tiene ${tramos.length}: una escena por tramo, ni más ni menos.`)
  if (fidelidad < 25) quejas.push(`Te alejaste demasiado del calco (${fidelidad} % de sus palabras). Conserva sus frases de unión y su ritmo.`)
  if (huecos.length > 5) quejas.push(`Dejaste ${huecos.length} cosas entre corchetes. Los corchetes son solo para datos reales del creador que no te dieron (máximo 4): todo lo demás escríbelo tú.`)
  const loopsCalco = Math.max(2, tramos.filter((tr: any) => ['A', 'P', 'B'].includes(tr[0])).length)
  if (loops < loopsCalco) quejas.push(`Solo hay ${loops} momentos que prometen algo y lo guardan; el calco tiene ${loopsCalco}.`)
  if (pal < objetivoPal * 0.8) quejas.push(`Quedó corto: ${pal} palabras y deberían ser unas ${objetivoPal}.`)
  if (pal > objetivoPal * 1.25) quejas.push(`Quedó largo: ${pal} palabras y deberían ser unas ${objetivoPal}.`)
  if (ctaPct < 12 && !ctaPropio) quejas.push(`El llamado a la acción es solo el ${ctaPct} % del guion; en las referencias ocupa entre el 15 y el 25 %. Desarróllalo como el calco: la palabra, por qué esa palabra, la promesa para su caso y las pruebas.`)
  if (ctaPct > 26) quejas.push(`El llamado a la acción es el ${ctaPct} % del guion y el tope es el 25 %: recórtalo, sin perder la palabra clave, la promesa ni la repetición final.`)
  if (!groserias && GROSERIAS.test(todo)) quejas.push('La marca no usa groserías: cámbialas por una palabra fuerte sin grosería.')
  for (const r of VALLA) { const m = todo.match(r); if (m) quejas.push(`«${m[0]}» es una frase de valla publicitaria: dilo de otra forma.`) }
  if (escenas.some((e) => /@\w|logo/i.test(e.ve))) quejas.push('En «ve» no van logos ni @usuarios.')
  /* sin credencial en sus datos, la escena de la credencial tiene que quedar con su hueco: si no, se la inventó */
  if (sinCredencial && escenas.some((e) => e.paso === 'C' && !/\[[^\]]+\]/.test(e.dice) && /(?<![\p{L}])(mis|me|logré|conseguí|llegué|he hecho|mis clientes|me funcion)/iu.test(e.dice)))
    quejas.push('La escena de la credencial cuenta resultados del creador que él no te dio: déjala con el hueco entre corchetes, por ejemplo «[tu prueba: seguidores, clientes o resultados]».')
  const sc = [...new Set(escenas.flatMap((e) => sinComplemento(e.dice)))]
  if (sc.length) quejas.push(`Frases sin decir de qué: ${sc.join('; ')}.`)
  if (VOSEO.test(todo)) quejas.push('Hay voseo de Argentina («decís», «tenés»): en Colombia se tutea («dices», «tienes»). Estas frases no se entienden a la primera así.')
  const suelto = todo.match(/(?:^|[.!?¿¡]\s+)((?:el|la|lo)\s+(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]))\s*[:,.]/i)
  if (suelto) quejas.push(`«${suelto[1]}» sin decir de qué: di «el primer truco», «la segunda pregunta»…`)
  return { medidas: { palabras: pal, segundos: seg, ctaPct, loops, fidelidad, huecos: huecos.length }, huecos, quejas }
}

/* En «describo», antes de escribir se sacan las ideas del creador y su llamado a la acción literal: entran al prompt
   como lista OBLIGATORIA y el revisor mira esa misma lista (30-sep: revisar solo al final no bastaba). */
async function ideasDelCreador(texto: string): Promise<{ ideas: string[]; cta: string }> {
  try {
    const o = await ia(`Lees lo que un creador quiere decir en un video corto. Devuelves SOLO JSON {"ideas":["..."],"cta":"..."}.
- ideas: sus ideas importantes, en su orden, de 3 a 8, cada una en una línea corta con sus palabras: afirmaciones, ejemplos, pasos, lo que muestra. Sin inventar ninguna.
- cta: si el texto termina pidiendo algo (comentar, escribir, seguir), esa petición COPIADA tal cual; si no, "".`, `«${t(texto, 3000)}»`)
    return { ideas: (Array.isArray(o?.ideas) ? o.ideas : []).map((i: any) => t(i, 220)).filter(Boolean).slice(0, 8), cta: t(o?.cta, 400) }
  } catch (_) { return { ideas: [], cta: '' } }
}

/* ── El revisor que lee: ¿quedaron las ideas del creador? ¿la escena 1 sigue el molde escogido? ── */
async function revisarLectura(x: any, escenas: any[], g: any, lista?: string[]): Promise<string[]> {
  const guion = escenas.map((e, i) => `${i + 1}. ${e.dice}`).join('\n')
  const describe = x.modo === 'describo'
  try {
    const o = await ia(`Revisas un guion de video corto. Devuelves SOLO JSON {"faltan":["..."],"confusas":["..."],"falsas":["..."],"ganchoOk":true,"ganchoPorque":"..."}.
- confusas: las frases del guion (cópialas tal cual, máx. 8) que una persona común de Colombia, sin saber del tema, NO entendería a la primera al oírlas: metáforas abstractas, ideas que no se explican, palabras técnicas, dichos, frases que suenan a traducción o mal construidas, frases sin sus artículos («para mejorar retención»), «el primero» / «lo segundo» / números sueltos sin decir de qué («abres 3, cierras 1»), cosas que no tienen que ver con el tema del video, y frases que dan por sabido de qué se habla o dejan un verbo sin su complemento («todos se quedan» ¿dónde?, «subir en la mañana» ¿subir qué?). Si todas se entienden, [].
- falsas: las frases que afirman algo falso, o que tumban una creencia que la gente NO tiene («todo el mundo piensa que hay que hacer videos largos»). Cópialas tal cual. Si no hay, [].
- faltan: ${describe ? (lista && lista.length ? 'de esta LISTA de ideas del creador, las que NO aparecen en el guion ni dichas con otras palabras (cópialas tal cual): ' + lista.map((i) => '«' + i + '»').join(' ') + '. Si están todas, [].' : 'las ideas IMPORTANTES del texto del creador que NO aparecen en el guion, ni dichas con otras palabras. Si están todas, [].') : 'deja [].'}
- ganchoOk: true si la escena 1 sigue la FORMA de este molde de gancho, aunque hable de otro tema: «${g.molde}». false si usa otra forma.
- ganchoPorque: si ganchoOk es false, en una línea qué le falta para seguir el molde.`,
      `${describe ? `TEXTO DEL CREADOR:
«${t(x.texto, 3000)}»

` : ''}GUION:
${guion}`)
    const q: string[] = []
    const faltan = Array.isArray(o?.faltan) ? o.faltan.map((f: any) => t(f, 200)).filter(Boolean) : []
    if (faltan.length) q.push(`Se quedaron fuera ideas del creador; métele cada una en el tramo donde encaje: ${faltan.map((f: string) => `«${f}»`).join('; ')}.`)
    const confusas = Array.isArray(o?.confusas) ? o.confusas.map((f: any) => t(f, 220)).filter(Boolean).slice(0, 6) : []
    const falsas = Array.isArray(o?.falsas) ? o.falsas.map((f: any) => t(f, 220)).filter(Boolean).slice(0, 4) : []
    if (falsas.length) q.push(`Estas frases afirman algo falso o tumban una creencia que nadie tiene; cámbialas por algo verdadero: ${falsas.map((f: string) => `«${f}»`).join('; ')}.`)
    if (confusas.length) q.push(`Estas frases no se entienden a la primera; reescríbelas con palabras de todos los días y un ejemplo concreto si hace falta: ${confusas.map((f: string) => `«${f}»`).join('; ')}.`)
    if (o?.ganchoOk === false && !x.ganchoLibre) q.push(`La escena 1 no sigue el molde del gancho escogido («${g.molde}»)${o.ganchoPorque ? `: ${t(o.ganchoPorque, 200)}` : ''}.`)
    return q
  } catch (_) { return [] }
}

/* ── Acciones ── */
async function accionBiblioteca() {
  const b = await biblioteca()
  return {
    pasos: b.pasos,
    plantillas: b.plantillas.map((p: any) => ({ id: p.id, nombre: p.nombre, resumen: p.resumen, estado: estado(p), respaldo: p.respaldo, pasos: p.pasos, pantalla: p.pantalla })),
    ganchos: b.ganchos.map((g: any) => ({ id: g.id, nombre: g.nombre, molde: g.molde, ejemplo: g.ejemplo, ve: g.ve, emocion: g.emocion })),
  }
}

async function accionProblemas(x: any) {
  const sis = `${ESTILO}
Eres estratega de contenido. Te dicen de qué habla una cuenta y a quién le habla. Devuelves los problemas MÁS GRANDES y MÁS COMUNES de las personas que consumen ese contenido: los que les duelen, les dan rabia o los tienen estancados. Cada problema se vuelve después una idea de video.
Devuelves SOLO JSON {"problemas":[{"texto":"...","frase":"...","emocion":"..."}]} con 10.
- texto: el problema en 3 a 8 palabras, como un titular («mis videos no tienen vistas»).
- frase: cómo lo diría esa persona en voz alta, en primera persona, con sus palabras (máx. 20).
- emocion: la que le provoca: frustración, miedo, vergüenza, rabia, cansancio, confusión o envidia.
- Del más grande y común al menos. Variados: no diez versiones del mismo. Lo más general posible sin dejar de ser de este tema (zona segura): nada tan técnico que solo lo entienda un experto.`
  const o = await ia(sis, `DE QUÉ HABLA LA CUENTA: ${t(x.deQueHabla, 500)}\nA QUIÉN LE HABLA: ${t(x.publico, 300) || '(dedúcelo)'}`)
  const ps = (Array.isArray(o.problemas) ? o.problemas : []).map((p: any) => ({ texto: t(p?.texto, 80), frase: t(p?.frase, 200), emocion: t(p?.emocion, 20) })).filter((p: any) => p.texto).slice(0, 12)
  return { problemas: ps }
}

async function accionIdeas(x: any) {
  const b = await biblioteca()
  const pl = b.plantillas.map((p: any) => `${p.id} = ${p.nombre}: ${p.resumen}`).join('\n')
  const gs = b.ganchos.map((g: any) => `${g.id} = ${g.nombre}: ${g.molde}`).join('\n')
  const sis = `${ESTILO}
Conviertes un problema del público en ideas de video que lo resuelvan de verdad. Devuelves SOLO JSON {"ideas":[{"titulo":"...","tema":"...","explica":"...","creencia":"...","plantilla":"...","gancho":"...","porque":"..."}]} con 3 ideas distintas entre sí.
- titulo: 4 a 9 palabras, lo que diría la portada del video.
- tema: de qué va, empezando por «cómo» o «por qué» si encaja (máx. 10 palabras).
- explica: lo que el video enseña, en 2 o 3 frases: la respuesta de verdad al problema, que funcione y se pueda aplicar. Nada de humo.
- creencia: lo que la gente cree o hace mal sobre esto, SOLO si la idea lo desmiente; si no, "".
- plantilla: el id de la estructura que mejor le queda, de esta lista:\n${pl}
- gancho: el id del gancho que mejor le queda, de esta lista:\n${gs}
- porque: una línea: por qué esa estructura y ese gancho para esta idea.`
  const o = await ia(sis, `EL PROBLEMA: ${t(x.problema, 300)}\nDE QUÉ HABLA LA CUENTA: ${t(x.deQueHabla, 400)}\nA QUIÉN LE HABLA: ${t(x.publico, 300)}`, 'medium')
  const ids = new Set(b.plantillas.map((p: any) => p.id)), gid = new Set(b.ganchos.map((g: any) => g.id))
  const ideas = (Array.isArray(o.ideas) ? o.ideas : []).map((i: any) => ({
    titulo: t(i?.titulo, 90), tema: t(i?.tema, 120), explica: t(i?.explica, 600), creencia: t(i?.creencia, 200),
    plantilla: ids.has(i?.plantilla) ? i.plantilla : 'sigla', gancho: gid.has(i?.gancho) ? i.gancho : 'contra', porque: t(i?.porque, 200),
  })).filter((i: any) => i.tema).slice(0, 3)
  return { ideas }
}

/* ── El secreto del video (Sergio, 30-sep) ──
   «Está nombrando el open loop desde el inicio; se supone que ese es el factor sorpresa… si la persona sabe de qué voy a
   hablar desde el gancho, la gente se va». El gancho habla del PROBLEMA de quien mira; lo que el video revela (el
   secreto) no se nombra ni se explica hasta después. Se saca una vez y lo usan los ganchos y la escena 1. */
async function secretoDe(x: any): Promise<{ secreto: string; prohibidas: string[]; problema: string }> {
  try {
    const o = await ia(`Lees de qué va un video corto. Devuelves SOLO JSON {"secreto":"...","prohibidas":["..."],"problema":"..."}.
- secreto: lo que el video REVELA o enseña: la respuesta, el concepto, el truco (máx. 12 palabras).
- prohibidas: las palabras que delatarían la RESPUESTA si salieran en la primera frase (el nombre del concepto que explica el video, sus sinónimos), de 1 a 5, en minúsculas. El TEMA del video NO va aquí: en un video sobre «la hora de publicar no importa porque Instagram prueba con un grupito», «hora» y «publicar» SÍ pueden salir en el gancho; lo prohibido es «grupito de prueba», «grupo pequeño».
- problema: lo que le pasa a la persona que mira, dicho como lo diría ella, SIN mencionar el secreto (máx. 16 palabras). Ej.: «la gente se va de mis videos en los primeros segundos».`, `${contenidoTxt(x.modo, x.texto)}`)
    return { secreto: t(o?.secreto, 160), prohibidas: (Array.isArray(o?.prohibidas) ? o.prohibidas : []).map((w: any) => t(w, 40).toLowerCase()).filter((w: string) => w.length > 2).slice(0, 6), problema: t(o?.problema, 200) }
  } catch (_) { return { secreto: '', prohibidas: [], problema: '' } }
}
/* Sergio (30-sep): «que la gente no se vaya, ¿de dónde? ¿de tu vida, de la casa, del país?», «tu cuenta, ¿de PayPal, del
   banco?», «retener gente suena extraño». Lo que el código puede ver solo, y cómo se completa. */
const VOSEO = /(?<![\p{L}\p{N}])(vos|decís|tenés|querés|sabés|podés|hacés|mirá|fijate|sos un[ao]?)(?![\p{L}\p{N}])/iu   /* solo las formas con tilde: «sabes» es tuteo */
const SIN_COMPLEMENTO: [RegExp, string, string][] = [
  [/\bse (va|van|vaya|vayan|fue|fueron|iba|iban)\b(?!\s+(de|del|a|al|en|antes|sin|viendo|mirando|hasta))/gi, 'se $1 de tu video', '«se va / se vaya» sin decir de dónde: «se vaya de tu video»'],
  [/\bse (queda|quedan|quede|queden|quedó|quedaron)\b(?!\s+(viendo|mirando|a ver|en|hasta|con|sin|pegad))/gi, 'se $1 viendo tu video', '«se queda» sin decir dónde: «se queda viendo tu video»'],
  [/\btu cuenta\b(?!\s+(de|del|en)\b)/gi, '$& de Instagram', '«tu cuenta» sin decir de qué: «tu cuenta de Instagram»'],
  [/\bretener (gente|personas|audiencia|público|publico)\b/gi, 'retener a la $1', '«retener gente»: «retener a la gente»'],
]
function sinComplemento(frase: string): string[] {
  return SIN_COMPLEMENTO.filter(([re]) => { re.lastIndex = 0; return re.test(frase) }).map((r) => r[2])
}
function completar(frase: string, esVideo = true): string {
  let f = frase
  /* (30-sep, ronda 2) «se vaya → de tu video» a ciegas daba «que no se vaya de tu video la gente de tu video»: esas dos solo se marcan */
  for (const [re, por] of SIN_COMPLEMENTO) { if (/tu video/.test(por)) continue; re.lastIndex = 0; f = f.replace(re, por) }
  return f.replace(/retener a la (personas|público|publico)/gi, 'retener a las $1').replace(/a las público/gi, 'al público')
}

/* ronda 1 del auditor: «se vaya» → «de tu video» metió videos en un guion sobre el azúcar */
const esDeVideos = (x: any) => /video|contenido|redes|instagram|tiktok|reel|creador|seguidores/i.test(`${x?.cuenta?.deQueHabla || ''} ${x?.texto || ''}`)

const delata = (frase: string, prohibidas: string[]) => {
  const f = palabrasDe(frase).join(' ')
  return prohibidas.filter((w) => { const k = palabrasDe(w).join(' '); return k && f.indexOf(k) >= 0 })
}
const REGLAS_GANCHO = (s: { secreto: string; prohibidas: string[]; problema: string }) => `EL GANCHO NO REGALA EL VIDEO.
· El gancho abre una pregunta y NO la contesta: engancha con el problema de quien mira, nunca con la respuesta. Si el gancho ya dice lo que el video enseña, no queda nada que esperar y la gente se va.
${s.secreto ? `· Lo que este video revela, y que el gancho NO puede decir ni explicar: «${s.secreto}».` : ''}
${s.prohibidas.length ? `· Palabras PROHIBIDAS en el gancho: ${s.prohibidas.map((w) => '«' + w + '»').join(', ')}.` : ''}
${s.problema ? `· De lo que SÍ puede hablar el gancho: «${s.problema}».` : ''}
· Una sola idea: el molde y nada más. Después de «Mentira.» no se explica nada.
· La contra dice la creencia EN POSITIVO, tal como la dice la gente, y después «Mentira.»: «La calidad del video es lo que hace que la gente se quede viendo. Mentira.» Nunca «La clave no es el video perfecto. Mentira.» (eso afirma lo contrario).
· SE ENTIENDE SOLO, SIN CONTEXTO. Quien lo oye viene haciendo scroll y no sabe de qué hablas: el gancho dice de qué se trata (tu video, tus reels, Instagram, tu negocio) y ningún verbo va sin su complemento. Mal: «si mejoras la cámara todos se quedan» (¿se quedan dónde?), «subir en la mañana hace que todos vean tu video» (¿subir qué?). Bien: «si mejoras la cámara la gente se queda viendo tu video», «subir tus videos en la mañana hace que los vea más gente».
· Para hablar de la gente, «todo el mundo», «la gente» o «todos», nunca «todas».
· La creencia que se tumba tiene que ser sensata y real, dicha como la dice la gente. Nada de afirmaciones raras o absolutas que nadie diría («la fórmula es solo contenido perfecto y listo»).`

async function accionGanchos(x: any) {
  const b = await biblioteca()
  const sec = x.plan && x.plan.revela
    ? { secreto: t(x.plan.revela, 200), prohibidas: palabrasDe(x.plan.concepto || '').length ? [String(x.plan.concepto).toLowerCase()] : [], problema: t(x.plan.problema, 200) }
    : await secretoDe(x)
  const esVideo = esDeVideos(x)
  const gs = b.ganchos.map((g: any) => `${g.id} — ${g.nombre}\n  molde: ${g.molde}\n  ejemplo de otro video: ${g.ejemplo}\n  cómo se ve: ${g.ve}`).join('\n')
  const sis = `${ESTILO}
Escribes la primera frase de un video corto (el gancho) con cada uno de estos moldes, aplicada al video de este creador. Copia la FORMA del molde, no el tema del ejemplo.
${REGLAS_GANCHO(sec)}
${CLARIDAD}
${VERDAD}
${gs}
Devuelves SOLO JSON {"ganchos":[{"id":"...","dice":"...","ve":"..."}]} con uno por molde, en el mismo orden.
- dice: máx. 28 palabras, que se diga en unos 6 segundos. Emoción fuerte.
- ve: lo que se ve mientras lo dice, filmable con el celular (máx. 18 palabras).
- Si un molde pide un dato real que no tienes (una cifra de resultados), déjalo entre corchetes: «[tu cifra]».
- Groserías: ${x?.cuenta?.groserias ? 'sí, las de Colombia, si el molde las pide' : 'no'}.`
  const o = await ia(sis, `${contenidoTxt(x.modo, x.texto)}${x.plan ? `\nLO QUE LA GENTE CREE (para la contra): ${x.plan.creencia || '(nada real: la contra habla de otra creencia que sí exista)'}` : ''}\n${cuentaTxt(x.cuenta)}`, 'low', x._escritor || 'gpt-5-mini')
  const porId: Record<string, any> = {}
  for (const g of (Array.isArray(o.ganchos) ? o.ganchos : [])) if (g?.id) porId[g.id] = g
  let lista = b.ganchos.map((g: any) => ({ id: g.id, nombre: g.nombre, molde: g.molde, dice: t(porId[g.id]?.dice, 260), ve: t(porId[g.id]?.ve, 160) })).filter((g: any) => g.dice)
  /* los que delatan el secreto (o dicen «todas») se reescriben una vez */
  /* (30-sep) dos ganchos copiaron el TEMA del ejemplo del molde («la mejor hora para publicar», «subo dos videos al día») */
  const ejemploDe = (id: string) => (b.ganchos.find((q: any) => q.id === id) || {}).ejemplo || ''
  const copiaEjemplo = (g: any) => { const e = new Set(palabrasDe(ejemploDe(g.id)).filter((w) => w.length > 3)); const d = palabrasDe(g.dice).filter((w) => w.length > 3); return d.length > 0 && d.filter((w) => e.has(w)).length / d.length > 0.45 }
  /* Sergio (30-sep): «todos se quedan, ¿dónde?», «subir en la mañana, ¿subir qué?». Un lector que no sabe nada del
     tema los lee uno por uno: los que no se entienden solos, se reescriben. */
  const oscuros: Record<string, string> = {}
  try {
    const rv = await ia(`Eres alguien que va haciendo scroll en Instagram y no sabe NADA del creador ni del tema. Lees la primera frase de varios videos. Devuelves SOLO JSON {"malos":[{"id":"...","porque":"..."}]} con los que NO entiendes a la primera: no sabes de qué habla, un verbo queda sin su complemento («se quedan» ¿dónde?, «subir» ¿qué?), suena raro o mal dicho, o afirma algo que nadie cree. Si todos se entienden, [].`,
      lista.map((g: any) => `${g.id}: ${g.dice}`).join('\n'))
    for (const m of (Array.isArray(rv?.malos) ? rv.malos : [])) if (m?.id) oscuros[m.id] = t(m.porque, 160)
  } catch (_) { /* sin revisión, siguen las otras */ }
  /* lo que el código ve solo: groserías con el interruptor apagado, y un «resultado imposible» sin el hueco de la
     cifra cuando el creador no dio su prueba (se inventaba «me hizo que la gente viera la mitad más») */
  const groseriasSi = !!x?.cuenta?.groserias, sinPrueba = !t(x?.cuenta?.credencial, 300)
  const inventa = (g: any) => g.id === 'resultado' && sinPrueba && !/\[[^\]]+\]/.test(g.dice)
  for (const g of lista) {
    if (inventa(g)) oscuros[g.id] = (oscuros[g.id] ? oscuros[g.id] + '; ' : '') + 'cuenta un resultado del creador que no dio: la cifra va entre corchetes, «[tu cifra]»'
    if (!groseriasSi && GROSERIAS.test(g.dice)) oscuros[g.id] = (oscuros[g.id] ? oscuros[g.id] + '; ' : '') + 'tiene una grosería y esta marca no las usa'
  }
  /* la palabra para comentar se colaba al final («…Mentira. nudo»): en el gancho nunca va */
  const palabraC = t(x?.cuenta?.palabra, 30)
  for (const g of lista) {
    if (palabraC) { const k = g.dice.toLowerCase().lastIndexOf(palabraC.toLowerCase()); if (k > 0 && g.dice.slice(k + palabraC.length).replace(/[\s.!]/g, '') === '') g.dice = g.dice.slice(0, k).trim() }
    g.dice = g.dice.replace(/([.!?…])\s+\p{Ll}+\s*$/u, '$1')   /* una palabra suelta en minúscula después del punto final */
    if (g.id !== 'pregunta') g.dice = g.dice.replace(/^¿\s*/, '').replace(/\?\s*$/, '.')   /* solo «la pregunta» es pregunta */
    if (g.id !== 'contra' && g.id !== 'cebo') g.dice = g.dice.replace(/\s*Mentira\.?\s*(Mira…|Mira\.\.\.|Mira)?\s*$/u, '').trim()   /* «Mentira.» es de la contra */
    const sc = sinComplemento(g.dice)
    if (g.id === 'contra' && /(?<![\p{L}])no(?![\p{L}])[^.]*\.\s*Mentira/iu.test(g.dice)) sc.push('la contra está al revés: dice «no…» y luego «Mentira», o sea lo contrario de lo que quieres. Di la creencia tal como la dice la gente, SIN «no», y después «Mentira.»')
    if (VOSEO.test(g.dice)) sc.push('usa voseo de Argentina («decís», «tenés»): en Colombia se tutea («dices», «tienes»)')
    if ((g.dice.match(/(?<![\p{L}])la gente(?![\p{L}])/giu) || []).length > 1) sc.push('repite «la gente» en la misma frase: la segunda vez di «tus seguidores», «quien te ve» o «todos»')
    if (sc.length) oscuros[g.id] = (oscuros[g.id] ? oscuros[g.id] + '; ' : '') + sc.join('; ')
  }
  const malos = lista.filter((g: any) => delata(g.dice, sec.prohibidas).length || /\btodas\b/i.test(g.dice) || copiaEjemplo(g) || oscuros[g.id])
  if (malos.length) {
    try {
      const fx = await ia(`${ESTILO}\n${REGLAS_GANCHO(sec)}\nReescribes estos ganchos: cada uno delata lo que el video revela, habla de la gente como «todas», copia el TEMA del ejemplo del molde, o no se entiende solo (alguien que va haciendo scroll no sabría de qué habla). Mantén su molde, habla del problema de ESTE video y di siempre de qué se trata: «se vaya de tu video», «tu cuenta de Instagram», «retener a la gente». Nunca pongas la palabra para comentar en el gancho. Devuelves SOLO JSON {"ganchos":[{"id":"...","dice":"..."}]}.`,
        malos.map((g: any) => `${g.id} (molde: ${g.molde}; ejemplo que NO se copia: ${ejemploDe(g.id)}): ${g.dice}${oscuros[g.id] ? ' — no se entiende solo: ' + oscuros[g.id] : ''}${delata(g.dice, sec.prohibidas).length ? ' — delata: ' + delata(g.dice, sec.prohibidas).join(', ') : ''}`).join('\n'))
      for (const c of (Array.isArray(fx?.ganchos) ? fx.ganchos : [])) {
        const g = lista.find((y: any) => y.id === c?.id)
        if (g && t(c.dice, 260) && !delata(c.dice, sec.prohibidas).length) g.dice = t(c.dice, 260)
      }
    } catch (_) { /* se quedan los de la primera vuelta */ }
    /* lo que quedó mal después de reescribir: «todas» se cambia a mano, y el que siga delatando, con grosería o
       inventando un resultado, no se ofrece */
    for (const g of lista) g.dice = completar(g.dice.replace(/\btodas\b/g, 'todos').replace(/\bTodas\b/g, 'Todos'), esVideo)
    lista = lista.filter((g: any) => !delata(g.dice, sec.prohibidas).length && (groseriasSi || !GROSERIAS.test(g.dice)) && !inventa(g))
  }
  for (const g of lista) g.dice = completar(g.dice, esVideo)
  return { ganchos: lista.map((g: any) => ({ id: g.id, nombre: g.nombre, dice: g.dice, ve: g.ve })), secreto: sec.secreto }
}

/* En «describo» y «objetivo» el contenido manda: la IA escoge la referencia cuyo desarrollo encaja con lo que se quiere
   decir (el texto de Sergio sobre la retención pide la del ratio de interés, no la del triángulo). */
async function elegirCalco(b: any, plantilla: string, gancho: string, x: any) {
  /* (30-sep) La #01 reparte letras (F-R-S-F) y en tres pruebas seguidas dio guiones que no se entendían: solo si se pide */
  const de = b.calcos.filter((c: any) => c.plantilla === plantilla && (c.id !== 'h01' || x.calco === 'h01'))
  if (x.calco || x.modo === 'tema' || de.length < 2) return escogerCalco(b, plantilla, gancho, x.calco, Number(x.dur) || undefined)
  const lista = de.map((c: any) => `${c.id}: ${c.tramos.map((tr: any) => tr[1]).join(' ').slice(0, 700)}`).join('\n\n')
  try {
    const o = await ia(`Escoges, entre varios guiones de referencia, aquel cuyo DESARROLLO encaja mejor con lo que el creador quiere decir: el que se pueda calcar sin forzar su contenido (por ejemplo, si él explica una proporción o un filtro con números, la referencia que explica una proporción con números). El gancho preferido es «${gancho}», pero pesa menos que el encaje. Devuelves SOLO JSON {"id":"...","porque":"..."}.`,
      `${contenidoTxt(x.modo, x.texto)}

REFERENCIAS:
${lista}`)
    const c = de.find((c: any) => c.id === o?.id)
    if (c) return c
  } catch (_) { /* si falla, la de siempre */ }
  return escogerCalco(b, plantilla, gancho, undefined, Number(x.dur) || undefined)
}

function escogerCalco(b: any, plantilla: string, gancho: string, pedido?: string, dur?: number) {
  const de = b.calcos.filter((c: any) => c.plantilla === plantilla && (c.id !== 'h01' || pedido === 'h01'))
  if (!de.length) throw new Error('Esa estructura todavía no tiene referencias.')
  if (pedido) { const c = de.find((c: any) => c.id === pedido); if (c) return c }
  const mismo = de.filter((c: any) => c.gancho === gancho)
  const pool = mismo.length ? mismo : de
  const meta = dur || 75
  return pool.slice().sort((a: any, z: any) => Math.abs(a.dur - meta) - Math.abs(z.dur - meta) || z.vistas - a.vistas)[0]
}

async function accionEscribir(x: any) {
  /* (30-sep) Sergio pegó su explicación con «Solo el tema» marcado y Cherry la trató como tema: se inventó el resto. Si
     hay más de una frase, lo que escribió es lo que quiere decir. */
  if (x.modo === 'tema' && palabrasDe(String(x.texto || '')).length > 25) x.modo = 'describo'
  const b = await biblioteca()
  const pl = b.plantillas.find((p: any) => p.id === x.plantilla)
  if (!pl) throw new Error('Esa estructura no existe.')
  const g = b.ganchos.find((q: any) => q.id === x.gancho) || b.ganchos[0]
  const calco = await elegirCalco(b, pl.id, g.id, x)
  const dur = Math.min(120, Math.max(30, Number(x.dur) || Math.min(calco.dur, 95)))
  const objetivoPal = Math.round(dur * PAL_POR_SEG)
  const groserias = !!x?.cuenta?.groserias
  const sec = await secretoDe(x)
  /* El gancho que escogió el usuario manda (Sergio, 30-sep): si la referencia abría con otro, su primer tramo se
     cambia por el molde escogido, y así las palabras fijas del gancho son las de SU molde. */
  const tramos = (calco.tramos as [string, string][]).map((tr) => [tr[0], tr[1]] as [string, string])
  /* ganchoLibre: la frase es del baúl del creador, no de un molde: se usa tal cual y no se le exige forma */
  if (!x.ganchoLibre && calco.gancho !== g.id && tramos[0]?.[0] === 'G') tramos[0][1] = g.molde
  const pasosTxt = [...new Set(tramos.map((tr) => tr[0]))].map((p) => `  ${p} = ${b.pasos[p]?.nombre}: ${b.pasos[p]?.hace}`).join('\n')
  const calcoTxt = tramos.map((tr, i) => `  ${i + 1}. [${tr[0]} · ${b.pasos[tr[0]]?.nombre}] ${tr[1]}`).join('\n')

  const sis = `Escribes guiones de videos cortos CALCANDO un guion que ya funcionó: cientos de miles de vistas. No inventas la estructura: la copias.
${ESTILO}

${REGLAS_GANCHO(sec)}

${CLARIDAD}

${VERDAD}

${MUESTRA}

CÓMO SE CALCA:
· El CALCO es un guion que funcionó, partido en tramos. De él copias: cuántos tramos hay y en qué orden, lo que hace cada tramo (su paso), su largo aproximado, su ritmo (frases cortas, preguntas en voz del otro, frases que se cortan) y sus FRASES DE UNIÓN: las que no hablan del tema y le sirven a cualquiera, como «Te hablo de algo mucho más simple, y de hecho es lo único que importa para…», «Fíjate bien, porque esta última es la más importante», «Y la verdad es que todo esto no sirve de nada si no sabes cómo…», «Y justamente para eso, si pones aquí abajo la palabra…». Esas van palabra por palabra.
· Lo que en el calco habla del tema de la REFERENCIA (Instagram, visitas, un triángulo, hielo, biografías…) NO se copia: se cambia por lo equivalente en el tema de ESTE video. Si una frase del calco no tiene sentido con el tema nuevo, reescríbela entera con la misma función. Nunca dejes una frase sin sentido por respetar el calco.
· Cada frase tiene que sonar natural dicha en voz alta por alguien de Colombia y entenderse a la primera. Si suena rara o mal construida, está mal.
· CORCHETES: solo para datos reales del creador que no te dieron: su credencial, una cifra de sus resultados, el caso de un cliente, su oferta, una fecha, un nombre. Máximo 4 en todo el guion. TODO lo demás lo escribes tú, sin corchetes.
· Lo que va entre corchetes en el calco es una INSTRUCCIÓN de qué poner, no un texto para decir: nunca la leas en voz alta («[por qué eso no sirve]» se reemplaza por la razón, no se dice «por qué eso no sirve»).
· Los números de ejemplo sí los puedes poner cuando se oye que son un ejemplo («si se lo muestran a cien personas…»).
· Si el calco nombra un concepto ([NOMBRE CORTO DE LA IDEA]), ponle a la idea de ESTE video un nombre propio corto que se entienda al oírlo y que diga lo que es: mejor «la regla de la pregunta abierta» o «el grupito de prueba» que unas letras. Usa letras SOLO si cada una sale sola, es una palabra de todos los días y no hay que explicar por qué esa letra; si el calco reparte letras y no salen naturales, reparte PASOS con nombre simple («lo primero…», «lo segundo…»). Si el creador ya le puso nombre a su idea, usa el suyo.
· No repitas la credencial dos veces con las mismas palabras.
· La escena 1 usa el gancho escogido, respetando su forma (si el molde termina con una palabra que lo tumba, como «Mentira.», termina así), y no pasa de 30 palabras: el gancho se dice en unos 6 segundos.
· NUNCA inventes resultados del creador: ni «me trajo más clientes», ni «mis mensajes se llenaron», ni cifras suyas. Sus resultados son solo los que te dio en la credencial; si el calco pide más, el corchete dice QUÉ va, sin proponer una cifra: «[tu credencial: cuántas personas has ayudado]», nunca «[he ayudado a 300 personas]».
· Cuando el calco interrumpe algo (una frase que se corta con «…», alguien que calla al otro, «¡Ey!»), la interrupción se conserva: es un open loop. Tiene que haber al menos 3 momentos en que el video promete algo y lo guarda para después.
· «ve» es lo que se ve en esa escena: corto, filmable con un celular, con los recursos de pantalla de la estructura. Nunca logos ni @usuarios. Si hay una interrupción, cuéntala en «ve».
· Groserías: ${groserias ? 'sí, si el calco las trae, pero las de Colombia' : 'NO. Si el calco trae una grosería, cámbiala por una palabra fuerte sin grosería («Mentira.», «Para nada.»)'}.
· Se habla a ${PAL_POR_SEG} palabras por segundo: en total unas ${objetivoPal} palabras (el video dura unos ${dur} s). El llamado a la acción (y el remate, si hay) ocupa entre ${Math.round(objetivoPal * 0.15)} y ${Math.round(objetivoPal * 0.25)} palabras: ni más ni menos.
${x.modo === 'describo' ? `· MANDA LO QUE DIJO EL CREADOR. Antes de escribir, reparte cada idea suya en un tramo (campo «reparto»). Ninguna idea importante suya se puede quedar fuera: sus ejemplos, sus preguntas, sus pasos, lo que muestra. Si su texto termina pidiendo algo (comentar algo, escribir, seguir), ESE es el llamado a la acción y se dice casi palabra por palabra como él lo dijo; no lo cambies por una palabra clave. Del calco solo tomas la forma de alrededor: la promesa para su caso y repetir el pedido al final. Del calco sale la forma; el contenido es suyo.
` : ''}
Devuelves SOLO este JSON:
{"reparto":["tramo 1: ...", "tramo 2: ..."],"titulo":"...","concepto":"...","escenas":[{"dice":"...","ve":"..."}],"porque":"..."}
- reparto: una línea por tramo: qué contenido va en él (las ideas del creador, o el ángulo que escoges tú).
- titulo: 4 a 9 palabras, lo que diría la portada.
- concepto: el nombre propio que le pusiste a la idea, o "" si el calco no tiene.
- escenas: una por tramo del calco, en el mismo orden.
- porque: una línea: qué problema del público ataca y por qué ese ángulo.`

  const usuario0 = `LA ESTRUCTURA: ${pl.nombre}. ${pl.resumen}
LOS PASOS:
${pasosTxt}
RECURSOS DE PANTALLA DE ESTA ESTRUCTURA: ${(pl.pantalla || []).join(' · ')}

EL CALCO (${tramos.length} tramos):
${calcoTxt}

EL GANCHO ESCOGIDO: ${g.nombre}. Molde: ${g.molde} Cómo se ve: ${g.ve}${x.ganchoTexto ? `\nEl creador ya escogió esta frase exacta para el gancho; úsala palabra por palabra en la escena 1: «${t(x.ganchoTexto, 300)}»` : ''}

${contenidoTxt(x.modo, x.texto)}

${cuentaTxt(x.cuenta)}
${voz(x.voz)}`

  const limpiar = (o: any) => (Array.isArray(o?.escenas) ? o.escenas : []).slice(0, tramos.length).map((e: any, i: number) => ({
    paso: tramos[i]?.[0] || 'E', nombre: b.pasos[tramos[i]?.[0]]?.nombre || '', dice: t(e?.dice, 1200), ve: t(e?.ve, 300),
  }))
  const t0 = Date.now()
  const creador = x.modo === 'describo' ? await ideasDelCreador(x.texto) : { ideas: [] as string[], cta: '' }
  const obligatorio = creador.ideas.length ? `\n\nIDEAS OBLIGATORIAS DEL CREADOR (cada una tiene que quedar en el guion, en el tramo donde encaje; con otras palabras vale, fuera no):\n${creador.ideas.map((i, k) => `${k + 1}. ${i}`).join('\n')}${creador.cta ? `\nSU LLAMADO A LA ACCIÓN, que va palabra por palabra en el llamado a la acción: «${creador.cta}». Ese es el ÚNICO pedido del video: NO agregues una palabra clave ni otro pedido.` : ''}` : ''
  let o = await ia(sis, usuario0 + obligatorio, 'low', x._escritor || MODELO_ESCRIBIR)
  let escenas = limpiar(o)
  let m = medir(escenas, tramos, objetivoPal, groserias, !!creador.cta, !t(x?.cuenta?.credencial, 300))
  const delataG = (esc: any[]) => { const d = x.ganchoTexto ? [] : delata(esc[0]?.dice || '', sec.prohibidas); return d.length ? [`La escena 1 delata lo que el video revela (${d.join(', ')}): el gancho habla del problema, no de la respuesta.`] : [] }
  m.quejas.push(...delataG(escenas))
  m.quejas.push(...await revisarLectura(x, escenas, g, creador.ideas))
  let vueltas = 1
  // la función muere a los 150 s: sin tiempo para una segunda vuelta, se entrega con sus quejas a la vista
  if (m.quejas.length && Date.now() - t0 < 70000) {
    const o2 = await ia(sis, `${usuario0}${obligatorio}\n\nESTO YA LO ESCRIBISTE Y TIENE FALLOS. Corrígelos sin tocar lo que está bien:\n${m.quejas.map((q) => `- ${q}`).join('\n')}\n\nLo que escribiste:\n${JSON.stringify({ titulo: o.titulo, concepto: o.concepto, escenas: escenas.map((e: any) => ({ dice: e.dice, ve: e.ve })) })}`, 'low', x._escritor || MODELO_ESCRIBIR)
    const esc2 = limpiar(o2)
    const m2 = medir(esc2, tramos, objetivoPal, groserias, !!creador.cta, !t(x?.cuenta?.credencial, 300))
    m2.quejas.push(...delataG(esc2))
    m2.quejas.push(...await revisarLectura(x, esc2, g, creador.ideas))
    vueltas = 2
    if (esc2.length && m2.quejas.length <= m.quejas.length) { o = o2; escenas = esc2; m = m2 }
  }
  /* Si después de la segunda vuelta siguen marcadas frases confusas o falsas y queda tiempo, se arreglan SOLO esas
     escenas con una pasada rápida (la función muere a los 150 s). */
  const marcadas = m.quejas.filter((q) => /no se entienden|falso|sin decir de qué|credencial cuenta|delata/.test(q))
  if (marcadas.length && Date.now() - t0 < 105000) {
    try {
      const fx = await ia(`${ESTILO}
${CLARIDAD}
${VERDAD}
Arreglas un guion de video corto. Lo que está entre corchetes se queda entre corchetes, y NUNCA inventes resultados del creador (ni «mis videos retuvieron más», ni «a otros les funcionó»). Te doy las escenas numeradas y lo que está mal. Reescribe SOLO las frases señaladas (y lo justo alrededor para que encaje), sin cambiar nada más, sin alargar y sin perder la idea de cada escena. Devuelves SOLO JSON {"escenas":[{"n":1,"dice":"..."}]} con únicamente las escenas que cambiaste.`,
        'LO QUE ESTÁ MAL:\n' + marcadas.map((q) => '- ' + q).join('\n') +
        '\n\nLAS ESCENAS:\n' + escenas.map((e: any, i: number) => `${i + 1}. ${e.dice}`).join('\n'))
      const cambios = Array.isArray(fx?.escenas) ? fx.escenas : []
      const nuevas = escenas.map((e: any) => ({ ...e }))
      for (const c of cambios) { const i = Number(c?.n) - 1; if (nuevas[i] && t(c.dice, 1200)) nuevas[i].dice = t(c.dice, 1200) }
      const m3 = medir(nuevas, tramos, objetivoPal, groserias, !!creador.cta, !t(x?.cuenta?.credencial, 300))
      if (cambios.length && m3.quejas.filter((q) => !/no se entienden|falso/.test(q)).length <= m.quejas.filter((q) => !/no se entienden|falso/.test(q)).length) {
        escenas = nuevas; m = { ...m3, quejas: m3.quejas }; vueltas = 3
      }
    } catch (_) { /* se entrega la segunda vuelta */ }
  }
  /* lo que el código sabe completar solo («se vaya» → «se vaya de tu video»…), por si quedó algo */
  escenas = escenas.map((e: any) => ({ ...e, dice: completar(e.dice) }))
  return {
    titulo: t(o.titulo, 90), concepto: t(o.concepto, 60), porque: t(o.porque, 300),
    plantilla: pl.id, gancho: g.id, calco: calco.id, dur,
    escenas, huecos: m.huecos, medidas: { ...m.medidas, objetivoPalabras: objetivoPal, vueltas }, quejas: m.quejas,
  }
}

/* ════════ Motor 2: PLANEAR y después ESCRIBIR, como lo hace Claude (30-sep-2026) ════════
   Sergio: «tus guiones ya salen excelentes… haz que Cherry los haga así». La ronda 0 del auditor mostró que calcar el
   TEXTO de las referencias arrastra lo que no pega (los «error número seis, cinco, cuatro», el doctor y «mi paciente»
   en una barbería). Ahora: (1) se planea el video —problema, creencia real, lo que se revela, el nombre simple de la idea,
   el ejemplo que se ve, qué se guarda y dónde se suelta—; (2) se escribe siguiendo la FUNCIÓN de cada paso de la
   estructura, con los guiones aprobados por Sergio como modelo de cómo suena; (3) el revisor y la pasada final. */

const ORO = `GUIONES APROBADOS POR SERGIO (así suena un guion bien hecho; son de OTROS temas: copia cómo suenan, no su contenido):

— «La hora de publicar no importa» (gancho: el cebo interrumpido)
[Gancho] La mejor hora para publicar en Instagram es… (la imagen pasa a blanco y negro, suspiro)
[Descarte] Mira, si la hora fuera lo importante, todos los videos que se suben a las siete de la noche serían virales. Y no lo son.
[Aplazamiento] Lo que de verdad decide si a tu video le va bien pasa en los primeros minutos después de publicarlo, y casi nadie lo sabe.
[Concepto] Se llama el grupito de prueba. Cuando subes un video, Instagram no se lo muestra a todo el mundo. Primero se lo muestra a un grupo pequeño de personas.
[Explicación] Si ese grupito se queda viendo tu video, Instagram se lo muestra a más gente. Si esa gente también se queda, se lo muestra a más todavía. Y así, una y otra vez, hasta que se vuelve viral. Pero si el grupito pasa tu video de largo, ahí se queda.
[Objeción] ¿Y si lo subes a las tres de la mañana, cuando todo el mundo está dormido?
[Explicación] Instagram no tiene afán. Espera a que la gente se conecte y ahí le muestra tu video al grupito. La hora solo cambia cuándo empieza la prueba, no si tu video la pasa.
[Llamado a la acción] Así que deja de buscar la hora perfecta y empieza a revisar si la gente se queda viendo tu video en el primer segundo. Y tú, ¿a qué hora publicas? Escríbemelo en los comentarios.

— «El papelito que te cuesta clientes» (gancho: la pregunta de todos; la marca sale después del problema)
[Gancho] ¿Cómo hacen los restaurantes llenos para que no se les pierda ni un solo pedido?
[Escena] Viernes, ocho de la noche, el restaurante lleno. El mesero anota en una libreta: mesa cuatro, dos hamburguesas, una sin cebolla. Arranca la hoja y la deja en la cocina.
[Aplazamiento] Y ahí empieza el problema, porque ese papel tiene que aguantar tres cosas antes de convertirse en un plato.
[Lista] Lo primero: la letra. El cocinero lee «sin cebolla»… o «con cebolla». Lo segundo: el papel. Se moja, se cae detrás de la plancha o queda debajo de otro pedido. Y lo tercero es lo que más plata te cuesta.
[Se suelta] El cliente que se va bravo. La mesa cuatro ve que a la mesa seis, que llegó después, ya le sirvieron. Esa mesa te paga, pero no vuelve.
[La marca] Por eso en Cobra el pedido no pasa por un papel. El mesero lo marca en el celular y sale al instante en la pantalla de la cocina, en orden de llegada y con la nota «sin cebolla» a la vista.
[Lo que cambia] Nadie tiene que adivinar la letra de nadie, ningún pedido queda debajo de otro y la mesa cuatro come antes que la mesa seis.
[Llamado a la acción] Si tienes un restaurante, comenta COBRA y te muestro cómo se ve la cocina un viernes con la pantalla en vez de los papelitos.

— «No necesitas azúcar para tener energía» (gancho: la contra)
[Gancho] Necesitas azúcar para tener energía. Mentira.
[Descarte] Y no, no te voy a decir que dejes de comer frutas, ni que todo lo dulce sea veneno.
[Aplazamiento] Te voy a contar una diferencia que casi nadie conoce, y que explica por qué un banano y una cucharada de azúcar no le hacen lo mismo a tu cuerpo.
[Concepto] Se llama el freno de la fibra. El azúcar de mesa es mitad glucosa y mitad fructosa, lo mismo que tiene una fruta. La diferencia es que en la fruta ese dulce viene envuelto en fibra.
[Explicación] La fibra funciona como un freno: hace que el dulce de la fruta entre a tu sangre despacio. La cucharada de azúcar no trae ese freno. Entra de golpe a la sangre, te da un subidón, y al rato estás buscando otra cosa de comer.
[Objeción] ¿Y entonces de dónde saco la energía?
[Explicación] De lo que ya comes: el arroz, la papa, la avena y las frutas. Tu cuerpo convierte todo eso en energía. El azúcar que le echas al tinto no le da nada que esos alimentos no le den, y en cambio le quita el freno.
[Llamado a la acción] Comenta FRENO y te mando cinco cambios fáciles para dejar el azúcar sin pasar ganas de dulce.`

/* Las correcciones de Sergio, cortas. Cada una salió de un guion que no entendió (30-sep). */
const REGLAS2 = `LAS REGLAS DE SERGIO (cada una salió de un error real):
1. Que lo entienda cualquiera a la primera: un niño de diez años y una señora de setenta. Si explicas algo, primero di QUÉ ES en una frase simple y luego un ejemplo que se vea.
2. Nada se da por sabido: cada frase dice de qué habla («tu video», «la cocina», «tu sangre») y ningún verbo va suelto («se van DE TU VIDEO», «tu cuenta DE INSTAGRAM», «subir UN VIDEO»).
3. Nunca «el primero», «la segunda» ni un número sin decir de qué: «lo primero: la letra», «tres cosas», «abres tres preguntas».
4. Frases completas, con sus artículos, como se habla: «mejorar LA retención», «retener A LA gente».
5. Nada falso. Lo que se tumba con «Mentira.» es algo que la gente DE VERDAD cree, dicho en positivo. Nunca inventes resultados del creador: si no te dio su prueba, no la menciones.
6. El gancho NO regala el video: habla del problema de quien mira o del tema, nunca de la respuesta ni del nombre del concepto.
7. Sin metáforas abstractas ni dichos (hambre, llave, puerta en la cabeza, «morderse la lengua»), sin palabras de España («vale», «mola»), sin voseo («decís», «tenés»), sin «todas» para hablar de la gente.
8. Prohibido el eslogan de valla: «no es X, es Y», «sin X, sin Y», tríos por ritmo, «¿el secreto?», «así de simple».
9. Cada escena hace UNA cosa de la estructura. Nada de rellenos que no tengan que ver con el tema.
10. La marca o el producto solo aparece después de la mitad, cuando ya se vio el problema.`

async function accionPlanear(x: any) {
  const b = await biblioteca()
  const pl = b.plantillas.find((p: any) => p.id === x.plantilla)
  if (!pl) throw new Error('Esa estructura no existe.')
  const g = b.ganchos.find((q: any) => q.id === x.gancho) || b.ganchos[0]
  if (x.modo === 'tema' && palabrasDe(String(x.texto || '')).length > 25) x.modo = 'describo'
  /* ronda 1: sin prueba del creador, la escena de la credencial salía vacía («Mira.») o inventada («analicé 120 videos») */
  const sinPrueba = !t(x?.cuenta?.credencial, 300)
  const pasosTxt = (pl.pasos || []).filter((p: any) => !(sinPrueba && p.p === 'C')).map((p: any) => `  ${p.p} = ${b.pasos[p.p]?.nombre}${p.opcional ? ' (opcional)' : ''}: ${b.pasos[p.p]?.hace}`).join('\n')
  const sis = `Eres el mejor guionista de videos cortos de Colombia. Antes de escribir un guion, lo PIENSAS. Devuelves SOLO JSON con el plan:
{"problema":"...","creencia":"...","revela":"...","concepto":"...","queEs":"...","ejemplo":"...","objecion":"...","guardados":[{"promete":"...","suelta":"..."}],"cta":"...","palabra":"...","escenas":[{"paso":"G","hace":"..."}]}
- problema: lo que le pasa a quien mira, como lo diría él (máx. 16 palabras).
- creencia: algo que la gente DE VERDAD cree sobre esto y que el video desmiente, dicho en positivo; "" si no hay una real.
- revela: lo que el video enseña, la respuesta (máx. 16 palabras).
- concepto: un nombre simple para la idea, que diga lo que es («el grupito de prueba», «el freno de la fibra»); "" si no hace falta.
- queEs: el concepto o la respuesta explicada en UNA frase que entienda un niño.
- ejemplo: algo concreto que se pueda ver o imaginar y que muestre la idea (con números de ejemplo si ayuda).
- objecion: la duda que tendría quien mira justo después de entenderlo, dicha como pregunta.
- guardados: de 2 a 3 cosas que el video promete y no dice todavía, y en qué escena las suelta.
- cta: el pedido final y lo que recibe quien lo hace${x?.cuenta?.oferta ? '' : ' (sin oferta: invita a comentar algo de su caso)'}.
- palabra: la palabra para comentar (la del creador si la dio) o "" si el pedido no la necesita.
- escenas: de 7 a 9, en el orden de la estructura, una por paso (el paso Explicación puede ir dos veces; Objeción puede entrar si ayuda). «hace»: qué pasa en esa escena, en una línea.
Verdad ante todo: si el texto del creador trae algo falso o confundido, corrígelo en el plan para que sea verdad.
NADA INVENTADO QUE PAREZCA REAL: ni resultados del creador («analicé 120 videos», «200 likes y 600», «ayudé a 27 personas»), ni casos de clientes, ni estudios. ${sinPrueba ? 'El creador NO dio una prueba: no hay escena de credencial y no se menciona ninguna.' : ''} Los números solo como ejemplo claro («imagina que…», «por ejemplo, de cien personas…»).
SIMPLE: una sola idea principal y UN ejemplo que se vea. Nada técnico: sin medidas (cm, grados, gramos, ml, calorías exactas), sin jerga del oficio (press militar, macros, balance de blancos). Lo que el creador pueda explicar con palabras de la casa, así.`
  const usu = `LA ESTRUCTURA: ${pl.nombre}. ${pl.resumen}
SUS PASOS (en este orden):
${pasosTxt}
EL GANCHO ESCOGIDO: ${g.nombre}. Molde: ${g.molde}${x.ganchoTexto ? `\nLA FRASE DEL GANCHO, ya escogida: «${t(x.ganchoTexto, 300)}»` : ''}

${contenidoTxt(x.modo, x.texto)}

${cuentaTxt(x.cuenta)}`
  const o = await ia(sis, usu, 'medium', x._escritor || MODELO_ESCRIBIR)
  const okPaso = new Set(Object.keys(b.pasos))
  const escenas = (Array.isArray(o?.escenas) ? o.escenas : []).map((e: any) => ({ paso: okPaso.has(e?.paso) ? e.paso : 'E', hace: t(e?.hace, 240) })).filter((e: any) => e.hace).slice(0, 10)
  return {
    plan: {
      problema: t(o?.problema, 200), creencia: t(o?.creencia, 220), revela: t(o?.revela, 220), concepto: t(o?.concepto, 80),
      queEs: t(o?.queEs, 300), ejemplo: t(o?.ejemplo, 400), objecion: t(o?.objecion, 200),
      guardados: (Array.isArray(o?.guardados) ? o.guardados : []).map((q: any) => ({ promete: t(q?.promete, 200), suelta: t(q?.suelta, 120) })).filter((q: any) => q.promete).slice(0, 3),
      cta: t(o?.cta, 300), palabra: t(o?.palabra, 30), escenas,
    },
    plantilla: pl.id, gancho: g.id, modo: x.modo,
  }
}

async function accionEscribir2(x: any) {
  const b = await biblioteca()
  const pl = b.plantillas.find((p: any) => p.id === x.plantilla)
  if (!pl) throw new Error('Esa estructura no existe.')
  const g = b.ganchos.find((q: any) => q.id === x.gancho) || b.ganchos[0]
  const plan = x.plan
  const t0 = Date.now()
  const groserias = !!x?.cuenta?.groserias
  const dur = Math.min(110, Math.max(40, Number(x.dur) || 75))
  const objetivoPal = Math.round(dur * PAL_POR_SEG)
  const creador = x.modo === 'describo' ? await ideasDelCreador(x.texto) : { ideas: [] as string[], cta: '' }
  const prohibidas = palabrasDe(plan.concepto || '').length ? [String(plan.concepto).toLowerCase()] : []
  const planTxt = `EL PLAN DEL VIDEO:
- Problema de quien mira: ${plan.problema}
- Lo que la gente cree (y el video desmiente): ${plan.creencia || '(nada)'}
- Lo que el video revela: ${plan.revela}
- El nombre de la idea: ${plan.concepto || '(sin nombre)'} — qué es: ${plan.queEs}
- El ejemplo que se ve: ${plan.ejemplo}
- La duda de quien mira: ${plan.objecion}
- Lo que se promete y se suelta después: ${(plan.guardados || []).map((q: any) => `«${q.promete}» (se suelta en ${q.suelta})`).join('; ')}
- El cierre: ${plan.cta}${plan.palabra ? ` (palabra: ${plan.palabra})` : ''}
LAS ESCENAS:
${(plan.escenas || []).map((e: any, i: number) => `  ${i + 1}. [${e.paso} · ${b.pasos[e.paso]?.nombre}] ${e.hace}`).join('\n')}`
  const sis = `Eres el mejor guionista de videos cortos de Colombia. Escribes el guion a partir del plan, escena por escena, hablado como habla la gente en Colombia.
${ORO}

${REGLAS2}

CÓMO SE ESCRIBE:
· Una escena por cada escena del plan, en el mismo orden. «dice» es lo que sale por la boca; «ve» es el plano, corto y filmable con un celular.
· La escena 1 es el gancho: ${x.ganchoTexto ? `«${t(x.ganchoTexto, 300)}», palabra por palabra.` : `sigue el molde «${g.molde}», máx. 25 palabras.`}
· Lo que el plan guarda se promete y NO se dice hasta su escena.
· Frases completas y conversadas, como en los guiones aprobados. Nada de estilo lista o telegrama («Plato a 60 cm de la ventana. Luz a 45°»), nada de medidas ni palabras técnicas, nada de números que parezcan resultados reales del creador.
· Tutea siempre${x?.voz?.tono?.formal >= 75 ? ' (la marca usa usted: usted siempre)' : ''}; no mezcles tú y usted.
· En total unas ${objetivoPal} palabras (unos ${dur} s a 3,4 palabras por segundo) y NUNCA más de ${Math.round(objetivoPal * 1.15)}: si sobra, quita ejemplos de más, no ideas del creador. El llamado a la acción, corto: una o dos frases.
· Groserías: ${groserias ? 'sí, las de Colombia, con medida' : 'no'}.
${creador.ideas.length ? `· Las ideas del creador tienen que quedar todas: ${creador.ideas.map((i) => '«' + i + '»').join(' ')}${creador.cta ? `. Su pedido final va palabra por palabra: «${creador.cta}»` : ''}.` : ''}
Devuelves SOLO JSON {"titulo":"...","escenas":[{"paso":"G","dice":"...","ve":"..."}]}`
  const usu = `${planTxt}\n\n${cuentaTxt(x.cuenta)}\n${voz(x.voz)}`
  const limpiar = (o: any) => (Array.isArray(o?.escenas) ? o.escenas : []).map((e: any, i: number) => {
    const paso = (plan.escenas || [])[i]?.paso || e?.paso || 'E'
    return { paso, nombre: b.pasos[paso]?.nombre || '', dice: t(e?.dice, 1200), ve: t(e?.ve, 300) }
  }).filter((e: any) => e.dice)
  let o = await ia(sis, usu, 'medium', x._escritor || MODELO_ESCRIBIR)
  let escenas = limpiar(o)
  const revisar = async (esc: any[]) => {
    const m = medir(esc, [], objetivoPal, groserias, !!creador.cta, !t(x?.cuenta?.credencial, 300))
    m.quejas = m.quejas.filter((q) => !/Tiene \d+ escenas y el calco|conservaste|Te alejaste demasiado del calco|el calco tiene/.test(q))
    if (!x.ganchoTexto) { const d = delata(esc[0]?.dice || '', prohibidas); if (d.length) m.quejas.push(`La escena 1 delata lo que el video revela (${d.join(', ')}): el gancho habla del problema, no de la respuesta.`) }
    m.quejas.push(...await revisarLectura(x, esc, g, creador.ideas))
    return m
  }
  let m = await revisar(escenas)
  let vueltas = 1
  const graves = (q: string[]) => q.filter((z) => /no se entienden|falso|sin decir de qué|credencial cuenta|delata|Se quedaron fuera|voseo|grosería|valla|Quedó largo/.test(z))
  if (graves(m.quejas).length && Date.now() - t0 < 95000) {
    try {
      const fx = await ia(`${ESTILO}\n${CLARIDAD}\n${VERDAD}\n${REGLAS2}\nArreglas un guion de video corto. Reescribe SOLO lo señalado (y lo justo alrededor para que encaje), sin alargar y sin perder la idea de cada escena. Si dice «Quedó largo», acorta las escenas más largas (quita ejemplos repetidos y explicaciones dobles, nunca las ideas del creador) hasta el largo pedido: para eso puedes tocar todas las escenas menos la 1. Lo que está entre corchetes se queda. Devuelves SOLO JSON {"escenas":[{"n":1,"dice":"..."}]} con únicamente las escenas que cambiaste.`,
        'LO QUE ESTÁ MAL:\n' + graves(m.quejas).map((q) => '- ' + q).join('\n') + '\n\nLAS ESCENAS:\n' + escenas.map((e: any, i: number) => `${i + 1}. ${e.dice}`).join('\n'), 'low', x._escritor || MODELO_ESCRIBIR)
      const nuevas = escenas.map((e: any) => ({ ...e }))
      for (const c of (Array.isArray(fx?.escenas) ? fx.escenas : [])) { const i = Number(c?.n) - 1; if (nuevas[i] && t(c.dice, 1200)) nuevas[i].dice = t(c.dice, 1200) }
      escenas = nuevas; vueltas = 2
      if (Date.now() - t0 < 120000) m = await revisar(escenas)
    } catch (_) { /* se entrega la primera */ }
  }
  escenas = escenas.map((e: any) => ({ ...e, dice: completar(e.dice, esDeVideos(x)) }))
  return {
    titulo: t(o?.titulo, 90), concepto: plan.concepto || '', plantilla: pl.id, gancho: g.id, calco: 'plan', dur,
    escenas, huecos: m.huecos, medidas: { ...m.medidas, objetivoPalabras: objetivoPal, vueltas }, quejas: m.quejas, plan,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)
    const x = await req.json()
    MODELO_PRUEBA = uid === 'interno' && ['gpt-5', 'gpt-5-mini', 'claude-sonnet-5', 'claude-opus-5-5'].includes(x.modelo) ? x.modelo : ''
    ESFUERZO_PRUEBA = uid === 'interno' && ['low', 'medium', 'high'].includes(x.esfuerzo) ? x.esfuerzo : ''
    USO = { entrada: 0, salida: 0 }
    x._escritor = ['ganchos', 'planear', 'escribir'].includes(x.accion) ? await escritorDe(uid) : 'gpt-5'
    const t0 = Date.now()
    let r: unknown
    if (x.accion === 'biblioteca') r = await accionBiblioteca()
    else if (x.accion === 'problemas') r = await accionProblemas(x)
    else if (x.accion === 'ideas') r = await accionIdeas(x)
    else if (x.accion === 'ganchos') r = await accionGanchos(x)
    else if (x.accion === 'planear') r = await accionPlanear(x)
    else if (x.accion === 'escribir') r = x.plan ? await accionEscribir2(x) : await accionEscribir(x)
    else return responder({ error: 'acción desconocida' }, 400)
    console.log(`[guion-calco] ${x.accion} de ${uid.slice(0, 8)} en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    if (uid === 'interno' && MODELO_PRUEBA && r && typeof r === 'object') (r as any)._uso = USO
    return responder(r)
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

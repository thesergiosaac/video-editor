// guion-calco v17 (30-sep-2026) — Cherry escribe guiones CALCANDO referencias que ya funcionaron.
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
const MODELO_ESCRIBIR = 'gpt-5'

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
let MODELO_PRUEBA = ''
async function ia(sistema: string, usuarioTxt: string, esfuerzo = 'low', principal = 'gpt-5-mini'): Promise<any> {
  for (const modelo of [...new Set([MODELO_PRUEBA || principal, 'gpt-5-mini', 'gpt-4o-mini'])]) {
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
const GROSERIAS = /\b(mierda|jodid[oa]s?|joder|co[ñn]o|cojones|puta|put[oa]s?|carajo|hijueputa|marica|gonorrea|verga)\b/i
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
  if (sinCredencial && escenas.some((e) => e.paso === 'C' && !/\[[^\]]+\]/.test(e.dice) && /(mis|me|logr[eé]|consegu[ií]|llegu[eé]|he hecho|mis clientes|me funcion)/i.test(e.dice)))
    quejas.push('La escena de la credencial cuenta resultados del creador que él no te dio: déjala con el hueco entre corchetes, por ejemplo «[tu prueba: seguidores, clientes o resultados]».')
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
- confusas: las frases del guion (cópialas tal cual, máx. 8) que una persona común de Colombia, sin saber del tema, NO entendería a la primera al oírlas: metáforas abstractas, ideas que no se explican, palabras técnicas, dichos, frases que suenan a traducción o mal construidas, frases sin sus artículos («para mejorar retención»), «el primero» / «lo segundo» / números sueltos sin decir de qué («abres 3, cierras 1»), y cosas que no tienen que ver con el tema del video. Si todas se entienden, [].
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
- prohibidas: las palabras o nombres que delatarían el secreto si salieran en la primera frase (el nombre del concepto, sus sinónimos y la respuesta en sí), de 1 a 6, en minúsculas.
- problema: lo que le pasa a la persona que mira, dicho como lo diría ella, SIN mencionar el secreto (máx. 16 palabras). Ej.: «la gente se va de mis videos en los primeros segundos».`, `${contenidoTxt(x.modo, x.texto)}`)
    return { secreto: t(o?.secreto, 160), prohibidas: (Array.isArray(o?.prohibidas) ? o.prohibidas : []).map((w: any) => t(w, 40).toLowerCase()).filter((w: string) => w.length > 2).slice(0, 6), problema: t(o?.problema, 200) }
  } catch (_) { return { secreto: '', prohibidas: [], problema: '' } }
}
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
· Para hablar de la gente, «todo el mundo», «la gente» o «todos», nunca «todas».
· La creencia que se tumba tiene que ser sensata y real, dicha como la dice la gente. Nada de afirmaciones raras o absolutas que nadie diría («la fórmula es solo contenido perfecto y listo»).`

async function accionGanchos(x: any) {
  const b = await biblioteca()
  const sec = await secretoDe(x)
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
  const o = await ia(sis, `${contenidoTxt(x.modo, x.texto)}\n${cuentaTxt(x.cuenta)}`)
  const porId: Record<string, any> = {}
  for (const g of (Array.isArray(o.ganchos) ? o.ganchos : [])) if (g?.id) porId[g.id] = g
  let lista = b.ganchos.map((g: any) => ({ id: g.id, nombre: g.nombre, molde: g.molde, dice: t(porId[g.id]?.dice, 260), ve: t(porId[g.id]?.ve, 160) })).filter((g: any) => g.dice)
  /* los que delatan el secreto (o dicen «todas») se reescriben una vez */
  /* (30-sep) dos ganchos copiaron el TEMA del ejemplo del molde («la mejor hora para publicar», «subo dos videos al día») */
  const ejemploDe = (id: string) => (b.ganchos.find((q: any) => q.id === id) || {}).ejemplo || ''
  const copiaEjemplo = (g: any) => { const e = new Set(palabrasDe(ejemploDe(g.id)).filter((w) => w.length > 3)); const d = palabrasDe(g.dice).filter((w) => w.length > 3); return d.length > 0 && d.filter((w) => e.has(w)).length / d.length > 0.45 }
  const malos = lista.filter((g: any) => delata(g.dice, sec.prohibidas).length || /\btodas\b/i.test(g.dice) || copiaEjemplo(g))
  if (malos.length) {
    try {
      const fx = await ia(`${ESTILO}\n${REGLAS_GANCHO(sec)}\nReescribes estos ganchos: cada uno delata lo que el video revela, habla de la gente como «todas», o copia el TEMA del ejemplo del molde en vez de hablar del tema de este video. Mantén su molde y habla del problema de ESTE video. Devuelves SOLO JSON {"ganchos":[{"id":"...","dice":"..."}]}.`,
        malos.map((g: any) => `${g.id} (molde: ${g.molde}; ejemplo que NO se copia: ${ejemploDe(g.id)}): ${g.dice}${delata(g.dice, sec.prohibidas).length ? ' — delata: ' + delata(g.dice, sec.prohibidas).join(', ') : ''}`).join('\n'))
      for (const c of (Array.isArray(fx?.ganchos) ? fx.ganchos : [])) {
        const g = lista.find((y: any) => y.id === c?.id)
        if (g && t(c.dice, 260) && !delata(c.dice, sec.prohibidas).length) g.dice = t(c.dice, 260)
      }
    } catch (_) { /* se quedan los de la primera vuelta */ }
    lista = lista.filter((g: any) => !delata(g.dice, sec.prohibidas).length)   /* el que siga delatando, no se ofrece */
  }
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
  let o = await ia(sis, usuario0 + obligatorio, 'low', MODELO_ESCRIBIR)
  let escenas = limpiar(o)
  let m = medir(escenas, tramos, objetivoPal, groserias, !!creador.cta, !t(x?.cuenta?.credencial, 300))
  const delataG = (esc: any[]) => { const d = x.ganchoTexto ? [] : delata(esc[0]?.dice || '', sec.prohibidas); return d.length ? [`La escena 1 delata lo que el video revela (${d.join(', ')}): el gancho habla del problema, no de la respuesta.`] : [] }
  m.quejas.push(...delataG(escenas))
  m.quejas.push(...await revisarLectura(x, escenas, g, creador.ideas))
  let vueltas = 1
  // la función muere a los 150 s: sin tiempo para una segunda vuelta, se entrega con sus quejas a la vista
  if (m.quejas.length && Date.now() - t0 < 70000) {
    const o2 = await ia(sis, `${usuario0}${obligatorio}\n\nESTO YA LO ESCRIBISTE Y TIENE FALLOS. Corrígelos sin tocar lo que está bien:\n${m.quejas.map((q) => `- ${q}`).join('\n')}\n\nLo que escribiste:\n${JSON.stringify({ titulo: o.titulo, concepto: o.concepto, escenas: escenas.map((e: any) => ({ dice: e.dice, ve: e.ve })) })}`, 'low', MODELO_ESCRIBIR)
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
  return {
    titulo: t(o.titulo, 90), concepto: t(o.concepto, 60), porque: t(o.porque, 300),
    plantilla: pl.id, gancho: g.id, calco: calco.id, dur,
    escenas, huecos: m.huecos, medidas: { ...m.medidas, objetivoPalabras: objetivoPal, vueltas }, quejas: m.quejas,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)
    const x = await req.json()
    MODELO_PRUEBA = uid === 'interno' && ['gpt-5', 'gpt-5-mini'].includes(x.modelo) ? x.modelo : ''
    const t0 = Date.now()
  const creador = x.modo === 'describo' ? await ideasDelCreador(x.texto) : { ideas: [] as string[], cta: '' }
  const obligatorio = creador.ideas.length ? `\n\nIDEAS OBLIGATORIAS DEL CREADOR (cada una tiene que quedar en el guion, en el tramo donde encaje; con otras palabras vale, fuera no):\n${creador.ideas.map((i, k) => `${k + 1}. ${i}`).join('\n')}${creador.cta ? `\nSU LLAMADO A LA ACCIÓN, que va palabra por palabra en el llamado a la acción: «${creador.cta}». Ese es el ÚNICO pedido del video: NO agregues una palabra clave ni otro pedido.` : ''}` : ''
    let r: unknown
    if (x.accion === 'biblioteca') r = await accionBiblioteca()
    else if (x.accion === 'problemas') r = await accionProblemas(x)
    else if (x.accion === 'ideas') r = await accionIdeas(x)
    else if (x.accion === 'ganchos') r = await accionGanchos(x)
    else if (x.accion === 'escribir') r = await accionEscribir(x)
    else return responder({ error: 'acción desconocida' }, 400)
    console.log(`[guion-calco] ${x.accion} de ${uid.slice(0, 8)} en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    return responder(r)
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

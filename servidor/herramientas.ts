// herramientas v1 (19-sep-2026) — la IA de las herramientas del inicio de Cherry (Guiones, Storyboard, Carruseles, Calendario).
// Con sesión de usuario (la llama la página). Acciones:
//   · guion_escribir {tema, publico, tono, dur, frases, voz}        → {titulo, gancho, puntos[], cierre}
//   · guion_ganchos {tema, gancho, tono, dur, voz}                    → {ganchos:[{tecnica, texto}]}
//   · storyboard_partir {texto, meta}                                 → {titulo, escenas:[{tipo, dice, plano, lugar, objeto, gesto, apoyo}]}
//   · carrusel_armar {fuente, texto, tema, publico, n, voz}           → {nombre, kicker, ganchos[3], sub, ideas[[t,x]], cierre[t,x,accion], intro, pregunta, tags[]}
//   · publicacion_texto {titulo, tipo, detalle, voz}                  → {caption, tags[]}
//   · lab_desmontar {texto, dur}                                      → {gancho, estructura[], mapa, formato, loops[], cadena, idea, alcance, contra, ritmo}
//   · lab_auditar {nuevo, control, cambia}                            → {sirve, filas[{campo, estado, nota}], arreglo}
// gpt-5-mini (esfuerzo bajo) con respaldo gpt-4o-mini. No guarda nada: la página guarda lo que el usuario acepta.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

async function usuario(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  // pruebas del servidor (la misma llave interna de las otras funciones)
  if ([Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v).includes(token)) return 'interno'
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' ? u.id : null
  } catch (_) { return null }
}

const ESTILO = `Escribes en español de Colombia, cercano y claro, para videos cortos de redes (Reels, TikTok) de creadores y emprendedores.
Reglas de estilo (obligatorias):
- Frases cortas que se entiendan al oírlas una vez. Nada de palabras rebuscadas ni de jerga de marketing.
- PROHIBIDAS las fórmulas de valla publicitaria: «No es X, es Y», «Sin X, sin Y», tríos por ritmo («rápido, fácil y barato»), «¿El secreto? …», «Así de simple», «Spoiler:», «Punto.». Léelo en voz alta: si suena a anuncio, cámbialo.
- Concreto: ejemplos, números y situaciones reales antes que ideas abstractas. Nada inventado que parezca un dato real (si das un número, que sea un ejemplo claro).
- Sin emojis, sin hashtags dentro del guion, sin saludos largos.`

function voz(v: any): string {
  if (!v || typeof v !== 'object') return ''
  const t = v.tono || {}
  const nivel = (x: any, a: string, b: string) => { const n = Number(x); return !Number.isFinite(n) ? '' : n <= 25 ? a : n >= 75 ? b : `entre ${a} y ${b}` }
  const partes = [nivel(t.formal, 'cercano (tutea)', 'formal (usa usted)'), nivel(t.serio, 'divertido', 'serio'), nivel(t.experto, 'sencillo', 'experto'), nivel(t.energia, 'calmado', 'enérgico')].filter(Boolean)
  const frases = Array.isArray(v.frases) ? v.frases.filter((f: any) => f && f.texto).slice(0, 8).map((f: any) => `${f.tipo || 'frase'}: «${String(f.texto).slice(0, 140)}»`) : []
  return (partes.length ? `Tono de la marca: ${partes.join(', ')}.` : '') + (frases.length ? `\nFrases de la marca (úsalas tal cual si encajan, sin forzarlas):\n${frases.join('\n')}` : '')
}

async function ia(sistema: string, usuarioTxt: string, esfuerzo = 'low'): Promise<any> {
  for (const modelo of ['gpt-5-mini', 'gpt-4o-mini']) {
    const cuerpo: Record<string, unknown> = { model: modelo, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuarioTxt }] }
    if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = esfuerzo; cuerpo.max_completion_tokens = 12000 }
    else { cuerpo.temperature = 0.7; cuerpo.max_tokens = 3000 }
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), 55000)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: control.signal,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      })
      if (!r.ok) { console.warn(`[herramientas] ${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      const j = await r.json()
      const out = JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
      if (out && typeof out === 'object') return out
    } catch (e) { console.warn(`[herramientas] ${modelo} falló:`, String(e)) }
    finally { clearTimeout(reloj) }
  }
  throw new Error('La IA no respondió. Intenta otra vez.')
}

const t = (s: any, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
// si se pasa, se corta al final de una frase (o de una palabra, con …) — nunca a la mitad de una cuenta
function corta(s: any, n: number): string {
  const x = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (x.length <= n) return x
  const c = x.slice(0, n), fin = Math.max(c.lastIndexOf('. '), c.lastIndexOf('? '), c.lastIndexOf('! '))
  if (fin > n * 0.5) return c.slice(0, fin + 1)
  return c.slice(0, c.lastIndexOf(' ')).replace(/[,;:=+\-×/]+$/, '').trim() + '…'
}
const TONOS: Record<string, string> = { cercano: 'cercano, como hablándole a un amigo', experto: 'experto y claro, con método', divertido: 'divertido, con humor ligero', inspirador: 'inspirador, con una historia personal' }

async function guionEscribir(b: any) {
  const dur = [15, 30, 60, 90].includes(Number(b.dur)) ? Number(b.dur) : 60
  const palabras = Math.round(dur * 2.5)
  const puntos = dur <= 15 ? 1 : dur <= 30 ? 2 : dur <= 60 ? 3 : 5
  const frases = Array.isArray(b.frases) ? b.frases.slice(0, 8).map((f: any) => `«${t(f, 140)}»`).join('\n') : ''
  const sis = `${ESTILO}\nEscribes guiones para hablar a cámara. Devuelves SOLO JSON {"titulo":"...","gancho":"...","puntos":["..."],"cierre":"..."}.
- titulo: 4 a 9 palabras, con mayúscula inicial, sin punto final.
- gancho: la primera frase, la que hace que no pasen de largo (máx. 22 palabras). Empieza fuerte, sin saludar.
- puntos: ${puntos} punto(s) de desarrollo, una idea por punto, con un ejemplo concreto.
- cierre: qué hacer al terminar (guardar, comentar, escribir), natural. Si una de las frases del creador encaja, úsala tal cual.
- En total unas ${palabras} palabras (se habla a 150 por minuto: el video debe durar unos ${dur} s).`
  const usu = `Tema: ${t(b.tema, 300)}\nA quién le habla: ${t(b.publico, 200) || 'personas que siguen al creador'}\nTono: ${TONOS[b.tono] || TONOS.cercano}\n${voz(b.voz)}${frases ? `\nFrases del creador:\n${frases}` : ''}`
  const o = await ia(sis, usu)
  const pts = (Array.isArray(o.puntos) ? o.puntos : []).map((p: any) => corta(p, 700)).filter(Boolean).slice(0, 6)
  return { titulo: t(o.titulo, 90) || t(b.tema, 90), gancho: t(o.gancho, 300), puntos: pts.length ? pts : [''], cierre: t(o.cierre, 400) }
}

async function guionGanchos(b: any) {
  const sis = `${ESTILO}\nPropones ganchos (la primera frase de un video corto). Devuelves SOLO JSON {"ganchos":[{"tecnica":"Pregunta","texto":"..."}]} con exactamente 3, cada uno con una técnica distinta entre: Pregunta, Historia, Promesa, Error común, Dato que sorprende, Contradicción. Máx. 20 palabras cada uno, que se digan en 3 segundos.`
  const usu = `Tema del video: ${t(b.tema, 300)}\nGancho actual: ${t(b.gancho, 300) || '(no tiene)'}\nTono: ${TONOS[b.tono] || TONOS.cercano}\n${voz(b.voz)}`
  const o = await ia(sis, usu)
  const g = (Array.isArray(o.ganchos) ? o.ganchos : []).map((x: any) => ({ tecnica: t(x?.tecnica, 24) || 'Gancho', texto: t(x?.texto, 220) })).filter((x: any) => x.texto).slice(0, 3)
  return { ganchos: g }
}

const PLANOS = ['primer', 'medio', 'detalle', 'apoyo', 'pantalla']
const TIPOS = ['Gancho', 'Idea', 'Prueba', 'Cierre']
async function storyboardPartir(b: any) {
  const meta = [30, 60, 90].includes(Number(b.meta)) ? Number(b.meta) : 60
  const sis = `Eres director de videos cortos grabados con el celular en casa. Partes un guion en escenas para grabar sin adivinar. Devuelves SOLO JSON {"titulo":"...","escenas":[{"tipo":"Gancho","dice":"...","plano":"primer","lugar":"...","objeto":"...","gesto":"...","apoyo":"..."}]}.
- tipo: Gancho (la primera), Idea, Prueba (cuando hay un dato, caso o resultado) o Cierre (la última).
- dice: lo que se dice en esa escena, copiado del guion (sin cambiar palabras). Para escenas de apoyo sin voz: qué se ve.
- plano: primer (cara y hombros), medio (cintura arriba), detalle (manos u objeto), apoyo (toma sin hablar que acompaña) o pantalla (grabación de pantalla). Varía el plano: no repitas el mismo dos veces seguidas si se puede. El gancho casi siempre en primer plano.
- lugar, objeto, gesto: notas cortas y prácticas para una casa (máx. 7 palabras cada una; objeto vacío si no hace falta).
- apoyo: una toma sin hablar que acompañaría esa escena (máx. 10 palabras), o "" si no hace falta.
- Entre 3 y 10 escenas, pensando en un video de unos ${meta} s. Si el guion es largo, junta frases; si es corto, no inventes texto.
- titulo: 4 a 9 palabras para el video.`
  const o = await ia(sis, `Guion:\n${t(b.texto, 6000)}`)
  const esc = (Array.isArray(o.escenas) ? o.escenas : []).map((e: any, i: number, arr: any[]) => ({
    tipo: TIPOS.includes(e?.tipo) ? e.tipo : (i === 0 ? 'Gancho' : i === arr.length - 1 ? 'Cierre' : 'Idea'),
    dice: t(e?.dice, 700), plano: PLANOS.includes(e?.plano) ? e.plano : 'medio',
    lugar: t(e?.lugar, 60), objeto: t(e?.objeto, 60), gesto: t(e?.gesto, 60), apoyo: t(e?.apoyo, 90),
  })).filter((e: any) => e.dice).slice(0, 12)
  return { titulo: t(o.titulo, 90), escenas: esc }
}

async function carruselArmar(b: any) {
  const n = Math.max(3, Math.min(10, Math.round(Number(b.n) || 6)))
  const sis = `${ESTILO}\nArmas carruseles de Instagram (láminas 4:5) que la gente guarda. Devuelves SOLO JSON:
{"nombre":"...","kicker":"...","ganchos":["...","...","..."],"sub":"...","ideas":[["título","texto"]],"cierre":["pregunta o título","texto","botón"],"intro":"...","pregunta":"...","tags":["..."]}
- ganchos: 3 portadas distintas (máx. 70 letras cada una). Puedes usar el número de ideas (${n}).
- kicker: frase pequeña de arriba de la portada (máx. 30 letras), p. ej. a quién va dirigido.
- sub: una línea de apoyo para la portada (máx. 90 letras).
- ideas: exactamente ${n}, cada una con título corto (máx. 45 letras) y texto (máx. 150 letras) con algo concreto que se pueda aplicar.
- cierre: [título (máx. 45), texto (máx. 150) que invite a guardar o comentar, botón corto (máx. 28 letras)].
- intro: 1 frase para empezar el texto de la publicación. pregunta: 1 pregunta para los comentarios.
- tags: 8 a 12 hashtags en minúscula, sin #, en español, relevantes (nada genérico tipo "love").
- nombre: nombre corto para guardar el carrusel (máx. 60 letras).`
  const fuente = b.texto ? `Contenido de base (${t(b.fuente, 20) || 'texto'}):\n${t(b.texto, 6000)}` : `Tema: ${t(b.tema, 300)}`
  const usu = `${fuente}\nPara quién: ${t(b.publico, 200) || 'emprendedores y creadores'}\n${voz(b.voz)}`
  const o = await ia(sis, usu)
  const ideas = (Array.isArray(o.ideas) ? o.ideas : []).map((x: any) => Array.isArray(x) ? [corta(x[0], 60), corta(x[1], 190)] : [corta(x?.titulo, 60), corta(x?.texto, 190)]).filter((x: any) => x[0]).slice(0, n)
  const c = Array.isArray(o.cierre) ? o.cierre : []
  return {
    nombre: t(o.nombre, 70), kicker: t(o.kicker, 40), sub: t(o.sub, 120),
    ganchos: (Array.isArray(o.ganchos) ? o.ganchos : []).map((g: any) => t(g, 90)).filter(Boolean).slice(0, 3),
    ideas, cierre: [t(c[0], 60) || '¿Cuál te sirvió más?', corta(c[1], 190) || 'Cuéntame en los comentarios y guarda este carrusel.', t(c[2], 30) || 'Guárdalo'],
    intro: t(o.intro, 300), pregunta: t(o.pregunta, 160),
    tags: (Array.isArray(o.tags) ? o.tags : []).map((x: any) => t(x, 40).replace(/^#/, '').toLowerCase().replace(/[^a-z0-9ñáéíóú_]/g, '')).filter(Boolean).slice(0, 15),
  }
}

async function publicacionTexto(b: any) {
  const sis = `${ESTILO}\nEscribes el texto que va debajo de una publicación de Instagram/TikTok. Devuelves SOLO JSON {"caption":"...","tags":["..."]}.
- caption: 2 a 5 frases cortas en párrafos (usa \\n\\n entre párrafos), empieza con una frase que dé ganas de ver, termina con una pregunta o una invitación a guardar. Máx. 600 letras.
- tags: 4 o 5 hashtags en minúscula, sin #, en español, relevantes.`
  const o = await ia(sis, `Publicación: ${t(b.tipo, 20) || 'video'} «${t(b.titulo, 140)}»\n${b.detalle ? `De qué trata: ${t(b.detalle, 1500)}\n` : ''}${voz(b.voz)}`)
  return { caption: t(o.caption, 900).replace(/\\n/g, '\n'), tags: (Array.isArray(o.tags) ? o.tags : []).map((x: any) => t(x, 40).replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 5) }
}


/* ── El Laboratorio (20-sep-2026) ───────────────────────────────────────────────────────────────
   Desmontar: qué lleva dentro un video que funcionó. Lo MEDIBLE (palabras por minuto, duración) se
   calcula aquí con los números reales; a la IA solo se le pide lo que hay que interpretar. Si se
   mezclan las dos cosas, la IA devuelve cifras que parecen medidas y no lo son. */
const GANCHOS = ['Pregunta', 'Dato', 'Contradicción', 'Orden', 'Confesión', 'Historia', 'Promesa', 'Error común']
/* Los formatos son los de Sergio (docs/CRITERIO-SERGIO.md): de producción, no categorías de
   escritor. Y desmontan el mito de «cambiar de toma cada 5 s»: eso es solo el formato dinámico. */
const FORMATOS = ['Dinámico', 'Podcast', 'VS', 'Top', 'B-roll', 'Entrevista random', 'Entrevista',
  'Pantalla dividida', 'Pantalla verde', 'Storytelling', 'A cámara']
const EMOCIONES = ['Curiosidad', 'Controversia', 'Rabia', 'Tristeza', 'Motivación', 'Felicidad', 'Miedo', 'Sorpresa']
const CANALES = ['visual', 'verbal', 'textual', 'auditivo']
const ZONAS = ['mainstream', 'segura', 'nicho']

/* Una frase se corta cuando acaba en puntos suspensivos, o cuando su última palabra es de las que
   nunca cierran una idea (un artículo, una preposición, un «esto» sin decir qué). Es la señal más
   clara de un open loop: el video iba a decirlo y no lo dijo. */
const COLGANDO = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'de', 'del',
  'en', 'con', 'por', 'para', 'que', 'y', 'o', 'a', 'al', 'es', 'son', 'era', 'hay', 'esto', 'eso',
  'esta', 'este', 'mi', 'tu', 'su', 'se', 'te', 'me', 'como', 'cuando', 'porque', 'pero'])

/* Señala algo concreto y no lo nombra: «...lo único que importa es esto», «...la razón es esta». */
const SIN_NOMBRAR = /\b(es|son|era|eran|viene|vienen|hace|hacen)\s+(esto|eso|esta|este|estos|estas|as[ií]|la siguiente|el siguiente|lo siguiente)\s*[.!?…]*\s*$/i
/* Remite a otro sitio para dar la información: nunca la da en el video. */
const REMITE = /\b(coment[aá]|escrib[eií]|manda|env[ií]a|dale|pon)\b[^.!?]{0,60}\b(y te (lo|la) (mando|env[ií]o|digo|paso)|para (que te|mandarte))|te lo (mando|digo|cuento|paso) (en|por)\b|(en el|el) (siguiente|pr[oó]ximo) (video|reel)|(enlace|link) en (la bio|los comentarios|el perfil)/i
/* Por dónde se puede partir una frase larga para quedarse solo con la promesa del final. */
const CONECTOR = /\b(cuando|porque|pero|aunque|mientras|ya que|sin embargo|y es que|salvo que)\b/gi

function trozoPrometedor(f: string): string {
  const palabras = f.split(/\s+/).filter(Boolean)
  if (palabras.length <= 16) return f
  // desde el último conector: ahí suele empezar lo que de verdad promete
  let corte = -1, m: RegExpExecArray | null
  CONECTOR.lastIndex = 0
  while ((m = CONECTOR.exec(f)) !== null) { if (m.index > f.length * 0.25) corte = m.index }
  if (corte > 0) {
    const trozo = f.slice(corte).trim()
    if (trozo.split(/\s+/).length >= 4) return trozo
  }
  return palabras.slice(-14).join(' ')
}

/* Las tres señales duras, buscadas en el texto. Devuelve el trozo que promete y su segundo. */
function senalesDeLoop(texto: string, dur: number): { texto: string; seg: number; via: string }[] {
  const partes = texto.split(/(?<=[.!?…])\s+/)
  const total = texto.split(/\s+/).filter(Boolean).length
  const fuera: { texto: string; seg: number; via: string }[] = []
  let corridas = 0
  for (const cruda of partes) {
    const f = cruda.trim()
    const palabras = f.split(/\s+/).filter(Boolean)
    corridas += palabras.length
    if (palabras.length < 4) continue
    const seg = dur ? Math.min(dur, Math.round((corridas / total) * dur)) : 0

    const suspensivos = /(\.\.\.|…)\s*$/.test(f)
    const ultima = String(palabras[palabras.length - 1] || '').toLowerCase().replace(/[^a-záéíóúñ]/g, '')
    /* «Señalar sin nombrar» va PRIMERO: acaba en «es esto», y «esto» también está en COLGANDO, así
       que si se mirara antes lo de cortada se devolvería la frase entera en vez del trozo que
       promete — que en estas frases va siempre al final. */
    if (SIN_NOMBRAR.test(f)) { fuera.push({ texto: t(trozoPrometedor(f), 200), seg, via: 'sin nombrar' }); continue }
    /* Dos formas de quedar cortada, y basta con una. Pedir las dos perdía la más típica:
       «Y esto crea un sesgo psicológico...», que acaba en sustantivo pero está cortada. */
    if (suspensivos || COLGANDO.has(ultima)) { fuera.push({ texto: t(trozoPrometedor(f), 200), seg, via: 'cortada' }); continue }
    if (REMITE.test(f)) {
      /* «Comenta y te lo mando» al final es el CIERRE, no un open loop: un loop aplaza algo dentro
         del video para que sigas viéndolo; el CTA manda fuera, cuando ya se acabó. */
      const alFinal = dur > 0 && seg >= dur * 0.8
      fuera.push({ texto: t(trozoPrometedor(f), 200), seg, via: alFinal ? 'cta' : 'remite' })
      continue
    }
  }
  return fuera.slice(0, 8)
}

const mismaFrase = (a: string, b: string) => {
  const n = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '')
  const x = n(a), y = n(b)
  if (!x || !y) return false
  return x.includes(y.slice(0, 26)) || y.includes(x.slice(0, 26))
}

async function labDesmontar(b: any) {
  const texto = t(b.texto, 9000)
  if (texto.length < 40) throw new Error('Hace falta lo que se dice en el video (o su guion) para poder desmontarlo.')
  const dur = Math.max(0, Math.round(Number(b.dur) || 0))
  const palabras = texto.split(/\s+/).filter(Boolean).length
  const ppm = dur ? Math.round((palabras / dur) * 60) : 0

  const sis = `Desmontas videos cortos de redes para entender POR QUÉ retienen. No opinas ni felicitas: describes lo que hay.
Devuelves SOLO JSON {"gancho":{"tipo":"Pregunta","texto":"...","seg":3,"emocion":"Curiosidad","canales":["verbal"]},"estructura":[{"parte":"Cuerpo","dice":"...","sobre":"creencia","nota":"..."}],"formato":{"nombre":"Comparación","nota":"..."},"loops":[{"texto":"...","seg":9,"tipo":"aplaza","cierra":false}],"idea":{"tema":"...","creencia":"...","realidad":"","nicho":"..."},"alcance":{"zona":"segura","porque":"...","lenguaje":"sencillo","tecnicas":[]},"contra":{"hay":false,"frase":"","giro":""}}
- gancho.emocion: la emoción FUERTE que provoca, que es lo que detiene el scroll. Una de ${EMOCIONES.join(', ')}. Si no provoca ninguna emoción fuerte, pon "" — eso ya es un hallazgo.
- gancho.canales: por dónde entra el gancho, que pueden ser varios a la vez: "verbal" (lo que se dice), "textual" (el texto que sale en pantalla en los primeros segundos), "auditivo" (un sonido, un golpe, una música que arranca fuerte). NO pongas "visual" aquí: lo visual se mira aparte, con el video delante. Si solo habla, canales = ["verbal"].
- gancho.tipo: uno de ${GANCHOS.join(', ')}. gancho.texto: las primeras palabras COPIADAS tal cual, sin cambiar nada (máx. 25 palabras). gancho.seg: cuántos segundos dura, contando 2,5 palabras por segundo.
- estructura: los tramos del video EN ORDEN, sin contar los open loops (esos van aparte y se colocan solos después). Cada tramo:
  parte: "Gancho" (solo el primero: la frase con la que arranca), "Cuerpo" (un tramo de información) o "CTA" (el cierre que pide algo).
  dice: la primera frase de ese tramo, copiada tal cual.
  sobre: SOLO en los cuerpos, de qué va ese tramo: "creencia" (lo que la gente cree o da por hecho), "error" (lo que la gente hace mal), "mito" (lo que se repite por ahí), "dato" (una cifra o un hecho), "historia" (un caso o una anécdota) o "realidad" (la respuesta de verdad, lo que sí funciona). Usa "realidad" SOLO si el video llega a decirlo de verdad; si solo lo promete, no es realidad.
  nota: máx. 6 palabras. En el gancho, de qué tipo es (controversial, pregunta, promesa, dato). En el CTA, si genera necesidad («si quieres entender por qué no creces…») o solo pide («dale like»).
  Entre 3 y 7 tramos. No metas los open loops aquí.
- formato.nombre: uno de ${FORMATOS.join(', ')}. Son formatos de GRABACIÓN, así que fíjate en cómo está hecho, no en cómo está escrito:
  Dinámico = habla a cámara cambiando de toma cada pocos segundos · Podcast = simula estar en uno · VS = enfrenta dos cosas a ver cuál gana · Top = numera (el 1, el 2, el 3) · B-roll = voz en off sobre escenas de apoyo, típico de motivación · Entrevista random = alguien llega y le pregunta, grabado en POV · Entrevista = simula que le preguntan, estático, con la mano o la persona que pregunta · Pantalla dividida = media pantalla con una grabación o ejemplos · Pantalla verde = reacciona a un video de fondo · Storytelling = cuenta algo mientras hace una acción natural (cocinar, afeitarse, conducir) · A cámara = habla de frente sin más.
  Del texto solo se puede adivinar hasta cierto punto: si dudas entre «A cámara» y «Dinámico», pon «A cámara» — lo dinámico se ve, no se lee.
  formato.nota: en qué se nota, máx. 12 palabras.
- loops: TODOS los open loops del video, en orden. Un open loop es cuando el video hace creer que YA VA A REVELAR algo y no lo revela, dejando al espectador esperando. Los videos que retienen encadenan varios hasta el final, no uno solo: búscalos todos.
  Las señales, de más fuerte a menos:
  OJO: el texto llega de una transcripción automática, que NO escribe puntos suspensivos ni marca los cortes de edición. Una frase cortada te llegará como una frase normal acabada en punto, o pegada a la siguiente. Búscalas por el SENTIDO: alguien anuncia algo y no lo completa, y lo que viene después cambia de tema sin haberlo dicho.
  1. LA FRASE SE CORTA justo antes del dato: «...si te olvidas de lo más importante, el...», «y esto crea un sesgo psicológico...». Queda colgando un artículo, una preposición o un «esto/eso» sin decir a qué se refiere, y lo que viene después cambia de tema o de ángulo. Es el open loop más claro que existe: búscalo primero.
  2. Anuncia que lo importante es UNA cosa concreta y no la nombra: «lo único que realmente importa es esto», «hay una razón y ya te la digo».
  3. Manda a otro sitio para saberlo EN MEDIO del video: «te lo cuento en un momento», «ya te digo dónde». OJO: si eso mismo aparece AL FINAL («comenta tal palabra y te lo mando», «te dejo el enlace»), NO es un open loop: es el CTA, el cierre. Un open loop aplaza algo dentro del video para que sigas viéndolo; el CTA manda fuera, cuando ya se acabó. No lo pongas en loops.
  4. Promete algo para más adelante: «y lo peor viene al final», «espera a ver el número 3».
  NO son open loops: las preguntas del gancho que el propio video contesta enseguida, ni anunciar el tema («hoy te hablo de X»), ni una pregunta retórica suelta.
  Cada uno: texto = EL TROZO donde se hace la promesa, copiado tal cual, con los puntos suspensivos si se corta (máx. 18 palabras). Si la promesa está al final de una frase larga, copia SOLO ese trozo final, nunca el principio de la frase: en «te dirán que hagas contenido de valor cuando lo único que realmente importa es esto», el open loop es «cuando lo único que realmente importa es esto»; seg = el segundo aproximado, contando 2,5 palabras por segundo desde el principio; tipo = "aplaza" si promete y no da nada todavía, o "resuelve" si da una parte pero deja otra abierta; cierra = true SOLO si más adelante el video llega a revelar de verdad lo que prometió, false si nunca lo dice.
  Si el video no tiene ninguno, loops = []. Si dudas de uno, inclúyelo: es peor perderlo que sobrar.
- alcance: hasta dónde puede llegar este video, que no es lo mismo que si es bueno.
  zona: "mainstream" si es tan general que lo entiende cualquiera pero no sirve para nada (los trends, los retos, los memes están aquí); "nicho" si hay que saber del tema para entenderlo, y por eso no se va a mover; "segura" si es lo más general posible SIN llegar a ser inútil. Esa es la buena.
  porque: en una frase, máx. 16 palabras, por qué cae en esa zona.
  lenguaje: "sencillo" si lo entiende cualquiera, "tecnico" si usa palabras de oficio que dejan fuera a la mayoría. Un video con lenguaje técnico no se hace viral por bueno que sea el contenido.
  tecnicas: las palabras técnicas o de jerga que dejarían fuera a alguien de la calle, máx. 6. Si no hay, [].
- contra: el truco de decir algo con lo que TODO EL MUNDO va a estar en contra, para que se queden a discutir («la Coca-Cola es lo mejor que puedes tomar para cuidar tu salud»), y darle el giro después.
  hay: true solo si de verdad lo usa. frase: la afirmación polémica, copiada. giro: cómo la resuelve después, máx. 16 palabras; "" si nunca la resuelve.
- idea: la idea del video partida en tres, que es lo que la hace reutilizable:
  idea.tema: de qué va, en pocas palabras y empezando por «cómo» o «por qué» si encaja (máx. 9 palabras). Ej.: «cómo hacerse viral».
  idea.creencia: qué cree la gente o qué da por hecho, según el video (máx. 16 palabras). Ej.: «que basta con el gancho, la cámara o el storytelling».
  idea.realidad: qué dice el video que funciona DE VERDAD (máx. 16 palabras). Déjalo VACÍO ("") si el video no llega a decirlo: muchos lo prometen y nunca lo sueltan. No lo rellenes con lo que tú creas.
  idea.nicho: cómo se llevaría esa misma idea a otro tema, máx. 16 palabras.
- Nunca inventes duración ni ritmo: esos no te los pedimos.`
  const senales = senalesDeLoop(texto, dur)
  const cortadas = senales.filter((c) => c.via !== 'cta')      // el cierre no es un loop
  const elCta = senales.filter((c) => c.via === 'cta')[0] || null
  const pista = cortadas.length
    ? `\nEstos trozos dan una de las señales de open loop. Revísalos uno por uno y, si lo son, inclúyelos TAL CUAL están escritos aquí:\n${cortadas.map((c) => `· «${c.texto}» (${c.via})`).join('\n')}\n`
    : ''
  const o = await ia(sis, `Duración real: ${dur || '?'} s. Palabras: ${palabras}.${pista}\nLo que se dice:\n${texto}`)

  const g = o?.gancho || {}
  const SOBRE = ['creencia', 'error', 'mito', 'dato', 'historia', 'realidad']
  const est = (Array.isArray(o.estructura) ? o.estructura : [])
    .map((e: any) => {
      const parte = ['Gancho', 'Cuerpo', 'CTA'].includes(e?.parte) ? e.parte : 'Cuerpo'
      return { parte, dice: t(e?.dice, 220), nota: t(e?.nota, 60),
               sobre: parte === 'Cuerpo' && SOBRE.includes(e?.sobre) ? e.sobre : '' }
    })
    .filter((e: any) => e.dice).slice(0, 8)
  const id = o?.idea || {}

  /* La cadena de open loops. Lo que de verdad dice algo no es cuántos hay, sino CUÁNTO VIDEO QUEDA
     después del último: ahí ya no hay nada tirando del espectador, y es donde se cae la curva. */
  const loops = (Array.isArray(o.loops) ? o.loops : [])
    .map((x: any) => ({
      texto: t(x?.texto, 200),
      // un loop no puede estar después de que acabe el video: la IA a veces se pasa
      seg: Math.max(0, Math.min(dur || 9999, Math.round(Number(x?.seg) || 0))),
      tipo: x?.tipo === 'resuelve' ? 'resuelve' : 'aplaza',
      cierra: x?.cierra === true,
    }))
    .filter((x: any) => x.texto)

  /* Lo que la IA no cogió se añade igual: la señal está en el texto y no debería depender de su
     humor. Medido, pidiéndoselo solo a ella salían 4/4, 1/4 y 3/4 de las tres señales. */
  for (const c of cortadas) {
    if (loops.some((l: any) => mismaFrase(l.texto, c.texto))) continue
    loops.push({ texto: t(c.texto, 200), seg: c.seg, tipo: 'aplaza', cierra: false })
  }
  /* Si la IA lo metió igual como loop, se quita: es el cierre. */
  if (elCta) {
    for (let i = loops.length - 1; i >= 0; i--) {
      if (mismaFrase(loops[i].texto, elCta.texto)) loops.splice(i, 1)
    }
  }
  loops.sort((a: any, b: any) => a.seg - b.seg)
  loops.splice(8)
  const ultimo = loops.length ? loops[loops.length - 1].seg : 0
  const huecoFinal = dur && loops.length ? Math.max(0, dur - ultimo) : 0
  const cadena = {
    n: loops.length,
    ultimo,
    huecoFinal,
    // cada cuántos segundos aparece uno, de media
    cada: loops.length > 1 ? Math.round((ultimo - loops[0].seg) / (loops.length - 1)) : 0,
    // se queda sin nada que sostener en el último tercio
    seSuelta: !!(dur && loops.length && huecoFinal > dur * 0.33),
    sinNinguno: loops.length === 0,
    cerrados: loops.filter((l: any) => l.cierra).length,
    /* Promete varias veces y no cumple ninguna: el video dice qué cree la gente, qué errores comete
       y qué mitos hay, pero nunca dice la realidad. Es un formato entero, no un descuido. */
    soloPromete: loops.length >= 2 && loops.every((l: any) => !l.cierra),
  }

  /* El recorrido del video tal como se ve: los tramos de información ALTERNANDO con los open loops,
     en orden. Los loops ya están detectados, así que se colocan por su segundo en vez de pedírselos
     otra vez a la IA y arriesgarse a que salgan distintos. */
  const pasos: any[] = est.map((e: any, i: number) => ({
    tipo: e.parte, dice: e.dice, sobre: e.sobre, nota: e.nota,
    // los tramos no traen segundo: se reparten por el texto para poder intercalar los loops
    seg: dur ? Math.round((i / Math.max(1, est.length)) * dur) : 0,
  }))
  loops.forEach((l: any) => pasos.push({ tipo: 'Open loop', dice: l.texto, seg: l.seg, nota: l.tipo }))
  /* Un tramo que empieza con la misma frase que un open loop es el mismo momento contado dos veces:
     se queda el loop, que es lo que dice algo. */
  for (let i = pasos.length - 1; i >= 0; i--) {
    if (pasos[i].tipo === 'Open loop') continue
    if (loops.some((l: any) => mismaFrase(l.texto, pasos[i].dice))) pasos.splice(i, 1)
  }
  pasos.sort((a: any, b: any) => a.seg - b.seg)
  const cuerpos = est.filter((e: any) => e.parte === 'Cuerpo')
  const mapa = {
    pasos,
    cuerpos: cuerpos.length,
    // de qué hablan los cuerpos: si todos son creencias, el video plantea la pregunta y no la contesta
    sobre: cuerpos.map((e: any) => e.sobre).filter(Boolean),
    soloCreencias: cuerpos.length >= 2 && cuerpos.every((e: any) => ['creencia', 'error', 'mito'].includes(e.sobre)),
    diceLaRealidad: cuerpos.some((e: any) => e.sobre === 'realidad'),
    cta: (est.find((e: any) => e.parte === 'CTA') || {}).nota || '',
  }

  return {
    gancho: {
      tipo: GANCHOS.includes(g?.tipo) ? g.tipo : 'Pregunta',
      texto: t(g?.texto, 240),
      seg: Math.max(1, Math.min(12, Math.round(Number(g?.seg) || 3))),
      emocion: EMOCIONES.includes(g?.emocion) ? g.emocion : '',
      canales: (Array.isArray(g?.canales) ? g.canales : []).filter((c: any) => CANALES.includes(c)),
    },
    alcance: {
      zona: ZONAS.includes(o?.alcance?.zona) ? o.alcance.zona : '',
      porque: t(o?.alcance?.porque, 140),
      lenguaje: o?.alcance?.lenguaje === 'tecnico' ? 'tecnico' : 'sencillo',
      tecnicas: (Array.isArray(o?.alcance?.tecnicas) ? o.alcance.tecnicas : [])
        .map((x: any) => t(x, 40)).filter(Boolean).slice(0, 6),
    },
    contra: o?.contra?.hay === true && t(o?.contra?.frase, 220)
      ? { frase: t(o.contra.frase, 220), giro: t(o?.contra?.giro, 200) }
      : null,
    estructura: est,
    formato: {
      nombre: FORMATOS.includes(o?.formato?.nombre) ? o.formato.nombre : 'Storytelling',
      nota: t(o?.formato?.nota, 90),
    },
    loops,
    // el primero suelto, para lo desmontado antes de que los loops fueran una cadena (20-sep)
    loop: loops.length ? { texto: loops[0].texto, abre: loops[0].seg, cierra: loops[0].seg } : null,
    cadena,
    idea: {
      tema: t(id?.tema, 120),
      creencia: t(id?.creencia, 200),
      realidad: t(id?.realidad, 200),
      nicho: t(id?.nicho, 180),
      // una sola línea, para lo que solo necesita nombrarla (el embudo, el auditor, las listas)
      frase: [t(id?.tema, 120), t(id?.creencia, 200) ? 'qué cree la gente' : '',
              t(id?.realidad, 200) ? 'y qué sirve en realidad' : 'y la realidad no la dice']
             .filter(Boolean).join(': ').replace(': y ', ' y '),
    },
    mapa,
    // esto NO sale de la IA: sale de los números reales
    ritmo: { ppm, dur, palabras },
  }
}

/* Auditar: ¿el video nuevo sirve para compararlo con el de control? Lo que se puede contar se compara
   aquí (duración, ritmo, tipo de gancho, formato, tramos); a la IA solo se le pregunta lo único que
   hay que interpretar: si la idea es la misma o es otra. */
async function labAuditar(b: any) {
  const n = b?.nuevo || {}, c = b?.control || {}
  if (!n.gancho || !c.gancho) throw new Error('Faltan los dos videos desmontados para poder compararlos.')
  const cambia = t(b.cambia, 20).toLowerCase()      // la variable que SÍ debía cambiar

  let mismaIdea: boolean | null = null
  if (n?.idea?.frase && c?.idea?.frase) {
    try {
      const o = await ia(
        'Dices si dos videos tratan de la MISMA idea o de ideas distintas. Que compartan tema general no basta: la idea es lo que el video afirma. Devuelves SOLO JSON {"misma":true}.',
        `A: ${t(c.idea.frase, 200)}\nB: ${t(n.idea.frase, 200)}`)
      mismaIdea = o?.misma === true
    } catch (_) { mismaIdea = null }
  }

  const filas: any[] = []
  const pon = (campo: string, igual: boolean | null, nota: string) => {
    const debia = !!cambia && campo.toLowerCase().includes(cambia)
    filas.push({ campo, estado: debia ? 'querido' : igual === null ? 'duda' : igual ? 'igual' : 'distinto', nota })
  }
  const ppmN = Number(n?.ritmo?.ppm) || 0, ppmC = Number(c?.ritmo?.ppm) || 0
  const durN = Number(n?.ritmo?.dur) || 0, durC = Number(c?.ritmo?.dur) || 0

  pon('La idea', mismaIdea, mismaIdea === null ? 'no se pudo comparar'
    : mismaIdea ? 'la misma del video de control' : 'distinta a la del video de control')
  pon('El gancho', n.gancho.tipo === c.gancho.tipo,
    n.gancho.tipo === c.gancho.tipo ? `de ${String(c.gancho.tipo).toLowerCase()}, igual`
      : `era de ${String(c.gancho.tipo).toLowerCase()}, ahora es de ${String(n.gancho.tipo).toLowerCase()}`)
  pon('El formato', n.formato?.nombre === c.formato?.nombre,
    n.formato?.nombre === c.formato?.nombre ? `${c.formato?.nombre}, igual`
      : `era ${c.formato?.nombre}, ahora es ${n.formato?.nombre}`)
  const forma = (d: any) => (d?.mapa?.pasos || d?.estructura || [])
    .map((e: any) => e.tipo || e.parte).join(' → ')
  const tramosN = forma(n), tramosC = forma(c)
  pon('La estructura', tramosN === tramosC,
    tramosN === tramosC ? `${(c.estructura || []).length} tramos, igual` : `era ${tramosC}; ahora ${tramosN}`)
  const ritmoOk = ppmN && ppmC ? Math.abs(ppmN - ppmC) / ppmC <= 0.15 : null
  pon('El ritmo', ritmoOk, ppmN && ppmC ? `${ppmN} palabras/min contra ${ppmC}` : 'sin datos de ritmo')
  const durOk = durN && durC ? Math.abs(durN - durC) / durC <= 0.25 : null
  pon('La duración', durOk, durN && durC ? `${durN} s contra ${durC} s` : 'sin duración')
  /* Los open loops se comparan por cantidad, no por «hay o no hay»: encadenar tres o encadenar uno
     retiene de forma muy distinta. Se admite una de diferencia. */
  const nN = Number(n?.cadena?.n) || (n?.loop ? 1 : 0)
  const nC = Number(c?.cadena?.n) || (c?.loop ? 1 : 0)
  const zonaOk = !n?.alcance?.zona || !c?.alcance?.zona || n.alcance.zona === c.alcance.zona
  pon('El alcance', zonaOk,
    !n?.alcance?.zona || !c?.alcance?.zona ? 'sin datos de zona'
      : zonaOk ? `los dos son de zona ${c.alcance.zona}`
      : `era de zona ${c.alcance.zona} y este es de zona ${n.alcance.zona}`)

  const loopOk = Math.abs(nN - nC) <= 1
  pon('Los open loops', loopOk,
    nN === 0 && nC === 0 ? 'ninguno de los dos encadena nada'
      : loopOk ? `${nN} contra ${nC}, parecido`
      : `el de control encadenaba ${nC} y este encadena ${nN}`)

  const rotos = filas.filter((f) => f.estado === 'distinto')
  const sirve = rotos.length === 0
  let arreglo = ''
  if (!sirve) {
    const sis = `Le dices a un creador cómo arreglar su video para que el experimento sirva. Devuelves SOLO JSON {"arreglo":"..."}.
- Máx. 40 palabras, tuteando, concreto y accionable.
- Si lo único roto es el gancho, dile que regrabe solo los primeros segundos: no hace falta volver a grabar el video.
- Si hay tres o más cosas rotas, dile que no tiene arreglo razonable y que lo suba como video suelto.
- Nada de ánimos ni de elogios.`
    try {
      const o = await ia(sis, `Lo que debía cambiar: ${cambia || 'nada'}\nLo que se rompió:\n${rotos.map((f) => `${f.campo}: ${f.nota}`).join('\n')}`)
      arreglo = t(o?.arreglo, 300)
    } catch (_) { arreglo = '' }
  }
  return { sirve, filas, rotos: rotos.length, arreglo }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)
    const b = await req.json()
    const t0 = Date.now()
    let r: unknown
    if (b.accion === 'guion_escribir') r = await guionEscribir(b)
    else if (b.accion === 'guion_ganchos') r = await guionGanchos(b)
    else if (b.accion === 'storyboard_partir') r = await storyboardPartir(b)
    else if (b.accion === 'carrusel_armar') r = await carruselArmar(b)
    else if (b.accion === 'publicacion_texto') r = await publicacionTexto(b)
    else if (b.accion === 'lab_desmontar') r = await labDesmontar(b)
    else if (b.accion === 'lab_auditar') r = await labAuditar(b)
    else return responder({ error: 'acción desconocida' }, 400)
    console.log(`[herramientas] ${b.accion} de ${uid.slice(0, 8)} en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    return responder(r)
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

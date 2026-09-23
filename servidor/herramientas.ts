// herramientas v1 (19-sep-2026) — la IA de las herramientas del inicio de Cherry (Guiones, Storyboard, Carruseles, Calendario).
// Con sesión de usuario (la llama la página). Acciones:
//   · guion_escribir {tema, publico, tono, dur, frases, voz}        → {titulo, gancho, puntos[], cierre}
//   · guion_ganchos {tema, gancho, tono, dur, voz}                    → {ganchos:[{tecnica, texto}]}
//   · storyboard_partir {texto, meta}                                 → {titulo, escenas:[{tipo, dice, plano, lugar, objeto, gesto, apoyo}]}
//   · carrusel_armar {fuente, texto, tema, publico, n, voz}           → {nombre, kicker, ganchos[3], sub, ideas[[t,x]], cierre[t,x,accion], intro, pregunta, tags[]}
//   · publicacion_texto {titulo, tipo, detalle, voz}                  → {caption, tags[]}
//   · lab_desmontar {texto, dur}                                      → {gancho, estructura[], mapa, formato, loops[], cadena, idea, alcance, contra, ritmo}
//   · lab_auditar {nuevo, control, cambia}                            → {sirve, filas[{campo, estado, nota}], arreglo}
//   · lab_guion {idea, zona, formato, emocion, dur, secciones[]}      → {filas[{que, estado, nota, arreglo}]}
//   · lab_escribir {objetivo, negocio, idea, estructura, formato, dur, escenas[]}
//                                                                  → {momento, remate, escenas[], quejas[]}
//   · lab_escena {modo, negocio, idea, estructura, escena, i, total, guion[]}  (alias viejo: lab_paso)
//       modo=auditar                                                → {filas[{que, nota, bien, grave}]}
//       modo=mejorar | escribir                                     → {dice, ve, porque}
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
/* Los pasos de guion. Los cuatro primeros son los de siempre; los siete que siguen salieron de
   mirar once referencias virales una a una, y cada uno aparece rotulado en pantalla o nombrado en
   voz alta en alguna de ellas. Si un video trae uno que no está, se devuelve como nuevo. */
const PASOS = ['Gancho', 'Conector', 'Cuerpo', 'CTA', 'Pretexto', 'Prueba prestada',
               'Ejemplo aplicado', 'Objeción', 'Oferta', 'Remate', 'Giro']
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
Devuelves SOLO JSON {"gancho":{"tipo":"Pregunta","texto":"...","seg":3,"emocion":"Curiosidad","canales":["verbal"]},"estructura":[{"parte":"Cuerpo","dice":"...","sobre":"dato","nota":"...","nuevo":""}],"formato":{"nombre":"Comparación","nota":"..."},"loops":[{"texto":"...","seg":9,"tipo":"aplaza","cierra":false}],"idea":{"tema":"...","creencia":"...","realidad":"","nicho":"..."},"alcance":{"zona":"segura","porque":"...","lenguaje":"sencillo","tecnicas":[]},"contra":{"hay":false,"frase":"","giro":""}}
- gancho.emocion: la emoción FUERTE que provoca, que es lo que detiene el scroll. Una de ${EMOCIONES.join(', ')}. Si no provoca ninguna emoción fuerte, pon "" — eso ya es un hallazgo.
- gancho.canales: por dónde entra el gancho, que pueden ser varios a la vez: "verbal" (lo que se dice), "textual" (el texto que sale en pantalla en los primeros segundos), "auditivo" (un sonido, un golpe, una música que arranca fuerte). NO pongas "visual" aquí: lo visual se mira aparte, con el video delante. Si solo habla, canales = ["verbal"].
- gancho.tipo: uno de ${GANCHOS.join(', ')}. gancho.texto: las primeras palabras COPIADAS tal cual, sin cambiar nada (máx. 25 palabras). gancho.seg: cuántos segundos dura, contando 2,5 palabras por segundo.
- estructura: los tramos del video EN ORDEN, sin contar los open loops (esos van aparte y se colocan solos después). Cada tramo:
  parte: uno de estos. Escoge el que MEJOR describa el tramo; "Cuerpo" solo si de verdad no es ninguno de los otros:
    "Gancho" = la primera frase, con la que arranca (solo el primero).
    "Conector" = lo que va justo detrás del gancho para sostener hasta el segundo 10, sin dar contenido todavía.
    "Pretexto" = por qué existe este video (me lo pidieron, vi un comentario, me pasó esto).
    "Cuerpo" = un tramo de información.
    "Prueba prestada" = se apoya en la autoridad de OTRO (un famoso, un estudio, un caso ajeno).
    "Ejemplo aplicado" = enseña el concepto ya hecho en vez de explicarlo.
    "Objeción" = se adelanta a lo que estás pensando y lo dice él («¿tengo que aprender todo eso?»).
    "Giro" = el momento en que suelta lo que venía aplazando.
    "Oferta" = presenta un producto, curso o servicio propio.
    "CTA" = el cierre que pide algo (comenta, sigue, comparte).
    "Remate" = una frase que cierra SIN pedir nada.
  Si un tramo no es ninguno de esos, pon parte: "Otro" y en nuevo: un nombre corto para ese paso (1-2 palabras, en minúsculas). Solo si de verdad no encaja en ninguno.
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
  idea.creencia: SOLO si el video habla de lo que la gente cree, da por hecho o hace mal. Si el video se limita a explicar algo sin desmentir nada, pon "" — no te la inventes. La mayoría de los videos NO tienen creencia, y poner una falsa es peor que dejarla vacía (máx. 16 palabras). Ej. válido: «que basta con el gancho, la cámara o el storytelling».
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
      /* un paso que no esté en el catálogo entra como nuevo, con su nombre: así el baúl se
         entera de que existe en vez de meterlo en «Cuerpo» y perderlo */
      const nuevo = t(e?.nuevo, 24)
      const parte = PASOS.includes(e?.parte) ? e.parte
        : (e?.parte === 'Otro' && nuevo) ? nuevo.charAt(0).toUpperCase() + nuevo.slice(1)
        : 'Cuerpo'
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
/* ⚠️ 3,35 palabras por segundo. Medido el 22-sep-2026 contra los diez guiones de
   «Referencias Virales»: 2.658 palabras en 793 segundos. Antes decía 2,6 y con eso cada
   guion salía un 23 % corto para su hueco — en 50 s pedía 130 palabras cuando caben 168.
   Es el mismo número para todo el Laboratorio: si se cambia, se cambia aquí. */
const PAL_POR_SEG = 3.35

const RITMO = PAL_POR_SEG

/* ── Lo que se comprueba con una regla NO se le pide por favor al modelo ───────────────────
   Cada una de estas la falló Cherry de verdad, y se le devuelven para que reescriba. */
const FALLOS: { nombre: string; pat: RegExp; di: string }[] = [
  { nombre: 'le habla al guion',
    pat: /\b(en (el|la) (siguiente|próxim[oa]) (paso|escena)|en (este|esta) (paso|escena)|más adelante te|ahora te voy a (explicar|mostrar|contar))\b/i,
    di: 'Le estás hablando al guion. Quien mira el video no sabe que hay pasos ni escenas: nómbrale lo que pasa, no dónde va en tu estructura.' },
  { nombre: 'nombra la estructura',
    pat: /\b(el|la|los|las|un|una)\s+(gancho|conector|open ?loop|bucle abierto|cuerpo del video|cta|llamado a la acción|escena del guion|guion)\b/i,
    di: 'Estás nombrando las piezas del guion. Quien mira no sabe qué es un gancho ni un open loop: cuenta lo que pasa.' },
  { nombre: 'frase de valla',
    pat: /(^|[.;]\s*)no es .{2,40},\s*es |(\bsin .{2,30},\s*sin )|¿\s*el secreto\s*\?|as[íi] de simple/i,
    di: 'Frase de valla. Léela en voz alta: nadie habla así.' },
  { nombre: 'folleto',
    pat: /\b(optimiz\w+|soluci[óo]n integral|en tiempo real|anal[íi]tica|plataforma|herramienta digital|eficien\w+|productividad|potenci\w+|impuls\w+|transform\w+|revolucion\w+|experiencia de usuario)\b/i,
    di: 'Palabra de folleto. Di lo que pasa con las palabras de una cocina: comandas, mesas, caja, domicilios.' },
  { nombre: 'voseo',
    pat: /\b(empezás|tenés|mirá|podés|querés|sabés|andá|vení|hacé|decí)\b/i,
    di: 'Eso es voseo y suena prestado. En Colombia se dice empiezas, tienes, mira, puedes.' },
]

/* ⚠️ AQUÍ HABÍA UNA REGLA MÍA QUE ESTABA MAL y la quito: exigía una hora concreta en todo
   guion. Use ese recurso UNA vez en UN guion y lo converti en obligacion, asi que Cherry
   empezo a meter un reloj a la fuerza en todos. Palabras de Sergio: «poner la hora en TODOS
   LOS GUIONES es algo super extraño y antinatural». Y tiene razon.

   Lo que si hace falta es que el guion esté anclado en cosas que se puedan filmar, y una hora
   es solo UNA de las maneras. Un objeto, un sitio o alguien haciendo algo valen igual. */
const COSAS = 'whatsapp|pantalla|papel|papeles|comanda|comandas|teléfono|telefono|mesa|mesas|'
  + 'cocina|caja|puerta|mano|manos|celular|ticket|recibo|factura|billete|billetes|moto|carro|'
  + 'plato|platos|barra|mostrador|nevera|reloj|domiciliario|domiciliarios|mesero|meseros|'
  + 'cliente|clientes|pedido|pedidos|chat|mensaje|mensajes'
const RELOJES = '\d{1,2}\s*(y media|de la (mañana|tarde|noche)|:\d{2})|'
  + 'las (siete|ocho|nueve|diez|once|doce|una|dos|tres|cuatro|cinco|seis)|medianoche'
const CONCRETO = new RegExp('\\b(' + COSAS + '|' + RELOJES + ')' + '\\b', 'i')

/* ── El gancho ──────────────────────────────────────────────────────────────────────────── */
const TOPE_GANCHO = 3.2   // segundos: el scroll se decide antes de los 3

/* ── Las metáforas de IA ────────────────────────────────────────────────────────────────────
   «Cada pregunta hace fila.» «El papel camina hasta la cocina.» Las dos tienen la misma forma:
   algo que NO tiene cuerpo haciendo algo que solo hace un cuerpo. */
const SIN_CUERPO = 'pregunta|preguntas|tiempo|plata|dinero|venta|ventas|cadena|duda|dudas|error|'
  + 'errores|problema|problemas|información|informacion|dato|datos|idea|ideas|oportunidad|'
  + 'confianza|experiencia|energía|energia|presión|presion|caos|orden|ritmo|negocio|papel|papeles'
const DE_CUERPO = 'camina|caminan|corre|corren|vuela|vuelan|hace fila|hacen fila|pesa|pesan|'
  + 'grita|gritan|muerde|muerden|respira|respiran|duerme|duermen|despierta|despiertan|'
  + 'empuja|empujan|arrastra|arrastran|salta|saltan|baila|bailan|llora|lloran|sangra|'
  + 'se ahoga|se ahogan|se enfría|se enfrian|se rompe|se rompen|se cae|se caen'
const METAFORA = new RegExp(`\\b(${SIN_CUERPO})\\b(?:\\s+\\w+){0,2}\\s+(${DE_CUERPO})\\b`, 'i')

/* ── Los open loops ─────────────────────────────────────────────────────────────────────────
   Un open loop promete y NO entrega. Para promecer sin decir, hace una de dos: señala algo sin
   nombrarlo, o manda a otro momento. Si no hace ninguna, no aplaza nada. */
const APLAZA = new RegExp('\\b(' + 'el último|la última|uno de|una de|algo|lo que|lo de|lo peor|lo caro|lo bueno|lo mejor|hay un|hay una|hay algo|todavía|todavia|ahorita|luego|después|despues|más tarde|mas tarde|cuando|mañana|manana|a las|medianoche|esta noche|al cerrar|al final|en un momento|ya te digo|espera|adivina' + ')\\b', 'i')

/* ── Lo que no puede aparecer en pantalla ───────────────────────────────────────────────────
   Regla de Sergio: en redes NUNCA logos, ni arroba, ni datos corporativos. Eso va en las
   páginas. Y esto hay que mirarlo en el «se ve», no en lo que se dice. */
const EN_PANTALLA = /\b(logo|logotipo|marca de agua|@\w+|tu usuario|el usuario en pantalla|isotipo)\b/i

/* Un hueco de plantilla que se quedó sin rellenar: «Día X», «[nombre]», «XX». */
const SIN_RELLENAR = /(\bd[íi]a\s+x\b|\[[^\]]{1,20}\]|\bxx+\b)/i

/* Palabras que no distinguen nada: si dos escenas comparten «que» y «para», no se parecen. */
const VACIAS = new Set(['para', 'pero', 'como', 'cuando', 'donde', 'porque', 'entonces', 'todo',
  'todos', 'toda', 'todas', 'esto', 'esta', 'este', 'eso', 'ese', 'esa', 'más', 'mas', 'muy',
  'ya', 'sin', 'con', 'una', 'unos', 'unas', 'del', 'las', 'los', 'que', 'por', 'ser', 'está',
  'esta', 'están', 'tiene', 'tienes', 'hace', 'haces', 'vas', 'van'])

const jugosas = (txt: string) => new Set(
  String(txt).toLowerCase().replace(/[^\wáéíóúñü\s]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 4 && !VACIAS.has(w)))

/* Normaliza para comparar frases: sin tildes, sin signos, sin dobles espacios. */
const llana = (txt: string) => String(txt).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()

/* ⚠️ Un remate que no se dice NO es un remate. Cherry decidió «Ya no, gracias» y lo dejó
   escondido en el «se ve» del CTA, después del «Sígueme»: eso es una posdata. */
function remateSinPagar(escenas: any[], remate: string) {
  const r = llana(remate)
  if (!r) return false
  const suyas = r.split(' ').filter(w => w.length >= 3)
  if (!suyas.length) return false
  return !escenas.some((x: any) => {
    const d = llana(x?.dice)
    if (!d) return false
    if (d.includes(r)) return true
    const dentro = suyas.filter(w => d.includes(w)).length
    return dentro / suyas.length >= 0.7
  })
}

/* ⚠️ La misma lista al derecho y al revés. Escena 5: «no llega la comanda, las mesas esperan,
   la caja no cierra, el domiciliario sin ruta». Escena 7: las mismas cuatro, bien. Dos escenas
   que nombran las mismas cosas no cuentan dos cosas: cuentan una, dos veces. */
function repetidas(escenas: any[]) {
  const pares: string[] = []
  for (let i = 0; i < escenas.length; i++) {
    const a = jugosas(escenas[i]?.dice)
    if (a.size < 4) continue
    for (let j = i + 1; j < escenas.length; j++) {
      const b = jugosas(escenas[j]?.dice)
      if (b.size < 4) continue
      const juntas = [...a].filter(w => b.has(w))
      if (juntas.length >= 4 && juntas.length / Math.min(a.size, b.size) >= 0.33) {
        pares.push(`Las escenas ${i + 1} y ${j + 1} nombran las mismas cosas ` +
          `(${juntas.slice(0, 4).join(', ')}). Es la misma lista al derecho y al revés: ` +
          `una de las dos tiene que contar otra cosa.`)
      }
    }
  }
  return pares
}

/* ── El gancho elegido manda ────────────────────────────────────────
   Sergio: «debe respetar el gancho, el gancho ya se eligió no debe crearlo, puede
   complementarlo con mas palabras, pero se debe respetar el gancho».

   O sea: sus palabras van enteras y seguidas dentro de la escena 1. Cherry puede añadir detrás;
   cambiarlas, partirlas o escribir otro gancho, no. */
const TOPE_COMPLEMENTO = 8   // palabras que Cherry puede ponerle de su cosecha

function respetaGancho(escenas: any[], gancho: string) {
  const g = llana(gancho)
  if (!g) return ''
  const d = llana(escenas[0]?.dice)
  if (!d.includes(g)) {
    return `La escena 1 no dice el gancho que ya está elegido. Es «${gancho}», y va TAL CUAL, ` +
      'entero y seguido. Puedes añadirle palabras detrás; cambiarlo o escribir otro, no.'
  }
  const sobran = d.split(' ').filter(Boolean).length - g.split(' ').filter(Boolean).length
  if (sobran > TOPE_COMPLEMENTO) {
    return `La escena 1 le añade ${sobran} palabras al gancho. Complementar son cuatro o cinco, ` +
      `no ${sobran}: déjalo casi como está.`
  }
  return ''
}

/* ⚠️ LA MARCA VA DESPUÉS DEL BENEFICIO. Aquí empecé contando cuántas veces salía el producto
   y Sergio lo paró: «el problema no es que repita cobra (si limitas eso solo vas a lograr que
   se diga menos) lo que pasa es que nombrar la marca de algo antes de mostrar sus beneficios
   suena a venta (Con Magesio Ultra Prime podras tener mayor fuerza en sus piernas) suena a
   venta de producto por tv».

   O sea que no es CUÁNTAS veces, es DÓNDE sale la primera. Y se ve en sus dos guiones:
     · el que aprobó:      «Cobra» sale en la escena 5 de 9, tras cuatro escenas de dolor, y
                            «Con Cobra eso no pasa» cierra algo que ya viste.
     · el que no le gustó: sale en la 3, prometiendo cosas que nadie ha visto todavía.

   Por eso el listenón es la mitad del guion: es justo donde él lo puso cuando le salió bien. */
function marcaAntesDeTiempo(escenas: any[], producto: string) {
  const nom = llana(producto)
  if (nom.length < 3) return ''
  const habladas = escenas.filter((x: any) => String(x?.dice || '').trim())
  if (habladas.length < 4) return ''
  const i = habladas.findIndex((x: any) => llana(x.dice).split(' ').includes(nom))
  if (i < 0 || (i + 1) / habladas.length >= 0.5) return ''
  const cual = escenas.findIndex((x: any) => llana(x?.dice).split(' ').includes(nom)) + 1
  return `Nombras «${producto}» en la escena ${cual} de ${escenas.length}, antes de que haya ` +
    'dolido nada. Decir la marca y detrás lo que hace es la frase del anuncio de televisión ' +
    '(«con tal cosa vas a tener más fuerza en las piernas»). Enseña primero lo que pasa sin ' +
    'ella; el nombre va después, cuando ya se vio el problema.'
}

function revisarGuion(escenas: any[], intocable = '', remate = '', estructura = '', producto = '') {
  const quejas: string[] = []
  /* Lo que escribió Sergio no se corrige. Su gancho dice «mi plataforma inteligente» y
     «plataforma» está en la lista de folleto —con razón, lo es— pero la palabra es suya.

     ⚠️ Antes esto comparaba la escena ENTERA con su gancho. Ahora Cherry puede complementarlo,
     así que la escena 1 ya no es exactamente suya: hay que mirar si el TROZO que falla está
     dentro de sus palabras. */
  const suyo = llana(intocable)
  const esSuyo = (m: string) => !!suyo && !!m && suyo.includes(llana(m))
  escenas.forEach((x: any, i: number) => {
    const dice = String(x?.dice || '')
    for (const f of FALLOS) {
      const m = f.pat.exec(dice)
      if (m && !esSuyo(m[0])) quejas.push(`Escena ${i + 1} (${x?.escena || '?'}): ${f.di}`)
    }
  })

  const pronto = marcaAntesDeTiempo(escenas, producto)
  if (pronto) quejas.push(pronto)

  const delGancho = respetaGancho(escenas, intocable)
  if (delGancho) quejas.push(delGancho)
  const todo = escenas.map((x: any) => `${x?.dice || ''} ${x?.ve || ''}`).join(' ')
  if (!CONCRETO.test(todo)) {
    quejas.push('En todo el guion no hay una sola cosa que se pueda poner delante de una ' +
      'cámara. Nombra cosas del oficio: el teléfono, la comanda, la caja, el papel.')
  }

  escenas.forEach((x: any, i: number) => {
    const dice = String(x?.dice || '')
    const ve = String(x?.ve || '')

    /* El gancho se decide antes de los 3 segundos. No se comprobaba al escribir el guion
       entero, solo al reescribir una escena suelta: por eso salió uno de 8,4 s.
       ⚠️ Si el gancho lo eligió Sergio, el largo es cosa suya: lo que se mide entonces es
       cuánto le añadió Cherry, y de eso se encarga `respetaGancho`. */
    if (i === 0 && !suyo) {
      const pal = dice.split(/\s+/).filter(Boolean).length
      const seg = Math.round((pal / RITMO) * 10) / 10
      if (seg > TOPE_GANCHO) {
        quejas.push(`El gancho son ${pal} palabras, o sea ${String(seg).replace('.', ',')} s. ` +
          'El scroll se decide antes de los 3: córtalo.')
      }
    }

    const mMet = METAFORA.exec(dice)
    if (mMet && !esSuyo(mMet[0])) {
      const m = mMet
      quejas.push(`Escena ${i + 1}: «${m ? m[0] : ''}» es una metáfora de las que escribe una ` +
        'máquina. Las cosas que no tienen cuerpo no caminan ni hacen fila: di qué pasa de verdad.')
    }

    if (/loop/i.test(String(x?.escena || '')) && dice) {
      if (/\?\s*$/.test(dice.trim())) {
        quejas.push(`Escena ${i + 1}: un open loop no es una pregunta. Una pregunta se responde ` +
          'sola; un open loop promete algo y no lo entrega todavía.')
      } else if (!APLAZA.test(dice)) {
        quejas.push(`Escena ${i + 1}: eso no aplaza nada. Un open loop señala algo sin nombrarlo ` +
          '(«el último mensaje», «una de las tres») o manda a otro momento («cuando cierras»).')
      }
    }

    if (EN_PANTALLA.test(ve)) {
      const m = EN_PANTALLA.exec(ve)
      quejas.push(`Escena ${i + 1}: «${m ? m[0] : ''}» en lo que se ve. En redes no van logos, ` +
        'ni el arroba, ni datos de la empresa: eso va en las páginas.')
    }

    const mHueco = SIN_RELLENAR.exec(dice) || SIN_RELLENAR.exec(ve)
    if (mHueco && !esSuyo(mHueco[0])) {
      const m = mHueco
      quejas.push(`Escena ${i + 1}: «${m ? m[0] : ''}» es un hueco sin rellenar. Pon el número ` +
        'o el nombre de verdad.')
    }
  })

  /* El nombre de la estructura que escogió Sergio —«La cadena»— tampoco existe para quien mira. */
  const nombre = llana(estructura)
  if (nombre.length >= 4) {
    escenas.forEach((x: any, i: number) => {
      if (llana(x?.dice).includes(nombre)) {
        quejas.push(`Escena ${i + 1}: dices «${estructura}», que es el nombre de la estructura. ` +
          'Quien mira el video no sabe cómo se llama: cuenta lo que pasa.')
      }
    })
  }

  if (remateSinPagar(escenas, remate)) {
    quejas.push(`El remate «${remate}» no lo dice nadie en el guion. Un remate que no se ` +
      'escucha no es un remate: tiene que estar en lo que DICES de alguna escena.')
  }

  quejas.push(...repetidas(escenas))
  return quejas
}

/* ── Los dos ejemplos ───────────────────────────────────────────────────────────────────────
   Esta es la palanca de verdad. Dos días metiéndole reglas al prompt no movieron a Cherry; un
   ejemplo entero sí, porque un modelo imita mucho mejor de lo que obedece.

   El primero es el guion que Sergio aprobó el 22-sep. El segundo es de sus «Referencias
   Virales» —la taquería—, que es del mismo oficio y enseña otra cosa: explicar algo de plata
   sin sonar a clase. */
const EJEMPLOS = `
⚠️ LOS DOS EJEMPLOS DE ABAJO SON DE OTROS VIDEOS, NO DEL QUE ESCRIBES AHORA.
Están para que veas CÓMO se escribe, no QUÉ se escribe. NO copies su momento, ni su remate, ni
sus frases, ni su hora, ni su escena. Si tu remate es «Ya no, gracias» o tu momento son «las
siete de la tarde», lo estás copiando: bórralo y busca el tuyo en el negocio y en el objetivo
que te dieron arriba.

EJEMPLO 1 — nueve escenas, 49 segundos. Objetivo: mostrar cómo funciona WhatsApp con Cobra.
El momento: son las siete de la noche, el local está lleno y entra un pedido por WhatsApp.
El remate: «Ya no, gracias.»
  1. Gancho — dice: «Día 1 hasta que uses mi plataforma inteligente para restaurantes.»
     ve: tú a cámara en la barra, sin arreglar nada, con el rótulo DÍA 1 arriba.
  2. Gancho visual — dice: «Hoy te muestro el mensaje que más plata te ha costado.»
     ve: primer plano del teléfono, tapas el chat con el pulgar, todavía no se lee.
  3. Conector — dice: «Son las siete. Está lleno. Te escriben por WhatsApp pidiendo dos
     hamburguesas. Tú lo ves, dices "ya le contesto", y sigues atendiendo.»
     ve: el local lleno; el teléfono sonando en la barra; tu mano dejándolo boca abajo.
  4. Open loop — dice: «Le contestas a las diez y media. Y él ya te había escrito dos veces
     más. El último mensaje dice una sola cosa.»
     ve: el local vacío; los tres mensajes del mismo cliente; el último tapado con el dedo.
  5. Cuerpo — dice: «"Ya no, gracias." Con Cobra eso no pasa. El cliente escribe y le contestan
     al segundo, aunque lleguen veinte al tiempo. Le toman el pedido, la dirección, y sale en la
     pantalla de la cocina.»
     ve: quitas el dedo y se lee; un segundo de silencio; el chat contestando solo.
  6. Open loop — dice: «Y eso es lo de las siete. Lo de la medianoche te va a gustar más.»
     ve: el local a medianoche, sillas encima de las mesas.
  7. Cuerpo — dice: «A medianoche te tocaba sumar papeles para saber cuánto vendiste. Ahora
     abres y ya está: cuánto entró y cuánto te tiene que entregar cada domiciliario.»
     ve: la pila de papeles, tu mano apartándola, la pantalla del cierre con los números.
  8. Oferta — dice: «Esto fue el día 1. Voy a subir un pedazo cada día hasta que lo uses.»
  9. CTA — dice: «Sígueme. Mañana te muestro la cocina.»

EJEMPLO 2 — de un video que funcionó, sobre precios en una taquería:
«Oye, ¿por qué si en mi negocio vendo bastante, al final no me queda nada de dinero?
Probablemente porque tu precio cubre el producto, pero no el negocio. Te explico. En un negocio,
por ejemplo una taquería, los costos son los que se vuelven parte de lo que vendes: la carne,
las tortillas, el empaque y el taquero. Sin eso no hay producto. Pero los gastos son los que
mantienen el negocio abierto: la renta, la publicidad, el internet. El costo lo recuperas cuando
vendes, pero el gasto se va, vendas o no. Ya, ¿y eso para qué me sirve? Pues para que pongas tus
precios bien. Por eso venden mucho y no ganan nada. Si no, no estás ganando. Estás trabajando
gratis.»
Fíjate: empieza con la pregunta del que mira, nombra cosas que se pueden tocar, se interrumpe a
sí mismo con la objeción del otro, y remata con una frase plana que duele.
`

/* Lo que separa un guion bueno de una explicación. Sale de comparar el que Sergio aprobó con
   el que me rechazó, no de un manual. */
const OFICIO = `
CÓMO SE ESCRIBE:
· NO METAS UNA HORA SI NO HACE FALTA. Anclar la escena es nombrar cosas que se pueden filmar
  —el teléfono, la comanda, la caja—, no poner un reloj. Un reloj en todos los videos suena
  a plantilla.
· UNA ESCENA, NO UN PROCESO. «Te escriben, lo anotas, lo copias» es un proceso: no tiene hora,
  ni sitio, ni nadie haciendo nada. «Son las siete, está lleno, dices ya le contesto» es una
  escena. Si una frase no tiene reloj, lugar o alguien haciendo algo, reescríbela.
· EL REMATE PRIMERO. Decide la frase que remata ANTES de escribir nada. Las escenas de antes
  son la pista de aterrizaje de esa frase. Un guion sin remate decidido no tiene giro.
· EL CONFLICTO ANTES QUE EL PRODUCTO. La marca no se nombra hasta que ya se vio el problema y
  ya se vio lo que hace. Decir el nombre y detrás la promesa —«con tal cosa vas a tener más
  fuerza en las piernas»— es la frase del anuncio de televisión, y se nota. Primero enseña lo
  que pasa sin ella; el nombre va al final de esa escena, no al principio.
· LOS OPEN LOOPS PROMETEN ALGO QUE SE PUEDE FILMAR. «El último mensaje dice una sola cosa» se
  puede tapar y destapar. «Se te va la plata» no se puede mostrar.
· TODO SE ENTIENDE SIN EXPLICACIONES. Un niño de diez años y una señora de setenta tienen que
  entender cada frase. Cero palabras técnicas.
· NO NOMBRES LAS PIEZAS DEL GUION. Ni «el gancho», ni «el open loop», ni el nombre de la
  estructura. Para quien mira el video eso no existe.
· EL REMATE SE DICE. Tiene que estar en lo que DICES de alguna escena, no en lo que se ve ni al
  final suelto. Si no se escucha, no es un remate.
· NO CUENTES LO MISMO DOS VECES. Una escena con la lista de lo que sale mal y otra con la misma
  lista al revés son una sola escena contada dos veces.
· SEPARA lo que se DICE de lo que se VE. Lo que se dice es lo que sale por la boca. Lo que se ve
  es el plano. Nunca los mezcles en la misma frase.
`

/* ── Los tipos de video ─────────────────────────────────────────────────────────────────────
   Un tipo se define por lo que NO hace. Un educativo que vende ya no es educativo; un
   motivacional que explica pasos es un tutorial con música. De ahí que cada uno traiga su
   lista de prohibiciones, y que se comprueben. */
const TIPOS_VIDEO: Record<string, { nombre: string; es: string; no: string; pat: RegExp | null; di: string }> = {
  informativo: {
    nombre: 'Informativo',
    es: 'Cuenta algo que pasa o que existe, con datos. Quien lo ve termina SABIENDO algo que no sabía.',
    no: 'No enseña a hacerlo paso a paso, no arenga y no vende.',
    pat: /\b(tú puedes|no te rindas|atrévete|el éxito|tu mejor versión|empieza hoy|nunca es tarde|sal de tu zona)\b/i,
    di: 'Eso es arenga y este video es informativo: cuenta lo que pasa, no animes a nadie.',
  },
  educativo: {
    nombre: 'Educativo',
    es: 'Enseña a HACER algo. Pasos en orden, con las cosas por su nombre. Quien lo ve puede repetirlo.',
    no: 'No vende y no arenga. Acaba en «ya lo puedes hacer», no en «cómpralo».',
    pat: /\b(cómpra(lo|la)|compra ahora|comprar ahora|link en (la )?bio|te lo vendo|precio de lanzamiento|oferta de lanzamiento|escríbeme y te lo|paga ahora|reserva ya)\b/i,
    di: 'Eso es vender y este video es educativo: enseña a hacerlo, no lo vendas.',
  },
  motivacional: {
    nombre: 'Motivacional',
    es: 'Cuenta algo que te pasó y lo que te dejó. Mueve por dentro.',
    no: 'No explica pasos, no da datos técnicos y no vende.',
    pat: /\b(paso \d|paso número|el primer paso|el segundo paso|te explico cómo|te enseño a|la configuración|el porcentaje|la fórmula|se hace así)\b/i,
    di: 'Eso es explicar y este video es motivacional: cuenta lo que pasó, no des instrucciones.',
  },
  venta: {
    nombre: 'De venta',
    es: 'Vende. El producto es el protagonista y se dice lo que cuesta y dónde se consigue.',
    no: 'Nada prohibido, pero sigue sin valer el lenguaje de folleto.',
    pat: null,
    di: '',
  },
}
const TIPO_POR_DEFECTO = 'informativo'

/* ⚠️ El lenguaje de cartel. Sergio, sobre un guion marcado INFORMATIVO: «todo el guion suena a
   campaña publicitaria de venta». Un informativo, un educativo y un motivacional pueden nombrar
   el producto; lo que no pueden es hablar como el cartel del producto. En uno DE VENTA sí, que
   para eso es. */
const ANUNCIO = /\b(a otro nivel|transforma tu|cambiar? tu (negocio|vida|restaurante)|no te lo pierdas|aprovecha (ya|ahora)|en un solo lugar|sin complicaciones|sin estr[ée]s|lo que (de verdad|realmente) importa|todo bajo control|(es|solo) el comienzo)/i

/* ⚠️ La oferta y el CTA no cuentan para la prohibición de vender: todo guion acaba pidiendo
   algo, y eso no convierte un educativo en un anuncio. */
const ESCENA_DE_CIERRE = /^(oferta|cta|llamado)/i

function revisarTipo(escenas: any[], tipo: string, intocable = '') {
  const T = TIPOS_VIDEO[tipo]
  if (!T) return []
  const suyo = llana(intocable)
  const esSuyo = (m: string) => !!suyo && !!m && suyo.includes(llana(m))
  const quejas: string[] = []
  escenas.forEach((x: any, i: number) => {
    const dice = String(x?.dice || '')
    if (!dice) return
    if (ESCENA_DE_CIERRE.test(String(x?.escena || ''))) return
    const m = T.pat ? T.pat.exec(dice) : null
    if (m && !esSuyo(m[0])) quejas.push(`Escena ${i + 1}: «${m[0]}». ${T.di}`)
    /* El cartel del producto. En uno de venta no aplica: ahí el producto es el protagonista. */
    if (tipo !== 'venta') {
      const a = ANUNCIO.exec(dice)
      if (a && !esSuyo(a[0])) {
        quejas.push(`Escena ${i + 1}: «${a[0]}» es lenguaje de cartel publicitario. Di lo que ` +
          'pasa en la cocina, no lo que el producto promete.')
      }
    }
  })
  return quejas
}

/* ── Los tipos de escena ────────────────────────────────────────────────────────────────────
   Una escena VISUAL manda con el plano y la boca se calla. Una HABLADA lleva las dos cosas.
   Lo pidió Sergio: «en el gancho visual puso guion, se supone que es gancho visual, ahí no va
   guion». El gancho visual nace visual; los demás nacen hablados y él cambia el que quiera. */
const NACE_VISUAL = /visual/i

function claseDe(x: any) {
  const puesta = String(x?.clase || '').toLowerCase()
  if (puesta === 'visual' || puesta === 'hablada') return puesta
  return NACE_VISUAL.test(String(x?.escena || '')) ? 'visual' : 'hablada'
}

/* ── lab_escribir ─────────────────────────────────────────────────────────────────────────
   El guion ENTERO de una vez. Escena por escena no funcionaba y no era cuestión de afinar el
   prompt: un giro no se puede improvisar. Para plantar algo en la escena 3 que se pague en la 5
   hay que saber qué va a pasar en la 5.

   ⚠️ El orden de las claves del JSON NO es decorativo. `momento` y `remate` van ANTES que las
   escenas porque el modelo escribe en ese orden, y el orden en que escribe es el orden en que
   piensa. Si las escenas fueran primero, decidiría el remate cuando ya no le queda nada que
   rematar — que es exactamente lo que pasaba antes.                                          */
async function labEscribir(b: any) {
  const nombres = (Array.isArray(b?.escenas) ? b.escenas : [])
    .map((x: any) => t(typeof x === 'string' ? x : x?.escena, 40)).filter(Boolean)
  if (!nombres.length) throw new Error('No hay estructura: escoge una y vuelve.')

  /* Qué escenas son visuales: las que él marcó, y por defecto las que se llaman «visual». */
  const clases = (Array.isArray(b?.escenas) ? b.escenas : []).slice(0, nombres.length)
    .map((x: any, i: number) => claseDe(typeof x === 'string' ? { escena: x } : x))
  while (clases.length < nombres.length) clases.push(claseDe({ escena: nombres[clases.length] }))

  const dur = Math.min(Math.max(Number(b?.dur) || 45, 10), 180)
  const palabras = Math.round(dur * RITMO)

  const tipo = TIPOS_VIDEO[t(b?.tipo, 20)] ? t(b?.tipo, 20) : TIPO_POR_DEFECTO
  const T = TIPOS_VIDEO[tipo]

  const contexto = [
    `QUÉ TIPO DE VIDEO ES: ${T.nombre}. ${T.es} ${T.no}`,
    t(b?.objetivo, 300) ? `LO QUE ESTE VIDEO TIENE QUE MOSTRAR: ${t(b?.objetivo, 300)}` : '',
    t(b?.lugar, 150) ? `DE DÓNDE ES QUIEN GRABA: ${t(b?.lugar, 150)}. Escribe como se habla ` +
      'ahí: el tú o el usted que se use, y las palabras de ese sitio.' : '',
    t(b?.negocio, 3000) ? `EL NEGOCIO DE QUIEN GRABA: ${t(b?.negocio, 3000)}` : '',
    t(b?.producto, 80) ? `CÓMO SE LLAMA SU PRODUCTO: ${t(b?.producto, 80)}. Nómbralo así, y ` +
      'NUNCA en la primera mitad del guion: primero se ve el problema y lo que pasa sin él, y ' +
      'el nombre llega después.' : '',
    t(b?.palabras, 800) ? `LAS PALABRAS DE SU OFICIO, úsalas: ${t(b?.palabras, 800)}` : '',
    t(b?.numeros, 800) ? `NÚMEROS DE VERDAD QUE PUEDE SOLTAR, mete alguno: ${t(b?.numeros, 800)}` : '',
    `IDEA: ${t(b?.idea, 300) || '(sin escoger)'}`,
    t(b?.creencia, 300) ? `LO QUE CREE LA GENTE: ${t(b?.creencia, 300)}` : '',
    `ESTRUCTURA: ${t(b?.estructura, 80) || '(sin escoger)'}`,
    t(b?.gancho, 200) ? `EL OBJETIVO DEL GANCHO, ya elegido: ${t(b?.gancho, 200)}. La escena 1 ` +
      'tiene que ser de esa clase; no escojas tú otra.' : '',
    `FORMATO: ${t(b?.formato, 80) || '(sin escoger)'}`,
    `DURA ${dur} segundos, o sea unas ${palabras} palabras EN TOTAL entre todas las escenas.`,
    `LAS ESCENAS, EN ESTE ORDEN Y CON ESTOS NOMBRES:\n${nombres.map((n, i) =>
      `  ${i + 1}. ${n}${clases[i] === 'visual' ? '  ← VISUAL: aquí NO se habla. Deja «dice» vacío y cuenta todo en «ve».' : ''}`
    ).join('\n')}`,
    t(b?.pieGancho, 300)
      ? `EL GANCHO YA ESTÁ ELEGIDO Y ES ESTE, PALABRA POR PALABRA:\n  «${t(b?.pieGancho, 300)}»\n` +
        'La escena 1 lleva esas palabras TAL CUAL, enteras y seguidas. Puedes añadirle cuatro o ' +
        'cinco detrás si hacen falta. Cambiarlas, reordenarlas, partirlas o escribir otro ' +
        'gancho: no. No es una idea de la que partir, es la frase.'
      : '',
  ].filter(Boolean).join('\n')

  const sis = `Escribes el guion completo de un video corto para redes, en español de Colombia.
${OFICIO}
${EJEMPLOS}

CÓMO RESPONDER — SOLO este JSON, y en este orden:
{"momento":"...","remate":"...","escenas":[{"escena":"...","dice":"...","ve":"..."}],"porque":"..."}

«momento» es la escena concreta sobre la que va el video: una hora, un sitio y alguien haciendo
algo. Una frase.
«remate» es la frase que remata el video. Decídela AHORA, antes de escribir las escenas: todo lo
de antes es la pista de aterrizaje de esa frase.
«escenas» son las que te di, en ese orden y con esos nombres exactos. «dice» es lo que sale por
tu boca. «ve» es el plano, corto. NUNCA mezcles las dos cosas en la misma frase.
Las escenas marcadas VISUAL van MUDAS: «dice» vacío y todo el peso en «ve».
«porque» es una línea: de dónde sacaste el momento y el remate.`

  const pide = async (extra: string) => {
    const r = await ia(sis, contexto + extra, 'medium')
    const crudas = Array.isArray(r?.escenas) ? r.escenas : []
    /* Los nombres mandan los nuestros: si el modelo se inventa uno, la ficha deja de casar con
       la estructura que escogió Sergio. */
    const escenas = nombres.map((n, i) => ({
      escena: n,
      clase: clases[i],
      /* ⚠️ Una escena visual va MUDA, se lo recuerde o no. Se le dice en el prompt y además se
         le vacía aquí: en el primer guion escribió 16 palabras en el «gancho visual». */
      dice: clases[i] === 'visual' ? '' : t(crudas[i]?.dice, 700),
      ve: t(crudas[i]?.ve, 400),
    }))
    return { momento: t(r?.momento, 300), remate: t(r?.remate, 300),
             porque: t(r?.porque, 300), escenas }
  }

  const intocable = t(b?.pieGancho, 300)
  /* En un video DE VENTA el producto es el protagonista y puede repetirse. En los demás, no. */
  const marca = tipo === 'venta' ? '' : t(b?.producto, 80)
  let out = await pide('')
  let quejas = revisarGuion(out.escenas, intocable, out.remate, t(b?.estructura, 80), marca)
    .concat(revisarTipo(out.escenas, tipo, intocable))
  /* Una sola pasada de corrección: si con lo que falló delante tampoco sale, insistir gasta
     tiempo de Sergio y no arregla nada. Se devuelve con las quejas y que decida él. */
  if (quejas.length) {
    console.warn('[herramientas] lab_escribir, primera vuelta con fallos:', quejas.join(' | '))
    const segunda = await pide(
      `\n\nESTO YA LO ESCRIBISTE Y TIENE FALLOS. Reescríbelo entero arreglándolos:\n` +
      out.escenas.map((x, i) => `  ${i + 1}. ${x.escena}: ${x.dice}`).join('\n') +
      `\n\nLO QUE ESTÁ MAL:\n${quejas.map(q => '· ' + q).join('\n')}`)
    const quejas2 = revisarGuion(segunda.escenas, intocable, segunda.remate, t(b?.estructura, 80), marca)
      .concat(revisarTipo(segunda.escenas, tipo, intocable))
    if (quejas2.length <= quejas.length) { out = segunda; quejas = quejas2 }
  }

  /* Última red. Si después de las dos vueltas la escena 1 sigue sin sus palabras, se le ponen
     y ya: el gancho es suyo y no se pierde porque el modelo no obedezca. La queja se cae
     porque el problema queda resuelto, y dejarla puesta confundiría —diría que no lo respetó
     justo al lado del gancho respetado—. */
  if (intocable && clases[0] !== 'visual' &&
      !llana(out.escenas[0]?.dice).includes(llana(intocable))) {
    out.escenas[0] = { ...out.escenas[0], dice: intocable }
    quejas = quejas.filter(q => !q.startsWith('La escena 1 no dice el gancho'))
  }

  const pal = out.escenas.reduce((n, x) => n + (x.dice ? x.dice.split(/\s+/).filter(Boolean).length : 0), 0)
  return { ...out, quejas, palabras: pal, segundos: Math.round((pal / RITMO) * 10) / 10 }
}

/* ── lab_escena ──────────────────────────────────────────────────────────────────────────────────
   Una escena del guion, en tres modos: auditar / mejorar / escribir.

   El criterio es el de Sergio, y lo que importa es lo que NO se puede decir:
   · la frase de valla («No es X, es Y», «Sin X, sin Y», los trios por ritmo) está prohibida
   · el lenguaje de folleto («optimizar la operación», «solución integral») no lo dice nadie
   · un open loop promete y NO entrega — si entrega, no es un open loop
   · el gancho se decide antes de los 3 segundos                                              */
async function labEscena(b: any) {
  const modo = String(b?.modo || 'auditar')
  const escena = t(b?.escena ?? b?.paso, 60) || 'Escena'
  const dice = t(b?.dice, 900)
  const ve = t(b?.ve, 400)
  const esLoop = /loop/i.test(escena)
  const esGancho = /^gancho/i.test(escena)
  const i = Number(b?.i) || 0
  const total = Number(b?.total) || 0

  if (modo !== 'escribir' && !dice) throw new Error('Esta escena está vacía.')

  /* ⚠️ Va el guion ENTERO, no dos pasos de cada lado. Con los vecinos nada más, Cherry escribió
     «Día 3» en el paso 3 cuando el gancho decía «Día 1»: tenía el gancho delante y aun así se
     contradijo, así que darle menos no era la solución. Son nueve frases cortas.
     El paso que se está escribiendo va marcado, para que no lo confunda con los demás. */
  const guionEntero = (Array.isArray(b?.guion) ? b.guion : [])
    .map((x: any, n: number) => {
      const suyo = n === i
      const d = t(x?.dice, 300)
      const v = t(x?.ve, 160)
      return `${suyo ? '»»» ' : '    '}${n + 1}. ${t(x?.escena ?? x?.paso, 40)}: ` +
        (d || (suyo ? '(ESTA es la que escribes ahora)' : '(todavía sin escribir)')) +
        (v ? `  [se ve: ${v}]` : '')
    }).join('\n')

  const contexto = [
    t(b?.negocio, 3000) ? `EL NEGOCIO DE QUIEN GRABA: ${t(b?.negocio, 3000)}` : '',
    `IDEA DEL VIDEO: ${t(b?.idea, 300) || '(sin escoger)'}`,
    t(b?.creencia, 300) ? `LO QUE CREE LA GENTE: ${t(b?.creencia, 300)}` : '',
    `ESTRUCTURA: ${t(b?.estructura, 80) || '(sin escoger)'}`,
    `FORMATO: ${t(b?.formato, 80) || '(sin escoger)'}`,
    `ESTA ESCENA: ${escena} — la ${i + 1} de ${total}${t(b?.tramo, 30) ? `, segundos ${t(b?.tramo, 30)}` : ''}`,
    guionEntero ? `EL GUION COMPLETO, tal como está ahora:\n${guionEntero}` : '',
    ve ? `LO QUE SE VE EN ESTA ESCENA: ${ve}` : '',
  ].filter(Boolean).join('\n')

  const REGLAS = [
    /* Lo primero, porque es lo que falló: tenía el gancho delante y escribió otra cosa. */
    'LO PRIMERO, LA COHERENCIA: los pasos son UN solo video, no frases sueltas. Lee el guion',
    'completo antes de escribir y NO contradigas nada de lo que ya está puesto. Si el gancho',
    'dice «Día 1», este paso no puede decir «Día 3». Si el gancho promete algo, este paso va',
    'hacia ahí. Si no sabes algo del negocio, NO te lo inventes: escribe con lo que ya está.',
    'Escribes para redes, en español de COLOMBIA. Se dice «empiezas», «tienes», «mira», «puedes».',
    'NUNCA «empezás», «tenés», «mirá», «podés», «vos»: eso es de otro país y suena prestado.',
    'PROHIBIDA la frase de valla: «No es X, es Y», «Sin X, sin Y», los tríos por ritmo,',
    '«¿El secreto? …», «Así de simple». Si te sale una, cámbiala.',
    'Nada de lenguaje de folleto: «optimizar la operación», «solución integral», «en tiempo real»,',
    '«plataforma», «analítica», «herramienta digital». Di lo que pasa, con las palabras del oficio',
    'de quien escucha: comandas, mesas, domicilios, caja, cocina.',
    esLoop ? 'ESTA ESCENA ES UN OPEN LOOP: promete algo y NO lo entrega. Si lo entrega, no sirve.' : '',
    esGancho ? 'ESTA ES EL GANCHO: se decide antes de los 3 segundos. Corto y concreto.' : '',
  ].filter(Boolean).join(' ')

  /* Lo que se cuenta, se cuenta. Ver RITMO arriba. */
  const medir = (txt: string) => {
    const pal = txt ? txt.split(/\s+/).filter(Boolean).length : 0
    return { pal, seg: Math.round((pal / RITMO) * 10) / 10 }
  }

  if (modo === 'auditar') {
    const m = medir(dice)
    const duros: any[] = []
    if (esGancho && m.seg > 3.2) {
      duros.push({ que: `El gancho son ${m.pal} palabras.`, grave: true,
        nota: `a ${String(RITMO).replace('.', ',')} por segundo son ${m.seg} s, y el scroll se decide antes de los 3.` })
    }
    if (/^\s*no es .+,\s*es /i.test(dice) || /sin .+,\s*sin /i.test(dice)) {
      duros.push({ que: 'Frase de valla.', grave: true,
        nota: 'la tienes prohibida: léela en voz alta y verás.' })
    }

    const sis = `Auditas UNA escena del guion de un video corto. ${OFICIO}
${REGLAS}
Responde SOLO este JSON: {"filas":[{"que":"...","nota":"...","bien":true|false,"grave":true|false}]}
«que» es la pega en pocas palabras; «nota» explica qué cambiar, concreto, sin rodeos.
Como mucho tres filas. Si la escena está bien, UNA fila con bien:true.
No repitas lo que ya te digo abajo en DATOS MEDIDOS: eso ya está contado.`
    const usr = `${contexto}\n\nDATOS MEDIDOS: ${m.pal} palabras, ${m.seg} s hablando.` +
      (duros.length ? `\nYA DETECTADO (no lo repitas): ${duros.map(x => x.que).join(' / ')}` : '')

    let filas: any[] = []
    try {
      const r = await ia(sis, usr, 'low')
      filas = Array.isArray(r?.filas) ? r.filas.slice(0, 3) : []
    } catch (e) {
      console.warn('[herramientas] lab_escena auditar sin IA:', String(e))
    }
    const todo = [...duros, ...filas.filter((x: any) => !x?.bien || !duros.length)]
    return { filas: todo.length ? todo : [{ que: 'Esta escena está bien.', bien: true,
      nota: 'suena a ti y hace lo que tiene que hacer en su sitio.' }] }
  }

  /* mejorar · escribir */
  const sis = `${modo === 'mejorar'
    ? 'Reescribes UNA escena del guion. Mantienes LO QUE DICE; cambias CÓMO lo dice.'
    : 'Escribes UNA escena del guion desde cero.'} ${OFICIO}
${REGLAS}
Tiene que encajar con lo que va antes y con lo que va después: ni repetir ni contradecir.
Responde SOLO este JSON: {"dice":"...","ve":"...","porque":"..."}
«dice» es lo que se escucha, una o dos frases. «ve» es el plano o lo que aparece en pantalla, corto.
«porque» es una línea diciendo qué cambiaste y por qué${modo === 'escribir' ? ', o por dónde lo cogiste' : ''}.
ANTES DE RESPONDER, reléelo contra el guion completo: si contradice algún paso, si tiene voseo
o si se te coló una palabra de folleto, vuelve a escribirlo.`

  const r = await ia(sis, contexto, 'low')
  return { dice: t(r?.dice, 600), ve: t(r?.ve, 300), porque: t(r?.porque, 300) }
}

async function labGuion(b: any) {
  const secs: any[] = Array.isArray(b?.secciones) ? b.secciones : []
  const dice = (tipo: string) => secs.filter(x => x.tipo === tipo).map(x => t(x.dice, 600)).filter(Boolean)
  const todo = secs.map(x => t(x.dice, 600)).filter(Boolean).join(' ')
  if (!todo) throw new Error('El guion está vacío: no hay nada que auditar.')

  const palabras = todo.split(/\s+/).filter(Boolean).length
  const dur = Number(b?.dur) || 0
  const filas: any[] = []
  const pon = (que: string, estado: 'bien' | 'mal' | 'ojo', nota: string, arreglo?: string) =>
    filas.push({ que, estado, nota, ...(arreglo ? { arreglo } : {}) })

  /* ── 1 · el gancho ── */
  const g = dice('gancho').join(' ')
  const palG = g ? g.split(/\s+/).filter(Boolean).length : 0
  if (!g) pon('El gancho', 'mal', 'No has escrito nada en la primera sección.',
    'Sin gancho el resto da igual: nadie llega a oírlo.')
  else if (palG > 10) pon('El gancho', 'mal', `${palG} palabras no caben en tres segundos: son unos ${Math.round(palG / PAL_POR_SEG)} s.`,
    'Déjalo en 8 palabras o menos. Lo que sobre va a la sección siguiente.')
  else pon('El gancho', 'bien', `${palG} palabras: cabe en los primeros tres segundos.`)

  /* ── 2 · los open loops, con las mismas tres señales de siempre ── */
  const loops = senalesDeLoop(todo, dur).filter(x => x.via !== 'cta')
  const hayLoopEscrito = secs.some(x => x.tipo === 'loop' && t(x.dice, 600))
  if (!loops.length) {
    pon('Los open loops', 'mal',
      hayLoopEscrito ? 'Tienes secciones de open loop escritas, pero ninguna aplaza nada de verdad.'
        : 'No hay ni uno: nada obliga a seguir viendo.',
      'Corta una frase a la mitad, señala sin nombrar («y esto es lo que casi nadie hace…») o remite a otro momento del video.')
  } else if (loops.length === 1) {
    pon('Los open loops', 'mal', `Solo uno, en el segundo ${loops[0].seg}: «${t(loops[0].texto, 90)}».`,
      'Con uno no se sostiene un video entero. Van encadenados: uno abre mientras el anterior sigue sin cerrarse.')
  } else {
    const ultimo = loops[loops.length - 1]
    const hueco = dur ? dur - ultimo.seg : 0
    if (dur && hueco > dur * 0.35) {
      pon('Los open loops', 'ojo', `${loops.length} encadenados, pero el último está a ${Math.round(hueco)} s del final.`,
        'Ese tramo final va sin nada que sostenga. Mete uno más antes del giro.')
    } else {
      pon('Los open loops', 'bien', `${loops.length} encadenados, el último en el segundo ${ultimo.seg}.`)
    }
  }

  /* ── 3 · el CTA, que NO es un open loop ── */
  const cta = dice('cta').join(' ')
  if (!cta) pon('El CTA', 'mal', 'No hay cierre escrito.', 'Uno solo y claro: que siga, que comente o que comparta.')
  else if (!REMITE.test(cta) && !/\b(sígueme|sigue|comenta|comparte|guarda|escríbeme|dale)\b/i.test(cta)) {
    pon('El CTA', 'ojo', 'El cierre no pide nada concreto.', 'Di exactamente qué quieres que hagan.')
  } else pon('El CTA', 'bien', 'Pide algo concreto al final.')

  /* ── 4 · la idea en sus tres partes ── */
  const idea = b?.idea || {}
  const falta = ['tema', 'creencia', 'realidad'].filter(k => !t(idea[k], 300))
  if (falta.length) {
    const como: Record<string, string> = { tema: 'de qué va', creencia: 'qué cree la gente', realidad: 'qué pasa en realidad' }
    pon('La idea', falta.length === 3 ? 'mal' : 'ojo',
      `Te falta: ${falta.map(k => como[k]).join(', ')}.`,
      falta.includes('realidad') ? 'Sin la tercera parte el video promete y no suelta.' : undefined)
  } else pon('La idea', 'bien', 'Está completa: el tema, lo que cree la gente y lo que pasa en realidad.')

  /* ── 5 · lo que se ve, que es la columna que casi nadie escribe ── */
  const conTexto = secs.filter(x => t(x.dice, 600)).length
  const conVisual = secs.filter(x => t(x.dice, 600) && t(x.ve, 600)).length
  if (!conVisual) pon('Lo que se ve', 'mal', 'No has escrito la columna visual en ninguna sección.',
    'Si no está escrita, en la grabación sale lo de siempre: tú hablando de frente.')
  else if (conVisual < conTexto) pon('Lo que se ve', 'ojo', `${conVisual} de ${conTexto} secciones tienen escrito qué se ve.`,
    'Las que faltan van a acabar siendo plano fijo.')
  else pon('Lo que se ve', 'bien', 'Todas las secciones tienen escrito qué se ve.')

  /* ── 6 · si cabe en los segundos ── */
  if (dur) {
    const segs = Math.round(palabras / PAL_POR_SEG)
    if (segs > dur * 1.15) pon('La duración', 'mal', `${palabras} palabras son unos ${segs} s, y dijiste ${dur} s.`,
      `Sobran unas ${Math.round((segs - dur) * PAL_POR_SEG)} palabras.`)
    else if (segs < dur * 0.6) pon('La duración', 'ojo', `${palabras} palabras son unos ${segs} s, bastante menos de los ${dur} s que pusiste.`,
      'O sobra duración, o falta guion.')
    else pon('La duración', 'bien', `${palabras} palabras ≈ ${segs} s, y dijiste ${dur} s.`)
  }

  /* ── 7 · lo que hay que juzgar y no se puede contar ── */
  try {
    const o = await ia(
      'Eres un analista de contenido viral. Te dan un guion de video corto y lo juzgas en tres cosas, sin inventar nada.\n' +
      'ZONA: es a CUÁNTA GENTE le puede interesar el tema, y si le deja algo. No juzgas si el consejo es bueno, original o profundo: eso no es la zona.\n' +
      '  · «mainstream»: cabe en cualquier cuenta y no deja nada que usar — un trend de baile, un reto, un meme, «5 datos curiosos del agua».\n' +
      '  · «nicho»: hay que saber ya del tema para entenderlo — «cómo configurar el webhook de la API de WhatsApp Business».\n' +
      '  · «segura»: le interesa a mucha gente Y le deja algo que entiende mejor o puede usar — «por qué tu restaurante pierde dinero los martes», «por qué unos videos se ven y otros no». Que el consejo ya se haya dicho antes NO lo saca de aquí.\n' +
      'LENGUAJE: «sencillo» si lo entiende cualquiera; «tecnico» si usa palabras que dejan fuera a mucha gente (devuélvelas en tecnicas[]).\n' +
      'EMOCION: qué emoción fuerte provoca la PRIMERA frase. Una de: Curiosidad, Controversia, Rabia, Tristeza, Motivación, Felicidad, Miedo, Sorpresa. Si no provoca ninguna fuerte, devuelve null.\n' +
      'Devuelves SOLO JSON {"zona":"segura","porque":"","lenguaje":"sencillo","tecnicas":[],"emocion":"Curiosidad"}.',
      `GANCHO: ${t(g, 400)}\n\nGUION COMPLETO: ${corta(todo, 4000)}`)

    const zonaDicha = t(b?.zona, 20)
    if (o?.zona) {
      if (o.zona === 'segura') pon('La zona', 'bien', 'Es lo más general posible sin llegar a ser inútil.')
      else pon('La zona', 'mal', o.zona === 'nicho'
        ? `Sale de nicho: ${t(o.porque, 200) || 'hay que saber del tema para entenderlo'}.`
        : `Sale demasiado general: ${t(o.porque, 200) || 'llega lejos y no deja nada'}.`,
        zonaDicha && zonaDicha !== o.zona ? `Tú lo pusiste como «${zonaDicha}».` : undefined)
    }

    if (o?.lenguaje === 'tecnico') {
      const tec = Array.isArray(o.tecnicas) ? o.tecnicas.slice(0, 5).map((x: any) => t(x, 40)).filter(Boolean) : []
      pon('El lenguaje', 'mal', tec.length ? `Palabras que dejan gente fuera: ${tec.join(', ')}.` : 'Es técnico.',
        'Técnico = pocos lo entienden = no se hace viral.')
    } else if (o?.lenguaje === 'sencillo') pon('El lenguaje', 'bien', 'Lo entiende cualquiera.')

    const emDicha = t(b?.emocion, 30)
    if (!o?.emocion) {
      pon('La emoción del gancho', 'mal', 'La primera frase no provoca ninguna emoción fuerte.',
        'Es lo que para el scroll: curiosidad, controversia, rabia, tristeza, motivación, felicidad, miedo o sorpresa.')
    } else if (emDicha && emDicha.toLowerCase() !== String(o.emocion).toLowerCase()) {
      pon('La emoción del gancho', 'ojo', `Tú querías ${emDicha.toLowerCase()}, pero lo que da es ${String(o.emocion).toLowerCase()}.`,
        'O cambias el gancho, o cambias lo que esperas de él.')
    } else pon('La emoción del gancho', 'bien', `Da ${String(o.emocion).toLowerCase()}, que es una emoción fuerte.`)
  } catch (e) {
    console.warn('[herramientas] lab_guion sin IA:', String(e))
    pon('La zona y el lenguaje', 'ojo', 'No se pudieron juzgar esta vez.', 'Vuelve a auditar en un momento.')
  }

  return { filas }
}

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
    else if (b.accion === 'lab_guion') r = await labGuion(b)
    else if (b.accion === 'lab_escena' || b.accion === 'lab_paso') r = await labEscena(b)
    else if (b.accion === 'lab_escribir') r = await labEscribir(b)
    /* El catálogo de tipos, para que la ficha lo pinte sin repetir los nombres. */
    else if (b.accion === 'lab_tipos') r = {
      tipos: Object.keys(TIPOS_VIDEO).map(k => ({ id: k, ...TIPOS_VIDEO[k], pat: undefined })),
      porDefecto: TIPO_POR_DEFECTO,
    }
    else return responder({ error: 'acción desconocida' }, 400)
    console.log(`[herramientas] ${b.accion} de ${uid.slice(0, 8)} en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    return responder(r)
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

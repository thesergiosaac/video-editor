// herramientas v1 (19-sep-2026) — la IA de las herramientas del inicio de Cherry (Guiones, Storyboard, Carruseles, Calendario).
// Con sesión de usuario (la llama la página). Acciones:
//   · guion_escribir {tema, publico, tono, dur, frases, voz}        → {titulo, gancho, puntos[], cierre}
//   · guion_ganchos {tema, gancho, tono, dur, voz}                    → {ganchos:[{tecnica, texto}]}
//   · storyboard_partir {texto, meta}                                 → {titulo, escenas:[{tipo, dice, plano, lugar, objeto, gesto, apoyo}]}
//   · carrusel_armar {fuente, texto, tema, publico, n, voz, objetivo?, palabra?, plan?[{rol, modo, texto}]}
//                                                                  → {nombre, kicker, ganchos[3], clave, sub, ideas[[t,x,clave]], cierre[t,x,accion], palabra, intro, pregunta, tags[]}
//   · carrusel_fotos {fotos[{i, img}], laminas[{i, rol, titulo, texto}]} → {fotos[{i, desc, cara, libre, luz}], asignar[]}  (mira las fotos)
//   · publicacion_texto {titulo, tipo, detalle?, texto?, transcripcion?, fotos?[{seg, img}], laminas?[], dur?, negocio?, voz}
//                                                                  → {caption, tags[], palabras_clave[], tema, cta}  (16-oct: mira el video)
//   · lab_desmontar {texto, dur}                                      → {gancho, estructura[], mapa, formato, loops[], cadena, idea, alcance, contra, ritmo}
//   · lab_auditar {nuevo, control, cambia}                            → {sirve, filas[{campo, estado, nota}], arreglo}
//   · lab_guion {idea, zona, formato, emocion, dur, secciones[]}      → {filas[{que, estado, nota, arreglo}]}
//   · lab_escribir {objetivo, negocio, idea, detalles?, estructura, gancho, ganchoEjemplo?, pieGancho?, formato, dur, escenas[]}
//                                                                  → {momento, remate, hilo, lugar, escenas[] (las de más con extra), quejas[]}
//                                                                    (el escritor pone «dice»; el director, «ve»)
//   · lab_proponer {idea, pista, negocio?}                            → {texto, fuentes[{titulo, url}], sugerencias}
//                                                                    (27-oct: busca en Google con Gemini; «Haz que Cherry proponga»)
//   · lab_escena {modo, negocio, idea, estructura, escena, i, total, guion[]}  (alias viejo: lab_paso)
//       modo=auditar                                                → {filas[{que, nota, bien, grave}]}
//       modo=mejorar | escribir                                     → {dice, ve, porque}
// gpt-5-mini (esfuerzo bajo) con respaldo gpt-4o-mini. No guarda nada: la página guarda lo que el usuario acepta.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''   // (27-oct) solo para buscar en Google (lab_proponer)
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

/* (22-oct) Sergio: «el guion y todas sus partes las tiene que entender cualquier persona, tanto un niño pequeño como un
   anciano: no se puede dar nada por obvio». Va en todo lo que escribe Cherry. Los ejemplos de «así no» son frases que
   Cherry escribió de verdad; los de «así sí» no son contenido para copiar, son la forma.
   ⚠️ El mismo texto está en guion-calco.ts: si cambias uno, cambia el otro. */
const NADA_OBVIO = `NADA SE DA POR OBVIO. Todo lo que se dice lo tiene que entender a la primera cualquier persona que no sabe nada del tema: un niño de 5 años y una persona de 80.
- Cada palabra del oficio se cambia por una de todos los días o se explica en la misma frase con palabras de la casa: «nicho», «algoritmo», «retención», «engagement», «CTA», «branding», «formato», «trend» no se sueltan solas.
- Cada cosa se nombra: nunca «las dos», «la tercera», «eso», «ahí», «lo hace» sin decir qué («las dos reglas», «la tercera regla»).
- Cada verbo con su complemento: así no «la cuento al final», así sí «te la digo al final»; así no «se quedan», así sí «se quedan viendo tu video».
- Lo que se promete es concreto: dice QUÉ va a ganar o a ver quien mira. Así no: «la tercera redefine viral».
- Cada cosa se dice con lo que hace de verdad, no con una frase bonita que suena a texto generado.`
const ESTILO = `Escribes en español de Colombia, cercano y claro, para videos cortos de redes (Reels, TikTok) de creadores y emprendedores.
Reglas de estilo (obligatorias):
- Frases cortas que se entiendan al oírlas una vez. Nada de palabras rebuscadas ni de jerga de marketing.
- PROHIBIDAS las fórmulas de valla publicitaria: «No es X, es Y», «Sin X, sin Y», tríos por ritmo («rápido, fácil y barato»), «¿El secreto? …», «Así de simple», «Spoiler:», «Punto.». Léelo en voz alta: si suena a anuncio, cámbialo.
- Concreto: ejemplos, números y situaciones reales antes que ideas abstractas. Nada inventado que parezca un dato real (si das un número, que sea un ejemplo claro).
- Sin emojis, sin hashtags dentro del guion, sin saludos largos.
${NADA_OBVIO}`

function voz(v: any): string {
  if (!v || typeof v !== 'object') return ''
  const t = v.tono || {}
  const nivel = (x: any, a: string, b: string) => { const n = Number(x); return !Number.isFinite(n) ? '' : n <= 25 ? a : n >= 75 ? b : `entre ${a} y ${b}` }
  const partes = [nivel(t.formal, 'cercano (tutea)', 'formal (usa usted)'), nivel(t.serio, 'divertido', 'serio'), nivel(t.experto, 'sencillo', 'experto'), nivel(t.energia, 'calmado', 'enérgico')].filter(Boolean)
  const frases = Array.isArray(v.frases) ? v.frases.filter((f: any) => f && f.texto).slice(0, 8).map((f: any) => `${f.tipo || 'frase'}: «${String(f.texto).slice(0, 140)}»`) : []
  return (partes.length ? `Tono de la marca: ${partes.join(', ')}.` : '') + (frases.length ? `\nFrases de la marca (úsalas tal cual si encajan, sin forzarlas):\n${frases.join('\n')}` : '')
}

async function ia(sistema: string, usuarioTxt: string | unknown[], esfuerzo = 'low'): Promise<any> {
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
/* (26-oct) No todos venden un producto. Sergio: «algunas personas tienen un servicio, o algunas personas son el producto
   cuando hacen publicidad». `oferta` = producto | servicio | persona (vacío = producto, lo de antes); `nombre` es lo que
   escribió en «Cómo se llama tu producto / servicio» o «Cómo te presentas». */
function queOfrece(oferta: any, nombre: any, largo = 120): string {
  const n = t(nombre, largo)
  if (oferta === 'persona') return 'Es una marca personal: quien graba ES la marca (crea contenido y hace publicidad a otras marcas)' +
    (n ? `; se presenta como «${n}»` : '')
  if (!n) return ''
  return oferta === 'servicio' ? `Su servicio: ${n}` : `Su producto: ${n}`
}
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

/* (20-oct) Reclasificar SOLO el tipo de gancho de frases ya desmontadas (sin volver a mirar el video), con las mismas
   definiciones del desmontaje: así lo viejo y lo nuevo quedan parejos. Hasta 40 por llamada; solo el servidor. */
async function labGanchos(b: any) {
  const lista = (Array.isArray(b?.ganchos) ? b.ganchos : []).slice(0, 40)
    .map((g: any) => ({ id: t(g?.id, 40), gancho: t(g?.texto, 300), sigue: t(g?.sigue, 300) })).filter((g: any) => g.id && g.gancho)
  if (!lista.length) return { ganchos: [] }
  const sis = `Clasificas el GANCHO (la primera frase) de videos cortos. Te paso cada gancho con lo que se dice justo después, solo como contexto.
${GANCHO_DEF}
Devuelves SOLO JSON {"ganchos":[{"id":"...","tipo":"..."}]} con TODOS los id que te paso.`
  const o = await ia(sis, JSON.stringify(lista))
  const de: Record<string, string> = {}
  ;(Array.isArray(o?.ganchos) ? o.ganchos : []).forEach((x: any) => { if (x?.id && GANCHOS.includes(String(x?.tipo))) de[String(x.id)] = String(x.tipo) })
  return { ganchos: lista.map((g: any) => ({ id: g.id, tipo: de[g.id] || '' })) }
}

async function guionGanchos(b: any) {
  const sis = `${ESTILO}\nPropones ganchos (la primera frase de un video corto). Devuelves SOLO JSON {"ganchos":[{"tecnica":"Pregunta","texto":"..."}]} con exactamente 3, cada uno con una técnica distinta entre: Pregunta, Historia, Promesa, Error común, Dato que sorprende, Contradicción, Misterio (anuncia algo concreto sin decir qué es). Máx. 20 palabras cada uno, que se digan en 3 segundos.`
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

/* El objetivo decide el cierre (Sergio, 26-sep): la palabra clave, y con ella la respuesta automática, solo cuando se
   lleva a la gente a algo que se entrega por privado. */
const CIERRES: Record<string, string> = {
  automatizar: 'El cierre lleva a comentar la PALABRA para recibir por privado lo que el carrusel promete (una guía, una plantilla, un enlace). El botón dice «Comenta PALABRA».',
  vender: 'El cierre invita a comentar la PALABRA para recibir información del producto o servicio. El botón dice «Comenta PALABRA».',
  conversar: 'El cierre es una pregunta que dé ganas de opinar en los comentarios. SIN palabra clave.',
  inspirar: 'El cierre invita a guardar el carrusel o a mandárselo a alguien que lo necesite. SIN palabra clave.',
  ensenar: 'El cierre invita a guardarlo para usarlo, con una pregunta corta. SIN palabra clave.',
  seguidores: 'El cierre invita a seguir la cuenta para ver la parte 2 o lo que viene. SIN palabra clave.',
}
async function carruselArmar(b: any) {
  const n = Math.max(1, Math.min(10, Math.round(Number(b.n) || 6)))
  const objetivo = CIERRES[b.objetivo] ? String(b.objetivo) : ''
  const conPalabra = objetivo === 'automatizar' || objetivo === 'vender'
  // con foto de fondo el texto va encima de la imagen: tiene que ser corto para leerse (27-sep)
  const conFoto = ['diario', 'revista', 'frase', 'resaltador', 'poster', 'pasos', 'tuit', 'chat', 'album'].includes(b.estilo)
  const maxTexto = conFoto ? 90 : 150
  const palabraDada = t(b.palabra, 20).toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, '')
  /* Lámina por lámina: «textual» sale tal cual (la página lo pone encima), «descrito» dice de qué trata y la IA escribe. */
  const plan = (Array.isArray(b.plan) ? b.plan : []).slice(0, n + 2).map((p: any) => ({ rol: t(p?.rol, 10), modo: ['textual', 'descrito'].includes(p?.modo) ? p.modo : 'cherry', texto: t(p?.texto, 220) }))
  const nombreLam = (p: any, k: number) => p.rol === 'portada' ? 'Portada (el gancho)' : p.rol === 'cierre' ? 'Cierre' : `Idea ${k}`
  let kIdea = 0
  const planTxt = plan.some((p: any) => p.modo !== 'cherry') ? '\nPlan lámina por lámina (OBLIGATORIO):\n' + plan.map((p: any) => {
    if (p.rol === 'idea') kIdea++
    const q = nombreLam(p, kIdea)
    return p.modo === 'textual' ? `- ${q}: el texto ya está escrito, va TAL CUAL: «${p.texto}». Úsalo exacto en su sitio y que las demás láminas encajen con él.`
      : p.modo === 'descrito' ? `- ${q}: trata de esto: ${p.texto}. Escríbela tú.`
      : `- ${q}: la decides tú.`
  }).join('\n') : ''
  const sis = `${ESTILO}\nArmas carruseles de Instagram (láminas 4:5) que la gente guarda. Devuelves SOLO JSON:
{"nombre":"...","kicker":"...","ganchos":["...","...","..."],"clave":"...","sub":"...","ideas":[["título","texto","clave"]],"cierre":["pregunta o título","texto","botón"],"palabra":"...","intro":"...","pregunta":"...","tags":["..."]}
- ganchos: 3 portadas distintas (máx. 70 letras cada una). Puedes usar el número de ideas (${n}).
- clave: UNA palabra de ganchos[0], copiada exactamente como está escrita, la más fuerte (se destaca en grande en el diseño).
- kicker: frase pequeña de arriba de la portada (máx. 30 letras), p. ej. a quién va dirigido.
- sub: una línea de apoyo para la portada (máx. 90 letras).
- ideas: exactamente ${n}, cada una con título corto (máx. 45 letras), texto (máx. ${maxTexto} letras) con algo concreto que se pueda aplicar, y su clave: UNA palabra del título copiada exacta.
- cierre: [título (máx. 45), texto (máx. ${maxTexto}), botón corto (máx. 28 letras)]. ${objetivo ? CIERRES[objetivo] : 'El texto invita a guardar o comentar.'}
- palabra: ${conPalabra ? (palabraDada ? `usa exactamente «${palabraDada}».` : 'UNA palabra en MAYÚSCULAS, fácil de escribir, que tenga que ver con lo que se entrega.') : 'deja "" (vacía).'}
- intro: 1 frase para empezar el texto de la publicación. pregunta: 1 pregunta para los comentarios.
- tags: 8 a 12 hashtags en minúscula, sin #, en español, relevantes (nada genérico tipo "love").
- nombre: nombre corto para guardar el carrusel (máx. 60 letras).`
  const fuente = b.texto ? `Contenido de base (${t(b.fuente, 20) || 'texto'}):\n${t(b.texto, 6000)}` : `Tema: ${t(b.tema, 300)}`
  const usu = `${fuente}\nPara quién: ${t(b.publico, 200) || 'emprendedores y creadores'}${planTxt}\n${voz(b.voz)}`
  const o = await ia(sis, usu)
  const tope = 190   // nunca se corta a la mitad de una frase: si la IA se pasa, la página achica la letra
  const ideas = (Array.isArray(o.ideas) ? o.ideas : []).map((x: any) => Array.isArray(x) ? [corta(x[0], 60), corta(x[1], tope), t(x[2], 30)] : [corta(x?.titulo, 60), corta(x?.texto, tope), t(x?.clave, 30)]).filter((x: any) => x[0]).slice(0, n)
  const c = Array.isArray(o.cierre) ? o.cierre : []
  const palabra = conPalabra ? (palabraDada || t(o.palabra, 20).toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, '') || 'GUÍA') : ''
  return {
    nombre: t(o.nombre, 70), kicker: t(o.kicker, 40), sub: t(o.sub, 120), clave: t(o.clave, 30),
    ganchos: (Array.isArray(o.ganchos) ? o.ganchos : []).map((g: any) => t(g, 90)).filter(Boolean).slice(0, 3),
    ideas, cierre: [t(c[0], 60) || '¿Cuál te sirvió más?', corta(c[1], 190) || 'Cuéntame en los comentarios y guarda este carrusel.', t(c[2], 30) || 'Guárdalo'],
    palabra, intro: t(o.intro, 300), pregunta: t(o.pregunta, 160),
    tags: (Array.isArray(o.tags) ? o.tags : []).map((x: any) => t(x, 40).replace(/^#/, '').toLowerCase().replace(/[^a-z0-9ñáéíóú_]/g, '')).filter(Boolean).slice(0, 15),
  }
}

/* Mira las fotos del carrusel (27-sep-2026): qué muestra cada una, dónde está la cara, en qué franja cabe el texto sin
   tapar a nadie, y a qué lámina va cada una por lo que dice. Llegan achicadas (lado mayor 384 px) y se miran en
   «detail: low»: cuesta casi nada. No se guarda ninguna foto aquí. */
async function carruselFotos(b: any) {
  const fotos = (Array.isArray(b.fotos) ? b.fotos : [])
    .filter((f: any) => typeof f?.img === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(f.img) && f.img.length < 400000).slice(0, 10)
  const laminas = (Array.isArray(b.laminas) ? b.laminas : []).slice(0, 12)
    .map((l: any, i: number) => ({ i, rol: t(l?.rol, 10), titulo: t(l?.titulo, 120), texto: t(l?.texto, 200) }))
  if (!fotos.length || !laminas.length) return { fotos: [], asignar: [] }
  const sis = `Miras fotos para un carrusel de Instagram: láminas verticales 4:5 con el texto ENCIMA de la foto. Devuelves SOLO JSON:
{"fotos":[{"n":0,"desc":"...","cara":[0.5,0.3],"libre":"arriba","luz":"media"}],"asignar":[0,1,2]}
- fotos: una entrada por foto, con "n" = su número.
- desc: qué se ve, en una frase corta en español (quién, qué hace, dónde, qué transmite).
- cara: el centro de la cara principal como fracción del ancho y del alto de la foto (de 0 a 1). null si no hay caras.
- libre: la franja horizontal ("arriba", "centro" o "abajo") con menos cosas y SIN caras, donde el texto se lee bien.
- luz: "clara", "media" u "oscura".
- asignar: para cada lámina, en orden, el número de la foto que mejor la acompaña por lo que dice. La portada lleva la más llamativa (una persona mirando a cámara, si la hay). No repitas una foto mientras quede alguna sin usar; si hay menos fotos que láminas, repite las que mejor encajen. El cierre puede repetir la de la portada.`
  const partes: unknown[] = [{ type: 'text', text: `Láminas:\n${laminas.map((l: any) => `${l.i}. [${l.rol}] ${l.titulo}${l.texto ? ' — ' + l.texto : ''}`).join('\n')}\n\nLas fotos, en orden:` }]
  fotos.forEach((f: any, k: number) => { partes.push({ type: 'text', text: `Foto ${k}:` }); partes.push({ type: 'image_url', image_url: { url: f.img, detail: 'low' } }) })
  const o = await ia(sis, partes)
  const idx = (k: any) => { const v = Math.round(Number(k)); return Number.isInteger(v) && v >= 0 && v < fotos.length ? v : -1 }
  const num = (v: any) => typeof v === 'number' && v >= 0 && v <= 1 ? Math.round(v * 1000) / 1000 : null
  const vistas = (Array.isArray(o?.fotos) ? o.fotos : []).map((x: any) => {
    const k = idx(x?.n ?? x?.i); if (k < 0) return null
    const cara = Array.isArray(x?.cara) && x.cara.length === 2 && num(x.cara[0]) != null && num(x.cara[1]) != null ? [num(x.cara[0]), num(x.cara[1])] : null
    return { i: Number.isInteger(fotos[k].i) ? fotos[k].i : k, desc: t(x?.desc, 160), cara, libre: ['arriba', 'centro', 'abajo'].includes(x?.libre) ? x.libre : null, luz: ['clara', 'media', 'oscura'].includes(x?.luz) ? x.luz : null }
  }).filter(Boolean)
  const asignar = laminas.map((_: any, i: number) => { const k = idx(Array.isArray(o?.asignar) ? o.asignar[i] : -1); return k < 0 ? -2 : (Number.isInteger(fotos[k].i) ? fotos[k].i : k) })
  return { fotos: vistas, asignar }
}

/* (16-oct-2026) El texto de la publicación MIRA el video. Sergio: «no lo hace bien… necesito que el sistema pueda mirar el
   video, saber de qué habla y hacer una descripción coherente basándose en SEO: clara, que entretenga y con palabras clave
   que de verdad hagan que el video se posicione». Antes solo le llegaba el título del proyecto («Proyecto 25»): escribía a
   ciegas. Ahora la página manda lo que el video DICE (la transcripción del Editor Pro), lo que SE VE (hasta 6 fotogramas) o,
   en un carrusel, el texto de sus láminas; y lo de su marca (de qué va, sus palabras). La IA primero dice de qué trata y qué
   buscaría la gente para encontrarlo, y con eso escribe. Compatible con lo de antes: `detalle` (el conector del chat) sigue. */
async function publicacionTexto(b: any) {
  const neg = b.negocio && typeof b.negocio === 'object' ? b.negocio : {}
  const marca = [neg.que && `De qué va su marca: ${t(neg.que, 300)}`, queOfrece(neg.oferta, neg.producto),
    neg.palabras && `Palabras de su oficio: ${t(neg.palabras, 200)}`, neg.lugar && `De dónde es: ${t(neg.lugar, 80)}`].filter(Boolean).join('\n')
  const laminas = (Array.isArray(b.laminas) ? b.laminas : []).map((x: any, i: number) => `${i + 1}. ${t(x, 300)}`).filter((x: string) => x.length > 3).slice(0, 15)
  const fotos = (Array.isArray(b.fotos) ? b.fotos : []).filter((f: any) => typeof f?.img === 'string' && f.img.startsWith('data:image/')).slice(0, 6)
  const dice = t(b.transcripcion, 6000)
  const sis = `${ESTILO}
Escribes el TEXTO DE LA PUBLICACIÓN (el que va debajo) de un ${t(b.tipo, 20) || 'video'} de Instagram/TikTok. Antes de escribir ENTIENDES la publicación con lo que te paso: lo que dice el video (la transcripción), lo que se ve (los fotogramas) o el texto de las láminas. Todo sale de ahí: nada que la publicación no diga.
Devuelves SOLO JSON {"tema":"...","cta":"...","palabras_clave":["..."],"caption":"...","tags":["..."]}:
- tema: en una frase, de qué trata EXACTAMENTE esta publicación: qué promete y qué enseña o cuenta.
- cta: el llamado a la acción que hace el video, si lo hace (lo que le pide a la gente: comentar una palabra, seguir la cuenta, guardar, compartir, escribir por privado, ir al enlace del perfil…), dicho como lo pide el video y con su palabra exacta si la hay. Búscalo en lo que dice (casi siempre al final) y en lo que se ve (un texto en pantalla, un botón de «seguir»). Si el video no pide nada, "".
- palabras_clave: 3 a 5 búsquedas que una persona escribiría en el buscador de Instagram o TikTok para encontrar justo esto (en español, 2 a 5 palabras, como habla la gente: «cómo editar reels», «ganchos para videos»). La primera es la principal.
- caption (Instagram y TikTok leen este texto para saber a quién mostrar el video; por eso las palabras clave van escritas tal cual, de forma natural, nunca amontonadas):
  · Primera línea, máx. 120 letras (es lo que se ve antes de «más»): engancha con lo más fuerte del video y lleva la palabra clave principal. Que den ganas de ver el video o de abrir el «más». Nada que el video no cumpla.
  · Después, 2 a 4 párrafos cortos con lo que la persona se lleva (lo concreto, con las palabras de la gente), metiendo las otras palabras clave donde encajen solas. Fiel al video: sin inventar datos, cifras, nombres ni promesas.
  · Cierre: si el video tiene llamado a la acción (cta), el texto TERMINA con ese mismo llamado: la misma acción y lo que la persona recibe. Si pide comentar una palabra («comenta GANCHO»), esa palabra EXACTA en MAYÚSCULAS: con ella salta la respuesta automática. No lo cambies por otro ni agregues un segundo llamado distinto. Solo si el video no pide nada, invita a guardarlo o deja una pregunta sobre el tema que se pueda contestar en una línea.
  · Párrafos separados por \\n\\n. Entre 350 y 1.200 letras. Sin @menciones, sin enlaces, sin hashtags dentro del texto.
  · Texto corrido, como lo contaría el creador: NADA de rótulos como «Qué te llevas:», «Lo que te llevas:», «En el video:», «Resumen:». La palabra clave va dentro de una frase normal, nunca sola al principio como etiqueta con dos puntos.
  · La transcripción es automática y a veces oye mal: si una palabra no encaja (el nombre de una herramienta, un término en inglés), corrígela con el contexto y con lo que se ve en los fotogramas. Nunca copies el error. Palabras de creadores que se oyen mal y se escriben así: storyboard (nunca «history board»), CapCut, reel / reels, hook, open loop, CTA, B-roll, TikTok, YouTube Shorts, Canva, ChatGPT.
- tags: 4 o 5 hashtags sin #, en minúscula y en español: 1 o 2 del nicho y el resto del tema exacto (los que usaría quien busca esto). Cada uno es UNA palabra o varias pegadas, sin espacios ni tildes (estructuradeguion, ganchosparareels). Nada de etiquetas vacías como viral, fyp, parati, reels o explore.
${b.texto ? 'El creador ya escribió un borrador: mejóralo con todo lo anterior sin perder lo que quiso decir.' : ''}`
  const txt = [`Publicación: ${t(b.tipo, 20) || 'video'} «${t(b.titulo, 140)}»${Number(b.dur) > 0 ? ` · dura ${Math.round(Number(b.dur))} s` : ''}`,
    dice ? `Lo que DICE el video (transcripción automática; puede traer errores pequeños):\n«${dice}»` : '',
    laminas.length ? `El texto de las láminas, en orden:\n${laminas.join('\n')}` : '',
    b.detalle ? `De qué trata (lo cuenta el creador): ${t(b.detalle, 1500)}` : '',
    b.texto ? `Su borrador: «${t(b.texto, 1500)}»` : '',
    marca, voz(b.voz),
    fotos.length ? `Lo que SE VE: ${fotos.length} fotogramas del video, en orden.` : ''].filter(Boolean).join('\n\n')
  const partes: unknown[] = [{ type: 'text', text: txt }]
  fotos.forEach((f: any) => { partes.push({ type: 'text', text: `Segundo ${Math.round(Number(f.seg) || 0)}:` }); partes.push({ type: 'image_url', image_url: { url: f.img, detail: 'low' } }) })
  const o = await ia(sis, fotos.length ? partes : txt)
  // (16-oct) los párrafos se conservan: `t()` juntaba los saltos de línea en espacios y el texto llegaba en un solo bloque
  const limpio = String(o.caption ?? '').replace(/\\n/g, '\n').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000)
  // cada párrafo empieza en mayúscula (también tras ¿ ¡ « ") y el texto no queda sin punto final
  const parrafos = limpio.split('\n').map((p) => p.replace(/^([¿¡«"“(]*)(\p{Ll})/u, (_m, a, b) => a + b.toUpperCase())).join('\n').replace(/([\p{L}\p{N}])$/u, '$1.')
  // (16-oct) un hashtag con espacios se corta en Instagram («#open loop» queda «#open»): se pegan las palabras y se quitan las tildes
  const etiqueta = (x: any) => t(x, 60).toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ').replace(/[^a-z0-9ñ]/g, '').slice(0, 40)
  const tags = [...new Set((Array.isArray(o.tags) ? o.tags : []).map(etiqueta).filter((x: string) => x.length > 1))].slice(0, 5)
  return { caption: parrafos, tags,
    palabras_clave: (Array.isArray(o.palabras_clave) ? o.palabras_clave : []).map((x: any) => t(x, 60)).filter(Boolean).slice(0, 5), tema: t(o.tema, 300), cta: t(o.cta, 200) }
}


/* ── El Laboratorio (20-sep-2026) ───────────────────────────────────────────────────────────────
   Desmontar: qué lleva dentro un video que funcionó. Lo MEDIBLE (palabras por minuto, duración) se
   calcula aquí con los números reales; a la IA solo se le pide lo que hay que interpretar. Si se
   mezclan las dos cosas, la IA devuelve cifras que parecen medidas y no lo son. */
/* (20-oct, aprobadas por Sergio) Qué es cada tipo de gancho. Sin la definición la IA adivinaba: la misma frase («En esta
   cuadra hay dos restaurantes…») salió «Contradicción» en un reel e «Historia» en otro, y «Lo siguiente» recomendaba el
   gancho equivocado. La fuente es docs/CRITERIO-SERGIO.md («Los tipos de gancho»); si cambia allá, cambia aquí. */
const GANCHOS = ['Pregunta', 'Dato', 'Contradicción', 'Orden', 'Confesión', 'Historia', 'Promesa', 'Error común', 'Misterio']
const GANCHO_DEF = `Qué es cada tipo de gancho (se juzga la PRIMERA frase tal como suena):
  «Historia» = arranca DENTRO de una escena o de algo que pasó: un lugar, una hora, unos personajes, alguien que habla. «En esta cuadra hay dos restaurantes, y a las 8 de la noche los dos están llenos.» · «Otra vez me faltan $40.000 en la caja.» (un personaje que se queja) · «¿Esta pizza tiene piña? No, no, tranquilo señor.» (un diálogo actuado es Historia aunque lleve pregunta).
  «Contradicción» = afirma lo CONTRARIO de lo que la gente cree. «Entre más vendes, menos ganas.» · «El momento en que tu restaurante más pedidos pierde es cuando está lleno.» Presentar dos casos que parecen iguales NO es contradicción: eso es Historia.
  «Pregunta» = le pregunta algo DIRECTAMENTE a quien mira, sobre él mismo. «¿Cuánto pierdes por mensajes sin responder?»
  «Dato» = arranca con un número o un hecho concreto que sorprende. «7 de cada 10 restaurantes cierran antes de 3 años.»
  «Orden» = le dice a quien mira qué hacer o qué dejar de hacer. «Deja de anotar los pedidos en papel.»
  «Confesión» = cuenta algo PROPIO que da vergüenza o que nadie admite. «Casi cierro mi restaurante por esto.»
  «Promesa» = dice lo que va a ganar si se queda. «Así no te vuelve a faltar plata en la caja.» · «Día 1 hasta que uses mi plataforma.»
  «Error común» = señala algo que casi todos hacen mal. «Si contestas los pedidos a mano, estás perdiendo plata.»
  «Misterio» = anuncia algo concreto SIN decir qué es, y obliga a quedarse para saberlo. «Hay una frase que espanta más clientes que la comida fea.»
Escoge siempre uno de estos nueve.`
/* Los formatos son los de Sergio (docs/CRITERIO-SERGIO.md): de producción, no categorías de
   escritor. Y desmontan el mito de «cambiar de toma cada 5 s»: eso es solo el formato dinámico. */
// (29-sep) «A cámara» pasó a «Estático» y entró «Plano fijo»
/* Qué es cada formato. Lo usan el desmontaje (para reconocerlo) y el escritor (para escribir lo que se ve). */
const FORMATO_DEF = 'Estático = la cámara quieta y habla desde el mismo sitio · Plano fijo = la cámara quieta y la persona se mueve (se acerca, se aleja, cambia de lugar) · Dinámico = la cámara cambia de lugar o de ángulo entre tomas, cada pocos segundos · Podcast = simula estar en uno · VS = enfrenta dos cosas a ver cuál gana · Top = numera (el 1, el 2, el 3) · B-roll = voz en off sobre escenas de apoyo, típico de motivación · Entrevista random = alguien llega y le pregunta, grabado en POV · Entrevista = simula que le preguntan, estático, con la mano o la persona que pregunta · Pantalla dividida = media pantalla con una grabación o ejemplos · Pantalla verde = reacciona a un video de fondo · Storytelling = cuenta algo mientras hace una acción natural (cocinar, afeitarse, conducir).'
const FORMATOS = ['Estático', 'Plano fijo', 'Dinámico', 'Podcast', 'VS', 'Top', 'B-roll', 'Entrevista random', 'Entrevista',
  'Pantalla dividida', 'Pantalla verde', 'Storytelling']
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
- gancho.tipo: uno de ${GANCHOS.join(', ')}. ${GANCHO_DEF}
  gancho.texto: las primeras palabras COPIADAS tal cual, sin cambiar nada (máx. 25 palabras). gancho.seg: cuántos segundos dura, contando 2,5 palabras por segundo.
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
  ${FORMATO_DEF}
  Del texto solo se puede adivinar hasta cierto punto: si dudas entre «Estático», «Plano fijo» y «Dinámico», pon «Estático» — eso se ve, no se lee (lo decide la hoja de fotogramas).
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
      nombre: FORMATOS.includes(o?.formato?.nombre) ? o.formato.nombre : 'Estático',
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
· TODO SE ENTIENDE SIN EXPLICACIONES. Un niño de 5 años y una persona de 80 tienen que
  entender cada frase. Cero palabras técnicas.
${NADA_OBVIO}
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

/* Qué hace cada paso de una estructura, para escribirlo. Es la lista del baúl (QUE_ES en laboratorio.html). Antes al
   escritor solo le llegaban los nombres —«Conector», «Pretexto»— y rellenaba cada escena con una frase cualquiera. */
const QUE_HACE: Record<string, string> = {
  'Gancho': 'la primera frase, la que para el scroll. Abre el tema de ESTE video',
  'Gancho visual': 'lo que se ve antes de que hables',
  'Conector': 'sigue justo de lo que dijo el gancho y sostiene hasta el segundo 10, sin soltar todavía el contenido',
  'Pretexto': 'por qué existe este video (me lo pidieron, me pasó esto, vi esto)',
  'Creencia': 'lo que cree la gente y vas a desmentir',
  'Cuerpo': 'un tramo del desarrollo',
  'Open loop': 'promete algo de ESTE mismo video y no lo suelta todavía; se paga más adelante',
  'Open loop visual': 'algo que irrumpe y tapa lo que la voz no llega a decir',
  'Prueba prestada': 'la autoridad de otro: un famoso, un caso, una captura real',
  'Ejemplo aplicado': 'enseñas el concepto ya hecho en vez de explicarlo',
  'Objeción': 'dices tú lo que el otro está pensando',
  'Giro': 'sueltas lo que venías aplazando',
  'Oferta': 'tu producto o servicio, antes del CTA y aparte',
  'CTA': 'pides algo: que comente, que siga, que comparta',
  'Remate': 'una frase que cierra sin pedir nada',
}
/* El nombre del catálogo que corresponde a ese paso (sin mirar tildes ni mayúsculas) y lo que hace. */
const pasoDe = (n: string) => Object.keys(QUE_HACE).find(p => llana(p) === llana(n)) || ''
const queHace = (n: string) => QUE_HACE[pasoDe(n)] || ''
/* (21-oct) La estructura es una BASE, no una regla fija: cuántos pasos de más puede meter Cherry si el guion los pide. */
const MAS_PASOS = 3
/* La línea de GANCHO_DEF de ese tipo («Pregunta» = …) y la de FORMATO_DEF de ese formato.
   ⚠️ (21-oct) SIN sus frases de ejemplo: son de restaurantes y el escritor copió «¿Cuánto pierdes por mensajes sin
   responder?» como gancho de un video sobre fórmulas virales, y el guion entero se fue para ese lado. */
const defGancho = (tipo: string) => {
  const l = GANCHO_DEF.split('\n').find(x => x.trim().startsWith(`«${tipo}»`)) || ''
  const def = l.slice(l.indexOf(' = ') + 3).replace(/«[^»]*»(\s*\([^)]*\))?/g, '').replace(/\s*·\s*/g, ' ').replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim()
  return l ?`«${tipo}» = ${def}` : ''
}
const defFormato = (f: string) => FORMATO_DEF.split(' · ').find(l => llana(l.split(' = ')[0]) === llana(f)) || ''
/* Escenas que arrancan como una lista («Primero:», «Segundo:»): frases sueltas en vez de una historia. */
const DE_LISTA = /^\s*(primero|segundo|tercero|cuarto|quinto|uno|dos|tres|cuatro|\d+)\s*[:.,)-]/i

/* ── El director (21-oct) ─────────────────────────────────────────────────────────────────────
   Sergio: «que haya dos agentes: uno hace el guion y otro, con ese guion, decide qué hacer en cada escena, para que no
   se confunda». El que escribía hacía las dos cosas y se le mezclaban: «Borro en la pizarra esto: …» dentro de lo que se
   dice, «Voz fuera de cámara: … Yo: …», y una pizarra que aparecía en medio de una cocina. Ahora el escritor solo escribe
   lo que se dice y el director lee el guion ENTERO y pone lo que se ve, en un solo lugar y con los mismos objetos de
   principio a fin. Va en la IA barata: solo acomoda escenas.
   ⚠️ La misma función está en guion-calco.ts: si cambias una, cambia la otra. */
const DIRECTOR = `Eres el director de un video corto para redes (Reels, TikTok), en español de Colombia. El guion YA está
escrito y NO cambias ni una palabra de lo que se dice. Tu trabajo es decidir qué se VE en cada escena.
· UN SOLO MUNDO. Antes de nada escoge UN lugar y unos pocos objetos que tengan que ver con el tema, y mantenlos de
  principio a fin. Nada aparece de la nada: si en la escena 5 hay una pizarra, ya estaba ahí desde la primera. Solo
  cambias de lugar si el guion lo cuenta.
· Lo que se ve ACOMPAÑA lo que se dice: lo muestra o lo ilustra con algo que se pueda grabar con un celular, sin
  efectos caros. No repite la frase en palabras y no cuenta otra cosa.
· Corto: máx. 22 palabras por escena, en primera persona («levanto el celular», «señalo…») o describiendo el plano.
· Si en lo que se dice habla OTRA persona (entre comillas), di aquí quién es y desde dónde habla. Si hablas tú, no lo digas.
· Las escenas VISUAL no tienen voz: ya traen lo que pasa; respeta esa idea y ajústala al mismo lugar.
· Nada de logos, @usuarios ni marcas de agua.
· En palabras de todos los días: lo que se ve también lo tiene que entender cualquiera.
Devuelves SOLO JSON {"lugar":"...","escenas":[{"n":1,"ve":"..."}]} con TODAS las escenas, en orden.`

async function dirigir(escenas: any[], ctx: { idea?: string; formato?: string; momento?: string; negocio?: string }) {
  const def = ctx.formato ? FORMATO_DEF.split(' · ').find((l) => l.split(' = ')[0].toLowerCase() === ctx.formato!.toLowerCase()) : ''
  const usu = [
    ctx.idea && `DE QUÉ VA EL VIDEO: ${ctx.idea}`,
    ctx.negocio && `DE QUÉ HABLA LA CUENTA: ${ctx.negocio}`,
    ctx.formato && `EL FORMATO, que manda cómo se graba: ${ctx.formato}${def ? ` (${def})` : ''}`,
    ctx.momento && `LO QUE PENSÓ EL GUIONISTA QUE SE VE (úsalo si sirve): ${ctx.momento}`,
    `EL GUION:\n${escenas.map((x: any, i: number) => `${i + 1}. [${x.nombre || x.escena || ''}] ` +
      (x.dice ? `dice: «${x.dice}»` : `VISUAL, sin voz. Lo que pasa: «${x.ve || ''}»`)).join('\n')}`,
  ].filter(Boolean).join('\n')
  try {
    const r = await ia(DIRECTOR, usu, 'low')
    const ve: Record<number, string> = {}
    for (const e of (Array.isArray(r?.escenas) ? r.escenas : [])) { const n = Number(e?.n); if (n >= 1 && t(e?.ve, 300)) ve[n] = t(e.ve, 300) }
    return { lugar: t(r?.lugar, 200), escenas: escenas.map((x: any, i: number) => ({ ...x, ve: ve[i + 1] || x.ve || '' })) }
  } catch (e) {
    console.warn('[herramientas] el director falló, el guion sale sin lo que se ve:', String(e).slice(0, 200))
    return { lugar: '', escenas }
  }
}

/* Una acción o una indicación de grabación dentro de lo que se dice: «Borro en la pizarra esto: …», «Voz fuera de
   cámara: … Yo: …», «(señala la cámara)». Lo que se dice son solo palabras; lo demás lo pone el director. */
const ACOTACION = /(?:^|[.!?…:]\s+)(?:borro|tacho|señalo|levanto|apunto|escribo en|corte a|primer plano|plano (?:medio|cerrado|general|detalle))(?![\p{L}])|(?:^|[.!?…]\s+|["«“]\s*)(?:voz (?:en off|fuera de c[aá]mara|de fondo)|narrador|yo|otra voz|alguien)\s*:|\((?=[^)]*(?:c[aá]mara|plano|corte|pantalla|señal|muestr|levant|risas|pausa))[^)]*\)/iu
const acotaciones = (escenas: any[]) => escenas.map((x: any, i: number) => {
  const m = ACOTACION.exec(String(x?.dice || ''))
  return m ? `Escena ${i + 1}: «${t(m[0].replace(/^[.!?…:\s"«“]+/, ''), 60)}» es una acción o una indicación de grabación, ` +
    'no algo que se dice. En lo que se dice van solo las palabras: lo que haces lo pone el director.' : ''
}).filter(Boolean)

/* ── El lector (22-oct) ────────────────────────────────────────────────────────────────────────
   Sergio: «casi todo el guion estaba bien, solamente esta frase… ni siquiera se entiende»: «Te doy tres reglas prácticas;
   la tercera redefine viral y la cuento al final». Es el mismo lector del escritor premium (revisarLectura, en
   guion-calco.ts): una persona común que oye el guion en Instagram y señala lo que no entiende a la primera. Aquí, además,
   se arregla solo eso: se reescriben las escenas señaladas y el resto del guion no se toca. Si falla, sale como estaba. */
async function aclarar(escenas: any[], intocable = '', detalles = ''): Promise<any[]> {
  if (!escenas.some((e: any) => e?.dice)) return escenas
  const guion = (conNombre: boolean) => escenas.map((e: any, i: number) =>
    `${i + 1}. ${conNombre ? `[${e.escena}] ` : ''}${e?.dice || '(sin voz)'}`).join('\n')
  /* la escena 1 con el gancho que escribió él no se toca */
  const tocable = (n: number) => n >= 1 && n <= escenas.length && !!escenas[n - 1]?.dice && !(n === 1 && intocable)
  const frases = (v: any, max: number) => (Array.isArray(v) ? v : [])
    .map((c: any) => ({ n: Number(c?.n), frase: t(c?.frase, 240), porque: t(c?.porque, 160) }))
    .filter((c: any) => c.frase && tocable(c.n)).slice(0, max)
  try {
    const o = await ia(`Lees un guion de video corto como lo oiría en Instagram una persona común de Colombia que no sabe del tema. Devuelves SOLO JSON {"confusas":[{"n":1,"frase":"...","porque":"..."}],"inventadas":[{"n":1,"frase":"..."}]${detalles ? ',"fuera":[{"n":1,"frase":"..."}],"faltan":["..."]' : ''}}.
- confusas: las frases (cópialas tal cual, máx. 6) que esa persona —piensa en un niño de 5 años y en una persona de 80— NO entendería a la primera al oírlas: palabras del oficio sin explicar («nicho», «algoritmo», «retención», «engagement», «CTA»), cosas que se dan por sabidas («las dos», «la tercera», «eso» sin decir qué), promesas que no dicen qué va a ganar quien mira, palabras de manual o abstractas («redefine viral», «optimizar tu propuesta»), metáforas, frases telegráficas o con punto y coma, frases mal construidas o que suenan a traducción, frases sin sus artículos, verbos sin su complemento («la cuento al final» ¿qué cosa?, «subir en la mañana» ¿subir qué?), «el primero», «lo segundo» o números sueltos sin decir de qué. «n» es el número de la escena; «porque», en pocas palabras. Si todas se entienden, [].
- inventadas: las frases (cópialas tal cual, máx. 3) que dan como hecho algo que nadie le dio a quien escribe: un resultado de quien graba («lo probé y me subió el alcance»), un cliente, un caso, un estudio o una cifra que suena a dato real. Un número dicho como ejemplo («imagina que…») no cuenta. Si no hay, [].` +
      (detalles ? `
- fuera: las frases (cópialas tal cual, máx. 4) que meten un tema, un consejo, un producto o un dato concreto que el creador NO dio en sus detalles y que no sale de ellos. Lo que solo une las ideas o pide algo al final no cuenta. Si no hay, [].
- faltan: los puntos de los detalles del creador que NO aparecen en el guion, ni dichos con otras palabras (cópialos tal cual). Si están todos, [].` : ''),
      (detalles ? `LOS DETALLES DEL CREADOR (lo que quiere que diga el video): «${detalles}»\n\nEL GUION:\n` : '') + guion(false), 'low')
    const confusas = frases(o?.confusas, 6)
    const inventadas = frases(o?.inventadas, 3)
    const fuera = detalles ? frases(o?.fuera, 4) : []
    const faltan = detalles ? (Array.isArray(o?.faltan) ? o.faltan : []).map((x: any) => t(x, 200)).filter(Boolean).slice(0, 5) : []
    if (!confusas.length && !inventadas.length && !fuera.length && !faltan.length) return escenas
    /* lo que falta puede ir en cualquier escena; lo demás, solo en las señaladas */
    const ns: number[] = faltan.length ? escenas.map((_: any, i: number) => i + 1).filter(tocable)
      : [...new Set([...confusas, ...inventadas, ...fuera].map((c: any) => c.n))]
    const fx = await ia(`${ESTILO}
Arreglas un guion de video corto. Reescribe SOLO las escenas que hagan falta para arreglar lo señalado, con palabras de todos los días, sin alargarlas y sin cambiar lo que dicen ni lo que prometen; que encajen con la escena de antes y la de después. Nada de punto y coma. Devuelves SOLO JSON {"escenas":[{"n":1,"dice":"..."}]} con únicamente las escenas que cambiaste.`,
      `EL GUION ENTERO:\n${guion(true)}\n\n` +
      (confusas.length ? `NO SE ENTIENDE (dilo con palabras de la casa):\n${confusas.map((c: any) => `- Escena ${c.n}: «${c.frase}»${c.porque ? ` (${c.porque})` : ''}`).join('\n')}\n\n` : '') +
      (inventadas.length ? `DA COMO HECHO ALGO QUE NADIE DIJO (quítalo, o dilo como ejemplo: «imagina que…»):\n${inventadas.map((c: any) => `- Escena ${c.n}: «${c.frase}»`).join('\n')}\n\n` : '') +
      (fuera.length ? `METE COSAS QUE EL CREADOR NO DIJO (quítalas o cámbialas por lo que sí dijo):\n${fuera.map((c: any) => `- Escena ${c.n}: «${c.frase}»`).join('\n')}\n\n` : '') +
      (faltan.length ? `FALTA LO QUE EL CREADOR PIDIÓ (mete cada punto en la escena donde encaje): ${faltan.map((x: string) => `«${x}»`).join('; ')}\n\n` : '') +
      (detalles ? `LOS DETALLES DEL CREADOR: «${detalles}»\n\n` : '') +
      `Solo puedes cambiar ${ns.length === 1 ? 'la escena' : 'estas escenas'}: ${ns.join(', ')}.`, 'low')
    const nuevas = escenas.map((e: any) => ({ ...e }))
    for (const c of (Array.isArray(fx?.escenas) ? fx.escenas : [])) {
      const k = Number(c?.n) - 1
      if (ns.includes(k + 1) && nuevas[k] && t(c?.dice, 700)) nuevas[k].dice = t(c.dice, 700)
    }
    console.log('[herramientas] lab_escribir: el lector arregló', JSON.stringify({ confusas: confusas.map((c: any) => c.frase), inventadas: inventadas.map((c: any) => c.frase), fuera: fuera.map((c: any) => c.frase), faltan }))
    return nuevas
  } catch (e) {
    console.warn('[herramientas] el lector falló, el guion sale como estaba:', String(e).slice(0, 160))
    return escenas
  }
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

  /* (21-oct) El gancho del baúl es un TIPO («Pregunta») con la frase de OTRO video de ejemplo. Antes esa frase iba tal
     cual a la escena 1 y Sergio: «cogió todo el inicio de un video del maestro». Ahora va de ejemplo de la forma. Tal
     cual va solo lo que él escribió en la escena 1, y si lo que hay ahí es esa misma frase —copiada en una vuelta
     anterior—, tampoco. */
  const gTipo = t(b?.gancho, 200)
  const ejemplo = t(b?.ganchoEjemplo, 300)
  const detalles = t(b?.detalles, 3000)   // (27-oct) 1500 cortaba lo que propone Cherry; guion-calco ya aceptaba 3000
  let intocable = t(b?.pieGancho, 300)
  if (ejemplo && intocable && llana(intocable).includes(llana(ejemplo))) intocable = ''
  const formato = t(b?.formato, 80)
  const enLista = /^top$/i.test(formato)
  const cuerpos = nombres.filter(n => llana(n) === 'cuerpo').length

  const contexto = [
    `QUÉ TIPO DE VIDEO ES: ${T.nombre}. ${T.es} ${T.no}`,
    t(b?.objetivo, 300) ? `LO QUE ESTE VIDEO TIENE QUE MOSTRAR: ${t(b?.objetivo, 300)}` : '',
    t(b?.lugar, 150) ? `DE DÓNDE ES QUIEN GRABA: ${t(b?.lugar, 150)}. Escribe como se habla ` +
      'ahí: el tú o el usted que se use, y las palabras de ese sitio.' : '',
    t(b?.negocio, 3000) ? `EL NEGOCIO DE QUIEN GRABA: ${t(b?.negocio, 3000)}` : '',
    b?.oferta === 'persona' ? 'ES UNA MARCA PERSONAL: quien graba ES la marca. Habla como él, en primera persona; si el ' +
      'video promociona algo de otra marca, eso viene en lo que el creador quiere que diga.' +
      (t(b?.producto, 80) ? ` Se presenta como «${t(b?.producto, 80)}».` : '') :
    t(b?.producto, 80) ? `CÓMO SE LLAMA SU ${b?.oferta === 'servicio' ? 'SERVICIO' : 'PRODUCTO'}: ${t(b?.producto, 80)}. Nómbralo así, y ` +
      'NUNCA en la primera mitad del guion: primero se ve el problema y lo que pasa sin él, y ' +
      'el nombre llega después.' : '',
    t(b?.palabras, 800) ? `LAS PALABRAS DE SU OFICIO, úsalas: ${t(b?.palabras, 800)}` : '',
    t(b?.numeros, 800) ? `NÚMEROS DE VERDAD QUE PUEDE SOLTAR, mete alguno: ${t(b?.numeros, 800)}` : '',
    `IDEA: ${t(b?.idea, 300) || '(sin escoger)'}`,
    /* (22-oct) los detalles del creador mandan: «que no tome cualquier dato aleatorio sino los que yo le digo» */
    detalles ? `LO QUE EL CREADOR QUIERE QUE DIGA EL VIDEO (manda sobre todo lo demás): «${detalles}». Usa ESTOS datos y estas ` +
      'ideas, dichos con palabras de la casa, y que no se quede fuera ninguno. No metas temas, consejos, productos ni datos que ' +
      'él no dio: si habla de dos cosas, el video habla de esas dos y de nada más.' : '',
    t(b?.creencia, 300) ? `LO QUE CREE LA GENTE: ${t(b?.creencia, 300)}` : '',
    /* (22-oct) el NOMBRE de la estructura no se le pasa: con «Estructura de 8 pasos» escribió «en este video tengo una
       estructura de siete pasos». Le bastan sus pasos, abajo. */
    gTipo && !intocable ? `EL GANCHO ESCOGIDO: ${gTipo}. ${defGancho(gTipo)} La escena 1 arranca así, ` +
      'con ESTA idea; no escojas tú otro tipo.' + (ejemplo ? ` Así arrancó OTRO video, de otro tema: «${ejemplo}». ` +
      'De ahí copia solo la FORMA; esa frase, sus personas y su historia NO van en este guion.' : '') : '',
    `FORMATO: ${formato || '(sin escoger)'}${defFormato(formato) ? `. ${defFormato(formato)}. Escribe lo que se ve ` +
      '(«ve») con ese formato.' : ''}`,
    `DURA ${dur} segundos, o sea unas ${palabras} palabras EN TOTAL entre todas las escenas.`,
    `LA ESTRUCTURA, QUE ES TU BASE (y lo que hace cada escena):\n${nombres.map((n, i) =>
      `  ${i + 1}. ${n}${queHace(n) ? ` — ${queHace(n)}.` : ''}` +
      `${clases[i] === 'visual' ? '  ← VISUAL: aquí NO se habla. Deja «dice» vacío y cuenta todo en «ve».' : ''}`
    ).join('\n')}`,
    `La estructura es una base, no una regla fija. Van TODAS esas escenas, en ese orden y con esos nombres, pero si ` +
      `este guion lo pide puedes meter hasta ${MAS_PASOS} pasos de más entre ellas o al final, donde hagan falta: otro ` +
      'Open loop antes de un tramo largo, un Giro, una Objeción, un Ejemplo aplicado… Solo con estos nombres: ' +
      `${Object.keys(QUE_HACE).join(', ')}. Ninguno de relleno: si no hace falta, no lo metas. La escena 1 sigue siendo ` +
      'la primera de la estructura.',
    cuerpos > 1 && !enLista ? `Los ${cuerpos} «Cuerpo» son la MISMA historia avanzando: cada uno sigue donde quedó el ` +
      'anterior. No son una lista de puntos: nada de «Primero…», «Segundo…», «Tercero…».' : '',
    intocable
      ? `EL GANCHO YA ESTÁ ELEGIDO Y ES ESTE, PALABRA POR PALABRA:\n  «${intocable}»\n` +
        'La escena 1 lleva esas palabras TAL CUAL, enteras y seguidas. Puedes añadirle cuatro o ' +
        'cinco detrás si hacen falta. Cambiarlas, reordenarlas, partirlas o escribir otro ' +
        'gancho: no. No es una idea de la que partir, es la frase.'
      : '',
  ].filter(Boolean).join('\n')

  const sis = `Escribes el guion completo de un video corto para redes, en español de Colombia.
${OFICIO}
${EJEMPLOS}

UN SOLO HILO, DE PRINCIPIO A FIN. Todo el guion cuenta UNA sola cosa: la IDEA que te dieron. El
gancho la abre, cada escena sigue donde quedó la anterior y el remate la cierra. Leídas seguidas y
sin los nombres, las escenas suenan a una persona contando una sola cosa. Una escena que se puede
quitar o cambiar de sitio sin que se note está suelta: reescríbela.

NADA INVENTADO QUE PAREZCA REAL. Ni resultados de quien graba («lo probé y me subió el alcance»), ni clientes, ni casos,
ni estudios, ni cifras que no te dieron arriba. Si un número ayuda, que se oiga como ejemplo («imagina que…», «por ejemplo,
de cien personas…»).

CÓMO RESPONDER — SOLO este JSON, y en este orden:
{"momento":"...","remate":"...","hilo":"...","escenas":[{"escena":"...","dice":"..."}],"porque":"..."}

«momento» es la escena concreta sobre la que va el video, sacada de la IDEA: una hora, un sitio y
alguien haciendo algo. Una frase.
«remate» es la frase que remata el video. Decídela AHORA, antes de escribir las escenas: todo lo
de antes es la pista de aterrizaje de esa frase.
«hilo» es el video entero contado en dos o tres frases, de la primera escena a la última: qué
pasa, en qué orden y cómo acaba en el remate. Las escenas lo cuentan con más detalle, sin salirse.
«escenas» son las de la estructura, en ese orden y con esos nombres exactos, más las que metas
si hacen falta. «dice» son SOLO las palabras que se dicen en voz alta: nada de acciones («borro…»,
«señalo…») ni de indicaciones («Voz fuera de cámara:», «Yo:», paréntesis). Si otra persona habla,
van sus palabras entre comillas y nada más. Lo que se VE lo decide después el director: no lo
escribas, salvo en las escenas marcadas VISUAL, que van MUDAS («dice» vacío) y en «ve» cuentan en
una línea lo que pasa.
«porque» es una línea: de dónde sacaste el momento y el remate.`

  const pide = async (extra: string) => {
    const r = await ia(sis, contexto + extra, 'medium')
    const crudas = Array.isArray(r?.escenas) ? r.escenas : []
    /* (21-oct) Las de la estructura se reconocen por su nombre y en su orden; entre ellas pueden venir pasos de más
       (del catálogo, máx. MAS_PASOS, nunca antes de la escena 1), que vuelven con «extra». Si le faltó alguna de la
       estructura, se lee por posición como antes. */
    const orden: any[] = []
    let j = 0
    for (const c of crudas) {
      const nom = t(c?.escena, 40)
      if (j < nombres.length && llana(nom) === llana(nombres[j])) { orden.push({ c, i: j++ }); continue }
      const paso = pasoDe(nom) || nombres.find(n => llana(n) === llana(nom)) || ''
      if (j > 0 && paso && orden.filter(o => o.extra).length < MAS_PASOS) orden.push({ c, extra: paso })
    }
    if (j === nombres.length && orden.length > nombres.length) {
      const escenas = orden.map(({ c, i, extra }) => {
        const clase = extra ? claseDe({ escena: extra }) : clases[i]
        return { escena: extra || nombres[i], clase, ...(extra ? { extra: true } : {}),
                 dice: clase === 'visual' ? '' : t(c?.dice, 700), ve: clase === 'visual' ? t(c?.ve, 400) : '' }
      })
      return { momento: t(r?.momento, 300), remate: t(r?.remate, 300), hilo: t(r?.hilo, 600),
               porque: t(r?.porque, 300), escenas }
    }
    /* Los nombres mandan los nuestros: si el modelo se inventa uno, la ficha deja de casar con
       la estructura que escogió Sergio. */
    const escenas: any[] = nombres.map((n, i) => ({
      escena: n,
      clase: clases[i],
      /* ⚠️ Una escena visual va MUDA, se lo recuerde o no. Se le dice en el prompt y además se
         le vacía aquí: en el primer guion escribió 16 palabras en el «gancho visual». */
      dice: clases[i] === 'visual' ? '' : t(crudas[i]?.dice, 700),
      /* (21-oct) lo que se ve lo pone el director; el escritor solo lo cuenta en las escenas visuales */
      ve: clases[i] === 'visual' ? t(crudas[i]?.ve, 400) : '',
    }))
    return { momento: t(r?.momento, 300), remate: t(r?.remate, 300), hilo: t(r?.hilo, 600),
             porque: t(r?.porque, 300), escenas }
  }

  /* (21-oct) Lo que dejaba frases sueltas, revisado igual que lo demás: una lista donde iba una historia, y la frase del
     video de ejemplo copiada en el gancho. */
  const sueltas = (escenas: any[]) => {
    const q: string[] = []
    const lista = escenas.map((x: any, i: number) => DE_LISTA.test(String(x?.dice || '')) ? i + 1 : 0).filter(Boolean)
    if (!enLista && lista.length >= 2) {
      q.push(`Las escenas ${lista.join(', ')} arrancan como una lista («Primero…», «Segundo…»): son frases sueltas. ` +
        'Cuenta una sola cosa que avanza: cada escena sigue de la anterior.')
    }
    if (ejemplo && !intocable && mismaFrase(String(escenas[0]?.dice || ''), ejemplo)) {
      q.push(`La escena 1 copia la frase de otro video («${ejemplo}»). De esa frase va solo la forma: escribe una ` +
        'nueva con ESTA idea.')
    }
    return q.concat(acotaciones(escenas))
  }
  /* (21-oct) «En todo el guion no hay una sola cosa que se pueda poner delante de una cámara» miraba también lo que se
     ve, que ahora pone el director después: con solo lo que se dice saltaría casi siempre y gastaría una vuelta. */
  const sinVe = (q: string[]) => q.filter((z) => !z.startsWith('En todo el guion no hay una sola cosa'))
  /* (22-oct) largo: con 45 s pedidos entregó 70 s */
  const largo = (escenas: any[]) => {
    const n = escenas.reduce((k: number, x: any) => k + (x.dice ? String(x.dice).split(/\s+/).filter(Boolean).length : 0), 0)
    return n > palabras * 1.3 ? [`Quedó largo: ${n} palabras y deberían ser unas ${palabras}. Quita lo repetido y lo que ` +
      'sobra, nunca las ideas que pidió el creador.'] : []
  }
  /* En un video DE VENTA el producto es el protagonista y puede repetirse. En los demás, no. */
  const marca = tipo === 'venta' || b?.oferta === 'persona' ? '' : t(b?.producto, 80)   // el nombre de una persona no es «la marca antes de tiempo»
  let out = await pide('')
  let quejas = sinVe(revisarGuion(out.escenas, intocable, out.remate, t(b?.estructura, 80), marca)
    .concat(revisarTipo(out.escenas, tipo, intocable), sueltas(out.escenas), largo(out.escenas)))
  /* Una sola pasada de corrección: si con lo que falló delante tampoco sale, insistir gasta
     tiempo de Sergio y no arregla nada. Se devuelve con las quejas y que decida él. */
  if (quejas.length) {
    console.warn('[herramientas] lab_escribir, primera vuelta con fallos:', quejas.join(' | '))
    const segunda = await pide(
      `\n\nESTO YA LO ESCRIBISTE Y TIENE FALLOS. Reescríbelo entero arreglándolos:\n` +
      out.escenas.map((x, i) => `  ${i + 1}. ${x.escena}: ${x.dice}`).join('\n') +
      `\n\nLO QUE ESTÁ MAL:\n${quejas.map(q => '· ' + q).join('\n')}`)
    const quejas2 = sinVe(revisarGuion(segunda.escenas, intocable, segunda.remate, t(b?.estructura, 80), marca)
      .concat(revisarTipo(segunda.escenas, tipo, intocable), sueltas(segunda.escenas), largo(segunda.escenas)))
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

  /* (22-oct) El lector (lo que no se entiende se reescribe, ver aclarar) y el director (lo que se ve) A LA VEZ: la función
     tiene 150 s y en fila se acercaba al límite. El director ve el borrador; el lector solo aclara frases, así que lo que se
     ve sigue sirviendo. */
  const [claras, dir] = await Promise.all([
    aclarar(out.escenas, intocable, detalles),
    dirigir(out.escenas, { idea: t(b?.idea, 300) || t(b?.objetivo, 300), formato, momento: out.momento, negocio: t(b?.negocio, 300) }),
  ])
  out.escenas = claras.map((x: any, i: number) => ({ ...x, ve: dir.escenas[i]?.ve || x.ve || '' }))

  const pal = out.escenas.reduce((n, x) => n + (x.dice ? x.dice.split(/\s+/).filter(Boolean).length : 0), 0)
  return { ...out, lugar: dir.lugar, quejas, palabras: pal, segundos: Math.round((pal / RITMO) * 10) / 10 }
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

/* ══ (27-oct) «Haz que Cherry proponga» ══
   Sergio le preguntó a Gemini en Google por qué IShowSpeed era viral, pegó el párrafo entero en los detalles y el guion
   salió muy bueno: «lo que hace que haga buenos guiones es tener buena información». Ahora el creador escribe cortico de
   qué quiere hablar y Cherry busca en Google (Gemini con la herramienta de búsqueda) y le PROPONE los detalles: un texto
   seguido, como el de Gemini, no datos sueltos. La página lo pone en el cuadro de detalles para que lo lea y lo cambie
   antes de escribir: los detalles son lo único que el guion puede usar como dato (ver `aclarar`).
   Busca con Google (Gemini) y, si Google no deja, con el buscador de OpenAI. */
/* (27-oct) En la cuenta gratis de Google la cuota de búsqueda de los Gemini 3 es CERO (429 «exceeded your current quota» en la
   primera llamada, aunque Gemini funcione para todo lo demás; Google no dice qué cuota). Probados el 27-oct: los 2.5 contestan
   404 «no longer available to new users», así que no sirven de plan B; quedan en la lista solo hasta la próxima subida.
   Mientras la cuenta de Google no tenga la búsqueda habilitada, busca el respaldo de OpenAI. */
const MODELOS_BUSCAR = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
async function labProponer(b: any, conDetalle = false) {
  const idea = t(b?.idea, 300), pista = t(b?.pista, 1500), negocio = t(b?.negocio, 300)
  if (!pista) throw new Error('Escribe primero, en pocas palabras, de qué quieres hablar.')
  const sis = `Investigas para el guion de un video corto (Reels, TikTok). Buscas en internet lo que el creador quiere contar y le escribes lo que encontraste, para que con eso se escriba el guion.
- Español de Colombia, tuteando, claro, como se lo contarías a un amigo.
- Un texto seguido de 2 a 4 párrafos. Sin títulos, sin viñetas, sin negritas, sin markdown, sin enlaces ni direcciones web dentro del texto.
- Lo concreto primero: qué pasó, por qué, cómo, con las cifras, fechas, nombres y ejemplos que encuentres. Di de cuándo es cada cifra.
- Solo lo que encuentres en la búsqueda. Si algo no está confirmado o las fuentes no coinciden, dilo. Nada inventado.
- Quédate en lo que el creador quiere contar; no te desvíes a otros temas.
- Máximo 1.800 caracteres.`
  const usuarioTxt = `Lo que el creador quiere contar: «${pista}»` + (idea ? `\nLa idea del video: «${idea}»` : '') +
    (negocio ? `\nDe qué es su marca: ${negocio}` : '') + `\nHoy es ${new Date().toISOString().slice(0, 10)}.`
  // el texto, sin adornos: negritas, títulos, viñetas y los enlaces que algunos buscadores pegan entre paréntesis
  const limpiar = (x: string) => String(x || '')
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[ \t]*\(?https?:\/\/[^\s)]*[^\s).,;:]\)?/g, '')
    .replace(/\*\*|__|^#+[ \t]*/gm, '').replace(/^[ \t]*[-*•][ \t]+/gm, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2400)
  const dominio = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch (_) { return '' } }
  const unicas = (l: { titulo: string, url: string }[]) => { const v = new Set<string>(); return l.filter((f) => f.url && !v.has(f.titulo) && v.add(f.titulo)).slice(0, 6) }
  let ultimo = ''
  const nota = (x: string) => { ultimo += (ultimo ? ' · ' : '') + x; console.warn('[herramientas] proponer ' + x) }

  /* 1 · Google: Gemini con su buscador (lo mismo que hizo Sergio a mano). Google pide enseñar sus «sugerencias de búsqueda»
        junto a lo que sale: van en `sugerencias` (HTML suyo). */
  if (GEMINI_API_KEY) {
    const cuerpo = {
      systemInstruction: { parts: [{ text: sis }] },
      contents: [{ role: 'user', parts: [{ text: usuarioTxt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    }
    for (const modelo of MODELOS_BUSCAR) {
      const control = new AbortController()
      const reloj = setTimeout(() => control.abort(), 35000)
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: control.signal,
        })
        if (!r.ok) {
          // el motivo entero: con 429, QUÉ cuota se acabó (va en details › violations) y no solo «exceeded your current quota»
          const crudo = await r.text()
          let cuota = ''
          try { cuota = (JSON.parse(crudo)?.error?.details || []).flatMap((d: any) => d?.violations || []).map((v: any) => `${v.quotaId || v.quotaMetric || ''} límite ${v.quotaValue ?? '?'}`).join(', ') } catch (_) { /* no era JSON */ }
          nota(`${modelo}: ${r.status} ${cuota || crudo.replace(/\s+/g, ' ').slice(0, 400)}`); continue
        }
        const c = (await r.json())?.candidates?.[0] || {}
        const texto = limpiar((c.content?.parts || []).map((x: any) => x?.text || '').join(''))
        if (!texto) { nota(`${modelo}: vino vacío (${c.finishReason || 'sin razón'})`); continue }
        const g = c.groundingMetadata || {}
        const fuentes = unicas((Array.isArray(g.groundingChunks) ? g.groundingChunks : []).map((x: any) => x?.web).filter((w: any) => w?.uri)
          .map((w: any) => ({ titulo: t(w.title || '', 80) || 'fuente', url: String(w.uri) })))
        return { texto, fuentes, sugerencias: String(g.searchEntryPoint?.renderedContent || '').slice(0, 20000), modelo, busco: !!fuentes.length }
      } catch (e) { nota(`${modelo}: ${String((e as Error)?.message || e).slice(0, 120)}`) }
      finally { clearTimeout(reloj) }
    }
  } else nota('sin llave de Google')

  /* 2 · Respaldo: OpenAI con su buscador (la misma llave con la que se escriben los guiones) */
  if (OPENAI_API_KEY) {
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), 70000)
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, signal: control.signal,
        body: JSON.stringify({ model: 'gpt-5-mini', instructions: sis, input: usuarioTxt, tools: [{ type: 'web_search' }], reasoning: { effort: 'low' } }),
      })
      if (!r.ok) nota(`openai: ${r.status} ${(await r.text()).replace(/\s+/g, ' ').slice(0, 220)}`)
      else {
        const j = await r.json()
        const partes = (Array.isArray(j?.output) ? j.output : []).filter((x: any) => x?.type === 'message')
          .flatMap((x: any) => Array.isArray(x.content) ? x.content : []).filter((c: any) => c?.type === 'output_text')
        const texto = limpiar(partes.map((c: any) => c.text || '').join('\n\n'))
        const fuentes = unicas(partes.flatMap((c: any) => Array.isArray(c.annotations) ? c.annotations : [])
          .filter((a: any) => a?.type === 'url_citation' && a.url).map((a: any) => ({ titulo: dominio(a.url) || t(a.title, 80) || 'fuente', url: String(a.url) })))
        if (texto) return { texto, fuentes, sugerencias: '', modelo: 'gpt-5-mini', busco: !!fuentes.length }
        nota('openai: vino vacío')
      }
    } catch (e) { nota(`openai: ${String((e as Error)?.message || e).slice(0, 120)}`) }
    finally { clearTimeout(reloj) }
  }
  // la prueba del servidor ve qué contestaron; el creador, el aviso de siempre
  throw new Error('Cherry no pudo buscar ahora mismo. Vuelve a intentarlo en un rato.' + (conDetalle ? ' [' + ultimo + ']' : ''))
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
    else if (b.accion === 'carrusel_fotos') r = await carruselFotos(b)
    else if (b.accion === 'publicacion_texto') r = await publicacionTexto(b)
    else if (b.accion === 'lab_desmontar') r = await labDesmontar(b)
    else if (b.accion === 'lab_ganchos') { if (uid !== 'interno') return responder({ error: 'solo el servidor' }, 403); r = await labGanchos(b) }
    else if (b.accion === 'lab_auditar') r = await labAuditar(b)
    else if (b.accion === 'lab_guion') r = await labGuion(b)
    else if (b.accion === 'lab_escena' || b.accion === 'lab_paso') r = await labEscena(b)
    else if (b.accion === 'lab_escribir') r = await labEscribir(b)
    else if (b.accion === 'lab_proponer') r = await labProponer(b, uid === 'interno')
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

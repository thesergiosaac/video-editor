// biblioteca v6 (24-sep-2026) — LA ESCENA QUE FIJA LA PERSONA EN EL GUION: con sesión de usuario,
//   · categorias {} → [{categoria, clips}] (las de la biblioteca, para el desplegable)
//   · tomas {categoria, texto} → las tomas de ESA categoría que mejor van con lo que se dice (una por clip, hasta 10).
//     La página las guarda en la zona fijada y apoyo.js las pone en ese orden. Sergio: «puso una escena que no me gusta:
//     que haya un desplegable para escoger la categoría».
// biblioteca v5 (19-sep-2026) — GRÁFICOS: graficos {palabras} (interna, la llama orchestrate): la IA marca los momentos con
//   información (cifra, porcentaje, lista, antes y después, fechas, cita) y escribe los textos cortos de cada gráfico.
//   Devuelve {v, momentos:[{tipo, desde, hasta, fuerza, marcas:[n.º de palabra], datos}]}. El dibujo y cuáles salen: graficos.js.
// biblioteca v4 (19-sep-2026) — momentos sin repetir ni solaparse, y desde/hasta en las palabras que NOMBRAN lo que se ilustra.
// biblioteca v3 (19-sep-2026) — ESCENAS DE APOYO para un video:
//   · apoyo {palabras} (interna, la llama orchestrate): la IA escoge los momentos que se prestan para ilustrar y qué mostrar;
//     se buscan las escenas por significado (huellas) y la IA escoge la mejor de las candidatas (o ninguna). Devuelve
//     {v, momentos:[{desde, hasta, busqueda, fuerza, escenas:[elegida, segunda]}]} (desde/hasta = números de palabra).
//   · enlaces {keys} (con sesión de usuario): enlaces temporales (1 h) de los clips de media-library para la vista previa
//     del celular (la biblioteca es privada).
// biblioteca v2 (19-sep-2026) — si la IA deja las palabras clave vacías (o las nombra distinto), se buscan o se piden otra vez.
// biblioteca v1 (19-sep-2026) — la biblioteca de ESCENAS DE APOYO de Cherry (media-library/ en S3).
// Solo llamadas internas (pruebas y trabajos del servidor). Dos acciones:
//   · describir {clips:[{id, categoria, dur, cuadros:[{t, url}]}]}: la IA mira unos cuadros de cada clip (con su segundo) y
//     devuelve escenas {desde, hasta, texto}, palabras clave (incluye ideas que evoca) y si la imagen viene de lado.
//     No guarda nada: quien llama revisa y guarda.
//   · indexar {limite}: calcula la «huella» (text-embedding-3-small) de las escenas que no la tienen y la guarda.
// Costos (medidos por clip): describir ≈ 1.000 fichas de entrada con gpt-4o-mini en detalle bajo (menos de 1 centavo cada 20
// clips); indexar ≈ 60 fichas por escena.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const AWS_REGION = Deno.env.get('AWS_REGION') ?? 'us-east-1'
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
const AWS_SESSION_TOKEN = Deno.env.get('AWS_SESSION_TOKEN') ?? ''
const BUCKET = 'remotionlambda-useast1-editorvideo'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

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

const EJEMPLOS = `Ejemplos del estilo del catálogo:
- "Rueda de la fortuna iluminada con cielo dramático de nubes al atardecer."
- "Personas en movimiento reflejadas, composición visual abstracta."`

async function describirUno(c: any, intento = 1): Promise<any> {
  const dur = Number(c.dur) || 0
  const contenido: any[] = [{ type: 'text', text:
    `Clip de video vertical de ${dur.toFixed(1)} s, categoría «${c.categoria}». Te muestro ${c.cuadros.length} cuadros, cada uno con su segundo:\n` +
    c.cuadros.map((q: any, i: number) => `cuadro ${i + 1}: segundo ${Number(q.t).toFixed(1)}`).join('\n') }]
  for (const q of c.cuadros) contenido.push({ type: 'image_url', image_url: { url: q.url, detail: 'low' } })
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content:
`Catalogas escenas de apoyo (b-roll) para reels en español. Devuelves SOLO JSON:
{"escenas":[{"desde":0,"hasta":3.5,"texto":"..."}],"palabras_clave":["..."],"de_lado":false}
Reglas:
- Agrupa cuadros seguidos que muestran lo mismo en una escena. Las escenas van en orden, sin huecos, de 0 a la duración del clip; desde/hasta en segundos (usa los segundos de los cuadros para poner los cortes entre uno y otro).
- "texto": UNA frase concreta de 8 a 18 palabras: qué se ve, la acción, el lugar, la luz o el ambiente. Nada de "se ve", "la imagen muestra" ni "el clip".
- "palabras_clave": NUNCA vacío. De 8 a 14, en minúscula y en español: objetos, lugares, acciones y también las IDEAS o emociones que evoca la imagen (p. ej. libertad, éxito, soledad, disciplina, lujo, calma).
- "de_lado": true solo si la imagen está girada 90° (el horizonte o las personas se ven de lado).
${EJEMPLOS}` },
        { role: 'user', content: contenido },
      ],
    }),
  })
  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 200))
  const j = await res.json()
  const out = JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
  // en limpio: escenas en orden, dentro del clip, sin huecos
  let esc = (Array.isArray(out.escenas) ? out.escenas : [])
    .map((e: any) => ({ desde: Math.max(0, Number(e.desde) || 0), hasta: Math.min(dur, Number(e.hasta) || 0), texto: String(e.texto || '').trim() }))
    .filter((e: any) => e.texto && e.hasta > e.desde)
    .sort((a: any, b: any) => a.desde - b.desde)
  if (!esc.length) esc = [{ desde: 0, hasta: dur, texto: '' }]
  esc[0].desde = 0; esc[esc.length - 1].hasta = dur
  for (let i = 1; i < esc.length; i++) esc[i].desde = esc[i - 1].hasta
  // a veces la IA usa otro nombre para el campo o lo deja vacío: se busca y, si falta, se pide otra vez
  const pk = [out.palabras_clave, out['palabras clave'], out.palabrasClave, out.keywords, out.palabras].find((v) => Array.isArray(v) && v.length) ?? []
  const palabras = pk.map((p: any) => String(p).toLowerCase().trim()).filter(Boolean).slice(0, 16)
  if (!palabras.length && intento < 3) return describirUno(c, intento + 1)
  return { id: c.id, escenas: esc.filter((e: any) => e.texto), palabras_clave: palabras, de_lado: out.de_lado === true, fichas: j.usage }
}

/* ══ Enlaces temporales de S3 (firma SigV4 en la dirección) ══ */
async function hmac(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key)
  const k = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
}
async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
async function firmarS3(key: string, segundos = 3600): Promise<string> {
  const host = `${BUCKET}.s3.${AWS_REGION}.amazonaws.com`
  const iso = new Date().toISOString()
  const ymd = iso.slice(0, 10).replace(/-/g, ''), amzDate = `${ymd}T${iso.slice(11, 19).replace(/:/g, '')}Z`
  const alcance = `${ymd}/${AWS_REGION}/s3/aws4_request`
  const q: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${AWS_ACCESS_KEY_ID}/${alcance}`,
    'X-Amz-Date': amzDate, 'X-Amz-Expires': String(segundos), 'X-Amz-SignedHeaders': 'host',
  }
  if (AWS_SESSION_TOKEN) q['X-Amz-Security-Token'] = AWS_SESSION_TOKEN
  const consulta = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join('&')
  const ruta = '/' + key.split('/').map(enc).join('/')
  const canon = ['GET', ruta, consulta, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const aFirmar = `AWS4-HMAC-SHA256\n${amzDate}\n${alcance}\n${await sha256hex(canon)}`
  let k: ArrayBuffer = await hmac(`AWS4${AWS_SECRET_ACCESS_KEY}`, ymd)
  k = await hmac(k, AWS_REGION); k = await hmac(k, 's3'); k = await hmac(k, 'aws4_request')
  return `https://${host}${ruta}?${consulta}&X-Amz-Signature=${hex(await hmac(k, aFirmar))}`
}
/* El id del usuario dueño del token, o null. Para «regenerar gráficos»: solo puede tocar SUS renders. */
async function usuarioDe(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' ? u.id : null
  } catch (_) { return null }
}

async function hayUsuario(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || token, Authorization: `Bearer ${token}` } })
    return r.ok
  } catch (_) { return false }
}

/* ══ ESCENAS DE APOYO para un video ══ */
const CATEGORIAS = 'Cinemático, Ciudad, Productividad (escritorio, computador, trabajo), Aventura, Viajes, Naturaleza, Romance, Arte, Autos, Playa, ' +
  'Misterio, Fitness, Fotografía, Música, Nostalgia, Moda, Deporte, Urbano, Baile, Fórmula 1, Motivación, Motos, Gaming, Gastronomía, Mascotas, ' +
  'Feria, Skate, Humor, Océano, Familia, Tecnología'
const SISTEMA_MOMENTOS = `Eres editor de reels. Lees la transcripción numerada de alguien que habla a cámara y escoges los momentos que se pueden ILUSTRAR con una escena de apoyo (b-roll) de una biblioteca de videos de estilo de vida. Lo que hay en la biblioteca: ${CATEGORIAS}.
Se presta: cuando se habla de algo concreto que se puede ver (viajar, un carro, la ciudad, trabajar en el computador, el gimnasio, el mar, comer) o de una idea con imagen clara (libertad → carretera abierta al atardecer; soledad → persona sola mirando el mar; éxito → edificios de noche con luces; disciplina → alguien entrenando al amanecer; tiempo que pasa → reloj o cielo que cambia).
No se presta: saludos, preguntas al público, datos sueltos, llamados a seguir o comentar, frases sobre quien habla ("yo pienso que").
Devuelves SOLO JSON {"momentos":[{"desde":N,"hasta":N,"busqueda":"...","fuerza":1}]}:
- desde/hasta: números de las palabras EXACTAS que nombran lo que se ilustra (p. ej. «viajado a dos países», «la carrera», «disfrutar el camino»), nunca las palabras de relleno de alrededor («es que», «cierto tipo de»). Entre 1 y 3,5 segundos de habla.
- busqueda: qué mostrar, como la descripción de un video de stock: 6 a 14 palabras en español, concreta (lugar, acción, luz). Nunca texto en pantalla ni gráficas.
- fuerza: 3 = se presta muchísimo, 2 = bien, 1 = poco.
Reparte los momentos por todo el video; ninguno en las primeras 6 palabras; nunca repitas un momento ni lo solapes con otro.`
const SISTEMA_ELEGIR = `Para cada momento de un video te doy lo que se dice, lo que se quiere mostrar y escenas candidatas de una biblioteca (número: descripción). Escoge la escena que MEJOR ilustra lo que se dice: tiene que ver de verdad con la idea (no basta con compartir una palabra) y no puede contradecirla. Si ninguna sirve, pon 0. Da también una segunda opción (o 0). Devuelves SOLO JSON {"elecciones":[{"momento":1,"escena":3,"segunda":5}]}.`

async function openaiJSON(sistema: string, usuario: string, maxTokens = 3000): Promise<any> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, max_tokens: maxTokens, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }] }),
  })
  if (!r.ok) throw new Error('OpenAI ' + r.status + ': ' + (await r.text()).slice(0, 200))
  const j = await r.json()
  return JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
}
async function huellasDe(textos: string[]): Promise<number[][]> {
  const e = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: textos }),
  })
  if (!e.ok) throw new Error('OpenAI huellas ' + e.status)
  return (await e.json()).data.map((d: any) => d.embedding)
}
async function buscar(v: number[], n = 8): Promise<any[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/buscar_escenas`, {
    method: 'POST', headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: '[' + v.join(',') + ']', n }),
  })
  if (!r.ok) throw new Error('buscar ' + r.status + ': ' + (await r.text()).slice(0, 200))
  return await r.json()
}
async function apoyo(palabras: any[]): Promise<any> {
  const t0 = Date.now()
  if (!Array.isArray(palabras) || palabras.length < 8) return { v: 1, momentos: [] }
  const pausa = (k: number) => {
    const prev = palabras[k - 1]
    const p = prev ? Number(palabras[k].start || 0) - Number(prev.end || prev.start || 0) : 0
    return p >= 0.4 ? '⏸ ' : ''
  }
  const segundos = Number(palabras[palabras.length - 1].end || 0) - Number(palabras[0].start || 0)
  const cuantos = Math.max(2, Math.ceil(segundos / 5))
  const lineas = palabras.map((w: any, k: number) => `${k} ${pausa(k)}${String(w.word || '').trim()}`).join('\n')
  const texto = palabras.map((w: any) => String(w.word || '').trim()).join(' ')
  const m = await openaiJSON(SISTEMA_MOMENTOS, `El video dura ${Math.round(segundos)} s. Escoge hasta ${cuantos} momentos.\nTexto seguido:\n${texto}\n\nPalabras 0 a ${palabras.length - 1}:\n${lineas}`, 4000)
  const momentos = (Array.isArray(m.momentos) ? m.momentos : [])
    .map((x: any) => ({ desde: Math.round(Number(x.desde)), hasta: Math.round(Number(x.hasta)), busqueda: String(x.busqueda || '').trim(), fuerza: Math.max(1, Math.min(3, Math.round(Number(x.fuerza) || 1))) }))
    .filter((x: any) => x.busqueda && x.desde >= 0 && x.hasta >= x.desde && x.hasta < palabras.length)
    .sort((a: any, b: any) => a.desde - b.desde)
  // sin repetidos ni solapados: de dos que se pisan queda el que más se presta
  const unicos: any[] = []
  for (const x of momentos) {
    const prev = unicos[unicos.length - 1]
    if (prev && x.desde <= prev.hasta) { if (x.fuerza > prev.fuerza) unicos[unicos.length - 1] = x }
    else unicos.push(x)
  }
  momentos.length = 0; momentos.push(...unicos)
  if (!momentos.length) return { v: 1, momentos: [] }
  const vs = await huellasDe(momentos.map((x: any) => x.busqueda))
  const candidatas = await Promise.all(vs.map((v) => buscar(v, 8)))
  const dicho = (x: any) => palabras.slice(Math.max(0, x.desde - 6), Math.min(palabras.length, x.hasta + 7)).map((w: any) => w.word).join(' ')
  const usuario = momentos.map((x: any, i: number) => `Momento ${i + 1}\nSe dice: «${dicho(x)}»\nQuiere mostrar: ${x.busqueda}\nCandidatas:\n` +
    candidatas[i].map((c: any, j: number) => `${j + 1}: ${c.texto} (${c.categoria})`).join('\n')).join('\n\n')
  const e = await openaiJSON(SISTEMA_ELEGIR, usuario, 3000)
  const porMomento: Record<number, any> = {}
  for (const x of (Array.isArray(e.elecciones) ? e.elecciones : [])) porMomento[Number(x.momento)] = x
  const limpia = (c: any) => c && ({ id: c.id, clip_id: c.clip_id, categoria: c.categoria, s3_key: c.s3_key, clip_dur: c.clip_dur, rotar: c.rotar,
    ini: c.ini, fin: c.fin, texto: c.texto, parecido: Math.round(c.parecido * 1000) / 1000 })
  const out: any[] = []
  momentos.forEach((x: any, i: number) => {
    const el = porMomento[i + 1]
    const a = el && Number(el.escena) > 0 ? candidatas[i][Number(el.escena) - 1] : null
    if (!a) return
    const b = Number(el.segunda) > 0 ? candidatas[i][Number(el.segunda) - 1] : null
    out.push({ ...x, escenas: [limpia(a), b && b.id !== a.id ? limpia(b) : null].filter(Boolean) })
  })
  console.log(`[apoyo] ${out.length} de ${momentos.length} momentos con escena en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  return { v: 1, creado: new Date().toISOString(), momentos: out }
}

/* ══ GRÁFICOS para un video ══ */
const SISTEMA_GRAFICOS = `Eres editor de reels informativos. Lees la transcripción numerada de alguien que habla a cámara y marcas los momentos donde un GRÁFICO animado ayuda a entender o recordar un dato. Solo lo que la persona DICE: nunca inventes cifras, nombres ni fechas.
Tipos de gráfico:
- numero: una cifra importante (dinero, seguidores, clientes, ventas, kilos, años de experiencia). datos: {"valor": número (10000, 2.5), "prefijo": "+" o "$" o "", "sufijo": "" o "M" o " mil" o "k" o " años" o " kg", "decimales": 0 a 2, "etiqueta": qué es en 2 a 4 palabras que se entiendan solas (máx. 28 letras, p. ej. "Seguidores nuevos", "Ventas del mes"), "chip": SOLO si la persona dice un plazo, lugar o condición concreta (máx. 22 letras, p. ej. "en 30 días", "en Colombia"); si no, ""}. marcas: [la palabra donde se dice la cifra].
- porcentaje: un porcentaje o una proporción ("el 70 %", "7 de cada 10"). datos: {"valor": 0 a 100, "etiqueta": 2 a 5 palabras (p. ej. "De cada 10 personas"), "titulo": la idea en 3 a 6 palabras (p. ej. "7 no tienen ahorros")}. marcas: [palabra del número].
- lista: una enumeración de 2 a 4 cosas dichas seguidas ("hay tres errores: …"). datos: {"titulo": 2 a 4 palabras sin el número (p. ej. "errores con tu plata"), "items": textos de 1 a 4 palabras que se entiendan solos (p. ej. "Sin fondo de emergencia", "Endeudarte con la tarjeta", "No invertir")}. marcas: [palabra donde empieza cada item] (una por item).
- comparacion: antes y después, o dos cifras que se comparan ("antes ganaba 2 millones, hoy gano 10"). datos: {"etiqueta": qué se compara en 2 a 4 palabras, "a": {"texto": "Antes", "valor": número}, "b": {"texto": "Hoy", "valor": número}, "prefijo": "$" o "", "sufijo": "M" o "" …, "decimales": 0 a 2}. marcas: [palabra de la cifra a, palabra de la cifra b].
- linea: fechas o etapas en orden ("en 2020 empecé, en 2022 …"). datos: {"titulo": 2 o 3 palabras que digan de qué es (p. ej. "Mi camino", "Cómo creció"), "hitos": [{"fecha": "2020" (o "Mes 1", "Año 3"), "texto": 1 a 3 palabras que se entiendan solas (p. ej. "Empecé a vender", "100 mil seguidores", "Mi empresa")}]} (2 a 4 hitos). marcas: [palabra de cada fecha].
- cita: cuando cita a una persona con nombre ("como dijo Steve Jobs: …"). Si hay una cita con nombre, márcala siempre. datos: {"texto": la frase citada, corta y fiel (máx. 16 palabras), "autor": el nombre}. marcas: [palabra donde empieza la cita].
- ranking: 3 a 5 cosas ordenadas de mayor a menor ("lo que más se lleva la plata es el arriendo, después los insumos…"). datos: {"etiqueta": 2 a 4 palabras (p. ej. "Lo que más pesa"), "titulo": 3 a 6 palabras, "sufijo": "%" o "" o "k", "items": [["Nombre corto", número], …] ya ordenados de mayor a menor}. marcas: [palabra donde empieza cada item].
- meta: cuánto se lleva avanzado de una meta ("vamos por el 60 %", "llevamos 8 de los 10 que queremos"). datos: {"etiqueta": 2 a 4 palabras, "titulo": 3 a 6 palabras, "valor": número, "meta": número, "sufijo": "%" o "" o "k", "pie": "" o 2 a 4 palabras (p. ej. "faltan 12 días"), "pieMeta": "" o cómo se llama la meta}. marcas: [palabra del valor].
- reparto: un total que se parte en 2 a 4 trozos ("de cada venta, la mitad son costos, un 18 % el arriendo…"). datos: {"titulo": 2 a 5 palabras (p. ej. "De cada venta"), "items": [["Nombre corto", número], …]}. marcas: [palabra de cada trozo].
- rango: una horquilla, no un número ("cuesta entre 18 y 26 mil", "tarda de 2 a 4 semanas"). datos: {"etiqueta": 2 a 4 palabras, "titulo": 3 a 6 palabras, "prefijo": "$" o "", "sufijo": "k" o " sem" o "", "desde": número, "hasta": número, "pie": "" o 2 a 4 palabras}. marcas: [palabra del primer número, palabra del segundo].
- multiplo: cuántas veces es una cosa respecto a otra ("es el triple de caro", "cinco veces más"). datos: {"etiqueta": 2 a 4 palabras, "titulo": 2 a 5 palabras que siguen al número (p. ej. "más caro que cocinarlo"), "veces": 2 a 8, "pie": "" o 3 a 6 palabras}. marcas: [palabra del múltiplo].
- evolucion: 3 a 7 periodos con su cifra ("en junio 42, en julio 48, en agosto 45…"). datos: {"etiqueta": 2 a 4 palabras, "titulo": 2 a 5 palabras, "sufijo": "" o "%" o "k", "items": [["Jun", 42], …] en orden}. marcas: [palabra de cada periodo].
- cuota: cuántos de un grupo pequeño ("4 de cada 10 clientes vuelven"). Úsalo en vez de porcentaje cuando habla de PERSONAS o de VECES y el total es 10 o menos. datos: {"etiqueta": 3 a 5 palabras (p. ej. "De cada diez clientes"), "total": 2 a 10, "llenas": cuántos cumplen, "titulo": 2 a 5 palabras que completan la frase (p. ej. "vuelven si los llamas")}. marcas: [palabra del número].
- medidor: un nivel, margen o porcentaje de salud del negocio, presentado como una aguja ("te queda un 17 %", "trabajas al 80 % de tu capacidad"). Úsalo en vez de porcentaje cuando la cifra dice QUÉ TAN BIEN o QUÉ TAN LLENO está algo. datos: {"valor": 0 a 100, "etiqueta": 2 a 4 palabras (p. ej. "Margen real"), "titulo": 3 a 6 palabras que lo expliquen (p. ej. "De cada venta te queda")}. marcas: [palabra del número].
- mito: una creencia común que la persona corrige ("todos creen que X, pero en realidad Y", "no es X, es Y", "la gente piensa que…"). Si alguien desmonta una idea, MARCALO. datos: {"mito": la creencia falsa en 4 a 9 palabras, "realidad": lo que sí es, en 4 a 9 palabras}. marcas: [palabra donde empieza la creencia, palabra donde empieza la corrección].
- flujo: 3 o 4 pasos EN ORDEN donde uno lleva al siguiente ("primero cuentas lo que gastas, después le pones margen y así fijas el precio"). Úsalo en vez de lista cuando el orden importa. datos: {"etiqueta": 2 a 4 palabras (p. ej. "Cómo se hace"), "titulo": 3 a 6 palabras, "pasos": 3 o 4 textos de 2 a 4 palabras cada uno}. marcas: [palabra donde empieza cada paso].
- balanza: dos opciones que compiten y una conviene más ("comprarlo hecho te cuesta 26, cocinarlo tú 9"). Úsalo en vez de comparacion cuando son DOS CAMINOS A ESCOGER, no un antes y un después. datos: {"etiqueta": 2 a 4 palabras, "titulo": la conclusión en 4 a 8 palabras, "a": {"texto": nombre corto de la primera, "valor": número}, "b": {"texto": nombre de la segunda, "valor": número}, "prefijo": "$" o "", "sufijo": "k" o "%" o "", "ganador": "a" o "b" (cuál conviene según lo que dice, que a veces es el número MÁS CHICO)}. marcas: [palabra de la cifra a, palabra de la cifra b].
- tabla: dos opciones comparadas punto por punto ("con la app te cobran comisión pero llega más lejos; propio controlas el servicio"). datos: {"etiqueta": 2 a 4 palabras, "titulo": 3 a 6 palabras, "a": nombre corto de la primera opción (máx. 12 letras), "b": nombre de la segunda, "filas": 2 a 5 elementos [texto de 2 a 5 palabras, true/false si lo cumple la primera, true/false si lo cumple la segunda]}. marcas: [palabra donde empieza cada fila].
- claves: el resumen de 2 o 3 cosas para recordar, casi siempre al final ("acuérdate de tres cosas…", "en resumen…"). Úsalo en vez de lista cuando es el REMATE de lo dicho. datos: {"etiqueta": 2 a 5 palabras (p. ej. "Para que no se te olvide"), "titulo": 2 a 4 palabras, "claves": 2 o 3 textos de 3 a 5 palabras}. marcas: [palabra donde empieza cada clave].

Reglas:
- desde/hasta: números de la primera y la última palabra del momento. fuerza: 3 = el dato es central, 2 = bueno, 1 = flojo.
- BUSCA EN TODO EL VIDEO. Casi cualquier cosa que se explique tiene su gráfico: una cifra, un porcentaje, una enumeración, un orden de pasos, dos cosas que se comparan, una creencia que se corrige, un resumen final. Recorre la transcripción entera y marca TODOS los momentos que encajen con algún tipo, repartidos de principio a fin: no te quedes solo con los dos o tres más obvios del principio.
- Un momento no necesita un número para valer. Una idea que se explica en pasos, una creencia que se desmonta o un resumen de tres cosas son tan graficables como una cifra.
- Sí deja fuera: saludos, llamados a seguir o comentar, y cifras de relleno ("dos veces", "un día", "una persona"). Un ejemplo o una metáfora (una carrera, "a un metro de la meta") no es un dato: fuerza 1.
- Números en cifras (diez mil → 10000; dos millones con sufijo "M" → 2). Textos en español, que se entiendan sin oír el video, con mayúscula inicial y sin punto final.
- Nunca dos momentos que se pisen ni dos en la misma frase: en pantalla solo cabe uno y el otro se pierde.
- REPARTE de principio a fin. Antes de responder mira donde caen: si se te amontonan al principio y dejas el medio o el final vacios, busca tambien alli. Sigue marcando TODOS los que encuentres.
- Si varios tipos encajan, escoge el MÁS ESPECÍFICO. Guía rápida: ranking antes que lista cuando hay cifras que ordenan; reparto antes que porcentaje cuando se parte un total en varios trozos; cuota antes que porcentaje cuando habla de personas y el total es 10 o menos; rango cuando da dos números que son extremos, no un antes y un después; medidor antes que porcentaje cuando la cifra dice qué tan bien o qué tan lleno está algo; mito cuando corrige una creencia; balanza antes que comparacion cuando son dos caminos a escoger; comparacion solo para antes y después; flujo antes que lista cuando el orden importa; claves antes que lista cuando es el remate final; tabla cuando compara dos opciones en varios puntos.
Devuelves SOLO JSON {"momentos":[{"tipo":"numero","desde":N,"hasta":N,"fuerza":2,"marcas":[N],"datos":{}}]}. Si no hay datos que graficar: {"momentos":[]}.`
// 20-sep: la version del motor viaja con los momentos. orchestrate la compara y, si no coincide, vuelve a
// marcarlos: si no, un proyecto que ya tenia graficos se queda con los de la version vieja para siempre.
// SUBIRLA cada vez que cambien los tipos o el prompt.
const MOTOR_GRAFICOS = 4
const TIPOS_GRAFICO = ['numero', 'porcentaje', 'lista', 'comparacion', 'linea', 'cita',
  'ranking', 'meta', 'reparto', 'rango', 'multiplo', 'evolucion', 'cuota',
  'medidor', 'mito', 'flujo', 'balanza', 'tabla', 'claves']

/* evitar: [{desde, hasta}] en numeros de palabra. Son los gráficos que la persona SE QUEDA al pedir
   «regenerar solo estos»: la IA no debe volver a marcar ahí, tiene que buscar en el resto del video. */
async function graficos(palabras: any[], evitar?: any[]): Promise<any> {
  const t0 = Date.now()
  if (!Array.isArray(palabras) || palabras.length < 8) return { v: MOTOR_GRAFICOS, momentos: [] }
  const segundos = Number(palabras[palabras.length - 1].end || 0) - Number(palabras[0].start || 0)
  // 20-sep: antes /8 y la IA se quedaba en 2-3 momentos por video. Es un TOPE, no un objetivo:
  // subirlo le da sitio para marcar todo lo que encuentre, y graficos.js ya filtra por nivel.
  const cuantos = Math.max(4, Math.ceil(segundos / 5))
  const lineas = palabras.map((w: any, k: number) => `${k} ${String(w.word || '').trim()}`).join('\n')
  const texto = palabras.map((w: any) => String(w.word || '').trim()).join(' ')
  const zonas = (Array.isArray(evitar) ? evitar : [])
    .map((z: any) => ({ desde: Math.round(Number(z?.desde)), hasta: Math.round(Number(z?.hasta)) }))
    .filter((z: any) => isFinite(z.desde) && isFinite(z.hasta) && z.hasta >= z.desde)
  const aviso = zonas.length
    ? `

OCUPADO: ya hay un gráfico en ${zonas.map((z: any) => `las palabras ${z.desde} a ${z.hasta}`).join(', ')}. `
      + `NO marques nada ahí ni a menos de 10 palabras de esos tramos: busca en el RESTO del video.`
    : ''
  const usuario = `El video dura ${Math.round(segundos)} s. Puedes marcar hasta ${cuantos} momentos: recórrelo entero y marca todos los que encajen, repartidos de principio a fin.${aviso}\nTexto seguido:\n${texto}\n\nPalabras 0 a ${palabras.length - 1}:\n${lineas}`
  let out: any = null
  for (const modelo of ['gpt-5-mini', 'gpt-4o-mini']) {
    const cuerpo: Record<string, unknown> = { model: modelo, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SISTEMA_GRAFICOS }, { role: 'user', content: usuario }] }
    if (modelo.startsWith('gpt-5')) { cuerpo.reasoning_effort = 'low'; cuerpo.max_completion_tokens = 16000 }
    else { cuerpo.temperature = 0.2; cuerpo.max_tokens = 4000 }
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), 75000)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: control.signal,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      })
      if (!r.ok) { console.warn(`[graficos] ${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      const j = await r.json()
      out = JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
      if (out && Array.isArray(out.momentos)) { out.modelo = modelo; break }
    } catch (e) { console.warn(`[graficos] ${modelo} falló:`, String(e)) }
    finally { clearTimeout(reloj) }
  }
  const n = palabras.length
  const momentos = (out && Array.isArray(out.momentos) ? out.momentos : [])
    .map((x: any) => ({
      tipo: String(x?.tipo || ''), desde: Math.round(Number(x?.desde)), hasta: Math.round(Number(x?.hasta)),
      fuerza: Math.max(1, Math.min(3, Math.round(Number(x?.fuerza) || 1))),
      marcas: (Array.isArray(x?.marcas) ? x.marcas : []).map((m: any) => Math.round(Number(m))).filter((m: number) => Number.isFinite(m) && m >= 0 && m < n),
      datos: x?.datos && typeof x.datos === 'object' ? x.datos : {},
    }))
    .filter((x: any) => TIPOS_GRAFICO.includes(x.tipo) && x.desde >= 0 && x.hasta >= x.desde && x.hasta < n)
    .sort((a: any, b: any) => a.desde - b.desde)
  // sin solapados: de dos que se pisan queda el de más fuerza
  const unicos: any[] = []
  for (const x of momentos) {
    const prev = unicos[unicos.length - 1]
    if (prev && x.desde <= prev.hasta) { if (x.fuerza > prev.fuerza) unicos[unicos.length - 1] = x }
    else unicos.push(x)
  }
  console.log(`[graficos] ${unicos.length} momentos (${out?.modelo ?? 'sin IA'}) en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  // red de seguridad: si la IA marcó dentro de una zona ocupada, fuera
  const limpios = zonas.length
    ? unicos.filter((m: any) => !zonas.some((z: any) => m.desde <= z.hasta + 10 && m.hasta >= z.desde - 10))
    : unicos
  return { v: MOTOR_GRAFICOS, creado: new Date().toISOString(), modelo: out?.modelo ?? null, momentos: limpios }
}

async function indexar(limite: number) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/biblioteca_escenas?embedding=is.null&select=id,texto,palabras_clave,categoria&order=id&limit=${limite}`,
    { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
  if (!r.ok) throw new Error('leer escenas ' + r.status + ': ' + (await r.text()).slice(0, 200))
  const filas = await r.json()
  if (!filas.length) return { hechas: 0, quedan: 0 }
  const textos = filas.map((f: any) => `${f.texto} | ${(f.palabras_clave || []).join(', ')} | ${f.categoria || ''}`)
  const e = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: textos }),
  })
  if (!e.ok) throw new Error('OpenAI huellas ' + e.status + ': ' + (await e.text()).slice(0, 200))
  const ej = await e.json()
  const datos = ej.data.map((d: any, i: number) => ({ id: filas[i].id, v: d.embedding }))
  const g = await fetch(`${SUPABASE_URL}/rest/v1/rpc/biblioteca_guardar_huellas`, {
    method: 'POST', headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos }),
  })
  if (!g.ok) throw new Error('guardar huellas ' + g.status + ': ' + (await g.text()).slice(0, 200))
  return { hechas: await g.json(), fichas: ej.usage?.total_tokens }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const b = await req.json()
    // enlaces para la vista previa: con sesión de usuario (la biblioteca es privada)
    if (b.accion === 'enlaces' && Array.isArray(b.keys)) {
      if (!(await hayUsuario(req)) && !(await esLlamadaInterna(req))) return responder({ error: 'inicia sesión' }, 401)
      const keys = b.keys.filter((k: any) => typeof k === 'string' && /^media-library\/[^?#]+\.mp4$/.test(k) && !k.includes('..')).slice(0, 40)
      const enlaces: Record<string, string> = {}
      for (const k of keys) enlaces[k] = await firmarS3(k, 3600)
      return responder({ enlaces })
    }
    /* Regenerar gráficos (20-sep): la persona no se queda con lo que salió la primera vez. Puede pedir
       otros para todo el video, o quedarse con los que le gustaron («quedan») y cambiar solo el resto.
       La IA es inconsistente entre llamadas — medido: de 3 a 5 momentos con la MISMA petición — así que
       volver a pedir es la herramienta, no un parche. */
    if (b.accion === 'regenerar-graficos') {
      const uid = await usuarioDe(req)
      if (!uid && !(await esLlamadaInterna(req))) return responder({ error: 'inicia sesión' }, 401)
      const renderId = String(b.render_id || '')
      if (!/^[0-9a-f-]{36}$/.test(renderId)) return responder({ error: 'render_id inválido' }, 400)

      const sel = `/rest/v1/renders?id=eq.${renderId}&select=id,project_id,subtitle_phrases,graficos,projects(user_id)`
      const rr = await fetch(`${SUPABASE_URL}${sel}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
      const filas = rr.ok ? await rr.json() : []
      const fila = Array.isArray(filas) ? filas[0] : null
      if (!fila) return responder({ error: 'no existe ese render' }, 404)
      if (uid && fila.projects?.user_id && fila.projects.user_id !== uid) return responder({ error: 'no es tuyo' }, 403)

      const sp = fila.subtitle_phrases ?? {}
      const pal = sp.palabras_vista ?? sp.palabras ?? []
      if (!Array.isArray(pal) || !pal.length) return responder({ error: 'ese video aún no tiene palabras' }, 400)

      // los que la persona SE QUEDA (por su posición en la lista actual)
      const actuales = Array.isArray(fila.graficos?.momentos) ? fila.graficos.momentos : []
      const quedan = Array.isArray(b.quedan)
        ? b.quedan.map((i: any) => actuales[Number(i)]).filter(Boolean)
        : []
      const evitar = quedan.map((m: any) => ({ desde: m.desde, hasta: m.hasta }))

      const gr = await graficos(pal, evitar)
      const momentos = [...quedan, ...(gr?.momentos ?? [])].sort((x: any, y: any) => (x.desde || 0) - (y.desde || 0))
      const nuevo = { v: MOTOR_GRAFICOS, creado: new Date().toISOString(), modelo: gr?.modelo ?? null, momentos }

      const up = await fetch(`${SUPABASE_URL}/rest/v1/renders?id=eq.${renderId}`, {
        method: 'PATCH',
        headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ graficos: nuevo }),
      })
      if (!up.ok) return responder({ error: 'no se pudo guardar', detalle: (await up.text()).slice(0, 200) }, 500)
      console.log(`[regenerar-graficos] ${renderId.slice(0, 8)}: ${quedan.length} se quedan + ${gr?.momentos?.length ?? 0} nuevos`)
      return responder({ ok: true, graficos: nuevo, se_quedan: quedan.length, nuevos: gr?.momentos?.length ?? 0 })
    }

    /* (24-sep) La escena que fija la persona desde el Guion: escoge la CATEGORÍA y aquí se buscan, dentro de ella, las
       tomas que mejor van con lo que dice en esa parte (por significado, con las mismas huellas). */
    if (b.accion === 'categorias' || b.accion === 'tomas') {
      if (!(await hayUsuario(req)) && !(await esLlamadaInterna(req))) return responder({ error: 'inicia sesión' }, 401)
      const H = { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json' }
      if (b.accion === 'categorias') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/categorias_escenas`, { method: 'POST', headers: H, body: '{}' })
        if (!r.ok) return responder({ error: 'categorias ' + r.status }, 500)
        return responder({ categorias: await r.json() })
      }
      const cat = String(b.categoria || '').trim().slice(0, 40)
      const texto = String(b.texto || '').replace(/\s+/g, ' ').trim().slice(0, 600)
      if (!cat || !texto) return responder({ error: 'falta la categoría o el texto' }, 400)
      const [v] = await huellasDe([texto])
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/buscar_escenas_cat`, {
        method: 'POST', headers: H, body: JSON.stringify({ q: '[' + v.join(',') + ']', cat, n: 40 }),
      })
      if (!r.ok) return responder({ error: 'buscar ' + r.status + ': ' + (await r.text()).slice(0, 200) }, 500)
      const filas = await r.json()
      // una por clip (la que más se parece de cada uno): «otra toma» tiene que ser OTRA cosa, no el mismo clip
      const vistos = new Set<string>(), tomas: any[] = []
      for (const c of (Array.isArray(filas) ? filas : [])) {
        if (vistos.has(c.clip_id)) continue
        vistos.add(c.clip_id)
        tomas.push({ id: c.id, clip_id: c.clip_id, categoria: c.categoria, s3_key: c.s3_key, clip_dur: c.clip_dur, rotar: c.rotar,
          ini: c.ini, fin: c.fin, texto: c.texto, parecido: Math.round(c.parecido * 1000) / 1000 })
        if (tomas.length >= 10) break
      }
      console.log(`[tomas] «${cat}»: ${tomas.length} para «${texto.slice(0, 60)}»`)
      return responder({ categoria: cat, tomas })
    }

    if (!(await esLlamadaInterna(req))) return responder({ error: 'solo llamadas internas' }, 401)
    if (b.accion === 'apoyo') return responder(await apoyo(b.palabras))
    if (b.accion === 'graficos') return responder(await graficos(b.palabras, b.evitar))
    if (b.accion === 'describir' && Array.isArray(b.clips)) {
      const res = await Promise.all(b.clips.slice(0, 12).map((c: any) => describirUno(c).catch((e) => ({ id: c.id, error: String(e).slice(0, 300) }))))
      return responder({ clips: res })
    }
    if (b.accion === 'indexar') return responder(await indexar(Math.max(1, Math.min(300, Number(b.limite) || 200))))
    return responder({ error: 'acción desconocida' }, 400)
  } catch (e) {
    return responder({ error: String(e).slice(0, 400) }, 500)
  }
})

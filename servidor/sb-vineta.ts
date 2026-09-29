/* sb-vineta — dibuja el storyboard (23-sep-2026; la HOJA desde el 29-sep-2026)
 *
 * Cinco modos:
 *
 *   modo «rasgos»    · mira la foto de quien sale y la describe con palabras (Gemini).
 *                      Se hace UNA vez por persona y la descripción se guarda.
 *   modo «estilos»   · devuelve el catálogo de los cinco estilos.
 *   modo «saldo»     · cuántas viñetas lleva la cuenta este mes y cuántas le quedan.
 *   modo «estado»    · si están las llaves, sin gastar nada preguntándolo.
 *   modo por defecto · dibuja la HOJA: todas las escenas que lleguen (hasta 16) en UNA sola imagen, en una reja
 *                      de 1×1, 2×2, 3×3 o 4×4. Una escena suelta es una hoja de uno.
 *
 * ⭐ POR QUÉ UNA HOJA (29-sep). Sergio: el storyboard ENTERO en una imagen, con su cara igual en todas las escenas y
 * ángulos de verdad. Hasta ahora se pedía cada viñeta por separado a Cloudflare, con la cara DESCRITA en texto: cambiaba
 * de una a otra y casi todas salían de medio cuerpo. En una sola imagen el modelo ve el guion entero a la vez —la misma
 * persona, el mismo sitio y un ángulo distinto por escena— y además recibe FOTOS de la persona, no una descripción.
 *
 * Se probaron 7 modelos con su guion de 13 escenas y 6 fotos suyas (comparación en docs/LABORATORIO.md). Se quedaron:
 *   1. GPT Image 2.5 (OpenAI, `gpt-image-2.5-flare`) — 3 de 3 rejas con las 13 escenas en orden; el que más se le parece.
 *   2. Nano Banana Pro (Google, `gemini-3-pro-image`, la estable) — de respaldo: a veces repite una escena.
 *   (Seedream 5.0 Pro queda pendiente: pide cuenta en BytePlus.)
 * La API de Higgsfield NO tiene ninguno de los dos (lo miró Sergio el 29-sep), así que van directo a su dueño: OpenAI
 * con la llave que Cherry ya usa para el historial, y Google con la de Gemini (con facturación activada).
 * Cloudflare se retiró: «no duró absolutamente nada».
 *
 * ⚠️ CADA PANEL LLEVA SU NÚMERO pintado en la esquina, y es el número de la ESCENA (no el puesto en la hoja). Así se
 * comprueba la hoja: un modelo barato la mira con la lista de escenas delante y dice en qué celda quedó cada una, por
 * lo que se ve y con el número de pista. Si el dibujante repitió una escena o cambió dos de sitio, igual cae cada una
 * en la suya; si se comió una, se sabe cuál y se prueba con el siguiente dibujante.
 *
 * El tope sigue contándose aquí, en el servidor y en VIÑETAS (45 al mes por cuenta): el navegador no puede tocarlo.
 * Se cobran solo las viñetas que salen. Ver `08-vinetas-uso.sql`.
 */
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''

/* Las pone Supabase sola en toda Edge Function. */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/* El tope de una cuenta que no tiene plan todavía: 45 viñetas al mes.
   Lo escogió Sergio el 22-sep. Cuando haya planes, cada plan escribe su número en `vinetas_tope`. */
const TOPE_POR_DEFECTO = 45

const GEMINI = 'https://generativelanguage.googleapis.com'
const MODELOS_TEXTO = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
/* El de respaldo para las tareas de texto (el guionista y leer los números): si Gemini se cae, la hoja no se queda sin
   dibujar por eso. Es el mismo que ya usa el historial para leer formatos. */
const MODELO_TEXTO_OPENAI = 'gpt-5-mini'

/* ── Los dibujantes, en orden ──
   `lados`: el tamaño que se pide a GPT según la reja. Siempre 9:16 (una reja de k×k paneles 9:16 es 9:16 entera) y
   siempre múltiplo de 16, que es lo que exige OpenAI. En 4×4 cada panel sale de ~288×512: en la ficha se ve a 134 px y
   en el storyboard a ~200, así que sobra. Nano Banana Pro cobra lo mismo a 1K que a 2K, así que va siempre a 2K. */
const DIBUJANTES = [
  { id: 'gpt', nombre: 'GPT Image 2.5', modelo: 'gpt-image-2.5-flare' },
  { id: 'nbpro', nombre: 'Nano Banana Pro', modelo: 'gemini-3-pro-image' },
]
const TAMANO_GPT: Record<number, string> = { 1: '720x1280', 2: '864x1536', 3: '1008x1792', 4: '1152x2048' }
const CALIDAD_GPT = 'high'
/* Precios (29-sep-2026). GPT Image 2.5 cobra por tokens: texto $5/M, imagen de entrada $8/M, imagen de salida $30/M.
   Nano Banana Pro: $0,134 por imagen a 1K o 2K, más la entrada ($2/M). Solo sirven para APUNTAR lo que costó; el tope
   de Sergio se cuenta en viñetas. */
const PRECIO = { gptTexto: 5e-6, gptImagenEntra: 8e-6, gptImagenSale: 30e-6, nbImagen: 0.134, nbEntra: 2e-6 }
/* `creditos` en `vinetas_uso` venía en créditos de Cloudflare (US$0,011 por cada 1.000). Se sigue apuntando en esa
   misma unidad para que la suma del mes no mezcle monedas: un dólar son 90.909 «créditos». */
const DOLAR_EN_CREDITOS = 1000 / 0.011

/* Hasta 16 escenas por hoja (4×4). Un guion más largo se pide en dos hojas desde el navegador. */
const MAX_HOJA = 16
/* Fotos de la persona: Nano Banana Pro admite hasta 5 de personajes; GPT hasta 16 imágenes en total. */
const MAX_FOTOS = 5
/* Viñetas ya dibujadas del mismo video que se mandan de muestra al redibujar una escena suelta. */
const MAX_MUESTRAS = 2
/* Si el primer dibujante ya tardó más que esto, no se prueba el segundo: el servidor corta a los 150 s. */
const PLAZO_SEGUNDO_MS = 70_000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const t = (x: unknown, n: number) => String(x ?? '').trim().slice(0, n)

function parteImagen(uri: string) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(String(uri || ''))
  if (!m) return null
  return { inline_data: { mime_type: m[1], data: m[2] } }
}

/* De bytes a base64 sin reventar la pila: `String.fromCharCode(...bytes)` con cientos de miles de bytes no cabe. */
function aBase64(bytes: Uint8Array): string {
  let cadena = ''
  for (let i = 0; i < bytes.length; i += 0x8000) cadena += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(cadena)
}
function deBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ══ 1 · Los rasgos, una sola vez por persona ══
   La descripción tiene que ser CORTA y de lo que se dibuja: un modelo de imagen no sabe qué hacer
   con «mirada amable», pero sí con «barba corta oscura». */
async function rasgos(b: any) {
  if (!GEMINI_API_KEY) throw new Error('Falta la llave de Gemini en el servidor.')
  const foto = parteImagen(b?.foto)
  if (!foto) throw new Error('No llegó la foto.')

  /* El PELO es lo que más distingue a alguien de un vistazo en un dibujo, y es lo que peor sale si
     se describe de menos: «pelo oscuro» le vale a media humanidad. Por eso se pide el tipo con
     nombre propio. Y salen dos versiones: la española para que Sergio vea qué entendió Cherry, y
     la inglesa porque es la que el modelo de imagen dibuja mejor. */
  const pide =
    'Mira esta foto y descríbeme a la persona para que un ilustrador la dibuje. Solo lo que se ve, ' +
    'nada de juicios ni de expresión. ' +
    'EL PELO es lo más importante: di el TIPO con precisión —liso, ondulado, rizado, muy rizado o ' +
    'crespo, afro, rapado— el largo, el volumen y el color. «Pelo oscuro» no sirve: le vale a ' +
    'cualquiera. ' +
    'Después: edad aproximada, barba (tipo y densidad) o afeitado, gafas o no, tono de piel, forma ' +
    'de la cara, y la ropa. ' +
    'Responde SOLO este JSON, sin nada más: {"es":"...","en":"..."} ' +
    '«es» es una frase en español, de las que se leen de corrido. «en» es la misma en inglés, con ' +
    'las palabras que entiende un modelo de imagen (por ejemplo «tightly coiled afro-textured ' +
    'hair» si el pelo es crespo).'

  let ultimo = ''
  for (const modelo of MODELOS_TEXTO) {
    const r = await fetch(`${GEMINI}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: pide }, foto] }] }),
    })
    if (!r.ok) { ultimo = `${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`; continue }
    const j = await r.json()
    const txt = (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text || '').join('').trim()
    if (txt) {
      /* El modelo a veces envuelve el JSON en ```json … ```; se le quita antes de leerlo. */
      const limpio = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
      try {
        const o = JSON.parse(limpio)
        if (o?.es || o?.en) return { es: t(o.es || o.en, 400), en: t(o.en || o.es, 400), modelo }
      } catch (_) { /* si no vino JSON, vale la frase tal cual */ }
      return { es: t(limpio, 400), en: t(limpio, 400), modelo }
    }
    ultimo = `${modelo}: respondió vacío`
  }
  throw new Error('No pude leer la foto. ' + ultimo)
}

/* ══ 1b · El saldo ══
   Quién llama sale del token de la sesión, nunca del cuerpo del mensaje: un número que manda
   el navegador es un número que el navegador puede cambiar. */
async function quienLlama(req: Request): Promise<string> {
  const cab = req.headers.get('Authorization') || ''
  const token = cab.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('Entra otra vez: se perdió la sesión.')

  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error('Entra otra vez: se perdió la sesión.')
  const u = await r.json()
  if (!u?.id) throw new Error('Entra otra vez: se perdió la sesión.')
  return u.id as string
}

const mesUTC = () => new Date().toISOString().slice(0, 7)   // '2026-09'

/* Una llamada con la llave de servicio, que se salta RLS. Es la única que escribe el contador. */
async function tabla(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`,
      'Content-Type': 'application/json', ...(opciones.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const txt = await r.text()
  return txt ? JSON.parse(txt) : null
}

/* Cuántas lleva este mes y cuántas le quedan. `quedan: null` significa sin tope. */
async function saldo(user: string) {
  const mes = mesUTC()
  const [usos, topes] = await Promise.all([
    tabla(`vinetas_uso?user_id=eq.${user}&mes=eq.${mes}&select=vinetas,creditos`),
    tabla(`vinetas_tope?user_id=eq.${user}&select=tope_mes`),
  ])
  const usadas = Number(usos?.[0]?.vinetas) || 0
  const tope = topes?.length ? Number(topes[0].tope_mes) : TOPE_POR_DEFECTO
  return {
    mes, usadas, tope,
    creditos: Number(usos?.[0]?.creditos) || 0,
    quedan: tope < 0 ? null : Math.max(0, tope - usadas),
  }
}

/* ══ 2 · Los estilos ══
   Los cinco que escogió Sergio el 22-sep, con el nombre que ve el usuario. El orden es el orden en que se pintan.
   ⚠️ Van escritos para una HOJA entera y con MAYÚSCULAS donde el modelo tiende a irse a lo suyo: GPT, si no se le
   dice, lo vuelve todo pintura semirrealista (probado: «Animado» salió como pintura hasta que se le dijo que NO
   pareciera una foto ni un render 3D). Si se cambian, hay que rehacer las muestras (`assets/estilos/*.jpg`). */
const ESTILOS: Record<string, { nombre: string; pinta: string }> = {
  arcane: {
    nombre: 'Animado',
    pinta: 'a 2D ANIMATED CARTOON drawing, like a frame from a stylized animated series: hand-painted textures, ' +
      'visible expressive brushwork, cel shading, bold clean outlines, dramatic rim lighting, saturated teal and ' +
      'amber accents. It must NOT look like a photograph or a 3D render. Turn the person into this cartoon style ' +
      'while keeping the likeness.',
  },
  semireal: {
    nombre: 'Semi-real',
    pinta: 'semi-realistic digital ILLUSTRATION (painted, not a photograph): smooth painterly rendering, cinematic ' +
      'warm lighting, rich soft shadows, detailed skin and hair, clean edges.',
  },
  realista: {
    nombre: 'Realista',
    pinta: 'PHOTOREALISTIC, like real photographs taken on set with a 50mm lens: shallow depth of field, natural ' +
      'available light, sharp detail, true-to-life skin tones.',
  },
  comic: {
    nombre: 'Cómic',
    pinta: 'a bold COMIC BOOK illustration like a graphic novel: heavy black ink outlines, halftone dot shading, ' +
      'high contrast, limited flat palette. It must NOT look like a photograph.',
  },
  plano: {
    nombre: 'Plano',
    pinta: 'a flat 2D VECTOR illustration: clean uniform line art, flat colors, single-tone shadows, warm muted ' +
      'palette, simple uncluttered shapes. It must NOT look like a photograph.',
  },
}
const ESTILO_POR_DEFECTO = 'semireal'

/* ══ 3 · El guionista de la hoja ══
   Sergio (23-sep): «lo que yo escribo ahí no es lo que se le pasa directamente a la herramienta que genera la imagen,
   tiene que pasar por un mejorador de prompt interno de Cherry». Aquí se traduce lo que escribió a lo que entiende el
   dibujante, se ESCOGE UN SITIO para todo el video y un plano DISTINTO para cada escena.

   Los ángulos variados eran lo segundo que pedía: con el guionista viejo casi todas salían de medio cuerpo. */
type Escena = { n: number; escena: string; encuadre: string; plano: string }
type Plan = { lugar: string; paneles: Array<{ plano: string; escena: string; nombre: string; porque: string }> }

/* Pide un JSON a Gemini y, si no contesta, a OpenAI. Devuelve el objeto o null. */
async function pedirJSON(pide: string, imagen?: { mime: string; data: string }): Promise<any | null> {
  const leer = (txt: string) => {
    const limpio = String(txt || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    try { return JSON.parse(limpio) } catch (_) { /* sigue */ }
    try { return JSON.parse(limpio.slice(limpio.indexOf('{'), limpio.lastIndexOf('}') + 1)) } catch (_) { return null }
  }
  if (GEMINI_API_KEY) {
    for (const modelo of MODELOS_TEXTO) {
      try {
        const partes: any[] = [{ text: pide }]
        if (imagen) partes.push({ inline_data: { mime_type: imagen.mime, data: imagen.data } })
        const r = await fetch(`${GEMINI}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: partes }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
        })
        if (!r.ok) { console.warn(`[sb-vineta] ${modelo}: ${r.status}`); continue }
        const j = await r.json()
        const o = leer((j?.candidates?.[0]?.content?.parts ?? []).map((q: any) => q?.text || '').join(''))
        if (o) return o
      } catch (e) {
        console.warn(`[sb-vineta] ${modelo}: ${String(e).slice(0, 120)}`)
      }
    }
  }
  if (OPENAI_API_KEY) {
    try {
      const contenido: any[] = [{ type: 'text', text: pide }]
      if (imagen) contenido.push({ type: 'image_url', image_url: { url: `data:${imagen.mime};base64,${imagen.data}`, detail: 'high' } })
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODELO_TEXTO_OPENAI, reasoning_effort: 'low', response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: contenido }] }),
      })
      if (!r.ok) { console.warn(`[sb-vineta] ${MODELO_TEXTO_OPENAI}: ${r.status} ${(await r.text()).slice(0, 160)}`); return null }
      const j = await r.json()
      return leer(j?.choices?.[0]?.message?.content ?? '')
    } catch (e) {
      console.warn(`[sb-vineta] ${MODELO_TEXTO_OPENAI}: ${String(e).slice(0, 120)}`)
    }
  }
  return null
}

async function guionDeHoja(escenas: Escena[], negocio: string, lugar: string, formato = '', regla = ''):
  Promise<Plan | null> {
  const lista = escenas.map((x, i) =>
    `${i + 1}. ${x.escena}` + (x.plano ? `   [el formato pide: ${x.plano}]`
      : x.encuadre ? `   [el programa adivinó: ${x.encuadre}]` : '')
  ).join('\n')

  const pide =
    'Eres el director de fotografía de un storyboard para un video vertical corto. Abajo van las escenas tal como ' +
    'las escribió el creador: en español, cortas y a veces con erratas. El storyboard se dibuja ENTERO en una sola ' +
    'hoja, con la misma persona, la misma ropa y el mismo sitio de principio a fin, así que tiene que leerse como UN ' +
    'video continuo.\n\n' +
    (negocio || lugar ? 'EL NEGOCIO DEL CREADOR\n' + (negocio ? '· Qué hace: ' + negocio + '\n' : '') +
      (lugar ? '· Dónde graba: ' + lugar + '\n' : '') + '\n' : '') +
    'DEVUELVE\n' +
    '· «lugar»: UN solo sitio para todo el video, en INGLÉS, una frase concreta y visual: qué sitio es, qué hay y qué ' +
    'luz tiene. Sácalo de lo que dicen las escenas y de dónde graba. Si las escenas cambian de sitio a propósito, di ' +
    'el sitio principal.\n' +
    '· Por cada escena, «plano» (el ángulo de cámara, en inglés) y «escena» (lo que se ve, en inglés, UNA frase).\n' +
    '· Y para el creador, en español de Colombia: «nombre», el plano en una a tres palabras (Primer plano, Plano ' +
    'medio, Plano entero, Plano general, Sobre el hombro, Cenital, Contrapicado, Picado, Perfil, Detalle, POV, ' +
    'Inserto de pantalla, Holandés); y «porque», por qué ese plano en esta escena, en ocho palabras como mucho y ' +
    'tuteando («acércate justo cuando sueltas el dato»).\n\n' +
    (formato ? 'EL FORMATO DEL VIDEO: ' + formato + (regla ? ' — ' + regla : '') + '\n' +
      '⚠️ El formato manda en cómo se graba. Si es de cámara quieta (Estático, Entrevista, Podcast), las escenas con ' +
      'la persona van TODAS con el mismo encuadre frontal y solo cambia lo que hace; si es Plano fijo, la cámara no ' +
      'se mueve y es la persona la que cambia de sitio (entra, se acerca, se aleja). Cada escena trae entre ' +
      'corchetes el plano que pide el formato: úsalo.\n' +
      '⚠️ Pero el plano del formato es solo el ENCUADRE: nunca cambia lo que pasa. Si el creador escribe que él hace ' +
      'algo (habla, sonríe, levanta los dedos), él sale haciéndolo. «Texto en pantalla» quiere decir que el encuadre ' +
      'deja aire para el rótulo (la persona un poco más pequeña o a un lado), NO que la escena se vuelva un gráfico. ' +
      'Una escena es un gráfico sin persona solo si el creador lo pide.\n\n' : '') +
    'EL PLANO\n' +
    '· Si el creador DICE el encuadre —«cuerpo completo», «primer plano», «desde abajo», «plano general», «POV»— se ' +
    'respeta, mande lo que mande el formato o lo que adivinó el programa.\n' +
    '· Si no lo dice y el formato no lo fija, lo escoges tú según lo que pasa en la escena, y VARÍAS: nunca dos ' +
    'escenas seguidas con el mismo plano. Repertorio: extreme close-up of the face, close-up, medium close-up, medium shot from the waist up, full ' +
    'body shot, wide establishing shot of the whole place, low angle shot from below, high angle shot from above, ' +
    'top-down overhead shot, over-the-shoulder shot, profile shot, dutch angle, first person POV, insert shot (an ' +
    'object or a screen fills the panel).\n' +
    '· Una escena de pantalla (celular, computador, una gráfica) es un inserto de la pantalla o un plano sobre el ' +
    'hombro.\n' +
    '· ⚠️ Si escribe POV —o «punto de vista», «como si lo viera yo», «en primera persona»— la cámara son sus ojos y ' +
    'de él solo se ven las manos. Ahí la frase cuenta lo que TIENE DELANTE.\n\n' +
    'LA ESCENA\n' +
    '· ⚠️ TODO LO QUE ÉL NOMBRA TIENE QUE SALIR. Si dice que está sentado al computador, hay un computador, un ' +
    'escritorio y él sentado delante. Si nombra la caja, la cocina, un plato o el celular, eso aparece. Lo que no ' +
    'pongas no se dibuja.\n' +
    '· Di la expresión y el gesto (sonríe, levanta una ceja, señala, se encoge de hombros): es lo que hace que un ' +
    'storyboard se entienda.\n' +
    '· NUNCA digas lo que NO se ve ni enumeres partes del cuerpo que quedan fuera del cuadro.\n' +
    '· Nada de frases escritas dentro del dibujo. Una pantalla se describe con iconos, botones y gráficas («a phone ' +
    'screen glowing with notification bubbles»), sin decir qué pone.\n' +
    '· No describas a la persona: sus rasgos van aparte. Llámala «the person», «he» o «she».\n' +
    '· Corrige las erratas por sentido.\n\n' +
    'LAS ESCENAS\n' + lista + '\n\n' +
    'Responde SOLO este JSON, con un elemento por escena y en el mismo orden:\n' +
    '{"lugar":"...","paneles":[{"plano":"...","escena":"...","nombre":"...","porque":"..."}]}'

  const o = await pedirJSON(pide)
  const paneles = o?.paneles
  if (!Array.isArray(paneles) || paneles.length !== escenas.length) {
    console.warn('[sb-vineta] el guionista devolvió ' + (paneles?.length ?? '?') + ' paneles para ' + escenas.length)
    return null
  }
  return {
    lugar: t(o?.lugar, 300) || 'a warm, tidy room with soft natural light',
    paneles: paneles.map((q: any, i: number) => ({
      plano: t(q?.plano, 120) || 'medium shot',
      escena: t(q?.escena, 500) || escenas[i].escena,
      nombre: t(q?.nombre, 40), porque: t(q?.porque, 90),
    })),
  }
}

/* ══ 4 · El prompt de la hoja ══
   Probado el 29-sep con su guion de 13 escenas: así salió la reja limpia las tres veces con GPT. */
function armarHoja(plan: Plan, escenas: Escena[], clave: string, quien: string, lado: number,
  nFotos: number, nMuestras: number, sinNumero = false): string {
  const N = escenas.length
  const estilo = ESTILOS[clave] || ESTILOS[ESTILO_POR_DEFECTO]
  const nums = escenas.map(x => x.n)
  const partes: string[] = []

  if (lado === 1) {
    /* `sinNumero`: las miniaturas de los estilos (assets/estilos) no llevan número. */
    partes.push('One single vertical 9:16 storyboard panel for a short video; the drawing fills the whole image ' +
      'edge to edge. ' + (sinNumero ? 'No text anywhere.'
        : `A small black number ${nums[0]} in a small white box in its top-left corner. No other text anywhere.`))
  } else {
    const vacias = lado * lado - N
    partes.push('One single storyboard sheet for a vertical short video. A clean white sheet divided into a grid of ' +
      `${lado} columns and ${lado} rows of equal vertical 9:16 panels with thin white gutters. ${N} panels fill the ` +
      'grid left to right, top to bottom' +
      (vacias ? `; the last ${vacias === 1 ? 'cell of the bottom row is' : vacias + ' cells are'} left plain white` : '') +
      '. Each panel has a small black number in a small white box in its top-left corner, in this order: ' +
      nums.join(', ') + '. No other text anywhere.')
  }

  if (nFotos) {
    partes.push((nFotos === 1
      ? 'The first reference photo shows a real person.'
      : `The first ${nFotos} reference photos all show the SAME real person seen from different angles.`) +
      ' In every panel that shows a person it is this person, and must look exactly like the photos: same face and ' +
      'nose, same hair, same facial hair, same skin tone, same age.' +
      (quien ? ` (${quien})` : '') +
      ' Same outfit in every panel: the one in the first photo.')
  } else if (quien) {
    partes.push(`In every panel that shows a person it is the same character: ${quien}. Same outfit in every panel.`)
  }
  if (nMuestras) {
    partes.push((nMuestras === 1 ? 'The last reference image is a panel' : `The last ${nMuestras} reference images are panels`) +
      ' already drawn for this same video: match their drawing style, the outfit and the place exactly.')
  }

  partes.push(`Same place in every panel: ${plan.lugar}. It reads as one continuous video.`)
  partes.push(`STYLE (most important, applies to every panel): ${estilo.pinta}`)
  const distintos = new Set(plan.paneles.map(p => p.plano.toLowerCase())).size
  partes.push((N > 1 ? (distintos > N / 2 ? 'Each panel uses a DIFFERENT camera angle, chosen for what happens in it:\n'
    : 'Each panel, with its camera framing:\n') : '') +
    plan.paneles.map((p, i) => `${nums[i]}. ${p.plano}: ${p.escena}`).join('\n'))
  partes.push('No speech bubbles, no captions, no logos, no watermark, no signature.')
  return partes.join('\n\n')
}

/* ══ 5 · Las fotos ══
   La foto principal llega del navegador (es la de «quién sale», que ya vive en la marca). Las demás —de lado, de
   cuerpo entero— viven en el cubo privado `vinetas`, igual que las muestras, y se bajan aquí con la llave de servicio.
   ⚠️ Solo de la carpeta de quien llama: la ruta se comprueba contra su id, nunca se fía del navegador. */
type Foto = { mime: string; data: string }

async function bajarDelCubo(ruta: string, user: string | null): Promise<Foto | null> {
  const r0 = t(ruta, 300)
  if (!user || !r0.startsWith(user + '/') || r0.includes('..')) return null
  const r = await fetch(`${SB_URL}/storage/v1/object/vinetas/${r0.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` },
  })
  if (!r.ok) { console.warn(`[sb-vineta] no pude bajar ${r0}: ${r.status}`); return null }
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0]
  return { mime: /^image\//.test(mime) ? mime : 'image/jpeg', data: aBase64(new Uint8Array(await r.arrayBuffer())) }
}

async function juntarFotos(b: any, user: string | null): Promise<{ fotos: Foto[]; muestras: Foto[] }> {
  const fotos: Foto[] = []
  for (const uri of (Array.isArray(b?.fotos) ? b.fotos : []).slice(0, MAX_FOTOS)) {
    const p = parteImagen(uri)
    if (p) fotos.push({ mime: p.inline_data.mime_type, data: p.inline_data.data })
  }
  const rutas = (Array.isArray(b?.fotosRutas) ? b.fotosRutas : []).slice(0, Math.max(0, MAX_FOTOS - fotos.length))
  for (const f of await Promise.all(rutas.map((r: string) => bajarDelCubo(r, user)))) if (f) fotos.push(f)
  const muestras: Foto[] = []
  const rm = (Array.isArray(b?.muestras) ? b.muestras : []).slice(0, MAX_MUESTRAS)
  for (const f of await Promise.all(rm.map((r: string) => bajarDelCubo(r, user)))) if (f) muestras.push(f)
  return { fotos, muestras }
}

/* ══ 6 · Los dibujantes ══ */
type Dibujo = { data: string; mime: string; costo: number; ms: number }

async function dibujaGPT(prompt: string, imagenes: Foto[], lado: number, modelo: string): Promise<Dibujo> {
  if (!OPENAI_API_KEY) throw new Error('falta la llave de OpenAI')
  const t0 = Date.now()
  const forma = new FormData()
  forma.append('model', modelo)
  forma.append('prompt', prompt)
  forma.append('size', TAMANO_GPT[lado] || TAMANO_GPT[4])
  forma.append('quality', CALIDAD_GPT)
  /* JPEG y no PNG: la hoja viaja al navegador en base64, y en PNG pesa cinco veces más. */
  forma.append('output_format', 'jpeg')
  forma.append('output_compression', '90')
  imagenes.forEach((f, i) => {
    const ext = f.mime.includes('png') ? 'png' : f.mime.includes('webp') ? 'webp' : 'jpg'
    forma.append('image[]', new Blob([deBase64(f.data)], { type: f.mime }), `ref${i + 1}.${ext}`)
  })
  /* Sin fotos no hay nada que editar: se pide como imagen nueva. */
  const ruta = imagenes.length ? 'edits' : 'generations'
  const r = imagenes.length
    ? await fetch(`https://api.openai.com/v1/images/${ruta}`, {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: forma })
    : await fetch(`https://api.openai.com/v1/images/${ruta}`, {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, prompt, size: TAMANO_GPT[lado] || TAMANO_GPT[4], quality: CALIDAD_GPT,
        output_format: 'jpeg', output_compression: 90 }) })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 240)}`)
  const j = await r.json()
  const data = j?.data?.[0]?.b64_json
  if (!data) throw new Error('no devolvió imagen')
  const u = j?.usage || {}
  const det = u.input_tokens_details || {}
  const costo = (Number(det.text_tokens) || 0) * PRECIO.gptTexto +
    (Number(det.image_tokens) || 0) * PRECIO.gptImagenEntra +
    (Number(u.output_tokens) || 0) * PRECIO.gptImagenSale
  console.log(`[sb-vineta] GPT ${modelo} ${TAMANO_GPT[lado]} ${CALIDAD_GPT}: ${Date.now() - t0} ms, ` +
    `uso ${JSON.stringify(u)}, US$${costo.toFixed(4)}`)
  return { data, mime: 'image/jpeg', costo, ms: Date.now() - t0 }
}

async function dibujaNB(prompt: string, imagenes: Foto[], modelo: string): Promise<Dibujo> {
  if (!GEMINI_API_KEY) throw new Error('falta la llave de Gemini')
  const t0 = Date.now()
  const r = await fetch(`${GEMINI}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt },
        ...imagenes.map(f => ({ inline_data: { mime_type: f.mime, data: f.data } }))] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16', imageSize: '2K' } },
    }),
  })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 240)}`)
  const j = await r.json()
  const partes = j?.candidates?.[0]?.content?.parts ?? []
  const img = partes.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
  const dato = img?.inlineData || img?.inline_data
  if (!dato?.data) throw new Error('no devolvió imagen (' + (j?.candidates?.[0]?.finishReason || 'sin motivo') + ')')
  const u = j?.usageMetadata || {}
  const costo = PRECIO.nbImagen + (Number(u.promptTokenCount) || 0) * PRECIO.nbEntra
  console.log(`[sb-vineta] NB ${modelo}: ${Date.now() - t0} ms, uso ${JSON.stringify(u)}, US$${costo.toFixed(4)}`)
  return { data: dato.data, mime: dato.mimeType || dato.mime_type || 'image/png', costo, ms: Date.now() - t0 }
}

/* ══ 7 · Ubicar cada escena en la hoja ══
   Devuelve qué escena quedó en cada celda: [{celda, n}], solo las que están. null si no se pudo mirar (entonces se
   reparte por puesto, que es como las dibujó GPT las tres veces que se probó).

   ⚠️ POR LO QUE SE VE, no solo por el número pintado. Probado con la hoja de Nano Banana Pro del 29-sep: repitió la
   escena 4 y a la copia le puso «5»; la escena 5 de verdad llevaba el otro «5». Repartiendo por número, la 5 se
   quedaba con el dibujo de la 4. Así que se le da al que mira la lista de escenas y se le pide que case cada una con
   la celda que la MUESTRA, usando el número solo de pista. */
async function ubicarEscenas(img: Dibujo, lado: number, escenas: Escena[], plan: Plan) {
  if (lado === 1) return [{ celda: 0, n: escenas[0].n }]
  const total = lado * lado
  const lista = escenas.map((x, i) => `${x.n}. ${plan.paneles[i]?.plano || ''}: ${plan.paneles[i]?.escena || x.escena}`).join('\n')
  const pide =
    `Esta imagen es una hoja de storyboard: una reja de ${lado} columnas por ${lado} filas de paneles. Las celdas se ` +
    `cuentan de 0 a ${total - 1}, de izquierda a derecha y de arriba abajo. Cada panel dibujado lleva un número ` +
    'pintado en su esquina superior izquierda.\n\n' +
    'Estas son las escenas que se pidieron:\n' + lista + '\n\n' +
    'Para cada escena, di en qué celda está dibujada. Usa el número pintado como pista, pero manda lo que SE VE: si ' +
    'dos celdas llevan el mismo número, o el número no cuadra con el dibujo, escoge la celda cuyo dibujo muestra esa ' +
    'escena. Si una escena no está dibujada en ninguna celda, pon -1. Nunca uses la misma celda para dos escenas.\n' +
    'Responde SOLO este JSON: {"escenas":[{"n":1,"celda":0}, ...]} con un elemento por escena.'
  const o = await pedirJSON(pide, { mime: img.mime, data: img.data })
  const resp = o?.escenas
  if (!Array.isArray(resp)) {
    console.warn('[sb-vineta] no pude ubicar las escenas: ' + JSON.stringify(o).slice(0, 200))
    return null
  }
  const esperados = new Set(escenas.map(x => x.n))
  const nUsados = new Set<number>(), celdasUsadas = new Set<number>()
  const fuera: Array<{ celda: number; n: number }> = []
  for (const x of resp) {
    const n = Math.round(Number(x?.n)), celda = Math.round(Number(x?.celda))
    if (!esperados.has(n) || nUsados.has(n) || !(celda >= 0 && celda < total) || celdasUsadas.has(celda)) continue
    nUsados.add(n); celdasUsadas.add(celda); fuera.push({ celda, n })
  }
  console.log(`[sb-vineta] escenas ubicadas: ${JSON.stringify(fuera)}`)
  return fuera
}

const porPuesto = (escenas: Escena[]) => escenas.map((x, celda) => ({ celda, n: x.n }))

/* ══ 8 · La hoja entera ══
   `user` null = prueba sin tope (solo la usa la copia de prueba, nunca la función de verdad). */
async function hoja(b: any, user: string | null) {
  const crudas = Array.isArray(b?.escenas) && b.escenas.length
    ? b.escenas
    : [{ escena: b?.escena, encuadre: b?.encuadre }]
  const vistos = new Set<number>()
  const escenas: Escena[] = crudas.slice(0, MAX_HOJA)
    .map((x: any, i: number) => ({ n: Math.round(Number(x?.n)) || i + 1, escena: t(x?.escena, 400),
      encuadre: t(x?.encuadre, 30), plano: t(x?.plano, 160) }))
    .filter((x: Escena) => {
      if (!x.escena || vistos.has(x.n)) return false
      vistos.add(x.n); return true
    })
  if (!escenas.length) throw new Error('No hay escena que dibujar.')

  /* Mirar ANTES de dibujar: dibujar y luego decir que no se podía ya costó la plata. */
  const antes = user ? await saldo(user) : null
  if (antes && antes.quedan !== null && antes.quedan < escenas.length) {
    throw new Error(`Te quedan ${antes.quedan} viñetas este mes y aquí hay ${escenas.length} escenas. ` +
      'El 1 vuelven a empezar.')
  }

  /* ⚠️ SI EL GUIONISTA NO CONTESTA, NO SE DIBUJA: dibujar el texto en español tal cual sale basura y le gasta viñetas.
     Dos vueltas, y cada una recorre Gemini y luego OpenAI. */
  const [plan, { fotos, muestras }] = await Promise.all([
    (async () => {
      const args = [escenas, t(b?.negocio, 300), t(b?.lugar, 300), t(b?.formato, 60), t(b?.regla, 300)] as const
      return await guionDeHoja(...args) || await guionDeHoja(...args)
    })(),
    juntarFotos(b, user),
  ])
  if (!plan) {
    throw new Error('Cherry no logró preparar las escenas para el dibujante. Vuelve a darle en un momento — no se ' +
      'gastó ninguna viñeta.')
  }

  const lado = Math.min(4, Math.ceil(Math.sqrt(escenas.length)))
  const clave = t(b?.estilo, 20)
  const prompt = armarHoja(plan, escenas, clave, t(b?.rasgos, 400), lado, fotos.length, muestras.length,
    lado === 1 && !!b?.sinNumero)
  const imagenes = [...fotos, ...muestras]

  /* Los dibujantes: el que pida la llamada primero (para las pruebas) y luego el orden de siempre. */
  const pedido = t(b?.dibujante, 10)
  const orden = [...DIBUJANTES].sort((a, z) => (z.id === pedido ? 1 : 0) - (a.id === pedido ? 1 : 0))
  const soloUno = !!b?.soloEse && !!pedido

  const t0 = Date.now()
  let mejor: (Dibujo & { dib: typeof DIBUJANTES[0]; celdas: Array<{ celda: number; n: number }>; leida: boolean }) | null = null
  let costoTotal = 0
  const fallas: string[] = []
  for (const d of (soloUno ? orden.slice(0, 1) : orden)) {
    if (mejor && Date.now() - t0 > PLAZO_SEGUNDO_MS) break
    try {
      const img = d.id === 'gpt' ? await dibujaGPT(prompt, imagenes, lado, d.modelo) : await dibujaNB(prompt, imagenes, d.modelo)
      costoTotal += img.costo
      const leidas = await ubicarEscenas(img, lado, escenas, plan)
      const intento = { ...img, dib: d, celdas: leidas || porPuesto(escenas), leida: !!leidas }
      if (!mejor || intento.celdas.length > mejor.celdas.length) mejor = intento
      if (intento.celdas.length === escenas.length) break
      fallas.push(`${d.nombre}: salieron ${intento.celdas.length} de ${escenas.length}`)
    } catch (e) {
      const m = String((e as Error)?.message || e)
      console.error(`[sb-vineta] ${d.nombre} falló: ${m}`)
      fallas.push(`${d.nombre}: ${m.slice(0, 160)}`)
    }
  }

  if (!mejor) {
    /* Un rechazo por contenido se dice como tal: ahí sí sirve cambiar la escena. */
    if (fallas.some(f => /moderation|safety|content_policy|SAFETY|PROHIBITED/i.test(f))) {
      throw new Error('El dibujante rechazó alguna escena por su contenido. Revisa qué se ve en ellas y vuelve a darle.')
    }
    throw new Error('Los dibujantes no están respondiendo ahora mismo. No se gastó ninguna viñeta: vuelve a darle ' +
      'en un rato. (' + fallas.join(' · ') + ')')
  }

  /* Apuntadas, ahora que existen: solo las que salieron. Si esto fallara, la hoja ya está hecha y devolverla es
     mejor que perderla: se avisa por el registro y se sigue. */
  const salieron = mejor.celdas.length
  let queda = antes ? (antes.quedan === null ? null : antes.quedan - salieron) : null
  if (user) {
    try {
      const fila = await tabla('rpc/vineta_apuntar', {
        method: 'POST',
        body: JSON.stringify({ p_user: user, p_vinetas: salieron, p_creditos: Math.round(costoTotal * DOLAR_EN_CREDITOS) }),
      })
      const usadas = Number(fila?.[0]?.vinetas)
      if (Number.isFinite(usadas) && antes && antes.tope >= 0) queda = Math.max(0, antes.tope - usadas)
    } catch (e) {
      console.error('[sb-vineta] no pude apuntar la hoja:', String(e))
    }
  }

  const hechos = new Set(mejor.celdas.map(c => c.n))
  return {
    imagen: `data:${mejor.mime};base64,${mejor.data}`,
    lado, celdas: mejor.celdas, leida: mejor.leida,
    /* El plano que se DIBUJÓ en cada escena, en español: la pantalla lo pone debajo de la viñeta. */
    planos: escenas.map((x, i) => ({ n: x.n, nombre: plan.paneles[i].nombre, porque: plan.paneles[i].porque })),
    faltan: escenas.filter(x => !hechos.has(x.n)).map(x => x.n),
    /* Para el navegador de antes (una escena por llamada): una hoja de 1×1 es una tira de una. */
    paneles: lado === 1 ? 1 : escenas.length,
    corte: { margen: 0 },
    dibujante: mejor.dib.nombre, modelo: mejor.dib.modelo,
    estilo: clave in ESTILOS ? clave : ESTILO_POR_DEFECTO,
    fotos: fotos.length, muestras: muestras.length,
    costo_usd: Math.round(costoTotal * 10000) / 10000, segundos: Math.round((Date.now() - t0) / 1000),
    quedan: queda, tope: antes ? antes.tope : null,
    avisos: fallas,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json()
    if (b?.modo === 'rasgos') return json(await rasgos(b))
    /* Cuántas le quedan, para pintarlo antes de que toque el botón. */
    if (b?.modo === 'saldo') return json(await saldo(await quienLlama(req)))
    /* Para que la pantalla sepa si ya se puede dibujar, sin gastar nada preguntándolo. */
    if (b?.modo === 'estado') return json({ openai: !!OPENAI_API_KEY, gemini: !!GEMINI_API_KEY })
    /* El catálogo de estilos, para que la pantalla lo pinte sin repetir los nombres. */
    if (b?.modo === 'estilos') {
      return json({
        estilos: Object.keys(ESTILOS).map(k => ({ id: k, nombre: ESTILOS[k].nombre })),
        porDefecto: ESTILO_POR_DEFECTO, maxHoja: MAX_HOJA, maxFotos: MAX_FOTOS,
      })
    }
    return json(await hoja(b, await quienLlama(req)))
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400)
  }
})

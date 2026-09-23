/* sb-vineta — dibuja las viñetas del storyboard (23-sep-2026)
 *
 * Cuatro modos:
 *
 *   modo «rasgos»    · mira la foto de quien sale y la describe con palabras (Gemini, capa gratuita).
 *                      Se hace UNA vez por persona y la descripción se guarda.
 *   modo «estilos»   · devuelve el catálogo de los cinco estilos y lo que cuesta una viñeta.
 *   modo «saldo»     · cuántas viñetas lleva la cuenta este mes y cuántas le quedan.
 *   modo por defecto · dibuja una TIRA de hasta 3 viñetas en una sola imagen (Cloudflare).
 *                      Una viñeta suelta es una tira de una.
 *
 * ⚠️ ESTO YA NO ES GRATIS, y a propósito. Los 10.000 créditos diarios que regala Cloudflare son
 * de la CUENTA de Cherry, no de cada usuario: con el modelo bueno son 2 viñetas al día para toda
 * la plataforma. Sergio decidió el 22-sep pagar y ponerle un tope a cada CUENTA: 45 viñetas al
 * mes repartidas entre todas sus marcas.
 *
 * El tope se cuenta aquí, en el servidor, con la llave de servicio. Si lo contara el navegador,
 * el navegador podría borrar la cuenta — y cada dibujo es plata. Ver `08-vinetas-uso.sql`.
 *
 * ⚠️ Cloudflare cobra por PIXELES, no por llamadas: por cada baldosa de 512x512 que ocupe el
 * dibujo. De ahí las tiras — tres viñetas en una imagen cuestan 1.272 créditos, la tercera parte
 * de lo que costaba UNA sola antes. Un storyboard entero pasó de 34.344 créditos a 3.816.
 *
 * ⚠️ Por qué no dibuja Gemini: probado el 23-sep contra la llave real, la capa gratuita de sus
 * modelos de imagen es **limit: 0** — no hay ninguna imagen gratis, por mucho que lo digan por ahí.
 * Con facturación son $0,039 por imagen. En Cloudflare, una tira de tres cuesta $0,014 en total.
 *
 * Lo que se pierde: Cloudflare no acepta una FOTO de referencia, solo texto. De ahí el rodeo de
 * describir los rasgos primero — la misma frase en las nueve viñetas da el mismo personaje en las
 * nueve. No es un retrato, y para un storyboard no hace falta: hace falta entender la escena y
 * reconocer que es el mismo tipo.
 */
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const CF_TOKEN = Deno.env.get('CLOUDFLARE_AI_TOKEN') ?? ''
const CF_CUENTA = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? ''

/* Las pone Supabase sola en toda Edge Function. */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/* El tope de una cuenta que no tiene plan todavía: 45 viñetas al mes, unos 5 storyboards.
   Lo escogió Sergio el 22-sep sabiendo que le cuesta 7.560 pesos al mes por cuenta.
   Cuando haya planes, cada plan escribe su número en `vinetas_tope` y este queda de suelo. */
const TOPE_POR_DEFECTO = 45

const GEMINI = 'https://generativelanguage.googleapis.com'
const MODELOS_TEXTO = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
/* lucid-origin y no flux-1-schnell, probados los dos el 23-sep:
   · schnell solo hace 1024x1024 — no acepta width/height ni seed, y un storyboard vertical
     recortado de un cuadrado pierde los lados de la escena;
   · lucid-origin sí acepta tamaño, y dibuja el pelo, la barba y la piel mucho mejor.
   FLUX 2 (klein/dev) admitiría una FOTO de referencia, pero pide llamada multipart: si algún día
   la consistencia de la cara no basta con la descripción, es por ahí. */
/* ⚠️ UNA CADENA, no un modelo. El 23-sep lucid-origin empezó a responder 500 (code 4009) a
   TODO —probado a seis tamaños distintos y sin tamaño— y el botón de dibujar se quedó muerto,
   porque el reintento de abajo solo cubría el rechazo por contenido.

   lucid-origin sigue el primero a propósito: es con el que Sergio juzgó la calidad. Cuando
   Cloudflare lo levante vuelve a usarse solo, sin tocar nada.

   `baldosa` son los créditos de cada 512x512. El de lucid-origin está medido; el de phoenix sale
   de la lista de precios de Cloudflare con la misma regla (0,0058 USD por baldosa frente a
   0,007), así que es una estimación. El TOPE de Sergio se cuenta en VIÑETAS, no en créditos:
   esto solo mueve el número que se enseña, nunca lo que protege la plata. */
const CF_MODELOS = [
  { id: '@cf/leonardo/lucid-origin', baldosa: 636 },
  { id: '@cf/leonardo/phoenix-1.0', baldosa: 527 },
]
const CF_MODELO = CF_MODELOS[0].id
/* El tamaño de UNA viñeta. 256x448 es 9:16 y en la ficha se ve a 176 px de ancho, así que va
   sobrada. Antes se pedía a 768x1344 —cuatro veces más imagen de la que se alcanza a ver— y
   eso costaba seis baldosas en vez de una. */
const PANEL_ANCHO = 256, PANEL_ALTO = 448
const MAX_PANELES = 3

/* Lo que cobra Cloudflare: baldosas de 512x512, redondeando hacia arriba, por el precio del
   modelo. De aquí sale que tres paneles cuesten menos que dos vueltas de uno. */
const CREDITOS_POR_BALDOSA = CF_MODELOS[0].baldosa
const creditosDe = (ancho: number, alto: number, baldosa = CREDITOS_POR_BALDOSA) =>
  Math.ceil(ancho / 512) * Math.ceil(alto / 512) * baldosa

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

/* ══ 2 · El dibujo ══ */

/* Lo que NUNCA queremos ver en una viñeta, vaya el estilo que vaya. Va al final del prompt
   porque es donde estos modelos lo obedecen mejor. */
const NUNCA = 'no text, no lettering, no watermark, no signature, no frame, no border, ' +
  'no speech bubbles, no captions'

/* Los cinco que escogió Sergio el 22-sep, con el nombre que ve el usuario. El orden es el
   orden en que se pintan en la pantalla. */
const ESTILOS: Record<string, { nombre: string; pinta: string }> = {
  arcane: {
    nombre: 'Animado',
    pinta: 'stylized painterly 2D animation illustration, hand-painted textures, visible ' +
      'expressive brushwork, cel shading with painted detail, dramatic rim lighting, ' +
      'saturated teal and amber accents, cinematic atmosphere',
  },
  semireal: {
    nombre: 'Semi-real',
    pinta: 'semi-realistic digital illustration, smooth painterly rendering, cinematic warm ' +
      'lighting, rich soft shadows, detailed skin texture and hair, clean edges',
  },
  realista: {
    nombre: 'Realista',
    pinta: 'photorealistic portrait photograph, 50mm lens, shallow depth of field, natural ' +
      'available lighting, sharp detail, true-to-life skin tones',
  },
  comic: {
    nombre: 'Cómic',
    pinta: 'bold comic book illustration, heavy black ink outlines, halftone dot shading, ' +
      'high contrast, limited flat palette, graphic novel panel',
  },
  plano: {
    nombre: 'Plano',
    pinta: 'flat 2D vector illustration, clean uniform line art, flat colors, single-tone ' +
      'shadows, warm muted palette, simple uncluttered background',
  },
}
const ESTILO_POR_DEFECTO = 'semireal'

/* ⚠️ Cada uno dice QUÉ LLENA el cuadro, nunca qué falta. Probado: «person out of frame» se lo
   saltan y sale el cuerpo entero; «the object fills the whole panel» sale a la primera.
   Y NUNCA enumerar partes del cuerpo que no salen: Cloudflare rechaza el prompt entero por
   «NSFW» (código 3030) aunque la escena sea un señor haciendo una hamburguesa. */
const ENCUADRES: Record<string, string> = {
  cerrado: 'extreme close-up of the face, the head fills the entire panel edge to edge',
  medio: 'medium shot framed from the waist up, the whole torso and head in view with a little ' +
    'space above the head',
  /* ⚠️ CUERPO ENTERO NO EXISTÍA. Sergio: «le estoy diciendo que el cuerpo completo y aparece
     solo las manos». Pedía algo que no estaba en la lista, así que caía en `medio` o, por la
     palabra «pantalla», en `dividida`. */
  entero: 'full body shot from head to feet, the entire standing figure inside the panel with ' +
    'the floor and the room around visible',
  /* Para cuando lo que cuenta es el SITIO y no la cara. */
  ambiente: 'wide establishing shot of the place, the person small inside the room, the ' +
    'furniture and the depth of the room visible',
  contrapicado: 'low angle shot taken from below waist height, camera tilted upward, the ' +
    'subject towers over the viewer, the ceiling and hanging lamps visible overhead',
  detalle: 'extreme macro close-up of the object, seen from directly above, the object and a ' +
    'pair of hands fill the whole panel from edge to edge',
  dos: 'two people facing each other in profile, one on each side, both fully in view',
  dividida: 'the panel split in two by a hard straight horizontal line: the person in the upper ' +
    'half, the thing they are showing in the lower half',
  texto: 'wide shot with the subject small and low in the panel, the upper third an empty plain ' +
    'wall with nothing in it',
  estatico: 'static frontal shot, the subject centered and still, symmetrical composition',
}

/* ══ 1c · El guionista de imagen ══
   Sergio: «lo que yo escribo ahí no es lo que se le pasa directamente a la herramienta que genera
   la imagen, tiene que pasar por un mejorador de prompt interno de Cherry».

   Tenía razón y era literal: su frase en español iba tal cual al modelo de imagen, que entiende
   inglés y entiende órdenes de fotógrafo, no una nota de guion. Aquí Gemini la traduce a lo que
   el dibujante entiende y ESCOGE EL ENCUADRE leyendo lo que él pidió.

   ⚠️ Si esto falla, se dibuja igual con lo de antes. Un mejorador caído no puede dejar sin
   dibujar: sería cambiar un storyboard feo por ninguno. */
const ENCUADRE_CLAVES = Object.keys(ENCUADRES)

async function guionDeImagen(
  escenas: Array<{ escena: string; encuadre: string }>,
): Promise<Array<{ escena: string; encuadre: string }> | null> {
  if (!GEMINI_API_KEY) return null

  const lista = escenas.map((x, i) =>
    `${i + 1}. ${x.escena}` + (x.encuadre ? `   [el programa adivinó: ${x.encuadre}]` : '')
  ).join('\n')

  const pide =
    'Eres el director de fotografía de un storyboard. Abajo van las escenas de un video tal como ' +
    'las escribió el creador: en español, cortas y a veces con erratas. Para cada una dime qué ' +
    'hay que dibujar.\n\n' +
    'REGLAS\n' +
    '· Si el creador DICE el encuadre —«cuerpo completo», «primer plano», «desde abajo», «plano ' +
    'general»— se respeta, mande lo que mande lo que adivinó el programa. Solo escoges tú ' +
    'cuando él no lo dice.\n' +
    '· «escena» va en INGLÉS, UNA sola frase, y cuenta lo que SE VE: quién, qué hace, dónde y con ' +
    'qué luz. Concreta y visual.\n' +
    '· ⚠️ NUNCA digas lo que NO se ve, ni enumeres partes del cuerpo que quedan fuera. El ' +
    'dibujante rechaza el prompt entero cuando lee eso.\n' +
    '· Nada de texto, letras ni rótulos dentro del dibujo. Una pantalla de celular se dice ' +
    '«a phone screen glowing with notification bubbles», sin decir qué pone.\n' +
    '· No describas a la persona: sus rasgos se añaden aparte. Di «the man» o «the woman» si hace ' +
    'falta nombrarla.\n' +
    '· Corrige las erratas por sentido. En un restaurante, «la salsa» es «the dining room».\n\n' +
    'ENCUADRES que puedes usar (solo estos):\n' +
    'cerrado (la cara llena el cuadro) · medio (de cintura para arriba) · entero (de la cabeza a ' +
    'los pies) · ambiente (el sitio entero, la persona pequeña) · contrapicado (desde abajo) · ' +
    'detalle (macro de un objeto y unas manos) · dos (dos personas de perfil) · dividida (persona ' +
    'arriba, lo que enseña abajo) · texto (hueco arriba para un rótulo) · estatico (frontal y ' +
    'quieto)\n\n' +
    'LAS ESCENAS\n' + lista + '\n\n' +
    'Responde SOLO este JSON, sin nada más y con un elemento por escena y en el mismo orden:\n' +
    '{"paneles":[{"encuadre":"...","escena":"..."}]}'

  for (const modelo of MODELOS_TEXTO) {
    try {
      const r = await fetch(`${GEMINI}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: pide }] }] }),
      })
      if (!r.ok) { console.warn(`[sb-vineta] guionista ${modelo}: ${r.status}`); continue }
      const j = await r.json()
      const txt = (j?.candidates?.[0]?.content?.parts ?? []).map((q: any) => q?.text || '').join('').trim()
      if (!txt) continue
      const limpio = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
      const o = JSON.parse(limpio)
      const paneles = o?.paneles
      if (!Array.isArray(paneles) || paneles.length !== escenas.length) {
        console.warn('[sb-vineta] el guionista devolvió ' + (paneles?.length ?? '?') +
          ' paneles para ' + escenas.length + ' escenas')
        continue
      }
      /* Lo que devuelva se comprueba: un encuadre que no existe dejaría el panel sin órdenes de
         encuadre, y una escena vacía dejaría el panel sin nada que dibujar. */
      return paneles.map((q: any, i: number) => ({
        escena: t(q?.escena, 500) || escenas[i].escena,
        encuadre: ENCUADRE_CLAVES.indexOf(t(q?.encuadre, 20)) >= 0
          ? t(q.encuadre, 20) : escenas[i].encuadre,
      }))
    } catch (e) {
      console.warn(`[sb-vineta] guionista ${modelo}: ${String(e).slice(0, 120)}`)
    }
  }
  return null
}

/* ══ 1d · El prompt, armado ══
   Fuera de `dibuja()` para poder mirar lo que sale sin gastar una viñeta del tope de nadie. */
function armarPrompt(
  escenas: Array<{ escena: string; encuadre: string }>,
  clave: string,
  quien: string,
): string {
  const estilo = ESTILOS[clave] || ESTILOS[ESTILO_POR_DEFECTO]

  /* Los rasgos van DELANTE: un modelo de imagen pesa más lo primero que lee, y si la persona va
     al final sale un señor genérico con la escena bien. */
  const ORDINAL = ['left', 'center', 'right']
  const paneles = escenas.map((x, i) => {
    const donde = escenas.length === 1 ? '' :
      ` (${ORDINAL[escenas.length === 2 && i === 1 ? 2 : i]})`
    return `Panel ${i + 1}${donde}: ${ENCUADRES[x.encuadre] || ENCUADRES.medio}. ${x.escena}.`
  }).join(' ')

  /* ⚠️ «el mismo personaje en TODOS los cuadros» obligaba a meter la cara también donde el
     encuadre pedía un detalle de un objeto. Por eso va condicionada a los cuadros con gente. */
  const reja = escenas.length === 1 ? '' :
    `A storyboard strip of exactly ${escenas.length} panels side by side in ONE single ` +
    'horizontal row, equal width, separated by thin clean white vertical gutters. ' +
    /* ⚠️ Cada cuadro, de borde a borde en vertical. Sin esto el modelo partió el tercero en dos
       y salieron cuatro escenas donde se pedían tres: el corte por tercios metía dos en una
       viñeta. Se dice lo que SÍ tiene que pasar, nunca lo que no: lo que no, se lo saltan. */
    'Every panel spans the full height of the image, from the top edge down to the bottom edge. ' +
    'In the panels that show a person it is always the same character, with identical face, ' +
    'hair and clothing. Other panels are close-ups of an object. '

  return [
    quien ? `A character with ${quien}.` : '',
    reja,
    paneles,
    estilo.pinta + '.',
    NUNCA + '.',
  ].filter(Boolean).join(' ')
}

/* ── Una tira ──────────────────────────────────────────────────────────────────────────
   Entre uno y tres paneles en una sola imagen, uno al lado del otro. Una viñeta suelta es una
   tira de uno: mismo camino, mismo precio por baldosa.

   El separador se pide VISIBLE y fino a propósito. Sin él el modelo funde los tres paneles en
   una sola escena panorámica y no hay por dónde cortar; con él queda una franja clara que sirve
   de guía. Aun así el corte va por tercios exactos —el modelo no clava el píxel— y de ahí el
   recorte de los bordes que se devuelve en `margen`. */
/* ⚠️ DOS FORMAS DE RESPUESTA, según el modelo: lucid-origin devuelve JSON con la imagen en
   base64 dentro de `result.image`; phoenix-1.0 devuelve los bytes del JPEG tal cual. Leer
   `result.image` de una respuesta binaria da vacío, y el error que sale —«Cloudflare no devolvió
   ninguna imagen»— no dice dónde mirar. */
async function aBase64(r: Response): Promise<string> {
  if ((r.headers.get('content-type') || '').includes('json')) {
    return (await r.json())?.result?.image || ''
  }
  const bytes = new Uint8Array(await r.arrayBuffer())
  /* De golpe no: `String.fromCharCode(...bytes)` con cientos de miles de bytes revienta la
     pila de llamadas. De 32 KB en 32 KB. */
  let cadena = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    cadena += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(cadena)
}

async function dibuja(b: any, user: string) {
  if (!CF_TOKEN || !CF_CUENTA) {
    throw new Error('Falta conectar Cloudflare: el token de Workers AI y el ID de la cuenta.')
  }

  /* Admite las dos formas: una lista de escenas, o una sola escena suelta como antes. */
  const crudas = Array.isArray(b?.escenas) && b.escenas.length
    ? b.escenas
    : [{ escena: b?.escena, encuadre: b?.encuadre }]
  let escenas = crudas.slice(0, MAX_PANELES)
    .map((x: any) => ({ escena: t(x?.escena, 400), encuadre: t(x?.encuadre, 30) }))
    .filter((x: any) => x.escena)
  if (!escenas.length) throw new Error('No hay escena que dibujar.')

  /* Lo que escribió él pasa por el guionista antes de llegar al dibujante. Si no contesta, se
     sigue con lo suyo tal cual: peor dibujo, pero dibujo. */
  const mejor = await guionDeImagen(escenas)
  if (mejor) escenas = mejor
  else console.warn('[sb-vineta] sin guionista: se dibuja con el texto tal cual')

  /* Mirar ANTES de dibujar: dibujar y luego decir que no se podía ya costó la plata. */
  const antes = await saldo(user)
  if (antes.quedan !== null && antes.quedan < escenas.length) {
    throw new Error(
      `Te quedan ${antes.quedan} viñetas este mes y esta tira son ${escenas.length}. ` +
      'El 1 vuelven a empezar.')
  }

  const ancho = PANEL_ANCHO * escenas.length
  const alto = PANEL_ALTO
  /* Se calcula abajo otra vez con el modelo que de verdad dibujó: este es solo para mirar
     el saldo antes de gastar. */
  const cuesta = creditosDe(ancho, alto)

  const clave = t(b?.estilo, 20)
  const prompt = armarPrompt(escenas, clave, t(b?.rasgos, 300))

  /* ⚠️ El filtro de contenido de Cloudflare es ALEATORIO. Medido el 23-sep: el MISMO prompt,
     palabra por palabra, dio PASA / NSFW / PASA en tres intentos seguidos. No depende de cómo
     esté escrito — se probó troceándolo y cada trozo pasa por separado.
     Un prompt rechazado no gasta créditos, así que reintentar es gratis.

     Y si el modelo entero está caído —500 con code 4009, que es lo que pasó el 23-sep— no sirve
     de nada insistir: se pasa al siguiente de la cadena. */
  let r: Response | null = null
  let err = ''
  let usado = CF_MODELOS[0]

  for (const modelo of CF_MODELOS) {
    usado = modelo
    let siguienteModelo = false

    for (let intento = 1; intento <= 4; intento++) {
      r = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_CUENTA}/ai/run/${modelo.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.slice(0, 2000), width: ancho, height: alto }) })
      if (r.ok) break
      err = (await r.text()).slice(0, 300)

      /* El tope del día es de la cuenta de Cherry: cambiar de modelo no lo arregla. */
      if (r.status === 429) { siguienteModelo = false; break }

      if (err.includes('NSFW') || err.includes('3030')) {
        console.warn(`[sb-vineta] ${modelo.id}: el filtro rechazó el prompt, intento ${intento} de 4`)
        continue
      }

      /* Cualquier otra cosa es del modelo, no del prompt. Un reintento por si fue un tropezón,
         y si vuelve a fallar se prueba el siguiente. */
      if (intento >= 2) { siguienteModelo = true; break }
      console.warn(`[sb-vineta] ${modelo.id} respondió ${r.status}, lo intento otra vez`)
    }

    if (r && r.ok) break
    if (!siguienteModelo) break
    console.warn(`[sb-vineta] ${modelo.id} no responde, paso al siguiente modelo`)
  }

  if (!r || !r.ok) {
    /* 429 = se acabaron los 10.000 créditos que Cloudflare regala al día. Con la cuenta en
       Workers Paid esto no debería pasar nunca: pasado el regalo, cobra y sigue. Así que si
       sale, lo que falta es el plan, y eso lo arregla Sergio, no el usuario. */
    if (r.status === 429) {
      throw new Error('El dibujo está parado: la cuenta de Cloudflare llegó a su tope del día. ' +
        'Avísale a Sergio — se arregla desde la cuenta, no desde aquí.')
    }
    /* 3030 tras cuatro intentos. No es la redacción —el filtro da veredictos distintos para el
       mismo texto—, así que no se le pide al usuario que reescriba nada. */
    if (err.includes('NSFW') || err.includes('3030')) {
      throw new Error('El dibujante rechazó la escena cuatro veces seguidas. Le pasa de vez en ' +
        'cuando sin motivo. Vuelve a darle.')
    }
    /* Si se acabaron los modelos, el problema es de Cloudflare y no hay nada que el usuario
       pueda hacer distinto: se le dice eso, no un código de error. */
    console.error(`[sb-vineta] ningún modelo dibujó. Último: ${r ? r.status : 'sin respuesta'} ${err}`)
    throw new Error('El dibujante de Cloudflare no está respondiendo ahora mismo. No es cosa de ' +
      'tu escena: probé con todos los modelos que hay. Vuelve a darle en un rato.')
  }

  const b64 = await aBase64(r)
  if (!b64) throw new Error('Cloudflare no devolvió ninguna imagen.')

  /* Lo que costó DE VERDAD: cada modelo de la cadena tiene su precio por baldosa, y el de
     arriba se calculó con el primero solo para poder mirar el saldo antes de gastar. */
  const cuestaReal = creditosDe(ancho, alto, usado.baldosa)

  /* Apuntadas, ahora que existen. Si esto fallara, la tira ya está hecha y devolverla es mejor
     que perderla: se avisa por el registro y se sigue. */
  let queda = antes.quedan === null ? null : antes.quedan - escenas.length
  try {
    const fila = await tabla('rpc/vineta_apuntar', {
      method: 'POST',
      body: JSON.stringify({ p_user: user, p_vinetas: escenas.length, p_creditos: cuestaReal }),
    })
    const usadas = Number(fila?.[0]?.vinetas)
    if (Number.isFinite(usadas) && antes.tope >= 0) queda = Math.max(0, antes.tope - usadas)
  } catch (e) {
    console.error('[sb-vineta] no pude apuntar la tira:', String(e))
  }

  return {
    imagen: `data:image/jpeg;base64,${b64}`,
    modelo: usado.id, estilo: clave in ESTILOS ? clave : ESTILO_POR_DEFECTO,
    ancho, alto, paneles: escenas.length,
    /* Dónde cortar. `margen` es lo que hay que quitarle a cada lado para llevarse por delante
       la franja del separador aunque el modelo la haya dejado un poco torcida. */
    corte: { ancho: PANEL_ANCHO, alto: PANEL_ALTO, margen: Math.round(PANEL_ANCHO * 0.02) },
    creditos: cuestaReal, quedan: queda, tope: antes.tope,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json()
    if (b?.modo === 'rasgos') return json(await rasgos(b))
    /* Cuántas le quedan, para pintarlo antes de que toque el botón. */
    if (b?.modo === 'saldo') return json(await saldo(await quienLlama(req)))
    /* Para que la pantalla sepa si ya se puede dibujar, sin gastar un crédito preguntándolo. */
    if (b?.modo === 'estado') return json({ cloudflare: !!(CF_TOKEN && CF_CUENTA), gemini: !!GEMINI_API_KEY })
    /* El catálogo de estilos, para que la pantalla lo pinte sin repetir los nombres. */
    if (b?.modo === 'estilos') {
      return json({
        estilos: Object.keys(ESTILOS).map(k => ({ id: k, nombre: ESTILOS[k].nombre })),
        porDefecto: ESTILO_POR_DEFECTO, maxPaneles: MAX_PANELES,
        creditos: { uno: creditosDe(PANEL_ANCHO, PANEL_ALTO),
                    tira: creditosDe(PANEL_ANCHO * MAX_PANELES, PANEL_ALTO) },
      })
    }
    return json(await dibuja(b, await quienLlama(req)))
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400)
  }
})

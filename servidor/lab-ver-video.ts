// lab-ver-video v1 (20-sep-2026) — lo que se VE en un video, para el Laboratorio.
//
// El desmontaje por texto no puede ver el gancho visual ni los open loops visuales: el tren que
// atropella al que habla, el carro que cae del cielo, el rayo. Eso no está en la transcripción y es
// justo lo que sostiene la atención entre frase y frase.
//
// Gemini procesa el video ENTERO de forma nativa —imagen y movimiento, con marcas de tiempo— en vez
// de fotogramas sueltos. Con fotogramas habría que adivinar dónde mirar; así ve el tren porque ve
// que se mueve.
//
// El video va por la Files API de Google, no metido en la petición: en base64 un reel de 30 MB pasa
// de 40 y revienta el límite. Además así vale para videos largos.
//
// Recibe: multipart/form-data con «video», «dur» y «texto» (la transcripción, para corregirla).
//
// Truco de Sergio: casi todos estos videos llevan subtítulos quemados, y son TEXTO ESCRITO por quien
// hizo el video. Mandan sobre lo que se crea oír: si el subtítulo deja una frase a medias, se corta.
// Devuelve: { gancho, visuales:[{seg, que, porque}], vozCortada:[{seg, dice}], produccion, cortes, nota }
//
// vozCortada existe porque una transcripción NO sirve para esto: cuando la voz se corta a media
// frase, Whisper la completa por su cuenta y a veces se inventa la palabra que falta. Gemini lo oye
// y lo ve, así que lo marca.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const BASE = 'https://generativelanguage.googleapis.com'
/* gemini-flash-latest es un alias: apunta siempre al mejor flash disponible, y así esto no se cae
   cada vez que Google retira un modelo (2.5-flash dejó de admitir usuarios nuevos en cuanto se
   probó). Los otros dos son por si el primero está saturado. */
const MODELOS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
const TOPE = 120 * 1024 * 1024          // 120 MB: de sobra para un reel

async function usuario(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  if ([Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter(Boolean).includes(token)) return 'interno'
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' ? u.id : null
  } catch (_) { return null }
}

/* Sube el video a la Files API y espera a que Google termine de prepararlo. Sin esa espera, pedir el
   análisis devuelve «el archivo no está listo» y se pierde la subida entera. */
async function subirVideo(datos: Uint8Array, tipo: string): Promise<string> {
  const inicio = await fetch(`${BASE}/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(datos.byteLength),
      'X-Goog-Upload-Header-Content-Type': tipo,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'referencia' } }),
  })
  if (!inicio.ok) throw new Error(`Google no aceptó la subida (${inicio.status}): ${(await inicio.text()).slice(0, 160)}`)
  const destino = inicio.headers.get('X-Goog-Upload-URL')
  if (!destino) throw new Error('Google no devolvió dónde subir el video.')

  const sube = await fetch(destino, {
    method: 'POST',
    headers: { 'Content-Length': String(datos.byteLength), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: datos,
  })
  if (!sube.ok) throw new Error(`Falló la subida del video (${sube.status})`)
  const j = await sube.json()
  const nombre = j?.file?.name
  const uri = j?.file?.uri
  if (!nombre || !uri) throw new Error('Google no devolvió el video subido.')

  // esperar a que esté listo (un reel tarda unos segundos)
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${BASE}/v1beta/${nombre}?key=${GEMINI_API_KEY}`)
    const f = await r.json()
    if (f?.state === 'ACTIVE') return uri
    if (f?.state === 'FAILED') throw new Error('Google no pudo procesar ese video.')
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('El video tardó demasiado en prepararse. Prueba con uno más corto.')
}

async function borrarVideo(uri: string) {
  try {
    const nombre = uri.split('/files/')[1]
    if (nombre) await fetch(`${BASE}/v1beta/files/${nombre}?key=${GEMINI_API_KEY}`, { method: 'DELETE' })
  } catch (_) { /* si no se borra, Google lo tira solo a las 48 h */ }
}

/* Lo que se le pide mirar. La definición de open loop visual es la de Sergio: algo que aparece y
   rompe la expectativa, y hace seguir viendo aunque no diga nada. */
const INSTRUCCION = `Miras videos cortos de redes para entender qué RETIENE la atención con la imagen, no con lo que se dice.
Devuelves SOLO JSON:
{"vozCortada":[{"seg":6,"dice":"...","porque":"..."}],"correcciones":[{"antes":"...","despues":"..."}],"gancho":{"que":"...","porque":"...","seg":0},"visuales":[{"seg":7,"que":"...","porque":"...","tipo":"loop"}],"produccion":{"formato":"Dinámico","planos":"fijo","encuadres":2,"cortes":12,"planoLargo":8,"apoyo":"","graficos":"","subtitulos":{"hay":true,"estilo":"palabra a palabra","donde":"centro","pinta":"blanco con borde negro"},"color":"","luz":"","sonido":"","encuadre":"","firma":[]},"nota":"..."}

Ese orden importa: PRIMERO localizas los cortes de voz oyendo el video, y DESPUÉS corriges el texto usando esa lista. Al revés no sirve.

- LEE LOS SUBTÍTULOS de la pantalla. Casi todos estos videos los llevan quemados, y son TEXTO ESCRITO por quien hizo el video: mandan sobre lo que a ti te parezca oír. Si el subtítulo pone una palabra y la transcripción pone otra, gana el subtítulo. Si el subtítulo deja una frase a medias, es que se corta de verdad. Úsalos para todo lo de abajo.
- correcciones: los arreglos que hay que hacerle a la transcripción que te paso, uno por uno. NO devuelvas el texto entero: solo los trozos que cambian. Cada uno: antes = el trozo TAL CUAL está en la transcripción, copiado letra por letra (si no coincide exactamente, se descarta); despues = cómo debe quedar. Corto: unas pocas palabras alrededor del fallo, nunca frases enteras ni párrafos. Máximo 8. Si la transcripción está bien, correcciones = [].
  Reglas que no se saltan:
  · Solo lo que está MAL de verdad. Ni estilo, ni puntuación, ni tildes que no cambien la palabra.
  · Si una palabra está mal entendida, ponla como suena de verdad (por ejemplo «zedos» donde se dice «sesgos»).
  · NO cortes frases. Aquí solo se arreglan PALABRAS mal entendidas. De los cortes ya te encargas en vozCortada, y de meterlos en el texto se encarga otra cosa que puede comprobarlo. Si una corrección tuya acaba en «...», se tira.
  · No censures nada: si se dice una palabrota, se escribe entera.
  · Al revés también cuenta: si una frase SÍ se termina entera en el video, NO la cortes. No pongas «...» donde no hay un corte de verdad.
  · Si la transcripción ya está bien entera, devuélvela tal cual.
- gancho: qué se VE en los primeros 2 segundos, antes de que dé tiempo a entender lo que dice. que = lo que aparece en pantalla (máx. 14 palabras). porque = por qué hace parar el scroll (máx. 12 palabras).
- visuales: los momentos donde la IMAGEN hace seguir viendo. Sobre todo los OPEN LOOPS VISUALES: algo inesperado o absurdo que irrumpe y rompe la expectativa — a la persona la atropella un tren, cae un carro del cielo, un rayo parte el cielo, aparece de golpe un objeto que no pinta nada. Suelen caer justo cuando la voz deja una frase a medias, y hacen seguir viendo aunque no digan nada.
  tipo: "loop" si es una irrupción inesperada que rompe la expectativa; "apoyo" si solo ilustra lo que se dice (una captura, un gráfico, un b-roll normal); "cambio" si es solo un cambio de plano o de encuadre de la misma persona.
  seg: el segundo en que ocurre. que: qué se ve, máx. 14 palabras. porque: por qué hace seguir viendo, máx. 12 palabras.
  En «que» cuenta el MOVIMIENTO, no solo el objeto: de dónde viene y qué hace. «Cae un coche del cielo» y «aparece un coche» no son lo mismo, y la gracia está justo en cómo entra. Nunca escribas «aparece» o «surge» si la cosa cae, entra por un lado, cruza, sale despedida, se estrella o estalla: di lo que hace.
  Ordénalos por segundo. Máximo 12. Si el video no tiene ninguno, visuales = [].
- vozCortada (esto va PRIMERO, antes de corregir el texto): los momentos donde la VOZ DEJA UNA FRASE A MEDIAS y no la termina. La persona va a decir algo concreto —el dato, la clave, la palabra que promete— y justo ahí la interrumpe un corte de edición, un elemento que irrumpe, o simplemente se calla y cambia de tema. ESCUCHA el audio: cuenta lo que de verdad se oye, no lo que tendría sentido.
  Si el video lleva subtítulos, mira lo que ponen: un subtítulo que acaba a medias es la prueba más clara de un corte.
  Es un corte SOLO si se cumplen las dos cosas: (a) la frase queda COJA, le falta la palabra o el dato que iba a decir —queda colgando un artículo, una preposición, un «es esto» sin decir qué—, y (b) lo que viene después cambia de tema sin haberlo dicho nunca.
  NO son cortes, aunque haya un corte de plano o una pausa: una pregunta entera («¿Qué subo hoy?»), una frase que se termina («se va a caer»), una enumeración, ni un cambio de plano normal. Si la frase se entiende entera por sí sola, NO la pongas.
  En un video corto suele haber entre 0 y 3. Si dudas de una, déjala fuera: meter una de más estropea el análisis más que perderla.
  dice: lo que ALCANZA a decir antes de cortarse, copiado tal cual se oye y terminado en «...» (máx. 16 palabras). No lo completes NUNCA, ni aunque sea obvio cómo seguiría.
  seg: el segundo en que se corta. porque: qué lo interrumpe, máx. 10 palabras (ej.: «lo atropella un tren», «corta a otro plano»).
  Esto es importante y no se puede sacar de una transcripción: las transcripciones automáticas completan las frases cortadas por su cuenta, a veces inventando la palabra que falta. Tú lo oyes, así que márcalo.
  Ordénalos por segundo. Máximo 4. Si la voz nunca se corta, vozCortada = [].
- produccion: CÓMO está hecho. Esto se ve, no se deduce: mira el video.
  formato: cómo está grabado, uno de estos. Son formatos de producción y se distinguen mirando:
    «Dinámico» = habla a cámara cambiando de toma cada pocos segundos · «A cámara» = habla de frente, un plano o casi · «Podcast» = simula estar en uno, con micro y dos sillas o similar · «VS» = enfrenta dos cosas · «Top» = va numerando · «B-roll» = voz en off sobre escenas de apoyo, no se le ve hablando · «Entrevista random» = grabado en POV, alguien llega y pregunta · «Entrevista» = estático, aparece la mano o la persona que pregunta · «Pantalla dividida» = media pantalla con otra cosa · «Pantalla verde» = la persona recortada sobre un video de fondo · «Storytelling» = cuenta algo mientras hace una acción natural (cocinar, conducir, maquillarse).
  planos: «fijo» si la cámara no se mueve, «movimiento» si se mueve o va en la mano, «varios» si alterna.
  encuadres: cuántos encuadres DISTINTOS hay (no cortes: encuadres). Un video de un solo plano es 1.
  cortes: cuántos cortes de plano tiene en total, contados. planoLargo: cuántos segundos dura el plano más largo.
  apoyo: qué tomas de apoyo usa —b-roll, capturas de pantalla, imágenes, archivo— en máx. 10 palabras. Si no usa ninguna, "".
  graficos: qué sale sobreimpreso —texto grande, números, flechas, marcos, emojis— en máx. 10 palabras. Si no hay, "". Los subtítulos NO cuentan aquí.
  subtitulos: hay (true/false); estilo: «palabra a palabra», «por frase» o «bloques»; donde: «arriba», «centro» o «abajo»; pinta: color y acabado en máx. 8 palabras («blanco con borde negro», «amarillo resaltado»).
  color: cómo está el color, máx. 8 palabras («corregido y cálido», «plano, sin tocar», «muy saturado»).
  luz: máx. 8 palabras («luz de ventana, se le ve bien», «oscuro y con sombras duras»).
  sonido: máx. 8 palabras («música de fondo baja», «solo voz», «efectos en cada corte»).
  encuadre: dónde está la persona y cuánto aire deja, máx. 10 palabras («centrado, medio cuerpo, poco aire arriba»).
  firma: de 3 a 5 cosas que hacen reconocible este video como de esta cuenta —el sitio, la ropa, un color que se repite, el estilo de los subtítulos, un objeto—. Cada una máx. 5 palabras. Sirve para comparar unos videos con otros, así que apunta lo que se repetiría, no lo anecdótico.
- cortes: cuántos cortes de plano tiene el video en total, contados.
- nota: en una frase, cómo sostiene la atención este video con la imagen (máx. 20 palabras). Sin elogios.
Describe lo que hay, no lo que te parece bueno. En español.`

async function mirar(uri: string, tipo: string, dur: number, texto: string): Promise<any> {
  const cuerpo = {
    contents: [{
      role: 'user',
      parts: [
        { fileData: { fileUri: uri, mimeType: tipo } },
        { text: `El video dura ${dur || '?'} segundos. Analízalo entero.` +
          (texto ? `\n\nEsta es la transcripción automática que hay que corregir. Escúchala contra el audio:\n«${texto}»` : '') },
      ],
    }],
    systemInstruction: { parts: [{ text: INSTRUCCION }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 6000 },
  }
  let ultimo = ''
  for (const modelo of MODELOS) {
    const r = await fetch(`${BASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    })
    if (!r.ok) { ultimo = `${modelo}: ${r.status} ${(await r.text()).slice(0, 160)}`; console.warn('[lab-ver-video] ' + ultimo); continue }
    const j = await r.json()
    const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
    try { const o = JSON.parse(txt); if (o && typeof o === 'object') return o } catch (_) { ultimo = `${modelo}: no devolvió JSON` }
  }
  throw new Error('No se pudo analizar el video. ' + ultimo.slice(0, 120))
}

const t = (s: any, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  let uri = ''
  try {
    if (!GEMINI_API_KEY) return responder({ error: 'Falta la llave de Google (GEMINI_API_KEY) para poder ver videos.' }, 503)
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)

    const entrada = await req.formData()
    const video = entrada.get('video')
    if (!(video instanceof File)) return responder({ error: 'No llegó el video.' }, 400)
    if (video.size > TOPE) return responder({ error: 'Ese video pesa demasiado. Con el reel basta.' }, 400)
    const dur = Math.max(0, Math.round(Number(entrada.get('dur')) || 0))
    const tipo = video.type || 'video/mp4'

    const t0 = Date.now()
    uri = await subirVideo(new Uint8Array(await video.arrayBuffer()), tipo)
    const texto = t(entrada.get('texto'), 9000)
    const o = await mirar(uri, tipo, dur, texto)

    const g = o?.gancho || {}
    const visuales = (Array.isArray(o.visuales) ? o.visuales : [])
      .map((v: any) => ({
        seg: Math.max(0, Math.min(dur || 9999, Math.round(Number(v?.seg) || 0))),
        que: t(v?.que, 160), porque: t(v?.porque, 140),
        tipo: ['loop', 'apoyo', 'cambio'].includes(v?.tipo) ? v.tipo : 'apoyo',
      }))
      .filter((v: any) => v.que)
      .sort((a: any, b: any) => a.seg - b.seg)
      .slice(0, 12)

    const vozCortada = (Array.isArray(o.vozCortada) ? o.vozCortada : [])
      .map((v: any) => ({
        seg: Math.max(0, Math.min(dur || 9999, Math.round(Number(v?.seg) || 0))),
        // si se ha dejado llevar y la ha completado, al menos queda claro que estaba cortada
        dice: t(v?.dice, 200).replace(/[.…]*$/, '') + '…',
        porque: t(v?.porque, 120),
      }))
      .filter((v: any) => v.dice.length > 6)
      .sort((a: any, b: any) => a.seg - b.seg)
      .slice(0, 4)

    const FORMATOS = ['Dinámico', 'Podcast', 'VS', 'Top', 'B-roll', 'Entrevista random', 'Entrevista',
      'Pantalla dividida', 'Pantalla verde', 'Storytelling', 'A cámara']
    const pr = o?.produccion || {}
    const sub = pr?.subtitulos || {}
    const produccion = {
      formato: FORMATOS.includes(pr?.formato) ? pr.formato : '',
      planos: ['fijo', 'movimiento', 'varios'].includes(pr?.planos) ? pr.planos : '',
      encuadres: Math.max(0, Math.round(Number(pr?.encuadres) || 0)),
      cortes: Math.max(0, Math.round(Number(pr?.cortes) || Number(o?.cortes) || 0)),
      planoLargo: Math.max(0, Math.round(Number(pr?.planoLargo) || 0)),
      apoyo: t(pr?.apoyo, 90),
      graficos: t(pr?.graficos, 90),
      subtitulos: sub?.hay === true
        ? { estilo: t(sub?.estilo, 40), donde: t(sub?.donde, 20), pinta: t(sub?.pinta, 60) }
        : null,
      color: t(pr?.color, 80),
      luz: t(pr?.luz, 80),
      sonido: t(pr?.sonido, 80),
      encuadre: t(pr?.encuadre, 90),
      firma: (Array.isArray(pr?.firma) ? pr.firma : []).map((x: any) => t(x, 40)).filter(Boolean).slice(0, 5),
      // cortes por minuto: se calcula, no se pregunta
      porMinuto: dur ? Math.round(((Number(pr?.cortes) || Number(o?.cortes) || 0) / dur) * 60) : 0,
    }

    const loopsVisuales = visuales.filter((v: any) => v.tipo === 'loop')
    console.log(`[lab-ver-video] ${uid.slice(0, 8)}: ${visuales.length} momentos (${loopsVisuales.length} loops), formato ${produccion.formato || '?'}, ${produccion.cortes} cortes de ${dur || '?'} s en ${((Date.now() - t0) / 1000).toFixed(1)} s`)

    /* No se acepta el texto reescrito: se aplican UNA A UNA las correcciones que declara, y solo si
       el trozo «antes» existe de verdad en la transcripción. Aceptar el texto entero dejaba pasar
       cambios que no declaraba —cortó «se va a caer», que sí se dice— y no había forma de auditarlo.
       Así el daño queda acotado y cada cambio se le puede enseñar a quien lo usa. */
    let corregido = texto
    const correcciones: { antes: string; despues: string }[] = []
    for (const c of (Array.isArray(o.correcciones) ? o.correcciones : []).slice(0, 12)) {
      const antes = t(c?.antes, 120), despues = t(c?.despues, 120)
      if (!antes || antes === despues) continue
      if (antes.length > 90) continue                    // eso no es una corrección, es un párrafo
      /* Cortar una frase NO es cosa suya: aquí solo se arreglan palabras mal oídas. Cortó «se va a
         caer», que sí se dice, y no hay forma de comprobarlo desde aquí. Los cortes los decide
         volver a transcribir ese pedazo solo y alargado, que sí se comprueba: una frase cortada de
         verdad sigue cortada aunque el pedazo siga, y una que se termina se completa. */
      const recorta = /(\.\.\.|…)\s*$/.test(despues) &&
        antes.replace(/\s+/g, ' ').toLowerCase().startsWith(
          despues.replace(/(\.\.\.|…)\s*$/, '').replace(/\s+/g, ' ').toLowerCase().slice(0, 18))
      if (recorta) { console.warn('[lab-ver-video] corte descartado: «' + antes.slice(0, 40) + '»'); continue }
      const donde = corregido.indexOf(antes)
      if (donde < 0) { console.warn('[lab-ver-video] no estaba: «' + antes.slice(0, 40) + '»'); continue }
      // una sola vez: si el trozo aparece dos veces, cambiarlo en todas es arriesgado
      corregido = corregido.slice(0, donde) + despues + corregido.slice(donde + antes.length)
      correcciones.push({ antes, despues })
    }
    const sirve = !!texto && correcciones.length > 0

    return responder({
      texto: sirve ? corregido : '',
      correcciones,
      gancho: g?.que ? { que: t(g.que, 160), porque: t(g.porque, 140), seg: Math.max(0, Math.round(Number(g?.seg) || 0)) } : null,
      visuales,
      vozCortada,
      produccion,
      loopsVisuales: loopsVisuales.length,
      cortes: Math.max(0, Math.round(Number(o?.cortes) || 0)),
      nota: t(o?.nota, 200),
      segundos: (Date.now() - t0) / 1000,
    })
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  } finally {
    if (uri) await borrarVideo(uri)      // no dejar los videos de nadie en Google
  }
})

// lab-ver-video v1 (20-sep-2026) — lo que se VE en un video, para el Laboratorio.
// (12-oct-2026) + modo «antes» (Antes de subir): el video grabado contra su ficha, escena por escena. Ver atenderAntes().
// (14-oct-2026) + modo «antes» con «video_url», solo con la llave interna: lo usa el conector del chat (cherry-mcp).
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
/* (28-oct) «Antes de subir» se cortaba: gemini-flash-latest tardaba de 49 a 97 s con un reel de 1:29 (89 fotogramas) y a veces
   pasaba de los 150 s que aguanta el servidor. gemini-3.6-flash pensando poco tardó 7, 9 y 13 s y vio lo mismo (el gancho, las
   promesas con sus segundos, el pedido). Google a veces lo dice «muy ocupado» (503) y eso dura segundos: se le insiste una vez,
   3 s después, antes de pasar al de siempre (en la prueba el de siempre tardó 72 s). El desmontaje sigue con MODELOS hasta
   probarlo igual. */
type Conf = { modelos?: string[]; pensar?: string; usado?: { modelo: string; ms: number } }
const ANTES_GEMINI: Conf = { modelos: ['gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-flash-latest'], pensar: 'low' }
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
   análisis devuelve «el archivo no está listo» y se pierde la subida entera.
   (14-oct) También acepta el video como flujo (lo que se va bajando de un enlace) con su tamaño: así no se guarda entero en
   memoria, que con un final de 100 MB tumbaría la función. */
async function subirVideo(datos: Uint8Array | ReadableStream<Uint8Array>, tipo: string, tamano?: number): Promise<string> {
  const largo = datos instanceof Uint8Array ? datos.byteLength : Number(tamano) || 0
  const inicio = await fetch(`${BASE}/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(largo),
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
    headers: { 'Content-Length': String(largo), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
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
{"recursos":[{"cual":"marcador que se rellena","que":"5 puestos, el 1 al final","desde":2}],"vozCortada":[{"seg":6,"dice":"...","porque":"..."}],"correcciones":[{"antes":"...","despues":"..."}],"gancho":{"que":"...","porque":"...","seg":0},"visuales":[{"seg":7,"que":"...","porque":"...","tipo":"loop"}],"produccion":{"formato":"Dinámico","planos":"fijo","encuadres":2,"cortes":12,"planoLargo":8,"apoyo":"","graficos":"","subtitulos":{"hay":true,"estilo":"palabra a palabra","donde":"centro","pinta":"blanco con borde negro"},"color":"","luz":"","sonido":"","encuadre":"","firma":[],"tono":{"energia":"media","ritmo":"rápido","trato":"cercano","como":"..."},"identidad":{"letras":"...","colores":["..."],"logo":""}},"nota":"..."}

Ese orden importa: PRIMERO localizas los cortes de voz oyendo el video, y DESPUÉS corriges el texto usando esa lista. Al revés no sirve.

LO PRIMERO DE TODO, antes de escuchar nada: RECORRE EL VIDEO MIRANDO SOLO LO QUE HAY ENCIMA DE LA IMAGEN. Busca elementos que se QUEDAN en pantalla o que VUELVEN varias veces: recuadros con números, listas, barras, rótulos, contadores, marcadores. Casi todos estos videos llevan uno y es lo que más retiene. Compara el primer fotograma con el del medio y con el del final: si hay un recuadro que en el segundo 5 está vacío y en el segundo 40 está lleno, eso es un recurso y tienes que devolverlo.

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
- recursos: lo que ponen EN PANTALLA para que no te vayas. Esto es lo que más retiene y casi nadie lo mira, así que búscalo bien. Devuelve solo los que veas de verdad, con el segundo en que aparecen por primera vez (desde) y una línea de qué es en este video (que). Los que hay que reconocer, por "cual":
  "marcador que se rellena" = un recuadro, lista o columna con puestos numerados que empiezan VACÍOS y se van llenando mientras habla. Enseña cuánto falta todo el rato. En "que" di cuántos puestos son y en qué orden se llenan: si el número uno se deja para el final, dilo — eso es lo que más retiene.
  "barra de progreso" = una barra con los nombres de las secciones (gancho, cuerpo, cta) que se va marcando según avanza.
  "contador de pasos" = un rótulo tipo «paso 1 de 3» que dice cuántos quedan.
  "rótulo de sección" = el nombre de cada parte aparece grande al entrar en ella.
  "pasos tapados" = enseña que hay N cosas pero las tapa (interrogantes, tarjetas boca abajo, difuminado).
  "cuenta atrás" = un reloj o temporizador corriendo.
  "ventanas flotantes" = capturas de otros videos o fotos pegadas encima de la imagen.
  "recorte sobre color" = la persona recortada sobre un fondo liso de color que cambia por secciones.
  "ilustración" = dibujos o gráficos en lugar de metraje real para ilustrar lo que dice.
  "prueba en pantalla" = capturas de perfiles, mensajes o resultados reales, con su interfaz a la vista para que se vea que no están montados.
  "texto gigante" = una palabra suelta a pantalla casi completa en los momentos clave.
  DEVUELVE TODOS LOS QUE VEAS, no solo el más llamativo: lo normal es que un video use dos o tres a la vez (por ejemplo un marcador arriba, rótulos de sección al entrar en cada parte, y una barra abajo). Repásalos uno por uno antes de cerrar la lista.
  Si no usa ninguno, recursos = []. No inventes: si no lo ves, no está.
- produccion: CÓMO está hecho. Esto se ve, no se deduce: mira el video.
  formato: cómo está grabado, uno de estos. Son formatos de producción y se distinguen mirando:
    «Estático» = la cámara quieta y la persona habla desde el mismo sitio · «Plano fijo» = la cámara quieta y la persona se mueve: se acerca, se aleja, se sienta, se para, cambia de lugar · «Dinámico» = la CÁMARA cambia de lugar o de ángulo entre tomas, cada pocos segundos (los cortes que quitan pausas dentro de la misma toma y los acercamientos hechos en edición NO cuentan) · «Podcast» = simula estar en uno, con micro y dos sillas o similar · «VS» = enfrenta dos cosas · «Top» = va numerando · «B-roll» = voz en off sobre escenas de apoyo, no se le ve hablando · «Entrevista random» = grabado en POV, alguien llega y pregunta · «Entrevista» = estático, aparece la mano o la persona que pregunta · «Pantalla dividida» = media pantalla con otra cosa · «Pantalla verde» = la persona recortada sobre un video de fondo · «Storytelling» = cuenta algo mientras hace una acción natural (cocinar, conducir, maquillarse).
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
  tono: CÓMO HABLA quien sale o la voz en off (se oye, no se deduce del texto). energia: «alta», «media» o «baja». ritmo: «rápido», «pausado» o «variado». trato: uno de «cercano», «serio», «experto», «divertido», «inspirador», «vendedor». como: en una frase de máx. 14 palabras, cómo le habla a quien mira («de tú, con preguntas y ejemplos de su día»). Si nadie habla, tono = null.
  identidad: lo que hace reconocible la MARCA en pantalla, aparte de la firma. letras: cómo son las letras de títulos, rótulos y subtítulos, máx. 10 palabras («sin serifa, gruesas, en mayúscula»). colores: de 1 a 4 colores que se repiten en letras, fondos o gráficos, con su nombre corriente («fucsia», «azul marino», «crema»). logo: dónde y cómo sale el logo o el nombre de la marca, máx. 10 palabras; "" si no sale.
- cortes: cuántos cortes de plano tiene el video en total, contados.
- nota: en una frase, cómo sostiene la atención este video con la imagen (máx. 20 palabras). Sin elogios.
Describe lo que hay, no lo que te parece bueno. En español.`

/* (20-oct) el tono y la identidad: solo valores de las listas, y null si no queda nada */
function tonoDe(x: any) {
  if (!x || typeof x !== 'object') return null
  const de = (v: any, lista: string[]) => { const w = String(v || '').toLowerCase().trim(); return lista.includes(w) ? w : '' }
  const o = { energia: de(x.energia, ['alta', 'media', 'baja']), ritmo: de(x.ritmo, ['rápido', 'pausado', 'variado']),
    trato: de(x.trato, ['cercano', 'serio', 'experto', 'divertido', 'inspirador', 'vendedor']), como: t(x.como, 120) }
  return o.energia || o.ritmo || o.trato || o.como ? o : null
}
function identidadDe(x: any) {
  if (!x || typeof x !== 'object') return null
  const o = { letras: t(x.letras, 90), colores: (Array.isArray(x.colores) ? x.colores : []).map((c: any) => t(c, 24)).filter(Boolean).slice(0, 4), logo: t(x.logo, 90) }
  return o.letras || o.colores.length || o.logo ? o : null
}

async function mirar(uri: string, tipo: string, dur: number, texto: string): Promise<any> {
  return await pedirGemini([
    { fileData: { fileUri: uri, mimeType: tipo } },
    { text: `El video dura ${dur || '?'} segundos. Analízalo entero.` +
      (texto ? `\n\nEsta es la transcripción automática que hay que corregir. Escúchala contra el audio:\n«${texto}»` : '') },
  ], INSTRUCCION)
}

/* (12-oct) la llamada a Gemini, la misma para los dos modos: las partes (el video, o el audio y los fotogramas) + la instrucción */
/* (28-oct) conf: qué modelos y cuánto «piensa» (sin conf, MODELOS sin tocar cuánto piensa); en conf.usado queda cuál respondió y
   cuánto tardó */
async function pedirGemini(partes: any[], instruccion: string, conf: Conf = {}): Promise<any> {
  const cuerpo: any = {
    contents: [{ role: 'user', parts: partes }],
    systemInstruction: { parts: [{ text: instruccion }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 9000 },
  }
  const pensar = conf.pensar || ''
  const lista = conf.modelos?.length ? conf.modelos : MODELOS
  let ultimo = '', saturado = false
  /* Google devuelve 503 cuando el modelo está lleno, y eso es temporal: pasar al siguiente modelo
     no ayuda si están todos igual. Se da una vuelta más, esperando, antes de rendirse. */
  for (const vuelta of [0, 1]) {
    if (vuelta) {
      if (!saturado) break
      await new Promise((r) => setTimeout(r, 6000))
    }
    for (const [i, modelo] of lista.entries()) {
      if (i && lista[i - 1] === modelo) await new Promise((r) => setTimeout(r, 3000))   // el mismo otra vez: darle un respiro
      const gc = { ...cuerpo.generationConfig }
      if (pensar) gc.thinkingConfig = /2\.5/.test(modelo) ? { thinkingBudget: pensar === 'nada' ? 0 : 1024 } : { thinkingLevel: pensar === 'nada' ? 'minimal' : pensar }
      const t1 = Date.now()
      const r = await fetch(`${BASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cuerpo, generationConfig: gc }),
      })
      console.log(`[lab-ver-video] ${modelo}${pensar ? ' (piensa: ' + pensar + ')' : ''}: ${r.status} en ${((Date.now() - t1) / 1000).toFixed(1)} s`)
      conf.usado = { modelo, ms: Date.now() - t1 }
      if (!r.ok) {
        const cuerpoErr = (await r.text()).slice(0, 160)
        if (r.status === 503 || r.status === 429) saturado = true
        ultimo = `${modelo}: ${r.status} ${cuerpoErr}`
        console.warn('[lab-ver-video] ' + ultimo)
        continue
      }
      const j = await r.json()
      const fin = j?.candidates?.[0]?.finishReason
      const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
      try { const o = JSON.parse(txt); if (o && typeof o === 'object') return o } catch (_) {
        /* si se cortó por tokens, decirlo: un JSON a medias no es «no devolvió JSON» */
        ultimo = `${modelo}: ${fin === 'MAX_TOKENS' ? 'la respuesta se cortó por larga' : 'no devolvió JSON'}`
        console.warn('[lab-ver-video] ' + ultimo)
      }
    }
  }
  throw new Error(saturado
    ? 'Google tiene el modelo saturado ahora mismo. Vuelve a intentarlo en un rato.'
    : 'No se pudo analizar el video. ' + ultimo.slice(0, 120))
}

const t = (s: any, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/* ══ (12-oct) MODO «antes»: ANTES DE SUBIR (reemplaza «Auditar»; docs/LABORATORIO.md «Antes de subir») ══
   El video ya grabado contra SU ficha, escena por escena. Lo juzga Gemini OYENDO y MIRANDO, no Whisper: Whisper completa las
   frases cortadas por su cuenta y no ve lo que va sin voz (un remate escrito en pantalla, un corte a propósito).
   No llega el video: sus finales pesan 130 MB y más (el tope de aquí es 120, y uno así ya tumbó esta función por memoria).
   El navegador saca el AUDIO (WAV mono de 16 kHz, el mismo que va a Whisper: ~3 MB por minuto y medio) y un FOTOGRAMA cada
   2 s (JPEG de 320 px), y eso va directo en la petición a Gemini, sin la Files API. Recibe: «modo»=antes, «audio», «fotos»
   (JSON [{seg, b64}]), «dur», «texto» (la transcripción) y «ficha» (JSON {titulo, idea, gancho, escenas:[{n, nombre, dice, ve}]}).
   Devuelve { antes: { escenas, gancho, loops, cortes, idea, pedido, nota } }. Sin escenas (un video sin ficha) mira lo mismo
   menos la comparación escena por escena. */
const INSTRUCCION_ANTES = `Comparas un video corto YA GRABADO con su ficha (lo que su creador planeó decir y mostrar, escena por escena). Recibes el AUDIO completo del video y FOTOGRAMAS cada pocos segundos, cada uno marcado con su segundo: lo oyes entero y lo ves.
Devuelves SOLO JSON:
{"escenas":[{"n":1,"estado":"esta","seg":0,"dice":"…","enPantalla":""}],"gancho":{"seg":0,"dice":"…","esElDeLaFicha":true,"saludoAntes":false},"loops":[{"que":"…","abre":0,"cierra":0}],"cortes":[{"seg":0,"dice":"…","aProposito":false,"escena":1}],"idea":{"dicha":true,"dice":"…"},"pedido":{"hay":true,"dice":"…","comoFicha":true},"nota":"…","produccion":{"formato":"…","planos":"…","cortes":0,"subtitulos":true,"sonido":"…","graficos":"…","apoyo":"…","luz":"…"},"tema":"…","tecnico":["…"]}
Eso es solo la FORMA: los valores salen de ESTE video. Nunca copies textos, segundos ni nombres del ejemplo.

- escenas: UNA por cada escena de la ficha, con su mismo n, en orden. estado:
  "esta" = se dice lo planeado (con otras palabras de relleno da igual: lo que cuenta es que diga lo mismo);
  "distinto" = la escena está pero dice OTRA cosa, o cambia la frase clave o el sentido;
  "sinVoz" = la escena no se oye pero SÍ se VE en los fotogramas (va escrita en pantalla, o se actúa sin hablar);
  "falta" = ni se oye ni se ve. Si en su lugar aparece otra cosa en pantalla, dilo en enPantalla.
  seg = el segundo en que empieza en el video (si falta, el segundo donde debería ir). dice = lo que SE OYE de verdad en esa escena, copiado tal cual (máx. 18 palabras; si es "distinto", la frase que cambió). enPantalla = solo si es "sinVoz" o "falta": qué se ve en su lugar (máx. 14 palabras); si no, "".
  Las acotaciones entre paréntesis y los nombres de personaje en mayúsculas («EDITOR:», «RECLUTADOR:») de la ficha NO se dicen: no cuentan como texto.
- gancho: la PRIMERA frase que engancha (la primera pregunta o afirmación que se oye), NO la escena entera: si el gancho es una escena actuada de varios segundos, es solo su primera frase. seg = el segundo en que TERMINA de decirse esa frase, con decimales. dice = esa frase tal cual. esElDeLaFicha = si es la de la escena 1 de la ficha. saludoAntes = true si antes del gancho saluda o se presenta («hola», «hoy les traigo», «soy…»).
- loops: los open loops del video: algo que se promete o se deja en suspenso para más adelante («te lo muestro al final», «hay una octava cosa…»). que = de qué trata, máx. 5 palabras. abre = segundo en que se abre. cierra = segundo en que se cumple; null si no se cumple nunca. Máximo 5.
- cortes: frases que la VOZ deja a medias de verdad (OYE el audio: las transcripciones completan las frases cortadas por su cuenta). aProposito = true si la ficha pedía ese corte (lo dice su «se ve» o su nombre: «a propósito», «se corta», «frase cortada»). escena = n de la escena. Máximo 4. Si no hay, [].
- idea: dicha = si el video dice la idea de la ficha (aunque sea con otras palabras); dice = la frase donde se dice, tal cual (máx. 16 palabras).
- pedido: lo que pide al final (comentar, seguir, guardar, escribir una palabra…). hay = si pide algo; dice = el pedido tal cual (máx. 14 palabras); comoFicha = si pide lo mismo que la ficha.
- nota: una frase sobre lo más importante que cambió respecto a la ficha (máx. 20 palabras). Sin elogios.
- produccion: CÓMO está hecho (se ve en los fotogramas y se oye en el audio).
  formato: uno de «Estático» (la cámara quieta, habla desde el mismo sitio), «Plano fijo» (la cámara quieta, la persona se mueve), «Dinámico» (la cámara cambia de lugar o de ángulo entre tomas), «Podcast», «VS», «Top», «B-roll» (voz sobre escenas de apoyo), «Entrevista random», «Entrevista», «Pantalla dividida», «Pantalla verde», «Storytelling».
  planos: «fijo», «movimiento» o «varios». cortes: cuántos cortes de plano o de encuadre tiene EN TOTAL: cuenta los cambios entre fotogramas seguidos (si entre dos fotogramas cambia el plano, cuenta al menos uno) y oye el audio (los saltos donde se quitó una pausa también son cortes).
  subtitulos: true si lleva subtítulos quemados. sonido: lo que se oye además de la voz («música de fondo baja», «efectos en cada corte», «solo voz»), máx. 8 palabras. graficos: lo que sale sobreimpreso (texto grande, números, flechas, marcos), máx. 10 palabras; "" si nada (los subtítulos no cuentan). apoyo: tomas de apoyo (capturas, b-roll, imágenes), máx. 10 palabras; "" si no hay. luz: cómo está la luz, máx. 8 palabras.
- tema: de la lista TEMAS que te paso, el que mejor dice de qué trata el video, copiado tal cual. Si ninguno encaja, "".
- tecnico: solo los problemas técnicos que de verdad se notan y conviene arreglar antes de subir: la voz se oye baja, saturada o con ruido; la música tapa la voz; está muy oscuro; está desenfocado; el encuadre corta la cabeza; los subtítulos tapan la cara o se salen. Máximo 3, cada uno máx. 10 palabras. Si está bien, [].
Si la ficha viene sin escenas, escenas = [] y lo demás igual. Cuenta lo que hay, no lo que debería haber. En español.`

function aBase64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s)
}

async function mirarAntes(audio64: string, fotos: { seg: number; b64: string }[], dur: number, texto: string, ficha: any, temas: string[] = [], video?: { uri: string; tipo: string }, conf: Conf = { ...ANTES_GEMINI }): Promise<any> {
  const escenas = (Array.isArray(ficha?.escenas) ? ficha.escenas : []).slice(0, 24)
  const lineas = escenas.map((e: any) => `${e.n}. ${t(e.nombre, 60) || 'Escena ' + e.n}\n   dice: ${t(e.dice, 600) || '(nada escrito)'}\n   se ve: ${t(e.ve, 300) || '(nada escrito)'}`).join('\n')
  const pedido = `El video dura ${dur || '?'} segundos.\n\nLA FICHA de «${t(ficha?.titulo, 120) || 'este video'}»` +
    (ficha?.idea ? `\nIdea: ${t(ficha.idea, 200)}` : '') + (ficha?.gancho ? `\nGancho escogido: ${t(ficha.gancho, 160)}` : '') +
    (lineas ? `\nEscenas:\n${lineas}` : '\n(sin escenas: es un video sin ficha)') +
    (texto ? `\n\nLa transcripción automática (puede tener errores y completa las frases cortadas):\n«${texto}»` : '') +
    `\n\nTEMAS: ${temas.length ? temas.join(' · ') : '(no hay lista: tema = "")'}`
  /* (14-oct) desde el chat llega el VIDEO entero (Files API) en vez del audio y los fotogramas: lo ve y lo oye todo */
  const partes: any[] = video
    ? [{ text: 'El VIDEO completo (en vez del audio y los fotogramas sueltos: lo oyes y lo ves entero, con sus segundos):' }, { fileData: { fileUri: video.uri, mimeType: video.tipo } }]
    : [{ text: 'El AUDIO completo del video:' }, { inlineData: { mimeType: 'audio/wav', data: audio64 } }]
  if (!video) for (const f of fotos) partes.push({ text: `Fotograma del segundo ${f.seg}:` }, { inlineData: { mimeType: 'image/jpeg', data: f.b64 } })
  partes.push({ text: pedido })
  return await pedirGemini(partes, INSTRUCCION_ANTES, conf)
}

function limpiarAntes(o: any, ficha: any, dur: number, temas: string[] = []) {
  const seg = (x: any) => Math.max(0, Math.min(dur || 9999, Math.round((Number(x) || 0) * 10) / 10))
  const ns = (Array.isArray(ficha?.escenas) ? ficha.escenas : []).map((e: any) => Number(e.n)).filter((n: number) => n > 0)
  const porN: Record<number, any> = {}
  for (const e of (Array.isArray(o?.escenas) ? o.escenas : [])) porN[Number(e?.n)] = e
  const escenas = ns.map((n: number) => {
    const e = porN[n] || {}
    const estado = ['esta', 'distinto', 'sinVoz', 'falta'].includes(e?.estado) ? e.estado : 'falta'
    return { n, estado, seg: seg(e?.seg), dice: t(e?.dice, 220), enPantalla: estado === 'sinVoz' || estado === 'falta' ? t(e?.enPantalla, 160) : '' }
  })
  const g = o?.gancho || {}
  const loops = (Array.isArray(o?.loops) ? o.loops : []).map((l: any) => ({
    que: t(l?.que, 60), abre: seg(l?.abre), cierra: l?.cierra == null || l?.cierra === '' ? null : seg(l.cierra),
  })).filter((l: any) => l.que).sort((a: any, b: any) => a.abre - b.abre).slice(0, 5)
  const cortes = (Array.isArray(o?.cortes) ? o.cortes : []).map((c: any) => ({
    seg: seg(c?.seg), dice: t(c?.dice, 200).replace(/[.…]*$/, '') + '…', aProposito: c?.aProposito === true,
    escena: ns.includes(Number(c?.escena)) ? Number(c.escena) : null,
  })).filter((c: any) => c.dice.length > 4).sort((a: any, b: any) => a.seg - b.seg).slice(0, 4)
  const idea = o?.idea || {}, ped = o?.pedido || {}
  return {
    escenas,
    gancho: { seg: seg(g?.seg), dice: t(g?.dice, 200), esElDeLaFicha: g?.esElDeLaFicha === true, saludoAntes: g?.saludoAntes === true },
    loops, cortes,
    idea: { dicha: idea?.dicha === true, dice: t(idea?.dice, 200) },
    pedido: { hay: ped?.hay === true, dice: t(ped?.dice, 160), comoFicha: ped?.comoFicha === true },
    nota: t(o?.nota, 200),
    // (14-oct) lo que necesita la auditoría «¿va a funcionar?» (lab-auditar)
    produccion: limpiarProd(o?.produccion, dur),
    tema: temas.includes(t(o?.tema, 80)) ? t(o?.tema, 80) : '',
    tecnico: (Array.isArray(o?.tecnico) ? o.tecnico : []).map((x: any) => t(x, 90)).filter(Boolean).slice(0, 3),
  }
}
function limpiarProd(pr: any, dur: number) {
  const FORMATOS = ['Estático', 'Plano fijo', 'Dinámico', 'Podcast', 'VS', 'Top', 'B-roll', 'Entrevista random', 'Entrevista', 'Pantalla dividida', 'Pantalla verde', 'Storytelling']
  pr = pr || {}
  const cortes = Math.max(0, Math.round(Number(pr?.cortes) || 0))
  return {
    formato: FORMATOS.includes(pr?.formato) ? pr.formato : '',
    planos: ['fijo', 'movimiento', 'varios'].includes(pr?.planos) ? pr.planos : '',
    cortes, porMinuto: dur ? Math.round((cortes / dur) * 60) : 0,
    subtitulos: pr?.subtitulos === true, sonido: t(pr?.sonido, 80), graficos: t(pr?.graficos, 90), apoyo: t(pr?.apoyo, 90), luz: t(pr?.luz, 80),
  }
}

/* lo que acompaña al video en el modo «antes»: la ficha, los temas, la duración */
function datosAntes(entrada: FormData) {
  let ficha: any = {}, temas: string[] = []
  try { ficha = JSON.parse(String(entrada.get('ficha') || '{}')) } catch (_) { ficha = {} }
  try { temas = JSON.parse(String(entrada.get('temas') || '[]')) } catch (_) { temas = [] }
  temas = (Array.isArray(temas) ? temas : []).map((x) => t(x, 80)).filter(Boolean).slice(0, 60)
  return { ficha, temas, dur: Math.max(0, Math.round(Number(entrada.get('dur')) || 0)), texto: t(entrada.get('texto'), 9000) }
}

/* (14-oct) «Antes de subir» desde el chat: baja el video del enlace (tope 120 MB) y lo pasa por la Files API, como el
   desmontaje; al terminar lo borra de Google. Bajando y subiendo a la vez no se guarda entero en memoria. */
async function atenderAntesEnlace(vurl: string, entrada: FormData, uid: string) {
  if (!/^https:\/\//i.test(vurl)) throw new Error('El enlace del video tiene que empezar por https://')
  const { ficha, temas, dur, texto } = datosAntes(entrada)
  const t0 = Date.now()
  const r = await fetch(vurl)
  if (!r.ok || !r.body) throw new Error(`No pude bajar el video (${r.status}).`)
  const tamano = Number(r.headers.get('content-length')) || 0
  if (!tamano) { await r.body.cancel(); throw new Error('Ese enlace no dice cuánto pesa el video: no lo puedo pasar.') }
  if (tamano > TOPE) { await r.body.cancel(); throw new Error('Ese video pesa más de 120 MB. Con el reel basta.') }
  let tipo = (r.headers.get('content-type') || '').split(';')[0].trim()
  if (!/^video\//.test(tipo)) tipo = 'video/mp4'
  let uri = ''
  try {
    uri = await subirVideo(r.body, tipo, tamano)
    const antes = limpiarAntes(await mirarAntes('', [], dur, texto, ficha, temas, { uri, tipo }), ficha, dur, temas)
    console.log(`[lab-ver-video] antes (enlace) ${uid.slice(0, 8)}: ${antes.escenas.length} escenas, ${antes.escenas.filter((e: any) => e.estado !== 'esta').length} distintas o sin estar, ${(tamano / 1048576).toFixed(0)} MB, en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    return { antes, segundos: (Date.now() - t0) / 1000 }
  } finally {
    if (uri) await borrarVideo(uri)      // no dejar los videos de nadie en Google
  }
}

/* el pedido entero del modo «antes»: valida lo que llega, pregunta y limpia */
async function atenderAntes(entrada: FormData, uid: string) {
  /* (14-oct) desde el chat (cherry-mcp): llega «video_url» y el video se baja aquí. Solo con la llave interna: abierto a
     cualquiera, esta función bajaría lo que le pidan. */
  const vurl = String(entrada.get('video_url') || '').trim()
  if (vurl) {
    if (uid !== 'interno') throw new Error('Desde la página se manda el audio, no un enlace.')
    return await atenderAntesEnlace(vurl, entrada, uid)
  }
  /* el audio llega ya en base64 desde el navegador («audio64»): pasarlo aquí costaba CPU y a veces tumbaba la función
     (WORKER_RESOURCE_LIMIT, 1 de 3 pruebas). Si llega como archivo («audio»), se pasa aquí. */
  let audio64 = ''
  const a64 = entrada.get('audio64')
  if (typeof a64 === 'string' && a64.length > 2000) audio64 = a64
  else {
    const audio = entrada.get('audio')
    if (audio instanceof File && audio.size >= 2000) audio64 = aBase64(new Uint8Array(await audio.arrayBuffer()))
  }
  if (!audio64) throw new Error('No llegó el audio del video.')
  if (audio64.length > 19 * 1024 * 1024) throw new Error('El video es demasiado largo para revisarlo: con el reel basta.')
  let fotos: { seg: number; b64: string }[] = [], ficha: any = {}
  try { fotos = JSON.parse(String(entrada.get('fotos') || '[]')) } catch (_) { fotos = [] }
  try { ficha = JSON.parse(String(entrada.get('ficha') || '{}')) } catch (_) { ficha = {} }
  let temas: string[] = []
  try { temas = JSON.parse(String(entrada.get('temas') || '[]')) } catch (_) { temas = [] }
  temas = (Array.isArray(temas) ? temas : []).map((x) => t(x, 80)).filter(Boolean).slice(0, 60)
  fotos = (Array.isArray(fotos) ? fotos : []).filter((f) => f && typeof f.b64 === 'string' && f.b64.length < 400000)
    .map((f) => ({ seg: Math.max(0, Math.round((Number(f.seg) || 0) * 10) / 10), b64: f.b64 })).slice(0, 130)   // (14-oct) uno por segundo: con uno cada 2 s se escapaban cortes
  const dur = Math.max(0, Math.round(Number(entrada.get('dur')) || 0))
  /* (28-oct) ENSAYO, para medir (lab-ver-video-prueba, solo la llave interna): otros modelos, cuánto piensa, uno de cada N fotogramas */
  let conf: Conf = { ...ANTES_GEMINI }, ensayo = false
  if (uid === 'interno' && entrada.get('ensayo')) {
    try { const e = JSON.parse(String(entrada.get('ensayo'))); if (e && typeof e === 'object') { conf = e; ensayo = true } } catch (_) { /* sin ensayo */ }
    const cada = Number((conf as any).cada) || 1
    if (cada > 1) fotos = fotos.filter((_f, i) => i % cada === 0)
  }
  const t0 = Date.now()
  const antes = limpiarAntes(await mirarAntes(audio64, fotos, dur, t(entrada.get('texto'), 9000), ficha, temas, undefined, conf), ficha, dur, temas)
  console.log(`[lab-ver-video] antes ${uid.slice(0, 8)}: ${antes.escenas.length} escenas, ${antes.escenas.filter((e: any) => e.estado !== 'esta').length} distintas o sin estar, ${fotos.length} fotogramas, en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  return { antes, segundos: (Date.now() - t0) / 1000, ...(ensayo ? { ensayo: { ...conf.usado, fotos: fotos.length } } : {}) }
}

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
    /* (12-oct) Antes de subir: llegan el audio y los fotogramas, no el video */
    if (String(entrada.get('modo') || '') === 'antes') return responder(await atenderAntes(entrada, uid))
    const video = entrada.get('video')
    if (!(video instanceof File)) return responder({ error: 'No llegó el video.' }, 400)
    if (video.size > TOPE) return responder({ error: 'Ese video pesa demasiado. Con el reel basta.' }, 400)
    const dur = Math.max(0, Math.round(Number(entrada.get('dur')) || 0))
    const tipo = video.type || 'video/mp4'

    const t0 = Date.now()
    uri = await subirVideo(new Uint8Array(await video.arrayBuffer()), tipo)
    const texto = t(entrada.get('texto'), 9000)
    const o = await mirar(uri, tipo, dur, texto)

    /* Lista cerrada: un recurso con nombre libre no se podría comparar entre videos, que es justo
       para lo que sirve tenerlos. */
    const RECURSOS = ['marcador que se rellena', 'barra de progreso', 'contador de pasos',
      'rótulo de sección', 'pasos tapados', 'cuenta atrás', 'ventanas flotantes', 'recorte sobre color',
      'ilustración', 'prueba en pantalla', 'texto gigante']
    const recursos = (Array.isArray(o?.recursos) ? o.recursos : [])
      .map((r: any) => ({
        cual: RECURSOS.includes(String(r?.cual || '').toLowerCase().trim())
          ? String(r.cual).toLowerCase().trim() : '',
        que: t(r?.que, 140),
        desde: Math.max(0, Math.min(dur || 9999, Math.round(Number(r?.desde) || 0))),
      }))
      .filter((r: any) => r.cual)
      .slice(0, 8)

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

    // (29-sep) los de Sergio: «A cámara» pasó a «Estático» y entró «Plano fijo» (docs/CRITERIO-SERGIO.md)
    const FORMATOS = ['Estático', 'Plano fijo', 'Dinámico', 'Podcast', 'VS', 'Top', 'B-roll', 'Entrevista random', 'Entrevista',
      'Pantalla dividida', 'Pantalla verde', 'Storytelling']
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
      // (20-oct) cómo habla y cómo se ve la marca («Cherry ve todos tus videos»); null si no lo trae
      tono: tonoDe(pr?.tono),
      identidad: identidadDe(pr?.identidad),
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
      recursos,                 // lo que ponen en pantalla para que no te vayas
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

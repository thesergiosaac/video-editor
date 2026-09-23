/* broll v1 — videos de escenas con la voz grabada aparte (23-sep-2026)
 *
 * Sergio: «Cherry ya construye guiones donde cada escena tiene lo que dice y lo que pasa. Lo
 * único que habría sería una opción de B-roll: escoger uno de los guiones que ya tenemos, y
 * Cherry nos dice qué video va en cada escena. Y listo, el guion ya sabe que en esa parte va
 * esa voz».
 *
 * Dos modos:
 *
 *   «guiones»  · los guiones del Laboratorio de quien llama, con sus escenas.
 *   «repartir» · dada una grabación de voz ya transcrita y un guion, en qué segundo empieza y
 *                acaba cada escena.
 *
 * ── Cómo se reparte la voz ──────────────────────────────────────────────────────────────
 * Hay dos textos que dicen lo mismo: lo que él escribió en cada escena y lo que Whisper oyó.
 * Se normalizan (sin tildes, sin signos, en minúsculas) y se alinean con la subsecuencia común
 * más larga, que es lo mismo que hace un `diff`.
 *
 * ⚠️ NO hace falta que cuadren todas las palabras: solo hay que encontrar LA FRONTERA entre una
 * escena y la siguiente. Medido contra su video real del 23-sep: 266 de 279 palabras (95 %), las
 * 8 escenas habladas localizadas, ninguna por debajo del 90 %, y las ventanas salieron pegadas
 * sin solaparse. Por eso aguanta que Whisper se invente una palabra, que ya sabemos que lo hace
 * donde el audio se corta.
 *
 * ⚠️ UNA ESCENA VISUAL NO TIENE VOZ, así que no tiene ventana propia. Se marca `encima: true` y
 * el montaje la pone SOBRE la escena de al lado, sin mover la voz ni un milisegundo. Darle
 * segundos propios desincronizaría todo lo que viene después — en el guion real de Sergio entre
 * su gancho y su conector hay 0,26 s, así que no hay sitio de donde sacarlos.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

/* Quién llama sale del token de la sesión, nunca del cuerpo: un id que manda el navegador es un
   id que el navegador puede cambiar, y aquí se leen los guiones de alguien. */
async function quienLlama(req: Request): Promise<string> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('Entra otra vez: se perdió la sesión.')
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error('Entra otra vez: se perdió la sesión.')
  const u = await r.json()
  if (!u?.id) throw new Error('Entra otra vez: se perdió la sesión.')
  return u.id as string
}

async function tabla(ruta: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

/* ── El documento del Laboratorio ────────────────────────────────────────────────────────── */
async function guionesDe(user: string) {
  const filas = await tabla(
    `herramientas_datos?user_id=eq.${user}&herramienta=eq.laboratorio&select=datos`)
  const doc = Array.isArray(filas) && filas[0] ? filas[0].datos : null
  const planes = doc && Array.isArray(doc.planes) ? doc.planes : []

  return planes.map((p: any) => {
    const g = Array.isArray(p.guion) ? p.guion : []
    return {
      id: p.id,
      titulo: p.titulo || 'Sin título',
      cuenta: p.cuenta || null,
      escenas: g.map((x: any, i: number) => ({
        n: i,
        nombre: x.escena || '',
        /* Una escena «visual» no se habla: no va a tener ventana propia. */
        visual: String(x.clase || '') === 'visual' || !String(x.dice || '').trim(),
        dice: x.dice || '',
        ve: x.ve || '',
        vineta: x.vineta || null,
      })),
    }
  })
}

/* ── Alinear ─────────────────────────────────────────────────────────────────────────────── */

/* Sin tildes, sin signos y en minúsculas: así «Día» y «dia» son la misma palabra. */
function llana(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9ñ]/g, '')
}

/* La subsecuencia común más larga, devolviendo las PAREJAS (i en A, j en B) en orden.
   279 x 283 son ~79.000 casillas: se resuelve de sobra sin trucos. */
function parejas(A: string[], B: string[]): Array<[number, number]> {
  const n = A.length, m = B.length
  const tabla: Uint32Array[] = []
  for (let i = 0; i <= n; i++) tabla.push(new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tabla[i][j] = A[i] === B[j]
        ? tabla[i + 1][j + 1] + 1
        : Math.max(tabla[i + 1][j], tabla[i][j + 1])
    }
  }
  const fuera: Array<[number, number]> = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) { fuera.push([i, j]); i++; j++ }
    else if (tabla[i + 1][j] >= tabla[i][j + 1]) i++
    else j++
  }
  return fuera
}

/* ── Repartir ────────────────────────────────────────────────────────────────────────────── */
async function repartir(b: any, user: string) {
  const fichaId = String(b?.ficha_id || '')
  const clipId = String(b?.clip_id || '')
  if (!fichaId || !clipId) throw new Error('Falta el guion o la grabación.')

  /* El clip tiene que ser de un proyecto suyo: si no, cualquiera podría leer transcripciones
     ajenas pasando un id. */
  const clips = await tabla(`clips?id=eq.${clipId}&user_id=eq.${user}&select=id`)
  if (!Array.isArray(clips) || !clips.length) throw new Error('Esa grabación no es tuya.')

  const guiones = await guionesDe(user)
  const guion = guiones.filter((g: any) => g.id === fichaId)[0]
  if (!guion) throw new Error('No encuentro ese guion.')

  const tr = await tabla(`transcriptions?clip_id=eq.${clipId}&select=words&limit=1`)
  const crudas = Array.isArray(tr) && tr[0] ? tr[0].words : null
  if (!Array.isArray(crudas) || !crudas.length) {
    throw new Error('Esa grabación todavía no está transcrita. Espera a que acabe y vuelve.')
  }

  const oido = crudas
    .map((w: any) => ({
      txt: String(w.word ?? w.text ?? '').trim(),
      ini: Number(w.start) || 0,
      fin: Number(w.end) || 0,
    }))
    .map((w: any) => ({ ...w, ll: llana(w.txt) }))
    .filter((w: any) => w.ll)

  /* Cada palabra del guion, sabiendo de qué escena viene. */
  const escrito: Array<{ ll: string; escena: number }> = []
  for (const e of guion.escenas) {
    if (e.visual) continue
    for (const t of String(e.dice).split(/\s+/)) {
      const ll = llana(t)
      if (ll) escrito.push({ ll, escena: e.n })
    }
  }
  if (!escrito.length) throw new Error('Ese guion no tiene nada escrito en «lo que dices».')

  const pares = parejas(escrito.map((x) => x.ll), oido.map((w: any) => w.ll))

  /* Dónde cayó cada escena */
  const caen = new Map<number, number[]>()
  for (const [a, bb] of pares) {
    const e = escrito[a].escena
    if (!caen.has(e)) caen.set(e, [])
    caen.get(e)!.push(bb)
  }

  const cuantasTiene = new Map<number, number>()
  for (const x of escrito) cuantasTiene.set(x.escena, (cuantasTiene.get(x.escena) || 0) + 1)

  const ventanas = guion.escenas.map((e: any) => {
    if (e.visual) {
      /* ⚠️ Sin voz no hay ventana. El montaje la pone ENCIMA de la de al lado, sin mover nada. */
      return { n: e.n, nombre: e.nombre, visual: true, encima: true,
               ini: null, fin: null, casadas: 0, total: 0, confianza: null }
    }
    const suyas = (caen.get(e.n) || []).sort((x, y) => x - y)
    const total = cuantasTiene.get(e.n) || 0
    if (!suyas.length) {
      return { n: e.n, nombre: e.nombre, visual: false, encima: false,
               ini: null, fin: null, casadas: 0, total, confianza: 0 }
    }
    return {
      n: e.n, nombre: e.nombre, visual: false, encima: false,
      ini: Number(oido[suyas[0]].ini.toFixed(3)),
      fin: Number(oido[suyas[suyas.length - 1]].fin.toFixed(3)),
      casadas: suyas.length, total,
      confianza: Math.round((100 * suyas.length) / Math.max(1, total)),
    }
  })

  /* Si el reparto sale flojo se dice, en vez de montar un video con las imágenes cambiadas de
     sitio: eso es peor que no montarlo. */
  const habladas = ventanas.filter((v: any) => !v.visual)
  const malas = habladas.filter((v: any) => (v.confianza ?? 0) < 40)
  const global = Math.round((100 * pares.length) / Math.max(1, escrito.length))

  return {
    guion: { id: guion.id, titulo: guion.titulo },
    total_s: oido.length ? Number(oido[oido.length - 1].fin.toFixed(3)) : 0,
    palabras: { oidas: oido.length, escritas: escrito.length, casadas: pares.length },
    confianza: global,
    sirve: global >= 55 && malas.length === 0,
    flojas: malas.map((v: any) => v.nombre || `escena ${v.n + 1}`),
    ventanas,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json()
    const user = await quienLlama(req)
    if (b?.modo === 'guiones') return json({ guiones: await guionesDe(user) })
    if (b?.modo === 'repartir') return json(await repartir(b, user))
    return json({ error: 'Modo desconocido.' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400)
  }
})

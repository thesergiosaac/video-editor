// lab-leer-metricas v1 (20-sep-2026) — lee las capturas de estadísticas de un video.
//
// Provisional a propósito: cuando estén los permisos de Meta, los números vendrán de la API de
// Insights y esto sobrará. Mientras tanto, escribirlos a mano era el paso que frenaba todo el
// Laboratorio, porque sin números no hay embudo.
//
// Se le pueden soltar VARIAS capturas del mismo video (casi nunca cabe todo en una pantalla) y se
// leen juntas como si fueran una sola.
//
// Lo que más vale no son las visitas: es la CURVA DE RETENCIÓN. Si la captura la trae, se leen sus
// puntos y el segundo donde se cae — eso es lo que dice DÓNDE falló, no solo que falló.
//
// Recibe: multipart/form-data con una o varias «captura».
// Devuelve: { titulo, fecha, plataforma, visitas, alcance, tiempoMedio, retencion, omisiones, caida,
//             curva[], meGusta, comentarios, reposts, enviados, guardados, seguidores, origenes[],
//             dur, leido[], dudas[] }

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const BASE = 'https://generativelanguage.googleapis.com'
const MODELOS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
const TOPE = 12 * 1024 * 1024          // por captura

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

const INSTRUCCION = `Lees capturas de pantalla de las estadísticas de un video de redes (Instagram, TikTok, YouTube, Facebook) y sacas los números. Pueden venir VARIAS capturas del mismo video: léelas todas juntas, como si fueran una sola pantalla.
Devuelves SOLO JSON:
{"plataforma":"instagram","titulo":"","fecha":null,"dur":null,"visitas":492264,"alcance":358391,"tiempoMedio":26,"retencion":null,"omisiones":31.8,"caida":null,"curva":[],"meGusta":16200,"comentarios":243,"reposts":838,"enviados":3900,"guardados":9600,"seguidores":546,"origenes":[{"de":"Reels","pct":52.9}],"leido":["visualizaciones","tiempo promedio"],"dudas":[]}

REGLA QUE MANDA SOBRE TODO: copia lo que VES. Si un dato no aparece en las capturas, déjalo en null. NUNCA lo calcules, lo estimes ni lo deduzcas de otro: un número inventado aquí estropea todo el análisis, y es peor que no tenerlo.

- plataforma: instagram, tiktok, youtube, facebook, o "" si no se distingue.
- titulo: el del video si se ve; si no, "".
- fecha: cuándo se publicó, en formato 2026-09-12, si aparece. Si solo dice «hace 3 días» u otra cosa relativa, déjalo en null.
- dur: cuánto dura el video en segundos, si aparece.
Los nombres que usa cada plataforma, para que no te pierdas:
- Instagram: «Visualizaciones» (visitas), «Cuentas alcanzadas» (alcance), «Tiempo promedio de reproducción» en segundos (tiempoMedio), «Nuevos seguidores», «Porcentaje de omisiones» (omisiones: cuánta gente se lo salta), y los porcentajes de Me gusta / contenido guardado / reposts / comentarios. Los iconos de arriba son, en orden: corazón = meGusta, bocadillo = comentarios, flechas en círculo = reposts, avión = enviados, marcador = guardados. La gráfica se llama «Durante cuánto tiempo las personas vieron tu reel»: si pone «No hay datos disponibles», curva = [] y caida = null.
- TikTok: «Reproducciones», «Tiempo medio de reproducción», «Porcentaje de visualización completa», «Retención de la audiencia» (esa es la gráfica).
- YouTube: «Visualizaciones», «Duración media de la reproducción», «Porcentaje medio visto», «Retención de la audiencia».

- visitas: reproducciones o visualizaciones. Cuidado con los miles: «10,4 mil» son 10400 y «1,2 M» son 1200000. Si ves el número exacto en algún sitio, ese manda.
- alcance: cuentas o personas distintas que lo vieron. Instagram lo llama «Cuentas alcanzadas» o «Espectadores», según la versión: las dos valen.
- tiempoMedio: el tiempo medio de reproducción EN SEGUNDOS, tal cual lo dice («26 s» → 26). Si lo da en formato 0:26, son 26 segundos.
- retencion: el porcentaje medio visto, SOLO si la captura lo da hecho como porcentaje. Si solo hay tiempo medio en segundos, déjalo en null y pon tiempoMedio: la cuenta se hace fuera, donde sí se sabe cuánto dura el video.
- omisiones: el «porcentaje de omisiones» de Instagram, si aparece (cuánta gente se lo saltó). Con decimales si los tiene.
- curva y caida: SOLO de la GRÁFICA DE RETENCIÓN. Es lo más valioso de todo, y hay que tener cuidado porque en las estadísticas de Instagram salen DOS gráficas parecidas y solo una sirve:
  ✗ «Visualizaciones en el tiempo»: el eje de abajo va en HORAS o días desde que se publicó (0, 4h, 8h) y la línea SUBE. Esa NO es retención: es cuánta gente lo fue viendo con el paso de las horas. IGNÓRALA por completo.
  ✓ «Durante cuánto tiempo las personas vieron tu reel» (TikTok: «Retención de la audiencia»): el eje de abajo va en SEGUNDOS o minutos del video (0:00 a 0:50) y la línea BAJA, empezando en 100%. Esa es.
  La regla para no equivocarse: si el eje de abajo está en horas o la línea sube, no es. Si está en segundos del video y baja desde 100%, sí.
  curva: de 5 a 12 puntos de ESA gráfica, {seg, pct}, empezando por {0, 100}. Mira dónde está la línea de verdad en cada punto, no te lo imagines.
  caida: el segundo donde la línea SE DESPLOMA —cae en vertical—, no donde va bajando poco a poco. En muchos reels es en los primeros segundos. Si baja suave y sin escalón, caida = null.
  Si no aparece esa gráfica, o pone «No hay datos disponibles», curva = [] y caida = null.
- meGusta, comentarios, reposts, enviados, guardados, seguidores: tal como aparezcan. Ojo con los miles: «16,2 mil» son 16200 y «3,9 mil» son 3900. reposts y enviados son cosas distintas (las flechas en círculo y el avión): no los juntes.
- origenes: de dónde llegaron las visualizaciones, si aparece la lista («Pestaña Reels 52,9%», «Feed 36,4%»...). Hasta 6, {de, pct}. Si no aparece, [].
- leido: los nombres de los datos que de verdad viste, para saber qué salió de la captura y qué no.
- dudas: cualquier cosa que no hayas podido leer bien o que te haya parecido ambigua, en español y en una línea cada una. Máximo 3. Si está todo claro, [].

En español.`

async function mirar(partes: any[]): Promise<any> {
  const cuerpo = {
    contents: [{ role: 'user', parts: [...partes, { text: 'Saca los números de estas capturas.' }] }],
    systemInstruction: { parts: [{ text: INSTRUCCION }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 3000 },
  }
  let ultimo = ''
  for (const modelo of MODELOS) {
    const r = await fetch(`${BASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    })
    if (!r.ok) { ultimo = `${modelo}: ${r.status} ${(await r.text()).slice(0, 150)}`; console.warn('[lab-leer-metricas] ' + ultimo); continue }
    const j = await r.json()
    const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
    try { const o = JSON.parse(txt); if (o && typeof o === 'object') return o } catch (_) { ultimo = `${modelo}: no devolvió JSON` }
  }
  throw new Error('No se pudo leer la captura. ' + ultimo.slice(0, 120))
}

const t = (s: any, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
/* null cuando no está, no 0: un 0 se confunde con «lo leí y era cero» y aquí eso importa. */
/* con decimales, para los porcentajes: «31,8%» no es «32%» */
const dec = (v: any, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return n >= min && n <= max ? Math.round(n * 10) / 10 : null
}
const num = (v: any, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null   // Number(null) es 0, y un 0 aquí miente
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n >= min && n <= max ? Math.round(n) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    if (!GEMINI_API_KEY) return responder({ error: 'Falta la llave de Google para poder leer capturas.' }, 503)
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)

    const entrada = await req.formData()
    const fotos = entrada.getAll('captura').filter((f): f is File => f instanceof File).slice(0, 5)
    if (!fotos.length) return responder({ error: 'No llegó ninguna captura.' }, 400)

    const partes: any[] = []
    for (const foto of fotos) {
      if (foto.size > TOPE) return responder({ error: 'Alguna captura pesa demasiado.' }, 400)
      const bytes = new Uint8Array(await foto.arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
      partes.push({ inlineData: { mimeType: foto.type || 'image/png', data: btoa(bin) } })
    }

    const t0 = Date.now()
    const o = await mirar(partes)

    const curva = (Array.isArray(o.curva) ? o.curva : [])
      .map((p: any) => ({ seg: num(p?.seg, 0, 36000), pct: num(p?.pct, 0, 100) }))
      .filter((p: any) => p.seg !== null && p.pct !== null)
      .sort((a: any, b: any) => a.seg - b.seg)
      .slice(0, 14)

    const salida = {
      plataforma: t(o.plataforma, 20).toLowerCase(),
      titulo: t(o.titulo, 120),
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(o.fecha || '')) ? String(o.fecha) : '',
      dur: num(o.dur, 1, 36000),
      visitas: num(o.visitas, 0, 1e10),
      alcance: num(o.alcance, 0, 1e10),
      tiempoMedio: num(o.tiempoMedio, 0, 36000),
      retencion: num(o.retencion, 0, 100),
      omisiones: dec(o.omisiones, 0, 100),
      caida: num(o.caida, 0, 36000),
      curva,
      meGusta: num(o.meGusta, 0, 1e9),
      comentarios: num(o.comentarios, 0, 1e9),
      reposts: num(o.reposts, 0, 1e9),
      enviados: num(o.enviados, 0, 1e9),
      guardados: num(o.guardados, 0, 1e9),
      seguidores: num(o.seguidores, 0, 1e9),
      origenes: (Array.isArray(o.origenes) ? o.origenes : [])
        .map((x: any) => ({ de: t(x?.de, 40), pct: dec(x?.pct, 0, 100) }))
        .filter((x: any) => x.de && x.pct !== null).slice(0, 6),
      leido: (Array.isArray(o.leido) ? o.leido : []).map((x: any) => t(x, 40)).filter(Boolean).slice(0, 12),
      dudas: (Array.isArray(o.dudas) ? o.dudas : []).map((x: any) => t(x, 160)).filter(Boolean).slice(0, 3),
      capturas: fotos.length,
      segundos: (Date.now() - t0) / 1000,
    }
    console.log(`[lab-leer-metricas] ${uid.slice(0, 8)}: ${fotos.length} captura(s), leyó ${salida.leido.length} datos${curva.length ? ' + curva de ' + curva.length + ' puntos' : ''} en ${salida.segundos.toFixed(1)} s`)
    return responder(salida)
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

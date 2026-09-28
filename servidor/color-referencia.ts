// color-referencia v1 (28-sep-2026) — la IA mira la imagen de referencia del color (fase 3 del color).
//
// Sergio escogió «color por referencia»: sube una foto o un video cuyo color le guste y Cherry lleva sus tomas a ese
// color. La receta la calcula la página midiendo la imagen objeto por objeto (motor-color.js › recetaDeReferencia),
// igual que se hizo a mano con Cherry Gold. Lo que la medida no sabe hacer sola es lo que aquí hace Gemini:
//   1 · marcar lo que NO es escena y no se debe medir: texto encima, logos, calcomanías, la interfaz de una app, barras
//       negras o de color. Con Cherry Gold hubo que taparlo a mano: el verde neón de un ícono desviaba toda la medida.
//   2 · decir en palabras qué color tiene la imagen, para mostrárselo a la persona.
//
// Recibe: { imagenes: ['data:image/jpeg;base64,…', …] } (hasta 4, ≤ 1024 px). Devuelve:
//   { imagenes: [{ excluir: [[ymin, xmin, ymax, xmax], …] }], persona: bool, descripcion: '…' } (cajas en 0–1000)

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

const INSTRUCCION = `Eres colorista de cine. Te muestran una o varias imágenes que alguien escogió como referencia del COLOR que quiere para sus videos.

Devuelve SOLO un JSON con esta forma:
{"imagenes":[{"excluir":[[ymin,xmin,ymax,xmax]]}],"persona":true,"descripcion":"..."}

- "imagenes": una entrada por imagen, en el mismo orden.
- "excluir": cajas (coordenadas de 0 a 1000) de todo lo que NO es la escena grabada y por eso no debe medirse para sacar el color: texto o subtítulos puestos encima, logos, marcas de agua, calcomanías, emojis, íconos, la interfaz de una app (barras, botones, contadores de likes), marcos, franjas o barras de color o negras. NO excluyas objetos reales de la escena aunque tengan colores fuertes (una gorra roja, una pantalla, una lámpara). Si no hay nada que excluir, lista vacía.
- "persona": true si en la escena se ve la piel de una persona (cara, brazos o manos).
- "descripcion": en español de Colombia, máximo 140 caracteres, qué color tiene la imagen dicho para alguien que no es colorista. Habla de la luz, las sombras, los negros, la piel y el color que domina. Ejemplo: "Luz ámbar cálida, sombras profundas con un toque ciruela, piel natural y poco saturada, blancos que no llegan a quemarse".`

function limpiarCaja(c: any): number[] | null {
  if (!Array.isArray(c) || c.length !== 4) return null
  const v = c.map((x: any) => Math.max(0, Math.min(1000, Math.round(Number(x) || 0))))
  if (v[2] <= v[0] || v[3] <= v[1]) return null
  return v
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    if (!GEMINI_API_KEY) return responder({ error: 'Falta la llave de Google (GEMINI_API_KEY).' }, 503)
    const uid = await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)
    const b = await req.json().catch(() => null)
    const imgs = (Array.isArray(b?.imagenes) ? b.imagenes : []).filter((x: any) => typeof x === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(x)).slice(0, 4)
    if (!imgs.length) return responder({ error: 'No llegó ninguna imagen.' }, 400)
    if (imgs.some((x: string) => x.length > 2_000_000)) return responder({ error: 'La imagen pesa demasiado.' }, 400)

    const partes: any[] = []
    imgs.forEach((x: string, i: number) => {
      const m = x.match(/^data:(image\/[a-z]+);base64,(.*)$/)
      partes.push({ text: `Imagen ${i + 1}:` })
      partes.push({ inline_data: { mime_type: m![1], data: m![2] } })
    })
    const cuerpo = {
      contents: [{ role: 'user', parts: partes }],
      systemInstruction: { parts: [{ text: INSTRUCCION }] },
      generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 2000 },
    }
    let o: any = null, ultimo = ''
    for (const vuelta of [0, 1]) {
      if (vuelta) await new Promise((r) => setTimeout(r, 4000))
      for (const modelo of MODELOS) {
        const r = await fetch(`${BASE}/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        })
        if (!r.ok) { ultimo = `${modelo}: ${r.status} ${(await r.text()).slice(0, 140)}`; console.warn('[color-referencia] ' + ultimo); continue }
        const j = await r.json()
        const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? ''
        try { o = JSON.parse(txt); break } catch (_) { ultimo = `${modelo}: no devolvió JSON` }
      }
      if (o) break
    }
    if (!o) return responder({ error: 'No se pudo mirar la referencia ahora. ' + ultimo.slice(0, 100) }, 502)

    const salida = imgs.map((_: string, i: number) => {
      const e = Array.isArray(o?.imagenes?.[i]?.excluir) ? o.imagenes[i].excluir : []
      return { excluir: e.map(limpiarCaja).filter(Boolean).slice(0, 12) }
    })
    return responder({
      imagenes: salida,
      persona: o?.persona === true,
      descripcion: String(o?.descripcion ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
    })
  } catch (e) {
    console.error('[color-referencia]', e)
    return responder({ error: 'Algo falló mirando la referencia.' }, 500)
  }
})

// nano-prueba — TEMPORAL (29-oct-2026): prueba de calidad y COSTO REAL de Nano Banana para la Cámara viva.
// Usa la llave de Google que Cherry ya tiene guardada (GEMINI_API_KEY, la de pago): nadie la copia a ningún computador.
// Solo responde a quien trae su contraseña de un solo uso (la pone el programa que la despliega; aquí queda el hueco):
// un usuario de Cherry no puede llamarla ni gastar con ella.
//   { accion: 'modelos' }                                   → los modelos de imagen que esa llave puede usar
//   { modelo, texto, imagenes?: [{ mime, datos }], aspecto?, tam? } → una imagen (base64) + lo que Google cobró (usageMetadata)
const GEMINI = Deno.env.get('GEMINI_API_KEY') ?? ''
const CLAVE = '__CLAVE_PRUEBA__'
const API = 'https://generativelanguage.googleapis.com/v1beta'

Deno.serve(async (req: Request) => {
  if (CLAVE.startsWith('__') || (req.headers.get('x-prueba') ?? '') !== CLAVE) return new Response('no', { status: 401 })
  try {
    const b = await req.json()
    if (b.accion === 'modelos') {
      const r = await fetch(`${API}/models?pageSize=300`, { headers: { 'x-goog-api-key': GEMINI } })
      const d = await r.json()
      const lista = (d.models || []).filter((m: any) => /image/i.test(m.name) || /banana/i.test(m.displayName || ''))
        .map((m: any) => ({ nombre: m.name, visible: m.displayName, metodos: m.supportedGenerationMethods }))
      return Response.json({ ok: r.ok, lista, error: r.ok ? undefined : d.error })
    }
    const partes = [{ text: String(b.texto || '') },
      ...((b.imagenes || []) as any[]).map((i) => ({ inline_data: { mime_type: i.mime, data: i.datos } }))]
    const config: Record<string, unknown> = { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: b.aspecto || '9:16', ...(b.tam ? { imageSize: b.tam } : {}) } }
    const t0 = Date.now()
    const r = await fetch(`${API}/models/${b.modelo}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI },
      body: JSON.stringify({ contents: [{ role: 'user', parts: partes }], generationConfig: config }),
    })
    const d = await r.json()
    const parte = (d?.candidates?.[0]?.content?.parts || []).find((p: any) => p.inlineData || p.inline_data)
    const img = parte ? (parte.inlineData || parte.inline_data) : null
    return Response.json({ ok: r.ok && !!img, status: r.status, ms: Date.now() - t0, uso: d.usageMetadata ?? null,
      motivo: d?.candidates?.[0]?.finishReason ?? null, error: r.ok ? undefined : d.error,
      mime: img ? (img.mimeType || img.mime_type) : null, datos: img ? img.data : null })
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
})

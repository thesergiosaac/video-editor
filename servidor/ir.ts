/* ir — los botones con enlace de las respuestas automáticas pasan por aquí (24-sep-2026)
 *
 * Un botón «Probar Cherry» en un mensaje de Instagram no apunta a cherrysweet.app directo: se suma el clic (tabla
 * enlaces_flujo, función sumar_clic) y se manda a la persona a la dirección de verdad. Así la lista de flujos dice
 * cuántos clics tuvo cada uno.
 *
 * Dos formas (25-sep):
 *   GET ?e=<id>          → 302 a la dirección guardada (los mensajes que ya salieron con la dirección de supabase.co)
 *   GET ?e=<id>&json=1   → {url}. La usa la página cherrysweet.app/ir/, que es la que llevan los botones desde el
 *                          25-sep: el enlace que ve la persona dice cherrysweet.app y no una dirección rara (los filtros
 *                          de spam de Instagram y el revisor de Meta miran eso primero).
 *
 * ⚠️ No lleva sesión (lo abre cualquiera desde Instagram): solo acepta un id y solo devuelve la dirección guardada.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CASA = 'https://cherrysweet.app/'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const u = new URL(req.url)
  const id = u.searchParams.get('e') || ''
  let destino = CASA
  if (/^[0-9a-f]{8,32}$/.test(id)) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/sumar_clic`, {
        method: 'POST',
        headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_id: id }),
      })
      const url = r.ok ? await r.json() : null
      if (typeof url === 'string' && /^https?:\/\//.test(url)) destino = url
    } catch (_) { /* si falla, a la portada */ }
  }
  if (u.searchParams.get('json')) {
    return new Response(JSON.stringify({ url: destino }), { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  }
  return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } })
})

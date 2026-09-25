/* ir — los botones con enlace de las respuestas automáticas pasan por aquí (24-sep-2026)
 *
 * Un botón «Probar Cherry» en un mensaje de Instagram no apunta a cherrysweet.app directo: apunta a
 * `…/functions/v1/ir?e=<id>`. Aquí se suma el clic (tabla enlaces_flujo, función sumar_clic) y se manda a la persona
 * a la dirección de verdad. Así la lista de flujos dice cuántos clics tuvo cada uno.
 *
 * ⚠️ No lleva sesión (lo abre cualquiera desde Instagram): solo acepta un id y solo redirige a la dirección guardada.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CASA = 'https://cherrysweet.app/'

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get('e') || ''
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
  return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } })
})

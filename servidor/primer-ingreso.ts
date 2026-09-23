// primer-ingreso v1 (16-sep-2026)
// Deja crear la contraseña UNA sola vez a una cuenta que Carrete registró por dentro
// (app_metadata.clave_pendiente = true). Después se cierra y se entra con correo + contraseña.
// El registro público está apagado: nadie puede crear cuentas por su cuenta.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SRV_HEADERS = { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json' }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function rpc(nombre: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST', headers: SRV_HEADERS, body: JSON.stringify(args),
  })
  if (!r.ok) throw new Error(`rpc ${nombre} ${r.status}`)
  return r.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const correo = String(body.correo ?? '').trim().toLowerCase()
    if (!correo || correo.length > 200 || !correo.includes('@')) {
      return json({ error: 'Escribe un correo válido' }, 400)
    }

    // ¿Esta cuenta todavía no tiene contraseña? (para cualquier otro caso responde lo mismo: no)
    if (body.accion === 'estado') {
      const id = await rpc('carrete_cuenta_pendiente', { correo })
      return json({ primera_vez: typeof id === 'string' })
    }

    if (body.accion === 'crear') {
      const clave = String(body.clave ?? '')
      if (clave.length < 8 || clave.length > 72) {
        return json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' }, 400)
      }

      // Reclamar el primer ingreso de forma atómica: si dos pedidos llegan juntos, solo uno gana
      const id = await rpc('carrete_reclamar_primer_ingreso', { correo })
      if (typeof id !== 'string') {
        return json({ error: 'Esta cuenta ya tiene contraseña. Inicia sesión normal.' }, 403)
      }

      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'PUT', headers: SRV_HEADERS, body: JSON.stringify({ password: clave }),
      })
      if (!r.ok) {
        // Si no se pudo guardar, se devuelve el primer ingreso para poder intentarlo otra vez
        await rpc('carrete_devolver_primer_ingreso', { uid: id }).catch(() => null)
        const detalle = await r.text().catch(() => '')
        console.error(`[primer-ingreso] no se pudo guardar la clave: ${r.status} ${detalle.slice(0, 200)}`)
        return json({ error: 'No se pudo guardar la contraseña. Intenta con otra.' }, 400)
      }
      return json({ ok: true })
    }

    return json({ error: 'Acción no válida' }, 400)
  } catch (err) {
    console.error('[primer-ingreso] error:', String(err))
    return json({ error: 'Algo falló. Intenta de nuevo.' }, 500)
  }
})

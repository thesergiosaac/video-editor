/* borrar-cuenta — «Borrar mi cuenta» (24-sep-2026)
 *
 * Lo promete la política de privacidad (privacidad.html#borrar): «entra a tu cuenta, abre el menú de tu foto arriba a
 * la derecha y elige Borrar mi cuenta. Te pedimos confirmación y se hace en el momento». Y: «Se borra todo: tus
 * guiones, storyboards, carruseles, calendario, la identidad de tus marcas, los archivos que subiste y los videos que
 * montaste. También se corta el permiso que le diste a Cherry sobre tu cuenta de Instagram. Lo conservamos 30 días por
 * si te arrepientes y después desaparece». El revisor de Meta lo busca: si no está, se cae la solicitud.
 *
 * Dos tiempos, como dice la política:
 *   pedir   (la persona, con sesión) · EN EL MOMENTO: se corta Instagram (llave anulada, programadas canceladas,
 *                                       respuestas automáticas apagadas), la cuenta no puede volver a entrar y se
 *                                       cierran todas sus sesiones. Queda apuntada para dentro de 30 días.
 *   purgar  (el reloj, cada día)       · a los 30 días: los ARCHIVOS (S3 de los videos y el almacén de Supabase) y
 *                                       luego el usuario. ⚠️ Toda la base cuelga de auth.users con ON DELETE CASCADE
 *                                       (proyectos → clips, renders, guiones…; marcas, calendario, Instagram,
 *                                       suscripciones…): borrar el usuario borra sus filas.
 *   Si en esos 30 días escribe a soporte arrepentido, se reactiva a mano (quitar el baneo y la fila de cuentas_borradas).
 *
 * ⚠️ Los archivos de S3 se borran por su dirección EXACTA o por carpetas con el identificador completo (un UUID):
 * nunca por un prefijo corto que pudiera tocar los de otra persona. Las facturas no están aquí: las guarda Paddle.
 */

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LLAVE_RELOJ = Deno.env.get('IG_RELOJ_SECRETO') ?? ''
const DIAS = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

async function tabla(ruta: string, op: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...op, headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json', ...(op.headers || {}) },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}
async function admin(ruta: string, op: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/auth/v1/admin/${ruta}`, {
    ...op, headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json', ...(op.headers || {}) },
  })
  if (!r.ok && r.status !== 404) throw new Error(`auth ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.status
}

/* ── S3 ── */
const claveDe = (url: unknown) => {
  const s = String(url || '')
  const i = s.indexOf('.amazonaws.com/'), j = s.indexOf('.cloudfront.net/')
  const k = i >= 0 ? s.slice(i + 15) : j >= 0 ? s.slice(j + 16) : (/^[a-z]+\//.test(s) ? s : '')
  return decodeURIComponent(k.split('?')[0])
}
/* ⚠️ Esta función NO tiene permiso de borrar en S3 (su usuario de AWS solo sube, a propósito). Lo hace la Lambda de
   videos, modo `borrarArchivos`, que además solo acepta carpetas y archivos con el identificador COMPLETO de una persona. */
async function borrarS3(carpetas: string[], claves: string[]) {
  const r = await fetch(`${SB_URL}/functions/v1/invoke-lambda`, {
    method: 'POST', headers: { Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sync: true, payload: { mode: 'borrarArchivos', carpetas, claves } }),
  })
  const d: any = await r.json().catch(() => null)
  if (!r.ok || d?.functionError || !d?.result?.ok) throw new Error('No se pudieron borrar los archivos: ' + JSON.stringify(d).slice(0, 200))
  return d.result as { borrados: number, rechazados: string[], errores: string[] }
}

/* ── El almacén de Supabase: carpetas con el identificador del usuario ── */
async function borrarAlmacen(bucket: string, carpeta: string): Promise<number> {
  const r = await fetch(`${SB_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: carpeta, limit: 1000 }),
  })
  if (!r.ok) return 0
  const lista = await r.json().catch(() => [])
  const nombres: string[] = []
  for (const o of (lista || [])) {
    if (o.id) nombres.push(carpeta + '/' + o.name)
    else nombres.push(...(await listarAlmacen(bucket, carpeta + '/' + o.name)))      // subcarpeta
  }
  if (!nombres.length) return 0
  const d = await fetch(`${SB_URL}/storage/v1/object/${bucket}`, {
    method: 'DELETE', headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: nombres }),
  })
  return d.ok ? nombres.length : 0
}
async function listarAlmacen(bucket: string, carpeta: string): Promise<string[]> {
  const r = await fetch(`${SB_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: carpeta, limit: 1000 }),
  })
  const lista = r.ok ? await r.json().catch(() => []) : []
  const out: string[] = []
  for (const o of (lista || [])) {
    if (o.id) out.push(carpeta + '/' + o.name)
    else out.push(...(await listarAlmacen(bucket, carpeta + '/' + o.name)))
  }
  return out
}

/* ── A los 30 días: todo lo de esa persona ── */
async function purgar(uid: string) {
  if (!UUID.test(uid)) throw new Error('usuario inválido')
  const proyectos = (await tabla(`projects?user_id=eq.${uid}&select=id,pantallas`)) || []
  const pids = proyectos.map((p: any) => p.id).filter((x: string) => UUID.test(x))
  const clips = pids.length ? (await tabla(`clips?project_id=in.(${pids.join(',')})&select=id,storage_path,mp4_path,audio_path,thumbnail_url`)) || [] : []
  const renders = pids.length ? (await tabla(`renders?project_id=in.(${pids.join(',')})&select=id,voz_estudio`)) || [] : []

  const claves: string[] = []
  clips.forEach((c: any) => { claves.push(claveDe(c.storage_path), claveDe(c.mp4_path), claveDe(c.audio_path), claveDe(c.thumbnail_url)) })
  proyectos.forEach((p: any) => (Array.isArray(p.pantallas) ? p.pantallas : []).forEach((x: any) => claves.push(claveDe(x?.url), claveDe(x?.tapa))))
  const carpetas: string[] = pids.map((pid: string) => `uploads/${pid}/`)
  for (const r of renders) {
    if (UUID.test(r.id)) carpetas.push(`renders/${r.id}/`)
    const h = r.voz_estudio && /^[0-9a-f]{32}$/.test(String(r.voz_estudio.huella || '')) ? r.voz_estudio.huella : null
    if (h) claves.push(`voz/estudio/${h}.json`, `voz/estudio/${h}.flac`, `voz/estudio/${h}_entrada.flac`)
  }
  const r3 = await borrarS3(carpetas, claves.filter((k) => /^(uploads|clips|renders|voz)\//.test(k)))
  const nS3 = r3.borrados
  let nAlm = 0
  for (const b of ['clips', 'vinetas', 'publicar']) nAlm += await borrarAlmacen(b, uid)
  for (const id of [...pids, ...clips.map((c: any) => c.id)]) nAlm += await borrarAlmacen('thumbnails', id)

  // y la persona: con ella, en cascada, todas sus filas
  await admin(`users/${uid}`, { method: 'DELETE' })
  return { proyectos: pids.length, videos: renders.length, archivos_s3: nS3, archivos_almacen: nAlm,
           ...(r3.rechazados.length || r3.errores.length ? { rechazados: r3.rechazados.slice(0, 10), errores: r3.errores } : {}) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
  try {
    const b = await req.json().catch(() => ({}))

    /* ── El reloj de cada día ── */
    if (b?.accion === 'purgar') {
      const esServicio = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') === SB_SERVICIO
      if (!esServicio && (!LLAVE_RELOJ || String(b.llave || '') !== LLAVE_RELOJ)) return responder({ error: 'No' }, 403)
      const toca = (await tabla(`cuentas_borradas?purgada=is.null&borrar_el=lte.${new Date().toISOString()}&select=user_id&limit=20`)) || []
      const hechas = [], fallas: string[] = []
      for (const f of toca) {
        try {
          const r = await purgar(f.user_id)
          await tabla(`cuentas_borradas?user_id=eq.${f.user_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ purgada: new Date().toISOString(), resumen: r }) })
          hechas.push({ u: String(f.user_id).slice(0, 8), ...r })
        } catch (e) { fallas.push(String(f.user_id).slice(0, 8) + ': ' + String(e).slice(0, 200)); console.error(`[borrar-cuenta] ${f.user_id}: ${String(e).slice(0, 200)}`) }
      }
      console.log(`[borrar-cuenta] purgadas ${hechas.length}: ${JSON.stringify(hechas)}`)
      return responder({ purgadas: hechas, fallas })
    }

    /* ── La persona pide borrar su cuenta ── */
    if (b?.accion === 'pedir') {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
      const ur = jwt ? await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } }) : null
      const u = ur && ur.ok ? await ur.json().catch(() => null) : null
      if (!u?.id) return responder({ error: 'Inicia sesión en Cherry.' }, 401)
      if (String(b.confirmo || '').trim().toUpperCase() !== 'BORRAR') return responder({ error: 'Escribe BORRAR para confirmar.' }, 400)
      const uid = String(u.id)
      const borrarEl = new Date(Date.now() + DIAS * 86400000).toISOString()

      await tabla('cuentas_borradas?on_conflict=user_id', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: uid, correo: u.email || null, pedida: new Date().toISOString(), borrar_el: borrarEl }),
      })
      // Instagram, en el momento: sin llave, sin publicaciones pendientes, sin respuestas automáticas
      await tabla(`cuentas_instagram?user_id=eq.${uid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'revocada', token: 'revocado' }) })
      await tabla(`publicaciones_programadas?user_id=eq.${uid}&estado=in.(programada,subiendo)`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'cancelada', error: 'Cuenta borrada.' }) })
      await tabla(`reglas_comentario?user_id=eq.${uid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ activa: false }) })
      // no puede volver a entrar (hasta que se borre del todo o se arrepienta escribiendo a soporte)…
      await admin(`users/${uid}`, { method: 'PUT', body: JSON.stringify({ ban_duration: `${DIAS * 24 + 48}h` }) })
      // …y se cierran todas sus sesiones abiertas
      await fetch(`${SB_URL}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } }).catch(() => null)
      console.log(`[borrar-cuenta] pedida por ${uid.slice(0, 8)}: se borra el ${borrarEl.slice(0, 10)}`)
      return responder({ ok: true, borrar_el: borrarEl })
    }

    return responder({ error: 'acción desconocida' }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[borrar-cuenta]', msg)
    return responder({ error: msg }, 500)
  }
})

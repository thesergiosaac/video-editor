/* ig-publicar — publica en Instagram lo que Cherry programó (23-sep-2026)
 *
 * ⚠️ INSTAGRAM NO PROGRAMA NADA. No existe «publícalo el martes a las siete»: solo existe
 * «publícalo ahora». La hora la dispara el reloj de la base, que llama aquí cada pocos minutos.
 *
 * ⚠️ Y SE PUBLICA EN DOS TIEMPOS:
 *
 *   1. se le da a Instagram la DIRECCIÓN del video y él se lo descarga y lo procesa. Para un reel
 *      de 40 MB eso tarda del orden de un minuto, a veces más.
 *   2. cuando dice que terminó, y solo entonces, se publica.
 *
 * Por eso esto NO espera. Una función que se queda un minuto mirando un contador se muere sola a
 * la mitad y deja el video en el limbo: ni publicado ni cancelado, y nadie sabe en qué quedó.
 * Cada vuelta del reloj hace un paso y guarda dónde quedó.
 *
 * ⚠️ EL VIDEO TIENE QUE ESTAR EN UNA DIRECCIÓN PÚBLICA. Instagram lo descarga desde SUS
 * servidores, no desde el navegador de nadie: una dirección firmada que caduca, o una que pida
 * sesión, dan un error que no dice qué pasó. Los renders de Cherry en S3 ya son públicos —
 * comprobado.
 *
 * Modos:
 *   programar · apunta una publicación para una fecha
 *   ahora     · la apunta para ya
 *   mias      · lo que tengo programado
 *   quitar    · cancela una que todavía no ha salido
 *   tanda     · lo que llama el reloj. No lleva sesión de usuario: va con una contraseña propia.
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
/* El reloj de la base no tiene sesión de nadie, así que se identifica con esto. */
const LLAVE_RELOJ = Deno.env.get('IG_RELOJ_SECRETO') ?? ''

const GRAFO = 'https://graph.instagram.com/v23.0'
const TOPE_24H = 100          // lo que deja Instagram por cuenta y día
const TOPE_INTENTOS = 8       // ~40 min mirando si terminó de procesar; más es que algo se colgó

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function tabla(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`,
      'Content-Type': 'application/json', ...(opciones.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const txt = await r.text()
  return txt ? JSON.parse(txt) : null
}

async function quienEs(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) throw new Error('Falta la sesión.')
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` },
  })
  if (!r.ok) throw new Error('La sesión no vale.')
  const u = await r.json()
  if (!u?.id) throw new Error('La sesión no vale.')
  return u.id as string
}

const anotar = (id: string, campos: Record<string, unknown>) =>
  tabla(`publicaciones_programadas?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...campos, actualizada: new Date().toISOString() }),
  })

async function ig(camino: string, cuerpo?: Record<string, string>) {
  const r = await fetch(`${GRAFO}/${camino}`, cuerpo
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }
    : {})
  const txt = await r.text()
  if (!r.ok) throw new Error(txt.slice(0, 400))
  return JSON.parse(txt)
}

/* ── Paso 1: que Instagram se descargue el video ─────────────────────────────────────────── */
async function pedirDescarga(fila: any, token: string) {
  const o = (fila.opciones || {}) as Record<string, unknown>
  const cuerpo: Record<string, string> = { access_token: token }

  if (fila.tipo === 'STORIES') {
    /* ⚠️ UNA HISTORIA NO LLEVA TEXTO. Mandar `caption` aquí no da error: Instagram lo ignora en
       silencio, y quien lo escribió se queda creyendo que puso un pie que nadie verá. */
    cuerpo.media_type = 'STORIES'
    cuerpo.video_url = fila.video_url
  } else if (fila.tipo === 'IMAGE') {
    cuerpo.image_url = fila.video_url
    cuerpo.caption = (fila.texto || '').slice(0, 2200)
    if (o.alt_text) cuerpo.alt_text = String(o.alt_text).slice(0, 1000)
  } else {
    /* REELS. ⚠️ El «post de video» del feed ya NO existe aparte: Instagram lo fusionó con los
       reels, y lo que hace que salga también en el perfil es `share_to_feed`. */
    cuerpo.media_type = 'REELS'
    cuerpo.video_url = fila.video_url
    cuerpo.caption = (fila.texto || '').slice(0, 2200)
    if (o.share_to_feed !== undefined) cuerpo.share_to_feed = o.share_to_feed ? 'true' : 'false'
    /* De qué segundo sale la portada. Meta lo quiere en MILISEGUNDOS. */
    if (Number.isFinite(Number(o.portada_s))) {
      cuerpo.thumb_offset = String(Math.max(0, Math.round(Number(o.portada_s) * 1000)))
    }
    if (o.cover_url) cuerpo.cover_url = String(o.cover_url)
  }

  /* Vale para todos: Meta pide que se marque lo hecho con IA. */
  if (o.is_ai_generated) cuerpo.is_ai_generated = 'true'

  const r = await ig(`${fila.ig_user_id}/media`, cuerpo)
  if (!r?.id) throw new Error('Instagram no devolvió el identificador de la subida.')
  await anotar(fila.id, { estado: 'subiendo', container_id: r.id, intentos: 0, error: null })
  console.log(`[ig-publicar] ${fila.id} · subiendo · contenedor ${r.id}`)
}

/* ── Usar y tirar ────────────────────────────────────────────────────────
   Un video que Sergio sube solo para publicar no se queda: «lo subimos por un momento, lo
   publicamos, y ya no queda». Guardar videos que nadie va a volver a abrir cuesta todos los meses.

   ⚠️ Solo se borra DESPUÉS de que Instagram diga que está publicado. Borrarlo antes deja la
   publicación a medias y sin forma de reintentarla.
   ⚠️ Y si el borrado falla, no se toca la publicación: ya salió, que es lo que importó. */
async function tirarElArchivo(fila: any) {
  const ruta = String((fila.opciones || {}).borrar || '')
  if (!ruta) return
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/publicar/${ruta}`, {
      method: 'DELETE',
      headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` },
    })
    console.log(`[ig-publicar] ${fila.id} · archivo tirado (${r.status}) ${ruta}`)
  } catch (e) {
    console.warn(`[ig-publicar] ${fila.id} · no pude tirar ${ruta}: ${String(e)}`)
  }
}

/* ── Paso 2: ¿terminó de procesarlo? Si sí, publicar ─────────────────────────────────────── */
async function publicarSiEstaLista(fila: any, token: string) {
  const c = await ig(`${fila.container_id}?fields=status_code,status&access_token=${token}`)
  const estado = String(c?.status_code || '')

  if (estado === 'IN_PROGRESS' || estado === 'PUBLISHED') {
    const intentos = (fila.intentos || 0) + 1
    if (intentos >= TOPE_INTENTOS) {
      await anotar(fila.id, { estado: 'fallida', intentos,
        error: `Instagram lleva ${intentos} vueltas procesándolo y no termina. ${c?.status || ''}`.slice(0, 400) })
      return
    }
    await anotar(fila.id, { intentos })
    return
  }
  if (estado !== 'FINISHED') {
    await anotar(fila.id, { estado: 'fallida',
      error: `Instagram lo rechazó: ${c?.status || estado}`.slice(0, 400) })
    return
  }

  const r = await ig(`${fila.ig_user_id}/media_publish`,
    { creation_id: fila.container_id, access_token: token })
  if (!r?.id) throw new Error('Se procesó pero no devolvió el identificador al publicar.')
  await anotar(fila.id, { estado: 'publicada', ig_media_id: r.id, error: null })
  await tirarElArchivo(fila)
  console.log(`[ig-publicar] ${fila.id} · PUBLICADA · ${r.id}`)
}

/* ── La vuelta del reloj ─────────────────────────────────────────────────────────────────── */
async function tanda() {
  const ahora = new Date().toISOString()
  const filas = await tabla(
    `publicaciones_programadas?or=(and(estado.eq.programada,publicar_el.lte.${ahora}),` +
    `estado.eq.subiendo)&order=publicar_el&limit=20&select=*`)
  if (!filas?.length) return { miradas: 0 }

  let hechas = 0, fallidas = 0
  for (const f of filas) {
    try {
      const c = await tabla(`cuentas_instagram?ig_user_id=eq.${f.ig_user_id}` +
        `&estado=eq.activa&select=token`)
      if (!c?.length) {
        await anotar(f.id, { estado: 'fallida', error: 'Esa cuenta de Instagram ya no está conectada.' })
        fallidas++; continue
      }

      if (f.estado === 'programada') {
        const usadas = await tabla(`rpc/publicadas_24h`, {
          method: 'POST', body: JSON.stringify({ p_ig_user_id: f.ig_user_id }),
        })
        if (Number(usadas) >= TOPE_24H) {
          /* No se marca como fallida: se deja para la próxima vuelta. El tope es una ventana
             que corre, así que en unas horas volverá a haber sitio. */
          console.warn(`[ig-publicar] ${f.ig_user_id} llegó al tope de ${TOPE_24H}: se espera`)
          continue
        }
        await pedirDescarga(f, c[0].token)
      } else {
        await publicarSiEstaLista(f, c[0].token)
        hechas++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[ig-publicar] ${f.id} falló: ${msg}`)
      await anotar(f.id, { estado: 'fallida', error: msg.slice(0, 400) })
      fallidas++
    }
  }
  return { miradas: filas.length, hechas, fallidas }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d),
    { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const modo = String(b?.modo || '')

    /* El reloj no trae sesión de nadie: se identifica con su propia contraseña. */
    if (modo === 'tanda') {
      if (!LLAVE_RELOJ || String(b?.llave || '') !== LLAVE_RELOJ) {
        return responder({ error: 'No' }, 403)
      }
      return responder(await tanda())
    }

    const user = await quienEs(req)

    if (modo === 'mias') {
      const f = await tabla(`publicaciones_programadas?user_id=eq.${user}` +
        `&order=publicar_el.desc&limit=50&select=id,ig_user_id,texto,tipo,publicar_el,estado,` +
        `ig_media_id,error,creada`)
      return responder({ publicaciones: f || [] })
    }

    if (modo === 'quitar') {
      await tabla(`publicaciones_programadas?id=eq.${String(b?.id || '')}` +
        `&user_id=eq.${user}&estado=eq.programada`, { method: 'DELETE' })
      return responder({ ok: true })
    }

    if (modo === 'programar' || modo === 'ahora') {
      const url = String(b?.video_url || '')
      if (!/^https:\/\//.test(url)) {
        throw new Error('Hace falta la dirección del video, y tiene que empezar por https.')
      }
      const igUser = String(b?.ig_user_id || '')
      const mia = await tabla(`cuentas_instagram?user_id=eq.${user}&ig_user_id=eq.${igUser}` +
        `&estado=eq.activa&select=ig_user_id`)
      if (!mia?.length) throw new Error('Esa cuenta de Instagram no es tuya o no está conectada.')

      /* ⚠️ Solo los tipos que Meta acepta de verdad. Cualquier otra cosa daría un error suyo
         a mitad de camino, con el video ya subiendo. */
      const TIPOS = ['REELS', 'STORIES', 'IMAGE']
      const tipo = TIPOS.indexOf(String(b?.tipo || 'REELS')) >= 0 ? String(b.tipo) : 'REELS'

      const o = (b && typeof b.opciones === 'object' && b.opciones) ? b.opciones : {}
      const opciones: Record<string, unknown> = {}
      if (tipo === 'REELS') {
        opciones.share_to_feed = o.share_to_feed !== false
        if (Number.isFinite(Number(o.portada_s))) opciones.portada_s = Number(o.portada_s)
      }
      if (tipo === 'IMAGE' && o.alt_text) opciones.alt_text = String(o.alt_text).slice(0, 1000)
      if (o.is_ai_generated) opciones.is_ai_generated = true
      /* La ruta del archivo suelto, para tirarlo en cuanto salga publicado. */
      if (o.borrar) opciones.borrar = String(o.borrar).slice(0, 300)

      const cuando = modo === 'ahora'
        ? new Date().toISOString()
        : new Date(String(b?.publicar_el || '')).toISOString()

      const f = await tabla('publicaciones_programadas', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: user, ig_user_id: igUser, video_url: url,
          /* Una historia no lleva texto: no se guarda, para que no parezca que lo tendrá. */
          texto: tipo === 'STORIES' ? null : String(b?.texto || '').slice(0, 2200),
          tipo: tipo, opciones: opciones, publicar_el: cuando,
        }),
      })
      return responder({ ok: true, publicacion: f?.[0] })
    }

    throw new Error('No sé qué hacer con «' + modo + '».')

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ig-publicar]', msg)
    return responder({ error: msg }, /sesión/i.test(msg) ? 401 : 500)
  }
})

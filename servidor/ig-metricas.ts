/* ig-metricas — trae de Instagram los números de las publicaciones (23-sep-2026)
 *
 * Con esto el Laboratorio deja de necesitar capturas de pantalla para casi todo. Lo que llega
 * solo: alcance, vistas, me gusta, comentarios, guardados, compartidos, tiempo medio de
 * visualización y tasa de omisión. Y de ahí sale la RETENCIÓN EN PORCENTAJE, que la propia app
 * de Instagram no enseña.
 *
 * ⚠️ LO QUE NO SE PUEDE TRAER ES LA CURVA. Se comprobó pidiéndosela a Meta por su nombre
 * («retention», «audience_retention») y responde que no está entre las métricas válidas. Tampoco
 * la caída, ni los seguidores ganados por un video, ni de dónde vino el tráfico. Para eso sigue
 * haciendo falta una captura — UNA, no cuatro.
 *
 * ⚠️ Y NO SE INTENTA CALCULAR LA CURVA a partir del promedio. Con tres números se puede suponer
 * una forma, no deducirla, y saldría lisa por construcción: justo sin el desplome del segundo 3,
 * que es lo único que se quería ver. Un dibujo con apariencia de dato es peor que no tener dato.
 *
 * Modos:
 *   traer   · pide a Instagram las últimas publicaciones y guarda una instantánea de sus números
 *   perfil  · refresca foto, bio, seguidores, seguidos y publicaciones de cada cuenta
 *   atar    · dice a qué marca de Cherry pertenece una cuenta de Instagram
 *   lista   · las publicaciones guardadas, para escoger cuál es un video
 *   una     · los números de una publicación, con los nombres que usa el Laboratorio
 *   saldo   · qué hay conectado y cuándo se midió por última vez
 */
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const GRAFO = 'https://graph.instagram.com/v23.0'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/* Las métricas que Instagram acepta para un reel. Salieron de pedírselas todas de golpe: el
   error enumera las válidas, que es más fiable que la documentación. Las de cuenta —visitas al
   perfil, seguidores ganados— NO valen aquí: solo existen a nivel de cuenta, no de publicación. */
const DE_REEL = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions',
                 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'reels_skip_rate']
const DE_FOTO = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions']

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

/* ── La duración del video ───────────────────────────────────────────────────────────────────
   Instagram no la da. Un MP4 la lleva en su caja `mvhd`, y en los archivos preparados para verse
   mientras se descargan —los de Instagram lo están— esa caja va al principio. Así que con los
   primeros 200 KB basta: bajar 30 MB de video para saber que dura 28 segundos sería absurdo.

   ⚠️ Los desplazamientos son los que son y ya me equivoqué una vez: después de «mvhd» van un
   byte de versión y tres de banderas; en la versión 0 las fechas ocupan 4 bytes cada una y en la
   1 ocupan 8. La escala va DESPUÉS de las dos fechas. */
async function duracionDe(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-200000' } })
    if (!r.ok) return null
    const b = new Uint8Array(await r.arrayBuffer())

    let i = -1
    for (let k = 0; k + 3 < b.length; k++) {
      if (b[k] === 0x6d && b[k + 1] === 0x76 && b[k + 2] === 0x68 && b[k + 3] === 0x64) { i = k; break }
    }
    if (i < 0) return null

    const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
    const version = b[i + 4]
    const escala = version === 1 ? v.getUint32(i + 24) : v.getUint32(i + 16)
    const dura = version === 1 ? Number(v.getBigUint64(i + 28)) : v.getUint32(i + 20)
    return escala ? Math.round((dura / escala) * 10) / 10 : null
  } catch { return null }
}

async function ig(camino: string) {
  const r = await fetch(`${GRAFO}/${camino}`)
  const txt = await r.text()
  if (!r.ok) throw new Error(txt.slice(0, 300))
  return JSON.parse(txt)
}

/* Los números de UNA publicación. Se piden todas las métricas juntas y, si Meta rechaza alguna
   —pasa según el tipo—, se vuelve a pedir una por una para no perder las que sí valen. */
async function numerosDe(mediaId: string, tipo: string, token: string) {
  const lista = tipo === 'REELS' ? DE_REEL : DE_FOTO
  const leer = (d: any) => Object.fromEntries(
    (d?.data || []).map((x: any) => [x.name, x.values?.[0]?.value]))
  try {
    return leer(await ig(`${mediaId}/insights?metric=${lista.join(',')}&access_token=${token}`))
  } catch {
    const salida: Record<string, unknown> = {}
    for (const m of lista) {
      try { Object.assign(salida, leer(await ig(`${mediaId}/insights?metric=${m}&access_token=${token}`))) }
      catch { /* esa métrica no aplica a este tipo: se sigue */ }
    }
    return salida
  }
}

async function traer(user: string, cuantas: number) {
  const cuentas = await tabla(`cuentas_instagram?user_id=eq.${user}&estado=eq.activa` +
    `&select=ig_user_id,usuario,token`)
  if (!cuentas?.length) throw new Error('No hay ninguna cuenta de Instagram conectada.')

  const resumen: any[] = []
  for (const c of cuentas) {
    const m = await ig(`me/media?fields=id,media_type,media_product_type,timestamp,permalink,` +
      `caption,thumbnail_url,media_url&limit=${cuantas}&access_token=${c.token}`)

    let guardadas = 0
    for (const p of (m?.data || [])) {
      const tipo = String(p.media_product_type || p.media_type || '')
      const nums = await numerosDe(p.id, tipo, c.token) as Record<string, number>

      /* La duración solo se mide una vez: no cambia, y cada medición son 200 KB de descarga. */
      const ya = await tabla(`publicaciones_instagram?ig_media_id=eq.${p.id}&select=dura_seg`)
      const dura = ya?.[0]?.dura_seg ?? (p.media_url ? await duracionDe(p.media_url) : null)

      await tabla('publicaciones_instagram?on_conflict=ig_media_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          ig_media_id: p.id, user_id: user, ig_user_id: c.ig_user_id, tipo,
          publicado: p.timestamp, enlace: p.permalink, texto: (p.caption || '').slice(0, 2200),
          miniatura: p.thumbnail_url || null, dura_seg: dura, visto: new Date().toISOString(),
        }),
      })

      const medio = Number(nums.ig_reels_avg_watch_time) || null
      const horas = p.timestamp
        ? Math.round((Date.now() - new Date(p.timestamp).getTime()) / 36e5 * 10) / 10 : null

      await tabla('metricas_instagram', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          ig_media_id: p.id, horas,
          alcance: nums.reach ?? null, vistas: nums.views ?? null,
          me_gusta: nums.likes ?? null, comentarios: nums.comments ?? null,
          guardados: nums.saved ?? null, compartidos: nums.shares ?? null,
          interacciones: nums.total_interactions ?? null,
          visto_medio_ms: medio, visto_total_ms: Number(nums.ig_reels_video_view_total_time) || null,
          omision: nums.reels_skip_rate ?? null,
          /* el número que la app no enseña */
          retencion: (medio && dura) ? Math.round((medio / 1000 / dura) * 1000) / 10 : null,
        }),
      })
      guardadas++
    }
    resumen.push({ cuenta: c.usuario, guardadas })
  }
  return resumen
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, s = 200) => new Response(JSON.stringify(d),
    { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const user = await quienEs(req)
    const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const modo = String(b?.modo || 'traer')

    if (modo === 'saldo') {
      const [pubs, meds, cuentas] = await Promise.all([
        tabla(`publicaciones_instagram?user_id=eq.${user}&select=ig_media_id`),
        tabla(`mis_publicaciones?user_id=eq.${user}&select=ig_media_id,medido&order=medido.desc&limit=1`),
        tabla(`mi_instagram?user_id=eq.${user}&order=usuario`),
      ])
      return responder({ publicaciones: pubs?.length || 0, ultima: meds?.[0]?.medido || null,
                         cuentas: cuentas || [] })
    }

    /* ── El perfil de la cuenta ────────────────────────────────────────────────
       Foto, usuario, nombre, biografía, seguidores, seguidos y publicaciones. Todo esto se
       escribía a mano en el diálogo del perfil porque la API no estaba; ya está. */
    if (modo === 'perfil') {
      const cuentas = await tabla(`cuentas_instagram?user_id=eq.${user}&estado=eq.activa` +
        `&select=ig_user_id,token,marca`)
      if (!cuentas?.length) return responder({ cuentas: [] })

      const salida = []
      for (const c of cuentas) {
        const d = await ig(`me?fields=user_id,username,name,biography,profile_picture_url,` +
          `followers_count,follows_count,media_count,website&access_token=${c.token}`)
        await tabla(`cuentas_instagram?ig_user_id=eq.${c.ig_user_id}&user_id=eq.${user}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            usuario: d.username, nombre: d.name, nombre_real: d.name,
            bio: d.biography || null, web: d.website || null,
            foto: d.profile_picture_url || null,
            seguidores: d.followers_count ?? null, seguidos: d.follows_count ?? null,
            publicaciones: d.media_count ?? null,
            perfil_visto: new Date().toISOString(),
          }),
        })
        salida.push({ ig_user_id: c.ig_user_id, marca: c.marca, usuario: d.username,
                      nombre: d.name, bio: d.biography, foto: d.profile_picture_url,
                      seguidores: d.followers_count, seguidos: d.follows_count,
                      publicaciones: d.media_count, web: d.website })
      }
      return responder({ cuentas: salida })
    }

    /* Qué cuenta de Instagram es de qué marca de Cherry. Sergio lleva varias y cada una tiene
       su perfil aparte: sin esto, el inicio enseñaría los seguidores de una mientras miras la
       otra. */
    if (modo === 'atar') {
      const igu = String(b?.ig_user_id || ''), marca = String(b?.marca || '')
      if (!igu) throw new Error('Falta la cuenta de Instagram.')
      await tabla(`cuentas_instagram?ig_user_id=eq.${igu}&user_id=eq.${user}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ marca: marca || null }),
      })
      return responder({ ok: true })
    }

    /* ── Las publicaciones, con los nombres que usa Cherry ────────────────────────────
       Un video de Cherry ya no es algo que se crea a mano: ES una publicación de Instagram con
       sus números de verdad. Lo único que sigue viniendo de fuera es la captura de la curva.

       ⚠️ Las claves son las que ya lee `resumen-cuenta.js`. La traducción se hace aquí UNA vez;
       si se hiciera en cada pantalla, a la tercera una se quedaría sin actualizar. */
    if (modo === 'videos') {
      const p = await tabla(`mis_publicaciones?user_id=eq.${user}` +
        `&order=publicado.desc&limit=100`)
      const cuentas = await tabla(`cuentas_instagram?user_id=eq.${user}&select=ig_user_id,marca`)
      const marcaDe: Record<string, string> = {}
      ;(cuentas || []).forEach((c: any) => { if (c.marca) marcaDe[c.ig_user_id] = c.marca })

      return responder({
        videos: (p || []).map((x: any) => ({
          id: 'ig:' + x.ig_media_id,
          igMediaId: x.ig_media_id,
          cuenta: marcaDe[x.ig_user_id] || null,
          titulo: (x.texto || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin texto',
          fecha: (x.publicado || '').slice(0, 10),
          creado: x.publicado,
          tapa: x.miniatura || null,
          enlace: x.enlace,
          dur: x.dura_seg,
          visitas: x.vistas, alcance: x.alcance,
          retencion: x.retencion, omisiones: x.omision,
          meGusta: x.me_gusta, comentarios: x.comentarios, guardados: x.guardados,
          /* ⚠️ Instagram da UN solo `shares`. Va en `reposts` y `enviados` se queda vacío:
             ponerlo en los dos contaría cada compartido dos veces en las interacciones. */
          reposts: x.compartidos, enviados: null,
          medido: x.medido,
        })),
      })
    }

    /* Las publicaciones que ya tenemos guardadas, para que escoja cuál es su video. */
    if (modo === 'lista') {
      const p = await tabla(`mis_publicaciones?user_id=eq.${user}` +
        `&select=ig_media_id,tipo,publicado,enlace,texto,miniatura,dura_seg,vistas,retencion` +
        `&order=publicado.desc&limit=60`)
      return responder({ publicaciones: p || [] })
    }

    /* Los números de UNA publicación, con los nombres que ya usa el Laboratorio.
       ⚠️ `enviados` y `seguidores` van en null a propósito: Instagram da un único `shares` sin
       separar reenvíos de compartidos, y los seguidores ganados no existen por publicación. Se
       devuelven vacíos en vez de inventarlos. */
    if (modo === 'una') {
      const id = String(b?.ig_media_id || '')
      const fila = await tabla(`mis_publicaciones?ig_media_id=eq.${id}&user_id=eq.${user}` +
        `&select=vistas,retencion,omision,alcance,me_gusta,comentarios,guardados,compartidos,` +
        `medido,publicado,enlace,texto,dura_seg,horas`)
      if (!fila?.length) throw new Error('Esa publicación no está guardada todavía.')
      const x = fila[0]
      return responder({
        medicion: {
          visitas: x.vistas, retencion: x.retencion, omisiones: x.omision,
          alcance: x.alcance, meGusta: x.me_gusta, comentarios: x.comentarios,
          guardados: x.guardados, reposts: x.compartidos,
          enviados: null, seguidores: null,
        },
        publicacion: { enlace: x.enlace, texto: x.texto, publicado: x.publicado,
                       dura_seg: x.dura_seg, horas: x.horas, medido: x.medido },
        /* lo que la API no puede dar, dicho sin rodeos para que la pantalla lo muestre */
        faltan: ['enviados', 'seguidores', 'curva'],
      })
    }

    const cuantas = Math.min(Math.max(Number(b?.cuantas) || 25, 1), 50)
    return responder({ ok: true, cuentas: await traer(user, cuantas) })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ig-metricas]', msg)
    return responder({ error: msg }, /sesión/i.test(msg) ? 401 : 500)
  }
})

// ig-publicar — publica en Instagram lo que Cherry programó (reels, historias —en video o imagen desde el 7-oct—, imagen y, desde el 30-sep, carruseles y reels de prueba)
/* ig-publicar v2 — publica en Instagram lo que Cherry programó (23-sep-2026; v2 24-sep: siempre el master)
 *
 * v24 (18-oct-2026) · TAL CUAL. Sergio sube videos que ya editó solo para programarlos (js/arranque.js). Un reel así lleva
 * `opciones.original` = la llave de SU archivo en uploads/ (privado): al crear el contenedor se firma una dirección que dura
 * 6 horas y Instagram baja el original, sin fabricar nada. Solo se acepta una llave de un clip de la misma persona.
 * `modo: 'original'` dice si se puede (dueño, el servidor lo puede leer, y no pasa de 300 MB, el tope de Instagram).
 * v27 (24-oct) · TAL CUAL DE VERDAD. Sergio autorizó que el usuario AWS del servidor (`carrete-servidor`) LEA `uploads/*`: ya se
 * firma el original. Y la dirección pide `response-content-type` video/mp4 (o quicktime): S3 los guardó como binary/octet-stream
 * y Instagram rechaza lo que no llega como video.
 * v25 (18-oct) · PORTADA PROPIA: un reel acepta `opciones.cover_url`, solo una imagen de la carpeta de esa persona en el cubo
 * público `publicar` (el Calendario la ajusta a 1080×1920 JPG). Antes se usaba al crear el contenedor pero nunca se guardaba.
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
 *
 * v2 (24-sep-2026) · ⚠️ NUNCA SE PUBLICA LA COPIA DE EDICIÓN. Un video de Cherry se edita sobre una copia liviana
 * (720p a 30 cuadros); lo que sale a Instagram es el MASTER: cortado del archivo tal como se grabó, en su versión para
 * Instagram (1080×1920 a los cuadros originales, 60 si así se grabó). El 24-sep salió la copia de 720p: el calendario
 * pedía el master en el navegador y, con el video ya escogido, se lo saltaba. Ahora lo hace ESTE servidor:
 *   · al programar, si la dirección es de un render de Cherry que no es master, se pide el master a orchestrate en ese
 *     momento (en segundo plano: aunque se cierre la página). Sergio: «apenas se toca en programar lo procesa, y cuando
 *     llegue la hora ya está listo».
 *   · cada vuelta del reloj mira los que se están preparando; cuando el master está, cambia la dirección por la suya.
 *   · a la hora, si el master todavía no está, se ESPERA (no se publica la copia). Si no sale, queda «fallida» y dice por qué.
 *
 * v3 (6-oct-2026) · FABRICAR AL FINAL: el editor ya no deja hecho un video mientras se edita. Al tocar «Publicar» la
 * página fabrica el master y programa con `render_master` (su id) aunque todavía no tenga dirección: la fila se guarda
 * con una dirección de espera (cherrysweet.app/fabricando/<id>) y `master_estado: 'preparando'`; cada vuelta del reloj
 * mira si ya salió y pone la suya. Si falla, queda fallida y no se publica nada.
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

async function ig(camino: string, cuerpo?: Record<string, unknown>) {
  const r = await fetch(`${GRAFO}/${camino}`, cuerpo
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }
    : {})
  const txt = await r.text()
  if (!r.ok) throw new Error(txt.slice(0, 400))
  return JSON.parse(txt)
}

/* ── v2: el MASTER (la calidad en que se grabó) ────────────────────────────────────────────── */
/* ── (v24) El archivo original, firmado ──────────────────────────────────────────────────────────── */
const CUBO = 'remotionlambda-useast1-editorvideo'
const REGION_S3 = 'us-east-1'
const TOPE_ORIGINAL = 300 * 1024 * 1024        // lo más que acepta Instagram para un reel
const LLAVE_ORIGINAL = /^uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[^?#\\]+$/i
const enc3986 = (t: string) => encodeURIComponent(t).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const hexDe = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
async function hmacS3(llave: Uint8Array | ArrayBuffer, texto: string) {
  const k = await crypto.subtle.importKey('raw', llave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto))
}
/* Dirección firmada (AWS SigV4 por consulta) para LEER una llave del cubo durante `segundos`. (v27) `tipo`: con qué
   Content-Type la entrega S3 (va firmado): los originales se guardaron como binary/octet-stream y Instagram pide video/mp4. */
const tipoVideo = (key: string) => (/\.mov$/i.test(key) ? 'video/quicktime' : 'video/mp4')
async function firmarS3(key: string, segundos = 21600, tipo = ''): Promise<string> {
  const id = Deno.env.get('AWS_ACCESS_KEY_ID') || '', secreto = Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''
  if (!id || !secreto) throw new Error('El servidor no tiene las llaves de AWS.')
  const host = `${CUBO}.s3.${REGION_S3}.amazonaws.com`
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dia = amz.slice(0, 8), alcance = `${dia}/${REGION_S3}/s3/aws4_request`
  const ruta = '/' + key.split('/').map(enc3986).join('/')
  const q: [string, string][] = [['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'], ['X-Amz-Credential', `${id}/${alcance}`], ['X-Amz-Date', amz],
    ['X-Amz-Expires', String(segundos)], ['X-Amz-SignedHeaders', 'host']]
  const sesion = Deno.env.get('AWS_SESSION_TOKEN') || ''
  if (sesion) q.push(['X-Amz-Security-Token', sesion])
  if (tipo) q.push(['response-content-type', tipo])
  const canonQ = q.map(([k, v]) => [enc3986(k), enc3986(v)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('&')
  const canon = ['GET', ruta, canonQ, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const resumen = hexDe(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon)))
  let k: ArrayBuffer = await hmacS3(new TextEncoder().encode('AWS4' + secreto), dia)
  k = await hmacS3(k, REGION_S3); k = await hmacS3(k, 's3'); k = await hmacS3(k, 'aws4_request')
  const firma = hexDe(await hmacS3(k, ['AWS4-HMAC-SHA256', amz, alcance, resumen].join('\n')))
  return `https://${host}${ruta}?${canonQ}&X-Amz-Signature=${firma}`
}
/* ¿La llave es de un clip de esta persona? */
async function originalEsSuyo(user: string, key: string) {
  if (!LLAVE_ORIGINAL.test(key)) return false
  const c = await tabla(`clips?storage_path=eq.${encodeURIComponent(key)}&user_id=eq.${user}&select=id&limit=1`)
  return Array.isArray(c) && c.length > 0
}
/* ¿El servidor lo puede leer, y cuánto pesa? (pide el primer kilobyte con la dirección firmada) */
async function probarOriginal(key: string): Promise<{ ok: boolean, motivo?: string, tam?: number }> {
  let url = ''
  try { url = await firmarS3(key, 600) } catch (e) { return { ok: false, motivo: 'sin_llaves' } }
  const r = await fetch(url, { headers: { Range: 'bytes=0-1023' } })
  await r.body?.cancel().catch(() => null)
  if (r.status === 403) return { ok: false, motivo: 'sin_permiso' }
  if (r.status === 404) return { ok: false, motivo: 'no_existe' }
  if (r.status !== 206 && r.status !== 200) return { ok: false, motivo: 'error_' + r.status }
  const tam = Number(String(r.headers.get('content-range') || '').split('/')[1]) || Number(r.headers.get('content-length')) || 0
  if (tam > TOPE_ORIGINAL) return { ok: false, motivo: 'grande', tam }
  return { ok: true, tam }
}

const ES_RENDER = /\/renders\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//
const renderDe = (url: string) => { const m = ES_RENDER.exec(String(url || '')); return m ? m[1] : null }
const esMaster = (r: any) => !!r && (((r.subtitle_config || {}) as Record<string, unknown>).calidad === 'original' || !!r.output_original_url)
const ESPERA_MASTER_MIN = 40      // si a la hora + esto no salió el master, se da por fallida (nunca se publica la copia)

/* Deja la fila con su master: 'lista' | 'preparando' | 'fallida' | 'no' (no es un render de Cherry: va tal cual) */
async function prepararMaster(fila: any): Promise<string> {
  if (fila.master_estado === 'lista' || fila.master_estado === 'no') return fila.master_estado
  const rid = renderDe(fila.video_url)
  // v3: programada con un video que todavía se fabrica: ya trae su master (render_master) aunque la dirección no sea de un render
  if (!rid && !fila.render_master) { await anotar(fila.id, { master_estado: 'no' }); fila.master_estado = 'no'; return 'no' }

  if (!fila.render_master) {
    const r = (await tabla(`renders?id=eq.${rid}&select=id,project_id,subtitle_config,output_original_url,output_url,status`))?.[0]
    if (!r) { await anotar(fila.id, { master_estado: 'no' }); fila.master_estado = 'no'; return 'no' }
    if (esMaster(r)) { await anotar(fila.id, { master_estado: 'lista' }); fila.master_estado = 'lista'; return 'lista' }
    const p = (await tabla(`projects?id=eq.${r.project_id}&select=user_id`))?.[0]
    if (!p || p.user_id !== fila.user_id) throw new Error('Ese video no es de esta cuenta.')
    const res = await fetch(`${SB_URL}/functions/v1/orchestrate`, {
      method: 'POST',
      headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: r.project_id, user_id: fila.user_id, reusar_render: rid, calidad: 'original' }),
    })
    const d: any = await res.json().catch(() => null)
    if (!res.ok || !d?.render_id) throw new Error('No se pudo pedir la calidad original: ' + JSON.stringify(d).slice(0, 200))
    await anotar(fila.id, { render_master: d.render_id, master_estado: 'preparando' })
    fila.render_master = d.render_id; fila.master_estado = 'preparando'
    console.log(`[ig-publicar] ${fila.id} · pidiendo el master ${d.render_id} (de ${rid})`)
    return 'preparando'
  }

  const m = (await tabla(`renders?id=eq.${fila.render_master}&select=status,output_url,output_original_url,subtitle_config,error_message`))?.[0]
  if (m && m.status === 'done' && m.output_url && esMaster(m)) {
    await anotar(fila.id, { video_url: m.output_url, master_estado: 'lista' })
    fila.video_url = m.output_url; fila.master_estado = 'lista'
    console.log(`[ig-publicar] ${fila.id} · master listo: ${m.output_url}`)
    return 'lista'
  }
  if (!m || m.status === 'error') {
    await anotar(fila.id, { master_estado: 'fallida', estado: 'fallida',
      error: ('No salió la calidad original: ' + (m?.error_message || 'el render no existe')).slice(0, 400) })
    return 'fallida'
  }
  return 'preparando'
}

/* ── Paso 1: que Instagram se descargue el video ─────────────────────────────────────────── */
async function pedirDescarga(fila: any, token: string) {
  const o = (fila.opciones || {}) as Record<string, unknown>
  const cuerpo: Record<string, unknown> = { access_token: token }

  /* (30-sep) CARRUSEL: primero un contenedor por lámina (`is_carousel_item`), sin texto; el carrusel en sí (con el
     texto) se arma en la vuelta siguiente, cuando Instagram terminó de bajar todas. ⚠️ Una lámina en video tarda
     como un reel; las imágenes salen casi al instante. */
  if (fila.tipo === 'CAROUSEL') {
    const medios = Array.isArray(o.medios) ? o.medios as any[] : []
    const hijos: string[] = []
    for (const m of medios) {
      const c: Record<string, string> = { access_token: token, is_carousel_item: 'true' }
      if (m.tipo === 'VIDEO') { c.media_type = 'VIDEO'; c.video_url = String(m.url) } else c.image_url = String(m.url)
      const r = await ig(`${fila.ig_user_id}/media`, c)
      if (!r?.id) throw new Error('Instagram no devolvió el identificador de una lámina.')
      hijos.push(r.id)
    }
    await anotar(fila.id, { estado: 'subiendo', container_id: null, intentos: 0, error: null, opciones: { ...o, hijos } })
    console.log(`[ig-publicar] ${fila.id} · carrusel · ${hijos.length} láminas subiendo`)
    return
  }

  if (fila.tipo === 'STORIES') {
    /* ⚠️ UNA HISTORIA NO LLEVA TEXTO. Mandar `caption` aquí no da error: Instagram lo ignora en
       silencio, y quien lo escribió se queda creyendo que puso un pie que nadie verá. */
    cuerpo.media_type = 'STORIES'
    /* (7-oct) historias desde la herramienta Historias: cada parte puede ser una IMAGEN (JPG) o un video */
    if (o.medio === 'IMAGE' || /\.(jpe?g|png|webp)(\?|$)/i.test(String(fila.video_url || ''))) cuerpo.image_url = fila.video_url
    else cuerpo.video_url = fila.video_url
  } else if (fila.tipo === 'IMAGE') {
    cuerpo.image_url = fila.video_url
    cuerpo.caption = (fila.texto || '').slice(0, 2200)
    if (o.alt_text) cuerpo.alt_text = String(o.alt_text).slice(0, 1000)
  } else {
    /* REELS. ⚠️ El «post de video» del feed ya NO existe aparte: Instagram lo fusionó con los
       reels, y lo que hace que salga también en el perfil es `share_to_feed`. */
    cuerpo.media_type = 'REELS'
    cuerpo.video_url = fila.video_url
    // (v24) tal cual: SU archivo original, con una dirección firmada que dura 6 horas (Instagram lo baja enseguida)
    if (o.original && LLAVE_ORIGINAL.test(String(o.original))) {
      try { cuerpo.video_url = await firmarS3(String(o.original), 21600, tipoVideo(String(o.original))) }
      catch (e) { throw new Error('No pude preparar tu archivo original para Instagram: ' + (e instanceof Error ? e.message : String(e))) }
    }
    cuerpo.caption = (fila.texto || '').slice(0, 2200)
    if (o.share_to_feed !== undefined) cuerpo.share_to_feed = o.share_to_feed ? 'true' : 'false'
    /* De qué segundo sale la portada. Meta lo quiere en MILISEGUNDOS. */
    if (Number.isFinite(Number(o.portada_s))) {
      cuerpo.thumb_offset = String(Math.max(0, Math.round(Number(o.portada_s) * 1000)))
    }
    if (o.cover_url) cuerpo.cover_url = String(o.cover_url)
    /* (30-sep) REEL DE PRUEBA («trial reels» de Instagram): primero solo lo ve gente que no te sigue. Pasa a tus seguidores
       a mano (MANUAL, desde la app) o solo si le va bien (SS_PERFORMANCE). Mientras es de prueba no va a tu perfil:
       `share_to_feed` no se manda. */
    if (o.prueba === 'MANUAL' || o.prueba === 'SS_PERFORMANCE') {
      cuerpo.trial_params = { graduation_strategy: o.prueba }
      delete cuerpo.share_to_feed
    }
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
  const b = (fila.opciones || {}).borrar
  const rutas = (Array.isArray(b) ? b : [b]).map((x: unknown) => String(x || '')).filter(Boolean)
  for (const ruta of rutas) {
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
}

/* ── Paso 2: ¿terminó de procesarlo? Si sí, publicar ─────────────────────────────────────── */
/* (9-oct) La parte de la historia que acaba de salir queda amarrada a la respuesta automática que se escogió en el editor:
   su id entra a `grafo.nodos[disparador].d.historias` (ig-aviso atiende a quien responda CUALQUIER parte de esa lista).
   La respuesta queda `donde = 'una'`, activa, y `media_id` = la última parte publicada. Si algo falla, la publicación
   sigue igual: solo se avisa en el registro. */
async function amarrarAutomatizacion(fila: any, mediaId: string) {
  try {
    const fs = await tabla(`flujos_respuesta?id=eq.${String(fila.opciones.flujo)}&select=id,user_id,grafo`)
    const f = fs?.[0]
    if (!f || f.user_id !== fila.user_id) { console.warn(`[ig-publicar] ${fila.id}: la automatización ya no existe o no es suya`); return }
    const g = f.grafo || {}
    const disp = (g.nodos || []).find((n: any) => n.tipo === 'disparador')
    if (!disp) { console.warn(`[ig-publicar] ${fila.id}: la automatización no tiene disparador`); return }
    disp.d = disp.d || {}
    const lista: string[] = Array.isArray(disp.d.historias) ? disp.d.historias.map(String) : []
    if (lista.indexOf(mediaId) < 0) lista.push(mediaId)
    disp.d.historias = lista; disp.d.historia = true; disp.d.donde = 'una'
    await tabla(`flujos_respuesta?id=eq.${f.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ grafo: g, donde: 'una', media_id: mediaId, activa: true }) })
    console.log(`[ig-publicar] ${fila.id} · historia ${mediaId} amarrada a la automatización ${f.id} (${lista.length} partes)`)
  } catch (e) {
    console.error(`[ig-publicar] ${fila.id}: no se pudo amarrar a la automatización: ` + (e instanceof Error ? e.message : String(e)))
  }
}

/* (15-oct) Reels, carruseles e imágenes: la respuesta automática que se VINCULÓ AL PROYECTO antes de publicarlo
   (flujos_respuesta.proyecto_id, la pone cherry-mcp) queda amarrada a esta publicación y se enciende: donde='una',
   media_id, activa, y activada un minuto antes para que el barrido no se salte los primeros comentarios. El proyecto
   sale del render que se publica (el master es un render del mismo proyecto). Si algo falla, la publicación sigue igual. */
async function amarrarPorProyecto(fila: any, mediaId: string) {
  try {
    const rid = fila.render_master || renderDe(fila.video_url)
    let pid = rid ? String((await tabla(`renders?id=eq.${rid}&select=project_id`))?.[0]?.project_id || '') : ''
    // (22-oct) publicado desde el chat con el archivo tal cual (cherry-mcp › publicar_video): no hay render, el proyecto
    // viene en opciones (solo lo pone el servidor: «programar» arma sus opciones aparte y no lo copia)
    if (!pid && /^[0-9a-f-]{36}$/i.test(String(fila.opciones?.proyecto || ''))) pid = String(fila.opciones.proyecto)
    if (!pid) return
    const r = { project_id: pid }
    const fs = await tabla(`flujos_respuesta?proyecto_id=eq.${r.project_id}&user_id=eq.${fila.user_id}&media_id=is.null&select=id,grafo`)
    for (const f of fs || []) {
      const g = f.grafo || {}
      const disp = (g.nodos || []).find((n: any) => n.tipo === 'disparador')
      if (disp) { disp.d = disp.d || {}; disp.d.donde = 'una' }
      g.post = { ...(g.post || {}), texto: String(fila.texto || '').slice(0, 2200) }
      await tabla(`flujos_respuesta?id=eq.${f.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ grafo: g, donde: 'una', media_id: mediaId, ig_user_id: fila.ig_user_id, activa: true,
          activada: new Date(Date.now() - 60000).toISOString(), actualizado: new Date().toISOString() }) })
      console.log(`[ig-publicar] ${fila.id} · ${mediaId} amarrada a la automatización ${f.id} (proyecto ${r.project_id})`)
    }
  } catch (e) {
    console.error(`[ig-publicar] ${fila.id}: no se pudo amarrar por proyecto: ` + (e instanceof Error ? e.message : String(e)))
  }
}

/* (29-oct) Reels, carruseles e imágenes: la respuesta automática escogida en el modal de programar del Calendario
   (opciones.flujo). Sergio: «poder elegir vincular una respuesta automática a esa publicación». Queda amarrada a esta
   publicación y se enciende, igual que amarrarPorProyecto. Si ya la amarraron a otra (cada respuesta le escribe UNA vez a
   cada persona, en UNA publicación), no se toca. Si algo falla, la publicación sigue igual. */
async function amarrarPorFlujo(fila: any, mediaId: string) {
  try {
    const f = (await tabla(`flujos_respuesta?id=eq.${String(fila.opciones.flujo)}&user_id=eq.${fila.user_id}&select=id,media_id,grafo`))?.[0]
    if (!f) { console.warn(`[ig-publicar] ${fila.id}: la respuesta automática ya no existe o no es suya`); return }
    if (f.media_id && String(f.media_id) !== mediaId) { console.warn(`[ig-publicar] ${fila.id}: la respuesta ${f.id} ya está amarrada a otra publicación`); return }
    const g = f.grafo || {}
    const disp = (g.nodos || []).find((n: any) => n.tipo === 'disparador')
    if (disp) { disp.d = disp.d || {}; disp.d.donde = 'una' }
    g.post = { ...(g.post || {}), texto: String(fila.texto || '').slice(0, 2200) }
    await tabla(`flujos_respuesta?id=eq.${f.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ grafo: g, donde: 'una', media_id: mediaId, ig_user_id: fila.ig_user_id, activa: true,
        activada: new Date(Date.now() - 60000).toISOString(), actualizado: new Date().toISOString() }) })
    console.log(`[ig-publicar] ${fila.id} · ${mediaId} amarrada a la respuesta ${f.id} (escogida en el Calendario)`)
  } catch (e) {
    console.error(`[ig-publicar] ${fila.id}: no se pudo amarrar la respuesta escogida: ` + (e instanceof Error ? e.message : String(e)))
  }
}

async function publicarSiEstaLista(fila: any, token: string) {
  if (fila.tipo === 'CAROUSEL' && !fila.container_id) {
    const o = (fila.opciones || {}) as Record<string, unknown>
    const hijos = Array.isArray(o.hijos) ? o.hijos as string[] : []
    if (!hijos.length) throw new Error('El carrusel no tiene láminas subidas.')
    for (const h of hijos) {
      const e = await ig(`${h}?fields=status_code,status&access_token=${token}`)
      const est = String(e?.status_code || '')
      if (est === 'IN_PROGRESS') {
        const intentos = (fila.intentos || 0) + 1
        if (intentos >= TOPE_INTENTOS) {
          await anotar(fila.id, { estado: 'fallida', intentos, error: `Una lámina lleva ${intentos} vueltas procesándose. ${e?.status || ''}`.slice(0, 400) })
          return
        }
        await anotar(fila.id, { intentos }); return
      }
      if (est !== 'FINISHED') {
        await anotar(fila.id, { estado: 'fallida', error: `Instagram rechazó una lámina: ${e?.status || est}`.slice(0, 400) })
        return
      }
    }
    const cuerpo: Record<string, string> = { access_token: token, media_type: 'CAROUSEL', children: hijos.join(','),
      caption: (fila.texto || '').slice(0, 2200) }
    if (o.is_ai_generated) cuerpo.is_ai_generated = 'true'
    const r = await ig(`${fila.ig_user_id}/media`, cuerpo)
    if (!r?.id) throw new Error('Instagram no devolvió el identificador del carrusel.')
    await anotar(fila.id, { container_id: r.id, intentos: 0 })
    console.log(`[ig-publicar] ${fila.id} · carrusel armado · contenedor ${r.id}`)
    return
  }
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
  if (fila.tipo === 'STORIES' && fila.opciones?.flujo) await amarrarAutomatizacion(fila, String(r.id))
  else if (fila.tipo !== 'STORIES') {
    if (fila.opciones?.flujo) await amarrarPorFlujo(fila, String(r.id))   // (29-oct) la escogida en el modal de programar
    await amarrarPorProyecto(fila, String(r.id))
  }
  await tirarElArchivo(fila)
  console.log(`[ig-publicar] ${fila.id} · PUBLICADA · ${r.id}`)
}

/* ── La vuelta del reloj ─────────────────────────────────────────────────────────────────── */
async function tanda() {
  const ahora = new Date().toISOString()
  /* v2: primero, las que esperan su master (aunque falte mucho para su hora): así a la hora ya está */
  const enEspera = await tabla(`publicaciones_programadas?estado=eq.programada` +
    `&or=(master_estado.is.null,master_estado.eq.preparando)&order=publicar_el&limit=20&select=*`)
  for (const f of (enEspera || [])) {
    try { await prepararMaster(f) }
    catch (e) { console.error(`[ig-publicar] ${f.id} · master: ${e instanceof Error ? e.message : String(e)}`) }
  }

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
        /* v2: ⚠️ sin master NO sale. Si todavía se está preparando, se espera a la próxima vuelta. */
        const me = await prepararMaster(f)
        if (me !== 'lista' && me !== 'no') {
          const tarde = (Date.now() - new Date(f.publicar_el).getTime()) / 60000
          if (me === 'preparando' && tarde > ESPERA_MASTER_MIN) {
            await anotar(f.id, { estado: 'fallida', error: `La calidad original no estuvo lista en ${ESPERA_MASTER_MIN} min: no se publicó la copia de edición.` })
            fallidas++
          } else if (me === 'preparando') console.log(`[ig-publicar] ${f.id} · es la hora pero el master sigue preparándose: se espera`)
          continue
        }
        // la última defensa: la dirección que se le da a Instagram es la del master (o un archivo suelto)
        const rid = renderDe(f.video_url)
        if (rid) {
          const r = (await tabla(`renders?id=eq.${rid}&select=subtitle_config,output_original_url`))?.[0]
          if (!esMaster(r)) {
            await anotar(f.id, { estado: 'fallida', error: 'Iba a salir la copia de edición (720p): no se publicó.' })
            fallidas++; continue
          }
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
        `ig_media_id,error,creada,master_estado`)
      return responder({ publicaciones: f || [] })
    }

    /* (v24) ¿Se puede publicar este archivo tal cual? Lo pregunta el editor antes de ofrecerlo (js/arranque.js) */
    if (modo === 'original') {
      const key = String(b?.key || '')
      if (!(await originalEsSuyo(user, key))) return responder({ ok: false, motivo: 'no_es_tuyo' })
      return responder(await probarOriginal(key))
    }

    if (modo === 'quitar') {
      await tabla(`publicaciones_programadas?id=eq.${String(b?.id || '')}` +
        `&user_id=eq.${user}&estado=eq.programada`, { method: 'DELETE' })
      return responder({ ok: true })
    }

    if (modo === 'programar' || modo === 'ahora') {
      /* v3 (6-oct) FABRICAR AL FINAL: el editor ya no deja un video hecho mientras se edita; al tocar «Publicar» se
         fabrica el master y se programa enseguida con `render_master` (su id), aunque todavía no tenga dirección. La
         publicación lo espera (prepararMaster) y, si no sale, queda fallida: nunca se publica a medias. */
      const fab = String(b?.render_master || '')
      let maestro: any = null
      if (fab) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fab)) throw new Error('Ese video no existe.')
        maestro = (await tabla(`renders?id=eq.${fab}&select=id,project_id,status,output_url,subtitle_config`))?.[0]
        const dueno = maestro && (await tabla(`projects?id=eq.${maestro.project_id}&select=user_id`))?.[0]
        if (!maestro || !dueno || dueno.user_id !== user) throw new Error('Ese video no es de esta cuenta.')
        if (!esMaster(maestro)) throw new Error('Ese video no es el de calidad original.')
        if (maestro.status === 'error') throw new Error('Ese video no se pudo fabricar: vuelve a pedirlo desde el editor.')
      }
      const url = maestro
        ? (maestro.status === 'done' && /^https:\/\//.test(String(maestro.output_url || '')) ? String(maestro.output_url) : `https://cherrysweet.app/fabricando/${fab}`)
        : String(b?.video_url || '')
      if (!/^https:\/\//.test(url)) {
        throw new Error('Hace falta la dirección del video, y tiene que empezar por https.')
      }
      const igUser = String(b?.ig_user_id || '')
      const mia = await tabla(`cuentas_instagram?user_id=eq.${user}&ig_user_id=eq.${igUser}` +
        `&estado=eq.activa&select=ig_user_id`)
      if (!mia?.length) throw new Error('Esa cuenta de Instagram no es tuya o no está conectada.')

      /* ⚠️ Solo los tipos que Meta acepta de verdad. Cualquier otra cosa daría un error suyo
         a mitad de camino, con el video ya subiendo. */
      const TIPOS = ['REELS', 'STORIES', 'IMAGE', 'CAROUSEL']
      const tipo = TIPOS.indexOf(String(b?.tipo || 'REELS')) >= 0 ? String(b.tipo) : 'REELS'

      const o = (b && typeof b.opciones === 'object' && b.opciones) ? b.opciones : {}
      const opciones: Record<string, unknown> = {}
      if (tipo === 'REELS') {
        opciones.share_to_feed = o.share_to_feed !== false
        if (Number.isFinite(Number(o.portada_s))) opciones.portada_s = Number(o.portada_s)
        // (30-sep) reel de prueba: apagado salvo que la persona lo pida
        if (o.prueba === 'MANUAL' || o.prueba === 'SS_PERFORMANCE') { opciones.prueba = o.prueba; delete opciones.share_to_feed }
        // (v25) la portada propia: solo de SU carpeta en el cubo público `publicar`
        const portada = String(o.cover_url || '')
        if (portada && portada.length < 600 && portada.indexOf(`${SB_URL}/storage/v1/object/public/publicar/${user}/`) === 0) opciones.cover_url = portada
      }
      if (tipo === 'IMAGE' && o.alt_text) opciones.alt_text = String(o.alt_text).slice(0, 1000)
      if (tipo === 'STORIES' && o.medio === 'IMAGE') opciones.medio = 'IMAGE'
      /* (9-oct) Historia con automatización escogida en el editor de Historias: al salir publicada, esta parte se amarra a
         esa respuesta automática (amarrarAutomatizacion). Solo una respuesta de la misma persona. */
      /* (29-oct) y la respuesta escogida en el modal de programar del Calendario, para reels, carruseles e imágenes: suya y sin
         amarrar a otra publicación (amarrarPorFlujo la amarra al salir) */
      if (o.flujo && /^[0-9a-f-]{36}$/i.test(String(o.flujo))) {
        const suya = (await tabla(`flujos_respuesta?id=eq.${String(o.flujo)}&user_id=eq.${user}&select=id,media_id`))?.[0]
        if (suya && (tipo === 'STORIES' || !suya.media_id)) opciones.flujo = String(o.flujo)
      }
      if (o.is_ai_generated) opciones.is_ai_generated = true
      // (v24) tal cual: la llave de SU archivo original (se firma al publicar)
      if (tipo === 'REELS' && o.original) {
        const key = String(o.original)
        if (!(await originalEsSuyo(user, key))) throw new Error('Ese archivo no es de esta cuenta.')
        opciones.original = key
      }
      /* La ruta del archivo suelto, para tirarlo en cuanto salga publicado. */
      if (o.borrar) opciones.borrar = Array.isArray(o.borrar) ? o.borrar.slice(0, 10).map((x: unknown) => String(x).slice(0, 300)) : String(o.borrar).slice(0, 300)
      /* (30-sep) Carrusel: de 2 a 10 láminas, cada una una dirección pública (JPG o MP4). */
      if (tipo === 'CAROUSEL') {
        const medios = (Array.isArray(o.medios) ? o.medios : []).slice(0, 10).map((m: any) => ({
          url: String(m?.url || ''), tipo: m?.tipo === 'VIDEO' ? 'VIDEO' : 'IMAGE' }))
        if (medios.length < 2) throw new Error('Un carrusel de Instagram necesita al menos 2 láminas.')
        if (medios.some((m: any) => !/^https:\/\//.test(m.url))) throw new Error('Cada lámina tiene que tener una dirección pública que empiece por https.')
        opciones.medios = medios
      }

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
          /* un carrusel no es un render de Cherry: no hay master que esperar */
          ...(tipo === 'CAROUSEL' || opciones.medio === 'IMAGE' ? { master_estado: 'no' } : {}),
          /* v3: el master que se está fabricando (o ya listo) para esta publicación */
          ...(maestro && tipo !== 'CAROUSEL' ? { render_master: maestro.id, master_estado: 'preparando' } : {}),
        }),
      })
      /* v2: el master se pide YA, en el servidor (aunque se cierre la página). Si falla aquí, lo reintenta el reloj. */
      let master = null
      try { if (f?.[0]) master = await prepararMaster(f[0]) }
      catch (e) { console.error('[ig-publicar] master al programar: ' + (e instanceof Error ? e.message : String(e))) }
      return responder({ ok: true, publicacion: f?.[0], master })
    }

    throw new Error('No sé qué hacer con «' + modo + '».')

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ig-publicar]', msg)
    return responder({ error: msg }, /sesión/i.test(msg) ? 401 : 500)
  }
})

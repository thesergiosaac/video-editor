// cherry-mcp — Cherry desde el chat (14-oct-2026). Conector MCP (Streamable HTTP, sin estado) para que Claude haga en la
// cuenta de Cherry lo mismo que las pantallas: guiones, ganchos, mis videos con su sweet, «Lo siguiente», texto de la
// publicación, carrusel, desmontar, el calendario y «Antes de subir» (ver docs/CHERRY-MCP.md).
//
// Fase A: UN solo dueño. Entra con la llave personal CHERRY_MCP_LLAVE y actúa como CHERRY_MCP_UID. No hay sesión de
// usuario: llama a las funciones de siempre con la llave interna (SVC_JWT) y lee/escribe herramientas_datos con la del
// servidor, SIEMPRE filtrando por ese user_id. La fase B (clientes) cambia la llave por el inicio de sesión de cada uno.
//
// ⚠️ Los documentos (laboratorio, calendario@marca) se guardan ENTEROS, igual que la página: si Cherry está abierta en el
// navegador, su próximo guardado pisa lo que haga esto. Lo mismo pasa entre dos pestañas; se avisa en las respuestas.
// Detalle y cómo se conecta: docs/CHERRY-MCP.md

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const LLAVE_SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const OPENAI = Deno.env.get('OPENAI_API_KEY') ?? ''
const LLAVE_MCP = Deno.env.get('CHERRY_MCP_LLAVE') ?? ''
const UID = Deno.env.get('CHERRY_MCP_UID') ?? ''
const S3 = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/'
const CDN = 'https://d2b7db4md5k57t.cloudfront.net/'
const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05']
const AVISO_PAGINA = 'Si tienes esa pantalla de Cherry abierta, recárgala antes de tocar nada: si no, al guardar pisa este cambio.'

const t = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const hoy = () => new Date().toISOString().slice(0, 10)
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const urlVideo = (u: string) => typeof u === 'string' && u.startsWith(S3) ? CDN + u.slice(S3.length) : u

/* ── La llave: comparación en tiempo constante ── */
function llaveValida(req: Request): boolean {
  const a = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!LLAVE_MCP || LLAVE_MCP.length < 32 || a.length !== LLAVE_MCP.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ LLAVE_MCP.charCodeAt(i)
  return d === 0
}

/* ── La base, con la llave del servidor (siempre filtrando por el dueño) ── */
async function rest(camino: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${camino}`, {
    ...init,
    headers: { apikey: LLAVE_SRV, Authorization: `Bearer ${LLAVE_SRV}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${txt.slice(0, 200)}`)
  return txt ? JSON.parse(txt) : null
}
async function leerDoc(herramienta: string): Promise<any> {
  const f = await rest(`herramientas_datos?select=datos&user_id=eq.${UID}&herramienta=eq.${encodeURIComponent(herramienta)}`)
  return Array.isArray(f) && f[0] ? f[0].datos : null
}
async function guardarDoc(herramienta: string, datos: unknown) {
  await rest('herramientas_datos?on_conflict=user_id,herramienta', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: UID, herramienta, datos, updated_at: new Date().toISOString() }),
  })
}
/* la marca activa: la misma regla que cherry.js (marcaDeDoc) y la base (marca_activa_de) */
function marcaDe(lab: any): string {
  const cs = Array.isArray(lab?.cuentas) ? lab.cuentas : []
  if (lab?.activa && cs.some((c: any) => c?.id === lab.activa)) return lab.activa
  return cs[0]?.id || 'principal'
}
/* (15-oct) cada chat escoge su marca: llega en «marca» (el id o el nombre, sin importar mayúsculas ni espacios). Sin marca,
   la activa en Cherry. NO cambia la activa de la página: dos chats pueden ir cada uno con la suya. */
const llanito = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
function marcaPedida(L: any, pedida: unknown): string {
  const cs = Array.isArray(L?.cuentas) ? L.cuentas : []
  const q = llanito(pedida)
  if (!q) return marcaDe(L)
  const c = cs.find((x: any) => llanito(x?.id) === q || llanito(x?.nombre) === q)
    || cs.find((x: any) => llanito(x?.nombre).includes(q) || q.includes(llanito(x?.nombre)))
  if (!c) throw new Error(`No encontré la marca «${t(pedida, 40)}». Las marcas son: ${cs.map((x: any) => x.nombre || x.id).join(', ')}.`)
  return c.id
}
async function contexto(pedida?: unknown) {
  const [lab, marcaDoc] = await Promise.all([leerDoc('laboratorio'), leerDoc('marca')])
  const L = lab && typeof lab === 'object' ? lab : {}
  const marca = marcaPedida(L, pedida)
  const cuenta = (Array.isArray(L.cuentas) ? L.cuentas : []).find((c: any) => c?.id === marca) || null
  const m = marcaDoc?.porMarca?.[marca] || null
  const voz = m && (!m.usos || m.usos.guiones !== false)
    ? { tono: m.tono || null, frases: Array.isArray(m.frases) ? m.frases.map((f: any) => ({ tipo: f.tipo, texto: f.texto })) : [] }
    : null
  return { lab: L, marca, defecto: (Array.isArray(L.cuentas) && L.cuentas[0]?.id) || 'principal', nombreMarca: cuenta?.nombre || marca, calco: cuenta?.calco || {}, voz }
}

/* ── Las funciones de siempre, con la llave interna ── */
async function funcion(nombre: string, cuerpo: unknown, extra: Record<string, string> = {}) {
  const r = await fetch(`${SB_URL}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LLAVE_SRV}`, 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(cuerpo),
  })
  const txt = await r.text()
  let d: any = null
  try { d = JSON.parse(txt) } catch (_) { throw new Error(`${nombre} respondió ${r.status}: ${txt.slice(0, 200)}`) }
  if (!r.ok || d?.error) throw new Error(`${nombre}: ${d?.error || r.status}`)
  return d
}

/* lo mismo, con un formulario (lab-ver-video recibe multipart, como desde la página) */
async function funcionForma(nombre: string, forma: FormData) {
  const r = await fetch(`${SB_URL}/functions/v1/${nombre}`, { method: 'POST', headers: { Authorization: `Bearer ${LLAVE_SRV}` }, body: forma })
  const txt = await r.text()
  let d: any = null
  try { d = JSON.parse(txt) } catch (_) { throw new Error(`${nombre} respondió ${r.status}: ${txt.slice(0, 200)}`) }
  if (!r.ok || d?.error) throw new Error(`${nombre}: ${d?.error || r.status}`)
  return d
}

/* ══ EL SWEET (copia exacta de herramientas/lab-sweet.js: si cambia allá, cambiar aquí) ══ */
const num = (x: unknown) => { const v = Number(x); return x != null && x !== '' && isFinite(v) ? v : null }
const cl = (x: number) => Math.max(0, Math.min(1, x))
const normalDe = (dur: unknown) => { const d = num(dur); return d && d > 0 ? 185 * Math.pow(d, -0.5) : null }
function sweet(v: any): number | null {
  const vis = num(v.visitas ?? v.vistas)
  if (!vis || vis <= 0) return null
  const ret = num(v.retencion), nor = normalDe(v.dur)
  const acc = [v.meGusta, v.comentarios, v.reposts, v.guardados].map(num)
  const hay = acc.some((x) => x != null)
  const e = hay ? 100 * ((acc[0] || 0) + 2 * (acc[1] || 0) + 3 * (acc[2] || 0) + 3 * (acc[3] || 0)) / vis : null
  const p: Record<string, number | null> = {
    V: cl((Math.log10(vis) - 3) / (Math.log10(2000000) - 3)),
    R: ret != null && nor ? cl(ret / nor - 0.5) : null,
    I: e != null ? cl(Math.sqrt(e / 20)) : null,
  }
  if (p.R == null && p.I == null) return null
  const PESOS: Record<string, number> = { V: 0.40, R: 0.30, I: 0.30 }
  let tw = 0, s = 0
  for (const k of Object.keys(PESOS)) if (p[k] != null) { tw += PESOS[k]; s += PESOS[k] * Math.log(Math.max(p[k] as number, 0.02)) }
  return Math.round(1000 * Math.exp(s / tw)) / 10
}
const mediana = (xs: number[]) => {
  const a = xs.slice().sort((x, y) => x - y), n = a.length
  return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null
}
const r1 = (x: number | null) => x == null ? null : Math.round(x * 10) / 10
const forma = (e: unknown) => {
  const out: string[] = []
  String(e || '').split('→').map((x) => x.trim()).filter(Boolean).forEach((x) => { if (out[out.length - 1] !== x) out.push(x) })
  return out.join(' → ')
}
function piezas(v: any) {
  const h = v.historial?.piezas
  if (h && (h.tema || h.gancho || h.formato)) return { tema: h.tema || '', angulo: h.angulo || h.idea || '', gancho: h.gancho || '', frase: h.gancho_frase || '', formato: h.formato || '', estructura: h.estructura || '' }
  return null
}
const sinVoz = (p: any) => /amara\.org/i.test(p.frase || '') || !forma(p.estructura).replace(/^Gancho$/, '')

/* los reels de la marca activa (los del historial del servidor: ya traen números y piezas) */
async function videosDeMarca(marca: string) {
  const r = await funcion('historial', { accion: 'lista', user_id: UID })
  return (Array.isArray(r?.videos) ? r.videos : []).filter((v: any) => v.cuenta === marca)
}

/* ══ Las herramientas ══ */
type Herr = { descripcion: string; entrada: any; hacer: (a: any) => Promise<unknown> }

const H: Record<string, Herr> = {
  mis_marcas: {
    descripcion: 'Las marcas de la cuenta de Cherry (cada una con sus videos, guiones, calendario y voz) y cuál está activa en la página. Al empezar un chat, si el creador no dijo con qué marca trabaja, pregúntaselo con esta lista; luego pasa «marca» en TODAS las acciones.',
    entrada: { type: 'object', properties: {} },
    hacer: async () => {
      const L = (await leerDoc('laboratorio')) || {}
      const activa = marcaDe(L)
      return { marcas: (Array.isArray(L.cuentas) ? L.cuentas : []).map((c: any) => ({ marca: c.nombre || c.id, id: c.id, activa_en_cherry: c.id === activa })) }
    },
  },

  mis_videos: {
    descripcion: 'Los reels de Instagram de la marca activa en Cherry con sus números (vistas, retención, omisión, guardados, compartidos) y su SWEET (0–100 %, la métrica de Cherry), más «El diagnóstico de tu cuenta»: en qué tramo están fallando (¿paran el scroll? ¿se quedan? ¿les sirvió?). Solo lee.',
    entrada: { type: 'object', properties: { cuantos: { type: 'integer', description: 'Cuántos videos recientes listar (por defecto 15, máx. 60).' } } },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const vs = await videosDeMarca(c.marca)
      const conSweet = vs.map((v: any) => ({ v, s: sweet(v), p: piezas(v) }))
        .sort((x: any, y: any) => String(y.v.fecha || '').localeCompare(String(x.v.fecha || '')))
      const n = Math.max(1, Math.min(60, Math.round(Number(a?.cuantos) || 15)))
      const sweets = conSweet.filter((o: any) => o.s != null && !(o.p && sinVoz(o.p))).map((o: any) => o.s)
      return {
        marca: c.nombreMarca,
        total_reels: vs.length,
        sweet_mediana: r1(mediana(sweets)),
        diagnostico: diagnostico(conSweet),
        videos: conSweet.slice(0, n).map(({ v, s, p }: any) => ({
          ig_media_id: v.igMediaId, fecha: v.fecha, titulo: t(v.titulo || v.texto, 120), enlace: v.enlace, segundos: v.dur,
          vistas: v.visitas, alcance: v.alcance, retencion_pct: v.retencion, omision_pct: v.omisiones,
          me_gusta: v.meGusta, comentarios: v.comentarios, guardados: v.guardados, compartidos: v.reposts,
          sweet_pct: s, piezas: p ? { tema: p.tema, angulo: p.angulo, gancho: p.gancho, frase_gancho: p.frase, formato: p.formato, estructura: forma(p.estructura) } : null,
        })),
      }
    },
  },

  que_grabar: {
    descripcion: '«Lo siguiente» del Laboratorio: qué grabar ahora. Junta lo que mejor le ha funcionado a la marca (la idea, el gancho, el formato y la estructura con la mediana de SWEET más alta, mínimo 3 reels cada uno). combinacion=1, 2… da la siguiente mejor. Solo lee; para escribirlo, usar planear_guion con esa idea.',
    entrada: { type: 'object', properties: { combinacion: { type: 'integer', description: '0 = la mejor (por defecto); 1 = la segunda mejor de cada pieza; etc.' } } },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const vs = await videosDeMarca(c.marca)
      return loQueFunciona(vs, Math.max(0, Math.round(Number(a?.combinacion) || 0)), c.nombreMarca)
    },
  },

  ganchos: {
    descripcion: 'Unos 10 ganchos, uno por cada molde de gancho de Cherry que ha funcionado (con lo que se dice y lo que se ve). Con «tema»: ganchos sueltos para ese tema, no guarda nada. Con «ficha_id» (PASO 2 del guion, después de planear_guion): ganchos hechos para ESE plan, que quedan en la ficha para escribir_guion. Usa IA (Claude), ~25–60 s, sin créditos.',
    entrada: { type: 'object', properties: { tema: { type: 'string', description: 'De qué trata el video, con las palabras del creador.' }, ficha_id: { type: 'string', description: 'La ficha creada con planear_guion.' } } },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const lista = (gs: any[]) => (gs || []).map((g: any) => ({ id: g.id, molde: g.nombre, dice: g.dice, se_ve: g.ve }))
      if (a?.ficha_id) {
        const f = (c.lab.planes || []).find((p: any) => p.id === a.ficha_id)
        if (!f?.mcpPlan?.plan) throw new Error('Esa ficha no tiene plan: primero planear_guion.')
        const mp = f.mcpPlan
        const r = await funcion('guion-calco', { accion: 'ganchos', modo: mp.modo, texto: mp.texto, cuenta: c.calco, plan: mp.plan })
        const lab2 = (await leerDoc('laboratorio')) || {}
        const f2 = (lab2.planes || []).find((p: any) => p.id === f.id)
        if (f2?.mcpPlan) { f2.mcpPlan.ganchos = r.ganchos || []; await guardarDoc('laboratorio', lab2) }
        return { ficha_id: f.id, ganchos: lista(r.ganchos), siguiente: 'Escoge uno y llama escribir_guion con ficha_id y gancho_id.' }
      }
      if (!t(a?.tema, 10)) throw new Error('Falta el tema (o la ficha_id).')
      const r = await funcion('guion-calco', { accion: 'ganchos', modo: 'tema', texto: t(a.tema, 2000), cuenta: c.calco })
      return { secreto: r.secreto, ganchos: lista(r.ganchos) }
    },
  },

  planear_guion: {
    descripcion: 'PASO 1 de escribir un guion premium (el de «Guiones»). Arma el plan del video (problema, creencia, concepto, ejemplo, objeción, llamado a la acción) con la mejor estructura «firme» de Cherry. Crea la ficha en Guiones (queda «Por grabar», sin texto aún) y devuelve su ficha_id. Usa IA (Claude), ~1 min, sin créditos. Después: ganchos con esa ficha_id (paso 2) y escribir_guion con el gancho escogido (paso 3). Los tres pasos van separados porque el servidor corta cada uno a los 150 s.',
    entrada: {
      type: 'object', required: ['tema'], properties: {
        tema: { type: 'string', description: 'De qué trata (o lo que el creador quiere decir), mínimo 3 palabras.' },
        modo: { type: 'string', enum: ['describo', 'tema', 'objetivo'], description: '«describo» = el creador cuenta lo que quiere decir (por defecto); «tema» = solo un tema; «objetivo» = lo que quiere lograr.' },
        titulo: { type: 'string', description: 'Nombre corto para la ficha (si no, se usa el del plan).' },
      },
    },
    hacer: async (a) => {
      const texto = t(a?.tema, 3000)
      if (texto.split(' ').length < 3) throw new Error('Cuéntame el tema con al menos 3 palabras.')
      const modo = ['describo', 'tema', 'objetivo'].includes(a?.modo) ? a.modo : 'describo'
      const c = await contexto(a?.marca)
      if (!c.calco?.deQueHabla) throw new Error('A la marca le falta «de qué hablas» (en Guiones, la primera vez). Llénalo en Cherry y vuelve a intentar.')
      const bib = await funcion('guion-calco', { accion: 'biblioteca' })
      const pl = (bib.plantillas || []).find((p: any) => p.estado === 'firme') || (bib.plantillas || [])[0]
      if (!pl) throw new Error('No hay plantillas de estructura en la biblioteca.')
      const r = await funcion('guion-calco', { accion: 'planear', plantilla: pl.id, gancho: 'contra', modo, texto, cuenta: c.calco })
      const lab = (await leerDoc('laboratorio')) || {}
      lab.planes = Array.isArray(lab.planes) ? lab.planes : []
      const f = {
        id: nid(), creado: hoy(), cuenta: c.marca, titulo: t(a?.titulo, 80) || t(r.plan?.concepto || texto, 80), grabado: false,
        base: null, cambia: 'Desde el chat', noTocar: [], numero: null, piezas: {}, dur: null, fechaGrabar: '', fechaPublicar: '',
        guion: [], auditoria: null,
        mcpPlan: { plantilla: pl.id, modo, texto, plan: r.plan, ganchos: [] },
      }
      lab.planes.unshift(f)
      await guardarDoc('laboratorio', lab)
      return {
        ficha_id: f.id, titulo: f.titulo, estructura: pl.nombre, plan: r.plan,
        siguiente: 'Ahora ganchos con esta ficha_id; el creador escoge uno; luego escribir_guion.',
        aviso: AVISO_PAGINA,
      }
    },
  },

  escribir_guion: {
    descripcion: 'PASO 3: escribe el guion premium de una ficha creada con planear_guion, escena por escena (lo que se dice y lo que se ve), con el gancho escogido, y lo guarda en la ficha de Guiones. Usa Claude Opus 5.5 (~2 min). Para el dueño no gasta créditos.',
    entrada: {
      type: 'object', required: ['ficha_id', 'gancho_id'], properties: {
        ficha_id: { type: 'string' },
        gancho_id: { type: 'string', description: 'El id de uno de los ganchos que devolvió planear_guion.' },
        gancho_texto: { type: 'string', description: 'Opcional: la frase del gancho cambiada a mano.' },
        segundos: { type: 'integer', description: 'Duración buscada, 40 a 110 s (si no, la decide Cherry).' },
      },
    },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const lab = c.lab
      const f = (lab.planes || []).find((p: any) => p.id === a?.ficha_id)
      if (!f) throw new Error('No encontré esa ficha.')
      const mp = f.mcpPlan
      if (!mp?.plan) throw new Error('Esa ficha no tiene plan: primero planear_guion.')
      const g = (mp.ganchos || []).find((x: any) => x.id === a.gancho_id)
      const cuerpo: any = { accion: 'escribir', modelo: 'claude-opus-5-5', plantilla: mp.plantilla, modo: mp.modo, texto: mp.texto, cuenta: c.calco, plan: mp.plan, gancho: a.gancho_id, voz: c.voz ? { tono: c.voz.tono } : null }
      if (t(a?.gancho_texto, 5)) cuerpo.ganchoLibre = t(a.gancho_texto, 300)
      else if (g?.dice) cuerpo.ganchoTexto = g.dice
      if (num(a?.segundos)) cuerpo.dur = Math.max(40, Math.min(110, Math.round(Number(a.segundos))))
      const r = await funcion('guion-calco', cuerpo)
      const NOMBRE: Record<string, string> = { G: 'Gancho', D: 'Descarte', A: 'Open loop', C: 'Credencial', K: 'Concepto', E: 'Cuerpo', B: 'Objeción', P: 'Pregunta puente', O: 'CTA', R: 'Remate' }
      /* se vuelve a leer: mientras escribía (2 min) pudo cambiar algo */
      const lab2 = (await leerDoc('laboratorio')) || {}
      const f2 = (lab2.planes || []).find((p: any) => p.id === f.id)
      if (!f2) throw new Error('La ficha se borró mientras se escribía.')
      f2.guion = (r.escenas || []).map((x: any) => ({ escena: NOMBRE[x.paso] || x.nombre || 'Cuerpo', clase: 'hablada', dice: x.dice || '', ve: x.ve || '' }))
      f2.dur = r.dur ?? f2.dur
      f2.titulo = f2.titulo || r.titulo
      f2.calco = { plantilla: mp.plantilla, calco: r.calco || 'plan', gancho: a.gancho_id, concepto: r.concepto, modo: mp.modo }
      f2.auditoria = null
      delete f2.mcpPlan
      await guardarDoc('laboratorio', lab2)
      return { ficha_id: f2.id, titulo: f2.titulo, segundos: r.dur, escenas: f2.guion, avisos_del_revisor: r.quejas || [], aviso: AVISO_PAGINA }
    },
  },

  mis_guiones: {
    descripcion: 'Las fichas de Guiones de la marca activa: id, título, estado (Por grabar / Grabado / Publicado), fechas y, si se pide una, el guion entero. Solo lee.',
    entrada: { type: 'object', properties: { ficha_id: { type: 'string', description: 'Para ver una sola, entera.' }, cuantas: { type: 'integer', description: 'Por defecto 20.' } } },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const fs = (c.lab.planes || []).filter((p: any) => (p.cuenta || c.defecto) === c.marca)
      const estado = (p: any) => p.publicado ? 'Publicado' : p.grabado ? 'Grabado' : 'Por grabar'
      if (a?.ficha_id) {
        const f = fs.find((p: any) => p.id === a.ficha_id)
        if (!f) throw new Error('No encontré esa ficha en esta marca.')
        return { id: f.id, titulo: f.titulo, estado: estado(f), segundos: f.dur, grabar: f.fechaGrabar, publicar: f.fechaPublicar, escenas: f.guion || [], antes_de_subir: f.antes?.r || null, plan_pendiente: !!f.mcpPlan }
      }
      return { marca: c.nombreMarca, fichas: fs.slice(0, Math.max(1, Math.min(80, Number(a?.cuantas) || 20))).map((f: any) => ({ id: f.id, titulo: f.titulo, creada: f.creado, estado: estado(f), escenas: (f.guion || []).length, falta_escribir: !!f.mcpPlan })) }
    },
  },

  texto_publicacion: {
    descripcion: 'El texto (caption) para debajo de una publicación de Instagram/TikTok y 4–5 hashtags, con la voz de la marca. Usa IA (unos segundos), sin créditos. No guarda nada (para ponerlo en el calendario: calendario con accion=agregar).',
    entrada: {
      type: 'object', required: ['titulo'], properties: {
        titulo: { type: 'string' }, tipo: { type: 'string', enum: ['video', 'carrusel', 'historia'] },
        detalle: { type: 'string', description: 'De qué trata (el guion o un resumen): mientras más, mejor.' },
      },
    },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      return await funcion('herramientas', { accion: 'publicacion_texto', titulo: t(a?.titulo, 140), tipo: a?.tipo || 'video', detalle: t(a?.detalle, 1500), voz: c.voz })
    },
  },

  armar_carrusel: {
    descripcion: 'El CONTENIDO de un carrusel de Instagram lámina por lámina: 3 portadas para escoger, las ideas (título + texto), el cierre, el texto de la publicación y hashtags, con la voz de la marca. Usa IA, sin créditos. El diseño de las láminas se hace en Cherry (Carruseles): esto da el texto.',
    entrada: {
      type: 'object', required: ['tema'], properties: {
        tema: { type: 'string', description: 'El tema o un texto/guion de base.' },
        laminas: { type: 'integer', description: 'Ideas (1 a 10; por defecto 6).' },
        publico: { type: 'string' },
        objetivo: { type: 'string', description: 'Opcional: qué pide el cierre (p. ej. «vender», «automatizar» para palabra clave).' },
        palabra: { type: 'string', description: 'Palabra clave para comentar, si aplica.' },
      },
    },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const largo = t(a?.tema, 6000)
      const b: any = { accion: 'carrusel_armar', n: a?.laminas || 6, publico: a?.publico, objetivo: a?.objetivo, palabra: a?.palabra, voz: c.voz }
      if (largo.length > 300) { b.texto = largo; b.fuente = 'texto' } else b.tema = largo
      return await funcion('herramientas', b)
    },
  },

  desmontar_video: {
    descripcion: 'Desmonta un video (de referencia o propio): el gancho, la estructura parte por parte, el formato, los open loops y la idea, para copiar lo que funciona. Recibe UNA de tres: la transcripción pegada (texto), la dirección pública de un MP4 (video_url, máx. 25 MB) o uno de los reels propios (ig_media_id, de mis_videos). Usa Whisper + IA, ~30–60 s. No guarda nada.',
    entrada: {
      type: 'object', properties: {
        texto: { type: 'string', description: 'La transcripción, si ya la tienes (mín. 40 letras).' },
        segundos: { type: 'integer', description: 'Duración, si se sabe.' },
        video_url: { type: 'string' },
        ig_media_id: { type: 'string' },
      },
    },
    hacer: async (a) => {
      let texto = t(a?.texto, 9000), dur = num(a?.segundos) || 0
      if (!texto) {
        let bytes: Uint8Array
        if (a?.ig_media_id) {
          const id = String(a.ig_media_id).replace(/^ig:/, '')
          const r = await fetch(`${SB_URL}/functions/v1/lab-video-ig`, { method: 'POST', headers: { Authorization: `Bearer ${LLAVE_SRV}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ig_media_id: id, user_id: UID }) })
          if (!r.ok) throw new Error('No pude traer ese reel de Instagram: ' + (await r.text()).slice(0, 160))
          bytes = new Uint8Array(await r.arrayBuffer())
        } else if (a?.video_url) {
          const r = await fetch(urlVideo(String(a.video_url)))
          if (!r.ok) throw new Error(`No pude bajar el video (${r.status}).`)
          bytes = new Uint8Array(await r.arrayBuffer())
        } else throw new Error('Dame el texto, una dirección de video o un reel propio.')
        const w = await transcribir(bytes)
        texto = w.texto; dur = dur || w.dur
      }
      if (texto.length < 40) throw new Error('El video casi no tiene voz: no hay qué desmontar.')
      if (!dur) dur = Math.round(texto.split(' ').length / 3.4)
      const d = await funcion('herramientas', { accion: 'lab_desmontar', texto, dur })
      return { segundos: dur, transcripcion: texto, desmontaje: d }
    },
  },

  subir_video: {
    descripcion: 'Da una dirección para SUBIR un video del computador (PUT con el archivo, Content-Type video/mp4) y la dirección pública donde queda, para usarla en desmontar_video. Válida 2 horas.',
    entrada: { type: 'object', properties: { nombre: { type: 'string', description: 'Nombre del archivo (p. ej. final.mp4).' } } },
    hacer: async (a) => {
      const ext = (String(a?.nombre || 'video.mp4').split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
      const ruta = `${UID}/mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/publicar/${ruta}`, { method: 'POST', headers: { apikey: LLAVE_SRV, Authorization: `Bearer ${LLAVE_SRV}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 7200 }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.url) throw new Error('No se pudo preparar la subida: ' + JSON.stringify(d).slice(0, 160))
      return {
        subir_a: `${SB_URL}/storage/v1${d.url}`, metodo: 'PUT', encabezados: { 'Content-Type': 'video/mp4', 'x-upsert': 'false' },
        queda_en: `${SB_URL}/storage/v1/object/public/publicar/${ruta}`,
        ojo: 'El cubo «publicar» es público para leer: no subir nada privado.',
      }
    },
  },

  antes_de_subir: {
    descripcion: '«Antes de subir» del Laboratorio: compara un video YA GRABADO con su ficha de Guiones, escena por escena (está / dice otra cosa / solo se ve / falta), más el gancho, los open loops, las frases cortadas, el pedido del final y lo técnico (luz, audio). Gemini ve y oye el video entero. El video sale de un proyecto del editor (proyecto_id, de mis_proyectos) o de un enlace https a un MP4 (video_url, máx. 120 MB; para uno del computador, primero subir_video). Con ficha_id el resultado queda en la ficha (como en la página; si no estaba «Grabado», la marca); sin ficha solo mira el video y no guarda nada. Usa IA (Gemini), ~1–2 min, sin créditos.',
    entrada: {
      type: 'object', properties: {
        ficha_id: { type: 'string', description: 'La ficha de Guiones contra la que se compara (de mis_guiones).' },
        proyecto_id: { type: 'string', description: 'Un proyecto del editor de Cherry con video listo (de mis_proyectos).' },
        video_url: { type: 'string', description: 'O la dirección https de un MP4.' },
      },
    },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      let f: any = null
      if (a?.ficha_id) {
        f = (c.lab.planes || []).find((p: any) => p.id === a.ficha_id && (p.cuenta || c.defecto) === c.marca)
        if (!f) throw new Error('No encontré esa ficha en esta marca.')
        if (f.mcpPlan || !(f.guion || []).length) throw new Error('Esa ficha todavía no tiene guion: no hay con qué comparar.')
      }
      let url = '', nombre = '', texto = '', dur: number | null = null
      if (a?.proyecto_id) {
        const ps = (await rest(`projects?select=id,title&id=eq.${encodeURIComponent(a.proyecto_id)}&user_id=eq.${UID}&borrado_en=is.null`)) || []
        if (!ps[0]) throw new Error('No encontré ese proyecto.')
        const rs = (await rest(`renders?select=id,layer2_url,output_url,duraciones_reales,subtitle_phrases,clean_words_json&project_id=eq.${ps[0].id}&status=eq.done&order=created_at.desc&limit=1`)) || []
        const r = rs[0]
        if (!r || !(r.layer2_url || r.output_url)) throw new Error('Ese proyecto todavía no tiene video listo.')
        url = urlVideo(r.layer2_url || r.output_url)
        nombre = t(ps[0].title || 'Video sin nombre', 100) + '.mp4'
        /* lo que se dice: las palabras de su render, igual que CherryApp.transcripcion */
        const pal = r.subtitle_phrases?.palabras || r.clean_words_json || []
        texto = t((Array.isArray(pal) ? pal : []).map((w: any) => w?.word || w?.text || '').join(' '), 9000)
        if (Array.isArray(r.duraciones_reales)) dur = Math.round(r.duraciones_reales.reduce((s: number, x: any) => s + Number(x || 0), 0)) || null
      } else if (a?.video_url) {
        url = urlVideo(String(a.video_url).trim())
        if (!/^https:\/\//i.test(url)) throw new Error('El enlace del video tiene que empezar por https://')
        nombre = decodeURIComponent(url.split('?')[0].split('/').pop() || 'video.mp4').slice(0, 100)
      } else throw new Error('Dame el proyecto (proyecto_id) o el enlace del video (video_url).')
      dur = (await duracionPorRango(url)) || dur
      if (!dur) throw new Error('No pude leer cuánto dura ese video: ¿es un MP4?')

      const forma = new FormData()
      forma.append('modo', 'antes'); forma.append('video_url', url); forma.append('dur', String(dur))
      forma.append('texto', texto); forma.append('ficha', JSON.stringify(fichaParaGemini(c.lab, f)))
      const res = await funcionForma('lab-ver-video', forma)
      if (!res?.antes) throw new Error('Cherry no pudo mirar el video.')

      let guardada = false
      if (f) {
        /* se vuelve a leer: mientras miraba (1–2 min) pudo cambiar algo */
        const lab2 = (await leerDoc('laboratorio')) || {}
        const f2 = (lab2.planes || []).find((p: any) => p.id === f.id)
        if (!f2) throw new Error('La ficha se borró mientras se miraba el video.')
        f2.antes = { cuando: hoy(), dur, nombre, texto, r: res.antes }
        f2.antesAcepta = {}
        if (!f2.grabado) { f2.grabado = true; f2.fechaGrabado = hoy() }   // la pantalla solo lista las grabadas
        await guardarDoc('laboratorio', lab2)
        guardada = true
      }
      const A = res.antes
      const ESTADO: Record<string, string> = { esta: 'está', distinto: 'dice otra cosa', sinVoz: 'no se oye, solo se ve', falta: 'falta' }
      return {
        ficha_id: f?.id || null, titulo: f?.titulo || null, video: nombre, segundos: dur,
        ojo: f && !(f.guion || []).some((e: any) => t(e?.dice, 5)) ? 'La ficha tiene las escenas pero sin texto: la comparación escena por escena no dice nada. Escribe el guion para que sirva.' : undefined,
        escenas: (A.escenas || []).map((e: any) => ({ n: e.n, escena: t(f?.guion?.[e.n - 1]?.escena, 60), como: ESTADO[e.estado] || e.estado, seg: e.seg, se_oye: e.dice, en_pantalla: e.enPantalla || undefined })),
        gancho: A.gancho, open_loops: A.loops, frases_cortadas: A.cortes, idea: A.idea, pedido: A.pedido, nota: A.nota,
        produccion: A.produccion, tecnico: A.tecnico,
        guardado: guardada ? 'Quedó en la ficha: se ve en Laboratorio → Antes de subir.' : 'Sin ficha: no se guardó nada.',
        aviso: guardada ? AVISO_PAGINA : undefined,
      }
    },
  },

  mis_proyectos: {
    descripcion: 'Los proyectos del editor de Cherry de la marca activa que ya tienen video listo, con la dirección del video (para desmontar_video o el calendario). Solo lee.',
    entrada: { type: 'object', properties: {} },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const def = (Array.isArray(c.lab.cuentas) && c.lab.cuentas[0]?.id) || 'principal'
      const ps = ((await rest(`projects?select=id,title,created_at,marca&borrado_en=is.null&user_id=eq.${UID}&order=created_at.desc&limit=150`)) || [])
        .filter((p: any) => (p.marca || def) === c.marca).slice(0, 40)
      if (!ps.length) return { proyectos: [] }
      const rs = (await rest(`renders?select=project_id,created_at,layer2_url,output_url,duraciones_reales&project_id=in.(${ps.map((p: any) => p.id).join(',')})&status=eq.done&order=created_at.desc&limit=200`)) || []
      const ult: Record<string, any> = {}
      for (const r of rs) if (!ult[r.project_id]) ult[r.project_id] = r
      return {
        proyectos: ps.filter((p: any) => ult[p.id]).map((p: any) => {
          const r = ult[p.id]
          const dur = Array.isArray(r.duraciones_reales) ? Math.round(r.duraciones_reales.reduce((s: number, x: any) => s + Number(x || 0), 0)) : null
          return { id: p.id, titulo: p.title || 'Video sin nombre', creado: p.created_at, segundos: dur, video_url: urlVideo(r.layer2_url || r.output_url) }
        }),
      }
    },
  },

  calendario: {
    descripcion: 'El Calendario de la marca activa. accion=ver lista lo programado desde una fecha; accion=agregar pone una publicación (queda como borrador y recordatorio: NO se publica sola en Instagram; eso se programa en Cherry); accion=quitar la borra del calendario.',
    entrada: {
      type: 'object', required: ['accion'], properties: {
        accion: { type: 'string', enum: ['ver', 'agregar', 'quitar'] },
        desde: { type: 'string', description: 'ver: AAAA-MM-DD (por defecto hoy).' },
        titulo: { type: 'string' }, tipo: { type: 'string', enum: ['video', 'carrusel', 'historia'] },
        fecha: { type: 'string', description: 'agregar: AAAA-MM-DD.' }, hora: { type: 'string', description: 'agregar: HH:MM (por defecto 18:00).' },
        texto: { type: 'string', description: 'agregar: el caption.' },
        hashtags: { type: 'array', items: { type: 'string' } },
        redes: { type: 'array', items: { type: 'string', enum: ['ig', 'tt', 'yt', 'fb'] } },
        id: { type: 'string', description: 'quitar: el id de la publicación.' },
      },
    },
    hacer: async (a) => {
      const c = await contexto(a?.marca)
      const llave = `calendario@${c.marca}`
      const doc = (await leerDoc(llave)) || { v: 1, posts: [] }
      doc.posts = Array.isArray(doc.posts) ? doc.posts : []
      if (a?.accion === 'ver') {
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(a?.desde || '') ? a.desde : hoy()
        return {
          marca: c.nombreMarca,
          publicaciones: doc.posts.filter((p: any) => !p.borrar && String(p.fecha || '') >= desde)
            .sort((x: any, y: any) => (String(x.fecha) + String(x.hora || '')).localeCompare(String(y.fecha) + String(y.hora || '')))
            .map((p: any) => ({ id: p.id, fecha: p.fecha, hora: p.hora, titulo: p.titulo, tipo: p.tipo, estado: p.estado, redes: p.redes, texto: t(p.caption, 300), hashtags: p.tags })),
        }
      }
      if (a?.accion === 'agregar') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(a?.fecha || '')) throw new Error('La fecha va como AAAA-MM-DD.')
        if (!t(a?.titulo, 3)) throw new Error('Falta el título.')
        const p = {
          id: 'n' + Date.now(), proyecto: null, titulo: t(a.titulo, 140), tipo: ['video', 'carrusel', 'historia'].includes(a?.tipo) ? a.tipo : 'video',
          redes: Array.isArray(a?.redes) && a.redes.length ? a.redes : ['ig'], fecha: a.fecha, hora: /^\d{2}:\d{2}$/.test(a?.hora || '') ? a.hora : '18:00',
          estado: 'borrador', caption: String(a?.texto || '').slice(0, 2200),
          tags: (Array.isArray(a?.hashtags) ? a.hashtags : []).map((x: string) => '#' + t(x, 40).replace(/^#/, '')).slice(0, 30), portada: 0,
        }
        doc.posts.push(p)
        await guardarDoc(llave, doc)
        return { agregada: p, aviso: AVISO_PAGINA }
      }
      if (a?.accion === 'quitar') {
        const antes = doc.posts.length
        doc.posts = doc.posts.filter((p: any) => p.id !== a?.id)
        if (doc.posts.length === antes) throw new Error('No encontré esa publicación.')
        await guardarDoc(llave, doc)
        return { quitada: a.id, aviso: AVISO_PAGINA }
      }
      throw new Error('accion: ver, agregar o quitar.')
    },
  },
}

/* ══ «Lo siguiente» y el diagnóstico (copias de laboratorio.html: loQueFunciona/combinacionSig y diagnostico) ══ */
function loQueFunciona(videos: any[], k: number, nombreMarca: string) {
  const todos = videos.map((v) => ({ v, p: piezas(v), r: sweet(v) })).filter((o) => o.p && o.r != null)
  const vs = todos.filter((o) => !sinVoz(o.p))
  if (vs.length < 3) return { marca: nombreMarca, faltan_datos: true, reels_con_sweet: vs.length, nota: 'Hacen falta al menos 3 reels con voz y números.' }
  const ranking = (clave: (o: any) => string) => {
    const g: Record<string, any[]> = {}
    vs.forEach((o) => { const x = clave(o); if (x) (g[x] = g[x] || []).push(o) })
    return Object.keys(g).map((x) => ({ k: x, its: g[x], n: g[x].length, med: mediana(g[x].map((o) => o.r)) as number }))
      .filter((x) => x.n >= 3).sort((a, b) => (b.med - a.med) || (b.n - a.n))
  }
  const R = { idea: ranking((o) => o.p.tema), gancho: ranking((o) => o.p.gancho), formato: ranking((o) => o.p.formato), estructura: ranking((o) => forma(o.p.estructura)) }
  const toma = (l: any[]) => l.length ? l[Math.min(k, l.length - 1)] : null
  const c: any = { idea: toma(R.idea), gancho: toma(R.gancho), formato: toma(R.formato), estructura: toma(R.estructura) }
  let angulo = ''
  if (c.idea) {
    const g: Record<string, number[]> = {}
    c.idea.its.forEach((o: any) => { if (o.p.angulo) (g[o.p.angulo] = g[o.p.angulo] || []).push(o.r) })
    const ang = Object.keys(g).map((x) => ({ a: x, n: g[x].length, med: mediana(g[x]) as number }))
    const varios = ang.filter((x) => x.n >= 2)
    angulo = ((varios.length ? varios : ang).sort((a, b) => (b.med - a.med) || (b.n - a.n))[0] || {} as any).a || ''
  }
  const pieza = (x: any) => x ? { cual: x.k, sweet_mediana: r1(x.med), reels: x.n } : null
  return {
    marca: nombreMarca, combinacion: k, tu_sweet_mediana: r1(mediana(vs.map((o) => o.r))), reels_usados: vs.length,
    idea: c.idea ? { ...pieza(c.idea), angulo } : null, gancho: pieza(c.gancho), formato: pieza(c.formato),
    estructura: c.estructura ? { ...pieza(c.estructura), pasos: c.estructura.k.split(' → ') } : null,
    siguiente: 'Para escribirlo: planear_guion con el ángulo como tema.',
  }
}

function diagnostico(lista: any[]) {
  const vs = lista.map(({ v, p }: any) => {
    const vis = Number(v.visitas) || 0, nor = normalDe(v.dur)
    const mueve = (Number(v.guardados) || 0) + (Number(v.reposts) || 0) + (Number(v.enviados) || 0)
    return {
      v, p,
      om: v.omisiones != null && isFinite(v.omisiones) && String(v.fecha || '') >= '2024-07-01' ? Number(v.omisiones) : null,
      justa: v.retencion != null && nor ? Number(v.retencion) / nor : null,
      sirve: vis >= 300 ? 100 * mueve / vis : null,
    }
  }).filter((o) => !(o.p && sinVoz(o.p)) && (Number(o.v.visitas) || 0) > 0)
    .sort((a, b) => String(b.v.fecha || '').localeCompare(String(a.v.fecha || '')))
  const TRAMOS = [
    { q: '¿Paran el scroll?', manda: 'el gancho', clave: 'om', pasa: (x: number) => x <= 55, unidad: '% lo saltan (omisión de Instagram); pasa con 55 o menos' },
    { q: '¿Se quedan?', manda: 'el guion', clave: 'justa', pasa: (x: number) => x >= 1, unidad: '× la retención normal para su duración; pasa con 1 o más' },
    { q: '¿Les sirvió?', manda: 'la idea', clave: 'sirve', pasa: (x: number) => x >= 1, unidad: 'de cada 100 lo guardan o comparten; pasa con 1 o más' },
  ]
  let falla: string | null = null
  const tramos = TRAMOS.map((T) => {
    const l = vs.filter((o: any) => o[T.clave] != null && isFinite(o[T.clave]))
    const K = Math.min(15, Math.floor(l.length / 2)), rec = l.slice(0, K), ant = l.slice(K, 2 * K)
    const pasan = rec.filter((o: any) => T.pasa(o[T.clave])).length
    const est = K < 3 ? 'sin datos' : pasan / K < 0.5 ? (falla ? 'ojo' : 'falla') : 'bien'
    if (est === 'falla') falla = T.q
    const r2 = (x: number | null) => x == null ? null : Math.round(x * 100) / 100
    return { pregunta: T.q, lo_manda: T.manda, estado: est, ultimos: K, pasan, mediana_ultimos: r2(K ? mediana(rec.map((o: any) => o[T.clave])) : null), mediana_anteriores: r2(ant.length ? mediana(ant.map((o: any) => o[T.clave])) : null), unidad: T.unidad }
  })
  return { compara: 'los últimos reels contra los anteriores (hasta 15 y 15)', falla_primero: falla, tramos }
}

/* ── Whisper directo (el reel suele pesar poco; lab-transcribir solo acepta WAV) ── */
async function transcribir(bytes: Uint8Array): Promise<{ texto: string; dur: number }> {
  if (bytes.length > 25 * 1024 * 1024) throw new Error('Ese video pesa más de 25 MB: para desmontarlo pega la transcripción o usa uno más corto.')
  const fd = new FormData()
  fd.append('file', new File([bytes], 'video.mp4', { type: 'video/mp4' }))
  fd.append('model', 'whisper-1'); fd.append('language', 'es'); fd.append('response_format', 'verbose_json')
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: fd })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('No se pudo transcribir: ' + (d?.error?.message || r.status))
  return { texto: t(d.text, 9000), dur: Math.round(Number(d.duration) || 0) }
}
/* la duración de un MP4: caja mvhd (igual que historial.ts) */
function duracionMp4(b: Uint8Array): number | null {
  const tope = Math.min(b.length, 8 * 1024 * 1024)
  let i = -1
  for (let k = 0; k + 3 < tope; k++) if (b[k] === 0x6d && b[k + 1] === 0x76 && b[k + 2] === 0x68 && b[k + 3] === 0x64) { i = k; break }
  if (i < 0) {   // moov al final
    for (let k = b.length - 4; k > tope; k--) if (b[k] === 0x6d && b[k + 1] === 0x76 && b[k + 2] === 0x68 && b[k + 3] === 0x64) { i = k; break }
  }
  if (i < 0) return null
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const ver = b[i + 4]
  const escala = ver === 1 ? v.getUint32(i + 24) : v.getUint32(i + 16)
  const dura = ver === 1 ? Number(v.getBigUint64(i + 28)) : v.getUint32(i + 20)
  return escala ? Math.round(dura / escala) : null
}

/* la ficha como la recibe lab-ver-video: la misma que adsFicha() de laboratorio.html (idea y gancho, de sus piezas) */
function fichaParaGemini(lab: any, f: any) {
  if (!f) return { escenas: [] }
  const pz = (k: string) => {
    const id = f.piezas?.[k]
    const p = id ? (lab?.piezas?.[k] || []).find((x: any) => x?.id === id) : null
    return p ? (p.texto || '') : ''
  }
  return {
    titulo: f.titulo || '', idea: pz('idea'), gancho: pz('gancho'),
    escenas: (f.guion || []).map((e: any, i: number) => ({ n: i + 1, nombre: e.escena || '', dice: e.dice || '', ve: e.ve || '' })),
  }
}
/* la duración sin bajar el video: el principio por Range (la caja mvhd va en el moov) y, si el moov está al final, el final */
async function duracionPorRango(url: string): Promise<number | null> {
  const trozo = async (rango: string) => {
    const r = await fetch(url, { headers: { Range: rango } })
    if (!r.ok) throw new Error(`No pude abrir el video (${r.status}).`)
    if (r.status !== 206) { await r.body?.cancel(); return null }   // no admite Range: no se baja entero aquí
    return new Uint8Array(await r.arrayBuffer())
  }
  const ini = await trozo('bytes=0-1048575')
  const d = ini && duracionMp4(ini)
  if (d) return d
  const fin = await trozo('bytes=-4194304')
  return fin ? duracionMp4(fin) : null
}

/* ══ El protocolo MCP (JSON-RPC 2.0 por POST; sin flujo ni sesión) ══ */
async function atender(m: any): Promise<any | null> {
  const id = m?.id
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result })
  const mal = (code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
  if (m?.jsonrpc !== '2.0' || typeof m?.method !== 'string') return mal(-32600, 'Pedido inválido')
  if (id === undefined) return null   // notificación: no lleva respuesta
  switch (m.method) {
    case 'initialize': {
      const pide = m.params?.protocolVersion
      return ok({
        protocolVersion: VERSIONES.includes(pide) ? pide : VERSIONES[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'cherry', version: '1.0.0' },
        instructions: 'Cherry es la plataforma de videos de Sergio. Habla en español de Colombia. Antes de algo que gasta IA o cambia datos, di qué vas a hacer. Cherry tiene VARIAS marcas: al empezar, si el creador no dijo con cuál trabaja en este chat, pregúntale (mis_marcas) y pasa esa «marca» en TODAS las acciones del chat. Para un guion: planear_guion → ganchos con la ficha_id → el creador escoge uno → escribir_guion.',
      })
    }
    case 'ping': return ok({})
    case 'tools/list':
      /* (15-oct) todas menos mis_marcas y subir_video aceptan «marca» */
      return ok({ tools: Object.entries(H).map(([name, h]) => ({
        name, description: h.descripcion,
        inputSchema: ['mis_marcas', 'subir_video'].includes(name) ? h.entrada
          : { ...h.entrada, properties: { marca: { type: 'string', description: 'La marca con la que se trabaja en este chat (nombre o id de mis_marcas). Si se omite, la activa en Cherry.' }, ...h.entrada.properties } },
      })) })
    case 'tools/call': {
      const h = H[m.params?.name]
      if (!h) return mal(-32602, 'Herramienta desconocida: ' + m.params?.name)
      const t0 = Date.now()
      try {
        const r = await h.hacer(m.params?.arguments || {})
        console.log(`[cherry-mcp] ${m.params.name} en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
        return ok({ content: [{ type: 'text', text: JSON.stringify(r, null, 1) }] })
      } catch (e) {
        console.warn(`[cherry-mcp] ${m.params.name} falló: ${(e as Error)?.message}`)
        return ok({ content: [{ type: 'text', text: 'No se pudo: ' + String((e as Error)?.message || e).slice(0, 400) }], isError: true })
      }
    }
    default: return mal(-32601, 'Método no soportado: ' + m.method)
  }
}

Deno.serve(async (req) => {
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
  if (!llaveValida(req)) return json({ error: 'Llave inválida' }, 401)
  if (!UID) return json({ error: 'Falta CHERRY_MCP_UID' }, 500)
  if (req.method === 'GET') return new Response('Sin flujo de eventos', { status: 405, headers: { Allow: 'POST' } })
  if (req.method === 'DELETE') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  let cuerpo: any
  try { cuerpo = await req.json() } catch (_) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }, 400) }
  if (Array.isArray(cuerpo)) {
    const rs = (await Promise.all(cuerpo.map(atender))).filter(Boolean)
    return rs.length ? json(rs) : new Response(null, { status: 202 })
  }
  const r = await atender(cuerpo)
  return r ? json(r) : new Response(null, { status: 202 })
})

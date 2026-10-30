// director — (29-oct-2026) EL DIRECTOR de los estilos de gráficos. Lee lo que dice la persona (palabras con sus tiempos) y
// arma UN PLAN de momentos para el estilo escogido. El estilo se describe en su FICHA (estilos/<id>/ficha.json, servida por
// cherrysweet.app): qué láminas tiene, para qué sirve cada una, qué datos pide y qué imagen necesita. El director no sabe
// nada de un estilo en particular: todo sale de la ficha («enchufar» un estilo nuevo = una ficha nueva).
//
// Primer estilo: la Cámara viva (el reel del Día 4 de Sergio, «Cherry 9»). Sus reglas de oro van en REGLAS_CAMARA_VIVA;
// las de un estilo futuro irán en su ficha («reglas»).
//
// Entrada  { accion: 'plan', palabras: [{ word, start, end }], estilo?: 'camara_viva', ficha?: {…}, modelo?, esfuerzo? }
//          → con GPT responde { pendiente: id }; luego { accion: 'resultado', id, palabras, ficha? } entrega el plan
// Salida   { ok, plan: { v, estilo, modelo, momentos: [...] }, avisos: [...], uso: { entrada, salida, usd } }
//   Momento hablando: { tipo: 'hablando', desde, hasta, camara: 'corre'|'golpe'|'suave', titulo?: { etiqueta?, gruesa, remate?, rojas[] } }
//   Momento lámina:   { tipo: 'lamina', desde, hasta, texto: { chica?, gruesa, rojas[] }, zoom?: [n.º palabra],
//                       objeto: { tipo: 'imagen', es, ve } | { tipo: 'clip' } | { tipo: 'grafico', grafico, …sus campos } }
//                       desde/hasta = n.º de palabra (inclusivo); el tiempo sale de ahí. (v4, 30-oct: una sola lámina)
// Quién puede llamarlo: el servidor de Cherry (orchestrate y camara-viva, con la llave de servicio). ⚠️ TEMPORAL: mientras
// se prueba, también responde con la contraseña de un solo uso de la prueba (x-prueba).

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-prueba', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const CLAVE_PRUEBA = '__CLAVE_PRUEBA__'
const FICHAS = 'https://cherrysweet.app/estilos'
const PRECIO: Record<string, [number, number]> = {   // US$ por millón de tokens (entrada, salida; precios oficiales 29-oct)
  'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10],
  'gpt-5': [1.25, 10],   // OpenAI (respaldo si Claude no está disponible); precio de lista, se confirma con el primer uso
}

/* ── Las reglas de oro de la Cámara viva v4 (30-oct). Sergio, 29-oct: «Fondo con sombras + objeto (imagen, clip o gráfico)
   + títulos con sombras y animaciones de entrada y salida + movimientos de cámara. Esa es la esencia, no más» ── */
const REGLAS_CAMARA_VIVA = `
REGLAS DEL ESTILO (salen del reel de referencia y de correcciones reales del creador; cúmplelas todas):
1. Se ALTERNAN tú hablando y láminas. Un tramo «hablando» con título es CORTO: 1,5 a 4 s, UNA frase, su título y corte. Un tramo hablando puede ir SIN título (cámara «suave») solo si la frase es de paso y corta. NINGÚN momento dura más de 4,5 s: si la idea sigue, pártela en otro momento (otra cámara, otro título o una lámina). Pueden ir hasta 2 láminas seguidas; si pasan más de ~7 s sin verse a la persona, se vuelve a ella. Cubre TODAS las palabras, de la primera a la última, sin huecos.
2. Una LÁMINA es siempre lo mismo: el fondo de color, UN objeto y dos líneas de texto. Lo único que escoges es el objeto:
   - «grafico» cuando lo que dice lo pide. CADA VEZ que dice una cifra con su unidad («200 mil seguidores», «un millón de vistas», «3 meses») va una lámina con contador (no la dejes solo como título). Varias cantidades que compara → barras (solo con números que ÉL dijo, nunca inventados). Pide comentar → comentario. Pide que lo sigan → seguir.
   - «imagen» cuando hay una cosa concreta que MUESTRA la frase (una escultura para «armar algo tuyo», un reloj para «horas», un cofre para un secreto). Cada imagen DICE lo que dice la frase: nada genérico ni decorativo. Cada imagen le cuesta a la persona: como máximo una cada ~10 s.
   - «clip» (su propio video en un recuadro) en lo demás: cuando habla de un video, de sí mismo, de alguien hablando, o no hay un objeto claro.
3. ZOOM INMEDIATO cuando se nombra lo que se ve en la lámina: marca esa palabra en «zoom». Una sola vez por lámina.
4. TEXTOS (lo más importante del diseño): cada parte va en UN SOLO RENGLÓN y con SUS palabras (las que dijo en ese momento, en el mismo orden). En la lámina: «chica» = 2 a 6 palabras de contexto; «gruesa» = 1 a 3 palabras protagonistas, en minúscula; la chica y la gruesa NO repiten palabras entre sí (mal: «primero el gancho / el gancho»; bien: «primero / el gancho»); la chica se entiende sola y nunca termina colgando en «que», «de», «se», «las»… (mal: «Día 4 probando que»). En el título hablando: «gruesa» (1 a 3 palabras), «etiqueta» y «remate» opcionales; ningún renglón termina colgando (mal: «por si te», «antes de que», «copiar como»). NO inventes opiniones ni muletillas («la joya», «clarito», «tranquilo»). «rojas» = 0 o 1 palabra en la lámina, 0 a 2 en el título.
5. ENUMERACIONES («me genera 5 cosas»): cada punto en su propio momento, en el segundo en que lo nombra (una lámina con lo que mejor lo muestra, o tú hablando con su título). Los N puntos, ninguno se salta.
6. Cada lámina dura de 1,2 a 3,8 s. Si la idea sigue, vuelve a ti hablando o pasa a otra lámina.
7. PROHIBIDA la fórmula «No es X, es Y» y sus variantes. Español de Colombia, natural.
8. Si el video es una demostración (se ve una pantalla, se toca una herramienta), esos tramos van como tú hablando sin título: no tapes lo que se está mostrando.
9. Ritmo: en un reel de 1 minuto caben unas 6 a 9 láminas.`

/* ── Cómo se describe una imagen para la IA de imágenes (el estilo y el fondo para recortar los pega Cherry después) ── */
const REGLAS_IMAGEN = `
IMÁGENES (solo en las láminas con objeto «imagen»):
- «es»: lo que se ve, en español, en una frase corta que entienda cualquiera (para mostrársela a la persona).
- «ve»: la descripción para la IA de imágenes, EN INGLÉS, concreta y visual: UN objeto o UNA figura sola, entera, de frente o tres cuartos, con sus detalles clave. Sin fondo ni lugar, sin estilo de dibujo (Cherry le pega el estilo de la persona y el fondo para recortarla), sin texto ni logos, sin marcas reales, sin personas famosas reales.`

const FORMATO = `
RESPONDE SOLO CON ESTE JSON (es un ejemplo de OTRO video, de una pastelería; no copies sus palabras):
{"momentos":[
 {"tipo":"hablando","desde":0,"hasta":9,"camara":"corre","titulo":{"etiqueta":"en un mes","gruesa":"300 tortas","remate":"sin tener local","rojas":["tortas"]}},
 {"tipo":"lamina","desde":10,"hasta":17,"texto":{"chica":"empecé con","gruesa":"un solo horno"},"zoom":[15],"objeto":{"tipo":"imagen","es":"Un horno de cocina pequeño y antiguo","ve":"A small vintage kitchen oven with its door slightly open and a warm glow inside, three-quarter view, whole object visible"}},
 {"tipo":"lamina","desde":18,"hasta":24,"texto":{"chica":"y hoy vendo","gruesa":"2 millones","rojas":["millones"]},"objeto":{"tipo":"grafico","grafico":"contador","hasta":2000000,"unidad":"pesos al mes"}},
 {"tipo":"hablando","desde":25,"hasta":31,"camara":"suave"},
 {"tipo":"lamina","desde":32,"hasta":38,"texto":{"chica":"esto es lo que","gruesa":"nadie te dice"},"objeto":{"tipo":"clip"}},
 {"tipo":"lamina","desde":120,"hasta":131,"texto":{"chica":"cuéntame aquí en","gruesa":"los comentarios"},"objeto":{"tipo":"grafico","grafico":"comentario","texto":"quiero la receta"}}
]}
- «desde» y «hasta» son números de palabra (inclusivos). Los momentos van en orden, NO se pisan y cubren el video de principio a fin.
- El objeto «barras» lleva "barras":[{"k":"nombre corto","v":número}, …] y, si hace falta, "sufijo":" %".`

function sistemaDe(ficha: any): string {
  const campos = (l: any) => (l.campos || []).map((c: any) => c.k + (c.lista ? '[]' : '') + (c.num ? ' (número)' : '') + (c.max ? ` (máx. ${c.max})` : '') + (c.d ? `: ${c.d}` : '')).join('; ')
  const L = ficha.lamina || {}
  const objs = (L.objetos || []).map((o: any) => `- ${o.id} — ${o.para}${o.graficos ? ':\n' + o.graficos.map((g: any) => `    · ${g.id} — ${g.para} [campos: ${campos(g) || 'ninguno'}]`).join('\n') : ''}`).join('\n')
  const cams = Object.entries(ficha.hablando?.camaras || {}).map(([k, v]) => `«${k}»: ${v}`).join('; ')
  return `Eres el director de edición de Cherry, un editor de reels. Lees lo que dice una persona en su video (palabra por palabra, con el segundo en que la dice) y armas el plan de edición en el estilo «${ficha.nombre}»: ${ficha.descripcion}

TÚ HABLANDO: ${ficha.hablando?.para} Cámaras: ${cams}. Título: ${campos(ficha.hablando)}.

LÁMINA: ${L.para} Dura ${(L.dura || [1.2, 3.8]).join(' a ')} s. Texto: ${campos(L)}.
El OBJETO de la lámina (uno solo):
${objs}
${ficha.id === 'camara_viva' ? REGLAS_CAMARA_VIVA : (ficha.reglas || '')}
${REGLAS_IMAGEN}
${FORMATO}`
}

/* ── Validar el plan contra la ficha: lo que no cumple se arregla o se avisa (nunca se inventa) ── */
function validar(plan: any, ficha: any, palabras: any[]): { momentos: any[], avisos: string[] } {
  const avisos: string[] = [], n = palabras.length
  const L = ficha.lamina || {}, graficos: Record<string, any> = {}
  for (const o of (L.objetos || [])) for (const g of (o.graficos || [])) graficos[g.id] = g
  // ningún texto termina colgando en un conector: «Día 4 probando que» → «Día 4 probando»; si solo queda el conector, nada
  const CONECTORES = 'y|o|de|del|la|el|los|las|lo|un|una|unos|unas|mi|tu|su|mis|tus|sus|que|en|a|al|con|sin|por|para|se|te|me|si|como|pero|porque'
  const COLGANTE = new RegExp(`[\\s,;:]+(${CONECTORES})$`, 'i'), SOLO_CONECTOR = new RegExp(`^(${CONECTORES})$`, 'i')
  const sinColgar = (s: any) => {
    let c = String(s ?? '').trim().replace(/[\s,;:]+$/, ''), antes = ''
    while (c !== antes) { antes = c; c = c.replace(COLGANTE, '').trim() }
    return SOLO_CONECTOR.test(c) ? '' : c
  }
  // un texto largo se corta en la última palabra que cabe (nunca a mitad de palabra); si es UNA palabra larga, se deja entera
  const corta = (s: any, max?: number) => {
    const t = String(s ?? '').trim()
    if (!max || t.length <= max) return t
    const i = t.lastIndexOf(' ', max)
    avisos.push(`texto largo: «${t}»`)
    if (i <= 0) return t
    return sinColgar(t.slice(0, i)) || t
  }
  const limpiarTexto = (txt: any, campos: any[]) => {
    const o: Record<string, unknown> = {}
    for (const c of campos) {
      const v = txt?.[c.k]
      if (v == null || v === '') continue
      if (c.lista) o[c.k] = (Array.isArray(v) ? v : [v]).slice(0, c.max || 9).map((x: any) => corta(x, c.maxc)).filter(Boolean)
      else if (c.num) { const x = Number(String(v).replace(/[^\d.-]/g, '')); if (isFinite(x)) o[c.k] = x }
      else o[c.k] = corta(v, c.max)
    }
    return o
  }
  const camposHablando = ficha.hablando?.campos || []
  let prev = -1
  const salida: any[] = []
  for (const m0 of (Array.isArray(plan?.momentos) ? plan.momentos : [])) {
    const m: any = { ...m0 }
    m.desde = Math.max(0, Math.min(n - 1, Math.round(Number(m.desde))))
    m.hasta = Math.max(m.desde, Math.min(n - 1, Math.round(Number(m.hasta))))
    if (!isFinite(m.desde) || m.hasta <= prev) { avisos.push(`momento pisado o fuera de orden en la palabra ${m0.desde}: se quitó`); continue }
    if (m.desde <= prev) { avisos.push(`momento pisado en la palabra ${m.desde}: arranca en la ${prev + 1}`); m.desde = prev + 1; if (Array.isArray(m.zoom)) m.zoom = m.zoom.filter((z: number) => z > prev) }
    m.t0 = palabras[m.desde].start; m.t1 = palabras[m.hasta].end
    if (m.tipo === 'hablando') {
      m.camara = ['corre', 'golpe', 'suave'].includes(m.camara) ? m.camara : 'suave'
      if (m.titulo) {
        m.titulo = limpiarTexto(m.titulo, camposHablando)
        // ningún renglón termina colgando («por si te», «copiar como»); las rojas, solo palabras que quedaron
        for (const k of ['etiqueta', 'gruesa', 'remate']) {
          if (m.titulo[k] == null) continue
          const c = sinColgar(m.titulo[k])
          if (c) m.titulo[k] = c; else delete m.titulo[k]
        }
        const queda = `${m.titulo.gruesa || ''} ${m.titulo.remate || ''}`.toLowerCase()
        if (Array.isArray(m.titulo.rojas)) m.titulo.rojas = m.titulo.rojas.filter((w: any) => queda.includes(String(w).toLowerCase()))
        if (!m.titulo.rojas?.length) delete m.titulo.rojas
        if (!m.titulo.gruesa) delete m.titulo
      }
      if (!m.titulo && m.camara === 'corre') m.camara = 'suave'
      delete m.extra
    } else if (m.tipo === 'lamina') {
      const l = { dura: L.dura || [1.2, 3.8], campos: L.campos || [] }
      m.texto = limpiarTexto(m.texto, l.campos)
      if (!m.texto.gruesa && !m.texto.chica) avisos.push(`lámina sin texto en la palabra ${m.desde}`)
      // la chica no repite la gruesa: «primero el gancho / el gancho» → «primero / el gancho»
      const ch = String(m.texto.chica || ''), gr = String(m.texto.gruesa || '')
      if (ch && gr && ch.toLowerCase().endsWith(gr.toLowerCase()) && ch.length > gr.length) m.texto.chica = ch.slice(0, ch.length - gr.length).trim()
      // ni termina colgando: «Día 4 probando que» → «Día 4 probando»; si solo queda un conector («lo»), no va
      const c = sinColgar(m.texto.chica)
      if (c) m.texto.chica = c; else delete m.texto.chica
      m.zoom = (Array.isArray(m.zoom) ? m.zoom : []).map(Number).filter((k: number) => k >= m.desde && k <= m.hasta).slice(0, 1)
      // el objeto: si falta algo, la lámina lleva tu video en el recuadro (nunca un hueco ni algo inventado)
      const o = m.objeto || {}
      let obj: any = { tipo: 'clip' }
      if (o.tipo === 'imagen') {
        if (o.ve) obj = { tipo: 'imagen', es: corta(o.es, 140), ve: corta(o.ve, 600) }
        else avisos.push(`la lámina de la palabra ${m.desde} pidió imagen sin decir cuál: va tu video`)
      } else if (o.tipo === 'grafico') {
        const g = graficos[o.grafico]
        if (!g) avisos.push(`gráfico desconocido: ${o.grafico}`)
        else if (g.id === 'barras') {
          const bs = (Array.isArray(o.barras) ? o.barras : []).slice(0, 4)
            .map((b: any) => ({ k: corta(b?.k, 22), v: Number(String(b?.v ?? '').replace(/[^\d.-]/g, '')) }))
            .filter((b: any) => b.k && isFinite(b.v))
          if (bs.length >= 2) obj = { tipo: 'grafico', grafico: 'barras', barras: bs, ...(o.sufijo ? { sufijo: String(o.sufijo).slice(0, 4) } : {}) }
          else avisos.push(`las barras de la palabra ${m.desde} no traían 2 números: va tu video`)
        } else obj = { tipo: 'grafico', grafico: g.id, ...limpiarTexto(o, g.campos || []) }
        if (obj.grafico === 'contador' && !(obj.hasta > 0)) { avisos.push(`el contador de la palabra ${m.desde} no traía cifra: va tu video`); obj = { tipo: 'clip' } }
      }
      m.objeto = obj
      delete m.plantilla; delete m.fondo; delete m.imagen; delete m.imagenes
      const d = m.t1 - m.t0
      if (d < l.dura[0] - 0.4) avisos.push(`la lámina dura ${d.toFixed(1)} s (la ficha dice ${l.dura[0]}–${l.dura[1]})`)
      if (d > l.dura[1] + 0.8) {   // se pasa: la lámina se queda con su tiempo y lo demás vuelve a ti hablando (sin título)
        let k = m.desde
        while (k < m.hasta && palabras[k + 1].start < m.t0 + l.dura[1]) k++
        if (k < m.hasta) {
          avisos.push(`la lámina duraba ${d.toFixed(1)} s: se partió en ${(palabras[k].end - m.t0).toFixed(1)} s y lo demás vuelve a ti`)
          const resto = { tipo: 'hablando', desde: k + 1, hasta: m.hasta, t0: palabras[k + 1].start, t1: m.t1, camara: 'suave' }
          m.hasta = k; m.t1 = palabras[k].end; m.zoom = m.zoom.filter((z: number) => z <= k)
          salida.push(m); salida.push(resto); prev = resto.hasta; continue
        }
      }
    } else { avisos.push(`tipo desconocido: ${m.tipo}`); continue }
    const ultimo = salida[salida.length - 1]
    if (ultimo && m.t1 - m.t0 < 0.6) {   // diminuto (un «bye» suelto): se junta con el anterior
      avisos.push(`momento de ${(m.t1 - m.t0).toFixed(1)} s en la palabra ${m.desde}: se juntó con el anterior`)
      ultimo.hasta = m.hasta; ultimo.t1 = m.t1; prev = m.hasta; continue
    }
    salida.push(m); prev = m.hasta
  }
  return { momentos: repasar(salida, palabras, avisos, (L.dura || [1.2, 3.8])[1]), avisos }
}

/* ── El repaso final (v4b): SIN HUECOS (las palabras que el director se saltó quedan contigo hablando) y ningún tramo
   hablando de más de 5 s (se parte en pedazos de ~2–4 s en los finales de frase, alternando la cámara: así hay cortes) ── */
function repasar(ms: any[], palabras: any[], avisos: string[], duraMax: number): any[] {
  const n = palabras.length, out: any[] = []
  const suave = (a: number, b: number) => ({ tipo: 'hablando', desde: a, hasta: b, t0: palabras[a].start, t1: palabras[b].end, camara: 'suave' })
  let prev = -1
  for (const m of ms) {
    if (m.desde > prev + 1) {
      const a = prev + 1, b = m.desde - 1, ult = out[out.length - 1], dur = palabras[b].end - palabras[a].start
      const cabe = ult && (ult.tipo === 'hablando' || palabras[b].end - ult.t0 <= duraMax + 0.8)
      avisos.push(`palabras ${a}–${b} sin momento: quedan contigo hablando`)
      if (cabe && dur < 1.5) { ult.hasta = b; ult.t1 = palabras[b].end }
      else if (dur < 0.6) { m.desde = a; m.t0 = palabras[a].start }          // muy corto: lo toma el que sigue
      else out.push(suave(a, b))
    }
    out.push(m); prev = m.hasta
  }
  if (prev < n - 1) {
    const ult = out[out.length - 1]
    avisos.push(`palabras ${prev + 1}–${n - 1} sin momento al final: quedan contigo hablando`)
    if (ult && ult.tipo === 'hablando') { ult.hasta = n - 1; ult.t1 = palabras[n - 1].end } else out.push(suave(prev + 1, n - 1))
  }
  const final: any[] = []
  for (const m of out) {
    if (m.tipo !== 'hablando' || m.t1 - m.t0 <= 5) { final.push(m); continue }
    const cortes: number[] = []
    let ini = m.desde
    for (let k = m.desde; k < m.hasta; k++) {
      const d = palabras[k].end - palabras[ini].start, finFrase = /[.,;:?!…]$/.test(String(palabras[k].word || ''))
      if (((d >= 2.2 && finFrase) || d >= 3.6) && palabras[m.hasta].end - palabras[k + 1].start >= 1.2) { cortes.push(k); ini = k + 1 }
    }
    if (!cortes.length) { final.push(m); continue }
    avisos.push(`tú hablando duraba ${(m.t1 - m.t0).toFixed(1)} s (palabra ${m.desde}): se partió en ${cortes.length + 1} con cortes de cámara`)
    let a = m.desde
    ;[...cortes, m.hasta].forEach((b, i) => {
      const pz: any = i === 0 ? { ...m } : { tipo: 'hablando', camara: i % 2 ? 'golpe' : 'suave' }
      pz.desde = a; pz.hasta = b; pz.t0 = palabras[a].start; pz.t1 = palabras[b].end
      final.push(pz); a = b + 1
    })
  }
  return final
}

let anthropic: any = null
async function claude(modelo: string, sistema: string, usuario: string): Promise<{ json: any, uso: any }> {
  if (!anthropic) {
    const { default: Anthropic } = await import('npm:@anthropic-ai/sdk')
    anthropic = new Anthropic()   // lee ANTHROPIC_API_KEY de los secretos de Supabase
  }
  const msg = await anthropic.messages.stream({
    model: modelo, max_tokens: 20000, system: sistema, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: usuario }],
  }).finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('Claude no quiso responder')
  const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  const ini = texto.indexOf('{'), fin = texto.lastIndexOf('}')
  if (ini < 0 || fin < ini) throw new Error('Claude no devolvió JSON')
  const p = PRECIO[modelo] || [4, 20], u = msg.usage || {}
  const entrada = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
  return { json: JSON.parse(texto.slice(ini, fin + 1)), uso: { entrada, salida: u.output_tokens || 0, usd: +((entrada * p[0] + (u.output_tokens || 0) * p[1]) / 1e6).toFixed(4) } }
}

/* GPT-5 de OpenAI (29-oct: Sergio, «el director va con GPT»). Pensando a fondo puede tardar más de los 150 s que aguanta
   una función, así que va EN SEGUNDO PLANO (Responses API, background): se pide, OpenAI trabaja sin apuro y el resultado se
   recoge después con su número (accion 'resultado'). */
const OPENAI = 'https://api.openai.com/v1/responses'
const hOpenai = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY') ?? ''}` })
async function openaiPedir(modelo: string, sistema: string, usuario: string, esfuerzo: string): Promise<string> {
  const r = await fetch(OPENAI, { method: 'POST', headers: hOpenai(), body: JSON.stringify({
    model: modelo, background: true, reasoning: { effort: esfuerzo }, max_output_tokens: 30000, text: { format: { type: 'json_object' } },
    input: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }] }) })
  const d = await r.json()
  if (!r.ok || !d.id) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(d.error || d).slice(0, 300)}`)
  return d.id
}
async function openaiRecoger(id: string): Promise<{ listo: boolean, json?: any, uso?: any, estado: string }> {
  const r = await fetch(`${OPENAI}/${id}`, { headers: hOpenai() })
  const d = await r.json()
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(d.error || d).slice(0, 300)}`)
  if (d.status === 'queued' || d.status === 'in_progress') return { listo: false, estado: d.status }
  if (d.status !== 'completed') throw new Error(`OpenAI terminó en «${d.status}»: ${JSON.stringify(d.error || d.incomplete_details || '').slice(0, 300)}`)
  const texto = (d.output || []).flatMap((o: any) => o.content || []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text).join('')
  const p = PRECIO[d.model?.startsWith('gpt-5') ? 'gpt-5' : d.model] || [1.25, 10], u = d.usage || {}
  return { listo: true, estado: d.status, json: JSON.parse(texto || '{}'),
    uso: { entrada: u.input_tokens || 0, salida: u.output_tokens || 0, piensa: u.output_tokens_details?.reasoning_tokens || 0,
      usd: +(((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1]) / 1e6).toFixed(4) } }
}

const cacheFichas: Record<string, any> = {}
async function fichaDe(estilo: string): Promise<any> {
  if (cacheFichas[estilo]) return cacheFichas[estilo]
  const r = await fetch(`${FICHAS}/${estilo.replace(/_/g, '-')}/ficha.json?t=${Date.now()}`)
  if (!r.ok) throw new Error('no encuentro la ficha del estilo ' + estilo)
  return (cacheFichas[estilo] = await r.json())
}

// ── Llamadas internas del servidor (la llave de servicio), como en transcribe-clip ──
async function esLlamadaInterna(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  const conocidas = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v)
  if (conocidas.includes(token)) return true
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/auth/v1/admin/users?page=1&per_page=1`, { headers: { apikey: token, Authorization: `Bearer ${token}` } })
    return r.ok
  } catch (_) { return false }
}
const esPrueba = (req: Request) => !CLAVE_PRUEBA.startsWith('__') && (req.headers.get('x-prueba') ?? '') === CLAVE_PRUEBA

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const responder = (d: unknown, status = 200) => Response.json(d, { status, headers: CORS })
  if (!esPrueba(req) && !(await esLlamadaInterna(req))) return responder({ error: 'no' }, 401)
  try {
    const b = await req.json()
    const palabras = (b.palabras || []).filter((p: any) => p && String(p.word || '').trim())
    if (palabras.length < 5) return responder({ error: 'faltan las palabras' }, 400)
    const ficha = b.ficha || await fichaDe(b.estilo || 'camara_viva')
    const modelo = Object.keys(PRECIO).includes(b.modelo) ? b.modelo : 'gpt-5'   // (29-oct) Sergio: el director va con GPT
    const entregar = (json: any, uso: any, ms: number) => {
      const { momentos, avisos } = validar(json, ficha, palabras)
      return responder({ ok: true, ms, avisos, uso, plan: { v: 1, estilo: ficha.id, version_ficha: ficha.version, modelo, creado: new Date().toISOString(), momentos } })
    }
    if (b.accion === 'resultado') {          // recoger lo que GPT dejó trabajando
      const r = await openaiRecoger(String(b.id || ''))
      return r.listo ? entregar(r.json, r.uso, 0) : responder({ ok: true, pendiente: b.id, estado: r.estado })
    }
    const lista = palabras.map((p: any, i: number) => `${i} [${Number(p.start).toFixed(1)}] ${String(p.word).trim()}`).join('\n')
    const dur = Number(palabras[palabras.length - 1].end) || 0
    const usuario = `El video dura ${dur.toFixed(1)} s y tiene ${palabras.length} palabras. Texto seguido:\n«${palabras.map((p: any) => String(p.word).trim()).join(' ')}»\n\nPalabras numeradas con su segundo:\n${lista}\n\nArma el plan completo. Responde SOLO con el JSON.`
    const esfuerzo = ['minimal', 'low', 'medium', 'high'].includes(b.esfuerzo) ? b.esfuerzo : 'low'   // «low»: 90 s y US$0,08, igual de bueno
    const t0 = Date.now()
    if (modelo.startsWith('claude-')) { const { json, uso } = await claude(modelo, sistemaDe(ficha), usuario); return entregar(json, uso, Date.now() - t0) }
    return responder({ ok: true, pendiente: await openaiPedir(modelo, sistemaDe(ficha), usuario, esfuerzo) })
  } catch (e) {
    return responder({ ok: false, error: String(e).slice(0, 400) }, 500)
  }
})

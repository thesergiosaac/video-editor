// lab-auditar v1 (14-oct-2026) — «¿Va a funcionar?»: la auditoría de «Antes de subir».
//
// Sergio: «es absurdo que la auditoría compare lo que planeé con lo que grabé… la auditoría es un análisis de si el video va a
// funcionar comparado con lo que ya he grabado». Recibe los rasgos del video nuevo (los saca la página: Whisper, lab_desmontar
// y lab-ver-video modo «antes») y los compara con TODOS sus reels que ya tienen resultados en Instagram.
//
// · Éxito = que le vaya mejor que a la mitad de sus reels: sweet (lab-sweet.js, 40/30/30 alcance/retención justa/interacción)
//   por encima de su mediana. Solo reels desde jul-2024 (la omisión de antes venía mal).
// · El modelo: por cada rasgo (tema, gancho, formato, forma del guion, duración, palabras por minuto, palabras de la primera
//   frase, promesas para más adelante, cortes por minuto, subtítulos, música, efectos, gráficos, apoyo, planos, luz), cuántos
//   de sus reels con ese valor les fue bien; se suman las desviaciones de la base (bayes ingenuo, encogido hacia la base con
//   pocos reels: alfa = 2). Probado el 14-oct (scratchpad › prediccion/probar.py): prediciendo cada reel SOLO con los
//   anteriores acierta 75 de 100 (AUC 0,77); dijo >65 % → bien 29 de 35, <35 % → 7 de 25.
// · Devuelve el porcentaje, lo que lo sube y lo que lo baja (con 5 reels o más), qué cambiar EDITANDO para subirlo (solo
//   duración, cortes por minuto y la primera frase: «quítale los gráficos» salía por coincidencia de época), el tema que
//   mejor le funciona (para el próximo) y la prueba con sus propios reels (qué tan seguro es).
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SB_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SVC_JWT') ?? ''
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const responder = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function usuario(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || token, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' ? u.id : null
  } catch (_) { return null }
}
async function tabla(ruta: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, { headers: { apikey: SB_SERVICIO, Authorization: `Bearer ${SB_SERVICIO}` } })
  if (!r.ok) throw new Error(`La base respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return await r.json()
}

const num = (x: any) => { const v = Number(x); return x != null && x !== '' && Number.isFinite(v) ? v : null }
const caja = (x: number | null, cortes: number[]) => { if (x == null) return null; for (let i = 0; i < cortes.length; i++) if (x < cortes[i]) return i; return cortes.length }
function sweet(x: any): number | null {
  const vis = num(x.vistas); if (!vis || vis <= 0) return null
  const dur = num(x.dura_seg), ret = num(x.retencion), nor = dur ? 185 * Math.pow(dur, -0.5) : null
  const acc = [x.me_gusta, x.comentarios, x.compartidos, x.guardados].map(num)
  const e = acc.some((a) => a != null) ? 100 * ((acc[0] || 0) + 2 * (acc[1] || 0) + 3 * (acc[2] || 0) + 3 * (acc[3] || 0)) / vis : null
  const cl = (z: number) => Math.max(0, Math.min(1, z))
  const P: Record<string, number | null> = { V: cl((Math.log10(vis) - 3) / (Math.log10(2e6) - 3)), R: ret != null && nor ? cl(ret / nor - 0.5) : null, I: e != null ? cl(Math.sqrt(e / 20)) : null }
  if (P.R == null && P.I == null) return null
  const W: Record<string, number> = { V: 0.4, R: 0.3, I: 0.3 }
  let t = 0, s = 0
  for (const k of Object.keys(W)) if (P[k] != null) { t += W[k]; s += W[k] * Math.log(Math.max(P[k] as number, 0.02)) }
  return 100 * Math.exp(s / t)
}
/* la forma del guion: los pasos sin repetir los seguidos («Cuerpo → Cuerpo» = «Cuerpo») */
function forma(e: string) {
  const out: string[] = []
  for (const p of String(e || '').split('→').map((x) => x.trim()).filter(Boolean)) if (out[out.length - 1] !== p) out.push(p)
  return out.join(' → ')
}
/* los rasgos de un reel del historial, en las mismas cajas que los del video nuevo */
function rasgosDe(x: any): Record<string, any> {
  const p = x.piezas || {}, pr = x.prod || {}, rit = x.ritmo || {}, cad = x.cadena
  const son = String(pr.sonido || '').toLowerCase()
  const tiene = Object.keys(pr).length > 0
  return {
    tema: p.tema || null, gancho: p.gancho || null, formato: p.formato || pr.formato || null, estructura: forma(p.estructura) || null,
    duracion: caja(num(x.dura_seg), [30, 45, 60, 90]), ppm: caja(num(rit.ppm), [150, 180, 210, 240]),
    palabrasGancho: caja(String(p.gancho_frase || '').split(/\s+/).filter(Boolean).length || null, [8, 12, 16]),
    loops: cad ? Math.min(Math.round(num(cad.n) || 0), 2) : null,
    cortesMin: caja(num(pr.porMinuto), [6, 12, 20]),
    subtitulos: tiene && pr.subtitulos !== undefined ? !!pr.subtitulos : null,
    musica: son ? son.includes('música') : null, efectos: son ? son.includes('efecto') : null,
    graficos: tiene ? !!pr.graficos : null, apoyo: tiene ? !!pr.apoyo : null, planos: pr.planos || null,
    luzOscura: pr.luz ? /oscur|sombra|tenue|baja/.test(String(pr.luz).toLowerCase()) : null,
  }
}
const RASGOS = ['tema', 'gancho', 'formato', 'estructura', 'duracion', 'ppm', 'palabrasGancho', 'loops', 'cortesMin', 'subtitulos', 'musica', 'efectos', 'graficos', 'apoyo', 'planos', 'luzOscura']
const EDITABLES = ['duracion', 'cortesMin', 'palabrasGancho']
type Fila = { s: number; y: number; f: Record<string, any> }
function entrena(T: Fila[]) {
  const base = T.reduce((a, d) => a + d.y, 0) / T.length
  const tab: Record<string, Map<any, [number, number]>> = {}
  for (const k of RASGOS) {
    const c = new Map<any, [number, number]>()
    for (const d of T) { const v = d.f[k]; if (v == null) continue; const a = c.get(v) || [0, 0]; a[d.y] += 1; c.set(v, a) }
    tab[k] = c
  }
  return { base: Math.min(0.95, Math.max(0.05, base)), tab }
}
const logit = (p: number) => Math.log(p / (1 - p))
function efecto(m: ReturnType<typeof entrena>, k: string, v: any) {
  const n = m.tab[k].get(v); if (!n) return null
  const p = (n[1] + 2 * m.base) / (n[0] + n[1] + 2)
  return { e: logit(p) - logit(m.base), bien: n[1], de: n[0] + n[1] }
}
function predice(m: ReturnType<typeof entrena>, f: Record<string, any>) {
  let lo = logit(m.base)
  for (const k of RASGOS) { const v = f[k]; if (v == null) continue; const x = efecto(m, k, v); if (x) lo += x.e }
  return 1 / (1 + Math.exp(-lo))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const b = await req.json().catch(() => ({}))
    /* desde el servidor (pruebas), con la llave de servicio, se dice de quién son los reels */
    const tok = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/, '').trim()
    const interno = !!tok && [SB_SERVICIO, Deno.env.get('SVC_JWT')].filter(Boolean).includes(tok)
    const uid = interno ? (/^[0-9a-f-]{36}$/.test(String(b?.usuario || '')) ? String(b.usuario) : null) : await usuario(req)
    if (!uid) return responder({ error: 'Inicia sesión en Cherry' }, 401)
    const marca = String(b?.marca || '').slice(0, 40)
    const nuevo: Record<string, any> = {}
    for (const k of RASGOS) nuevo[k] = b?.rasgos?.[k] ?? null

    const cuentas = await tabla(`cuentas_instagram?user_id=eq.${uid}&select=ig_user_id,marca`)
    const ids = (cuentas || []).filter((c: any) => !marca || c.marca === marca).map((c: any) => c.ig_user_id).filter((x: string) => /^\d+$/.test(x))
    if (!ids.length) return responder({ pocos: true, n: 0, motivo: 'Conecta tu Instagram para que Cherry compare con tus reels.' })
    const filas = await tabla(`historial_reels?user_id=eq.${uid}&ig_user_id=in.(${ids.join(',')})&publicado=gte.2024-07-01&order=publicado.asc&limit=2000` +
      '&select=publicado,dura_seg,vistas,me_gusta,comentarios,guardados,compartidos,retencion,piezas,ritmo:desmonte->ritmo,cadena:desmonte->cadena,prod:desmonte->vista->produccion')
    const D: Fila[] = []
    for (const x of filas || []) { const s = sweet(x); if (s != null) D.push({ s, y: 0, f: rasgosDe(x) }) }
    if (D.length < 20) return responder({ pocos: true, n: D.length, motivo: 'Todavía hay pocos reels tuyos con resultados para comparar (hacen falta 20).' })
    const orden = D.map((d) => d.s).sort((a, c) => a - c)
    const mediana = orden.length % 2 ? orden[(orden.length - 1) / 2] : (orden[orden.length / 2 - 1] + orden[orden.length / 2]) / 2
    for (const d of D) d.y = d.s >= mediana ? 1 : 0

    const m = entrena(D)
    const p = predice(m, nuevo)
    const razones: any[] = []
    for (const k of RASGOS) {
      const v = nuevo[k]; if (v == null) continue
      const x = efecto(m, k, v); if (!x || x.de < 5 || Math.abs(x.e) <= 0.15) continue
      razones.push({ k, v, efecto: Math.round(x.e * 100) / 100, bien: x.bien, de: x.de, editable: EDITABLES.includes(k) })
    }
    const sube = razones.filter((r) => r.efecto > 0).sort((a, c) => c.efecto - a.efecto).slice(0, 4)
    const baja = razones.filter((r) => r.efecto < 0).sort((a, c) => a.efecto - c.efecto).slice(0, 4)
    const arreglos: any[] = []
    for (const k of EDITABLES) {
      if (nuevo[k] == null) continue
      let mejor: any = null
      for (const [v, n] of m.tab[k]) {
        if (v === nuevo[k] || n[0] + n[1] < 5) continue
        const p2 = predice(m, { ...nuevo, [k]: v })
        if (!mejor || p2 > mejor.p) mejor = { k, v, p: p2, bien: n[1], de: n[0] + n[1] }
      }
      if (mejor && mejor.p - p >= 0.05) arreglos.push({ ...mejor, p: Math.round(mejor.p * 100) })
    }
    arreglos.sort((a, c) => c.p - a.p)
    // el tema que mejor le funciona (con 5 reels o más), para el próximo video
    let mejorTema: any = null
    for (const [v, n] of m.tab.tema) if (n[0] + n[1] >= 5 && (!mejorTema || n[1] / (n[0] + n[1]) > mejorTema.bien / mejorTema.de)) mejorTema = { tema: v, bien: n[1], de: n[0] + n[1] }
    // qué tan seguro es: cada reel predicho SOLO con los anteriores (desde el 31)
    let ok = 0, tot = 0
    const tr = [[0, 0.35], [0.35, 0.65], [0.65, 1.01]].map(([a, c]) => ({ de: Math.round(a * 100), a: Math.round(Math.min(c, 1) * 100), bien: 0, n: 0 }))
    for (let i = 30; i < D.length; i++) {
      const q = predice(entrena(D.slice(0, i)), D[i].f)
      tot++; if ((q >= 0.5) === (D[i].y === 1)) ok++
      const t = tr.find((x) => q * 100 >= x.de && q * 100 < (x.a === 100 ? 101 : x.a)); if (t) { t.n++; t.bien += D[i].y }
    }
    console.log(`[lab-auditar] ${uid.slice(0, 8)}: ${Math.round(p * 100)} % con ${D.length} reels (prueba: ${ok}/${tot})`)
    return responder({ p: Math.round(p * 100), n: D.length, mediana: Math.round(mediana * 10) / 10, sube, baja, arreglos: arreglos.slice(0, 3), mejorTema,
      prueba: { aciertos: tot ? Math.round(100 * ok / tot) : null, n: tot, tramos: tr } })
  } catch (e) {
    return responder({ error: String((e as Error)?.message || e).slice(0, 300) }, 500)
  }
})

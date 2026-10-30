// cuenta-entrada — (30-oct-2026) LA ENTRADA A CHERRY: lo que la pantalla de entrada pide sin sesión.
//   { accion: 'estado', correo }                         → { tipo: nueva | primera | sin_confirmar | google | clave, cerrado? }
//   { accion: 'registrar', correo, clave, nombre }       → crea la cuenta sin confirmar y envía el código
//   { accion: 'confirmar', correo, codigo }              → confirma el correo (la página entra con su contraseña)
//   { accion: 'reenviar', correo, para }                 → otro código (uno cada 45 s)
//   { accion: 'recuperar', correo }                      → envía el código para cambiar la contraseña
//   { accion: 'cambiar_clave', correo, codigo, clave }   → guarda la contraseña nueva
// El registro abre con cherry_ajustes › registro = "abierto"; mientras tanto solo pueden registrarse los correos de registro_prueba.
// Google lo atiende Supabase (authorize); esta función no lo toca. Los correos salen por Resend (RESEND_API_KEY) desde cherrysweet.app,
// nunca desde el correo de Cobra. Las cuentas abiertas por dentro (primer ingreso) siguen por la función primer-ingreso.

const SB = Deno.env.get('SUPABASE_URL') ?? ''
const SRV = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const RESEND = Deno.env.get('RESEND_API_KEY') ?? ''
const REMITENTE = 'Cherry <hola@cherrysweet.app>'
const MINUTOS = 10, ESPERA_S = 45, MAX_INTENTOS = 5, POR_IP_HORA = 12, AL_DIA = 500

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const H = { apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json' }
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const malo = (error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra })

async function rest(ruta: string, op: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${ruta}`, { ...op, headers: { ...H, ...(op.headers || {}) } })
  if (!r.ok) throw new Error(`${ruta.split('?')[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}
const rpc = (n: string, a: Record<string, unknown>) => rest(`rpc/${n}`, { method: 'POST', body: JSON.stringify(a) })
async function admin(metodo: string, ruta: string, cuerpo: unknown) {
  const r = await fetch(`${SB}/auth/v1/admin/users${ruta}`, { method: metodo, headers: H, body: JSON.stringify(cuerpo) })
  const t = await r.text()
  if (!r.ok) throw new Error(`admin ${r.status}: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 200
const claveValida = (c: string) => c.length >= 8 && c.length <= 72
async function huella(correo: string, para: string, codigo: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${correo}:${para}:${codigo}:${SRV.slice(-24)}`))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function abierto(correo: string) {
  const f: any[] = await rest('cherry_ajustes?clave=in.(registro,registro_prueba)&select=clave,valor')
  const v = (k: string) => f.find((x) => x.clave === k)?.valor
  if (v('registro') === 'abierto') return true
  const lista = v('registro_prueba')
  return Array.isArray(lista) && lista.map((x: unknown) => String(x).toLowerCase()).includes(correo)
}

const TEXTOS: Record<string, { asunto: string, titulo: string, texto: string }> = {
  registro: { asunto: 'Tu código para entrar a Cherry', titulo: 'Confirma tu correo', texto: 'Escribe este código en Cherry para terminar de crear tu cuenta.' },
  recuperar: { asunto: 'Tu código para cambiar la contraseña', titulo: 'Cambia tu contraseña', texto: 'Escribe este código en Cherry para poner una contraseña nueva. Si no lo pediste, ignora este correo: tu cuenta sigue igual.' },
}
function cuerpoCorreo(para: string, codigo: string) {
  const t = TEXTOS[para]
  return `<!doctype html><html><body style="margin:0;background:#F2EAE5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#140C11">
<table role="presentation" align="center" width="100%" style="max-width:440px;background:#FCF9F7;border-radius:20px"><tr><td style="padding:32px 28px">
<p style="margin:0 0 22px;font-size:20px;font-weight:800;letter-spacing:-.02em">Cherry</p>
<h1 style="margin:0 0 8px;font-size:24px;line-height:1.15;letter-spacing:-.02em">${t.titulo}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#5c5358">${t.texto}</p>
<p style="margin:0 0 22px;padding:16px;text-align:center;background:#F2EAE5;border-radius:14px;font-size:32px;font-weight:800;letter-spacing:.24em">${codigo}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#837a7f">Vence en ${MINUTOS} minutos.</p>
</td></tr></table></body></html>`
}

/* Envía un código nuevo. Devuelve null si salió bien, o la respuesta de error */
async function enviarCodigo(correo: string, para: string, ip: string): Promise<Response | null> {
  if (!RESEND) { console.error('[cuenta-entrada] falta RESEND_API_KEY'); return malo('Todavía no podemos enviar correos. Inténtalo más tarde.') }
  const ya: any[] = await rest(`codigos_correo?correo=eq.${encodeURIComponent(correo)}&para=eq.${para}&select=enviado`)
  if (ya[0]) {
    const falta = ESPERA_S - Math.floor((Date.now() - Date.parse(ya[0].enviado)) / 1000)
    if (falta > 0) return json({ ok: true, espera: falta })   // ya se envió hace poco: la pantalla sigue con ese código
  }
  const hora = new Date(Date.now() - 3600000).toISOString(), dia = new Date(Date.now() - 86400000).toISOString()
  const porIp: any[] = await rest(`correo_envios?ip=eq.${encodeURIComponent(ip)}&creado=gte.${hora}&select=id`)
  if (porIp.length >= POR_IP_HORA) return malo('Demasiados intentos. Espera un rato.')
  const hoy: any[] = await rest(`correo_envios?creado=gte.${dia}&select=id&limit=${AL_DIA + 1}`)
  if (hoy.length > AL_DIA) { console.error('[cuenta-entrada] tope de correos del día'); return malo('Hay muchos registros en este momento. Inténtalo en un rato.') }

  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  const codigo = String(n).padStart(6, '0')
  await rest('codigos_correo?on_conflict=correo,para', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ correo, para, huella: await huella(correo, para, codigo), intentos: 0, vence: new Date(Date.now() + MINUTOS * 60000).toISOString(), enviado: new Date().toISOString() }) })
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMITENTE, to: [correo], subject: TEXTOS[para].asunto, html: cuerpoCorreo(para, codigo), text: `${TEXTOS[para].texto}\n\nTu código: ${codigo}\n\nVence en ${MINUTOS} minutos.` }) })
  if (!r.ok) {
    console.error(`[cuenta-entrada] Resend ${r.status}: ${(await r.text()).slice(0, 200)}`)
    await rest(`codigos_correo?correo=eq.${encodeURIComponent(correo)}&para=eq.${para}`, { method: 'DELETE' }).catch(() => null)
    return malo('No pudimos enviar el correo. Revisa que esté bien escrito.')
  }
  await rest('correo_envios', { method: 'POST', body: JSON.stringify({ ip }) }).catch(() => null)
  return null
}
/* ¿Es el código? Gasta un intento; si es, lo borra */
async function revisarCodigo(correo: string, para: string, codigo: string): Promise<string | null> {
  const f: any[] = await rest(`codigos_correo?correo=eq.${encodeURIComponent(correo)}&para=eq.${para}&select=huella,intentos,vence`)
  const c = f[0], filtro = `codigos_correo?correo=eq.${encodeURIComponent(correo)}&para=eq.${para}`
  if (!c || Date.parse(c.vence) < Date.now()) return 'Ese código venció. Pide otro.'
  if (c.intentos >= MAX_INTENTOS) return 'Fallaste varias veces. Pide otro código.'
  if (await huella(correo, para, codigo) !== c.huella) {
    await rest(filtro, { method: 'PATCH', body: JSON.stringify({ intentos: c.intentos + 1 }) })
    return 'Ese código no es. Revísalo.'
  }
  await rest(filtro, { method: 'DELETE' })
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  try {
    const b = await req.json().catch(() => ({})) as Record<string, unknown>
    const correo = String(b.correo ?? '').trim().toLowerCase(), clave = String(b.clave ?? ''), codigo = String(b.codigo ?? '').replace(/\D/g, '')
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 60) || 'sin-ip'
    if (!correoValido(correo)) return malo('Escribe un correo válido.')

    if (b.accion === 'estado') {
      const tipo = await rpc('cherry_estado_correo', { correo })
      if (tipo === 'nueva' || tipo === 'sin_confirmar') return json({ ok: true, tipo, cerrado: !(await abierto(correo)) })
      return json({ ok: true, tipo })
    }

    if (b.accion === 'registrar') {
      if (!(await abierto(correo))) return malo('Cherry abre muy pronto.', { cerrado: true })
      if (!claveValida(clave)) return malo('La contraseña debe tener al menos 8 caracteres.')
      const nombre = String(b.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
      const tipo = await rpc('cherry_estado_correo', { correo })
      const datos = { password: clave, email_confirm: false, user_metadata: { nombre, acepto_terminos: new Date().toISOString() }, app_metadata: { origen: 'registro' } }
      if (tipo === 'nueva') await admin('POST', '', { email: correo, ...datos })
      else if (tipo === 'sin_confirmar') await admin('PUT', `/${await rpc('cherry_id_correo', { correo })}`, datos)
      else return malo('Ese correo ya tiene cuenta.', { tipo })
      return (await enviarCodigo(correo, 'registro', ip)) ?? json({ ok: true })
    }

    if (b.accion === 'confirmar') {
      const err = await revisarCodigo(correo, 'registro', codigo)
      if (err) return malo(err)
      await admin('PUT', `/${await rpc('cherry_id_correo', { correo })}`, { email_confirm: true })
      return json({ ok: true })
    }

    if (b.accion === 'reenviar') {
      const para = b.para === 'recuperar' ? 'recuperar' : 'registro'
      return (await enviarCodigo(correo, para, ip)) ?? json({ ok: true })
    }

    if (b.accion === 'recuperar') {
      const tipo = await rpc('cherry_estado_correo', { correo })
      if (tipo === 'nueva') return json({ ok: true })   // no se le dice a nadie qué correos existen por aquí
      return (await enviarCodigo(correo, 'recuperar', ip)) ?? json({ ok: true })
    }

    if (b.accion === 'cambiar_clave') {
      if (!claveValida(clave)) return malo('La contraseña debe tener al menos 8 caracteres.')
      const err = await revisarCodigo(correo, 'recuperar', codigo)
      if (err) return malo(err)
      await admin('PUT', `/${await rpc('cherry_id_correo', { correo })}`, { password: clave, email_confirm: true, app_metadata: { clave_pendiente: false } })
      return json({ ok: true })
    }
    return malo('Acción no válida.')
  } catch (e) {
    console.error('[cuenta-entrada]', String(e).slice(0, 300))
    return json({ error: 'Algo falló. Intenta de nuevo.' }, 500)
  }
})

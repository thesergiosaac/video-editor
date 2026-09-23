/* aws-medir — cuánto cuesta de verdad un render (23-sep-2026)
 *
 * TEMPORAL. Existe para contestar una pregunta: si Cherry regala un video a cada quien se
 * registre, ¿cuánto cuesta ese regalo? Sin el número, el tope de la prueba gratis se pone a ojo.
 *
 * Vive aquí y no en el portátil a propósito: las llaves de AWS están en los secretos de este
 * proyecto y no tienen por qué salir de ahí para responder una pregunta de facturación.
 *
 * Pregunta dos cosas:
 *   · a Lambda, cuánta memoria tiene puesta la función de Remotion (la memoria es la mitad del
 *     precio: se cobra por gigabyte-segundo, no por segundo);
 *   · a CloudWatch, cuántos milisegundos y cuántas llamadas lleva esa función en el periodo.
 *
 * ⚠️ Un render de Remotion NO es una llamada: reparte el video en trozos y lanza muchas Lambdas
 * a la vez. Por eso el coste por render sale de dividir el total del periodo entre los renders
 * que hubo, y esa cuenta se hace fuera con lo que dice la base.
 *
 * Borrar cuando esté medido.
 */
const REGION = Deno.env.get('AWS_REGION') || 'us-east-1'
const ACCESO = Deno.env.get('AWS_ACCESS_KEY_ID') || ''
const SECRETO = Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''
const FUNCION = Deno.env.get('REMOTION_FUNCTION_NAME') || ''

/* Precios de Lambda en us-east-1 (arquitectura x86), a 23-sep-2026. Si AWS los cambia, esto
   miente: están escritos aquí para que se vean, no escondidos en una fórmula. */
const USD_POR_GB_SEG = 0.0000166667
const USD_POR_LLAMADA = 0.0000002

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
const sha256 = async (s: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))

async function hmac(llave: ArrayBuffer, msg: string) {
  const k = await crypto.subtle.importKey('raw', llave, { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
}

/* SigV4, el mismo que ya usa `invoke-lambda`, pero sirviendo a cualquier servicio de AWS. */
async function firmado(servicio: string, host: string, metodo: string, ruta: string,
                       consulta: string, cuerpo: string, tipo?: string) {
  const ahora = new Date()
  const dia = ahora.toISOString().slice(0, 10).replace(/-/g, '')
  const sello = ahora.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const hashCuerpo = await sha256(cuerpo)

  const cabeceras: [string, string][] = [['host', host]]
  if (tipo) cabeceras.push(['content-type', tipo])
  cabeceras.push(['x-amz-date', sello])
  cabeceras.sort((a, b) => a[0] < b[0] ? -1 : 1)

  const canon = cabeceras.map(([k, v]) => `${k}:${v}\n`).join('')
  const firmadas = cabeceras.map(([k]) => k).join(';')
  const peticion = `${metodo}\n${ruta}\n${consulta}\n${canon}\n${firmadas}\n${hashCuerpo}`

  const ambito = `${dia}/${REGION}/${servicio}/aws4_request`
  const porFirmar = `AWS4-HMAC-SHA256\n${sello}\n${ambito}\n${await sha256(peticion)}`

  let k: ArrayBuffer = new TextEncoder().encode('AWS4' + SECRETO).buffer as ArrayBuffer
  for (const paso of [dia, REGION, servicio, 'aws4_request']) k = await hmac(k, paso)
  const firma = hex(await hmac(k, porFirmar))

  const cab: Record<string, string> = {
    'x-amz-date': sello,
    Authorization: `AWS4-HMAC-SHA256 Credential=${ACCESO}/${ambito}, ` +
      `SignedHeaders=${firmadas}, Signature=${firma}`,
  }
  if (tipo) cab['content-type'] = tipo
  return cab
}

/* Cuánta memoria tiene la función de Remotion.
   ⚠️ Se pregunta a AWS, y si el usuario no tiene permiso —que es el caso: `carrete-servidor`
   puede invocar la Lambda pero no leer su configuración— se saca del NOMBRE. Remotion las
   bautiza `remotion-render-4-0-123-mem2048mb-disk2048mb-120sec`, así que el nombre ya lo dice
   todo y no hace falta tocar los permisos de AWS para medir esto. */
function delNombre() {
  const mem = /mem(\d+)mb/i.exec(FUNCION)
  const disco = /disk(\d+)mb/i.exec(FUNCION)
  const tope = /(\d+)sec/i.exec(FUNCION)
  return {
    megas: mem ? Number(mem[1]) : 0,
    disco_mb: disco ? Number(disco[1]) : 0,
    tope_seg: tope ? Number(tope[1]) : 0,
    de_donde: 'del nombre de la función',
  }
}

async function memoria() {
  const host = `lambda.${REGION}.amazonaws.com`
  const ruta = `/2015-03-31/functions/${encodeURIComponent(FUNCION)}/configuration`
  try {
    const cab = await firmado('lambda', host, 'GET', ruta, '', '')
    const r = await fetch(`https://${host}${ruta}`, { headers: cab })
    if (!r.ok) throw new Error(String(r.status))
    const d = await r.json()
    return { megas: d.MemorySize, disco_mb: d.EphemeralStorage?.Size ?? 0,
             tope_seg: d.Timeout, arquitectura: (d.Architectures || ['x86_64'])[0],
             de_donde: 'preguntando a AWS' }
  } catch {
    return { ...delNombre(), arquitectura: 'x86_64' }
  }
}

/* Cuántos milisegundos y cuántas llamadas lleva, del día tal al día cual.
   CloudWatch contesta en XML: se saca a mano lo poco que hace falta. */
async function metrica(nombre: string, desde: string, hasta: string) {
  const host = `monitoring.${REGION}.amazonaws.com`
  const cuerpo = new URLSearchParams({
    Action: 'GetMetricStatistics', Version: '2010-08-01',
    Namespace: 'AWS/Lambda', MetricName: nombre,
    'Dimensions.member.1.Name': 'FunctionName',
    'Dimensions.member.1.Value': FUNCION,
    StartTime: desde, EndTime: hasta,
    Period: '86400', 'Statistics.member.1': 'Sum',
  }).toString()
  const tipo = 'application/x-www-form-urlencoded; charset=utf-8'
  const cab = await firmado('monitoring', host, 'POST', '/', '', cuerpo, tipo)
  const r = await fetch(`https://${host}/`, { method: 'POST', headers: cab, body: cuerpo })
  const txt = await r.text()
  if (!r.ok) throw new Error(`CloudWatch respondió ${r.status}: ${txt.slice(0, 300)}`)
  const sumas = [...txt.matchAll(/<Sum>([\d.eE+-]+)<\/Sum>/g)].map(m => Number(m[1]))
  return { total: sumas.reduce((a, b) => a + b, 0), dias: sumas.length }
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url)
    const dias = Math.min(Math.max(Number(u.searchParams.get('dias')) || 30, 1), 90)
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - dias * 86400000)

    const mem = await memoria()
    let dur = { total: 0, dias: 0 }, llam = { total: 0, dias: 0 }, pega = ''
    try {
      ;[dur, llam] = await Promise.all([
        metrica('Duration', desde.toISOString(), hasta.toISOString()),
        metrica('Invocations', desde.toISOString(), hasta.toISOString()),
      ])
    } catch (e) { pega = String(e) }

    const gbSeg = (dur.total / 1000) * (mem.megas / 1024)
    const usd = gbSeg * USD_POR_GB_SEG + llam.total * USD_POR_LLAMADA

    return new Response(JSON.stringify({
      funcion: FUNCION, region: REGION, ...mem,
      desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10),
      milisegundos: Math.round(dur.total),
      llamadas: Math.round(llam.total),
      gb_segundos: Math.round(gbSeg),
      usd_lambda: Number(usd.toFixed(4)),
      /* Solo Lambda. El almacenamiento y la salida de S3 van aparte y son más pequeños. */
      nota: 'Solo el cómputo de Lambda. S3 no está contado.',
      ...(pega ? { cloudwatch_dijo: pega } : {}),
    }, null, 2), { headers: { 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

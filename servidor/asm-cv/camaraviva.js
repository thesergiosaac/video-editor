/* camaraviva.js — LA CÁMARA VIVA EN EL VIDEO FINAL (30-oct-2026). Solo corre si el video es de Cámara viva (es()); los demás no pasan por aquí.
 *
 * Del plan guardado con el video (renders.graficos: plan, caras, imágenes) y de lo que escogió la persona (subtitle_config.graficos) saca:
 *   · la CÁMARA para ffmpeg: la viva cuando hablas (camara-viva.js) y, cuando tu video va en el recuadro de una lámina, un pedazo «hueco» que lo lleva
 *     justo a ese recuadro (cv-hueco.js: las MISMAS cuentas del dibujo; movimiento.js › ramaHuecoFF);
 *   · las CAPAS: cada tramo de láminas y cada título es una capa de Remotion con transparencia (sitio REMOTION_SITIO_CV, premium/src/cv/final.tsx),
 *     con su huella en cache/cv/ como las de premium.js. Una lámina tapa todo menos el recuadro de tu video. Van encima con el mecanismo de la
 *     capa de edición: después del color (tu video se coloriza, las láminas no) y antes de los subtítulos;
 *   · dónde se callan los subtítulos (en las láminas).
 * Si una capa no sale, el video NO sale: nunca se entrega sin lo que la persona vio en el editor (lo decide el ensamblador). */
'use strict';
var crypto = require('crypto');
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');
var CV = require('./camara-viva.js');
var H = require('./cv-hueco.js');

var FPS = 30, CUADROS_POR_LAMBDA = 15, CACHE = 'cache/cv/';
var SITIO = process.env.REMOTION_SITIO_CV || '';
var BUCKET = 'remotionlambda-useast1-editorvideo', REGION = 'us-east-1';

function es(row) {
  var g = row && row.graficos, cfg = row && row.subtitle_config && row.subtitle_config.graficos;
  return !!(cfg && cfg.estilo === 'camara_viva' && g && g.estilo === 'camara_viva' && g.plan && Array.isArray(g.plan.momentos) && g.plan.momentos.length);
}

/* Un enlace de lectura a una imagen privada (firma de AWS v4 con las credenciales de esta Lambda): Remotion la baja desde otra función */
function firmar(key, segundos) {
  var ak = process.env.AWS_ACCESS_KEY_ID, sk = process.env.AWS_SECRET_ACCESS_KEY, tk = process.env.AWS_SESSION_TOKEN;
  var host = BUCKET + '.s3.' + REGION + '.amazonaws.com', ahora = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''), dia = ahora.slice(0, 8), alcance = dia + '/' + REGION + '/s3/aws4_request';
  var cod = function (s) { return encodeURIComponent(s).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); };
  var q = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': ak + '/' + alcance, 'X-Amz-Date': ahora, 'X-Amz-Expires': String(segundos || 3600), 'X-Amz-SignedHeaders': 'host' };
  if (tk) q['X-Amz-Security-Token'] = tk;
  var qs = Object.keys(q).sort().map(function (k) { return cod(k) + '=' + cod(q[k]); }).join('&');
  var ruta = '/' + key.split('/').map(cod).join('/');
  var hash = function (x) { return crypto.createHash('sha256').update(x).digest('hex'); };
  var hmac = function (k, x) { return crypto.createHmac('sha256', k).update(x).digest(); };
  var aFirmar = 'AWS4-HMAC-SHA256\n' + ahora + '\n' + alcance + '\n' + hash('GET\n' + ruta + '\n' + qs + '\nhost:' + host + '\n\nhost\nUNSIGNED-PAYLOAD');
  var k = hmac(hmac(hmac(hmac('AWS4' + sk, dia), REGION), 's3'), 'aws4_request');
  return 'https://' + host + ruta + '?' + qs + '&X-Amz-Signature=' + crypto.createHmac('sha256', k).update(aFirmar).digest('hex');
}

/* Tu foto para comentario, seguir y me gusta: un cuadro de tu video, chiquito, en la mitad del primer tramo en que hablas */
function fotoDe(baseVideo, t, ffmpegPath, dir) {
  try {
    var sal = path.join(dir, 'cv_foto.jpg');
    var r = childProcess.spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, t)), '-i', baseVideo, '-frames:v', '1', '-vf', 'scale=240:-2', '-q:v', '5', sal], { stdio: 'ignore', timeout: 30000 });
    if (r.status !== 0 || !fs.existsSync(sal)) return null;
    return 'data:image/jpeg;base64,' + fs.readFileSync(sal).toString('base64');
  } catch (e) { return null; }
}

/* ── el pedazo «hueco»: dónde va tu video mientras está en un recuadro, con muestras más seguidas cuando la cámara viaja o la lámina entra ── */
function muestras(pz) {
  var m = pz.m, mat = pz.mat, out = [], t = m.t0;
  while (t < m.t1 - 1e-4) {
    out.push(t);
    t += H.enPaso(t, m) ? 1 / 30 : t - m.t0 < 1.2 ? 1 / 12 : 1 / 4;
  }
  out.push(m.t1);
  var filas = [], tramos = [];
  out.forEach(function (x) {
    var r = H.recuadroDe(Math.min(x, m.t1 - 1e-3), m, mat);
    if (!r) { if (filas.length) { tramos.push(filas); filas = []; } return; }
    var s = Math.max(r.width / 1080, r.height / 1920) * 1.004;   // un pelo más grande: sin bordes aunque la muestra caiga entre dos cuadros
    filas.push([x, s, r.left + r.width / 2 - 540, r.top + r.height / 2 - 960]);
  });
  if (filas.length) tramos.push(filas);
  return tramos;
}
/* La cámara entera: la viva, y encima los pedazos con tu video en un recuadro */
function planCamara(tramos, piezas) {
  var huecos = [];
  piezas.forEach(function (pz) { muestras(pz).forEach(function (k) { if (k.length > 1) huecos.push({ t0: k[0][0], t1: k[k.length - 1][0], e: 'hueco', k: k }); }); });
  huecos.sort(function (a, b) { return a.t0 - b.t0; });
  var plan = [], va = 0;
  huecos.forEach(function (h) {
    if (h.t0 > va + 1e-4) plan.push({ t0: va, t1: h.t0, e: 'viva', tr: tramos });
    plan.push(h);
    va = h.t1;
  });
  plan.push({ t0: va, t1: Math.max(va, 1e4), e: 'viva', tr: tramos });
  return plan;
}

/* ── las capas: cada tramo de láminas pegadas y cada título; el título se corta donde empieza la lámina (por el hueco se vería) ── */
function capas(piezas, titulos) {
  var out = [], grupos = [];
  piezas.forEach(function (pz) {
    var g = grupos[grupos.length - 1];
    if (g && Math.abs(g[g.length - 1].m.t1 - pz.m.t0) < 1e-3) g.push(pz); else grupos.push([pz]);
  });
  var cuadro = function (t) { return Math.ceil(t * FPS - 1e-6); };
  grupos.forEach(function (g) {
    var a = g[0].m.t0, b = g[g.length - 1].m.t1;
    out.push({ piezas: g, titulos: [], n0: cuadro(a), n1: cuadro(b), lamina: true });
  });
  (titulos || []).forEach(function (ti) {
    var a = Math.max(0, ti.a - 0.05), b = ti.b + 0.3;
    grupos.forEach(function (g) { var ini = g[0].m.t0; if (ini > a && ini < b) b = ini; });
    out.push({ piezas: [], titulos: [ti], n0: cuadro(a), n1: cuadro(b), lamina: false });
  });
  return out.filter(function (c) { return c.n1 > c.n0; }).sort(function (x, y) { return x.n0 - y.n0 || (x.lamina ? 1 : -1); }).map(function (c) {
    c.p = { t0: c.n0 / FPS, t1: c.n1 / FPS, tipo: 'edicion', forma: 'capa', datos: {}, edicion: true };
    return c;
  });
}

/* Todo lo que se puede calcular sin red: del plan en segundos del video, las palabras en esos segundos, tus caras y el material de cada lámina */
function armar(plan, palabras, caras, material) {
  var prep = CV.preparar(plan, caras || []);
  var piezas = CV.piezas(plan, palabras, material);
  return { prep: prep, piezas: piezas, planMov: planCamara(prep.tramos, piezas), capas: capas(piezas, prep.titulos),
           callados: piezas.map(function (pz) { return { t0: pz.m.t0, t1: pz.m.t1 }; }), letras: letrasDe(plan.estiloTexto) };
}
function letrasDe(est) {
  if (!est) return [];
  var vistas = {}, out = [];
  [est.gruesa, est.chica].forEach(function (l) {
    if (!l || !l.fam) return;
    var k = l.fam + '|' + l.peso + '|' + !!l.it;
    if (!vistas[k]) { vistas[k] = 1; out.push({ fam: l.fam, peso: l.peso, it: !!l.it }); }
  });
  return out;
}

/* Del render al plan en segundos del video (lo mismo que cvvivo.js › armar en la página) */
function preparar(row, nominales, reales, o) {
  var GRAF = o.GRAF, g = row.graficos, cfg = row.subtitle_config.graficos, fin = (cfg.final_cv && typeof cfg.final_cv === 'object') ? cfg.final_cv : {};
  var aR = GRAF.reloj(nominales, reales);
  var sp = row.subtitle_phrases || {};
  var palabras = (Array.isArray(sp.palabras) ? sp.palabras : []).filter(function (w) { return w && String(w.word || '').trim(); })
    .map(function (w) { return { word: w.word, start: aR(Number(w.start)), end: aR(Number(w.end)) }; });
  var imagenes = fin.sinImg ? {} : (g.imagenes || {});
  var momentos = g.plan.momentos.map(function (m, i) {
    var o2 = m.objeto || {}, im = m.tipo === 'lamina' && o2.tipo !== 'grafico' ? imagenes[String(i)] : null;
    return Object.assign({}, m, { t0: aR(Number(m.t0)), t1: aR(Number(m.t1)) }, im && im.key ? { objeto: Object.assign({}, o2, { tipo: 'imagen', img: firmar(im.key, 21600) }) } : {});
  });
  var plan = Object.assign({}, g.plan, { fondo: cfg.fondo_cv || null, estiloTexto: fin.estilo || null, acento: fin.acento || null, momentos: momentos });
  // tu foto solo si algún gráfico la usa
  var conFoto = momentos.some(function (m) { return m.tipo === 'lamina' && m.objeto && m.objeto.tipo === 'grafico' && /^(comentario|seguir|me_gusta)$/.test(m.objeto.grafico); });
  var hablando = momentos.find(function (m) { return m.tipo === 'hablando'; });
  var foto = conFoto && o.baseVideo ? fotoDe(o.baseVideo, hablando ? (hablando.t0 + hablando.t1) / 2 : 1, o.ffmpegPath, o.workDir) : null;
  var material = function (m) {
    var ob = m.objeto || {};
    if (ob.tipo === 'imagen') return ob.img ? { objeto: ob.img } : {};
    if (ob.tipo === 'grafico') return Object.assign({}, foto ? { foto: foto } : {}, fin.cuenta ? { cuenta: fin.cuenta } : {});
    return {};
  };
  var A = armar(plan, palabras, g.caras || [], material);
  console.log('[CamaraViva] ' + A.piezas.length + ' láminas · ' + A.prep.titulos.length + ' títulos · ' + A.capas.length + ' capas · ' + A.planMov.filter(function (p) { return p.e === 'hueco'; }).length +
    ' tramos con tu video en el recuadro · ' + A.piezas.filter(function (p) { return p.m.paso; }).length + ' pasos de cámara · ' + ((g.caras || []).length ? 'con' : 'sin') + ' caras');
  return A;
}

/* Pide las capas a Remotion (la que ya está en la caché no se pide). Devuelve los trabajos en el formato de premium.js › esperar y capas */
var cliente = null, porQue = null;
try { cliente = require('@remotion/lambda-client'); } catch (e) { porQue = e.message; }
async function arrancar(A, o) {
  if (!cliente) throw new Error('sin @remotion/lambda-client: ' + porQue);
  if (!SITIO) throw new Error('falta REMOTION_SITIO_CV');
  var S3 = require('@aws-sdk/client-s3'), s3 = new S3.S3Client({ region: REGION });
  var t0 = Date.now(), pedidas = 0;
  var js = await Promise.all(A.capas.map(async function (c, i) {
    var props = { piezas: c.piezas, titulos: c.titulos, inicio: c.n0 / FPS, cuadros: c.n1 - c.n0, letras: A.letras };
    // la firma de las imágenes cambia en cada video: la huella se saca sin ella
    var huella = crypto.createHash('sha256').update(JSON.stringify({ v: 1, sitio: SITIO, funcion: o.funcion, crf: 26, props: props }, function (k, v) { return typeof v === 'string' && /^https:.*X-Amz-/.test(v) ? v.split('?')[0] : v; })).digest('hex').slice(0, 40);
    var key = CACHE + huella + '.webm';
    var j = { i: 500 + i, p: c.p, parte: 'todo', ancho: 1080, vidrio: false, n0: c.n0, t: c.n0 / FPS, cuadros: c.n1 - c.n0, completo: true };
    var ya = await s3.send(new S3.HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(function () { return true; }, function () { return false; });
    if (ya) { j.cache = true; j.keyRemotion = key; j.bucket = BUCKET; return j; }
    var r = await cliente.renderMediaOnLambda({ region: REGION, functionName: o.funcion, serveUrl: SITIO, composition: 'CamaraViva', inputProps: props,
      codec: 'vp9', imageFormat: 'png', pixelFormat: 'yuva420p', crf: 26, framesPerLambda: CUADROS_POR_LAMBDA, privacy: 'private', maxRetries: 2, outName: 'capa.webm', timeoutInMilliseconds: 60000 });
    pedidas++;
    j.renderId = r.renderId; j.bucket = r.bucketName; j.guardar = key; j.keyRemotion = 'renders/' + r.renderId + '/capa.webm';
    return j;
  }));
  console.log('[CamaraViva] ' + js.length + ' capas: ' + (js.length - pedidas) + ' de la caché, ' + pedidas + ' pedidas a Remotion en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  return js;
}

module.exports = { es: es, preparar: preparar, armar: armar, arrancar: arrancar, capas: capas, planCamara: planCamara, firmar: firmar };

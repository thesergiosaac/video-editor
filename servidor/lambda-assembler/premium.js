/* premium.js — los GRÁFICOS PREMIUM (19-sep-2026, «si, excelente añadamos los graficos premium»).
 *
 * Los mismos momentos y tiempos que el estilo clásico (los elige graficos.js), pero cada gráfico lo dibuja REMOTION en
 * su propia nube de Lambdas, sobre fondo transparente (WebM VP9 con transparencia). El ensamblador los pide apenas sabe
 * cuáles van (mientras prepara el color y la base), y al final los pone encima igual que las capas del canvas.
 *
 * Cada pieza son una o dos capas:
 *   · «encima»: una sola capa del ancho del video (la tarjeta de vidrio) — lleva vidrio: el ensamblador desenfoca el
 *     video que queda debajo usando la transparencia de la capa como máscara.
 *   · «partida» y «completa»: el FONDO va en media resolución (son degradados) y el CONTENIDO en el tamaño del video.
 * Si Remotion falla o tarda demasiado, el ensamblador sigue con el estilo clásico (capa.js) y el video igual sale.
 *
 * (6-oct-2026) LA CACHÉ. Cada capa tiene una huella de TODO lo que la define (sus datos, colores, tamaño, cuadros, el
 * sitio de Remotion y cómo se codifica). Al terminar se copia a `cache/premium/<huella>.webm`; si otra fabricación pide
 * una capa con la misma huella, se usa esa y no se le pide nada a Remotion (lo más caro de un video con gráficos).
 * Cambiar una plantilla = sitio nuevo = huellas nuevas: nunca sale una capa vieja. Lo que dejó Remotion se borra.
 */
var path = require('path');
var crypto = require('crypto');
var childProcess = require('child_process');
var GRAF = require('./graficos.js');
var S3Mod = null, s3 = null;
try { S3Mod = require('@aws-sdk/client-s3'); s3 = new S3Mod.S3Client({ region: 'us-east-1' }); } catch (e) { console.log('[Premium] sin cliente de S3: la caché no se usa'); }
var BUCKET = 'remotionlambda-useast1-editorvideo';
var CACHE = 'cache/premium/';

var REGION = 'us-east-1';
var FUNCION = process.env.REMOTION_FUNCION || 'remotion-render-4-0-526-mem3008mb-disk2048mb-240sec';
var SITIO = process.env.REMOTION_SITIO || 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/sites/cherry-graficos-premium/index.html';
var CUADROS_POR_LAMBDA = 5;      // medido el 19-sep: es lo más rápido para gráficos de 3 a 7 s
var ESPERA_MAX_MS = 180000;

var cliente = null, porQue = null;
try { cliente = require('@remotion/lambda-client'); } catch (e) { porQue = e.message; }
function disponible() { return !!cliente; }
function porQueNo() { return porQue; }

/* Las capas que hay que dibujar para estas piezas */
function trabajos(piezas, o) {
  var out = [], i0 = (o && o.i0) || 0;            // (29-sep) la segunda tanda (las de tu recorte) sigue la numeración
  (piezas || []).forEach(function (p, ii) {
    var i = i0 + ii;
    var c = GRAF.cuadros(p, o.fps);
    var comun = { i: i, p: p, cuadros: c.total, inicio: c.inicio, n0: c.n0 };
    /* (24-sep) el navegador y el telefono «detras de ti»: la ventana va en 'atras' (detras de la persona) y
       el titulo en 'delante'. Los demas graficos detras de ti siguen como estaban. */
    if (p.forma === 'profundo' && (p.tipo === 'navegador' || p.tipo === 'telefono')) {
      out.push(Object.assign({ parte: 'atras', ancho: par(o.W), vidrio: false }, comun));
      // (24-sep) la capa de delante solo lleva el titulo: sin titulo no se pide
      if (p.datos && String(p.datos.titulo || '').trim()) out.push(Object.assign({ parte: 'delante', ancho: par(o.W), vidrio: false }, comun));
    }
    /* (29-sep) La persiana: una sola capa del cuadro entero, sin vidrio. La tarjeta va DESPUÉS de los subtítulos
       (pedazos.js); la ventana, empuja, te sales y tú delante van como siempre y el video lo mueve graficos.js. */
    /* (2-oct) la pantalla con sello: una capa del cuadro entero, sin vidrio, con tu recorte adentro (va antes de los subtítulos) */
    else if (p.forma === 'falso' || p.forma === 'bn' || p.forma === 'rodea' || p.forma === 'noche') out.push(Object.assign({ parte: 'todo', ancho: par(o.W), vidrio: false }, comun));
    else if (p.forma === 'tarjeta' || (GRAF.CALLAN && GRAF.CALLAN[p.forma])) out.push(Object.assign({ parte: 'todo', ancho: par(o.W), vidrio: false }, comun));
    else if (p.forma === 'encima') out.push(Object.assign({ parte: 'todo', ancho: par(o.W), vidrio: true }, comun));
    else if (p.forma === 'lado') out.push(Object.assign({ parte: 'todo', ancho: par(o.W), vidrio: false }, comun));   // mockup: el celular tapa, no hay vidrio
    else {
      out.push(Object.assign({ parte: 'fondo', ancho: par(o.W / 2), vidrio: false }, comun));
      out.push(Object.assign({ parte: 'contenido', ancho: par(o.W), vidrio: false }, comun));
    }
  });
  return out;
}
function par(n) { return Math.round(n / 2) * 2; }

/* (6-oct) La huella de una capa: todo lo que cambia lo que dibuja Remotion */
function huella(props) {
  var t = JSON.stringify({ v: 1, sitio: SITIO, funcion: FUNCION, composicion: 'Grafico', codec: 'vp9', px: 'yuva420p', crf: 30, props: props });
  return crypto.createHash('sha256').update(t).digest('hex').slice(0, 40);
}
function enCache(key) {
  if (!s3) return Promise.resolve(false);
  return s3.send(new S3Mod.HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(function () { return true; }, function () { return false; });
}

/* Arranca todos los renders en Remotion Lambda (no espera). Devuelve los trabajos con su renderId.
   (6-oct) La capa que ya está en la caché no se pide: queda lista con su dirección. */
async function arrancar(piezas, o) {
  if (!cliente) throw new Error('sin @remotion/lambda-client: ' + porQue);
  var js = trabajos(piezas, o);
  var t0 = Date.now();
  await Promise.all(js.map(async function (j) {
    // (24-sep) una pantalla puede traer su propio color; si no, el de Gráficos
    var props = { p: j.p, color: (j.p && j.p.color) || o.color, W: o.W, H: o.H, fps: o.fps, inicio: j.inicio, parte: j.parte, ancho: j.ancho };
    var key = CACHE + huella(props) + '.webm';
    if (await enCache(key)) { j.cache = true; j.keyRemotion = key; j.bucket = BUCKET; return; }
    var r = await cliente.renderMediaOnLambda({
      region: REGION, functionName: FUNCION, serveUrl: SITIO, composition: 'Grafico', inputProps: props,
      codec: 'vp9', imageFormat: 'png', pixelFormat: 'yuva420p', crf: 30, framesPerLambda: CUADROS_POR_LAMBDA,
      privacy: 'private', maxRetries: 1, outName: 'capa.webm',
    });
    j.renderId = r.renderId; j.bucket = r.bucketName; j.guardar = key;
    j.keyRemotion = 'renders/' + r.renderId + '/capa.webm';
  }));
  var deCache = js.filter(function (j) { return j.cache; }).length;
  console.log('[Premium] ' + js.length + ' capas: ' + deCache + ' de la caché, ' + (js.length - deCache) + ' pedidas a Remotion en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s (' +
    js.map(function (j) { return j.p.tipo + '/' + j.parte + (j.cache ? ' ♻' : ''); }).join(' · ') + ')');
  return js;
}

/* (6-oct) Una capa recién hecha pasa a la caché y lo que dejó Remotion se borra (antes se quedaba para siempre) */
async function guardarEnCache(j) {
  if (!s3 || !j.guardar || !j.keyRemotion) return;
  try {
    await s3.send(new S3Mod.CopyObjectCommand({ Bucket: BUCKET, Key: j.guardar, CopySource: (j.bucket || BUCKET) + '/' + j.keyRemotion, ContentType: 'video/webm' }));
    j.keyRemotion = j.guardar; j.guardar = null;
    if (j.renderId) { var id = j.renderId; j.renderId = null; try { cliente.deleteRender({ region: REGION, bucketName: j.bucket, renderId: id }).catch(function () {}); } catch (e) {} }
  } catch (e) { console.log('[Premium] la capa ' + j.p.tipo + '/' + j.parte + ' no se guardó en la caché: ' + String(e.message || e).slice(0, 160)); }
}

/* Espera a que terminen (o se rinde). Devuelve solo las capas que salieron bien. */
async function esperar(js, tope) {
  var t0 = Date.now(), limite = tope || ESPERA_MAX_MS;
  var listas = await Promise.all((js || []).map(async function (j) {
    if (j.cache) { j.segundos = 0; j.costo = '♻ caché'; return j; }      // (6-oct) ya estaba hecha
    for (;;) {
      if (Date.now() - t0 > limite) { console.log('[Premium] ' + j.p.tipo + '/' + j.parte + ': se pasó de ' + Math.round(limite / 1000) + ' s'); return null; }
      await new Promise(function (r) { setTimeout(r, 1200); });
      var pr;
      try { pr = await cliente.getRenderProgress({ renderId: j.renderId, bucketName: j.bucket, functionName: FUNCION, region: REGION }); }
      catch (e) { console.log('[Premium] ' + j.p.tipo + '/' + j.parte + ': ' + String(e.message || e).slice(0, 200)); return null; }
      if (pr.fatalErrorEncountered) { console.log('[Premium] ' + j.p.tipo + '/' + j.parte + ' falló: ' + (pr.errors || []).map(function (e) { return e.message; }).join(' | ').slice(0, 300)); return null; }
      if (pr.done) {
        j.segundos = Number(((Date.now() - t0) / 1000).toFixed(1));
        j.costo = pr.costs && pr.costs.displayCost;
        if (pr.outKey) j.keyRemotion = pr.outKey;
        else if (pr.outputFile) { var m = /amazonaws\.com\/(?:[^/]+\/)?(renders\/.+)$/.exec(pr.outputFile); if (m) j.keyRemotion = m[1]; }
        await guardarEnCache(j);
        return j;
      }
    }
  }));
  var ok = listas.filter(Boolean);
  console.log('[Premium] ' + ok.length + ' de ' + (js || []).length + ' capas listas en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' +
    (ok.length ? ' (' + ok.map(function (j) { return j.p.tipo + '/' + j.parte + ' ' + j.segundos + 's ' + (j.costo || '') ; }).join(' · ') + ')' : ''));
  return ok;
}

/* Un WebM con transparencia → capa ffv1 bgra del tamaño del video (la del fondo se amplía) */
function convertir(webm, salida, o) {
  return new Promise(function (resolve, reject) {
    var caja = GRAF.cajaPremium(o.p, o.W, o.H);
    var args = ['-hide_banner', '-loglevel', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', webm];
    if (o.ancho !== o.W) args = args.concat(['-vf', 'scale=' + par(o.W) + ':' + par(caja.h) + ':flags=bicubic']);
    args = args.concat(['-c:v', 'ffv1', '-level', '3', '-slices', '4', '-pix_fmt', 'bgra', salida]);
    var ff = childProcess.spawn(o.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    var err = '';
    ff.stderr.on('data', function (d) { err += d; });
    ff.on('error', reject);
    ff.on('close', function (code) { code === 0 ? resolve(salida) : reject(new Error('convertir la capa terminó en ' + code + ': ' + err.slice(-300))); });
  });
}

/* Baja del bucket las capas premium y las deja listas para capa.filtros (de a dos a la vez) */
async function capas(js, o) {
  var out = [], cola = (js || []).slice(), t0 = Date.now();
  async function trabajador() {
    while (cola.length) {
      var j = cola.shift();
      var webm = path.join(o.dir, 'premium_' + j.i + '_' + j.parte + '.webm');
      try {
        await o.bajar(j.keyRemotion, webm);
        /* el fondo viene en media resolución: se amplía dentro del mismo ffmpeg (escala) */
        var caja = GRAF.cajaPremium(j.p, o.W, o.H);
        // (30-sep) las de la edición traen su hora en segundos (j.t): n0 viene contado a 30 y el máster va a 60
        out.push({ p: j.p, local: webm, webm: true, x: 0, y: 0, t: j.t != null ? j.t : j.n0 / o.fps, cuadros: j.cuadros, vidrio: !!j.vidrio,
                   escala: j.ancho !== o.W ? par(o.W) + ':' + par(j.completo ? o.H : caja.h) : null,   // (30-sep) las de la edición son del cuadro entero
                   // (6-oct) ⚠️ `orden` había quedado DENTRO del comentario de arriba: las capas se ordenaban al azar
                   orden: j.i * 10 + (j.parte === 'fondo' || j.parte === 'atras' ? 0 : 1),
                   delante: j.parte === 'delante', tarjeta: j.p.forma === 'tarjeta' });
      } catch (e) { console.log('[Premium] la capa ' + j.i + '/' + j.parte + ' no se pudo usar: ' + String(e.message || e).slice(0, 200)); }
    }
  }
  await Promise.all([trabajador(), trabajador()]);
  console.log('[Premium] ' + out.length + ' capas listas para montar en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  return out.sort(function (a, b) { return a.orden - b.orden; });
}

/* Lo que viaja a cada pedazo (solo las capas que le tocan) */
function paraPedazo(js, desde, hasta) {
  return (js || []).filter(function (j) { return j.p.t1 > desde - 0.2 && j.p.t0 < hasta + 0.2; })
    .map(function (j) { return { i: j.i, p: j.p, parte: j.parte, ancho: j.ancho, vidrio: j.vidrio, n0: j.n0, t: j.t, cuadros: j.cuadros, keyRemotion: j.keyRemotion, completo: !!j.completo }; });
    // (la marca `delante` la vuelve a poner capas() a partir de `parte`)
}

/* Borra del bucket lo que dejó Remotion (no importa si falla) */
function limpiar(js) {
  if (!cliente) return;
  (js || []).forEach(function (j) {
    if (!j.renderId) return;
    try { cliente.deleteRender({ region: REGION, bucketName: j.bucket, renderId: j.renderId }).catch(function () {}); } catch (e) {}
  });
}

module.exports = { disponible: disponible, porQueNo: porQueNo, trabajos: trabajos, arrancar: arrancar, esperar: esperar, limpiar: limpiar,
                   convertir: convertir, capas: capas, paraPedazo: paraPedazo, FUNCION: FUNCION, SITIO: SITIO };

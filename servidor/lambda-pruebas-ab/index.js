'use strict';
/* cherry-pruebas-ab — las versiones de una Prueba A/B (23-oct-2026)
 *
 * Sergio: «tener exactamente el mismo vídeo pero cambiarle el gancho». Parte 1 = ganchos de TEXTO: la página dibuja el texto
 * de cada versión con las letras de la marca en un PNG transparente del tamaño del video (cubo público `publicar`) y aquí se
 * pone encima de los primeros segundos del video. Una llamada por versión (en paralelo, asíncronas: las lanza la función
 * `pruebas-ab`). Sin texto, la versión es el video tal como está (se copia sin volver a comprimir).
 *
 * Pedidos:
 *   { modo:'version', prueba, user, letra, fuente:{url}|{key}, tarjeta?, segundos? }
 *       → clips/pruebas/<user>/<prueba>/<letra>.mp4 y, al terminar (bien o mal), <letra>.json = { ok, video?, error? }.
 *         `clips/` se lee sin credenciales: Instagram lo descarga de ahí y la función mira el .json sin llaves nuevas.
 *   { modo:'borrar', prueba, user }  → borra clips/pruebas/<user>/<prueba>/ (cuando la prueba termina: Instagram ya tiene
 *         su copia y guardar videos que nadie va a abrir cuesta todos los meses).
 *
 * La compresión es la misma de la versión para Instagram del ensamblador (compresionIG): crf 18, tope según la duración
 * para no pasar los 300 MB que acepta Instagram, cuadro clave cada 2 s, a los cuadros originales.
 * ⚠️ Un video HDR (el original del iPhone, tal cual) se rechaza por ahora: tratado como normal sale lavado.
 */
var spawn = require('child_process').spawn;
var fs = require('fs');
var https = require('https');
var S3 = require('@aws-sdk/client-s3');
var pipeline = require('stream/promises').pipeline;

var BUCKET = 'remotionlambda-useast1-editorvideo';
var REGION = 'us-east-1';
var s3 = new S3.S3Client({ region: REGION });
var FFMPEG = (function () {
  var c = [process.env.FFMPEG_PATH, '/opt/bin/ffmpeg'];
  for (var i = 0; i < c.length; i++) { if (c[i]) { try { fs.statSync(c[i]); return c[i]; } catch (_) {} } }
  return '/opt/bin/ffmpeg';
})();

var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* De dónde se acepta bajar: el cubo de los videos (o su CDN) y el cubo público `publicar` de Supabase */
var HOSTS = /^https:\/\/(remotionlambda-useast1-editorvideo\.s3\.us-east-1\.amazonaws\.com|d2b7db4md5k57t\.cloudfront\.net|xsptcepijtnmowqauyxw\.supabase\.co)\//;

function carpeta(user, prueba) { return 'clips/pruebas/' + user + '/' + prueba + '/'; }
function urlDe(key) { return 'https://' + BUCKET + '.s3.' + REGION + '.amazonaws.com/' + key; }

function correr(args, ms) {
  return new Promise(function (ok, mal) {
    var p = spawn(FFMPEG, args), err = '';
    var t = setTimeout(function () { p.kill('SIGKILL'); }, ms || 800000);
    p.stderr.on('data', function (d) { err += d; if (err.length > 200000) err = err.slice(-100000); });
    p.on('error', function (e) { clearTimeout(t); mal(e); });
    p.on('close', function (c) {
      clearTimeout(t);
      if (c === 0) return ok(err);
      var e = new Error('ffmpeg ' + c + ': ' + err.slice(-600)); e.salida = err; mal(e);
    });
  });
}

function bajarUrl(url, dest, vueltas) {
  return new Promise(function (ok, mal) {
    https.get(url, function (r) {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && (vueltas || 0) < 3) {
        r.resume();
        var otra = new URL(r.headers.location, url).toString();
        if (!HOSTS.test(otra)) return mal(new Error('redirección a otro sitio'));
        return bajarUrl(otra, dest, (vueltas || 0) + 1).then(ok, mal);
      }
      if (r.statusCode !== 200) { r.resume(); return mal(new Error('al bajar respondió ' + r.statusCode)); }
      pipeline(r, fs.createWriteStream(dest)).then(ok, mal);
    }).on('error', mal);
  });
}

async function bajar(fuente, user, dest) {
  if (fuente && fuente.key) {
    var k = String(fuente.key);
    // solo el archivo original de un clip de ESTA persona
    if (k.indexOf('uploads/' + user + '/') !== 0 || /\.\.|[?#\\]/.test(k)) throw new Error('ese archivo no es de esta cuenta');
    var o = await s3.send(new S3.GetObjectCommand({ Bucket: BUCKET, Key: k }));
    await pipeline(o.Body, fs.createWriteStream(dest));
    return;
  }
  var u = String((fuente && fuente.url) || '');
  if (!HOSTS.test(u)) throw new Error('esa dirección no es de Cherry');
  await bajarUrl(u, dest);
}

/* Lo que mide el video (el mismo parseInfo del procesador de medios, recortado) */
async function medir(file) {
  var t = '';
  // sin salida, ffmpeg termina en error después de describir el archivo: lo que interesa es esa descripción
  try { await correr(['-hide_banner', '-i', file], 60000); } catch (e) { t = String(e.salida || e.message || ''); }
  var d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(t);
  var f = /Video:.*?(\d+(?:\.\d+)?)\s*fps/.exec(t) || /Video:.*?(\d+(?:\.\d+)?)\s*tbr/.exec(t);
  var linea = (/Stream[^\n]*Video:[^\n]*/.exec(t) || [''])[0];
  return {
    dur: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : null,
    fps: f ? Number(f[1]) : 30,
    hdr: /arib-std-b67|smpte2084/.test(linea),
    audio: /Stream[^\n]*Audio:/.test(t),
  };
}

/* La de la versión para Instagram del ensamblador (compresionIG) */
function compresionIG(info) {
  var dur = Math.max(1, info.dur || 60);
  var tope = Math.max(4, Math.min(20, Math.floor(280 * 8 / dur)));
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-crf', '18',
          '-maxrate', tope + 'M', '-bufsize', (2 * tope) + 'M', '-g', String(Math.round(2 * (info.fps || 30))), '-pix_fmt', 'yuv420p', '-threads', '0'];
}

async function subir(key, file, tipo) {
  var buf = fs.readFileSync(file);
  await s3.send(new S3.PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: tipo, ContentLength: buf.length }));
}
async function anotar(user, prueba, letra, d) {
  var body = Buffer.from(JSON.stringify(Object.assign({ letra: letra, hecho: new Date().toISOString() }, d)));
  await s3.send(new S3.PutObjectCommand({ Bucket: BUCKET, Key: carpeta(user, prueba) + letra + '.json', Body: body,
    ContentType: 'application/json', CacheControl: 'no-cache, max-age=0', ContentLength: body.length }));
}

async function version(ev) {
  var user = String(ev.user || ''), prueba = String(ev.prueba || ''), letra = String(ev.letra || '');
  if (!UUID.test(user) || !UUID.test(prueba) || !/^[ABC]$/.test(letra)) throw new Error('pedido incompleto');
  var dir = '/tmp/ab_' + prueba + '_' + letra;
  fs.mkdirSync(dir, { recursive: true });
  var src = dir + '/fuente', png = dir + '/tarjeta.png', out = dir + '/' + letra + '.mp4';
  try {
    var t0 = Date.now();
    await bajar(ev.fuente, user, src);
    var info = await medir(src);
    if (info.hdr) throw new Error('hdr');
    var seg = Math.max(1, Math.min(10, Number(ev.segundos) || 3));
    var args;
    if (ev.tarjeta) {
      if (!HOSTS.test(String(ev.tarjeta))) throw new Error('esa tarjeta no es de Cherry');
      await bajarUrl(String(ev.tarjeta), png);
      /* la tarjeta se lleva al tamaño del video (scale2ref: el original puede venir girado o de otro tamaño) y va encima
         solo los primeros `seg` segundos; el sonido se copia tal cual */
      args = ['-y', '-hide_banner', '-i', src, '-i', png, '-filter_complex',
        '[1:v]format=rgba[p];[p][0:v]scale2ref[c][v];[v][c]overlay=0:0:enable=\'lt(t,' + seg + ')\',format=yuv420p[o]',
        '-map', '[o]'].concat(info.audio ? ['-map', '0:a:0', '-c:a', 'copy'] : [])
        .concat(compresionIG(info)).concat(['-movflags', '+faststart', out]);
    } else {
      args = ['-y', '-hide_banner', '-i', src, '-map', '0:v:0'].concat(info.audio ? ['-map', '0:a:0'] : [])
        .concat(['-c', 'copy', '-movflags', '+faststart', out]);
    }
    await correr(args, 820000);
    var key = carpeta(user, prueba) + letra + '.mp4';
    await subir(key, out, 'video/mp4');
    var tam = fs.statSync(out).size;
    await anotar(user, prueba, letra, { ok: true, video: urlDe(key), tam: tam, dur: info.dur, ms: Date.now() - t0 });
    console.log('[pruebas-ab] ' + prueba + ' ' + letra + ' listo: ' + Math.round(tam / 1048576) + ' MB en ' + Math.round((Date.now() - t0) / 1000) + ' s');
  } catch (e) {
    var msg = String((e && e.message) || e);
    console.error('[pruebas-ab] ' + prueba + ' ' + letra + ' falló: ' + msg);
    await anotar(user, prueba, letra, { ok: false, error: msg.slice(0, 400) }).catch(function () {});
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }
  return { ok: true };
}

async function borrar(ev) {
  var user = String(ev.user || ''), prueba = String(ev.prueba || '');
  if (!UUID.test(user) || !UUID.test(prueba)) throw new Error('pedido incompleto');
  var pref = carpeta(user, prueba), n = 0;
  var l = await s3.send(new S3.ListObjectsV2Command({ Bucket: BUCKET, Prefix: pref, MaxKeys: 50 }));
  var objs = (l.Contents || []).filter(function (o) { return o.Key && o.Key.indexOf(pref) === 0; });
  if (objs.length) {
    await s3.send(new S3.DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objs.map(function (o) { return { Key: o.Key }; }), Quiet: true } }));
    n = objs.length;
  }
  console.log('[pruebas-ab] ' + prueba + ' borrada: ' + n + ' archivos');
  return { ok: true, borrados: n };
}

exports.handler = async function (ev) {
  ev = ev || {};
  if (ev.modo === 'version') return version(ev);
  if (ev.modo === 'borrar') return borrar(ev);
  return { ok: false, error: 'modo desconocido' };
};

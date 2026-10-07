'use strict';
// carrete-assembler v17 (24-sep-2026) — los EFECTOS se suman en una sola pista (en JS) antes de mezclarlos con la voz:
//   con «Que Cherry los ponga» salen 30–40 y ffmpeg no admite tantas entradas (pan: 64 canales; amerge: 64 entradas).
// carrete-assembler v19 (30-sep-2026) — LA CAPA DE EDICIÓN (edicion.js): un proyecto con una edición hecha a mano (tabla
//   ediciones) monta sus capas de Remotion ya dibujadas encima del color (el color solo toca el video), encoge el video a su
//   tarjeta en la pantalla dividida, te deja delante de lo que va detrás de ti, deja la cámara quieta donde toca y corre o
//   calla los subtítulos en sus ventanas. Los gráficos de la IA, las pantallas y las escenas no van con una edición.
// carrete-assembler v16 (24-sep-2026) — LA VOZ DE ESTUDIO (voz.js): con subtitle_config.voz = 'estudio', la voz ya cortada
//   de la base va a Auphonic «Studio Voice» mientras se dibuja el video, y al final se cambia (antes de los efectos).
//   El resultado queda en renders.voz_estudio. Si falla, tarda o trae la cortinilla de la cuenta gratis: voz normal.
// carrete-assembler v15 (24-sep-2026) — EFECTOS DE SONIDO del Guion (subtitle_config.sonidos): el golpe de cada uno cae
//   en su palabra; se suman a la voz con amerge + pan + alimiter (el amix de 2018 bajaba la voz a la mitad).
// carrete-assembler v14 (24-sep-2026) — VOZ PEGADA A LA IMAGEN y RELOJ DE LOS CORTES. Medido en el proyecto 21: la voz
//   se adelantaba hasta 0,44 s y los subtitulos llegaban 1,8 s tarde en «formatos». (1) Al unir los trozos y al armar
//   el final, el sonido de cada trozo va donde empieza su imagen (aresample llena los huecos con silencio). (2) El
//   reloj de las palabras es el largo de cada CORTE: si segments_json trae el largo recortado por F1 (renders viejos),
//   se corrige con cortes_json. Todo lo atado a palabras (subtitulos, graficos, escenas, pantallas, impactos) lo usa.
// carrete-assembler v9 (19-sep-2026) — GRÁFICOS: renders.graficos (lo que marcó la IA) + subtitle_config.graficos ({cantidad, color})
//   → graficos.js (el mismo archivo de la página) elige cuáles y capa.js dibuja cada cuadro con @napi-rs/canvas; se ponen encima
//   después del color y antes de los subtítulos, nunca sobre una escena de apoyo. Van también en los pedazos.
// carrete-assembler v8 (19-sep-2026) — ESCENAS DE APOYO: renders.apoyo (lo que encontró la IA) + subtitle_config.escenas
//   ({cantidad}) → apoyo.js elige cuáles; se bajan de media-library/ y se ponen encima del video con su acercamiento lento,
//   después del movimiento y antes del color y de los subtítulos. Van también en los pedazos.
// carrete-assembler v7 (19-sep-2026) — MOVIMIENTO: subtitle_config.movimiento = {efectos, curva, intensidad, ritmo}. El director de
//   movimiento.js (el mismo archivo de la página) reparte los efectos por pedazo entre cortes y se hornea con perspective
//   antes del color y de los subtítulos. Las frases de impacto (subtitle_phrases con estilo) marcan los zooms de impacto.
// carrete-assembler v6 (18-sep-2026) — BASE ADELANTADA: si subtitle_config.base, sube la base y termina (status base).
// carrete-assembler v5 (18-sep-2026) — pasada final en PEDAZOS paralelos (pedazos.js): el ensamblador se llama a sí mismo
//   en modo «pedazo» (hasta 6), pega sin recomprimir; color en UNA tabla (revelado.js + motor-color.js).
// carrete-assembler v4 (17-sep-2026) — video sin subtítulos + exportar rápido:
//   · Tras unir los cortes sube esa base (sin subtítulos, calidad completa) a renders/<id>/sin_subtitulos.mp4 y guarda
//     video_sin_subtitulos + duraciones_reales: el editor la usa para la vista previa en vivo.
//   · Si el render ya trae video_sin_subtitulos (exportar desde el editor), no descarga ni une cortes: usa esa base.
// carrete-assembler v3 (16-sep-2026) — subtítulos en el tiempo REAL de cada corte:
//   cada segmento de F1 dura un poco más que su duración nominal (se redondea a fotogramas) y el desfase se acumula
//   (0,23 s en 38 s de prueba). Se mide la duración real de cada segmento y se corren los tiempos del .ass.
// carrete-assembler v2 (16-sep-2026) — compresión pensada para reproducir fluido:
//   H.264 High + veryfast + tope de bitrate + fotograma clave cada 2 s (saltar a una palabra es inmediato),
//   usa los 2 procesadores de la Lambda, libera disco tras concatenar y marca el video como cacheable.
//   Si la compresión nueva falla, reintenta con la de v1 (ultrafast, 1 hilo) para no perder el render.
// carrete-assembler v1 — ensambla F1 segments + F2 subtitulos ASS + F3 graficos en un solo pase FFmpeg
// Se invoca cuando f1_done, f2_done y f3_done son todos true (el ultimo en terminar lo invoca)
// Input: { render_id }
// Output: output_url en DB + status='done'
// Layer requerida: carrete-ffmpeg:1

var fs = require('fs');
var path = require('path');
var https = require('https');
var childProcess = require('child_process');
var S3Mod = require('@aws-sdk/client-s3');

var BUCKET = 'remotionlambda-useast1-editorvideo';
var REGION = process.env.AWS_REGION || 'us-east-1';
var SUPABASE_URL = process.env.SUPABASE_URL;
var SUPABASE_KEY = process.env.SUPABASE_KEY;

var s3Client = new S3Mod.S3Client({ region: REGION });

// === Find FFmpeg ===
var ffmpegPath = (function() {
  var candidates = [process.env.FFMPEG_PATH, '/opt/bin/ffmpeg', '/usr/bin/ffmpeg'];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i]) { try { fs.statSync(candidates[i]); return candidates[i]; } catch(e) {} }
  }
  return '/opt/bin/ffmpeg';
})();

// === Supabase helpers ===
function dbRequest(method, urlPath, data) {
  return new Promise(function(resolve, reject) {
    var body = data ? JSON.stringify(data) : '';
    var parsed = new URL(SUPABASE_URL + urlPath);
    var options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=representation',
        'Accept': 'application/json',
      },
    };
    var req = https.request(options, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          var result = JSON.parse(Buffer.concat(chunks).toString());
          resolve(result);
        } catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function patchRender(render_id, data) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(data);
    var parsed = new URL(SUPABASE_URL + '/rest/v1/renders?id=eq.' + render_id);
    var options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=minimal',
      },
    };
    var req = https.request(options, function(res) {
      res.resume();
      resolve({ status: res.statusCode });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* v14: el sonido de cada trozo donde empieza su imagen. Un hueco en las marcas de tiempo del audio (un trozo con
   mas imagen que sonido) se llena con silencio; sin esto el reproductor toca el sonido de corrido y se adelanta. */
var AUDIO_EN_SU_SITIO = 'aresample=async=1:min_hard_comp=0.001:first_pts=0';

/* v14: el reloj de las palabras. Las palabras y el .ass se arman sobre el largo de cada CORTE; F1 (hasta v8)
   guardaba el largo ya recortado (0,05 s por lado), y todo lo atado a palabras se atrasaba 0,1 s por corte.
   Solo se corrige si la diferencia es ese recorte, parejo en todos los trozos (si no, no se toca nada). */
function relojDeCortes(segmentsJson, segments, cortesJson) {
  if (!segmentsJson || segmentsJson.reloj === 'cortes') return null;
  var cuts = cortesJson && Array.isArray(cortesJson.cuts) ? cortesJson.cuts : (Array.isArray(cortesJson) ? cortesJson : null);
  if (!cuts || !segments.length || cuts.length !== segments.length) return null;
  var largos = [], difs = [];
  for (var i = 0; i < cuts.length; i++) {
    var c = cuts[i] || {};
    var L = Number(c.duration);
    if (!(L > 0)) L = Number(c.endTime) - Number(c.startTime);
    var nom = Number(segments[i].duration_sec);
    if (!(L > 0) || !(nom > 0)) return null;
    largos.push(L);
    if (!c.is_saac) difs.push(L - nom);
  }
  if (!difs.length) return null;
  var d0 = difs[0];
  if (!(d0 > 0.005 && d0 <= 0.105)) return null;
  for (var k = 1; k < difs.length; k++) if (Math.abs(difs[k] - d0) > 0.006) return null;
  return largos;
}

async function fetchRenderData(render_id) {
  var rows = await dbRequest('GET', '/rest/v1/renders?id=eq.' + render_id + '&select=project_id,segments_json,subtitle_ass,graphics_json,f1_done,f2_done,f3_done,video_sin_subtitulos,duraciones_reales,subtitle_config,subtitle_phrases,apoyo,graficos,cortes_json');
  return Array.isArray(rows) ? rows[0] : rows;
}

// === S3 helpers ===
function downloadFromUrl(url, localPath) {
  return new Promise(function(resolve, reject) {
    var file = fs.createWriteStream(localPath);
    var parsed = new URL(url);
    var mod = parsed.protocol === 'https:' ? https : require('http');
    mod.get(url, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFromUrl(res.headers.location, localPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', function() { file.close(); resolve(); });
      res.on('error', reject);
    }).on('error', function(err) {
      fs.unlink(localPath, function() {});
      reject(err);
    });
  });
}

async function uploadToS3(localPath, key, tipo) {
  // Use streaming instead of readFileSync to avoid loading entire file into RAM
  var stat = fs.statSync(localPath);
  var stream = fs.createReadStream(localPath);
  var cmd = new S3Mod.PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: stream,
    ContentLength: stat.size,
    ContentType: tipo || 'video/mp4',
    // Cada render tiene su propia carpeta: el archivo nunca cambia y se puede guardar en caché
    CacheControl: 'public, max-age=31536000, immutable',
  });
  return s3Client.send(cmd);
}

// v4: descargar de nuestro bucket con permisos de la Lambda (y avisar si falla, en vez de guardar un error como video)
async function descargarDelBucket(url, localPath) {
  var marca = '.amazonaws.com/';
  var i = String(url || '').indexOf(marca);
  if (i < 0) return downloadFromUrl(url, localPath);
  var key = decodeURIComponent(url.slice(i + marca.length));
  var resp = await s3Client.send(new S3Mod.GetObjectCommand({ Bucket: BUCKET, Key: key }));
  await new Promise(function (resolve, reject) {
    var out = fs.createWriteStream(localPath);
    resp.Body.pipe(out);
    resp.Body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

/* Todas las letras de S3/fonts/ (libass busca ahí la que pida el .ass). Devuelve la carpeta o null. */
async function descargarFuentes(fontDir) {
  if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
  try {
    var listResp = await s3Client.send(new S3Mod.ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'fonts/' }));
    var fontObjs = (listResp.Contents || []).filter(function(o) { return /\.(ttf|otf)$/i.test(o.Key); });
    await Promise.all(fontObjs.map(async function (o) {
      var fontResp = await s3Client.send(new S3Mod.GetObjectCommand({ Bucket: BUCKET, Key: o.Key }));
      var fontChunks = [];
      for await (var chunk of fontResp.Body) { fontChunks.push(chunk); }
      fs.writeFileSync(path.join(fontDir, o.Key.split('/').pop()), Buffer.concat(fontChunks));
    }));
    console.log('[Assembler] ' + fontObjs.length + ' letras descargadas');
    return fontDir;
  } catch (fontErr) {
    console.log('[Assembler] Font download failed (subtitles may not render): ' + fontErr.message);
    return null;
  }
}

function runFFmpeg(args) {
  return new Promise(function(resolve, reject) {
    var allArgs = ['-y'].concat(args);
    console.log('[Assembler] ffmpeg ' + allArgs.slice(0, 15).join(' ') + ' ...');
    var proc = childProcess.spawn(ffmpegPath, allArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    var stderr = '';
    proc.stderr.on('data', function(d) { stderr += d.toString(); });
    proc.on('close', function(code) {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(new Error('FFmpeg exit ' + code + ': ' + stderr.slice(-1000)));
      }
    });
    proc.on('error', reject);
    proc.stdin.end();
  });
}

// === v3: duración real de cada segmento (la misma que usa el concat de ffmpeg) ===
function duracionReal(file) {
  try {
    var probe = ffmpegPath.replace(/ffmpeg$/, 'ffprobe');
    if (probe !== ffmpegPath && fs.existsSync(probe)) {
      var r = childProcess.spawnSync(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
      var d = parseFloat(r.stdout);
      if (d > 0) return d;
    }
    var r2 = childProcess.spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
    var m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r2.stderr || '');
    return m ? (+m[1] * 3600 + +m[2] * 60 + parseFloat(m[3])) : null;
  } catch (e) { return null; }
}

/* v14b: los cuadros de video de un archivo con su tiempo, sin decodificar (framecrc con copia). */
function cuadrosDe(file) {
  var r = childProcess.spawnSync(ffmpegPath, ['-v', 'error', '-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'framecrc', '-'],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  var out = r.stdout || '';
  var tb = /#tb 0:\s*(\d+)\/(\d+)/.exec(out);
  if (!tb) return null;
  var k = Number(tb[1]) / Number(tb[2]);
  var cuadros = [];
  out.split('\n').forEach(function (l) {
    if (!l || l.charAt(0) === '#') return;
    var p = l.split(',');
    if (p.length < 4) return;
    var pts = Number(p[2]), dur = Number(p[3]);
    if (isFinite(pts)) cuadros.push({ t: pts * k, d: (isFinite(dur) ? dur : 0) * k });
  });
  return cuadros;
}

/* v14b: cuánto ocupa DE VERDAD cada trozo dentro de la base: del primer cuadro de un trozo al primero del siguiente.
   null si algo no cuadra (entonces se queda la medida anterior). */
function largosEnLaBase(base, trozos) {
  var n = trozos.map(function (f) { var c = cuadrosDe(f); return c ? c.length : 0; });
  if (!n.length || n.some(function (x) { return !(x > 0); })) return null;
  var todos = cuadrosDe(base);
  var total = n.reduce(function (a, b) { return a + b; }, 0);
  if (!todos || todos.length !== total) { console.log('[Assembler] v14b: la base tiene ' + (todos ? todos.length : 0) + ' cuadros y los trozos ' + total + '; se deja la medida anterior'); return null; }
  todos.sort(function (a, b) { return a.t - b.t; });
  var ini = [], acc = 0;
  n.forEach(function (x) { ini.push(todos[acc].t); acc += x; });
  var ult = todos[todos.length - 1], fin = ult.t + ult.d;
  var largos = ini.map(function (t, i) { return (i + 1 < ini.length ? ini[i + 1] : fin) - t; });
  return largos.every(function (d) { return d > 0; }) ? largos : null;
}

/* v15 (24-sep): los EFECTOS DE SONIDO del Guion encima de la voz. plan: [{url, t (segundo donde cae el golpe), golpe, vol}].
   v17 (24-sep): se SUMAN en una sola pista, muestra por muestra (aquí, en JS), y esa pista se suma a la voz con amerge +
   pan + alimiter como siempre. ⚠️ Antes cada efecto era una entrada de ffmpeg: pan no pasa de 64 canales (2 por entrada)
   ni amerge de 64 entradas, y con «Que Cherry los ponga» salen 30–40 efectos. Cada archivo se baja y se lee una vez. */
function escribirWavFloat(ruta, L, R, SR) {
  var n = L.length, datos = n * 8, b = Buffer.alloc(44 + datos);
  b.write('RIFF', 0); b.writeUInt32LE(36 + datos, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 8, 28); b.writeUInt16LE(8, 32); b.writeUInt16LE(32, 34);
  b.write('data', 36); b.writeUInt32LE(datos, 40);
  for (var i = 0; i < n; i++) { b.writeFloatLE(L[i], 44 + i * 8); b.writeFloatLE(R[i], 48 + i * 8); }
  fs.writeFileSync(ruta, b);
}
async function mezclarSonidos(archivo, plan, workDir) {
  if (!plan || !plan.length || !fs.existsSync(archivo)) return 0;
  var locales = {}, nb = 0;
  for (var i = 0; i < plan.length; i++) {
    var u = plan[i].url;
    if (locales[u] !== undefined) continue;
    var loc = path.join(workDir, 'sfx_' + (nb++) + '.mp3');
    try { await downloadFromUrl(u, loc); locales[u] = loc; }
    catch (e) { locales[u] = null; console.log('[Sonidos] no bajó ' + u.slice(-40) + ': ' + e.message); }
  }
  var SR = 44100, dur = duracionReal(archivo) || 0;
  if (!(dur > 0)) throw new Error('no se pudo medir el video para los efectos');
  var n = Math.ceil((dur + 0.5) * SR), L = new Float32Array(n), R = new Float32Array(n), pcm = {}, usados = 0;
  plan.forEach(function (x) {
    if (!locales[x.url]) return;
    if (pcm[x.url] === undefined) {
      var r = childProcess.spawnSync(ffmpegPath, ['-v', 'error', '-i', locales[x.url], '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'],
        { maxBuffer: 1024 * 1024 * 1024 });
      if (r.status !== 0 || !r.stdout || r.stdout.length < 8) { pcm[x.url] = null; console.log('[Sonidos] no se pudo leer ' + x.url.slice(-40)); }
      else {
        // (se copia: un Buffer de Node puede no empezar en múltiplo de 4 y Float32Array lo rechazaría)
        var m = Math.floor(r.stdout.length / 8), ab = new ArrayBuffer(m * 8);
        new Uint8Array(ab).set(r.stdout.subarray(0, m * 8));
        pcm[x.url] = new Float32Array(ab);
      }
    }
    var p = pcm[x.url];
    if (!p) return;
    var g = Math.max(0, Number(x.vol) || 0) / 100, off = Math.round((x.t - x.golpe) * SR), mm = p.length / 2;
    for (var k = 0; k < mm; k++) { var j = off + k; if (j < 0) continue; if (j >= n) break; L[j] += p[2 * k] * g; R[j] += p[2 * k + 1] * g; }
    usados++;
  });
  if (!usados) return 0;
  var cama = path.join(workDir, 'efectos_' + path.basename(archivo, '.mp4') + '.wav');
  escribirWavFloat(cama, L, R, SR);
  var tmp = archivo.replace(/\.mp4$/, '_son.mp4');
  await runFFmpeg(['-i', archivo, '-i', cama, '-filter_complex',
    '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[v];' +
    '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[s];' +
    '[v][s]amerge=inputs=2,pan=stereo|c0=c0+c2|c1=c1+c3,alimiter=limit=0.95:level=0[a]',   // ⚠️ level=0: sin el nivelado automático
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, archivo);
  try { fs.unlinkSync(cama); } catch (e) {}
  Object.keys(locales).forEach(function (k2) { if (locales[k2]) { try { fs.unlinkSync(locales[k2]); } catch (e) {} } });
  return usados;
}

// Corre los tiempos de cada Dialogue del .ass: lo que F2 ubicó en el corte k se desplaza lo que ese corte se corrió en realidad
function tiemposRealesASS(ass, nominales, reales) {
  var inicios = [], desp = [], an = 0, ar = 0;
  for (var i = 0; i < nominales.length; i++) { inicios.push(an); desp.push(ar - an); an += nominales[i]; ar += reales[i]; }
  function leer(s) { var p = s.split(':'); return +p[0] * 3600 + +p[1] * 60 + parseFloat(p[2]); }
  function escribir(seg) {
    var cs = Math.max(0, Math.round(seg * 100));
    var h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
  }
  function mover(seg) {
    var k = 0;
    while (k + 1 < inicios.length && seg >= inicios[k + 1] - 0.0005) k++;
    return seg + desp[k];
  }
  return ass.replace(/^(Dialogue:\s*\d+,)(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),/gm, function (m, pre, a, b) {
    return pre + escribir(mover(leer(a))) + ',' + escribir(mover(leer(b))) + ',';
  });
}

/* (24-sep) «Tu arriba, pantalla abajo»: mientras dura esa pantalla la grabacion ocupa la mitad de abajo, y los
   subtitulos (a ~52 % del alto) le caian encima. Cada FRASE (las lineas que se van a la vez: mismo final) se
   lleva a tu recuadro y se encoge lo justo para caber entre tu boca (26 % del alto) y el borde del recuadro
   (41,5 %), nunca mas del 72 %. Es una transformacion de la frase entera —posiciones, tamanos, separacion
   entre lineas, recortes—: se ve igual, solo mas pequena y mas arriba. Si ya estaba arriba, no se toca. */
/* (24-sep) `abajo`: «pantalla arriba, tú abajo». Tu pelo empieza ~58 % del alto y la ventana termina en el 50 %:
   cada frase baja a esa franja (51,5 %–57,5 %), anclada por ARRIBA, y se encoge lo justo para caber. */
function subirSubtitulos(ass, ventanas, abajo) {
  if (!ass || !ventanas || !ventanas.length) return { ass: ass, movidas: 0 };
  var PRX = Number((/PlayResX:\s*(\d+)/.exec(ass) || [])[1]) || 1080;
  var PRY = Number((/PlayResY:\s*(\d+)/.exec(ass) || [])[1]) || 1920;
  var FS0 = Number((/^Style:\s*Default,[^,]*,([\d.]+)/m.exec(ass) || [])[1]) || 60;
  // (24-sep) forma `mitad`: tu video llena la mitad de arriba (corrido 17 % hacia arriba): tu barbilla queda ~30 %
  var CX = PRX / 2, PIE = 0.475 * PRY, CABE = (0.475 - 0.30) * PRY, KMAX = 0.72;
  var TOPE = 0.515 * PRY;
  if (abajo) CABE = (0.575 - 0.515) * PRY;      // tu pelo empieza ~58 % (el video va corrido 24 %)
  var leer = function (s) { var p = s.split(':'); return +p[0] * 3600 + +p[1] * 60 + parseFloat(p[2]); };
  var lineas = ass.split('\n'), movidas = 0;
  function transformar(l, K, ref) {
    var X = function (x) { return (CX + (Number(x) - CX) * K).toFixed(1); };
    // arriba: el pie de la frase va al PIE del recuadro · abajo: su borde de arriba va al TOPE de la franja
    var Y = abajo ? function (y) { return (TOPE + (Number(y) - ref) * K).toFixed(1); }
                  : function (y) { return (PIE - (ref - Number(y)) * K).toFixed(1); };
    var T = function (v) { return (Number(v) * K).toFixed(2); };
    return l
      .replace(/\\pos\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/g, function (m, x, y) { return '\\pos(' + X(x) + ',' + Y(y) + ')'; })
      .replace(/\\move\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/g, function (m, x1, y1, x2, y2) {
        return '\\move(' + X(x1) + ',' + Y(y1) + ',' + X(x2) + ',' + Y(y2); })
      .replace(/\\(i?clip)\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/g, function (m, k, x1, y1, x2, y2) {
        return '\\' + k + '(' + X(x1) + ',' + Y(y1) + ',' + X(x2) + ',' + Y(y2) + ')'; })
      .replace(/\\(fs|fsp|bord|shad|blur)(-?[\d.]+)/g, function (m, k, v) { return '\\' + k + T(v); });
  }
  ventanas.forEach(function (v) {
    var frases = {};
    lineas.forEach(function (l, i) {
      var m = /^Dialogue:\s*\d+,(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),/.exec(l);
      if (!m) return;
      var t = leer(m[1]);
      if (t < v.t0 + 0.15 || t >= v.t1 - 0.15) return;
      var mm = /\\move\(\s*[-\d.]+\s*,\s*([-\d.]+)/.exec(l) || /\\pos\(\s*[-\d.]+\s*,\s*([-\d.]+)/.exec(l);
      if (!mm) return;
      var y = Number(mm[1]);
      var fs = Number((/\\fs([\d.]+)/.exec(l) || [])[1]) || FS0;
      var an = Number((/\\an(\d)/.exec(l) || [])[1]) || 8;
      var arriba = an >= 7 ? y : an >= 4 ? y - fs / 2 : y - fs;        // \an7-9 arriba · 4-6 al medio · 1-3 abajo
      var f = frases[m[2]] || (frases[m[2]] = { top: Infinity, pie: -Infinity, idx: [] });
      f.top = Math.min(f.top, arriba); f.pie = Math.max(f.pie, arriba + fs); f.idx.push({ i: i, y: y });
    });
    Object.keys(frases).forEach(function (k) {
      var f = frases[k];
      if (!abajo && f.pie <= PIE + 10) return;                          // ya cabe arriba
      if (abajo && f.top >= TOPE - 10 && f.pie <= TOPE + CABE + 10) return;   // ya está en la franja
      var K = Math.min(KMAX, CABE / Math.max(1, f.pie - f.top));
      f.idx.forEach(function (x) { lineas[x.i] = transformar(lineas[x.i], K, abajo ? f.top : f.pie); });
      movidas += f.idx.length;
    });
  });
  return { ass: lineas.join('\n'), movidas: movidas };
}

// === Build FFmpeg filter_complex for overlays + subtitles ===
// graphicsPath: filesystem path to F3 MP4 (used with movie filter — no split buffering)
// scenes: [{timestamp_ms, duration_ms}]
// assPath: path to ASS file (may be null)
// Using movie= filter instead of split=N avoids holding N decoded streams in RAM simultaneously.
var REVELADO = require('./revelado.js');
var SIL = require('./silueta.js');       // (27-sep) silueta de todo el video para el color con máscara
var MOV = require('./movimiento.js');
var APOYO = require('./apoyo.js');
var GRAF = require('./graficos.js');
var CAPA = require('./capa.js');
var PEDAZOS = require('./pedazos.js');
var PREMIUM = require('./premium.js');
var VOZ = require('./voz.js');         // v16: la voz de estudio
var EDICION = require('./edicion.js'); // v19: la capa de edición
var LIMPIEZA = require('./limpieza.js'); // (6-oct) borrar lo viejo del depósito (modo 'limpieza')
var R2 = require('./r2.js');             // (6-oct) el video terminado en Cloudflare R2 (APAGADO hasta que entren clientes)

/* v5 (18-sep): la pasada final en pedazos paralelos — el ensamblador se llama a sí mismo */
var LambdaMod = null;
try { LambdaMod = require('@aws-sdk/client-lambda'); } catch (e) { console.log('[Pedazos] sin cliente de Lambda: ' + e.message); }
var lambdaClient = LambdaMod ? new LambdaMod.LambdaClient({ region: REGION }) : null;

/* (20-sep) Invocar OTRA Lambda y esperar su respuesta. Lo usa el recorte: carrete-recorte devuelve
   la silueta de la persona para poder meter gráficos por detrás. */
function invocarLambda(nombre, ev, ms) {
  var reloj;
  var llamada = lambdaClient.send(new LambdaMod.InvokeCommand({
    FunctionName: nombre, InvocationType: 'RequestResponse', Payload: Buffer.from(JSON.stringify(ev)),
  })).then(function (r) {
    var txt = r.Payload ? Buffer.from(r.Payload).toString() : '';
    if (r.FunctionError) throw new Error(r.FunctionError + ': ' + txt.slice(0, 300));
    return JSON.parse(txt || '{}');
  });
  var tope = new Promise(function (_, rej) { reloj = setTimeout(function () { rej(new Error('más de ' + (ms / 1000) + ' s')); }, ms || 600000); });
  return Promise.race([llamada, tope]).finally(function () { clearTimeout(reloj); });
}

/* (2-oct-2026) TU RECORTE EN ALTA para lo que va DETRÁS de ti y para «te sales / tú delante». A 608x1080 el pelo
   rizado salía en bloque; a 1080x1920 sale rizo por rizo (Día 2, el gancho de la alarma). Pero a esa resolución un
   tramo largo no cabe en el disco de la Lambda del recorte (2 GB): se pide en pedacitos de RECORTE_HD_TRAMO s, en
   paralelo y con 1 s de calentar (menos el primero), y aquí se juntan en UN video alineado por tiempo (lienzo negro +
   cada pedacito encima en su segundo), que se sube a `salida`. Si un pedacito falla, se pide el tramo entero a 608
   como antes. Devuelve el mismo { ok } que carrete-recorte. */
var RECORTE_HD_TRAMO = 5, RECORTE_HD_W = 1080, RECORTE_HD_H = 1920;
async function recorteEnAlta(clave, d0, d1, salida, dir, nombre) {
  var n = Math.max(1, Math.ceil((d1 - d0) / RECORTE_HD_TRAMO - 0.001));
  var base = salida.replace(/\.mp4$/i, '');
  try {
    var partes = await Promise.all(Array.from({ length: n }, function (_, i) {
      var a = d0 + i * RECORTE_HD_TRAMO, b = Math.min(d1, a + RECORTE_HD_TRAMO), k = base + '_hd' + i + '.mp4';
      return invocarLambda('carrete-recorte', { bucket: BUCKET, key: clave, desde: a, hasta: b, fps: 30, salida: k,
        ancho: RECORTE_HD_W, alto: RECORTE_HD_H, calentar: a > 0 ? 1 : 0 }, 420000).then(async function (r) {
        if (!r || !r.ok) throw new Error('pedacito ' + i + ': ' + JSON.stringify(r).slice(0, 140));
        var loc = path.join(dir, nombre + '_hd' + i + '.mp4');
        await descargarDelBucket(urlDelBucket(k), loc);
        return { a: a - d0, k: k, local: loc };
      });
    }));
    var junto = path.join(dir, nombre + '_hd.mp4');
    var args = ['-hide_banner', '-loglevel', 'error'];
    partes.forEach(function (t) { args.push('-itsoffset', t.a.toFixed(3), '-i', t.local); });
    var f = ['color=c=black:s=' + RECORTE_HD_W + 'x' + RECORTE_HD_H + ':r=30:d=' + (d1 - d0 + 0.1).toFixed(3) + ',format=gray[l0]'];
    partes.forEach(function (t, i) {
      f.push('[' + i + ':v]scale=' + RECORTE_HD_W + ':' + RECORTE_HD_H + ',format=gray,setsar=1,fps=fps=30[s' + i + ']');
      f.push('[l' + i + '][s' + i + ']overlay=0:0:eof_action=pass,format=gray[l' + (i + 1) + ']');
    });
    await runFFmpeg(args.concat(['-filter_complex', f.join(';'), '-map', '[l' + partes.length + ']', '-c:v', 'libx264', '-crf', '16',
      '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', '-an', junto]));
    await uploadToS3(junto, salida);
    partes.forEach(function (t) {
      s3Client.send(new S3Mod.DeleteObjectCommand({ Bucket: BUCKET, Key: t.k })).catch(function () {});
      try { fs.unlinkSync(t.local); } catch (e) {}
    });
    return { ok: true, alta: true };
  } catch (e) {
    console.log('[Recorte] en alta no salió (' + String(e && e.message).slice(0, 160) + '), va a 608');
    return invocarLambda('carrete-recorte', { bucket: BUCKET, key: clave, desde: d0, hasta: d1, fps: 30, salida: salida }, 420000);
  }
}

function invocarPedazo(ev, ms) {
  var reloj;
  var llamada = lambdaClient.send(new LambdaMod.InvokeCommand({
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'carrete-assembler',
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify(ev)),
  })).then(function (r) {
    var txt = r.Payload ? Buffer.from(r.Payload).toString() : '';
    if (r.FunctionError) throw new Error(r.FunctionError + ': ' + txt.slice(0, 300));
    var res = JSON.parse(txt || '{}');
    if (!res.ok) throw new Error('respuesta sin ok: ' + txt.slice(0, 200));
    return res;
  });
  // tope de espera; el reloj se apaga siempre (un rechazo suelto tumbaría la siguiente llamada)
  var tope = new Promise(function (_, rej) { reloj = setTimeout(function () { rej(new Error('más de ' + ms / 1000 + ' s')); }, ms); });
  return Promise.race([llamada, tope]).finally(function () { clearTimeout(reloj); });
}

// Compresión para reproducir fluido (v2). La usan la pasada única y cada pedazo: TIENEN que ser iguales
// para que los pedazos se peguen sin recomprimir.
var COMPRESION_FLUIDA = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-profile:v', 'high',
  '-crf', '23',
  '-maxrate', '5M', '-bufsize', '10M',   // tope: nunca más de ~5 Mbps sostenidos
  '-g', '60',                            // fotograma clave cada 2 s a 30 fps
  '-pix_fmt', 'yuv420p',
  '-threads', '0',                       // usa los 2 procesadores
];

/* v10 (24-sep): la compresión del MASTER — la de entrega, no la de la vista. crf 18 y un tope de bitrate
   proporcional a los píxeles·cuadros (1080p30 → 5 Mbps como siempre; 4K60 → 40 Mbps). El cuadro clave cada
   2 s a los cuadros que sean. */
function compresionPara(info, esMaster) {
  if (!esMaster) return COMPRESION_FLUIDA;
  var f = Math.max(1, (info.w * info.h * (info.fps || 30)) / (1080 * 1920 * 30));
  var tope = Math.min(80, Math.round(5 * f));
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-crf', '18',
          '-maxrate', tope + 'M', '-bufsize', (2 * tope) + 'M', '-g', String(Math.round(2 * (info.fps || 30))), '-pix_fmt', 'yuv420p', '-threads', '0'];
}
/* La versión para Instagram: 1080 de ancho a los cuadros originales, crf 18, tope 20 Mbps (acepta hasta 25). */
function compresionIG(info) {
  /* Instagram acepta 300 MB: el tope de bitrate se baja si el video es largo (280 MB de margen). */
  var dur = Math.max(1, info.dur || 60);
  var tope = Math.max(4, Math.min(20, Math.floor(280 * 8 / dur)));
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-crf', '18',
          '-maxrate', tope + 'M', '-bufsize', (2 * tope) + 'M', '-g', String(Math.round(2 * (info.fps || 30))), '-pix_fmt', 'yuv420p', '-threads', '0'];
}

function urlDelBucket(key) { return 'https://' + BUCKET + '.s3.' + REGION + '.amazonaws.com/' + key; }

/* (27-sep) la silueta de todo el video para el color con máscara */
SIL.configurar({
  bucket: BUCKET,
  invocar: function (n, ev, ms) { return invocarLambda(n, ev, ms); },
  runFFmpeg: function (a) { return runFFmpeg(a); },
  subir: function (local, key) { return uploadToS3(local, key); },
  bajar: function (key, local) { return descargarDelBucket(urlDelBucket(key), local); },
  borrar: function (key) { return s3Client.send(new S3Mod.DeleteObjectCommand({ Bucket: BUCKET, Key: key })); },
  existe: function (key) { return s3Client.send(new S3Mod.HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(function () { return true; }, function () { return false; }); },
});
/* (7-oct) LA VOZ DE ESTUDIO PARA LA VISTA PREVIA. Sergio: «TODO DEBE VERSE EN LA VISTA PREVIA AL INSTANTE». Con la voz de
   estudio prendida, la página pide (orchestrate › preparar_voz) que se prepare la de la base que se está viendo: el mismo
   Auphonic del video final, sobre el sonido de esa base. Se publica una copia liviana (AAC) junto a la base y la fila guarda
   voz_estudio = { estado, vista, retardo, efectos_db }. La página la suena encima del video, en vez del sonido original. */
async function vozVista(ev) {
  var id = String(ev.render_id || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: 'falta render_id' };
  var dir = '/tmp/vozvista_' + Date.now();
  fs.mkdirSync(dir, { recursive: true });
  try {
    var filas = await dbRequest('GET', '/rest/v1/renders?id=eq.' + id + '&select=id,video_sin_subtitulos,subtitle_config,duraciones_reales');
    var fila = Array.isArray(filas) ? filas[0] : null;
    if (!fila) throw new Error('no existe');
    var cfgV = fila.subtitle_config || {};
    var url = cfgV.calidad === 'original' ? cfgV.vista_base : fila.video_sin_subtitulos;
    if (!url) throw new Error('sin base');
    var base = path.join(dir, 'base.mp4');
    await descargarDelBucket(url, base);
    /* (8-oct) una base de tomas hechas a mano: su voz sale de la de la base de donde vienen (ya procesada), sin Auphonic */
    var mano = cfgV.mano;
    if (mano && /^[0-9a-f-]{36}$/.test(String(mano.de || '')) && Array.isArray(mano.tramos) && Array.isArray(fila.duraciones_reales)) {
      try {
        var fs0 = await dbRequest('GET', '/rest/v1/renders?id=eq.' + mano.de + '&select=voz_estudio');
        var v0 = Array.isArray(fs0) && fs0[0] ? fs0[0].voz_estudio : null;
        if (v0 && v0.estado === 'lista' && v0.huella) await VOZ.desdeOtra(base, dir, v0.huella, mano.tramos, fila.duraciones_reales);
      } catch (eM) { console.log('[Voz vista] la de las tomas no salió de la otra base: ' + String(eM && eM.message || eM).slice(0, 200)); }
    }
    var r = await VOZ.preparar(base, dir, id);
    if (r.estado !== 'lista') {
      await patchRender(id, { voz_estudio: { estado: r.estado, detalle: r.detalle || null, huella: r.huella || null, vista: null } });
      return { ok: false, estado: r.estado };
    }
    var m4a = path.join(dir, 'voz_vista.m4a');
    await runFFmpeg(['-i', r.archivo, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', m4a]);
    var key = 'renders/' + id + '/voz_' + String(r.huella || 'x').slice(0, 8) + '.m4a';
    await uploadToS3(m4a, key, 'audio/mp4');
    await patchRender(id, { voz_estudio: { estado: 'lista', vista: urlDelBucket(key), retardo: r.retardo || 0, efectos_db: r.efectosDb || 0,
      huella: r.huella || null, reutilizada: !!r.reutilizada } });
    console.log('[Voz vista] ' + id.slice(0, 8) + ' lista' + (r.reutilizada ? ' (reutilizada)' : ''));
    return { ok: true };
  } catch (e) {
    console.log('[Voz vista] falló: ' + String(e && e.message || e).slice(0, 300));
    try { await patchRender(id, { voz_estudio: { estado: 'error', detalle: String(e && e.message || e).slice(0, 200), vista: null } }); } catch (e2) {}
    return { ok: false, error: String(e && e.message || e).slice(0, 300) };
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
}

/* (7-oct) Sergio: «si ya está procesada, ¿para qué procesar de nuevo?». Un MASTER no manda su propia voz a Auphonic: toma
   la de su base liviana (la misma que oye la vista previa: misma huella → voz/estudio/<huella>) y la acomoda corte por
   corte a sus duraciones reales (voz.js › acomodar). Si la vista previa todavía no la pidió, se procesa aquí esa misma (y
   la vista previa la encuentra hecha); si la está procesando, se espera esa (voz.js no paga dos veces la misma huella).
   UNA sola pasada de Auphonic por video. Devuelve null si no se pudo armar (entonces se hace como antes). */
async function vozDesdeVista(cfgV, dursM, workDir, renderId) {
  if (!cfgV || !cfgV.vista_base || !Array.isArray(cfgV.vista_duraciones) || !Array.isArray(dursM) || cfgV.vista_duraciones.length !== dursM.length) return null;
  var dir = path.join(workDir, 'voz_vista');
  fs.mkdirSync(dir, { recursive: true });
  var vista = path.join(dir, 'vista.mp4');
  await descargarDelBucket(cfgV.vista_base, vista);
  var r = await VOZ.preparar(vista, dir, renderId);
  try { fs.unlinkSync(vista); } catch (e) {}
  if (r.estado !== 'lista') return r;                // cortinilla, error o tarde: como antes, sale con la voz normal
  var t0 = Date.now();
  var archivo = await VOZ.acomodar(r.archivo, r.retardo, cfgV.vista_duraciones, dursM, dir);
  console.log('[Voz] la del master sale de la de la vista previa (' + dursM.length + ' cortes, ' + Math.round((Date.now() - t0) / 1000) + ' s)' +
    (r.reutilizada ? ' · ya estaba procesada' : ' · procesada ahora, la vista previa la reusa'));
  return { estado: 'lista', archivo: archivo, retardo: 0, efectosDb: r.efectosDb, huella: r.huella, reutilizada: !!r.reutilizada, desdeVista: true };
}

async function siluetaSola(ev) {
  var clave = String(ev.key || '').split('?')[0];
  if (!clave) return { ok: false, error: 'falta key' };
  var dir = '/tmp/silueta_' + Date.now();
  fs.mkdirSync(dir, { recursive: true });
  try {
    if (await SIL.configurado().existe(SIL.claveDe(clave))) return { ok: true, key: SIL.claveDe(clave), reusada: true };
    var local = path.join(dir, 'video.mp4');
    await descargarDelBucket(urlDelBucket(clave), local);
    var info = PEDAZOS.infoVideo(local);
    var r = await SIL.asegurar(clave, info.dur, dir);
    return { ok: true, key: r.key };
  } catch (e) {
    console.log('[Silueta] falló: ' + String(e && e.message || e).slice(0, 300));
    return { ok: false, error: String(e && e.message || e).slice(0, 300) };
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
}

PEDAZOS.configurar({
  ffmpegPath: ffmpegPath,
  runFFmpeg: function (a) { return runFFmpeg(a); },
  filtroColor: function (c, e, s) { return filtroColor(c, e, s); },
  filtroTabla: function (cube, e, s) { return filtroTabla(cube, e, s); },       // (fase 2)
  filtroVineta: function (c, e, s) { return filtroVineta(c, e, s); },
  filtroBN: function (piezas, e, s) { return GRAF.filtroBN ? GRAF.filtroBN(piezas, e, s) : null; },   // (2-oct) blanco y negro por tramo
  filtroNoche: function (piezas, e, s) { return GRAF.filtroNoche ? GRAF.filtroNoche(piezas, e, s) : null; },   // (2-oct) noche y amanecer
  filtroMov: function (m, o) { return m ? MOV.ffmpeg(m.plan, m.cfg, o) : null; },
  filtroApoyo: function (ins, e, fps, W, H, lut) { return filtroApoyo(ins, e, fps, W, H, lut); },
  rutaFiltro: rutaFiltro,
  silueta: SIL,
  capa: CAPA,
  premium: PREMIUM,
  compresion: COMPRESION_FLUIDA,
  compresionPara: compresionPara,
  compresionIG: compresionIG,
  escribirColor: REVELADO.escribirColor,
  descargarFuentes: function (d) { return descargarFuentes(d); },
  subirS3: function (local, key) { return uploadToS3(local, key); },
  bajarS3: function (key, local) { return descargarDelBucket(urlDelBucket(key), local); },
  bajarURL: function (url, local) { return descargarDelBucket(url, local); },
  borrarS3: function (key) { return s3Client.send(new S3Mod.DeleteObjectCommand({ Bucket: BUCKET, Key: key })); },
  invocar: lambdaClient ? invocarPedazo : null,
});

// v16: la voz de estudio
VOZ.configurar({ ffmpegPath: ffmpegPath, runFFmpeg: function (a) { return runFFmpeg(a); }, duracionReal: duracionReal,
  s3Client: s3Client, S3Mod: S3Mod, BUCKET: BUCKET, REGION: REGION, SUPABASE_URL: SUPABASE_URL, SUPABASE_KEY: SUPABASE_KEY });

function rutaFiltro(ruta) { return ruta.replace(/\\/g, '/').replace(/:/g, '\\:'); }

/* Color de Cherry (18-sep-2026): revelado + look + intensidad en UNA tabla que se
   hornea en cada render (revelado.js › prepararColor, cuentas en motor-color.js).
   La viñeta va aparte porque un LUT no sabe de posiciones.
   Formatos explícitos: tabla y viñeta trabajan las dos en RGB (rgb24) y se vuelve a
   yuv420p UNA vez. La viñeta tiene que ir en RGB: en YUV multiplica también el piso
   del negro y las esquinas salen más oscuras que en la vista del navegador (medido:
   48 → 38 de brillo en la esquina). Va ANTES de los subtítulos (letras sin teñir). */
function filtroColor(color, entrada, salida) {
  if (!color || !color.cube) return null;
  return entrada + "format=rgb48le,lut3d=file='" + rutaFiltro(color.cube) + "'" +
    (color.vineta ? ',format=rgb24,' + color.vineta : '') + ',format=yuv420p' + salida;
}
/* (28-sep, FASE 2 DEL COLOR) La base del master llega en 10 bits (F1 corta en H.264 High 10). La tabla va en RGB de 16
   bits y sale a yuv420p (8 bits) UNA vez, con el tramado de la conversión: sin manchas ni escalones en los degradados.
   Va PRIMERO, sobre la base tal cual (como el color con máscara): lo que viene después (movimiento, escenas, gráficos,
   subtítulos) ya no toca la precisión del color. Las escenas de apoyo llevan la misma tabla (filtroApoyo). */
function filtroTabla(cube, entrada, salida) {
  return entrada + "format=rgb48le,lut3d=file='" + rutaFiltro(cube) + "',format=yuv420p" + salida;
}
/* La viñeta, aparte y después del movimiento (un LUT no sabe de posiciones). (fase 2) Con tramado (el de vignette, por
   omisión): con dither=0 el oscurecimiento en 8 bits dejaba anillos en las zonas oscuras y lisas. */
function filtroVineta(color, entrada, salida) {
  if (!color || !color.vineta) return null;
  return entrada + 'format=rgb24,' + color.vineta + ',format=yuv420p' + salida;
}

/* v8: ESCENAS DE APOYO encima del video. insertos: [{t0,t1,ss,rotar,local}] (local = archivo ya bajado).
   Cada una: se corta del clip, se endereza si viene de lado, se llena la pantalla (recorte al centro), acercamiento lento
   de 1 a 1,06 y se corre a su instante del video completo. Se pone con overlay solo entre t0 y t1. */
function filtroApoyo(insertos, entrada, fps, W, H, lutFondo) {
  var filtros = [], actual = entrada;
  (insertos || []).forEach(function (a, i) {
    if (!a.local) return;
    var L = Math.max(0.2, a.t1 - a.t0);
    var giro = a.rotar === 90 ? 'transpose=1,' : a.rotar === -90 ? 'transpose=2,' : '';
    var s = '(1+0.06*(in-1)/' + (L * fps).toFixed(3) + ')';
    var zoom = "perspective=x0='W/2*(1-1/" + s + ")':y0='H/2*(1-1/" + s + ")':x1='W/2*(1+1/" + s + ")':y1='H/2*(1-1/" + s + ")'" +
      ":x2='W/2*(1-1/" + s + ")':y2='H/2*(1+1/" + s + ")':x3='W/2*(1+1/" + s + ")':y3='H/2*(1+1/" + s + ")':sense=source:eval=frame";
    filtros.push("movie='" + rutaFiltro(a.local) + "':seek_point=" + Math.max(0, a.ss - 1).toFixed(3) +
      ',trim=start=' + a.ss.toFixed(3) + ':duration=' + L.toFixed(3) + ',setpts=PTS-STARTPTS,' + giro +
      'scale=' + W + ':' + H + ':force_original_aspect_ratio=increase,crop=' + W + ':' + H + ',setsar=1,fps=fps=' + fps + ',' +
      (lutFondo ? "format=rgb48le,lut3d=file='" + rutaFiltro(lutFondo) + "'," : '') + 'format=yuv420p,' +
      zoom + ',setpts=PTS+' + a.t0.toFixed(4) + '/TB[ap' + i + ']');
    filtros.push(actual + '[ap' + i + "]overlay=eof_action=pass:enable='between(t," + a.t0.toFixed(4) + ',' + (a.t1 - 0.001).toFixed(4) + ")'[vap" + i + ']');
    actual = '[vap' + i + ']';
  });
  return { filtros: filtros, salida: actual };
}

/* (29-sep) El estilo clásico (canvas) no sabe dibujar la persiana: si hay que caer a él, las tarjetas no salen */
function sinTarjetas(graf) {
  if (!graf || !Array.isArray(graf.piezas)) return;
  var antes = graf.piezas.length;
  graf.piezas = graf.piezas.filter(function (p) { return !/^pe_/.test(String(p.tipo || '')); });
  if (graf.piezas.length < antes) console.log('[Premium] ' + (antes - graf.piezas.length) + ' piezas de la persiana no salen: solo las dibuja Remotion');
}

function buildFilterGraph(scenes, assPath, graphicsPath, fontsDir, color, movimiento, fps, apoyo, graf) {
  var sorted = (scenes || []).slice().sort(function(a, b) { return a.timestamp_ms - b.timestamp_ms; });
  var N = sorted.length;
  var filters = [];
  var currentVideo = '[0:v]';

  /* (27-sep) COLOR CON MÁSCARA (look Selectivo): va PRIMERO, sobre el video tal cual, porque la silueta se sacó de
     él (con el zoom del movimiento ya no calzaría). Fondo con una tabla, persona con otra. La viñeta se queda abajo,
     en el sitio de siempre, y las escenas de apoyo llevan la tabla del fondo. */
  var conMascara = !!(color && color.cubePersona && color.silueta && color.silIndice != null);
  if (conMascara) {
    var Fm = fps || 30;
    filters.push(currentVideo + 'setpts=PTS-STARTPTS,fps=fps=' + Fm + '[vgm]');
    filters = filters.concat(SIL.filtrosMascara(color.silIndice, color.W, color.H, Fm, color.cuadros, 0, 'U'));
    filters = filters.concat(SIL.filtrosColor('[vgm]', color.cube, color.cubePersona, rutaFiltro, 'U', '[vcm]'));
    currentVideo = '[vcm]';
  }
  // (fase 2) sin máscara, la tabla también va primero, sobre la base tal cual (en 16 bits)
  var tablaPrimero = !conMascara && !!(color && color.cube);
  if (tablaPrimero) {
    filters.push(filtroTabla(color.cube, currentVideo, '[vtab]'));
    currentVideo = '[vtab]';
  }

  // v7: movimiento primero (en la rejilla de cuadros fija, igual que los pedazos: el tiempo de cada cuadro sale de su número)
  var fMov = movimiento ? MOV.ffmpeg(movimiento.plan, movimiento.cfg, { fps: fps || 30, c0: 0 }) : null;
  if (fMov) {
    filters.push(currentVideo + 'setpts=PTS-STARTPTS,fps=fps=' + (fps || 30) + ',' + fMov + '[vmov]');
    currentVideo = '[vmov]';
  }
  // v8: escenas de apoyo encima (antes del color: llevan el mismo look; los subtítulos quedan encima)
  var hayApoyo = !!(apoyo && apoyo.insertos && apoyo.insertos.length), hayGraf = !!(graf && graf.capas && graf.capas.length);
  // v9: sin movimiento, la rejilla fija igual (el tiempo de cada cuadro sale de su número, también para los gráficos)
  if (!fMov && (hayApoyo || hayGraf)) { filters.push(currentVideo + 'setpts=PTS-STARTPTS,fps=fps=' + (fps || 30) + '[vgrid]'); currentVideo = '[vgrid]'; }
  if (hayApoyo) {
    var fa = filtroApoyo(apoyo.insertos, currentVideo, fps || 30, apoyo.W, apoyo.H, (conMascara || tablaPrimero) ? color.cube : null);
    filters = filters.concat(fa.filtros); currentVideo = fa.salida;
  }

  if (N > 0 && graphicsPath) {
    var safeGfx = graphicsPath.replace(/\\/g, '/');
    for (var i = 0; i < N; i++) {
      // Use scene.index to locate the correct 7s segment in graphics.mp4.
      // (scenes are sorted by timestamp in the base video, but their order in the
      //  graphics.mp4 is given by the 'index' field — not the sorted loop position.)
      var sceneIndex = (sorted[i].index !== undefined) ? sorted[i].index : i;
      var trimStart = sceneIndex * 7;
      var tSec = sorted[i].timestamp_ms / 1000;
      var dSec = (sorted[i].duration_ms || 7000) / 1000;
      var trimmedLabel = '[tg' + i + ']';
      var overlaidLabel = '[ov' + i + ']';
      // movie= + trim extracts the right 7s segment; setpts offsets PTS to match
      // the enable window so the overlay frame at time T in the output is the
      // correct animation frame (not a frozen last-frame).
      filters.push("movie='" + safeGfx + "',trim=start=" + trimStart + ':duration=' + dSec + ',setpts=PTS-STARTPTS+' + tSec.toFixed(3) + '/TB' + trimmedLabel);
      filters.push(currentVideo + trimmedLabel + "overlay=x=(W-w)/2:y=(H-h)/2:enable='between(t," + tSec.toFixed(3) + ',' + (tSec + dSec).toFixed(3) + ")'" + overlaidLabel);
      currentVideo = overlaidLabel;
    }
  }

  // Color (revelado + look en una tabla) antes de los subtítulos
  var fColor = (conMascara || tablaPrimero)
    ? filtroVineta(color, currentVideo, '[vcolor]')          // (fase 2) la tabla ya fue arriba: aquí solo la viñeta
    : filtroColor(color, currentVideo, '[vcolor]');
  if (fColor) {
    filters.push(fColor);
    currentVideo = '[vcolor]';
  }
  // (2-oct) «blanco y negro + tu color»: el video en blanco y negro en los tramos de esas piezas (antes de los gráficos)
  var fBN = hayGraf && GRAF.filtroBN ? GRAF.filtroBN(graf.piezas || [], currentVideo, '[vbn]') : null;
  if (fBN) { filters.push(fBN); currentVideo = '[vbn]'; }
  var fNQ = hayGraf && GRAF.filtroNoche ? GRAF.filtroNoche(graf.piezas || [], currentVideo, '[vnq]') : null;
  if (fNQ) { filters.push(fNQ); currentVideo = '[vnq]'; }

  // v9: GRÁFICOS después del color (los colores de la marca no se tiñen) y antes de los subtítulos (quedan encima)
  /* (29-sep) la persiana (forma «tarjeta») tapa el cuadro entero: va DESPUÉS de los subtítulos */
  var capasT = hayGraf ? graf.capas.filter(function (c) { return c.p && c.p.forma === 'tarjeta'; }) : [];
  var capasN = hayGraf ? graf.capas.filter(function (c) { return !(c.p && c.p.forma === 'tarjeta'); }) : [];
  if (capasN.length) {
    var fg = CAPA.filtros(capasN, currentVideo, graf.W, graf.H, fps || 30, 0, 'U');
    filters = filters.concat(fg.filtros); currentVideo = fg.salida;
  }

  // Burn ASS subtitles if available — use fontsdir so libass finds Montserrat-Bold.ttf
  if (assPath) {
    var safeAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    var finalLabel = '[vfinal]';
    var assFilter = "ass='" + safeAssPath + "'";
    if (fontsDir) {
      var safeFontsDir = fontsDir.replace(/\\/g, '/').replace(/:/g, '\\:');
      assFilter += ":fontsdir='" + safeFontsDir + "'";
    }
    filters.push(currentVideo + assFilter + finalLabel);
    currentVideo = finalLabel;
  }
  if (capasT.length) {
    var ft = CAPA.filtros(capasT, currentVideo, graf.W, graf.H, fps || 30, 0, 'UT');
    filters = filters.concat(ft.filtros); currentVideo = ft.salida;
  }

  return { filterStr: filters.join(';'), outVideo: currentVideo };
}

// === Main handler ===
exports.handler = async function(event) {
  // v5: una copia de este mismo ensamblador que solo hace UN pedazo de la pasada final
  if (event && event.modo === 'pedazo') return await PEDAZOS.trabajar(event);
  // (27-sep) solo la silueta de un video (la vista previa del look Selectivo la necesita antes de generar)
  if (event && event.modo === 'silueta') return await siluetaSola(event);
  // (7-oct) la voz de estudio de una base, para oírla en la vista previa
  if (event && event.modo === 'voz') return await vozVista(event);
  // (6-oct) la limpieza diaria del depósito (la dispara la función `limpieza` desde pg_cron; con 'ensayo' no borra nada)
  if (event && event.modo === 'limpieza') {
    return await LIMPIEZA.correr({ db: function (m, ruta, cuerpo) { return dbRequest(m, ruta, cuerpo); }, s3Client: s3Client, S3Mod: S3Mod, BUCKET: BUCKET }, event);
  }

  var render_id = event.render_id;
  console.log('[Assembler] START render_id=' + render_id);

  try {
    await patchRender(render_id, { status: 'assembling' });

    // Leer datos de las tres fabricas desde la DB
    var row = await fetchRenderData(render_id);
    if (!row) throw new Error('render row not found: ' + render_id);

    /* v19: ¿el proyecto trae una edición hecha a mano? (con los mismos cortes; si cambiaron, no se usa) */
    var ED = null;
    try {
      var edFila = await EDICION.cargar(dbRequest, event.proyecto_edicion || row.project_id);
      if (edFila) {
        var mc = EDICION.mismosCortes(edFila, row.cortes_json);
        if (mc.ok) { ED = EDICION.preparar(edFila, 30); ED.fila = edFila; console.log('[Edicion] ' + edFila.id + ' · ' + ED.premium.length + ' capas · ' + ED.subtitulos.length + ' ventanas de subtítulos (' + mc.porque + ')'); }
        else console.log('[Edicion] el proyecto tiene una edición pero NO se usa: ' + mc.porque);
      }
    } catch (eEd) { console.log('[Edicion] no se pudo preparar: ' + String(eEd && eEd.message || eEd).slice(0, 200)); ED = null; }

    var segmentsJson = row.segments_json;
    var subtitleAss = row.subtitle_ass;
    var graphicsJson = row.graphics_json;

    if (!segmentsJson) throw new Error('segments_json is null — F1 did not complete properly');

    // Preparar directorio de trabajo
    var workDir = '/tmp/assemble_' + render_id;
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    // 1. Preparar video base desde F1
    var baseVideo = path.join(workDir, 'base.mp4');
    var segPaths = [];
    var concatFile;
    var segments = segmentsJson.segments || [];
    var relojC = relojDeCortes(segmentsJson, segments, row.cortes_json);
    if (relojC) {
      var antesR = segments.reduce(function (a, s) { return a + Number(s.duration_sec); }, 0);
      segments = segments.map(function (s, i) { return Object.assign({}, s, { duration_sec: relojC[i] }); });
      console.log('[Assembler] v14 reloj de los cortes: ' + antesR.toFixed(2) + ' s -> ' + relojC.reduce(function (a, b) { return a + b; }, 0).toFixed(2) + ' s (' + segments.length + ' trozos)');
    }
    var duracionesReales = null;   // v3
    var subidaLimpio = null;       // v4: subida del video sin subtítulos (en paralelo con la compresión final)
    var limpioUrl = null;

    var reusar = row.video_sin_subtitulos && Array.isArray(row.duraciones_reales) &&
      row.duraciones_reales.length === segments.length && segments.length > 0;

    if (reusar) {
      // v4: exportar desde el editor — la base sin subtítulos ya existe; no hay que descargar ni unir cortes
      console.log('[Assembler] Reutilizando video sin subtítulos: ' + row.video_sin_subtitulos.slice(0, 90));
      await descargarDelBucket(row.video_sin_subtitulos, baseVideo);
      duracionesReales = row.duraciones_reales.map(Number);
      console.log('[Assembler] Base reutilizada (' + Math.round(fs.statSync(baseVideo).size / 1048576) + ' MB)');
    } else if (segmentsJson.url && segments.length === 0) {
      // F1 subio video ya concatenado — descargar directamente
      console.log('[Assembler] Descargando base pre-concatenado de F1: ' + segmentsJson.url.slice(0, 60));
      await downloadFromUrl(segmentsJson.url, baseVideo);
      console.log('[Assembler] Base descargado OK: ' + baseVideo);
    } else if (segments.length > 0) {
      // Segmentos individuales: descargar y concatenar
      var concatLines = [];
      for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        var segPath = path.join(workDir, 'seg_' + i + '.mp4');
        console.log('[Assembler] Downloading segment ' + i + ' from ' + seg.url.slice(0, 60) + '...');
        await downloadFromUrl(seg.url, segPath);
        segPaths.push(segPath);
        concatLines.push("file '" + segPath.replace(/'/g, "'\\''") + "'");
      }
      // v3: medir antes de concatenar (y antes de borrar los segmentos)
      try {
        var reales = segPaths.map(duracionReal);
        if (reales.every(function (d) { return d > 0; }) && segments.every(function (s) { return Number(s.duration_sec) > 0; })) {
          duracionesReales = reales;
          var desfase = reales.reduce(function (a, b) { return a + b; }, 0) - segments.reduce(function (a, s) { return a + Number(s.duration_sec); }, 0);
          console.log('[Assembler] Duraciones reales medidas: desfase acumulado ' + desfase.toFixed(3) + 's en ' + reales.length + ' segmentos');
        }
      } catch (eDur) { console.log('[Assembler] No se midieron duraciones: ' + eDur.message); }
      concatFile = path.join(workDir, 'concat.txt');
      fs.writeFileSync(concatFile, concatLines.join('\n'));
      await runFFmpeg([
        '-f', 'concat', '-safe', '0', '-i', concatFile,
        '-map', '0:v', '-map', '0:a?',
        '-c:v', 'copy',
        // v14: el sonido de cada trozo donde empieza su imagen (antes -c copy: la voz se adelantaba)
        '-af', AUDIO_EN_SU_SITIO, '-c:a', 'aac', '-b:a', '256k',
        '-movflags', '+faststart',   // v4: la base también se ve en el navegador (editor)
        baseVideo,
      ]);
      console.log('[Assembler] Segments concatenated: ' + baseVideo);
      // v14b: el largo de cada trozo DENTRO de la base (antes: redondeado a centesimas y sin el relleno del sonido)
      try {
        var tL = Date.now();
        var exactos = largosEnLaBase(baseVideo, segPaths);
        if (exactos && exactos.length === segments.length) {
          var antesL = duracionesReales ? duracionesReales.reduce(function (a, b) { return a + b; }, 0) : 0;
          duracionesReales = exactos.map(function (d) { return Math.round(d * 100000) / 100000; });
          console.log('[Assembler] v14b largos en la base: ' + antesL.toFixed(3) + ' s -> ' + duracionesReales.reduce(function (a, b) { return a + b; }, 0).toFixed(3) + ' s (' + (Date.now() - tL) + ' ms)');
        }
      } catch (eL) { console.log('[Assembler] v14b no se midieron los largos en la base: ' + eL.message); }
      // Liberar /tmp: los segmentos ya están dentro de base.mp4 (videos largos no caben dos veces)
      for (var si = 0; si < segPaths.length; si++) { try { fs.unlinkSync(segPaths[si]); } catch(e) {} }
      // v4: guardar la base sin subtítulos para la vista previa en vivo y para exportar rápido
      if (duracionesReales) {
        var limpioKey = 'renders/' + render_id + '/sin_subtitulos.mp4';
        limpioUrl = 'https://' + BUCKET + '.s3.' + REGION + '.amazonaws.com/' + limpioKey;
        subidaLimpio = uploadToS3(baseVideo, limpioKey).then(function () {
          console.log('[Assembler] Video sin subtítulos subido (' + Math.round(fs.statSync(baseVideo).size / 1048576) + ' MB)');
          return true;
        }, function (eSub) {
          console.log('[Assembler] No se subió el video sin subtítulos: ' + eSub.message);
          return false;
        });
      }
    } else {
      throw new Error('segments_json no tiene url ni segmentos — F1 no completo correctamente');
    }

    /* v18 (25-sep) MASTER a 1080x1920. La cuenta de AWS deja 3 GB por Lambda y un Reel de 81 s en 4K60 con gráficos
       premium, escenas, sonidos y voz de estudio se quedaba sin memoria en los pedazos con gráficos (y en el
       coordinador al rehacerlos). La base 4K se reduce UNA vez aquí, con los mismos cuadros por segundo, y todo lo
       demás se monta a 1080. Instagram recibe lo mismo que antes (su máximo es 1080x1920). La descarga en 4K vuelve
       con CARRETE_MASTER_4K=on cuando AWS suba el límite. */
    var masterReducido = false;
    if (row.subtitle_config && row.subtitle_config.calidad === 'original' && process.env.CARRETE_MASTER_4K !== 'on') {
      try {
        var infoM = PEDAZOS.infoVideo(baseVideo);
        if (Math.max(infoM.w, infoM.h) > 1920) {
          var escM = 1920 / Math.max(infoM.w, infoM.h);
          var wM = 2 * Math.round(infoM.w * escM / 2), hM = 2 * Math.round(infoM.h * escM / 2);
          var base1080 = path.join(workDir, 'base_1080.mp4');
          var tM = Date.now();
          /* (30-sep, noche) con TODOS los procesadores de la Lambda (10 GB = 6): con 2 este paso tardaba 13 min en 128 s de
             4K60 y el máster del P25 (edición + piel con silueta) se pasaba de los 15 min de la Lambda */
          var hilosM = String(Math.max(2, require('os').cpus().length));
          await runFFmpeg(['-threads', hilosM, '-i', baseVideo, '-map', '0:v', '-map', '0:a?',
            '-vf', 'scale=' + wM + ':' + hM + ':flags=lanczos,setsar=1', '-vsync', '0',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-g', String(Math.round(infoM.fps || 30)),
            '-pix_fmt', 'yuv420p10le', '-profile:v', 'high10', '-threads', hilosM,       // (fase 2) sigue en 10 bits
            '-c:a', 'copy', '-movflags', '+faststart', base1080]);
          baseVideo = base1080;
          masterReducido = true;
          console.log('[Assembler] v18 MASTER a ' + wM + 'x' + hM + '@' + infoM.fps + ' (la base era ' + infoM.w + 'x' + infoM.h + ') en ' + Math.round((Date.now() - tM) / 1000) + ' s con ' + hilosM + ' hilos');
        }
      } catch (eM) { console.log('[Assembler] v18 no se pudo reducir la base, sigue en 4K: ' + String(eM).slice(0, 200)); }
    }

    /* v6 (18-sep): BASE ADELANTADA — la página la pide apenas el motor decide los cortes. Solo se cortan y pegan
       los clips (ya hecho arriba) y se sube la base sin subtítulos: la vista previa la reproduce como UN video
       fluido y generar después la reusa. Aquí termina: sin subtítulos, sin color, sin pasada final. */
    if (row.subtitle_config && row.subtitle_config.base) {
      var baseSubida = subidaLimpio ? await subidaLimpio : false;
      if (!baseSubida || !duracionesReales) throw new Error('base adelantada: no se pudo subir la base sin subtítulos');
      await patchRender(render_id, { status: 'base', video_sin_subtitulos: limpioUrl, duraciones_reales: duracionesReales });
      console.log('[Assembler] BASE lista render_id=' + render_id + ' (' + segments.length + ' cortes)');
      try { fs.unlinkSync(baseVideo); } catch (e) {}
      try { fs.unlinkSync(concatFile); } catch (e) {}
      try { fs.rmdirSync(workDir); } catch (e) {}
      return { success: true, render_id: render_id, base: true };
    }

    /* v16 (24-sep): LA VOZ DE ESTUDIO. Se manda YA (la voz cortada está en la base) y se espera al final: Auphonic
       trabaja mientras se dibujan gráficos, escenas y subtítulos. La promesa nunca falla (ver voz.js). */
    var vozP = null;
    if (row.subtitle_config && row.subtitle_config.voz === 'estudio') {
      var cfgVz = row.subtitle_config;
      /* (7-oct) un master usa la voz ya procesada para la vista previa (vozDesdeVista); solo si eso no se puede armar,
         manda la suya como antes */
      vozP = cfgVz.calidad === 'original' && cfgVz.vista_base
        ? vozDesdeVista(cfgVz, duracionesReales, workDir, render_id)
            .catch(function (eVz) { console.log('[Voz] la de la vista previa no sirvió: ' + String(eVz && eVz.message || eVz).slice(0, 200)); return null; })
            .then(function (v) { return v || VOZ.preparar(baseVideo, workDir, render_id); })
        : VOZ.preparar(baseVideo, workDir, render_id);
    }

    // 2. Preparar subtitulos ASS + descargar fuente Montserrat desde S3
    var assPath = null;
    var fontsDir = null;
    if (subtitleAss) {
      assPath = path.join(workDir, 'subs.ass');
      // Normalize font family names so libass can find them in fontsdir.
      // The ASS uses CSS-style names ("roboto-bold") but TTF internal family
      // names are different ("Roboto"). Map known variants to actual family names.
      var assFixed = subtitleAss.replace(/(Style:[^,\n]+,)([^,\n]+)(,)/g, function(m, pre, fontName, comma) {
        var fn = fontName.toLowerCase().replace(/[-_\s]/g, '');
        if (fn.indexOf('roboto') !== -1)      return pre + 'Roboto' + comma;
        if (fn.indexOf('montserrat') !== -1)  return pre + 'Montserrat' + comma;
        if (fn.indexOf('europagrotesk') !== -1 || fn.indexOf('europa') !== -1) return pre + 'EuropaGrotesk' + comma;
        return m; // unknown font — leave as-is
      });
      if (duracionesReales) {
        try {
          assFixed = tiemposRealesASS(assFixed, segments.map(function (s) { return Number(s.duration_sec); }), duracionesReales);
          console.log('[Assembler] Subtítulos ajustados al tiempo real de los cortes');
        } catch (eAjuste) { console.log('[Assembler] Sin ajuste de tiempos: ' + eAjuste.message); }
      }
      fs.writeFileSync(assPath, assFixed, 'utf8');
      console.log('[Assembler] ASS subtitles written: ' + assPath);

      // Download ALL fonts from S3/fonts/ so libass can find whichever font the ASS file requests
      fontsDir = await descargarFuentes(path.join(workDir, 'fonts'));
    }

    // 3. Descargar F3 graphics MP4 si existe
    var graphicsPath = null;
    var graphicsScenes = [];
    var graphicsInputIdx = -1;
    if (graphicsJson && graphicsJson.url) {
      graphicsPath = path.join(workDir, 'graphics.mp4');
      console.log('[Assembler] Downloading graphics from ' + graphicsJson.url.slice(0, 60) + '...');
      await downloadFromUrl(graphicsJson.url, graphicsPath);
      graphicsScenes = graphicsJson.scenes || [];
      graphicsInputIdx = 1;
      console.log('[Assembler] Graphics downloaded, scenes=' + graphicsScenes.length);
    }

    // 3b. v7: MOVIMIENTO — el director decide el de cada pedazo entre cortes (mismo cálculo que la vista del navegador)
    var movimiento = null;
    try {
      var movCfg = MOV.limpiar(row.subtitle_config && row.subtitle_config.movimiento);
      if (movCfg) {
        var nominales = segments.map(function (s) { return Number(s.duration_sec); });
        var durs = duracionesReales || (nominales.every(function (d) { return d > 0; }) ? nominales : null);
        if (durs && durs.length) {
          var sp = row.subtitle_phrases || {};
          var impactos = MOV.impactosDe(sp.palabras, sp.frases, MOV.reloj(nominales, durs));
          var planMov = MOV.dirigir(MOV.piezasDe(durs), impactos, movCfg);
          if (planMov.length) {
            movimiento = { plan: planMov, cfg: movCfg };
            console.log('[Movimiento] ' + planMov.length + ' pedazos · ' + JSON.stringify(MOV.resumen(planMov)) + ' · curva ' + movCfg.curva +
              ' · ' + movCfg.intensidad + ' · ' + impactos.length + ' frases de impacto');
          }
        } else console.log('[Movimiento] sin duraciones de los cortes: se sigue sin movimiento');
      }
    } catch (eMov) { console.log('[Movimiento] no se pudo preparar, se sigue sin movimiento: ' + eMov.message); movimiento = null; }

    // 3c. v8: ESCENAS DE APOYO — cuáles de las que encontró la IA (misma elección que la vista del celular)
    /* 20-sep: los GRAFICOS se colocan PRIMERO y las escenas los esquivan. Antes era al reves y una
       escena de relleno tiraba un grafico con su dato: en el video de Sergio, 2 de 3. Aqui solo se
       ELIGEN (que va y cuando); el bloque de graficos de mas abajo reutiliza esta lista y la dibuja. */
    var piezasG = [];
    /* (24-sep) las PANTALLAS de la persona: van donde las puso y mandan sobre todo lo demas */
    var pantallasCfg = row.subtitle_config && Array.isArray(row.subtitle_config.pantallas) ? row.subtitle_config.pantallas : [];
    try {
      var grCfg0 = GRAF.limpiar(row.subtitle_config && row.subtitle_config.graficos);
      if (grCfg0 && row.graficos && Array.isArray(row.graficos.momentos) && row.graficos.momentos.length) {
        var nomG0 = segments.map(function (s) { return Number(s.duration_sec); });
        var dursG0 = duracionesReales || (nomG0.every(function (d) { return d > 0; }) ? nomG0 : null);
        var spG0 = row.subtitle_phrases || {};
        if (dursG0 && Array.isArray(spG0.palabras) && spG0.palabras.length) {
          var totalG0 = dursG0.reduce(function (a, b) { return a + b; }, 0);
          piezasG = GRAF.elegir(row.graficos, spG0.palabras, GRAF.reloj(nomG0, dursG0), grCfg0, totalG0, []);
        }
      }
    } catch (eG0) { console.log('[Graficos] no se pudieron colocar: ' + eG0.message); piezasG = []; }
    if (ED) { if (piezasG.length) console.log('[Edicion] los ' + piezasG.length + ' gráficos de la IA no van: manda la edición'); piezasG = []; pantallasCfg = []; }
    var nPantallas = 0;
    try {
      if (pantallasCfg.length) {
        var nomP = segments.map(function (s) { return Number(s.duration_sec); });
        var dursP = duracionesReales || (nomP.every(function (d) { return d > 0; }) ? nomP : null);
        var spP = row.subtitle_phrases || {};
        if (dursP && Array.isArray(spP.palabras) && spP.palabras.length) {
          var totalP = dursP.reduce(function (a, b) { return a + b; }, 0);
          var antesIA = piezasG.length;
          piezasG = GRAF.conPantallas(piezasG, pantallasCfg, spP.palabras, GRAF.reloj(nomP, dursP), totalP, grCfg0 && grCfg0.fondo);
          nPantallas = piezasG.filter(function (p) { return p.pantalla; }).length;
          console.log('[Pantallas] ' + nPantallas + ' de ' + pantallasCfg.length + ' puestas; graficos de la IA ' + antesIA + ' -> ' + (piezasG.length - nPantallas) + ': ' +
            piezasG.filter(function (p) { return p.pantalla; }).map(function (p) { return p.t0.toFixed(1) + '-' + p.t1.toFixed(1) + 's ' + p.forma; }).join(' · '));
        }
      }
    } catch (eP) { console.log('[Pantallas] no se pudieron colocar: ' + eP.message); }
    // (24-sep) mientras hay una pantalla la camara va quieta (con «detras de ti», la silueta no encajaria con zoom)
    try {
      // (29-sep) y con la persiana que mueve tu video o usa tu recorte (el recorte no encajaría con zoom)
      // (2-oct) y con TODA pieza que usa tu recorte (pantalla con sello, anillos): el recorte sale de la base sin zoom
      var conPant = piezasG.filter(function (p) { return p.pantalla || (GRAF.CALLAN && GRAF.CALLAN[p.forma] && p.forma !== 'tarjeta') ||
        (GRAF.CON_PERSONA && GRAF.CON_PERSONA[p.forma]) || p.forma === 'profundo'; });   // «detrás de ti»: su silueta tampoco encaja con zoom
      if (movimiento && conPant.length && MOV.quieto) {
        movimiento.plan = MOV.quieto(movimiento.plan, conPant);
        console.log('[Pantallas] camara quieta en ' + movimiento.plan.filter(function (p) { return p.e === 'nada'; }).length + ' pedazos');
      }
    } catch (eQ) { console.log('[Pantallas] no se pudo dejar quieta la camara: ' + eQ.message); }
    // los subtitulos de las pantallas «tu arriba» suben a tu mitad de arriba
    try {
      var ventanasP = piezasG.filter(function (p) { return p.pantalla && p.forma === 'mitad'; });
      if (ventanasP.length && assPath && fs.existsSync(assPath)) {
        var subido = subirSubtitulos(fs.readFileSync(assPath, 'utf8'), ventanasP);
        if (subido.movidas) { fs.writeFileSync(assPath, subido.ass, 'utf8'); console.log('[Pantallas] ' + subido.movidas + ' lineas de subtitulos subidas a tu recuadro'); }
      }
      // (24-sep) «pantalla arriba, tú abajo»: bajan a la franja entre la ventana y tu cabeza
      var ventanasB = piezasG.filter(function (p) { return p.pantalla && p.forma === 'mitadAbajo'; });
      if (ventanasB.length && assPath && fs.existsSync(assPath)) {
        var bajado = subirSubtitulos(fs.readFileSync(assPath, 'utf8'), ventanasB, true);
        if (bajado.movidas) { fs.writeFileSync(assPath, bajado.ass, 'utf8'); console.log('[Pantallas] ' + bajado.movidas + ' lineas de subtitulos bajadas entre la ventana y tu cabeza'); }
      }
    } catch (eS) { console.log('[Pantallas] no se pudieron subir los subtitulos: ' + eS.message); }
    // (29-sep) La persiana calla los subtítulos mientras está (tapa o mueve el cuadro)
    try {
      var callan = GRAF.callados ? GRAF.callados(piezasG) : [];
      if (callan.length && assPath && fs.existsSync(assPath)) {
        var cal = PEDAZOS.callarAss(fs.readFileSync(assPath, 'utf8'), callan);
        if (cal.calladas) { fs.writeFileSync(assPath, cal.ass, 'utf8'); console.log('[Persiana] ' + cal.calladas + ' líneas de subtítulos calladas en ' + callan.length + ' piezas'); }
      }
    } catch (eC) { console.log('[Persiana] no se pudieron callar los subtítulos: ' + eC.message); }

    /* v19: la edición deja la cámara quieta donde lo pide (pantalla dividida, detrás de ti) y corre o calla los subtítulos */
    if (ED) {
      try {
        if (movimiento && ED.quieto.length) { movimiento.plan = MOV.quieto(movimiento.plan, ED.quieto); console.log('[Edicion] cámara quieta en ' + movimiento.plan.filter(function (p) { return p.e === 'nada'; }).length + ' pedazos'); }
        if (assPath && fs.existsSync(assPath) && ED.subtitulos.length) {
          var assE = fs.readFileSync(assPath, 'utf8');
          var mv = EDICION.moverSubtitulos(assE, ED.subtitulos.filter(function (v) { return v.modo !== 'oculto'; }));
          var cl = PEDAZOS.callarAss(mv.ass, ED.subtitulos.filter(function (v) { return v.modo === 'oculto'; }));
          fs.writeFileSync(assPath, cl.ass, 'utf8');
          console.log('[Edicion] subtítulos: ' + mv.movidas + ' líneas movidas, ' + cl.calladas + ' calladas');
        }
      } catch (eEs) { console.log('[Edicion] no se pudieron acomodar la cámara o los subtítulos: ' + String(eEs && eEs.message || eEs).slice(0, 200)); }
    }

    // v15 (24-sep): los EFECTOS DE SONIDO del Guion: el golpe de cada uno cae en su palabra (el reloj de los subtítulos)
    var planSonidos = [];
    try {
      var sonCfg = row.subtitle_config && Array.isArray(row.subtitle_config.sonidos) ? row.subtitle_config.sonidos : [];
      var spS = row.subtitle_phrases || {};
      if (sonCfg.length && Array.isArray(spS.palabras) && spS.palabras.length) {
        var nomS = segments.map(function (x) { return Number(x.duration_sec); });
        var relojS = GRAF.reloj(nomS, duracionesReales || nomS);
        planSonidos = sonCfg.map(function (x) {
          var w = spS.palabras[Math.round(Number(x.palabra))];
          if (!w || !/^https:\/\/remotionlambda-useast1-editorvideo\.s3\.us-east-1\.amazonaws\.com\/sonidos\//.test(String(x.url || ''))) return null;
          return { url: x.url, t: relojS(Number(w.start)) + (Number(x.mover) || 0), golpe: Number(x.golpe) || 0,
                   vol: x.vol == null ? 100 : Number(x.vol), nombre: x.sonido || '' };
        }).filter(Boolean);
        console.log('[Sonidos] ' + planSonidos.length + ': ' + planSonidos.map(function (p) { return p.t.toFixed(2) + 's ' + p.nombre; }).join(' · '));
      }
    } catch (eS2) { console.log('[Sonidos] no se pudieron ubicar: ' + eS2.message); planSonidos = []; }

    var apoyo = null;
    try {
      var escCfg = APOYO.limpiar(row.subtitle_config && row.subtitle_config.escenas);
      if (escCfg && row.apoyo && Array.isArray(row.apoyo.momentos) && row.apoyo.momentos.length) {
        var nomA = segments.map(function (s) { return Number(s.duration_sec); });
        var dursA = duracionesReales || (nomA.every(function (d) { return d > 0; }) ? nomA : null);
        var spA = row.subtitle_phrases || {};
        if (dursA && Array.isArray(spA.palabras) && spA.palabras.length) {
          var totalA = dursA.reduce(function (a, b) { return a + b; }, 0);
          var insertos = APOYO.elegir(row.apoyo, spA.palabras, APOYO.reloj(nomA, dursA), escCfg, totalA,
            piezasG.map(function (p) { return { t0: p.t0, t1: p.t1 }; }));
          if (insertos.length) {
            var infoA = PEDAZOS.infoVideo(baseVideo);
            var dirA = path.join(workDir, 'apoyo');
            if (!fs.existsSync(dirA)) fs.mkdirSync(dirA, { recursive: true });
            await Promise.all(insertos.map(function (a, i) {
              a.local = path.join(dirA, i + '_' + path.basename(a.s3_key));
              return descargarDelBucket(urlDelBucket(a.s3_key), a.local).catch(function (e) { console.log('[Apoyo] no se bajó ' + a.s3_key + ': ' + e.message); a.local = null; });
            }));
            apoyo = { insertos: insertos.filter(function (a) { return a.local; }), W: infoA.w || 1080, H: infoA.h || 1920 };
            console.log('[Apoyo] ' + apoyo.insertos.length + ' escenas («' + escCfg.cantidad + '», ' + row.apoyo.momentos.length + ' posibles): ' +
              apoyo.insertos.map(function (a) { return a.t0.toFixed(1) + 's ' + a.clip_id; }).join(' · '));
          }
        }
      }
    } catch (eAp) { console.log('[Apoyo] no se pudo preparar, se sigue sin escenas: ' + eAp.message); apoyo = null; }

    /* (29-sep) TU RECORTE para «Te sales de la tarjeta» y «Tú delante de la palabra». 1) La silueta de cada tramo
       (carrete-recorte, como «detrás de ti»), apenas se saben las piezas. 2) Con el color listo, tu recorte con
       transparencia y con TU color (la tabla de la persona si el look tiene máscara), en un WebM que lee Remotion. Si algo
       falla, esa pieza pasa a la suya sin recorte (te sales → la ventana, tú delante → la tarjeta): el video sale igual. */
    function siluetasDePersona(piezas) {
      return (async function () {
        var u = reusar ? row.video_sin_subtitulos : (subidaLimpio && (await subidaLimpio) ? limpioUrl : null);
        var clave = u ? String(u).split('.amazonaws.com/')[1].split('?')[0] : null;
        if (!clave) { clave = 'renders/' + render_id + '/persona_base.mp4'; await uploadToS3(baseVideo, clave); }
        var tS = Date.now();
        var out = await Promise.all(piezas.map(async function (pz, i) {
          var d0 = Math.max(0, pz.t0 - 0.2), d1 = pz.t1 + 0.2, k = 'renders/' + render_id + '/silueta_persona_' + i + '.mp4';
          try {
            var r = await recorteEnAlta(clave, d0, d1, k, workDir, 'sp' + i);
            if (!r || !r.ok) { console.log('[Persiana] sin silueta para la de ' + pz.t0.toFixed(1) + 's: ' + JSON.stringify(r).slice(0, 140)); return null; }
            var loc = path.join(workDir, 'silueta_persona_' + i + '.mp4');
            await descargarDelBucket(urlDelBucket(k), loc);
            return { local: loc, desde: d0, hasta: d1 };
          } catch (e) { console.log('[Persiana] falló el recorte de la de ' + pz.t0.toFixed(1) + 's: ' + String(e && e.message).slice(0, 160)); return null; }
        }));
        console.log('[Persiana] ' + out.filter(Boolean).length + ' de ' + piezas.length + ' siluetas en ' + Math.round((Date.now() - tS) / 1000) + ' s');
        return out;
      })();
    }
    async function prepararPersonas(g, color) {
      var sils = (await g.siluetasPersona) || [];
      var W = Math.min(g.W, 1080), H = 2 * Math.round((g.H * W / g.W) / 2);
      var tabla = color ? (color.cubePersona || color.cube || null) : null;
      var tP = Date.now();
      await Promise.all(g.conPersona.map(async function (p, i) {
        var s = sils[i];
        try {
          if (!s) throw new Error('sin silueta');
          var sal = path.join(workDir, 'persona_' + i + '.webm');
          var ent = '[0:v]fps=fps=30,scale=' + W + ':' + H + ':flags=lanczos,setsar=1,';
          var fv = tabla ? filtroTabla(tabla, ent, '[v]') : ent + 'format=yuv420p[v]';
          var fm = '[1:v]fps=fps=30,scale=' + W + ':' + H + ",format=gray,lut=y='clip((val-90)*255/80,0,255)',boxblur=1:1[m]";
          await runFFmpeg(['-ss', s.desde.toFixed(3), '-t', (s.hasta - s.desde).toFixed(3), '-i', baseVideo, '-i', s.local,
            '-filter_complex', fv + ';' + fm + ';[v][m]alphamerge,format=yuva420p[o]', '-map', '[o]', '-an',
            '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-deadline', 'realtime', '-cpu-used', '8',
            '-auto-alt-ref', '0', '-threads', '4', sal]);
          var key = 'renders/' + render_id + '/persona_' + i + '.webm';
          await uploadToS3(sal, key, 'video/webm');
          p.datos = Object.assign({}, p.datos, { persona: urlDelBucket(key), personaDesde: s.desde });
        } catch (e) {
          console.log('[Persiana] la de ' + p.t0.toFixed(1) + 's va sin tu recorte (' + String(e && e.message).slice(0, 120) + ')');
          /* (2-oct) la pantalla con sello sin tu recorte te taparía la cara: no sale */
          if (p.forma === 'falso' || p.forma === 'rodea') p.sinRecorte = true;   // (2-oct) los anillos sin recorte te cruzarían encima
          else if (p.forma === 'sales') { p.tipo = 'pe_ventana'; p.forma = 'ventana'; } else { p.tipo = 'pe_tarjeta'; p.forma = 'tarjeta'; }
        }
      }));
      console.log('[Persiana] recortes listos en ' + Math.round((Date.now() - tP) / 1000) + ' s: ' + g.conPersona.map(function (p) { return p.t0.toFixed(1) + 's ' + p.tipo; }).join(' · '));
      var vanP = g.conPersona.filter(function (p) { return !p.sinRecorte; });
      if (vanP.length < g.conPersona.length) console.log('[Persiana] ' + (g.conPersona.length - vanP.length) + ' pieza(s) con tu recorte no salen (pantalla con sello o anillos): sin recorte te taparían');
      return vanP.length ? PREMIUM.arrancar(vanP, { W: g.W, H: g.H, fps: g.fps, color: g.color, render_id: render_id, i0: g.i0Persona }) : [];
    }

    // 3d. v9: GRÁFICOS — cuáles de los que marcó la IA (misma elección que la vista del celular)
    var graf = null;
    try {
      var grCfg = GRAF.limpiar(row.subtitle_config && row.subtitle_config.graficos);
      /* (24-sep) con pantallas hay grafica aunque los graficos de la IA esten apagados, y va en premium */
      if (nPantallas && !grCfg) grCfg = { cantidad: 'medio', color: 'cherry', estilo: 'premium', detras: false, fijos: null };
      if (nPantallas && grCfg.estilo !== 'premium') grCfg = Object.assign({}, grCfg, { estilo: 'premium' });
      /* (29-sep) la persiana solo la dibuja Remotion: si sale alguna, todo va en premium */
      if (grCfg && grCfg.estilo !== 'premium' && piezasG.some(function (p) { return /^pe_/.test(String(p.tipo || '')); })) grCfg = Object.assign({}, grCfg, { estilo: 'premium' });
      if (grCfg && (nPantallas || (row.graficos && Array.isArray(row.graficos.momentos) && row.graficos.momentos.length))) {
        if (!CAPA.disponible()) console.log('[Gráficos] sin canvas en la Lambda, se sigue sin gráficos: ' + CAPA.porQueNo());
        else {
          var nomG = segments.map(function (s) { return Number(s.duration_sec); });
          var dursG = duracionesReales || (nomG.every(function (d) { return d > 0; }) ? nomG : null);
          var spG = row.subtitle_phrases || {};
          if (dursG && Array.isArray(spG.palabras) && spG.palabras.length) {
            var totalG = dursG.reduce(function (a, b) { return a + b; }, 0);
            // ya colocados arriba, antes que las escenas (piezasG): aqui solo se dibujan
            if (piezasG.length) {
              var infoG = PEDAZOS.infoVideo(baseVideo);
              graf = { piezas: piezasG, color: grCfg.color, estilo: grCfg.estilo, W: infoG.w || 1080, H: infoG.h || 1920, fps: infoG.fps || 30, capas: null };
              if (!fontsDir) fontsDir = await descargarFuentes(path.join(workDir, 'fonts'));
              console.log('[Gráficos] ' + piezasG.length + ' («' + grCfg.cantidad + '», ' + grCfg.color + ', ' + grCfg.estilo + ', ' + ((row.graficos && row.graficos.momentos) || []).length + ' posibles): ' +
                piezasG.map(function (p) { return p.t0.toFixed(1) + 's ' + p.tipo; }).join(' · '));
              // PREMIUM: se piden a Remotion apenas se saben, y se esperan justo antes de la pasada final
              if (grCfg.estilo === 'premium') {
                if (!PREMIUM.disponible()) { console.log('[Premium] sin cliente de Remotion, se usa el estilo clásico: ' + PREMIUM.porQueNo()); graf.estilo = 'clasico'; sinTarjetas(graf); }
                else {
                  /* (29-sep) Te sales y Tú delante necesitan tu recorte: se piden aparte, cuando estén tu silueta y el color */
                  var conPersona = piezasG.filter(function (p) { return GRAF.CON_PERSONA && GRAF.CON_PERSONA[p.forma]; });
                  var sinPersona = piezasG.filter(function (p) { return !(GRAF.CON_PERSONA && GRAF.CON_PERSONA[p.forma]); });
                  graf.pedido = (sinPersona.length ? PREMIUM.arrancar(sinPersona, { W: graf.W, H: graf.H, fps: graf.fps, color: graf.color, render_id: render_id }) : Promise.resolve([]))
                    .catch(function (e) { console.log('[Premium] no se pudieron pedir, se usa el estilo clásico: ' + String(e.message || e).slice(0, 300)); return null; });
                  if (conPersona.length) {
                    graf.conPersona = conPersona; graf.i0Persona = sinPersona.length;
                    graf.siluetasPersona = siluetasDePersona(conPersona).catch(function (e) { console.log('[Persiana] sin siluetas: ' + String(e.message || e).slice(0, 200)); return []; });
                  }
                }
              }
            }
          }
        }
      }
    } catch (eGr) { console.log('[Gráficos] no se pudieron preparar, se sigue sin gráficos: ' + eGr.message); graf = null; }

    /* v19: con una edición, sus capas son los gráficos (ya dibujadas: no se le pide nada a Remotion) */
    if (ED) {
      if (apoyo) { console.log('[Edicion] las escenas de apoyo no van: manda la edición'); apoyo = null; }
      try {
        var infoE = PEDAZOS.infoVideo(baseVideo);
        graf = { piezas: ED.piezas, premium: ED.premium, color: 'cherry', estilo: 'premium', W: infoE.w || 1080, H: infoE.h || 1920, fps: infoE.fps || 30, capas: null, edicion: ED };
        ED.siluetasListas = await Promise.all(ED.siluetas.map(async function (x, i) {
          var loc = path.join(workDir, 'silueta_edicion_' + i + '.mp4');
          try { await descargarDelBucket(urlDelBucket(x.key), loc); return Object.assign({ local: loc }, x); }
          catch (e) { console.log('[Edicion] sin silueta (lo de detrás va encima): ' + String(e.message || e).slice(0, 120)); return null; }
        }));
        ED.siluetasListas = ED.siluetasListas.filter(Boolean);
        if (!ED.siluetasListas.length) ED.piezas.forEach(function (p) { if (p.forma === 'profundo') p.forma = 'capa'; });
        console.log('[Edicion] ' + ED.premium.length + ' capas: ' + ED.piezas.map(function (p) { return p.t0.toFixed(1) + '-' + p.t1.toFixed(1) + 's ' + p.forma; }).join(' · '));
      } catch (eG) { console.log('[Edicion] no se pudieron montar las capas: ' + String(eG && eG.message || eG).slice(0, 200)); graf = null; }
    }

    // 4. Construir filtro FFmpeg
    var finalVideo = path.join(workDir, 'final.mp4');
    // Pass graphicsPath (not index) — buildFilterGraph uses movie= filter to read per scene
    // El color viaja en subtitle_config.color = {look, intensidad, ajustes, revelado}
    var colorCfg = null;
    try { colorCfg = row.subtitle_config && row.subtitle_config.color ? row.subtitle_config.color : null; } catch (e) { colorCfg = null; }
    /* Revelado (medido de ESTE video, encendido salvo color.revelado === false) + look con
       los ajustes de la persona, en una sola tabla. Si algo falla, se sigue sin color. */
    var colorPrep = null;
    /* (28-sep) IGUALAR TOMAS: si F1 ya corrigió cada toma (segments_json.igualado), el revelado de todo el video no se
       vuelve a medir ni a aplicar (sería corregir dos veces). El look y la corrección general van igual. */
    var colorPreparar = row.segments_json && row.segments_json.igualado
      ? Object.assign({}, colorCfg || {}, { revelado: false }) : colorCfg;
    if (colorPreparar !== colorCfg) console.log('[Color] tomas igualadas en F1: sin revelado de todo el video');
    try { colorPrep = await REVELADO.prepararColor(ffmpegPath, baseVideo, workDir, colorPreparar); }
    catch (e) { console.log('[Color] no se pudo preparar, se sigue sin color: ' + e.message); colorPrep = null; }
    /* (27-sep) Look con máscara: la silueta de TODO el video. Se saca del video sin subtítulos que queda guardado
       (así la reusan la vista previa y los videos siguientes). Si falla, la receta de la persona va en todo el
       cuadro (natural): nunca piel naranja y nunca se cae el render por esto. */
    if (colorPrep && colorPrep.datos && (colorPrep.datos.Pp || colorPrep.datos.Z)) {      // (28-sep) también con zonas
      try {
        var tSilC = Date.now();
        var infoC = PEDAZOS.infoVideo(baseVideo);
        var urlSil = reusar ? row.video_sin_subtitulos : (subidaLimpio && (await subidaLimpio) ? limpioUrl : null);
        var claveSil = urlSil ? String(urlSil).split('.amazonaws.com/')[1].split('?')[0] : null;
        if (!claveSil) { claveSil = 'renders/' + render_id + '/color_base.mp4'; await uploadToS3(baseVideo, claveSil); }
        /* (7-oct) un master toma la silueta de su base liviana (la que ya sacó la vista previa), acomodada a sus cortes */
        var sil = null, cfgSil = row.subtitle_config || {};
        if (cfgSil.calidad === 'original' && cfgSil.vista_base && Array.isArray(cfgSil.vista_duraciones) && Array.isArray(duracionesReales)) {
          try {
            var claveVistaSil = String(cfgSil.vista_base).split('.amazonaws.com/')[1];
            sil = await SIL.desdeVista(claveVistaSil ? claveVistaSil.split('?')[0] : null, cfgSil.vista_duraciones, duracionesReales, claveSil, workDir);
          } catch (eV) { console.log('[Color] la silueta de la vista previa no sirvió: ' + String(eV && eV.message || eV).slice(0, 200)); sil = null; }
        }
        if (!sil) sil = await SIL.asegurar(claveSil, infoC.dur, workDir);
        colorPrep.datos.mascara = true;
        colorPrep.datos.silueta = { key: sil.key };
        var conSil = REVELADO.escribirColor(colorPrep.datos, workDir);
        conSil.silueta = sil.local; conSil.W = infoC.w; conSil.H = infoC.h; conSil.cuadros = Math.ceil(infoC.dur * infoC.fps) + 2;
        colorPrep = conSil;
        console.log('[Color] máscara lista en ' + Math.round((Date.now() - tSilC) / 1000) + ' s (' + infoC.w + 'x' + infoC.h + ')');
      } catch (eSil) {
        console.log('[Color] sin silueta, la receta de la persona va en todo el cuadro: ' + String(eSil && eSil.message || eSil).slice(0, 300));
      }
    }

    /* v10: las capas premium (Remotion) se esperan aquí: mientras tanto ya se preparó el color y la base.
       Si no llega ninguna, el video sale con el estilo clásico. */
    if (graf && graf.conPersona) {
      graf.pedido2 = prepararPersonas(graf, colorPrep).catch(function (e) { console.log('[Persiana] no se pudieron pedir las de tu recorte: ' + String(e.message || e).slice(0, 300)); return null; });
    }
    if (graf && (graf.pedido || graf.pedido2)) {
      var pedidas = graf.pedido ? await graf.pedido : [];
      if (graf.pedido2) { var pedidas2 = await graf.pedido2; if (pedidas2) pedidas = (pedidas || []).concat(pedidas2); }
      if (pedidas && !pedidas.length) pedidas = null;
      var listas = pedidas ? await PREMIUM.esperar(pedidas).catch(function (e) { console.log('[Premium] ' + String(e.message || e).slice(0, 200)); return []; }) : [];
      if (listas && listas.length) { graf.premium = listas; PREMIUM.limpiar(pedidas.filter(function (j) { return listas.indexOf(j) < 0; })); }
      else { graf.estilo = 'clasico'; sinTarjetas(graf); console.log('[Premium] ninguna capa lista: el video sale con el estilo clásico'); }
    }

    // v9: la pasada única se arma solo si hace falta (con gráficos, ahí se dibujan sus capas)
    async function argsPasadaUnica() {
      var fpsU = (movimiento || apoyo || graf || (colorPrep && colorPrep.cubePersona)) ? PEDAZOS.infoVideo(baseVideo).fps : 30;
      if (graf && !graf.capas) {
        var dirG = path.join(workDir, 'graficos');
        if (!fs.existsSync(dirG)) fs.mkdirSync(dirG, { recursive: true });
        graf.capas = graf.premium && graf.premium.length
          ? await PREMIUM.capas(graf.premium, { W: graf.W, H: graf.H, fps: fpsU, dir: dirG, ffmpegPath: ffmpegPath, bajar: function (k, l) { return descargarDelBucket(urlDelBucket(k), l); } })
          : await CAPA.renderizarTodas(graf.piezas, { W: graf.W, H: graf.H, fps: fpsU, color: graf.color, ffmpegPath: ffmpegPath, dir: dirG, fontsDir: fontsDir });
      }
      // la base y, si hay gráficos premium, sus capas WebM como entradas (movie= no sabe escoger decodificador)
      var args = ['-i', baseVideo].concat(graf && graf.capas ? CAPA.entradas(graf.capas, 1) : []);
      // (27-sep) la silueta del color con máscara, al final de las entradas
      if (colorPrep && colorPrep.cubePersona && colorPrep.silueta) {
        colorPrep.silIndice = args.filter(function (a) { return a === '-i'; }).length;
        args = args.concat(['-i', colorPrep.silueta]);
      }
      var filterResult = buildFilterGraph(graphicsScenes, assPath, graphicsPath, fontsDir, colorPrep, movimiento, fpsU, apoyo, graf);
      if (filterResult.filterStr) {
        var guionFiltro = path.join(workDir, 'filtro.txt');      // v7: en archivo (el del movimiento puede ser largo)
        fs.writeFileSync(guionFiltro, filterResult.filterStr, 'utf8');
        args = args.concat([
          '-filter_complex_script', guionFiltro,
          '-map', filterResult.outVideo,
          '-map', '0:a',  // audio always from base.mp4 (input 0)
        ]);
      } else {
        args = args.concat(['-map', '0:v', '-map', '0:a']);
      }
      return args;
    }

    // Compresión: COMPRESION_FLUIDA (arriba, compartida con los pedazos). En julio la v1 usaba 680 MB de 3008.
    // Respaldo: la compresión de v1, que ya se probó con cientos de renders
    var COMPRESION_V1 = [
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-threads', '1',
    ];
    var SALIDA = ['-af', AUDIO_EN_SU_SITIO, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', finalVideo];
    /* v10: ¿este render es el MASTER (calidad original)? Lo marca orchestrate en subtitle_config.calidad. */
    var esMaster = !!(row.subtitle_config && row.subtitle_config.calidad === 'original');
    var finalVideoIG = path.join(workDir, 'final_ig.mp4');
    var infoBase = PEDAZOS.infoVideo(baseVideo);
    if (esMaster) { SALIDA = ['-af', AUDIO_EN_SU_SITIO, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', finalVideo]; console.log('[Assembler] MASTER ' + infoBase.w + 'x' + infoBase.h + '@' + infoBase.fps); }
    var t0 = Date.now();

    /* v5: primero en pedazos paralelos. Con gráficos (F3, hoy apagados) se usa la pasada única,
       porque sus superposiciones leen otro video por tiempo y no están probadas en pedazos. */
    var enPedazos = false, baseTemporal = null;
    if (!graphicsPath && process.env.CARRETE_PEDAZOS !== 'off') {
      try {
        // los pedazos bajan la base de S3: la reutilizada, la recién subida o una copia temporal
        // v18: con el master reducido, los pedazos bajan la base de 1080 (la subida o la reutilizada son la de 4K)
        var baseUrl = masterReducido ? null : (reusar ? row.video_sin_subtitulos : null);
        if (!baseUrl && !masterReducido && subidaLimpio && (await subidaLimpio)) baseUrl = limpioUrl;
        if (!baseUrl) {
          baseTemporal = 'renders/' + render_id + '/pedazos/base.mp4';
          await uploadToS3(baseVideo, baseTemporal);
          baseUrl = urlDelBucket(baseTemporal);
        }
        /* (20-sep) Si alguna pieza va DETRÁS de la persona, antes hace falta su silueta: se la pide a
           carrete-recorte para el tramo justo que ocupan esos gráficos (no para todo el video: se paga
           por cuadro). Si falla, se sigue sin ella y esos gráficos salen encima, como siempre. */
        var hondas = graf && graf.piezas && !graf.edicion ? graf.piezas.filter(function (p) { return p.forma === 'profundo'; }) : [];
        var siluetas = [];
        if (hondas.length) {
          var claveBase = baseUrl.split('.amazonaws.com/')[1] || baseTemporal;
          var tSil = Date.now();
          /* UNA SILUETA POR GRÁFICO, en paralelo. Pedir el tramo entero (del primero al último) reventaba
             el disco: 46 s son 1.400 cuadros a 608x1080 = 2,7 GB de crudo y la Lambda tiene 2 GB. Y era
             un 40% de trabajo de más, porque los huecos entre gráficos no se usan. */
          siluetas = await Promise.all(hondas.map(async function (pz, i) {
            var d0 = Math.max(0, pz.t0 - 0.2), d1 = pz.t1 + 0.2;
            var k = 'renders/' + render_id + '/silueta_' + i + '.mp4';
            try {
              var r = await recorteEnAlta(claveBase, d0, d1, k, workDir, 'sh' + i);
              if (!r || !r.ok) { console.log('[Hondo] sin silueta para el de ' + pz.t0.toFixed(1) + 's: ' + JSON.stringify(r).slice(0, 140)); return null; }
              var loc = path.join(workDir, 'silueta_' + i + '.mp4');
              await descargarDelBucket(urlDelBucket(k), loc);
              return { t0: pz.t0, t1: pz.t1, desde: d0, key: k, local: loc };
            } catch (e) {
              console.log('[Hondo] falló el recorte del de ' + pz.t0.toFixed(1) + 's: ' + String(e && e.message).slice(0, 160));
              return null;
            }
          }));
          siluetas = siluetas.filter(Boolean);
          console.log('[Hondo] ' + siluetas.length + ' de ' + hondas.length + ' siluetas en ' +
            Math.round((Date.now() - tSil) / 1000) + ' s' + (siluetas.length ? '' : ' — esos gráficos van encima'));
        }
        if (graf && graf.edicion) siluetas = graf.edicion.siluetasListas || [];
        enPedazos = await PEDAZOS.pasadaEnPedazos({ render_id: render_id, baseVideo: baseVideo, baseUrl: baseUrl,
          assPath: assPath, fontsDir: fontsDir, colorPrep: colorPrep, workDir: workDir, finalVideo: finalVideo, movimiento: movimiento, apoyo: apoyo, graf: graf,
          siluetas: siluetas, esMaster: esMaster, finalVideoIG: finalVideoIG });
      } catch (ePed) {
        console.log('[Pedazos] falló, se hace la pasada única: ' + String(ePed && ePed.message || ePed).slice(0, 400));
        try { fs.unlinkSync(finalVideo); } catch (e) {}
        enPedazos = false;
      }
      if (baseTemporal) s3Client.send(new S3Mod.DeleteObjectCommand({ Bucket: BUCKET, Key: baseTemporal })).catch(function () {});
    }

    if (!enPedazos) {
      var ffmpegArgs = await argsPasadaUnica();
      console.log('[Assembler] Running final FFmpeg pass (compresión fluida)...');
      try {
        await runFFmpeg(ffmpegArgs.concat(compresionPara(infoBase, esMaster), SALIDA));
      } catch (encErr) {
        console.log('[Assembler] Compresión fluida falló, reintento con la de v1: ' + String(encErr).slice(0, 300));
        try { fs.unlinkSync(finalVideo); } catch(e) {}
        await runFFmpeg(ffmpegArgs.concat(COMPRESION_V1, SALIDA));
      }
    }
    console.log('[Assembler] Final video assembled in ' + Math.round((Date.now() - t0) / 1000) + 's: ' + finalVideo +
      ' (' + Math.round(fs.statSync(finalVideo).size / 1048576) + ' MB)');
    // v16 (24-sep): la voz de estudio, ANTES de los efectos (los efectos se suman encima de la voz nueva)
    var resultadoVoz = null;
    if (vozP) {
      var tV = Date.now();
      var voz = await vozP;
      try {
        if (voz.estado === 'lista') {
          await VOZ.aplicar(finalVideo, voz, workDir, esMaster ? '192k' : '128k');
          if (fs.existsSync(finalVideoIG)) await VOZ.aplicar(finalVideoIG, voz, workDir, '192k');
          // los efectos siguen a la voz: si la de estudio quedó 3 dB más baja que la original, ellos también
          if (voz.efectosDb && planSonidos.length) {
            var fx = Math.pow(10, voz.efectosDb / 20);
            planSonidos.forEach(function (p) { p.vol = p.vol * fx; });
          }
        }
      } catch (eV) { voz = { estado: 'error', huella: voz.huella, detalle: 'no se pudo poner: ' + String(eV && eV.message || eV).slice(0, 160) }; }
      resultadoVoz = { estado: voz.estado, huella: voz.huella || null, reutilizada: !!voz.reutilizada,
        retardo_ms: voz.retardo != null ? Math.round(voz.retardo * 1000) : null,
        efectos_db: voz.efectosDb != null ? Math.round(voz.efectosDb * 10) / 10 : null,
        detalle: voz.detalle || null, fecha: new Date().toISOString() };
      console.log('[Voz] ' + JSON.stringify(resultadoVoz) + ' (esperó ' + Math.round((Date.now() - tV) / 1000) + ' s al final)');
    }
    // v15 (24-sep): los efectos de sonido del Guion, encima de la voz (también en la versión para Instagram si ya salió)
    if (planSonidos.length) {
      try {
        var tS = Date.now();
        var nS = await mezclarSonidos(finalVideo, planSonidos, workDir);
        if (fs.existsSync(finalVideoIG)) await mezclarSonidos(finalVideoIG, planSonidos, workDir);
        console.log('[Sonidos] ' + nS + ' mezclados en ' + Math.round((Date.now() - tS) / 1000) + ' s');
      } catch (eMz) { console.log('[Sonidos] no se pudieron mezclar: ' + String(eMz).slice(0, 300)); }
    }
    /* v10: si es master y no salió la versión para Instagram en los pedazos, se hace aquí (una reducción) */
    if (esMaster && Math.max(infoBase.w, infoBase.h) > 1920 && !fs.existsSync(finalVideoIG)) {
      try {
        var escIG = 1920 / Math.max(infoBase.w, infoBase.h);
        var wIG = 2 * Math.round(infoBase.w * escIG / 2), hIG = 2 * Math.round(infoBase.h * escIG / 2);
        var tIG = Date.now();
        await runFFmpeg(['-i', finalVideo, '-vf', 'scale=' + wIG + ':' + hIG + ':flags=lanczos,setsar=1', '-map', '0:v', '-map', '0:a?']
          .concat(compresionIG(infoBase), ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', finalVideoIG]));
        console.log('[Assembler] versión para Instagram aparte: ' + wIG + 'x' + hIG + ' en ' + Math.round((Date.now() - tIG) / 1000) + ' s');
      } catch (eIG) { console.log('[Assembler] no salió la versión para Instagram: ' + String(eIG).slice(0, 200)); }
    }

    // 5. Subir a S3
    var s3Key = 'renders/' + render_id + '/output.mp4';
    await uploadToS3(finalVideo, s3Key);
    var outputUrl = 'https://' + BUCKET + '.s3.' + REGION + '.amazonaws.com/' + s3Key;
    console.log('[Assembler] Uploaded: ' + outputUrl);
    /* v10: el master queda en `output_original_url`; `output_url` es lo que reproduce la página y publica el
       calendario — la versión para Instagram si hubo que reducir, o el propio master si ya cabía. */
    var outputOriginalUrl = null;
    if (esMaster) {
      outputOriginalUrl = outputUrl;
      if (fs.existsSync(finalVideoIG)) {
        var keyIG = 'renders/' + render_id + '/output_instagram.mp4';
        await uploadToS3(finalVideoIG, keyIG);
        outputUrl = 'https://' + BUCKET + '.s3.' + REGION + '.amazonaws.com/' + keyIG;
        console.log('[Assembler] Instagram: ' + outputUrl + ' (' + Math.round(fs.statSync(finalVideoIG).size / 1048576) + ' MB)');
      }
    }

    /* (6-oct, fase 7) R2: con el interruptor prendido (r2.js) el video terminado se sirve desde Cloudflare R2, con la misma
       ruta. Si R2 falla, se queda el de Amazon que ya se subió. Apagado: no hace nada. */
    if (R2.activo()) {
      try {
        var r2Final = await R2.subir(finalVideo, s3Key);
        if (esMaster) {
          outputOriginalUrl = r2Final;
          outputUrl = fs.existsSync(finalVideoIG) ? await R2.subir(finalVideoIG, 'renders/' + render_id + '/output_instagram.mp4') : r2Final;
        } else outputUrl = r2Final;
        console.log('[R2] video terminado en R2: ' + outputUrl);
      } catch (eR2) { console.log('[R2] no se pudo subir a R2, se queda Amazon: ' + String(eR2).slice(0, 200)); }
    }

    // 6. Actualizar DB: output_url + status done (+ v4: video sin subtítulos y duraciones reales para el editor)
    var cambiosFinales = {
      output_url: outputUrl,
      layer2_url: outputUrl,   // compatibilidad con frontend existente
      status: 'done',
    };
    if (outputOriginalUrl) cambiosFinales.output_original_url = outputOriginalUrl;
    if (resultadoVoz) cambiosFinales.voz_estudio = resultadoVoz;   // v16
    if (subidaLimpio && (await subidaLimpio)) {
      if (!esMaster) {
        cambiosFinales.video_sin_subtitulos = limpioUrl;
        cambiosFinales.duraciones_reales = duracionesReales;
      } else {
        /* (fase 2) la base del master es de 10 bits y el navegador no reproduce H.264 de 10 bits: la vista previa del
           editor sigue con la base del video de donde salió (mismos cortes), que orchestrate guarda en vista_base */
        var cfgF = row.subtitle_config || {};
        if (cfgF.vista_base && Array.isArray(cfgF.vista_duraciones)) {
          cambiosFinales.video_sin_subtitulos = cfgF.vista_base;
          cambiosFinales.duraciones_reales = cfgF.vista_duraciones;
        }
      }
    }
    await patchRender(render_id, cambiosFinales);
    console.log('[Assembler] DONE render_id=' + render_id + (esMaster ? ' (MASTER)' : ''));

    // 7. Limpiar /tmp
    try {
      for (var fi = 0; fi < segPaths.length; fi++) { try { fs.unlinkSync(segPaths[fi]); } catch(e) {} }
      try { fs.unlinkSync(baseVideo); } catch(e) {}
      try { fs.unlinkSync(finalVideo); } catch(e) {}
      if (graphicsPath) { try { fs.unlinkSync(graphicsPath); } catch(e) {} }
      if (assPath) { try { fs.unlinkSync(assPath); } catch(e) {} }
      try { fs.unlinkSync(concatFile); } catch(e) {}
      ['voz_entrada.flac', 'voz_estudio.flac'].forEach(function (f) { try { fs.unlinkSync(path.join(workDir, f)); } catch (e) {} });   // v16
      try { fs.rmdirSync(workDir); } catch(e) {}
    } catch(cleanupErr) { console.log('[Assembler] Cleanup warning:', cleanupErr); }

    return { success: true, render_id: render_id, output_url: outputUrl };

  } catch(err) {
    console.error('[Assembler] ERROR:', err);
    try {
      await patchRender(render_id, {
        status: 'error',
        error_message: '[Assembler] ' + String(err).slice(0, 500),
      });
    } catch(e2) {}
    throw err;
  }
};

/* voz.js — LA VOZ DE ESTUDIO en el ensamblador (v16, 24-sep-2026)
 *
 * Sergio escuchó cuatro versiones de su voz y escogió «Estudio» (Auphonic «Studio Voice»: reconstruye la voz como si
 * fuera de estudio, lo más parecido a Adobe Podcast). Y propuso: «lo más conveniente sería pasarle el audio ya cortado».
 * Así va UNA producción por video: Auphonic cobra mínimo 3 min por producción, y mandar las 22 grabaciones del
 * proyecto 21 por separado habría costado 66 min.
 *
 * Cómo va:
 *   1. apenas está la base (la voz ya cortada y pegada), se saca su sonido y se manda a Auphonic MIENTRAS el
 *      ensamblador dibuja gráficos y subtítulos: la espera casi no se nota;
 *   2. al final, antes de los efectos de sonido, se cambia la voz del video por la de estudio, corrida lo que Auphonic
 *      la atrasa (medido en cada video; con Studio Voice son ~10 ms). La voz queda TAL CUAL la masteriza Auphonic
 *      (−13 LUFS); los EFECTOS se bajan (o suben) lo mismo que cambió la voz, así el balance que Sergio ajustó oyendo
 *      su voz original sigue igual. ⚠️ Probado: subir la voz de estudio hasta la original (+3 dB) obligaba al limitador
 *      a aplastar sus picos (−1,4 dB de cuerpo): se descartó.
 *
 * Se guarda por HUELLA del sonido (voz/estudio/<huella>): cambiar sonidos, gráficos, subtítulos o pantallas no cambia
 * la voz y no cuesta otra vez; cambiar los cortes sí.
 *
 * ⚠️ La llave de Auphonic NO baja a la Lambda: todo lo de Auphonic lo hace la función voz-estudio.
 * ⚠️ Si la cuenta de Auphonic es la gratis, Auphonic le pega su cortinilla (~6,4 s) y el audio sale más largo: esa voz
 *    NO se usa; el video sale con la voz normal y el render lo anota (voz_estudio.estado = 'cortinilla').
 * ⚠️ Si algo falla o tarda más de TOPE, el video sale con la voz normal. Nunca se cae un video por esto.
 */
var fs = require('fs');
var path = require('path');
var https = require('https');
var cryptoMod = require('crypto');
var childProcess = require('child_process');

var cfg = {};
function configurar(o) { cfg = o; }   // { ffmpegPath, runFFmpeg, duracionReal, s3Client, S3Mod, BUCKET, REGION, SUPABASE_URL, SUPABASE_KEY }

var CARPETA = 'voz/estudio/';
var TOPE_MS = 9 * 60 * 1000;          // lo más que se le espera a Auphonic (el video ya tardó lo suyo dibujándose)
var SONDEO_MS = 6000;
var OTRO_RENDER_MS = 15 * 60 * 1000;  // si otro video ya mandó ESTA voz hace menos de esto, se espera la suya
var CORTINILLA_MS = 15 * 60 * 1000;   // tras una cortinilla no se reintenta en este rato (gastaría crédito gratis en balde)
var EFECTOS_MIN = -8, EFECTOS_MAX = 6; // dB que se corren los efectos para seguir a la voz

function dormir(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* Dirección firmada (GET para que Auphonic la baje, PUT para que voz-estudio suba el resultado) */
function firmar(metodo, key, segundos) {
  var region = cfg.REGION || 'us-east-1';
  var accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  var secretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
  var sessionToken = process.env.AWS_SESSION_TOKEN || '';
  var iso = new Date().toISOString();
  var dia = iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  var amzDate = dia + 'T' + iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19) + 'Z';
  var host = cfg.BUCKET + '.s3.' + region + '.amazonaws.com';
  var clave = key.split('/').map(function (p) { return encodeURIComponent(p); }).join('/');
  var alcance = dia + '/' + region + '/s3/aws4_request';
  var ps = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', encodeURIComponent(accessKeyId + '/' + alcance)],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(segundos)],
  ];
  if (sessionToken) ps.push(['X-Amz-Security-Token', encodeURIComponent(sessionToken)]);
  ps.push(['X-Amz-SignedHeaders', 'host']);
  ps.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  var q = ps.map(function (p) { return p[0] + '=' + p[1]; }).join('&');
  var canon = metodo + '\n/' + clave + '\n' + q + '\nhost:' + host + '\n\nhost\nUNSIGNED-PAYLOAD';
  var aFirmar = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + alcance + '\n' + cryptoMod.createHash('sha256').update(canon).digest('hex');
  function hmac(k, d) { return cryptoMod.createHmac('sha256', k).update(d).digest(); }
  var kf = hmac(hmac(hmac(hmac('AWS4' + secretKey, dia), region), 's3'), 'aws4_request');
  return 'https://' + host + '/' + clave + '?' + q + '&X-Amz-Signature=' + cryptoMod.createHmac('sha256', kf).update(aFirmar).digest('hex');
}

/* La función voz-estudio (la única que tiene la llave de Auphonic) */
function llamar(datos) {
  return new Promise(function (resolve, reject) {
    var cuerpo = JSON.stringify(datos);
    var u = new URL(cfg.SUPABASE_URL + '/functions/v1/voz-estudio');
    var req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', timeout: 120000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo),
                 apikey: cfg.SUPABASE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_KEY } }, function (res) {
      var t = '';
      res.on('data', function (d) { t += d; });
      res.on('end', function () {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { /* no es JSON */ }
        if (res.statusCode >= 300 || !j) return reject(new Error('voz-estudio ' + res.statusCode + ': ' + t.slice(0, 200)));
        resolve(j);
      });
    });
    req.on('timeout', function () { req.destroy(new Error('voz-estudio no contestó')); });
    req.on('error', reject);
    req.end(cuerpo);
  });
}

async function leerJson(key) {
  try {
    var r = await cfg.s3Client.send(new cfg.S3Mod.GetObjectCommand({ Bucket: cfg.BUCKET, Key: key }));
    var partes = [];
    for await (var ch of r.Body) partes.push(ch);
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch (e) { return null; }
}
function escribirJson(key, o) {
  var b = Buffer.from(JSON.stringify(o));
  return cfg.s3Client.send(new cfg.S3Mod.PutObjectCommand({ Bucket: cfg.BUCKET, Key: key, Body: b, ContentLength: b.length, ContentType: 'application/json' }));
}
function subir(local, key) {
  return cfg.s3Client.send(new cfg.S3Mod.PutObjectCommand({ Bucket: cfg.BUCKET, Key: key, Body: fs.createReadStream(local),
    ContentLength: fs.statSync(local).size, ContentType: 'audio/flac' }));
}
async function bajar(key, local) {
  var r = await cfg.s3Client.send(new cfg.S3Mod.GetObjectCommand({ Bucket: cfg.BUCKET, Key: key }));
  await new Promise(function (resolve, reject) {
    var out = fs.createWriteStream(local);
    r.Body.pipe(out);
    r.Body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

/* El sonido crudo (mono, 8 kHz): para la huella y para medir el retardo */
function crudo(archivo, formato) {
  var r = childProcess.spawnSync(cfg.ffmpegPath, ['-v', 'error', '-i', archivo, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', formato, '-'],
    { maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) throw new Error('no se pudo leer el sonido de ' + path.basename(archivo));
  return r.stdout;
}
// (se copia: un Buffer de Node puede no empezar en múltiplo de 4 y Float32Array lo rechazaría)
function comoFloat(buf) { var n = Math.floor(buf.length / 4), ab = new ArrayBuffer(n * 4); new Uint8Array(ab).set(buf.subarray(0, n * 4)); return new Float32Array(ab); }

/* Cuánto atrasa Auphonic la voz: se comparan las envolventes (cada 2 ms) en 10 ventanas de 3 s, ±100 ms.
   Positivo = la de estudio llega tarde. Si no hay suficientes ventanas claras, 10 ms (lo medido con Studio Voice). */
function medirRetardo(entrada, salida) {
  var PASO = 16, V = 1500, L = 50;   // 16 muestras a 8 kHz = 2 ms; 3 s; ±100 ms
  function env(x) {
    var n = Math.floor(x.length / PASO), e = new Float64Array(n);
    for (var i = 0; i < n; i++) { var s = 0; for (var j = 0; j < PASO; j++) { var v = x[i * PASO + j]; s += v * v; } e[i] = Math.log(Math.sqrt(s / PASO) + 1e-6); }
    return e;
  }
  var ea = env(comoFloat(crudo(entrada, 'f32le'))), eb = env(comoFloat(crudo(salida, 'f32le')));
  var n = Math.min(ea.length, eb.length);
  if (n < V + 2 * L + 10) return { s: 0.010, fiable: false, ventanas: 0 };
  var lags = [];
  for (var k = 0; k < 10; k++) {
    var a0 = Math.floor(L + (n - V - 2 * L) * (k + 0.5) / 10);
    var ma = 0; for (var i = 0; i < V; i++) ma += ea[a0 + i]; ma /= V;
    var na = 0; for (i = 0; i < V; i++) na += (ea[a0 + i] - ma) * (ea[a0 + i] - ma);
    var mejor = null;
    for (var lag = -L; lag <= L; lag++) {
      var mb = 0; for (i = 0; i < V; i++) mb += eb[a0 + lag + i]; mb /= V;
      var d = 0, nb = 0;
      for (i = 0; i < V; i++) { var y = eb[a0 + lag + i] - mb; d += (ea[a0 + i] - ma) * y; nb += y * y; }
      var c = d / (Math.sqrt(na * nb) + 1e-9);
      if (!mejor || c > mejor.c) mejor = { c: c, lag: lag };
    }
    if (mejor && mejor.c > 0.5) lags.push(mejor.lag);
  }
  if (lags.length < 3) return { s: 0.010, fiable: false, ventanas: lags.length };
  lags.sort(function (a, b) { return a - b; });
  return { s: lags[Math.floor(lags.length / 2)] * PASO / 8000, fiable: true, ventanas: lags.length };
}

/* Volumen integrado (LUFS) */
function lufs(archivo) {
  var r = childProcess.spawnSync(cfg.ffmpegPath, ['-nostats', '-i', archivo, '-map', '0:a:0', '-af', 'ebur128', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  var t = String(r.stderr || ''), i = t.lastIndexOf('Summary:');
  var m = i >= 0 ? /I:\s*(-?[0-9.]+)\s*LUFS/.exec(t.slice(i)) : null;
  return m ? parseFloat(m[1]) : null;
}

/* 1 · Se arranca apenas está la base. Devuelve una promesa que NUNCA falla: {estado: 'lista'|'cortinilla'|'error'|'tarde', …} */
function preparar(baseVideo, workDir, renderId) {
  return prepararDeVerdad(baseVideo, workDir, renderId).catch(function (e) {
    console.log('[Voz] falló: ' + String(e && e.message || e).slice(0, 300));
    return { estado: 'error', detalle: String(e && e.message || e).slice(0, 200) };
  });
}
async function prepararDeVerdad(baseVideo, workDir, renderId) {
  var t0 = Date.now();
  var entrada = path.join(workDir, 'voz_entrada.flac'), salida = path.join(workDir, 'voz_estudio.flac');
  await cfg.runFFmpeg(['-i', baseVideo, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '44100', '-c:a', 'flac', entrada]);
  var dur = cfg.duracionReal(entrada) || 0;
  var huella = cryptoMod.createHash('sha256').update(crudo(entrada, 's16le')).digest('hex').slice(0, 32);
  var kJ = CARPETA + huella + '.json', kSal = CARPETA + huella + '.flac', kEnt = CARPETA + huella + '_entrada.flac';
  var info = await leerJson(kJ);
  console.log('[Voz] huella ' + huella + ' (' + dur.toFixed(2) + ' s): ' + (info ? info.estado : 'nueva'));

  if (info && info.estado === 'lista') {
    await bajar(kSal, salida);
    if (info.retardo != null && info.lufs_original != null && info.lufs_estudio != null)
      return { estado: 'lista', archivo: salida, retardo: info.retardo, efectosDb: efectosDe(info.lufs_original, info.lufs_estudio), huella: huella, reutilizada: true };
    return await medirYGuardar(entrada, salida, kJ, info, huella, t0, true);   // una guardada sin medidas: se mide ahora
  }
  if (info && info.estado === 'cortinilla' && Date.now() - info.creado < CORTINILLA_MS)
    return { estado: 'cortinilla', huella: huella, reutilizada: true };

  var uuid, creado;
  if (info && info.estado === 'procesando' && Date.now() - info.creado < OTRO_RENDER_MS) {
    uuid = info.uuid; creado = info.creado;      // otro video ya la mandó: se espera esa, no se paga dos veces
    console.log('[Voz] otro video ya la mandó (' + uuid + '): se espera esa');
  } else {
    await subir(entrada, kEnt);
    var r = await llamar({ accion: 'crear', modo: 'estudio', formato: 'flac', url: firmar('GET', kEnt, 6 * 3600),
                           titulo: 'Cherry · ' + String(renderId).slice(0, 8) });
    if (!r.uuid) throw new Error('Auphonic no dio número: ' + JSON.stringify(r).slice(0, 160));
    uuid = r.uuid; creado = Date.now();
    await escribirJson(kJ, { estado: 'procesando', uuid: uuid, creado: creado, dur: dur });
    console.log('[Voz] mandada a Auphonic: ' + uuid);
  }

  var put = firmar('PUT', kSal, 3600), listo = false;
  while (Date.now() - t0 < TOPE_MS) {
    await dormir(SONDEO_MS);
    var e;
    try { e = await llamar({ accion: 'estado', uuid: uuid, dur: dur, subir: put }); }
    catch (eL) { console.log('[Voz] sondeo: ' + String(eL.message).slice(0, 160)); continue; }
    if (e.cortinilla) {
      await escribirJson(kJ, { estado: 'cortinilla', uuid: uuid, creado: Date.now(), dur: dur, largo: e.largo });
      return { estado: 'cortinilla', huella: huella, detalle: 'Auphonic devolvió ' + Number(e.largo).toFixed(1) + ' s para ' + dur.toFixed(1) + ' s' };
    }
    if (e.error) {
      await escribirJson(kJ, { estado: 'error', uuid: uuid, creado: Date.now(), dur: dur, error: String(e.error).slice(0, 200) });
      return { estado: 'error', huella: huella, detalle: String(e.error).slice(0, 200) };
    }
    if (e.listo) { listo = true; break; }
  }
  if (!listo) return { estado: 'tarde', huella: huella, detalle: 'Auphonic no terminó en ' + Math.round(TOPE_MS / 60000) + ' min' };

  await bajar(kSal, salida);
  return await medirYGuardar(entrada, salida, kJ, { uuid: uuid, creado: creado, dur: dur }, huella, t0, false);
}

/* Cuánto se corren los efectos: lo mismo que cambió la voz (estudio − original) */
function efectosDe(li, lo) { return (li != null && lo != null) ? Math.max(EFECTOS_MIN, Math.min(EFECTOS_MAX, lo - li)) : 0; }

/* La voz de estudio ya está en disco: se revisa su largo, se mide cuánto la atrasó Auphonic y qué tan fuerte quedó */
async function medirYGuardar(entrada, salida, kJ, info, huella, t0, reutilizada) {
  var dur = cfg.duracionReal(entrada) || 0, largo = cfg.duracionReal(salida) || 0;
  if (dur && Math.abs(largo - dur) > 0.5) {   // la última defensa: nunca se pega una voz de otro largo
    await escribirJson(kJ, { estado: 'error', uuid: info.uuid, creado: Date.now(), dur: dur, error: 'largo ' + largo.toFixed(2) + ' s' });
    return { estado: 'error', huella: huella, detalle: 'la voz volvió de ' + largo.toFixed(2) + ' s y entró de ' + dur.toFixed(2) + ' s' };
  }
  var ret = medirRetardo(entrada, salida);
  var li = lufs(entrada), lo = lufs(salida), ef = efectosDe(li, lo);
  await escribirJson(kJ, { estado: 'lista', uuid: info.uuid || null, creado: info.creado || Date.now(), dur: dur, retardo: ret.s,
                           retardo_fiable: ret.fiable, ventanas: ret.ventanas, lufs_original: li, lufs_estudio: lo });
  console.log('[Voz] lista en ' + Math.round((Date.now() - t0) / 1000) + ' s | retardo ' + Math.round(ret.s * 1000) + ' ms (' +
    ret.ventanas + ' ventanas) | original ' + li + ' LUFS, estudio ' + lo + ' LUFS → efectos ' + ef.toFixed(1) + ' dB');
  return { estado: 'lista', archivo: salida, retardo: ret.s, efectosDb: ef, huella: huella, reutilizada: reutilizada };
}

/* 2 · Cambia la voz del video por la de estudio (la imagen no se toca). La voz va tal cual la dejó Auphonic.
   ⚠️ El atraso se quita saltando la entrada (-ss): con atrim=start= el ffmpeg de 2018 de la Lambda NO la corría
   (medido: 0 ms en vez de 10; en local sí). */
async function aplicar(video, voz, workDir, bitrate) {
  var r = Number(voz.retardo) || 0;
  var f = '[1:a]' + (r < 0 ? 'adelay=' + Math.round(-r * 1000) + ',' : '') +
    'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,pan=stereo|c0=c0|c1=c0,apad[a]';
  var tmp = video.replace(/\.mp4$/, '_voz.mp4');
  await cfg.runFFmpeg(['-i', video].concat(r > 0 ? ['-ss', r.toFixed(4)] : [], ['-i', voz.archivo, '-filter_complex', f,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', bitrate || '192k', '-shortest', '-movflags', '+faststart', tmp]));
  fs.renameSync(tmp, video);
}

/* 3 · (7-oct) Sergio: «si ya está procesada, ¿para qué procesar de nuevo?». La voz de estudio de la VISTA PREVIA (sacada
   de la base liviana) se acomoda a la línea de tiempo del MASTER: mismos cortes, otras duraciones reales (otro cuadro por
   segundo, otro redondeo). Cada corte se toma de la voz procesada (ya sin el atraso de Auphonic) y se deja del largo que
   tiene en el master: si le falta, silencio al final; si le sobra, se recorta. Cortes por -ss/-t a la entrada (exacto en
   cualquier ffmpeg; con atrim=start= el de 2018 de la Lambda no corría, ver aplicar). Devuelve el archivo, con retardo 0. */
async function acomodar(archivo, retardo, dursV, dursM, dir) {
  if (!Array.isArray(dursV) || !Array.isArray(dursM) || !dursV.length || dursV.length !== dursM.length) throw new Error('cortes distintos');
  var ret = Number(retardo) || 0, ini = 0, lineas = [], total = 0;
  for (var i = 0; i < dursV.length; i++) {
    var d = Number(dursV[i]), m = Number(dursM[i]);
    if (!(d > 0) || !(m > 0)) throw new Error('duración rara en el corte ' + (i + 1));
    var desde = ini + ret, antes = desde < 0 ? -desde : 0, seg = path.join(dir, 'corte_' + i + '.flac');
    await cfg.runFFmpeg(['-y', '-ss', Math.max(0, desde).toFixed(5), '-t', Math.max(0.001, d - antes).toFixed(5), '-i', archivo,
      '-af', (antes ? 'adelay=' + Math.round(antes * 1000) + ',' : '') + 'apad', '-t', m.toFixed(5),
      '-ar', '44100', '-ac', '1', '-c:a', 'flac', seg]);
    lineas.push("file '" + seg.replace(/\\/g, '/').replace(/'/g, "'\\''") + "'");
    ini += d; total += m;
  }
  var lista = path.join(dir, 'cortes_voz.txt'), salida = path.join(dir, 'voz_master.flac');
  fs.writeFileSync(lista, lineas.join('\n'));
  await cfg.runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c:a', 'flac', salida]);
  var largo = cfg.duracionReal(salida) || 0;
  if (Math.abs(largo - total) > 0.25) throw new Error('la voz acomodada dura ' + largo.toFixed(2) + ' s y el video ' + total.toFixed(2) + ' s');
  for (var k = 0; k < dursV.length; k++) { try { fs.unlinkSync(path.join(dir, 'corte_' + k + '.flac')); } catch (e) {} }
  return salida;
}

/* 4 · (8-oct) LAS TOMAS HECHAS A MANO (editor Manual). Recortar, partir o duplicar tomas hace una base nueva con otro
   sonido (otra huella): sin esto, cada recorte volvía a pasar por Auphonic. Su voz de estudio sale de la de la base de
   donde vienen las tomas (ya procesada): cada tramo (segundos de esa base) del largo real que tiene en la nueva. Se guarda
   con la huella de la base nueva, así la vista previa y el master la encuentran hecha (preparar › reutilizada).
   Devuelve null si la de la otra base no está lista (entonces se hace como siempre). */
async function desdeOtra(baseVideo, workDir, huellaFuente, tramos, dursM) {
  if (!huellaFuente || !Array.isArray(tramos) || !Array.isArray(dursM) || !tramos.length || tramos.length !== dursM.length) return null;
  var infoF = await leerJson(CARPETA + huellaFuente + '.json');
  if (!infoF || infoF.estado !== 'lista') return null;
  var entrada = path.join(workDir, 'voz_entrada_mano.flac');
  await cfg.runFFmpeg(['-y', '-i', baseVideo, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '44100', '-c:a', 'flac', entrada]);
  var dur = cfg.duracionReal(entrada) || 0;
  var huella = cryptoMod.createHash('sha256').update(crudo(entrada, 's16le')).digest('hex').slice(0, 32);
  var kJ = CARPETA + huella + '.json';
  var ya = await leerJson(kJ);
  if (ya && ya.estado === 'lista') return { estado: 'lista', huella: huella, reutilizada: true };
  var fuente = path.join(workDir, 'voz_fuente_mano.flac');
  await bajar(CARPETA + huellaFuente + '.flac', fuente);
  var ret = Number(infoF.retardo) || 0, lineas = [], total = 0;
  for (var i = 0; i < tramos.length; i++) {
    var d = Number(tramos[i][1]) - Number(tramos[i][0]), m = Number(dursM[i]);
    if (!(d > 0) || !(m > 0)) throw new Error('tramo raro: ' + (i + 1));
    var desde = Number(tramos[i][0]) + ret, antes = desde < 0 ? -desde : 0, seg = path.join(workDir, 'mano_' + i + '.flac');
    await cfg.runFFmpeg(['-y', '-ss', Math.max(0, desde).toFixed(5), '-t', Math.max(0.001, d - antes).toFixed(5), '-i', fuente,
      '-af', (antes ? 'adelay=' + Math.round(antes * 1000) + ',' : '') + 'apad', '-t', m.toFixed(5),
      '-ar', '44100', '-ac', '1', '-c:a', 'flac', seg]);
    lineas.push("file '" + seg.replace(/\\/g, '/').replace(/'/g, "'\\''") + "'");
    total += m;
  }
  var lista = path.join(workDir, 'mano_voz.txt'), salida = path.join(workDir, 'voz_mano.flac');
  fs.writeFileSync(lista, lineas.join('\n'));
  await cfg.runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c:a', 'flac', salida]);
  var largo = cfg.duracionReal(salida) || 0;
  if (dur && Math.abs(largo - dur) > 0.5) throw new Error('la voz de las tomas dura ' + largo.toFixed(2) + ' s y la base ' + dur.toFixed(2) + ' s');
  for (var k = 0; k < tramos.length; k++) { try { fs.unlinkSync(path.join(workDir, 'mano_' + k + '.flac')); } catch (e) {} }
  await subir(salida, CARPETA + huella + '.flac');
  await escribirJson(kJ, { estado: 'lista', creado: Date.now(), dur: dur, retardo: 0, retardo_fiable: true, ventanas: 0,
                           lufs_original: infoF.lufs_original, lufs_estudio: infoF.lufs_estudio, desde: huellaFuente });
  console.log('[Voz] la de las tomas a mano sale de ' + huellaFuente.slice(0, 8) + ' (' + tramos.length + ' tramos, sin Auphonic)');
  return { estado: 'lista', huella: huella, reutilizada: true };
}

module.exports = { configurar: configurar, preparar: preparar, aplicar: aplicar, acomodar: acomodar, desdeOtra: desdeOtra, _medirRetardo: medirRetardo, _lufs: lufs, _firmar: firmar };

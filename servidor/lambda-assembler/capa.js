/* capa.js — la CAPA de cada GRÁFICO en el video final (19-sep-2026).
 *
 * graficos.js (el MISMO archivo de la página) dibuja cada cuadro en un canvas de @napi-rs/canvas; aquí se guarda como un
 * video corto con transparencia (ffv1, bgra) que el ensamblador pone encima con overlay, después del color (los colores de
 * la marca no se tiñen con el look) y antes de los subtítulos (que quedan encima). En pantalla partida y completa, además,
 * el video se encoge con perspective justo mientras dura el gráfico.
 * Si el canvas no carga o una capa falla, ese gráfico no sale y el video sigue.
 */
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var GRAF = require('./graficos.js');

var lienzo = null, errorLienzo = null;
try { lienzo = require('@napi-rs/canvas'); } catch (e) { errorLienzo = e.message; }

// archivo de fonts/ en S3 → nombre de la familia que usa graficos.js
var FAMILIAS = {
  'Outfit-Black.ttf': 'Outfit', 'Outfit-Bold.ttf': 'Outfit', 'DMMono-Medium.ttf': 'DM Mono',
  'InstrumentSerif-Italic.ttf': 'Instrument Serif', 'PlayfairDisplay-BlackItalic.ttf': 'Playfair Display',
};
var registradas = {};
function registrarFuentes(dir) {
  if (!lienzo || !dir) return 0;
  var n = 0;
  Object.keys(FAMILIAS).forEach(function (f) {
    var p = path.join(dir, f);
    if (registradas[p] || !fs.existsSync(p)) return;
    try { lienzo.GlobalFonts.registerFromPath(p, FAMILIAS[f]); registradas[p] = true; n++; } catch (e) { console.log('[Gráficos] letra ' + f + ': ' + e.message); }
  });
  return n;
}
function disponible() { return !!lienzo; }
function porQueNo() { return errorLienzo; }

function rutaFiltro(p) { return p.replace(/\\/g, '/').replace(/:/g, '\\:'); }

/* Una capa: los cuadros n0..n1-1 de la rejilla del video completo (cuadro n = instante n / fps).
   o: {W, H, fps, color, salida, ffmpegPath}. Devuelve {p, local, x, y, t (instante del primer cuadro), cuadros}. */
function renderizar(p, o) {
  return new Promise(function (resolve, reject) {
    var c = GRAF.caja(p, o.W, o.H);
    var cv = lienzo.createCanvas(c.w, c.h), ctx = cv.getContext('2d');
    var n0 = Math.ceil(p.t0 * o.fps - 1e-6), n1 = Math.ceil(p.t1 * o.fps - 1e-6);
    var ff = childProcess.spawn(o.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', c.w + 'x' + c.h, '-r', String(o.fps), '-i', 'pipe:0',
      '-c:v', 'ffv1', '-level', '3', '-slices', '4', '-pix_fmt', 'bgra', o.salida], { stdio: ['pipe', 'ignore', 'pipe'] });
    var err = '';
    ff.stderr.on('data', function (d) { err += d; });
    ff.stdin.on('error', function () {});
    ff.on('error', reject);
    ff.on('close', function (code) {
      if (code === 0) resolve({ p: p, local: o.salida, x: c.x, y: c.y, t: n0 / o.fps, cuadros: n1 - n0 });
      else reject(new Error('ffmpeg de la capa terminó en ' + code + ': ' + err.slice(-300)));
    });
    (async function () {
      for (var n = n0; n < n1; n++) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.w, c.h);
        ctx.translate(-c.x, -c.y);
        GRAF.dibujar(ctx, o.W, o.H, p, n / o.fps, o.color);
        var d = ctx.getImageData(0, 0, c.w, c.h).data;
        if (!ff.stdin.write(Buffer.from(d.buffer, d.byteOffset, d.byteLength))) await new Promise(function (r) { ff.stdin.once('drain', r); });
      }
      ff.stdin.end();
    })().catch(function (e) { try { ff.kill(); } catch (_) {} reject(e); });
  });
}

/* Todas las capas de estas piezas (de a dos a la vez: la Lambda tiene 2 procesadores). Las que fallan quedan fuera. */
async function renderizarTodas(piezas, o) {
  if (!lienzo || !piezas || !piezas.length) return [];
  registrarFuentes(o.fontsDir);
  var out = [], cola = piezas.slice(), t0 = Date.now();
  async function trabajador() {
    while (cola.length) {
      var p = cola.shift(), i = piezas.indexOf(p);
      try {
        out.push(await renderizar(p, { W: o.W, H: o.H, fps: o.fps, color: o.color, ffmpegPath: o.ffmpegPath, salida: path.join(o.dir, 'grafico_' + i + '.mkv') }));
      } catch (e) { console.log('[Gráficos] la capa ' + i + ' (' + p.tipo + ') falló, se sigue sin ella: ' + String(e.message || e).slice(0, 300)); }
    }
  }
  await Promise.all([trabajador(), trabajador()]);
  console.log('[Gráficos] ' + out.length + ' capas en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s (' +
    out.reduce(function (a, c) { return a + c.cuadros; }, 0) + ' cuadros)');
  return out.sort(function (a, b) { return a.p.t0 - b.p.t0; });
}

/* Filtros: primero el encogimiento del video (partida / completa, UNA vez por gráfico) y luego cada capa encima, solo en
   su ventana. Las capas premium con `vidrio` además desenfocan el video que queda debajo (su transparencia es la máscara).
   c0 = primer cuadro del pedazo en la rejilla del video completo (0 en la pasada única). */
var COMILLA = String.fromCharCode(39);
/* Las capas que vienen en WebM (premium) se leen como entradas del propio ffmpeg, con el decodificador que entiende la
   transparencia (libvpx) y corridas al instante en que empiezan. Así no hay que convertirlas antes. */
function entradas(capas, desde) {
  var args = [], n = desde == null ? 1 : desde;
  (capas || []).forEach(function (c) {
    if (!c.webm) return;
    c.entrada = n++;
    args = args.concat(['-c:v', c.vp8 ? 'libvpx' : 'libvpx-vp9', '-itsoffset', c.t.toFixed(4), '-i', c.local]);
  });
  return args;
}
/* (24-sep) `pref`: prefijo de las etiquetas. Dos llamadas en el mismo trozo repetian [gc0], [go0]... */
function filtros(capas, entrada, W, H, fps, c0, pref) {
  var f = [], actual = entrada, hechas = {};
  var q = pref || '';
  (capas || []).forEach(function (c) {
    var llave = c.p.t0 + '_' + c.p.tipo;
    if (hechas[llave]) return;
    hechas[llave] = 1;
    var fv = GRAF.ffmpeg(c.p, W, H, fps, c0);
    if (fv) { f.push(actual + fv + '[' + q + 'gv' + Object.keys(hechas).length + ']'); actual = '[' + q + 'gv' + Object.keys(hechas).length + ']'; }
  });
  (capas || []).forEach(function (c, i) {
    var t0 = c.t, t1 = c.p.t1, ventana = "enable='between(t," + c.p.t0.toFixed(4) + ',' + (t1 - 0.001).toFixed(4) + ")'";
    var caja = GRAF.cajaPremium(c.p, W, H), cw = Math.round(caja.w / 2) * 2, ch = Math.round(caja.h / 2) * 2;
    var escala = c.escala ? ',scale=' + c.escala + ':flags=bicubic' : '';
    var gc = '[' + q + 'gc' + i + ']', gm = '[' + q + 'gm' + i + ']';
    if (c.entrada != null) f.push('[' + c.entrada + ':v]setpts=PTS-STARTPTS+' + t0.toFixed(4) + '/TB' + escala + ',split' + gc + gm);
    else f.push("movie='" + rutaFiltro(c.local) + "',setpts=PTS-STARTPTS+" + t0.toFixed(4) + '/TB' + escala + ',split' + gc + gm);
    if (c.vidrio) {
      // el vidrio: una copia del video, recortada a la ventana del gráfico, desenfocada y recortada con la transparencia de la capa
      var e = function (x) { return '[' + q + x + i + ']'; };
      f.push(actual + 'split' + e('gb') + e('gd'));
      f.push(e('gd') + 'trim=start=' + t0.toFixed(4) + ':end=' + t1.toFixed(4) + ',setpts=PTS-STARTPTS,crop=' + cw + ':' + ch + ':0:0,boxblur=24:3,eq=saturation=1.4:brightness=-0.05' + e('gl'));
      f.push(gm + 'setpts=PTS-STARTPTS,alphaextract,lut=y=' + COMILLA + 'min(255,val*1.7)' + COMILLA + e('gk'));
      f.push(e('gl') + e('gk') + 'alphamerge,setpts=PTS+' + t0.toFixed(4) + '/TB' + e('gx'));
      f.push(e('gb') + e('gx') + 'overlay=x=' + c.x + ':y=' + c.y + ':eof_action=pass:' + ventana + e('gz'));
      actual = e('gz');
    } else {
      f.push(gm + 'nullsink');
    }
    f.push(actual + gc + 'overlay=x=' + c.x + ':y=' + c.y + ':eof_action=pass:' + ventana + '[' + q + 'go' + i + ']');
    actual = '[' + q + 'go' + i + ']';
  });
  return { filtros: f, salida: actual };
}

module.exports = { disponible: disponible, porQueNo: porQueNo, registrarFuentes: registrarFuentes, renderizar: renderizar,
                   renderizarTodas: renderizarTodas, filtros: filtros, entradas: entradas, FAMILIAS: FAMILIAS };

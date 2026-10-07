/* edicion.js — la CAPA DE EDICIÓN (30-sep-2026).
 *
 * Sergio: «necesito que el video lo dejes en Cherry con todos los gráficos pero que yo pueda colorizar solamente el video
 * sin que se coloricen los gráficos… y cambiarle la plantilla de subtítulos… que se mantengan los sonidos, los gráficos,
 * todo, y yo desde Cherry poder terminarlo».
 *
 * Un proyecto puede traer una edición hecha a mano (tabla `ediciones`): capas de Remotion ya dibujadas (WebM con
 * transparencia, en el bucket) con sus tiempos en el reloj del video. El ensamblador las monta como si fueran gráficos
 * premium, DESPUÉS del color y del movimiento y ANTES de los subtítulos:
 *   · forma 'capa'      → encima del video.
 *   · forma 'dividida'  → encima, y mientras dura el video se encoge a su tarjeta (MUEVE.dividida de graficos.js).
 *   · forma 'profundo'  → detrás de la persona: va sobre el fondo y la persona (su silueta) queda delante.
 * Con una edición, los gráficos de la IA, las pantallas y las escenas de apoyo no van (la edición manda), la cámara
 * se queda quieta donde la edición lo pide y los subtítulos se corren o se callan en sus ventanas. El color, la
 * plantilla de subtítulos, la voz y los sonidos siguen siendo los del proyecto.
 * Si los cortes del video cambiaron, la edición NO se usa (los gráficos quedarían corridos) y el log lo dice.
 */
'use strict';

var TOL_CORTE = 0.05;      // segundos de diferencia que se toleran en un corte

async function cargar(dbRequest, proyecto) {
  if (!proyecto) return null;
  try {
    var filas = await dbRequest('GET', '/rest/v1/ediciones?project_id=eq.' + proyecto + '&activa=eq.true&order=creado.desc&limit=1&select=*');
    return Array.isArray(filas) && filas[0] ? filas[0] : null;
  } catch (e) { console.log('[Edicion] no se pudo leer: ' + String(e && e.message || e).slice(0, 200)); return null; }
}

/* ¿Los cortes del video son los mismos con los que se hizo la edición? */
function mismosCortes(ed, cortesJson) {
  var a = ed && Array.isArray(ed.cortes) ? ed.cortes : null;
  var b = cortesJson && Array.isArray(cortesJson.cuts) ? cortesJson.cuts : null;
  if (!a) return { ok: true, porque: 'la edición no guarda cortes' };
  if (!b) return { ok: false, porque: 'el video no trae cortes' };
  if (a.length !== b.length) return { ok: false, porque: a.length + ' cortes en la edición y ' + b.length + ' en el video' };
  for (var i = 0; i < a.length; i++) {
    var x = a[i], y = b[i];
    if (String(x[0]) !== String(y.clipId) || Math.abs(Number(x[1]) - Number(y.startTime)) > TOL_CORTE || Math.abs(Number(x[2]) - Number(y.endTime)) > TOL_CORTE) {
      return { ok: false, porque: 'el corte ' + (i + 1) + ' cambió' };
    }
  }
  return { ok: true, porque: 'mismos cortes' };
}

/* Las piezas y los trabajos «premium» (las capas ya hechas), en el formato que entienden pedazos.js y capa.js */
function preparar(ed, fps) {
  fps = Number(fps) || 30;
  var ancho = Number(ed.ancho) || 1080;
  var capas = (Array.isArray(ed.capas) ? ed.capas : []).filter(function (c) {
    return c && /^ediciones\//.test(String(c.key || '')) && Number(c.t1) > Number(c.t0) && ['capa', 'dividida', 'profundo'].indexOf(c.forma) >= 0;
  });
  var piezas = [], premium = [], siluetas = [];
  capas.forEach(function (c, i) {
    var p = { t0: Number(c.t0), t1: Number(c.t1), tipo: 'edicion', forma: c.forma, datos: {}, edicion: true };
    var n0 = Math.ceil(p.t0 * fps - 1e-6), n1 = Math.ceil(p.t1 * fps - 1e-6);
    piezas.push(p);
    premium.push({ i: 900 + i, p: p, parte: c.forma === 'profundo' ? 'atras' : 'todo', ancho: ancho, vidrio: false,
                   n0: n0, cuadros: n1 - n0, keyRemotion: c.key, completo: true,
                   t: n0 / fps });   // (30-sep) su hora en SEGUNDOS: el máster va a 60 y n0 está contado a 30
    if (c.forma === 'profundo' && ed.silueta_key) siluetas.push({ t0: p.t0, t1: p.t1, desde: 0, key: ed.silueta_key });
  });
  var quieto = (Array.isArray(ed.quieto) ? ed.quieto : []).map(function (v) { return { t0: Number(v.t0), t1: Number(v.t1) }; })
    .concat(piezas.filter(function (p) { return p.forma !== 'capa'; }).map(function (p) { return { t0: p.t0 - 0.1, t1: p.t1 + 0.1 }; }));
  var subs = (Array.isArray(ed.subtitulos) ? ed.subtitulos : []).filter(function (v) { return v && ['tarjeta', 'abajo', 'oculto'].indexOf(v.modo) >= 0; })
    .map(function (v) { return { t0: Number(v.t0), t1: Number(v.t1), modo: v.modo }; });
  return { piezas: piezas, premium: premium, siluetas: siluetas, quieto: quieto, subtitulos: subs };
}

/* Los subtítulos en las ventanas de la edición: 'tarjeta' = dentro de la tarjeta del video (abajo), 'abajo' = los que
   estaban arriba (donde van los gráficos) bajan. Cada FRASE (las líneas que se van a la vez) se mueve entera: posiciones,
   tamaños y recortes, como subirSubtitulos del ensamblador. 'oculto' lo hace callarAss (pedazos.js). */
function moverSubtitulos(ass, ventanas) {
  if (!ass || !ventanas || !ventanas.length) return { ass: ass, movidas: 0 };
  var PRX = Number((/PlayResX:\s*(\d+)/.exec(ass) || [])[1]) || 1080;
  var PRY = Number((/PlayResY:\s*(\d+)/.exec(ass) || [])[1]) || 1920;
  var FS0 = Number((/^Style:\s*Default,[^,]*,([\d.]+)/m.exec(ass) || [])[1]) || 60;
  var CX = PRX / 2;
  var TARJETA = { s: 0.935, ox: 35.1 / 1080, oy: 671.45 / 1920, borde: 980 / 1920 };   // = MUEVE.dividida y el hueco de la capa
  var BANDAS = { tarjeta: { a: 0.865, b: 0.955, kmax: 0.85, siempre: true }, abajo: { a: 0.64, b: 0.64, kmax: 1, siempre: false, entera: true } };
  var leer = function (s) { var p = s.split(':'); return +p[0] * 3600 + +p[1] * 60 + parseFloat(p[2]); };
  var lineas = ass.split('\n'), movidas = 0;
  function transformar(l, K, dy0, top, cx0) {
    var X = function (x) { return ((cx0 != null ? cx0 : CX) + (Number(x) - CX) * K).toFixed(1); };
    var Y = function (y) { return (dy0 + (Number(y) - top) * K).toFixed(1); };
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
    var B = BANDAS[v.modo];
    if (!B) return;
    var frases = {};
    lineas.forEach(function (l, i) {
      var m = /^Dialogue:\s*\d+,(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),/.exec(l);
      if (!m) return;
      var t = leer(m[1]);
      // (30-sep) las frases de impacto ahora entran hasta ~0,5 s antes: cuenta la que empieza justo antes del tramo
      if (t < v.t0 - (B.entera ? 0.6 : 0.05) || t >= v.t1 - 0.05) return;
      var mm = /\\move\(\s*[-\d.]+\s*,\s*([-\d.]+)/.exec(l) || /\\pos\(\s*[-\d.]+\s*,\s*([-\d.]+)/.exec(l);
      if (!mm) return;
      var y = Number(mm[1]);
      var fs = Number((/\\fs([\d.]+)/.exec(l) || [])[1]) || FS0;
      var an = Number((/\\an(\d)/.exec(l) || [])[1]) || 8;
      var arriba = an >= 7 ? y : an >= 4 ? y - fs / 2 : y - fs;
      var f = frases[m[2]] || (frases[m[2]] = { top: Infinity, pie: -Infinity, idx: [] });
      f.top = Math.min(f.top, arriba); f.pie = Math.max(f.pie, arriba + fs); f.idx.push(i);
    });
    Object.keys(frases).forEach(function (k) {
      var f = frases[k];
      if (!B.siempre && f.top >= (B.entera ? 0.33 : 0.6) * PRY) return;   // 'abajo': solo las que siguen arriba (la que se movió se respeta)
      /* (30-sep) en la pantalla dividida, los TÍTULOS (los que van arriba, sobre la cabeza) viajan con tu video: mismo
         encogido y corrimiento que la tarjeta (graficos.js MUEVE.dividida), así quedan sobre tu cabeza dentro de ella y
         «Mover título» sigue sirviendo. Si caen en la parte del video que tapa el panel, bajan al borde de la tarjeta. */
      if (v.modo === 'tarjeta' && f.top < 0.45 * PRY) {
        var Kt = TARJETA.s, yT = TARJETA.oy * PRY + f.top * Kt;
        var dyT = Math.max(yT, TARJETA.borde * PRY + 0.012 * PRY);
        dyT = Math.min(dyT, 0.955 * PRY - (f.pie - f.top) * Kt);
        f.idx.forEach(function (i) { lineas[i] = transformar(lineas[i], Kt, dyT, f.top, TARJETA.ox * PRX + CX * Kt); });
        movidas += f.idx.length;
        return;
      }
      var alto = Math.max(1, f.pie - f.top), banda = (B.b - B.a) * PRY;
      // (30-sep) 'abajo' la baja ENTERA, a su tamaño: antes la encogía para meterla en una franja y quedaba diminuta
      var K = B.entera ? 1 : Math.min(B.kmax, banda / alto);
      var dy0 = B.entera ? B.a * PRY : B.a * PRY + (banda - alto * K) / 2;
      f.idx.forEach(function (i) { lineas[i] = transformar(lineas[i], K, dy0, f.top); });
      movidas += f.idx.length;
    });
  });
  return { ass: lineas.join('\n'), movidas: movidas };
}

module.exports = { cargar: cargar, mismosCortes: mismosCortes, preparar: preparar, moverSubtitulos: moverSubtitulos };

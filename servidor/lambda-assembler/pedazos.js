/* PEDAZOS — la pasada final en paralelo (18-sep-2026). v9 (19-sep): cada pedazo dibuja las capas de SUS gráficos.
 *
 * Antes UNA Lambda hacía todo el video en fila: con el color, un video de 81 s tardaba
 * ~4 min en la pasada final (2 núcleos). Ahora el ensamblador parte el video en hasta
 * 6 pedazos, se llama a sí mismo en modo «pedazo» para cada uno (él mismo hace el
 * primero mientras espera), y al final los pega SIN recomprimir y les pone el audio.
 * Es lo que hace Remotion Lambda. El trabajo total es el mismo, solo que a la vez.
 *
 * Cada pedazo trabaja con los TIEMPOS ORIGINALES del video (-copyts): los subtítulos
 * tienen animaciones que dependen del inicio de cada frase, y una frase que cruza el
 * límite entre dos pedazos tiene que animarse igual que en la pasada única.
 *
 * La cuenta de AWS permite 10 Lambdas a la vez: si AWS rechaza un pedazo, lo hace el
 * coordinador; si algo sale mal del todo, se vuelve a la pasada única de siempre.
 */
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

/* 20-sep: con 6 pedazos de 14 s, un video de 72 s tardaba 126 s en la pasada final — casi la mitad del
   total. Se paga por segundo de cómputo, no por máquina, así que repartir en más trozos no cuesta más:
   solo hace falta que cada uno siga siendo lo bastante grande para que el trabajo fijo (bajar la base,
   las letras y las capas) no se coma la ganancia. */
var MAX_PEDAZOS = 10;
var SEG_POR_PEDAZO = 8;
/* (24-sep) 20 → 4: la pasada única monta mal las capas con transparencia (hueco negro, brillo sólido) y no
   sabe poner nada detrás de la persona. Por pedazos va bien y un video corto son 2 pedazos. */
var MIN_DURACION = 4;            // videos más cortos: pasada única
/* v10 (24-sep): el MASTER. A 4K60 cada cuadro cuesta 8 veces el de 1080p30, así que la base grande se
   parte en más pedazos y más cortos, se espera más por cada uno, y la pasada única solo para videos
   muy cortos. `factor` = píxeles·cuadros respecto a 1080p30. La cuenta permite 1000 Lambdas a la vez. */
function factorDe(info) { return Math.max(1, (info.w * info.h * (info.fps || 30)) / (1080 * 1920 * 30)); }
function ajustesPara(info, esMaster) {
  if (!esMaster) return { max: MAX_PEDAZOS, seg: SEG_POR_PEDAZO, min: MIN_DURACION, espera: ESPERA_MAX_MS };
  var f = factorDe(info);
  return { max: Math.min(40, Math.ceil(MAX_PEDAZOS * Math.min(4, f))), seg: Math.max(3, SEG_POR_PEDAZO / f), min: 6,
           espera: Math.min(720000, Math.round(ESPERA_MAX_MS * Math.max(1, f / 2))) };
}
/* Un pedazo tarda ~2 min. Esperar 10 era absurdo y además mataba el render entero: la Lambda que
   coordina vive 15 min, así que esperar 10 y luego rehacerlo (2 min más) no cabía. Con 3 basta. */
var ESPERA_MAX_MS = 180000;

var ctx = null;
/* El ensamblador le pasa sus herramientas (ffmpeg, S3, letras, color) para no duplicarlas */
function configurar(c) { ctx = c; }

function rutaFiltro(p) { return p.replace(/\\/g, '/').replace(/:/g, '\\:'); }

/* Duración, cuadros por segundo nominales (tbr) e inicio del archivo, leídos de ffmpeg -i */
function infoVideo(file) {
  var r = childProcess.spawnSync(ctx.ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  var t = r.stderr || '';
  var d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(t);
  var wh = /Video:.*?, (\d{2,5})x(\d{2,5})[,\s]/.exec(t);
  var s = /start:\s*(-?\d+(?:\.\d+)?)/.exec(t);
  var f = /Video:.*?(\d+(?:\.\d+)?)\s*tbr/.exec(t) || /Video:.*?(\d+(?:\.\d+)?)\s*fps/.exec(t);
  return {
    dur: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
    inicio: s ? Number(s[1]) : 0,
    fps: f ? Number(f[1]) : 30,
    w: wh ? Number(wh[1]) : 0, h: wh ? Number(wh[2]) : 0,
  };
}

/* CUADRÍCULA FIJA. La base no es regular: en las uniones entre tomas hay huecos de 45–57 ms
   (medido 18-sep: 9 en 2443 cuadros) y al comprimir ffmpeg los rellena repitiendo cuadros.
   Si cada pedazo rellena por su cuenta, el desfase se acumula en cada límite (primera prueba:
   un cuadro de diferencia; peor caso ~100 ms). Por eso cada pedazo pasa el video a una rejilla
   de `fps` casillas por segundo anclada al 0 del video COMPLETO, y los cortes caen justo en
   casillas: cada cuadro va a la misma casilla que en la pasada única y el desfase es cero. */
function plan(dur, fps, aj) {
  aj = aj || { max: MAX_PEDAZOS, seg: SEG_POR_PEDAZO };
  var k = Math.max(2, Math.min(aj.max, Math.ceil(dur / aj.seg)));
  var casillas = Math.ceil(dur * fps - 1e-6), partes = [];
  for (var i = 0; i < k; i++) {
    var n0 = Math.round(casillas * i / k), n1 = Math.round(casillas * (i + 1) / k);
    partes.push({
      indice: i,
      c0: n0, c1: i === k - 1 ? null : n1,          // casillas [c0, c1); el último, hasta el final
      desde: n0 / fps,
      hasta: i === k - 1 ? dur + 5 : n1 / fps,
    });
  }
  return partes;
}

/* Un pedazo: rejilla fija → casillas [c0, c1) en tiempo original → color → subtítulos → volver a 0 */
async function renderPedazo(o) {
  var fps = o.fps || 30;
  var ss = Math.max(0, o.desde - 2);
  var ancla = Math.floor(ss * fps) / fps;          // la rejilla empieza en una casilla (así es la misma en todos)
  var filtros = ['[0:v]setpts=PTS-' + o.inicio.toFixed(6) + '/TB,fps=fps=' + fps + ':start_time=' + ancla.toFixed(6) +
    ',trim=start_pts=' + o.c0 + (o.c1 != null ? ':end_pts=' + o.c1 : '') + '[vt]'];
  var actual = '[vt]';
  /* (27-sep) COLOR CON MÁSCARA (look Selectivo): primero, sobre el video tal cual (la silueta se sacó de él). La
     silueta es de TODO el video y empieza en su segundo 0: con -copyts calza con este tramo, como las de «detrás». */
  var conMascara = !!(o.color && o.color.cubePersona && o.color.silueta && fs.existsSync(o.color.silueta));
  var entradasSil = [];
  if (conMascara) {
    var dimM = infoVideo(o.base);
    var nMk = (o.c1 != null ? o.c1 - o.c0 : Math.ceil((Math.min(o.hasta, o.desde + 600) - o.desde + 2) * fps)) + 4;
    entradasSil = ['-i', o.color.silueta];                       // entrada 1 (las capas de gráficos van después)
    filtros = filtros.concat(ctx.silueta.filtrosMascara(1, dimM.w, dimM.h, fps, nMk, o.c0, 'P'));
    filtros = filtros.concat(ctx.silueta.filtrosColor(actual, o.color.cube, o.color.cubePersona, ctx.rutaFiltro, 'P', '[vcm]'));
    actual = '[vcm]';
  }
  // (28-sep, fase 2) sin máscara, la tabla también va primero, sobre la base tal cual (en 16 bits): lo mismo que
  // carrete-assembler-v1.js › buildFilterGraph
  var tablaPrimero = !conMascara && !!(o.color && o.color.cube) && !!ctx.filtroTabla;
  if (tablaPrimero) { filtros.push(ctx.filtroTabla(o.color.cube, actual, '[vtab]')); actual = '[vtab]'; }
  // v7: movimiento antes del color y de los subtítulos (la cuenta usa el número de cuadro en la rejilla del video completo)
  var fm = ctx.filtroMov ? ctx.filtroMov(o.mov, { fps: fps, c0: o.c0, desde: o.desde, hasta: o.hasta }) : null;
  if (fm) { filtros.push(actual + fm + '[vm]'); actual = '[vm]'; }
  // v8: escenas de apoyo de este pedazo (encima; el color y los subtítulos van después)
  var ins = (o.apoyo && o.apoyo.insertos || []).filter(function (a) { return a.local && a.t1 > o.desde - 0.2 && a.t0 < o.hasta + 0.2; });
  if (ins.length && ctx.filtroApoyo) {
    var fa = ctx.filtroApoyo(ins, actual, fps, o.apoyo.W, o.apoyo.H, (conMascara || tablaPrimero) ? o.color.cube : null);
    filtros = filtros.concat(fa.filtros); actual = fa.salida;
  }
  var fc = (conMascara || tablaPrimero)
    ? (ctx.filtroVineta ? ctx.filtroVineta(o.color, actual, '[vc]') : null)     // (fase 2) la tabla ya fue arriba
    : ctx.filtroColor(o.color, actual, '[vc]');
  if (fc) { filtros.push(fc); actual = '[vc]'; }
  // (2-oct) «blanco y negro + tu color»: el video pasa a blanco y negro en los tramos de esas piezas (antes de los gráficos)
  var fbn = ctx.filtroBN && o.graf && o.graf.piezas ? ctx.filtroBN(o.graf.piezas.filter(function (p) { return p.t1 > o.desde - 0.2 && p.t0 < o.hasta + 0.2; }), actual, '[vbn]') : null;
  if (fbn) { filtros.push(fbn); actual = '[vbn]'; }
  // (2-oct) «noche y amanecer»: el video de noche (y amanecer) en los tramos de esas piezas
  var fnq = ctx.filtroNoche && o.graf && o.graf.piezas ? ctx.filtroNoche(o.graf.piezas.filter(function (p) { return p.t1 > o.desde - 0.2 && p.t0 < o.hasta + 0.2; }), actual, '[vnq]') : null;
  if (fnq) { filtros.push(fnq); actual = '[vnq]'; }
  // v9: gráficos de este pedazo (después del color, antes de los subtítulos); cada pedazo dibuja los suyos
  var entradasCapas = entradasSil.slice();
  var gp = o.graf && o.graf.piezas ? o.graf.piezas.filter(function (p) { return p.t1 > o.desde - 0.2 && p.t0 < o.hasta + 0.2; }) : [];
  var prem = o.graf && o.graf.premium ? o.graf.premium.filter(function (j) { return j.p.t1 > o.desde - 0.2 && j.p.t0 < o.hasta + 0.2; }) : [];
  /* (29-sep) La persiana («tarjeta») tapa el cuadro entero: se aparta y se monta DESPUÉS de los subtítulos (mientras
     está, no se ven). El dibujo clásico no la sabe hacer: nunca va por el canvas. */
  var premT = prem.filter(function (j) { return j.p.forma === 'tarjeta'; });
  prem = prem.filter(function (j) { return j.p.forma !== 'tarjeta'; });
  gp = gp.filter(function (p) { return p.forma !== 'tarjeta'; });
  /* (20-sep) Las piezas «profundo» se sacan aparte: no van encima del video sino DETRÁS de la
     persona, y eso es otro encadenado — hace falta la silueta que devuelve carrete-recorte. */
  var hondo = Array.isArray(o.siluetas) && o.siluetas.length > 0;
  var gpH = hondo ? gp.filter(function (p) { return p.forma === 'profundo'; }) : [];
  var premH = hondo ? prem.filter(function (j) { return j.p.forma === 'profundo'; }) : [];
  if (hondo) {
    gp = gp.filter(function (p) { return p.forma !== 'profundo'; });
    prem = prem.filter(function (j) { return j.p.forma !== 'profundo'; });
  }
  var capasEncima = null;
  if ((gp.length || prem.length) && ctx.capa && (prem.length || ctx.capa.disponible())) {
    var dirG = path.join(path.dirname(o.salida), 'graficos_' + path.basename(o.salida, '.mp4'));
    if (!fs.existsSync(dirG)) fs.mkdirSync(dirG, { recursive: true });
    var capas = prem.length
      ? await ctx.premium.capas(prem, { W: o.graf.W, H: o.graf.H, fps: fps, dir: dirG, ffmpegPath: ctx.ffmpegPath, bajar: ctx.bajarS3 })
      : await ctx.capa.renderizarTodas(gp, { W: o.graf.W, H: o.graf.H, fps: fps, color: o.graf.color, ffmpegPath: ctx.ffmpegPath, dir: dirG, fontsDir: o.fontsDir });
    if (capas.length) {
      entradasCapas = entradasSil.concat(ctx.capa.entradas(capas, 1 + entradasSil.filter(function (a) { return a === '-i'; }).length));
      capasEncima = capas;       // (2-oct) se montan DESPUÉS de lo de detrás de ti (ver abajo)
    }
  }
  /* ══ Detrás de la persona (20-sep) ══ Tres capas: el video de fondo, el gráfico encima, y la
     persona recortada encima del todo. La silueta viene de carrete-recorte (blanco = ella) y se
     agranda aquí: se calcula a media resolución porque, medido, no se nota. */
  /* Cada gráfico «profundo» va con SU silueta: se recortó solo para sus segundos, así que cada uno
     trae la suya. Por cada uno: partir en dos, recortar a la persona, el gráfico sobre el fondo y
     la persona encima. */
  if ((gpH.length || premH.length) && ctx.capa && (premH.length || ctx.capa.disponible())) {
    var dirH = path.join(path.dirname(o.salida), 'hondo_' + path.basename(o.salida, '.mp4'));
    if (!fs.existsSync(dirH)) fs.mkdirSync(dirH, { recursive: true });
    var sils = (o.siluetas || []).filter(function (x) { return x && x.local && fs.existsSync(x.local); });
    var nH = 0;
    for (var iH = 0; iH < sils.length; iH++) {
      var sil = sils[iH];
      // los gráficos que caen en el tramo de ESTA silueta y llegan a este pedazo
      var mios = gpH.filter(function (p) { return Math.abs(p.t0 - sil.t0) < 0.05; });
      var miosP = premH.filter(function (j) { return Math.abs(j.p.t0 - sil.t0) < 0.05; });
      if (!mios.length && !miosP.length) continue;
      var capasH = miosP.length
        ? await ctx.premium.capas(miosP, { W: o.graf.W, H: o.graf.H, fps: fps, dir: dirH, ffmpegPath: ctx.ffmpegPath, bajar: ctx.bajarS3 })
        : await ctx.capa.renderizarTodas(mios, { W: o.graf.W, H: o.graf.H, fps: fps, color: o.graf.color, ffmpegPath: ctx.ffmpegPath, dir: dirH, fontsDir: o.fontsDir });
      if (!capasH.length) continue;
      var desdeH = 1 + entradasCapas.filter(function (a) { return a === '-i'; }).length;
      var entH = ctx.capa.entradas(capasH, desdeH);
      entradasCapas = entradasCapas.concat(entH);
      var iSil = desdeH + entH.filter(function (a) { return a === '-i'; }).length;
      // la silueta empieza en sil.desde del video completo: -itsoffset la cuadra
      entradasCapas = entradasCapas.concat(['-itsoffset', Number(sil.desde || 0).toFixed(4), '-i', sil.local]);

      var sufijo = 'H' + nH++;
      filtros.push(actual + 'split[fdo' + sufijo + '][per' + sufijo + ']');
      /* (24-sep) LA SILUETA EN LA MISMA REJILLA QUE EL VIDEO. El alphamerge del ffmpeg de la Lambda (2018) empareja
         cuadros EN ORDEN, no por tiempo; la silueta va a 30 cuadros y empieza en otro momento que el trozo: salia
         desfasada (fantasma, pelo cortado, cara a medias). Lienzo negro con exactamente los cuadros del trozo (del
         c0 en adelante) y la silueta encima en su tiempo (overlay SI sincroniza por tiempo). Antes y despues de la
         silueta da igual lo que haya: la persona es el mismo video que el fondo. Y se endurece: bajo ~35 % es
         fondo, sobre ~67 % es persona (sin halo de la lampara ni cara transparente), con 1 px de suavizado. */
      var nMsk = (o.c1 != null ? o.c1 - o.c0 : Math.ceil((Math.min(o.hasta, o.desde + 600) - o.desde + 2) * fps)) + 4;
      filtros.push('color=c=black:s=' + o.graf.W + 'x' + o.graf.H + ':r=' + fps + ':d=' + (nMsk / fps).toFixed(3) +
        ',format=gray,setpts=PTS+' + o.c0 + '[lz' + sufijo + ']');
      filtros.push('[' + iSil + ':v]scale=' + o.graf.W + ':' + o.graf.H + ',format=gray,setsar=1,fps=fps=' + fps + '[sg' + sufijo + ']');
      filtros.push('[lz' + sufijo + '][sg' + sufijo + "]overlay=0:0:eof_action=repeat,format=gray,lut=y='clip((val-90)*255/80,0,255)',boxblur=1:1,setsar=1[msk" + sufijo + ']');
      filtros.push('[per' + sufijo + '][msk' + sufijo + ']alphamerge[persona' + sufijo + ']');
      /* (24-sep) tres capas de verdad: la ventana detras, la persona recortada encima, y lo que va
         'delante' (el titulo del navegador) por encima de todo */
      var atrasH = capasH.filter(function (c) { return !c.delante; }), delanteH = capasH.filter(function (c) { return c.delante; });
      var fh = ctx.capa.filtros(atrasH, '[fdo' + sufijo + ']', o.graf.W, o.graf.H, fps, o.c0, sufijo + 'a');
      filtros = filtros.concat(fh.filtros);
      filtros.push(fh.salida + '[persona' + sufijo + ']overlay=0:0:format=auto:eof_action=pass[v' + sufijo + ']');
      actual = '[v' + sufijo + ']';
      if (delanteH.length) {
        var fd = ctx.capa.filtros(delanteH, actual, o.graf.W, o.graf.H, fps, o.c0, sufijo + 'd');
        filtros = filtros.concat(fd.filtros); actual = fd.salida;
      }
    }
  }
  /* (2-oct) LO DE ENCIMA, DESPUÉS de lo de detrás de ti y de tu recorte: el orden de la composición (detrás, tú, encima).
     Antes iba primero y, cuando una capa de encima y una de detrás se pisaban (la edición del Proyecto 25, segundos 2,5 a
     3,6), la de detrás la tapaba fuera de tu silueta. Las piezas de la IA no se pisan entre ellas: para ellas no cambia nada. */
  if (capasEncima && capasEncima.length) {
    var fg = ctx.capa.filtros(capasEncima, actual, o.graf.W, o.graf.H, fps, o.c0, 'N');
    filtros = filtros.concat(fg.filtros); actual = fg.salida;
  }
  if (o.assPath) {
    filtros.push(actual + "ass='" + rutaFiltro(o.assPath) + "'" + (o.fontsDir ? ":fontsdir='" + rutaFiltro(o.fontsDir) + "'" : '') + '[vs]');
    actual = '[vs]';
  }
  if (premT.length && ctx.premium && ctx.capa) {
    var dirT = path.join(path.dirname(o.salida), 'tarjetas_' + path.basename(o.salida, '.mp4'));
    if (!fs.existsSync(dirT)) fs.mkdirSync(dirT, { recursive: true });
    var capasT = await ctx.premium.capas(premT, { W: o.graf.W, H: o.graf.H, fps: fps, dir: dirT, ffmpegPath: ctx.ffmpegPath, bajar: ctx.bajarS3 });
    if (capasT.length) {
      entradasCapas = entradasCapas.concat(ctx.capa.entradas(capasT, 1 + entradasCapas.filter(function (a) { return a === '-i'; }).length));
      var ft = ctx.capa.filtros(capasT, actual, o.graf.W, o.graf.H, fps, o.c0, 'T');
      filtros = filtros.concat(ft.filtros); actual = ft.salida;
    }
  }
  filtros.push(actual + 'setpts=PTS-STARTPTS[vf]');
  /* La rejilla ya fija el ritmo: al guardar NO se tocan los tiempos (-vsync 0). El ffmpeg de la
     Lambda (4.1, de 2019) repetía o quitaba un cuadro al final de algunos pedazos (medido: 409/408/407).
     Y tope exacto de cuadros en los que no son el último. `-vsync 0` lo entienden 4.1 y 8.x. */
  // v7: el filtro va en un archivo (el del movimiento puede ser largo)
  var guion = o.salida.replace(/\.mp4$/, '') + '_filtro.txt';
  fs.writeFileSync(guion, filtros.join(';'), 'utf8');
  var comp = o.compresion || ctx.compresion;
  var tope = o.c1 != null ? ['-frames:v', String(o.c1 - o.c0)] : [];
  var args = ['-copyts', '-ss', ss.toFixed(3), '-t', (o.hasta - ss + 1).toFixed(3), '-i', o.base]
    .concat(entradasCapas, ['-filter_complex_script', guion, '-map', '[vf]', '-an', '-vsync', '0'])
    .concat(tope, comp, [o.salida]);
  /* v10: el master saca también la versión para Instagram en la MISMA pasada: se parte la salida en dos
     y la segunda se reduce a 1080 de ancho. Así el 4K se decodifica una sola vez. */
  if (o.derivado && o.derivado.salida) {
    filtros[filtros.length - 1] = actual + 'setpts=PTS-STARTPTS,split[vf][vfb]';
    filtros.push('[vfb]scale=' + o.derivado.w + ':' + o.derivado.h + ':flags=lanczos,setsar=1[vfi]');
    fs.writeFileSync(guion, filtros.join(';'), 'utf8');
    args = args.concat(['-map', '[vfi]', '-an', '-vsync', '0'], tope, o.derivado.compresion, [o.derivado.salida]);
  }
  try { await ctx.runFFmpeg(args); } finally { try { fs.unlinkSync(guion); } catch (e) {} }
}

/* Cuántos cuadros tiene un archivo (sin decodificar: copia a la nada y lee el contador) */
function contarCuadros(file) {
  var r = childProcess.spawnSync(ctx.ffmpegPath, ['-hide_banner', '-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'], { encoding: 'utf8' });
  var m = (r.stderr || '').match(/frame=\s*(\d+)/g);
  return m ? Number(m[m.length - 1].replace(/\D/g, '')) : -1;
}

/* Pegar los pedazos (copia, sin recomprimir) + el audio de la base */
async function unir(archivos, base, salida, dir) {
  var lista = path.join(dir, 'lista.txt');
  fs.writeFileSync(lista, archivos.map(function (a) { return "file '" + a.replace(/'/g, "'\\''") + "'"; }).join('\n'));
  await ctx.runFFmpeg(['-f', 'concat', '-safe', '0', '-i', lista, '-i', base,
    '-map', '0:v', '-map', '1:a?', '-c:v', 'copy',
    // v14: el sonido donde empieza su imagen (una base vieja trae huecos que el reproductor se salta)
    '-af', 'aresample=async=1:min_hard_comp=0.001:first_pts=0', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', salida]);
}

function con0(n) { return (n < 10 ? '0' : '') + n; }

/* ══ Coordinador ══ Devuelve true si hizo el video; false si conviene la pasada única. */
async function pasadaEnPedazos(o) {
  if (!ctx.invocar) { console.log('[Pedazos] sin cliente de Lambda: pasada única'); return false; }
  var info = infoVideo(o.baseVideo);
  var esMaster = !!o.esMaster;
  var aj = ajustesPara(info, esMaster);
  if (!(info.dur >= aj.min)) return false;
  var partes = plan(info.dur, info.fps, aj);
  var compresion = ctx.compresionPara ? ctx.compresionPara(info, esMaster) : ctx.compresion;
  /* la versión para Instagram solo si el master es más grande de lo que Instagram acepta (1920 de ancho) */
  var derivado = null;
  if (esMaster && Math.max(info.w, info.h) > 1920 && ctx.compresionIG && o.finalVideoIG) {
    var esc = 1920 / Math.max(info.w, info.h);
    derivado = { w: 2 * Math.round(info.w * esc / 2), h: 2 * Math.round(info.h * esc / 2), compresion: ctx.compresionIG(info) };
  }
  if (esMaster) console.log('[Pedazos] MASTER ' + info.w + 'x' + info.h + '@' + info.fps + ' · ' + partes.length + ' pedazos · espera ' + Math.round(aj.espera / 1000) + ' s' +
    (derivado ? ' · Instagram a ' + derivado.w + 'x' + derivado.h : ''));
  var t0 = Date.now();
  var dir = path.join(o.workDir, 'pedazos');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  var assTexto = o.assPath ? fs.readFileSync(o.assPath, 'utf8') : null;
  console.log('[Pedazos] ' + info.dur.toFixed(2) + ' s en rejilla de ' + info.fps + ' cuadros/s → ' + partes.length + ' pedazos de ~' +
    (info.dur / partes.length).toFixed(1) + ' s' + (assTexto ? ' · subtítulos ' + Math.round(assTexto.length / 1024) + ' KB' : ''));

  var locales = partes.map(function (p) { return path.join(dir, con0(p.indice) + '.mp4'); });
  var localesIG = partes.map(function (p) { return path.join(dir, con0(p.indice) + '_ig.mp4'); });
  var remotosS3 = [];
  var fallidos = [];

  // los pedazos 1..n en otras Lambdas
  var remotos = partes.slice(1).map(function (p) {
    var ev = { modo: 'pedazo', render_id: o.render_id, indice: p.indice, desde: p.desde, hasta: p.hasta,
               c0: p.c0, c1: p.c1, fps: info.fps, compresion: compresion, derivado: derivado,
               inicio: info.inicio, base_url: o.baseUrl, ass: assTexto, color: o.colorPrep ? o.colorPrep.datos : null, mov: o.movimiento || null,
               siluetas: (o.siluetas || []).map(function (x) { return { t0: x.t0, t1: x.t1, desde: x.desde, key: x.key }; }),
               apoyo: o.apoyo ? { W: o.apoyo.W, H: o.apoyo.H, insertos: o.apoyo.insertos.filter(function (a) { return a.t1 > p.desde - 0.2 && a.t0 < p.hasta + 0.2; })
                 .map(function (a) { return { t0: a.t0, t1: a.t1, ss: a.ss, rotar: a.rotar, s3_key: a.s3_key }; }) } : null,
               graf: o.graf ? { W: o.graf.W, H: o.graf.H, color: o.graf.color, estilo: o.graf.estilo,
                 piezas: o.graf.piezas.filter(function (g) { return g.t1 > p.desde - 0.2 && g.t0 < p.hasta + 0.2; }),
                 premium: o.graf.premium && ctx.premium ? ctx.premium.paraPedazo(o.graf.premium, p.desde, p.hasta) : null } : null };
    var t1 = Date.now();
    return ctx.invocar(ev, aj.espera).then(async function (r) {
      remotosS3.push(r.key);
      await ctx.bajarS3(r.key, locales[p.indice]);
      if (derivado && r.key_ig) { remotosS3.push(r.key_ig); await ctx.bajarS3(r.key_ig, localesIG[p.indice]); }
      console.log('[Pedazos] ' + p.indice + ' listo en otra Lambda (' + r.segundos + ' s de trabajo, ' + Math.round((Date.now() - t1) / 1000) + ' s con idas y vueltas)');
    }).catch(function (e) {
      console.log('[Pedazos] ' + p.indice + ' falló afuera, lo hago aquí: ' + String(e.message || e).slice(0, 200));
      fallidos.push(p);
    });
  });

  // el pedazo 0 aquí mismo, mientras tanto
  var propio = renderPedazo({ base: o.baseVideo, inicio: info.inicio, fps: info.fps, desde: partes[0].desde, hasta: partes[0].hasta,
    c0: partes[0].c0, c1: partes[0].c1, assPath: o.assPath, fontsDir: o.fontsDir, color: o.colorPrep, mov: o.movimiento, apoyo: o.apoyo, graf: o.graf,
    siluetas: o.siluetas, salida: locales[0], compresion: compresion,
    derivado: derivado ? { w: derivado.w, h: derivado.h, compresion: derivado.compresion, salida: localesIG[0] } : null }).then(function () {
    console.log('[Pedazos] 0 listo aquí (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  });

  await Promise.all([propio].concat(remotos));
  for (var i = 0; i < fallidos.length; i++) {
    var p = fallidos[i];
    await renderPedazo({ base: o.baseVideo, inicio: info.inicio, fps: info.fps, desde: p.desde, hasta: p.hasta,
      c0: p.c0, c1: p.c1, assPath: o.assPath, fontsDir: o.fontsDir, color: o.colorPrep, mov: o.movimiento, apoyo: o.apoyo, graf: o.graf,
      siluetas: o.siluetas, salida: locales[p.indice], compresion: compresion,
      derivado: derivado ? { w: derivado.w, h: derivado.h, compresion: derivado.compresion, salida: localesIG[p.indice] } : null });
  }

  // vigilancia: cada pedazo debe tener exactamente sus casillas (si no, el audio se correría)
  var cuentas = locales.map(contarCuadros), esperados = partes.map(function (p) { return p.c1 != null ? p.c1 - p.c0 : null; });
  var raros = cuentas.filter(function (n, i) { return esperados[i] != null && n !== esperados[i]; }).length;
  console.log('[Pedazos] cuadros por pedazo ' + JSON.stringify(cuentas) + (raros ? ' · OJO: ' + raros + ' no cuadran con ' + JSON.stringify(esperados) : ' · cuadran'));

  await unir(locales, o.baseVideo, o.finalVideo, dir);
  if (derivado) {
    var todasIG = localesIG.every(function (a) { return fs.existsSync(a); });
    if (todasIG) { await unir(localesIG, o.baseVideo, o.finalVideoIG, dir); console.log('[Pedazos] versión para Instagram pegada: ' + derivado.w + 'x' + derivado.h); }
    else console.log('[Pedazos] OJO: faltan pedazos de la versión para Instagram; se hará aparte');
    localesIG.forEach(function (a) { try { fs.unlinkSync(a); } catch (e) {} });
  }
  console.log('[Pedazos] pegados: ' + partes.length + ' pedazos (' + fallidos.length + ' hechos aquí por falla) en ' +
    Math.round((Date.now() - t0) / 1000) + ' s en total');

  // limpieza (no importa si falla)
  remotosS3.forEach(function (k) { ctx.borrarS3(k).catch(function () {}); });
  locales.forEach(function (a) { try { fs.unlinkSync(a); } catch (e) {} });
  return true;
}

/* ══ Trabajador ══ Hace UN pedazo y lo deja en S3. */
async function trabajar(ev) {
  var t0 = Date.now();
  var dir = '/tmp/pedazo_' + ev.render_id + '_' + ev.indice;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  fs.mkdirSync(dir, { recursive: true });
  try {
    var base = path.join(dir, 'base.mp4');
    var tareas = [ctx.bajarURL(ev.base_url, base)];
    var fontsDir = null, assPath = null;
    if (ev.ass) {
      assPath = path.join(dir, 'subs.ass');
      fs.writeFileSync(assPath, ev.ass, 'utf8');
    }
    var graf = ev.graf && ev.graf.piezas && ev.graf.piezas.length ? ev.graf : null;
    if (ev.ass || graf) tareas.push(ctx.descargarFuentes(path.join(dir, 'fonts')).then(function (d) { fontsDir = d; }));
    var apoyo = ev.apoyo && ev.apoyo.insertos && ev.apoyo.insertos.length ? ev.apoyo : null;
    if (apoyo) apoyo.insertos.forEach(function (a, i) {
      a.local = path.join(dir, 'apoyo_' + i + '.mp4');
      tareas.push(ctx.bajarS3(a.s3_key, a.local).catch(function (e) { console.log('[Pedazo ' + ev.indice + '] sin escena ' + a.s3_key + ': ' + e.message); a.local = null; }));
    });
    // (20-sep) las siluetas de los gráficos que van por detrás de la persona
    var siluetas = (ev.siluetas || []).map(function (x, i) {
      var loc = path.join(dir, 'silueta_' + i + '.mp4');
      tareas.push(ctx.bajarS3(x.key, loc).catch(function (e) {
        console.log('[Pedazo ' + ev.indice + '] sin silueta ' + i + ': ' + e.message); x.local = null;
      }));
      return { t0: x.t0, t1: x.t1, desde: x.desde, local: loc };
    });
    // (27-sep) la silueta del color con máscara
    var silColor = ev.color && ev.color.mascara && ev.color.silueta && ev.color.silueta.key ? path.join(dir, 'silueta_color.mp4') : null;
    if (silColor) tareas.push(ctx.bajarS3(ev.color.silueta.key, silColor).catch(function (e) {
      console.log('[Pedazo ' + ev.indice + '] sin silueta del color: ' + e.message); silColor = null;
    }));
    await Promise.all(tareas);
    if (ev.color && ev.color.mascara && !silColor) ev.color.mascara = false;   // sin silueta: la receta natural en todo
    var color = ev.color ? ctx.escribirColor(ev.color, dir) : null;
    if (color && silColor) color.silueta = silColor;
    var salida = path.join(dir, 'out.mp4');
    var salidaIG = ev.derivado ? path.join(dir, 'out_ig.mp4') : null;
    await renderPedazo({ base: base, inicio: ev.inicio, fps: ev.fps, desde: ev.desde, hasta: ev.hasta,
      c0: ev.c0, c1: ev.c1, assPath: assPath, fontsDir: fontsDir, color: color, mov: ev.mov || null, apoyo: apoyo, graf: graf, siluetas: siluetas, salida: salida,
      compresion: ev.compresion || null,
      derivado: ev.derivado ? { w: ev.derivado.w, h: ev.derivado.h, compresion: ev.derivado.compresion, salida: salidaIG } : null });
    var key = 'renders/' + ev.render_id + '/pedazos/' + con0(ev.indice) + '.mp4';
    await ctx.subirS3(salida, key);
    var keyIG = null;
    if (salidaIG && fs.existsSync(salidaIG)) { keyIG = 'renders/' + ev.render_id + '/pedazos/' + con0(ev.indice) + '_ig.mp4'; await ctx.subirS3(salidaIG, keyIG); }
    var seg = Math.round((Date.now() - t0) / 1000);
    console.log('[Pedazo ' + ev.indice + '] ' + ev.desde.toFixed(2) + '–' + Math.min(ev.hasta, 99999).toFixed(2) + ' s listo en ' + seg + ' s');
    return { ok: true, key: key, key_ig: keyIG, segundos: seg };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}   // /tmp se reutiliza entre llamadas
  }
}

/* (29-sep) La persiana CALLA los subtítulos mientras está (tapa o mueve el cuadro): la línea que empieza dentro se quita
   y la que viene de antes se corta donde empieza la pieza. Correrle el inicio desordenaría sus animaciones de palabra. */
function callarAss(ass, ventanas) {
  if (!ass || !ventanas || !ventanas.length) return { ass: ass, calladas: 0 };
  var n = 0;
  var seg = function (x) { var m = /^\s*(\d+):(\d+):(\d+(?:\.\d+)?)\s*$/.exec(x); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN; };
  var fmt = function (t) {
    var cs = Math.max(0, Math.round(t * 100)), h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
  };
  var lineas = ass.split(/\r?\n/).map(function (l) {
    var m = /^(Dialogue:[^,]*,)([^,]*),([^,]*),(.*)$/.exec(l);
    if (!m) return l;
    var a = seg(m[2]), b = seg(m[3]), b0 = b;
    if (!isFinite(a) || !isFinite(b)) return l;
    for (var i = 0; i < ventanas.length; i++) {
      var v = ventanas[i];
      if (a >= v.t0 - 0.02 && a < v.t1) { n++; return null; }
      if (a < v.t0 && b > v.t0) b = v.t0;
    }
    if (b === b0) return l;
    n++;
    return m[1] + m[2] + ',' + fmt(b) + ',' + m[4];
  }).filter(function (l) { return l !== null; });
  return { ass: lineas.join('\n'), calladas: n };
}

module.exports = { configurar: configurar, pasadaEnPedazos: pasadaEnPedazos, __renderPedazo: renderPedazo, trabajar: trabajar, callarAss: callarAss,
                   renderPedazo: renderPedazo, unir: unir, plan: plan, infoVideo: infoVideo };

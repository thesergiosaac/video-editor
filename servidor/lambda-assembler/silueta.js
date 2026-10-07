/* SILUETA DE TODO EL VIDEO para el color con máscara (27-sep-2026).
 *
 * El look «Selectivo» colorea el fondo con una receta y a la persona con otra (su piel y la madera tienen el mismo
 * tono: un look parejo no las separa). Para eso hace falta la silueta de la persona en TODO el video, no solo en
 * los tramos de los gráficos «detrás de ti».
 *
 * · La saca carrete-recorte por tramos de TRAMO segundos, en paralelo, a 608x1080 (la de los gráficos) y con 1 s de
 *   calentar. (29-sep) Antes iba a 304x540 y se perdía la mano apoyada en el escritorio y el antebrazo: esa piel quedaba
 *   del lado del fondo y se pintaba con su color (Proyecto 25, rojos +100 en el fondo: la mano salía roja).
 * · Los tramos se juntan en UN video de silueta alineado cuadro a cuadro con el video (lienzo negro + cada tramo
 *   encima en su segundo, overlay sincroniza por tiempo): así no se corre aunque un tramo traiga un cuadro de más.
 * · Se guarda junto al video: `<video>_silueta2.mp4` (las `_silueta.mp4` eran de 304x540 y no se reusan). La vista previa de la página y los videos siguientes que reusan
 *   esa misma base la toman de ahí sin volver a recortar.
 */
var fs = require('fs');
var path = require('path');

var TRAMO = 12;                 // segundos por tramo: 390 cuadros a 608x1080 (con el de calentar) ≈ 1 GB, cabe en los 2 GB
var ANCHO = 608, ALTO = 1080;
var CALENTAR = 1;               // segundos que el recorte arranca antes de cada tramo (menos el primero) y no guarda
var FPS = 30;

var ctx = {};
function configurar(c) { ctx = c; }

function claveDe(claveVideo) { return String(claveVideo).replace(/(\.mp4)?$/i, '_silueta2.mp4'); }

/* La silueta de un video del cubo. Devuelve { key, local } o lanza error. `dur` en segundos. */
async function asegurar(claveVideo, dur, dir) {
  var key = claveDe(claveVideo);
  var local = path.join(dir, 'silueta_color.mp4');
  if (await ctx.existe(key)) {
    await ctx.bajar(key, local);
    console.log('[Silueta] reusada ' + key);
    return { key: key, local: local, reusada: true };
  }
  var t0 = Date.now();
  var n = Math.max(1, Math.ceil(dur / TRAMO));
  var base = key.replace(/\.mp4$/i, '');
  var tramos = await Promise.all(Array.from({ length: n }, function (_, i) {
    var desde = i * TRAMO, hasta = Math.min(dur + 0.5, (i + 1) * TRAMO);
    var k = base + '_t' + i + '.mp4';
    return ctx.invocar('carrete-recorte', { bucket: ctx.bucket, key: claveVideo, desde: desde, hasta: hasta, fps: FPS, salida: k, ancho: ANCHO, alto: ALTO, calentar: desde > 0 ? CALENTAR : 0 }, 600000)
      .then(function (r) {
        if (!r || !r.ok) throw new Error('tramo ' + i + ': ' + JSON.stringify(r).slice(0, 160));
        var loc = path.join(dir, 'silueta_t' + i + '.mp4');
        return ctx.bajar(k, loc).then(function () { return { desde: desde, key: k, local: loc }; });
      });
  }));
  console.log('[Silueta] ' + n + ' tramos recortados en ' + Math.round((Date.now() - t0) / 1000) + ' s');

  // UN video: lienzo negro de la duración entera y cada tramo encima en su segundo
  var args = ['-y', '-hide_banner', '-loglevel', 'error'];
  tramos.forEach(function (t) { args.push('-itsoffset', t.desde.toFixed(3), '-i', t.local); });
  var f = ['color=c=black:s=' + ANCHO + 'x' + ALTO + ':r=' + FPS + ':d=' + (dur + 0.1).toFixed(3) + ',format=gray[l0]'];
  tramos.forEach(function (t, i) {
    f.push('[' + i + ':v]scale=' + ANCHO + ':' + ALTO + ',format=gray,setsar=1,fps=fps=' + FPS + '[s' + i + ']');
    f.push('[l' + i + '][s' + i + ']overlay=0:0:eof_action=pass,format=gray[l' + (i + 1) + ']');
  });
  var guion = path.join(dir, 'silueta_filtro.txt');
  fs.writeFileSync(guion, f.join(';'), 'utf8');
  args = args.concat(['-filter_complex_script', guion, '-map', '[l' + tramos.length + ']', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', local]);
  await ctx.runFFmpeg(args);
  await ctx.subir(local, key);
  tramos.forEach(function (t) { ctx.borrar(t.key).catch(function () {}); });
  console.log('[Silueta] lista ' + key + ' (' + Math.round(fs.statSync(local).size / 1024) + ' KB) en ' + Math.round((Date.now() - t0) / 1000) + ' s');
  return { key: key, local: local, reusada: false };
}

/* Los filtros que arman la máscara en la MISMA rejilla que el video (el alphamerge del ffmpeg de la Lambda empareja
   cuadros en orden, no por tiempo — ver pedazos.js › «Detrás de la persona»): lienzo negro con los cuadros justos,
   la silueta encima por tiempo y el borde suavizado (un borde duro dejaría una raya donde cambia el color).
   `entrada` = índice de la entrada ffmpeg de la silueta; `c0` = primer cuadro (0 en la pasada única). */
function filtrosMascara(entrada, W, H, fps, cuadros, c0, sufijo) {
  /* (28-sep) la silueta NATURAL del recorte (sin endurecerla), encogida un poco y suavizada, en proporción al tamaño del
     video: la transición queda SOBRE el borde real. Antes quedaba por fuera y, con las zonas, dejaba un halo claro
     alrededor del pelo (Sergio: «el borde entre la persona y el fondo nunca debe notarse»). Medido con sus clips. */
  var e = Math.max(1, Math.round(W * 2 / 360)), r = Math.max(2, Math.round(W * 3 / 360));
  var encoger = new Array(e).fill('erosion').join(',');
  return [
    'color=c=black:s=' + W + 'x' + H + ':r=' + fps + ':d=' + ((cuadros + 4) / fps).toFixed(3) + ',format=gray,setpts=PTS+' + (c0 || 0) + '[mz' + sufijo + ']',
    '[' + entrada + ':v]scale=' + W + ':' + H + ',format=gray,setsar=1,fps=fps=' + fps + '[ms' + sufijo + ']',
    '[mz' + sufijo + '][ms' + sufijo + "]overlay=0:0:eof_action=repeat,format=gray,lut=y='clip((val-16)*255/219,0,255)'," + encoger +
      ',boxblur=' + r + ':1,setsar=1[mk' + sufijo + ']',
  ];
}

/* El color con máscara: fondo con una tabla, persona con otra, y la persona encima por su silueta. */
function filtrosColor(entradaVideo, cubeFondo, cubePersona, rutaFiltro, sufijo, salida) {
  return [
    entradaVideo + 'split[cf' + sufijo + '][cp' + sufijo + ']',
    // (28-sep, fase 2) las dos tablas en RGB de 16 bits (la base del master llega en 10)
    '[cf' + sufijo + "]format=rgb48le,lut3d=file='" + rutaFiltro(cubeFondo) + "',format=yuv420p[cfa" + sufijo + ']',
    '[cp' + sufijo + "]format=rgb48le,lut3d=file='" + rutaFiltro(cubePersona) + "',format=yuv420p[cpa" + sufijo + ']',
    '[cpa' + sufijo + '][mk' + sufijo + ']alphamerge[cpm' + sufijo + ']',
    '[cfa' + sufijo + '][cpm' + sufijo + ']overlay=0:0:eof_action=pass,format=yuv420p' + salida,
  ];
}

module.exports = { configurar: configurar, configurado: function () { return ctx; }, asegurar: asegurar, claveDe: claveDe, filtrosMascara: filtrosMascara, filtrosColor: filtrosColor, FPS: FPS };

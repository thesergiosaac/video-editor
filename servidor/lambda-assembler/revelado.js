/* COLOR en el ensamblador — la parte de archivos y ffmpeg (18-sep-2026).
 *
 * Las cuentas viven en motor-color.js, el mismo archivo que usa la página para la
 * vista previa en vivo. Aquí solo se muestrea el video y se escribe el .cube.
 *
 * UNA sola tabla: revelado (medido de ESTE video) + look (receta + ajustes de la
 * persona) + intensidad, todo junto — igual que la vista del navegador. La viñeta
 * va aparte porque un LUT no sabe de posiciones.
 *
 * Velocidad (medido el 18-sep con 20 s de video, 2 núcleos como la Lambda):
 *   sin color 17 s · dos tablas + viñeta 102 s (lo primero que se subió: el render
 *   pasó de 94 s a 303 s) · una tabla + formatos explícitos ≈ 50 s.
 *   Lo caro es la interpolación de ffmpeg (tetraédrica, en coma flotante). La
 *   «más cercana» es el doble de rápida pero se aparta hasta 11/255 y puede dejar
 *   escalones en paredes lisas: NO se usa.
 */
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var MOTOR = require('./motor-color.js');

function leerCuadros(ffmpegPath, args) {
  return new Promise(function (resolve, reject) {
    var p = spawn(ffmpegPath, args);
    var trozos = [], bytes = 0;
    p.stdout.on('data', function (d) { trozos.push(d); bytes += d.length; });
    p.stderr.on('data', function () {});
    p.on('error', reject);
    p.on('close', function () { resolve(Buffer.concat(trozos, bytes)); });
  });
}

/* Muestras para medir el revelado: primero SOLO los cuadros clave (no decodifica el
   resto: ~1 s en vez de ~8 s); si el video trae muy pocos, se cae al muestreo de
   siempre (1 cada 2 s). Sin «passthrough» ffmpeg repite cuadros para llenar el tiempo;
   `-fps_mode` es de ffmpeg 5.1+ y el de la Lambda es más viejo (18-sep: cayó al lento),
   así que se prueba también `-vsync 0`, que entienden las versiones viejas. */
async function muestrear(ffmpegPath, videoPath) {
  var UN_CUADRO = 128 * 228 * 3;
  var modos = [['-fps_mode', 'passthrough'], ['-vsync', '0']];
  for (var i = 0; i < modos.length; i++) {
    var rapido = await leerCuadros(ffmpegPath, ['-v', 'error', '-skip_frame', 'nokey', '-i', videoPath,
      '-vf', 'scale=128:-2'].concat(modos[i], ['-frames:v', '40', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']));
    if (rapido.length >= UN_CUADRO * 8) return { px: rapido, modo: 'cuadros clave (' + modos[i][0] + ')' };
  }
  var lento = await leerCuadros(ffmpegPath, ['-v', 'error', '-i', videoPath, '-vf', 'fps=1/2,scale=128:-2',
    '-frames:v', '40', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  if (lento.length < 3000) throw new Error('no se pudo muestrear el video');
  return { px: lento, modo: '1 cada 2 s' };
}

/* Revelado + look + intensidad en UNA tabla. Devuelve { cube, vineta } o null (sin color). */
async function prepararColor(ffmpegPath, videoPath, workDir, color) {
  color = color || {};
  var t0 = Date.now();

  // 1 · revelado (encendido salvo que se apague a propósito)
  var medida = null;
  if (color.revelado !== false) {
    try {
      var m = await muestrear(ffmpegPath, videoPath);
      medida = MOTOR.medirRevelado(m.px, 1, 3);
      console.log('[Revelado] ' + m.modo + ' · velo R/G/B ' + medida.negro.map(function (x) { return x.toFixed(3); }).join('/') +
        ' · ganancia ' + medida.gan.map(function (x) { return x.toFixed(3); }).join('/') +
        ' · exposición ×' + medida.expGan.toFixed(3) + ' · ' + (Date.now() - t0) + ' ms');
    } catch (e) {
      console.log('[Revelado] no se pudo medir, se sigue sin revelar: ' + e.message);   // nunca tumbar el render
    }
  }

  // 2 · look (receta del catálogo + ajustes de la persona)
  // (28-sep, fase 3) «Tu referencia»: un look con la receta que viene en color.referencia (motor-color.js › lookDe)
  var P = null, Pp = null, fuerza = 1, look = color.look ? (MOTOR.lookDe ? MOTOR.lookDe(color.look, color.referencia && color.referencia.receta) : MOTOR.CATALOGO[color.look]) : null;
  if (color.look && !look) console.log('[Look] desconocido, se sigue sin look: ' + color.look);
  if (look) {
    fuerza = color.intensidad == null ? 1 : Math.max(0, Math.min(1, Number(color.intensidad)));
    if (fuerza > 0) P = MOTOR.ajustar(look.base, color.ajustes || {});
    // (27-sep) look con máscara (Selectivo): la persona va con su propia receta dentro de su silueta
    if (fuerza > 0 && look.persona) Pp = MOTOR.ajustar(look.persona, color.ajustes || {});
  }
  // (27-sep) la corrección general va encima del look (y sirve también sin look)
  var K = MOTOR.correccionDe ? MOTOR.correccionDe(color.correccion) : null;
  // (28-sep) ZONAS: fondo, piel y ropa con sus propios controles; la silueta separa el fondo de la persona. Sin receta de
  // persona en el look, la persona va con la misma receta (y encima sus zonas).
  var Z = MOTOR.zonasDe ? MOTOR.zonasDe(color.zonas) : null;
  if (Z && !Pp) Pp = P;
  // (28-sep) HSL general: un color (los verdes, o el que se escogió tocando el video) con su tono, saturación y luz;
  // va después de la corrección general. El de cada zona viene dentro de Z (fondoHsl, pielHsl, ropaHsl).
  var G = MOTOR.hslDe ? MOTOR.hslDe(color.hsl) : null;
  if (!medida && !P && !K && !Z && !G) return null;

  // 3 · la tabla (y la de la persona, si el look la pide: la máscara la pone el ensamblador — `mascara` queda en
  //     false hasta que haya silueta; sin silueta la receta de la persona va en todo el cuadro, nunca piel naranja)
  var datos = { medida: medida, P: P, Pp: Pp, fuerza: fuerza, K: K, Z: Z, G: G, mascara: false, silueta: null };
  var res = escribirColor(datos, workDir);
  console.log('[Color] ' + (medida ? 'revelado' : 'sin revelado') + ' + ' +
    (P ? look.nombre + ' al ' + Math.round(fuerza * 100) + '% · ajustes ' + JSON.stringify(color.ajustes || {}) : 'sin look') +
    (Pp ? ' · con receta de persona' : '') + (K ? ' · corrección ' + JSON.stringify(K) : '') + (Z ? ' · zonas ' + JSON.stringify(Z) : '') + (G ? ' · hsl ' + JSON.stringify(G) : '') +
    (res.vineta ? ' · ' + res.vineta : '') + ' · listo en ' + (Date.now() - t0) + ' ms');
  return res;
}

/* Escribe la tabla a partir de los números (medida del revelado + receta + fuerza).
   Los pedazos del render en paralelo la rehacen así, idéntica, sin mandarse 1 MB de .cube. */
function escribirColor(datos, workDir) {
  var ruta = path.join(workDir, 'color.cube');
  var K = datos.K || null, Z = datos.Z || null, G = datos.G || null, conMascara = !!((datos.Pp || Z) && datos.mascara);
  // sin silueta, la receta de la persona va en todo el cuadro (natural) y las zonas no se pueden separar (van sin
  // zonas); con silueta, la del look va en el fondo con la zona «fondo», y la persona con «piel» y «ropa»
  var Pfondo = datos.Pp && !datos.mascara ? datos.Pp : datos.P;
  // (28-sep) con HSL la tabla va de 64 puntos: la de 33 teñía los casi grises vecinos (motor-color.js › N_CON_HSL)
  var n = MOTOR.llevaHsl && MOTOR.llevaHsl(G, Z) ? MOTOR.N_CON_HSL : 33;
  fs.writeFileSync(ruta, MOTOR.aCube(MOTOR.generarLutCompleta(datos.medida, Pfondo, n, datos.fuerza, K,
    conMascara && Z ? { fondo: Z.fondo, fondoHsl: Z.fondoHsl } : null, G), n, 'Cherry color'));
  var rutaP = null;
  if (conMascara) {
    rutaP = path.join(workDir, 'color_persona.cube');
    fs.writeFileSync(rutaP, MOTOR.aCube(MOTOR.generarLutCompleta(datos.medida, datos.Pp || datos.P, n, datos.fuerza, K,
      Z ? { piel: Z.piel, ropa: Z.ropa, pielHsl: Z.pielHsl, ropaHsl: Z.ropaHsl } : null, G), n, 'Cherry color persona'));
  }
  var vineta = datos.P ? MOTOR.filtroVineta(MOTOR.anguloVineta(datos.P.vineta * datos.fuerza)) : null;
  return { cube: ruta, cubePersona: rutaP, vineta: vineta, datos: datos };
}

module.exports = { prepararColor: prepararColor, escribirColor: escribirColor, muestrear: muestrear };

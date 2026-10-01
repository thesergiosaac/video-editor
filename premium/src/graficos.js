/* graficos.js — los GRÁFICOS de Cherry (19-sep-2026, aprobados por Sergio en la muestra: «me encantan todas»).
 *
 * EL MISMO ARCHIVO corre en la página (vista en vivo del celular, dibujando en un <canvas>) y en el ensamblador (Node,
 * dibujando con @napi-rs/canvas cada cuadro del video final): lo que se ve es lo que sale. Sin Remotion.
 *
 * La IA (función biblioteca › graficos) lee lo que dices y marca los momentos con información: una cifra, un porcentaje,
 * una lista, un antes y después, fechas o una cita, con los textos cortos ya escritos. Aquí se decide CUÁLES se usan según
 * «Gráficos» (pocos / medio / muchos) y se dibuja cada cuadro:
 *   · nunca en el primer segundo y medio ni al final; nunca encima de una escena de apoyo; con aire entre uno y otro;
 *   · cada uno entra un poquito antes de la palabra clave y cada parte aparece cuando la dices (el número cuenta cuando
 *     lo nombras, cada punto de la lista cuando lo nombras…);
 *   · tres formas: ENCIMA del video (arriba, sin tapar la cara ni los subtítulos), PANTALLA PARTIDA (tu video sube a una
 *     caja y el gráfico va abajo) y PANTALLA COMPLETA (tu cara en un círculo). En las dos últimas el video se encoge:
 *     video() da cuánto y dónde (la página lo hace con CSS y el ensamblador con perspective), y la capa del gráfico
 *     tapa todo menos el hueco donde queda el video.
 * Todo depende solo del tiempo: el mismo cuadro sale igual en el navegador y en el servidor.
 *
 * ESTILO PREMIUM (19-sep, «si, excelente añadamos los graficos premium»): los mismos momentos, tiempos y formas, pero cada
 * gráfico lo dibuja Remotion (premium/ en carrete-docs) sobre fondo transparente. Este archivo va TAMBIÉN dentro de esa
 * composición: el hueco del video (hueco) y la caja (cajaPremium) salen de aquí, así los dos estilos encogen el video igual.
 */
(function (raiz) {
  'use strict';

  var CANTIDAD = {
    pocos: { cada: 26, aire: 9, fuerza: 2 },
    medio: { cada: 15, aire: 5, fuerza: 2 },
    muchos: { cada: 9, aire: 3, fuerza: 1 },
  };
  var COLORES = { cherry: '#FF2D8A', dorado: '#F7C21A', oceano: '#2BD9C7', lima: '#B6F23A', coral: '#FF6B4A', lila: '#A98BFF', crema: '#F4ECE7' };
  var NOMBRES = { numero: 'Número gigante', porcentaje: 'Porcentaje', lista: 'Lista', comparacion: 'Antes y después', linea: 'Línea de tiempo', cita: 'Cita',
    ranking: 'Ranking', meta: 'Meta', reparto: 'Reparto', rango: 'Rango', multiplo: 'Múltiplo', evolucion: 'Evolución', cuota: 'Cuota',
    medidor: 'Medidor de aguja', mito: 'Mito / Realidad', flujo: 'Flujo de pasos', balanza: 'Balanza', tabla: 'Tabla comparativa', claves: 'Las claves' };
  var FORMA = { numero: 'encima', porcentaje: 'partida', lista: 'encima', comparacion: 'completa', linea: 'encima', cita: 'encima',
    ranking: 'encima', meta: 'encima', reparto: 'partida', rango: 'encima', multiplo: 'encima', evolucion: 'encima', cuota: 'partida',
    medidor: 'partida', mito: 'encima', flujo: 'encima', balanza: 'partida', tabla: 'encima', claves: 'encima' };
  var FORMAS = { encima: 'Encima del video', partida: 'Pantalla partida', completa: 'Pantalla completa', lado: 'Tu video a un lado', abajo: 'Tu video abajo', profundo: 'Detrás de ti' };
  /* ══ FAMILIAS (29-sep-2026) ══ Sergio: «ahora van a haber varios tipos de gráfico y podemos escoger entre familias de
     gráficos así como escogemos las plantillas de los subtítulos… y que haya la opción de mezclar familias». Cada tipo es
     de UNA familia; la persona escoge una o varias (cfg.familias) y la IA solo marca tipos de esas.
       · vidrio: los 19 de siempre (la tarjeta de vidrio premium, o su dibujo clásico).
       · persiana: «La persiana» (Cherry Taller/tarjetas/persiana): en una palabra clave, corte seco a una tarjeta a
         pantalla completa con la sombra de una persiana; la palabra cae y se asienta. 2 a 2,5 s. Forma «tarjeta»: tapa el
         cuadro entero, el video no se mueve y va DESPUÉS de los subtítulos (mientras está, los subtítulos no se ven).
         Siempre la dibuja Remotion. Clip, captura y foto las pone la persona (una pantalla con forma «tarjeta»). */
  var FAMILIAS = {
    vidrio: { nombre: 'Vidrio', d: 'tarjetas de vidrio encima de tu video, con cifras que ruedan',
      tipos: ['numero', 'porcentaje', 'lista', 'comparacion', 'linea', 'cita', 'ranking', 'meta', 'reparto', 'rango', 'multiplo',
              'evolucion', 'cuota', 'medidor', 'mito', 'flujo', 'balanza', 'tabla', 'claves'] },
    persiana: { nombre: 'La persiana', d: 'tarjetas de golpe a pantalla completa, con la luz de una persiana y la palabra que cae',
      tipos: ['pe_tarjeta', 'pe_lista', 'pe_cifra', 'pe_vs', 'pe_clipv', 'pe_cliph', 'pe_foto'] },
  };
  function familiaDe(tipo) { return /^pe_/.test(String(tipo || '')) ? 'persiana' : 'vidrio'; }
  NOMBRES.pe_tarjeta = 'La tarjeta'; NOMBRES.pe_lista = 'La lista que cae'; NOMBRES.pe_cifra = 'La cifra que cae';
  NOMBRES.pe_vs = 'Antes y ahora'; NOMBRES.pe_clipv = 'Tu clip vertical'; NOMBRES.pe_cliph = 'Clip horizontal'; NOMBRES.pe_foto = 'La foto que cae';
  FAMILIAS.persiana.tipos.forEach(function (k) { FORMA[k] = 'tarjeta'; });
  FORMAS.tarjeta = 'Tarjeta a pantalla completa';
  // lo que dura cada tarjeta (el taller: de 2 a 2,5 s); la lista dura hasta su última palabra
  var DURA_PE = { pe_tarjeta: 2.2, pe_cifra: 2.45, pe_vs: 2.2, pe_clipv: 2.5, pe_cliph: 2.3, pe_foto: 2.1 };
  // el fondo de la persiana: el color de la marca, blanco, papel, o que Cherry los vaya alternando
  var FONDOS_PE = { marca: 'Tu color', blanco: 'Blanco', papel: 'Papel', alterna: 'Alternar' };
  /* (29-sep, tanda 2) LA PERSIANA CON TU VIDEO: el video no se corta, se transforma y vuelve (taller: PV2, PV4, PV6 y la
     pieza 5 de la tanda 1). Llevan las mismas palabras que la tarjeta y la persona las cambia entre sí en la lista.
       · pe_ventana: tu video se encoge a una ventana 9:16 arriba y la palabra cae debajo.
       · pe_empuja: la tarjeta sube desde abajo empujando tu video; al final tu video la empuja de vuelta.
       · pe_sales: tu video queda en una tarjeta a la altura del pecho y tu cabeza se SALE por encima (tu recorte).
       · pe_tu: la tarjeta de siempre y tú, recortado, delante de la palabra.
     Te sales y Tú delante necesitan tu recorte: el ensamblador lo saca (carrete-recorte) solo para ese tramo. */
  FAMILIAS.persiana.tipos.push('pe_ventana', 'pe_empuja', 'pe_sales', 'pe_tu');
  NOMBRES.pe_ventana = 'La ventana'; NOMBRES.pe_empuja = 'La tarjeta empuja'; NOMBRES.pe_sales = 'Te sales de la tarjeta'; NOMBRES.pe_tu = 'Tú delante';
  FORMA.pe_ventana = 'ventana'; FORMA.pe_empuja = 'empuja'; FORMA.pe_sales = 'sales'; FORMA.pe_tu = 'tu';
  FORMAS.ventana = 'Tu video en una ventana'; FORMAS.empuja = 'La tarjeta empuja tu video'; FORMAS.sales = 'Te sales de la tarjeta'; FORMAS.tu = 'Tú delante de la palabra';
  DURA_PE.pe_ventana = 2.65; DURA_PE.pe_empuja = 2.65; DURA_PE.pe_sales = 2.3; DURA_PE.pe_tu = 2.0;
  // las piezas de UNA palabra (grande y chica): se pueden cambiar entre sí
  var PALABRA_PE = ['pe_tarjeta', 'pe_ventana', 'pe_empuja', 'pe_sales', 'pe_tu'];
  // mientras están, los subtítulos no se ven (el ensamblador los calla y la vista previa también)
  var CALLAN = { tarjeta: 1, ventana: 1, empuja: 1, sales: 1, tu: 1 };
  // las que necesitan tu recorte
  var CON_PERSONA = { sales: 1, tu: 1 };
  /* (2-oct-2026) LA PANTALLA CON SELLO (el gancho del Día 2, vuelto pieza): cuando la persona dice una creencia que va a
     desmentir, sube una pantalla del celular DETRÁS de ella con la creencia escrita (con una hora: la alarma con la rueda;
     sin hora: unos ajustes con un interruptor) y en la palabra de la corrección cae el sello rojo. Forma «falso»: tu video
     queda de fondo, tú delante de la pantalla (tu recorte) y los subtítulos siguen. marcas: [la creencia, la corrección]. */
  FAMILIAS.persiana.tipos.push('pe_falso');
  NOMBRES.pe_falso = 'La pantalla con sello'; FORMA.pe_falso = 'falso'; FORMAS.falso = 'Una pantalla detrás de ti, con sello';
  CON_PERSONA.falso = 1;
  /* (2-oct) LA TARJETA PLENA (las horas del Día 2): de 2 a 4 valores dichos seguidos; el video se oscurece y una tarjeta de
     color pleno muestra el valor gigante, y cambia DE GOLPE de color y de dato en cada uno. Forma «tarjeta» (tapa, calla los
     subtítulos, va después de ellos). marcas: una por valor. */
  FAMILIAS.persiana.tipos.push('pe_plena');
  NOMBRES.pe_plena = 'La tarjeta plena'; FORMA.pe_plena = 'tarjeta';
  /* (2-oct) BLANCO Y NEGRO + UN SOLO COLOR (el cronómetro neón del Día 2): mientras se dice EL dato, el video pasa a blanco
     y negro (lo hace el ensamblador con filtroBN) y lo único con color es el dato, en un anillo, con su nota a mano. Forma
     «bn»: capa del cuadro entero encima del video gris; los subtítulos siguen. marcas: [el dato, la nota]. */
  FAMILIAS.persiana.tipos.push('pe_bn');
  NOMBRES.pe_bn = 'Blanco y negro + tu color'; FORMA.pe_bn = 'bn'; FORMAS.bn = 'Tu video en blanco y negro';
  /* El filtro de ffmpeg que pone el video en blanco y negro en los tramos de las piezas «bn» (entra en 0,3 s, sale en 0,25 s).
     t = segundos del video completo (la rejilla de pedazos.js y la pasada única lo conservan). null si no hay ninguna. */
  function filtroBN(piezas, entrada, salida) {
    var bn = (piezas || []).filter(function (p) { return p && p.forma === 'bn'; });
    if (!bn.length) return null;
    var f = bn.map(function (p) {
      var a = Number(p.t0).toFixed(3), b = Number(p.t1).toFixed(3);
      return "hue=s='1-clip((t-" + a + ")/0.3\,0\,1)*clip((" + b + "-t)/0.25\,0\,1)':enable='between(t," + (Number(p.t0) - 0.05).toFixed(3) + ',' + (Number(p.t1) + 0.05).toFixed(3) + ")'";
    });
    return entrada + f.join(',') + salida;
  }
  /* El segundo en que cae el sello: en la corrección si llega entre 1,2 y 5 s después; si no, 2 s después de empezar */
  function selloDe(p) {
    var m = p.marcas || [], a = Number(p.t0) + 0.04;
    var b = m.length > 1 ? Number(m[1]) : NaN;
    return (isFinite(b) && b - a >= 1.2 && b - a <= 5) ? b : a + 2.0;
  }
  /* Cómo se mueve tu video (lo mismo en el ensamblador, en la vista previa y en la pieza de Remotion): escala s, esquina
     ox/oy en fracciones de W/H, entrada a y salida b en segundos, y la curva inOutPow de potencia pw. Medidas del taller
     (1080x1920): la ventana 580x1031 en (250,170); te sales al 78 % bajado 190 px; empuja sube el video entero. */
  var MUEVE = { ventana: { s: 580 / 1080, ox: 250 / 1080, oy: 170 / 1920, a: 0.45, b: 0.45, pw: 3 },
                empuja: { s: 1, ox: 0, oy: -1, a: 0.5, b: 0.5, pw: 3.2 },
                sales: { s: 0.78, ox: (1 - 0.78) / 2, oy: 190 / 1920, a: 0.45, b: 0.45, pw: 3 } };
  var INICIO = 1.5, FINAL = 1.2, MIN = 3.4, MAX = 7.5, TRANS = 0.55, SALIDA = 0.6;
  var FONDO = '#0B0709', TINTA = '#F4ECE7';
  // letras (en la página vienen de Google Fonts; en el ensamblador, de fonts/ en S3 con estos mismos nombres)
  var FUENTES = ['900 40px Outfit', '700 40px Outfit', '500 20px "DM Mono"', 'italic 400 40px "Instrument Serif"', 'italic 900 40px "Playfair Display"'];

  /* ══ Ajustes ══ {cantidad: pocos|medio|muchos, color: nombre o #RRGGBB, estilo: clasico|premium}. Sin cantidad = apagados. */
  var ESTILOS = { clasico: 'Clásico', premium: 'Premium' };
  /* ══ Lo que fija la persona desde el guion (20-sep) ══ cfg.fijos = {si:[{desde,hasta}], no:[...]}
     en números de palabra. «no» quita lo que caiga ahí, pase lo que pase. «sí» obliga a que salga:
     se salta el cupo y el aire. Lo que la persona decide no se discute; la IA reparte el resto. */
  function zonas(v) {
    return (Array.isArray(v) ? v : []).map(function (z) {
      return { desde: Math.round(Number(z && z.desde)), hasta: Math.round(Number(z && z.hasta)) };
    }).filter(function (z) { return isFinite(z.desde) && isFinite(z.hasta) && z.hasta >= z.desde; });
  }
  function limpiarFijos(f) {
    if (!f || typeof f !== 'object') return null;
    var si = zonas(f.si), no = zonas(f.no);
    return si.length || no.length ? { si: si, no: no } : null;
  }
  function enZona(m, zs) {
    return (zs || []).some(function (z) { return Number(m.desde) <= z.hasta && Number(m.hasta) >= z.desde; });
  }

  function limpiar(cfg) {
    if (!cfg || typeof cfg !== 'object' || !CANTIDAD[cfg.cantidad]) return null;
    var c = String(cfg.color || 'cherry');
    if (!COLORES[c] && !/^#[0-9a-fA-F]{6}$/.test(c)) c = 'cherry';
    /* «detras» (20-sep): el grafico deja de ir encima y pasa DETRAS de la persona. Cherry saca su
       silueta (carrete-recorte) y compone en tres capas. Nada le tapa la cara. */
    /* (29-sep) las familias escogidas (sin ninguna = la de siempre) y el fondo de la persiana */
    var fam = (Array.isArray(cfg.familias) ? cfg.familias : []).filter(function (k, i, l) { return FAMILIAS[k] && l.indexOf(k) === i; });
    if (!fam.length) fam = ['vidrio'];
    /* (29-sep) la pieza que escogió la persona para cada gráfico de una palabra: {palabra donde empieza: tipo} */
    var vari = {}, nv = 0;
    if (cfg.variantes && typeof cfg.variantes === 'object') Object.keys(cfg.variantes).forEach(function (k) {
      var n = Math.round(Number(k)), v = String(cfg.variantes[k]);
      if (nv < 80 && isFinite(n) && n >= 0 && PALABRA_PE.indexOf(v) >= 0) { vari[n] = v; nv++; }
    });
    return { cantidad: cfg.cantidad, color: c, estilo: cfg.estilo === 'premium' ? 'premium' : 'clasico',
             detras: !!cfg.detras, fijos: limpiarFijos(cfg.fijos), familias: fam,
             fondo: FONDOS_PE[cfg.fondo] ? cfg.fondo : 'marca', variantes: vari };
  }
  function rgb(hex) { var n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function paleta(color) {
    var ac = COLORES[color] || (/^#[0-9a-fA-F]{6}$/.test(String(color)) ? color : COLORES.cherry);
    var c = rgb(ac), lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    return { acento: ac, sobre: lum > 0.55 ? FONDO : '#FFFFFF', fondo: FONDO, tinta: TINTA };
  }

  /* Tiempo de las palabras (nominal) → tiempo del video real (igual que apoyo.js) */
  function reloj(nominales, reales) {
    if (!Array.isArray(nominales) || !Array.isArray(reales) || nominales.length !== reales.length || !reales.length) return function (t) { return t; };
    var ini = [], desp = [], an = 0, ar = 0;
    nominales.forEach(function (d, i) { ini.push(an); desp.push(ar - an); an += Number(d); ar += Number(reales[i]); });
    return function (t) { var k = 0; while (k + 1 < ini.length && t >= ini[k + 1] - 0.0005) k++; return t + desp[k]; };
  }

  /* ══ Lo que trae la IA, en limpio ══ datos cortos y marcas (números de palabra) en orden y dentro del video */
  var txt = function (s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
  var numero = function (v) { var x = Number(v); return isFinite(x) ? x : null; };
  var may = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  // «10 mil», «3 años», pero «10M», «70%», «5k»: las palabras llevan espacio
  var sufijo = function (s) { s = txt(s, 8); return /^[a-záéíóúñ]{2,}/i.test(s) ? ' ' + s : s; };
  function limpiarDatos(m, nPal) {
    var d = m && m.datos && typeof m.datos === 'object' ? m.datos : {};
    var marcas = (Array.isArray(m.marcas) ? m.marcas : []).map(function (x) { return Math.round(Number(x)); })
      .filter(function (x) { return isFinite(x) && x >= 0 && x < nPal; });
    for (var i = 1; i < marcas.length; i++) if (marcas[i] < marcas[i - 1]) marcas[i] = marcas[i - 1];
    var dec = Math.max(0, Math.min(2, Math.round(Number(d.decimales) || 0)));
    var o = null;
    if (m.tipo === 'numero') {
      var v = numero(d.valor);
      if (v == null || !marcas.length) return null;
      o = { valor: v, decimales: dec, prefijo: txt(d.prefijo, 3), sufijo: sufijo(d.sufijo), etiqueta: may(txt(d.etiqueta, 30)), chip: d.chip ? txt(d.chip, 24) : '' };
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'porcentaje') {
      var p = numero(d.valor);
      if (p == null || p < 0 || p > 100 || !marcas.length) return null;
      o = { valor: p, etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 44)) };
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'lista') {
      var items = (Array.isArray(d.items) ? d.items : []).map(function (x) { return may(txt(x, 30)); }).filter(Boolean).slice(0, 4);
      if (items.length < 2) return null;
      while (marcas.length < items.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      var tl = txt(d.titulo, 30);
      o = { titulo: tl ? tl.charAt(0).toLowerCase() + tl.slice(1) : tl, items: items };   // va después del número: «3 errores…»
      marcas = marcas.slice(0, items.length);
    } else if (m.tipo === 'comparacion') {
      var a = d.a || {}, b = d.b || {}, va = numero(a.valor), vb = numero(b.valor);
      if (va == null || vb == null || va < 0 || vb < 0 || (va === 0 && vb === 0)) return null;
      while (marcas.length < 2) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      var ins = d.insignia ? txt(d.insignia, 6) : '';
      if (!ins && va > 0 && vb / va >= 1.5) { var r = vb / va; ins = '×' + (Math.abs(r - Math.round(r)) < 0.05 ? Math.round(r) : r.toFixed(1).replace('.', ',')); }
      o = { etiqueta: may(txt(d.etiqueta, 28)), prefijo: txt(d.prefijo, 3), sufijo: sufijo(d.sufijo), decimales: dec, insignia: ins,
            a: { texto: may(txt(a.texto || 'Antes', 12)), valor: va }, b: { texto: may(txt(b.texto || 'Hoy', 12)), valor: vb } };
      marcas = marcas.slice(0, 2);
    } else if (m.tipo === 'linea') {
      var hitos = (Array.isArray(d.hitos) ? d.hitos : []).map(function (h) { return { fecha: txt(h && h.fecha, 10), texto: may(txt(h && h.texto, 18)) }; })
        .filter(function (h) { return h.fecha; }).slice(0, 4);
      if (hitos.length < 2) return null;
      while (marcas.length < hitos.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { titulo: may(txt(d.titulo, 26)), hitos: hitos };
      marcas = marcas.slice(0, hitos.length);
    } else if (m.tipo === 'ranking' || m.tipo === 'reparto' || m.tipo === 'evolucion') {
      // items: [["Nombre", numero], ...] — ranking ya ordenado de mayor a menor, evolucion en orden de tiempo
      var pares = (Array.isArray(d.items) ? d.items : []).map(function (x) {
        if (Array.isArray(x)) return [may(txt(x[0], 18)), numero(x[1])];
        if (x && typeof x === 'object') return [may(txt(x.texto || x.nombre, 18)), numero(x.valor)];
        return null;
      }).filter(function (x) { return x && x[0] && x[1] != null && x[1] >= 0; });
      var tope = m.tipo === 'evolucion' ? 7 : 5;
      pares = pares.slice(0, tope);
      if (pares.length < (m.tipo === 'evolucion' ? 3 : 2)) return null;
      if (m.tipo === 'ranking') pares.sort(function (a, b) { return b[1] - a[1]; });
      while (marcas.length < pares.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 44)), sufijo: sufijo(d.sufijo), items: pares };
      if (m.tipo === 'reparto') o.etiqueta = '';               // el reparto lleva solo titulo
      marcas = marcas.slice(0, pares.length);
    } else if (m.tipo === 'meta') {
      var mv = numero(d.valor), mm = numero(d.meta);
      if (mv == null || mm == null || mm <= 0 || mv < 0) return null;
      o = { etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 44)), valor: Math.min(mv, mm), meta: mm,
            sufijo: sufijo(d.sufijo), pie: d.pie ? txt(d.pie, 24) : '', pieMeta: d.pieMeta ? txt(d.pieMeta, 20) : '' };
      if (!marcas.length) marcas = [Number(m.desde) || 0];
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'rango') {
      var rd = numero(d.desde), rh = numero(d.hasta);
      if (rd == null || rh == null || rh <= rd) return null;
      while (marcas.length < 2) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 44)), prefijo: txt(d.prefijo, 3),
            sufijo: sufijo(d.sufijo), desde: rd, hasta: rh, decimales: dec, pie: d.pie ? txt(d.pie, 24) : '' };
      marcas = marcas.slice(0, 2);
    } else if (m.tipo === 'multiplo') {
      var vx = numero(d.veces);
      if (vx == null || vx < 1.5 || vx > 100) return null;
      o = { etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 40)), veces: vx, pie: d.pie ? txt(d.pie, 30) : '' };
      if (!marcas.length) marcas = [Number(m.desde) || 0];
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'cuota') {
      var ct = Math.round(Number(d.total)), cl = Math.round(Number(d.llenas));
      if (!isFinite(ct) || !isFinite(cl) || ct < 2 || ct > 10 || cl < 0 || cl > ct) return null;
      o = { etiqueta: may(txt(d.etiqueta, 30)), total: ct, llenas: cl, titulo: may(txt(d.titulo, 40)) };
      if (!marcas.length) marcas = [Number(m.desde) || 0];
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'medidor') {
      var md = numero(d.valor);
      if (md == null || md < 0 || md > 100) return null;
      o = { valor: md, etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 44)) };
      if (!marcas.length) marcas = [Number(m.desde) || 0];
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'mito') {
      var mi = txt(d.mito, 52), re = txt(d.realidad, 52);
      if (!mi || !re) return null;
      o = { mito: may(mi), realidad: may(re) };
      while (marcas.length < 2) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      marcas = marcas.slice(0, 2);
    } else if (m.tipo === 'flujo') {
      var pasos = (Array.isArray(d.pasos) ? d.pasos : Array.isArray(d.items) ? d.items : [])
        .map(function (x) { return may(txt(x, 26)); }).filter(Boolean).slice(0, 4);
      if (pasos.length < 3) return null;
      while (marcas.length < pasos.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 40)), pasos: pasos };
      marcas = marcas.slice(0, pasos.length);
    } else if (m.tipo === 'balanza') {
      var ba = d.a || {}, bb = d.b || {}, bva = numero(ba.valor), bvb = numero(bb.valor);
      if (bva == null || bvb == null || bva < 0 || bvb < 0 || (bva === 0 && bvb === 0)) return null;
      var gana = String(d.ganador || '').toLowerCase();
      o = { etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 46)), prefijo: txt(d.prefijo, 3),
            sufijo: sufijo(d.sufijo), decimales: dec, ganador: gana === 'a' || gana === 'b' ? gana : (bvb >= bva ? 'b' : 'a'),
            a: { texto: may(txt(ba.texto || 'Uno', 20)), valor: bva }, b: { texto: may(txt(bb.texto || 'Otro', 20)), valor: bvb } };
      while (marcas.length < 2) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      marcas = marcas.slice(0, 2);
    } else if (m.tipo === 'tabla') {
      var filas = (Array.isArray(d.filas) ? d.filas : []).map(function (x) {
        if (!Array.isArray(x)) return null;
        var et = may(txt(x[0], 30));
        return et ? [et, !!x[1], !!x[2]] : null;
      }).filter(Boolean).slice(0, 5);
      if (filas.length < 2) return null;
      while (marcas.length < filas.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 40)),
            a: may(txt(d.a || 'Uno', 12)), b: may(txt(d.b || 'Otro', 12)), filas: filas };
      marcas = marcas.slice(0, filas.length);
    } else if (m.tipo === 'claves') {
      var cls = (Array.isArray(d.claves) ? d.claves : Array.isArray(d.items) ? d.items : [])
        .map(function (x) { return may(txt(x, 30)); }).filter(Boolean).slice(0, 3);
      if (cls.length < 2) return null;
      while (marcas.length < cls.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { etiqueta: may(txt(d.etiqueta, 30)), titulo: may(txt(d.titulo, 34)), claves: cls };
      marcas = marcas.slice(0, cls.length);
    } else if (m.tipo === 'cita') {
      var t = txt(d.texto, 110);
      if (!t || !d.autor) return null;
      o = { texto: may(t), autor: txt(d.autor, 30) };
      if (!marcas.length) marcas = [Number(m.desde) || 0];
      marcas = marcas.slice(0, 1);
    } else if (PALABRA_PE.indexOf(m.tipo) >= 0) {
      // la palabra clave (grande) y 1 a 3 palabras vecinas (la cursiva)
      var gr = txt(d.grande, 18).replace(/…$/, '');
      if (!gr || !marcas.length) return null;
      var ch = txt(d.chica, 26).toLowerCase();
      // (29-sep) la cursiva que repite la palabra grande no suma nada (la IA a veces lo hace: «esta plataforma»)
      if (ch && ch.indexOf(gr.toLowerCase()) >= 0) ch = '';
      o = { grande: may(gr), chica: ch };
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'pe_lista') {
      var its = (Array.isArray(d.items) ? d.items : []).map(function (x) { return may(txt(x, 14).replace(/…$/, '')); }).filter(Boolean).slice(0, 5);
      if (its.length < 3) return null;
      while (marcas.length < its.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { items: its };
      marcas = marcas.slice(0, its.length);
    } else if (m.tipo === 'pe_cifra') {
      var vc = numero(d.valor);
      if (vc == null || vc < 0 || !marcas.length) return null;
      var sfc = String(d.sufijo || '').trim(); sfc = sfc === '%' ? '%' : (sfc === 'M' || sfc === 'k' ? sfc : (sfc === 'mil' ? ' mil' : ''));
      o = { valor: vc, decimales: dec, prefijo: txt(d.prefijo, 2), sufijo: sfc, unidad: txt(d.unidad, 18).toLowerCase() };
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'pe_falso') {
      // (2-oct) la creencia (el título de la pantalla), la hora si la trae («7:00 p. m.») y la palabra del sello
      var cr = txt(d.creencia || d.titulo, 40).replace(/…$/, '');
      if (!cr || !marcas.length) return null;
      var hm = /^(\d{1,2})(?::(\d{2}))?\s*([ap])/i.exec(String(d.hora || '').trim());
      var hn = hm ? Math.max(1, Math.min(12, Number(hm[1]))) : 0;
      var sl = String(d.sello || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
      o = { titulo: cr.charAt(0).toUpperCase() + cr.slice(1), hora: hm ? hn + ':' + String(Number(hm[2] || 0)).padStart(2, '0') + (/p/i.test(hm[3]) ? ' p. m.' : ' a. m.') : '',
            sello: ['FALSO', 'MITO', 'NO', 'MENTIRA'].indexOf(sl) >= 0 ? sl : 'FALSO' };
      marcas = marcas.slice(0, 2);
    } else if (m.tipo === 'pe_plena') {
      // (2-oct) 2 a 4 valores: el valor (máx. 7), lo que va debajo en grande (PM, %, mil…) y una nota en cursiva
      var ip = (Array.isArray(d.items) ? d.items : []).map(function (x) {
        x = x || {};
        var v = txt(x.valor, 7).replace(/…$/, '');
        return v ? { valor: v.toUpperCase(), sub: txt(x.sub, 4).replace(/…$/, '').toUpperCase(), nota: txt(x.nota, 22).toLowerCase() } : null;
      }).filter(Boolean).slice(0, 4);
      if (ip.length < 2) return null;
      while (marcas.length < ip.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { etiqueta: txt(d.etiqueta, 26).toLowerCase(), items: ip };
      marcas = marcas.slice(0, ip.length);
    } else if (m.tipo === 'pe_bn') {
      // (2-oct) el dato (número o texto corto, máx. 8), su etiqueta y la nota a mano
      var vb = txt(d.valor, 9).replace(/…$/, '');
      if (!vb || !marcas.length) return null;
      o = { valor: vb, etiqueta: txt(d.etiqueta, 24), nota: txt(d.nota, 22).toLowerCase() };
      marcas = marcas.slice(0, 2);
    } else if (m.tipo === 'pe_vs') {
      var ar = may(txt(d.arriba, 12).replace(/…$/, '')), ab = may(txt(d.abajo, 12).replace(/…$/, ''));
      if (!ar || !ab) return null;
      if (!marcas.length) marcas = [Number(m.desde) || 0];
      o = { arriba: ar, abajo: ab, medio: txt(d.medio || 'vs', 6) || 'vs' };
      marcas = marcas.slice(0, 2);
    } else return null;
    return { datos: o, marcas: marcas };
  }

  /* ══ Cuáles se usan ══ graficos: {momentos}, palabras: [{start,end}], aReal: función de tiempo, dur: duración del video,
     ocupados: [{t0,t1}] (las escenas de apoyo que ya salen: nunca encima). */
  function elegir(graficos, palabras, aReal, cfg, dur, ocupados) {
    cfg = limpiar(cfg);
    var momentos = graficos && Array.isArray(graficos.momentos) ? graficos.momentos : [];
    if (!cfg || !momentos.length || !Array.isArray(palabras) || !palabras.length) return [];
    var f = aReal || function (t) { return t; };
    var reglas = CANTIDAD[cfg.cantidad];
    dur = Number(dur) || f(Number(palabras[palabras.length - 1].end) || 0);
    var tope = Math.max(1, Math.floor(dur / reglas.cada));
    var fijos = cfg.fijos || null;
    var pedido = function (m) { return !!(fijos && enZona(m, fijos.si)); };
    var vetado = function (m) { return !!(fijos && enZona(m, fijos.no)); };
    // los que la persona pidió van PRIMERO, y después los demás por fuerza
    var orden = momentos.map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) {
        var pa = pedido(a.m) ? 1 : 0, pb = pedido(b.m) ? 1 : 0;
        return pb - pa || (b.m.fuerza || 1) - (a.m.fuerza || 1) || (a.m.desde || 0) - (b.m.desde || 0);
      });
    var puestos = [], auto = 0;                                  // «auto» = los que pone Cherry sola
    /* (29-sep) Con familias MEZCLADAS, a igual fuerza va primero la familia que menos lleva: así salen las dos de verdad
       y no gana siempre la que marcó más fuerte. Con una sola familia el orden es el de siempre. */
    var mezcla = cfg.familias.length > 1, cuenta = {}, quedan = orden.slice();
    var antes = function (a, b) {
      var pa = pedido(a) ? 1 : 0, pb = pedido(b) ? 1 : 0;
      if (pa !== pb) return pa > pb;
      if ((a.fuerza || 1) !== (b.fuerza || 1)) return (a.fuerza || 1) > (b.fuerza || 1);
      var ca = cuenta[familiaDe(a.tipo)] || 0, cb = cuenta[familiaDe(b.tipo)] || 0;
      if (ca !== cb) return ca < cb;
      return (a.desde || 0) < (b.desde || 0);
    };
    while (quedan.length) {
      var ix = 0;
      if (mezcla) for (var q = 1; q < quedan.length; q++) if (quedan[q].m && (!quedan[ix].m || antes(quedan[q].m, quedan[ix].m))) ix = q;
      var m = quedan.splice(ix, 1)[0].m;
      // (29-sep) la persona cambió esta pieza por otra de una palabra (la ventana, empuja…)
      if (m && cfg.variantes && cfg.variantes[m.desde] && PALABRA_PE.indexOf(m.tipo) >= 0) m = Object.assign({}, m, { tipo: cfg.variantes[m.desde], variante: true });
      if (!m || !FORMA[m.tipo]) continue;
      if (cfg.familias.indexOf(familiaDe(m.tipo)) < 0) continue;   // (29-sep) una familia que no escogió
      if (vetado(m)) continue;                                   // aquí NO, dijo la persona
      var suyo = pedido(m);                                      // aquí SÍ: va aparte del cupo y del aire
      if (!suyo && auto >= tope) continue;                       // el nivel limita a Cherry, no a la persona
      if (!suyo && (m.fuerza || 1) < reglas.fuerza) continue;
      var w0 = palabras[m.desde], w1 = palabras[m.hasta];
      if (!w0 || !w1) continue;
      /* (29-sep) la tarjeta de la persiana sin palabra grande: la palabra que se dice en ese instante (la marcada) */
      if (PALABRA_PE.indexOf(m.tipo) >= 0 && !(m.datos && String(m.datos.grande || '').trim()) && Array.isArray(m.marcas) && palabras[m.marcas[0]]) {
        var dicha = String(palabras[m.marcas[0]].word || '').replace(/[^0-9A-Za-zÀ-ɏ]+/g, '');
        m = Object.assign({}, m, { datos: Object.assign({}, m.datos, { grande: dicha }) });
      }
      var ld = limpiarDatos(m, palabras.length);
      if (!ld) continue;
      var marcas = ld.marcas.map(function (i) { return f(Number(palabras[i].start)); });
      var fin = f(Number(w1.end));
      /* (29-sep) la persiana entra JUSTO cuando se dice la palabra (corte seco) y dura lo suyo, no lo del vidrio */
      var pe = familiaDe(m.tipo) === 'persiana';
      var t0 = pe ? marcas[0] - 0.04 : Math.min(f(Number(w0.start)), marcas[0]) - 0.35;
      if (marcas[0] < INICIO + 0.2 && !suyo) continue;     // el borde cede ante lo que pide la persona
      t0 = Math.max(t0, INICIO);
      var ultimo = Math.max(marcas[marcas.length - 1], fin);
      var t1 = pe
        ? (m.tipo === 'pe_lista' ? Math.min(t0 + 4.5, Math.max(t0 + 2.0, marcas[marcas.length - 1] + 1.0))
           : m.tipo === 'pe_falso' ? selloDe({ t0: t0, marcas: marcas }) + 1.4
           : m.tipo === 'pe_bn' ? Math.min(t0 + 6, Math.max(t0 + 3.2, marcas[marcas.length - 1] + 1.8))
           : m.tipo === 'pe_plena' ? Math.min(t0 + 8, Math.max(t0 + 2.4, marcas[marcas.length - 1] + 1.5)) : t0 + (DURA_PE[m.tipo] || 2.2))
        : Math.min(t0 + MAX, Math.max(t0 + MIN, ultimo + 2.2));
      if (t1 > dur - FINAL) t1 = dur - FINAL;
      if (t1 - t0 < (pe ? 1.6 : 2.8)) continue;
      // el que pidió la persona solo cede si se solapa DE VERDAD con otro (sin exigirle aire)
      var aire = suyo ? 0 : reglas.aire;
      var choca = puestos.some(function (p) { return t0 < p.t1 + aire && t1 > p.t0 - aire; }) ||
        (!suyo && (ocupados || []).some(function (o) { return t0 < o.t1 + 0.6 && t1 > o.t0 - 0.6; }));
      if (choca) continue;
      if (!suyo) auto++;
      cuenta[familiaDe(m.tipo)] = (cuenta[familiaDe(m.tipo)] || 0) + 1;
      puestos.push({ t0: r3(t0), t1: r3(t1), tipo: m.tipo, forma: pe ? FORMA[m.tipo] : (cfg.detras ? 'profundo' : FORMA[m.tipo]), datos: ld.datos, marcas: marcas.map(r3), fin: r3(fin),
                     desde: m.desde, hasta: m.hasta, fuerza: m.fuerza || 1, variante: !!m.variante });
    }
    puestos.sort(function (a, b) { return a.t0 - b.t0; });
    return ponerFondos(puestos, cfg.fondo);
  }
  /* El fondo de cada tarjeta de la persiana: el mismo para todas, o alternando en el orden en que salen */
  function ponerFondos(piezas, fondo) {
    var k = 0, ciclo = ['marca', 'blanco', 'papel'];
    (piezas || []).forEach(function (p) {
      if (familiaDe(p.tipo) !== 'persiana') return;
      var f0 = fondo === 'alterna' ? ciclo[k++ % 3] : (FONDOS_PE[fondo] ? fondo : 'marca');
      p.datos = Object.assign({}, p.datos, { fondo: f0 });
    });
    return piezas;
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }

  /* ══ PANTALLAS (24-sep-2026) ══ Las grabaciones de pantalla que la persona pone en su guion, dentro
     de la plantilla del navegador. No las elige la IA: van donde las puso, atadas a sus PALABRAS (no a
     segundos) para que se muevan con la frase si cambian los cortes o las pausas. Y mandan: el grafico
     de la IA que se cruce con una pantalla, no sale.
     Sergio escogio dos formas: «tu arriba, la pantalla abajo» (partida) y «la pantalla arriba, detras de
     ti» (profundo: su pelo y sus hombros quedan delante de la ventana). */
  var FORMAS_PANTALLA = { partida: 'T\u00fa arriba, pantalla abajo', invertida: 'Pantalla arriba, t\u00fa abajo', profundo: 'Pantalla arriba, detr\u00e1s de ti',
    tarjeta: 'En una tarjeta (La persiana)' };
  var URL_PANTALLA = /^https:\/\/[a-z0-9.-]+\.amazonaws\.com\/clips\/pantallas\/[0-9a-f-]{36}\.(mp4|png)$/;
  /* (24-sep) el color de una pantalla: uno de la lista o #RRGGBB; si no, ninguno (manda el de Gráficos) */
  function colorPantalla(c) {
    c = String(c == null ? '' : c).trim();
    return COLORES[c] ? c : (/^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : '');
  }
  function limpiarPantallas(v) {
    var txt = function (x, k) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, k); };
    return (Array.isArray(v) ? v : []).map(function (x) {
      if (!x || typeof x !== 'object') return null;
      var d = Math.round(Number(x.desde)), h = Math.round(Number(x.hasta));
      if (!isFinite(d) || !isFinite(h) || d < 0 || h < d || !URL_PANTALLA.test(String(x.url || ''))) return null;
      return { id: txt(x.id, 40), desde: d, hasta: h, forma: FORMAS_PANTALLA[x.forma] ? x.forma : 'partida',
               url: String(x.url), tipo: x.tipo === 'imagen' ? 'imagen' : 'video', tapa: txt(x.tapa, 300),
               ancho: Number(x.ancho) || 1920, alto: Number(x.alto) || 1080, dur: Number(x.dur) || 0, inicio: Math.max(0, Number(x.inicio) || 0),
               titulo: txt(x.titulo, 60), etiqueta: txt(x.etiqueta, 30), dir: txt(x.dir, 60), color: colorPantalla(x.color) };
    }).filter(Boolean).slice(0, 30);
  }
  /* (29-sep) Una pantalla «en tarjeta»: la pieza de la persiana que va con lo que es. Un video vertical o una captura
     vertical cae girando (clip vertical); uno horizontal entra deslizándose (clip horizontal); una foto cae como una
     polaroid. La palabra grande es su título y la cursiva su etiqueta. */
  function tipoTarjeta(x) {
    var an = Number(x.ancho) || 1920, al = Number(x.alto) || 1080;
    if (x.tipo === 'imagen') return al > an * 1.1 ? 'pe_clipv' : (an > al * 1.25 ? 'pe_cliph' : 'pe_foto');
    return al > an * 1.1 ? 'pe_clipv' : 'pe_cliph';
  }
  function piezaTarjeta(x, t0, t1) {
    var tipo = tipoTarjeta(x);
    var pz = { t0: r3(t0), t1: r3(t1), tipo: tipo, forma: 'tarjeta', pantalla: x.id || true, marcas: [r3(t0)], fin: r3(t1), desde: x.desde, hasta: x.hasta, fuerza: 3,
               datos: { medio: x.url, ancho: x.ancho, alto: x.alto, dur: x.dur, desde: x.inicio, imagen: x.tipo === 'imagen',
                        grande: x.titulo ? txt(x.titulo, 14).replace(/…$/, '') : '', chica: x.etiqueta ? x.etiqueta.toLowerCase() : '' } };
    if (x.color) pz.color = x.color;
    return pz;
  }
  function piezasPantallas(pantallas, palabras, aReal, dur) {
    var f = aReal || function (t) { return t; };
    var lista = limpiarPantallas(pantallas);
    if (!lista.length || !Array.isArray(palabras) || !palabras.length) return [];
    dur = Number(dur) || f(Number(palabras[palabras.length - 1].end) || 0);
    var out = [];
    lista.forEach(function (x) {
      var w0 = palabras[x.desde], w1 = palabras[Math.min(x.hasta, palabras.length - 1)];
      if (!w0 || !w1) return;
      if (x.forma === 'tarjeta') {
        // entra con la primera palabra (corte seco) y dura lo de la pieza, o hasta su última palabra (tope 4,5 s)
        var ta = Math.max(0.1, f(Number(w0.start)) - 0.04), tipoT = tipoTarjeta(x);
        var tb = Math.min(dur - 0.15, Math.max(ta + (DURA_PE[tipoT] || 2.3), Math.min(ta + 4.5, f(Number(w1.end)) + 0.3)));
        if (tb - ta >= 1) out.push(piezaTarjeta(x, ta, tb));
        return;
      }
      var t0 = Math.max(0.1, f(Number(w0.start)) - 0.35);
      var t1 = Math.min(dur - 0.15, f(Number(w1.end)) + 0.6);
      if (t1 - t0 < 1.6) t1 = Math.min(dur - 0.15, t0 + 1.6);
      if (t1 - t0 < 1) return;
      /* (24-sep) sin etiqueta (ocupaba la franja entre tu video y la ventana); «detras de ti» sin titulo:
         su ventana va arriba del todo y no queda sitio que no te tape la cara */
      var detras = x.forma === 'profundo';
      // (24-sep) «pantalla arriba, tú abajo»: la misma partida, al revés
      var pz = { t0: r3(t0), t1: r3(t1), tipo: 'navegador', forma: detras ? 'profundo' : (x.forma === 'invertida' ? 'mitadAbajo' : 'mitad'), pantalla: x.id || true,
                 marcas: [r3(t0 + 0.6)], fin: r3(t1 - 0.6), desde: x.desde, hasta: x.hasta, fuerza: 3,
                 datos: { medio: x.url, ancho: x.ancho, alto: x.alto, dur: x.dur, desde: x.inicio,
                          titulo: detras ? '' : x.titulo, etiqueta: '', url: x.dir } };
      if (x.color) pz.color = x.color;          // (24-sep) su propio color; sin él, el de Gráficos
      out.push(pz);
    });
    // dos pantallas que se pisan: la segunda empieza cuando acaba la primera
    out.sort(function (a, b) { return a.t0 - b.t0; });
    var bien = [];
    out.forEach(function (p) {
      var ult = bien[bien.length - 1];
      if (ult && p.t0 < ult.t1) { if (p.t1 <= ult.t1) return; p.t0 = ult.t1; p.marcas = [r3(p.t0 + 0.6)]; }
      if (p.t1 - p.t0 >= 1) bien.push(p);
    });
    return bien;
  }
  function sinChoques(piezas, fijas, aire) {
    aire = aire == null ? 0.4 : aire;
    return (piezas || []).filter(function (p) {
      return !(fijas || []).some(function (q) { return p.t0 < q.t1 + aire && p.t1 > q.t0 - aire; });
    });
  }
  /* (29-sep) fondo: el de la persiana; con él se vuelven a repartir los fondos de las tarjetas (las de la IA y las de las
     pantallas) en el orden en que salen, para que «alternar» alterne de verdad */
  function conPantallas(piezasIA, pantallas, palabras, aReal, dur, fondo) {
    var pp = piezasPantallas(pantallas, palabras, aReal, dur);
    var todas = !pp.length ? (piezasIA || []) : pp.concat(sinChoques(piezasIA, pp)).sort(function (a, b) { return a.t0 - b.t0; });
    return fondo ? ponerFondos(todas, fondo) : todas;
  }

  function enInstante(piezas, t) {
    for (var i = 0; i < (piezas || []).length; i++) if (t >= piezas[i].t0 && t < piezas[i].t1) return piezas[i];
    return null;
  }

  /* ══ Curvas ══ */
  function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function outCubic(x) { x = c01(x); return 1 - Math.pow(1 - x, 3); }
  function inCubic(x) { x = c01(x); return x * x * x; }
  function outQuad(x) { x = c01(x); return 1 - (1 - x) * (1 - x); }
  function outBack(x, s) { x = c01(x); s = s == null ? 1.7 : s; var c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); }
  function expo(x) { x = c01(x); return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, 10 - 20 * x)) / 2; }
  var prog = function (t, a, d) { return c01((t - a) / d); };

  /* ══ La forma: cuánto se encoge tu video y dónde queda el hueco ══ (fracciones del ancho W y del alto H) */
  function destino(forma, W, H) {
    if (forma === 'partida') return { x: 0.05, y: 0.05, w: 0.9, h: 0.38, r: 0.055 * W };
    /* (24-sep) «tu arriba, pantalla abajo» de las PANTALLAS: tu video llena la mitad de arriba de borde a borde.
       Sergio: «la parte del video de arriba no rellena la pantalla y queda una franja vacia». */
    if (forma === 'mitad') return { x: 0, y: 0, w: 1, h: 0.5, r: 0 };
    /* (24-sep) «pantalla arriba, tú abajo»: tu video llena la mitad de ABAJO. El objetivo general lo corre 33 % hacia
       abajo: se ve el mismo trozo que en «tú arriba» (la cabeza entera, cortado a la altura del pecho). */
    if (forma === 'mitadAbajo') return { x: 0, y: 0.5, w: 1, h: 0.5, r: 0 };
    if (forma === 'completa') { var h = 0.22 * W / H; return { x: 0.39, y: 0.045, w: 0.22, h: h, r: 0.11 * W }; }
    return null;
  }
  /* «Al lado» (19-sep, mockups): el video NO se encoge ni se tapa, solo se corre a la izquierda con un acercamiento
     suave para dejarle sitio al celular 3D. Sin hueco: el fondo sigue siendo tu video. */
  var LADO = { s: 1.2, ox: -0.17, oy: -0.075 };
  /* «Abajo» (20-sep, mockups): igual que LADO pero en vertical. El video se acerca y baja, la cara
     queda en la mitad de abajo y el mockup no tapa a nadie. Sin hueco: el fondo sigue siendo tu video. */
  var ABAJO = { s: 1.18, ox: 0, oy: 0.135 };
  // 0 = video completo, 1 = video en su caja; entra al empezar y sale al final
  function avance(p, t) {
    var L = p.t1 - p.t0, lt = t - p.t0, mv = MUEVE[p.forma];
    if (mv) return inOutPow(lt / mv.a, mv.pw) * (1 - inOutPow((lt - (L - mv.b)) / mv.b, mv.pw));
    return expo(lt / TRANS) * (1 - expo((lt - (L - SALIDA)) / TRANS));
  }
  function inOutPow(x, pw) { x = c01(x); return x < 0.5 ? Math.pow(2, pw - 1) * Math.pow(x, pw) : 1 - Math.pow(2, pw - 1) * Math.pow(1 - x, pw); }
  /* (29-sep) El rectángulo que ocupa tu video en el instante t (la pieza de Remotion dibuja alrededor de él) */
  function rectVideo(p, t, W, H) {
    var o = objetivo(p.forma, W, H), k = avance(p, t);
    if (!o) return { x: 0, y: 0, w: W, h: H, k: 0 };
    var sc = 1 + (o.s - 1) * k;
    return { x: o.ox * W * k, y: o.oy * H * k, w: W * sc, h: H * sc, k: k };
  }
  /* (29-sep) «La tarjeta empuja»: el desenfoque del taller (blur de hasta 16 px según la velocidad, en 1080x1920). Devuelve
     los tramos en que va fuerte, en tres escalones, para el ensamblador (gblur con enable). */
  function tramosEmpuje(p, H) {
    var mv = MUEVE.empuja, L = p.t1 - p.t0, esc = (H || 1920) / 1920;
    var borde = function (lt) { return 1920 * (1 - inOutPow(lt / mv.a, mv.pw) + inOutPow((lt - (L - mv.b)) / mv.b, mv.pw)); };
    var escalones = [[3, 6], [7, 11], [12, 16]], out = [];
    escalones.forEach(function (e, i) {
      var tramos = [], dentro = false, desde = 0;
      for (var lt = 0; lt <= L + 1e-6; lt += 1 / 60) {
        var b = Math.min(16, Math.abs(borde(lt) - borde(lt - 1 / 60)) * 0.12);
        var en = b >= e[0] && (i === escalones.length - 1 || b < escalones[i + 1][0]);
        if (en && !dentro) { dentro = true; desde = lt; }
        if (!en && dentro) { dentro = false; tramos.push([p.t0 + desde, p.t0 + lt]); }
      }
      if (dentro) tramos.push([p.t0 + desde, p.t1]);
      if (tramos.length) out.push({ sigma: Math.round(((e[0] + e[1]) / 2) * esc * 10) / 10, tramos: tramos });
    });
    return out;
  }
  function hueco(p, t, W, H) {
    var d = destino(p.forma, W, H);
    if (!d) return null;
    var k = avance(p, t);
    return { x: lerp(0, d.x * W, k), y: lerp(0, d.y * H, k), w: lerp(W, d.w * W, k), h: lerp(H, d.h * H, k), r: lerp(0, d.r, k), k: k };
  }
  /* El video: escala s y esquina (ox, oy) en fracciones de W/H. Cubre siempre el hueco (se encoge «cover», con la cara
     un poco arriba del centro). null = sin cambio. */
  function objetivo(forma, W, H) {
    if (forma === 'profundo') return null;   // el vídeo no se mueve: el gráfico va DETRÁS de ti
    if (MUEVE[forma]) return { s: MUEVE[forma].s, ox: MUEVE[forma].ox, oy: MUEVE[forma].oy };   // (29-sep) la persiana con tu video
    if (forma === 'lado') return { s: LADO.s, ox: LADO.ox, oy: LADO.oy };
    if (forma === 'abajo') return { s: ABAJO.s, ox: ABAJO.ox, oy: ABAJO.oy };
    /* (24-sep) «pantalla arriba, tú abajo»: corrido 24 % (no 33 %, lo del cálculo general). Con 33 % la boca caía al
       87 % del alto, debajo del nombre y el texto que Instagram pone encima; así la barbilla queda ~82 %. */
    if (forma === 'mitadAbajo') return { s: 1, ox: 0, oy: 0.24 };
    var d = destino(forma, W, H);
    if (!d) return null;
    var s = Math.max(d.w, d.h);
    return { s: s, ox: d.x + (d.w - s) * 0.5, oy: d.y + (d.h - s) * 0.34 };
  }
  function video(p, t, W, H) {
    if (!p || p.forma === 'encima' || p.forma === 'profundo' || t < p.t0 || t >= p.t1) return null;
    var o = objetivo(p.forma, W || 1080, H || 1920), k = avance(p, t);
    if (!o || k <= 0) return null;
    return { s: lerp(1, o.s, k), ox: o.ox * k, oy: o.oy * k };
  }
  /* Para la página: el transform de CSS con el origen en `ancla` (el mismo del movimiento), para ponerlo DELANTE del suyo */
  function css(v, ancla) {
    if (!v) return '';
    var ax = ancla ? ancla.x : 0, ay = ancla ? ancla.y : 0;
    return 'translate(' + ((v.ox - (1 - v.s) * ax) * 100).toFixed(3) + '%,' + ((v.oy - (1 - v.s) * ay) * 100).toFixed(3) + '%) scale(' + v.s.toFixed(5) + ')';
  }
  /* Para el ensamblador: el mismo encogimiento con perspective (solo mientras dura el gráfico). El tiempo de cada cuadro
     es (in - 1 + c0) / fps, igual que el movimiento. */
  function ffmpeg(p, W, H, fps, c0) {
    var o = objetivo(p.forma, W, H);
    if (!o) return null;
    fps = Number(fps) || 30; c0 = Number(c0) || 0;
    var L = p.t1 - p.t0, mv = MUEVE[p.forma];
    var E = function (r) { return 'if(lte(ld(' + r + '),0),0,if(gte(ld(' + r + '),1),1,if(lt(ld(' + r + '),0.5),pow(2,20*ld(' + r + ')-10)/2,(2-pow(2,10-20*ld(' + r + ')))/2)))'; };
    // (29-sep) la persiana con tu video: su curva (inOutPow) y sus tiempos, los mismos de la pieza de Remotion
    if (mv) E = function (r) { var q = Math.pow(2, mv.pw - 1).toFixed(6); return 'if(lt(ld(' + r + '),0.5),' + q + '*pow(ld(' + r + '),' + mv.pw + '),1-' + q + '*pow(1-ld(' + r + '),' + mv.pw + '))'; };
    var ta = mv ? mv.a : TRANS, tb = mv ? mv.b : TRANS, sal = mv ? mv.b : SALIDA;
    var pre = 'st(5,(in-1+' + c0 + ')/' + fps + '-' + p.t0.toFixed(4) + ');' +
      'st(8,clip(ld(5)/' + ta + ',0,1));st(6,' + E(8) + ');' +
      'st(8,clip((ld(5)-' + (L - sal).toFixed(4) + ')/' + tb + ',0,1));st(7,' + E(8) + ');' +
      'st(0,ld(6)*(1-ld(7)));st(1,1+' + (o.s - 1).toFixed(6) + '*ld(0));st(2,' + o.ox.toFixed(6) + '*W*ld(0));st(3,' + o.oy.toFixed(6) + '*H*ld(0));';
    var q = function (x) { return "'" + pre + x + "'"; };
    return 'perspective=x0=' + q('(0-ld(2))/ld(1)') + ':y0=' + q('(0-ld(3))/ld(1)') +
      ':x1=' + q('(W-ld(2))/ld(1)') + ':y1=' + q('(0-ld(3))/ld(1)') +
      ':x2=' + q('(0-ld(2))/ld(1)') + ':y2=' + q('(H-ld(3))/ld(1)') +
      ':x3=' + q('(W-ld(2))/ld(1)') + ':y3=' + q('(H-ld(3))/ld(1)') +
      ":sense=source:eval=frame:interpolation=linear:enable='between(t," + p.t0.toFixed(4) + ',' + p.t1.toFixed(4) + ")'" +
      (p.forma === 'empuja' ? tramosEmpuje(p, H).map(function (e) {
        return ',gblur=sigma=' + e.sigma + ":enable='" + e.tramos.map(function (x) { return 'between(t,' + x[0].toFixed(4) + ',' + x[1].toFixed(4) + ')'; }).join('+') + "'";
      }).join('') : '');
  }
  /* (29-sep) Los tramos en que los subtítulos se callan (las piezas de la persiana tapan o mueven el cuadro) */
  function callados(piezas) {
    return (piezas || []).filter(function (p) { return p && CALLAN[p.forma]; }).map(function (p) { return { t0: p.t0, t1: p.t1 }; });
  }
  /* La parte de la pantalla que puede tener algo dibujado (el ensamblador solo guarda ese rectángulo) */
  function caja(p, W, H) {
    if (p.forma === 'encima' || p.forma === 'lado') return { x: 0, y: 0, w: W, h: Math.min(H, Math.ceil(H * 0.44 / 2) * 2) };
    return { x: 0, y: 0, w: W, h: H };
  }
  // la del premium «encima» es más alta: las chispas y la tarjeta que entra desde abajo necesitan aire (nunca llega a los subtítulos)
  function cajaPremium(p, W, H) {
    /* (24-sep) el navegador «detras de ti» llega hasta el 62 % del alto (zonaMockup) y su titulo va debajo */
    if (p.forma === 'profundo' && (p.tipo === 'navegador' || p.tipo === 'telefono')) return { x: 0, y: 0, w: W, h: Math.min(H, Math.ceil(H * 0.42 / 2) * 2) };
    if (p.forma === 'encima' || p.forma === 'abajo' || p.forma === 'profundo') return { x: 0, y: 0, w: W, h: Math.min(H, Math.ceil(H * 0.56 / 2) * 2) };
    if (p.forma === 'lado') return { x: 0, y: 0, w: W, h: Math.min(H, Math.ceil(H * 0.72 / 2) * 2) };
    return { x: 0, y: 0, w: W, h: H };
  }
  // cuadros de la capa de `p` en la rejilla del video completo (cuadro n = instante n / fps)
  function cuadros(p, fps) { var n0 = Math.ceil(p.t0 * fps - 1e-6), n1 = Math.ceil(p.t1 * fps - 1e-6); return { n0: n0, n1: n1, inicio: n0 / fps, total: n1 - n0 }; }

  /* ══ Dibujo ══ */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function fuente(ctx, peso, tam, fam, estilo) { ctx.font = (estilo ? estilo + ' ' : '') + peso + ' ' + Math.max(1, tam).toFixed(2) + 'px ' + fam; }
  // tamaño que cabe en `maxW` (baja hasta el 55 %)
  function cabe(ctx, texto, peso, tam, fam, maxW, estilo) {
    fuente(ctx, peso, tam, fam, estilo);
    var w = ctx.measureText(texto).width;
    if (w <= maxW) return tam;
    var t = Math.max(tam * 0.55, tam * maxW / w);
    fuente(ctx, peso, t, fam, estilo);
    return t;
  }
  function renglones(ctx, texto, maxW) {
    var pal = String(texto).split(' '), out = [], linea = '';
    for (var i = 0; i < pal.length; i++) {
      var prueba = linea ? linea + ' ' + pal[i] : pal[i];
      if (linea && ctx.measureText(prueba).width > maxW) { out.push(linea); linea = pal[i]; } else linea = prueba;
    }
    if (linea) out.push(linea);
    return out;
  }
  // etiqueta pequeña en mayúsculas con espacio entre letras (a mano: no todos los canvas tienen letterSpacing)
  function mini(ctx, texto, x, y, u, pal, alinear, alfa) {
    texto = String(texto || '').toUpperCase();
    if (!texto) return;
    fuente(ctx, 500, 3 * u, '"DM Mono"');
    var esp = 0.42 * u, anchos = [], total = 0;
    for (var i = 0; i < texto.length; i++) { var w = ctx.measureText(texto[i]).width; anchos.push(w); total += w + (i ? esp : 0); }
    var cx = alinear === 'center' ? x - total / 2 : alinear === 'right' ? x - total : x;
    ctx.fillStyle = rgba(pal.tinta, alfa == null ? 0.62 : alfa);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var j = 0; j < texto.length; j++) { ctx.fillText(texto[j], cx, y); cx += anchos[j] + esp; }
  }
  function cifra(v, dec) {
    var n = Math.abs(v), ent = Math.floor(n + 1e-9), fr = n - ent;
    var s = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (dec > 0) s += ',' + fr.toFixed(dec).slice(2);
    return (v < 0 ? '-' : '') + s;
  }
  function tarjeta(ctx, x, y, w, h, r, u, pal) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 7 * u; ctx.shadowOffsetY = 2.5 * u;
    rrect(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(16,11,14,0.86)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    rrect(ctx, x, y, w, h, r);
    ctx.lineWidth = Math.max(1, 0.22 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.stroke();
    // filo de luz arriba
    var g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, 0.2 * u);
    ctx.beginPath(); ctx.moveTo(x + r, y + 0.5); ctx.lineTo(x + w - r, y + 0.5); ctx.stroke();
    ctx.restore();
  }
  function pastilla(ctx, texto, cx, cy, tam, pal, escala) {
    if (escala <= 0) return;
    fuente(ctx, 900, tam, 'Outfit');
    var w = ctx.measureText(texto).width + tam * 1.6, h = tam * 1.7;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(escala, escala);
    rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = pal.acento; ctx.fill();
    ctx.fillStyle = pal.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, 0, h * 0.04);
    ctx.restore();
  }
  // entrada y salida de las tarjetas «encima»
  function animTarjeta(p, t) {
    var a = prog(t, p.t0, 0.55), b = prog(t, p.t1 - 0.4, 0.4);
    return { alfa: Math.min(c01(a * 1.8), 1 - b), dy: (1 - outBack(a, 1.4)) * 6 - inCubic(b) * 5, s: 0.92 + 0.08 * outBack(a, 1.4) };
  }
  // entrada y salida de lo que va sobre el fondo (pantalla partida o completa)
  function animGrupo(p, t) {
    var a = prog(t, p.t0 + 0.35, 0.45), b = prog(t, p.t1 - SALIDA - 0.1, 0.35);
    return { alfa: outCubic(a) * (1 - b), dy: (1 - outCubic(a)) * 4 };
  }
  function conTarjeta(ctx, x, y, w, h, u, A, pintar) {
    if (A.alfa <= 0) return;
    ctx.save();
    ctx.globalAlpha = A.alfa;
    var cx = x + w / 2, cy = y + h / 2;
    ctx.translate(cx, cy + A.dy * u); ctx.scale(A.s, A.s); ctx.translate(-cx, -cy);
    pintar();
    ctx.restore();
  }

  function fondoConHueco(ctx, W, H, p, t, pal, u) {
    var hu = hueco(p, t, W, H);
    if (!hu || hu.k <= 0) return;
    ctx.save();
    ctx.fillStyle = pal.fondo; ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, H * 0.62);
    g.addColorStop(0, rgba(pal.acento, 0.17)); g.addColorStop(1, rgba(pal.acento, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sombra alrededor del video, y el hueco
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6 * u; ctx.shadowOffsetY = 2 * u;
    rrect(ctx, hu.x, hu.y, hu.w, hu.h, hu.r); ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-out';
    rrect(ctx, hu.x, hu.y, hu.w, hu.h, hu.r); ctx.fillStyle = '#000'; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (p.forma === 'completa' && hu.k > 0.85) {
      ctx.globalAlpha = (hu.k - 0.85) / 0.15;
      rrect(ctx, hu.x + 0.45 * u, hu.y + 0.45 * u, hu.w - 0.9 * u, hu.h - 0.9 * u, hu.r - 0.45 * u);
      ctx.strokeStyle = pal.acento; ctx.lineWidth = 0.9 * u; ctx.stroke();
    }
    ctx.restore();
  }

  var DIBUJO = {};
  DIBUJO.numero = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tc = p.marcas[0];
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 4.5 * u, hNum = 15 * u;
    var h = pad + 3 * u + 2 * u + hNum + (d.chip ? 2.2 * u + 6.8 * u : 0) + pad;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, W / 2, y + pad + 1.5 * u, u, pal, 'center');
      var chico = Math.abs(d.valor) < 10 && !d.decimales;
      var e = chico ? 1 : outCubic(prog(t, tc, 1.3));
      var final = (d.prefijo || '') + cifra(d.valor, d.decimales) + (d.sufijo || '');
      var tam = cabe(ctx, final, 900, hNum, 'Outfit', w - 10 * u);
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var sal = chico ? outBack(prog(t, tc - 0.1, 0.5), 2.2) : 1;
      if (sal > 0) {
        ctx.save(); ctx.translate(W / 2, y + pad + 5 * u + hNum / 2); ctx.scale(sal, sal);
        ctx.fillText((d.prefijo || '') + cifra(d.valor * e, d.decimales) + (d.sufijo || ''), 0, tam * 0.04);
        ctx.restore();
      }
      if (d.chip) pastilla(ctx, d.chip, W / 2, y + pad + 5 * u + hNum + 2.2 * u + 3.4 * u, 4 * u, pal, outBack(prog(t, tc + 1.25, 0.45), 2.4));
    });
  };
  DIBUJO.porcentaje = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tc = p.marcas[0], A = animGrupo(p, t);
    if (A.alfa <= 0) return;
    ctx.save();
    ctx.globalAlpha = A.alfa; ctx.translate(0, A.dy * u);
    var D = 30 * u, cx = 8 * u + D / 2, cy = 0.46 * H + D / 2, R = D / 2 - 1.6 * u, e = outCubic(prog(t, tc, 1.2));
    ctx.lineWidth = 3.2 * u; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    if (e > 0.001) { ctx.strokeStyle = pal.acento; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (d.valor / 100) * e); ctx.stroke(); }
    ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    cabe(ctx, cifra(Math.round(d.valor), 0) + '%', 900, 6.8 * u, 'Outfit', D - 8 * u);
    ctx.fillText(cifra(Math.round(d.valor * e), 0) + '%', cx, cy + 0.3 * u);
    // la frase al lado, que se destapa de izquierda a derecha
    var x0 = 8 * u + D + 5 * u, colW = 92 * u - x0;
    fuente(ctx, 900, 7.4 * u, 'Outfit');
    var ls = renglones(ctx, d.titulo, colW);
    var tam = 7.4 * u;
    if (ls.length > 3) { tam = 6 * u; fuente(ctx, 900, tam, 'Outfit'); ls = renglones(ctx, d.titulo, colW).slice(0, 4); }
    var alto = 3 * u + 2.4 * u + ls.length * tam * 1.05, y0 = cy - alto / 2;
    mini(ctx, d.etiqueta, x0, y0 + 1.5 * u, u, pal, 'left');
    var k = outQuad(prog(t, tc + 1.45, 0.6));
    if (k > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - u, y0 + 3.5 * u, (colW + 2 * u) * k, ls.length * tam * 1.05 + 2 * u); ctx.clip();
      fuente(ctx, 900, tam, 'Outfit');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ls.forEach(function (l, i) { ctx.fillText(l, x0, y0 + 5.4 * u + tam * 0.52 + i * tam * 1.05); });
      ctx.restore();
    }
    ctx.restore();
  };
  DIBUJO.lista = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, n = d.items.length;
    var x = 8 * u, w = 84 * u, y = 0.07 * H, pad = 4.2 * u, fila = 5.8 * u, gap = 1.7 * u;
    var h = pad + 10 * u + 2.6 * u + n * fila + (n - 1) * gap + pad;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      var xi = x + 5 * u, yb = y + pad + 8.8 * u;
      fuente(ctx, 900, 10 * u, 'Outfit');
      ctx.fillStyle = pal.acento; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      var num = String(n); ctx.fillText(num, xi, yb);
      var wn = ctx.measureText(num).width + 2.5 * u;
      cabe(ctx, d.titulo, 900, 6 * u, 'Outfit', w - 10 * u - wn);
      ctx.fillStyle = pal.tinta; ctx.fillText(d.titulo, xi + wn, yb);
      d.items.forEach(function (it, i) {
        var a = prog(t, p.marcas[i], 0.4);
        if (a <= 0) return;
        var fy = y + pad + 12.6 * u + i * (fila + gap);
        ctx.save();
        ctx.globalAlpha *= c01(a * 1.6);
        ctx.translate((1 - outBack(a, 1.8)) * -8 * u, 0);
        ctx.fillStyle = pal.acento; ctx.beginPath(); ctx.arc(xi + fila / 2, fy + fila / 2, fila / 2, 0, Math.PI * 2); ctx.fill();
        fuente(ctx, 900, 3.3 * u, 'Outfit'); ctx.fillStyle = pal.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), xi + fila / 2, fy + fila / 2 + 0.15 * u);
        cabe(ctx, it, 700, 4.4 * u, 'Outfit', w - 10 * u - fila - 3 * u);
        ctx.fillStyle = pal.tinta; ctx.textAlign = 'left';
        ctx.fillText(it, xi + fila + 3 * u, fy + fila / 2 + 0.2 * u);
        ctx.restore();
      });
    });
  };
  DIBUJO.comparacion = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, ta = p.marcas[0], tb = p.marcas[1], A = animGrupo(p, t);
    if (A.alfa <= 0) return;
    ctx.save();
    ctx.globalAlpha = A.alfa; ctx.translate(0, A.dy * u);
    var x0 = 10 * u, cw = 80 * u, top = 0.205 * H, chH = 0.37 * H;
    var railH = 0.76 * chH, railTop = top + chH - railH, railW = 0.26 * cw;
    var xa = x0 + 0.08 * cw, xb = x0 + cw - 0.08 * cw - railW, fondoR = top + chH;
    mini(ctx, d.etiqueta, W / 2, top + 1.5 * u, u, pal, 'center');
    var max = Math.max(d.a.valor, d.b.valor) || 1;
    var barra = function (xr, alto, color, valor, e, alfaValor, colorValor) {
      ctx.save();
      rrect(ctx, xr, railTop, railW, railH + 3 * u, 3 * u); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
      var hb = Math.max(e > 0 ? 1.2 * u : 0, alto * e);
      if (hb > 0) {
        ctx.beginPath(); ctx.rect(xr - 1, top, railW + 2, fondoR - top); ctx.clip();
        rrect(ctx, xr, fondoR - hb, railW, hb + 3 * u, 3 * u); ctx.fillStyle = color; ctx.fill();
      }
      ctx.restore();
      if (alfaValor > 0) {
        ctx.save(); ctx.globalAlpha *= alfaValor;
        var tx = (d.prefijo || '') + cifra(valor * e, d.decimales) + (d.sufijo || '');
        cabe(ctx, (d.prefijo || '') + cifra(valor, d.decimales) + (d.sufijo || ''), 900, 8 * u, 'Outfit', railW * 1.5);
        ctx.fillStyle = colorValor; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(tx, xr + railW / 2, fondoR - hb - 2.2 * u);
        ctx.restore();
      }
    };
    var ea = outCubic(prog(t, ta, 0.8)), eb = outCubic(prog(t, tb, 1));
    barra(xa, railH * Math.max(0.06, d.a.valor / max), 'rgba(255,255,255,0.28)', d.a.valor, ea, 1, pal.tinta);
    barra(xb, railH * Math.max(0.06, d.b.valor / max), pal.acento, d.b.valor, eb, c01((t - tb) / 0.2), pal.acento);
    mini(ctx, d.a.texto, xa + railW / 2, fondoR + 4.5 * u, u, pal, 'center');
    mini(ctx, d.b.texto, xb + railW / 2, fondoR + 4.5 * u, u, pal, 'center');
    if (d.insignia) pastilla(ctx, d.insignia, x0 + cw / 2, top + 0.46 * chH, 5 * u, pal, outBack(prog(t, tb + 0.8, 0.45), 2.6));
    ctx.restore();
  };
  DIBUJO.linea = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, n = d.hitos.length;
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 5 * u;
    var h = pad + 3 * u + 5 * u + 22 * u + 5.5 * u;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.titulo || 'Paso a paso', x + 5 * u, y + pad + 1.5 * u, u, pal, 'left');
      var ix = x + 5 * u, iw = w - 10 * u, top = y + pad + 8 * u, ly = top + 9 * u;
      var pos = function (i) { return 0.12 + (n > 1 ? i * 0.76 / (n - 1) : 0); };
      ctx.save();
      rrect(ctx, ix + 0.12 * iw, ly - 0.5 * u, 0.76 * iw, u, 0.5 * u); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
      // la línea avanza de un hito al siguiente mientras lo dices
      var fr = 0;
      if (t >= p.marcas[0]) {
        fr = pos(0);
        for (var i = 0; i < n - 1; i++) {
          var a = p.marcas[i] + 0.05, b = Math.max(a + 0.3, p.marcas[i + 1]);
          if (t >= a) fr = lerp(pos(i), pos(i + 1), c01((t - a) / (b - a)));
        }
      }
      if (fr > 0.12) { rrect(ctx, ix + 0.12 * iw, ly - 0.5 * u, (fr - 0.12) * iw, u, 0.5 * u); ctx.fillStyle = pal.acento; ctx.fill(); }
      ctx.restore();
      d.hitos.forEach(function (hi, i) {
        var a = prog(t, p.marcas[i], 0.35);
        if (a <= 0) return;
        var cx = ix + pos(i) * iw, ultimo = i === n - 1;
        ctx.save();
        ctx.globalAlpha *= c01(a * 1.6);
        ctx.translate(0, (1 - outBack(a, 2)) * 3 * u);
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        cabe(ctx, hi.fecha, 900, 5.4 * u, 'Outfit', 24 * u);
        ctx.fillStyle = pal.tinta; ctx.fillText(hi.fecha, cx, top + 4.8 * u);
        if (ultimo) { ctx.fillStyle = rgba(pal.acento, 0.3); ctx.beginPath(); ctx.arc(cx, ly, 4.1 * u, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = ultimo ? pal.acento : pal.tinta; ctx.beginPath(); ctx.arc(cx, ly, 2.5 * u, 0, Math.PI * 2); ctx.fill();
        if (hi.texto) {
          cabe(ctx, hi.texto, 700, 4 * u, 'Outfit', 24 * u);
          ctx.fillStyle = rgba(pal.tinta, 0.8); ctx.fillText(hi.texto, cx, ly + 7.6 * u);
        }
        ctx.restore();
      });
    });
  };
  DIBUJO.cita = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tq = p.marcas[0];
    var x = 8 * u, w = 84 * u, y = 0.075 * H, padX = 5.5 * u;
    var tam = 6.6 * u;
    fuente(ctx, 400, tam, '"Instrument Serif"', 'italic');
    var ls = renglones(ctx, d.texto, w - 2 * padX);
    if (ls.length > 4) { tam = 5.4 * u; fuente(ctx, 400, tam, '"Instrument Serif"', 'italic'); ls = renglones(ctx, d.texto, w - 2 * padX).slice(0, 5); }
    var lh = tam * 1.12, h = 9 * u + ls.length * lh + 3 * u + 3 * u + 4.5 * u;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      var k = outBack(prog(t, p.t0 + 0.1, 0.55), 2.2);
      if (k > 0) {
        ctx.save(); ctx.translate(x + 4 * u + 5 * u, y + 7.5 * u); ctx.scale(k, k);
        fuente(ctx, 900, 22 * u, '"Playfair Display"', 'italic');
        ctx.fillStyle = pal.acento; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('“', 0, 3.5 * u);
        ctx.restore();
      }
      // las líneas se destapan al ritmo en que dices la cita
      var total = ls.reduce(function (a, l) { return a + l.length; }, 0) || 1;
      var dur = Math.max(1.2, (p.fin || tq + 2) - tq);
      var vistos = outQuad(prog(t, tq, dur)) * total, acum = 0;
      fuente(ctx, 400, tam, '"Instrument Serif"', 'italic');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ls.forEach(function (l, i) {
        var parte = c01((vistos - acum) / l.length); acum += l.length;
        if (parte <= 0) return;
        var ly = y + 9 * u + i * lh + lh / 2;
        ctx.save();
        ctx.beginPath(); ctx.rect(x + padX - u, ly - lh, (ctx.measureText(l).width + 2 * u) * parte, lh * 2); ctx.clip();
        ctx.fillText(l, x + padX, ly);
        ctx.restore();
      });
      var q = prog(t, p.t0 + 0.55, 0.4);
      if (q > 0) {
        ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - outCubic(q)) * -5 * u, 0);
        mini(ctx, '— ' + d.autor, x + padX, y + 9 * u + ls.length * lh + 4.5 * u, u, pal, 'left', 0.7);
        ctx.restore();
      }
    });
  };

  /* Dibuja la capa del gráfico `p` en el instante t (tiempo del video). El canvas ya está limpio; W×H es el cuadro entero
     (si el canvas es solo la caja, quien llama corre el origen). color: nombre o #hex. */
  /* ══ Tanda de números ══ el mismo estilo, dibujado a mano para el respaldo Clásico */
  DIBUJO.ranking = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, it = (d.items || []).slice(0, 5), tm = p.marcas || [];
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 4.5 * u, fila = 7.6 * u;
    var cab = pad + 3 * u + 2.4 * u + 6 * u + 2 * u;
    var h = cab + it.length * fila + pad;
    var max = 1; it.forEach(function (r) { if (r[1] > max) max = r[1]; });
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 4 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo || '', 900, 6 * u, 'Outfit', w - 8 * u);
      ctx.fillText(d.titulo || '', x + 4 * u, y + pad + 3 * u + 2.4 * u + 3 * u);
      it.forEach(function (r, i) {
        var ti = tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 0.85;
        var k = outCubic(prog(t, ti, 0.45)), b = outCubic(prog(t, ti + 0.05, 0.8)) * (r[1] / max);
        if (k <= 0) return;
        var fy = y + cab + i * fila, uno = i === 0;
        ctx.save(); ctx.globalAlpha = k;
        fuente(ctx, 500, 2.6 * u, '"DM Mono"');
        ctx.fillStyle = uno ? pal.acento : rgba(pal.tinta, 0.42);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x + 4 * u, fy + 2.2 * u);
        ctx.fillStyle = uno ? pal.tinta : rgba(pal.tinta, 0.78);
        cabe(ctx, r[0], 800, 4 * u, 'Outfit', w - 30 * u);
        ctx.fillText(r[0], x + 8 * u, fy + 2.2 * u);
        ctx.textAlign = 'right';
        ctx.fillStyle = uno ? pal.acento : rgba(pal.tinta, 0.62);
        fuente(ctx, 900, 4.2 * u, 'Outfit');
        ctx.fillText(cifra(Math.round(r[1] * k), 0) + (d.sufijo || ''), x + w - 4 * u, fy + 2.2 * u);
        var by = fy + 5.2 * u, bw = w - 8 * u;
        rrect(ctx, x + 4 * u, by, bw, 1.2 * u, 0.6 * u); ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill();
        if (b > 0.002) { rrect(ctx, x + 4 * u, by, bw * b, 1.2 * u, 0.6 * u); ctx.fillStyle = uno ? pal.acento : rgba(pal.tinta, 0.34); ctx.fill(); }
        ctx.restore();
      });
    });
  };
  DIBUJO.meta = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tc = p.marcas[0];
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 4.5 * u, h = 40 * u;
    var meta = Math.max(Number(d.valor) || 0, Number(d.meta) || 100);
    var frac = Math.min(1, (Number(d.valor) || 0) / meta), e = outCubic(prog(t, tc, 1.25)) * frac;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 4 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo || '', 900, 6.6 * u, 'Outfit', w - 8 * u);
      ctx.fillText(d.titulo || '', x + 4 * u, y + pad + 3 * u + 2.6 * u + 3.3 * u);
      var bx = x + 5 * u, bw = w - 10 * u, by = y + 26 * u, bh = 2.8 * u;
      ctx.textAlign = 'center';
      fuente(ctx, 900, 8.6 * u, 'Outfit'); ctx.fillStyle = pal.acento;
      ctx.fillText(cifra(Math.round((Number(d.valor) || 0) * (frac ? e / frac : 1)), 0) + (d.sufijo || ''),
        Math.max(bx + 10 * u, Math.min(bx + bw * e, bx + bw - 10 * u)), by - 6 * u);
      rrect(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
      if (e > 0.004) { rrect(ctx, bx, by, bw * e, bh, bh / 2); ctx.fillStyle = pal.acento; ctx.fill(); }
      ctx.fillStyle = rgba(pal.tinta, 0.42);
      ctx.fillRect(bx + bw - 0.3 * u, by - 2.2 * u, 0.6 * u, bh + 4.4 * u);
      mini(ctx, d.pieMeta || ('meta ' + Math.round(meta) + (d.sufijo || '')), x + w - 4 * u, by + bh + 4 * u, u, pal, 'right', 0.42);
      if (d.pie) mini(ctx, d.pie, x + 4 * u, by + bh + 4 * u, u, pal, 'left', 0.42);
    });
  };
  DIBUJO.rango = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tA = p.marcas[0], tB = p.marcas[1] != null ? p.marcas[1] : tA + 1.1;
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 4.5 * u, h = 40 * u;
    var kA = outBack(prog(t, tA, 0.5), 1.3), kB = outBack(prog(t, tB, 0.5), 1.3);
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 4 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo || '', 900, 6 * u, 'Outfit', w - 8 * u);
      ctx.fillText(d.titulo || '', x + 4 * u, y + pad + 3 * u + 2.4 * u + 3 * u);
      var rx = x + 8 * u, rw = w - 16 * u, ry = y + 28 * u;
      var xa = rx + rw * 0.06, xb = xa + (rx + rw * 0.94 - xa) * c01(kB);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.5 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rw, ry); ctx.stroke();
      if (kA > 0) { ctx.strokeStyle = pal.acento; ctx.lineWidth = 1.1 * u; ctx.beginPath(); ctx.moveTo(xa, ry); ctx.lineTo(xb, ry); ctx.stroke(); }
      ctx.textAlign = 'center';
      [[xa, d.desde, kA, false], [xb, d.hasta, kB, true]].forEach(function (r) {
        if (r[2] <= 0) return;
        ctx.save(); ctx.globalAlpha = c01(r[2]);
        fuente(ctx, 900, r[3] ? 7.6 * u : 6.4 * u, 'Outfit');
        ctx.fillStyle = r[3] ? pal.acento : rgba(pal.tinta, 0.66);
        ctx.fillText((d.prefijo || '') + r[1] + (d.sufijo || ''), r[0], ry - 6 * u);
        ctx.beginPath(); ctx.arc(r[0], ry, r[3] ? 1.7 * u : 1.4 * u, 0, Math.PI * 2);
        ctx.fillStyle = pal.tinta; ctx.fill();
        ctx.beginPath(); ctx.arc(r[0], ry, r[3] ? 0.8 * u : 0.65 * u, 0, Math.PI * 2);
        ctx.fillStyle = pal.acento; ctx.fill();
        ctx.restore();
      });
      if (d.pie) mini(ctx, d.pie, x + w / 2, ry + 6 * u, u, pal, 'center', 0.42);
    });
  };
  DIBUJO.multiplo = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tc = p.marcas[0];
    var veces = Math.max(2, Math.min(8, Math.round(Number(d.veces) || 3)));
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 4.5 * u;
    var an = Math.min(14 * u, (w - 8 * u - 2 * u * (veces - 1)) / veces), h = 26 * u + an * 1.12 + (d.pie ? 6 * u : 2 * u);
    var e = outCubic(prog(t, tc, 0.28 * veces + 0.3));
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 4 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      fuente(ctx, 900, 15 * u, 'Outfit'); ctx.fillStyle = pal.acento;
      var nn = Math.max(1, Math.round(veces * e));
      ctx.fillText('×' + nn, x + 4 * u, y + 15 * u);
      ctx.fillStyle = pal.tinta;
      cabe(ctx, d.titulo || '', 900, 5.4 * u, 'Outfit', w - 30 * u);
      ctx.fillText(d.titulo || '', x + 26 * u, y + 15 * u);
      for (var i = 0; i < veces; i++) {
        var k = outBack(prog(t, tc + i * 0.28, 0.4), 1.6);
        if (k <= 0) continue;
        var cx0 = x + 4 * u + i * (an + 2 * u), cy0 = y + 26 * u;
        ctx.save(); ctx.globalAlpha = c01(k);
        rrect(ctx, cx0, cy0 + (1 - c01(k)) * 3 * u, an, an * 1.12, 2.2 * u);
        ctx.fillStyle = i === veces - 1 ? pal.acento : 'rgba(255,255,255,0.13)'; ctx.fill();
        ctx.restore();
      }
      if (d.pie) {
        ctx.fillStyle = rgba(pal.tinta, 0.66); ctx.textAlign = 'left';
        cabe(ctx, d.pie, 700, 3.4 * u, 'Outfit', w - 8 * u);
        ctx.fillText(d.pie, x + 4 * u, y + 26 * u + an * 1.12 + 3 * u);
      }
    });
  };
  DIBUJO.evolucion = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, it = (d.items || []).slice(0, 7), tm = p.marcas || [];
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 4.5 * u, h = 44 * u;
    var max = 1; it.forEach(function (r) { if (r[1] > max) max = r[1]; });
    var hueco = 1.8 * u, an = it.length ? (w - 8 * u - hueco * (it.length - 1)) / it.length : 0;
    var base = y + 36 * u, maxAlto = 19 * u;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 4 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo || '', 900, 6 * u, 'Outfit', w - 8 * u);
      ctx.fillText(d.titulo || '', x + 4 * u, y + pad + 3 * u + 2.4 * u + 3 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + 4 * u, base, w - 8 * u, 0.25 * u);
      it.forEach(function (r, i) {
        var ti = tm[i] != null ? tm[i] : p.t0 + 0.6 + i * 0.4, k = outCubic(prog(t, ti, 0.45));
        if (k <= 0) return;
        var alto = maxAlto * (0.16 + 0.84 * (r[1] / max)) * k, bx = x + 4 * u + i * (an + hueco), es = i === it.length - 1;
        ctx.save(); ctx.globalAlpha = c01(k * 1.4);
        rrect(ctx, bx, base - alto, an, Math.max(0.4 * u, alto), 1.4 * u);
        ctx.fillStyle = es ? pal.acento : 'rgba(255,255,255,0.20)'; ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        fuente(ctx, 900, es ? 3.6 * u : 3 * u, 'Outfit');
        ctx.fillStyle = es ? pal.acento : rgba(pal.tinta, 0.66);
        ctx.fillText(cifra(Math.round(r[1] * k), 0) + (d.sufijo || ''), bx + an / 2, base - alto - 2.6 * u);
        ctx.restore();
        mini(ctx, r[0], bx + an / 2, base + 3 * u, u, pal, 'center', es ? 0.62 : 0.42);
      });
    });
  };
  DIBUJO.reparto = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, it = (d.items || []).slice(0, 4), tm = p.marcas || [], A = animGrupo(p, t);
    if (A.alfa <= 0 || !it.length) return;
    var total = 0; it.forEach(function (r) { total += r[1]; }); if (!total) total = 100;
    ctx.save(); ctx.globalAlpha = A.alfa; ctx.translate(0, A.dy * u);
    var D = 30 * u, cx = 9 * u + D / 2, cy = 0.5 * H + D / 2, R = D / 2 - 2.4 * u;
    mini(ctx, d.titulo, 9 * u, 0.46 * H, u, pal, 'left');
    ctx.lineWidth = 4.6 * u; ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    var TON = [1, 0.62, 0.38, 0.22], ac = 0;
    it.forEach(function (r, i) {
      var ti = tm[i] != null ? tm[i] : p.t0 + 0.6 + i * 1.1, k = outCubic(prog(t, ti, 0.7));
      var a0 = -Math.PI / 2 + Math.PI * 2 * (ac / total);
      ac += r[1];
      var a1 = a0 + Math.PI * 2 * (r[1] / total) * k;
      if (k > 0.002) { ctx.strokeStyle = rgba(pal.acento, TON[i % 4]); ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke(); }
    });
    var k0 = outCubic(prog(t, tm[0] != null ? tm[0] : p.t0 + 0.6, 0.8));
    ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fuente(ctx, 900, 7.4 * u, 'Outfit');
    ctx.fillText(Math.round((it[0][1] / total) * 100 * k0) + '%', cx, cy - 0.6 * u);
    mini(ctx, it[0][0], cx, cy + 4.6 * u, u, pal, 'center', 0.42);
    var lx = 9 * u + D + 5 * u;
    it.forEach(function (r, i) {
      var ti = tm[i] != null ? tm[i] : p.t0 + 0.6 + i * 1.1, k = outCubic(prog(t, ti, 0.45));
      if (k <= 0) return;
      var ly = cy - (it.length - 1) * 3.6 * u + i * 7.2 * u;
      ctx.save(); ctx.globalAlpha = c01(k * 1.4);
      rrect(ctx, lx, ly - 0.9 * u, 1.8 * u, 1.8 * u, 0.5 * u); ctx.fillStyle = rgba(pal.acento, TON[i % 4]); ctx.fill();
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, r[0], 800, 3.6 * u, 'Outfit', 24 * u);
      ctx.fillText(r[0], lx + 3.4 * u, ly);
      ctx.textAlign = 'right'; ctx.fillStyle = rgba(pal.tinta, 0.66);
      fuente(ctx, 900, 3.8 * u, 'Outfit');
      ctx.fillText(Math.round((r[1] / total) * 100) + '%', 92 * u, ly);
      ctx.restore();
    });
    ctx.restore();
  };
  DIBUJO.cuota = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tc = p.marcas[0], A = animGrupo(p, t);
    if (A.alfa <= 0) return;
    var total = Math.max(2, Math.min(10, Math.round(Number(d.total) || 10)));
    var llenas = Math.max(0, Math.min(total, Math.round(Number(d.llenas) || 0)));
    ctx.save(); ctx.globalAlpha = A.alfa; ctx.translate(0, A.dy * u);
    mini(ctx, d.etiqueta, W / 2, 0.46 * H, u, pal, 'center');
    var e = outCubic(prog(t, tc, 0.8));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var yc = 0.52 * H;
    fuente(ctx, 900, 8.4 * u, 'Outfit');
    var tx = cifra(Math.round(llenas * e), 0), tw = ctx.measureText(tx).width, ow = ctx.measureText(String(total)).width;
    fuente(ctx, 900, 4.6 * u, 'Outfit');
    var dw = ctx.measureText(' de ').width;
    var x0 = W / 2 - (tw + dw + ow) / 2;
    fuente(ctx, 900, 8.4 * u, 'Outfit'); ctx.fillStyle = pal.acento;
    ctx.fillText(tx, x0, yc);
    fuente(ctx, 900, 4.6 * u, 'Outfit'); ctx.fillStyle = rgba(pal.tinta, 0.42);
    ctx.fillText(' de ', x0 + tw, yc + 0.6 * u);
    fuente(ctx, 900, 8.4 * u, 'Outfit'); ctx.fillStyle = rgba(pal.tinta, 0.66);
    ctx.fillText(String(total), x0 + tw + dw, yc);
    var an = 9.4 * u, hueco = 1.8 * u, cols = 5, fw = cols * an + (cols - 1) * hueco, fx = W / 2 - fw / 2, fy = 0.58 * H;
    for (var i = 0; i < total; i++) {
      var on = i < llenas, k = outBack(prog(t, on ? tc + i * 0.17 : tc, 0.4), 1.5);
      if (k <= 0) continue;
      var col = i % cols, ren = Math.floor(i / cols);
      var ix = fx + col * (an + hueco), iy = fy + ren * (an * 1.3 + hueco);
      ctx.save(); ctx.globalAlpha = c01(k) * (on ? 1 : 0.5);
      ctx.fillStyle = on ? pal.acento : 'rgba(255,255,255,0.16)';
      ctx.beginPath(); ctx.arc(ix + an / 2, iy + an * 0.24, an * 0.23, 0, Math.PI * 2); ctx.fill();
      rrect(ctx, ix + an * 0.1, iy + an * 0.5, an * 0.8, an * 0.62, an * 0.16); ctx.fill();
      ctx.restore();
    }
    if (d.titulo) {
      var kt = outCubic(prog(t, tc + 0.17 * llenas + 0.4, 0.5));
      ctx.save(); ctx.globalAlpha = c01(kt);
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo, 900, 5.6 * u, 'Outfit', 84 * u);
      ctx.fillText(d.titulo, W / 2, fy + 2 * (an * 1.3 + hueco) + 3.6 * u);
      ctx.restore();
    }
    ctx.restore();
  };

  function dibujar(ctx, W, H, p, t, color) {
    if (!p || t < p.t0 || t >= p.t1 || !DIBUJO[p.tipo]) return false;
    var pal = paleta(color), u = W / 100;
    ctx.save();
    if (p.forma !== 'encima') fondoConHueco(ctx, W, H, p, t, pal, u);
    DIBUJO[p.tipo](ctx, W, H, u, p, t, pal);
    ctx.restore();
    return true;
  }
  /* Texto corto para la lista de la página («Número gigante · +10.000») */

  /* ══════════ Los 6 aprobados el 20-sep (estilo Clásico; el premium lo dibuja Remotion) ══════════ */

  /* Medidor de aguja — pantalla partida: un arco con su aguja y la cifra al centro */
  DIBUJO.medidor = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, C = caja(p, W, H), A = animTarjeta(p, t);
    var x = C.x + 6 * u, w = C.w - 12 * u, y = C.y + 6 * u, h = C.h - 12 * u;
    conTarjeta(ctx, x, y, w, h, u, A, function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + w / 2, y + 7 * u, u, pal, 'center');
      var cx = x + w / 2, cy = y + h * 0.62, r = Math.min(w * 0.34, h * 0.34);
      var a0 = Math.PI * 0.82, a1 = Math.PI * 2.18;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(pal.tinta, 0.14); ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
      var k = outCubic(prog(t, (p.marcas && p.marcas[0] != null ? p.marcas[0] : p.t0 + 0.7), 1.1));
      var frac = (Math.max(0, Math.min(100, d.valor)) / 100) * k;
      ctx.strokeStyle = pal.acento; ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * frac); ctx.stroke();
      // la aguja
      var ang = a0 + (a1 - a0) * frac;
      ctx.strokeStyle = pal.tinta; ctx.lineWidth = 1.1 * u;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * (r - 3 * u), cy + Math.sin(ang) * (r - 3 * u)); ctx.stroke();
      ctx.fillStyle = pal.acento; ctx.beginPath(); ctx.arc(cx, cy, 1.5 * u, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // la cifra
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fuente(ctx, 900, 11 * u, 'Outfit');
      ctx.fillText(cifra(Math.round(d.valor * k), 0) + '%', cx, cy - r * 0.34);
      if (d.titulo) {
        ctx.fillStyle = rgba(pal.tinta, 0.8);
        var tt = cabe(ctx, d.titulo, 700, 4.2 * u, 'Outfit', w - 12 * u);
        ctx.fillText(d.titulo, cx, y + h - 6 * u);
      }
    });
  };

  /* Mito / Realidad — encima: la creencia tachada y debajo lo que sí es */
  DIBUJO.mito = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tm = p.marcas || [], x = 8 * u, w = 84 * u, y = 0.1 * H, pad = 5 * u;
    ctx.save();
    fuente(ctx, 800, 5.4 * u, 'Outfit');
    var lm = renglones(ctx, d.mito || '', w - 10 * u), lr = renglones(ctx, d.realidad || '', w - 10 * u);
    ctx.restore();
    var alto = pad + lm.length * 6.6 * u + 6 * u + lr.length * 6.6 * u + pad + 6 * u;
    conTarjeta(ctx, x, y, w, alto, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, alto, 5 * u, u, pal);
      var cy = y + pad + 4 * u;
      // el mito
      var k1 = outCubic(prog(t, tm[0] != null ? tm[0] : p.t0 + 0.5, 0.5));
      ctx.save(); ctx.globalAlpha = k1;
      mini(ctx, 'Lo que crees', x + 5 * u, cy, u, pal, 'left');
      cy += 4.6 * u;
      fuente(ctx, 800, 5.4 * u, 'Outfit');
      ctx.fillStyle = rgba(pal.tinta, 0.5); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      lm.forEach(function (l, i) {
        var ly = cy + i * 6.6 * u;
        ctx.fillText(l, x + 5 * u, ly);
        // el tachón, que se dibuja solo
        var tw = ctx.measureText(l).width, kt = outCubic(prog(t, (tm[0] != null ? tm[0] : p.t0 + 0.5) + 0.35 + i * 0.12, 0.45));
        ctx.save(); ctx.strokeStyle = rgba(pal.tinta, 0.5); ctx.lineWidth = 0.5 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 5 * u, ly); ctx.lineTo(x + 5 * u + tw * kt, ly); ctx.stroke(); ctx.restore();
      });
      ctx.restore();
      cy += lm.length * 6.6 * u + 4 * u;
      // la realidad
      var k2 = outCubic(prog(t, tm[1] != null ? tm[1] : p.t0 + 1.6, 0.5));
      ctx.save(); ctx.globalAlpha = k2;
      mini(ctx, 'Lo que es', x + 5 * u, cy, u, pal, 'left');
      cy += 4.6 * u;
      fuente(ctx, 900, 5.8 * u, 'Outfit');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      lr.forEach(function (l, i) { ctx.fillText(l, x + 5 * u, cy + i * 6.6 * u); });
      // la barrita de color al lado
      ctx.fillStyle = pal.acento;
      rrect(ctx, x + 3 * u, cy - 3.4 * u, 0.8 * u, lr.length * 6.6 * u, 0.4 * u); ctx.fill();
      ctx.restore();
    });
  };

  /* Flujo de pasos — encima: 3 o 4 pasos encadenados, cada uno cuando lo dices */
  DIBUJO.flujo = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, ps = (d.pasos || []).slice(0, 4), tm = p.marcas || [];
    var x = 8 * u, w = 84 * u, y = 0.1 * H, pad = 5 * u, fila = 9.5 * u;
    var cab = pad + 3 * u + 2.4 * u + 6 * u + 1.5 * u;
    var h = cab + ps.length * fila + pad;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 5 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo || '', 900, 6 * u, 'Outfit', w - 10 * u);
      ctx.fillText(d.titulo || '', x + 5 * u, y + pad + 3 * u + 2.4 * u + 3 * u);
      ps.forEach(function (paso, i) {
        var ti = tm[i] != null ? tm[i] : p.t0 + 0.8 + i * 0.9;
        var k = outCubic(prog(t, ti, 0.45));
        if (k <= 0) return;
        var fy = y + cab + i * fila, ultimo = i === ps.length - 1;
        ctx.save(); ctx.globalAlpha = k;
        // el circulito con su número
        var cxn = x + 8 * u, cyn = fy + 3.4 * u;
        ctx.fillStyle = ultimo ? pal.acento : rgba(pal.tinta, 0.12);
        ctx.beginPath(); ctx.arc(cxn, cyn, 3 * u, 0, Math.PI * 2); ctx.fill();
        fuente(ctx, 800, 3 * u, '"DM Mono"');
        ctx.fillStyle = ultimo ? pal.sobre : rgba(pal.tinta, 0.75);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), cxn, cyn);
        // el texto del paso
        ctx.fillStyle = ultimo ? pal.tinta : rgba(pal.tinta, 0.82);
        ctx.textAlign = 'left';
        cabe(ctx, paso, ultimo ? 900 : 700, 4.4 * u, 'Outfit', w - 24 * u);
        ctx.fillText(paso, x + 14 * u, cyn);
        // la flecha al siguiente
        if (!ultimo) {
          var ka = outCubic(prog(t, ti + 0.3, 0.4));
          ctx.strokeStyle = rgba(pal.tinta, 0.3); ctx.lineWidth = 0.5 * u; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(cxn, cyn + 3.6 * u); ctx.lineTo(cxn, cyn + 3.6 * u + (fila - 7.2 * u) * ka); ctx.stroke();
        }
        ctx.restore();
      });
    });
  };

  /* Balanza — pantalla partida: dos platos que se inclinan hacia el que gana */
  DIBUJO.balanza = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, C = caja(p, W, H), tm = p.marcas || [];
    var x = C.x + 6 * u, w = C.w - 12 * u, y = C.y + 6 * u, h = C.h - 12 * u;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + w / 2, y + 7 * u, u, pal, 'center');
      var ganaB = d.ganador === 'b';
      var k = outCubic(prog(t, tm[0] != null ? tm[0] : p.t0 + 0.7, 0.9));
      var incl = (ganaB ? 1 : -1) * 0.13 * k;
      var cx = x + w / 2, cy = y + h * 0.42, brazo = w * 0.3;
      // el brazo
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(incl);
      ctx.strokeStyle = rgba(pal.tinta, 0.5); ctx.lineWidth = 0.7 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-brazo, 0); ctx.lineTo(brazo, 0); ctx.stroke();
      [[-brazo, !ganaB], [brazo, ganaB]].forEach(function (par) {
        ctx.save(); ctx.translate(par[0], 0);
        ctx.strokeStyle = rgba(pal.tinta, 0.3); ctx.lineWidth = 0.4 * u;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 4 * u); ctx.stroke();
        ctx.fillStyle = par[1] ? pal.acento : rgba(pal.tinta, 0.2);
        rrect(ctx, -6 * u, 4 * u, 12 * u, 1.4 * u, 0.7 * u); ctx.fill();
        ctx.restore();
      });
      ctx.restore();
      // el eje
      ctx.fillStyle = rgba(pal.tinta, 0.5);
      ctx.beginPath(); ctx.moveTo(cx, cy - 1 * u); ctx.lineTo(cx + 2.4 * u, cy + 9 * u); ctx.lineTo(cx - 2.4 * u, cy + 9 * u); ctx.closePath(); ctx.fill();
      // los dos lados, con su cifra
      [[d.a, x + w * 0.27, !ganaB], [d.b, x + w * 0.73, ganaB]].forEach(function (par, i) {
        var lado = par[0] || {}, lx = par[1], gana = par[2];
        var ki = outCubic(prog(t, tm[i] != null ? tm[i] : p.t0 + 0.7 + i * 0.4, 0.5));
        ctx.save(); ctx.globalAlpha = ki;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = gana ? pal.acento : rgba(pal.tinta, 0.5);
        fuente(ctx, 900, 8 * u, 'Outfit');
        ctx.fillText((d.prefijo || '') + cifra(lado.valor * ki, d.decimales) + (d.sufijo || ''), lx, y + h * 0.7);
        ctx.fillStyle = gana ? pal.tinta : rgba(pal.tinta, 0.55);
        cabe(ctx, lado.texto || '', 700, 3.6 * u, 'Outfit', w * 0.42);
        ctx.fillText(lado.texto || '', lx, y + h * 0.78);
        ctx.restore();
      });
      if (d.titulo) {
        var kt = outCubic(prog(t, p.t0 + 1.4, 0.5));
        ctx.save(); ctx.globalAlpha = kt;
        ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        cabe(ctx, d.titulo, 800, 4.2 * u, 'Outfit', w - 10 * u);
        ctx.fillText(d.titulo, x + w / 2, y + h - 6 * u);
        ctx.restore();
      }
    });
  };

  /* Tabla comparativa — encima: dos columnas, visto y cruz fila por fila */
  DIBUJO.tabla = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, fs = (d.filas || []).slice(0, 5), tm = p.marcas || [];
    var x = 8 * u, w = 84 * u, y = 0.1 * H, pad = 5 * u, fila = 7.4 * u;
    var cab = pad + 3 * u + 2.4 * u + 6 * u + 2 * u + 5 * u;
    var h = cab + fs.length * fila + pad;
    var colA = x + w - 22 * u, colB = x + w - 8 * u;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 5 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo || '', 900, 6 * u, 'Outfit', w - 10 * u);
      ctx.fillText(d.titulo || '', x + 5 * u, y + pad + 3 * u + 2.4 * u + 3 * u);
      // los nombres de las dos columnas
      ctx.textAlign = 'center';
      [[colA, d.a, false], [colB, d.b, true]].forEach(function (c) {
        fuente(ctx, 800, 2.8 * u, '"DM Mono"');
        ctx.fillStyle = c[2] ? pal.acento : rgba(pal.tinta, 0.5);
        ctx.fillText(String(c[1] || '').toUpperCase(), c[0], y + cab - 3 * u);
      });
      fs.forEach(function (f, i) {
        var ti = tm[i] != null ? tm[i] : p.t0 + 0.8 + i * 0.7;
        var k = outCubic(prog(t, ti, 0.45));
        if (k <= 0) return;
        var fy = y + cab + i * fila + 3 * u;
        ctx.save(); ctx.globalAlpha = k;
        ctx.strokeStyle = rgba(pal.tinta, 0.1); ctx.lineWidth = 0.15 * u;
        ctx.beginPath(); ctx.moveTo(x + 5 * u, fy + 3.4 * u); ctx.lineTo(x + w - 5 * u, fy + 3.4 * u); ctx.stroke();
        ctx.fillStyle = rgba(pal.tinta, 0.85); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        cabe(ctx, f[0], 700, 3.8 * u, 'Outfit', w - 34 * u);
        ctx.fillText(f[0], x + 5 * u, fy);
        [[colA, f[1], false], [colB, f[2], true]].forEach(function (c) {
          var ks = outBack(prog(t, ti + 0.15, 0.4));
          ctx.save(); ctx.translate(c[0], fy); ctx.scale(ks, ks);
          ctx.strokeStyle = c[1] ? (c[2] ? pal.acento : rgba(pal.tinta, 0.7)) : rgba(pal.tinta, 0.25);
          ctx.lineWidth = 0.7 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          if (c[1]) { ctx.moveTo(-1.8 * u, 0); ctx.lineTo(-0.5 * u, 1.4 * u); ctx.lineTo(2 * u, -1.6 * u); }
          else { ctx.moveTo(-1.5 * u, -1.5 * u); ctx.lineTo(1.5 * u, 1.5 * u); ctx.moveTo(1.5 * u, -1.5 * u); ctx.lineTo(-1.5 * u, 1.5 * u); }
          ctx.stroke(); ctx.restore();
        });
        ctx.restore();
      });
    });
  };

  /* Las claves — encima: dos o tres tarjetitas en fila, cada una con su número */
  DIBUJO.claves = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, cl = (d.claves || []).slice(0, 3), tm = p.marcas || [];
    var x = 8 * u, w = 84 * u, y = 0.1 * H, pad = 5 * u;
    var cab = pad + 3 * u + 2.4 * u + 6 * u + 2 * u;
    var alto = 13 * u, hueco = 2.6 * u;
    var h = cab + cl.length * (alto + hueco) - hueco + pad;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, x + 5 * u, y + pad + 1.5 * u, u, pal, 'left');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      cabe(ctx, d.titulo || '', 900, 6 * u, 'Outfit', w - 10 * u);
      ctx.fillText(d.titulo || '', x + 5 * u, y + pad + 3 * u + 2.4 * u + 3 * u);
      cl.forEach(function (c, i) {
        var ti = tm[i] != null ? tm[i] : p.t0 + 0.8 + i * 0.85;
        var k = outCubic(prog(t, ti, 0.5)), ks = outBack(prog(t, ti, 0.6));
        if (k <= 0) return;
        var cy = y + cab + i * (alto + hueco);
        ctx.save(); ctx.globalAlpha = k;
        ctx.translate(x + w / 2, cy + alto / 2); ctx.scale(0.94 + 0.06 * ks, 0.94 + 0.06 * ks); ctx.translate(-(x + w / 2), -(cy + alto / 2));
        ctx.fillStyle = rgba(pal.tinta, 0.06);
        rrect(ctx, x + 4 * u, cy, w - 8 * u, alto, 3 * u); ctx.fill();
        ctx.fillStyle = pal.acento;
        rrect(ctx, x + 4 * u, cy, 0.7 * u, alto, 0.35 * u); ctx.fill();
        fuente(ctx, 900, 7 * u, 'Outfit');
        ctx.fillStyle = rgba(pal.acento, 0.85);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x + 8 * u, cy + alto / 2);
        ctx.fillStyle = pal.tinta;
        cabe(ctx, c, 800, 4.6 * u, 'Outfit', w - 26 * u);
        ctx.fillText(c, x + 16 * u, cy + alto / 2);
        ctx.restore();
      });
    });
  };

  function resumen(p) {
    var d = p.datos || {};
    if (p.tipo === 'numero') return (d.prefijo || '') + cifra(d.valor, d.decimales) + (d.sufijo || '') + (d.etiqueta ? ' ' + d.etiqueta.toLowerCase() : '');
    if (p.tipo === 'porcentaje') return cifra(Math.round(d.valor), 0) + '% · ' + d.titulo;
    if (p.tipo === 'lista') return d.items.length + ' ' + (d.titulo || 'puntos');
    if (p.tipo === 'comparacion') return d.a.texto + ' ' + (d.prefijo || '') + cifra(d.a.valor, d.decimales) + (d.sufijo || '') + ' → ' + d.b.texto + ' ' + (d.prefijo || '') + cifra(d.b.valor, d.decimales) + (d.sufijo || '');
    if (p.tipo === 'linea') return d.hitos.map(function (h) { return h.fecha; }).join(' · ');
    if (p.tipo === 'cita') return '«' + d.texto + '» — ' + d.autor;
    if (p.tipo === 'ranking') return (d.items || []).map(function (r) { return r[0]; }).slice(0, 3).join(' · ');
    if (p.tipo === 'meta') return cifra(d.valor, 0) + (d.sufijo || '') + ' de ' + cifra(d.meta, 0) + (d.sufijo || '');
    if (p.tipo === 'reparto') return (d.items || []).map(function (r) { return r[0]; }).join(' · ');
    if (p.tipo === 'rango') return (d.prefijo || '') + d.desde + (d.sufijo || '') + ' a ' + (d.prefijo || '') + d.hasta + (d.sufijo || '');
    if (p.tipo === 'multiplo') return '×' + d.veces + (d.titulo ? ' ' + d.titulo.toLowerCase() : '');
    if (p.tipo === 'evolucion') return (d.items || []).map(function (r) { return r[0]; }).join(' · ');
    if (p.tipo === 'cuota') return d.llenas + ' de ' + d.total + (d.titulo ? ' · ' + d.titulo : '');
    if (p.tipo === 'medidor') return cifra(Math.round(d.valor), 0) + '% · ' + (d.titulo || d.etiqueta || '');
    if (p.tipo === 'mito') return '«' + d.mito + '» → ' + d.realidad;
    if (p.tipo === 'flujo') return (d.pasos || []).join(' → ');
    if (p.tipo === 'balanza') return d.a.texto + ' ' + (d.prefijo || '') + cifra(d.a.valor, d.decimales) + (d.sufijo || '') + ' vs ' + d.b.texto + ' ' + (d.prefijo || '') + cifra(d.b.valor, d.decimales) + (d.sufijo || '');
    if (p.tipo === 'tabla') return d.a + ' / ' + d.b + ' · ' + (d.filas || []).length + ' puntos';
    if (p.tipo === 'claves') return (d.claves || []).join(' · ');
    if (PALABRA_PE.indexOf(p.tipo) >= 0) return d.grande + (d.chica ? ' · ' + d.chica : '');
    if (p.tipo === 'pe_lista') return (d.items || []).join(' · ');
    if (p.tipo === 'pe_cifra') return (d.prefijo || '') + cifra(d.valor, d.decimales) + (d.sufijo || '') + (d.unidad ? ' ' + d.unidad : '');
    if (p.tipo === 'pe_vs') return d.arriba + ' ' + (d.medio || 'vs') + ' ' + d.abajo;
    if (p.tipo === 'pe_clipv' || p.tipo === 'pe_cliph' || p.tipo === 'pe_foto') return (d.imagen ? 'tu imagen' : 'tu clip') + (d.grande ? ' · ' + d.grande : '');
    return '';
  }

  var API = {
    CANTIDAD: CANTIDAD, COLORES: COLORES, NOMBRES: NOMBRES, FORMA: FORMA, FORMAS: FORMAS, FUENTES: FUENTES, ESTILOS: ESTILOS,
    limpiar: limpiar, paleta: paleta, reloj: reloj, limpiarDatos: limpiarDatos, elegir: elegir, enInstante: enInstante,
    video: video, css: css, ffmpeg: ffmpeg, caja: caja, dibujar: dibujar, resumen: resumen, cifra: cifra,
    hueco: hueco, cajaPremium: cajaPremium, cuadros: cuadros, TRANS: TRANS, SALIDA: SALIDA,
    FORMAS_PANTALLA: FORMAS_PANTALLA, limpiarPantallas: limpiarPantallas, piezasPantallas: piezasPantallas, colorPantalla: colorPantalla,
    sinChoques: sinChoques, conPantallas: conPantallas,
    FAMILIAS: FAMILIAS, familiaDe: familiaDe, FONDOS_PE: FONDOS_PE, ponerFondos: ponerFondos,
    PALABRA_PE: PALABRA_PE, CALLAN: CALLAN, CON_PERSONA: CON_PERSONA, selloDe: selloDe, filtroBN: filtroBN, MUEVE: MUEVE, avance: avance, rectVideo: rectVideo,
    inOutPow: inOutPow, tramosEmpuje: tramosEmpuje, callados: callados,
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherryGraf = API;
})(typeof window !== 'undefined' ? window : this);

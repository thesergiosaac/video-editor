/* motor-color.js — el motor de color de Cherry (18-sep-2026).
 *
 * EL MISMO ARCHIVO corre en el ensamblador (Node) y en la página (navegador):
 * el ensamblador lo usa para hornear el .cube de cada video, y la página para
 * pintar el look en vivo sobre el celular. Si se cambia aquí, se cambia en los
 * dos sitios (copiar el archivo tal cual a video-editor/js/motor-color.js).
 *
 * Dos piezas:
 *   · REVELADO: limpia el material (velo por canal, balance de blancos, exposición)
 *     en luz lineal. Se mide del video y no tiene gusto: solo normaliza.
 *   · LOOKS: recetas en Lab (L = luz, a/b = color) con reglas por tipo de color
 *     (piel, luz cálida, verdes, sombras, blancos). Cada look tiene parámetros base
 *     y la persona los puede mover con ajustes de -100 a +100 (0 = el look tal cual).
 *
 * El prototipo y las mediciones que llevaron a Cherry Gold están en
 * carrete-docs/looks/ (look_lab.py, banco.py, analisis.py).
 */
(function (raiz) {
  'use strict';

  /* ══ Espacio de color ══ */
  function aLineal(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function aSrgb(c) {
    c = c < 0 ? 0 : (c > 1 ? 1 : c);
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }
  function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  var M = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]];
  var Mi = invertir3(M);
  var BLANCO = [0.95047, 1.0, 1.08883];
  var EPS_LAB = 216 / 24389, K_LAB = 24389 / 27;

  function invertir3(m) {
    var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2], g = m[2][0], h = m[2][1], i = m[2][2];
    var A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g;
    var det = a * A + b * B + c * Cc;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
            [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
            [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }

  function fLab(t) { return t > EPS_LAB ? Math.cbrt(t) : (K_LAB * t + 16) / 116; }
  function aLab(r, g, b) {
    var lr = aLineal(r), lg = aLineal(g), lb = aLineal(b);
    var x = (M[0][0] * lr + M[0][1] * lg + M[0][2] * lb) / BLANCO[0];
    var y = (M[1][0] * lr + M[1][1] * lg + M[1][2] * lb) / BLANCO[1];
    var z = (M[2][0] * lr + M[2][1] * lg + M[2][2] * lb) / BLANCO[2];
    var fx = fLab(x), fy = fLab(y), fz = fLab(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function deLab(L, a, b) {
    var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    var inv = function (f) { var f3 = f * f * f; return f3 > EPS_LAB ? f3 : (116 * f - 16) / K_LAB; };
    var x = inv(fx) * BLANCO[0], y = inv(fy) * BLANCO[1], z = inv(fz) * BLANCO[2];
    return [aSrgb(Mi[0][0] * x + Mi[0][1] * y + Mi[0][2] * z),
            aSrgb(Mi[1][0] * x + Mi[1][1] * y + Mi[1][2] * z),
            aSrgb(Mi[2][0] * x + Mi[2][1] * y + Mi[2][2] * z)];
  }

  /* ══ Utilidades suaves ══ */
  function recortar(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function campana(d, ancho) { var t = recortar(Math.abs(d) / ancho, 0, 1); return 0.5 + 0.5 * Math.cos(Math.PI * t); }
  function distTono(h, c) { var d = ((h - c + 180) % 360 + 360) % 360 - 180; return Math.abs(d); }
  function rampa(x, desde, hasta) { var t = recortar((x - desde) / (hasta - desde), 0, 1); return t * t * (3 - 2 * t); }

  /* Curva de tonos monótona (Fritsch–Carlson): pasa por los puntos y nunca se invierte */
  function prepararCurva(puntos) {
    var xs = puntos.map(function (p) { return p[0]; }), ys = puntos.map(function (p) { return p[1]; });
    var n = xs.length, d = [], m = new Array(n), i;
    for (i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return { xs: xs, ys: ys, m: m };
  }
  function evalCurva(c, L) {
    var xs = c.xs, n = xs.length;
    L = recortar(L, xs[0], xs[n - 1]);
    var j = 0; while (j < n && xs[j] < L) j++;            // primer xs >= L (como searchsorted)
    var k = recortar(j - 1, 0, n - 2);
    var h = xs[k + 1] - xs[k], t = (L - xs[k]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * c.ys[k] + (t3 - 2 * t2 + t) * h * c.m[k]
         + (-2 * t3 + 3 * t2) * c.ys[k + 1] + (t3 - t2) * h * c.m[k + 1];
  }

  /* ══ LOOKS ══ */
  var CATALOGO = {
    cherry_gold: {
      nombre: 'Cherry Gold',
      desc: 'Luz ámbar, negros ciruela, piel natural y blancos que nunca se queman',
      /* Medido de la referencia de Sergio (18-sep-2026): ver carrete-docs/looks/LOOK-CHERRY-GOLD.md */
      base: {
        curva: [[0, 1.5], [5, 5], [20, 15.5], [40, 32], [50, 41], [62, 53], [75, 65], [87, 75], [100, 85]],
        sat_general: 1.0,
        piel_tono: 37, piel_giro: 8, piel_sat: 0.70,
        calido_giro: -12, calido_sat: 1.35,
        verde_giro: -40, verde_sat: 0.45,
        sombra_sat: 0.45, sombra_tinte: [1.6, -3.3],
        luz_tinte: [2.0, 0.8],
        vineta: 1,                       // 1 = la viñeta del look (ángulo PI/4.6 en ffmpeg)
      },
    },
    /* (27-sep-2026) SELECTIVO. Sergio: «solo las partes naranjas como la luz, las cafés, el verde de una planta y el
       fucsia de la pantalla; la cama es negra, no azul». Solo esos tonos se avivan; negros, blancos y grises no se
       tocan. La piel va con OTRA receta (`persona`) dentro de la silueta de la persona (carrete-recorte): la piel y la
       madera tienen el mismo tono (65–87°) y un look parejo no las puede separar. Sin silueta se usa solo `base`. */
    selectivo: {
      nombre: 'Selectivo',
      desc: 'Solo se avivan los naranjas, cafés, verdes y fucsias; negros y blancos neutros y la piel natural',
      mascara: true,
      base: {
        curva: [[0, 1.5], [6, 4], [15, 10.5], [30, 25.5], [45, 42], [60, 59.5], [75, 76], [88, 88], [100, 97]],
        sat_general: 1.0,
        piel_tono: 68, piel_giro: 0, piel_sat: 1.0,
        calido_giro: 0, calido_sat: 1.0,
        verde_giro: 0, verde_sat: 1.0,
        sombra_sat: 0.3, sombra_tinte: [0, 0],
        luz_tinte: [0, 0],
        densidad: 0.6,
        selectivos: [
          { h: 72, ancho: 36, sat: 2.6, giro: -10, cmin: 3 },     // naranjas de la luz y cafés de la madera
          { h: 140, ancho: 34, sat: 2.3, giro: 6, cmin: 3 },      // verdes (una planta)
          { h: 350, ancho: 28, sat: 1.8, giro: 0, cmin: 4 },      // fucsias (una pantalla)
        ],
        vineta: 1,
      },
      persona: {
        curva: [[0, 1.5], [6, 4], [15, 10.5], [30, 25.5], [45, 42], [60, 59.5], [75, 76], [88, 88], [100, 97]],
        sat_general: 1.04,
        piel_tono: 68, piel_giro: 0, piel_sat: 1.0,
        calido_giro: 0, calido_sat: 1.0,
        verde_giro: 0, verde_sat: 1.0,
        sombra_sat: 0.45, sombra_tinte: [0, 0],
        luz_tinte: [0, 0],
        densidad: 0.4,
        vineta: 1,
      },
    },
    /* (2-oct-2026) LOS LOOKS APROBADOS POR SERGIO, de su tablero de Pinterest «Colorización» (docs/LOOKS-APROBADOS.md). La
       piel NO va en la receta: va como zona «piel» (dentro de la silueta) en `porDefecto`, que la página pone al escogerlo. */
    calido_oscuro: {
      nombre: 'Cálido oscuro',
      desc: 'Sombras profundas, luz naranja, sombras con un toque azul verdoso y viñeta; la piel se aclara y se suaviza',
      base: {'curva': [[0, 0], [8, 4], [25, 17], [45, 34], [65, 54], [85, 74], [100, 86]], 'sat_general': 0.95, 'piel_tono': 50, 'piel_giro': 5, 'piel_sat': 0.85, 'calido_giro': -8, 'calido_sat': 1.45, 'verde_giro': -20, 'verde_sat': 0.5, 'sombra_sat': 0.7, 'sombra_tinte': [-2.5, -4], 'luz_tinte': [2, 4.5], 'vineta': 1.3, 'densidad': 0.3},
      porDefecto: {'correccion': {'contraste': 12}, 'zonas': {'piel': {'exposicion': 15, 'sombras': 16, 'saturacion': -9, 'temperatura': -2}}},
    },
    calido_suave: {
      nombre: 'Cálido suave',
      desc: 'El Cálido oscuro, todo un poco menos oscuro; la piel clara y natural',
      base: {'curva': [[0, 2], [10, 7], [30, 23], [50, 41], [70, 61], [88, 80], [100, 90]], 'sat_general': 0.95, 'piel_tono': 50, 'piel_giro': 5, 'piel_sat': 0.85, 'calido_giro': -8, 'calido_sat': 1.4, 'verde_giro': -20, 'verde_sat': 0.5, 'sombra_sat': 0.7, 'sombra_tinte': [-2.5, -4], 'luz_tinte': [2, 4.5], 'vineta': 1.1, 'densidad': 0.25},
      porDefecto: {'correccion': {'contraste': 8}, 'zonas': {'piel': {'exposicion': 12, 'sombras': 14, 'saturacion': -8, 'temperatura': -2}}},
    },
    teal_naranja: {
      nombre: 'Naranja y azul',
      desc: 'El de cine: luz naranja, sombras azul verdoso y verdes apagados',
      base: {'curva': [[0, 1], [12, 8], [30, 24], [50, 44], [70, 64], [88, 82], [100, 92]], 'sat_general': 1.0, 'piel_tono': 50, 'piel_giro': 5, 'piel_sat': 0.88, 'calido_giro': -5, 'calido_sat': 1.35, 'verde_giro': -30, 'verde_sat': 0.6, 'sombra_sat': 0.9, 'sombra_tinte': [-5, -6], 'luz_tinte': [3, 5], 'vineta': 1, 'densidad': 0.2},
      porDefecto: {'correccion': {'contraste': 10}, 'zonas': {'piel': {'exposicion': 10, 'saturacion': -10, 'temperatura': -3}}},
    },
    chocolate: {
      nombre: 'Chocolate',
      desc: 'Cafés profundos, sombras cálidas y el color denso, como de película',
      base: {'curva': [[0, 0], [10, 5], [30, 19], [50, 36], [70, 55], [90, 77], [100, 87]], 'sat_general': 0.9, 'piel_tono': 50, 'piel_giro': 5, 'piel_sat': 0.85, 'calido_giro': 6, 'calido_sat': 1.1, 'verde_giro': -25, 'verde_sat': 0.45, 'sombra_sat': 0.8, 'sombra_tinte': [2, 1.5], 'luz_tinte': [2, 3], 'vineta': 1.2, 'densidad': 0.6},
      porDefecto: {'correccion': {'contraste': 10}, 'zonas': {'piel': {'exposicion': 14, 'sombras': 14, 'saturacion': -14, 'temperatura': -5}}},
    },
    noche_ambar: {
      nombre: 'Noche ámbar',
      desc: 'Oscuro, con la luz ámbar viva y las sombras azules',
      base: {'curva': [[0, 0], [12, 5], [35, 25], [55, 46], [75, 68], [92, 86], [100, 94]], 'sat_general': 1.05, 'piel_tono': 50, 'piel_giro': 5, 'piel_sat': 0.88, 'calido_giro': -4, 'calido_sat': 1.4, 'verde_giro': 0, 'verde_sat': 0.9, 'sombra_sat': 1, 'sombra_tinte': [-1, -6], 'luz_tinte': [1, 3], 'vineta': 1.4, 'densidad': 0.3},
      porDefecto: {'correccion': {'exposicion': -6}, 'zonas': {'piel': {'exposicion': 12, 'sombras': 12, 'saturacion': -10, 'temperatura': -4}}},
    },
  };

  /* Los ajustes que ve la persona. Todos van de -100 a +100 y 0 es el look tal cual. */
  var AJUSTES = [
    { k: 'luz',       nombre: 'Luz',       menos: 'Más oscuro',   mas: 'Más claro' },
    { k: 'contraste', nombre: 'Contraste', menos: 'Más suave',    mas: 'Más marcado' },
    { k: 'dorado',    nombre: 'Dorado',    menos: 'Menos ámbar',  mas: 'Más ámbar' },
    { k: 'sombras',   nombre: 'Sombras',   menos: 'Neutras',      mas: 'Más ciruela' },
    { k: 'piel',      nombre: 'Piel',      menos: 'Más natural',  mas: 'Más viva' },
    { k: 'vineta',    nombre: 'Viñeta',    menos: 'Sin viñeta',   mas: 'Más marcada' },
  ];

  function num(v) { v = Number(v); return isFinite(v) ? recortar(v, -100, 100) / 100 : 0; }

  /* Receta final = base del look + ajustes de la persona */
  function ajustar(base, aj) {
    aj = aj || {};
    var P = JSON.parse(JSON.stringify(base));
    var d = num(aj.dorado), s = num(aj.sombras), p = num(aj.piel);
    /* Dorado: hacia arriba va a ORO (naranja-amarillo saturado), no a rojo ni a rosa.
       Primeras pruebas: multiplicar el tinte rosado de las luces daba salmón, y girar
       MÁS el tono llevaba el ámbar a rojo. Por eso hacia arriba se gira MENOS, se
       satura más y a las luces se les SUMA oro. Hacia abajo todo va a neutro. */
    P.calido_giro = base.calido_giro * (d >= 0 ? 1 - d * 0.5 : 1 + d);
    P.calido_sat = Math.max(0.7, 1 + (base.calido_sat - 1) * (1 + d * 1.2));
    P.luz_tinte = d >= 0
      ? [base.luz_tinte[0] + d * 0.8, base.luz_tinte[1] + d * 3.2]
      : [base.luz_tinte[0] * (1 + d), base.luz_tinte[1] * (1 + d)];
    P.sombra_tinte = [base.sombra_tinte[0] * (1 + s * 1.2), base.sombra_tinte[1] * (1 + s * 1.2)];
    P.sombra_sat = recortar(1 + (base.sombra_sat - 1) * (1 + s * 0.6), 0.1, 1.2);
    P.piel_sat = base.piel_sat * (1 + p * 0.45);
    P.aj_luz = num(aj.luz);
    P.aj_contraste = num(aj.contraste);
    P.vineta = recortar(base.vineta * (1 + num(aj.vineta)), 0, 2);
    if (base.selectivos && d) P.selectivos[0].sat = Math.max(1, 1 + (base.selectivos[0].sat - 1) * (1 + d));
    return P;
  }

  /* (27-sep-2026) CORRECCIÓN GENERAL. Sergio: «otro grupo de controladores que sería la corrección total del video,
     por si quiero agregarle más saturación, brillo, contraste, luces, sombras, exposición… sin que afecte los valores
     del look». Va DESPUÉS del look (y sirve también sin look); de -100 a +100, 0 = sin tocar. */
  var CORRECCION = [
    { k: 'exposicion',  nombre: 'Exposición',  menos: 'Más oscuro',   mas: 'Más claro' },
    { k: 'brillo',      nombre: 'Brillo',      menos: 'Medios abajo', mas: 'Medios arriba' },
    { k: 'contraste',   nombre: 'Contraste',   menos: 'Más plano',    mas: 'Más marcado' },
    { k: 'luces',       nombre: 'Luces',       menos: 'Bajar',        mas: 'Subir' },
    { k: 'sombras',     nombre: 'Sombras',     menos: 'Bajar',        mas: 'Subir' },
    { k: 'saturacion',  nombre: 'Saturación',  menos: 'Menos color',  mas: 'Más color' },
    { k: 'temperatura', nombre: 'Temperatura', menos: 'Más frío',     mas: 'Más cálido' },
    { k: 'tinte',       nombre: 'Tinte',       menos: 'Más verde',    mas: 'Más magenta' },
  ];
  /* Solo los que se movieron, en -1..1. null si no hay nada que hacer. */
  function correccionDe(k) {
    if (!k) return null;
    var o = {}, hay = false;
    CORRECCION.forEach(function (x) { var v = num(k[x.k]); if (v) { o[x.k] = v; hay = true; } });
    return hay ? o : null;
  }
  /* Un color por la corrección general (rgb 0..1). */
  function aplicarCorreccion(r, g, b, K) {
    // 1 · balance y exposición, en luz lineal (como mover la luz de verdad)
    var lr = aLineal(recortar(r, 0, 1)), lg = aLineal(recortar(g, 0, 1)), lb = aLineal(recortar(b, 0, 1));
    var t = K.temperatura || 0, ti = K.tinte || 0, ex = Math.pow(2, (K.exposicion || 0) * 1.5);
    lr *= (1 + 0.14 * t) * ex; lg *= (1 - 0.1 * ti) * ex; lb *= (1 - 0.14 * t) * ex;
    var lab = aLab(aSrgb(lr), aSrgb(lg), aSrgb(lb));
    var L = lab[0], a = lab[1], bb = lab[2], x;
    // 2 · luz: brillo (medios), contraste (curva en S que nunca se invierte), luces y sombras (cada una en su zona)
    if (K.brillo) L = 100 * Math.pow(recortar(L / 100, 0, 1), Math.pow(2, -K.brillo * 0.6));
    if (K.contraste) { x = L / 100; L = 100 * (x + K.contraste * 0.5 * (x - 0.5) * (1 - Math.abs(2 * x - 1)) * 1.2); }
    if (K.luces) L = L + K.luces * 14 * rampa(L, 45, 90) * (1 - rampa(L, 97, 100.5));
    if (K.sombras) L = L + K.sombras * 14 * (1 - rampa(L, 8, 55)) * rampa(L, -1, 4);
    L = recortar(L, 0, 100);
    // 3 · saturación
    if (K.saturacion) { var s = Math.max(0, 1 + K.saturacion); a *= s; bb *= s; }
    return deLab(L, a, bb);
  }

  /* Un color por la receta. rgb en 0..1; devuelve [r, g, b] en 0..1. */
  function aplicarColor(r, g, b, P, curva) {
    var lab = aLab(recortar(r, 0, 1), recortar(g, 0, 1), recortar(b, 0, 1));
    var L = lab[0], a = lab[1], bb = lab[2];
    var C = Math.hypot(a, bb);
    var h = ((Math.atan2(bb, a) * 180 / Math.PI) + 360) % 360;

    // 1 · tonos: la curva del look y luego los ajustes de luz y contraste
    var L2 = evalCurva(curva, L);
    if (P.aj_contraste) {
      var x = L2 / 100, k = P.aj_contraste * 0.42;           // pendiente 0.5–1.5: nunca se invierte
      L2 = 100 * (x + k * (x - 0.5) * (1 - Math.abs(2 * x - 1)) * 1.2);
    }
    if (P.aj_luz) L2 = 100 * Math.pow(recortar(L2 / 100, 0, 1), Math.pow(2, -P.aj_luz * 0.6));

    // 2 · a quién le toca cada regla (se mide sobre el color ORIGINAL)
    var colorReal = rampa(C, 4, 12);
    var wPiel = campana(distTono(h, P.piel_tono), 22) * rampa(C, 10, 20) * (1 - rampa(C, 55, 70))
              * rampa(L, 25, 40) * (1 - rampa(L, 85, 95));
    var wCalido = campana(distTono(h, 64), 24) * colorReal * (1 - wPiel);
    var wVerde = campana(distTono(h, 125), 50) * colorReal;
    var wSombra = 1 - rampa(L2, 6, 32);
    var wLuz = rampa(L2, 62, 84) * (1 - rampa(C, 14, 30));

    // 3 · girar tonos
    var h2 = h + wPiel * recortar(P.piel_tono - h, -P.piel_giro, P.piel_giro)
               + wCalido * P.calido_giro + wVerde * P.verde_giro;

    // 4 · saturación
    var C2 = C * P.sat_general * (1 + wPiel * (P.piel_sat - 1)) * (1 + wCalido * (P.calido_sat - 1))
           * (1 + wVerde * (P.verde_sat - 1)) * (1 + wSombra * (P.sombra_sat - 1));
    // densidad (27-sep): el color saturado se oscurece un poco, como en la película
    if (P.densidad) L2 = L2 - P.densidad * 9 * rampa(C2, 8, 45) * rampa(L2, 12, 40) * (1 - rampa(L2, 85, 98)) * (1 - wPiel * 0.7);
    // color selectivo (27-sep): solo los tonos pedidos se avivan; lo neutro (negro, blanco, gris) no se toca
    if (P.selectivos) P.selectivos.forEach(function (s) {
      var cmin = s.cmin == null ? 5 : s.cmin;
      var w = campana(distTono(h, s.h), s.ancho) * rampa(C, cmin, cmin + 8);
      C2 = C2 * (1 + w * ((s.sat == null ? 1 : s.sat) - 1));
      h2 = h2 + w * (s.giro || 0);
    });
    var rad = h2 * Math.PI / 180;
    var a2 = C2 * Math.cos(rad) + wSombra * P.sombra_tinte[0] + wLuz * P.luz_tinte[0];
    var b2 = C2 * Math.sin(rad) + wSombra * P.sombra_tinte[1] + wLuz * P.luz_tinte[1];

    return deLab(L2, a2, b2);
  }

  /* Tabla 3D del look (la que aplica ffmpeg con lut3d y la página con WebGL).
     `fuerza` mezcla con la identidad: 1 = look completo. Orden del .cube: R primero. */
  function generarLut(P, n, fuerza) {
    n = n || 33;
    fuerza = fuerza == null ? 1 : recortar(Number(fuerza), 0, 1);
    var curva = prepararCurva(P.curva);
    var out = new Float32Array(n * n * n * 3), i = 0;
    for (var ib = 0; ib < n; ib++) {
      for (var ig = 0; ig < n; ig++) {
        for (var ir = 0; ir < n; ir++) {
          var r = ir / (n - 1), g = ig / (n - 1), b = ib / (n - 1);
          var o = aplicarColor(r, g, b, P, curva);
          out[i++] = r + (o[0] - r) * fuerza;
          out[i++] = g + (o[1] - g) * fuerza;
          out[i++] = b + (o[2] - b) * fuerza;
        }
      }
    }
    return out;
  }

  function aCube(lut, n, titulo) {
    var lineas = ['# ' + titulo, 'TITLE "' + titulo + '"', 'LUT_3D_SIZE ' + n, ''];
    for (var i = 0; i < lut.length; i += 3) {
      lineas.push(lut[i].toFixed(6) + ' ' + lut[i + 1].toFixed(6) + ' ' + lut[i + 2].toFixed(6));
    }
    return lineas.join('\n') + '\n';
  }

  /* Viñeta: ángulo del filtro `vignette` de ffmpeg. 0 = sin viñeta.
     Forma vertical (aspect 9:16) y centro a la altura de la cara (40 %): sin eso las
     esquinas de abajo se van a negro total — pasó en la primera prueba. */
  var VINETA_BASE = Math.PI / 4.6, VINETA_MAX = 0.88;
  function anguloVineta(v) {
    v = recortar(Number(v) || 0, 0, 2);
    return v <= 1 ? VINETA_BASE * v : VINETA_BASE + (VINETA_MAX - VINETA_BASE) * (v - 1);
  }
  var VINETA_Y = 0.40, VINETA_ASPECTO = 0.5625;
  /* El mismo cálculo que hace ffmpeg por pixel (vf_vignette, modo natural), para la vista previa */
  function factorVineta(angulo, x, y, w, hgt) {
    if (!angulo) return 1;
    var dx = x - w / 2, dy = (y - hgt * VINETA_Y) * VINETA_ASPECTO;
    var d = Math.hypot(dx, dy) / Math.hypot(w / 2, hgt / 2);
    if (d > 1) return 0;
    var c = Math.cos(angulo * d);
    return c * c * c * c;
  }
  function filtroVineta(angulo) {
    return angulo > 0.02
      ? 'vignette=angle=' + angulo.toFixed(4) + ':x0=w/2:y0=h*' + VINETA_Y + ':aspect=' + VINETA_ASPECTO
      : null;
  }

  /* ══ REVELADO ══ */
  var EXPOSICION_OBJETIVO = 0.46;

  function percentil(ordenado, p) {
    if (!ordenado.length) return 0;
    var i = Math.min(ordenado.length - 1, Math.max(0, Math.round((p / 100) * (ordenado.length - 1))));
    return ordenado[i];
  }

  /* Mide el velo, el balance de blancos y la exposición.
     `px`: bytes RGB (paso 3, ffmpeg rgb24) o RGBA (paso 4, canvas). */
  function medirRevelado(px, fuerza, paso) {
    paso = paso || 3;
    fuerza = fuerza == null ? 1 : fuerza;
    var n = Math.floor(px.length / paso);
    var R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), L = new Float32Array(n), i;
    for (i = 0; i < n; i++) {
      var r = px[i * paso] / 255, g = px[i * paso + 1] / 255, b = px[i * paso + 2] / 255;
      R[i] = r; G[i] = g; B[i] = b; L[i] = luma(r, g, b);
    }
    var oR = Float32Array.from(R).sort(), oG = Float32Array.from(G).sort(),
        oB = Float32Array.from(B).sort(), oL = Float32Array.from(L).sort();

    // 1 · el velo: el punto negro de CADA canal
    var negro = [percentil(oR, 0.5), percentil(oG, 0.5), percentil(oB, 0.5)];
    var negroLin = negro.map(aLineal);

    // 2 · el balance: las luces que no están quemadas
    var umbral = percentil(oL, 92);
    var sR = 0, sG = 0, sB = 0, c = 0;
    for (i = 0; i < n; i++) if (L[i] >= umbral && L[i] < 0.97) { sR += R[i]; sG += G[i]; sB += B[i]; c++; }
    if (c < 200) {
      sR = sG = sB = 0; c = 0;
      for (i = 0; i < n; i++) if (L[i] >= umbral) { sR += R[i]; sG += G[i]; sB += B[i]; c++; }
    }
    c = Math.max(c, 1);
    var claroLin = [sR / c, sG / c, sB / c].map(function (v, k) {
      return aLineal(recortar(v - negro[k] * 0.92 * fuerza, 0, 1));
    });
    var prom = (claroLin[0] + claroLin[1] + claroLin[2]) / 3;
    var gan = claroLin.map(function (v) { return 1 + (prom / Math.max(v, 1e-4) - 1) * fuerza; });

    // 3 · la exposición: mediana de la luminancia YA limpia
    var lim = new Float32Array(n);
    for (i = 0; i < n; i++) {
      lim[i] = luma(
        aSrgb(Math.max(0, aLineal(R[i]) - negroLin[0] * 0.92 * fuerza) * gan[0]),
        aSrgb(Math.max(0, aLineal(G[i]) - negroLin[1] * 0.92 * fuerza) * gan[1]),
        aSrgb(Math.max(0, aLineal(B[i]) - negroLin[2] * 0.92 * fuerza) * gan[2]));
    }
    var med = percentil(Float32Array.from(lim).sort(), 50);
    var expGan = med > 0.02
      ? 1 + (aLineal(EXPOSICION_OBJETIVO) / Math.max(aLineal(med), 1e-4) - 1) * 0.65 * fuerza
      : 1;
    expGan = recortar(expGan, 0.6, 1.9);   // techo para material muy raro

    return { negroLin: negroLin, gan: gan, expGan: expGan, fuerza: fuerza,
             negro: negro, medianaAntes: percentil(oL, 50), medianaDespues: med };
  }

  function reveladoColor(m, r, g, b) {
    return [r, g, b].map(function (x, k) {
      return aSrgb(Math.max(0, aLineal(x) - m.negroLin[k] * 0.92 * m.fuerza) * m.gan[k] * m.expGan);
    });
  }

  function generarLutRevelado(m, n) {
    n = n || 17;
    var out = new Float32Array(n * n * n * 3), i = 0;
    for (var ib = 0; ib < n; ib++) for (var ig = 0; ig < n; ig++) for (var ir = 0; ir < n; ir++) {
      var o = reveladoColor(m, ir / (n - 1), ig / (n - 1), ib / (n - 1));
      out[i++] = o[0]; out[i++] = o[1]; out[i++] = o[2];
    }
    return out;
  }

  /* ══ IGUALAR TOMAS (28-sep-2026, fase 1 del color «como DaVinci») ══
     Sergio: «que todos los clips se normalicen». Un colorista iguala cada toma POR LA PERSONA: tu piel con la misma luz
     y el mismo tono en todas. Antes el revelado medía el video entero una vez: un clip con luz de ventana y otro de
     lámpara recibían la misma corrección.
     · `medirToma` (al subir cada clip): el negro y el blanco de la toma (como el revelado) y la piel de la persona,
       medida dentro de su silueta (carrete-recorte). Se guarda en `clips.color_toma`.
     · `igualarTomas` (al armar un video, con TODAS sus tomas): la piel objetivo del video; cada toma con persona lleva su
       piel a esa luz y ese tono. Las tomas sin persona (manos, pantallas) quedan con la luz de todo el video.
     · `primariaColor`: la corrección de una toma (va en la tabla antes del look). La aplica F1 al cortar cada trozo, y la
       vista previa de los cortes hace lo mismo con la misma cuenta. */
  var PERSONA_MIN = 0.12;        // una toma «con persona»: la silueta ocupa al menos esto (manos solas no cuentan)
  var PIEL_H = 58, PIEL_ANCHO = 40;   // la piel en Lab: tono ~58°, se corrige solo cerca de ahí
  function mediana(v) { var s = v.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }

  /* `px`: cuadros chicos de la toma (rgb24). `cuadro` + `masc`: un cuadro (rgb24) y su silueta (gris, mismo tamaño). */
  function medirToma(px, cuadro, masc) {
    var m = medirRevelado(px, 1, 3);
    // las luces de la toma (64 franjas): juntando las de todas las tomas sale la luz de TODO el video, como el revelado
    var hist = new Array(64).fill(0), n = Math.floor(px.length / 3);
    for (var q = 0; q < n; q++) {
      var y = luma(px[q * 3] / 255, px[q * 3 + 1] / 255, px[q * 3 + 2] / 255);
      hist[Math.min(63, Math.floor(y * 64))]++;
    }
    hist = hist.map(function (x) { return Math.round(x * 10000 / Math.max(n, 1)); });
    var out = { v: 1, negroLin: m.negroLin, gan: m.gan, expGan: m.expGan, hist: hist, piel: null, persona: 0 };
    if (!cuadro || !masc || masc.length * 3 !== cuadro.length) return out;
    var persona = 0, L = [], A = [], B = [];
    for (var p = 0, i = 0; p < masc.length; p++, i += 3) {
      if (masc[p] < 160) continue;
      persona++;
      // la piel se mide ya con el negro y el blanco de la toma (lo que ve la corrección siguiente)
      var c3 = [0, 1, 2].map(function (k) { return aSrgb(Math.max(0, aLineal(cuadro[i + k] / 255) - m.negroLin[k] * 0.92) * m.gan[k]); });
      var lab = aLab(c3[0], c3[1], c3[2]);
      var C = Math.hypot(lab[1], lab[2]), h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
      if (lab[0] < 22 || lab[0] > 92 || C < 7 || C > 55 || h < 20 || h > 95) continue;
      L.push(lab[0]); A.push(lab[1]); B.push(lab[2]);
    }
    out.persona = persona / masc.length;
    if (L.length >= 400) out.piel = { L: mediana(L), a: mediana(A), b: mediana(B), n: L.length };
    return out;
  }

  /* Las tomas de UN video → la corrección de cada una. null si falta la medida de alguna (se usa el revelado de antes). */
  function igualarTomas(medidas) {
    if (!Array.isArray(medidas) || !medidas.length || medidas.some(function (m) { return !m || !m.gan; })) return null;
    var conPiel = medidas.filter(function (m) { return m.piel && m.persona >= PERSONA_MIN; });
    // la luz de todo el video (como el revelado de antes) para las tomas sin persona: la mediana de todas sus luces
    var tot = new Array(64).fill(0), suma = 0, med = EXPOSICION_OBJETIVO;
    medidas.forEach(function (m) { (m.hist || []).forEach(function (x, k) { tot[k] += x; suma += x; }); });
    for (var k = 0, acc = 0; k < 64 && suma; k++) { acc += tot[k]; if (acc >= suma / 2) { med = (k + 0.5) / 64; break; } }
    var expVideo = recortar(1 + (aLineal(EXPOSICION_OBJETIVO) / Math.max(aLineal(med), 1e-4) - 1) * 0.65, 0.6, 1.9);
    var objL = conPiel.length ? recortar(mediana(conPiel.map(function (m) { return m.piel.L; })), 56, 68) : null;
    var objA = conPiel.length ? mediana(conPiel.map(function (m) { return m.piel.a; })) : 0;
    var objB = conPiel.length ? mediana(conPiel.map(function (m) { return m.piel.b; })) : 0;
    return medidas.map(function (m) {
      var p = { primaria: true, negroLin: m.negroLin, gan: m.gan, exp: expVideo, da: 0, db: 0 };
      if (objL != null && m.piel && m.persona >= PERSONA_MIN) {
        var Yp = deLab(m.piel.L, 0, 0)[1], Yo = deLab(objL, 0, 0)[1];
        p.exp = recortar(aLineal(Yo) / Math.max(aLineal(Yp), 1e-4), 0.5, 2);
        p.da = recortar((objA - m.piel.a) * 0.6, -5, 5);
        p.db = recortar((objB - m.piel.b) * 0.6, -5, 5);
      }
      return p;
    });
  }

  /* La corrección de una toma: negro, blanco, luz y la piel (solo los tonos cerca de la piel) */
  function primariaColor(p, r, g, b) {
    var c = [r, g, b].map(function (x, k) { return aSrgb(Math.max(0, aLineal(x) - p.negroLin[k] * 0.92) * p.gan[k] * p.exp); });
    if (p.da || p.db) {
      var lab = aLab(c[0], c[1], c[2]);
      var C = Math.hypot(lab[1], lab[2]), h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
      var w = campana(distTono(h, PIEL_H), PIEL_ANCHO) * recortar(C / 10, 0, 1) * (lab[0] > 15 && lab[0] < 95 ? 1 : 0);
      if (w > 0) c = deLab(lab[0], lab[1] + p.da * w, lab[2] + p.db * w);
    }
    return c;
  }

  /* ══ ZONAS (28-sep-2026) ══ Sergio: «un controlador que controle los colores del fondo y otro la piel de la persona…
     lo que nunca debe cambiar es el borde entre la persona y el fondo… la piel sí se puede configurar diferente y la ropa».
     Tres zonas con los controles de la corrección general, encima del look: FONDO (fuera de la silueta de la persona),
     PIEL y ROPA (dentro). Piel y ropa se separan por el color, suave, como el selector de tonos de DaVinci (`pesoPiel`):
     la cara, los brazos y las manos son piel; la ropa, el pelo y la barba, ropa. El borde con el fondo lo pone la silueta
     suavizada (la misma del look Selectivo): nunca un corte duro. */
  var ZONAS = [{ k: 'fondo', nombre: 'Fondo' }, { k: 'piel', nombre: 'Piel' }, { k: 'ropa', nombre: 'Ropa y pelo' }];
  /* {fondo:{exposicion:…}, piel:{…}, ropa:{…}} (−100..100) → las que se movieron, en −1..1. null si ninguna. */
  function zonasDe(z) {
    if (!z) return null;
    var o = {}, hay = false;
    ZONAS.forEach(function (x) {
      var K = correccionDe(z[x.k]); if (K) { o[x.k] = K; hay = true; }
      var H = z[x.k] ? hslDe(z[x.k].hsl) : null; if (H) { o[x.k + 'Hsl'] = H; hay = true; }   // (28-sep) su HSL
    });
    return hay ? o : null;
  }
  /* Cuánto parece piel un color (0..1): tono de piel, con color, ni negro ni blanco. Suave en todos los bordes. */
  function pesoPiel(r, g, b) {
    var lab = aLab(recortar(r, 0, 1), recortar(g, 0, 1), recortar(b, 0, 1));
    var C = Math.hypot(lab[1], lab[2]), h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
    return campana(distTono(h, PIEL_H), 34) * rampa(C, 6, 14) * (1 - rampa(C, 48, 62)) *
      rampa(lab[0], 14, 26) * (1 - rampa(lab[0], 90, 97));
  }

  /* ══ HSL (28-sep-2026) ══ Sergio: «seleccionar un color y modificarlo: si hay una planta verde, selecciono verde y ese
     verde lo puedo cambiar a rojo o al color que quiera, o aumentarle y disminuirle la saturación, pero solamente de ese
     color». Ocho colores como en Lightroom, cada uno con TONO (hasta media vuelta: el verde puede volverse rojo),
     SATURACIÓN y LUZ. En Lab (LCh): los grises, el blanco y el negro no se tocan. Entre dos colores vecinos el paso es
     suave (los pesos suman 1), nada queda recortado. Va en la general y en cada zona (fondo, piel, ropa), antes del look. */
  var BANDAS = [
    { k: 'rojo', nombre: 'Rojos', uno: 'rojo', h: 30, muestra: '#d8352f' },
    { k: 'naranja', nombre: 'Naranjas', uno: 'naranja', h: 62, muestra: '#f08a2a' },
    { k: 'amarillo', nombre: 'Amarillos', uno: 'amarillo', h: 95, muestra: '#f0d02a' },
    { k: 'verde', nombre: 'Verdes', uno: 'verde', h: 140, muestra: '#38a84a' },
    { k: 'aguamarina', nombre: 'Aguamarinas', uno: 'aguamarina', h: 195, muestra: '#1fbcbc' },
    { k: 'azul', nombre: 'Azules', uno: 'azul', h: 272, muestra: '#2f6fe0' },
    { k: 'morado', nombre: 'Morados', uno: 'morado', h: 312, muestra: '#8c45d8' },
    { k: 'magenta', nombre: 'Magentas', uno: 'magenta', h: 350, muestra: '#e03a98' },
  ];
  var HSL_CONTROLES = [
    { k: 'tono', nombre: 'Tono', menos: 'Hacia el anterior', mas: 'Hacia el siguiente' },
    { k: 'sat', nombre: 'Saturación', menos: 'Menos color', mas: 'Más color' },
    { k: 'luz', nombre: 'Luz', menos: 'Más oscuro', mas: 'Más claro' },
  ];
  /* {verde:{tono,sat,luz}} (−100..100) → los que se movieron en −1..1; null si nada */
  function hslDe(x) {
    if (!x || typeof x !== 'object') return null;
    var o = {}, hay = false;
    BANDAS.forEach(function (bd) {
      var v = x[bd.k]; if (!v) return;
      var d = { tono: num(v.tono), sat: num(v.sat), luz: num(v.luz) };
      if (d.tono || d.sat || d.luz) { o[bd.k] = d; hay = true; }
    });
    // «Tu color»: el que se escogió tocando el video (su tono exacto `h`, 0–360)
    var pr = x.propio;
    if (pr && isFinite(Number(pr.h))) {
      var dp = { h: ((Number(pr.h) % 360) + 360) % 360, tono: num(pr.tono), sat: num(pr.sat), luz: num(pr.luz) };
      // (28-sep) la luz del objeto que se tocó (L de Lab, 0–100): de l0 a l1
      if (isFinite(Number(pr.l0)) && isFinite(Number(pr.l1)) && Number(pr.l1) > Number(pr.l0)) {
        dp.l0 = recortar(Number(pr.l0), 0, 100); dp.l1 = recortar(Number(pr.l1), 0, 100);
      }
      if (dp.tono || dp.sat || dp.luz) { o.propio = dp; hay = true; }
    }
    return hay ? o : null;
  }
  /* Cuánto pertenece un tono h a la banda i: 1 en su centro, 0 en el centro de las vecinas, suave en medio */
  function pesoBanda(h, i) {
    var n = BANDAS.length, c = BANDAS[i].h;
    var d = ((h - c + 180) % 360 + 360) % 360 - 180;
    var vecina = BANDAS[(i + (d >= 0 ? 1 : n - 1)) % n].h;
    var hueco = Math.abs(((vecina - c + 180) % 360 + 360) % 360 - 180) || 45;
    var t2 = Math.abs(d) / hueco;
    return t2 >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * t2);
  }
  /* La banda de un color (para escoger tocando el video): su banda, su tono exacto (h) y cuánto color tiene (croma) */
  function bandaDe(r, g, b) {
    var lab = aLab(recortar(r, 0, 1), recortar(g, 0, 1), recortar(b, 0, 1));
    var h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360, mejor = 0, pm = -1;
    BANDAS.forEach(function (bd, i) { var w = pesoBanda(h, i); if (w > pm) { pm = w; mejor = i; } });
    return { k: BANDAS[mejor].k, h: h, croma: Math.hypot(lab[1], lab[2]), L: lab[0] };
  }
  /* (28-sep) Lo que se tocó en el video: un parche de lado×lado pixeles (ya pasados por lo que va antes del HSL) → el
     tono del objeto y su rango de luz. Manda el CENTRO del toque (peso gaussiano) y lo que tiene color: en una hoja
     delgada el parche agarra también la pared de atrás, y la pared no debe correr el tono ni el rango de luz (medido con
     la planta de Sergio: con la pared adentro, el toque tiñó la escalera). Con menos de 5 de croma un pixel no tiene
     tono. Sin nada con color → { gris: true }. */
  function muestraDeColor(lista, lado) {
    lado = lado || Math.round(Math.sqrt(lista.length));
    var pts = [], i, s = lado / 4, c0 = (lado - 1) / 2;
    for (i = 0; i < lista.length; i++) {
      var q = aLab(recortar(lista[i][0], 0, 1), recortar(lista[i][1], 0, 1), recortar(lista[i][2], 0, 1));
      var C = Math.hypot(q[1], q[2]), dx = (i % lado) - c0, dy = Math.floor(i / lado) - c0;
      pts.push({ L: q[0], C: C, h: (Math.atan2(q[2], q[1]) * 180 / Math.PI + 360) % 360, w: Math.exp(-(dx * dx + dy * dy) / (2 * s * s)) });
    }
    var pct = function (v, p) { return v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]; };
    var Cs = pts.map(function (p) { return p.C; }).sort(function (a, b) { return a - b; });
    var piso = Math.max(5, pct(Cs, 0.9) * 0.7);           // lo que tiene color de verdad en el parche
    var conColor = pts.filter(function (p) { return p.C >= piso; });
    if (conColor.length < Math.max(3, lista.length * 0.08)) return { gris: true, croma: pct(Cs, 0.5) };
    var media = function (lst) {
      var sx = 0, sy = 0;
      lst.forEach(function (p) { var r = p.h * Math.PI / 180; sx += Math.cos(r) * p.C * p.w; sy += Math.sin(r) * p.C * p.w; });
      return (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
    };
    var h0 = media(conColor);
    var cerca = conColor.filter(function (p) { return distTono(p.h, h0) <= 20; });
    if (cerca.length < 3) cerca = conColor;
    var Ls = cerca.map(function (p) { return p.L; }).sort(function (a, b) { return a - b; });
    var Cc = cerca.map(function (p) { return p.C; }).sort(function (a, b) { return a - b; });
    return { h: media(cerca), l0: Math.max(0, pct(Ls, 0.1) - 8), l1: Math.min(100, pct(Ls, 0.9) + 8), croma: pct(Cc, 0.5), L: pct(Ls, 0.5) };
  }
  /* La banda más cercana a un tono (para decir «hacia el naranja» en los extremos del control de Tono) */
  function bandaDeTono(h) {
    h = ((h % 360) + 360) % 360;
    var mejor = 0, pm = -1;
    BANDAS.forEach(function (bd, i) { var w = pesoBanda(h, i); if (w > pm) { pm = w; mejor = i; } });
    return BANDAS[mejor];
  }
  /* Un color de tono h, luz L y croma C que sí cabe en el video (para pintar las pistas de los controles) */
  function colorDeTono(h, L, C) {
    var r = h * Math.PI / 180;
    return enGamut(L, C * Math.cos(r), C * Math.sin(r));
  }
  /* El color de un pixel del video JUSTO ANTES del HSL de una sección: el HSL va después del revelado (o de la
     corrección de la toma) y ANTES del look; el de una zona, además, después del HSL general. Tocar el video escoge el
     tono que el HSL va a encontrar ahí. */
  function colorAntesDeHsl(medida, G, r, g, b) {
    var c = [r, g, b];
    if (medida) c = medida.primaria ? primariaColor(medida, c[0], c[1], c[2]) : reveladoColor(medida, c[0], c[1], c[2]);
    if (G) c = aplicarHsl(c[0], c[1], c[2], G);
    return c;
  }
  /* (28-sep) Que se vea NATURAL. Sergio: «en otras aplicaciones, si cambias un verde a morado queda muy falso, como pintado;
     que parezca que la planta naturalmente fuera morada, con una transición natural entre tonos». Tres cosas:
     1 · Los tonos del borde de la banda NO giran a medias (un verde amarillento, camino al morado, pasaría por el rojo):
         se MEZCLAN hacia el color ya girado. Lo intermedio queda apenas más apagado, nunca de otro color.
     2 · La luz (L) no se toca al girar: la hoja conserva sus brillos y sus sombras.
     3 · Si el color nuevo no cabe en el video, baja un poco su intensidad en vez de recortarse (el recorte deja manchas
         planas, «como pintado»). El núcleo de la banda va entero: todo el objeto cambia parejo. */
  function nucleo(w) { var t2 = recortar(w / 0.7, 0, 1); return t2 * t2 * (3 - 2 * t2); }
  function deLabLineal(L, a, b) {                   // sin recortar: para saber si un color cabe en el video
    var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    var inv = function (f) { var f3 = f * f * f; return f3 > EPS_LAB ? f3 : (116 * f - 16) / K_LAB; };
    var x = inv(fx) * BLANCO[0], y = inv(fy) * BLANCO[1], z = inv(fz) * BLANCO[2];
    return [Mi[0][0] * x + Mi[0][1] * y + Mi[0][2] * z, Mi[1][0] * x + Mi[1][1] * y + Mi[1][2] * z, Mi[2][0] * x + Mi[2][1] * y + Mi[2][2] * z];
  }
  function cabe(c) { return c[0] >= -0.0005 && c[1] >= -0.0005 && c[2] >= -0.0005 && c[0] <= 1.0005 && c[1] <= 1.0005 && c[2] <= 1.0005; }
  function enGamut(L, a, b) {
    if (cabe(deLabLineal(L, a, b))) return deLab(L, a, b);
    var lo = 0, hi = 1;
    for (var k = 0; k < 12; k++) { var m = (lo + hi) / 2; if (cabe(deLabLineal(L, a * m, b * m))) lo = m; else hi = m; }
    return deLab(L, a * lo, b * lo);             // la misma luz y el mismo tono, con el color que sí cabe
  }
  function aplicarHsl(r, g, b, H) {
    var lab = aLab(recortar(r, 0, 1), recortar(g, 0, 1), recortar(b, 0, 1));
    var L = lab[0], a = lab[1], bb = lab[2], C = Math.hypot(a, bb);
    if (C < 0.5) return [r, g, b];
    var h = (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360, da = 0, db = 0, fs = 0, dl = 0;
    /* Los casi grises: girar el color los mueve en proporción a su poco color (no mancha); SUBIR la saturación sí
       amplificaba el ruido de la compresión en una pared blanca con un tinte leve (manchas): ahí se protege más. */
    var colorTono = rampa(C, 4, 11), colorMas = rampa(C, 6, 16), colorMenos = rampa(C, 2, 6);
    function sumar(v, w0) {
      if (!w0) return;
      var w = w0 * colorTono;
      if (v.tono) {
        var ang = v.tono * Math.PI;                 // hasta media vuelta: el verde puede volverse rojo
        da += w * (a * Math.cos(ang) - bb * Math.sin(ang) - a);
        db += w * (a * Math.sin(ang) + bb * Math.cos(ang) - bb);
      }
      if (v.sat) fs += w0 * v.sat * (v.sat > 0 ? colorMas : colorMenos);
      dl += w * (v.luz || 0) * 25;
    }
    BANDAS.forEach(function (bd, i) { var v = H[bd.k]; if (v) sumar(v, nucleo(pesoBanda(h, i))); });
    // «Tu color»: entero hasta ~12° de su tono y suave hasta 38° (cambia el objeto completo y parejo, sin agarrar lo de al
    // lado: la planta oliva de Sergio está a ~40° de la pared blanca cálida y de la madera). Y por su LUZ (l0–l1, lo que
    // midió el toque, suave 12 más allá): la escalera iluminada de beige tiene casi el tono de la hoja oliva pero es mucho
    // más clara; así la escalera no se tiñe. Como el calificador de DaVinci (tono + luz).
    if (H.propio) {
      var pr = H.propio, wl = pr.l1 > pr.l0 ? rampa(L, pr.l0 - 12, pr.l0) * (1 - rampa(L, pr.l1, pr.l1 + 12)) : 1;
      sumar(pr, nucleo(campana(distTono(h, pr.h), 38)) * wl);
    }
    var s = Math.max(0, 1 + fs);
    return enGamut(recortar(L + dl, 0, 100), (a + da) * s, (bb + db) * s);
  }

  /* ══ COLOR POR REFERENCIA (28-sep-2026, fase 3) ══ Sergio escogió: «subes una foto o un video cuyo color te guste y
     Cherry lleva tus tomas a ese color, respetando la piel». Es lo que se hizo A MANO con Cherry Gold
     (carrete-docs/looks/LOOK-CHERRY-GOLD.md): medir la referencia y el video OBJETO POR OBJETO — piel, luz cálida,
     verdes, sombras, luces neutras, la curva de tonos, la viñeta — y escribir una receta del mismo tipo que las del
     catálogo. Así la referencia queda como un look más: con su intensidad y sus ajustes, igual en la vista previa y
     en el video. La piel nunca se lleva lejos de un tono de piel natural. */
  var CUANTILES = [1, 5, 15, 30, 50, 70, 85, 95, 99];
  /* px: bytes RGB o RGBA (paso 3 o 4) · ancho/alto: para la viñeta · fuera(i): true = no medir ese pixel (lo que la IA
     marcó como texto, logos, interfaz) · antes(r,g,b): lo que va antes (el revelado del video) */
  function medirParaReferencia(px, paso, ancho, alto, fuera, antes) {
    paso = paso || 4;
    var total = Math.floor(px.length / paso), salto = Math.max(1, Math.floor(total / 90000));
    var histL = new Float64Array(201), histC = new Float64Array(121), n = 0;
    var z = { piel: [0, 0, 0, 0, 0], calido: [0, 0, 0, 0, 0], verde: [0, 0, 0, 0, 0], sombra: [0, 0, 0, 0, 0], luz: [0, 0, 0, 0, 0] };
    var esquinas = [0, 0], centro = [0, 0], L0 = 0;
    function sumar(k, w, a, b, C) { if (w > 0.001) { z[k][0] += w; z[k][1] += w * a; z[k][2] += w * b; z[k][3] += w * C; z[k][4] += w * L0; } }
    for (var i = 0; i < total; i += salto) {
      if (fuera && fuera(i)) continue;
      var r = px[i * paso] / 255, g = px[i * paso + 1] / 255, b = px[i * paso + 2] / 255;
      if (antes) { var q = antes(r, g, b); r = q[0]; g = q[1]; b = q[2]; }
      var lab = aLab(recortar(r, 0, 1), recortar(g, 0, 1), recortar(b, 0, 1));
      var L = lab[0], A = lab[1], B = lab[2], C = Math.hypot(A, B), h = (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
      n++; L0 = L;
      histL[Math.round(recortar(L, 0, 100) * 2)]++;
      var wP = pesoPiel(r, g, b), color = rampa(C, 4, 12);
      if (C > 6 && wP < 0.3) histC[Math.min(120, Math.round(C))]++;
      sumar('piel', wP, A, B, C);
      sumar('calido', campana(distTono(h, 64), 24) * color * (1 - wP), A, B, C);
      sumar('verde', campana(distTono(h, 125), 50) * color, A, B, C);
      // los NEGROS (lo oscuro y casi sin color: la ropa negra), no todo lo oscuro: en un cuarto en penumbra lo oscuro es
      // casi toda la imagen y lleva el color de la luz que lo toca (medido con la referencia de Cherry Gold)
      sumar('sombra', (1 - rampa(L, 6, 28)) * (1 - rampa(C, 10, 20)), A, B, C);
      sumar('luz', rampa(L, 62, 84) * (1 - rampa(C, 14, 30)), A, B, C);
      if (ancho && alto) {
        var x = (i % ancho) / ancho, y = (Math.floor(i / ancho) % alto) / alto;     // varios cuadros seguidos: cada uno
        var dc = Math.hypot(x - 0.5, (y - 0.45) * alto / ancho);
        if ((x < 0.15 || x > 0.85) && (y < 0.12 || y > 0.88)) { esquinas[0] += L; esquinas[1]++; }
        else if (dc < 0.2) { centro[0] += L; centro[1]++; }
      }
    }
    if (!n) return null;
    var cuant = function (p) {
      var objetivo = n * p / 100, acum = 0;
      for (var k = 0; k <= 200; k++) { acum += histL[k]; if (acum >= objetivo) return k / 2; }
      return 100;
    };
    var nC = 0; for (var k = 0; k <= 120; k++) nC += histC[k];
    var medC = 0, acC = 0; for (k = 0; k <= 120; k++) { acC += histC[k]; if (acC >= nC / 2) { medC = k; break; } }
    var o = { n: n, q: CUANTILES.map(cuant), croma: nC > n * 0.03 ? medC : null };
    Object.keys(z).forEach(function (k) {
      var s = z[k];
      o[k] = s[0] / n < 0.004 ? null      // menos de 0,4 % de la imagen: no hay de eso
        : { h: (Math.atan2(s[2], s[1]) * 180 / Math.PI + 360) % 360, a: s[1] / s[0], b: s[2] / s[0], C: s[3] / s[0], L: s[4] / s[0], parte: s[0] / n };
    });
    o.vineta = esquinas[1] > 50 && centro[1] > 50 ? (esquinas[0] / esquinas[1]) / Math.max(1, centro[0] / centro[1]) : null;
    return o;
  }
  var difTono = function (a, b) { return ((a - b + 540) % 360) - 180; };
  /* La receta que lleva el video (src) al color de la referencia (ref). Cada regla solo si las dos imágenes tienen de
     eso (una referencia sin plantas no dice nada de los verdes) y con topes: una referencia rara no rompe el video. */
  function recetaDeReferencia(ref, src) {
    if (!ref || !src) return null;
    var P = { curva: null, sat_general: 1, piel_tono: 45, piel_giro: 0, piel_sat: 1, calido_giro: 0, calido_sat: 1,
      verde_giro: 0, verde_sat: 1, sombra_sat: 1, sombra_tinte: [0, 0], luz_tinte: [0, 0], vineta: 0, densidad: 0 };
    // 1 · la curva. NO se copia la exposición de la escena (la referencia de Cherry Gold es un cuarto en penumbra: con
    //     cuantiles, un video de día quedaba a oscuras): se copia su FORMA, como la leyó un colorista a mano —
    //     el piso de los negros, dónde queda la piel (el sujeto se expone por la piel) y el techo de las luces
    //     («nada llega a blanco»). Entre esos puntos, la curva monótona del motor.
    var nq = CUANTILES.length, s1 = src.q[0], s99 = src.q[nq - 1];
    var negro = recortar(ref.q[0], s1 - 3, s1 + 8);
    var medioX = src.piel ? src.piel.L : src.q[4];
    var medioY = src.piel && ref.piel ? medioX + recortar(ref.piel.L - src.piel.L, -15, 10) * 0.6
      : medioX + recortar(ref.q[4] - src.q[4], -15, 10) * 0.25;
    var techo = Math.min(s99, s99 + ((ref.q[nq - 1] + (100 - ref.q[nq - 1]) * 0.35) - s99) * 0.8);
    var pts = [[0, recortar(negro - s1, 0, 8)], [s1 + 1, negro + 1]];
    if (medioX > s1 + 8 && medioX < s99 - 8) pts.push([medioX, recortar(medioY, negro + 5, techo - 5)]);
    pts.push([s99, techo], [100, Math.min(100, techo + (100 - s99) * 0.5)]);
    pts = pts.filter(function (p, i) { return i === 0 || p[0] - pts[i - 1][0] >= 2; });
    for (var k = 1; k < pts.length; k++) pts[k][1] = Math.max(pts[k][1], pts[k - 1][1] + 0.5);   // nunca se invierte
    P.curva = pts.map(function (p) { return [Math.round(p[0] * 10) / 10, Math.round(recortar(p[1], 0, 100) * 10) / 10]; });
    // 2 · el color de todo
    if (ref.croma && src.croma) P.sat_general = recortar(ref.croma / src.croma, 0.6, 1.35);
    var sg = P.sat_general;
    // 3 · la piel: a su tono, pero SIEMPRE dentro de un tono de piel natural y sin volverse naranja ni gris
    if (src.piel) {
      if (ref.piel && ref.piel.parte > 0.01) {
        /* «respetando la piel» (y Sergio ya se quejó de caras naranjas): el tono se mueve poco (≤ 8°) y siempre dentro
           de un tono de piel natural; el color, entre 0,75 y 1 vez el suyo: la piel nunca sale más viva que la tuya
           (medido en la vista previa: con 1,15 ya se veía naranja al lado de Cherry Gold) */
        P.piel_tono = recortar(ref.piel.h, 40, 60);
        P.piel_giro = recortar(Math.abs(difTono(P.piel_tono, src.piel.h)) + 2, 2, 8);
        P.piel_sat = recortar(recortar(ref.piel.C / src.piel.C, 0.75, 1) / sg, 0.5, 1.2);
      } else { P.piel_tono = recortar(src.piel.h, 40, 60); P.piel_sat = recortar(1 / sg, 0.5, 1.2); }
    }
    // 4 · luz cálida y verdes: a donde los tiene la referencia
    if (ref.calido && src.calido) {
      P.calido_giro = recortar(difTono(ref.calido.h, src.calido.h), -15, 15);
      P.calido_sat = recortar((ref.calido.C / src.calido.C) / sg, 0.6, 1.6);
    }
    if (ref.verde && src.verde) {
      P.verde_giro = recortar(difTono(ref.verde.h, src.verde.h), -45, 25);
      P.verde_sat = recortar((ref.verde.C / src.verde.C) / sg, 0.3, 1.5);
    }
    // 5 · sombras y luces: su color (el tinte que se suma) y cuánto color les queda
    if (ref.sombra && src.sombra) {
      P.sombra_sat = recortar((ref.sombra.C / Math.max(2, src.sombra.C)) / sg, 0.3, 1.3);
      var f = P.sombra_sat * sg;
      P.sombra_tinte = [recortar(ref.sombra.a - src.sombra.a * f, -6, 6), recortar(ref.sombra.b - src.sombra.b * f, -6, 6)];
    }
    // las luces neutras solo si la referencia tiene de verdad (un 2 %): con menos, su color es ruido
    if (ref.luz && src.luz && ref.luz.parte > 0.02) P.luz_tinte = [recortar((ref.luz.a - src.luz.a) * 0.6, -4, 4), recortar((ref.luz.b - src.luz.b) * 0.6, -4, 4)];
    // 6 · la viñeta: si las esquinas de la referencia son bastante más oscuras que el centro (y las del video no)
    if (ref.vineta != null && ref.vineta < 0.78 && !(src.vineta != null && src.vineta < 0.85)) P.vineta = 1;
    ['sat_general', 'piel_tono', 'piel_giro', 'piel_sat', 'calido_giro', 'calido_sat', 'verde_giro', 'verde_sat', 'sombra_sat']
      .forEach(function (k) { P[k] = Math.round(P[k] * 100) / 100; });
    P.sombra_tinte = P.sombra_tinte.map(function (x) { return Math.round(x * 10) / 10; });
    P.luz_tinte = P.luz_tinte.map(function (x) { return Math.round(x * 10) / 10; });
    return P;
  }
  /* Una receta que llega de afuera (la página, orchestrate): solo sus campos y dentro de sus topes */
  function recetaSegura(x) {
    if (!x || typeof x !== 'object' || !Array.isArray(x.curva)) return null;
    var nn = function (v, a, b, d) { v = Number(v); return isFinite(v) ? recortar(v, a, b) : d; };
    var curva = x.curva.filter(function (p) { return Array.isArray(p) && p.length === 2; }).slice(0, 16)
      .map(function (p) { return [nn(p[0], 0, 100, 0), nn(p[1], 0, 100, 0)]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    if (curva.length < 2) return null;
    for (var k = 1; k < curva.length; k++) if (curva[k][0] <= curva[k - 1][0]) curva[k][0] = curva[k - 1][0] + 0.5;
    for (k = 1; k < curva.length; k++) curva[k][1] = Math.max(curva[k][1], curva[k - 1][1]);
    var par = function (v, t) { return Array.isArray(v) ? [nn(v[0], -t, t, 0), nn(v[1], -t, t, 0)] : [0, 0]; };
    return { curva: curva, sat_general: nn(x.sat_general, 0.3, 2, 1), piel_tono: nn(x.piel_tono, 20, 70, 45), piel_giro: nn(x.piel_giro, 0, 15, 0),
      piel_sat: nn(x.piel_sat, 0.5, 1.5, 1), calido_giro: nn(x.calido_giro, -20, 20, 0), calido_sat: nn(x.calido_sat, 0.3, 2, 1),
      verde_giro: nn(x.verde_giro, -60, 30, 0), verde_sat: nn(x.verde_sat, 0.2, 2, 1), sombra_sat: nn(x.sombra_sat, 0.1, 1.5, 1),
      sombra_tinte: par(x.sombra_tinte, 8), luz_tinte: par(x.luz_tinte, 8), vineta: nn(x.vineta, 0, 2, 0), densidad: nn(x.densidad, 0, 1, 0) };
  }
  /* El look de una configuración: uno del catálogo, o «Tu referencia» con su receta */
  function lookDe(id, receta) {
    if (id === 'referencia') { var P = recetaSegura(receta); return P ? { nombre: 'Tu referencia', desc: 'El color de la imagen que subiste', base: P } : null; }
    return id ? CATALOGO[id] || null : null;
  }

  /* (28-sep) «Ver qué cambia»: cuánto agarra un color (una banda {k} o «Tu color» {propio}) — lo mismo que usa
     aplicarHsl — y la tabla de la vista previa que lo enseña: lo que agarra con su color, lo demás en gris (como el
     resaltado del calificador de DaVinci). Solo para la vista previa: nunca va al video. */
  function pesoSeleccion(r, g, b, sel) {
    var lab = aLab(recortar(r, 0, 1), recortar(g, 0, 1), recortar(b, 0, 1)), C = Math.hypot(lab[1], lab[2]);
    if (C < 0.5 || !sel) return 0;
    var h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360, w = 0;
    if (sel.propio) {
      var pr = sel.propio, wl = pr.l1 > pr.l0 ? rampa(lab[0], pr.l0 - 12, pr.l0) * (1 - rampa(lab[0], pr.l1, pr.l1 + 12)) : 1;
      w = nucleo(campana(distTono(h, pr.h), 38)) * wl;
    } else {
      for (var i = 0; i < BANDAS.length; i++) if (BANDAS[i].k === sel.k) w = nucleo(pesoBanda(h, i));
    }
    return w * rampa(C, 4, 11);
  }
  function generarLutSeleccion(medida, sel, n) {
    n = n || 33;
    var out = new Float32Array(n * n * n * 3), i = 0;
    for (var ib = 0; ib < n; ib++) for (var ig = 0; ig < n; ig++) for (var ir = 0; ir < n; ir++) {
      var c = [ir / (n - 1), ig / (n - 1), ib / (n - 1)];
      if (medida) c = medida.primaria ? primariaColor(medida, c[0], c[1], c[2]) : reveladoColor(medida, c[0], c[1], c[2]);
      var w = pesoSeleccion(c[0], c[1], c[2], sel), gris = deLab(aLab(recortar(c[0], 0, 1), recortar(c[1], 0, 1), recortar(c[2], 0, 1))[0], 0, 0);
      out[i++] = gris[0] + (c[0] - gris[0]) * w; out[i++] = gris[1] + (c[1] - gris[1]) * w; out[i++] = gris[2] + (c[2] - gris[2]) * w;
    }
    return out;
  }
  /* (28-sep) Con HSL la tabla va de 64 puntos (no de 33): cerca del gris, entre dos puntos de la tabla de 33 caben
     colores con tonos muy distintos, y al girar uno la mezcla teñía la pared (medido: ΔE 4 en la pared de Sergio con
     33, 0,8 con 64 — ya no se nota). 64 es lo máximo del ffmpeg de las Lambdas. */
  var N_CON_HSL = 64;
  function llevaHsl(G, Z) { return !!(G || (Z && (Z.fondoHsl || Z.pielHsl || Z.ropaHsl))); }

  /* Revelado + look en UNA sola tabla (la vista previa del navegador la usa así). */
  /* Z (28-sep, zonas): la de ESTA tabla — {fondo: K, fondoHsl: H} para la del fondo, {piel, ropa, pielHsl, ropaHsl} para
     la de la persona. G (28-sep): el HSL general.
     El HSL va ANTES del look, como en DaVinci (primero se corrige el color, el look va encima). Medido con la planta de
     Sergio: Cherry Gold vuelve casi café el verde oliva (croma 17 → 7); después del look el HSL ya no tenía qué girar
     y la hoja apenas se teñía. Antes del look la hoja se vuelve morada y el look la integra con el resto del cuadro.
     Los controles de las zonas y la corrección general (luz, temperatura…) siguen encima del look. */
  function generarLutCompleta(medida, P, n, fuerza, K, Z, G) {
    n = n || 33;
    fuerza = fuerza == null ? 1 : recortar(Number(fuerza), 0, 1);
    var curva = P ? prepararCurva(P.curva) : null;
    K = K || null;
    G = G || null;
    Z = Z && (Z.fondo || Z.piel || Z.ropa || Z.fondoHsl || Z.pielHsl || Z.ropaHsl) ? Z : null;
    var conPersona = !!(Z && (Z.piel || Z.ropa || Z.pielHsl || Z.ropaHsl));
    var out = new Float32Array(n * n * n * 3), i = 0;
    for (var ib = 0; ib < n; ib++) for (var ig = 0; ig < n; ig++) for (var ir = 0; ir < n; ir++) {
      var c = [ir / (n - 1), ig / (n - 1), ib / (n - 1)];
      // (28-sep) una toma igualada trae su corrección (`primaria`); si no, el revelado de todo el video
      if (medida) c = medida.primaria ? primariaColor(medida, c[0], c[1], c[2]) : reveladoColor(medida, c[0], c[1], c[2]);
      // piel o ropa: se decide con el color de la toma, antes del look (el look cambia los tonos)
      var wPiel = conPersona ? pesoPiel(c[0], c[1], c[2]) : 0;
      // (28-sep) HSL: el general, luego el de la zona (en la persona, el de la piel y el de la ropa, mezclados)
      if (G) c = aplicarHsl(c[0], c[1], c[2], G);
      if (Z && Z.fondoHsl) c = aplicarHsl(c[0], c[1], c[2], Z.fondoHsl);
      if (Z && (Z.pielHsl || Z.ropaHsl)) {
        var hp = Z.pielHsl ? aplicarHsl(c[0], c[1], c[2], Z.pielHsl) : c;
        var hr = Z.ropaHsl ? aplicarHsl(c[0], c[1], c[2], Z.ropaHsl) : c;
        c = [hr[0] + (hp[0] - hr[0]) * wPiel, hr[1] + (hp[1] - hr[1]) * wPiel, hr[2] + (hp[2] - hr[2]) * wPiel];
      }
      if (P) {
        var o = aplicarColor(c[0], c[1], c[2], P, curva);
        c = [c[0] + (o[0] - c[0]) * fuerza, c[1] + (o[1] - c[1]) * fuerza, c[2] + (o[2] - c[2]) * fuerza];
      }
      if (K) c = aplicarCorreccion(c[0], c[1], c[2], K);
      if (Z) {
        if (Z.fondo) c = aplicarCorreccion(c[0], c[1], c[2], Z.fondo);
        if (Z.piel || Z.ropa) {
          var cp = Z.piel ? aplicarCorreccion(c[0], c[1], c[2], Z.piel) : c;
          var cr = Z.ropa ? aplicarCorreccion(c[0], c[1], c[2], Z.ropa) : c;
          c = [cr[0] + (cp[0] - cr[0]) * wPiel, cr[1] + (cp[1] - cr[1]) * wPiel, cr[2] + (cp[2] - cr[2]) * wPiel];
        }
      }
      out[i++] = c[0]; out[i++] = c[1]; out[i++] = c[2];
    }
    return out;
  }

  var API = {
    CATALOGO: CATALOGO, AJUSTES: AJUSTES, CORRECCION: CORRECCION, correccionDe: correccionDe, aplicarCorreccion: aplicarCorreccion,
    ajustar: ajustar, aplicarColor: aplicarColor, prepararCurva: prepararCurva,
    generarLut: generarLut, aCube: aCube,
    anguloVineta: anguloVineta, factorVineta: factorVineta, filtroVineta: filtroVineta,
    VINETA_Y: VINETA_Y, VINETA_ASPECTO: VINETA_ASPECTO,
    medirRevelado: medirRevelado, reveladoColor: reveladoColor,
    medirToma: medirToma, igualarTomas: igualarTomas, primariaColor: primariaColor, PERSONA_MIN: PERSONA_MIN,
    ZONAS: ZONAS, zonasDe: zonasDe, pesoPiel: pesoPiel,
    BANDAS: BANDAS, HSL_CONTROLES: HSL_CONTROLES, hslDe: hslDe, aplicarHsl: aplicarHsl, bandaDe: bandaDe,
    bandaDeTono: bandaDeTono, colorDeTono: colorDeTono, colorAntesDeHsl: colorAntesDeHsl, muestraDeColor: muestraDeColor,
    pesoSeleccion: pesoSeleccion, generarLutSeleccion: generarLutSeleccion, N_CON_HSL: N_CON_HSL, llevaHsl: llevaHsl,
    medirParaReferencia: medirParaReferencia, recetaDeReferencia: recetaDeReferencia, recetaSegura: recetaSegura, lookDe: lookDe,
    generarLutRevelado: generarLutRevelado, generarLutCompleta: generarLutCompleta,
    aLab: aLab, deLab: deLab,
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherryColor = API;
})(typeof window !== 'undefined' ? window : this);

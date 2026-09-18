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
    return P;
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

  /* Revelado + look en UNA sola tabla (la vista previa del navegador la usa así). */
  function generarLutCompleta(medida, P, n, fuerza) {
    n = n || 33;
    fuerza = fuerza == null ? 1 : recortar(Number(fuerza), 0, 1);
    var curva = P ? prepararCurva(P.curva) : null;
    var out = new Float32Array(n * n * n * 3), i = 0;
    for (var ib = 0; ib < n; ib++) for (var ig = 0; ig < n; ig++) for (var ir = 0; ir < n; ir++) {
      var c = [ir / (n - 1), ig / (n - 1), ib / (n - 1)];
      if (medida) c = reveladoColor(medida, c[0], c[1], c[2]);
      if (P) {
        var o = aplicarColor(c[0], c[1], c[2], P, curva);
        c = [c[0] + (o[0] - c[0]) * fuerza, c[1] + (o[1] - c[1]) * fuerza, c[2] + (o[2] - c[2]) * fuerza];
      }
      out[i++] = c[0]; out[i++] = c[1]; out[i++] = c[2];
    }
    return out;
  }

  var API = {
    CATALOGO: CATALOGO, AJUSTES: AJUSTES,
    ajustar: ajustar, aplicarColor: aplicarColor, prepararCurva: prepararCurva,
    generarLut: generarLut, aCube: aCube,
    anguloVineta: anguloVineta, factorVineta: factorVineta, filtroVineta: filtroVineta,
    VINETA_Y: VINETA_Y, VINETA_ASPECTO: VINETA_ASPECTO,
    medirRevelado: medirRevelado, reveladoColor: reveladoColor,
    generarLutRevelado: generarLutRevelado, generarLutCompleta: generarLutCompleta,
    aLab: aLab, deLab: deLab,
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherryColor = API;
})(typeof window !== 'undefined' ? window : this);

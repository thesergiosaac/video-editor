/* libreta.js — familia «Libreta a mano» (copia de @nicofastt, sus 2 carruseles de libreta).
 * Una libreta REAL fotografiada sobre una mesa y todo escrito a mano con UNA tinta: títulos en mayúscula de molde,
 * texto suelto, recuadros simples y dobles, óvalos, chulos, flechas, tabla, celular e íconos trazados a pulso
 * (rough.js, MIT, va al final de este archivo). El fondo (mesa) y el tipo de libreta se escogen aparte:
 * c.opciones = { fondo: 'granito'|'madera'|'concreto'|'marmol', libreta: 'espiral'|'hoja'|'rasgado' }.
 */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var P = U.BASE + 'piezas/libreta/';

  // Kalam trae 300, 400 y 700: se piden esos tres (el cargador general pide 400–900 y se quedaría sin la 300)
  if (!document.querySelector('link[data-libreta-kalam]')) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.libretaKalam = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap'; document.head.appendChild(l);
  }

  /* ── catálogo ampliable de mesas y libretas (cada libreta con su lugar y su área útil) ── */
  var FONDOS = {
    granito: { nombre: 'Granito', src: P + 'fondo-granito.jpg' },
    madera: { nombre: 'Madera', src: P + 'fondo-madera.jpg', foto: true },   // la foto original: la libreta de espiral calza encima
    concreto: { nombre: 'Concreto', src: P + 'fondo-concreto.jpg' },
    marmol: { nombre: 'Mármol', src: P + 'fondo-marmol.jpg' },
  };
  // x/y/w/h/rot de la hoja en 1080×1440 (la referencia); el texto va en x 175–960
  var LIBRETAS = {
    espiral: { nombre: 'Espiral', src: P + 'libreta-espiral.webp', x: 53, y: 189, w: 942, h: 1261, rot: 0 },
    hoja: { nombre: 'Hoja rayada', src: P + 'libreta-hoja.jpg', x: 90, y: 150, w: 900, h: 1200, rot: -1.2 },
    rasgado: { nombre: 'Papel rasgado', src: P + 'libreta-rasgado.webp', x: 60, y: -10, w: 960, h: 1490, rot: 0 },
  };

  /* ── el trazo a mano: recuadros, óvalos, chulos, flechas, tabla, celular e íconos ── */
  function atributos(s) { var o = {}, m, re = /([a-z-]+)="([^"]*)"/g; while ((m = re.exec(s))) o[m[1]] = m[2]; return o; }
  function trazos(el, col) {
    if (!window.rough) return '';
    var g = rough.generator(), w = el.w, h = el.h, s = el.semilla || 7, out = [];
    function op(x) { var o = { stroke: col, strokeWidth: 3.2, roughness: 1.4, bowing: 1.2, seed: s++ }; for (var k in x) o[k] = x[k]; return o; }
    function add(d, lista) { g.toPaths(d).forEach(function (p) { (lista || out).push('<path d="' + p.d + '" stroke="' + p.stroke + '" stroke-width="' + p.strokeWidth + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'); }); }
    var f = el.forma;
    if (f === 'caja') add(g.rectangle(4, 4, w - 8, h - 8, op()));
    if (f === 'caja2') { add(g.rectangle(4, 4, w - 8, h - 8, op({ strokeWidth: 2.6 }))); add(g.rectangle(10, 10, w - 20, h - 18, op({ strokeWidth: 1.6, roughness: 2 }))); }
    if (f === 'ovalo') add(g.ellipse(w / 2, h / 2, w - 6, h - 6, op({ strokeWidth: 2.6 })));
    if (f === 'chulo') add(g.linearPath([[4, h * .55], [w * .38, h - 4], [w - 2, 4]], op({ strokeWidth: 4.5 })));
    if (f === 'flecha') { add(g.line(2, h / 2, w - 6, h / 2, op())); add(g.linearPath([[w - 22, 4], [w - 4, h / 2], [w - 22, h - 4]], op())); }
    if (f === 'abajo') { add(g.line(w / 2, 2, w / 2, h - 6, op())); add(g.linearPath([[4, h - 18], [w / 2, h - 3], [w - 4, h - 18]], op())); }
    if (f === 'celular') {
      var r = 46, pth = 'M' + r + ',4 H' + (w - r) + ' Q' + (w - 4) + ',4 ' + (w - 4) + ',' + r + ' V' + (h - r) + ' Q' + (w - 4) + ',' + (h - 4) + ' ' + (w - r) + ',' + (h - 4) + ' H' + r + ' Q4,' + (h - 4) + ' 4,' + (h - r) + ' V' + r + ' Q4,4 ' + r + ',4 Z';
      add(g.path(pth, op({ strokeWidth: 3.6 }))); add(g.rectangle(w / 2 - 50, 22, 100, 20, op({ strokeWidth: 2.4 }))); add(g.circle(w / 2, h - 30, 22, op({ strokeWidth: 2.4 })));
    }
    if (f === 'tabla') {
      var c = el.cols || [.5], nf = el.filas || 4;
      add(g.rectangle(3, 3, w - 6, h - 6, op({ strokeWidth: 2.4 })));
      c.forEach(function (fr) { add(g.line(w * fr, 3, w * fr, h - 3, op({ strokeWidth: 2 }))); });
      for (var j = 1; j < nf; j++) add(g.line(3, h * j / nf, w - 3, h * j / nf, op({ strokeWidth: 1.6 })));
    }
    if (f === 'icono') {
      var src = (window.ICONOS && ICONOS[el.icono]) || '', k = Math.min(w, h) / 24, dentro = [];
      var oi = op({ strokeWidth: 2.2 / k * 1.4, roughness: .9 });
      var re = /<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*)>/g, m;
      while ((m = re.exec(src))) {
        var a = atributos(m[2]), n = function (x) { return parseFloat(a[x] || 0); };
        oi.seed = s++;
        if (m[1] === 'path') add(g.path(a.d, oi), dentro);
        if (m[1] === 'circle') add(g.circle(n('cx'), n('cy'), n('r') * 2, oi), dentro);
        if (m[1] === 'ellipse') add(g.ellipse(n('cx'), n('cy'), n('rx') * 2, n('ry') * 2, oi), dentro);
        if (m[1] === 'rect') add(g.rectangle(n('x'), n('y'), n('width'), n('height'), oi), dentro);
        if (m[1] === 'line') add(g.line(n('x1'), n('y1'), n('x2'), n('y2'), oi), dentro);
        if (m[1] === 'polyline' || m[1] === 'polygon') { var nums = a.points.trim().split(/[\s,]+/).map(Number), pts = []; for (var q = 0; q + 1 < nums.length; q += 2) pts.push([nums[q], nums[q + 1]]); if (m[1] === 'polygon') pts.push(pts[0]); add(g.linearPath(pts, oi), dentro); }
      }
      out.push('<g transform="translate(' + ((w - 24 * k) / 2) + ',' + ((h - 24 * k) / 2) + ') scale(' + k + ')">' + dentro.join('') + '</g>');
    }
    return out.join('');
  }
  LZ.tipo('trazo', function (el, base, attrs, u) {
    return '<div ' + attrs + ' style="' + base + 'mix-blend-mode:multiply"><svg viewBox="0 0 ' + el.w + ' ' + el.h + '" width="100%" height="100%" style="display:block;overflow:visible">' + trazos(el, u.res(el.color)) + '</svg></div>';
  });

  FAMILIAS.registrar('libreta', {
    catalogo: {
      letras: { titular: 'Kalam', mano: 'Kalam', cuerpo: 'Kalam' },
      colores: { principal: '#1C34A6', acento: '#1C34A6', fondo: '#EEF3F2', texto: '#1C34A6' },
      // se escogen aparte (Sergio): el carrusel las guarda en contenido.opciones
      opciones: {
        fondo: { nombre: 'Mesa', defecto: 'granito', valores: Object.keys(FONDOS).map(function (k) { return { id: k, nombre: FONDOS[k].nombre, img: FONDOS[k].src }; }) },
        libreta: { nombre: 'Libreta', defecto: 'espiral', valores: Object.keys(LIBRETAS).map(function (k) { return { id: k, nombre: LIBRETAS[k].nombre, img: LIBRETAS[k].src }; }) },
      },
    },
    esquema: {
      nombre: 'Libreta a mano', nItems: 4, iconos: U.ICONOS_OK,
      guia: 'Todo parece escrito a mano en una libreta: sirve para enseñar un sistema, prompts o pasos que la gente copia. Cada lámina del medio trae un bloque para copiar tal cual (un prompt, un guion, una plantilla) y una forma distinta: óvalos, flujo, tabla o celular anotado. Frases cortas, como apuntes.',
      portada: {
        titulo: { max: 28, desc: 'promesa corta en dos renglones, termina en punto (p. ej. «Tu banco de ganchos con IA.»)' },
        texto: { max: 110, desc: 'dos frases que dicen qué problema resuelve; UNA palabra *resaltada* (p. ej. «Deja de quedarte en blanco antes de grabar. Con este sistema *no* vuelves a empezar de cero.»)' },
        lista: { lista: 4, desc: '4 cosas que va a aprender, como pasos', campos: { t: { max: 30, desc: 'paso corto (p. ej. «Saca sus ganchos»)' }, icono: { max: 20, desc: 'ícono de la lista' } } },
      },
      item: {
        forma: { max: 8, desc: 'una de: banco (óvalos con las palabras), guion (flujo de 4 cajas), tabla (tabla de 2 columnas), celular (tu foto en un celular dibujado con 3 anotaciones). Que no se repitan seguidas' },
        titulo: { max: 26, desc: 'título del paso en dos renglones cortos (p. ej. «Guion en 5 minutos»)' },
        icono: { max: 20, desc: 'ícono que acompaña el título' },
        texto: { max: 70, desc: 'una frase que explica el paso (p. ej. «Todo el guion lo hace la IA, con tu tono.»)' },
        prompt: { max: 190, desc: 'lo que se copia TAL CUAL: un prompt entre comillas con [CORCHETES] donde va lo de cada uno. En la forma celular: la frase corta que sale en la pantalla, máximo 50 letras' },
        puntos: { lista: 4, desc: '4 puntos: las palabras de los óvalos, las cajas del flujo, las filas de la tabla o las anotaciones del celular', campos: { t: { max: 14, desc: 'palabra o dos (p. ej. «Gancho», «Mira a la cámara»)' }, d: { max: 24, desc: 'solo para la tabla: lo que explica ese punto (p. ej. «da curiosidad»)' } } },
        nota: { max: 56, desc: 'nota a mano al final, con lo clave *resaltado* (p. ej. «Lo lees una vez y *grabas*.»)' },
      },
      cierre: {
        titulo: { max: 14, desc: 'orden corta de cierre (p. ej. «Guarda esto.»)' },
        texto: { max: 70, desc: 'una frase con lo que gana, con UNA parte *resaltada* (p. ej. «Configúralo *una vez* y ten ideas para toda la semana.»)' },
        pasos: { lista: 4, desc: 'el sistema en 4 pasos de UNA palabra', campos: { t: { max: 9, desc: 'una palabra (p. ej. «Idea», «Grabas»)' }, icono: { max: 20, desc: 'ícono de la lista' } } },
        llamado: { max: 110, desc: 'invita a guardar y comentar, con la pregunta *resaltada* (p. ej. «Guárdalo para cuando te quedes en blanco. *¿Cuál prompt pruebas primero?* Cuéntame en los comentarios.»)' },
      },
      comun: {
        desliza: { max: 10, desc: 'palabra para pasar de lámina (p. ej. «Desliza»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1350, o = c.opciones || {};
      var fo = FONDOS[o.fondo] ? o.fondo : 'granito', li = LIBRETAS[o.libreta] ? o.libreta : 'espiral';
      var sube = H >= 1440 ? 0 : -60;                     // en 1350 todo sube 60 px y se aprieta un poco
      var X0 = 175, Y0 = 290 + sube, Y1 = H - 40, k = (Y1 - Y0) / 1110;
      function Y(d) { return Math.round(Y0 + d * k); }
      var fotos = (mat && mat.fotos) || [], usadas = [], semilla = 7, comun = c.comun || {};
      var ESTILO = {
        T: { fuente: '@titular', peso: 700, mayus: true, interl: .98, espac: .005 },
        t: { fuente: '@cuerpo', peso: 400, interl: 1.18 },
        f: { fuente: '@mano', peso: 300, interl: 1.2 },
      };
      function tx(nombre, papel, txt, cl, tam, x, y, w, extra) {
        var e = { nombre: nombre, papel: papel, txt: txt || '', tam: tam, x: x, y: y, w: w || 'auto', color: '@principal', colorAc: '@principal', modoAc: 'negrita', z: 6 };
        var s = ESTILO[cl]; for (var q in s) e[q] = s[q];
        if (extra) for (var q2 in extra) e[q2] = extra[q2];
        return T(e);
      }
      function tr(nombre, papel, forma, x, y, w, h, extra) {
        var e = { id: nid(), tipo: 'trazo', nombre: nombre, papel: papel, forma: forma, color: '@principal', semilla: semilla++, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), z: 5, rot: 0, op: 1 };
        if (extra) for (var q in extra) e[q] = extra[q];
        return e;
      }
      function papel() {
        var F = FONDOS[fo], L = LIBRETAS[li];
        var fondo = F.foto
          ? { x: 0, y: sube, w: W, h: 1629 }              // la foto de madera: la libreta de espiral queda justo encima de la suya
          : { x: 0, y: 0, w: W, h: H };
        return [
          { id: nid(), tipo: 'imagen', nombre: 'Mesa (fondo)', papel: 'mesa', src: F.src, x: fondo.x, y: fondo.y, w: fondo.w, h: fondo.h, z: 0, rot: 0, op: 1, radio: 0, zoom: 1, brillo: 1, contraste: 1, sat: .9, bloqueado: true },
          { id: nid(), tipo: 'imagen', calco: true, nombre: 'Libreta', papel: 'libreta', src: L.src, x: L.x, y: L.y + sube, w: L.w, h: L.h, z: 1, rot: L.rot, op: 1, bloqueado: true },
        ];
      }
      var laminas = [portada()];
      var FORMAS = ['banco', 'guion', 'tabla', 'celular'], previa = null;
      (c.items || []).forEach(function (it, i) {
        var f = FORMAS.indexOf(it.forma) >= 0 ? it.forma : FORMAS[i % 4];
        if (f === previa) f = FORMAS[(FORMAS.indexOf(f) + 1) % 4];
        previa = f;
        laminas.push(({ banco: banco, guion: guion, tabla: tabla, celular: celular })[f](it, i + 1));
      });
      laminas.push(cierre());
      return laminas;

      function portada() {
        var els = papel(), p = c.portada || {};
        els.push(tx('Titular', 'titular', p.titulo, 'T', 92, X0, Y(30), 780));
        els.push(tx('Texto', 'texto', p.texto, 't', 40, X0, Y(280), 760));
        (p.lista || []).slice(0, 4).forEach(function (e, i) {
          els.push(tr('Chulo', 'chulo', 'chulo', X0, Y(520 + i * 92), 44, 44));
          els.push(tx('Paso ' + (i + 1), 'lista', e.t, 'T', 34, X0 + 64, Y(516 + i * 92)));
          els.push(tr('Ícono', 'icono', 'icono', X0 + 700, Y(512 + i * 92), 52, 52, { icono: e.icono || 'sparkles' }));
        });
        els.push(tx('«Desliza»', 'desliza', comun.desliza || 'Desliza', 'T', 44, X0 + 10, Y1 - 150));
        els.push(tr('Flecha', 'flecha', 'flecha', X0 + 200, Y1 - 140, 110, 40));
        return { fondo: '#2a2622', els: els };
      }
      function banco(it) {
        var els = papel();
        els.push(tx('Titular', 'titular', it.titulo, 'T', 88, X0, Y(20), 660));
        els.push(tr('Ícono', 'icono', 'icono', X0 + 690, Y(20), 76, 76, { icono: it.icono || 'sparkles' }));
        els.push(tx('Texto', 'texto', it.texto, 't', 38, X0, Y(230), 760));
        els.push(tr('Recuadro doble', 'recuadro', 'caja2', X0, Y(350), 770, 340));
        els.push(tx('Para copiar', 'prompt', it.prompt, 't', 36, X0 + 36, Y(376), 700));
        // óvalos en dos filas como máximo: si las palabras son largas, se achican
        var pts = (it.puntos || []).filter(function (p) { return p && p.t; }).slice(0, 5), esc = 1, pos;
        function acomodar(e) {
          var cx = 0, fila = 0, r = [];
          pts.forEach(function (p) { var w = Math.round((String(p.t).length * 22 + 60) * e); if (cx + w > 770 && cx > 0) { fila++; cx = 60 * fila; } r.push([cx, fila, w]); cx += w + 24 * e; });
          return { r: r, filas: fila + 1 };
        }
        while ((pos = acomodar(esc)).filas > 2 && esc > .6) esc -= .08;
        pts.forEach(function (p, i) {
          var a = pos.r[i], y = Y(730) + a[1] * Math.round(100 * esc), h = Math.round(76 * esc);
          els.push(tr('Óvalo', 'ovalo', 'ovalo', X0 + a[0], y, a[2], h));
          els.push(tx('Palabra ' + (i + 1), 'palabra', p.t, 'T', Math.round(32 * esc), X0 + a[0], y + Math.round(18 * esc), a[2], { alin: 'center' }));
        });
        els.push(tx('Nota a mano', 'nota', it.nota, 'f', 42, X0, Y(960), 760));
        return { fondo: '#2a2622', els: els };
      }
      function guion(it) {
        var els = papel();
        els.push(tx('Titular', 'titular', it.titulo, 'T', 96, X0, Y(20), 620));
        els.push(tr('Ícono', 'icono', 'icono', X0 + 660, Y(40), 90, 90, { icono: it.icono || 'sparkles' }));
        els.push(tx('Texto', 'texto', it.texto, 't', 38, X0, Y(250), 760));
        els.push(tr('Recuadro doble', 'recuadro', 'caja2', X0, Y(330), 470, 560));
        els.push(tx('Para copiar', 'prompt', it.prompt, 't', 32, X0 + 30, Y(356), 420));
        var pts = (it.puntos || []).slice(0, 4);
        pts.forEach(function (p, i) {
          els.push(tr('Caja del flujo', 'caja', 'caja', X0 + 530, Y(340 + i * 140), 240, 90));
          els.push(tx('Paso ' + (i + 1), 'paso', p.t, 'T', 28, X0 + 530, Y(340 + i * 140) + 28, 240, { alin: 'center' }));
          if (i < pts.length - 1) els.push(tr('Flecha abajo', 'flecha-abajo', 'abajo', X0 + 635, Y(432 + i * 140), 30, 48));
        });
        els.push(tr('Flecha', 'flecha', 'flecha', X0 + 478, Y(590), 50, 34));
        els.push(tx('Nota a mano', 'nota', it.nota, 'f', 42, X0, Y(960), 760));
        return { fondo: '#2a2622', els: els };
      }
      function tabla(it) {
        var els = papel(), t = String(it.titulo || '');
        els.push(tr('Recuadro del título', 'recuadro-titulo', 'caja', X0, Y(20), Math.min(770, t.length * 25 + 70), 80));
        els.push(tx('Titular', 'titular-caja', t, 'T', 44, X0 + 30, Y(20) + 14));
        els.push(tr('Recuadro doble', 'recuadro', 'caja2', X0, Y(140), 770, 360));
        els.push(tx('Para copiar', 'prompt', it.prompt, 't', 38, X0 + 36, Y(170), 700));
        var pts = (it.puntos || []).slice(0, 4), fh = 80;
        els.push(tr('Tabla', 'tabla', 'tabla', X0, Y(560), 770, fh * pts.length, { cols: [.4], filas: pts.length }));
        pts.forEach(function (p, j) {
          els.push(tx('Fila ' + (j + 1), 'fila', p.t, 'T', 30, X0 + 20, Y(560) + j * fh + 22, 280));
          els.push(tx('Explicación ' + (j + 1), 'fila-texto', p.d, 't', 32, X0 + 328, Y(560) + j * fh + 20, 430));
        });
        els.push(tx('Nota a mano', 'nota', it.nota, 'f', 40, X0, Y(950), 760));
        return { fondo: '#2a2622', els: els };
      }
      function celular(it) {
        var els = papel(), f = U.mejorFoto(fotos, usadas); if (f) usadas.push(f.id);
        els.push(tx('Titular', 'titular', it.titulo, 'T', 92, X0, Y(10), 780));
        els.push(tr('Celular dibujado', 'celular', 'celular', X0 + 150, Y(240), 420, 720, { z: 4 }));
        if (f) els.push(U.fotoEl(f, { x: X0 + 172, y: Y(290), w: 376, h: Math.round(620 * k) }, { radio: 30, z: 2, sat: .85, contraste: 1.05 }));
        els.push(tx('Texto en la pantalla', 'pantalla', it.prompt, 'T', 30, X0 + 185, Y(320), 350, f ? { alin: 'center', caja: { fondo: 'rgba(240,248,250,.85)', radio: 6, padV: 6, padH: 8 } } : { alin: 'center' }));
        var pts = it.puntos || [];
        var A = [[X0 + 600, 290, 190, X0 + 540, 400, 180], [X0 - 12, 560, 150, X0 + 130, 610, 0], [X0 + 610, 700, 180, X0 + 545, 740, 180]];
        A.forEach(function (a, i) {
          if (!pts[i] || !pts[i].t) return;
          els.push(tx('Anotación ' + (i + 1), 'anotacion', pts[i].t, 'f', 36, a[0], Y(a[1]), a[2]));
          els.push(tr('Flecha', 'flecha', 'flecha', a[3], Y(a[4]), 70, 30, { rot: a[5] }));
        });
        els.push(tx('Nota a mano', 'nota', it.nota, 'f', 40, X0, Y(990), 760));
        return { fondo: '#2a2622', els: els };
      }
      function cierre() {
        var els = papel(), p = c.cierre || {};
        els.push(tx('Titular', 'titular-cierre', p.titulo, 'T', 112, X0, Y(40), 800));
        els.push(tx('Texto', 'texto', p.texto, 't', 42, X0, Y(210), 740));
        var ps = (p.pasos || []).slice(0, 4);
        ps.forEach(function (e, i) {
          els.push(tr('Caja del paso', 'caja', 'caja', X0 + i * 196, Y(400), 160, 170));
          els.push(tr('Ícono', 'icono', 'icono', X0 + 50 + i * 196, Y(420), 60, 60, { icono: e.icono || 'sparkles' }));
          els.push(tx('Paso ' + (i + 1), 'paso', e.t, 'T', 28, X0 + i * 196, Y(500), 160, { alin: 'center' }));
          if (i < ps.length - 1) els.push(tr('Flecha', 'flecha', 'flecha', X0 + 162 + i * 196, Y(470), 32, 26));
        });
        els.push(tr('Recuadro doble', 'recuadro', 'caja2', X0, Y(680), 770, 300));
        els.push(tr('Flecha', 'flecha', 'flecha', X0 + 30, Y(730), 70, 30));
        els.push(tx('Llamado', 'llamado', p.llamado, 't', 38, X0 + 116, Y(712), 610));
        return { fondo: '#2a2622', els: els };
      }
    },
  });
})();

/* rough.js 4.6.6 — dibujo a mano (MIT, © Preet Shihn, https://roughjs.com). Copia del bundle de jsDelivr, sin cambios. */
(function () {
var rough=function(){"use strict";function t(t,e,s){if(t&&t.length){const[n,o]=e,a=Math.PI/180*s,h=Math.cos(a),r=Math.sin(a);for(const e of t){const[t,s]=e;e[0]=(t-n)*h-(s-o)*r+n,e[1]=(t-n)*r+(s-o)*h+o}}}function e(t,e){return t[0]===e[0]&&t[1]===e[1]}function s(s,n,o,a=1){const h=o,r=Math.max(n,.1),i=s[0]&&s[0][0]&&"number"==typeof s[0][0]?[s]:s,c=[0,0];if(h)for(const e of i)t(e,c,h);const l=function(t,s,n){const o=[];for(const s of t){const t=[...s];e(t[0],t[t.length-1])||t.push([t[0][0],t[0][1]]),t.length>2&&o.push(t)}const a=[];s=Math.max(s,.1);const h=[];for(const t of o)for(let e=0;e<t.length-1;e++){const s=t[e],n=t[e+1];if(s[1]!==n[1]){const t=Math.min(s[1],n[1]);h.push({ymin:t,ymax:Math.max(s[1],n[1]),x:t===s[1]?s[0]:n[0],islope:(n[0]-s[0])/(n[1]-s[1])})}}if(h.sort(((t,e)=>t.ymin<e.ymin?-1:t.ymin>e.ymin?1:t.x<e.x?-1:t.x>e.x?1:t.ymax===e.ymax?0:(t.ymax-e.ymax)/Math.abs(t.ymax-e.ymax))),!h.length)return a;let r=[],i=h[0].ymin,c=0;for(;r.length||h.length;){if(h.length){let t=-1;for(let e=0;e<h.length&&!(h[e].ymin>i);e++)t=e;h.splice(0,t+1).forEach((t=>{r.push({s:i,edge:t})}))}if(r=r.filter((t=>!(t.edge.ymax<=i))),r.sort(((t,e)=>t.edge.x===e.edge.x?0:(t.edge.x-e.edge.x)/Math.abs(t.edge.x-e.edge.x))),(1!==n||c%s==0)&&r.length>1)for(let t=0;t<r.length;t+=2){const e=t+1;if(e>=r.length)break;const s=r[t].edge,n=r[e].edge;a.push([[Math.round(s.x),i],[Math.round(n.x),i]])}i+=n,r.forEach((t=>{t.edge.x=t.edge.x+n*t.edge.islope})),c++}return a}(i,r,a);if(h){for(const e of i)t(e,c,-h);!function(e,s,n){const o=[];e.forEach((t=>o.push(...t))),t(o,s,n)}(l,c,-h)}return l}function n(t,e){var n;const o=e.hachureAngle+90;let a=e.hachureGap;a<0&&(a=4*e.strokeWidth),a=Math.round(Math.max(a,.1));let h=1;return e.roughness>=1&&((null===(n=e.randomizer)||void 0===n?void 0:n.next())||Math.random())>.7&&(h=a),s(t,a,o,h||1)}class o{constructor(t){this.helper=t}fillPolygons(t,e){return this._fillPolygons(t,e)}_fillPolygons(t,e){const s=n(t,e);return{type:"fillSketch",ops:this.renderLines(s,e)}}renderLines(t,e){const s=[];for(const n of t)s.push(...this.helper.doubleLineOps(n[0][0],n[0][1],n[1][0],n[1][1],e));return s}}function a(t){const e=t[0],s=t[1];return Math.sqrt(Math.pow(e[0]-s[0],2)+Math.pow(e[1]-s[1],2))}class h extends o{fillPolygons(t,e){let s=e.hachureGap;s<0&&(s=4*e.strokeWidth),s=Math.max(s,.1);const o=n(t,Object.assign({},e,{hachureGap:s})),h=Math.PI/180*e.hachureAngle,r=[],i=.5*s*Math.cos(h),c=.5*s*Math.sin(h);for(const[t,e]of o)a([t,e])&&r.push([[t[0]-i,t[1]+c],[...e]],[[t[0]+i,t[1]-c],[...e]]);return{type:"fillSketch",ops:this.renderLines(r,e)}}}class r extends o{fillPolygons(t,e){const s=this._fillPolygons(t,e),n=Object.assign({},e,{hachureAngle:e.hachureAngle+90}),o=this._fillPolygons(t,n);return s.ops=s.ops.concat(o.ops),s}}class i{constructor(t){this.helper=t}fillPolygons(t,e){const s=n(t,e=Object.assign({},e,{hachureAngle:0}));return this.dotsOnLines(s,e)}dotsOnLines(t,e){const s=[];let n=e.hachureGap;n<0&&(n=4*e.strokeWidth),n=Math.max(n,.1);let o=e.fillWeight;o<0&&(o=e.strokeWidth/2);const h=n/4;for(const r of t){const t=a(r),i=t/n,c=Math.ceil(i)-1,l=t-c*n,u=(r[0][0]+r[1][0])/2-n/4,p=Math.min(r[0][1],r[1][1]);for(let t=0;t<c;t++){const a=p+l+t*n,r=u-h+2*Math.random()*h,i=a-h+2*Math.random()*h,c=this.helper.ellipse(r,i,o,o,e);s.push(...c.ops)}}return{type:"fillSketch",ops:s}}}class c{constructor(t){this.helper=t}fillPolygons(t,e){const s=n(t,e);return{type:"fillSketch",ops:this.dashedLine(s,e)}}dashedLine(t,e){const s=e.dashOffset<0?e.hachureGap<0?4*e.strokeWidth:e.hachureGap:e.dashOffset,n=e.dashGap<0?e.hachureGap<0?4*e.strokeWidth:e.hachureGap:e.dashGap,o=[];return t.forEach((t=>{const h=a(t),r=Math.floor(h/(s+n)),i=(h+n-r*(s+n))/2;let c=t[0],l=t[1];c[0]>l[0]&&(c=t[1],l=t[0]);const u=Math.atan((l[1]-c[1])/(l[0]-c[0]));for(let t=0;t<r;t++){const a=t*(s+n),h=a+s,r=[c[0]+a*Math.cos(u)+i*Math.cos(u),c[1]+a*Math.sin(u)+i*Math.sin(u)],l=[c[0]+h*Math.cos(u)+i*Math.cos(u),c[1]+h*Math.sin(u)+i*Math.sin(u)];o.push(...this.helper.doubleLineOps(r[0],r[1],l[0],l[1],e))}})),o}}class l{constructor(t){this.helper=t}fillPolygons(t,e){const s=e.hachureGap<0?4*e.strokeWidth:e.hachureGap,o=e.zigzagOffset<0?s:e.zigzagOffset,a=n(t,e=Object.assign({},e,{hachureGap:s+o}));return{type:"fillSketch",ops:this.zigzagLines(a,o,e)}}zigzagLines(t,e,s){const n=[];return t.forEach((t=>{const o=a(t),h=Math.round(o/(2*e));let r=t[0],i=t[1];r[0]>i[0]&&(r=t[1],i=t[0]);const c=Math.atan((i[1]-r[1])/(i[0]-r[0]));for(let t=0;t<h;t++){const o=2*t*e,a=2*(t+1)*e,h=Math.sqrt(2*Math.pow(e,2)),i=[r[0]+o*Math.cos(c),r[1]+o*Math.sin(c)],l=[r[0]+a*Math.cos(c),r[1]+a*Math.sin(c)],u=[i[0]+h*Math.cos(c+Math.PI/4),i[1]+h*Math.sin(c+Math.PI/4)];n.push(...this.helper.doubleLineOps(i[0],i[1],u[0],u[1],s),...this.helper.doubleLineOps(u[0],u[1],l[0],l[1],s))}})),n}}const u={};class p{constructor(t){this.seed=t}next(){return this.seed?(2**31-1&(this.seed=Math.imul(48271,this.seed)))/2**31:Math.random()}}const f=0,d=1,g=2,M={A:7,a:7,C:6,c:6,H:1,h:1,L:2,l:2,M:2,m:2,Q:4,q:4,S:4,s:4,T:2,t:2,V:1,v:1,Z:0,z:0};function k(t,e){return t.type===e}function b(t){const e=[],s=function(t){const e=new Array;for(;""!==t;)if(t.match(/^([ \t\r\n,]+)/))t=t.substr(RegExp.$1.length);else if(t.match(/^([aAcChHlLmMqQsStTvVzZ])/))e[e.length]={type:f,text:RegExp.$1},t=t.substr(RegExp.$1.length);else{if(!t.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/))return[];e[e.length]={type:d,text:`${parseFloat(RegExp.$1)}`},t=t.substr(RegExp.$1.length)}return e[e.length]={type:g,text:""},e}(t);let n="BOD",o=0,a=s[o];for(;!k(a,g);){let h=0;const r=[];if("BOD"===n){if("M"!==a.text&&"m"!==a.text)return b("M0,0"+t);o++,h=M[a.text],n=a.text}else k(a,d)?h=M[n]:(o++,h=M[a.text],n=a.text);if(!(o+h<s.length))throw new Error("Path data ended short");for(let t=o;t<o+h;t++){const e=s[t];if(!k(e,d))throw new Error("Param not a number: "+n+","+e.text);r[r.length]=+e.text}if("number"!=typeof M[n])throw new Error("Bad segment: "+n);{const t={key:n,data:r};e.push(t),o+=h,a=s[o],"M"===n&&(n="L"),"m"===n&&(n="l")}}return e}function y(t){let e=0,s=0,n=0,o=0;const a=[];for(const{key:h,data:r}of t)switch(h){case"M":a.push({key:"M",data:[...r]}),[e,s]=r,[n,o]=r;break;case"m":e+=r[0],s+=r[1],a.push({key:"M",data:[e,s]}),n=e,o=s;break;case"L":a.push({key:"L",data:[...r]}),[e,s]=r;break;case"l":e+=r[0],s+=r[1],a.push({key:"L",data:[e,s]});break;case"C":a.push({key:"C",data:[...r]}),e=r[4],s=r[5];break;case"c":{const t=r.map(((t,n)=>n%2?t+s:t+e));a.push({key:"C",data:t}),e=t[4],s=t[5];break}case"Q":a.push({key:"Q",data:[...r]}),e=r[2],s=r[3];break;case"q":{const t=r.map(((t,n)=>n%2?t+s:t+e));a.push({key:"Q",data:t}),e=t[2],s=t[3];break}case"A":a.push({key:"A",data:[...r]}),e=r[5],s=r[6];break;case"a":e+=r[5],s+=r[6],a.push({key:"A",data:[r[0],r[1],r[2],r[3],r[4],e,s]});break;case"H":a.push({key:"H",data:[...r]}),e=r[0];break;case"h":e+=r[0],a.push({key:"H",data:[e]});break;case"V":a.push({key:"V",data:[...r]}),s=r[0];break;case"v":s+=r[0],a.push({key:"V",data:[s]});break;case"S":a.push({key:"S",data:[...r]}),e=r[2],s=r[3];break;case"s":{const t=r.map(((t,n)=>n%2?t+s:t+e));a.push({key:"S",data:t}),e=t[2],s=t[3];break}case"T":a.push({key:"T",data:[...r]}),e=r[0],s=r[1];break;case"t":e+=r[0],s+=r[1],a.push({key:"T",data:[e,s]});break;case"Z":case"z":a.push({key:"Z",data:[]}),e=n,s=o}return a}function m(t){const e=[];let s="",n=0,o=0,a=0,h=0,r=0,i=0;for(const{key:c,data:l}of t){switch(c){case"M":e.push({key:"M",data:[...l]}),[n,o]=l,[a,h]=l;break;case"C":e.push({key:"C",data:[...l]}),n=l[4],o=l[5],r=l[2],i=l[3];break;case"L":e.push({key:"L",data:[...l]}),[n,o]=l;break;case"H":n=l[0],e.push({key:"L",data:[n,o]});break;case"V":o=l[0],e.push({key:"L",data:[n,o]});break;case"S":{let t=0,a=0;"C"===s||"S"===s?(t=n+(n-r),a=o+(o-i)):(t=n,a=o),e.push({key:"C",data:[t,a,...l]}),r=l[0],i=l[1],n=l[2],o=l[3];break}case"T":{const[t,a]=l;let h=0,c=0;"Q"===s||"T"===s?(h=n+(n-r),c=o+(o-i)):(h=n,c=o);const u=n+2*(h-n)/3,p=o+2*(c-o)/3,f=t+2*(h-t)/3,d=a+2*(c-a)/3;e.push({key:"C",data:[u,p,f,d,t,a]}),r=h,i=c,n=t,o=a;break}case"Q":{const[t,s,a,h]=l,c=n+2*(t-n)/3,u=o+2*(s-o)/3,p=a+2*(t-a)/3,f=h+2*(s-h)/3;e.push({key:"C",data:[c,u,p,f,a,h]}),r=t,i=s,n=a,o=h;break}case"A":{const t=Math.abs(l[0]),s=Math.abs(l[1]),a=l[2],h=l[3],r=l[4],i=l[5],c=l[6];if(0===t||0===s)e.push({key:"C",data:[n,o,i,c,i,c]}),n=i,o=c;else if(n!==i||o!==c){x(n,o,i,c,t,s,a,h,r).forEach((function(t){e.push({key:"C",data:t})})),n=i,o=c}break}case"Z":e.push({key:"Z",data:[]}),n=a,o=h}s=c}return e}function w(t,e,s){return[t*Math.cos(s)-e*Math.sin(s),t*Math.sin(s)+e*Math.cos(s)]}function x(t,e,s,n,o,a,h,r,i,c){const l=(u=h,Math.PI*u/180);var u;let p=[],f=0,d=0,g=0,M=0;if(c)[f,d,g,M]=c;else{[t,e]=w(t,e,-l),[s,n]=w(s,n,-l);const h=(t-s)/2,c=(e-n)/2;let u=h*h/(o*o)+c*c/(a*a);u>1&&(u=Math.sqrt(u),o*=u,a*=u);const p=o*o,k=a*a,b=p*k-p*c*c-k*h*h,y=p*c*c+k*h*h,m=(r===i?-1:1)*Math.sqrt(Math.abs(b/y));g=m*o*c/a+(t+s)/2,M=m*-a*h/o+(e+n)/2,f=Math.asin(parseFloat(((e-M)/a).toFixed(9))),d=Math.asin(parseFloat(((n-M)/a).toFixed(9))),t<g&&(f=Math.PI-f),s<g&&(d=Math.PI-d),f<0&&(f=2*Math.PI+f),d<0&&(d=2*Math.PI+d),i&&f>d&&(f-=2*Math.PI),!i&&d>f&&(d-=2*Math.PI)}let k=d-f;if(Math.abs(k)>120*Math.PI/180){const t=d,e=s,r=n;d=i&&d>f?f+120*Math.PI/180*1:f+120*Math.PI/180*-1,p=x(s=g+o*Math.cos(d),n=M+a*Math.sin(d),e,r,o,a,h,0,i,[d,t,g,M])}k=d-f;const b=Math.cos(f),y=Math.sin(f),m=Math.cos(d),P=Math.sin(d),v=Math.tan(k/4),S=4/3*o*v,O=4/3*a*v,L=[t,e],T=[t+S*y,e-O*b],D=[s+S*P,n-O*m],A=[s,n];if(T[0]=2*L[0]-T[0],T[1]=2*L[1]-T[1],c)return[T,D,A].concat(p);{p=[T,D,A].concat(p);const t=[];for(let e=0;e<p.length;e+=3){const s=w(p[e][0],p[e][1],l),n=w(p[e+1][0],p[e+1][1],l),o=w(p[e+2][0],p[e+2][1],l);t.push([s[0],s[1],n[0],n[1],o[0],o[1]])}return t}}const P={randOffset:function(t,e){return G(t,e)},randOffsetWithRange:function(t,e,s){return E(t,e,s)},ellipse:function(t,e,s,n,o){const a=T(s,n,o);return D(t,e,o,a).opset},doubleLineOps:function(t,e,s,n,o){return $(t,e,s,n,o,!0)}};function v(t,e,s,n,o){return{type:"path",ops:$(t,e,s,n,o)}}function S(t,e,s){const n=(t||[]).length;if(n>2){const o=[];for(let e=0;e<n-1;e++)o.push(...$(t[e][0],t[e][1],t[e+1][0],t[e+1][1],s));return e&&o.push(...$(t[n-1][0],t[n-1][1],t[0][0],t[0][1],s)),{type:"path",ops:o}}return 2===n?v(t[0][0],t[0][1],t[1][0],t[1][1],s):{type:"path",ops:[]}}function O(t,e,s,n,o){return function(t,e){return S(t,!0,e)}([[t,e],[t+s,e],[t+s,e+n],[t,e+n]],o)}function L(t,e){if(t.length){const s="number"==typeof t[0][0]?[t]:t,n=j(s[0],1*(1+.2*e.roughness),e),o=e.disableMultiStroke?[]:j(s[0],1.5*(1+.22*e.roughness),z(e));for(let t=1;t<s.length;t++){const a=s[t];if(a.length){const t=j(a,1*(1+.2*e.roughness),e),s=e.disableMultiStroke?[]:j(a,1.5*(1+.22*e.roughness),z(e));for(const e of t)"move"!==e.op&&n.push(e);for(const t of s)"move"!==t.op&&o.push(t)}}return{type:"path",ops:n.concat(o)}}return{type:"path",ops:[]}}function T(t,e,s){const n=Math.sqrt(2*Math.PI*Math.sqrt((Math.pow(t/2,2)+Math.pow(e/2,2))/2)),o=Math.ceil(Math.max(s.curveStepCount,s.curveStepCount/Math.sqrt(200)*n)),a=2*Math.PI/o;let h=Math.abs(t/2),r=Math.abs(e/2);const i=1-s.curveFitting;return h+=G(h*i,s),r+=G(r*i,s),{increment:a,rx:h,ry:r}}function D(t,e,s,n){const[o,a]=F(n.increment,t,e,n.rx,n.ry,1,n.increment*E(.1,E(.4,1,s),s),s);let h=q(o,null,s);if(!s.disableMultiStroke&&0!==s.roughness){const[o]=F(n.increment,t,e,n.rx,n.ry,1.5,0,s),a=q(o,null,s);h=h.concat(a)}return{estimatedPoints:a,opset:{type:"path",ops:h}}}function A(t,e,s,n,o,a,h,r,i){const c=t,l=e;let u=Math.abs(s/2),p=Math.abs(n/2);u+=G(.01*u,i),p+=G(.01*p,i);let f=o,d=a;for(;f<0;)f+=2*Math.PI,d+=2*Math.PI;d-f>2*Math.PI&&(f=0,d=2*Math.PI);const g=2*Math.PI/i.curveStepCount,M=Math.min(g/2,(d-f)/2),k=V(M,c,l,u,p,f,d,1,i);if(!i.disableMultiStroke){const t=V(M,c,l,u,p,f,d,1.5,i);k.push(...t)}return h&&(r?k.push(...$(c,l,c+u*Math.cos(f),l+p*Math.sin(f),i),...$(c,l,c+u*Math.cos(d),l+p*Math.sin(d),i)):k.push({op:"lineTo",data:[c,l]},{op:"lineTo",data:[c+u*Math.cos(f),l+p*Math.sin(f)]})),{type:"path",ops:k}}function _(t,e){const s=m(y(b(t))),n=[];let o=[0,0],a=[0,0];for(const{key:t,data:h}of s)switch(t){case"M":a=[h[0],h[1]],o=[h[0],h[1]];break;case"L":n.push(...$(a[0],a[1],h[0],h[1],e)),a=[h[0],h[1]];break;case"C":{const[t,s,o,r,i,c]=h;n.push(...Z(t,s,o,r,i,c,a,e)),a=[i,c];break}case"Z":n.push(...$(a[0],a[1],o[0],o[1],e)),a=[o[0],o[1]]}return{type:"path",ops:n}}function I(t,e){const s=[];for(const n of t)if(n.length){const t=e.maxRandomnessOffset||0,o=n.length;if(o>2){s.push({op:"move",data:[n[0][0]+G(t,e),n[0][1]+G(t,e)]});for(let a=1;a<o;a++)s.push({op:"lineTo",data:[n[a][0]+G(t,e),n[a][1]+G(t,e)]})}}return{type:"fillPath",ops:s}}function C(t,e){return function(t,e){let s=t.fillStyle||"hachure";if(!u[s])switch(s){case"zigzag":u[s]||(u[s]=new h(e));break;case"cross-hatch":u[s]||(u[s]=new r(e));break;case"dots":u[s]||(u[s]=new i(e));break;case"dashed":u[s]||(u[s]=new c(e));break;case"zigzag-line":u[s]||(u[s]=new l(e));break;default:s="hachure",u[s]||(u[s]=new o(e))}return u[s]}(e,P).fillPolygons(t,e)}function z(t){const e=Object.assign({},t);return e.randomizer=void 0,t.seed&&(e.seed=t.seed+1),e}function W(t){return t.randomizer||(t.randomizer=new p(t.seed||0)),t.randomizer.next()}function E(t,e,s,n=1){return s.roughness*n*(W(s)*(e-t)+t)}function G(t,e,s=1){return E(-t,t,e,s)}function $(t,e,s,n,o,a=!1){const h=a?o.disableMultiStrokeFill:o.disableMultiStroke,r=R(t,e,s,n,o,!0,!1);if(h)return r;const i=R(t,e,s,n,o,!0,!0);return r.concat(i)}function R(t,e,s,n,o,a,h){const r=Math.pow(t-s,2)+Math.pow(e-n,2),i=Math.sqrt(r);let c=1;c=i<200?1:i>500?.4:-.0016668*i+1.233334;let l=o.maxRandomnessOffset||0;l*l*100>r&&(l=i/10);const u=l/2,p=.2+.2*W(o);let f=o.bowing*o.maxRandomnessOffset*(n-e)/200,d=o.bowing*o.maxRandomnessOffset*(t-s)/200;f=G(f,o,c),d=G(d,o,c);const g=[],M=()=>G(u,o,c),k=()=>G(l,o,c),b=o.preserveVertices;return a&&(h?g.push({op:"move",data:[t+(b?0:M()),e+(b?0:M())]}):g.push({op:"move",data:[t+(b?0:G(l,o,c)),e+(b?0:G(l,o,c))]})),h?g.push({op:"bcurveTo",data:[f+t+(s-t)*p+M(),d+e+(n-e)*p+M(),f+t+2*(s-t)*p+M(),d+e+2*(n-e)*p+M(),s+(b?0:M()),n+(b?0:M())]}):g.push({op:"bcurveTo",data:[f+t+(s-t)*p+k(),d+e+(n-e)*p+k(),f+t+2*(s-t)*p+k(),d+e+2*(n-e)*p+k(),s+(b?0:k()),n+(b?0:k())]}),g}function j(t,e,s){if(!t.length)return[];const n=[];n.push([t[0][0]+G(e,s),t[0][1]+G(e,s)]),n.push([t[0][0]+G(e,s),t[0][1]+G(e,s)]);for(let o=1;o<t.length;o++)n.push([t[o][0]+G(e,s),t[o][1]+G(e,s)]),o===t.length-1&&n.push([t[o][0]+G(e,s),t[o][1]+G(e,s)]);return q(n,null,s)}function q(t,e,s){const n=t.length,o=[];if(n>3){const a=[],h=1-s.curveTightness;o.push({op:"move",data:[t[1][0],t[1][1]]});for(let e=1;e+2<n;e++){const s=t[e];a[0]=[s[0],s[1]],a[1]=[s[0]+(h*t[e+1][0]-h*t[e-1][0])/6,s[1]+(h*t[e+1][1]-h*t[e-1][1])/6],a[2]=[t[e+1][0]+(h*t[e][0]-h*t[e+2][0])/6,t[e+1][1]+(h*t[e][1]-h*t[e+2][1])/6],a[3]=[t[e+1][0],t[e+1][1]],o.push({op:"bcurveTo",data:[a[1][0],a[1][1],a[2][0],a[2][1],a[3][0],a[3][1]]})}if(e&&2===e.length){const t=s.maxRandomnessOffset;o.push({op:"lineTo",data:[e[0]+G(t,s),e[1]+G(t,s)]})}}else 3===n?(o.push({op:"move",data:[t[1][0],t[1][1]]}),o.push({op:"bcurveTo",data:[t[1][0],t[1][1],t[2][0],t[2][1],t[2][0],t[2][1]]})):2===n&&o.push(...R(t[0][0],t[0][1],t[1][0],t[1][1],s,!0,!0));return o}function F(t,e,s,n,o,a,h,r){const i=[],c=[];if(0===r.roughness){t/=4,c.push([e+n*Math.cos(-t),s+o*Math.sin(-t)]);for(let a=0;a<=2*Math.PI;a+=t){const t=[e+n*Math.cos(a),s+o*Math.sin(a)];i.push(t),c.push(t)}c.push([e+n*Math.cos(0),s+o*Math.sin(0)]),c.push([e+n*Math.cos(t),s+o*Math.sin(t)])}else{const l=G(.5,r)-Math.PI/2;c.push([G(a,r)+e+.9*n*Math.cos(l-t),G(a,r)+s+.9*o*Math.sin(l-t)]);const u=2*Math.PI+l-.01;for(let h=l;h<u;h+=t){const t=[G(a,r)+e+n*Math.cos(h),G(a,r)+s+o*Math.sin(h)];i.push(t),c.push(t)}c.push([G(a,r)+e+n*Math.cos(l+2*Math.PI+.5*h),G(a,r)+s+o*Math.sin(l+2*Math.PI+.5*h)]),c.push([G(a,r)+e+.98*n*Math.cos(l+h),G(a,r)+s+.98*o*Math.sin(l+h)]),c.push([G(a,r)+e+.9*n*Math.cos(l+.5*h),G(a,r)+s+.9*o*Math.sin(l+.5*h)])}return[c,i]}function V(t,e,s,n,o,a,h,r,i){const c=a+G(.1,i),l=[];l.push([G(r,i)+e+.9*n*Math.cos(c-t),G(r,i)+s+.9*o*Math.sin(c-t)]);for(let a=c;a<=h;a+=t)l.push([G(r,i)+e+n*Math.cos(a),G(r,i)+s+o*Math.sin(a)]);return l.push([e+n*Math.cos(h),s+o*Math.sin(h)]),l.push([e+n*Math.cos(h),s+o*Math.sin(h)]),q(l,null,i)}function Z(t,e,s,n,o,a,h,r){const i=[],c=[r.maxRandomnessOffset||1,(r.maxRandomnessOffset||1)+.3];let l=[0,0];const u=r.disableMultiStroke?1:2,p=r.preserveVertices;for(let f=0;f<u;f++)0===f?i.push({op:"move",data:[h[0],h[1]]}):i.push({op:"move",data:[h[0]+(p?0:G(c[0],r)),h[1]+(p?0:G(c[0],r))]}),l=p?[o,a]:[o+G(c[f],r),a+G(c[f],r)],i.push({op:"bcurveTo",data:[t+G(c[f],r),e+G(c[f],r),s+G(c[f],r),n+G(c[f],r),l[0],l[1]]});return i}function Q(t){return[...t]}function H(t,e=0){const s=t.length;if(s<3)throw new Error("A curve must have at least three points.");const n=[];if(3===s)n.push(Q(t[0]),Q(t[1]),Q(t[2]),Q(t[2]));else{const s=[];s.push(t[0],t[0]);for(let e=1;e<t.length;e++)s.push(t[e]),e===t.length-1&&s.push(t[e]);const o=[],a=1-e;n.push(Q(s[0]));for(let t=1;t+2<s.length;t++){const e=s[t];o[0]=[e[0],e[1]],o[1]=[e[0]+(a*s[t+1][0]-a*s[t-1][0])/6,e[1]+(a*s[t+1][1]-a*s[t-1][1])/6],o[2]=[s[t+1][0]+(a*s[t][0]-a*s[t+2][0])/6,s[t+1][1]+(a*s[t][1]-a*s[t+2][1])/6],o[3]=[s[t+1][0],s[t+1][1]],n.push(o[1],o[2],o[3])}}return n}function N(t,e){return Math.pow(t[0]-e[0],2)+Math.pow(t[1]-e[1],2)}function B(t,e,s){const n=N(e,s);if(0===n)return N(t,e);let o=((t[0]-e[0])*(s[0]-e[0])+(t[1]-e[1])*(s[1]-e[1]))/n;return o=Math.max(0,Math.min(1,o)),N(t,J(e,s,o))}function J(t,e,s){return[t[0]+(e[0]-t[0])*s,t[1]+(e[1]-t[1])*s]}function K(t,e,s,n){const o=n||[];if(function(t,e){const s=t[e+0],n=t[e+1],o=t[e+2],a=t[e+3];let h=3*n[0]-2*s[0]-a[0];h*=h;let r=3*n[1]-2*s[1]-a[1];r*=r;let i=3*o[0]-2*a[0]-s[0];i*=i;let c=3*o[1]-2*a[1]-s[1];return c*=c,h<i&&(h=i),r<c&&(r=c),h+r}(t,e)<s){const s=t[e+0];if(o.length){(a=o[o.length-1],h=s,Math.sqrt(N(a,h)))>1&&o.push(s)}else o.push(s);o.push(t[e+3])}else{const n=.5,a=t[e+0],h=t[e+1],r=t[e+2],i=t[e+3],c=J(a,h,n),l=J(h,r,n),u=J(r,i,n),p=J(c,l,n),f=J(l,u,n),d=J(p,f,n);K([a,c,p,d],0,s,o),K([d,f,u,i],0,s,o)}var a,h;return o}function U(t,e){return X(t,0,t.length,e)}function X(t,e,s,n,o){const a=o||[],h=t[e],r=t[s-1];let i=0,c=1;for(let n=e+1;n<s-1;++n){const e=B(t[n],h,r);e>i&&(i=e,c=n)}return Math.sqrt(i)>n?(X(t,e,c+1,n,a),X(t,c,s,n,a)):(a.length||a.push(h),a.push(r)),a}function Y(t,e=.15,s){const n=[],o=(t.length-1)/3;for(let s=0;s<o;s++){K(t,3*s,e,n)}return s&&s>0?X(n,0,n.length,s):n}const tt="none";class et{constructor(t){this.defaultOptions={maxRandomnessOffset:2,roughness:1,bowing:1,stroke:"#000",strokeWidth:1,curveTightness:0,curveFitting:.95,curveStepCount:9,fillStyle:"hachure",fillWeight:-1,hachureAngle:-41,hachureGap:-1,dashOffset:-1,dashGap:-1,zigzagOffset:-1,seed:0,disableMultiStroke:!1,disableMultiStrokeFill:!1,preserveVertices:!1,fillShapeRoughnessGain:.8},this.config=t||{},this.config.options&&(this.defaultOptions=this._o(this.config.options))}static newSeed(){return Math.floor(Math.random()*2**31)}_o(t){return t?Object.assign({},this.defaultOptions,t):this.defaultOptions}_d(t,e,s){return{shape:t,sets:e||[],options:s||this.defaultOptions}}line(t,e,s,n,o){const a=this._o(o);return this._d("line",[v(t,e,s,n,a)],a)}rectangle(t,e,s,n,o){const a=this._o(o),h=[],r=O(t,e,s,n,a);if(a.fill){const o=[[t,e],[t+s,e],[t+s,e+n],[t,e+n]];"solid"===a.fillStyle?h.push(I([o],a)):h.push(C([o],a))}return a.stroke!==tt&&h.push(r),this._d("rectangle",h,a)}ellipse(t,e,s,n,o){const a=this._o(o),h=[],r=T(s,n,a),i=D(t,e,a,r);if(a.fill)if("solid"===a.fillStyle){const s=D(t,e,a,r).opset;s.type="fillPath",h.push(s)}else h.push(C([i.estimatedPoints],a));return a.stroke!==tt&&h.push(i.opset),this._d("ellipse",h,a)}circle(t,e,s,n){const o=this.ellipse(t,e,s,s,n);return o.shape="circle",o}linearPath(t,e){const s=this._o(e);return this._d("linearPath",[S(t,!1,s)],s)}arc(t,e,s,n,o,a,h=!1,r){const i=this._o(r),c=[],l=A(t,e,s,n,o,a,h,!0,i);if(h&&i.fill)if("solid"===i.fillStyle){const h=Object.assign({},i);h.disableMultiStroke=!0;const r=A(t,e,s,n,o,a,!0,!1,h);r.type="fillPath",c.push(r)}else c.push(function(t,e,s,n,o,a,h){const r=t,i=e;let c=Math.abs(s/2),l=Math.abs(n/2);c+=G(.01*c,h),l+=G(.01*l,h);let u=o,p=a;for(;u<0;)u+=2*Math.PI,p+=2*Math.PI;p-u>2*Math.PI&&(u=0,p=2*Math.PI);const f=(p-u)/h.curveStepCount,d=[];for(let t=u;t<=p;t+=f)d.push([r+c*Math.cos(t),i+l*Math.sin(t)]);return d.push([r+c*Math.cos(p),i+l*Math.sin(p)]),d.push([r,i]),C([d],h)}(t,e,s,n,o,a,i));return i.stroke!==tt&&c.push(l),this._d("arc",c,i)}curve(t,e){const s=this._o(e),n=[],o=L(t,s);if(s.fill&&s.fill!==tt)if("solid"===s.fillStyle){const e=L(t,Object.assign(Object.assign({},s),{disableMultiStroke:!0,roughness:s.roughness?s.roughness+s.fillShapeRoughnessGain:0}));n.push({type:"fillPath",ops:this._mergedShape(e.ops)})}else{const e=[],o=t;if(o.length){const t="number"==typeof o[0][0]?[o]:o;for(const n of t)n.length<3?e.push(...n):3===n.length?e.push(...Y(H([n[0],n[0],n[1],n[2]]),10,(1+s.roughness)/2)):e.push(...Y(H(n),10,(1+s.roughness)/2))}e.length&&n.push(C([e],s))}return s.stroke!==tt&&n.push(o),this._d("curve",n,s)}polygon(t,e){const s=this._o(e),n=[],o=S(t,!0,s);return s.fill&&("solid"===s.fillStyle?n.push(I([t],s)):n.push(C([t],s))),s.stroke!==tt&&n.push(o),this._d("polygon",n,s)}path(t,e){const s=this._o(e),n=[];if(!t)return this._d("path",n,s);t=(t||"").replace(/\n/g," ").replace(/(-\s)/g,"-").replace("/(ss)/g"," ");const o=s.fill&&"transparent"!==s.fill&&s.fill!==tt,a=s.stroke!==tt,h=!!(s.simplification&&s.simplification<1),r=function(t,e,s){const n=m(y(b(t))),o=[];let a=[],h=[0,0],r=[];const i=()=>{r.length>=4&&a.push(...Y(r,e)),r=[]},c=()=>{i(),a.length&&(o.push(a),a=[])};for(const{key:t,data:e}of n)switch(t){case"M":c(),h=[e[0],e[1]],a.push(h);break;case"L":i(),a.push([e[0],e[1]]);break;case"C":if(!r.length){const t=a.length?a[a.length-1]:h;r.push([t[0],t[1]])}r.push([e[0],e[1]]),r.push([e[2],e[3]]),r.push([e[4],e[5]]);break;case"Z":i(),a.push([h[0],h[1]])}if(c(),!s)return o;const l=[];for(const t of o){const e=U(t,s);e.length&&l.push(e)}return l}(t,1,h?4-4*(s.simplification||1):(1+s.roughness)/2),i=_(t,s);if(o)if("solid"===s.fillStyle)if(1===r.length){const e=_(t,Object.assign(Object.assign({},s),{disableMultiStroke:!0,roughness:s.roughness?s.roughness+s.fillShapeRoughnessGain:0}));n.push({type:"fillPath",ops:this._mergedShape(e.ops)})}else n.push(I(r,s));else n.push(C(r,s));return a&&(h?r.forEach((t=>{n.push(S(t,!1,s))})):n.push(i)),this._d("path",n,s)}opsToPath(t,e){let s="";for(const n of t.ops){const t="number"==typeof e&&e>=0?n.data.map((t=>+t.toFixed(e))):n.data;switch(n.op){case"move":s+=`M${t[0]} ${t[1]} `;break;case"bcurveTo":s+=`C${t[0]} ${t[1]}, ${t[2]} ${t[3]}, ${t[4]} ${t[5]} `;break;case"lineTo":s+=`L${t[0]} ${t[1]} `}}return s.trim()}toPaths(t){const e=t.sets||[],s=t.options||this.defaultOptions,n=[];for(const t of e){let e=null;switch(t.type){case"path":e={d:this.opsToPath(t),stroke:s.stroke,strokeWidth:s.strokeWidth,fill:tt};break;case"fillPath":e={d:this.opsToPath(t),stroke:tt,strokeWidth:0,fill:s.fill||tt};break;case"fillSketch":e=this.fillSketch(t,s)}e&&n.push(e)}return n}fillSketch(t,e){let s=e.fillWeight;return s<0&&(s=e.strokeWidth/2),{d:this.opsToPath(t),stroke:e.fill||tt,strokeWidth:s,fill:tt}}_mergedShape(t){return t.filter(((t,e)=>0===e||"move"!==t.op))}}class st{constructor(t,e){this.canvas=t,this.ctx=this.canvas.getContext("2d"),this.gen=new et(e)}draw(t){const e=t.sets||[],s=t.options||this.getDefaultOptions(),n=this.ctx,o=t.options.fixedDecimalPlaceDigits;for(const a of e)switch(a.type){case"path":n.save(),n.strokeStyle="none"===s.stroke?"transparent":s.stroke,n.lineWidth=s.strokeWidth,s.strokeLineDash&&n.setLineDash(s.strokeLineDash),s.strokeLineDashOffset&&(n.lineDashOffset=s.strokeLineDashOffset),this._drawToContext(n,a,o),n.restore();break;case"fillPath":{n.save(),n.fillStyle=s.fill||"";const e="curve"===t.shape||"polygon"===t.shape||"path"===t.shape?"evenodd":"nonzero";this._drawToContext(n,a,o,e),n.restore();break}case"fillSketch":this.fillSketch(n,a,s)}}fillSketch(t,e,s){let n=s.fillWeight;n<0&&(n=s.strokeWidth/2),t.save(),s.fillLineDash&&t.setLineDash(s.fillLineDash),s.fillLineDashOffset&&(t.lineDashOffset=s.fillLineDashOffset),t.strokeStyle=s.fill||"",t.lineWidth=n,this._drawToContext(t,e,s.fixedDecimalPlaceDigits),t.restore()}_drawToContext(t,e,s,n="nonzero"){t.beginPath();for(const n of e.ops){const e="number"==typeof s&&s>=0?n.data.map((t=>+t.toFixed(s))):n.data;switch(n.op){case"move":t.moveTo(e[0],e[1]);break;case"bcurveTo":t.bezierCurveTo(e[0],e[1],e[2],e[3],e[4],e[5]);break;case"lineTo":t.lineTo(e[0],e[1])}}"fillPath"===e.type?t.fill(n):t.stroke()}get generator(){return this.gen}getDefaultOptions(){return this.gen.defaultOptions}line(t,e,s,n,o){const a=this.gen.line(t,e,s,n,o);return this.draw(a),a}rectangle(t,e,s,n,o){const a=this.gen.rectangle(t,e,s,n,o);return this.draw(a),a}ellipse(t,e,s,n,o){const a=this.gen.ellipse(t,e,s,n,o);return this.draw(a),a}circle(t,e,s,n){const o=this.gen.circle(t,e,s,n);return this.draw(o),o}linearPath(t,e){const s=this.gen.linearPath(t,e);return this.draw(s),s}polygon(t,e){const s=this.gen.polygon(t,e);return this.draw(s),s}arc(t,e,s,n,o,a,h=!1,r){const i=this.gen.arc(t,e,s,n,o,a,h,r);return this.draw(i),i}curve(t,e){const s=this.gen.curve(t,e);return this.draw(s),s}path(t,e){const s=this.gen.path(t,e);return this.draw(s),s}}const nt="http://www.w3.org/2000/svg";class ot{constructor(t,e){this.svg=t,this.gen=new et(e)}draw(t){const e=t.sets||[],s=t.options||this.getDefaultOptions(),n=this.svg.ownerDocument||window.document,o=n.createElementNS(nt,"g"),a=t.options.fixedDecimalPlaceDigits;for(const h of e){let e=null;switch(h.type){case"path":e=n.createElementNS(nt,"path"),e.setAttribute("d",this.opsToPath(h,a)),e.setAttribute("stroke",s.stroke),e.setAttribute("stroke-width",s.strokeWidth+""),e.setAttribute("fill","none"),s.strokeLineDash&&e.setAttribute("stroke-dasharray",s.strokeLineDash.join(" ").trim()),s.strokeLineDashOffset&&e.setAttribute("stroke-dashoffset",`${s.strokeLineDashOffset}`);break;case"fillPath":e=n.createElementNS(nt,"path"),e.setAttribute("d",this.opsToPath(h,a)),e.setAttribute("stroke","none"),e.setAttribute("stroke-width","0"),e.setAttribute("fill",s.fill||""),"curve"!==t.shape&&"polygon"!==t.shape||e.setAttribute("fill-rule","evenodd");break;case"fillSketch":e=this.fillSketch(n,h,s)}e&&o.appendChild(e)}return o}fillSketch(t,e,s){let n=s.fillWeight;n<0&&(n=s.strokeWidth/2);const o=t.createElementNS(nt,"path");return o.setAttribute("d",this.opsToPath(e,s.fixedDecimalPlaceDigits)),o.setAttribute("stroke",s.fill||""),o.setAttribute("stroke-width",n+""),o.setAttribute("fill","none"),s.fillLineDash&&o.setAttribute("stroke-dasharray",s.fillLineDash.join(" ").trim()),s.fillLineDashOffset&&o.setAttribute("stroke-dashoffset",`${s.fillLineDashOffset}`),o}get generator(){return this.gen}getDefaultOptions(){return this.gen.defaultOptions}opsToPath(t,e){return this.gen.opsToPath(t,e)}line(t,e,s,n,o){const a=this.gen.line(t,e,s,n,o);return this.draw(a)}rectangle(t,e,s,n,o){const a=this.gen.rectangle(t,e,s,n,o);return this.draw(a)}ellipse(t,e,s,n,o){const a=this.gen.ellipse(t,e,s,n,o);return this.draw(a)}circle(t,e,s,n){const o=this.gen.circle(t,e,s,n);return this.draw(o)}linearPath(t,e){const s=this.gen.linearPath(t,e);return this.draw(s)}polygon(t,e){const s=this.gen.polygon(t,e);return this.draw(s)}arc(t,e,s,n,o,a,h=!1,r){const i=this.gen.arc(t,e,s,n,o,a,h,r);return this.draw(i)}curve(t,e){const s=this.gen.curve(t,e);return this.draw(s)}path(t,e){const s=this.gen.path(t,e);return this.draw(s)}}return{canvas:(t,e)=>new st(t,e),svg:(t,e)=>new ot(t,e),generator:t=>new et(t),newSeed:()=>et.newSeed()}}();

if (!window.rough) window.rough = rough;
})();

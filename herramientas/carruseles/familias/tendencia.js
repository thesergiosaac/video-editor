/* tendencia.js — familia «Tendencia de la semana» (copia de @rebrndmx). ANIMADA.
 * El diseño se queda quieto y lo que corre son DOS clips por lámina: la publicación de arriba a la izquierda y la
 * «cámara» de abajo a la derecha. Encima, la ventanita «Nuevo trend» con el nombre del formato, la tarjeta del texto
 * (con los tres puntos de ventana) y la tarjeta «Funciona para / porque» con chulos. Fondo pastel distinto por lámina
 * con trama de puntos. Portada y cierre fijas (JPG). Medidas de tendencia.html / tendencia.py (1080×1350).
 * Capas del MP4: todo lo de z < 10 es fondo, los clips van en z 10 y 11 y todo lo de z ≥ 20 es frente. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var W = 1080;

  // íconos de la referencia (lucide-static 0.460, los mismos trazos de tendencia.html)
  var ICO = {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'
  };
  function svg(n, t, color, grosor) { return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" fill="none" stroke="' + color + '" stroke-width="' + (grosor || 2) + '" stroke-linecap="round" stroke-linejoin="round" style="display:block">' + (ICO[n] || '') + '</svg>'; }
  function rgb(v) { var m = /^#([0-9a-f]{6})$/i.exec(v || ''); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function mezcla(v, con, t, def) { var a = rgb(v) || def; return 'rgb(' + a.map(function (x, i) { return Math.round(x + (con[i] - x) * t); }).join(',') + ')'; }

  /* ── piezas propias (un div raíz cada una) ── */
  // la trama de puntos que se desvanece hacia arriba (abajo de todas las láminas)
  LZ.tipo('tend-trama', function (el, base, attrs) {
    return '<div ' + attrs + ' style="' + base + 'pointer-events:none;background-image:radial-gradient(rgba(60,80,120,.18) 1.6px,transparent 1.8px);background-size:34px 34px;-webkit-mask:linear-gradient(transparent,#000);mask:linear-gradient(transparent,#000)"></div>';
  });
  // el degradado de portada, sacado del color principal de la marca (oscuro → principal → claro, 160°)
  LZ.tipo('tend-degradado', function (el, base, attrs, u) {
    var c = u.res(el.color), p = rgb(c) ? c : '#2F8F8A';
    var g = el.fijo || 'linear-gradient(160deg,' + mezcla(p, [10, 70, 110], .4) + ' 0%,' + p + ' 40%,' + mezcla(p, [255, 255, 255], .46) + ' 100%)';
    return '<div ' + attrs + ' style="' + base + 'background:' + g + '"></div>';
  });
  // caja genérica: tarjetas, ventanita, miniatura y obturador de la cámara (fondo, borde, radio, sombra y un ícono)
  LZ.tipo('tend-caja', function (el, base, attrs, u) {
    return '<div ' + attrs + ' style="' + base + 'background:' + u.res(el.fondo || 'transparent') + ';border-radius:' + (typeof el.radio === 'string' ? el.radio : (el.radio || 0) + 'px') + ';' +
      (el.borde ? 'border:' + el.bw + 'px solid ' + u.res(el.borde) + ';' : '') + (el.sombraCss ? 'box-shadow:' + el.sombraCss + ';' : '') +
      'display:grid;place-items:center">' + (el.glifo ? '<span style="font:500 ' + (el.glifoTam || 44) + 'px \'' + u.res('@cuerpo') + '\',sans-serif;color:' + u.res(el.icoColor || '#FFFFFF') + ';line-height:1">' + u.esc(el.glifo) + '</span>' : '') + (el.icono ? svg(el.icono, el.icoTam || 28, u.res(el.icoColor || '#FFFFFF')) : '') + '</div>';
  });
  // un ícono suelto (fila de la tarjeta del texto)
  LZ.tipo('tend-ico', function (el, base, attrs, u) {
    return '<div ' + attrs + ' style="' + base + '">' + svg(el.icono, el.w, u.res(el.color || '#333333')) + '</div>';
  });
  // el puntico de ventana (rojo, amarillo, verde)
  LZ.tipo('tend-punto', function (el, base, attrs, u) { return '<div ' + attrs + ' style="' + base + 'border-radius:50%;background:' + u.res(el.fondo) + '"></div>'; });
  // el chulo amarillo de la lista (el visto va en un tono oscuro del mismo color)
  LZ.tipo('tend-chulo', function (el, base, attrs, u) {
    var c = u.res(el.color), k = el.w / 26;
    return '<div ' + attrs + ' style="' + base + 'border-radius:50%;background:' + c + ';display:grid;place-items:center"><i style="display:block;width:' + (9 * k) + 'px;height:' + (5 * k) + 'px;border-left:' + (2.5 * k) + 'px solid ' + mezcla(c, [0, 0, 0], .64, [247, 201, 72]) + ';border-bottom:' + (2.5 * k) + 'px solid ' + mezcla(c, [0, 0, 0], .64, [247, 201, 72]) + ';transform:rotate(-45deg) translate(' + k + 'px,' + (-k) + 'px)"></i></div>';
  });
  // el selector de zoom de la cámara (0.5 · 1x · 2)
  LZ.tipo('tend-zoom', function (el, base, attrs, u) {
    return '<div ' + attrs + ' style="' + base + 'border-radius:25px;background:rgba(0,0,0,.35);display:flex;justify-content:space-around;align-items:center;font:600 20px \'' + u.res('@cuerpo') + '\',sans-serif;color:#fff"><span>0.5</span><span style="background:rgba(0,0,0,.5);border-radius:50%;padding:6px 8px">1x</span><span>2</span></div>';
  });

  /* rectángulos de los clips (los mismos de tendencia.py) */
  var A = { x: 75, y: 99, w: 503, h: 638, r: 36 }, B = { x: 510, y: 633, w: 506, h: 642, r: 36 };
  // un pastel distinto por lámina (los tres de la referencia y dos más para listas largas)
  var PASTEL = [
    ['linear-gradient(160deg,#dfe9f6 0%,#c9dcf2 45%,#e9eef6 100%)', '#dfe9f6', 'azul'],
    ['linear-gradient(160deg,#f6dfe3 0%,#f0c9d0 45%,#f6e9ec 100%)', '#f6dfe3', 'rosado'],
    ['linear-gradient(160deg,#e3f1e1 0%,#cfe8cc 45%,#eef6ec 100%)', '#e3f1e1', 'verde'],
    ['linear-gradient(160deg,#e8e2f6 0%,#d8cdf0 45%,#efebf7 100%)', '#e8e2f6', 'lila'],
    ['linear-gradient(160deg,#f6e8da 0%,#f0d8bf 45%,#f7efe6 100%)', '#f6e8da', 'durazno']
  ];

  FAMILIAS.registrar('tendencia', {
    catalogo: {
      letras: { titular: 'Inter', mano: 'Instrument Serif', cuerpo: 'Inter' },
      colores: { principal: '#2F8F8A', acento: '#F7C948', fondo: '#DFE9F6', texto: '#111111' }
    },
    esquema: {
      nombre: 'Tendencia de la semana', nItems: 3, iconos: U.ICONOS_OK,
      guia: 'Carrusel ANIMADO de formatos o tendencias para grabar: cada lámina del medio es UN formato, con su nombre corto (va en una ventanita tipo «Nuevo trend»), una explicación de cómo se graba y tres razones o usos cortos; los ejemplos que corren son clips del propio usuario. No afirmes que algo «está rompiendo Instagram» si no hay dato: habla de «formatos para grabar esta semana».',
      portada: {
        arriba: { max: 14, desc: 'primer renglón: cuántos y qué (p. ej. «3 formatos»)' },
        cursiva: { max: 13, desc: 'segundo renglón, el grande en cursiva (p. ej. «para grabar»)' },
        abajo: { max: 14, desc: 'tercer renglón que cierra la idea (p. ej. «esta semana»)' }
      },
      item: {
        nombre: { max: 20, desc: 'nombre corto del formato, como si lo guardaras en el celular (p. ej. «Detrás de cámaras», «Proceso → resultado»)' },
        texto: { max: 95, desc: 'cómo se graba, en segunda persona y en 1–2 frases (p. ej. «Muestras cómo grabas: la luz, el celular, el escritorio. La gente se queda por curiosidad.»)' },
        titulo_lista: { max: 16, desc: 'encabezado de la lista, con dos puntos: «Funciona para:» o «Funciona porque:»' },
        lista: { lista: 3, desc: '3 razones o usos MUY cortos (que quepan en un renglón)', campos: { t: { max: 20, desc: 'dos a cuatro palabras (p. ej. «Da confianza», «Mostrar tu proceso»)' } } }
      },
      cierre: {
        titular: { max: 12, desc: 'una palabra o dos, la acción (p. ej. «Guárdalo»)' },
        texto: { max: 44, desc: 'a quién mandárselo (p. ej. «y mándaselo a quien siempre pregunta»)' },
        cita: { max: 32, desc: 'lo que esa persona siempre pregunta, entre comillas latinas (p. ej. «¿qué subimos esta semana?»)' },
        pregunta: { max: 34, desc: 'pregunta final corta para los comentarios (p. ej. «¿Cuál vas a grabar primero?»)' }
      },
      comun: {
        ventana: { max: 16, desc: 'título de la ventanita donde va el nombre de cada formato (p. ej. «Nuevo trend», «Nuevo formato»)' }
      }
    },
    armar: function (c, mat, alto) {
      var H = alto || 1350;
      var fotos = (mat && mat.fotos) || [], clips = (mat && mat.clips) || [];
      c = c || {}; var po = c.portada || {}, ci = c.cierre || {}, co = c.comun || {};
      var laminas = [portada()];
      (c.items || []).forEach(function (it, k) { laminas.push(interior(it || {}, k)); });
      laminas.push(cierre());
      return laminas;

      function trama() { return { id: nid(), tipo: 'tend-trama', nombre: 'Trama de puntos', papel: 'trama', x: 0, y: H - 260, w: W, h: 260, z: 1, rot: 0, op: 1 }; }
      // una tarjeta con clip (o, si no hay clips, con una foto; y si no hay fotos, un espacio vacío que se ve limpio)
      function tarjeta(R, n, nombre, papel, z) {
        var clip = clips.length ? clips[n % clips.length] : null;
        if (clip) return { id: nid(), tipo: 'video', nombre: nombre, papel: papel, src: clip.video, poster: clip.url, ini: (clip.dur || 0) >= 7.5 ? 1 : 0, dur: 6,
          x: R.x, y: R.y, w: R.w, h: R.h, radio: R.r, posY: 50, sombra: false, borde: null, bw: 0, z: z, rot: 0, op: 1, ref: { clip: clip.id } };
        var f = fotos.length ? fotos[n % fotos.length] : null;
        if (f) return U.fotoEl(f, { x: R.x, y: R.y, w: R.w, h: R.h }, { nombre: nombre.replace('clip', 'foto'), papel: papel, radio: R.r, z: z });
        return { id: nid(), tipo: 'forma', nombre: 'Espacio para tu clip', papel: papel, fondo: 'rgba(255,255,255,.55)', radio: R.r, x: R.x, y: R.y, w: R.w, h: R.h, z: z, rot: 0, op: 1 };
      }
      function caja(o) { return Object.assign({ id: nid(), tipo: 'tend-caja', rot: 0, op: 1 }, o); }
      // interfaz de cámara encima de un clip: sombra de abajo + miniatura (y en la grande: obturador, girar y zoom)
      function camara(R, grande, z) {
        var s = grande ? 'cámara grande' : 'cámara chica';
        var els = [
          caja({ nombre: 'Sombra de la ' + s, papel: 'cam-sombra', fondo: 'linear-gradient(180deg,transparent,rgba(0,0,0,.45))', radio: '0 0 ' + R.r + 'px ' + R.r + 'px', x: R.x, y: R.y + R.h - 150, w: R.w, h: 150, z: z }),
          caja({ nombre: 'Miniatura de la ' + s, papel: 'cam-miniatura', fondo: 'rgba(255,255,255,.25)', borde: 'rgba(255,255,255,.85)', bw: 3, radio: 12, x: R.x + 36, y: R.y + R.h - 110, w: 66, h: 66, z: z + 1 })
        ];
        if (grande) els.push(
          caja({ nombre: 'Obturador', papel: 'cam-obturador', fondo: 'rgba(255,255,255,.35)', borde: '#FFFFFF', bw: 5, radio: '50%', x: R.x + R.w / 2 - 44, y: R.y + R.h - 122, w: 88, h: 88, z: z + 1 }),
          caja({ nombre: 'Botón de girar', papel: 'cam-girar', fondo: 'rgba(0,0,0,.35)', radio: '50%', icono: 'refresh-cw', icoTam: 28, icoColor: '#FFFFFF', x: R.x + R.w - 92, y: R.y + R.h - 104, w: 54, h: 54, z: z + 1 }),
          { id: nid(), tipo: 'tend-zoom', nombre: 'Zoom de la cámara', papel: 'cam-zoom', x: R.x + R.w / 2 - 90, y: R.y + R.h - 196, w: 180, h: 50, z: z + 1, rot: 0, op: 1 }
        );
        return els;
      }

      function portada() {
        var tx = function (o) { return T(Object.assign({ x: 40, w: W - 80, alin: 'center', color: '#FFFFFF', z: 6, _cabe: W - 80 }, o)); };
        return { fondo: '#2f8f8a', els: [
          { id: nid(), tipo: 'tend-degradado', nombre: 'Fondo degradado', papel: 'fondo-portada', color: '@principal', x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1 },
          trama(),
          tx({ nombre: 'Titular (arriba)', papel: 'titular-arriba', txt: po.arriba || '', y: 360, fuente: '@titular', tam: 70, peso: 600, espac: -.02, interl: 1.21 }),
          tx({ nombre: 'Titular en cursiva', papel: 'titular-cursiva', txt: po.cursiva || '', y: 445, fuente: '@mano', tam: 150, peso: 400, cursiva: true, interl: .9 }),
          tx({ nombre: 'Titular (abajo)', papel: 'titular-abajo', txt: po.abajo || '', y: 590, fuente: '@titular', tam: 70, peso: 600, espac: -.02, interl: 1.21 }),
          caja({ nombre: 'Botón de flecha', papel: 'flecha-portada', borde: '#FFFFFF', bw: 3, radio: '50%', glifo: '→', glifoTam: 44, icoColor: '#FFFFFF', x: 495, y: 735, w: 90, h: 90, z: 6 })
        ] };
      }

      function interior(it, k) {
        var P = PASTEL[k % PASTEL.length];
        var lista = (it.lista || []).map(function (e) { return typeof e === 'string' ? e : (e && e.t) || ''; }).filter(Boolean).slice(0, 3);
        var els = [
          { id: nid(), tipo: 'forma', nombre: 'Fondo ' + P[2], papel: 'fondo', fondo: P[0], radio: 0, x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1 },
          trama(),
          // tarjeta del texto (va en el fondo: no toca los clips)
          caja({ nombre: 'Tarjeta del texto', papel: 'tarjeta-texto', fondo: '#FFFFFF', radio: 30, sombraCss: '0 10px 30px rgba(20,30,60,.10)', x: 620, y: 152, w: 395, h: 348, z: 2 }),
          { id: nid(), tipo: 'tend-punto', nombre: 'Punto rojo', papel: 'punto', fondo: '#ff5f57', x: 650, y: 174, w: 12, h: 12, z: 3, rot: 0, op: 1 },
          { id: nid(), tipo: 'tend-punto', nombre: 'Punto amarillo', papel: 'punto', fondo: '#febc2e', x: 670, y: 174, w: 12, h: 12, z: 3, rot: 0, op: 1 },
          { id: nid(), tipo: 'tend-punto', nombre: 'Punto verde', papel: 'punto', fondo: '#28c840', x: 690, y: 174, w: 12, h: 12, z: 3, rot: 0, op: 1 },
          T({ nombre: 'Cómo se graba', papel: 'texto', txt: it.texto || '', x: 654, y: 214, w: 331, tam: 31, peso: 500, interl: 1.28, color: '#1a1a1a', z: 3 }),
          { id: nid(), tipo: 'forma', nombre: 'Línea de la tarjeta', papel: 'linea', fondo: '#ececec', radio: 0, x: 650, y: 422, w: 335, h: 1.5, z: 3, rot: 0, op: 1 },
          { id: nid(), tipo: 'tend-ico', nombre: 'Ícono me gusta', papel: 'icono-tarjeta', icono: 'heart', color: '#333333', x: 650, y: 440, w: 34, h: 34, z: 3, rot: 0, op: 1 },
          { id: nid(), tipo: 'tend-ico', nombre: 'Ícono comentar', papel: 'icono-tarjeta', icono: 'message-circle', color: '#333333', x: 702, y: 440, w: 34, h: 34, z: 3, rot: 0, op: 1 },
          { id: nid(), tipo: 'tend-ico', nombre: 'Ícono enviar', papel: 'icono-tarjeta', icono: 'send', color: '#333333', x: 754, y: 440, w: 34, h: 34, z: 3, rot: 0, op: 1 },
          { id: nid(), tipo: 'tend-ico', nombre: 'Ícono guardar', papel: 'icono-tarjeta', icono: 'bookmark', color: '#333333', x: 951, y: 440, w: 34, h: 34, z: 3, rot: 0, op: 1 },
          // los dos clips (z 10 y 11: nada entre ellos)
          tarjeta(A, 2 * k, 'Tu clip (publicación)', 'clip-publicacion', 10),
          tarjeta(B, 2 * k + 1, 'Tu clip (cámara)', 'clip-camara', 11)
        ];
        // frente: interfaz de cámara, ventanita «Nuevo trend» y tarjeta «Funciona…»
        els = els.concat(camara(A, false, 20), camara(B, true, 20));
        els.push(
          caja({ nombre: 'Ventanita', papel: 'ventana', fondo: 'rgba(250,250,252,.96)', radio: 26, sombraCss: '0 16px 40px rgba(20,30,60,.18)', x: 292, y: 558, w: 495, h: 233, z: 24 }),
          T({ nombre: 'Título de la ventanita', papel: 'ventana-titulo', txt: co.ventana || 'Nuevo trend', x: 292, y: 584, w: 495, alin: 'center', tam: 30, peso: 600, interl: 1.21, color: '#111111', z: 25 }),
          T({ nombre: 'Nombre del formato', papel: 'nombre-formato', txt: it.nombre || '', x: 320, y: 638, w: 439, alin: 'center', tam: 40, peso: 500, interl: 1.21, color: '#111111', caja: { fondo: '#FFFFFF', borde: '#cfcfd4', bw: 2, radio: 12, padV: 10, padH: 8 }, z: 25, _cabe: 419 }),
          T({ nombre: 'Botón «Cancelar»', papel: 'ventana-boton', txt: 'Cancelar', x: 292, y: 730, w: 247, alin: 'center', tam: 34, peso: 600, interl: 1.21, color: '#2f7cf6', z: 25 }),
          T({ nombre: 'Botón «Guardar»', papel: 'ventana-boton', txt: 'Guardar', x: 540, y: 730, w: 247, alin: 'center', tam: 34, peso: 600, interl: 1.21, color: '#2f7cf6', z: 25 }),
          caja({ nombre: 'Tarjeta de la lista', papel: 'tarjeta-lista', fondo: '#FFFFFF', radio: 30, sombraCss: '0 10px 30px rgba(20,30,60,.10)', x: 75, y: 858, w: 378, h: 252, z: 24 }),
          T({ nombre: 'Título de la lista', papel: 'lista-titulo', txt: it.titulo_lista || 'Funciona para:', x: 105, y: 892, w: 318, tam: 30, peso: 800, interl: 1.21, color: '#111111', z: 25, _cabe: 318 })
        );
        lista.forEach(function (t, i) {
          var y = 942 + i * 45;
          els.push(
            { id: nid(), tipo: 'tend-chulo', nombre: 'Chulo ' + (i + 1), papel: 'chulo', color: '@acento', x: 105, y: y + 19, w: 26, h: 26, z: 25, rot: 0, op: 1 },
            T({ nombre: 'Razón ' + (i + 1), papel: 'lista-item', txt: t, x: 141, y: y, tam: 29, peso: 500, interl: 1.55, color: '#111111', z: 25, _cabe: 282 })
          );
        });
        return { fondo: P[1], els: els };
      }

      function cierre() {
        var cita = String(ci.cita || '').replace(/\*/g, '');
        return { fondo: '#f3e6d3', els: [
          { id: nid(), tipo: 'forma', nombre: 'Fondo crema', papel: 'fondo-cierre', fondo: 'linear-gradient(160deg,#f3e6d3 0%,#f0d9b8 50%,#f7efe4 100%)', radio: 0, x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1 },
          trama(),
          caja({ nombre: 'Tarjeta', papel: 'tarjeta-cierre', fondo: '#FFFFFF', radio: 30, sombraCss: '0 10px 30px rgba(20,30,60,.10)', x: 140, y: 380, w: 800, h: 490, z: 2 }),
          T({ nombre: 'Titular', papel: 'titular-cierre', txt: ci.titular || '', x: 200, y: 450, w: 680, alin: 'center', fuente: '@mano', tam: 90, peso: 400, cursiva: true, interl: 1, color: '#111111', z: 3, _cabe: 680 }),
          T({ nombre: 'Texto', papel: 'texto-cierre', txt: (ci.texto || '') + (cita ? '\n*' + cita + '*' : ''), x: 200, y: 570, w: 680, alin: 'center', tam: 38, peso: 500, interl: 1.35, color: '#111111', colorAc: '@texto', modoAc: 'negrita', z: 3 }),
          T({ nombre: 'Pregunta', papel: 'pregunta-cierre', txt: ci.pregunta || '', x: 200, y: 764, w: 680, alin: 'center', tam: 30, peso: 500, interl: 1.21, color: '#666666', z: 3 })
        ] };
      }
    }
  });
})();

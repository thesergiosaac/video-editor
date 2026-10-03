/* celular.js — familia «Tendencia en celular» (copia de @imsomarketing, «Reels en tendencia»). ANIMADA.
 * Portada: tu clip a sangre con el titular blanco sobre el pecho. Adentro (una sola forma, la que Sergio aprobó): fondo
 * crema con marco verde oliva, a la izquierda el nombre del formato y el párrafo que lo explica, a la derecha un celular
 * negro con tu reel corriendo y la interfaz de Instagram encima; pie «Compártelo / Guárdalo». Cierre: tarjeta oliva con
 * insignia roja de corazón y avión de papel. Medidas de celular.html / celular.py (1080×1350; pantalla {556,216,438,790,r28}).
 * Capas del MP4: lo de z < 10 es fondo, el clip va en z 10 y lo de z ≥ 20 es frente. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var W = 1080, GRIS = '#B7B2A8';
  var P = { x: 556, y: 216, w: 438, h: 790, r: 28 };   // pantalla del celular (donde corre el clip)

  // íconos de la referencia (lucide-static 0.460, los mismos trazos de celular.html)
  var ICO = {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    forward: '<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',
    house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
  };
  function svg(n, t, color) { return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none">' + (ICO[n] || '') + '</svg>'; }

  /* ── piezas propias (un div raíz cada una) ── */
  // el marco redondeado (solo borde)
  LZ.tipo('cel-marco', function (el, base, attrs, u) { return '<div ' + attrs + ' style="' + base + 'border:' + (el.bw || 3) + 'px solid ' + u.res(el.color) + ';border-radius:' + (el.radio || 26) + 'px;pointer-events:none"></div>'; });
  // un ícono suelto (pie de la lámina)
  LZ.tipo('cel-ico', function (el, base, attrs, u) { return '<div ' + attrs + ' style="' + base + '">' + svg(el.icono, el.w, u.res(el.color || GRIS)) + '</div>'; });
  // el cuerpo del celular: carcasa negra, botones de los lados y barra de navegación (dibujado a 470×950 y escalado)
  LZ.tipo('cel-cuerpo', function (el, base, attrs, u) {
    var k = el.w / 470, c = u.res(el.color || '#0E0E0E');
    return '<div ' + attrs + ' style="' + base + 'overflow:visible"><div style="position:absolute;left:0;top:0;width:470px;height:950px;transform:scale(' + k + ');transform-origin:0 0">' +
      '<div style="position:absolute;inset:0;border-radius:46px;background:' + c + ';box-shadow:0 20px 40px rgba(0,0,0,.18)"></div>' +
      '<div style="position:absolute;left:-10px;top:126px;width:12px;height:70px;border-radius:6px;background:' + c + '"></div>' +
      '<div style="position:absolute;left:468px;top:166px;width:12px;height:110px;border-radius:6px;background:' + c + '"></div>' +
      '<div style="position:absolute;left:16px;top:836px;width:438px;display:flex;justify-content:space-around;align-items:center">' +
      svg('house', 34, '#fff') + svg('zap', 34, '#fff') + '<span style="width:62px;height:40px;border-radius:12px;background:#fff;display:grid;place-items:center">' + svg('plus', 26, '#111') + '</span>' + svg('message-square', 34, '#fff') + svg('user', 34, '#fff') +
      '</div></div></div>';
  });
  // la interfaz de Instagram encima del reel: píldoras de arriba, íconos del lado y barras de la descripción (438×790)
  LZ.tipo('cel-interfaz', function (el, base, attrs) {
    var k = el.w / 438;
    return '<div ' + attrs + ' style="' + base + 'overflow:visible;pointer-events:auto"><div style="position:absolute;left:0;top:0;width:438px;height:790px;transform:scale(' + k + ');transform-origin:0 0">' +
      '<div style="position:absolute;left:144px;top:22px;display:flex;gap:16px"><span style="width:62px;height:18px;border-radius:9px;background:rgba(255,255,255,.75)"></span><span style="width:52px;height:18px;border-radius:9px;background:rgba(255,255,255,.75)"></span></div>' +
      '<div style="position:absolute;left:382px;top:460px;display:grid;gap:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">' + svg('heart', 34, '#fff') + svg('message-circle', 34, '#fff') + svg('bookmark', 34, '#fff') + svg('send', 34, '#fff') + '</div>' +
      '<div style="position:absolute;left:22px;top:702px;width:150px;height:14px;border-radius:7px;background:#fff"></div>' +
      '<div style="position:absolute;left:22px;top:728px;width:260px;height:10px;border-radius:5px;background:rgba(255,255,255,.7)"></div>' +
      '<div style="position:absolute;left:22px;top:748px;width:200px;height:10px;border-radius:5px;background:rgba(255,255,255,.55)"></div>' +
      '</div></div>';
  });
  // trazos sueltos (flecha curva de la portada, corazón y avión del cierre)
  var TRAZOS = {
    flecha: { vb: '0 0 150 60', d: '<path d="M6 12 C 40 50, 100 52, 138 34"/><path d="M118 24 L140 33 L124 50"/>', g: 4 },
    corazon: { vb: '0 0 24 24', d: '<path d="M12 21 C 5 16, 2 12.5, 2 8.5 A4.5 4.5 0 0 1 12 6 A4.5 4.5 0 0 1 22 8.5 C 22 12.5, 19 16, 12 21Z"/>', g: 3 },
    avion: { vb: '0 0 24 24', d: '<path d="M22 2 L11 13 M22 2 L15 22 L11 13 L2 9 Z"/>', g: 1.6 }
  };
  LZ.tipo('cel-trazo', function (el, base, attrs, u) {
    var t = TRAZOS[el.trazo] || TRAZOS.flecha;
    return '<div ' + attrs + ' style="' + base + 'pointer-events:auto"><svg viewBox="' + t.vb + '" width="100%" height="100%" style="display:block;overflow:visible" fill="none" stroke="' + u.res(el.color) + '" stroke-width="' + t.g + '" stroke-linecap="round" stroke-linejoin="round">' + t.d + '</svg></div>';
  });
  // la insignia roja del corazón (cierre)
  LZ.tipo('cel-insignia', function (el, base, attrs, u) {
    return '<div ' + attrs + ' style="' + base + 'border-radius:24px;background:' + u.res(el.fondo) + ';display:grid;place-items:center;box-shadow:0 10px 24px ' + u.hexA(el.fondo, .35) + '">' + svg('heart', Math.round(el.h * .55), '#fff') + '</div>';
  });

  // parte el titular en dos renglones por la palabra más cercana a la mitad (si la IA no lo partió)
  function dosRenglones(t) {
    t = String(t || '').trim(); if (!t || t.indexOf('\n') >= 0) return t;
    var ps = t.split(/\s+/); if (ps.length < 2) return t;
    var mejor = 1, dif = 1e9, total = t.length;
    for (var i = 1; i < ps.length; i++) { var a = ps.slice(0, i).join(' ').length, d = Math.abs(a - (total - a)); if (d < dif) { dif = d; mejor = i; } }
    return ps.slice(0, mejor).join(' ') + '\n' + ps.slice(mejor).join(' ');
  }

  FAMILIAS.registrar('celular', {
    catalogo: {
      letras: { titular: 'Montserrat', mano: 'Montserrat', cuerpo: 'Montserrat' },
      colores: { principal: '#B9C88D', acento: '#E8413B', fondo: '#F3EFE6', texto: '#1E2A30' }
    },
    esquema: {
      nombre: 'Tendencia en celular', nItems: 3, iconos: U.ICONOS_OK,
      guia: 'Carrusel ANIMADO de formatos de reels para grabar: portada con tu clip a sangre y el titular; cada lámina del medio es UN formato con su nombre, qué es, para qué funciona y qué necesitas, y a la derecha corre un reel de ejemplo dentro de un celular. Sirve para ideas de reels, formatos y tendencias; no para motivación.',
      portada: {
        titular: { max: 26, desc: 'titular en dos renglones cortos (p. ej. «Reels que puedes grabar»)' },
        complemento: { max: 14, desc: 'remate corto debajo (p. ej. «esta semana»)' }
      },
      item: {
        titulo: { max: 22, desc: 'nombre del formato (p. ej. «Pantalla con voz», «Desde tu silla»)' },
        que: { max: 120, desc: 'qué es y cómo se graba, en segunda persona (p. ej. «Grabas tu pantalla mientras explicas algo con tu voz: una herramienta, una edición o un truco.»)' },
        porque: { max: 150, desc: 'para qué funciona y por qué, empezando por «Funciona muy bien para…» (p. ej. «Funciona muy bien para tutoriales y servicios porque la gente ve el paso a paso sin que salgas en cámara.»)' },
        como: { max: 80, desc: 'qué necesitas para hacerlo (p. ej. «Solo necesitas grabar la pantalla y hablar encima.»)' }
      },
      cierre: {
        texto: { max: 64, desc: 'llamada a comentar y guardar (p. ej. «Comenta cuál vas a grabar primero y guárdalo para esta semana»)' }
      },
      comun: {
        firma: { max: 26, desc: 'tu nombre o marca · el tema, sin @ con el nombre de la MARCA que te doy (p. ej. «Ana · contenido»)' },
        compartir: { max: 12, desc: 'palabra del pie a la izquierda (p. ej. «Compártelo»)' },
        guardar: { max: 12, desc: 'palabra del pie a la derecha (p. ej. «Guárdalo»)' }
      }
    },
    armar: function (c, mat, alto) {
      var H = alto || 1350;
      var fotos = (mat && mat.fotos) || [], clips = (mat && mat.clips) || [];
      c = c || {}; var po = c.portada || {}, ci = c.cierre || {}, co = c.comun || {};
      var usadas = [];
      var laminas = [portada()];
      (c.items || []).forEach(function (it, k) { laminas.push(interior(it || {}, k)); });
      laminas.push(cierre());
      return laminas;

      function video(clip, R, nombre, papel, z) {
        return { id: nid(), tipo: 'video', nombre: nombre, papel: papel, src: clip.video, poster: clip.url, ini: (clip.dur || 0) >= 7.5 ? 1 : 0, dur: 6,
          x: R.x, y: R.y, w: R.w, h: R.h, radio: R.r, posY: 50, sombra: false, borde: null, bw: 0, z: z, rot: 0, op: 1, ref: { clip: clip.id } };
      }

      function portada() {
        var els = [], y0 = 870, clip = clips[0] || null;
        if (clip) els.push(video(clip, { x: 0, y: 0, w: W, h: H, r: 0 }, 'Tu clip (portada)', 'clip-portada', 1));
        else {
          var f = U.mejorFoto(fotos, usadas);
          if (f) {
            usadas.push(f.id);
            var g = U.encuadre(f, W, H);
            els.push(U.fotoEl(f, g, { nombre: 'Tu foto (portada)', papel: 'foto-portada' }));
            // el titular va sobre el pecho: nunca encima de la cara
            if (g.cara) y0 = Math.min(1000, Math.max(y0, Math.round(g.cara[1] + g.cara[3] + 60)));
          }
        }
        var hay = els.length;
        var pila = { grupo: 'portada', x: 40, w: W - 80, y: y0, h: 0, gap: 11 };
        els.push(
          { id: nid(), tipo: 'forma', nombre: 'Sombra de abajo', papel: 'sombra', fondo: 'linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 75%,rgba(0,0,0,.6))', radio: 0, x: 0, y: 0, w: W, h: H, z: 10, rot: 0, op: 1 },
          T({ nombre: 'Titular', papel: 'titular-portada', txt: dosRenglones(po.titular), w: W - 80, alin: 'center', fuente: '@titular', tam: 112, peso: 800, interl: 1, espac: -.04, color: '#FFFFFF', sombra: true, z: 11, _pila: pila }),
          T({ nombre: 'Complemento', papel: 'complemento', txt: po.complemento || '', w: W - 80, alin: 'center', fuente: '@titular', tam: 80, peso: 800, interl: 1.22, espac: -.03, color: '#FFFFFF', sombra: true, z: 11, _pila: pila }),
          { id: nid(), tipo: 'cel-trazo', nombre: 'Flecha curva', papel: 'flecha', trazo: 'flecha', color: '#FFFFFF', x: 760, y: 1230, w: 150, h: 60, z: 11, rot: 0, op: 1 }
        );
        return { fondo: hay ? '#111111' : '@texto', els: els };
      }

      function interior(it, k) {
        var clip = clips.length ? clips[(k + 1) % clips.length] : null;
        var pila = { grupo: 'texto', x: 110, w: 410, y: 210, h: 0, gap: 42 };
        var parrafo = [it.que, it.porque, it.como].map(function (s) { return String(s || '').trim(); }).filter(Boolean).join('\n\n');
        var pantalla;
        if (clip) pantalla = video(clip, P, 'Tu clip (en el celular)', 'clip', 10);
        else if (fotos.length) { var f = fotos[(k + 1) % fotos.length]; pantalla = U.fotoEl(f, { x: P.x, y: P.y, w: P.w, h: P.h }, { nombre: 'Tu foto (en el celular)', papel: 'clip', radio: P.r, z: 10 }); }
        else pantalla = { id: nid(), tipo: 'forma', nombre: 'Pantalla del celular', papel: 'clip', fondo: '#2A2A2A', radio: P.r, x: P.x, y: P.y, w: P.w, h: P.h, z: 10, rot: 0, op: 1 };
        pantalla.grupo = 'celular';   // carcasa, pantalla e interfaz se mueven juntas
        var els = [
          { id: nid(), tipo: 'cel-marco', nombre: 'Marco', papel: 'marco', color: '@principal', bw: 3, radio: 26, x: 60, y: 110, w: 960, h: 1130, z: 2, rot: 0, op: 1 },
          T({ nombre: 'Firma', papel: 'firma', txt: co.firma || '', y: 48, fuente: '@cuerpo', tam: 22, peso: 700, interl: 1.22, color: GRIS, z: 3, _der: 1010 }),
          T({ nombre: 'Nombre del formato', papel: 'titulo', txt: it.titulo || '', w: 410, fuente: '@titular', tam: 46, peso: 800, interl: 1.05, espac: -.02, color: '@texto', z: 3, _pila: pila }),
          T({ nombre: 'Explicación', papel: 'parrafo', txt: parrafo, w: 395, fuente: '@cuerpo', tam: 28, peso: 500, interl: 1.32, color: '@texto', z: 3, _pila: pila }),
          { id: nid(), tipo: 'cel-cuerpo', nombre: 'Celular', papel: 'celular', grupo: 'celular', color: '#0E0E0E', x: P.x - 16, y: P.y - 16, w: P.w + 32, h: P.h + 160, z: 4, rot: 0, op: 1 },
          pantalla,
          { id: nid(), tipo: 'cel-interfaz', nombre: 'Interfaz del reel', papel: 'interfaz', grupo: 'celular', x: P.x, y: P.y, w: P.w, h: P.h, z: 20, rot: 0, op: 1 },
          // pie: «Compártelo ↗» a la izquierda y «Guárdalo 🔖» a la derecha (texto + ícono, cada uno se toca aparte)
          T({ nombre: 'Pie izquierdo', papel: 'pie-izq', txt: co.compartir || 'Compártelo', y: 1269, fuente: '@cuerpo', tam: 30, peso: 700, interl: 1.22, color: GRIS, z: 3, _fila: { grupo: 'pie', x: 70, gap: 14 } }),
          { id: nid(), tipo: 'cel-ico', nombre: 'Ícono compartir', papel: 'pie-icono', icono: 'forward', color: GRIS, y: 1268, w: 40, h: 40, x: 0, z: 3, rot: 0, op: 1, _fila: { grupo: 'pie', x: 70, gap: 14 } },
          T({ nombre: 'Pie derecho', papel: 'pie-der', txt: co.guardar || 'Guárdalo', y: 1269, fuente: '@cuerpo', tam: 30, peso: 700, interl: 1.22, color: GRIS, z: 3, _der: 956 }),
          { id: nid(), tipo: 'cel-ico', nombre: 'Ícono guardar', papel: 'pie-icono', icono: 'bookmark', color: GRIS, x: 970, y: 1268, w: 40, h: 40, z: 3, rot: 0, op: 1 }
        ];
        return { fondo: '@fondo', els: els };
      }

      function cierre() {
        return { fondo: '@fondo', els: [
          { id: nid(), tipo: 'cel-trazo', nombre: 'Corazón de fondo', papel: 'corazon', trazo: 'corazon', color: '#DCD6CB', x: -60, y: -80, w: 360, h: 360, z: 1, rot: 0, op: 1 },
          T({ nombre: 'Llamada', papel: 'texto-cierre', txt: ci.texto || '', x: 130, y: 420, w: 820, alin: 'center', fuente: '@titular', tam: 64, peso: 800, interl: 1.18, color: '#F6F4EC', caja: { fondo: '@principal', radio: 22, padV: 65, padH: 60 }, z: 3 }),
          { id: nid(), tipo: 'cel-insignia', nombre: 'Insignia del corazón', papel: 'insignia', fondo: '@acento', x: 850, y: 370, w: 120, h: 112, z: 4, rot: -12, op: 1 },
          { id: nid(), tipo: 'cel-trazo', nombre: 'Avión de papel', papel: 'avion', trazo: 'avion', color: GRIS, x: 120, y: 880, w: 110, h: 90, z: 2, rot: 0, op: 1 }
        ] };
      }
    }
  });
})();

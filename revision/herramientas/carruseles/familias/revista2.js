/* revista2.js — familia «Marca de revista» (copia del sistema de @mauriciozunigaan).
 * Marco redondeado fino en todas las láminas, cabecera «(NN) · NOMBRE · ROL · (AÑO)» y pie repartido de lado a lado
 * (letra de máquina). Titulares condensados en mayúscula, blanco con líneas en amarillo; textos cortos en mayúscula con
 * palabras de color; fondos negro / degradado rojo-naranja / azul noche; cierre «sobre mí.» con la foto en una píldora.
 * Regla 13: en la portada el titular va a la izquierda y la persona recortada va ADELANTE aunque tape parte de una palabra. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var W = 1080;

  // las letras se piden apenas carga el archivo: al medir (alto de los bloques, el año a la derecha) ya deben estar
  function precargar(letras, pesos) {
    letras.forEach(function (n) {
      LZ.cargarLetra(n);
      var l = document.querySelector('link[data-lz-letra="' + n + '"]');
      var ir = function () { pesos.forEach(function (p) { document.fonts.load(p + ' 40px "' + n + '"').catch(function () {}); }); };
      if (!l || l.sheet) ir(); else l.addEventListener('load', ir);
    });
  }
  precargar(['Anton'], ['400']); precargar(['Inter'], ['600', '700', '800', '900']); precargar(['JetBrains Mono'], ['500']);

  /* ── elementos propios de esta familia ── */
  // el marco fino redondeado (no atrapa los toques: se escoge desde Capas)
  LZ.tipo('revista2-marco', function (el, base, attrs, u) {
    return '<div ' + attrs + ' style="' + base + 'box-sizing:border-box;border:' + (el.grosor || 2) + 'px solid ' + u.res(el.color) + ';border-radius:' + (el.radio || 38) + 'px;pointer-events:none"></div>';
  });
  // el círculo amarillo con la flecha
  LZ.tipo('revista2-circulo', function (el, base, attrs, u) {
    var s = Math.round(Math.min(el.w, el.h) * .49);
    return '<div ' + attrs + ' style="' + base + 'border-radius:50%;background:' + u.res(el.fondo) + ';color:' + u.res(el.color) + ';display:grid;place-items:center">' + u.ico(el.icono || 'arrow-right', s).replace('stroke-width="2"', 'stroke-width="3"') + '</div>';
  });
  // la foto dentro de una píldora con borde, centrada en la cara (caja = [izq, arriba, ancho, alto] de la foto en fracciones)
  LZ.tipo('revista2-pildora', function (el, base, attrs, u) {
    var k = el.caja || [0, 0, 1, 1];
    return '<div ' + attrs + ' style="' + base + 'box-sizing:border-box;overflow:hidden;border-radius:' + (el.radio || 120) + 'px;border:' + (el.grosor || 3) + 'px solid ' + u.res(el.borde) + ';background:#222">' +
      '<img src="' + u.esc(el.src) + '" draggable="false" crossorigin="anonymous" style="position:absolute;left:' + (k[0] * 100) + '%;top:' + (k[1] * 100) + '%;width:' + (k[2] * 100) + '%;height:' + (k[3] * 100) + '%;max-width:none"></div>';
  });

  /* ── ayudas ── */
  function limpio(s) { return String(s || '').replace(/\*/g, ''); }
  // el titular condensado: respeta los saltos de línea que escribió la IA; si no hay, parte por palabras.
  // Devuelve el texto con \n y el tamaño que cabe en el ancho (la letra condensada mide ~0,40 em por letra).
  function titular(txt, base, ancho, maxLin) {
    txt = String(txt || '').trim();
    var lineas;
    if (txt.indexOf('\n') >= 0) lineas = txt.split(/\n+/);
    else {
      var tam = base;
      for (;;) {
        var cabe = Math.max(4, Math.floor(ancho / (.40 * tam)));
        lineas = partir(txt, cabe);
        if (lineas.length <= maxLin || tam < base * .55) break;
        tam -= 8;
      }
    }
    var larga = Math.max.apply(null, lineas.map(function (l) { return limpio(l).length; }).concat([1]));
    var t = Math.min(base, Math.floor(ancho / (.40 * larga)));
    if (lineas.length > maxLin) t = Math.min(t, Math.floor(base * maxLin / lineas.length));
    return { txt: lineas.join('\n'), tam: t, n: lineas.length };
  }
  function partir(txt, cabe) {
    var ps = txt.split(/\s+/), l = [], act = '';
    ps.forEach(function (p) { var prueba = act ? act + ' ' + p : p; if (act && limpio(prueba).length > cabe) { l.push(act); act = p; } else act = prueba; });
    if (act) l.push(act);
    return l;
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }

  FAMILIAS.registrar('revista2', {
    catalogo: {
      letras: { titular: 'Anton', mano: 'JetBrains Mono', cuerpo: 'Inter' },
      colores: { principal: '#FFD60A', acento: '#E1251B', fondo: '#000000', texto: '#FFFFFF' }
    },
    esquema: {
      nombre: 'Marca de revista', nItems: 5, iconos: U.ICONOS_OK,
      guia: 'Estilo de revista personal: frases fuertes y lecciones cortas con titulares condensados enormes y poco texto en mayúscula. Cada lámina del medio es UNA idea con su propia forma (titular, palabra gigante, dos conceptos, juego de palabras o contraste): varía la forma de una lámina a otra. Cierra con una lámina «sobre mí».',
      portada: {
        titular: { max: 44, desc: 'titular en 3 o 4 líneas cortas (máx. 11 letras por línea) separadas con salto de línea; las líneas que van en amarillo, entre asteriscos (p. ej. «Lo que\\n*aprendí*\\nllegando a\\n*50 mil*»)' },
        cinta: { max: 34, desc: 'frase corta de la cinta amarilla que invita a guardar (p. ej. «Guárdalo antes de que se te olvide»)' }
      },
      item: {
        forma: { max: 10, desc: 'cómo se arma la lámina, UNA de: «titular» (titular de 2 o 3 líneas + texto), «palabra» (una o dos palabras gigantes + texto), «dos» (dos conceptos, cada uno con su explicación), «juego» (una palabra repetida con una parte en gris + frase), «contraste» (lo que hay que dejar, en gris, contra lo que hay que hacer). No repitas la misma forma seguida.' },
        titulo: { max: 40, desc: 'titular. En «titular»: 2 o 3 líneas separadas con salto de línea y la del medio *resaltada* (p. ej. «El gancho\\n*vale más*\\nque la edición»). En «palabra»: 1 o 2 palabras (p. ej. «Pero ojo»). En «dos»: el primer concepto (p. ej. «Retención»). En «juego»: UNA palabra de máx. 9 letras (p. ej. «Paciencia»). En «contraste»: lo que hay que dejar (p. ej. «Deja de perseguir\\ncada tendencia»)' },
        texto: { max: 140, desc: 'el texto corto que acompaña, con lo importante *resaltado*; puede tener dos párrafos separados con salto de línea (p. ej. «Un video mal editado con un buen inicio *lo ven hasta el final*.»). En «contraste»: el ejemplo de lo que hay que dejar (p. ej. «Bailes, audios de moda, trucos del algoritmo…»)' },
        titulo2: { max: 36, desc: 'solo en «dos» (el segundo concepto, p. ej. «Alcance») y en «contraste» (lo que hay que hacer, con lo último *resaltado*, p. ej. «Y ponte a aprender\\n*ganchos, guion y retención.*»); vacío en las demás' },
        texto2: { max: 80, desc: 'solo en «dos»: la explicación del segundo concepto con la conclusión *resaltada* (p. ej. «Es a cuántos les llega. *Sin la primera, la segunda no crece.*»); vacío en las demás' },
        gris: { max: 8, desc: 'solo en «juego»: el pedazo del comienzo de la palabra que va en gris y cambia el sentido (p. ej. «Pa» de «Paciencia»); vacío en las demás' }
      },
      cierre: {
        titular: { max: 14, desc: 'dos palabras cortas en minúscula separadas con salto de línea (p. ej. «sobre\\nmí.»)' },
        rotulo: { max: 24, desc: 'rótulo de arriba en mayúscula (p. ej. «Sobre el creador»)' },
        boton: { max: 22, desc: 'botón con borde (p. ej. «Toca para seguirme»)' },
        saludo: { max: 18, desc: 'saludo corto (p. ej. «¡Mucho gusto!»)' },
        bio: { max: 150, desc: 'dos frases sobre quién eres y qué enseñas, en primera persona, sin @ usando el nombre de la MARCA que te doy (p. ej. «Soy Ana: enseño finanzas personales sin enredos. Aquí te cuento lo que me funciona.»)' }
      },
      comun: {
        firma: { max: 40, desc: 'nombre y rol para la cabecera, sin @ con el nombre de la MARCA que te doy y su tema (p. ej. «Ana Ruiz · Finanzas personales»)' },
        pie: { max: 26, desc: 'pie de 3 a 5 palabras cortas que se reparten de lado a lado (p. ej. «TIPS para crecer en IG»)' }
      }
    },
    armar: function (c, mat, alto) {
      var H = alto || 1350, items = c.items || [], fotos = (mat && mat.fotos) || [], usadas = [];
      var com = c.comun || {}, anio = String(new Date().getFullYear());
      var FORMAS = ['titular', 'dos', 'palabra', 'juego', 'contraste'];
      var laminas = [portada()];
      var previa = '';
      items.forEach(function (it, k) {
        var f = String(it.forma || '').toLowerCase().trim();
        if (FORMAS.indexOf(f) < 0) f = FORMAS[k % FORMAS.length];
        if (f === 'dos' && !it.titulo2) f = 'titular';
        if (f === 'contraste' && !it.titulo2) f = 'palabra';
        laminas.push(interior(it, k + 1, f)); previa = f;
      });
      laminas.push(cierre());
      return laminas;

      // el sistema que se repite: marco, cabecera y pie
      function sistema(els, k) {
        els.push({ id: nid(), tipo: 'revista2-marco', nombre: 'Marco', papel: 'marco', color: 'rgba(255,255,255,.55)', grosor: 2, radio: 38, x: 26, y: 26, w: W - 52, h: H - 52, z: 8, rot: 0, op: 1 });
        els.push(
          T({ nombre: 'Número de lámina', papel: 'cab-numero', txt: '(' + dos(k) + ')', x: 62, y: 52, tam: 20, peso: 700, espac: .02, color: '@texto', z: 9 }),
          T({ nombre: 'Nombre y rol', papel: 'cab-firma', txt: com.firma || '', x: 190, y: 52, w: 700, tam: 20, peso: 700, espac: .02, mayus: true, alin: 'center', color: '@texto', z: 9 }),
          T({ nombre: 'Año', papel: 'cab-anio', txt: '(' + anio + ')', y: 52, tam: 20, peso: 700, espac: .02, color: '@texto', z: 9, _der: W - 62 })
        );
        // el pie repartido de lado a lado (como justify): letra de máquina, ~0,6 em por letra
        var ps = String(com.pie || '').trim().split(/\s+/).filter(Boolean);
        if (ps.length) {
          var an = ps.map(function (p) { return p.length * 12; }), tot = an.reduce(function (a, b) { return a + b; }, 0);
          var hueco = ps.length > 1 ? (W - 124 - tot) / (ps.length - 1) : 0, x = 62;
          ps.forEach(function (p, i) {
            var e = T({ nombre: 'Pie «' + p + '»', papel: 'pie', txt: p, y: H - 50 - 26, fuente: '@mano', tam: 20, peso: 500, color: '@texto', op: .85, z: 9 });
            if (i === ps.length - 1 && ps.length > 1) e._der = W - 62; else e.x = Math.round(x);
            x += an[i] + hueco; els.push(e);
          });
        }
      }

      // la foto de portada: la que menos persona tiene detrás del titular (arriba a la izquierda), con recorte si se puede
      function fotoPortada() {
        var mejor = null, pm = -1e9;
        fotos.forEach(function (f) {
          if (!f || !f.w) return;
          var g = U.encuadre(f, W, H), m = U.mapa(f, g, W, H), p = 0;
          if (m) { var a = m.medir(62, 110, W - 124, 380), b = m.medir(62, 490, W - 124, 300); p -= a.persona * 3 + b.persona * 1.5; }
          if (f.recorte_url) p += .4;
          if (f.persona) p += .2;
          if (p > pm) { pm = p; mejor = f; }
        });
        return mejor;
      }

      function portada() {
        var els = [], pF = fotoPortada();
        if (pF) {
          usadas.push(pF.id);
          var g = U.encuadre(pF, W, H);
          var foto = U.fotoEl(pF, g, { brillo: .82, contraste: 1.05 });
          els.push(foto);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Sombra de arriba', papel: 'sombra', interno: true, de: foto.id, fondo: 'linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 55%)', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
          var rec = U.recorteEl(pF, g, { z: 4 }); if (rec) { rec.sigue = foto.id; els.push(rec); }
        }
        var t = titular((c.portada || {}).titular, 190, W - 124, 4);
        els.push(T({ nombre: 'Titular', papel: 'titular-portada', txt: t.txt, x: 62, y: 110, fuente: '@titular', tam: t.tam, peso: 400, mayus: true, interl: .9, espac: -.005, color: '@texto', colorAc: '@principal', sombra: true, z: 3 }));
        var yB = Math.min(H - 340, Math.max(110 + t.tam * .9 * t.n + 60, H - 430));
        if ((c.portada || {}).cinta) els.push(T({ nombre: 'Cinta amarilla', papel: 'cinta', txt: c.portada.cinta, x: 90, y: yB + 50, tam: 26, peso: 800, mayus: true, color: '#111111', caja: { fondo: '@principal', radio: 0, padV: 8, padH: 16 }, z: 6 }));
        els.push({ id: nid(), tipo: 'revista2-circulo', nombre: 'Botón de flecha', papel: 'circulo', fondo: '@principal', color: '#111111', icono: 'arrow-right', x: W - 90 - 110, y: yB, w: 110, h: 110, z: 6, rot: 0, op: 1 });
        sistema(els, 0);
        return { fondo: '@fondo', els: els };
      }

      // las láminas del medio: todo en una columna centrada (x 110–970) que se centra en alto al medir
      function interior(it, k, forma) {
        var els = [], fondo = '@fondo';
        var pila = { grupo: 'c', x: 110, w: W - 220, y: 120, h: H - 240, gap: 50 };
        var ancho = W - 220;
        function tit(txt, base, maxLin, extra, nombre, papel) {
          var t = titular(txt, base, ancho, maxLin);
          els.push(T(Object.assign({ nombre: nombre || 'Titular', papel: papel || 'titular', txt: t.txt, w: ancho, fuente: '@titular', tam: t.tam, peso: 400, mayus: true, interl: .9, espac: -.005, alin: 'center', color: '@texto', colorAc: '@principal', z: 5, _pila: pila }, extra || {})));
        }
        function chico(txt, nombre, papel, extra) {
          if (!txt) return;
          els.push(T(Object.assign({ nombre: nombre || 'Texto', papel: papel || 'texto', txt: String(txt).replace(/\n+/g, '\n\n'), w: ancho, tam: 36, peso: 700, mayus: true, interl: 1.28, espac: -.005, alin: 'center', color: '@texto', colorAc: '@principal', z: 5, _pila: pila }, extra || {})));
        }
        if (forma === 'titular') {
          tit(it.titulo, 150, 3); chico(it.texto); pila.gap = 60;
        } else if (forma === 'palabra') {
          tit(it.titulo, 190, 2, { color: '@principal' }); chico(it.texto); pila.gap = 60;
        } else if (forma === 'dos') {
          fondo = '@acento';
          els.push({ id: nid(), tipo: 'forma', nombre: 'Degradado del fondo', papel: 'degradado', fondo: 'linear-gradient(160deg,rgba(0,0,0,.2) 0%,rgba(0,0,0,0) 45%,rgba(255,214,53,.57) 100%)', x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1, radio: 0 });
          pila.gap = 30;
          tit(it.titulo, 160, 1, { color: '@principal' }, 'Concepto 1', 'concepto');
          chico(it.texto, 'Explicación 1', 'texto');
          els.push({ id: nid(), tipo: 'flecha', nombre: 'Brocha', papel: 'brocha', src: U.BASE + 'piezas/revista2/brocha.svg', color: '#F4B9B0', x: 110, y: 0, w: ancho, h: 34, z: 5, rot: 0, op: 1, _pila: pila });
          tit(it.titulo2, 160, 1, { color: '@principal' }, 'Concepto 2', 'concepto');
          chico(it.texto2, 'Explicación 2', 'texto');
        } else if (forma === 'juego') {
          var p = limpio(it.titulo).trim().split(/\s+/)[0] || '', gr = limpio(it.gris).trim(), i = gr ? p.toLowerCase().indexOf(gr.toLowerCase()) : -1;
          var seg = i >= 0 ? p.slice(0, i) + '*' + p.slice(i, i + gr.length) + '*' + p.slice(i + gr.length) : '*' + p.slice(0, Math.ceil(p.length / 4)) + '*' + p.slice(Math.ceil(p.length / 4));
          var tm = Math.min(230, Math.floor(ancho / (.40 * Math.max(1, p.length))));
          els.push(T({ nombre: 'Palabra repetida', papel: 'juego', txt: p + '\n' + seg, w: ancho, fuente: '@titular', tam: tm, peso: 400, mayus: true, interl: .9, espac: -.005, alin: 'center', color: '@texto', colorAc: '#555555', z: 5, _pila: pila }));
          if (it.texto) els.push(T({ nombre: 'Frase', papel: 'frase', txt: it.texto, w: ancho, tam: 30, peso: 600, interl: 1.35, alin: 'center', color: '@texto', colorAc: '@principal', modoAc: 'negrita', z: 5, _pila: pila }));
          pila.gap = 60;
        } else { // contraste
          fondo = 'radial-gradient(120% 90% at 80% 20%,#3a5a8c 0%,#15294a 45%,#0a1428 100%)';
          pila.gap = 34;
          tit(it.titulo, 120, 2, { color: '#6C7A92', colorAc: '#6C7A92' }, 'Lo que hay que dejar', 'titular-gris');
          if (it.texto) els.push(T({ nombre: 'Ejemplo', papel: 'ejemplo', txt: it.texto, w: ancho, tam: 30, peso: 600, interl: 1.3, alin: 'center', color: '#C8D2E4', colorAc: '@principal', z: 5, _pila: pila }));
          tit(it.titulo2, 130, 4, {}, 'Lo que hay que hacer', 'titular');
        }
        sistema(els, k);
        return { fondo: fondo, els: els };
      }

      function cierre() {
        var cc = c.cierre || {}, els = [], crema = '#FFF4E0';
        els.push({ id: nid(), tipo: 'forma', nombre: 'Degradado del fondo', papel: 'degradado', fondo: 'linear-gradient(160deg,rgba(0,0,0,.2) 0%,rgba(0,0,0,0) 45%,rgba(255,214,53,.57) 100%)', x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1, radio: 0 });
        els.push(
          { id: nid(), tipo: 'forma', nombre: 'Línea de arriba', papel: 'linea', fondo: 'rgba(255,255,255,.8)', x: 62, y: 70, w: W - 124, h: 2, z: 5, rot: 0, op: 1, radio: 0 },
          T({ nombre: 'Rótulo', papel: 'rotulo-cierre', txt: cc.rotulo || '', x: 62, y: 82, tam: 18, peso: 700, mayus: true, color: '@texto', z: 5 }),
          { id: nid(), tipo: 'forma', nombre: 'Línea de abajo', papel: 'linea', fondo: 'rgba(255,255,255,.8)', x: 62, y: 112, w: W - 124, h: 2, z: 5, rot: 0, op: 1, radio: 0 }
        );
        var ps = String(cc.titular || 'sobre\nmí.').trim().split(/\n+|\s+/);
        var l1 = ps[0] || '', l2 = ps.slice(1).join(' ');
        var tg = Math.min(300, Math.floor((W - 104) / (.52 * Math.max(1, l1.length))));
        els.push(T({ nombre: 'Titular (1)', papel: 'titular-cierre', txt: l1, x: 52, y: 150, fuente: '@cuerpo', tam: tg, peso: 900, interl: .8, espac: -.07, color: crema, z: 5 }));
        if (l2) els.push(T({ nombre: 'Titular (2)', papel: 'titular-cierre', txt: l2, x: 52, y: 150 + Math.round(tg * .867), fuente: '@cuerpo', tam: tg, peso: 900, interl: .8, espac: -.07, color: crema, z: 5 }));
        // la foto en la píldora, centrada en la cara
        var pF = U.mejorFoto(fotos.filter(function (f) { return f.cara; }), usadas) || U.mejorFoto(fotos, usadas);
        if (pF) {
          // la cara ocupa ~1/3 del alto de la píldora (cabeza y hombros, como la referencia), sin dejar bordes vacíos
          var pw = 420, ph = 230, esc = Math.max(pw / pF.w, ph / pF.h, Math.min(2.6 * pw / pF.w, pF.cara ? .32 * ph / pF.cara[3] : 9)), dw = pF.w * esc, dh = pF.h * esc;
          var cx = pF.cara ? pF.cara[0] + pF.cara[2] / 2 : pF.persona ? pF.persona[0] + pF.persona[2] / 2 : pF.w / 2;
          var cy = pF.cara ? pF.cara[1] + pF.cara[3] / 2 : pF.persona ? pF.persona[1] + pF.persona[3] * .15 : pF.h / 3;
          var lx = Math.min(0, Math.max(pw - dw, pw / 2 - cx * esc)), ly = Math.min(0, Math.max(ph - dh, ph / 2 - cy * esc));
          els.push({ id: nid(), tipo: 'revista2-pildora', nombre: 'Tu foto en la píldora', papel: 'pildora', src: pF.url, ref: { foto: pF.id, campo: 'foto' }, caja: [lx / pw, ly / ph, dw / pw, dh / ph], borde: crema, grosor: 3, radio: 120, x: 560, y: 430, w: pw, h: ph, z: 5, rot: 0, op: 1 });
        }
        els.push(T({ nombre: 'Botón seguir', papel: 'boton', txt: cc.boton || '', x: 62, y: 760, tam: 26, peso: 700, mayus: true, color: crema, caja: { borde: crema, bw: 3, radio: 999, padV: 12, padH: 30 }, z: 5 }));
        els.push(T({ nombre: 'Saludo', papel: 'saludo', txt: cc.saludo || '', x: 62, y: H - 380, fuente: '@cuerpo', tam: 64, peso: 800, espac: -.03, color: crema, z: 5 }));
        els.push(T({ nombre: 'Sobre ti', papel: 'bio', txt: cc.bio || '', x: 62, y: H - 290, w: W - 62 - 180, tam: 28, peso: 600, interl: 1.35, color: crema, z: 5 }));
        return { fondo: '@acento', els: els };
      }
    }
  });
})();

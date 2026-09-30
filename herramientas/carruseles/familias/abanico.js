/* abanico.js — familia «Abanico de pantallas» (copia de «Curious what else I've created?», aprobada el 30-sep).
 * Hoja blanca sobre gris, etiqueta de color arriba, titular centrado con UNA parte *resaltada* en el acento, texto corto
 * y debajo las pantallas en curva (giradas en 3D, como un abanico) con su rótulo. Hecha para MOSTRAR capturas: de la
 * app, de tus videos, de resultados. Cada lámina lleva de 1 a 5 pantallas; si el contenido trae `paneles` (direcciones)
 * se usan esas, si no se toman las fotos y clips del material en orden. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var W = 1080;
  ['Inter'].forEach(function (n) { LZ.cargarLetra(n); });

  // cuántas líneas ocupa un texto (aprox.: ancho medio de la letra ≈ .53 del tamaño)
  function lineas(txt, tam, ancho) {
    var ps = String(txt || '').replace(/\*/g, '').split(/\s+/), cabe = ancho / (.5 * tam), n = 1, act = 0;
    ps.forEach(function (p) { var l = p.length + (act ? 1 : 0); if (act && act + l > cabe) { n++; act = p.length; } else act += l; });
    return n;
  }
  // forma de la fila según cuántas pantallas: ancho, alto, separación y giro de cada una
  // lo que cambia de un estilo de color a otro, pieza por pieza
  function tocar(e, modoTitular, colorRotulos, colorFlecha, bordeBoton) {
    if (e.papel === 'titular') e.modoAc = modoTitular;
    if (e.papel === 'etiqueta' || e.papel === 'rotulo') e.color = colorRotulos;
    if (e.papel === 'boton-flecha') e.color = colorFlecha;
    if (e.papel === 'boton-fondo') { e.fondo = '@principal'; e.borde = bordeBoton; }
    // los grises de antes iban fijos (carruseles armados antes del 30-sep): se pasan al color del texto
    if (e.tipo === 'texto' && /^#(5A5A5A|666666|AAAAAA|BDBDBD|A6A6A6|6E6E6E)$/i.test(e.color || '')) {
      e.op = e.papel === 'numero' ? .38 : e.papel === 'rotulo-texto' ? .62 : .72; e.color = '@texto';
    }
  }
  var FILAS = {
    1: { w: 760, h: 476, gap: 0, ry: [0] },
    2: { w: 324, h: 581, gap: 32, ry: [14, -14] },
    3: { w: 259, h: 460, gap: 15, ry: [22, 0, -22] },
    4: { w: 190, h: 338, gap: 15, ry: [26, 10, -10, -26] },
    5: { w: 167, h: 297, gap: 15, ry: [36, 17, 0, -17, -36] },
  };

  FAMILIAS.registrar('abanico', {
    catalogo: {
      letras: { titular: 'Inter', mano: 'Inter', cuerpo: 'Inter' },
      colores: { principal: '#FFFFFF', acento: '#C62F45', fondo: '#E8E8E8', texto: '#141414' },
      /* (30-sep) «Estilo de color»: cuatro formas de usar TU color (m) para que siempre se lea. Sergio, con su amarillo
         claro: «me encantan las 3, aplica las 3 con un selector». Cada una deja TODO lo que toca en su sitio (así se puede
         pasar de una a otra y volver) y no vuelve a armar las láminas: los cambios hechos a mano se quedan. */
      temas: {
        claro: { nombre: 'Claro', kit: function (m) { return { fondo: '#E8E8E8', principal: '#FFFFFF', texto: '#141414', acento: m }; },
          ajustar: function (e, m, claro) { tocar(e, 'color', '@acento', claro ? '#141414' : '#FFFFFF', '#DDDDDD'); } },
        oscuro: { nombre: 'Oscuro', kit: function (m) { return { fondo: '#0E0E0E', principal: '#1A1A1A', texto: '#FFFFFF', acento: m }; },
          ajustar: function (e, m, claro) { tocar(e, 'color', '@acento', claro ? '#141414' : '#FFFFFF', '#3A3A3A'); } },
        marco: { nombre: 'Marco de color', kit: function (m, claro) { return { fondo: m, principal: '#FFFFFF', texto: '#141414', acento: claro ? '#141414' : m }; },
          ajustar: function (e, m, claro) { tocar(e, 'color', '@acento', claro ? m : '#FFFFFF', '#DDDDDD'); } },
        resaltador: { nombre: 'Resaltador', kit: function (m) { return { fondo: '#E8E8E8', principal: '#FFFFFF', texto: '#141414', acento: m }; },
          ajustar: function (e, m, claro) { tocar(e, claro ? 'marcador' : 'color', claro ? '@texto' : '@acento', claro ? '#141414' : '#FFFFFF', '#DDDDDD'); } },
      },
    },
    esquema: {
      nombre: 'Abanico de pantallas', nItems: 5, iconos: U.ICONOS_OK,
      guia: 'Para MOSTRAR cosas (una app, resultados, pantallas, tus videos): cada lámina tiene una etiqueta corta, un titular claro con UNA parte *resaltada* y debajo varias pantallas con su rótulo. Pocas palabras: la imagen explica. El cierre invita a comentar.',
      portada: {
        etiqueta: { max: 24, desc: 'etiqueta corta de arriba (p. ej. «Retención», «Detrás de mi app»)' },
        titular: { max: 60, desc: 'el gancho de la portada con UNA parte *resaltada* al final (p. ej. «A Instagram no le importa si tu video es *bonito*»)' },
        texto: { max: 80, desc: 'una frase corta que completa el titular, con lo importante *en negrita*' },
      },
      item: {
        etiqueta: { max: 26, desc: 'etiqueta corta de arriba' },
        titular: { max: 50, desc: 'lo que enseña esta lámina, con UNA parte *resaltada*' },
        texto: { max: 90, desc: 'una o dos frases cortas, lo importante *en negrita* (puede ir vacío)' },
        rotulos: { lista: 3, desc: '2 o 3 rótulos, uno por pantalla', campos: { t: { max: 18, desc: 'lo principal (p. ej. «Paso 1», «#01», «937»)' }, s: { max: 36, desc: 'lo que es (p. ej. «La estructura», «vistas»)' } } },
      },
      cierre: {
        etiqueta: { max: 24, desc: 'etiqueta corta' },
        titular: { max: 60, desc: 'la pregunta o invitación final con UNA parte *resaltada*' },
        texto: { max: 80, desc: 'qué recibe si comenta, lo importante *en negrita*' },
        boton: { max: 26, desc: 'botón (p. ej. «Comenta aquí abajo»)' },
      },
      comun: {}
    },
    armar: function (c, mat, alto) {
      var H = alto || 1350, fotos = [].concat((mat && mat.fotos) || [], (mat && mat.clips) || []), k = 0;
      var sig = function () { if (!fotos.length) return null; var f = fotos[k % fotos.length]; k++; return f; };
      var items = c.items || [], total = items.length + 2, laminas = [];
      laminas.push(lamina(c.portada || {}, 0, 'portada'));
      items.forEach(function (it, i) { laminas.push(lamina(it || {}, i + 1, 'item')); });
      laminas.push(lamina(c.cierre || {}, total - 1, 'cierre'));
      return laminas;

      function lamina(d, idx, tipo) {
        var els = [];
        els.push({ id: nid(), tipo: 'forma', nombre: 'Hoja', papel: 'hoja', fondo: '@principal', radio: 13, sombra: 2, x: 54, y: 86, w: W - 108, h: H - 172, z: 1, rot: 0, op: 1 });
        var y = 172;
        if (d.etiqueta) els.push(T({ nombre: 'Etiqueta', papel: 'etiqueta', txt: d.etiqueta, x: 90, y: y, w: W - 180, alin: 'center', fuente: '@cuerpo', tam: 26, peso: 700, color: '@acento', z: 5 }));
        y += 54;
        var tt = tipo === 'item' ? 65 : 71, tw = tipo === 'item' ? 860 : 842, lt = lineas(d.titular, tt, tw);
        els.push(T({ nombre: 'Titular', papel: 'titular', txt: d.titular || '', x: Math.round((W - tw) / 2), y: y, w: tw, alin: 'center', fuente: '@titular', tam: tt, peso: 700, interl: 1.08, espac: -.025, color: '@texto', colorAc: '@acento', modoAc: 'color', z: 5 }));
        y += Math.round(lt * tt * 1.08) + 30;
        if (d.texto) {
          var lx = lineas(d.texto, 28, 760);
          els.push(T({ nombre: 'Texto', papel: 'texto', txt: d.texto, x: 160, y: y, w: 760, alin: 'center', fuente: '@cuerpo', tam: 28, peso: 400, interl: 1.4, color: '@texto', op: .72, colorAc: '@texto', modoAc: 'negrita', z: 5 }));
          y += Math.round(lx * 28 * 1.4) + 34;
        }
        if (d.boton || tipo === 'portada') {
          var bt = d.boton || 'Desliza', bw = Math.round(bt.length * 13.5) + 118, bx = Math.round((W - bw) / 2);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Botón', papel: 'boton-fondo', grupo: 'boton', fondo: '@principal', borde: '#DDDDDD', bw: 2, radio: 999, x: bx, y: y, w: bw, h: 64, z: 5, rot: 0, op: 1 });
          els.push(T({ nombre: 'Botón · texto', papel: 'boton', grupo: 'boton', txt: bt, x: bx + 32, y: y + 17, tam: 23, peso: 600, color: '@texto', z: 6 }));
          els.push({ id: nid(), tipo: 'forma', nombre: 'Botón · círculo', papel: 'boton-circulo', grupo: 'boton', fondo: '@acento', radio: 999, x: bx + bw - 54, y: y + 12, w: 40, h: 40, z: 6, rot: 0, op: 1 });
          els.push(T({ nombre: 'Botón · flecha', papel: 'boton-flecha', grupo: 'boton', txt: tipo === 'cierre' ? '↓' : '›', x: bx + bw - 54, y: y + 14, w: 40, alin: 'center', tam: 25, peso: 700, color: '#FFFFFF', z: 7 }));
          y += 64 + 50;
        } else y += 10;
        // las pantallas
        var pan = Array.isArray(d.paneles) && d.paneles.length ? d.paneles.slice(0, 5) : null;
        var n = pan ? pan.length : tipo === 'portada' ? 5 : tipo === 'cierre' ? 3 : Math.max(2, Math.min(3, (d.rotulos || []).length || 3));
        var src = [];
        for (var i = 0; i < n; i++) { var s = pan ? pan[i] : (sig() || {}).url; if (s) src.push(typeof s === 'string' ? { src: s } : s); }
        n = src.length;
        if (n) {
          var F = FILAS[n], rot = d.rotulos || [], conRot = rot.some(function (r) { return r && (r.t || r.s); });
          var libre = H - 86 - 40 - y - (conRot ? 120 : 0) - (tipo === 'item' ? 30 : 0), esc = Math.min(1, libre / F.h);
          var pw = Math.round(F.w * esc), ph = Math.round(F.h * esc), gap = Math.round(F.gap * esc), anchoT = n * pw + (n - 1) * gap, x0 = Math.round((W - anchoT) / 2);
          src.forEach(function (p, j) {
            els.push({ id: nid(), tipo: 'imagen', nombre: 'Pantalla ' + (j + 1), papel: 'pantalla', src: p.src, foto: p.foto || null, ref: p.ref || null, x: x0 + j * (pw + gap), y: y, w: pw, h: ph, ry: F.ry[j], posY: 0, radio: 17, sombra: true, z: 4 + (j === Math.floor(n / 2) ? 1 : 0), rot: 0, op: 1, zoom: 1, brillo: 1, contraste: 1, sat: 1 });
            var r = rot[j];
            if (r && (r.t || r.s)) {
              var cx = x0 + j * (pw + gap) + pw / 2, rw = Math.max(pw + gap, 200);
              if (r.t) els.push(T({ nombre: 'Rótulo ' + (j + 1), papel: 'rotulo', txt: r.t, x: Math.round(cx - rw / 2), y: y + ph + 30, w: rw, alin: 'center', tam: 23, peso: 700, color: '@acento', z: 5 }));
              if (r.s) els.push(T({ nombre: 'Rótulo ' + (j + 1) + ' · texto', papel: 'rotulo-texto', txt: r.s, x: Math.round(cx - rw / 2), y: y + ph + 62, w: rw, alin: 'center', tam: 21, peso: 400, interl: 1.3, color: '@texto', op: .62, z: 5 }));
            }
          });
        }
        if (d.nota) els.push(T({ nombre: 'Nota', papel: 'nota', txt: d.nota, x: 160, y: H - 86 - 110, w: 760, alin: 'center', tam: 24, peso: 400, interl: 1.4, color: '@texto', op: .72, z: 5 }));
        if (tipo === 'item') els.push(T({ nombre: 'Número', papel: 'numero', txt: (idx + 1) + '/' + total, x: W - 86 - 120, y: H - 86 - 60, w: 120, alin: 'right', tam: 19, peso: 600, color: '@texto', op: .38, z: 5 }));
        return { fondo: '@fondo', els: els };
      }
    }
  });
})();

/* marca.js — familia «Te escribió una marca» (copia de @pauufukuda: «Si la marca te dice: ¿cuánto cobras?»).
   Cada situación son DOS láminas: (A) tu foto con «Si una marca te dice:», la burbuja del chat con el corazón de
   reacción y un papel rasgado con lo que NO hay que hacer; (B) la ventana de «Nuevo mensaje» con la respuesta, sobre
   otra foto. Cierra con una hoja rayada escrita a mano y un papel vertical sobre una foto. La burbuja nunca tapa la cara. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  /* ═══ común de foto-texto (inicio) ═══ */
  /* ── Lo común de las familias con texto sobre foto (va igual en marca.js, cintas.js y brillo.js; se registra una vez) ──
     · 'eco-texto': copia EXACTA (mismas letras, mismo ancho, mismos renglones) de un texto de la lámina, pegada a él con
       `sigue`. Sirve para lo que un texto solo no puede: cintas de color detrás de cada renglón, tarjeta que abraza el
       texto, sombra de una burbuja, resplandor de color y letras con degradado metálico. El texto de verdad sigue siendo
       un elemento «texto» normal (se toca, se escribe encima, se le cambia la letra): el eco lo lee en vivo.
     · FTX.zonas(foto, g, W, H): las zonas libres de la foto (sin persona ni cara), igual que detectar.py. */
  if (!window.FTX) {
    window.FTX = (function () {
      var CAMPOS = ['txt', 'fuente', 'tam', 'peso', 'cursiva', 'interl', 'espac', 'mayus', 'alin', 'color', 'colorAc', 'modoAc', 'caja', 'oculto'];
      function vivo(el) {   // el texto al que sigue, en el carrusel que está en el editor (si está)
        var v = null;
        try { (LZ.laminas || []).some(function (l) { return l.els.some(function (e) { if (e.id === el.sigue) { v = e; return true; } return false; }); }); } catch (e) { v = null; }
        if (v) { var c = {}; CAMPOS.forEach(function (k) { if (v[k] !== undefined) c[k] = JSON.parse(JSON.stringify(v[k])); }); el.copia = c; }
        return el.copia || {};
      }
      function copiaDe(t) { var c = {}; CAMPOS.forEach(function (k) { if (t[k] !== undefined) c[k] = JSON.parse(JSON.stringify(t[k])); }); return c; }
      function hex(v) { var m = /^#([0-9a-f]{6})$/i.exec(v || ''); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16, n >> 8 & 255, n & 255]; }
      function mezcla(v, con, t) { var a = hex(v) || [225, 37, 27]; return 'rgb(' + a.map(function (x, i) { return Math.round(x + (con[i] - x) * t); }).join(',') + ')'; }
      LZ.tipo('eco-texto', function (el, base, attrs, u) {
        var b = vivo(el), modo = el.modo || 'brillo';
        if (b.oculto || !b.txt) return '<div ' + attrs + ' style="' + base + 'display:none"></div>';
        var letra = "font-family:'" + u.res(b.fuente) + "',sans-serif;font-size:" + b.tam + 'px;font-weight:' + b.peso + ';font-style:' + (b.cursiva ? 'italic' : 'normal') + ';line-height:' + b.interl + ';letter-spacing:' + (b.espac || 0) + 'em;text-transform:' + (b.mayus ? 'uppercase' : 'none') + ';text-align:' + (b.alin || 'left') + ';white-space:' + (el.w === 'auto' || el.w == null ? 'pre' : 'normal') + ';pointer-events:none;color:transparent;';
        var pesoAc = (b.modoAc === 'negrita' || b.modoAc === 'marcador') ? 'font-weight:800;' : '';
        // con color de verdad (cinta y tarjeta): si el eco queda delante del texto, se ve igual
        var vis = 'color:' + u.res(b.color) + ';', visAc = b.modoAc === 'marcador' ? '' : 'color:' + u.res(b.colorAc) + ';';
        function txt(estAc) { return u.esc(b.txt).replace(/\*([^*]+)\*/g, '<span style="' + pesoAc + (estAc || '') + '">$1</span>').replace(/\n/g, '<br>'); }
        var col = u.res(el.color || '@principal'), c = b.caja || {};
        if (modo === 'brillo') {   // resplandor del color detrás de las letras (todo el texto o solo lo *resaltado*)
          var r = el.radio || 30, halo = 'text-shadow:0 0 ' + r + 'px ' + u.hexA(col, el.fuerza || .8) + ',0 0 ' + (r * 2) + 'px ' + u.hexA(col, (el.fuerza || .8) * .75) + ';';
          return '<div ' + attrs + ' style="' + base + letra + (el.soloAcento ? '' : halo) + '">' + txt(el.soloAcento ? halo : '') + '</div>';
        }
        if (modo === 'metal') {    // letras con degradado metálico del color + resplandor (va ENCIMA del texto)
          var gr = 'linear-gradient(180deg,' + mezcla(col, [255, 255, 255], .62) + ' 0%,' + mezcla(col, [255, 255, 255], .18) + ' 30%,' + col + ' 55%,' + mezcla(col, [0, 0, 0], .51) + ' 100%)';
          return '<div ' + attrs + ' style="' + base + letra + 'background:' + gr + ';-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 28px ' + u.hexA(col, .55) + ') drop-shadow(0 6px 0 rgba(0,0,0,.6))">' + txt() + '</div>';
        }
        if (modo === 'cinta') {    // una cinta de color detrás de CADA renglón (box-decoration-break: clone)
          var ancho = el.w === 'auto' || el.w == null ? '' : 'width:calc(' + el.w + 'px + .44em);';
          return '<div ' + attrs + ' style="' + base + letra + ancho + 'margin-left:-.22em;' + vis + '"><span style="background:' + u.hexA(el.fondo || '@principal', el.opFondo == null ? .88 : el.opFondo) + ';-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:.02em .22em">' + txt(visAc) + '</span></div>';
        }
        if (modo === 'tarjeta') {  // tarjeta que abraza el texto (el texto lleva una caja transparente con el mismo relleno)
          return '<div ' + attrs + ' style="' + base + letra + '"><span style="display:inline-block;vertical-align:top;box-sizing:border-box;max-width:100%;padding:' + (c.padV || 0) + 'px ' + (c.padH || 0) + 'px;border-radius:' + (c.radio || 0) + 'px;background:' + u.res(el.fondo || '#FFFFFF') + ';box-shadow:' + (el.sombra || '0 14px 30px rgba(0,0,0,.25)') + ';text-align:' + (b.alin || 'left') + ';' + vis + '">' + txt(visAc) + '</span></div>';
        }
        if (modo === 'sombra') {   // la sombra de un texto con caja (burbuja): misma caja, solo la sombra
          return '<div ' + attrs + ' style="' + base + letra + 'box-sizing:border-box;padding:' + (c.padV || 0) + 'px ' + (c.padH || 0) + 'px;border-radius:' + (c.radio || 0) + 'px;box-shadow:' + (el.sombra || '0 20px 50px rgba(0,0,0,.25)') + '">' + txt() + '</div>';
        }
        return '';
      });
      // un eco pegado al texto t (detrás: z-1; encima: z+1). No se selecciona: al tocarlo se toca el texto.
      function eco(t, modo, extra) {
        return Object.assign({ id: LZ.nid(), tipo: 'eco-texto', modo: modo, nombre: 'Efecto de «' + (t.nombre || 'texto') + '»', papel: 'eco-' + modo, interno: true, sigue: t.id, copia: copiaDe(t),
          x: t.x, y: t.y, w: t.w, rot: t.rot || 0, z: t.z + (modo === 'metal' ? 1 : -1), op: 1 }, extra || {});
      }

      /* zonas libres (copia de detectar.py con la rejilla de la Lambda) */
      function dec(b64) { var s = atob(b64 || ''), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
      function zonas(f, g, W, H) {
        var M = 60, R = f && f.rejilla, per = R ? dec(R.persona) : null, cm = null;
        if (g && g.cara) { var k = g.cara; cm = [k[0] - k[2] * .35, k[1] - k[3] * .45, k[2] * 1.7, k[3] * 1.675]; }
        function ocup(x, y) {
          if (cm && x >= cm[0] && x < cm[0] + cm[2] && y >= cm[1] && y < cm[1] + cm[3]) return 2;
          if (!per) return 0;
          var fx = (x - g.x) / g.w, fy = (y - g.y) / g.h; if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return 0;
          return per[Math.floor(fy * R.h) * R.w + Math.floor(fx * R.w)] / 255 > .35 ? 1 : 0;
        }
        var out = [], cand = {
          'arriba': [M, M, W - 2 * M, Math.round(H * .30)], 'abajo': [M, Math.round(H * .68), W - 2 * M, Math.round(H * .32) - M],
          'izquierda': [M, M, Math.round(W * .46), H - 2 * M], 'derecha': [Math.round(W * .54) - M, M, Math.round(W * .46), H - 2 * M] };
        Object.keys(cand).forEach(function (n) {
          var r = cand[n], np = 0, nc = 0, t = 0;
          for (var y = r[1]; y < r[1] + r[3]; y += 12) for (var x = r[0]; x < r[0] + r[2]; x += 12) { var o = ocup(x, y); if (o === 1) np++; if (o === 2) nc++; t++; }
          var libre = Math.max(0, 1 - np / t - nc / t * 2); if (nc / t > .02) libre *= .15;
          out.push({ zona: n, x: r[0], y: r[1], w: r[2], h: r[3], libre: libre, lado: n === 'izquierda' ? 'izq' : n === 'derecha' ? 'der' : 'centro', puntaje: libre * (.5 + r[2] * r[3] / (W * H)) });
        });
        [['arriba-libre', .04, .34], ['medio-libre', .34, .64], ['abajo-libre', .64, .96]].forEach(function (b) {
          var ya = Math.round(H * b[1]), yb = Math.round(H * b[2]), cols = [];
          for (var x = 0; x < W; x += 6) { var n = 0, t = 0; for (var y = ya; y < yb; y += 8) { if (ocup(x, y)) n++; t++; } cols.push(n / t > .015); }
          var mejor = [0, 0], ini = null;
          for (var i = 0; i <= cols.length; i++) { var lib = i < cols.length && !cols[i]; if (lib && ini === null) ini = i; if (!lib && ini !== null) { if (i - ini > mejor[1] - mejor[0]) mejor = [ini, i]; ini = null; } }
          var a0 = mejor[0] * 6, b0 = Math.min(W, mejor[1] * 6);
          var a = Math.max(M, a0 + (a0 > 0 ? 30 : 0)), bb = Math.min(W - M, b0 - (b0 < W ? 30 : 0));
          if (bb - a < 260) return;
          var c = (a + bb) / 2;
          out.push({ zona: b[0], x: a, y: ya, w: bb - a, h: yb - ya, libre: 1, lado: c < W * .42 ? 'izq' : c > W * .58 ? 'der' : 'centro', puntaje: .6 + (bb - a) * (yb - ya) / (W * H) });
        });
        return out.sort(function (p, q) { return q.puntaje - p.puntaje; });
      }
      function zona(zs, prefs) {
        for (var i = 0; i < prefs.length; i++) { var z = zs.filter(function (o) { return o.zona === prefs[i]; })[0]; if (z && z.libre > .5) return z; }
        return zs.filter(function (o) { return o.libre > .3; })[0] || zs[0];
      }
      // ¿cuánta persona hay en un rectángulo de la lámina? (0–1)
      function persona(f, g, W, H, x, y, w, h) { var m = f && FAMILIAS.util.mapa(f, g, W, H); return m ? m.medir(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).persona : 0; }
      return { eco: eco, zonas: zonas, zona: zona, persona: persona, mezcla: mezcla };
    })();
  }
  var FTX = window.FTX;
  /* ═══ común de foto-texto (fin) ═══ */

  var TINTA = '#1c1c1e', GRIS = '#8e8e93', BOLI = '#1d2a4a';
  // la serifa cursiva de la nota viene en cursiva de verdad (el cargador general pide pesos que esta letra no tiene)
  if (!document.querySelector('link[data-marca-serifa]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.marcaSerifa = '1'; l.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap'; document.head.appendChild(l); }

  /* piezas propias: papel rasgado, corazón de reacción y la ventana del correo */
  LZ.tipo('marca-papel', function (el, base, attrs, u) {
    return '<div ' + attrs + ' style="' + base + 'background:url(' + u.esc(el.src) + ') center/100% 100% no-repeat;filter:drop-shadow(0 10px 16px rgba(0,0,0,.35))"></div>';
  });
  LZ.tipo('marca-corazon', function (el, base, attrs, u) {
    var s = Math.round(el.w * .55);
    return '<div ' + attrs + ' style="' + base + 'border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.2)"><svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '"><path fill="' + u.res(el.color || '#FF2D55') + '" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>';
  });
  LZ.tipo('marca-correo', function (el, base, attrs, u) {
    var f = "font-family:'" + u.res(el.fuente || '@cuerpo') + "',sans-serif;";
    var fila = function (h, extra) { return '<div style="position:absolute;left:0;right:0;top:' + h[0] + 'px;height:' + h[1] + 'px;border-bottom:1.5px solid #e6e6ea;' + (extra || '') + '"></div>'; };
    var ic = function (n) { return !(window.ICONOS && ICONOS[n]) ? '' : '<span style="display:inline-flex;color:' + GRIS + '">' + u.ico(n, 34) + '</span>'; };
    return '<div ' + attrs + ' style="' + base + 'background:#fff;border-radius:34px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden;' + f + 'color:' + TINTA + '">' +
      fila([0, 100], 'display:flex;justify-content:space-between;align-items:center;padding:0 40px;font-weight:700;font-size:34px;line-height:1.38') +
      '<div style="position:absolute;left:40px;right:40px;top:0;height:100px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:34px">' + u.esc(el.titulo || 'Nuevo mensaje') + '<span style="display:inline-flex;color:#aaa">' + u.ico('x', 32) + '</span></div>' +
      fila([100, 103]) + fila([203, 103]) +
      '<div style="position:absolute;left:40px;right:40px;bottom:34px;display:flex;justify-content:space-between;align-items:center"><span style="display:flex;gap:28px">' + ic('paperclip') + ic('mic') + ic('plus') + '</span><b style="color:#0A84FF;font-size:32px;font-weight:700">' + u.esc(el.enviar || 'ENVIAR') + '</b></div></div>';
  });

  // cuántos renglones ocupa un texto en un ancho (para medir papeles antes de que carguen las letras)
  function renglones(t, tam, ancho, k) {
    return String(t || '').replace(/\*/g, '').split('\n').reduce(function (s, p) { return s + Math.max(1, Math.ceil(p.length * tam * (k || .52) / ancho)); }, 0);
  }

  FAMILIAS.registrar('marca', {
    catalogo: {
      letras: { titular: 'Instrument Serif', mano: 'Caveat', cuerpo: 'Inter' },
      colores: { principal: '#E1251B', acento: '#FF2D55', fondo: '#111111', texto: '#1C1C1E' },
    },
    esquema: {
      nombre: 'Te escribió una marca', nItems: 3, iconos: U.ICONOS_OK,
      guia: 'Carrusel de SITUACIONES: cada situación son dos láminas, primero lo que te escriben (un título corto, el mensaje tal cual en una burbuja de chat y una nota en papel con lo que NO debes hacer) y después la respuesta que sí conviene, escrita como un correo. Sirve para objeciones, negociación y consejos por situación. Cierra con una regla simple escrita a mano y un papel que invita a guardar y comentar.',
      portada: {},
      item: {
        titulo: { max: 24, desc: 'cómo arranca la situación, terminado en dos puntos (p. ej. «Si una marca te dice:», «Cuando te diga:», «Y si te dice:»)' },
        mensaje: { max: 100, desc: 'lo que te escriben, tal cual, como mensaje de chat y sin comillas (p. ej. «¡Hola! Nos encanta tu contenido. ¿Harías un video gratis a cambio de exposición?»)' },
        nota: { max: 44, desc: 'lo que NO debes hacer, con la primera palabra o dos *resaltadas* (p. ej. «*NO* digas que sí de una.»)' },
        giro: { max: 26, desc: 'frase corta que lleva a la respuesta (p. ej. «Primero pregunta esto», «Mejor responde así»)' },
        respuesta: { max: 330, desc: 'la respuesta que sí conviene, escrita como un correo: saludo y 2 a 4 párrafos cortos separados por una línea en blanco; puede llevar una lista con «• » (p. ej. «¡Hola! Gracias por pensar en mí.\\n\\nAntes de responder, me gustaría entender mejor la propuesta:\\n• ¿Qué tipo de video necesitan?\\n• ¿Dónde lo van a publicar?\\n\\nQuedo atento.»)' },
      },
      cierre: {
        regla: { max: 30, desc: 'título de la hoja a mano, con lo primero *resaltado* (p. ej. «*Una regla simple* para empezar»)' },
        linea1: { max: 22, desc: 'primera mitad de la regla (p. ej. «Primero el acuerdo,»)' },
        linea2: { max: 22, desc: 'segunda mitad de la regla (p. ej. «después el video.»)' },
        etiqueta: { max: 16, desc: 'rótulo de la lista, terminado en dos puntos (p. ej. «Por escrito:»)' },
        lista: { lista: 4, max: 24, desc: '4 cosas cortas de la lista, en minúscula (p. ej. «qué vas a entregar», «para cuándo»)' },
        pie: { max: 110, desc: 'una o dos frases que cierran la hoja (p. ej. «“Si no está escrito, no existe”. Un mensaje con esos cuatro puntos ya te protege.»)' },
        guarda: { max: 30, desc: 'arranque de la invitación a guardar (p. ej. «Guárdalo para cuando»)' },
        giro: { max: 24, desc: 'final de esa frase, va en cursiva (p. ej. «una marca te escriba.»)' },
        pregunta: { max: 80, desc: 'pregunta para comentar con la llamada *resaltada* (p. ej. «¿Ya te pasó? *Cuéntame en los comentarios* qué le respondiste.»)' },
      },
      comun: {
        para: { max: 18, desc: 'a quién va el correo (p. ej. «la marca»)' },
        asunto: { max: 22, desc: 'asunto del correo (p. ej. «Colaboración»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1350, fotos = (mat && mat.fotos) || [], items = c.items || [], com = c.comun || {}, ci = c.cierre || {};
      var A = U.mejorFoto(fotos, []), otras = fotos.filter(function (f) { return A && f.id !== A.id; });
      if (!otras.length && A) otras = [A];
      // el cierre se queda con la foto que tenga más aire arriba de la persona (ahí va el papel); las respuestas, con las demás
      function arriba(x) { var q = U.encuadre(x, W, H); return q.persona ? q.persona[1] : q.cara ? q.cara[1] : 0; }
      var fC = otras.slice().sort(function (a, b) { return arriba(b) - arriba(a); })[0] || null;
      var resp = otras.length > 1 ? otras.filter(function (f) { return f !== fC; }) : otras;
      var laminas = [];
      items.forEach(function (it, k) { laminas.push(dice(it)); laminas.push(respuesta(it, resp[k % Math.max(1, resp.length)])); });
      laminas.push(hoja());
      laminas.push(cierre());
      return laminas;

      function foto(f, opc, filtro) {
        var g = U.encuadre(f, W, H, opc), el = U.fotoEl(f, g, filtro);
        return { g: g, el: el };
      }
      /* (A) lo que te dicen */
      function dice(it) {
        var els = [], yB = 200, lin = renglones(it.mensaje, 50, 788, .5), fondoB = yB + 96 + lin * 65;
        if (A) {
          // la cara queda 50 px debajo de donde termina la burbuja (así nunca la tapa)
          var ch = A.cara ? A.cara[3] * Math.max(W / A.w, H / A.h) : 0;
          var p = foto(A, { alturaCara: Math.min(.72, Math.max(.33, (fondoB + 50 + ch / 2) / H)) }, { brillo: .9, sat: .95 });
          els.push(p.el);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Sombra sobre la foto', papel: 'sombra', interno: true, de: p.el.id, fondo: 'linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 45%)', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
        }
        var tit = T({ nombre: 'Título', papel: 'titulo', txt: it.titulo || '', x: 70, y: 100, fuente: '@cuerpo', tam: 62, peso: 700, interl: 1.05, espac: -.02, color: '#FFFFFF', sombra: true, z: 6 });
        var bur = T({ nombre: 'Burbuja del mensaje', papel: 'burbuja', txt: it.mensaje || '', x: 60, y: yB, w: 900, fuente: '@cuerpo', tam: 50, peso: 400, interl: 1.3, color: TINTA, caja: { fondo: '#F2F2F4', radio: 48, padV: 48, padH: 56 }, z: 6 });
        els.push(tit, FTX.eco(bur, 'sombra'), bur);
        els.push({ id: nid(), tipo: 'marca-corazon', nombre: 'Corazón de reacción', papel: 'corazon', color: '@acento', x: W - 95 - 72, y: yB - 25, w: 72, h: 72, z: 7, rot: 0, op: 1 });
        // el papel rasgado con la nota, abajo a la derecha
        var ln = renglones(it.nota, 40, 500, .5), pH = 70 + 64 + ln * 46 + 52, pY = H - 70 - pH, pX = W - 30 - 640;
        els.push({ id: nid(), tipo: 'marca-papel', nombre: 'Papel rasgado', papel: 'papel', src: U.BASE + 'piezas/marca/papel-horizontal.png', x: pX, y: pY, w: 640, h: pH, z: 6, rot: -2, op: 1 });
        var pila = { grupo: 'nota', x: pX + 70, w: 500, y: pY + 70, h: pH - 134, gap: .01 };
        els.push(
          T({ nombre: 'Nota', papel: 'nota', txt: it.nota || '', w: 500, fuente: '@cuerpo', tam: 40, peso: 600, interl: 1.15, espac: -.02, color: TINTA, colorAc: '@principal', modoAc: 'negrita', rot: -2, z: 7, _pila: pila }),
          T({ nombre: 'Nota en cursiva', papel: 'nota-giro', txt: it.giro || '', w: 500, fuente: '@titular', tam: 45, peso: 400, cursiva: true, interl: 1.15, espac: -.02, color: TINTA, rot: -2, z: 7, _pila: pila }),
          { id: nid(), tipo: 'flecha', nombre: 'Flecha', papel: 'flecha', src: U.BASE + 'piezas/fl-curva-tinta.png', color: TINTA, x: W - 80 - 130, y: H - 95 - 52, w: 130, h: 52, rot: 12, z: 8, op: 1 }
        );
        return { fondo: '#111111', els: els };
      }
      /* (B) la respuesta, en la ventana de «Nuevo mensaje» */
      function respuesta(it, f) {
        var els = [];
        if (f) els.push(foto(f, { centroX: .5 }, { brillo: .85, sat: .9 }).el);
        var x0 = 150, y0 = 70;
        els.push({ id: nid(), tipo: 'marca-correo', nombre: 'Ventana del correo', papel: 'correo', titulo: 'Nuevo mensaje', enviar: 'ENVIAR', x: x0, y: y0, w: W - 300, h: H - 140, z: 4, rot: 0, op: 1 });
        els.push(
          T({ nombre: '«Para:»', papel: 'para-rotulo', txt: 'Para:', y: y0 + 126, fuente: '@cuerpo', tam: 36, peso: 400, interl: 1.38, color: GRIS, z: 5, _fila: { grupo: 'para', x: x0 + 40, gap: 10 } }),
          T({ nombre: 'Para quién', papel: 'para', txt: com.para || 'la marca', y: y0 + 126, fuente: '@cuerpo', tam: 36, peso: 600, interl: 1.38, color: TINTA, z: 5, _fila: { grupo: 'para', x: x0 + 40, gap: 10 } }),
          T({ nombre: 'Asunto', papel: 'asunto', txt: com.asunto || 'Colaboración', x: x0 + 40, y: y0 + 229, fuente: '@cuerpo', tam: 36, peso: 600, interl: 1.38, color: TINTA, z: 5 }),
          T({ nombre: 'Respuesta', papel: 'respuesta', txt: it.respuesta || '', x: x0 + 40, y: y0 + 340, w: W - 380, fuente: '@cuerpo', tam: 36, peso: 400, interl: 1.38, color: TINTA, z: 5 })
        );
        return { fondo: '#111111', els: els };
      }
      /* la hoja rayada, escrita a mano (medidas de la referencia llevadas al recorte de la hoja en este alto) */
      function hoja() {
        var s0 = 1440 / 776, s = Math.max(W / 588, H / 776), cx = (588 * s - W) / 2, cy = (776 * s - H) / 2, cx0 = (588 * s0 - W) / 2;
        var X = function (x) { return Math.round((x + cx0) / s0 * s - cx); }, Y = function (y) { return Math.round(y / s0 * s - cy); };
        var mano = function (o) { return T(Object.assign({ fuente: '@mano', color: BOLI, interl: 1.15, z: 5 }, o)); };
        var els = [
          { id: nid(), tipo: 'imagen', nombre: 'Hoja rayada', papel: 'hoja', src: U.BASE + 'piezas/marca/hoja-rayada.jpg', x: 0, y: 0, w: W, h: H, z: 1, rot: 0, op: 1, radio: 0, zoom: 1, brillo: 1, contraste: 1, sat: 1 },
          mano({ nombre: 'Título a mano', papel: 'hoja-titulo', txt: ci.regla || '', x: X(150), y: Y(150), tam: 86, peso: 500, colorAc: BOLI, modoAc: 'negrita', rot: -2 }),
          mano({ nombre: 'Regla (1)', papel: 'hoja-linea', txt: ci.linea1 || '', x: X(150), y: Y(330), tam: 64, peso: 500 }),
          mano({ nombre: 'Regla (2)', papel: 'hoja-linea', txt: ci.linea2 || '', x: X(150), y: Y(410), tam: 64, peso: 500 }),
          { id: nid(), tipo: 'forma', nombre: 'Raya', papel: 'hoja-raya', fondo: BOLI, radio: 0, x: X(150), y: Y(540), w: 780, h: 3, z: 4, rot: 0, op: .5 },
          mano({ nombre: 'Rótulo resaltado', papel: 'hoja-etiqueta', txt: ci.etiqueta || '', x: X(150), y: Y(600), tam: 60, peso: 700, interl: 1.2, rot: -2, caja: { fondo: '#FFB3C7', radio: 10, padV: 4, padH: 22 } })
        ];
        (ci.lista || []).filter(Boolean).forEach(function (t, i) { els.push(mano({ nombre: 'Punto ' + (i + 1), papel: 'hoja-punto', txt: '— ' + t, x: X(170), y: Y(720 + i * 96), tam: 60, peso: 500 })); });
        els.push(T({ nombre: 'Pie', papel: 'hoja-pie', txt: ci.pie || '', x: X(150), y: Y(1160), w: 780, fuente: '@cuerpo', tam: 30, peso: 500, interl: 1.35, color: '#333333', z: 5 }));
        return { fondo: '#F4F4F2', els: els };
      }
      /* cierre: papel vertical con la invitación, en la zona libre de arriba de otra foto */
      function cierre() {
        var els = [], yP = 97, g = null, f = fC || A;
        if (f) {
          var p = foto(f, {}, {}); g = p.g; els.push(p.el);
          var z = FTX.zona(FTX.zonas(f, g, W, H), ['arriba-libre']); if (z) yP = z.y + 40;
        }
        var l1 = renglones(ci.guarda, 36, 540, .5), l2 = renglones(ci.giro, 40, 540, .45), l3 = renglones(ci.pregunta, 36, 540, .52);
        var pH = 180 + (l1 + l3) * 50 + l2 * 50 + 50, pX = 190;
        if (g && g.persona) yP = Math.max(40, Math.min(yP, Math.round(g.persona[1] - 24 - pH)));   // que termine antes de la cabeza
        els.push({ id: nid(), tipo: 'marca-papel', nombre: 'Papel', papel: 'papel', src: U.BASE + 'piezas/marca/papel-vertical.png', x: pX, y: yP, w: 700, h: pH, z: 5, rot: 1.5, op: 1 });
        var pila = { grupo: 'cierre', x: pX + 80, w: 540, y: yP + 90, h: pH - 180, gap: .01 };
        els.push(
          T({ nombre: 'Invitación a guardar', papel: 'cierre-guarda', txt: ci.guarda || '', w: 540, fuente: '@cuerpo', tam: 36, peso: 500, interl: 1.4, alin: 'center', color: TINTA, rot: 1.5, z: 6, _pila: pila }),
          T({ nombre: 'Final en cursiva', papel: 'cierre-giro', txt: ci.giro || '', w: 540, fuente: '@titular', tam: 41, peso: 400, cursiva: true, interl: 1.25, alin: 'center', color: TINTA, rot: 1.5, z: 6, _pila: pila }),
          { id: nid(), tipo: 'forma', nombre: 'Espacio', papel: 'espacio', interno: true, fondo: 'transparent', radio: 0, x: pX + 80, y: 0, w: 540, h: 50, z: 6, rot: 0, op: 0, _pila: pila },
          T({ nombre: 'Pregunta', papel: 'cierre-pregunta', txt: ci.pregunta || '', w: 540, fuente: '@cuerpo', tam: 36, peso: 500, interl: 1.4, alin: 'center', color: TINTA, colorAc: '@principal', modoAc: 'negrita', rot: 1.5, z: 6, _pila: pila })
        );
        // regla 13: si el papel se cruza con la persona, la persona va adelante
        if (f && g && FTX.persona(f, g, W, H, pX, yP, 700, pH) > .01) { var r = U.recorteEl(f, g, { z: 8 }); if (r) { r.sigue = els[0].id; els.push(r); } }
        return { fondo: '#111111', els: els };
      }
    },
  });
})();

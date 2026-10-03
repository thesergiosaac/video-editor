/* brillo.js — familia «Paso con brillo» (copia de @nicofastt: «Cómo crear carruseles virales con Claude»).
   Tutorial puro. Portada: tu foto oscurecida con el titular en la zona libre (una línea en el color de la marca con
   brillo). Adentro: fondo negro, «Paso N» gigante con degradado metálico del color y resplandor, la instrucción en
   blanco centrada y la CAPTURA de la app en una tarjeta con sombra, con una flecha de tinta que señala. Cierre: texto
   centrado y la palabra para comentar con brillo. */
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

  // el elemento al que sigue una pieza, leído en vivo (para que el brillo cambie si cambia lo que acompaña)
  function seguido(el) {
    var v = null;
    try { (LZ.laminas || []).some(function (l) { return l.els.some(function (e) { if (e.id === el.sigue) { v = e; return true; } return false; }); }); } catch (e) { v = null; }
    if (v) el.copia = { src: v.src, color: v.color, radio: v.radio, oculto: v.oculto };
    return el.copia || {};
  }
  /* luz de fondo del color de la marca (degradado radial) */
  LZ.tipo('brillo-luz', function (el, base, attrs, u) {
    var col = u.res(el.color || '@principal'), extra = el.velo ? ',' + el.velo : '';
    return '<div ' + attrs + ' style="' + base + 'pointer-events:none;background:radial-gradient(' + (el.forma || '70% 40% at 50% 12%') + ',' + u.hexA(col, el.fuerza || .16) + ',transparent 70%)' + extra + '"></div>';
  });
  /* la sombra y el brillo de la tarjeta de la captura (va pegada a la captura, detrás) */
  LZ.tipo('brillo-marco', function (el, base, attrs, u) {
    var b = seguido(el), col = u.res(el.color || '@principal');
    return '<div ' + attrs + ' style="' + base + (b.oculto ? 'display:none;' : '') + 'pointer-events:none;border-radius:' + (b.radio || 0) + 'px;background:#111;box-shadow:0 0 0 2px rgba(255,255,255,.08),0 30px 80px rgba(0,0,0,.8),0 0 90px ' + u.hexA(col, .18) + '"></div>';
  });
  /* el resplandor de la flecha: la misma flecha, borrosa, detrás */
  LZ.tipo('brillo-halo', function (el, base, attrs, u) {
    var b = seguido(el), col = u.res(b.color || el.color || '@principal'), src = u.esc(b.src || el.src || '');
    return '<div ' + attrs + ' style="' + base + (b.oculto ? 'display:none;' : '') + 'pointer-events:none;background:' + col + ';-webkit-mask:url(' + src + ') center/contain no-repeat;mask:url(' + src + ') center/contain no-repeat;filter:blur(8px);opacity:.6"></div>';
  });

  FAMILIAS.registrar('brillo', {
    catalogo: {
      letras: { titular: 'Archivo Black', mano: 'Caveat', cuerpo: 'Montserrat' },
      colores: { principal: '#E1251B', acento: '#FF4A3D', fondo: '#030303', texto: '#FFFFFF' },
    },
    esquema: {
      nombre: 'Paso con brillo', nItems: 4, iconos: U.ICONOS_OK,
      guia: 'TUTORIAL de una app o herramienta, paso a paso: portada con la promesa (qué vas a lograr), una lámina por paso con UNA instrucción corta de lo que se toca o se hace (la lámina lleva la captura de esa pantalla) y un cierre que invita a comentar una PALABRA. Los pasos tienen que ser el camino real, en orden.',
      portada: {
        antes: { max: 18, desc: 'arranque en minúscula (p. ej. «Cómo saber»)' },
        titular: { max: 16, desc: 'la primera línea grande, en mayúsculas (p. ej. «en qué segundo»)' },
        brillo: { max: 16, desc: 'la línea grande que va en color con brillo, lo más fuerte (p. ej. «se va tu gente»)' },
        despues: { max: 18, desc: 'con qué se hace (p. ej. «con Cherry»)' },
      },
      item: {
        instruccion: { max: 50, desc: 'lo que se hace en este paso, en 2 renglones cortos separados con \\n (p. ej. «Entra al Laboratorio\\ny toca “Desmontar”»)' },
      },
      cierre: {
        texto: { max: 110, desc: 'una frase que dice para qué sirve hacerlo, con lo más importante *resaltado* (p. ej. «Si ya subes reels, revisa esto después de cada uno y vas a ver *dónde se te está yendo la gente*.»)' },
        palabra: { max: 12, desc: 'la PALABRA para comentar, en mayúsculas (p. ej. «CEREZA»)' },
        despues: { max: 30, desc: 'qué recibe quien comente (p. ej. «y te cuento cómo empezar.»)' },
      },
      comun: {
        paso: { max: 8, desc: 'la palabra antes del número (p. ej. «Paso»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1350, fotos = (mat && mat.fotos) || [], items = c.items || [], total = items.length + 2;
      var caps = ((mat && mat.capturas) || []).concat((mat && mat.clips) || []);
      var pF = U.mejorFoto(fotos, []), resto = fotos.filter(function (f) { return !pF || f.id !== pF.id; });
      var laminas = [portada()];
      items.forEach(function (it, k) { laminas.push(paso(it, k)); });
      laminas.push(cierre());
      return laminas;

      function luz(forma, fuerza, velo) { return { id: nid(), tipo: 'brillo-luz', nombre: 'Luz del color', papel: 'luz', interno: true, forma: forma, fuerza: fuerza, velo: velo || '', color: '@principal', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1 }; }
      function cabe(t, tam, w, k) { var n = String(t || '').length || 1; return Math.round(Math.max(tam * .45, Math.min(tam, w / (n * k)))); }

      function portada() {
        var els = [], g = null, z = { x: 60, y: 60, w: W - 120, h: Math.round(H * .3), zona: 'arriba' }, p = c.portada || {};
        if (pF) {
          g = U.encuadre(pF, W, H);
          els.push(U.fotoEl(pF, g, { brillo: .72, contraste: 1.1, sat: .9 }));
          // como la referencia: la franja de arriba a todo lo ancho; si el titular se cruza contigo, tú vas adelante (abajo)
        }
        els.push(luz('90% 60% at 70% 20%', .35, 'linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 45%)'));
        var al = z.lado === 'izq' ? 'left' : 'right', P = { grupo: 'portada', x: z.x, w: z.w, y: z.y + (z.zona === 'arriba-libre' ? 70 : 20), h: 1, gap: 4 };
        var linea = function (o) { return T(Object.assign({ w: z.w, alin: al, color: '#FFFFFF', sombra: true, z: 6, _pila: P, x: z.x }, o)); };
        var br = linea({ nombre: 'Línea con brillo', papel: 'titular-brillo', txt: p.brillo || '', fuente: '@titular', tam: cabe(p.brillo, 104, z.w, .78), peso: 400, mayus: true, espac: -.01, interl: .95, color: '@principal' });
        els.push(
          linea({ nombre: 'Arranque', papel: 'antes', txt: p.antes || '', fuente: '@cuerpo', tam: cabe(p.antes, 60, z.w, .56), peso: 600, interl: 1.1 }),
          linea({ nombre: 'Titular', papel: 'titular', txt: p.titular || '', fuente: '@titular', tam: cabe(p.titular, 104, z.w, .78), peso: 400, mayus: true, espac: -.01, interl: .95 }),
          FTX.eco(br, 'brillo', { radio: 30, fuerza: .7 }), br,
          linea({ nombre: 'Con qué', papel: 'despues', txt: p.despues || '', fuente: '@cuerpo', tam: cabe(p.despues, 58, z.w, .56), peso: 600, interl: 1.1 })
        );
        els.push(
          T({ nombre: 'Contador', papel: 'contador', txt: '01 / ' + String(total).padStart(2, '0'), x: 60, y: H - 56 - 32, fuente: '@cuerpo', tam: 26, peso: 600, color: 'rgba(255,255,255,.85)', z: 6 }),
          T({ nombre: 'Flecha «desliza»', papel: 'desliza', txt: '⟶', y: H - 56 - 50, fuente: '@cuerpo', tam: 40, peso: 600, color: 'rgba(255,255,255,.85)', z: 6, _der: W - 60 })
        );
        // regla 13: si el titular se cruza contigo, tú vas adelante
        if (pF && FTX.persona(pF, g, W, H, z.x, P.y, z.w, 360) > .04) { var r = U.recorteEl(pF, g, { z: 8 }); if (r) { r.sigue = els[0].id; els.push(r); } }
        return { fondo: '#030303', els: els };
      }
      function paso(it, k) {
        var n = k + 1, cap = caps[k] || null, f = cap ? null : (resto.length ? resto[k % resto.length] : pF);
        var src = cap ? (cap.url || cap.src) : f ? f.url : '', cw = cap ? (cap.w || 16) : f ? f.w : 16, ch = cap ? (cap.h || 10) : f ? f.h : 10;
        var alto = Math.round(Math.max(420, Math.min(620, 900 * ch / cw))), top = alto > 500 ? 540 : 610;
        var pasoT = T({ nombre: 'Paso', papel: 'paso', txt: (c.comun && c.comun.paso || 'Paso') + ' ' + n, x: 0, y: 110, w: W, fuente: '@titular', tam: 190, peso: 400, espac: -.02, interl: 1, alin: 'center', color: '@principal', z: 6 });
        var els = [luz('70% 40% at 50% 12%', .16), pasoT, FTX.eco(pasoT, 'metal'),
          T({ nombre: 'Instrucción', papel: 'instruccion', txt: it.instruccion || '', x: 110, y: 325, w: W - 220, fuente: '@cuerpo', tam: 52, peso: 600, espac: -.01, interl: 1.22, alin: 'center', color: '#FFFFFF', z: 6 })];
        if (src) {
          var img = { id: nid(), tipo: 'imagen', nombre: cap ? 'Captura' : 'Tu foto (pon aquí la captura)', papel: 'captura', src: src, ref: cap ? (cap.id ? { clip: cap.id } : null) : { foto: f.id, campo: 'foto' }, x: 90, y: top, w: W - 180, h: alto, z: 4, rot: 0, op: 1, radio: 26, zoom: 1, brillo: 1, contraste: 1, sat: 1 };
          els.push({ id: nid(), tipo: 'brillo-marco', nombre: 'Sombra de la captura', papel: 'marco', interno: true, sigue: img.id, copia: { radio: 26 }, color: '@principal', x: img.x, y: img.y, w: img.w, h: img.h, z: 3, rot: 0, op: 1 }, img);
        }
        // la flecha de tinta que señala (cuatro posiciones que se turnan, como en la referencia)
        var pos = [[250, top + alto * .52, -160], [W - 170 - 220, top + alto * .32, 200], [520, top + alto - 25, -170], [W - 150 - 220, top + alto - 10, 160]][k % 4];
        var fl = { id: nid(), tipo: 'flecha', nombre: 'Flecha', papel: 'flecha', src: U.BASE + 'piezas/fl-curva-tinta.png', color: '@principal', x: pos[0], y: Math.round(pos[1]), w: 220, h: 90, rot: pos[2], z: 7, op: 1 };
        if (src) els.push({ id: nid(), tipo: 'brillo-halo', nombre: 'Brillo de la flecha', papel: 'halo', interno: true, sigue: fl.id, copia: { src: fl.src, color: fl.color }, x: fl.x, y: fl.y, w: fl.w, h: fl.h, z: 6, rot: fl.rot, op: 1 }, fl);   // sin captura no hay a qué señalar
        return { fondo: '#030303', els: els };
      }
      function cierre() {
        var ci = c.cierre || {};
        var llamada = T({ nombre: 'Palabra para comentar', papel: 'llamada', txt: 'Comenta *«' + String(ci.palabra || '').replace(/[«»"“”]/g, '') + '»*\n' + (ci.despues || ''), x: 110, y: 850, w: W - 220, fuente: '@cuerpo', tam: 58, peso: 600, espac: -.01, interl: 1.22, alin: 'center', color: '#FFFFFF', colorAc: '@principal', modoAc: 'negrita', z: 6 });
        return { fondo: '#030303', els: [
          luz('70% 50% at 50% 50%', .14),
          T({ nombre: 'Texto', papel: 'texto-cierre', txt: ci.texto || '', x: 110, y: 400, w: W - 220, fuente: '@cuerpo', tam: 60, peso: 600, espac: -.01, interl: 1.25, alin: 'center', color: '#FFFFFF', colorAc: '@principal', modoAc: 'color', z: 6 }),
          FTX.eco(llamada, 'brillo', { radio: 24, fuerza: .7, soloAcento: true }), llamada
        ] };
      }
    },
  });
})();

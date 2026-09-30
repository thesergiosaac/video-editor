/* cintas.js — familia «Cintas» (copia de @isaosoriov: «Así usaría los últimos 90 días del año»).
   Tu foto a sangre con un velo rojizo; el texto va en la zona libre de la foto (donde no estás tú): titular en sans
   negrísima y mayúsculas con renglones de dos tamaños, frases en CINTAS de color detrás de cada renglón y tarjetas
   crema redondeadas con el ejemplo. Íconos pequeños en vez de emojis. */
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

  var CREMA = '#FFF6F2';
  var VELO = 'linear-gradient(180deg,rgba(40,6,4,.55),rgba(40,6,4,.1) 45%,rgba(40,6,4,0) 60%,rgba(40,6,4,.45))';
  var K = { h: .66, b: .5, c: .62, t: .5 };   // ancho medio de una letra (en em) de cada estilo, para medir antes de que carguen

  FAMILIAS.registrar('cintas', {
    catalogo: {
      letras: { titular: 'Inter', mano: 'Caveat', cuerpo: 'Inter' },
      colores: { principal: '#E1251B', acento: '#FFD60A', fondo: '#1A0B09', texto: '#3A1411' },
    },
    esquema: {
      nombre: 'Cintas', nItems: 3, iconos: U.ICONOS_OK,
      guia: 'Carrusel de PLAN o RETO paso a paso sobre tus fotos: cada lámina es un paso con un titular corto en mayúsculas y 3 a 6 piezas cortas (frases sueltas, frases en cinta de color y una tarjeta con el ejemplo concreto). Ideal para planes, retos y lanzamientos; sirve para venta suave. El cierre resume el plan en una tarjeta y pide guardarlo.',
      portada: {
        antes: { max: 22, desc: 'arranque en minúscula, antes del titular (p. ej. «Así usaría los»)' },
        titular: { lista: 2, max: 16, desc: 'el titular en 2 renglones cortos, el segundo más corto (p. ej. «últimos 90 días», «del año»)' },
        icono: { max: 20, desc: 'ícono de la lista que acompaña el titular' },
        cinta: { max: 24, desc: 'para qué es, en MAYÚSCULAS, va en cinta de color (p. ej. «PARA CRECER EN REDES»)' },
      },
      item: {
        titulo: { lista: 2, max: 14, desc: 'el paso en 1 o 2 renglones cortos (p. ej. «Escoge una», «sola meta»)' },
        icono: { max: 20, desc: 'ícono de la lista que acompaña el título' },
        piezas: { lista: 6, desc: '3 a 6 piezas cortas, en orden, que explican el paso', campos: {
          tipo: { max: 8, desc: '«texto» (frase suelta, máx. 30 letras), «cursiva» (frase suelta en cursiva, máx. 30), «cinta» (frase en cinta de color, máx. 34; en MAYÚSCULAS si es una lista corta como «RETOS · TUTORIALES») o «tarjeta» (el ejemplo concreto, máx. 90, con lo importante *resaltado*; usa \\n para partirla en 2 renglones). Máximo UNA tarjeta por lámina' },
          t: { max: 90, desc: 'el texto de la pieza (p. ej. «No pongas:», «“quiero más seguidores”.», «Quiero llegar a *5.000* seguidores antes de diciembre.»)' },
        } },
      },
      cierre: {
        antes: { max: 26, desc: 'arranque en minúscula (p. ej. «y si quieres empezar hoy»)' },
        grande: { max: 9, desc: 'la cifra o palabra grande con brillo (p. ej. «90 días»)' },
        despues: { max: 26, desc: 'lo que completa la frase (p. ej. «para construir tu cuenta»)' },
        tarjeta: { max: 110, desc: 'el plan resumido, con lo primero *resaltado* y renglones separados con \\n (p. ej. «*El plan:*\\nuna meta · un formato\\nun sistema · una revisión por semana»)' },
        cinta: { max: 32, desc: 'la llamada final, va en cinta (p. ej. «Guárdalo y empieza este lunes.»)' },
      },
      comun: {},
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1350, fotos = (mat && mat.fotos) || [], items = c.items || [];
      var pF = U.mejorFoto(fotos, []), orden = pF ? [pF].concat(fotos.filter(function (f) { return f.id !== pF.id; })) : [];
      var laminas = [portada()];
      items.forEach(function (it, k) { laminas.push(paso(it, k)); });
      laminas.push(cierre());
      return laminas;

      /* la foto a sangre + el velo; devuelve también sus zonas libres */
      function base(i) {
        var f = orden.length ? orden[i % orden.length] : null, els = [], g = null, zs;
        if (f) {
          g = U.encuadre(f, W, H);
          var fe = U.fotoEl(f, g, { brillo: .8, sat: 1.05 }); els.push(fe);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Velo rojizo', papel: 'sombra', interno: true, de: fe.id, fondo: VELO, x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
          zs = FTX.zonas(f, g, W, H);
        } else {
          els.push({ id: nid(), tipo: 'forma', nombre: 'Velo rojizo', papel: 'sombra', interno: true, fondo: VELO, x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
          zs = FTX.zonas(null, null, W, H);
        }
        return { f: f, g: g, els: els, zs: zs };
      }
      function lado(z, forzar) { return forzar || (z.lado === 'der' ? 'right' : z.lado === 'izq' ? 'left' : 'center'); }
      // tamaño que cabe en el ancho (como FT.listo, que achica lo que no quepa)
      // (hasta el 45 %: si ni así cabe, el renglón se parte en dos)
      function cabe(t, tam, w, k) { var n = String(t || '').replace(/\*/g, '').length || 1; return Math.round(Math.max(24, tam * .45, Math.min(tam, w / (n * k)))); }
      function renglones(t, tam, w, k) { return String(t || '').replace(/\*/g, '').split('\n').reduce(function (s, p) { return s + Math.max(1, Math.ceil(p.length * tam * k / w)); }, 0); }

      /* las piezas de un grupo: cada una es un texto (y su eco si es cinta o tarjeta) */
      function piezas(lista, zw, al) {
        var out = [];
        lista.forEach(function (p) {
          var t = p.t || '', w = zw;
          if (!t) return;
          if (p.tipo === 'h') {
            var wi = w - (p.icono ? p.tam * 1.3 : 0), tam = cabe(t, p.tam, wi, K.h);
            out.push({ alto: renglones(t, tam, wi, K.h) * tam * .95, el: T({ nombre: p.nombre || 'Titular', papel: p.papel || 'titular', txt: t, w: w, fuente: '@titular', tam: tam, peso: 900, mayus: true, espac: -.02, interl: .95, alin: al, color: p.color || '#FFFFFF', sombra: true, icono: p.icono || undefined, iconoLado: 'der', iconoColor: '@acento', z: 6 }), brillo: p.brillo });
          } else if (p.tipo === 'cinta') {
            var tc = p.tam || 36, pc = p.peso || (t === t.toUpperCase() ? 800 : 700), nc = t.replace(/\*/g, '').length;
            if (nc <= 28) tc = Math.round(Math.max(tc * .7, Math.min(tc, (w - tc * .44) / (nc * K.c))));   // la cinta corta cabe en un renglón
            var el = T({ nombre: 'Cinta', papel: 'cinta', txt: t, w: w, fuente: '@cuerpo', tam: tc, peso: pc, espac: -.02, interl: 1.34, alin: al, color: '#FFFFFF', z: 6 });
            out.push({ alto: renglones(t, tc, w, K.c) * tc * 1.34, el: el, eco: 'cinta' });
          } else if (p.tipo === 'tarjeta') {
            var tt = p.tam || 36, et = T({ nombre: 'Tarjeta', papel: 'tarjeta', txt: t, w: w, fuente: '@cuerpo', tam: tt, peso: 600, espac: -.02, interl: 1.12, alin: al, color: '@texto', colorAc: '@texto', modoAc: 'negrita', caja: { fondo: 'transparent', radio: 22, padV: 24, padH: 30 }, z: 6 });
            out.push({ alto: renglones(t, tt, w - 60, K.t) * tt * 1.12 + 48, el: et, eco: 'tarjeta' });
          } else {   // texto suelto o en cursiva
            var tb = p.tam || 38;
            out.push({ alto: renglones(t, tb, w, K.b) * tb * 1.12, el: T({ nombre: p.tipo === 'cursiva' ? 'Frase en cursiva' : 'Frase', papel: p.tipo === 'cursiva' ? 'frase-cursiva' : 'frase', txt: t, w: w, fuente: '@cuerpo', tam: tb, peso: p.peso || 700, cursiva: p.tipo === 'cursiva', espac: -.02, interl: 1.12, alin: al, color: '#FFFFFF', sombra: true, z: 6 }) });
          }
        });
        return out;
      }
      function altoDe(ps, gap) { return ps.reduce(function (s, p) { return s + p.alto; }, 0) + gap * Math.max(0, ps.length - 1); }
      /* pone un grupo en su zona: arriba (desde el borde de arriba de la zona) o abajo (termina 40 px antes del final) */
      function grupo(L, ps, z, abajo, nombre) {
        var gap = 10, a = altoDe(ps, gap), y = abajo ? Math.round(z.y + z.h - 40 - a) : z.y + (z.zona === 'arriba-libre' ? 70 : 20);
        var P = { grupo: nombre, x: z.x, w: z.w, y: y, h: abajo ? Math.round(a) : 1, gap: gap };
        ps.forEach(function (p) {
          p.el.x = z.x; p.el._pila = P; L.els.push(p.el);
          if (p.eco) L.els.push(FTX.eco(p.el, p.eco, p.eco === 'tarjeta' ? { fondo: CREMA } : {}));
          if (p.brillo) L.els.push(FTX.eco(p.el, 'brillo', { radio: 30, fuerza: .9 }));
        });
        return { x: z.x, y: y, w: z.w, h: a };
      }
      // regla 13: si el texto se cruza contigo, tú vas adelante (tu recorte encima del texto)
      function adelante(L, cajas) {
        if (!L.f) return;
        var cruza = cajas.some(function (k) { return FTX.persona(L.f, L.g, W, H, k.x, k.y, k.w, k.h) > .04; });
        if (cruza) { var r = U.recorteEl(L.f, L.g, { z: 8 }); if (r) { r.sigue = L.els[0].id; L.els.push(r); } }
      }
      function abajoDe(L) { return FTX.zona(L.zs, ['abajo-libre', 'abajo']); }

      function portada() {
        var L = base(0), p = c.portada || {}, z = FTX.zona(L.zs, ['arriba-libre', 'arriba']), al = lado(z), tit = (p.titular || []).filter(Boolean);
        var lista = [{ tipo: 'b', t: p.antes, tam: 54 }];
        tit.forEach(function (t, i) { lista.push({ tipo: 'h', t: t, tam: i === tit.length - 1 && tit.length > 1 ? 110 : 92, icono: i === 0 ? p.icono : null, nombre: 'Titular (' + (i + 1) + ')' }); });
        lista.push({ tipo: 'cinta', t: p.cinta, tam: 44, peso: 800 });
        var k = grupo(L, piezas(lista, z.w, al), z, false, 'portada');
        adelante(L, [k]);
        return { fondo: '@fondo', els: L.els };
      }
      function paso(it, n) {
        var L = base(n + 1), z = FTX.zona(L.zs, ['arriba-libre', 'arriba']);
        var al = z.lado === 'centro' ? (n % 2 ? 'right' : 'left') : lado(z);
        var tit = (it.titulo || []).filter(Boolean).map(function (t, i, a) { return { tipo: 'h', t: t, tam: 84, icono: i === a.length - 1 ? it.icono : null, nombre: 'Título (' + (i + 1) + ')' }; });
        var resto = (it.piezas || []).filter(function (p) { return p && p.t; }).map(function (p) {
          var tipo = /tarj/i.test(p.tipo) ? 'tarjeta' : /cint/i.test(p.tipo) ? 'cinta' : /curs/i.test(p.tipo) ? 'cursiva' : 'texto';
          return { tipo: tipo, t: p.t, tam: tipo === 'cinta' ? 38 : tipo === 'tarjeta' ? 38 : 38 };
        });
        /* dónde va: todo junto en la zona de arriba (a tamaño normal o un poco más chico) o, si así se cruza contigo,
           el título arriba y lo demás en la zona libre de abajo. Gana la opción que menos te tape. */
        var y0 = z.y + (z.zona === 'arriba-libre' ? 70 : 20), op = [];
        function escala(l, s) { return l.map(function (p) { return Object.assign({}, p, { tam: Math.round(p.tam * s) }); }); }
        function cruce(x, y, w, h) { return (y + h > H - 50 ? 1 : 0) + (L.f ? FTX.persona(L.f, L.g, W, H, x, y, w, h) : 0); }
        [1, .88, .76].forEach(function (s, i) {
          var a = altoDe(piezas(escala(tit.concat(resto), s), z.w, al), 10);
          op.push({ s: s, cruce: cruce(z.x, y0, z.w, a) + i * .01 });
        });
        if (resto.length) L.zs.filter(function (q) { return q.y >= H * .5 && q.libre > .3; }).forEach(function (zb) {
          [1, .88].forEach(function (s, i) {
            var alb = zb.lado === 'centro' ? 'center' : lado(zb), a = altoDe(piezas(escala(resto, s), zb.w, alb), 10);
            op.push({ s: s, zb: zb, al: alb, cruce: cruce(z.x, y0, z.w, altoDe(piezas(tit, z.w, al), 10)) + cruce(zb.x, zb.y + zb.h - 40 - a, zb.w, a) + .02 + i * .01 });
          });
        });
        var o = op.sort(function (p, q) { return p.cruce - q.cruce; })[0], cajas = [];
        if (o.zb) {
          cajas.push(grupo(L, piezas(tit, z.w, al), z, false, 'arriba'));
          cajas.push(grupo(L, piezas(escala(resto, o.s), o.zb.w, o.al), o.zb, true, 'abajo'));
        } else cajas.push(grupo(L, piezas(escala(tit.concat(resto), o.s), z.w, al), z, false, 'arriba'));
        adelante(L, cajas);
        return { fondo: '@fondo', els: L.els };
      }
      function cierre() {
        var L = base(items.length + 1), ci = c.cierre || {}, z = FTX.zona(L.zs, ['arriba-libre', 'arriba']), al = z.lado === 'centro' ? 'right' : lado(z), zb = abajoDe(L);
        var cajas = [grupo(L, piezas([
          { tipo: 'cursiva', t: ci.antes, tam: 38 },
          { tipo: 'h', t: ci.grande, tam: 150, brillo: true, nombre: 'Cifra grande', papel: 'cifra' },
          { tipo: 'b', t: ci.despues, tam: 40 }
        ], z.w, al), z, false, 'arriba')];
        cajas.push(grupo(L, piezas([{ tipo: 'tarjeta', t: ci.tarjeta, tam: 34 }, { tipo: 'cinta', t: ci.cinta, tam: 40, peso: 800 }], zb.w, 'center'), zb, true, 'abajo'));
        adelante(L, cajas);
        return { fondo: '@fondo', els: L.els };
      }
    },
  });
})();

/* aire.js — familia «Aire» (copia de @tapioca_agencia). Una foto tuya a sangre en CADA lámina, serif en cursiva color
   crema + sans liviana blanca, mucho aire, número de lámina y rúbrica arriba alternando lados. El texto va SOLO donde no
   está la persona (zonas libres por franja, como detectar.py); una lámina puede llevar una palabra gigante DETRÁS de la
   cabeza. Es para motivación y opinión, no para tutoriales (no hay dónde poner pasos ni capturas). */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;

  /* ── ayudas: zonas libres alrededor de la persona (igual que detectar.py, pero con la rejilla de la foto) ── */
  function dec(b64) { var s = atob(b64 || ''), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function zonasLibres(f, g, W, H) {
    var M = 60, todo = function (y0, y1) { return { x: M, y: Math.round(H * y0), w: W - 2 * M, h: Math.round(H * (y1 - y0)), lado: 'centro', llena: true }; };
    var out = { arriba: todo(.04, .34), medio: todo(.34, .64), abajo: todo(.64, .96) };
    var R = f && f.rejilla; if (!R || !g) return out;
    var per = dec(R.persona), c = g.cara;
    var cm = c ? [c[0] - c[2] * .35, c[1] - c[3] * .45, c[2] * 1.7, c[3] * 1.675] : null;
    function ocupado(x, y) {
      if (cm && x >= cm[0] && x < cm[0] + cm[2] && y >= cm[1] && y < cm[1] + cm[3]) return 1;
      var fx = (x - g.x) / g.w, fy = (y - g.y) / g.h; if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return 0;
      return per[Math.floor(fy * R.h) * R.w + Math.floor(fx * R.w)] > 90 ? 1 : 0;
    }
    var P = 6;
    [['arriba', .04, .34], ['medio', .34, .64], ['abajo', .64, .96]].forEach(function (b) {
      var ya = Math.round(H * b[1]), yb = Math.round(H * b[2]), cols = [];
      for (var x = 0; x < W; x += P) { var n = 0, o = 0; for (var y = ya; y < yb; y += P) { n++; o += ocupado(x + P / 2, y); } cols.push(o / n > .015); }
      var mejor = [0, 0], ini = null;
      for (var i = 0; i <= cols.length; i++) { var lib = i < cols.length && !cols[i]; if (lib && ini === null) ini = i; if (!lib && ini !== null) { if (i - ini > mejor[1] - mejor[0]) mejor = [ini, i]; ini = null; } }
      var x0 = mejor[0] * P, x1 = Math.min(W, mejor[1] * P);
      var a = Math.max(M, x0 + (x0 > 0 ? 30 : 0)), z = Math.min(W - M, x1 - (x1 < W ? 30 : 0));
      if (z - a < 260) { out[b[0]] = null; return; }
      var cx = (a + z) / 2;
      out[b[0]] = { x: a, y: ya, w: z - a, h: yb - ya, lado: cx < W * .42 ? 'izq' : cx > W * .58 ? 'der' : 'centro' };
    });
    // si una franja no tiene tramo libre, va a todo el ancho (y lo que cruce a la persona queda DETRÁS del recorte)
    if (!out.arriba) out.arriba = Object.assign(todo(.04, .34), { tapada: true });
    if (!out.medio) out.medio = Object.assign(todo(.34, .64), { tapada: true });
    if (!out.abajo) out.abajo = Object.assign(todo(.64, .96), { tapada: true });
    return out;
  }
  /* cuánto mide un texto (aprox.): la página no achica sola, así que aquí se encaja la letra al ancho de su zona */
  function anchoTxt(t, tam, k) {
    return String(t).split('\n').reduce(function (m, l) {
      var s = 0; for (var i = 0; i < l.length; i++) { var ch = l[i];
        if (' .,;:!¡\'’|iíìl1tfjrI«»'.indexOf(ch) >= 0) s += .55; else if ('mwMWÑ@%'.indexOf(ch) >= 0) s += 1.45; else if (ch !== ch.toLowerCase()) s += 1.2; else s += 1; }
      return Math.max(m, s * tam * k);
    }, 0);
  }
  // parte una frase en renglones de ~max letras (si ya trae saltos, se respetan)
  function partir(t, max) {
    t = String(t || '').trim(); if (!t || t.indexOf('\n') >= 0 || t.length <= max) return t;
    var pal = t.split(/\s+/), l = [], cur = '';
    var n = Math.ceil(t.length / max), meta = t.length / n;
    pal.forEach(function (p) { if (cur && (cur + ' ' + p).length > meta + 3) { l.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p; });
    if (cur) l.push(cur); return l.join('\n');
  }
  var K = { s: .42, t: .57 };     // ancho medio de letra: serif en cursiva / sans
  var LH = { s: .95, t: 1.22 };

  FAMILIAS.registrar('aire', {
    catalogo: { letras: { titular: 'Cormorant Garamond', mano: 'Cormorant Garamond', cuerpo: 'Inter' }, colores: { principal: '#F3E7C3', acento: '#F3E7C3', fondo: '#111111', texto: '#FFFFFF' } },
    esquema: {
      nombre: 'Aire', nItems: 5, iconos: U.ICONOS_OK,
      guia: 'Carrusel de reflexión u opinión con UNA foto tuya en cada lámina y poco texto: una frase corta en serif cursiva (la que se recuerda) y una o dos líneas sencillas en sans que la acompañan. Tono cercano, como quien habla de frente; nada de pasos ni listas largas. Sirve para motivar, opinar o contar algo personal, no para tutoriales.',
      portada: {
        titular: { max: 12, desc: 'UNA o dos palabras en serif grande, el tema (p. ej. «Reels»)' },
        sub: { max: 26, desc: 'lo que completa el titular, en sans (p. ej. «que nadie termina.»)' },
        antes: { max: 28, desc: 'frase corta en sans que abre el remate de abajo (p. ej. «Y hacen que te dejen de»)' },
        remate: { max: 12, desc: 'UNA palabra o dos en serif que cierra la frase de abajo (p. ej. «seguir.»)' },
      },
      item: {
        entrada: { max: 44, desc: 'frase en sans que prepara la idea (p. ej. «Si tienes que explicar el gancho…»)' },
        frase: { max: 22, desc: 'la frase en serif que remata, corta y con punto (p. ej. «ya perdiste.»)' },
        detalle: { max: 70, desc: 'opcional: un ejemplo o aclaración corta en sans; si no hace falta, vacío (p. ej. «Hola, ¿cómo están? Hoy les quiero hablar de… Y ya se fueron.»)' },
        grito: { max: 9, desc: 'SOLO en uno de los items (en los demás vacío): una palabra estirada que va gigante detrás de tu cabeza (p. ej. «¿Poooor?»); en ese item la «entrada» es lo que sigue (p. ej. «Y aquí va lo que nadie te dice, aunque te duela…») y la «frase» puede ir vacía' },
        regadas: { lista: 4, desc: 'SOLO en uno de los items (en los demás vacía): 4 frases cortas en serif que se riegan por la foto, una idea cada una (p. ej. «Errores.», «Confesiones.», «Antes y después.», «Cosas aprendidas a la mala.»)', campos: { t: { max: 26, desc: 'frase corta con punto' } } },
      },
      cierre: {
        frase: { max: 22, desc: 'serif de arriba que abre el cierre (p. ej. «Y antes de publicar…»)' },
        pregunta: { max: 40, desc: 'la pregunta en sans que sigue (p. ej. «pregúntate: ¿yo vería esto completo?»)' },
        aparte: { max: 34, desc: 'una segunda pregunta chiquita, entre comillas si es lo que diría alguien (p. ej. «¿O también diría “qué pereza”?»)' },
        antes: { max: 44, desc: 'sans que prepara el remate final (p. ej. «Porque si a ti te dio pereza grabarlo…»)' },
        remate: { max: 26, desc: 'serif final que se queda (p. ej. «imagínate a quien lo ve.»)' },
      },
      comun: {
        rubrica: { max: 26, desc: 'rúbrica chiquita de arriba de cada lámina: el tema general, sin @ ni marca (p. ej. «Marketing de contenidos»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1440, items = c.items || [], n = items.length, total = n + 2;
      var fotos = ((mat && mat.fotos) || []).filter(function (f) { return f && f.w; });
      var P = c.portada || {}, C = c.cierre || {}, rub = (c.comun || {}).rubrica || '';
      var usadas = [], ultima = null;
      // la foto que mejor sirve para cada lámina: con espacio libre en las franjas que esa forma necesita, sin repetir
      // la anterior y prefiriendo las que no se han usado (si hay pocas, se repiten)
      var INFO = fotos.map(function (f) { var g = U.encuadre(f, W, H); return { f: f, g: g, z: zonasLibres(f, g, W, H) }; });
      function tomar(franjas, cond) {
        var mejor = null, mp = -1e9;
        INFO.forEach(function (q) {
          if (cond && !cond(q.f)) return;
          var p = 0; (franjas || ['arriba']).forEach(function (b) { var z = q.z[b]; p += z.tapada ? -400 : z.w; });
          if (q.f === ultima) p -= 5000; if (usadas.indexOf(q.f.id) >= 0) p -= 700;
          if (p > mp) { mp = p; mejor = q; }
        });
        if (!mejor && cond) return tomar(franjas);
        if (!mejor) return null;
        usadas.push(mejor.f.id); ultima = mejor.f; return mejor.f;
      }
      var laminas = [];
      laminas.push(portada());
      var alterna = 0;
      items.forEach(function (it, k) {
        var reg = (it.regadas || []).filter(function (r) { return r && r.t; });
        if (it.grito) laminas.push(conGrito(it, k + 1));
        else if (reg.length >= 3) laminas.push(regadas(it, reg, k + 1));
        else laminas.push((alterna++ % 2 === 0) ? centrada(it, k + 1) : alLado(it, k + 1));
      });
      laminas.push(cierre());
      return laminas;

      /* ── base de cada lámina: foto a sangre + velo + recorte (para lo que va detrás) + rúbrica y número ── */
      function base(i, f, opc) {
        opc = opc || {};
        var els = [], g = null, zs, mp = null;
        if (f) {
          g = U.encuadre(f, W, H);
          var foto = U.fotoEl(f, g, { brillo: .86, contraste: 1.04, sat: .82 });
          els.push(foto);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Sombra sobre la foto', papel: 'velo', interno: true, de: foto.id, fondo: 'linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 65%,rgba(0,0,0,.35))', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
          var rec = U.recorteEl(f, g, { brillo: .86, contraste: 1.04, sat: .82 }); if (rec) { rec.sigue = foto.id; els.push(rec); }
          mp = U.mapa(f, g, W, H);
        }
        zs = zonasLibres(f, g, W, H);
        var num = String(i + 1).padStart(2, '0'), izq = i % 2 === 0;
        els.push(
          T({ nombre: izq ? 'Rúbrica' : 'Número de lámina', papel: izq ? 'rubrica' : 'numero', txt: izq ? rub : num, x: 60, y: 56, tam: 22, peso: 500, color: 'rgba(255,255,255,.88)', espac: .01, z: 7 }),
          T({ nombre: izq ? 'Número de lámina' : 'Rúbrica', papel: izq ? 'numero' : 'rubrica', txt: izq ? num : rub, y: 56, tam: 22, peso: 500, color: 'rgba(255,255,255,.88)', espac: .01, z: 7, _der: W - 60 })
        );
        return { els: els, z: zs, g: g, mp: mp };
      }
      function lamina(b) { return { fondo: '@fondo', els: b.els }; }
      /* un grupo de renglones dentro de una zona: se encaja al ancho y se apila (arriba o desde abajo) */
      function grupo(b, lineas, zona, op) {
        op = op || {};
        var alin = op.alin || (zona.lado === 'der' ? 'right' : zona.lado === 'centro' ? 'center' : 'left');
        var gap = op.gap == null ? 16 : op.gap, x = op.x != null ? op.x : zona.x, w = op.w || zona.w;
        var ls = lineas.filter(function (l) { return l.txt; }).map(function (l) {
          function encajar(txt) { var an = anchoTxt(txt, l.tam, K[l.rol]); return an > w * .95 ? Math.floor(l.tam * w * .95 / an) : l.tam; }
          var txt = String(l.txt), tam = encajar(txt);
          // en una zona angosta, antes que achicar mucho la letra, se parte en más renglones (máx. 4)
          if (l.rol === 's' && tam < l.tam * .75) [18, 14, 11, 8].forEach(function (m) {
            var t2 = partir(String(l.txt).replace(/\n/g, ' '), m), t2m = encajar(t2);
            if (t2.split('\n').length <= 4 && t2m > tam * 1.08) { txt = t2; tam = t2m; }
          });
          var nl = txt.split('\n').length; l = Object.assign({}, l, { txt: txt });
          return { l: l, tam: tam, alto: nl * tam * LH[l.rol], an: Math.min(w, anchoTxt(txt, tam, K[l.rol])) };
        });
        if (!ls.length) return;
        var totalH = ls.reduce(function (s, q) { return s + q.alto; }, 0) + gap * (ls.length - 1);
        var y = op.abajo ? Math.round(zona.y + zona.h - 40 - totalH + (op.dy || 0)) : Math.round(zona.y + (op.arriba != null ? op.arriba : 70) + (op.dy || 0));
        ls.forEach(function (q) {
          var l = q.l, s = l.rol === 's';
          // regla 13: si el renglón se cruza con la persona, va DETRÁS del recorte
          var bx = alin === 'right' ? x + w - q.an : alin === 'center' ? x + (w - q.an) / 2 : x;
          var cruza = b.mp && b.mp.medir(Math.round(bx), Math.round(y), Math.round(q.an), Math.round(q.alto)).persona > .03;
          b.els.push(T({ nombre: l.nombre, papel: l.papel, txt: l.txt, x: x, y: Math.round(y), w: w, alin: alin, fuente: s ? '@titular' : '@cuerpo', cursiva: s, tam: q.tam, peso: s ? 500 : 400,
            color: s ? '@acento' : '#FFFFFF', colorAc: s ? '#FFFFFF' : '@acento', interl: LH[l.rol], espac: -.01, sombra: true, z: cruza ? 3 : 6 }));
          y += q.alto + gap;
        });
      }

      function portada() {
        var b = base(0, tomar(['arriba', 'abajo']));
        grupo(b, [{ rol: 's', txt: P.titular, tam: 150, nombre: 'Titular', papel: 'titular-portada' }, { rol: 't', txt: partir(P.sub, 12), tam: 60, nombre: 'Subtítulo', papel: 'sub-portada' }], b.z.arriba);
        grupo(b, [{ rol: 't', txt: partir(P.antes, 15), tam: 50, nombre: 'Frase de abajo', papel: 'antes-portada' }, { rol: 's', txt: P.remate, tam: 120, nombre: 'Remate', papel: 'remate-portada' }], b.z.abajo, { abajo: true });
        return lamina(b);
      }
      // A · centrada arriba: entrada + frase grande + detalle chiquito («Los que empiezan con “hola”.»)
      function centrada(it, i) {
        var b = base(i, tomar(['arriba']));
        var z = b.z.arriba, alin = z.llena || z.lado === 'centro' ? 'center' : null;
        grupo(b, [{ rol: 't', txt: partir(it.entrada, 24), tam: 58, nombre: 'Entrada', papel: 'entrada' }, { rol: 's', txt: partir(it.frase, 16), tam: 150, nombre: 'Frase', papel: 'frase' }, { rol: 't', txt: partir(it.detalle, 26), tam: 34, nombre: 'Detalle', papel: 'detalle' }], z, { alin: alin });
        return lamina(b);
      }
      // B · al lado libre: entrada + frase alineadas hacia donde no está la persona («…ya perdiste.»)
      function alLado(it, i) {
        var b = base(i, tomar(it.detalle ? ['arriba', 'abajo'] : ['arriba']));
        var z = b.z.arriba;
        grupo(b, [{ rol: 't', txt: partir(it.entrada, 22), tam: 50, nombre: 'Entrada', papel: 'entrada' }, { rol: 's', txt: partir(it.frase, 18), tam: 124, nombre: 'Frase', papel: 'frase' }], z, { alin: z.lado === 'izq' ? 'left' : 'right' });
        if (it.detalle) grupo(b, [{ rol: 't', txt: partir(it.detalle, 24), tam: 36, nombre: 'Detalle', papel: 'detalle' }], b.z.abajo, { abajo: true });
        return lamina(b);
      }
      // C · palabra gigante DETRÁS de la cabeza («¿Poooor?») + texto abajo en la zona libre
      function conGrito(it, i) {
        var f = tomar(['abajo'], function (x) { return x.recorte_url && x.cara; });
        var b = base(i, f), tam = 300, an = anchoTxt(it.grito, tam, K.s);
        if (an > 1000) tam = Math.floor(tam * 1000 / an);
        b.els.push(T({ nombre: 'Palabra gigante', papel: 'grito', txt: it.grito, x: 0, y: Math.round(H * 150 / 1440), w: W, alin: 'center', fuente: '@titular', cursiva: true, tam: tam, peso: 500, color: '@acento', interl: .95, espac: -.01, sombra: true, z: 3 }));
        grupo(b, [{ rol: 't', txt: partir(it.entrada, 17), tam: 40, nombre: 'Entrada', papel: 'entrada' }, { rol: 's', txt: partir(it.frase, 18), tam: 90, nombre: 'Frase', papel: 'frase' }, { rol: 't', txt: partir(it.detalle, 24), tam: 34, nombre: 'Detalle', papel: 'detalle' }], b.z.abajo, { abajo: true });
        return lamina(b);
      }
      // D · frases regadas por la foto: dos arriba y dos abajo, alternando lados («Errores.» «Confesiones.»…)
      function regadas(it, reg, i) {
        var f = tomar(['arriba', 'abajo']), b = base(i, f), A = b.z.arriba, Z = b.z.abajo;
        var d1 = Math.round(H * 230 / 1440), d2 = Math.round(H * 170 / 1440), ancho = Math.round((W - 120) * .72);
        // franja libre de lado a lado: una a la izquierda y otra a la derecha, como la referencia;
        // si la persona ocupa parte de la franja, las dos van juntas en el lado libre
        var L = reg.slice(0, 4).map(function (r, k) { return { rol: 's', txt: partir(r.t, 16), tam: 94, nombre: 'Frase regada ' + (k + 1), papel: 'regada' }; });
        var arriba = L.slice(0, 2), abajo = L.slice(2);
        function par(zona, ls, esAbajo) {
          if (zona.llena) ls.forEach(function (l, k) {     // de lado a lado: una a la izquierda y otra a la derecha
            var der = k % 2 === 1;
            grupo(b, [l], { x: der ? W - 60 - ancho : 60, y: zona.y, w: ancho, h: zona.h }, { alin: der ? 'right' : 'left', abajo: esAbajo, dy: esAbajo ? (k === 0 && ls.length > 1 ? -Math.max(d2, Math.round(ls[1].txt.split('\n').length * 94 * .95 + 14)) : 0) : (k === 1 ? d1 : 0) });
          });
          else grupo(b, ls, zona, { alin: zona.lado === 'der' ? 'right' : 'left', abajo: esAbajo, gap: 40 });   // juntas en el lado libre
        }
        par(A, arriba, false); if (abajo.length) par(Z, abajo, true);
        if (it.entrada) grupo(b, [{ rol: 't', txt: partir(it.entrada, 24), tam: 38, nombre: 'Entrada', papel: 'entrada' }], b.z.medio, { arriba: 20 });
        return lamina(b);
      }
      function cierre() {
        var b = base(total - 1, tomar(['arriba', 'medio', 'abajo']));
        var A = b.z.arriba;
        grupo(b, [{ rol: 's', txt: partir(C.frase, 12), tam: 96, nombre: 'Frase de cierre', papel: 'frase-cierre' }, { rol: 't', txt: partir(C.pregunta, 14), tam: 38, nombre: 'Pregunta', papel: 'pregunta' }], A, { alin: A.lado === 'izq' ? 'left' : 'right' });
        var M = b.z.medio;
        grupo(b, [{ rol: 't', txt: partir(C.aparte, 16), tam: 36, nombre: 'Pregunta aparte', papel: 'aparte' }], M, { arriba: 20, alin: M.lado === 'der' ? 'right' : 'left' });
        var Z = b.z.abajo;
        grupo(b, [{ rol: 't', txt: partir(C.antes, 20), tam: 34, nombre: 'Frase de abajo', papel: 'antes-cierre' }, { rol: 's', txt: partir(C.remate, 12), tam: 80, nombre: 'Remate', papel: 'remate-cierre' }], Z, { abajo: true, alin: Z.lado === 'der' ? 'right' : 'left' });
        return lamina(b);
      }
    }
  });
})();

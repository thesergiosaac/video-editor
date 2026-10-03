/* letra.js — familia «Letra viva» (copia de @guille.colladomk). Una foto tuya a sangre en cada lámina; letra condensada
   gruesa en el color de acento + manuscrita blanca que se MONTA encima de ella + palabritas en sans gruesa que las unen.
   Número «1/6» grande arriba a la izquierda. En portada y cierre, una palabra gigante arriba con la persona DELANTE
   (recorte alineado); lo demás va en las zonas libres de la foto. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;

  /* ── ayudas: zonas libres alrededor de la persona (igual que detectar.py, con la rejilla de la foto) ── */
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
      if (z - a < 260) { out[b[0]] = Object.assign(todo(b[1], b[2]), { tapada: true }); return; }
      var cx = (a + z) / 2;
      out[b[0]] = { x: a, y: ya, w: z - a, h: yb - ya, lado: cx < W * .42 ? 'izq' : cx > W * .58 ? 'der' : 'centro', llena: z - a > W - 2 * M - 20 };
    });
    return out;
  }
  function anchoTxt(t, tam, k) {
    return String(t).split('\n').reduce(function (m, l) {
      var s = 0; for (var i = 0; i < l.length; i++) { var ch = l[i];
        if (' .,;:!¡\'’|iíìl1tfjrI«»'.indexOf(ch) >= 0) s += .55; else if ('mwMWÑ@%'.indexOf(ch) >= 0) s += 1.45; else if (ch !== ch.toLowerCase()) s += 1.2; else s += 1; }
      return Math.max(m, s * tam * k);
    }, 0);
  }
  /* los tres papeles de letra de la referencia: c = condensada (acento), s = manuscrita (blanca), t = sans gruesa */
  var E = {
    c: { fuente: '@titular', peso: 400, color: '@acento', interl: .86, espac: -.01, mayus: true, k: .42 },
    s: { fuente: '@mano', peso: 400, color: '#FFFFFF', interl: .6, espac: 0, mayus: false, k: .40 },
    t: { fuente: '@cuerpo', peso: 800, color: '#FFFFFF', interl: 1.05, espac: -.02, mayus: false, k: .61 },
  };

  FAMILIAS.registrar('letra', {
    catalogo: { letras: { titular: 'Anton', mano: 'Allura', cuerpo: 'Inter' }, colores: { principal: '#FFD60A', acento: '#FFD60A', fondo: '#111111', texto: '#FFFFFF' } },
    esquema: {
      nombre: 'Letra viva', nItems: 6, iconos: U.ICONOS_OK,
      guia: 'Carrusel de lista corta con UNA foto tuya en cada lámina: cada lámina es un punto de la lista dicho en 3 pedacitos que se leen como una sola frase — una palabra GRANDE (la que pega el golpe), un complemento a mano y, si hace falta, una palabrita que las une. Sirve para opinión, hábitos y motivación («6 cosas que matan tus ganas de crear»).',
      portada: {
        grande: { max: 9, desc: 'número + palabra que va gigante arriba (p. ej. «6 cosas»)' },
        antes: { max: 20, desc: 'palabras que siguen, en sans (p. ej. «que matan tus»)' },
        mano: { max: 10, desc: 'UNA palabra a mano, montada sobre la de abajo (p. ej. «ganas»)' },
        fuerte: { max: 12, desc: 'el cierre del título en letra grande (p. ej. «de crear»)' },
      },
      item: {
        antes: { max: 22, desc: 'opcional: palabritas que abren (p. ej. «esperar la»); vacío si la grande va primero' },
        grande: { max: 12, desc: 'UNA o dos palabras que resumen el punto, la que se ve de lejos (p. ej. «idea», «compararte»)' },
        mano: { max: 18, desc: 'complemento corto a mano que se monta sobre la grande (p. ej. «perfecta», «con los demás»); vacío si no hace falta' },
        despues: { max: 22, desc: 'opcional: palabritas que terminan la frase (p. ej. «todo el tiempo»); vacío en la mayoría' },
      },
      cierre: {
        grande: { max: 6, desc: 'UNA palabra corta que va gigante arriba, abre la pregunta (p. ej. «¿Cuál»)' },
        fuerte: { max: 14, desc: 'el resto de la pregunta en letra grande (p. ej. «te pasa a ti?»)' },
        antes: { max: 22, desc: 'invitación en sans (p. ej. «cuéntamelo en los»)' },
        mano: { max: 12, desc: 'la palabra final a mano (p. ej. «comentarios»)' },
      },
      comun: {},
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1440, items = c.items || [], n = items.length;
      var fotos = ((mat && mat.fotos) || []).filter(function (f) { return f && f.w; });
      var P = c.portada || {}, C = c.cierre || {};
      var usadas = [], ultima = null;
      var INFO = fotos.map(function (f) { var g = U.encuadre(f, W, H); return { f: f, g: g, z: zonasLibres(f, g, W, H) }; });
      // la foto que mejor sirve para cada lámina: espacio libre en las franjas que necesita, sin repetir la anterior
      function tomar(franjas, cond) {
        var mejor = null, mp = -1e9;
        INFO.forEach(function (q) {
          if (cond && !cond(q.f)) return;
          var p = 0; franjas.forEach(function (b) { var z = q.z[b]; p += z.tapada ? -400 : z.w; });
          if (q.f === ultima) p -= 5000; if (usadas.indexOf(q.f.id) >= 0) p -= 700;
          if (p > mp) { mp = p; mejor = q; }
        });
        if (!mejor && cond) return tomar(franjas);
        if (!mejor) return null;
        usadas.push(mejor.f.id); ultima = mejor.f; return mejor.f;
      }

      var laminas = [portadaOCierre(0, P.grande, [{ e: 't', txt: P.antes, tam: 58, nombre: 'Frase de abajo', papel: 'antes-portada' }, { e: 's', txt: P.mano, tam: 190, mt: -.2, mb: -.3, ml: .3, nombre: 'Palabra a mano', papel: 'mano-portada' }, { e: 'c', txt: P.fuerte, tam: 200, nombre: 'Remate', papel: 'fuerte-portada' }], 290, 70)];
      items.forEach(function (it, k) { laminas.push(interior(it, k + 1)); });
      laminas.push(portadaOCierre(n + 1, C.grande, [{ e: 'c', txt: C.fuerte, tam: 150, nombre: 'Pregunta', papel: 'fuerte-cierre' }, { e: 't', txt: C.antes, tam: 52, nombre: 'Invitación', papel: 'antes-cierre' }, { e: 's', txt: C.mano, tam: 160, mt: -.25, nombre: 'Palabra a mano', papel: 'mano-cierre' }], 330, 60));
      return laminas;

      function base(f) {
        var els = [], g = null, mp = null;
        if (f) {
          g = U.encuadre(f, W, H);
          var foto = U.fotoEl(f, g, { brillo: .78, contraste: 1.1, sat: .9 });
          els.push(foto);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Sombra sobre la foto', papel: 'velo', interno: true, de: foto.id, fondo: 'linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 35%,rgba(0,0,0,0) 62%,rgba(0,0,0,.4))', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
          var rec = U.recorteEl(f, g); if (rec) { rec.sigue = foto.id; els.push(rec); }
          mp = U.mapa(f, g, W, H);
        }
        return { els: els, g: g, mp: mp, z: zonasLibres(f, g, W, H) };
      }
      /* un grupo de renglones: cada uno se encaja al ancho de la zona (sin partirse) y se apila; la manuscrita se monta
         sobre el renglón de arriba con margen negativo, como en la referencia */
      function grupo(b, lineas, zona, op) {
        op = op || {};
        var alin = op.alin || (zona.llena || zona.lado === 'centro' ? 'center' : zona.lado === 'der' ? 'right' : 'left');
        var gap = 10, x = zona.x, w = zona.w;
        var ls = lineas.filter(function (l) { return l.txt; }).map(function (l) {
          var e = E[l.e], txt = String(l.txt), med = e.mayus ? txt.toUpperCase() : txt, tam = l.tam, an = anchoTxt(med, tam, e.k);
          if (an > w * .96) tam = Math.floor(tam * w * .96 / an);
          return { l: l, e: e, tam: tam, alto: tam * e.interl, an: Math.min(w, anchoTxt(med, tam, e.k)), mt: (l.mt || 0) * tam, mb: (l.mb || 0) * tam };
        });
        if (!ls.length) return;
        var totalH = ls.reduce(function (s, q, i) { return s + q.alto + q.mt + q.mb + (i ? gap : 0); }, 0);
        var y = op.abajo ? zona.y + zona.h - 40 - totalH : zona.y + 70;
        ls.forEach(function (q, i) {
          if (i) y += gap; y += q.mt;
          var ml = (q.l.ml || 0) * q.tam, bx = alin === 'right' ? x + w - q.an : alin === 'center' ? x + (w - q.an) / 2 : x + ml;
          // regla 13: si el renglón cruza a la persona (cara o torso), va DETRÁS del recorte. El bloque de abajo cruza
          // piernas: ahí el texto va ENCIMA, si no las piernas se comen letras («DE CR▯AR»)
          var cruza = !op.abajo && b.mp && b.mp.medir(Math.round(bx), Math.round(y), Math.round(q.an), Math.round(q.tam * .9)).persona > .03;
          b.els.push(T({ nombre: q.l.nombre, papel: q.l.papel, txt: q.l.txt, x: Math.round(x + (alin === 'left' ? ml : 0)), y: Math.round(y), w: w, alin: alin, fuente: q.e.fuente, tam: q.tam, peso: q.e.peso,
            color: q.e.color, colorAc: '#FFFFFF', interl: q.e.interl, espac: q.e.espac, mayus: q.e.mayus, sombra: true, z: cruza ? 3 : (q.l.e === 's' ? 7 : 6) }));
          y += q.alto + q.mb;
        });
      }
      // portada y cierre: la palabra gigante arriba, detrás de la persona, y el resto abajo
      function portadaOCierre(i, grande, lineas, tamG, top) {
        var b = base(tomar(['abajo'], function (f) { return f.recorte_url && f.cara; }));
        if (grande) {
          var med = String(grande).toUpperCase(), tam = tamG, an = anchoTxt(med, tam, E.c.k);
          if (an > 1000) tam = Math.floor(tam * 1000 / an);
          b.els.push(T({ nombre: 'Palabra gigante', papel: 'grande-' + (i ? 'cierre' : 'portada'), txt: grande, x: 0, y: Math.round(top * H / 1440), w: W, alin: 'center', fuente: '@titular', tam: tam, peso: 400, color: '@acento', interl: .86, espac: -.01, mayus: true, sombra: true, z: 3 }));
        }
        var Z = b.z.abajo, fija = { x: 60, y: Math.round(H * .68), w: W - 120, h: Math.round(H * .32) - 60 };
        grupo(b, lineas, fija, { abajo: true, alin: Z.lado === 'der' && !Z.llena ? 'right' : 'left' });
        return { fondo: '@fondo', els: b.els };
      }
      function interior(it, k) {
        var b = base(tomar(['arriba'])), A = b.z.arriba, Z = b.z.abajo, abajo = false;
        // si arriba queda muy angosto (la cara ocupa la franja) y abajo hay más espacio, el grupo baja
        if (A.w < 600 && !Z.tapada && Z.w > A.w * 1.4) { A = Z; abajo = true; }
        var g = String(it.grande || ''), m = String(it.mano || '');
        grupo(b, [
          { e: 't', txt: it.antes, tam: 56, nombre: 'Palabras de arriba', papel: 'antes' },
          { e: 'c', txt: g, tam: g.length <= 5 ? 260 : g.length <= 8 ? 230 : 190, nombre: 'Palabra grande', papel: 'grande' },
          { e: 's', txt: m, tam: m.length <= 9 ? 170 : 130, mt: -.28, nombre: 'Frase a mano', papel: 'mano' },
          { e: 't', txt: it.despues, tam: 50, nombre: 'Palabras de abajo', papel: 'despues' }
        ], A, { abajo: abajo });
        b.els.push(T({ nombre: 'Número', papel: 'numero', txt: k + '/' + n, x: 50, y: 40, fuente: '@cuerpo', tam: 76, peso: 800, color: '#FFFFFF', espac: -.03, interl: 1.15, z: 9 }));
        return { fondo: '@fondo', els: b.els };
      }
    }
  });
})();

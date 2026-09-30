/* charla.js — familia «Cine callado» (copia de @lacharlaok). Fotos tuyas en tonos tierra, una grotesca apretada que mezcla
   negrita y regular en la MISMA frase, textos chicos con mucho aire, palabras separadas («NO   PASA   NADA.»), etiquetas
   blancas con texto negro, una lámina partida (bloque terracota arriba + foto abajo con palabras regadas a los lados de
   la persona) y una lámina crema con la foto pequeña al centro. El texto sobre foto va donde no está la persona. */
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
    return String(t).replace(/\*/g, '').split('\n').reduce(function (m, l) {
      var s = 0; for (var i = 0; i < l.length; i++) { var ch = l[i];
        if (' .,;:!¡\'’|iíìl1tfjrI«»· '.indexOf(ch) >= 0) s += .55; else if ('mwMWÑ@%'.indexOf(ch) >= 0) s += 1.45; else if (ch !== ch.toLowerCase()) s += 1.2; else s += 1; }
      return Math.max(m, s * tam * k);
    }, 0);
  }
  // parte un texto en renglones que quepan en «ancho» px (si ya trae saltos, se respetan); no deja un *resaltado* abierto
  function partir(t, tam, k, ancho) {
    t = String(t || '').trim(); if (!t || t.indexOf('\n') >= 0 || anchoTxt(t, tam, k) <= ancho) return t;
    var pal = t.split(/\s+/), l = [], cur = '';
    pal.forEach(function (p) { var prueba = cur ? cur + ' ' + p : p; if (cur && anchoTxt(prueba, tam, k) > ancho) { l.push(cur); cur = p; } else cur = prueba; });
    if (cur) l.push(cur);
    var abierto = false;   // el *resaltado* se cierra al final de cada renglón y se reabre en el siguiente
    return l.map(function (r) { var s = (abierto ? '*' : '') + r, n = (r.match(/\*/g) || []).length; if (n % 2) abierto = !abierto; return s + (abierto ? '*' : ''); }).join('\n');
  }
  var NB = '      ';   // el aire entre palabras de «NO   PASA   NADA.»
  /* los papeles de la referencia: B = negrita apretada en mayúsculas, r = regular (con *negrita* adentro), n = semi, e = etiqueta */
  var E = {
    B: { fuente: '@titular', peso: 800, interl: .9, espac: -.045, mayus: true, k: .51 },
    r: { fuente: '@cuerpo', peso: 400, interl: 1.12, espac: -.035, mayus: false, k: .49 },
    n: { fuente: '@cuerpo', peso: 700, interl: 1.12, espac: -.035, mayus: false, k: .55 },
  };

  FAMILIAS.registrar('charla', {
    catalogo: { letras: { titular: 'Inter Tight', mano: 'Inter Tight', cuerpo: 'Inter Tight' }, colores: { principal: '#9A4B26', acento: '#FFFFFF', fondo: '#F3ECDC', texto: '#5B2C16' } },
    esquema: {
      nombre: 'Cine callado', nItems: 5, iconos: U.ICONOS_OK,
      guia: 'Carrusel de reflexión con tus fotos, en tono de cine: frases cortas y tranquilas, con pocas palabras en negrita dentro de la frase. Cada lámina dice una idea en pedacitos (una entrada, una idea fuerte corta, una explicación y un remate). Sirve para marca personal, historias y reflexión; no para tutoriales.',
      portada: {
        arriba: { max: 16, desc: 'primera parte del gancho, en mayúsculas grandes (p. ej. «si nadie te ve»)' },
        puente: { max: 30, desc: 'palabras chicas que unen (p. ej. «hasta el final, es porque»)' },
        golpe: { max: 22, desc: 'el remate del gancho, grande (p. ej. «no sabe quién eres.»)' },
      },
      item: {
        intro: { max: 32, desc: 'entrada corta con la primera palabra o dos en *negrita* (p. ej. «*Antes de* grabar,»)' },
        titulo: { max: 20, desc: 'la idea fuerte en 2–4 palabras, se ve grande (p. ej. «empieza por ti.»)' },
        texto: { max: 90, desc: 'explicación en 1–2 frases, con 2–3 palabras clave en *negrita* (p. ej. «*Primero* escribe lo que te pasó. *Después* lo que aprendiste.»)' },
        remate: { max: 60, desc: 'frase final corta que cierra la lámina (p. ej. «Y ahí sí, prende la cámara.»); puede llevar una palabra en *negrita*' },
        puntos: { lista: 4, desc: '2 a 4 frases muy cortas de la misma idea (p. ej. «tu forma de hablar», «lo que te molesta»); en algunas láminas se riegan alrededor de ti', campos: { t: { max: 20, desc: 'frase de 2–4 palabras, sin punto' } } },
      },
      cierre: {
        pregunta: { max: 40, desc: 'pregunta que identifica al que lee, grande (p. ej. «¿Sientes que tienes mucho para decir»)' },
        sigue: { max: 40, desc: 'el final de la pregunta, con UNA palabra en *negrita* (p. ej. «pero no sabes cómo *ordenarlo*?»)' },
        boton: { max: 32, desc: 'lo que tiene que hacer, en mayúsculas (p. ej. «Guárdalo para tu próximo guion»)' },
        boton_sub: { max: 44, desc: 'frase chiquita debajo del botón (p. ej. «y empieza por contar de dónde vienes :)»)' },
      },
      comun: {},
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1440, k0 = H / 1440, items = c.items || [], n = items.length;
      var fotos = ((mat && mat.fotos) || []).filter(function (f) { return f && f.w; });
      var P = c.portada || {}, C = c.cierre || {};
      var usadas = [], ultima = null;
      var INFO = fotos.map(function (f) { var g = U.encuadre(f, W, H); return { f: f, g: g, z: zonasLibres(f, g, W, H) }; });
      function tomar(franjas, extra) {
        var mejor = null, mp = -1e9;
        INFO.forEach(function (q) {
          var p = 0; franjas.forEach(function (b) { var z = q.z[b]; p += z.tapada ? -400 : z.w; });
          if (extra) p += extra(q);
          if (q.f === ultima) p -= 5000; if (usadas.indexOf(q.f.id) >= 0) p -= 700;
          if (p > mp) { mp = p; mejor = q; }
        });
        if (!mejor) return null;
        usadas.push(mejor.f.id); ultima = mejor.f; return mejor.f;
      }
      // qué forma lleva cada item (en un carrusel ninguna se repite mientras alcancen)
      var ORDEN = n <= 3 ? ['bn', 'partida', 'crema'] : n === 4 ? ['bn', 'etiqueta', 'partida', 'crema'] : ['bn', 'etiqueta', 'partida', 'derecha', 'crema'];
      var laminas = [portada()];
      items.forEach(function (it, k) { var f = ORDEN[k % ORDEN.length]; laminas.push(f === 'bn' ? bn(it) : f === 'etiqueta' ? etiqueta(it) : f === 'partida' ? partida(it) : f === 'derecha' ? derecha(it) : crema(it)); });
      laminas.push(cierre());
      return laminas;

      function sobreFoto(f, opc) {
        opc = opc || {};
        var els = [], g = null, mp = null;
        if (f) {
          g = U.encuadre(f, W, H);
          var foto = U.fotoEl(f, g, opc.bn ? { brillo: .7, contraste: 1.1, sat: 1, bn: true } : { brillo: .74, contraste: 1.06, sat: .78 });
          els.push(foto);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Sombra sobre la foto', papel: 'velo', interno: true, de: foto.id, fondo: 'linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,0) 40%,rgba(0,0,0,.35))', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
          var rec = U.recorteEl(f, g); if (rec) { rec.sigue = foto.id; els.push(rec); }
          mp = U.mapa(f, g, W, H);
        }
        // sin foto: fondo crema y letra café
        return { els: els, g: g, mp: mp, z: zonasLibres(f, g, W, H), color: f ? '#FFFFFF' : '@texto', sombra: !!f };
      }
      /* un grupo de renglones: cada uno se encaja al ancho de la zona y se apila; «alin» por renglón si hace falta */
      function grupo(b, lineas, zona, op) {
        op = op || {};
        var alinG = op.alin || (zona.llena || zona.lado === 'centro' ? 'center' : zona.lado === 'der' ? 'right' : 'left');
        var gap = op.gap == null ? 10 : op.gap, x = zona.x, w = zona.w;
        function medirTodo(f) {
          return lineas.filter(function (l) { return l.txt; }).map(function (l) {
            var e = E[l.e], may = (e.mayus || l.mayus) && !l.minus, txt = String(l.txt), med = may ? txt.toUpperCase() : txt, t0 = Math.round(l.tam * f);
            if (l.partir) { txt = partir(txt, t0, e.k, Math.min(w, l.partir)); med = may ? txt.toUpperCase() : txt; }
            var pad = l.eti ? 44 : 0, tam = t0, an = anchoTxt(med, tam, e.k) + pad;
            if (an > w * .97) tam = Math.floor(tam * (w * .97 - pad) / (an - pad));
            var nl = txt.split('\n').length, alto = nl * tam * e.interl + (l.eti ? 28 : 0);
            return { l: l, e: e, may: may, txt: txt, tam: tam, alto: alto, an: Math.min(w, anchoTxt(med, tam, e.k) + pad), mt: Math.round((l.mt || 0) * f) };
          });
        }
        var fac = 1, ls = medirTodo(1);
        if (!ls.length) return;
        var alto = function () { return ls.reduce(function (s, q, i) { return s + q.alto + q.mt + (i ? gap : 0); }, 0); };
        var off = op.arriba != null ? op.arriba : 70, cabe = zona.h - (op.abajo ? 40 : 10);
        // si el grupo no cabe en su franja, primero se sube y después se achica todo parejo
        for (var v = 0; v < 6 && alto() > cabe; v++) { fac *= Math.max(.7, cabe / alto()); ls = medirTodo(fac); }
        var totalH = alto();
        var y = op.abajo ? zona.y + zona.h - 40 - totalH : zona.y + Math.max(0, Math.min(off, zona.h - 10 - totalH));
        ls.forEach(function (q, i) {
          if (i) y += gap; y += q.mt;
          var alin = q.l.alin || alinG, bx = alin === 'right' ? x + w - q.an : alin === 'center' ? x + (w - q.an) / 2 : x;
          var cruza = b.mp && b.mp.medir(Math.round(bx), Math.round(y), Math.round(q.an), Math.round(q.alto)).persona > .03;
          var el = { nombre: q.l.nombre, papel: q.l.papel, txt: q.txt, y: Math.round(y), alin: alin, fuente: q.e.fuente, tam: q.tam, peso: q.l.peso || q.e.peso,
            color: q.l.eti ? '#111111' : b.color, colorAc: q.l.eti ? '#111111' : b.color, modoAc: 'negrita', interl: q.e.interl, espac: q.e.espac, mayus: q.may, sombra: b.sombra && !q.l.eti, z: cruza ? 3 : 6 };
          if (q.l.eti) {   // etiqueta blanca: del ancho de su texto, pegada al lado que toca
            el.caja = { fondo: '#FFFFFF', radio: 0, padV: 14, padH: 22 };
            if (alin === 'right') el._der = x + w; else el.x = Math.round(bx);
          } else { el.x = x; el.w = w; }
          b.els.push(T(el));
          y += q.alto;
        });
      }
      function lam(b, fondo) { return { fondo: fondo || '@fondo', els: b.els }; }

      // Portada: gancho centrado arriba, grande / chico / grande
      function portada() {
        var b = sobreFoto(tomar(['arriba'], function (q) { return q.z.arriba.llena ? 300 : 0; }));
        grupo(b, [
          { e: 'B', txt: P.arriba, tam: 116, nombre: 'Titular', papel: 'titular-portada' },
          { e: 'r', txt: P.puente, tam: 44, mt: 10, nombre: 'Puente', papel: 'puente-portada' },
          { e: 'B', txt: P.golpe, tam: 116, mt: 10, partir: 640, nombre: 'Golpe', papel: 'golpe-portada' }
        ], b.z.arriba, { alin: 'center' });
        return lam(b);
      }
      // En blanco y negro: puntos arriba a un lado, frase al otro, y abajo «NO   PASA   NADA.»
      function bn(it) {
        var b = sobreFoto(tomar(['arriba', 'abajo']), { bn: true }), A = b.z.arriba;
        var ps = (it.puntos || []).filter(function (p) { return p && p.t; }).slice(0, 2);
        var izq = A.lado !== 'der', ls = ps.map(function (p, k) { return { e: 'n', txt: '· ' + p.t.replace(/\.?$/, '.'), tam: 44, nombre: 'Punto ' + (k + 1), papel: 'punto' }; });
        ls.push({ e: 'r', txt: it.texto, tam: 40, mt: 40, partir: 600, alin: izq ? 'right' : 'left', nombre: 'Texto', papel: 'texto' });
        grupo(b, ls, A.llena ? A : { x: 60, y: A.y, w: W - 120, h: A.h }, { alin: izq ? 'left' : 'right' });
        // abajo, centrado de lado a lado; si la persona ocupa el centro de abajo, va en el lado libre (con menos aire)
        var Z = b.z.abajo, ancha = Z.llena || Z.tapada;
        var aire = String(it.titulo || '').trim().split(/\s+/).join(ancha ? NB : NB.slice(0, 3));
        grupo(b, [
          { e: 'r', txt: it.intro, tam: 44, nombre: 'Entrada', papel: 'intro' },
          { e: 'n', txt: aire, tam: 50, nombre: 'Frase con aire', papel: 'titulo', mayus: true, peso: 700 }
        ], ancha ? { x: 60, y: Math.round(H * .68), w: W - 120, h: Math.round(H * .32) - 60 } : Z, { alin: ancha ? 'center' : Z.lado === 'der' ? 'right' : 'left', abajo: true });
        return lam(b);
      }
      // Etiquetas blancas arriba (lo que hay que oír) + explicación abajo a la izquierda
      function etiqueta(it) {
        var b = sobreFoto(tomar(['arriba', 'abajo'])), A = b.z.arriba, Z = b.z.abajo;
        var lado = A.lado === 'izq' ? 'left' : 'right';
        grupo(b, [
          { e: 'n', txt: it.titulo, tam: 44, eti: true, peso: 800, mayus: true, nombre: 'Etiqueta', papel: 'etiqueta' },
          { e: 'r', txt: it.intro, tam: 40, eti: true, partir: 330, nombre: 'Etiqueta 2', papel: 'etiqueta-2' }
        ], A, { alin: lado, gap: 0 });
        var zb = Z.tapada ? { x: 60, y: Z.y, w: W - 120, h: Z.h } : Z;
        grupo(b, [
          { e: 'r', txt: it.texto ? '· ' + it.texto : '', tam: 36, partir: 560, nombre: 'Texto', papel: 'texto' },
          { e: 'r', txt: it.remate, tam: 36, mt: 26, partir: 560, nombre: 'Remate', papel: 'remate' }
        ], zb, { alin: Z.lado === 'der' && !Z.llena ? 'right' : 'left', abajo: true });
        return lam(b);
      }
      // Lámina partida: bloque de color arriba con la idea + foto abajo con frases regadas a los lados de la persona
      function partida(it) {
        // aquí sirve la persona de pie y angosta (las frases van a sus lados), aunque la foto ya se haya usado
        var f = tomar([], function (q) { var p = q.g.persona; return p ? p[3] / H * 2000 - (p[2] / W > .5 ? 800 : 0) : -300; });
        var corte = Math.round(560 * k0), els = [], b = { els: els, mp: null, color: '#FFFFFF', sombra: false };
        var pr = null;
        if (f) {
          var g = U.encuadre(f, W, H), baja = corte - Math.round(80 * k0);
          g.y += baja;
          var foto = U.fotoEl(f, g, { brillo: .72, contraste: 1.06, sat: .78 });
          els.push(foto);
          var rec = U.recorteEl(f, g); if (rec) { rec.sigue = foto.id; els.push(rec); }
          b.mp = U.mapa(f, g, W, H);
          if (g.persona) pr = [g.persona[0], g.persona[1] + baja, g.persona[2], g.persona[3]];
        }
        els.push({ id: nid(), tipo: 'forma', nombre: 'Bloque de color', papel: 'bloque', fondo: '@principal', x: 0, y: 0, w: W, h: corte, z: 5, rot: 0, op: 1, radio: 0 });
        var zc = { x: 120, y: Math.round(130 * k0), w: W - 240, h: corte };
        grupo(b, [
          { e: 'r', txt: it.intro, tam: 40, nombre: 'Entrada', papel: 'intro' },
          { e: 'B', txt: it.titulo, tam: 120, mt: 4, nombre: 'Titular', papel: 'titulo' },
          { e: 'r', txt: it.texto, tam: 34, mt: 30, partir: 820, nombre: 'Texto', papel: 'texto' }
        ], zc, { alin: 'center', arriba: 0 });
        b.els.forEach(function (e) { if (e.tipo === 'texto') e.z = 7; });
        // las frases, alternando lados, al lado de la persona (si no cabe, la letra se achica)
        var ps = (it.puntos || []).filter(function (p) { return p && p.t; }).slice(0, 4);
        var px0 = pr ? pr[0] : W / 2 - 150, px1 = pr ? pr[0] + pr[2] : W / 2 + 150, py = pr ? Math.max(corte + 40, pr[1]) : corte + 60;
        var ocupadas = [];
        ps.forEach(function (p, k) {
          var izq = k % 2 === 0, y = Math.min(py + Math.round([120, 260, 420, 560][k] * k0), H - 90);
          var an = Math.min(W / 2 - 80, anchoTxt(p.t, 34, E.n.k) + 10);
          // busca, desde su altura hacia abajo (y luego hacia arriba), un sitio a ese lado donde NO esté la persona
          if (b.mp) {
            var libre = function (yy, iz) {
              var bx = iz ? 60 : W - 60 - an;
              if (ocupadas.some(function (o) { return Math.abs(o - yy) < 52; })) return false;
              return b.mp.medir(bx, yy, Math.round(an), 40).persona < .02;
            };
            var hallado = null;
            // el sitio libre más cercano a su altura, a su lado si se puede, y siempre debajo de la anterior
            // (se leen en orden); si ya no queda espacio debajo, cualquiera libre
            var minY = ocupadas.length ? ocupadas[ocupadas.length - 1] + 50 : corte + 30;
            [minY, corte + 30].some(function (desde) {
              var mejorC = 1e9;
              for (var yy = desde; yy < H - 80; yy += 15) [izq, !izq].forEach(function (iz) {
                if (!libre(yy, iz)) return;
                var costo = Math.abs(yy - y) + (iz === izq ? 0 : 150);
                if (costo < mejorC) { mejorC = costo; hallado = [yy, iz]; }
              });
              return !!hallado;
            });
            if (hallado) { y = hallado[0]; izq = hallado[1]; }
          }
          ocupadas.push(y);
          var zona = izq ? { x: 60, y: y, w: Math.max(240, px0 - 80), h: 60 } : { x: Math.min(W - 300, px1 + 20), y: y, w: W - 60 - Math.min(W - 300, px1 + 20), h: 60 };
          if (hallado) zona = izq ? { x: 60, y: y, w: Math.round(an) + 20, h: 60 } : { x: W - 80 - Math.round(an), y: y, w: Math.round(an) + 20, h: 60 };
          var bb = { els: b.els, mp: b.mp, color: '#FFFFFF', sombra: true };
          grupo(bb, [{ e: 'n', txt: p.t, tam: 34, nombre: 'Frase regada ' + (k + 1), papel: 'regada' }], zona, { alin: izq ? 'left' : 'right', arriba: 0 });
        });
        return { fondo: '@principal', els: b.els };
      }
      // A la derecha (o al lado libre): entrada con negrita, idea grande, explicación chiquita y remate
      function derecha(it) {
        var b = sobreFoto(tomar(['arriba'])), A = b.z.arriba;
        grupo(b, [
          { e: 'r', txt: it.intro, tam: 46, nombre: 'Entrada', papel: 'intro' },
          { e: 'B', txt: it.titulo, tam: 110, mt: 4, partir: 520, nombre: 'Titular', papel: 'titulo' },
          { e: 'r', txt: it.texto, tam: 32, mt: 16, partir: 520, nombre: 'Texto', papel: 'texto' },
          { e: 'r', txt: it.remate, tam: 30, mt: 4, partir: 520, nombre: 'Remate', papel: 'remate' }
        ], A, { alin: A.lado === 'izq' ? 'left' : 'right' });
        return lam(b);
      }
      // Crema: frase arriba, la foto pequeña al centro y la idea abajo (sin foto: solo el texto)
      function crema(it) {
        var f = tomar([], function (q) { return q.f.cara ? 200 - Math.abs((q.g.cara[0] + q.g.cara[2] / 2) - W / 2) : 0; });
        var b = { els: [], mp: null, color: '@texto', sombra: false };
        grupo(b, [
          { e: 'B', txt: it.titulo, tam: 60, minus: true, nombre: 'Titular', papel: 'titulo' },
          { e: 'r', txt: it.intro, tam: 40, mt: 8, partir: 480, nombre: 'Entrada', papel: 'intro' }
        ], { x: 60, y: Math.round(170 * k0), w: W - 120, h: 200 }, { alin: 'center', arriba: 0 });
        if (f) {
          var fw = 420, fh = Math.round(540 * k0), fx = 330, fy = Math.round(440 * k0);
          b.els.push(U.fotoEl(f, { x: fx, y: fy, w: fw, h: fh }, { nombre: 'Tu foto', zoom: 1.5, brillo: .92, contraste: 1, sat: .8 }));
        }
        grupo(b, [
          { e: 'r', txt: it.texto, tam: 40, partir: 760, nombre: 'Texto', papel: 'texto' },
          { e: 'B', txt: it.remate, tam: 74, mt: 0, nombre: 'Remate', papel: 'remate' }
        ], { x: 60, y: Math.round(1040 * k0), w: W - 120, h: 300 }, { alin: 'center', arriba: 0 });
        return lam(b, '@fondo');
      }
      function cierre() {
        var b = sobreFoto(tomar(['arriba', 'abajo'])), A = b.z.arriba;
        grupo(b, [
          { e: 'B', txt: C.pregunta, tam: 70, minus: true, partir: 440, nombre: 'Pregunta', papel: 'pregunta' },
          { e: 'r', txt: C.sigue, tam: 44, mt: 6, partir: 340, nombre: 'Sigue', papel: 'sigue' }
        ], A, { alin: A.lado === 'izq' ? 'left' : 'right' });
        b.els.forEach(function (e) { if (e.papel === 'pregunta') { e.espac = -.05; e.interl = .9; } });
        // el botón blanco de abajo
        var bw = W - 380, by = H - Math.round(90 * k0) - 116;
        b.els.push({ id: nid(), tipo: 'forma', nombre: 'Botón', papel: 'boton-fondo', fondo: '#FFFFFF', radio: 999, x: 190, y: by, w: bw, h: 116, z: 6, rot: 0, op: 1 });
        var t1 = 30, a1 = anchoTxt(String(C.boton || '').toUpperCase(), t1, .54); if (a1 > bw - 80) t1 = Math.floor(t1 * (bw - 80) / a1);
        b.els.push(T({ nombre: 'Botón', papel: 'boton', txt: C.boton || '', x: 190, y: by + 26, w: bw, alin: 'center', fuente: '@titular', tam: t1, peso: 800, color: '#111111', mayus: true, espac: -.02, interl: 1.15, z: 7 }));
        b.els.push(T({ nombre: 'Debajo del botón', papel: 'boton-sub', txt: C.boton_sub || '', x: 190, y: by + 26 + Math.round(t1 * 1.15) + 4, w: bw, alin: 'center', fuente: '@cuerpo', tam: 24, peso: 400, color: '#111111', espac: -.02, interl: 1.15, z: 7 }));
        return lam(b);
      }
    }
  });
})();

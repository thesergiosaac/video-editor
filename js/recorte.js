/* recorte.js — las TOMAS hechas a mano (editor Manual, parte 2, 8-oct-2026)
 *
 * Recortar, partir, duplicar o quitar una toma cambia la lista de cortes. Para que la vista previa lo muestre AL INSTANTE
 * y el video final salga igual, todo lo atado a palabras (subtítulos, gráficos, escenas, efectos) se pasa de un corte al
 * otro sin volver a llamar a la IA: cada palabra se reconoce por SU CLIP y el segundo del clip donde se dice. Eso no cambia
 * entre una lista de cortes y otra (los números de palabra sí).
 *
 * Una lista hecha a mano: { de: <id de la base de donde sale el material>, cortes: [{ k, a, b }] }
 *   k = corte de esa base · a–b = segundos del clip (siempre dentro de ese corte).
 *
 * Funciones puras (sin la página): sirven a cortesvivo.js (la vista previa) y a manual.js (la línea de tiempo).
 */
(function () {
  'use strict';
  var R3 = function (x) { return Math.round(x * 1000) / 1000; };
  var TOL = 0.04;                      // misma palabra en dos bases: mismo clip y el mismo segundo (± 40 ms)

  function inicios(nominales) {
    var ini = [], a = 0;
    (nominales || []).forEach(function (d) { ini.push(a); a += Number(d) || 0; });
    return ini;
  }

  /* ⚠️ El reloj de las palabras va con el largo de cada corte de la LISTA (orchestrate: cursorSalida += cut.duration), no
     con el largo que dejó F1 en segments_json (F1 puede acortar un corte; medido en el video de prueba: el corte 3 queda
     0,096 s más corto y desde ahí las palabras van con la lista). */
  function largos(cuts) {
    return (cuts || []).map(function (c) { var d = Number(c && c.duration); return d > 0 ? d : Math.max(0, Number(c.endTime) - Number(c.startTime)); });
  }
  /* La fuente para todo lo de aquí: cortes, su reloj y sus palabras */
  function fuente(cuts, palabras) { return { cuts: cuts, nominales: largos(cuts), palabras: palabras }; }

  /* El material de una base: de qué corte es cada palabra y en qué segundo de SU clip se dice.
     D = fuente(cuts, palabras) (reloj de las palabras) */
  function material(D) {
    if (!D || !Array.isArray(D.cuts) || !Array.isArray(D.nominales) || D.cuts.length !== D.nominales.length) return null;
    var ini = inicios(D.nominales);
    return (D.palabras || []).map(function (w, i) {
      var s = Number(w.start), e = Number(w.end), m = (s + e) / 2, k = 0;
      while (k + 1 < ini.length && m >= ini[k + 1]) k++;
      var c = D.cuts[k] || {};
      return { i: i, k: k, clipId: String(c.clipId || ''), cs: Number(c.startTime) + (s - ini[k]), ce: Number(c.startTime) + (e - ini[k]),
               w: String(w.word || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') };
    });
  }

  function finDe(D, k) { var c = D.cuts[k]; return Number(c.startTime) + (Number(D.nominales[k]) || 0); }
  /* La lista de una base tal cual (cada corte entero) */
  function listaDe(D, de) {
    return { de: de, cortes: (D.cuts || []).map(function (c, k) { return { k: k, a: R3(Number(c.startTime)), b: R3(finDe(D, k)) }; }) };
  }

  /* La base nueva a partir de la fuente y la lista: sus cortes, de qué palabra vieja sale cada palabra (mapa; -1 = una
     palabra que la fuente no tiene), los tiempos nuevos (reloj de las palabras) y qué tramo de la fuente es cada corte.
     (8-oct, Sergio: «un clip también se debe poder alargar») Una toma puede salirse de su corte (alargarla) o ser un clip
     que la fuente no trae (k = -1, con su clipId): lo que la fuente no tiene se dice con la transcripción del clip
     (extra.palabras[clipId], segundos del clip) y su dirección sale de extra.clips[clipId].mp4_path. */
  function rehacer(D, cortes, extra) {
    var mat = material(D);
    if (!mat) return null;
    var ini = inicios(D.nominales), X = extra || {}, porClip = X.palabras || {}, clipsX = X.clips || {};
    var mapa = [], tiempos = [], nuevas = {}, cuts = [], tramos = [], cursor = 0;
    (cortes || []).forEach(function (t) {
      var k = Number(t.k), c = k >= 0 ? D.cuts[k] : null;
      if (k >= 0 && !c) return;
      var clipId = c ? String(c.clipId) : String(t.clipId || '');
      var mp4 = c ? c.mp4_path : (clipsX[clipId] && clipsX[clipId].mp4_path);
      if (!clipId || !mp4) return;
      var a = Math.max(0, Number(t.a)), b = Number(t.b);
      if (!(b - a >= 0.1)) return;
      var dur = R3(b - a);
      // lo que de esta toma hay en la fuente (su corte k) y si está ENTERA ahí (entonces se puede ver saltando)
      var c0 = c ? Number(c.startTime) : 0, c1 = c ? finDe(D, k) : -1;
      var m0 = Math.max(a, c0), m1 = Math.min(b, c1);
      var entera = !!c && a >= c0 - 0.002 && b <= c1 + 0.002;
      tramos.push({ k: c ? k : -1, n0: c ? ini[k] + (a - c0) : NaN, n1: c ? ini[k] + (a - c0) + dur : NaN, v0: cursor, dur: dur, entera: entera });
      var lista = [];
      if (c) mat.forEach(function (m) {
        if (m.k !== k) return;
        var mid = (m.cs + m.ce) / 2;
        if (mid < m0 || mid > m1) return;
        lista.push({ cs: m.cs, ce: m.ce, o: m.i });
      });
      // lo que la fuente no tiene (alargada o clip nuevo): la transcripción del clip
      (porClip[clipId] || []).forEach(function (w) {
        var cs = Number(w.start), ce = Number(w.end), mid = (cs + ce) / 2;
        if (!isFinite(mid) || mid < a || mid > b) return;
        if (c && mid >= m0 && mid <= m1) return;
        var txt = String(w.word || '').trim();
        if (txt) lista.push({ cs: cs, ce: ce, w: txt });
      });
      lista.sort(function (x, y) { return x.cs - y.cs; });
      var texto = [];
      lista.forEach(function (x) {
        var j = mapa.length;
        mapa.push(x.o != null ? x.o : -1);
        tiempos.push({ start: R3(cursor + Math.max(0, x.cs - a)), end: R3(cursor + Math.max(0, Math.min(dur, x.ce - a))) });
        if (x.o == null) nuevas[j] = { word: x.w };
        texto.push(x.o != null ? String((D.palabras[x.o] || {}).word || '') : x.w);
      });
      cuts.push({ clipId: clipId, mp4_path: mp4, startTime: R3(a), endTime: R3(b), duration: dur, words: [], text: texto.join(' '), is_saac: false });
      cursor += dur;
    });
    return { mapa: mapa, tiempos: tiempos, nuevas: nuevas, cuts: cuts, tramos: tramos,
             entera: tramos.every(function (t) { return t.entera; }),
             nominales: cuts.map(function (c) { return c.duration; }), total: R3(cursor) };
  }

  /* Una lista de palabras (cualquiera alineada con la fuente) llevada a la base nueva; las que la fuente no tiene salen de
     la transcripción */
  function palabras(arr, N) {
    return N.mapa.map(function (o, j) {
      var w = o >= 0 ? (arr && arr[o] ? arr[o] : { word: '' }) : (N.nuevas && N.nuevas[j]) || { word: '' };
      return Object.assign({}, w, { start: N.tiempos[j].start, end: N.tiempos[j].end });
    }).map(function (w) { delete w.corte; return w; });
  }

  /* Las palabras que no quedaron en ninguna frase (lo alargado, un clip nuevo): frases de hasta 5 palabras que se cortan en
     la puntuación; la clave, la palabra más larga. Así toda palabra que se dice tiene su subtítulo. */
  function rellenar(lista, pal) {
    var out = (Array.isArray(lista) ? lista : []).slice(), cubre = [];
    out.forEach(function (f) { for (var i = Number(f.desde); i <= Number(f.hasta); i++) cubre[i] = true; });
    var limpia = function (w) { return String(w || '').replace(/[^\p{L}\p{N}]/gu, ''); };
    var ini = -1;
    var cerrar = function (fin) {
      if (ini < 0 || fin < ini) return;
      var k = ini, largo = -1;
      for (var i = ini; i <= fin; i++) { var L = limpia(pal[i] && pal[i].word).length; if (L > largo) { largo = L; k = i; } }
      out.push({ desde: ini, hasta: fin, clave: [k, k], cierra: /[.!?…]$/.test(String(pal[fin] && pal[fin].word || '')) });
      ini = -1;
    };
    for (var i = 0; i < (pal || []).length; i++) {
      if (cubre[i]) { cerrar(i - 1); continue; }
      if (ini < 0) ini = i;
      var w = String(pal[i].word || '');
      if (/[.!?…,;:]$/.test(w) || i - ini + 1 >= 5) cerrar(i);
    }
    cerrar((pal || []).length - 1);
    return out.sort(function (a, b) { return a.desde - b.desde; });
  }

  /* Un tramo de palabras [desde, hasta] llevado a la base nueva: su PRIMERA aparición seguida (null si se quitó entero) */
  function tramo(desde, hasta, mapa) {
    var d = -1, h = -1;
    for (var j = 0; j < mapa.length; j++) {
      var o = mapa[j], dentro = o >= desde && o <= hasta;
      if (d < 0) { if (dentro) { d = j; h = j; } continue; }
      if (dentro && o > mapa[h]) h = j; else break;
    }
    return d < 0 ? null : { desde: d, hasta: h };
  }
  function tramos(lista, mapa) {
    return (lista || []).map(function (x) {
      var r = x && tramo(Number(x.desde), Number(x.hasta), mapa);
      return r ? Object.assign({}, x, r) : null;
    }).filter(Boolean);
  }

  /* Las frases: cada pedazo que sigue junto en la base nueva es una frase (una toma duplicada repite sus frases) */
  function frases(lista, mapa, pal) {
    if (!Array.isArray(lista)) return lista;
    var de = [];
    lista.forEach(function (f, fi) { for (var i = Number(f.desde); i <= Number(f.hasta); i++) de[i] = fi; });
    var grupos = [], act = null;
    for (var j = 0; j < mapa.length; j++) {
      var o = mapa[j], fi = de[o];
      if (fi == null) { act = null; continue; }
      if (act && act.fi === fi && mapa[j - 1] === o - 1) { act.hasta = j; act.olds.push(o); continue; }
      act = { fi: fi, desde: j, hasta: j, olds: [o] }; grupos.push(act);
    }
    var limpia = function (w) { return String(w || '').replace(/[^\p{L}\p{N}]/gu, ''); };
    return grupos.map(function (g) {
      var f = lista[g.fi], r = Object.assign({}, f, { desde: g.desde, hasta: g.hasta });
      Object.defineProperty(r, '_fi', { value: g.fi, enumerable: false });   // de qué frase de la fuente sale (no viaja)
      if (Array.isArray(f.clave)) {
        var a = g.olds.indexOf(Number(f.clave[0])), b = g.olds.indexOf(Number(f.clave[1]));
        if (a >= 0 && b >= 0) r.clave = [g.desde + a, g.desde + b];
        else {
          // la clave quedó fuera: la palabra más larga de lo que queda
          var k = g.desde, largo = -1;
          for (var i = g.desde; i <= g.hasta; i++) { var L = limpia(pal && pal[i] && pal[i].word).length; if (L > largo) { largo = L; k = i; } }
          r.clave = [k, k];
        }
      }
      r.cierra = g.olds[g.olds.length - 1] === Number(f.hasta) ? !!f.cierra : false;
      return r;
    });
  }

  /* Los momentos de la IA (gráficos, escenas): primera aparición; los que se quitaron enteros se van */
  function momentos(obj, mapa) {
    if (!obj || !Array.isArray(obj.momentos)) return obj || null;
    return Object.assign({}, obj, { momentos: tramos(obj.momentos, mapa) });
  }

  /* ══ De una base a otra (la que se ve cambia): qué número tiene cada palabra en la otra ══
     La misma palabra (mismo texto) del mismo clip, que empieza o termina en el mismo segundo del clip (una palabra a
     caballo de un recorte conserva un borde); -1 si en la otra no está (se quitó ese pedazo). Hay palabras de duración
     cero que comparten segundo con la siguiente: por eso cuenta también el texto. */
  function puente(matA, matB) {
    if (!matA || !matB) return null;
    var porClip = {};
    matB.forEach(function (m) { (porClip[m.clipId] = porClip[m.clipId] || []).push(m); });
    return matA.map(function (m) {
      var xs = porClip[m.clipId] || [], mejor = -1, d = Infinity;
      for (var k = 0; k < xs.length; k++) {
        var x = xs[k], ds = Math.abs(x.cs - m.cs), de = Math.abs(x.ce - m.ce);
        if (x.w !== m.w || (ds > TOL && de > TOL)) continue;
        if (ds + de < d) { d = ds + de; mejor = x.i; }
      }
      return mejor;
    });
  }
  /* La palabra de un número en la base nueva; si se quitó, la más cercana que siga (solo si se pide) */
  function pasar(i, P, cercana) {
    if (!P || i == null || i < 0 || i >= P.length) return -1;
    if (P[i] >= 0 || !cercana) return P[i];
    for (var d = 1; d < P.length; d++) {
      if (i + d < P.length && P[i + d] >= 0) return P[i + d];
      if (i - d >= 0 && P[i - d] >= 0) return P[i - d];
    }
    return -1;
  }
  /* Un tramo [desde, hasta] de una base en la otra: lo que siga de él (null si no queda nada) */
  function pasarTramo(desde, hasta, P) {
    if (!P) return null;
    var d = -1, h = -1;
    for (var i = Math.max(0, desde); i <= Math.min(P.length - 1, hasta); i++) {
      var j = P[i];
      if (j < 0) continue;
      if (d < 0 || j < d) d = j;
      if (j > h) h = j;
    }
    return d < 0 ? null : { desde: d, hasta: h };
  }

  /* Para la vista previa mientras se arma la base nueva: el video de la fuente saltando lo recortado. Cada corte nuevo es
     un tramo de un corte de la fuente: en segundos del VIDEO (con las duraciones reales de la fuente). */
  function rangos(N, D, reales) {
    if (!N || !N.entera || !Array.isArray(reales) || reales.length !== D.cuts.length) return null;   // alargada o clip nuevo: no
    var Rini = inicios(reales), v = 0;
    return N.tramos.map(function (t) {
      var c = D.cuts[t.k], fin = Rini[t.k] + Number(reales[t.k]);
      var r0 = Math.min(fin, Rini[t.k] + (t.n0 - inicios(D.nominales)[t.k])), r1 = Math.min(fin, r0 + t.dur);
      var o = { k: t.k, r0: r0, r1: r1, v0: v, n0: t.n0, nv0: t.v0 };
      v += Math.max(0, r1 - r0);
      return o;
    });
  }

  window.CherryRecorte = { material: material, listaDe: listaDe, rehacer: rehacer, palabras: palabras, tramo: tramo, tramos: tramos,
    frases: frases, rellenar: rellenar, momentos: momentos, puente: puente, pasar: pasar, pasarTramo: pasarTramo, rangos: rangos, inicios: inicios, finDe: finDe,
    largos: largos, fuente: fuente };
})();

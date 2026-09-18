/* frases-servidor.js — COPIA EXACTA del repaso de frases de carrete-layer2 (subtitulos.js), 18-sep-2026.
 * NO SE EDITA A MANO: se genera con scratchpad/_copiar_frases.py desde la Lambda.
 * La vista previa desde la base adelantada repasa las frases de la IA igual que el servidor (parte las
 * largas, no cruza oraciones, no deja enlaces al final), así se ven las MISMAS frases del video final.
 */
(function (raiz) {
  'use strict';
  var VACIAS = new Set(('a al algo ante antes aquí así aun aún cada como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa ese eso esta está están este esto fue ha hay la las le les lo los me mi mis muy más nada ni no nos o otra otro para pero por porque que qué se sea ser si sí sin sobre solo su sus también te tan tanto tiene tienes todo tu tus tú un una uno unos y ya yo the a an and or of to in is it you i').split(' '));
  function limpiarPalabra(w) { return String(w || '').replace(/[¡!¿?.,;:…"«»“”{}\\]/g, '').trim(); }
  function rango(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
  /* ── Frases: validar las de la IA o armarlas solas ── */
  function frasesAutomaticas(palabras) {
    var frases = [], cur = [];
    function cerrar() {
      if (!cur.length) return;
      frases.push({ desde: cur[0], hasta: cur[cur.length - 1], clave: [claveAutomatica(palabras, cur), claveAutomatica(palabras, cur)] });
      cur = [];
    }
    for (var i = 0; i < palabras.length; i++) {
      var w = palabras[i], prev = palabras[i - 1];
      if (cur.length && prev) {
        var pausa = (w.start || 0) - (prev.end || prev.start || 0);
        var inicioOracion = /^[¿¡]?[A-ZÁÉÍÓÚÑ]/.test(String(w.word || '')) && !/^(I|Yo)$/.test(limpiarPalabra(w.word));
        if (cur.length >= 5 || pausa > 0.35 || /[.?!…]$/.test(prev.word || '') || (inicioOracion && cur.length >= 2) ||
            (/,$/.test(prev.word || '') && cur.length >= 3)) cerrar();
      }
      cur.push(i);
    }
    cerrar();
    return frases;
  }
  function claveAutomatica(palabras, ids) {
    var mejor = ids[ids.length - 1], puntaje = -1;
    ids.forEach(function (i, k) {
      var t = limpiarPalabra(palabras[i].word).toLocaleLowerCase('es');
      if (!t) return;
      var p = (VACIAS.has(t) ? 0 : t.length) + k * 0.6 + (/\d/.test(t) ? 4 : 0);
      if (p > puntaje) { puntaje = p; mejor = i; }
    });
    return mejor;
  }
  function normalizarFrases(palabras, frases) {
    var N = palabras.length;
    if (!Array.isArray(frases) || !frases.length) frases = frasesAutomaticas(palabras);
    var limpias = frases
      .filter(function (f) { return f && Number.isInteger(f.desde) && Number.isInteger(f.hasta); })
      .map(function (f) {
        var a = Math.max(0, Math.min(N - 1, f.desde)), b = Math.max(a, Math.min(N - 1, f.hasta));
        return { desde: a, hasta: b, clave: f.clave, estilo: f.estilo, cierra: f.cierra };
      })
      .sort(function (x, y) { return x.desde - y.desde; });
    // Cubrir todas las palabras una sola vez: huecos → frases automáticas, cruces → se recortan
    var out = [], cursor = 0;
    limpias.forEach(function (f) {
      if (f.hasta < cursor) return;
      if (f.desde > cursor) {
        frasesAutomaticas(palabras.slice(cursor, f.desde)).forEach(function (g) {
          out.push({ desde: g.desde + cursor, hasta: g.hasta + cursor, clave: [g.clave[0] + cursor, g.clave[1] + cursor] });
        });
      }
      f.desde = Math.max(f.desde, cursor);
      out.push(f);
      cursor = f.hasta + 1;
    });
    if (cursor < N) {
      frasesAutomaticas(palabras.slice(cursor)).forEach(function (g) {
        out.push({ desde: g.desde + cursor, hasta: g.hasta + cursor, clave: [g.clave[0] + cursor, g.clave[1] + cursor] });
      });
    }
    // Partir las largas + repaso, repetido hasta que ya no cambie nada: así procesar dos veces las mismas frases
    // (lo que hace el editor al exportar) da exactamente lo mismo que la vista en vivo
    var firma = function (lista) { return lista.map(function (f) { return f.desde + '-' + f.hasta; }).join(','); };
    for (var vuelta = 0; vuelta < 4; vuelta++) {
      var siguiente = repasarFrases(palabras, partirLargas(palabras, out));
      var estable = firma(siguiente) === firma(out);
      out = siguiente;
      if (estable) break;
    }
    out.forEach(function (f) {
      var c = Array.isArray(f.clave) ? f.clave : [];
      var ka = Number.isInteger(c[0]) ? c[0] : null, kb = Number.isInteger(c[1]) ? c[1] : ka;
      if (ka === null || ka < f.desde || ka > f.hasta) ka = kb = claveAutomatica(palabras, rango(f.desde, f.hasta));
      if (kb < ka || kb > f.hasta) kb = ka;
      if (kb - ka > 2) kb = ka + 2;
      // La clave es la palabra grande de la plantilla: sin palabras vacías en los bordes («mitad de tus» → «mitad»)
      var vacia = function (i) { return VACIAS.has(limpiarPalabra(palabras[i].word).toLocaleLowerCase('es')); };
      while (kb > ka && vacia(ka)) ka++;
      while (kb > ka && vacia(kb)) kb--;
      // Una palabra clave hecha solo de palabras vacías («si a tus») no sirve: se escoge otra
      var util = false;
      for (var i = ka; i <= kb; i++) if (!VACIAS.has(limpiarPalabra(palabras[i].word).toLocaleLowerCase('es'))) util = true;
      if (!util) ka = kb = claveAutomatica(palabras, rango(f.desde, f.hasta));
      f.clave = [ka, kb];
    });
    return out;
  }

  // Frases demasiado largas para pantalla (más de 7 palabras): se parten solas y la palabra clave se queda donde caiga
  function partirLargas(palabras, lista) {
    var partidas = [];
    lista.forEach(function (f) {
      if (f.hasta - f.desde + 1 <= 7) { partidas.push(f); return; }
      var trozosFrase = frasesAutomaticas(palabras.slice(f.desde, f.hasta + 1));
      trozosFrase.forEach(function (g, gi) {
        var d = g.desde + f.desde, h = g.hasta + f.desde;
        var c = Array.isArray(f.clave) && f.clave[0] >= d && f.clave[0] <= h ? f.clave : null;
        partidas.push({ desde: d, hasta: h, clave: c, estilo: f.estilo, cierra: gi === trozosFrase.length - 1 ? f.cierra : false });
      });
    });
    return partidas;
  }

  /* ── Repaso de las frases (lo que la IA no siempre respeta) ──
     1. Una frase no cruza el inicio de otra oración (¿ ¡, o mayúscula tras una pausa).
     2. Una frase no termina en artículo, preposición o conjunción: esas palabras pasan a la frase siguiente. */
  var ENLACES = new Set('a al ante con de del desde e el en entre hacia hasta la las lo los mi mis ni o para pero por porque que se si sin sobre su sus te tu tus u un una unas unos y como donde cuando cual'.split(' '));
  function iniciaOracion(palabras, i) {
    var w = String(palabras[i].word || ''), prev = palabras[i - 1];
    if (!prev) return false;
    if (/^[¿¡]/.test(w)) return true;
    if (/[.?!…]$/.test(String(prev.word || ''))) return true;
    var pausa = (palabras[i].start || 0) - (prev.end || prev.start || 0);
    return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(w) && pausa >= 0.12;
  }
  function repasarFrases(palabras, frases) {
    var cortadas = [];
    frases.forEach(function (f) {
      var ini = f.desde;
      for (var i = f.desde + 1; i <= f.hasta; i++) {
        if (!iniciaOracion(palabras, i)) continue;
        cortadas.push({ desde: ini, hasta: i - 1, clave: f.clave, estilo: f.estilo, cierra: true });
        ini = i;
      }
      cortadas.push({ desde: ini, hasta: f.hasta, clave: f.clave, estilo: f.estilo, cierra: f.cierra });
    });
    for (var k = 0; k < cortadas.length - 1; k++) {
      var f = cortadas[k], sig = cortadas[k + 1];
      while (f.hasta > f.desde && ENLACES.has(limpiarPalabra(palabras[f.hasta].word).toLocaleLowerCase('es')) && sig.hasta - f.hasta < 8) {
        f.hasta--; sig.desde = f.hasta + 1;
      }
    }
    // 3. Una palabra suelta se une a su vecina si no empieza otra oración y juntas no pasan de 5 («¿según» + «quién»)
    // (un enlace suelto —«y», «de»— va con la frase siguiente, nunca con la anterior)
    cortadas = cortadas.filter(function (f, k) {
      var sig = cortadas[k + 1];
      if (sig && f.hasta === f.desde && ENLACES.has(limpiarPalabra(palabras[f.desde].word).toLocaleLowerCase('es'))) { sig.desde = f.desde; return false; }
      return true;
    });
    var unidas = [];
    cortadas.forEach(function (f) {
      var prev = unidas[unidas.length - 1];
      // (nunca se juntan frases de estilos distintos: una de impacto no se pega a una normal)
      if (prev && (prev.estilo || '') === (f.estilo || '') && !iniciaOracion(palabras, f.desde) &&
          (prev.hasta === prev.desde || f.hasta === f.desde) && f.hasta - prev.desde + 1 <= 5) {
        if (prev.hasta === prev.desde && f.clave) prev.clave = f.clave;
        prev.hasta = f.hasta;
        prev.cierra = f.cierra;
        return;
      }
      unidas.push(f);
    });
    return unidas.map(function (f) {
      var c = Array.isArray(f.clave) && f.clave[0] >= f.desde && f.clave[0] <= f.hasta ? [f.clave[0], Math.min(f.clave[1], f.hasta)] : null;
      return { desde: f.desde, hasta: f.hasta, clave: c, estilo: f.estilo, cierra: f.cierra };
    });
  }


  var API = { normalizarFrases: normalizarFrases, frasesAutomaticas: frasesAutomaticas };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.FrasesServidor = API;
})(typeof window !== 'undefined' ? window : this);

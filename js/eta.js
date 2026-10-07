/* eta.js — «cuánto falta» en todo lo que tarda (7-oct-2026)
 *
 * Sergio: que no solo al fabricar el video, sino en TODO lo que tarda (el guion, el storyboard, los carruseles, el
 * recorte, la voz de estudio…) Cherry diga cuánto falta y tranquilice.
 *
 * Cada trabajo («escribir», «hoja», «recorte»…) guarda en este navegador lo que tardó las últimas 5 veces y con la
 * mediana dice cuánto le queda; la primera vez vale lo que medimos nosotros. Honesto: si ya se pasó de lo esperado no
 * inventa otra cuenta, dice que ya casi y que a veces tarda un poco más.
 *
 *   var e = CherryEta.empezar('escribir', 100);      // segundos esperados mientras no haya medidas propias
 *   e.texto()   → 'faltan ≈ 1:10' | 'ya casi: a veces tarda un poco más'
 *   e.fin()     → aprende lo que tardó (llamarlo SOLO si salió bien) y deja de contar
 *   e.parar()   → deja de contar sin aprender (falló o se canceló)
 *   CherryEta.cuanto('escribir', 100) → 'alrededor de un minuto' (para decirlo antes de empezar)
 *
 * Un elemento con data-eta="<e.id>" se actualiza solo cada segundo (sirve igual en el editor y en las herramientas).
 */
(function () {
  if (window.CherryEta) return;
  var LLAVE = 'cherry-eta', VIVOS = {}, n = 0, tic = null;
  function leer() { try { return JSON.parse(localStorage.getItem(LLAVE) || '{}') || {}; } catch (e) { return {}; } }
  function escribir(d) { try { localStorage.setItem(LLAVE, JSON.stringify(d)); } catch (e) { /* sin memoria: vale lo medido por nosotros */ } }
  function mediana(l) { var o = l.slice().sort(function (a, b) { return a - b; }); return o[Math.floor(o.length / 2)]; }
  function esperado(clave, defecto, u) {
    var l = leer()[clave];
    return (Array.isArray(l) && l.length ? mediana(l) : defecto) * (u || 1);
  }
  function reloj(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function cuanto(clave, defecto, u) {
    var s = esperado(clave, defecto, u);
    if (s < 50) return 'unos ' + Math.max(5, Math.round(s / 5) * 5) + ' segundos';
    var m = Math.round(s / 60);
    return m <= 1 ? 'alrededor de un minuto' : 'unos ' + m + ' minutos';
  }
  function latido() {
    var hay = false;
    document.querySelectorAll('[data-eta]').forEach(function (el) {
      var e = VIVOS[el.getAttribute('data-eta')];
      if (!e) return;
      hay = true;
      var t = e.texto();
      if (el.textContent !== t) el.textContent = t;
    });
    if (!hay && !Object.keys(VIVOS).length) { clearInterval(tic); tic = null; }
  }
  function empezar(clave, defecto, u) {
    var t0 = Date.now(), est = esperado(clave, defecto, u), id = 'eta' + (++n), listo = false;
    var e = {
      id: id,
      pasados: function () { return (Date.now() - t0) / 1000; },
      resta: function () { return est - (Date.now() - t0) / 1000; },
      texto: function () {
        var q = est - (Date.now() - t0) / 1000;
        return q > 4 ? 'faltan ≈ ' + reloj(q) : 'ya casi: a veces tarda un poco más';
      },
      fin: function () {
        if (listo) return; listo = true; delete VIVOS[id];
        var s = (Date.now() - t0) / 1000 / (u || 1);
        if (!(s > 1) || s > 1800) return;                 // lo absurdo (una pestaña dormida) no se aprende
        var d = leer(), l = Array.isArray(d[clave]) ? d[clave] : [];
        l.push(Math.round(s)); d[clave] = l.slice(-5); escribir(d);
      },
      parar: function () { listo = true; delete VIVOS[id]; },
    };
    VIVOS[id] = e;
    if (!tic) tic = setInterval(latido, 1000);
    return e;
  }
  /* para pegarlo en un texto armado a mano */
  function html(e) { return '<span data-eta="' + e.id + '">' + e.texto() + '</span>'; }
  window.CherryEta = { empezar: empezar, cuanto: cuanto, reloj: reloj, html: html };
})();

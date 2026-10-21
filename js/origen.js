/* origen.js — de dónde llega la gente a las guías (21-oct-2026)
 *
 * Sergio: «tenemos que medir desde dónde vienen»: Instagram (el botón de la respuesta automática) o TikTok / YouTube /
 * Facebook (el enlace de la biografía). Cada red lleva su enlace:
 *   cherrysweet.app/guias/contenido/?de=ig   ← respuesta automática de Instagram
 *   cherrysweet.app/guias?de=tt | ?de=yt | ?de=fb   ← la biografía de cada red
 * Sin ?de= se adivina por la página de la que viene (document.referrer); si no hay nada, «directo».
 *
 * · Suma UNA visita por página y por sesión (servidor: tabla visitas_origen, función sumar_visita; ver
 *   servidor/base/26-visitas-origen.sql). Solo se guarda día + página + red: nada de la persona, sin cookies.
 * · La red se recuerda en sessionStorage mientras la persona navega (de /guias a la guía del video sigue siendo TikTok).
 * · Quita el ?de= de la barra de direcciones para que, si la comparten, no cuente como esa red.
 * · La página dice cuál es con <script src="/js/origen.js" data-pagina="guias/contenido" defer>.
 * · Los toques también se cuentan por red: un enlace con data-cuenta="youtube" suma en «<página>/youtube» (cuántos se
 *   fueron a ver el video a YouTube, que es a donde Sergio quiere mandarlos: la página es solo el puente) y
 *   data-cuenta="canal" en «<página>/canal» (los que tocan «Unirme al canal», la lista de espera).
 */
(function () {
  var SB = 'https://xsptcepijtnmowqauyxw.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ';
  var REDES = {ig: 'instagram', tt: 'tiktok', yt: 'youtube', fb: 'facebook', wa: 'whatsapp'};
  var yo = document.currentScript;
  var pagina = (yo && yo.getAttribute('data-pagina')) || location.pathname.replace(/^\/|\/$/g, '') || 'inicio';

  var leer = function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  var guardar = function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: vale solo esta página */ } };

  var u = new URL(location.href);
  var de = (u.searchParams.get('de') || '').toLowerCase();
  var origen = REDES[de] || leer('cherry-origen');
  if (!origen) {
    var r = '';
    try { r = new URL(document.referrer).hostname; } catch (e) { r = ''; }
    origen = /instagram\./.test(r) ? 'instagram' : /tiktok\./.test(r) ? 'tiktok' : /youtube\.|youtu\.be/.test(r) ? 'youtube'
      : /facebook\.|fb\.com/.test(r) ? 'facebook' : /whatsapp\./.test(r) ? 'whatsapp' : r && !/cherrysweet\.app$/.test(r) ? 'otro' : 'directo';
  }
  guardar('cherry-origen', origen);
  if (u.searchParams.has('de')) { u.searchParams.delete('de'); try { history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } catch (e) { /* nada */ } }

  var sumar = function (pag) {
    try {
      fetch(SB + '/rest/v1/rpc/sumar_visita', {
        method: 'POST', keepalive: true,
        headers: {apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json'},
        body: JSON.stringify({p_pagina: pag, p_origen: origen}),
      }).catch(function () {});
    } catch (e) { /* sin red: no se cuenta */ }
  };

  /* el toque se cuenta en la fase de captura, antes de que la página salte a YouTube (una vez por sesión y destino) */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-cuenta]') : null;
    if (!a) return;
    var k = 'cherry-toque:' + pagina + '/' + a.getAttribute('data-cuenta');
    if (leer(k)) return;
    guardar(k, '1');
    sumar(pagina + '/' + a.getAttribute('data-cuenta'));
  }, true);

  var ya = 'cherry-visita:' + pagina;
  if (leer(ya)) return;
  guardar(ya, '1');
  sumar(pagina);
})();

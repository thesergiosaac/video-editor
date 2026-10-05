/* medir.js — el píxel de Meta en las páginas públicas de Cherry (5-oct-2026)
 *
 * Sergio (5-oct): «conectar el pixel… para que la página vaya recogiendo datos para el día que hagamos campañas».
 * Desde que esto corre, Meta va armando públicos de quien visitó la portada o tocó «Unirme al canal» (los guarda hasta
 * 180 días): el día que se paute ya hay a quién volver a mostrarle anuncios y de quién sacar gente parecida.
 *
 * · Sin PIXEL no hace nada: ni carga el código de Meta ni muestra el aviso.
 * · El código de Meta se carga SOLO si la persona toca «Aceptar» en el aviso de cookies. «Ahora no» (o no contestar) = nada
 *   de Meta. La respuesta queda en este navegador (localStorage 'cherry-cookies': 'si' | 'no') y no se vuelve a preguntar.
 * · window.cherryMedir(evento, datos): los eventos esperan la respuesta; si es «no», se botan.
 * · Eventos: PageView al abrir la página y Lead al tocar cualquier botón [data-canal] (el que abre el canal de WhatsApp).
 *   Los registros y los pagos NO van aquí: los manda el servidor (dodo-aviso), que sabe cuándo de verdad pasaron.
 * · Se usa en index.html, canal/ y unete/ (unete se arma desde canal; ver docs/RESPUESTAS-AUTOMATICAS.md).
 *   La copia del revisor (/revision/) no lo lleva.
 */
(function () {
  var PIXEL = '4573870822884825';                      // id del conjunto de datos «Cherry» (portafolio Sergio Abadía). No es secreto.
  var CLAVE = 'cherry-cookies';
  if (!PIXEL || window.cherryMedir) return;

  var cola = [];
  var estado = leer();

  window.cherryMedir = function (evento, datos) {
    if (estado === 'si') enviar(evento, datos);
    else if (estado !== 'no') cola.push([evento, datos]);
  };

  function leer() { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } }
  function guardar(v) { try { localStorage.setItem(CLAVE, v); } catch (e) { /* sin almacenamiento: vale solo esta visita */ } }

  function cargar() {
    if (window.fbq) return;
    /* el código oficial de Meta, tal cual */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL);
  }

  function enviar(evento, datos) {
    cargar();
    window.fbq('track', evento, datos || {});
  }

  function responder(v) {
    estado = v; guardar(v);
    if (v === 'si') cola.forEach(function (e) { enviar(e[0], e[1]); });
    cola = [];
    var a = document.querySelector('.ck-aviso');
    if (a) { a.classList.remove('ck-visible'); setTimeout(function () { a.remove(); }, 300); }
  }

  function aviso() {
    var css = document.createElement('style');
    /* (5-oct, Sergio: «algo discreto… que la persona toque sin complicaciones») una pastilla oscura y corta abajo, como la
       de casi todas las páginas; el detalle vive en la política de privacidad (sección «Cookies y anuncios de Meta»). */
    css.textContent =
      '.ck-aviso{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:200;' +
      'width:max-content;max-width:calc(100% - 24px);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;' +
      'gap:6px 12px;padding:8px 8px 8px 16px;border-radius:999px;background:rgba(20,12,17,.88);' +
      '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:rgba(252,249,247,.78);' +
      'font:13px/1.35 "Space Grotesk",system-ui,sans-serif;box-shadow:0 12px 30px -12px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08);' +
      'opacity:0;transform:translate(-50%,12px);transition:opacity .3s,transform .3s}' +
      '.ck-aviso.ck-visible{opacity:1;transform:translate(-50%,0)}' +
      '.ck-aviso p{margin:0}' +
      '.ck-aviso a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
      '.ck-aviso span{display:flex;align-items:center;gap:2px}' +
      '.ck-aviso button{min-height:34px;padding:0 14px;border:0;border-radius:999px;font:600 13px "Space Grotesk",system-ui,sans-serif;cursor:pointer}' +
      '.ck-aviso [data-ck-si]{background:#FCF9F7;color:#140C11}' +
      '.ck-aviso [data-ck-no]{background:transparent;color:rgba(252,249,247,.55);padding:0 10px}' +
      '@media (max-width:520px){.ck-aviso{border-radius:16px;padding:10px 8px 8px 14px;justify-content:flex-end}.ck-aviso p{flex:1 1 100%}}';
    document.head.appendChild(css);
    var a = document.createElement('div');
    a.className = 'ck-aviso';
    a.setAttribute('role', 'dialog');
    a.setAttribute('aria-label', 'Cookies');
    a.innerHTML =
      '<p>Usamos cookies para mejorar tu experiencia. <a href="/privacidad.html#cookies">Más información</a></p>' +
      '<span><button type="button" data-ck-no>Ahora no</button><button type="button" data-ck-si>Aceptar</button></span>';
    a.querySelector('[data-ck-si]').addEventListener('click', function () { responder('si'); });
    a.querySelector('[data-ck-no]').addEventListener('click', function () { responder('no'); });
    document.body.appendChild(a);
    requestAnimationFrame(function () { requestAnimationFrame(function () { a.classList.add('ck-visible'); }); });
  }

  /* el toque al botón del canal se cuenta en la fase de captura, antes de que la página salte a WhatsApp */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-canal]') : null;
    if (b) window.cherryMedir('Lead', { content_name: 'Canal de WhatsApp' });
  }, true);

  window.cherryMedir('PageView');
  if (!estado) {
    if (document.body) aviso(); else document.addEventListener('DOMContentLoaded', aviso);
  }
})();

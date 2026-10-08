/* lado.js — LA barra de herramientas de la izquierda. Una sola para todo Cherry menos el editor: la usan el inicio
 * (js/components/inicio.js › barraLateral) y las 7 herramientas (herramientas/*.html).
 * 4-oct-2026 nació en el inicio; 6-oct-2026, Sergio: «esa barra va a ir en todas las páginas excepto en el editor» y
 * «no deberías duplicarla: debe ser un mismo elemento compartido en todas las páginas», en el mismo punto que en el inicio.
 *
 * Aquí viven la lista, los íconos, el estilo y, en las herramientas, el marco de la página (el mismo del inicio: la barra
 * de arriba de lado a lado a 16 px del borde izquierdo y 20 del derecho, la barra de herramientas debajo a la izquierda y
 * el contenido a 100 px, hasta 1880 px de ancho). Solo en pantalla ancha (≥1101 px); en tableta y celular no hay barra.
 * 68 px con los íconos; se despliega a 240 px ENCIMA del contenido al pasar el ratón o al llegar con el teclado.
 *
 * Las herramientas la cargan en su <head>, justo después de cherry.js (`../js/lado.js?v=…`): las reglas entran antes de
 * pintar y la barra se arma sola. El inicio la carga antes de inicio.js y la pinta con CherryLado.html().
 */
(function () {
  'use strict';
  var ANCHO = 68, AIRE = 16;   // la barra y el espacio hasta el contenido (el --gap del inicio)
  var EN_HERRAMIENTA = /\/herramientas\/[^/]*$/.test(location.pathname);
  var RAIZ = EN_HERRAMIENTA ? '../' : '';
  /* (6-oct) Guiones es una vista del Laboratorio (laboratorio.html?modo=guiones): ahí va en rosa Guiones */
  var AQUI = !EN_HERRAMIENTA ? 'inicio' : /[?&]modo=guiones/.test(location.search) ? 'guiones' : /[?&]formato=historias/.test(location.search) ? 'historias'
    : (location.pathname.split('/').pop() || '').replace(/\.html$/, '');

  var svg = function (d) {
    return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };
  var I = {
    inicio: svg('<path d="M3 9.2L10 3.5l7 5.7V16a1 1 0 01-1 1h-3.5v-4.5h-5V17H4a1 1 0 01-1-1z"/>'),
    proyectos: svg('<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M2.5 7.5h15"/>'),
    editor: svg('<rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M8.5 8l4 2-4 2z"/>'),
    guiones: svg('<rect x="4" y="2.5" width="12" height="15" rx="2"/><path d="M7 7h6M7 10h6M7 13h3.5"/>'),
    storyboard: svg('<rect x="2.5" y="5" width="6" height="6" rx="1.2"/><rect x="11.5" y="5" width="6" height="6" rx="1.2"/><path d="M4 14.5h12"/>'),
    carruseles: svg('<rect x="6" y="3.5" width="8" height="13" rx="1.6"/><path d="M3.5 6.5v7M16.5 6.5v7"/>'),
    historias: svg('<rect x="5.5" y="2.5" width="9" height="15" rx="2"/><path d="M7.5 5h1.6M10.5 5h2"/>'),
    calendario: svg('<rect x="2.5" y="4" width="15" height="13" rx="2"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/>'),
    marca: svg('<path d="M10 2.5c3.6 3.4 5.5 6 5.5 8.3A5.5 5.5 0 014.5 10.8c0-2.3 1.9-4.9 5.5-8.3z"/>'),
    laboratorio: svg('<path d="M8 2.5h4M8.8 2.5v5L4.4 14.8a1.6 1.6 0 001.4 2.4h8.4a1.6 1.6 0 001.4-2.4L11.2 7.5v-5"/><path d="M6.6 12h6.8"/>'),
    respuestas: svg('<path d="M3 4.5h9a1.5 1.5 0 011.5 1.5v4.5a1.5 1.5 0 01-1.5 1.5H7l-3 2.5V12H3a1.5 1.5 0 01-1.5-1.5V6A1.5 1.5 0 013 4.5z"/><path d="M13.5 8.5h3.5M17 8.5l-1.6-1.6M17 8.5l-1.6 1.6"/>'),
  };
  /* el orden y los nombres. Las direcciones van desde la raíz del sitio; «Mis proyectos» y «Editor Pro» viven en
     app.html (main.js lee ?ir=; en el inicio los atiende inicio.js sin recargar) */
  var LISTA = [
    ['inicio', 'Inicio', 'app.html'],
    ['proyectos', 'Mis proyectos', 'app.html?ir=proyectos'],
    'Crear',
    ['editor', 'Editor Pro', 'app.html?ir=editor'],
    ['guiones', 'Guiones', 'herramientas/laboratorio.html?modo=guiones'],
    ['storyboard', 'Storyboard', 'herramientas/storyboard.html'],
    ['carruseles', 'Carruseles', 'herramientas/carruseles.html'],
    ['historias', 'Historias', 'herramientas/carruseles.html?formato=historias'],
    'Publicar',
    ['calendario', 'Calendario', 'herramientas/calendario.html'],
    ['respuestas', 'Respuestas automáticas', 'herramientas/respuestas.html'],
    'Tu marca',
    ['marca', 'Identidad de marca', 'herramientas/marca.html'],
    ['laboratorio', 'Laboratorio', 'herramientas/laboratorio.html'],
  ];

  /* lo de adentro de la barra; `aqui` es la que va en rosa */
  function html(aqui) {
    var s = '';
    LISTA.forEach(function (x) {
      if (typeof x === 'string') { s += '<span class="ck-lado__grupo">' + x + '</span>'; return; }
      var on = x[0] === aqui;
      s += '<a class="ck-lado__it' + (on ? ' on' : '') + '" href="' + RAIZ + x[2] + '" data-lado="' + x[0] + '" title="' + x[1] + '" aria-label="' + x[1] + '"' +
        (on ? ' aria-current="page"' : '') + '><span class="ck-lado__ico">' + I[x[0]] + '</span><span>' + x[1] + '</span></a>';
    });
    return s + '<span class="ck-lado__pie">7 herramientas · todas listas</span>';
  }

  var css =
    /* la barra (igual en el inicio y en las herramientas) */
    '.ck-lado{display:none}' +
    '@media (min-width:1101px){' +
    '.ck-lado{display:flex;width:' + ANCHO + 'px;flex-direction:column;gap:2px;padding:16px 10px;min-height:0;box-sizing:border-box;' +
      'overflow-x:hidden;overflow-y:auto;scrollbar-width:none;transition:width .22s cubic-bezier(.2,.7,.2,1),box-shadow .22s}' +
    '.ck-lado::-webkit-scrollbar{display:none}' +
    '.ck-lado:hover,.ck-lado:focus-within{width:240px;box-shadow:inset 0 1px 0 var(--brillo),0 30px 60px -20px var(--sombra),0 0 0 1px var(--borde)}' +
    '.ck-lado__grupo{font:500 10px var(--f-mono);letter-spacing:.14em;text-transform:uppercase;margin:16px 14px 6px;white-space:nowrap;' +
      'height:1px;flex:none;overflow:hidden;color:transparent;background:var(--borde)}' +
    '.ck-lado:hover .ck-lado__grupo,.ck-lado:focus-within .ck-lado__grupo{height:auto;color:var(--tinta-3);background:none}' +
    '.ck-lado__it{display:flex;align-items:center;gap:12px;width:100%;flex:none;padding:10px 14px;border-radius:14px;white-space:nowrap;box-sizing:border-box;' +
      'color:var(--tinta-2);font:600 14px var(--f-ui,var(--f-texto,system-ui));text-decoration:none;cursor:pointer;transition:background .18s,color .18s}' +
    '.ck-lado__it>span:last-child{opacity:0;transition:opacity .15s}' +
    '.ck-lado:hover .ck-lado__it>span:last-child,.ck-lado:focus-within .ck-lado__it>span:last-child{opacity:1;transition-delay:.06s}' +
    '.ck-lado__it:hover{background:var(--pastilla);color:var(--tinta)}' +
    '.ck-lado__it:focus-visible{outline:2px solid var(--rosa);outline-offset:-2px}' +
    '.ck-lado__it.on{background:color-mix(in srgb,var(--rosa) 12%,transparent);color:var(--tinta)}' +
    '.ck-lado__it.on .ck-lado__ico{color:var(--rosa)}' +
    '.ck-lado__ico{flex:none;width:20px;height:20px;display:grid;place-items:center}' +
    '.ck-lado__ico svg{width:20px;height:20px;display:block}' +
    '.ck-lado__pie{margin-top:auto;padding:14px 12px 4px;font:500 10px/1.6 var(--f-mono);letter-spacing:.14em;text-transform:uppercase;' +
      'color:var(--tinta-3);min-width:210px;opacity:0;transition:opacity .15s}' +
    '.ck-lado:hover .ck-lado__pie,.ck-lado:focus-within .ck-lado__pie{opacity:1}' +
    '@media (max-height:820px){.ck-lado{padding:10px}.ck-lado__it{padding:7px 14px;font-size:13.5px}.ck-lado__grupo{margin:10px 14px 4px}}' +
    /* las herramientas: el mismo marco del inicio (.ci y .ci-marco en css/styles.css). La caja de la página
       (.envoltura, o .app en Respuestas) deja a la izquierda el sitio de la barra, que va fija; la barra de arriba se
       estira por encima. `.app ` delante: la `.vol{position:relative}` de cada página venía después y le ganaba. */
    '.app.ck-marco{padding:20px 20px 20px 16px}' +
    '.app .ck-con-lado{max-width:1880px;margin-inline:auto;padding-left:' + (ANCHO + AIRE) + 'px}' +
    '.app .ck-con-lado .envoltura{max-width:none}' +
    '.app.ck-con-lado{padding-left:' + (16 + ANCHO + AIRE) + 'px}' +
    '.app .ck-con-lado>header.barra,.app.ck-con-lado>header.barra{margin-left:-' + (ANCHO + AIRE) + 'px;max-width:none}' +
    '.app .ck-lado.ck-lado--fija{position:fixed;z-index:40;margin:0;left:16px;top:98px;height:calc(100vh - 118px)}' +
    '}' +
    /* sin migas de pan (6-oct): los créditos y la foto a la derecha; en el celular «◆ 20» para que quepa en una fila */
    '.app .barra>[data-creditos]{margin-left:auto}' +
    '@media (max-width:440px){.app .barra [data-creditos] .palabra{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.ck-lado,.ck-lado__it>span:last-child{transition:none}}';
  var estilo = document.createElement('style');
  estilo.id = 'ck-lado-estilo';
  estilo.textContent = css;
  (document.head || document.documentElement).appendChild(estilo);

  window.CherryLado = { html: html, iconos: I };

  /* ── En las herramientas se arma sola ── */
  function armar() {
    var app = document.getElementById('app');
    var barra = app && app.querySelector('header.barra');
    if (!barra || document.querySelector('.ck-lado')) return;
    var caja = barra.parentElement;   // .envoltura (o .app en Respuestas)
    app.classList.add('ck-marco');
    caja.classList.add('ck-con-lado');
    var nav = document.createElement('nav');
    nav.className = 'ck-lado ck-lado--fija vol';
    nav.setAttribute('aria-label', 'Herramientas de Cherry');
    nav.innerHTML = html(AQUI);
    caja.insertBefore(nav, barra.nextSibling);

    /* Dónde va: a la izquierda del contenido, debajo de la barra de arriba (como en el inicio); al bajar la página sube
       con ella hasta quedar a 20 px del borde y ahí se queda */
    var pedido = 0;
    function ubicar() {
      pedido = 0;
      if (window.innerWidth < 1101) return;
      var rc = caja.getBoundingClientRect(), rb = barra.getBoundingClientRect();
      var arriba = Math.max(20, rb.bottom + AIRE);
      nav.style.left = Math.round(rc.left + parseFloat(getComputedStyle(caja).paddingLeft) - ANCHO - AIRE) + 'px';
      nav.style.top = Math.round(arriba) + 'px';
      nav.style.height = Math.max(200, Math.round(window.innerHeight - arriba - 20)) + 'px';
    }
    function pedir() { if (!pedido) pedido = requestAnimationFrame(ubicar); }
    ubicar();
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    window.addEventListener('load', pedir);
    if (window.ResizeObserver) { var ro = new ResizeObserver(pedir); ro.observe(barra); ro.observe(caja); }
  }
  if (EN_HERRAMIENTA) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armar);
    else armar();
  }
})();

/* lado.js — la barra de herramientas de la izquierda en TODAS las páginas de Cherry menos el editor.
 * 6-oct-2026, Sergio: «esa barra de herramientas va a ir en todas las páginas excepto en el editor».
 *
 * Es la misma del inicio (js/components/inicio.js › barraLateral y sus reglas .ci-lado en css/styles.css): 68 px con
 * los íconos, se despliega a 240 px ENCIMA del contenido al pasar el ratón o llegar con el teclado. Solo en pantalla
 * ancha (≥1101 px); en tableta y celular no hay barra, igual que en el inicio.
 *
 * Cada herramienta la carga en su <head>, justo después de cherry.js: las reglas entran antes de pintar (la página no
 * salta) y la barra se arma al tener el documento. Se pone debajo de la barra de arriba, que se estira por encima de
 * ella como en el inicio; va fija y baja con la página hasta quedar a 20 px del borde.
 */
(function () {
  'use strict';
  var ANCHO = 68, AIRE = 16;   // la barra y el espacio hasta el contenido (--gap de las herramientas)
  var AQUI = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');

  var svg = function (d) {
    return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };
  /* los mismos dibujos del inicio (inicio.js e inicio-gira.js › ICONOS) */
  var I = {
    inicio: svg('<path d="M3 9.2L10 3.5l7 5.7V16a1 1 0 01-1 1h-3.5v-4.5h-5V17H4a1 1 0 01-1-1z"/>'),
    proyectos: svg('<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M2.5 7.5h15"/>'),
    editor: svg('<rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M8.5 8l4 2-4 2z"/>'),
    guiones: svg('<rect x="4" y="2.5" width="12" height="15" rx="2"/><path d="M7 7h6M7 10h6M7 13h3.5"/>'),
    storyboard: svg('<rect x="2.5" y="5" width="6" height="6" rx="1.2"/><rect x="11.5" y="5" width="6" height="6" rx="1.2"/><path d="M4 14.5h12"/>'),
    carruseles: svg('<rect x="6" y="3.5" width="8" height="13" rx="1.6"/><path d="M3.5 6.5v7M16.5 6.5v7"/>'),
    calendario: svg('<rect x="2.5" y="4" width="15" height="13" rx="2"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/>'),
    marca: svg('<path d="M10 2.5c3.6 3.4 5.5 6 5.5 8.3A5.5 5.5 0 014.5 10.8c0-2.3 1.9-4.9 5.5-8.3z"/>'),
    laboratorio: svg('<path d="M8 2.5h4M8.8 2.5v5L4.4 14.8a1.6 1.6 0 001.4 2.4h8.4a1.6 1.6 0 001.4-2.4L11.2 7.5v-5"/><path d="M6.6 12h6.8"/>'),
    respuestas: svg('<path d="M3 4.5h9a1.5 1.5 0 011.5 1.5v4.5a1.5 1.5 0 01-1.5 1.5H7l-3 2.5V12H3a1.5 1.5 0 01-1.5-1.5V6A1.5 1.5 0 013 4.5z"/><path d="M13.5 8.5h3.5M17 8.5l-1.6-1.6M17 8.5l-1.6 1.6"/>'),
  };
  /* el orden y los nombres del inicio. «Mis proyectos» y «Editor Pro» viven en app.html (main.js lee ?ir=) */
  var LISTA = [
    ['inicio', 'Inicio', '../app.html'],
    ['proyectos', 'Mis proyectos', '../app.html?ir=proyectos'],
    'Crear',
    ['editor', 'Editor Pro', '../app.html?ir=editor'],
    ['guiones', 'Guiones', 'guiones.html'],
    ['storyboard', 'Storyboard', 'storyboard.html'],
    ['carruseles', 'Carruseles', 'carruseles.html'],
    'Publicar',
    ['calendario', 'Calendario', 'calendario.html'],
    ['respuestas', 'Respuestas automáticas', 'respuestas.html'],
    'Tu marca',
    ['marca', 'Identidad de marca', 'marca.html'],
    ['laboratorio', 'Laboratorio', 'laboratorio.html'],
  ];

  var css =
    '.app .ck-lado{display:none}' +
    '@media (min-width:1101px){' +
    '.app .ck-con-lado,.app.ck-con-lado{padding-left:calc(var(--ck-pl,0px) + ' + (ANCHO + AIRE) + 'px);max-width:var(--ck-mw,none)}' +
    '.app .ck-con-lado>header.barra,.app.ck-con-lado>header.barra{margin-left:-' + (ANCHO + AIRE) + 'px}' +
    '.app .ck-lado{display:flex;position:fixed;margin:0;z-index:40;left:0;top:100px;height:calc(100vh - 120px);width:' + ANCHO + 'px;flex-direction:column;gap:2px;' +
      'padding:16px 10px;border-radius:var(--r,30px);overflow-x:hidden;overflow-y:auto;scrollbar-width:none;' +
      'transition:width .22s cubic-bezier(.2,.7,.2,1),box-shadow .22s}' +
    '.ck-lado::-webkit-scrollbar{display:none}' +
    '.app .ck-lado:hover,.app .ck-lado:focus-within{width:240px;box-shadow:inset 0 1px 0 var(--brillo),0 30px 60px -20px var(--sombra),0 0 0 1px var(--borde)}' +
    '.ck-lado__grupo{font:500 10px var(--f-mono);letter-spacing:.14em;text-transform:uppercase;margin:16px 14px 6px;white-space:nowrap;' +
      'height:1px;flex:none;overflow:hidden;color:transparent;background:var(--borde)}' +
    '.ck-lado:hover .ck-lado__grupo,.ck-lado:focus-within .ck-lado__grupo{height:auto;color:var(--tinta-3);background:none}' +
    '.ck-lado__it{display:flex;align-items:center;gap:12px;width:100%;flex:none;padding:10px 14px;border-radius:14px;white-space:nowrap;box-sizing:border-box;' +
      'color:var(--tinta-2);font:600 14px var(--f-texto);text-decoration:none;transition:background .18s,color .18s}' +
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
    '@media (max-height:820px){.app .ck-lado{padding:10px}.ck-lado__it{padding:7px 14px;font-size:13.5px}.ck-lado__grupo{margin:10px 14px 4px}}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){.ck-lado,.ck-lado__it>span:last-child{transition:none}}';
  var estilo = document.createElement('style');
  estilo.id = 'ck-lado-estilo';
  estilo.textContent = css;
  document.head.appendChild(estilo);

  function armar() {
    var app = document.getElementById('app');
    var barra = app && app.querySelector('header.barra');
    if (!barra || document.querySelector('.ck-lado')) return;
    var caja = barra.parentElement;   // .envoltura (o .app en Respuestas)

    /* El contenido no pierde ancho: la caja crece lo que ocupa la barra, encima de su propio relleno y su tope */
    function medir() {
      caja.classList.remove('ck-con-lado');
      var cs = getComputedStyle(caja), mw = cs.maxWidth;
      caja.style.setProperty('--ck-pl', (parseFloat(cs.paddingLeft) || 0) + 'px');
      if (/px$/.test(mw)) caja.style.setProperty('--ck-mw', (parseFloat(mw) + ANCHO + AIRE) + 'px');
      caja.classList.add('ck-con-lado');
    }
    medir();

    var nav = document.createElement('nav');
    nav.className = 'ck-lado vol';
    nav.setAttribute('aria-label', 'Herramientas de Cherry');
    var html = '';
    LISTA.forEach(function (x) {
      if (typeof x === 'string') { html += '<span class="ck-lado__grupo">' + x + '</span>'; return; }
      var on = x[0] === AQUI;
      html += '<a class="ck-lado__it' + (on ? ' on' : '') + '" href="' + x[2] + '" title="' + x[1] + '" aria-label="' + x[1] + '"' +
        (on ? ' aria-current="page"' : '') + '><span class="ck-lado__ico">' + I[x[0]] + '</span><span>' + x[1] + '</span></a>';
    });
    nav.innerHTML = html + '<span class="ck-lado__pie">7 herramientas · todas listas</span>';
    caja.insertBefore(nav, barra.nextSibling);

    /* Dónde va: a la izquierda del contenido, debajo de la barra de arriba; al bajar la página, sube con ella hasta
       quedar a 20 px del borde y ahí se queda. */
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
    window.addEventListener('resize', function () { medir(); pedir(); });
    window.addEventListener('load', pedir);
    if (window.ResizeObserver) { var ro = new ResizeObserver(pedir); ro.observe(barra); ro.observe(caja); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armar);
  else armar();
})();

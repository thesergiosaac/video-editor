/* inicio-gira.js — la tarjeta que rota entre las herramientas (22-sep-2026, maqueta aprobada)
 *
 * Una sola tarjeta que va pasando por Guiones, Storyboard, Carruseles, Calendario, Identidad de
 * marca y Laboratorio, en vez de seis tarjetas sueltas ocupando el bento. Abajo, un icono por
 * herramienta para ir directo a la que quieras — los iconos que se quitaron de la tarjeta del
 * perfil son estos.
 *
 * ⚠️ Las clases de aquí empiezan por `cg-` y la tarjeta es `.ci-gira`. Antes de inventar un nombre,
 * comprobar que no exista ya: `.ci-cuenta` era el contenedor del avatar de la barra y reutilizarlo
 * la estiró sin que nada avisara.
 *
 * El nodo es uno solo para toda la vida de la página: C.render() reconstruye la app entera y un
 * nodo nuevo cada vez reiniciaría la rotación con cada tecla del buscador.
 */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const VUELTA = 5500;

  let nodo = null, items = [], j = 0, reloj = 0, fijo = false;

  const svg = (d) => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

  /* Un icono por herramienta, dibujado con lo que la herramienta hace — no una letra. */
  const ICONOS = {
    guiones:    svg('<rect x="4" y="2.5" width="12" height="15" rx="2"/><path d="M7 7h6M7 10h6M7 13h3.5"/>'),
    storyboard: svg('<rect x="2.5" y="5" width="6" height="6" rx="1.2"/><rect x="11.5" y="5" width="6" height="6" rx="1.2"/><path d="M4 14.5h12"/>'),
    carruseles: svg('<rect x="6" y="3.5" width="8" height="13" rx="1.6"/><path d="M3.5 6.5v7M16.5 6.5v7"/>'),
    calendario: svg('<rect x="2.5" y="4" width="15" height="13" rx="2"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/>'),
    marca:      svg('<path d="M10 2.5c3.6 3.4 5.5 6 5.5 8.3A5.5 5.5 0 014.5 10.8c0-2.3 1.9-4.9 5.5-8.3z"/>'),
    lab:        svg('<path d="M8 2.5h4M8.8 2.5v5L4.4 14.8a1.6 1.6 0 001.4 2.4h8.4a1.6 1.6 0 001.4-2.4L11.2 7.5v-5"/><path d="M6.6 12h6.8"/>'),
    respuestas: svg('<path d="M3 4.5h9a1.5 1.5 0 011.5 1.5v4.5a1.5 1.5 0 01-1.5 1.5H7l-3 2.5V12H3a1.5 1.5 0 01-1.5-1.5V6A1.5 1.5 0 013 4.5z"/><path d="M13.5 8.5h3.5M17 8.5l-1.6-1.6M17 8.5l-1.6 1.6"/>'),
  };

  function pinta() {
    if (!nodo || !items.length) return;
    const it = items[j];
    nodo.querySelector('.cg-cuerpo').innerHTML =
      (it.etq ? '<span class="ci-pronto">' + it.etq + '</span>' : '') +
      '<h2>' + it.titulo + '</h2>' +
      '<p>' + it.texto + '</p>';
    const est = nodo.querySelector('.cg-est');
    if (it.estatua) {
      est.hidden = false;
      est.src = 'assets/inicio/' + it.estatua + '.webp?v=20260918';
      est.alt = it.alt || '';
      est.style.maxWidth = (it.ancho || 44) + '%';
    } else {
      est.hidden = true;
    }
    /* Las que no tienen estatua llevan su propio dibujo: la semana del calendario, la curva de
       retencion del laboratorio. Es lo que enseñaban cuando cada una era su tarjeta. */
    const ad = nodo.querySelector('.cg-adorno');
    ad.innerHTML = '';
    ad.hidden = !it.adorno;
    if (it.adorno) {
      const hijos = it.adorno();
      (Array.isArray(hijos) ? hijos : [hijos]).forEach((n) => n && ad.appendChild(n));
    }
    nodo.setAttribute('aria-label', 'Abrir ' + it.nombre);
    nodo.querySelectorAll('.cg-punto').forEach((b, k) => {
      b.setAttribute('aria-current', String(k === j));
    });
    const t = nodo.querySelector('.cg-tiempo i');
    t.classList.remove('corre'); void t.offsetWidth;
    if (!fijo && items.length > 1) { t.style.animationDuration = VUELTA + 'ms'; t.classList.add('corre'); }
    else { t.style.width = '0'; }
  }
  function arranca() {
    clearInterval(reloj);
    if (items.length < 2 || fijo) { pinta(); return; }
    reloj = setInterval(() => { j = (j + 1) % items.length; pinta(); }, VUELTA);
    pinta();
  }

  /* `lista`: [{ nombre, etq, titulo, texto, estatua, ancho, icono, abrir }] */
  C.tarjetaGira = function (lista) {
    const cambio = JSON.stringify(lista.map((x) => [x.nombre, x.titulo, x.texto, x.etq]));
    if (!nodo) {
      nodo = C.h('section', {
        class: 'ci-t ci-vol ci-gira', role: 'button', tabindex: '0',
        onClick: (e) => { if (!e.target.closest('.cg-mando')) items[j] && items[j].abrir(); },
        onKeydown: (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === nodo) { e.preventDefault(); items[j] && items[j].abrir(); }
        },
      },
        C.h('span', { class: 'ci-flecha', 'aria-hidden': 'true' }, '→'),
        C.h('div', { class: 'cg-cuerpo' }),
        C.h('img', { class: 'ci-estatua cg-est', alt: '' }),
        C.h('div', { class: 'cg-adorno', 'aria-hidden': 'true' }),
        C.h('div', { class: 'cg-mando' }),
        C.h('div', { class: 'cg-tiempo' }, C.h('i'))
      );
      /* Con el ratón encima se para: nadie lee algo que se va solo. */
      nodo.addEventListener('mouseenter', () => { if (!fijo) { clearInterval(reloj);
        const t = nodo.querySelector('.cg-tiempo i'); if (t) t.classList.remove('corre'); } });
      nodo.addEventListener('mouseleave', () => { if (!fijo) arranca(); });
    }
    if (nodo.dataset.marca !== cambio) {
      nodo.dataset.marca = cambio;
      items = lista;
      if (j >= items.length) j = 0;
      const mando = nodo.querySelector('.cg-mando');
      mando.innerHTML = items.map((it, k) =>
        '<button type="button" class="cg-punto" data-k="' + k + '" title="' + it.nombre +
        '" aria-label="' + it.nombre + '">' + (ICONOS[it.icono] || ICONOS.guiones) + '</button>').join('');
      mando.querySelectorAll('.cg-punto').forEach((b) => {
        /* Tocar un icono elige esa herramienta y para la rotación: si siguiera girando,
           lo que elegiste se iría solo antes de que te dé tiempo a leerlo. */
        b.onclick = (e) => { e.stopPropagation(); j = Number(b.dataset.k); fijo = true; arranca(); };
      });
      arranca();
    }
    return nodo;
  };
})();

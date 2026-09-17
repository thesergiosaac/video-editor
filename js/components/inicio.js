/* inicio.js — la pantalla que se ve al entrar, antes del editor (17-sep-2026)
   Carrusel con tus proyectos para seguir donde ibas + plantillas.
   El carrusel se mueve cambiando clases en el DOM (sin redibujar la app) para que se vea la transición. */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  /* ── Menú lateral ── */
  const MENU = [
    { id: 'inicio', ic: '◉', name: 'Inicio' },
    { id: 'proyectos', ic: '▤', name: 'Proyectos' },
    { id: 'plantillas', ic: '✦', name: 'Plantillas' },
    { id: 'clips', ic: '▣', name: 'Mis clips' },
    { id: 'publicar', ic: '↗', name: 'Publicar', pronto: true },
    { id: 'stats', ic: '◔', name: 'Estadísticas', pronto: true },
    { id: 'mensajes', ic: '✉', name: 'Mensajes', pronto: true },
    { id: 'marca', ic: '●', name: 'Mi marca' },
  ];

  const A = () => C.actions;
  /* «Hola, Sergio»: solo el primer nombre del perfil */
  const nombrePila = (perfil) => ((perfil && perfil.full_name) || '').trim().split(/\s+/)[0] || '';

  function irMenu(id) {
    const s = C.state;
    if (id === 'inicio') return C.setState({ inicioSeccion: 'plantillas' });
    if (id === 'proyectos') return C.setState({ inicioSeccion: 'proyectos' });
    if (id === 'plantillas') return C.setState({ inicioSeccion: 'plantillas' });
    if (id === 'clips') return C.setState({ pantalla: 'editor', openCard: null });
    if (id === 'marca') return C.setState({ pantalla: 'editor', openCard: 'marca' });
    void s;
  }

  /* ── Tapa del proyecto: el propio video, la miniatura de un clip o un color ── */
  function tapa(p, sufijo) {
    const clave = 'tapa-' + p.id + (sufijo || '');
    if (p.video) {
      return C.videoFijo(clave, C.urlVideo(p.video) + '#t=1.2', {
        class: 'in-tapa', muted: true, playsinline: true, preload: 'metadata',
      });
    }
    if (p.miniatura) return C.imgFija(clave, p.miniatura, { class: 'in-tapa', alt: '' });
    return h('div', { class: 'in-tapa in-tapa--vacia' }, h('span', null, (p.title || 'P').charAt(0).toUpperCase()));
  }

  const clase = (i, centro, total) => {
    const d = i - centro;
    if (d === 0) return 'in-centro';
    const lado = d < 0 ? 'i' : '';
    if (Math.abs(d) === 1) return 'in-d1 in-d1' + lado;
    return 'in-d2 in-d2' + lado;
  };

  /* Mover el carrusel sin redibujar: solo cambian las clases (así se ve la transición) */
  function colocar(centro) {
    const cards = document.querySelectorAll('.in-proyecto');
    cards.forEach((el, i) => { el.className = 'in-proyecto ' + clase(i, centro, cards.length); });
    const p = (C.state.inicioProyectos || [])[centro];
    if (!p) return;
    const nom = document.querySelector('.js-in-nombre'), paso = document.querySelector('.js-in-paso');
    if (nom) nom.textContent = p.title || 'Sin nombre';
    if (paso) paso.textContent = p.paso;
  }

  function girar(paso) {
    const lista = C.state.inicioProyectos || [];
    if (!lista.length) return;
    const centro = (C.state.inicioCentro + paso + lista.length) % lista.length;
    C.setState({ inicioCentro: centro }, { render: false });
    colocar(centro);
  }

  function tarjetaProyecto(p, i, centro, total) {
    return h('div', { class: 'in-proyecto ' + clase(i, centro, total), onClick: () => { if (i !== C.state.inicioCentro) { C.setState({ inicioCentro: i }, { render: false }); colocar(i); } } },
      tapa(p),
      h('span', { class: 'in-estado', style: { background: p.color } }, p.estado),
      h('button', { class: 'in-play', title: 'Abrir', onClick: (e) => { e.stopPropagation(); A().abrirProyecto(p.id); } }, '▶'),
      h('div', { class: 'in-info' },
        h('h3', null, p.title || 'Sin nombre'),
        h('p', null, p.paso),
        h('div', { class: 'in-avance' }, h('i', { style: { width: p.avance + '%' } })),
        h('button', { class: 'in-continuar', onClick: (e) => { e.stopPropagation(); A().abrirProyecto(p.id); } }, '▸ ' + (p.avance >= 100 ? 'Abrir' : 'Continuar'))
      )
    );
  }

  /* ── Sin proyectos: una sola tarjeta que invita a empezar ── */
  function tarjetaVacia() {
    return [
      ['in-d1 in-d1i', 'in-d1', 'in-d2 in-d2i', 'in-d2'].map((c) => h('div', { class: 'in-fantasma ' + c }, '+')),
      h('div', { class: 'in-vacio' },
        h('span', { class: 'in-vacio__cereza', html: C.cereza().innerHTML }),
        h('div', null,
          h('div', { class: 'kicker' }, 'Tu primer video'),
          h('h3', null, 'Aquí va a estar tu trabajo'),
          h('p', null, 'Sube los clips de tu celular y Cherry arma el video: corta los errores, pone los subtítulos y lo deja listo para publicar.'),
          h('button', { class: 'in-cta', onClick: () => A().nuevoDesdeInicio() }, '↑ Subir mis clips'),
          h('span', { class: 'in-alt' }, 'o empieza escogiendo una plantilla ↓')
        )
      ),
    ];
  }

  /* ── Plantillas (las de subtítulos que ya funcionan) ── */
  function rejillaPlantillas(s) {
    const simple = C.subs.simpleVista(s);
    return h('div', { class: 'in-rejilla' },
      C.subs.PLANTILLAS.concat([C.subs.SIMPLE]).map((p) =>
        h('button', {
          class: 'in-plantilla js-in-filtra', 'data-nombre': p.name.toLowerCase(), title: p.desc,
          onClick: () => C.setState({ subsPlantilla: p.id, pantalla: 'editor', openCard: 'texto', typographyPreview: true, previaEnfoque: null }),
        },
          h('div', { class: 'in-plantilla__tapa' }, C.subs.marco(p.id, C.subs.MUESTRAS[0], simple)),
          h('div', { class: 'in-plantilla__cuerpo' },
            h('div', { class: 'in-plantilla__nom' }, p.name),
            h('div', { class: 'in-plantilla__autor' }, 'por ', h('b', null, 'Cherry'))
          )
        )
      )
    );
  }

  /* ── Todos los proyectos ── */
  function rejillaProyectos(lista) {
    if (!lista.length) return h('div', { class: 'in-nada' }, 'Todavía no tienes proyectos.');
    return h('div', { class: 'in-rejilla' },
      lista.map((p) =>
        h('button', { class: 'in-plantilla js-in-filtra', 'data-nombre': (p.title || '').toLowerCase(), onClick: () => A().abrirProyecto(p.id) },
          h('div', { class: 'in-plantilla__tapa' }, tapa(p, '-rejilla'), h('span', { class: 'in-estado', style: { background: p.color } }, p.estado)),
          h('div', { class: 'in-plantilla__cuerpo' },
            h('div', { class: 'in-plantilla__nom' }, p.title || 'Sin nombre'),
            h('div', { class: 'in-plantilla__autor' }, p.paso)
          )
        )
      )
    );
  }

  /* Buscador: filtra en el momento, sin redibujar (así no se pierde el cursor) */
  function filtrar(texto) {
    const t = (texto || '').trim().toLowerCase();
    document.querySelectorAll('.js-in-filtra').forEach((el) => {
      el.style.display = !t || (el.getAttribute('data-nombre') || '').indexOf(t) >= 0 ? '' : 'none';
    });
  }

  C.Inicio = function () {
    const s = C.state;
    const lista = s.inicioProyectos || [];
    const centro = Math.min(s.inicioCentro || 0, Math.max(0, lista.length - 1));
    const activo = lista[centro] || null;
    const seccion = s.inicioSeccion === 'proyectos' ? 'proyectos' : 'plantillas';

    const lateral = h('aside', { class: 'in-lateral' },
      h('nav', { class: 'in-menu' },
        MENU.map((m) => h('button', {
          class: 'in-menu__it'
            + ((m.id === 'inicio' && seccion === 'plantillas') || (m.id === 'proyectos' && seccion === 'proyectos') ? ' on' : '')
            + (m.pronto ? ' pronto' : ''),
          disabled: m.pronto || false,
          onClick: () => irMenu(m.id),
        }, h('span', { class: 'in-menu__ic' }, m.ic), m.name, m.pronto && h('span', { class: 'in-menu__tag' }, 'pronto')))
      ),
      h('div', { class: 'in-lateral__pie' },
        h('div', { class: 'in-plan' },
          h('div', { class: 'kicker' }, 'Tus créditos'),
          h('b', null, (s.perfil && s.perfil.credits_remaining != null ? s.perfil.credits_remaining : '—') + ' créditos'),
          h('div', { class: 'bar bar--sm' }, h('i', { style: { width: Math.min(100, (s.perfil && s.perfil.credits_remaining) || 0) + '%' } }))
        ),
        h('button', { class: 'in-menu__it', onClick: () => C.api.logout(), style: { color: 'var(--magenta)' } }, h('span', { class: 'in-menu__ic' }, '⏻'), 'Cerrar sesión')
      )
    );

    const contenido = h('div', { class: 'in-contenido' },
      h('div', { class: 'in-superior' },
        h('input', { class: 'in-buscador', type: 'search', placeholder: 'Busca un proyecto o una plantilla', onInput: (e) => filtrar(e.target.value) })
      ),

      h('div', { class: 'in-cabecera' },
        h('div', null,
          h('div', { class: 'kicker' }, lista.length ? 'Sigue donde ibas' : 'Empecemos'),
          h('h1', { class: 'in-hola' }, (lista.length ? 'Hola' : 'Bienvenido') + (nombrePila(s.perfil) ? ', ' + nombrePila(s.perfil) : ''))
        ),
        lista.length > 1 && h('div', { class: 'in-flechas' },
          h('button', { onClick: () => girar(-1), title: 'Anterior' }, '‹'),
          h('button', { onClick: () => girar(1), title: 'Siguiente' }, '›')
        )
      ),

      h('div', { class: 'in-carrusel' },
        !s.inicioCargado ? h('div', { class: 'in-cargando' }, h('span', { class: 'spinner spinner--lg' }))
          : lista.length ? lista.map((p, i) => tarjetaProyecto(p, i, centro, lista.length))
            : tarjetaVacia()
      ),

      h('div', { class: 'in-acciones' },
        h('button', { class: 'in-accion in-accion--fuerte', onClick: () => A().nuevoDesdeInicio() }, h('span', null, '＋'), 'Nuevo video'),
        h('button', { class: 'in-accion', onClick: () => C.setState({ pantalla: 'editor', openCard: null }) }, h('span', null, '↑'), 'Subir clips'),
        h('button', { class: 'in-accion', onClick: () => C.setState({ pantalla: 'editor', scriptOpen: true }) }, h('span', null, '✎'), 'Escribir guion'),
        h('button', { class: 'in-accion pronto', disabled: true }, h('span', null, '◷'), 'Programar', h('span', { class: 'in-menu__tag' }, 'pronto')),
        h('button', { class: 'in-accion pronto', disabled: true }, h('span', null, '◔'), 'Estadísticas', h('span', { class: 'in-menu__tag' }, 'pronto'))
      ),

      h('div', { class: 'in-cabecera' },
        h('div', null,
          h('div', { class: 'h-module', style: { fontSize: '19px' } }, seccion === 'proyectos' ? 'Todos tus proyectos' : 'Plantillas populares'),
          h('div', { class: 'kicker', style: { marginTop: '5px' } },
            seccion === 'proyectos' ? lista.length + (lista.length === 1 ? ' proyecto' : ' proyectos') : 'hoy las hace Cherry · mañana las publican los creadores')
        ),
        h('div', { class: 'in-tabs' },
          h('button', { class: seccion === 'plantillas' ? 'on' : '', onClick: () => C.setState({ inicioSeccion: 'plantillas' }) }, 'Plantillas'),
          h('button', { class: seccion === 'proyectos' ? 'on' : '', onClick: () => C.setState({ inicioSeccion: 'proyectos' }) }, 'Proyectos')
        )
      ),

      h('div', { 'data-scroll': 'inicio-rejilla' }, seccion === 'proyectos' ? rejillaProyectos(lista) : rejillaPlantillas(s)),

      activo && h('div', { class: 'in-abajo' },
        h('div', { class: 'in-abajo__mini' },
          h('div', { class: 'in-abajo__tapa' }, tapa(activo, '-mini')),
          h('div', { style: { minWidth: '0' } },
            h('b', { class: 'js-in-nombre' }, activo.title || 'Sin nombre'),
            h('span', { class: 'js-in-paso' }, activo.paso)
          )
        ),
        h('div', { class: 'in-abajo__centro' },
          h('div', { class: 'in-abajo__pasos' },
            h('span', null, '↺'), h('span', { onClick: () => girar(-1) }, '‹‹'),
            h('button', { class: 'in-abajo__play', onClick: () => A().abrirProyecto(activo.id) }, '▶'),
            h('span', { onClick: () => girar(1) }, '››'), h('span', null, '⇄')
          ),
          h('div', { class: 'in-abajo__linea' }, h('span', { class: 'pista' }, h('i', { style: { width: activo.avance + '%' } })))
        ),
        h('button', { class: 'in-seguir', onClick: () => A().abrirProyecto(activo.id) }, activo.avance >= 100 ? 'Abrir video' : 'Continuar edición')
      )
    );

    return h('div', { class: 'app app--inicio' },
      C.TopBar(),
      h('div', { class: 'in-pantalla' }, lateral, contenido)
    );
  };

  /* Al entrar (y al volver al inicio) se traen los proyectos con su estado */
  C.onApiReady.push(() => { if (C.actions && C.actions.cargarInicio) C.actions.cargarInicio(); });
})();

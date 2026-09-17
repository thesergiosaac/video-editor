/* inicio.js — la pantalla que se ve al entrar, antes del editor (17-sep-2026)
   Barra de iconos a la izquierda que se abre al pasar el mouse · hero en dos columnas
   (titular + banner a la izquierda, carrusel a la derecha) · tarjetas de plantillas y
   herramientas abajo. El carrusel se mueve cambiando clases en el DOM (sin redibujar la app). */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const A = () => C.actions;

  const RANURAS = 5;

  /* ── Menú de la izquierda ── */
  const MENU = [
    { id: 'inicio', ic: '◧', name: 'Inicio' },
    { id: 'proyectos', ic: '▤', name: 'Proyectos' },
    { id: 'plantillas', ic: '✦', name: 'Plantillas' },
    { id: 'clips', ic: '▣', name: 'Mis clips' },
    { id: 'marca', ic: '◍', name: 'Tu marca' },
    { id: 'publicar', ic: '↗', name: 'Publicar', pronto: true },
    { id: 'stats', ic: '◔', name: 'Estadísticas', pronto: true },
    { id: 'mensajes', ic: '✉', name: 'Mensajes', pronto: true },
  ];
  function irMenu(id) {
    if (id === 'inicio') return C.setState({ inicioSeccion: 'plantillas' });
    if (id === 'proyectos') return C.setState({ inicioSeccion: 'proyectos' });
    if (id === 'plantillas') return C.setState({ inicioSeccion: 'plantillas' });
    if (id === 'clips') return C.setState({ pantalla: 'editor', openCard: null });
    if (id === 'marca') return C.setState({ pantalla: 'editor', openCard: 'marca' });
  }

  /* Siempre 5 ranuras: los proyectos que haya y el resto vacías, repartidas a los dos lados */
  function ranuras(lista) {
    const faltan = Math.max(0, RANURAS - lista.length);
    const antes = Math.floor(faltan / 2);
    const out = [];
    for (let i = 0; i < antes; i++) out.push(null);
    lista.forEach((p) => out.push(p));
    while (out.length < RANURAS) out.push(null);
    return out;
  }
  const clase = (i, centro) => {
    const d = i - centro;
    if (d === 0) return 'centro';
    const lado = d < 0 ? 'i' : '';
    return Math.abs(d) === 1 ? 'd1 d1' + lado : 'd2 d2' + lado;
  };

  /* Tapa del proyecto: su propio video, la miniatura de un clip o un color.
     OJO: C.videoFijo/C.imgFija guardan UN elemento por clave y un nodo no puede estar en dos
     sitios a la vez: por eso cada sitio pide la tapa con un sufijo distinto. */
  function tapa(p, sufijo) {
    const clave = 'tapa-' + p.id + (sufijo || '');
    if (p.video) return C.videoFijo(clave, C.urlVideo(p.video) + '#t=1.2', { class: 'in-foto', muted: true, playsinline: true, preload: 'metadata' });
    if (p.miniatura) return C.imgFija(clave, p.miniatura, { class: 'in-foto', alt: '' });
    return h('div', { class: 'in-foto in-foto--vacia' }, h('span', null, (p.title || 'P').charAt(0).toUpperCase()));
  }

  /* Mover el carrusel sin redibujar: solo cambian las clases (así se ve la transición) */
  function colocar(centro) {
    document.querySelectorAll('.in-obra').forEach((el, i) => {
      el.className = 'in-obra' + (el.dataset.vacia ? ' vacia' : '') + ' ' + clase(i, centro);
    });
    const p = (C.state.inicioRanuras || [])[centro];
    const nom = document.querySelector('.js-in-nombre'), paso = document.querySelector('.js-in-paso'), barra = document.querySelector('.js-in-barra');
    if (!p || !nom) return;
    nom.textContent = p.title || 'Sin nombre';
    paso.textContent = p.estado + ' · ' + p.paso;
    if (barra) barra.style.width = p.avance + '%';
  }
  /* Las flechas saltan de proyecto en proyecto: las ranuras vacías no se centran */
  function girar(paso) {
    const arr = C.state.inicioRanuras || [];
    const reales = arr.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
    if (reales.length < 2) return;
    const actual = reales.indexOf(C.state.inicioCentro);
    const centro = reales[(actual + paso + reales.length) % reales.length];
    C.setState({ inicioCentro: centro }, { render: false });
    colocar(centro);
  }

  function obra(p, i, centro) {
    if (!p) {
      return h('button', { class: 'in-obra vacia ' + clase(i, centro), 'data-vacia': '1', title: 'Video nuevo', onClick: () => A().nuevoDesdeInicio() }, '+');
    }
    return h('div', {
      class: 'in-obra ' + clase(i, centro), title: p.title || '',
      onClick: () => {
        if (i === C.state.inicioCentro) return A().abrirProyecto(p.id);   // la del centro abre el proyecto
        C.setState({ inicioCentro: i }, { render: false });
        colocar(i);
      },
    },
      tapa(p),
      h('span', { class: 'in-sello', style: { background: p.color } }, p.estado),
      h('span', { class: 'in-nombre' }, p.title || 'Sin nombre'),
      h('span', { class: 'in-abrir' }, p.avance >= 100 ? 'Abrir video' : 'Continuar')
    );
  }

  /* Buscador: filtra en el momento, sin redibujar (así no se pierde el cursor) */
  function filtrar(texto) {
    const t = (texto || '').trim().toLowerCase();
    document.querySelectorAll('.js-in-filtra').forEach((el) => {
      el.style.display = !t || (el.getAttribute('data-nombre') || '').indexOf(t) >= 0 ? '' : 'none';
    });
  }

  /* ── Tarjetas de abajo ── */
  function tarjetasPlantillas(s) {
    const simple = C.subs.simpleVista(s);
    return C.subs.PLANTILLAS.concat([C.subs.SIMPLE]).map((p) =>
      h('button', {
        class: 'in-carta js-in-filtra', 'data-nombre': p.name.toLowerCase(), title: p.desc,
        onClick: () => C.setState({ subsPlantilla: p.id, pantalla: 'editor', openCard: 'texto', typographyPreview: true, previaEnfoque: null }),
      },
        h('div', { class: 'in-carta__foto' }, C.subs.marco(p.id, C.subs.MUESTRAS[0], simple)),
        h('div', { class: 'in-carta__pie' }, h('b', null, p.name), h('i', null, p.ref))
      )
    );
  }
  const HERRAMIENTAS = [
    { n: 'Tu marca', nota: 'color · letra', img: 'marca.png', ir: () => C.setState({ pantalla: 'editor', openCard: 'marca' }) },
    { n: 'Subtítulos', nota: 'plantillas y mezcla', img: 'texto.png', ir: () => C.setState({ pantalla: 'editor', openCard: 'texto', typographyPreview: true }) },
    { n: 'Edición', nota: 'ritmo y formato', img: 'edicion.png', ir: () => C.setState({ pantalla: 'editor', openCard: 'edicion' }) },
    { n: 'Sonido', nota: 'música y efectos', img: 'sonido.png', ir: () => C.setState({ pantalla: 'editor', openCard: 'audio' }) },
    { n: 'Publicar', nota: 'pronto', img: 'salida.png', ir: null },
    { n: 'Estadísticas', nota: 'pronto', img: 'movimiento.png', ir: null },
  ];
  function tarjetasHerramientas() {
    return HERRAMIENTAS.map((t) =>
      h('button', { class: 'in-carta js-in-filtra' + (t.ir ? '' : ' pronto'), 'data-nombre': t.n.toLowerCase(), disabled: !t.ir, onClick: t.ir || null },
        h('div', { class: 'in-carta__foto' }, C.imgFija('mod-' + t.img, 'assets/config/' + t.img, { class: 'in-foto', alt: '' })),
        h('div', { class: 'in-carta__pie' }, h('b', null, t.n), h('i', null, t.nota))
      )
    );
  }
  function tarjetasProyectos(lista) {
    if (!lista.length) return [h('div', { class: 'in-nada' }, 'Todavía no tienes proyectos.')];
    return lista.map((p) =>
      h('button', { class: 'in-carta js-in-filtra', 'data-nombre': (p.title || '').toLowerCase(), onClick: () => A().abrirProyecto(p.id) },
        h('div', { class: 'in-carta__foto' }, tapa(p, '-rejilla'), h('span', { class: 'in-sello in-sello--fijo', style: { background: p.color } }, p.estado)),
        h('div', { class: 'in-carta__pie' }, h('b', null, p.title || 'Sin nombre'), h('i', null, p.paso))
      )
    );
  }

  C.Inicio = function () {
    const s = C.state;
    const lista = s.inicioProyectos || [];
    const arr = ranuras(lista);
    s.inicioRanuras = arr;                                   // lo usan colocar() y girar()
    let centro = s.inicioCentro;
    if (centro == null || !arr[centro]) {
      centro = lista.length ? Math.max(0, arr.indexOf(lista.find((p) => p.id === C.session.projectId) || lista[0])) : Math.floor(RANURAS / 2);
    }
    s.inicioCentro = centro;
    const activo = arr[centro] || null;
    const seccion = ['plantillas', 'herramientas', 'proyectos'].indexOf(s.inicioSeccion) >= 0 ? s.inicioSeccion : 'plantillas';
    const creditos = (s.perfil && s.perfil.credits_remaining != null) ? s.perfil.credits_remaining : null;

    /* ── barra de iconos (se abre al pasar el mouse) ── */
    const barra = h('aside', { class: 'in-barra' },
      h('div', { class: 'in-barra__logo' }, C.cereza(), h('span', null, 'cherry')),
      h('nav', { class: 'in-barra__menu' },
        MENU.map((m) => h('button', {
          class: 'in-it' + (m.pronto ? ' pronto' : '')
            + ((m.id === 'inicio' && seccion === 'plantillas') || (m.id === 'proyectos' && seccion === 'proyectos') ? ' on' : ''),
          disabled: !!m.pronto, onClick: () => irMenu(m.id), title: m.name,
        }, h('span', { class: 'in-it__ic' }, m.ic), h('span', { class: 'in-it__txt' }, m.name), m.pronto && h('span', { class: 'in-it__tag' }, 'pronto')))
      ),
      h('div', { class: 'in-barra__pie' },
        h('span', { class: 'in-barra__cereza' }, C.cereza()),
        creditos != null && h('div', { class: 'in-it in-it--cred' }, h('span', { class: 'in-it__ic' }, '◆'), h('span', { class: 'in-it__txt' }, creditos + ' créditos')),
        h('button', { class: 'in-it', onClick: () => C.api.logout(), title: 'Cerrar sesión' },
          h('span', { class: 'in-it__ic' }, '⏻'), h('span', { class: 'in-it__txt' }, 'Cerrar sesión'))
      )
    );

    /* ── hero: izquierda titular + banner, derecha carrusel ── */
    const izquierda = h('div', { class: 'in-hero__izq' },
      h('h1', { class: 'in-titular' },
        h('span', null, 'Tus videos'),
        h('span', null, 'listos en'),
        h('span', null, '3 minutos')
      ),
      h('p', { class: 'in-bajada' }, 'Sube los clips de tu celular. Cherry corta los errores, pone los subtítulos y te los deja listos para publicar.'),
      h('div', { class: 'in-acciones' },
        h('button', { class: 'in-cta', onClick: () => A().nuevoDesdeInicio() }, '＋ Video nuevo'),
        h('button', { class: 'in-cta in-cta--claro', onClick: () => C.setState({ pantalla: 'editor', openCard: null }) }, '↑ Subir clips')
      ),
      h('div', { class: 'in-banner' },
        h('span', { class: 'in-banner__etq' }, 'Espacio de publicidad'),
        h('span', { class: 'in-banner__txt' }, 'Aquí va tu banner')
      )
    );

    /* Solo la frase y el carrusel: sin caja, sin cartela. La tarjeta del centro abre el proyecto. */
    const derecha = h('div', { class: 'in-hero__der' },
      h('div', { class: 'in-hero__cab' },
        h('h2', null, lista.length ? 'Sigue donde ibas ✦' : 'Tu primer video ✦'),
        lista.length > 1 && h('div', { class: 'in-flechas' },
          h('button', { onClick: () => girar(-1), title: 'Anterior' }, '‹'),
          h('button', { onClick: () => girar(1), title: 'Siguiente' }, '›'))
      ),
      h('div', { class: 'in-carrusel' },
        !s.inicioCargado
          ? h('div', { class: 'in-cargando' }, h('span', { class: 'spinner spinner--lg' }))
          : arr.map((p, i) => obra(p, i, centro))
      )
    );

    /* ── tarjetas de abajo ── */
    const cartas = seccion === 'herramientas' ? tarjetasHerramientas()
      : seccion === 'proyectos' ? tarjetasProyectos(lista)
        : tarjetasPlantillas(s);

    const abajo = h('section', { class: 'in-abajo' },
      h('div', { class: 'in-abajo__cab' },
        h('h2', null, seccion === 'herramientas' ? 'Herramientas ✦' : seccion === 'proyectos' ? 'Tus proyectos ✦' : 'Plantillas ✦'),
        h('div', { class: 'in-tabs' },
          h('button', { class: seccion === 'plantillas' ? 'on' : '', onClick: () => C.setState({ inicioSeccion: 'plantillas' }) }, 'Plantillas'),
          h('button', { class: seccion === 'herramientas' ? 'on' : '', onClick: () => C.setState({ inicioSeccion: 'herramientas' }) }, 'Herramientas'),
          h('button', { class: seccion === 'proyectos' ? 'on' : '', onClick: () => C.setState({ inicioSeccion: 'proyectos' }) }, 'Tus proyectos')
        ),
        h('input', { class: 'in-buscar', type: 'search', placeholder: '⌕ Buscar', onInput: (e) => filtrar(e.target.value) })
      ),
      h('div', { class: 'in-cartas', 'data-scroll': 'inicio-cartas' }, cartas)
    );

    return h('div', { class: 'app app--inicio' },
      barra,
      h('div', { class: 'in-cuerpo' },
        h('div', { class: 'in-hero' }, izquierda, derecha),
        abajo
      )
    );
  };

  /* Al entrar (y al volver al inicio) se traen los proyectos con su estado */
  C.onApiReady.push(() => { if (C.actions && C.actions.cargarInicio) C.actions.cargarInicio(); });
})();

/* inicio.js — la pantalla que se ve al entrar, antes del editor (17-sep-2026)
   Rejilla de tarjetas redondeadas sobre papel claro: tu marca y tus números a la izquierda,
   el panel rosado con el carrusel de proyectos en el centro, créditos y accesos a la derecha,
   y las plantillas abajo. El carrusel se mueve cambiando clases en el DOM (sin redibujar la app). */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const A = () => C.actions;

  const RANURAS = 5;

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
     OJO: C.videoFijo/C.imgFija guardan UN elemento por clave y un nodo no puede estar en dos sitios:
     por eso cada sitio pide la tapa con un sufijo distinto. */
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
    return h('div', { class: 'in-obra ' + clase(i, centro), onClick: () => { if (i !== C.state.inicioCentro) { C.setState({ inicioCentro: i }, { render: false }); colocar(i); } } },
      tapa(p),
      h('span', { class: 'in-sello', style: { background: p.color } }, p.estado),
      h('span', { class: 'in-nombre' }, p.title || 'Sin nombre')
    );
  }

  function pastilla(texto, alTocar, pronto) {
    return h('button', { class: 'in-pastilla' + (pronto ? ' pronto' : ''), disabled: !!pronto, onClick: alTocar || null }, texto);
  }

  /* Buscador: filtra en el momento, sin redibujar (así no se pierde el cursor) */
  function filtrar(texto) {
    const t = (texto || '').trim().toLowerCase();
    document.querySelectorAll('.js-in-filtra').forEach((el) => {
      el.style.display = !t || (el.getAttribute('data-nombre') || '').indexOf(t) >= 0 ? '' : 'none';
    });
  }

  function rejillaPlantillas(s) {
    const simple = C.subs.simpleVista(s);
    return h('div', { class: 'in-fila' },
      C.subs.PLANTILLAS.concat([C.subs.SIMPLE]).map((p) =>
        h('button', {
          class: 'in-plan js-in-filtra', 'data-nombre': p.name.toLowerCase(), title: p.desc,
          onClick: () => C.setState({ subsPlantilla: p.id, pantalla: 'editor', openCard: 'texto', typographyPreview: true, previaEnfoque: null }),
        },
          h('div', { class: 'in-plan__foto' }, C.subs.marco(p.id, C.subs.MUESTRAS[0], simple)),
          h('b', null, p.name),
          h('i', null, p.ref)
        )
      )
    );
  }

  function rejillaProyectos(lista) {
    if (!lista.length) return h('div', { class: 'in-nada' }, 'Todavía no tienes proyectos.');
    return h('div', { class: 'in-fila' },
      lista.map((p) =>
        h('button', { class: 'in-plan js-in-filtra', 'data-nombre': (p.title || '').toLowerCase(), onClick: () => A().abrirProyecto(p.id) },
          h('div', { class: 'in-plan__foto' }, tapa(p, '-rejilla'), h('span', { class: 'in-sello in-sello--fijo', style: { background: p.color } }, p.estado)),
          h('b', null, p.title || 'Sin nombre'),
          h('i', null, p.paso)
        )
      )
    );
  }

  function modulo(nombre, nota, imagen, alTocar) {
    return h('button', { class: 'in-modulo' + (alTocar ? '' : ' pronto'), disabled: !alTocar, onClick: alTocar || null },
      C.imgFija('mod-' + imagen, 'assets/config/' + imagen, { alt: '' }),
      h('span', { class: 'in-modulo__pie' }, h('b', null, nombre), h('span', null, nota))
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
    const seccion = s.inicioSeccion === 'proyectos' ? 'proyectos' : 'plantillas';
    const creditos = (s.perfil && s.perfil.credits_remaining != null) ? s.perfil.credits_remaining : null;
    const hechos = lista.filter((p) => p.avance >= 100).length;
    const clips = lista.reduce((n, p) => n + (p.clips || 0), 0);

    /* ── cinta de arriba ── */
    const cinta = h('header', { class: 'in-cinta' },
      h('div', { class: 'in-marca' }, C.cereza(), 'cherry', h('sup', null, '®'), h('em', null, 'very sweet')),
      h('div', { class: 'in-avisos' },
        h('span', { class: 'in-aviso in-mono' }, 'Plataforma de edición automática'),
        h('span', { class: 'in-aviso' }, h('b', null, lista.length + (lista.length === 1 ? ' PROYECTO' : ' PROYECTOS'))),
        creditos != null && h('span', { class: 'in-aviso' }, h('b', null, creditos + ' CRÉDITOS'))
      ),
      h('div', { class: 'in-cinta__der' },
        h('span', { class: 'in-paleta' }, ['#FF2D8A', '#FFC93C', '#2BD9C7', '#7B4BFF'].map((c) => h('i', { style: { background: c } }))),
        h('span', { class: 'in-mono in-cinta__nota' }, 'Tus colores'),
        h('button', { class: 'in-salir', onClick: () => C.api.logout() }, 'Salir'),
        h('span', { class: 'in-yo', title: (C.session.user && C.session.user.email) || '' },
          ((s.perfil && s.perfil.full_name) || (C.session.user && C.session.user.email) || 'C').charAt(0).toUpperCase())
      )
    );

    /* ── fila de atajos ── */
    const herramientas = h('div', { class: 'in-herramientas' },
      h('button', { class: 'in-redonda', title: 'Video nuevo', onClick: () => A().nuevoDesdeInicio() }, '＋'),
      h('span', { class: 'in-mono in-herramientas__etq' }, 'Atajos'),
      pastilla('↑ Subir clips', () => C.setState({ pantalla: 'editor', openCard: null })),
      pastilla('✎ Escribir guion', () => C.setState({ pantalla: 'editor', scriptOpen: true })),
      pastilla('▤ Mis proyectos', () => C.setState({ inicioSeccion: 'proyectos' })),
      pastilla('✦ Plantillas', () => C.setState({ inicioSeccion: 'plantillas' })),
      pastilla('◷ Programar', null, true),
      pastilla('◔ Estadísticas', null, true),
      h('input', { class: 'in-buscar', type: 'search', placeholder: '⌕ Buscar un proyecto o una plantilla', onInput: (e) => filtrar(e.target.value) })
    );

    /* ── columna izquierda ── */
    const izquierda = h('div', { class: 'in-izq' },
      h('button', { class: 'in-retrato', onClick: () => C.setState({ pantalla: 'editor', openCard: 'marca' }) },
        C.imgFija('mod-marca.png', 'assets/config/marca.png', { alt: '' }),
        h('span', { class: 'in-retrato__pie' }, h('b', null, 'Tu marca'), h('span', null, 'color · letra'))
      ),
      h('div', { class: 'in-datos' },
        h('div', { class: 'in-dato' }, h('span', null, 'Videos listos'), h('b', null, String(hechos))),
        h('div', { class: 'in-dato' }, h('span', null, 'Clips subidos'), h('b', null, String(clips))),
        h('div', { class: 'in-dato' }, h('span', null, 'Proyectos'), h('b', null, String(lista.length)))
      )
    );

    /* ── panel con el carrusel ── */
    const panel = h('section', { class: 'in-panel' },
      h('div', { class: 'in-panel__arriba' },
        h('div', null,
          h('span', { class: 'in-mono in-panel__etq' }, 'Sala de edición'),
          h('h1', { class: 'in-titular' }, lista.length ? 'Tus' : 'Tu primer', h('br'), h('i', null, lista.length ? 'videos' : 'video'))
        ),
        h('button', { class: 'in-nueva', onClick: () => A().nuevoDesdeInicio() }, '＋ Video nuevo')
      ),
      h('div', { class: 'in-carrusel' },
        !s.inicioCargado
          ? h('div', { class: 'in-cargando' }, h('span', { class: 'spinner spinner--lg' }))
          : arr.map((p, i) => obra(p, i, centro)),
        lista.length > 1 && h('div', { class: 'in-flechas' },
          h('button', { onClick: () => girar(-1), title: 'Anterior' }, '‹'),
          h('button', { onClick: () => girar(1), title: 'Siguiente' }, '›'))
      ),
      activo
        ? h('div', { class: 'in-cartela' },
            h('span', { class: 'in-cartela__nom' },
              h('b', { class: 'js-in-nombre' }, activo.title || 'Sin nombre'),
              h('span', { class: 'js-in-paso' }, activo.estado + ' · ' + activo.paso)),
            h('span', { class: 'in-cartela__barra' }, h('i', { class: 'js-in-barra', style: { width: activo.avance + '%' } })),
            h('button', { class: 'in-ir', onClick: () => A().abrirProyecto(activo.id) }, activo.avance >= 100 ? 'Abrir video' : 'Continuar')
          )
        : h('div', { class: 'in-cartela' },
            h('span', { class: 'in-cartela__nom' }, h('b', null, 'Sin videos todavía'), h('span', null, 'Sube tus clips y Cherry arma el primero')),
            h('button', { class: 'in-ir', onClick: () => A().nuevoDesdeInicio() }, '↑ Subir clips')
          )
    );

    /* ── columna derecha ── */
    const derecha = h('div', { class: 'in-der' },
      h('div', { class: 'in-creditos' },
        h('span', { class: 'in-creditos__aro' }),
        h('span', { class: 'in-mono' }, 'Tus créditos'),
        h('b', null, creditos != null ? String(creditos) : '—'),
        h('p', null, 'Plan ' + ((s.perfil && s.perfil.plan) || 'creador')),
        h('button', { onClick: () => C.setState({ pantalla: 'editor', openCard: null }) }, 'Ir al editor')
      ),
      modulo('Publicar', 'pronto', 'salida.png', null),
      modulo('Estadísticas', 'pronto', 'movimiento.png', null)
    );

    /* ── plantillas / proyectos ── */
    const plantillas = h('section', { class: 'in-plantillas' },
      h('div', { class: 'in-plantillas__cab' },
        h('div', null,
          h('h2', null, seccion === 'proyectos' ? 'Tus proyectos' : 'Plantillas'),
          h('div', { class: 'in-mono in-plantillas__nota' },
            seccion === 'proyectos' ? 'toca uno para seguir editándolo' : 'hoy las hace Cherry · mañana las publican los creadores')),
        h('div', { class: 'in-tabs' },
          h('button', { class: seccion === 'plantillas' ? 'on' : '', onClick: () => C.setState({ inicioSeccion: 'plantillas' }) }, 'Plantillas'),
          h('button', { class: seccion === 'proyectos' ? 'on' : '', onClick: () => C.setState({ inicioSeccion: 'proyectos' }) }, 'Tus proyectos')
        )
      ),
      h('div', { 'data-scroll': 'inicio-fila' }, seccion === 'proyectos' ? rejillaProyectos(lista) : rejillaPlantillas(s))
    );

    return h('div', { class: 'app app--inicio' },
      cinta,
      herramientas,
      h('div', { class: 'in-rejilla' }, izquierda, panel, derecha, plantillas)
    );
  };

  /* Al entrar (y al volver al inicio) se traen los proyectos con su estado */
  C.onApiReady.push(() => { if (C.actions && C.actions.cargarInicio) C.actions.cargarInicio(); });
})();

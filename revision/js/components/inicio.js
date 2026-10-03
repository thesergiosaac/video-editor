/* inicio.js — la pantalla que se ve al entrar, antes del editor (rediseño aprobado por Sergio el 18-sep-2026)
   Bento: Editor Pro (la grande) + «Tu cuenta» (js/components/inicio-cuenta.js) + la tarjeta que
   rota por las seis herramientas (js/components/inicio-gira.js): Guiones, Storyboard,
   Carruseles, Calendario de contenido, Identidad
   de marca (cada una es su página en herramientas/, con la misma sesión) + «Seguir editando» + cómo se conectan.
   El color es un DETALLE: tarjetas oscuras con volumen, estatuas en blanco y negro y solo lo rosado a color.
   Noche / Papel se recuerda en este navegador. «Mis proyectos» y el buscador muestran los proyectos de la MARCA
   ACTIVA (25-sep: todo va separado por marca); cada tarjeta se puede pasar a otra marca. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const A = () => C.actions;

  const IMG = (n) => 'assets/inicio/' + n + '.webp?v=20260918';
  const PALETA = ['#9f1b04', '#ffd23f', '#ff2d8a', '#f4ece7'];     // si aún no tiene «Mis colores»
  const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const CURVA = '<svg viewBox="0 0 260 104" preserveAspectRatio="none" aria-hidden="true">'
    + '<defs><linearGradient id="ciCurva" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#FF2D8A" stop-opacity=".42"/><stop offset="1" stop-color="#FF2D8A" stop-opacity="0"/>'
    + '</linearGradient></defs>'
    + '<path class="area" d="M0,10 L30,17 L52,60 L96,70 L156,77 L260,84 L260,96 L0,96 Z"/>'
    + '<path class="lin" d="M0,10 L30,17 L52,60 L96,70 L156,77 L260,84"/>'
    + '<path class="lin2" d="M0,12 L60,22 L130,38 L200,50 L260,58"/>'
    + '<circle class="mk" cx="52" cy="60" r="4.5"/></svg>';
  const ESTRELLA = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,2 58,30 86,14 70,42 98,50 70,58 86,86 58,70 50,98 42,70 14,86 30,58 2,50 30,42 14,14 42,30"/><text x="50" y="59" text-anchor="middle">IA</text></svg>';

  /* ── Cherry va siempre en noche ──
     Se quitó el interruptor y no se lee lo que hubiera guardado: quien tuviera «papel» se
     quedaría en papel para siempre, y ya no hay botón para salir. */
  function modo() {
    if (!C.state.inicioModo) {
      C.state.inicioModo = 'noche';
      document.documentElement.setAttribute('data-cherry-modo', 'noche');
    }
    return C.state.inicioModo;
  }

  /* Cómo te llamas: lo que escribiste en el menú de la foto. Si no hay nada, el nombre de la
     cuenta de Cherry. El correo NO: saludar por el correo no es saludar a nadie. */
  function comoTeLlamas() {
    const n = window.CherryCuenta && window.CherryCuenta.nombre();
    if (n) return n;
    /* El `full_name` de la cuenta puede venir con el correo dentro (al registrarse se rellenó con
       él). Un nombre con arroba no es un nombre: saludar con eso es no saludar a nadie. */
    const p = (C.state && C.state.perfil) || {};
    const f = String(p.full_name || '').trim();
    if (!f || f.indexOf('@') >= 0) return '';
    return f.split(/\s+/)[0];
  }

  /* ── Aviso corto abajo («llega muy pronto»): se muestra sin redibujar ── */
  let avisoT = 0;
  function aviso(texto) {
    const el = document.querySelector('.ci-aviso');
    if (!el) return;
    el.textContent = texto;
    el.classList.add('on');
    clearTimeout(avisoT);
    avisoT = setTimeout(() => el.classList.remove('on'), 2400);
  }
  const ir = (pagina) => () => { location.href = 'herramientas/' + pagina + '.html'; };

  /* ── Buscador y «Mis proyectos» ── */
  function volver() {
    C.state.inicioBuscar = '';
    C.setState({ inicioSeccion: 'herramientas', inicioMenu: false });
  }
  function coincide(p, q) { return !q || (p.title || '').toLowerCase().indexOf(q) >= 0; }
  function filtrar(texto) {
    const q = (texto || '').trim().toLowerCase();
    let n = 0;
    document.querySelectorAll('.js-ci-filtra').forEach((el) => {
      const ok = !q || (el.getAttribute('data-nombre') || '').indexOf(q) >= 0;
      el.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    const vacio = document.querySelector('.js-ci-vacio');
    if (vacio) vacio.hidden = !q || n > 0;
  }
  /* Escribir en el buscador lleva a «Mis proyectos»; ahí filtra sin redibujar (así no se pierde el cursor) */
  function buscar(e) {
    const v = e.target.value;
    C.state.inicioBuscar = v;
    if (v.trim() && C.state.inicioSeccion !== 'proyectos') {
      C.setState({ inicioSeccion: 'proyectos' });
      const inp = document.getElementById('ci-buscar');
      if (inp) { inp.focus(); inp.setSelectionRange(v.length, v.length); }
      return;
    }
    filtrar(v);
  }

  /* El menú de la cuenta se cierra al hacer clic fuera */
  document.addEventListener('mousedown', (e) => {
    if (C.state && C.state.inicioMenu && !e.target.closest('.ci-menu, .ci-avatar')) C.setState({ inicioMenu: false });
  });

  /* ── Piezas ── */
  function hace(fecha) {
    const d = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
    if (!isFinite(d)) return '';
    if (d < 1) return 'hoy';
    if (d < 2) return 'ayer';
    if (d < 30) return 'hace ' + d + ' días';
    if (d < 365) { const m = Math.floor(d / 30); return 'hace ' + m + (m === 1 ? ' mes' : ' meses'); }
    const a = Math.floor(d / 365); return 'hace ' + a + (a === 1 ? ' año' : ' años');
  }
  const claveEstado = (p) => ({ 'Listo': 'listo', 'Generando': 'generando', 'Con error': 'error' })[p.estado] || 'borrador';
  const estatua = (n, alt) => C.imgFija('ci-' + n, IMG(n), { class: 'ci-estatua', alt, draggable: 'false' });

  /* Tarjeta que se puede tocar entera (con teclado también) */
  function tarjeta(clase, etiqueta, alTocar, ...hijos) {
    return h('div', {
      class: 'ci-t ci-vol ' + clase, role: 'button', tabindex: '0', 'aria-label': etiqueta, onClick: alTocar,
      onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); alTocar(); } },
    }, h('span', { class: 'ci-flecha', 'aria-hidden': 'true' }, '→'), hijos);
  }
  const boton = (clase, texto, fn) => h('button', { type: 'button', class: 'ci-btn ' + clase, onClick: (e) => { e.stopPropagation(); fn(); } }, texto);

  /* Tapa de un proyecto: su propio video, la miniatura de un clip o su inicial.
     OJO: C.videoFijo/C.imgFija guardan UN elemento por clave: cada sitio pide la tapa con su propio sufijo. */
  function tapa(p, sufijo) {
    const clave = 'tapa-' + p.id + sufijo;
    if (p.video) return C.videoFijo(clave, C.urlVideo(p.video) + '#t=1.2', { class: 'ci-foto', muted: true, playsinline: true, preload: 'metadata' });
    if (p.miniatura) return C.imgFija(clave, p.miniatura, { class: 'ci-foto', alt: '' });
    return h('span', { class: 'ci-foto ci-foto--vacia' }, (p.title || 'P').charAt(0).toUpperCase());
  }

  /* Tres cuadros del último proyecto (miniaturas de sus clips) */
  function cuadros(p) {
    const fotos = (p && p.minis) || [];
    return h('div', { class: 'ci-cuadros', 'aria-hidden': 'true' }, [0, 1, 2].map((i) => fotos.length
      ? C.imgFija('ci-cuadro-' + p.id + '-' + i, fotos[i % fotos.length], { alt: '' })
      : h('span', { class: 'ci-cuadro-vacio' }, i === 1 && p ? (p.title || 'P').charAt(0).toUpperCase() : '')));
  }

  function semana() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return DIAS.map((d, i) => {
      const f = new Date(lunes); f.setDate(lunes.getDate() + i);
      return h('div', { class: 'ci-dia' + (f.getTime() === hoy.getTime() ? ' hoy' : '') }, h('small', null, d), h('b', null, f.getDate()));
    });
  }

  /* ── Las herramientas ── */
  function bento(s, lista) {
    const ultimo = lista.find((p) => p.id === C.session.projectId) || lista[0] || null;
    const abrirEditor = () => (ultimo ? A().abrirProyecto(ultimo.id) : A().nuevoDesdeInicio());
    const colores = ((C.misColores && C.misColores.lista()) || []).slice(0, 4);

    const editor = tarjeta('ci-editor', 'Abrir Editor Pro', abrirEditor,
      h('span', { class: 'ci-puntos', 'aria-hidden': 'true' }),
      h('div', { class: 'ci-texto' },
        h('span', { class: 'ci-etq' }, 'Herramienta · lista para usar'),
        h('h2', null, 'Editor ', h('span', { class: 'ci-caja' }, 'Pro', h('span', { class: 'ci-estrella', html: ESTRELLA }))),
        h('p', null, 'Sube tus clips y la IA hace el resto: corta lo que sobra, pone los subtítulos con tu estilo y le da color.'),
        h('div', { class: 'ci-chips' }, ['Cortes con IA', 'Subtítulos', 'Cherry Gold', 'Zona segura'].map((c) => h('span', { class: 'ci-chip' }, c)))
      ),
      estatua('editor', 'Busto clásico en blanco y negro con audífonos rosados y gafas, sosteniendo una claqueta'),
      h('div', { class: 'ci-acciones' },
        boton('ci-btn--claro', '＋ Nuevo video', () => A().nuevoDesdeInicio()),
        ultimo && boton('ci-btn--linea', 'Seguir editando', () => A().abrirProyecto(ultimo.id))
      )
    );

    /* OJO: guiones, story, carrusel, calendario, marca y lab YA NO van al bento — su contenido
       vive ahora dentro de la tarjeta que rota, más abajo. Se dejan porque son la versión suelta
       de cada una y volverán si el bento cambia. */
    const guiones = tarjeta('ci-guiones', 'Abrir Guiones', ir('guiones'),
      h('div', { class: 'ci-texto' },
        h('span', { class: 'ci-pronto' }, 'Nuevo'),
        h('h2', null, 'Guiones'),
        h('p', null, 'Escríbelos a mano o con ayuda de la IA, con tu tono y tus frases.')),
      estatua('guiones', 'Busto de Apolo con gafas de sol junto a un globo que dice subtitles on y las letras Aa en rosado'));

    const story = tarjeta('ci-story', 'Abrir Storyboard', ir('storyboard'),
      h('div', { class: 'ci-texto' },
        h('span', { class: 'ci-pronto' }, 'Nuevo'),
        h('h2', null, 'Storyboard'),
        h('p', null, 'Tu video escena por escena, para grabar sin adivinar.'),
        h('div', { class: 'ci-escenas', 'aria-hidden': 'true' }, ['1 gancho', '2 idea', '3 cierre'].map((e) => h('span', { class: 'ci-escena' }, e)))),
      estatua('storyboard', 'El Discóbolo en blanco y negro frente a una cámara en trípode'));

    const carrusel = tarjeta('ci-carrusel', 'Abrir Carruseles', ir('carruseles'),
      h('div', { class: 'ci-texto' },
        h('span', { class: 'ci-pronto' }, 'Nuevo'),
        h('h2', null, 'Carruseles'),
        h('p', null, 'Carruseles para Instagram, hechos solos desde tus guiones y videos.')),
      estatua('carruseles', 'Mano en blanco y negro sosteniendo un celular con una flecha rosada hacia arriba'));

    const calendario = tarjeta('ci-calendario', 'Abrir Calendario de contenido', ir('calendario'),
      h('span', { class: 'ci-pronto' }, 'Nuevo'),
      h('h2', null, 'Calendario de contenido'),
      h('div', { class: 'ci-semana', 'aria-hidden': 'true' }, semana()),
      h('span', { class: 'ci-proximo' }, h('i'), 'Organiza tu mes: tus videos y carruseles, el día y la hora que elijas.'));

    const marca = tarjeta('ci-marca', 'Abrir Identidad de marca', ir('marca'),
      h('div', { class: 'ci-texto' },
        h('span', { class: 'ci-pronto' }, 'Nuevo'),
        h('h2', null, 'Identidad de marca'),
        h('p', null, 'Tus colores, letras, logo, tono y frases, en un solo lugar.'),
        h('div', { class: 'ci-paleta', 'aria-hidden': 'true' },
          (colores.length ? colores : PALETA).map((c) => h('span', { style: { background: c } })), h('b', null, 'Aa'))),
      estatua('marca', 'El David en blanco y negro con salpicaduras rosadas y una bomba de chicle rosada, junto a una carta de colores'));

    /* El Laboratorio: la única que mira hacia atrás (qué retuvo y por qué), por eso va después de
       las de hacer y antes del mapa. En vez de estatua lleva una curva de retención: es el gráfico
       del que trata la herramienta. */
    const emb = ['la idea', 'el gancho', 'el guion', 'el formato', 'la edición'];
    const lab = tarjeta('ci-lab', 'Abrir Laboratorio', ir('laboratorio'),
      h('span', { class: 'ci-puntos', 'aria-hidden': 'true' }),
      h('div', { class: 'ci-texto' },
        h('span', { class: 'ci-pronto' }, 'Nuevo'),
        h('h2', null, 'Laboratorio'),
        h('p', null, 'Lo único que hace que un video funcione es la retención. Desmonta lo que retuvo, guárdalo y averigua qué falló cuando no.'),
        h('div', { class: 'ci-chips' }, emb.map((c) => h('span', { class: 'ci-chip' }, c)))),
      h('div', { class: 'ci-curva', 'aria-hidden': 'true', html: CURVA }));

    /* Seguir editando: su último proyecto (o el primero, si todavía no tiene) */
    let seguir;
    if (!s.inicioCargado) {
      seguir = h('section', { class: 'ci-t ci-vol ci-seguir', 'aria-label': 'Seguir editando' }, cuadros(null),
        h('div', { class: 'ci-seguir__txt' }, h('span', { class: 'ci-etq' }, 'Seguir editando'), h('span', { class: 'ci-meta' }, 'Cargando tu último proyecto…')));
    } else if (ultimo) {
      seguir = h('section', { class: 'ci-t ci-vol ci-seguir', 'aria-label': 'Seguir editando' }, cuadros(ultimo),
        h('div', { class: 'ci-seguir__txt' },
          h('span', { class: 'ci-etq' }, 'Seguir editando'),
          h('h3', null, ultimo.title || 'Sin nombre'),
          h('span', { class: 'ci-meta' }, [ultimo.clips + (ultimo.clips === 1 ? ' clip' : ' clips'), 'creado ' + hace(ultimo.created_at)].filter(Boolean).join(' · ')),
          h('span', { class: 'ci-estado ci-estado--' + claveEstado(ultimo) }, ultimo.paso),
          h('div', { class: 'ci-acciones' }, boton('ci-btn--claro', 'Abrir en Editor Pro →', () => A().abrirProyecto(ultimo.id)))));
    } else {
      seguir = h('section', { class: 'ci-t ci-vol ci-seguir', 'aria-label': 'Tu primer video' }, cuadros(null),
        h('div', { class: 'ci-seguir__txt' },
          h('span', { class: 'ci-etq' }, 'Tu primer video'),
          h('h3', null, 'Empieza aquí'),
          h('span', { class: 'ci-meta' }, 'Sube los clips de tu celular: la IA corta, pone subtítulos y le da color.'),
          h('div', { class: 'ci-acciones' }, boton('ci-btn--claro', '＋ Nuevo video', () => A().nuevoDesdeInicio()))));
    }

    const nodo = (t, vivo) => h('span', { class: 'ci-nodo' + (vivo ? ' vivo' : '') }, h('i'), t);
    const flecha = () => h('span', { class: 'ci-a', 'aria-hidden': 'true' }, '→');
    const mapa = h('section', { class: 'ci-t ci-vol ci-mapa', 'aria-label': 'Cómo se conectan las herramientas' },
      h('span', { class: 'ci-etq' }, 'Así trabajan juntas'),
      h('h3', null, 'De la idea al video publicado'),
      h('div', { class: 'ci-flujo' }, nodo('Guion'), flecha(), nodo('Storyboard'), flecha(), nodo('Editor Pro', true), flecha(), nodo('Calendario')),
      h('div', { class: 'ci-nota' }, nodo('Identidad de marca'), 'lleva tus colores, letras y frases a tus herramientas.'),
      h('div', { class: 'ci-nota' }, nodo('Carruseles'), 'nacen de tus guiones y de tus videos.'),
      h('div', { class: 'ci-nota' }, nodo('Laboratorio'), 'cierra el círculo: mide lo que publicaste y te dice qué grabar después.'),
      h('div', { class: 'ci-nota' }, nodo('Respuestas automáticas'), 'contestan solas los comentarios de lo que publicas.'));

    /* A la derecha: «Tu cuenta» arriba (el perfil de Instagram y lo que sabe Cherry) y debajo la
       tarjeta que va rotando por las seis herramientas. El Editor Pro no se toca: es la grande de
       la izquierda, y las seis dejan de ocupar una tarjeta cada una. */
    const gira = C.tarjetaGira([
      { nombre: 'Guiones', icono: 'guiones', etq: 'Nuevo', titulo: 'Guiones',
        texto: 'Escríbelos a mano o con ayuda de la IA, con tu tono y tus frases.',
        estatua: 'guiones', ancho: 41,
        alt: 'Busto de Apolo con gafas de sol junto a un globo que dice subtitles on',
        abrir: ir('guiones') },
      { nombre: 'Storyboard', icono: 'storyboard', etq: 'Nuevo', titulo: 'Storyboard',
        texto: 'Tu video escena por escena, para grabar sin adivinar.',
        estatua: 'storyboard', ancho: 46,
        alt: 'El Discóbolo en blanco y negro frente a una cámara en trípode',
        abrir: ir('storyboard') },
      { nombre: 'Carruseles', icono: 'carruseles', etq: 'Nuevo', titulo: 'Carruseles',
        texto: 'Carruseles para Instagram, hechos solos desde tus guiones y videos.',
        estatua: 'carruseles', ancho: 44,
        alt: 'Mano en blanco y negro sosteniendo un celular con una flecha rosada hacia arriba',
        abrir: ir('carruseles') },
      { nombre: 'Calendario de contenido', icono: 'calendario', etq: 'Nuevo', titulo: 'Calendario de contenido',
        texto: 'Organiza tu mes: tus videos y carruseles, el día y la hora que elijas.',
        adorno: () => h('div', { class: 'ci-semana' }, semana()),
        abrir: ir('calendario') },
      { nombre: 'Identidad de marca', icono: 'marca', etq: 'Nuevo', titulo: 'Identidad de marca',
        texto: 'Tus colores, letras, logo, tono y frases, en un solo lugar.',
        estatua: 'marca', ancho: 44,
        alt: 'El David en blanco y negro con salpicaduras rosadas y una bomba de chicle',
        abrir: ir('marca') },
      { nombre: 'Laboratorio', icono: 'lab', etq: 'Nuevo', titulo: 'Laboratorio',
        texto: 'Por qué retuvo lo que retuvo, y qué grabar después.',
        adorno: () => h('div', { class: 'ci-curva', html: CURVA }),
        abrir: ir('laboratorio') },
      { nombre: 'Respuestas automáticas', icono: 'respuestas', etq: 'Nuevo', titulo: 'Respuestas automáticas',
        texto: 'Alguien comenta una palabra y Cherry le contesta y le manda tu enlace por privado.',
        adorno: () => h('div', { class: 'ci-miniflujo', 'aria-hidden': 'true' },
          h('span', { class: 'ci-mf ci-mf--com' }, 'CEREZA'), h('i', null, '↓'),
          h('span', { class: 'ci-mf ci-mf--msj' }, '¡Hola! Toca aquí'), h('i', null, '↓'),
          h('span', { class: 'ci-mf ci-mf--btn' }, 'Abrir ↗')),
        abrir: ir('respuestas') },
    ]);
    return h('main', { class: 'ci-bento' }, editor, C.tarjetaCuenta(), gira, mapa, seguir);
  }

  /* (25-sep) «Otra marca»: el proyecto sale de esta marca y queda en la escogida */
  async function pasarDeMarca(e, p) {
    e.preventDefault(); e.stopPropagation();
    const CC = window.CherryCuenta;
    if (!CC || !CC.escogerMarca) return;
    const a = await CC.escogerMarca(p.title || 'Este proyecto');
    if (!a) return;
    try { await C.api.moverProyecto(p.id, a); } catch (err) { CC.aviso('No se pudo pasar: ' + err.message); return; }
    CC.aviso('«' + (p.title || 'El proyecto') + '» pasó a ' + CC.nombreDeMarca(a) + '.');
    const quedan = (C.state.inicioProyectos || []).filter((x) => x.id !== p.id);
    C.setState({ inicioProyectos: quedan });
    const lista = await C.api.getProjects().catch(() => null);
    if (Array.isArray(lista)) C.setState({ projects: lista }, { render: false });
    // si era el que estaba abierto en el editor, el editor pasa a otro de esta marca
    if (p.id === C.session.projectId) {
      if (Array.isArray(lista) && lista.length) await A().cambiarProyecto(lista[0].id);
      else await A().nuevoProyecto();
      C.setState({ pantalla: 'inicio' });
    }
  }

  /* ── Mis proyectos (también es donde busca el buscador) ── */
  function proyectos(s, lista) {
    const q = (s.inicioBuscar || '').trim().toLowerCase();
    const hay = lista.filter((p) => coincide(p, q)).length;
    const variasMarcas = !!(window.CherryCuenta && window.CherryCuenta.cuantasMarcas && window.CherryCuenta.cuantasMarcas() > 1);
    return h('section', { class: 'ci-proy' },
      h('div', { class: 'ci-proy__cab' },
        h('h2', null, 'Tus proyectos'),
        h('span', { class: 'ci-etq' }, s.inicioCargado ? lista.length + (lista.length === 1 ? ' proyecto' : ' proyectos') : ''),
        h('button', { type: 'button', class: 'ci-pastilla', onClick: volver }, '‹ Volver al inicio')),
      h('div', { class: 'ci-proy__rejilla' },
        h('button', { type: 'button', class: 'ci-proy__nuevo ci-vol', onClick: () => A().nuevoDesdeInicio() }, h('b', null, '＋'), 'Nuevo video'),
        !s.inicioCargado
          ? h('div', { class: 'ci-nada' }, h('span', { class: 'spinner' }), ' Cargando tus proyectos…')
          : lista.map((p) => h('div', {
            class: 'ci-proy__celda js-ci-filtra', 'data-nombre': (p.title || '').toLowerCase(),
            style: coincide(p, q) ? null : { display: 'none' },
          },
            h('button', { type: 'button', class: 'ci-proy__carta ci-vol', onClick: () => A().abrirProyecto(p.id) },
              h('div', { class: 'ci-proy__foto' }, tapa(p, '-ci')),
              h('div', { class: 'ci-proy__pie' },
                h('b', null, p.title || 'Sin nombre'),
                h('span', { class: 'ci-estado ci-estado--' + claveEstado(p) }, p.estado),
                h('i', null, p.paso))),
            variasMarcas && h('button', {
              type: 'button', class: 'ci-proy__mover', title: 'Pasar este proyecto a otra marca',
              'aria-label': 'Pasar «' + (p.title || 'este proyecto') + '» a otra marca', onClick: (e) => pasarDeMarca(e, p),
            }, h('span', { 'aria-hidden': 'true' }, '⇄'), 'Otra marca')))
      ),
      h('div', { class: 'ci-nada js-ci-vacio', hidden: !q || hay > 0 || !s.inicioCargado ? '' : null }, 'Ningún proyecto se llama así.')
    );
  }

  C.Inicio = function () {
    const s = C.state;
    const lista = s.inicioProyectos || [];
    const seccion = s.inicioSeccion === 'proyectos' ? 'proyectos' : 'herramientas';
    const perfil = s.perfil || {};
    const correo = (C.session.user && C.session.user.email) || '';
    const nombre = ((perfil.full_name || '').trim().split(/\s+/)[0] || '');
    const Nombre = nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : '';
    const creditos = perfil.credits_remaining != null ? perfil.credits_remaining : null;
    const m = modo();

    /* El menú de la foto es UNO SOLO para todo Cherry (js/cuenta.js): el mismo aquí y en las seis
       herramientas. El inicio solo le dice qué sabe hacer de más. */
    if (window.CherryCuenta) {
      /* Si el nombre llega o cambia después de pintar, hay que volver a pintar el saludo. */
      window.CherryCuenta.alCambiarNombre(() => C.render && C.render());
      window.CherryCuenta.opciones([
        { t: 'Mis proyectos', hacer: () => C.setState({ inicioSeccion: 'proyectos' }),
          icono: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="13" height="10.5" rx="2"/><path d="M2.5 7.5h13"/></svg>' },
        { t: 'Cerrar sesión', rojo: true, hacer: () => C.api.logout(),
          icono: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5.5V4a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 001-1v-1.5"/><path d="M7.5 9h8M13 6.5L15.5 9 13 11.5"/></svg>' },
      ]);
    }

    const barra = h('header', { class: 'ci-barra ci-vol' },
      h('button', { type: 'button', class: 'ci-logo', 'aria-label': 'Cherry, inicio', onClick: volver },
        C.cereza(), h('b', null, 'cherry'), h('i', null, 'very sweet')),
      h('span', { class: 'ci-etq ci-barra__lema' }, 'Estudio de contenido con IA'),
      h('button', { type: 'button', class: 'ci-pastilla' + (seccion === 'proyectos' ? ' on' : ''), onClick: () => (seccion === 'proyectos' ? volver() : C.setState({ inicioSeccion: 'proyectos' })) }, 'Mis proyectos'),
      h('label', { class: 'ci-pastilla ci-buscar', for: 'ci-buscar' },
        h('span', { 'aria-hidden': 'true' }, '⌕'),
        h('input', { id: 'ci-buscar', type: 'search', placeholder: 'Buscar proyectos', value: s.inicioBuscar || '', autocomplete: 'off', onInput: buscar })),
      creditos != null && h('span', { class: 'ci-pastilla ci-creditos' }, h('b', null, '◆'), ' ' + creditos + ' créditos'),
      h('div', { class: 'ci-cuenta' },
        h('button', { type: 'button', class: 'ci-avatar', 'data-avatar': '', title: correo, 'aria-label': 'Tu cuenta' },
          (Nombre || correo || 'C').charAt(0).toUpperCase()))
    );

    const cuerpo = seccion === 'proyectos'
      ? proyectos(s, lista)
      : C.frag(
        h('div', { class: 'ci-cabecera' },
          h('h1', null, comoTeLlamas() ? 'Hola, ' + comoTeLlamas() + '. ' : 'Hola. ',
            h('span', null, '¿Qué vamos a crear hoy?')),
          h('span', { class: 'ci-etq' }, '7 herramientas · todas listas')),
        bento(s, lista));

    return h('div', { class: 'ci', 'data-modo': m, 'data-scroll': 'inicio' },
      h('div', { class: 'ci-envoltura' }, barra, cuerpo),
      h('div', { class: 'ci-aviso', role: 'status', 'aria-live': 'polite' })
    );
  };

  /* Al entrar (y al volver al inicio) se traen los proyectos con su estado */
  C.onApiReady.push(() => { if (C.actions && C.actions.cargarInicio) C.actions.cargarInicio(); });
})();

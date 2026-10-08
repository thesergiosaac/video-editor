/* inicio.js — la pantalla que se ve al entrar, antes del editor
   (4-oct-2026, opción A «Escenario»): el Editor Pro como escenario ámbar + «Tu nivel» + las herramientas como cartas de
   color + «Tu cuenta» y «Tu video» (js/components/inicio-cuenta.js) + «Seguir editando» y cómo se conectan (pendientes de
   que Sergio decida qué va ahí). Cada herramienta es su página en herramientas/, con la misma sesión.
   Las estatuas siguen en blanco y negro con rosa: son el arte de Cherry.
   Noche / Papel se recuerda en este navegador. «Mis proyectos» y el buscador muestran los proyectos de la MARCA
   ACTIVA (25-sep: todo va separado por marca); cada tarjeta se puede pasar a otra marca. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const A = () => C.actions;

  const IMG = (n) => 'assets/inicio/' + n + '.webp?v=20260918';
  /* (6-oct) los personajes nuevos (Sergio: «todo nuevo»): una persona real a color o una estatua, con un objeto moderno
     de UN solo color. Grande para el Editor Pro y la vitrina; «-chica» para las cartas. */
  const V2 = (n, chica) => 'assets/inicio/v2/' + n + (chica ? '-chica' : '') + '.webp?v=20261006';
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
  const ESTRELLA_G = '<svg viewBox="0 0 200 200" aria-hidden="true"><polygon points="100,0 116,62 176,30 140,84 200,100 140,116 176,170 116,138 100,200 84,138 24,170 60,116 0,100 60,84 24,30 84,62"/></svg>';
  const ESTRELLA = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,2 58,30 86,14 70,42 98,50 70,58 86,86 58,70 50,98 42,70 14,86 30,58 2,50 30,42 14,14 42,30"/><text x="50" y="59" text-anchor="middle">IA</text></svg>';

  /* ── Cherry va siempre en noche ──
     Se quitó el interruptor y no se lee lo que hubiera guardado: quien tuviera «papel» se
     quedaría en papel para siempre, y ya no hay botón para salir. */
  function modo() {
    if (!C.state.inicioModo) {
      C.state.inicioModo = 'papel';   // (3-oct) el inicio va en papel; la entrada (.cl) sigue en noche
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
  /* (8-oct) el Calendario, cerrado por ahora para quien no es administrador: la puerta la tiene cuenta.js */
  const ir = (pagina, q) => () => {
    const ve = () => { location.href = 'herramientas/' + pagina + '.html' + (q || ''); };
    if (pagina === 'calendario' && window.CherryCuenta && window.CherryCuenta.puertaCalendario) window.CherryCuenta.puertaCalendario(ve);
    else ve();
  };

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
  const claveEstado = (p) => ({ 'Listo': 'listo', 'Generando': 'generando', 'Fabricando': 'generando', 'Con error': 'error' })[p.estado] || 'borrador';
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
  /* (6-oct, Sergio) El panel de PROMOCIONALES, arriba a la derecha (solo en pantalla ancha). Por ahora rota anuncios de
     las herramientas; aquí van las imágenes o videos que escoja Sergio: { etq, titulo, texto, img, pagina }. Un solo nodo
     para toda la vida de la página: C.render() reconstruye todo y un nodo nuevo reiniciaría la rotación. */
  const PROMOS = [
    { etq: 'Nuevo', titulo: 'Carruseles en un minuto', texto: 'Cherry los arma con tu marca.', img: 'carruseles', pagina: 'carruseles' },
    { etq: 'Nuevo', titulo: 'Tu video escena por escena', texto: 'El storyboard dibujado, para grabar sin adivinar.', img: 'storyboard', pagina: 'storyboard' },
    { etq: 'Nuevo', titulo: 'Guiones con tu tono', texto: 'Escríbelos a mano o con ayuda de la IA.', img: 'guiones', pagina: 'guiones' },
    { etq: 'Nuevo', titulo: 'Se publica solo', texto: 'Programa tu mes y Cherry sube tus videos a Instagram.', img: 'calendario', pagina: 'calendario' },
    { etq: 'Nuevo', titulo: 'Tu marca en todo', texto: 'Tus colores, letras y tono, en cada cosa que creas.', img: 'marca', pagina: 'marca' },
    { etq: 'Nuevo', titulo: 'Por qué funcionó', texto: 'Qué retuvo tu video y qué grabar después.', img: 'laboratorio', pagina: 'laboratorio' },
    { etq: 'Nuevo', titulo: 'Respuestas solas', texto: 'Comentan tu palabra y Cherry les manda tu enlace.', img: 'respuestas', pagina: 'respuestas' },
  ];
  let promoNodo = null, promoI = 0, promoQuieto = 0, promoPinta = null;
  /* (6-oct) al pasar el ratón por una carta, la vitrina muestra esa herramienta y se queda ahí 8 s */
  function promoVer(pagina) {
    const k = PROMOS.findIndex((x) => x.pagina === pagina);
    if (k < 0 || !promoPinta) return;
    promoQuieto = Date.now() + 8000;
    if (k !== promoI) { promoI = k; promoPinta(); }
  }
  function promo() {
    if (promoNodo) return promoNodo;
    const img = h('img', { class: 'ci-promo__img', alt: '', draggable: 'false' });
    const etq = h('span'), tit = h('b'), txt = h('small');
    const puntos = h('div', { class: 'cp-puntos', 'aria-hidden': 'true' }, PROMOS.map(() => h('i')));
    const pinta = () => {
      const p = PROMOS[promoI];
      img.src = V2(p.img); etq.textContent = p.etq; tit.textContent = p.titulo; txt.textContent = p.texto;
      Array.prototype.forEach.call(puntos.children, (x, k) => x.classList.toggle('si', k === promoI));
    };
    const abrir = () => ir(PROMOS[promoI].pagina)();
    promoNodo = h('section', {
      class: 'ci-promo', role: 'button', tabindex: '0', 'aria-label': 'Novedades de Cherry', onClick: abrir,
      onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); abrir(); } },
    }, img, h('div', { class: 'ci-promo__txt' }, etq, tit, txt), puntos);
    promoPinta = pinta;
    pinta();
    setInterval(() => {   // se detiene con el ratón encima, si el inicio no está a la vista o si una carta la pidió
      if (PROMOS.length < 2 || !document.body.contains(promoNodo) || promoNodo.matches(':hover') || Date.now() < promoQuieto) return;
      promoI = (promoI + 1) % PROMOS.length; pinta();
    }, 6000);
    return promoNodo;
  }

  /* (6-oct) El DATO VIVO de cada carta, con los documentos reales de la marca activa. Se pide como mucho una vez por
     minuto; cuando llega, se escribe directo en las cartas (y queda en C.datosCartas para el próximo dibujo).
     `vivo` = hay algo pendiente HOY (el punto verde late). Sin datos: la línea invita a empezar. */
  let datosPedidos = 0;
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  const HORA = (hhmm) => { const [h, mi] = String(hhmm || '').split(':').map(Number); if (isNaN(h)) return '';
    return ((h % 12) || 12) + (mi ? ':' + String(mi).padStart(2, '0') : '') + (h < 12 ? ' a. m.' : ' p. m.'); };
  function cuandoEs(fecha, hora) {
    const d = new Date(fecha + 'T00:00'), hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((d - hoy) / 864e5);
    const dia = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana'
      : d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace('.', '');
    return dia.charAt(0).toUpperCase() + dia.slice(1) + ', ' + HORA(hora);
  }
  function armarDatos(r) {
    const D = {}, d = r.docs || {};
    /* (6-oct) Guiones son los planes del Laboratorio («Por grabar»): lo que cuenta la carta es lo que hay por grabar */
    const planes = (d.laboratorio && Array.isArray(d.laboratorio.planes)) ? d.laboratorio.planes : [];
    const pg = planes.filter((x) => x && x.cuenta === r.marca && !x.grabado && !x.publicado).length;
    D.guiones = pg ? { texto: plural(pg, 'por grabar', 'por grabar') } : { texto: 'Escribe tu próximo guion' };
    const sb = (d.storyboard && Array.isArray(d.storyboard.proyectos)) ? d.storyboard.proyectos : [];
    const curso = sb.filter((p) => Array.isArray(p.escenas) && p.escenas.some((e) => !e.grabada)).length;
    D.storyboard = curso ? { texto: plural(curso, 'por grabar', 'por grabar') } : sb.length ? { texto: 'Todo grabado ✓' } : { texto: 'Dibuja tu próximo video' };
    const ca = (d.carruseles && Array.isArray(d.carruseles.lista)) ? d.carruseles.lista : [];
    const listos = ca.filter((c) => c && c.publicable && Array.isArray(c.publicable.medios) && c.publicable.medios.length).length;
    D.carruseles = listos ? { texto: plural(listos, 'listo', 'listos') } : ca.length ? { texto: plural(ca.length, 'carrusel', 'carruseles') } : { texto: 'Haz tu primer carrusel' };
    const ahora = new Date();
    const posts = (d.calendario && Array.isArray(d.calendario.posts)) ? d.calendario.posts : [];
    const prox = posts.filter((p) => p && p.estado === 'programado' && p.fecha && new Date(p.fecha + 'T' + (p.hora || '00:00')) > ahora)
      .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))[0];
    D.calendario = prox ? { texto: cuandoEs(prox.fecha, prox.hora), vivo: new Date(prox.fecha + 'T00:00').toDateString() === ahora.toDateString() }
      : { texto: 'Programa tu semana' };
    const mk = d.marca ? ((d.marca.porMarca && (d.marca.porMarca[r.marca] || d.marca.porMarca.principal)) || (d.marca.porMarca ? null : d.marca)) : null;
    const cols = mk && mk.colores ? ['principal', 'secundario', 'acento', 'fondo'].map((k) => mk.colores[k]).filter(Boolean) : [];
    D.marca = cols.length ? { texto: mk.letraTitulos || 'Tu marca', colores: cols } : { texto: 'Arma tu marca' };
    const vids = (d.laboratorio && Array.isArray(d.laboratorio.videos)) ? d.laboratorio.videos.filter((v) => v && (v.cuenta || r.marca) === r.marca) : [];
    const sinMedir = vids.filter((v) => v.visitas == null && v.retencion == null).length;
    const hechos = vids.filter((v) => v.desmontaje).length;
    D.laboratorio = sinMedir ? { texto: plural(sinMedir, 'por medir', 'por medir'), vivo: true }
      : hechos ? { texto: plural(hechos, 'analizado', 'analizados') } : vids.length ? { texto: plural(vids.length, 'video', 'videos') } : { texto: 'Analiza tu primer video' };
    D.respuestas = r.semana ? { texto: r.semana + ' esta semana', vivo: true }
      : r.flujos ? { texto: plural(r.flujos, 'respuesta lista', 'respuestas listas') } : { texto: 'Crea tu primera respuesta' };
    return D;
  }
  function pintarDato(p, x) {
    document.querySelectorAll('.ci-carta__dato[data-carta="' + p + '"]').forEach((n) => {
      n.textContent = ''; n.classList.toggle('vivo', !!x.vivo);
      if (x.vivo) n.appendChild(h('i'));
      if (x.colores) n.appendChild(h('span', { class: 'ci-carta__colores', 'aria-hidden': 'true' }, x.colores.map((c) => h('em', { style: { background: c } }))));
      n.appendChild(document.createTextNode(x.texto));
    });
  }
  function datosCartas() {
    if (Date.now() - datosPedidos < 60000 || !C.api || !C.api.datosInicio) return;
    datosPedidos = Date.now();
    C.api.datosInicio().then((r) => {
      if (!r) return;
      C.datosCartas = armarDatos(r);
      Object.keys(C.datosCartas).forEach((p) => pintarDato(p, C.datosCartas[p]));
    }).catch(() => { datosPedidos = 0; });
  }

  function bento(s, lista) {
    const ultimo = lista.find((p) => p.id === C.session.projectId) || lista[0] || null;
    const abrirEditor = () => (ultimo ? A().abrirProyecto(ultimo.id) : A().nuevoDesdeInicio());
    const colores = ((C.misColores && C.misColores.lista()) || []).slice(0, 4);

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

    /* (4-oct, Sergio escogió la opción A «Escenario», https://claude.ai/artifact/5Bs4CNGR61pqbntZG98bhV)
       Arriba el Editor Pro como escenario (fondo ámbar, la estatua se sale por arriba, una estrella rosa gira detrás) y al
       lado «Tu nivel». Debajo, las herramientas como cartas de color con su estatua asomándose. Luego «Tu cuenta» y «Tu
       video» (js/components/inicio-cuenta.js). La tarjeta que rotaba (inicio-gira.js) ya no va: sus herramientas son
       las cartas. */
    const escena = h('section', {
      class: 'ci-escenario', role: 'button', tabindex: '0', 'aria-label': 'Abrir Editor Pro', onClick: abrirEditor,
      onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); abrirEditor(); } },
    },
      h('span', { class: 'ci-etq ci-escenario__sobre' }, 'Herramienta principal · lista para usar'),
      h('div', { class: 'ci-escenario__panel' },
        h('span', { class: 'ci-escenario__estrella', html: ESTRELLA_G }),
        h('div', { class: 'ci-escenario__txt' },
          h('h2', null, 'Editor ', h('span', null, 'Pro')),
          h('p', null, 'Sube tus clips y la IA hace el resto: corta lo que sobra, pone los subtítulos con tu estilo y le da color.'),
          h('div', { class: 'ci-chips' }, ['Cortes con IA', 'Subtítulos', 'Cherry Gold', 'Zona segura'].map((c) => h('span', { class: 'ci-chip' }, c))),
          h('div', { class: 'ci-acciones' },
            boton('ci-btn--claro', '＋ Nuevo video', () => A().nuevoDesdeInicio()),
            ultimo && boton('ci-btn--blanco', ['Seguir editando', h('span', { class: 'ci-btn__proy' }, ' · ' + (ultimo.title || 'tu proyecto'))], () => A().abrirProyecto(ultimo.id))))),
      C.imgFija('ci-escena-editor-v2', V2('editor'), { class: 'ci-escenario__estatua', alt: 'Hombre de traje con un televisor rosado por cabeza', draggable: 'false' }));

    /* (6-oct, Sergio: «las tres juntas») cada carta: su personaje, el DATO VIVO de esa herramienta debajo del nombre, y
       al pasar el ratón la ficha con lo que hace, el botón «+» para crear de una (abre la herramienta con ?nuevo=1, que
       herramientas/cherry.js convierte en el clic de su botón de crear) y la carta inclinada en 3D. La vitrina de arriba
       pasa a esa herramienta. Los datos los trae datosCartas() (abajo) y se pintan cuando llegan. */
    const CARTAS = [
      { n: 'Guiones', c: 'lila', p: 'guiones', mas: 'Nuevo guion', d: 'Escríbelos a mano o con ayuda de la IA, con tu tono y tus frases.' },
      { n: 'Storyboard', c: 'ambar', p: 'storyboard', mas: 'Nuevo storyboard', d: 'Tu video escena por escena, para grabar sin adivinar.' },
      { n: 'Carruseles', c: 'rosa', p: 'carruseles', mas: 'Nuevo carrusel', d: 'Carruseles para Instagram, hechos solos desde tus guiones y videos.' },
      { n: 'Calendario', c: 'menta', p: 'calendario', mas: 'Programar', d: 'Organiza tu mes: tus videos y carruseles, el día y la hora que elijas.' },
      { n: 'Identidad de marca', corto: 'Identidad', c: 'tinta', p: 'marca', mas: 'Editar mi marca', d: 'Tus colores, letras, logo, tono y frases, en un solo lugar.' },
      { n: 'Laboratorio', c: 'crema', p: 'laboratorio', mas: 'Analizar un video', d: 'Por qué retuvo lo que retuvo, y qué grabar después.' },
      { n: 'Respuestas automáticas', corto: 'Respuestas', c: 'fucsia', p: 'respuestas', mas: 'Nueva respuesta', d: 'Alguien comenta una palabra y Cherry le contesta y le manda tu enlace por privado.' },
    ];
    const DATOS = C.datosCartas || {};
    const inclina = (e) => {
      const c = e.currentTarget, r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(2) + 'deg');
      c.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(2) + 'deg');
      c.style.setProperty('--lx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--ly', (y * 100).toFixed(1) + '%');
      c.style.setProperty('--px', ((x - 0.5) * 10).toFixed(1) + 'px');
    };
    const suelta = (e) => {
      const c = e.currentTarget;
      ['--rx', '--ry', '--px'].forEach((v) => c.style.removeProperty(v));
      const v = c.querySelector('video.ci-carta__vid'); if (v) { v.pause(); c.classList.remove('anima'); }
    };
    /* (6-oct, Sergio: «me gusta el astronauta animado, por ahora solo déjalo a él») el personaje que se mueve al pasar el
       ratón: un video VP9 con fondo transparente, que se pide la primera vez. Safari no muestra esa transparencia: ahí no
       se pone y se queda la imagen quieta. */
    const ANIMA = { guiones: 'assets/inicio/v2/guiones-anim.webm?v=20261006' };
    const conAnima = !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const anima = (c, p) => {
      const v = c.querySelector('video.ci-carta__vid'); if (!v) return;
      if (!v.getAttribute('src')) v.src = ANIMA[p];
      v.muted = true;
      const r = v.play(); if (r && r.then) r.then(() => c.classList.add('anima')).catch(() => {}); else c.classList.add('anima');
    };
    const carta = (x) => {
      const dato = DATOS[x.p];
      return h('div', {
        class: 'ci-carta ci-carta--' + x.c, role: 'button', tabindex: '0', 'aria-label': x.n + ': ' + x.d,
        onClick: ir(x.p), onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); ir(x.p)(); } },
        onMouseenter: (e) => { promoVer(x.p); anima(e.currentTarget, x.p); }, onMousemove: inclina, onMouseleave: suelta,
      },
        C.imgFija('ci-carta-v2-' + x.p, V2(x.p, true), { class: 'ci-carta__est', alt: '', draggable: 'false' }),
        ANIMA[x.p] && conAnima ? h('video', { class: 'ci-carta__est ci-carta__vid', loop: true, playsinline: true, preload: 'none', 'aria-hidden': 'true' }) : null,
        h('span', { class: 'ci-carta__nuevo' }, 'Nuevo'),
        h('span', { class: 'ci-carta__txt' },
          h('b', { 'data-largo': x.n }, h('span', { class: 'ci-carta__largo' }, x.n), h('span', { class: 'ci-carta__corto' }, x.corto || x.n)),
          h('small', { class: 'ci-carta__dato' + (dato && dato.vivo ? ' vivo' : ''), 'data-carta': x.p },
            dato && dato.vivo ? h('i') : null,
            dato && dato.colores ? h('span', { class: 'ci-carta__colores', 'aria-hidden': 'true' }, dato.colores.map((c) => h('em', { style: { background: c } }))) : null,
            dato ? dato.texto : '')),
        h('button', { type: 'button', class: 'ci-carta__mas', 'aria-label': x.mas, 'data-tip': x.mas,
          onClick: (e) => { e.stopPropagation(); ir(x.p, '?nuevo=1')(); } }, '+'),
        h('span', { class: 'ci-carta__ficha', 'aria-hidden': 'true' }, h('b', null, x.n), h('span', null, x.d)));
    };
    setTimeout(datosCartas, 0);
    const cartas = h('section', { class: 'ci-cartas', 'aria-label': 'Tus herramientas' },
      h('div', { class: 'ci-cartas__cab' }, h('h3', null, 'Tus herramientas'), h('span', { class: 'ci-etq' }, CARTAS.length + ' · todas listas')),
      h('div', { class: 'ci-cartas__fila' }, CARTAS.map(carta)));

    /* (5-oct, Sergio: «hagamos todas tus recomendaciones») si falló el cobro del mes, la franja arriba de todo hasta que se pague */
    const mp = s.miPlan || {};
    const fechaCorta = (iso) => { try { return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } };
    const cobro = (mp.estado === 'en_gracia' || mp.estado === 'en_mora') && h('div', { class: 'ci-cobro', role: 'alert' },
      h('span', { class: 'ci-cobro__ico', 'aria-hidden': 'true' }, '!'),
      h('div', { class: 'ci-cobro__txt' },
        h('b', null, mp.estado === 'en_gracia' ? 'No pudimos cobrarte el mes de ' + (mp.planNombre || 'tu plan') + '.'
          : 'Tu plan ' + (mp.planNombre || '') + ' está en pausa: no pudimos cobrarte el mes.'),
        h('span', null, mp.estado === 'en_gracia' ? 'Actualiza tu tarjeta' + (mp.gracia ? ' antes del ' + fechaCorta(mp.gracia) : '') + ' para no perder tu plan.'
          : 'Actualiza tu tarjeta y vuelve solo, con tus créditos.')),
      h('button', { type: 'button', class: 'ci-btn ci-btn--claro', onClick: () => window.CherryPagos && window.CherryPagos.abrirTarjeta() }, 'Actualizar mi tarjeta'));
    return h('main', { class: 'ci-bento' }, cobro, escena, promo(), C.tarjetaNivel(), cartas, C.tarjetaCuenta(), C.tarjetaVideo(), mapa, seguir);
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

  /* ── (6-oct, Sergio) «Tus proyectos»: a color siempre; al pasar el ratón el video se reproduce ahí mismo; y un menú «⋯»
     para cambiar el nombre y borrar el proyecto («hasta ahora no existe eso»). Las ventanas son de Cherry, nunca del
     navegador. ── */
  const NOMBRE_MAX = 60;
  function ventana(titulo, cuerpo, botones) {
    const v = h('div', { class: 'tk-velo ci-ventana' },
      h('div', { class: 'tk-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
        h('button', { type: 'button', class: 'tk-x', 'aria-label': 'Cerrar' }, '×'),
        h('h3', { class: 'ci-ventana__t' }, titulo), cuerpo,
        h('div', { class: 'ci-ventana__acc' }, botones)));
    const cerrar = () => { v.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    v.addEventListener('click', (e) => { if (e.target === v || e.target.closest('.tk-x') || e.target.closest('[data-cerrar]')) cerrar(); });
    document.body.appendChild(v);
    return { v, cerrar };
  }
  function cambiarNombre(p) {
    const campo = h('input', { class: 'ci-ventana__campo', type: 'text', value: p.title || '', maxlength: String(NOMBRE_MAX), 'aria-label': 'Nombre del proyecto' });
    const nota = h('p', { class: 'ci-ventana__nota' });
    const guardar = h('button', { type: 'button', class: 'ci-btn ci-btn--claro' }, 'Guardar');
    const w = ventana('Cambiar nombre', h('div', null, campo, nota), [h('button', { type: 'button', class: 'ci-btn ci-btn--linea', 'data-cerrar': '' }, 'Cancelar'), guardar]);
    const listo = async () => {
      const nuevo = campo.value.replace(/\s+/g, ' ').trim().slice(0, NOMBRE_MAX);
      if (!nuevo) { nota.textContent = 'Ponle un nombre.'; campo.focus(); return; }
      if (nuevo === p.title) { w.cerrar(); return; }
      guardar.disabled = true; guardar.textContent = 'Guardando…';
      try { await C.api.renombrarProyecto(p.id, nuevo); }
      catch (err) { guardar.disabled = false; guardar.textContent = 'Guardar'; nota.textContent = 'No se pudo guardar: ' + err.message; return; }
      const cambiar = (xs) => (xs || []).map((x) => (x.id === p.id ? Object.assign({}, x, { title: nuevo }) : x));
      w.cerrar();
      C.setState({ inicioProyectos: cambiar(C.state.inicioProyectos), projects: cambiar(C.state.projects) });
    };
    guardar.addEventListener('click', listo);
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); listo(); } });
    setTimeout(() => { campo.focus(); campo.select(); }, 0);
  }
  function borrarProyecto(p) {
    const nota = h('p', { class: 'ci-ventana__nota' });
    const borrar = h('button', { type: 'button', class: 'ci-btn ci-btn--peligro' }, 'Borrar');
    const w = ventana('¿Borrar «' + (p.title || 'este proyecto') + '»?',
      h('div', null, h('p', { class: 'ci-ventana__txt' }, 'Se borran sus clips, el guion y el video montado. No se puede deshacer.'), nota),
      [h('button', { type: 'button', class: 'ci-btn ci-btn--linea', 'data-cerrar': '' }, 'Cancelar'), borrar]);
    borrar.addEventListener('click', async () => {
      borrar.disabled = true; borrar.textContent = 'Borrando…';
      try { await C.api.borrarProyecto(p.id); }
      catch (err) { borrar.disabled = false; borrar.textContent = 'Borrar'; nota.textContent = 'No se pudo borrar: ' + err.message; return; }
      w.cerrar();
      const quitar = (xs) => (xs || []).filter((x) => x.id !== p.id);
      C.setState({ inicioProyectos: quitar(C.state.inicioProyectos), projects: quitar(C.state.projects) });
      if (p.id === C.session.projectId) {   // si era el que estaba abierto en el editor, el editor pasa a otro
        const lista = C.state.projects || [];
        if (lista.length) await A().cambiarProyecto(lista[0].id); else await A().nuevoProyecto();
        C.setState({ pantalla: 'inicio' });
      }
    });
  }
  function cerrarMenus() { document.querySelectorAll('.ci-proy__menu').forEach((m) => m.remove()); }
  function abrirMenu(e, p) {
    e.preventDefault(); e.stopPropagation();
    const celda = e.currentTarget.closest('.ci-proy__celda'), estaba = !!celda.querySelector('.ci-proy__menu');
    cerrarMenus(); if (estaba) return;
    celda.appendChild(h('div', { class: 'ci-proy__menu', role: 'menu' },
      h('button', { type: 'button', role: 'menuitem', onClick: (ev) => { ev.stopPropagation(); cerrarMenus(); cambiarNombre(p); } }, h('span', { 'aria-hidden': 'true' }, '✎'), 'Cambiar nombre'),
      h('button', { type: 'button', role: 'menuitem', class: 'peligro', onClick: (ev) => { ev.stopPropagation(); cerrarMenus(); borrarProyecto(p); } }, h('span', { 'aria-hidden': 'true' }, '✕'), 'Borrar proyecto')));
    setTimeout(() => document.addEventListener('click', cerrarMenus, { once: true }), 0);
  }
  /* el video del proyecto se reproduce (sin sonido) mientras el ratón está encima, y vuelve a su cuadro al salir */
  const videoDe = (e) => e.currentTarget.querySelector('.ci-proy__foto video');
  const reproducir = (e) => { const v = videoDe(e); if (!v) return; v.muted = true; const r = v.play(); if (r && r.catch) r.catch(() => {}); };
  const detener = (e) => { const v = videoDe(e); if (!v) return; v.pause(); try { v.currentTime = 1.2; } catch (_) {} };

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
            onMouseenter: reproducir, onMouseleave: detener,
          },
            h('button', { type: 'button', class: 'ci-proy__carta ci-vol', onClick: () => A().abrirProyecto(p.id) },
              h('div', { class: 'ci-proy__foto' }, tapa(p, '-ci'), h('span', { class: 'ci-proy__ver', 'aria-hidden': 'true' }, 'Abrir ›')),
              h('div', { class: 'ci-proy__pie' },
                h('b', null, p.title || 'Sin nombre'),
                h('span', { class: 'ci-estado ci-estado--' + claveEstado(p) }, p.estado),
                h('i', null, p.paso))),
            h('button', { type: 'button', class: 'ci-proy__mas', 'aria-label': 'Más opciones de «' + (p.title || 'este proyecto') + '»', 'aria-haspopup': 'menu',
              onClick: (e) => abrirMenu(e, p) }, '⋯'),
            variasMarcas && h('button', {
              type: 'button', class: 'ci-proy__mover', title: 'Pasar este proyecto a otra marca',
              'aria-label': 'Pasar «' + (p.title || 'este proyecto') + '» a otra marca', onClick: (e) => pasarDeMarca(e, p),
            }, h('span', { 'aria-hidden': 'true' }, '⇄'), 'Otra marca')))
      ),
      h('div', { class: 'ci-nada js-ci-vacio', hidden: !q || hay > 0 || !s.inicioCargado ? '' : null }, 'Ningún proyecto se llama así.')
    );
  }

  /* (4-oct, Sergio) La barra de la izquierda: TODAS las herramientas a la vista, «por si las personas no la pueden
     encontrar». Solo en pantalla ancha (en tableta y celular no cabe: ahí están la tarjeta que rota y el mapa).
     (6-oct, Sergio: «no deberías duplicarla») es UNA sola para todo Cherry: la lista, los íconos y el estilo viven en
     js/lado.js (CherryLado), que usan también las herramientas. Aquí solo se atiende, sin recargar la página, lo que es
     del inicio: Inicio, Mis proyectos y Editor Pro. Las herramientas son enlaces normales. */
  function barraLateral(s, lista, seccion) {
    if (!window.CherryLado) return null;
    const ultimo = lista.find((p) => p.id === C.session.projectId) || lista[0] || null;
    const tocar = (e) => {
      const a = e.target.closest('[data-lado]');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
      const k = a.getAttribute('data-lado');
      if (k === 'inicio') { e.preventDefault(); volver(); }
      else if (k === 'proyectos') { e.preventDefault(); C.setState({ inicioSeccion: 'proyectos' }); }
      else if (k === 'editor') { e.preventDefault(); if (ultimo) A().abrirProyecto(ultimo.id); else A().nuevoDesdeInicio(); }
    };
    return h('nav', { class: 'ck-lado ci-vol', 'aria-label': 'Herramientas de Cherry', onClick: tocar,
      html: window.CherryLado.html(seccion === 'proyectos' ? 'proyectos' : 'inicio') });
  }

  C.Inicio = function () {
    const s = C.state;
    const lista = s.inicioProyectos || [];
    const seccion = s.inicioSeccion === 'proyectos' ? 'proyectos' : 'herramientas';
    const perfil = s.perfil || {};
    const correo = (C.session.user && C.session.user.email) || '';
    const nombre = ((perfil.full_name || '').trim().split(/\s+/)[0] || '');
    const Nombre = nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : '';
    const miPlan = s.miPlan || null;   // (3-oct) lo trae js/pagos.js: el plan y los créditos de verdad
    const m = modo();

    /* El menú de la foto es UNO SOLO para todo Cherry (js/cuenta.js): el mismo aquí y en las seis
       herramientas. El inicio solo le dice qué sabe hacer de más. */
    if (window.CherryCuenta) {
      /* Si el nombre llega o cambia después de pintar, hay que volver a pintar el saludo. */
      window.CherryCuenta.alCambiarNombre(() => C.render && C.render());
      window.CherryCuenta.opciones([
        { t: 'Mis créditos', hacer: () => window.CherryPagos && window.CherryPagos.abrirCreditos(),
          icono: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5l2 4.2-2 8.8-2-8.8z"/><path d="M3 6.7h12"/></svg>' },
        { t: 'Mi plan', hacer: () => window.CherryPagos && window.CherryPagos.abrir(),
          icono: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L9 12.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>' },
        { t: 'Mis proyectos', hacer: () => C.setState({ inicioSeccion: 'proyectos' }),
          icono: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="13" height="10.5" rx="2"/><path d="M2.5 7.5h13"/></svg>' },
        { t: 'Cerrar sesión', rojo: true, hacer: () => C.api.logout(),
          icono: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5.5V4a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 001-1v-1.5"/><path d="M7.5 9h8M13 6.5L15.5 9 13 11.5"/></svg>' },
      ]);
    }

    const barra = h('header', { class: 'ci-barra ci-vol' },
      h('button', { type: 'button', class: 'ci-logo', 'aria-label': 'Cherry, inicio', onClick: volver },
        C.imgFija('logo-papel', 'assets/marca/cherry-lockup-papel.svg', { alt: 'Cherry very sweet', width: 130, height: 40 })),
      h('span', { class: 'ci-etq ci-barra__lema' }, 'Estudio de contenido con IA'),
      /* (4-oct, Sergio escogió la 1) en pantalla ancha el saludo va aquí, en la barra de arriba, en vez del lema: así las
         tarjetas arrancan a la misma altura que la barra de herramientas */
      h('span', { class: 'ci-barra__hola' }, comoTeLlamas() ? 'Hola, ' + comoTeLlamas() + '. ' : 'Hola. ', h('span', null, '¿Qué vamos a crear hoy?')),
      h('button', { type: 'button', class: 'ci-pastilla ci-barra__proy' + (seccion === 'proyectos' ? ' on' : ''), onClick: () => (seccion === 'proyectos' ? volver() : C.setState({ inicioSeccion: 'proyectos' })) }, 'Mis proyectos'),
      h('label', { class: 'ci-pastilla ci-buscar', for: 'ci-buscar' },
        h('span', { 'aria-hidden': 'true' }, '⌕'),
        h('input', { id: 'ci-buscar', type: 'search', placeholder: 'Buscar proyectos', value: s.inicioBuscar || '', autocomplete: 'off', onInput: buscar })),
      miPlan && h('button', { type: 'button', class: 'ci-pastilla ci-creditos ci-barra__plan', title: 'Tu plan',
        onClick: () => window.CherryPagos && window.CherryPagos.abrir() }, miPlan.nombre),
      miPlan && h('button', { type: 'button', class: 'ci-pastilla ci-creditos', title: 'Tus créditos',
        onClick: () => window.CherryPagos && window.CherryPagos.abrirCreditos() },
        h('b', null, '◆'), ' ' + miPlan.creditos + ' créditos'),
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
      /* (4-oct, Sergio) la barra de arriba de lado a lado; debajo, la de herramientas y el contenido */
      h('div', { class: 'ci-marco' }, barra, barraLateral(s, lista, seccion), h('div', { class: 'ci-envoltura', 'data-scroll': 'inicio-cuerpo' }, cuerpo)),
      h('div', { class: 'ci-aviso', role: 'status', 'aria-live': 'polite' })
    );
  };

  /* Al entrar (y al volver al inicio) se traen los proyectos con su estado */
  C.onApiReady.push(() => { if (C.actions && C.actions.cargarInicio) C.actions.cargarInicio(); });
})();

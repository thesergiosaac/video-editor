/* main.js — arranque + render principal (diseño "very sweet": 3 zonas sin scroll de página) */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const appEl = document.getElementById('app');

  function App() {
    /* Sin sesión no se muestra el editor */
    if (!C.auth.checked) return C.frag(C.LoginScreen.cargando());
    if (!C.session.user || !C.apiReady) return C.frag(C.LoginScreen());

    if (C.state.pantalla !== 'editor') return C.frag(C.Inicio());

    return C.frag(
      h('div', { class: 'app' },
        C.TopBar(),
        h('div', { class: 'zones' },
          h('div', { class: 'zone zone--player' }, C.Phone(), C.Player()),
          h('div', { class: 'zone' }, C.Media()),
          h('div', { class: 'zone' }, C.Config())
        )
      ),
      C.Overlays(),
      C.ResultEditor()
    );
  }

  C.render = function () {
    // Conservar el scroll de las zonas que se desplazan por dentro (clips, módulos, transcripción…)
    const scrolls = {};
    appEl.querySelectorAll('[data-scroll]').forEach((el) => { scrolls[el.getAttribute('data-scroll')] = el.scrollTop; });
    appEl.replaceChildren(App());
    appEl.querySelectorAll('[data-scroll]').forEach((el) => {
      const top = scrolls[el.getAttribute('data-scroll')];
      if (top) el.scrollTop = top;
    });
    ajustarTarjetas();
  };

  /* Las tarjetas de configuración tienen que caber TODAS sin scroll:
     si no caben en 3 columnas pasan a 4; si aún no caben, se esconde la descripción */
  // Se mide una sola vez por tamaño de ventana; en los demás redibujos se reutiliza (medir obliga a recalcular la página)
  let modoTarjetas = { clave: '', clases: [] };
  function ajustarTarjetas(forzar) {
    const g = appEl.querySelector('.cfg__grid');
    if (!g) return;
    const clave = window.innerWidth + 'x' + window.innerHeight + ':' + g.children.length;
    if (!forzar && modoTarjetas.clave === clave) {
      if (modoTarjetas.clases.length) g.classList.add(...modoTarjetas.clases);
      return;
    }
    const clases = [];
    g.classList.remove('cfg__grid--4', 'cfg__grid--mini');
    if (g.scrollHeight > g.clientHeight + 1) { g.classList.add('cfg__grid--4'); clases.push('cfg__grid--4'); }
    if (g.scrollHeight > g.clientHeight + 1) { g.classList.add('cfg__grid--mini'); clases.push('cfg__grid--mini'); }
    modoTarjetas = { clave, clases };
  }
  let ajustePendiente = null;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(ajustePendiente);
    ajustePendiente = requestAnimationFrame(() => ajustarTarjetas(true));
  });

  /* Clic fuera de los menús de la barra superior: cerrarlos */
  document.addEventListener('mousedown', (e) => {
    const s = C.state;
    if (!s || (!s.projOpen && !s.userOpen)) return;
    if (e.target.closest('.menu, .pill, .avatar')) return;
    C.actions.closeMenus();
  });

  /* Las herramientas (herramientas/*.html) usan esta misma sesión:
     ?volver=herramientas/<página>  → quien entró desde una herramienta vuelve a ella
     ?abrir=<proyecto>             → abre en el Editor Pro el proyecto que creó Guiones o Storyboard */
  C.onApiReady.push(() => {
    const q = new URLSearchParams(location.search);
    const volver = q.get('volver'), abrir = q.get('abrir');
    if (volver && /^herramientas\/[a-z]+\.html(\?[^#]*)?$/.test(volver)) { location.replace(volver); return; }
    if (abrir) {
      history.replaceState(null, '', location.pathname);
      if (abrir === C.session.projectId) {
        if (C.api && C.api.recordarProyecto) C.api.recordarProyecto(abrir);
        C.setState({ pantalla: 'editor' });
      }
    }
  });

  C.render();
})();

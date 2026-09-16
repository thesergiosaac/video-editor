/* main.js — arranque + render principal (diseño "night shift": 3 zonas sin scroll de página) */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const appEl = document.getElementById('app');

  function App() {
    /* Sin sesión no se muestra el editor */
    if (!C.auth.checked) return C.frag(C.LoginScreen.cargando());
    if (!C.session.user || !C.apiReady) return C.frag(C.LoginScreen());

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
  };

  /* Clic fuera de los menús de la barra superior: cerrarlos */
  document.addEventListener('mousedown', (e) => {
    const s = C.state;
    if (!s || (!s.projOpen && !s.userOpen)) return;
    if (e.target.closest('.menu, .pill, .avatar')) return;
    C.actions.closeMenus();
  });

  C.render();
})();

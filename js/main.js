/* main.js — arranque + render principal */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const appEl = document.getElementById('app');

  function App() {
    return C.frag(
      h('div', { class: 'app' },
        C.TopBar(),                          /* topbar ya incluye las tabs */
        h('div', { class: 'body' },
          C.Sidebar(),
          C.Preview(),
          C.Rail()
        )
      ),
      C.Overlays(),
      C.ResultEditor()
    );
  }

  C.render = function () {
    appEl.replaceChildren(App());
  };

  C.render();
})();

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
    const sb = appEl.querySelector('.sb');
    const scrollTop = sb ? sb.scrollTop : 0;
    appEl.replaceChildren(App());
    const newSb = appEl.querySelector('.sb');
    if (newSb && scrollTop > 0) newSb.scrollTop = scrollTop;
  };

  C.render();
})();

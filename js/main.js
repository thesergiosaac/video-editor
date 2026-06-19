/* ============================================================
   main.js — arranque + render principal.
   render() reconstruye la app desde el estado. Las cosas continuas
   (scrubber, sliders, textarea, barra de progreso) se actualizan en
   vivo sin pasar por render() para no perder foco ni cortar el arrastre.
   ============================================================ */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const appEl = document.getElementById('app');

  function App() {
    return C.frag(
      h('div', { class: 'app' },
        C.TopBar(),
        C.TabStrip(),
        h('div', { class: 'body' }, C.Sidebar(), C.Preview(), C.Rail())
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

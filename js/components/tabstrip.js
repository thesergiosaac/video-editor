/* tabstrip.js — barra de pestañas que cambia el sidebar */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  C.TabStrip = function () {
    return h('div', { class: 'tabs sb sb-dark' },
      C.data.tabs.map((t) => {
        const sel = C.state.tab === t.id;
        return h('button', { class: 'tab' + (sel ? ' tab--active' : ''), onClick: () => C.setState({ tab: t.id }) },
          h('span', { class: 'tab__num' }, t.num),
          h('span', { class: 'tab__name' }, t.name)
        );
      })
    );
  };
})();

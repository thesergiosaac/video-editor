/* topbar.js — barra superior con tabs integradas en el centro */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  C.TopBar = function () {
    return h('div', { class: 'topbar' },
      /* Izquierda: logo + proyecto */
      h('div', { class: 'topbar__l' },
        h('div', { class: 'brand' },
          h('div', { class: 'logo' }, h('div', { class: 'tri' })),
          h('div', { class: 'brand__name' }, 'CARRETE'),
          h('div', { class: 'badge' }, 'IA·v0.2')
        ),
        h('div', { class: 'divider' }),
        h('div', { class: 'project' },
          h('span', { class: 'dot' }),
          h('span', { class: 'project__name' }, 'Reel de verano — Marca X'),
          h('span', { class: 'muted-arrow' }, '▾')
        )
      ),

      /* Centro: pestañas */
      h('div', { class: 'tabs' },
        C.data.tabs.map((t) => {
          const sel = C.state.tab === t.id;
          return h('button', {
            class: 'tab' + (sel ? ' tab--active' : ''),
            onClick: () => C.setState({ tab: t.id })
          },
            h('span', { class: 'tab__num' }, t.num),
            h('span', { class: 'tab__name' }, t.name)
          );
        })
      ),

      /* Derecha: créditos + vista previa + avatar */
      h('div', { class: 'topbar__r' },
        h('div', { class: 'credits' }, h('span', { class: 'gem' }, '◆'), ' 240 créditos'),
        h('div', { class: 'divider divider--sm' }),
        h('button', { class: 'btn-ghost' }, 'Vista previa'),
        h('div', { class: 'avatar' }, 'M')
      )
    );
  };
})();

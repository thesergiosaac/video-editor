/* topbar.js — barra superior */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  C.TopBar = function () {
    return h('div', { class: 'topbar' },
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
      h('div', { class: 'topbar__r' },
        h('div', { class: 'credits' }, h('span', { class: 'gem' }, '◆'), ' 240 créditos'),
        h('div', { class: 'divider divider--sm' }),
        h('button', { class: 'btn-ghost' }, 'Vista previa'),
        h('div', { class: 'avatar' }, 'M')
      )
    );
  };
})();

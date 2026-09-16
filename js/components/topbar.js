/* topbar.js — logo + selector de proyecto + créditos + perfil (diseño "night shift") */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  function hace(fecha) {
    const d = (Date.now() - new Date(fecha).getTime()) / 86400000;
    if (!isFinite(d)) return '';
    if (d < 1) return 'hoy';
    if (d < 7) return Math.floor(d) + 'd';
    if (d < 30) return Math.floor(d / 7) + ' sem';
    if (d < 365) return Math.floor(d / 30) + ' mes';
    return Math.floor(d / 365) + ' año';
  }

  C.TopBar = function () {
    const s = C.state, D = C.data, A = C.actions;
    const proyectos = s.projects || [];
    const activo = proyectos.find((p) => p.id === C.session.projectId);
    const nombreProyecto = (activo && activo.title) || 'Proyecto';
    const correo = (C.session.user && C.session.user.email) || '';
    const perfil = s.perfil || {};
    const creditos = perfil.credits_remaining;

    const projMenu = s.projOpen && h('div', { class: 'glass--menu menu', style: { width: 'min(290px,80vw)' } },
      h('div', { class: 'menu-label' }, 'Tus proyectos'),
      proyectos.map((p) => {
        const sel = p.id === C.session.projectId;
        return h('div', { class: 'menu-row' + (sel ? ' menu-row--sel' : ''), onClick: () => A.cambiarProyecto(p.id) },
          h('span', { class: 'dot ' + (sel ? 'dot--on' : 'dot--off') }),
          h('span', { class: 'truncate', style: { flex: '1', fontWeight: '500' } }, p.title || 'Sin nombre'),
          h('span', { class: 'mono', style: { fontSize: '10px', color: 'rgba(247,233,224,.4)' } }, hace(p.created_at))
        );
      }),
      h('div', { style: { borderTop: '1px solid rgba(247,233,224,.12)', marginTop: '6px', paddingTop: '6px' } },
        h('div', { class: 'menu-row', style: { fontWeight: '700', color: 'var(--amber)' }, onClick: () => A.nuevoProyecto() },
          '＋ Nuevo proyecto')
      )
    );

    const userMenu = s.userOpen && h('div', { class: 'glass--menu menu', style: { width: 'min(250px,80vw)' } },
      h('div', { style: { padding: '10px 12px', borderBottom: '1px solid rgba(247,233,224,.12)', marginBottom: '6px' } },
        h('div', { class: 'truncate', style: { fontWeight: '700', fontSize: '13.5px' } }, perfil.full_name || correo),
        h('div', { class: 'mono truncate', style: { fontSize: '10.5px', color: 'var(--ink-45)' } },
          'plan ' + (perfil.plan || 'creador') + (creditos != null ? ' · ' + creditos + ' créditos' : ''))
      ),
      D.userMenu.map((m) =>
        h('div', {
          class: 'menu-row', onClick: () => A.menuUsuario(m.id),
          style: { color: m.id === 'salir' ? 'var(--magenta)' : 'var(--ink)', fontWeight: '500' },
        }, m.name)
      )
    );

    return h('div', { class: 'glass topbar' },
      h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: '0' } },
        h('div', { class: 'logo' }, 'carrete'),
        h('div', { class: 'logo-hand' }, 'night shift')
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
        h('div', { style: { position: 'relative' } },
          h('div', { class: 'pill' + (s.projOpen ? ' pill--open' : ''), style: { maxWidth: '250px' }, onClick: () => A.toggleProj() },
            h('span', { class: 'dot dot--on' }),
            h('span', { class: 'truncate', style: { fontSize: '13px', fontWeight: '600' } }, nombreProyecto),
            h('span', { style: { color: 'rgba(247,233,224,.5)', fontSize: '10px', flex: 'none' } }, '▾')
          ),
          projMenu
        ),
        creditos != null && h('div', { class: 'pill pill--credits' }, h('span', { style: { fontSize: '12px' } }, '◆'), ' ' + creditos + ' créditos'),
        h('div', { style: { position: 'relative' } },
          h('div', { class: 'avatar' + (s.userOpen ? ' avatar--open' : ''), title: correo, onClick: () => A.toggleUser() },
            (correo || 'M').charAt(0).toUpperCase()),
          userMenu
        )
      )
    );
  };
})();

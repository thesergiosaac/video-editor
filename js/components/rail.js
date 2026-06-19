/* rail.js — rail derecho: material, guión y caja Generar */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data;

  function genBox() {
    const s = C.state;
    if (s.phase === 'idle') {
      return C.frag(
        h('button', { class: 'gen-btn', onClick: () => C.actions.generate() }, '✦ GENERAR VIDEO'),
        h('div', { class: 'gen-meta' }, h('span', null, 'Tiempo est. ~40s'), h('span', { class: 'amber' }, '◆ 12 créditos'))
      );
    }
    if (s.phase === 'rendering') {
      return C.frag(
        h('div', { class: 'gen-render__head' },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen-render__title' }, 'Editando con IA…')
        ),
        h('div', { class: 'progress' }, h('div', { class: 'progress__fill', style: { width: s.renderProgress + '%' } })),
        h('div', { class: 'gen-render__meta' },
          h('span', null, C.util.renderStage(s.renderProgress)),
          h('span', null, Math.round(s.renderProgress) + '%')
        )
      );
    }
    // done
    return C.frag(
      h('div', { class: 'gen-done__head' },
        h('span', { class: 'check' }, '✓'),
        h('span', { class: 'gen-done__title' }, '¡Tu video está listo!')
      ),
      h('button', { class: 'editar-btn', onClick: () => C.setState({ resultEdit: true }) }, '✎ Editar resultado'),
      h('div', { class: 'done-actions' },
        h('button', { class: 'icon-btn', onClick: () => C.actions.resetRender() }, '↺'),
        h('button', { class: 'btn-cream' }, 'Descargar'),
        h('button', { class: 'btn-coral' }, 'Publicar →')
      )
    );
  }

  C.Rail = function () {
    const s = C.state;
    return h('div', { class: 'rail sb sb-dark' },
      h('div', { class: 'rail-head' },
        h('span', { class: 'rail-head__label' }, 'Tu material'),
        h('span', { class: 'rail-head__line' }),
        h('span', { class: 'rail-head__meta' }, '6 clips · 4:12')
      ),
      h('div', { class: 'clip-grid' },
        D.clipGrads.map((g, i) =>
          h('div', { class: 'clip' },
            h('div', { class: 'clip__bg', style: { background: g } }),
            h('div', { class: 'clip__scan' }),
            h('span', { class: 'clip__tag clip__n' }, String(i + 1).padStart(2, '0')),
            h('span', { class: 'clip__tag clip__dur' }, D.clipDurs[i])
          )
        )
      ),
      h('button', { class: 'upload-btn upload-btn--dark', style: { marginBottom: '24px' } }, '＋ Subir más clips'),

      h('div', { class: 'rail-head' },
        h('span', { class: 'rail-head__label' }, 'Guión'),
        h('span', { class: 'rail-head__line' }),
        h('span', { class: 'rail-head__edit', onClick: () => C.setState({ scriptOpen: true }) }, 'editar')
      ),
      h('div', { class: 'script-card' },
        h('div', { class: 'script-card__tab' }),
        h('div', { class: 'script-card__text', html: '"Hace un año <mark>no sabía editar</mark>. Hoy publico a diario sin tocar una sola pista. Te cuento cómo lo hago en 30 segundos…"' }),
        h('div', { class: 'script-card__meta' }, '142 palabras · ~24s a este ritmo')
      ),

      h('div', { class: 'spacer' }),
      h('div', { class: 'gen-box' }, genBox())
    );
  };
})();

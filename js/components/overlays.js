/* overlays.js — drawer de guión (con guardado real), librería SFX y banco visual (diseño "night shift") */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data, U = C.util;

  function modal(o) {
    return h('div', { class: 'modal-wrap' },
      h('div', { class: 'scrim', onClick: o.onClose }),
      h('div', { class: 'modal', style: { width: o.width } },
        h('div', { class: 'modal__head' },
          h('div', null,
            h('div', { class: 'modal__title' }, o.title),
            h('div', { class: 'modal__sub' }, o.subtitle)
          ),
          h('button', { class: 'btn-x', onClick: o.onClose }, '✕')
        ),
        o.cats && h('div', { class: 'modal__cats' }, o.cats),
        h('div', { class: 'modal__body', 'data-scroll': 'modal' }, o.body),
        o.footer && h('div', { class: 'modal__foot' }, o.footer)
      )
    );
  }

  /* ── Drawer de guión ── */
  function scriptDrawer() {
    const s = C.state;
    if (!s.scriptOpen) return null;
    const close = () => C.setState({ scriptOpen: false });
    const counter = h('span', { class: 'mono', style: { fontSize: '11px', color: 'rgba(247,233,224,.5)' } }, U.words(s.scriptText) + ' palabras');

    async function saveAndClose(e) {
      const btn = e.currentTarget;
      btn.textContent = 'Guardando…'; btn.disabled = true;
      try {
        await C.api.saveScript(C.state.scriptText);
        close();
      } catch (err) {
        console.error('[CARRETE] Error guardando guión:', err);
        btn.textContent = 'Error — reintentar'; btn.disabled = false;
      }
    }

    return h('div', { class: 'drawer-wrap' },
      h('div', { class: 'scrim', onClick: close }),
      h('div', { class: 'drawer' },
        h('div', { class: 'modal__head' },
          h('div', null,
            h('div', { class: 'modal__title', style: { fontSize: '26px' } }, 'tu guión'),
            h('div', { class: 'modal__sub' }, 'La IA narra y sincroniza el video con este texto.')
          ),
          h('button', { class: 'btn-x', onClick: close }, '✕')
        ),
        h('div', { style: { flex: '1', padding: '20px 24px', minHeight: '0', display: 'flex' } },
          h('textarea', {
            class: 'script', placeholder: 'Escribe o pega aquí tu guión…',
            onInput: (e) => { C.state.scriptText = e.target.value; counter.textContent = U.words(e.target.value) + ' palabras'; },
          }, s.scriptText)
        ),
        h('div', { class: 'row', style: { padding: '16px 24px', borderTop: '1px solid rgba(247,233,224,.12)' } },
          counter,
          h('button', { class: 'btn btn--magenta', style: { width: 'auto', padding: '13px 24px' }, onClick: saveAndClose }, 'Guardar guión')
        )
      )
    );
  }

  /* ── Librería de SFX ── */
  function sfxModal() {
    const s = C.state;
    if (!s.sfxOpen) return null;
    const items = (D.sfxNames[s.sfxCat] || []).map((name, i) => ({ name, dur: '0:0' + (1 + (i % 4)) }));
    return modal({
      width: 'min(720px,100%)', title: 'librería de sfx',
      subtitle: 'Elige por categoría o sube tus propios sonidos.',
      onClose: () => C.setState({ sfxOpen: false }),
      cats: D.sfxCats.map((c) => h('button', { class: 'chip' + (s.sfxCat === c.id ? ' chip--sel' : ''), onClick: () => C.setState({ sfxCat: c.id }) }, c.name)),
      body: items.map((it) =>
        h('div', { class: 'sfx-row' },
          h('button', { class: 'btn-round btn-round--sm' }, h('span', { class: 'tri tri--dark' })),
          h('div', { style: { flex: '1', minWidth: '100px', fontWeight: '600', fontSize: '13px' } }, it.name),
          h('span', { class: 'mono', style: { fontSize: '11px', color: 'rgba(247,233,224,.5)' } }, it.dur),
          h('button', { class: 'chip' }, 'Añadir')
        )
      ),
      footer: h('button', { class: 'btn btn--dashed' }, '＋ Subir sonido propio'),
    });
  }

  /* ── Banco visual ── */
  function visualsModal() {
    const s = C.state;
    if (!s.visualsOpen) return null;
    const tones = D.visTones[s.visualsCat];
    return modal({
      width: 'min(780px,100%)', title: 'banco visual',
      subtitle: 'Imágenes y clips de stock por categoría, o sube los tuyos.',
      onClose: () => C.setState({ visualsOpen: false }),
      cats: D.visCats.map((c) => h('button', { class: 'chip' + (s.visualsCat === c.id ? ' chip--sel' : ''), onClick: () => C.setState({ visualsCat: c.id }) }, c.name)),
      body: h('div', { class: 'vis-grid' },
        Array.from({ length: 12 }, (_, i) => h('div', { class: 'vis-cell' }, h('div', { class: 'clip__fill', style: { background: tones[i % 2] } })))
      ),
      footer: h('button', { class: 'btn btn--dashed' }, '＋ Subir elemento propio'),
    });
  }

  C.Overlays = function () {
    return C.frag(scriptDrawer(), sfxModal(), visualsModal());
  };
})();

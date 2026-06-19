/* overlays.js — drawer de guión (con guardado real), librería SFX y stock visual */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data;

  /* ── Drawer de guión ── */
  function scriptDrawer() {
    const s = C.state;
    if (!s.scriptOpen) return null;
    const close = () => C.setState({ scriptOpen: false });
    function words(t) { return t.trim().split(/\s+/).filter(Boolean).length; }
    const counter = h('span', { class: 'drawer-foot__count' }, words(s.scriptText) + ' palabras');

    async function saveAndClose() {
      const btn = document.querySelector('.save-script');
      if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }
      try {
        await C.api.saveScript(s.scriptText);
        close();
      } catch (e) {
        console.error('[CARRETE] Error guardando guión:', e);
        if (btn) { btn.textContent = 'Error — reintentar'; btn.disabled = false; }
      }
    }

    return h('div', { class: 'overlay overlay--right' },
      h('div', { class: 'backdrop', onClick: close }),
      h('div', { class: 'drawer' },
        h('div', { class: 'drawer-head' },
          h('div', null,
            h('div', { class: 'head-title' }, 'Tu guión'),
            h('div', { class: 'head-sub' }, 'La IA narra y sincroniza el video con este texto.')
          ),
          h('button', { class: 'x-btn', onClick: close }, '✕')
        ),
        h('div', { class: 'drawer-body' },
          h('textarea', {
            class: 'script-area',
            placeholder: 'Escribe o pega aquí tu guión…',
            onInput: (e) => {
              s.scriptText = e.target.value;
              counter.textContent = words(e.target.value) + ' palabras';
            },
          }, s.scriptText)
        ),
        h('div', { class: 'drawer-foot' },
          counter,
          h('button', { class: 'save-script', onClick: saveAndClose }, 'Guardar guión')
        )
      )
    );
  }

  /* ── Modal SFX ── */
  function sfxModal() {
    const s = C.state;
    if (!s.sfxOpen) return null;
    const close = () => C.setState({ sfxOpen: false });
    const items = (D.sfxNames[s.sfxCat] || []).map((name, i) => ({ name, dur: '0:0' + (1 + (i % 4)) }));
    const wave = [8, 16, 11, 14, 7];

    return h('div', { class: 'overlay' },
      h('div', { class: 'backdrop', onClick: close }),
      h('div', { class: 'modal modal--sfx' },
        h('div', { class: 'modal-head' },
          h('div', null,
            h('div', { class: 'head-title' }, 'Librería de SFX'),
            h('div', { class: 'head-sub' }, 'Elige por categoría o sube tus propios sonidos.')
          ),
          h('button', { class: 'x-btn', onClick: close }, '✕')
        ),
        h('div', { class: 'modal-cats' },
          D.sfxCats.map((c) => C.ui.chip(s.sfxCat === c.id, () => C.setState({ sfxCat: c.id }), c.name))
        ),
        h('div', { class: 'sfx-list sb sb-dark' },
          items.map((it) =>
            h('div', { class: 'sfx-item' },
              h('button', { class: 'sfx-play' }, h('span', { class: 'play-tri' })),
              h('div', { class: 'sfx-name' }, it.name),
              h('span', { class: 'waveform' }, wave.map((hh) => h('span', { style: { height: hh + 'px' } }))),
              h('span', { class: 'sfx-dur' }, it.dur),
              h('button', { class: 'sfx-add' }, 'Añadir')
            )
          )
        ),
        h('div', { class: 'modal-foot' },
          h('button', { class: 'upload-btn upload-btn--dark' }, '＋ Subir sonido propio')
        )
      )
    );
  }

  /* ── Modal elementos visuales ── */
  function visualsModal() {
    const s = C.state;
    if (!s.visualsOpen) return null;
    const close = () => C.setState({ visualsOpen: false });
    const base = D.visBase[s.visualsCat];

    return h('div', { class: 'overlay' },
      h('div', { class: 'backdrop', onClick: close }),
      h('div', { class: 'modal modal--vis' },
        h('div', { class: 'modal-head' },
          h('div', null,
            h('div', { class: 'head-title' }, 'Elementos visuales'),
            h('div', { class: 'head-sub' }, 'Imágenes y clips de stock, o sube los tuyos.')
          ),
          h('button', { class: 'x-btn', onClick: close }, '✕')
        ),
        h('div', { class: 'modal-cats' },
          D.visCats.map((c) => C.ui.chip(s.visualsCat === c.id, () => C.setState({ visualsCat: c.id }), c.name))
        ),
        h('div', { class: 'vis-grid sb sb-dark' },
          Array.from({ length: 12 }, (_, i) =>
            h('div', { class: 'vis-tile' },
              h('div', { class: 'vis-tile__bg', style: { background: 'linear-gradient(160deg,' + base[i % 3] + ',' + base[(i + 1) % 3] + ')' } }),
              h('div', { class: 'vis-tile__scan' })
            )
          )
        ),
        h('div', { class: 'modal-foot' },
          h('button', { class: 'upload-btn upload-btn--dark' }, '＋ Subir elemento propio')
        )
      )
    );
  }

  C.Overlays = function () {
    return C.frag(scriptDrawer(), sfxModal(), visualsModal());
  };
})();

/* rail.js — rail derecho con clips reales, guión y caja Generar */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data;

  /* ── Subida de clips ── */
  function triggerUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*';
    input.onchange = async () => {
      const files = Array.from(input.files);
      if (!files.length) return;
      C.setState({ uploadingClips: true });
      for (const file of files) {
        try {
          await C.api.uploadClip(file, pct => {
            C.setState({ uploadProgress: pct, uploadingFile: file.name }, { render: false });
            document.querySelectorAll('.js-upload-pct').forEach(el => el.textContent = pct + '%');
          });
        } catch (e) {
          console.error('[CARRETE] Error subiendo clip:', e);
        }
      }
      C.setState({ uploadingClips: false, uploadProgress: 0, uploadingFile: '' });
      await loadClips(); // refrescar lista
    };
    input.click();
  }

  /* ── Cargar clips desde Supabase ── */
  async function loadClips() {
    if (!C.apiReady) return;
    const clips = await C.api.getClips();
    C.setState({ clips: clips || [] });
  }

  /* ── Cargar guión desde Supabase ── */
  async function loadScript() {
    if (!C.apiReady) return;
    const text = await C.api.getScript();
    if (text) C.setState({ scriptText: text }, { render: false });
  }

  /* ── Llamar a load cuando la API esté lista ── */
  if (C.apiReady) {
    loadClips();
    loadScript();
  } else {
    C.onApiReady.push(() => { loadClips(); loadScript(); });
  }

  /* ── Miniaturas de clips ── */
  function clipGrid() {
    const clips = C.state.clips || [];
    if (!clips.length) {
      /* Placeholder mientras no hay clips */
      return h('div', { class: 'clip-grid clip-grid--empty' },
        h('div', { class: 'clip-empty' },
          h('div', { class: 'clip-empty__icon' }, '▶'),
          h('div', { class: 'clip-empty__text' }, 'Sube tus clips para empezar')
        )
      );
    }
    return h('div', { class: 'clip-grid' },
      clips.map((clip, i) =>
        h('div', { class: 'clip' },
          h('div', { class: 'clip__bg', style: { background: D.clipGrads[i % D.clipGrads.length] } }),
          h('div', { class: 'clip__scan' }),
          h('span', { class: 'clip__tag clip__n' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'clip__tag clip__dur' },
            clip.file_name.length > 12
              ? clip.file_name.substring(0, 10) + '…'
              : clip.file_name
          )
        )
      )
    );
  }

  /* ── Caja Generar ── */
  function genBox() {
    const s = C.state;

    if (s.uploadingClips) {
      return C.frag(
        h('div', { class: 'gen-render__head' },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen-render__title' }, 'Subiendo ' + (s.uploadingFile || 'clips') + '…')
        ),
        h('div', { class: 'progress' },
          h('div', { class: 'progress__fill js-upload-pct-bar', style: { width: (s.uploadProgress || 0) + '%' } })
        ),
        h('div', { class: 'gen-render__meta' },
          h('span', { class: 'js-upload-pct' }, (s.uploadProgress || 0) + '%')
        )
      );
    }

    if (s.phase === 'idle') {
      const clips = s.clips || [];
      const hasClips = clips.length > 0;
      return C.frag(
        h('button', {
          class: 'gen-btn' + (hasClips ? '' : ' gen-btn--disabled'),
          onClick: hasClips ? () => C.actions.generate() : null,
          title: hasClips ? '' : 'Sube al menos un clip primero'
        }, '✦ GENERAR VIDEO'),
        h('div', { class: 'gen-meta' },
          h('span', null, 'Tiempo est. ~40s'),
          h('span', { class: 'amber' }, '◆ 12 créditos')
        )
      );
    }

    if (s.phase === 'rendering') {
      return C.frag(
        h('div', { class: 'gen-render__head' },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen-render__title' }, 'Editando con IA…')
        ),
        h('div', { class: 'progress' },
          h('div', { class: 'progress__fill', style: { width: s.renderProgress + '%' } })
        ),
        h('div', { class: 'gen-render__meta' },
          h('span', null, C.util.renderStage(s.renderProgress)),
          h('span', null, Math.round(s.renderProgress) + '%')
        )
      );
    }

    /* done */
    return C.frag(
      h('div', { class: 'gen-done__head' },
        h('span', { class: 'check' }, '✓'),
        h('span', { class: 'gen-done__title' }, '¡Tu video está listo!')
      ),
      h('button', { class: 'editar-btn', onClick: () => C.setState({ resultEdit: true }) }, '✎ Editar resultado'),
      h('div', { class: 'done-actions' },
        h('button', { class: 'icon-btn', onClick: () => C.actions.resetRender() }, '↺'),
        h('button', {
          class: 'btn-cream',
          onClick: () => {
            if (C.state.renderUrl) window.open(C.state.renderUrl, '_blank');
          }
        }, 'Descargar'),
        h('button', { class: 'btn-coral' }, 'Publicar →')
      )
    );
  }

  C.Rail = function () {
    const s = C.state;
    const clips = s.clips || [];
    const meta = clips.length
      ? clips.length + ' clip' + (clips.length > 1 ? 's' : '') + ' subido' + (clips.length > 1 ? 's' : '')
      : 'Sin clips aún';

    return h('div', { class: 'rail sb sb-dark' },
      h('div', { class: 'rail-head' },
        h('span', { class: 'rail-head__label' }, 'Tu material'),
        h('span', { class: 'rail-head__line' }),
        h('span', { class: 'rail-head__meta' }, meta)
      ),
      clipGrid(),
      h('button', {
        class: 'upload-btn upload-btn--dark',
        style: { marginBottom: '24px' },
        onClick: triggerUpload
      }, '＋ Subir clips'),

      h('div', { class: 'rail-head' },
        h('span', { class: 'rail-head__label' }, 'Guión'),
        h('span', { class: 'rail-head__line' }),
        h('span', { class: 'rail-head__edit', onClick: () => C.setState({ scriptOpen: true }) }, 'editar')
      ),
      h('div', { class: 'script-card' },
        h('div', { class: 'script-card__tab' }),
        h('div', { class: 'script-card__text' },
          s.scriptText
            ? '"' + s.scriptText.substring(0, 120) + (s.scriptText.length > 120 ? '…' : '') + '"'
            : 'Sin guión todavía. Haz clic en editar para escribir uno.'
        ),
        s.scriptText && h('div', { class: 'script-card__meta' },
          s.scriptText.trim().split(/\s+/).filter(Boolean).length + ' palabras'
        )
      ),

      h('div', { class: 'spacer' }),
      h('div', { class: 'gen-box' }, genBox())
    );
  };

  /* Exponer para que overlays.js pueda refrescar después de guardar guión */
  C.loadClips  = loadClips;
  C.loadScript = loadScript;

})();

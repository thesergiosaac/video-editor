/* ============================================================
   sidebar.js — panel de opciones izquierdo + helpers UI reutilizables.
   Define C.ui.* (usados también por preview/result) y los 6 paneles.
   ============================================================ */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data;

  /* ---------------- Primitivas UI reutilizables ---------------- */
  const ui = (C.ui = {
    sectionHead(num, label) {
      return h('div', { class: 'section-head' },
        h('span', { class: 'section-head__num' }, num),
        h('span', { class: 'section-head__label' }, label),
        h('span', { class: 'section-head__line' })
      );
    },
    toggle(on, onClick, dark) {
      return h('button',
        { class: 'toggle' + (dark ? ' toggle--dark' : '') + (on ? ' toggle--on' : ''), onClick },
        h('span', { class: 'toggle__knob' })
      );
    },
    segmented(opts, val, onChange) {
      return h('div', { class: 'segmented' },
        opts.map((o) =>
          h('button', { class: 'seg' + (val === o.id ? ' seg--sel' : ''), onClick: () => onChange(o.id) }, o.name)
        )
      );
    },
    chip(active, onClick, text, extra) {
      return h('button', { class: 'chip' + (active ? ' chip--sel' : '') + (extra ? ' ' + extra : ''), onClick }, text);
    },
    select(val, opts, onChange, dense) {
      return h('div', { class: 'select-wrap' },
        h('select',
          { class: 'select' + (dense ? ' select--dense' : ''), onChange: (e) => onChange(e.target.value) },
          opts.map((o) => h('option', { value: o.id, selected: o.id === val ? 'selected' : null }, o.name))
        ),
        h('span', { class: 'select__chev' }, '▾')
      );
    },
    swatch(color, sel, onClick) {
      return h('button', { class: 'swatch' + (sel ? ' swatch--sel' : ''), style: { background: color }, onClick });
    },
    // slider con badge "en vivo": el badge se actualiza sin re-render mientras arrastras
    slider(value, onInput, leftLabel, rightLabel, badgeFn) {
      const badge = h('span', { class: 'slider__badge' }, badgeFn(value));
      const input = h('input', {
        type: 'range', min: 0, max: 100, value,
        onInput: (e) => { const v = Number(e.target.value); badge.textContent = badgeFn(v); onInput(v); },
      });
      return h('div', null,
        input,
        h('div', { class: 'slider-labels', style: { marginTop: '9px' } },
          h('span', { class: 'slider__label' }, leftLabel),
          badge,
          h('span', { class: 'slider__label' }, rightLabel)
        )
      );
    },
  });

  /* ---------------- Paneles ---------------- */

  function panelEdicion() {
    const s = C.state;
    return C.frag(
      ui.sectionHead('01', 'Estilo visual'),
      h('div', { class: 'preset-grid mb-30' },
        D.presets.map((p) => {
          const sel = s.style === p.id;
          return h('div', { class: 'preset' + (sel ? ' preset--sel' : ''), onClick: () => C.setState({ style: p.id }) },
            h('div', { class: 'preset__swatch', style: { background: p.g } }),
            h('div', { class: 'preset__name' }, p.name),
            h('div', { class: 'preset__desc' }, p.desc),
            sel && h('div', { class: 'preset__check' }, '✓')
          );
        })
      ),

      ui.sectionHead('02', 'Formato'),
      h('div', { class: 'format mb-30' },
        D.aspects.map((a) => {
          const sel = s.aspect === a.id;
          return h('button', { class: 'fmt' + (sel ? ' fmt--sel' : ''), onClick: () => C.setState({ aspect: a.id }) },
            h('span', { class: 'fmt__icon', style: { width: a.w + 'px', height: a.h + 'px' } }),
            h('span', { class: 'fmt__ratio' }, a.ratio),
            h('span', { class: 'fmt__label' }, a.label)
          );
        })
      ),

      ui.sectionHead('03', 'Subtítulos'),
      h('div', { class: 'row-card' },
        h('div', null,
          h('div', { class: 'row-card__title' }, 'Subtítulos automáticos'),
          h('div', { class: 'row-card__desc' }, 'Transcritos del audio de tus clips')
        ),
        ui.toggle(s.captions, () => C.toggle('captions'))
      ),
      s.captions && h('div', { class: 'chips' },
        D.captionStyles.map((c) => ui.chip(s.captionStyle === c.id, () => C.setState({ captionStyle: c.id }), c.name))
      ),
      s.captions && h('div', { class: 'row-card', style: { marginTop: '10px' } },
        h('div', null,
          h('div', { class: 'row-card__title' }, 'Posición'),
          h('div', { class: 'row-card__desc' }, 'Dónde aparecen los subtítulos')
        )
      ),
      s.captions && h('div', { class: 'chips mb-30' },
        D.captionPositions.map((p) => ui.chip(s.captionPosition === p.id, () => C.setState({ captionPosition: p.id }), p.name))
      ),

      /* ── Tipografía ── */
      s.captions && h('div', { class: 'section-head', style: { marginTop: '4px' } },
        h('span', { class: 'section-head__label', style: { fontSize: '11px', opacity: '.6' } }, 'TIPOGRAFÍA'),
        h('span', { class: 'section-head__line' })
      ),

      /* Fuente */
      s.captions && h('div', { class: 'chips', style: { marginBottom: '12px' } },
        D.captionFonts.map((f) => ui.chip(s.captionFont === f.id, () => C.setState({ captionFont: f.id }), f.name))
      ),

      /* Tamaño */
      s.captions && h('div', { class: 'sublabel', style: { marginBottom: '6px' } }, 'Tamaño · ' + s.captionFontSize + 'px'),
      s.captions && h('input', {
        type: 'range', min: 24, max: 90, value: s.captionFontSize, style: { width: '100%', marginBottom: '12px' },
        onInput: (e) => C.setState({ captionFontSize: Number(e.target.value) }),
      }),

      /* Colores */
      s.captions && h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' } },
        h('div', { style: { flex: 1 } },
          h('div', { class: 'sublabel', style: { marginBottom: '4px' } }, 'Color texto'),
          h('input', { type: 'color', value: s.captionColor, style: { width: '100%', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' },
            onChange: (e) => C.setState({ captionColor: e.target.value }) })
        ),
        h('div', { style: { flex: 1 } },
          h('div', { class: 'sublabel', style: { marginBottom: '4px' } }, 'Color borde'),
          h('input', { type: 'color', value: s.captionOutlineColor, style: { width: '100%', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' },
            onChange: (e) => C.setState({ captionOutlineColor: e.target.value }) })
        ),
      ),

      /* Grosor borde */
      s.captions && h('div', { class: 'sublabel', style: { marginBottom: '6px' } }, 'Grosor borde · ' + s.captionOutlineSize),
      s.captions && h('input', {
        type: 'range', min: 0, max: 10, step: 0.5, value: s.captionOutlineSize, style: { width: '100%', marginBottom: '12px' },
        onInput: (e) => C.setState({ captionOutlineSize: Number(e.target.value) }),
      }),

      /* Sombra y Glow */
      s.captions && h('div', { style: { display: 'flex', gap: '10px', marginBottom: '12px' } },
        h('div', { style: { flex: 1 } },
          h('div', { class: 'sublabel', style: { marginBottom: '6px' } }, 'Sombra · ' + s.captionShadow),
          h('input', { type: 'range', min: 0, max: 10, step: 0.5, value: s.captionShadow, style: { width: '100%' },
            onInput: (e) => C.setState({ captionShadow: Number(e.target.value) }) })
        ),
        h('div', { style: { flex: 1 } },
          h('div', { class: 'sublabel', style: { marginBottom: '6px' } }, 'Resplandor · ' + s.captionGlow),
          h('input', { type: 'range', min: 0, max: 20, value: s.captionGlow, style: { width: '100%' },
            onInput: (e) => C.setState({ captionGlow: Number(e.target.value) }) })
        ),
      ),

      /* Negrita / Cursiva / Subrayado */
      s.captions && h('div', { style: { display: 'flex', gap: '8px', marginBottom: '20px' } },
        h('button', {
          class: 'chip' + (s.captionBold ? ' chip--sel' : ''),
          style: { fontWeight: 'bold', minWidth: '48px' },
          onClick: () => C.setState({ captionBold: !s.captionBold })
        }, 'N'),
        h('button', {
          class: 'chip' + (s.captionItalic ? ' chip--sel' : ''),
          style: { fontStyle: 'italic', minWidth: '48px' },
          onClick: () => C.setState({ captionItalic: !s.captionItalic })
        }, 'I'),
        h('button', {
          class: 'chip' + (s.captionUnderline ? ' chip--sel' : ''),
          style: { textDecoration: 'underline', minWidth: '48px' },
          onClick: () => C.setState({ captionUnderline: !s.captionUnderline })
        }, 'S'),
      ),

      ui.sectionHead('04', 'Música'),
      h('div', { style: { marginBottom: '9px' } }, ui.select(s.music, D.musics, (v) => C.setState({ music: v }))),
      h('div', { class: 'eq mb-30' },
        h('span', { class: 'eq__bars' },
          h('span', { style: { height: '6px' } }), h('span', { style: { height: '12px' } }),
          h('span', { style: { height: '8px' } }), h('span', { style: { height: '11px' } })
        ),
        'Beat sync activado · cortes al ritmo'
      ),

      ui.sectionHead('05', 'Ritmo de edición'),
      h('div', { class: 'mb-30' },
        ui.slider(s.pacing, (v) => { s.pacing = v; }, 'Relajado', 'Dinámico', C.util.pacingLabel)
      ),
      h('div', { class: 'sublabel', style: { marginBottom: '8px' } }, 'Corte entre clips'),
      h('div', { class: 'mb-30' },
        ui.slider(s.clipGap, (v) => { s.clipGap = v; }, 'Pegado', 'Con aire', () => '')
      ),

      // modo avanzado
      h('div', { class: 'adv-head' + (s.advanced ? ' adv-head--open' : ''), onClick: () => C.toggle('advanced') },
        h('div', { class: 'adv-head__l' },
          h('span', { class: 'adv-head__gear' }, '⚙'),
          h('div', null,
            h('div', { class: 'adv-head__title' }, 'Modo avanzado'),
            h('div', { class: 'adv-head__sub' }, 'motion · sfx · b-roll · 4K')
          )
        ),
        ui.toggle(s.advanced, () => C.toggle('advanced'), true)
      ),
      s.advanced && h('div', { class: 'adv-body' },
        D.advRows.map((r) =>
          h('div', { class: 'adv-row' },
            h('div', { style: { paddingRight: '12px' } },
              h('div', { class: 'adv-row__title' }, r.name),
              h('div', { class: 'adv-row__desc' }, r.desc)
            ),
            ui.toggle(s.adv[r.k], () => C.toggleAdv(r.k), true)
          )
        )
      )
    );
  }

  function panelTexto() {
    const s = C.state;
    return C.frag(
      ui.sectionHead('01', 'Modo de edición'),
      h('div', { class: 'mode-row' },
        D.editModes.map((m) => {
          const sel = s.editMode === m.id;
          return h('div', { class: 'mode' + (sel ? ' mode--sel' : ''), onClick: () => C.setState({ editMode: m.id }) },
            h('div', { class: 'mode__name' }, m.name),
            h('div', { class: 'mode__desc' }, m.desc),
            sel && h('div', { class: 'preset__check' }, '✓')
          );
        })
      ),
      h('button', { class: 'dark-btn mb-30', onClick: () => C.setState({ scriptOpen: true }) }, '✎ Abrir editor de guión'),

      ui.sectionHead('02', 'Fuente'),
      h('div', { style: { marginBottom: '9px' } }, ui.select(s.font, D.fonts, (v) => C.setState({ font: v }))),
      h('button', { class: 'upload-btn mb-30' }, '＋ Subir fuente propia'),

      ui.sectionHead('03', 'Color de marca'),
      h('div', { class: 'note' }, 'Resalta la palabra activa en subtítulos y el fondo de los títulos de impacto.'),
      h('div', { class: 'swatch-grid mb-30' },
        D.brandColors.map((c) => ui.swatch(c, s.brandColor === c, () => C.setState({ brandColor: c })))
      ),

      ui.sectionHead('04', 'Títulos de impacto'),
      h('div', { class: 'row-card' },
        h('div', null,
          h('div', { class: 'row-card__title' }, 'Activar títulos de impacto'),
          h('div', { class: 'row-card__desc' }, 'Frases grandes y animadas')
        ),
        ui.toggle(s.impact, () => C.toggle('impact'))
      ),
      s.impact && C.frag(
        h('div', { class: 'sublabel' }, 'Tipo de entrada'),
        h('div', { class: 'chips mb-30' },
          D.impactEntrances.map((m) => ui.chip(s.impactEntrance === m.id, () => C.setState({ impactEntrance: m.id }), m.name))
        )
      )
    );
  }

  function panelMov() {
    const s = C.state;
    return C.frag(
      ui.sectionHead('01', 'Transición entre clips'),
      h('div', { class: 'mb-30' }, ui.select(s.transition, D.transitions, (v) => C.setState({ transition: v }))),

      ui.sectionHead('02', 'Zoom'),
      h('div', { class: 'sublabel' }, 'Tipo de zoom'),
      h('div', { style: { marginBottom: '16px' } }, ui.segmented(D.zoomTypes, s.zoomType, (v) => C.setState({ zoomType: v }))),
      h('div', { class: 'sublabel' }, 'Frecuencia'),
      h('div', { class: 'mb-30' }, ui.slider(s.zoomFreq, (v) => { s.zoomFreq = v; }, 'Poco', 'Mucho', C.util.zoomFreqLabel)),

      ui.sectionHead('03', 'Efecto de capas'),
      h('div', { class: 'row-card mb-30' },
        h('div', { class: 'row-card__l' },
          h('div', { class: 'row-card__title' }, 'Presentador al frente'),
          h('div', { class: 'row-card__desc' }, 'La IA segmenta a la persona y la coloca sobre el texto')
        ),
        ui.toggle(s.layers, () => C.toggle('layers'))
      )
    );
  }

  function panelAudio() {
    const s = C.state;
    return C.frag(
      ui.sectionHead('01', 'Volumen de música'),
      h('div', { class: 'note' }, 'Proporción de música frente a la voz del presentador.'),
      h('div', { class: 'mb-30' }, ui.slider(s.musicVol, (v) => { s.musicVol = v; }, 'Voz', 'Música', (v) => v + '%')),

      ui.sectionHead('02', 'Librería de SFX'),
      h('div', { class: 'row-card' },
        h('div', null,
          h('div', { class: 'row-card__title' }, 'Efectos de sonido'),
          h('div', { class: 'row-card__desc' }, 'Whooshes, impactos, risers')
        ),
        ui.toggle(s.sfxOn, () => C.toggle('sfxOn'))
      ),
      h('button', { class: 'dark-btn mb-30', onClick: () => C.setState({ sfxOpen: true }) }, '♪ Abrir librería de SFX')
    );
  }

  function panelRec() {
    const s = C.state;
    return C.frag(
      ui.sectionHead('01', 'Duración máxima'),
      h('div', { class: 'chips chips--grid mb-30' },
        D.durations.map((d) => ui.chip(s.duration === d.id, () => C.setState({ duration: d.id }), d.name))
      ),
      ui.sectionHead('02', 'Calidad de exportación'),
      h('div', { class: 'mb-30' }, ui.segmented(D.qualities, s.quality, (v) => C.setState({ quality: v }))),
      ui.sectionHead('03', 'Elementos visuales'),
      h('div', { class: 'note' }, 'Explora el banco de imágenes y clips de stock, o sube los tuyos.'),
      h('button', { class: 'dark-btn mb-30', onClick: () => C.setState({ visualsOpen: true }) }, '▦ Explorar stock')
    );
  }

  function panelMarca() {
    const s = C.state;
    const fontLabel = C.util.byId(D.fonts, s.font).name;
    return C.frag(
      ui.sectionHead('01', 'Identidad de marca'),
      h('div', { class: 'note', style: { marginBottom: '16px' } },
        'Guarda tu color, fuente y sonidos de identidad para que se apliquen automáticamente a todos tus proyectos.'
      ),
      h('div', { class: 'brand-card' },
        h('div', { class: 'brand-row' },
          h('span', { class: 'brand-row__k' }, 'Color principal'),
          h('span', { class: 'brand-row__color' },
            h('span', { class: 'brand-chip', style: { background: s.brandColor } }),
            h('span', { class: 'brand-row__mono' }, s.brandColor)
          )
        ),
        h('div', { class: 'brand-row' },
          h('span', { class: 'brand-row__k' }, 'Fuente'),
          h('span', { class: 'brand-row__v' }, fontLabel)
        ),
        h('div', { class: 'brand-row' },
          h('span', { class: 'brand-row__k' }, 'Sonidos guardados'),
          h('span', { class: 'brand-row__mono' }, '3 efectos · 1 jingle')
        )
      ),
      h('div', { class: 'row-card' },
        h('div', null,
          h('div', { class: 'row-card__title' }, 'Aplicar automáticamente'),
          h('div', { class: 'row-card__desc' }, 'A cada proyecto nuevo')
        ),
        ui.toggle(s.brandAuto, () => C.toggle('brandAuto'))
      ),
      h('button', { class: 'save-btn', onClick: () => C.actions.saveBrand() }, 'Guardar identidad'),
      s.brandSaved && h('div', { class: 'brand-saved' }, '✓ Identidad guardada y aplicada')
    );
  }

  const PANELS = { edicion: panelEdicion, texto: panelTexto, mov: panelMov, audio: panelAudio, rec: panelRec, marca: panelMarca };

  C.Sidebar = function () {
    const meta = D.panelMeta[C.state.tab];
    return h('div', { class: 'sidebar sb' },
      h('div', { class: 'panel-title' }, meta[0]),
      h('div', { class: 'panel-sub' }, meta[1]),
      PANELS[C.state.tab]()
    );
  };
})();

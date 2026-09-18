/* config.js — zona «configuración» (diseño "very sweet")
   Un solo módulo: tarjetas ⇄ detalle con ←. Primitivas C.ui.* + los paneles con TODOS los ajustes reales. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data, U = C.util;

  /* ---------------- Primitivas ---------------- */
  const ui = (C.ui = {
    label(t, style) { return h('div', { class: 'label', style: style || null }, t); },
    sublabel(t) { return h('div', { class: 'sublabel' }, t); },
    divider(style) { return h('div', { class: 'divider', style: style || null }); },
    gap(px) { return h('div', { style: { height: (px || 18) + 'px' } }); },

    chips(items, value, onSelect, style) {
      return h('div', { class: 'chips', style: style || null },
        items.map((it) => h('button', { class: 'chip' + (value === it.id ? ' chip--sel' : ''), onClick: () => onSelect(it.id) }, it.name))
      );
    },
    select(items, value, onChange, style) {
      return h('div', { class: 'select-wrap', style: style || null },
        h('select', { onChange: (e) => onChange(e.target.value) },
          items.map((it) => h('option', { value: it.id, selected: value === it.id ? 'selected' : null }, it.name))
        ),
        h('i', null, '▾')
      );
    },
    switch(on, onToggle) {
      return h('button', { class: 'switch' + (on ? ' switch--on' : ''), onClick: onToggle }, h('i'));
    },
    switchRow(title, desc, on, onToggle, style) {
      return h('div', { class: 'row', style: style || null },
        h('div', { style: { minWidth: '0' } },
          h('div', { class: 'row__title' }, title),
          desc && h('div', { class: 'row__desc' }, desc)
        ),
        ui.switch(on, onToggle)
      );
    },
    /* Deslizador: mientras se arrastra actualiza estado y etiqueta SIN redibujar; al soltar redibuja */
    slider({ key, label, labelFn, min = 0, max = 100, step = 1, style }) {
      const lab = 'js-lab-' + key;
      const fmt = labelFn || ((v) => String(v));
      return h('div', { style: style || null },
        h('div', { class: 'row' },
          h('span', { class: 'label', style: { marginBottom: '0' } }, label),
          h('span', { class: 'meta ' + lab }, fmt(C.state[key]))
        ),
        h('div', { style: { marginTop: '10px' } },
          h('input', {
            type: 'range', min, max, step, value: C.state[key],
            onInput: (e) => {
              const v = Number(e.target.value);
              C.state[key] = v;
              document.querySelectorAll('.' + lab).forEach((el) => (el.textContent = fmt(v)));
              // el celular muestra el cambio al instante, sin redibujar toda la app
              if (/^(simple|subsEscala|subsDy|subsDx)/.test(key) && C.subs) C.subs.alMover();
            },
            onChange: () => C.render(),
          })
        )
      );
    },
    swatches(value, onSelect) {
      return h('div', { class: 'swatches' },
        D.brandColors.map((c) => h('button', { class: 'swatch' + (value === c ? ' swatch--sel' : ''), style: { background: c }, onClick: () => onSelect(c) }))
      );
    },
    color(value, onChange) {
      return h('input', { type: 'color', class: 'color-in', value, onChange: (e) => onChange(e.target.value) });
    },
    colorRow(title, desc, value, onChange, style) {
      return h('div', { class: 'row', style: style || null },
        h('div', { style: { minWidth: '0' } },
          h('div', { class: 'row__title' }, title),
          desc && h('div', { class: 'row__desc' }, desc)
        ),
        ui.color(value, onChange)
      );
    },
    cards(items, value, onSelect, swatchFn) {
      return h('div', { class: 'cards' },
        items.map((it) =>
          h('div', { class: 'card' + (value === it.id ? ' card--sel' : ''), onClick: () => onSelect(it.id) },
            swatchFn && swatchFn(it),
            h('div', { class: 'card__title' }, it.name),
            it.desc && h('div', { class: 'card__desc' }, it.desc),
            h('div', { class: 'card__check' }, '✓')
          )
        )
      );
    },
    section(t) { return h('div', { class: 'section' }, h('span', null, t), h('i')); },
  });

  const set = (key) => (v) => C.setState({ [key]: v });
  const flip = (key) => () => C.toggle(key);

  /* «A tu gusto»: subtítulo simple, sin animaciones en medio (mismos datos que usa el servidor) */
  function panelSimple(s) {
    const S = C.subs;
    // Al tocar un control de «a tu gusto», el celular muestra solo frases normales para ver exactamente eso
    const set = (key) => (v) => C.setState({ [key]: v, previaEnfoque: 'simple' });
    const flip = (key) => () => C.setState({ [key]: !C.state[key], previaEnfoque: 'simple' });
    return C.frag(
      ui.section(S.modoImpacto(s) ? 'A tu gusto · frases normales' : 'A tu gusto'),
      ui.label('Letra'),
      ui.select(S.LETRAS, s.simpleLetra, set('simpleLetra'), { marginBottom: '16px' }),
      ui.slider({ key: 'simpleCq', label: 'Tamaño', min: 4, max: 10, step: 0.2, labelFn: (v) => Math.round(v * 10.8) + 'px', style: { marginBottom: '16px' } }),
      ui.colorRow('Color del texto', null, s.simpleColor, set('simpleColor'), { marginBottom: '12px' }),
      ui.switchRow('Borde', 'Contorno alrededor de las letras', s.simpleBorde, flip('simpleBorde'), { marginBottom: '12px' }),
      s.simpleBorde && ui.colorRow('Color del borde', null, s.simpleBordeColor, set('simpleBordeColor'), { marginBottom: '12px' }),
      s.simpleBorde && s.simpleColor.toLowerCase() === s.simpleBordeColor.toLowerCase() &&
        h('div', { class: 'aviso' }, '⚠ Texto y borde son el mismo color: el borde no se va a notar.'),
      s.simpleBorde && ui.slider({ key: 'simpleBordeCq', label: 'Grosor del borde', min: 0.2, max: 1.5, step: 0.1, labelFn: (v) => Math.round(v * 10.8) + 'px', style: { marginBottom: '16px' } }),
      ui.switchRow('Sombra suave', 'Ayuda a leer sobre fondos claros', s.simpleSombra, flip('simpleSombra'), { marginBottom: '12px' }),
      ui.switchRow('Mayúsculas', null, s.simpleMayus, flip('simpleMayus'), { marginBottom: '12px' }),
      ui.switchRow('Inclinada', 'La letra queda en cursiva', s.simpleItalica, flip('simpleItalica'), { marginBottom: '16px' }),
      /* Palabra resaltada: la clave que ya marca la IA, pintada como quiera la persona */
      ui.switchRow('Resaltar una palabra', 'La palabra clave de la frase, con su propio estilo',
        s.simpleClaveOn, flip('simpleClaveOn'), { marginBottom: s.simpleClaveOn ? '12px' : '16px' }),
      s.simpleClaveOn && C.frag(
        ui.label('¿En cuántas frases?'),
        ui.chips(C.subs.CADAS, s.simpleClaveCada, set('simpleClaveCada'), { marginBottom: '12px' }),
        ui.colorRow('Color de la palabra', null, s.simpleClaveColor, set('simpleClaveColor'), { marginBottom: '10px' }),
        ui.swatches(s.simpleClaveColor, set('simpleClaveColor')),
        ui.slider({ key: 'simpleClaveEscala', label: 'Tamaño de la palabra', min: 0.6, max: 2, step: 0.05,
          labelFn: (v) => Math.round(v * 100) + '%', style: { margin: '12px 0 14px' } }),
        ui.label('Letra de la palabra'),
        ui.select([{ id: '', name: 'La misma de la frase' }].concat(C.subs.LETRAS), s.simpleClaveLetra, set('simpleClaveLetra'), { marginBottom: '12px' }),
        ui.switchRow('Negrilla', null, s.simpleClaveNegrilla, flip('simpleClaveNegrilla'), { marginBottom: '10px' }),
        ui.switchRow('Inclinada', null, s.simpleClaveItalica, flip('simpleClaveItalica'), { marginBottom: '10px' }),
        ui.switchRow('Subrayada', null, s.simpleClaveSubrayado, flip('simpleClaveSubrayado'), { marginBottom: '16px' })
      ),
      ui.label('Posición'),
      ui.chips(S.POSICIONES, s.simplePos, set('simplePos'), { marginBottom: '16px' }),
      ui.label('Animación de entrada'),
      ui.chips(S.ENTRADAS, s.simpleEntrada, set('simpleEntrada'), { marginBottom: '16px' }),
      ui.label('Animación de salida'),
      ui.chips(S.SALIDAS, s.simpleSalida, set('simpleSalida'), { marginBottom: '20px' })
    );
  }

  /* ---------------- Paneles ---------------- */
  const P = {};

  P.edicion = function () {
    const s = C.state;
    return C.frag(
      ui.cards(D.presets, s.style, set('style'), (p) =>
        h('div', { class: 'card__swatch', style: { boxShadow: 'inset 10px 0 0 ' + p.c1 + ', inset -10px 0 0 ' + p.c2 } })),
      ui.gap(),
      ui.label('Formato'),
      h('div', { class: 'chips', style: { marginBottom: '18px' } },
        D.aspects.map((a) => {
          const sel = s.aspect === a.id;
          return h('button', { class: 'chip' + (sel ? ' chip--sel' : ''), style: { display: 'flex', alignItems: 'center', gap: '8px' }, onClick: () => C.setState({ aspect: a.id }) },
            h('span', { style: { width: a.w + 'px', height: a.h + 'px', flex: 'none', borderRadius: '3px', border: '2px solid ' + (sel ? 'var(--bg)' : 'rgba(247,233,224,.5)') } }),
            h('span', { style: { fontWeight: '800' } }, a.ratio)
          );
        })
      ),
      ui.label('Modo'),
      ui.cards(D.editModes, s.editMode, set('editMode')),
      ui.gap(),
      ui.divider({ marginBottom: '14px' }),
      ui.slider({ key: 'pacing', label: 'Ritmo', labelFn: U.pacingLabel, style: { marginBottom: '18px' } }),
      ui.slider({ key: 'clipGap', label: 'Eliminar silencios', labelFn: U.clipGapLabel, style: { marginBottom: '18px' } }),
      ui.slider({ key: 'clipStart', label: 'Corte entre clips', labelFn: U.clipStartLabel })
    );
  };

  P.texto = function () {
    const s = C.state;
    return C.frag(
      h('button', { class: 'btn btn--amber', style: { marginBottom: '18px' }, onClick: () => C.setState({ scriptOpen: true }) }, '✎ Abrir editor de guión'),

      ui.switchRow('Subtítulos automáticos', 'Transcritos del audio', s.captions, flip('captions'), { paddingBottom: '14px' }),
      s.captions && C.frag(
        ui.label('Estilo de subtítulos'),
        C.subs.galeria(s),
        h('button', {
          class: 'btn ' + (s.typographyPreview ? 'btn--accent' : 'btn--ghost'), style: { margin: '14px 0 12px' },
          onClick: () => C.setState({ typographyPreview: !s.typographyPreview }),
        }, s.typographyPreview ? '▶ Ver mi video en el celular' : '👁 Ver la vista previa en el celular'),
        (s.subsPlantilla || 'editorial') !== 'simple' && C.frag(
          /* Tamaño y posición de la plantilla: se ven en el celular al instante y viajan al video */
          ui.label('Tamaño de la letra'),
          ui.slider({ key: 'subsEscala', label: 'Tamaño', min: 0.7, max: 1.5, step: 0.05,
            labelFn: (v) => Math.round(v * 100) + '%', style: { marginBottom: '14px' } }),
          ui.label('¿Más arriba o más abajo?'),
          ui.slider({ key: 'subsDy', label: 'Arriba / abajo', min: -45, max: 45, step: 1,
            labelFn: (v) => (v === 0 ? 'Como viene' : (v < 0 ? 'Arriba ' : 'Abajo ') + Math.abs(v)), style: { marginBottom: '14px' } }),
          ui.label('¿Más a la izquierda o a la derecha?'),
          ui.slider({ key: 'subsDx', label: 'Izquierda / derecha', min: -35, max: 35, step: 1,
            labelFn: (v) => (v === 0 ? 'Centrado' : (v < 0 ? 'Izquierda ' : 'Derecha ') + Math.abs(v)), style: { marginBottom: '16px' } }),
          ui.label('¿Dónde usar la plantilla?'),
          ui.chips(C.subs.MODOS, s.subsModo, set('subsModo'), { marginBottom: '12px' }),
          s.subsModo === 'impacto' && C.frag(
            ui.label('¿Cuántas frases de impacto?'),
            ui.chips(C.subs.IMPACTOS, s.subsImpacto, set('subsImpacto'), { marginBottom: '10px' }),
            h('div', { class: 'row__desc', style: { marginBottom: '12px' } },
              'La IA escoge las frases más llamativas (el gancho, cifras, afirmaciones fuertes) para la plantilla ' +
              C.subs.nombre(s.subsPlantilla) + '. Las demás salen con tu estilo «A tu gusto», que ajustas aquí abajo.')
          )
        ),
        h('div', { class: 'row__desc', style: { marginBottom: '18px' } },
          'La IA escoge la palabra clave de cada frase y corrige palabras mal oídas. Después de generar, en el editor del resultado puedes cambiar todo frase por frase.'),
        (s.subsPlantilla === 'simple' || C.subs.modoImpacto(s)) && panelSimple(s)
      )
    );
  };

  P.mov = function () {
    const s = C.state;
    return C.frag(
      ui.label('Transición'),
      ui.select(D.transitions, s.transition, set('transition'), { marginBottom: '18px' }),
      ui.label('Tipo de zoom'),
      ui.chips(D.zoomTypes, s.zoomType, set('zoomType'), { marginBottom: '18px' }),
      ui.slider({ key: 'zoomFreq', label: 'Frecuencia', labelFn: U.zoomFreqLabel, style: { marginBottom: '18px' } }),
      ui.divider({ marginBottom: '14px' }),
      ui.switchRow('Presentador al frente', 'La IA lo coloca sobre el texto', s.layers, flip('layers'))
    );
  };

  P.audio = function () {
    const s = C.state;
    return C.frag(
      ui.select(D.musics, s.music, set('music'), { marginBottom: '10px' }),
      h('div', { class: 'mono beat' },
        h('span', { class: 'beat__bars' }, [5, 11, 7, 10].map((hh) => h('span', { style: { height: hh + 'px' } }))),
        'Beat sync · cortes al ritmo'
      ),
      ui.slider({ key: 'musicVol', label: 'Música vs. voz', labelFn: (v) => v + '%', style: { marginBottom: '18px' } }),
      ui.divider({ marginBottom: '14px' }),
      ui.switchRow('Efectos de sonido', 'Whooshes, impactos, risers', s.sfxOn, flip('sfxOn')),
      h('button', { class: 'btn btn--accent', style: { marginTop: '12px' }, onClick: () => C.setState({ sfxOpen: true }) }, '♪ Abrir librería de SFX')
    );
  };

  P.salida = function () {
    const s = C.state;
    return C.frag(
      ui.label('Duración máxima'),
      ui.chips(D.durations, s.duration, set('duration'), { marginBottom: '18px' }),
      ui.label('Calidad'),
      ui.chips(D.qualities, s.quality, set('quality'), { marginBottom: '18px' }),
      h('button', { class: 'btn btn--ghost', style: { marginBottom: '12px' }, onClick: () => C.setState({ visualsOpen: true }) }, '▦ Explorar banco de stock'),
      ui.divider({ marginBottom: '4px' }),
      D.advRows.map((r) =>
        h('div', { class: 'row row--pad' },
          h('div', { style: { minWidth: '0' } },
            h('div', { style: { fontWeight: '600', fontSize: '12.5px' } }, r.name),
            h('div', { style: { fontSize: '10px', color: 'rgba(247,233,224,.42)', lineHeight: '1.35' } }, r.desc)
          ),
          ui.switch(s.adv[r.k], () => C.toggleAdv(r.k))
        )
      )
    );
  };

  /* ── Color: looks de Cherry sobre todo el video, con vista en vivo en el celular ── */
  const conSigno = (v) => (v === 0 ? 'como viene' : (v > 0 ? '+' : '−') + Math.abs(v));
  P.color = function () {
    const s = C.state;
    const MC = window.CherryColor;
    const hayLook = s.look !== 'ninguno' && D.looks.some((l) => l.id === s.look);
    const ajustes = MC ? MC.AJUSTES : [];
    const tocado = s.lookFuerza !== 100 || ajustes.some((a) => Number(s['aj_' + a.k]));
    const enVivo = C.colorVivo && C.colorVivo.fuente(s);
    return h('div', null,
      ui.label('Look'),
      h('div', { class: 'looks' },
        D.looks.map((l) => h('button', {
          class: 'look' + (s.look === l.id ? ' look--sel' : ''), title: l.desc,
          onClick: () => C.setState({ look: l.id }),
        },
          h('span', { class: 'look__foto look__foto--' + l.id }),
          h('span', { class: 'look__nom' }, l.name)
        ))
      ),
      h('div', { class: 'row__desc', style: { margin: '10px 0 16px' } },
        (D.looks.find((l) => l.id === s.look) || D.looks[0]).desc),

      hayLook && h('div', null,
        ui.slider({ key: 'lookFuerza', label: 'Intensidad', min: 10, max: 100, step: 5,
          labelFn: (v) => v + '%', style: { marginBottom: '18px' } }),
        h('div', { class: 'aj-cabeza' },
          h('span', { class: 'label', style: { marginBottom: '0' } }, 'Ajustar el look'),
          tocado && h('button', { class: 'aj-reset', onClick: () => C.restablecerLook() }, 'Restablecer')
        ),
        ajustes.map((a) => h('div', { class: 'aj' },
          ui.slider({ key: 'aj_' + a.k, label: a.nombre, min: -100, max: 100, step: 5, labelFn: conSigno }),
          h('div', { class: 'aj__extremos' }, h('span', null, a.menos), h('span', null, a.mas))
        ))
      ),

      ui.switchRow('Revelado', 'Le quita el velo al video: mide tus clips y hace que el negro sea negro. Va antes del look.',
        s.revelado, () => C.toggle('revelado'), { margin: '6px 0 14px' }),
      h('div', { class: 'row__desc' }, enVivo
        ? 'Lo que ves en el celular es como va a salir. Mantén presionado «ver el original» para comparar.'
        : 'Sube un clip para ver el color en vivo en el celular. El color se aplica a todo el video, antes de los subtítulos.')
    );
  };

  P.marca = function () {
    const s = C.state;
    return C.frag(
      // Fuente y color de marca (antes estaban en Texto): se guardan como identidad; todavía no cambian el video
      ui.label('Fuente de marca'),
      ui.select(D.fonts, s.font, set('font'), { marginBottom: '16px' }),
      ui.label('Color de marca'),
      ui.swatches(s.brandColor, set('brandColor')),
      ui.gap(14),
      ui.divider({ marginBottom: '6px' }),
      h('div', { class: 'row row--pad' },
        h('span', { style: { fontSize: '12.5px', fontWeight: '500' } }, 'Sonidos guardados'),
        h('span', { class: 'mono', style: { fontSize: '10.5px', color: 'rgba(247,233,224,.55)' } }, '3 efectos · 1 jingle')
      ),
      ui.switchRow('Aplicar automáticamente', 'A cada proyecto nuevo', s.brandAuto, flip('brandAuto'), { padding: '14px 0' }),
      h('button', { class: 'btn btn--magenta', onClick: () => C.actions.saveBrand() }, 'Guardar identidad'),
      s.brandSaved && h('div', { class: 'hand', style: { fontSize: '18px', color: 'var(--teal)', textAlign: 'center', marginTop: '10px' } }, '✓ guardada y aplicada')
    );
  };

  P.graficos = function () {
    const s = C.state;
    return C.frag(
      ui.label('Colores del texto'),
      ui.colorRow('Color protagonista', 'Palabra grande en cada escena', s.graphicsHeroColor, set('graphicsHeroColor'), { marginBottom: '12px' }),
      ui.colorRow('Color de soporte', 'Línea de texto secundaria', s.graphicsSupColor, set('graphicsSupColor'), { marginBottom: '18px' }),
      ui.label('Fondo'),
      ui.chips(D.graphicsBgs, s.graphicsBg, set('graphicsBg'), { marginBottom: '18px' }),
      ui.divider({ marginBottom: '14px' }),
      ui.switchRow('Textura de papel', 'Grano orgánico sobre el fondo', s.graphicsPaper, flip('graphicsPaper'), { marginBottom: '14px' }),
      ui.switchRow('Granito (grain)', 'Partículas de ruido animado', s.graphicsGrain, flip('graphicsGrain'), { marginBottom: '14px' }),
      ui.switchRow('FPS bajos (cinematic)', 'Movimiento de cámara a 14 fps', s.graphicsLowFps, flip('graphicsLowFps'), { marginBottom: '18px' }),
      ui.label('Combo de estilo'),
      ui.chips(D.graphicsCombos, s.graphicsCombo, set('graphicsCombo'))
    );
  };

  C.panels = P;

  /* Ilustración de la tarjeta: imagen o video corto en bucle (el video se conserva entre redibujos) */
  function mediaTarjeta(c) {
    if (/\.(mp4|webm|mov)$/i.test(c.media || '')) {
      const v = C.videoFijo('tarjeta-' + c.k, c.media, { muted: true, autoplay: true, loop: true, playsinline: true, preload: 'auto' });
      v.muted = true;
      if (v.paused) v.play().catch(() => null);
      return v;
    }
    return C.imgFija('tarjeta-' + c.k, c.media, { alt: '', onError: (e) => { e.target.style.display = 'none'; } });
  }

  /* ---------------- Módulo único ---------------- */
  C.Config = function () {
    const s = C.state, A = C.actions;
    const open = D.configCards.find((c) => c.k === s.openCard);

    if (!open) {
      return h('div', { class: 'glass glass--full' },
        h('div', { class: 'cfg__head' },
          h('div', null,
            h('div', { class: 'h-module', style: { fontSize: '22px' } }, 'configuración'),
            h('div', { class: 'kicker', style: { marginTop: '5px' } }, 'Toca una tarjeta para entrar')
          ),
          h('span', { class: 'hand', style: { fontSize: '18px', color: 'var(--magenta)', transform: 'rotate(-2deg)' } }, D.configCards.length + ' módulos')
        ),
        h('div', { class: 'cfg__grid', 'data-scroll': 'cfg-grid' },
          D.configCards.map((c) =>
            h('div', { class: 'tile', onClick: () => A.openCard(c.k) },
              h('div', { class: 'tile__media' }, mediaTarjeta(c)),
              h('div', { class: 'tile__body' },
                h('span', { class: 'tile__tag' }, c.tag),
                h('div', { class: 'tile__name' }, c.name),
                h('div', { class: 'tile__desc' }, c.desc),
                h('div', { class: 'tile__foot' },
                  h('span', { class: 'tile__badge', style: { background: c.accent } }, c.glyph),
                  h('span', { class: 'tile__sum' }, U.cardSummary(c.k, s))
                )
              )
            )
          )
        )
      );
    }

    return h('div', { class: 'glass glass--full' },
      h('div', { class: 'cfg__detail-head' },
        h('button', { class: 'btn-round btn-round--ghost', title: 'Volver a los módulos', onClick: () => A.backToGrid() }, '←'),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'h-detail' }, open.name),
          h('div', { class: 'kicker truncate', style: { marginTop: '5px' } }, U.cardSummary(open.k, s))
        ),
        h('span', { class: 'cfg__badge', style: { color: open.accent } }, open.glyph)
      ),
      h('div', { class: 'cfg__body', 'data-scroll': 'cfg-' + open.k }, P[open.k]())
    );
  };
})();

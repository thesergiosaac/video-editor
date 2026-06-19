/* result.js — pantalla "Editar resultado" (overlay a pantalla completa) */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data;

  function timeline() {
    const s = C.state;
    const durLabel = C.util.byId(D.durations, s.duration).name;
    const qualLabel = C.util.byId(D.qualities, s.quality).name;

    return h('div', { class: 'timeline' },
      h('div', { class: 'tl-controls' },
        h('button', { class: 'tl-play', onClick: () => C.actions.togglePlay() },
          s.playing ? h('span', { class: 'pause' }, h('span'), h('span')) : h('span', { class: 'play-tri' })
        ),
        h('span', { class: 'tl-tc' }, '00:12 ', h('span', { class: 'muted' }, '/ ' + durLabel)),
        h('div', { style: { flex: '1' } }),
        h('span', { class: 'tl-meta' }, qualLabel + ' · línea de tiempo')
      ),
      h('div', { class: 'tl-tracks' },
        D.trackDefs.map((t) => {
          const sel = s.selTrack === t.id;
          return h('div', { class: 'tl-track' + (sel ? ' tl-track--sel' : ''), onClick: () => C.setState({ selTrack: t.id }) },
            h('div', { class: 'tl-label' }, h('span', { class: 'tl-dot', style: { background: t.color } }), t.name),
            h('div', { class: 'tl-lane' },
              (D.trackSegs[t.id] || []).map(([l, w]) =>
                h('div', {
                  class: 'tl-seg',
                  style: { left: l + '%', width: w - 1 + '%', background: t.color },
                  onClick: (e) => { e.stopPropagation(); C.setState({ selTrack: t.id }); },
                })
              )
            )
          );
        })
      )
    );
  }

  function label(t) { return h('div', { class: 'field-label' }, t); }

  function props() {
    const s = C.state;
    const body = [];
    if (s.selTrack === 'subs') {
      body.push(
        label('Texto'),
        h('textarea', { class: 'mb-18', onInput: (e) => { s.scriptText = e.target.value; } }, s.scriptText),
        label('Fuente'),
        h('div', { class: 'mb-18' }, C.ui.select(s.font, D.fonts, (v) => C.setState({ font: v }), true)),
        label('Color de resaltado'),
        h('div', { class: 'swatch-grid' }, D.brandColors.map((c) => C.ui.swatch(c, s.brandColor === c, () => C.setState({ brandColor: c }))))
      );
    } else if (s.selTrack === 'clips') {
      body.push(
        h('div', { class: 'clip-thumb' }),
        label('Velocidad'),
        h('input', { type: 'range', min: 0, max: 100, value: 50, class: 'mb-18', style: { marginBottom: '18px' } }),
        h('div', { class: 'props-2btn' }, h('button', { class: 'a' }, 'Reemplazar'), h('button', { class: 'b' }, 'Recortar'))
      );
    } else if (s.selTrack === 'zoom') {
      body.push(
        label('Tipo de zoom'),
        h('div', { class: 'mb-18' }, C.ui.segmented(D.zoomTypes, s.zoomType, (v) => C.setState({ zoomType: v }))),
        label('Intensidad'),
        h('input', { type: 'range', min: 0, max: 100, value: s.zoomFreq, onInput: (e) => { s.zoomFreq = Number(e.target.value); } })
      );
    } else if (s.selTrack === 'motion') {
      body.push(
        label('Tipo de entrada'),
        h('div', { class: 'chips mb-18', style: { marginBottom: '18px' } }, D.impactEntrances.map((m) => C.ui.chip(s.impactEntrance === m.id, () => C.setState({ impactEntrance: m.id }), m.name))),
        label('Color de fondo'),
        h('div', { class: 'swatch-grid' }, D.brandColors.map((c) => C.ui.swatch(c, s.brandColor === c, () => C.setState({ brandColor: c }))))
      );
    } else if (s.selTrack === 'music') {
      body.push(
        label('Pista'),
        h('div', { class: 'mb-18' }, C.ui.select(s.music, D.musics, (v) => C.setState({ music: v }), true)),
        label('Volumen vs. voz · ' + s.musicVol + '%'),
        h('input', { type: 'range', min: 0, max: 100, value: s.musicVol, onInput: (e) => { s.musicVol = Number(e.target.value); } })
      );
    } else if (s.selTrack === 'sfx') {
      body.push(
        h('div', { class: 'note' }, 'Efecto colocado en este punto del video.'),
        h('button', { class: 'dark-btn', style: { marginBottom: '12px' }, onClick: () => C.setState({ sfxOpen: true }) }, '♪ Cambiar sonido'),
        label('Volumen'),
        h('input', { type: 'range', min: 0, max: 100, value: 70 })
      );
    }
    return h('div', { class: 'props sb' },
      h('div', { class: 'props__kicker' }, 'PROPIEDADES'),
      h('div', { class: 'props__title' }, D.selTrackName[s.selTrack]),
      body
    );
  }

  C.ResultEditor = function () {
    const s = C.state;
    if (!s.resultEdit) return null;
    const durLabel = C.util.byId(D.durations, s.duration).name;

    return h('div', { class: 'result' },
      h('div', { class: 'result-top' },
        h('div', { class: 'result-top__l' },
          h('button', { class: 'back-btn', onClick: () => C.setState({ resultEdit: false }) }, '← Volver'),
          h('div', { class: 'result-title' }, 'Editar resultado'),
          h('div', { class: 'result-badge' }, 'EDICIÓN MANUAL')
        ),
        h('div', { class: 'result-top__r' },
          h('button', { class: 'result-iconbtn' }, '↩'),
          h('button', { class: 'result-iconbtn' }, '↪'),
          h('button', { class: 'result-dl' }, 'Descargar'),
          h('button', { class: 'result-export' }, 'Exportar →')
        )
      ),
      h('div', { class: 'result-body' },
        h('div', { class: 'result-stage' },
          h('div', { class: 'stage__scan' }),
          h('div', { class: 'result-frame' },
            h('div', { class: 'frame__scene' }),
            h('div', { class: 'frame__silh' }),
            h('div', { class: 'frame__scan' }),
            C.caption(s.captionStyle === 'minimal' ? 'minimal' : 'pop', s.brandColor, 19),
            h('div', { class: 'result-frame__tc' }, '00:12 / ' + durLabel)
          ),
          h('div', { class: 'result-hint' }, 'Haz clic en un elemento de la línea de tiempo para editarlo')
        ),
        props()
      ),
      timeline()
    );
  };
})();

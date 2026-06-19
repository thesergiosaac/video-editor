/* preview.js — escenario central con el marco en vivo */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data;

  // Builder de subtítulo reutilizable (lo usa también el editor de resultado).
  // brandColor pinta el resaltado de la palabra activa.
  C.caption = function (captionStyle, brandColor, fontSize) {
    const minimal = captionStyle === 'minimal';
    const hiStyle = minimal ? { color: brandColor } : { background: brandColor, color: '#1C1610' };
    return h('div', { class: 'caption' + (minimal ? ' caption--minimal' : ''), style: fontSize ? { fontSize: fontSize + 'px' } : null },
      'NADIE EDITA ',
      h('span', { class: 'cap-hi', style: hiStyle }, 'ASÍ'),
      ' DE RÁPIDO'
    );
  };

  function frameInner(s) {
    // Si hay video renderizado, mostrar el video real en lugar del mockup
    if (s.renderUrl) {
      return h('video', {
        src: s.renderUrl,
        controls: true,
        autoplay: false,
        playsinline: true,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '4px',
          background: '#000',
        }
      });
    }
    return C.frag(
      h('div', { class: 'frame__scene' }),
      h('div', { class: 'frame__silh' }),
      h('div', { class: 'frame__tint', style: { background: D.styleTint[s.style], mixBlendMode: s.style === 'vhs' ? 'screen' : 'normal' } }),
      h('div', { class: 'frame__scan' }),
      h('div', { class: 'frame__grain' }),
      h('div', { class: 'frame__vig' }),
      h('div', { class: 'frame__tc' }, h('span', { class: 'rec-dot' }), h('span', { class: 'js-tc' }, C.util.fmtTime(s.progress * 24)), ' / 00:24'),
      h('div', { class: 'frame__style' }, D.styleLabel[s.style]),
      s.captions && C.caption(s.captionStyle, s.brandColor),
      !s.playing && h('div', { class: 'play-overlay', onClick: () => C.actions.togglePlay() },
        h('div', { class: 'play-big' }, h('div', { class: 'play-tri' }))
      ),
      h('div', { class: 'frame__bar' }, h('div', { class: 'frame__bar-fill js-bar', style: { width: s.progress * 100 + '%' } }))
    );
  }

  C.Preview = function () {
    const s = C.state;
    const dims = D.aspectDims[s.aspect];
    return h('div', { class: 'stage' },
      h('div', { class: 'stage__scan' }),
      h('div', { class: 'stage__glow' }),
      h('div', { class: 'sticker' }, '★ AI Cut · auto'),
      h('div', { class: 'stage-meta', html: 'PREVIEW · 24fps<br>RES 1080×1920' }),
      h('div', { class: 'filmstrip' }, Array.from({ length: 14 }, () => h('span', { class: 'sprocket' }))),

      h('div', { class: 'frame', style: { width: dims.w + 'px', height: dims.h + 'px' } }, frameInner(s)),

      h('div', { class: 'controls', style: { width: dims.w + 'px' } },
        h('button', { class: 'ctrl-play', onClick: () => C.actions.togglePlay() },
          s.playing
            ? h('span', { class: 'pause' }, h('span'), h('span'))
            : h('span', { class: 'play-tri' })
        ),
        h('span', { class: 'ctrl-tc js-tc' }, C.util.fmtTime(s.progress * 24)),
        h('input', {
          type: 'range', class: 'on-dark', min: 0, max: 1000, value: Math.round(s.progress * 1000),
          style: { flex: '1' },
          onInput: (e) => C.actions.setProgress(Number(e.target.value) / 1000),
        }),
        h('span', { class: 'ctrl-total' }, '00:24'),
        h('span', { class: 'ctrl-speed' }, '1×')
      )
    );
  };
})();

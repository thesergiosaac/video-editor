/* phone.js — reproductor en mockup de celular (diseño "night shift")
   Pantalla apagada → vista simulada (play sin video) → video real cuando hay render.
   Incluye la vista de tipografía de subtítulos y la tarjeta de controles. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data, U = C.util;

  /* Subtítulo de muestra del diseño (vista simulada) */
  C.caption = function () {
    const s = C.state;
    let hi;
    if (s.captionStyle === 'minimal') hi = h('span', { style: { color: 'var(--amber)', fontWeight: '700' } }, 'ASÍ');
    else if (s.captionStyle === 'pop') hi = h('span', { class: 'caption__hi--pop', style: { background: s.brandColor, color: 'var(--bg)' } }, 'ASÍ');
    else hi = h('span', { style: { color: s.brandColor } }, 'ASÍ');
    return h('div', { class: 'caption caption--' + s.captionStyle }, 'NADIE EDITA ', hi, ' DE RÁPIDO');
  };

  /* Vista de tipografía: reproduce el subtítulo real (fuente, tamaño, borde, sombra, posición)
     sobre un cuadro 9:16. Las medidas van en cqw: 100cqw = 1080 px del video. */
  function vistaTipografia(s) {
    const k = 100 / 1080;
    const cssFont = U.byId(D.captionFonts, s.captionFont).css;
    const sombras = [];
    if (s.captionOutlineEnabled && s.captionOutlineSize > 0) {
      const o = (s.captionOutlineSize * 0.8 * k).toFixed(3) + 'cqw', m = '-' + o, c = s.captionOutlineColor;
      sombras.push(o + ' 0 0 ' + c, m + ' 0 0 ' + c, '0 ' + o + ' 0 ' + c, '0 ' + m + ' 0 ' + c,
        o + ' ' + o + ' 0 ' + c, m + ' ' + o + ' 0 ' + c, o + ' ' + m + ' 0 ' + c, m + ' ' + m + ' 0 ' + c);
    }
    if (s.captionShadow > 0) {
      const sp = (s.captionShadow * 0.5 * k).toFixed(3) + 'cqw';
      const blur = ((s.captionShadowBlur || 0) * 10 * k).toFixed(3) + 'cqw';
      const alpha = s.captionShadowOpacity != null ? s.captionShadowOpacity : 0.95;
      sombras.push(sp + ' ' + sp + ' ' + blur + ' rgba(0,0,0,' + alpha + ')');
    }
    let top = 'auto', bottom = 'auto';
    if (s.captionPosition === 'head') top = '8%';
    else if (s.captionPosition === 'bottom') bottom = (80 / 1920 * 100).toFixed(2) + '%';  // ASS MarginV=80
    else top = '52%';

    return h('div', { class: 'tipo' },
      h('div', { class: 'tipo__frame' },
        h('img', { class: 'tipo__bg', src: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&h=711&fit=crop&auto=format', alt: '' }),
        h('div', { class: 'tipo__dim' }),
        h('div', {
          class: 'tipo__text',
          style: {
            fontFamily: cssFont, fontSize: (s.captionFontSize * k).toFixed(3) + 'cqw', color: s.captionColor,
            fontWeight: s.captionBold ? '700' : '400', fontStyle: s.captionItalic ? 'italic' : 'normal',
            textDecoration: s.captionUnderline ? 'underline' : 'none',
            textTransform: s.captionUppercase ? 'uppercase' : 'none',
            textShadow: sombras.length ? sombras.join(', ') : 'none', top, bottom,
          },
        }, 'Nadie edita tan rápido como tú')
      ),
      h('button', { class: 'tipo__exit', onClick: () => C.setState({ typographyPreview: false }) }, '✕ Salir de tipografía')
    );
  }

  /* Pantalla con el video real */
  function pantallaVideo(s) {
    const v = C.videoFijo('vista', C.urlVideo(s.renderUrl), {
      class: 'js-video-player screen__video',
      playsinline: true,
      preload: 'auto',
      style: { opacity: s.videoReady ? '1' : '0' },
      onCanplay: () => C.actions.videoCanPlay(),
      onLoadedmetadata: (e) => C.live.total(e.target.duration),
      onTimeupdate: (e) => { const t = e.target; if (t.duration) C.live.progress(t.currentTime / t.duration, t.duration); },
      onPlay: () => C.live.playing(true),
      onPause: () => C.live.playing(false),
      onEnded: () => C.live.playing(false),
      onClick: () => C.actions.togglePlay(),
      onProgress: (e) => {
        const t = e.target;
        if (t.buffered.length > 0 && t.duration) {
          const pct = Math.round((t.buffered.end(t.buffered.length - 1) / t.duration) * 100);
          document.querySelectorAll('.js-buf-fill').forEach((el) => (el.style.width = pct + '%'));
          document.querySelectorAll('.js-buf-pct').forEach((el) => (el.textContent = 'Cargando… ' + pct + '%'));
        }
      },
      onWaiting: () => document.querySelectorAll('.js-stall-overlay').forEach((el) => (el.style.display = 'flex')),
      onPlaying: () => document.querySelectorAll('.js-stall-overlay').forEach((el) => (el.style.display = 'none')),
    });
    const dur = v.duration || 0;
    const p = dur ? v.currentTime / dur : 0;
    const reproduciendo = !v.paused;

    return [
      v,
      h('div', { class: 'screen__chips' },
        h('div', { class: 'chip-tc' }, h('span', { class: 'chip-rec' }), h('span', { class: 'js-tc' }, U.fmtTime(v.currentTime || 0))),
        h('div', { class: 'chip-style' }, U.nameOf(D.presets, s.style))
      ),
      h('div', { class: 'screen__play js-screen-play', style: { display: reproduciendo ? 'none' : 'flex' }, onClick: () => C.actions.togglePlay() },
        h('div', { class: 'play-glass' }, h('span', { class: 'tri' }))
      ),
      h('div', { class: 'screen__bar' }, h('i', { class: 'js-bar', style: { width: p * 100 + '%' } })),
      // Se traba a mitad de reproducción
      h('div', { class: 'screen__wait js-stall-overlay', style: { display: 'none' } }, h('span', { class: 'spinner spinner--lg' })),
      // Cargando hasta que el video puede arrancar
      !s.videoReady && h('div', { class: 'screen__wait screen__wait--solid js-video-overlay' },
        h('span', { class: 'spinner spinner--lg' }),
        h('div', { class: 'screen__wait-title' }, '¡listo en un momento!'),
        h('div', { class: 'screen__off-copy' }, 'Preparando tu video para que se vea fluido.'),
        h('div', { class: 'bar bar--sm' }, h('i', { class: 'js-buf-fill', style: { width: '0%' } })),
        h('div', { class: 'screen__off-kicker js-buf-pct' }, 'Cargando…')
      ),
    ];
  }

  C.Phone = function () {
    const s = C.state;
    let kids;

    if (s.typographyPreview && s.captions) {
      kids = [vistaTipografia(s)];
    } else if (s.phase === 'done' && !s.renderUrl) {
      kids = [
        h('div', { class: 'screen__off-sheen' }),
        h('div', { class: 'screen__off-body' },
          h('span', { class: 'spinner spinner--lg' }),
          h('div', { class: 'screen__wait-title' }, '¡casi listo!'),
          h('div', { class: 'screen__off-copy js-download-pct' }, 'Descargando video…'))
      ];
    } else if (s.renderUrl) {
      kids = pantallaVideo(s);
    } else if (s.playing || s.progress > 0) {
      // Vista simulada del diseño (todavía no hay video generado)
      kids = [
        h('div', { class: 'screen__scene' }),
        h('div', { class: 'screen__floor' }),
        h('div', { class: 'screen__monitor' }),
        h('div', { class: 'screen__tint', style: { background: D.tints[s.style], mixBlendMode: s.style === 'vhs' ? 'screen' : 'normal' } }),
        h('div', { class: 'screen__scan' }),
        h('div', { class: 'screen__chips' },
          h('div', { class: 'chip-tc' }, h('span', { class: 'chip-rec' }), h('span', { class: 'js-tc' }, U.fmtTime(s.progress * 24))),
          h('div', { class: 'chip-style' }, U.nameOf(D.presets, s.style))
        ),
        s.captions && C.caption(),
        h('div', { class: 'screen__play js-screen-play', style: { display: s.playing ? 'none' : 'flex' }, onClick: () => C.actions.togglePlay() },
          h('div', { class: 'play-glass' }, h('span', { class: 'tri' }))
        ),
        h('div', { class: 'screen__bar' }, h('i', { class: 'js-bar', style: { width: s.progress * 100 + '%' } })),
      ];
    } else {
      kids = [
        h('div', { class: 'screen__off-sheen' }),
        h('div', { class: 'screen__off-body' },
          h('div', { class: 'screen__off-ring' }, '◦'),
          h('div', { class: 'screen__off-kicker' }, 'pantalla apagada'),
          h('div', { class: 'screen__off-copy', html: 'Sube clips y genera tu video<br>para ver la vista previa' }))
      ];
    }

    return h('div', { class: 'phone' },
      h('div', { class: 'phone__notch' }),
      h('div', { class: 'screen' }, kids)
    );
  };

  /* Tarjeta de controles bajo el celular */
  C.Player = function () {
    const s = C.state, A = C.actions;
    const v = C.videoVista();
    const dur = v && v.duration ? v.duration : 0;
    const p = v ? (dur ? v.currentTime / dur : 0) : s.progress;
    const reproduciendo = v ? !v.paused : s.playing;

    const scrub = h('input', {
      type: 'range', min: 0, max: 1000, value: Math.round(p * 1000), class: 'js-scrub',
      style: { flex: '1', minWidth: '0' },
      onInput: (e) => A.setProgress(Number(e.target.value) / 1000),
    });

    return h('div', { class: 'glass player' },
      h('div', { class: 'player__row' },
        h('button', { class: 'btn-round', onClick: () => A.togglePlay() },
          reproduciendo
            ? h('span', { class: 'js-play-icon pause', html: '<i></i><i></i>' })
            : h('span', { class: 'js-play-icon tri tri--dark' })
        ),
        h('span', { class: 'tc js-tc' }, U.fmtTime(v ? v.currentTime || 0 : s.progress * 24)),
        scrub,
        h('span', { class: 'tc tc--dim js-total' }, v ? U.fmtTime(dur) : '00:24')
      ),
      h('div', { class: 'player__meta' },
        h('span', null, s.aspect + ' · ' + U.nameOf(D.qualities, s.quality) + ' · ' + U.nameOf(D.durations, s.duration)),
        h('span', { style: { color: 'var(--amber)' } }, U.pacingLabel(s.pacing))
      )
    );
  };
})();

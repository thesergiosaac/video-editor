/* phone.js — reproductor en mockup de celular (diseño "very sweet")
   Pantalla apagada → vista simulada (play sin video) → video real cuando hay render.
   Incluye la vista de tipografía de subtítulos y la tarjeta de controles. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data, U = C.util;

  /* Subtítulo de muestra en la plantilla elegida (vista simulada, sin video todavía) */
  C.caption = function () {
    const s = C.state;
    return C.subs.pagina(s.subsPlantilla, C.subs.MUESTRAS[0], C.subs.simpleVista(s));
  };

  /* Vista previa de la plantilla con su animación, igual a como sale en el video (9:16 cubriendo la pantalla) */
  function vistaTipografia(s) {
    return h('div', { class: 'sp-celular' },
      C.subs.vivo(s),
      h('button', { class: 'tipo__exit', onClick: () => C.setState({ typographyPreview: false }) }, '✕ Salir de la vista previa')
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
    if (!(s.typographyPreview && s.captions)) setTimeout(() => C.subs.pausarFondo(), 0);   // el video de fondo de la vista previa no sigue sonando/decodificando
    const colorVivo = C.colorVivo && C.colorVivo.activo(s);
    if (!colorVivo && C.colorVivo) setTimeout(() => C.colorVivo.pausar(), 0);

    if (colorVivo) {
      kids = [C.colorVivo.pantalla(s)];           // tarjeta Color abierta: tu video sin color, pintado en vivo
    } else if (s.typographyPreview && s.captions) {
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

    // Medidas reales de celular: el cuadro decide el tamaño y el celular nunca se deforma
    const igEncima = s.igVista && !(s.typographyPreview && s.captions) && C.MarcoInstagram;
    return h('div', { class: 'phone-wrap' },
      h('div', { class: 'phone' },
        h('div', { class: 'screen' }, kids, igEncima && C.MarcoInstagram(), h('div', { class: 'screen__island' }))
      )
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
      ),
      /* Vista de cada red encima del video, para saber qué tapa. Por ahora Instagram; después vendrán más. */
      h('div', { class: 'vistas' },
        h('span', { class: 'vistas__etq' }, 'Vista'),
        h('button', {
          class: 'vista-red' + (s.igVista ? ' vista-red--on' : ''),
          title: 'Ver el video con la interfaz de Instagram encima',
          onClick: () => A.verEnInstagram(),
          html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
            + '<rect x="3" y="3" width="18" height="18" rx="5.4"/><circle cx="12" cy="12" r="4.1"/>'
            + '<circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>',
        })
      )
    );
  };
})();

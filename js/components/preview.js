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
    // ── Preview tipográfico — tiene prioridad sobre todo ──────────────────
    if (s.typographyPreview && s.captions) {
      const FRAME_H   = (D.aspectDims[s.aspect] && D.aspectDims[s.aspect].h) || 512;
      const VIDEO_H   = 1920;
      const scale     = FRAME_H / VIDEO_H;
      const fontMap   = {
        'roboto-bold':    "'Roboto', sans-serif",
        'montserrat':     "'Montserrat', sans-serif",
        'europa-grotesk': "'Space Grotesk', sans-serif",
      };
      const cssFont   = fontMap[s.captionFont] || "'Roboto', sans-serif";
      const sz        = Math.round(s.captionFontSize * scale);
      const outSz     = s.captionOutlineEnabled ? s.captionOutlineSize * scale * 0.8 : 0;
      const outColor  = s.captionOutlineEnabled ? s.captionOutlineColor : 'transparent';
      // Outline: 8 direcciones para borde uniforme (= ASS Outline)
      // Sombra dura sin blur (= ASS Shadow, que es hard shadow sin desenfoque)
      const _sh = [];
      if (outSz > 0) {
        const o = outSz;
        _sh.push(
          o+'px 0 0 '+outColor,     (-o)+'px 0 0 '+outColor,
          '0 '+o+'px 0 '+outColor,  '0 '+(-o)+'px 0 '+outColor,
          o+'px '+o+'px 0 '+outColor,   (-o)+'px '+o+'px 0 '+outColor,
          o+'px '+(-o)+'px 0 '+outColor, (-o)+'px '+(-o)+'px 0 '+outColor
        );
      }
      if (s.captionShadow > 0) {
        const sp    = (s.captionShadow * scale * 0.5).toFixed(2);
        const blur  = ((s.captionShadowBlur || 0) * scale).toFixed(2);
        const alpha = (s.captionShadowOpacity != null) ? s.captionShadowOpacity : 0.95;
        _sh.push(sp+'px '+sp+'px '+blur+'px rgba(0,0,0,'+alpha+')');
      }
      const shadowStr = _sh.length > 0 ? _sh.join(', ') : 'none';

      var posTop, posBottom;
      if (s.captionPosition === 'head')        { posTop = Math.round(FRAME_H * 0.08)+'px'; posBottom = 'auto'; }
      else if (s.captionPosition === 'bottom') { posTop = 'auto'; posBottom = Math.round(FRAME_H * 0.04)+'px'; }
      else                                     { posTop = Math.round(FRAME_H * 0.52)+'px'; posBottom = 'auto'; }

      const BG_IMG = 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&h=711&fit=crop&auto=format';

      return h('div', { style: { position: 'relative', width: '100%', height: '100%', borderRadius: '4px', overflow: 'hidden', background: '#111' } },
        h('img', { src: BG_IMG, style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', opacity: '0.75' } }),
        h('div', { style: { position: 'absolute', inset: '0', background: 'rgba(0,0,0,0.25)' } }),
        h('div', {
          style: {
            position: 'absolute', left: '50%', maxWidth: '90%', textAlign: 'center',
            fontFamily: cssFont, fontSize: sz+'px', color: s.captionColor,
            fontWeight: s.captionBold ? '700' : '400',
            fontStyle: s.captionItalic ? 'italic' : 'normal',
            textDecoration: s.captionUnderline ? 'underline' : 'none',
            textShadow: shadowStr, lineHeight: '1.3', pointerEvents: 'none',
            top: posTop, bottom: posBottom, transform: 'translateX(-50%)',
          }
        }, 'Nadie edita tan rapido como tu'),
        h('div', { style: {
          position: 'absolute', top: '8px', left: '8px',
          background: 'rgba(255,90,31,0.9)', color: '#fff',
          fontSize: '9px', fontWeight: '700', letterSpacing: '0.05em',
          padding: '3px 7px', borderRadius: '4px',
        }}, 'PREVIEW TIPO')
      );
    }

    // Descargando blob — mostrar progreso mientras no hay URL lista
    if (s.phase === 'done' && !s.renderUrl) {
      return h('div', {
        style: {
          width: '100%', height: '100%', background: '#0d0d0d',
          borderRadius: '4px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '10px', padding: '24px', boxSizing: 'border-box', textAlign: 'center',
        }
      },
        h('div', {
          style: {
            width: '42px', height: '42px', borderRadius: '50%',
            border: '3px solid #333', borderTopColor: '#FF5A1F',
            animation: 'spin 0.9s linear infinite', marginBottom: '4px',
          }
        }),
        h('div', { style: { color: '#fff', fontSize: '15px', fontWeight: '700' } },
          '¡Casi listo!'
        ),
        h('div', {
          class: 'js-download-pct',
          style: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '1.5', maxWidth: '180px' }
        }, 'Descargando video...')
      );
    }
    // Si hay video renderizado, mostrar el video real en lugar del mockup
    if (s.renderUrl) {
      // Wrapper: video streameando en fondo + overlay hasta que el buffer esté listo
      return h('div', { style: { position: 'relative', width: '100%', height: '100%' } },
        // Video siempre en DOM para que el navegador bufferie en paralelo
        h('video', {
          src: s.renderUrl,
          controls: s.videoReady,
          playsinline: true,
          preload: 'auto',
          class: 'js-video-player',
          style: {
            width: '100%', height: '100%',
            objectFit: 'cover', borderRadius: '4px', background: '#000',
            opacity: s.videoReady ? '1' : '0',
            pointerEvents: s.videoReady ? 'auto' : 'none',
            transition: 'opacity 0.4s ease',
          },
          oncanplaythrough: () => { C.actions.videoCanPlay(); },
          onloadeddata:     () => { C.actions.videoCanPlay(); },
        }),
        // Overlay de carga — clase js-video-overlay para ocultarlo sin re-render
        !s.videoReady && h('div', {
          class: 'js-video-overlay',
          style: {
            position: 'absolute', inset: '0',
            background: '#0d0d0d', borderRadius: '4px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '10px', padding: '24px', boxSizing: 'border-box', textAlign: 'center',
          }
        },
          h('div', {
            style: {
              width: '42px', height: '42px', borderRadius: '50%',
              border: '3px solid #333', borderTopColor: '#FF5A1F',
              animation: 'spin 0.9s linear infinite', marginBottom: '4px',
            }
          }),
          h('div', { style: { color: '#fff', fontSize: '15px', fontWeight: '700' } },
            '¡Listo en un momento!'
          ),
          h('div', { style: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '1.5', maxWidth: '180px' } },
            'Preparando tu video para que se vea fluido sin interrupciones.'
          )
        )
      );
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
      /* Toggle tipografía en lugar del sticker — solo en edición con subtítulos */
      s.captions && s.tab === 'edicion'
        ? h('button', {
            onClick: () => C.setState({ typographyPreview: !s.typographyPreview }),
            style: {
              position: 'absolute', top: '34px', left: '38px',
              display: 'flex', alignItems: 'center', gap: '6px',
              background: s.typographyPreview ? 'rgba(255,90,31,0.18)' : 'rgba(255,255,255,0.08)',
              color: s.typographyPreview ? '#FF5A1F' : 'rgba(255,255,255,0.65)',
              border: s.typographyPreview ? '1px solid rgba(255,90,31,0.55)' : '1px solid rgba(255,255,255,0.15)',
              fontWeight: '600', fontSize: '11px', letterSpacing: '0.03em',
              padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
              backdropFilter: 'blur(8px)', zIndex: '10',
              transition: 'all 0.15s ease',
            }
          },
            s.typographyPreview ? '✕ Salir preview' : '👁 Ver tipografía'
          )
        : h('div', { class: 'sticker' }, '★ AI Cut · auto'),
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
      ),

      /* Botón descarga HD — aparece cuando hay video en pantalla */
      s.renderUrl && h('div', { style: { width: dims.w + 'px', marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' } },
        s.downloadUrl
          ? h('a', {
              href: s.downloadUrl,
              download: 'video-carrete.mp4',
              class: 'btn-download-hd',
              style: {
                flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                background: '#FF5A1F', color: '#fff', borderRadius: '8px',
                padding: '10px 0', fontWeight: '700', fontSize: '13px',
                textDecoration: 'none', cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(255,90,31,0.35)',
              }
            },
            h('svg', { width: '15', height: '15', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
              h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
              h('polyline', { points: '7 10 12 15 17 10' }),
              h('line', { x1: '12', y1: '15', x2: '12', y2: '3' })
            ),
            'Descargar en HD'
          )
          : h('div', {
              style: {
                flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                background: 'rgba(255,90,31,0.25)', color: 'rgba(255,255,255,0.5)',
                borderRadius: '8px', padding: '10px 0', fontSize: '13px', fontWeight: '600',
              }
            },
            h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', strokeLinecap: 'round', strokeLinejoin: 'round', style: { animation: 'spin 1.2s linear infinite' } },
              h('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' })
            ),
            'Preparando descarga HD...'
          )
      )
    );
  };
})();

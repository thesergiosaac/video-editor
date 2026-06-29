/* state.js — estado único + acciones conectadas al backend real */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const { fmtTime } = C.util;

  C.state = {
    /* reproducción */
    playing: false,
    progress: 0.34,
    /* configuración */
    aspect: '9:16',
    style: 'sunset',
    captions: true,
    captionPosition: 'chin',
    captionStyle: 'pop',
    /* tipografía de subtítulos */
    captionFont:         'roboto-bold',
    captionFontSize:     52,
    captionColor:        '#ffffff',
    captionOutlineEnabled: true,
    typographyPreview:     false,
    captionOutlineColor: '#000000',
    captionOutlineSize:  2.5,
    captionShadow:       0,
    captionShadowBlur:   3,
    captionShadowOpacity: 0.95,
    captionGlow:         0,
    captionBold:         true,
    captionItalic:       false,
    captionUnderline:    false,
    captionUppercase:    true,
    music: 'synthwave',
    pacing: 64,
    clipGap: 50,        /* 0 = sin aire, 50 = actual (80ms), 100 = mucho aire (1s+) */
    clipStart: 50,      /* 0 = pegado (sin silencio inicial), 50 = con aire natural */
    advanced: false,
    adv: { motion: true, sfx: false, broll: true, fourk: false },
    /* pestañas */
    tab: 'edicion',
    /* texto */
    scriptOpen: false,
    scriptText: '',
    editMode: 'guion',
    font: 'syne',
    brandColor: '#FF5A1F',
    impact: true,
    impactStyle:          'protagonista',
    /* tipografía — palabra protagonista */
    impactBigFont:        'roboto-bold',
    impactBigSize:        90,
    impactBigColor:       '#ffffff',
    impactBigUppercase:   true,
    impactBigSpacing:     0,
    /* tipografía — línea de soporte */
    impactSupFont:        'georgia',
    impactSupSize:        32,
    impactSupColor:       '#ffffff',
    impactSupOpacity:     0.65,
    impactSupPosition:    'arriba',
    impactSupSpacing:     3,
    /* animaciones */
    impactEntrance:       'blur',
    impactEntranceDur:    550,
    impactExit:           'blur',
    impactExitDur:        400,
    /* movimiento */
    transition: 'corte',
    zoomType: 'suave',
    zoomFreq: 45,
    /* audio */
    musicVol: 60,
    sfxOn: false,
    sfxOpen: false,
    sfxCat: 'whoosh',
    /* recursos */
    duration: '30',
    quality: '1080',
    visualsOpen: false,
    visualsCat: 'naturaleza',
    /* capas / marca */
    layers: true,
    brandAuto: true,
    brandSaved: false,
    /* clips reales */
    clips: [],
    uploadingClips: false,
    uploadProgress: 0,
    uploadingFile: '',
    /* render */
    phase: 'idle',
    renderProgress: 0,
    renderUrl: null,
    downloadUrl: null,
    videoReady: false,
    /* editar resultado */
    resultEdit: false,
    selTrack: 'subs',
  };

  C.setState = function (patch, opts) {
    Object.assign(C.state, patch);
    if (!opts || opts.render !== false) C.render();
  };
  C.toggle = function (key) { C.state[key] = !C.state[key]; C.render(); };
  C.toggleAdv = function (k) { C.state.adv[k] = !C.state.adv[k]; C.render(); };

  C.live = {
    progress(p) {
      document.querySelectorAll('.js-bar').forEach((e) => (e.style.width = p * 100 + '%'));
      document.querySelectorAll('.js-tc').forEach((e) => (e.textContent = fmtTime(p * 24)));
    },
  };

  let playTimer   = null;
  let pollTimer   = null;
  let brandTimer  = null;


  // Streaming directo desde S3: el browser carga solo lo que necesita para reproducir
  // (antes se descargaba el blob completo de 80MB antes de mostrar nada — muy lento)
  async function startBlobDownload(s3Url) {
    C.setState({ renderUrl: s3Url, videoReady: false });
    setTimeout(() => { if (!C.state.videoReady) C.actions.videoCanPlay(); }, 8000);
  }



  C.actions = {
    togglePlay() {
      const playing = !C.state.playing;
      C.state.playing = playing;
      clearInterval(playTimer);
      if (playing) {
        playTimer = setInterval(() => {
          let p = C.state.progress + 0.0045;
          if (p >= 1) p = 0;
          C.state.progress = p;
          C.live.progress(p);
        }, 60);
      }
      C.render();
    },

    setProgress(v) {
      C.state.progress = v;
      C.live.progress(v);
    },

    /* ── GENERAR VIDEO — conectado al backend real ── */
    async generate() {
      if (C.state.phase === 'rendering') return;
      if (!C.apiReady) { alert('Conectando con el servidor…'); return; }

      /* URL del render anterior — guardar ANTES de limpiar renderUrl */
      const previousUrl = C.state.renderUrl;

      clearInterval(pollTimer);
      C.setState({ phase: 'rendering', renderProgress: 2, renderUrl: null, downloadUrl: null });

      /* Recoger todos los parámetros del sidebar */
      const s = C.state;
      const settings = {
        aspect:          s.aspect,
        style:           s.style,
        captions:        s.captions,
        captionStyle:    s.captionStyle,
        captionPosition:    s.captionPosition,
        captionFont:        s.captionFont,
        captionFontSize:    s.captionFontSize,
        captionColor:       s.captionColor,
        captionOutlineEnabled: s.captionOutlineEnabled,
        captionOutlineColor:s.captionOutlineColor,
        captionOutlineSize: s.captionOutlineSize,
        captionShadow:      s.captionShadow,
        captionShadowBlur:  s.captionShadowBlur,
        captionShadowOpacity: s.captionShadowOpacity,
        captionGlow:        s.captionGlow,
        captionBold:        s.captionBold,
        captionItalic:      s.captionItalic,
        captionUnderline:   s.captionUnderline,
        captionUppercase:   s.captionUppercase,
        music:           s.music,
        musicVol:        s.musicVol,
        pacing:          s.pacing,
        clipGap:         s.clipGap,
        clipStart:       s.clipStart,
        editMode:        s.editMode,
        font:            s.font,
        brandColor:      s.brandColor,
        impact:             s.impact,
        impactStyle:        s.impactStyle,
        impactBigFont:      s.impactBigFont,
        impactBigSize:      s.impactBigSize,
        impactBigColor:     s.impactBigColor,
        impactBigUppercase: s.impactBigUppercase,
        impactBigSpacing:   s.impactBigSpacing,
        impactSupFont:      s.impactSupFont,
        impactSupSize:      s.impactSupSize,
        impactSupColor:     s.impactSupColor,
        impactSupOpacity:   s.impactSupOpacity,
        impactSupPosition:  s.impactSupPosition,
        impactSupSpacing:   s.impactSupSpacing,
        impactEntrance:     s.impactEntrance,
        impactEntranceDur:  s.impactEntranceDur,
        impactExit:         s.impactExit,
        impactExitDur:      s.impactExitDur,
        transition:      s.transition,
        zoomType:        s.zoomType,
        zoomFreq:        s.zoomFreq,
        layers:          s.layers,
        sfxOn:           s.sfxOn,
        duration:        s.duration,
        quality:         s.quality,
        motion:          s.adv.motion,
        broll:           s.adv.broll,
      };

      try {
        const generateStartTime = Date.now();
        let previewShown = false;

        /* Llamar al pipeline — SÍ await: orchestrate devuelve render_id rápido */
        const genRes = await C.api.generateVideo(settings);
        const currentRenderId = genRes?.render_id ?? null;
        console.log('[CARRETE] Nuevo render_id:', currentRenderId);

        /* Polling cada 3 segundos
         * Flujo paralelo:
         *   - output_url aparece (Fábrica 1 lista) → mostrar como preview, seguir esperando
         *   - layer2_url aparece (Fábrica 2 lista) → mostrar como final, parar
         *   - Si captions=false → parar cuando output_url aparece
         */
        pollTimer = setInterval(async () => {
          try {
            const status = await C.api.getPipelineStatus(currentRenderId);
            const elapsed = Date.now() - generateStartTime;
            const elapsedSec = elapsed / 1000;

            // Progreso gradual
            let displayPct;
            if (status.layer2_url) {
              displayPct = 100;
            } else if (status.status === 'done' && !s.captions) {
              displayPct = 100;
            } else if (status.status === 'done' && s.captions) {
              // Fábrica 1 lista, Fábrica 2 corriendo: 82% → 97%
              const fakePct = Math.min(97, 82 + (elapsedSec / 300) * 15);
              displayPct = Math.max(C.state.renderProgress || 82, fakePct);
            } else {
              // Renderizando: 5% → 90% en 5 min (sigue moviéndose mientras el render corre)
              const fakePct = Math.min(90, 5 + (elapsedSec / 300) * 85);
              displayPct = Math.max(C.state.renderProgress || 0, fakePct);
            }

            C.setState({ renderProgress: Math.round(displayPct) }, { render: false });
            document.querySelectorAll('.progress__fill').forEach(el => el.style.width = displayPct + '%');
            document.querySelectorAll('.gen-render__meta span:last-child').forEach(el => el.textContent = Math.round(displayPct) + '%');

            // ── FÁBRICA 2 LISTA → video final con subtítulos ──────────────────
            if (status.layer2_url) {
              clearInterval(pollTimer);
              C.setState({ downloadUrl: status.layer2_url, renderProgress: 100 });
              C.setState({ phase: 'done', renderProgress: 100, renderUrl: null, videoReady: false });
              startBlobDownload(status.layer2_url);
              return;
            }

            // ── FÁBRICA 1 LISTA → mostrar preview y seguir esperando Fábrica 2 ─
            if (status.status === 'done' && status.output_url) {
              if (!s.captions) {
                // Sin subtítulos: Fábrica 1 ES el resultado final
                clearInterval(pollTimer);
                C.setState({ downloadUrl: status.output_url, renderProgress: 100 });
                if (!C.state.renderUrl) {
                  C.setState({ phase: 'done', renderProgress: 100, renderUrl: null, videoReady: false });
                  startBlobDownload(status.output_url);
                }
                return;
              }

              // Con subtítulos: mostrar preview de Fábrica 1 mientras llega Fábrica 2
              if (!previewShown) {
                previewShown = true;
                console.log('[CARRETE] Preview de Fábrica 1 listo, esperando Fábrica 2...');
                C.setState({ phase: 'done', renderProgress: 82, renderUrl: null, videoReady: false, downloadUrl: null });
                startBlobDownload(status.output_url);
              }
              return; // Seguir polling para Fábrica 2
            }

            // ── ERROR ─────────────────────────────────────────────────────────
            if (status.status === 'error') {
              clearInterval(pollTimer);
              C.setState({ phase: 'idle', renderProgress: 0 });
              alert('Error al generar el video: ' + (status.error_message || status.error || 'Error desconocido.'));
              return;
            }

            // Timeout 15 min
            if (elapsed > 900000 && C.state.renderProgress < 100) {
              clearInterval(pollTimer);
              C.setState({ phase: 'idle', renderProgress: 0 });
              alert('El proceso tardó más de lo esperado. Es posible que el video esté listo — recarga la página en un momento para verlo.');
            }
          } catch(e) {
            console.error('[CARRETE] Error en polling:', e);
          }
        }, 3000);

      } catch (e) {
        console.error('[CARRETE] Error iniciando pipeline:', e);
        C.setState({ phase: 'idle', renderProgress: 0 });
        alert('Error al conectar con el servidor. Intenta de nuevo.');
      }
    },

    resetRender() {
      clearInterval(pollTimer);
      C.setState({ phase: 'idle', renderProgress: 0, renderUrl: null, videoReady: false });
    },

    videoCanPlay() {
      if (C.state.videoReady) return;           // ya listo, evitar loop
      C.state.videoReady = true;                // actualizar estado sin render
      // Manipular DOM directamente para no recrear el elemento <video>
      document.querySelectorAll('.js-video-overlay').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.js-video-player').forEach(el => {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.controls = true;
      });
    },

    /* ── GUARDAR MARCA ── */
    async saveBrand() {
      const s = C.state;
      try {
        await C.api.saveBrand({
          primary_color: s.brandColor,
          font: s.font,
          auto_apply: s.brandAuto,
        });
        C.setState({ brandSaved: true });
        clearTimeout(brandTimer);
        brandTimer = setTimeout(() => C.setState({ brandSaved: false }), 2400);
      } catch(e) {
        console.error('[CARRETE] Error guardando marca:', e);
      }
    },
  };
})();

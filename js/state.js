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
    captionGlow:         0,
    captionBold:         true,
    captionItalic:       false,
    captionUnderline:    false,
    music: 'synthwave',
    pacing: 64,
    clipGap: 30,        /* 0 = pegado, 100 = con aire (0.3s buffer) */
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
    impactEntrance: 'explosivo',
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
        captionOutlineColor:s.captionOutlineColor,
        captionOutlineSize: s.captionOutlineSize,
        captionShadow:      s.captionShadow,
        captionGlow:        s.captionGlow,
        captionBold:        s.captionBold,
        captionItalic:      s.captionItalic,
        captionUnderline:   s.captionUnderline,
        music:           s.music,
        musicVol:        s.musicVol,
        pacing:          s.pacing,
        clipGap:         s.clipGap,
        editMode:        s.editMode,
        font:            s.font,
        brandColor:      s.brandColor,
        impact:          s.impact,
        impactEntrance:  s.impactEntrance,
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

        /* Llamar al pipeline */
        C.api.generateVideo(settings); /* no await — es long-running */

        /* Polling cada 3 segundos */
        pollTimer = setInterval(async () => {
          try {
            const status = await C.api.getPipelineStatus();
            const pct = status.progress_pct || C.state.renderProgress;
            const elapsed = Date.now() - generateStartTime;
            C.setState({ renderProgress: Math.min(pct, 99) }, { render: false });
            document.querySelectorAll('.progress__fill').forEach(el => el.style.width = pct + '%');
            document.querySelectorAll('.gen-render__meta span:last-child').forEach(el => el.textContent = Math.round(pct) + '%');

            // ── PREVIEW LISTO (rápido) ────────────────────────────────────────
            if (status.preview_url && !previewShown && elapsed >= 10000) {
              previewShown = true;
              const previewUrl = status.preview_url;
              C.setState({ phase: 'done', renderProgress: 80, renderUrl: null, videoReady: false, downloadUrl: null });

              (async () => {
                try {
                  const resp = await fetch(previewUrl);
                  if (!resp.ok) throw new Error('HTTP ' + resp.status);
                  const total  = parseInt(resp.headers.get('content-length') || '0');
                  const reader = resp.body.getReader();
                  const chunks = [];
                  let loaded   = 0;
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    loaded += value.length;
                    if (total > 0) {
                      const dpct = Math.round(loaded / total * 100);
                      document.querySelectorAll('.js-download-pct')
                        .forEach(el => { el.textContent = 'Cargando preview... ' + dpct + '%'; });
                    }
                  }
                  const blob    = new Blob(chunks, { type: 'video/mp4' });
                  const blobUrl = URL.createObjectURL(blob);
                  C.setState({ renderUrl: blobUrl, videoReady: false });
                  setTimeout(() => { if (!C.state.videoReady) C.actions.videoCanPlay(); }, 800);
                } catch(e) {
                  console.warn('[CARRETE] Preview blob failed:', e.message);
                  C.setState({ renderUrl: previewUrl, videoReady: false });
                  setTimeout(() => { if (!C.state.videoReady) C.actions.videoCanPlay(); }, 5000);
                }
              })();
              return; /* seguir polling — esperar full quality */
            }

            // ── FULL QUALITY LISTO ────────────────────────────────────────────
            if (status.status === 'done' || status.output_url) {
              const isNewRender = status.output_url && status.output_url !== previousUrl;
              if (elapsed < 10000 || !isNewRender) return;
              clearInterval(pollTimer);

              /* Guardar URL de descarga HD */
              C.setState({ downloadUrl: status.output_url, renderProgress: 100 });

              if (C.state.renderUrl) {
                /* Preview ya visible — solo activar botón descarga HD */
                return;
              }

              /* Sin preview — descargar full quality y mostrarlo */
              const remoteUrl = status.output_url || null;
              C.setState({ phase: 'done', renderProgress: 100, renderUrl: null, videoReady: false });

              (async () => {
                try {
                  const resp = await fetch(remoteUrl);
                  if (!resp.ok) throw new Error('HTTP ' + resp.status);
                  const total  = parseInt(resp.headers.get('content-length') || '0');
                  const reader = resp.body.getReader();
                  const chunks = [];
                  let loaded   = 0;
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    loaded += value.length;
                    if (total > 0) {
                      const dpct = Math.round(loaded / total * 100);
                      document.querySelectorAll('.js-download-pct')
                        .forEach(el => { el.textContent = 'Descargando... ' + dpct + '%'; });
                    }
                  }
                  const blob    = new Blob(chunks, { type: 'video/mp4' });
                  const blobUrl = URL.createObjectURL(blob);
                  C.setState({ renderUrl: blobUrl, videoReady: false });
                  setTimeout(() => { if (!C.state.videoReady) C.actions.videoCanPlay(); }, 800);
                } catch(e) {
                  console.warn('[CARRETE] Blob download failed, using direct URL:', e.message);
                  C.setState({ renderUrl: remoteUrl, videoReady: false });
                  setTimeout(() => { if (!C.state.videoReady) C.actions.videoCanPlay(); }, 5000);
                }
              })();
            } else if (status.status === 'error') {
              clearInterval(pollTimer);
              C.setState({ phase: 'idle', renderProgress: 0 });
              alert('Error al generar el video: ' + (status.error_message || status.error || 'Error desconocido. Verifica que hayas subido videos y que estén procesados.'));
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

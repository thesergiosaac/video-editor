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
    captionStyle: 'pop',
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
    videoBlobUrl: null,
    videoLoadProgress: 0,
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
      C.setState({ phase: 'rendering', renderProgress: 2, renderUrl: null });

      /* Recoger todos los parámetros del sidebar */
      const s = C.state;
      const settings = {
        aspect:          s.aspect,
        style:           s.style,
        captions:        s.captions,
        captionStyle:    s.captionStyle,
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

            if (status.status === 'done' || status.output_url) {
              /* Ignorar "done" si es el render viejo (misma URL) o si pasaron menos de 10s */
              const isNewRender = status.output_url && status.output_url !== previousUrl;
              if (elapsed < 10000 || !isNewRender) return; /* seguir esperando */
              clearInterval(pollTimer);
              const newUrl = status.output_url || null;
              // Revocar blob anterior si existe
              if (C.state.videoBlobUrl) { URL.revokeObjectURL(C.state.videoBlobUrl); }
              C.setState({ phase: 'downloading', renderProgress: 100, renderUrl: newUrl, videoBlobUrl: null, videoLoadProgress: 0, videoReady: false });
              if (newUrl) C.actions.downloadVideoBlob(newUrl);
            } else if (status.status === 'error') {
              clearInterval(pollTimer);
              C.setState({ phase: 'idle', renderProgress: 0 });
              alert('Error al generar el video: ' + (status.error || 'desconocido'));
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
      if (C.state.videoBlobUrl) { URL.revokeObjectURL(C.state.videoBlobUrl); }
      C.setState({ phase: 'idle', renderProgress: 0, renderUrl: null, videoBlobUrl: null, videoLoadProgress: 0, videoReady: false });
    },

    async downloadVideoBlob(url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch ' + res.status);
        const total = parseInt(res.headers.get('Content-Length') || '0');
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total) {
            const pct = Math.round((received / total) * 100);
            C.state.videoLoadProgress = pct;
            document.querySelectorAll('.video-dl-bar').forEach(el => el.style.width = pct + '%');
            document.querySelectorAll('.video-dl-pct').forEach(el => el.textContent = pct + '%');
          }
        }
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);
        C.setState({ phase: 'done', videoBlobUrl: blobUrl, videoLoadProgress: 100, videoReady: true });
      } catch (e) {
        console.error('[CARRETE] Error descargando blob, usando streaming:', e);
        // Fallback: streaming normal
        C.setState({ phase: 'done', videoBlobUrl: null, videoLoadProgress: 100, videoReady: true });
      }
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

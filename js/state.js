/* state.js — estado único + acciones conectadas al backend real */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const U = C.util;

  C.state = {
    /* reproducción (sin video: vista simulada del diseño; con video: el reproductor real) */
    playing: false,
    progress: 0,
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
    /* plantillas de subtítulos (17-sep): editorial · contraste · dorado · cinematico · firma · premium · simple */
    subsPlantilla:    'editorial',
    subsModo:         'todo',      /* 'todo' | 'impacto' (plantilla solo en las frases más llamativas; el resto «a tu gusto») */
    subsImpacto:      'medio',     /* pocas · medio · muchas */
    /* «a tu gusto» (sin animaciones en medio) */
    simpleLetra:      'montserrat-extrabold',
    simpleCq:         6.4,
    simpleColor:      '#ffffff',
    simpleBorde:      false,
    simpleBordeColor: '#000000',
    simpleBordeCq:    0.5,
    simpleSombra:     true,
    simpleMayus:      false,
    simplePos:        'abajo',
    simpleEntrada:    'suave',
    simpleSalida:     'suave',
    music: 'synthwave',
    pacing: 64,
    clipGap: 50,        /* 0 = sin aire, 50 = actual (80ms), 100 = mucho aire (1s+) */
    clipStart: 100,     /* 100 = sin recorte, 0 = recortar hasta 2s del inicio */
    adv: { motion: true, sfx: false, broll: true, fourk: false },
    /* módulo de configuración y menús */
    openCard: null,
    projOpen: false,
    userOpen: false,
    projects: [],
    perfil: null,
    /* texto */
    scriptOpen: false,
    scriptText: '',
    editMode: 'guion',
    font: 'outfit',
    brandColor: '#FF2D8A',
    /* movimiento */
    transition: 'corte',
    zoomType: 'suave',
    zoomFreq: 45,
    layers: true,
    /* audio */
    musicVol: 60,
    voiceVol: 100,
    sfxVol: 70,
    sfxOn: false,
    sfxOpen: false,
    sfxCat: 'whoosh',
    /* recursos */
    duration: '30',
    quality: '1080',
    visualsOpen: false,
    visualsCat: 'naturaleza',
    /* marca */
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
    /* gráficos F3 */
    graphicsCombo:     'Creativ',
    graphicsHeroColor: '#ffffff',
    graphicsSupColor:  '#dedad4',
    graphicsBg:        'Papel',
    graphicsGrain:     true,
    graphicsLowFps:    false,
    graphicsPaper:     true,
    /* editar resultado */
    resultEdit: false,
    selTrack: 'subs',
    renderId: null,
    editorData: null,
    editorTranscript: [],
    editorScenes: [],
    editorSelScene: null,
    editorSubs: null,        /* { plantilla, palabras[], frases[] } que usó el generador: se editan frase por frase */
    editorFraseSel: 0,
    editorMarcadas: [],      /* frases marcadas para darles un estilo de una vez */
    editorUltimaMarca: null,
    editorGuardado: null,    /* null · pendiente · guardando · guardado · error */
    editorExportRapido: false,
    editorVideoUrl: null,
    editorExporting: false,
    editorExportProgress: 0,
    editorExportDone: false,
  };

  C.setState = function (patch, opts) {
    Object.assign(C.state, patch);
    if (!opts || opts.render !== false) C.render();
  };
  C.toggle = function (key) { C.state[key] = !C.state[key]; C.render(); };
  C.toggleAdv = function (k) { C.state.adv[k] = !C.state.adv[k]; C.render(); };

  /* Reproductor real de la vista previa (el <video> que guarda C.videoFijo) */
  C.videoVista = () => {
    const v = C.videoFijo.get('vista');
    return v && C.state.renderUrl && v.getAttribute('src') === C.urlVideo(C.state.renderUrl) ? v : null;
  };

  /* Actualizaciones en vivo SIN redibujar (mantienen foco, arrastre y lo que se está viendo) */
  C.live = {
    /* posición de reproducción: 0..1 sobre la duración */
    progress(p, durSec) {
      C.state.progress = p;
      const dur = durSec || 24;
      document.querySelectorAll('.js-bar').forEach((e) => (e.style.width = p * 100 + '%'));
      document.querySelectorAll('.js-tc').forEach((e) => (e.textContent = U.fmtTime(p * dur)));
      document.querySelectorAll('.js-scrub').forEach((e) => { if (document.activeElement !== e) e.value = Math.round(p * 1000); });
    },
    playing(on) {
      C.state.playing = on;
      document.querySelectorAll('.js-play-icon').forEach((e) => {
        e.className = 'js-play-icon ' + (on ? 'pause' : 'tri tri--dark');
        e.innerHTML = on ? '<i></i><i></i>' : '';
      });
      document.querySelectorAll('.js-screen-play').forEach((e) => (e.style.display = on ? 'none' : 'flex'));
    },
    total(durSec) {
      document.querySelectorAll('.js-total').forEach((e) => (e.textContent = U.fmtTime(durSec)));
    },
  };

  let playTimer   = null;
  let pollTimer   = null;
  let brandTimer  = null;
  /* Editor de subtítulos: historial para deshacer/rehacer y guardado automático */
  const historialSubs = { atras: [], adelante: [] };
  let guardadoTimer = null;
  C.historialSubs = historialSubs;
  function marcarGuardado(estado) {
    C.state.editorGuardado = estado;
    const textos = { pendiente: 'Cambios sin guardar…', guardando: 'Guardando…', guardado: '✓ Guardado', error: '⚠ No se guardó · reintentar' };
    document.querySelectorAll('.js-ed-guardado').forEach((el) => {
      el.textContent = textos[estado] || '';
      el.className = 'ed-guardado js-ed-guardado' + (estado ? ' ed-guardado--' + estado : '');
    });
    document.querySelectorAll('.js-ed-deshacer').forEach((el) => { el.disabled = !historialSubs.atras.length; });
    document.querySelectorAll('.js-ed-rehacer').forEach((el) => { el.disabled = !historialSubs.adelante.length; });
  }

  // Streaming directo: el navegador carga solo lo que necesita para reproducir
  async function startBlobDownload(s3Url) {
    C.setState({ renderUrl: s3Url, videoReady: false });
    setTimeout(() => { if (!C.state.videoReady) C.actions.videoCanPlay(); }, 8000);
  }

  C.actions = {
    /* Play/pausa: con video real controla el <video>; sin video, la vista simulada del diseño */
    togglePlay() {
      const v = C.videoVista();
      if (v) {
        if (v.paused) v.play().catch(() => null); else v.pause();
        return;
      }
      const playing = !C.state.playing;
      clearInterval(playTimer);
      if (playing) {
        playTimer = setInterval(() => {
          let p = C.state.progress + 0.0045;
          if (p >= 1) p = 0;
          C.live.progress(p);
        }, 60);
      }
      C.setState({ playing });
    },

    /* Barra de avance: 0..1 */
    setProgress(p) {
      const v = C.videoVista();
      if (v && v.duration) { v.currentTime = p * v.duration; C.live.progress(p, v.duration); return; }
      C.live.progress(p);
    },

    /* ── GENERAR VIDEO — conectado al backend real ── */
    async generate() {
      if (C.state.phase === 'rendering') return;
      if (!C.apiReady) { alert('Conectando con el servidor…'); return; }

      clearInterval(pollTimer);
      C.setState({ phase: 'rendering', renderProgress: 2, renderUrl: null, downloadUrl: null });

      /* Recoger todos los parámetros de configuración */
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
        transition:      s.transition,
        zoomType:        s.zoomType,
        zoomFreq:        s.zoomFreq,
        layers:          s.layers,
        sfxOn:           s.sfxOn,
        duration:        s.duration,
        quality:         s.quality,
        motion:          s.adv.motion,
        broll:           s.adv.broll,
        graphicsCombo:     s.graphicsCombo,
        graphicsHeroColor: s.graphicsHeroColor,
        graphicsSupColor:  s.graphicsSupColor,
        graphicsBg:        s.graphicsBg,
        graphicsGrain:     s.graphicsGrain,
        graphicsLowFps:    s.graphicsLowFps,
        graphicsPaper:     s.graphicsPaper,
        /* plantilla de subtítulos + «a tu gusto»: la IA marca frases y palabra clave en el servidor */
        subtitulos:        s.captions ? C.subs.config(s) : null,
      };

      const pintarProgreso = (pct) => {
        C.state.renderProgress = Math.round(pct);
        document.querySelectorAll('.js-render-bar').forEach((el) => (el.style.width = pct + '%'));
        document.querySelectorAll('.js-render-pct').forEach((el) => (el.textContent = Math.round(pct) + '%'));
        document.querySelectorAll('.js-render-stage').forEach((el) => (el.textContent = U.renderStage(pct)));
      };

      try {
        const generateStartTime = Date.now();
        let previewShown = false;

        /* Llamar al pipeline — orchestrate devuelve render_id rápido */
        const genRes = await C.api.generateVideo(settings);
        const currentRenderId = genRes?.render_id ?? null;
        console.log('[CARRETE] Nuevo render_id:', currentRenderId);

        /* Polling cada 3 segundos: el progreso sale del tiempo transcurrido */
        pollTimer = setInterval(async () => {
          try {
            const status = await C.api.getPipelineStatus(currentRenderId);
            const elapsed = Date.now() - generateStartTime;
            const elapsedSec = elapsed / 1000;

            let displayPct;
            if (status.layer2_url) {
              displayPct = 100;
            } else if (status.status === 'done' && !s.captions) {
              displayPct = 100;
            } else if (status.status === 'done' && s.captions) {
              const fakePct = Math.min(97, 82 + (elapsedSec / 300) * 15);
              displayPct = Math.max(C.state.renderProgress || 82, fakePct);
            } else {
              const fakePct = Math.min(90, 5 + (elapsedSec / 300) * 85);
              displayPct = Math.max(C.state.renderProgress || 0, fakePct);
            }
            pintarProgreso(displayPct);

            // ── Video final con subtítulos ──
            if (status.layer2_url && status.layer2_url.startsWith('https://')) {
              clearInterval(pollTimer);
              C.setState({ downloadUrl: status.layer2_url, renderProgress: 100 }, { render: false });
              C.setState({ phase: 'done', renderProgress: 100, renderUrl: null, videoReady: false, renderId: currentRenderId, editorData: null, editorTranscript: [], editorScenes: [] });
              startBlobDownload(status.layer2_url);
              return;
            }

            // ── Primer resultado sin subtítulos ──
            if (status.status === 'done' && status.output_url) {
              if (!s.captions) {
                clearInterval(pollTimer);
                C.setState({ downloadUrl: status.output_url, renderProgress: 100 }, { render: false });
                if (!C.state.renderUrl) {
                  C.setState({ phase: 'done', renderProgress: 100, renderUrl: null, videoReady: false });
                  startBlobDownload(status.output_url);
                }
                return;
              }
              if (!previewShown) {
                previewShown = true;
                console.log('[CARRETE] Preview listo, esperando subtítulos...');
                C.setState({ phase: 'done', renderProgress: 82, renderUrl: null, videoReady: false, downloadUrl: null });
                startBlobDownload(status.output_url);
              }
              return;
            }

            // ── Error ──
            if (status.status === 'error') {
              clearInterval(pollTimer);
              C.setState({ phase: 'idle', renderProgress: 0 });
              alert('Error al generar el video: ' + (status.error_message || status.error || 'Error desconocido.'));
              return;
            }

            // Tope de 15 min
            if (elapsed > 900000 && C.state.renderProgress < 100) {
              clearInterval(pollTimer);
              C.setState({ phase: 'idle', renderProgress: 0 });
              alert('El proceso tardó más de lo esperado. Es posible que el video esté listo — recarga la página en un momento para verlo.');
            }
          } catch (e) {
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
      if (C.state.videoReady) return;
      C.state.videoReady = true;
      // DOM directo para no recrear nada mientras carga
      document.querySelectorAll('.js-video-overlay').forEach((el) => (el.style.display = 'none'));
      document.querySelectorAll('.js-video-player').forEach((el) => { el.style.opacity = '1'; });
    },

    /* ── Módulo de configuración ── */
    openCard(k) { C.setState({ openCard: k, projOpen: false, userOpen: false }); },
    backToGrid() { C.setState({ openCard: null }); },

    /* ── Menús de la barra superior (se excluyen entre sí) ── */
    toggleProj() { C.setState({ projOpen: !C.state.projOpen, userOpen: false }); },
    toggleUser() { C.setState({ userOpen: !C.state.userOpen, projOpen: false }); },
    closeMenus() { C.setState({ projOpen: false, userOpen: false }); },

    menuUsuario(id) {
      if (id === 'salir') { C.setState({ userOpen: false }); C.api.logout(); return; }
      if (id === 'marca') { C.setState({ userOpen: false, openCard: 'marca' }); return; }
      if (id === 'proyectos') { C.setState({ userOpen: false, projOpen: true }); return; }
      C.setState({ userOpen: false });
    },

    /* ── Proyectos ── */
    async cambiarProyecto(id) {
      if (!id || id === C.session.projectId) { C.setState({ projOpen: false }); return; }
      clearInterval(pollTimer);
      C.session.projectId = id;
      C.api.recordarProyecto(id);
      C.setState({
        projOpen: false, clips: [], scriptText: '', phase: 'idle', renderProgress: 0,
        renderUrl: null, downloadUrl: null, videoReady: false, renderId: null, resultEdit: false,
      });
      if (C.cargarProyecto) C.cargarProyecto();
    },

    async nuevoProyecto() {
      const n = (C.state.projects || []).length + 1;
      const nuevo = await C.api.createProject('Proyecto ' + n);
      if (!nuevo || !nuevo.id) { C.setState({ projOpen: false }); return; }
      const lista = await C.api.getProjects();
      C.setState({ projects: Array.isArray(lista) ? lista : [] }, { render: false });
      await C.actions.cambiarProyecto(nuevo.id);
    },

    /* ── ABRIR EDITOR DE RESULTADO ── */
    async openEditor() {
      // El editor tiene su propio reproductor: pausar el de la vista previa para no reproducir dos
      document.querySelectorAll('.js-video-player').forEach((v) => { try { v.pause(); } catch (_) {} });
      C.setState({
        resultEdit: true,
        editorData: null,
        editorTranscript: [],
        editorScenes: [],
        editorSelScene: null,
        editorSubs: null,
        editorFraseSel: 0,
        editorMarcadas: [],
        editorUltimaMarca: null,
        editorVideoUrl: C.state.downloadUrl || C.state.renderUrl || null,
        editorExporting: false,
        editorExportDone: false,
      });
      const rid = C.state.renderId;
      if (rid && C.apiReady) {
        try {
          const data = await C.api.getRenderData(rid);
          if (data) {
            const scenes = (data.graphics_json && Array.isArray(data.graphics_json.scenes))
              ? data.graphics_json.scenes.map((sc) => Object.assign({}, sc))
              : [];
            const transcript = Array.isArray(data.clean_words_json) ? data.clean_words_json : [];
            // Frases con palabra clave que usó el generador (renders desde el 17-sep); si hay una edición guardada, esa manda
            const sp = data.subtitle_phrases;
            const ed = data.subtitle_edits;
            const hayFrases = sp && Array.isArray(sp.palabras) && Array.isArray(sp.frases) && sp.frases.length;
            const edicionValida = hayFrases && ed && Array.isArray(ed.palabras) && Array.isArray(ed.frases) &&
              ed.frases.length && ed.palabras.length === sp.palabras.length;
            const fuente = edicionValida ? ed : sp;
            const subs = hayFrases
              ? {
                  plantilla: (edicionValida && ed.plantilla) || (data.subtitle_config && data.subtitle_config.plantilla) || sp.plantilla || C.state.subsPlantilla,
                  palabras: fuente.palabras,
                  frases: fuente.frases.map((f) => Object.assign({}, f, { clave: (f.clave || []).slice() })),
                }
              : null;
            // «A tu gusto» de ESTE video (el guardado o el que usó al generarse) → controles, para que la vista y exportar coincidan
            const simple = C.subs.simpleAEstado((edicionValida && ed.simple) || (data.subtitle_config && data.subtitle_config.simple));
            historialSubs.atras = []; historialSubs.adelante = [];
            C.setState(Object.assign({}, simple || {}, {
              editorData: data,
              editorScenes: scenes,
              editorTranscript: transcript,
              editorSubs: subs,
              editorFraseSel: 0,
              editorGuardado: edicionValida ? 'guardado' : null,
              // Con edición de frases y video sin subtítulos: vista en vivo (los subtítulos se dibujan encima)
              editorVideoUrl: (subs && data.video_sin_subtitulos) || data.layer2_url || data.output_url || C.state.downloadUrl || null,
            }));
          }
        } catch (e) {
          console.error('[CARRETE editor] Error cargando datos:', e);
        }
      }
    },

    /* ── Edición de subtítulos: todo cambio pasa por aquí (deshacer/rehacer + guardado automático) ── */
    editarSubs(nuevo, extra) {
      const s = C.state;
      if (!s.editorSubs || !nuevo || nuevo === s.editorSubs) return;
      historialSubs.atras.push(s.editorSubs);
      if (historialSubs.atras.length > 80) historialSubs.atras.shift();
      historialSubs.adelante = [];
      C.setState(Object.assign({ editorSubs: nuevo }, extra || {}));
      C.actions.programarGuardado();
    },
    deshacer() {
      const s = C.state;
      if (!historialSubs.atras.length || !s.editorSubs) return;
      historialSubs.adelante.push(s.editorSubs);
      C.setState({ editorSubs: historialSubs.atras.pop() });
      C.actions.programarGuardado();
    },
    rehacer() {
      const s = C.state;
      if (!historialSubs.adelante.length || !s.editorSubs) return;
      historialSubs.atras.push(s.editorSubs);
      C.setState({ editorSubs: historialSubs.adelante.pop() });
      C.actions.programarGuardado();
    },
    programarGuardado() {
      clearTimeout(guardadoTimer);
      marcarGuardado('pendiente');
      guardadoTimer = setTimeout(() => C.actions.guardarEdicionAhora(), 900);
    },
    async guardarEdicionAhora() {
      clearTimeout(guardadoTimer);
      const s = C.state;
      if (!s.editorSubs || !s.renderId) return;
      const renderId = s.renderId, subs = s.editorSubs;
      marcarGuardado('guardando');
      try {
        await C.api.guardarEdicion(renderId, {
          plantilla: subs.plantilla, palabras: subs.palabras, frases: subs.frases,
          simple: C.subs.simpleDe(s), guardado_en: new Date().toISOString(),
        });
        // Si mientras tanto hubo otro cambio, queda pendiente el siguiente guardado
        if (C.state.editorSubs === subs) marcarGuardado('guardado');
      } catch (e) {
        console.error('[CARRETE editor] No se guardó la edición:', e);
        marcarGuardado('error');
      }
    },

    /* ── EXPORTAR CON EDITS ── */
    async exportWithEdits() {
      const s = C.state;
      if (s.editorExporting) return;
      // Exportar rápido si este video tiene su base sin subtítulos: solo se rehacen los subtítulos
      const rapido = !!(s.editorSubs && s.editorData && s.editorData.video_sin_subtitulos && s.renderId);
      if (s.editorSubs && (s.editorGuardado === 'pendiente' || s.editorGuardado === 'error')) await C.actions.guardarEdicionAhora();
      C.setState({ editorExporting: true, editorExportProgress: 2, editorExportDone: false, editorExportRapido: rapido });
      try {
        const scenesOverride = (s.editorScenes && s.editorScenes.length > 0)
          ? s.editorScenes.map((sc) => ({ timestamp_ms: sc.timestamp_ms, hero: sc.hero, support: sc.support, theme: sc.theme || '' }))
          : null;
        // Subtítulos: con las frases editadas (estilo y palabra clave de cada una) o, si el video es anterior, con la plantilla elegida
        const subtitulos = s.editorSubs
          ? {
              plantilla: s.editorSubs.plantilla,
              simple: C.subs.simpleDe(s),
              frases: s.editorSubs.frases,
              num_palabras: s.editorSubs.palabras.length,
              // Palabras corregidas (las que arregló la IA y las que se corrigieron a mano): { índice: texto }
              textos: s.editorSubs.palabras.reduce((acc, w, i) => { if (w.original != null) acc[i] = w.word; return acc; }, {}),
            }
          : C.subs.config(s);
        const res = await C.api.reExportWithEdits(scenesOverride, null, {
          captionStyle: s.captionStyle, captionPosition: s.captionPosition, combo: s.graphicsCombo,
          heroColor: s.graphicsHeroColor, supColor: s.graphicsSupColor, bg: s.graphicsBg,
          subtitulos,
          reusarRender: rapido ? s.renderId : null,
        });
        const newRenderId = res && res.render_id;
        if (!newRenderId) throw new Error('No render_id en respuesta');
        console.log('[CARRETE editor] Re-export render_id:', newRenderId, res.rapido ? '(rápido)' : '(completo)');
        const paso = res.rapido ? 3.5 : 1.6;   // ~1,5 min rápido · ~3 min completo
        const poll = setInterval(async () => {
          try {
            const st = await C.api.getPipelineStatus(newRenderId);
            if (st.layer2_url) {
              clearInterval(poll);
              // El editor sigue abierto con el video nuevo (y su edición, vista en vivo y exportar rápido)
              C.setState({
                downloadUrl: st.layer2_url, renderUrl: null, videoReady: false, renderId: newRenderId,
                editorExportProgress: 100,
              }, { render: false });
              startBlobDownload(st.layer2_url);
              await C.actions.openEditor();
              C.setState({ editorExporting: false, editorExportDone: true });
            } else if (st.status === 'error') {
              clearInterval(poll);
              C.setState({ editorExporting: false, editorExportProgress: 0 });
              alert('Error al exportar: ' + (st.error_message || 'desconocido'));
            } else {
              const pct = Math.min(95, (C.state.editorExportProgress || 2) + paso);
              C.state.editorExportProgress = pct;
              document.querySelectorAll('.js-export-pct').forEach((el) => (el.textContent = 'Exportando ' + Math.round(pct) + '%…'));
            }
          } catch (e) { console.error('[CARRETE editor] poll error:', e); }
        }, 3000);
      } catch (e) {
        console.error('[CARRETE editor] export error:', e);
        C.setState({ editorExporting: false, editorExportProgress: 0 });
        alert('Error al exportar: ' + e.message);
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
        brandTimer = setTimeout(() => C.setState({ brandSaved: false }), 2600);
      } catch (e) {
        console.error('[CARRETE] Error guardando marca:', e);
      }
    },
  };
})();

/* ============================================================
   state.js — estado único + acciones.
   - C.state: objeto de estado
   - C.setState(patch, {render})  -> aplica cambios y re-renderiza (salvo render:false)
   - C.actions: handlers de alto nivel (play, generate, etc.)
   - C.live: actualizaciones directas de DOM para cosas continuas
     (barra de progreso, timecode) sin re-render completo, para no
     interrumpir el arrastre de sliders ni el foco de textareas.
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const { fmtTime } = C.util;

  C.state = {
    // reproducción
    playing: false,
    progress: 0.34,
    // configuración base
    aspect: '9:16',
    style: 'sunset',
    captions: true,
    captionStyle: 'pop',
    music: 'synthwave',
    pacing: 64,
    advanced: false,
    adv: { motion: true, sfx: false, broll: true, fourk: false },
    // pestañas
    tab: 'edicion',
    // texto
    scriptOpen: false,
    scriptText: 'Hace un año no sabía editar. Hoy publico a diario sin tocar una sola pista. Te cuento cómo lo hago en 30 segundos…',
    editMode: 'guion',
    font: 'syne',
    brandColor: '#FF5A1F',
    impact: true,
    impactEntrance: 'explosivo',
    // movimiento
    transition: 'corte',
    zoomType: 'suave',
    zoomFreq: 45,
    // audio
    musicVol: 60,
    sfxOn: false,
    sfxOpen: false,
    sfxCat: 'whoosh',
    // recursos
    duration: '30',
    quality: '1080',
    visualsOpen: false,
    visualsCat: 'naturaleza',
    // capas / marca
    layers: true,
    brandAuto: true,
    brandSaved: false,
    // render
    phase: 'idle', // idle | rendering | done
    renderProgress: 0,
    // editar resultado
    resultEdit: false,
    selTrack: 'subs',
  };

  // Aplica un patch y re-renderiza por defecto.
  C.setState = function (patch, opts) {
    Object.assign(C.state, patch);
    if (!opts || opts.render !== false) C.render();
  };
  C.toggle = function (key) {
    C.state[key] = !C.state[key];
    C.render();
  };
  C.toggleAdv = function (k) {
    C.state.adv[k] = !C.state.adv[k];
    C.render();
  };

  // ---- actualizaciones "en vivo" sin re-render (para fluidez) ----
  C.live = {
    progress(p) {
      document.querySelectorAll('.js-bar').forEach((e) => (e.style.width = p * 100 + '%'));
      document.querySelectorAll('.js-tc').forEach((e) => (e.textContent = fmtTime(p * 24)));
    },
  };

  let playTimer = null;
  let renderTimer = null;
  let brandTimer = null;

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
          C.live.progress(p); // solo DOM, sin re-render
        }, 60);
      }
      C.render(); // cambia el icono play/pausa y el overlay
    },

    setProgress(v) {
      C.state.progress = v;
      C.live.progress(v); // arrastre fluido del scrubber
    },

    generate() {
      if (C.state.phase === 'rendering') return;
      clearInterval(renderTimer);
      const start = Date.now();
      const DUR = 4000; // progreso por tiempo transcurrido => completa aunque el timer se estrangule
      C.setState({ phase: 'rendering', renderProgress: 0 });
      renderTimer = setInterval(() => {
        const pct = Math.min(100, ((Date.now() - start) / DUR) * 100);
        if (pct >= 100) {
          clearInterval(renderTimer);
          C.setState({ renderProgress: 100, phase: 'done' });
        } else {
          C.setState({ renderProgress: pct });
        }
      }, 120);
    },

    resetRender() {
      C.setState({ phase: 'idle', renderProgress: 0 });
    },

    saveBrand() {
      C.setState({ brandSaved: true });
      clearTimeout(brandTimer);
      brandTimer = setTimeout(() => C.setState({ brandSaved: false }), 2400);
    },
  };
})();

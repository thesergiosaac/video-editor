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
    /* ajustes de la plantilla (17-sep): tamaño de letra y qué tan arriba o abajo va el bloque */
    subsEscala:       1,           /* 0,7 a 1,5 — multiplica las letras de la plantilla */
    subsDy:           0,           /* -45 a +45 puntos del alto del video: negativo = más arriba */
    subsDx:           0,           /* -35 a +35 puntos del ancho: negativo = a la izquierda */
    /* «a tu gusto» (sin animaciones en medio) */
    simpleLetra:      'montserrat-extrabold',
    simpleCq:         6.4,
    simpleColor:      '#ffffff',
    simpleBorde:      false,
    simpleBordeColor: '#000000',
    simpleBordeCq:    0.5,
    simpleSombra:     true,
    simpleMayus:      false,
    simpleItalica:    false,      /* letra inclinada en «a tu gusto» */
    simpleAlto:       1.2,        /* interlineado (18-sep): alto de cada renglón, en veces la letra */
    simpleEsp:        0,          /* interletrado (18-sep): espacio entre letras, en em */
    subsZona:         false,      /* zona segura (18-sep): ningún subtítulo debajo de los botones de las redes */
    subsColores:      {},         /* colores propios de cada plantilla (18-sep): { contraste: { texto, acento } } */
    pestanas:         {},         /* pestaña elegida en cada módulo (18-sep): { texto: 'plantilla' } */
    grupos:           {},         /* grupo plegable abierto en cada módulo (uno a la vez) */
    /* palabra resaltada (17-sep): la clave que ya marca la IA, pintada como quiera la persona */
    simpleClaveOn:        false,
    simpleClaveCada:      1,           /* 1 = en todas las frases · 2, 3, 5 = una de cada tantas */
    simpleClaveColor:     '#FFC93C',
    simpleClaveEscala:    1,           /* tamaño respecto al resto de la frase */
    simpleClaveLetra:     '',          /* vacío = la misma letra */
    simpleClaveNegrilla:  false,
    simpleClaveItalica:   false,
    simpleClaveSubrayado: false,
    simplePos:        'abajo',
    simpleEntrada:    'suave',
    simpleSalida:     'suave',
    music: 'synthwave',
    pacing: 64,
    clipGap: 50,        /* 0 = sin aire, 50 = actual (80ms), 100 = mucho aire (1s+) */
    clipStart: 100,     /* 100 = sin recorte, 0 = recortar hasta 2s del inicio */
    aire: 0.12,         /* 19-sep: segundos de silencio a cada lado de un corte (0 = pegado, máx. 0,5) */
    adv: { motion: true, sfx: false, broll: true, fourk: false },
    /* vista «como se ve publicado»: la interfaz de Instagram encima del celular */
    igVista: false,
    /* pantalla de inicio (18-sep-2026): 'inicio' = las herramientas (inicio.js), 'editor' = las 3 zonas */
    pantalla: 'inicio',
    inicioProyectos: [],
    inicioCargado: false,
    inicioSeccion: 'herramientas',   // 'herramientas' | 'proyectos' (Mis proyectos y el buscador)
    inicioBuscar: '',
    inicioMenu: false,               // menú de la cuenta (avatar)
    inicioModo: null,                // 'noche' | 'papel' (se recuerda en este navegador)
    /* color del video (17-sep): looks tipo DaVinci, un LUT que aplica el ensamblador */
    look: 'ninguno',
    lookFuerza: 100,
    /* revelado: limpia el material (velo, balance, exposición) antes del look. Va encendido. */
    revelado: true,
    /* ajustes del look (18-sep): -100 a +100, 0 = el look tal cual. Ver motor-color.js › AJUSTES */
    aj_luz: 0, aj_contraste: 0, aj_dorado: 0, aj_sombras: 0, aj_piel: 0, aj_vineta: 0,
    /* módulo de configuración y menús */
    openCard: null,
    projOpen: false,
    userOpen: false,
    projects: [],
    perfil: null,
    /* texto */
    scriptOpen: false,
    scriptText: '',
    // 20-sep · regenerar gráficos: cuáles marcó la persona para cambiar, y el aviso de la última vez
    grafCambiar: [], grafPidiendo: false, grafAviso: '',
    // 20-sep · lo que la persona fija desde el guion: {graficos:{si,no}, escenas:{si,no}} en nums de palabra
    guionFijos: {},
    // 20-sep · «detrás de ti»: los gráficos pasan por detrás de la persona (Cherry la recorta)
    grafDetras: false,
    editMode: 'guion',
    /* 23-sep (Sergio): «si yo subo un video que yo mismo recorté ya listo, Cherry lo corta y quita
       partes». Encendido, el video entra ENTERO y solo se le pone lo de encima: subtítulos, color,
       gráficos, escenas y movimiento. */
    sinCortes: false,
    font: 'outfit',
    brandColor: '#FF2D8A',
    /* movimiento de cámara (19-sep): qué efectos, curva de velocidad e intensidad; el director de movimiento.js decide dónde */
    movEfectos: { lento: true, aleja: true, golpe: true, impacto: true, mano: false, sacude: false },
    movCurva: 'suave',
    movIntensidad: 'media',
    /* escenas de apoyo (19-sep): apagadas hasta que la persona las pida */
    escenasOn: false,
    escenasCantidad: 'medio',
    /* gráficos (19-sep): apagados hasta que la persona los pida */
    grafOn: false,
    grafCantidad: 'medio',
    grafColor: 'cherry',
    grafEstilo: 'clasico',        // 'premium' = los dibuja Remotion (más movimiento y vidrio de verdad)
    /* la pista «Zoom» del editor del resultado (todavía de muestra) los usa */
    zoomType: 'suave',
    zoomFreq: 45,
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
    /* Los clips que no subieron, para decirlo al acabar en vez de perderlo en la consola. */
    subidaAviso: '',
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
    previaEnfoque: null,     /* 'simple' mientras se ajusta «a tu gusto»: la vista del celular muestra solo frases normales */
    fondoPrevia: null,       /* video sin subtítulos del último render: fondo de la vista previa */
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

  /* Lo que viaja al servidor en `color`. El revelado es aparte del look: puede ir
     solo (limpiar sin pintar), y por eso se manda también cuando no hay look.
     Si todo está por defecto (revelado encendido, sin look) no se manda nada. */
  C.colorCfg = function () {
    const s = C.state;
    const look = s.look && s.look !== 'ninguno' ? s.look : null;
    if (!look && s.revelado !== false) return null;
    const cfg = { revelado: s.revelado !== false };
    if (look) {
      cfg.look = look;
      cfg.intensidad = (Number(s.lookFuerza) || 100) / 100;
      /* solo los ajustes que se movieron */
      const aj = {};
      C.ajustesLook().forEach((k) => { const v = Number(s['aj_' + k]) || 0; if (v) aj[k] = v; });
      if (Object.keys(aj).length) cfg.ajustes = aj;
    }
    return cfg;
  };
  /* Movimiento de cámara (19-sep): lo que viaja al servidor. Siempre un objeto: sin efectos = sin movimiento
     (así el camino rápido no hereda el del video anterior). `ritmo` = el Ritmo de Edición (el director lo usa). */
  C.movCfg = function () {
    const s = C.state, ef = s.movEfectos || {};
    return {
      efectos: ['lento', 'aleja', 'golpe', 'impacto', 'mano', 'sacude'].filter((k) => ef[k]),
      curva: s.movCurva || 'suave', intensidad: s.movIntensidad || 'media', ritmo: Number(s.pacing) || 50,
    };
  };
  /* Escenas de apoyo (19-sep): lo que viaja al servidor. Apagadas = objeto vacío (así el camino rápido no hereda). */
  /* Lo que la persona fijó en el guion (20-sep). Viaja dentro de los ajustes para que la vista previa
     y el ensamblador vean lo mismo. Vacío = Cherry decide sola, como siempre. */
  C.fijosDe = function (que) {
    const f = (C.state.guionFijos || {})[que] || {};
    const si = Array.isArray(f.si) ? f.si : [], no = Array.isArray(f.no) ? f.no : [];
    return si.length || no.length ? { si, no } : undefined;
  };
  C.escenasCfg = function () {
    const s = C.state;
    return s.escenasOn ? { cantidad: s.escenasCantidad || 'medio', fijos: C.fijosDe('escenas') } : {};
  };
  /* Gráficos (19-sep): lo mismo — cuántos y de qué color; apagados = objeto vacío */
  C.grafCfg = function () {
    const s = C.state;
    return s.grafOn ? { cantidad: s.grafCantidad || 'medio', color: s.grafColor || 'cherry', estilo: s.grafEstilo === 'premium' ? 'premium' : 'clasico', detras: !!s.grafDetras, fijos: C.fijosDe('graficos') } : {};
  };
  C.ajustesLook = () => (window.CherryColor ? window.CherryColor.AJUSTES.map((a) => a.k) : []);
  /* Volver el look a como viene */
  C.restablecerLook = function () {
    const patch = { lookFuerza: 100 };
    C.ajustesLook().forEach((k) => { patch['aj_' + k] = 0; });
    C.setState(patch);
  };


  /* Los parámetros de generar. La base adelantada se pide con estos MISMOS (así sale idéntica a la de generar). */
  C.ajustesGenerar = function (s) {
    return {
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
        aire:            s.aire,
        editMode:        s.editMode,
        sin_cortes:      !!s.sinCortes,
        font:            s.font,
        brandColor:      s.brandColor,
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
        /* look de color: lo aplica el ensamblador antes de quemar los subtítulos */
        color:             C.colorCfg(),
        /* movimiento de cámara: lo hornea el ensamblador antes del color y de los subtítulos */
        movimiento:        C.movCfg(),
        /* escenas de apoyo: el ensamblador pone las que encontró la IA en la biblioteca */
        escenas:           C.escenasCfg(),
        /* gráficos: el ensamblador dibuja los que marcó la IA (cifras, listas, fechas…) */
        graficos:          C.grafCfg(),
      };
  };

  /* ── Render rápido y adelantado (18-sep) ─────────────────────────────────────────────── */

  /* Todo lo que cambia los CORTES o las frases que marca la IA. Si algo de esto cambia, el camino
     rápido (reusar la base ya cortada) no sirve y hay que volver a generar el video completo. */
  /* ⚠️ LA VERSION DEL CORTE VA EN LA FIRMA. La base guardada solo se reutiliza si la firma
     coincide — y si el SERVIDOR cambia cómo corta, la firma no se entera y se sigue reutilizando
     una base cortada con el código viejo. Le pasó a Sergio: arreglamos el recorte de pausas, el
     generaba otra vez y salía identico, porque la base era de antes del arreglo.

     Al tocar el corte en el servidor, SUBIR ESTE NUMERO. Invalida las bases de todos una vez. */
  const VERSION_CORTE = 4;

  C.firmaCortes = function (s) {
    return JSON.stringify({
      v: VERSION_CORTE,
      clips: (s.clips || []).map((c) => c.id),
      guion: s.scriptText || '',
      /* `sinCortes` va en la firma: encenderlo o apagarlo cambia los cortes, así que el camino
         rápido —reusar la base ya cortada— no sirve y hay que volver a generar. */
      ritmo: [s.pacing, s.clipGap, s.clipStart, s.aire, s.editMode, s.duration, !!s.sinCortes],
      // 18-sep: los subtítulos (encendidos, modo y nivel de impacto) ya NO son cortes: van por el camino rápido
    });
  };

  /* Las frases de un render: la edición guardada manda si es válida (igual que el editor) */
  C.frasesDeRender = function (data) {
    const sp = data && data.subtitle_phrases, ed = data && data.subtitle_edits;
    const hayFrases = sp && Array.isArray(sp.palabras) && Array.isArray(sp.frases) && sp.frases.length;
    if (!hayFrases) return null;
    const edicionValida = ed && Array.isArray(ed.palabras) && Array.isArray(ed.frases) && ed.frases.length && ed.palabras.length === sp.palabras.length;
    const fuente = edicionValida ? ed : sp;
    return {
      plantilla: (edicionValida && ed.plantilla) || (data.subtitle_config && data.subtitle_config.plantilla) || sp.plantilla || C.state.subsPlantilla,
      palabras: fuente.palabras,
      frases: fuente.frases.map((f) => Object.assign({}, f, { clave: (f.clave || []).slice() })),
      simple: (edicionValida && ed.simple) || (data.subtitle_config && data.subtitle_config.simple) || null,
    };
  };

  /* Lo que se manda para el camino rápido. Lo usan exportar desde el editor y el render adelantado.
     Lleva tamaño y posición de la plantilla: antes exportar desde el editor los perdía. */
  C.cargaRapida = function (s, subs, reusar) {
    const cfg = C.subs.config(s);
    const impacto = C.subs.modoImpacto(s);
    return {
      subtitulos: {
        plantilla: subs.plantilla,
        // 18-sep (orchestrate v192): el modo de impacto viaja; `marcar_titulares` = la IA vuelve a escoger SOLO los titulares
        modo: impacto ? 'impacto' : 'todo',
        impacto: s.subsImpacto || 'medio',
        plantilla_impacto: impacto ? (s.subsPlantilla || 'editorial') : null,
        marcar_titulares: !!subs.marcar,
        apagados: !s.captions,
        simple: C.subs.simpleDe(s),
        frases: subs.frases,
        num_palabras: subs.palabras.length,
        // Palabras corregidas (por la IA o a mano): { índice: texto }
        textos: subs.palabras.reduce((acc, w, i) => { if (w.original != null) acc[i] = w.word; return acc; }, {}),
        escala: cfg.escala || 1, y: cfg.y || 0, x: cfg.x || 0,
      },
      /* al reexportar se dice SIEMPRE qué color se quiere: si no va nada, el servidor reusa el del video anterior */
      color: C.colorCfg() || { revelado: true },
      movimiento: C.movCfg(),
      escenas: C.escenasCfg(),
      graficos: C.grafCfg(),
      reusarRender: reusar,
    };
  };

  /* Al abrir un proyecto, los controles quedan como estaba su último video: color, plantilla, tamaño y
     posición. Si no, la página mostraría «Sin look» sobre un video con Cherry Gold. */
  C.restaurarDeRender = function (cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    const s = C.state, patch = {};
    const col = cfg.color;
    patch.revelado = !(col && col.revelado === false);
    if (col && col.look && window.CherryColor && window.CherryColor.CATALOGO[col.look]) {
      patch.look = col.look;
      patch.lookFuerza = Math.round((col.intensidad == null ? 1 : Number(col.intensidad)) * 100);
      C.ajustesLook().forEach((k) => { patch['aj_' + k] = Number(col.ajustes && col.ajustes[k]) || 0; });
    } else {
      patch.look = 'ninguno';
    }
    if (cfg.modo === 'impacto') { patch.subsModo = 'impacto'; if (cfg.plantilla_impacto) patch.subsPlantilla = cfg.plantilla_impacto; if (cfg.impacto) patch.subsImpacto = cfg.impacto; }
    else if (cfg.plantilla) { patch.subsModo = 'todo'; patch.subsPlantilla = cfg.plantilla; }
    if (cfg.apagados) patch.captions = false;                // se apagaron por el camino rápido (18-sep)
    patch.subsEscala = Number(cfg.escala) || 1;
    patch.subsDy = Number(cfg.y) || 0;
    patch.subsDx = Number(cfg.x) || 0;
    Object.assign(patch, (C.subs.simpleAEstado && C.subs.simpleAEstado(cfg.simple)) || {});
    // movimiento de ese video (19-sep); un video hecho antes no tenía: se muestra apagado, como salió
    const mv = cfg.movimiento;
    const efs = mv && Array.isArray(mv.efectos) ? mv.efectos : [];
    patch.movEfectos = ['lento', 'aleja', 'golpe', 'impacto', 'mano', 'sacude'].reduce((o, k) => { o[k] = efs.indexOf(k) >= 0; return o; }, {});
    if (mv && mv.curva) patch.movCurva = mv.curva;
    if (mv && mv.intensidad) patch.movIntensidad = mv.intensidad;
    // escenas de apoyo de ese video (19-sep)
    const es = cfg.escenas;
    patch.escenasOn = !!(es && es.cantidad);
    if (es && es.cantidad) patch.escenasCantidad = es.cantidad;
    // gráficos de ese video (19-sep)
    const gf = cfg.graficos;
    patch.grafOn = !!(gf && gf.cantidad);
    if (gf && gf.cantidad) patch.grafCantidad = gf.cantidad;
    if (gf && gf.color) patch.grafColor = gf.color;
    if (gf && gf.estilo) patch.grafEstilo = gf.estilo === 'premium' ? 'premium' : 'clasico';
    Object.assign(s, patch);
  };

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
  C.mostrarVideo = startBlobDownload;   // el render adelantado cambia el video del celular al terminar

  C.actions = {
    /* Play/pausa: con video real controla el <video>; sin video, la vista simulada del diseño */
    togglePlay() {
      if (C.cortesVivo && C.cortesVivo.enUso() && !C.videoVista()) { C.cortesVivo.alternar(); return; }
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
      if (C.cortesVivo && C.cortesVivo.enUso() && !C.videoVista()) { C.cortesVivo.irA(p * C.cortesVivo.duracion()); return; }
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

      /* Recoger todos los parámetros de configuración (C.ajustesGenerar: la base adelantada usa los mismos) */
      const s = C.state;
      const settings = C.ajustesGenerar(s);

      const pintarProgreso = (pct) => {
        C.state.renderProgress = Math.round(pct);
        document.querySelectorAll('.js-render-bar').forEach((el) => (el.style.width = pct + '%'));
        document.querySelectorAll('.js-render-pct').forEach((el) => (el.textContent = Math.round(pct) + '%'));
        document.querySelectorAll('.js-render-stage').forEach((el) => (el.textContent = U.renderStage(pct)));
      };

      try {
        const generateStartTime = Date.now();
        let previewShown = false;

        /* Llamar al pipeline — orchestrate devuelve render_id rápido.
           Si la base adelantada ya está hecha con estos mismos cortes, se genera SOBRE ella (no se vuelven a cortar los clips). */
        /* 20-sep: si la base se está armando, se espera. Generar mientras tanto hacía que F1 cortara
           los mismos clips dos veces a la vez — el desperdicio más caro que tenía Cherry. */
        let base = C.cortesVivo && C.cortesVivo.baseParaGenerar();
        if (!base && C.cortesVivo && C.cortesVivo.esperarBase && C.cortesVivo.armando(s)) {
          pintarProgreso(4);
          base = await C.cortesVivo.esperarBase(90000);
        }
        const genRes = await C.api.generateVideo(settings, base ? { reusar_base: base.id, firma_cortes: base.clave } : null);
        if (base) console.log('[CARRETE] Generando sobre la base adelantada', base.id, genRes && genRes.desde_base ? '(aceptada)' : '(el servidor no la usó)');
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
              C.setState({ phase: 'done', renderProgress: 100, renderUrl: null, videoReady: false, renderId: currentRenderId, editorData: null, editorTranscript: [], editorScenes: [],
                fondoPrevia: status.video_sin_subtitulos || C.state.fondoPrevia });
              if (C.adelantado) C.adelantado.nuevaBase(currentRenderId);
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
    // En la tarjeta Texto la vista previa aparece sola en el celular; al salir vuelve el video
    openCard(k) { C.setState({ openCard: k, projOpen: false, userOpen: false, typographyPreview: k === 'texto', previaEnfoque: null }); },
    verEnInstagram() { C.setState({ igVista: !C.state.igVista }); },

    backToGrid() { C.setState({ openCard: null, typographyPreview: false, previaEnfoque: null }); },

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

    /* ── Pantalla de inicio ── */
    irInicio() {
      document.querySelectorAll('.js-video-player').forEach((v) => { try { v.pause(); } catch (_) {} });
      C.setState({ pantalla: 'inicio', openCard: null, typographyPreview: false, previaEnfoque: null });
      C.actions.cargarInicio();
    },

    async cargarInicio() {
      if (!C.apiReady) return;
      try {
        const lista = await C.api.getResumenProyectos();
        C.setState({ inicioProyectos: lista, inicioCargado: true });
      } catch (e) {
        console.warn('[CHERRY] No se pudo cargar el inicio:', e);
        C.setState({ inicioCargado: true });
      }
    },

    async abrirProyecto(id) {
      if (id && id !== C.session.projectId) await C.actions.cambiarProyecto(id);
      C.setState({ pantalla: 'editor' });
    },

    async nuevoDesdeInicio() {
      await C.actions.nuevoProyecto();
      C.setState({ pantalla: 'editor' });
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
            // Frases con palabra clave que usó el generador (renders desde el 17-sep); si hay una edición guardada, esa manda.
            // C.frasesDeRender es la misma lectura que usa el render adelantado.
            const leidas = C.frasesDeRender(data);
            const edicionValida = !!(leidas && data.subtitle_edits && leidas.palabras === data.subtitle_edits.palabras);
            const subs = leidas ? { plantilla: leidas.plantilla, palabras: leidas.palabras, frases: leidas.frases } : null;
            // «A tu gusto» de ESTE video (el guardado o el que usó al generarse) → controles, para que la vista y exportar coincidan
            const simple = C.subs.simpleAEstado(leidas ? leidas.simple : (data.subtitle_config && data.subtitle_config.simple));
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
      // ¿El render adelantado ya hizo (o está haciendo) exactamente esto? Entonces no se lanza otro.
      if (rapido && C.adelantado && C.adelantado.usarParaExportar()) return;
      C.setState({ editorExporting: true, editorExportProgress: 2, editorExportDone: false, editorExportRapido: rapido });
      try {
        const scenesOverride = (s.editorScenes && s.editorScenes.length > 0)
          ? s.editorScenes.map((sc) => ({ timestamp_ms: sc.timestamp_ms, hero: sc.hero, support: sc.support, theme: sc.theme || '' }))
          : null;
        // Subtítulos: con las frases editadas (estilo y palabra clave de cada una) o, si el video es anterior, con la plantilla elegida.
        // C.cargaRapida es la misma carga del render adelantado (y lleva tamaño y posición, que antes se perdían).
        const subtitulos = s.editorSubs ? C.cargaRapida(s, s.editorSubs, null).subtitulos : C.subs.config(s);
        const res = await C.api.reExportWithEdits(scenesOverride, null, {
          captionStyle: s.captionStyle, captionPosition: s.captionPosition, combo: s.graphicsCombo,
          heroColor: s.graphicsHeroColor, supColor: s.graphicsSupColor, bg: s.graphicsBg,
          subtitulos,
          /* al reexportar se dice SIEMPRE qué color se quiere: si no va nada, el servidor reusa el look del video anterior */
          color: C.colorCfg() || { revelado: true },
          movimiento: C.movCfg(),
          escenas: C.escenasCfg(),
          graficos: C.grafCfg(),
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
              if (C.adelantado) C.adelantado.nuevaBase(newRenderId);
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

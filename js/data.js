/* ============================================================
   data.js — catálogos de opciones y utilidades de formato.
   Diseño "very sweet" (16-sep-2026) + los catálogos reales de Cherry
   (subtítulos planos de respaldo, gráficos de escena). Las plantillas de subtítulos viven en components/subtitulos.js.
   Todo es data pura; sin DOM. Cuelga de window.CARRETE.data / .util
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});

  C.data = {
    presets: [
      { id: 'sunset', name: 'Neón Noche', desc: 'Magenta, glow, alto brillo', c1: '#FF2D8A', c2: '#FFC93C' },
      { id: 'vhs', name: 'VHS 86', desc: 'Grano, scanlines, glitch', c1: '#FF2D8A', c2: '#2BD9C7' },
      { id: 'cine', name: 'Cine 35mm', desc: 'Letterbox, alto contraste', c1: '#F7E9E0', c2: '#FFC93C' },
      { id: 'clean', name: 'Limpio Pro', desc: 'Nítido y moderno', c1: '#7B4BFF', c2: '#F7E9E0' },
    ],
    tints: {
      sunset: 'transparent',
      vhs: 'linear-gradient(90deg,rgba(43,217,199,.3),transparent,rgba(255,45,138,.32))',
      cine: 'linear-gradient(180deg,rgba(12,4,9,.6),transparent 22%,transparent 78%,rgba(12,4,9,.6))',
      clean: 'rgba(123,75,255,.14)',
    },
    aspects: [
      { id: '9:16', ratio: '9:16', w: 12, h: 20 },
      { id: '1:1', ratio: '1:1', w: 17, h: 17 },
      { id: '16:9', ratio: '16:9', w: 22, h: 13 },
    ],
    editModes: [
      { id: 'guion', name: 'Con guión', desc: 'Tú escribes, la IA lo sigue' },
      { id: 'ia', name: 'IA decide', desc: 'La IA elige los momentos' },
    ],

    /* ── Subtítulos planos de antes (el servidor los usa solo si no llega una plantilla; las plantillas viven en components/subtitulos.js) ── */
    captionStyles:    [{ id: 'pop', name: 'Pop' }, { id: 'karaoke', name: 'Karaoke' }, { id: 'minimal', name: 'Minimal' }],
    captionPositions: [{ id: 'chin', name: 'Bajo mentón' }, { id: 'head', name: 'Sobre cabeza' }, { id: 'bottom', name: 'Abajo fijo' }],
    captionFonts: [
      { id: 'roboto-bold',    name: 'Roboto Bold',    css: "'Roboto', sans-serif" },
      { id: 'montserrat',     name: 'Montserrat',     css: "'Montserrat', sans-serif" },
      { id: 'europa-grotesk', name: 'Europa Grotesk', css: "'Space Grotesk', sans-serif" },
    ],

    /* ── Marca ── */
    fonts: ['Outfit', 'Anton', 'Bebas Neue', 'Archivo Black', 'Druk Wide', 'Clash Display', 'Cabinet Grotesk',
      'Monument Extended', 'Playfair Display', 'Space Grotesk', 'Neue Montreal', 'Sequel Sans', 'Right Grotesk',
      'Migra', 'Familjen Grotesk'].map((n) => ({ id: n.toLowerCase().replace(/ /g, '-'), name: n })),
    brandColors: ['#FF2D8A', '#FFC93C', '#2BD9C7', '#7B4BFF', '#FF6B3D', '#1E73BE', '#A3105F', '#F7E9E0'],

    /* ── Movimiento ── */
    transitions: [
      { id: 'corte', name: 'Corte seco' }, { id: 'fade', name: 'Fade' }, { id: 'zoom', name: 'Zoom' },
      { id: 'desliz', name: 'Deslizamiento' }, { id: 'glitch', name: 'Glitch' }, { id: 'ia', name: 'IA decide' },
    ],
    zoomTypes: [{ id: 'suave', name: 'Suave' }, { id: 'agresivo', name: 'Agresivo' }, { id: 'ia', name: 'IA decide' }],

    /* ── Sonido ── */
    musics: [
      { id: 'synthwave', name: 'Synthwave 80s' }, { id: 'lofi', name: 'Lo-fi chill' }, { id: 'funk', name: 'Funk groovy' },
      { id: 'trap', name: 'Trap viral' }, { id: 'cinematic', name: 'Cinemático' }, { id: 'none', name: 'Sin música' },
    ],

    /* ── Salida ── */
    durations: [
      { id: '15', name: '15s' }, { id: '30', name: '30s' }, { id: '45', name: '45s' },
      { id: '60', name: '1 min' }, { id: '90', name: '1:30' }, { id: '120', name: '2 min' },
    ],
    qualities: [{ id: '720', name: '720p' }, { id: '1080', name: '1080p' }, { id: '4k', name: '4K' }],
    advRows: [
      { k: 'motion', name: 'Motion graphics', desc: 'Títulos animados y lower-thirds' },
      { k: 'sfx', name: 'Efectos de sonido', desc: 'Whooshes, impactos, risers' },
      { k: 'broll', name: 'B-roll inteligente', desc: 'Rellena pausas con stock relevante' },
      { k: 'fourk', name: 'Render 4K', desc: 'Mayor calidad · +6 créditos' },
    ],

    /* ── Gráficos de escena (F3) ── */
    graphicsBgs: [{ id: 'Papel', name: 'Papel' }, { id: 'Ventana', name: 'Ventana' }, { id: 'Oscuro', name: 'Oscuro' }, { id: 'Claro', name: 'Claro' }],
    graphicsCombos: [{ id: 'Creativ', name: 'Creativ' }, { id: 'Bold', name: 'Bold' }, { id: 'Soft', name: 'Soft' }, { id: 'Dark', name: 'Dark' }],

    /* ── Librerías ── */
    sfxCats: [
      { id: 'whoosh', name: 'Whooshes' }, { id: 'impacto', name: 'Impactos' }, { id: 'riser', name: 'Risers' },
      { id: 'glitch', name: 'Glitch' }, { id: 'foley', name: 'Foley' }, { id: 'ui', name: 'UI / Pop' },
    ],
    sfxNames: {
      whoosh: ['Whoosh Up', 'Swish Fast', 'Air Pass', 'Reverse Swell', 'Transition Air', 'Soft Whoosh'],
      impacto: ['Boom Deep', 'Hit Punch', 'Cinematic Slam', 'Bass Drop', 'Metal Hit', 'Sub Impact'],
      riser: ['Tension Rise', 'Synth Riser', 'Noise Sweep', 'Build Up', 'Uplifter', 'Drone Rise'],
      glitch: ['Glitch Stutter', 'Digital Error', 'Data Burst', 'VHS Noise', 'Signal Loss', 'Bit Crush'],
      foley: ['Footsteps', 'Page Turn', 'Click Wood', 'Cloth Move', 'Door Close', 'Keys Jingle'],
      ui: ['Pop Bubble', 'Notification', 'Tap Soft', 'Coin Ding', 'Switch Click', 'Bubble Pop'],
    },
    visCats: [
      { id: 'naturaleza', name: 'Naturaleza' }, { id: 'ciudad', name: 'Ciudad' }, { id: 'abstracto', name: 'Abstracto' },
      { id: 'texturas', name: 'Texturas' }, { id: 'gente', name: 'Gente' }, { id: 'retro', name: 'Retro' },
    ],
    visTones: {
      naturaleza: ['rgba(43,217,199,.35)', 'rgba(30,115,190,.35)'],
      ciudad: ['rgba(255,45,138,.35)', 'rgba(123,75,255,.35)'],
      abstracto: ['rgba(123,75,255,.35)', 'rgba(255,201,60,.3)'],
      texturas: ['rgba(163,16,95,.4)', 'rgba(255,201,60,.3)'],
      gente: ['rgba(255,107,61,.35)', 'rgba(255,45,138,.35)'],
      retro: ['rgba(255,111,179,.35)', 'rgba(255,201,60,.3)'],
    },
    clipTones: ['rgba(255,111,179,.4)', 'rgba(255,201,60,.35)', 'rgba(43,217,199,.35)',
      'rgba(255,45,138,.4)', 'rgba(123,75,255,.4)', 'rgba(30,115,190,.4)'],

    /* ── Menú de usuario ── */
    userMenu: [
      { id: 'cuenta', name: 'Mi cuenta' }, { id: 'proyectos', name: 'Proyectos guardados' },
      { id: 'creditos', name: 'Comprar créditos' }, { id: 'marca', name: 'Identidad de marca' },
      { id: 'ayuda', name: 'Ayuda' }, { id: 'salir', name: 'Cerrar sesión' },
    ],

    /* ── Módulo de configuración (6 del diseño + Gráficos, que ya existía)
       media: imagen (.svg/.jpg/.png/.gif/.webp) o video corto (.mp4/.webm) que ilustra la tarjeta.
       Para cambiarla basta con reemplazar el archivo o esta ruta. ── */
    configCards: [
      { k: 'edicion',  name: 'Edición',    tag: 'Corte',      desc: 'Estilo, formato y ritmo del corte', glyph: '◐', accent: '#FF2D8A', media: 'assets/config/edicion.png' },
      { k: 'texto',    name: 'Texto',      tag: 'Subtítulos', desc: 'Plantillas de subtítulos y mezcla', glyph: 'Aa', accent: '#FFC93C', media: 'assets/config/texto.png' },
      { k: 'mov',      name: 'Movimiento', tag: 'Cámara',     desc: 'Transiciones, zoom y capas',        glyph: '↗', accent: '#7B4BFF', media: 'assets/config/movimiento.png' },
      { k: 'audio',    name: 'Sonido',     tag: 'Audio',      desc: 'Música, volumen y efectos',         glyph: '♪', accent: '#2BD9C7', media: 'assets/config/sonido.png' },
      { k: 'salida',   name: 'Salida',     tag: 'Exportar',   desc: 'Duración, calidad y extras',        glyph: '⇧', accent: '#1E73BE', media: 'assets/config/salida.png' },
      { k: 'marca',    name: 'Marca',      tag: 'Identidad',  desc: 'Color, fuente e identidad',         glyph: '✦', accent: '#FF6B3D', media: 'assets/config/marca.png' },
      { k: 'color',    name: 'Color',      tag: 'Colorización', desc: 'Looks de color para todo el video', glyph: '◐', accent: '#2BD9C7', media: 'assets/config/edicion.png' },
      { k: 'graficos', name: 'Gráficos',   tag: 'Escenas',    desc: 'Colores y estilo de las escenas',   glyph: '▣', accent: '#FF6FB3', media: 'assets/config/graficos.svg' },
    ],

    /* ── Looks de color (18-sep): recetas de motor-color.js, las mismas que hornea el ensamblador.
          Los 5 fijos del 17-sep (Natural, Cálido, Cine, Frío, Nítido) se quitaron: no le gustaron. ── */
    looks: [
      { id: 'ninguno',     name: 'Sin look',    desc: 'Solo el revelado (si está encendido): limpio y sin estilo' },
      { id: 'cherry_gold', name: 'Cherry Gold', desc: 'Luz ámbar, negros ciruela, piel natural y blancos que nunca se queman' },
    ],

    /* ── Editar resultado: pistas ── */
    tracks: [
      { id: 'clips',  name: 'Clips',      color: '#FF6FB3' },
      { id: 'subs',   name: 'Subtítulos', color: '#FF2D8A' },
      { id: 'zoom',   name: 'Zoom',       color: '#FFC93C', segs: [[10, 12], [45, 14], [78, 15]] },
      { id: 'motion', name: 'Motion',     color: '#7B4BFF' },
      { id: 'music',  name: 'Música',     color: '#2BD9C7', segs: [[0, 99]] },
      { id: 'sfx',    name: 'SFX',        color: '#1E73BE', segs: [[20, 5], [48, 5], [80, 5]] },
    ],
    trackNames: {
      clips: 'Clips del video', subs: 'Transcripción', zoom: 'Punto de zoom',
      motion: 'Escenas gráficas', music: 'Pista musical', sfx: 'Efecto de sonido',
    },
  };

  /* Gráficos de escena apagados hasta tener un motor de gráficos bueno (16-sep-2026):
     se ocultan su tarjeta y la pista Motion del editor. Para volver: poner true (y CARRETE_GRAFICOS=on en el servidor). */
  C.data.graficosActivos = false;
  if (!C.data.graficosActivos) {
    C.data.configCards = C.data.configCards.filter((c) => c.k !== 'graficos');
    C.data.tracks = C.data.tracks.filter((t) => t.id !== 'motion');
  }

  const D = C.data;

  C.util = {
    byId: (list, id) => list.find((x) => x.id === id) || list[0],
    nameOf: (list, id) => (list.find((x) => x.id === id) || list[0]).name,
    fmtTime(sec) {
      sec = Math.max(0, Number(sec) || 0);
      const m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
      return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
    },
    pacingLabel: (v) => (v < 34 ? 'Relajado' : v < 70 ? 'Equilibrado' : 'Dinámico'),
    zoomFreqLabel: (v) => (v < 34 ? 'Poco' : v < 70 ? 'Medio' : 'Mucho'),
    clipGapLabel: (v) => (v < 25 ? 'Sin pausas' : v < 60 ? 'Natural' : 'Con aire'),
    clipStartLabel: (v) => (v < 34 ? 'Pegado' : v < 80 ? 'Medio' : 'Con aire'),
    renderStage: (p) => (p < 30 ? 'Analizando clips…' : p < 60 ? 'Ensamblando video…' : p < 85 ? 'Renderizando…' : p < 97 ? 'Agregando subtítulos animados…' : 'Finalizando…'),
    words: (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length,
    cardSummary(k, s) {
      const U = C.util;
      switch (k) {
        case 'edicion':  return U.nameOf(D.presets, s.style) + ' · ' + s.aspect;
        case 'texto':    return s.captions ? 'Subtítulos ' + C.subs.nombre(s.subsPlantilla) + (C.subs.modoImpacto(s) ? ' · solo impacto' : '') : 'Sin subtítulos';
        case 'mov':      return U.nameOf(D.transitions, s.transition) + ' · zoom ' + U.zoomFreqLabel(s.zoomFreq);
        case 'audio':    return U.nameOf(D.musics, s.music) + ' · ' + s.musicVol + '%';
        case 'salida':   return U.nameOf(D.durations, s.duration) + ' · ' + U.nameOf(D.qualities, s.quality);
        case 'marca':    return s.brandColor + ' · ' + U.nameOf(D.fonts, s.font);
        case 'color': {
          if (s.look === 'ninguno' || !D.looks.some((l) => l.id === s.look)) return s.revelado === false ? 'Sin color' : 'Solo revelado';
          const tocado = ['luz', 'contraste', 'dorado', 'sombras', 'piel', 'vineta'].some((k) => Number(s['aj_' + k]));
          return U.nameOf(D.looks, s.look) + (s.lookFuerza < 100 ? ' · ' + s.lookFuerza + '%' : '') + (tocado ? ' · ajustado' : '');
        }
        case 'graficos': return s.graphicsCombo + ' · fondo ' + s.graphicsBg;
        default:         return '';
      }
    },
  };
})();

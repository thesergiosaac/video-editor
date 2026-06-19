/* ============================================================
   data.js — catálogos de opciones y utilidades de formato.
   Todo es data pura; sin DOM. Cuelga de window.CARRETE.data / .util
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});

  C.data = {
    presets: [
      { id: 'sunset', name: 'Retro Sunset', desc: 'Cálido, dorado, nostálgico', g: 'linear-gradient(90deg,#FF8A3D,#E0400F)' },
      { id: 'vhs', name: 'VHS 86', desc: 'Grano, scanlines, glitch', g: 'linear-gradient(90deg,#E0400F,#2C6B5E)' },
      { id: 'cine', name: 'Cine 35mm', desc: 'Letterbox, alto contraste', g: 'linear-gradient(90deg,#1C1610,#E7A235)' },
      { id: 'clean', name: 'Limpio Pro', desc: 'Nítido y moderno', g: 'linear-gradient(90deg,#E7A235,#ECE0CB)' },
    ],
    styleLabel: { sunset: 'Retro Sunset', vhs: 'VHS 86', cine: 'Cine 35mm', clean: 'Limpio Pro' },
    styleTint: {
      sunset: 'transparent',
      vhs: 'linear-gradient(90deg,rgba(44,107,94,.28),transparent,rgba(224,64,15,.3))',
      cine: 'linear-gradient(180deg,rgba(28,22,16,.45),transparent 22%,transparent 78%,rgba(28,22,16,.45))',
      clean: 'rgba(236,224,203,.06)',
    },
    aspects: [
      { id: '9:16', ratio: '9:16', label: 'Reels', w: 14, h: 24 },
      { id: '1:1', ratio: '1:1', label: 'Feed', w: 20, h: 20 },
      { id: '16:9', ratio: '16:9', label: 'YouTube', w: 26, h: 15 },
    ],
    aspectDims: { '9:16': { w: 300, h: 512 }, '1:1': { w: 430, h: 430 }, '16:9': { w: 600, h: 338 } },
    captionStyles: [{ id: 'pop', name: 'Pop' }, { id: 'karaoke', name: 'Karaoke' }, { id: 'minimal', name: 'Minimal' }],
    musics: [
      { id: 'synthwave', name: '🌆 Synthwave 80s' }, { id: 'lofi', name: '☕ Lo-fi chill' },
      { id: 'funk', name: '🕺 Funk groovy' }, { id: 'trap', name: '🔥 Trap viral' },
      { id: 'cinematic', name: '🎬 Cinemático' }, { id: 'none', name: 'Sin música' },
    ],
    advRows: [
      { k: 'motion', name: 'Motion graphics', desc: 'Títulos animados y lower-thirds' },
      { k: 'sfx', name: 'Efectos de sonido', desc: 'Whooshes, impactos, risers' },
      { k: 'broll', name: 'B-roll inteligente', desc: 'Rellena pausas con stock relevante' },
      { k: 'fourk', name: 'Render 4K', desc: 'Mayor calidad · +6 créditos' },
    ],
    editModes: [
      { id: 'guion', name: 'Con guión', desc: 'Tú escribes, la IA lo sigue' },
      { id: 'ia', name: 'IA decide', desc: 'La IA elige los mejores momentos' },
    ],
    fonts: ['Syne', 'Anton', 'Bebas Neue', 'Archivo Black', 'Druk Wide', 'Clash Display', 'Cabinet Grotesk', 'Monument Extended', 'Playfair Display', 'Space Grotesk', 'Neue Montreal', 'Sequel Sans', 'Right Grotesk', 'Migra', 'Familjen Grotesk'].map((n) => ({ id: n.toLowerCase().replace(/ /g, '-'), name: n })),
    brandColors: ['#FF5A1F', '#E0400F', '#E7A235', '#2C6B5E', '#C8350C', '#7B4BFF', '#1E73BE', '#1C1610'],
    impactEntrances: [{ id: 'explosivo', name: 'Explosivo' }, { id: 'desliz', name: 'Deslizam.' }, { id: 'fade', name: 'Fade' }],
    transitions: [
      { id: 'corte', name: 'Corte seco' }, { id: 'fade', name: 'Fade' }, { id: 'zoom', name: 'Zoom' },
      { id: 'desliz', name: 'Deslizamiento' }, { id: 'glitch', name: 'Glitch' }, { id: 'ia', name: 'IA decide' },
    ],
    zoomTypes: [{ id: 'suave', name: 'Suave' }, { id: 'agresivo', name: 'Agresivo' }, { id: 'ia', name: 'IA decide' }],
    durations: [
      { id: '15', name: '15s' }, { id: '30', name: '30s' }, { id: '45', name: '45s' },
      { id: '60', name: '1 min' }, { id: '90', name: '1:30' }, { id: '120', name: '2 min' },
    ],
    qualities: [{ id: '720', name: '720p' }, { id: '1080', name: '1080p' }, { id: '4k', name: '4K' }],
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
    visBase: {
      naturaleza: ['#2C6B5E', '#6b8e4e', '#3a5a3f'], ciudad: ['#3a3f4a', '#5a6270', '#1C1610'],
      abstracto: ['#7B4BFF', '#FF5A1F', '#1E73BE'], texturas: ['#6b3a22', '#E7A235', '#3a2a1f'],
      gente: ['#C8350C', '#E0400F', '#FFAB52'], retro: ['#FF8A3D', '#E7A235', '#2C6B5E'],
    },
    clipGrads: [
      'linear-gradient(160deg,#FF8A3D,#C8350C)', 'linear-gradient(160deg,#E7A235,#6b3a22)',
      'linear-gradient(160deg,#2C6B5E,#15100C)', 'linear-gradient(160deg,#FF5A1F,#241B13)',
      'linear-gradient(160deg,#FFAB52,#E0400F)', 'linear-gradient(160deg,#3a2a1f,#E7A235)',
    ],
    clipDurs: ['0:42', '0:31', '1:05', '0:18', '0:54', '0:42'],
    tabs: [
      { id: 'edicion', num: '01', name: 'Edición' }, { id: 'texto', num: '02', name: 'Texto' },
      { id: 'mov', num: '03', name: 'Movimiento' }, { id: 'audio', num: '04', name: 'Audio' },
      { id: 'rec', num: '05', name: 'Recursos' }, { id: 'marca', num: '06', name: 'Marca' },
    ],
    panelMeta: {
      edicion: ['Configura tu edición', 'La IA aplica todo esto a tus clips en segundos.'],
      texto: ['Texto y tipografía', 'Guión, fuentes, color y títulos de impacto.'],
      mov: ['Movimiento', 'Transiciones, zoom y efecto de capas.'],
      audio: ['Audio', 'Mezcla de música y librería de efectos.'],
      rec: ['Recursos y salida', 'Duración, calidad y banco visual.'],
      marca: ['Identidad de marca', 'Tu estilo, aplicado a cada proyecto.'],
    },
    trackDefs: [
      { id: 'clips', name: 'Clips', color: '#FF8A3D' }, { id: 'subs', name: 'Subtítulos', color: '#FF5A1F' },
      { id: 'zoom', name: 'Zoom', color: '#E7A235' }, { id: 'motion', name: 'Motion', color: '#7B4BFF' },
      { id: 'music', name: 'Música', color: '#2C6B5E' }, { id: 'sfx', name: 'SFX', color: '#1E73BE' },
    ],
    trackSegs: {
      clips: [[1, 21], [23, 17], [41, 24], [66, 19], [86, 13]],
      subs: [[3, 18], [24, 15], [42, 21], [65, 17], [85, 13]],
      zoom: [[10, 12], [45, 14], [78, 15]], motion: [[5, 17], [60, 22]],
      music: [[0, 99]], sfx: [[20, 5], [48, 5], [80, 5]],
    },
    selTrackName: {
      clips: 'Clip 03', subs: 'Subtítulo activo', zoom: 'Punto de zoom',
      motion: 'Título animado', music: 'Pista musical', sfx: 'Efecto de sonido',
    },
  };

  C.util = {
    fmtTime(sec) {
      const m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
      return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
    },
    pacingLabel: (v) => (v < 34 ? 'Relajado' : v < 70 ? 'Equilibrado' : 'Dinámico'),
    zoomFreqLabel: (v) => (v < 34 ? 'Poco' : v < 70 ? 'Medio' : 'Mucho'),
    renderStage: (p) => (p < 30 ? 'Analizando clips…' : p < 60 ? 'Sincronizando con el beat…' : p < 85 ? 'Aplicando estilo y subtítulos…' : 'Renderizando…'),
    byId: (list, id) => list.find((x) => x.id === id) || list[0],
  };
})();

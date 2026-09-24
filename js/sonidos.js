/* sonidos.js — la librería de efectos de sonido de Cherry (24-sep-2026)
 *
 * 100 efectos de VideoEditingSFX (videoeditingsfx.com), licencia CC0: uso comercial libre, sin crédito. Sergio
 * autorizó descargarlos el 24-sep. Todos con el pico a -3 dBFS, 44,1 kHz estéreo, MP3 160k; los de más de 8 s
 * después de su golpe se cortan con medio segundo de salida. Viven públicos en el bucket, en sonidos/<cat>/<id>.mp3.
 *
 * `golpe`: el segundo en que el efecto suena más fuerte (ventanas de 50 ms). Cherry NO hace empezar el sonido en la
 * palabra que escoge la persona: hace caer ese golpe en ella. Por eso una subida arranca antes y revienta en la
 * palabra, un whoosh pasa justo sobre ella y un impacto pega en ella. Medido: el golpe cae al 10 por ciento del
 * efecto en impactos y clics, al 35 en whooshes, al 62 en risers y al ~90 en subidas y reversos.
 *
 * El mismo archivo en la página y en el ensamblador (module.exports).
 */
(function (raiz) {
  'use strict';
  var BASE = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/sonidos/';
  var CATEGORIAS = [
    { id: 'whoosh', nombre: 'Whooshes y transiciones' },
    { id: 'impacto', nombre: 'Impactos' },
    { id: 'cine', nombre: 'Cinemáticos' },
    { id: 'subida', nombre: 'Subidas' },
    { id: 'riser', nombre: 'Risers' },
    { id: 'reverso', nombre: 'Reversos' },
    { id: 'camara', nombre: 'Cámara' },
    { id: 'ui', nombre: 'Clics y avisos' }
  ];
  var LISTA = [
    { id: "deep-whoosh-1", nombre: "Deep Whoosh 1", cat: 'whoosh', dur: 3.16, golpe: 0.63 },
    { id: "deep-whoosh-2", nombre: "Deep Whoosh 2", cat: 'whoosh', dur: 3.06, golpe: 0.58 },
    { id: "deep-whoosh-3", nombre: "Deep Whoosh 3", cat: 'whoosh', dur: 3.18, golpe: 0.73 },
    { id: "deep-whoosh-4", nombre: "Deep Whoosh 4", cat: 'whoosh', dur: 4.05, golpe: 0.88 },
    { id: "fast-whoosh", nombre: "Fast Whoosh", cat: 'whoosh', dur: 0.8, golpe: 0.23 },
    { id: "short-whoosh-metal", nombre: "Short Whoosh Metal", cat: 'whoosh', dur: 1.06, golpe: 0.53 },
    { id: "simple-whoosh-1", nombre: "Simple Whoosh 1", cat: 'whoosh', dur: 0.47, golpe: 0.12 },
    { id: "simple-whoosh-2", nombre: "Simple Whoosh 2", cat: 'whoosh', dur: 0.31, golpe: 0.03 },
    { id: "swish-1", nombre: "Swish 1", cat: 'whoosh', dur: 2.23, golpe: 0.83 },
    { id: "swish-2", nombre: "Swish 2", cat: 'whoosh', dur: 0.6, golpe: 0.12 },
    { id: "swish-3", nombre: "Swish 3", cat: 'whoosh', dur: 1.68, golpe: 0.88 },
    { id: "swish-slicing", nombre: "Swish Slicing", cat: 'whoosh', dur: 1.15, golpe: 0.33 },
    { id: "swoosh", nombre: "Swoosh", cat: 'whoosh', dur: 1.33, golpe: 0.48 },
    { id: "swoosh-1", nombre: "Swoosh 1", cat: 'whoosh', dur: 2.14, golpe: 0.98 },
    { id: "swoosh-3", nombre: "Swoosh 3", cat: 'whoosh', dur: 2.82, golpe: 1.23 },
    { id: "swoosh-4", nombre: "Swoosh 4", cat: 'whoosh', dur: 2.66, golpe: 1.23 },
    { id: "swoosh-5", nombre: "Swoosh 5", cat: 'whoosh', dur: 1.75, golpe: 0.28 },
    { id: "swoosh-crash", nombre: "Swoosh Crash", cat: 'whoosh', dur: 0.86, golpe: 0.33 },
    { id: "swoosh-fast-1", nombre: "Swoosh Fast 1", cat: 'whoosh', dur: 0.68, golpe: 0.33 },
    { id: "swoosh-fast-with-thud", nombre: "Swoosh Fast With Thud", cat: 'whoosh', dur: 0.65, golpe: 0.23 },
    { id: "swoosh-quick-low", nombre: "Swoosh Quick Low", cat: 'whoosh', dur: 0.78, golpe: 0.28 },
    { id: "swoosh-sharp-hit", nombre: "Swoosh Sharp Hit", cat: 'whoosh', dur: 1.28, golpe: 0.38 },
    { id: "swoosh-sharp-hit-2", nombre: "Swoosh Sharp Hit 2", cat: 'whoosh', dur: 0.82, golpe: 0.38 },
    { id: "swoosh2", nombre: "Swoosh 2", cat: 'whoosh', dur: 1.62, golpe: 0.43 },
    { id: "whoosh-achievement", nombre: "Whoosh Achievement", cat: 'whoosh', dur: 2.12, golpe: 0.43 },
    { id: "whoosh-coarse-harsh", nombre: "Whoosh Coarse Harsh", cat: 'whoosh', dur: 0.44, golpe: 0.18 },
    { id: "deep-hit", nombre: "Deep Hit", cat: 'impacto', dur: 3.94, golpe: 0.88 },
    { id: "deep-hit-2", nombre: "Deep Hit 2", cat: 'impacto', dur: 8.12, golpe: 0.12 },
    { id: "deep-hit-3", nombre: "Deep Hit 3", cat: 'impacto', dur: 5.14, golpe: 0.03 },
    { id: "dramatic-impact", nombre: "Dramatic Impact", cat: 'impacto', dur: 8.57, golpe: 1.62 },
    { id: "impact-and-subdrop", nombre: "Impact & Subdrop", cat: 'impacto', dur: 11.62, golpe: 3.62 },
    { id: "impact-hit", nombre: "Impact Hit", cat: 'impacto', dur: 2.38, golpe: 0.03 },
    { id: "impact-hit-1", nombre: "Impact Hit 1", cat: 'impacto', dur: 1.83, golpe: 0.08 },
    { id: "impact-hit-2", nombre: "Impact Hit 2", cat: 'impacto', dur: 2.53, golpe: 0.28 },
    { id: "impact-hit-3", nombre: "Impact Hit 3", cat: 'impacto', dur: 1.28, golpe: 0.12 },
    { id: "impact-hit-4", nombre: "Impact Hit 4", cat: 'impacto', dur: 1.62, golpe: 0.28 },
    { id: "impact-hit-launch", nombre: "Impact Hit Launch", cat: 'impacto', dur: 1.88, golpe: 0.38 },
    { id: "cinematic-bang", nombre: "Cinematic Bang", cat: 'cine', dur: 12.04, golpe: 5.18 },
    { id: "cinematic-boom", nombre: "Cinematic Boom", cat: 'cine', dur: 2.78, golpe: 1.82 },
    { id: "cinematic-glass-hit", nombre: "Cinematic Glass Hit", cat: 'cine', dur: 5.46, golpe: 0.43 },
    { id: "cinematic-heavy-hit", nombre: "Cinematic Heavy Hit", cat: 'cine', dur: 5.12, golpe: 0.53 },
    { id: "cinematic-riser-wildfire", nombre: "Cinematic Riser Wildfire", cat: 'cine', dur: 12.02, golpe: 6.23 },
    { id: "cinematic-whoosh-reverse", nombre: "Cinematic Whoosh Reverse", cat: 'cine', dur: 5.85, golpe: 1.52 },
    { id: "inception-thump", nombre: "Inception Thump", cat: 'cine', dur: 3.51, golpe: 0.23 },
    { id: "dramatic-buildup-1", nombre: "Dramatic Buildup 1", cat: 'subida', dur: 1.88, golpe: 1.57 },
    { id: "dramatic-buildup-2", nombre: "Dramatic Buildup 2", cat: 'subida', dur: 0.94, golpe: 0.73 },
    { id: "dramatic-buildup-3", nombre: "Dramatic Buildup 3", cat: 'subida', dur: 1.07, golpe: 0.93 },
    { id: "dramatic-buildup-4", nombre: "Dramatic Buildup 4", cat: 'subida', dur: 1.93, golpe: 1.82 },
    { id: "dramatic-buildup-reveal", nombre: "Dramatic Buildup Reveal", cat: 'subida', dur: 4.08, golpe: 0.48 },
    { id: "dramatic-buildup-sliced", nombre: "Dramatic Buildup Sliced", cat: 'subida', dur: 2.06, golpe: 1.82 },
    { id: "dramatic-buildup-whip-1", nombre: "Dramatic Buildup Whip 1", cat: 'subida', dur: 1.85, golpe: 1.68 },
    { id: "dramatic-buildup-whip-2", nombre: "Dramatic Buildup Whip 2", cat: 'subida', dur: 2.06, golpe: 1.88 },
    { id: "dramatic-buildup-whip-3", nombre: "Dramatic Buildup Whip 3", cat: 'subida', dur: 0.94, golpe: 0.83 },
    { id: "cyberpunk-stutter-riser", nombre: "Cyberpunk Stutter Riser", cat: 'riser', dur: 7.01, golpe: 2.43 },
    { id: "tremolo-riser-big-hit", nombre: "Tremolo Riser & Big Hit", cat: 'riser', dur: 5.45, golpe: 1.27 },
    { id: "riser-1", nombre: "Riser 1", cat: 'riser', dur: 4.06, golpe: 2.88 },
    { id: "riser-2", nombre: "Riser 2", cat: 'riser', dur: 3.72, golpe: 3.38 },
    { id: "riser-3", nombre: "Riser 3", cat: 'riser', dur: 3.24, golpe: 2.02 },
    { id: "cinematic-reverse-1", nombre: "Cinematic Reverse 1", cat: 'reverso', dur: 3.05, golpe: 2.98 },
    { id: "cinematic-reverse-10", nombre: "Cinematic Reverse 10", cat: 'reverso', dur: 1.63, golpe: 1.57 },
    { id: "cinematic-reverse-11", nombre: "Cinematic Reverse 11", cat: 'reverso', dur: 6.92, golpe: 5.68 },
    { id: "cinematic-reverse-2", nombre: "Cinematic Reverse 2", cat: 'reverso', dur: 3.11, golpe: 0.73 },
    { id: "cinematic-reverse-3", nombre: "Cinematic Reverse 3", cat: 'reverso', dur: 3.44, golpe: 3.38 },
    { id: "cinematic-reverse-4", nombre: "Cinematic Reverse 4", cat: 'reverso', dur: 2.93, golpe: 2.68 },
    { id: "cinematic-reverse-5", nombre: "Cinematic Reverse 5", cat: 'reverso', dur: 2.5, golpe: 2.33 },
    { id: "cinematic-reverse-6", nombre: "Cinematic Reverse 6", cat: 'reverso', dur: 1.33, golpe: 1.18 },
    { id: "cinematic-reverse-7", nombre: "Cinematic Reverse 7", cat: 'reverso', dur: 3.41, golpe: 3.18 },
    { id: "cinematic-reverse-8", nombre: "Cinematic Reverse 8", cat: 'reverso', dur: 3.39, golpe: 3.08 },
    { id: "cinematic-reverse-9", nombre: "Cinematic Reverse 9", cat: 'reverso', dur: 3.14, golpe: 2.33 },
    { id: "analog-shutter", nombre: "Analog Shutter", cat: 'camara', dur: 8.58, golpe: 0.58 },
    { id: "camera-1", nombre: "Camera 1", cat: 'camara', dur: 0.39, golpe: 0.23 },
    { id: "camera-2", nombre: "Camera 2", cat: 'camara', dur: 0.63, golpe: 0.08 },
    { id: "camera-3", nombre: "Camera 3", cat: 'camara', dur: 1.02, golpe: 0.73 },
    { id: "camera-4", nombre: "Camera 4", cat: 'camara', dur: 0.29, golpe: 0.08 },
    { id: "camera-5", nombre: "Camera 5", cat: 'camara', dur: 0.34, golpe: 0.12 },
    { id: "camera-6", nombre: "Camera 6", cat: 'camara', dur: 0.42, golpe: 0.18 },
    { id: "camera-focus-and-shutter", nombre: "Camera Focus & Shutter", cat: 'camara', dur: 7.7, golpe: 0.03 },
    { id: "shutter-5dm4", nombre: "Shutter 5Dm4", cat: 'camara', dur: 0.65, golpe: 0.18 },
    { id: "shutter-zenit", nombre: "Shutter Zenit", cat: 'camara', dur: 2.81, golpe: 1.57 },
    { id: "vintage-flash", nombre: "Vintage Flash", cat: 'camara', dur: 2.8, golpe: 0.68 },
    { id: "vintage-flash-long", nombre: "Vintage Flash Long", cat: 'camara', dur: 25.07, golpe: 17.07 },
    { id: "apple-pay-success", nombre: "Apple Pay Success", cat: 'ui', dur: 1.54, golpe: 0.23 },
    { id: "button-pressed", nombre: "Button Pressed", cat: 'ui', dur: 0.74, golpe: 0.08 },
    { id: "chime", nombre: "Chime", cat: 'ui', dur: 1.59, golpe: 0.08 },
    { id: "click-button", nombre: "Click Button", cat: 'ui', dur: 2.04, golpe: 0.12 },
    { id: "game-start", nombre: "Game Start", cat: 'ui', dur: 1.44, golpe: 0.63 },
    { id: "game-ui", nombre: "Game UI", cat: 'ui', dur: 6.26, golpe: 0.58 },
    { id: "hover", nombre: "Hover", cat: 'ui', dur: 8.18, golpe: 0.18 },
    { id: "notification-1", nombre: "Notification 1", cat: 'ui', dur: 1.96, golpe: 0.18 },
    { id: "pop-sound", nombre: "Pop Sound", cat: 'ui', dur: 1.36, golpe: 0.08 },
    { id: "success", nombre: "Success", cat: 'ui', dur: 3.03, golpe: 0.48 },
    { id: "swipe", nombre: "Swipe", cat: 'ui', dur: 0.08, golpe: 0.03 },
    { id: "ui-back-sound", nombre: "UI Back Sound", cat: 'ui', dur: 0.74, golpe: 0.43 },
    { id: "ui-sound", nombre: "UI Sound", cat: 'ui', dur: 3.24, golpe: 0.48 },
    { id: "ui-sound-3", nombre: "UI Sound 3", cat: 'ui', dur: 3.11, golpe: 0.33 },
    { id: "ui-sound-4", nombre: "UI Sound 4", cat: 'ui', dur: 0.68, golpe: 0.33 },
    { id: "ui-sound-6", nombre: "UI Sound 6", cat: 'ui', dur: 0.89, golpe: 0.12 },
    { id: "ui-sound-7", nombre: "UI Sound 7", cat: 'ui', dur: 2.04, golpe: 0.12 },
    { id: "ui-sound-8", nombre: "UI Sound 8", cat: 'ui', dur: 1.18, golpe: 0.43 },
    { id: "ui-sound-off", nombre: "UI Sound Off", cat: 'ui', dur: 3.34, golpe: 0.33 }
  ];
  var POR_ID = {};
  LISTA.forEach(function (s) { s.url = BASE + s.cat + '/' + s.id + '.mp3'; POR_ID[s.id] = s; });
  function porId(id) { return POR_ID[id] || null; }
  function deCategoria(cat) { return LISTA.filter(function (s) { return s.cat === cat; }); }
  var API = { BASE: BASE, CATEGORIAS: CATEGORIAS, LISTA: LISTA, porId: porId, deCategoria: deCategoria };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherrySonidos = API;
})(typeof window !== 'undefined' ? window : this);

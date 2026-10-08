/* familias.js — el catálogo de estilos de carrusel y el COMPOSITOR de cada uno (30-sep-2026).
 *
 * Cada familia es una copia de una referencia que Sergio aprobó (banco de pruebas: Downloads\Cherry Carruseles\
 * PARA-IMPLEMENTAR). Por familia:
 *   · catálogo: nombre, para qué objetivos sirve (regla 12: Cherry AVISA si no encaja, sin bloquear), qué material usa,
 *     si sale en video, sus papeles de letra y sus colores de muestra.
 *   · esquema: qué texto lleva cada lámina y cuántas letras caben (lo llena el director, función «carruseles»).
 *   · armar(contenido, material, alto): devuelve la LISTA DE ELEMENTOS de cada lámina, con las mismas medidas del HTML
 *     aprobado. Desde ahí el usuario lo mueve todo (lienzo.js).
 * Letras y colores siempre por papel (@titular, @principal…): los llena la marca o el usuario (regla 14).
 */
window.FAMILIAS = (function () {
  'use strict';
  var T = function (o) { return LZ.T(o); }, nid = function () { return LZ.nid(); };
  var BASE = 'carruseles/';
  var ICONOS_OK = ['arrow-right', 'circle-help', 'triangle-alert', 'sparkles', 'book-open', 'lightbulb', 'heart', 'message-circle', 'messages-square', 'bookmark', 'clock', 'key-round', 'camera', 'scissors', 'trending-up', 'wrench', 'repeat', 'folder-open', 'hammer', 'clapperboard', 'list-ordered', 'list-checks', 'smartphone', 'image', 'type', 'paperclip', 'mic', 'calendar-days', 'target', 'video', 'chart-line', 'search', 'zap', 'archive', 'pencil'];

  /* ── Catálogo (las 18 aprobadas; «lista» = ya se puede usar) ── */
  var CATALOGO = [
    { id: 'guardable', nombre: 'Guardable', lista: true, ideal: ['tutorial'], sirve: ['venta'], no: [], material: 'Una foto tuya + clips o fotos para los celulares', sale: 'JPG', alto: 1440, anim: false, ia: false,
      letras: { titular: 'Anton', mano: 'Caveat', cuerpo: 'Inter' }, colores: { principal: '#E1251B', acento: '#FFD60A', fondo: '#F4EEE6', texto: '#141414' } },
    { id: 'aire', nombre: 'Aire', ideal: ['motivacion', 'opinion'], sirve: ['historia'], no: ['tutorial'], material: 'Fotos tuyas', sale: 'JPG', alto: 1440 },
    { id: 'letra', nombre: 'Letra viva', ideal: ['opinion', 'tutorial'], sirve: ['motivacion'], no: [], material: 'Fotos tuyas', sale: 'JPG', alto: 1350 },
    { id: 'charla', nombre: 'Cine callado', ideal: ['opinion'], sirve: ['historia'], no: [], material: 'Fotos tuyas', sale: 'JPG', alto: 1350 },
    { id: 'marca', nombre: 'Te escribió una marca', ideal: ['opinion', 'tutorial'], sirve: [], no: [], material: 'Fotos tuyas', sale: 'JPG', alto: 1350 },
    { id: 'cintas', nombre: 'Cintas', ideal: ['tutorial'], sirve: ['venta'], no: [], material: 'Fotos tuyas', sale: 'JPG', alto: 1350 },
    { id: 'brillo', nombre: 'Paso con brillo', ideal: ['tutorial'], sirve: ['venta'], no: ['motivacion'], material: 'Fotos tuyas', sale: 'JPG', alto: 1350 },
    { id: 'revista2', nombre: 'Marca de revista', ideal: ['historia', 'opinion'], sirve: ['motivacion'], no: [], material: 'Fotos tuyas', sale: 'JPG', alto: 1350 },
    { id: 'libreta', nombre: 'Libreta a mano', ideal: ['tutorial'], sirve: ['opinion'], no: [], material: 'Dibujos de tus fotos', sale: 'JPG', alto: 1350 },
    { id: 'crema', nombre: 'Crema con serifa', ideal: ['historia', 'venta'], sirve: ['opinion'], no: [], material: 'Fotos tuyas', sale: 'JPG', alto: 1350 },
    { id: 'caricatura', nombre: 'Caricatura', ideal: ['historia', 'tutorial'], sirve: [], no: [], material: 'Tu caricatura (IA)', sale: 'JPG', alto: 1350, ia: true },
    { id: 'frase', nombre: 'Frase que se repite', ideal: ['opinion', 'motivacion'], sirve: [], no: ['tutorial'], material: 'Solo texto', sale: 'JPG', alto: 1350, texto: true },
    { id: 'estudio', nombre: 'Foto de estudio', ideal: ['tutorial', 'venta'], sirve: [], no: [], material: 'Tus fotos IA por lámina', sale: 'JPG', alto: 1350, ia: true },
    { id: 'tendencia', nombre: 'Tendencia de la semana', ideal: ['tendencia'], sirve: ['tutorial'], no: ['motivacion'], material: 'Clips tuyos', sale: 'MP4', alto: 1350, anim: true },
    { id: 'celular', nombre: 'Tendencia en celular', ideal: ['tendencia', 'tutorial'], sirve: [], no: ['motivacion'], material: 'Clips y pantallas', sale: 'MP4', alto: 1350, anim: true },
    { id: 'hooks', nombre: 'Hooks con cara pegada', ideal: ['tutorial'], sirve: ['opinion'], no: [], material: 'Clips + calcomanía de tu cara', sale: 'MP4', alto: 1350, anim: true },
    { id: 'stickers', nombre: 'Calcomanías', ideal: ['tutorial', 'opinion'], sirve: [], no: [], material: 'Texto + calcomanías', sale: 'JPG', alto: 1350, texto: true },
    { id: 'abanico', nombre: 'Abanico de pantallas', ideal: ['tutorial', 'venta'], sirve: ['llevar'], no: [], material: 'Capturas de pantalla, tus videos o tus fotos', sale: 'JPG', alto: 1350, anim: false },
    /* (8-oct) las de la herramienta HISTORIAS (1080×1920): solo salen allá (historia + soloHistoria) */
    { id: 'h_conocemos', nombre: '¿Nos conocemos?', historia: true, soloHistoria: true, ideal: ['historia'], sirve: ['venta', 'llevar'], no: [], material: 'Fotos tuyas (sale tu recorte)', sale: 'JPG', alto: 1920 },
    { id: 'h_foto', nombre: 'Foto con titular', historia: true, soloHistoria: true, ideal: ['tutorial'], sirve: ['opinion'], no: [], material: 'Fotos tuyas', sale: 'JPG', alto: 1920 },
    { id: 'h_gigante', nombre: 'Letra gigante', historia: true, soloHistoria: true, ideal: ['motivacion', 'opinion'], sirve: ['llevar'], no: [], material: 'Fotos tuyas (sale tu recorte)', sale: 'JPG', alto: 1920 },
    { id: 'h_palabra', nombre: 'Palabra gigante', historia: true, soloHistoria: true, ideal: ['opinion', 'tutorial'], sirve: ['venta'], no: [], material: 'Fotos tuyas (sale tu recorte)', sale: 'JPG', alto: 1920 },
    { id: 'revista3', nombre: 'Revista de tendencias', ideal: ['tendencia', 'tutorial'], sirve: [], no: ['motivacion'], material: 'Clips tuyos', sale: 'MP4', alto: 1350, anim: true },
  ];
  var NOMOBJ = { tutorial: 'enseñar', motivacion: 'motivar', opinion: 'opinión', venta: 'vender', historia: 'historias', tendencia: 'tendencias', llevar: 'llevar a algo' };

  /* ── Fotos: encuadre en la lámina y lo que dice la rejilla de la Lambda ── */
  function decodificar(b64) { var s = atob(b64 || ''), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  /* La foto llena la lámina (sin bandas): la cara queda a 1/3 de la altura (o la silueta centrada), igual que detectar.py. */
  function encuadre(f, W, H, opc) {
    opc = opc || {};
    var s = Math.max(W / f.w, H / f.h) * (opc.zoom || 1), dw = f.w * s, dh = f.h * s;
    var c = f.cara, p = f.persona;
    var cy = c ? c[1] + c[3] / 2 : p ? p[1] + p[3] / 2 : f.h / 2, cx = c ? c[0] + c[2] / 2 : p ? p[0] + p[2] / 2 : f.w / 2;
    var top = Math.min(Math.max(0, cy * s - H * (c ? (opc.alturaCara || .33) : .5)), dh - H);
    var left = Math.min(Math.max(0, cx * s - W * (opc.centroX || .5)), dw - W);
    return { x: -Math.round(left), y: -Math.round(top), w: Math.round(dw), h: Math.round(dh), s: s,
      cara: c ? [c[0] * s - left, c[1] * s - top, c[2] * s, c[3] * s] : null,
      persona: p ? [p[0] * s - left, p[1] * s - top, p[2] * s, p[3] * s] : null };
  }
  function mapa(f, g, W, H) {   // ¿cuánta persona / detalle / luz hay en un rectángulo de la lámina?
    var R = f.rejilla; if (!R) return null;
    var per = decodificar(R.persona), bor = decodificar(R.bordes), luz = decodificar(R.luz);
    function medir(x, y, w, h) {
      var n = 0, sp = 0, sb = 0, sl = 0;
      for (var yy = y; yy < y + h; yy += 12) for (var xx = x; xx < x + w; xx += 12) {
        var fx = (xx - g.x) / g.w, fy = (yy - g.y) / g.h;
        if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) continue;
        var i = Math.floor(fy * R.h) * R.w + Math.floor(fx * R.w);
        sp += per[i] / 255; sb += bor[i] / 255; sl += luz[i] / 255; n++;
      }
      return n ? { persona: sp / n, detalle: sb / n, luz: sl / n } : { persona: 0, detalle: 0, luz: .5 };
    }
    return { medir: medir };
  }
  function recorteEl(f, g, extra) {   // la persona sola, pegada a su foto (se mueve y se agranda con ella)
    if (!f.recorte_url || !f.recorte_caja) return null;
    var k = f.recorte_caja;
    return Object.assign({ id: nid(), tipo: 'imagen', nombre: 'Tú (recorte)', papel: 'recorte', interno: true, src: f.recorte_url, ref: { foto: f.id, campo: 'recorte' },
      recCaja: [k[0] / f.w, k[1] / f.h, k[2] / f.w, k[3] / f.h], x: g.x, y: g.y, w: g.w, h: g.h, z: 4, rot: 0, op: 1 }, extra || {});
  }
  function fotoEl(f, g, extra) {
    return Object.assign({ id: nid(), tipo: 'imagen', nombre: 'Tu foto', papel: 'foto', src: f.url, ref: { foto: f.id, campo: 'foto' },
      x: g.x, y: g.y, w: g.w, h: g.h, z: 1, rot: 0, op: 1, radio: 0, zoom: 1, brillo: 1, contraste: 1, sat: 1, bn: false }, extra || {});
  }
  // la foto que mejor sirve para una portada: con cara, grande y con espacio arriba
  function mejorFoto(fotos, evitar) {
    var c = fotos.filter(function (f) { return f && f.w && evitar.indexOf(f.id) < 0; });
    c.sort(function (a, b) { return puntaje(b) - puntaje(a); });
    return c[0] || fotos[0] || null;
    function puntaje(f) { var p = 0; if (f.cara) p += 2 + Math.min(2, (f.cara[2] * f.cara[3]) / (f.w * f.h) * 60); if (f.persona) p += 1; if (f.recorte_url) p += 1; return p; }
  }

  /* ════════════════ GUARDABLE (copia del sistema de @rubiamarketera) ════════════════ */
  var guardable = {
    esquema: {
      nombre: 'Guardable', nItems: 5, iconos: ICONOS_OK,
      guia: 'Carrusel para GUARDAR: portada con un número grande y la promesa; cada lámina del medio es UN elemento de la lista con un ejemplo que se dice tal cual («Dilo así»), por qué funciona y en qué tipo de contenido usarlo; el cierre pregunta cuál van a probar primero.',
      portada: {
        titular: { max: 14, desc: 'una o dos palabras: QUÉ son (p. ej. «Ganchos»)' },
        subtitulo: { max: 24, desc: 'complemento corto con UNA palabra *resaltada* (p. ej. «para tus *reels*»)' },
        nota: { max: 34, desc: 'nota a mano que precisa la promesa (p. ej. «para los primeros 3 segundos»)' },
        etiquetas: { lista: 4, desc: '4 etiquetas cortas de los tipos que hay adentro', campos: { t: { max: 12, desc: 'palabra' }, icono: { max: 20, desc: 'ícono de la lista' } } },
      },
      item: {
        titulo: { max: 28, desc: 'nombre del elemento: primera palabra normal y el resto *resaltado* (p. ej. «La *pregunta incómoda*»)' },
        frase: { max: 70, desc: 'el ejemplo que se dice TAL CUAL, sin comillas' },
        porque: { max: 110, desc: 'por qué funciona, empezando en minúscula (sigue a «Funciona porque»)' },
        etiquetas: { lista: 3, desc: '3 tipos de contenido donde sirve', campos: { t: { max: 16, desc: 'palabra' }, icono: { max: 20, desc: 'ícono de la lista' } } },
        nota: { max: 40, desc: 'nota a mano corta, en tono de consejo' },
        usar: { max: 50, desc: 'en qué usarlo, con lo primero *resaltado* (p. ej. «*Úsalo en tutoriales* y en errores.»)' },
      },
      cierre: {
        titular: { max: 34, desc: 'pregunta de cierre con lo último *resaltado* (p. ej. «¿Cuál vas a *probar primero?*»)' },
        texto: { max: 80, desc: 'una frase que invita a usarlo hoy' },
        boton: { max: 34, desc: 'botón para comentar (p. ej. «Cuéntame en los comentarios»)' },
        guardar: { max: 36, desc: 'botón para guardar, en mayúsculas' },
      },
      comun: {
        rotulo: { max: 16, desc: 'rótulo de arriba de cada lámina: número + qué (p. ej. «7 ganchos»)' },
        pastilla: { max: 10, desc: 'la palabra de la pastilla de cada lámina, en singular (p. ej. «Gancho», «Paso», «Error»)' },
        dilo: { max: 14, desc: 'rótulo encima de la frase de ejemplo (p. ej. «Dilo así», «Escríbelo así»)' },
        pie_izq: { max: 14, desc: 'palabra del pie a la izquierda (p. ej. «Ganchos»)' },
        pie_der: { max: 22, desc: 'palabras del pie a la derecha (p. ej. «Primeros 3 segundos»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1440, n = (c.items || []).length, total = n + 2;
      var usadas = [], fotos = (mat && mat.fotos) || [], clips = (mat && mat.clips) || [];
      var pF = mejorFoto(fotos, usadas); if (pF) usadas.push(pF.id);
      var laminas = [portada(), ];
      (c.items || []).forEach(function (it, k) { laminas.push(interior(it, k + 1)); });
      laminas.push(cierre());
      return laminas;

      function portada() {
        var els = [], z = 60, bajo = 552;
        if (pF) {
          var g = encuadre(pF, W, H);
          els.push(fotoEl(pF, g, { brillo: .72, contraste: 1.08, sat: .9 }));
          var rec = recorteEl(pF, g); if (rec) { rec.sigue = els[0].id; els.push(rec); }
          if (g.cara) bajo = Math.max(300, g.cara[1] - 30);
          els.push({ id: nid(), tipo: 'forma', nombre: 'Sombra sobre la foto', papel: 'sombra', interno: true, de: els[0].id, fondo: 'radial-gradient(120% 70% at 50% 100%,rgba(225,37,27,.35),transparent 60%),linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,0) 45%,rgba(0,0,0,.55))', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 });
        }
        var tam7 = Math.min(330, bajo - z - 20), num = String(n);
        els.push(
          T({ nombre: 'Contador', papel: 'contador-portada', txt: '1/' + total, y: 54, tam: 22, color: '#FFFFFF', caja: { borde: 'rgba(255,255,255,.7)', bw: 2, radio: 999, padV: 8, padH: 20 }, z: 6, _der: W - 60 }),
          T({ nombre: 'Número grande', papel: 'numero', txt: num, x: 60, y: z + 40, fuente: '@titular', tam: tam7, peso: 400, color: '@principal', interl: .8, mayus: true, z: 3 }),
          T({ nombre: 'Titular', papel: 'titular-portada', txt: c.portada.titular || '', x: 60 + Math.round(tam7 * .5 * Math.max(1, num.length)) + 75, y: z + 50, fuente: '@titular', tam: 170, peso: 400, color: '#FFFFFF', interl: .9, mayus: true }),
          T({ nombre: 'Subtítulo', papel: 'subtitulo', txt: c.portada.subtitulo || '', x: 60 + Math.round(tam7 * .5 * Math.max(1, num.length)) + 75, y: z + 210, fuente: '@titular', tam: 84, peso: 400, color: '#FFFFFF', colorAc: '@acento', interl: .9, mayus: true }),
          { id: nid(), tipo: 'rayas', nombre: 'Rayitas', papel: 'rayas', color: '@principal', giro: -30, x: 990, y: z + 30, w: 90, h: 90, z: 6, rot: 0, op: 1 },
          T({ nombre: 'Nota a mano', papel: 'nota-portada', txt: c.portada.nota || '', y: z + 320, fuente: '@mano', tam: 48, color: '#FFFFFF', interl: .95, rot: -5, z: 6, _der: W - 60 })
        );
        (c.portada.etiquetas || []).filter(function (e) { return e && e.t; }).forEach(function (e) {
          els.push(T({ nombre: 'Etiqueta «' + e.t + '»', papel: 'etiqueta-portada', txt: e.t, y: H - 120 - 57, tam: 24, peso: 800, icono: e.icono || 'sparkles', iconoColor: '@principal', caja: { fondo: '#FFFFFF', radio: 999, padV: 14, padH: 22 }, z: 6, _fila: { grupo: 'chips', x: 60, gap: 16 } }));
        });
        els.push(T({ nombre: '«Desliza»', papel: 'desliza', txt: 'Desliza', x: 60, y: H - 52 - 32, tam: 24, espac: .12, mayus: true, color: '#FFFFFF', icono: 'arrow-right', iconoLado: 'der', z: 6 }));
        els.push({ id: nid(), tipo: 'grano', nombre: 'Textura de grano', papel: 'grano', z: 90, op: .18, mezcla: 'overlay', x: 0, y: 0, w: W, h: H, rot: 0 });
        return { fondo: '#0c0c0c', els: els };
      }
      function interior(it, k) {
        var t = String(it.titulo || ''), sp = t.indexOf(' ');
        if (t.indexOf('*') < 0 && sp > 0) t = t.slice(0, sp) + ' *' + t.slice(sp + 1) + '*';
        var clip = clips[k - 1] || null, fotoCel = !clip && fotos.length ? fotos[(k) % fotos.length] : null;
        var pila = { grupo: 'p', x: 444, w: 536, y: 560, h: 650, gap: 26, gapChip: 12 };
        var els = [
          T({ nombre: 'Rótulo de sección', papel: 'rotulo', txt: c.comun.rotulo || '', x: 60, y: 54, tam: 22, espac: .06, mayus: true, icono: 'arrow-right', iconoLado: 'der', caja: { borde: '@texto', bw: 2.5, radio: 999, padV: 10, padH: 22 } }),
          T({ nombre: 'Contador', papel: 'contador', txt: (k + 1) + '/' + total, y: 62, tam: 28, espac: .04, _der: W - 60 }),
          T({ nombre: 'Pastilla del número', papel: 'pastilla', txt: (c.comun.pastilla || 'Nº') + ' ' + String(k).padStart(2, '0'), x: 60, y: 150, fuente: '@titular', tam: 40, peso: 400, mayus: true, color: '#FFFFFF', rot: -2, z: 6, caja: { fondo: '@principal', radio: 999, padV: 12, padH: 26 } }),
          T({ nombre: 'Titular', papel: 'titular', txt: t, x: 60, y: 228, w: 720, fuente: '@titular', tam: 132, peso: 400, interl: .9, mayus: true }),
          { id: nid(), tipo: 'rayas', nombre: 'Rayitas', papel: 'rayas', color: '@principal', giro: -145, x: 40, y: 120, w: 81, h: 81, z: 6, rot: 0, op: 1 },
          T({ nombre: 'Nota a mano', papel: 'nota', txt: it.nota || '', x: 790, y: 150, w: 230, fuente: '@mano', tam: 40, color: '@principal', interl: .95, alin: 'right', rot: -6 }),
          { id: nid(), tipo: 'flecha', nombre: 'Flecha', papel: 'flecha', src: BASE + 'piezas/fl-sube-tinta.png', color: '@principal', x: 840, y: 360, w: 120, h: 90, rot: 180, z: 5, op: 1 },
          { id: nid(), tipo: 'forma', nombre: 'Tarjeta blanca', papel: 'tarjeta', fondo: '#FFFFFF', radio: 40, sombra: true, x: 60, y: 560, w: 960, h: 650, z: 2, rot: 0, op: 1 },
          { id: nid(), tipo: 'celular', nombre: clip ? 'Celular con tu clip' : 'Celular con tu foto', papel: 'celular', src: clip ? clip.url : fotoCel ? fotoCel.url : '', ref: clip ? { clip: clip.id, t: clip.t || 0 } : fotoCel ? { foto: fotoCel.id, campo: 'foto' } : null, posY: 30, texto: it.frase || '', x: 100, y: 590, w: 300, h: 590, z: 3, rot: 0, op: 1 },
          T({ nombre: '«Dilo así»', papel: 'rotulo-chico', txt: c.comun.dilo || 'Dilo así', w: 536, tam: 22, peso: 800, espac: .16, mayus: true, color: '#8A8178', _pila: pila }),
          T({ nombre: 'La frase', papel: 'cita', txt: '«' + (it.frase || '') + '»', w: 536, tam: 46, peso: 800, interl: 1.08, espac: -.02, _pila: pila }),
          { id: nid(), tipo: 'forma', nombre: 'Línea', papel: 'linea', fondo: '#E4DBCF', radio: 0, w: 536, h: 2, z: 5, rot: 0, op: 1, x: 444, y: 0, _pila: pila },
          T({ nombre: 'Por qué funciona', papel: 'cuerpo', txt: '*Funciona porque* ' + String(it.porque || '').replace(/^\s*\*?funciona porque\*?[:,]?\s*/i, ''), w: 536, tam: 30, peso: 500, interl: 1.3, color: '#4A4540', colorAc: '@texto', modoAc: 'negrita', _pila: pila })
        ];
        (it.etiquetas || []).filter(function (e) { return e && e.t; }).forEach(function (e) { els.push(T({ nombre: 'Etiqueta «' + e.t + '»', papel: 'etiqueta', txt: e.t, tam: 22, peso: 600, icono: e.icono || 'sparkles', iconoColor: '@principal', caja: { borde: '#E4DBCF', bw: 2, radio: 999, padV: 10, padH: 18 }, _pila: pila, _chip: true })); });
        els.push(
          { id: nid(), tipo: 'flecha', nombre: 'Flecha curva', papel: 'flecha-curva', src: BASE + 'piezas/fl-curva-tinta.png', color: '@principal', x: 60, y: 1240, w: 150, h: 60, rot: 0, z: 5, op: 1 },
          T({ nombre: 'Para qué usarlo', papel: 'conclusion', txt: it.usar || '', x: 230, y: 1236, w: 790, tam: 32, peso: 600, interl: 1.3, modoAc: 'marcador' }),
          { id: nid(), tipo: 'barra', nombre: 'Barra de avance', papel: 'barra', valor: k / n, izq: c.comun.pie_izq || '', der: c.comun.pie_der || '', color: '@principal', fondoBarra: '#E4DBCF', colorTxt: '#8A8178', x: 60, y: H - 80, w: 960, h: 24, z: 5, rot: 0, op: 1 },
          { id: nid(), tipo: 'grano', nombre: 'Textura de grano', papel: 'grano', z: 90, op: .18, mezcla: 'multiply', x: 0, y: 0, w: W, h: H, rot: 0 }
        );
        return { fondo: '@fondo', els: els };
      }
      function cierre() {
        var els = [T({ nombre: 'Contador', papel: 'contador', txt: total + '/' + total, y: 62, tam: 28, _der: W - 60 })];
        var cF = mejorFoto(fotos.filter(function (f) { return f.recorte_url; }), usadas) || pF;
        if (cF && cF.recorte_url) {
          var g = encuadre(cF, W, H, { zoom: 1.08, centroX: .28 });
          var k = cF.recorte_caja;
          els.push({ id: nid(), tipo: 'imagen', nombre: 'Tú (recorte)', papel: 'persona', src: cF.recorte_url, ref: { foto: cF.id, campo: 'recorte' },
            x: Math.round(g.x + k[0] * g.s + 280), y: Math.round(g.y + k[1] * g.s), w: Math.round(k[2] * g.s), h: Math.round(k[3] * g.s), z: 4, rot: 0, op: 1, radio: 0, zoom: 1, brillo: 1, contraste: 1, sat: 1 });
        }
        els.push(
          T({ nombre: 'Titular', papel: 'titular-cierre', txt: c.cierre.titular || '', x: 60, y: 150, w: 640, fuente: '@titular', tam: 150, peso: 400, interl: .9, mayus: true, z: 3 }),
          { id: nid(), tipo: 'rayas', nombre: 'Rayitas', papel: 'rayas', color: '@principal', giro: -140, x: 40, y: 90, w: 81, h: 81, z: 4, rot: 0, op: 1 },
          T({ nombre: 'Texto', papel: 'texto-cierre', txt: c.cierre.texto || '', x: 60, y: 800, w: 560, tam: 34, peso: 500, interl: 1.35, z: 3 }),
          T({ nombre: 'Botón comentar', papel: 'boton', txt: c.cierre.boton || '', x: 60, y: 1000, tam: 34, peso: 800, interl: 1.1, color: '#FFFFFF', icono: 'message-circle', caja: { fondo: '@principal', radio: 999, padV: 24, padH: 34 }, z: 3 }),
          T({ nombre: 'Botón guardar', papel: 'boton-guardar', txt: c.cierre.guardar || '', x: 60, y: 1180, tam: 26, peso: 800, mayus: true, icono: 'bookmark', caja: { borde: '@texto', bw: 3, radio: 999, padV: 16, padH: 30 }, z: 3 }),
          { id: nid(), tipo: 'grano', nombre: 'Textura de grano', papel: 'grano', z: 90, op: .18, mezcla: 'multiply', x: 0, y: 0, w: W, h: H, rot: 0 }
        );
        return { fondo: '@fondo', els: els };
      }
    },
  };

  var RETIRADAS = ['charla', 'marca', 'cintas', 'brillo', 'libreta', 'crema', 'stickers', 'hooks', 'revista3'];
  CATALOGO.forEach(function (f) { if (RETIRADAS.indexOf(f.id) >= 0) f.retirada = true; });
  var COMPOSITORES = { guardable: guardable };
  var UTIL = { T: T, nid: nid, encuadre: encuadre, mapa: mapa, fotoEl: fotoEl, recorteEl: recorteEl, mejorFoto: mejorFoto, BASE: BASE, ICONOS_OK: ICONOS_OK };
  return {
    util: UTIL,
    // cada estilo vive en familias/<id>.js y se registra aquí: desde ese momento se puede usar
    /* (30-sep) estilos RETIRADOS por Sergio (ronda 3: «se va»): ya no salen en la lista ni los propone la IA, pero siguen
       cargados para que los carruseles que ya se hicieron con ellos se abran y se editen igual. */
    RETIRADAS: RETIRADAS,
    registrar: function (id, comp) { COMPOSITORES[id] = comp; var f = CATALOGO.filter(function (x) { return x.id === id; })[0]; if (f) { f.lista = true; if (comp.catalogo) Object.assign(f, comp.catalogo); } },
    CATALOGO: CATALOGO, NOMOBJ: NOMOBJ, ICONOS_OK: ICONOS_OK,
    de: function (id) { return CATALOGO.filter(function (f) { return f.id === id; })[0] || CATALOGO[0]; },
    compositor: function (id) { return COMPOSITORES[id] || null; },
    esquema: function (id) { var c = COMPOSITORES[id]; return c ? c.esquema : null; },
    // regla 12: si la familia no sirve para el objetivo, las que sí (para el aviso)
    aviso: function (id, objetivo) {
      var f = this.de(id); if (!objetivo || objetivo === 'auto' || (f.no || []).indexOf(objetivo) < 0) return null;
      return { familia: f, mejores: CATALOGO.filter(function (x) { return x.lista && x.id !== id && (x.ideal || []).indexOf(objetivo) >= 0; }).slice(0, 3) };
    },
    encuadre: encuadre, mapa: mapa,
  };
})();

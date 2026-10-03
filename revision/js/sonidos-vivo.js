/* sonidos-vivo.js — los efectos de sonido del Guion SUENAN en la vista previa (24-sep-2026)
 *
 * Sergio: «que los sonidos también se oigan en la vista previa». Antes solo se oían en el video que Cherry rehace en
 * segundo plano (un par de minutos después de ponerlos).
 *
 * Se tocan en vivo, sincronizados con el <video> que muestra el celular, con el MISMO cálculo que el ensamblador: el
 * golpe de cada efecto cae en su palabra (reloj de las palabras del video + «mover»).
 *
 * ⚠️ Que nada suene dos veces. El celular muestra una de tres cosas:
 *   · la base antes de generar, o la base con color/movimiento en vivo → NO trae sonidos: se tocan todos;
 *   · el video ya hecho → trae horneados los sonidos con que se hizo (subtitle_config.sonidos): se tocan solo los
 *     nuevos o cambiados. Uno quitado sigue sonando en ese video hasta que Cherry lo rehace (lo hace sola).
 *
 * (24-sep, noche) CON WEB AUDIO. Sergio: «al reproducir algunos sonidos no suenan, y los de Cherry casi no los escucho».
 * Antes cada efecto era un <audio>: si no había cargado cuando llegaba su golpe, no sonaba o sonaba tarde, y el
 * navegador no pasa del 100 % (un efecto al 150 % sonaba igual que al 100 %). Ahora cada archivo se baja y se
 * decodifica UNA vez, en memoria, y se toca con su ganancia real (150 % = 1,5). Sobre un video con la voz de estudio
 * los efectos van corridos lo mismo que en el video final (renders.voz_estudio.efectos_db): lo que se oye es lo que sale.
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const S = () => window.CherrySonidos || null;
  const clave = (x) => [x.sonido, Math.round(Number(x.palabra)), Math.round((Number(x.mover) || 0) * 10), x.vol == null ? 100 : Math.round(Number(x.vol))].join('|');

  /* Qué video se ve y con qué reloj */
  function fuente(s) {
    if (s.pantalla !== 'editor') return null;
    const ctx = C.movVivo && C.movVivo.contexto ? C.movVivo.contexto() : null;
    if (ctx && ctx.video && ctx.aReal && ctx.palabras) return { video: ctx.video, aReal: ctx.aReal, palabras: ctx.palabras, horneados: [], efectosDb: 0 };
    const v = C.videoVista ? C.videoVista() : null;
    const d = v && C.cortesVivo && C.cortesVivo.datosVideo ? C.cortesVivo.datosVideo() : null;
    if (v && d && d.aReal && d.palabras) return { video: v, aReal: d.aReal, palabras: d.palabras, horneados: d.sonidos || [], efectosDb: Number(d.efectosDb) || 0 };
    return null;
  }

  /* Cuándo empieza cada uno (segundos del video): el golpe en su palabra */
  let cache = { k: '', lista: [] };
  function aTocar(F) {
    const Sx = S();
    const mios = Array.isArray(C.state.sonidos) ? C.state.sonidos : [];
    if (!Sx || !mios.length) return [];
    const ya = {};
    (F.horneados || []).forEach((x) => { ya[clave(x)] = true; });
    const k = mios.map(clave).join(',') + '#' + Object.keys(ya).join(',') + '#' + F.palabras.length + '#' + F.efectosDb;
    if (cache.k === k && cache.F === F.video) return cache.lista;
    const fx = Math.pow(10, (F.efectosDb || 0) / 20);
    const lista = mios.filter((x) => !ya[clave(x)]).map((x) => {
      const s = Sx.porId(x.sonido), w = F.palabras[Math.round(Number(x.palabra))];
      if (!s || !w) return null;
      const ini = F.aReal(Number(w.start)) + (Number(x.mover) || 0) - s.golpe;
      return { url: s.url, ini, vol: (x.vol == null ? 100 : Number(x.vol)) * fx, dur: s.dur };
    }).filter(Boolean);
    cache = { k, lista, F: F.video };
    return lista;
  }

  /* ── La mesa de sonido: un AudioContext; cada archivo se baja y se decodifica una vez ── */
  let mesa = null;
  const listos = {}, pedidos = {}, sonando = [];
  function abrirMesa() {
    if (!mesa) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { mesa = new AC(); } catch (_) { return null; }
    }
    if (mesa.state === 'suspended' && mesa.resume) { try { const p = mesa.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
    return mesa;
  }
  // el navegador solo deja sonar después de un toque: la mesa se abre con el primero (el mismo que le da play al video)
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => abrirMesa(), { capture: true, passive: true }));

  function cargar(url) {
    if (listos[url] || pedidos[url]) return;
    const m = abrirMesa();
    if (!m) return;
    pedidos[url] = fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((ok, mal) => m.decodeAudioData(ab, ok, mal)))
      .then((b) => { listos[url] = b; })
      .catch((e) => { console.warn('[Sonidos] no cargó ' + String(url).slice(-40), e); })
      .then(() => { delete pedidos[url]; });
  }
  // se cargan antes de que haga falta: el primer golpe no puede llegar tarde
  let precargados = '';
  function precargar(lista) {
    const k = lista.map((x) => x.url).join(',');
    if (k === precargados) return;
    precargados = k;
    lista.forEach((x) => cargar(x.url));
  }

  function tocar(x, desfase, v) {
    const m = abrirMesa(), b = listos[x.url];
    if (!m || !b) { cargar(x.url); return; }
    const desde = Math.max(0, desfase);
    if (desde >= b.duration) return;
    try {
      const src = m.createBufferSource(), g = m.createGain();
      src.buffer = b;
      g.gain.value = Math.max(0, x.vol / 100) * (v.volume == null ? 1 : v.volume);   // 150 % suena al 150 %
      src.connect(g); g.connect(m.destination);
      src.onended = () => { const i = sonando.indexOf(src); if (i >= 0) sonando.splice(i, 1); };
      sonando.push(src);
      src.start(0, desde);
    } catch (_) { /* sin audio en este navegador */ }
  }
  function pararTodo() {
    sonando.splice(0).forEach((src) => { try { src.onended = null; src.stop(); } catch (_) {} });
  }

  let prevT = null, prevVid = null;
  function tick() {
    const F = fuente(C.state);
    if (!F) { if (sonando.length) pararTodo(); prevT = null; prevVid = null; return; }
    const v = F.video, lista = aTocar(F);
    precargar(lista);
    if (v !== prevVid) { pararTodo(); prevVid = v; prevT = null; }
    const t = Number(v.currentTime) || 0;
    if (v.paused || v.ended || v.muted) { if (sonando.length) pararTodo(); prevT = null; return; }
    /* Arranca (play), vuelve a empezar o se movió la barra: lo que en ESE punto ya debía estar sonando arranca desde
       su punto, como en una línea de tiempo. ⚠️ Antes se esperaba al siguiente golpe, y un sonido del inicio (el
       golpe en la primera palabra: arranca antes del segundo 0) no sonaba nunca: el video en reposo está en 0 y el
       cruce «antes de 0 → después de 0» no se veía. */
    if (prevT == null || t < prevT - 0.05 || t - prevT > 0.6) {
      pararTodo();
      lista.forEach((x) => { if (x.ini <= t && t - x.ini < x.dur - 0.05) tocar(x, t - x.ini, v); });
      prevT = t;
      return;
    }
    lista.forEach((x) => { if (x.ini > prevT && x.ini <= t) tocar(x, t - x.ini, v); });
    prevT = t;
  }
  setInterval(tick, 40);

  C.sonidosVivo = { _tick: tick, _aTocar: () => { const F = fuente(C.state); return F ? aTocar(F) : null; }, _listos: listos };
})();

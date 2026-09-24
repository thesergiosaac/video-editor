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
    if (ctx && ctx.video && ctx.aReal && ctx.palabras) return { video: ctx.video, aReal: ctx.aReal, palabras: ctx.palabras, horneados: [] };
    const v = C.videoVista ? C.videoVista() : null;
    const d = v && C.cortesVivo && C.cortesVivo.datosVideo ? C.cortesVivo.datosVideo() : null;
    if (v && d && d.aReal && d.palabras) return { video: v, aReal: d.aReal, palabras: d.palabras, horneados: d.sonidos || [] };
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
    const k = mios.map(clave).join(',') + '#' + Object.keys(ya).join(',') + '#' + F.palabras.length;
    if (cache.k === k && cache.F === F.video) return cache.lista;
    const lista = mios.filter((x) => !ya[clave(x)]).map((x) => {
      const s = Sx.porId(x.sonido), w = F.palabras[Math.round(Number(x.palabra))];
      if (!s || !w) return null;
      const ini = F.aReal(Number(w.start)) + (Number(x.mover) || 0) - s.golpe;
      return { url: s.url, ini, vol: x.vol == null ? 100 : Number(x.vol), dur: s.dur };
    }).filter(Boolean);
    cache = { k, lista, F: F.video };
    return lista;
  }

  /* Los reproductores: uno por archivo, se clona si el mismo suena dos veces a la vez */
  const libres = {}, sonando = [];
  function reproductor(url) {
    const l = libres[url] || (libres[url] = []);
    const a = l.pop() || new Audio(url);
    a.preload = 'auto';
    return a;
  }
  function tocar(x, desfase, v) {
    try {
      const a = reproductor(x.url);
      a.currentTime = Math.max(0, desfase);
      a.volume = Math.max(0, Math.min(1, (x.vol / 100) * (v.volume == null ? 1 : v.volume)));
      const fin = () => { const i = sonando.indexOf(a); if (i >= 0) sonando.splice(i, 1); (libres[x.url] = libres[x.url] || []).push(a); a.onended = null; };
      a.onended = fin;
      sonando.push(a);
      const p = a.play();
      if (p && p.catch) p.catch(fin);
    } catch (_) { /* sin audio en este navegador */ }
  }
  function pararTodo() {
    sonando.splice(0).forEach((a) => { try { a.pause(); a.onended && a.onended(); } catch (_) {} });
  }
  // se cargan antes de que haga falta: el primer golpe no puede llegar tarde
  let precargados = '';
  function precargar(lista) {
    const k = lista.map((x) => x.url).join(',');
    if (k === precargados) return;
    precargados = k;
    lista.forEach((x) => { const l = libres[x.url] || (libres[x.url] = []); if (!l.length) { const a = new Audio(x.url); a.preload = 'auto'; l.push(a); } });
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

  C.sonidosVivo = { _tick: tick, _aTocar: () => { const F = fuente(C.state); return F ? aTocar(F) : null; } };
})();

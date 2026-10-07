/* edicionvivo.js — LA CAPA DE EDICIÓN EN LA VISTA PREVIA (2-oct-2026)
 *
 * Sergio: «siempre la vista previa debe mostrar exactamente como va a quedar el video final, sin excepción». Un proyecto
 * puede traer una edición hecha a mano (tabla `ediciones`, docs/EDICION.md): capas de Remotion ya dibujadas que el
 * ensamblador (edicion.js) monta encima del color. Hasta hoy la vista previa no las mostraba. Aquí se hace lo MISMO que el
 * ensamblador:
 *   · solo si los cortes del video son los de la edición (si no, el ensamblador no la usa y aquí tampoco);
 *   · las capas (WebM con transparencia, en `ediciones/`, lectura pública desde el 2-oct) corren al mismo segundo que el
 *     video: 'capa' encima, 'dividida' encima y tu video se encoge a su tarjeta (MUEVE.dividida), 'profundo' detrás de ti
 *     (tu recorte encima, con la silueta de la edición, `silueta_key`);
 *   · con una edición no van los gráficos de la IA, las pantallas ni las escenas de apoyo;
 *   · la cámara queda quieta en las ventanas de la edición y donde hay dividida o profundo (±0,1 s);
 *   · los subtítulos se callan ('oculto') o se corren ('tarjeta', 'abajo') con la misma cuenta de edicion.js › moverSubtitulos.
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const BUCKET = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/';
  const E = { proyecto: null, fila: null, pedida: 0, videos: new Map(), hueco: null };
  const TOL_CORTE = 0.05;

  /* La edición activa del proyecto (se vuelve a leer al cambiar de proyecto y cada 2 min) */
  function fila() {
    const pid = C.session && C.session.projectId;
    if (!pid || !C.api || !C.api.leerEdicion) return null;
    if (E.proyecto !== pid) { E.proyecto = pid; E.fila = null; E.pedida = 0; soltarVideos(); }
    if (Date.now() - E.pedida > 120000) {
      E.pedida = Date.now();
      const ver = E.ver = (E.ver || 0) + 1;
      // (8-oct) una lectura que salió antes de quitar una capa no la devuelve (E.ver cambia al editar)
      C.api.leerEdicion(pid).then((f) => { if (E.proyecto === pid && E.ver === ver) E.fila = f || null; }).catch(() => null);
    }
    return E.fila;
  }
  /* edicion.js › mismosCortes */
  function mismosCortes(ed, cortes) {
    const a = ed && Array.isArray(ed.cortes) ? ed.cortes : null;
    const b = cortes && Array.isArray(cortes.cuts) ? cortes.cuts : (Array.isArray(cortes) ? cortes : null);
    if (!a) return true;
    if (!b || a.length !== b.length) return false;
    return a.every((x, i) => String(x[0]) === String(b[i].clipId) && Math.abs(Number(x[1]) - Number(b[i].startTime)) <= TOL_CORTE &&
      Math.abs(Number(x[2]) - Number(b[i].endTime)) <= TOL_CORTE);
  }
  /* edicion.js › preparar */
  function preparar(ed) {
    const capas = (Array.isArray(ed.capas) ? ed.capas : []).filter((c) => c && /^ediciones\//.test(String(c.key || '')) &&
      Number(c.t1) > Number(c.t0) && ['capa', 'dividida', 'profundo'].indexOf(c.forma) >= 0)
      .map((c) => ({ t0: Number(c.t0), t1: Number(c.t1), forma: c.forma, key: c.key, tipo: 'edicion' }));
    const quieto = (Array.isArray(ed.quieto) ? ed.quieto : []).map((v) => ({ t0: Number(v.t0), t1: Number(v.t1) }))
      .concat(capas.filter((p) => p.forma !== 'capa').map((p) => ({ t0: p.t0 - 0.1, t1: p.t1 + 0.1 })));
    const subs = (Array.isArray(ed.subtitulos) ? ed.subtitulos : []).filter((v) => v && ['tarjeta', 'abajo', 'oculto'].indexOf(v.modo) >= 0)
      .map((v) => ({ t0: Number(v.t0), t1: Number(v.t1), modo: v.modo }));
    return { capas, quieto, subs, silueta: ed.silueta_key ? BUCKET + ed.silueta_key : null };
  }
  /* La edición que manda en este video, o null */
  function activa(ctx) {
    const ed = fila();
    if (!ed || !ctx) return null;
    if (ctx.cortes !== undefined && !mismosCortes(ed, ctx.cortes)) return null;
    if (!ed._prep) ed._prep = preparar(ed);
    return ed._prep;
  }

  /* ── Las capas: un <video> por capa, al mismo segundo que el video ── */
  function videoDe(p) {
    let v = E.videos.get(p.key);
    if (!v) {
      v = document.createElement('video');
      v.className = 'ed-capa-vivo'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
      v.setAttribute('aria-hidden', 'true');
      v.src = BUCKET + p.key;
      E.videos.set(p.key, v);
    }
    return v;
  }
  function soltarVideos() {
    E.videos.forEach((v) => { try { v.pause(); v.remove(); } catch (e) { /* ya no está */ } });
    E.videos.clear();
  }
  function sincronizar(cv, video, t, p) {
    if (cv.readyState < 1) return;
    const lt = Math.max(0, t - p.t0), dif = Math.abs(cv.currentTime - lt);
    if (video.paused) { if (!cv.paused) cv.pause(); if (dif > 0.02 && !cv.seeking) cv.currentTime = lt; return; }
    if (cv.playbackRate !== video.playbackRate) cv.playbackRate = video.playbackRate;
    if (dif > 0.08 && !cv.seeking) cv.currentTime = lt + 0.03;
    if (cv.paused && !cv.seeking) cv.play().catch(() => null);
  }
  /* Cada cuadro: pone las capas de este segundo en el cuadro del video (q), justo DESPUÉS de `despues` (antes de los
     subtítulos), en el orden del ensamblador (pedazos.js): primero las de DETRÁS de ti, luego tu recorte (`hueco`, si hay
     una de detrás) y al final las de ENCIMA. Devuelve la dividida activa (para encoger tu video) y la de detrás. */
  function cuadro(ctx, caja, t, q, despues, hueco) {
    const ed = activa(ctx);
    let ancla = despues, dividida = null, detras = null;
    const vistas = new Set();
    const orden = ed ? ed.capas.slice().sort((a, b) => (a.forma === 'profundo' ? 0 : 1) - (b.forma === 'profundo' ? 0 : 1)) : [];
    let huecoPuesto = false;
    const ponerHueco = () => {
      if (huecoPuesto || !hueco || !detras) return;
      if (hueco.parentNode !== caja || ancla.nextSibling !== hueco) caja.insertBefore(hueco, ancla ? ancla.nextSibling : caja.firstChild);
      ancla = hueco; huecoPuesto = true;
    };
    orden.forEach((p) => {
      if (p.forma !== 'profundo') ponerHueco();
      // se precargan un poco antes, para que lleguen a tiempo
      if (t < p.t0 - 3 || t > p.t1 + 0.2) return;
      const v = videoDe(p);
      sincronizar(v, ctx.video, t, p);
      const dentro = t >= p.t0 && t < p.t1;
      if (!dentro) { if (v.style.display !== 'none') v.style.display = 'none'; return; }
      vistas.add(v);
      if (p.forma === 'dividida') dividida = p;
      if (p.forma === 'profundo') detras = p;
      if (v.parentNode !== caja || (ancla && ancla.nextSibling !== v)) caja.insertBefore(v, ancla ? ancla.nextSibling : caja.firstChild);
      Object.assign(v.style, { position: 'absolute', left: q.x.toFixed(2) + 'px', top: q.y.toFixed(2) + 'px', width: q.W.toFixed(2) + 'px',
        height: q.H.toFixed(2) + 'px', objectFit: 'fill', pointerEvents: 'none', display: 'block' });
      ancla = v;
    });
    ponerHueco();
    E.videos.forEach((v) => { if (!vistas.has(v) && v.style.display !== 'none') v.style.display = 'none'; });
    return { dividida, detras, silueta: ed ? ed.silueta : null };
  }

  /* ── Los subtítulos en las ventanas de la edición (edicion.js › moverSubtitulos, sobre la capa en vivo) ── */
  const TARJETA = { s: 0.935, ox: 35.1 / 1080, oy: 671.45 / 1920, borde: 980 / 1920 };
  const BANDAS = { tarjeta: { a: 0.865, b: 0.955, kmax: 0.85, siempre: true }, abajo: { a: 0.64, b: 0.64, kmax: 1, siempre: false, entera: true } };
  /* capa = la capa de subtítulos en vivo; ini = el segundo (del video) en que empezó la frase que se ve; t = ahora */
  function subs(ctx, capa, t, ini) {
    if (!capa) return;
    const ed = activa(ctx);
    const v = ed ? ed.subs.find((x) => t >= x.t0 && t < x.t1) || null : null;
    const oculto = !!(v && v.modo === 'oculto');
    if (capa.style.visibility !== (oculto ? 'hidden' : '')) capa.style.visibility = oculto ? 'hidden' : '';
    let tr = '';
    const B = v ? BANDAS[v.modo] : null;
    // la frase cuenta si empezó dentro de la ventana (las de impacto entran ~0,5 s antes: tolerancia como el ensamblador)
    if (B && ini != null && ini >= v.t0 - (B.entera ? 0.6 : 0.05) && ini < v.t1 - 0.05 && capa.firstElementChild) {
      capa.style.transform = '';
      const cr = capa.getBoundingClientRect(), H = cr.height, W = cr.width;
      let top = Infinity, pie = -Infinity;
      capa.querySelectorAll('*').forEach((el) => {
        if (!el.textContent || !el.textContent.trim() || el.children.length) return;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) return;
        top = Math.min(top, r.top - cr.top); pie = Math.max(pie, r.bottom - cr.top);
      });
      if (isFinite(top) && H > 0) {
        const alto = Math.max(1, pie - top);
        if (v.modo === 'tarjeta' && top < 0.45 * H) {
          const K = TARJETA.s;
          let dy = Math.max(TARJETA.oy * H + top * K, TARJETA.borde * H + 0.012 * H);
          dy = Math.min(dy, 0.955 * H - alto * K);
          tr = 'translate(' + (TARJETA.ox * W).toFixed(2) + 'px,' + (dy - top * K).toFixed(2) + 'px) scale(' + K + ')';
        } else if (B.siempre || top < (B.entera ? 0.33 : 0.6) * H) {
          const banda = (B.b - B.a) * H;
          const K = B.entera ? 1 : Math.min(B.kmax, banda / alto);
          const dy0 = B.entera ? B.a * H : B.a * H + (banda - alto * K) / 2;
          tr = 'translate(' + ((W / 2) * (1 - K)).toFixed(2) + 'px,' + (dy0 - top * K).toFixed(2) + 'px) scale(' + K + ')';
        }
      }
    }
    if (capa.style.transformOrigin !== '0px 0px') capa.style.transformOrigin = '0 0';
    if (capa.style.transform !== tr) capa.style.transform = tr;
  }

  function ocultar() { E.videos.forEach((v) => { if (v.style.display !== 'none') { v.style.display = 'none'; if (!v.paused) v.pause(); } }); }
  /* (8-oct) para el editor Manual: la fila (nombre, id) y cambiarla (quitar una capa o la edición entera) */
  function cambiar(f) { E.fila = f || null; E.ver = (E.ver || 0) + 1; E.pedida = Date.now(); soltarVideos(); }
  C.edicionVivo = { activa, cuadro, subs, ocultar, quieto: (ctx) => { const ed = activa(ctx); return ed ? ed.quieto : []; },
                    fila: () => E.fila, cambiar };
})();

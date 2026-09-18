/* cortesvivo.js — los CORTES en vivo, antes del primer render (18-sep-2026).
 *
 * Apenas el motor decide los cortes (unos segundos después de subir los clips), el celular ya
 * muestra tu video EDITADO sin haber renderizado nada: reproduce tus clips saltando de corte en
 * corte según la receta del motor (edit_recipes), con el color en vivo encima (motor-color.js, el
 * mismo del ensamblador) y los subtítulos en vivo en la plantilla elegida.
 *
 * · Dos reproductores que se turnan: mientras suena un corte, el otro ya tiene cargado el siguiente
 *   y parado en su primer cuadro. En cada corte puede haber un cuadro de desfase al saltar; el
 *   archivo final sale perfecto porque lo arma el servidor.
 * · Las frases de los subtítulos las marca la IA al generar. Aquí, antes de eso, se arman con reglas
 *   simples (pausas, puntuación, 3 a 6 palabras): la plantilla y el estilo son los de verdad, la
 *   manera de agrupar las palabras puede variar un poco en el video final.
 * · Solo se usa antes del primer render. Después, el celular muestra el video ya hecho.
 */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const U = C.util;

  const R = { receta: null, motor: null, proyecto: null, leyendo: false, ultimaLectura: 0, clave: null };
  let P = null;               // el plan: { cortes[], total, palabras[], frases[] }
  const M = { v: [null, null], activo: 0, idx: 0, sonando: false, raf: 0, preparado: [-1, -1] };
  const S = { capa: null, clave: '', paginas: [], pagina: -2 };

  /* ── La receta del motor ── */
  async function leer(forzar) {
    const s = C.state;
    const pid = C.session && C.session.projectId;
    if (!pid || !C.apiReady || R.leyendo) return;
    if (!forzar && R.proyecto === pid && Date.now() - R.ultimaLectura < 5000) return;
    R.leyendo = true;
    try {
      const fila = await C.api.getReceta();
      R.proyecto = pid; R.ultimaLectura = Date.now();
      R.motor = fila ? (fila.motor_estado || fila.status || null) : null;
      const clave = fila ? fila.id + ':' + fila.version + ':' + (fila.motor_firma || '') : null;
      // se rearma si cambió la receta o la lista de clips (una receta con un clip borrado es vieja)
      const claveClips = (s.clips || []).map((c) => c.id).join(',');
      if (clave !== R.clave || claveClips !== R.claveClips) {
        R.clave = clave; R.claveClips = claveClips; R.receta = fila && fila.recipe;
        P = R.receta ? armarPlan(R.receta, s.clips || []) : null;
        reiniciar();
        C.render();
      }
    } catch (e) { console.warn('[Cortes] no se pudo leer la receta', e); }
    R.leyendo = false;
  }

  function armarPlan(rec, clips) {
    const ids = new Set((clips || []).map((c) => c.id));
    const cortes = (rec.cuts || [])
      .filter((c) => c && c.mp4_path && Number(c.endTime) > Number(c.startTime))
      .map((c) => ({
        url: C.urlClip(c.mp4_path), clipId: c.clipId,
        desde: Number(c.startTime), hasta: Number(c.endTime),
        ini: Number(c.outputStart) || 0, dur: Number(c.duration) || (Number(c.endTime) - Number(c.startTime)),
      }))
      .sort((a, b) => a.ini - b.ini);
    // si un clip de la receta ya no está (lo borraron), la receta es vieja: se espera a la nueva
    if (!cortes.length || (ids.size && cortes.some((c) => !ids.has(c.clipId)))) return null;
    const palabras = [];
    (rec.cuts || []).forEach((c, k) => (c.words || []).forEach((w) => {
      if (w && w.word) palabras.push({ word: String(w.word).trim(), start: Number(w.start), end: Number(w.end), corte: k });
    }));
    palabras.sort((a, b) => a.start - b.start);
    const total = cortes.reduce((m, c) => Math.max(m, c.ini + c.dur), 0);
    return { cortes, total, palabras, frases: armarFrases(palabras) };
  }

  /* Frases provisionales: cortar en puntuación, pausas o cada 3–6 palabras; la clave, la palabra más larga */
  const VACIAS = new Set(('a al de del la las el los lo un una unos unas y o u e ni que en con por para sin se su sus tu tus mi mis ' +
    'es son era fue no si sí me te le les nos ya muy más mas pero como cuando donde este esta esto eso esa ese hay').split(' '));
  function armarFrases(pal) {
    const frases = [];
    let ini = 0;
    function cerrar(fin) {
      if (fin < ini) return;
      let k = ini, largo = -1;
      for (let i = ini; i <= fin; i++) {
        const w = pal[i].word.replace(/[^\p{L}\p{N}]/gu, '');
        if (!VACIAS.has(w.toLowerCase()) && w.length > largo) { largo = w.length; k = i; }
      }
      frases.push({ desde: ini, hasta: fin, clave: [k, k], cierra: /[.!?…]$/.test(pal[fin].word) });
      ini = fin + 1;
    }
    const vacia = (w) => VACIAS.has(w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
    for (let i = 0; i < pal.length; i++) {
      const n = i - ini + 1, w = pal[i].word;
      const pausa = i + 1 < pal.length ? pal[i + 1].start - pal[i].end : 1;
      let letras = 0;
      for (let j = ini; j <= i; j++) letras += pal[j].word.length + 1;
      const otraToma = i + 1 < pal.length && pal[i + 1].corte !== pal[i].corte;   // entre tomas siempre se parte
      if (otraToma || /[.!?…]$/.test(w) || (/[,;:]$/.test(w) && n >= 2) || (pausa > 0.45 && n >= 2)) { cerrar(i); continue; }
      if (n >= 5 || letras > 28) {
        // por largo: si la frase terminaría en una palabra de enlace («no», «a», «de»…), esa abre la siguiente
        if (vacia(w) && n >= 3) cerrar(i - 1); else cerrar(i);
      }
    }
    cerrar(pal.length - 1);
    return frases;
  }

  /* ¿Se muestra? Antes del primer render, con receta lista, y fuera de la vista de tipografía */
  function listo(s) {
    if (s.renderUrl || s.phase === 'rendering' || s.phase === 'done') return false;
    if (!(s.clips || []).length) return false;
    if (!R.receta || R.proyecto !== (C.session && C.session.projectId)) setTimeout(() => leer(false), 0);
    return !!P && !(s.typographyPreview && s.captions);
  }
  /* Los cortes se están armando: hay clips y receta todavía no (o vieja) */
  function armando(s) {
    return !s.renderUrl && s.phase === 'idle' && (s.clips || []).length > 0 && !P;
  }

  /* ── Los dos reproductores ── */
  function video(i) {
    if (!M.v[i]) {
      const v = document.createElement('video');
      v.setAttribute('crossorigin', 'anonymous');      // el lienzo de color necesita leer sus pixeles
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      v.className = 'cv-video cvc-video';
      v.addEventListener('ended', () => { if (M.sonando && M.activo === i) siguiente(); });
      M.v[i] = v;
    }
    return M.v[i];
  }
  function mostrarActivo() {
    M.v.forEach((v, i) => { if (v) v.style.visibility = i === M.activo ? 'visible' : 'hidden'; });
  }
  function preparar(i, k, segundo) {
    const c = P && P.cortes[k];
    if (!c) return;
    const v = video(i);
    M.preparado[i] = k;
    if (v.getAttribute('src') !== c.url) v.src = c.url;
    const t = c.desde + (segundo || 0);
    const ir = () => { try { v.currentTime = t; } catch (_) {} };
    if (v.readyState >= 1) ir(); else v.addEventListener('loadedmetadata', ir, { once: true });
  }
  function reiniciar() {
    pausar();
    M.idx = 0; M.activo = 0; M.preparado = [-1, -1];
    S.clave = ''; S.pagina = -2;
    if (P) { preparar(0, 0); preparar(1, 1); mostrarActivo(); }
  }

  function tiempo() {
    if (!P) return 0;
    const c = P.cortes[M.idx], v = video(M.activo);
    return Math.max(0, Math.min(P.total, c.ini + (v.currentTime - c.desde)));
  }

  function siguiente() {
    const k = M.idx + 1;
    if (k >= P.cortes.length) { pausar(); irA(0); return; }       // al final vuelve al principio
    const otro = 1 - M.activo, vo = video(otro);
    if (M.preparado[otro] !== k) preparar(otro, k);
    video(M.activo).pause();
    M.activo = otro; M.idx = k;
    mostrarActivo();
    vo.play().catch(() => null);
    if (k + 1 < P.cortes.length) preparar(1 - otro, k + 1);         // el que quedó libre carga el que sigue
  }

  function paso() {
    M.raf = 0;
    if (!P) return;
    const v = video(M.activo), c = P.cortes[M.idx];
    if (M.sonando && v.currentTime >= c.hasta - 0.03) siguiente();
    const t = tiempo();
    C.live.progress(t / P.total, P.total);
    C.live.total(P.total);
    pintarSubs(t);
    if (M.sonando || document.body.contains(v)) M.raf = requestAnimationFrame(paso);
  }
  function arrancarBucle() { if (!M.raf) M.raf = requestAnimationFrame(paso); }

  function reproducir() {
    if (!P) return;
    const v = video(M.activo);
    M.sonando = true;
    v.play().catch(() => null);
    C.live.playing(true);
    arrancarBucle();
  }
  function pausar() {
    // solo si de verdad sonaba: si no, marcaría como detenido el reproductor del video ya hecho
    const sonaba = M.sonando || M.v.some((v) => v && !v.paused);
    M.sonando = false;
    M.v.forEach((v) => { if (v && !v.paused) v.pause(); });
    if (sonaba && C.live) C.live.playing(false);
  }
  function alternar() { if (M.sonando) pausar(); else reproducir(); }

  /* Saltar a un segundo del video editado */
  function irA(t) {
    if (!P) return;
    t = Math.max(0, Math.min(P.total - 0.05, t));
    let k = P.cortes.findIndex((c) => t >= c.ini && t < c.ini + c.dur);
    if (k < 0) k = t <= 0 ? 0 : P.cortes.length - 1;
    const sonaba = M.sonando;
    if (sonaba) pausar();
    M.idx = k;
    preparar(M.activo, k, t - P.cortes[k].ini);
    if (k + 1 < P.cortes.length) preparar(1 - M.activo, k + 1);
    mostrarActivo();
    S.pagina = -2;
    if (sonaba) reproducir(); else { C.live.progress(t / P.total, P.total); arrancarBucle(); }
  }

  /* ── Subtítulos en vivo: las mismas páginas y plantillas que el editor del resultado ── */
  function subsActuales(s) {
    const impacto = C.subs.modoImpacto(s);
    const pl = s.subsPlantilla || 'editorial';
    const cada = { pocas: 6, medio: 4, muchas: 2 }[s.subsImpacto] || 4;
    return {
      plantilla: impacto ? 'simple' : pl,
      palabras: P.palabras,
      // modo impacto: aquí se aproxima con una de cada tantas frases (la IA escoge las llamativas al generar)
      frases: impacto ? P.frases.map((f, i) => (i % cada === 1 ? Object.assign({}, f, { estilo: pl }) : f)) : P.frases,
    };
  }
  function pintarSubs(t) {
    const s = C.state;
    const capa = S.capa;
    if (!capa || !document.body.contains(capa)) return;
    if (!s.captions || !P.palabras.length) { if (S.pagina !== -1) { capa.replaceChildren(); S.pagina = -1; } return; }
    const simple = C.subs.simpleVista(s);
    const clave = JSON.stringify([s.subsPlantilla, s.subsModo, s.subsImpacto, s.simpleClaveCada, s.subsEscala, s.subsDy, s.subsDx, simple]);
    if (clave !== S.clave) { S.clave = clave; S.paginas = C.subs.paginasVivo(subsActuales(s)); S.pagina = -2; }
    const pags = S.paginas;
    let idx = -1;
    for (let k = pags.length - 1; k >= 0; k--) { if (t >= pags[k].ini) { if (t < pags[k].fin) idx = k; break; } }
    const p = pags[idx];
    if (S.pagina !== idx) {
      S.pagina = idx;
      capa.replaceChildren();
      if (p && p.estilo !== 'ninguno') capa.appendChild(C.subs.pagina(p.estilo, Object.assign({}, p.vista, { dichas: 0 }), simple, M.sonando));
    }
    if (p) {   // Firma y Premium: se encienden las palabras que ya se dijeron
      capa.querySelectorAll('.sp-flujo .sp-w').forEach((el) => {
        const i = p.ids[Number(el.getAttribute('data-i'))];
        el.classList.toggle('sp-dicha', i != null && t >= Number(P.palabras[i].start) - 0.08);
      });
    }
  }

  /* ── Lo que se pinta en el celular ── */
  function pantalla(s) {
    const a = video(0), b = video(1);
    mostrarActivo();
    // color en vivo encima: el lienzo pinta el reproductor que esté sonando
    const lienzo = C.colorVivo ? C.colorVivo.sobre(() => M.v[M.activo], 'cortes:' + R.clave) : null;
    if (!S.capa) S.capa = h('div', { class: 'ed-vivo cvc-subs' });
    S.pagina = -2;
    setTimeout(arrancarBucle, 0);
    const mantener = (on) => (e) => { e.preventDefault(); if (C.colorVivo) C.colorVivo.original(on); };
    return h('div', { class: 'cv', onClick: (e) => { if (!e.target.closest('.cv-original')) alternar(); } },
      a, b, lienzo, S.capa,
      h('div', { class: 'cv-etiqueta' }, 'Vista previa · ' + P.cortes.length + ' cortes'),
      !M.sonando && h('div', { class: 'screen__play js-screen-play', style: { display: 'flex' } }, h('div', { class: 'play-glass' }, h('span', { class: 'tri' }))),
      lienzo && h('button', {
        class: 'cv-original',
        onPointerdown: mantener(true), onPointerup: mantener(false), onPointerleave: mantener(false), onPointercancel: mantener(false),
        onContextmenu: (e) => e.preventDefault(),
      }, 'Mantén para ver sin color')
    );
  }

  /* Mientras el motor arma los cortes */
  function pantallaArmando() {
    setTimeout(() => leer(false), 0);
    return [
      h('div', { class: 'screen__off-sheen' }),
      h('div', { class: 'screen__off-body' },
        h('span', { class: 'spinner spinner--lg' }),
        h('div', { class: 'screen__wait-title' }, 'armando los cortes…'),
        h('div', { class: 'screen__off-copy' }, 'En unos segundos ves tu video editado aquí, sin esperar el render.')),
    ];
  }

  // relectura periódica: si el motor vuelve a cortar (subiste o quitaste clips), la vista se actualiza sola
  setInterval(() => {
    const s = C.state;
    if (s.pantalla === 'editor' && !s.renderUrl && s.phase === 'idle' && (s.clips || []).length) leer(false);
  }, 6000);

  C.cortesVivo = {
    listo, armando, pantalla, pantallaArmando, alternar, reproducir, pausar, irA, leer,
    enUso: () => !!(P && listo(C.state)),
    duracion: () => (P ? P.total : 0),
    tiempo, _plan: () => P, _motor: M, _paso: paso,   // _paso: para revisar con la pestaña oculta (sin requestAnimationFrame)
  };
})();

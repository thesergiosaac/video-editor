/* cortesvivo.js — tu video editado EN VIVO, antes del primer render (18-sep-2026).
 *
 * Dos etapas, las dos con el color en vivo encima (motor-color.js, el mismo del ensamblador) y los
 * subtítulos en vivo en la plantilla elegida:
 *
 * 1. VISTA RÁPIDA (apenas el motor decide los cortes): reproduce tus clips saltando de corte en corte
 *    según la receta (edit_recipes). Tres reproductores que se turnan, cada uno con un corte cargado
 *    por adelantado; si el siguiente no está listo, se espera quieta en el último cuadro. Se entrecorta
 *    porque los clips tienen un cuadro clave cada 7–8 s: para empezar un corte a mitad de clip el
 *    navegador tiene que decodificar todo desde el anterior (medido 18-sep; la red no es: 22 MB/s).
 *
 * 2. BASE ADELANTADA (~1 min después): la página le pide al servidor el video ya cortado y pegado,
 *    sin subtítulos (orchestrate v184 `preparar_base`: el MISMO camino de generar, sin la pasada final).
 *    Es UN solo video continuo → fluido. Y generar la reusa (`reusar_base`): no vuelve a cortar clips.
 *
 * Las frases de los subtítulos las marca la IA al generar; aquí se arman con reglas simples (pausas,
 * puntuación, máximo 5 palabras, siempre se parte entre tomas): la agrupación puede variar un poco.
 * Solo se usa antes del primer render; después el celular muestra el video ya hecho.
 */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  const R = { receta: null, motor: null, proyecto: null, leyendo: false, ultimaLectura: 0, clave: null, claveClips: null };
  let P = null;                                           // plan de la vista rápida: { cortes[], total, palabras[], frases[] }
  const N_REP = 3;                                        // reproductores de la vista rápida
  const M = { v: [], idx: 0, sonando: false, esperando: false, raf: 0, preparado: [] };
  const S = { capa: null, clave: '', paginas: [], pagina: -2 };
  // la base adelantada
  const BA = { clave: null, estado: null, id: null, datos: null, inicio: 0, intentos: 0, ocupado: false, claveVista: null, vistaDesde: 0, sondeo: null };

  /* ══ La receta del motor ══ */
  async function leer(forzar) {
    const s = C.state;
    const pid = C.session && C.session.projectId;
    if (!pid || !C.apiReady || R.leyendo) return;
    if (!forzar && R.proyecto === pid && Date.now() - R.ultimaLectura < 5000) return;
    R.leyendo = true;
    try {
      const fila = await C.api.getReceta();
      if (R.proyecto !== pid) { BA.clave = null; BA.estado = null; BA.id = null; BA.datos = null; }   // otro proyecto
      R.proyecto = pid; R.ultimaLectura = Date.now();
      R.motor = fila ? (fila.motor_estado || (fila.status === 'ready' ? 'listo' : fila.status) || null) : null;
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
    asegurarBase();
  }

  function armarPlan(rec, clips) {
    const ids = new Set((clips || []).map((c) => c.id));
    /* 19-sep: el AIRE que pidió la persona (mismo cálculo que el servidor: se recorta el silencio de los bordes
       hasta dejar `aire` segundos, usando la voz que midió el motor) */
    const aire = Math.max(0, Math.min(0.5, Number(C.state.aire != null ? C.state.aire : 0.12)));
    const usados = (rec.cuts || [])
      .filter((c) => c && c.mp4_path && Number(c.endTime) > Number(c.startTime))
      .sort((a, b) => (Number(a.outputStart) || 0) - (Number(b.outputStart) || 0));
    let cursor = 0;
    const cortes = usados.map((c) => {
      let desde = Number(c.startTime), hasta = Number(c.endTime);
      const v = c.voz;
      if (v && isFinite(Number(v.ini)) && isFinite(Number(v.fin))) {
        const st = Math.max(desde, Math.min(Number(v.ini) - aire, Number(v.ini)));
        const en = Math.min(hasta, Math.max(Number(v.fin) + aire, Number(v.fin)));
        if (en - st >= 0.25) { desde = st; hasta = en; }
      }
      const corte = { url: C.urlClip(c.mp4_path), clipId: c.clipId, desde: desde, hasta: hasta, ini: cursor, dur: hasta - desde,
                      corrido: desde - Number(c.startTime), salidaVieja: Number(c.outputStart) || 0 };
      cursor += corte.dur;
      return corte;
    });
    // si un clip de la receta ya no está (lo borraron), la receta es vieja: se espera a la nueva
    if (!cortes.length || (ids.size && cortes.some((c) => !ids.has(c.clipId)))) return null;
    const palabras = [];
    usados.forEach((c, k) => (c.words || []).forEach((w) => {
      if (!w || !w.word) return;
      const corte = cortes[k];
      const st = corte.ini + (Number(w.start) - corte.salidaVieja) - corte.corrido;
      const en = corte.ini + (Number(w.end) - corte.salidaVieja) - corte.corrido;
      palabras.push({ word: String(w.word).trim(), start: Math.max(corte.ini, st), end: Math.min(corte.ini + corte.dur, Math.max(st, en)), corte: k });
    }));
    palabras.sort((a, b) => a.start - b.start);
    const total = cortes.reduce((m, c) => Math.max(m, c.ini + c.dur), 0);
    return { cortes, total, palabras, frases: armarFrases(palabras) };
  }

  /* Frases provisionales: puntuación, pausas, entre tomas o cada 5 palabras; la clave, la palabra más larga */
  const VACIAS = new Set(('a al de del la las el los lo un una unos unas y o u e ni que en con por para sin se su sus tu tus mi mis ' +
    'es son era fue no si sí me te le les nos ya muy más mas pero como cuando donde este esta esto eso esa ese hay').split(' '));
  const limpia = (w) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  function armarFrases(pal) {
    const frases = [];
    let ini = 0;
    function cerrar(fin) {
      if (fin < ini) return;
      let k = ini, largo = -1;
      for (let i = ini; i <= fin; i++) {
        const w = limpia(pal[i].word);
        if (!VACIAS.has(w) && w.length > largo) { largo = w.length; k = i; }
      }
      frases.push({ desde: ini, hasta: fin, clave: [k, k], cierra: /[.!?…]$/.test(pal[fin].word) });
      ini = fin + 1;
    }
    for (let i = 0; i < pal.length; i++) {
      const n = i - ini + 1, w = pal[i].word;
      const pausa = i + 1 < pal.length ? pal[i + 1].start - pal[i].end : 1;
      let letras = 0;
      for (let j = ini; j <= i; j++) letras += pal[j].word.length + 1;
      const otraToma = i + 1 < pal.length && pal[i + 1].corte !== pal[i].corte;   // entre tomas siempre se parte
      if (otraToma || /[.!?…]$/.test(w) || (/[,;:]$/.test(w) && n >= 2) || (pausa > 0.45 && n >= 2)) { cerrar(i); continue; }
      if (n >= 5 || letras > 28) {
        // por largo: si la frase terminaría en una palabra de enlace («no», «a», «de»…), esa abre la siguiente
        if (VACIAS.has(limpia(w)) && n >= 3) cerrar(i - 1); else cerrar(i);
      }
    }
    cerrar(pal.length - 1);
    return frases;
  }

  /* ══ ¿Qué se muestra? ══ */
  function antesDelRender(s) { return !s.renderUrl && s.phase === 'idle' && (s.clips || []).length > 0; }
  function baseLista(s) { return BA.estado === 'lista' && BA.datos && BA.clave === claveBase(s); }
  function listo(s) {
    if (!antesDelRender(s)) return false;
    if (!R.receta || R.proyecto !== (C.session && C.session.projectId)) setTimeout(() => leer(false), 0);
    if (s.typographyPreview && s.captions) return false;
    return baseLista(s) || !!P;
  }
  /* Los cortes se están armando: hay clips y receta todavía no (o vieja) */
  function armando(s) { return antesDelRender(s) && !P && !baseLista(s); }

  /* ══ La base adelantada ══ */
  /* Con qué cortes se hace: la receta del motor, el orden de los clips y «eliminar silencios» / «corte entre clips» */
  function claveBase(s) {
    if (!R.clave) return null;
    return R.clave + '|' + JSON.stringify({ clips: (s.clips || []).map((c) => c.id), gap: s.clipGap, ini: s.clipStart, aire: s.aire });
  }
  function motorListo() { return R.motor === 'listo'; }

  async function asegurarBase() {
    const s = C.state;
    if (BA.ocupado || !P || !antesDelRender(s) || !motorListo() || s.pantalla !== 'editor') return;
    const clave = claveBase(s);
    if (!clave) return;
    // los controles de cortes pueden estar moviéndose: se pide cuando la clave lleva 4 s quieta
    if (clave !== BA.claveVista) { BA.claveVista = clave; BA.vistaDesde = Date.now(); return; }
    if (Date.now() - BA.vistaDesde < 4000) return;
    if (BA.clave === clave && (BA.estado === 'lista' || BA.estado === 'armando' || (BA.estado === 'error' && BA.intentos >= 2))) return;
    if (BA.clave !== clave) {
      BA.clave = clave; BA.estado = null; BA.id = null; BA.datos = null; BA.intentos = 0;
      if (BA.sondeo) { clearInterval(BA.sondeo); BA.sondeo = null; }
    }
    BA.ocupado = true;
    try {
      // ¿ya hay una para estos cortes? (por ejemplo, tras recargar la página)
      const f = await C.api.getBaseAdelantada();
      if (f && f.subtitle_config && f.subtitle_config.firma_cortes === clave) {
        if (f.status === 'base') { cargarBase(f); return; }
        if (f.status === 'rendering' && Date.now() - Date.parse(f.created_at) < 8 * 60000) {
          BA.estado = 'armando'; BA.id = f.id; BA.inicio = Date.parse(f.created_at); sondearBase(); return;
        }
      }
      BA.intentos++;
      const res = await C.api.prepararBase(C.ajustesGenerar(s), clave);
      if (!res || !res.render_id) throw new Error('sin render_id');
      BA.estado = 'armando'; BA.id = res.render_id; BA.inicio = Date.now();
      console.log('[Base] pedida', BA.id);
      sondearBase();
    } catch (e) {
      BA.estado = 'error'; console.warn('[Base] no se pudo pedir', e);
    } finally {
      BA.ocupado = false;
      pintarEtiqueta();
    }
  }

  function sondearBase() {
    if (BA.sondeo) clearInterval(BA.sondeo);
    const id = BA.id;
    BA.sondeo = setInterval(async () => {
      if (BA.id !== id || BA.estado !== 'armando') { clearInterval(BA.sondeo); BA.sondeo = null; return; }
      try {
        const st = await C.api.getPipelineStatus(id);
        if (BA.id !== id) return;
        if (st && st.status === 'base') {
          clearInterval(BA.sondeo); BA.sondeo = null;
          const data = await C.api.getRenderData(id);
          if (BA.id === id && data) cargarBase(data);
        } else if (st && (st.status === 'error' || st.status === 'failed') || Date.now() - BA.inicio > 8 * 60000) {
          clearInterval(BA.sondeo); BA.sondeo = null;
          BA.estado = 'error'; console.warn('[Base] falló', st && st.error_message);
          pintarEtiqueta();
        }
      } catch (e) { /* un sondeo perdido no importa */ }
    }, 4000);
  }

  /* (24-sep) Con el video YA HECHO la base adelantada no se lee, y el panel Guion quedaba vacio (Sergio, al ir a
     poner sus pantallas). Entonces las lineas salen del propio video: las mismas palabras —y los mismos numeros—
     que usa el ensamblador al exportarlo. */
  const RV = { id: null, datos: null, pidiendo: null };
  function datosDeVideo(f) {
    const segs = (f.segments_json && f.segments_json.segments) || [];
    const nominales = segs.map((g) => Number(g.duration_sec));
    const reales = Array.isArray(f.duraciones_reales) && f.duraciones_reales.length === nominales.length ? f.duraciones_reales.map(Number) : nominales;
    const sp = f.subtitle_phrases || {};
    const pal = (sp.palabras_vista || sp.palabras || []).map((w) => ({ word: String(w.word).trim(), start: Number(w.start), end: Number(w.end) }));
    const inicios = []; let a = 0; nominales.forEach((d) => { inicios.push(a); a += d; });
    pal.forEach((w) => { let k = 0; while (k + 1 < inicios.length && w.start >= inicios[k + 1]) k++; w.corte = k; });
    return {
      palabras: pal, frases: armarFrases(pal),
      frasesIA: Array.isArray(sp.frases) && sp.frases.length ? sp.frases : null,
      graficos: f.graficos || null, apoyo: f.apoyo || null,
      palabrasNom: sp.palabras || pal, duraciones: reales,
      relojReal: window.CherryApoyo ? window.CherryApoyo.reloj(nominales, reales) : null,
    };
  }

  /* (24-sep) Lo que SALE en el video, no lo que propuso la IA. Sergio vio «Número gigante» y «Escena» en líneas donde
     no había nada: el Guion marcaba todas las propuestas, y en su video los gráficos estaban apagados y de 13 escenas
     entraron 6. Mismos pasos, orden y ajustes que la vista previa y el ensamblador: gráficos, luego pantallas (que
     mandan) y luego las escenas, que esquivan a los dos. */
  const PUESTOS = { clave: '', val: null };
  function colocados(D, aReal) {
    const GR = window.CherryGraf, AP = window.CherryApoyo;
    const gcfg = C.grafCfg ? C.grafCfg() : {}, ecfg = C.escenasCfg ? C.escenasCfg() : {};
    const pant = C.pantallas ? C.pantallas.paraServidor() : [];
    const palN = D.palabrasNom || D.palabras;
    const ult = palN[palN.length - 1];
    const dur = (D.duraciones || []).reduce((a, b) => a + Number(b), 0) || aReal(Number(ult && ult.end) || 0);
    const clave = [palN.length, dur, JSON.stringify(gcfg), JSON.stringify(ecfg), JSON.stringify(pant), !!D.graficos, !!D.apoyo].join('|');
    if (PUESTOS.clave === clave && PUESTOS.d === D) return PUESTOS.val;
    let piezas = [];
    try {
      if (GR && gcfg.cantidad && D.graficos) piezas = GR.elegir(D.graficos, palN, aReal, gcfg, dur, []) || [];
      if (GR && GR.conPantallas && pant.length) piezas = GR.conPantallas(piezas, pant, palN, aReal, dur) || piezas;
    } catch (e) { piezas = []; }
    let escenas = [];
    try {
      if (AP && ecfg.cantidad && D.apoyo) escenas = AP.elegir(D.apoyo, palN, aReal, ecfg, dur, piezas.map((p) => ({ t0: p.t0, t1: p.t1 }))) || [];
    } catch (e) { escenas = []; }
    PUESTOS.clave = clave; PUESTOS.d = D;
    PUESTOS.val = { graficos: piezas.filter((p) => !p.pantalla), escenas };
    return PUESTOS.val;
  }
  function datosGuion() {
    const s = C.state, rid = s.renderId;
    if (!rid || antesDelRender(s)) return BA.datos;
    if (RV.id === rid && RV.datos) return RV.datos;
    if (RV.pidiendo !== rid && C.api && C.api.getRenderData) {
      RV.pidiendo = rid;
      C.api.getRenderData(rid).then((f) => {
        if (!f || C.state.renderId !== rid) return;
        RV.id = rid; RV.datos = datosDeVideo(f);
        if (C.state.openCard === 'guion') C.render();
      }).catch(() => { RV.pidiendo = null; });
    }
    return null;
  }

  function cargarBase(f) {
    const segs = (f.segments_json && f.segments_json.segments) || [];
    const nominales = segs.map((g) => Number(g.duration_sec));
    const sp = f.subtitle_phrases || {};
    // palabras_vista: las mismas palabras ya corregidas por la IA (las que recibe el servidor al generar)
    const pal = (sp.palabras_vista || sp.palabras || []).map((w) => ({ word: String(w.word).trim(), start: Number(w.start), end: Number(w.end) }));
    // cada palabra sabe de qué corte es (para partir las frases entre tomas)
    const inicios = []; let a = 0; nominales.forEach((d) => { inicios.push(a); a += d; });
    pal.forEach((w) => { let k = 0; while (k + 1 < inicios.length && w.start >= inicios[k + 1]) k++; w.corte = k; });
    BA.datos = {
      url: C.urlVideo(f.video_sin_subtitulos),
      reloj: C.subs.relojNominal(nominales, f.duraciones_reales),     // tiempo del video real → tiempo de las palabras
      palabras: pal, frases: armarFrases(pal),
      // frases que ya marcó la IA en la base (orchestrate v186): con ellas la vista muestra las del video final
      frasesIA: Array.isArray(sp.frases) && sp.frases.length ? sp.frases : null,
      // movimiento en vivo (19-sep): duración real de cada corte + inicio de cada frase de impacto (en tiempo del video)
      duraciones: Array.isArray(f.duraciones_reales) && f.duraciones_reales.length === nominales.length ? f.duraciones_reales.map(Number) : nominales,
      impactos: window.CherryMov && Array.isArray(sp.frases)
        ? window.CherryMov.impactosDe(sp.palabras || pal, sp.frases, window.CherryMov.reloj(nominales, Array.isArray(f.duraciones_reales) && f.duraciones_reales.length === nominales.length ? f.duraciones_reales : nominales))
        : [],
      // escenas de apoyo (19-sep): lo que encontró la IA + palabras y reloj para ubicarlas en el video
      apoyo: f.apoyo || null, palabrasNom: sp.palabras || pal,
      // gráficos (19-sep): lo que marcó la IA (llega junto con las frases)
      graficos: f.graficos || null,
      relojReal: window.CherryApoyo ? window.CherryApoyo.reloj(nominales, Array.isArray(f.duraciones_reales) && f.duraciones_reales.length === nominales.length ? f.duraciones_reales : nominales) : null,
    };
    BA.estado = 'lista'; BA.id = f.id || BA.id;
    console.log('[Base] lista', BA.id, '· ' + pal.length + ' palabras');
    // de la vista rápida a la fluida, en el mismo segundo
    const t = P ? tiempoRapida() : 0, sonaba = M.sonando;
    pausarRapida();
    S.clave = ''; S.pagina = -2;
    C.render();
    const v = videoBase();
    if (v) {
      const ir = () => { try { v.currentTime = t; } catch (_) {} if (sonaba) reproducir(); };
      if (v.readyState >= 1) ir(); else v.addEventListener('loadedmetadata', ir, { once: true });
    }
  }
  function videoBase() { return BA.datos ? C.videoFijo.get('base-previa') : null; }
  function enBase() { return baseLista(C.state) && !!videoBase(); }

  /* 20-sep: si la base se está armando, ESPERARLA sale más barato que generar desde cero. Cuando Sergio
     daba a Generar cinco segundos después de subir los clips, F1 cortaba los mismos 18 clips DOS veces a
     la vez — medido: ~100 s de los 280 del render entero — y encima las dos tandas se estorbaban en la
     misma Lambda. Esperar cuesta unos segundos; duplicar el corte costaba un minuto y medio. */
  async function esperarBase(tope) {
    if (baseLista(C.state)) return baseParaGenerar();
    if (BA.estado !== 'armando') return null;          // no hay ninguna en marcha: a generar desde cero
    const hasta = Date.now() + (Number(tope) || 90000);
    while (Date.now() < hasta) {
      await new Promise((r) => setTimeout(r, 1200));
      if (baseLista(C.state)) { console.log('[Base] se aprovechó la que ya se estaba armando'); return baseParaGenerar(); }
      if (BA.estado === 'error' || BA.estado == null) return null;
    }
    console.warn('[Base] tardó demasiado, se genera desde cero');
    return null;
  }

  /* Para generar: la base sirve si está lista y se hizo con los cortes de ahora */
  function baseParaGenerar() {
    const s = C.state;
    return baseLista(s) ? { id: BA.id, clave: BA.clave } : null;
  }

  /* ══ Vista rápida: los reproductores que se turnan ══ */
  function rep(i) {
    if (!M.v[i]) {
      const v = document.createElement('video');
      v.setAttribute('crossorigin', 'anonymous');      // el lienzo de color necesita leer sus pixeles
      if (C.corsConRespaldo) C.corsConRespaldo(v);   // si el CDN niega el permiso CORS → directo a S3
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      v.className = 'cv-video cvc-video';
      v.style.visibility = 'hidden';
      M.v[i] = v;
    }
    return M.v[i];
  }
  const repDe = (k) => k % N_REP;
  function mostrarActivo() {
    for (let i = 0; i < N_REP; i++) rep(i).style.visibility = i === repDe(M.idx) ? 'visible' : 'hidden';
  }
  function preparar(k, segundo) {
    const c = P && P.cortes[k];
    if (!c) return;
    const i = repDe(k), v = rep(i);
    M.preparado[i] = k;
    // se compara con lo PEDIDO (tras el respaldo CORS la dirección real es la de S3)
    if (v._srcPedido !== c.url) { v._srcPedido = c.url; v.src = C.urlCors ? C.urlCors(c.url) : c.url; }
    const t = c.desde + (segundo || 0);
    const ir = () => { try { v.currentTime = t; } catch (_) {} };
    if (v.readyState >= 1) ir(); else v.addEventListener('loadedmetadata', ir, { once: true });
  }
  /* los dos cortes que siguen, cada uno en su reproductor */
  function prepararSiguientes() {
    for (let d = 1; d < N_REP; d++) {
      const k = M.idx + d;
      if (P && k < P.cortes.length && M.preparado[repDe(k)] !== k) preparar(k);
    }
  }
  function listoPara(k) {
    const v = rep(repDe(k));
    return M.preparado[repDe(k)] === k && v.readyState >= 3 && !v.seeking;
  }
  function reiniciar() {
    pausarRapida();
    M.idx = 0; M.preparado = []; M.esperando = false;
    S.clave = ''; S.pagina = -2;
    if (P) { preparar(0); prepararSiguientes(); mostrarActivo(); }
  }
  function tiempoRapida() {
    if (!P) return 0;
    const c = P.cortes[M.idx], v = rep(repDe(M.idx));
    return Math.max(0, Math.min(P.total, c.ini + (v.currentTime - c.desde)));
  }
  function siguiente() {
    const k = M.idx + 1;
    if (k >= P.cortes.length) { pausar(); irA(0); return; }            // al final vuelve al principio
    if (M.preparado[repDe(k)] !== k) preparar(k);
    if (!listoPara(k)) {                                                // todavía no: quieto en el último cuadro
      if (!M.esperando) { M.esperando = true; rep(repDe(M.idx)).pause(); }
      return;
    }
    M.esperando = false;
    rep(repDe(M.idx)).pause();
    M.idx = k;
    mostrarActivo();
    rep(repDe(k)).play().catch(() => null);
    prepararSiguientes();
  }
  function pausarRapida() {
    M.v.forEach((v) => { if (v && !v.paused) v.pause(); });
    M.sonando = false; M.esperando = false;
  }

  /* ══ Reloj ══ */
  function tiempo() {
    if (enBase()) { const v = videoBase(); return v.currentTime || 0; }
    return tiempoRapida();
  }
  function duracion() {
    if (enBase()) { const v = videoBase(); return v.duration || 0; }
    return P ? P.total : 0;
  }
  function paso() {
    M.raf = 0;
    const s = C.state;
    if (enBase()) {
      const v = videoBase();
      const d = v.duration || 0;
      if (d) { C.live.progress((v.currentTime || 0) / d, d); C.live.total(d); }
      pintarSubs(BA.datos.reloj(v.currentTime || 0), BA.datos, !v.paused);
      if (document.body.contains(v)) M.raf = requestAnimationFrame(paso);
      return;
    }
    if (!P) return;
    const c = P.cortes[M.idx], v = rep(repDe(M.idx));
    if (M.sonando && (M.esperando || v.currentTime >= c.hasta - 0.03 || v.ended)) siguiente();
    prepararSiguientes();
    const t = tiempoRapida();
    C.live.progress(t / P.total, P.total);
    C.live.total(P.total);
    pintarSubs(t, P, M.sonando);
    if (M.sonando || document.body.contains(v)) M.raf = requestAnimationFrame(paso);
  }
  function arrancarBucle() { if (!M.raf) M.raf = requestAnimationFrame(paso); }

  function reproducir() {
    if (enBase()) {
      const v = videoBase();
      v.play().catch(() => null);
      M.sonando = true; C.live.playing(true); arrancarBucle();
      return;
    }
    if (!P) return;
    M.sonando = true;
    rep(repDe(M.idx)).play().catch(() => null);
    C.live.playing(true);
    arrancarBucle();
  }
  function pausar() {
    // solo si de verdad sonaba: si no, marcaría como detenido el reproductor del video ya hecho
    const vb = videoBase();
    const sonaba = M.sonando || M.v.some((v) => v && !v.paused) || (vb && !vb.paused);
    pausarRapida();
    if (vb && !vb.paused) vb.pause();
    if (sonaba && C.live) C.live.playing(false);
  }
  function alternar() { if (M.sonando) pausar(); else reproducir(); }

  /* Saltar a un segundo del video editado */
  function irA(t) {
    if (enBase()) {
      const v = videoBase();
      v.currentTime = Math.max(0, Math.min((v.duration || 0) - 0.05, t));
      S.pagina = -2; arrancarBucle();
      return;
    }
    if (!P) return;
    t = Math.max(0, Math.min(P.total - 0.05, t));
    let k = P.cortes.findIndex((c) => t >= c.ini && t < c.ini + c.dur);
    if (k < 0) k = t <= 0 ? 0 : P.cortes.length - 1;
    const sonaba = M.sonando;
    if (sonaba) pausarRapida();
    M.idx = k;
    preparar(k, t - P.cortes[k].ini);
    prepararSiguientes();
    mostrarActivo();
    S.pagina = -2;
    if (sonaba) reproducir(); else { C.live.progress(t / P.total, P.total); arrancarBucle(); }
  }

  /* ══ Subtítulos en vivo: las mismas páginas y plantillas que el editor del resultado ══ */
  function subsActuales(s, fuente) {
    const impacto = C.subs.modoImpacto(s);
    const pl = s.subsPlantilla || 'editorial';
    const cada = { pocas: 6, medio: 4, muchas: 2 }[s.subsImpacto] || 4;
    if (fuente.frasesIA && window.FrasesServidor) {
      // las frases de la IA, repasadas EXACTAMENTE como el servidor (frases-servidor.js es copia de carrete-layer2):
      // en modo impacto las marcadas llevan la plantilla ANTES del repaso, igual que en orchestrate
      const crudas = fuente.frasesIA.map((f) => ({
        desde: f.desde, hasta: f.hasta, clave: Array.isArray(f.clave) ? f.clave.slice() : f.clave, cierra: f.cierra,
        estilo: impacto && f.impacto ? pl : undefined,
      }));
      return {
        plantilla: impacto ? 'simple' : pl,
        palabras: fuente.palabras,
        frases: window.FrasesServidor.normalizarFrases(fuente.palabras.map((w) => Object.assign({}, w)), crudas),
      };
    }
    return {
      plantilla: impacto ? 'simple' : pl,
      palabras: fuente.palabras,
      // modo impacto: aquí se aproxima con una de cada tantas frases (la IA escoge las llamativas al generar)
      frases: impacto ? fuente.frases.map((f, i) => (i % cada === 1 ? Object.assign({}, f, { estilo: pl }) : f)) : fuente.frases,
    };
  }
  function pintarSubs(t, fuente, animar) {
    const s = C.state;
    const capa = S.capa;
    if (!capa || !document.body.contains(capa)) return;
    if (!s.captions || !fuente.palabras.length) { if (S.pagina !== -1) { capa.replaceChildren(); S.pagina = -1; } return; }
    const simple = C.subs.simpleVista(s);
    const clave = JSON.stringify([fuente === P ? 'r' : 'b', s.subsPlantilla, s.subsModo, s.subsImpacto, s.simpleClaveCada, s.subsEscala, s.subsDy, s.subsDx, simple]);
    if (clave !== S.clave) { S.clave = clave; S.paginas = C.subs.paginasVivo(subsActuales(s, fuente)); S.pagina = -2; }
    const pags = S.paginas;
    let idx = -1;
    for (let k = pags.length - 1; k >= 0; k--) { if (t >= pags[k].ini) { if (t < pags[k].fin) idx = k; break; } }
    const p = pags[idx];
    if (S.pagina !== idx) {
      S.pagina = idx;
      capa.replaceChildren();
      if (p && p.estilo !== 'ninguno') capa.appendChild(C.subs.pagina(p.estilo, Object.assign({}, p.vista, { dichas: 0 }), simple, animar));
    }
    if (p) {   // Firma y Premium: se encienden las palabras que ya se dijeron
      capa.querySelectorAll('.sp-flujo .sp-w').forEach((el) => {
        const i = p.ids[Number(el.getAttribute('data-i'))];
        el.classList.toggle('sp-dicha', i != null && t >= Number(fuente.palabras[i].start) - 0.08);
      });
    }
  }

  /* ══ Lo que se pinta en el celular ══ */
  /* 20-sep: las escenas de apoyo y los gráficos llegan DESPUÉS de la base, y hasta hoy se pedían en
     silencio (movFuente, cada 10 s). A Sergio le pareció que Cherry no hacía nada: sí lo hacía, pero
     sin decirlo. La etiqueta ahora lo cuenta. */
  function faltanExtras() {
    const s = C.state;
    if (!baseLista(s) || !BA.datos) return null;
    const fApoyo = !BA.datos.apoyo && !!s.escenasOn;
    const fGraf = !BA.datos.graficos && !!s.grafOn;
    if (fApoyo && fGraf) return 'las escenas y los gráficos';
    if (fGraf) return 'los gráficos';
    if (fApoyo) return 'las escenas de apoyo';
    return null;
  }
  /* Rendida: tras 2 intentos asegurarBase() ya no vuelve a pedirla nunca. Sin este aviso la pantalla
     se queda callada y solo se cura recargando (le pasó a Sergio el 20-sep). */
  function baseRendida() { return BA.estado === 'error' && BA.intentos >= 2; }
  function etiquetaTexto() {
    if (baseLista(C.state)) {
      const falta = faltanExtras();
      return falta ? 'Vista previa · preparando ' + falta : 'Vista previa';
    }
    if (BA.estado === 'armando') return 'Vista rápida · la fluida llega en unos segundos';
    if (baseRendida()) return 'Vista rápida · no se pudo preparar la fluida';
    return 'Vista rápida';
  }
  function reintentarBase() {
    if (BA.sondeo) { clearInterval(BA.sondeo); BA.sondeo = null; }
    BA.estado = null; BA.intentos = 0; BA.clave = null; BA.id = null; BA.datos = null;
    BA.claveVista = claveBase(C.state); BA.vistaDesde = 0;   // 0 → ya lleva «quieta» de sobra: se pide ya
    ultimaEtiqueta = null;
    pintarEtiqueta();
    asegurarBase();
  }
  let ultimaEtiqueta = null;
  function pintarEtiqueta() {
    const txt = etiquetaTexto(), reintentar = !baseLista(C.state) && baseRendida();
    const clave = txt + '|' + reintentar;
    if (clave === ultimaEtiqueta) return;            // no se rehace en cada latido (el botón se perdería a medio clic)
    ultimaEtiqueta = clave;
    document.querySelectorAll('.js-cvc-etiqueta').forEach((el) => {
      if (!reintentar) { el.textContent = txt; return; }
      el.replaceChildren(txt + ' · ', h('button', {
        class: 'cv-reintentar', type: 'button',
        onClick: (e) => { e.stopPropagation(); e.preventDefault(); reintentarBase(); },
      }, 'Reintentar'));
    });
  }

  function pantalla(s) {
    const base = baseLista(s);
    let videos, lienzo;
    if (base) {
      const v = C.videoFijo('base-previa', BA.datos.url, {
        class: 'cv-video', crossorigin: 'anonymous', playsinline: true, preload: 'auto',
        onEnded: () => { pausar(); irA(0); },
      });
      if (C.corsConRespaldo) C.corsConRespaldo(v);
      pausarRapida();
      videos = [v];
      lienzo = C.colorVivo ? C.colorVivo.sobre(() => v, 'base:' + BA.id) : null;
    } else {
      videos = [];
      for (let i = 0; i < N_REP; i++) videos.push(rep(i));
      mostrarActivo();
      // color en vivo encima: el lienzo pinta el reproductor que esté sonando
      lienzo = C.colorVivo ? C.colorVivo.sobre(() => rep(repDe(M.idx)), 'cortes:' + R.clave) : null;
    }
    if (!S.capa) S.capa = h('div', { class: 'ed-vivo cvc-subs' });
    S.pagina = -2;
    setTimeout(arrancarBucle, 0);
    setTimeout(asegurarBase, 0);
    ultimaEtiqueta = null; setTimeout(pintarEtiqueta, 0);   // el <div> se acaba de recrear con el texto plano
    const mantener = (on) => (e) => { e.preventDefault(); if (C.colorVivo) C.colorVivo.original(on); };
    return h('div', { class: 'cv', onClick: (e) => { if (!e.target.closest('.cv-original') && !e.target.closest('.cv-reintentar')) alternar(); } },
      videos, lienzo, S.capa,
      h('div', { class: 'cv-etiqueta js-cvc-etiqueta' }, etiquetaTexto()),
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

  // relectura periódica: si el motor vuelve a cortar (subiste o quitaste clips) la vista se actualiza sola;
  // y se revisa si hay que pedir (o cambiar) la base adelantada
  setInterval(() => {
    const s = C.state;
    if (s.pantalla === 'editor' && antesDelRender(s)) { leer(false); asegurarBase(); pintarEtiqueta(); }
  }, 4000);

  C.cortesVivo = {
    listo, armando, pantalla, pantallaArmando, alternar, reproducir, pausar, irA, leer, baseParaGenerar, esperarBase,
    enUso: () => listo(C.state),
    /* movimiento en vivo (19-sep): solo sobre la base adelantada (la vista rápida todavía no tiene los cortes finales) */
    movFuente() {
      if (!baseLista(C.state) || !BA.datos || !BA.datos.duraciones || !BA.datos.duraciones.length) return null;
      // las escenas de apoyo de la base llegan un poco después que la base (la IA las busca junto con las frases)
      // (y los gráficos igual, 19-sep)
      const faltaApoyo = !BA.datos.apoyo && C.state.escenasOn, faltaGraf = !BA.datos.graficos && C.state.grafOn;
      if ((faltaApoyo || faltaGraf) && BA.id && Date.now() - (BA.apoyoPedido || 0) > 10000) {
        BA.apoyoPedido = Date.now();
        const id = BA.id;
        C.api.getRenderData(id).then((d) => {
          if (!d || BA.id !== id || !BA.datos) return;
          if (d.apoyo) BA.datos.apoyo = d.apoyo;
          if (d.graficos) BA.datos.graficos = d.graficos;
          pintarEtiqueta();                                  // ya llegaron: se quita el «preparando…»
        }).catch(() => null);
      }
      const v = videoBase();
      if (!v) return null;
      const E = C.colorVivo && C.colorVivo._estado;
      return { elementos: [v, E && E.lienzo], video: v, duraciones: BA.datos.duraciones, impactos: BA.datos.impactos || [],
               apoyo: BA.datos.apoyo, graficos: BA.datos.graficos, palabras: BA.datos.palabrasNom, aReal: BA.datos.relojReal, id: 'base:' + BA.id };
    },
    /* ══ EL GUION (20-sep, idea de Sergio) ══ La transcripción de lo que DIJO, línea por línea, con su
       minuto y con lo que Cherry puso en cada una. Todo ya viene numerado por palabra: las escenas, los
       gráficos y las frases de impacto se anotan como «de la palabra 22 a la 30», y cada palabra sabe en
       qué segundo se dice. Aquí solo se junta. */
    guion() {
      const D = datosGuion();
      if (!D || !Array.isArray(D.palabras) || !D.palabras.length) return null;
      const pal = D.palabras;
      const fr = (D.frasesIA && D.frasesIA.length ? D.frasesIA : D.frases) || [];
      const aReal = D.relojReal || ((t) => t);
      // (24-sep) lo que sale de verdad, en segundos del video (antes: los momentos propuestos, por palabras)
      const puestos = colocados(D, aReal);
      const seVe = (p, t0, t1) => Number(p.t0) < t1 && Number(p.t1) > t0;
      return fr.map((f, i) => {
        const d = Number(f.desde) || 0, h = Number(f.hasta) || d;
        const texto = pal.slice(d, h + 1).map((w) => w.word).join(' ');
        const t0 = pal[d] ? aReal(Number(pal[d].start)) : 0;
        const t1 = pal[h] ? aReal(Number(pal[h].end)) : t0;          // (24-sep) cuánto dura una pantalla
        // (24-sep) inicio y fin de cada palabra en segundos del video: la pantalla se reparte por DURACIÓN
        const tp = pal.slice(d, h + 1).map((w) => [aReal(Number(w.start)), aReal(Number(w.end))]);
        return {
          i, desde: d, hasta: h, texto, t0, t1, tp,
          impacto: !!f.impacto || !!f.estilo,
          graficos: puestos.graficos.filter((p) => seVe(p, t0, t1)).map((p) => p.tipo),
          escenas: puestos.escenas.filter((p) => seVe(p, t0, t1)).length,
        };
      }).filter((l) => l.texto);
    },

    /* 20-sep: el id del render que guarda los gráficos (para regenerarlos desde la pestaña) */
    idBase() { return BA.id || null; },
    /* y cuando llegan los nuevos, se cambian aquí para que la vista previa los tome ya */
    ponerGraficos(gr) { if (BA.datos && gr) BA.datos.graficos = gr; },
    duracion, tiempo,
    _plan: () => P, _motor: M, _base: BA, _paso: paso,   // para revisar con la pestaña oculta (sin requestAnimationFrame)
  };
})();

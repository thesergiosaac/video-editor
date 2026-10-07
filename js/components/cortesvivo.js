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
 *
 * (6-oct-2026) FABRICAR AL FINAL. Ya no hay «primer render»: el editor se queda SIEMPRE en esta vista y el video se
 * fabrica una sola vez, al Descargar o Publicar (js/fabricar.js), con lo que sale de aquí (subsParaFabricar). La vista
 * de un proyecto hecho antes sale de su último video con estos mismos cortes (getVistaPorFirma): mismo video sin
 * subtítulos, sus frases y su edición guardada, sin volver a cortar nada.
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
    /* (6-oct) «sin cortes» y el revelado apagado también cambian la base (antes la vista seguía con la vieja). Solo se
       agregan cuando están puestos: así las bases que ya existen siguen sirviendo. */
    return R.clave + '|' + JSON.stringify(Object.assign({ clips: (s.clips || []).map((c) => c.id), gap: s.clipGap, ini: s.clipStart, aire: s.aire },
      s.sinCortes ? { sc: 1 } : {}, s.revelado === false ? { crudo: 1 } : {}));
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
      /* (6-oct) ¿ya hay una vista para estos cortes? La base, o un video ya hecho con ellos (proyectos de antes de
         fabricar al final): trae lo último que se vio —frases, titulares, la edición guardada— y no se vuelve a cortar nada. */
      const hecha = C.api.getVistaPorFirma ? await C.api.getVistaPorFirma(clave).catch(() => null) : null;
      if (hecha) { cargarBase(hecha); return; }
      // ¿una base para estos cortes que se está armando? (por ejemplo, tras recargar la página)
      const f = await C.api.getBaseAdelantada();
      if (f && f.subtitle_config && f.subtitle_config.firma_cortes === clave) {
        if (f.status === 'base') { cargarBase(f); return; }
        if (f.status === 'rendering' && Date.now() - Date.parse(f.created_at) < 8 * 60000) {
          BA.estado = 'armando'; BA.id = f.id; BA.inicio = Date.parse(f.created_at); etaBase(false); sondearBase(); return;
        }
      }
      BA.intentos++;
      const res = await C.api.prepararBase(C.ajustesGenerar(s), clave);
      if (!res || !res.render_id) throw new Error('sin render_id');
      BA.estado = 'armando'; BA.id = res.render_id; BA.inicio = Date.now(); etaBase(true);
      console.log('[Base] pedida', BA.id);
      sondearBase();
    } catch (e) {
      BA.estado = 'error'; console.warn('[Base] no se pudo pedir', e); etaBaseFin(false);
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
          BA.estado = 'error'; console.warn('[Base] falló', st && st.error_message); etaBaseFin(false);
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
      // (28-sep) para dibujar los subtítulos en vivo encima (Mover título): el video sin subtítulos y su reloj
      url: f.video_sin_subtitulos ? C.urlVideo(f.video_sin_subtitulos) : null,
      reloj: C.subs.relojNominal(nominales, reales),
      graficos: f.graficos || null, apoyo: f.apoyo || null,
      igualado: !!(f.segments_json && f.segments_json.igualado),     // (28-sep) tomas igualadas en F1
      palabrasNom: sp.palabras || pal, duraciones: reales,
      // (24-sep) los sonidos que este video YA trae horneados (para no tocarlos otra vez en la vista previa)
      sonidosHorneados: f.subtitle_config && Array.isArray(f.subtitle_config.sonidos) ? f.subtitle_config.sonidos : [],
      // (24-sep) con la voz de estudio, los efectos de ESE video van corridos esto (dB): la vista previa hace lo mismo
      efectosDb: f.voz_estudio && f.voz_estudio.estado === 'lista' ? Number(f.voz_estudio.efectos_db) || 0 : 0,
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
      if (GR && GR.conPantallas && pant.length) piezas = GR.conPantallas(piezas, pant, palN, aReal, dur, gcfg.fondo) || piezas;
    } catch (e) { piezas = []; }
    let escenas = [];
    try {
      if (AP && ecfg.cantidad && D.apoyo) escenas = AP.elegir(D.apoyo, palN, aReal, ecfg, dur, piezas.map((p) => ({ t0: p.t0, t1: p.t1 }))) || [];
    } catch (e) { escenas = []; }
    PUESTOS.clave = clave; PUESTOS.d = D;
    PUESTOS.val = { graficos: piezas.filter((p) => !p.pantalla), escenas, pantallas: piezas.filter((p) => p.pantalla) };
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
        if (C.state.openCard === 'guion' || C.state.openCard === 'audio') C.render();   // (24-sep) la tarjeta Sonido también los usa
      }).catch(() => { RV.pidiendo = null; });
    }
    return null;
  }

  const NIVEL_DE_CADA = { 20: 'pocas', 10: 'medio', 5: 'muchas' };
  /* (6-oct) Los datos de lo que se está viendo: la base de la vista previa o, con un video ya hecho en pantalla, el suyo */
  function datosVista() {
    const s = C.state;
    if (antesDelRender(s)) return baseLista(s) ? BA.datos : null;
    if (!s.renderId) return null;
    const D = datosGuion();
    return D && D !== BA.datos ? D : null;
  }

  function cargarBase(f) {
    const segs = (f.segments_json && f.segments_json.segments) || [];
    const nominales = segs.map((g) => Number(g.duration_sec));
    const sp = f.subtitle_phrases || {};
    const cfg = f.subtitle_config || {};
    /* (6-oct) un master se ve con la base liviana que guardó (la suya es de 10 bits) y con las duraciones de ESA base */
    const master = cfg.calidad === 'original';
    const reales0 = master ? cfg.vista_duraciones : f.duraciones_reales;
    const reales = Array.isArray(reales0) && reales0.length === nominales.length ? reales0.map(Number) : null;
    /* (6-oct) las palabras y frases que se VEN: la edición guardada (Editar resultado) si es válida; si no, las corregidas
       por la IA (palabras_vista). La palabra corregida lleva su original: al fabricar viaja como corrección. */
    const fr = C.frasesDeRender ? C.frasesDeRender(f) : null;
    const editadas = !!(fr && f.subtitle_edits && fr.palabras === f.subtitle_edits.palabras);
    const fuentePal = (fr && fr.palabras) || sp.palabras_vista || sp.palabras || [];
    const pal = fuentePal.map((w) => Object.assign({ word: String(w.word).trim(), start: Number(w.start), end: Number(w.end) },
      w.original != null ? { original: w.original } : {}));
    // cada palabra sabe de qué corte es (para partir las frases entre tomas)
    const inicios = []; let a = 0; nominales.forEach((d) => { inicios.push(a); a += d; });
    pal.forEach((w) => { let k = 0; while (k + 1 < inicios.length && w.start >= inicios[k + 1]) k++; w.corte = k; });
    const frasesIA = fr && fr.frases.length ? fr.frases : (Array.isArray(sp.frases) && sp.frases.length ? sp.frases : null);
    BA.datos = {
      url: C.urlVideo(C.baseDeFila ? C.baseDeFila(f) : f.video_sin_subtitulos),
      cortes: f.cortes_json || null,           // (2-oct) para saber si la edición hecha a mano vale (edicionvivo.js)
      reloj: C.subs.relojNominal(nominales, reales || nominales),     // tiempo del video real → tiempo de las palabras
      palabras: pal, frases: armarFrases(pal),
      // frases que ya marcó la IA en la base (orchestrate v186): con ellas la vista muestra las del video final
      frasesIA,
      // (6-oct) con qué nivel de impacto están escogidos esos titulares y si son una edición a mano (no se tocan)
      editadas, hayTitulares: !!(frasesIA && frasesIA.some((x) => x.impacto || x.estilo)),
      nivelIA: cfg.modo === 'impacto' ? (cfg.impacto || 'medio') : (NIVEL_DE_CADA[Number(sp.impacto_cada)] || null),
      // (7-oct) las frases con los titulares de cada nivel (orchestrate v259): cambiar el nivel se ve al instante
      porNivel: sp.frases_por_nivel && typeof sp.frases_por_nivel === 'object' ? sp.frases_por_nivel : null,
      // (7-oct) la voz de estudio de esta base para la vista previa (voz_estudio.vista, la prepara el ensamblador)
      voz: f.voz_estudio && typeof f.voz_estudio === 'object' ? f.voz_estudio : null,
      relojMov: window.CherryMov ? window.CherryMov.reloj(nominales, reales || nominales) : null,
      // movimiento en vivo (19-sep): duración real de cada corte + inicio de cada frase de impacto (en tiempo del video)
      duraciones: reales || nominales,
      impactos: window.CherryMov && frasesIA
        ? window.CherryMov.impactosDe(sp.palabras || pal, frasesIA, window.CherryMov.reloj(nominales, reales || nominales))
        : [],
      // escenas de apoyo (19-sep): lo que encontró la IA + palabras y reloj para ubicarlas en el video
      apoyo: f.apoyo || null, palabrasNom: sp.palabras || pal,
      // gráficos (19-sep): lo que marcó la IA (llega junto con las frases)
      graficos: f.graficos || null,
      relojReal: window.CherryApoyo ? window.CherryApoyo.reloj(nominales, reales || nominales) : null,
    };
    BA.datos.igualado = !!(f.segments_json && f.segments_json.igualado);   // (28-sep) tomas igualadas en F1
    BA.estado = 'lista'; BA.id = f.id || BA.id; etaBaseFin(true);
    console.log('[Base] lista', BA.id, '· ' + pal.length + ' palabras');
    pedirNiveles();                                         // (7-oct) los titulares de los niveles que falten
    setTimeout(asegurarVoz, 0);                             // (7-oct) la voz de estudio, si está prendida
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
      subsEdicion(v.currentTime || 0, BA.datos);
      sincronizarVoz(v);                       // (7-oct) la voz de estudio encima, si está prendida y lista
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
    if (VZ.audio && !VZ.audio.paused) VZ.audio.pause();      // (7-oct) la voz de estudio con él
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
  /* (6-oct) La plantilla de cada frase, la MISMA regla para la vista previa y para el video que se fabrica: en «solo
     impacto» las marcadas llevan la plantilla elegida; en todo el video, ninguna lleva plantilla aparte salvo que se la
     hayas puesto tú a mano en Editar resultado. */
  function estiloDe(f, impacto, pl, editadas) {
    if (impacto) return f.impacto || f.estilo ? pl : undefined;
    return editadas && f.estilo ? f.estilo : undefined;
  }
  function subsActuales(s, fuente) {
    const impacto = C.subs.modoImpacto(s);
    const pl = s.subsPlantilla || 'editorial';
    const cada = { pocas: 6, medio: 4, muchas: 2 }[s.subsImpacto] || 4;
    const frasesNivel = fuente === BA.datos ? frasesDe(fuente, s) : fuente.frasesIA;
    if (frasesNivel && window.FrasesServidor) {
      // las frases de la IA, repasadas EXACTAMENTE como el servidor (frases-servidor.js es copia de carrete-layer2):
      // en modo impacto las marcadas llevan la plantilla ANTES del repaso, igual que en orchestrate
      // (27-sep) con los títulos fijados en el Guion: quitar, poner y la altura propia de uno (como orchestrate)
      const crudas = C.aplicarTitulos(frasesNivel.map((f) => ({
        desde: f.desde, hasta: f.hasta, clave: Array.isArray(f.clave) ? f.clave.slice() : f.clave, cierra: f.cierra,
        estilo: estiloDe(f, impacto, pl, !!fuente.editadas),
      })), impacto ? pl : null);
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
  /* (2-oct) los subtítulos en las ventanas de la edición hecha a mano (edicionvivo.js): t = segundo del VIDEO */
  function subsEdicion(tv, fuente) {
    if (!C.edicionVivo || !S.capa) return;
    const p = S.paginas && S.paginas[S.pagina];
    // el inicio de la frase que se ve, en segundos del video (las páginas van en el reloj de las palabras)
    let ini = null;
    if (p && fuente && fuente.palabras && p.ids && p.ids.length) {
      const w0 = fuente.palabras[p.ids[0]];
      if (w0 && fuente.relojReal) ini = fuente.relojReal(Number(w0.start));
      else if (w0) ini = Number(w0.start);
    }
    C.edicionVivo.subs({ cortes: fuente && fuente.cortes !== undefined ? fuente.cortes : undefined }, S.capa, tv, ini);
  }
  function pintarSubs(t, fuente, animar) {
    const s = C.state;
    const capa = S.capa;
    if (!capa || !document.body.contains(capa)) return;
    if (S.fuente !== fuente) { S.fuente = fuente; S.clave = ''; }      // (28-sep) otra fuente (base ↔ video ya hecho)
    if (!s.captions || !fuente.palabras.length) { if (S.pagina !== -1) { capa.replaceChildren(); S.pagina = -1; } return; }
    const simple = C.subs.simpleVista(s);
    const clave = JSON.stringify([fuente === P ? 'r' : 'b', s.subsPlantilla, s.subsModo, s.subsImpacto, s.simpleClaveCada, s.subsEscala, s.subsDy, s.subsDx, simple,
      (s.guionFijos || {}).titulos || null]);
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

  /* ══ (6-oct) FABRICAR AL FINAL: lo que se manda es lo que se ve ══
     Las frases para el video final salen de la misma fuente y con la misma regla de plantilla que la vista previa
     (estiloDe). Solo si se pasó a «solo impacto» sin titulares escogidos, o con otro nivel del que trae la base, la IA
     los vuelve a escoger al fabricar (marcar); la etiqueta del celular lo avisa. */
  /* (7-oct) Sergio: «TODO DEBE VERSE EN LA VISTA PREVIA AL INSTANTE». La base trae las frases con los titulares de los tres
     niveles (porNivel); el nivel escogido solo escoge entre ellas. Lo editado a mano en Editar resultado manda. */
  function frasesDe(D, s) {
    if (!D) return null;
    if (!D.editadas && C.subs.modoImpacto(s) && D.porNivel) {
      const f = D.porNivel[s.subsImpacto || 'medio'];
      if (Array.isArray(f) && f.length) return f;
    }
    return D.frasesIA;
  }
  function hayQueMarcar(s, D) {
    if (!D || !C.subs.modoImpacto(s) || !s.captions || D.editadas) return false;
    const n = D.porNivel && D.porNivel[s.subsImpacto || 'medio'];
    if (Array.isArray(n) && n.length) return false;
    if (!D.frasesIA || !D.hayTitulares) return true;
    return !!(D.nivelIA && D.nivelIA !== (s.subsImpacto || 'medio'));
  }
  /* Los niveles que le falten a esta base (las de antes del 7-oct): se piden una vez, en segundo plano */
  const NV = { pedidos: {}, enCurso: null };
  function pedirNiveles() {
    const D = BA.datos, id = BA.id;
    if (!D || !id || D.editadas || !D.frasesIA || !C.api || !C.api.titularesNiveles) return;
    const tiene = D.porNivel && ['pocas', 'medio', 'muchas'].every((n) => Array.isArray(D.porNivel[n]) && D.porNivel[n].length);
    if (tiene || NV.pedidos[id]) return;
    NV.pedidos[id] = true; NV.enCurso = id;
    const e = window.CherryEta ? window.CherryEta.empezar('titulares', 15) : null;
    NV.eta = e;
    C.api.titularesNiveles(id).then((r) => {
      if (r && r.frases_por_nivel && BA.id === id && BA.datos) {
        if (e) e.fin();
        BA.datos.porNivel = r.frases_por_nivel;
        S.clave = ''; S.pagina = -2;
        console.log('[Base] titulares por nivel listos:', Object.keys(r.frases_por_nivel).join(', '));
      }
    }).catch((e) => console.warn('[Base] no salieron los titulares por nivel', e))
      .then(() => { if (e) e.parar(); if (NV.enCurso === id) { NV.enCurso = null; NV.eta = null; } ultimaEtiqueta = null; pintarEtiqueta(); });
  }
  /* Los momentos de impacto del movimiento de cámara, con los titulares del nivel escogido (los mismos que el video final) */
  function impactosDe(D, s) {
    if (!D || !window.CherryMov || !D.relojMov) return (D && D.impactos) || [];
    const fr = frasesDe(D, s);
    const k = (C.subs.modoImpacto(s) ? s.subsImpacto || 'medio' : 'todo') + '|' + (fr ? fr.length : 0) + '|' + (D.editadas ? 1 : 0);
    if (D._impK !== k) { D._impK = k; D._imp = fr ? window.CherryMov.impactosDe(D.palabrasNom, fr, D.relojMov) : []; }
    return D._imp;
  }

  /* ══ (7-oct) LA VOZ DE ESTUDIO EN LA VISTA PREVIA ══ Con la voz de estudio prendida, se pide (una vez por base) que el
     ensamblador la prepare; mientras tanto se oye la voz normal y la etiqueta lo dice. Lista, suena una pista aparte encima
     del video (que se silencia), corrida lo que Auphonic la atrasa, y los efectos de sonido se corren lo mismo que en el
     video final (efectos_db). */
  const VZ = { audio: null, url: '', pedidos: {}, sondeo: 0, silenciado: null };
  function vozDe(s) {
    const D = baseLista(s) && BA.datos;
    return D && s.vozEstudio && D.voz && D.voz.estado === 'lista' && D.voz.vista ? D.voz : null;
  }
  /* (7-oct) apagarla y prenderla otra vez reintenta una que no salió (así lo dice la tarjeta Sonido) */
  function olvidarVozFallida() {
    const D = BA.datos, id = BA.id;
    if (D && D.voz && (D.voz.estado === 'error' || D.voz.estado === 'tarde')) { D.voz = null; delete VZ.pedidos[id]; }
  }
  function asegurarVoz() {
    const s = C.state, id = BA.id, D = baseLista(s) && BA.datos;
    if (!D || !s.vozEstudio || !id || !C.api || !C.api.prepararVoz) return;
    if (D.voz && (D.voz.estado === 'lista' || D.voz.estado === 'cortinilla' || D.voz.estado === 'error' || D.voz.estado === 'tarde')) return;
    if (!VZ.pedidos[id]) {
      VZ.pedidos[id] = Date.now();
      if (VZ.eta) VZ.eta.parar();
      VZ.eta = window.CherryEta ? window.CherryEta.empezar('voz', 100) : null;   // (7-oct) cuánto falta
      if (C.state.openCard === 'audio') setTimeout(() => C.render(), 0);          // la tarjeta Sonido lo dice también
      D.voz = Object.assign({}, D.voz || {}, { estado: 'preparando' });
      C.api.prepararVoz(id).catch((e) => console.warn('[Voz] no se pudo pedir', e));
      ultimaEtiqueta = null; pintarEtiqueta();
    }
    if (VZ.sondeo) return;
    VZ.sondeo = setInterval(async () => {
      if (BA.id !== id || !BA.datos) { clearInterval(VZ.sondeo); VZ.sondeo = 0; return; }
      try {
        const f = await C.api.getRenderData(id);
        const v = f && f.voz_estudio;
        if (v && v.estado && v.estado !== 'preparando' && BA.id === id && BA.datos) {
          BA.datos.voz = v; clearInterval(VZ.sondeo); VZ.sondeo = 0;
          // se aprende lo que tardó solo si de verdad se preparó (una reusada sale en segundos)
          if (VZ.eta) { if (v.estado === 'lista' && !v.reutilizada) VZ.eta.fin(); else VZ.eta.parar(); VZ.eta = null; }
          console.log('[Voz] vista previa:', v.estado);
          ultimaEtiqueta = null; pintarEtiqueta();
          if (C.state.openCard === 'audio') C.render();   // la tarjeta Sonido dice cómo quedó
        }
      } catch (_) { /* un sondeo perdido no importa */ }
      if (Date.now() - (VZ.pedidos[id] || 0) > 15 * 60000) { clearInterval(VZ.sondeo); VZ.sondeo = 0; if (VZ.eta) { VZ.eta.parar(); VZ.eta = null; } }
    }, 8000);
  }
  function sincronizarVoz(v) {
    const voz = vozDe(C.state);
    if (!voz) {
      if (VZ.audio && !VZ.audio.paused) VZ.audio.pause();
      if (VZ.silenciado === v && v) { v.muted = false; VZ.silenciado = null; }
      return;
    }
    if (!VZ.audio) { VZ.audio = new Audio(); VZ.audio.preload = 'auto'; }
    const a = VZ.audio;
    if (VZ.url !== voz.vista) { VZ.url = voz.vista; a.src = voz.vista; }
    if (!v.muted) { v.muted = true; VZ.silenciado = v; }
    const t = (v.currentTime || 0) + (Number(voz.retardo) || 0);
    if (v.paused) { if (!a.paused) a.pause(); if (Math.abs(a.currentTime - t) > 0.05) { try { a.currentTime = t; } catch (_) {} } return; }
    const r = v.playbackRate || 1;
    if (a.paused) { try { a.currentTime = t; } catch (_) {} a.playbackRate = r; a.play().catch(() => null); return; }
    // (7-oct) medido en el banco: arranca ~0,06 s atrás. Un desfase chico se alcanza acelerando o frenando un 5 % un
    // instante (no se oye); solo uno grande (un salto, un corte) se corrige saltando
    const d = a.currentTime - t;
    if (Math.abs(d) > 0.12) { try { a.currentTime = t; } catch (_) {} a.playbackRate = r; }
    else if (Math.abs(d) > 0.025) a.playbackRate = r * (d < 0 ? 1.05 : 0.95);
    else if (a.playbackRate !== r) a.playbackRate = r;
  }

  function subsParaFabricar(s) {
    if (!baseLista(s) || !BA.datos) return null;
    const D = BA.datos, impacto = C.subs.modoImpacto(s), pl = s.subsPlantilla || 'editorial';
    const fuente = frasesDe(D, s) || D.frases;
    const frases = fuente.map((f) => {
      const o = Object.assign({}, f, { clave: Array.isArray(f.clave) ? f.clave.slice() : f.clave });
      const e = estiloDe(f, impacto, pl, !!D.editadas);
      if (e) o.estilo = e; else delete o.estilo;
      return o;
    });
    return { plantilla: impacto ? 'simple' : pl, palabras: D.palabras, frases, marcar: hayQueMarcar(s, D) };
  }
  /* Al salir de Editar resultado: lo editado pasa a la vista previa sin volver a leer la base */
  function refrescarEdicion(subs) {
    if (!BA.datos || !subs || !Array.isArray(subs.palabras) || subs.palabras.length !== BA.datos.palabras.length) return;
    BA.datos.palabras = subs.palabras.map((w, i) => Object.assign({}, BA.datos.palabras[i], { word: String(w.word).trim() },
      w.original != null ? { original: w.original } : {}));
    BA.datos.frases = armarFrases(BA.datos.palabras);
    BA.datos.frasesIA = subs.frases.map((f) => Object.assign({}, f, { clave: Array.isArray(f.clave) ? f.clave.slice() : f.clave }));
    BA.datos.editadas = true;
    BA.datos.hayTitulares = BA.datos.frasesIA.some((x) => x.impacto || x.estilo);
    S.clave = ''; S.pagina = -2;
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
  /* (7-oct) «cuánto falta» en la etiqueta (js/eta.js): la base, los gráficos y escenas, los titulares y la voz */
  let etqEta = null;
  function etaBase(aprender) {
    if (BA.eta) BA.eta.parar();
    BA.eta = window.CherryEta ? window.CherryEta.empezar('base', 40) : null;
    BA.etaAprende = !!aprender;                 // una base que ya venía armándose (tras recargar) no se aprende
  }
  function etaBaseFin(salio) {
    if (!BA.eta) return;
    if (salio && BA.etaAprende) BA.eta.fin(); else BA.eta.parar();
    BA.eta = null;
  }
  function etaExtras(falta) {
    if (falta && (!BA.etaX || BA.etaXid !== BA.id)) {
      if (BA.etaX) BA.etaX.parar();
      BA.etaX = window.CherryEta ? window.CherryEta.empezar('extras', 40) : null; BA.etaXid = BA.id;
    } else if (!falta && BA.etaX) { if (BA.etaXid === BA.id) BA.etaX.fin(); else BA.etaX.parar(); BA.etaX = null; }
    return falta ? BA.etaX : null;
  }
  function etiquetaTexto() {
    etqEta = null;
    if (baseLista(C.state)) {
      const falta = faltanExtras();
      const eX = etaExtras(falta);
      if (falta) { etqEta = eX; return 'Vista previa · preparando ' + falta; }
      if (hayQueMarcar(C.state, BA.datos)) {
        if (NV.enCurso === BA.id) { etqEta = NV.eta || null; return 'Vista previa · escogiendo los titulares de este nivel'; }
        return 'Vista previa · los titulares los escoge Cherry al fabricar';
      }
      const vz = C.state.vozEstudio && BA.datos && BA.datos.voz;
      if (C.state.vozEstudio && (!vz || vz.estado === 'preparando')) { etqEta = VZ.eta || null; return 'Vista previa · preparando tu voz de estudio'; }
      // (7-oct) un look con silueta (Selectivo…): mientras Cherry recorta a la persona, se dice aquí con cuánto falta
      const rc = C.colorVivo && C.colorVivo.recorte ? C.colorVivo.recorte() : null;
      if (rc) { etqEta = rc.eta; return 'Vista previa · ' + rc.texto; }
      if (vz && vz.estado === 'cortinilla') return 'Vista previa · voz normal (Auphonic gratis le pone su cortinilla)';
      if (vz && (vz.estado === 'error' || vz.estado === 'tarde')) return 'Vista previa · la voz de estudio no salió: se oye tu voz normal';
      return 'Vista previa';
    }
    if (BA.estado === 'armando') { etqEta = BA.eta || null; return etqEta ? 'Vista rápida · la fluida llega pronto' : 'Vista rápida · la fluida llega en unos segundos'; }
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
    const txt = etiquetaTexto(), reintentar = !baseLista(C.state) && baseRendida(), e = etqEta;
    const clave = txt + '|' + reintentar + '|' + (e ? e.id : '');
    if (clave === ultimaEtiqueta) return;            // no se rehace en cada latido (el botón se perdería a medio clic)
    ultimaEtiqueta = clave;
    document.querySelectorAll('.js-cvc-etiqueta').forEach((el) => {
      // (7-oct) el «faltan ≈ 0:40» lo pone al día js/eta.js cada segundo
      if (!reintentar && e) { el.replaceChildren(txt + ' · ', h('span', { 'data-eta': e.id }, e.texto())); return; }
      if (!reintentar) { el.textContent = txt; return; }
      el.replaceChildren(txt + ' · ', h('button', {
        class: 'cv-reintentar', type: 'button',
        onClick: (e) => { e.stopPropagation(); e.preventDefault(); reintentarBase(); },
      }, 'Reintentar'));
    });
  }

  /* (28-sep) IGUALAR TOMAS en la vista de cortes: cada toma con su corrección, la MISMA cuenta que hace F1 con las
     medidas de todas las tomas (motor-color.js › igualarTomas). Si a un clip le falta la medida, ninguna se iguala. */
  const IG = { plan: null, clave: '', prims: null };
  function primariaActual() {
    const MC = window.CherryColor;
    if (!P || !P.cortes || !P.cortes[M.idx] || !MC || !MC.igualarTomas || C.state.revelado === false) return null;
    const clips = C.state.clips || [];
    const clave = clips.map((c) => c.id + (c.color_toma ? '+' : '-')).join(',');
    if (IG.plan !== P || IG.clave !== clave) {
      IG.plan = P; IG.clave = clave;
      const porId = {};
      clips.forEach((c) => { if (c.color_toma) porId[c.id] = c.color_toma; });
      const medidas = P.cortes.map((k) => porId[k.clipId]);
      IG.prims = medidas.every(Boolean) ? MC.igualarTomas(medidas) : null;
    }
    return IG.prims ? { id: P.cortes[M.idx].clipId, valor: IG.prims[M.idx] } : null;
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
      lienzo = C.colorVivo ? C.colorVivo.sobre(() => v, 'base:' + BA.id, { igualado: !!BA.datos.igualado }) : null;
    } else {
      videos = [];
      for (let i = 0; i < N_REP; i++) videos.push(rep(i));
      mostrarActivo();
      // color en vivo encima: el lienzo pinta el reproductor que esté sonando
      lienzo = C.colorVivo ? C.colorVivo.sobre(() => rep(repDe(M.idx)), 'cortes:' + R.clave, { primaria: primariaActual }) : null;
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
    if (s.pantalla === 'editor' && antesDelRender(s)) { leer(false); asegurarBase(); asegurarVoz(); pintarEtiqueta(); }
    // (7-oct) la voz de estudio nunca sigue sonando sola (se salió del editor o el video se quitó)
    if (VZ.audio && !VZ.audio.paused) { const vb = videoBase(); if (!vb || !document.body.contains(vb) || vb.paused) VZ.audio.pause(); }
  }, 4000);

  /* ══ (28-sep) EL TÍTULO que se está moviendo, sobre el video YA HECHO ══ Sergio: «al mover el título, la vista previa no
     me muestra dónde lo estoy poniendo». El video terminado trae los títulos quemados en su sitio viejo. Con el panel
     «Mover título» abierto, el celular pasa a ese mismo video SIN subtítulos (con el color, como sale), repite solo el
     momento de esa línea y dibuja encima los subtítulos en vivo con lo fijado en el Guion: al arrastrar, se mueve ahí. */
  const TV = { raf: 0, desde: 0, hasta: 0 };
  function lineaAbierta(s) {
    if (s.tituloAbierto == null) return null;
    const lineas = C.cortesVivo.guion();
    return lineas ? lineas.find((l) => l.desde === s.tituloAbierto) || null : null;
  }
  function tituloActivo(s) {
    if (s.openCard !== 'guion' || s.tituloAbierto == null || !s.captions || !s.renderId || antesDelRender(s)) return false;
    if (!C.subs.modoImpacto(s)) return false;
    const D = datosGuion();
    return !!(D && D !== BA.datos && D.url && D.reloj && lineaAbierta(s));
  }
  function tituloPaso() {
    TV.raf = 0;
    const v = C.videoFijo.get('titulo-previa'), D = RV.datos;
    if (!v || !D || !document.body.contains(v)) { if (v && !v.paused) v.pause(); return; }
    // una y otra vez el momento de esa línea
    if (v.readyState >= 1 && (v.currentTime < TV.desde - 0.05 || v.currentTime > TV.hasta)) v.currentTime = TV.desde;
    if (v.paused && v.readyState >= 2) v.play().catch(() => null);
    pintarSubs(D.reloj(v.currentTime || 0), D, true);
    TV.raf = requestAnimationFrame(tituloPaso);
  }
  function tituloPantalla(s) {
    const D = RV.datos, l = lineaAbierta(s);
    // desde la primera palabra (antes asomaba el título anterior) hasta un poco después de la última
    TV.desde = Math.max(0, l.t0 + 0.02); TV.hasta = l.t1 + 0.45;
    const v = C.videoFijo('titulo-previa', D.url, { class: 'cv-video', crossorigin: 'anonymous', muted: true, playsinline: true, preload: 'auto' });
    v.muted = true;
    if (C.corsConRespaldo) C.corsConRespaldo(v);
    const grande = C.videoFijo.get('vista');          // el video terminado no sigue sonando por detrás
    if (grande && !grande.paused) grande.pause();
    const lienzo = C.colorVivo ? C.colorVivo.sobre(() => v, 'titulo:' + RV.id, { igualado: !!D.igualado }) : null;   // con el color, como sale
    if (!S.capa) S.capa = h('div', { class: 'ed-vivo cvc-subs' });
    S.pagina = -2;
    if (!TV.raf) TV.raf = requestAnimationFrame(tituloPaso);
    return h('div', { class: 'cv' }, v, lienzo, S.capa, h('div', { class: 'cv-etiqueta' }, 'Así queda este título'));
  }

  C.cortesVivo = {
    listo, armando, pantalla, pantallaArmando, alternar, reproducir, pausar, irA, leer, baseParaGenerar, esperarBase,
    /* (6-oct) fabricar al final: lo que se ve, para mandarlo tal cual; lo editado a mano; si la vista ya está lista */
    subsParaFabricar, refrescarEdicion, vistaLista: () => baseLista(C.state), rendida: baseRendida, datosVista,
    /* (7-oct) el estado de la voz de estudio de la vista previa: 'lista' | 'preparando' | 'cortinilla' | 'error' | null */
    vozEstado: () => { const D = baseLista(C.state) && BA.datos; return D && D.voz ? D.voz.estado || null : null; },
    vozEta: () => VZ.eta || null, olvidarVozFallida, asegurarVoz,
    tituloVivo: { activo: tituloActivo, pantalla: tituloPantalla },
    enUso: () => listo(C.state),
    /* (24-sep) el reloj y las palabras del video YA HECHO que se ve, y los sonidos que trae horneados */
    datosVideo() {
      /* (6-oct) fabricar al final: lo que se ve es la base, que no trae nada horneado (los sonidos suenan en vivo) */
      const D = datosVista();
      // (7-oct) con la voz de estudio sonando en la vista previa, los efectos se corren lo mismo que en el video final
      const vz = D && D === BA.datos ? vozDe(C.state) : null;
      return D ? { aReal: D.relojReal, palabras: D.palabrasNom || D.palabras, sonidos: D.sonidosHorneados || [],
                   efectosDb: vz ? Number(vz.efectos_db) || 0 : (D.efectosDb || 0) } : null;
    },
    /* (24-sep) TODO lo que pasa en el video ya hecho, en segundos del video: para que Cherry ponga los efectos de sonido
       (sonidos-auto.js). Las mismas escenas, gráficos y pantallas que marca el Guion y que pone el ensamblador. */
    momentos() {
      const D = datosVista();
      if (!D || !Array.isArray(D.palabras) || !D.palabras.length) return null;
      const aReal = D.relojReal || ((t) => t);
      const puestos = colocados(D, aReal);
      return { aReal, palabras: D.palabrasNom || D.palabras, duraciones: D.duraciones, frases: (D === BA.datos ? frasesDe(D, C.state) : D.frasesIA) || D.frases || [],
               escenas: puestos.escenas, graficos: puestos.graficos, pantallas: puestos.pantallas || [] };
    },
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
      return { elementos: [v, E && E.lienzo], video: v, duraciones: BA.datos.duraciones, impactos: impactosDe(BA.datos, C.state),
               apoyo: BA.datos.apoyo, graficos: BA.datos.graficos, palabras: BA.datos.palabrasNom, aReal: BA.datos.relojReal, id: 'base:' + BA.id,
               cortes: BA.datos.cortes };
    },
    /* ══ EL GUION (20-sep, idea de Sergio) ══ La transcripción de lo que DIJO, línea por línea, con su
       minuto y con lo que Cherry puso en cada una. Todo ya viene numerado por palabra: las escenas, los
       gráficos y las frases de impacto se anotan como «de la palabra 22 a la 30», y cada palabra sabe en
       qué segundo se dice. Aquí solo se junta. */
    guion() {
      const D = datosGuion();
      if (!D || !Array.isArray(D.palabras) || !D.palabras.length) return null;
      const pal = D.palabras;
      const fnivel = D === BA.datos ? frasesDe(D, C.state) : D.frasesIA;   // (7-oct) las del nivel escogido
      const fr = (fnivel && fnivel.length ? fnivel : D.frases) || [];
      const aReal = D.relojReal || ((t) => t);
      // (24-sep) lo que sale de verdad, en segundos del video (antes: los momentos propuestos, por palabras)
      const puestos = colocados(D, aReal);
      // (24-sep) se ve en la línea si coincide al menos 0,2 s: una escena que empieza justo al final de una línea no la marca
      const seVe = (p, t0, t1) => Math.min(t1, Number(p.t1)) - Math.max(t0, Number(p.t0)) >= 0.2;
      return fr.map((f, i) => {
        const d = Number(f.desde) || 0, h = Number(f.hasta) || d;
        const texto = pal.slice(d, h + 1).map((w) => w.word).join(' ');
        const t0 = pal[d] ? aReal(Number(pal[d].start)) : 0;
        const t1 = pal[h] ? aReal(Number(pal[h].end)) : t0;          // (24-sep) cuánto dura una pantalla
        // (24-sep) inicio y fin de cada palabra en segundos del video: la pantalla se reparte por DURACIÓN
        const tp = pal.slice(d, h + 1).map((w) => [aReal(Number(w.start)), aReal(Number(w.end))]);
        // (27-sep) lo fijado en el Guion manda sobre lo que escogió Cherry (el fijado se hace con la línea exacta)
        const fijo = C.tituloDe ? C.tituloDe({ desde: d, hasta: h }) : null;
        const deCherry = !!f.impacto || !!f.estilo;
        return {
          i, desde: d, hasta: h, texto, t0, t1, tp,
          impacto: fijo && fijo.tipo ? fijo.tipo === 'si' : deCherry,
          quitado: !!(fijo && fijo.tipo === 'no'),
          tituloY: fijo && fijo.y != null ? fijo.y : null,
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

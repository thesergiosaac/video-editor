/* adelantado.js — el RENDER ADELANTADO (18-sep-2026).
 *
 * Los dos carriles de Cherry: lo que ves se pinta al instante en el navegador (color en vivo,
 * subtítulos en vivo) y el archivo real se hace en el servidor EN SEGUNDO PLANO. Cuando la persona
 * cambia algo que afecta el video (color, plantilla, tamaño, frases…) y deja de tocar unos segundos,
 * aquí se arranca el camino rápido (reusa la base ya cortada: ~50 s). Así el botón Descargar
 * siempre da el video tal como se ve, y al exportar el archivo casi siempre ya está listo.
 *
 * · BASE: el video que se está viendo (su id, sus frases y con qué cortes se hizo).
 * · ADELANTADO: el render que se está haciendo (o ya está) con los cambios.
 * · Si cambian los CORTES (clips, ritmo, silencios, guion) el camino rápido no sirve: el botón pasa a
 *   «Regenerar video» (proceso completo), nunca se lanza solo. Desde el 18-sep el modo y el nivel de impacto y
 *   apagar/encender los subtítulos van por el camino rápido (la IA vuelve a escoger solo los titulares).
 * · Uno a la vez: si llegan más cambios mientras se hace uno, se espera a que termine.
 * · Nunca se redibuja toda la página desde aquí (un redibujo suelta el deslizador que se está
 *   arrastrando): solo se reemplaza la zona del botón.
 * · Los créditos hoy no se descuentan en el servidor; cuando se cobren, estos renders NO deben cobrarse.
 */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const ESPERA = 6000;     // quieto este tiempo → arranca
  const REVISA = 1500;
  const SONDEO = 3000;

  const B = { renderId: null, cfg: null, subs: null, firmaCortes: null, firma: null, cargado: false };
  const A = { estado: null, firma: null, renderId: null, url: null, pct: 0, inicio: 0, alTerminar: null, marcar: false, que: '' };
  let visto = null, cambioEn = 0, ultimaEdicion = null, ultimoUI = '', enEditor = false, ultimaFirma = null;

  /* La firma de una carga: todo menos QUÉ render se reusa (eso cambia cuando el adelantado pasa a ser la base) */
  function firmaDe(c) { return c ? JSON.stringify({ s: c.subtitulos, c: c.color, m: c.movimiento || null, e: c.escenas || null, g: c.graficos || null, p: c.pantallas || null, so: c.sonidos || null, vz: c.voz || null }) : null; }

  /* ── La base ── */
  function nuevaBase(renderId, op) {
    op = op || {};
    const conservar = !!(op.conservarFrases && B.subs);
    B.renderId = renderId || null;
    B.firmaCortes = op.cortesLuego ? null : C.firmaCortes(C.state);
    B.firma = op.firma || null;
    if (!conservar) { B.subs = null; B.cfg = null; B.cargado = false; }
    if (!op.desdeAdelantado) limpiarA();
    visto = null;
    pintar();
    if (!renderId || conservar) return;
    C.api.getRenderData(renderId).then((data) => {
      if (B.renderId !== renderId || !data) return;
      B.cfg = data.subtitle_config || null;
      const f = C.frasesDeRender(data);
      B.subs = f ? { plantilla: f.plantilla, palabras: f.palabras, frases: f.frases } : null;
      B.cargado = true;
    }).catch((e) => console.warn('[Adelantado] no se pudo leer la base', e));
  }
  function limpiarA() { A.estado = null; A.firma = null; A.renderId = null; A.url = null; A.alTerminar = null; A.marcar = false; A.que = ''; }

  /* ── Lo que se mandaría ahora mismo al camino rápido ── */
  function carga(s) {
    if (!B.renderId) return null;
    let subs;
    if (s.resultEdit && s.editorSubs) subs = s.editorSubs;
    else if (B.subs) {
      const pl = s.subsPlantilla || 'editorial';
      const eraImpacto = !!(B.cfg && B.cfg.modo === 'impacto');
      const quiereImpacto = C.subs.modoImpacto(s);
      let frases = B.subs.frases, marcar = false;
      if (quiereImpacto) {
        // pasar a «solo impacto» u otro nivel: la IA vuelve a escoger SOLO los titulares (no se corta nada)
        if (!eraImpacto || (B.cfg.impacto || 'medio') !== (s.subsImpacto || 'medio')) marcar = true;
        // volver a encender los subtítulos: el video apagado guardó las frases sin titulares → se piden otra vez
        if (!frases.some((f) => f.estilo)) marcar = true;
        // las frases llamativas llevan su plantilla: si cambió la elegida, se cambia en ellas
        if (eraImpacto && B.cfg.plantilla_impacto && B.cfg.plantilla_impacto !== pl)
          frases = frases.map((f) => (f.estilo === B.cfg.plantilla_impacto ? Object.assign({}, f, { estilo: pl }) : f));
      } else if (eraImpacto) {
        // en todo el video (o «a tu gusto»): ninguna frase lleva plantilla aparte
        frases = frases.map((f) => { if (!f.estilo) return f; const o = Object.assign({}, f); delete o.estilo; return o; });
      }
      subs = { plantilla: quiereImpacto ? 'simple' : pl, palabras: B.subs.palabras, frases, marcar };
    } else return null;
    return C.cargaRapida(s, subs, B.renderId);
  }

  function puede(s) {
    return !!(C.apiReady && s.pantalla === 'editor' && s.phase === 'done' && !s.editorExporting &&
      B.renderId && s.renderId === B.renderId);
  }
  let rastroCortes = null;
  function cortesCambiaron(s) {
    const cambio = B.firmaCortes != null && C.firmaCortes(s) !== B.firmaCortes;
    // Rastro (18-sep): a Sergio le salió «Regenerar video» sin saber por qué → la consola dice QUÉ parte cambió
    if (cambio && rastroCortes !== B.firmaCortes) {
      rastroCortes = B.firmaCortes;
      try {
        const antes = JSON.parse(B.firmaCortes), ahora = JSON.parse(C.firmaCortes(s));
        const partes = Object.keys(ahora).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(ahora[k]));
        console.warn('[Adelantado] «Regenerar video»: cambió ' + partes.join(', '), partes.map((k) => ({ parte: k, antes: antes[k], ahora: ahora[k] })));
      } catch (e) { /* solo es un rastro */ }
    }
    return cambio;
  }

  /* ── El vigilante ── */
  function tick() {
    const s = C.state;
    const ahoraEditor = !!(s.resultEdit && s.editorSubs);
    if (ahoraEditor !== enEditor) {
      // Cambio de camino (editor del resultado ↔ página): las frases se leen distinto. Si no había cambios
      // pendientes, la base se vuelve a medir por el camino nuevo; si no, un detalle de forma lanzaría un render de más.
      const sinPendientes = ultimaFirma != null && ultimaFirma === B.firma;
      if (!ahoraEditor && ultimaEdicion) {
        // lo editado pasa a la base al salir (si no, se perdería en el camino rápido)
        if (B.subs) B.subs = { plantilla: ultimaEdicion.plantilla, palabras: ultimaEdicion.palabras, frases: ultimaEdicion.frases };
        if (!(B.cfg && B.cfg.modo === 'impacto') && ultimaEdicion.plantilla && ultimaEdicion.plantilla !== 'simple') s.subsPlantilla = ultimaEdicion.plantilla;
        ultimaEdicion = null;
      }
      if (sinPendientes) B.firma = null;
      enEditor = ahoraEditor;
    }
    if (ahoraEditor) ultimaEdicion = s.editorSubs;
    if (!puede(s)) { pintar(); return; }
    if (B.firmaCortes == null) B.firmaCortes = C.firmaCortes(s);
    const c = carga(s);
    const f = firmaDe(c);
    ultimaFirma = f;
    if (!f) { pintar(); return; }
    if (B.firma == null) B.firma = f;                         // primera lectura: así es el video que se ve
    if (f !== visto) { visto = f; cambioEn = Date.now(); }
    if (!cortesCambiaron(s) && f !== B.firma && f !== A.firma && A.estado !== 'renderizando' && Date.now() - cambioEn >= ESPERA) lanzar(c, f);
    // ya listo y es justo lo que se ve → pasa a ser el video del celular (fuera del editor y sin interrumpir)
    if (A.estado === 'listo' && A.firma === f && !s.resultEdit) {
      const v = C.videoVista && C.videoVista();
      if (!v || v.paused) aplicar();
    }
    pintar();
  }

  async function lanzar(c, f) {
    A.que = queCambia(c); A.marcar = !!(c.subtitulos && c.subtitulos.marcar_titulares);
    A.estado = 'renderizando'; A.firma = f; A.renderId = null; A.url = null; A.pct = 3; A.inicio = Date.now(); A.alTerminar = null;
    pintar();
    const s = C.state;
    try {
      const res = await C.api.reExportWithEdits(null, null, Object.assign({
        captionStyle: s.captionStyle, captionPosition: s.captionPosition, combo: s.graphicsCombo,
        heroColor: s.graphicsHeroColor, supColor: s.graphicsSupColor, bg: s.graphicsBg,
      }, c));
      if (A.firma !== f) return;                                // mientras tanto se descartó
      if (!res || !res.render_id) throw new Error('sin render_id');
      if (!res.rapido) console.warn('[Adelantado] el servidor no tomó el camino rápido: render completo');
      A.renderId = res.render_id;
      console.log('[Adelantado] arrancó', A.renderId);
      sondear(f);
    } catch (e) {
      if (A.firma === f) { A.estado = 'error'; console.warn('[Adelantado] no arrancó', e); fallo(); }
    }
  }

  function sondear(f) {
    const t = setInterval(async () => {
      if (A.firma !== f || A.estado !== 'renderizando') { clearInterval(t); return; }
      try {
        const st = await C.api.getPipelineStatus(A.renderId);
        if (A.firma !== f) { clearInterval(t); return; }
        if (st.layer2_url) {
          clearInterval(t);
          A.estado = 'listo'; A.url = st.layer2_url; A.pct = 100;
          console.log('[Adelantado] listo en', Math.round((Date.now() - A.inicio) / 1000), 's');
          if (A.alTerminar) { const fn = A.alTerminar; A.alTerminar = null; fn(); } else tick();
        } else if (st.status === 'error') {
          clearInterval(t); A.estado = 'error'; console.warn('[Adelantado] error del servidor', st.error_message); fallo();
        } else {
          A.pct = Math.min(95, 3 + ((Date.now() - A.inicio) / 1000) * (A.marcar ? 0.9 : 1.6));   // ~60 s (~110 s con titulares)
          pintar();
        }
      } catch (e) { /* un sondeo perdido no importa */ }
    }, SONDEO);
  }

  function fallo() {
    if (A.alTerminar) {                                          // alguien estaba esperando para exportar
      A.alTerminar = null;
      C.setState({ editorExporting: false, editorExportProgress: 0 });
      alert('No se pudo preparar el video. Intenta exportar de nuevo.');
    }
    pintar();
  }

  /* ── Fuera del editor: el adelantado pasa a ser el video que se ve ── */
  function aplicar() {
    const id = A.renderId, url = A.url, f = A.firma, marcar = A.marcar;
    C.setState({ downloadUrl: url, renderUrl: null, videoReady: false, renderId: id }, { render: false });
    // con titulares nuevos, la base se vuelve a leer (sus frases y su modo cambiaron); si no, se conservan
    nuevaBase(id, marcar ? { desdeAdelantado: true } : { firma: f, conservarFrases: true, desdeAdelantado: true });
    limpiarA();
    C.mostrarVideo(url);
  }

  /* ── Exportar desde el editor: si el adelantado ya tiene (o está haciendo) esto, se usa ── */
  function usarParaExportar() {
    const f = firmaDe(carga(C.state));
    if (!f || f !== A.firma || (A.estado !== 'listo' && A.estado !== 'renderizando')) return false;
    const terminar = async () => {
      const id = A.renderId, url = A.url, marcar = A.marcar;
      C.setState({ downloadUrl: url, renderUrl: null, videoReady: false, renderId: id, editorExportProgress: 100 }, { render: false });
      nuevaBase(id, marcar ? { desdeAdelantado: true } : { conservarFrases: true, desdeAdelantado: true });   // la firma se toma otra vez al recargar el editor
      limpiarA();
      C.mostrarVideo(url);
      await C.actions.openEditor();
      C.setState({ editorExporting: false, editorExportDone: true });
    };
    if (A.estado === 'listo') {
      C.setState({ editorExporting: true, editorExportProgress: 100, editorExportDone: false, editorExportRapido: true });
      terminar();
    } else {
      C.setState({ editorExporting: true, editorExportProgress: Math.round(A.pct), editorExportDone: false, editorExportRapido: true });
      A.alTerminar = terminar;
    }
    console.log('[Adelantado] exportar usa el render adelantado (' + A.estado + ')');
    return true;
  }

  /* ── Interfaz ── */
  function estadoUI(s) {
    if (!B.renderId || s.phase !== 'done') return 'igual';
    if (cortesCambiaron(s)) return 'cortes';
    if (B.cargado && !B.subs && s.captions) return 'cortes';     // el video se hizo sin subtítulos: hay que transcribir
    const f = firmaDe(carga(s));
    if (!f || B.firma == null || f === B.firma) return 'igual';
    if (f === A.firma) return A.estado === 'listo' ? 'listo' : A.estado === 'renderizando' ? 'renderizando' : 'igual';
    return 'esperando';
  }

  /* B (18-sep): qué va a rehacer el camino rápido, para decirlo en el botón */
  function queCambia(c) {
    try {
      const antes = JSON.parse(B.firma || 'null'), ahora = c && JSON.parse(firmaDe(c));
      if (!antes || !ahora) return 'tus cambios';
      const partes = [];
      if (c.subtitulos && c.subtitulos.marcar_titulares) partes.push('titulares');
      else if (JSON.stringify(antes.s) !== JSON.stringify(ahora.s)) partes.push(c.subtitulos && c.subtitulos.apagados ? 'quitar subtítulos' : 'subtítulos');
      if (JSON.stringify(antes.c) !== JSON.stringify(ahora.c)) partes.push('color');
      if (JSON.stringify(antes.m) !== JSON.stringify(ahora.m)) partes.push('movimiento');
      if (JSON.stringify(antes.e) !== JSON.stringify(ahora.e)) partes.push('escenas de apoyo');
      if (JSON.stringify(antes.g || null) !== JSON.stringify(ahora.g || null)) partes.push('gráficos');
      if (JSON.stringify(antes.p || null) !== JSON.stringify(ahora.p || null)) partes.push('pantallas');
      if (JSON.stringify(antes.so || null) !== JSON.stringify(ahora.so || null)) partes.push('sonidos');
      if ((antes.vz || null) !== (ahora.vz || null)) partes.push(ahora.vz ? 'voz de estudio' : 'quitar la voz de estudio');
      return partes.join(' y ') || 'tus cambios';
    } catch (_) { return 'tus cambios'; }
  }
  /* Por qué hay que regenerar completo */
  function razonCortes(s) {
    if (B.cargado && !B.subs && s.captions) return 'faltan subtítulos';
    try {
      const antes = JSON.parse(B.firmaCortes), ahora = JSON.parse(C.firmaCortes(s));
      if (JSON.stringify(antes.clips) !== JSON.stringify(ahora.clips)) return 'cambiaron los clips';
      if (antes.guion !== ahora.guion) return 'cambió el guion';
      return 'cambió el ritmo';
    } catch (_) { return 'cambiaron los cortes'; }
  }
  const dosLineas = (arriba, abajo) => h('span', { class: 'btn__txt' }, arriba, h('span', { class: 'btn__sub' }, abajo));

  /* ── (24-sep) LA CALIDAD ORIGINAL. Sergio, al ver publicado el master a 60 cuadros: «así debe ser siempre». La copia
     de 720p a 30 cuadros es solo para editar: Descargar da el MASTER (cortado del archivo tal como se grabó, a sus
     cuadros). Si este video todavía no lo tiene, se pide al servidor y, cuando está, el botón lo baja. ── */
  const MA = { fuente: null, leyendo: false, estado: 'nada', master: null, url: null, t0: 0, error: null };
  const esMaster = (r) => !!r && (((r.subtitle_config || {}).calidad === 'original') || !!r.output_original_url);
  function mirarOriginal(s) {
    if (!s.renderId || MA.fuente === s.renderId || MA.leyendo) return;
    MA.leyendo = true;
    const rid = s.renderId;
    C.api.getRenderData(rid).then((r) => {
      Object.assign(MA, { fuente: rid, estado: 'nada', master: null, url: null, error: null });
      if (esMaster(r)) Object.assign(MA, { estado: 'listo', master: rid, url: r.output_original_url || r.output_url });
    }).catch(() => { MA.fuente = rid; }).then(() => { MA.leyendo = false; ultimoUI = ''; pintar(); });
  }
  async function pedirOriginal() {
    const s = C.state;
    if (!s.renderId || MA.estado === 'pidiendo' || MA.estado === 'preparando') return;
    const rid = s.renderId;
    Object.assign(MA, { fuente: rid, estado: 'pidiendo', error: null, t0: Date.now() });
    ultimoUI = ''; pintar();
    try {
      const r = await C.api.edgeFetch('orchestrate', { project_id: C.session.projectId, reusar_render: rid, calidad: 'original' });
      if (!r || !r.render_id) throw new Error((r && r.error) || 'no respondió');
      Object.assign(MA, { estado: 'preparando', master: r.render_id });
      const seguir = setInterval(async () => {
        if (MA.fuente !== rid || MA.estado !== 'preparando') { clearInterval(seguir); return; }
        try {
          const m = await C.api.getRenderData(MA.master);
          if (m && m.status === 'done' && (m.output_original_url || m.output_url)) {
            clearInterval(seguir);
            Object.assign(MA, { estado: 'listo', url: m.output_original_url || m.output_url });
          } else if (m && m.status === 'error') {
            clearInterval(seguir);
            Object.assign(MA, { estado: 'error', error: 'no salió' });
          }
        } catch (_) { /* se reintenta en la próxima vuelta */ }
        ultimoUI = ''; pintar();
      }, 5000);
    } catch (e) {
      Object.assign(MA, { estado: 'error', error: String((e && e.message) || e).slice(0, 120) });
    }
    ultimoUI = ''; pintar();
  }
  const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function botonOriginal(s) {
    mirarOriginal(s);
    if (MA.fuente !== s.renderId) return h('span', { class: 'btn btn--download btn--wait' }, h('span', { class: 'spinner' }), 'Descargar');
    if (MA.estado === 'listo' && MA.url) {
      return h('a', { class: 'btn btn--download', href: C.urlVideo(MA.url), download: 'video-cherry.mp4', target: '_blank', rel: 'noopener',
        title: 'En la calidad en que se grabó, a sus cuadros' }, dosLineas('Descargar', 'calidad original'));
    }
    if (MA.estado === 'pidiendo' || MA.estado === 'preparando') {
      return h('span', { class: 'btn btn--download btn--wait', title: 'Cherry lo corta de tus grabaciones originales. Puedes seguir trabajando.' },
        h('span', { class: 'spinner' }), dosLineas('Preparando original', mmss(Date.now() - MA.t0) + ' · unos 5 min'));
    }
    return h('button', { class: 'btn btn--download', onClick: () => pedirOriginal(),
      title: 'Este mismo video cortado de tus grabaciones originales (su calidad y sus cuadros). La primera vez tarda unos 5 minutos.' },
      dosLineas(MA.estado === 'error' ? 'Reintentar' : 'Descargar', MA.estado === 'error' ? 'la calidad original no salió' : 'calidad original · ~5 min'));
  }

  /* (24-sep) «Publicar →»: lleva al Calendario con este video listo para programar. El servidor publica siempre el
     master (ig-publicar v2). Con cambios sin aplicar se espera: si no, se programaría el video anterior. */
  function botonPublicar(s) {
    const e = estadoUI(s);
    if (e === 'esperando' || e === 'renderizando' || e === 'cortes') {
      return h('button', { class: 'btn btn--publish', disabled: true, title: 'Primero se aplican tus cambios: así se publica el video tal como lo ves' }, 'Publicar →');
    }
    return h('button', { class: 'btn btn--publish', title: 'Programarlo o publicarlo en el Calendario (sale en la calidad original, a sus cuadros)',
      onClick: () => { location.href = 'herramientas/calendario.html?programar=' + encodeURIComponent('vid:' + C.session.projectId) + '&t=' + Date.now(); } }, 'Publicar →');
  }

  /* El botón Descargar del editor principal: siempre da el video tal como se ve */
  function botonDescargar(s) {
    const e = estadoUI(s);
    if (e === 'esperando') {
      const c = carga(s), que = queCambia(c), marcar = !!(c && c.subtitulos && c.subtitulos.marcar_titulares);
      return h('button', { class: 'btn btn--download btn--wait', title: 'Solo se rehace ' + que + ': los cortes del video se quedan. Arranca solo en unos segundos.', onClick: () => forzar() },
        h('span', { class: 'spinner' }), dosLineas('Aplicar cambios', 'solo ' + que + ' · ' + (marcar ? '~2 min' : '~1 min')));
    }
    if (e === 'renderizando') {
      return h('span', { class: 'btn btn--download btn--wait', title: 'Se está preparando el video con tus cambios (sin volver a cortarlo)' },
        h('span', { class: 'spinner' }), dosLineas('Aplicando ' + Math.round(A.pct) + '%', 'solo ' + (A.que || 'tus cambios')));
    }
    if (e === 'cortes') {
      const por = razonCortes(s);
      return h('button', { class: 'btn btn--download', title: 'Hay que volver a armar el video completo: ' + por, onClick: () => C.actions.generate() },
        dosLineas('Regenerar video', por + ' · ~3 min'));
    }
    // (24-sep) ya no la copia de edición: la calidad original
    return s.downloadUrl ? botonOriginal(s)
      : h('span', { class: 'btn btn--download btn--wait' }, h('span', { class: 'spinner' }), 'Preparando HD…');
  }

  /* En el editor del resultado: una etiqueta junto a Exportar */
  function chipEditor(s) {
    const e = estadoUI(s);
    const txt = e === 'renderizando' ? 'Preparando en segundo plano ' + Math.round(A.pct) + '%'
      : e === 'listo' ? '✓ Listo para exportar'
      : e === 'esperando' ? 'Cambios sin exportar' : '';
    return h('span', { class: 'ad-chip' + (e === 'listo' ? ' ad-chip--listo' : ''), title: 'Cherry prepara el video mientras editas' }, txt);
  }

  function pintar() {
    const s = C.state;
    const e = estadoUI(s);
    const clave = e + '|' + (A.estado === 'renderizando' ? Math.round(A.pct) : '') + '|' + (s.downloadUrl || '') +
      '|' + MA.fuente + MA.estado + (MA.estado === 'preparando' || MA.estado === 'pidiendo' ? Math.floor((Date.now() - MA.t0) / 1000) : '') +
      '|' + (e === 'esperando' ? queCambia(carga(s)) : e === 'cortes' ? razonCortes(s) : '');
    if (clave === ultimoUI) return;
    ultimoUI = clave;
    document.querySelectorAll('.js-ad-descargar').forEach((z) => z.replaceChildren(botonDescargar(s)));
    document.querySelectorAll('.js-ad-publicar').forEach((z) => z.replaceChildren(botonPublicar(s)));
    document.querySelectorAll('.js-ad-editor').forEach((z) => z.replaceChildren(chipEditor(s)));
    if (A.alTerminar) document.querySelectorAll('.js-export-pct').forEach((el) => (el.textContent = 'Exportando ' + Math.round(A.pct) + '%…'));
  }

  /* «Aplicar cambios» sin esperar los segundos de quietud */
  function forzar() { cambioEn = 0; tick(); }

  setInterval(tick, REVISA);
  /* _tick, _base, _adelantado: para revisar desde la consola (una pestaña oculta frena los relojes) */
  C.adelantado = { nuevaBase, usarParaExportar, botonDescargar, botonPublicar, chipEditor, estadoUI, forzar, _tick: tick, _base: B, _adelantado: A, _original: MA };
})();

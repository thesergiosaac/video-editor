/* fabricar.js — FABRICAR SOLO AL FINAL (6-oct-2026). Reemplaza al render adelantado (adelantado.js).
 *
 * Sergio: «todos hacen el navegador y todos una vista previa falsa que solo se renderiza al final para consumir menos».
 * Antes Amazon fabricaba el video en segundo plano cada vez que algo cambiaba (~18 veces por video). Ahora:
 *
 *  · TODO se ve en vivo en el navegador: cortesvivo.js pone la base sin subtítulos y encima el color, el movimiento,
 *    las escenas, los gráficos, los sonidos y los subtítulos. Nada se fabrica mientras se edita.
 *  · El video se fabrica UNA vez, al tocar Descargar o Publicar: primero un aviso con el tiempo («unos 9 minutos por los
 *    6 gráficos») y que no hace falta quedarse; luego UN master (calidad original) desde la base, con exactamente lo que
 *    se ve (cortesVivo.subsParaFabricar + C.cargaRapida). orchestrate v257 guarda la firma de esa versión.
 *  · LA VERSIÓN: una firma de los cortes y de todo lo que va encima. Si el último master tiene la misma, Descargar lo baja
 *    ya y Publicar va directo al Calendario. Si después cambias algo, se fabrica otra solo cuando lo pidas.
 *  · Publicar no espera a que termine: va al Calendario con el master haciéndose; el Calendario no deja una hora antes de
 *    que esté (o «apenas esté listo») y la publicación lo espera en el servidor (ig-publicar v3). Si falla, no sale nada.
 *  · EL BORRADOR (projects.borrador, sql/17): lo que dejas puesto se guarda solo y vuelve al abrir el proyecto, aunque
 *    nunca lo hayas fabricado.
 *  · Al terminar, si sigues en Cherry, aparece un aviso aquí mismo. (El correo, cuando cherrysweet.app tenga su envío.)
 *  · (6-oct, fase 3) EL COBRO lo hace el servidor (orchestrate v258 › sql/18-usos.sql). Con el interruptor en 'cobrar'
 *    (al abrir la venta) aquí se aplica el tope de 3 minutos y, si faltan créditos, se dice cuántos y se abre «Tus
 *    créditos». Con 'contar' (hoy) nada de eso aparece. El administrador nunca tiene topes.
 *
 * Nunca se redibuja toda la página desde aquí (soltaría un deslizador a medio arrastrar): solo se cambia la zona .js-fab.
 */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const REVISA = 1500;            // cada cuánto se mira si cambió la versión o hay que guardar el borrador
  const SONDEO = 5000;            // cada cuánto se pregunta por el video que se está fabricando
  const GUARDAR = 2500;           // quieto este tiempo → se guarda el borrador

  /* El último master del proyecto: { id, estado: 'pidiendo'|'fabricando'|'listo'|'error', firma, url, t0, eta, error } */
  const F = { proyecto: null, master: null, para: null, sondeo: 0, aviso: null, firma: null, clave: '', modo: 'contar', admin: false };
  const TOPE_SEG = 180;
  const B = { proyecto: null, listo: false, ultimo: null, pendiente: null, timer: 0 };

  /* ══ Lo que se fabrica: lo mismo que se ve ══ */
  function vistaLista() { return !!(C.cortesVivo && C.cortesVivo.vistaLista && C.cortesVivo.vistaLista()); }
  function carga(s) {
    if (!vistaLista()) return null;
    const subs = C.cortesVivo.subsParaFabricar(s);
    const id = C.cortesVivo.idBase();
    return subs && id ? C.cargaRapida(s, subs, id) : null;
  }
  /* Lo que se pone en el borrador (sin frases: esas viven en la base) — la forma que lee C.restaurarDeRender */
  function cfgBorrador(s) {
    const impacto = C.subs.modoImpacto(s);
    const c = C.cargaRapida(s, { plantilla: impacto ? 'simple' : (s.subsPlantilla || 'editorial'), palabras: [], frases: [] }, null);
    const sub = Object.assign({}, c.subtitulos);
    delete sub.frases; delete sub.textos; delete sub.num_palabras; delete sub.marcar_titulares;
    return Object.assign(sub, { color: c.color, movimiento: c.movimiento, escenas: c.escenas, graficos: c.graficos, sonidos: c.sonidos, voz: c.voz });
  }
  function cortesBorrador(s) {
    return { pacing: s.pacing, clipGap: s.clipGap, clipStart: s.clipStart, aire: s.aire, editMode: s.editMode, duration: s.duration,
             sinCortes: !!s.sinCortes, captions: s.captions !== false,
             // (8-oct) las tomas hechas a mano y de qué base son los números de palabra (efectos, escenas, títulos)
             tomasMano: s.tomasMano || null, indicesDe: s.indicesDe || null,
             // (8-oct) en qué línea de la línea de tiempo puso cada cosa (editor Manual)
             lineas: s.lineas && Object.keys(s.lineas).length ? s.lineas : null };
  }
  function hash(t) {
    let a = 5381, b = 52711;
    for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a, 33) ^ c; b = Math.imul(b, 31) ^ c; }
    return 'v1-' + (a >>> 0).toString(36) + (b >>> 0).toString(36) + t.length.toString(36);
  }
  /* (8-oct) «Generar otro» gráfico cambia la fila de la base, no la carga: sin esto el video ya fabricado seguía «listo»
     con los gráficos de antes. Su huella entra en la firma, pero solo la de gráficos marcados desde hoy: los de antes ya
     tienen videos fabricados con su firma de siempre. */
  const HUELLA_DESDE = '2026-10-07T19:41';
  function huellaGraficos() {
    const D = C.cortesVivo && C.cortesVivo.datosVista ? C.cortesVivo.datosVista() : null;
    const g = D && D.graficos;
    return g && String(g.creado || '') > HUELLA_DESDE ? hash(JSON.stringify(g.momentos || [])) : undefined;
  }
  /* La firma de la versión que se ve: los cortes + todo lo que va en el video (no QUÉ fila se reusa) */
  function firmaDe(s, c) {
    if (c) { const x = Object.assign({}, c); delete x.reusarRender; return hash(JSON.stringify({ k: C.firmaCortes(s), c: x, g: huellaGraficos() })); }
    return 'sb-' + hash(JSON.stringify({ k: C.firmaCortes(s), c: cfgBorrador(s) }));   // sin vista fluida (no se pudo preparar la base)
  }

  /* ══ Cuánto tarda ══ Medido el 5-oct (40 fabricaciones): reutilizando partes 1–3 min; el master además corta de las
     grabaciones originales; cada gráfico premium es un render aparte en Remotion; la voz de estudio pasa por Auphonic. */
  function estimar(s) {
    const D = C.cortesVivo && C.cortesVivo.datosVista ? C.cortesVivo.datosVista() : null;
    let dur = D && Array.isArray(D.duraciones) ? D.duraciones.reduce((a, x) => a + (Number(x) || 0), 0) : 0;
    if (!dur && C.cortesVivo && C.cortesVivo.duracion) dur = C.cortesVivo.duracion() || 0;
    if (!dur) dur = 60;
    const m = C.cortesVivo && C.cortesVivo.momentos ? C.cortesVivo.momentos() : null;
    const g = m && Array.isArray(m.graficos) ? m.graficos.length : 0;
    const premium = !!(C.grafCfg && (C.grafCfg() || {}).estilo === 'premium');
    const voz = !!s.vozEstudio;
    const min = 3 + (dur / 60) * 1.2 + g * (premium ? 0.8 : 0.25) + (voz ? 1 : 0);
    return { min: Math.max(3, Math.ceil(min)), graficos: g, premium, voz, dur };
  }
  function porQue(e) {
    const partes = [];
    if (e.graficos) partes.push(e.graficos === 1 ? 'el gráfico' : 'los ' + e.graficos + ' gráficos');
    if (e.voz) partes.push('la voz de estudio');
    return partes.length ? 'Por ' + partes.join(' y ') + '.' : 'Lo corta de tus grabaciones originales, en su calidad.';
  }

  /* ══ Fabricar ══ */
  async function fabricar(para) {
    const s = C.state;
    const pid = C.session && C.session.projectId;
    if (!pid || !C.apiReady) return;
    const c = carga(s), e = estimar(s), firma = firmaDe(s, c);
    F.aviso = null; F.para = para; F.proyecto = pid;
    F.master = { id: null, estado: 'pidiendo', firma, url: null, t0: Date.now(), eta: e.min, error: null };
    C.setState({});
    try {
      let res;
      if (c) {
        res = await C.api.reExportWithEdits(null, null, Object.assign({
          captionStyle: s.captionStyle, captionPosition: s.captionPosition, combo: s.graphicsCombo,
          heroColor: s.graphicsHeroColor, supColor: s.graphicsSupColor, bg: s.graphicsBg,
        }, c, { calidad: 'original', firmaVersion: firma, etaMin: e.min }));
      } else {
        // sin vista fluida: el camino completo, en calidad original
        res = await C.api.generateVideo(C.ajustesGenerar(s), { calidad: 'original', firma_version: firma, eta_min: e.min });
      }
      if (C.session.projectId !== pid) return;
      if (res && (res.error === 'sin_creditos' || res.error === 'tope_3_min')) {
        Object.assign(F.master, { estado: 'error', error: res.error, faltan: res.faltan, cuesta: res.cuesta, tiene: res.tiene, segundos: res.segundos });
        F.clave = ''; pintar(); return;
      }
      if (!res || !res.render_id) throw new Error((res && res.error) || 'el servidor no respondió');
      F.master.id = res.render_id; F.master.estado = 'fabricando';
      console.log('[Fabricar] pedido', res.render_id, res.rapido ? '(desde la vista previa)' : '(completo)', '· unos', e.min, 'min');
      sondear();
      if (para === 'publicar') { irAlCalendario(); return; }
    } catch (err) {
      console.warn('[Fabricar] no arrancó', err);
      if (F.master) { F.master.estado = 'error'; F.master.error = String((err && err.message) || err).slice(0, 160); }
    }
    F.clave = ''; pintar();
  }

  function sondear() {
    clearInterval(F.sondeo);
    const M = F.master, id = M && M.id, pid = F.proyecto;
    if (!id) return;
    F.sondeo = setInterval(async () => {
      if (!F.master || F.master.id !== id || F.proyecto !== pid || C.session.projectId !== pid) { clearInterval(F.sondeo); return; }
      try {
        const st = await C.api.getPipelineStatus(id);
        if (!F.master || F.master.id !== id) return;
        const url = st.output_original_url || st.output_url;
        if (st.status === 'done' && url) {
          clearInterval(F.sondeo);
          Object.assign(F.master, { estado: 'listo', url, error: null });
          console.log('[Fabricar] listo en', Math.round((Date.now() - F.master.t0) / 1000), 's');
          avisarListo();
        } else if (st.status === 'error' || st.status === 'failed') {
          clearInterval(F.sondeo);
          Object.assign(F.master, { estado: 'error', error: st.error_message || 'no salió' });
        }
      } catch (_) { /* un sondeo perdido no importa */ }
      F.clave = ''; pintar();
    }, SONDEO);
  }

  /* Al abrir un proyecto: el último master que tenga (hecho, haciéndose o recién fallido) */
  async function alAbrir() {
    const pid = C.session && C.session.projectId;
    clearInterval(F.sondeo);
    F.proyecto = pid; F.master = null; F.aviso = null; F.clave = '';
    if (!pid || !C.api.getUltimoMaster) return;
    if (C.api.cobroYAdmin) C.api.cobroYAdmin().then((r) => { if (r) { F.modo = r.modo; F.admin = r.admin; F.clave = ''; pintar(); } }).catch(() => null);
    let m = null;
    try { m = await C.api.getUltimoMaster(); } catch (_) {}
    if (C.session.projectId !== pid || !m) { pintar(); return; }
    const cfg = m.subtitle_config || {}, url = m.output_original_url || m.output_url;
    const t0 = Date.parse(m.created_at) || Date.now();
    const M = { id: m.id, firma: cfg.firma_version || null, url: m.status === 'done' ? url : null, t0, eta: Number(cfg.eta_min) || null, error: m.error_message || null,
                estado: m.status === 'done' && url ? 'listo' : (m.status === 'error' || m.status === 'failed') ? 'error' : 'fabricando' };
    if (M.estado === 'fabricando' && Date.now() - t0 > 90 * 60000) { M.estado = 'error'; M.error = 'no terminó'; }
    // un fallo viejo no se recuerda: se fabrica de nuevo al pedirlo
    if (M.estado === 'error' && Date.now() - t0 > 6 * 3600000) { pintar(); return; }
    F.master = M;
    if (M.estado === 'fabricando') sondear();
    pintar();
  }

  /* ══ El borrador ══ */
  function textoBorrador(s) { return JSON.stringify({ v: 1, cfg: cfgBorrador(s), cortes: cortesBorrador(s) }); }

  /* ══ (7-oct) Que nada se pierda al cerrar ══ Sergio: «¿qué pasa si una persona está editando y cierra el computador?»
     Medido en el banco: lo hecho en los ~2,5 s antes de cerrar se perdía, y sin internet no quedaba copia. Ahora:
     1. al ocultarse la pestaña, cerrarse o dormirse el computador se guarda YA (fetch keepalive: sale aunque la página muera);
     2. cada cambio queda al instante en este computador (localStorage); cuando el servidor lo confirma, la copia se borra.
        Al abrir el proyecto, una copia de aquí más nueva que la del servidor se aplica y se sube (se cerró sin internet);
     3. «Guardado ✓» discreto arriba, junto al proyecto (topbar.js). Lo escrito en Editar resultado va igual (state.js). */
  const LOCAL = 'cherry-borrador:', LOCAL_ED = 'cherry-edicion:';
  const G = { estado: null };                // null · 'guardando' · 'guardado' · 'local'
  function leerLocal(pid) { try { const x = JSON.parse(localStorage.getItem(LOCAL + pid) || 'null'); return x && x.t ? x : null; } catch (_) { return null; } }
  function guardarLocal(pid, t) { try { localStorage.setItem(LOCAL + pid, JSON.stringify({ t, en: new Date().toISOString() })); } catch (_) { /* sin espacio: queda el servidor */ } }
  function soltarLocal(pid, t) { const x = leerLocal(pid); if (x && (t == null || x.t === t)) { try { localStorage.removeItem(LOCAL + pid); } catch (_) {} } }
  function textoGuardado() {
    return G.estado === 'guardando' ? 'Guardando…' : G.estado === 'guardado' ? 'Guardado ✓'
      : G.estado === 'local' ? 'Sin conexión · guardado en este computador' : '';
  }
  function marcarGuardado(e) {
    G.estado = e;
    document.querySelectorAll('.js-tb-guardado').forEach((el) => {
      el.textContent = textoGuardado(); el.classList.toggle('tb-guardado--local', e === 'local');
    });
  }
  /* Lo escrito en Editar resultado que no alcanzó a subir (se cerró sin internet): se sube al abrir el proyecto y, si es
     el de la vista previa, se pone en ella. Una copia más vieja que lo que ya tiene el servidor se descarta. */
  async function recuperarEdiciones(pid) {
    let llaves = [];
    try { llaves = Object.keys(localStorage).filter((k) => k.indexOf(LOCAL_ED) === 0); } catch (_) { return; }
    for (const k of llaves) {
      let x = null;
      try { x = JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) {}
      if (!x || x.pid !== pid || !x.renderId || !x.edicion) continue;
      try {
        const f = await C.api.getRenderData(x.renderId);
        const enServ = f && f.subtitle_edits ? Date.parse(f.subtitle_edits.guardado_en || '') || 0 : 0;
        if (f && (Date.parse(x.en) || 0) > enServ) {
          await C.api.guardarEdicion(x.renderId, x.edicion);
          if (C.cortesVivo && C.cortesVivo.idBase && C.cortesVivo.idBase() === x.renderId && C.cortesVivo.refrescarEdicion) C.cortesVivo.refrescarEdicion(x.edicion);
          console.log('[Guardado] se subió lo escrito en Editar resultado que había quedado en este computador');
        }
        localStorage.removeItem(k);
      } catch (e) { console.warn('[Guardado] la edición de este computador no se pudo subir todavía', e); }
    }
  }

  /* lo llama cargarProyecto con lo que leyó; devuelve true si lo aplicó */
  function aplicarBorrador(fila, prev) {
    // (7-oct) una copia de este computador más nueva que la del servidor (se cerró antes de subirla): esa manda y se sube
    const pid = C.session && C.session.projectId, loc = pid ? leerLocal(pid) : null;
    B.recuperado = null; G.estado = null;
    if (loc) {
      const enServ = fila ? Date.parse(fila.borrador_en || '') || 0 : 0;
      if ((Date.parse(loc.en) || 0) > enServ) {
        try { fila = Object.assign({}, fila || {}, { borrador: JSON.parse(loc.t), borrador_en: loc.en }); B.recuperado = loc.t; } catch (_) { soltarLocal(pid); }
      } else soltarLocal(pid);
    }
    const b = fila && fila.borrador;
    if (!b || typeof b !== 'object' || !b.cfg) return false;
    const enBorrador = Date.parse(fila.borrador_en || '') || 0, enVideo = prev ? (Date.parse(prev.created_at || '') || 0) : 0;
    if (prev && enVideo > enBorrador) { if (B.recuperado) { soltarLocal(pid); B.recuperado = null; } return false; }   // el último video es más nuevo
    C.restaurarDeRender(b.cfg);
    const k = b.cortes || {}, s = C.state;
    ['pacing', 'clipGap', 'clipStart', 'aire', 'editMode', 'duration'].forEach((x) => { if (k[x] !== undefined && k[x] !== null) s[x] = k[x]; });
    if (k.sinCortes !== undefined) s.sinCortes = !!k.sinCortes;
    if (k.captions !== undefined) s.captions = k.captions !== false;
    s.tomasMano = k.tomasMano && typeof k.tomasMano === 'object' && Array.isArray(k.tomasMano.cortes) ? k.tomasMano : null;
    s.indicesDe = typeof k.indicesDe === 'string' ? k.indicesDe : null;
    s.lineas = k.lineas && typeof k.lineas === 'object' ? k.lineas : {};
    return true;
  }
  /* desde aquí se guarda: ya se cargó este proyecto (antes, el estado es el de por defecto y lo borraría) */
  function borradorListo() {
    B.proyecto = C.session && C.session.projectId;
    // (7-oct) lo recuperado de este computador todavía no está en el servidor: el próximo vistazo lo sube
    B.ultimo = B.recuperado ? null : textoBorrador(C.state);
    if (B.recuperado) { console.log('[Guardado] se recuperó lo que había quedado en este computador'); marcarGuardado('guardando'); }
    else marcarGuardado('guardado');            // lo que se abrió ya está guardado
    B.recuperado = null;
    B.listo = true;
    if (B.proyecto) recuperarEdiciones(B.proyecto);
  }
  function revisarBorrador(s) {
    if (!B.listo || B.proyecto !== (C.session && C.session.projectId)) return;
    const t = textoBorrador(s);
    if (t === B.ultimo || t === B.pendiente) return;
    B.pendiente = t;
    guardarLocal(B.proyecto, t);                 // (7-oct) al instante en este computador
    marcarGuardado('guardando');
    clearTimeout(B.timer);
    const pid = B.proyecto;
    B.timer = setTimeout(() => subirBorrador(pid, t, false), GUARDAR);
  }
  async function subirBorrador(pid, t, alCerrar) {
    if (B.proyecto !== pid || B.pendiente !== t) return;
    clearTimeout(B.timer);
    try {
      await C.api.guardarBorrador(pid, JSON.parse(t), alCerrar);
      if (B.proyecto === pid) B.ultimo = t;
      soltarLocal(pid, t);
      if (B.pendiente === t) { B.pendiente = null; marcarGuardado('guardado'); }
    } catch (e) {
      console.warn('[Borrador] no se guardó', e);
      // la copia sigue en este computador. B.pendiente se queda: no se reintenta en cada vistazo, sino a los 15 s o
      // apenas vuelve la conexión (un cambio nuevo sí se guarda aquí e intenta subir enseguida)
      if (B.pendiente === t) marcarGuardado('local');
      clearTimeout(B.reintento);
      B.reintento = setTimeout(() => { if (B.proyecto === pid && B.pendiente === t) { B.pendiente = null; revisarBorrador(C.state); } }, 15000);
    }
  }
  /* al ocultarse la pestaña, cerrarse o dormirse el computador: lo que falte se manda YA, sin esperar los 2,5 s */
  function guardarAlSalir() {
    const s = C.state;
    if (s.pantalla !== 'editor') return;
    if (B.listo && B.proyecto && B.proyecto === (C.session && C.session.projectId)) {
      const t = textoBorrador(s);
      if (t !== B.ultimo) {
        if (B.pendiente !== t) { B.pendiente = t; guardarLocal(B.proyecto, t); }
        subirBorrador(B.proyecto, t, true);
      }
    }
    if (s.editorSubs && (s.editorGuardado === 'pendiente' || s.editorGuardado === 'error') && C.actions && C.actions.guardarEdicionAhora) {
      C.actions.guardarEdicionAhora(true);
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarAlSalir(); });
  window.addEventListener('pagehide', guardarAlSalir);
  window.addEventListener('online', () => { if (G.estado === 'local') { B.pendiente = null; revisarBorrador(C.state); } });

  /* ══ Ir al Calendario ══ con el video listo, o haciéndose (el Calendario sabe desde cuándo se puede programar) */
  /* (8-oct) el Calendario, cerrado por ahora para quien no es administrador: la puerta la tiene cuenta.js */
  const puertaCalendario = (seguir) => (window.CherryCuenta && window.CherryCuenta.puertaCalendario ? window.CherryCuenta.puertaCalendario(seguir) : seguir());
  function irAlCalendario() {
    const M = F.master;
    let q = 'programar=' + encodeURIComponent('vid:' + C.session.projectId) + '&t=' + Date.now();
    if (M && M.id && (M.estado === 'fabricando' || M.estado === 'pidiendo')) q += '&fab=' + M.id + '&listo=' + (M.t0 + (M.eta || 10) * 60000);
    puertaCalendario(() => { location.href = 'herramientas/calendario.html?' + q; });
  }

  /* ══ Aviso al terminar ══ si sigue en el editor: un aviso abajo y la pestaña lo dice */
  let tituloAntes = null;
  function avisarListo() {
    const M = F.master;
    if (!M || !M.url) return;
    if (tituloAntes == null) tituloAntes = document.title;
    document.title = '✓ Tu video está listo · Cherry';
    const quitarTitulo = () => { if (tituloAntes != null) { document.title = tituloAntes; tituloAntes = null; } };
    window.addEventListener('focus', () => setTimeout(quitarTitulo, 4000), { once: true });
    document.querySelectorAll('.fab-toast').forEach((x) => x.remove());
    const t = h('div', { class: 'fab-toast', role: 'status' },
      h('span', { class: 'fab-toast__ok' }, '✓'),
      h('span', { class: 'fab-toast__txt' }, h('b', null, 'Tu video está listo.'), ' Sale tal como lo viste, en la calidad en que lo grabaste.'),
      h('a', { class: 'fab-toast__btn', href: C.urlVideo(M.url), download: 'video-cherry.mp4', target: '_blank', rel: 'noopener' }, 'Descargar'),
      h('button', { class: 'fab-toast__x', type: 'button', title: 'Cerrar', onClick: () => t.remove() }, '✕'));
    document.body.appendChild(t);
    setTimeout(() => { if (t.isConnected) t.remove(); }, 20000);
  }

  /* ══ La franja de abajo (en vez de «generar video») ══ */
  const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const dosLineas = (arriba, abajo) => h('span', { class: 'btn__txt' }, arriba, h('span', { class: 'btn__sub' }, abajo));
  function hace(t0) {
    const m = Math.round((Date.now() - t0) / 60000);
    if (m < 1) return 'hace un momento';
    if (m < 60) return 'hace ' + m + ' min';
    const hh = Math.round(m / 60);
    return hh < 24 ? 'hace ' + hh + (hh === 1 ? ' hora' : ' horas') : 'hace ' + Math.round(hh / 24) + ' días';
  }

  function estadoUI(s) {
    if (F.sinOriginales) return { e: 'sinOriginales' };
    const n = (s.clips || []).length;
    if (!n) return { e: 'vacio' };
    const lista = vistaLista(), rendida = !!(C.cortesVivo && C.cortesVivo.rendida && C.cortesVivo.rendida());
    if (!lista && !rendida) return { e: 'preparando' };
    const M = F.master, firma = F.firma;
    // el tope de 3 minutos (solo con el cobro prendido; el administrador no tiene topes)
    if (F.modo === 'cobrar' && !F.admin && !(M && (M.estado === 'pidiendo' || M.estado === 'fabricando'))) {
      const dur = estimar(s).dur;
      if (dur > TOPE_SEG + 5) return { e: 'largo', dur };
    }
    const igual = !!(M && M.firma && firma && M.firma === firma);
    if (M && (M.estado === 'pidiendo' || M.estado === 'fabricando')) return { e: 'fabricando', igual };
    if (M && M.estado === 'listo' && igual) return { e: 'listo' };
    if (M && M.estado === 'error' && igual) return { e: 'error' };
    return { e: 'editar', anterior: M && M.estado === 'listo' ? M : null, rendida };
  }

  function botonEditar() {
    return h('button', { class: 'btn btn--result', onClick: () => C.actions.openEditor(), title: 'Corregir palabras, partir frases y escoger la palabra clave' }, '✎ Editar resultado');
  }
  function botonPublicar(u) {
    const M = F.master;
    if (u.e === 'listo' || u.e === 'fabricando') {
      return h('button', { class: 'btn btn--publish', disabled: !!(M && M.estado === 'pidiendo'), onClick: () => irAlCalendario(),
        title: u.e === 'listo' ? 'Programarlo o publicarlo en el Calendario' : 'Ya puedes programarlo: el Calendario no te deja una hora antes de que esté listo' }, 'Publicar →');
    }
    const off = u.e === 'preparando';
    return h('button', { class: 'btn btn--publish', disabled: off || (M && M.estado === 'pidiendo'),
      title: off ? 'Espera a que esté la vista previa' : 'Se fabrica y lo programas en el Calendario', onClick: () => puertaCalendario(() => pedir('publicar')) }, 'Publicar →');
  }
  function botonDescargar(u) {
    const M = F.master;
    if (u.e === 'listo') {
      return h('a', { class: 'btn btn--download', href: C.urlVideo(M.url), download: 'video-cherry.mp4', target: '_blank', rel: 'noopener',
        title: 'En la calidad en que lo grabaste, a sus cuadros' }, dosLineas('Descargar', 'calidad original'));
    }
    if (u.e === 'fabricando') {
      return h('span', { class: 'btn btn--download btn--wait', title: 'Se baja apenas termine de fabricarse' },
        h('span', { class: 'spinner' }), dosLineas('Descargar', 'en cuanto esté'));
    }
    if (u.e === 'preparando') return h('span', { class: 'btn btn--download btn--wait', title: 'Espera a que esté la vista previa' }, 'Descargar');
    return h('button', { class: 'btn btn--download', onClick: () => pedir('descargar'), title: 'Se fabrica una vez, tal como lo ves, en la calidad en que lo grabaste' },
      dosLineas('Descargar', 'se fabrica al final'));
  }

  function contenido(s) {
    const u = estadoUI(s), M = F.master;
    if (u.e === 'vacio') {
      return [h('button', { class: 'btn-generate btn-generate--off', title: 'Sube al menos un clip primero' }, 'sube tus clips'),
        h('div', { class: 'gen__meta' }, h('span', null, 'Sube al menos un clip primero'))];
    }
    const fila = h('div', { class: 'fab-fila' }, botonDescargar(u), botonPublicar(u));
    if (u.e === 'preparando') {
      return [
        h('div', { class: 'fab-titulo' }, h('span', { class: 'spinner' }), h('span', { class: 'gen__title' }, 'Preparando la vista previa…')),
        fila,
        h('div', { class: 'fab-nota' }, 'Aquí ves tu video editado mientras lo ajustas. Se fabrica una sola vez, cuando lo descargues o lo publiques.'),
      ];
    }
    if (u.e === 'fabricando') {
      const pasado = Date.now() - M.t0, total = (M.eta || 6) * 60000;
      const pct = M.estado === 'pidiendo' ? 2 : Math.min(95, Math.round((pasado / total) * 100));
      const tarde = pasado > total * 1.6;
      return [
        h('div', { class: 'fab-titulo' }, h('span', { class: 'spinner' }), h('span', { class: 'gen__title' }, M.estado === 'pidiendo' ? 'Arrancando…' : 'Fabricando tu video…')),
        h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })),
        h('div', { class: 'gen__meta' }, h('span', null, mmss(pasado) + (M.eta ? ' de unos ' + M.eta + ' min' : '')), h('span', null, pct + '%')),
        h('div', { class: 'fab-nota' }, tarde ? 'Está tardando más de lo normal; sigue en marcha.' : 'Puedes seguir editando o cerrar Cherry: se fabrica solo.'),
        !u.igual && M.estado === 'fabricando' ? h('div', { class: 'fab-nota fab-nota--ojo' }, 'Se está fabricando la versión de antes de tus últimos cambios. ',
          h('button', { class: 'fab-link', type: 'button', onClick: () => pedir('descargar') }, 'Fabricar esta')) : null,
        botonEditar(), fila,
      ];
    }
    if (u.e === 'listo') {
      return [
        h('div', { class: 'hand fab-listo' }, '¡tu video está listo!'),
        botonEditar(), fila,
        h('div', { class: 'fab-nota' }, 'Calidad original · fabricado ' + hace(M.t0) + '. Si cambias algo, lo vuelves a fabricar al descargarlo.'),
      ];
    }
    if (u.e === 'sinOriginales') {
      const fecha = new Date(F.sinOriginales).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
      return [
        h('div', { class: 'fab-titulo' }, h('span', { class: 'gen__title' }, 'Queda el video terminado')),
        h('div', { class: 'fab-nota' }, 'Cherry guarda tus grabaciones 15 días después de fabricar el video; las de este se borraron el ' + fecha +
          '. Lo puedes descargar y publicar, pero ya no se puede volver a editar.'),
        h('div', { class: 'fab-fila' },
          M && M.estado === 'listo' && M.url
            ? h('a', { class: 'btn btn--download', href: C.urlVideo(M.url), download: 'video-cherry.mp4', target: '_blank', rel: 'noopener' }, dosLineas('Descargar', 'calidad original'))
            : (s.downloadUrl ? h('a', { class: 'btn btn--download', href: C.urlVideo(s.downloadUrl), download: 'video-cherry.mp4', target: '_blank', rel: 'noopener' }, 'Descargar') : null),
          h('button', { class: 'btn btn--publish', onClick: () => irAlCalendario() }, 'Publicar →')),
      ];
    }
    if (u.e === 'largo') {
      return [
        h('div', { class: 'fab-titulo fab-titulo--mal' }, 'Tu video dura ' + mmss(u.dur * 1000)),
        h('div', { class: 'fab-nota' }, 'Cada video puede durar hasta 3 minutos. Quita algún clip o recorta los silencios en Edición y lo fabricas.'),
        botonEditar(),
        h('div', { class: 'fab-fila' }, h('span', { class: 'btn btn--download btn--wait' }, 'Descargar'), h('button', { class: 'btn btn--publish', disabled: true }, 'Publicar →')),
      ];
    }
    if (u.e === 'error' && M.error === 'sin_creditos') {
      return [
        h('div', { class: 'fab-titulo fab-titulo--mal' }, 'Te faltan ' + (M.faltan || '') + ' créditos'),
        h('div', { class: 'fab-nota' }, 'Este video cuesta ' + M.cuesta + ' créditos y tienes ' + (M.tiene || 0) + '. Con un paquete lo fabricas enseguida; no se gastó nada.'),
        botonEditar(),
        h('div', { class: 'fab-fila' },
          h('button', { class: 'btn btn--publish', onClick: () => { if (window.CherryPagos) (window.CherryPagos.abrirCreditos || window.CherryPagos.abrir)(); } }, 'Comprar créditos'),
          h('button', { class: 'btn btn--download', onClick: () => fabricar(F.para || 'descargar') }, 'Ya compré · fabricar')),
      ];
    }
    if (u.e === 'error') {
      return [
        h('div', { class: 'fab-titulo fab-titulo--mal' }, 'No salió el video'),
        h('div', { class: 'fab-nota' }, 'Cherry no lo pudo fabricar' + (M.error ? ' (' + String(M.error).slice(0, 90) + ')' : '') + '. No se publicó nada.'),
        botonEditar(),
        h('div', { class: 'fab-fila' }, h('button', { class: 'btn btn--download', onClick: () => fabricar('descargar') }, 'Reintentar'), botonPublicar({ e: 'editar' })),
      ];
    }
    // editar: lo que se ve todavía no está fabricado
    const e = estimar(s);
    return [
      h('div', { class: 'hand fab-asi' }, 'así va tu video'),
      botonEditar(),
      /* (7-oct) «arrancar a fabricar al tocar Listo»: apenas terminas, sin decidir antes si lo descargas o lo publicas */
      h('button', { class: 'btn-generate fab-listo-btn', disabled: !!(M && M.estado === 'pidiendo'), onClick: () => pedir('listo'),
        title: 'Cherry lo fabrica ya; cuando esté, lo descargas o lo programas' }, '✓ Listo, fabrícalo'),
      fila,
      h('div', { class: 'gen__meta' }, h('span', null, 'Se fabrica al final · unos ' + e.min + ' min'), u.rendida ? h('span', null, 'sin vista fluida') : null),
      u.anterior ? h('div', { class: 'fab-nota' }, 'Cambiaste cosas después de fabricarlo. ',
        h('a', { class: 'fab-link', href: C.urlVideo(u.anterior.url), download: 'video-cherry.mp4', target: '_blank', rel: 'noopener' }, 'Bajar el de antes')) : null,
    ];
  }
  function calcularFirma(s) {
    const c = carga(s);
    F.firma = (c || (C.cortesVivo && C.cortesVivo.rendida && C.cortesVivo.rendida())) ? firmaDe(s, c) : null;
  }
  function franja(s) {
    if (!F.firma) calcularFirma(s);
    F.clave = '';
    return h('div', { class: 'fab js-fab' }, contenido(s));
  }

  function pintar() {
    const s = C.state;
    const zonas = document.querySelectorAll('.js-fab');
    if (!zonas.length) return;
    const u = estadoUI(s), M = F.master;
    const clave = JSON.stringify([u, M && M.estado, M && M.id, M && M.url, F.firma,
      M && (M.estado === 'fabricando' || M.estado === 'pidiendo') ? Math.floor((Date.now() - M.t0) / 1000) : 0,
      u.e === 'editar' ? estimar(s).min : 0]);
    if (clave === F.clave) return;
    F.clave = clave;
    zonas.forEach((z) => z.replaceChildren(...[].concat(contenido(s)).filter(Boolean)));
  }

  /* ══ El aviso antes de fabricar ══ (nunca un diálogo del navegador) */
  function pedir(para) {
    if (F.master && F.master.estado === 'pidiendo') return;
    F.aviso = { para, e: estimar(C.state) };
    C.setState({});
  }
  function aviso() {
    const A = F.aviso;
    if (!A) return null;
    const cerrar = () => { F.aviso = null; C.setState({}); };
    const pub = A.para === 'publicar';
    return h('div', { class: 'modal-wrap fab-aviso' },
      h('div', { class: 'scrim', onClick: cerrar }),
      h('div', { class: 'modal', style: { width: 'min(460px,100%)' }, role: 'dialog', 'aria-label': 'Fabricar tu video' },
        h('div', { class: 'modal__head' },
          h('div', null,
            h('div', { class: 'modal__title' }, pub ? 'fabricar y publicar' : 'fabricar tu video'),
            h('div', { class: 'modal__sub' }, 'Sale tal como lo ves en la vista previa.')),
          h('button', { class: 'btn-x', onClick: cerrar }, '✕')),
        h('div', { class: 'modal__body fab-aviso__body' },
          h('div', { class: 'fab-aviso__tiempo' }, 'Unos ', h('b', null, A.e.min + ' minutos')),
          h('div', { class: 'fab-aviso__porque' }, porQue(A.e)),
          h('p', null, 'No tienes que quedarte aquí. Puedes seguir editando, ir a otra herramienta o cerrar Cherry: el video se fabrica solo y te espera en este proyecto.'),
          pub ? h('p', null, 'En el Calendario escoges cuándo sale. Cherry no te deja una hora antes de que esté listo, o lo publica apenas termine.')
            : A.para === 'listo' ? h('p', null, 'Cuando esté, lo descargas en la calidad en que lo grabaste o lo programas en el Calendario.')
            : h('p', null, 'Cuando esté, Descargar te lo baja en la calidad en que lo grabaste.'),
          h('p', { class: 'fab-aviso__chico' }, 'Si después cambias algo, lo vuelves a fabricar.')),
        h('div', { class: 'modal__foot fab-aviso__pie' },
          h('button', { class: 'btn btn--ghost', type: 'button', onClick: cerrar }, 'Ahora no'),
          h('button', { class: 'btn btn--publish', type: 'button', onClick: () => fabricar(A.para) }, pub ? 'Fabricar y programar' : 'Fabricar'))));
  }

  /* ══ El vigilante ══ */
  function tick() {
    const s = C.state;
    if (s.pantalla !== 'editor' || s.resultEdit) return;
    calcularFirma(s);
    revisarBorrador(s);
    pintar();
  }
  setInterval(tick, REVISA);

  const css = document.createElement('style');
  css.textContent = [
    '.fab{display:flex;flex-direction:column;gap:9px}',
    '.fab-fila{display:flex;gap:8px;flex-wrap:wrap}',
    '.fab-titulo{display:flex;align-items:center;gap:9px}',
    '.fab-titulo--mal{font-family:var(--f-display);font-weight:800;font-size:14px;color:#ff6b6b}',
    '.fab-listo{font-size:24px;color:var(--teal,#2BD9C7);line-height:1}',
    '.fab-asi{font-size:22px;color:var(--amber,#FFC93C);line-height:1}',
    '.fab .fab-listo-btn{padding:15px;font-size:15px}',
    '.fab .btn--result{margin-bottom:0}',
    '.fab-nota{font-size:11.5px;line-height:1.45;color:var(--ink-60,rgba(247,233,224,.6))}',
    '.fab-nota--ojo{color:var(--amber,#FFC93C)}',
    '.fab-link{background:none;border:none;padding:0;color:var(--amber,#FFC93C);text-decoration:underline;cursor:pointer;font:inherit}',
    '.fab-aviso__body{display:flex;flex-direction:column;gap:10px;padding-bottom:6px}',
    '.fab-aviso__body p{margin:0;font-size:13.5px;line-height:1.5;color:var(--ink-80,rgba(247,233,224,.82))}',
    '.fab-aviso__tiempo{font-family:var(--f-display);font-size:30px;line-height:1.05;color:var(--ink,#F7E9E0)}',
    '.fab-aviso__tiempo b{color:var(--amber,#FFC93C)}',
    '.fab-aviso__porque{font-size:13px;color:var(--ink-60,rgba(247,233,224,.6));margin-top:-4px}',
    '.fab-aviso__chico{font-size:12px!important;color:var(--ink-45,rgba(247,233,224,.45))!important}',
    '.fab-aviso__pie{display:flex;gap:10px;justify-content:flex-end}',
    '.fab-aviso__pie .btn{width:auto;flex:none;padding:12px 20px}',
    '.fab-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;',
    'max-width:min(560px,calc(100vw - 32px));padding:12px 14px 12px 16px;border-radius:16px;background:#1b1418;color:#F7E9E0;',
    'border:1px solid rgba(43,217,199,.45);box-shadow:0 18px 40px -12px rgba(0,0,0,.8);font-size:13px;line-height:1.4}',
    '.fab-toast__ok{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#2BD9C7;color:#0b0709;font-weight:900}',
    '.fab-toast__txt{flex:1;min-width:0}',
    '.fab-toast__btn{flex:none;padding:8px 14px;border-radius:12px;background:#F7E9E0;color:#140C11;font-weight:800;text-decoration:none}',
    '.fab-toast__x{flex:none;background:none;border:none;color:rgba(247,233,224,.55);font-size:14px;cursor:pointer;padding:4px}',
  ].join('\n');
  document.head.appendChild(css);

  C.fabricar = { franja, aviso, alAbrir, aplicarBorrador, borradorListo, pedir, fabricar, irAlCalendario, estimar,
                 textoGuardado, estadoGuardado: () => G.estado, LOCAL_ED,
                 ultimoMaster: () => F.master, _F: F, _B: B, _tick: tick };
})();

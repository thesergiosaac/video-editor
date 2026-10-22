/* arranque.js — CON QUÉ ARRANCA UN VIDEO (18-oct-2026).
 *
 * Sergio: «suelo subir vídeos que ya están editados simplemente para poder programarlos, pero al subirlos se empiezan a
 * añadir cosas: movimientos de cámara, subtítulos. Debería haber una opción para mantener lo que he añadido para que en
 * otros vídeos se añada automáticamente, o no añadir nada». Propuesta aprobada (artefacto «Subir un video tal cual»):
 *
 *  · Al subir el PRIMER clip de un proyecto, una pregunta: «Edítalo con Cherry» (cortes, subtítulos, movimiento y música,
 *    como siempre) · «Ya está listo: déjalo tal cual» (nada) · «Con mis ajustes» (los guardados de la marca). Con
 *    «Recordar», los próximos proyectos de ESA marca arrancan así y ya no se pregunta (preferencias_usuario.arranque).
 *  · «Tal cual» con un solo clip: no se arma la base de la vista previa (ni F1 ni IA), el celular pone el clip tal cual y
 *    Publicar manda TU ARCHIVO ORIGINAL al Calendario sin fabricarlo (ig-publicar lo firma al publicar: opciones.original).
 *    Si en un video «tal cual» se enciende algo, deja de serlo: se fabrica con lo que se puso, como siempre.
 *  · Arriba de la configuración, una franja dice con qué arrancó y deja cambiarlo o guardar lo de ahora como «mis ajustes».
 *
 * El modo del proyecto vive en el borrador (fabricar.js › cortesBorrador: `arranque`, y `original` cuando se publica el
 * archivo tal cual: lo lee el Calendario en herramientas/cherry.js › videosListos). Proyectos de antes: null = como siempre.
 */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  /* Lo que trae un proyecto nuevo, tomado ANTES de abrir ninguno: «Edítalo con Cherry» vuelve a esto */
  const CLAVES = ['sinCortes', 'captions', 'movEfectos', 'music', 'vozEstudio', 'grafOn', 'escenasOn'];
  const DEF = JSON.parse(JSON.stringify(CLAVES.reduce((o, k) => { o[k] = C.state[k]; return o; }, {})));
  const SIN_EFECTOS = { lento: false, aleja: false, golpe: false, impacto: false, mano: false, sacude: false };

  // las preferencias de la cuenta: { [marca]: { recordar: 'cherry'|'tal_cual'|'mis'|null, mis: {cfg, cortes}|null } }
  const P = { datos: null, leyendo: null, permiso: {} };
  const MODOS = { cherry: 'Editado con Cherry', tal_cual: 'Tal cual', mis: 'Con tus ajustes' };

  function marca() {
    return (window.CherryCuenta && window.CherryCuenta.marcaNormal && window.CherryCuenta.marcaNormal()) || 'principal';
  }
  function leerPrefs() {
    if (P.datos) return Promise.resolve(P.datos);
    if (P.leyendo) return P.leyendo;
    P.leyendo = (C.api && C.api.leerArranque ? C.api.leerArranque() : Promise.resolve(null))
      .then((d) => { P.datos = d && typeof d === 'object' ? d : {}; return P.datos; })
      .catch(() => { P.datos = {}; return P.datos; })
      .then((d) => { P.leyendo = null; return d; });
    return P.leyendo;
  }
  function prefMarca() { return (P.datos && P.datos[marca()]) || {}; }
  function guardarPref(cambio) {
    const m = marca();
    P.datos = P.datos || {};
    P.datos[m] = Object.assign({}, P.datos[m] || {}, cambio);
    return C.api && C.api.guardarArranque ? C.api.guardarArranque(P.datos).catch((e) => { console.warn('[Arranque] no se guardó la preferencia', e); }) : null;
  }

  /* ══ ¿El video va tal cual? ══ Nada encima y nada cortado: lo que sale es el archivo */
  function nadaEncima(s) {
    const ef = s.movEfectos || {};
    const color = C.colorCfg ? C.colorCfg() : null;
    const colorLimpio = !color || (Object.keys(color).length === 1 && color.revelado === false);
    return !!s.sinCortes && s.captions === false && !Object.keys(ef).some((k) => ef[k]) && (s.music === 'none' || !s.music) &&
      !s.vozEstudio && !s.grafOn && !s.escenasOn && colorLimpio && !(s.sonidos || []).length && !(s.pantallas || []).length &&
      !s.tomasMano;
  }
  function esTalCual(s) { return s.arranque === 'tal_cual' && nadaEncima(s); }
  /* Se publica el archivo original (sin fabricar): tal cual y un solo clip. Con varios hay que pegarlos: se fabrica.
     Tampoco si el servidor dijo que no puede leerlo o que pasa del tope de Instagram: entonces se fabrica sin ponerle nada. */
  function publicaOriginal(s) {
    const clips = s.clips || [];
    if (!(esTalCual(s) && clips.length === 1 && clips[0] && clips[0].storage_path && clips[0].mp4_path)) return false;
    const k = clips[0].storage_path, r = P.permiso[k];
    if (r === undefined) verificar(k);
    return !(r && r.ok === false);
  }
  /* Una vez por archivo: ¿el servidor lo puede mandar tal cual? (ig-publicar › modo 'original') */
  function verificar(k) {
    if (P.permiso[k] !== undefined || !C.api || !C.api.edgeFetch) return;
    P.permiso[k] = null;   // preguntando: mientras tanto se asume que sí
    C.api.edgeFetch('ig-publicar', { modo: 'original', key: k }, false, 20000).then((r) => {
      P.permiso[k] = r && typeof r === 'object' ? { ok: r.ok !== false, motivo: r.motivo || '' } : { ok: true };
      if (P.permiso[k].ok === false) {
        console.warn('[Arranque] el original no se puede mandar tal cual:', P.permiso[k].motivo);
        C.setState({});
      }
    }).catch(() => { setTimeout(() => { if (P.permiso[k] === null) P.permiso[k] = undefined; }, 30000); });   // sin respuesta: se vuelve a preguntar en 30 s
  }
  function motivoSinOriginal(s) {
    const clips = s.clips || [], r = clips[0] && P.permiso[clips[0].storage_path];
    return r && r.ok === false ? r.motivo : '';
  }
  /* El celular pone el clip tal cual (sin base, sin IA) */
  function vistaOriginal(s) { return publicaOriginal(s) && !s.renderUrl && s.phase === 'idle'; }

  /* ══ Aplicar un modo ══ */
  function aplicar(modo) {
    const s = C.state;
    let patch;
    if (modo === 'tal_cual') {
      patch = Object.assign({}, C.colorDesdeCfg ? C.colorDesdeCfg(null) : {}, {
        sinCortes: true, captions: false, movEfectos: Object.assign({}, SIN_EFECTOS), music: 'none',
        vozEstudio: false, grafOn: false, escenasOn: false, sonidos: [], tomasMano: null, indicesDe: null, lineas: {},
      });
    } else if (modo === 'mis' && prefMarca().mis) {
      const m = prefMarca().mis;
      if (C.restaurarDeRender) C.restaurarDeRender(m.cfg || {});
      const k = m.cortes || {};
      patch = {};
      ['pacing', 'clipGap', 'clipStart', 'aire', 'editMode', 'duration'].forEach((x) => { if (k[x] !== undefined && k[x] !== null) patch[x] = k[x]; });
      patch.sinCortes = !!k.sinCortes;
      patch.captions = k.captions !== false;
    } else {
      modo = 'cherry';
      patch = Object.assign({}, C.colorDesdeCfg ? C.colorDesdeCfg(null) : {}, JSON.parse(JSON.stringify(DEF)));
    }
    patch.arranque = modo;
    C.setState(patch);
    console.log('[Arranque] el proyecto arranca:', modo);
  }

  /* ══ Al subir el primer clip ══ (media.js › triggerUpload, con cuántos clips había antes) */
  async function alSubir(antes) {
    const s = C.state;
    if (antes > 0 || !(s.clips || []).length || s.arranque) return;
    const pid = C.session && C.session.projectId;
    await leerPrefs();
    if (!C.session || C.session.projectId !== pid || C.state.arranque) return;
    if (recordado()) { aplicarRecordado(); return; }
    abrir();
  }

  /* ══ (22-oct) «¿Qué lleva tu video?» ══ Sergio: «no todas las personas van a tener las mismas necesidades del video… que
     podamos escoger desde el inicio qué elementos va a tener nuestro video editado». Propuesta aprobada («sí a las cuatro»):
     · sale al tocar «Subir clips» en un video NUEVO, ANTES de escoger los clips (media.js › triggerUpload → antesDeSubir);
     · ocho interruptores y cinco opciones rápidas (Como siempre · Lo básico · Todo · Tal cual · Mis ajustes);
     · trae marcado lo de la última vez en esa marca (la primera vez, «Como siempre»: el mismo video de antes);
     · con «Recordar» ya no pregunta y arranca así.
     Reemplaza la pregunta de tres opciones que salía DESPUÉS de subir. La edición sigue automática: solo cambia qué pone
     Cherry. Lo que se apaga no se prepara (los gráficos no se cobran). Todo se cambia después en los módulos. */
  const ELEMENTOS = [
    { k: 'cortes', n: 'Cortes', c: 'Cortes', d: 'Quita los silencios y las pausas largas', ico: '<path d="M6 4v16M18 4v16M3 8h6M15 16h6"/>' },
    { k: 'subtitulos', n: 'Subtítulos', c: 'Subtítulos', d: 'Lo que dices, escrito en pantalla', ico: '<path d="M5 6h14M12 6v13M9 19h6"/>' },
    { k: 'audio', n: 'Mejora de audio', c: 'Audio', d: 'Tu voz más limpia, como grabada en estudio', ico: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>' },
    { k: 'movimiento', n: 'Movimiento de cámara', c: 'Movimiento', d: 'Acercamientos y golpes en los momentos fuertes', ico: '<rect x="4" y="7" width="16" height="11" rx="2"/><path d="M9 7l1.5-2h3L15 7"/><circle cx="12" cy="12.5" r="3"/>' },
    { k: 'musica', n: 'Música', c: 'Música', d: 'Una canción de fondo, debajo de tu voz', ico: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
    { k: 'efectos', n: 'Efectos de sonido', c: 'Efectos', d: 'Sonidos cortos donde pasa algo en pantalla', ico: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>' },
    { k: 'graficos', n: 'Gráficos', c: 'Gráficos', d: 'Cifras, listas y comparaciones animadas', cobra: '10 créditos', ico: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 15l3-3 2.5 2.5L17 10"/>' },
    { k: 'escenas', n: 'Escenas de apoyo', c: 'Escenas', d: 'Tomas de la biblioteca que muestran lo que dices', ico: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M8 6v4M16 6v4"/>' },
  ];
  const TODOS = ELEMENTOS.map((e) => e.k);
  const RAPIDAS = [
    { id: 'siempre', n: 'Como siempre', el: ['cortes', 'subtitulos', 'movimiento', 'musica'] },
    { id: 'basico', n: 'Lo básico', el: ['cortes', 'subtitulos', 'audio'] },
    { id: 'todo', n: 'Todo', el: TODOS },
    { id: 'tal_cual', n: 'Tal cual', el: [] },
    { id: 'mis', n: 'Mis ajustes', el: null },   // los de «Guardar como mis ajustes» (elementosDeMis)
  ];
  /* Qué lleva hoy un video, leído de sus ajustes (sirve para la pastilla, la franja y para abrir la pregunta) */
  function elementosDe(s) {
    const ef = s.movEfectos || {};
    const hay = {
      cortes: !s.sinCortes, subtitulos: s.captions !== false, audio: !!s.vozEstudio,
      movimiento: Object.keys(ef).some((k) => ef[k]), musica: !!s.music && s.music !== 'none',
      efectos: !!s.efectosAuto || (s.sonidos || []).some((x) => x.auto), graficos: !!s.grafOn, escenas: !!s.escenasOn,
    };
    return TODOS.filter((k) => hay[k]);
  }
  function resumenDe(s) {
    const el = elementosDe(s);
    return el.length ? ELEMENTOS.filter((e) => el.indexOf(e.k) >= 0).map((e) => e.c).join(' · ') : 'Nada encima';
  }
  /* Los de «Mis ajustes», sin aplicarlos (lo mismo que leería restaurarDeRender) */
  function elementosDeMis() {
    const m = prefMarca().mis;
    if (!m) return null;
    const cfg = m.cfg || {}, k = m.cortes || {}, mv = cfg.movimiento;
    const hay = {
      cortes: !k.sinCortes, subtitulos: k.captions !== false && !cfg.apagados, audio: cfg.voz === 'estudio',
      movimiento: !!(mv && Array.isArray(mv.efectos) && mv.efectos.length), musica: !!DEF.music && DEF.music !== 'none',
      efectos: false, graficos: !!(cfg.graficos && cfg.graficos.cantidad), escenas: !!(cfg.escenas && cfg.escenas.cantidad && !cfg.escenas.soloFijas),
    };
    return TODOS.filter((x) => hay[x]);
  }
  function elDeRapida(id) { return id === 'mis' ? elementosDeMis() || [] : (RAPIDAS.find((r) => r.id === id) || RAPIDAS[0]).el.slice(); }

  /* Poner en el video lo escogido. Solo se toca lo que cambia: lo que ya se afinó en los módulos se queda. */
  function aplicarElementos(lista, desdeMis) {
    const quiere = new Set(lista || []);
    if (!quiere.size) { C.state.efectosAuto = false; aplicar('tal_cual'); return; }
    // de «tal cual» (o un video nuevo) se parte de lo de siempre, con su color; desde «Mis ajustes», de esos
    if (desdeMis && prefMarca().mis) aplicar('mis');
    else if (C.state.arranque === 'tal_cual' || !(C.state.clips || []).length) aplicar('cherry');
    const s = C.state, ya = new Set(elementosDe(s)), patch = {};
    const pon = (k, valor) => { if (quiere.has(k) !== ya.has(k)) Object.assign(patch, valor(quiere.has(k))); };
    pon('cortes', (on) => ({ sinCortes: !on }));
    pon('subtitulos', (on) => ({ captions: on }));
    pon('audio', (on) => ({ vozEstudio: on }));
    pon('movimiento', (on) => ({ movEfectos: on ? JSON.parse(JSON.stringify(DEF.movEfectos)) : Object.assign({}, SIN_EFECTOS) }));
    pon('musica', (on) => ({ music: on ? (DEF.music && DEF.music !== 'none' ? DEF.music : 'synthwave') : 'none' }));
    pon('graficos', (on) => ({ grafOn: on }));
    pon('escenas', (on) => ({ escenasOn: on }));
    pon('efectos', (on) => (on ? { efectosAuto: true } : { efectosAuto: false, sonidos: (s.sonidos || []).filter((x) => !x.auto) }));
    patch.arranque = desdeMis && prefMarca().mis ? 'mis' : 'cherry';
    C.setState(patch);
    if (C.state.efectosAuto) vigilarEfectos();
    console.log('[Arranque] el video lleva:', [...quiere].join(', '));
  }
  /* Los efectos de sonido los reparte Cherry cuando ya hay video (sonidos-auto.js necesita sus momentos): se espera */
  let relojEf = 0;
  function vigilarEfectos() {
    clearInterval(relojEf);
    relojEf = setInterval(() => {
      if (!C.state.efectosAuto) { clearInterval(relojEf); return; }
      const M = C.cortesVivo && C.cortesVivo.momentos ? C.cortesVivo.momentos() : null;
      if (!M || !C.sonidosAuto) return;
      clearInterval(relojEf);
      C.state.efectosAuto = false;
      if (!C.sonidosAuto.hayAuto()) C.sonidosAuto.poner();
    }, 2500);
  }

  /* ¿Ya dejó recordado con qué arranca esta marca? (la de antes: 'cherry' | 'tal_cual' | 'mis') */
  function recordado() {
    const pm = prefMarca();
    if (pm.recordarEl && pm.ultima && Array.isArray(pm.ultima.el)) return { el: pm.ultima.el, mis: pm.ultima.rapida === 'mis' };
    const r = pm.recordar;
    if (r === 'tal_cual') return { el: [], mis: false };
    if (r === 'mis' && pm.mis) return { el: elementosDeMis() || [], mis: true };
    if (r === 'cherry') return { el: elDeRapida('siempre'), mis: false };
    return null;
  }
  function aplicarRecordado() {
    const r = recordado();
    aplicarElementos(r.el, r.mis);
    aviso('Tu video lleva: ' + resumenDe(C.state) + ', como lo dejaste recordado. Lo cambias tocando la franja o la pastilla.');
  }
  /* media.js › triggerUpload, en un video nuevo: pregunta antes de abrir el selector de clips. ⚠️ `luego` abre el
     selector: el iPhone solo lo deja abrir dentro del toque de la persona, así que va en el mismo toque (el de «Escoger mis
     clips» o el de «Subir clips» si ya estaba recordado), nunca después de esperar algo. */
  function antesDeSubir(luego) {
    if (P.datos && recordado()) { aplicarRecordado(); luego(); return; }
    abrir(luego);
  }

  const V = { abierta: false, sel: new Set(), rapida: 'siempre', recordar: false, luego: null };
  function abrir(luego) {
    const ir = () => {
      const s = C.state, pm = prefMarca();
      if ((s.clips || []).length || s.arranque) {
        V.sel = new Set(elementosDe(s));
        V.rapida = s.arranque === 'mis' ? 'mis' : !V.sel.size ? 'tal_cual' : null;
      } else {
        const r = pm.ultima && Array.isArray(pm.ultima.el) ? { el: pm.ultima.el, rapida: pm.ultima.rapida || null } : null;
        V.sel = new Set(r ? r.el : elDeRapida('siempre'));
        V.rapida = r ? r.rapida : 'siempre';
      }
      if (V.rapida === 'mis' && !pm.mis) V.rapida = null;
      V.recordar = !!(pm.recordarEl || pm.recordar);
      V.luego = typeof luego === 'function' ? luego : null;
      V.abierta = true;
      C.setState({});
    };
    if (P.datos) ir(); else leerPrefs().then(ir);
  }
  function cerrar() { V.abierta = false; V.luego = null; C.setState({}); }
  function seguir() {
    const sel = TODOS.filter((k) => V.sel.has(k)), rapida = V.rapida, luego = V.luego;
    V.abierta = false; V.luego = null;
    guardarPref({ ultima: { el: sel, rapida }, recordarEl: !!V.recordar, recordar: null });
    aplicarElementos(sel, rapida === 'mis');
    if (luego) luego();   // el selector de clips, en este mismo toque
  }
  function modal() {
    if (!V.abierta) return null;
    const hayMis = !!prefMarca().mis, s = C.state;
    const rapidas = RAPIDAS.filter((r) => r.id !== 'mis' || hayMis);
    const editando = !V.luego && (s.clips || []).length > 0;
    return h('div', { class: 'modal-wrap arr-modal' },
      h('div', { class: 'scrim', onClick: cerrar }),
      h('div', { class: 'modal arr-que', role: 'dialog', 'aria-label': '¿Qué lleva tu video?' },
        h('div', { class: 'modal__head' },
          h('div', null,
            h('div', { class: 'modal__title arr-titulo' }, '¿Qué lleva tu video?'),
            h('div', { class: 'arr-sub' }, V.luego ? 'Escoge antes de subir tus clips. Después lo cambias cuando quieras.'
              : 'Cherry lo pone en este video. Cada cosa se afina después en su módulo.')),
          h('button', { class: 'btn-x', type: 'button', onClick: cerrar, title: 'Cerrar sin cambiar nada', 'aria-label': 'Cerrar' }, '✕')),
        h('div', { class: 'modal__body arr-cuerpo' },
          h('div', { class: 'arr-rap', role: 'group', 'aria-label': 'Opciones rápidas' }, rapidas.map((r) => h('button', {
            type: 'button', 'aria-pressed': V.rapida === r.id ? 'true' : 'false',
            onClick: () => { V.rapida = r.id; V.sel = new Set(elDeRapida(r.id)); C.setState({}); } }, r.n))),
          h('div', { class: 'arr-els' }, ELEMENTOS.map((e) => h('button', {
            type: 'button', class: 'arr-el', 'aria-pressed': V.sel.has(e.k) ? 'true' : 'false',
            onClick: () => { if (V.sel.has(e.k)) V.sel.delete(e.k); else V.sel.add(e.k); V.rapida = null; C.setState({}); } },
            h('span', { class: 'arr-el__ico', html: '<svg viewBox="0 0 24 24" aria-hidden="true">' + e.ico + '</svg>' }),
            h('span', { class: 'arr-el__tx' }, h('b', null, e.n), h('small', null, e.d, e.cobra ? [' · ', h('em', null, e.cobra)] : null)),
            h('span', { class: 'arr-sw', 'aria-hidden': 'true' }))))),
        h('div', { class: 'modal__foot arr-pie' },
          h('label', { class: 'arr-recordar' },
            h('input', { type: 'checkbox', id: 'arr-recordar', checked: V.recordar, onChange: (e) => { V.recordar = !!e.target.checked; } }),
            h('span', null, 'Recordar para los próximos videos de esta marca')),
          editando && !esTalCual(s) ? h('button', { type: 'button', class: 'arr-mios', onClick: guardarMios }, 'Guardar lo de este video como mis ajustes') : null,
          h('button', { class: 'btn btn--publish arr-ir', type: 'button', onClick: seguir }, V.luego ? 'Escoger mis clips →' : 'Listo'))));
  }

  /* ══ La franja de arriba de la configuración ══ */
  function estado(s) {
    if (!(s.clips || []).length || s.pantalla !== 'editor') return null;
    let titulo, texto;
    if (s.arranque === 'tal_cual') {
      if (nadaEncima(s)) {
        titulo = 'Este video va tal cual';
        const m = motivoSinOriginal(s);
        texto = (s.clips || []).length > 1 ? 'Sin cortes, subtítulos, movimiento ni música. Como son varios clips, se pegan sin ponerles nada.'
          : m === 'grande' ? 'Sin cortes, subtítulos, movimiento ni música. Pesa más de lo que Instagram acepta: se fabrica una vez sin ponerle nada.'
          : m ? 'Sin cortes, subtítulos, movimiento ni música. Se fabrica una vez sin ponerle nada y sale esa copia.'
          : 'Sin cortes, subtítulos, movimiento ni música. Se publica tu archivo original.';
      } else {
        titulo = 'Editado';
        texto = 'Empezó tal cual y le pusiste cosas: se fabrica con lo que ves.';
      }
    } else if (s.arranque === 'mis') { titulo = MODOS.mis; texto = 'Lleva: ' + resumenDe(s) + '.'; }
    else { titulo = MODOS.cherry; texto = 'Lleva: ' + resumenDe(s) + '.'; }
    return { titulo, texto, talCual: esTalCual(s), resumen: esTalCual(s) ? 'Tal cual' : resumenDe(s) };
  }
  function franja(s) {
    const e = estado(s);
    if (!e) return null;
    const { titulo, texto, talCual } = e;
    return h('div', { class: 'arr-franja' + (talCual ? ' arr-franja--tc' : '') },
      h('div', { class: 'arr-franja__tx' }, h('b', null, titulo), h('span', null, texto)),
      h('div', { class: 'arr-franja__bts' },
        !talCual ? h('button', { type: 'button', class: 'arr-bt', title: 'Los próximos videos de esta marca pueden arrancar con esto',
          onClick: guardarMios }, 'Guardar como mis ajustes') : null,
        h('button', { type: 'button', class: 'arr-bt arr-bt--fuerte', onClick: abrir }, 'Cambiar')));
  }
  /* (22-oct) Sergio, en el celular: la franja «le está quitando mucho espacio a toda la parte de abajo de los clips y las
     opciones»; que vaya «donde no estorbe… donde podamos tocarlo si queremos o si no ignorarlo». En el celular es esta
     pastilla en la fila de tus tomas; dice lo que lleva el video y tocarla abre «¿Qué lleva tu video?». */
  function pastilla(s) {
    const e = estado(s);
    if (!e) return null;
    /* (22-oct) dice lo que lleva el video y abre «¿Qué lleva tu video?» */
    return h('button', { type: 'button', class: 'arr-chip' + (e.talCual ? ' arr-chip--tc' : ''), title: 'Qué lleva tu video',
      onClick: () => abrir() },
      h('i'), h('span', null, e.resumen), h('b', null, '›'));
  }
  function guardarMios() {
    const t = C.fabricar && C.fabricar.ajustesActuales ? C.fabricar.ajustesActuales(C.state) : null;
    if (!t) { aviso('No pude leer los ajustes de este video.'); return; }
    leerPrefs().then(() => guardarPref({ mis: t })).then(() => {
      aviso('Listo: «Con mis ajustes» ya aparece al subir un video nuevo en esta marca.');
      C.setState({});
    });
  }

  function aviso(t) {
    if (window.CherryCuenta && window.CherryCuenta.aviso) { window.CherryCuenta.aviso(t); return; }
    console.log('[Arranque]', t);
  }

  /* (22-oct) las preferencias se leen apenas hay sesión: «Subir clips» con «Recordar» abre el selector en el mismo toque */
  if (C.apiReady) leerPrefs(); else if (C.onApiReady) C.onApiReady.push(() => leerPrefs());

  const css = document.createElement('style');
  css.textContent = [
    '.arr-eti{font-family:var(--f-mono,"DM Mono",monospace);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-60,rgba(247,233,224,.6));margin-bottom:4px}',
    '.arr-titulo{font-size:24px!important;line-height:1.1}',
    /* (22-oct) «¿Qué lleva tu video?»: en el computador una ventana con los elementos en dos columnas; en el celular sube como hoja */
    '.arr-que{width:min(680px,100%);background:linear-gradient(180deg,#1D171B,#110D10)}',
    '.arr-que .modal__head{border-bottom:0;padding-bottom:6px}',
    '.arr-sub{font-size:13px;line-height:1.4;color:var(--ink-60,rgba(247,233,224,.62));margin-top:6px}',
    '.arr-cuerpo{display:flex;flex-direction:column;gap:12px;padding-top:6px}',
    '.arr-rap{display:flex;gap:6px;flex-wrap:wrap}',
    '.arr-rap button{height:32px;padding:0 13px;border-radius:999px;border:1px solid rgba(247,233,224,.16);background:rgba(255,255,255,.04);',
    'color:var(--ink-60,rgba(247,233,224,.62));font:600 12.5px var(--f-ui,sans-serif);cursor:pointer;white-space:nowrap}',
    '.arr-rap button[aria-pressed="true"]{background:#F4ECE7;border-color:#F4ECE7;color:#141313}',
    '.arr-els{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
    '.arr-el{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border-radius:14px;',
    'border:1px solid rgba(247,233,224,.12);background:rgba(255,255,255,.025);color:inherit;text-align:left;font:inherit;cursor:pointer}',
    '.arr-el[aria-pressed="true"]{border-color:rgba(255,45,138,.55);background:rgba(255,45,138,.06)}',
    '.arr-el:focus-visible,.arr-rap button:focus-visible{outline:2px solid var(--magenta,#FF2D8A);outline-offset:2px}',
    '.arr-el__ico{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.06);display:grid;place-items:center}',
    '.arr-el__ico svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    '.arr-el__tx{min-width:0}',
    '.arr-el__tx b{display:block;font-size:13.5px;line-height:1.2}',
    '.arr-el__tx small{display:block;font-size:11.5px;line-height:1.3;color:var(--ink-60,rgba(247,233,224,.6));margin-top:2px}',
    '.arr-el__tx em{font-style:normal;color:#FFC93C}',
    '.arr-sw{position:relative;width:38px;height:22px;border-radius:99px;background:rgba(247,233,224,.18);transition:background .2s}',
    '.arr-sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}',
    '.arr-el[aria-pressed="true"] .arr-sw{background:var(--magenta,#FF2D8A)}',
    '.arr-el[aria-pressed="true"] .arr-sw::after{transform:translateX(16px)}',
    '.arr-pie{display:flex;align-items:center;justify-content:space-between;gap:10px 14px;flex-wrap:wrap}',
    '.arr-mios{background:none;border:0;padding:0;color:var(--ink-60,rgba(247,233,224,.62));font:600 12.5px var(--f-ui,sans-serif);text-decoration:underline;cursor:pointer}',
    '.arr-ir{width:auto;flex:none;padding:12px 22px;margin-left:auto}',
    '@media (max-width:760px){.arr-modal{align-items:flex-end;padding:0}',
    '.arr-modal .arr-que{width:100%;max-height:92vh;max-height:92dvh;border-radius:24px 24px 0 0;border-bottom:0}',
    '.arr-que .modal__head{padding:18px 16px 4px}.arr-que .modal__body{padding:6px 16px 10px}',
    '.arr-que .modal__foot{padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px))}',
    '.arr-rap{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-16px;padding-inline:16px}.arr-rap::-webkit-scrollbar{display:none}',
    '.arr-els{grid-template-columns:minmax(0,1fr);gap:2px}',
    '.arr-el{border:0;background:none;padding:7px 2px}.arr-el[aria-pressed="true"]{background:none}',
    '.arr-ir{width:100%;margin-left:0}.arr-recordar{font-size:12.5px}}',
    '@media (prefers-reduced-motion:reduce){.arr-sw,.arr-sw::after{transition:none}}',
    '.arr-recordar{display:flex;align-items:center;gap:10px;font-size:13.5px;cursor:pointer}',
    '.arr-recordar input{width:18px;height:18px;accent-color:var(--magenta,#FF2D8A)}',
    '.arr-pie .btn{flex:none;padding:12px 24px}',
    '.arr-franja{display:flex;align-items:center;justify-content:space-between;gap:10px 14px;flex-wrap:wrap;margin:0 0 12px;padding:11px 12px 11px 14px;',
    'border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(247,233,224,.12)}',
    '.arr-franja--tc{border-color:var(--amber,#FFC93C);background:rgba(255,201,60,.07)}',
    '.arr-franja__tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 220px}',
    '.arr-franja__tx b{font-size:14px}',
    '.arr-franja__tx span{font-size:12px;line-height:1.4;color:var(--ink-60,rgba(247,233,224,.62))}',
    '.arr-franja__bts{display:flex;gap:8px;flex-wrap:wrap}',
    '.arr-bt{border-radius:999px;padding:8px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:inherit;',
    'background:transparent;border:1.5px solid rgba(247,233,224,.22)}',
    '.arr-bt--fuerte{background:#F4F2EF;color:#141313;border-color:#F4F2EF}',
    '.arr-chip{display:none}',
    '@media (max-width:760px){.arr-chip{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:60%;height:26px;padding:0 10px 0 9px;',
    'border-radius:999px;border:1px solid rgba(247,233,224,.16);background:rgba(255,255,255,.04);color:var(--ink-60,rgba(247,233,224,.62));',
    'font:600 11.5px var(--f-ui,sans-serif);cursor:pointer}',
    '.arr-chip i{flex:none;width:6px;height:6px;border-radius:50%;background:var(--magenta,#FF2D8A)}',
    '.arr-chip span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.arr-chip b{font-size:15px;line-height:1;margin-top:-1px}',
    '.arr-chip--tc{border-color:rgba(255,201,60,.55)}.arr-chip--tc i{background:#FFC93C}}',
    '.arr-orig{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000}',
    '.arr-orig-sello{position:absolute;left:10px;top:10px;z-index:2;font-family:var(--f-mono,"DM Mono",monospace);font-size:10px;letter-spacing:.1em;',
    'text-transform:uppercase;padding:4px 9px;border-radius:999px;background:var(--amber,#FFC93C);color:#141313;pointer-events:none}',
  ].join('\n');
  document.head.appendChild(css);

  /* El clip en el celular, tal cual (sin base): el mismo reproductor que mueven el play y la barra (state.js › videoVista) */
  function pantalla(s) {
    const clip = (s.clips || [])[0];
    const url = clip && C.urlClip ? C.urlClip(clip.mp4_path) : '';
    const v = C.videoFijo('original', url, {
      class: 'arr-orig js-video-player', playsinline: true, preload: 'auto',
      onLoadedmetadata: (e) => C.live.total(e.target.duration),
      onTimeupdate: (e) => { const t = e.target; if (t.duration) C.live.progress(t.currentTime / t.duration, t.duration); },
      onPlay: () => C.live.playing(true), onPause: () => C.live.playing(false), onEnded: () => C.live.playing(false),
      onClick: () => C.actions.togglePlay(),
    });
    return [v, h('span', { class: 'arr-orig-sello' }, 'Tal cual'),
      h('div', { class: 'screen__play js-screen-play', style: { display: v.paused === false ? 'none' : 'flex' }, onClick: () => C.actions.togglePlay() },
        h('div', { class: 'play-glass' }, h('span', { class: 'tri' })))];
  }
  function reproductor() { return vistaOriginal(C.state) ? (C.videoFijo.get ? C.videoFijo.get('original') : null) : null; }

  C.arranque = { alSubir, abrir, antesDeSubir, aplicar, aplicarElementos, elementosDe, resumenDe, modal, franja, pastilla, esTalCual, nadaEncima, publicaOriginal, vistaOriginal, pantalla, reproductor, motivoSinOriginal,
                 leerPrefs, _P: P, _V: V };
})();

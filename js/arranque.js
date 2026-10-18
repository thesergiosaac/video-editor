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
    const r = prefMarca().recordar;
    if (r && (r !== 'mis' || prefMarca().mis)) {
      aplicar(r);
      aviso('Este video arrancó ' + (r === 'tal_cual' ? 'tal cual' : r === 'mis' ? 'con tus ajustes' : 'editado con Cherry') +
        ', como lo dejaste recordado. Lo cambias en la franja de arriba.');
      return;
    }
    abrir();
  }

  /* ══ La pregunta ══ */
  const V = { abierta: false, eleccion: 'tal_cual', recordar: false };
  function abrir() {
    leerPrefs().then(() => {
      const r = prefMarca().recordar;
      V.eleccion = C.state.arranque || r || 'tal_cual';
      if (V.eleccion === 'mis' && !prefMarca().mis) V.eleccion = 'tal_cual';
      V.recordar = !!r;
      V.abierta = true;
      C.setState({});
    });
  }
  function cerrar() { V.abierta = false; C.setState({}); }
  function seguir() {
    const modo = V.eleccion;
    V.abierta = false;
    guardarPref({ recordar: V.recordar ? modo : null });
    aplicar(modo);
  }
  function opcion(modo, icono, titulo, texto) {
    const on = V.eleccion === modo;
    return h('button', { type: 'button', class: 'arr-op' + (on ? ' arr-op--on' : ''), 'aria-pressed': on ? 'true' : 'false',
      onClick: () => { V.eleccion = modo; C.setState({}); } },
      h('span', { class: 'arr-op__ico' }, icono),
      h('span', { class: 'arr-op__tx' }, h('b', null, titulo), h('span', null, texto)));
  }
  function modal() {
    if (!V.abierta) return null;
    const hayMis = !!prefMarca().mis;
    return h('div', { class: 'modal-wrap arr-modal' },
      h('div', { class: 'scrim', onClick: cerrar }),
      h('div', { class: 'modal', style: { width: 'min(520px,100%)' }, role: 'dialog', 'aria-label': '¿Qué hago con este video?' },
        h('div', { class: 'modal__head' },
          h('div', null,
            h('div', { class: 'arr-eti' }, 'Tu video ya subió'),
            h('div', { class: 'modal__title arr-titulo' }, '¿Qué hago con este video?')),
          h('button', { class: 'btn-x', onClick: cerrar, title: 'Decidir después' }, '✕')),
        h('div', { class: 'modal__body arr-body' },
          opcion('cherry', '✂', 'Edítalo con Cherry', 'Lo corto y le pongo subtítulos, movimiento y música, como hasta ahora.'),
          opcion('tal_cual', '✓', 'Ya está listo: déjalo tal cual', 'No le pongo nada. Lo programas y sale exactamente como lo subiste.'),
          hayMis ? opcion('mis', '★', 'Con mis ajustes', 'Lo que guardaste de otro proyecto de esta marca.') : null,
          h('label', { class: 'arr-recordar' },
            h('input', { type: 'checkbox', id: 'arr-recordar', checked: V.recordar, onChange: (e) => { V.recordar = !!e.target.checked; } }),
            h('span', null, 'Recordar para los próximos videos de esta marca'))),
        h('div', { class: 'modal__foot arr-pie' },
          h('button', { class: 'btn btn--publish', type: 'button', onClick: seguir }, 'Seguir'))));
  }

  /* ══ La franja de arriba de la configuración ══ */
  function franja(s) {
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
    } else if (s.arranque === 'mis') { titulo = MODOS.mis; texto = 'Arrancó con los ajustes que guardaste en esta marca.'; }
    else { titulo = MODOS.cherry; texto = 'Cortes, subtítulos, movimiento y música, como siempre.'; }
    const talCual = esTalCual(s);
    return h('div', { class: 'arr-franja' + (talCual ? ' arr-franja--tc' : '') },
      h('div', { class: 'arr-franja__tx' }, h('b', null, titulo), h('span', null, texto)),
      h('div', { class: 'arr-franja__bts' },
        !talCual ? h('button', { type: 'button', class: 'arr-bt', title: 'Los próximos videos de esta marca pueden arrancar con esto',
          onClick: guardarMios }, 'Guardar como mis ajustes') : null,
        h('button', { type: 'button', class: 'arr-bt arr-bt--fuerte', onClick: abrir }, 'Cambiar')));
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

  const css = document.createElement('style');
  css.textContent = [
    '.arr-eti{font-family:var(--f-mono,"DM Mono",monospace);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-60,rgba(247,233,224,.6));margin-bottom:4px}',
    '.arr-titulo{font-size:24px!important;line-height:1.1}',
    '.arr-body{display:flex;flex-direction:column;gap:10px}',
    '.arr-op{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:start;width:100%;text-align:left;padding:14px;border-radius:18px;',
    'border:1.5px solid rgba(247,233,224,.14);background:rgba(255,255,255,.03);color:inherit;font:inherit;cursor:pointer}',
    '.arr-op:hover{border-color:rgba(247,233,224,.3)}',
    '.arr-op--on{border-color:var(--amber,#FFC93C);background:rgba(255,201,60,.07)}',
    '.arr-op:focus-visible{outline:2px solid var(--amber,#FFC93C);outline-offset:2px}',
    '.arr-op__ico{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(247,233,224,.12);font-weight:800}',
    '.arr-op--on .arr-op__ico{background:var(--amber,#FFC93C);color:#141313}',
    '.arr-op__tx{display:flex;flex-direction:column;gap:3px;min-width:0}',
    '.arr-op__tx b{font-size:15px}',
    '.arr-op__tx span{font-size:13px;line-height:1.45;color:var(--ink-60,rgba(247,233,224,.65))}',
    '.arr-recordar{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:13.5px;cursor:pointer}',
    '.arr-recordar input{width:18px;height:18px;accent-color:var(--amber,#FFC93C)}',
    '.arr-pie{display:flex;justify-content:flex-end}',
    '.arr-pie .btn{width:auto;flex:none;padding:12px 24px}',
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

  C.arranque = { alSubir, abrir, aplicar, modal, franja, esTalCual, nadaEncima, publicaOriginal, vistaOriginal, pantalla, reproductor, motivoSinOriginal,
                 leerPrefs, _P: P, _V: V };
})();

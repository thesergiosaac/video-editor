/* reportes.js — «Reportar o sugerir», en TODAS las pantallas de Cherry (29-oct-2026)
 *
 * Sergio: «poner algo donde las personas puedan reportar errores y dar sugerencias… que sientan que hay soluciones
 * inmediatas». Propuesta aprobada: https://claude.ai/artifact/LNoAd5YshK5VoU3iJN35T2 (nombre «Reportar o sugerir»,
 * promesa «te respondemos en menos de 24 horas»; Sergio lo ve en su Consola, herramientas/consola).
 *
 * - Entradas: el botón de la barra (js/lado.js, [data-reportar]), el menú de la foto (js/cuenta.js) y la tira «¿Algo
 *   falló? Repórtalo» que sale cuando Cherry detecta una falla (un error en la pantalla o el servidor que no responde).
 * - La ventana: «Algo no funciona» (qué pasó + ¿te deja seguir?) o «Tengo una idea» (la idea + para qué + la parte de
 *   Cherry). Va sola la foto de la pantalla (se puede quitar), dónde estaba, la marca y lo técnico (los últimos errores,
 *   el navegador). Se guarda en la tabla `reportes` y las fotos en el cubo privado `reportes` (servidor/sql/28-reportes.sql).
 * - «Mis reportes»: en qué va cada uno y la respuesta de Sergio. Cuando hay novedad, punto amarillo en el botón.
 * - Funciona en los dos mundos: las herramientas (CherryApp.rest) y el inicio (CARRETE.api.rest).
 * Los estilos van aquí dentro: tiene que verse igual en todas las pantallas.
 */
(function () {
  'use strict';
  if (window.CherryReportes) return;

  /* ── El registro de fallas (desde que carga la página; vive en la pestaña) ── */
  var LLAVE_ERR = 'cherry-errores', ultimoAviso = 0;
  function errores() { try { return JSON.parse(sessionStorage.getItem(LLAVE_ERR) || '[]') || []; } catch (e) { return []; } }
  function anotar(m, d, avisar) {
    var l = errores();
    l.push({ t: new Date().toISOString(), m: String(m || '').slice(0, 300), d: String(d || '').slice(0, 160), p: location.pathname });
    try { sessionStorage.setItem(LLAVE_ERR, JSON.stringify(l.slice(-10))); } catch (e) { /* nada */ }
    if (avisar) avisarFalla();
  }
  window.addEventListener('error', function (ev) {
    if (ev.target && ev.target !== window) return;   // una imagen o un video que no cargó: no es una falla de Cherry
    if (/ResizeObserver loop|^Script error\.?$/i.test(ev.message || '')) return;   // avisos del navegador que no rompen nada
    anotar(ev.message, (ev.filename || '').split('/').pop() + ':' + (ev.lineno || ''), true);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason, m = (r && (r.message || r.name)) || String(r || '');
    if (/AbortError|NotAllowedError|play\(\)|interrupted/i.test(m + ' ' + ((r && r.name) || ''))) return;   // un video que no se dejó reproducir
    anotar(m, 'promesa', false);
  });
  var f0 = window.fetch;
  if (f0) window.fetch = function (entrada) {
    var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
    var p = f0.apply(this, arguments);
    if (/supabase\.co\/(functions|rest)\/v1\//.test(url)) {
      var donde = url.replace(/^.*?\/(functions|rest)\/v1\//, '$1/').split('?')[0];
      p.then(function (r) { if (r.status >= 500) anotar('El servidor respondió ' + r.status, donde, /^functions\//.test(donde)); },
        function (e) { if (!e || e.name !== 'AbortError') anotar('Sin conexión con el servidor', donde, false); });
    }
    return p;
  };

  /* ── Con quién se habla ── */
  function sesion() { try { return JSON.parse(localStorage.getItem('carrete-sesion') || 'null'); } catch (e) { return null; } }
  function usuario() {
    var A = window.CherryApp, C = window.CARRETE;
    return (A && A.usuario && A.usuario()) || (C && C.session && C.session.user) || ((sesion() || {}).user) || null;
  }
  function rest(ruta, opts) {
    var A = window.CherryApp, C = window.CARRETE;
    if (A && A.rest) return A.rest(ruta, opts);
    if (C && C.api && C.api.rest) return C.api.rest(ruta, opts).then(function (d) {
      if (d && !Array.isArray(d) && (d.code || d.statusCode || d.error) && d.message) throw new Error(d.message);
      return d;
    });
    return Promise.reject(new Error('Entra a Cherry para reportar.'));
  }
  function marca() {   // el nombre de la marca activa (el menú de la foto, js/cuenta.js)
    var K = window.CherryCuenta;
    try { return (K && K.activa && K.nombreDeMarca && K.nombreDeMarca(K.activa())) || ''; } catch (e) { return ''; }
  }
  function pantalla() {
    var t = String(document.title || '').replace(/\s*[·|—–-]\s*Cherry.*$/i, '').replace(/\s+de Cherry$/i, '').trim();
    if (/[?&]modo=guiones/.test(location.search)) t = 'Guiones';
    return t || 'Inicio';
  }
  // la parte de Cherry: la que se reconoce por el título de la pantalla, y las que se ofrecen para una idea (caben en 2 filas)
  var PARTES = ['Inicio', 'Editor', 'Guiones', 'Laboratorio', 'Storyboard', 'Carruseles', 'Historias', 'Calendario', 'Estrategias', 'Respuestas', 'Estadísticas', 'Mi proceso', 'Pruebas', 'Identidad'];
  var AREAS = ['Editor', 'Guiones', 'Laboratorio', 'Storyboard', 'Carruseles', 'Calendario', 'Respuestas', 'Estadísticas', 'Otra'];
  function areaDe(p) {
    var x = PARTES.filter(function (a) { return p.toLowerCase().indexOf(a.toLowerCase()) >= 0; })[0];
    return x || (/editor/i.test(p) ? 'Editor' : 'Otra');
  }
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ── La foto de la pantalla (html-to-image; si no sale en 7 s, va sin foto) ── */
  var LIB = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', libP = null;
  var VACIA = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  function cargarLib() {
    if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
    if (!libP) libP = new Promise(function (ok, mal) {
      var s = document.createElement('script'); s.src = LIB; s.onload = function () { ok(window.htmlToImage); }; s.onerror = mal; document.head.appendChild(s);
    });
    return libP;
  }
  function fotoPantalla() {
    var limite = new Promise(function (ok) { setTimeout(function () { ok(null); }, 7000); });
    var foto = cargarLib().then(function (h) {
      var w = window.innerWidth, hh = window.innerHeight, r = Math.min(1, 1100 / w);
      return h.toJpeg(document.body, {
        quality: 0.72, pixelRatio: r, width: w, height: hh, skipFonts: true, cacheBust: false, imagePlaceholder: VACIA,
        style: { transform: 'translate(' + (-window.scrollX) + 'px,' + (-window.scrollY) + 'px)', transformOrigin: 'top left' },
        filter: function (n) { return !(n.id && /^rep-/.test(n.id)) && n.tagName !== 'VIDEO' && n.tagName !== 'IFRAME'; },
      });
    }).catch(function () { return null; });
    return Promise.race([foto, limite]);
  }
  function aBlob(dataUrl) {
    var p = dataUrl.split(','), b = atob(p[1]), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return new Blob([u], { type: 'image/jpeg' });
  }
  function subir(uid, nombre, blob, tipo) {
    var ruta = uid + '/' + nombre;
    return rest('/storage/v1/object/reportes/' + ruta, { method: 'POST', body: blob, headers: { 'Content-Type': tipo || blob.type || 'application/octet-stream', 'x-upsert': 'false' } })
      .then(function () { return ruta; });
  }

  /* ── Estilos (una vez) ── */
  var ICONOS = {
    falla: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 21 19H3z"/><path d="M12 10v4M12 16.8v.2"/></svg>',
    idea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6.5" width="18" height="13" rx="2.5"/><path d="M8.5 6.5 10 4h4l1.5 2.5"/><circle cx="12" cy="13" r="3.5"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    codigo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.3 4.3L19 7.2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    atras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/></svg>',
    clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7-7l7.6-7.6a3.3 3.3 0 0 1 4.7 4.7l-7.6 7.6a1.7 1.7 0 0 1-2.4-2.4l7-7"/></svg>',
  };
  var CSS =
    '#rep-velo{position:fixed;inset:0;z-index:2147483000;background:rgba(40,24,32,.38);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px;' +
      '--r-fondo:#FCF9F7;--r-hoja:#F4EEEA;--r-tinta:#140C11;--r-tinta2:rgba(20,12,17,.64);--r-tinta3:rgba(20,12,17,.44);--r-borde:rgba(20,12,17,.09);--r-rosa:#FF2D8A;--r-rosa-txt:#C2005F;' +
      'font:400 14px/1.45 "Space Grotesk","Segoe UI",system-ui,sans-serif;color:var(--r-tinta)}' +
    '#rep-velo[hidden]{display:none}' +
    '#rep-velo *{box-sizing:border-box}' +
    '.rep-v{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--r-fondo);border-radius:28px;padding:22px;display:grid;gap:13px;' +
      'box-shadow:0 30px 70px -30px rgba(60,30,45,.6),0 0 0 1px var(--r-borde);animation:rep-entra .22s cubic-bezier(.2,.7,.2,1)}' +
    '@keyframes rep-entra{from{opacity:0;transform:translateY(10px) scale(.98)}}' +
    '.rep-t{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}' +
    '.rep-eti{display:block;font:500 10.5px/1 "DM Mono",ui-monospace,monospace;letter-spacing:.15em;text-transform:uppercase;color:var(--r-tinta3);margin-bottom:6px}' +
    '.rep-v h2{margin:0;font:800 23px/1.1 Outfit,"Arial Black",system-ui,sans-serif;letter-spacing:-.025em;text-wrap:balance}' +
    '.rep-v p{margin:0}' +
    '.rep-redondo{all:unset;cursor:pointer;width:34px;height:34px;flex:none;border-radius:50%;background:var(--r-hoja);color:var(--r-tinta2);display:grid;place-items:center}' +
    '.rep-redondo svg{width:16px;height:16px}.rep-redondo:hover{color:var(--r-tinta)}.rep-redondo:focus-visible{outline:2px solid var(--r-rosa)}' +
    '.rep-dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.rep-camino{all:unset;cursor:pointer;box-sizing:border-box;border-radius:20px;padding:16px 14px;display:grid;gap:8px;align-content:start;border:1.5px solid var(--r-borde);background:var(--r-hoja);transition:border-color .15s,transform .15s}' +
    '.rep-camino:hover{border-color:var(--r-rosa);transform:translateY(-1px)}.rep-camino:focus-visible{outline:2px solid var(--r-rosa)}' +
    '.rep-camino i{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;background:var(--r-tinta);color:#fff}' +
    '.rep-camino.err i{background:var(--r-rosa)}.rep-camino i svg{width:20px;height:20px}' +
    '.rep-camino b{font:800 16px/1.15 Outfit,system-ui,sans-serif;letter-spacing:-.01em}.rep-camino small{font-size:12.5px;color:var(--r-tinta2);line-height:1.35}' +
    '.rep-mis{all:unset;cursor:pointer;justify-self:start;display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:999px;background:var(--r-hoja);font:600 13px "Space Grotesk",system-ui,sans-serif;color:var(--r-tinta)}' +
    '.rep-mis svg{width:16px;height:16px}.rep-mis .rep-punto{width:8px;height:8px;border-radius:50%;background:#FFC93C;box-shadow:0 0 0 2px var(--r-fondo)}' +
    '.rep-campo{display:grid;gap:6px}.rep-campo>span{font:500 10.5px "DM Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--r-tinta3)}' +
    '.rep-v textarea{width:100%;min-height:80px;resize:vertical;border-radius:16px;border:1px solid var(--r-borde);background:#fff;padding:11px 13px;font:400 14px/1.45 "Space Grotesk",system-ui,sans-serif;color:var(--r-tinta)}' +
    '.rep-v textarea.chico{min-height:54px}.rep-v textarea:focus{outline:2px solid rgba(255,45,138,.6);outline-offset:1px}' +
    '.rep-chips{display:flex;gap:6px;flex-wrap:wrap}' +
    '.rep-chip{all:unset;cursor:pointer;border-radius:999px;padding:7px 12px;font-size:12.5px;border:1px solid var(--r-borde);background:#fff;color:var(--r-tinta2)}' +
    '.rep-chip[aria-pressed="true"]{background:var(--r-tinta);color:#fff;border-color:var(--r-tinta)}.rep-chip.rojo[aria-pressed="true"]{background:var(--r-rosa);border-color:var(--r-rosa)}' +
    '.rep-chip:focus-visible{outline:2px solid var(--r-rosa)}' +
    '.rep-adj{display:grid;gap:6px}' +
    '.rep-a{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 10px 7px 7px;border-radius:14px;background:var(--r-hoja);font-size:12.5px}' +
    '.rep-a .min{width:38px;height:38px;border-radius:10px;background:#E9DFD9;display:grid;place-items:center;color:var(--r-tinta3);overflow:hidden}' +
    '.rep-a .min img{width:100%;height:100%;object-fit:cover}.rep-a .min svg{width:18px;height:18px}' +
    '.rep-a b{display:block;font-weight:600}.rep-a small{display:block;color:var(--r-tinta3);font-size:11.5px}' +
    '.rep-a button{all:unset;cursor:pointer;font-size:12px;color:var(--r-tinta2);text-decoration:underline}.rep-a.off{opacity:.5}' +
    '.rep-subir{all:unset;cursor:pointer;justify-self:start;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--r-tinta2);padding:4px 2px}' +
    '.rep-subir svg{width:16px;height:16px}.rep-subir:hover{color:var(--r-tinta)}' +
    '.rep-boton{all:unset;cursor:pointer;box-sizing:border-box;text-align:center;border-radius:999px;padding:13px 18px;background:var(--r-tinta);color:#fff;font:700 14.5px "Space Grotesk",system-ui,sans-serif}' +
    '.rep-boton[disabled]{opacity:.45;cursor:default}.rep-boton:focus-visible{outline:2px solid var(--r-rosa);outline-offset:2px}' +
    '.rep-linea{all:unset;cursor:pointer;text-align:center;border-radius:999px;padding:10px 16px;background:var(--r-hoja);font:600 13.5px "Space Grotesk",system-ui,sans-serif}' +
    '.rep-msg{font-size:13px;color:var(--r-rosa-txt)}' +
    '.rep-promesa{font-size:12.5px;color:var(--r-tinta3);text-align:center}' +
    '.rep-listo{justify-items:center;text-align:center}' +
    '.rep-ok{width:62px;height:62px;border-radius:50%;background:var(--r-rosa);color:#fff;display:grid;place-items:center;box-shadow:0 12px 28px -12px rgba(255,45,138,.8)}.rep-ok svg{width:30px;height:30px}' +
    '.rep-num{font:500 12px "DM Mono",ui-monospace,monospace;letter-spacing:.12em;color:var(--r-tinta3)}' +
    '.rep-listo p{color:var(--r-tinta2);max-width:36ch}' +
    '.rep-lista{display:grid;gap:8px}' +
    '.rep-f{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 12px;padding:12px 13px;border-radius:16px;background:var(--r-hoja);align-items:center}' +
    '.rep-f b{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rep-f small{grid-column:1;font-size:12px;color:var(--r-tinta3)}' +
    '.rep-f .rep-est{grid-row:1/span 2;grid-column:2;font:600 11.5px "Space Grotesk",system-ui,sans-serif;padding:5px 10px;border-radius:999px;white-space:nowrap}' +
    '.rep-f .resp{grid-column:1/-1;margin-top:6px;font-size:13px;line-height:1.4;background:#fff;border-radius:12px;padding:9px 11px;border-left:3px solid var(--r-rosa)}' +
    '.rep-e-recibido{background:rgba(58,98,201,.12);color:#3A62C9}.rep-e-arreglando{background:rgba(255,201,60,.28);color:#7A5000}.rep-e-arreglado{background:rgba(28,138,85,.14);color:#1C8A55}' +
    '.rep-e-planes{background:rgba(255,45,138,.12);color:#C2005F}.rep-e-no{background:rgba(20,12,17,.07);color:rgba(20,12,17,.6)}' +
    '.rep-vacio{padding:16px;border-radius:16px;background:var(--r-hoja);color:var(--r-tinta2);font-size:13.5px}' +
    '#rep-tira{position:fixed;left:16px;bottom:16px;z-index:2147482999;display:flex;align-items:center;gap:10px;background:#140C11;color:#F4ECE7;border-radius:999px;' +
      'padding:7px 7px 7px 16px;font:400 13px "Space Grotesk",system-ui,sans-serif;box-shadow:0 16px 34px -14px rgba(0,0,0,.6);animation:rep-entra .25s ease}' +
    '#rep-tira button{all:unset;cursor:pointer;background:#FF2D8A;color:#fff;font-weight:600;border-radius:999px;padding:7px 13px}' +
    '#rep-tira .cerrar{background:none;color:rgba(244,236,231,.6);padding:7px 8px}' +
    '@media (min-width:1101px){#rep-tira{left:100px;bottom:22px}}' +   // al lado del botón rosado de la barra, sin taparlo
    '@media (max-width:600px){#rep-velo{place-items:end center;padding:0}.rep-v{width:100%;border-radius:26px 26px 0 0;max-height:92vh;padding:20px 18px calc(20px + env(safe-area-inset-bottom,0px))}' +
      '.rep-dos{grid-template-columns:1fr}#rep-tira{right:16px;justify-content:space-between}}' +
    '@media (prefers-reduced-motion:reduce){.rep-v,#rep-tira{animation:none}}';
  function estilos() {
    if (document.getElementById('rep-estilo')) return;
    var s = document.createElement('style'); s.id = 'rep-estilo'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s);
  }

  /* ── La ventana ── */
  var velo = null, E = null;   // E: lo que se está llenando
  var ESTADOS = { recibido: 'Recibido', arreglando: 'Lo estamos arreglando', arreglado: 'Arreglado', planes: 'En planes', no: 'Por ahora no' };
  function abrir(tipo, nota) {
    var u = usuario();
    if (!u || !u.id) { return; }
    estilos(); cerrarTira();
    if (!velo) {
      velo = document.createElement('div'); velo.id = 'rep-velo'; velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true'); velo.setAttribute('aria-label', 'Reportar o sugerir');
      document.body.appendChild(velo);
      velo.addEventListener('mousedown', function (e) { if (e.target === velo) cerrar(); });
      velo.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } }, true);
      velo.addEventListener('click', clic);
      velo.addEventListener('input', function (e) { if (E && e.target.dataset.campo) E[e.target.dataset.campo] = e.target.value; });
      velo.addEventListener('change', archivo);
    }
    var p = pantalla();
    var ar = areaDe(p);
    E = { paso: tipo === 'error' || tipo === 'idea' ? tipo : 'elegir', texto: nota || '', para: '', urgente: null, area: AREAS.indexOf(ar) >= 0 ? ar : 'Otra', pantalla: p,
      foto: null, conFoto: true, fotoLista: false, archivo: null, enviando: false, msg: '' };
    velo.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    pintar();
    fotoPantalla().then(function (f) { if (!E) return; E.foto = f; E.fotoLista = true; if (E.paso === 'error' || E.paso === 'idea') pintar(); });
  }
  function cerrar() {
    if (!velo) return;
    velo.hidden = true; E = null; document.documentElement.style.overflow = '';
  }
  function cab(eti, titulo, atras) {
    return '<div class="rep-t"><div><span class="rep-eti">' + eti + '</span><h2>' + titulo + '</h2></div>' +
      '<div style="display:flex;gap:6px">' + (atras ? '<button type="button" class="rep-redondo" data-ir="elegir" aria-label="Volver">' + ICONOS.atras + '</button>' : '') +
      '<button type="button" class="rep-redondo" data-cerrar aria-label="Cerrar">' + ICONOS.x + '</button></div></div>';
  }
  function adjuntos() {
    var f = E.foto, err = errores().length;
    return '<div class="rep-campo"><span>Va con tu ' + (E.paso === 'error' ? 'reporte' : 'idea') + '</span><div class="rep-adj">' +
      '<div class="rep-a' + (E.conFoto ? '' : ' off') + '"><span class="min">' + (f ? '<img alt="" src="' + f + '">' : ICONOS.cam) + '</span><span><b>Foto de esta pantalla</b><small>' +
        (!E.fotoLista ? 'tomándola…' : f ? (E.conFoto ? 'la ve solo el equipo de Cherry' : 'no va') : 'no se pudo tomar: puedes adjuntar una') + '</small></span>' +
        (f ? '<button type="button" data-foto>' + (E.conFoto ? 'Quitar' : 'Ponerla') + '</button>' : '<span></span>') + '</div>' +
      (E.paso === 'error' ? '<div class="rep-a"><span class="min">' + ICONOS.pin + '</span><span><b>' + esc(E.pantalla) + '</b><small>dónde estabas' + (marca() ? ' · ' + esc(marca()) : '') + '</small></span><span></span></div>' +
        '<div class="rep-a"><span class="min">' + ICONOS.codigo + '</span><span><b>Detalles para el equipo</b><small>' + (err ? err + (err === 1 ? ' falla registrada' : ' fallas registradas') + ', ' : '') + 'tu navegador y la hora</small></span><span></span></div>' : '') +
      (E.archivo ? '<div class="rep-a"><span class="min">' + ICONOS.clip + '</span><span><b>' + esc(E.archivo.name) + '</b><small>' + Math.max(1, Math.round(E.archivo.size / 1024)) + ' KB</small></span><button type="button" data-sin-archivo>Quitar</button></div>' : '') +
      '</div></div>' +
      '<label class="rep-subir">' + ICONOS.clip + (E.archivo ? 'Cambiar el archivo' : 'Agregar otra foto o un video') + '<input type="file" accept="image/*,video/*" hidden data-archivo></label>';
  }
  function pintar() {
    if (!velo || !E) return;
    var h = '', P = E.paso;
    if (P === 'elegir') {
      h = cab('Ayúdanos a mejorar Cherry', '¿Qué quieres contarnos?') +
        '<div class="rep-dos"><button type="button" class="rep-camino err" data-ir="error"><i>' + ICONOS.falla + '</i><b>Algo no funciona</b><small>Un error, algo que se quedó cargando o que no hace lo que debería.</small></button>' +
        '<button type="button" class="rep-camino" data-ir="idea"><i>' + ICONOS.idea + '</i><b>Tengo una idea</b><small>Algo que te gustaría que Cherry hiciera o hiciera mejor.</small></button></div>' +
        '<button type="button" class="rep-mis" data-ir="mis">' + ICONOS.lista + 'Mis reportes' + (cuantos ? ' (' + cuantos + ')' : '') + (hayNovedad ? '<span class="rep-punto"></span>' : '') + '</button>' +
        '<p class="rep-promesa">Te respondemos en menos de 24 horas.</p>';
    } else if (P === 'error') {
      h = cab('Algo no funciona', '¿Qué pasó?', true) +
        '<div class="rep-campo"><span>Cuéntalo como se lo dirías a un amigo</span><textarea data-campo="texto" maxlength="4000" placeholder="Ej.: toqué «Programar» y se quedó cargando">' + esc(E.texto) + '</textarea></div>' +
        '<div class="rep-campo"><span>¿Te deja seguir?</span><div class="rep-chips"><button type="button" class="rep-chip rojo" data-urgente="1" aria-pressed="' + (E.urgente === true) + '">No puedo seguir</button>' +
          '<button type="button" class="rep-chip" data-urgente="0" aria-pressed="' + (E.urgente === false) + '">Puedo seguir, pero molesta</button></div></div>' +
        adjuntos() + (E.msg ? '<p class="rep-msg">' + esc(E.msg) + '</p>' : '') +
        '<button type="button" class="rep-boton" data-enviar' + (E.enviando ? ' disabled' : '') + '>' + (E.enviando ? 'Enviando…' : 'Enviar reporte') + '</button>' +
        '<p class="rep-promesa">Te respondemos en menos de 24 horas.</p>';
    } else if (P === 'idea') {
      h = cab('Tengo una idea', '¿Qué te gustaría que Cherry hiciera?', true) +
        '<div class="rep-campo"><span>Tu idea</span><textarea data-campo="texto" maxlength="4000" placeholder="Ej.: que el calendario me sugiera qué publicar los días vacíos">' + esc(E.texto) + '</textarea></div>' +
        '<div class="rep-campo"><span>¿Para qué te serviría? · opcional</span><textarea class="chico" data-campo="para" maxlength="2000" placeholder="Nos ayuda a entender qué te resolvería">' + esc(E.para) + '</textarea></div>' +
        '<div class="rep-campo"><span>¿De qué parte de Cherry?</span><div class="rep-chips">' + AREAS.map(function (a) {
          return '<button type="button" class="rep-chip" data-area="' + esc(a) + '" aria-pressed="' + (E.area === a) + '">' + esc(a) + '</button>'; }).join('') + '</div></div>' +
        adjuntos() + (E.msg ? '<p class="rep-msg">' + esc(E.msg) + '</p>' : '') +
        '<button type="button" class="rep-boton" data-enviar' + (E.enviando ? ' disabled' : '') + '>' + (E.enviando ? 'Enviando…' : 'Enviar idea') + '</button>' +
        '<p class="rep-promesa">Te respondemos en menos de 24 horas.</p>';
    } else if (P === 'listo') {
      h = '<div class="rep-v rep-listo" style="all:unset;display:grid;gap:12px;justify-items:center;text-align:center">' +
        '<span class="rep-ok">' + ICONOS.check + '</span><h2>' + (E.tipoEnviado === 'idea' ? '¡Gracias por la idea!' : '¡Recibido! Ya lo estamos mirando') + '</h2>' +
        '<span class="rep-num">' + (E.tipoEnviado === 'idea' ? 'Idea' : 'Reporte') + ' n.º ' + esc(E.numero) + '</span>' +
        '<p>' + (E.tipoEnviado === 'idea' ? 'Te respondemos en menos de 24 horas y te contamos aquí mismo si entra en los planes.'
          : 'Te respondemos en menos de 24 horas y te avisamos aquí mismo cuando esté arreglado. Mientras tanto, puedes seguir en lo que estabas.') + '</p></div>' +
        '<button type="button" class="rep-boton" data-cerrar>Seguir en Cherry</button><button type="button" class="rep-linea" data-ir="mis">Ver mis reportes</button>';
    } else if (P === 'mis') {
      h = cab('Reportar o sugerir', 'Mis reportes', true) + '<div class="rep-lista" id="rep-lista"><div class="rep-vacio">Trayendo tus reportes…</div></div>';
    }
    velo.innerHTML = '<div class="rep-v">' + h + '</div>';
    if (P === 'mis') pintarMis();
    var t = velo.querySelector('textarea');
    if (t && !t.value) setTimeout(function () { t.focus(); }, 30);
    else { var b = velo.querySelector('button'); if (b) setTimeout(function () { b.focus(); }, 30); }
  }
  function clic(e) {
    var el = e.target.closest('button, [data-ir]'); if (!el || !E) return;
    if (el.hasAttribute('data-cerrar')) { cerrar(); return; }
    if (el.dataset.ir) { E.paso = el.dataset.ir; E.msg = ''; pintar(); return; }
    if (el.dataset.urgente) { E.urgente = el.dataset.urgente === '1'; pintar(); return; }
    if (el.dataset.area) { E.area = el.dataset.area; pintar(); return; }
    if (el.hasAttribute('data-foto')) { E.conFoto = !E.conFoto; pintar(); return; }
    if (el.hasAttribute('data-sin-archivo')) { E.archivo = null; pintar(); return; }
    if (el.hasAttribute('data-enviar')) enviar();
  }
  function archivo(e) {
    if (!e.target.matches || !e.target.matches('[data-archivo]') || !E) return;
    var f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 50 * 1024 * 1024) { E.msg = 'Ese archivo pesa más de 50 MB: manda uno más corto.'; pintar(); return; }
    E.archivo = f; E.msg = ''; pintar();
  }
  function enviar() {
    var texto = String(E.texto || '').trim();
    if (texto.length < 3) { E.msg = E.paso === 'error' ? 'Cuéntanos qué pasó, aunque sea en una frase.' : 'Escribe tu idea, aunque sea en una frase.'; pintar(); return; }
    if (E.paso === 'error' && E.urgente === null) { E.msg = 'Dinos si te deja seguir: así sabemos qué tan rápido atenderlo.'; pintar(); return; }
    var u = usuario(), ts = Date.now(), tipo = E.paso;
    E.enviando = true; E.msg = ''; pintar();
    var foto = E.conFoto && E.foto ? subir(u.id, ts + '-pantalla.jpg', aBlob(E.foto), 'image/jpeg').catch(function () { return null; }) : Promise.resolve(null);
    var adj = E.archivo ? subir(u.id, ts + '-adjunto' + ((E.archivo.name.match(/\.[a-z0-9]{2,5}$/i) || [''])[0]).toLowerCase(), E.archivo, E.archivo.type).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([foto, adj]).then(function (r) {
      var fila = {
        tipo: tipo, texto: texto.slice(0, 4000), para_que: tipo === 'idea' && String(E.para || '').trim() ? String(E.para).trim().slice(0, 2000) : null,
        urgente: tipo === 'error' && E.urgente === true, area: (tipo === 'idea' ? E.area : areaDe(E.pantalla)).slice(0, 60),
        pantalla: (E.pantalla + ' · ' + location.pathname + location.search).slice(0, 300), marca: marca().slice(0, 80) || null,
        foto: r[0], adjunto: r[1], correo: (u.email || '').slice(0, 200) || null,
        tecnico: { errores: errores(), navegador: navigator.userAgent.slice(0, 300), idioma: navigator.language, pantalla: window.innerWidth + '×' + window.innerHeight,
          densidad: window.devicePixelRatio || 1, hora: new Date().toString().slice(0, 60), url: location.href.slice(0, 300) },
      };
      return rest('/rest/v1/reportes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
    }).then(function (r) {
      var fila = Array.isArray(r) ? r[0] : r;
      if (!fila || !fila.id) throw new Error('no llegó');
      if (!E) return;
      E.enviando = false; E.numero = fila.id; E.tipoEnviado = tipo; E.paso = 'listo'; pintar();
    }).catch(function () {
      if (!E) return;
      E.enviando = false; E.msg = 'No se pudo enviar. Revisa tu conexión y vuelve a intentarlo; si sigue, escríbenos a soporte@cherrysweet.app.'; pintar();
    });
  }

  /* ── Mis reportes y el punto amarillo de novedad ── */
  var hayNovedad = false, cuantos = 0;
  function llaveVisto() { var u = usuario(); return u && u.id ? 'cherry-rep-visto-' + u.id : null; }
  function pintarMis() {
    rest('/rest/v1/reportes?select=id,tipo,texto,estado,respuesta,respondido,creado,actualizado&user_id=eq.' + usuario().id + '&order=creado.desc&limit=40').then(function (fs) {
      var L = document.getElementById('rep-lista'); if (!L) return;
      fs = Array.isArray(fs) ? fs : []; cuantos = fs.length;
      L.innerHTML = fs.length ? fs.map(function (f) {
        return '<div class="rep-f"><b>' + esc(f.texto) + '</b><span class="rep-est rep-e-' + esc(f.estado) + '">' + esc(f.tipo === 'idea' && f.estado === 'arreglado' ? 'Ya está' : ESTADOS[f.estado] || f.estado) + '</span>' +
          '<small>' + (f.tipo === 'idea' ? 'Idea' : 'Reporte') + ' n.º ' + f.id + ' · ' + cuando(f.creado) + '</small>' +
          (f.respuesta ? '<span class="resp">' + esc(f.respuesta) + '</span>' : '') + '</div>';
      }).join('') : '<div class="rep-vacio">Todavía no has enviado reportes ni ideas. Cuando lo hagas, aquí ves en qué va cada uno.</div>';
      try { localStorage.setItem(llaveVisto(), new Date().toISOString()); } catch (e) { /* nada */ }
      novedad(false);
    }, function () { var L = document.getElementById('rep-lista'); if (L) L.innerHTML = '<div class="rep-vacio">No pude traer tus reportes. Revisa tu conexión.</div>'; });
  }
  function cuando(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (d < 2) return 'hace un momento'; if (d < 60) return 'hace ' + Math.round(d) + ' min'; if (d < 1440) return 'hace ' + Math.round(d / 60) + ' h';
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }
  function novedad(si) { hayNovedad = !!si; if (window.CherryLado && CherryLado.punto) CherryLado.punto('reportar', hayNovedad); }
  function mirarNovedades() {
    var u = usuario(); if (!u || !u.id) return;
    var visto = ''; try { visto = localStorage.getItem(llaveVisto()) || ''; } catch (e) { visto = ''; }
    rest('/rest/v1/reportes?select=id,estado,respondido,actualizado,creado&user_id=eq.' + u.id + '&order=actualizado.desc&limit=40').then(function (fs) {
      fs = Array.isArray(fs) ? fs : []; cuantos = fs.length;
      var hay = fs.some(function (f) { return (f.respondido || f.estado !== 'recibido') && (!visto || f.actualizado > visto); });
      novedad(hay);
    }).catch(function () { /* sin tabla todavía o sin conexión: nada */ });
    // el administrador: en la Consola, un número rojo con los reportes que todavía no ha mirado
    try { if (localStorage.getItem('cherry-admin-' + u.id) !== '1') return; } catch (e) { return; }
    rest('/rest/v1/reportes?select=id&visto_admin=is.null&limit=99').then(function (fs) {
      if (window.CherryLado && CherryLado.punto) CherryLado.punto('consola', Array.isArray(fs) ? fs.length : 0);
    }).catch(function () { /* nada */ });
  }
  setTimeout(mirarNovedades, 4000);

  /* ── La tira «¿Algo falló?» (como mucho una vez cada 2 minutos) ── */
  function avisarFalla() {
    if (!document.body || (velo && !velo.hidden) || Date.now() - ultimoAviso < 120000) return;
    var u = usuario(); if (!u || !u.id) return;
    ultimoAviso = Date.now(); estilos();
    var t = document.getElementById('rep-tira');
    if (!t) { t = document.createElement('div'); t.id = 'rep-tira'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = '<span>¿Algo falló?</span><button type="button" data-rep-tira>Repórtalo</button><button type="button" class="cerrar" aria-label="Cerrar" data-rep-tira-x>' + ICONOS.x.replace('<svg', '<svg style="width:14px;height:14px"') + '</button>';
    t.querySelector('[data-rep-tira]').onclick = function () { abrir('error'); };
    t.querySelector('[data-rep-tira-x]').onclick = cerrarTira;
    clearTimeout(avisarFalla.t); avisarFalla.t = setTimeout(cerrarTira, 10000);
  }
  function cerrarTira() { var t = document.getElementById('rep-tira'); if (t) t.remove(); }

  // el botón de la barra (y cualquier [data-reportar] de la página)
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-reportar]');
    if (!b) return;
    e.preventDefault(); abrir(b.getAttribute('data-reportar') || '');
  });

  window.CherryReportes = { abrir: abrir, errores: errores };
})();

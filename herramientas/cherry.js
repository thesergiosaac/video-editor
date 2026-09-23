/* cherry.js — lo común de las herramientas del inicio (Guiones, Storyboard, Carruseles, Calendario, Identidad de marca).
 * 19-sep-2026 (aprobado por Sergio: «te apruebo todo»).
 *
 * Cada herramienta es su propia página (herramientas/<nombre>.html) y usa la MISMA sesión del Editor Pro: la que guarda
 * js/api.js en este navegador (llave «carrete-sesion»). Sin sesión, se va al inicio a entrar y después vuelve.
 * Lo de cada persona se guarda en su cuenta (tabla herramientas_datos: un documento por herramienta; solo la dueña lo ve)
 * y una copia en este navegador para abrir al instante. La IA es la función «herramientas» del servidor.
 */
(function () {
  'use strict';
  var URL = 'https://xsptcepijtnmowqauyxw.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ';
  var LLAVE = 'carrete-sesion';
  var S3 = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/';
  var CDN = 'https://d2b7db4md5k57t.cloudfront.net/';

  /* ── Sesión (la misma del Editor Pro) ── */
  var ses = null;
  try { ses = JSON.parse(localStorage.getItem(LLAVE) || 'null'); } catch (e) { ses = null; }
  function hayUsuario() { return !!(ses && ses.token && ses.user && ses.user.id); }
  function irAEntrar() {
    var aqui = location.pathname.split('/').pop() || '';
    location.replace('../index.html?volver=' + encodeURIComponent('herramientas/' + aqui + location.search));
  }
  if (!hayUsuario()) { irAEntrar(); }

  function guardarSesion(d) {
    ses = { user: d.user || (ses && ses.user), token: d.access_token, refresh: d.refresh_token,
            expiresAt: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000 };
    try { localStorage.setItem(LLAVE, JSON.stringify(ses)); } catch (e) {}
  }
  var refrescando = null;
  function refrescar() {
    if (!ses || !ses.refresh) return Promise.resolve(false);
    if (!refrescando) {
      refrescando = fetch(URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: ses.refresh }),
      }).then(function (r) { return r.json().then(function (d) { if (r.ok && d.access_token) { guardarSesion(d); return true; } return false; }); })
        .catch(function () { return null; })
        .then(function (v) { refrescando = null; return v; });
    }
    return refrescando;
  }
  function tokenVigente() {
    if (ses && ses.token && ses.expiresAt - Date.now() > 60000) return Promise.resolve(true);
    return refrescar();
  }
  function rest(ruta, opts, reintento) {
    opts = opts || {};
    return tokenVigente().then(function () {
      var h = Object.assign({ apikey: ANON, 'Content-Type': 'application/json' }, ses && ses.token ? { Authorization: 'Bearer ' + ses.token } : {}, opts.headers || {});
      return fetch(URL + ruta, Object.assign({}, opts, { headers: h }));
    }).then(function (r) {
      if (r.status === 401 && reintento !== false) {
        return refrescar().then(function (ok) { if (ok === true) return rest(ruta, opts, false); if (ok === false) irAEntrar(); throw new Error('Tu sesión se cerró.'); });
      }
      if (!r.ok) return r.text().then(function (t) { throw new Error('El servidor respondió ' + r.status + ': ' + t.slice(0, 160)); });
      return r.status === 204 ? null : r.json().catch(function () { return null; });
    });
  }
  function funcion(nombre, cuerpo, reintento) {
    return tokenVigente().then(function () {
      return fetch(URL + '/functions/v1/' + nombre, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (ses && ses.token) }, body: JSON.stringify(cuerpo),
      });
    }).then(function (r) {
      if (r.status === 401 && reintento !== false) return refrescar().then(function (ok) { if (ok === true) return funcion(nombre, cuerpo, false); if (ok === false) irAEntrar(); throw new Error('Tu sesión se cerró.'); });
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || (d && d.error)) throw new Error((d && d.error) || 'El servidor respondió ' + r.status); return d; });
    });
  }

  /* Igual que funcion(), pero mandando un archivo (FormData) en vez de JSON: lo usa el Laboratorio
     para transcribir un video de referencia. No se pone Content-Type a mano — lo pone el navegador
     con su frontera, y si se pisa el servidor no sabe separar las partes. */
  function funcionArchivo(nombre, forma, reintento) {
    return tokenVigente().then(function () {
      return fetch(URL + '/functions/v1/' + nombre, {
        method: 'POST', headers: { Authorization: 'Bearer ' + (ses && ses.token) }, body: forma,
      });
    }).then(function (r) {
      if (r.status === 401 && reintento !== false) return refrescar().then(function (ok) { if (ok === true) return funcionArchivo(nombre, forma, false); if (ok === false) irAEntrar(); throw new Error('Tu sesión se cerró.'); });
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || (d && d.error)) throw new Error((d && d.error) || 'El servidor respondió ' + r.status); return d; });
    });
  }

  /* ── Documentos de cada herramienta ── */
  var guardando = {}, pendiente = {}, estadoGuardado = {}, leyendo = {};
  var copia = function (h) { return 'cherry-herr-' + h + '-' + (ses && ses.user ? ses.user.id : 'x'); };
  function copiaLocal(h) { try { return JSON.parse(localStorage.getItem(copia(h)) || 'null'); } catch (e) { return null; } }
  // Mientras se lee lo de la cuenta no se guarda nada: en un equipo nuevo la página arranca vacía y no debe pisar lo guardado.
  // Si la cuenta ya tenía datos, lo que se quiso guardar antes de leer se descarta (la página se queda con lo de la cuenta).
  function cargar(h) {
    leyendo[h] = true;
    return rest('/rest/v1/herramientas_datos?select=datos,updated_at&herramienta=eq.' + h + '&user_id=eq.' + ses.user.id)
      .then(function (filas) {
        var d = Array.isArray(filas) && filas.length ? filas[0].datos : null;
        if (d) { try { localStorage.setItem(copia(h), JSON.stringify(d)); } catch (e) {} }
        leyendo[h] = false;
        if (pendiente[h]) { if (d) pendiente[h] = null; else programar(h); }
        return d;
      }, function (e) { leyendo[h] = false; if (pendiente[h]) programar(h); throw e; });
  }
  // guarda en la cuenta (de a una a la vez; si llegan cambios mientras tanto, se guarda lo último)
  function guardar(h, datos, avisar) {
    try { localStorage.setItem(copia(h), JSON.stringify(datos)); } catch (e) {}
    pendiente[h] = { datos: datos, avisar: avisar };
    if (!guardando[h] && !leyendo[h]) programar(h);
  }
  function programar(h) {
    clearTimeout(guardar['t' + h]);
    guardar['t' + h] = setTimeout(function () { vaciar(h); }, 600);
  }
  function vaciar(h) {
    var p = pendiente[h]; if (!p) return;
    pendiente[h] = null; guardando[h] = true;
    if (p.avisar) p.avisar('guardando');
    rest('/rest/v1/herramientas_datos?on_conflict=user_id,herramienta', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: ses.user.id, herramienta: h, datos: p.datos, updated_at: new Date().toISOString() }),
    }).then(function () { estadoGuardado[h] = 'ok'; if (p.avisar) p.avisar('ok'); },
      function (e) { estadoGuardado[h] = 'error'; console.warn('[Cherry] no se guardó ' + h + ':', e.message); if (p.avisar) p.avisar('error', e.message); })
      .then(function () { guardando[h] = false; if (pendiente[h]) vaciar(h); });
  }
  // antes de salir de la página, lo pendiente se manda de una vez
  window.addEventListener('pagehide', function () {
    Object.keys(pendiente).forEach(function (h) {
      var p = pendiente[h]; if (!p || !ses || leyendo[h]) return;
      try {
        fetch(URL + '/rest/v1/herramientas_datos?on_conflict=user_id,herramienta', {
          method: 'POST', keepalive: true,
          headers: { apikey: ANON, 'Content-Type': 'application/json', Authorization: 'Bearer ' + ses.token, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: ses.user.id, herramienta: h, datos: p.datos, updated_at: new Date().toISOString() }),
        });
      } catch (e) {}
    });
  });

  /* ── La marca (colores, letras, tono y frases): la usan todas ── */
  var marcaP = null;
  function marca() { if (!marcaP) marcaP = cargar('marca').catch(function () { return copiaLocal('marca'); }); return marcaP; }
  function voz(m) {
    if (!m) return null;
    return { tono: m.tono || null, frases: Array.isArray(m.frases) ? m.frases.map(function (f) { return { tipo: f.tipo, texto: f.texto }; }) : [] };
  }

  /* ── IA (función «herramientas» del servidor) ── */
  function ia(accion, datos) {
    return marca().then(function (m) {
      var cuerpo = Object.assign({ accion: accion }, datos || {});
      if (!cuerpo.voz && m && (!m.usos || m.usos.guiones !== false)) cuerpo.voz = voz(m);
      return funcion('herramientas', cuerpo);
    });
  }

  /* ── Proyectos del Editor Pro ── */
  function urlVideo(u) { return typeof u === 'string' && u.indexOf(S3) === 0 ? CDN + u.slice(S3.length) : u; }
  // los proyectos con su último video listo (para Carruseles «desde un video» y el Calendario)
  function videosListos() {
    return rest('/rest/v1/projects?select=id,title,created_at&user_id=eq.' + ses.user.id + '&order=created_at.desc&limit=40').then(function (ps) {
      if (!Array.isArray(ps) || !ps.length) return [];
      var ids = ps.map(function (p) { return p.id; }).join(',');
      return rest('/rest/v1/renders?select=id,project_id,status,created_at,layer2_url,output_url,duraciones_reales&project_id=in.(' + ids + ')&status=eq.done&order=created_at.desc&limit=200')
        .then(function (rs) {
          var ultimo = {};
          (Array.isArray(rs) ? rs : []).forEach(function (r) { if (!ultimo[r.project_id]) ultimo[r.project_id] = r; });
          return ps.filter(function (p) { return ultimo[p.id]; }).map(function (p) {
            var r = ultimo[p.id], dur = Array.isArray(r.duraciones_reales) ? r.duraciones_reales.reduce(function (a, b) { return a + Number(b || 0); }, 0) : 0;
            return { id: p.id, titulo: p.title || 'Video sin nombre', creado: p.created_at, render: r.id, video: urlVideo(r.layer2_url || r.output_url), dur: dur, hecho: r.created_at };
          });
        });
    });
  }
  // lo que se dice en un video (las palabras de su último render)
  function transcripcion(renderId) {
    return rest('/rest/v1/renders?select=subtitle_phrases,clean_words_json&id=eq.' + renderId).then(function (f) {
      var r = Array.isArray(f) && f[0]; if (!r) return '';
      var pal = (r.subtitle_phrases && r.subtitle_phrases.palabras) || r.clean_words_json || [];
      return (Array.isArray(pal) ? pal : []).map(function (w) { return w.word || w.text || ''; }).join(' ').replace(/\s+/g, ' ').trim();
    });
  }
  // un proyecto nuevo con su guion, y abrirlo en el Editor Pro
  function proyectoConGuion(titulo, texto) {
    return rest('/rest/v1/projects', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: ses.user.id, title: String(titulo || 'Video nuevo').slice(0, 120), status: 'draft' }),
    }).then(function (f) {
      var p = Array.isArray(f) ? f[0] : f;
      if (!p || !p.id) throw new Error('No se pudo crear el proyecto');
      return rest('/rest/v1/scripts', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ project_id: p.id, content: String(texto || '') }),
      }).then(function () { return p.id; });
    });
  }
  function abrirEditor(proyectoId) { location.href = '../index.html' + (proyectoId ? '?abrir=' + encodeURIComponent(proyectoId) : ''); }
  function irA(herramienta, consulta) { location.href = herramienta + '.html' + (consulta ? '?' + consulta : ''); }

  /* ── «Mis colores» (los usa el editor en subtítulos y gráficos) ── */
  function misColores() {
    return rest('/rest/v1/preferencias_usuario?select=colores&user_id=eq.' + ses.user.id)
      .then(function (f) { return Array.isArray(f) && f[0] && Array.isArray(f[0].colores) ? f[0].colores : []; }).catch(function () { return []; });
  }
  function guardarMisColores(lista) {
    var limpia = []; (lista || []).forEach(function (c) { c = String(c || '').toUpperCase(); if (/^#[0-9A-F]{6}$/.test(c) && limpia.indexOf(c) < 0) limpia.push(c); });
    return rest('/rest/v1/preferencias_usuario?on_conflict=user_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: ses.user.id, colores: limpia.slice(0, 32), updated_at: new Date().toISOString() }),
    });
  }

  /* ── Barra de arriba: créditos, inicial del usuario, volver al inicio ── */
  function perfil() {
    return rest('/rest/v1/profiles?select=full_name,credits_remaining,plan&id=eq.' + ses.user.id)
      .then(function (f) { return Array.isArray(f) && f[0] ? f[0] : {}; }).catch(function () { return {}; });
  }
  function barra() {
    document.querySelectorAll('[data-ir-inicio]').forEach(function (a) {
      a.setAttribute('href', '../index.html');
      a.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); location.href = '../index.html'; }, true);
    });
    var correo = ses && ses.user ? ses.user.email || '' : '';
    perfil().then(function (p) {
      var nombre = String(p.full_name || correo || 'C').trim();
      document.querySelectorAll('[data-avatar]').forEach(function (el) { el.textContent = nombre.charAt(0).toUpperCase(); el.title = p.full_name || correo; });
      if (p.credits_remaining != null) document.querySelectorAll('[data-creditos]').forEach(function (el) { el.innerHTML = '<b>◆</b> ' + p.credits_remaining + ' créditos'; });
    });
  }

  window.CherryApp = {
    usuario: function () { return ses && ses.user; }, hayUsuario: hayUsuario,
    cargar: cargar, guardar: guardar, copiaLocal: copiaLocal, marca: marca, ia: ia,
    guardarMarca: function (m) { marcaP = Promise.resolve(m); guardar('marca', m); },
    videosListos: videosListos, transcripcion: transcripcion, proyectoConGuion: proyectoConGuion,
    abrirEditor: abrirEditor, irA: irA, misColores: misColores, guardarMisColores: guardarMisColores,
    perfil: perfil, barra: barra, rest: rest, urlVideo: urlVideo, funcionArchivo: funcionArchivo,
    /* la direccion del proyecto: las firmas del almacenamiento vuelven relativas */
    base: function () { return URL; },
    /* llamar a UNA funcion por su nombre. `ia()` no sirve para esto: esa manda siempre a
       `herramientas` con una accion dentro. */
    funcion: funcion,
  };
})();

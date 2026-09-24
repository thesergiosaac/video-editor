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
    location.replace('../app.html?volver=' + encodeURIComponent('herramientas/' + aqui + location.search));
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
  var marcaP = null, marcaDoc = null, marcaId = '';
  /* La identidad es POR MARCA. El documento guarda `{ porMarca: { <id>: {...} } }` y aquí se
     devuelve la de la marca activa, para que quien la pida no tenga que enterarse.

     ⚠️ La marca activa vive dentro del documento de `laboratorio`, que es donde la puso
     `cuenta.js`. Por eso se lee también. Feo, y anotado: el día que las marcas tengan su
     propia herramienta esto se cae solo. */
  function idMarcaActiva() {
    if (window.CherryCuenta && CherryCuenta.activa && CherryCuenta.activa()) return Promise.resolve(CherryCuenta.activa());
    return cargar('laboratorio')
      .catch(function () { return copiaLocal('laboratorio'); })
      .then(function (lab) { return (lab && lab.activa) || 'principal'; })
      .catch(function () { return 'principal'; });
  }

  function marca() {
    if (!marcaP) {
      marcaP = Promise.all([
        cargar('marca').catch(function () { return copiaLocal('marca'); }),
        idMarcaActiva(),
      ]).then(function (r) {
        marcaDoc = enPorMarca(r[0]);
        marcaId = r[1];
        return marcaDoc.porMarca[marcaId] || (marcaDoc.porMarca[marcaId] = {});
      });
    }
    return marcaP;
  }

  /* Lo que se guardó cuando la identidad era una sola para todo: pasa a ser la de la primera
     marca. Hoy no hay ninguna guardada, pero una copia vieja en un navegador sí puede haberla. */
  function enPorMarca(d) {
    d = d && typeof d === 'object' ? d : {};
    if (d.porMarca && typeof d.porMarca === 'object') return d;
    var viejo = {};
    Object.keys(d).forEach(function (k) { viejo[k] = d[k]; });
    return { porMarca: Object.keys(viejo).length ? { principal: viejo } : {} };
  }
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
  /* ── Un archivo publico, para publicarlo y tirarlo ─────────────────────────────
     Instagram descarga el video desde SUS servidores, asi que la direccion tiene que ser
     publica. Va al cubo `publicar`, que es publico para leer y donde cada quien solo escribe
     en su carpeta.

     ⚠️ NO va a S3 aunque sea donde viven los videos: medido el 23-sep, las credenciales de
     Cherry solo pueden escribir en `uploads/`, y `uploads/` no se lee sin credenciales. */
  function subirPublico(archivo, alAvanzar) {
    if (!hayUsuario()) return Promise.reject(new Error('Entra otra vez: se perdio la sesion.'));
    var punto = (archivo.name || '').lastIndexOf('.');
    var ext = punto > 0 ? archivo.name.slice(punto + 1).toLowerCase() : 'mp4';
    var ruta = ses.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

    return tokenVigente().then(function () {
      return new Promise(function (ok, mal) {
        var x = new XMLHttpRequest();
        x.open('POST', URL + '/storage/v1/object/publicar/' + ruta);
        x.setRequestHeader('apikey', ANON);
        x.setRequestHeader('Authorization', 'Bearer ' + ses.token);
        x.setRequestHeader('Content-Type', archivo.type || 'video/mp4');
        if (alAvanzar) x.upload.onprogress = function (e) {
          if (e.lengthComputable) alAvanzar(Math.round(e.loaded * 100 / e.total));
        };
        x.onload = function () {
          if (x.status >= 200 && x.status < 300) {
            ok({ ruta: ruta, url: URL + '/storage/v1/object/public/publicar/' + ruta });
          } else {
            mal(new Error('No se pudo subir (' + x.status + '): ' + String(x.responseText).slice(0, 160)));
          }
        };
        x.onerror = function () { mal(new Error('Se corto la subida.')); };
        x.send(archivo);
      });
    });
  }

  /* ── Un video del computador, de cualquier tamaño ────────────────────────────
     Sube a S3 por trozos (sin tope) y deja que Lambda lo convierta: el resultado queda en
     `clips/`, que es la unica carpeta publica donde Cherry puede escribir, y es de donde
     Instagram se lo va a descargar.

     ⚠️ El almacenamiento de Supabase NO sirve para esto: su tope de 50 MB es global del
     proyecto y no se esquiva por trozos ni por el protocolo S3. */
  var TROZO = 8 * 1024 * 1024;
  var CLIPS_PUBLICO = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/';

  function proyectoParaSubidas() {
    return rest('/rest/v1/projects?select=id&user_id=eq.' + ses.user.id +
                '&title=eq.' + encodeURIComponent('Subidas para publicar') + '&limit=1')
      .then(function (ps) {
        if (Array.isArray(ps) && ps.length) return ps[0].id;
        return rest('/rest/v1/projects', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ user_id: ses.user.id, title: 'Subidas para publicar',
                                 status: 'draft' }),
        }).then(function (r) { return r && r[0] && r[0].id; });
      });
  }

  function ponerTrozo(url, trozo, alAvanzar) {
    /* Cuatro intentos: un corte momentaneo de red no puede tirar una subida de 143 MB. */
    var intento = 0;
    var vaDeNuevo = function () {
      return new Promise(function (ok, mal) {
        var x = new XMLHttpRequest();
        x.open('PUT', url);
        x.timeout = 120000;
        if (alAvanzar) x.upload.onprogress = function (e) {
          if (e.lengthComputable) alAvanzar(e.loaded);
        };
        x.onload = function () {
          if (x.status === 200) ok(x.getResponseHeader('ETag') || '');
          else mal(new Error('El trozo no subio (' + x.status + ').'));
        };
        x.onerror = function () { mal(new Error('Se corto la red subiendo un trozo.')); };
        x.ontimeout = function () { mal(new Error('Un trozo tardo demasiado.')); };
        x.send(trozo);
      }).catch(function (e) {
        intento++;
        if (intento >= 4) throw e;
        if (alAvanzar) alAvanzar(0);
        return new Promise(function (r) { setTimeout(r, intento * 1000); }).then(vaDeNuevo);
      });
    };
    return vaDeNuevo();
  }

  function subirGrande(archivo, alAvanzar, alDecir) {
    if (!hayUsuario()) return Promise.reject(new Error('Entra otra vez: se perdio la sesion.'));
    var proyecto, clipId, s3Key;
    var decir = function (t) { if (alDecir) alDecir(t); };

    return proyectoParaSubidas().then(function (p) {
      proyecto = p;
      if (!proyecto) throw new Error('No pude preparar la subida.');
      decir('Subiendo\u2026');

      if (archivo.size < TROZO) {
        return funcion('get-upload-url', {
          file_name: archivo.name, file_type: archivo.type || 'video/mp4', project_id: proyecto,
        }).then(function (r) {
          clipId = r.clip_id; s3Key = r.s3_key;
          return ponerTrozo(r.upload_url, archivo, function (b) {
            if (alAvanzar) alAvanzar(Math.round(b * 100 / archivo.size));
          });
        });
      }

      var partes = Math.ceil(archivo.size / TROZO);
      return funcion('multipart-upload', {
        action: 'initiate', file_name: archivo.name, file_type: archivo.type || 'video/mp4',
        project_id: proyecto, num_parts: partes,
      }).then(function (ini) {
        if (!ini.clip_id || !ini.upload_id) throw new Error('No se pudo empezar la subida.');
        clipId = ini.clip_id; s3Key = ini.s3_key;

        var llevan = new Array(partes).fill(0);
        var sellos = [];
        var cola = ini.part_urls.slice();

        var uno = function (p) {
          var desde = (p.part_number - 1) * TROZO;
          return ponerTrozo(p.url, archivo.slice(desde, desde + TROZO), function (b) {
            llevan[p.part_number - 1] = b;
            var total = llevan.reduce(function (a, c) { return a + c; }, 0);
            if (alAvanzar) alAvanzar(Math.min(99, Math.round(total * 100 / archivo.size)));
          }).then(function (etag) {
            llevan[p.part_number - 1] = Math.min(TROZO, archivo.size - desde);
            sellos.push({ part_number: p.part_number, etag: etag });
          });
        };

        /* Cinco a la vez, como en el editor: mas no va mas rapido y se cae mas. */
        var obreros = [];
        for (var w = 0; w < Math.min(5, cola.length); w++) {
          obreros.push((function seguir() {
            return cola.length ? uno(cola.shift()).then(seguir) : Promise.resolve();
          })());
        }
        return Promise.all(obreros).then(function () {
          sellos.sort(function (a, b) { return a.part_number - b.part_number; });
          /* Si esto falla, el archivo YA esta en S3: se sigue igual. */
          return funcion('multipart-upload', {
            action: 'complete', clip_id: clipId, s3_key: s3Key,
            upload_id: ini.upload_id, project_id: proyecto, parts: sellos,
          }).catch(function () {});
        });
      });
    }).then(function () {
      if (alAvanzar) alAvanzar(100);
      decir('Convirtiendo el video\u2026');
      return funcion('process-upload', {
        storage_path: s3Key, clip_id: clipId, project_id: proyecto,
      }).catch(function () {});
    }).then(function () {
      /* A esperar a que Lambda lo deje en `clips/`, que es la direccion publica. */
      var desde = Date.now();
      var mirar = function () {
        return rest('/rest/v1/clips?select=status,mp4_path&id=eq.' + clipId).then(function (cs) {
          var c = Array.isArray(cs) && cs[0];
          if (c && c.status === 'error') throw new Error('Ese video no se pudo convertir.');
          if (c && c.mp4_path) {
            return { url: CLIPS_PUBLICO + encodeURI(c.mp4_path), clip: clipId, proyecto: proyecto };
          }
          if (Date.now() - desde > 900000) throw new Error('Esta tardando demasiado. Recarga y mira si aparece.');
          decir('Convirtiendo el video\u2026');
          return new Promise(function (r) { setTimeout(r, 4000); }).then(mirar);
        });
      };
      return mirar();
    });
  }

  function videosListos() {
    return rest('/rest/v1/projects?select=id,title,created_at&user_id=eq.' + ses.user.id + '&order=created_at.desc&limit=40').then(function (ps) {
      if (!Array.isArray(ps) || !ps.length) return [];
      var ids = ps.map(function (p) { return p.id; }).join(',');
      /* ⚠️ La carátula sale del primer clip, no del render: `renders.preview_url` está vacío en
         todos. `clips.thumbnail_url` la deja Lambda al convertir, y es pública. */
      var conRenders = rest('/rest/v1/renders?select=id,project_id,status,created_at,layer2_url,output_url,duraciones_reales,output_original_url&project_id=in.(' + ids + ')&status=eq.done&order=created_at.desc&limit=200');
      var conTapas = rest('/rest/v1/clips?select=project_id,thumbnail_url,order_index&project_id=in.(' + ids + ')&thumbnail_url=not.is.null&order=order_index.asc&limit=300')
        .catch(function () { return []; });

      return Promise.all([conRenders, conTapas]).then(function (par) {
        var rs = par[0], tapas = {};
        (Array.isArray(par[1]) ? par[1] : []).forEach(function (c) {
          if (!tapas[c.project_id]) tapas[c.project_id] = c.thumbnail_url;
        });
        var ultimo = {};
        (Array.isArray(rs) ? rs : []).forEach(function (r) { if (!ultimo[r.project_id]) ultimo[r.project_id] = r; });
        return ps.filter(function (p) { return ultimo[p.id]; }).map(function (p) {
          var r = ultimo[p.id], dur = Array.isArray(r.duraciones_reales) ? r.duraciones_reales.reduce(function (a, b) { return a + Number(b || 0); }, 0) : 0;
          return { id: p.id, titulo: p.title || 'Video sin nombre', creado: p.created_at, render: r.id,
                   video: urlVideo(r.layer2_url || r.output_url), tapa: tapas[p.id] || '',
                   /* (24-sep) ¿ya existe el master? Si no, el calendario lo pide antes de publicar */
                   master: !!r.output_original_url,
                   dur: dur, hecho: r.created_at };
        });
      });
    });
  }
  /* (24-sep) Pedir ESE video en calidad original: el servidor lo vuelve a cortar del archivo tal como se
     grabó, con las mismas frases y el mismo look. Devuelve el render nuevo; `esperarMaster` lo sigue. */
  function exportarOriginal(projectId, renderId) {
    return funcion('orchestrate', { project_id: projectId, reusar_render: renderId, calidad: 'original' });
  }
  function esperarMaster(renderId, alAvanzar) {
    var t0 = Date.now();
    return new Promise(function (ok, mal) {
      (function mirar() {
        rest('/rest/v1/renders?select=status,output_url,output_original_url,error_message&id=eq.' + renderId).then(function (f) {
          var r = Array.isArray(f) && f[0];
          if (r && r.status === 'error') return mal(new Error(r.error_message || 'No se pudo hacer la calidad original.'));
          if (r && r.status === 'done' && r.output_url) return ok({ video: urlVideo(r.output_url), original: urlVideo(r.output_original_url || r.output_url) });
          if (Date.now() - t0 > 20 * 60000) return mal(new Error('La calidad original está tardando demasiado.'));
          if (alAvanzar) alAvanzar(Math.round((Date.now() - t0) / 1000));
          setTimeout(mirar, 5000);
        }).catch(function () { setTimeout(mirar, 8000); });
      })();
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
  function abrirEditor(proyectoId) { location.href = '../app.html' + (proyectoId ? '?abrir=' + encodeURIComponent(proyectoId) : ''); }
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
      a.setAttribute('href', '../app.html');
      a.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); location.href = '../app.html'; }, true);
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
    /* Guarda la identidad DE LA MARCA ACTIVA, sin tocar las de las demás. */
    guardarMarca: function (m) {
      marcaP = Promise.resolve(m);
      if (!marcaDoc) marcaDoc = { porMarca: {} };
      marcaDoc.porMarca[marcaId || 'principal'] = m;
      guardar('marca', marcaDoc);
    },
    /* Para que una herramienta pueda soltar la identidad cacheada al cambiar de marca. */
    olvidarMarca: function () { marcaP = null; },
    videosListos: videosListos, exportarOriginal: exportarOriginal, esperarMaster: esperarMaster, subirPublico: subirPublico, subirGrande: subirGrande,
    transcripcion: transcripcion, proyectoConGuion: proyectoConGuion,
    abrirEditor: abrirEditor, irA: irA, misColores: misColores, guardarMisColores: guardarMisColores,
    perfil: perfil, barra: barra, rest: rest, urlVideo: urlVideo, funcionArchivo: funcionArchivo,
    /* la direccion del proyecto: las firmas del almacenamiento vuelven relativas */
    base: function () { return URL; },
    /* llamar a UNA funcion por su nombre. `ia()` no sirve para esto: esa manda siempre a
       `herramientas` con una accion dentro. */
    funcion: funcion,
  };
})();

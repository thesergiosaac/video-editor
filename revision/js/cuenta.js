/* cuenta.js — el menú de la foto, arriba a la derecha, en TODAS las herramientas (22-sep-2026)
 *
 * Desde aquí se cambia de MARCA, se crea una nueva y se rellena su perfil. Una marca es una cuenta
 * de redes con lo suyo aparte: sus videos, su baúl, sus fichas y sus planes. Al cambiar de marca no
 * cambia la interfaz — cambian los datos. Los videos de Cobra no se planean con el baúl de
 * sergiosaac.co: un gancho que retiene en una cuenta no retiene en otra.
 *
 * Todo vive en el documento del Laboratorio (`herramientas_datos` › laboratorio), que es donde ya
 * estaban las cuentas. Si el Laboratorio está abierto tiene ese documento en memoria, así que en
 * vez de escribir por detrás —y pisarnos— usa el puente que él registra con `CherryApp.marcas()`.
 *
 * Los estilos van aquí dentro a propósito: las seis herramientas tienen su propio CSS y este menú
 * tiene que verse igual en todas.
 */
(function () {
  var HERR = 'laboratorio';

  /* ── Los dos mundos ──
     Las herramientas traen CherryApp; el inicio (el Editor Pro) trae CARRETE. El menú es el mismo
     en los dos, así que aquí se traduce lo poco que cambia: cómo se lee el documento, cómo se
     guarda, quién es el usuario y qué sabe hacer la página. */
  var App = window.CherryApp || null;
  var C = window.CARRETE || null;
  if (!App && !C) return;
  var enInicio = !App;

  /* La copia que la herramienta dejo en este navegador. Se pinta al instante, sin esperar a
     nadie, y es la misma que usa la tarjeta del inicio. */
  function copiaLocal() {
    var u = usuario();
    if (!u || !u.id) return null;
    try { return JSON.parse(localStorage.getItem('cherry-herr-' + HERR + '-' + u.id) || 'null'); }
    catch (e) { return null; }
  }
  function cargarDoc() {
    if (App) return App.cargar(HERR);
    if (C.api && C.api.getDatosHerramienta) return C.api.getDatosHerramienta(HERR);
    return Promise.resolve(null);
  }
  function usuario() {
    if (App && App.usuario) return App.usuario();
    return C && C.session ? C.session.user : null;
  }
  function inicio() { return enInicio ? 'app.html' : '../app.html'; }

  var puente = null;          // lo registra el Laboratorio; en las demás páginas se queda en null
  var doc = null;             // el documento, cuando toca leerlo aquí
  var abierto = false;
  var extra = [];             // opciones que añade la página (Mis proyectos, Cerrar sesión…)

  /* Un aviso corto abajo, con el diseño de Cherry. Los diálogos del navegador no se usan: se ven
     de otro producto y no se pueden poner bonitos. */
  var tiraT = 0;
  function tira(txt) {
    var el = document.querySelector('.ch-tira');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ch-tira';
      document.body.appendChild(el);
    }
    el.textContent = txt;
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(tiraT);
    tiraT = setTimeout(function () { el.classList.remove('on'); }, 6000);
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Los datos ── */
  function lista() { return puente ? puente.lista() : ((doc && doc.cuentas) || []); }
  function activa() { return puente ? puente.activa() : (doc && doc.activa) || ''; }
  /* (25-sep) TODO va separado por marca. La marca activa se cuenta IGUAL en todas partes (aquí, cherry.js, api.js y la
     base, `marca_activa_de`): la `activa` si existe en la lista; si no, la primera; si no hay lista, «principal».
     Vacío = todavía no llegó el documento. */
  function marcaNormal() {
    if (!puente && !doc) return '';
    var cs = lista() || [], a = activa();
    if (a && cs.some(function (x) { return x && x.id === a; })) return a;
    return cs[0] && cs[0].id ? cs[0].id : 'principal';
  }
  // lo que no tiene marca (algo viejo) es de la primera
  function marcaDefecto() {
    if (!puente && !doc) return '';
    var cs = lista() || [];
    return cs[0] && cs[0].id ? cs[0].id : 'principal';
  }
  /* ── El perfil de verdad, de Instagram ────────────────────────────────────────
     La foto, el usuario, la bio y los números se escribían a mano porque la API de Instagram no
     estaba. Ya está. Se piden una vez al arrancar y se SUPERPONEN sobre la marca, así que todo
     lo que ya lee `c.foto` o `c.seguidores` —el avatar del menú, la tarjeta del inicio— sigue
     funcionando sin cambiar nada: lo único que cambia es de dónde salieron esos valores.

     ⚠️ Lo escrito a mano NO se borra. Si algún día se desconecta Instagram, vuelve a salir lo de
     antes en vez de quedarse la tarjeta vacía. Se tapa, no se destruye. */
  /* 50018 se lee «50.018». Sin esto el diálogo reventaba al abrirse: `mil` vivía en otro
     archivo y aquí no existía. */
  function mil(v) {
    return (v == null || v === '') ? '—' : Number(v).toLocaleString('es-CO');
  }

  var igPorMarca = {};     // marca -> el perfil que dice Instagram
  var igVideos = [];       // las publicaciones, ya con los nombres que usa Cherry
  var igPedido = null;     // la promesa, para no pedirlo dos veces

  /* ⚠️ Este archivo lo cargan DOS mundos y cada uno llama al servidor a su manera: las
     herramientas por `CherryApp.funcion`, la aplicación principal por `CARRETE.api.edgeFetch`.
     Sin esto, el perfil saldría en el Laboratorio y no en el inicio — que es justo donde está la
     tarjeta con los seguidores. */
  function llamar(nombre, cuerpo) {
    if (App && App.funcion) return App.funcion(nombre, cuerpo);
    var A = window.CARRETE && window.CARRETE.api;
    if (A && A.edgeFetch) return A.edgeFetch(nombre, cuerpo);
    return Promise.reject(new Error('Aquí no hay forma de llamar al servidor.'));
  }

  function pedirInstagram() {
    if (igPedido) return igPedido;
    igPedido = llamar('ig-metricas', { modo: 'saldo' }).then(function (r) {
      (r && r.cuentas || []).forEach(function (c) {
        if (c.marca && c.estado === 'activa') igPorMarca[c.marca] = c;
      });
      /* ⚠️ Una vez al día se le piden a Instagram los números frescos. Instagram tarda unas 48 h
         en consolidarlos, así que pedirlos más a menudo no dice nada nuevo y solo hace que el
         inicio tarde en pintar.

         Y no se espera: se sigue adelante con lo que ya hay guardado, y si llegan datos nuevos
         se avisa otra vez para repintar. Esperar a Instagram para enseñar el inicio sería
         cambiar números de ayer por una pantalla en blanco hoy. */
      var ultima = r && r.ultima ? Date.parse(r.ultima) : 0;
      if (!ultima || (Date.now() - ultima) > 20 * 3600 * 1000) {
        llamar('ig-metricas', { modo: 'traer', cuantas: 30 })
          .then(function () { return llamar('ig-metricas', { modo: 'videos' }); })
          .then(function (v) {
            if (v && v.videos) {
              igVideos = v.videos;
              alLlegar.forEach(function (fn) { try { fn(); } catch (e) {} });
            }
          })
          .catch(function () {});   // si Instagram no contesta, se queda lo guardado
      }

      /* Y las publicaciones, que son los videos. Si esto falla, el perfil ya está y la cuenta
         sigue sirviendo: se pierde la lista, no la pantalla. */
      return llamar('ig-metricas', { modo: 'videos' })
        .then(function (v) { igVideos = (v && v.videos) || []; })
        .catch(function () { igVideos = []; });
    }).then(function () {
      alLlegar.forEach(function (fn) { try { fn(); } catch (e) {} });
      return igPorMarca;
    }).catch(function () { return igPorMarca; });
    return igPedido;
  }

  /* Lo de Instagram pisa lo escrito a mano, campo a campo y solo si Instagram lo trae. */
  function conInstagram(c) {
    if (!c) return c;
    var ig = igPorMarca[c.id];
    if (!ig) return c;
    var x = Object.create(null);
    Object.keys(c).forEach(function (k) { x[k] = c[k]; });
    if (ig.foto) x.foto = ig.foto;
    if (ig.usuario) x.nombre = ig.usuario;
    if (ig.nombre_real) x.real = ig.nombre_real;
    if (ig.bio) x.bio = ig.bio;
    if (ig.seguidores != null) x.seguidores = ig.seguidores;
    if (ig.seguidos != null) x.seguidos = ig.seguidos;
    if (ig.publicaciones != null) x.publicaciones = ig.publicaciones;
    x.instagram = ig;     // para que el diálogo sepa que está conectada
    return x;
  }

  /* La capa de Instagram aplicada a TODAS las marcas de un documento. La tarjeta del inicio no
     pasa por `marcaActiva()` —llama a `resumen(doc)` con el documento crudo— así que necesita
     esto para no seguir enseñando lo escrito a mano. */
  function igEnDoc(doc) {
    if (!doc || !Array.isArray(doc.cuentas)) return doc;
    var x = {}; Object.keys(doc).forEach(function (k) { x[k] = doc[k]; });
    x.cuentas = doc.cuentas.map(conInstagram);
    x.videos = videosConInstagram(doc.videos || []);
    return x;
  }

  /* Lo que Cherry sabe de un video y Instagram no: la planeación, y la curva de la captura.
     Todo lo demás —vistas, alcance, me gusta, retención— viene de Instagram. */
  var LO_DE_CHERRY = ['piezas', 'desmontaje', 'guion', 'curva', 'caida', 'mediciones',
                      'tapa', 'grabado', 'notas'];

  var DIAS_DE_MARGEN = 3;
  function dias(a, b) {
    var x = Date.parse(a), y = Date.parse(b);
    return (isFinite(x) && isFinite(y)) ? Math.abs(x - y) / 86400000 : 1e9;
  }

  /* Palabras que no distinguen nada: si dos textos comparten «para» y «como», no se parecen. */
  var VACIAS = 'de la el los las un una y o que en con por para mas no se su tu lo al del es son ' +
    'como cuando donde porque si ya te me muy sin sobre entre desde hasta cada todo todos';
  function jugosas(t) {
    var fuera = ' ' + VACIAS + ' ';
    return String(t || '').toLowerCase()
      .normalize('NFD').replace(/\p{M}/gu, '')   /* fuera las tildes */
      .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length >= 4 && fuera.indexOf(' ' + w + ' ') < 0; });
  }
  /* Cuántas palabras con peso comparten dos textos. */
  function parecido(a, b) {
    var A = jugosas(a), B = jugosas(b);
    if (!A.length || !B.length) return 0;
    var n = 0;
    A.forEach(function (w) { if (B.indexOf(w) >= 0) n++; });
    return n;
  }

  function videosConInstagram(mios) {
    if (!igVideos.length) return mios;

    var porMedia = {};
    mios.forEach(function (v) { if (v.igMediaId) porMedia[v.igMediaId] = v; });

    /* ⚠️ Por fecha CERCANA, no exacta. Un video se registra en Cherry DESPUÉS de publicarlo, así
       que las fechas casi nunca coinciden: los dos primeros llevaban un día de diferencia y no
       ataba ninguno — la cuenta mostraba 4 videos siendo 2, cada uno duplicado. */
    var sueltos = mios.filter(function (v) { return !v.igMediaId && v.fecha; });

    var usados = {};
    var salida = igVideos.map(function (p) {
      var mio = porMedia[p.igMediaId], porFec = null;
      if (!mio) {
        /* ⚠️ La fecha SOLA cruza los videos: dos publicados con un día de diferencia empatan y
           el desempate por orden se equivoca la mitad de las veces. Atribuir las vistas de un
           video al guion de otro envenena todo lo que el Laboratorio deduzca después.
           Por eso puntúa también el texto, y las palabras pesan más que un día. */
        var cerca = null, mejor = -1;
        sueltos.forEach(function (v) {
          if (usados[v.id]) return;
          if (v.cuenta && p.cuenta && v.cuenta !== p.cuenta) return;
          var d = dias(v.fecha, p.fecha);
          if (d > DIAS_DE_MARGEN) return;
          var punt = parecido(v.titulo, p.titulo) * 10 + (DIAS_DE_MARGEN - d);
          if (punt > mejor) { mejor = punt; cerca = v; }
        });
        if (cerca) { mio = cerca; porFec = true; }
      }
      if (!mio) return p;
      usados[mio.id] = true;

      var v = {}; Object.keys(p).forEach(function (k) { v[k] = p[k]; });
      LO_DE_CHERRY.forEach(function (k) { if (mio[k] != null) v[k] = mio[k]; });
      /* El título que le puso él manda sobre el texto de la publicación: lo escribió para
         reconocerlo, y el pie de Instagram suele empezar con un emoji y una frase suelta. */
      if (mio.titulo) v.titulo = mio.titulo;
      v.idCherry = mio.id;
      if (porFec) v.atadoPorFecha = true;
      return v;
    });

    /* ⚠️ Los que no casaron con ninguna publicación NO se borran. Pueden ser de otra red, o de
       antes de conectar la cuenta. Perder datos de alguien para dejar una lista limpia no vale. */
    mios.forEach(function (v) { if (!usados[v.id]) salida.push(v); });
    return salida;
  }

  /* Quien pinte con estos datos tiene que repintar cuando lleguen: el perfil de Instagram
     aparece después que el documento. */
  var alLlegar = [];
  function cuandoLlegueInstagram(fn) {
    if (typeof fn !== 'function') return;
    alLlegar.push(fn);
    if (igPedido) igPedido.then(function () { try { fn(); } catch (e) {} });
  }

  function marcaActiva() {
    var id = activa();
    return conInstagram(lista().filter(function (c) { return c.id === id; })[0] || lista()[0] || null);
  }
  function nid() { return Math.random().toString(36).slice(2, 9); }

  /* Guarda y DEVUELVE una promesa. Quien recargue la página después tiene que esperarla: una
     recarga aborta la petición que esté en vuelo, y el guardado se pierde sin decir nada. */
  function guardaDoc() {
    if (!doc) return Promise.resolve();
    /* La copia de este navegador SIEMPRE, y con la misma clave que usan las herramientas: es de
       donde lee todo Cherry al arrancar. El servidor es el respaldo, no la fuente. */
    var u = usuario();
    if (u && u.id) {
      try { localStorage.setItem('cherry-herr-' + HERR + '-' + u.id, JSON.stringify(doc)); } catch (e) {}
    }
    if (App) { App.guardar(HERR, doc); return Promise.resolve(); }
    if (C.api && C.api.guardarDatosHerramienta) {
      return C.api.guardarDatosHerramienta(HERR, doc).catch(function (e) {
        /* Nunca un diálogo del navegador: en Cherry todo aviso lleva el diseño del producto. */
        tira('No se pudo guardar en tu cuenta. Lo de ahora está solo en este navegador.');
        throw e;
      });
    }
    return Promise.resolve();
  }
  function cambiar(id) {
    if (puente) return puente.cambiar(id);
    doc.activa = id;
    /* Fuera del Laboratorio lo más honesto es recargar: la página entera trabaja con la marca
       activa y refrescarla a trozos deja mitades de la anterior. */
    guardaDoc().then(function () { location.reload(); }, function () { location.reload(); });
  }
  function nombrePersona() {
    return (doc && doc.persona) || (puente && puente.persona && puente.persona()) || '';
  }
  var avisar = null;          // la pagina se entera cuando el nombre cambia
  function guardarPersona(n) {
    if (puente && puente.guardarPersona) { puente.guardarPersona(n); if (avisar) avisar(); return; }
    if (!doc) return;
    doc.persona = n; guardaDoc();
    if (avisar) avisar();
  }

  function crear(nombre) {
    var c = { id: nid(), nombre: String(nombre).slice(0, 40) };
    if (puente) return puente.crear(c);
    if (!doc) doc = { cuentas: [], activa: '' };
    if (!Array.isArray(doc.cuentas)) doc.cuentas = [];
    doc.cuentas.push(c); doc.activa = c.id;
    guardaDoc().then(function () { location.reload(); }, function () { location.reload(); });
  }
  function guardarMarca(c) {
    if (puente) return puente.guardar(c);
    guardaDoc();
  }

  /* ── El velo, común al menú y a los diálogos ── */
  function velo(html, ancho) {
    var v = document.createElement('div');
    v.className = 'chv';
    v.innerHTML = '<div class="chv-caja" style="max-width:' + (ancho || 460) + 'px" role="dialog">' + html + '</div>';
    document.body.appendChild(v);
    var cerrar = function () { v.remove(); };
    v.addEventListener('click', function (e) { if (e.target === v) cerrar(); });
    document.addEventListener('keydown', function esc2(e) {
      if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc2); }
    });
    return { v: v, cerrar: cerrar };
  }

  /* ── El perfil de la marca ──
     Lo que se ve arriba en la tarjeta del inicio: la réplica de tu perfil de Instagram. Se escribe
     a mano porque la API de Instagram todavía no está; el día que esté, esto se rellena solo.
     Los seguidores SÍ se piden aquí. Lo intenté sacando el dato del último video, pero el campo
     de un video son los seguidores NUEVOS que ese video trajo, no el total de la cuenta: la
     tarjeta del inicio decía «1 seguidores» con 50 mil detrás. */
  var FOTO_LADO = 128;
  function encogerFoto(archivo) {
    return new Promise(function (ok, mal) {
      var img = new Image();
      img.onload = function () {
        var l = document.createElement('canvas');
        l.width = l.height = FOTO_LADO;
        var g = l.getContext('2d');
        var lado = Math.min(img.width, img.height);
        g.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, FOTO_LADO, FOTO_LADO);
        ok(l.toDataURL('image/webp', 0.82));
      };
      img.onerror = function () { mal(new Error('No pude leer esa imagen.')); };
      img.src = URL.createObjectURL(archivo);
    });
  }

  /* ── Conectar una cuenta a esta marca ──────────────────────────────────────
     (24-sep) De verdad: abre el inicio de sesión de Instagram (función ig-conectar), la persona acepta los permisos y
     vuelve aquí con la cuenta ya atada a esta marca. Si ya hay cuentas conectadas sin marca, se puede escoger una. */
  function paginaActual() {
    var p = location.pathname, i = p.indexOf('/herramientas/');
    return i >= 0 ? 'herramientas/' + p.slice(i + 14) : 'app.html';
  }
  function irAInstagram(c) {
    tira('Abriendo Instagram…');
    llamar('ig-conectar', { accion: 'enlace', marca: c && c.id, volver: paginaActual() }).then(function (r) {
      if (!r || !r.url) throw new Error((r && r.error) || 'No se pudo abrir Instagram.');
      location.href = r.url;
    }).catch(function (e) { tira(e.message); });
  }
  function conectarInstagram(c, dial) {
    llamar('ig-metricas', { modo: 'saldo' }).then(function (r) {
      var libres = (r && r.cuentas || []).filter(function (x) { return !x.marca && x.estado === 'activa'; });
      if (!libres.length) { irAInstagram(c); return; }
      var d2 = velo('<h3 class="chv-t">¿Cuál es la cuenta de esta marca?</h3>' +
        '<p class="chv-d">Se escoge una vez. Después, la foto y los números se traen solos.</p>' +
        libres.map(function (x) {
          return '<button type="button" class="chv-b chv-b--linea chv-ig-op" data-ig="' +
            esc(x.ig_user_id) + '" style="width:100%;justify-content:flex-start;margin-bottom:8px">@' +
            esc(x.usuario) + '</button>';
        }).join('') +
        '<button type="button" class="chv-b chv-b--claro" data-otra style="width:100%;margin:4px 0 8px">Conectar otra cuenta de Instagram</button>' +
        '<div class="chv-acc"><button type="button" class="chv-b chv-b--linea" data-no>Cancelar</button></div>', 420);
      d2.v.querySelector('[data-no]').onclick = d2.cerrar;
      d2.v.querySelector('[data-otra]').onclick = function () { d2.cerrar(); irAInstagram(c); };
      d2.v.querySelectorAll('[data-ig]').forEach(function (b) {
        b.onclick = function () {
          llamar('ig-metricas', { modo: 'atar', ig_user_id: b.dataset.ig, marca: c.id })
            .then(function () { return llamar('ig-metricas', { modo: 'perfil' }); })
            .then(function () { igPedido = null; igPorMarca = {}; return pedirInstagram(); })
            .then(function () { d2.cerrar(); if (dial) dial.cerrar(); pintaAvatar(); })
            .catch(function (e) { tira(e.message); });
        };
      });
    }).catch(function (e) { tira(e.message); });
  }

  /* ── Borrar mi cuenta (24-sep) ──
     Lo que dice la política de privacidad, tal cual: se hace en el momento (se corta Instagram y no se puede volver a
     entrar), se guarda 30 días por si se arrepiente escribiendo a soporte, y después desaparece todo. Se confirma
     escribiendo BORRAR: un botón solo es demasiado fácil de tocar sin querer. */
  function borrarCuenta() {
    var d = velo('<h3 class="chv-t">Borrar tu cuenta</h3>' +
      '<p class="chv-d">Se borra <b>todo</b>: tus guiones, storyboards, carruseles, calendario, tus marcas, los archivos que subiste y los videos que montaste. ' +
      'También se corta el permiso de Cherry sobre tu Instagram y se cancela lo que tengas programado.</p>' +
      '<p class="chv-d">Desde ya no podrás entrar. Lo guardamos <b>30 días</b> por si te arrepientes (escribe a soporte@cherrysweet.app) y después desaparece. ' +
      'Las facturas de lo que hayas pagado las conserva Paddle.</p>' +
      '<label class="chv-l">Para confirmar, escribe BORRAR<input class="chv-e" id="chv-borrar-txt" type="text" autocomplete="off" placeholder="BORRAR"></label>' +
      '<div class="chv-acc"><button type="button" class="chv-b chv-b--rojo" data-ok disabled>Borrar mi cuenta</button>' +
      '<button type="button" class="chv-b chv-b--linea" data-no>Cancelar</button></div>', 480);
    var txt = d.v.querySelector('#chv-borrar-txt'), ok = d.v.querySelector('[data-ok]');
    d.v.querySelector('[data-no]').onclick = d.cerrar;
    txt.oninput = function () { ok.disabled = txt.value.trim().toUpperCase() !== 'BORRAR'; };
    setTimeout(function () { txt.focus(); }, 30);
    ok.onclick = function () {
      ok.disabled = true; ok.textContent = 'Borrando…';
      llamar('borrar-cuenta', { accion: 'pedir', confirmo: txt.value }).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'No se pudo borrar.');
        try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
        var raiz = location.pathname.indexOf('/herramientas/') >= 0 ? '../' : '';
        location.href = raiz + 'index.html?cuenta=borrada';
      }).catch(function (e) { ok.disabled = false; ok.textContent = 'Borrar mi cuenta'; tira(e.message); });
    };
  }

  function editarPerfil() {
    var c = marcaActiva();
    if (!c) return;
    var foto = c.foto || '';
    var d = velo(
      '<h3 class="chv-t">El perfil de tu marca</h3>' +
      '<p class="chv-d">Es lo que se ve arriba en la tarjeta de tu cuenta, en el inicio.' +
      (c.instagram ? ' Con Instagram conectado, la foto y los números los trae él.' : '') + '</p>' +
      '<div class="chv-foto"><span class="chv-ver" id="chv-ver">' +
      (foto ? '<img src="' + esc(foto) + '" alt="">' : esc((c.nombre || 'C').charAt(0).toUpperCase())) +
      '</span><div class="chv-fbtn">' +
      /* ⚠️ Con Instagram conectado NO se ofrece cambiar la foto: la de Instagram la tapa, así
         que subir una sería pulsar un botón y no ver nada cambiar. */
      (c.instagram
        ? '<span class="chv-nota" style="margin:0">La de tu perfil de Instagram.</span>'
        : '<button type="button" class="chv-b chv-b--linea" id="chv-subir">Cambiar la foto</button>' +
          '<button type="button" class="chv-b chv-b--linea" id="chv-quitar"' + (foto ? '' : ' hidden') + '>Quitarla</button>') +
      '<input type="file" id="chv-archivo" accept="image/*" hidden></div></div>' +
      '<label class="chv-l">Cómo te llamas<input class="chv-e" data-c="persona" type="text" placeholder="Sergio" value="' + esc(nombrePersona()) + '"></label>' +
      '<p class="chv-nota">Es con lo que Cherry te saluda en el inicio. Lo de abajo es de la marca.</p>' +
      /* ⚠️ Con Instagram conectado estas tres NO se pintan. Salen de la conexión, así que una
         casilla aquí —aunque fuera de solo lectura— sigue pareciendo algo que hay que rellenar,
         y ocupa el sitio de lo que sí hay que escribir. El dato se enseña abajo, como texto. */
      (c.instagram ? '' :
        '<label class="chv-l">Tu usuario<input class="chv-e" data-c="nombre" type="text" placeholder="sergiosaac.co" value="' + esc(c.nombre || '') + '"></label>' +
        '<label class="chv-l">El nombre que se ve<input class="chv-e" data-c="real" type="text" placeholder="Sergio Abadía | Marketing de Contenidos" value="' + esc(c.real || '') + '"></label>' +
        '<label class="chv-l">Biografía<textarea class="chv-e" data-c="bio" rows="3" placeholder="Lo que tienes escrito en tu perfil">' + esc(c.bio || '') + '</textarea></label>') +
      (c.instagram
        /* Conectada: los números se enseñan, no se piden. Escribirlos a mano cuando Instagram ya
           los dice solo sirve para que digan algo distinto de la verdad. */
        ? '<div class="chv-ig"><span class="chv-ig-p">Instagram conectado</span>' +
          '<b>@' + esc(c.instagram.usuario || '') + '</b>' +
          (c.instagram.nombre_real ? '<div class="chv-ig-r">' + esc(c.instagram.nombre_real) + '</div>' : '') +
          (c.instagram.bio ? '<div class="chv-ig-b">' + esc(c.instagram.bio) + '</div>' : '') +
          '<div class="chv-ig-n">' +
          '<span><b>' + mil(c.instagram.publicaciones) + '</b> publicaciones</span>' +
          '<span><b>' + mil(c.instagram.seguidores) + '</b> seguidores</span>' +
          '<span><b>' + mil(c.instagram.seguidos) + '</b> seguidos</span></div>' +
          '<div class="chv-ig-a"><button type="button" class="chv-b chv-b--linea" id="chv-ig-act">Actualizar</button>' +
          '<button type="button" class="chv-b chv-b--linea" id="chv-ig-fuera">Desconectar</button></div></div>'
        : '<div class="chv-ig chv-ig--no"><span class="chv-ig-p">Instagram</span>' +
          '<p class="chv-nota" style="margin:0 0 10px">Conéctalo y la foto, el usuario, la bio y ' +
          'los seguidores se traen solos. También las estadísticas de cada video.</p>' +
          '<button type="button" class="chv-b chv-b--claro" id="chv-ig-conectar">Conectar Instagram</button></div>') +
      '<div class="chv-acc"><button type="button" class="chv-b chv-b--claro" data-ok>Guardar</button>' +
      '<button type="button" class="chv-b chv-b--linea" data-no>Cancelar</button></div>', 480);

    var q = function (s) { return d.v.querySelector(s); };
    q('[data-no]').onclick = d.cerrar;
    var archivo = q('#chv-archivo');
    var bSubir = q('#chv-subir'), bQuitar = q('#chv-quitar');
    if (bSubir) bSubir.onclick = function () { archivo.click(); };
    archivo.onchange = function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      encogerFoto(f).then(function (uri) {
        foto = uri;
        q('#chv-ver').innerHTML = '<img src="' + uri + '" alt="">';
        if (bQuitar) bQuitar.hidden = false;
      }).catch(function (e) { tira(e.message); });
    };
    if (bQuitar) bQuitar.onclick = function () {
      foto = '';
      q('#chv-ver').textContent = (c.nombre || 'C').charAt(0).toUpperCase();
      bQuitar.hidden = true;
    };
    /* Los tres botones de Instagram. */
    var bAct = q('#chv-ig-act'), bFuera = q('#chv-ig-fuera'), bCon = q('#chv-ig-conectar');
    if (bAct) bAct.onclick = function () {
      bAct.disabled = true; bAct.textContent = 'Actualizando…';
      llamar('ig-metricas', { modo: 'perfil' }).then(function () {
        igPedido = null; igPorMarca = {};
        return pedirInstagram();
      }).then(function () { d.cerrar(); pintaAvatar(); editarPerfil(); })
        .catch(function (e) { bAct.disabled = false; bAct.textContent = 'Actualizar'; tira(e.message); });
    };
    /* (25-sep) Desconectar de verdad: antes solo soltaba la cuenta de la marca y Cherry la seguía usando. */
    if (bFuera) bFuera.onclick = function () {
      var ig = c.instagram;
      var d2 = velo('<h3 class="chv-t">¿Desconectar @' + esc(ig.usuario || '') + '?</h3>' +
        '<p class="chv-d">Cherry deja de usar esta cuenta: se pausan sus respuestas automáticas y se cancelan las ' +
        'publicaciones que tenías programadas en ella. Tus videos y proyectos no se tocan. Puedes volver a conectarla cuando quieras.</p>' +
        '<div class="chv-acc"><button type="button" class="chv-b chv-b--rojo" data-si>Desconectar</button>' +
        '<button type="button" class="chv-b chv-b--linea" data-no>Cancelar</button></div>', 420);
      d2.v.querySelector('[data-no]').onclick = d2.cerrar;
      var bSi = d2.v.querySelector('[data-si]');
      bSi.onclick = function () {
        bSi.disabled = true; bSi.textContent = 'Desconectando…';
        llamar('ig-conectar', { accion: 'desconectar', ig_user_id: ig.ig_user_id })
          .then(function () {
            igPedido = null; igPorMarca = {};
            return pedirInstagram();
          }).then(function () { d2.cerrar(); d.cerrar(); pintaAvatar(); tira('Instagram desconectado.'); })
          .catch(function (e) { bSi.disabled = false; bSi.textContent = 'Desconectar'; tira(e.message); });
      };
    };
    if (bCon) bCon.onclick = function () { conectarInstagram(c, d); };

    q('[data-ok]').onclick = function () {
      var out = {};
      d.v.querySelectorAll('[data-c]').forEach(function (el) { out[el.dataset.c] = el.value.trim(); });
      /* Con Instagram conectado estas tres ni se preguntan: no se tocan. */
      if (!c.instagram) {
        if (!out.nombre) { q('.chv-e').focus(); return; }
        c.nombre = out.nombre.slice(0, 40);
        c.real = (out.real || '').slice(0, 90);
        c.bio = (out.bio || '').slice(0, 300);
      }
      /* Los números ya no se guardan desde aquí: los trae Instagram. Los que hubiera escritos a
         mano se quedan donde están por si algún día se desconecta. */
      c.foto = foto;
      if (out.persona !== nombrePersona()) guardarPersona(out.persona.slice(0, 40));
      guardarMarca(c);
      d.cerrar();
      pintaAvatar();
    };
    q('.chv-e').focus();
  }

  /* (25-sep) «Pasar a otra marca»: escoger a cuál. Devuelve una promesa con el id escogido (o null si se cancela). */
  function escogerMarca(que) {
    return new Promise(function (listo) {
      var actual = marcaNormal(), otras = (lista() || []).filter(function (x) { return x && x.id !== actual; });
      if (!otras.length) { tira('Solo tienes una marca. Crea otra desde este menú.'); listo(null); return; }
      var d = velo('<h3 class="chv-t">Pasar a otra marca</h3>' +
        '<p class="chv-d">' + (que ? '<b>' + esc(que) + '</b> sale de esta marca y queda en la que escojas.' : 'Queda en la marca que escojas.') + '</p>' +
        otras.map(function (x) {
          var ig = conInstagram(x) || x;
          return '<button type="button" class="chv-b chv-b--linea" data-a="' + esc(x.id) + '" style="width:100%;justify-content:flex-start;margin-bottom:8px">' +
            esc(ig.nombre || 'Marca') + '</button>';
        }).join('') +
        '<div class="chv-acc"><button type="button" class="chv-b chv-b--linea" data-no>Cancelar</button></div>', 420);
      var hecho = false;
      d.v.querySelector('[data-no]').onclick = function () { hecho = true; d.cerrar(); listo(null); };
      d.v.querySelectorAll('[data-a]').forEach(function (b) {
        b.onclick = function () { hecho = true; d.cerrar(); listo(b.dataset.a); };
      });
      d.v.addEventListener('click', function (e) { if (e.target === d.v && !hecho) { hecho = true; listo(null); } });
    });
  }
  function nombreDeMarca(id) {
    var x = conInstagram((lista() || []).filter(function (m) { return m && m.id === id; })[0] || null);
    return (x && x.nombre) || 'la otra marca';
  }

  function nuevaMarca() {
    var d = velo(
      '<h3 class="chv-t">Una marca más</h3>' +
      '<p class="chv-d">Cada marca lleva todo lo suyo aparte: sus proyectos, guiones, storyboards, carruseles, ' +
      'calendario, respuestas y su baúl. Al cambiar de marca no cambia nada de la pantalla — cambian los datos.</p>' +
      '<label class="chv-l">Cómo se llama<input class="chv-e" id="chv-nom" type="text" placeholder="cobra.pos"></label>' +
      '<div class="chv-acc"><button type="button" class="chv-b chv-b--claro" data-ok>Crear</button>' +
      '<button type="button" class="chv-b chv-b--linea" data-no>Cancelar</button></div>', 420);
    d.v.querySelector('[data-no]').onclick = d.cerrar;
    d.v.querySelector('[data-ok]').onclick = function () {
      var n = d.v.querySelector('#chv-nom').value.trim();
      if (!n) { d.v.querySelector('#chv-nom').focus(); return; }
      crear(n);
      d.cerrar();
    };
    d.v.querySelector('#chv-nom').focus();
  }

  /* ── El menú ── */
  function cerrarMenu() {
    var m = document.querySelector('.chm');
    if (m) m.remove();
    abierto = false;
    document.removeEventListener('click', fueraDelMenu, true);
  }
  function fueraDelMenu(e) {
    if (!e.target.closest('.chm') && !e.target.closest('[data-avatar]')) cerrarMenu();
  }

  function abrirMenu(ancla) {
    if (abierto) { cerrarMenu(); return; }
    var c = marcaActiva(), cs = lista();
    var u = usuario();
    var correo = (u && u.email) || '';

    var m = document.createElement('div');
    m.className = 'chm';
    m.setAttribute('role', 'menu');
    m.innerHTML =
      '<div class="chm-cab">' +
      (c && c.foto ? '<img class="chm-foto" src="' + esc(c.foto) + '" alt="">'
                   : '<span class="chm-foto chm-foto--v">' + esc(((c && c.nombre) || 'C').charAt(0).toUpperCase()) + '</span>') +
      '<div class="chm-tx"><b>' + esc((c && c.nombre) || 'Tu marca') + '</b>' +
      '<span>' + esc(nombrePersona() || correo) + '</span></div></div>' +
      '<button type="button" class="chm-op" data-perfil>' +
      '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="9" cy="6" r="3"/><path d="M3.5 15.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg>' +
      'El perfil de tu marca</button>' +
      (cs.length > 1
        ? '<div class="chm-sep">Cambiar de marca</div>' +
          cs.map(function (x) {
            return '<button type="button" class="chm-op chm-marca" data-marca="' + esc(x.id) + '"' +
              (x.id === activa() ? ' aria-current="true"' : '') + '>' +
              (x.foto ? '<img class="chm-mini" src="' + esc(x.foto) + '" alt="">'
                      : '<span class="chm-mini chm-mini--v">' + esc((x.nombre || 'C').charAt(0).toUpperCase()) + '</span>') +
              esc(x.nombre) + '</button>';
          }).join('')
        : '') +
      '<button type="button" class="chm-op" data-nueva>' +
      '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 4v10M4 9h10"/></svg>' +
      'Una marca más</button>' +
      '<div class="chm-sep"></div>' +
      (enInicio ? '' :
        '<a class="chm-op" href="' + inicio() + '">' +
        '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l6-5 6 5v6.5a1 1 0 01-1 1h-3v-4H7v4H4a1 1 0 01-1-1z"/></svg>' +
        'Ir al inicio</a>') +
      extra.map(function (o, k) {
        return '<button type="button" class="chm-op' + (o.rojo ? ' chm-op--rojo' : '') + '" data-extra="' + k + '">' +
          (o.icono || '') + esc(o.t) + '</button>';
      }).join('') +
      /* (24-sep) lo promete la política de privacidad (#borrar): «el menú de tu foto → Borrar mi cuenta» */
      '<button type="button" class="chm-op chm-op--rojo chm-op--borrar" data-borrar>' +
      '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5h11M7 5V3.5h4V5M5 5l.7 9.5a1 1 0 001 .9h4.6a1 1 0 001-.9L13 5"/></svg>' +
      'Borrar mi cuenta</button>';
    document.body.appendChild(m);

    var r = ancla.getBoundingClientRect();
    m.style.top = Math.round(r.bottom + 10) + 'px';
    m.style.right = Math.round(window.innerWidth - r.right) + 'px';

    m.querySelector('[data-perfil]').onclick = function () { cerrarMenu(); editarPerfil(); };
    m.querySelector('[data-borrar]').onclick = function () { cerrarMenu(); borrarCuenta(); };
    m.querySelector('[data-nueva]').onclick = function () { cerrarMenu(); nuevaMarca(); };
    m.querySelectorAll('[data-marca]').forEach(function (b) {
      b.onclick = function () { var id = b.dataset.marca; cerrarMenu(); if (id !== activa()) cambiar(id); };
    });
    m.querySelectorAll('[data-extra]').forEach(function (b) {
      b.onclick = function () { cerrarMenu(); extra[Number(b.dataset.extra)].hacer(); };
    });

    abierto = true;
    setTimeout(function () { document.addEventListener('click', fueraDelMenu, true); }, 0);
  }

  /* La foto de la marca manda en el avatar: es la cuenta con la que estás trabajando.
     Es IDEMPOTENTE a propósito: si ya está como debe no toca el DOM. El inicio lo vigila con un
     MutationObserver para repintarlo tras cada redibujo, y si esta función escribiera siempre, el
     observer se dispararía por su propio cambio y no pararía nunca. */
  function pintaAvatar() {
    var c = marcaActiva();
    var firma = c ? (c.foto ? 'f:' + c.foto.length : 'i:' + (c.nombre || '')) : '-';
    document.querySelectorAll('[data-avatar]').forEach(function (el) {
      if (el.dataset.chmFirma === firma) return;
      el.dataset.chmFirma = firma;
      el.classList.add('chm-abre');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.title = c ? c.nombre : 'Tu cuenta';
      if (c && c.foto) {
        el.innerHTML = '<img src="' + esc(c.foto) + '" alt="">';
      } else if (c) {
        el.textContent = (c.nombre || 'C').charAt(0).toUpperCase();
      }
      /* El clic NO se engancha aquí: el inicio reconstruye la app entera en cada cambio de
         estado, y un listener puesto sobre este nodo se iría con él. Va delegado, abajo. */
    });
  }

  /* ── Arranque ── */
  var ESTILO = '\
.chm-abre{cursor:pointer;overflow:hidden;padding:0}\
.chm-abre img{width:100%;height:100%;object-fit:cover;display:block}\
.chm{position:fixed;z-index:120;min-width:250px;max-width:300px;border-radius:18px;padding:8px;\
  background:#1B1518;border:1px solid rgba(255,255,255,.09);color:#F4ECE7;\
  box-shadow:0 26px 54px -20px rgba(0,0,0,.85);font-family:"Space Grotesk",system-ui,sans-serif;\
  animation:chmEnt .16s ease}\
@keyframes chmEnt{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}\
.chm-cab{display:flex;gap:10px;align-items:center;padding:8px 10px 12px}\
.chm-foto{width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;\
  font:900 16px "Outfit",sans-serif;color:rgba(244,236,231,.6);\
  background:linear-gradient(140deg,#4A3340,#221820);box-shadow:0 0 0 2px #1B1518,0 0 0 3.5px #FF2D8A}\
.chm-foto img{width:100%;height:100%;object-fit:cover}\
.chm-tx{min-width:0}\
.chm-tx b{display:block;font:700 14px "Outfit",sans-serif;letter-spacing:-.02em;\
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.chm-tx span{display:block;font-size:11.5px;color:rgba(244,236,231,.38);\
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.chm-op{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;cursor:pointer;\
  background:transparent;color:#F4ECE7;font:500 13.5px "Space Grotesk",sans-serif;\
  padding:10px 11px;border-radius:12px;text-decoration:none;transition:background .15s}\
.chm-op:hover{background:rgba(255,255,255,.07)}\
.chm-op svg{width:17px;height:17px;flex:none;color:rgba(244,236,231,.5)}\
.chm-marca[aria-current="true"]{background:rgba(255,45,138,.14);color:#FF2D8A}\
.chm-mini{width:22px;height:22px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;\
  font:800 10px "Outfit",sans-serif;color:rgba(244,236,231,.6);background:#2A2126}\
.chm-mini img{width:100%;height:100%;object-fit:cover}\
.chm-sep{font:500 9.5px "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase;\
  color:rgba(244,236,231,.32);padding:12px 11px 6px;border-top:1px solid rgba(255,255,255,.07);margin-top:6px}\
.chv{position:fixed;inset:0;z-index:130;display:grid;place-items:center;padding:20px;\
  background:rgba(8,5,7,.72);backdrop-filter:blur(7px);font-family:"Space Grotesk",system-ui,sans-serif}\
.chv-caja{width:100%;max-height:90vh;overflow-y:auto;border-radius:24px;padding:26px;\
  background:#1B1518;border:1px solid rgba(255,255,255,.09);color:#F4ECE7;\
  box-shadow:0 30px 70px -24px rgba(0,0,0,.9)}\
.chv-t{margin:0 0 6px;font:900 23px "Outfit",sans-serif;letter-spacing:-.03em}\
.chv-d{margin:0 0 18px;font-size:13.5px;line-height:1.5;color:rgba(244,236,231,.6)}\
.chv-foto{display:flex;align-items:center;gap:14px;margin-bottom:18px}\
.chv-ver{width:64px;height:64px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;\
  font:900 24px "Outfit",sans-serif;color:rgba(244,236,231,.6);\
  background:linear-gradient(140deg,#4A3340,#221820);box-shadow:0 0 0 2px #1B1518,0 0 0 3.5px #FF2D8A}\
.chv-ver img{width:100%;height:100%;object-fit:cover}\
.chv-fbtn{display:flex;gap:8px;flex-wrap:wrap}\
.chv-l{display:block;margin-bottom:13px;font:500 10px "DM Mono",monospace;letter-spacing:.13em;\
  text-transform:uppercase;color:rgba(244,236,231,.38)}\
.chv-e{display:block;width:100%;margin-top:7px;border-radius:13px;padding:12px 14px;\
  background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.09);color:#F4ECE7;\
  font:400 14.5px "Space Grotesk",sans-serif;letter-spacing:0;text-transform:none;resize:vertical}\
.chv-e:focus{outline:2px solid #FF2D8A;outline-offset:1px}\
.chv-dos{display:grid;grid-template-columns:1fr 1fr;gap:13px}\
.chv-tres{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}\
.chv-nota{margin:-8px 0 14px;font-size:11.5px;color:rgba(244,236,231,.38)}.chv-ig{border:1px solid rgba(244,236,231,.14);border-radius:14px;padding:14px;margin:4px 0 14px}.chv-ig-p{display:block;font:500 9.5px/1 var(--f-mono,monospace);letter-spacing:.18em;  text-transform:uppercase;color:#2BD9C7;margin-bottom:6px}.chv-ig--no .chv-ig-p{color:rgba(244,236,231,.38)}.chv-ig>b{font-size:15px}.chv-ig-r{font-size:13px;color:rgba(244,236,231,.72);margin-top:2px}.chv-ig-b{font-size:12.5px;line-height:1.5;color:rgba(244,236,231,.5);margin-top:6px;white-space:pre-line}.chv-ig-n{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0 12px;font-size:12.5px;  color:rgba(244,236,231,.6)}.chv-ig-n b{color:#F7E9E0;font-variant-numeric:tabular-nums}.chv-ig-a{display:flex;gap:8px;flex-wrap:wrap}\
.chm-op--rojo{color:#FF2D8A}\
.ch-tira{position:fixed;left:50%;bottom:26px;z-index:140;transform:translate(-50%,16px);opacity:0;\
  pointer-events:none;transition:opacity .25s,transform .25s;max-width:min(560px,92vw);text-align:center;\
  padding:13px 22px;border-radius:999px;background:#F4ECE7;color:#0B0709;\
  font:600 13.5px "Space Grotesk",system-ui,sans-serif;box-shadow:0 18px 40px -14px rgba(0,0,0,.7)}\
.ch-tira.on{opacity:1;transform:translate(-50%,0)}\
.chv-pronto{margin:4px 0 18px;font-size:12px;line-height:1.5;color:rgba(244,236,231,.38);\
  border-left:2px solid rgba(255,45,138,.5);padding-left:11px}\
.chv-pronto b{color:rgba(244,236,231,.6);font-weight:500}\
.chv-acc{display:flex;gap:9px;flex-wrap:wrap}\
.chv-b{font:700 13.5px "Space Grotesk",sans-serif;border-radius:999px;padding:11px 20px;border:0;cursor:pointer}\
.chv-b--claro{background:#F4ECE7;color:#0B0709}\
.chv-b--linea{background:rgba(255,255,255,.06);color:#F4ECE7;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}\
@media (prefers-reduced-motion:reduce){.chm{animation:none}}' +
    '.chv-b--rojo{background:#E0344F;color:#fff;border-color:#E0344F}.chv-b--rojo[disabled]{opacity:.45;cursor:not-allowed}' +
    '.chm-op--borrar{margin-top:2px;opacity:.85}';

  var st = document.createElement('style');
  st.textContent = ESTILO;
  document.head.appendChild(st);

  /* ── Lo que expone ──
     `marcas(api)`  — el Laboratorio registra su puente, para que no se escriba el documento por
                      dos sitios a la vez.
     `opciones([…])`— la página añade sus entradas al pie del menú (Mis proyectos, Cerrar sesión).
     `nombre()`     — cómo se llama la persona, para el saludo del inicio. */
  var Cuenta = {
    marcas: function (api) { puente = api; pintaAvatar(); },
    igEnDoc: igEnDoc,
    cuandoLlegueInstagram: cuandoLlegueInstagram,
    opciones: function (lista) { extra = lista || []; },
    /* Quién es la marca activa. La pregunta `cherry.js` para servir la identidad que toca. */
    activa: activa,
    /* (25-sep) todo separado por marca */
    marcaNormal: marcaNormal, marcaDefecto: marcaDefecto, escogerMarca: escogerMarca, nombreDeMarca: nombreDeMarca,
    cuantasMarcas: function () { return (lista() || []).length; },
    aviso: function (t) { tira(t); },
    nombre: nombrePersona,
    repinta: pintaAvatar,
    alCambiarNombre: function (fn) { avisar = fn; },
  };
  /* Delegado en el documento: vale para el avatar de ahora y para el que venga tras un redibujo. */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-avatar]');
    if (el) { e.stopPropagation(); e.preventDefault(); abrirMenu(el); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest && e.target.closest('[data-avatar]');
    if (el) { e.preventDefault(); abrirMenu(el); }
  });
  /* Y el avatar se vuelve a pintar cuando el inicio se redibuja. */
  if (C && !App) {
    var pendiente = 0;
    var obs = new MutationObserver(function () {
      if (pendiente) return;
      pendiente = requestAnimationFrame(function () { pendiente = 0; pintaAvatar(); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* (24-sep) Al volver del inicio de sesión de Instagram (ig-conectar), se dice cómo salió y se limpia la dirección */
  (function () {
    var q = new URLSearchParams(location.search), ig = q.get('instagram');
    if (!ig) return;
    var cuenta = q.get('cuenta') || '';
    ['instagram', 'cuenta', 'por'].forEach(function (k) { q.delete(k); });
    try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (_) {}
    setTimeout(function () {
      tira(ig === 'ok' ? 'Instagram conectado' + (cuenta ? ': @' + cuenta : '') + ' ✓'
         : ig === 'cancelado' ? 'No se conectó Instagram: cancelaste el permiso.'
         : 'No se pudo conectar Instagram. Inténtalo de nuevo.');
      if (ig === 'ok') { igPedido = null; igPorMarca = {}; pedirInstagram(); }
    }, 400);
  })();

  window.CherryCuenta = Cuenta;
  if (App) App.marcas = Cuenta.marcas;

  /* ⚠️ Un documento que NO ha llegado no es un documento vacio. Tratar el null de «la sesion
     todavia no esta» como «esta persona no tiene marcas» es lo que hacia aparecer una marca
     inventada llamada «Mi marca» mientras la tarjeta de al lado ya enseñaba la de verdad. */
  function recibe(d, deVerdad) {
    if (!d || typeof d !== 'object') {
      if (!deVerdad) return;                     // todavia no se sabe: no se toca nada
      d = { cuentas: [], activa: '' };
    }
    var antes = nombrePersona();
    doc = d;
    if (deVerdad && (!Array.isArray(doc.cuentas) || !doc.cuentas.length)) {
      doc.cuentas = [{ id: 'principal', nombre: 'Mi marca' }];
      doc.activa = 'principal';
    }
    if (deVerdad) {
      /* (25-sep) La copia de este navegador queda igual a la de la cuenta: de ella sale la marca al abrir cualquier
         página. Sin esto, en el inicio (que lee por api.js y no guarda copia) la recarga de abajo se repetiría. */
      var uu = usuario();
      if (uu && uu.id) { try { localStorage.setItem('cherry-herr-' + HERR + '-' + uu.id, JSON.stringify(doc)); } catch (e) {} }
      /* Si la página abrió con otra marca (se cambió en otro equipo y este navegador tenía la vieja), se recarga: sus
         datos son de la marca equivocada. Una sola vez cada 15 s, por si algo no cuadra y se quedara recargando. */
      var usada = (App && App.marcaDeDocs && App.marcaDeDocs()) || (C && C.session && C.session.marca) || '';
      if (usada && usada !== marcaNormal()) {
        var ultima = 0;
        try { ultima = +sessionStorage.getItem('cherry-recarga-marca') || 0; } catch (e) {}
        if (Date.now() - ultima > 15000) {
          try { sessionStorage.setItem('cherry-recarga-marca', String(Date.now())); } catch (e) {}
          location.reload();
          return;
        }
      }
    }
    if (!puente && Array.isArray(doc.cuentas) && doc.cuentas.length) pintaAvatar();
    /* El perfil de Instagram llega después que el documento: cuando llegue, se repinta el avatar
       para que la foto de arriba sea la de verdad y no la que se subió a mano. */
    pedirInstagram().then(function () { pintaAvatar(); });
    /* El saludo del inicio ya se pintó: si el nombre llega ahora, hay que decírselo o no se
       entera hasta la siguiente recarga. */
    if (avisar && nombrePersona() !== antes) avisar();
  }

  if (!puente) {
    recibe(copiaLocal(), false);
    var pedir = function () {
      /* Otra vez la copia local: la primera lectura fue ANTES de que hubiera sesion, y sin
         `user.id` no se puede ni armar su clave. Aquí ya la hay. */
      recibe(copiaLocal(), false);
      cargarDoc().then(function (d) {
        /* Si el servidor no tiene nada pero este navegador sí, manda el navegador: puede que la
           herramienta aún no haya conseguido subir su documento. Inventar una marca encima de la
           suya es peor que no tener ninguna. */
        if (!d && doc && Array.isArray(doc.cuentas) && doc.cuentas.length) return;
        recibe(d, true);
      }).catch(function () {});
    };
    /* En el inicio hay que esperar a que la sesion este lista: si se pide antes, la propia
       funcion devuelve null por su guardia y parece que no hay nada. */
    if (enInicio && C.onApiReady) C.onApiReady.push(pedir);
    else pedir();
  }
})();

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
  function inicio() { return enInicio ? 'index.html' : '../index.html'; }

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
  function marcaActiva() {
    var id = activa();
    return lista().filter(function (c) { return c.id === id; })[0] || lista()[0] || null;
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

  function editarPerfil() {
    var c = marcaActiva();
    if (!c) return;
    var foto = c.foto || '';
    var d = velo(
      '<h3 class="chv-t">El perfil de tu marca</h3>' +
      '<p class="chv-d">Es lo que se ve arriba en la tarjeta de tu cuenta, en el inicio. Los ' +
      'seguidores no se ponen aquí: salen del último video que registraste.</p>' +
      '<div class="chv-foto"><span class="chv-ver" id="chv-ver">' +
      (foto ? '<img src="' + esc(foto) + '" alt="">' : esc((c.nombre || 'C').charAt(0).toUpperCase())) +
      '</span><div class="chv-fbtn">' +
      '<button type="button" class="chv-b chv-b--linea" id="chv-subir">Cambiar la foto</button>' +
      '<button type="button" class="chv-b chv-b--linea" id="chv-quitar"' + (foto ? '' : ' hidden') + '>Quitarla</button>' +
      '<input type="file" id="chv-archivo" accept="image/*" hidden></div></div>' +
      '<label class="chv-l">Cómo te llamas<input class="chv-e" data-c="persona" type="text" placeholder="Sergio" value="' + esc(nombrePersona()) + '"></label>' +
      '<p class="chv-nota">Es con lo que Cherry te saluda en el inicio. Lo de abajo es de la marca.</p>' +
      '<label class="chv-l">Tu usuario<input class="chv-e" data-c="nombre" type="text" placeholder="sergiosaac.co" value="' + esc(c.nombre || '') + '"></label>' +
      '<label class="chv-l">El nombre que se ve<input class="chv-e" data-c="real" type="text" placeholder="Sergio Abadía | Marketing de Contenidos" value="' + esc(c.real || '') + '"></label>' +
      '<label class="chv-l">Biografía<textarea class="chv-e" data-c="bio" rows="3" placeholder="Lo que tienes escrito en tu perfil">' + esc(c.bio || '') + '</textarea></label>' +
      '<div class="chv-tres">' +
      '<label class="chv-l">Publicaciones<input class="chv-e" data-c="publicaciones" type="number" min="0" placeholder="119" value="' + esc(c.publicaciones != null ? c.publicaciones : '') + '"></label>' +
      '<label class="chv-l">Seguidores<input class="chv-e" data-c="seguidores" type="number" min="0" placeholder="50000" value="' + esc(c.seguidores != null ? c.seguidores : '') + '"></label>' +
      '<label class="chv-l">Seguidos<input class="chv-e" data-c="seguidos" type="number" min="0" placeholder="102" value="' + esc(c.seguidos != null ? c.seguidos : '') + '"></label>' +
      '</div>' +
      '<p class="chv-pronto">Conectar con Instagram · <b>en cuanto Meta apruebe los permisos</b>, ' +
      'estos datos se rellenarán solos.</p>' +
      '<div class="chv-acc"><button type="button" class="chv-b chv-b--claro" data-ok>Guardar</button>' +
      '<button type="button" class="chv-b chv-b--linea" data-no>Cancelar</button></div>', 480);

    var q = function (s) { return d.v.querySelector(s); };
    q('[data-no]').onclick = d.cerrar;
    var archivo = q('#chv-archivo');
    q('#chv-subir').onclick = function () { archivo.click(); };
    archivo.onchange = function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      encogerFoto(f).then(function (uri) {
        foto = uri;
        q('#chv-ver').innerHTML = '<img src="' + uri + '" alt="">';
        q('#chv-quitar').hidden = false;
      }).catch(function (e) { tira(e.message); });
    };
    q('#chv-quitar').onclick = function () {
      foto = '';
      q('#chv-ver').textContent = (c.nombre || 'C').charAt(0).toUpperCase();
      q('#chv-quitar').hidden = true;
    };
    q('[data-ok]').onclick = function () {
      var out = {};
      d.v.querySelectorAll('[data-c]').forEach(function (el) { out[el.dataset.c] = el.value.trim(); });
      if (!out.nombre) { q('.chv-e').focus(); return; }
      c.nombre = out.nombre.slice(0, 40);
      c.real = out.real.slice(0, 90);
      c.bio = out.bio.slice(0, 300);
      c.publicaciones = out.publicaciones === '' ? null : Number(out.publicaciones);
      c.seguidores = out.seguidores === '' ? null : Number(out.seguidores);
      c.seguidos = out.seguidos === '' ? null : Number(out.seguidos);
      c.foto = foto;
      if (out.persona !== nombrePersona()) guardarPersona(out.persona.slice(0, 40));
      guardarMarca(c);
      d.cerrar();
      pintaAvatar();
    };
    q('.chv-e').focus();
  }

  function nuevaMarca() {
    var d = velo(
      '<h3 class="chv-t">Una marca más</h3>' +
      '<p class="chv-d">Cada marca lleva lo suyo aparte: sus videos, su baúl, sus fichas y sus ' +
      'planes. Al cambiar de marca no cambia nada de la pantalla — cambian los datos.</p>' +
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
      }).join('');
    document.body.appendChild(m);

    var r = ancla.getBoundingClientRect();
    m.style.top = Math.round(r.bottom + 10) + 'px';
    m.style.right = Math.round(window.innerWidth - r.right) + 'px';

    m.querySelector('[data-perfil]').onclick = function () { cerrarMenu(); editarPerfil(); };
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
.chv-nota{margin:-8px 0 14px;font-size:11.5px;color:rgba(244,236,231,.38)}\
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
@media (prefers-reduced-motion:reduce){.chm{animation:none}}';

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
    opciones: function (lista) { extra = lista || []; },
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
    if (!puente && Array.isArray(doc.cuentas) && doc.cuentas.length) pintaAvatar();
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

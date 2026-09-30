/* app.js — la herramienta Carruseles con composición (30-sep-2026).
 *
 * Cuatro pasos, cada uno en una pantalla: Empezar (Dame ideas · Te cuento la idea · Lámina por lámina · Desde un video)
 * → Ideas (solo con «Dame ideas») → Estilo → Editor (control total de cada elemento, lienzo.js).
 * Lo de cada persona se guarda en herramientas_datos › carruseles@<marca> (v:2). Las fotos viven en el cubo privado
 * `carruseles` y lo que Cherry ve en cada una en la tabla carrusel_fotos (función «carruseles», acción foto_analizar).
 * Nunca diálogos del navegador: todo aviso va en una ventana propia.
 */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ic = function (n, s) { return LZ.ico(n, s); };
  var copia = function (o) { return JSON.parse(JSON.stringify(o)); };
  var F = FAMILIAS, USR = CherryApp.usuario() || {};
  var FIRMA_S = 12 * 3600;
  var S3_PUB = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/';

  /* ══════════ Estado ══════════ */
  var E = {
    vista: 'lista', lista: [], filtro: 'todos', actual: null, tab: 'texto', estados: {},
    crear: { modo: 'idea', texto: '', plan: [], n: 0, obj: 'tutorial', palabra: '', familia: 'guardable', nicho: '', vx: 'ideas' },
    video: null, revision: null, ideas: null, marca: {}, fotos: [], clips: [], videos: [], firmas: {}, cargado: false, volverDeEstilos: 'empezar',
  };
  var car = function () { return E.lista.filter(function (c) { return c.id === E.actual; })[0] || null; };

  /* ══════════ Ventana propia, avisos y pasos de la IA ══════════ */
  function abrir(html) { $('#ventana').innerHTML = html; $('#velo').hidden = false; }
  function cerrar() { $('#velo').hidden = true; }
  $('#velo').addEventListener('click', function (e) { if (e.target.id === 'velo' && !$('#ventana .pasos-ia')) cerrar(); });
  function preguntar(o) {
    return new Promise(function (ok) {
      abrir('<h3>' + esc(o.titulo) + '</h3><p>' + esc(o.texto) + '</p><div class="fila"><button type="button" class="btn ' + (o.peligro ? 'btn-rosa' : 'btn-claro') + '" id="p-si">' + esc(o.si || 'Sí') + '</button><button type="button" class="btn btn-linea" id="p-no">' + esc(o.no || 'Cancelar') + '</button></div>');
      $('#p-si').onclick = function () { cerrar(); ok(true); };
      $('#p-no').onclick = function () { cerrar(); ok(false); };
    });
  }
  var tAviso;
  function aviso(txt) { var a = $('#aviso-flota'); a.textContent = txt; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(function () { a.hidden = true; }, 5200); }
  function pasos(etiqueta, titulo, lista) {
    abrir('<div class="etiqueta">' + esc(etiqueta) + '</div><h3>' + esc(titulo) + '</h3><ol class="pasos-ia">' + lista.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>');
    var li = $$('#ventana li'), i = 0;
    function marcar() { li.forEach(function (x, k) { x.className = k < i ? 'hecho' : k === i ? 'ahora' : ''; }); }
    marcar();
    return { sig: function () { i = Math.min(li.length, i + 1); marcar(); }, fin: function () { i = li.length; marcar(); setTimeout(cerrar, 250); }, error: cerrar };
  }
  function fallo(e, que) { cerrar(); console.warn('[carruseles]', e); abrir('<h3>No se pudo ' + esc(que) + '</h3><p>' + esc((e && e.message) || e) + '</p><div class="fila"><button type="button" class="btn btn-claro" id="p-ok">Entendido</button></div>'); $('#p-ok').onclick = cerrar; }

  /* ══════════ Guardar ══════════ */
  function guardar() {
    var el = $('#ed-guardado'); if (el) el.textContent = 'Guardando…';
    CherryApp.guardar('carruseles', { v: 2, lista: E.lista, crear: E.crear }, function (st) {
      if (!el) return; el.textContent = st === 'ok' ? 'Guardado' : st === 'error' ? 'No se guardó: revisa tu conexión' : 'Guardando…';
    });
  }
  var tGuardar;
  function guardarLuego() { clearTimeout(tGuardar); tGuardar = setTimeout(guardar, 700); }
  function aplicar(d) {
    if (!d || typeof d !== 'object') return false;
    E.lista = Array.isArray(d.lista) ? d.lista.filter(function (c) { return c && c.id; }) : [];
    if (d.crear && typeof d.crear === 'object') Object.assign(E.crear, d.crear);
    if (['nicho', 'idea', 'manual', 'video'].indexOf(E.crear.modo) < 0) E.crear.modo = 'idea';
    if (!Array.isArray(E.crear.plan)) E.crear.plan = [];
    return true;
  }

  /* ══════════ Marca y kit ══════════ */
  var LETRAS_TIT = { montserrat: 'Montserrat', anton: 'Anton', bebas: 'Bebas Neue', archivo: 'Archivo Black', bricolage: 'Bricolage Grotesque', playfair: 'Playfair Display', dmserif: 'DM Serif Display', caveat: 'Caveat' };
  var LETRAS_TXT = { dmsans: 'DM Sans', poppins: 'Poppins', nunito: 'Nunito', worksans: 'Work Sans', 'montserrat-t': 'Montserrat', lora: 'Lora' };
  var LETRAS = ['Anton', 'Bebas Neue', 'Archivo Black', 'Oswald', 'Montserrat', 'Bricolage Grotesque', 'Playfair Display', 'DM Serif Display', 'Fraunces', 'Inter', 'Poppins', 'DM Sans', 'Work Sans', 'Lora', 'Caveat', 'Outfit', 'Space Grotesk'];
  function hexOk(h) { return /^#[0-9a-f]{6}$/i.test(String(h || '')) ? String(h).toUpperCase() : null; }
  function luzDe(h) { var c = [1, 3, 5].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function kitDe(famId) {
    var f = F.de(famId), base = F.de('guardable');
    var L = f.letras || base.letras, C = f.colores || base.colores;
    var k = { titular: L.titular, mano: L.mano, cuerpo: L.cuerpo, principal: C.principal, acento: C.acento, fondo: C.fondo, texto: C.texto };
    var m = E.marca || {};
    if (m.usos && m.usos.carruseles === false) return k;
    var col = m.colores || {};
    if (hexOk(col.principal)) k.principal = hexOk(col.principal);
    if (hexOk(col.acento) || hexOk(col.secundario)) k.acento = hexOk(col.acento) || hexOk(col.secundario);
    if (hexOk(col.fondo) && luzDe(hexOk(col.fondo)) > .5) { k.fondo = hexOk(col.fondo); k.texto = '#141414'; }
    if (LETRAS_TIT[m.letraTitulos]) k.titular = LETRAS_TIT[m.letraTitulos];
    if (LETRAS_TXT[m.letraTexto]) k.cuerpo = LETRAS_TXT[m.letraTexto];
    return k;
  }
  function vozDe(m) { return m ? { tono: m.tono || null, frases: Array.isArray(m.frases) ? m.frases.map(function (x) { return { tipo: x.tipo, texto: x.texto }; }) : [] } : null; }

  /* ══════════ Fotos y clips de la marca ══════════ */
  function firmar(rutas) {
    rutas = rutas.filter(function (r) { return r && !(E.firmas[r] && E.firmas[r].vence > Date.now() + 1800e3); });
    if (!rutas.length) return Promise.resolve();
    return CherryApp.rest('/storage/v1/object/sign/carruseles', { method: 'POST', body: JSON.stringify({ expiresIn: FIRMA_S, paths: rutas }) }).then(function (r) {
      var vence = Date.now() + FIRMA_S * 1000;
      (r || []).forEach(function (x) { if (x && x.path && x.signedURL) E.firmas[x.path] = { url: CherryApp.base() + '/storage/v1' + x.signedURL, vence: vence }; });
    }).catch(function (e) { console.warn('[carruseles] no pude firmar:', e); });
  }
  var urlDe = function (ruta) { return ruta && E.firmas[ruta] ? E.firmas[ruta].url : ''; };
  function conUrls(f) { f.url = urlDe(f.ruta); f.recorte_url = urlDe(f.recorte_ruta); return f; }
  function cargarFotos() {
    return CherryApp.rest('/rest/v1/carrusel_fotos?select=id,ruta,w,h,persona,cara,rejilla,recorte_ruta,recorte_caja,origen,creado&user_id=eq.' + USR.id + '&marca=eq.' + encodeURIComponent(CherryApp.marcaActual()) + '&order=creado.desc&limit=80')
      .then(function (fs) {
        fs = Array.isArray(fs) ? fs : [];
        return firmar([].concat.apply([], fs.map(function (f) { return [f.ruta, f.recorte_ruta]; }))).then(function () { E.fotos = fs.map(conUrls); });
      }).catch(function (e) { console.warn('[carruseles] fotos:', e); E.fotos = []; });
  }
  function cargarClips() {
    return CherryApp.rest('/rest/v1/projects?select=id,marca&user_id=eq.' + USR.id + '&order=created_at.desc&limit=120').then(function (ps) {
      var ids = (Array.isArray(ps) ? ps : []).filter(function (p) { return CherryApp.esDeMarca(p.marca); }).map(function (p) { return p.id; }).slice(0, 60);
      if (!ids.length) return [];
      return CherryApp.rest('/rest/v1/clips?select=id,thumbnail_url,mp4_path,duration_sec,file_name,created_at&project_id=in.(' + ids.join(',') + ')&thumbnail_url=not.is.null&order=created_at.desc&limit=60');
    }).then(function (cs) { E.clips = (Array.isArray(cs) ? cs : []).map(function (c) { return { id: c.id, url: c.thumbnail_url, video: c.mp4_path && /^clips\//.test(c.mp4_path) ? S3_PUB + c.mp4_path : '', dur: c.duration_sec || 6, nombre: c.file_name }; }); })
      .catch(function (e) { console.warn('[carruseles] clips:', e); E.clips = []; });
  }
  // las direcciones firmadas vencen: al abrir, cada elemento vuelve a tener la suya
  function refrescarUrls(c) {
    var ids = {};
    (c.laminas || []).forEach(function (l) { l.els.forEach(function (e) { if (e.ref && e.ref.foto) ids[e.ref.foto] = 1; }); });
    var falta = Object.keys(ids).filter(function (id) { return !E.fotos.some(function (f) { return f.id === id; }); });
    var p = falta.length ? CherryApp.funcion('carruseles', { accion: 'fotos', ids: falta }).then(function (r) { var fs = (r && r.fotos) || []; return firmar([].concat.apply([], fs.map(function (f) { return [f.ruta, f.recorte_ruta]; }))).then(function () { fs.forEach(function (f) { E.fotos.push(conUrls(f)); }); }); }).catch(function () {}) : Promise.resolve();
    return p.then(function () {
      (c.laminas || []).forEach(function (l) { l.els.forEach(function (e) {
        if (!e.ref || !e.ref.foto) return;
        var f = E.fotos.filter(function (x) { return x.id === e.ref.foto; })[0]; if (!f) return;
        var u = e.ref.campo === 'recorte' ? f.recorte_url : f.url; if (u) e.src = u;
      }); });
    });
  }
  function achicar(archivo, lado) {
    return new Promise(function (ok, mal) {
      var im = new Image(), u = URL.createObjectURL(archivo);
      im.onload = function () {
        var k = Math.min(1, lado / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
        cv.toBlob(function (b) { if (b) ok(b); else mal(new Error('no pude preparar la foto')); }, 'image/jpeg', .9);
      };
      im.onerror = function () { URL.revokeObjectURL(u); mal(new Error('Ese archivo no es una foto que se pueda leer.')); };
      im.src = u;
    });
  }
  // sube una foto (o un fotograma) y Cherry la mira: persona, cara, dónde cabe el texto y su recorte
  function subirFoto(blob, origen) {
    var ruta = USR.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    return (blob.type === 'image/jpeg' && blob.size < 1.5e6 && origen === 'fotograma' ? Promise.resolve(blob) : achicar(blob, 1600)).then(function (b) {
      return CherryApp.rest('/storage/v1/object/carruseles/' + ruta, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: b });
    }).then(function () {
      return CherryApp.funcion('carruseles', { accion: 'foto_analizar', ruta: ruta, marca: CherryApp.marcaActual(), origen: origen || 'subida' });
    }).then(function (r) {
      var f = r.foto; return firmar([f.ruta, f.recorte_ruta]).then(function () { conUrls(f); E.fotos.unshift(f); return f; });
    });
  }
  function subirVarias(archivos, alTerminar) {
    var lista = Array.prototype.slice.call(archivos || []).filter(function (a) { return /^image\//.test(a.type); }).slice(0, 12);
    if (!lista.length) return;
    aviso('Cherry está mirando ' + lista.length + (lista.length === 1 ? ' foto…' : ' fotos…'));
    var hechas = 0;
    Promise.all(lista.map(function (a) { return subirFoto(a, 'subida').then(function () { hechas++; }, function (e) { console.warn(e); }); })).then(function () {
      aviso(hechas ? 'Listo: ' + hechas + (hechas === 1 ? ' foto lista.' : ' fotos listas.') + ' Cherry ya sabe dónde estás en cada una.' : 'No se pudo subir ninguna foto. Prueba otra vez.');
      if (alTerminar) alTerminar();
    });
  }

  /* ══════════ Navegación ══════════ */
  function ir(v) {
    E.vista = v;
    ['lista', 'empezar', 'ideas', 'estilos', 'video', 'editor'].forEach(function (x) { $('#v-' + x).hidden = x !== v; });
    $$('video').forEach(function (x) { if (!x.closest('#v-' + v)) x.pause(); });
    if (v === 'lista') pintarLista();
    if (v === 'empezar') pintarEmpezar();
    if (v === 'estilos') pintarEstilos();
    if (v === 'editor') pintarEditor();
    if (v === 'video') pintarRevision();
    scrollTo(0, 0);
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-ir]'); if (b) ir(b.dataset.ir); });

  /* ══════════ Lista ══════════ */
  $$('[data-filtro]').forEach(function (b) { b.onclick = function () { E.filtro = b.dataset.filtro; $$('[data-filtro]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); pintarLista(); }; });
  $('#b-nuevo').onclick = function () { E.crear.modo = E.crear.modo === 'video' ? 'idea' : E.crear.modo; ir('empezar'); };
  $$('[data-atajo]').forEach(function (b) { b.onclick = function () { E.crear.modo = b.dataset.atajo; ir('empezar'); }; });
  function hace(t) { var d = Math.round((Date.now() - t) / 86400000); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días'; }
  function pintarLista() {
    var todos = E.lista.filter(function (c) { var st = E.estados[c.id] || 'borrador'; return E.filtro === 'todos' || st === E.filtro; });
    $('#lista-cuenta').textContent = E.lista.length ? '(' + E.lista.length + ')' : '';
    var R = $('#rejilla');
    if (!E.lista.length) { R.innerHTML = '<div class="vacia-lista">' + (E.cargado ? 'Todavía no tienes carruseles en esta marca. Empieza con «Nuevo carrusel».' : 'Cargando tus carruseles…') + '</div>'; return; }
    R.innerHTML = todos.map(function (c) {
      var st = E.estados[c.id] || 'borrador';
      var tapa = c.v === 2 ? '<div class="mini-vivo ' + (c.alto === 1350 ? 'alto-1350' : '') + '" data-mini="' + c.id + '"></div>' : '<div class="vieja">Carrusel de la versión anterior<br><br>Ábrelo para rehacerlo con los estilos nuevos</div>';
      return '<button type="button" class="vol tarjeta-car" data-abrir="' + c.id + '">' + tapa + '<b>' + esc(c.nombre || 'Carrusel') + '</b><span class="meta"><span>' + (c.laminas ? c.laminas.length : 0) + ' láminas · ' + hace(c.creado || Date.now()) + '</span><span class="estado ' + st + '">' + st + '</span></span></button>';
    }).join('') || '<div class="vacia-lista">No hay carruseles con ese filtro.</div>';
    $$('[data-mini]').forEach(function (d) { var c = E.lista.filter(function (x) { return x.id === d.dataset.mini; })[0]; if (c && c.laminas && c.laminas[0]) LZ.miniCon(d, c.laminas[0], d.clientWidth || 200, c.kit, c.alto); });
    $$('[data-abrir]').forEach(function (b) { b.onclick = function () { abrirCarrusel(b.dataset.abrir); }; });
  }
  function abrirCarrusel(id) {
    var c = E.lista.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    if (c.v !== 2) {   // de la versión anterior: se rehace con sus textos
      var txt = [c.nombre].concat((c.laminas || []).map(function (l) { return [l.titulo, l.texto].filter(Boolean).join(': '); })).filter(Boolean).join('\n');
      preguntar({ titulo: 'Rehacer con los estilos nuevos', texto: 'Este carrusel es de la versión anterior. Cherry lo vuelve a armar con sus mismos textos en el estilo que escojas; el viejo se queda como estaba.', si: 'Rehacerlo' }).then(function (ok) {
        if (!ok) return; E.crear.modo = 'idea'; E.crear.texto = txt.slice(0, 2500); ir('empezar');
      });
      return;
    }
    E.actual = id; E.tab = 'texto';
    refrescarUrls(c).then(function () { LZ.kit(c.kit); LZ.cargar(c.laminas, c.alto); LZ.listas(c.laminas).then(function () { if (E.vista === 'editor') LZ.pintar(); }); ir('editor'); });
  }

  /* ══════════ 1 · Empezar ══════════ */
  $$('.seg [data-modo]').forEach(function (b) { b.onclick = function () { E.crear.modo = b.dataset.modo; pintarEmpezar(); }; });   // ⚠️ .app también tiene data-modo (noche)
  $('#idea').oninput = function () { E.crear.texto = this.value; resumen(); };
  $$('[data-n]').forEach(function (b) {
    b.onclick = function () {
      var d = +b.dataset.n, n = E.crear.n;
      n = n === 0 && d > 0 ? 4 : n + d;
      if (n < 3) n = E.crear.modo === 'manual' ? 3 : 0;
      E.crear.n = Math.min(10, n); pintarContador(); resumen();
    };
  });
  $$('#objetivos .chip').forEach(function (b) { b.onclick = function () { E.crear.obj = b.dataset.obj; pintarEmpezar(); }; });
  $('#palabra').oninput = function () { E.crear.palabra = this.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, ''); this.value = E.crear.palabra; };
  $('#b-nicho-cambiar').onclick = function () { var i = $('#nicho-txt'); i.hidden = !i.hidden; if (!i.hidden) i.focus(); };
  $('#nicho-txt').oninput = function () { E.crear.nicho = this.value; $('#nicho-nom').textContent = this.value || nichoMarca() || 'Escribe tu nicho'; };
  $$('#v-extraer .chip').forEach(function (b) { b.onclick = function () { E.crear.vx = b.dataset.vx; pintarEmpezar(); }; });
  function nichoMarca() { var n = (E.marca && E.marca.negocio) || {}; return [n.que, n.palabras].filter(Boolean).join(' · '); }
  function pintarContador() {
    var C = E.crear;
    $('#n-lam').textContent = C.n ? C.n : 'Auto';
    var L = $('#lista-manual'), n = (C.n || 5) + 2;
    while (C.plan.length < n) C.plan.push('');
    L.innerHTML = C.plan.slice(0, n).map(function (p, i) {
      var et = i === 0 ? 'Portada' : i === n - 1 ? 'Cierre' : 'Lámina ' + (i + 1);
      return '<label>' + et + '<input type="text" data-plan="' + i + '" value="' + esc(p) + '" placeholder="' + (i === n - 1 ? 'Cherry escribe el cierre' : 'Cherry la escribe') + '"></label>';
    }).join('');
    $$('[data-plan]').forEach(function (i) { i.oninput = function () { C.plan[+i.dataset.plan] = i.value; }; });
  }
  function pintarEmpezar() {
    var C = E.crear, vid = C.modo === 'video';
    $$('.seg [data-modo]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.modo === C.modo); });
    $$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== C.modo; });
    $('#fila-video').hidden = !vid; $('#fila-normal').hidden = vid;
    if (C.modo === 'manual' && !C.n) C.n = 5;
    $('#idea').value = C.texto || '';
    $('#nicho-nom').textContent = C.nicho || nichoMarca() || 'Escribe de qué es tu cuenta';
    $('#nicho-de').textContent = C.nicho ? 'Lo escribiste tú.' : nichoMarca() ? 'Viene de tu identidad de marca.' : 'Tu identidad de marca todavía no dice de qué es tu cuenta.';
    if (!C.nicho && !nichoMarca()) $('#nicho-txt').hidden = false;
    $$('#objetivos .chip').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.obj === C.obj); });
    $$('#v-extraer .chip').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.vx === C.vx); });
    $('#palabra').hidden = !(C.obj === 'venta' || C.obj === 'llevar'); $('#palabra').value = C.palabra || '';
    $('#b-crear').textContent = C.modo === 'nicho' ? 'Dame 3 ideas' : vid ? 'Analizar video' : 'Crear carrusel';
    $('#e-marca').textContent = 'Nuevo carrusel · marca «' + (E.marca.nombre || 'principal') + '»';
    if (vid) pintarCuenta();
    pintarContador(); pintarEstiloMini('#estilo-mini'); resumen();
  }
  function pintarEstiloMini(sel) {
    var f = F.de(E.crear.familia);
    $(sel).innerHTML = '<div class="mini-vivo" data-tapa="' + f.id + '"></div><div><div class="etiqueta">Estilo</div><b>' + esc(f.nombre) + '</b> <button type="button" class="btn btn-linea btn-chico" data-cambiar-estilo>Cambiar</button></div>';
    tapaFamilia($(sel + ' [data-tapa]'), f.id, 54);
    $(sel + ' [data-cambiar-estilo]').onclick = function () { E.volverDeEstilos = E.vista; ir('estilos'); };
  }
  // la tapa de un estilo: su portada de muestra (imagen del catálogo aprobado)
  function tapaFamilia(el, id, ancho) { el.innerHTML = '<img src="carruseles/tapas/' + id + '.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display=\'none\'">'; }
  function resumen() {
    var C = E.crear, f = F.de(C.familia), vid = C.modo === 'video';
    var t = (C.texto || '').trim();
    $('#r-tema').textContent = vid ? (E.video ? 'Lo que digas y muestres en «' + E.video.nombre + '»' : 'Escoge o sube un video') : C.modo === 'nicho' ? 'Lo propone Cherry con tu nicho' : C.modo === 'manual' ? 'El que escribas lámina por lámina' : (t ? t.slice(0, 90) + (t.length > 90 ? '…' : '') : 'Escribe tu idea');
    $('#r-n').textContent = vid ? 'Una lámina por idea del video, más portada y cierre' : C.n ? C.n + ' láminas del medio, más portada y cierre' : 'Las decide Cherry según el tema';
    var o = { auto: 'Lo decide Cherry según el tema', tutorial: 'Enseñar: pasos o ejemplos y una lámina para guardar', motivacion: 'Motivar: frases e imágenes que inspiran', opinion: 'Opinión: una postura clara que invita a comentar', venta: 'Vender: problema, cómo se resuelve y la llamada a la acción', llevar: 'Llevar a algo: termina con «Comenta PALABRA»' };
    $('#r-obj').textContent = vid ? ({ ideas: 'Sus ideas, en el orden en que las dices', pasos: 'El paso a paso de lo que explicas', frases: 'Las frases más fuertes que dices', auto: 'Lo decide Cherry según el video' })[C.vx] : o[C.obj];
    $('#r-mat').innerHTML = vid ? 'Fotogramas de tu video (Cherry escoge el mejor de cada idea) y tus fotos para la portada.' : 'Tus fotos y videos de esta marca: <b>' + E.fotos.length + ' fotos</b> y <b>' + E.clips.length + ' clips</b>.';
    var k = kitDe(C.familia);
    $('#r-letras').textContent = (E.marca.colores ? 'Los de tu identidad de marca' : 'Los del estilo (tu identidad de marca no tiene colores todavía)') + ': ' + k.titular + ' y ' + k.cuerpo + '. Los cambias al final.';
    var av = F.aviso(C.familia, vid ? null : C.obj), el = $('#aviso-obj');
    el.hidden = !av;
    if (av) {
      el.innerHTML = '<div><b>' + esc(av.familia.nombre) + ' está pensada para ' + av.familia.ideal.map(function (x) { return F.NOMOBJ[x]; }).join(' y ') + '.</b> Para ' + F.NOMOBJ[C.obj] + ' te van mejor:</div><div class="fila">' +
        av.mejores.map(function (m) { return '<button type="button" class="chip" data-usar="' + m.id + '">' + esc(m.nombre) + '</button>'; }).join('') + '<button type="button" class="chip" data-seguir>Seguir con ' + esc(av.familia.nombre) + '</button></div>';
      $$('[data-usar]').forEach(function (b) { b.onclick = function () { C.familia = b.dataset.usar; pintarEmpezar(); }; });
      $('[data-seguir]').onclick = function () { el.hidden = true; };
    }
    var fr = $('#fotos-resumen'), conCara = E.fotos.filter(function (x) { return x.cara; }).length;
    fr.innerHTML = '<div class="fotos-fila">' + E.fotos.slice(0, 6).map(function (x) { return '<img src="' + esc(x.url) + '" alt="">'; }).join('') +
      '<label class="btn btn-linea btn-chico">＋ Subir fotos<input type="file" accept="image/*" multiple hidden id="subir-fotos-r"></label></div>' +
      (E.fotos.length && !conCara ? '<p class="pista">Ninguna foto tiene tu cara bien visible: para la portada sirve una donde se te vea de frente.</p>' : !E.fotos.length ? '<p class="pista">Sube 3 a 6 fotos tuyas: Cherry escoge la mejor para la portada y el cierre.</p>' : '');
    $('#subir-fotos-r').onchange = function () { subirVarias(this.files, function () { if (E.vista === 'empezar') resumen(); }); };
    $('#b-crear').disabled = vid && !E.video;
  }
  $('#b-crear').onclick = function () {
    var C = E.crear;
    if (C.modo === 'nicho') return pedirIdeas();
    if (C.modo === 'video') return analizarVideo();
    if (C.modo === 'idea' && !(C.texto || '').trim()) { aviso('Cuéntale a Cherry de qué es el carrusel (o usa «Dame ideas»).'); $('#idea').focus(); return; }
    crear();
  };

  /* ══════════ 2 · Ideas ══════════ */
  function pedirIdeas() {
    var nicho = E.crear.nicho || nichoMarca();
    if (!nicho) { aviso('Escribe de qué es tu cuenta para que Cherry te proponga ideas.'); $('#nicho-txt').hidden = false; $('#nicho-txt').focus(); return; }
    ir('ideas');
    $('#ideas-tit').textContent = 'Tres carruseles para ti';
    $('#lista-ideas').innerHTML = '<div class="cargando">Cherry está pensando en carruseles para «' + esc(nicho) + '»…</div>';
    CherryApp.funcion('carruseles', { accion: 'ideas', nicho: nicho, negocio: E.marca.negocio || null, voz: vozDe(E.marca), catalogo: F.CATALOGO.filter(function (f) { return f.lista; }).map(function (f) { return { id: f.id, nombre: f.nombre, ideal: f.ideal.map(function (x) { return F.NOMOBJ[x]; }).join(', ') }; }) })
      .then(function (r) { E.ideas = r.ideas || []; pintarIdeas(); }, function (e) { $('#lista-ideas').innerHTML = '<div class="cargando">No pude traer ideas: ' + esc(e.message) + '</div>'; });
  }
  $('#b-otras-ideas').onclick = pedirIdeas;
  function pintarIdeas() {
    $('#lista-ideas').innerHTML = (E.ideas || []).map(function (d, i) {
      var f = F.compositor(d.familia) ? F.de(d.familia) : F.de('guardable');
      return '<button type="button" class="vol idea" data-idea="' + i + '"><div class="fam"><div class="mini-vivo" style="width:46px" data-tapa="' + f.id + '"></div><div class="etiqueta">' + esc(f.nombre) + '</div></div><h3>' + esc(d.titulo) + '</h3><p>' + esc(d.gancho) + '</p><ul><li>' + d.n + ' láminas del medio · ' + esc(F.NOMOBJ[d.objetivo] || d.objetivo || '') + '</li>' + (d.lleva ? '<li>' + esc(d.lleva) + '</li>' : '') + (d.falta ? '<li>Te falta: ' + esc(d.falta) + '</li>' : '') + '</ul></button>';
    }).join('');
    $$('#lista-ideas [data-tapa]').forEach(function (el) { tapaFamilia(el, el.dataset.tapa, 46); });
    $$('[data-idea]').forEach(function (b) {
      b.onclick = function () {
        var d = E.ideas[+b.dataset.idea], C = E.crear;
        C.familia = F.compositor(d.familia) ? d.familia : 'guardable'; C.n = d.n; C.obj = d.objetivo in F.NOMOBJ || d.objetivo === 'auto' ? d.objetivo : 'tutorial';
        crear({ modo: 'idea', texto: d.titulo + '. ' + d.gancho });
      };
    });
  }

  /* ══════════ 3 · Estilo ══════════ */
  var filtroEstilo = 'todos';
  $$('#filtros-estilo .chip').forEach(function (b) { b.onclick = function () { filtroEstilo = b.dataset.f; $$('#filtros-estilo .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); pintarEstilos(); }; });
  $('#b-estilos-volver').onclick = function () { ir(E.volverDeEstilos || 'empezar'); };
  function pintarEstilos() {
    var pasa = function (f) { return filtroEstilo === 'todos' ? true : filtroEstilo === 'anim' ? !!f.anim : (f.ideal || []).concat(f.sirve || []).indexOf(filtroEstilo) >= 0; };
    $('#rejilla-estilos').innerHTML = F.CATALOGO.map(function (f) {
      return '<button type="button" class="fam-t ' + (pasa(f) ? '' : 'apagada') + (f.lista ? '' : ' pronto') + '" data-fam="' + f.id + '" aria-pressed="' + (f.id === E.crear.familia) + '"><img src="carruseles/tapas/' + f.id + '.jpg" alt="" loading="lazy"><span class="insignias">' + (f.anim ? '<span class="ins anim">▶ VIDEO</span>' : '') + (f.ia ? '<span class="ins ia">IA</span>' : '') + (f.lista ? '' : '<span class="ins pronto">PRONTO</span>') + '</span><b>' + esc(f.nombre) + '</b></button>';
    }).join('');
    $$('[data-fam]').forEach(function (b) { b.onclick = function () { verEstilo(b.dataset.fam); }; });
    verEstilo(E.estiloVisto || E.crear.familia);
  }
  function verEstilo(id) {
    E.estiloVisto = id;
    $$('[data-fam]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.fam === id); });
    var f = F.de(id), av = F.aviso(id, E.crear.obj);
    $('#detalle-estilo').innerHTML = '<img src="carruseles/tapas/' + f.id + '.jpg" alt="" style="width:100%;border-radius:12px">' +
      '<h3>' + esc(f.nombre) + '</h3>' +
      (av ? '<div class="aviso ambar"><div><b>Está pensada para ' + f.ideal.map(function (x) { return F.NOMOBJ[x]; }).join(' y ') + '.</b> Para ' + F.NOMOBJ[E.crear.obj] + ' te van mejor: ' + av.mejores.map(function (m) { return esc(m.nombre); }).join(', ') + '.</div></div>' : '') +
      '<div class="lista-def"><div><span>Ideal para</span><span>' + f.ideal.map(function (x) { return F.NOMOBJ[x]; }).join(', ') + (f.sirve && f.sirve.length ? ' · también ' + f.sirve.map(function (x) { return F.NOMOBJ[x]; }).join(', ') : '') + '</span></div>' +
      (f.no && f.no.length ? '<div><span>No sirve</span><span>' + f.no.map(function (x) { return F.NOMOBJ[x]; }).join(', ') + '</span></div>' : '') +
      '<div><span>Usa</span><span>' + esc(f.material) + '</span></div><div><span>Sale en</span><span>' + f.sale + ' · 1080×' + f.alto + '</span></div></div>' +
      (f.lista ? '<button type="button" class="btn btn-rosa" id="b-usar-estilo">Usar este estilo</button>' : '<div class="aviso ambar"><div><b>Llega pronto.</b> Este estilo ya está aprobado y se está pasando al editor nuevo.</div></div>');
    var b = $('#b-usar-estilo');
    if (b) b.onclick = function () {
      E.crear.familia = id;
      if (E.volverDeEstilos === 'editor' && car()) { cambiarEstiloCarrusel(id); return; }
      ir(E.volverDeEstilos || 'empezar');
    };
  }

  /* ══════════ Crear: director → compositor → editor ══════════ */
  function crear(extra) {
    var C = Object.assign({}, E.crear, extra || {}), f = F.de(C.familia), comp = F.compositor(C.familia) || F.compositor('guardable');
    var n = C.modo === 'manual' ? Math.max(1, (C.n || 5)) : C.n;
    var plan = C.modo === 'manual' ? C.plan.slice(0, n + 2) : [];
    var p = pasos(f.nombre, 'Cherry está armando tu carrusel', ['Leyendo tu idea y la voz de tu marca', 'Escribiendo cada lámina', 'Escogiendo tus fotos (dónde estás en cada una)', 'Acomodando el texto sin taparte']);
    CherryApp.funcion('carruseles', { accion: 'dirigir', modo: C.modo === 'nicho' ? 'nicho' : 'idea', texto: C.texto, nicho: C.nicho || nichoMarca(), plan: plan, n: n || comp.esquema.nItems, objetivo: C.obj, palabra: C.palabra, esquema: comp.esquema, voz: vozDe(E.marca), negocio: E.marca.negocio || null, marca: E.marca.nombre || '' })
      .then(function (cont) { p.sig(); p.sig(); return armar(f, cont, { objetivo: C.obj }); })
      .then(function (c) { p.sig(); E.lista.unshift(c); guardar(); p.fin(); abrirCarrusel(c.id); })
      .catch(function (e) { fallo(e, 'armar el carrusel'); });
  }
  function armar(f, cont, extra) {
    extra = extra || {};
    var comp = F.compositor(f.id), alto = extra.alto || f.alto || 1440, kit = extra.kit || kitDe(f.id);
    /* (30-sep) Para poner texto SOBRE la foto solo sirven fotos donde la cara no llena el cuadro: con un primer plano
       (cara > 7 % de la foto) el texto quedaba escondido detrás de la cabeza. Esas fotos (y los fotogramas de videos
       viejos) siguen sirviendo dentro de celulares y tarjetas: van como «clips». */
    var todas = (extra.fotos || []).concat(E.fotos.filter(function (x) { return x.url && (extra.fotos || []).indexOf(x) < 0 && (x.origen !== 'fotograma' || (extra.fotos || []).indexOf(x) >= 0); }));
    var apta = function (f) { return !f.cara || (f.cara[2] * f.cara[3]) / (f.w * f.h) < .07; };
    var cerradas = todas.filter(function (f) { return !apta(f); }).map(function (f) { return { id: f.id, url: f.url, foto: true }; });
    var material = { fotos: todas.filter(apta), clips: (extra.clips || E.clips).concat(extra.clips ? [] : cerradas) };
    LZ.kit(kit); LZ.tam(alto);
    var laminas = comp.armar(cont, material, alto);
    // (30-sep) un texto CHICO detrás del recorte no se lee (el cuerpo se come las letras): los grandes sí pueden ir detrás
    // de la persona (regla 13); los chicos van adelante, con su sombra
    var porId = {}; (material.clips || []).forEach(function (k) { porId[k.id] = k; });
    laminas.forEach(function (l) { l.els.forEach(function (e) { var k = e.tipo === 'video' && e.ref && porId[e.ref.clip]; if (k && k.ini != null) { e.ini = k.ini; e.dur = Math.max(2, Math.min(6, k.dur || 6)); } }); });
    laminas.forEach(function (l) {
      var r = l.els.filter(function (e) { return e.papel === 'recorte' && !e.oculto; })[0]; if (!r) return;
      l.els.forEach(function (e) { if (e.tipo === 'texto' && e.tam < 56 && e.z <= r.z) e.z = r.z + 1; });
    });
    return LZ.listas(laminas).then(function () {
      laminas.forEach(LZ.medir);
      return { id: 'c' + Date.now().toString(36), v: 2, nombre: cont.nombre || 'Carrusel', creado: Date.now(), familia: f.id, alto: alto, objetivo: extra.objetivo || '', kit: kit, contenido: cont, laminas: laminas, caption: cont.caption || '', tags: cont.tags || [], video: extra.video || null };
    });
  }
  // otro estilo o tamaño para el mismo contenido: se vuelve a armar (con Deshacer, que queda en el historial)
  function cambiarEstiloCarrusel(id, alto) {
    var c = car(); if (!c) return;
    var f = F.de(id);
    preguntar({ titulo: alto ? 'Cambiar el tamaño' : 'Cambiar a ' + f.nombre, texto: 'Cherry vuelve a armar las láminas con el mismo texto. Los cambios que hiciste a mano en las láminas se reemplazan (puedes deshacerlo).', si: 'Sí, cambiar' }).then(function (ok) {
      if (!ok) { ir('editor'); return; }
      armar(f, c.contenido, { alto: alto || f.alto, kit: id === c.familia ? c.kit : kitDe(id), objetivo: c.objetivo }).then(function (n) {
        c.familia = id; c.alto = n.alto; c.kit = n.kit; c.laminas = n.laminas; LZ.cargar(c.laminas, c.alto); guardar(); ir('editor');
      }).catch(function (e) { fallo(e, 'cambiar el estilo'); });
    });
  }

  /* ══════════ Desde un video ══════════ */
  $('#ic-subir').innerHTML = ic('upload', 22);
  var pc = 'cherry';
  $$('#pest-cuenta button').forEach(function (b) { b.onclick = function () { pc = b.dataset.pc; $$('#pest-cuenta button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); pintarCuenta(); }; });
  function pintarCuenta() {
    var C = $('#videos-cuenta');
    if (pc === 'ig') { C.innerHTML = '<div class="vacio">Pronto: cuando Meta apruebe la app de Cherry, aquí salen los videos que ya publicaste en Instagram.</div>'; return; }
    if (!E.videos.length) { C.innerHTML = '<div class="vacio">' + (E.videosCargados ? 'Todavía no tienes videos terminados en esta marca. Sube uno desde tu computador.' : 'Buscando tus videos…') + '</div>'; return; }
    C.innerHTML = E.videos.map(function (v) { return '<button type="button" class="vc" data-vc="' + v.id + '" aria-pressed="' + (E.video && E.video.id === v.id) + '"><img src="' + esc(v.tapa) + '" alt=""><span>' + esc(v.titulo) + '</span></button>'; }).join('');
    $$('[data-vc]').forEach(function (b) { b.onclick = function () { var v = E.videos.filter(function (x) { return x.id === b.dataset.vc; })[0]; escogerVideo({ tipo: 'cherry', id: v.id, nombre: v.titulo, url: v.video, tapa: v.tapa, render: v.render, dur: v.dur }); }; });
  }
  function escogerVideo(v) {
    E.video = v; E.revision = null;
    var box = $('#video-elegido');
    box.innerHTML = '<video src="' + esc(v.url) + '" muted loop autoplay playsinline></video><div style="display:grid;gap:6px"><div class="etiqueta">' + (v.tipo === 'subido' ? 'Video subido' : 'Video de Cherry') + '</div><b>' + esc(v.nombre) + '</b><span class="pista" id="ve-dur">' + (v.peso || '') + '</span><div class="fila"><button type="button" class="btn btn-linea btn-chico" id="ve-cambiar">Cambiar video</button></div></div>';
    box.hidden = false; $('#video-origen').hidden = true;
    var vid = box.querySelector('video');
    vid.onloadedmetadata = function () { if (isFinite(vid.duration)) { v.dur = vid.duration; $('#ve-dur').textContent = 'Dura ' + mmss(vid.duration) + (v.peso ? ' · ' + v.peso : ''); } };
    vid.onerror = function () { $('#ve-dur').textContent = (v.peso ? v.peso + ' · ' : '') + 'este navegador no lo puede mostrar, pero Cherry igual lo escucha.'; };
    $('#ve-cambiar').onclick = function () { E.video = null; box.hidden = true; $('#video-origen').hidden = false; pintarCuenta(); resumen(); };
    resumen();
  }
  var zona = $('#zona-subir'), archivo = $('#archivo-video');
  archivo.onchange = function () { if (archivo.files[0]) subido(archivo.files[0]); };
  zona.ondragover = function (e) { e.preventDefault(); zona.classList.add('encima'); };
  zona.ondragleave = function () { zona.classList.remove('encima'); };
  zona.ondrop = function (e) { e.preventDefault(); zona.classList.remove('encima'); if (e.dataTransfer.files[0]) subido(e.dataTransfer.files[0]); };
  function subido(f) {
    var mb = f.size / 1048576;
    escogerVideo({ tipo: 'subido', id: 'subido', nombre: f.name, archivo: f, url: URL.createObjectURL(f), peso: mb > 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.max(1, Math.round(mb)) + ' MB' });
  }
  var mmss = function (t) { t = Math.max(0, t || 0); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };
  function audioDe(archivo) {
    var AC = window.AudioContext || window.webkitAudioContext, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || !OAC) return Promise.reject(new Error('Este navegador no sabe leer el audio de un video.'));
    return archivo.arrayBuffer().then(function (buf) {
      var ctx = new AC();
      return new Promise(function (bien, mal) { ctx.decodeAudioData(buf, bien, function () { mal(new Error('Ese archivo no trae audio que se pueda leer.')); }); }).then(function (audio) {
        try { ctx.close(); } catch (e) {}
        var seg = Math.min(audio.duration, 780), destino = new OAC(1, Math.ceil(seg * 16000), 16000), fuente = destino.createBufferSource();
        fuente.buffer = audio; fuente.connect(destino.destination); fuente.start(0, 0, seg);
        return destino.startRendering().then(function (r) { return { pcm: r.getChannelData(0), dur: seg }; });
      });
    });
  }
  function aWav(pcm) {
    var n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    var txt = function (p, s) { for (var i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var x = pcm[i] < -1 ? -1 : pcm[i] > 1 ? 1 : pcm[i]; v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7FFF, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }
  function palabrasDelVideo(v) {
    if (v.tipo === 'subido') {
      return audioDe(v.archivo).then(function (a) {
        var forma = new FormData(); forma.append('audio', aWav(a.pcm), 'audio.wav');
        return CherryApp.funcionArchivo('carruseles', forma).then(function (r) { return { palabras: r.palabras || [], dur: r.dur || a.dur }; });
      });
    }
    return CherryApp.rest('/rest/v1/renders?select=subtitle_phrases,clean_words_json&id=eq.' + v.render).then(function (f) {
      var r = Array.isArray(f) && f[0], pal = r ? ((r.subtitle_phrases && r.subtitle_phrases.palabras) || r.clean_words_json || []) : [];
      pal = (Array.isArray(pal) ? pal : []).filter(function (w) { return !w.removed; }).map(function (w) { return { w: w.word || w.text || '', s: Number(w.start) || 0, e: Number(w.end) || 0 }; });
      return { palabras: pal, dur: v.dur || (pal.length ? pal[pal.length - 1].e : 0) };
    });
  }
  function analizarVideo() {
    var v = E.video; if (!v) return;
    var f = F.de(E.crear.familia), comp = F.compositor(f.id) || F.compositor('guardable');
    var p = pasos(v.nombre, 'Cherry está viendo tu video', ['Escuchando lo que dices', 'Sacando las ideas', 'Buscando el mejor momento de cada idea', 'Listo']);
    palabrasDelVideo(v).then(function (a) {
      if (!a.palabras.length) throw new Error('No encontré lo que se dice en ese video (¿tiene voz?).');
      p.sig();
      return CherryApp.funcion('carruseles', { accion: 'desde_video', palabras: a.palabras, duracion: a.dur, extraer: E.crear.vx, esquema: comp.esquema, voz: vozDe(E.marca), marca: E.marca.nombre || '' });
    }).then(function (r) {
      if (!r.ideas || !r.ideas.length) throw new Error('No encontré ideas claras en ese video.');
      p.sig();
      E.revision = { tema: r.tema, contenido: r.contenido, ideas: r.ideas.map(function (x) { return Object.assign({ si: true, img: '' }, x); }), sel: null };
      return fotogramas(E.revision.ideas);
    }).then(function () { p.fin(); ir('video'); }).catch(function (e) { fallo(e, 'analizar el video'); });
  }
  // un fotograma por idea, sacado del video en el navegador (sin subir nada todavía)
  var vidOculto = null;
  function cuadroEn(url, t) {
    return new Promise(function (ok) {
      if (!vidOculto) { vidOculto = document.createElement('video'); vidOculto.muted = true; vidOculto.playsInline = true; vidOculto.crossOrigin = 'anonymous'; vidOculto.preload = 'auto'; }
      var v = vidOculto, listo = false;
      var tomar = function () { if (listo) return; listo = true; ok(cuadro(v)); };
      var ir2 = function () { v.onseeked = tomar; try { v.currentTime = Math.max(0.05, t); } catch (e) { ok(null); } setTimeout(function () { if (!listo) { listo = true; ok(null); } }, 6000); };
      if (v.getAttribute('src') !== url) { v.onloadeddata = ir2; v.onerror = function () { ok(null); }; v.src = url; } else ir2();
    });
  }
  function cuadro(v) {
    try { var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; if (!c.width) return null; c.getContext('2d').drawImage(v, 0, 0); return c.toDataURL('image/jpeg', .88); }
    catch (e) { return null; }   // un video de otro dominio sin permiso no deja sacar el cuadro
  }
  function fotogramas(ideas) {
    var url = E.video.url, i = 0;
    function sig() { if (i >= ideas.length) return Promise.resolve(); var x = ideas[i++]; return cuadroEn(url, (x.t_ini + Math.min(1.2, Math.max(.3, (x.t_fin - x.t_ini) / 2)))).then(function (d) { x.img = d || E.video.tapa || ''; x.cuadroPropio = !!d; }).then(sig); }
    return sig();
  }
  var COL_IDEA = ['#FF2D8A', '#FFC93C', '#38D9B0', '#8B7CFF', '#FF7A45', '#4FC3F7', '#E1251B', '#B8F35A'];
  function pintarRevision() {
    var R = E.revision, v = E.video; if (!R || !v) { ir('empezar'); return; }
    var vid = $('#rv-video'), dur = v.dur || Math.max.apply(null, R.ideas.map(function (x) { return x.t_fin; })) || 1;
    if (vid.getAttribute('src') !== v.url) vid.src = v.url;
    $('#rv-etiqueta').textContent = 'Desde un video · ' + v.nombre + ' · ' + mmss(dur);
    pintarEstiloMini('#rv-estilo');
    $('#rv-resumen').innerHTML = (R.tema ? '<span>Tema: <b>' + esc(R.tema) + '</b></span>' : '') + '<span><b>' + R.ideas.length + ' ideas</b></span><span>Estilo: <b>' + esc(F.de(E.crear.familia).nombre) + '</b></span>';
    var n = R.ideas.filter(function (x) { return x.si; }).length;
    $('#b-crear-video').textContent = 'Crear carrusel con ' + n + (n === 1 ? ' idea' : ' ideas'); $('#b-crear-video').disabled = !n;
    $('#rv-linea').innerHTML = R.ideas.map(function (x, i) { return '<button type="button" data-salta="' + i + '" style="left:' + Math.min(96, Math.max(4, x.t_ini / dur * 100)) + '%;background:' + COL_IDEA[i % 8] + ';opacity:' + (x.si ? 1 : .35) + '" title="' + esc(x.titulo) + '">' + (i + 1) + '</button>'; }).join('') + '<i id="rv-cursor" style="left:0"></i>';
    var k = 0;
    $('#rv-ideas').innerHTML = R.ideas.map(function (x, i) {
      if (x.si) k++;
      return '<div class="rv-idea ' + (x.si ? '' : 'fuera') + '"><input type="checkbox" data-si="' + i + '" ' + (x.si ? 'checked' : '') + ' aria-label="Usar esta idea"><button type="button" class="t" data-salta="' + i + '" style="border-color:' + COL_IDEA[i % 8] + '">' + mmss(x.t_ini) + '</button><button type="button" class="fr" data-momento="' + i + '" aria-pressed="' + (R.sel === i) + '" title="Escoger otro momento"><img src="' + esc(x.img) + '" alt=""></button><div><b>' + esc(x.titulo) + '</b><q>' + esc(x.frase) + '</q></div><span class="a">' + (x.si ? '→ lámina ' + (k + 1) : 'no va') + '</span></div>';
    }).join('');
    pintarAccionVideo();
    $$('#v-video [data-salta]').forEach(function (b) { b.onclick = function () { vid.currentTime = R.ideas[+b.dataset.salta].t_ini; vid.pause(); }; });
    $$('[data-si]').forEach(function (c) { c.onchange = function () { R.ideas[+c.dataset.si].si = c.checked; pintarRevision(); }; });
    $$('[data-momento]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.momento; R.sel = R.sel === i ? null : i; vid.currentTime = R.ideas[i].t_ini; vid.pause(); pintarRevision(); }; });
    vid.ontimeupdate = function () { var c = $('#rv-cursor'); if (c) c.style.left = (vid.currentTime / dur * 100) + '%'; };
  }
  function pintarAccionVideo() {
    var A = $('#rv-accion'), R = E.revision, i = R.sel;
    if (i == null) { A.innerHTML = '<span class="pista">Toca una marca de la línea o un minuto para ir a esa idea.</span>'; return; }
    A.innerHTML = '<span class="pista" style="flex:1 1 100%">Mueve el video al momento que quieras para la idea ' + (i + 1) + ':</span><button type="button" class="btn btn-rosa btn-chico" id="usar-momento">Usar este momento</button><button type="button" class="btn btn-linea btn-chico" id="cancelar-momento">Cancelar</button>';
    $('#usar-momento').onclick = function () { var d = cuadro($('#rv-video')); if (d) { R.ideas[i].img = d; R.ideas[i].cuadroPropio = true; } else aviso('Este video no deja sacar cuadros en el navegador; se usa su carátula.'); R.sel = null; pintarRevision(); };
    $('#cancelar-momento').onclick = function () { R.sel = null; pintarRevision(); };
  }
  $('#b-crear-video').onclick = function () {
    var R = E.revision, f = F.de(E.crear.familia), comp = F.compositor(f.id) || F.compositor('guardable');
    var usadas = R.ideas.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.si; });
    var p = pasos(f.nombre + ' · desde tu video', 'Cherry está armando tu carrusel', ['Guardando el fotograma de cada idea', 'Viendo dónde estás en cada fotograma', 'Escribiendo cada lámina con lo que dijiste', 'Acomodando el texto sin taparte']);
    // los fotogramas se suben como fotos: así Cherry también sabe dónde está la persona en cada uno
    Promise.all(usadas.map(function (o) {
      if (!o.x.cuadroPropio || !/^data:image/.test(o.x.img)) return Promise.resolve(null);
      return fetch(o.x.img).then(function (r) { return r.blob(); }).then(function (b) { return subirFoto(b, 'fotograma'); }).catch(function (e) { console.warn('[carruseles] fotograma:', e); return null; });
    })).then(function (fotosVideo) {
      // (fase B) con un estilo animado cada idea va con SU tramo del video: el video tiene que estar en Cherry (S3)
      if (!f.anim) return fotosVideo;
      var v = E.video;
      if (v.tipo !== 'subido') return (v.videoS3 = v.url, fotosVideo);
      if (v.videoS3) return fotosVideo;
      $('#ventana .pasos-ia li:first-child').textContent = 'Subiendo tu video a Cherry (para ponerlo andando en las láminas)…';
      return CherryApp.subirGrande(v.archivo, function (pc) { $('#ventana .pasos-ia li:first-child').textContent = 'Subiendo tu video a Cherry… ' + pc + '%'; }).then(function (r) { v.videoS3 = r.url; return fotosVideo; });
    }).then(function (fotosVideo) {
      p.sig(); p.sig();
      var c = copia(R.contenido); c.items = usadas.map(function (o) { return (R.contenido.items || [])[o.i]; }).filter(Boolean);
      var clips = usadas.map(function (o, k) {
        var fo = fotosVideo[k], cl = fo ? { id: fo.id, url: fo.url, foto: true } : { id: 'tapa' + k, url: E.video.tapa || '' };
        if (f.anim && E.video.videoS3) { cl.video = E.video.videoS3; cl.ini = o.x.t_ini; cl.dur = Math.max(2, Math.min(6, (o.x.t_fin || o.x.t_ini + 6) - o.x.t_ini)); }
        return cl;
      });
      p.sig();
      return armar(f, c, { objetivo: E.crear.vx, clips: clips, fotos: fotosVideo.filter(Boolean), video: { nombre: E.video.nombre, render: E.video.render || null } });
    }).then(function (c) {
      // el celular de cada lámina guarda de qué foto salió (su dirección firmada se renueva al abrir)
      c.laminas.forEach(function (l) { l.els.forEach(function (e) { if (e.tipo === 'celular' && e.ref && e.ref.clip && E.fotos.some(function (x) { return x.id === e.ref.clip; })) e.ref = { foto: e.ref.clip, campo: 'foto' }; }); });
      E.lista.unshift(c); guardar(); p.fin(); abrirCarrusel(c.id);
    }).catch(function (e) { fallo(e, 'armar el carrusel'); });
  };

  /* ══════════ Editor ══════════ */
  $('#b-borrar-carrusel').innerHTML = ic('trash-2', 17);
  function pintarEditor() {
    var c = car(); if (!c) { ir('lista'); return; }
    $('#nombre-carrusel').value = c.nombre || '';
    $('#ed-meta').textContent = F.de(c.familia).nombre + ' · ' + c.laminas.length + ' láminas';
    var L = $('#lamina'); L.classList.toggle('alto-1350', c.alto === 1350);
    $('#tira').innerHTML = c.laminas.map(function (_, i) { return '<button type="button" class="mini" data-lam="' + i + '" aria-current="' + (i === LZ.i) + '"><div class="mini-vivo ' + (c.alto === 1350 ? 'alto-1350' : '') + '"></div><span>' + (i + 1) + '</span></button>'; }).join('');
    $$('[data-lam]').forEach(function (b) { b.onclick = function () { LZ.i = +b.dataset.lam; pintarEditor(); }; });
    LZ.montar(L, $('#escenario'));
    minis(); pintarAgregar(); pintarPanel();
  }
  function minis() { var c = car(); if (!c) return; $$('#tira .mini-vivo').forEach(function (d, i) { LZ.mini(d, i, d.clientWidth || 88); }); }
  var tMinis;
  LZ.on('cambio', function () {
    var c = car(); if (!c) return;
    c.laminas = LZ.laminas;
    clearTimeout(tMinis); tMinis = setTimeout(minis, 150); guardarLuego();
  });
  LZ.on('seleccion', function () { if (E.vista === 'editor') pintarPanel(); });
  LZ.on('material', function () { LZ.seleccionar(null); irTab('material'); });
  $('#nombre-carrusel').oninput = function () { var c = car(); if (c) { c.nombre = this.value; guardarLuego(); } };
  /* (30-sep) «Programar» deja las láminas LISTAS PARA INSTAGRAM antes de ir al calendario: Instagram las descarga desde
     SUS servidores, así que cada una tiene que estar en una dirección pública. Las imágenes van al cubo público
     `publicar` (en la carpeta de la persona; el servidor las borra cuando sale publicado) y las animadas ya salen en
     MP4 público. Se guardan en el carrusel como `publicable` y el calendario las toma de ahí. Máximo 10 (Instagram). */
  function prepararParaInstagram(c) {
    var n = Math.min(c.laminas.length, 10), sello = Date.now().toString(36);
    abrir('<div class="etiqueta">Programar</div><h3>Preparando ' + n + ' láminas para Instagram</h3><div class="barra-prog"><i id="prog"></i></div><p id="txt-prog">Preparando las letras y las fotos…</p>' +
      (c.laminas.length > 10 ? '<p class="pista">Instagram acepta hasta 10 láminas por carrusel: van las 10 primeras.</p>' : ''));
    var caja = document.createElement('div'); caja.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px;pointer-events:none';
    document.body.appendChild(caja);
    var css = '', medios = [], rutas = [];
    return librerias().then(function () { return LZ.listas(c.laminas); }).then(letrasIncrustadas).then(function (f) { css = f; }).then(function () {
      var i = 0;
      function sig() {
        if (i >= n) return;
        $('#txt-prog').textContent = 'Lámina ' + (i + 1) + ' de ' + n + '…'; $('#prog').style.width = Math.round(i / n * 100) + '%';
        if (LZ.tieneVideo(i)) {
          $('#txt-prog').textContent = 'Lámina ' + (i + 1) + ' de ' + n + ': armando el video (unos segundos)…';
          return mp4De(c, i, css, caja, true).then(function (url) { medios.push({ url: url, tipo: 'VIDEO' }); i++; return sig(); });
        }
        return imagenDe(c, i, css, caja).then(function (b) {
          if (!b) throw new Error('la lámina ' + (i + 1) + ' salió vacía');
          var ruta = USR.id + '/car-' + c.id + '-' + sello + '-' + (i + 1) + '.jpg';
          return CherryApp.rest('/storage/v1/object/publicar/' + ruta, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: b }).then(function () {
            medios.push({ url: CherryApp.base() + '/storage/v1/object/public/publicar/' + ruta, tipo: 'IMAGE' }); rutas.push(ruta); i++; return sig();
          });
        });
      }
      return sig();
    }).then(function () {
      if (medios.length < 2) throw new Error('Instagram pide al menos 2 láminas en un carrusel');
      c.publicable = { medios: medios, rutas: rutas, hecho: Date.now() };
      // se espera a que quede guardado: el calendario lo lee de la cuenta
      return new Promise(function (ok, no) {
        CherryApp.guardar('carruseles', { v: 2, lista: E.lista, crear: E.crear }, function (st) { if (st === 'ok') ok(); else if (st === 'error') no(new Error('no se pudo guardar')); });
      });
    }).then(function () { caja.remove(); cerrar(); }, function (e) { caja.remove(); throw e; });
  }
  $('#b-programar').onclick = function () {
    var c = car(); if (!c) return;
    LZ.seleccionar(null);
    prepararParaInstagram(c).then(function () { CherryApp.irA('calendario', 'programar=' + encodeURIComponent('car:' + c.id)); })
      .catch(function (e) { fallo(e, 'preparar las láminas para Instagram'); });
  };
  $('#b-borrar-carrusel').onclick = function () {
    var c = car(); if (!c) return;
    preguntar({ titulo: '¿Borrar este carrusel?', texto: '«' + (c.nombre || 'Carrusel') + '» y sus ' + c.laminas.length + ' láminas se borran. Tus fotos siguen en tu biblioteca.', si: 'Sí, borrar', peligro: true }).then(function (ok) {
      if (!ok) return; E.lista = E.lista.filter(function (x) { return x.id !== c.id; }); E.actual = null; guardar(); ir('lista'); aviso('Carrusel borrado.');
    });
  };
  function pintarAgregar() {
    $('#agregar').innerHTML = '<span class="etiqueta" style="margin-right:4px">Agregar</span>' +
      '<button type="button" class="chip" data-ag="texto">' + ic('type', 14) + ' Texto</button>' +
      '<button type="button" class="chip" data-ag="pastilla">' + ic('square', 14) + ' Pastilla</button>' +
      '<button type="button" class="chip" data-ag="forma">' + ic('square', 14) + ' Forma</button>' +
      '<button type="button" class="chip" data-ag="flecha">' + ic('spline', 14) + ' Flecha</button>' +
      '<button type="button" class="chip" data-ag="rayas">' + ic('sparkles', 14) + ' Rayitas</button>' +
      '<button type="button" class="chip" data-ag="imagen">' + ic('image', 14) + ' Foto</button>' +
      '<span class="sep"></span><button type="button" class="chip" id="b-deshacer" title="Deshacer (Ctrl+Z)">' + ic('undo-2', 14) + '</button><button type="button" class="chip" id="b-rehacer" title="Rehacer (Ctrl+Y)">' + ic('redo-2', 14) + '</button>';
    $$('[data-ag]').forEach(function (b) {
      b.onclick = function () {
        var t = b.dataset.ag;
        if (t === 'flecha') return LZ.agregar('flecha', { src: 'carruseles/piezas/fl-curva-tinta.png' });
        if (t === 'imagen') { E.agregarFoto = true; LZ.seleccionar(null); irTab('material'); aviso('Toca una foto de tu biblioteca para ponerla en la lámina.'); return; }
        LZ.agregar(t);
      };
    });
    $('#b-deshacer').onclick = function () { LZ.deshacer(); }; $('#b-rehacer').onclick = function () { LZ.rehacer(); };
  }
  function irTab(t) { E.tab = t; pintarPanel(); }
  $$('[data-tab]').forEach(function (b) { b.onclick = function () { LZ.seleccionar(null); irTab(b.dataset.tab); }; });

  /* ── el panel ── */
  function pintarPanel() {
    var P = $('#panel'); P.oninput = P.onchange = P.onclick = null;
    var el = LZ.sel();
    $$('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', !el && x.dataset.tab === E.tab); });
    if (el) return pintarElemento(P, el);
    if (E.tab === 'texto') return pintarTextos(P);
    if (E.tab === 'material') return pintarMaterial(P);
    if (E.tab === 'diseno') return pintarDiseno(P);
    if (E.tab === 'marca') return pintarLetras(P);
    if (E.tab === 'capas') return pintarCapas(P);
  }

  var ultimoTexto = null;
  function pintarTextos(P) {
    var c = car(), tx = LZ.lam().els.filter(function (e) { return e.tipo === 'texto'; }).sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    P.innerHTML = '<p class="pista">Todos los textos de esta lámina. Para cambiarle la letra, el tamaño o el color a uno, tócalo en la lámina.</p>' +
      tx.map(function (e) { return '<label class="campo"><span class="etiqueta">' + esc(e.nombre) + '</span><textarea data-t="' + e.id + '" rows="' + Math.min(3, 1 + Math.ceil(e.txt.length / 38)) + '">' + esc(e.txt) + '</textarea></label>'; }).join('') +
      '<div class="campo"><span class="etiqueta">Pídele a Cherry (sobre el último texto que tocaste)</span><div class="fila"><button type="button" class="chip" data-pide="corto">Más corto</button><button type="button" class="chip" data-pide="directo">Más directo</button><button type="button" class="chip" data-pide="gancho">Otro gancho</button><button type="button" class="chip" data-pide="como_yo">Como lo diría yo</button></div></div>' +
      '<div class="grupo" style="border-top:1px solid var(--linea);padding-top:12px"><div class="etiqueta">Texto de la publicación</div><textarea id="caption" rows="6">' + esc(c.caption || '') + '</textarea><label class="campo"><span class="etiqueta">Hashtags</span><textarea id="hashtags" rows="2">' + esc((c.tags || []).map(function (t) { return '#' + t; }).join(' ')) + '</textarea></label><button type="button" class="btn btn-linea btn-chico" id="b-copiar">Copiar texto y hashtags</button></div>';
    P.onfocusin = function (e) { var t = e.target.closest('[data-t]'); if (t) ultimoTexto = t.dataset.t; };
    P.oninput = function (e) {
      var t = e.target.closest('[data-t]'); if (t) { LZ.cambiar(LZ.buscar(t.dataset.t), { txt: t.value }, false); return; }
      if (e.target.id === 'caption') { c.caption = e.target.value; guardarLuego(); }
      if (e.target.id === 'hashtags') { c.tags = e.target.value.split(/\s+/).map(function (x) { return x.replace(/^#/, ''); }).filter(Boolean); guardarLuego(); }
    };
    P.onchange = function (e) { var t = e.target.closest('[data-t]'); if (t) LZ.cambiar(LZ.buscar(t.dataset.t), {}, true); };
    P.onclick = function (e) {
      var b = e.target.closest('[data-pide]');
      if (b) {
        var el = LZ.buscar(ultimoTexto) || tx.filter(function (x) { return /titular/.test(x.papel || ''); })[0] || tx[0]; if (!el) return;
        b.disabled = true; b.textContent = 'Escribiendo…';
        CherryApp.funcion('carruseles', { accion: 'reescribir', texto: el.txt, pedido: b.dataset.pide, voz: vozDe(E.marca) }).then(function (r) { if (r.texto) LZ.cambiar(el, { txt: r.texto }, true); pintarPanel(); }, function (err) { aviso('No se pudo: ' + err.message); pintarPanel(); });
        return;
      }
      if (e.target.id === 'b-copiar') {
        var s = (c.caption || '') + '\n\n' + (c.tags || []).map(function (t) { return '#' + t; }).join(' ');
        (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { aviso('Copiado.'); }, function () { $('#caption').select(); aviso('Selecciona y copia el texto.'); });
      }
    };
  }

  /* Material: la biblioteca de la marca (fotos y clips). Tocar una la pone en la lámina. */
  function pintarMaterial(P, destino) {
    var c = car(), dest = destino || principalDe(LZ.lam());
    P.innerHTML = (E.agregarFoto ? '<div class="aviso menta"><div><b>Toca una foto</b> para agregarla a esta lámina.</div></div>' : dest ? '<p class="pista">Toca una foto o un clip para ponerlo en <b>' + esc(dest.nombre) + '</b> de esta lámina.</p>' : '<p class="pista">Esta lámina no tiene foto. Toca una para agregarla.</p>') +
      '<div class="grupo"><div class="etiqueta">Tus fotos (' + E.fotos.length + ')</div><div class="galeria"><label class="subir">＋ Subir fotos<input type="file" accept="image/*" multiple hidden id="subir-fotos"></label>' +
      E.fotos.map(function (f) { return '<button type="button" data-foto="' + f.id + '" aria-pressed="' + !!(dest && dest.ref && dest.ref.foto === f.id) + '" title="' + (f.cara ? 'Con tu cara' : f.persona ? 'Con persona' : 'Sin persona') + '"><img src="' + esc(f.url) + '" alt="" loading="lazy"></button>'; }).join('') + '</div></div>' +
      (E.clips.length ? '<div class="grupo"><div class="etiqueta">Cuadros de tus clips (' + E.clips.length + ')</div><div class="galeria">' + E.clips.map(function (k) { return '<button type="button" data-clip="' + k.id + '" aria-pressed="' + !!(dest && dest.ref && dest.ref.clip === k.id) + '"><img src="' + esc(k.url) + '" alt="" loading="lazy"></button>'; }).join('') + '</div></div>' : '') +
      '<p class="pista">Las fotos que subes quedan en tu biblioteca de esta marca, y Cherry ya sabe dónde estás en cada una.</p>';
    $('#subir-fotos').onchange = function () { subirVarias(this.files, function () { if (E.vista === 'editor' && E.tab === 'material' && !LZ.sel()) pintarPanel(); }); };
    P.onclick = function (e) {
      var b = e.target.closest('[data-foto],[data-clip]'); if (!b) return;
      var f = b.dataset.foto ? E.fotos.filter(function (x) { return x.id === b.dataset.foto; })[0] : null;
      var k = b.dataset.clip ? E.clips.filter(function (x) { return x.id === b.dataset.clip; })[0] : null;
      if (E.agregarFoto || !dest) {
        E.agregarFoto = false;
        var src = f ? f.url : k.url;
        LZ.agregar('imagen', { src: src, alto: f ? f.h / f.w : 16 / 9 });
        var nuevo = LZ.sel(); if (nuevo) nuevo.ref = f ? { foto: f.id, campo: 'foto' } : { clip: k.id };
        LZ.confirmar(); pintarPanel(); return;
      }
      ponerMaterial(dest, f, k); pintarPanel();
    };
  }
  function principalDe(l) {
    if (!l) return null;
    return l.els.filter(function (e) { return e.tipo === 'video'; })[0] || l.els.filter(function (e) { return e.tipo === 'celular'; })[0] || l.els.filter(function (e) { return e.papel === 'foto'; })[0] || l.els.filter(function (e) { return e.papel === 'persona'; })[0] || null;
  }
  function ponerMaterial(el, f, k) {
    var l = LZ.lam();
    if (el.tipo === 'video') {
      if (!k || !k.video) { aviso('Aquí va un clip: toca uno de «Cuadros de tus clips».'); return; }
      LZ.cambiar(el, { src: k.video, poster: k.url, ref: { clip: k.id }, ini: 0, dur: Math.max(2, Math.min(6, k.dur || 6)) }, true); return;
    }
    if (el.tipo === 'celular') { LZ.cambiar(el, { src: f ? f.url : k.url, ref: f ? { foto: f.id, campo: 'foto' } : { clip: k.id }, nombre: f ? 'Celular con tu foto' : 'Celular con tu clip' }, true); return; }
    if (!f) { aviso('Aquí va una foto (los cuadros de clips van en los celulares).'); return; }
    if (el.papel === 'persona') {   // la persona sola (el cierre): el recorte de la foto nueva
      if (!f.recorte_url) { aviso('En esa foto Cherry no encontró una persona para recortar.'); return; }
      var k2 = f.recorte_caja, hNuevo = Math.round(el.w * k2[3] / k2[2]);
      LZ.cambiar(el, { src: f.recorte_url, ref: { foto: f.id, campo: 'recorte' }, h: hNuevo }, true); return;
    }
    if (el.papel === 'foto' && el.w >= 1000) {   // la foto de fondo: se encuadra otra vez con la cara a un tercio
      var g = F.encuadre(f, LZ.W, LZ.H);
      LZ.cambiar(el, { src: f.url, ref: { foto: f.id, campo: 'foto' }, x: g.x, y: g.y, w: g.w, h: g.h, zoom: 1 }, false);
      var r = l.els.filter(function (e) { return e.sigue === el.id; })[0];
      if (r) { if (f.recorte_url) { var kk = f.recorte_caja; Object.assign(r, { src: f.recorte_url, ref: { foto: f.id, campo: 'recorte' }, recCaja: [kk[0] / f.w, kk[1] / f.h, kk[2] / f.w, kk[3] / f.h], oculto: false }); } else r.oculto = true; }
      LZ.cambiar(el, {}, true); return;
    }
    LZ.cambiar(el, { src: f.url, ref: { foto: f.id, campo: 'foto' }, h: Math.round(el.w * f.h / f.w) }, true);
  }

  function pintarDiseno(P) {
    var c = car(), f = F.de(c.familia);
    P.innerHTML = '<div class="grupo"><div class="etiqueta">Estilo</div><div class="estilo-mini"><img src="carruseles/tapas/' + f.id + '.jpg" alt=""><div><b>' + esc(f.nombre) + '</b><div class="pista">Cambias de estilo y tu texto se conserva.</div></div><button type="button" class="btn btn-linea btn-chico" id="d-estilo" style="margin-left:auto">Cambiar</button></div></div>' +
      opcionesDe(f, c) +
      '<div class="grupo"><div class="etiqueta">Tamaño</div><div class="fila"><button type="button" class="chip" data-alto="1440" aria-pressed="' + (c.alto === 1440) + '">3:4 · 1080×1440</button><button type="button" class="chip" data-alto="1350" aria-pressed="' + (c.alto === 1350) + '">4:5 · 1080×1350</button></div><p class="pista">Instagram muestra hasta 3:4 en el perfil nuevo; 4:5 es el de siempre.</p></div>' +
      '<div class="grupo"><div class="etiqueta">Esta lámina</div><div class="fila"><button type="button" class="btn btn-linea btn-chico" id="d-rearmar">Volver a armarla como estaba</button><button type="button" class="btn btn-linea btn-chico" id="d-duplicar">Duplicarla</button><button type="button" class="btn btn-linea btn-chico" id="d-quitar" style="color:var(--rojo)">Quitarla</button></div></div>' +
      '<div class="grupo"><div class="etiqueta">Orden</div><div class="fila"><button type="button" class="btn btn-linea btn-chico" id="d-antes">‹ Mover antes</button><button type="button" class="btn btn-linea btn-chico" id="d-despues">Mover después ›</button></div></div>';
    P.onclick = function (e) {
      var op = e.target.closest('[data-op]');
      if (op) {   // una opción propia del estilo (Libreta: la mesa y la libreta): se vuelve a armar con el mismo texto
        var o = Object.assign({}, c.contenido.opciones || {}); o[op.dataset.op] = op.dataset.v;
        preguntar({ titulo: 'Cambiar ' + op.dataset.nom.toLowerCase(), texto: 'Cherry vuelve a armar las láminas con el mismo texto. Los cambios que hiciste a mano se reemplazan (puedes deshacerlo).', si: 'Sí, cambiar' }).then(function (ok) {
          if (!ok) return; c.contenido.opciones = o;
          armar(f, c.contenido, { alto: c.alto, kit: c.kit, objetivo: c.objetivo }).then(function (n) { c.laminas = n.laminas; LZ.cargar(c.laminas, c.alto); guardar(); pintarEditor(); });
        });
        return;
      }
      var id = e.target.id, alt = e.target.closest('[data-alto]');
      if (id === 'd-estilo') { E.volverDeEstilos = 'editor'; E.estiloVisto = c.familia; ir('estilos'); return; }
      if (alt && +alt.dataset.alto !== c.alto) { cambiarEstiloCarrusel(c.familia, +alt.dataset.alto); return; }
      var ls = LZ.laminas, i = LZ.i;
      if (id === 'd-rearmar') {
        armar(f, c.contenido, { alto: c.alto, kit: c.kit, objetivo: c.objetivo }).then(function (n) { if (n.laminas[i]) { ls[i] = n.laminas[i]; LZ.confirmar(); pintarEditor(); aviso('Lámina ' + (i + 1) + ' como la armó Cherry. Si no era eso, Deshacer.'); } });
        return;
      }
      if (id === 'd-duplicar') { var d = copia(ls[i]); d.els.forEach(function (x) { var viejo = x.id; x.id = LZ.nid(); d.els.forEach(function (y) { if (y.sigue === viejo) y.sigue = x.id; if (y.de === viejo) y.de = x.id; }); }); ls.splice(i + 1, 0, d); LZ.i = i + 1; LZ.confirmar(); pintarEditor(); return; }
      if (id === 'd-quitar') { if (ls.length <= 1) return; ls.splice(i, 1); LZ.i = Math.max(0, i - 1); LZ.confirmar(); pintarEditor(); aviso('Lámina quitada. Si fue un error, Deshacer.'); return; }
      if (id === 'd-antes' && i > 0) { ls.splice(i - 1, 0, ls.splice(i, 1)[0]); LZ.i = i - 1; LZ.confirmar(); pintarEditor(); return; }
      if (id === 'd-despues' && i < ls.length - 1) { ls.splice(i + 1, 0, ls.splice(i, 1)[0]); LZ.i = i + 1; LZ.confirmar(); pintarEditor(); }
    };
  }

  // las opciones propias de un estilo (catalogo.opciones de su familia), con su muestra
  function opcionesDe(f, c) {
    var ops = f.opciones; if (!ops) return '';
    var cur = (c.contenido && c.contenido.opciones) || {};
    return Object.keys(ops).map(function (k) {
      var o = ops[k], v = cur[k] || o.defecto;
      return '<div class="grupo"><div class="etiqueta">' + esc(o.nombre) + '</div><div class="galeria">' + o.valores.map(function (x) {
        return '<button type="button" data-op="' + k + '" data-v="' + x.id + '" data-nom="' + esc(o.nombre) + '" aria-pressed="' + (x.id === v) + '" title="' + esc(x.nombre) + '"><img src="' + esc(x.img) + '" alt="' + esc(x.nombre) + '"></button>';
      }).join('') + '</div></div>';
    }).join('');
  }
  function pintarLetras(P) {
    var c = car(), K = c.kit;
    var sel = function (rol) { return '<select data-rol="' + rol + '">' + LETRAS.concat(LETRAS.indexOf(K[rol]) < 0 ? [K[rol]] : []).map(function (l) { return '<option ' + (l === K[rol] ? 'selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>'; };
    var col = function (rol, nom) { return '<label class="campo" style="justify-items:center;font-size:11px;color:var(--tinta-2)"><input type="color" data-col="' + rol + '" value="' + K[rol] + '" style="width:46px;height:46px;border-radius:50%;padding:0;border:2px solid var(--linea2);background:none">' + nom + '</label>'; };
    P.innerHTML = '<p class="pista">Lo que cambies aquí cambia al instante en todas las láminas que usan las letras y los colores de este carrusel.</p>' +
      '<div class="grupo"><div class="etiqueta">Letras</div>' +
      '<div class="rg" style="grid-template-columns:84px 1fr"><span>Titular</span>' + sel('titular') + '</div>' +
      '<div class="rg" style="grid-template-columns:84px 1fr"><span>A mano</span>' + sel('mano') + '</div>' +
      '<div class="rg" style="grid-template-columns:84px 1fr"><span>Cuerpo</span>' + sel('cuerpo') + '</div></div>' +
      '<div class="grupo"><div class="etiqueta">Colores</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' + col('principal', 'Principal') + col('acento', 'Acento') + col('fondo', 'Fondo') + col('texto', 'Texto') + '</div></div>' +
      '<div class="grupo"><div class="etiqueta">Combinaciones listas</div><div class="fila">' +
      '<button type="button" class="chip" data-combo="Anton,Caveat,Inter,#E1251B,#FFD60A,#F4EEE6,#141414">Rojo guardable</button>' +
      '<button type="button" class="chip" data-combo="Playfair Display,Caveat,Inter,#4A2A26,#F3D3DA,#F6F0DF,#4A2A26">Revista café</button>' +
      '<button type="button" class="chip" data-combo="Archivo Black,Caveat,Poppins,#303680,#FFC93C,#F4F4F8,#101030">Azul y ámbar</button>' +
      '<button type="button" class="chip" data-combo="Bebas Neue,Caveat,DM Sans,#FF2D8A,#FFC93C,#FBF3EE,#16100F">Cherry</button>' +
      '<button type="button" class="chip" id="l-marca">Los de mi marca</button></div></div>' +
      '<div class="grupo"><button type="button" class="btn btn-linea btn-chico" id="l-guardar">Guardar estas letras y colores en mi identidad de marca</button><span class="pista" id="l-ok"></span></div>';
    function aplicarKit(fin) { LZ.kit(c.kit); minis(); if (fin) { guardarLuego(); } }
    P.onchange = function (e) {
      var r = e.target.dataset.rol, k = e.target.dataset.col;
      if (r) { c.kit[r] = e.target.value; LZ.listas(c.laminas).then(function () { aplicarKit(true); }); }
      if (k) { c.kit[k] = e.target.value; aplicarKit(true); }
    };
    P.oninput = function (e) { var k = e.target.dataset.col; if (k) { c.kit[k] = e.target.value; LZ.kit(c.kit); } };
    P.onclick = function (e) {
      var b = e.target.closest('[data-combo]');
      if (b) { var v = b.dataset.combo.split(','); Object.assign(c.kit, { titular: v[0], mano: v[1], cuerpo: v[2], principal: v[3], acento: v[4], fondo: v[5], texto: v[6] }); LZ.listas(c.laminas).then(function () { aplicarKit(true); pintarPanel(); }); return; }
      if (e.target.id === 'l-marca') { c.kit = kitDe(c.familia); LZ.listas(c.laminas).then(function () { aplicarKit(true); pintarPanel(); }); return; }
      if (e.target.id === 'l-guardar') {
        var m = Object.assign({}, E.marca); m.colores = Object.assign({}, m.colores || {}, { principal: c.kit.principal, acento: c.kit.acento, fondo: c.kit.fondo });
        var tit = Object.keys(LETRAS_TIT).filter(function (x) { return LETRAS_TIT[x] === c.kit.titular; })[0], txt = Object.keys(LETRAS_TXT).filter(function (x) { return LETRAS_TXT[x] === c.kit.cuerpo; })[0];
        if (tit) m.letraTitulos = tit; if (txt) m.letraTexto = txt;
        CherryApp.guardarMarca(m); E.marca = m;
        $('#l-ok').innerHTML = '<span class="aviso-ok">Listo: tu identidad de marca tiene estos colores' + (tit ? ' y la letra de titulares' : '') + (!tit || !txt ? '. (La identidad de marca solo guarda las letras de su lista.)' : '.') + '</span>';
      }
    };
  }

  function pintarCapas(P) {
    var sel = LZ.sel(), els = LZ.lam().els.slice().sort(function (a, b) { return b.z - a.z; });
    var ICO = { texto: 'type', imagen: 'image', forma: 'square', rayas: 'sparkles', flecha: 'spline', celular: 'smartphone', barra: 'minus', grano: 'layers' };
    P.innerHTML = '<p class="pista">Todo lo que tiene la lámina, de adelante hacia atrás. Toca una capa para seleccionarla, aunque esté tapada.</p><div style="display:grid;gap:5px">' +
      els.map(function (e) { return '<div class="capa ' + (e.oculto ? 'apagada' : '') + '" data-capa="' + e.id + '" aria-current="' + !!(sel && sel.id === e.id) + '" role="button" tabindex="0"><span class="ic">' + ic(ICO[e.tipo] || 'square', 16) + '</span><span class="t">' + esc(e.nombre || e.tipo) + (e.tipo === 'texto' ? ' <span style="color:var(--tinta-3)">· ' + esc(String(e.txt).replace(/\*/g, '').slice(0, 22)) + '</span>' : '') + '</span><button type="button" data-ojo="' + e.id + '" title="' + (e.oculto ? 'Mostrar' : 'Esconder') + '">' + ic(e.oculto ? 'eye-off' : 'eye', 15) + '</button><button type="button" data-cand="' + e.id + '" title="' + (e.bloqueado ? 'Desbloquear' : 'Bloquear') + '">' + ic(e.bloqueado ? 'lock' : 'lock-open', 15) + '</button></div>'; }).join('') + '</div>';
    P.onclick = function (e) {
      var o = e.target.closest('[data-ojo]'), cd = e.target.closest('[data-cand]'), r = e.target.closest('[data-capa]');
      if (o) { var a = LZ.buscar(o.dataset.ojo); a.oculto = !a.oculto; LZ.cambiar(a, {}, true); pintarPanel(); return; }
      if (cd) { var b = LZ.buscar(cd.dataset.cand); b.bloqueado = !b.bloqueado; LZ.cambiar(b, {}, true); pintarPanel(); return; }
      if (r) { var x = LZ.buscar(r.dataset.capa); if (x.tipo === 'grano') { E.granoSel = x.id; } LZ.seleccionar(x.sigue || x.de || x.id); }
    };
  }

  /* ── el panel de UN elemento: lo que tocaste en la lámina ── */
  var COLORES = ['@principal', '@acento', '@fondo', '@texto', '#FFFFFF', '#8A8178'];
  var NOMCOL = { '@principal': 'Principal', '@acento': 'Acento', '@fondo': 'Fondo', '@texto': 'Texto', '#FFFFFF': 'Blanco', '#8A8178': 'Gris' };
  var PLURAL = { titular: 'titulares', 'titular-portada': 'titulares de portada', subtitulo: 'subtítulos', nota: 'notas a mano', etiqueta: 'etiquetas', 'etiqueta-portada': 'etiquetas de portada', pastilla: 'pastillas', contador: 'contadores', rotulo: 'rótulos de sección', 'rotulo-chico': 'rótulos chicos', cita: 'frases', cuerpo: 'textos «por qué»', conclusion: 'líneas «úsalo en»', rayas: 'rayitas', flecha: 'flechas', 'flecha-curva': 'flechas curvas', tarjeta: 'tarjetas', celular: 'celulares', barra: 'barras de avance', linea: 'líneas', boton: 'botones' };
  var ICO_T = { texto: 'type', imagen: 'image', forma: 'square', rayas: 'sparkles', flecha: 'spline', celular: 'smartphone', barra: 'minus', grano: 'layers', video: 'clapperboard' };
  var LISTA_ICONOS = FAMILIAS.ICONOS_OK;
  function aHex(v) { v = LZ.res(v); if (/^#[0-9a-f]{6}$/i.test(v)) return v; var m = String(v).match(/[\d.]+/g); return m && m.length >= 3 ? '#' + m.slice(0, 3).map(function (x) { return (+x | 0).toString(16).padStart(2, '0'); }).join('') : '#ffffff'; }
  function poner(el, k, v) { var p = k.split('.'); if (p[1]) { var o = Object.assign({}, el[p[0]] || {}); o[p[1]] = v; el[p[0]] = o; } else el[k] = v; }
  function sw(k, v, nada) { return '<div class="muestras" data-k="' + k + '">' + (nada ? '<button type="button" class="mu mu-nada" data-v="" aria-pressed="' + !v + '" title="' + nada + '"></button>' : '') + COLORES.map(function (c) { return '<button type="button" class="mu" data-v="' + c + '" aria-pressed="' + (c === v) + '" style="background:' + LZ.res(c) + '" title="' + NOMCOL[c] + '"></button>'; }).join('') + '<label class="mu mu-otro" title="Otro color"><input type="color" data-kc="' + k + '" value="' + aHex(v || '#ffffff') + '"></label></div>'; }
  function rg(k, et, v, min, max, paso, fmt) { fmt = fmt || function (x) { return x; }; return '<label class="rg"><span>' + et + '</span><input type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + paso + '" value="' + v + '"><output>' + fmt(v) + '</output></label>'; }
  function sg(k, v, ops) { return '<div class="seg-mini" data-k="' + k + '">' + ops.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (String(o[0]) === String(v)) + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  var pct = function (x) { return Math.round(x * 100) + '%'; };
  function pintarElemento(P, el) {
    var K = LZ.K, rec = LZ.recorte(), otros = LZ.otros(el);
    var h = '<div class="el-cab"><span class="ic">' + ic(ICO_T[el.tipo] || 'square', 18) + '</span><div><b>' + esc(el.nombre || 'Elemento') + '</b><small>' + (el.bloqueado ? 'Bloqueado · desbloquéalo para moverlo' : 'Lámina ' + (LZ.i + 1)) + '</small></div><button type="button" class="btn btn-linea btn-chico" id="el-listo">Listo</button></div>';
    if (el.tipo === 'texto') {
      var letras = [['@titular', 'Titular del carrusel · ' + K.titular], ['@mano', 'A mano del carrusel · ' + K.mano], ['@cuerpo', 'Cuerpo del carrusel · ' + K.cuerpo]];
      h += '<div class="grupo"><div class="etiqueta">Texto</div><textarea data-k="txt" rows="' + Math.min(4, 1 + Math.ceil(el.txt.length / 34)) + '">' + esc(el.txt) + '</textarea><span class="pista">La palabra entre *asteriscos* sale resaltada. También puedes escribir con doble toque sobre la lámina.</span></div>' +
        '<div class="grupo"><div class="etiqueta">Letra</div><select data-k="fuente"><optgroup label="Las del carrusel (cambian todas juntas)">' + letras.map(function (l) { return '<option value="' + l[0] + '" ' + (el.fuente === l[0] ? 'selected' : '') + '>' + esc(l[1]) + '</option>'; }).join('') + '</optgroup><optgroup label="Otra solo para este texto">' + LETRAS.map(function (l) { return '<option value="' + esc(l) + '" ' + (el.fuente === l ? 'selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</optgroup></select>' +
        rg('tam', 'Tamaño', el.tam, 8, 400, 1, function (x) { return x + ' px'; }) +
        sg('peso', el.peso, [[400, 'Normal'], [500, 'Media'], [600, 'Semi'], [700, 'Negrita'], [800, 'Extra']]) +
        '<div class="dos">' + sg('alin', el.alin, [['left', ic('align-left', 15)], ['center', ic('align-center', 15)], ['right', ic('align-right', 15)]]) + sg('mayus', el.mayus, [[false, 'Aa'], [true, 'AA']]) + '</div>' +
        rg('interl', 'Interlineado', el.interl, .7, 2, .01) + rg('espac', 'Espaciado', el.espac, -.1, .4, .01) + rg('ancho', 'Estrechar', el.ancho || 1, .6, 1, .01, function (x) { return Math.round(x * 100) + '%'; }) + '</div>' +
        '<div class="grupo"><div class="etiqueta">Color</div>' + sw('color', el.color) +
        (/\*[^*]+\*/.test(el.txt) ? '<div class="etiqueta" style="margin-top:4px">Palabra resaltada</div>' + sg('modoAc', el.modoAc, [['color', 'Color'], ['marcador', 'Marcador'], ['negrita', 'Negrita'], ['subrayado', 'Subrayar'], ['tachado', 'Tachar']]) + sw('colorAc', el.colorAc) : '') +
        '<div class="fila"><button type="button" class="chip" data-tog="sombra" aria-pressed="' + !!el.sombra + '">Sombra</button><button type="button" class="chip" data-tog="cursiva" aria-pressed="' + !!el.cursiva + '">Cursiva</button></div></div>';
      if (rec && !rec.oculto) h += '<div class="grupo"><div class="etiqueta">Con tu foto</div>' + sg('_capa', el.z < rec.z ? 'detras' : 'delante', [['detras', 'Detrás de ti'], ['delante', 'Delante de ti']]) + '<span class="pista">Detrás de ti: tu cuerpo tapa el texto donde se cruzan.</span></div>';
      h += el.caja ? '<div class="grupo"><div class="etiqueta">Caja</div><span class="pista">Fondo</span>' + sw('caja.fondo', el.caja.fondo, 'Sin fondo') + '<span class="pista">Borde</span>' + sw('caja.borde', el.caja.borde, 'Sin borde') + rg('caja.radio', 'Esquinas', Math.min(el.caja.radio, 80), 0, 80, 1, function (x) { return x >= 80 ? 'redonda' : x + ' px'; }) + rg('caja.padH', 'Relleno', el.caja.padH, 0, 60, 1, function (x) { return x + ' px'; }) + '<div class="fila"><button type="button" class="chip" id="sombra-caja" aria-pressed="' + !!el.caja.sombra + '">Sombra de la caja</button><button type="button" class="chip" id="quitar-caja">Quitar la caja</button></div></div>'
        : '<div class="grupo"><div class="etiqueta">Caja</div><div class="fila"><button type="button" class="chip" id="poner-caja">Ponerle fondo (pastilla)</button></div></div>';
      h += '<div class="grupo"><div class="etiqueta">Ícono</div><select data-k="icono"><option value="">Sin ícono</option>' + LISTA_ICONOS.map(function (i) { return '<option ' + (el.icono === i ? 'selected' : '') + '>' + i + '</option>'; }).join('') + '</select>' + (el.icono ? sg('iconoLado', el.iconoLado || 'izq', [['izq', 'Antes del texto'], ['der', 'Después']]) + sw('iconoColor', el.iconoColor || el.color) : '') + '</div>';
    }
    if (el.tipo === 'imagen' && !el.calco) {
      var r = LZ.lam().els.filter(function (x) { return x.sigue === el.id; })[0], so = LZ.lam().els.filter(function (x) { return x.de === el.id; })[0];
      h += '<div class="grupo"><div class="etiqueta">' + (el.papel === 'persona' ? 'Tú (recorte)' : 'Foto') + '</div><button type="button" class="btn btn-linea btn-chico" id="cambiar-foto">Cambiar foto</button>' +
        (r ? '<div class="fila"><button type="button" class="chip" id="tog-recorte" aria-pressed="' + !r.oculto + '">Tú adelante del texto</button></div><span class="pista">Es tu recorte: lo que quede detrás de ti se tapa con tu cuerpo.</span>' : '') + '</div>' +
        (so ? '<div class="grupo"><div class="etiqueta">Sombra para que se lea el texto</div>' + rg('_sombra', 'Oscurecer', so.oculto ? 0 : so.op, 0, 1, .01, pct) + '</div>' : '') +
        (el.papel !== 'persona' ? '<div class="grupo"><div class="etiqueta">Encuadre</div>' + rg('zoom', 'Acercar', el.zoom || 1, 1, 2.5, .01, function (x) { return (+x).toFixed(2) + '×'; }) + '<span class="pista">Para moverla, arrástrala en la lámina.</span></div>' : '') +
        '<div class="grupo"><div class="etiqueta">Luz y color</div>' + rg('brillo', 'Brillo', el.brillo == null ? 1 : el.brillo, .3, 1.5, .01, pct) + rg('contraste', 'Contraste', el.contraste == null ? 1 : el.contraste, .5, 1.6, .01, pct) + rg('sat', 'Saturación', el.sat == null ? 1 : el.sat, 0, 2, .01, pct) + '<div class="fila"><button type="button" class="chip" data-tog="bn" aria-pressed="' + !!el.bn + '">Blanco y negro</button></div>' + (el.papel !== 'persona' ? rg('radio', 'Esquinas', el.radio || 0, 0, 120, 1, function (x) { return x + ' px'; }) : '') + '</div>';
    }
    if (el.tipo === 'forma') h += /gradient/.test(el.fondo) ? '' : '<div class="grupo"><div class="etiqueta">Color</div>' + sw('fondo', el.fondo) + rg('radio', 'Esquinas', el.radio || 0, 0, 120, 1, function (x) { return x + ' px'; }) + '<div class="fila"><button type="button" class="chip" data-tog="sombra" aria-pressed="' + !!el.sombra + '">Sombra</button></div></div>';
    if (el.tipo === 'video') h += '<div class="grupo"><div class="etiqueta">Tu clip · sale andando (MP4)</div><button type="button" class="btn btn-linea btn-chico" id="cambiar-foto">Cambiar clip</button>' +
      rg('ini', 'Empieza en', el.ini || 0, 0, Math.max(1, Math.round(((E.clips.filter(function (k) { return el.ref && k.id === el.ref.clip; })[0] || {}).dur || 30) - 1)), .5, function (x) { return x + ' s'; }) +
      rg('dur', 'Dura', el.dur || 6, 2, 10, .5, function (x) { return x + ' s'; }) + rg('posY', 'Encuadre', el.posY == null ? 50 : el.posY, 0, 100, 1, function (x) { return x + '%'; }) +
      rg('radio', 'Esquinas', el.radio || 0, 0, 120, 1, function (x) { return x + ' px'; }) + '<span class="pista">Todas las láminas con clip salen en MP4 de ' + (el.dur || 6) + ' s.</span></div>';
    if (el.tipo === 'celular') h += '<div class="grupo"><div class="etiqueta">Lo que se ve en el celular</div><button type="button" class="btn btn-linea btn-chico" id="cambiar-foto">Cambiar foto o clip</button><label class="campo"><span class="etiqueta">Texto sobre la pantalla</span><textarea data-k="texto" rows="2">' + esc(el.texto) + '</textarea></label>' + rg('posY', 'Encuadre', el.posY == null ? 30 : el.posY, 0, 100, 1, function (x) { return x + '%'; }) + '</div>';
    if (el.tipo === 'rayas') h += '<div class="grupo"><div class="etiqueta">Rayitas</div>' + sw('color', el.color) + rg('giro', 'Hacia dónde', el.giro, -180, 180, 1, function (x) { return x + '°'; }) + '</div>';
    if (el.tipo === 'flecha') h += '<div class="grupo"><div class="etiqueta">Flecha</div>' + sw('color', el.color) + sg('src', el.src, [['carruseles/piezas/fl-curva-tinta.png', 'Curva'], ['carruseles/piezas/fl-sube-tinta.png', 'Sube']]) + '</div>';
    if (el.tipo === 'barra') h += '<div class="grupo"><div class="etiqueta">Barra de avance</div>' + rg('valor', 'Avance', el.valor, 0, 1, .01, pct) + '<div class="dos"><label class="num">Izquierda<input type="text" data-k="izq" value="' + esc(el.izq) + '"></label><label class="num">Derecha<input type="text" data-k="der" value="' + esc(el.der) + '"></label></div>' + sw('color', el.color) + '</div>';
    if (el.tipo === 'grano') h += '<div class="grupo"><div class="etiqueta">Textura</div>' + rg('op', 'Intensidad', el.op, 0, .5, .01, pct) + sg('mezcla', el.mezcla, [['overlay', 'Suave'], ['multiply', 'Oscura']]) + '<div class="fila"><button type="button" class="chip" data-tog="oculto" aria-pressed="' + !!el.oculto + '">Quitar la textura</button></div></div>';
    if (el.tipo !== 'grano') {
      h += '<div class="grupo"><div class="etiqueta">Posición y tamaño</div><div class="tres"><label class="num">X<input type="number" data-k="x" value="' + el.x + '"></label><label class="num">Y<input type="number" data-k="y" value="' + el.y + '"></label>' +
        (el.tipo === 'texto' ? '<label class="num">Ancho<input type="text" data-k="w" value="' + (el.w === 'auto' ? 'auto' : el.w) + '"></label>' : '<label class="num">Ancho<input type="number" data-k="w" value="' + el.w + '"></label>') + '</div>' +
        rg('rot', 'Giro', el.rot || 0, -180, 180, .5, function (x) { return x + '°'; }) + rg('op', 'Opacidad', el.op == null ? 1 : el.op, 0, 1, .01, pct) + '</div>';
      if (otros && el.tipo !== 'imagen') h += '<div class="grupo"><button type="button" class="btn btn-linea btn-chico" id="a-todos">Aplicar este estilo a los ' + otros + ' ' + (PLURAL[el.papel] || 'iguales') + ' del carrusel</button><span class="pista" id="a-todos-ok">Copia letra, tamaño, color y caja; no toca el texto ni la posición.</span></div>';
      h += '<div class="acciones"><button type="button" data-acc="duplicar">' + ic('copy', 16) + 'Duplicar</button><button type="button" data-acc="adelante">' + ic('arrow-up-to-line', 16) + 'Adelante</button><button type="button" data-acc="atras">' + ic('arrow-down-to-line', 16) + 'Atrás</button><button type="button" data-acc="bloquear">' + ic(el.bloqueado ? 'lock-open' : 'lock', 16) + (el.bloqueado ? 'Soltar' : 'Bloquear') + '</button><button type="button" data-acc="borrar" class="rojo">' + ic('trash-2', 16) + 'Borrar</button></div>';
    }
    P.innerHTML = h;
    var vivo = function (k, v) { poner(el, k, v); LZ.cambiar(el, {}, false); };
    var fin = function () { LZ.cambiar(el, {}, true); };
    P.oninput = function (e) {
      var t = e.target;
      if (t.dataset.kc) { vivo(t.dataset.kc, t.value); return; }
      var k = t.dataset.k; if (!k) return;
      if (k === '_sombra') { var so = LZ.lam().els.filter(function (x) { return x.de === el.id; })[0]; so.op = +t.value; so.oculto = false; LZ.cambiar(so, {}, false); return; }
      if (t.type === 'range') { vivo(k, +t.value); var o = t.parentNode.querySelector('output'); if (o) o.textContent = t.value; }
      else if (t.tagName === 'TEXTAREA' || (t.type === 'text' && k !== 'w')) vivo(k, t.value);
    };
    P.onchange = function (e) {
      var t = e.target;
      if (t.dataset.kc) { poner(el, t.dataset.kc, t.value); fin(); pintarPanel(); return; }
      var k = t.dataset.k; if (!k) return;
      if (k === '_sombra') { LZ.cambiar(el, {}, true); return; }
      if (t.tagName === 'SELECT') { poner(el, k, t.value); if (k === 'fuente') LZ.cargarLetra(t.value); document.fonts.ready.then(function () { fin(); pintarPanel(); }); return; }
      if (t.type === 'number') { poner(el, k, +t.value); fin(); return; }
      if (k === 'w') { poner(el, 'w', t.value.trim() === 'auto' || !+t.value ? 'auto' : +t.value); fin(); return; }
      fin(); if (t.type === 'range') pintarPanel();
    };
    P.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var grupo = b.closest('[data-k]');
      if (b.dataset.v !== undefined && grupo) {
        var v = b.dataset.v, k = grupo.dataset.k;
        if (k === '_capa') { var rr = LZ.recorte(); el.z = v === 'detras' ? rr.z - 1 : Math.max(rr.z + 1, 5); fin(); pintarPanel(); return; }
        if (v === 'true' || v === 'false') v = v === 'true'; else if (k === 'peso') v = +v;
        poner(el, k, v === '' ? null : v); fin(); pintarPanel(); return;
      }
      if (b.dataset.tog) { el[b.dataset.tog] = !el[b.dataset.tog]; fin(); pintarPanel(); return; }
      if (b.dataset.acc) { LZ.accion(b.dataset.acc); return; }
      if (b.id === 'el-listo') { LZ.seleccionar(null); return; }
      if (b.id === 'poner-caja') { el.caja = { fondo: '@principal', radio: 999, padV: Math.round(el.tam * .35), padH: Math.round(el.tam * .7) }; if (LZ.res(el.color) === LZ.res('@principal')) el.color = '#FFFFFF'; fin(); pintarPanel(); return; }
      if (b.id === 'sombra-caja') { el.caja = Object.assign({}, el.caja, { sombra: !el.caja.sombra }); fin(); pintarPanel(); return; }
      if (b.id === 'quitar-caja') { delete el.caja; fin(); pintarPanel(); return; }
      if (b.id === 'tog-recorte') { var r2 = LZ.lam().els.filter(function (x) { return x.sigue === el.id; })[0]; r2.oculto = !r2.oculto; LZ.cambiar(r2, {}, true); pintarPanel(); return; }
      if (b.id === 'a-todos') { var n = LZ.aTodos(el); $('#a-todos-ok').innerHTML = '<span class="aviso-ok">Listo: ' + n + ' ' + (PLURAL[el.papel] || 'elementos') + ' quedaron iguales.</span>'; return; }
      if (b.id === 'cambiar-foto') { var destino = el; LZ.seleccionar(null); E.tab = 'material'; $$('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x.dataset.tab === 'material'); }); pintarMaterial($('#panel'), destino); }
    };
  }

  /* ══════════ Descargar (las mismas láminas, en su tamaño real) ══════════ */
  function cargarScript(src) { return new Promise(function (ok, mal) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { mal(new Error('no cargó la herramienta de descarga')); }; document.head.appendChild(s); }); }
  var libs = null;
  function librerias() {
    if (!libs) libs = Promise.all([window.htmlToImage ? 0 : cargarScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js'), window.JSZip ? 0 : cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')]).catch(function (e) { libs = null; throw e; });
    return libs;
  }
  // html-to-image no puede leer las hojas de Google Fonts (otro dominio): se bajan y cada letra va en base64
  var cssLetras = {}, archivosLetra = {};
  function letrasIncrustadas() {
    var hojas = $$('link[rel="stylesheet"][href^="https://fonts.googleapis.com/css"]').map(function (l) { return l.href; });
    return Promise.all(hojas.map(function (h) {
      if (!cssLetras[h]) cssLetras[h] = fetch(h).then(function (r) { return r.text(); }).then(function (t) {
        var bloques = [];
        t.replace(/\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g, function (_, sub, b) { if (sub === 'latin') bloques.push(b); return ''; });
        return Promise.all(bloques.map(function (b) {
          var m = b.match(/url\((https:[^)]+)\)/); if (!m) return b;
          if (!archivosLetra[m[1]]) archivosLetra[m[1]] = fetch(m[1]).then(function (r) { return r.blob(); }).then(function (bl) { return new Promise(function (ok, mal) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = mal; fr.readAsDataURL(bl); }); });
          return archivosLetra[m[1]].then(function (d) { return b.replace(m[1], d); });
        })).then(function (bs) { return bs.join('\n'); });
      }).catch(function () { cssLetras[h] = null; return ''; });
      return cssLetras[h];
    })).then(function (xs) { return xs.join('\n'); });
  }
  var comoDato = {};
  function dato(url) {
    if (!url || /^data:/.test(url)) return Promise.resolve(url);
    if (!comoDato[url]) comoDato[url] = fetch(url, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (bl) { return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(bl); }); }).catch(function () { return url; });
    return comoDato[url];
  }
  // las imágenes y las flechas (máscaras) van DENTRO del archivo: así ninguna sale en blanco
  function incrustar(nodo) {
    var tareas = [];
    nodo.querySelectorAll('img').forEach(function (im) { tareas.push(dato(im.getAttribute('src')).then(function (d) { im.setAttribute('src', d); })); });
    nodo.querySelectorAll('[style*="mask"]').forEach(function (m) {
      var u = (m.getAttribute('style').match(/mask:url\(([^)]+)\)/) || [])[1];
      if (u) tareas.push(dato(new URL(u, location.href).href).then(function (d) { m.style.webkitMask = 'url("' + d + '") center/contain no-repeat'; m.style.mask = 'url("' + d + '") center/contain no-repeat'; }));
    });
    return Promise.all(tareas).then(function () { return Promise.all(Array.prototype.map.call(nodo.querySelectorAll('img'), function (im) { return im.complete ? 0 : new Promise(function (ok) { im.onload = im.onerror = ok; }); })); });
  }
  // UNA lámina como imagen, igual que en la descarga (lo usan la descarga y las pruebas)
  function imagenDe(c, i, css, caja, ratio) {
    caja.innerHTML = ''; var nodo = LZ.real(i); caja.appendChild(nodo);
    // (30-sep) el fondo es el de la lámina: con '#ffffff' fijo, html-to-image lo tapaba y salía blanco
    return incrustar(nodo).then(function () { return htmlToImage.toBlob(nodo, { width: 1080, height: c.alto, pixelRatio: ratio || 1, fontEmbedCSS: css || undefined, type: 'image/jpeg', quality: .95, backgroundColor: nodo.style.backgroundColor || '#ffffff' }); });
  }
  var nombreArchivo = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'carrusel'; };
  // una lámina ANIMADA: las dos capas se suben y el servidor mete los clips entre ellas
  function mp4De(c, i, css, caja, soloUrl) {
    var cap = LZ.capas(i), base = USR.id + '/render/' + c.id + '-' + i + '-' + Date.now().toString(36);
    var png = function (nodo, transparente) {
      caja.innerHTML = ''; caja.appendChild(nodo);
      return incrustar(nodo).then(function () { return htmlToImage.toBlob(nodo, { width: 1080, height: c.alto, pixelRatio: 1, fontEmbedCSS: css || undefined, backgroundColor: transparente ? undefined : (nodo.style.backgroundColor || '#ffffff') }); });
    };
    var subir = function (blob, ruta) { return CherryApp.rest('/storage/v1/object/carruseles/' + ruta, { method: 'POST', headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: blob }).then(function () { return ruta; }); };
    var dur = Math.max.apply(null, cap.videos.map(function (v) { return v.dur; }));
    return png(cap.fondo, false).then(function (b) { return subir(b, base + '-fondo.png'); }).then(function (rf) {
      return png(cap.frente, true).then(function (b) { return subir(b, base + '-frente.png'); }).then(function (rfr) {
        return CherryApp.funcion('carruseles', { accion: 'componer', fondo: rf, frente: rfr, videos: cap.videos, alto: c.alto, dur: dur, nombre: nombreArchivo(c.nombre) + '-' + (i + 1) });
      });
    }).then(function (r) {
      if (soloUrl) return r.url;
      return fetch(r.url).then(function (x) { if (!x.ok) throw new Error('no pude bajar el video de la lámina ' + (i + 1)); return x.blob(); });
    });
  }
  $('#b-descargar').onclick = function () {
    var c = car(); if (!c) return;
    LZ.seleccionar(null);
    var n = c.laminas.length, base = nombreArchivo(c.nombre);
    abrir('<div class="etiqueta">Descargar</div><h3>' + n + ' láminas · 1080×' + c.alto + '</h3><div class="barra-prog"><i id="prog"></i></div><p id="txt-prog">Preparando las letras y las fotos…</p>');
    var caja = document.createElement('div'); caja.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px;pointer-events:none';
    document.body.appendChild(caja);
    var css = '', blobs = [];
    librerias().then(function () { return LZ.listas(c.laminas); }).then(letrasIncrustadas).then(function (f) { css = f; }).then(function () {
      var i = 0;
      function sig() {
        if (i >= n) return blobs;
        $('#txt-prog').textContent = 'Lámina ' + (i + 1) + ' de ' + n + '…'; $('#prog').style.width = Math.round(i / n * 100) + '%';
        var conClip = LZ.tieneVideo(i);
        if (conClip) $('#txt-prog').textContent = 'Lámina ' + (i + 1) + ' de ' + n + ': armando el video (unos segundos)…';
        return (conClip ? mp4De(c, i, css, caja) : imagenDe(c, i, css, caja))
          .then(function (b) { b.mp4 = conClip; if (!b) throw new Error('una lámina salió vacía'); blobs.push(b); i++; return sig(); });
      }
      return sig();
    }).then(function () {
      var zip = new JSZip();
      blobs.forEach(function (bl, i) { zip.file(base + '-' + String(i + 1).padStart(2, '0') + (bl.mp4 ? '.mp4' : '.jpg'), bl); });
      zip.file(base + '-texto.txt', (c.caption || '') + '\n\n' + (c.tags || []).map(function (t) { return '#' + t; }).join(' ') + '\n');
      return zip.generateAsync({ type: 'blob' });
    }).then(function (z) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(z); a.download = base + '.zip'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
      window.__descarga = { nombre: a.download, bytes: z.size, laminas: n };
      var nv = blobs.filter(function (b) { return b.mp4; }).length; cerrar(); aviso('Listo: ' + n + ' láminas de 1080 × ' + c.alto + (nv ? ' (' + nv + ' en video MP4)' : '') + ' y el texto de la publicación.');
    }).catch(function (e) { fallo(e, 'preparar las láminas'); }).then(function () { caja.remove(); });
  };

  /* ══════════ Arranque ══════════ */
  CherryApp.barra();
  var local = CherryApp.copiaLocal('carruseles'); if (local) aplicar(local);
  ir('lista');
  var nube = CherryApp.cargar('carruseles').then(function (d) { if (d) aplicar(d); }, function () {});
  var cal = CherryApp.cargar('calendario').catch(function () { return CherryApp.copiaLocal('calendario'); });
  Promise.all([nube, cal]).then(function (r) {
    var posts = r[1] && Array.isArray(r[1].posts) ? r[1].posts : [];
    E.lista.forEach(function (c) { var p = posts.filter(function (x) { return x.proyecto === 'car:' + c.id && (x.estado === 'programado' || x.estado === 'publicado'); })[0]; E.estados[c.id] = p ? p.estado : 'borrador'; });
    E.cargado = true;
    var ids = {}; E.lista.forEach(function (c) { (c.laminas || []).forEach(function (l) { (l.els || []).forEach(function (e) { if (e.ref && e.ref.foto) ids[e.ref.foto] = 1; }); }); });
    return cargarFotos().then(function () { return Promise.all(E.lista.filter(function (c) { return c.v === 2; }).map(refrescarUrls)); });
  }).then(function () { return Promise.all(E.lista.filter(function (c) { return c.v === 2; }).map(function (c) { return LZ.listas(c.laminas); })); })
    .then(function () { if (E.vista === 'lista') pintarLista(); else if (E.vista === 'empezar') resumen(); });
  cargarClips().then(function () { if (E.vista === 'empezar') resumen(); });
  CherryApp.videosListos().then(function (vs) { E.videos = vs || []; E.videosCargados = true; if (E.vista === 'empezar' && E.crear.modo === 'video') pintarCuenta(); }, function () { E.videosCargados = true; });
  CherryApp.marca().then(function (m) { E.marca = m || {}; if (E.vista === 'empezar') pintarEmpezar(); }, function () {});

  window.__carruseles = { E: E, ir: ir, abrirCarrusel: abrirCarrusel, crear: crear,
    // para las pruebas: la lámina i del carrusel abierto, tal como sale en la descarga
    imagen: function (i, ratio) { var c = car(), caja = document.createElement('div'); caja.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px'; document.body.appendChild(caja);
      return librerias().then(function () { return LZ.listas(c.laminas); }).then(letrasIncrustadas).then(function (css) { return imagenDe(c, i, css, caja, ratio); }).then(function (b) { caja.remove(); return b; }); } };
})();

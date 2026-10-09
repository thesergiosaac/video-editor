/* historias-ui.js — la cara propia de la herramienta HISTORIAS (8-oct-2026), aprobada por Sergio en la propuesta
 * «Historias, rediseñada»: inicio ámbar con el personaje, la semana en círculos y las plantillas a la vista (sin casi
 * scroll); la carga en la que se ve cómo se arma la historia en un celular; y el editor con la parte dentro de un
 * celular con la barra de Instagram y la zona que tapa Instagram.
 * Solo trabaja con ?formato=historias. Carruseles no cambia. app.js la llama en 4 puntos (iniciar, lista, editor y
 * la carga de los pasos) y le pasa window.CarruselesAPI. */
(function () {
  'use strict';
  if (!/[?&]formato=historias/.test(location.search)) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var API = function () { return window.CarruselesAPI || null; };
  var ARTE = '../assets/inicio/v2/carruseles.webp?v=20261008';
  var ZONA_ARRIBA = 250 / 1920 * 100, ZONA_ABAJO = 340 / 1920 * 100;
  var ESTADOS = { borrador: 'Borrador', programado: 'Programada', publicado: 'Publicada' };

  /* ══════════ Inicio ══════════ */
  function iniciar() {
    var ph = $('#v-lista .ph'); if (!ph || ph.dataset.hs) return;
    ph.dataset.hs = '1';
    var nuevo = $('#b-nuevo'), atajos = $$('#v-lista [data-atajo]');
    var arriba = document.createElement('div'); arriba.className = 'hs-arriba';
    arriba.innerHTML =
      '<div class="hs-hero">' +
        '<div class="hs-trama"></div><div class="hs-estallido" aria-hidden="true"></div>' +
        '<img class="hs-arte" src="' + ARTE + '" alt="">' +
        '<div class="hs-hero-t">' +
          '<span class="etiqueta">Herramienta</span>' +
          '<h1>Historias<span class="hs-916">9:16</span></h1>' +
          '<div class="hs-chips"><span>Una tras otra</span><span>Con tus fotos</span><span>Sin taparte la cara</span></div>' +
          '<p>Dile de qué quieres hablar hoy y Cherry arma la secuencia con tus fotos.</p>' +
          '<div class="hs-acc"></div>' +
        '</div>' +
      '</div>' +
      '<div class="hs-semana vol"><span class="etiqueta">Tus historias</span><h3>Así van esta semana</h3><div class="hs-anillos" id="hs-anillos"></div><div class="hs-prox" id="hs-prox"></div></div>';
    var acc = $('.hs-acc', arriba);
    if (nuevo) acc.appendChild(nuevo);
    atajos.forEach(function (b) { acc.appendChild(b); });
    var plant = document.createElement('div'); plant.className = 'hs-plant vol';
    plant.innerHTML = '<div class="hs-plant-cab"><h3>Plantillas</h3><span class="etiqueta" id="hs-plant-n"></span></div><div class="hs-fila-p" id="hs-fila-p"></div>';
    /* (8-oct) Sergio: «que se vea todo sin hacer scroll»: las plantillas y Mis historias van lado a lado */
    var abajo = document.createElement('div'); abajo.className = 'hs-abajo';
    var mis = document.createElement('div'); mis.className = 'hs-mis vol';
    var cabMis = $('#v-lista .cabecera'), rej = $('#rejilla');
    if (cabMis) mis.appendChild(cabMis);
    if (rej) mis.appendChild(rej);
    abajo.appendChild(plant); abajo.appendChild(mis);
    ph.replaceWith(arriba);
    arriba.after(abajo);
    pintarPlantillas();
  }
  function pintarPlantillas() {
    var A = API(), F = window.FAMILIAS, fila = $('#hs-fila-p'); if (!fila || !F) return;
    var fs = F.CATALOGO.filter(function (f) { return f.historia && !f.retirada && f.lista; });
    $('#hs-plant-n').textContent = fs.length + ' · cada una es una secuencia';
    var PARA = { h_conocemos: 'Presentarte', h_foto: 'Enseñar en pasos', h_gigante: 'Una idea fuerte', h_palabra: 'Preguntas y respuestas' };
    fila.innerHTML = fs.map(function (f) {
      return '<button type="button" class="hs-tp" data-hs-fam="' + f.id + '"><img src="carruseles/tapas/' + f.id + '.jpg" alt="" loading="lazy"><b>' + esc(f.nombre) + '</b><small>' + esc(PARA[f.id] || '') + '</small></button>';
    }).join('') + '<span class="hs-mano">vienen más →</span>';
    $$('[data-hs-fam]', fila).forEach(function (b) {
      b.onclick = function () { var a = API(); if (!a) return; a.E.crear.familia = b.dataset.hsFam; if (a.E.crear.modo === 'video') a.E.crear.modo = 'idea'; a.ir('empezar'); };
    });
    void A;
  }
  // los círculos de la semana: las 4 últimas, con su primera parte adentro
  function lista() {
    var A = API(); if (!A) return;
    var ult = A.E.lista.slice(0, 4), an = $('#hs-anillos'), px = $('#hs-prox'); if (!an) return;
    var dia = function (t) { var d = new Date(t || Date.now()), h = new Date(); var n = Math.round((new Date(h.toDateString()) - new Date(d.toDateString())) / 86400000); return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()]; };
    an.innerHTML = ult.map(function (c) {
      var st = A.E.estados[c.id] || 'borrador';
      return '<button type="button" class="hs-an" data-hs-abrir="' + c.id + '"><span class="hs-o' + (st === 'publicado' ? ' visto' : '') + '"><span class="hs-o-in" data-hs-mini="' + c.id + '"></span></span>' + dia(c.creado) + '</button>';
    }).join('') + '<button type="button" class="hs-an" data-hs-nueva><span class="hs-o visto"><span class="hs-o-in hs-mas">+</span></span>nueva</button>';
    px.innerHTML = ult.length ? ult.slice(0, 3).map(function (c) {
      var st = A.E.estados[c.id] || 'borrador';
      return '<div><b>' + esc(c.nombre || 'Historia') + '</b><span class="hs-est ' + st + '">' + (ESTADOS[st] || st) + '</span></div>';
    }).join('') : '<p class="pista">Aquí vas a ver lo que tienes programado, en borrador y publicado.</p>';
    $$('[data-hs-mini]', an).forEach(function (d) {
      var c = A.E.lista.filter(function (x) { return x.id === d.dataset.hsMini; })[0];
      if (c && c.laminas && c.laminas[0] && window.LZ) LZ.miniCon(d, c.laminas[0], 64, c.kit, c.alto);
    });
    $$('[data-hs-abrir]', an).forEach(function (b) { b.onclick = function () { var x = $('[data-abrir="' + b.dataset.hsAbrir + '"]'); if (x) x.click(); }; });
    var nv = $('[data-hs-nueva]', an); if (nv) nv.onclick = function () { var b = $('#b-nuevo'); if (b) b.click(); };
    pintarPlantillas();
  }

  /* ══════════ Mientras Cherry piensa ══════════ */
  var CARGA = null;
  var NOTAS = ['leyendo cómo hablas…', 'escribiendo tu titular', '¡aquí estás! esta foto va', 'ojo: aquí no te tapo la cara'];
  function carga(o) {
    var idea = String(o.idea || '').trim() || o.etiqueta || 'tu historia';
    var palabras = idea.replace(/[«»"*]/g, '').split(/\s+/).filter(Boolean).slice(0, 6);
    var fotos = (o.fotos || []).slice(0, 3);
    while (fotos.length < 3) fotos.push('');
    var foto = function (u, extra) { return u ? '<img ' + (extra || '') + ' src="' + esc(u) + '" alt="">' : '<i ' + (extra || '') + ' class="hs-sinfoto"></i>'; };
    var html =
      '<div class="hs-carga">' +
        '<div class="hs-trama"></div><div class="hs-estallido" aria-hidden="true"></div>' +
        '<img class="hs-arte" src="' + ARTE + '" alt="">' +
        '<div class="hs-tel" aria-hidden="true">' +
          '<div class="hs-segs">' + o.lista.map(function () { return '<i><b></b></i>'; }).join('') + '</div>' +
          '<div class="hs-capa c0"><span class="etiqueta">tu idea</span><div class="hs-burb" data-hs-tipeo></div><div class="hs-lineas"><i></i><i></i><i></i></div></div>' +
          '<div class="hs-capa c1"><div class="hs-pas">' + esc(o.etiqueta) + '</div><div class="hs-tit">' + palabras.map(function (p, k) { return '<span style="animation-delay:' + (k * .22) + 's">' + esc(p) + '</span>'; }).join(' ') + '</div></div>' +
          '<div class="hs-capa c2"><div class="hs-baraja">' + foto(fotos[1]) + foto(fotos[2]) + foto(fotos[0]) + '</div><div class="hs-cara"></div><div class="hs-lbl">buscando dónde estás</div></div>' +
          '<div class="hs-capa c3">' + foto(fotos[0], 'class="hs-fondo"') + '<div class="hs-som"></div><div class="hs-zona z1"></div><div class="hs-zona z2"></div><div class="hs-tit2">' + esc(palabras.join(' ')) + '</div><div class="hs-ok">¡listo!</div></div>' +
        '</div>' +
        '<div class="hs-der">' +
          '<div class="etiqueta hs-rosa">' + esc(o.etiqueta) + '</div>' +
          '<h3>' + esc(o.titulo) + '</h3>' +
          '<p class="hs-sub">Puedes ir a otra pestaña mientras tanto; solo no cierres esta.</p>' +
          '<ol class="pasos-ia hs-pasos">' + o.lista.map(function (p, k) { return '<li><span class="hs-p">' + (k + 1) + '</span><span>' + esc(p) + '</span></li>'; }).join('') + '</ol>' +
          '<div class="hs-nota" data-hs-nota></div>' +
        '</div>' +
        '<div class="hs-prog"><div class="hs-segsP">' + o.lista.map(function () { return '<i><b></b></i>'; }).join('') + '</div>' +
          '<div class="hs-eta">' + (o.eta ? '<span>Tarda ' + o.eta.cuanto + ' · ' + o.eta.html + '</span>' : '<span></span>') + '<span>Paso <b data-hs-n>1</b> de ' + o.lista.length + '</span></div></div>' +
      '</div>';
    return {
      html: html,
      montar: function (raiz) {
        parar();
        CARGA = { raiz: raiz, fase: -1, tk: null, tipeo: null, idea: idea, seg: o.seg || 40, n: o.lista.length, paso: 0 };
        fase(); CARGA.tk = setInterval(fase, 3200);
        paso(0);
      }
    };
  }
  // el celular repite cómo se arma una historia (idea → titular → fotos → acomodar) mientras Cherry trabaja
  function fase() {
    var C = CARGA; if (!C || !document.body.contains(C.raiz)) { parar(); return; }
    C.fase = (C.fase + 1) % 4;
    $$('.hs-capa', C.raiz).forEach(function (c, k) { c.classList.remove('on'); void c.offsetWidth; if (k === C.fase) c.classList.add('on'); });
    var segs = $$('.hs-tel .hs-segs b', C.raiz);
    segs.forEach(function (b, k) {
      b.style.transition = 'none';
      var j = k % 4;
      if (j < C.fase) b.style.width = '100%';
      else if (j === C.fase) { b.style.width = '0'; void b.offsetWidth; b.style.transition = 'width 3.1s linear'; b.style.width = '100%'; }
      else b.style.width = '0';
    });
    var nota = $('[data-hs-nota]', C.raiz); if (nota) nota.textContent = NOTAS[C.fase];
    if (C.fase === 0) {
      var el = $('[data-hs-tipeo]', C.raiz), n = 0; clearInterval(C.tipeo);
      if (el) { el.textContent = ''; C.tipeo = setInterval(function () { n++; el.textContent = C.idea.slice(0, n); if (n >= C.idea.length || n > 90) clearInterval(C.tipeo); }, 55); }
    }
  }
  // la barra de abajo sigue los pasos DE VERDAD (app.js avisa cada paso)
  function paso(i, total) {
    var C = CARGA; if (!C) return;
    C.paso = i; total = total || C.n;
    var bs = $$('.hs-segsP b', C.raiz);
    bs.forEach(function (b, k) {
      b.style.transition = 'none';
      if (k < i) b.style.width = '100%';
      else if (k === i) { b.style.width = '0'; void b.offsetWidth; b.style.transition = 'width ' + Math.max(4, Math.round(C.seg * (k === 0 ? .8 : .1))) + 's cubic-bezier(.2,.6,.4,1)'; b.style.width = '92%'; }
      else b.style.width = '0';
    });
    var n = $('[data-hs-n]', C.raiz); if (n) n.textContent = Math.min(total, i + 1);
    if (i >= total) {
      var nota = $('[data-hs-nota]', C.raiz); if (nota) nota.textContent = '¡lista! ábrela y cambia lo que quieras';
      clearInterval(C.tk); clearInterval(C.tipeo);
      $$('.hs-capa', C.raiz).forEach(function (c, k) { c.classList.toggle('on', k === 3); });
    }
  }
  function parar() { if (CARGA) { clearInterval(CARGA.tk); clearInterval(CARGA.tipeo); } CARGA = null; }

  /* ══════════ Editor ══════════ */
  var VISTA = 'ig';
  function editor() {
    var A = API(); if (!A) return;
    var c = A.car(); if (!c) return;
    var L = $('#lamina'); if (!L) return;
    var tel = L.parentElement.classList.contains('hs-tel-ed') ? L.parentElement : null;
    if (!tel) {
      /* (8-oct) Sergio: detrás de lo que se diseña NO va nada (ni ámbar ni estrella); el arte va en los bordes:
         el sello ámbar de la barra de arriba y la Mona Lisa al final de la tira de partes */
      var nom = $('.ed-nombre');
      // (9-oct) la automatización de esta historia: se escoge aquí y se amarra sola cuando cada parte sale publicada
      var prog = $('#b-programar');
      if (prog && !$('#hs-auto')) { var ba = document.createElement('button'); ba.type = 'button'; ba.id = 'hs-auto'; ba.className = 'hs-auto'; ba.onclick = abrirAuto; prog.parentNode.insertBefore(ba, prog); }
      if (nom && !$('.hs-sello')) { var sello = document.createElement('span'); sello.className = 'hs-sello'; sello.innerHTML = '<span class="hs-trama"></span><i class="hs-estallido"></i><b>Historia</b> 9:16'; nom.parentElement.insertBefore(sello, nom); }
      var vista = document.createElement('div'); vista.className = 'hs-vista'; vista.setAttribute('role', 'group'); vista.setAttribute('aria-label', 'Cómo ver la parte');
      vista.innerHTML = '<button type="button" class="chip" data-hs-vista="ig">Así se ve en Instagram</button><button type="button" class="chip" data-hs-vista="zona">Zona que tapa Instagram</button><button type="button" class="chip" data-hs-vista="limpia">Solo la imagen</button>';
      tel = document.createElement('div'); tel.className = 'hs-tel-ed';
      L.parentElement.insertBefore(vista, L);
      L.parentElement.insertBefore(tel, L);
      tel.appendChild(L);
      var cromo = document.createElement('div'); cromo.className = 'hs-cromo'; cromo.setAttribute('aria-hidden', 'true');
      cromo.innerHTML = '<div class="hs-segs"></div><div class="hs-ig"><i></i><span data-hs-cuenta></span><small>ahora</small><span class="hs-x">×</span></div>' +
        '<div class="hs-zona z1" style="height:' + ZONA_ARRIBA + '%"><span>Lo tapa Instagram</span></div><div class="hs-zona z2" style="height:' + ZONA_ABAJO + '%"><span>Lo tapa Instagram</span></div>';
      tel.appendChild(cromo);
      var nav = document.createElement('div'); nav.className = 'hs-nav';
      nav.innerHTML = '<button type="button" class="redondo hs-flecha" data-hs-mover="-1" aria-label="Parte anterior">‹</button><span data-hs-cual></span><button type="button" class="redondo hs-flecha" data-hs-mover="1" aria-label="Parte siguiente">›</button>';
      tel.after(nav);
      $$('[data-hs-vista]', vista).forEach(function (b) { b.onclick = function () { VISTA = b.dataset.hsVista; vistaAplicar(); }; });
      $$('[data-hs-mover]', nav).forEach(function (b) {
        b.onclick = function () { var c2 = A.car(); if (!c2) return; var i = Math.max(0, Math.min(c2.laminas.length - 1, LZ.i + (+b.dataset.hsMover))); var m = $('[data-lam="' + i + '"]'); if (m) m.click(); };
      });
      var acl = $('#escenario .aclaracion'); if (acl) acl.classList.add('hs-acl');
      LZ.montar(L, $('#escenario'));   // el celular cambió el ancho de la parte: se vuelve a medir
    }
    var n = c.laminas.length, i = LZ.i || 0;
    $('.hs-cromo .hs-segs').innerHTML = c.laminas.map(function (_, k) { return '<i class="' + (k < i ? 'lleno' : k === i ? 'cur' : '') + '"><b></b></i>'; }).join('');
    var m = A.E.marca || {};
    $('[data-hs-cuenta]').textContent = String(m.usuario || m.ig || m.nombre || 'tu_marca').replace(/^@/, '').toLowerCase().replace(/\s+/g, '');
    $('[data-hs-cual]').textContent = 'parte ' + (i + 1) + ' de ' + n;
    if (!$('#tira .hs-arte-tira')) { var at = document.createElement('div'); at.className = 'hs-arte-tira'; at.setAttribute('aria-hidden', 'true'); at.innerHTML = '<span class="hs-trama"></span><img src="' + ARTE + '" alt=""><span class="hs-mano-t">¡a crear!</span>'; $('#tira').appendChild(at); }
    $$('#tira .mini').forEach(function (b, k) {
      var s = b.querySelector(':scope > span'); if (!s) return;
      s.textContent = k === 0 ? 'Portada' : k === n - 1 ? 'Cierre' : 'Parte ' + (k + 1);
    });
    vistaAplicar();
    pintarAuto();
  }

  /* ══════════ Automatización de la historia ══════════
     (9-oct) Sergio: escogerla mientras se diseña; cuando la historia se programe y salga publicada, cada parte se amarra
     sola a esa automatización (ig-publicar → d.historias; ig-aviso atiende a quien responda cualquier parte). Aquí solo
     se ESCOGE una que ya existe (no se crea): se guarda en la historia como `automatizacion: {id, nombre}` y el calendario
     la manda con cada parte al programar. */
  var AUTOS = null;
  function esDeHistoria(f) { var d = ((f.grafo && f.grafo.nodos) || []).filter(function (n) { return n.tipo === 'disparador'; })[0]; return !!(d && d.d && d.d.historia); }
  function pintarAuto() {
    var A = API(), b = $('#hs-auto'); if (!A || !b) return;
    var c = A.car(), a = c && c.automatizacion;
    b.classList.toggle('on', !!a);
    b.innerHTML = a ? '<span class="hs-auto-ic">⚡</span><span class="hs-auto-t"><b>' + esc(a.nombre || 'Automatización') + '</b><small>se amarra al publicar</small></span>' : '<span class="hs-auto-ic">⚡</span>Automatización';
    b.title = a ? 'Automatización de esta historia: ' + (a.nombre || '') : 'Escoger la automatización de esta historia';
  }
  function cargarAutos() {
    var u = (window.CherryApp && CherryApp.usuario && CherryApp.usuario()) || {};
    return CherryApp.rest('/rest/v1/flujos_respuesta?select=id,nombre,activa,donde,media_id,grafo&user_id=eq.' + u.id + '&order=creado.desc')
      .then(function (fs) { AUTOS = (Array.isArray(fs) ? fs : []).filter(esDeHistoria); return AUTOS; });
  }
  function abrirAuto() {
    var A = API(); if (!A) return; var c = A.car(); if (!c) return;
    var v = document.createElement('div'); v.className = 'hs-auto-velo';
    v.innerHTML = '<div class="hs-auto-vent" role="dialog" aria-modal="true" aria-label="Automatización de esta historia">' +
      '<span class="hs-trama"></span><i class="hs-estallido"></i>' +
      '<div class="hs-auto-cab"><span class="etiqueta">Automatización de esta historia</span><h3>¿Qué pasa cuando te respondan?</h3>' +
      '<p>Escoge una de tus automatizaciones de historias. Queda esperando: cuando la historia se programe y salga publicada, cada parte se amarra sola. Responda la parte que responda, funciona.</p></div>' +
      '<div class="hs-auto-lista" data-hs-lista><p class="pista">Cargando tus automatizaciones…</p></div>' +
      '<div class="hs-auto-pie"><a href="respuestas.html" target="_blank" rel="noopener" class="hs-auto-link">Crear una en Respuestas automáticas ↗</a><button type="button" class="btn btn-linea btn-chico" data-hs-cerrar>Cerrar</button></div></div>';
    var app = $('#app') || document.body; app.appendChild(v);
    var cerrar = function () { v.remove(); };
    v.addEventListener('click', function (e) { if (e.target === v || e.target.closest('[data-hs-cerrar]')) cerrar(); });
    var L = $('[data-hs-lista]', v);
    var pintar = function () {
      var actual = c.automatizacion && c.automatizacion.id;
      if (!AUTOS.length) { L.innerHTML = '<p class="hs-auto-vacia">Todavía no tienes automatizaciones de historias. Créala en Respuestas automáticas y vuelve a escogerla aquí.</p>'; return; }
      L.innerHTML = AUTOS.map(function (f) {
        return '<button type="button" class="hs-auto-op' + (f.id === actual ? ' sel' : '') + '" data-hs-flujo="' + f.id + '"><i></i><span><b>' + esc(f.nombre || 'Sin nombre') + '</b><small>' + (f.activa ? 'Activa' : 'Apagada') + (f.id === actual ? ' · escogida para esta historia' : '') + '</small></span></button>';
      }).join('') + (actual ? '<button type="button" class="hs-auto-op hs-auto-quitar" data-hs-flujo=""><i></i><span><b>Sin automatización</b><small>la historia sale sola</small></span></button>' : '');
      $$('[data-hs-flujo]', L).forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.hsFlujo, f = AUTOS.filter(function (x) { return x.id === id; })[0];
          c.automatizacion = f ? { id: f.id, nombre: f.nombre || '' } : null;
          A.guardar(); pintarAuto(); cerrar();
        };
      });
    };
    (AUTOS ? Promise.resolve(AUTOS) : cargarAutos()).then(pintar, function () { L.innerHTML = '<p class="hs-auto-vacia">No pude cargar tus automatizaciones. Revisa tu conexión y vuelve a intentarlo.</p>'; AUTOS = null; });
  }

  function vistaAplicar() {
    var t = $('.hs-tel-ed'); if (!t) return;
    t.dataset.vista = VISTA;
    $$('[data-hs-vista]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.hsVista === VISTA); });
  }

  /* ══════════ Panel «Texto»: cada texto con la letra que tiene en la historia ══════════
     (8-oct) Sergio: «se ve muy común, genérica». Cada campo lleva su número, se escribe con la letra y el estilo de
     su papel (titular gruesa, remate en itálica, pastilla como pastilla) y cuenta las letras contra lo que cabe.
     «Pídele a Cherry» es una tarjeta ámbar. El texto de la publicación no va: las historias no llevan. */
  function textos(P) {
    var A = API(); if (!A || !window.LZ) return;
    var c = A.car(); if (!c) return;
    var n = c.laminas.length, i = LZ.i || 0, tipo = i === 0 ? 'portada' : i === n - 1 ? 'cierre' : 'item';
    var esq = (window.FAMILIAS && FAMILIAS.esquema(c.familia)) || {}, campos = esq[tipo] || {}, comun = esq.comun || {};
    var nombre = i === 0 ? 'Portada' : i === n - 1 ? 'Cierre' : 'Parte ' + (i + 1);
    var pista = $('.pista', P);
    var cab = document.createElement('div'); cab.className = 'hs-tx-cab';
    cab.innerHTML = '<i class="hs-estallido"></i><div><span class="etiqueta">Parte ' + (i + 1) + ' de ' + n + '</span><b>' + nombre + '</b></div><span class="hs-tx-mano">lo que dice esta parte</span>';
    if (pista) { pista.textContent = 'Escribe aquí o toca el texto en el celular. Para cambiar letra, tamaño o color, tócalo en la parte.'; pista.parentNode.insertBefore(cab, pista); } else P.insertBefore(cab, P.firstChild);
    $$('label.campo', P).forEach(function (lb, k) {
      var ta = $('textarea[data-t]', lb); if (!ta) return;
      var el = LZ.buscar(ta.dataset.t); if (!el) return;
      var papel = String(el.papel || ''), def = campos[papel] || comun[papel] || null, max = def && def.max;
      lb.classList.add('hs-tx');
      var et = $('.etiqueta', lb);
      if (et) et.innerHTML = '<span class="hs-tx-n">' + (k + 1) + '</span>' + esc(el.nombre) + (max ? '<span class="hs-tx-cuenta" data-max="' + max + '"></span>' : '');
      ta.style.fontFamily = "'" + LZ.res(el.fuente) + "', var(--f-texto)";
      ta.classList.add('hs-tx-' + (/pastilla/.test(papel) ? 'pastilla' : el.cursiva ? 'remate' : el.tam >= 60 ? 'titular' : 'cuerpo'));
      if (el.mayus) ta.style.textTransform = 'uppercase';
      contar(lb);
    });
    var pide = $('[data-pide]', P), grupo = pide && pide.closest('.campo');
    if (grupo) {
      grupo.classList.add('hs-pide');
      var et2 = $('.etiqueta', grupo); if (et2) et2.outerHTML = '<span class="hs-trama"></span><div class="hs-pide-cab"><b>Pídele a Cherry</b><span>sobre el último texto que tocaste</span></div>';
      var IC = { corto: '✂', directo: '➝', gancho: '✦' };
      $$('[data-pide]', grupo).forEach(function (b) { var ic = IC[b.dataset.pide] || '❝'; if (!b.disabled) b.innerHTML = '<span class="hs-pide-ic">' + ic + '</span>' + esc(b.textContent); });
    }
    var cap = $('#caption', P); if (cap) { var g = cap.closest('.grupo'); if (g) g.hidden = true; }
    if (!P.dataset.hsTx) { P.dataset.hsTx = '1'; P.addEventListener('input', function (e) { var lb = e.target.closest && e.target.closest('.hs-tx'); if (lb) contar(lb); }); }
  }
  function contar(lb) {
    var ct = $('.hs-tx-cuenta', lb), ta = $('textarea', lb); if (!ct || !ta) return;
    var max = +ct.dataset.max, n = ta.value.replace(/\*/g, '').length;
    ct.textContent = n + ' / ' + max; ct.classList.toggle('pasado', n > max);
  }

  window.HistoriasUI = { iniciar: iniciar, lista: lista, carga: carga, paso: paso, parar: parar, editor: editor, textos: textos };
})();

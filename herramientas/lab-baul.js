/* lab-baul.js — el baúl del Laboratorio (29-sep-2026)
 *
 * Aprobado por Sergio el 29-sep (propuesta «Viñetas, baúl y marca»): la navegación —cuatro cajones grandes (Ideas,
 * Ganchos, Estructuras, Formatos) que se abren con sus filtros— y «Nueva fórmula» —cuatro ranuras, la sugerencia de
 * Cherry, «Guardar fórmula» y «Grabar con esta fórmula» que la manda a «Por grabar»—.
 *
 * Lo que pidió encima: «que usáramos la nueva identidad… una carpeta llena de elementos… más visual, alguna imagen o
 * algo alusivo en cada tarjeta». Por eso:
 *   · el emblema de cada cajón es una de las SEIS cerezas que aprobó el 26-sep (`Cherry Marca/aprobadas hoja4`),
 *     recortada tal cual — nada dibujado en código (ver la memoria «nada de sucedáneos»);
 *   · la imagen de cada tarjeta son las PORTADAS REALES de sus reels: los que usaron las piezas que mejor le
 *     funcionan. Cada imagen dice lo del texto;
 *   · la tarjeta de «Nueva fórmula» lleva de fondo la cereza maciza, que él guardó como elemento secundario «para
 *     patrones, sellos, adornos y fondos».
 *
 * El estado de cada pieza (magnética, temporal, sin probar, no atrae) NO se calcula aquí: sale de `estadoPieza` del
 * Laboratorio, con los videos que la usaron. Una fórmula se juzga igual: por los videos que llevaron sus cuatro piezas.
 *
 * Lo usa laboratorio.html a través de window.LabAPI. Todo lo visible vive bajo `.lb` (lab-baul.css).
 *
 * (21-oct) Sergio: «el baúl es para guardar las cosas que ya sirvieron». En el baúl solo se ven las MAGNÉTICAS y las que
 * HAN FUNCIONADO; lo demás no se borra (sigue en Mis videos y Cherry no lo recomienda) y entra solo si un día funciona.
 * Por dentro, cada cajón es una TABLA (escogió la B): «Todas · Tuyas · De referentes», buscar, ordenar, una fila por pieza
 * y su ficha a la derecha. «De tus referentes» = lo guardado con «Desmontar» de un video de otro creador (D.referentes).
 * Propuesta: https://claude.ai/artifact/7Xdhg63CGEQRnHGWjqz7Yf
 */
(function () {
  'use strict';
  var A = function () { return window.LabAPI; };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var RUTA = '../assets/marca/baul/';
  /* (16-oct, sobrio) la flecha ↗ de los botones (va en un círculo: el estilo lo pone guion/sobrio/baul.css en laboratorio.html) */
  var FLECHA = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 10L10 4M5 4h5v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /* Cuál de las seis cerezas aprobadas lleva cada cajón. c4 (el escudo) es la candidata a icono principal: va en la
     fórmula, que es lo que junta a las otras cuatro. */
  var EMBLEMA = { idea: 'c1', gancho: 'c2', estructura: 'c3', formato: 'c6', formula: 'c4' };
  var ORDEN = ['idea', 'gancho', 'estructura', 'formato'];
  var TIT = { idea: 'Ideas', gancho: 'Ganchos', estructura: 'Estructuras', formato: 'Formatos' };
  var UNO = { idea: 'Idea', gancho: 'Gancho', estructura: 'Estructura', formato: 'Formato' };
  var DE_QUE = { idea: 'de qué va el video', gancho: 'con qué se para el scroll', estructura: 'en qué orden se cuenta', formato: 'cómo se graba' };
  var PESO = { magnetica: 0, media: 1, neutra: 2, inerte: 3 };
  var EST = ['magnetica', 'media', 'neutra', 'inerte'];
  /* Los nombres son los del Laboratorio (MAG): si allá cambia una palabra, cambia aquí sola. */
  function nombreEstado(e, n) { var M = A().MAG[e]; return n === 1 ? M.uno : M.t.toLowerCase(); }

  function emblema(t, cls) {
    return '<img class="lb-emb' + (cls ? ' ' + cls : '') + '" src="' + RUTA + EMBLEMA[t] + '.webp" alt="" aria-hidden="true">';
  }
  function pct(x) { return x == null ? '' : Math.round(x) + ' %'; }
  function usoTxt(u) {
    if (u.n) return u.aciertos + ' de ' + u.n + (u.media != null ? ' · media ' + pct(u.media) : '');
    if (u.tapados) return 'tapada ' + u.tapados + (u.tapados === 1 ? ' vez' : ' veces');
    return 'sin estrenar';
  }

  /* (21-oct) solo esto entra al baúl */
  function sirve(x) { return x.e === 'magnetica' || x.e === 'media'; }
  var NOMB = { magnetica: ['Magnética', 'Magnéticas', 'funcionan cada vez que las usas'], media: ['Ha funcionado', 'Han funcionado', 'te funcionaron, pero no siempre'] };
  var VIOLETA = '#7C6CF2';
  var SUB = { idea: 'Las ideas que ya te funcionaron: de qué va el video.', gancho: 'Los ganchos que ya te funcionaron: cómo arrancas y con qué frase.',
    estructura: 'Las estructuras que ya te funcionaron: en qué orden se cuenta.', formato: 'Los formatos que ya te funcionaron: cómo se graba.' };
  var FUERA = { idea: ['idea', 'ideas', 'f'], gancho: ['gancho', 'ganchos', 'm'], estructura: ['estructura', 'estructuras', 'f'], formato: ['formato', 'formatos', 'm'] };
  function miles(n) { return Number(n || 0).toLocaleString('es-CO'); }
  function fechaCorta(f) {
    var d = new Date(String(f || '').slice(0, 10) + 'T12:00:00'); if (isNaN(d)) return '';
    return d.getDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()];
  }
  /* el título de un reel es su texto entero: para nombrarlo bastan las primeras palabras */
  function corto(t) {
    var w = String(t || '').split('\n')[0].replace(/[^\p{L}\p{N}¿?¡!«»"' ,.:%$-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return w.slice(0, 5).join(' ') + (w.length > 5 ? '…' : '');
  }
  function mejorReel(x) { return x.reels.slice().sort(function (a, b) { return (Number(b.visitas) || 0) - (Number(a.visitas) || 0); })[0] || null; }
  /* Las estructuras que Cherry no supo bautizar («Estructura de 7 pasos», hay muchas iguales) se enseñan con su mejor video */
  function nombreVer(t, x) {
    var m = /^Estructura de (\d+) pasos$/.exec(x.p.texto || ''), r = m && mejorReel(x);
    return r && r.titulo ? 'La de «' + corto(r.titulo) + '»' : cap1(nombre(x.p));
  }
  /* (21-oct) lo guardado de REFERENTES con «Desmontar» (laboratorio.html › guardarReferentes): les funcionó a otros; tú aún
     no lo pruebas. Al probarlo se vuelve pieza tuya (r.probada = su id): mientras esa pieza no se mida sigue aquí como
     «La estás probando»; después sube a tus piezas si te funcionó, o sale del baúl si no. */
  function refsDe(tipo) {
    var api = A(), D = api.D();
    return (D.referentes || []).filter(function (r) {
      if (r.cuenta !== D.activa || r.tipo !== tipo) return false;
      if (!r.probada) return true;
      /* con «Probarla en un video» queda su guion: hasta que ese video se publique, la está probando */
      var f = r.plan && api.planPorId && api.planPorId(r.plan);
      if (f && api.estadoVideoPlan(f) !== 'publicado') return true;
      return !!api.piezaPorId(tipo, r.probada) && api.estadoPieza(tipo, r.probada).e === 'neutra';
    });
  }
  /* el nombre de un estado con las palabras de la tabla (las magnéticas y las que «han funcionado») */
  function unoE(e) { return NOMB[e] ? NOMB[e][0] : A().MAG[e].uno; }
  function cap1(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  function nombreRef(r) {
    var m = /^Estructura de (\d+) pasos$/.exec(r.nombre || '');
    return m ? 'La de ' + r.autor : cap1(r.nombre);
  }

  /* ── Los datos ── */
  function datosDe(tipo) {
    var api = A(), vs = api.videosDeCuenta();
    return api.piezasDe(tipo).map(function (p) {
      var e = api.estadoPieza(tipo, p.id);
      var reels = vs.filter(function (v) { return v.piezas && v.piezas[tipo] === p.id; })
        .sort(function (a, b) { return (isFinite(b.retencion) ? Number(b.retencion) : -1) - (isFinite(a.retencion) ? Number(a.retencion) : -1); });
      return { p: p, e: e.e, u: e.u, reels: reels,
        tapas: reels.filter(function (v) { return v.tapa; }).map(function (v) { return { src: v.tapa, t: v.titulo, r: v.retencion }; }) };
    }).sort(function (a, b) {
      /* Dentro de cada estado manda la que MÁS VECES ha funcionado: 3 de 4 pesa más que 1 de 1 con buena media. La
         proporción va suavizada (+1 / +2) para que un solo video no gane por suerte. */
      var ley = function (x) { return (x.u.aciertos + 1) / (x.u.n + 2); };
      return PESO[a.e] - PESO[b.e] || ley(b) - ley(a) || b.u.aciertos - a.u.aciertos ||
        ((b.u.media == null ? -1 : b.u.media) - (a.u.media == null ? -1 : a.u.media)) || b.reels.length - a.reels.length;
    });
  }
  /* Lo que puede ser «la que mejor te funciona» o la sugerencia de una fórmula. Una estructura de uno o dos pasos no
     es una estructura (sale de un reel de una sola escena): se lista, pero no se recomienda. */
  function recomendable(t, x) {
    if (x.e === 'inerte') return false;
    if (t === 'estructura') return String(x.p.seq || '').split(' → ').filter(Boolean).length >= 3 || !x.p.seq;
    return true;
  }
  /* «Estructura de 1 pasos» es un nombre viejo mal puesto (ya se corrigió al nombrarlas): se enseña bien. */
  function nombre(p) { return String(p.texto || '').replace(/^Estructura de 1 pasos$/, 'Estructura de un paso'); }
  function cuentas(items) {
    var c = { magnetica: 0, media: 0, neutra: 0, inerte: 0 };
    items.forEach(function (x) { c[x.e]++; });
    return c;
  }
  /* Las portadas de una tarjeta: la del mejor reel de cada una de las mejores piezas, sin repetir. */
  function portadas(items, max, vistas) {
    var out = [];
    vistas = vistas || {};
    items.forEach(function (x) {
      if (out.length >= max) return;
      var t = x.tapas.filter(function (y) { return !vistas[y.src]; })[0];
      if (t) { vistas[t.src] = 1; out.push(t); }
    });
    return out;
  }

  /* ── La navegación ── */
  var S = { vista: 'inicio', tipo: null, filtro: '', formula: null, nombre: '', editando: null, de: '', q: '', orden: 'funciona' };
  var sucio = true;
  function raiz() { return document.getElementById('bau-rejilla'); }
  function visible() { var v = document.getElementById('v4'); return !!(v && v.classList.contains('on')); }

  /* Se pinta solo si el baúl está a la vista: pintar() del Laboratorio se llama con cada cambio, y el baúl mide
     cada pieza contra todos los videos. Al entrar se pinta. */
  function pintar() {
    if (!visible()) { sucio = true; return; }
    sucio = false;
    var r = raiz(); if (!r) return;
    if (S.vista === 'cajon') r.innerHTML = htmlCajon(S.tipo);
    else if (S.vista === 'mesa') r.innerHTML = htmlMesa();
    else r.innerHTML = htmlInicio();
    atar(r);
    var av = document.getElementById('bau-avisos');
    if (av) av.hidden = S.vista !== 'inicio';
  }
  function ir(vista, tipo) {
    cerrarFicha();
    S.vista = vista; S.tipo = tipo || null; S.filtro = ''; S.de = ''; S.q = '';
    if (vista === 'mesa' && !S.formula) S.formula = sugerencia();
    pintar();
    var r = raiz(); if (r && r.scrollIntoView) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function entrar() { S.vista = 'inicio'; S.tipo = null; S.filtro = ''; sucio = true; pintar(); }

  /* ── 1 · El baúl: cuatro cajones y la fórmula ── */
  function htmlInicio() {
    var api = A();
    var marca = (api.marcaActiva && api.marcaActiva()) || '';
    var todos = {}, total = 0, usadas = {};
    ORDEN.forEach(function (t) { todos[t] = datosDe(t); total += todos[t].length + refsDe(t).length; });
    if (!total) return api.htmlBaulVacio ? api.htmlBaulVacio() : '';

    var cajones = ORDEN.map(function (t) {
      var items = todos[t].filter(sirve), c = cuentas(items), n = items.length, nr = refsDe(t).length;
      var mejor = items.filter(function (x) { return recomendable(t, x); })[0];
      var funciona = mejor && (mejor.e === 'magnetica' || mejor.e === 'media');
      /* cada cajón con reels distintos: si no, los tres mejores reels salen en las cuatro tarjetas */
      var tapas = portadas(items, 3, usadas);
      if (tapas.length < 3) tapas = tapas.concat(portadas(items, 3 - tapas.length, {}).filter(function (x) {
        return !tapas.some(function (y) { return y.src === x.src; }); }));
      return '<button type="button" class="lb-cajon" data-lb-cajon="' + t + '" aria-label="Abrir ' + TIT[t] + '">' +
        '<div class="lb-tapas n' + tapas.length + '" aria-hidden="true">' + tapas.map(function (x, i) {
          return '<img class="lb-tapa t' + (i + 1) + '" src="' + esc(x.src) + '" alt="" loading="lazy">';
        }).join('') + '</div>' +
        '<div class="lb-c-cab">' + emblema(t) + '<div><span class="lb-k">' + esc(DE_QUE[t]) + '</span><h4>' + TIT[t] + '</h4></div></div>' +
        '<div class="lb-n">' + n + '</div>' +
        '<div class="lb-barra" aria-hidden="true">' + EST.map(function (e) {
          return c[e] ? '<i style="flex-grow:' + c[e] + ';background:' + color(e) + '"></i>' : '';
        }).join('') + '</div>' +
        '<div class="lb-leyenda">' + EST.filter(function (e) { return c[e]; }).map(function (e) {
          return '<span><i style="background:' + color(e) + '"></i>' + c[e] + ' ' + esc((NOMB[e] ? NOMB[e][c[e] === 1 ? 0 : 1] : nombreEstado(e, c[e])).toLowerCase()) + '</span>';
        }).join('') + (nr ? '<span><i style="background:' + VIOLETA + '"></i>' + nr + ' de referentes</span>' : '') + '</div>' +
        '<p class="lb-mejor">' + (funciona
          ? 'La que mejor te funciona <b>' + esc(nombre(mejor.p)) + '</b>' + (mejor.u.media != null ? '<span>media ' + pct(mejor.u.media) + '</span>' : '')
          : n ? 'Ninguna ha pasado tu corte todavía.' : 'Vacío todavía.') + '</p>' +
        '<span class="lb-flecha" aria-hidden="true">' + FLECHA + '</span></button>';
    }).join('');

    var fs = formulasDe();
    var sug = sugerencia();
    return '<header class="lb-cab"><div><span class="etiqueta">El baúl' + (marca ? ' · ' + esc(marca) : '') + '</span>' +
      '<h3>Tu baúl</h3></div><p class="lb-res">' + ORDEN.map(function (t) { return todos[t].filter(sirve).length + ' ' + TIT[t].toLowerCase(); }).join(' · ') + '</p></header>' +
      '<div class="lb-cajones">' + cajones + '</div>' +
      '<button type="button" class="lb-formula" data-lb-ir="mesa">' +
      '<span class="lb-f-fondo" aria-hidden="true"></span>' +
      emblema('formula', 'lb-emb-f') +
      '<div class="lb-f-tx"><span class="lb-k">el laboratorio</span><h4>Nueva fórmula</h4>' +
      '<p>Junta la idea, el gancho, la estructura y el formato que te funcionaron, y grábalo.' +
      (fs.length ? ' Tienes ' + fs.length + ' fórmula' + (fs.length === 1 ? '' : 's') + ' guardada' + (fs.length === 1 ? '' : 's') + '.' : '') + '</p></div>' +
      '<div class="lb-f-sug" aria-label="La sugerencia de Cherry">' + ORDEN.map(function (t) {
        var p = sug[t] && A().piezaPorId(t, sug[t]);
        return '<span><em>' + UNO[t] + '</em>' + (p ? esc(nombre(p)) : '—') + '</span>';
      }).join('') + '</div>' +
      '<span class="lb-f-ir">Armar una fórmula<i aria-hidden="true">' + FLECHA + '</i></span></button>' +
      otras();
  }

  function color(e) { return { magnetica: 'var(--rosa)', media: '#E8823C', neutra: '#7BB661', inerte: '#6E6166' }[e]; }

  /* Lo que no es una pieza sigue guardado, pero no manda (igual que antes del rediseño). */
  function otras() {
    var fs = A().fichasDeMarca ? A().fichasDeMarca() : [];
    if (!fs.length) return '';
    return '<details class="otras lb-otras"><summary>Otras observaciones · ' + fs.length + '</summary><div class="rej" style="margin-top:12px">' +
      fs.map(function (f) {
        return '<div class="fi"><button type="button" class="x" data-lb-borra-f="' + esc(f.id) + '" aria-label="Quitar del baúl">✕</button>' +
          (f.foto ? '<img class="fi-foto" src="' + f.foto + '" alt="">' : '') +
          '<span class="tp">' + esc(f.tipo) + '</span><div class="q">' + esc(f.texto) + '</div>' +
          '<div class="m">' + esc(f.nota || '') + '</div></div>';
      }).join('') + '</div></details>';
  }

  /* ── 2 · Un cajón abierto: la tabla (21-oct, la B) ── */
  function htmlCajon(t) {
    var todos = datosDe(t), mias = todos.filter(sirve), fuera = todos.length - mias.length, rs = refsDe(t);
    var nT = mias.length, nR = rs.length;
    var q = String(S.q || '').trim().toLowerCase();
    var pasa = function (txt) { return !q || txt.toLowerCase().indexOf(q) >= 0; };
    mias = mias.filter(function (x) { return pasa([nombreVer(t, x), x.p.frase, x.p.seq, x.p.tema, x.p.angulo].join(' ')); });
    rs = rs.filter(function (r) { return pasa([r.nombre, r.detalle, r.autor].join(' ')); });
    mias.forEach(function (x) {
      var m = mejorReel(x); x.mejor = m ? Number(m.visitas) || 0 : 0; x.mejorR = m;
      x.ult = x.reels.map(function (v) { return String(v.fecha || v.creado || '').slice(0, 10); }).sort().pop() || '';
    });
    var ley = function (x) { return (x.u.aciertos + 1) / (x.u.n + 2); };
    mias.sort(S.orden === 'vistas' ? function (a, b) { return b.mejor - a.mejor; }
      : S.orden === 'reciente' ? function (a, b) { return b.ult.localeCompare(a.ult); }
      : function (a, b) { return PESO[a.e] - PESO[b.e] || b.u.aciertos - a.u.aciertos || ley(b) - ley(a) || b.mejor - a.mejor; });
    rs.sort(S.orden === 'reciente' ? function (a, b) { return String(b.guardado || '').localeCompare(String(a.guardado || '')); }
      : function (a, b) { return (Number(b.vistas) || 0) - (Number(a.vistas) || 0); });
    var maxT = Math.max.apply(null, mias.map(function (x) { return x.mejor; }).concat([1]));
    var maxR = Math.max.apply(null, rs.map(function (r) { return Number(r.vistas) || 0; }).concat([1]));
    var detalle = function (x) {
      var p = x.p;
      if (t === 'gancho' && p.frase) return '<span>«' + esc(p.frase) + '»</span>';
      if (t === 'estructura' && p.seq) { var ps = String(p.seq).split(' → '); return '<span>' + ps.length + ' pasos · ' + esc(ps.slice(0, 4).join(' → ')) + (ps.length > 4 ? ' …' : '') + '</span>'; }
      if (t === 'idea' && p.tema) return '<span>' + esc(p.tema) + '</span>';
      return '';
    };
    var filas = '';
    if (S.de !== 'ref') ['magnetica', 'media'].forEach(function (e) {
      var ys = mias.filter(function (x) { return x.e === e; });
      if (!ys.length) return;
      filas += '<tr class="lb-g"><td colspan="6">' + NOMB[e][1] + ' · ' + ys.length + '<small>' + NOMB[e][2] + '</small></td></tr>';
      ys.forEach(function (x) {
        var m = x.mejorR, tapa = m && m.tapa;
        filas += '<tr class="lb-fila" data-lb-ver="' + t + ':' + esc(x.p.id) + '" tabindex="0">' +
          '<td><div class="lb-celda">' + (tapa ? '<img class="lb-mini2" src="' + esc(tapa) + '" alt="" loading="lazy">' : '<span class="lb-mini2 vacia" aria-hidden="true">—</span>') +
          '<div><b>' + esc(nombreVer(t, x)) + '</b>' + detalle(x) + '</div></div></td>' +
          '<td><span class="lb-est"><i style="background:' + color(e) + '"></i>' + NOMB[e][0] + '</span></td>' +
          '<td>' + (x.mejor ? '<div class="lb-vis"><span><b>' + miles(x.mejor) + '</b> vistas</span><div class="lb-bar"><i style="width:' + Math.max(4, Math.round(x.mejor / maxT * 100)) + '%"></i></div><small>' + esc(corto(m.titulo)) + '</small></div>' : '<small class="lb-gris">—</small>') + '</td>' +
          '<td>Funcionó ' + x.u.aciertos + ' de ' + x.u.n + (x.u.n === 1 ? ' vez' : ' veces') + '</td>' +
          '<td>' + (x.u.media != null ? '<b class="lb-num">' + pct(x.u.media) + '</b>' : '—') + '</td>' +
          '<td>' + (x.ult ? esc(fechaCorta(x.ult)) : '—') + '</td></tr>';
      });
    });
    if (S.de !== 'tuyas' && rs.length) {
      filas += '<tr class="lb-g ref"><td colspan="6">De tus referentes · ' + rs.length + '<small>les funcionó a otros; tú aún no las pruebas</small></td></tr>';
      rs.forEach(function (r) {
        var v = Number(r.vistas) || 0, det = r.tipo === 'gancho' ? '«' + r.detalle + '»' : r.tipo === 'estructura' ? String(r.detalle || '').split(' → ').length + ' pasos · ' + String(r.detalle || '').split(' → ').slice(0, 4).join(' → ') + ' …' : r.detalle;
        filas += '<tr class="lb-fila" data-lb-ref="' + esc(r.id) + '" tabindex="0">' +
          '<td><div class="lb-celda">' + (r.portada ? '<img class="lb-mini2" src="' + r.portada + '" alt="">' : '<span class="lb-mini2 vacia" aria-hidden="true">—</span>') +
          '<div><b>' + esc(nombreRef(r)) + '</b>' + (det ? '<span>' + esc(det) + '</span>' : '') + '</div></div></td>' +
          '<td><span class="lb-autor"><i></i>' + esc(r.autor) + '</span><small class="lb-gris">' + (r.probada ? 'La estás probando' : 'Aún no la pruebas') + '</small></td>' +
          '<td>' + (v ? '<div class="lb-vis"><span><b>' + miles(v) + '</b> vistas en su cuenta</span><div class="lb-bar ref"><i style="width:' + Math.max(4, Math.round(v / maxR * 100)) + '%"></i></div></div>' : '<small class="lb-gris">sin el dato</small>') + '</td>' +
          '<td>Sale de 1 video suyo</td><td><small class="lb-gris">—</small></td>' +
          '<td>Guardada ' + esc(fechaCorta(r.guardado)) + '</td></tr>';
      });
    }
    var F = FUERA[t];
    var vacio = !nT && !nR;
    return '<div class="lb-c2">' +
      '<button type="button" class="lb-volver" data-lb-ir="inicio">‹ Tu baúl</button>' +
      '<header class="lb-c2-cab"><div><h3>' + TIT[t] + '</h3><p>' + esc(SUB[t]) + '</p></div>' +
      '<div class="lb-c2-herr"><div class="lb-de" role="group" aria-label="De quién">' + [['', 'Todas', nT + nR], ['tuyas', 'Tuyas', nT], ['ref', 'De referentes', nR]].map(function (o) {
        return '<button type="button" data-lb-de="' + o[0] + '" aria-pressed="' + (S.de === o[0]) + '">' + o[1] + '<small>' + o[2] + '</small></button>';
      }).join('') + '</div>' +
      '<label class="lb-buscar"><span aria-hidden="true">⌕</span><input id="lb-q" type="search" value="' + esc(S.q || '') + '" placeholder="Buscar en este cajón" aria-label="Buscar en este cajón"></label>' +
      '<select class="lb-orden" id="lb-orden" aria-label="Ordenar">' + [['funciona', 'Lo que más te funciona'], ['vistas', 'Más vistas'], ['reciente', 'Lo más reciente']].map(function (o) {
        return '<option value="' + o[0] + '"' + (S.orden === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div></header>' +
      (vacio ? '<div class="lb-vacio2"><b>Todavía no tienes ' + F[1] + ' que te funcionen</b><span>Cuando un video te funcione, sus piezas entran solas aquí. Y lo que guardes de tus referentes con «Desmontar», también.</span></div>'
        : '<div class="lb-tabla"><table><thead><tr><th>Pieza</th><th>Cómo te ha ido</th><th>Su mejor video</th><th>Veces</th><th>Retención</th><th>Última vez</th></tr></thead><tbody>' +
          (filas || '<tr><td colspan="6" class="lb-gris">Nada con eso.</td></tr>') + '</tbody></table></div>') +
      (fuera && S.de !== 'ref' ? '<p class="lb-fuera"><span><b>' + fuera + ' ' + (fuera === 1 ? F[0] : F[1]) + ' no ' + (fuera === 1 ? 'está' : 'están') + ' aquí</b> porque no ' +
        (fuera === 1 ? 'atrajo o no se pudo' : 'atrajeron o no se pudieron') + ' medir.</span><span>' + (fuera === 1 ? 'No se borró: sigue' : 'No se borraron: siguen') + ' en «Mis videos», y Cherry no te ' +
        (F[2] === 'f' ? (fuera === 1 ? 'la' : 'las') : (fuera === 1 ? 'lo' : 'los')) + ' recomienda.</span></p>' : '') +
      '</div>';
  }

  /* ── La ficha de una pieza (a la derecha) ── */
  function cerrarFicha() { document.querySelectorAll('.lb-velo, .lb-ficha').forEach(function (x) { x.remove(); }); }
  function ponerFicha(html, etiqueta) {
    cerrarFicha();
    var velo = document.createElement('div'); velo.className = 'lb-velo'; velo.onclick = cerrarFicha;
    var f = document.createElement('aside'); f.className = 'lb-ficha'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', etiqueta);
    f.innerHTML = '<button type="button" class="lb-f-x" aria-label="Cerrar">✕</button>' + html;
    document.body.appendChild(velo); document.body.appendChild(f);
    f.querySelector('.lb-f-x').onclick = cerrarFicha; f.querySelector('.lb-f-x').focus();
    return f;
  }
  function pasosHtml(seq) {
    return '<div class="lb-pasos">' + String(seq || '').split(' → ').filter(Boolean).map(function (x) {
      return '<i class="' + (/^Gancho/i.test(x) ? 'g' : /loop/i.test(x) ? 'l' : '') + '">' + esc(x) + '</i>';
    }).join('') + '</div>';
  }
  function abrirFicha(t, id) {
    var x = datosDe(t).filter(function (y) { return y.p.id === id; })[0]; if (!x) return;
    var p = x.p, m = mejorReel(x), e = NOMB[x.e] || [A().MAG[x.e].uno, '', A().MAG[x.e].d];
    var cajas = '';
    if (t === 'gancho' && p.frase) cajas += '<div class="lb-f-caja"><span class="lb-k">Tu frase</span><p class="lb-f-frase">«' + esc(p.frase) + '»</p></div>';
    if (t === 'idea') cajas += '<div class="lb-f-caja">' + (p.tema ? '<span class="lb-k">Tema</span><p>' + esc(p.tema) + '</p>' : '') +
      (p.angulo && p.angulo !== p.texto ? '<span class="lb-k">El ángulo</span><p>' + esc(p.angulo) + '</p>' : '') +
      (p.creencia ? '<span class="lb-k">Lo que la gente cree</span><p>' + esc(p.creencia) + '</p>' : '') + '</div>';
    if (t === 'estructura' && p.seq) cajas += '<div class="lb-f-caja"><span class="lb-k">Sus ' + String(p.seq).split(' → ').length + ' pasos, en orden</span>' + pasosHtml(p.seq) + '</div>';
    var vids = x.reels.slice().sort(function (a, b) { return (Number(b.visitas) || 0) - (Number(a.visitas) || 0); });
    var f = ponerFicha('<div><span class="lb-k">' + UNO[t] + '</span><h2>' + esc(nombreVer(t, x)) + '</h2></div>' +
      '<div class="lb-f-est"><span class="lb-est"><i style="background:' + color(x.e) + '"></i>' + esc(e[0]) + '</span><span>' + esc(e[2].charAt(0).toUpperCase() + e[2].slice(1)) + '</span></div>' +
      '<div class="lb-f-nums"><div><b>' + (m && m.visitas ? miles(m.visitas) : '—') + '</b><span>vistas de su mejor video</span></div><div><b>' + (x.u.n ? x.u.aciertos + '/' + x.u.n : '—') + '</b><span>veces que funcionó</span></div><div><b>' + (x.u.media != null ? pct(x.u.media) : '—') + '</b><span>retención media</span></div></div>' +
      cajas +
      '<div class="lb-f-vids"><span class="lb-k">Tus videos con ' + (t === 'idea' ? 'esta idea' : t === 'gancho' ? 'este gancho' : t === 'estructura' ? 'esta estructura' : 'este formato') + ' · ' + vids.length + '</span>' +
      vids.map(function (v) {
        return '<div class="lb-f-vid">' + (v.tapa ? '<img src="' + esc(v.tapa) + '" alt="" loading="lazy">' : '<span class="lb-mini2 vacia" aria-hidden="true">—</span>') +
          '<div><b>' + esc(corto(v.titulo) || 'Video') + '</b><small>' + esc(fechaCorta(v.fecha || v.creado)) + (v.retencion != null ? ' · retención ' + Math.round(v.retencion) + ' %' : '') + '</small></div>' +
          '<span class="lb-num">' + (v.visitas ? miles(v.visitas) : '—') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="lb-f-acc"><button type="button" class="lb-b-negro" data-lb-f-formula="' + t + ':' + esc(p.id) + '">Usar en una nueva fórmula</button></div>', nombreVer(t, x));
    atarFicha(f);
  }
  function piezaDeRef(r) {
    var api = A(), extra = {};
    if (r.tipo === 'idea') extra = { angulo: r.nombre, creencia: r.creencia || '', realidad: r.realidad || '' };
    if (r.tipo === 'gancho') extra = { frase: r.detalle || '' };
    if (r.tipo === 'estructura') extra = { seq: r.detalle || '', escenas: String(r.detalle || '').split(' → ').filter(Boolean).map(function (x) { return { tipo: x }; }) };
    var p = api.crearPieza(r.tipo, r.tipo === 'estructura' ? nombreRef(r) + ' · ' + String(r.detalle || '').split(' → ').length + ' pasos' : r.nombre, extra);
    if (p && !r.probada) r.probada = p.id;
    return p;
  }
  function abrirRef(id) {
    var D = A().D(), r = (D.referentes || []).filter(function (y) { return y.id === id; })[0]; if (!r) return;
    var caja = r.tipo === 'gancho' ? '<div class="lb-f-caja"><span class="lb-k">Su frase, tal cual</span><p class="lb-f-frase">«' + esc(r.detalle) + '»</p></div>'
      : r.tipo === 'estructura' ? '<div class="lb-f-caja"><span class="lb-k">Sus ' + String(r.detalle || '').split(' → ').length + ' pasos, en orden</span>' + pasosHtml(r.detalle) + '</div>'
      : r.detalle ? '<div class="lb-f-caja"><span class="lb-k">' + (r.tipo === 'formato' ? 'Cómo se graba' : 'De qué va') + '</span><p>' + esc(r.detalle) + '</p></div>' : '';
    var f = ponerFicha('<div><span class="lb-k">' + UNO[r.tipo] + ' · de un referente</span><h2>' + esc(nombreRef(r)) + '</h2></div>' +
      '<div class="lb-f-est"><span class="lb-autor"><i></i>' + esc(r.autor) + '</span><span>' + (r.probada ? 'La estás probando: cuando se mida, sube a tus piezas o sale del baúl.' : 'Le funcionó a él. Tú aún no la pruebas.') + '</span></div>' +
      '<div class="lb-f-nums"><div><b>' + (r.vistas ? miles(r.vistas) : '—') + '</b><span>vistas en su cuenta</span></div><div><b>1</b><span>video suyo</span></div><div><b>' + esc(fechaCorta(r.guardado)) + '</b><span>la guardaste</span></div></div>' +
      caja +
      '<div class="lb-f-vids"><span class="lb-k">El video de donde salió</span><div class="lb-f-vid">' + (r.portada ? '<img src="' + r.portada + '" alt="">' : '<span class="lb-mini2 vacia" aria-hidden="true">—</span>') +
      '<div><b>' + esc(r.autor) + '</b><small>' + esc(r.video ? corto(r.video) + ' · ' : '') + 'lo desmontaste el ' + esc(fechaCorta(r.guardado)) + '</small></div><span class="lb-num">' + (r.vistas ? miles(r.vistas) : '—') + '</span></div></div>' +
      '<div class="lb-f-caja"><span class="lb-k">Qué pasa cuando la pruebas</span><p>Si la usas en un video tuyo y te funciona, pasa arriba, a tus piezas. Si no te funciona, sale del baúl.</p></div>' +
      '<div class="lb-f-acc"><button type="button" class="lb-b-negro" data-lb-r-probar="' + esc(r.id) + '">Probarla en un video</button>' +
      '<button type="button" class="lb-b-claro" data-lb-r-formula="' + esc(r.id) + '">Usar en una nueva fórmula</button>' +
      '<button type="button" class="lb-b-claro rojo" data-lb-r-quitar="' + esc(r.id) + '">Quitar del baúl</button></div>', nombreRef(r));
    atarFicha(f);
  }
  function atarFicha(f) {
    var api = A();
    f.querySelectorAll('[data-lb-f-formula]').forEach(function (b) {
      b.onclick = function () {
        var x = b.getAttribute('data-lb-f-formula').split(':');
        if (!S.formula) S.formula = sugerencia();
        S.formula[x[0]] = x[1]; S.editando = null; S.nombre = '';
        ir('mesa');
      };
    });
    f.querySelectorAll('[data-lb-r-probar]').forEach(function (b) {
      b.onclick = function () {
        var r = (api.D().referentes || []).filter(function (y) { return y.id === b.getAttribute('data-lb-r-probar'); })[0]; if (!r) return;
        var p = piezaDeRef(r); if (!p) return;
        var pz = {}; pz[r.tipo] = p.id;
        var plan = api.planConPiezas(pz, 'Probando: ' + nombreRef(r) + ' (de ' + r.autor + ')');
        r.plan = plan.id;
        api.guardar(); cerrarFicha();
        api.aviso('Quedó en «Por grabar». Cuando lo publiques y se mida, Cherry te dice si te funcionó.', 5000);
        api.abrirPlan(plan.id);
      };
    });
    f.querySelectorAll('[data-lb-r-formula]').forEach(function (b) {
      b.onclick = function () {
        var r = (api.D().referentes || []).filter(function (y) { return y.id === b.getAttribute('data-lb-r-formula'); })[0]; if (!r) return;
        var p = piezaDeRef(r); if (!p) return;
        api.guardar();
        if (!S.formula) S.formula = sugerencia();
        S.formula[r.tipo] = p.id; S.editando = null; S.nombre = '';
        ir('mesa');
      };
    });
    f.querySelectorAll('[data-lb-r-quitar]').forEach(function (b) {
      b.onclick = function () {
        /* un «¿seguro?» dentro del mismo botón: los diálogos del navegador están prohibidos aquí */
        if (b.getAttribute('data-seguro') !== '1') { b.setAttribute('data-seguro', '1'); b.textContent = '¿Seguro? Toca otra vez'; return; }
        var D = api.D(), id = b.getAttribute('data-lb-r-quitar');
        D.referentes = (D.referentes || []).filter(function (y) { return y.id !== id; });
        api.guardar(); cerrarFicha(); pintar(); api.aviso('Quitada del baúl.');
      };
    });
  }

  /* ── 3 · Nueva fórmula ── */
  function formulasDe() {
    var D = A().D();
    return (D.formulas || []).filter(function (f) { return f.cuenta === D.activa; });
  }
  /* La sugerencia de Cherry: en cada ranura, la pieza que mejor le funciona (la primera del orden del cajón que no
     sea «no atrae»). */
  function sugerencia() {
    var out = {};
    ORDEN.forEach(function (t) {
      var x = datosDe(t).filter(function (y) { return recomendable(t, y); })[0];
      out[t] = x ? x.p.id : null;
    });
    return out;
  }
  /* Una fórmula se juzga como una pieza: con los videos que llevaron sus CUATRO piezas. */
  function usosFormula(f) {
    var api = A(), corte = api.corteAcierto(), n = 0, aciertos = 0, ret = [];
    api.videosDeCuenta().forEach(function (v) {
      var z = v.piezas || {};
      if (!ORDEN.every(function (t) { return f.piezas[t] && z[t] === f.piezas[t]; })) return;
      var r = Number(v.retencion); if (!isFinite(r)) return;
      n++; ret.push(r); if (r >= corte) aciertos++;
    });
    var u = { n: n, aciertos: aciertos, tapados: 0, media: n ? Math.round(ret.reduce(function (a, b) { return a + b; }, 0) / n) : null };
    return { u: u, e: api.estadoDe(u) };
  }
  function nombreSugerido(f) {
    var g = f.gancho && A().piezaPorId('gancho', f.gancho), e = f.estructura && A().piezaPorId('estructura', f.estructura);
    return g && e ? nombre(g) + ' con ' + nombre(e) : g ? nombre(g) : e ? nombre(e) : 'Mi fórmula';
  }
  function receta(f) {
    var n = function (t) { var p = f[t] && A().piezaPorId(t, f[t]); return p ? '<b>' + esc(nombre(p)) + '</b>' : '<b class="falta">— sin escoger —</b>'; };
    /* «contado con la estructura Estructura de 8 pasos» suena a eco: si el nombre ya dice «estructura», no se repite */
    var pe = f.estructura && A().piezaPorId('estructura', f.estructura);
    var est = pe && /^estructura /i.test(nombre(pe)) ? '<b>' + esc(nombre(pe).replace(/^Estructura/, 'estructura')) + '</b>' : 'estructura ' + n('estructura');
    return 'Un video sobre ' + n('idea') + ', que abre con un gancho de ' + n('gancho') + ', contado con la ' + est +
      ' y grabado en formato ' + n('formato') + '.';
  }

  function htmlMesa() {
    var f = S.formula || (S.formula = sugerencia());
    var ranuras = ORDEN.map(function (t) {
      var todas = datosDe(t), items = todas.filter(function (x) { return sirve(x) || x.p.id === f[t]; });
      if (!items.some(sirve)) items = todas.filter(function (x) { return x.e !== 'inerte' || x.p.id === f[t]; });
      var elegida = items.filter(function (x) { return x.p.id === f[t]; })[0];
      var tapa = elegida && elegida.tapas[0];
      return '<div class="lb-ranura' + (elegida ? ' llena' : '') + '">' +
        '<div class="lb-r-cab">' + emblema(t, 'lb-emb-r') + '<span class="lb-k">' + UNO[t] + '</span></div>' +
        '<div class="lb-r-sel">' + (tapa ? '<img src="' + esc(tapa.src) + '" alt="" aria-hidden="true">' : '<span class="lb-r-sin" aria-hidden="true"></span>') +
        '<div><b>' + (elegida ? esc(nombre(elegida.p)) : '— escoge ' + (t === 'idea' || t === 'estructura' ? 'una' : 'uno') + ' —') + '</b>' +
        (elegida ? '<span class="lb-chip" style="--c:' + color(elegida.e) + '">' + esc(unoE(elegida.e)) + '</span>' +
          '<span class="lb-uso">' + esc(usoTxt(elegida.u)) + '</span>' : '') + '</div></div>' +
        '<div class="lb-opc" role="listbox" aria-label="' + TIT[t] + '">' + items.map(function (x) {
          return '<button type="button" role="option" aria-selected="' + (x.p.id === f[t]) + '" data-lb-pon="' + t + ':' + esc(x.p.id) + '">' +
            '<i style="background:' + color(x.e) + '" title="' + esc(unoE(x.e)) + '"></i><span>' + esc(nombre(x.p)) + '</span>' +
            (x.u.media != null ? '<em>' + pct(x.u.media) + '</em>' : '') + '</button>';
        }).join('') + '</div></div>';
    }).join('');

    var completa = ORDEN.every(function (t) { return f[t]; });
    var editando = S.editando && formulasDe().filter(function (x) { return x.id === S.editando; })[0];
    var fs = formulasDe();
    return '<button type="button" class="lb-volver" data-lb-ir="inicio">‹ Tu baúl</button>' +
      '<div class="lb-mesa">' +
      '<div class="lb-ranuras">' + ranuras + '</div>' +
      '<div class="lb-mezcla"><p class="lb-receta">' + receta(f) + '</p>' +
      '<div class="lb-guardar"><label class="lb-nombre"><span class="lb-k">Nombre</span>' +
      '<input class="ent" id="lb-nombre" maxlength="60" value="' + esc(S.nombre || (editando ? editando.nombre : '')) + '" placeholder="' + esc(nombreSugerido(f)) + '"></label>' +
      '<button type="button" class="btn btn-linea" id="lb-guardar"' + (completa ? '' : ' disabled') + '>' + (editando ? 'Guardar cambios' : 'Guardar fórmula') + '</button>' +
      '<button type="button" class="btn btn-rosa" id="lb-grabar"' + (completa ? '' : ' disabled') + '>Grabar con esta fórmula →</button></div></div>' +
      '<div class="lb-tuyas"><span class="lb-k">Tus fórmulas</span>' +
      (fs.length ? '<div class="lb-fcards">' + fs.map(function (x) {
        var j = usosFormula(x);
        return '<div class="lb-fcard' + (x.id === S.editando ? ' on' : '') + '">' +
          '<div class="lb-fc-cab"><b>' + esc(x.nombre) + '</b><span class="lb-chip" style="--c:' + color(j.e) + '">' + esc(unoE(j.e)) + '</span></div>' +
          '<span class="lb-fc-p">' + ORDEN.map(function (t) { var p = x.piezas[t] && A().piezaPorId(t, x.piezas[t]); return esc(p ? nombre(p) : '(ya no está)'); }).join(' · ') + '</span>' +
          '<span class="lb-uso">' + (j.u.n ? j.u.aciertos + ' de ' + j.u.n + ' videos pasaron tu corte' + (j.u.media != null ? ' · media ' + pct(j.u.media) : '') : 'sin grabar todavía') + '</span>' +
          '<div class="lb-fc-acc"><button type="button" class="lb-link" data-lb-usar="' + esc(x.id) + '">Abrir</button>' +
          '<button type="button" class="lb-link" data-lb-grabar-f="' + esc(x.id) + '">Grabar →</button>' +
          '<button type="button" class="lb-link quita" data-lb-quitar-f="' + esc(x.id) + '">Quitar</button></div></div>';
      }).join('') + '</div>'
        : '<p class="vacio">Todavía no guardas ninguna. La que armes arriba queda aquí.</p>') + '</div></div>';
  }

  function grabarCon(piezas, nombre) {
    var api = A();
    var f = api.planConPiezas(piezas, 'Fórmula: ' + nombre);
    api.aviso('Quedó en «Por grabar» con el guion armado desde la estructura.', 4000);
    api.abrirPlan(f.id);
  }

  /* ── Los botones ── */
  function atar(r) {
    var api = A();
    r.querySelectorAll('[data-lb-ir]').forEach(function (b) { b.onclick = function () { ir(b.getAttribute('data-lb-ir')); }; });
    r.querySelectorAll('[data-lb-cajon]').forEach(function (b) { b.onclick = function () { ir('cajon', b.getAttribute('data-lb-cajon')); }; });
    r.querySelectorAll('[data-lb-f]').forEach(function (b) { b.onclick = function () { S.filtro = b.getAttribute('data-lb-f'); pintar(); }; });
    /* (21-oct) la tabla de un cajón */
    r.querySelectorAll('[data-lb-de]').forEach(function (b) { b.onclick = function () { S.de = b.getAttribute('data-lb-de'); pintar(); }; });
    var qi = r.querySelector('#lb-q');
    if (qi) qi.oninput = function () {
      S.q = qi.value; pintar();
      var n = raiz() && raiz().querySelector('#lb-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    };
    var oi = r.querySelector('#lb-orden'); if (oi) oi.onchange = function () { S.orden = oi.value; pintar(); };
    r.querySelectorAll('[data-lb-ver], [data-lb-ref]').forEach(function (fila) {
      var abre = function () {
        if (fila.hasAttribute('data-lb-ref')) { abrirRef(fila.getAttribute('data-lb-ref')); return; }
        var x = fila.getAttribute('data-lb-ver'), i = x.indexOf(':'); abrirFicha(x.slice(0, i), x.slice(i + 1));
      };
      fila.onclick = abre;
      fila.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abre(); } };
    });
    r.querySelectorAll('[data-lb-borra]').forEach(function (b) {
      b.onclick = function () {
        var x = b.getAttribute('data-lb-borra').split(':'), D = api.D();
        /* una pieza usada en un video no se borra: se perdería el historial que la juzga */
        if (api.usosDe(x[0], x[1]).n) { api.aviso('Esa la has usado en un video: no se puede quitar.'); return; }
        if (formulasDe().some(function (f) { return f.piezas[x[0]] === x[1]; })) { api.aviso('Está en una de tus fórmulas: quítala de ahí primero.'); return; }
        D.piezas[x[0]] = D.piezas[x[0]].filter(function (p) { return p.id !== x[1]; });
        api.guardar(); api.pintar(); api.aviso('Quitada del baúl.');
      };
    });
    r.querySelectorAll('[data-lb-borra-f]').forEach(function (b) {
      b.onclick = function () {
        var D = api.D();
        D.fichas = D.fichas.filter(function (f) { return f.id !== b.getAttribute('data-lb-borra-f'); });
        api.guardar(); api.pintar(); api.aviso('Ficha quitada del baúl.');
      };
    });
    r.querySelectorAll('[data-lb-pon]').forEach(function (b) {
      b.onclick = function () {
        var x = b.getAttribute('data-lb-pon').split(':');
        leerNombre(); S.formula[x[0]] = x[1]; pintar();
      };
    });
    var g = r.querySelector('#lb-guardar');
    if (g) g.onclick = function () {
      var D = api.D(); leerNombre();
      var nombre = (S.nombre || '').trim() || nombreSugerido(S.formula);
      if (!D.formulas) D.formulas = [];
      var ya = S.editando && D.formulas.filter(function (f) { return f.id === S.editando; })[0];
      if (ya) { ya.nombre = nombre; ya.piezas = copia(S.formula); }
      else {
        ya = { id: api.nid(), cuenta: D.activa, nombre: nombre, piezas: copia(S.formula), creado: new Date().toISOString().slice(0, 10) };
        D.formulas.unshift(ya); S.editando = ya.id;
      }
      S.nombre = nombre;
      api.guardar(); pintar(); api.aviso('Fórmula guardada: «' + nombre + '».');
    };
    var gr = r.querySelector('#lb-grabar');
    if (gr) gr.onclick = function () { leerNombre(); grabarCon(copia(S.formula), (S.nombre || '').trim() || nombreSugerido(S.formula)); };
    r.querySelectorAll('[data-lb-usar]').forEach(function (b) {
      b.onclick = function () {
        var f = formulasDe().filter(function (x) { return x.id === b.getAttribute('data-lb-usar'); })[0];
        if (!f) return;
        S.formula = copia(f.piezas); S.editando = f.id; S.nombre = f.nombre; pintar();
      };
    });
    r.querySelectorAll('[data-lb-grabar-f]').forEach(function (b) {
      b.onclick = function () {
        var f = formulasDe().filter(function (x) { return x.id === b.getAttribute('data-lb-grabar-f'); })[0];
        if (f) grabarCon(copia(f.piezas), f.nombre);
      };
    });
    r.querySelectorAll('[data-lb-quitar-f]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-lb-quitar-f');
        /* un «¿seguro?» dentro del mismo botón: los diálogos del navegador están prohibidos aquí */
        if (b.getAttribute('data-seguro') !== '1') { b.setAttribute('data-seguro', '1'); b.textContent = '¿Seguro? Toca otra vez'; return; }
        var D = api.D();
        D.formulas = (D.formulas || []).filter(function (f) { return f.id !== id; });
        if (S.editando === id) { S.editando = null; S.nombre = ''; }
        api.guardar(); pintar(); api.aviso('Fórmula quitada.');
      };
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarFicha(); });
  function leerNombre() { var i = document.getElementById('lb-nombre'); if (i) S.nombre = i.value; }
  function copia(f) { return { idea: f.idea || null, gancho: f.gancho || null, estructura: f.estructura || null, formato: f.formato || null }; }

  window.LabBaul = { pintar: pintar, entrar: entrar, sucio: function () { return sucio; } };
})();

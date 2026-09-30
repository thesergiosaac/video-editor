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
 */
(function () {
  'use strict';
  var A = function () { return window.LabAPI; };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var RUTA = '../assets/marca/baul/';
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
  var S = { vista: 'inicio', tipo: null, filtro: '', formula: null, nombre: '', editando: null };
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
    S.vista = vista; S.tipo = tipo || null; S.filtro = '';
    if (vista === 'mesa' && !S.formula) S.formula = sugerencia();
    pintar();
    var r = raiz(); if (r && r.scrollIntoView) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function entrar() { S.vista = 'inicio'; S.tipo = null; S.filtro = ''; sucio = true; pintar(); }

  function migas(aqui) {
    return '<nav class="lb-migas" aria-label="Dónde estás"><button type="button" data-lb-ir="inicio">El baúl</button>' +
      '<span aria-hidden="true">›</span><span>' + esc(aqui) + '</span></nav>';
  }

  /* ── 1 · El baúl: cuatro cajones y la fórmula ── */
  function htmlInicio() {
    var api = A();
    var marca = (api.marcaActiva && api.marcaActiva()) || '';
    var todos = {}, total = 0, usadas = {};
    ORDEN.forEach(function (t) { todos[t] = datosDe(t); total += todos[t].length; });
    if (!total) return api.htmlBaulVacio ? api.htmlBaulVacio() : '';

    var cajones = ORDEN.map(function (t) {
      var items = todos[t], c = cuentas(items), n = items.length;
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
          return '<span><i style="background:' + color(e) + '"></i>' + c[e] + ' ' + esc(nombreEstado(e, c[e])) + '</span>';
        }).join('') + '</div>' +
        '<p class="lb-mejor">' + (funciona
          ? 'La que mejor te funciona <b>' + esc(nombre(mejor.p)) + '</b>' + (mejor.u.media != null ? '<span>media ' + pct(mejor.u.media) + '</span>' : '')
          : n ? 'Ninguna ha pasado tu corte todavía.' : 'Vacío todavía.') + '</p>' +
        '<span class="lb-flecha" aria-hidden="true">→</span></button>';
    }).join('');

    var fs = formulasDe();
    var sug = sugerencia();
    return '<header class="lb-cab"><div><span class="etiqueta">El baúl' + (marca ? ' · ' + esc(marca) : '') + '</span>' +
      '<h3>Tu baúl</h3></div><p class="lb-res">' + ORDEN.map(function (t) { return todos[t].length + ' ' + TIT[t].toLowerCase(); }).join(' · ') + '</p></header>' +
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
      '<span class="lb-f-ir">Armar una fórmula →</span></button>' +
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

  /* ── 2 · Un cajón abierto ── */
  function htmlCajon(t) {
    var items = datosDe(t), c = cuentas(items);
    var ver = items.filter(function (x) { return !S.filtro || x.e === S.filtro; });
    var filtros = '<div class="lb-filtros" role="group" aria-label="Filtrar por estado">' +
      '<button type="button" class="pastilla" data-lb-f="" aria-pressed="' + (!S.filtro) + '">Todas · ' + items.length + '</button>' +
      EST.filter(function (e) { return c[e]; }).map(function (e) {
        return '<button type="button" class="pastilla" data-lb-f="' + e + '" aria-pressed="' + (S.filtro === e) + '"><i class="lb-pt" style="background:' + color(e) + '"></i>' +
          esc(A().MAG[e].t) + ' · ' + c[e] + '</button>';
      }).join('') + '</div>';

    var tarjetas;
    if (t === 'idea' && !S.filtro) {
      /* Las ideas, por TEMA (el del historial): así se ve de un vistazo de qué hablas más y qué te funciona. */
      var temas = {}, orden = [];
      ver.forEach(function (x) {
        var k = x.p.tema || 'sin tema';
        if (!temas[k]) { temas[k] = []; orden.push(k); }
        temas[k].push(x);
      });
      orden.sort(function (a, b) { return a === 'sin tema' ? 1 : b === 'sin tema' ? -1 : 0; });
      tarjetas = orden.map(function (k) {
        return '<section class="lb-tema"><h5>' + esc(k) + ' <span>' + temas[k].length + '</span></h5><div class="lb-piezas">' +
          temas[k].map(function (x) { return htmlPieza(t, x); }).join('') + '</div></section>';
      }).join('');
    } else {
      tarjetas = ver.length ? '<div class="lb-piezas">' + ver.map(function (x) { return htmlPieza(t, x); }).join('') + '</div>'
        : '<p class="vacio">Ninguna aquí.</p>';
    }

    return migas(TIT[t]) +
      '<header class="lb-dentro">' + emblema(t, 'lb-emb-g') + '<div><h3>' + TIT[t] + '</h3>' +
      '<p>' + items.length + ' · ' + esc(DE_QUE[t]) + '</p></div>' +
      '<button type="button" class="btn btn-linea lb-a-mesa" data-lb-ir="mesa">Nueva fórmula</button></header>' +
      filtros + tarjetas;
  }

  function htmlPieza(t, x) {
    var p = x.p;
    var extra = '';
    if (t === 'gancho' && p.frase) extra = '<span class="lb-frase">«' + esc(p.frase) + '»</span>';
    if (t === 'estructura' && p.seq) {
      var pasos = String(p.seq).split(' → ');
      extra = '<span class="lb-seq">' + pasos.length + ' pasos · ' + esc(pasos.slice(0, 4).join(' → ')) + (pasos.length > 4 ? ' …' : '') + '</span>';
    }
    var tapas = x.tapas.slice(0, 3);
    return '<div class="lb-pieza">' +
      '<div class="lb-mini' + (tapas.length ? '' : ' vacia') + '" aria-hidden="true">' +
      (tapas.length ? tapas.map(function (y) { return '<img src="' + esc(y.src) + '" alt="" loading="lazy">'; }).join('')
        : '<span>sin estrenar</span>') + '</div>' +
      '<div class="lb-pz-tx"><span class="lb-chip" style="--c:' + color(x.e) + '">' + esc(A().MAG[x.e].uno) + '</span>' +
      '<b>' + esc(nombre(p)) + '</b>' + extra +
      '<span class="lb-uso">' + esc(usoTxt(x.u)) + (x.reels.length > x.u.n ? ' · en ' + x.reels.length + ' reel' + (x.reels.length === 1 ? '' : 's') : '') +
      (p.sinBautizar ? ' · sin bautizar' : '') + '</span></div>' +
      '<button type="button" class="lb-x" data-lb-borra="' + t + ':' + esc(p.id) + '" aria-label="Quitar del baúl" title="Quitar del baúl">✕</button></div>';
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
      var items = datosDe(t).filter(function (x) { return x.e !== 'inerte' || x.p.id === f[t]; });
      var elegida = items.filter(function (x) { return x.p.id === f[t]; })[0];
      var tapa = elegida && elegida.tapas[0];
      return '<div class="lb-ranura' + (elegida ? ' llena' : '') + '">' +
        '<div class="lb-r-cab">' + emblema(t, 'lb-emb-r') + '<span class="lb-k">' + UNO[t] + '</span></div>' +
        '<div class="lb-r-sel">' + (tapa ? '<img src="' + esc(tapa.src) + '" alt="" aria-hidden="true">' : '<span class="lb-r-sin" aria-hidden="true"></span>') +
        '<div><b>' + (elegida ? esc(nombre(elegida.p)) : '— escoge ' + (t === 'idea' || t === 'estructura' ? 'una' : 'uno') + ' —') + '</b>' +
        (elegida ? '<span class="lb-chip" style="--c:' + color(elegida.e) + '">' + esc(A().MAG[elegida.e].uno) + '</span>' +
          '<span class="lb-uso">' + esc(usoTxt(elegida.u)) + '</span>' : '') + '</div></div>' +
        '<div class="lb-opc" role="listbox" aria-label="' + TIT[t] + '">' + items.map(function (x) {
          return '<button type="button" role="option" aria-selected="' + (x.p.id === f[t]) + '" data-lb-pon="' + t + ':' + esc(x.p.id) + '">' +
            '<i style="background:' + color(x.e) + '" title="' + esc(A().MAG[x.e].uno) + '"></i><span>' + esc(nombre(x.p)) + '</span>' +
            (x.u.media != null ? '<em>' + pct(x.u.media) + '</em>' : '') + '</button>';
        }).join('') + '</div></div>';
    }).join('');

    var completa = ORDEN.every(function (t) { return f[t]; });
    var editando = S.editando && formulasDe().filter(function (x) { return x.id === S.editando; })[0];
    var fs = formulasDe();
    return migas('Nueva fórmula') +
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
          '<div class="lb-fc-cab"><b>' + esc(x.nombre) + '</b><span class="lb-chip" style="--c:' + color(j.e) + '">' + esc(A().MAG[j.e].uno) + '</span></div>' +
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
  function leerNombre() { var i = document.getElementById('lb-nombre'); if (i) S.nombre = i.value; }
  function copia(f) { return { idea: f.idea || null, gancho: f.gancho || null, estructura: f.estructura || null, formato: f.formato || null }; }

  window.LabBaul = { pintar: pintar, entrar: entrar, sucio: function () { return sucio; } };
})();

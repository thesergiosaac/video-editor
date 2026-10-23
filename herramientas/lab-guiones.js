/* lab-guiones.js — «Guiones», una vista del Laboratorio (6-oct-2026).
 *
 * Sergio: la pantalla de Guiones «no se entiende» frente a la del Laboratorio, donde él sí hace sus guiones; que se
 * conecten, que se pueda partir de una idea que ya funcionó, que esté el guion premium y que se vea el storyboard ahí
 * mismo, todo sin bajar. Aprobó la propuesta entera («sigo todas tus recomendaciones… hazlo y publícalo»).
 *
 * Por eso Guiones NO tiene datos ni motor propios: es laboratorio.html?modo=guiones y esta vista (#vg) pinta los
 * mismos planes del Laboratorio («Por grabar / Grabados / Publicados»), con sus piezas y su estado magnético calculados
 * por el Laboratorio, y para escribir, revisar y dibujar llama a SUS funciones (window.LabAPI). Lo que se hace aquí está
 * en Laboratorio › Mis videos, y al revés. Todo bajo `.lg` (lab-guiones.css): el Laboratorio ya usa nombres cortos.
 *
 * La primera vez trae a «Por grabar» los guiones que la persona tenía en la pantalla vieja (documento guiones@marca),
 * sin los de ejemplo y sin repetir los que ya estaban con el mismo título. El teleprompter vino de esa pantalla.
 */
(function () {
  'use strict';
  var L = function () { return window.LabAPI; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  /* El ritmo con que se habla en los reels que retienen (docs/GUIONES-CALCO.md: ~3,4 palabras por segundo). */
  var PAL_SEG = 3.4;
  var TABS = [['porGrabar', 'Por grabar'], ['grabado', 'Grabados'], ['publicado', 'Publicados']];
  var CL = { magnetica: 'mag', media: 'tem', neutra: 'neu', inerte: 'ine' };
  var SIM = { magnetica: '★', media: '●', neutra: '○', inerte: '✕' };
  var est = { tab: 'porGrabar', sel: null, wiz: null, frases: null };
  var importado = false, tGuardar = 0, pendiente = false;

  function visible() { var v = $('vg'); return !!(v && v.classList.contains('on')); }
  function D() { return (L() && L().D()) || { planes: [], piezas: {}, formulas: [] }; }
  function planes() { var d = D(); return (d.planes || []).filter(function (f) { return f.cuenta === d.activa; }); }
  function tabDe(f) { return L().estadoVideoPlan(f); }
  function planSel() {
    var ps = planes().filter(function (f) { return tabDe(f) === est.tab; });
    return ps.filter(function (f) { return f.id === est.sel; })[0] || ps[0] || null;
  }
  function pieza(tipo, id) { return id ? L().piezaPorId(tipo, id) : null; }
  function estado(tipo, id) { try { return L().estadoPieza(tipo, id); } catch (e) { return { e: 'neutra', u: { n: 0, aciertos: 0 } }; } }
  function palabras(t) { return (String(t || '').trim().match(/\S+/g) || []).length; }
  function segundos(f) { return Math.round((f.guion || []).reduce(function (a, x) { return a + palabras(x.dice); }, 0) / PAL_SEG); }
  function reloj(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function miles(n) { n = Number(n) || 0; return n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace('.', ',') + ' M' : n >= 1000 ? Math.round(n / 1000) + ' mil' : String(n); }
  function nombreEstado(e) { var M = L().MAG[e]; return M ? M.uno.charAt(0).toUpperCase() + M.uno.slice(1) : ''; }
  function lineaEstado(tipo, id) {
    var s = estado(tipo, id), u = s.u || {};
    if (s.e === 'neutra') return '<span class="lg-e neu">○ Nunca probada</span>';
    return '<span class="lg-e ' + CL[s.e] + '">' + SIM[s.e] + ' ' + esc(nombreEstado(s.e)) + ' · ' + (u.aciertos || 0) + ' de ' + (u.n || 0) + '</span>';
  }
  /* las mejores vistas de los videos que usaron esa pieza: lo que se le enseña a la persona para escoger */
  function mejorVistas(tipo, id) {
    var m = 0;
    try { L().videosDeCuenta().forEach(function (v) { if (v.piezas && v.piezas[tipo] === id) m = Math.max(m, Number(v.visitas) || 0); }); } catch (e) {}
    return m;
  }
  function guardarLuego() { pendiente = true; clearTimeout(tGuardar); tGuardar = setTimeout(guardarYa, 700); }
  function guardarYa() { clearTimeout(tGuardar); if (pendiente) { pendiente = false; L().guardar(); } }

  /* ── Pintar ───────────────────────────────────────────────────────────────── */
  /* (8-oct) ?modo=guiones&guion=<id> abre ese guion en su pestaña: así llega el «Abrir en Guiones» de Storyboard */
  var irA = (/[?&]guion=([^&#]+)/.exec(location.search) || [])[1];
  function pintar() {
    var c = $('lg'); if (!c || !L()) return;
    var ps = planes(), n = { porGrabar: 0, grabado: 0, publicado: 0 };
    if (irA) { var va = ps.filter(function (f) { return f.id === decodeURIComponent(irA); })[0]; if (va) { est.tab = tabDe(va); est.sel = va.id; irA = null; if (celular()) abrirCel(va.id, true); } }
    ps.forEach(function (f) { n[tabDe(f)]++; });
    if (celular()) { pintarCel(ps, n); return; }
    c.classList.remove('lg-cel');
    var h0 = c.querySelector('#lg2-hoja'), l0 = c.querySelector('.lg2-lst'), quien = est.sel + '|' + vistaPc();
    var antes = { h: h0 ? h0.scrollTop : 0, l: l0 ? l0.scrollTop : 0, ok: c.dataset.pcClave === quien };
    var f = planSel(); est.sel = f ? f.id : null;
    if (f) L().elegirPlan(f.id);
    c.innerHTML =
      '<section class="lg-cab vol">' +
        '<img class="lg-astro" src="../assets/inicio/v2/guiones-chica.webp" alt="" aria-hidden="true">' +
        '<div class="lg-cab-t"><h1>Guiones</h1><p>Escribe tu video escena por escena, míralo dibujado y llévalo a grabar. ' +
          '<b>Son los mismos del Laboratorio.</b></p></div>' +
        '<div class="lg-cuenta">' + TABS.map(function (t) {
          return '<span class="lg-num"><b>' + n[t[0]] + '</b><span>' + t[1] + '</span></span>'; }).join('') + '</div>' +
        '<div class="lg-cab-acc"><button type="button" class="btn btn-linea" id="lg-nuevo">＋ Nuevo guion</button>' +
          '<button type="button" class="lg-pre" id="lg-premium">✦ Que Cherry lo escriba <span>Premium</span></button></div>' +
      '</section>' +
      '<div class="lg-cuerpo">' + pintarLista(ps, n, f) + pintarPlan(f) + pintarStory(f) + '</div>';
    c.dataset.pcClave = (f ? f.id : '') + '|' + vistaPc();
    atar(f);
    /* después de atar: ahí crecen los textos, y antes la hoja era más corta y el desplazamiento se recortaba */
    if (antes.ok) { var h1 = c.querySelector('#lg2-hoja'), l1 = c.querySelector('.lg2-lst'); if (h1) h1.scrollTop = antes.h; if (l1) l1.scrollTop = antes.l; }
    if (est.wiz) pintarWiz();
  }

  function chips(f) {
    var pz = f.piezas || {};
    return '<span class="lg-chips">' + ['idea', 'gancho', 'estructura', 'formato'].map(function (t) {
      if (!pz[t]) return '<span class="lg-chip falta">' + t + '</span>';
      var s = estado(t, pz[t]);
      return '<span class="lg-chip ' + CL[s.e] + '">' + (s.e === 'magnetica' ? '★ ' : '') + t + '</span>';
    }).join('') + '</span>';
  }
  function pintarLista(ps, n, f) {
    var lista = ps.filter(function (x) { return tabDe(x) === est.tab; });
    var marca = '';
    try { marca = L().marcaActiva(); } catch (e) {}
    return '<section class="lg-lista vol" aria-label="Tus guiones">' +
      '<div class="lg-l-cab"><h2>Tus guiones</h2>' + (marca ? '<span class="lg-etq">' + esc(marca) + '</span>' : '') + '</div>' +
      '<div class="lg-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (est.tab === t[0]) + '">' + t[1] + ' <b>' + n[t[0]] + '</b></button>';
      }).join('') + '</div>' +
      '<div class="lg-items">' + (lista.length ? lista.map(function (x) {
        var g = x.guion || [], s = segundos(x), escritas = g.filter(function (y) { return (y.dice || '').trim(); }).length;
        var vin = g.filter(function (y) { return y.vineta; }).slice(0, 3).map(function (y) {
          var u = L().urlVineta(y.vineta); return u ? '<img src="' + esc(u) + '" alt="">' : ''; }).join('');
        return '<button type="button" class="lg-item' + (f && x.id === f.id ? ' on' : '') + '" data-plan="' + esc(x.id) + '">' +
          '<b>' + esc(x.titulo || 'Guion sin título') + '</b>' + chips(x) +
          '<span class="lg-item-pie"><small>' + (escritas ? reloj(s) + ' · ' + g.length + ' escenas' : 'sin escribir todavía') + '</small>' +
          (vin ? '<span class="lg-mini">' + vin + '</span>' : '') + '</span></button>';
      }).join('') : '<p class="lg-vacio">' + (est.tab === 'porGrabar' ? 'No tienes guiones por grabar. Empieza uno con «Nuevo guion».'
          : est.tab === 'grabado' ? 'Aquí llegan los guiones que ya grabaste.' : 'Aquí llegan los guiones que ya publicaste.') + '</p>') +
      '</div></section>';
  }

  function pintarPlan(f) {
    if (!f) {
      return '<section class="lg-plan lg-plan-vacio vol"><img src="../assets/inicio/v2/guiones.webp" alt="" aria-hidden="true">' +
        '<div><h2>Tu próximo video empieza aquí</h2><p>Parte de una idea que ya te funcionó, deja que Cherry lo escriba o escríbelo tú, escena por escena.</p>' +
        '<button type="button" class="btn btn-claro" data-accion="nuevo">＋ Nuevo guion</button></div></section>';
    }
    /* (23-oct) Sergio: «la parte de arriba que dice Guiones es perfecta, pero la parte donde se ve el guion está un poco
       confusa». Se veían tres escenas a la vez, cada texto cortado a dos renglones, cuatro botones parecidos y «Temporal · 1 de
       2». Propuesta «El guion, más claro» (https://claude.ai/artifact/P9H64gx7au8QNf9PVbdsLC): escogió LAS DOS formas, y cada
       quien cambia la vista: «La hoja» (el guion seguido, como una hoja) y «Escena por escena» (la lista y la escena en grande).
       La que escoja se recuerda en ese navegador (localStorage › cherry-guion-vista-pc). */
    var g = f.guion || [], t = tabDe(f), vista = vistaPc();
    if (est.planPc !== f.id) { est.planPc = f.id; est.esc = 0; est.grabar = false; }
    est.esc = Math.min(Math.max(0, est.esc || 0), Math.max(0, g.length - 1));
    return '<section class="lg-plan lg2 vol" aria-label="El guion abierto">' +
      '<div class="lg2-cab">' +
        '<input class="lg-tit" id="lg-tit" value="' + esc(f.titulo || '') + '" placeholder="Ponle un título a este video" aria-label="Título del video">' +
        '<span class="lg-est ' + t + '"><i></i>' + { porGrabar: 'Por grabar', grabado: 'Grabado', publicado: 'Publicado' }[t] + '</span>' +
        '<span class="lg2-vistas" role="group" aria-label="Cómo ver el guion">' +
          '<button type="button" data-vista="hoja" aria-pressed="' + (vista === 'hoja') + '">La hoja</button>' +
          '<button type="button" data-vista="escena" aria-pressed="' + (vista === 'escena') + '">Escena por escena</button></span>' +
        '<button type="button" class="lg2-cherry" data-accion="escribir">✦ Que Cherry lo escriba</button>' +
        '<span class="lg2-gr"><button type="button" class="lg2-grabar" data-grabar aria-haspopup="true" aria-expanded="' + !!est.grabar + '">Grabar<i aria-hidden="true"></i></button>' +
          (est.grabar ? menuGrabar(f, t) : '') + '</span>' +
      '</div>' +
      '<div class="lg2-receta"><span class="lg-mano">la receta</span>' + L().PIEZAS.map(function (P) {
        var id = (f.piezas || {})[P.id], p = pieza(P.id, id), e = p ? estadoLlano(P.id, id) : null;
        /* dentro de `.sel`: es donde el Laboratorio cuelga su desplegable y lo que no lo cierra al tocar */
        return '<div class="sel lg-sel lg2-sel"><button type="button" class="lg2-pz' + (p ? '' : ' falta') + '" data-pieza="' + P.id + '" title="Escoger ' + esc(P.uno) + ' de tu baúl">' +
          '<small>' + esc(P.uno) + '</small><b>' + (p ? esc(p.texto) : 'Escoger…') + '</b>' + (e ? '<em class="' + e.cl + '">· ' + e.txt + '</em>' : '') + '</button></div>';
      }).join('') +
        '<span class="lg2-der"><button type="button" class="lg2-frases" data-accion="frases">Mis frases</button></span>' +
      '</div>' +
      '<div class="lg2-regla" id="lg2-regla">' + reglaHtml(f) + '</div>' +
      (!g.length ? '<p class="lg-vacio">Escoge una estructura arriba: de ahí salen las escenas.</p>' : vista === 'hoja' ? hojaHtml(f) : escenaHtml(f)) +
    '</section>';
  }

  /* los nombres de oficio de las partes, con palabras de todos los días (propuesta del 20-oct); el de oficio va chiquito debajo */
  var LLANO = {
    'gancho': ['La primera frase', 'Lo primero que dices, para que no pasen de largo.'], 'el gancho': ['La primera frase', 'Lo primero que dices, para que no pasen de largo.'],
    'descarte': ['Lo que no funciona', 'Lo que la gente ya intenta y no le sirve.'],
    'open loop': ['Lo dejas en suspenso', 'Anuncia algo importante sin decirlo todavía.'], 'aplazamiento': ['Lo dejas en suspenso', 'Anuncia algo importante sin decirlo todavía.'],
    'credencial': ['Por qué creerte', 'Una prueba con número: tuya o de un cliente.'],
    'concepto': ['Tu idea con nombre', 'Ponle un nombre corto a tu idea y di qué es.'], 'concepto con nombre': ['Tu idea con nombre', 'Ponle un nombre corto a tu idea y di qué es.'],
    'cuerpo': ['Lo que explicas', 'Explícalo con un ejemplo que se vea.'], 'explicacion': ['Lo que explicas', 'Explícalo con un ejemplo que se vea.'],
    'el desarrollo': ['Lo que explicas', 'Explícalo con un ejemplo que se vea.'], 'desarrollo': ['Lo que explicas', 'Explícalo con un ejemplo que se vea.'],
    'objecion': ['La duda en voz alta', 'Alguien dice lo que está pensando quien mira.'],
    'pregunta puente': ['Lo que falta saber', 'Deja una pregunta que se responde al final.'],
    'cta': ['Qué tienen que hacer', 'Pide comentar una palabra y di qué reciben.'], 'llamado a la accion': ['Qué tienen que hacer', 'Pide comentar una palabra y di qué reciben.'],
    'remate': ['El chiste final', 'Una frase o un chiste después del pedido.'],
    'creencia': ['Lo que todos creen', 'Lo que la gente cree y el video va a tumbar.'], 'ejemplo aplicado': ['El ejemplo', 'Un caso que se vea.'],
  };
  function llano(nombre) {
    var n = String(nombre || 'Escena').trim(), k = llave(n), m = LLANO[k];
    return m ? { nombre: m[0], oficio: n, que: m[1] } : { nombre: n, oficio: '', que: 'Lo que dices en esta escena.' };
  }
  /* «Temporal · 1 de 2» decía el estado de la pieza con palabras del Laboratorio: aquí, con las de todos los días */
  function estadoLlano(tipo, id) {
    var s = estado(tipo, id), u = s.u || {}, a = u.aciertos || 0, n = u.n || 0, veces = n === 1 ? ' vez' : ' veces';
    if (s.e === 'neutra' || !n) return { cl: 'neu', txt: 'sin probar' };
    if (s.e === 'magnetica') return { cl: 'mag', txt: '★ te funciona: ' + a + ' de ' + n + veces };
    if (s.e === 'inerte') return { cl: 'ine', txt: 'no te funcionó: ' + a + ' de ' + n + veces };
    return { cl: 'tem', txt: 'te fue bien ' + a + ' de ' + n + veces };
  }
  function vistaPc() { try { return localStorage.getItem('cherry-guion-vista-pc') === 'escena' ? 'escena' : 'hoja'; } catch (e) { return 'hoja'; } }
  /* los segundos de cada escena, por lo que se dice (3,4 palabras por segundo): lo mismo que la duración total */
  function tiempos(f) { var t0 = 0; return (f.guion || []).map(function (x) { var d = palabras(x.dice) / PAL_SEG, r = [t0, t0 + d]; t0 += d; return r; }); }
  function tramoTxt(r) { return r && r[1] - r[0] >= 0.5 ? Math.round(r[0]) + '–' + Math.round(r[1]) + ' s' : ''; }
  function menuGrabar(f, t) {
    return '<div class="lg2-menu" role="menu">' +
      '<button type="button" role="menuitem" data-accion="tp"><b>▶ Leerlo mientras grabo</b><small>El teleprompter: el texto sube solo, a tu ritmo.</small></button>' +
      '<button type="button" role="menuitem" data-accion="editor"><b>↑ ' + (f.proyecto ? 'Abrirlo en el Editor Pro' : 'Grabar con el Editor Pro') + '</b><small>' +
        (f.proyecto ? 'El proyecto que ya hiciste con este guion.' : 'Subes tus clips y Cherry lo edita con este guion.') + '</small></button>' +
      (t === 'porGrabar' ? '<button type="button" role="menuitem" data-accion="grabado"><b>✓ Ya lo grabé</b><small>Pasa a «Grabados».</small></button>' : '') +
    '</div>';
  }
  /* la regla de tiempo: cada escena es un tramo; la raya fucsia es la meta */
  function reglaHtml(f) {
    var g = f.guion || [], dur = Number(f.dur) || 0, tt = tiempos(f), total = tt.length ? tt[tt.length - 1][1] : 0, vista = vistaPc();
    if (total < 0.5) return '<b>0:00<small>' + g.length + (g.length === 1 ? ' escena' : ' escenas') + '</small></b><span class="lg2-tramos vacio">Escribe lo que dices y aquí ves cuánto dura cada escena.</span><em></em>';
    var tramos = g.map(function (x, i) {
      var w = tt[i][1] - tt[i][0]; if (w <= 0) return '';
      var cl = vista === 'escena' && i === est.esc ? 'on' : dur && tt[i][0] >= dur ? 'pasa' : '';
      return '<button type="button" data-ir="' + i + '" class="' + cl + '" style="flex:' + w.toFixed(1) + '" title="' + esc(llano(x.escena).nombre) + ' · ' + Math.round(w) + ' s">' + (i + 1) + '</button>';
    }).join('');
    var raya = dur && total > dur ? '<u style="left:' + (dur / total * 100).toFixed(1) + '%"><span>tu meta ' + reloj(dur) + '</span></u>' : '';
    var ver = !dur ? '<em class="ok">' + reloj(total) + '<small>sin meta de tiempo</small></em>'
      : total <= dur ? '<em class="ok">cabe en ' + reloj(dur) + ' ✓<small>tu meta</small></em>'
      : '<em class="mal">te pasas por ' + Math.round(total - dur) + ' s<small>tu meta: ' + reloj(dur) + '</small></em>';
    return '<b>' + reloj(total) + '<small>' + g.length + (g.length === 1 ? ' escena' : ' escenas') + '</small></b><div class="lg2-tramos">' + tramos + raya + '</div>' + ver;
  }
  function dibujo(x, i, grande) {
    var u = x.vineta ? L().urlVineta(x.vineta) : '';
    return '<button type="button" class="lg2-v' + (grande ? ' grande' : '') + (u ? '' : ' falta') + '" data-escena="' + i + '" title="Mejorarla, escribirla con Cherry o dibujarla">' +
      (u ? '<img src="' + esc(u) + '" alt="Dibujo de la escena ' + (i + 1) + '">' : '<span>✦<br>dibujarla</span>') + '</button>';
  }
  function phVe(x) { return x.veCherry ? 'Cherry lo imaginó: ' + x.veCherry : 'En blanco, Cherry lo imagina'; }
  /* «La hoja»: todo el guion seguido; el texto entero y se escribe ahí mismo */
  function hojaHtml(f) {
    var tt = tiempos(f);
    return '<div class="lg2-hoja" id="lg2-hoja"><div class="lg2-papel">' + (f.guion || []).map(function (x, i) {
      var n = llano(x.escena), tr = tramoTxt(tt[i]);
      return '<div class="lg2-bl" id="lg2-bl-' + i + '">' +
        '<div class="lg2-nom"><span class="num">' + (i + 1) + '</span><b>' + esc(n.nombre) + '</b>' + (n.oficio ? '<small>' + esc(n.oficio) + '</small>' : '') + (tr ? '<time>' + tr + '</time>' : '') + '</div>' +
        '<div class="lg2-tx"><textarea class="lg2-dice" data-campo="dice" data-i="' + i + '" rows="1" placeholder="' + esc(n.que) + '" aria-label="Lo que dices en la escena ' + (i + 1) + '">' + esc(x.dice || '') + '</textarea>' +
          '<label class="lg2-ve"><small>Se ve</small><textarea data-campo="ve" data-i="' + i + '" rows="1" placeholder="' + esc(phVe(x)) + '">' + esc(x.ve || '') + '</textarea></label></div>' +
        dibujo(x, i) +
        '<button type="button" class="lg2-mejora" data-escena="' + i + '">✦ Mejorarla</button>' +
      '</div>';
    }).join('') + '</div></div>';
  }
  /* «Escena por escena»: la lista a la izquierda y la escena en grande, con su dibujo */
  function escenaHtml(f) {
    var g = f.guion || [], i = est.esc, x = g[i], n = llano(x.escena), pv = x.planoVineta || null, tr = tramoTxt(tiempos(f)[i]);
    return '<div class="lg2-dos"><div class="lg2-lst">' + g.map(function (y, k) {
        var u = y.vineta ? L().urlVineta(y.vineta) : '';
        return '<button type="button" class="lg2-it' + (k === i ? ' on' : '') + '" data-sel="' + k + '"><span class="num">' + (k + 1) + '</span>' +
          '<span class="tx"><b>' + esc(llano(y.escena).nombre) + '</b><em>' + esc((y.dice || '').trim() || 'sin escribir todavía') + '</em></span>' +
          (u ? '<img src="' + esc(u) + '" alt="">' : '<i></i>') + '</button>';
      }).join('') + '</div>' +
      '<div class="lg2-det"><div>' + dibujo(x, i, true) +
          (pv && pv.nombre ? '<p class="lg2-plano"><b>' + esc(pv.nombre) + '</b>' + (pv.porque ? esc(pv.porque.charAt(0).toUpperCase() + pv.porque.slice(1)) + '.' : '') + '</p>' : '') + '</div>' +
        '<div class="lg2-det-tx"><span class="lg-etq">Escena ' + (i + 1) + ' de ' + g.length + (tr ? ' · ' + tr : '') + '</span>' +
          '<h3>' + esc(n.nombre) + (n.oficio ? '<small>' + esc(n.oficio) + '</small>' : '') + '</h3>' +
          '<label class="lg2-campo"><span class="lg-etq">Lo que dices</span><textarea data-campo="dice" data-i="' + i + '" rows="3" placeholder="' + esc(n.que) + '">' + esc(x.dice || '') + '</textarea></label>' +
          '<label class="lg2-campo"><span class="lg-etq">Lo que se ve</span><textarea class="chico" data-campo="ve" data-i="' + i + '" rows="2" placeholder="' + esc(phVe(x)) + '">' + esc(x.ve || '') + '</textarea></label>' +
          '<div class="lg2-acc"><button type="button" data-sel="' + (i - 1) + '"' + (i ? '' : ' disabled') + '>‹ Anterior</button>' +
            '<button type="button" class="fu" data-escena="' + i + '">✦ Mejorarla con Cherry</button>' +
            '<button type="button" class="ne" data-sel="' + (i + 1) + '"' + (i < g.length - 1 ? '' : ' disabled') + '>Siguiente ›</button></div>' +
        '</div></div></div>';
  }

  function pintarStory(f) {
    if (!f) return '<section class="lg-story vol"><h2>Storyboard</h2><p class="lg-vacio">Cuando tengas un guion, aquí lo ves dibujado.</p>' +
      '<img class="lg-sb-arte" src="../assets/inicio/v2/storyboard-chica.webp" alt="" aria-hidden="true"></section>';
    var g = f.guion || [];
    var hechas = g.filter(function (x) { return x.vineta; }).length;
    var conTexto = g.filter(function (x) { return (x.dice || '').trim() || (x.ve || '').trim(); }).length;
    var faltan = g.filter(function (x) { return !x.vineta && ((x.dice || '').trim() || (x.ve || '').trim()); }).length;
    return '<section class="lg-story vol" aria-label="Storyboard">' +
      '<div class="lg-sb-cab"><h2>Storyboard</h2><span class="lg-etq">' + hechas + ' de ' + g.length + ' dibujadas</span></div>' +
      '<div class="lg-sb-rej">' + g.map(function (x, i) {
        var u = x.vineta ? L().urlVineta(x.vineta) : '';
        return u ? '<button type="button" class="lg-sb-v" data-ver-sb title="Ver el storyboard grande"><img src="' + esc(u) + '" alt="Escena ' + (i + 1) + '"><i>' + (i + 1) + '</i></button>'
          : '<button type="button" class="lg-sb-v falta" data-escena="' + i + '" title="Escena ' + (i + 1) + ' sin dibujar"><i>' + (i + 1) + '</i></button>';
      }).join('') + '</div>' +
      '<div class="lg-sb-acc">' +
        (conTexto ? '<button type="button" class="btn btn-linea" id="lg-dibujar">' + (faltan ? '✎ Dibujar ' + (faltan === g.length ? 'el storyboard' : faltan === 1 ? 'la que falta' : 'las ' + faltan + ' que faltan') : '↻ Dibujarlo otra vez') + '</button>'
          : '<p class="lg-vacio">Escribe alguna escena y Cherry la dibuja.</p>') +
        (hechas ? '<button type="button" class="lg-enl" data-ver-sb>Ver el storyboard grande ›</button>' : '') +
        '<button type="button" class="btn btn-claro" data-accion="editor">' + (f.proyecto ? 'Abrir en el Editor Pro →' : 'Grabar con el Editor Pro →') + '</button>' +
      '</div></section>';
  }

  /* ── Lo que se toca ───────────────────────────────────────────────────────── */
  function atar(f) {
    var c = $('lg');
    $('lg-nuevo').onclick = function () { abrirWiz('inicio'); };
    $('lg-premium').onclick = function () { abrirWiz('premium'); };
    c.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { guardarYa(); est.tab = b.dataset.tab; est.sel = null; pintar(); }; });
    c.querySelectorAll('[data-plan]').forEach(function (b) { b.onclick = function () { guardarYa(); est.sel = b.dataset.plan; pintar(); }; });
    c.querySelectorAll('[data-accion="nuevo"]').forEach(function (b) { b.onclick = function () { abrirWiz('inicio'); }; });
    if (!f) return;
    var tit = $('lg-tit');
    tit.oninput = function () { f.titulo = tit.value; guardarLuego(); };
    tit.onblur = guardarYa;
    c.querySelectorAll('[data-pieza]').forEach(function (b) { b.onclick = function () { guardarYa(); L().menuPieza(b, b.dataset.pieza, f); }; });
    c.querySelectorAll('.lg2 textarea[data-campo]').forEach(function (t) {
      var i = Number(t.dataset.i), campo = t.dataset.campo;
      crecer(t);
      t.oninput = function () { if (!f.guion[i]) return; f.guion[i][campo] = t.value; f.auditoria = null; crecer(t); guardarLuego(); medir(f); };
      t.onfocus = function () { est.ultimo = t; };
      t.onblur = guardarYa;
    });
    var gr = c.querySelector('[data-grabar]');
    if (gr) gr.onclick = function (e) { e.stopPropagation(); est.grabar = !est.grabar; pintar(); };
    c.querySelectorAll('[data-vista]').forEach(function (b) {
      b.onclick = function () { guardarYa(); try { localStorage.setItem('cherry-guion-vista-pc', b.dataset.vista); } catch (e) {} pintar(); };
    });
    c.querySelectorAll('[data-sel]').forEach(function (b) { b.onclick = function () { guardarYa(); est.esc = Number(b.dataset.sel); pintar(); }; });
    var regla = $('lg2-regla');
    if (regla) regla.onclick = function (e) {
      var b = e.target.closest('[data-ir]'); if (!b) return;
      var i = Number(b.dataset.ir);
      if (vistaPc() === 'escena') { guardarYa(); est.esc = i; pintar(); return; }
      var bl = $('lg2-bl-' + i), h = $('lg2-hoja'); if (!bl || !h) return;
      var y = h.scrollTop + bl.getBoundingClientRect().top - h.getBoundingClientRect().top - 6;
      h.scrollTop = y;   /* de una: el Laboratorio repinta mientras trae el historial y un desplazamiento suave se perdía a mitad */
    };
    c.querySelectorAll('[data-escena]').forEach(function (b) { b.onclick = function () { guardarYa(); L().abrirEscena(f.id, Number(b.dataset.escena)); }; });
    c.querySelectorAll('[data-ver-sb]').forEach(function (b) { b.onclick = function () { guardarYa(); L().verStoryboard(f); }; });
    var dib = $('lg-dibujar');
    if (dib) dib.onclick = function () { guardarYa(); L().dibujar(f, 'lg-dibujar', function () { pintar(); }); };
    c.querySelectorAll('[data-accion]').forEach(function (b) {
      var a = b.dataset.accion;
      if (a === 'escribir') b.onclick = function () { guardarYa(); L().escribir(f); };
      if (a === 'ficha') b.onclick = function () { guardarYa(); L().abrirEscena(f.id, 0); };
      if (a === 'tp') b.onclick = function () { guardarYa(); if (est.grabar) { est.grabar = false; pintar(); } abrirTP(f, null); };
      if (a === 'grabado') b.onclick = function () { guardarYa(); est.grabar = false; L().marcarGrabado(f); est.tab = 'grabado'; est.sel = f.id; pintar(); };
      if (a === 'editor') b.onclick = function () { guardarYa(); alEditor(f, b); };
      if (a === 'frases') b.onclick = function (e) { e.stopPropagation(); abrirFrases(b, f); };
    });
  }

  /* el texto crece con lo que tiene: nada de cajitas cortadas con flechas de estirar */
  function crecer(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }
  /* el «Grabar» se cierra al tocar fuera */
  document.addEventListener('click', function (e) {
    if (!est.grabar || (e.target.closest && e.target.closest('.lg2-gr'))) return;
    est.grabar = false; if (visible() && !celular()) pintar();
  });

  /* mientras se escribe solo cambia la barra de duración: repintar todo se llevaría el cursor */
  function medir(f) {
    var c = $('lg'); if (!c) return;
    var rg = $('lg2-regla'); if (rg) rg.innerHTML = reglaHtml(f);
    var s = segundos(f), dur = Number(f.dur) || 0;
    var b = c.querySelector('.lg-dur-f b'); if (b) b.textContent = reloj(s);
    var em = c.querySelector('.lg-dur-f em');
    if (em && dur) { em.className = s <= dur ? 'ok' : 'mal'; em.textContent = s <= dur ? 'Cabe en ' + reloj(dur) + ' ✓' : 'Te pasas por ' + (s - dur) + ' s'; }
  }

  function alEditor(f, b) {
    if (f.proyecto) { CherryApp.abrirEditor(f.proyecto); return; }
    var texto = (f.guion || []).map(function (x) { return String(x.dice || '').trim(); }).filter(Boolean).join('\n\n');
    if (!texto) { L().aviso('Escribe qué dices en alguna escena: eso es lo que se lleva al Editor Pro.'); return; }
    b.disabled = true; b.textContent = 'Creando tu proyecto…';
    CherryApp.proyectoConGuion(f.titulo || 'Video nuevo', texto).then(function (id) {
      /* (6-oct) el plan recuerda su proyecto: la segunda vez abre el mismo, no crea otro */
      f.proyecto = id; L().guardar();
      setTimeout(function () { CherryApp.abrirEditor(id); }, 300);
    }, function (e) { b.disabled = false; b.textContent = 'Grabar con el Editor Pro →'; L().aviso('No se pudo crear el proyecto: ' + e.message, 7000); });
  }

  /* Tus frases de marca (Identidad de marca): se tocan y entran donde estaba el cursor */
  function abrirFrases(boton, f) {
    var viejo = document.querySelector('.lg-pop'); if (viejo) { viejo.remove(); return; }
    var pinta = function (lista) {
      var m = document.createElement('div'); m.className = 'lg-pop';
      m.innerHTML = lista.length ? '<span class="lg-etq">Toca una para ponerla donde estabas</span>' + lista.map(function (x, i) {
        return '<button type="button" data-fr="' + i + '">' + esc(x.texto) + '</button>'; }).join('')
        : '<p class="lg-vacio">Todavía no tienes frases. Se guardan en Identidad de marca.</p>';
      document.body.appendChild(m);
      var r = boton.getBoundingClientRect();
      m.style.top = Math.round(r.bottom + 6) + 'px'; m.style.left = Math.round(Math.max(12, r.right - 300)) + 'px';
      m.querySelectorAll('[data-fr]').forEach(function (x) {
        x.onclick = function () {
          var t = est.ultimo && document.contains(est.ultimo) ? est.ultimo : document.querySelector('.lg2 textarea[data-campo="dice"], .lgc-campo textarea');
          if (t) {
            var fr = lista[Number(x.dataset.fr)].texto, a = t.selectionStart || t.value.length, z = t.selectionEnd || a;
            t.value = t.value.slice(0, a) + (a && !/\s$/.test(t.value.slice(0, a)) ? ' ' : '') + fr + t.value.slice(z);
            t.dispatchEvent(new Event('input')); t.focus();
          }
          m.remove();
        };
      });
      setTimeout(function () { document.addEventListener('click', function fuera(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', fuera); } }); }, 0);
    };
    if (est.frases) { pinta(est.frases); return; }
    CherryApp.marca().then(function (mk) {
      est.frases = ((mk && mk.frases) || []).filter(function (x) { return x && x.texto; }); pinta(est.frases);
    }, function () { pinta([]); });
  }

  /* ── Nuevo guion: cuatro caminos ──────────────────────────────────────────── */
  function abrirWiz(paso) {
    est.wiz = { paso: paso, idea: null, desde: null, plantilla: null };
    /* (20-oct) la receta de «Tu próximo video» (herramientas/proximo.html): ya se escogió todo, no se pregunta nada */
    var r = paso === 'inicio' ? tomarReceta() : null;
    if (r) { est.wiz = null; recetaDirecta(r); return; }
    pintarWiz();
  }
  /* (20-oct) «Tu próximo video» guarda su receta (estilo, idea, gancho) en sessionStorage['cherry-receta'] y abre Guiones con
     ?nuevo=1. Se lee UNA vez. */
  function tomarReceta() {
    var r = null;
    try { r = JSON.parse(sessionStorage.getItem('cherry-receta') || 'null'); sessionStorage.removeItem('cherry-receta'); } catch (e) { r = null; }
    if (!r || typeof r !== 'object' || !(r.angulo || r.idea)) return null;
    return { idea: String(r.angulo || r.idea), tema: String(r.idea || ''), gancho: String(r.gancho || ''), frase: String(r.frase || ''),
      video: String(r.video || ''), estilo: String(r.estilo || '') };
  }
  /* Sergio (20-oct): «venimos de donde ya escogimos el estilo, la idea y el gancho». Cherry escoge sola la forma (la
     primera firme, como en «Guion premium») y el Laboratorio piensa y escribe de una con la receta. */
  function recetaDirecta(r) {
    L().aviso('Cherry está armando tu guion con tu receta…', 4000);
    L().calco().then(function (B) {
      var ps = (B && B.plantillas) || [];
      var pl = ps.filter(function (p) { return p.estado === 'firme'; })[0] || ps[0];
      if (!pl) throw new Error('No hay formas de Cherry por ahora. Vuelve a intentarlo.');
      var f = crearPlan({}); pintar();
      return L().premium(f, pl.id, r);
    }).catch(function (e) { L().aviso(e.message, 7000); });
  }
  function cerrarWiz() { est.wiz = null; var v = $('lg-wiz'); if (v) v.remove(); }
  function crearPlan(piezas, cambia) {
    var f = cambia ? L().planConPiezas(piezas, cambia) : L().planDesdeOrden(null, piezas || {}, '', []);
    est.tab = 'porGrabar'; est.sel = f.id; L().elegirPlan(f.id);
    if (celular()) abrirCel(f.id, true);   // (23-oct) en el celular el guion nuevo queda abierto
    return f;
  }
  function pintarWiz() {
    var w = est.wiz; if (!w) return;
    var v = $('lg-wiz');
    if (!v) {
      v = document.createElement('div'); v.className = 'lg-velo'; v.id = 'lg-wiz';
      v.onclick = function (e) { if (e.target === v) cerrarWiz(); };
      document.body.appendChild(v);
    }
    var h = '';
    if (w.paso === 'inicio') {
      h = '<div class="lg-w-cab"><h2>Nuevo guion</h2><span class="lg-mano">¿por dónde empezamos?</span></div>' +
        '<div class="lg-ops">' +
          op('idea', 'Lo que ya te funciona', 'Desde una idea magnética', 'Escoge una idea de tu baúl que ya te dio vistas y haz otro video con ella.', 'laboratorio') +
          op('premium', 'Cherry lo escribe', 'Guion premium', 'Le cuentas el tema o tu objetivo y Cherry lo escribe entero, con la forma de reels que retuvieron.', 'guiones', true) +
          op('formula', 'Del baúl', 'Desde una fórmula', 'Usa una de tus fórmulas guardadas: idea, gancho, estructura y formato ya escogidos.', 'marca') +
          op('yo', 'A tu manera', 'Lo escribo yo', 'Escoges la estructura y escribes escena por escena. Cherry te ayuda en cada una.', 'storyboard') +
        '</div>';
    } else if (w.paso === 'idea') {
      var ideas = L().piezasDe('idea').map(function (p) { var s = estado('idea', p.id); return { p: p, s: s, v: mejorVistas('idea', p.id) }; })
        .sort(function (a, b) { return L().ORDEN_MAG.indexOf(a.s.e) - L().ORDEN_MAG.indexOf(b.s.e) || b.v - a.v; });
      h = '<div class="lg-w-cab"><button type="button" class="lg-atras" data-paso="inicio">‹</button><h2>Desde una idea</h2><span class="lg-mano">primero las que más te han funcionado</span></div>' +
        (ideas.length ? '<div class="lg-ideas">' + ideas.slice(0, 12).map(function (x) {
          return '<button type="button" class="lg-idea' + (w.idea === x.p.id ? ' on' : '') + '" data-idea="' + esc(x.p.id) + '"><b>' + esc(x.p.texto) + '</b>' +
            lineaEstado('idea', x.p.id) + (x.v ? '<small>mejor: ' + miles(x.v) + ' vistas</small>' : '') + '</button>';
        }).join('') + '</div>' : '<p class="lg-vacio">Tu baúl todavía no tiene ideas. Se llenan solas con tus videos en el Laboratorio.</p>') +
        (w.idea ? '<div class="lg-w-pie"><span>Con «' + esc((pieza('idea', w.idea) || {}).texto || '') + '», ¿cómo lo escribimos?</span>' +
          '<button type="button" class="btn btn-linea" data-hacer="idea-yo">Lo escribo yo</button>' +
          '<button type="button" class="lg-pre" data-paso="premium">✦ Que Cherry lo escriba <span>Premium</span></button></div>' : '');
    } else if (w.paso === 'premium') {
      h = '<div class="lg-w-cab"><button type="button" class="lg-atras" data-paso="' + (w.idea ? 'idea' : 'inicio') + '">‹</button><h2>Guion premium</h2>' +
        '<span class="lg-mano">¿con qué forma?</span></div>' +
        '<p class="lg-w-d">Cherry calca la forma de reels que retuvieron y la llena con tu tema' + (w.idea ? ' (' + esc((pieza('idea', w.idea) || {}).texto || '') + ')' : '') +
          '. Lo escribe con su modelo más avanzado. Después te pregunta de qué va el video.</p>' +
        '<div class="lg-ideas" id="lg-plantillas"><p class="lg-vacio">Cargando las formas de Cherry…</p></div>' +
        '<div class="lg-w-pie"><span></span><button type="button" class="lg-pre" data-hacer="premium"' + (w.plantilla ? '' : ' disabled') + '>✦ Escribirlo <span>Premium</span></button></div>';
    } else if (w.paso === 'formula') {
      var d = D(), fs = (d.formulas || []).filter(function (x) { return x.cuenta === d.activa; });
      h = '<div class="lg-w-cab"><button type="button" class="lg-atras" data-paso="inicio">‹</button><h2>Desde una fórmula</h2><span class="lg-mano">tus combinaciones guardadas</span></div>' +
        (fs.length ? '<div class="lg-ideas">' + fs.map(function (x) {
          return '<button type="button" class="lg-idea" data-formula="' + esc(x.id) + '"><b>' + esc(x.nombre || 'Fórmula') + '</b><span class="lg-f-pz">' +
            ['idea', 'gancho', 'estructura', 'formato'].map(function (t) { var p = pieza(t, (x.piezas || {})[t]); return p ? esc(p.texto) : ''; }).filter(Boolean).join(' · ') + '</span></button>';
        }).join('') + '</div>' : '<p class="lg-vacio">No tienes fórmulas guardadas. Se arman en el baúl del Laboratorio con «Nueva fórmula».</p>');
    }
    v.innerHTML = '<div class="lg-ventana vol" role="dialog" aria-modal="true" aria-label="Nuevo guion">' +
      '<button type="button" class="lg-x" aria-label="Cerrar">×</button>' + h + '</div>';
    v.querySelector('.lg-x').onclick = cerrarWiz;
    v.querySelectorAll('[data-op]').forEach(function (b) {
      b.onclick = function () {
        var o = b.dataset.op;
        if (o === 'yo') { cerrarWiz(); var f = crearPlan({}); L().abrirEscena(f.id, 0); return; }
        w.paso = o; pintarWiz();
      };
    });
    v.querySelectorAll('[data-paso]').forEach(function (b) { b.onclick = function () { w.paso = b.dataset.paso; pintarWiz(); }; });
    v.querySelectorAll('[data-idea]').forEach(function (b) { b.onclick = function () { w.idea = b.dataset.idea; pintarWiz(); }; });
    v.querySelectorAll('[data-formula]').forEach(function (b) {
      b.onclick = function () {
        var d = D(), x = (d.formulas || []).filter(function (y) { return y.id === b.dataset.formula; })[0]; if (!x) return;
        cerrarWiz(); var f = crearPlan(x.piezas, 'Fórmula: ' + (x.nombre || '')); pintar();
        L().aviso('Listo: «' + (x.nombre || 'la fórmula') + '» quedó en Por grabar. Escríbelo aquí o toca «Que Cherry lo escriba».', 6000);
        L().elegirPlan(f.id);
      };
    });
    v.querySelectorAll('[data-hacer]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.hacer === 'idea-yo') { cerrarWiz(); var f = crearPlan({ idea: w.idea }); L().abrirEscena(f.id, 0); return; }
        if (b.dataset.hacer === 'premium' && w.plantilla) {
          var pl = w.plantilla, idea = w.idea; cerrarWiz();
          var f2 = crearPlan(idea ? { idea: idea } : {}); pintar();
          L().premium(f2, pl).catch(function (e) { L().aviso(e.message, 7000); });
        }
      };
    });
    if (w.paso === 'premium') {
      L().calco().then(function (B) {
        var caja = $('lg-plantillas'); if (!caja || !est.wiz || est.wiz.paso !== 'premium') return;
        var ps = (B && B.plantillas) || [];
        if (!w.plantilla && ps[0]) w.plantilla = (ps.filter(function (p) { return p.estado === 'firme'; })[0] || ps[0]).id;
        caja.innerHTML = ps.map(function (p) {
          var r = p.respaldo || {};
          return '<button type="button" class="lg-idea' + (w.plantilla === p.id ? ' on' : '') + '" data-pl="' + esc(p.id) + '"><b>' + esc(p.nombre) + '</b>' +
            '<span class="lg-e ' + (p.estado === 'firme' ? 'mag' : 'tem') + '">' + (p.estado === 'firme' ? '★ Firme' : '● Provisional') + ' · ' + (r.videos || 0) + (r.videos === 1 ? ' reel' : ' reels') + '</span>' +
            (r.mejor ? '<small>el mejor con ' + miles(r.mejor) + ' vistas</small>' : '') + '</button>';
        }).join('') || '<p class="lg-vacio">No hay formas de Cherry por ahora.</p>';
        caja.querySelectorAll('[data-pl]').forEach(function (b) { b.onclick = function () { w.plantilla = b.dataset.pl; pintarWiz(); }; });
        var go = $('lg-wiz') && $('lg-wiz').querySelector('[data-hacer="premium"]'); if (go) go.disabled = !w.plantilla;
      }, function () { var caja = $('lg-plantillas'); if (caja) caja.innerHTML = '<p class="lg-vacio">No se pudieron cargar las formas de Cherry. Vuelve a intentarlo.</p>'; });
    }
  }
  function op(id, etq, titulo, texto, arte, premium) {
    return '<button type="button" class="lg-op" data-op="' + id + '"><span class="lg-etq">' + etq + '</span><b>' + titulo + '</b><span class="lg-op-d">' + texto + '</span>' +
      (premium ? '<span class="lg-chip mag">✦ Premium</span>' : '') +
      '<img src="../assets/inicio/v2/' + arte + '-chica.webp" alt="" aria-hidden="true"></button>';
  }

  /* ── Lo de la pantalla vieja de Guiones, una sola vez ─────────────────────── */
  function llave(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function importar() {
    if (importado || !L() || !L().modoGuiones) return;
    importado = true;
    CherryApp.cargar('guiones').then(function (doc) {
      if (!doc || !Array.isArray(doc.guiones)) return;
      var d = D(), cambio = false;
      doc.guiones.forEach(function (g) {
        /* los de ejemplo (g1…g8) no son de la persona */
        if (!g || g.plan || /^g[1-8]$/.test(g.id || '')) return;
        var tit = String(g.titulo || '').trim();
        var escenas = Array.isArray(g.escenas) && g.escenas.length
          ? g.escenas.map(function (e) { return { escena: e.nombre || 'Escena', clase: 'hablada', dice: e.dice || '', ve: e.ve || '' }; })
          : [{ escena: 'Gancho', clase: 'hablada', dice: g.gancho || '', ve: '' }]
              .concat((g.puntos || []).filter(function (p) { return String(p || '').trim(); }).map(function (p) { return { escena: 'Desarrollo', clase: 'hablada', dice: p, ve: '' }; }))
              .concat(String(g.cierre || '').trim() ? [{ escena: 'Cierre', clase: 'hablada', dice: g.cierre, ve: '' }] : []);
        if (!tit && !escenas.some(function (e) { return String(e.dice).trim(); })) return;
        var ya = tit && d.planes.filter(function (f) { return f.cuenta === d.activa && llave(f.titulo) === llave(tit); })[0];
        if (!ya) {
          ya = L().planDesdeOrden(null, {}, '', []);
          ya.titulo = tit; ya.dur = Number(g.meta) || null; ya.guion = escenas; ya.deGuiones = g.id;
          if (g.fecha) ya.creado = new Date(g.fecha).toISOString().slice(0, 10);
          if (g.estado === 'grabado') { ya.grabado = true; ya.fechaGrabado = ya.creado; }
        }
        g.plan = ya.id; cambio = true;
      });
      if (cambio) { L().guardar(); CherryApp.guardar('guiones', doc); est.sel = null; pintar(); }
    }).catch(function () {});
  }

  /* ── Teleprompter (vino de la pantalla vieja de Guiones) ───────────────────── */
  var ICO = {
    atras: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>',
    menos: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12"/></svg>',
    mas: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
    espejo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18"/><path d="M8 7L3 12l5 5V7zM16 7l5 5-5 5V7z"/></svg>',
  };
  var TP = null;
  function abrirTP(f, desde) {
    var secs = (f.guion || []).filter(function (x) { return String(x.dice || '').trim(); });
    if (!secs.length) { L().aviso('Escribe qué dices en alguna escena para leerlo en el teleprompter.'); return; }
    if (!TP) TP = armarTP();
    TP.abrir(f.titulo || 'Guion sin título', secs, desde);
  }
  function armarTP() {
    var tp = document.createElement('div');
    tp.className = 'lg-tp'; tp.hidden = true; tp.setAttribute('role', 'dialog'); tp.setAttribute('aria-modal', 'true'); tp.setAttribute('aria-label', 'Teleprompter');
    tp.innerHTML = '<div class="lg-tp-progreso"><i></i></div>' +
      '<div class="lg-tp-arriba"><button type="button" class="lg-tp-b" data-tp="salir">‹ Salir</button><span class="t"></span><span class="quedan">0:00</span></div>' +
      '<div class="lg-tp-ventana"><div class="lg-tp-linea" aria-hidden="true"></div><div class="lg-tp-texto"><div class="hoja"></div></div>' +
        '<div class="lg-tp-cuenta" aria-live="assertive"></div><div class="lg-tp-pausa" hidden>En pausa · toca para seguir</div></div>' +
      '<div class="lg-tp-mandos"><div class="lg-tp-barra">' +
        '<button type="button" class="lg-tp-ico" data-tp="reiniciar" aria-label="Volver a empezar">' + ICO.atras + '</button>' +
        '<button type="button" class="lg-tp-b claro" data-tp="play"><span class="i">' + ICO.pausa + '</span><span class="pt">Pausa</span></button>' +
        '<span class="grupo" role="group" aria-label="Velocidad"><button type="button" class="lg-tp-ico" data-tp="lento" aria-label="Más lento">' + ICO.menos + '</button>' +
          '<span class="val" aria-live="polite">150 pal/min</span><button type="button" class="lg-tp-ico" data-tp="rapido" aria-label="Más rápido">' + ICO.mas + '</button></span>' +
        '<span class="grupo" role="group" aria-label="Tamaño de la letra"><button type="button" class="lg-tp-ico" data-tp="achica" aria-label="Letra más pequeña">A−</button>' +
          '<button type="button" class="lg-tp-ico" data-tp="agranda" aria-label="Letra más grande">A+</button></span>' +
        '<button type="button" class="lg-tp-ico" data-tp="espejo" aria-pressed="false" aria-label="Espejo, para teleprompter con vidrio">' + ICO.espejo + '</button>' +
      '</div></div><div class="lg-tp-ayuda">Espacio o toque: pausa · Flechas ↑ ↓: velocidad · Esc: salir</div>';
    document.body.appendChild(tp);
    var q = function (s) { return tp.querySelector(s); };
    var ventana = q('.lg-tp-ventana'), texto = q('.lg-tp-texto'), hoja = q('.hoja');
    var pref = { ppm: 150, letra: 0, espejo: false };
    try { var pg = JSON.parse(localStorage.getItem('cherry-teleprompter') || 'null'); if (pg) Object.assign(pref, pg); } catch (e) {}
    var y = 0, maxY = 1, vel = 1, corriendo = false, contando = false, raf = 0, ultimo = 0, palabrasTP = 0, completa = false, cuentaReloj = [], volverA = null;
    function guardarPref() { try { localStorage.setItem('cherry-teleprompter', JSON.stringify(pref)); } catch (e) {} }
    function letraInicial() { return Math.round(Math.min(56, Math.max(30, window.innerWidth * 0.045))); }
    function lineaY() { return ventana.clientHeight * 0.30; }
    function colocar() { texto.style.transform = 'translateY(' + (lineaY() - pref.letra * 0.72 - y) + 'px)'; }
    function recalcular() {
      var frac = maxY > 1 ? y / maxY : 0;
      tp.style.setProperty('--tp-letra', pref.letra + 'px');
      maxY = Math.max(1, hoja.offsetHeight - pref.letra * 1.9);
      vel = maxY / Math.max(1, palabrasTP / pref.ppm * 60);
      y = frac * maxY; colocar(); pintarEstado();
    }
    function pintarEstado() {
      q('.lg-tp-progreso i').style.width = (y / maxY * 100) + '%';
      q('.quedan').textContent = 'Quedan ' + reloj((maxY - y) / vel);
      q('.val').textContent = pref.ppm + ' palabras/min';
      tp.style.setProperty('--tp-letra', pref.letra + 'px');
      texto.classList.toggle('espejo', pref.espejo); q('[data-tp="espejo"]').setAttribute('aria-pressed', pref.espejo);
      var pausa = !corriendo && !contando;
      q('[data-tp="play"] .pt').textContent = corriendo || contando ? 'Pausa' : (y >= maxY ? 'Otra vez' : 'Seguir');
      q('[data-tp="play"] .i').innerHTML = corriendo || contando ? ICO.pausa : ICO.play;
      var p = q('.lg-tp-pausa'); p.hidden = !pausa; p.textContent = y >= maxY ? 'Terminaste · ↺ para leer otra vez' : 'En pausa · toca para seguir';
    }
    function paso(t) {
      if (!ultimo) ultimo = t;
      var dt = Math.min(0.1, (t - ultimo) / 1000); ultimo = t;
      if (corriendo) { y += vel * dt; if (y >= maxY) { y = maxY; corriendo = false; } colocar(); pintarEstado(); }
      raf = requestAnimationFrame(paso);
    }
    function cuenta() {
      cuentaReloj.forEach(clearTimeout); cuentaReloj = [];
      contando = true; corriendo = false; pintarEstado();
      var c = q('.lg-tp-cuenta');
      [3, 2, 1].forEach(function (v, i) { cuentaReloj.push(setTimeout(function () { c.innerHTML = '<b>' + v + '</b>'; }, i * 800)); });
      cuentaReloj.push(setTimeout(function () { c.innerHTML = ''; contando = false; corriendo = true; ultimo = 0; pintarEstado(); }, 2400));
    }
    function alternar() {
      if (contando) { cuentaReloj.forEach(clearTimeout); cuentaReloj = []; contando = false; q('.lg-tp-cuenta').innerHTML = ''; pintarEstado(); return; }
      if (y >= maxY) { y = 0; colocar(); cuenta(); return; }
      corriendo = !corriendo; ultimo = 0; pintarEstado();
    }
    function cerrar() {
      cuentaReloj.forEach(clearTimeout); cuentaReloj = []; q('.lg-tp-cuenta').innerHTML = '';
      corriendo = false; contando = false; cancelAnimationFrame(raf);
      tp.hidden = true; document.documentElement.style.overflow = '';
      if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
      completa = false;
      if (volverA && document.contains(volverA)) volverA.focus();
    }
    document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && completa && !tp.hidden) { completa = false; cerrar(); } });
    function velocidad(d) { pref.ppm = Math.max(90, Math.min(240, pref.ppm + d)); guardarPref(); recalcular(); }
    function tamano(d) { pref.letra = Math.max(26, Math.min(96, pref.letra + d)); guardarPref(); recalcular(); }
    tp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tp]');
      if (!b) { if (e.target.closest('.lg-tp-ventana')) alternar(); return; }
      var a = b.dataset.tp;
      if (a === 'salir') cerrar(); else if (a === 'play') alternar();
      else if (a === 'reiniciar') { y = 0; colocar(); cuenta(); }
      else if (a === 'lento') velocidad(-10); else if (a === 'rapido') velocidad(10);
      else if (a === 'achica') tamano(-6); else if (a === 'agranda') tamano(6);
      else if (a === 'espejo') { pref.espejo = !pref.espejo; guardarPref(); pintarEstado(); }
    });
    document.addEventListener('keydown', function (e) {
      if (tp.hidden) return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) alternar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); velocidad(10); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); velocidad(-10); }
      else if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    });
    window.addEventListener('resize', function () { if (!tp.hidden) recalcular(); });
    return {
      abrir: function (titulo, secs, desde) {
        volverA = desde || null;
        palabrasTP = 0;
        hoja.innerHTML = secs.map(function (x) {
          palabrasTP += palabras(x.dice);
          return '<span class="sec">' + esc(x.escena || '') + '</span><p>' + esc(x.dice) + '</p>';
        }).join('') + '<p class="fin">fin</p>';
        q('.t').textContent = titulo;
        if (!pref.letra) pref.letra = letraInicial();
        tp.hidden = false; document.documentElement.style.overflow = 'hidden';
        completa = false;
        try { if (tp.requestFullscreen) tp.requestFullscreen().then(function () { completa = true; }).catch(function () {}); } catch (e) {}
        y = 0; maxY = 1; recalcular(); y = 0; colocar();
        cancelAnimationFrame(raf); ultimo = 0; raf = requestAnimationFrame(paso);
        q('[data-tp="play"]').focus(); cuenta();
      },
    };
  }

  /* ── (23-oct) En el celular, otra pantalla ────────────────────────────────────
     Sergio: «ahora diseñemos la pantalla de guiones en celular». Era la del computador apilada: se salía de lado (453 px en
     390) y medía casi 3.000 px. Propuesta «Guiones en el celular» (https://claude.ai/artifact/H6ghNT2pP9B3r5s8D1JpQG), con la
     regla del editor del celular: pantalla fija, barra abajo, hojas que suben. Del guion abierto había dos formas y escogió
     las dos: «que el usuario pueda cambiar la vista». «Lista» (todas las escenas) o «Una a una» (cada escena con su dibujo a
     pantalla completa, como historias); la que escoja se recuerda en ese celular. Mismos datos y funciones del Laboratorio. */
  var CEL = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };
  function celular() { return !!CEL.matches; }
  var VISTA_K = 'cherry-guion-vista';
  function vistaCel() { try { return localStorage.getItem(VISTA_K) === 'una' ? 'una' : 'lista'; } catch (e) { return 'lista'; } }
  function ponerVista(v) { try { localStorage.setItem(VISTA_K, v); } catch (e) {} }
  var ICO2 = {
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="5" rx="2"/><rect x="4" y="11" width="16" height="5" rx="2"/><path d="M4 20h10"/></svg>',
    una: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M3 7v10M21 7v10"/></svg>',
    sb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="7.5" height="7" rx="1.6"/><rect x="13.5" y="4" width="7.5" height="7" rx="1.6"/><rect x="3" y="13" width="7.5" height="7" rx="1.6"/><rect x="13.5" y="13" width="7.5" height="7" rx="1.6"/></svg>',
    cherry: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.1 5.6 5.9.3-4.6 3.7 1.6 5.8L12 14.6l-5 3.3 1.6-5.8L4 8.4l5.9-.3z"/></svg>',
  };
  function tramo(f, i) { try { return L().tramoDe(f, i); } catch (e) { return ''; } }
  function urlV(x) { return x && x.vineta ? L().urlVineta(x.vineta) : ''; }

  /* abrir un guion empuja un paso en el historial: el «atrás» del celular cierra primero la hoja y después el guion */
  function abrirCel(id, sinPintar) {
    est.abierto = id; est.sel = id; est.mod = 'escenas'; est.una = 0; est.hoja = null;
    try { if (!(history.state && history.state.lgc)) history.pushState({ lgc: 1 }, ''); } catch (e) {}
    if (!sinPintar) pintar();
  }
  function cerrarCel() {
    guardarYa();
    if (history.state && history.state.lgc) { history.back(); return; }
    est.abierto = null; est.hoja = null; pintar();
  }
  window.addEventListener('popstate', function () {
    if (!celular() || !est.abierto) return;
    var de = function () { try { history.pushState({ lgc: 1 }, ''); } catch (e) {} };
    if (!visible()) { L().ver('vg'); de(); return; }          // desde la ficha o el storyboard grande: vuelve al guion
    if (est.hoja) { est.hoja = null; pintar(); de(); return; }
    guardarYa(); est.abierto = null; pintar();
  });

  function pintarCel(ps, n) {
    var c = $('lg');
    var f = est.abierto ? ps.filter(function (x) { return x.id === est.abierto; })[0] : null;
    if (est.abierto && !f) { est.abierto = null; est.hoja = null; }
    if (f) { L().elegirPlan(f.id); est.tab = tabDe(f); }
    /* repintar no mueve lo que la persona bajó */
    var cu = c.querySelector('.lgc-cuerpo'), ho = c.querySelector('.lgc-hoja');
    var antes = { cu: cu ? cu.scrollTop : 0, ho: ho ? ho.scrollTop : 0, clave: c.dataset.celClave };
    var clave = (f ? f.id + '|' + est.mod + '|' + vistaCel() : '') + '|' + (est.hoja ? est.hoja.t + (est.hoja.i || '') : '');
    /* la hoja sube SOLO al abrirse: el Laboratorio repinta a veces por su cuenta y la animación volvía a empezar */
    var hk = f && est.hoja ? f.id + '|' + est.hoja.t : '';
    est.hojaSube = !!hk && hk !== est.hojaK; est.hojaK = hk;
    c.classList.add('lg-cel'); c.dataset.celClave = clave;
    c.innerHTML = celLista(ps, n) + (f ? celPlan(f) : '');
    if (antes.clave === clave) {
      var cu2 = c.querySelector('.lgc-cuerpo'), ho2 = c.querySelector('.lgc-hoja');
      if (cu2) cu2.scrollTop = antes.cu; if (ho2) ho2.scrollTop = antes.ho;
    }
    atarCel(f);
    if (f && vistaCel() === 'una') precargar(f);
    if (est.wiz) pintarWiz();
  }

  function celLista(ps, n) {
    var lista = ps.filter(function (x) { return tabDe(x) === est.tab; });
    return '<section class="lgc-lista" aria-label="Tus guiones">' +
      '<div class="lgc-cab"><div><h1>Guiones</h1><p>Escríbelo, míralo dibujado y llévalo a grabar.</p></div>' +
        '<img src="../assets/inicio/v2/guiones-chica.webp" alt="" aria-hidden="true"></div>' +
      '<div class="lgc-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (est.tab === t[0]) + '">' + t[1] + ' <b>' + n[t[0]] + '</b></button>';
      }).join('') + '</div>' +
      '<div class="lgc-items">' + (lista.length ? lista.map(celItem).join('') : '<p class="lg-vacio">' + (est.tab === 'porGrabar' ? 'No tienes guiones por grabar. Empieza uno con «Nuevo guion».'
          : est.tab === 'grabado' ? 'Aquí llegan los guiones que ya grabaste.' : 'Aquí llegan los guiones que ya publicaste.') + '</p>') + '</div>' +
      '<div class="lgc-nuevo"><button type="button" class="lgc-pil" id="lg-nuevo"><i aria-hidden="true">+</i>Nuevo guion</button></div>' +
    '</section>';
  }
  function celItem(x) {
    var g = x.guion || [], s = segundos(x), escritas = g.filter(function (y) { return (y.dice || '').trim(); }).length;
    var dib = g.filter(function (y) { return y.vineta; }).length, u = urlV(g.filter(function (y) { return y.vineta; })[0]);
    var e = pieza('estructura', (x.piezas || {}).estructura);
    return '<button type="button" class="lgc-item" data-abrir="' + esc(x.id) + '">' +
      (u ? '<img class="lgc-mini" src="' + esc(u) + '" alt="" loading="lazy">' : '<span class="lgc-mini vacia">sin<br>dibujo</span>') +
      '<span class="lgc-item-t"><b>' + esc(x.titulo || 'Guion sin título') + '</b>' +
        '<small>' + (escritas ? reloj(s) + ' · ' + g.length + ' escenas' : 'sin escribir todavía') + '</small>' +
        '<span class="lgc-chips">' + (dib ? '<i class="si">' + dib + (dib === 1 ? ' dibujada' : ' dibujadas') + '</i>' : escritas ? '<i>sin dibujar</i>' : '') +
          (e ? '<i>' + esc(e.texto) + '</i>' : '') + '</span></span>' +
      '<span class="lgc-fl" aria-hidden="true">›</span></button>';
  }

  function celPlan(f) {
    var una = vistaCel() === 'una' && est.mod !== 'sb';
    var activo = est.mod === 'sb' ? 'sb' : una ? 'una' : 'lista';
    var mods = [['lista', 'Lista'], ['una', 'Una a una'], ['sb', 'Storyboard'], ['cherry', 'Cherry ✦']];
    return '<div class="lgc-plan' + (una ? ' oscura' : '') + '" role="dialog" aria-label="' + esc(f.titulo || 'Guion sin título') + '">' +
      (una ? celFondo(f) : '') +
      '<div class="lgc-barra"><button type="button" class="lgc-circ" data-cerrar aria-label="Volver a tus guiones">‹</button>' +
        '<input class="lgc-tit" id="lg-tit" value="' + esc(f.titulo || '') + '" placeholder="Ponle un título" aria-label="Título del video">' +
        '<button type="button" class="lgc-grabar" data-hoja="grabar">Grabar<i aria-hidden="true"></i></button></div>' +
      (est.mod === 'sb' ? celStory(f) : una ? celUna(f) : celEscenas(f)) +
      '<nav class="lgc-mods" aria-label="Cómo ver el guion">' + mods.map(function (m) {
        return '<button type="button" data-mod="' + m[0] + '"' + (m[0] === activo ? ' class="on" aria-current="true"' : '') + '>' + ICO2[m[0]] + '<span>' + m[1] + '</span></button>';
      }).join('') + '</nav>' +
      (est.hoja ? celHoja(f) : '') +
    '</div>';
  }

  /* «Lista»: la duración, las piezas y todas las escenas con su dibujo */
  function celEscenas(f) {
    var g = f.guion || [], s = segundos(f), dur = Number(f.dur) || 0;
    var total = g.reduce(function (a, x) { return a + palabras(x.dice); }, 0);
    var ver = !dur || !total ? '' : s <= dur ? '<em class="ok">cabe en ' + reloj(dur) + ' ✓</em>' : '<em class="mal">te pasas por ' + (s - dur) + ' s</em>';
    var raya = dur && s > dur ? (dur / s * 100).toFixed(1) : null;
    return '<div class="lgc-cuerpo">' +
      '<div class="lgc-dur"><span><b>' + reloj(s) + '</b>' + (dur ? 'de ' + reloj(dur) : total + ' palabras') + '</span>' + ver + '</div>' +
      (total ? '<div class="lgc-segs" aria-hidden="true">' + g.map(function (x) { var w = palabras(x.dice); return w ? '<i style="flex:' + w + '"></i>' : ''; }).join('') +
        (raya ? '<s style="left:' + raya + '%"></s><u style="left:' + raya + '%"></u>' : '') + '</div>' : '') +
      '<div class="lgc-piezas">' + L().PIEZAS.map(function (P) {
        var p = pieza(P.id, (f.piezas || {})[P.id]);
        return '<button type="button"' + (p ? '' : ' class="falta"') + ' data-hoja="piezas"><small>' + esc(P.uno) + '</small>' + (p ? esc(p.texto) : 'Escoger…') + '</button>';
      }).join('') + '</div>' +
      (g.length ? '<div class="lgc-escenas">' + g.map(function (x, i) {
        var u = urlV(x), tr = tramo(f, i);
        return '<button type="button" class="lgc-esc" data-esc="' + i + '">' +
          (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<span class="lgc-esc-v" aria-hidden="true">✦</span>') +
          '<span class="lgc-esc-t"><span class="lgc-n"><b>' + (i + 1) + '</b>' + esc(x.escena || 'Escena') + (tr ? '<small>' + esc(tr) + '</small>' : '') + '</span>' +
          '<span class="lgc-esc-d' + ((x.dice || '').trim() ? '' : ' vacio') + '">' + esc((x.dice || '').trim() || 'Toca para escribir lo que dices') + '</span></span></button>';
      }).join('') + '</div>' : '<p class="lg-vacio lgc-vacio">Escoge una estructura en «Cherry ✦ › Las piezas»: de ahí salen las escenas.</p>') +
    '</div>';
  }

  /* «Una a una»: la escena con su dibujo a pantalla completa; se pasa tocando las flechas o deslizando */
  function celFondo(f) {
    var x = (f.guion || [])[est.una || 0], u = urlV(x);
    return '<div class="lgc-fondo' + (u ? '' : ' sin') + '" aria-hidden="true">' + (u ? '<img src="' + esc(u) + '" alt="">' : '<span>' + ((est.una || 0) + 1) + '</span>') + '</div>';
  }
  function celUna(f) {
    var g = f.guion || [];
    if (!g.length) return '<div class="lgc-cuerpo"><p class="lg-vacio lgc-vacio">Escoge una estructura en «Cherry ✦ › Las piezas»: de ahí salen las escenas.</p></div>';
    var i = Math.min(Math.max(0, est.una || 0), g.length - 1), x = g[i], tr = tramo(f, i), ve = (x.ve || '').trim() || (x.veCherry ? 'Cherry lo imaginó: ' + x.veCherry : '');
    est.una = i;
    return '<div class="lgc-hist" aria-hidden="true">' + g.map(function (y, k) { return '<i' + (k <= i ? ' class="ya"' : '') + '></i>'; }).join('') + '</div>' +
      '<div class="lgc-una" data-una>' +
        '<button type="button" class="lgc-lado izq" data-paso="-1" aria-label="Escena anterior"' + (i ? '' : ' disabled') + '>‹</button>' +
        '<button type="button" class="lgc-lado der" data-paso="1" aria-label="Escena siguiente"' + (i < g.length - 1 ? '' : ' disabled') + '>›</button>' +
        '<div class="lgc-una-tx">' +
          '<span class="lgc-n"><b>' + (i + 1) + '</b>' + esc(x.escena || 'Escena') + '<small>' + (tr ? esc(tr) + ' · ' : '') + (i + 1) + ' de ' + g.length + '</small></span>' +
          '<p class="lgc-dice' + ((x.dice || '').trim() ? '' : ' vacio') + '">' + ((x.dice || '').trim() ? '«' + esc(x.dice.trim()) + '»' : 'Todavía no escribes qué dices aquí.') + '</p>' +
          (ve ? '<p class="lgc-ve"><small>Se ve</small>' + esc(ve) + '</p>' : '') +
          '<div class="lgc-una-acc"><button type="button" data-esc="' + i + '">✎ Escribirla</button><button type="button" class="fu" data-mejorar="' + i + '">✦ Mejorarla</button></div>' +
        '</div>' +
      '</div>';
  }
  /* las viñetas de al lado, ya cargadas: pasar de escena no espera la imagen */
  function precargar(f) {
    var g = f.guion || [];
    [est.una - 1, est.una + 1].forEach(function (k) { var u = urlV(g[k]); if (u) { var im = new Image(); im.src = u; } });
  }

  function celStory(f) {
    var g = f.guion || [];
    var hechas = g.filter(function (x) { return x.vineta; }).length;
    var conTexto = g.filter(function (x) { return (x.dice || '').trim() || (x.ve || '').trim(); }).length;
    var faltan = g.filter(function (x) { return !x.vineta && ((x.dice || '').trim() || (x.ve || '').trim()); }).length;
    return '<div class="lgc-cuerpo">' +
      '<div class="lgc-sb-cab"><b>Storyboard</b><small>' + hechas + ' de ' + g.length + ' dibujadas</small></div>' +
      '<div class="lgc-sb">' + g.map(function (x, i) {
        var u = urlV(x);
        return '<button type="button" data-esc="' + i + '"' + (u ? '' : ' class="falta"') + ' aria-label="Escena ' + (i + 1) + '">' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '') + '<b>' + (i + 1) + '</b></button>';
      }).join('') + '</div>' +
      '<div class="lgc-sb-acc">' +
        (conTexto ? '<button type="button" id="lg-dibujar">' + (faltan ? '✎ Dibujar ' + (faltan === g.length ? 'el storyboard' : faltan === 1 ? 'la que falta' : 'las ' + faltan + ' que faltan') : '↻ Dibujarlo otra vez') + '</button>'
          : '<p class="lg-vacio">Escribe alguna escena y Cherry la dibuja.</p>') +
        (hechas ? '<button type="button" data-ver-sb>Verlo en grande ›</button>' : '') +
      '</div></div>';
  }

  /* las hojas que suben desde abajo */
  function hcab(titulo, sub) {
    return '<div class="lgc-hcab"><div>' + (sub ? '<small>' + sub + '</small>' : '') + '<b>' + titulo + '</b></div>' +
      '<button type="button" class="lgc-x" data-hoja-cerrar aria-label="Cerrar">✕</button></div>';
  }
  function opc(accion, ico, cl, titulo, texto) {
    return '<button type="button" class="lgc-opc" data-op="' + accion + '"><i class="' + cl + '" aria-hidden="true">' + ico + '</i><span><b>' + titulo + '</b><small>' + texto + '</small></span></button>';
  }
  function celHoja(f) {
    var h = est.hoja, g = f.guion || [], cuerpo = '';
    if (h.t === 'escena') {
      var i = h.i, x = g[i]; if (!x) { est.hoja = null; return ''; }
      var u = urlV(x), pv = x.planoVineta || null, tr = tramo(f, i);
      cuerpo = hcab(esc(x.escena || 'Escena'), 'Escena ' + (i + 1) + ' de ' + g.length + (tr ? ' · ' + esc(tr) : '')) +
        (u || pv ? '<div class="lgc-plano">' + (u ? '<img src="' + esc(u) + '" alt="">' : '') + '<div>' + (pv && pv.nombre ? '<b>' + esc(pv.nombre) + '</b>' : '') +
          (pv && pv.porque ? '<p>' + esc(pv.porque.charAt(0).toUpperCase() + pv.porque.slice(1)) + '.</p>' : '') + '</div></div>' : '') +
        '<div class="lgc-campo"><span class="lgc-etq"><label for="lgc-dice">Lo que dices</label><button type="button" data-accion="frases">Mis frases ›</button></span>' +
          '<textarea id="lgc-dice" data-campo="dice" data-i="' + i + '" rows="5" placeholder="Lo que dices">' + esc(x.dice || '') + '</textarea></div>' +
        '<div class="lgc-campo"><span class="lgc-etq"><label for="lgc-ve">Lo que se ve</label></span>' +
          '<textarea id="lgc-ve" data-campo="ve" data-i="' + i + '" rows="2" placeholder="' + esc(x.veCherry ? 'Cherry lo imaginó: ' + x.veCherry : 'En blanco, Cherry lo imagina') + '">' + esc(x.ve || '') + '</textarea></div>' +
        '<div class="lgc-hpie"><button type="button" data-hesc="' + (i - 1) + '"' + (i ? '' : ' disabled') + '>‹ Anterior</button>' +
          '<button type="button" class="fu" data-mejorar="' + i + '">✦ Mejorarla</button>' +
          '<button type="button" class="ne" data-hesc="' + (i + 1) + '"' + (i < g.length - 1 ? '' : ' disabled') + '>Siguiente ›</button></div>';
    } else if (h.t === 'grabar') {
      cuerpo = hcab('Grabar este guion', g.length + (g.length === 1 ? ' escena · ' : ' escenas · ') + reloj(segundos(f))) +
        opc('tp', '▶', '', 'Leerlo mientras grabo', 'El teleprompter: el texto sube solo, a tu ritmo.') +
        opc('editor', '↑', 'am', f.proyecto ? 'Abrirlo en el Editor Pro' : 'Subir mis clips al Editor Pro', f.proyecto ? 'El proyecto que ya hiciste con este guion.' : 'Cherry lo edita siguiendo este guion.') +
        (tabDe(f) === 'porGrabar' ? opc('grabado', '✓', 'fu', 'Ya lo grabé', 'Pasa a «Grabados».') : '');
    } else if (h.t === 'cherry') {
      cuerpo = hcab('¿Qué hago con este guion?', 'Cherry te ayuda') +
        opc('escribir', '✦', 'fu', 'Que Cherry lo escriba', 'Le cuentas de qué va y lo escribe entero. Premium.') +
        opc('ficha', '✓', '', 'Revisarlo escena por escena', 'Auditarlo, mejorar cada escena y escribirla con Cherry.') +
        opc('piezas', '✎', 'am', 'Idea, estructura, gancho y formato', 'Las piezas de este guion, de tu baúl.');
    } else if (h.t === 'piezas') {
      cuerpo = hcab('Las piezas', 'De tu baúl · lo que más te funciona sale arriba') + '<div class="lgc-pzs">' + L().PIEZAS.map(function (P) {
        var id = (f.piezas || {})[P.id], p = pieza(P.id, id);
        return '<div class="sel lg-sel"><button type="button" class="lg-pz" data-pieza="' + P.id + '">' +
          '<span class="lg-etq">' + esc(P.uno) + '</span><b>' + (p ? esc(p.texto) : '<span class="lg-gris">Escoger…</span>') + '</b>' +
          (p ? lineaEstado(P.id, id) : '<span class="lg-e neu">' + esc(P.d) + '</span>') + '</button></div>';
      }).join('') + '</div>';
    }
    return '<div class="lgc-velo" data-hoja-cerrar></div><div class="lgc-hoja' + (est.hojaSube ? ' sube' : '') + '" role="dialog" aria-modal="true">' +
      '<span class="lgc-asa" aria-hidden="true"></span>' + cuerpo + '</div>';
  }

  function atarCel(f) {
    var c = $('lg');
    c.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { est.tab = b.dataset.tab; pintar(); }; });
    c.querySelectorAll('[data-abrir]').forEach(function (b) { b.onclick = function () { abrirCel(b.dataset.abrir); }; });
    $('lg-nuevo').onclick = function () { abrirWiz('inicio'); };
    if (!f) return;
    var hoja = function (h) { guardarYa(); est.hoja = h; pintar(); };
    c.querySelector('[data-cerrar]').onclick = cerrarCel;
    var tit = $('lg-tit');
    tit.oninput = function () { f.titulo = tit.value; guardarLuego(); };
    tit.onblur = guardarYa;
    c.querySelectorAll('[data-mod]').forEach(function (b) {
      b.onclick = function () {
        var m = b.dataset.mod;
        if (m === 'cherry') { hoja({ t: 'cherry' }); return; }
        if (m === 'sb') est.mod = 'sb'; else { est.mod = 'escenas'; ponerVista(m); }
        guardarYa(); est.hoja = null; pintar();
      };
    });
    c.querySelectorAll('[data-hoja]').forEach(function (b) { b.onclick = function () { hoja({ t: b.dataset.hoja }); }; });
    c.querySelectorAll('[data-esc]').forEach(function (b) { b.onclick = function () { hoja({ t: 'escena', i: Number(b.dataset.esc) }); }; });
    c.querySelectorAll('[data-hesc]').forEach(function (b) { b.onclick = function () { hoja({ t: 'escena', i: Number(b.dataset.hesc) }); }; });
    c.querySelectorAll('[data-hoja-cerrar]').forEach(function (b) { b.onclick = function () { hoja(null); }; });
    c.querySelectorAll('[data-mejorar]').forEach(function (b) { b.onclick = function () { guardarYa(); est.hoja = null; L().abrirEscena(f.id, Number(b.dataset.mejorar)); }; });
    c.querySelectorAll('[data-ver-sb]').forEach(function (b) { b.onclick = function () { guardarYa(); L().verStoryboard(f); }; });
    var dib = $('lg-dibujar');
    if (dib) dib.onclick = function () { guardarYa(); L().dibujar(f, 'lg-dibujar', function () { pintar(); }); };
    /* «Una a una»: flechas y deslizar */
    var paso = function (d) {
      var k = (est.una || 0) + d; if (k < 0 || k >= (f.guion || []).length) return;
      est.una = k; pintar();
    };
    c.querySelectorAll('[data-paso]').forEach(function (b) { b.onclick = function () { paso(Number(b.dataset.paso)); }; });
    var u = c.querySelector('[data-una]');
    if (u) {
      var x0 = null, y0 = 0;
      u.addEventListener('touchstart', function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
      u.addEventListener('touchend', function (e) {
        if (x0 == null) return; var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) paso(dx < 0 ? 1 : -1);
      }, { passive: true });
    }
    /* lo que se escribe en la hoja de la escena se guarda solo, como en el computador */
    c.querySelectorAll('.lgc-campo textarea').forEach(function (t) {
      var i = Number(t.dataset.i), campo = t.dataset.campo;
      t.oninput = function () { if (!f.guion[i]) return; f.guion[i][campo] = t.value; f.auditoria = null; guardarLuego(); };
      t.onfocus = function () { est.ultimo = t; };
      t.onblur = guardarYa;
    });
    c.querySelectorAll('[data-accion="frases"]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); abrirFrases(b, f); }; });
    c.querySelectorAll('[data-pieza]').forEach(function (b) { b.onclick = function () { guardarYa(); L().menuPieza(b, b.dataset.pieza, f); }; });
    c.querySelectorAll('[data-op]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.op; guardarYa();
        if (a === 'tp') { est.hoja = null; pintar(); abrirTP(f, null); }
        else if (a === 'editor') alEditor(f, b.querySelector('b'));
        else if (a === 'grabado') { L().marcarGrabado(f); est.tab = 'grabado'; est.hoja = null; pintar(); L().aviso('Listo: pasó a «Grabados».'); }
        else if (a === 'escribir') { est.hoja = null; pintar(); L().escribir(f); }
        else if (a === 'ficha') { est.hoja = null; L().abrirEscena(f.id, 0); }
        else if (a === 'piezas') hoja({ t: 'piezas' });
      };
    });
  }
  /* girar el celular o achicar la ventana cambia de pantalla */
  var alCambiar = function () { if (L() && visible()) pintar(); };
  if (CEL.addEventListener) CEL.addEventListener('change', alCambiar); else if (CEL.addListener) CEL.addListener(alCambiar);

  window.LabGuiones = {
    pintar: function () { if (L()) pintar(); },
    /* el Laboratorio avisa cada vez que repinta su ficha; si se está escribiendo aquí, se espera a que suelte el campo */
    repintar: function () {
      if (!visible()) return;
      /* (23-oct) con un desplegable de piezas abierto no se repinta: el Laboratorio repinta solo mientras trae el historial y
         se lo llevaba. Al escoger, el Laboratorio cierra el desplegable antes de repintar, y ahí sí pasa. */
      if (document.querySelector('#lg .menu')) return;
      var a = document.activeElement;
      if (a && a.closest && a.closest('#lg') && /^(TEXTAREA|INPUT)$/.test(a.tagName)) {
        a.addEventListener('blur', function una() { a.removeEventListener('blur', una); setTimeout(function () { if (visible()) pintar(); }, 0); });
        return;
      }
      pintar();
    },
    alCargar: function () { importar(); },
    abrirNuevo: function () { abrirWiz('inicio'); },
  };
})();

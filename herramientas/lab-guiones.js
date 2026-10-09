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
    if (irA) { var va = ps.filter(function (f) { return f.id === decodeURIComponent(irA); })[0]; if (va) { est.tab = tabDe(va); est.sel = va.id; irA = null; } }
    ps.forEach(function (f) { n[tabDe(f)]++; });
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
    atar(f);
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
    var g = f.guion || [], s = segundos(f), dur = Number(f.dur) || 0, t = tabDe(f);
    var total = g.reduce(function (a, x) { return a + palabras(x.dice); }, 0) || 1;
    var veredicto = !dur ? '' : s <= dur ? '<em class="ok">Cabe en ' + reloj(dur) + ' ✓</em>'
      : '<em class="mal">Te pasas por ' + (s - dur) + ' s</em>';
    return '<section class="lg-plan vol" aria-label="El guion abierto">' +
      '<div class="lg-p-cab">' +
        '<input class="lg-tit" id="lg-tit" value="' + esc(f.titulo || '') + '" placeholder="Ponle un título a este video" aria-label="Título del video">' +
        '<span class="lg-est ' + t + '"><i></i>' + { porGrabar: 'Por grabar', grabado: 'Grabado', publicado: 'Publicado' }[t] + '</span>' +
      '</div>' +
      '<div class="lg-p-acc">' +
        '<button type="button" class="lg-b" data-accion="escribir">✦ Que Cherry lo escriba</button>' +
        '<button type="button" class="lg-b" data-accion="ficha">Escena por escena · revisar ›</button>' +
        '<button type="button" class="lg-b" data-accion="tp">▶ Teleprompter</button>' +
        (t === 'porGrabar' ? '<button type="button" class="lg-b" data-accion="grabado">✓ Ya lo grabé</button>' : '') +
      '</div>' +
      '<div class="lg-piezas">' + L().PIEZAS.map(function (P) {
        var id = (f.piezas || {})[P.id], p = pieza(P.id, id);
        /* dentro de `.sel`: es donde el Laboratorio cuelga su desplegable y lo que no lo cierra al tocar */
        return '<div class="sel lg-sel"><button type="button" class="lg-pz" data-pieza="' + P.id + '" title="Escoger ' + esc(P.uno) + ' de tu baúl">' +
          '<span class="lg-etq">' + esc(P.uno) + '</span><b>' + (p ? esc(p.texto) : '<span class="lg-gris">Escoger…</span>') + '</b>' +
          (p ? lineaEstado(P.id, id) : '<span class="lg-e neu">' + esc(P.d) + '</span>') + '</button></div>';
      }).join('') + '</div>' +
      '<div class="lg-dur"><div class="lg-dur-f"><b>' + reloj(s) + '</b><span>' + (total > 1 ? total : 0) + ' palabras · al ritmo de los reels que retienen</span>' + veredicto + '</div>' +
        '<div class="lg-dur-b">' + g.map(function (x, i) {
          var w = palabras(x.dice) / total * 100;
          return w ? '<i style="width:' + w + '%" class="' + (i === 0 ? 'g' : /cta|cierre|remate/i.test(x.escena || '') ? 'c' : '') + '"></i>' : '';
        }).join('') + '</div></div>' +
      '<div class="lg-esc-cab"><span>#</span><span>Escena</span><span>Lo que dices</span><span>Lo que se ve</span>' +
        '<button type="button" class="lg-frases" data-accion="frases">Mis frases</button></div>' +
      '<div class="lg-escenas" id="lg-escenas">' + (g.length ? g.map(function (x, i) {
        var tr = '';
        try { tr = L().tramoDe(f, i); } catch (e) {}
        var u = x.vineta ? L().urlVineta(x.vineta) : '';
        return '<div class="lg-esc" data-i="' + i + '">' +
          '<span class="lg-n">' + (i + 1) + '</span>' +
          '<span class="lg-nom">' + esc(x.escena || 'Escena') + (tr ? '<small>' + esc(tr) + '</small>' : '') + '</span>' +
          '<textarea data-campo="dice" rows="2" placeholder="Lo que dices">' + esc(x.dice || '') + '</textarea>' +
          '<textarea data-campo="ve" rows="2" placeholder="' + esc(x.veCherry ? 'Cherry lo imaginó: ' + x.veCherry : 'Lo que se ve (en blanco, Cherry lo imagina)') + '">' + esc(x.ve || '') + '</textarea>' +
          '<button type="button" class="lg-v" data-escena="' + i + '" title="Escena por escena: mejorarla, escribirla con Cherry o dibujarla">' +
            (u ? '<img src="' + esc(u) + '" alt="">' : '<span>✦</span>') + '</button></div>';
      }).join('') : '<p class="lg-vacio">Escoge una estructura arriba: de ahí salen las escenas.</p>') + '</div>' +
    '</section>';
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
    c.querySelectorAll('.lg-esc textarea').forEach(function (t) {
      var i = Number(t.closest('.lg-esc').dataset.i), campo = t.dataset.campo;
      t.oninput = function () { if (!f.guion[i]) return; f.guion[i][campo] = t.value; f.auditoria = null; guardarLuego(); medir(f); };
      t.onfocus = function () { est.ultimo = t; };
      t.onblur = guardarYa;
    });
    c.querySelectorAll('[data-escena]').forEach(function (b) { b.onclick = function () { guardarYa(); L().abrirEscena(f.id, Number(b.dataset.escena)); }; });
    c.querySelectorAll('[data-ver-sb]').forEach(function (b) { b.onclick = function () { guardarYa(); L().verStoryboard(f); }; });
    var dib = $('lg-dibujar');
    if (dib) dib.onclick = function () { guardarYa(); L().dibujar(f, 'lg-dibujar', function () { pintar(); }); };
    c.querySelectorAll('[data-accion]').forEach(function (b) {
      var a = b.dataset.accion;
      if (a === 'escribir') b.onclick = function () { guardarYa(); L().escribir(f); };
      if (a === 'ficha') b.onclick = function () { guardarYa(); L().abrirEscena(f.id, 0); };
      if (a === 'tp') b.onclick = function () { guardarYa(); abrirTP(f, b); };
      if (a === 'grabado') b.onclick = function () { guardarYa(); L().marcarGrabado(f); est.tab = 'grabado'; est.sel = f.id; pintar(); };
      if (a === 'editor') b.onclick = function () { guardarYa(); alEditor(f, b); };
      if (a === 'frases') b.onclick = function (e) { e.stopPropagation(); abrirFrases(b, f); };
    });
  }

  /* mientras se escribe solo cambia la barra de duración: repintar todo se llevaría el cursor */
  function medir(f) {
    var c = $('lg'); if (!c) return;
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
          var t = est.ultimo && document.contains(est.ultimo) ? est.ultimo : document.querySelector('.lg-esc textarea');
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
  function abrirWiz(paso) { est.wiz = { paso: paso, idea: null, desde: null, plantilla: null }; pintarWiz(); }
  function cerrarWiz() { est.wiz = null; var v = $('lg-wiz'); if (v) v.remove(); }
  function crearPlan(piezas, cambia) {
    var f = cambia ? L().planConPiezas(piezas, cambia) : L().planDesdeOrden(null, piezas || {}, '', []);
    est.tab = 'porGrabar'; est.sel = f.id; L().elegirPlan(f.id);
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

  window.LabGuiones = {
    pintar: function () { if (L()) pintar(); },
    /* el Laboratorio avisa cada vez que repinta su ficha; si se está escribiendo aquí, se espera a que suelte el campo */
    repintar: function () {
      if (!visible()) return;
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

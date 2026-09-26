/* lab-ficha.js — «Mis videos» y la ficha de cada video del Laboratorio (26-sep-2026)
 *
 * Aprobado por Sergio (artefacto APEdQWYEAaR19jCf3a8ftG, v5): estilo neón de SUS referencias (negro, el rosa de
 * Cherry encendido, números gigantes, personas, líneas de flujo, árbol de decisión), interactivo, y TODO en una sola
 * pantalla con un menú. La ficha le dice a la persona exactamente qué grabar con las cuatro piezas (idea, gancho,
 * estructura, formato): cuál mantener y cuál cambiar, por qué, y qué hacer según salga.
 *
 * El video se ata SOLO con el plan que se armó en el Laboratorio (laboratorio.html › conPlanes): no se pide
 * desmontar lo que ya se planeó. «Desmontar» solo aparece si el video no se planeó en Cherry.
 *
 * ⚠️ Mientras Meta revisa los permisos: «Mis videos» → «Publicados» → tocar un video → sus números es el camino del
 * revisor. Los nombres y ese orden no se cambian hasta la aprobación.
 *
 * Lo usa laboratorio.html a través de window.LabAPI. Todo lo visible vive bajo `.lf` (lab-ficha.css).
 */
(function () {
  'use strict';
  var A = function () { return window.LabAPI; };

  /* ── Utilidades ── */
  function num(x) { var v = Number(x); return isFinite(v) ? v : 0; }
  function n(x, d) { x = Number(x); if (!isFinite(x)) return '—'; return x.toLocaleString('es-CO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function pct(x) { return n(x, 1) + ' %'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dias(f) { var t = Date.parse(f); return isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 864e5)) : 0; }
  function cuando(f) {
    var d = dias(f);
    if (d <= 0) return 'hoy'; if (d === 1) return 'ayer'; if (d < 30) return 'hace ' + d + ' días';
    if (d < 365) { var m = Math.max(1, Math.round(d / 30.4)); return 'hace ' + m + (m === 1 ? ' mes' : ' meses'); }
    var a = Math.floor(d / 365); return 'hace ' + a + (a === 1 ? ' año' : ' años');
  }
  function mediana(xs) {
    xs = xs.filter(function (x) { return isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    var h = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[h] : (xs[h - 1] + xs[h]) / 2;
  }
  function icono(d, cls) { return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var I = {
    corazon: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z',
    globo: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.4A8 8 0 1121 12z',
    guardar: 'M6 3h12v18l-6-4-6 4z',
    compartir: 'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13',
    ojo: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    copa: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3',
    estrella: 'M12 2l2.4 5 5.6.8-4 3.9.9 5.6L12 14.8 7.1 17.3l.9-5.6-4-3.9 5.6-.8z',
    mensaje: 'M4 4h16v12H7l-3 3z',
    mano: 'M9 11V6a3 3 0 016 0v5M5 11h14l-1.5 10h-11z',
    enlace: 'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
    iman: 'M6 3v8a6 6 0 0012 0V3M6 3h3v8a3 3 0 006 0V3h3M6 7h3M15 7h3',
  };

  /* ── Los datos: los reels con sus números, y la media de los 15 anteriores ── */
  function todos() { var a = A(); return a ? a.videosDeCuenta() : []; }
  function esReel(v) { return v && v.retencion != null && num(v.dur) > 0 && num(v.alcance) > 0; }
  function reels() { return todos().filter(esReel); }
  function mediasDe(lista) {
    var m = function (f) { return mediana(lista.map(f)); };
    var alc = function (x) { return num(x.alcance) || NaN; };
    return {
      n: lista.length,
      ret: m(function (x) { return num(x.retencion); }),
      omi: m(function (x) { return x.omisiones != null ? num(x.omisiones) : NaN; }),
      vis: m(function (x) { return num(x.visitas); }),
      alc: m(function (x) { return num(x.alcance); }),
      vale: m(function (x) { return (num(x.guardados) + num(x.reposts)) / alc(x) * 100; }),
      com: m(function (x) { return num(x.comentarios) / alc(x) * 100; }),
      mg: m(function (x) { return num(x.meGusta) / alc(x) * 100; }),
      gua: m(function (x) { return num(x.guardados) / alc(x) * 100; }),
      comp: m(function (x) { return num(x.reposts) / alc(x) * 100; }),
      rep: m(function (x) { return num(x.visitas) / alc(x); }),
    };
  }
  // la media de los 15 reels ANTERIORES a este (si no hay suficientes, los 15 más recientes sin él)
  function medias(v) {
    var rs = reels(), i = -1;
    rs.forEach(function (x, k) { if (x.id === v.id) i = k; });
    var prev = i >= 0 ? rs.slice(i + 1, i + 16) : rs.slice(0, 15);
    if (prev.length < 5) prev = rs.filter(function (x) { return x.id !== v.id; }).slice(0, 15);
    return mediasDe(prev);
  }
  function cifras(v) {
    var alc = num(v.alcance) || 1, dur = num(v.dur);
    var ret = num(v.retencion);
    return {
      ret: ret, omi: v.omisiones != null ? num(v.omisiones) : null, vis: num(v.visitas), alc: num(v.alcance), dur: dur,
      vm: v.vistoMedio != null ? num(v.vistoMedio) : ret * dur / 100,
      mg: num(v.meGusta), com: num(v.comentarios), gua: num(v.guardados), comp: num(v.reposts),
      horas: v.horas != null ? num(v.horas) : null,
      vale: (num(v.guardados) + num(v.reposts)) / alc * 100,
      p100: function (x) { return num(x) / alc * 100; },
    };
  }
  function veredictoDe(ret, med) { return med == null ? 'igual' : ret >= med + 1.5 ? 'mejor' : ret <= med - 1.5 ? 'peor' : 'igual'; }
  var ETQ = { mejor: '▲ mejor que tu media', igual: '● en tu media', peor: '▼ por debajo' };

  /* ═════════════ La lista: «Mis videos» ═════════════ */
  var est = { tab: 'pub', orden: 'rec' };
  function lista(caja) {
    var carr = caja.querySelectorAll('.carril');
    if (carr.length < 3) return;
    var vs = todos(), rs = reels();
    var ult15 = mediasDe(rs.slice(0, 15));
    var nPor = carr[0].querySelectorAll('.tj').length, nGra = carr[1].querySelectorAll('.tj').length;

    var w = document.createElement('div');
    w.className = 'lf lf-lista';
    // el resumen de los últimos 15
    var u16 = rs.slice(0, 16).reverse();
    var racha = '';
    if (rs.length >= 3) {
      var W = 220, H = 44, lo = Math.min.apply(null, u16.map(function (x) { return num(x.retencion); })) - 2, hi = Math.max.apply(null, u16.map(function (x) { return num(x.retencion); })) + 2;
      var px = function (i) { return 4 + i * ((W - 8) / Math.max(1, u16.length - 1)); }, py = function (v) { return H - 4 - (v - lo) / Math.max(1, hi - lo) * (H - 8); };
      var linea = u16.map(function (x, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ',' + py(num(x.retencion)).toFixed(1); }).join('');
      var mejor = rs.slice().sort(function (a, b) { return num(b.retencion) - num(a.retencion); })[0];
      racha = '<div class="racha">' +
        '<div><span class="k">Retención · tus últimos ' + Math.min(15, rs.length) + ' reels</span><span class="v">' + pct(ult15.ret) + '</span>' +
          '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="' + W + '" y1="' + py(ult15.ret).toFixed(1) + '" y2="' + py(ult15.ret).toFixed(1) + '" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 4"/>' +
          '<path d="' + linea + '" fill="none" stroke="#FF2D8A" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="' + px(u16.length - 1) + '" cy="' + py(num(u16[u16.length - 1].retencion)) + '" r="3.5" fill="#FF2D8A"/></svg>' +
          '<span class="s">La línea punteada es tu media; el punto, el último video.</span></div>' +
        '<div><span class="k">Se lo saltan</span><span class="v">' + (ult15.omi != null ? pct(ult15.omi) : '—') + '</span><span class="s">lo pasan sin verlo</span></div>' +
        '<div><span class="k">Vistas</span><span class="v">' + n(ult15.vis) + '</span><span class="s">en un video típico</span></div>' +
        '<div><span class="k">Lo guardan o comparten</span><span class="v">' + n(ult15.vale, 1) + '</span><span class="s">de cada 100 personas</span></div>' +
        '<div><span class="k">Tu mejor video</span><span class="v">' + pct(mejor.retencion) + '</span><span class="s">' + esc(String(mejor.titulo || '').slice(0, 44)) + '</span></div></div>';
    }
    w.innerHTML =
      '<div class="pestanas" role="tablist">' +
        '<button type="button" class="pest" data-tab="pub">Publicados<b>' + vs.length + '</b></button>' +
        '<button type="button" class="pest" data-tab="gra">Grabados, sin publicar<b>' + nGra + '</b></button>' +
        '<button type="button" class="pest" data-tab="por">Por grabar<b>' + nPor + '</b></button></div>' +
      '<div class="lf-pub">' + racha +
        '<div class="orden"><span>Ordenar</span>' +
          '<button type="button" class="chip" data-orden="rec">Recientes</button><button type="button" class="chip" data-orden="ret">Mejor retención</button><button type="button" class="chip" data-orden="vis">Más vistas</button>' +
          '<div class="leyenda"><span><i style="background:#6ED49C"></i>mejor que tu media</span><span><i style="background:#E9E0E4"></i>en tu media</span><span><i style="background:#FF2D8A"></i>por debajo</span></div></div>' +
        '<div class="rejilla"></div>' +
        (vs.length ? '' : '<p class="vacio-l">Todavía no hay publicaciones. Cuando conectes Instagram, aparecen aquí solas con sus números.</p>') +
      '</div><div class="lf-gra"></div><div class="lf-por"></div>';
    w.querySelector('.lf-gra').appendChild(carr[1]);
    w.querySelector('.lf-por').appendChild(carr[0]);
    caja.innerHTML = '';
    caja.appendChild(w);

    function pintarRejilla() {
      var orden = vs.slice();
      if (est.orden === 'ret') orden.sort(function (a, b) { return (esReel(b) ? num(b.retencion) : -1) - (esReel(a) ? num(a.retencion) : -1); });
      if (est.orden === 'vis') orden.sort(function (a, b) { return num(b.visitas) - num(a.visitas); });
      w.querySelector('.rejilla').innerHTML = orden.map(function (v) {
        var tapa = v.tapa || (v.desmontaje && v.desmontaje.portada) || '';
        if (!esReel(v)) {
          return '<button type="button" class="vid carr" data-v="' + esc(v.id) + '"><div class="foto">' + (tapa ? '<img alt="" loading="lazy" src="' + esc(tapa) + '" onerror="this.remove()">' : '<p>' + esc(String(v.titulo || '').slice(0, 90)) + '</p>') +
            '<span class="pill igual">Publicación</span><div class="gran"><b>' + n(v.visitas) + '</b><span>vistas</span></div></div>' +
            '<span class="meta">' + cuando(v.fecha) + (num(v.alcance) ? ' · ' + n((num(v.guardados) + num(v.reposts)) / num(v.alcance) * 100, 1) + ' de cada 100 lo guardan' : '') + '</span></button>';
        }
        var vd = veredictoDe(num(v.retencion), ult15.ret);
        return '<button type="button" class="vid" data-v="' + esc(v.id) + '"><div class="foto">' + (tapa ? '<img alt="" loading="lazy" src="' + esc(tapa) + '" onerror="this.remove()">' : '') +
          '<span class="pill ' + vd + '">' + ETQ[vd] + '</span><div class="gran"><b>' + pct(v.retencion) + '</b><span>retención</span></div></div>' +
          '<h4>' + esc(v.titulo || 'Sin texto') + '</h4><span class="meta">' + cuando(v.fecha) + ' · ' + n(v.visitas) + ' vistas</span></button>';
      }).join('');
      w.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-orden') === est.orden); });
      w.querySelectorAll('.vid').forEach(function (b) { b.onclick = function () { A().abrirVideo(b.getAttribute('data-v')); }; });
    }
    function pestana(t) {
      est.tab = t;
      w.querySelectorAll('.pest').forEach(function (p) { var on = p.getAttribute('data-tab') === t; p.classList.toggle('on', on); p.setAttribute('aria-selected', on ? 'true' : 'false'); });
      w.querySelector('.lf-pub').hidden = t !== 'pub';
      w.querySelector('.lf-gra').hidden = t !== 'gra';
      w.querySelector('.lf-por').hidden = t !== 'por';
    }
    w.querySelectorAll('.pest').forEach(function (p) { p.onclick = function () { pestana(p.getAttribute('data-tab')); }; });
    w.querySelectorAll('.chip').forEach(function (c) { c.onclick = function () { est.orden = c.getAttribute('data-orden'); pintarRejilla(); }; });
    pintarRejilla();
    pestana(est.tab);
  }

  /* ═════════════ La orden: qué grabar después ═════════════ */
  var TIPOS = ['idea', 'gancho', 'estructura', 'formato'];
  var NOMBRE = { idea: 'Idea', gancho: 'Gancho', estructura: 'Estructura', formato: 'Formato' };
  var GENERO = { idea: 'a', gancho: 'o', estructura: 'a', formato: 'o' };
  // lo que se sugiere cuando el baúl no tiene otra pieza de ese tipo (formatos y ganchos del criterio de Sergio)
  var CATALOGO = {
    formato: ['Pantalla dividida', 'Podcast', 'VS', 'Top', 'Storytelling', 'A cámara', 'B-roll', 'Entrevista', 'Pantalla verde', 'Dinámico'],
    gancho: ['Contradicción', 'Pregunta', 'Generar curiosidad', 'La contra', 'Dato imposible'],
    estructura: [], idea: [],
  };
  function piezaTxt(tipo, id) { var p = id ? A().piezaPorId(tipo, id) : null; return p ? String(p.texto || '').trim() : ''; }
  // cuántas veces se usó una pieza y en cuántas pasó la media de ese momento
  function estadoPieza(tipo, id) {
    var usos = todos().filter(function (x) { return esReel(x) && x.piezas && x.piezas[tipo] === id; });
    var ok = usos.filter(function (x) { var m = medias(x).ret; return m != null && num(x.retencion) >= m; });
    var e = !usos.length ? 'nueva' : (usos.length >= 2 && ok.length === usos.length) ? 'magnetica' : ok.length ? 'media' : 'inerte';
    var txt = e === 'nueva' ? 'sin probar' : e === 'magnetica' ? 'magnético' + (GENERO[tipo] === 'a' ? 'a' : '') + ' · ' + ok.length + ' de ' + usos.length
      : ok.length + ' de ' + usos.length + (usos.length === 1 ? ' · funcionó 1 vez' : ' · sin confirmar');
    if (e === 'inerte') txt = 'no funcionó · ' + ok.length + ' de ' + usos.length;
    if (e === 'media' && usos.length === 1) txt = 'funcionó 1 vez';
    return { e: e, n: usos.length, ok: ok.length, usos: usos, txt: txt };
  }
  function sugerencia(tipo, actual) {
    var a = A(), D = a.D();
    var mias = (D.piezas && D.piezas[tipo] || []).filter(function (p) { return p.cuenta === D.activa && p.id !== actual; });
    var rango = { magnetica: 3, media: 2, nueva: 1, inerte: 0 };
    var mejor = mias.map(function (p) { return { p: p, s: estadoPieza(tipo, p.id) }; })
      .filter(function (x) { return x.s.e !== 'inerte'; })
      .sort(function (x, y) { return rango[y.s.e] - rango[x.s.e]; })[0];
    if (mejor) return { id: mejor.p.id, texto: mejor.p.texto, de: 'tu baúl' };
    var ya = piezaTxt(tipo, actual).toLowerCase();
    var cat = (CATALOGO[tipo] || []).filter(function (t) { return t.toLowerCase() !== ya; })[0];
    return cat ? { id: null, texto: cat, de: 'nuevo' } : { id: null, texto: tipo === 'idea' ? 'una idea nueva' : 'otra distinta', de: 'nuevo' };
  }
  function ordenDe(v, M, c) {
    var pz = v.piezas || null;
    var tiene = pz && TIPOS.some(function (t) { return pz[t]; });
    if (!tiene) return { desmontar: true };
    var st = {}; TIPOS.forEach(function (t) { st[t] = pz[t] ? estadoPieza(t, pz[t]) : { e: 'falta', n: 0, ok: 0, usos: [], txt: 'sin escoger' }; });
    var skipMal = c.omi != null && M.omi != null && c.omi > M.omi + 2;
    var mal = M.ret != null && c.ret <= M.ret - 1.5;
    var bien = M.ret != null && c.ret >= M.ret + 1.5;
    var valeMal = M.vale != null && c.vale < M.vale * 0.8;
    var arbol = { q2: skipMal, q3: !skipMal && mal, q4: !skipMal && !mal && !valeMal };
    var o = { st: st, piezas: pz, arbol: arbol };
    if (skipMal) {
      o.cambia = 'gancho'; o.titulo = 'Graba todo igual y cambia el gancho';
      o.porque = n(c.omi, 0) + ' de cada 100 lo saltaron al instante, más que en tus videos (' + n(M.omi, 0) + '). Casi nadie vio el resto: la idea no falló, no la vieron.';
      o.si = 'Era el gancho: el nuevo se queda y lo demás se vuelve a juzgar.'; o.no = 'El gancho no era el problema: el siguiente paso es la estructura.';
    } else if (mal) {
      o.cambia = 'estructura'; o.titulo = 'Misma idea, gancho y formato; otra estructura';
      o.porque = 'Entraron, pero se fueron antes de tiempo: vieron ' + n(c.vm, 0) + ' de ' + n(c.dur, 0) + ' segundos. Cambia el orden en que lo cuentas.';
      o.si = 'Era la estructura: la nueva se queda.'; o.no = 'La estructura no era: el siguiente paso es la idea.';
    } else if (valeMal && !bien) {
      o.cambia = 'idea'; o.titulo = 'Mismo gancho, estructura y formato; otra idea';
      o.porque = 'Lo vieron, pero casi nadie lo guardó ni lo compartió (' + n(c.vale, 1) + ' de cada 100). La forma funciona; la idea no les sirvió.';
      o.si = 'Era la idea: la fórmula funciona, cambia solo de qué hablas.'; o.no = 'Al tema no le interesa a esta audiencia: prueba otro.';
    } else {
      var aConfirmar = TIPOS.filter(function (t) { return pz[t] && st[t].e !== 'magnetica'; })[0];
      var orden = ['formato', 'estructura', 'gancho', 'idea'];
      var cambia = orden.filter(function (t) { return t !== aConfirmar && pz[t] && st[t].e !== 'magnetica'; })[0];
      if (!aConfirmar) { o.cambia = 'idea'; o.titulo = 'Repite la fórmula con una idea nueva'; o.porque = 'Las cuatro piezas ya están confirmadas: tienes tu fórmula. Cambia solo de qué hablas.'; o.si = 'La fórmula sigue funcionando.'; o.no = 'Revisa si la idea nueva estaba en tu zona segura.'; }
      else {
        if (!cambia) cambia = orden.filter(function (t) { return t !== aConfirmar; })[0];
        o.cambia = cambia; o.confirma = aConfirmar;
        o.titulo = 'Graba la misma ' + NOMBRE[aConfirmar].toLowerCase().replace(/^(idea|estructura)$/, '$1') + ' con otr' + GENERO[cambia] + ' ' + NOMBRE[cambia].toLowerCase();
        if (GENERO[aConfirmar] === 'o') o.titulo = 'Graba el mismo ' + NOMBRE[aConfirmar].toLowerCase() + ' con otr' + GENERO[cambia] + ' ' + NOMBRE[cambia].toLowerCase();
        o.porque = (bien ? 'Le fue bien' : 'Le fue como siempre') + '. Est' + GENERO[aConfirmar] + ' ' + NOMBRE[aConfirmar].toLowerCase() + ' ' + (st[aConfirmar].n <= 1 ? 'funcionó una vez' : 'todavía no está confirmad' + GENERO[aConfirmar]) +
          ': para confirmarl' + GENERO[aConfirmar] + ' se graba igual y se cambia <b>una sola</b> pieza.';
        o.si = 'Si pasa tu media (' + pct(M.ret) + '): ' + NOMBRE[aConfirmar].toLowerCase() + ' queda magnétic' + GENERO[aConfirmar] + '. Repítel' + GENERO[aConfirmar] + ' cuando quieras.';
        o.no = 'Lo que retenía era ' + (GENERO[cambia] === 'a' ? 'la ' : 'el ') + NOMBRE[cambia].toLowerCase() + ' «' + piezaTxt(cambia, pz[cambia]) + '». Se vuelve a probar con él.';
      }
    }
    o.sug = sugerencia(o.cambia, pz[o.cambia]);
    return o;
  }

  /* ═════════════ La ficha de un video ═════════════ */
  var pan = 0;
  var fichaDe = '';
  function ficha(caja, v) {
    if (fichaDe !== v.id) { pan = 0; fichaDe = v.id; }
    var a = A(), M = medias(v), c = cifras(v), reel = esReel(v);
    var plan = v.plan ? a.planPorId(v.plan) : null;
    var tapa = v.tapa || (v.desmontaje && v.desmontaje.portada) || '';
    var rs = reels(), idx = -1; rs.forEach(function (x, k) { if (x.id === v.id) idx = k; });
    var u16 = (idx >= 0 ? rs.slice(idx, idx + 16) : rs.slice(0, 16)).reverse();   // del más viejo a este
    var puesto = u16.slice().sort(function (x, y) { return num(y.retencion) - num(x.retencion); }).map(function (x) { return x.id; }).indexOf(v.id) + 1;
    var quedan = c.omi != null ? 100 - Math.round(c.omi) : null;
    var vd = reel ? veredictoDe(c.ret, M.ret) : 'igual';

    var chips = '';
    if (plan) {
      var g = plan.guion || [];
      chips = '<div class="plan-chips"><span class="pc ok">✓ Planeado en el Laboratorio</span><span class="pc">Idea, gancho, estructura y formato</span>' +
        (g.some(function (e) { return e.dice; }) ? '<span class="pc">Guion</span>' : '') +
        (g.some(function (e) { return e.vineta; }) ? '<span class="pc">Storyboard</span>' : '') +
        (plan.vinculadoSolo ? '<span class="pc link">Se vinculó solo al publicarlo</span>' : '') + '</div>';
    }
    var cab = '<div class="ficha-cab">' + (tapa ? '<img alt="" src="' + esc(tapa) + '" onerror="this.remove()">' : '<span class="sin-tapa"></span>') +
      '<div><div class="ceja">' + (reel ? 'Reel' : 'Publicación') + ' · ' + cuando(v.fecha) + (c.dur ? ' · ' + n(c.dur, 0) + ' s' : '') + '</div>' +
      '<h2>' + esc(String(v.texto || v.titulo || 'Sin texto').replace(/\s+/g, ' ').slice(0, 110)) + '</h2>' +
      '<div class="meta">' + (c.horas != null ? 'Medido a las ' + n(c.horas, 0) + ' horas de publicado' : '') + '</div>' + chips + '</div>' +
      '<div class="cab-acc"><button type="button" class="btn-l" data-cerrar>‹ Mis videos</button>' + (v.enlace ? '<a class="btn-l" href="' + esc(v.enlace) + '" target="_blank" rel="noopener">Ver en Instagram ↗</a>' : '') + '</div></div>';

    var P = [];
    if (reel) {
      P.push(['Veredicto', I.estrella, panVeredicto(v, M, c, u16, puesto, vd)]);
      P.push(['Recorrido', 'M3 12h4l3-8 4 16 3-8h4', panRecorrido(v, M, c, quedan)]);
    }
    P.push(['Respuestas', I.globo, '<div class="neon-sec" data-cta><div class="neon-cab"><span class="ceja-n">Tu llamada a la acción · respuestas automáticas</span><h3 class="neon-h">Lo que consiguieron tus respuestas</h3></div><p class="cargando-l">Cargando…</p></div>']);
    if (reel) {
      var o = ordenDe(v, M, c);
      P.push(['Próximo video', 'M5 3l14 9-14 9z', panProximo(v, M, c, o)]);
      P.push(['Por qué', 'M5 4h5v5H5zM14 15h5v5h-5zM7.5 9v4a2 2 0 002 2H14', panPorQue(v, M, c, o, puesto)]);
      P.push(['Tendencia', 'M3 17l6-6 4 4 8-8M15 7h6v6', panTendencia(v, M, c, u16)]);
    }
    P.push(['Números', 'M4 20V10M10 20V4M16 20v-8M2 20h20', panNumeros(v, M, c, quedan, puesto, u16, reel)]);
    if (pan >= P.length) pan = 0;

    caja.innerHTML = '<section class="lf lf-ficha">' + cab +
      '<nav class="fnav" aria-label="Partes de la ficha"><button type="button" class="fn-flecha" data-d="-1" aria-label="Anterior">‹</button><div class="fn-tabs" role="tablist">' +
      P.map(function (p, i) { return '<button type="button" role="tab" class="fn-tab" data-i="' + i + '">' + icono(p[1]) + '<span>' + p[0] + '</span></button>'; }).join('') +
      '</div><span class="fn-cont"></span><button type="button" class="fn-flecha" data-d="1" aria-label="Siguiente">›</button><div class="fn-prog"><i></i></div></nav>' +
      '<div class="fzona">' + P.map(function (p, i) {
        return '<div class="fpanel" data-p="' + i + '" role="tabpanel">' + p[2] +
          (i < P.length - 1 ? '<button type="button" class="fn-sig" data-ir="' + (i + 1) + '">Siguiente: ' + P[i + 1][0] + ' <b>→</b></button>' : '') + '</div>';
      }).join('') + '</div>' +
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><filter id="lfBrillo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<pattern id="lfRayas" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgba(255,255,255,.04)"/><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,45,138,.35)" stroke-width="3"/></pattern>' +
      '<linearGradient id="lfArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF2D8A" stop-opacity=".45"/><stop offset="1" stop-color="#FF2D8A" stop-opacity="0"/></linearGradient></defs></svg></section>';

    var raiz = caja.querySelector('.lf-ficha');
    raiz.querySelector('[data-cerrar]').onclick = function () { a.cerrarVideo(); };
    navegacion(raiz, P.length);
    if (reel) { interaccionProximo(raiz, v, o); puntosQueSeTocan(raiz, u16); }
    raiz.querySelectorAll('[data-curva]').forEach(function (b) { b.onclick = function () { a.medirDeNuevo(v.id); }; });
    raiz.querySelectorAll('[data-desmontar]').forEach(function (b) {
      b.onclick = function () {
        a.ver('v3');
        var dur = document.getElementById('des-dur');   // la duración ya se sabe: no se la pedimos
        if (dur && !dur.value && c.dur) dur.value = Math.round(c.dur);
      };
    });
    cargarRespuestas(raiz, v, c);
  }

  /* ── Veredicto ── */
  function panVeredicto(v, M, c, u16, puesto, vd) {
    var sello = vd === 'mejor' ? '<span class="sello mejor">Retuvo más que tu media</span>' : vd === 'peor' ? '<span class="sello peor">Retuvo menos que tu media</span>' : '<span class="sello igual">Retuvo como siempre</span>';
    var BW = 560, BH = 150, maxR = Math.max.apply(null, u16.map(function (x) { return num(x.retencion); }).concat([M.ret || 0])) + 3, bw = (BW - 20) / Math.max(1, u16.length);
    var yMed = BH - 22 - (num(M.ret) / maxR) * (BH - 34);
    var barras = '<svg viewBox="0 0 ' + BW + ' ' + BH + '" role="img" aria-label="Retención de tus últimos reels">' +
      u16.map(function (x, i) {
        var h = (num(x.retencion) / maxR) * (BH - 34), X = 10 + i * bw + 3, Y = BH - 22 - h, yo = x.id === v.id;
        return '<rect class="rb" data-i="' + i + '" x="' + X.toFixed(1) + '" y="' + Y.toFixed(1) + '" width="' + Math.max(2, bw - 6).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" fill="' + (yo ? '#FF2D8A' : 'rgba(255,255,255,.16)') + '"/>' +
          (yo ? '<text x="' + (X + (bw - 6) / 2).toFixed(1) + '" y="' + (Y - 6).toFixed(1) + '" text-anchor="middle" fill="#F4ECE7" font-family="Outfit" font-weight="800" font-size="13">' + n(x.retencion, 1) + '</text>' : '');
      }).join('') +
      (M.ret != null ? '<line x1="8" x2="' + (BW - 8) + '" y1="' + yMed.toFixed(1) + '" y2="' + yMed.toFixed(1) + '" stroke="rgba(244,236,231,.55)" stroke-dasharray="4 4"/><text x="12" y="' + (yMed - 6).toFixed(1) + '" fill="rgba(244,236,231,.66)" font-family="DM Mono" font-size="11">tu media ' + n(M.ret, 1) + ' %</text>' : '') +
      '<text x="10" y="' + (BH - 5) + '" fill="rgba(244,236,231,.42)" font-family="DM Mono" font-size="11">' + (u16.length ? cuando(u16[0].fecha) : '') + '</text>' +
      '<text x="' + (BW - 10) + '" y="' + (BH - 5) + '" text-anchor="end" fill="rgba(244,236,231,.42)" font-family="DM Mono" font-size="11">' + cuando(v.fecha) + '</text></svg>';
    var nota = (c.horas != null && c.horas < 48)
      ? '<p class="nota">Llegó a ' + n(c.alc) + ' personas' + (M.alc ? (c.alc < M.alc ? ', menos que tu video típico (' + n(M.alc) + ')' : ', más que tu video típico (' + n(M.alc) + ')') : '') + ', pero lleva ' + n(c.horas, 0) + ' horas: Instagram asienta los números a las 48. Cherry lo vuelve a medir solo.</p>' : '';
    return '<div class="veredicto"><div>' + sello +
      '<div class="grande"><b>' + pct(c.ret) + '</b><span>de retención<br>contra <b>' + pct(M.ret) + '</b> de tus ' + M.n + ' anteriores</span></div>' +
      '<p class="suave">La gente vio en promedio <b>' + n(c.vm, 0) + ' de sus ' + n(c.dur, 0) + ' segundos</b>. Es el <b>' + puesto + '.º de tus últimos ' + u16.length + '</b> reels.</p>' + nota +
      '</div><div class="ranking"><span class="ceja">Retención de tus últimos ' + u16.length + ' reels</span>' + barras +
      '<div class="pie"><span>Cada barra es un reel, del más viejo al más nuevo. Tócala para ver cuál es.</span><span>Rosa: este.</span></div><div class="tend-tip" hidden></div></div></div>' +
      lineaVideo(c) +
      '<div class="curva"><p><b>¿En qué segundo exacto se van?</b> Instagram no lo da por su conexión. Sube la captura de la curva de retención y Cherry te lo marca en esta línea.</p><button type="button" class="btn-r" data-curva>Registrar la curva</button></div>';
  }
  function lineaVideo(c) {
    var W = 1100, H = 96, x = function (s) { return 20 + s / Math.max(1, c.dur) * (W - 40); }, s = '';
    for (var t = 0; t <= c.dur; t += (c.dur > 90 ? 15 : 10)) s += '<text x="' + x(t).toFixed(1) + '" y="72" text-anchor="middle" fill="rgba(244,236,231,.35)" font-family="DM Mono" font-size="10">' + t + ' s</text>';
    return '<svg class="curva-vis" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<rect x="20" y="38" width="' + (W - 40) + '" height="14" rx="7" fill="rgba(255,255,255,.07)"/>' +
      '<rect x="20" y="38" width="' + Math.max(0, x(c.vm) - 20).toFixed(1) + '" height="14" rx="7" fill="#FF2D8A" filter="url(#lfBrillo)"/>' +
      '<rect x="' + x(c.vm).toFixed(1) + '" y="38" width="' + Math.max(0, W - 20 - x(c.vm)).toFixed(1) + '" height="14" rx="7" fill="url(#lfRayas)"/>' + s +
      '<line x1="' + x(c.vm).toFixed(1) + '" x2="' + x(c.vm).toFixed(1) + '" y1="18" y2="58" stroke="#F4ECE7" stroke-width="2"/>' +
      '<text x="' + Math.min(W - 330, x(c.vm) + 8).toFixed(1) + '" y="26" fill="#F4ECE7" font-family="Space Grotesk" font-weight="600" font-size="13">en promedio llegan hasta el segundo ' + n(c.vm, 0) + '</text></svg>';
  }

  /* ── Recorrido ── */
  function cmp(v, med, menosMejor, fmt, umbral) {
    if (med == null) return '';
    var dif = v - med, tol = umbral == null ? Math.abs(med) * 0.06 : umbral;
    var k = Math.abs(dif) <= tol ? 'igual' : ((dif > 0) !== !!menosMejor ? 'mejor' : 'peor');
    return '<span class="cmp ' + k + '">' + { mejor: '▲ ', peor: '▼ ', igual: '● ' }[k] + 'tu media ' + fmt(med) + '</span>';
  }
  function panRecorrido(v, M, c, quedan) {
    var semilla = 7, azar = function () { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
    var cards = '<div><h3 class="h3-l">Dónde se fue la gente</h3><div class="recorrido">' +
      '<div class="est"><span class="n">1 · LLEGARON</span><span class="v">' + n(c.alc) + '</span><span class="d">personas lo vieron pasar, ' + n(c.vis) + ' veces en total</span>' + cmp(c.alc, M.alc, false, function (x) { return n(x); }) + '</div>' +
      (quedan != null ? '<div class="est fuga"><span class="tag">aquí se va más gente</span><span class="n">2 · SE QUEDARON</span><span class="v">' + quedan + ' de 100</span><div class="barra-p"><i style="width:' + quedan + '%"></i></div><span class="d">' + (100 - quedan) + ' de cada 100 lo saltaron al instante</span>' + cmp(c.omi, M.omi, true, function (x) { return pct(x) + ' lo saltan'; }, 1.5) + '</div>' : '') +
      '<div class="est"><span class="n">3 · LO VIERON</span><span class="v">' + n(c.vm, 0) + ' s</span><div class="barra-p"><i style="width:' + Math.min(100, c.ret) + '%"></i></div><span class="d">en promedio, de ' + n(c.dur, 0) + ' segundos</span>' + cmp(c.ret, M.ret, false, pct, 1.5) + '</div>' +
      '<div class="est"><span class="n">4 · LE SIRVIÓ</span><span class="v">' + n(c.vale, 1) + '</span><span class="d">de cada 100 lo guardaron o compartieron</span>' + cmp(c.vale, M.vale, false, function (x) { return n(x, 1); }) + '</div>' +
      '</div></div>';
    if (quedan == null) return cards;
    var W = 1100, H = 300, qued = Math.round(c.alc * quedan / 100), vale = c.gua + c.comp, s = '<svg class="vivo" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Así pasó la gente por el video">';
    for (var i = 0; i < 100; i++) s += '<circle cx="' + (40 + (i % 10) * 27 + azar() * 8).toFixed(1) + '" cy="' + (78 + Math.floor(i / 10) * 18 + azar() * 6).toFixed(1) + '" r="4" fill="rgba(255,255,255,.28)"/>';
    for (var j = 0; j < quedan; j++) s += '<circle cx="' + (430 + (j % 9) * 30 + azar() * 8).toFixed(1) + '" cy="' + (88 + Math.floor(j / 9) * 30 + azar() * 8).toFixed(1) + '" r="4.5" fill="#F4ECE7"/>';
    [[362, 'PRIMER SEGUNDO'], [772, '¿LE SIRVIÓ?']].forEach(function (f) {
      s += '<rect x="' + (f[0] - 2) + '" y="52" width="4" height="214" rx="2" fill="#FF2D8A" filter="url(#lfBrillo)"/><rect x="' + (f[0] - 10) + '" y="52" width="20" height="214" rx="10" fill="rgba(255,45,138,.12)"/>' +
        '<text x="' + f[0] + '" y="288" text-anchor="middle" fill="#FF7DB6" font-family="DM Mono" font-size="12" letter-spacing="1.5">' + f[1] + '</text>';
    });
    s += '<circle cx="945" cy="160" r="58" fill="rgba(110,212,156,.08)" stroke="rgba(110,212,156,.5)" stroke-width="1.5"/><circle cx="945" cy="160" r="40" fill="#0B0709" stroke="#6ED49C" stroke-width="2" filter="url(#lfBrillo)"/>' +
      '<path d="M933 142h24v36l-12-8-12 8z" fill="none" stroke="#6ED49C" stroke-width="2.4" stroke-linejoin="round"/>' +
      [[170, n(c.alc), 'personas lo vieron pasar', '#F4ECE7'], [565, n(qued), 'se quedaron a verlo (' + quedan + ' de 100)', '#F4ECE7'], [945, n(vale), 'veces lo guardaron o compartieron', '#6ED49C']].map(function (t) {
        return '<text x="' + t[0] + '" y="34" text-anchor="middle" fill="' + t[3] + '" font-family="Outfit" font-weight="800" font-size="26">' + t[1] + '</text><text x="' + t[0] + '" y="54" text-anchor="middle" fill="rgba(244,236,231,.55)" font-family="Space Grotesk" font-size="13">' + t[2] + '</text>';
      }).join('');
    for (var k = 0; k < 18; k++) {
      var y = (90 + azar() * 150).toFixed(0), dur = (4.2 + azar() * 1.6).toFixed(2), beg = (k * 0.42).toFixed(2);
      var muere = k < Math.round(18 * (100 - quedan) / 100) ? 0.33 : (k % 4 === 0 ? 1 : 0.7);
      s += '<circle cy="' + y + '" r="3.5" fill="' + (muere === 1 ? '#6ED49C' : '#FF7DB6') + '" opacity="0"><animate attributeName="cx" from="10" to="' + (muere === 1 ? 935 : 1060) + '" dur="' + dur + 's" begin="' + beg + 's" repeatCount="indefinite"/>' +
        '<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.05;' + (muere - 0.02).toFixed(2) + ';' + muere.toFixed(2) + ';1" dur="' + dur + 's" begin="' + beg + 's" repeatCount="indefinite"/></circle>';
    }
    return cards + '<div class="neon-sec"><div class="neon-cab"><span class="ceja-n">El recorrido, en vivo</span><h3 class="neon-h">Así pasó la gente por tu video</h3></div><div class="vivo-caja">' + s + '</svg></div></div>';
  }

  /* ── Respuestas automáticas de ESTE video (se piden aparte) ── */
  function etapa(ic, num, label, sub, ultima) {
    return '<div class="et' + (ultima ? ' ult' : '') + '"><span class="et-i">' + icono(ic) + '</span><b>' + num + '</b><span class="et-l">' + label + '</span><span class="et-s">' + sub + '</span></div>';
  }
  function cargarRespuestas(raiz, v, c) {
    var caja = raiz.querySelector('[data-cta]'); if (!caja) return;
    var fin = function (html) { var p = caja.querySelector('.cargando-l'); if (p) p.outerHTML = html; };
    if (!v.igMediaId || !window.CherryApp) { fin('<p class="suave">Este video no está en Instagram.</p>'); return; }
    CherryApp.rest('/rest/v1/flujos_respuesta?media_id=eq.' + encodeURIComponent(v.igMediaId) + '&select=id,nombre,palabras,grafo').then(function (fs) {
      fs = Array.isArray(fs) ? fs : [];
      if (!fs.length) {
        fin('<div class="sin-cta"><p>Este video no tiene respuesta automática. Con una, quien comente tu palabra recibe tu enlace por privado en segundos.</p><a class="btn-r" href="respuestas.html">Crear una respuesta</a></div>');
        var t0 = raiz.querySelector('.fn-tab[data-i] span'); return;
      }
      var ids = fs.map(function (f) { return f.id; }).join(',');
      return Promise.all([
        CherryApp.rest('/rest/v1/ejecuciones_flujo?flujo_id=in.(' + ids + ')&select=estado,pasos,persona_usuario,persona_id&limit=1000'),
        CherryApp.rest('/rest/v1/mis_flujos_resumen?flujo_id=in.(' + ids + ')&select=flujo_id,clics').catch(function () { return []; }),
      ]).then(function (r) {
        var ej = Array.isArray(r[0]) ? r[0] : [], clics = (Array.isArray(r[1]) ? r[1] : []).reduce(function (s, x) { return s + num(x.clics); }, 0);
        var personas = {}, recib = 0, toque = 0, siguen = 0, sinLlegar = 0;
        ej.forEach(function (e) {
          personas[e.persona_usuario || e.persona_id || Math.random()] = 1;
          var ps = e.pasos || [];
          var ok = ps.some(function (p) { return p.tipo === 'mensaje' && p.ok; });
          if (ok) recib++;
          if (e.estado === 'fallida' && !ok) sinLlegar++;
          if (ps.some(function (p) { return p.tipo === 'toque'; })) {
            toque++;
            if (ps.some(function (p) { return p.tipo === 'sigue' && p.sigue; })) siguen++;
          }
        });
        var palabra = String((fs[0].palabras || [])[0] || '').toUpperCase();
        var conBoton = fs.some(function (f) { return ((f.grafo && f.grafo.nodos) || []).some(function (nd) { return nd.tipo === 'mensaje' && (nd.d && nd.d.botones || []).some(function (b) { return b.t && !b.url; }); }); });
        var h3 = caja.querySelector('.neon-h'); if (h3 && palabra) h3.textContent = 'Lo que consiguió «Comenta ' + palabra + '»';
        var tab = raiz.querySelector('.fn-tab[data-i="' + raiz.querySelector('[data-cta]').closest('.fpanel').getAttribute('data-p') + '"] span');
        if (tab && palabra) tab.textContent = palabra.charAt(0) + palabra.slice(1).toLowerCase();
        var np = Object.keys(personas).length;
        fin('<div class="cta-emb">' +
          etapa(I.globo, n(c.com), 'comentarios', 'en el video') +
          etapa(I.estrella, n(np), 'pidieron el enlace', palabra ? 'comentaron ' + palabra : 'con tu palabra') +
          etapa(I.mensaje, n(recib), 'recibieron tu mensaje', 'Cherry les contestó en segundos') +
          (conBoton ? etapa(I.mano, n(toque), 'tocaron el botón', toque ? n(siguen) + ' de ellos ya te seguían' : '') : '') +
          etapa(I.enlace, n(clics), 'abrieron tu enlace', 'contados por Cherry', true) + '</div>' +
          (sinLlegar ? '<div class="alerta-n"><span class="alerta-i">!</span><div><b>A ' + sinLlegar + (sinLlegar === 1 ? ' persona' : ' personas') + ' no les llegó el mensaje</b> porque no te siguen e Instagram no deja mandarles un mensaje con botón. En cuanto vuelvan a comentar en este video, Cherry se lo manda en texto con tu enlace.</div></div>' : ''));
      });
    }).catch(function () { fin('<p class="suave">No se pudieron traer las respuestas ahora.</p>'); });
  }

  /* ── Próximo video ── */
  function nodoP(tipo, o) {
    var id = o.piezas[tipo], st = o.st[tipo], cambia = tipo === o.cambia;
    var nombre = id ? piezaTxt(tipo, id) : 'sin escoger';
    var sug = cambia && o.sug ? ' → ' + o.sug.texto : '';
    return '<button type="button" class="np' + (cambia ? ' cambia' : '') + '" data-tipo="' + tipo + '"><span class="np-k">' + NOMBRE[tipo] + '</span><b>' + esc(nombre + sug) + '</b>' +
      '<span class="np-a">' + (cambia ? '⇄ Cambia' : '✓ Mantén') + '</span><span class="np-e' + (st.e === 'magnetica' ? ' mag' : '') + '">' + esc(st.txt) + (cambia ? ' · la única que cambia' : '') + '</span></button>';
  }
  function socket(tipo, st) {
    var ok = st.e === 'magnetica';
    return '<div class="sock' + (ok ? ' ok' : '') + '"><span class="sock-c">' + (ok ? icono(I.iman) : '<i></i>') + '</span><b>' + NOMBRE[tipo] + '</b><span>' + (ok ? 'magnétic' + GENERO[tipo] : 'por confirmar') + '</span></div>';
  }
  function panProximo(v, M, c, o) {
    if (o.desmontar) {
      return '<div class="neon-sec"><div class="neon-cab"><span class="ceja-n">Tu próximo video</span><h3 class="neon-h">Primero: que Cherry sepa qué llevaba este video</h3></div>' +
        '<div class="hud"><p class="hud-p">Este video no se planeó en el Laboratorio, así que Cherry no sabe qué idea, gancho, estructura y formato tenía. Desmóntalo (subes el video o pegas lo que dices) y Cherry saca las cuatro piezas; con eso te dice qué repetir y qué cambiar. Lo que planees aquí de ahora en adelante se ata solo al publicarlo.</p><button type="button" class="btn-neon" data-desmontar>Desmontarlo →</button></div></div>';
    }
    var conf = TIPOS.filter(function (t) { return o.st[t].e === 'magnetica'; }).length;
    return '<div class="neon-sec"><div class="neon-cab"><span class="ceja-n">Tu próximo video</span><h3 class="neon-h">Qué hacer para que al próximo le vaya mejor</h3></div>' +
      '<div class="formula"><div class="f-txt"><span class="ceja-n">Tu fórmula</span><b>' + conf + ' de 4 piezas confirmadas</b><span>Cada video que grabas siguiendo a Cherry confirma o descarta una pieza. Con las cuatro magnéticas, tienes tu fórmula: la repites y solo cambias la idea.</span></div>' +
      '<div class="f-socks">' + TIPOS.map(function (t) { return socket(t, o.st[t]); }).join('') + '</div><div class="f-barra"><i style="width:' + (conf * 25) + '%"></i></div></div>' +
      '<div class="stepper" role="tablist"><button type="button" class="st" data-k="0"><span class="st-n">01</span><span class="st-t">Graba</span></button><i class="st-l"></i>' +
        '<button type="button" class="st" data-k="1"><span class="st-n">02</span><span class="st-t">Publica y espera</span></button><i class="st-l"></i>' +
        '<button type="button" class="st" data-k="2"><span class="st-n">03</span><span class="st-t">Cherry te dice</span></button></div>' +
      '<div class="tl">' +
        '<div class="paso"><div class="hud"><span class="hud-k">Graba</span><b class="hud-t">' + esc(o.titulo) + '</b><p class="hud-p">' + o.porque + '</p>' +
          '<div class="flujo"><span class="flujo-l"></span>' + TIPOS.map(function (t) { return nodoP(t, o); }).join('') + '</div><div class="np-detalle" hidden></div>' +
          '<div class="acc-l"><button type="button" class="btn-neon" data-armar>Armar este video →</button><span class="armado" hidden></span></div></div></div>' +
        '<div class="paso"><div class="hud hud-fila"><div><span class="hud-k">Publica y espera</span><b class="hud-t">48 horas</b><p class="hud-p">Instagram tarda eso en asentar los números. Cherry lo mide solo, lo ata con su plan y te avisa.</p></div>' +
          '<svg class="reloj" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/><circle cx="60" cy="60" r="48" fill="none" stroke="#FF2D8A" stroke-width="10" stroke-linecap="round" stroke-dasharray="301.6 301.6" transform="rotate(-90 60 60)" filter="url(#lfBrillo)"/><text x="60" y="67" text-anchor="middle" fill="#F4ECE7" font-family="Outfit" font-weight="800" font-size="26">48 h</text></svg></div></div>' +
        '<div class="paso"><div class="hud"><span class="hud-k">Cherry te dice qué sigue</span><b class="hud-t">Dos salidas, las dos sirven</b><div class="ramas">' +
          '<div class="rama-n si"><span class="rama-i">▲</span><div><b>Si pasa tu media (' + pct(M.ret) + ')</b><span>' + esc(o.si) + '</span></div></div>' +
          '<div class="rama-n no"><span class="rama-i">▼</span><div><b>Si no la pasa</b><span>' + esc(o.no) + '</span></div></div></div></div></div>' +
      '</div></div>';
  }
  function miniV(x, etq) {
    if (!x) return '';
    var m = medias(x).ret, vd = veredictoDe(num(x.retencion), m);
    return '<div class="hv"><div class="hv-f">' + (x.tapa ? '<img alt="" src="' + esc(x.tapa) + '">' : '') + '<b>' + pct(x.retencion) + '</b></div><span>' + esc(etq || String(x.titulo || '').slice(0, 34)) + '</span><em class="' + vd + '">' + ETQ[vd].replace('mejor que tu media', 'sobre tu media').replace('por debajo', 'bajo tu media') + '</em></div>';
  }
  function interaccionProximo(raiz, v, o) {
    if (o.desmontar) return;
    var det = raiz.querySelector('.np-detalle');
    raiz.querySelectorAll('.np').forEach(function (nd) {
      nd.onclick = function () {
        var tipo = nd.getAttribute('data-tipo'), ya = nd.classList.contains('sel');
        raiz.querySelectorAll('.np').forEach(function (x) { x.classList.remove('sel'); });
        if (ya) { det.hidden = true; return; }
        nd.classList.add('sel');
        var st = o.st[tipo], cambia = tipo === o.cambia;
        var txt = st.e === 'magnetica' ? '<b>Magnétic' + GENERO[tipo] + ':</b> lo usaste ' + st.n + ' veces y todas pasaron tu media. No se toca.'
          : st.e === 'nueva' ? '<b>Sin probar todavía.</b>'
          : st.e === 'inerte' ? '<b>No ha funcionado:</b> ' + st.ok + ' de ' + st.n + '.'
          : '<b>' + (st.n === 1 ? 'Primera vez que l' + GENERO[tipo] + ' usas.' : 'L' + GENERO[tipo] + ' usaste ' + st.n + ' veces y funcionó ' + st.ok + '.') + '</b>';
        if (cambia) txt += ' <b>Es la que cambia</b>' + (o.sug ? ': prueba «' + esc(o.sug.texto) + '»' + (o.sug.de === 'tu baúl' ? ', de tu baúl' : '') + '.' : '.');
        else if (tipo === o.confirma) txt += ' Es la que vamos a confirmar.';
        else if (st.e !== 'magnetica') txt += ' Se mantiene igual para no cambiar dos cosas a la vez.';
        det.innerHTML = '<p class="hd-p">' + txt + '</p><div class="hvs">' + st.usos.slice(0, 6).map(function (x) { return miniV(x); }).join('') +
          (tipo === o.confirma ? '<div class="hv vacio"><div class="hv-f"><b>?</b></div><span>Tu próximo video</span><em>l' + GENERO[tipo] + ' confirma o no</em></div>' : '') + '</div>';
        det.hidden = false;
      };
    });
    // la línea 01 · 02 · 03
    var pasos = raiz.querySelectorAll('.tl .paso'), sts = raiz.querySelectorAll('.st'), lin = raiz.querySelectorAll('.st-l');
    var estado = ['activo', '', ''];
    function verPaso(k) {
      pasos.forEach(function (p, i) { p.classList.toggle('ver', i === k); });
      sts.forEach(function (b, i) { b.classList.toggle('ver', i === k); b.classList.toggle('activo', estado[i] === 'activo'); b.classList.toggle('hecho', estado[i] === 'hecho'); });
      lin.forEach(function (l, i) { l.classList.toggle('llena', estado[i] === 'hecho'); });
    }
    sts.forEach(function (b) { b.onclick = function () { verPaso(+b.getAttribute('data-k')); }; });
    var armar = raiz.querySelector('[data-armar]'), armado = raiz.querySelector('.armado');
    if (armar) armar.onclick = function () {
      var piezas = {}; TIPOS.forEach(function (t) { piezas[t] = o.piezas[t] || null; });
      if (o.sug && o.sug.id) piezas[o.cambia] = o.sug.id;
      else if (o.sug && o.sug.texto && o.cambia !== 'idea') { var nueva = A().crearPieza(o.cambia, o.sug.texto); piezas[o.cambia] = nueva ? nueva.id : null; }
      else piezas[o.cambia] = null;
      var NOMBRES = { idea: 'la idea', gancho: 'el gancho', estructura: 'el guion', formato: 'el formato' };
      var f = A().planDesdeOrden(v, piezas, o.titulo, TIPOS.filter(function (t) { return t !== o.cambia; }).map(function (t) { return NOMBRES[t]; }));
      estado = ['hecho', 'activo', ''];
      armar.hidden = true;
      armado.hidden = false;
      armado.innerHTML = '✓ Quedó en «Por grabar». <button type="button" class="btn-l" data-abrir>Abrir su ficha →</button>';
      armado.querySelector('[data-abrir]').onclick = function () { A().abrirPlan(f.id); };
      verPaso(1);
    };
    verPaso(0);
  }

  /* ── Por qué ── */
  function panPorQue(v, M, c, o, puesto) {
    var casos = '<div class="neon-sec"><div class="neon-cab"><span class="ceja-n">La orden cambia según lo que Cherry sepa</span></div><div class="casos-n">' +
      casoN('No lo planeaste en Cherry', 'Desmóntalo primero', ['q', 'q', 'q', 'q']) +
      casoN('Se lo saltaron', 'Todo igual, cambia el gancho', ['m', 'c', 'm', 'm']) +
      casoN('Se fueron a la mitad', 'Otra estructura', ['m', 'm', 'c', 'm']) +
      casoN('Nada probado', 'La tanda de 4', ['t', 't', 't', 't']) + '</div></div>';
    if (o.desmontar) return casos;
    var W = 1180, Y = 90, w = 150, h = 84, X = [20, 222, 424, 626, 828, 1030], ar = o.arbol;
    var fin = ar.q2 ? 'Cambiar el gancho' : ar.q3 ? 'Otra estructura' : !ar.q4 ? 'Otra idea' : (o.confirma ? 'Confirmar ' + (GENERO[o.confirma] === 'a' ? 'la ' : 'el ') + NOMBRE[o.confirma].toLowerCase() : 'Repetir la fórmula');
    var hasta = ar.q2 ? 2 : ar.q3 ? 3 : !ar.q4 ? 4 : 5;   // hasta qué pregunta llega el camino encendido
    var nodos = [
      ['Este video', n(c.ret, 1) + ' % · ' + puesto + '.º'],
      ['¿Sabe qué llevaba?', 'sí: lo planeaste aquí'],
      ['¿Lo saltaron más?', (ar.q2 ? 'sí: ' : 'no: ') + (c.omi != null ? n(c.omi, 0) + ' % contra ' + n(M.omi, 0) + ' %' : 'sin dato')],
      ['¿Se fueron a la mitad?', (ar.q3 ? 'sí: ' : 'no: ') + 'vieron ' + n(c.vm, 0) + ' s de ' + n(c.dur, 0)],
      ['¿Le sirvió a la gente?', (ar.q4 ? 'sí: ' : 'no: ') + n(c.vale, 1) + ' de 100 lo guardan'],
      ['Tu orden', fin],
    ];
    var ramas = [null, ['no', 'Desmontarlo'], ['sí', 'Cambiar el gancho'], ['sí', 'Otra estructura'], ['no', 'Otra idea'], null];
    var s = '<svg class="arbol" viewBox="0 0 ' + W + ' 350" role="img" aria-label="El camino que siguió Cherry hasta la orden">';
    var cy = Y + h / 2, camino = '';
    for (var i = 0; i < hasta; i++) camino += 'M' + (X[i] + w) + ' ' + cy + ' L' + X[i + 1] + ' ' + cy + ' ';
    if (hasta < 5) camino += 'M' + (X[hasta] + w / 2) + ' ' + (Y + h) + ' L' + (X[hasta] + w / 2) + ' 262';
    s += '<path d="' + camino + '" stroke="#FF2D8A" stroke-width="2.5" fill="none" filter="url(#lfBrillo)"/>';
    for (var a = 1; a < Math.min(hasta, 5); a++) s += '<text x="' + (X[a] + w + 26) + '" y="' + (cy - 8) + '" text-anchor="middle" fill="#FF7DB6" font-family="DM Mono" font-size="12">' + (a === 1 || a === 4 ? 'sí' : 'no') + '</text>';
    ramas.forEach(function (r, k) {
      if (!r) return;
      var cx = X[k] + w / 2, on = k === hasta && hasta < 5;
      s += (on ? '' : '<path d="M' + cx + ' ' + (Y + h) + ' L' + cx + ' 262" stroke="rgba(255,255,255,.2)" stroke-width="1.5" stroke-dasharray="4 5" fill="none"/>') +
        '<text x="' + (cx + 8) + '" y="' + (Y + h + 26) + '" fill="' + (on ? '#FF7DB6' : 'rgba(244,236,231,.4)') + '" font-family="DM Mono" font-size="11">' + r[0] + '</text>' +
        '<rect x="' + (X[k] + 8) + '" y="262" width="' + (w - 16) + '" height="44" rx="12" fill="' + (on ? '#1B0710' : '#0B0709') + '" stroke="' + (on ? '#FF2D8A' : 'rgba(255,255,255,.14)') + '"' + (on ? ' filter="url(#lfBrillo)"' : '') + '/>' +
        '<text x="' + cx + '" y="289" text-anchor="middle" fill="' + (on ? '#FF7DB6' : 'rgba(244,236,231,.5)') + '" font-family="Space Grotesk" font-weight="600" font-size="13">' + r[1] + '</text>';
    });
    nodos.forEach(function (nd, k) {
      var ultimo = k === 5, apagado = ultimo && hasta < 5;
      s += '<rect x="' + X[k] + '" y="' + Y + '" width="' + w + '" height="' + h + '" rx="16" fill="' + (ultimo && !apagado ? '#1B0710' : '#0E0A0C') + '" stroke="' + (apagado ? 'rgba(255,255,255,.14)' : '#FF2D8A') + '" stroke-width="' + (ultimo && !apagado ? 2.2 : 1.3) + '"' + (ultimo && !apagado ? ' filter="url(#lfBrillo)"' : '') + '/>' +
        '<text x="' + (X[k] + w / 2) + '" y="' + (Y + 36) + '" text-anchor="middle" fill="#F4ECE7" font-family="Outfit" font-weight="800" font-size="15">' + esc(nd[0]) + '</text>' +
        '<text x="' + (X[k] + w / 2) + '" y="' + (Y + 58) + '" text-anchor="middle" fill="' + (ultimo ? '#FF7DB6' : 'rgba(244,236,231,.55)') + '" font-family="Space Grotesk" font-size="11.5">' + esc(String(nd[1]).slice(0, 26)) + '</text>';
    });
    s += '<circle r="5" fill="#fff" filter="url(#lfBrillo)"><animateMotion dur="3.6s" repeatCount="indefinite" path="M' + (X[0] + w) + ' ' + cy + ' L' + (hasta < 5 ? X[hasta] + w / 2 : X[5]) + ' ' + cy + (hasta < 5 ? ' L' + (X[hasta] + w / 2) + ' 262' : '') + '"/></circle></svg>';
    return '<div class="neon-sec"><div class="neon-cab"><span class="ceja-n">Por qué esta orden</span><h3 class="neon-h">Así decidió Cherry, paso a paso</h3></div><div class="arbol-caja">' + s + '</div></div>' + casos;
  }
  function casoN(cuando, orden, piezas) {
    return '<div class="caso-n"><span class="hud-k">' + cuando + '</span><b>' + orden + '</b><div class="puntos-n">' + piezas.map(function (x, i) {
      return '<span class="pn pn-' + x + '"><i>' + (x === 'm' ? '✓' : x === 'c' ? '⇄' : x === 't' ? '1/4' : '?') + '</i>' + NOMBRE[TIPOS[i]] + '</span>';
    }).join('') + '</div></div>';
  }

  /* ── Tendencia ── */
  function panTendencia(v, M, c, d) {
    if (d.length < 4) return '<p class="suave">Hacen falta más reels para ver la tendencia.</p>';
    var W = 1100, H = 300, L = 50, R = 30, T = 30, B = 44;
    var vals = d.map(function (x) { return num(x.retencion); });
    var lo = Math.min.apply(null, vals) - 3, hi = Math.max.apply(null, vals) + 3;
    var px = function (i) { return L + i * (W - L - R) / (d.length - 1); }, py = function (x) { return T + (hi - x) / (hi - lo) * (H - T - B); };
    var linea = vals.map(function (x, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(x).toFixed(1); }).join(' ');
    var area = linea + ' L' + px(d.length - 1).toFixed(1) + ' ' + (H - B) + ' L' + px(0).toFixed(1) + ' ' + (H - B) + ' Z';
    var m5 = vals.map(function (x, i) { var t = vals.slice(Math.max(0, i - 4), i + 1); return t.reduce(function (a, b) { return a + b; }, 0) / t.length; });
    var tend = m5.map(function (x, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(x).toFixed(1); }).join(' ');
    var prom = function (xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, xs.length); };
    var a5 = prom(vals.slice(-6, -1)), b5 = prom(vals.slice(-11, -6));
    var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var eti = function (f) { var p = String(f || '').split('-'); return p.length > 1 ? MES[+p[1] - 1] + ' ' + p[0].slice(2) : ''; };
    var s = '<div class="tend-cab"><div><span class="big-n" style="display:block;font-size:clamp(44px,5vw,64px)">' + n(a5, 1) + '<small>%</small></span><p class="cel-p">retenían tus 5 reels antes de este, contra <b>' + n(b5, 1) + ' %</b> de los 5 anteriores. <b>' + (a5 < b5 ? 'Venías bajando' : 'Venías subiendo') + '</b>, y este video ' + (c.ret > a5 ? '<b style="color:#6ED49C">rompe la racha</b>.' : 'sigue la racha.') + '</p></div>' +
      '<div class="leyenda-n"><span><i class="lp"></i>retención de cada reel</span><span><i style="background:#F4ECE7"></i>tendencia (últimos 5)</span></div></div>';
    s += '<svg class="tend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Retención de tus últimos reels">';
    [lo + 3, (lo + hi) / 2, hi - 3].forEach(function (x) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + py(x).toFixed(1) + '" y2="' + py(x).toFixed(1) + '" stroke="rgba(255,255,255,.06)"/><text x="' + (L - 10) + '" y="' + (py(x) + 4).toFixed(1) + '" text-anchor="end" fill="rgba(244,236,231,.4)" font-family="DM Mono" font-size="11">' + n(x, 0) + '%</text>';
    });
    if (M.ret != null) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + py(M.ret).toFixed(1) + '" y2="' + py(M.ret).toFixed(1) + '" stroke="rgba(244,236,231,.4)" stroke-dasharray="4 5"/>';
    s += '<path d="' + area + '" fill="url(#lfArea)"/><path d="' + linea + '" fill="none" stroke="#FF2D8A" stroke-width="2.5" stroke-linejoin="round" filter="url(#lfBrillo)"/><path d="' + tend + '" fill="none" stroke="#F4ECE7" stroke-width="2" stroke-dasharray="7 6"/>';
    d.forEach(function (x, i) {
      var yo = x.id === v.id;
      s += '<circle class="tp" data-i="' + i + '" cx="' + px(i).toFixed(1) + '" cy="' + py(num(x.retencion)).toFixed(1) + '" r="' + (yo ? 7 : 4.5) + '" fill="' + (yo ? '#FF2D8A' : '#0B0709') + '" stroke="#FF2D8A" stroke-width="2"' + (yo ? ' filter="url(#lfBrillo)"' : '') + '/>';
    });
    s += '<text x="' + px(d.length - 1) + '" y="' + (py(vals[vals.length - 1]) - 16).toFixed(1) + '" text-anchor="end" fill="#F4ECE7" font-family="Outfit" font-weight="800" font-size="16">' + n(c.ret, 1) + ' % · este</text>';
    [0, Math.floor(d.length / 2), d.length - 1].forEach(function (i) {
      s += '<text x="' + px(i).toFixed(1) + '" y="' + (H - 16) + '" text-anchor="' + (i === 0 ? 'start' : i === d.length - 1 ? 'end' : 'middle') + '" fill="rgba(244,236,231,.45)" font-family="DM Mono" font-size="11">' + eti(d[i].fecha) + '</text>';
    });
    return '<div class="neon-sec"><div class="neon-cab"><span class="ceja-n">Cómo va tu cuenta</span><h3 class="neon-h">Tu tendencia de retención</h3></div><div class="tend-caja">' + s + '</svg><div class="tend-tip" hidden></div></div></div>';
  }
  function puntosQueSeTocan(raiz, d) {
    function tarjeta(x) {
      var vd = veredictoDe(num(x.retencion), medias(x).ret);
      return (x.tapa ? '<img alt="" src="' + esc(x.tapa) + '">' : '') + '<div><b>' + pct(x.retencion) + '</b><span>' + esc(String(x.titulo || '').slice(0, 60)) + '</span><em class="' + vd + '">' + ETQ[vd] + ' · ' + cuando(x.fecha) + '</em></div>';
    }
    [['.ranking', '.rb'], ['.tend-caja', '.tp']].forEach(function (par) {
      var caja = raiz.querySelector(par[0]); if (!caja) return;
      var tip = caja.querySelector('.tend-tip');
      caja.querySelectorAll(par[1]).forEach(function (el) {
        var mostrar = function () {
          caja.querySelectorAll(par[1]).forEach(function (y) { y.classList.remove('on'); });
          el.classList.add('on'); tip.innerHTML = tarjeta(d[+el.getAttribute('data-i')]); tip.hidden = false;
        };
        el.addEventListener('mouseenter', mostrar); el.addEventListener('click', mostrar);
      });
    });
  }

  /* ── Números ── */
  var PERSONA = '<path d="M12 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM3 23v-2.5A6.5 6.5 0 019.5 14h5a6.5 6.5 0 016.5 6.5V23z"/>';
  function personas(q) {
    var out = '';
    for (var i = 0; i < 10; i++) {
      var f = Math.max(0, Math.min(1, q / 10 - i));
      out += '<svg class="pers" viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="lfcp' + i + '"><rect width="' + (24 * f).toFixed(1) + '" height="24"/></clipPath></defs><g fill="rgba(255,255,255,.14)">' + PERSONA + '</g>' +
        (f > 0 ? '<g fill="#FF2D8A" clip-path="url(#lfcp' + i + ')" filter="url(#lfBrillo)">' + PERSONA + '</g>' : '') + '</svg>';
    }
    return '<div class="fila-pers" role="img" aria-label="' + q + ' de cada 100 se quedaron">' + out + '</div>';
  }
  function torta(p, med) {
    var ang = function (x) { return x / 100 * Math.PI * 2; };
    var a = ang(p), x = 50 + 42 * Math.sin(a), y = 50 - 42 * Math.cos(a);
    var s = '<svg class="torta" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="rgba(255,255,255,.06)"/><path d="M50 50 L50 8 A42 42 0 ' + (p > 50 ? 1 : 0) + ' 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Z" fill="#FF2D8A" filter="url(#lfBrillo)"/>';
    if (med != null) { var am = ang(med); s += '<line x1="' + (50 + 36 * Math.sin(am)).toFixed(2) + '" y1="' + (50 - 36 * Math.cos(am)).toFixed(2) + '" x2="' + (50 + 47 * Math.sin(am)).toFixed(2) + '" y2="' + (50 - 47 * Math.cos(am)).toFixed(2) + '" stroke="#F4ECE7" stroke-width="2.2" stroke-linecap="round"/>'; }
    return s + '</svg>';
  }
  function barraH(nombre, v, med, fmt) {
    var tope = Math.max(v, med || 0) * 1.1 || 1;
    return '<div class="bh"><div class="bh-cab"><span>' + nombre + '</span><b>' + fmt(v) + '</b></div><div class="bh-pista"><i style="width:' + (v / tope * 100).toFixed(1) + '%"></i>' + (med != null ? '<em style="left:' + (med / tope * 100).toFixed(1) + '%"></em>' : '') + '</div>' + (med != null ? '<span class="bh-m">tu media ' + fmt(med) + '</span>' : '') + '</div>';
  }
  function barrasV(items) {
    var tope = Math.max.apply(null, items.map(function (x) { return Math.max(x[1], x[2] || 0); })) * 1.15 || 1;
    return '<div class="bv">' + items.map(function (x) {
      var r = x[2] ? x[1] / x[2] : 1;
      return '<div class="bv-g"><div class="bv-cols"><div class="bv-c este" style="height:' + (x[1] / tope * 100).toFixed(1) + '%"><span>' + n(x[1], 1) + '</span></div>' +
        (x[2] != null ? '<div class="bv-c media" style="height:' + (x[2] / tope * 100).toFixed(1) + '%"><span>' + n(x[2], 1) + '</span></div>' : '') + '</div><b>' + x[0] + '</b><em>' + (!x[2] ? '' : r >= 1.5 ? '×' + n(r, 1) : (r >= 1 ? '+' : '−') + n(Math.abs(r - 1) * 100, 0) + ' %') + '</em></div>';
    }).join('') + '</div>';
  }
  function itemN(ic, nombre, valor, extra) {
    return '<div class="it"><span class="it-i">' + icono(ic) + '</span><div><span class="it-k">' + nombre + '</span><b>' + valor + '</b></div><em>' + extra + '</em></div>';
  }
  function multi(v, med) { if (!med) return ''; var r = v / med; return r >= 1.5 ? '×' + n(r, 1) : (r >= 1 ? '+' : '−') + n(Math.abs(r - 1) * 100, 0) + ' %'; }
  function panNumeros(v, M, c, quedan, puesto, u16, reel) {
    var p = c.p100;
    var celA = quedan != null ? '<div class="cel cel-a"><div class="big-n">' + quedan + '<small>%</small></div><p class="cel-p">se quedaron a verlo. <b>' + (100 - quedan) + ' de cada 100</b> lo saltaron al instante' + (M.omi != null ? '; en tus videos suelen ser ' + n(M.omi, 0) : '') + '.</p>' + personas(quedan) + '</div>' : '<div class="cel cel-a"><div class="big-n">' + n(c.vis) + '</div><p class="cel-p">vistas</p></div>';
    var celB = reel ? '<div class="cel cel-b">' + torta(c.ret, M.ret) + '<div><div class="big-n">' + n(c.ret, 1) + '<small>%</small></div><p class="cel-p">de retención. Tu media es ' + pct(M.ret) + ': <b>' + puesto + '.º de tus últimos ' + u16.length + '</b>.</p></div></div>' : '<div class="cel cel-b"><p class="cel-p">Instagram solo da retención de los reels.</p></div>';
    return '<div class="neon-sec"><div class="neon-cab"><span class="ceja-n">Todos los números</span><h3 class="neon-h">Este video contra tu media</h3></div><div class="bento">' + celA + celB +
      '<div class="cel cel-d"><span class="ceja-n">A cuánta gente llegó</span>' + barraH('Vistas', c.vis, M.vis, function (x) { return n(x); }) + barraH('Personas', c.alc, M.alc, function (x) { return n(x); }) +
        (c.horas != null && c.horas < 48 ? '<p class="cel-p" style="color:#F2B35B">Lleva ' + n(c.horas, 0) + ' h: sube hasta las 48.</p>' : '') + '</div>' +
      '<div class="cel cel-c"><div class="c-cab"><span class="ceja-n">Qué hizo la gente · por cada 100 personas</span><div class="leyenda-n"><span><i class="lp"></i>este video</span><span><i class="lg"></i>tu media</span></div></div>' +
        barrasV([['Me gusta', p(c.mg), M.mg], ['Comentarios', p(c.com), M.com], ['Guardados', p(c.gua), M.gua], ['Compartidos', p(c.comp), M.comp]]) + '</div>' +
      '<div class="cel cel-e">' +
        itemN(I.corazon, 'Me gusta', n(c.mg), multi(p(c.mg), M.mg)) + itemN(I.globo, 'Comentarios', n(c.com), multi(p(c.com), M.com)) +
        itemN(I.guardar, 'Guardados', n(c.gua), multi(p(c.gua), M.gua)) + itemN(I.compartir, 'Compartidos', n(c.comp), multi(p(c.comp), M.comp)) +
        itemN(I.ojo, 'Vistas por persona', n(c.vis / Math.max(1, c.alc), 2), M.rep != null ? 'tu media ' + n(M.rep, 2) : '') +
        (reel ? itemN(I.copa, 'Puesto en retención', puesto + '.º', 'de ' + u16.length) : '') +
      '</div></div></div>';
  }

  /* ── El menú: todo en una pantalla ── */
  function navegacion(raiz, total) {
    var tabs = raiz.querySelectorAll('.fn-tab'), paneles = raiz.querySelectorAll('.fpanel');
    function ir(i, subir) {
      pan = (i + total) % total;
      paneles.forEach(function (p, k) { p.classList.toggle('on', k === pan); });
      tabs.forEach(function (t, k) { t.classList.toggle('on', k === pan); t.setAttribute('aria-selected', k === pan ? 'true' : 'false'); });
      raiz.querySelector('.fn-cont').textContent = (pan + 1) + ' / ' + total;
      raiz.querySelector('.fn-prog i').style.width = ((pan + 1) / total * 100) + '%';
      try { tabs[pan].scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* nada */ }
      if (subir) { var nav = raiz.querySelector('.fnav'), y = nav.getBoundingClientRect().top + window.scrollY - 12; if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' }); }
    }
    tabs.forEach(function (t) { t.onclick = function () { ir(+t.getAttribute('data-i')); }; });
    raiz.querySelectorAll('.fn-flecha').forEach(function (b) { b.onclick = function () { ir(pan + (+b.getAttribute('data-d'))); }; });
    raiz.querySelectorAll('.fn-sig').forEach(function (b) { b.onclick = function () { ir(+b.getAttribute('data-ir'), true); }; });
    raiz.onkeydown = function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(pan + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(pan - 1); }
    };
    ir(pan);
  }

  window.LabFicha = { lista: lista, ficha: ficha };
})();

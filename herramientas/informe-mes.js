/* informe-mes.js — «Informes del mes» de Estadísticas (28-oct-2026)
 *
 * Sergio: «parecemos cualquier informe de cualquier página… debemos construir una parte donde realmente diga informes al
 * estilo Cherry: validaste este número de ideas, solo funcionaron estas, ya están validadas en magnéticas y puedes seguirlas
 * usando… que tanto un creador como un community manager puedan ver esos datos y tomar acción inmediata».
 * Propuesta aprobada (pestaña «Informes del mes»): https://claude.ai/artifact/Ufnr4uP2NPfNcVhKjQ4WnE
 *
 * Solo LEE, no guarda ni gasta IA. De dónde sale cada cosa:
 *   · el historial de reels (historial › lista): vistas, retención, portada y las piezas de cada reel;
 *   · los videos de Instagram (CherryCuenta.instagram): para contar los carruseles;
 *   · la estrategia (cuántos videos por semana) y el Laboratorio (piezas del baúl que nunca se han probado).
 *
 * ⚠️ «Lo que validaste» usa la MISMA regla de Mi proceso (proceso.html › etapas, paso 4 «Descubre qué funcionó»): un reel
 * acierta si su retención pasa el corte de la cuenta (CherryResumen.corte: el umbral de despegue, o 45 %); MAGNÉTICA = 2 o
 * más aciertos y 2 de cada 3; TEMPORAL = acertó alguna vez; INERTE = usada y nunca acertó; las estructuras casi iguales (una
 * es la otra con pasos de más al final) cuentan juntas. Si se cambia allá, se cambia aquí. El estado de cada pieza es el que
 * tenía al CERRAR ese mes: cuenta todos los reels hasta ese día, no solo los del mes.
 *
 * Lo comparte la página del enlace público (cuando exista): por eso va aparte y recibe todo por `ctx`.
 */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  var num = function (x) { return x == null || x === '' || !isFinite(Number(x)) ? null : Number(x); };
  var coma = function (x) { return String(x).replace('.', ','); };
  function fmt(v) {
    v = num(v); if (v == null) return '—';
    var a = Math.abs(v);
    if (a >= 1e6) return coma(Math.round(v / 1e5) / 10) + ' M';
    if (a >= 1e4) return coma(Math.round(v / 100) / 10) + ' mil';
    return Math.round(v).toLocaleString('es-CO');
  }
  function mediana(xs) { xs = xs.filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; }); var k = xs.length; return !k ? null : k % 2 ? xs[(k - 1) / 2] : (xs[k / 2 - 1] + xs[k / 2]) / 2; }
  var suma = function (l) { return l.reduce(function (a, b) { return a + (num(b) || 0); }, 0); };
  function cap(t) { t = String(t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  function corto(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; var c = t.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(' '), n * .6)).replace(/[\s,.:;!¡¿?-]+$/, '') + '…'; }
  function llave(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim(); }

  /* ── los meses ('2026-10') ── */
  var dos = function (n) { return (n < 10 ? '0' : '') + n; };
  function mesDe(f) { return String(f || '').slice(0, 7); }
  function mesHoy() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1); }
  function mesAntes(m) { var p = m.split('-').map(Number), y = p[0], mo = p[1] - 1; if (mo < 1) { mo = 12; y--; } return y + '-' + dos(mo); }
  function nombreMes(m) { return MESES[Number(m.slice(5, 7)) - 1] || ''; }
  function diasDe(m) { return new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(); }

  /* «2,1 veces más», «30 % menos», «casi igual» (como Estadísticas › contra) */
  function contra(a, b) {
    a = num(a); b = num(b);
    if (a == null || b == null || b <= 0 || Math.max(a, b) < 10) return null;
    var r = a / b;
    if (r >= 1.15) return { c: 'sube', f: '↑', t: r >= 2 ? coma(Math.round(r * 10) / 10) + ' veces más' : Math.round((r - 1) * 100) + ' % más' };
    if (r <= 0.85) return { c: 'baja', f: '↓', t: Math.round((1 - r) * 100) + ' % menos' };
    return { c: 'igual', f: '=', t: 'casi igual' };
  }

  /* ── las piezas, con la regla de Mi proceso ── */
  var TIPOS = [
    { k: 'idea', n: 'Ideas', uno: 'Idea', g: 'f', de: function (p) { return p.tema || p.idea; } },
    { k: 'gancho', n: 'Ganchos', uno: 'Gancho', g: 'm', de: function (p) { return p.gancho; }, frase: function (p) { return p.gancho_frase; } },
    { k: 'formato', n: 'Formatos', uno: 'Formato', g: 'm', de: function (p) { return p.formato || p.estilo; } },
    { k: 'estructura', n: 'Estructuras', uno: 'Estructura', g: 'f', de: function (p) { return p.estructura; } },
  ];
  var pasosDe = function (s) { return String(s || '').split(/→|->/).map(function (p) { return p.trim().toLowerCase(); }).filter(Boolean); };
  function grupos(medidos, corte) {
    var G = {};
    TIPOS.forEach(function (T) {
      var g = {};
      medidos.forEach(function (h) {
        var val = String(T.de(h.historial.piezas) || '').trim(); if (!val) return;
        if (T.k === 'estructura' && pasosDe(val).length < 3) return;   // (28-oct) «Gancho» solo no es una estructura: desmontaje a medias
        var k = val.toLowerCase();
        if (T.k === 'estructura' && !g[k]) {
          var p = pasosDe(val);
          var ya = Object.keys(g).filter(function (k2) { var q = pasosDe(k2), m = Math.min(p.length, q.length); return m >= 4 && p.slice(0, m).join('|') === q.slice(0, m).join('|'); })[0];
          if (ya) { k = ya; if (p.length < pasosDe(g[ya].val).length) g[ya].val = val; }
        }
        var x = g[k] = g[k] || { T: T, val: val, n: 0, aciertos: 0, ret: 0, vistas: 0, frase: '', vids: [] };
        var ok = Number(h.retencion) >= corte;
        x.n++; x.ret += Number(h.retencion); if (ok) x.aciertos++;
        x.vids.push({ h: h, ok: ok });
        if ((num(h.visitas) || 0) >= x.vistas) { x.vistas = num(h.visitas) || 0; if (T.frase) x.frase = T.frase(h.historial.piezas) || x.frase; }
      });
      G[T.k] = Object.keys(g).map(function (k) {
        var x = g[k]; x.media = x.ret / x.n;
        x.estado = x.aciertos >= 2 && 3 * x.aciertos >= 2 * x.n ? 'mag' : x.aciertos >= 1 ? 'tmp' : 'ine';   // (27-oct) 2 o más aciertos, y 2 de cada 3
        return x;
      });
    });
    return G;
  }
  /* ⚠️ copiado de js/patron.js › estructuraEnPalabras: una estructura («Gancho → Conector → Open loop → …») dicha con
     palabras de todos los días. Solo para mostrarla; la receta lleva la secuencia de verdad. */
  function enPalabras(s) {
    var p = pasosDe(s), hay = function (k) { return p.some(function (x) { return x.indexOf(k) >= 0; }); };
    if (hay('open loop') || hay('aplaza')) return 'Una promesa que se paga al final';
    if (hay('creencia') || hay('lo que cree')) return 'Desmiente lo que todos creen';
    if (hay('objecion') || hay('objeción')) return 'Responde la duda de quien mira';
    if (hay('ejemplo')) return 'Lo enseña con un ejemplo real';
    if (hay('giro')) return 'Un giro al final';
    return 'Tu estructura de ' + p.length + ' pasos';
  }
  function nom(x) { return x && x.T && x.T.k === 'estructura' && pasosDe(x.val).length > 1 ? enPalabras(x.val) : cap(x && x.val); }
  var ORDEN_E = { mag: 0, tmp: 1, ine: 2 };
  var mejorPrimero = function (a, b) { return ORDEN_E[a.estado] - ORDEN_E[b.estado] || b.aciertos - a.aciertos || b.media - a.media || b.vistas - a.vistas; };

  /* ════════ LO QUE SE CALCULA ════════ */
  function calcular(ctx, m) {
    var hist = (ctx.hist || []).filter(function (h) { return h && h.fecha; });
    var hasta = m + '-31';
    var delMes = function (l, mm) { return l.filter(function (h) { return mesDe(h.fecha) === mm; }); };
    var reels = delMes(hist, m).sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); });
    var antes = delMes(hist, mesAntes(m));
    // lo normal: la mitad de tus últimos 20 reels hasta el cierre del mes tuvo más y la mitad menos
    var hastaAqui = hist.filter(function (h) { return h.fecha <= hasta && num(h.visitas) != null; }).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    var normal = mediana(hastaAqui.slice(0, 20).map(function (h) { return num(h.visitas); }));

    var sumaDe = function (l, k) { return suma(l.map(function (h) { return h[k]; })); };
    var inter = function (l) { return suma(l.map(function (h) { return (num(h.meGusta) || 0) + (num(h.comentarios) || 0) + (num(h.guardados) || 0) + (num(h.reposts) || 0); })); };
    var retMedia = function (l) { var r = l.map(function (h) { return num(h.retencion); }).filter(function (x) { return x != null; }); return r.length ? Math.round(suma(r) / r.length) : null; };

    // las piezas al cierre del mes
    var medidos = hist.filter(function (h) { return h.fecha <= hasta && h.retencion != null && h.historial && h.historial.piezas; });
    var R = window.CherryResumen;
    var corte = R && R.corte ? R.corte(medidos) : 45;
    var G = grupos(medidos, corte);
    var lab = TIPOS.map(function (T) {
      var usadas = G[T.k].filter(function (x) { return x.vids.some(function (v) { return mesDe(v.h.fecha) === m; }); }).sort(mejorPrimero);
      var c = { mag: 0, tmp: 0, ine: 0 }; usadas.forEach(function (x) { c[x.estado]++; });
      return { T: T, usadas: usadas, c: c, funcionaron: c.mag + c.tmp };
    });
    var probadas = suma(lab.map(function (l) { return l.usadas.length; })), funcionaron = suma(lab.map(function (l) { return l.funcionaron; })), mags = suma(lab.map(function (l) { return l.c.mag; }));
    // la receta: la mejor magnética de cada tipo (como «Afina tu fórmula» de Mi proceso); si no hay, las temporales para confirmar
    var receta = TIPOS.map(function (T) { return G[T.k].filter(function (x) { return x.estado === 'mag'; }).sort(mejorPrimero)[0]; }).filter(Boolean);
    var confirmar = !receta.length;
    if (confirmar) receta = TIPOS.map(function (T) { return G[T.k].filter(function (x) { return x.estado === 'tmp'; }).sort(mejorPrimero)[0]; }).filter(Boolean);
    // para probar: lo del baúl del Laboratorio que nunca se ha usado en un reel
    var usadas = {}; TIPOS.forEach(function (T) { G[T.k].forEach(function (x) { usadas[T.k + ':' + llave(x.val)] = 1; }); });
    var baul = (ctx.lab && ctx.lab.piezas) || {}, App = window.CherryApp, nuevas = [];
    TIPOS.forEach(function (T) {
      var l = (baul[T.k] || []).filter(function (p) { return p && p.texto && (!App || !App.esDeMarca || App.esDeMarca(p.cuenta)) && !usadas[T.k + ':' + llave(p.texto)]; })
        .sort(function (a, b) { return String(b.creado || '').localeCompare(String(a.creado || '')); });
      if (l[0]) nuevas.push({ T: T, val: l[0].texto });
    });

    // los carruseles del mes (no están en el historial: salen de los videos de Instagram)
    var carr = ((ctx.ig && ctx.ig.videos) || []).filter(function (v) { return v && /CAROUSEL/i.test(String(v.tipo || '')) && mesDe(v.fecha || v.creado) === m; }).length;
    // el mejor día: el día de la semana que más vistas les dio a tus reels (con al menos 3 reels en el mes)
    var porDia = {};
    reels.forEach(function (h) { var d = new Date(h.fecha + 'T12:00:00').getDay(); (porDia[d] = porDia[d] || []).push(num(h.visitas) || 0); });
    var mejorDia = null;
    if (reels.length >= 3) Object.keys(porDia).forEach(function (d) { var x = suma(porDia[d]) / porDia[d].length; if (!mejorDia || x > mejorDia.x) mejorDia = { d: Number(d), x: x, n: porDia[d].length }; });

    // mes contra mes: las vistas de tus reels de los últimos 6 meses
    var seis = []; for (var i = 5, mm = m; i >= 0; i--) { seis.unshift(mm); mm = mesAntes(mm); }
    var mcm = seis.map(function (x) { return { m: x, v: sumaDe(delMes(hist, x), 'visitas'), n: delMes(hist, x).length }; });

    var vistas = sumaDe(reels, 'visitas'), vistasAntes = sumaDe(antes, 'visitas');
    return {
      m: m, enCurso: m === mesHoy(), reels: reels, antes: antes, normal: normal, corte: corte,
      vistas: vistas, vistasAntes: vistasAntes, inter: inter(reels), interAntes: inter(antes), ret: retMedia(reels), retAntes: retMedia(antes),
      guardados: sumaDe(reels, 'guardados'), compartidos: sumaDe(reels, 'reposts'), carr: carr, mejorDia: mejorDia,
      lab: lab, probadas: probadas, funcionaron: funcionaron, mags: mags, receta: receta, confirmar: confirmar, nuevas: nuevas, mcm: mcm,
      mejor: reels.slice().sort(function (a, b) { return (num(b.visitas) || 0) - (num(a.visitas) || 0); })[0] || null,
    };
  }

  /* ── «Hacer otro así»: la receta va a Guiones con medio trabajo hecho (lab-guiones.js › tomarOtroAsi) ── */
  function paquete(piezas) {
    var o = { tema: '', idea: '', gancho: '', frase: '', formato: '', estructura: '' };
    Object.keys(piezas).forEach(function (k) { if (piezas[k]) o[k] = piezas[k]; });
    return esc(JSON.stringify(o));
  }
  function deReceta(lista) {
    var o = {};
    lista.forEach(function (x) { if (x.T.k === 'idea') o.tema = x.val; else o[x.T.k] = x.val; if (x.T.k === 'gancho' && x.frase) o.frase = x.frase; });
    return o;
  }
  function deReel(h) { var p = (h.historial && h.historial.piezas) || {}; return { tema: p.tema || '', idea: p.idea || '', gancho: p.gancho || '', frase: p.gancho_frase || '', formato: p.formato || '', estructura: p.estructura || '' }; }

  /* ════════ PINTAR ════════ */
  var tapaDe = function (h, cls) { return h && h.tapa ? '<img class="' + (cls || '') + '" src="' + esc(h.tapa) + '" alt="" loading="lazy" crossorigin="anonymous">' : '<span class="' + (cls || '') + ' im-sin"></span>'; };

  function portada(D, ctx) {
    var n = nombreMes(D.m), ant = nombreMes(mesAntes(D.m)), x = contra(D.vistas, D.vistasAntes);
    var top6 = D.mcm.filter(function (c) { return c.n; });
    var eti = !D.reels.length ? 'Sin reels' : !D.antes.length ? (D.mcm.slice(0, 5).some(function (c) { return c.n; }) ? 'Volviste a publicar' : 'Tu primer mes') : top6.length >= 2 && D.vistas >= Math.max.apply(null, top6.map(function (c) { return c.v; })) ? 'Tu mejor mes'
      : x && x.c === 'sube' ? 'Vas subiendo' : x && x.c === 'baja' ? 'Bajaste un poco' : 'Un mes estable';
    var frase = !D.reels.length
      ? 'En ' + n + ' no subiste reels. Cuando una cuenta deja de publicar, Instagram la muestra menos.'
      : (D.enCurso ? 'Vas así: ' : '') + 'tus <b>' + D.reels.length + (D.reels.length === 1 ? ' reel' : ' reels') + '</b> ' + (D.reels.length === 1 ? 'sumó' : 'sumaron') + ' <b>' + fmt(D.vistas) + ' vistas</b>' +
        (x ? ', ' + (x.c === 'igual' ? 'casi igual que en ' + ant : x.t + ' que en ' + ant) : '') + '.' +
        (D.mejor ? ' El que más funcionó: <b>«' + esc(corto(D.mejor.titulo || 'sin título', 60)) + '»</b>, con ' + fmt(D.mejor.visitas) + ' vistas.' : '');
    var kp = function (v, et, a, cmp) {
      return '<div><b>' + v + '</b><span>' + et + '</span>' + (a != null ? '<small>En ' + esc(ant) + ': ' + a + '</small>' : '') +
        (cmp ? '<em class="im-pil ' + cmp.c + '">' + cmp.f + ' ' + cmp.t + '</em>' : '') + '</div>';
    };
    var difRet = D.ret != null && D.retAntes != null ? D.ret - D.retAntes : null;
    var cRet = difRet == null ? null : difRet >= 3 ? { c: 'sube', f: '↑', t: difRet + ' puntos más' } : difRet <= -3 ? { c: 'baja', f: '↓', t: -difRet + ' puntos menos' } : { c: 'igual', f: '=', t: 'casi igual' };
    var u = ctx.ig && ctx.ig.perfil && ctx.ig.perfil.usuario ? '@' + String(ctx.ig.perfil.usuario).replace(/^@/, '') : '';
    return '<section class="vol im-portada"><div class="im-cov">' +
      '<span class="eti">Informe de ' + n + ' ' + D.m.slice(0, 4) + (u ? ' · ' + esc(u) : '') + ' · Instagram</span>' +
      '<div class="im-mes">' + cap(n) + '</div><span class="im-etq">' + eti + '</span><p class="im-frase">' + frase + '</p>' +
      (D.enCurso ? '<span class="im-curso">En curso · se cierra el ' + diasDe(D.m) + '</span>' : '') + '</div>' +
      '<div class="im-kpis">' +
        kp(fmt(D.vistas), 'Vistas de tus reels', D.antes.length ? fmt(D.vistasAntes) : null, contra(D.vistas, D.vistasAntes)) +
        kp(fmt(D.inter), 'Me gusta, comentarios, guardados y compartidos', D.antes.length ? fmt(D.interAntes) : null, contra(D.inter, D.interAntes)) +
        kp(String(D.reels.length), D.reels.length === 1 ? 'Reel' : 'Reels', D.antes.length ? String(D.antes.length) : null, null) +
        (D.ret != null ? kp(D.ret + ' %', 'Se quedaron viendo, en promedio', D.retAntes != null ? D.retAntes + ' %' : null, cRet) : '') +
      '</div></section>';
  }

  function datos(D) {
    var c = [];   // (los reels ya van arriba, en la portada)
    if (D.carr) c.push(['' + D.carr, D.carr === 1 ? 'carrusel' : 'carruseles']);
    if (D.mejorDia) c.push([cap(DIAS[D.mejorDia.d]), 'tu mejor día']);
    if (D.guardados) c.push([fmt(D.guardados), 'guardaron']);
    if (D.compartidos) c.push([fmt(D.compartidos), 'compartieron']);
    if (c.length < 2) return '';
    return '<div class="im-datos">' + c.map(function (x) { return '<div class="vol"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>';
  }

  /* el anillo: un tramo por pieza probada (lleno = magnética, suave = temporal, gris = inerte) y «2/5» adentro */
  function anillo(c, si, n) {
    var r = 28, C = 2 * Math.PI * r, paso = C / Math.max(n, 1), hueco = n > 1 ? 4 : 0, off = 0, h = '';
    if (!n) h = '<circle cx="34" cy="34" r="' + r + '" fill="none" stroke="rgba(20,12,17,.08)" stroke-width="7"/>';
    ['mag', 'tmp', 'ine'].forEach(function (e) {
      for (var x = 0; x < c[e]; x++) {
        var col = e === 'mag' ? '#FF2D8A' : e === 'tmp' ? 'rgba(255,45,138,.32)' : 'rgba(20,12,17,.1)';
        h += '<circle cx="34" cy="34" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + Math.max(paso - hueco, 0.1).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 34 34)"/>';
        off += paso;
      }
    });
    return '<svg class="im-anillo" viewBox="0 0 68 68" aria-hidden="true">' + h + '<text x="34" y="40" text-anchor="middle" font-family="Outfit, sans-serif" font-weight="900" font-size="19" fill="#140C11">' + si +
      '<tspan font-size="12" font-weight="800" fill="rgba(20,12,17,.4)">/' + n + '</tspan></text></svg>';
  }
  var ESTADO = function (e, g) { return e === 'mag' ? (g === 'f' ? 'Magnética' : 'Magnético') : e === 'tmp' ? 'Temporal' : 'Inerte'; };
  var deCuantos = function (x) { return x.aciertos + ' de ' + x.n + (x.n === 1 ? ' reel' : ' reels'); };

  function validaste(D) {
    var n = nombreMes(D.m);
    var frase = !D.probadas ? 'En ' + n + ' no hay reels medidos con sus piezas todavía. Cuando Cherry desmonte tus reels, aquí ves qué funcionó.'
      : 'En ' + n + ' probaste <b>' + D.probadas + (D.probadas === 1 ? ' pieza' : ' piezas') + '</b> y <b>' + D.funcionaron + ' ' + (D.funcionaron === 1 ? 'funcionó' : 'funcionaron') + '</b>. ' +
        (D.mags ? '<b>' + D.mags + (D.mags === 1 ? ' ya es magnética' : ' ya son magnéticas') + '</b>: úsalas sin miedo en tus próximos videos.'
          : D.funcionaron ? 'Todavía ninguna es magnética: repite las que funcionaron para confirmarlas.' : 'Ninguna atrajo: prueba piezas nuevas el próximo mes.');
    var cols = D.lab.map(function (L) {
      var T = L.T, vivas = L.usadas.filter(function (x) { return x.estado !== 'ine'; }), inertes = L.usadas.filter(function (x) { return x.estado === 'ine'; });
      var hero = vivas[0], resto = vivas.slice(1, 3);
      var heroH = hero ? '<div class="im-hero ' + hero.estado + '"><span class="im-est"><i class="im-d ' + hero.estado + '"></i>' + (hero.estado === 'mag' ? ESTADO('mag', T.g) : 'Temporal · para confirmar') + '</span>' +
          '<b>' + esc(nom(hero)) + '</b><div class="im-tps">' + hero.vids.slice(-6).map(function (v) {
            return '<span class="im-tp' + (v.ok ? ' ok' : '') + '" title="' + esc(corto(v.h.titulo || '', 60) + ' · ' + fmt(v.h.visitas) + ' vistas') + '">' + tapaDe(v.h) + '<i>' + (v.ok ? '✓' : '✕') + '</i></span>';
          }).join('') + '</div>' +
          '<div class="im-pie"><small>' + deCuantos(hero) + ' ' + (hero.aciertos === 1 ? 'funcionó' : 'funcionaron') + '</small>' +
          '<button type="button" class="im-ir" data-im-otro="' + paquete(deReceta([hero].concat(D.receta.filter(function (r) { return r.T.k !== T.k; })))) + '">' + (hero.estado === 'mag' ? 'Usar →' : 'Repetir →') + '</button></div></div>'
        : '<div class="im-hero vacio">' + (L.usadas.length ? 'Ninguna funcionó todavía.' : 'No probaste ' + T.n.toLowerCase() + ' este mes.') + '</div>';
      return '<div class="im-col"><div class="im-col-cab">' + anillo(L.c, L.funcionaron, L.usadas.length) + '<div><p class="im-col-t">' + T.n + '</p>' +
        '<span class="im-col-sub">' + L.funcionaron + ' de ' + L.usadas.length + ' ' + (L.funcionaron === 1 ? 'funcionó' : 'funcionaron') + '</span></div></div>' + heroH +
        (resto.length ? '<div class="im-filas">' + resto.map(function (x) {
          return '<div class="im-fl ' + x.estado + '"><i class="im-d ' + x.estado + '"></i><span><b>' + esc(nom(x)) + '</b><small>' + ESTADO(x.estado, T.g) + ' · ' + deCuantos(x) + '</small></span>' +
            '<button type="button" class="im-acc" data-im-otro="' + paquete(deReceta([x].concat(D.receta.filter(function (r) { return r.T.k !== T.k; })))) + '">' + (x.estado === 'mag' ? 'Usar →' : 'Repetir →') + '</button></div>';
        }).join('') + '</div>' : '') +
        (inertes.length ? '<p class="im-inertes">' + (inertes.length === 1 ? 'Inerte' : 'Inertes') + ': ' + inertes.slice(0, 3).map(function (x) { return '<b>' + esc(corto(nom(x), 32)) + '</b> (0 de ' + x.n + ')'; }).join(' · ') + (inertes.length > 3 ? ' y ' + (inertes.length - 3) + ' más' : '') + '</p>' : '') + '</div>';
    }).join('');
    var rec = D.receta.length ? '<div class="im-receta"><div><span class="eti">' + (D.confirmar ? 'Todavía no hay receta: confirma estas' : 'Tu receta validada') + '</span><div class="im-formula">' +
        D.receta.map(function (x, j) { return (j ? '<span class="im-mas">+</span>' : '') + '<span class="im-t"><small>' + x.T.uno + '</small><b>' + esc(nom(x)) + '</b></span>'; }).join('') + '</div></div>' +
        '<button type="button" class="im-cta" data-im-otro="' + paquete(deReceta(D.receta)) + '">' + (D.confirmar ? 'Repetir para confirmar' : 'Hacer un video con esta receta') + ' →</button></div>' : '';
    var nuevas = D.nuevas.length ? '<div class="im-probar"><span class="eti">Para probar · nunca usadas, en tu baúl</span>' + D.nuevas.map(function (x) { return '<span class="im-pr">' + x.T.uno + ' · ' + esc(corto(cap(x.val), 40)) + '</span>'; }).join('') + '</div>' : '';
    return '<section class="vol im-lab"><div class="im-lab-cab"><div><span class="eti">Tu laboratorio de ' + n + '</span><h3 class="im-lab-t">Lo que validaste</h3></div><p class="im-lab-frase">' + frase + '</p>' +
      '<div class="im-ley"><span><i class="im-d mag"></i>Magnética</span><span><i class="im-d tmp"></i>Temporal</span><span><i class="im-d ine"></i>Inerte</span></div></div>' +
      (D.probadas ? '<div class="im-cols">' + cols + '</div>' : '') + rec + nuevas + '</section>';
  }

  /* tu mes, reel a reel: las vistas del día que salió cada uno, con su portada debajo */
  function grafica(D) {
    if (!D.reels.length) return '';
    var N = diasDe(D.m), dia = [], tap = [];
    for (var i = 0; i < N; i++) { dia.push(0); tap.push(null); }
    D.reels.forEach(function (h) { var d = Number(String(h.fecha).slice(8, 10)) - 1; if (d < 0 || d >= N) return; dia[d] += num(h.visitas) || 0; if (!tap[d] || (num(h.visitas) || 0) > (num(tap[d].visitas) || 0)) tap[d] = h; });
    var mx = Math.max.apply(null, dia.concat([1])), top = dia.indexOf(mx);
    var m3 = MES3[Number(D.m.slice(5, 7)) - 1];
    return '<section class="vol tarj"><div><span class="eti">Tu mes reel a reel</span><h2>Vistas de cada reel, el día que salió</h2></div>' +
      '<div class="graf"><div class="graf-y im-y"><span>' + fmt(mx) + '</span><span>' + fmt(mx / 2) + '</span><span>0</span></div><div class="graf-area im-area">' +
      '<div class="barras">' + dia.map(function (v, d) { return '<i class="' + (!v ? 'cero' : d === top ? 'top' : '') + '" style="height:' + Math.max(1.5, v / mx * 100).toFixed(1) + '%" title="' + (d + 1) + ' ' + m3 + ': ' + fmt(v) + ' vistas"></i>'; }).join('') + '</div>' +
      '<div class="im-tapas">' + tap.map(function (h, d) { return '<div>' + (h ? '<span class="im-tapa' + (d === top ? ' mejor' : '') + '" title="' + esc(corto(h.titulo || '', 60)) + '">' + tapaDe(h) + '</span>' : '') + '</div>'; }).join('') + '</div>' +
      '<div class="graf-x"><span>1 ' + m3 + '</span><span>15</span><span>' + N + ' ' + m3 + '</span></div></div></div></section>';
  }

  function mesContraMes(D) {
    var con = D.mcm.filter(function (c) { return c.n; });
    if (con.length < 2) return '';
    var mx = Math.max.apply(null, D.mcm.map(function (c) { return c.v; }).concat([1]));
    var a = D.mcm[5], b = D.mcm[4], x = contra(a.v, b.v), N = cap(nombreMes(a.m));
    var tit = !b.n ? N + ': tu primer mes con reels' : !x ? N + ' contra ' + nombreMes(b.m) : x.c === 'igual' ? N + ': casi igual que ' + nombreMes(b.m) : N + ': ' + x.t + ' vistas que ' + nombreMes(b.m);
    return '<section class="vol tarj"><div><span class="eti">Mes contra mes</span><h2>' + esc(tit) + '</h2></div><div class="im-mcm">' +
      D.mcm.map(function (c, j) { return '<div class="' + (j === 5 ? 'on' : '') + '"><b>' + (c.n ? fmt(c.v) : '—') + '</b><i style="height:' + Math.max(2, c.v / mx * 100).toFixed(1) + '%"></i><small>' + MES3[Number(c.m.slice(5, 7)) - 1] + '</small></div>'; }).join('') +
      '</div><p class="nota">Las vistas de tus reels de cada mes.</p></section>';
  }

  function videosDelMes(D) {
    if (!D.reels.length || !D.normal) return '';
    var orden = D.reels.filter(function (h) { return num(h.visitas) != null; }).sort(function (a, b) { return num(b.visitas) - num(a.visitas); });
    var buenos = orden.filter(function (h) { return (num(h.visitas) || 0) >= D.normal * 1.2; }).slice(0, 2);
    var soloMejor = !buenos.length && orden.length >= 2;   // ninguno pasó lo normal: igual se muestra el mejor del mes
    if (soloMejor) buenos = [orden[0]];
    var malo = orden.slice().reverse().filter(function (h) { return (num(h.visitas) || 0) <= D.normal * 0.8 && buenos.indexOf(h) < 0; })[0] || null;
    if (!buenos.length && !malo) return '';
    var veces = function (h) { return coma(Math.round((num(h.visitas) || 0) / D.normal * 10) / 10); };
    var tarjeta = function (h, j, esMalo) {
      var p = (h.historial && h.historial.piezas) || {}, ini = num(h.omisiones) != null ? Math.round(100 - num(h.omisiones)) : null, ret = num(h.retencion);
      var por = !esMalo ? '' : ini != null && ini < 45 ? 'Solo ' + ini + ' de 100 pasaron el inicio: el gancho no paró el scroll.'
        : ret != null ? 'Se quedaron viendo el ' + Math.round(ret) + ' %: la gente se fue antes del final.' : 'Llegó a menos gente que tus otros reels.';
      var piezas = [['Gancho', p.gancho], ['Idea', p.tema || p.idea], ['Formato', p.formato || p.estilo]].filter(function (x) { return x[1]; }).slice(0, 2);
      return '<div class="im-tv' + (esMalo ? ' malo' : '') + '"><a class="im-tapa-g"' + (h.enlace ? ' href="' + esc(h.enlace) + '" target="_blank" rel="noopener"' : '') + '>' + tapaDe(h) + '<span>' + (esMalo ? '✕' : '#' + (j + 1)) + '</span></a><div class="im-tv-txt">' +
        '<span class="eti" style="color:' + (esMalo ? 'var(--baja)' : soloMejor ? 'var(--tinta-2)' : 'var(--sube)') + '">' + (esMalo ? 'No funcionó' : soloMejor ? 'El mejor del mes' : 'Funcionó') + '</span><p>' + esc(h.titulo || 'Sin título') + '</p>' +
        '<div class="im-tv-num"><b>' + fmt(h.visitas) + '</b><small>vistas</small><em class="im-pil ' + (esMalo ? 'baja' : soloMejor ? 'igual' : 'sube') + '">' + veces(h) + ' veces lo normal</em></div>' +
        (esMalo ? '<span class="im-por">' + por + '</span>'
          : (piezas.length ? '<div class="im-rec">' + piezas.map(function (x) { return '<span>✓ ' + x[0] + ': ' + esc(corto(cap(x[1]), 26)) + '</span>'; }).join('') + '</div>' : '') +
            '<button type="button" class="im-btn" data-im-otro="' + paquete(deReel(h)) + '">Hacer otro así</button>') + '</div></div>';
    };
    return '<section class="vol tarj"><div><span class="eti">Lo que funcionó y lo que no</span><h2>Tus reels del mes, con el porqué</h2></div>' +
      '<p class="nota">«Lo normal» es lo que suele tener un reel tuyo: <b>' + fmt(D.normal) + ' vistas</b>.</p><div class="im-top">' +
      buenos.map(function (h, j) { return tarjeta(h, j, false); }).join('') + (malo ? tarjeta(malo, 0, true) : '') + '</div></section>';
  }

  function consejos(D, ctx) {
    var c = [], sig = MESES[Number(D.m.slice(5, 7)) % 12];   // el mes que sigue
    var magG = D.receta.filter(function (x) { return !D.confirmar && x.T.k === 'gancho'; })[0];
    var tmp = D.lab.map(function (L) { return L.usadas.filter(function (x) { return x.estado === 'tmp'; })[0]; }).filter(Boolean)[0];
    if (!D.confirmar && D.receta.length) {
      var r0 = magG || D.receta[0];
      c.push(['✦', 'Otro con ' + (r0.T.k === 'gancho' ? 'el gancho' : r0.T.k === 'idea' ? 'la idea' : r0.T.k === 'formato' ? 'el formato' : 'la estructura') + ' «' + nom(r0) + '»', 'Funcionó en ' + deCuantos(r0) + '.', 'Hacer otro así', 'otro', deReceta(D.receta)]);
    } else if (tmp) {
      c.push(['↻', 'Confirma «' + nom(tmp) + '»', 'Funcionó una vez; si vuelve a funcionar, queda magnética.', 'Repetir', 'otro', deReceta([tmp])]);
    }
    var sem = D.reels.length / (diasDe(D.m) / 7), meta = ctx.estrategia && ctx.estrategia.semana ? num(ctx.estrategia.semana.reels) : null;
    if (meta && sem < meta - 0.4) c.push(['▦', 'Sube a ' + meta + ' reels por semana', 'En ' + nombreMes(D.m) + ' fueron ' + Math.round(sem) + ' por semana; tu estrategia dice ' + meta + '.', 'Ver mi estrategia', 'href', 'estrategias']);
    else if (D.reels.length) c.push(['▦', 'Sigue con ' + Math.max(1, Math.round(sem)) + ' reels por semana', meta ? 'Vas al ritmo de tu estrategia.' : 'Arma tu estrategia para saber cuánto te conviene publicar.', meta ? 'Ver mi estrategia' : 'Armar mi estrategia', 'href', 'estrategias']);
    if (D.mejorDia && D.mejorDia.n >= 2) c.push(['◷', 'Publica los ' + DIAS[D.mejorDia.d], 'Tus reels de ese día sacaron ' + fmt(D.mejorDia.x) + ' vistas en promedio.', 'Programar', 'href', 'calendario']);
    else {
      var ine = D.lab.map(function (L) { return L.usadas.filter(function (x) { return x.estado === 'ine' && x.n >= 2; })[0]; }).filter(Boolean)[0];
      if (ine) c.push(['◎', 'Deja descansar «' + nom(ine) + '»', '0 de ' + ine.n + ' reels: no atrae.', 'Ver mis piezas', 'href', 'laboratorio']);
    }
    if (!c.length) return '';
    return '<section class="vol tarj"><div><span class="eti">Para ' + sig + '</span><h2>Lo que haría el próximo mes</h2></div><div class="im-recos">' + c.slice(0, 3).map(function (x) {
      var b = x[4] === 'otro' ? '<button type="button" class="im-btn" data-im-otro="' + paquete(x[5]) + '">' + x[3] + '</button>' : '<a class="im-btn" href="' + x[5] + '">' + x[3] + '</a>';
      return '<div class="im-reco"><span class="im-ic">' + x[0] + '</span><b>' + esc(x[1]) + '</b><span class="im-rs">' + esc(x[2]) + '</span>' + b + '</div>';
    }).join('') + '</div></section>';
  }

  /* los meses que se pueden escoger: el de hoy y los últimos con reels (hasta 6) */
  function meses(ctx) {
    var vistos = {}, l = [mesHoy()];
    (ctx.hist || []).forEach(function (h) { var m = mesDe(h.fecha); if (m && !vistos[m]) { vistos[m] = 1; if (l.indexOf(m) < 0) l.push(m); } });
    return l.sort().reverse().slice(0, 6);
  }

  var CTX = null, MES = '';
  function pintar(cont, ctx) {
    CTX = ctx;
    var M = meses(ctx);
    if (!MES || M.indexOf(MES) < 0) MES = M[0];
    var D = calcular(ctx, MES);
    var cuenta = function (m) { var n = (ctx.hist || []).filter(function (h) { return mesDe(h.fecha) === m; }).length; return n ? n + (n === 1 ? ' reel' : ' reels') : 'sin reels'; };
    cont.innerHTML = '<div class="im-barra"><div class="im-meses" role="group" aria-label="Mes del informe">' + M.map(function (m) {
        return '<button type="button" data-im-mes="' + m + '" aria-pressed="' + (m === MES) + '">' + cap(nombreMes(m)) + (m.slice(0, 4) !== mesHoy().slice(0, 4) ? ' ' + m.slice(0, 4) : '') + ' <small>' + cuenta(m) + '</small></button>'; }).join('') + '</div>' +
      '<button type="button" class="im-lin" data-im-pdf>⤓ Descargar PDF</button></div>' +
      '<div class="im-hoja" id="im-hoja">' + portada(D, ctx) + validaste(D) + datos(D) +
      (function () { var g = grafica(D), c = mesContraMes(D); return g && c ? '<div class="im-dos">' + g + c + '</div>' : g + c; })() + videosDelMes(D) + consejos(D, ctx) + '</div>';
    if (!cont.dataset.imListo) {
      cont.dataset.imListo = '1';
      cont.addEventListener('click', function (e) {
        var b = e.target.closest('[data-im-mes]');
        if (b) { MES = b.getAttribute('data-im-mes'); pintar(cont, CTX); return; }
        var o = e.target.closest('[data-im-otro]');
        if (o) {
          try { sessionStorage.setItem('cherry-otro-asi', o.getAttribute('data-im-otro')); } catch (er) { /* sin sessionStorage: Guiones abre igual */ }
          location.href = 'laboratorio?modo=guiones&nuevo=1';
          return;
        }
        if (e.target.closest('[data-im-pdf]')) pdf(e.target.closest('[data-im-pdf]'));
      });
    }
  }

  /* ── Descargar PDF: el informe tal cual se ve, en hojas A4 (html-to-image + jsPDF, se cargan solo al tocar).
     ⚠️ html2canvas NO sirve: no entiende color-mix() de los estilos y se cae («unsupported color function»). html-to-image
     deja que el navegador mismo dibuje la página. Las portadas vienen de CloudFront, que deja leerlas (CORS). ── */
  var PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function cargarJs(src) {
    return new Promise(function (ok, mal) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); });
  }
  /* ⚠️ las letras (Outfit, Space Grotesk, DM Mono) se le pasan ya metidas: html-to-image no logra leer la hoja de Google
     Fonts por su cuenta («Error inlining remote css file») y el PDF salía con letras de reemplazo. Solo el alfabeto latino. */
  var fuentes = null;
  function fuentesCss() {
    if (fuentes) return fuentes;
    var l = [].slice.call(document.querySelectorAll('link[rel="stylesheet"]')).filter(function (x) { return /fonts\.googleapis\.com/.test(x.href); })[0];
    fuentes = !l ? Promise.resolve('') : fetch(l.href).then(function (r) { return r.text(); }).then(function (css) {
      var bloques = css.split(/(?=\/\* )/).filter(function (b) { return /^\/\* latin \*\//.test(b); });
      return Promise.all(bloques.map(function (b) {
        var m = b.match(/url\((https:[^)]+)\)/); if (!m) return '';
        return fetch(m[1]).then(function (r) { return r.blob(); }).then(function (bl) {
          return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(b.replace(m[1], fr.result)); }; fr.onerror = function () { ok(''); }; fr.readAsDataURL(bl); });
        });
      })).then(function (l2) { return l2.join('\n'); });
    }).catch(function () { return ''; });
    return fuentes;
  }
  // el informe como imagen (sin los botones: en un PDF no se tocan)
  function lienzo(hoja) {
    return fuentesCss().then(function (css) {
      return window.htmlToImage.toCanvas(hoja, { pixelRatio: 2, backgroundColor: '#ECE3DD', imagePlaceholder: PIXEL, fontEmbedCSS: css || undefined,
        filter: function (el) { return !(el.classList && (el.classList.contains('im-ir') || el.classList.contains('im-acc') || el.classList.contains('im-btn') || el.classList.contains('im-cta'))); } });
    });
  }
  function pdf(btn) {
    var hoja = document.getElementById('im-hoja'); if (!hoja || btn.disabled) return;
    var txt = btn.textContent; btn.disabled = true; btn.textContent = 'Armando el PDF…';
    var listo = function () { btn.disabled = false; btn.textContent = txt; };
    // dónde se puede cortar la hoja sin partir una tarjeta: al final de cada bloque del informe
    var arriba = hoja.getBoundingClientRect().top, cortes = [].slice.call(hoja.children).map(function (el) { return el.getBoundingClientRect().bottom - arriba; });
    var libs = (window.htmlToImage ? Promise.resolve() : cargarJs('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js'))
      .then(function () { return window.jspdf ? null : cargarJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); });
    libs.then(function () { return lienzo(hoja); }).then(function (cv) {
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      var W = 210, H = 297, mg = 8, ancho = W - 2 * mg, alto = H - 2 * mg;
      var pxPorMm = cv.width / ancho, porHoja = Math.floor(alto * pxPorMm), y = 0, pag = 0, esc2 = cv.width / hoja.offsetWidth;
      var puntos = cortes.map(function (c) { return Math.round(c * esc2); });
      while (y < cv.height - 2) {
        var fin = puntos.filter(function (p) { return p > y + 10 && p <= y + porHoja; }).pop() || Math.min(y + porHoja, cv.height);
        var h = fin - y, c = document.createElement('canvas');
        c.width = cv.width; c.height = h;
        var g = c.getContext('2d'); g.fillStyle = '#ECE3DD'; g.fillRect(0, 0, c.width, h); g.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
        if (pag) doc.addPage();
        doc.setFillColor(236, 227, 221); doc.rect(0, 0, W, H, 'F');
        doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', mg, mg, ancho, h / pxPorMm);
        y = fin; pag++;
      }
      var u = CTX && CTX.ig && CTX.ig.perfil && CTX.ig.perfil.usuario ? ' ' + String(CTX.ig.perfil.usuario).replace(/^@/, '') : '';
      doc.save('Informe de ' + nombreMes(MES) + ' ' + MES.slice(0, 4) + u + '.pdf');
      listo();
    }).catch(function (e) { try { console.warn('[informe] PDF', e); } catch (er) {} btn.textContent = 'No se pudo armar el PDF'; setTimeout(listo, 2600); });
  }

  /* grupos y TIPOS también los usa el inicio (js/components/inicio-accion.js › «Tu fórmula») */
  window.CherryInforme = { pintar: pintar, calcular: calcular, lienzo: lienzo, grupos: grupos, TIPOS: TIPOS, nom: nom, mes: function () { return MES; } };
})();

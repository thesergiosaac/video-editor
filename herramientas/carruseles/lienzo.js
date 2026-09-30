/* lienzo.js — la lámina como LISTA DE ELEMENTOS, con control total de cada uno (30-sep-2026).
 *
 * Sergio: «debemos poder tocar cada elemento y poder moverlo, eliminarlo, agrandarlo, disminuirlo… al tocarlo, en la
 * parte derecha nos lleva a la configuración de ese elemento… control total sobre los elementos generados».
 *
 * Cada familia (familias.js) ARMA la lista de elementos de cada lámina; desde ahí manda la lista. Este mismo dibujante
 * pinta el editor, las miniaturas y la descarga: lo que se ve es lo que sale.
 *   · tocar = seleccionar (marco rosado, esquinas para agrandar, lados para el ancho, círculo arriba para girar)
 *   · arrastrar = mover (se imanta a márgenes, centro y a los otros elementos; Shift lo suelta)
 *   · doble toque en un texto = escribir encima
 *   · teclado: Supr borra, flechas mueven, Ctrl+D duplica, Ctrl+Z / Ctrl+Y deshacen y rehacen, Esc suelta
 * Los valores que empiezan con @ salen del kit de la marca: @titular @mano @cuerpo (letras) y @principal @acento
 * @fondo @texto (colores). Un elemento con otra letra o color queda suelto de la marca.
 */
window.LZ = (function () {
  'use strict';
  var W = 1080, H = 1440;
  function ico(n, s) { s = s || 20; return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ((window.ICONOS && ICONOS[n]) || '') + '</svg>'; }
  var K = { titular: 'Anton', mano: 'Caveat', cuerpo: 'Inter', principal: '#E1251B', acento: '#FFD60A', fondo: '#F4EEE6', texto: '#141414' };
  var MAPA = { '@titular': 'titular', '@mano': 'mano', '@cuerpo': 'cuerpo', '@principal': 'principal', '@acento': 'acento', '@fondo': 'fondo', '@texto': 'texto' };
  function res(v) { return (typeof v === 'string' && MAPA[v]) ? K[MAPA[v]] : v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hexA(h, a) { h = res(h); if (!/^#[0-9a-f]{6}$/i.test(h)) return h; var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  var N = 0; function nid() { return 'e' + Date.now().toString(36) + (++N); }
  var Z = function (o, def) { for (var k in def) if (o[k] === undefined) o[k] = def[k]; return o; };
  function T(o) { return Z(o, { id: nid(), tipo: 'texto', x: 0, y: 0, w: 'auto', rot: 0, z: 5, op: 1, fuente: '@cuerpo', tam: 30, peso: 700, color: '@texto', colorAc: '@principal', modoAc: 'color', interl: 1.15, espac: 0, mayus: false, alin: 'left', txt: '' }); }

  /* ── letras: se cargan de Google la primera vez que alguien las usa ── */
  var TIPOS = {};   // elementos propios de una familia (familias/<id>.js los registra con LZ.tipo)
  var cargadas = {};
  // (30-sep) devuelve una promesa que se cumple cuando la hoja de Google LLEGÓ: antes de eso document.fonts.load()
  // no conoce la letra y «termina» al instante, y todo se medía con la letra de reemplazo (filas y pilas corridas)
  function cargarLetra(nombre) {
    nombre = res(nombre);
    if (!nombre) return Promise.resolve();
    if (cargadas[nombre]) return cargadas[nombre];
    var ya = [].some.call(document.querySelectorAll('link[href*="fonts.googleapis.com"]'), function (l) { return l.href.indexOf('family=' + encodeURIComponent(nombre).replace(/%20/g, '+') + ':') >= 0 || l.href.indexOf('family=' + encodeURIComponent(nombre).replace(/%20/g, '+') + '&') >= 0; });
    cargadas[nombre] = new Promise(function (ok) {
      if (ya) return ok();
      var fam = encodeURIComponent(nombre).replace(/%20/g, '+');
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + fam + ':ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap';
      l.onload = ok;
      l.onerror = function () { l.onerror = ok; l.onload = ok; l.href = 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap'; };
      setTimeout(ok, 6000);
      l.dataset.lzLetra = nombre; document.head.appendChild(l);
    });
    return cargadas[nombre];
  }
  function letrasDe(laminas) { var s = {}; [K.titular, K.mano, K.cuerpo].forEach(function (f) { s[f] = 1; }); (laminas || []).forEach(function (l) { l.els.forEach(function (e) { if (e.tipo === 'texto') s[res(e.fuente)] = 1; }); }); return Object.keys(s); }
  function listas(laminas) {
    var fs = letrasDe(laminas);
    return Promise.all(fs.map(cargarLetra)).then(function () {
      var formas = ['400', '500', '600', '700', '800', '900', 'italic 400', 'italic 700'];
      return Promise.all(fs.reduce(function (a, f) { return a.concat(formas.map(function (p) { return document.fonts.load(p + ' 40px "' + f + '"').catch(function () {}); })); }, []));
    });
  }

  /* ── dibujar ── */
  // la textura de grano, bien codificada: va dentro de un atributo style y dentro de la descarga (SVG/XML)
  var GRANO = "url('data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>").replace(/'/g, '%27') + "')";
  function fmt(el) {
    var ac = el.modoAc === 'marcador' ? 'background:linear-gradient(180deg,transparent 52%,' + hexA(el.colorAc, .25) + ' 52%,' + hexA(el.colorAc, .25) + ' 92%,transparent 92%);font-weight:800'
      : el.modoAc === 'negrita' ? 'font-weight:800;color:' + res(el.colorAc)
      : el.modoAc === 'subrayado' ? 'text-decoration:underline;text-decoration-color:' + res(el.colorAc) + ';text-decoration-thickness:.09em;text-underline-offset:.14em'
      : el.modoAc === 'tachado' ? 'text-decoration:line-through;text-decoration-color:' + res(el.colorAc) + ';text-decoration-thickness:.08em;opacity:.75'
      : 'color:' + res(el.colorAc);
    return esc(el.txt).replace(/\*([^*]+)\*/g, '<span class="ac" style="' + ac + '">$1</span>').replace(/\n/g, '<br>');
  }
  function rayasSvg(el) {
    return '<svg viewBox="-60 -60 120 120" width="100%" height="100%" style="overflow:visible">' + [-38, 0, 38].map(function (a) {
      var r = (el.giro + a) * Math.PI / 180, r0 = 14, r1 = a ? 44 : 52;
      return '<line x1="' + (Math.cos(r) * r0).toFixed(1) + '" y1="' + (Math.sin(r) * r0).toFixed(1) + '" x2="' + (Math.cos(r) * r1).toFixed(1) + '" y2="' + (Math.sin(r) * r1).toFixed(1) + '" stroke="' + res(el.color) + '" stroke-width="8" stroke-linecap="round"/>';
    }).join('') + '</svg>';
  }
  function filtroDe(e) { return 'brightness(' + (e.brillo == null ? 1 : e.brillo) + ') contrast(' + (e.contraste == null ? 1 : e.contraste) + ') saturate(' + (e.sat == null ? 1 : e.sat) + ')' + (e.bn ? ' grayscale(1)' : ''); }
  function nodo(el, sl) {
    var f = el.sigue ? sl.els.filter(function (e) { return e.id === el.sigue; })[0] : null;
    if (f) { el.x = f.x; el.y = f.y; el.w = f.w; el.h = f.h; el.rot = f.rot; }
    var dims = (el.w !== 'auto' && el.w != null ? 'width:' + el.w + 'px;' : '') + (el.h != null && el.tipo !== 'texto' ? 'height:' + el.h + 'px;' : '');
    var base = 'left:' + el.x + 'px;top:' + el.y + 'px;' + dims + 'transform:rotate(' + (el.rot || 0) + 'deg);z-index:' + el.z + ';opacity:' + (el.op == null ? 1 : el.op) + ';' + (el.oculto ? 'display:none;' : '');
    var d = 'class="lz-el" data-id="' + el.id + '"';
    if (el.tipo === 'texto') {
      var c = el.caja || {}, conCaja = c.fondo || c.borde;
      var flex = conCaja || el.icono ? 'display:' + (el.w === 'auto' ? 'inline-flex' : 'flex') + ';align-items:center;gap:.45em;justify-content:' + ({ left: 'flex-start', center: 'center', right: 'flex-end' })[el.alin] + ';' : '';
      var caja = conCaja ? 'padding:' + c.padV + 'px ' + c.padH + 'px;border-radius:' + c.radio + 'px;' + (c.fondo ? 'background:' + res(c.fondo) + ';' : '') + (c.borde ? 'border:' + c.bw + 'px solid ' + res(c.borde) + ';' : '') + (c.sombra ? 'box-shadow:0 14px 30px rgba(20,20,20,.12);' : '') : '';
      var icon = el.icono ? '<span class="lz-ic" style="color:' + res(el.iconoColor || el.color) + ';display:inline-flex;flex:none">' + ico(el.icono, Math.round(el.tam * 1.05)) + '</span>' : '';
      var t = '<span class="tx">' + fmt(el) + '</span>';
      return '<div ' + d + ' style="' + base + 'font-family:\'' + res(el.fuente) + '\',sans-serif;font-size:' + el.tam + 'px;font-weight:' + el.peso + ';font-style:' + (el.cursiva ? 'italic' : 'normal') + ';color:' + res(el.color) + ';line-height:' + el.interl + ';letter-spacing:' + el.espac + 'em;text-transform:' + (el.mayus ? 'uppercase' : 'none') + ';text-align:' + el.alin + ';white-space:' + (el.w === 'auto' ? 'pre' : 'normal') + ';' + (el.sombra ? 'text-shadow:0 4px 18px rgba(0,0,0,.45);' : '') + flex + caja + '">' + (el.iconoLado === 'der' ? t + icon : icon + t) + '</div>';
    }
    if (el.tipo === 'imagen') {
      if (el.calco) return '<div ' + d + ' style="' + base + '"><img src="' + esc(el.src) + '" draggable="false" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.3))"></div>';
      var zoom = f ? f.zoom : el.zoom, filtro = filtroDe(f || el), rad = f ? f.radio : el.radio;
      if (el.papel === 'recorte' && el.recCaja) {   // la persona sola, en el mismo lugar de la foto a la que sigue
        var k = el.recCaja;
        return '<div ' + d + ' style="' + base + 'overflow:hidden;border-radius:' + (rad || 0) + 'px"><div style="position:absolute;inset:0;transform:scale(' + (zoom || 1) + ');transform-origin:50% 50%"><img src="' + esc(el.src) + '" draggable="false" crossorigin="anonymous" style="position:absolute;left:' + (k[0] * 100) + '%;top:' + (k[1] * 100) + '%;width:' + (k[2] * 100) + '%;height:' + (k[3] * 100) + '%;filter:' + filtro + '"></div></div>';
      }
      return '<div ' + d + ' style="' + base + 'overflow:hidden;border-radius:' + (el.radio || 0) + 'px"><img src="' + esc(el.src) + '" draggable="false" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;transform:scale(' + (el.zoom || 1) + ');transform-origin:50% 50%;filter:' + filtro + '"></div>';
    }
    if (el.tipo === 'forma') return '<div ' + d + ' style="' + base + 'background:' + res(el.fondo) + ';border-radius:' + (el.radio || 0) + 'px;' + (el.sombra ? 'box-shadow:0 12px 30px rgba(20,20,20,.07);' : '') + '"></div>';
    if (el.tipo === 'rayas') return '<div ' + d + ' style="' + base + '">' + rayasSvg(el) + '</div>';
    if (el.tipo === 'flecha') return '<div ' + d + ' style="' + base + 'background:' + res(el.color) + ';-webkit-mask:url(' + el.src + ') center/contain no-repeat;mask:url(' + el.src + ') center/contain no-repeat"></div>';
    if (el.tipo === 'celular') {
      var e = el.w / 300;
      return '<div ' + d + ' style="' + base + 'height:' + (590 * e) + 'px"><div style="width:300px;height:590px;transform:scale(' + e + ');transform-origin:0 0;position:relative;border-radius:44px;background:#0d0d0d;padding:12px;box-shadow:0 24px 50px rgba(0,0,0,.28)">' +
        '<div style="position:relative;width:100%;height:100%;border-radius:34px;overflow:hidden;background:#222">' +
        (el.src ? '<img src="' + esc(el.src) + '" draggable="false" crossorigin="anonymous" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% ' + (el.posY == null ? 30 : el.posY) + '%">' : '') +
        '<div style="position:absolute;left:0;right:0;top:0;height:40%;background:linear-gradient(180deg,rgba(0,0,0,.45),transparent)"></div>' +
        '<div style="position:absolute;left:16px;right:16px;top:70px;font:800 23px/1.12 Inter,sans-serif;color:#fff;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,.5)">' + esc(el.texto) + '</div>' +
        '<div style="position:absolute;right:12px;bottom:90px;display:grid;gap:18px;color:#fff">' + ico('heart', 28) + ico('message-circle', 28) + ico('send', 28) + '</div>' +
        '<div style="position:absolute;left:14px;right:14px;bottom:22px;height:5px;border-radius:5px;background:rgba(255,255,255,.35)"><div style="width:9%;height:100%;border-radius:5px;background:#fff"></div></div>' +
        '</div></div></div>';
    }
    if (el.tipo === 'barra') return '<div ' + d + ' style="' + base + 'display:flex;align-items:center;gap:24px;font:700 18px Inter,sans-serif;letter-spacing:.2em;color:' + res(el.colorTxt) + ';text-transform:uppercase;white-space:nowrap"><span>' + esc(el.izq) + '</span><div style="flex:1;height:8px;border-radius:8px;background:' + res(el.fondoBarra) + ';position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:' + (el.valor * 100) + '%;border-radius:8px;background:' + res(el.color) + '"></div></div><span>' + esc(el.der) + '</span></div>';
    if (TIPOS[el.tipo]) return TIPOS[el.tipo](el, base, d, { res: res, esc: esc, ico: ico, fmt: fmt, hexA: hexA, W: W, H: H });
    if (el.tipo === 'grano') return '<div ' + d + ' style="left:0;top:0;width:' + W + 'px;height:' + H + 'px;z-index:' + el.z + ';opacity:' + el.op + ';mix-blend-mode:' + el.mezcla + ';pointer-events:none;background-image:' + GRANO + ';' + (el.oculto ? 'display:none;' : '') + '"></div>';
    return '';
  }
  function htmlLamina(sl) { return '<div class="lz" style="width:' + W + 'px;height:' + H + 'px;background:' + res(sl.fondo) + '">' + sl.els.map(function (e) { return nodo(e, sl); }).join('') + '</div>'; }

  /* ── medir UNA vez al armar: alinear a la derecha, filas de etiquetas y pilas centradas ──
     _der: x_derecho · _fila: {grupo, x, gap} · _pila: {grupo, x, w, y, h, gap, gapChip} (+ _chip en las etiquetas de la pila) */
  function medir(sl) {
    // _cabe: N → el texto cabe en UN renglón de N px; si no, se achica la letra (medido con la letra ya cargada)
    var cabe = sl.els.filter(function (e) { return e.tipo === 'texto' && e._cabe; });
    if (cabe.length) {
      var sp = document.createElement('span'); sp.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;white-space:pre'; document.body.appendChild(sp);
      cabe.forEach(function (e) {
        sp.style.font = (e.cursiva ? 'italic ' : '') + e.peso + ' ' + e.tam + 'px "' + res(e.fuente) + '"';
        sp.style.letterSpacing = e.espac + 'em'; sp.style.textTransform = e.mayus ? 'uppercase' : 'none';
        sp.textContent = String(e.txt).replace(/\*/g, '');
        var an = sp.offsetWidth; if (an > e._cabe) e.tam = Math.max(10, Math.floor(e.tam * e._cabe / an));
        delete e._cabe;
      });
      sp.remove();
    }
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden';
    m.innerHTML = htmlLamina(sl); document.body.appendChild(m);
    function tam(el) { var n = m.querySelector('[data-id="' + el.id + '"]'); return n ? [n.offsetWidth, n.offsetHeight] : [0, 0]; }
    sl.els.forEach(function (e) { if (e._der != null) { e.x = Math.round(e._der - tam(e)[0]); delete e._der; } });
    var filas = {};
    sl.els.forEach(function (e) { if (e._fila) { var g = e._fila; if (!filas[g.grupo]) filas[g.grupo] = g.x; e.x = filas[g.grupo]; filas[g.grupo] += tam(e)[0] + (g.gap || 16); delete e._fila; } });
    var pilas = {};
    sl.els.forEach(function (e) { if (e._pila) { (pilas[e._pila.grupo] = pilas[e._pila.grupo] || []).push(e); } });
    Object.keys(pilas).forEach(function (g) {
      var pila = pilas[g], P = pila[0]._pila, gap = P.gap || 26, gc = P.gapChip || 12;
      var bloques = pila.filter(function (e) { return !e._chip; }), chips = pila.filter(function (e) { return e._chip; });
      var cx = 0, cy = 0, fh = 0;
      var pos = chips.map(function (c) { var s = tam(c); if (cx + s[0] > P.w && cx > 0) { cx = 0; cy += fh + gc; fh = 0; } var p = [cx, cy]; cx += s[0] + gc; fh = Math.max(fh, s[1]); return p; });
      var altoChips = chips.length ? cy + fh : 0, altos = bloques.map(function (e) { return e.tipo === 'forma' ? e.h : tam(e)[1]; });
      var total = altos.reduce(function (s, h) { return s + h; }, 0) + altoChips + gap * (bloques.length - (chips.length ? 0 : 1));
      var y = Math.round(P.y + Math.max(0, (P.h - total) / 2));
      bloques.forEach(function (e, i) { e.y = y; e.x = P.x; y += altos[i] + gap; });
      chips.forEach(function (c, i) { c.x = P.x + pos[i][0]; c.y = y + pos[i][1]; });
      pila.forEach(function (e) { delete e._pila; delete e._chip; });
    });
    m.remove();
  }

  /* ── estado ── */
  var S = { laminas: [], i: 0, sel: null, hist: [], pos: -1, arr: null, man: null, editando: null };
  var cont = null, escena = null, barra = null, avisos = { cambio: function () {}, seleccion: function () {} };
  function lam() { return S.laminas[S.i]; }
  function buscar(id) { var l = lam(); return l ? l.els.filter(function (e) { return e.id === id; })[0] : null; }
  function sel() { return S.sel ? buscar(S.sel) : null; }
  function nodoDe(el) { return cont ? cont.querySelector('.lz-el[data-id="' + el.id + '"]') : null; }
  function escala() { return cont.clientWidth / W; }

  function guardarHist() { S.hist.splice(S.pos + 1); S.hist.push(JSON.stringify(S.laminas)); if (S.hist.length > 60) S.hist.shift(); S.pos = S.hist.length - 1; }
  function confirmar() { guardarHist(); avisos.cambio(); }
  function deshacer() { if (S.pos > 0) { S.pos--; S.laminas = JSON.parse(S.hist[S.pos]); if (S.i >= S.laminas.length) S.i = 0; if (S.sel && !buscar(S.sel)) S.sel = null; pintar(); avisos.cambio(); avisos.seleccion(); } }
  function rehacer() { if (S.pos < S.hist.length - 1) { S.pos++; S.laminas = JSON.parse(S.hist[S.pos]); if (S.i >= S.laminas.length) S.i = 0; pintar(); avisos.cambio(); avisos.seleccion(); } }

  function pintar() {
    if (!cont || !lam()) return;
    cont.innerHTML = '<div class="lz-marco" style="width:' + W + 'px;height:' + H + 'px;transform:scale(' + escala() + ')">' + htmlLamina(lam()) + '<div class="lz-guias" style="width:' + W + 'px;height:' + H + 'px"></div><div class="lz-sel" hidden></div></div>';
    caja();
  }
  function barraVacia(txt) { if (!barra) return; barra.classList.add('vacia'); barra.querySelector('.lz-vacia').textContent = txt || 'Toca cualquier elemento de la lámina para editarlo'; }
  function caja() {
    if (!cont) return;
    var box = cont.querySelector('.lz-sel'), el = sel();
    if (!box) return;
    if (!el || el.tipo === 'grano' || S.editando || el.oculto) { box.hidden = true; barraVacia(el && S.editando ? 'Escribiendo… toca fuera del texto para terminar' : null); return; }
    var n = nodoDe(el); if (!n) { box.hidden = true; barraVacia(); return; }
    var s = escala(), k = 1 / s;
    box.hidden = false;
    box.style.cssText = 'left:' + el.x + 'px;top:' + el.y + 'px;width:' + n.offsetWidth + 'px;height:' + n.offsetHeight + 'px;transform:rotate(' + (el.rot || 0) + 'deg);border-width:' + (2 * k) + 'px';
    var man = el.bloqueado ? [] : el.tipo === 'texto' ? ['nw', 'ne', 'sw', 'se', 'e', 'w', 'rot'] : ['nw', 'ne', 'sw', 'se', 'e', 'w', 'n', 's', 'rot'];
    var pw = n.offsetWidth * s, ph = n.offsetHeight * s;     // en lo chiquito, solo esquinas: si no, las manijas lo tapan
    if (ph < 40) man = man.filter(function (h) { return ['n', 's', 'e', 'w'].indexOf(h) < 0 || (pw > 90 && (h === 'e' || h === 'w') && el.tipo !== 'texto'); });
    if (pw < 40) man = man.filter(function (h) { return h !== 'e' && h !== 'w'; });
    box.innerHTML = man.map(function (h) { return '<i class="lz-h lz-' + h + '" data-h="' + h + '" style="width:' + (14 * k) + 'px;height:' + (14 * k) + 'px;border-width:' + (2 * k) + 'px;' + (h === 'rot' ? 'top:' + (-36 * k) + 'px' : '') + '"></i>'; }).join('')
      + (el.bloqueado ? '<b class="lz-candado" style="font-size:' + (13 * k) + 'px;padding:' + (3 * k) + 'px ' + (7 * k) + 'px">' + ico('lock', 12) + ' Bloqueado</b>' : '');
    if (barra) {
      barra.classList.remove('vacia');
      barra.querySelector('.lz-nombre').textContent = el.nombre || 'Elemento';
      barra.querySelector('[data-acc=bloquear]').innerHTML = ico(el.bloqueado ? 'lock-open' : 'lock', 16);
    }
  }
  // repintar solo un elemento (y lo que lo sigue), reutilizando la foto ya cargada: nada parpadea
  function repintar(el) {
    var sl = lam();
    [el].concat(sl.els.filter(function (o) { return o.sigue === el.id; })).forEach(function (o) {
      var n = nodoDe(o); if (!n) return;
      var t = document.createElement('div'); t.innerHTML = nodo(o, sl); var nuevo = t.firstElementChild;
      var vieja = n.querySelector('img'), fresca = nuevo.querySelector('img');
      if (vieja && fresca && vieja.getAttribute('src') === fresca.getAttribute('src')) { vieja.setAttribute('style', fresca.getAttribute('style')); fresca.parentNode.replaceChild(vieja, fresca); }
      n.parentNode.replaceChild(nuevo, n);
    });
    caja();
  }
  function guias(l) { var g = cont.querySelector('.lz-guias'); if (g) g.innerHTML = l.map(function (p) { return p[0] === 'x' ? '<i style="left:' + p[1] + 'px;top:0;width:' + (2 / escala()) + 'px;height:' + H + 'px"></i>' : '<i style="top:' + p[1] + 'px;left:0;height:' + (2 / escala()) + 'px;width:' + W + 'px"></i>'; }).join(''); }

  function esFondo(e) { return (e.tipo === 'imagen' && !e.calco) || (e.tipo === 'forma' && e.w * e.h > 200000) || e.tipo === 'celular' ? 1 : 0; }
  function candidatos(cx, cy) {
    var ids = [];
    document.elementsFromPoint(cx, cy).forEach(function (n) { var e = n.closest && n.closest('.lz-el'); if (e && cont.contains(e) && ids.indexOf(e.dataset.id) < 0) ids.push(e.dataset.id); });
    var els = ids.map(buscar).filter(function (e) { return e && !e.oculto && !e.interno && e.tipo !== 'grano'; });
    return els.map(function (e, i) { return [e, i]; }).sort(function (a, b) { return esFondo(a[0]) - esFondo(b[0]) || a[1] - b[1]; }).map(function (a) { return a[0]; });
  }
  function abajo(ev) {
    if (S.editando) { if (ev.target.closest('.tx[contenteditable=true]')) return; terminar(); }
    var h = ev.target.closest('.lz-h');
    if (h) { empezarManija(ev, h.dataset.h); return; }
    var lista = candidatos(ev.clientX, ev.clientY), el = lista[0];
    if (S.sel && lista.some(function (e) { return e.id === S.sel; }) && esFondo(sel()) <= esFondo(lista[0])) el = sel();
    if (ev.altKey && S.sel) { var k = lista.map(function (e) { return e.id; }).indexOf(S.sel); el = lista[(k + 1) % lista.length]; }
    seleccionar(el ? el.id : null);
    if (!el || el.bloqueado) return;
    S.arr = { x0: ev.clientX, y0: ev.clientY, ex: el.x, ey: el.y, movido: false };
    cont.setPointerCapture(ev.pointerId);
  }
  function imantar(el, nx, ny) {
    var n = nodoDe(el), w = n.offsetWidth, h = n.offsetHeight, U = 10;
    var X = [0, 60, W / 2, W - 60, W], Y = [0, 60, H / 2, H - 60, H];
    lam().els.forEach(function (o) { if (o === el || o.tipo === 'grano' || o.interno || o.oculto || (o.w >= W && o.h >= H)) return; var q = nodoDe(o); if (!q) return; X.push(o.x, o.x + q.offsetWidth / 2, o.x + q.offsetWidth); Y.push(o.y, o.y + q.offsetHeight / 2, o.y + q.offsetHeight); });
    var l = [], bx = null, by = null;
    [0, w / 2, w].forEach(function (d) { X.forEach(function (v) { var dd = Math.abs(nx + d - v); if (dd < U && (!bx || dd < bx.d)) bx = { d: dd, v: v, off: d }; }); });
    [0, h / 2, h].forEach(function (d) { Y.forEach(function (v) { var dd = Math.abs(ny + d - v); if (dd < U && (!by || dd < by.d)) by = { d: dd, v: v, off: d }; }); });
    if (bx) { nx = bx.v - bx.off; l.push(['x', bx.v]); }
    if (by) { ny = by.v - by.off; l.push(['y', by.v]); }
    return [nx, ny, l];
  }
  function mover(ev) {
    if (S.man) { manija(ev); return; }
    if (!S.arr) return;
    var s = escala(), el = sel(), dx = (ev.clientX - S.arr.x0) / s, dy = (ev.clientY - S.arr.y0) / s;
    if (!S.arr.movido && Math.hypot(dx, dy) < 4 / s) return;
    S.arr.movido = true;
    var r = ev.shiftKey ? [S.arr.ex + dx, S.arr.ey + dy, []] : imantar(el, S.arr.ex + dx, S.arr.ey + dy);
    el.x = Math.round(r[0]); el.y = Math.round(r[1]);
    var n = nodoDe(el); n.style.left = el.x + 'px'; n.style.top = el.y + 'px';
    lam().els.filter(function (o) { return o.sigue === el.id; }).forEach(function (o) { var q = nodoDe(o); o.x = el.x; o.y = el.y; if (q) { q.style.left = el.x + 'px'; q.style.top = el.y + 'px'; } });
    guias(r[2]); caja();
  }
  function arriba() { if ((S.arr && S.arr.movido) || S.man) { confirmar(); avisos.seleccion(); } S.arr = null; S.man = null; guias([]); }
  function empezarManija(ev, h) {
    ev.stopPropagation();
    var el = sel(), n = nodoDe(el), r = n.getBoundingClientRect();
    S.man = { h: h, x0: ev.clientX, y0: ev.clientY, o: copia(el), w0: n.offsetWidth, h0: n.offsetHeight, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    cont.setPointerCapture(ev.pointerId);
  }
  function escalar(el, o, f) {
    if (el.tipo === 'texto') {
      el.tam = Math.max(6, Math.round(o.tam * f));
      if (o.w !== 'auto') el.w = Math.round(o.w * f);
      if (o.caja) el.caja = Object.assign({}, o.caja, { padV: Math.round(o.caja.padV * f), padH: Math.round(o.caja.padH * f), radio: o.caja.radio >= 999 ? 999 : Math.round(o.caja.radio * f) });
    } else { el.w = Math.max(8, Math.round(o.w * f)); el.h = Math.max(2, Math.round(o.h * f)); }
  }
  function manija(ev) {
    var m = S.man, el = sel(), s = escala(), o = m.o;
    var r = -(o.rot || 0) * Math.PI / 180, dx = (ev.clientX - m.x0) / s, dy = (ev.clientY - m.y0) / s;
    var lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
    if (m.h === 'rot') {
      var a = Math.atan2(ev.clientY - m.cy, ev.clientX - m.cx) * 180 / Math.PI + 90; if (a > 180) a -= 360;
      if (ev.shiftKey) a = Math.round(a / 15) * 15; else [0, 90, -90, 180, -180].forEach(function (t) { if (Math.abs(a - t) < 4) a = t; });
      el.rot = Math.round(a * 10) / 10;
    } else if (m.h.length === 2) {
      var sx = m.h.indexOf('e') >= 0 ? 1 : -1, sy = m.h.indexOf('s') >= 0 ? 1 : -1;
      var f = Math.max(.08, ((m.w0 + lx * sx) / m.w0 + (m.h0 + ly * sy) / m.h0) / 2);
      escalar(el, o, f);
      el.x = Math.round(o.x + (sx < 0 ? m.w0 * (1 - f) : 0)); el.y = Math.round(o.y + (sy < 0 ? m.h0 * (1 - f) : 0));
    } else if (m.h === 'e' || m.h === 'w') {
      var sx2 = m.h === 'e' ? 1 : -1, nw = Math.max(40, m.w0 + lx * sx2);
      el.w = Math.round(nw); if (sx2 < 0) el.x = Math.round(o.x + (m.w0 - nw));
      if (el.tipo === 'celular') el.h = Math.round(el.w * 590 / 300);
    } else {
      var sy2 = m.h === 's' ? 1 : -1, nh = Math.max(2, m.h0 + ly * sy2);
      el.h = Math.round(nh); if (sy2 < 0) el.y = Math.round(o.y + (m.h0 - nh));
    }
    repintar(el);
  }
  function doble() {
    var el = sel(); if (!el || el.bloqueado) return;
    if (el.tipo === 'texto') editar(el);
    else if ((el.tipo === 'imagen' && !el.calco) || el.tipo === 'celular') avisos.material && avisos.material(el);
  }
  function serial(n) {
    var t = '';
    n.childNodes.forEach(function (c) {
      if (c.nodeType === 3) t += c.textContent;
      else if (c.nodeName === 'BR') t += '\n';
      else if (c.classList && c.classList.contains('ac')) t += '*' + c.textContent + '*';
      else if (c.nodeName === 'DIV' || c.nodeName === 'P') t += '\n' + serial(c);
      else t += serial(c);
    });
    return t.replace(/\*\*/g, '');
  }
  function editar(el) {
    var n = nodoDe(el).querySelector('.tx');
    S.editando = el.id; caja();
    n.contentEditable = 'true'; n.spellcheck = false; n.focus();
    var r = document.createRange(); r.selectNodeContents(n); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    n.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && el.w === 'auto')) { e.preventDefault(); n.blur(); } };
    n.onblur = terminar;
  }
  function terminar() {
    if (!S.editando) return;
    var el = buscar(S.editando), q = el && nodoDe(el), n = q && q.querySelector('.tx');
    S.editando = null;
    if (el && n) { n.onblur = null; el.txt = serial(n).replace(/\n$/, ''); }
    pintar(); confirmar(); avisos.seleccion();
  }

  function seleccionar(id) { if (S.editando) terminar(); if (S.sel === id) { caja(); return; } S.sel = id; caja(); avisos.seleccion(); }
  function accion(a) {
    var el = sel(); if (!el) return;
    var els = lam().els;
    if (a === 'borrar') { S.laminas[S.i].els = els.filter(function (e) { return e.id !== el.id && e.sigue !== el.id && e.de !== el.id; }); S.sel = null; }
    if (a === 'duplicar') { var c = copia(el); c.id = nid(); c.x += 30; c.y += 30; c.nombre = (el.nombre || 'Elemento') + ' (copia)'; delete c.interno; els.push(c); S.sel = c.id; }
    if (a === 'adelante') { var z = Math.max.apply(null, els.filter(function (e) { return e.tipo !== 'grano'; }).map(function (e) { return e.z; })); el.z = Math.min(89, z + 1); }
    if (a === 'atras') { var z2 = Math.min.apply(null, els.map(function (e) { return e.z; })); el.z = Math.max(0, z2 - 1); els.filter(function (e) { return e.sigue === el.id; }).forEach(function (e) { e.z = el.z + 1; }); }
    if (a === 'bloquear') el.bloqueado = !el.bloqueado;
    pintar(); confirmar(); avisos.seleccion();
  }
  function cambiar(el, props, fin) { Object.assign(el, props || {}); if (cont && cont.isConnected && nodoDe(el)) repintar(el); else pintar(); if (fin) confirmar(); else avisos.cambio(true); }
  function aTodos(el) {
    var CAMPOS = ['fuente', 'tam', 'peso', 'cursiva', 'color', 'colorAc', 'modoAc', 'interl', 'espac', 'mayus', 'caja', 'sombra', 'iconoColor', 'op', 'fondo', 'radio'];
    var n = 0;
    S.laminas.forEach(function (l) { l.els.forEach(function (o) { if (o !== el && o.papel === el.papel && o.tipo === el.tipo) { CAMPOS.forEach(function (c) { if (el[c] !== undefined) o[c] = copia(el[c]); }); n++; } }); });
    pintar(); confirmar(); return n;
  }
  function otros(el) { var n = 0; S.laminas.forEach(function (l) { l.els.forEach(function (o) { if (o !== el && o.papel === el.papel && o.tipo === el.tipo) n++; }); }); return n; }
  function agregar(tipo, extra) {
    extra = extra || {};
    var els = lam().els, z = Math.min(89, Math.max.apply(null, [5].concat(els.filter(function (e) { return e.tipo !== 'grano'; }).map(function (e) { return e.z; }))) + 1);
    var cx = W / 2, cy = H / 2, el;
    if (tipo === 'texto') el = T({ nombre: 'Texto nuevo', papel: 'texto-libre', txt: 'Escribe aquí', x: cx - 200, y: cy - 40, tam: 64, peso: 800, z: z });
    if (tipo === 'pastilla') el = T({ nombre: 'Pastilla nueva', papel: 'pastilla-libre', txt: 'Nuevo', x: cx - 90, y: cy - 30, tam: 32, peso: 800, color: '#FFFFFF', caja: { fondo: '@principal', radio: 999, padV: 14, padH: 26 }, z: z });
    if (tipo === 'forma') el = { id: nid(), tipo: 'forma', nombre: 'Forma nueva', papel: 'forma-libre', fondo: '@acento', radio: 24, x: cx - 150, y: cy - 150, w: 300, h: 300, z: z, rot: 0, op: 1 };
    if (tipo === 'flecha') el = { id: nid(), tipo: 'flecha', nombre: 'Flecha nueva', papel: 'flecha-libre', src: extra.src, color: '@principal', x: cx - 100, y: cy - 40, w: 200, h: 80, z: z, rot: 0, op: 1 };
    if (tipo === 'rayas') el = { id: nid(), tipo: 'rayas', nombre: 'Rayitas nuevas', papel: 'rayas', color: '@principal', giro: -30, x: cx - 45, y: cy - 45, w: 90, h: 90, z: z, rot: 0, op: 1 };
    if (tipo === 'calco') el = { id: nid(), tipo: 'imagen', calco: true, nombre: 'Calcomanía', papel: 'calco', src: extra.src, x: cx - 120, y: cy - 120, w: 240, h: 240, z: z, rot: -6, op: 1 };
    if (tipo === 'imagen') el = { id: nid(), tipo: 'imagen', nombre: 'Imagen nueva', papel: 'imagen-libre', src: extra.src, foto: extra.foto || null, x: cx - 200, y: cy - 250, w: 400, h: Math.round(400 * (extra.alto || 1.25)), z: z, rot: 0, op: 1, radio: 24, zoom: 1, brillo: 1, contraste: 1, sat: 1 };
    if (!el) return;
    els.push(el); S.sel = el.id; if (el.tipo === 'texto') cargarLetra(el.fuente); pintar(); confirmar(); avisos.seleccion();
  }
  function teclas(ev) {
    if (!cont || !cont.isConnected || cont.offsetParent === null || S.editando) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    var el = sel(), mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) rehacer(); else deshacer(); return; }
    if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); rehacer(); return; }
    if (!el) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); accion('borrar'); }
    else if (mod && ev.key.toLowerCase() === 'd') { ev.preventDefault(); accion('duplicar'); }
    else if (ev.key === 'Escape') seleccionar(null);
    else if (ev.key === 'Enter' && el.tipo === 'texto') { ev.preventDefault(); editar(el); }
    else if (ev.key.indexOf('Arrow') === 0 && !el.bloqueado) {
      ev.preventDefault(); var p = ev.shiftKey ? 10 : 1;
      if (ev.key === 'ArrowLeft') el.x -= p; if (ev.key === 'ArrowRight') el.x += p; if (ev.key === 'ArrowUp') el.y -= p; if (ev.key === 'ArrowDown') el.y += p;
      repintar(el); clearTimeout(teclas.t); teclas.t = setTimeout(confirmar, 400);
    }
  }
  document.addEventListener('keydown', teclas);

  function montar(c, e) {
    cont = c; escena = e;
    barra = e.querySelector('.lz-barra');
    if (!barra) {
      barra = document.createElement('div'); barra.className = 'lz-barra vacia';
      barra.innerHTML = '<span class="lz-vacia"></span><span class="lz-nombre"></span>' +
        '<button type="button" data-acc="duplicar" title="Duplicar (Ctrl+D)">' + ico('copy', 16) + '</button>' +
        '<button type="button" data-acc="adelante" title="Traer adelante">' + ico('arrow-up-to-line', 16) + '</button>' +
        '<button type="button" data-acc="atras" title="Mandar atrás">' + ico('arrow-down-to-line', 16) + '</button>' +
        '<button type="button" data-acc="bloquear" title="Bloquear">' + ico('lock', 16) + '</button>' +
        '<button type="button" data-acc="borrar" title="Borrar (Supr)" class="lz-rojo">' + ico('trash-2', 16) + '</button>';
      barra.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      barra.addEventListener('click', function (ev) { var b = ev.target.closest('[data-acc]'); if (b) accion(b.dataset.acc); });
      e.insertBefore(barra, c);
    }
    c.onpointerdown = abajo; c.onpointermove = mover; c.onpointerup = arriba; c.onpointercancel = arriba; c.ondblclick = doble;
    pintar();
  }
  // una lámina de OTRO carrusel (la lista, el catálogo): con su kit y su alto, sin tocar el que está en el editor
  function miniCon(c, lamina, ancho, kit, alto) {
    var k0 = K, h0 = H; K = kit || K; H = alto || 1440;
    try { c.innerHTML = '<div class="lz-marco" style="width:' + W + 'px;height:' + H + 'px;transform:scale(' + (ancho / W) + ')">' + htmlLamina(lamina) + '</div>'; }
    finally { K = k0; H = h0; }
  }
  function mini(c, i, ancho) { if (!S.laminas[i]) return; c.innerHTML = '<div class="lz-marco" style="width:' + W + 'px;height:' + H + 'px;transform:scale(' + (ancho / W) + ')">' + htmlLamina(S.laminas[i]) + '</div>'; }
  addEventListener('resize', function () { if (cont && cont.isConnected) pintar(); });

  return {
    T: T, nid: nid, medir: medir,
    // un tipo de elemento propio de una familia: fn(el, base, attrs, util) → HTML de UN div con class lz-el
    tipo: function (nombre, fn) { TIPOS[nombre] = fn; }, listas: listas, cargarLetra: cargarLetra, htmlLamina: htmlLamina,
    // un carrusel nuevo en el editor (las láminas ya armadas y medidas)
    cargar: function (laminas, alto) { H = alto || 1440; S.laminas = laminas; S.i = 0; S.sel = null; S.hist = []; S.pos = -1; guardarHist(); },
    tam: function (alto) { H = alto || 1440; }, get W() { return W; }, get H() { return H; },
    montar: montar, mini: mini, miniCon: miniCon, pintar: pintar, caja: caja, seleccionar: seleccionar, accion: accion, cambiar: cambiar, aTodos: aTodos, otros: otros,
    agregar: agregar, deshacer: deshacer, rehacer: rehacer, res: res, ico: ico,
    get laminas() { return S.laminas; }, get i() { return S.i; }, set i(v) { S.i = v; S.sel = null; },
    sel: sel, lam: lam, buscar: buscar, confirmar: confirmar,
    kit: function (k) { K = k; [k.titular, k.mano, k.cuerpo].forEach(cargarLetra); if (cont && cont.isConnected) pintar(); }, get K() { return K; },
    on: function (nombre, fn) { avisos[nombre] = fn; },
    puede: function () { return { deshacer: S.pos > 0, rehacer: S.pos < S.hist.length - 1 }; },
    recorte: function () { var l = lam(); return l ? l.els.filter(function (e) { return e.papel === 'recorte'; })[0] : null; },
    // lo que va a S3/descarga: la lámina i en tamaño real, suelta en el documento
    real: function (i) { var d = document.createElement('div'); d.innerHTML = htmlLamina(S.laminas[i]); return d.firstElementChild; },
  };
})();

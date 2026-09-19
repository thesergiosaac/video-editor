/* graficos.js — los GRÁFICOS de Cherry (19-sep-2026, aprobados por Sergio en la muestra: «me encantan todas»).
 *
 * EL MISMO ARCHIVO corre en la página (vista en vivo del celular, dibujando en un <canvas>) y en el ensamblador (Node,
 * dibujando con @napi-rs/canvas cada cuadro del video final): lo que se ve es lo que sale. Sin Remotion.
 *
 * La IA (función biblioteca › graficos) lee lo que dices y marca los momentos con información: una cifra, un porcentaje,
 * una lista, un antes y después, fechas o una cita, con los textos cortos ya escritos. Aquí se decide CUÁLES se usan según
 * «Gráficos» (pocos / medio / muchos) y se dibuja cada cuadro:
 *   · nunca en el primer segundo y medio ni al final; nunca encima de una escena de apoyo; con aire entre uno y otro;
 *   · cada uno entra un poquito antes de la palabra clave y cada parte aparece cuando la dices (el número cuenta cuando
 *     lo nombras, cada punto de la lista cuando lo nombras…);
 *   · tres formas: ENCIMA del video (arriba, sin tapar la cara ni los subtítulos), PANTALLA PARTIDA (tu video sube a una
 *     caja y el gráfico va abajo) y PANTALLA COMPLETA (tu cara en un círculo). En las dos últimas el video se encoge:
 *     video() da cuánto y dónde (la página lo hace con CSS y el ensamblador con perspective), y la capa del gráfico
 *     tapa todo menos el hueco donde queda el video.
 * Todo depende solo del tiempo: el mismo cuadro sale igual en el navegador y en el servidor.
 */
(function (raiz) {
  'use strict';

  var CANTIDAD = {
    pocos: { cada: 26, aire: 9, fuerza: 2 },
    medio: { cada: 15, aire: 5, fuerza: 2 },
    muchos: { cada: 9, aire: 3, fuerza: 1 },
  };
  var COLORES = { cherry: '#FF2D8A', dorado: '#F7C21A', oceano: '#2BD9C7', lima: '#B6F23A', coral: '#FF6B4A', lila: '#A98BFF', crema: '#F4ECE7' };
  var NOMBRES = { numero: 'Número gigante', porcentaje: 'Porcentaje', lista: 'Lista', comparacion: 'Antes y después', linea: 'Línea de tiempo', cita: 'Cita' };
  var FORMA = { numero: 'encima', porcentaje: 'partida', lista: 'encima', comparacion: 'completa', linea: 'encima', cita: 'encima' };
  var FORMAS = { encima: 'Encima del video', partida: 'Pantalla partida', completa: 'Pantalla completa' };
  var INICIO = 1.5, FINAL = 1.2, MIN = 3.4, MAX = 7.5, TRANS = 0.55, SALIDA = 0.6;
  var FONDO = '#0B0709', TINTA = '#F4ECE7';
  // letras (en la página vienen de Google Fonts; en el ensamblador, de fonts/ en S3 con estos mismos nombres)
  var FUENTES = ['900 40px Outfit', '700 40px Outfit', '500 20px "DM Mono"', 'italic 400 40px "Instrument Serif"', 'italic 900 40px "Playfair Display"'];

  /* ══ Ajustes ══ {cantidad: pocos|medio|muchos, color: nombre o #RRGGBB}. Sin cantidad = apagados. */
  function limpiar(cfg) {
    if (!cfg || typeof cfg !== 'object' || !CANTIDAD[cfg.cantidad]) return null;
    var c = String(cfg.color || 'cherry');
    if (!COLORES[c] && !/^#[0-9a-fA-F]{6}$/.test(c)) c = 'cherry';
    return { cantidad: cfg.cantidad, color: c };
  }
  function rgb(hex) { var n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function paleta(color) {
    var ac = COLORES[color] || (/^#[0-9a-fA-F]{6}$/.test(String(color)) ? color : COLORES.cherry);
    var c = rgb(ac), lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    return { acento: ac, sobre: lum > 0.55 ? FONDO : '#FFFFFF', fondo: FONDO, tinta: TINTA };
  }

  /* Tiempo de las palabras (nominal) → tiempo del video real (igual que apoyo.js) */
  function reloj(nominales, reales) {
    if (!Array.isArray(nominales) || !Array.isArray(reales) || nominales.length !== reales.length || !reales.length) return function (t) { return t; };
    var ini = [], desp = [], an = 0, ar = 0;
    nominales.forEach(function (d, i) { ini.push(an); desp.push(ar - an); an += Number(d); ar += Number(reales[i]); });
    return function (t) { var k = 0; while (k + 1 < ini.length && t >= ini[k + 1] - 0.0005) k++; return t + desp[k]; };
  }

  /* ══ Lo que trae la IA, en limpio ══ datos cortos y marcas (números de palabra) en orden y dentro del video */
  var txt = function (s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
  var numero = function (v) { var x = Number(v); return isFinite(x) ? x : null; };
  var may = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  // «10 mil», «3 años», pero «10M», «70%», «5k»: las palabras llevan espacio
  var sufijo = function (s) { s = txt(s, 8); return /^[a-záéíóúñ]{2,}/i.test(s) ? ' ' + s : s; };
  function limpiarDatos(m, nPal) {
    var d = m && m.datos && typeof m.datos === 'object' ? m.datos : {};
    var marcas = (Array.isArray(m.marcas) ? m.marcas : []).map(function (x) { return Math.round(Number(x)); })
      .filter(function (x) { return isFinite(x) && x >= 0 && x < nPal; });
    for (var i = 1; i < marcas.length; i++) if (marcas[i] < marcas[i - 1]) marcas[i] = marcas[i - 1];
    var dec = Math.max(0, Math.min(2, Math.round(Number(d.decimales) || 0)));
    var o = null;
    if (m.tipo === 'numero') {
      var v = numero(d.valor);
      if (v == null || !marcas.length) return null;
      o = { valor: v, decimales: dec, prefijo: txt(d.prefijo, 3), sufijo: sufijo(d.sufijo), etiqueta: may(txt(d.etiqueta, 30)), chip: d.chip ? txt(d.chip, 24) : '' };
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'porcentaje') {
      var p = numero(d.valor);
      if (p == null || p < 0 || p > 100 || !marcas.length) return null;
      o = { valor: p, etiqueta: may(txt(d.etiqueta, 28)), titulo: may(txt(d.titulo, 44)) };
      marcas = marcas.slice(0, 1);
    } else if (m.tipo === 'lista') {
      var items = (Array.isArray(d.items) ? d.items : []).map(function (x) { return may(txt(x, 30)); }).filter(Boolean).slice(0, 4);
      if (items.length < 2) return null;
      while (marcas.length < items.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      var tl = txt(d.titulo, 30);
      o = { titulo: tl ? tl.charAt(0).toLowerCase() + tl.slice(1) : tl, items: items };   // va después del número: «3 errores…»
      marcas = marcas.slice(0, items.length);
    } else if (m.tipo === 'comparacion') {
      var a = d.a || {}, b = d.b || {}, va = numero(a.valor), vb = numero(b.valor);
      if (va == null || vb == null || va < 0 || vb < 0 || (va === 0 && vb === 0)) return null;
      while (marcas.length < 2) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      var ins = d.insignia ? txt(d.insignia, 6) : '';
      if (!ins && va > 0 && vb / va >= 1.5) { var r = vb / va; ins = '×' + (Math.abs(r - Math.round(r)) < 0.05 ? Math.round(r) : r.toFixed(1).replace('.', ',')); }
      o = { etiqueta: may(txt(d.etiqueta, 28)), prefijo: txt(d.prefijo, 3), sufijo: sufijo(d.sufijo), decimales: dec, insignia: ins,
            a: { texto: may(txt(a.texto || 'Antes', 12)), valor: va }, b: { texto: may(txt(b.texto || 'Hoy', 12)), valor: vb } };
      marcas = marcas.slice(0, 2);
    } else if (m.tipo === 'linea') {
      var hitos = (Array.isArray(d.hitos) ? d.hitos : []).map(function (h) { return { fecha: txt(h && h.fecha, 10), texto: may(txt(h && h.texto, 18)) }; })
        .filter(function (h) { return h.fecha; }).slice(0, 4);
      if (hitos.length < 2) return null;
      while (marcas.length < hitos.length) marcas.push(marcas.length ? marcas[marcas.length - 1] : Number(m.desde) || 0);
      o = { titulo: may(txt(d.titulo, 26)), hitos: hitos };
      marcas = marcas.slice(0, hitos.length);
    } else if (m.tipo === 'cita') {
      var t = txt(d.texto, 110);
      if (!t || !d.autor) return null;
      o = { texto: may(t), autor: txt(d.autor, 30) };
      if (!marcas.length) marcas = [Number(m.desde) || 0];
      marcas = marcas.slice(0, 1);
    } else return null;
    return { datos: o, marcas: marcas };
  }

  /* ══ Cuáles se usan ══ graficos: {momentos}, palabras: [{start,end}], aReal: función de tiempo, dur: duración del video,
     ocupados: [{t0,t1}] (las escenas de apoyo que ya salen: nunca encima). */
  function elegir(graficos, palabras, aReal, cfg, dur, ocupados) {
    cfg = limpiar(cfg);
    var momentos = graficos && Array.isArray(graficos.momentos) ? graficos.momentos : [];
    if (!cfg || !momentos.length || !Array.isArray(palabras) || !palabras.length) return [];
    var f = aReal || function (t) { return t; };
    var reglas = CANTIDAD[cfg.cantidad];
    dur = Number(dur) || f(Number(palabras[palabras.length - 1].end) || 0);
    var tope = Math.max(1, Math.floor(dur / reglas.cada));
    var orden = momentos.map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) { return (b.m.fuerza || 1) - (a.m.fuerza || 1) || (a.m.desde || 0) - (b.m.desde || 0); });
    var puestos = [];
    for (var k = 0; k < orden.length && puestos.length < tope; k++) {
      var m = orden[k].m;
      if (!m || !FORMA[m.tipo] || (m.fuerza || 1) < reglas.fuerza) continue;
      var w0 = palabras[m.desde], w1 = palabras[m.hasta];
      if (!w0 || !w1) continue;
      var ld = limpiarDatos(m, palabras.length);
      if (!ld) continue;
      var marcas = ld.marcas.map(function (i) { return f(Number(palabras[i].start)); });
      var fin = f(Number(w1.end));
      var t0 = Math.min(f(Number(w0.start)), marcas[0]) - 0.35;
      if (marcas[0] < INICIO + 0.2) continue;
      t0 = Math.max(t0, INICIO);
      var ultimo = Math.max(marcas[marcas.length - 1], fin);
      var t1 = Math.min(t0 + MAX, Math.max(t0 + MIN, ultimo + 2.2));
      if (t1 > dur - FINAL) t1 = dur - FINAL;
      if (t1 - t0 < 2.8) continue;
      var choca = puestos.some(function (p) { return t0 < p.t1 + reglas.aire && t1 > p.t0 - reglas.aire; }) ||
        (ocupados || []).some(function (o) { return t0 < o.t1 + 0.6 && t1 > o.t0 - 0.6; });
      if (choca) continue;
      puestos.push({ t0: r3(t0), t1: r3(t1), tipo: m.tipo, forma: FORMA[m.tipo], datos: ld.datos, marcas: marcas.map(r3), fin: r3(fin),
                     desde: m.desde, hasta: m.hasta, fuerza: m.fuerza || 1 });
    }
    return puestos.sort(function (a, b) { return a.t0 - b.t0; });
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function enInstante(piezas, t) {
    for (var i = 0; i < (piezas || []).length; i++) if (t >= piezas[i].t0 && t < piezas[i].t1) return piezas[i];
    return null;
  }

  /* ══ Curvas ══ */
  function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function outCubic(x) { x = c01(x); return 1 - Math.pow(1 - x, 3); }
  function inCubic(x) { x = c01(x); return x * x * x; }
  function outQuad(x) { x = c01(x); return 1 - (1 - x) * (1 - x); }
  function outBack(x, s) { x = c01(x); s = s == null ? 1.7 : s; var c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); }
  function expo(x) { x = c01(x); return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, 10 - 20 * x)) / 2; }
  var prog = function (t, a, d) { return c01((t - a) / d); };

  /* ══ La forma: cuánto se encoge tu video y dónde queda el hueco ══ (fracciones del ancho W y del alto H) */
  function destino(forma, W, H) {
    if (forma === 'partida') return { x: 0.05, y: 0.05, w: 0.9, h: 0.38, r: 0.055 * W };
    if (forma === 'completa') { var h = 0.22 * W / H; return { x: 0.39, y: 0.045, w: 0.22, h: h, r: 0.11 * W }; }
    return null;
  }
  // 0 = video completo, 1 = video en su caja; entra al empezar y sale al final
  function avance(p, t) {
    var L = p.t1 - p.t0, lt = t - p.t0;
    return expo(lt / TRANS) * (1 - expo((lt - (L - SALIDA)) / TRANS));
  }
  function hueco(p, t, W, H) {
    var d = destino(p.forma, W, H);
    if (!d) return null;
    var k = avance(p, t);
    return { x: lerp(0, d.x * W, k), y: lerp(0, d.y * H, k), w: lerp(W, d.w * W, k), h: lerp(H, d.h * H, k), r: lerp(0, d.r, k), k: k };
  }
  /* El video: escala s y esquina (ox, oy) en fracciones de W/H. Cubre siempre el hueco (se encoge «cover», con la cara
     un poco arriba del centro). null = sin cambio. */
  function objetivo(forma, W, H) {
    var d = destino(forma, W, H);
    if (!d) return null;
    var s = Math.max(d.w, d.h);
    return { s: s, ox: d.x + (d.w - s) * 0.5, oy: d.y + (d.h - s) * 0.34 };
  }
  function video(p, t, W, H) {
    if (!p || p.forma === 'encima' || t < p.t0 || t >= p.t1) return null;
    var o = objetivo(p.forma, W || 1080, H || 1920), k = avance(p, t);
    if (!o || k <= 0) return null;
    return { s: lerp(1, o.s, k), ox: o.ox * k, oy: o.oy * k };
  }
  /* Para la página: el transform de CSS con el origen en `ancla` (el mismo del movimiento), para ponerlo DELANTE del suyo */
  function css(v, ancla) {
    if (!v) return '';
    var ax = ancla ? ancla.x : 0, ay = ancla ? ancla.y : 0;
    return 'translate(' + ((v.ox - (1 - v.s) * ax) * 100).toFixed(3) + '%,' + ((v.oy - (1 - v.s) * ay) * 100).toFixed(3) + '%) scale(' + v.s.toFixed(5) + ')';
  }
  /* Para el ensamblador: el mismo encogimiento con perspective (solo mientras dura el gráfico). El tiempo de cada cuadro
     es (in - 1 + c0) / fps, igual que el movimiento. */
  function ffmpeg(p, W, H, fps, c0) {
    var o = objetivo(p.forma, W, H);
    if (!o) return null;
    fps = Number(fps) || 30; c0 = Number(c0) || 0;
    var L = p.t1 - p.t0;
    var E = function (r) { return 'if(lte(ld(' + r + '),0),0,if(gte(ld(' + r + '),1),1,if(lt(ld(' + r + '),0.5),pow(2,20*ld(' + r + ')-10)/2,(2-pow(2,10-20*ld(' + r + ')))/2)))'; };
    var pre = 'st(5,(in-1+' + c0 + ')/' + fps + '-' + p.t0.toFixed(4) + ');' +
      'st(8,clip(ld(5)/' + TRANS + ',0,1));st(6,' + E(8) + ');' +
      'st(8,clip((ld(5)-' + (L - SALIDA).toFixed(4) + ')/' + TRANS + ',0,1));st(7,' + E(8) + ');' +
      'st(0,ld(6)*(1-ld(7)));st(1,1+' + (o.s - 1).toFixed(6) + '*ld(0));st(2,' + o.ox.toFixed(6) + '*W*ld(0));st(3,' + o.oy.toFixed(6) + '*H*ld(0));';
    var q = function (x) { return "'" + pre + x + "'"; };
    return 'perspective=x0=' + q('(0-ld(2))/ld(1)') + ':y0=' + q('(0-ld(3))/ld(1)') +
      ':x1=' + q('(W-ld(2))/ld(1)') + ':y1=' + q('(0-ld(3))/ld(1)') +
      ':x2=' + q('(0-ld(2))/ld(1)') + ':y2=' + q('(H-ld(3))/ld(1)') +
      ':x3=' + q('(W-ld(2))/ld(1)') + ':y3=' + q('(H-ld(3))/ld(1)') +
      ":sense=source:eval=frame:interpolation=linear:enable='between(t," + p.t0.toFixed(4) + ',' + p.t1.toFixed(4) + ")'";
  }
  /* La parte de la pantalla que puede tener algo dibujado (el ensamblador solo guarda ese rectángulo) */
  function caja(p, W, H) {
    if (p.forma === 'encima') return { x: 0, y: 0, w: W, h: Math.min(H, Math.ceil(H * 0.44 / 2) * 2) };
    return { x: 0, y: 0, w: W, h: H };
  }

  /* ══ Dibujo ══ */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function fuente(ctx, peso, tam, fam, estilo) { ctx.font = (estilo ? estilo + ' ' : '') + peso + ' ' + Math.max(1, tam).toFixed(2) + 'px ' + fam; }
  // tamaño que cabe en `maxW` (baja hasta el 55 %)
  function cabe(ctx, texto, peso, tam, fam, maxW, estilo) {
    fuente(ctx, peso, tam, fam, estilo);
    var w = ctx.measureText(texto).width;
    if (w <= maxW) return tam;
    var t = Math.max(tam * 0.55, tam * maxW / w);
    fuente(ctx, peso, t, fam, estilo);
    return t;
  }
  function renglones(ctx, texto, maxW) {
    var pal = String(texto).split(' '), out = [], linea = '';
    for (var i = 0; i < pal.length; i++) {
      var prueba = linea ? linea + ' ' + pal[i] : pal[i];
      if (linea && ctx.measureText(prueba).width > maxW) { out.push(linea); linea = pal[i]; } else linea = prueba;
    }
    if (linea) out.push(linea);
    return out;
  }
  // etiqueta pequeña en mayúsculas con espacio entre letras (a mano: no todos los canvas tienen letterSpacing)
  function mini(ctx, texto, x, y, u, pal, alinear, alfa) {
    texto = String(texto || '').toUpperCase();
    if (!texto) return;
    fuente(ctx, 500, 3 * u, '"DM Mono"');
    var esp = 0.42 * u, anchos = [], total = 0;
    for (var i = 0; i < texto.length; i++) { var w = ctx.measureText(texto[i]).width; anchos.push(w); total += w + (i ? esp : 0); }
    var cx = alinear === 'center' ? x - total / 2 : alinear === 'right' ? x - total : x;
    ctx.fillStyle = rgba(pal.tinta, alfa == null ? 0.62 : alfa);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var j = 0; j < texto.length; j++) { ctx.fillText(texto[j], cx, y); cx += anchos[j] + esp; }
  }
  function cifra(v, dec) {
    var n = Math.abs(v), ent = Math.floor(n + 1e-9), fr = n - ent;
    var s = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (dec > 0) s += ',' + fr.toFixed(dec).slice(2);
    return (v < 0 ? '-' : '') + s;
  }
  function tarjeta(ctx, x, y, w, h, r, u, pal) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 7 * u; ctx.shadowOffsetY = 2.5 * u;
    rrect(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(16,11,14,0.86)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    rrect(ctx, x, y, w, h, r);
    ctx.lineWidth = Math.max(1, 0.22 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.stroke();
    // filo de luz arriba
    var g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, 0.2 * u);
    ctx.beginPath(); ctx.moveTo(x + r, y + 0.5); ctx.lineTo(x + w - r, y + 0.5); ctx.stroke();
    ctx.restore();
  }
  function pastilla(ctx, texto, cx, cy, tam, pal, escala) {
    if (escala <= 0) return;
    fuente(ctx, 900, tam, 'Outfit');
    var w = ctx.measureText(texto).width + tam * 1.6, h = tam * 1.7;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(escala, escala);
    rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = pal.acento; ctx.fill();
    ctx.fillStyle = pal.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, 0, h * 0.04);
    ctx.restore();
  }
  // entrada y salida de las tarjetas «encima»
  function animTarjeta(p, t) {
    var a = prog(t, p.t0, 0.55), b = prog(t, p.t1 - 0.4, 0.4);
    return { alfa: Math.min(c01(a * 1.8), 1 - b), dy: (1 - outBack(a, 1.4)) * 6 - inCubic(b) * 5, s: 0.92 + 0.08 * outBack(a, 1.4) };
  }
  // entrada y salida de lo que va sobre el fondo (pantalla partida o completa)
  function animGrupo(p, t) {
    var a = prog(t, p.t0 + 0.35, 0.45), b = prog(t, p.t1 - SALIDA - 0.1, 0.35);
    return { alfa: outCubic(a) * (1 - b), dy: (1 - outCubic(a)) * 4 };
  }
  function conTarjeta(ctx, x, y, w, h, u, A, pintar) {
    if (A.alfa <= 0) return;
    ctx.save();
    ctx.globalAlpha = A.alfa;
    var cx = x + w / 2, cy = y + h / 2;
    ctx.translate(cx, cy + A.dy * u); ctx.scale(A.s, A.s); ctx.translate(-cx, -cy);
    pintar();
    ctx.restore();
  }

  function fondoConHueco(ctx, W, H, p, t, pal, u) {
    var hu = hueco(p, t, W, H);
    if (!hu || hu.k <= 0) return;
    ctx.save();
    ctx.fillStyle = pal.fondo; ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, H * 0.62);
    g.addColorStop(0, rgba(pal.acento, 0.17)); g.addColorStop(1, rgba(pal.acento, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sombra alrededor del video, y el hueco
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6 * u; ctx.shadowOffsetY = 2 * u;
    rrect(ctx, hu.x, hu.y, hu.w, hu.h, hu.r); ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-out';
    rrect(ctx, hu.x, hu.y, hu.w, hu.h, hu.r); ctx.fillStyle = '#000'; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (p.forma === 'completa' && hu.k > 0.85) {
      ctx.globalAlpha = (hu.k - 0.85) / 0.15;
      rrect(ctx, hu.x + 0.45 * u, hu.y + 0.45 * u, hu.w - 0.9 * u, hu.h - 0.9 * u, hu.r - 0.45 * u);
      ctx.strokeStyle = pal.acento; ctx.lineWidth = 0.9 * u; ctx.stroke();
    }
    ctx.restore();
  }

  var DIBUJO = {};
  DIBUJO.numero = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tc = p.marcas[0];
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 4.5 * u, hNum = 15 * u;
    var h = pad + 3 * u + 2 * u + hNum + (d.chip ? 2.2 * u + 6.8 * u : 0) + pad;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.etiqueta, W / 2, y + pad + 1.5 * u, u, pal, 'center');
      var chico = Math.abs(d.valor) < 10 && !d.decimales;
      var e = chico ? 1 : outCubic(prog(t, tc, 1.3));
      var final = (d.prefijo || '') + cifra(d.valor, d.decimales) + (d.sufijo || '');
      var tam = cabe(ctx, final, 900, hNum, 'Outfit', w - 10 * u);
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var sal = chico ? outBack(prog(t, tc - 0.1, 0.5), 2.2) : 1;
      if (sal > 0) {
        ctx.save(); ctx.translate(W / 2, y + pad + 5 * u + hNum / 2); ctx.scale(sal, sal);
        ctx.fillText((d.prefijo || '') + cifra(d.valor * e, d.decimales) + (d.sufijo || ''), 0, tam * 0.04);
        ctx.restore();
      }
      if (d.chip) pastilla(ctx, d.chip, W / 2, y + pad + 5 * u + hNum + 2.2 * u + 3.4 * u, 4 * u, pal, outBack(prog(t, tc + 1.25, 0.45), 2.4));
    });
  };
  DIBUJO.porcentaje = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tc = p.marcas[0], A = animGrupo(p, t);
    if (A.alfa <= 0) return;
    ctx.save();
    ctx.globalAlpha = A.alfa; ctx.translate(0, A.dy * u);
    var D = 30 * u, cx = 8 * u + D / 2, cy = 0.46 * H + D / 2, R = D / 2 - 1.6 * u, e = outCubic(prog(t, tc, 1.2));
    ctx.lineWidth = 3.2 * u; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    if (e > 0.001) { ctx.strokeStyle = pal.acento; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (d.valor / 100) * e); ctx.stroke(); }
    ctx.fillStyle = pal.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    cabe(ctx, cifra(Math.round(d.valor), 0) + '%', 900, 6.8 * u, 'Outfit', D - 8 * u);
    ctx.fillText(cifra(Math.round(d.valor * e), 0) + '%', cx, cy + 0.3 * u);
    // la frase al lado, que se destapa de izquierda a derecha
    var x0 = 8 * u + D + 5 * u, colW = 92 * u - x0;
    fuente(ctx, 900, 7.4 * u, 'Outfit');
    var ls = renglones(ctx, d.titulo, colW);
    var tam = 7.4 * u;
    if (ls.length > 3) { tam = 6 * u; fuente(ctx, 900, tam, 'Outfit'); ls = renglones(ctx, d.titulo, colW).slice(0, 4); }
    var alto = 3 * u + 2.4 * u + ls.length * tam * 1.05, y0 = cy - alto / 2;
    mini(ctx, d.etiqueta, x0, y0 + 1.5 * u, u, pal, 'left');
    var k = outQuad(prog(t, tc + 1.45, 0.6));
    if (k > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - u, y0 + 3.5 * u, (colW + 2 * u) * k, ls.length * tam * 1.05 + 2 * u); ctx.clip();
      fuente(ctx, 900, tam, 'Outfit');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ls.forEach(function (l, i) { ctx.fillText(l, x0, y0 + 5.4 * u + tam * 0.52 + i * tam * 1.05); });
      ctx.restore();
    }
    ctx.restore();
  };
  DIBUJO.lista = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, n = d.items.length;
    var x = 8 * u, w = 84 * u, y = 0.07 * H, pad = 4.2 * u, fila = 5.8 * u, gap = 1.7 * u;
    var h = pad + 10 * u + 2.6 * u + n * fila + (n - 1) * gap + pad;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      var xi = x + 5 * u, yb = y + pad + 8.8 * u;
      fuente(ctx, 900, 10 * u, 'Outfit');
      ctx.fillStyle = pal.acento; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      var num = String(n); ctx.fillText(num, xi, yb);
      var wn = ctx.measureText(num).width + 2.5 * u;
      cabe(ctx, d.titulo, 900, 6 * u, 'Outfit', w - 10 * u - wn);
      ctx.fillStyle = pal.tinta; ctx.fillText(d.titulo, xi + wn, yb);
      d.items.forEach(function (it, i) {
        var a = prog(t, p.marcas[i], 0.4);
        if (a <= 0) return;
        var fy = y + pad + 12.6 * u + i * (fila + gap);
        ctx.save();
        ctx.globalAlpha *= c01(a * 1.6);
        ctx.translate((1 - outBack(a, 1.8)) * -8 * u, 0);
        ctx.fillStyle = pal.acento; ctx.beginPath(); ctx.arc(xi + fila / 2, fy + fila / 2, fila / 2, 0, Math.PI * 2); ctx.fill();
        fuente(ctx, 900, 3.3 * u, 'Outfit'); ctx.fillStyle = pal.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), xi + fila / 2, fy + fila / 2 + 0.15 * u);
        cabe(ctx, it, 700, 4.4 * u, 'Outfit', w - 10 * u - fila - 3 * u);
        ctx.fillStyle = pal.tinta; ctx.textAlign = 'left';
        ctx.fillText(it, xi + fila + 3 * u, fy + fila / 2 + 0.2 * u);
        ctx.restore();
      });
    });
  };
  DIBUJO.comparacion = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, ta = p.marcas[0], tb = p.marcas[1], A = animGrupo(p, t);
    if (A.alfa <= 0) return;
    ctx.save();
    ctx.globalAlpha = A.alfa; ctx.translate(0, A.dy * u);
    var x0 = 10 * u, cw = 80 * u, top = 0.205 * H, chH = 0.37 * H;
    var railH = 0.76 * chH, railTop = top + chH - railH, railW = 0.26 * cw;
    var xa = x0 + 0.08 * cw, xb = x0 + cw - 0.08 * cw - railW, fondoR = top + chH;
    mini(ctx, d.etiqueta, W / 2, top + 1.5 * u, u, pal, 'center');
    var max = Math.max(d.a.valor, d.b.valor) || 1;
    var barra = function (xr, alto, color, valor, e, alfaValor, colorValor) {
      ctx.save();
      rrect(ctx, xr, railTop, railW, railH + 3 * u, 3 * u); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
      var hb = Math.max(e > 0 ? 1.2 * u : 0, alto * e);
      if (hb > 0) {
        ctx.beginPath(); ctx.rect(xr - 1, top, railW + 2, fondoR - top); ctx.clip();
        rrect(ctx, xr, fondoR - hb, railW, hb + 3 * u, 3 * u); ctx.fillStyle = color; ctx.fill();
      }
      ctx.restore();
      if (alfaValor > 0) {
        ctx.save(); ctx.globalAlpha *= alfaValor;
        var tx = (d.prefijo || '') + cifra(valor * e, d.decimales) + (d.sufijo || '');
        cabe(ctx, (d.prefijo || '') + cifra(valor, d.decimales) + (d.sufijo || ''), 900, 8 * u, 'Outfit', railW * 1.5);
        ctx.fillStyle = colorValor; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(tx, xr + railW / 2, fondoR - hb - 2.2 * u);
        ctx.restore();
      }
    };
    var ea = outCubic(prog(t, ta, 0.8)), eb = outCubic(prog(t, tb, 1));
    barra(xa, railH * Math.max(0.06, d.a.valor / max), 'rgba(255,255,255,0.28)', d.a.valor, ea, 1, pal.tinta);
    barra(xb, railH * Math.max(0.06, d.b.valor / max), pal.acento, d.b.valor, eb, c01((t - tb) / 0.2), pal.acento);
    mini(ctx, d.a.texto, xa + railW / 2, fondoR + 4.5 * u, u, pal, 'center');
    mini(ctx, d.b.texto, xb + railW / 2, fondoR + 4.5 * u, u, pal, 'center');
    if (d.insignia) pastilla(ctx, d.insignia, x0 + cw / 2, top + 0.46 * chH, 5 * u, pal, outBack(prog(t, tb + 0.8, 0.45), 2.6));
    ctx.restore();
  };
  DIBUJO.linea = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, n = d.hitos.length;
    var x = 8 * u, w = 84 * u, y = 0.085 * H, pad = 5 * u;
    var h = pad + 3 * u + 5 * u + 22 * u + 5.5 * u;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      mini(ctx, d.titulo || 'Paso a paso', x + 5 * u, y + pad + 1.5 * u, u, pal, 'left');
      var ix = x + 5 * u, iw = w - 10 * u, top = y + pad + 8 * u, ly = top + 9 * u;
      var pos = function (i) { return 0.12 + (n > 1 ? i * 0.76 / (n - 1) : 0); };
      ctx.save();
      rrect(ctx, ix + 0.12 * iw, ly - 0.5 * u, 0.76 * iw, u, 0.5 * u); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
      // la línea avanza de un hito al siguiente mientras lo dices
      var fr = 0;
      if (t >= p.marcas[0]) {
        fr = pos(0);
        for (var i = 0; i < n - 1; i++) {
          var a = p.marcas[i] + 0.05, b = Math.max(a + 0.3, p.marcas[i + 1]);
          if (t >= a) fr = lerp(pos(i), pos(i + 1), c01((t - a) / (b - a)));
        }
      }
      if (fr > 0.12) { rrect(ctx, ix + 0.12 * iw, ly - 0.5 * u, (fr - 0.12) * iw, u, 0.5 * u); ctx.fillStyle = pal.acento; ctx.fill(); }
      ctx.restore();
      d.hitos.forEach(function (hi, i) {
        var a = prog(t, p.marcas[i], 0.35);
        if (a <= 0) return;
        var cx = ix + pos(i) * iw, ultimo = i === n - 1;
        ctx.save();
        ctx.globalAlpha *= c01(a * 1.6);
        ctx.translate(0, (1 - outBack(a, 2)) * 3 * u);
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        cabe(ctx, hi.fecha, 900, 5.4 * u, 'Outfit', 24 * u);
        ctx.fillStyle = pal.tinta; ctx.fillText(hi.fecha, cx, top + 4.8 * u);
        if (ultimo) { ctx.fillStyle = rgba(pal.acento, 0.3); ctx.beginPath(); ctx.arc(cx, ly, 4.1 * u, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = ultimo ? pal.acento : pal.tinta; ctx.beginPath(); ctx.arc(cx, ly, 2.5 * u, 0, Math.PI * 2); ctx.fill();
        if (hi.texto) {
          cabe(ctx, hi.texto, 700, 4 * u, 'Outfit', 24 * u);
          ctx.fillStyle = rgba(pal.tinta, 0.8); ctx.fillText(hi.texto, cx, ly + 7.6 * u);
        }
        ctx.restore();
      });
    });
  };
  DIBUJO.cita = function (ctx, W, H, u, p, t, pal) {
    var d = p.datos, tq = p.marcas[0];
    var x = 8 * u, w = 84 * u, y = 0.075 * H, padX = 5.5 * u;
    var tam = 6.6 * u;
    fuente(ctx, 400, tam, '"Instrument Serif"', 'italic');
    var ls = renglones(ctx, d.texto, w - 2 * padX);
    if (ls.length > 4) { tam = 5.4 * u; fuente(ctx, 400, tam, '"Instrument Serif"', 'italic'); ls = renglones(ctx, d.texto, w - 2 * padX).slice(0, 5); }
    var lh = tam * 1.12, h = 9 * u + ls.length * lh + 3 * u + 3 * u + 4.5 * u;
    conTarjeta(ctx, x, y, w, h, u, animTarjeta(p, t), function () {
      tarjeta(ctx, x, y, w, h, 5 * u, u, pal);
      var k = outBack(prog(t, p.t0 + 0.1, 0.55), 2.2);
      if (k > 0) {
        ctx.save(); ctx.translate(x + 4 * u + 5 * u, y + 7.5 * u); ctx.scale(k, k);
        fuente(ctx, 900, 22 * u, '"Playfair Display"', 'italic');
        ctx.fillStyle = pal.acento; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('“', 0, 3.5 * u);
        ctx.restore();
      }
      // las líneas se destapan al ritmo en que dices la cita
      var total = ls.reduce(function (a, l) { return a + l.length; }, 0) || 1;
      var dur = Math.max(1.2, (p.fin || tq + 2) - tq);
      var vistos = outQuad(prog(t, tq, dur)) * total, acum = 0;
      fuente(ctx, 400, tam, '"Instrument Serif"', 'italic');
      ctx.fillStyle = pal.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ls.forEach(function (l, i) {
        var parte = c01((vistos - acum) / l.length); acum += l.length;
        if (parte <= 0) return;
        var ly = y + 9 * u + i * lh + lh / 2;
        ctx.save();
        ctx.beginPath(); ctx.rect(x + padX - u, ly - lh, (ctx.measureText(l).width + 2 * u) * parte, lh * 2); ctx.clip();
        ctx.fillText(l, x + padX, ly);
        ctx.restore();
      });
      var q = prog(t, p.t0 + 0.55, 0.4);
      if (q > 0) {
        ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - outCubic(q)) * -5 * u, 0);
        mini(ctx, '— ' + d.autor, x + padX, y + 9 * u + ls.length * lh + 4.5 * u, u, pal, 'left', 0.7);
        ctx.restore();
      }
    });
  };

  /* Dibuja la capa del gráfico `p` en el instante t (tiempo del video). El canvas ya está limpio; W×H es el cuadro entero
     (si el canvas es solo la caja, quien llama corre el origen). color: nombre o #hex. */
  function dibujar(ctx, W, H, p, t, color) {
    if (!p || t < p.t0 || t >= p.t1 || !DIBUJO[p.tipo]) return false;
    var pal = paleta(color), u = W / 100;
    ctx.save();
    if (p.forma !== 'encima') fondoConHueco(ctx, W, H, p, t, pal, u);
    DIBUJO[p.tipo](ctx, W, H, u, p, t, pal);
    ctx.restore();
    return true;
  }
  /* Texto corto para la lista de la página («Número gigante · +10.000») */
  function resumen(p) {
    var d = p.datos || {};
    if (p.tipo === 'numero') return (d.prefijo || '') + cifra(d.valor, d.decimales) + (d.sufijo || '') + (d.etiqueta ? ' ' + d.etiqueta.toLowerCase() : '');
    if (p.tipo === 'porcentaje') return cifra(Math.round(d.valor), 0) + '% · ' + d.titulo;
    if (p.tipo === 'lista') return d.items.length + ' ' + (d.titulo || 'puntos');
    if (p.tipo === 'comparacion') return d.a.texto + ' ' + (d.prefijo || '') + cifra(d.a.valor, d.decimales) + (d.sufijo || '') + ' → ' + d.b.texto + ' ' + (d.prefijo || '') + cifra(d.b.valor, d.decimales) + (d.sufijo || '');
    if (p.tipo === 'linea') return d.hitos.map(function (h) { return h.fecha; }).join(' · ');
    if (p.tipo === 'cita') return '«' + d.texto + '» — ' + d.autor;
    return '';
  }

  var API = {
    CANTIDAD: CANTIDAD, COLORES: COLORES, NOMBRES: NOMBRES, FORMA: FORMA, FORMAS: FORMAS, FUENTES: FUENTES,
    limpiar: limpiar, paleta: paleta, reloj: reloj, limpiarDatos: limpiarDatos, elegir: elegir, enInstante: enInstante,
    video: video, css: css, ffmpeg: ffmpeg, caja: caja, dibujar: dibujar, resumen: resumen, cifra: cifra,
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherryGraf = API;
})(typeof window !== 'undefined' ? window : this);

/* patron.js — «Rompiste tu patrón» (27-oct-2026).
 *
 * Sergio: «cada vez que entremos a Cherry y haya un video que haya roto el patrón —si yo siempre tengo 1.000 vistas y un video
 * llegó a 8.000—, que aparezca un modal de felicitación e información… por qué funcionó: el gancho, la idea, el formato, la
 * estructura, la duración, y le recomendaremos que use eso en sus próximos videos». Diseño aprobado (la A, modesta, cada razón
 * en su renglón): https://claude.ai/artifact/TVHVSD8jz3aMkWDUkaiRPi · umbral: 3 veces sus vistas normales.
 *
 * Solo LEE (historial › lista: sin IA, sin créditos). Un reel entra si es de la marca activa, salió en los últimos 14 días, ya
 * tiene sus piezas (el desmontaje) y llegó a 3 veces o más la mediana de las vistas de sus 20 reels anteriores (mínimo 5). Sale
 * una sola vez por reel (localStorage › cherry-patron-visto). «Hacer otro así» abre Guiones con sus mismas piezas
 * (sessionStorage › cherry-otro-asi; lab-guiones.js › tomarOtroAsi).
 */
(function () {
  'use strict';
  var UMBRAL = 3, DIAS = 14, MIN_BASE = 5, CLAVE = 'cherry-patron-visto';
  if (/[?&]ir=/.test(location.search)) return;   // solo en el inicio, no en el editor
  var Q = function () { return window.CherryCuenta; };
  var num = function (x) { return x == null || x === '' || !isFinite(Number(x)) ? null : Number(x); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var llana = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); };
  var cap = function (t) { t = String(t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
  var mil = function (n) { return Math.round(Number(n) || 0).toLocaleString('es-CO'); };
  function mediana(xs) { xs = xs.filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; }); var k = xs.length; return !k ? null : k % 2 ? xs[(k - 1) / 2] : (xs[k / 2 - 1] + xs[k / 2]) / 2; }
  function minSeg(s) { s = Math.round(Number(s) || 0); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function vistos() { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch (e) { return []; } }
  function marcarVisto(id) { try { var l = vistos(); if (l.indexOf(id) < 0) l.push(id); localStorage.setItem(CLAVE, JSON.stringify(l.slice(-200))); } catch (e) {} }
  var pasosDe = function (s) { return String(s || '').split(/→|->/).map(function (p) { return llana(p); }).filter(Boolean); };
  /* misma estructura: una es la otra con pasos de más al final (igual que en Mi proceso) */
  function mismaEstructura(a, b) { var p = pasosDe(a), q = pasosDe(b), m = Math.min(p.length, q.length); return m >= 4 && p.slice(0, m).join('|') === q.slice(0, m).join('|'); }
  /* la estructura con palabras de todos los días: lo que la distingue */
  function estructuraEnPalabras(s) {
    var p = pasosDe(s), hay = function (k) { return p.some(function (x) { return x.indexOf(k) >= 0; }); };
    if (hay('open loop') || hay('aplaza')) return 'Una promesa que se paga al final';
    if (hay('creencia') || hay('lo que cree')) return 'Desmiente lo que todos creen';
    if (hay('objecion')) return 'Responde la duda de quien mira';
    if (hay('ejemplo')) return 'Lo enseña con un ejemplo real';
    if (hay('giro')) return 'Un giro al final';
    return 'Tu estructura de ' + p.length + ' pasos';
  }
  function tituloCorto(v) {
    var t = String(v.texto || v.titulo || '').split(/[\n.:!?¿¡]/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || 'tu reel';
    if (t.length > 42) { t = t.slice(0, 42); t = t.slice(0, Math.max(t.lastIndexOf(' '), 24)) + '…'; }
    return cap(t);
  }
  function veces(x) { return x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10).replace('.', ',').replace(/,0$/, ''); }

  /* ── El porqué: lo de este reel contra los demás de la cuenta ── */
  function analizar(v, otros, normal) {
    var p = (v.historial && v.historial.piezas) || {};
    var orden = otros.slice().sort(function (a, b) { return num(b.visitas) - num(a.visitas); });
    var top = orden[0] || null, buenos = otros.filter(function (x) { return num(x.visitas) >= normal * 1.5; });
    var nombreTop = top && num(v.visitas) >= num(top.visitas) ? 'tu segundo mejor video' : 'tu mejor video';
    var pz = function (x) { return (x.historial && x.historial.piezas) || {}; };
    var si = [], no = [];
    var mirar = function (k, val, igual, etiqueta, frases) {
      if (!val) return;
      var usos = otros.filter(function (x) { return igual(pz(x)[k] || (k === 'tema' ? pz(x).idea : ''), val); });
      if (top && igual(pz(top)[k] || (k === 'tema' ? pz(top).idea : ''), val)) si.push({ k: k, et: etiqueta, val: val, nota: frases.top.replace('{top}', nombreTop) });
      else if (usos.some(function (x) { return buenos.indexOf(x) >= 0; })) si.push({ k: k, et: etiqueta, val: val, nota: frases.bueno });
      else if (!usos.length) si.push({ k: k, et: etiqueta, val: val, nota: 'Es la primera vez que lo usas: fue lo distinto.' });
      else no.push({ k: k, val: val });
    };
    var igualTxt = function (a, b) { return !!a && llana(a) === llana(b); };
    mirar('gancho', p.gancho, igualTxt, 'Gancho', { top: 'El mismo tipo de gancho de {top}.', bueno: 'También estuvo en otro de tus videos que más funcionaron.' });
    mirar('tema', p.tema || p.idea, igualTxt, 'Idea', { top: 'También es la idea de {top}.', bueno: 'Tus videos que más funcionaron hablan de esto.' });
    mirar('estructura', p.estructura, function (a, b) { return !!a && mismaEstructura(a, b); }, 'Estructura', { top: 'La misma de {top}.', bueno: 'La misma de otro de tus videos que más funcionaron.' });
    mirar('formato', p.formato, igualTxt, 'Formato', { top: 'El mismo formato de {top}.', bueno: 'El mismo formato de otro de tus videos que más funcionaron.' });
    var d = num(v.dur), dm = mediana(otros.map(function (x) { return num(x.dur); }));
    if (d && dm) {
      var r = d / dm;
      if (r >= 0.75 && r <= 1.33) no.push({ k: 'dur', val: minSeg(d) });
      else si.push({ k: 'dur', et: 'Duración', val: minSeg(d), nota: 'Fue más ' + (r < 1 ? 'corto' : 'largo') + ' que tus videos normales (' + minSeg(d) + ' contra ' + minSeg(dm) + ').' });
    }
    return { p: p, si: si.slice(0, 3), no: no };
  }

  /* ── Lo que se pinta ── */
  var CSS = [
    '.rp-velo { position: fixed; inset: 0; z-index: 2147483000; background: rgba(20,12,17,.42); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); display: grid; place-items: center; padding: 16px; overflow-y: auto; }',
    '.rp { position: relative; background: #FCF9F7; color: #140C11; border-radius: 24px; box-shadow: 0 40px 90px -40px rgba(20,12,17,.7); width: min(680px, 100%); display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; padding: 20px; font: 400 15px/1.5 "Space Grotesk", "Segoe UI", system-ui, sans-serif; }',
    '.rp-conf { position: absolute; inset: 0; pointer-events: none; overflow: hidden; border-radius: 24px; z-index: 0; }',
    '.rp-conf i { position: absolute; top: -12px; width: 7px; height: 11px; border-radius: 2px; animation: rpCae 2.8s linear 1 both; opacity: .85; }',
    '@keyframes rpCae { to { transform: translateY(620px) rotate(320deg); opacity: 0; } }',
    '.rp > :not(.rp-conf):not(.rp-x) { position: relative; z-index: 1; }',
    '.rp-x { position: absolute; top: 12px; right: 12px; z-index: 2; width: 32px; height: 32px; border-radius: 50%; border: 0; background: #F5EEEA; color: rgba(20,12,17,.66); font: 600 15px sans-serif; cursor: pointer; }',
    '.rp-izq { display: grid; gap: 8px; align-content: start; }',
    '.rp-tapa { position: relative; width: 100%; aspect-ratio: 9 / 16; border-radius: 14px; overflow: hidden; background: #140C11; }',
    '.rp-tapa img { width: 100%; height: 100%; object-fit: cover; display: block; }',
    '.rp-veces { position: absolute; left: 8px; bottom: 8px; background: #FF2D8A; color: #fff; font: 900 22px/1 Outfit, "Arial Black", sans-serif; padding: 6px 9px; border-radius: 11px; }',
    '.rp-veces small { display: block; font: 600 9.5px "Space Grotesk", sans-serif; margin-top: 2px; }',
    '.rp-num { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; font-size: 12px; color: rgba(20,12,17,.66); padding: 5px 2px; border-bottom: 1px solid rgba(20,12,17,.08); }',
    '.rp-num b { font: 800 14px Outfit, sans-serif; color: #140C11; }',
    '.rp-der { display: grid; gap: 12px; align-content: start; }',
    '.rp-cab { display: flex; align-items: center; gap: 8px; }',
    '.rp-logo { width: 26px; height: 26px; background: #140C11; -webkit-mask: url(assets/marca/cherry-favicon.svg) center / contain no-repeat; mask: url(assets/marca/cherry-favicon.svg) center / contain no-repeat; }',
    '.rp-eti { font: 500 10.5px "DM Mono", ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; color: #C2005F; }',
    '.rp-tit { margin: 0; font: 900 25px/1.05 Outfit, "Arial Black", sans-serif; letter-spacing: -.025em; padding-right: 30px; text-wrap: balance; }',
    '.rp-mano { font: 700 20px/1 Caveat, "Segoe Print", cursive; color: #FF2D8A; margin-top: -4px; }',
    '.rp-sub { margin: 0 0 -4px; font: 800 14px Outfit, sans-serif; }',
    '.rp-raz { display: grid; grid-template-columns: 22px 78px minmax(0, 1fr); gap: 8px; align-items: start; background: #F5EEEA; border-radius: 12px; padding: 9px 10px; }',
    '.rp-raz i { font-style: normal; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: #FF2D8A; color: #fff; font: 700 11px sans-serif; margin-top: 1px; }',
    '.rp-raz span { font: 500 10px "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: rgba(20,12,17,.42); padding-top: 4px; }',
    '.rp-raz b { display: block; font: 700 14px/1.3 "Space Grotesk", sans-serif; }',
    '.rp-raz q { display: block; font-size: 13px; margin-top: 1px; quotes: "«" "»"; }',
    '.rp-raz small { display: block; font-size: 12px; color: rgba(20,12,17,.42); margin-top: 2px; }',
    '.rp-razones { display: grid; gap: 6px; }',
    '.rp-nofue { margin: 0; font-size: 12.5px; color: rgba(20,12,17,.42); padding: 0 2px; }',
    '.rp-receta { background: #140C11; color: #FCF9F7; border-radius: 14px; padding: 11px 13px; display: grid; gap: 2px; }',
    '.rp-receta .rp-eti { color: #FFC93C; }',
    '.rp-receta p { margin: 0; font-size: 14px; }',
    '.rp-acc { display: flex; gap: 8px; flex-wrap: wrap; }',
    '.rp-btn { border-radius: 999px; padding: 10px 16px; font: 700 13.5px "Space Grotesk", sans-serif; border: 0; cursor: pointer; text-decoration: none; display: inline-block; }',
    '.rp-btn.rosa { background: #FF2D8A; color: #fff; }',
    '.rp-btn.linea { background: #F5EEEA; color: #140C11; }',
    '.rp-btn:focus-visible, .rp-x:focus-visible { outline: 2px solid #FF2D8A; outline-offset: 2px; }',
    '@media (max-width: 640px) { .rp { grid-template-columns: minmax(0, 1fr); } .rp-izq { grid-template-columns: 96px minmax(0, 1fr); } .rp-raz { grid-template-columns: 22px minmax(0, 1fr); } .rp-raz span { display: none; } }',
    '@media (prefers-reduced-motion: reduce) { .rp-conf { display: none; } }',
  ].join('\n');

  function mostrar(c) {
    var v = c.v, a = c.a, p = a.p;
    if (!document.getElementById('rp-css')) { var st = document.createElement('style'); st.id = 'rp-css'; st.textContent = CSS; document.head.appendChild(st); }
    var col = ['#FF2D8A', '#FFC93C', '#140C11', '#F6B7D2'], conf = '';
    for (var i = 0; i < 20; i++) conf += '<i style="left:' + Math.round(2 + Math.random() * 96) + '%;background:' + col[i % 4] + ';animation-delay:' + (Math.random() * 1.2).toFixed(2) + 's;animation-duration:' + (2.2 + Math.random() * 1.2).toFixed(2) + 's"></i>';
    var x = veces(c.veces);
    var nums = [['Vistas', mil(v.visitas)], num(v.retencion) != null ? ['Se quedaron', Math.round(num(v.retencion)) + ' %'] : null,
      num(v.guardados) != null ? ['Guardaron', mil(v.guardados)] : null, num(v.reposts) != null ? ['Compartieron', mil(v.reposts)] : null].filter(Boolean);
    var raz = a.si.map(function (r) {
      var val = r.k === 'estructura' ? estructuraEnPalabras(r.val) : r.k === 'dur' ? r.val : cap(r.val);
      return '<div class="rp-raz"><i>✓</i><span>' + esc(r.et) + '</span><div><b>' + esc(val) + '</b>' +
        (r.k === 'gancho' && p.gancho_frase ? '<q>' + esc(p.gancho_frase) + '</q>' : '') + '<small>' + esc(r.nota) + '</small></div></div>';
    }).join('');
    var NOM = { gancho: 'el gancho', tema: 'la idea', estructura: 'la estructura', formato: 'el formato', dur: 'la duración' };
    var nofue = a.no.filter(function (n) { return n.k !== 'estructura'; }).map(function (n) { return NOM[n.k] + ' (' + (n.k === 'dur' ? n.val : String(n.val).toLowerCase()) + ')'; });
    var siK = {}; a.si.forEach(function (r) { siK[r.k] = r; });
    var t = [];
    if (siK.gancho) t.push('otro gancho de <b>' + esc(cap(siK.gancho.val)) + '</b>');
    if (siK.tema) t.push((t.length ? 'sobre' : 'otro video sobre') + ' <b>' + esc(String(siK.tema.val).toLowerCase()) + '</b>');
    if (siK.formato) t.push((t.length ? 'en' : 'otro video en') + ' <b>' + esc(String(siK.formato.val).toLowerCase()) + '</b>');
    if (siK.estructura) t.push((t.length ? ', con' : 'otro video con') + ' la misma estructura');
    if (siK.dur) t.push((t.length ? ', de' : 'otro video de') + ' unos ' + siK.dur.val);
    var receta = t.length ? cap(t.join(' ').replace(/ ,/g, ',')) + '.' : 'Míralo otra vez y repite lo que sientas distinto: el tema, la primera frase, cómo se ve.';
    var velo = document.createElement('div');
    velo.className = 'rp-velo';
    velo.innerHTML = '<div class="rp" role="dialog" aria-modal="true" aria-labelledby="rp-tit">' +
      '<div class="rp-conf" aria-hidden="true">' + conf + '</div>' +
      '<button type="button" class="rp-x" data-rp-cerrar aria-label="Cerrar">✕</button>' +
      '<div class="rp-izq"><div class="rp-tapa">' + (v.tapa ? '<img src="' + esc(v.tapa) + '" alt="Portada del reel">' : '') +
        '<div class="rp-veces">' + x + '×<small>lo normal</small></div></div>' +
        '<div>' + nums.map(function (n) { return '<div class="rp-num">' + n[0] + ' <b>' + n[1] + '</b></div>'; }).join('') + '</div></div>' +
      '<div class="rp-der">' +
        '<div class="rp-cab"><span class="rp-logo" aria-hidden="true"></span><span class="rp-eti">Rompiste tu patrón</span></div>' +
        '<h2 class="rp-tit" id="rp-tit">¡Tu reel «' + esc(tituloCorto(v)) + '» llegó a ' + x + ' veces lo normal!</h2>' +
        '<span class="rp-mano">¡esto es lo que hay que repetir!</span>' +
        (raz ? '<p class="rp-sub">Por qué funcionó</p><div class="rp-razones">' + raz + '</div>' : '') +
        (nofue.length ? '<p class="rp-nofue">No fue ' + nofue.join(' ni ') + ': esos los usas siempre.</p>' : '') +
        '<div class="rp-receta"><span class="rp-eti">Para tu próximo video</span><p>' + receta + '</p></div>' +
        '<div class="rp-acc"><button type="button" class="rp-btn rosa" data-rp-otro>Hacer otro así</button>' +
          (v.enlace ? '<a class="rp-btn linea" href="' + esc(v.enlace) + '" target="_blank" rel="noopener">Ver el video</a>' : '') + '</div>' +
      '</div></div>';
    document.body.appendChild(velo);
    var cerrar = function () { marcarVisto(c.id); velo.remove(); document.removeEventListener('keydown', tecla); };
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    velo.addEventListener('click', function (e) {
      if (e.target === velo || e.target.closest('[data-rp-cerrar]')) { cerrar(); return; }
      if (e.target.closest('a.rp-btn')) { marcarVisto(c.id); return; }
      if (e.target.closest('[data-rp-otro]')) {
        try {
          sessionStorage.setItem('cherry-otro-asi', JSON.stringify({ tema: p.tema || '', idea: p.idea || '', gancho: p.gancho || '', frase: p.gancho_frase || '',
            formato: p.formato || '', estructura: p.estructura || '', de: c.id }));
        } catch (er) { /* sin sessionStorage: Guiones abre igual */ }
        marcarVisto(c.id);
        location.href = 'herramientas/laboratorio?modo=guiones&nuevo=1';
      }
    });
    var b = velo.querySelector('[data-rp-otro]'); if (b) b.focus();
  }

  /* ── Buscar el reel que rompió el patrón ── */
  var hecho = false;
  function buscar() {
    var q = Q();
    if (hecho || !q || !q.llamar || !q.marcaNormal) return;
    hecho = true;
    var marca = q.marcaNormal(), unaMarca = q.cuantasMarcas ? q.cuantasMarcas() <= 1 : false;
    q.llamar('historial', { accion: 'lista' }).then(function (r) {
      var vs = ((r && r.videos) || []).filter(function (v) {
        return v && num(v.visitas) > 0 && Date.parse(v.creado || '') > 0 && (v.cuenta ? v.cuenta === marca : unaMarca);
      }).sort(function (a, b) { return Date.parse(b.creado) - Date.parse(a.creado); });
      var ya = vistos(), hace = Date.now() - DIAS * 864e5, mejor = null;
      vs.forEach(function (v, i) {
        if (Date.parse(v.creado) < hace || ya.indexOf(v.id) >= 0 || !(v.historial && v.historial.piezas)) return;
        var antes = vs.slice(i + 1, i + 21);
        if (antes.length < MIN_BASE) return;
        var normal = mediana(antes.map(function (x) { return num(x.visitas); }));
        if (!normal) return;
        var k = num(v.visitas) / normal;
        if (k >= UMBRAL && (!mejor || k > mejor.veces)) mejor = { id: v.id, v: v, veces: k, normal: normal, antes: antes };
      });
      if (!mejor) return;
      mejor.a = analizar(mejor.v, vs.filter(function (x) { return x !== mejor.v; }), mejor.normal);
      /* si hay otra ventana abierta (la bienvenida, el cobro…), se espera a la próxima entrada */
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([hidden])')) return;
      mostrar(mejor);
    }).catch(function () { /* sin historial: nada */ });
  }
  function arrancar() {
    var q = Q();
    if (q && q.cuandoLlegueInstagram) q.cuandoLlegueInstagram(function () { setTimeout(buscar, 1200); });
    setTimeout(buscar, 7000);   // por si Instagram no llega (cuenta sin conectar, error): igual se mira el historial
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
  window.CherryPatron = { analizar: analizar, buscar: function () { hecho = false; buscar(); }, olvidar: function () { try { localStorage.removeItem(CLAVE); } catch (e) {} } };
})();

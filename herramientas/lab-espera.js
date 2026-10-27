/* lab-espera.js — «La espera dulce» (27-oct-2026), la opción B que escogió Sergio: «la vitrina».
 *
 * Sergio: «tenemos que colocar una animación de carga entretenida, que al mismo tiempo diga frases de nuestra identidad de
 * marca (puliendo la cereza, caramelizando ganchos, maquillando open loops)… y que la persona vea los pasos: que sepa que ya
 * el paso 1 se concluyó o está en el paso 2… para que no sea una espera a la deriva».
 * Propuesta: https://claude.ai/artifact/7ECSiT4virftUMRTz3Faw1
 *
 * Cuatro estaciones en una línea; el disco de Cherry (el logo de verdad, assets/marca/cherry-favicon.svg: la cereza calada)
 * rueda a la siguiente cuando una termina y, mientras espera, late como en la animación de marca. Cada estación cerrada
 * queda con su ✓ y lo que tardó. ⚠️ Los pasos los marca el SERVIDOR cuando de verdad termina cada uno (CherryApp.iaAvance /
 * funcionAvance), nunca un reloj: el reloj solo cuenta cuánto falta, con lo que tardaron las veces anteriores en este
 * navegador.
 *
 *   var e = LabEspera.crear({ clave: 'normal', pasos: LabEspera.NORMAL, nota: '…' });
 *   e.poner(caja, 'Escribiendo tu guion…');   // pinta en esa caja (se puede volver a llamar si la caja se repinta)
 *   e.paso(2);                                // el servidor avisó que terminó el paso 2
 *   e.fin();  e.parar();
 */
(function () {
  var NORMAL = [
    { n: 'Escribiendo', seg: 45, f: ['Caramelizando ganchos', 'Batiendo la primera frase', 'Horneando escenas a fuego lento', 'Rellenando el centro con tu idea', 'Espolvoreando ejemplos'] },
    { n: 'Revisando', seg: 35, f: ['Maquillando open loops', 'Contando palabras con cucharita', 'Sacándole las pepas a las frases largas', 'Probando que no quede empalagoso', 'Quitándole el relleno que sobra'] },
    { n: 'Dirigiendo', seg: 25, f: ['Luces, cámara y crema batida', 'Leyéndolo como lo oiría tu abuela', 'Escogiendo el plano de cada escena', 'Orquestando el remate', 'Acomodando la vitrina'] },
    { n: 'Puliendo', seg: 15, f: ['Puliendo la cereza', 'Dándole el último brillo', 'Poniéndole la cereza al pastel', 'Recortando las puntas', 'Envolviéndolo para regalo'] },
  ];
  /* el premium piensa el plan antes de escribir; el director va dentro de «Escribiendo» */
  var PREMIUM = [
    { n: 'Pensando el plan', seg: 50, f: ['Escogiendo la cereza más roja', 'Planeando el pastel por capas', 'Midiendo la receta', 'Buscando el problema que más pica', 'Guardando la sorpresa para el final'] },
    { n: 'Escribiendo', seg: 75, f: ['Caramelizando ganchos', 'Batiendo la primera frase', 'Horneando escenas a fuego lento', 'Luces, cámara y crema batida', 'Escogiendo el plano de cada escena'] },
    NORMAL[1],
    NORMAL[3],
  ];
  var LISTO = '¡Listo! Tu guion está servido';

  var CSS = [
    '.esp { display: grid; gap: 14px; }',
    '.esp h4 { margin: 0; }',
    '.esp-vit { position: relative; height: 128px; margin: 4px 8px 0; }',
    '.esp-riel { position: absolute; left: 22px; right: 22px; top: 44px; height: 4px; border-radius: 99px; background: var(--borde, rgba(20,12,17,.1)); }',
    '.esp-riel i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 99px; background: linear-gradient(90deg, #FF2D8A, #FFC93C); transition: width .6s linear; }',
    '.esp-est { position: absolute; top: 24px; width: 44px; height: 44px; margin-left: -22px; border-radius: 50%; background: var(--tarjeta-a, #FCF9F7);',
    '  box-shadow: inset 0 0 0 2px var(--borde, rgba(20,12,17,.1)); display: grid; place-items: center; font: 800 15px var(--f-disp, sans-serif); color: var(--tinta-3, rgba(20,12,17,.4));',
    '  transition: background .3s, box-shadow .3s, color .3s; }',
    '.esp-est.ya { background: var(--tinta, #140C11); color: var(--tarjeta-a, #FCF9F7); box-shadow: none; }',
    '.esp-est.ahora { box-shadow: inset 0 0 0 2.5px #FF2D8A; color: #C2005F; }',
    '.esp-nom { position: absolute; top: 76px; width: 96px; margin-left: -48px; text-align: center; font: 700 13px/1.2 var(--f-texto, sans-serif); color: var(--tinta-3, rgba(20,12,17,.4)); }',
    '.esp-nom small { display: block; margin-top: 3px; font: 500 10.5px var(--f-mono, monospace); color: var(--tinta-3, rgba(20,12,17,.4)); }',
    '.esp-nom.ya, .esp-nom.ahora { color: var(--tinta, #140C11); }',
    '.esp-disco { position: absolute; top: -10px; width: 36px; height: 36px; margin-left: -18px; transition: left 1s cubic-bezier(.5, 0, .3, 1); }',
    /* el logo de verdad: el disco con la cereza calada, en negro sobre papel (assets/marca/cherry-favicon.svg como máscara) */
    '.esp-disco i { display: block; width: 100%; height: 100%; background: var(--esp-disco, var(--tinta, #0C0409));',
    '  -webkit-mask: url(../assets/marca/cherry-favicon.svg) center / contain no-repeat; mask: url(../assets/marca/cherry-favicon.svg) center / contain no-repeat;',
    '  animation: espLatido 1.9s ease-in-out infinite; }',
    '.esp-disco.rueda i { animation: espRueda 1s cubic-bezier(.5, 0, .3, 1); }',
    '@keyframes espLatido { 0%, 100% { transform: scale(1) rotate(0); } 30% { transform: translateY(-8%) scale(1.05) rotate(-4deg); } 60% { transform: scale(1.02) rotate(2deg); } }',
    '@keyframes espRueda { from { transform: rotate(0); } to { transform: rotate(360deg); } }',
    '.esp-frase { font: 700 27px/1.1 var(--f-mano, "Caveat", cursive); color: #C2005F; min-height: 30px; transition: opacity .3s, transform .3s; }',
    '.esp-frase.sale { opacity: 0; transform: translateY(-6px); }',
    '.esp-falta { font: 500 12px var(--f-mono, monospace); color: var(--tinta-2, rgba(20,12,17,.62)); }',
    '@media (max-width: 520px) { .esp-nom { width: 72px; margin-left: -36px; font-size: 11.5px; } }',
    '@media (prefers-reduced-motion: reduce) { .esp-disco, .esp-riel i { transition: none; } .esp-disco i, .esp-disco.rueda i { animation: none; } .esp-frase { transition: none; } }',
  ].join('\n');
  function estilos() {
    if (document.getElementById('lab-espera-css')) return;
    var s = document.createElement('style'); s.id = 'lab-espera-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* lo que tardó cada paso las últimas veces, en este navegador: de ahí sale «faltan ≈» */
  function aprendido(clave, i, porDefecto) {
    try {
      var l = JSON.parse(localStorage.getItem('cherry-espera-' + clave) || '{}')[i] || [];
      return l.length ? l.reduce(function (a, b) { return a + b; }, 0) / l.length : porDefecto;
    } catch (e) { return porDefecto; }
  }
  function aprender(clave, i, seg) {
    try {
      var o = JSON.parse(localStorage.getItem('cherry-espera-' + clave) || '{}');
      o[i] = (o[i] || []).concat([Math.round(seg)]).slice(-5);
      localStorage.setItem('cherry-espera-' + clave, JSON.stringify(o));
    } catch (e) {}
  }

  function crear(op) {
    estilos();
    var pasos = op.pasos || NORMAL, clave = op.clave || 'normal';
    var est = pasos.map(function (p, i) { return aprendido(clave, i, p.seg); });
    var hecho = pasos.map(function () { return null; });   // segundos que tardó (o 0 si no hizo falta)
    var actual = 0, desde = Date.now(), fraseI = 0, fraseDesde = Date.now(), listo = false, caja = null, titulo = '', reloj = null;
    var reducido = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    function x(i) { return 'calc(22px + (100% - 44px) * ' + (pasos.length > 1 ? i / (pasos.length - 1) : 0) + ')'; }
    function poner(c, t) {
      caja = c; if (t) titulo = t;
      if (!caja) return;
      caja.innerHTML = '<div class="esp"><h4>' + esc(titulo) + '</h4>' + (op.nota ? '<p class="d" style="margin:0">' + esc(op.nota) + '</p>' : '') +
        '<div class="esp-vit"><div class="esp-riel"><i></i></div>' + pasos.map(function (p, i) {
          return '<div class="esp-est" data-i="' + i + '" style="left:' + x(i) + '"></div><div class="esp-nom" data-i="' + i + '" style="left:' + x(i) + '">' + esc(p.n) + '<small></small></div>';
        }).join('') + '<div class="esp-disco" style="left:' + x(Math.min(actual, pasos.length - 1)) + '"><i></i></div></div>' +
        '<div class="esp-frase"></div><div class="esp-falta" role="status" aria-live="polite"></div></div>';
      pintar(true);
      if (!reloj && !listo) reloj = setInterval(function () { pintar(false); }, 250);
    }
    function frase() { return listo ? LISTO : pasos[actual].f[fraseI % pasos[actual].f.length]; }
    function pintar(todo) {
      if (!caja || !caja.isConnected) return;
      var q = function (s) { return caja.querySelectorAll(s); };
      var ahora = Date.now(), dentro = (ahora - desde) / 1000;
      q('.esp-est').forEach(function (n) { var i = Number(n.dataset.i); n.classList.toggle('ya', hecho[i] !== null); n.classList.toggle('ahora', !listo && i === actual); n.textContent = hecho[i] !== null ? '✓' : String(i + 1); });
      q('.esp-nom').forEach(function (n) {
        var i = Number(n.dataset.i); n.classList.toggle('ya', hecho[i] !== null); n.classList.toggle('ahora', !listo && i === actual);
        n.querySelector('small').textContent = hecho[i] !== null ? (hecho[i] ? '✓ ' + Math.round(hecho[i]) + ' s' : '✓') : '≈ ' + Math.round(est[i]) + ' s';
      });
      var riel = caja.querySelector('.esp-riel i'); if (riel) riel.style.width = (pasos.length > 1 ? Math.min(1, Math.max(0, (listo ? pasos.length - 1 : actual) + (listo ? 0 : Math.min(.9, dentro / Math.max(1, est[actual])))) / (pasos.length - 1)) : 1) * 100 + '%';
      /* la frase cambia cada 3 s, con su salida suave */
      var fe = caja.querySelector('.esp-frase');
      if (!listo && ahora - fraseDesde > 3000) { fraseI++; fraseDesde = ahora; todo = true; }
      if (todo && fe) {
        if (reducido || !fe.textContent) fe.textContent = frase();
        else { fe.classList.add('sale'); setTimeout(function () { fe.textContent = frase(); fe.classList.remove('sale'); }, 280); }
      }
      var falta = caja.querySelector('.esp-falta');
      if (falta) {
        if (listo) falta.textContent = 'Tardó ' + Math.round(hecho.reduce(function (a, b) { return a + (b || 0); }, 0)) + ' s';
        else {
          var resto = Math.max(0, est[actual] - dentro) + est.slice(actual + 1).reduce(function (a, b) { return a + b; }, 0);
          falta.textContent = 'Paso ' + (actual + 1) + ' de ' + pasos.length + ' · ' + (resto > 3 ? 'faltan ≈ ' + Math.round(resto) + ' s' : 'ya casi');
        }
      }
    }
    /* el servidor avisó que terminó el paso n (1, 2, 3…): ese queda con su ✓ y el disco rueda al siguiente */
    function paso(n) {
      n = Math.min(pasos.length, Number(n) || 0);
      if (listo || n <= actual) return;
      var ahora = Date.now(), seg = (ahora - desde) / 1000;
      for (var i = actual; i < n; i++) {
        hecho[i] = i === actual ? seg : 0;            // los que se saltaron (no hicieron falta) quedan con ✓ sin tiempo
        if (i === actual && seg > 0.5) aprender(clave, i, seg);
      }
      actual = n; desde = ahora; fraseI = 0; fraseDesde = ahora;
      if (actual >= pasos.length) { fin(); return; }
      var d = caja && caja.querySelector('.esp-disco');
      if (d) { d.style.left = x(actual); if (!reducido) { d.classList.remove('rueda'); void d.offsetWidth; d.classList.add('rueda'); setTimeout(function () { d.classList.remove('rueda'); }, 1000); } }
      pintar(true);
    }
    function fin() {
      if (listo) return;
      var seg = (Date.now() - desde) / 1000;
      for (var i = actual; i < pasos.length; i++) { hecho[i] = i === actual ? seg : 0; if (i === actual && seg > 0.5) aprender(clave, i, seg); }
      listo = true; actual = pasos.length - 1;
      var d = caja && caja.querySelector('.esp-disco'); if (d) d.style.left = x(pasos.length - 1);
      parar(); pintar(true);
    }
    function parar() { if (reloj) { clearInterval(reloj); reloj = null; } }
    return { poner: poner, paso: paso, fin: fin, parar: parar };
  }

  window.LabEspera = { crear: crear, NORMAL: NORMAL, PREMIUM: PREMIUM };
})();

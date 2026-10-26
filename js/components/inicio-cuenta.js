/* inicio-cuenta.js — tu cuenta de Instagram en el inicio: TRES tarjetas que comparten los mismos datos
 * (4-oct-2026: Sergio escogió la opción A «Escenario», https://claude.ai/artifact/5Bs4CNGR61pqbntZG98bhV)
 *
 *   C.tarjetaNivel()  → «Tu nivel»: el aro que brilla con tu cereza joya y las cinco cerezas (tocar una abre su ventana).
 *   C.tarjetaCuenta() → «Tu cuenta» (6-oct): una réplica de tu perfil de Instagram (clase .tk-perfil; ⚠️ NO «.ig»: esa
 *                       ya es la vista de Instagram del editor y lleva pointer-events:none). Foto con su aro, usuario, números,
 *                       nombre y biografía; tus seis números son los DESTACADOS y se abren como HISTORIAS; abajo las
 *                       pestañas Números / Qué te funciona / Reels.
 *   C.tarjetaVideo()  → «Tu video»: el último reel y cómo le fue; cambia solo cada 6 s y la tira de abajo marca cuál va.
 *
 * ⭐ LO QUE DECIDIÓ SERGIO (sigue valiendo)
 *   · «Viral» no se dice. Niveles: Aprendiz → Creador → Experto → Maestro → Leyenda.
 *   · ⚠️ NADA ESCRITO A MANO. Todo sale de Instagram (CherryCuenta.instagram() y ig-metricas › modo «cuenta»). Sin cuenta
 *     conectada se dice «Conecta tu Instagram» y no se enseña nada más.
 *   · Lo único que sale del Laboratorio es «Qué te funciona» (ganchos, ideas, formatos, estructuras).
 *
 * Los nodos sobreviven a los redibujos (C.render() rehace la app en cada tecla del buscador): se crean una vez y se reutilizan.
 */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const LAB = (ir) => 'herramientas/laboratorio.html' + (ir ? '?ir=' + ir : '');
  const VUELTA = 6000;

  let nodoC = null, nodoN = null, nodoV = null, listo = false;
  let ig = null;            // { marca, perfil, videos } de CherryCuenta
  let cuenta = null;        // ig-metricas › cuenta: { conectada, actual, anterior, seguidoresDia }
  let pedidaCuenta = '';    // la marca para la que ya se pidió
  let lab = null;           // el documento del Laboratorio (solo para «Qué te funciona»)
  let nivel = null;         // el nivel calculado (lo usan la tarjeta y la ventana)
  let tab = 'seg', jv = 0, reloj = 0, quieto = false, ultimaGrafica = '';
  try { tab = localStorage.getItem('cherry-cuenta-grafica') || 'seg'; } catch (e) { /* sin almacenamiento */ }

  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const Q = () => window.CherryCuenta;
  const n = (x) => (x == null || x === '' || !isFinite(Number(x))) ? null : Number(x);
  const media = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  /* el del medio: la mitad tuvo más y la mitad menos. Un viral no lo infla (6-oct, Sergio aceptó usarlo para el nivel y los destacados) */
  const mediana = (xs) => { if (!xs.length) return 0; const o = xs.slice().sort((a, b) => a - b), k = o.length; return k % 2 ? o[(k - 1) / 2] : (o[k / 2 - 1] + o[k / 2]) / 2; };
  const coma = (x) => String(x).replace('.', ',');
  function mil(v) {
    v = n(v); if (v == null) return '—';
    if (v >= 1e6) return coma(Math.round(v / 1e5) / 10) + ' mill.';
    if (v >= 1e4) return Math.round(v / 1e3) + ' mil';
    return Math.round(v).toLocaleString('es-CO');
  }
  const veces = (a, b) => (n(a) && n(b)) ? '×' + coma(Math.round(a / b * 10) / 10) : '';
  /* (15-oct, rebrand sobrio) las vistas cortas de las barras y de la tira: 5,4 mil · 743 */
  function milCorto(v) {
    v = n(v); if (v == null) return '—';
    if (v >= 1e6) return coma(Math.round(v / 1e5) / 10) + ' mill.';
    if (v >= 1e4) return Math.round(v / 1e3) + ' mil';
    if (v >= 1e3) return coma(Math.round(v / 100) / 10) + ' mil';
    return String(Math.round(v));
  }
  /* (15-oct, rebrand sobrio) los colores de la marca en un degradé: de amarillo (0) a fucsia (1) */
  const mezcla = (t) => { t = Math.max(0, Math.min(1, t)); return 'rgb(255,' + Math.round(201 - 156 * t) + ',' + Math.round(60 + 78 * t) + ')'; };
  /* el anillo por segmentos (como los medidores de los relojes de sus referencias): p de 100 en el degradé de la marca */
  function anillo(p, o) {
    const N = o.n, c = o.lado / 2; let s = '';
    for (let i = 0; i < N; i++) {
      const a = (-90 + 360 * i / N) * Math.PI / 180, on = i / N * 100 < p;
      s += '<line class="tk-sg" style="animation-delay:' + (i * 16) + 'ms" x1="' + (c + o.r1 * Math.cos(a)).toFixed(1) + '" y1="' + (c + o.r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (c + o.r2 * Math.cos(a)).toFixed(1) + '" y2="' + (c + o.r2 * Math.sin(a)).toFixed(1) + '" stroke="' + (on ? mezcla(i / Math.max(1, N * p / 100)) : o.vacio) +
        '" stroke-width="' + o.grueso + '" stroke-linecap="round"/>';
    }
    return '<svg viewBox="0 0 ' + o.lado + ' ' + o.lado + '" aria-hidden="true">' + s + '</svg>';
  }

  /* ── Los niveles ─────────────────────────────────────────────────────────────────────────────
     (6-oct, Sergio: «hay que cambiar el cálculo que determina cada nivel»; antes era vistas ÷ seguidores y con 50 mil
     seguidores casi nadie salía de Aprendiz.) Se toma tu REEL TÍPICO (la mediana de los últimos 10: Sergio aceptó esa
     recomendación; el promedio de todos lo inflaban dos virales de 2024) y se compara con LO NORMAL para una cuenta de tu
     tamaño (normalVis, los números de Sergio). ⚠️ Los números son de Sergio. */
  /* (26-oct) la cuenta del nivel vive en js/resumen-cuenta.js (CherryResumen), compartida con Mi proceso */
  const VECES = window.CherryResumen.VECES;   // veces lo normal para ser Creador, Experto, Maestro y Leyenda
  const PISO = window.CherryResumen.PISO;     // y por lo menos estas vistas (una cuenta de 100 seguidores no es Leyenda con 2.000)
  /* ⚠️ (4-oct, Sergio) Cada texto dice lo que el nivel MIDE. Nada de «te ven tus seguidores»: Instagram nunca le muestra un
     video a todos tus seguidores. */
  const NIVELES = [
    { n: 'Aprendiz', que: 'Es el primer nivel: tus reels todavía tienen menos vistas de lo normal para una cuenta de tu tamaño.',
      como: 'Tu reel típico tiene <b>menos vistas de lo normal</b> para tu tamaño.' },
    { n: 'Creador', que: 'Tus reels ya llegan a lo normal para tu tamaño o un poco más: vas por buen camino.',
      como: 'Tu reel típico tiene <b>entre 1 y 2 veces</b> lo normal para tu tamaño, y por lo menos <b>500</b> vistas.' },
    { n: 'Experto', que: 'Tus reels tienen varias veces lo normal para tu tamaño: Instagram ya los recomienda a mucha gente que no te conoce.',
      como: 'Tu reel típico tiene <b>entre 2 y 5 veces</b> lo normal para tu tamaño, y por lo menos <b>2.000</b> vistas.' },
    { n: 'Maestro', que: 'Tus reels se comparten y se mueven solos: llegan a cinco veces lo normal o más.',
      como: 'Tu reel típico tiene <b>entre 5 y 15 veces</b> lo normal para tu tamaño, y por lo menos <b>10.000</b> vistas.' },
    { n: 'Leyenda', que: 'Lo más alto: tus reels llegan a muchísima más gente de lo normal para una cuenta de tu tamaño.',
      como: 'Tu reel típico tiene <b>15 veces lo normal o más</b> para tu tamaño, y por lo menos <b>50.000</b> vistas.' },
  ];
  const SUBIR = ['Que tu reel típico llegue a <b>lo normal para tu tamaño</b> (y por lo menos 500 vistas).',
    'Que tu reel típico tenga <b>el doble de lo normal</b> para tu tamaño (y por lo menos 2.000 vistas).',
    'Que tu reel típico tenga <b>5 veces lo normal</b> para tu tamaño (y por lo menos 10.000 vistas).',
    'Que tu reel típico tenga <b>15 veces lo normal</b> para tu tamaño (y por lo menos 50.000 vistas).',
    'Ya estás arriba: el Laboratorio te dice qué piezas lo lograron, para repetirlo.'];
  /* (6-oct, Sergio) sin publicar: a los 21 días se le avisa; a los 60 la cuenta está EN PELIGRO y el nivel no se cuenta
     («no hay con qué contabilizar»). Cuenta cualquier publicación (reel, carrusel o foto). */
  const AVISO_DIAS = 21, PELIGRO_DIAS = 60;
  function diasSinPublicar() {
    const ts = ((ig && ig.videos) || []).map((v) => Date.parse(v.creado)).filter((t) => isFinite(t));
    return ts.length ? Math.floor((Date.now() - Math.max.apply(null, ts)) / 864e5) : null;
  }
  const JOYA = (i) => 'assets/marca/niveles/n' + (i + 1) + '.webp?v=20261006';   // 6-oct: rehechas sin piso

  /* lo normal y la meta se dicen redondos («10 mil», no «9.996»): la cuenta se hace con el número exacto */
  const redondo = (v) => { const p = v < 1000 ? 10 : v < 1e4 ? 100 : v < 1e5 ? 1000 : 1e4; return Math.round(v / p) * p; };
  function nivelDe(seguidores, videos) { return window.CherryResumen.nivel(seguidores, videos); }


  /* ── Los datos ── */
  function leerIG() {
    const q = Q(); if (!q || !q.instagram) return null;
    return q.instagram();
  }
  function pedirCuenta() {
    const q = Q(); if (!q || !q.llamar || !ig || !ig.perfil) return;
    const llave = ig.marca + ':' + (ig.red || 'ig');
    if (pedidaCuenta === llave) return;
    pedidaCuenta = llave;
    /* (25-oct) TikTok no da los números de la cuenta por día (alcance, quién te descubre…): no se pide nada */
    if (ig.red === 'tt') { cuenta = null; pinta(); return; }
    /* YouTube da los suscriptores por día (YouTube Analytics), con la misma forma que los de Instagram */
    if (ig.red === 'yt') {
      if (!ig.perfil.canal_id) { cuenta = null; pinta(); return; }
      q.llamar('yt-conectar', { accion: 'cuenta', canal_id: ig.perfil.canal_id })
        .then((r) => { cuenta = r && !r.error ? r : null; pinta(); })
        .catch(() => { cuenta = null; pinta(); });
      return;
    }
    q.llamar('ig-metricas', { modo: 'cuenta', marca: ig.marca })
      .then((r) => { cuenta = r || null; pinta(); })
      .catch(() => { cuenta = { conectada: true, error: true }; pinta(); });
  }
  function pedirLab() {
    const uid = C.session && C.session.user && C.session.user.id;
    if (uid) { try { lab = JSON.parse(localStorage.getItem('cherry-herr-laboratorio-' + uid) || 'null') || lab; } catch (e) { /* nada */ } }
    if (C.api && C.api.getDatosHerramienta) C.api.getDatosHerramienta('laboratorio').then((d) => { if (d) { lab = d; pinta(); } }).catch(() => {});
  }
  /* (6-oct) Los reels que Cherry desmontó de tu historial (historial › lista: 112 de sergiosaac.co). «Qué te funciona»
     solo leía los desmontados a mano en el Laboratorio y salía vacío. Se pide una vez; si falla, se vuelve a intentar. */
  let reelsHist = null, pedidoHist = false;
  function pedirHist() {
    const q = Q(); if (pedidoHist || !q || !q.llamar) return;
    pedidoHist = true;
    q.llamar('historial', { accion: 'lista' })
      .then((r) => { reelsHist = (r && r.videos) || []; ultimaGrafica = ''; pinta(); })
      .catch(() => { pedidoHist = false; });
  }
  function refresca() { ig = leerIG(); pedirCuenta(); pinta(); }
  const nombreRed = () => (ig && ig.red === 'tt' ? 'TikTok' : ig && ig.red === 'yt' ? 'YouTube' : ig && ig.red === 'fb' ? 'Facebook' : 'Instagram');   // (25-oct) el interruptor de red
  const redDe = () => (ig && ig.red) || 'ig';
  /* (26-oct, Sergio: «hay que mejorar la pantalla cuando TikTok y YouTube no están conectados; agrega una para Facebook»)
     Sin la red conectada: su logo, una frase y UN botón que conecta ahí mismo (antes mandaba al Calendario). Facebook
     todavía no se conecta: dice «Próximamente». Como el Calendario: limpio, sin la cereza ni el párrafo largo. */
  const REDES_V = {
    ig: { t: 'Conecta tu Instagram', p: 'A cuánta gente llegas, quién te descubre y lo que pasó con cada video, aquí mismo.', b: 'Conectar Instagram',
      ico: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.9"/></g><circle cx="16.9" cy="7.1" r="1.25" fill="currentColor"/>' },
    tt: { t: 'Conecta tu TikTok', p: 'Tus seguidores, tus me gusta y lo que pasó con cada video, aquí mismo.', b: 'Conectar TikTok',
      ico: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.6 3.5v11.3a3.7 3.7 0 1 1-3.7-3.7"/><path d="M13.6 3.5c.5 2.7 2.4 4.5 5 4.8"/></g>' },
    yt: { t: 'Conecta tu YouTube', p: 'Tus suscriptores, tus vistas y lo que pasó con cada video, aquí mismo.', b: 'Conectar YouTube',
      ico: '<rect x="2.5" y="5.5" width="19" height="13" rx="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.2 9.2v5.6l4.7-2.8z" fill="currentColor"/>' },
    fb: { t: 'Facebook, muy pronto', p: 'Aquí vas a ver tus seguidores y lo que pasó con cada video de Facebook, como con Instagram.', b: '',
      ico: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M15.2 7.8h-1.4a2.1 2.1 0 0 0-2.1 2.1v10.6M9.1 12.9h5.3"/></g>' },
  };
  /* lo que dicen «Tu nivel» y «Tu video» mientras la red escogida no esté conectada */
  const sinRed = (que) => (redDe() === 'fb' ? 'Cuando llegue Facebook, ' : 'Cuando conectes tu ' + nombreRed() + ', ') + que;

  /* Los reels medidos, del más viejo al de hoy (los últimos 10). */
  function reels() {
    const vs = ((ig && ig.videos) || []).filter((v) => String(v.tipo || '').toUpperCase() === 'REELS' && n(v.visitas) != null);
    return vs.slice(0, 10).reverse();
  }
  const inicioDe = (v) => n(v.omisiones) == null ? null : Math.round(100 - n(v.omisiones));
  const interDe = (v) => {
    if (n(v.interacciones) != null && n(v.alcance)) return n(v.interacciones) / n(v.alcance) * 100;
    /* (26-oct) TikTok y YouTube no dan el alcance: me gusta + comentarios + compartidos, de cada 100 que lo vieron */
    const vis = n(v.visitas), partes = [v.meGusta, v.comentarios, v.reposts].map(n).filter((x) => x != null);
    return v.red && v.red !== 'ig' && vis && partes.length ? partes.reduce((a, b) => a + b, 0) / vis * 100 : null;
  };
  const tiempoDe = (v) => n(v.vistoMedio);
  const edadH = (v) => v.creado ? (Date.now() - Date.parse(v.creado)) / 36e5 : 1e9;
  function diasSeguidores() {
    const d = ((cuenta && cuenta.seguidoresDia) || []).map((x) => x.nuevos);
    if (d.length && d[d.length - 1] === 0) d.pop();      // el día de hoy todavía no termina
    return d;
  }
  /* (15-oct) la fecha de cada uno de esos días, para las etiquetas de la curva */
  const fechasSeguidores = () => ((cuenta && cuenta.seguidoresDia) || []).map((x) => x.dia);

  /* ── Las gráficas (SVG al tamaño real del recuadro: nada se estira) ── */
  const ROSA = '#FF2D8A', T3 = 'var(--tinta-3)';
  function txt(x, y, t, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + (o.f || 'DM Mono, monospace') + '" font-size="' + (o.s || 10) + '" fill="' + (o.c || T3) + '"' +
      (o.a ? ' text-anchor="' + o.a + '"' : '') + (o.w ? ' font-weight="' + o.w + '"' : '') + '>' + esc(t) + '</text>';
  }
  /* ── (15-oct, rebrand sobrio) las gráficas con el estilo de sus referencias (artefacto «Cherry sobria», propuesta inicio-v2):
     la curva suave con su globo, las barras con degradé y grano, y la matriz de puntos. Los mismos datos de antes. ── */
  const LETRA = 'Space Grotesk, sans-serif', GRIS_T = '#5E5E5E';
  /* el día de una fecha «2026-10-13»: hoy · ayer · 13 oct */
  function diaCorto(f) {
    const d = new Date(String(f || '').slice(0, 10) + 'T12:00:00'); if (isNaN(d)) return '';
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
    const k = Math.round((hoy - d) / 864e5);
    return k === 0 ? 'hoy' : k === 1 ? 'ayer' : d.getDate() + ' ' + MESES[d.getMonth()];
  }
  /* Seguidores: lo que vas sumando, en una curva suave negra con su área de la marca, el punto amarillo y el globo con el total */
  function area(d, fechas, W, H) {
    const ac = []; let s = 0; d.forEach((x) => { s += x; ac.push(s); });
    const k = ac.length, pad = 24, max = Math.max(1, ac[k - 1]) * 1.15;
    const X = (i) => pad + (W - 2 * pad) * i / Math.max(1, k - 1), Y = (v) => H - 28 - (H - 52) * v / max;
    let cam = 'M' + X(0).toFixed(1) + ' ' + Y(ac[0]).toFixed(1);
    for (let i = 1; i < k; i++) {
      const cx = ((X(i - 1) + X(i)) / 2).toFixed(1);
      cam += ' C' + cx + ' ' + Y(ac[i - 1]).toFixed(1) + ' ' + cx + ' ' + Y(ac[i]).toFixed(1) + ' ' + X(i).toFixed(1) + ' ' + Y(ac[i]).toFixed(1);
    }
    const fx = X(k - 1), fy = Y(ac[k - 1]), gx = Math.min(W - 50, Math.max(50, fx));
    const rejas = [0.25, 0.5, 0.75].map((f) => { const y = (24 + (H - 52) * f).toFixed(1); return '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '" stroke="#E3E3E0" stroke-dasharray="3 5"/>'; }).join('');
    const marcas = [0, Math.round((k - 1) / 3), Math.round(2 * (k - 1) / 3), k - 1].filter((v, i, a) => a.indexOf(v) === i);
    return '<defs><linearGradient id="tkA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ROSA + '" stop-opacity=".28"/><stop offset="1" stop-color="#FFC93C" stop-opacity="0"/></linearGradient></defs>' + rejas +
      '<path d="' + cam + ' L' + fx.toFixed(1) + ' ' + (H - 28) + ' L' + X(0).toFixed(1) + ' ' + (H - 28) + ' Z" fill="url(#tkA)"/>' +
      '<path class="tk-traza" pathLength="1" d="' + cam + '" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>' +
      '<line x1="' + fx.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y1="' + (fy + 8).toFixed(1) + '" y2="' + (H - 28) + '" stroke="#111" stroke-dasharray="3 4"/>' +
      '<circle cx="' + fx.toFixed(1) + '" cy="' + fy.toFixed(1) + '" r="7" fill="#FFC93C" stroke="#111" stroke-width="2.5"/>' +
      '<g transform="translate(' + gx.toFixed(1) + ' ' + (fy - 24).toFixed(1) + ')"><rect x="-46" y="-15" width="92" height="26" rx="13" fill="#111"/>' +
      txt(0, 3, '+' + igNum(ac[k - 1]), { a: 'middle', c: '#fff', w: 700, s: 12, f: LETRA }) + '</g>' +
      marcas.map((i) => txt(X(i), H - 6, i === k - 1 ? diaCorto(fechas[i]) : fecha(String(fechas[i] || '') + 'T12:00:00'), { a: 'middle', s: 11, c: GRIS_T, f: LETRA })).join('');
  }
  /* Vistas, interacción y tiempo visto: una barra por video con su número encima; las que pasan tu promedio van a color
     (degradé y grano), las demás en negro; la raya punteada es tu promedio. HTML: el lienzo mide W × H. */
  function barras(d, nombres, fmt, color, W, H) {
    const m = media(d), max = Math.max.apply(null, d) * 1.05 || 1, pie = 20, alto = H - pie - 24;   // 24: el número de encima
    const px = (v) => Math.max(3, alto * v / max);
    return '<div class="tk-bars"><div class="tk-bars-cols" style="height:' + (H - pie) + 'px;grid-template-columns:repeat(' + d.length + ',minmax(0,1fr))">' +
      '<span class="tk-bars-mitad" style="bottom:' + px(m).toFixed(1) + 'px"></span>' +
      d.map((v, i) => '<div class="tk-bars-col" title="' + esc(nombres[i] + ': ' + fmt(v)) + '"><b>' + esc(fmt(v)) + '</b>' +
        '<i class="' + (v >= m ? color : 'negra') + '" style="height:' + px(v).toFixed(1) + 'px;animation-delay:' + (i * 90) + 'ms"></i></div>').join('') +
      '</div><div class="tk-bars-pie"><span>el más viejo</span><span>el de hoy</span></div></div>';
  }
  /* Inicio: la matriz de puntos (como el «82 bpm» de los relojes): una columna por video, 10 filas = de cada 100 cuántos
     pasaron el inicio; lo que pasa de la mitad, en fucsia */
  function matriz(d, nombres, W, H) {
    const k = d.length, por = 3, pie = 22, paso = Math.max(4, Math.min(11.5, (H - pie - 12) / 10, (W / k - 8) / por)), r = paso * 0.365;
    const base = (H - pie) / 2 + paso * 4.5;   // centrada en el alto que queda
    let s = '';
    d.forEach((v, g) => {
      const llenas = Math.round(v / 10), cx0 = W / k * g + W / k / 2 - paso * (por - 1) / 2;
      s += '<g><title>' + esc(nombres[g]) + ': ' + v + ' de 100</title>';
      for (let f = 0; f < 10; f++) for (let c = 0; c < por; c++) {
        s += '<circle class="tk-pop" style="animation-delay:' + (g * 90 + f * 45) + 'ms" cx="' + (cx0 + c * paso).toFixed(1) + '" cy="' + (base - f * paso).toFixed(1) +
          '" r="' + r.toFixed(2) + '" fill="' + (f >= llenas ? '#E3E3E0' : f >= 5 ? ROSA : '#111') + '"/>';
      }
      s += '</g>';
    });
    return s + txt(0, H - 4, 'el más viejo', { s: 11.5, c: GRIS_T, f: LETRA }) + txt(W, H - 4, 'el de hoy', { a: 'end', s: 11.5, c: GRIS_T, f: LETRA });
  }
  /* «Gancho → Conector → Cuerpo → Cuerpo → Cuerpo → CTA» se lee «Conector → Cuerpo ×3 → CTA» (todas empiezan por el gancho) */
  function cortaEstructura(t) {
    const p = String(t || '').split('→').map((x) => x.trim()).filter(Boolean);
    if (p.length > 1 && /^gancho$/i.test(p[0])) p.shift();
    const out = [];
    p.forEach((x) => { const u = out[out.length - 1]; if (u && u.n === x) u.k++; else out.push({ n: x, k: 1 }); });
    return out.map((u) => u.n + (u.k > 1 ? ' ×' + u.k : '')).join(' → ');
  }
  /* «Qué te funciona» (6-oct, Sergio: «tienen títulos genéricos; ahí no sé el gancho de qué video o la idea de qué video
     me funcionó»): la lista de TUS VIDEOS, cada uno con su pieza real (la frase exacta del gancho, la idea, el formato, la
     estructura), su miniatura y su número; tocar uno abre el reel en Instagram. Arriba, una línea con el patrón.
       · gancho = cuántos de 100 pasaron el inicio · idea = vistas · formato y estructura = % del video que vio la gente
         (solo videos de 10 s o más: uno de 5 s siempre «se ve completo»). */
  const P_ = (v) => (v && v.historial && v.historial.piezas) || {};
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fecha(t) {
    const d = new Date(t); if (isNaN(d)) return '';
    return d.getDate() + ' ' + MESES[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  const retDe = (v) => (n(v.retencion) != null && (n(v.dur) == null || n(v.dur) >= 10)) ? n(v.retencion) : null;
  function mejoresVideos(tipo) {
    if (!ig) return [];
    const vs = (reelsHist || []).filter((v) => v && v.cuenta === ig.marca && v.historial && v.historial.piezas);
    let filas = [];
    if (tipo === 'gancho') filas = vs.filter((v) => inicioDe(v) != null && (P_(v).gancho_frase || P_(v).gancho)).map((v) => ({ v, val: inicioDe(v),
      nombre: P_(v).gancho_frase ? '«' + P_(v).gancho_frase + '»' : P_(v).gancho, sub: P_(v).gancho_frase ? P_(v).gancho : '', etq: String(inicioDe(v)), de: 'de 100', tope: 100 }));
    if (tipo === 'idea') filas = vs.filter((v) => n(v.visitas) != null && (P_(v).idea || P_(v).angulo)).map((v) => ({ v, val: n(v.visitas),
      nombre: P_(v).idea || P_(v).angulo, sub: P_(v).tema || '', etq: mil(v.visitas), de: 'vistas' }));
    if (tipo === 'formato') filas = vs.filter((v) => retDe(v) != null && P_(v).formato).map((v) => ({ v, val: retDe(v),
      nombre: P_(v).formato, sub: v.titulo || '', etq: Math.round(retDe(v)) + ' %', de: n(v.vistoMedio) != null ? Math.round(n(v.vistoMedio)) + ' s vistos' : 'visto', tope: 100 }));
    if (tipo === 'estructura') filas = vs.filter((v) => retDe(v) != null && P_(v).estructura).map((v) => ({ v, val: retDe(v),
      nombre: cortaEstructura(P_(v).estructura), sub: v.titulo || '', etq: Math.round(retDe(v)) + ' %', de: n(v.vistoMedio) != null ? Math.round(n(v.vistoMedio)) + ' s vistos' : 'visto', tope: 100 }));
    return filas.sort((a, b) => b.val - a.val);
  }
  /* el patrón, en una línea: la pieza que mejor te va en promedio (con 2 videos o más) */
  function resumenDe(tipo) {
    if (tipo === 'estructura') return '';
    const f = piezas(tipo).filter((x) => x.k >= 2)[0]; if (!f) return '';
    const que = { gancho: 'Tu tipo de gancho más fuerte', idea: 'Tu tema más fuerte', formato: 'Tu formato más fuerte' }[tipo];
    const cuanto = { gancho: Math.round(f.v) + ' de 100 pasan el inicio', idea: mil(f.v) + ' vistas', formato: Math.round(f.v) + ' % visto' }[tipo];
    return que + ': <b>' + esc(f.nombre) + '</b> · en promedio ' + cuanto + ' (' + f.k + ' videos)';
  }
  function listaVideos(filas, res, H) {
    const alto = H > 260 ? 44 : 36, cuantas = 8;   // las que no caben enteras las quita pintaGrafica()
    const mx = Math.max.apply(null, filas.map((f) => f.tope || f.val)) || 1;
    return '<div class="tk-lv-caja" style="--lv:' + alto + 'px">' + (res ? '<p class="tk-lv-res">' + res + '</p>' : '') + '<ol class="tk-lv">' +
      filas.slice(0, cuantas).map((f, i) => '<li><a class="tk-lv-f' + (i === 0 ? ' yo' : '') + '" href="' + esc(f.v.enlace || '#') + '" target="_blank" rel="noopener" title="' + esc((f.v.titulo || '') + ' · ' + fecha(f.v.creado)) + '">' +
        '<span class="tk-lv-tapa">' + (f.v.tapa ? '<img src="' + esc(f.v.tapa) + '" alt="" loading="lazy">' : '') + '</span>' +
        '<span class="tk-lv-t"><b>' + (i === 0 ? '★ ' : '') + esc(f.nombre) + '</b><small>' + esc([f.sub, fecha(f.v.creado)].filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="tk-lv-n"><b>' + esc(f.etq) + '</b><small>' + esc(f.de) + '</small><i><u style="width:' + Math.round(100 * f.val / mx) + '%"></u></i></span></a></li>').join('') +
      '</ol></div>';
  }
  /* «Qué te funciona»: las piezas de tus reels, juzgadas por lo que les toca (el gancho por el inicio, la idea por las
     vistas, el formato y la estructura por el tiempo visto). Solo los de esta marca. Salen de DOS lados:
       · el historial que Cherry desmontó solo (las ideas van por TEMA: cada ángulo casi nunca se repite);
       · lo que desmontaste en el Laboratorio (si un reel está en los dos, cuenta una vez). */
  function piezas(tipo) {
    if (!ig) return [];
    const medir = { gancho: inicioDe, idea: (v) => n(v.visitas), formato: retDe, estructura: retDe }[tipo];
    const grupos = {}, ya = {};
    const sumar = (k, v) => { const val = medir(v); if (!k || val == null) return; (grupos[k] = grupos[k] || []).push(val); };
    (reelsHist || []).forEach((v) => {
      const p = v && v.cuenta === ig.marca && v.historial && v.historial.piezas; if (!p) return;
      const k = tipo === 'idea' ? p.tema : tipo === 'estructura' ? cortaEstructura(p.estructura) : p[tipo];
      if (!k) return;
      if (v.igMediaId) ya[v.igMediaId] = 1;
      sumar(k, v);
    });
    const q = Q();
    if (lab && q && q.igEnDoc) {
      const D = q.igEnDoc(lab), P = (lab.piezas && lab.piezas[tipo]) || [];
      const porId = {}; P.forEach((p) => { porId[p.id] = p; });
      (D.videos || []).forEach((v) => {
        if (!v || v.cuenta !== ig.marca || !v.piezas || !v.piezas[tipo]) return;
        if (v.igMediaId && ya[v.igMediaId]) return;
        const p = porId[v.piezas[tipo]]; if (!p) return;
        sumar(p.texto || p.angulo || 'Sin nombre', v);
      });
    }
    let filas = Object.keys(grupos).map((k) => ({ nombre: k, v: media(grupos[k]), k: grupos[k].length }));
    /* con mucha historia, una pieza usada UNA sola vez no dice nada: si hay al menos dos con 2 videos o más, solo esas */
    const repetidas = filas.filter((f) => f.k >= 2);
    if (repetidas.length >= 2) filas = repetidas;
    return filas.sort((a, b) => b.v - a.v).slice(0, 7);
  }

  const TABS = [
    { k: 'seg', g: 'num', n: 'Seguidores' }, { k: 'vistas', g: 'num', n: 'Vistas' }, { k: 'inter', g: 'num', n: 'Interacción' },
    { k: 'inicio', g: 'num', n: 'Inicio' }, { k: 'tiempo', g: 'num', n: 'Tiempo visto' },
    { k: 'ganchos', g: 'fun', n: 'Ganchos' }, { k: 'ideas', g: 'fun', n: 'Ideas' }, { k: 'formatos', g: 'fun', n: 'Formatos' }, { k: 'estructuras', g: 'fun', n: 'Estructuras' },
  ];
  /* (26-oct, Sergio: «en TikTok o YouTube las estadísticas se ven raras») en Instagram salen todas, como siempre; en las
     otras redes solo las que tienen dato: TikTok no da los seguidores por día, y ni TikTok ni YouTube dan cuántos pasaron
     el inicio ni el tiempo visto. Antes salían igual y decían «YouTube no da este dato». */
  function hayDato(k) {
    const x = TABS.find((y) => y.k === k);
    if (redDe() === 'ig' || !x || x.g !== 'num') return true;
    const rs = reels();
    if (k === 'seg') return diasSeguidores().length >= 2 || (redDe() === 'yt' && !cuenta);   // YouTube: mientras llegan
    if (k === 'inter') return rs.some((v) => interDe(v) != null);
    if (k === 'inicio') return rs.some((v) => inicioDe(v) != null);
    if (k === 'tiempo') return rs.some((v) => tiempoDe(v) != null);
    return true;
  }
  function grafica(k, W, H) {
    const rs = reels(), nombres = rs.map((v) => v.titulo || '');
    const vacio = (t) => ({ t: '', svg: '', vacio: t });
    /* (15-oct) `th`: el título con sus partes en negrita y la raya del promedio (va como HTML; `t` queda para el aria) */
    const prom = (t, m) => ({ t: t + ' · tu promedio: ' + m, th: esc(t) + ' · <span class="tk-ley" aria-hidden="true"></span> tu promedio: <b>' + esc(m) + '</b>' });
    if (k === 'seg') {
      const d = diasSeguidores();
      if (d.length < 2) return vacio(ig && ig.red === 'tt' ? 'TikTok no da tus seguidores por día.' : ig && ig.red === 'yt' ? (cuenta ? 'YouTube todavía no tiene tus suscriptores por día.' : 'Trayendo tus números de YouTube…') : cuenta ? 'Instagram todavía no tiene tus seguidores por día.' : 'Trayendo tus números de Instagram…');
      const suma = d.reduce((a, b) => a + b, 0);
      const quien = redDe() === 'yt' ? 'suscriptores' : 'seguidores';   // (26-oct) en YouTube son suscriptores
      return { t: 'Lo que vas sumando en ' + quien + ' · ' + d.length + ' días', th: 'Lo que vas sumando en ' + quien + ' · <b>' + d.length + ' días</b>, unos ' + Math.round(suma / d.length) + ' por día',
        svg: area(d, fechasSeguidores(), W, H) };
    }
    if (rs.length < 2) return vacio('Cuando publiques al menos dos ' + (redDe() === 'ig' ? 'reels' : 'videos') + ', aquí ves cómo le va a cada uno.');
    if (k === 'vistas') { const d = rs.map((v) => n(v.visitas));
      return Object.assign(prom('Vistas de cada video · tus últimos ' + rs.length, milCorto(media(d))), { html: barras(d, nombres, milCorto, '', W, H) }); }
    if (k === 'inter') { const d = rs.map(interDe); if (d.some((x) => x == null)) return vacio('Faltan datos de alcance en algunos videos.');
      return Object.assign(prom('De cada 100 que vieron cada video, cuántos interactuaron', String(Math.round(media(d)))), { html: barras(d, nombres, (x) => String(Math.round(x)), 'amarilla', W, H) }); }
    if (k === 'inicio') { const d = rs.map(inicioDe); if (d.some((x) => x == null)) return vacio(nombreRed() + ' no da este dato para algunos videos.');
      return { t: 'De cada 100, cuántos pasaron el inicio de cada video', th: 'De cada 100, cuántos pasaron el inicio de cada video · <b>fucsia: más de la mitad</b>', svg: matriz(d, nombres, W, H) }; }
    if (k === 'tiempo') { const d = rs.map(tiempoDe); if (d.some((x) => x == null)) return vacio(nombreRed() + ' no da este dato para algunos videos.');
      return Object.assign(prom('Segundos que se quedó la gente en cada video', coma(Math.round(media(d) * 10) / 10) + ' s'), { html: barras(d, nombres, (x) => Math.round(x) + ' s', 'amarilla', W, H) }); }
    const tipo = { ganchos: 'gancho', ideas: 'idea', formatos: 'formato', estructuras: 'estructura' }[k];
    const lista = mejoresVideos(tipo);
    if (lista.length < 2) return vacio('Cuando Cherry desmonte tus reels en el Laboratorio, aquí ves qué ' + { ganchos: 'ganchos', ideas: 'ideas', formatos: 'formatos', estructuras: 'estructuras de guion' }[k] + ' te funcionan.');
    const t = { ganchos: 'Tus ganchos que más gente dejaron pasar · de cada 100', ideas: 'Tus ideas con más vistas', formatos: 'Tus videos que más se vieron · cuánto del video vio la gente', estructuras: 'Las estructuras de tus videos que más retuvieron' }[k];
    return { t: t, html: listaVideos(lista, resumenDe(tipo), H) };
  }
  function pintaGrafica() {
    if (!nodoC) return;
    const caja = nodoC.querySelector('.tk-g-lienzo'); if (!caja) return;
    const W = Math.max(200, Math.round(caja.clientWidth)), H = Math.max(90, Math.round(caja.clientHeight));
    const g = grafica(tab, W, H);
    nodoC.querySelectorAll('[data-tk-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-tk-tab') === tab)));
    /* si no cambió nada no se vuelve a pintar: así la línea no se dibuja otra vez cada vez que llega un dato */
    const firma = tab + '|' + W + '|' + H + '|' + (g.vacio || g.svg || g.html);
    if (firma === ultimaGrafica) return;
    ultimaGrafica = firma;
    const tit = nodoC.querySelector('.tk-g-titulo');
    if (g.th) tit.innerHTML = g.th; else tit.textContent = g.t || '';
    caja.innerHTML = g.vacio
      ? '<p class="tk-g-vacio">' + esc(g.vacio) + (/Laboratorio/.test(g.vacio) ? ' <a href="' + LAB('') + '">Ir al Laboratorio ›</a>' : '') + '</p>'
      : g.html ? g.html
      : '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(g.t) + '">' + g.svg + '</svg>';
    const barrasEl = caja.querySelector('.tk-bars');
    if (barrasEl) { barrasEl.setAttribute('role', 'img'); barrasEl.setAttribute('aria-label', g.t || ''); }
    /* la lista de videos: solo las filas que caben enteras (una fila cortada abajo se ve rota) */
    if (g.html) { const fondo = caja.getBoundingClientRect().bottom + 1; caja.querySelectorAll('.tk-lv li').forEach((li) => { if (li.getBoundingClientRect().bottom > fondo) li.remove(); }); }
  }

  /* ── «Tu video»: el último reel y cómo le fue (cambia cada 6 s; la tira de abajo marca cuál va) ── */
  function video(v, rs) {
    const vistas = rs.map((x) => n(x.visitas)), mv = media(vistas.filter((x) => x != null));
    const ini = rs.map(inicioDe).filter((x) => x != null), mi = media(ini);
    const tie = rs.map(tiempoDe).filter((x) => x != null), mt = media(tie);
    const ints = rs.map(interDe).filter((x) => x != null), mint = media(ints);
    const yo = { v: n(v.visitas), i: inicioDe(v), t: tiempoDe(v), x: interDe(v) };
    /* (26-oct, Sergio: «esa tarjeta también debe verse igual en las otras redes; se ve como vacía») TikTok y YouTube no
       dan cuántos pasaron el inicio ni el tiempo visto: el anillo dice cuántos de cada 100 interactuaron y las barras son
       vistas, me gusta y compartidos (o comentarios), cada una contra lo normal tuyo. Instagram queda igual. */
    const otra = !!(v.red && v.red !== 'ig');
    const prom = (k) => media(rs.map((x) => n(x[k])).filter((x) => x != null));
    const aro = yo.i != null ? { v: yo.i, et: 'Pasaron el inicio', suele: mi }
      : otra && yo.x != null ? { v: Math.round(yo.x), et: 'Interactuaron', suele: mint } : null;
    let sello = 'Como siempre', clase = '';
    if (edadH(v) < 48) sello = 'Se está midiendo';
    else if (yo.i != null && yo.i === Math.max.apply(null, ini)) { sello = '★ Tu mejor gancho'; clase = 'si'; }
    else if (yo.v != null && yo.v === Math.max.apply(null, vistas)) { sello = '★ El más visto'; clase = 'si'; }
    else if (yo.t != null && yo.t === Math.max.apply(null, tie)) { sello = '★ El que más retuvo'; clase = 'si'; }
    else if (yo.x != null && yo.x === Math.max.apply(null, ints)) { sello = '★ El que más interacción tuvo'; clase = 'si'; }
    else if (yo.v != null && yo.v >= mv * 1.2) { sello = 'Por encima de lo normal'; clase = 'si'; }
    else if (yo.v != null && yo.v <= mv * 0.8) { sello = 'Por debajo de lo normal'; clase = 'baja'; }
    const comp = (a, b) => (a == null || !b) ? '' : a >= b * 1.05 ? coma(Math.round(a / b * 10) / 10) + '× lo normal' : a <= b * 0.95 ? 'menos que lo normal' : 'como siempre';
    /* (15-oct, rebrand sobrio) cada número con su pista: lo tuyo en el degradé de la marca y una rayita blanca donde está
       lo normal (tu promedio) */
    const barra = (et, a, b, val, fmtNo) => { const mx = Math.max(a, b, 1e-6) * 1.15;
      return '<div class="tv-c"><span class="tv-c-n">' + et + ' <em' + (a > b * 1.05 ? ' class="sube"' : '') + '>· ' + comp(a, b) + '</em></span><b>' + val + '</b>' +
        '<span class="tv-pista"><i style="width:' + (100 * a / mx).toFixed(1) + '%"></i><u style="left:' + (100 * b / mx).toFixed(1) + '%" title="lo normal: ' + fmtNo(b) + '"></u></span></div>'; };
    /* el sweet de este video (herramientas/lab-sweet.js; la palabra se toca y explica qué es) */
    const CS = window.CherrySweet, sw = CS && CS.de ? CS.de(v) : null;
    const nums = (aro || sw != null) ? '<div class="tv-nums">' +
      (aro ? '<div class="tv-anillo">' + anillo(aro.v, { n: 40, lado: 200, r1: 68, r2: 80, grueso: 5, vacio: 'rgba(255,255,255,.16)' }) +
        '<div class="tv-anillo-n"><b>' + aro.v + '</b><span>de 100</span></div></div>' : '') +
      '<div class="tv-dos">' +
        (aro ? '<div class="tv-grupo"><span class="tv-et">' + aro.et + '</span>' + (aro.suele ? '<small>tú sueles ' + Math.round(aro.suele) + ' de 100</small>' : '') + '</div>' : '') +
        (sw != null ? '<div class="tv-grupo"><span class="tv-et">' + (CS.palabra ? CS.palabra('Sweet') : 'Sweet') + '</span><b class="tv-sweet">' + Math.round(sw) + '<small> %</small></b></div>' : '') +
      '</div></div>' : '';
    const tapa = v.tapa ? '<img src="' + esc(v.tapa) + '" alt="" loading="lazy">' : '';
    const seg = n(v.dur) ? Math.round(n(v.dur)) : null;
    const dur = seg != null ? '<span class="tk-dur">' + Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0') + '</span>' : '';
    return {
      sello, clase,
      /* (15-oct) CherryResumen.hace() quiere la fecha sola («2026-10-02»): con la hora entera no salía nada */
      cuando: v.creado && window.CherryResumen && window.CherryResumen.hace ? window.CherryResumen.hace(String(v.creado).slice(0, 10)) : '',
      html: '<a class="tk-mini" href="' + esc(v.enlace || '#') + '" target="_blank" rel="noopener" aria-label="Ver el video en ' + nombreRed() + '">' + tapa +
        '<span class="tk-play" aria-hidden="true"></span>' + dur + '</a>' +
        '<div class="tv-der"><h4 class="tv-tit">' + esc(v.titulo || 'Sin texto') + '</h4>' + nums +
        '<div class="tv-comp">' +
        (yo.v != null ? barra('Vistas', yo.v, mv, mil(yo.v), (x) => mil(Math.round(x))) : '') +
        (otra ? barrasRed(v, prom, barra)
          : (yo.t != null ? barra('Tiempo visto', yo.t, mt, Math.round(yo.t) + ' s', (x) => Math.round(x) + ' s') : '') +
            (yo.x != null ? barra('Interacción', yo.x, mint, Math.round(yo.x) + ' de 100', (x) => Math.round(x) + ' de 100') : '')) +
        '</div></div>',
    };
  }
  /* las dos barras de TikTok y YouTube después de las vistas: me gusta y compartidos (YouTube no da compartidos: comentarios) */
  function barrasRed(v, prom, barra) {
    const una = (k, et) => n(v[k]) == null ? '' : barra(et, n(v[k]), prom(k), mil(n(v[k])), (x) => mil(Math.round(x)));
    return una('meGusta', 'Me gusta') + (n(v.reposts) != null ? una('reposts', 'Compartidos') : una('comentarios', 'Comentarios'));
  }
  function pintaVideo() {
    if (!nodoV) return;
    const caja = nodoV.querySelector('.tv');
    const vacio = (txt) => { caja.innerHTML = '<span class="ci-etq">Tu video</span><div class="tv-vacio"><span class="tv-vacio-ico" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.3 9.1v5.8l4.5-2.9z" fill="currentColor"/></svg></span>' +
      '<p class="tk-g-vacio">' + txt + '</p></div>'; caja.dataset.forma = ''; };
    if (!ig || !ig.perfil) { vacio(sinRed('aquí ves lo que pasó con cada video.')); return; }
    const rs = reels(), lista = rs.slice().reverse().slice(0, 6);   // los más recientes primero
    if (!lista.length) { vacio('Cuando publiques ' + (redDe() === 'ig' ? 'un reel' : 'un video en ' + nombreRed()) + ', aquí ves lo que pasó con él.'); return; }
    if (caja.dataset.forma !== 'lleno') {
      /* (15-oct, rebrand sobrio) la tarjeta negra: la etiqueta entre llaves, el sello a la derecha y una luz detrás del anillo */
      caja.innerHTML = '<span class="tv-luz" aria-hidden="true"></span>' +
        '<div class="tv-cab"><span class="ci-etq">{ Tu video<span class="tv-cuando"></span> }</span><span class="tk-sello"></span></div>' +
        '<div class="tv-cuerpo"></div>' +
        '<div class="tv-tira"><span class="ci-etq">Tus últimos videos</span><div class="tv-fotos"></div></div>';
      caja.dataset.forma = 'lleno';
    }
    if (jv >= lista.length) jv = 0;
    const r = video(lista[jv], rs);
    caja.querySelector('.tv-cuerpo').innerHTML = r.html;
    const s = caja.querySelector('.tk-sello'); s.textContent = r.sello; s.className = 'tk-sello ' + r.clase;
    caja.querySelector('.tv-cuando').textContent = r.cuando ? ' · ' + r.cuando : '';
    caja.querySelector('.tv-fotos').innerHTML = lista.map((v, i) => '<button type="button" data-tk-v="' + i + '" aria-label="' + esc(v.titulo || 'Video ' + (i + 1)) + '"' +
      (i === jv ? ' aria-current="true"' : '') + '><span>' + (v.tapa ? '<img src="' + esc(v.tapa) + '" alt="" loading="lazy">' : '') + '</span><small>' + milCorto(v.visitas) + '</small></button>').join('');
  }
  function arranca() {
    clearInterval(reloj);
    reloj = setInterval(() => { if (quieto || document.hidden) return; jv++; pintaVideo(); }, VUELTA);
  }

  /* ── «Tu nivel»: el aro que brilla con tu cereza y las cinco cerezas ── */
  function pintaNivel() {
    if (!nodoN) return;
    const caja = nodoN.querySelector('.nv');
    const dias = ig && ig.perfil ? diasSinPublicar() : null, peligro = dias != null && dias >= PELIGRO_DIAS;
    const nv = peligro ? null : nivel;   // en peligro el nivel no se cuenta: no hay con qué
    nodoN.dataset.joya = nv ? String(nv.i) : '0';   // la luz de la tarjeta toma el color de tu cereza (styles.css › «TU NIVEL»)
    nodoN.dataset.estado = peligro ? 'peligro' : dias != null && dias >= AVISO_DIAS ? 'aviso' : '';
    const joyas = '<div class="nv-joyas">' + NIVELES.map((x, i) => '<button type="button" class="nv-joya ' + (nv && i <= nv.i ? 'si' : 'no') + (nv && i === nv.i ? ' yo' : '') + '" data-tk-nivel="' + i + '" aria-label="' + x.n + ': qué significa">' +
      '<img src="' + JOYA(i) + '" alt=""><small>' + x.n + '</small></button>').join('') + '</div>';
    /* (15-oct, rebrand sobrio) arriba la etiqueta y, a la derecha, cuánto te falta para el siguiente nivel; la cereza dentro
       de un anillo por segmentos (amarillo → fucsia hasta tu avance) */
    const cab = (chip) => '<div class="nv-cab"><span class="ci-etq">Tu nivel</span>' + (chip ? '<span class="nv-chip">' + chip + '</span>' : '') + '</div>';
    const aro = (p) => anillo(p, { n: 44, lado: 112, r1: 44, r2: 53, grueso: 4, vacio: '#E3E3E0' });
    if (peligro) {
      caja.innerHTML = cab('') +
        '<div class="nv-cuerpo"><span class="nv-aro nv-aro--quieto"><i class="nv-brillo"></i>' + aro(0) +
        '<img src="' + JOYA(nivel ? nivel.i : 0) + '" alt=""></span>' +
        '<div class="nv-txt"><b class="nv-peligro">Cuenta en peligro</b><p>Hace <b>' + dias + ' días</b> no subes contenido. Sube un reel y tu nivel vuelve a aparecer.</p>' +
        '<p class="nv-sube"><a class="nv-bt" href="' + LAB('v7') + '">Planear el próximo →</a></p></div></div>' + joyas;
      return;
    }
    if (!nv) {
      caja.innerHTML = cab('') + '<p class="nv-vacio">' + (!ig || !ig.perfil
        ? sinRed('Cherry te dice en qué nivel estás: a cuánta gente llegan tus videos comparado con lo normal para tu tamaño.')
        : 'Tu nivel aparece cuando tengas videos medidos.') + '</p>' + joyas;
      return;
    }
    const pct = Math.round(Math.min(1, nv.avance) * 100);
    caja.innerHTML = cab(nv.i < 4 ? pct + ' % hacia ' + NIVELES[nv.i + 1].n : 'Lo más alto') +
      '<div class="nv-cuerpo"><button type="button" class="nv-aro" data-tk-nivel="' + nv.i + '" aria-label="' + NIVELES[nv.i].n + ': qué significa"><i class="nv-brillo"></i>' +
      aro(nv.i < 4 ? pct : 100) + '<img src="' + JOYA(nv.i) + '" alt=""></button>' +
      '<div class="nv-txt"><b>' + NIVELES[nv.i].n + '</b>' +
      (nodoN.dataset.estado === 'aviso' ? '<p class="nv-aviso">Hace <b>' + dias + ' días</b> no publicas. Sube un reel para que tu cuenta no se enfríe.</p>' : '') +
      '<p>Tu reel típico tiene <b>' + mil(nv.medio) + ' vistas</b>; lo normal para tu tamaño es <b>' + mil(redondo(nv.normal)) + '</b>. ' +
      (nv.i < 4 ? 'Para ser ' + NIVELES[nv.i + 1].n + ': <b>' + mil(redondo(nv.meta)) + '</b>.' : 'Estás en lo más alto.') + '</p>' +
      '</div></div>' + joyas;
  }
  /* (22-oct, Sergio) «la parte de abajo donde hay puras letras es lo que se ve muy plano». Escogió la opción A del artefacto
     «Ventana del nivel»: el nivel lo deciden DOS requisitos a la vez (veces lo normal y un mínimo de vistas) y cada uno va en
     su fila, con tu número grande, lo que pide el nivel y su barra; ✓ fucsia si ya lo cumples, ! amarillo si te falta. A él le
     pasaba: 20,5 veces lo normal (Experto pide 2) pero 1.793 vistas de 2.000, y no se entendía por qué seguía en Creador. */
  const REGLA = [['menos de 1×', 'o menos de 500'], ['1× a 2×', '500+'], ['2× a 5×', '2.000+'], ['5× a 15×', '10 mil+'], ['15× o más', '50 mil+']];
  /* los requisitos del nivel k (1–4): VECES[k-1] veces lo normal y PISO[k-1] vistas */
  function requisitosNivel(nv, k, titulo) {
    const pideX = VECES[k - 1], pideV = PISO[k - 1];
    const okX = nv.x >= pideX, okV = nv.medio >= pideV, listos = (okX ? 1 : 0) + (okV ? 1 : 0);
    const fila = (ok, nombre, pide, num, nota, avance) =>
      '<div class="tk-r-fila' + (ok ? '' : ' falta') + '"><span class="tk-r-sello ' + (ok ? 'si">✓' : 'no">!') + '</span>' +
      '<div class="tk-r-tx"><b>' + nombre + '</b><small>' + pide + '</small></div>' +
      '<div class="tk-r-der"><span class="tk-r-num">' + num + '</span><small>' + nota + '</small></div>' +
      '<i class="tk-r-barra"><u style="width:' + Math.round(Math.min(1, avance) * 100) + '%"></u></i></div>';
    return '<div class="tk-r"><div class="tk-r-cab"><small class="tk-r-lbl">' + titulo + '</small><span>' +
      (listos === 2 ? 'Los dos listos' : listos + ' de 2 listo') + '</span></div>' +
      fila(okX, 'Veces lo normal', NIVELES[k].n + ' pide ' + coma(pideX) + '×', coma(Math.round(nv.x * 10) / 10) + '×',
        okX ? (nv.x >= pideX * 2 ? 'de sobra' : 'listo') : 'faltan ' + mil(Math.ceil(redondo(pideX * nv.normal) - nv.medio)) + ' vistas', nv.x / pideX) +
      fila(okV, 'Vistas de tu reel típico', NIVELES[k].n + ' pide ' + mil(pideV), mil(nv.medio),
        okV ? 'listo' : 'faltan ' + mil(Math.ceil(pideV - nv.medio)), nv.medio / pideV) + '</div>';
  }
  /* lo que te falta para el nivel k, junto (la meta es lo más alto de los dos requisitos), con la cereza de ese nivel */
  function metaNivel(nv, k) {
    const falta = Math.max(0, redondo(Math.max(VECES[k - 1] * nv.normal, PISO[k - 1])) - nv.medio);
    if (!falta) return '';
    return '<div class="tk-r-meta"><img src="' + JOYA(k) + '" alt=""><p><b>Te faltan ' + mil(Math.ceil(falta)) +
      ' vistas</b> en tu reel típico para ser <b>' + NIVELES[k].n + '</b>.</p></div>';
  }
  function abajoNivel(nv, i, tuyo) {
    let o = '<div class="tk-r-regla"><span><span class="tk-r-lbl">' + NIVELES[i].n + ' es</span></span><span><b>' + REGLA[i][0] +
      '</b>lo normal</span><span><b>' + REGLA[i][1] + '</b>vistas</span></div>';
    if (!nv) return o + '<p class="tk-r-nota">Todavía no hay videos medidos para saber dónde estás.</p>';
    if (tuyo && i === 4) o += '<div class="tk-r-meta"><img src="' + JOYA(4) + '" alt=""><p><b>Estás en lo más alto.</b> ' + SUBIR[4] + '</p></div>';
    else if (tuyo) o += requisitosNivel(nv, i + 1, 'Para subir a ' + NIVELES[i + 1].n) + metaNivel(nv, i + 1);
    else if (i > nv.i) o += requisitosNivel(nv, i, 'Para llegar a ' + NIVELES[i].n) + metaNivel(nv, i);
    else o += i >= 1 ? requisitosNivel(nv, i, 'Ya pasaste por aquí') : '<p class="tk-r-nota">Ya pasaste por aquí.</p>';
    return o + '<p class="tk-r-pie">Tu reel típico es el del medio de tus últimos 10. Lo normal para una cuenta de tu tamaño: ' +
      mil(redondo(nv.normal)) + ' vistas.</p>';
  }
  function abrirNivel(i) {
    const nv = nivel, x = NIVELES[i], tuyo = nv && i === nv.i;
    const v = document.createElement('div');
    v.className = 'tk-velo';
    /* (6-oct, Sergio) la cereza SIEMPRE a color y con su luz, también las que faltan: «para que la persona sepa hacia qué
       rango va y se emocione» */
    v.innerHTML = '<div class="tk-modal" data-joya="' + i + '" role="dialog" aria-modal="true" aria-labelledby="tk-m-n"><button type="button" class="tk-x" aria-label="Cerrar">×</button>' +
      '<div class="tk-m-cab"><span class="tk-m-joya"><img src="' + JOYA(i) + '" alt=""></span><div><small>Nivel ' + (i + 1) + ' de 5' + (tuyo ? ' · el tuyo' : nv && i === nv.i + 1 ? ' · tu próxima meta' : '') + '</small><h3 id="tk-m-n">' + x.n + '</h3></div></div>' +
      '<p class="tk-m-que">' + x.que + '</p>' + abajoNivel(nv, i, tuyo) + '</div>';
    document.body.appendChild(v);
    const cerrar = () => { v.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    v.addEventListener('click', (e) => { if (e.target === v || e.target.closest('.tk-x')) cerrar(); });
    v.querySelector('.tk-x').focus();
  }

  /* ── «Tu cuenta» como tu perfil de Instagram (6-oct, Sergio: «una mini réplica de nuestro perfil de Instagram, que se
     sienta como si estuviéramos en nuestro Instagram… que todo haga parte de un mismo ecosistema»):
       · arriba, el perfil tal cual: foto con su aro, usuario, publicaciones/seguidores/seguidos, nombre, biografía, enlace.
       · los DESTACADOS son tus seis métricas; tocar uno (o la foto) abre tus números como HISTORIAS, con la explicación.
       · las pestañas de Instagram: Números (las gráficas), Qué te funciona (lo del Laboratorio) y Reels (tus videos). ── */
  const corto = (r) => r == null ? '—' : r >= 0.5 ? Math.round(r * 10) + ' de 10' : '1 de ' + Math.max(2, Math.round(1 / r));
  /* los números como los escribe Instagram en español: 1.536 · 49,8 mil · 1,2 mill. */
  function igNum(v) {
    v = n(v); if (v == null) return '—';
    if (v >= 1e6) return coma(Math.round(v / 1e5) / 10) + ' mill.';
    if (v >= 1e4) return coma(Math.round(v / 100) / 10) + ' mil';
    return Math.round(v).toLocaleString('es-CO');
  }
  let pest = 'num', hist = null;
  try { pest = localStorage.getItem('cherry-cuenta-pest') || 'num'; } catch (e) { /* sin almacenamiento */ }
  if (pest !== 'reels') pest = (TABS.find((t) => t.k === tab) || TABS[0]).g;

  /* LO NORMAL para una cuenta de tu tamaño (6-oct, APROBADO por Sergio: «con esos números está bien»; ⚠️ si se cambian,
     los decide él). Cada fila es el centro de un tamaño (1k–5k, 5k–10k, 10k–50k, 50k–100k, 100k–1M, 1M+); entre uno y
     otro se interpola (en escala logarítmica de seguidores).
       (las vistas ya NO salen de aquí: ver VIS_NORMAL / normalVis, los números de Sergio)
       crec = seguidores nuevos al mes ÷ seguidores, % (Socialinsider 2025: crecimiento anual pasado a mes; 1M+ nuestra)
       int  = interacciones por reel ÷ seguidores, % (las fuentes van de 0,5 % en marcas a 3 % en creadores)
     Detalle y fuentes: docs/INICIO.md › «Tu cuenta como tu perfil de Instagram». */
  /* LO NORMAL EN VISTAS (6-oct, Sergio, por su experiencia con creadores; la tabla de antes salía de cuentas de MARCAS y
     daba muy poco): 5.000 seguidores ≈ 3.000 vistas por reel · 50.000 ≈ 10.000 · 500.000 ≈ 200.000. Entre esos puntos se
     interpola (escala logarítmica); por debajo de 5.000 y por encima de 500.000 se queda el del extremo. % de los seguidores.
     Lo usan el destacado «Vistas» y el nivel. */
  const normalVis = (seg) => window.CherryResumen.normalVis(seg);   // (26-oct) en js/resumen-cuenta.js

  const NORMAL = [
    { s: 2236, crec: 2.7, int: 4 }, { s: 7071, crec: 2.5, int: 3 }, { s: 22361, crec: 2.46, int: 2 },
    { s: 70711, crec: 2.21, int: 1.5 }, { s: 316228, crec: 2, int: 1.2 }, { s: 3162278, crec: 1.5, int: 1 }];
  function normalPara(seg, k) {
    if (seg <= NORMAL[0].s) return NORMAL[0][k];
    for (let i = 1; i < NORMAL.length; i++) if (seg <= NORMAL[i].s) {
      const x = NORMAL[i - 1], y = NORMAL[i], t = (Math.log10(seg) - Math.log10(x.s)) / (Math.log10(y.s) - Math.log10(x.s));
      return x[k] + (y[k] - x[k]) * t;
    }
    return NORMAL[NORMAL.length - 1][k];
  }
  /* el nivel: bajo = menos del 70 % de lo normal · alto = más de 1,5 veces lo normal · medio = en el medio */
  const nivelVs = (yo, no) => (yo == null || !no) ? 'medio' : yo < no * 0.7 ? 'bajo' : yo > no * 1.5 ? 'alto' : 'medio';
  const pct = (x) => x == null ? '—' : coma(x < 1 ? Math.round(x * 100) / 100 : Math.round(x * 10) / 10) + '&nbsp;%';

  /* Las seis métricas: lo que va en cada destacado y en su historia.
     ⭐ (6-oct, Sergio) Los tres de CRECIMIENTO (Crecimiento, Vistas, Interacción) van por NIVELES contra lo normal para tu
     tamaño: alto = lima, medio = amarillo, bajo = fucsia. «Contra ti mismo no sirve: si subes un poco ya "estarías bien"
     y no es verdad». Los otros tres (Alcance, Del perfil, Guardados) siempre en grafito. Todos los números en plata. */
  function metricas() {
    if (redDe() !== 'ig') return metricasRed();
    const a = cuenta && cuenta.actual, b = cuenta && cuenta.anterior;
    if (!a) return null;
    const dias = diasSeguidores(), nuevos = dias.reduce((s, x) => s + x, 0);
    const qa = a.quienes, qb = b && b.quienes;
    const share = qa && (qa.no_seguidores + qa.seguidores) ? qa.no_seguidores / (qa.no_seguidores + qa.seguidores) : null;
    const tasa = (a.alcance && a.interactuaron != null) ? a.interactuaron / a.alcance : null;
    const tasaB = (b && b.alcance && b.interactuaron != null) ? b.interactuaron / b.alcance : null;
    const gc = (a.guardados || 0) + (a.compartidos || 0), gcB = b ? (b.guardados || 0) + (b.compartidos || 0) : null;
    const conv = (nuevos && a.perfil) ? a.perfil / nuevos : null;
    const vs = (x, y) => (x == null || y == null) ? '' : x > y * 1.1 ? 'sube' : x < y * 0.9 ? 'baja' : 'igual';
    /* el «↑ mejor que…» del crecimiento se compara mitad con mitad: Instagram solo da los seguidores por día de 30 días */
    const mitad = Math.floor(dias.length / 2), recientes = dias.slice(mitad).reduce((s, x) => s + x, 0), previos = dias.slice(0, mitad).reduce((s, x) => s + x, 0);
    const chipCrec = mitad >= 4 ? vs(recientes, previos) : '';
    /* contra lo normal para tu tamaño */
    const seg = n(ig && ig.perfil && ig.perfil.seguidores) || 0, rs = reels();
    const vistas = mediana(rs.map((v) => n(v.visitas)).filter((x) => x != null)), inter = mediana(rs.map((v) => n(v.interacciones)).filter((x) => x != null));
    const yoC = seg && dias.length ? nuevos / seg * 100 * 30 / dias.length : null;
    const yoV = seg && vistas ? vistas / seg * 100 : null, yoI = seg && inter ? inter / seg * 100 : null;
    const nC = normalPara(seg, 'crec'), nV = normalVis(seg), nI = normalPara(seg, 'int');
    const contra = (yo, no, que) => yo == null ? '' : '<span class="ig-h-normal">Tú: <b>' + pct(yo) + '</b> ' + que + ' · lo normal para tu tamaño: <b>' + pct(no) + '</b></span>';
    const reglas = (no) => '<span class="ig-h-antes">Alto desde ' + pct(no * 1.5) + ' · bajo por debajo de ' + pct(no * 0.7) + '</span>';
    return [
      { k: 'crec', n: 'Crecimiento', v: (nuevos > 0 ? '+' : '') + igNum(nuevos), grande: (nuevos > 0 ? '+' : '') + igNum(nuevos), nivel: nivelVs(yoC, nC),
        chip: chipCrec, chipQue: 'los ' + mitad + ' días anteriores',
        que: 'seguidores nuevos en ' + dias.length + ' días' + (dias.length ? ', unos ' + Math.round(nuevos / dias.length) + ' por día' : ''),
        graf: () => histArea(dias), comp: contra(yoC, nC, 'de tus seguidores al mes') + reglas(nC) },
      { k: 'vis', n: 'Vistas', v: igNum(vistas || null), grande: igNum(vistas || null), nivel: nivelVs(yoV, nV),
        que: 'vistas tiene tu reel típico (de tus últimos ' + rs.length + ')' + (share != null ? '; de los que te vieron, ' + corto(share) + ' no te seguían' : ''),
        graf: () => histDona(qa), comp: contra(yoV, nV, 'de tus seguidores por reel') + reglas(nV) },
      { k: 'int', n: 'Interacción', v: igNum(inter || null), grande: igNum(inter || null), nivel: nivelVs(yoI, nI), chip: vs(tasa, tasaB),
        que: 'me gusta, comentarios, guardados y compartidos tiene tu reel típico', graf: () => histCien(tasa, a.interactuaron),
        comp: contra(yoI, nI, 'de tus seguidores por reel') + reglas(nI) },
      { k: 'alc', n: 'Alcance', v: igNum(a.alcance), grande: igNum(a.alcance), chip: vs(a.alcance, b && b.alcance),
        que: 'personas vieron tu contenido en 28 días', graf: () => histDos(a.alcance, b && b.alcance, 'personas'),
        comp: veces(a.alcance, b && b.alcance) ? '<span class="ig-h-antes"><b>' + veces(a.alcance, b && b.alcance) + '</b> frente a los 28 días anteriores</span>' : '' },
      { k: 'perf', n: 'Del perfil', v: conv ? '1<small>/</small>' + Math.max(1, Math.round(conv)) : '—', grande: conv ? '1 de ' + Math.max(1, Math.round(conv)) : '—',
        que: 'de los que entran a tu perfil te siguen', graf: () => histEmbudo(a.perfil, nuevos), comp: '' },
      { k: 'guar', n: 'Guardados', v: igNum(gc), grande: igNum(gc), chip: vs(gc, gcB),
        que: 'veces guardaron o compartieron tu contenido', graf: () => histPartes(a.guardados || 0, a.compartidos || 0),
        comp: veces(gc, gcB) ? '<span class="ig-h-antes"><b>' + veces(gc, gcB) + '</b> frente a los 28 días anteriores</span>' : '' },
    ];
  }

  /* (26-oct) Los destacados de TikTok y YouTube: no dan los números de la cuenta (alcance, visitas al perfil, guardados),
     así que salen de sus videos y del perfil, y solo los que tienen dato. Sin «nivel» contra lo normal para tu tamaño:
     esa vara está medida con Instagram; van en grafito. */
  function metricasRed() {
    const rs = reels(), dias = diasSeguidores(), nuevos = dias.reduce((s, x) => s + x, 0), P = (ig && ig.perfil) || {};
    const yt = redDe() === 'yt', quienes = yt ? 'suscriptores' : 'seguidores';
    const vistas = mediana(rs.map((v) => n(v.visitas)).filter((x) => x != null));
    const tasas = rs.map(interDe).filter((x) => x != null), tasa = tasas.length ? mediana(tasas) : null;
    const out = [];
    if (dias.length >= 2) out.push({ k: 'crec', n: 'Crecimiento', v: (nuevos > 0 ? '+' : '') + igNum(nuevos), grande: (nuevos > 0 ? '+' : '') + igNum(nuevos),
      que: quienes + ' nuevos en ' + dias.length + ' días, unos ' + Math.round(nuevos / dias.length) + ' por día', graf: () => histArea(dias), comp: '' });
    if (vistas) out.push({ k: 'vis', n: 'Vistas', v: igNum(vistas), grande: igNum(vistas),
      que: 'vistas tiene tu video típico (de tus últimos ' + rs.length + ')', graf: () => '', comp: '' });
    if (tasa != null) out.push({ k: 'int', n: 'Interacción', v: Math.round(tasa) + '<small>%</small>', grande: Math.round(tasa) + ' de 100',
      que: 'de cada 100 que vieron tu video típico le dieron me gusta, comentaron' + (yt ? '' : ' o compartieron'), graf: () => '', comp: '' });
    if (n(P.likes) != null) out.push({ k: 'gusta', n: 'Me gusta', v: igNum(P.likes), grande: igNum(P.likes), que: 'me gusta en total en tu cuenta', graf: () => '', comp: '' });
    if (n(P.vistas) != null) out.push({ k: 'vtot', n: 'Vistas totales', v: igNum(P.vistas), grande: igNum(P.vistas), que: 'vistas en total en tu canal', graf: () => '', comp: '' });
    return out;
  }

  /* ── Los dibujos de las historias (blancos, sobre el color de cada una) ── */
  const B = '#fff', B5 = 'rgba(255,255,255,.5)', B2 = 'rgba(255,255,255,.18)';
  const T = (x, y, t, o) => txt(x, y, t, Object.assign({ c: B5 }, o || {}));
  function histArea(d) {
    if (d.length < 2) return '';
    const W = 300, H = 170, ac = []; let s = 0; d.forEach((x) => { s += x; ac.push(s); });
    const mx = Math.max(1, ac[ac.length - 1]), px = (i) => 6 + i * (W - 12) / (d.length - 1), py = (v) => H - 22 - v / mx * (H - 40);
    const pts = ac.map((v, i) => px(i).toFixed(1) + ',' + py(v).toFixed(1)).join(' ');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '"><defs><linearGradient id="igA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="6,' + (H - 22) + ' ' + pts + ' ' + px(d.length - 1) + ',' + (H - 22) + '" fill="url(#igA)"/>' +
      '<polyline class="tk-traza" pathLength="1" points="' + pts + '" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + px(d.length - 1) + '" cy="' + py(mx) + '" r="6" fill="#fff"/>' +
      T(6, H - 4, 'hace ' + d.length + ' días') + T(W - 6, H - 4, 'hoy', { a: 'end' }) + '</svg>';
  }
  function histDona(q) {
    if (!q) return '';
    const tot = q.no_seguidores + q.seguidores, r = tot ? q.no_seguidores / tot : 0;
    return '<div class="ig-h-dona"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" fill="none" stroke="' + B2 + '" stroke-width="18"/>' +
      '<circle cx="60" cy="60" r="48" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="' + Math.round(r * 100) + ' 100" transform="rotate(-90 60 60)"/></svg>' +
      '<ul><li><i class="si"></i><b>' + igNum(q.no_seguidores) + '</b> no te seguían</li><li><i></i><b>' + igNum(q.seguidores) + '</b> ya te seguían</li></ul></div>';
  }
  function histCien(r, k) {
    if (r == null) return '';
    const m = Math.max(1, Math.round(r * 100)); let s = '';
    for (let i = 0; i < 100; i++) s += '<i' + (i < m ? ' class="si"' : '') + '></i>';
    return '<div class="ig-h-cien">' + s + '</div><p class="ig-h-nota">De cada 100 que te vieron, <b>' + m + '</b> interactuaron · ' + igNum(k) + ' cuentas</p>';
  }
  function histDos(x, y, que) {
    if (x == null) return '';
    const mx = Math.max(x, y || 0, 1);
    const fila = (et, v, si) => '<div class="ig-h-fila' + (si ? ' si' : '') + '"><small>' + et + '</small><span><i style="width:' + Math.round(v / mx * 100) + '%"></i></span><b>' + igNum(v) + '</b></div>';
    return '<div class="ig-h-filas">' + fila('Estos 28 días', x, true) + (y != null ? fila('Los 28 anteriores', y, false) : '') + '</div>';
  }
  function histEmbudo(p, s) {
    if (!p) return '';
    return '<div class="ig-h-embudo"><div style="--w:100%"><b>' + igNum(p) + '</b><small>visitas a tu perfil</small></div>' +
      '<div style="--w:' + Math.max(18, Math.round(s / p * 100)) + '%"><b>' + igNum(s) + '</b><small>te siguieron</small></div></div>';
  }
  function histPartes(g, c) {
    const t = Math.max(1, g + c);
    return '<div class="ig-h-partes"><span style="flex:' + g + '"><b>' + igNum(g) + '</b><small>guardados</small></span>' +
      '<span style="flex:' + c + '"><b>' + igNum(c) + '</b><small>compartidos</small></span></div>' +
      '<p class="ig-h-nota">Guardar y compartir es lo que más le dice a Instagram que tu video vale: el ' + Math.round(g / t * 100) + '&nbsp;% fueron guardados.</p>';
  }

  /* ── Las historias: se abren al tocar la foto o un destacado. Pasan solas cada 6 s; toca a la derecha para la
     siguiente y a la izquierda para volver; Esc o la × cierran. ── */
  const DURA = 6000;
  function abrirHistoria(i) {
    const ms = metricas(); if (!ms || !ms.length) return;
    const P = (ig && ig.perfil) || {};
    const v = document.createElement('div');
    v.className = 'ig-velo';
    v.innerHTML = '<div class="ig-hist" role="dialog" aria-modal="true" aria-label="Tus números como historias">' +
      '<div class="ig-h-barras">' + ms.map(() => '<i><u></u></i>').join('') + '</div>' +
      '<header class="ig-h-cab"><span class="ig-h-foto">' + (P.foto ? '<img src="' + esc(P.foto) + '" alt="">' : '') + '</span>' +
      '<b>' + esc(P.usuario || '') + '</b><span class="ig-h-cuando">' + (redDe() === 'ig' ? 'últimos 28 días' : 'tus últimos videos') + '</span>' +
      '<button type="button" class="ig-h-x" aria-label="Cerrar">×</button></header>' +
      '<div class="ig-h-cuerpo"></div>' +
      '<button type="button" class="ig-h-ant" aria-label="Anterior"></button><button type="button" class="ig-h-sig" aria-label="Siguiente"></button></div>';
    v.style.setProperty('--foto', P.foto ? 'url("' + P.foto + '")' : 'none');
    document.body.appendChild(v);
    hist = { v, i: -1, reloj: 0 };
    const ir = (k) => {
      if (k < 0) k = 0;
      if (k >= ms.length) return cerrar();
      hist.i = k;
      const m = ms[k], h = v.querySelector('.ig-hist');
      if (m.nivel) h.dataset.nivel = m.nivel; else delete h.dataset.nivel;
      v.querySelectorAll('.ig-h-barras i').forEach((b, j) => { b.className = j < k ? 'ya' : j === k ? 'va' : ''; });
      const u = v.querySelectorAll('.ig-h-barras u')[k]; u.style.animation = 'none'; void u.offsetWidth; u.style.animation = '';
      v.querySelector('.ig-h-cuerpo').innerHTML = '<span class="ig-h-etq">' + m.n + (m.nivel ? ' <i class="ig-h-nivel">· nivel ' + m.nivel + '</i>' : '') + '</span><b class="ig-h-num">' + m.grande + '</b>' +
        '<p class="ig-h-que">' + m.que + '</p><div class="ig-h-graf">' + (m.graf() || '') + '</div>' +
        (m.chip ? '<span class="ig-h-chip ' + m.chip + '">' + (m.chip === 'sube' ? '↑ Mejor que ' : m.chip === 'baja' ? '↓ Menos que ' : '= Igual que ') + (m.chipQue || 'el mes pasado') + '</span>' : '') + m.comp;
      clearTimeout(hist.reloj); hist.reloj = setTimeout(() => ir(hist.i + 1), DURA);
    };
    const cerrar = () => { clearTimeout(hist && hist.reloj); v.remove(); document.removeEventListener('keydown', tecla); hist = null; };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); else if (e.key === 'ArrowRight') ir(hist.i + 1); else if (e.key === 'ArrowLeft') ir(hist.i - 1); };
    document.addEventListener('keydown', tecla);
    v.addEventListener('click', (e) => {
      if (e.target === v || e.target.closest('.ig-h-x')) cerrar();
      else if (e.target.closest('.ig-h-sig')) ir(hist.i + 1);
      else if (e.target.closest('.ig-h-ant')) ir(hist.i - 1);
    });
    ir(i || 0);
    v.querySelector('.ig-h-x').focus();
  }

  /* ── Reels: la cuadrícula de Instagram, con las vistas encima. Tantas columnas como quepan casi en 9:16, a todo el ancho. ── */
  function pintaReels() {
    const caja = nodoC && nodoC.querySelector('.ig-reels'); if (!caja) return;
    const rs = reels().slice().reverse();
    if (!rs.length) { caja.innerHTML = '<p class="tk-g-vacio">Cuando publiques un reel, aquí lo ves con sus vistas.</p>'; return; }
    const H = caja.clientHeight || 200, W = caja.clientWidth || 400, w = H * 9 / 16, cuantos = Math.max(1, Math.min(rs.length, Math.round((W + 4) / (w + 4))));
    const tope = Math.round(w * 1.25);   // (26-oct) con pocos videos no se estiran: casi 9:16, pegados a la izquierda
    caja.innerHTML = rs.slice(0, cuantos).map((v) => '<a class="ig-reel" style="max-width:' + tope + 'px" href="' + esc(v.enlace || '#') + '" target="_blank" rel="noopener" title="' + esc(v.titulo || '') + '">' +
      (v.tapa ? '<img src="' + esc(v.tapa) + '" alt="" loading="lazy">' : '') +
      '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>' + igNum(v.visitas) + '</span></a>').join('');
  }

  const ICONO = {
    num: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    fun: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    reels: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 8.5h18M8.5 3l3 5.5M14.5 3l3 5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 12v6l5-3z" fill="currentColor"/></svg>',
  };
  const PESTS = [{ k: 'num', n: 'Números' }, { k: 'fun', n: 'Qué te funciona' }, { k: 'reels', n: 'Reels' }];

  function pintaPest() {
    if (!nodoC) return;
    nodoC.querySelectorAll('[data-ig-pest]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-ig-pest') === pest)));
    // si la gráfica escogida no existe en esta red, la primera que sí (sin guardarla: al volver a Instagram sigue la tuya)
    if (pest !== 'reels' && !hayDato(tab)) tab = (TABS.find((x) => x.g === pest && hayDato(x.k)) || { k: tab }).k;
    nodoC.querySelectorAll('.ig-chips [data-tk-tab]').forEach((b) => { const k = b.getAttribute('data-tk-tab'); b.hidden = (TABS.find((t) => t.k === k) || {}).g !== pest || !hayDato(k);
      if (k === 'seg') b.textContent = redDe() === 'yt' ? 'Suscriptores' : 'Seguidores'; });
    const enReels = pest === 'reels';
    nodoC.querySelector('.ig-chips').hidden = enReels;
    nodoC.querySelector('.ig-graf').hidden = enReels;
    nodoC.querySelector('.ig-reels').hidden = !enReels;
    if (enReels) pintaReels(); else pintaGrafica();
  }

  function pintaCuenta() {
    if (!nodoC) return;
    const caja = nodoC.querySelector('.tk');
    // (25-oct) el interruptor de red: las mismas pantallas, con lo de TikTok, YouTube o (pronto) Facebook
    if (!ig || !ig.perfil) {
      const r = REDES_V[redDe()] ? redDe() : 'ig', v = REDES_V[r], forma = 'vacia-' + r;
      if (caja.dataset.forma !== forma) {
        caja.classList.remove('tk-perfil');
        caja.innerHTML = '<div class="tk-vacia"><div class="ig-red"></div>' +
          '<span class="tk-vacia-ico" aria-hidden="true"><svg viewBox="0 0 24 24">' + v.ico + '</svg></span>' +
          '<h3>' + v.t + '</h3><p>' + v.p + '</p>' +
          (v.b ? '<button type="button" class="ci-btn ci-btn--claro" data-tk-conectar="' + r + '">' + v.b + '</button>' : '<span class="tk-pronto">Próximamente</span>') + '</div>';
        caja.dataset.forma = forma; ultimaGrafica = '';
        const q = Q(); if (q && q.interruptorRed) q.interruptorRed(caja.querySelector('.ig-red'));
      }
      return;
    }
    const P = ig.perfil;
    if (caja.dataset.forma !== 'llena') {
      caja.classList.add('tk-perfil');
      caja.innerHTML =
        '<div class="ig-perfil">' +
          '<header class="ig-cab"><button type="button" class="ig-foto" data-ig-historia="0" aria-label="Ver tus números como historias"><span class="ig-foto-in"></span></button>' +
          '<div class="ig-quien"><h3 class="ig-usr"></h3><ul class="ig-stats"></ul></div></header>' +
          '<div class="ig-bio"><b class="ig-nombre"></b><p class="ig-texto"></p><a class="ig-web" target="_blank" rel="noopener" hidden></a></div>' +
          '<div class="ig-acc"><a class="ig-btn" href="' + LAB('v7') + '">Planear el próximo</a><a class="ig-btn" href="' + LAB('v5') + '">Mis videos</a></div>' +
          '<div class="ig-dest" role="list" aria-label="Tus números: tócalos para verlos como historias"></div>' +
          /* (15-oct, rebrand sobrio) qué quiere decir el aro de color de los tres de crecimiento */
          '<div class="ig-ley"><span class="bajo"><i></i>bajo</span><span class="medio"><i></i>normal</span><span class="alto"><i></i>alto</span><span>· para una cuenta de tu tamaño</span></div>' +
        '</div>' +
        '<div class="ig-lado">' +
          '<div class="ig-red"></div>' +
          '<nav class="ig-pests" role="tablist">' + PESTS.map((p) => '<button type="button" role="tab" data-ig-pest="' + p.k + '">' + ICONO[p.k] + '<span>' + p.n + '</span></button>').join('') + '</nav>' +
          '<div class="tk-tabs ig-chips">' + TABS.map((t) => '<button type="button" role="tab" data-tk-tab="' + t.k + '">' + t.n + '</button>').join('') + '</div>' +
          '<div class="ig-graf"><span class="tk-g-titulo"></span><div class="tk-g-lienzo"></div></div>' +
          '<div class="ig-reels" hidden></div>' +
        '</div>';
      caja.dataset.forma = 'llena'; ultimaGrafica = '';
      const q = Q(); if (q && q.interruptorRed) q.interruptorRed(caja.querySelector('.ig-red'));
    }
    const inicial = '<b>' + esc(String(P.usuario || '?').charAt(0).toUpperCase()) + '</b>';
    const fotoEl = caja.querySelector('.ig-foto-in');
    if (fotoEl.dataset.src !== (P.foto || '')) {
      fotoEl.dataset.src = P.foto || '';
      fotoEl.innerHTML = P.foto ? '<img src="' + esc(P.foto) + '" alt="">' : inicial;
      /* la dirección de la foto de Instagram vence a los pocos días: si ya no carga, la inicial y se pide el perfil fresco */
      const im = fotoEl.querySelector('img'); if (im) im.onerror = () => { fotoEl.innerHTML = inicial; const q = Q(); if (q && q.refrescarPerfil) q.refrescarPerfil(); };
    }
    caja.style.setProperty('--foto', P.foto ? 'url("' + P.foto + '")' : 'none');
    caja.querySelector('.ig-usr').textContent = P.usuario || '';
    caja.querySelector('.ig-stats').innerHTML = [[P.publicaciones, redDe() === 'ig' ? 'publicaciones' : 'videos'], [P.seguidores, redDe() === 'yt' ? 'suscriptores' : 'seguidores'], [P.seguidos, 'seguidos']]
      .filter((x) => x[0] != null).map((x) => '<li><b>' + igNum(x[0]) + '</b> ' + x[1] + '</li>').join('');
    caja.querySelector('.ig-nombre').textContent = P.nombre_real || '';
    caja.querySelector('.ig-texto').textContent = String(P.bio || '').replace(/[ \t]+\n/g, '\n').trim();
    const web = caja.querySelector('.ig-web');
    web.hidden = !P.web;
    if (P.web) { web.href = P.web; web.textContent = String(P.web).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); }
    const ms = metricas();
    const dest = caja.querySelector('.ig-dest');
    dest.innerHTML = (ms || [{ n: 'Crecimiento' }, { n: 'Vistas' }, { n: 'Interacción' }, { n: 'Alcance' }, { n: 'Del perfil' }, { n: 'Guardados' }])
      .map((m, i) => '<button type="button" role="listitem" class="ig-d"' + (m.nivel ? ' data-nivel="' + m.nivel + '"' : '') + (ms ? ' data-ig-historia="' + i + '"' : ' disabled') + '>' +
        '<span class="ig-d-c"><span class="ig-d-in">' + (ms ? '<b>' + m.v + '</b>' : '<b>…</b>') + '</span>' +
        (m.chip === 'sube' ? '<i class="ig-d-chip sube" title="Mejor que el mes pasado">↑</i>' : m.chip === 'baja' ? '<i class="ig-d-chip baja" title="Menos que el mes pasado">↓</i>' : '') +
        '</span><small>' + m.n + '</small></button>').join('');
    // (26-oct) sin destacados (una red sin datos de la cuenta) no queda la fila vacía; la clave de colores, solo si hay niveles
    dest.hidden = !!ms && !ms.length;
    caja.querySelector('.ig-ley').hidden = !!ms && !ms.some((m) => m.nivel);
    caja.querySelector('.ig-foto').classList.toggle('con', !!(ms && ms.length));
    pintaPest();
  }

  function pinta() {
    nivel = ig && ig.perfil ? nivelDe(ig.perfil.seguidores, reels()) : null;
    pintaCuenta();
    pintaNivel();
    pintaVideo();
  }

  /* Los tres nodos comparten un solo manejo de clics y un solo arranque */
  function alTocar(e) {
    const t = e.target;
    const tb = t.closest('[data-tk-tab]');
    if (tb) { tab = tb.getAttribute('data-tk-tab'); try { localStorage.setItem('cherry-cuenta-grafica', tab); } catch (er) { /* nada */ } pintaGrafica(); return; }
    const tp = t.closest('[data-ig-pest]');
    if (tp) {
      pest = tp.getAttribute('data-ig-pest');
      if (pest !== 'reels' && (TABS.find((x) => x.k === tab) || {}).g !== pest) tab = TABS.find((x) => x.g === pest).k;
      try { localStorage.setItem('cherry-cuenta-pest', pest); localStorage.setItem('cherry-cuenta-grafica', tab); } catch (er) { /* nada */ }
      pintaPest(); return;
    }
    const th = t.closest('[data-ig-historia]');
    if (th) { abrirHistoria(+th.getAttribute('data-ig-historia')); return; }
    const tv = t.closest('[data-tk-v]');
    if (tv) { jv = +tv.getAttribute('data-tk-v'); pintaVideo(); arranca(); return; }
    const tn = t.closest('[data-tk-nivel]');
    if (tn) { abrirNivel(+tn.getAttribute('data-tk-nivel')); return; }
    const tc = t.closest('[data-tk-conectar]');
    if (tc) {
      const q = Q(), r = tc.getAttribute('data-tk-conectar') || 'ig';
      if (r === 'ig') { if (q && q.conectar) q.conectar(); } else if (q && q.conectarRed) q.conectarRed(r);
    }
  }
  function nuevo(clase, etiqueta, interior) {
    const el = C.h('section', { class: 'ci-t ci-vol ' + clase, 'aria-label': etiqueta }, C.h('div', { class: interior }));
    el.addEventListener('click', alTocar);
    return el;
  }
  function iniciar() {
    if (listo) return;
    listo = true;
    const q = Q();
    if (q && q.cuandoLlegueInstagram) q.cuandoLlegueInstagram(refresca);
    pedirLab();
    pedirHist();
    refresca();
    arranca();
  }

  C.tarjetaCuenta = function () {
    if (!nodoC) {
      nodoC = nuevo('tk-tarjeta', 'Tu cuenta', 'tk');
      if (window.ResizeObserver) new ResizeObserver(() => { if (pest === 'reels') pintaReels(); else pintaGrafica(); }).observe(nodoC);
      iniciar(); pintaCuenta();
    }
    return nodoC;
  };
  C.tarjetaNivel = function () {
    if (!nodoN) { nodoN = nuevo('ci-nivelt', 'Tu nivel', 'nv'); iniciar(); pintaNivel(); }
    return nodoN;
  };
  C.tarjetaVideo = function () {
    if (!nodoV) {
      nodoV = nuevo('ci-videot', 'Tu video', 'tv');
      /* Con el ratón encima, el video no se va solo: nadie lee un dato que se mueve. */
      nodoV.addEventListener('mouseenter', () => { quieto = true; });
      nodoV.addEventListener('mouseleave', () => { quieto = false; });
      iniciar(); pintaVideo();
    }
    return nodoV;
  };

  (C.onApiReady = C.onApiReady || []).push(() => { pedidaCuenta = ''; pedirLab(); pedirHist(); refresca(); });
})();

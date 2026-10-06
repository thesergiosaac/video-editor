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
  const coma = (x) => String(x).replace('.', ',');
  function mil(v) {
    v = n(v); if (v == null) return '—';
    if (v >= 1e6) return coma(Math.round(v / 1e5) / 10) + ' mill.';
    if (v >= 1e4) return Math.round(v / 1e3) + ' mil';
    return Math.round(v).toLocaleString('es-CO');
  }
  const veces = (a, b) => (n(a) && n(b)) ? '×' + coma(Math.round(a / b * 10) / 10) : '';

  /* ── Los niveles ─────────────────────────────────────────────────────────────────────────────
     La regla es la del aro de antes (resumen-cuenta.js › alcanceDe): los tres mejores videos, el del medio; vistas ÷
     seguidores (con suelo de 500) y vistas en crudo; manda el menor. Los dos primeros pasos se juntan en «Aprendiz».
     ⚠️ Los números son de Sergio: si quiere que «Creador» empiece antes, se cambia RELATIVO[1]. */
  const RELATIVO = [0.5, 1, 3, 10, 30];          // vistas ÷ seguidores para pasar cada peldaño
  const EN_CRUDO = [500, 2000, 10000, 40000, 100000];
  /* ⚠️ (4-oct, Sergio) Cada texto dice lo que el nivel MIDE: a cuánta gente llegan tus mejores videos comparado con tus
     seguidores. Nada de «te ven tus seguidores»: Instagram nunca le muestra un video a todos tus seguidores. */
  const NIVELES = [
    { n: 'Aprendiz', que: 'Es el primer nivel: todavía llegas a poca gente para el tamaño de tu cuenta. Incluso tus mejores videos los ven menos personas de las que te siguen.',
      como: 'Tus mejores videos tienen <b>menos vistas que seguidores</b> tienes.' },
    { n: 'Creador', que: 'Tus mejores videos ya tienen tantas vistas como seguidores tienes, o más: tu contenido empieza a moverse por su cuenta.',
      como: 'Tus mejores videos tienen <b>entre 1 y 3 veces</b> tus seguidores en vistas, y por lo menos <b>2.000</b>.' },
    { n: 'Experto', que: 'Tus mejores videos tienen varias veces tus seguidores en vistas: Instagram ya los recomienda a mucha gente que no te conoce.',
      como: 'Tus mejores videos tienen <b>entre 3 y 10 veces</b> tus seguidores en vistas, y por lo menos <b>10.000</b>.' },
    { n: 'Maestro', que: 'Tus mejores videos se comparten y se mueven solos: llegan a diez veces tus seguidores o más.',
      como: 'Tus mejores videos tienen <b>entre 10 y 30 veces</b> tus seguidores en vistas, y por lo menos <b>40.000</b>.' },
    { n: 'Leyenda', que: 'Lo más alto: tus mejores videos llegan a muchísima más gente de la que te sigue.',
      como: 'Tus mejores videos tienen <b>30 veces tus seguidores o más</b> en vistas, y por lo menos <b>100.000</b>.' },
  ];
  const SUBIR = ['Que tus mejores videos tengan <b>tantas vistas como seguidores tienes</b> (y al menos 2.000).',
    'Que tus mejores videos tengan <b>3 veces tus seguidores</b> en vistas y pasen de 10.000.',
    'Que tus mejores videos tengan <b>10 veces tus seguidores</b> en vistas y pasen de 40.000.',
    'Que tus mejores videos tengan <b>30 veces tus seguidores</b> en vistas y pasen de 100.000.',
    'Ya estás arriba: el Laboratorio te dice qué piezas lo lograron, para repetirlo.'];
  /* lo mismo, corto, para la tarjeta («Para ser Creador: …») */
  const SUBIR_CORTO = ['llegar al 100 % (y a 2.000 vistas)', 'llegar a 3 veces tus seguidores (y a 10.000 vistas)',
    'llegar a 10 veces tus seguidores (y a 40.000 vistas)', 'llegar a 30 veces tus seguidores (y a 100.000 vistas)'];
  const JOYA = (i) => 'assets/marca/niveles/n' + (i + 1) + '.webp?v=20261006';   // 6-oct: rehechas sin piso

  function nivelDe(seguidores, videos) {
    const vs = videos.map((v) => n(v.visitas)).filter((x) => x != null).sort((a, b) => b - a);
    if (!vs.length || !n(seguidores)) return null;
    const medio = vs.length >= 3 ? vs[1] : vs[0];
    const x = medio / Math.max(n(seguidores), 500);
    let iRel = 0; while (iRel < RELATIVO.length && x >= RELATIVO[iRel]) iRel++;
    let iAbs = 0; while (iAbs < EN_CRUDO.length && medio >= EN_CRUDO[iAbs]) iAbs++;
    const paso = Math.min(iRel, iAbs);
    const i = Math.max(0, paso - 1);
    // lo que llevas del camino al siguiente: el menor de los dos avances
    let avance = 1;
    if (i < 4) avance = Math.min(1, x / RELATIVO[i + 1], medio / EN_CRUDO[i + 1]);
    return { i, x, medio, avance };
  }

  /* ── Los datos ── */
  function leerIG() {
    const q = Q(); if (!q || !q.instagram) return null;
    return q.instagram();
  }
  function pedirCuenta() {
    const q = Q(); if (!q || !q.llamar || !ig || !ig.perfil) return;
    if (pedidaCuenta === ig.marca) return;
    pedidaCuenta = ig.marca;
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

  /* Los reels medidos, del más viejo al de hoy (los últimos 10). */
  function reels() {
    const vs = ((ig && ig.videos) || []).filter((v) => String(v.tipo || '').toUpperCase() === 'REELS' && n(v.visitas) != null);
    return vs.slice(0, 10).reverse();
  }
  const inicioDe = (v) => n(v.omisiones) == null ? null : Math.round(100 - n(v.omisiones));
  const interDe = (v) => (n(v.interacciones) != null && n(v.alcance)) ? n(v.interacciones) / n(v.alcance) * 100 : null;
  const tiempoDe = (v) => n(v.vistoMedio);
  const edadH = (v) => v.creado ? (Date.now() - Date.parse(v.creado)) / 36e5 : 1e9;
  function diasSeguidores() {
    const d = ((cuenta && cuenta.seguidoresDia) || []).map((x) => x.nuevos);
    if (d.length && d[d.length - 1] === 0) d.pop();      // el día de hoy todavía no termina
    return d;
  }

  /* ── Las gráficas (SVG al tamaño real del recuadro: nada se estira) ── */
  const ROSA = '#FF2D8A', VERDE = '#11806F', AMBAR = '#E8A800', TINTA = 'var(--tinta)', GRIS = 'color-mix(in srgb,var(--tinta) 12%,transparent)', T3 = 'var(--tinta-3)';
  function txt(x, y, t, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + (o.f || 'DM Mono, monospace') + '" font-size="' + (o.s || 10) + '" fill="' + (o.c || T3) + '"' +
      (o.a ? ' text-anchor="' + o.a + '"' : '') + (o.w ? ' font-weight="' + o.w + '"' : '') + '>' + esc(t) + '</text>';
  }
  /* Seguidores: área rosada con la línea que brilla, se dibuja sola y termina en un punto que late */
  function area(d, W, H) {
    const ac = []; let s = 0; d.forEach((x) => { s += x; ac.push(s); });
    const mx = Math.max(1, ac[ac.length - 1]);
    const px = (i) => 8 + i * (W - 70) / Math.max(1, d.length - 1), py = (v) => H - 18 - v / mx * (H - 40);
    const pts = ac.map((v, i) => px(i).toFixed(1) + ',' + py(v).toFixed(1));
    const fx = px(d.length - 1), fy = py(mx);
    return '<defs><linearGradient id="tkA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ROSA + '" stop-opacity=".38"/><stop offset="1" stop-color="' + ROSA + '" stop-opacity="0"/></linearGradient>' +
      '<filter id="tkBrillo" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>' +
      '<polygon points="8,' + (H - 18) + ' ' + pts.join(' ') + ' ' + fx + ',' + (H - 18) + '" fill="url(#tkA)"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + ROSA + '" stroke-width="7" opacity=".32" filter="url(#tkBrillo)"/>' +
      '<polyline class="tk-traza" pathLength="1" points="' + pts.join(' ') + '" fill="none" stroke="' + ROSA + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle class="tk-late" cx="' + fx + '" cy="' + fy + '" r="6" fill="' + ROSA + '"/><circle cx="' + fx + '" cy="' + fy + '" r="6" fill="' + ROSA + '"/>' +
      txt(fx + 12, fy + 5, '+' + mx, { s: 16, c: TINTA, w: 800, f: 'Outfit, sans-serif' }) + txt(8, H - 4, 'hace ' + d.length + ' días') + txt(fx, H - 4, 'hoy', { a: 'end' });
  }
  function columnas(d, nombres, W, H) {
    const mx = Math.max.apply(null, d) * 1.08, m = media(d), bw = (W - 20) / d.length, py = (v) => H - 18 - v / mx * (H - 34);
    return d.map((v, i) => { const x = 10 + i * bw + 4, y = py(v);
      return '<rect x="' + x + '" y="' + y + '" width="' + Math.max(4, bw - 8) + '" height="' + (H - 18 - y) + '" rx="4" fill="' + (v >= m ? ROSA : GRIS) + '"><title>' + esc(nombres[i]) + ': ' + mil(v) + '</title></rect>'; }).join('') +
      '<line x1="6" x2="' + (W - 6) + '" y1="' + py(m) + '" y2="' + py(m) + '" stroke="var(--tinta)" stroke-dasharray="5 5" stroke-width="1.3"/>' +
      txt(W - 8, py(m) - 6, 'tu promedio · ' + mil(m), { a: 'end', c: TINTA }) + txt(10, H - 4, 'más viejo') + txt(W - 10, H - 4, 'el de hoy', { a: 'end' });
  }
  function columnasValor(d, nombres, color, fmt, normal, W, H) {
    const mx = Math.max.apply(null, d) * 1.2, m = media(d), bw = (W - 20) / d.length, py = (v) => H - 18 - v / mx * (H - 30);
    return d.map((v, i) => { const x = 10 + i * bw + 5, y = py(v), arriba = v >= m, w = Math.max(4, bw - 10);
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (H - 18 - y) + '" rx="5" fill="' + (arriba ? color : GRIS) + '"><title>' + esc(nombres[i]) + ': ' + fmt(v) + '</title></rect>' +
        txt(x + w / 2, y - 5, fmt(v), { a: 'middle', c: arriba ? TINTA : T3, w: 700, s: 10.5 }); }).join('') +
      '<line x1="6" x2="' + (W - 6) + '" y1="' + py(m) + '" y2="' + py(m) + '" stroke="var(--tinta)" stroke-dasharray="5 5" stroke-width="1.2" opacity=".6"/>' +
      txt(10, H - 4, normal(m)) + txt(W - 10, H - 4, 'el de hoy →', { a: 'end' });
  }
  function cienes(d, nombres, W, H) {
    const bw = (W - 20) / d.length, alto = H - 34, m = media(d);
    return d.map((v, i) => { const x = 10 + i * bw + 5, w = Math.max(4, bw - 10), hq = v / 100 * alto;
      return '<rect x="' + x + '" y="6" width="' + w + '" height="' + alto + '" rx="5" fill="' + GRIS + '"/>' +
        '<rect x="' + x + '" y="' + (6 + alto - hq) + '" width="' + w + '" height="' + hq + '" rx="5" fill="' + (v >= m ? VERDE : '#7FB8AE') + '"><title>' + esc(nombres[i]) + ': ' + v + ' de 100</title></rect>' +
        txt(x + w / 2, 6 + alto - hq + 14, v, { a: 'middle', c: '#fff', w: 700, s: 11 }); }).join('') +
      txt(10, H - 4, 'claro: lo pasaron de largo') + txt(W - 10, H - 4, 'lleno: se quedaron', { a: 'end' });
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
  function grafica(k, W, H) {
    const rs = reels(), nombres = rs.map((v) => v.titulo || '');
    const vacio = (t) => ({ t: '', svg: '', vacio: t });
    if (k === 'seg') {
      const d = diasSeguidores();
      if (d.length < 2) return vacio(cuenta ? 'Instagram todavía no tiene tus seguidores por día.' : 'Trayendo tus números de Instagram…');
      return { t: 'Lo que vas sumando en seguidores · ' + d.length + ' días', svg: area(d, W, H) };
    }
    if (rs.length < 2) return vacio('Cuando publiques al menos dos reels, aquí ves cómo le va a cada uno.');
    if (k === 'vistas') return { t: 'Vistas de cada video · tus últimos ' + rs.length, svg: columnas(rs.map((v) => n(v.visitas)), nombres, W, H) };
    if (k === 'inter') { const d = rs.map(interDe); if (d.some((x) => x == null)) return vacio('Faltan datos de alcance en algunos videos.');
      return { t: 'De cada 100 que vieron cada video, cuántos interactuaron', svg: columnasValor(d, nombres, VERDE, (x) => Math.round(x), (m) => 'lo normal: ' + Math.round(m) + ' de cada 100', W, H) }; }
    if (k === 'inicio') { const d = rs.map(inicioDe); if (d.some((x) => x == null)) return vacio('Instagram no da este dato para algunos videos.');
      return { t: 'De cada 100, cuántos pasaron el inicio de cada video', svg: cienes(d, nombres, W, H) }; }
    if (k === 'tiempo') { const d = rs.map(tiempoDe); if (d.some((x) => x == null)) return vacio('Instagram no da este dato para algunos videos.');
      return { t: 'Segundos que se quedó la gente en cada video', svg: columnasValor(d, nombres, AMBAR, (x) => Math.round(x) + ' s', (m) => 'lo normal: ' + coma(Math.round(m * 10) / 10) + ' s', W, H) }; }
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
    nodoC.querySelector('.tk-g-titulo').textContent = g.t || '';
    caja.innerHTML = g.vacio
      ? '<p class="tk-g-vacio">' + esc(g.vacio) + (/Laboratorio/.test(g.vacio) ? ' <a href="' + LAB('') + '">Ir al Laboratorio ›</a>' : '') + '</p>'
      : g.html ? g.html
      : '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(g.t) + '">' + g.svg + '</svg>';
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
    let sello = 'Como siempre', clase = '';
    if (edadH(v) < 48) sello = 'Se está midiendo';
    else if (yo.i != null && yo.i === Math.max.apply(null, ini)) { sello = '★ Tu mejor gancho'; clase = 'si'; }
    else if (yo.v != null && yo.v === Math.max.apply(null, vistas)) { sello = '★ El más visto'; clase = 'si'; }
    else if (yo.t != null && yo.t === Math.max.apply(null, tie)) { sello = '★ El que más retuvo'; clase = 'si'; }
    else if (yo.x != null && yo.x === Math.max.apply(null, ints)) { sello = '★ El que más interacción tuvo'; clase = 'si'; }
    else if (yo.v != null && yo.v >= mv * 1.2) { sello = 'Por encima de lo normal'; clase = 'si'; }
    else if (yo.v != null && yo.v <= mv * 0.8) { sello = 'Por debajo de lo normal'; clase = 'baja'; }
    const comp = (a, b) => (a == null || !b) ? '' : a >= b * 1.05 ? coma(Math.round(a / b * 10) / 10) + '× lo normal' : a <= b * 0.95 ? 'menos que lo normal' : 'como siempre';
    const barra = (et, a, b, val) => '<div class="tk-vc"><span class="tk-vc-n">' + et + '<em' + (a > b * 1.05 ? ' class="sube"' : '') + '>' + comp(a, b) + '</em></span>' +
      '<span class="tk-vc-b"><i style="width:' + Math.round(100 * a / Math.max(a, b, 1)) + '%"></i><u style="width:' + Math.round(100 * b / Math.max(a, b, 1)) + '%"></u></span><b>' + val + '</b></div>';
    let puntos = ''; if (yo.x != null) { const k = Math.round(yo.x); for (let i = 0; i < 100; i++) puntos += '<i' + (i < k ? ' class="si"' : '') + '></i>'; }
    const aro = yo.i == null ? '' : '<div class="tk-aro"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="color-mix(in srgb,var(--tinta) 9%,transparent)" stroke-width="8"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="' + VERDE + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (163.4 * yo.i / 100).toFixed(1) + ' 163.4" transform="rotate(-90 32 32)"/></svg>' +
      '<div><b>' + yo.i + ' de 100</b><small>pasaron el inicio' + (mi ? ' · tú sueles ' + Math.round(mi) : '') + '</small></div></div>';
    const tapa = v.tapa ? '<img src="' + esc(v.tapa) + '" alt="" loading="lazy">' : '';
    const dur = n(v.dur) ? '<span class="tk-dur">' + Math.floor(n(v.dur) / 60) + ':' + String(Math.round(n(v.dur) % 60)).padStart(2, '0') + '</span>' : '';
    return {
      sello, clase,
      cuando: v.creado && window.CherryResumen && window.CherryResumen.hace ? window.CherryResumen.hace(v.creado) : '',
      html: '<div class="tk-v-arriba"><a class="tk-mini" href="' + esc(v.enlace || '#') + '" target="_blank" rel="noopener" aria-label="Ver el video en Instagram">' + tapa +
        '<span class="tk-play" aria-hidden="true"></span>' + dur + '</a>' +
        '<div class="tk-v-der"><h4>' + esc(v.titulo || 'Sin texto') + '</h4>' + aro + '</div></div>' +
        '<div class="tk-v-comp">' +
        (yo.v != null ? barra('Vistas', yo.v, mv, mil(yo.v)) : '') +
        (yo.t != null ? barra('Tiempo visto', yo.t, mt, Math.round(yo.t) + ' s') : '') +
        (yo.x != null ? '<div class="tk-vc"><span class="tk-vc-n">Interacción<em' + (yo.x > mint * 1.05 ? ' class="sube"' : '') + '>' + comp(yo.x, mint) + '</em></span><span class="tk-puntos" aria-hidden="true">' + puntos + '</span><b>' + Math.round(yo.x) + '/100</b></div>' : '') +
        '</div>',
    };
  }
  function pintaVideo() {
    if (!nodoV) return;
    const caja = nodoV.querySelector('.tv');
    if (!ig || !ig.perfil) { caja.innerHTML = '<span class="ci-etq">Tu video</span><p class="tk-g-vacio">Cuando conectes tu Instagram, aquí ves lo que pasó con cada video.</p>'; caja.dataset.forma = ''; return; }
    const rs = reels(), lista = rs.slice().reverse().slice(0, 6);   // los más recientes primero
    if (!lista.length) { caja.innerHTML = '<span class="ci-etq">Tu video</span><p class="tk-g-vacio">Cuando publiques un reel, aquí ves lo que pasó con él.</p>'; caja.dataset.forma = ''; return; }
    if (caja.dataset.forma !== 'lleno') {
      caja.innerHTML = '<div class="tv-cab"><span class="ci-etq">Tu video<span class="tv-cuando"></span></span><span class="tk-sello"></span></div>' +
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
      (i === jv ? ' aria-current="true"' : '') + '><span>' + (v.tapa ? '<img src="' + esc(v.tapa) + '" alt="" loading="lazy">' : '') + '</span><small>' + mil(v.visitas) + '</small></button>').join('');
  }
  function arranca() {
    clearInterval(reloj);
    reloj = setInterval(() => { if (quieto || document.hidden) return; jv++; pintaVideo(); }, VUELTA);
  }

  /* ── «Tu nivel»: el aro que brilla con tu cereza y las cinco cerezas ── */
  function pintaNivel() {
    if (!nodoN) return;
    const nv = nivel, caja = nodoN.querySelector('.nv');
    nodoN.dataset.joya = nv ? String(nv.i) : '0';   // la luz de la tarjeta toma el color de tu cereza (styles.css › «TU NIVEL»)
    const joyas = '<div class="nv-joyas">' + NIVELES.map((x, i) => '<button type="button" class="nv-joya ' + (nv && i <= nv.i ? 'si' : 'no') + (nv && i === nv.i ? ' yo' : '') + '" data-tk-nivel="' + i + '" aria-label="' + x.n + ': qué significa">' +
      '<img src="' + JOYA(i) + '" alt=""><small>' + x.n + '</small></button>').join('') + '</div>';
    if (!nv) {
      caja.innerHTML = '<span class="ci-etq">Tu nivel</span><p class="nv-vacio">' + (!ig || !ig.perfil
        ? 'Conecta tu Instagram y Cherry te dice en qué nivel estás: a cuánta gente llegan tus mejores videos.'
        : 'Tu nivel aparece cuando tengas videos medidos.') + '</p>' + joyas;
      return;
    }
    const x = nv.x < 1 ? 'al <b>' + Math.round(nv.x * 100) + '&nbsp;%</b> de tus seguidores' : 'a <b>' + coma(Math.round(nv.x * 10) / 10) + ' veces</b> tus seguidores';
    const pct = Math.round(Math.min(1, nv.avance) * 100);
    caja.innerHTML = '<span class="ci-etq">Tu nivel</span>' +
      '<div class="nv-cuerpo"><button type="button" class="nv-aro" data-tk-nivel="' + nv.i + '" aria-label="' + NIVELES[nv.i].n + ': qué significa"><i class="nv-brillo"></i>' +
      '<svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="66" fill="none" stroke="color-mix(in srgb,var(--tinta) 7%,transparent)" stroke-width="12"/>' +
      '<circle class="nv-avance" cx="80" cy="80" r="66" fill="none" stroke="' + ROSA + '" stroke-width="12" stroke-linecap="round" pathLength="100" stroke-dasharray="' + Math.max(2, pct) + ' 100" transform="rotate(-90 80 80)"/></svg>' +
      '<img src="' + JOYA(nv.i) + '" alt=""></button>' +
      '<div class="nv-txt"><b>' + NIVELES[nv.i].n + '</b><p>Tus mejores videos llegan ' + x + '.</p>' +
      (nv.i < 4 ? '<p class="nv-sube">Para ser <b>' + NIVELES[nv.i + 1].n + '</b>: ' + SUBIR_CORTO[nv.i].replace(' %', '&nbsp;%') + '.</p>' : '<p class="nv-sube">Estás en lo más alto.</p>') +
      '</div></div>' + joyas;
  }
  function abrirNivel(i) {
    const nv = nivel, x = NIVELES[i], tuyo = nv && i === nv.i;
    const v = document.createElement('div');
    v.className = 'tk-velo';
    /* (6-oct, Sergio) la cereza SIEMPRE a color y con su luz, también las que faltan: «para que la persona sepa hacia qué
       rango va y se emocione» */
    v.innerHTML = '<div class="tk-modal" data-joya="' + i + '" role="dialog" aria-modal="true" aria-labelledby="tk-m-n"><button type="button" class="tk-x" aria-label="Cerrar">×</button>' +
      '<div class="tk-m-cab"><span class="tk-m-joya"><img src="' + JOYA(i) + '" alt=""></span><div><small>Nivel ' + (i + 1) + ' de 5' + (tuyo ? ' · el tuyo' : nv && i === nv.i + 1 ? ' · tu próxima meta' : '') + '</small><h3 id="tk-m-n">' + x.n + '</h3></div></div>' +
      '<p class="tk-m-que">' + x.que + '</p>' +
      '<div class="tk-m-caja"><small>Cómo se llega</small><p>' + x.como + '</p></div>' +
      '<div class="tk-m-caja tu"><small>Tú</small><p>' + (!nv ? 'Todavía no hay videos medidos para saberlo.'
        : tuyo && i === 0 ? 'Estás en el nivel más bajo: <b>tu alcance todavía es poco</b> para el tamaño de tu cuenta. El del medio de tus tres mejores videos tuvo ' +
          '<b>' + mil(nv.medio) + ' vistas</b>, lo que equivale al <b>' + Math.round(nv.x * 100) + '&nbsp;%</b> de tus seguidores. Para subir tienes que llegar al 100&nbsp;%.'
        : tuyo ? 'Estás aquí. El del medio de tus tres mejores videos tuvo <b>' + mil(nv.medio) + ' vistas</b>, ' + coma(Math.round(nv.x * 10) / 10) + ' veces tus seguidores.'
        : i < nv.i ? 'Ya pasaste por aquí.' : 'Te faltan <b>' + (i - nv.i) + (i - nv.i === 1 ? ' nivel' : ' niveles') + '</b> para llegar aquí.') + '</p>' +
      (tuyo && i < 4 ? '<span class="tk-m-barra"><i style="width:' + Math.round(nv.avance * 100) + '%"></i></span>' : '') + '</div>' +
      '<div class="tk-m-caja"><small>' + (i === 4 ? 'Y ahora' : 'Para subir a ' + NIVELES[i + 1].n) + '</small><p>' + SUBIR[i] + '</p></div></div>';
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
       vis  = vistas por reel ÷ seguidores, % (Socialinsider 2025; la fila de 1M+ es nuestra)
       crec = seguidores nuevos al mes ÷ seguidores, % (Socialinsider 2025: crecimiento anual pasado a mes; 1M+ nuestra)
       int  = interacciones por reel ÷ seguidores, % (las fuentes van de 0,5 % en marcas a 3 % en creadores)
     Detalle y fuentes: docs/INICIO.md › «Tu cuenta como tu perfil de Instagram». */
  const NORMAL = [
    { s: 2236, vis: 20, crec: 2.7, int: 4 }, { s: 7071, vis: 10.2, crec: 2.5, int: 3 }, { s: 22361, vis: 8, crec: 2.46, int: 2 },
    { s: 70711, vis: 5, crec: 2.21, int: 1.5 }, { s: 316228, vis: 4, crec: 2, int: 1.2 }, { s: 3162278, vis: 3, crec: 1.5, int: 1 }];
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
    const vistas = media(rs.map((v) => n(v.visitas)).filter((x) => x != null)), inter = media(rs.map((v) => n(v.interacciones)).filter((x) => x != null));
    const yoC = seg && dias.length ? nuevos / seg * 100 * 30 / dias.length : null;
    const yoV = seg && vistas ? vistas / seg * 100 : null, yoI = seg && inter ? inter / seg * 100 : null;
    const nC = normalPara(seg, 'crec'), nV = normalPara(seg, 'vis'), nI = normalPara(seg, 'int');
    const contra = (yo, no, que) => yo == null ? '' : '<span class="ig-h-normal">Tú: <b>' + pct(yo) + '</b> ' + que + ' · lo normal para tu tamaño: <b>' + pct(no) + '</b></span>';
    const reglas = (no) => '<span class="ig-h-antes">Alto desde ' + pct(no * 1.5) + ' · bajo por debajo de ' + pct(no * 0.7) + '</span>';
    return [
      { k: 'crec', n: 'Crecimiento', v: (nuevos > 0 ? '+' : '') + igNum(nuevos), grande: (nuevos > 0 ? '+' : '') + igNum(nuevos), nivel: nivelVs(yoC, nC),
        chip: chipCrec, chipQue: 'los ' + mitad + ' días anteriores',
        que: 'seguidores nuevos en ' + dias.length + ' días' + (dias.length ? ', unos ' + Math.round(nuevos / dias.length) + ' por día' : ''),
        graf: () => histArea(dias), comp: contra(yoC, nC, 'de tus seguidores al mes') + reglas(nC) },
      { k: 'vis', n: 'Vistas', v: igNum(vistas || null), grande: igNum(vistas || null), nivel: nivelVs(yoV, nV),
        que: 'vistas en promedio por reel (tus últimos ' + rs.length + ')' + (share != null ? '; de los que te vieron, ' + corto(share) + ' no te seguían' : ''),
        graf: () => histDona(qa), comp: contra(yoV, nV, 'de tus seguidores por reel') + reglas(nV) },
      { k: 'int', n: 'Interacción', v: igNum(inter || null), grande: igNum(inter || null), nivel: nivelVs(yoI, nI), chip: vs(tasa, tasaB),
        que: 'me gusta, comentarios, guardados y compartidos en promedio por reel', graf: () => histCien(tasa, a.interactuaron),
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
    const ms = metricas(); if (!ms) return;
    const P = (ig && ig.perfil) || {};
    const v = document.createElement('div');
    v.className = 'ig-velo';
    v.innerHTML = '<div class="ig-hist" role="dialog" aria-modal="true" aria-label="Tus números como historias">' +
      '<div class="ig-h-barras">' + ms.map(() => '<i><u></u></i>').join('') + '</div>' +
      '<header class="ig-h-cab"><span class="ig-h-foto">' + (P.foto ? '<img src="' + esc(P.foto) + '" alt="">' : '') + '</span>' +
      '<b>' + esc(P.usuario || '') + '</b><span class="ig-h-cuando">últimos 28 días</span>' +
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
    caja.innerHTML = rs.slice(0, cuantos).map((v) => '<a class="ig-reel" href="' + esc(v.enlace || '#') + '" target="_blank" rel="noopener" title="' + esc(v.titulo || '') + '">' +
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
    nodoC.querySelectorAll('.ig-chips [data-tk-tab]').forEach((b) => { b.hidden = (TABS.find((t) => t.k === b.getAttribute('data-tk-tab')) || {}).g !== pest; });
    const enReels = pest === 'reels';
    nodoC.querySelector('.ig-chips').hidden = enReels;
    nodoC.querySelector('.ig-graf').hidden = enReels;
    nodoC.querySelector('.ig-reels').hidden = !enReels;
    if (enReels) pintaReels(); else pintaGrafica();
  }

  function pintaCuenta() {
    if (!nodoC) return;
    const caja = nodoC.querySelector('.tk');
    if (!ig || !ig.perfil) {
      if (caja.dataset.forma !== 'vacia') {
        caja.classList.remove('tk-perfil');
        caja.innerHTML = '<div class="tk-vacia"><img src="' + JOYA(3) + '" alt=""><h3>Conecta tu Instagram</h3>' +
          '<p>Para ver cómo va tu cuenta: a cuánta gente llegas, quién te descubre, tu nivel y lo que pasó con cada video. Todo sale de Instagram.</p>' +
          '<button type="button" class="ci-btn ci-btn--claro" data-tk-conectar>Conectar Instagram</button></div>';
        caja.dataset.forma = 'vacia'; ultimaGrafica = '';
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
        '</div>' +
        '<div class="ig-lado">' +
          '<nav class="ig-pests" role="tablist">' + PESTS.map((p) => '<button type="button" role="tab" data-ig-pest="' + p.k + '">' + ICONO[p.k] + '<span>' + p.n + '</span></button>').join('') + '</nav>' +
          '<div class="tk-tabs ig-chips">' + TABS.map((t) => '<button type="button" role="tab" data-tk-tab="' + t.k + '">' + t.n + '</button>').join('') + '</div>' +
          '<div class="ig-graf"><span class="tk-g-titulo"></span><div class="tk-g-lienzo"></div></div>' +
          '<div class="ig-reels" hidden></div>' +
        '</div>';
      caja.dataset.forma = 'llena'; ultimaGrafica = '';
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
    caja.querySelector('.ig-stats').innerHTML = [[P.publicaciones, 'publicaciones'], [P.seguidores, 'seguidores'], [P.seguidos, 'seguidos']]
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
    caja.querySelector('.ig-foto').classList.toggle('con', !!ms);
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
    if (t.closest('[data-tk-conectar]')) { const q = Q(); if (q && q.conectar) q.conectar(); }
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

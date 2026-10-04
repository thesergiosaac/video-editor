/* inicio-cuenta.js — la tarjeta «Tu cuenta» del inicio (rediseño del 4-oct-2026, maquetas aprobadas por Sergio:
 * https://claude.ai/artifact/7tPf4nfWB6QjghaGkcHokm y https://claude.ai/artifact/3V7ofGgeGv2ET4zTiqJNHT)
 *
 * ⭐ LO QUE DECIDIÓ SERGIO
 *   · La tarjeta NO cambia de tamaño: cambia lo de adentro. Ya no rota entera: SOLO rota el recuadro del video.
 *   · Fijo: el perfil, el NIVEL (Aprendiz → Creador → Experto → Maestro → Leyenda, con las cerezas joya; tocar una abre
 *     la ventana que lo explica), tres luces, tres números y una gráfica que se cambia con botones (cada una con la forma
 *     que mejor la dice).
 *   · «Viral» no se dice.
 *   · ⚠️ NADA ESCRITO A MANO. Todo sale de Instagram (CherryCuenta.instagram() y ig-metricas › modo «cuenta»). Sin cuenta
 *     conectada la tarjeta dice «Conecta tu Instagram» y no enseña nada más. Antes mezclaba lo del Laboratorio y, al
 *     desconectar Instagram, seguía enseñando el nombre y los números de antes.
 *   · Lo único que sale del Laboratorio es «Qué te funciona» (ganchos, ideas, formatos, estructuras): las piezas que el
 *     desmontaje le pone a cada video. Mientras no haya videos desmontados, esas gráficas dicen cómo conseguirlo.
 *
 * Tamaños: en pantalla ancha la manda la columna de la derecha (≈ 930 × 563; en un portátil ≈ 618 × 563, ahí la gráfica
 * no cabe y el video pasa abajo). En el celular crece hacia abajo y entra todo.
 *
 * El nodo sobrevive a los redibujos (C.render() rehace la app en cada tecla del buscador): se crea uno y se reutiliza.
 */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const LAB = (ir) => 'herramientas/laboratorio.html' + (ir ? '?ir=' + ir : '');
  const VUELTA = 6000;

  let nodo = null;
  let ig = null;            // { marca, perfil, videos } de CherryCuenta
  let cuenta = null;        // ig-metricas › cuenta: { conectada, actual, anterior, seguidoresDia }
  let pedidaCuenta = '';    // la marca para la que ya se pidió
  let lab = null;           // el documento del Laboratorio (solo para «Qué te funciona»)
  let tab = 'seg', jv = 0, reloj = 0, quieto = false;
  try { tab = localStorage.getItem('cherry-cuenta-grafica') || 'seg'; } catch (e) { /* sin almacenamiento */ }

  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const Q = () => window.CherryCuenta;
  const n = (x) => (x == null || x === '' || !isFinite(Number(x))) ? null : Number(x);
  const media = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  function mil(v) {
    v = n(v); if (v == null) return '—';
    if (v >= 1e6) return (Math.round(v / 1e5) / 10).toString().replace('.', ',') + ' mill.';
    if (v >= 1e4) return Math.round(v / 1e3) + ' mil';
    return Math.round(v).toLocaleString('es-CO');
  }
  const veces = (a, b) => (n(a) && n(b)) ? '×' + (Math.round(a / b * 10) / 10).toString().replace('.', ',') : '';

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
  const JOYA = (i) => 'assets/marca/niveles/n' + (i + 1) + '.webp?v=20261004';

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

  /* ── Las gráficas (SVG al tamaño real del recuadro: nada se estira) ── */
  const ROSA = '#FF2D8A', VERDE = '#11806F', AMBAR = '#E8A800', TINTA = 'var(--tinta)', GRIS = 'color-mix(in srgb,var(--tinta) 12%,transparent)', T3 = 'var(--tinta-3)';
  function txt(x, y, t, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + (o.f || 'DM Mono, monospace') + '" font-size="' + (o.s || 10) + '" fill="' + (o.c || T3) + '"' +
      (o.a ? ' text-anchor="' + o.a + '"' : '') + (o.w ? ' font-weight="' + o.w + '"' : '') + '>' + esc(t) + '</text>';
  }
  function area(d, W, H) {
    const ac = []; let s = 0; d.forEach((x) => { s += x; ac.push(s); });
    const mx = Math.max(1, ac[ac.length - 1]);
    const px = (i) => 8 + i * (W - 70) / Math.max(1, d.length - 1), py = (v) => H - 18 - v / mx * (H - 40);
    const pts = ac.map((v, i) => px(i).toFixed(1) + ',' + py(v).toFixed(1));
    return '<defs><linearGradient id="tkA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ROSA + '" stop-opacity=".35"/><stop offset="1" stop-color="' + ROSA + '" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="8,' + (H - 18) + ' ' + pts.join(' ') + ' ' + px(d.length - 1) + ',' + (H - 18) + '" fill="url(#tkA)"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + ROSA + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="' + px(d.length - 1) + '" cy="' + py(mx) + '" r="5" fill="' + ROSA + '"/>' +
      txt(px(d.length - 1) + 10, py(mx) + 4, '+' + mx, { s: 13, c: TINTA, w: 700 }) + txt(8, H - 4, 'hace ' + d.length + ' días') + txt(px(d.length - 1), H - 4, 'hoy', { a: 'end' });
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
  function rankingVertical(filas, W, H) {
    const mx = Math.max.apply(null, filas.map((f) => f.v)) * 1.15, bw = (W - 10) / filas.length, base = H - 40;
    const py = (v) => base - v / mx * (base - 8);
    return filas.map((f, i) => { const x = 5 + i * bw + 6, w = Math.max(10, bw - 12), y = py(f.v), mejor = i === 0;
      const pal = String(f.nombre).split(' '); let l1 = '', l2 = '';
      pal.forEach((p) => { if (!l1 || ((l1 + ' ' + p).length <= 13 && !l2)) l1 = (l1 + ' ' + p).trim(); else l2 = (l2 + ' ' + p).trim(); });
      if (l2.length > 14) l2 = l2.slice(0, 13) + '…';
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (base - y) + '" rx="6" fill="' + (mejor ? ROSA : 'rgba(255,45,138,.38)') + '"/>' +
        txt(x + w / 2, y - 6, (mejor ? '★ ' : '') + f.etq, { a: 'middle', c: TINTA, w: 700, s: 11 }) +
        txt(x + w / 2, base + 13, l1, { a: 'middle', c: TINTA, s: 10.5, f: 'Space Grotesk, sans-serif' }) + (l2 ? txt(x + w / 2, base + 24, l2, { a: 'middle', c: TINTA, s: 10.5, f: 'Space Grotesk, sans-serif' }) : '') +
        txt(x + w / 2, base + 36, f.k + (f.k === 1 ? ' video' : ' videos'), { a: 'middle', s: 8.5 }); }).join('');
  }
  function rankingHorizontal(filas, W, H) {
    const mx = Math.max.apply(null, filas.map((f) => f.v)), alto = (H - 12) / filas.length, bar = W - 300;
    return filas.map((f, i) => { const y = 6 + i * alto, w = bar * f.v / mx, mejor = i === 0, hb = Math.min(26, alto - 10);
      return txt(0, y + alto / 2 + 4, (mejor ? '★ ' : '') + String(f.nombre).slice(0, 22), { s: 12, c: TINTA, w: mejor ? 700 : 500 }) +
        '<rect x="170" y="' + (y + (alto - hb) / 2) + '" width="' + bar + '" height="' + hb + '" rx="' + hb / 2 + '" fill="' + GRIS + '"/>' +
        '<rect x="170" y="' + (y + (alto - hb) / 2) + '" width="' + w + '" height="' + hb + '" rx="' + hb / 2 + '" fill="' + (mejor ? ROSA : 'rgba(255,45,138,.38)') + '"/>' +
        txt(178 + bar, y + alto / 2 + 4, f.etq, { s: 12, c: TINTA, w: 700 }) + txt(W, y + alto / 2 + 4, f.k + (f.k === 1 ? ' video' : ' videos'), { a: 'end', s: 9.5 }); }).join('');
  }

  /* «Qué te funciona»: las piezas del desmontaje, juzgadas por lo que les toca (el gancho por el inicio, la idea por las
     vistas, el formato y la estructura por el tiempo visto). Solo videos de esta marca con números de Instagram. */
  function piezas(tipo) {
    const q = Q(); if (!lab || !q || !q.igEnDoc || !ig) return [];
    const D = q.igEnDoc(lab), P = (lab.piezas && lab.piezas[tipo]) || [];
    const porId = {}; P.forEach((p) => { porId[p.id] = p; });
    const medir = { gancho: inicioDe, idea: (v) => n(v.visitas), formato: (v) => n(v.vistoMedio) != null ? n(v.vistoMedio) : n(v.retencion), estructura: (v) => n(v.vistoMedio) != null ? n(v.vistoMedio) : n(v.retencion) }[tipo];
    const grupos = {};
    (D.videos || []).forEach((v) => {
      if (!v || v.cuenta !== ig.marca || !v.piezas || !v.piezas[tipo]) return;
      const val = medir(v); if (val == null) return;
      const p = porId[v.piezas[tipo]]; if (!p) return;
      const k = p.texto || p.angulo || 'Sin nombre';
      (grupos[k] = grupos[k] || []).push(val);
    });
    return Object.keys(grupos).map((k) => ({ nombre: k, v: media(grupos[k]), k: grupos[k].length }))
      .sort((a, b) => b.v - a.v).slice(0, 7);
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
      const d = ((cuenta && cuenta.seguidoresDia) || []).map((x) => x.nuevos);
      if (d.length && d[d.length - 1] === 0) d.pop();      // el día de hoy todavía no termina
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
      return { t: 'Segundos que se quedó la gente en cada video', svg: columnasValor(d, nombres, AMBAR, (x) => Math.round(x) + ' s', (m) => 'lo normal: ' + (Math.round(m * 10) / 10).toString().replace('.', ',') + ' s', W, H) }; }
    const tipo = { ganchos: 'gancho', ideas: 'idea', formatos: 'formato', estructuras: 'estructura' }[k];
    const filas = piezas(tipo);
    if (filas.length < 2) return vacio('Cuando Cherry desmonte tus reels en el Laboratorio, aquí ves qué ' + { ganchos: 'ganchos', ideas: 'ideas', formatos: 'formatos', estructuras: 'estructuras de guion' }[k] + ' te funcionan.');
    const fmt = { ganchos: (f) => Math.round(f.v) + '', ideas: (f) => mil(f.v), formatos: (f) => Math.round(f.v) + ' s', estructuras: (f) => Math.round(f.v) + ' s' }[k];
    filas.forEach((f) => { f.etq = fmt(f); });
    const t = { ganchos: 'Tipos de gancho: cuántos de 100 pasan el inicio', ideas: 'Ideas: vistas promedio', formatos: 'Formatos: segundos que se queda la gente', estructuras: 'Estructuras de guion: segundos vistos' }[k];
    return { t: t, svg: (k === 'ganchos' || k === 'ideas') ? rankingVertical(filas, W, H) : rankingHorizontal(filas, W, H) };
  }
  function pintaGrafica() {
    if (!nodo) return;
    const caja = nodo.querySelector('.tk-g-lienzo'); if (!caja) return;
    const W = Math.max(200, Math.round(caja.clientWidth)), H = Math.max(90, Math.round(caja.clientHeight));
    const g = grafica(tab, W, H);
    nodo.querySelector('.tk-g-titulo').textContent = g.t || '';
    caja.innerHTML = g.vacio
      ? '<p class="tk-g-vacio">' + esc(g.vacio) + (/Laboratorio/.test(g.vacio) ? ' <a href="' + LAB('') + '">Ir al Laboratorio ›</a>' : '') + '</p>'
      : '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(g.t) + '">' + g.svg + '</svg>';
    nodo.querySelectorAll('[data-tk-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-tk-tab') === tab)));
  }

  /* ── El recuadro del video (lo único que rota) ── */
  function video(v, rs) {
    const vistas = rs.map((x) => n(x.visitas)), mv = media(vistas.filter((x) => x != null));
    const ini = rs.map(inicioDe).filter((x) => x != null), mi = media(ini);
    const tie = rs.map(tiempoDe).filter((x) => x != null), mt = media(tie);
    const ints = rs.map(interDe).filter((x) => x != null), mint = media(ints);
    const yo = { v: n(v.visitas), i: inicioDe(v), t: tiempoDe(v), x: interDe(v) };
    const nuevo = edadH(v) < 48;
    let sello = 'Como siempre', clase = '';
    if (nuevo) sello = 'Se está midiendo';
    else if (yo.i != null && yo.i === Math.max.apply(null, ini)) { sello = '★ Tu mejor gancho'; clase = 'si'; }
    else if (yo.v != null && yo.v === Math.max.apply(null, vistas)) { sello = '★ El más visto'; clase = 'si'; }
    else if (yo.t != null && yo.t === Math.max.apply(null, tie)) { sello = '★ El que más retuvo'; clase = 'si'; }
    else if (yo.x != null && yo.x === Math.max.apply(null, ints)) { sello = '★ El que más interacción tuvo'; clase = 'si'; }
    else if (yo.v != null && yo.v >= mv * 1.2) { sello = 'Por encima de lo normal'; clase = 'si'; }
    else if (yo.v != null && yo.v <= mv * 0.8) { sello = 'Por debajo de lo normal'; clase = 'baja'; }
    const barra = (et, nota, a, b, val) => '<div class="tk-vc"><span class="tk-vc-n">' + et + '<em' + (a > b * 1.05 ? ' class="sube"' : '') + '>' + nota + '</em></span>' +
      '<span class="tk-vc-b"><i style="width:' + Math.round(100 * a / Math.max(a, b, 1)) + '%"></i><u style="width:' + Math.round(100 * b / Math.max(a, b, 1)) + '%"></u></span><b>' + val + '</b></div>';
    const comp = (a, b) => (a == null || !b) ? '' : a >= b * 1.05 ? (Math.round(a / b * 10) / 10).toString().replace('.', ',') + '× lo normal' : a <= b * 0.95 ? 'menos que lo normal' : 'como siempre';
    let puntos = ''; if (yo.x != null) { const k = Math.round(yo.x); for (let i = 0; i < 100; i++) puntos += '<i' + (i < k ? ' class="si"' : '') + '></i>'; }
    const aro = yo.i == null ? '' : '<div class="tk-aro"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="color-mix(in srgb,var(--tinta) 9%,transparent)" stroke-width="9"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="' + VERDE + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (163.4 * yo.i / 100).toFixed(1) + ' 163.4" transform="rotate(-90 32 32)"/></svg>' +
      '<div><b>' + yo.i + ' de 100</b><small>pasaron el inicio' + (mi ? '<br>tú sueles: ' + Math.round(mi) : '') + '</small></div></div>';
    const tapa = v.tapa ? '<img src="' + esc(v.tapa) + '" alt="" loading="lazy">' : '';
    const cuando = v.creado ? (window.CherryResumen && window.CherryResumen.hace ? window.CherryResumen.hace(v.creado) : '') : '';
    return '<div class="tk-v-arriba"><a class="tk-mini" href="' + esc(v.enlace || '#') + '" target="_blank" rel="noopener" aria-label="Ver el video en Instagram">' + tapa +
      (n(v.dur) ? '<span class="tk-dur">' + Math.floor(n(v.dur) / 60) + ':' + String(Math.round(n(v.dur) % 60)).padStart(2, '0') + '</span>' : '') + '</a>' +
      '<div class="tk-v-der"><span class="tk-v-n">Tu video<span>' + esc(cuando) + '</span></span><h4>' + esc(v.titulo || 'Sin texto') + '</h4>' +
      '<span class="tk-sello ' + clase + '">' + sello + '</span>' + aro + '</div></div>' +
      '<div class="tk-v-comp">' +
      (yo.v != null ? barra('Vistas', comp(yo.v, mv), yo.v, mv, mil(yo.v)) : '') +
      (yo.t != null ? barra('Tiempo visto', comp(yo.t, mt), yo.t, mt, Math.round(yo.t) + ' s') : '') +
      (yo.x != null ? '<div class="tk-vc"><span class="tk-vc-n">Interacción<em' + (yo.x > mint * 1.05 ? ' class="sube"' : '') + '>' + comp(yo.x, mint) + '</em></span><span class="tk-puntos" aria-hidden="true">' + puntos + '</span><b>' + Math.round(yo.x) + '/100</b></div>' : '') +
      '</div>';
  }
  function pintaVideo() {
    if (!nodo) return;
    const caja = nodo.querySelector('.tk-video-cuerpo'), pts = nodo.querySelector('.tk-v-puntos');
    if (!caja) return;
    const rs = reels(), lista = rs.slice().reverse().slice(0, 6);   // los más recientes primero
    if (!lista.length) { caja.innerHTML = '<p class="tk-g-vacio">Cuando publiques un reel, aquí ves lo que pasó con él.</p>'; pts.innerHTML = ''; return; }
    if (jv >= lista.length) jv = 0;
    caja.innerHTML = video(lista[jv], rs);
    pts.innerHTML = lista.map((_, i) => '<button type="button" data-tk-v="' + i + '" aria-label="Video ' + (i + 1) + '"' + (i === jv ? ' aria-current="true"' : '') + '></button>').join('');
  }
  function arranca() {
    clearInterval(reloj);
    reloj = setInterval(() => { if (quieto) return; jv++; pintaVideo(); }, VUELTA);
  }

  /* ── El nivel: la línea de estaciones con las cerezas joya ── */
  function franjaNivel(nv) {
    if (!nv) return '<div class="tk-nivel"><span class="tk-g-vacio">Tu nivel aparece cuando tengas videos medidos.</span></div>';
    const est = NIVELES.map((x, i) => '<button type="button" class="tk-est ' + (i <= nv.i ? 'si' : 'no') + (i === nv.i ? ' yo' : '') + '" data-tk-nivel="' + i + '" aria-label="' + x.n + ': qué significa">' +
      (i === nv.i ? '<span class="tk-aqui">estás aquí</span>' : '') + '<img src="' + JOYA(i) + '" alt=""><b>' + x.n + '</b></button>').join('');
    return '<div class="tk-nivel"><div class="tk-nivel-tit"><small>Tu nivel</small><b>' + NIVELES[nv.i].n + '</b></div>' +
      '<div class="tk-ruta" style="--avance:' + Math.round((Math.min(4, nv.i + Math.min(1, nv.avance)) / 4) * 80) + '%">' + est + '</div>' +
      '<button type="button" class="tk-nivel-chico" data-tk-nivel="' + nv.i + '"><img src="' + JOYA(nv.i) + '" alt=""><span><small>Tu nivel</small><b>' + NIVELES[nv.i].n + ' ›</b></span></button></div>';
  }
  function abrirNivel(i, nv) {
    const x = NIVELES[i], tuyo = nv && i === nv.i;
    const v = document.createElement('div');
    v.className = 'tk-velo';
    v.innerHTML = '<div class="tk-modal" role="dialog" aria-modal="true" aria-labelledby="tk-m-n"><button type="button" class="tk-x" aria-label="Cerrar">×</button>' +
      '<div class="tk-m-cab"><img src="' + JOYA(i) + '" alt=""' + (nv && i > nv.i ? ' class="no"' : '') + '><div><small>Nivel ' + (i + 1) + ' de 5' + (tuyo ? ' · el tuyo' : '') + '</small><h3 id="tk-m-n">' + x.n + '</h3></div></div>' +
      '<p class="tk-m-que">' + x.que + '</p>' +
      '<div class="tk-m-caja"><small>Cómo se llega</small><p>' + x.como + '</p></div>' +
      '<div class="tk-m-caja tu"><small>Tú</small><p>' + (!nv ? 'Todavía no hay videos medidos para saberlo.'
        : tuyo && i === 0 ? 'Estás en el nivel más bajo: <b>tu alcance todavía es poco</b> para el tamaño de tu cuenta. El del medio de tus tres mejores videos tuvo ' +
          '<b>' + mil(nv.medio) + ' vistas</b>, lo que equivale al <b>' + Math.round(nv.x * 100) + ' %</b> de tus seguidores. Para subir tienes que llegar al 100 %.'
        : tuyo ? 'Estás aquí. El del medio de tus tres mejores videos tuvo <b>' + mil(nv.medio) + ' vistas</b>, ' + (Math.round(nv.x * 10) / 10).toString().replace('.', ',') + ' veces tus seguidores.'
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

  /* ── La tarjeta entera ── */
  function luces() {
    const a = cuenta && cuenta.actual, b = cuenta && cuenta.anterior;
    if (!a) return ['Crecimiento', 'Te descubren', 'Conexión'].map((t) => '<div class="tk-luz"><span class="tk-luz-n"><i class="gris"></i>' + t + '</span><b>…</b><span>trayendo de Instagram</span></div>').join('');
    const dias = ((cuenta.seguidoresDia) || []).map((x) => x.nuevos);
    if (dias.length && dias[dias.length - 1] === 0) dias.pop();
    const nuevos = dias.reduce((s, x) => s + x, 0);
    const qa = a.quienes, qb = b && b.quienes;
    const share = qa && (qa.no_seguidores + qa.seguidores) ? qa.no_seguidores / (qa.no_seguidores + qa.seguidores) : null;
    const shareB = qb && (qb.no_seguidores + qb.seguidores) ? qb.no_seguidores / (qb.no_seguidores + qb.seguidores) : null;
    const tasa = (a.alcance && a.interactuaron != null) ? a.interactuaron / a.alcance : null;
    const tasaB = (b && b.alcance && b.interactuaron != null) ? b.interactuaron / b.alcance : null;
    const cambio = (x, y) => (x == null || y == null) ? '' : x > y * 1.1 ? 'mejor que el mes pasado' : x < y * 0.9 ? 'menos que el mes pasado' : 'igual que el mes pasado';
    const color = (x, y) => (x == null || y == null) ? 'gris' : x > y * 1.1 ? '' : 'amb';
    const deCada = (r) => r == null ? '—' : r >= 0.5 ? Math.round(r * 10) + ' de cada 10' : '1 de cada ' + Math.max(2, Math.round(1 / r));
    return '<div class="tk-luz"><span class="tk-luz-n"><i class="' + (nuevos > 0 ? '' : 'amb') + '"></i>Crecimiento</span><b>' + mil(nuevos) + ' nuevos</b><span>' + (dias.length ? 'unos ' + Math.round(nuevos / dias.length) + ' por día' : '') + '</span></div>' +
      '<div class="tk-luz"><span class="tk-luz-n"><i class="' + color(share, shareB) + '"></i>Te descubren</span><b>' + deCada(share) + '</b><span>no te seguían' + (cambio(share, shareB) ? ' · ' + cambio(share, shareB).replace(' que el mes pasado', '') : '') + '</span></div>' +
      '<div class="tk-luz"><span class="tk-luz-n"><i class="' + color(tasa, tasaB) + '"></i>Conexión</span><b>' + deCada(tasa) + '</b><span>interactúa' + (cambio(tasa, tasaB) ? ' · ' + cambio(tasa, tasaB).replace(' que el mes pasado', '') : '') + '</span></div>';
  }
  function cifras() {
    const a = cuenta && cuenta.actual, b = cuenta && cuenta.anterior;
    if (!a) return '';
    const dias = ((cuenta.seguidoresDia) || []).map((x) => x.nuevos), nuevos = dias.reduce((s, x) => s + x, 0);
    const gc = (a.guardados || 0) + (a.compartidos || 0), gcB = b ? (b.guardados || 0) + (b.compartidos || 0) : null;
    const conv = (nuevos && a.perfil) ? '1 de ' + Math.max(1, Math.round(a.perfil / nuevos)) : '—';
    const x = (v, w) => veces(v, w) ? '<em>' + veces(v, w) + '</em>' : '';
    return '<div class="tk-cifra"><b>' + mil(a.alcance) + x(a.alcance, b && b.alcance) + '</b><small>personas te vieron</small></div>' +
      '<div class="tk-cifra"><b>' + conv + '</b><small>de los que entran a tu perfil te siguen</small></div>' +
      '<div class="tk-cifra"><b>' + mil(gc) + x(gc, gcB) + '</b><small>guardados y compartidos</small></div>';
  }
  let ultimaForma = '';
  function pinta() {
    if (!nodo) return;
    const caja = nodo.querySelector('.tk');
    if (!ig || !ig.perfil) {
      const forma = 'vacia';
      if (ultimaForma !== forma) {
        caja.innerHTML = '<div class="tk-vacia"><img src="' + JOYA(3) + '" alt=""><h3>Conecta tu Instagram</h3>' +
          '<p>Para ver cómo va tu cuenta: a cuánta gente llegas, quién te descubre, tu nivel y lo que pasó con cada video. Todo sale de Instagram.</p>' +
          '<button type="button" class="ci-btn ci-btn--claro" data-tk-conectar>Conectar Instagram</button></div>';
        ultimaForma = forma;
      }
      return;
    }
    const P = ig.perfil, nv = nivelDe(P.seguidores, reels());
    const forma = 'llena';
    if (ultimaForma !== forma) {
      caja.innerHTML =
        '<header class="tk-cab"><span class="tk-foto"></span><div class="tk-quien"><b></b><span></span></div><div class="tk-nivel-hueco"></div></header>' +
        '<div class="tk-cuerpo"><div class="tk-izq"><div class="tk-luces"></div><div class="tk-cifras"></div>' +
        '<div class="tk-grafica"><div class="tk-tabs" role="tablist" aria-label="Qué gráfica ver"><span class="tk-grupo">Tus números</span>' +
        TABS.filter((t) => t.g === 'num').map((t) => '<button type="button" role="tab" data-tk-tab="' + t.k + '">' + t.n + '</button>').join('') +
        '<i class="tk-salto"></i><span class="tk-grupo">Qué te funciona</span>' +
        TABS.filter((t) => t.g === 'fun').map((t) => '<button type="button" role="tab" data-tk-tab="' + t.k + '">' + t.n + '</button>').join('') +
        '</div><span class="tk-g-titulo"></span><div class="tk-g-lienzo"></div></div></div>' +
        '<div class="tk-video"><div class="tk-video-cuerpo"></div><div class="tk-v-puntos"></div></div></div>' +
        '<footer class="tk-pie"><a class="ci-btn ci-btn--claro" href="' + LAB('v7') + '">Planear el próximo →</a><a class="ci-btn ci-btn--linea" href="' + LAB('v5') + '">Mis videos</a>' +
        '<span class="tk-ley"><i></i>este video <u></u>lo normal en tus videos</span></footer>';
      ultimaForma = forma;
    }
    const inicial = '<b>' + esc(String(P.usuario || '?').charAt(0).toUpperCase()) + '</b>';
    const fotoEl = caja.querySelector('.tk-foto');
    if (fotoEl.dataset.src !== (P.foto || '')) {
      fotoEl.dataset.src = P.foto || '';
      fotoEl.innerHTML = P.foto ? '<img src="' + esc(P.foto) + '" alt="">' : inicial;
      /* la dirección de la foto de Instagram vence a los pocos días: si ya no carga, la inicial */
      const im = fotoEl.querySelector('img'); if (im) im.onerror = () => { fotoEl.innerHTML = inicial; };
    }
    caja.querySelector('.tk-quien b').textContent = P.usuario || '';
    caja.querySelector('.tk-quien span').innerHTML = [[P.seguidores, 'seguidores'], [P.publicaciones, 'publicaciones'], [P.seguidos, 'seguidos']]
      .filter((x) => x[0] != null).map((x) => '<b>' + mil(x[0]) + '</b> ' + x[1]).join(' · ');
    caja.querySelector('.tk-nivel-hueco').innerHTML = franjaNivel(nv);
    caja.querySelector('.tk-luces').innerHTML = luces();
    caja.querySelector('.tk-cifras').innerHTML = cifras();
    pintaGrafica();
    pintaVideo();
    nodo._nivel = nv;
  }

  C.tarjetaCuenta = function () {
    if (!nodo) {
      nodo = C.h('section', { class: 'ci-t ci-vol ci-perfil tk-tarjeta', 'aria-label': 'Tu cuenta' },
        C.h('span', { class: 'ci-flecha', 'aria-hidden': 'true', title: 'Abrir el Laboratorio' }, '→'),
        C.h('div', { class: 'tk' }));
      nodo.addEventListener('click', (e) => {
        const t = e.target;
        if (t.closest('.ci-flecha')) { location.href = LAB(''); return; }
        const tb = t.closest('[data-tk-tab]');
        if (tb) { tab = tb.getAttribute('data-tk-tab'); try { localStorage.setItem('cherry-cuenta-grafica', tab); } catch (er) { /* nada */ } pintaGrafica(); return; }
        const tv = t.closest('[data-tk-v]');
        if (tv) { jv = +tv.getAttribute('data-tk-v'); pintaVideo(); arranca(); return; }
        const tn = t.closest('[data-tk-nivel]');
        if (tn) { abrirNivel(+tn.getAttribute('data-tk-nivel'), nodo._nivel); return; }
        if (t.closest('[data-tk-conectar]')) { const q = Q(); if (q && q.conectar) q.conectar(); }
      });
      /* Con el ratón encima, el video no se va solo: nadie lee un dato que se mueve. */
      nodo.addEventListener('mouseenter', () => { quieto = true; });
      nodo.addEventListener('mouseleave', () => { quieto = false; });
      if (window.ResizeObserver) new ResizeObserver(() => pintaGrafica()).observe(nodo);
      const q = Q();
      if (q && q.cuandoLlegueInstagram) q.cuandoLlegueInstagram(refresca);
      pedirLab();
      refresca();
      arranca();
    }
    return nodo;
  };

  (C.onApiReady = C.onApiReady || []).push(() => { pedidaCuenta = ''; pedirLab(); refresca(); });
})();

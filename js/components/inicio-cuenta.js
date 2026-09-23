/* inicio-cuenta.js — la tarjeta «Tu cuenta» del bento (22-sep-2026, maqueta aprobada por Sergio)
 *
 * Arriba, la réplica del perfil de Instagram: foto, usuario, publicaciones/seguidores/seguidos y
 * la biografía. Debajo, lo que Cherry sabe: el camino a la viralidad, los videos publicados, las
 * visitas, las interacciones, la retención y la gráfica del avance.
 *
 * Y rota: resumen → video → video → resumen… Un solo botón, abajo a la derecha, devuelve al
 * resumen y lo deja fijo (y desde el resumen vuelve a soltarla). No hay iconos de navegación: esos
 * son de la tarjeta de abajo.
 *
 * De dónde salen los números: js/resumen-cuenta.js, que lee el documento del Laboratorio. Aquí NO
 * se calcula nada; aquí solo se pinta. Lo que no está medido sale como guion, nunca como cero.
 *
 * ⚠️ Las clases de aquí empiezan por `cp-` y la tarjeta es `.ci-perfil`. NO usar `.ci-cuenta`:
 * ese nombre ya es del contenedor del avatar en la barra de arriba, y reutilizarlo le aplica el
 * grid-column y el min-height de la tarjeta — la barra se estira y no avisa nadie.
 *
 * El nodo sobrevive a los redibujos: C.render() reconstruye la app entera y un nodo nuevo cada vez
 * reiniciaría la rotación en cada tecla del buscador. Se crea uno y se reutiliza (como C.imgFija).
 */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const HERR = 'laboratorio';
  const VUELTA = 6000;               // lo que dura cada cara
  const LAB = (ir) => 'herramientas/' + HERR + '.html' + (ir ? '?ir=' + ir : '');

  let nodo = null;                   // la tarjeta, una sola para toda la vida de la página
  let R = null;                      // el último resumen calculado
  let sec = [];                      // las caras: 'resumen' o un video
  let j = 0, reloj = 0, fijo = false, pedido = false;

  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const M = () => window.CherryResumen;

  /* ── Los datos ──
     Primero la copia que el Laboratorio dejó en este navegador (se pinta al instante, sin esperar
     a nadie); después la de la cuenta, por si editó desde otro equipo. */
  function copiaLocal() {
    const uid = C.session && C.session.user && C.session.user.id;
    if (!uid) return null;
    try { return JSON.parse(localStorage.getItem('cherry-herr-' + HERR + '-' + uid) || 'null'); }
    catch (e) { return null; }
  }
  function cargar() {
    if (!M()) return;
    const local = copiaLocal();
    if (local) aplica(M().resumen(local));
    if (pedido || !C.api || !C.api.getDatosHerramienta) return;
    pedido = true;
    C.api.getDatosHerramienta(HERR).then((d) => { if (d) aplica(M().resumen(d)); })
      .catch(() => {});           // sin conexión se queda con la copia local, que es lo correcto
  }

  function aplica(nuevo) {
    const antes = R ? JSON.stringify(R) : '';
    R = nuevo;
    if (JSON.stringify(R) === antes) return;
    sec = caras();
    if (j >= sec.length) j = 0;
    pinta();
    arranca();
  }
  function caras() {
    const out = [{ tipo: 'resumen' }];
    if (!R) return out;
    R.videos.forEach((v, k) => {
      out.push({ tipo: 'video', v: v });
      if (k % 2 === 1 && k < R.videos.length - 1) out.push({ tipo: 'resumen' });
    });
    return out;
  }

  /* ── El aro: el camino a la viralidad ── */
  function aro(a) {
    const CIR = 389.6, HUECO = 9, SECTOR = CIR / 4, ARCO = SECTOR - HUECO;
    let svg = '', centro, color, pie;
    if (!a || a.modo === 'peldanos') {
      const n = (a && a.n) || 0;
      for (let i = 0; i < 4; i++) {
        svg += '<circle cx="75" cy="75" r="62" fill="none" stroke="' +
          (i < n ? 'var(--ambar)' : 'var(--aro-vacio)') + '" stroke-width="19" stroke-linecap="round" ' +
          'stroke-dasharray="' + ARCO.toFixed(1) + ' ' + (CIR - ARCO).toFixed(1) + '" ' +
          'stroke-dashoffset="' + (-(i * SECTOR)).toFixed(1) + '"' +
          (i < n ? ' class="lleno"' : '') + '/>';
      }
      centro = n + '<em>/4</em>';
      color = n ? 'var(--ambar)' : 'var(--tinta-3)';
      pie = 'peldaños<br>a viral';
    } else {
      const largo = CIR * (a.pct / 100);
      svg = '<circle cx="75" cy="75" r="62" fill="none" stroke="var(--aro-vacio)" stroke-width="19"/>' +
        '<circle cx="75" cy="75" r="62" fill="none" stroke="url(#ciAro)" stroke-width="19" ' +
        'stroke-linecap="round" class="lleno" stroke-dasharray="' + largo.toFixed(1) + ' ' +
        (CIR - largo).toFixed(1) + '"/>' +
        '<defs><linearGradient id="ciAro" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#FFC93C"/><stop offset="100%" stop-color="#FF2D8A"/>' +
        '</linearGradient></defs>';
      centro = a.pct + '<em>%</em>';
      color = 'var(--rosa)';
      pie = 'del camino<br>a viral';
    }
    return '<div class="cp-aro"><svg width="84" height="84" viewBox="0 0 150 150" aria-hidden="true">' +
      svg + '</svg><div class="cp-aro__d"><span class="pct" style="color:' + color + '">' + centro +
      '</span><span class="cual">' + pie + '</span></div></div>';
  }

  /* Una tendencia muy grande deja de leerse como porcentaje: a partir de ×10 se dice en veces. */
  function flecha(pct) {
    if (pct == null || !isFinite(pct)) return '';
    if (pct >= 900) return '<i>×' + (Math.round((pct / 100 + 1) * 10) / 10).toString().replace('.', ',') + '</i>';
    if (pct === 0) return '';
    const sube = pct > 0;
    return '<i class="' + (sube ? 'sube' : 'baja') + '">' + (sube ? '↑' : '↓') + Math.abs(pct) + '%</i>';
  }

  function caraResumen() {
    const P = R.perfil, mil = M().mil;
    const nums = [];
    if (P.publicaciones != null) nums.push(['<b>' + mil(P.publicaciones) + '</b>', 'publicaciones']);
    if (P.seguidores != null) nums.push(['<b>' + mil(P.seguidores) + '</b>', 'seguidores']);
    if (P.seguidos != null) nums.push(['<b>' + mil(P.seguidos) + '</b>', 'seguidos']);

    const cifras = [
      ['<b>' + (R.n || '—') + '</b>', R.n === 1 ? 'video' : 'videos', ''],
      ['<b>' + mil(R.visitas) + '</b>', 'visitas', R.tendencia ? flecha(R.tendencia.visitas) : ''],
      ['<b>' + mil(R.interacciones) + '</b>', 'interacciones', R.tendencia ? flecha(R.tendencia.interacciones) : ''],
      ['<b class="amb">' + (R.retMedia == null ? '—' : R.retMedia + '%') + '</b>', 'retención',
        R.retMejor != null && R.retMejor !== R.retMedia ? '<i>mejor ' + R.retMejor + '%</i>' : ''],
    ];

    /* Debajo del aro: o la gráfica del avance, o por qué todavía no la hay. */
    let abajo;
    if (R.barras.length > 1) {
      abajo = '<div class="cp-avance"><div class="cp-barras" aria-hidden="true">' +
        R.barras.map((h, k) => '<i class="' + (k === R.barras.length - 1 ? 'ult' : '') +
          '" style="height:' + h + '%"></i>').join('') + '</div>' +
        (R.veces != null && R.veces >= 1.1
          ? '<div class="cp-ley"><b>↑ ' + String(R.veces).replace('.', ',') + '×</b>' +
            '<span>más que el primero</span></div>'
          : R.veces != null && R.veces < 0.9
            ? '<div class="cp-ley baja"><b>↓ ' + Math.round((1 - R.veces) * 100) + '%</b>' +
              '<span>menos que el primero</span></div>'
            : '<div class="cp-ley plana"><b>=</b><span>parecido al primero</span></div>') +
        '</div>';
    } else if (R.n === 0) {
      abajo = '<p class="cp-sub">Desmonta un video para empezar a medir tu marca.</p>';
    } else {
      abajo = '<p class="cp-sub">Con un video no hay con qué comparar todavía.</p>';
    }

    /* Qué significa el aro va ARRIBA, a la derecha de «Con Cherry»: en una línea suelta debajo
       empujaba los botones fuera de la tarjeta, y el sitio de arriba lo ocupaba el desde-cuándo,
       que es lo que menos falta hace. */
    const dato = R.aro.modo === 'camino' && R.aro.faltan > 0
      ? 'faltan ' + R.aro.faltan + ' pts'
      : R.aro.modo === 'camino' ? 'ya pasaste el ' + R.aro.corte + '%'
      : R.desde ? 'desde ' + R.desde : '';

    const botones = R.n === 0
      ? '<a class="ci-btn ci-btn--claro" href="' + LAB('v3') + '">Desmontar un video →</a>' +
        '<a class="ci-btn ci-btn--linea" href="' + LAB('v5') + '">Ya publiqué uno</a>'
      : '<a class="ci-btn ci-btn--claro" href="' + LAB('v7') + '">Planear el próximo →</a>' +
        '<a class="ci-btn ci-btn--linea" href="' + LAB('v5') + '">Mis videos</a>';

    return '<div class="cp-cara">' +
      '<div class="cp-perf">' +
      (P.foto ? '<img class="cp-foto" src="' + esc(P.foto) + '" alt="">'
              : '<span class="cp-foto cp-foto--vacia">' + esc((P.usuario || 'C').charAt(0).toUpperCase()) + '</span>') +
      '<div class="cp-perf__tx"><div class="cp-usr"><b>' + esc(P.usuario || 'Tu marca') + '</b>' +
      '<svg viewBox="0 0 16 16" fill="#3897F0" aria-label="verificado">' +
      '<path d="M8 0l1.9 1.5 2.4-.3 1 2.2 2.2 1-.3 2.4L16 8l-1.5 1.9.3 2.4-2.2 1-1 2.2-2.4-.3L8 16l-1.9-1.5-2.4.3-1-2.2-2.2-1 .3-2.4L0 8l1.5-1.9-.3-2.4 2.2-1 1-2.2 2.4.3z"/>' +
      '<path d="M6.8 10.9L4.3 8.4l1-1 1.5 1.5 4-4 1 1z" fill="#fff"/></svg></div>' +
      (nums.length
        ? '<div class="cp-nums">' + nums.map((n) => '<span>' + n[0] + '<small>' + n[1] + '</small></span>').join('') + '</div>'
        : '<a class="cp-completa" href="' + LAB('v5') + '">Completa tu perfil →</a>') +
      '</div></div>' +
      (P.bio ? '<p class="cp-bio">' + esc(P.bio).replace(/\n/g, '<br>') + '</p>' : '') +

      '<div class="cp-raya"></div>' +

      '<div class="cp-cab"><span class="n">' + (R.n ? 'Con Cherry' : 'Sin videos todavía') + '</span>' +
      (dato ? '<span class="d">' + esc(dato) + '</span>' : '') + '</div>' +
      '<div class="cp-rej">' + aro(R.aro) +
      '<div class="cp-cuadro">' + cifras.map((c) =>
        '<span class="c">' + c[0] + (c[2] || '') + '<small>' + c[1] + '</small></span>').join('') +
      '</div></div>' +
      abajo +
      '<div class="cp-acc">' + botones + '</div></div>';
  }

  function caraVideo(v) {
    const mil = M().mil;
    const num = (valor, etq, clase) => valor == null ? '' :
      '<span class="c"><b' + (clase ? ' class="' + clase + '"' : '') + '>' + valor + '</b><small>' + etq + '</small></span>';
    /* El marco: el fotograma si lo hay, y encima la curva de retención, que es lo que Cherry mide.
       Sin fotograma la curva manda sola — nunca un rectángulo negro vacío. */
    const curva = v.curva
      ? '<svg class="cp-curva" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><linearGradient id="cicG' + esc(v.id) + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#FFC93C" stop-opacity=".45"/>' +
        '<stop offset="100%" stop-color="#FFC93C" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="' + v.curva + ' L100 42 L0 42 Z" fill="url(#cicG' + esc(v.id) + ')"/>' +
        '<path d="' + v.curva + '" fill="none" stroke="#FFC93C" stroke-width="1.7" ' +
        'vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '';
    return '<div class="cp-cara">' +
      '<div class="cp-cab"><span class="n teal">Tu video</span>' +
      (v.cuando ? '<span class="d">' + esc(v.cuando) + '</span>' : '') + '</div>' +
      '<div class="cp-vid">' +
      '<div class="cp-marco' + (v.tapa ? '' : ' cp-marco--curva') + '">' +
      (v.tapa ? '<img src="' + esc(v.tapa) + '" alt="">' : '<span class="cp-marco__vacio" aria-hidden="true"></span>') +
      '<span class="cp-vel"></span>' + curva + '</div>' +
      '<div class="cp-vid__tx"><div class="cp-tit">' + esc(v.titulo) + '</div>' +
      '<div class="cp-vnum">' +
      num(v.ret == null ? null : v.ret + '%', 'retención', v.ret != null && v.ret >= 40 ? 'teal' : 'amb') +
      num(v.visitas == null ? null : mil(v.visitas), 'visitas') +
      num(v.interacciones == null ? null : mil(v.interacciones), 'interacc.') +
      '</div>' +
      (v.mitad != null
        ? '<p class="cp-pie">la mitad se fue a los <b>' + String(v.mitad).replace('.', ',') + ' s</b></p>'
        : '<p class="cp-pie">nunca bajó de la mitad</p>') +
      '</div></div></div>';
  }

  /* ── Pintar y rotar ── */
  function pinta() {
    if (!nodo || !R) return;
    const caja = nodo.querySelector('.cp-caras');
    const marca = R.n + '|' + (R.videos.length) + '|' + j + '|' + JSON.stringify(R.aro);
    if (caja.dataset.marca !== marca) {
      caja.innerHTML = sec.map((x) => x.tipo === 'resumen' ? caraResumen() : caraVideo(x.v)).join('');
      caja.dataset.marca = marca;
    }
    caja.querySelectorAll('.cp-cara').forEach((d, k) => d.classList.toggle('on', k === j));

    const enResumen = sec[j] && sec[j].tipo === 'resumen';
    const rota = sec.length > 1;
    const b = nodo.querySelector('.cp-volver');
    b.hidden = !rota || (enResumen && !fijo);
    b.innerHTML = enResumen
      ? '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.5 1.2l7.3 4.3a.6.6 0 010 1L2.5 10.8A.6.6 0 011.6 10.3V1.7a.6.6 0 01.9-.5z"/></svg>ver los videos'
      : '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.6 2.2L1.4 5.4l3.2 3.2"/><path d="M1.6 5.4h6a3 3 0 013 3v1.2"/></svg>volver al resumen';
    b.setAttribute('aria-label', enResumen ? 'Volver a que pasen los videos' : 'Volver al resumen y quedarse');

    const t = nodo.querySelector('.cp-tiempo i');
    t.classList.remove('corre'); void t.offsetWidth;
    if (rota && !fijo) { t.style.animationDuration = VUELTA + 'ms'; t.classList.add('corre'); }
    else { t.style.width = '0'; }
  }
  function arranca() {
    clearInterval(reloj);
    if (sec.length < 2 || fijo) { pinta(); return; }
    reloj = setInterval(() => { j = (j + 1) % sec.length; pinta(); }, VUELTA);
    pinta();
  }

  /* ── El nodo, uno solo ── */
  C.tarjetaCuenta = function () {
    if (!nodo) {
      nodo = C.h('section', { class: 'ci-t ci-vol ci-perfil', 'aria-label': 'Tu marca' },
        C.h('span', { class: 'ci-flecha', 'aria-hidden': 'true' }, '→'),
        C.h('div', { class: 'cp-caras' }),
        C.h('button', { type: 'button', class: 'cp-volver', hidden: 'hidden' }),
        C.h('div', { class: 'cp-tiempo' }, C.h('i'))
      );
      nodo.querySelector('.cp-volver').addEventListener('click', (e) => {
        e.stopPropagation();
        if (sec[j] && sec[j].tipo === 'resumen') { fijo = false; j = 0; }
        else { fijo = true; for (let k = 0; k < sec.length; k++) if (sec[k].tipo === 'resumen') { j = k; break; } }
        arranca();
      });
      /* Con el ratón encima se para: nadie lee un dato que se va solo. */
      nodo.addEventListener('mouseenter', () => { if (!fijo) { clearInterval(reloj);
        const t = nodo.querySelector('.cp-tiempo i'); if (t) t.classList.remove('corre'); } });
      nodo.addEventListener('mouseleave', () => { if (!fijo) arranca(); });
      /* La flecha de la esquina abre el Laboratorio, como en las demás tarjetas. */
      nodo.querySelector('.ci-flecha').addEventListener('click', () => { location.href = LAB(''); });
      cargar();
      if (!R) { R = M() ? M().resumen(null) : null; sec = caras(); }
      pinta();
    }
    return nodo;
  };

  /* Cuando la sesión está lista ya se puede pedir el documento de la cuenta. */
  (C.onApiReady = C.onApiReady || []).push(() => { pedido = false; cargar(); });
})();

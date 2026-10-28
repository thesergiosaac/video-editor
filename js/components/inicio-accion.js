/* inicio-accion.js — la franja oscura del final del inicio: «Tu semana» | «Tu fórmula» (28-oct-2026)
 *
 * Sergio: las dos tarjetas de abajo («Así trabajan juntas» y «Seguir editando») eran inútiles: «algo que motive a la persona
 * a tomar acción en algo específico». Escogió el diseño B (una franja oscura partida en dos):
 * https://claude.ai/artifact/LTKJwGQsaP8ho6nGNL2Uc7
 *
 *   · TU SEMANA: los reels de esta semana (lunes a domingo) contra la meta de tu estrategia: los publicados (Instagram) con su
 *     portada y ✓, los programados (Calendario) con su día y hora, y los que faltan punteados. La racha (semanas seguidas
 *     cumpliendo) y tu mejor hora. Un botón: escribir el que falta, con tu receta ya puesta.
 *   · TU FÓRMULA: la mejor pieza de cada tipo (idea, gancho, formato, estructura) y cuánto le falta para quedar MAGNÉTICA;
 *     dice exactamente cuál repetir. Un botón: hacer ese video. Y la línea al informe del mes (Estadísticas).
 *
 * Solo lee. ⚠️ Las reglas son las de siempre: magnética = 2+ aciertos y 2 de cada 3 (informe-mes.js › grupos, la misma de Mi
 * proceso); la mejor hora es la de calendario.html › mejorHoraReal (copiada abajo: si cambia allá, cambia aquí).
 * «Hacer el video» / «Escribir el que falta» → sessionStorage › cherry-otro-asi + Guiones (como «Rompiste tu patrón»).
 */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});
  const Q = () => window.CherryCuenta;
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (x) => (x == null || x === '' || !isFinite(Number(x))) ? null : Number(x);
  const cap = (t) => { t = String(t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
  const corto = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trim() + '…' : t; };
  const dos = (n) => (n < 10 ? '0' : '') + n;
  const local = (d) => d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const hora12 = (min) => { const H = Math.floor(min / 60), M = min % 60; return ((H % 12) || 12) + ':' + dos(M) + (H < 12 ? ' a. m.' : ' p. m.'); };

  let nodo = null, docs = { marca: '', est: undefined, cal: undefined }, hist = null;

  /* ⚠️ copiado de calendario.html › mejorHoraReal (27-oct): cada publicación contra las 11 más cercanas en el tiempo, en
     logaritmo y recortada; ventanas de dos horas con 3+ publicaciones y la nota bajada a las de pocas. Necesita 8. */
  function mejorHora(vs) {
    const ps = vs.filter((p) => p && p.creado && num(p.alcance) > 0).slice(0, 80);
    if (ps.length < 8) return null;
    const t = ps.map((p) => +new Date(p.creado));
    const notas = ps.map((p, i) => {
      const cerca = ps.map((q, j) => [Math.abs(t[j] - t[i]), num(q.alcance)]).sort((a, b) => a[0] - b[0]).slice(0, 11).map((x) => x[1]).sort((a, b) => a - b);
      const d = new Date(t[i]);
      return { h: d.getHours() + d.getMinutes() / 60, r: Math.max(-1.5, Math.min(1.5, Math.log(num(p.alcance) / cerca[Math.floor(cerca.length / 2)]))) };
    });
    let mejor = null;
    for (let h = 0; h < 24; h++) {
      const en = notas.filter((x) => x.h >= h && x.h < h + 2);
      if (en.length < 3) continue;
      const prom = en.reduce((a, x) => a + x.r, 0) / en.length, nota = prom * en.length / (en.length + 3);
      if (!mejor || nota > mejor.nota) mejor = { nota, prom, en };
    }
    if (!mejor || Math.exp(mejor.prom) < 1.15) return null;
    const hs = mejor.en.map((x) => x.h).sort((a, b) => a - b), hm = hs[Math.floor(hs.length / 2)];
    return hora12(Math.min(23 * 60 + 30, Math.round(hm * 2) * 30));
  }

  /* ── Tu semana ── */
  function semana(ig) {
    const hoy = new Date(), lun = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const dom = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 6), a = local(lun), b = local(dom), h0 = local(hoy);
    const reels = ((ig && ig.videos) || []).filter((v) => v && String(v.tipo || 'REELS').toUpperCase() === 'REELS' && (v.creado || v.fecha))
      .map((v) => ({ v, f: local(new Date(v.creado || v.fecha + 'T12:00:00')) }));
    const pub = reels.filter((x) => x.f >= a && x.f <= b).sort((x, y) => x.f.localeCompare(y.f));
    const posts = (docs.cal && Array.isArray(docs.cal.posts)) ? docs.cal.posts : [];
    const prog = posts.filter((p) => p && p.tipo === 'video' && p.estado === 'programado' && String(p.fecha || '') >= h0 && String(p.fecha || '') <= b)
      .sort((x, y) => (String(x.fecha) + (x.hora || '')).localeCompare(String(y.fecha) + (y.hora || '')));
    const meta = docs.est && docs.est.semana ? num(docs.est.semana.reels) : null;
    // la racha: semanas seguidas (antes de esta) que cumplieron la meta, con los reels publicados
    const cumplio = [];   // [la pasada, la de antes, …]
    if (meta) {
      for (let w = 1; w <= 26; w++) {
        const l = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() - 7 * w), d = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 6);
        cumplio.push(reels.filter((x) => x.f >= local(l) && x.f <= local(d)).length >= meta);
      }
    }
    let racha = 0; while (racha < cumplio.length && cumplio[racha]) racha++;
    const ult4 = cumplio.slice(0, 4).reverse();
    const hechos = pub.length + prog.length;
    if (meta && hechos >= meta && pub.length >= meta) racha += 1;   // esta semana ya cumplió con lo publicado
    const quedan = 7 - ((hoy.getDay() + 6) % 7);
    return { pub, prog, meta, racha, ult4, hechos, falta: meta ? Math.max(0, meta - hechos) : 0, quedan, hora: mejorHora(((ig && ig.videos) || []).filter((v) => v && v.creado)) };
  }

  /* ── Tu fórmula ── */
  function formula() {
    const I = window.CherryInforme, R = window.CherryResumen, q = Q();
    if (!I || !I.grupos || !hist) return null;
    const una = q && q.cuantasMarcas ? q.cuantasMarcas() <= 1 : false, mn = q && q.marcaNormal ? q.marcaNormal() : '';
    const medidos = hist.filter((h) => h && (h.cuenta ? h.cuenta === mn : una) && h.retencion != null && h.historial && h.historial.piezas);
    if (!medidos.length) return { vacia: true };
    const corte = R && R.corte ? R.corte(medidos) : 45;
    const G = I.grupos(medidos, corte);
    // cuántos aciertos seguidos le faltan para quedar magnética: a+k ≥ 2 y 3(a+k) ≥ 2(n+k)
    const falta = (x) => Math.max(0, 2 - x.aciertos, 2 * x.n - 3 * x.aciertos);
    const piezas = I.TIPOS.map((T) => {
      const l = G[T.k] || [];
      const mag = l.filter((x) => x.estado === 'mag').sort((a, b) => b.aciertos - a.aciertos || b.media - a.media)[0];
      if (mag) return { T, x: mag, k: 0 };
      const tmp = l.filter((x) => x.estado === 'tmp').map((x) => ({ x, k: falta(x) })).sort((a, b) => a.k - b.k || b.x.media - a.x.media)[0];
      return tmp ? { T, x: tmp.x, k: tmp.k } : { T, x: null, k: null };
    });
    const foco = piezas.filter((p) => p.x && p.k > 0).sort((a, b) => a.k - b.k)[0] || null;   // por orden: gancho, idea, formato, estructura
    return { piezas, foco, mags: piezas.filter((p) => p.x && !p.k).length };
  }
  function receta(piezas, foco) {
    const o = { tema: '', idea: '', gancho: '', frase: '', formato: '', estructura: '' };
    (piezas || []).forEach((p) => { if (!p.x) return; if (p.T.k === 'idea') o.tema = p.x.val; else o[p.T.k] = p.x.val; if (p.T.k === 'gancho' && p.x.frase) o.frase = p.x.frase; });
    if (foco && foco.x) { if (foco.T.k === 'idea') o.tema = foco.x.val; else o[foco.T.k] = foco.x.val; }
    return esc(JSON.stringify(o));
  }

  const nombre = (x) => (window.CherryInforme && CherryInforme.nom ? CherryInforme.nom(x) : cap(x.val));   // la estructura, en palabras

  /* ── pintar ── */
  const tapa = (url) => url ? ' style="background-image:url(&quot;' + esc(url) + '&quot;)"' : '';
  function pinta() {
    if (!nodo) return;
    const q = Q(), ig = q && q.instagram ? q.instagram() : null;
    if (!ig || !ig.perfil || (ig.red && ig.red !== 'ig')) { nodo.hidden = true; return; }   // sin Instagram conectado: «Tu cuenta» ya lo pide
    nodo.hidden = false;
    if (docs.est === undefined || docs.cal === undefined) { nodo.innerHTML = '<div class="ia-mitad"><span class="ia-eti">Tu semana</span><p class="ia-carga">Mirando tu semana…</p></div>'; return; }
    const S = semana(ig), F = formula(), rec = F && !F.vacia ? receta(F.piezas, F.foco) : '';
    const mes = MESES[new Date().getMonth()];

    // TU SEMANA
    let izq;
    if (!S.meta) {
      izq = '<span class="ia-eti">Tu semana</span>' +
        '<div class="ia-num"><span class="ia-n">' + S.hechos + '</span><p>' + (S.hechos === 1 ? 'reel' : 'reels') + ' esta semana<small>Arma tu estrategia y Cherry te dice cuántos te convienen.</small></p></div>' +
        '<div class="ia-pie"><span></span><a class="ia-btn" href="herramientas/estrategias.html">Armar mi estrategia <i>↗</i></a></div>';
    } else {
      const huecos = Math.min(7, Math.max(S.meta, S.hechos));
      let tira = S.pub.map((x) => '<span class="ia-t pub"' + tapa(x.v.tapa) + ' title="' + esc(corto(x.v.titulo || '', 60)) + '"></span>').join('') +
        S.prog.map((p) => { const d = new Date(String(p.fecha) + 'T12:00:00'); return '<span class="ia-t prog"' + tapa(p.tapa || p.portada) + '><b>' + DIAS[d.getDay()] + (p.hora ? ' ' + esc(p.hora) : '') + '</b></span>'; }).join('');
      for (let i = S.hechos; i < huecos; i++) tira += '<span class="ia-t falta">+</span>';
      const tit = S.falta ? 'Te ' + (S.falta === 1 ? 'falta 1' : 'faltan ' + S.falta) + ' esta semana' : S.hechos > S.meta ? '¡Te pasaste de tu meta!' : 'Cumpliste tu meta';
      const sub = (S.prog.length ? (S.prog.length === 1 ? 'Uno ya está programado. ' : S.prog.length + ' ya están programados. ') : '') +
        (S.falta ? 'Te ' + (S.quedan === 1 ? 'queda 1 día.' : 'quedan ' + S.quedan + ' días.') : S.racha > 1 ? 'Vas ' + S.racha + ' semanas seguidas.' : 'Sigue así la próxima semana.');
      izq = '<span class="ia-eti">Tu semana' + (S.racha ? ' · <b>racha de ' + S.racha + '</b>' : '') + '</span>' +
        '<div class="ia-num"><span class="ia-n">' + S.hechos + '<span>/' + S.meta + '</span></span><p>' + tit + '<small>' + sub + '</small></p></div>' +
        '<div class="ia-tira">' + tira + '</div>' +
        '<div class="ia-pie"><span class="ia-racha"><span class="ia-barritas">' + S.ult4.map((si) => '<i' + (si ? ' class="si"' : '') + '></i>').join('') + '</span>' +
          (S.hora ? 'Mejor hora ' + S.hora : 'Las últimas 4 semanas') + '</span>' +
          '<button type="button" class="ia-btn" data-ia-otro="' + rec + '">' + (S.falta ? 'Escribir el que falta' : 'Escribir el siguiente') + ' <i>↗</i></button></div>';
    }

    // TU FÓRMULA
    let der;
    if (!F) der = '<span class="ia-eti">Tu fórmula</span><p class="ia-carga">Mirando tus piezas…</p>';
    else if (F.vacia) {
      der = '<span class="ia-eti">Tu fórmula</span><p class="ia-frase">Cuando Cherry desmonte tus reels, aquí ves qué <b>idea, gancho, formato y estructura</b> te funcionan, y cuál repetir.</p>' +
        '<div class="ia-pie"><span></span><a class="ia-btn" href="herramientas/laboratorio.html">Ir al Laboratorio <i>↗</i></a></div>';
    } else {
      const fila = F.piezas.map((p, j) => {
        let puntos = '';
        if (p.x) { const llenos = Math.min(p.x.aciertos, 3), vacios = Math.min(p.k || 0, 5 - llenos); for (let i = 0; i < llenos; i++) puntos += '<i class="si"></i>'; for (let i = 0; i < vacios; i++) puntos += '<i></i>'; }
        else puntos = '<i></i><i></i>';
        const cls = !p.x ? ' nada' : F.foco && F.foco === p ? ' foco' : !p.k ? ' mag' : '';
        return (j ? '<span class="ia-mas">+</span>' : '') + '<span class="ia-p' + cls + '" title="' + (p.x ? esc(cap(p.x.val) + ' · ' + p.x.aciertos + ' de ' + p.x.n + ' reels funcionaron') : 'Ninguna funcionó todavía') + '">' +
          '<small>' + p.T.uno + '</small><b>' + (p.x ? esc(corto(nombre(p.x), 34)) : '?') + '</b><span class="ia-puntos">' + puntos + '</span></span>';
      }).join('');
      const g = F.foco ? F.foco.T.g : 'm', mag = g === 'f' ? 'magnética' : 'magnético';
      const frase = F.mags === 4 ? '<b>Tu fórmula está lista</b>: las cuatro piezas ya son magnéticas. Úsala tal cual en tu próximo video.'
        : F.foco ? 'Repite ' + ({ idea: 'la idea', gancho: 'el gancho', formato: 'el formato', estructura: 'la estructura' }[F.foco.T.k]) + ' <b>«' + esc(corto(nombre(F.foco.x), 44)) + '»</b>: ' + (F.foco.k === 1 ? 'un video más que funcione y queda ' + mag + '.' : F.foco.k + ' videos más que funcionen y queda ' + mag + '.')
        : 'Todavía ninguna pieza ha funcionado: prueba ideas y ganchos nuevos para encontrar la tuya.';
      der = '<span class="ia-eti">Tu fórmula · <b>' + F.mags + ' de 4 magnéticas</b></span><div class="ia-formula">' + fila + '</div><p class="ia-frase">' + frase + '</p>' +
        '<div class="ia-pie"><a class="ia-link" href="herramientas/estadisticas.html?ver=informes">Tu informe de ' + mes + ' →</a>' +
        '<button type="button" class="ia-btn" data-ia-otro="' + receta(F.piezas, F.foco) + '">' + (F.mags === 4 ? 'Usar mi fórmula' : 'Hacer el video') + ' <i>↗</i></button></div>';
    }
    nodo.innerHTML = '<div class="ia-mitad">' + izq + '</div><div class="ia-sep"></div><div class="ia-mitad">' + der + '</div>';
  }

  /* ── los datos: la estrategia y el Calendario de la marca activa, y el historial (compartido con «Tu cuenta») ── */
  function pedir() {
    const q = Q(), marca = (C.session && C.session.marca) || (q && q.marcaNormal ? q.marcaNormal() : '') || 'principal';
    if (docs.marca !== marca && C.api && C.api.getDatosHerramienta && C.session && C.session.token) {
      docs = { marca, est: undefined, cal: undefined };
      C.api.getDatosHerramienta('estrategias@' + marca).then((d) => { docs.est = d || null; pinta(); }, () => { docs.est = null; pinta(); });
      C.api.getDatosHerramienta('calendario@' + marca).then((d) => { docs.cal = d || null; pinta(); }, () => { docs.cal = null; pinta(); });
    }
    if (!hist && C.historialReels) C.historialReels().then((r) => { hist = (r && r.videos) || []; pinta(); }, () => {});
    pinta();
  }

  function alTocar(e) {
    const b = e.target.closest('[data-ia-otro]');
    if (!b) return;
    try { sessionStorage.setItem('cherry-otro-asi', b.getAttribute('data-ia-otro')); } catch (er) { /* sin sessionStorage: Guiones abre igual */ }
    location.href = 'herramientas/laboratorio.html?modo=guiones&nuevo=1';
  }

  C.tarjetaAccion = function () {
    if (!nodo) {
      nodo = C.h('section', { class: 'ia', 'aria-label': 'Tu semana y tu fórmula' });   // sin «ci-t»: sus reglas (flex, padding, p de 30ch) la desarmaban
      nodo.addEventListener('click', alTocar);
      const q = Q();
      if (q && q.cuandoLlegueInstagram) q.cuandoLlegueInstagram(pedir);
      pedir();
    }
    return nodo;
  };
  (C.onApiReady = C.onApiReady || []).push(() => { docs.marca = ''; pedir(); });
})();

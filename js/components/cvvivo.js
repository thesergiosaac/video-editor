/* cvvivo.js — (29-oct-2026) LA CÁMARA VIVA EN VIVO en el celular del editor. Lo mismo que el banco de prueba
 * (_demo-camara-viva.html), sobre la base del video: la cámara que se acerca y te corre (movimiento.js › vivo), los títulos al
 * lado de tu cara y las láminas (premium/src/cv → js/vista-cv.js, que se baja la primera vez). Tres capas en la caja del
 * celular: el FONDO de la lámina (debajo) → tu video (con su cámara, en el hueco de la lámina o escondido) → el FRENTE
 * (las letras y el objeto, encima). Mientras hay lámina los subtítulos en vivo se callan (como en el video final).
 *
 * El plan lo arma el director en el servidor (orchestrate lo pide al preparar la base; aquí se recoge por la función
 * camara-viva) y la cara se busca aquí mismo (js/caras.js, gratis) y se guarda con el video para el video final.
 * movvivo.js le cede el celular cuando el proyecto es «Cámara viva» (C.cvVivo.activo()).
 * ⚠️ (29-oct) mientras Sergio la prueba en el editor, solo la ven los administradores (CV_PARA_TODOS).
 */
(function () {
  const C = window.CARRETE, MOV = window.CherryMov, CV = window.CherryCV;
  if (!C || !MOV || !CV) return;
  const CV_PARA_TODOS = false;
  const VISTA_JS = 'js/vista-cv.js?v=20261029cv1', CARAS_JS = 'js/caras.js?v=20261029cv1';
  const CADA_MS = 6000;     // cada cuánto se pregunta por el plan mientras el director trabaja (≈ 90 s)
  const TARDA_S = 95;       // lo que tarda el director (medido: 89 a 97 s); lo que dice el aviso del celular
  /* los fondos de las láminas que se ofrecen (la pestaña Gráficos de Automático y la del Manual) */
  const FONDOS = [
    { id: '', name: 'Crema', hex: '#ECE4D6' }, { id: '#f4f2ee', name: 'Blanco', hex: '#F4F2EE' },
    { id: '#d9d4cc', name: 'Piedra', hex: '#D9D4CC' }, { id: '#1c1b1e', name: 'Noche', hex: '#1C1B1E' },
  ];

  const E = { id: null, plan: null, avisos: [], estado: '', error: '', proxima: 0, pidiendo: false, desde: 0, aviso: null,
              caras: null, carasId: null, buscando: false, avance: 0, foto: null,
              clave: '', prep: null, piezas: null, camara: null, fondo: null, frente: null, caja: null, tocados: [], callado: null };
  const cargas = {};
  function cargarScript(src) {
    if (!cargas[src]) cargas[src] = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete cargas[src]; mal(new Error('no cargó ' + src)); };
      document.head.appendChild(s);
    });
    return cargas[src];
  }

  /* ¿la ve esta cuenta? Todos cuando CV_PARA_TODOS; mientras tanto, solo administradores (lo que ya sabe este navegador) */
  let adminPedido = false;
  function disponible() {
    if (CV_PARA_TODOS) return true;
    const u = C.session && C.session.user;
    if (!u || !u.id) return false;
    let v = null;
    try { v = localStorage.getItem('cherry-admin-' + u.id); } catch (_) { /* sin almacenamiento */ }
    if (v == null && !adminPedido && C.api && C.api.cobroYAdmin) {
      adminPedido = true;
      C.api.cobroYAdmin().then((r) => { try { localStorage.setItem('cherry-admin-' + u.id, r && r.admin ? '1' : '0'); } catch (_) { /* nada */ } C.render(); }).catch(() => { adminPedido = false; });
    }
    return v === '1';
  }
  const activo = () => !!(C.state.grafOn && C.state.grafEstilo === 'camara_viva' && disponible());

  /* El id del video que guarda el plan: la base que se ve o el render con su copia */
  const idDe = (ctx) => (ctx && typeof ctx.id === 'string' ? ctx.id.replace(/^(base|render):/, '') : null);

  function nuevoVideo(id) {
    Object.assign(E, { id, plan: null, avisos: [], estado: 'pidiendo', error: '', proxima: 0, caras: null, carasId: null, clave: '', foto: null, desde: Date.now() });
  }
  /* El plan: se pregunta cada 6 s mientras el director trabaja. Con el plan llegan también las caras, si ya se guardaron. */
  function pedirPlan() {
    if (E.pidiendo || E.plan || E.error || Date.now() < E.proxima || !E.id) return;
    E.pidiendo = true;
    const id = E.id;
    C.api.edgeFetch('camara-viva', { accion: 'plan', render_id: id }, true, 30000).then((r) => {
      if (E.id !== id) return;
      if (r && r.plan) {
        E.plan = r.plan; E.avisos = r.avisos || []; E.estado = 'listo'; E.clave = '';
        if (Array.isArray(r.caras) && r.caras.length) { E.caras = r.caras; E.carasId = id; }
        C.render();
      } else if (r && r.error) { E.error = r.error; E.estado = 'error'; C.render(); }
      else { E.estado = (r && r.estado) || 'pendiente'; E.proxima = Date.now() + CADA_MS; }
    }).catch((e) => {
      console.warn('[Cámara viva] plan', e);
      E.proxima = Date.now() + CADA_MS * 2;
    }).finally(() => { E.pidiendo = false; });
  }
  /* La cara: se busca una vez por video sobre la misma base que se ve y se guarda con el video (el final la usa igual) */
  function buscarCaras(ctx) {
    if (E.buscando || E.carasId === E.id || !E.plan || !ctx.video) return;
    const src = ctx.video.currentSrc || ctx.video.src;
    if (!src) return;
    E.buscando = true; E.avance = 0;
    const id = E.id;
    cargarScript(CARAS_JS).then(() => window.CherryCaras.detectar(src, { cada: 0.25, alAvanzar: (f) => { E.avance = f; } })).then((lista) => {
      if (E.id !== id) return;
      E.caras = lista; E.carasId = id; E.clave = '';
      C.render();
      return C.api.edgeFetch('camara-viva', { accion: 'caras', render_id: id, caras: lista, version: window.CherryCaras.VERSION }, true, 30000);
    }).catch((e) => {
      console.warn('[Cámara viva] caras', e);
      if (E.id === id) E.carasId = id;   // sin cara: los títulos van arriba (no se insiste en cada cuadro)
    }).finally(() => { E.buscando = false; });
  }
  /* Tu foto para los gráficos de comentario y seguir: un cuadro de tu propio video */
  function fotoDe(video) {
    if (E.foto || !video || video.readyState < 2) return E.foto;
    try {
      const cv = document.createElement('canvas'); cv.width = 240; cv.height = Math.round(240 * (video.videoHeight || 1920) / (video.videoWidth || 1080));
      cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
      E.foto = cv.toDataURL('image/jpeg', 0.85);
    } catch (_) { E.foto = ''; }   // video sin permiso de lectura: el gráfico va sin foto
    return E.foto;
  }
  /* Lo que va en cada lámina. Las imágenes llegan con «Las imágenes de tu video»; mientras no haya, va tu video en el recuadro */
  function material(m) {
    const o = m.objeto || {};
    if (o.tipo === 'imagen') return o.img ? { objeto: o.img } : {};
    if (o.tipo === 'grafico') return E.foto ? { foto: E.foto } : {};
    return {};
  }
  /* El plan en segundos del video que se ve (el reloj real de la base: cada corte se recorta un poco) */
  function armar(ctx) {
    const clave = E.id + '|' + (E.caras ? E.caras.length : 0) + '|' + (C.state.grafFondoCV || '') + '|' + (E.foto ? 1 : 0) + '|' + (ctx.duraciones || []).join(',');
    if (clave === E.clave && E.piezas) return;
    E.clave = clave;
    const aR = typeof ctx.aReal === 'function' ? ctx.aReal : (t) => t;
    // las MISMAS palabras que recibió el director (él descarta las vacías y numera sin ellas)
    const pal = (ctx.palabras || []).filter((p) => p && String(p.word || '').trim())
      .map((p) => ({ word: p.word, start: aR(Number(p.start)), end: aR(Number(p.end)) }));
    const plan = Object.assign({}, E.plan, { fondo: C.state.grafFondoCV || null,
      momentos: (E.plan.momentos || []).map((m) => Object.assign({}, m, { t0: aR(Number(m.t0)), t1: aR(Number(m.t1)) })) });
    E.prep = CV.preparar(plan, E.caras || []);
    E.camara = MOV.vivo(E.prep.tramos, 999);
    E.piezas = CV.piezas(plan, pal, material);
  }

  /* ── las capas en la caja del celular ── */
  function capa(clase) {
    const d = document.createElement('div');
    d.className = 'cv-capa ' + clase; d.setAttribute('aria-hidden', 'true');
    // el cuadro de la lámina (1080 × 1920), escalado al del video en cada cuadro
    d.style.cssText = 'position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0;pointer-events:none;overflow:hidden';
    return d;
  }
  function ponerCapas(caja, ctx) {
    if (!E.fondo) { E.fondo = capa('cv-capa--fondo'); E.frente = capa('cv-capa--frente'); }
    const els = ctx.elementos.filter(Boolean);
    if (E.fondo.parentNode !== caja || E.fondo.nextSibling !== els[0]) caja.insertBefore(E.fondo, els[0]);
    let despues = null;
    for (const el of caja.children) if (els.indexOf(el) >= 0) despues = el;
    if (despues && despues.nextSibling !== E.frente) caja.insertBefore(E.frente, despues.nextSibling);
    E.caja = caja;
  }
  /* El cuadro del video dentro de su caja (object-fit: cover), como movvivo › cuadroVideo */
  function cuadroVideo(caja, video) {
    const We = caja.clientWidth, He = caja.clientHeight, vw = video.videoWidth || 1080, vh = video.videoHeight || 1920;
    const k = Math.max(We / vw, He / vh);
    return { We, He, W: vw * k, H: vh * k, x: (We - vw * k) / 2, y: (He - vh * k) / 2 };
  }
  function estilo(el, o) { for (const k in o) if (el.style[k] !== o[k]) el.style[k] = o[k]; }

  /* El aviso del celular: qué está haciendo Cherry mientras la Cámara viva no está lista (Sergio, 29-oct: «no se entiende
     qué está pasando»). Arriba, debajo de la etiqueta de la vista previa. */
  function avisar(caja, texto) {
    if (!texto || !caja) { if (E.aviso && E.aviso.style.display !== 'none') E.aviso.style.display = 'none'; return; }
    if (!E.aviso) {
      E.aviso = document.createElement('div');
      E.aviso.className = 'cv-aviso'; E.aviso.setAttribute('role', 'status');
      E.aviso.style.cssText = 'position:absolute;left:50%;top:54px;transform:translateX(-50%);z-index:30;max-width:86%;padding:7px 12px;' +
        'border-radius:999px;background:rgba(14,10,12,.82);color:#fff;font:600 11px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;' +
        'box-shadow:0 4px 14px rgba(0,0,0,.35)';
    }
    if (E.aviso.parentNode !== caja) caja.appendChild(E.aviso);
    if (E.aviso.textContent !== texto) E.aviso.textContent = texto;
    if (E.aviso.style.display === 'none') E.aviso.style.display = '';
  }
  const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function textoAviso() {
    if (E.error) return 'Cámara viva · ' + E.error;
    if (!E.plan) {
      const falta = TARDA_S - (Date.now() - E.desde) / 1000;
      return 'Cámara viva · Cherry está armando tu edición · ' + (falta > 5 ? 'faltan ≈ ' + mmss(falta) : 'ya casi');
    }
    if (E.buscando) return 'Cámara viva · buscando tu cara para poner los títulos a tu lado · ' + Math.round(E.avance * 100) + ' %';
    return '';
  }

  /* Un cuadro: dónde va tu video (su cámara, el hueco o nada) y las láminas encima. true = el celular lo maneja la Cámara viva */
  function cuadro(ctx) {
    if (!ctx || !ctx.video || !C.api) { soltar(); return false; }
    const id = idDe(ctx);
    if (id !== E.id) nuevoVideo(id);
    pedirPlan();
    if (!E.plan) { soltar(); avisar(ctx.video.parentNode, textoAviso()); return false; }   // mientras llega el plan: tu video tal cual
    buscarCaras(ctx);
    fotoDe(ctx.video);
    if (!window.CherryCVVista) { cargarScript(VISTA_JS).catch((e) => console.warn('[Cámara viva] vista', e)); return false; }
    const VISTA = window.CherryCVVista, caja = ctx.video.parentNode;
    if (!caja) return false;
    armar(ctx);
    ponerCapas(caja, ctx);
    const q = cuadroVideo(caja, ctx.video), k = q.W / 1080;
    const capaT = 'translate(' + q.x.toFixed(2) + 'px,' + q.y.toFixed(2) + 'px) scale(' + k.toFixed(5) + ')';
    estilo(E.fondo, { transform: capaT }); estilo(E.frente, { transform: capaT });
    const t = Number(ctx.video.currentTime) || 0;
    const d = VISTA.videoEn(t, E.piezas);
    const els = ctx.elementos.filter(Boolean);
    els.forEach((el) => { if (E.tocados.indexOf(el) < 0) E.tocados.push(el); });
    if (d === null) els.forEach((el) => estilo(el, { visibility: 'hidden' }));
    else if (d === 'camara') {
      const tr = MOV.css(MOV.valor(E.camara, t));
      els.forEach((el) => estilo(el, { visibility: '', clipPath: '', transformOrigin: (MOV.ANCLA.x * 100) + '% ' + (MOV.ANCLA.y * 100) + '%', transform: tr }));
    } else {
      /* en el hueco de la lámina: el cuadro entero se lleva al hueco (cubriéndolo, con su giro) y se recorta con sus esquinas
         redondas. El recorte va en el cuadro SIN mover (clip-path) y el transform lo lleva con él, como el marco del banco */
      const s = Math.max(d.width / 1080, d.height / 1920), cx = d.left + d.width / 2, cy = d.top + d.height / 2;
      const ox = q.x + 540 * k, oy = q.y + 960 * k, mw = d.width / s / 2 * k, mh = d.height / s / 2 * k;
      const clip = 'inset(' + (oy - mh).toFixed(2) + 'px ' + (q.We - ox - mw).toFixed(2) + 'px ' + (q.He - oy - mh).toFixed(2) + 'px ' + (ox - mw).toFixed(2) +
        'px round ' + (d.radio / s * k).toFixed(2) + 'px)';
      const tr = 'translate(' + ((cx - 540) * k).toFixed(2) + 'px,' + ((cy - 960) * k).toFixed(2) + 'px) rotate(' + (d.rot || 0) + 'deg) scale(' + s.toFixed(5) + ')';
      els.forEach((el) => estilo(el, { visibility: '', clipPath: clip, transformOrigin: ox.toFixed(2) + 'px ' + oy.toFixed(2) + 'px', transform: tr }));
    }
    const callar = d !== 'camara';
    if (E.callado !== callar) { E.callado = callar; caja.classList.toggle('gr-callado', callar); }
    VISTA.dibujar(E.fondo, E.frente, { t, piezas: E.piezas, titulos: E.prep.titulos });
    avisar(caja, textoAviso());
    return true;
  }
  /* Devolver el celular como estaba (otro estilo, otro video o mientras llega el plan) */
  function soltar() {
    avisar(null, '');
    if (!E.tocados.length && !E.fondo) return;
    E.tocados.forEach((el) => { el.style.visibility = ''; el.style.clipPath = ''; el.style.transform = ''; el.style.transformOrigin = ''; });
    E.tocados = [];
    if (E.caja && E.callado) E.caja.classList.remove('gr-callado');
    E.callado = null;
    if (E.fondo && window.CherryCVVista) { window.CherryCVVista.quitar(E.fondo); window.CherryCVVista.quitar(E.frente); }
    if (E.fondo) { E.fondo.remove(); E.frente.remove(); E.fondo = E.frente = null; }
  }

  /* Para la pestaña Gráficos: en qué va el plan */
  function estado() {
    if (!E.id) return { texto: 'La Cámara viva se arma cuando tu video está cortado.' };
    if (E.error) return { texto: E.error, error: true };
    if (!E.plan) return { texto: 'Cherry está armando tu edición: cuándo hablas tú y cuándo va una lámina. Tarda como 1 minuto y medio; en el celular ves cuánto falta.', cargando: true };
    const ms = E.plan.momentos || [], lam = ms.filter((m) => m.tipo === 'lamina');
    const img = lam.filter((m) => m.objeto && m.objeto.tipo === 'imagen' && !m.objeto.img).length;
    return { texto: lam.length + ' láminas y ' + (ms.length - lam.length) + ' momentos en que hablas tú.' +
      (img ? ' ' + img + (img === 1 ? ' lámina pide una imagen' : ' láminas piden una imagen') + ': mientras no la tengan, va tu video en el recuadro.' : ''),
      plan: E.plan };
  }

  C.cvVivo = { disponible, activo, cuadro, soltar, estado, FONDOS };
})();

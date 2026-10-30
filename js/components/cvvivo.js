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
  const VISTA_JS = 'js/vista-cv.js?v=20261029mov5', CARAS_JS = 'js/caras.js?v=20261029cv1';
  const CADA_MS = 6000;     // cada cuánto se pregunta por el plan mientras el director trabaja (≈ 90 s)
  const TARDA_S = 95;       // lo que tarda el director (medido: 89 a 97 s): la cuenta de la etiqueta del celular
  const CARAS_X = 1.3;      // buscar la cara tarda ≈ 1,3 s por segundo de video (2 min → 149 s en un computador sin tarjeta)
  /* los fondos de las láminas que se ofrecen (la pestaña Gráficos de Automático y la del Manual) */
  const FONDOS = [
    { id: '', name: 'Crema', hex: '#ECE4D6' }, { id: '#f4f2ee', name: 'Blanco', hex: '#F4F2EE' },
    { id: '#d9d4cc', name: 'Piedra', hex: '#D9D4CC' }, { id: '#1c1b1e', name: 'Noche', hex: '#1C1B1E' },
  ];

  const E = { id: null, plan: null, avisos: [], estado: '', error: '', proxima: 0, pidiendo: false, eta: null, etaCaras: null,
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
    if (E.eta) E.eta.parar();
    if (E.etaCaras) E.etaCaras.parar();
    Object.assign(E, { id, plan: null, avisos: [], estado: 'pidiendo', error: '', proxima: 0, caras: null, carasId: null, clave: '', foto: null,
      eta: window.CherryEta ? window.CherryEta.empezar('cv_plan', TARDA_S) : null, etaCaras: null });
  }
  /* El plan: se pregunta cada 6 s mientras el director trabaja. Con el plan llegan también las caras, si ya se guardaron. */
  function pedirPlan() {
    if (E.pidiendo || E.plan || E.error || Date.now() < E.proxima || !E.id) return;
    E.pidiendo = true;
    const id = E.id;
    C.api.edgeFetch('camara-viva', { accion: 'plan', render_id: id }, true, 30000).then((r) => {
      if (E.id !== id) return;
      if (r && r.plan) {
        if (E.eta) { E.eta.parar(); E.eta = null; }
        E.plan = r.plan; E.avisos = r.avisos || []; E.estado = 'listo'; E.clave = '';
        if (Array.isArray(r.caras) && r.caras.length) { E.caras = r.caras; E.carasId = id; }
        C.render();
      } else if (r && r.error) { if (E.eta) { E.eta.parar(); E.eta = null; } E.error = r.error; E.estado = 'error'; C.render(); }
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
    E.etaCaras = window.CherryEta ? window.CherryEta.empezar('cv_caras', CARAS_X, Number(ctx.video.duration) || 60) : null;
    C.render();                                       // la etiqueta del celular pasa a «ubicando tu cara»
    const id = E.id;
    cargarScript(CARAS_JS).then(() => window.CherryCaras.detectar(src, { cada: 0.25, alAvanzar: (f) => { E.avance = f; } })).then((lista) => {
      if (E.id !== id) return;
      if (E.etaCaras) { E.etaCaras.fin(); E.etaCaras = null; }
      E.caras = lista; E.carasId = id; E.clave = '';
      C.render();
      return C.api.edgeFetch('camara-viva', { accion: 'caras', render_id: id, caras: lista, version: window.CherryCaras.VERSION }, true, 30000);
    }).catch((e) => {
      console.warn('[Cámara viva] caras', e);
      if (E.etaCaras) { E.etaCaras.parar(); E.etaCaras = null; }
      if (E.id === id) E.carasId = id;   // sin cara: los títulos van arriba (no se insiste en cada cuadro)
    }).finally(() => { E.buscando = false; C.render(); });
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
    if (!E.fondo) {
      E.fondo = capa('cv-capa--fondo'); E.frente = capa('cv-capa--frente');
      // el marco: franjas negras alrededor del cuadro (lo que la cámara agranda no se asoma fuera de él, como en el video final)
      E.marco = document.createElement('div'); E.marco.className = 'cv-marco'; E.marco.setAttribute('aria-hidden', 'true');
      E.marco.style.cssText = 'position:absolute;pointer-events:none;box-shadow:0 0 0 4000px #000';
    }
    const els = ctx.elementos.filter(Boolean);
    if (E.fondo.parentNode !== caja || E.fondo.nextSibling !== els[0]) caja.insertBefore(E.fondo, els[0]);
    let despues = null;
    for (const el of caja.children) if (els.indexOf(el) >= 0) despues = el;
    if (despues && despues.nextSibling !== E.frente) caja.insertBefore(E.frente, despues.nextSibling);
    if (E.frente.nextSibling !== E.marco) caja.insertBefore(E.marco, E.frente.nextSibling);
    E.caja = caja;
  }
  /* El cuadro del video dentro de su caja (object-fit: cover), como movvivo › cuadroVideo */
  function cuadroVideo(caja, video) {
    const We = caja.clientWidth, He = caja.clientHeight, vw = video.videoWidth || 1080, vh = video.videoHeight || 1920;
    const k = Math.max(We / vw, He / vh);
    return { We, He, W: vw * k, H: vh * k, x: (We - vw * k) / 2, y: (He - vh * k) / 2 };
  }
  function estilo(el, o) { for (const k in o) if (el.style[k] !== o[k]) el.style[k] = o[k]; }

  /* Lo que dice la etiqueta «Vista previa» del celular (cortesvivo › etiquetaTexto) mientras la Cámara viva no está lista,
     con la cuenta regresiva de siempre (js/eta.js). Sergio, 29-oct: «no se entiende qué está pasando»; y nada de globos aparte. */
  function etiqueta() {
    if (!activo() || !E.id) return null;
    if (E.error) return { texto: 'la Cámara viva no se pudo armar' };
    if (!E.plan) return { texto: 'armando tu Cámara viva', eta: E.eta };
    if (E.buscando) return { texto: 'ubicando tu cara para los títulos', eta: E.etaCaras };
    return null;
  }

  /* Un cuadro: dónde va tu video (su cámara, el hueco o nada) y las láminas encima. true = el celular lo maneja la Cámara viva */
  function cuadro(ctx) {
    if (!ctx || !ctx.video || !C.api) { soltar(); return false; }
    const id = idDe(ctx);
    if (id !== E.id) nuevoVideo(id);
    pedirPlan();
    if (!E.plan) { soltar(); return false; }          // mientras llega el plan: tu video tal cual (la etiqueta dice cuánto falta)
    buscarCaras(ctx);
    fotoDe(ctx.video);
    if (!window.CherryCVVista) { cargarScript(VISTA_JS).catch((e) => console.warn('[Cámara viva] vista', e)); return false; }
    const VISTA = window.CherryCVVista, caja = ctx.video.parentNode;
    if (!caja) return false;
    armar(ctx);
    ponerCapas(caja, ctx);
    /* el CUADRO ENTERO en el celular (Sergio, 29-oct: en Cherry los movimientos «no se hacen los mismos»): el celular es
       más alto que 9:16 y el video lo cubría recortado de los lados, justo donde la cámara viva te corre y pone tu título.
       Tus elementos ocupan el cuadro completo (como movvivo › agrandar) y todo se encoge f alrededor del centro de la caja:
       franjas finas arriba y abajo, y la misma cuenta del video final. */
    const q = cuadroVideo(caja, ctx.video), k = q.W / 1080, f = Math.min(1, q.We / q.W, q.He / q.H), mx = q.We / 2, my = q.He / 2;
    const n = (x) => x.toFixed(2);
    const capaT = 'translate(' + n(mx + f * (q.x - mx)) + 'px,' + n(my + f * (q.y - my)) + 'px) scale(' + (k * f).toFixed(5) + ')';
    estilo(E.fondo, { transform: capaT }); estilo(E.frente, { transform: capaT });
    estilo(E.marco, { left: n(mx + f * (q.x - mx)) + 'px', top: n(my + f * (q.y - my)) + 'px', width: n(q.W * f) + 'px', height: n(q.H * f) + 'px' });
    const t = Number(ctx.video.currentTime) || 0;
    const d = VISTA.videoEn(t, E.piezas);
    const els = ctx.elementos.filter(Boolean);
    els.forEach((el) => { if (E.tocados.indexOf(el) < 0) E.tocados.push(el); });
    // en coordenadas del elemento (que ahora ES el cuadro): primero el encaje en el celular, después la cámara o el hueco
    const caja0 = { width: n(q.W) + 'px', height: n(q.H) + 'px', left: n(q.x) + 'px', top: n(q.y) + 'px', transformOrigin: '0 0' };
    const cx0 = mx - q.x, cy0 = my - q.y;
    const encaje = 'translate(' + n(cx0) + 'px,' + n(cy0) + 'px) scale(' + f.toFixed(5) + ') translate(' + n(-cx0) + 'px,' + n(-cy0) + 'px)';
    if (d === null) els.forEach((el) => estilo(el, { visibility: 'hidden' }));
    else if (d === 'camara') {
      const v = MOV.valor(E.camara, t), ax = MOV.ANCLA.x * q.W, ay = MOV.ANCLA.y * q.H;   // lo mismo que MOV.css alrededor del ANCLA
      const tr = encaje + ' translate(' + n(ax + v.dx * q.W) + 'px,' + n(ay + v.dy * q.H) + 'px) scale(' + v.s.toFixed(5) + ') translate(' + n(-ax) + 'px,' + n(-ay) + 'px)';
      els.forEach((el) => estilo(el, Object.assign({ visibility: '', clipPath: '', transform: tr }, caja0)));
    } else {
      /* en el hueco de la lámina: el cuadro entero se lleva al hueco (cubriéndolo, con su giro) y se recorta con sus esquinas
         redondas. El recorte va en el cuadro SIN mover (clip-path) y el transform lo lleva con él, como el marco del banco */
      const s = Math.max(d.width / 1080, d.height / 1920), cx = d.left + d.width / 2, cy = d.top + d.height / 2;
      const ox = 540 * k, oy = 960 * k, mw = d.width / s / 2 * k, mh = d.height / s / 2 * k;
      const clip = 'inset(' + n(oy - mh) + 'px ' + n(q.W - ox - mw) + 'px ' + n(q.H - oy - mh) + 'px ' + n(ox - mw) + 'px round ' + n(d.radio / s * k) + 'px)';
      const tr = encaje + ' translate(' + n(ox + (cx - 540) * k) + 'px,' + n(oy + (cy - 960) * k) + 'px) rotate(' + (d.rot || 0) + 'deg) scale(' + s.toFixed(5) +
        ') translate(' + n(-ox) + 'px,' + n(-oy) + 'px)';
      els.forEach((el) => estilo(el, Object.assign({ visibility: '', clipPath: clip, transform: tr }, caja0)));
    }
    const callar = d !== 'camara';
    if (E.callado !== callar) { E.callado = callar; caja.classList.toggle('gr-callado', callar); }
    VISTA.dibujar(E.fondo, E.frente, { t, piezas: E.piezas, titulos: E.prep.titulos });
    return true;
  }
  /* Devolver el celular como estaba (otro estilo, otro video o mientras llega el plan) */
  function soltar() {
    if (!E.tocados.length && !E.fondo) return;
    E.tocados.forEach((el) => {
      el.style.visibility = ''; el.style.clipPath = ''; el.style.transform = ''; el.style.transformOrigin = '';
      el.style.width = ''; el.style.height = ''; el.style.left = ''; el.style.top = '';
    });
    E.tocados = [];
    if (E.caja && E.callado) E.caja.classList.remove('gr-callado');
    E.callado = null;
    if (E.fondo && window.CherryCVVista) { window.CherryCVVista.quitar(E.fondo); window.CherryCVVista.quitar(E.frente); }
    if (E.fondo) { E.fondo.remove(); E.frente.remove(); E.marco.remove(); E.fondo = E.frente = E.marco = null; }
  }

  /* Para la pestaña Gráficos: en qué va el plan */
  function estado() {
    if (!E.id) return { texto: 'La Cámara viva se arma cuando tu video está cortado.' };
    if (E.error) return { texto: E.error, error: true };
    if (!E.plan) return { texto: 'Cherry está armando tu edición: cuándo hablas tú y cuándo va una lámina. Tarda como 1 minuto y medio; arriba del celular ves cuánto falta.', cargando: true };
    const ms = E.plan.momentos || [], lam = ms.filter((m) => m.tipo === 'lamina');
    const img = lam.filter((m) => m.objeto && m.objeto.tipo === 'imagen' && !m.objeto.img).length;
    return { texto: lam.length + ' láminas y ' + (ms.length - lam.length) + ' momentos en que hablas tú.' +
      (img ? ' ' + img + (img === 1 ? ' lámina pide una imagen' : ' láminas piden una imagen') + ': mientras no la tengan, va tu video en el recuadro.' : ''),
      plan: E.plan };
  }

  C.cvVivo = { disponible, activo, cuadro, soltar, estado, etiqueta, FONDOS };
})();

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
              imagenes: {}, trabajos: {}, avisosImg: {}, avisoImg: '', desc: {}, refs: [], ficha: null, pidiendoFicha: false, sinSubir: {},
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
      imagenes: {}, trabajos: {}, avisosImg: {}, avisoImg: '', desc: {}, sinSubir: {},
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
        E.plan = r.plan; E.avisos = r.avisos || []; E.estado = 'listo'; E.clave = ''; E.imagenes = r.imagenes || {};
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
  /* Lo que va en cada lámina: su imagen (armar la deja en objeto.img) o, si no hay, tu video en el recuadro */
  function material(m) {
    const o = m.objeto || {};
    if (o.tipo === 'imagen') return o.img ? { objeto: o.img } : {};
    if (o.tipo === 'grafico') return E.foto ? { foto: E.foto } : {};
    return {};
  }
  /* El plan en segundos del video que se ve (el reloj real de la base: cada corte se recorta un poco) */
  function armar(ctx) {
    const sinImg = estiloImg() === 'sin';
    const clave = E.id + '|' + (E.caras ? E.caras.length : 0) + '|' + (C.state.grafFondoCV || '') + '|' + (E.foto ? 1 : 0) + '|' + (ctx.duraciones || []).join(',') +
      '|' + (sinImg ? 'sin' : Object.keys(E.imagenes).map((k) => k + ':' + E.imagenes[k].key).join(','));
    if (clave === E.clave && E.piezas) return;
    E.clave = clave;
    const aR = typeof ctx.aReal === 'function' ? ctx.aReal : (t) => t;
    // las MISMAS palabras que recibió el director (él descarta las vacías y numera sin ellas)
    const pal = (ctx.palabras || []).filter((p) => p && String(p.word || '').trim())
      .map((p) => ({ word: p.word, start: aR(Number(p.start)), end: aR(Number(p.end)) }));
    const plan = Object.assign({}, E.plan, { fondo: C.state.grafFondoCV || null,
      momentos: (E.plan.momentos || []).map((m, i) => {
        const im = !sinImg && m.tipo === 'lamina' && m.objeto && m.objeto.tipo !== 'grafico' ? E.imagenes[i] : null;
        return Object.assign({}, m, { t0: aR(Number(m.t0)), t1: aR(Number(m.t1)) }, im ? { objeto: Object.assign({}, m.objeto, { tipo: 'imagen', img: im.url }) } : {});
      }) });
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
    return true;
  }
  /* Devolver el celular como estaba (otro estilo, otro video o mientras llega el plan) */
  function soltar() {
    if (!E.tocados.length && !E.fondo) return;
    E.tocados.forEach((el) => { el.style.visibility = ''; el.style.clipPath = ''; el.style.transform = ''; el.style.transformOrigin = ''; });
    E.tocados = [];
    if (E.caja && E.callado) E.caja.classList.remove('gr-callado');
    E.callado = null;
    if (E.fondo && window.CherryCVVista) { window.CherryCVVista.quitar(E.fondo); window.CherryCVVista.quitar(E.frente); }
    if (E.fondo) { E.fondo.remove(); E.frente.remove(); E.fondo = E.frente = null; }
  }

  /* ══ LAS IMÁGENES DE TU VIDEO (30-oct) ══ El estilo se escoge en CADA video (Sergio, 29-oct: nunca por marca): viene marcado
     el último que usó y el primero arranca en Editorial (la ficha). Cada lámina: crear con Nano Banana (1 crédito; si falla, no
     se cobra), «otra versión», subir la tuya o dejar tu video en el recuadro. Las que el director dejó con tu video no traen
     descripción: la persona escribe qué debe verse. Lo creado llega sobre verde: aquí se recorta y se sube. */
  const CLAVE_ESTILO = 'cherry-cv-estilo', VERDE_LADO = 1400, A_LA_VEZ = 2;
  function pedirFicha() {
    if (E.ficha || E.pidiendoFicha) return;
    E.pidiendoFicha = true;
    fetch('estilos/camara-viva/ficha.json?v=20261030img').then((r) => r.json()).then((f) => { E.ficha = f; C.render(); })
      .catch((e) => console.warn('[Cámara viva] ficha', e)).finally(() => { E.pidiendoFicha = false; });
  }
  function estiloImg() {
    if (C.state.cvEstiloImg) return C.state.cvEstiloImg;
    let v = null;
    try { v = localStorage.getItem(CLAVE_ESTILO); } catch (_) { /* sin almacenamiento */ }
    return v || (E.ficha && E.ficha.imagenes && E.ficha.imagenes.estilo_defecto) || 'editorial';
  }
  /* (30-oct) CTRL + Z. Sergio: «como normalmente funcionaría un programa de edición». Cada cambio le avisa al historial del Manual
     (C.cvVivo.alCambiar) con lo que había antes: una imagen de una lámina o los ajustes. Deshacer vuelve a poner eso y el
     archivo sigue ahí: nunca se borra, así que deshacer no cuesta créditos. */
  const AJUSTES = ['grafOn', 'grafEstilo', 'grafFondoCV', 'cvEstiloImg'];
  const fotoAjustes = () => { const o = {}; AJUSTES.forEach((k) => { o[k] = C.state[k]; }); return o; };
  const fotoImagen = (i) => { const im = E.imagenes[i]; return im ? { key: im.key, estilo: im.estilo, origen: im.origen, desc: im.desc } : null; };
  const anotar = (cambio) => { if (C.cvVivo.alCambiar) C.cvVivo.alCambiar(Object.assign({ fila: E.id }, cambio)); };
  function cambiarAjustes(patch) { anotar({ ajustes: fotoAjustes() }); E.clave = ''; E.avisoImg = ''; C.setState(patch); }
  /* Vuelve a como estaba `c` y devuelve cómo estaba justo antes (para rehacer). null = ya no se puede */
  async function deshacer(c) {
    if (c.ajustes) { const hoy = fotoAjustes(); E.clave = ''; C.setState(c.ajustes); return { fila: c.fila, ajustes: hoy }; }
    if (c.fila !== E.id || E.trabajos[c.i]) return null;
    const hoy = { fila: c.fila, i: c.i, imagen: fotoImagen(c.i) }, im = c.imagen;
    const g = await C.api.edgeFetch('camara-viva', im ? { accion: 'guardar_imagen', render_id: E.id, momento: c.i, key: im.key, estilo: im.estilo, origen: im.origen, desc: im.desc }
      : { accion: 'quitar_imagen', render_id: E.id, momento: c.i }, true, 30000);
    if (!g || !g.imagenes) throw new Error((g && g.error) || 'no se pudo');
    E.imagenes = g.imagenes; E.clave = ''; delete E.avisosImg[c.i];
    C.render();
    return hoy;
  }
  function ponerEstiloImg(id) {
    if (id !== 'ref' && id !== 'sin') try { localStorage.setItem(CLAVE_ESTILO, id); } catch (_) { /* nada */ }
    cambiarAjustes({ cvEstiloImg: id });
  }
  /* Las láminas que pueden llevar imagen, en el orden del video (un gráfico no) */
  function laminasImg() {
    return ((E.plan && E.plan.momentos) || []).map((m, i) => ({ m, i })).filter((x) => x.m.tipo === 'lamina' && x.m.objeto && x.m.objeto.tipo !== 'grafico')
      .map((x) => ({ i: x.i, m: x.m, pide: x.m.objeto.tipo === 'imagen', img: E.imagenes[x.i] || null, trabajo: E.trabajos[x.i] || null, aviso: E.avisosImg[x.i] || '' }));
  }
  const descDe = (l) => String(E.desc[l.i] != null ? E.desc[l.i] : (l.img && l.img.desc) || '').trim();
  /* Lo que falta crear: las que piden imagen y no tienen, o la tienen en otro estilo (las que subió la persona se respetan) */
  function faltanImg() {
    const est = estiloImg();
    if (est === 'sin') return [];
    return laminasImg().filter((l) => l.pide && !l.trabajo && (!l.img || (l.img.origen !== 'tuya' && l.img.estilo !== est)));
  }
  /* El recorte por fondo verde: lo mismo que herramientas/chroma.py (el verde manda la transparencia, fuera las motas sueltas
     y el reflejo verde de los bordes). Devuelve un PNG sin márgenes. */
  async function recortarVerde(blob) {
    const bm = await createImageBitmap(blob);
    const e = Math.min(1, VERDE_LADO / Math.max(bm.width, bm.height)), w = Math.round(bm.width * e), hh = Math.round(bm.height * e);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bm, 0, 0, w, hh);
    if (bm.close) bm.close();
    const im = g.getImageData(0, 0, w, hh), d = im.data, n = w * hh, alfa = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = d[i * 4 + 1] - Math.max(d[i * 4], d[i * 4 + 2]);
      alfa[i] = 1 - Math.min(1, Math.max(0, (x - 25) / 65));
      if (x > 0) d[i * 4 + 1] = Math.max(d[i * 4], d[i * 4 + 2]);
    }
    // la figura: las manchas de al menos 2 % de la más grande (y 3 px alrededor)
    const lab = new Int32Array(n), pila = new Int32Array(n), areas = [0];
    for (let i = 0; i < n; i++) {
      if (lab[i] || alfa[i] <= 0.5) continue;
      const id = areas.length; let t = 0, a = 0;
      lab[i] = id; pila[t++] = i;
      while (t) {
        const q = pila[--t], x = q % w; a++;
        for (const v of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (v >= 0 && v < n && !lab[v] && alfa[v] > 0.5) { lab[v] = id; pila[t++] = v; }
      }
      areas.push(a);
    }
    const mayor = Math.max(0, ...areas);
    let mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (lab[i] && areas[lab[i]] >= mayor * 0.02) mask[i] = 1;
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const m2 = mask.slice();
      for (let i = 0; i < n; i++) if (mask[i]) { const x = i % w; if (x > 0) m2[i - 1] = 1; if (x < w - 1) m2[i + 1] = 1; if (i >= w) m2[i - w] = 1; if (i + w < n) m2[i + w] = 1; }
      mask = m2;
    }
    // borde suave (gaussiana de 0,5 px) y el PNG sin márgenes
    const P = [0.1065, 0.787, 0.1065], a1 = new Float32Array(n);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, f = (k) => (mask[k] ? alfa[k] : 0);
      a1[i] = P[0] * f(x > 0 ? i - 1 : i) + P[1] * f(i) + P[2] * f(x < w - 1 ? i + 1 : i);
    }
    let x0 = w, y0 = hh, x1 = -1, y1 = -1;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = P[0] * a1[y > 0 ? i - w : i] + P[1] * a1[i] + P[2] * a1[y < hh - 1 ? i + w : i], b = Math.round(v * 255);
      d[i * 4 + 3] = b;
      if (b > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) throw new Error('la imagen salió vacía');
    g.putImageData(im, 0, 0);
    const c2 = document.createElement('canvas'); c2.width = x1 - x0 + 1; c2.height = y1 - y0 + 1;
    c2.getContext('2d').drawImage(cv, -x0, -y0);
    return new Promise((ok, mal) => c2.toBlob((b) => (b ? ok(b) : mal(new Error('no se pudo armar el PNG'))), 'image/png'));
  }
  async function subirYGuardar(id, i, blob, tipo, estilo, origen, desc) {
    const s = await C.api.edgeFetch('camara-viva', { accion: 'subir_imagen', render_id: id, tipo }, true, 30000);
    if (!s || !s.put) throw new Error((s && s.error) || 'no dio dónde subirla');
    let r = await fetch(s.put, { method: 'PUT', headers: { 'Content-Type': tipo }, body: blob }).catch(() => null);
    if (!r || !r.ok) r = await fetch(s.put_r, { method: 'PUT', headers: { 'Content-Type': tipo }, body: blob }).catch(() => null);
    if (!r || !r.ok) throw new Error('no se pudo subir la imagen');
    const antes = fotoImagen(i);
    const g = await C.api.edgeFetch('camara-viva', { accion: 'guardar_imagen', render_id: id, momento: i, key: s.key, estilo, origen, desc }, true, 30000);
    if (!g || !g.imagenes) throw new Error((g && g.error) || 'no se pudo guardar');
    if (E.id === id) { anotar({ i, imagen: antes }); E.imagenes = g.imagenes; E.clave = ''; }
  }
  async function crearUna(l) {
    const est = estiloImg(), id = E.id, i = l.i, desc = descDe(l);
    if (est === 'sin' || E.trabajos[i]) return;
    if (!l.pide && !desc) { E.avisosImg[i] = 'Escribe qué debe verse'; C.render(); return; }
    if (est === 'ref' && !E.refs.length) { E.avisoImg = 'Sube primero de 1 a 3 imágenes de referencia.'; C.render(); return; }
    // ya se creó (y se pagó) pero no se pudo guardar: se reintenta con esa misma, sin volver a llamar al modelo
    const lista = E.sinSubir[i] && E.sinSubir[i].est === est && (!desc || E.sinSubir[i].desc === desc) ? E.sinSubir[i] : null;
    const eta = !lista && window.CherryEta ? window.CherryEta.empezar('cv_img', 28) : null;
    E.trabajos[i] = lista ? { texto: 'Guardando…' } : { eta }; delete E.avisosImg[i]; C.render();
    try {
      if (lista) {
        await subirYGuardar(id, i, lista.png, 'image/png', est, 'cherry', lista.desc);
        delete E.sinSubir[i];
        delete E.trabajos[i];
        C.render();
        return;
      }
      const r = await C.api.edgeFetch('camara-viva', { accion: 'imagen', render_id: id, momento: i, estilo: est, descripcion: desc || undefined,
        referencias: est === 'ref' ? E.refs.map((x) => ({ mime: x.mime, datos: x.datos })) : undefined }, true, 150000);
      if (!r || !r.datos) throw new Error((r && r.error) || 'No salió la imagen.');
      const bin = atob(r.datos), bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      const png = await recortarVerde(new Blob([bytes], { type: r.mime || 'image/png' }));
      E.sinSubir[i] = { png, est, desc: r.desc || desc };
      await subirYGuardar(id, i, png, 'image/png', est, 'cherry', r.desc || desc);
      delete E.sinSubir[i];
      if (eta) eta.fin();
    } catch (e) {
      console.warn('[Cámara viva] imagen', e);
      if (eta) eta.parar();
      if (E.id === id) E.avisosImg[i] = E.sinSubir[i] ? 'Se creó, pero no se pudo guardar. Toca «Crear» otra vez: no se cobra de nuevo.' : String((e && e.message) || e).slice(0, 140);
    }
    delete E.trabajos[i];
    C.render();
  }
  async function crearFaltan() {
    const cola = faltanImg();
    await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, cola.length) }, async () => { while (cola.length) await crearUna(cola.shift()); }));
  }
  /* Tu imagen: tal cual (con transparencia, PNG; si no, JPG). Si viene sobre verde, se recorta. Máx. 1600 px */
  async function subirTuya(l, archivo) {
    if (!archivo || !/^image\//.test(archivo.type)) { E.avisosImg[l.i] = 'Eso no es una imagen.'; C.render(); return; }
    const id = E.id, i = l.i;
    E.trabajos[i] = { texto: 'Subiendo…' }; delete E.avisosImg[i]; C.render();
    try {
      const bm = await createImageBitmap(archivo);
      const e = Math.min(1, 1600 / Math.max(bm.width, bm.height)), cv = document.createElement('canvas');
      cv.width = Math.round(bm.width * e); cv.height = Math.round(bm.height * e);
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0, cv.width, cv.height);
      if (bm.close) bm.close();
      const d = g.getImageData(0, 0, cv.width, cv.height).data, px = (x, y) => (y * cv.width + x) * 4;
      const esq = [px(0, 0), px(cv.width - 1, 0), px(0, cv.height - 1), px(cv.width - 1, cv.height - 1)];
      const verde = esq.every((p) => d[p + 1] - Math.max(d[p], d[p + 2]) > 60), trans = esq.some((p) => d[p + 3] < 250);
      let blob;
      if (verde) blob = await recortarVerde(archivo);
      else blob = await new Promise((ok) => cv.toBlob(ok, trans ? 'image/png' : 'image/jpeg', 0.9));
      await subirYGuardar(id, i, blob, blob.type, 'tuya', 'tuya', '');
    } catch (e) {
      console.warn('[Cámara viva] subir', e);
      if (E.id === id) E.avisosImg[i] = String((e && e.message) || e).slice(0, 140);
    }
    delete E.trabajos[i];
    C.render();
  }
  async function dejarVideo(l) {
    const id = E.id, i = l.i;
    E.trabajos[i] = { texto: 'Quitando…' }; C.render();
    const antes = fotoImagen(i);
    try {
      const g = await C.api.edgeFetch('camara-viva', { accion: 'quitar_imagen', render_id: id, momento: i }, true, 30000);
      if (g && g.imagenes && E.id === id) { anotar({ i, imagen: antes }); E.imagenes = g.imagenes; E.clave = ''; }
    } catch (e) { E.avisosImg[i] = 'No se pudo quitar. Inténtalo otra vez.'; }
    delete E.trabajos[i];
    C.render();
  }
  /* Las referencias: pequeñas (máx. 1024 px, JPG), solo mientras la página esté abierta */
  async function ponerRefs(archivos) {
    const nuevas = [];
    for (const a of Array.from(archivos || []).slice(0, 3)) {
      if (!/^image\//.test(a.type)) continue;
      const bm = await createImageBitmap(a), e = Math.min(1, 1024 / Math.max(bm.width, bm.height)), cv = document.createElement('canvas');
      cv.width = Math.round(bm.width * e); cv.height = Math.round(bm.height * e);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bm, 0, 0, cv.width, cv.height);
      if (bm.close) bm.close();
      const url = cv.toDataURL('image/jpeg', 0.85);
      nuevas.push({ mime: 'image/jpeg', datos: url.split(',')[1], url });
    }
    E.refs = nuevas; E.avisoImg = '';
    C.render();
  }
  /* Para saber si hay que volver a pintar el panel */
  const firmaImagenes = () => JSON.stringify([estiloImg(), !!E.ficha, !!E.verTodas, E.avisoImg, E.refs.length, Object.keys(E.trabajos), E.avisosImg,
    laminasImg().map((l) => (l.img ? l.img.key + l.img.estilo : ''))]);

  const ICONOS = { video: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M10 9.5v5l4-2.5z"/>', subir: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>' };
  const icono = (n) => C.h('span', { class: 'cvi-ic', html: '<svg viewBox="0 0 24 24">' + ICONOS[n] + '</svg>' });
  function panelImagenes() {
    const h = C.h;
    pedirFicha();
    if (!E.plan) return null;
    const est = estiloImg(), estilos = (E.ficha && E.ficha.imagenes && E.ficha.imagenes.estilos) || [], falta = faltanImg();
    const todas = laminasImg(), piden = todas.filter((l) => l.pide || l.img), otras = todas.filter((l) => !l.pide && !l.img);
    const ls = E.verTodas || !piden.length ? piden.concat(otras) : piden;
    const chip = (id, nombre, mini, sub) => h('button', { type: 'button', class: 'cvi-estilo', 'aria-pressed': String(est === id), onClick: () => ponerEstiloImg(id) },
      h('span', { class: 'cvi-estilo-mini' }, mini), h('span', null, nombre, sub ? h('small', null, sub) : null));
    const eligeArchivo = (fn, multi) => h('input', Object.assign({ type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true,
      onChange: (ev) => { const f = ev.target.files; if (f && f.length) fn(f); ev.target.value = ''; } }, multi ? { multiple: true } : {}));
    return h('div', { class: 'cvi' },
      h('div', { class: 'cvi-cab' }, h('b', null, 'Las imágenes de tu video'),
        est !== 'sin' && falta.length ? h('button', { type: 'button', class: 'cvi-crear', onClick: crearFaltan }, 'Crear ' + (falta.length === 1 ? 'la imagen · 1 crédito' : 'las ' + falta.length + ' imágenes · ' + falta.length + ' créditos')) : null),
      h('div', { class: 'cvi-estilos', role: 'group', 'aria-label': 'Estilo de las imágenes' },
        estilos.map((e) => chip(e.id, e.nombre, h('img', { src: e.muestra, alt: '' }))),
        chip('ref', 'Igual a esta referencia', icono('subir'), 'De 1 a 3 imágenes'),
        chip('sin', 'Sin imágenes', icono('video'), 'Gratis')),
      est === 'ref' ? h('label', { class: 'cvi-refs' }, eligeArchivo(ponerRefs, true),
        E.refs.length ? E.refs.map((x) => h('img', { src: x.url, alt: 'Referencia' })) : null, h('span', { class: 'cvi-boton' }, E.refs.length ? 'Cambiar las referencias' : 'Subir referencias')) : null,
      est === 'sin' ? h('p', { class: 'cvi-nota' }, 'Las láminas llevan tu video en el recuadro. No gasta créditos.') : null,
      E.avisoImg ? h('p', { class: 'cvi-nota cvi-nota--ojo' }, E.avisoImg) : null,
      est === 'sin' ? null : h('div', { class: 'cvi-laminas' }, ls.map((l) => {
        const tx = l.m.texto || {}, ocupado = !!l.trabajo;
        return h('div', { class: 'cvi-lamina' + (ocupado ? ' cvi-lamina--ocupada' : '') },
          h('div', { class: 'cvi-mini' }, l.img ? h('img', { src: l.img.url, alt: '' }) : h('span', { class: 'cvi-mini-video' }, icono('video'), 'Tu video'),
            ocupado ? h('span', { class: 'cvi-haciendo' }, h('span', { class: 'spinner' }), l.trabajo.eta ? h('small', { 'data-eta': l.trabajo.eta.id }, l.trabajo.eta.texto()) : h('small', null, l.trabajo.texto || '')) : null),
          h('b', null, [tx.chica, tx.gruesa].filter(Boolean).join(' ')),
          l.pide && l.m.objeto.es ? h('small', null, l.m.objeto.es) : null,
          !l.pide && !l.img ? h('input', { type: 'text', class: 'cvi-desc', maxlength: '200', placeholder: 'Qué debe verse', 'aria-label': 'Qué debe verse en esta imagen',
            value: E.desc[l.i] || '', onInput: (ev) => { E.desc[l.i] = ev.target.value; } }) : null,
          l.aviso ? h('small', { class: 'cvi-ojo' }, l.aviso) : null,
          h('div', { class: 'cvi-acciones' },
            h('button', { type: 'button', class: 'cvi-boton', disabled: ocupado || undefined, onClick: () => crearUna(l) }, l.img ? 'Otra versión' : 'Crear'),
            h('label', { class: 'cvi-boton' + (ocupado ? ' cvi-boton--off' : '') }, eligeArchivo((f) => subirTuya(l, f[0])), 'Subir'),
            l.img ? h('button', { type: 'button', class: 'cvi-boton', disabled: ocupado || undefined, onClick: () => dejarVideo(l) }, 'Tu video') : null));
      })),
      est === 'sin' || !otras.length || !piden.length ? null : h('button', { type: 'button', class: 'cvi-boton cvi-mas', onClick: () => { E.verTodas = !E.verTodas; C.render(); } },
        E.verTodas ? 'Ver solo las que piden imagen' : (otras.length === 1 ? 'Ponerle imagen a la otra lámina' : 'Ponerle imagen a las otras ' + otras.length + ' láminas')),
      est === 'sin' ? null : h('p', { class: 'cvi-nota' }, '1 crédito por imagen creada (también «Otra versión»); si falla, no se cobra. Subir la tuya es gratis.'));
  }

  /* Para la pestaña Gráficos: en qué va el plan */
  function estado() {
    if (!E.id) return { texto: 'La Cámara viva se arma cuando tu video está cortado.' };
    if (E.error) return { texto: E.error, error: true };
    if (!E.plan) return { texto: 'Cherry está armando tu edición: cuándo hablas tú y cuándo va una lámina. Tarda como 1 minuto y medio; arriba del celular ves cuánto falta.', cargando: true };
    const ms = E.plan.momentos || [], lam = ms.filter((m) => m.tipo === 'lamina');
    return { texto: lam.length + ' láminas y ' + (ms.length - lam.length) + ' momentos en que hablas tú.', plan: E.plan };
  }

  C.cvVivo = { disponible, activo, cuadro, soltar, estado, etiqueta, FONDOS, panelImagenes, firmaImagenes, recortarVerde, cambiarAjustes, deshacer, alCambiar: null };
})();

/* movvivo.js — el MOVIMIENTO de cámara EN VIVO en el celular (19-sep-2026). También las escenas de apoyo y los GRÁFICOS
 * (graficos.js, el mismo archivo del ensamblador: un <canvas> encima del video y, en pantalla partida o completa, el video
 * se encoge con un transform que va DELANTE del del movimiento, igual que en el video final).
 *
 * Cuando el celular muestra tu video SIN pasada final (la base ya cortada: antes del primer render, o con el
 * módulo Movimiento o Edición abierto), aquí se le aplica el movimiento con un transform de CSS en cada cuadro.
 * El plan sale de movimiento.js — el MISMO archivo que usa el ensamblador — con los mismos cortes y las mismas
 * frases de impacto: lo que se ve es lo que sale. Los subtítulos en vivo no se tocan (en el video final tampoco
 * se mueven).
 *
 * · Antes del primer render: la base adelantada (cortesvivo.js › movFuente).
 * · Con un video ya hecho: su base sin subtítulos (colorvivo.js), con los cortes y frases de ese render.
 * · La vista rápida (clips saltando antes de que llegue la base) no lleva movimiento: todavía no hay cortes finales.
 */
(function () {
  const C = window.CARRETE;
  const MOV = window.CherryMov;
  if (!MOV) return;

  const datos = { id: null, cargando: false, dur: null, impactos: [], apoyo: null, graficos: null, palabras: null, aReal: null };   // cortes, frases y escenas del render que se ve
  const cache = { clave: '', plan: [], cfg: null };
  let tocados = [], sinMov = false, rafId = 0, piezaAntes = null;

  /* Cortes y frases de impacto del render cuya base se está viendo (se piden una vez por render) */
  function cargarRender(id) {
    if (!id || datos.id === id || datos.cargando || !C.api || !C.api.getRenderData) return;
    datos.cargando = true;
    C.api.getRenderData(id).then((d) => {
      datos.cargando = false;
      if (!d) return;
      const segs = (d.segments_json && d.segments_json.segments) || [];
      const nominales = segs.map((g) => Number(g.duration_sec));
      const reales = Array.isArray(d.duraciones_reales) && d.duraciones_reales.length === segs.length ? d.duraciones_reales.map(Number) : null;
      const f = C.frasesDeRender ? C.frasesDeRender(d) : null;
      datos.id = id;
      datos.dur = reales || (nominales.length && nominales.every((x) => x > 0) ? nominales : null);
      datos.impactos = f ? MOV.impactosDe(f.palabras, f.frases, MOV.reloj(nominales, reales || nominales)) : [];
      datos.apoyo = d.apoyo || null;
      datos.graficos = d.graficos || null;
      datos.palabras = (d.subtitle_phrases && d.subtitle_phrases.palabras) || (f && f.palabras) || null;
      datos.aReal = MOV.reloj(nominales, reales || nominales);
      cache.clave = '';
    }).catch(() => { datos.cargando = false; });
  }

  /* ¿Qué se está viendo ahora mismo en el celular? → los elementos a mover, el tiempo y los datos del plan */
  function contexto(s) {
    if (s.pantalla !== 'editor') return null;
    if (C.cortesVivo && C.cortesVivo.listo && C.cortesVivo.listo(s)) {
      return C.cortesVivo.movFuente ? C.cortesVivo.movFuente() : null;
    }
    if (C.colorVivo && C.colorVivo.activo(s) && s.fondoPrevia && s.renderId) {
      cargarRender(s.renderId);
      if (datos.id !== s.renderId || !datos.dur) return null;
      const E = C.colorVivo._estado;
      if (!E || !E.video) return null;
      return { elementos: [E.video, E.lienzo], video: E.video, duraciones: datos.dur, impactos: datos.impactos,
               apoyo: datos.apoyo, graficos: datos.graficos, palabras: datos.palabras, aReal: datos.aReal, id: 'render:' + s.renderId };
    }
    return null;
  }

  function planPara(ctx) {
    const cfg = C.movCfg ? MOV.limpiar(C.movCfg()) : null;
    // (24-sep) mientras hay una pantalla la camara va quieta, igual que en el video final
    const pant = (listaGraficos(ctx) || []).filter((p) => p.pantalla).map((p) => ({ t0: p.t0, t1: p.t1 }));
    const clave = JSON.stringify(cfg) + '|' + ctx.duraciones.join(',') + '|' + ctx.impactos.join(',') + '|' + JSON.stringify(pant);
    if (clave !== cache.clave) {
      cache.clave = clave; cache.cfg = cfg;
      cache.plan = cfg ? MOV.dirigir(MOV.piezasDe(ctx.duraciones), ctx.impactos, cfg) : [];
      if (pant.length && MOV.quieto) cache.plan = MOV.quieto(cache.plan, pant);
    }
    return cache;
  }

  function soltar() {
    tocados.forEach((el) => { if (el) { el.style.transform = ''; el.style.transformOrigin = ''; } });
    tocados = [];
  }

  function cuadro() {
    rafId = requestAnimationFrame(cuadro);
    const s = C.state;
    const ctx = contexto(s);
    ultimoCtx = ctx;
    apoyoCuadro(ctx);
    const antesGraf = grafCuadro(ctx);      // gráficos: capa encima + (en partida/completa) cuánto se encoge el video
    if (!ctx || !ctx.video) { if (tocados.length) soltar(); return; }
    const p = planPara(ctx);
    const els = ctx.elementos.filter(Boolean);
    if (tocados.some((el) => els.indexOf(el) < 0)) soltar();
    const t = Number(ctx.video.currentTime) || 0;
    const v = !sinMov && p.plan.length ? MOV.valor(p.plan, t, p.cfg) : null;
    const tr = [antesGraf, v ? MOV.css(v) : ''].filter(Boolean).join(' ');
    els.forEach((el) => {
      if (tocados.indexOf(el) < 0) { tocados.push(el); el.style.transformOrigin = (MOV.ANCLA.x * 100) + '% ' + (MOV.ANCLA.y * 100) + '%'; }
      if (el.style.transform !== tr) el.style.transform = tr;
    });
    // con el módulo Movimiento abierto, la etiqueta dice qué efecto está sonando
    if (s.openCard === 'mov') {
      const pz = p.plan.length ? MOV.piezaEn(p.plan, t) : null;
      const texto = !p.plan.length ? 'Movimiento en vivo · sin efectos' : sinMov ? 'Sin movimiento (soltando vuelve)' : 'Movimiento en vivo · ' + MOV.NOMBRES[pz ? pz.e : 'nada'];
      if (texto !== piezaAntes) {
        piezaAntes = texto;
        document.querySelectorAll('.cv-etiqueta').forEach((el) => { el.textContent = texto; });
      }
    } else piezaAntes = null;
  }

  /* ══ ESCENAS DE APOYO en vivo ══ un <video> encima de tu video (debajo de los subtítulos en vivo), sincronizado con
     el tiempo del video base. La biblioteca es privada: enlaces temporales pedidos una vez por clip. */
  const AP = window.CherryApoyo;
  const ap = { els: {}, clave: '', lista: [], enlaces: {}, pidiendo: {}, actual: null };
  let ultimoCtx = null;
  function listaApoyo(ctx) {
    if (!AP || !ctx || !ctx.apoyo || !ctx.palabras) return null;
    const cfg = C.escenasCfg ? C.escenasCfg() : {};
    const dur = (ctx.duraciones || []).reduce((a, b) => a + b, 0);
    /* 20-sep: los gráficos mandan. Se colocan primero y las escenas los esquivan (antes al revés:
       una escena de relleno tiraba un gráfico con su dato). Mismo orden que el ensamblador. */
    const gs = (C.state.grafOn ? (listaGraficos(ctx) || []) : []).map((g) => ({ t0: g.t0, t1: g.t1 }));
    const clave = ctx.id + '|' + JSON.stringify(cfg) + '|' + dur + '|' + gs.map((o) => o.t0).join(',');
    if (clave !== ap.clave) {
      ap.clave = clave; ap.lista = cfg.cantidad ? AP.elegir(ctx.apoyo, ctx.palabras, ctx.aReal, cfg, dur, gs) : []; pedirEnlaces(ap.lista);
      // la lista de la pestaña Escenas se pinta con esto: si está abierta, se redibuja una vez
      if (C.state.openCard === 'edicion') setTimeout(() => C.render(), 0);
    }
    return ap.lista;
  }
  function pedirEnlaces(lista) {
    const faltan = lista.map((a) => a.s3_key).filter((k) => !ap.enlaces[k] && !ap.pidiendo[k]);
    if (!faltan.length || !C.api || !C.api.enlacesBiblioteca) return;
    faltan.forEach((k) => { ap.pidiendo[k] = true; });
    C.api.enlacesBiblioteca(faltan).then((e) => { Object.assign(ap.enlaces, e || {}); }).catch(() => null)
      .then(() => { faltan.forEach((k) => { delete ap.pidiendo[k]; }); });
  }
  /* Un reproductor por escena, cargado unos segundos antes de su turno y ya puesto en su segundo: solo se muestra cuando
     tiene imagen (nunca un cuadro negro mientras carga) */
  function reproductor(a, url) {
    let el = ap.els[a.s3_key + '@' + a.t0];
    if (!el) {
      el = document.createElement('video');
      el.className = 'ap-vivo'; el.muted = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.preload = 'auto';
      el.src = url;
      el.addEventListener('loadedmetadata', () => { try { el.currentTime = a.ss; } catch (_) {} }, { once: true });
      ap.els[a.s3_key + '@' + a.t0] = el;
    }
    return el;
  }
  function colocar(el, a, caja) {
    const W = caja.clientWidth, H = caja.clientHeight;
    if (a.rotar) Object.assign(el.style, { width: H + 'px', height: W + 'px', left: (W - H) / 2 + 'px', top: (H - W) / 2 + 'px' });
    else Object.assign(el.style, { width: '100%', height: '100%', left: '0', top: '0' });
  }
  function apoyoCuadro(ctx) {
    const lista = ctx && ctx.video && C.state.escenasOn ? listaApoyo(ctx) : null;
    const t = ctx && ctx.video ? Number(ctx.video.currentTime) || 0 : 0;
    const a = lista && AP.enInstante(lista, t);
    const caja = ctx && ctx.video && ctx.video.parentNode;
    // se cargan por adelantado las que vienen en los próximos 15 s
    if (lista && caja) lista.forEach((b) => { if (b !== a && b.t0 > t && b.t0 - t < 15 && ap.enlaces[b.s3_key]) reproductor(b, ap.enlaces[b.s3_key]); });
    Object.keys(ap.els).forEach((k) => {
      const el = ap.els[k];
      if (a && k === a.s3_key + '@' + a.t0) return;
      if (el.style.display !== 'none') el.style.display = 'none';
      if (!el.paused) el.pause();
    });
    const url = a && ap.enlaces[a.s3_key];
    if (!a || !url || !caja) { ap.actual = null; return; }
    const el = reproductor(a, url);
    // justo encima del video y del lienzo de color, debajo de los subtítulos en vivo y de las etiquetas
    const lz = ctx.elementos[1], antes = lz && lz.parentNode === caja ? lz : ctx.video;
    if (antes.nextSibling !== el) caja.insertBefore(el, antes.nextSibling);
    if (ap.actual !== a) { ap.actual = a; colocar(el, a, caja); }
    const quiere = a.ss + (t - a.t0);
    if (el.readyState >= 1 && !el.seeking && Math.abs(el.currentTime - quiere) > 0.3) { try { el.currentTime = quiere; } catch (_) {} }
    if (ctx.video.paused) { if (!el.paused) el.pause(); } else if (el.paused) el.play().catch(() => null);
    const z = 1 + 0.06 * Math.max(0, Math.min(1, (t - a.t0) / Math.max(0.1, a.t1 - a.t0)));      // el mismo acercamiento lento del video final
    el.style.transform = (a.rotar ? 'rotate(' + (a.rotar === 90 ? 90 : -90) + 'deg) ' : '') + 'scale(' + z.toFixed(4) + ')';
    const lista2 = el.readyState >= 2 && !el.seeking;
    el.style.display = lista2 ? 'block' : 'none';
  }
  /* ══ GRÁFICOS en vivo ══ un <canvas> encima del video, del color y de las escenas de apoyo, debajo de los subtítulos en
     vivo. Se dibuja en el cuadro del VIDEO (el celular lo recorta con «cover», igual que al video). */
  const GR = window.CherryGraf;
  const gv = { lienzo: null, clave: '', lista: [], fuentes: false, grandes: null, caja: null, pidiendo: false };
  /* PREMIUM (19-sep): los gráficos los dibuja Remotion. En el celular se ve el MISMO componente (js/premium-vista.js, que
     se baja solo la primera vez que se escoge «Premium»); en el video final lo dibuja Remotion en la nube. */
  function premiumListo() {
    if (window.CherryPremiumVista) return true;
    if (!gv.pidiendo) {
      gv.pidiendo = true;
      const s = document.createElement('script');
      s.src = 'js/premium-vista.js?v=20260924r';
      s.onerror = () => { gv.pidiendo = 'error'; console.warn('[Cherry] no se pudo cargar la vista premium'); };
      document.head.appendChild(s);
    }
    return false;
  }
  /* Mientras el video se encoge, sus elementos ocupan el cuadro completo del video (la caja del celular recorta igual) */
  function agrandar(els, q) {
    els.forEach((el) => {
      if (!el) return;
      Object.assign(el.style, { width: q.W.toFixed(2) + 'px', height: q.H.toFixed(2) + 'px', left: q.x.toFixed(2) + 'px', top: q.y.toFixed(2) + 'px' });
    });
    gv.grandes = els.filter(Boolean);
  }
  function soltarGrandes() {
    (gv.grandes || []).forEach((el) => { el.style.width = ''; el.style.height = ''; el.style.left = ''; el.style.top = ''; });
    gv.grandes = null;
  }
  function listaGraficos(ctx) {
    const pant = C.pantallas ? C.pantallas.paraServidor() : [];
    if (!GR || !ctx || !ctx.palabras || (!ctx.graficos && !pant.length)) return null;
    const cfg = C.grafCfg ? C.grafCfg() : {};
    const dur = (ctx.duraciones || []).reduce((a, b) => a + b, 0);
    // 20-sep: van primero, sin esquivar nada; son las escenas las que los esquivan (ver listaApoyo)
    const clave = ctx.id + '|' + JSON.stringify(cfg) + '|' + dur + '|' + JSON.stringify(pant);
    if (clave !== gv.clave) {
      gv.clave = clave;
      gv.lista = cfg.cantidad && ctx.graficos ? GR.elegir(ctx.graficos, ctx.palabras, ctx.aReal, cfg, dur, []) : [];
      // (24-sep) las pantallas del guion: van donde las puso la persona y mandan sobre las de la IA
      if (pant.length && GR.conPantallas) gv.lista = GR.conPantallas(gv.lista, pant, ctx.palabras, ctx.aReal, dur);
      if (C.state.openCard === 'edicion') setTimeout(() => C.render(), 0);
    }
    return gv.lista;
  }
  /* El cuadro del video dentro de su caja (object-fit: cover) */
  function cuadroVideo(caja, video) {
    const We = caja.clientWidth, He = caja.clientHeight, vw = video.videoWidth || 1080, vh = video.videoHeight || 1920;
    const k = Math.max(We / vw, He / vh);
    return { We, He, W: vw * k, H: vh * k, x: (We - vw * k) / 2, y: (He - vh * k) / 2 };
  }
  function grafCuadro(ctx) {
    const hayPant = !!(C.pantallas && C.pantallas.paraServidor().length);
    const lista = ctx && ctx.video && (C.state.grafOn || hayPant) ? listaGraficos(ctx) : null;
    const t = ctx && ctx.video ? Number(ctx.video.currentTime) || 0 : 0;
    const p = lista && GR.enInstante(lista, t);
    const caja = ctx && ctx.video && ctx.video.parentNode;
    const esPremium = ((C.grafCfg ? C.grafCfg().estilo : '') === 'premium' || !!(p && p.pantalla)) && premiumListo();
    if (!p || !caja) {
      if (gv.lienzo && gv.lienzo.style.display !== 'none') gv.lienzo.style.display = 'none';
      if (gv.caja && gv.caja.style.display !== 'none') { gv.caja.style.display = 'none'; if (window.CherryPremiumVista) window.CherryPremiumVista.quitar(gv.caja); }
      if (gv.grandes) soltarGrandes();
      return '';
    }
    if (esPremium) return grafPremium(ctx, caja, p, t);
    if (gv.caja && gv.caja.style.display !== 'none') { gv.caja.style.display = 'none'; window.CherryPremiumVista.quitar(gv.caja); }
    if (!gv.fuentes && document.fonts) { gv.fuentes = true; GR.FUENTES.forEach((f) => { document.fonts.load(f).catch(() => null); }); }
    if (!gv.lienzo) { gv.lienzo = document.createElement('canvas'); gv.lienzo.className = 'gr-vivo'; gv.lienzo.setAttribute('aria-hidden', 'true'); }
    const cv = gv.lienzo;
    // justo después del último de: video, lienzo de color, escenas de apoyo
    let despues = null;
    for (const el of caja.children) { if (el === ctx.video || el === ctx.elementos[1] || (el.classList && el.classList.contains('ap-vivo'))) despues = el; }
    if (despues && despues.nextSibling !== cv) caja.insertBefore(cv, despues.nextSibling);
    const q = cuadroVideo(caja, ctx.video), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(q.We * dpr), hh = Math.round(q.He * dpr);
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, q.We, q.He);
    g.translate(q.x, q.y);
    GR.dibujar(g, q.W, q.H, p, t, (C.grafCfg().color || 'cherry'));
    if (cv.style.display !== 'block') cv.style.display = 'block';
    // pantalla partida / completa: el video se encoge (en el cuadro del video; origen del transform = el ANCLA del movimiento)
    const vv = GR.video(p, t, q.W, q.H);
    if (!vv) { if (gv.grandes) soltarGrandes(); return ''; }
    agrandar([ctx.video, ctx.elementos[1]], q);
    // ahora el elemento ES el cuadro del video: el origen del transform (el ANCLA, en %) queda en el cuadro
    const Ax = MOV.ANCLA.x * q.W, Ay = MOV.ANCLA.y * q.H;
    const tx = vv.ox * q.W - (1 - vv.s) * Ax, ty = vv.oy * q.H - (1 - vv.s) * Ay;
    return 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + vv.s.toFixed(5) + ')';
  }
  /* El gráfico premium en el celular: el componente de Remotion encima del video, en el cuadro del video */
  function grafPremium(ctx, caja, p, t) {
    const V = window.CherryPremiumVista;
    if (gv.lienzo && gv.lienzo.style.display !== 'none') gv.lienzo.style.display = 'none';
    if (!gv.caja) {
      gv.caja = document.createElement('div');
      gv.caja.className = 'gr-vivo gr-vivo--premium';
      gv.caja.setAttribute('aria-hidden', 'true');
    }
    const cv = gv.caja;
    let despues = null;
    for (const el of caja.children) { if (el === ctx.video || el === ctx.elementos[1] || (el.classList && el.classList.contains('ap-vivo'))) despues = el; }
    if (despues && despues.nextSibling !== cv) caja.insertBefore(cv, despues.nextSibling);
    const q = cuadroVideo(caja, ctx.video);
    const W = ctx.video.videoWidth || 1080, H = ctx.video.videoHeight || 1920;
    const alto = V.alto(p, W, H) / H;                       // qué parte del alto del video ocupa la capa
    Object.assign(cv.style, { left: q.x.toFixed(2) + 'px', top: q.y.toFixed(2) + 'px', width: q.W.toFixed(2) + 'px', height: (q.H * alto).toFixed(2) + 'px' });
    if (cv.style.display !== 'block') cv.style.display = 'block';
    V.dibujar(cv, { p: p, color: (C.grafCfg().color || 'cherry'), W: W, H: H, fps: 30, t: t });
    const vv = GR.video(p, t, q.W, q.H);
    if (!vv) { if (gv.grandes) soltarGrandes(); return ''; }
    agrandar([ctx.video, ctx.elementos[1]], q);
    const Ax = MOV.ANCLA.x * q.W, Ay = MOV.ANCLA.y * q.H;
    const tx = vv.ox * q.W - (1 - vv.s) * Ax, ty = vv.oy * q.H - (1 - vv.s) * Ay;
    return 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + vv.s.toFixed(5) + ')';
  }

  C.grafVivo = {
    /* los momentos que marcó la IA (no los que salen: eso es lista()). Los necesita la pestaña
       Gráficos para decirle al servidor CUÁLES se queda la persona al regenerar. */
    momentos() { return (ultimoCtx && ultimoCtx.graficos && ultimoCtx.graficos.momentos) || []; },
    /* tras regenerar: se cambian en sitio y se olvida la lista calculada, para que se rehaga */
    refrescar(gr) {
      if (!ultimoCtx || !gr) return;
      ultimoCtx.graficos = gr;
      gv.clave = '';
      ap.clave = '';        // las escenas esquivan los gráficos: también se rehacen
    },
    /* los gráficos del video que se ve ahora (null = todavía no se sabe) */
    lista() { return ultimoCtx && ultimoCtx.graficos ? listaGraficos(ultimoCtx) : null; },
  };

  C.apoyoVivo = {
    /* las escenas del video que se ve ahora (null = todavía no se sabe) */
    lista() { return ultimoCtx && ultimoCtx.apoyo ? listaApoyo(ultimoCtx) : null; },
  };

  C.movVivo = {
    /* «Mantén para ver sin movimiento» */
    sinMovimiento(on) { sinMov = !!on; },
    arrancar() { if (!rafId) rafId = requestAnimationFrame(cuadro); },
    _datos: datos, _plan: () => cache.plan,
  };
  C.movVivo.arrancar();
})();

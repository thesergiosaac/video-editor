/* movvivo.js — el MOVIMIENTO de cámara EN VIVO en el celular (19-sep-2026).
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

  const datos = { id: null, cargando: false, dur: null, impactos: [], apoyo: null, palabras: null, aReal: null };   // cortes, frases y escenas del render que se ve
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
               apoyo: datos.apoyo, palabras: datos.palabras, aReal: datos.aReal, id: 'render:' + s.renderId };
    }
    return null;
  }

  function planPara(ctx) {
    const cfg = C.movCfg ? MOV.limpiar(C.movCfg()) : null;
    const clave = JSON.stringify(cfg) + '|' + ctx.duraciones.join(',') + '|' + ctx.impactos.join(',');
    if (clave !== cache.clave) {
      cache.clave = clave; cache.cfg = cfg;
      cache.plan = cfg ? MOV.dirigir(MOV.piezasDe(ctx.duraciones), ctx.impactos, cfg) : [];
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
    if (!ctx || !ctx.video) { if (tocados.length) soltar(); return; }
    const p = planPara(ctx);
    const els = ctx.elementos.filter(Boolean);
    if (tocados.some((el) => els.indexOf(el) < 0)) soltar();
    const t = Number(ctx.video.currentTime) || 0;
    const v = !sinMov && p.plan.length ? MOV.valor(p.plan, t, p.cfg) : null;
    const tr = v ? MOV.css(v) : '';
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
    const clave = ctx.id + '|' + JSON.stringify(cfg) + '|' + dur;
    if (clave !== ap.clave) {
      ap.clave = clave; ap.lista = cfg.cantidad ? AP.elegir(ctx.apoyo, ctx.palabras, ctx.aReal, cfg, dur) : []; pedirEnlaces(ap.lista);
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

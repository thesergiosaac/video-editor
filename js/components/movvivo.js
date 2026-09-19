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

  const datos = { id: null, cargando: false, dur: null, impactos: [] };   // cortes y frases del render que se ve
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
      return { elementos: [E.video, E.lienzo], video: E.video, duraciones: datos.dur, impactos: datos.impactos };
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

  C.movVivo = {
    /* «Mantén para ver sin movimiento» */
    sinMovimiento(on) { sinMov = !!on; },
    arrancar() { if (!rafId) rafId = requestAnimationFrame(cuadro); },
    _datos: datos, _plan: () => cache.plan,
  };
  C.movVivo.arrancar();
})();

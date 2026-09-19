/* apoyo.js — las ESCENAS DE APOYO de Cherry (19-sep-2026).
 *
 * EL MISMO ARCHIVO corre en el ensamblador (Node) y en la página (navegador), igual que movimiento.js: la página lo usa
 * para mostrarlas en vivo en el celular y el ensamblador para ponerlas en el video final.
 *
 * La IA (función biblioteca › apoyo) ya encontró los MOMENTOS que se prestan para ilustrar (palabras desde–hasta, qué
 * mostrar, fuerza 1–3) y para cada uno la escena de la biblioteca que mejor lo ilustra (y una segunda). Aquí se decide
 * CUÁLES se usan según «Escenas de apoyo» (pocas / medio / muchas):
 *   · primero las que más se prestan; nunca en los primeros 2 s (la cara engancha) ni en el último segundo y medio;
 *   · entre una y otra, un mínimo de aire; como máximo una parte del video (15 / 20 / 25 %);
 *   · cada una dura de 2 a 3 s, empieza en la primera palabra del momento; tu voz sigue y los subtítulos van encima;
 *   · el mismo clip nunca dos veces en un video (si la elegida ya se usó, va la segunda).
 * Todo es determinista: la vista del celular y el video final coinciden.
 */
(function (raiz) {
  'use strict';

  var CANTIDAD = {
    pocas: { cada: 18, aire: 10, parte: 0.15 },
    medio: { cada: 11, aire: 6, parte: 0.2 },
    muchas: { cada: 7, aire: 3.5, parte: 0.25 },
  };
  var MIN = 2.0, MAX = 3.0, INICIO = 2.0, FINAL = 1.5;      // 19-sep: con 1,5 s se sentían como un parpadeo

  function limpiar(cfg) {
    if (!cfg || typeof cfg !== 'object' || !CANTIDAD[cfg.cantidad]) return null;
    return { cantidad: cfg.cantidad };
  }

  /* Tiempo de las palabras (nominal) → tiempo del video real (cada corte dura un poquito más de lo nominal) */
  function reloj(nominales, reales) {
    if (!Array.isArray(nominales) || !Array.isArray(reales) || nominales.length !== reales.length || !reales.length) return function (t) { return t; };
    var ini = [], desp = [], an = 0, ar = 0;
    nominales.forEach(function (d, i) { ini.push(an); desp.push(ar - an); an += Number(d); ar += Number(reales[i]); });
    return function (t) { var k = 0; while (k + 1 < ini.length && t >= ini[k + 1] - 0.0005) k++; return t + desp[k]; };
  }

  /* ══ Cuáles se usan ══ apoyo: {momentos}, palabras: [{start,end}], aReal: función de tiempo, dur: duración del video */
  function elegir(apoyo, palabras, aReal, cfg, dur) {
    cfg = limpiar(cfg);
    var momentos = apoyo && Array.isArray(apoyo.momentos) ? apoyo.momentos : [];
    if (!cfg || !momentos.length || !Array.isArray(palabras) || !palabras.length) return [];
    var f = aReal || function (t) { return t; };
    var reglas = CANTIDAD[cfg.cantidad];
    dur = Number(dur) || f(Number(palabras[palabras.length - 1].end) || 0);
    var tope = Math.max(1, Math.floor(dur / reglas.cada)), topeTiempo = dur * reglas.parte;
    // primero los que más se prestan; a igual fuerza, el que va antes
    var orden = momentos.map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) { return (b.m.fuerza || 1) - (a.m.fuerza || 1) || a.m.desde - b.m.desde; });
    var usados = {}, puestos = [], tiempo = 0;
    for (var k = 0; k < orden.length && puestos.length < tope; k++) {
      var m = orden[k].m, w0 = palabras[m.desde], w1 = palabras[m.hasta];
      if (!w0 || !w1) continue;
      var t0 = f(Number(w0.start)), t1 = f(Number(w1.end));
      var L = Math.max(MIN, Math.min(MAX, t1 - t0));
      t1 = t0 + L;
      if (t0 < INICIO || t1 > dur - FINAL) continue;
      if (tiempo + L > topeTiempo) continue;
      var choca = puestos.some(function (p) { return t0 < p.t1 + reglas.aire && t1 > p.t0 - reglas.aire; });
      if (choca) continue;
      var esc = (m.escenas || []).filter(function (e) { return e && e.s3_key && !usados[e.clip_id]; })[0];
      if (!esc) continue;
      // qué parte del clip: el centro de la escena elegida (si la escena es corta, lo que alcance del clip)
      var cd = Math.max(L, Number(esc.clip_dur) || L), medio = (Number(esc.ini) + Number(esc.fin)) / 2;
      var ss = Math.max(0, Math.min(cd - L, medio - L / 2));
      if (Number(esc.fin) - Number(esc.ini) >= L) ss = Math.max(Number(esc.ini), Math.min(Number(esc.fin) - L, ss));
      usados[esc.clip_id] = true; tiempo += L;
      puestos.push({ t0: r3(t0), t1: r3(t1), ss: r3(ss), s3_key: esc.s3_key, clip_id: esc.clip_id, rotar: Number(esc.rotar) || 0,
                     texto: esc.texto, busqueda: m.busqueda, fuerza: m.fuerza || 1 });
    }
    return puestos.sort(function (a, b) { return a.t0 - b.t0; });
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }

  function enInstante(insertos, t) {
    for (var i = 0; i < (insertos || []).length; i++) if (t >= insertos[i].t0 && t < insertos[i].t1) return insertos[i];
    return null;
  }

  var API = { CANTIDAD: CANTIDAD, limpiar: limpiar, reloj: reloj, elegir: elegir, enInstante: enInstante };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherryApoyo = API;
})(typeof window !== 'undefined' ? window : this);

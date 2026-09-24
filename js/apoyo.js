/* apoyo.js — las ESCENAS DE APOYO de Cherry (19-sep-2026).
 *
 * EL MISMO ARCHIVO corre en el ensamblador (Node) y en la página (navegador), igual que movimiento.js: la página lo usa
 * para mostrarlas en vivo en el celular y el ensamblador para ponerlas en el video final.
 *
 * La IA (función biblioteca › apoyo) ya encontró los MOMENTOS que se prestan para ilustrar (palabras desde–hasta, qué
 * mostrar, fuerza 1–3) y para cada uno la escena de la biblioteca que mejor lo ilustra (y una segunda). Aquí se decide
 * CUÁLES se usan según «Escenas de apoyo» (pocas / medio / muchas):
 *   · primero las que más se prestan; nunca en los primeros 2 s (la cara engancha) ni en el último segundo y medio;
 *   · entre una y otra, un mínimo de aire; como máximo una parte del video (22 / 30 / 38 %);
 *   · cada una dura de 3,5 a 5 s (20-sep), empieza en la primera palabra del momento; tu voz sigue y los subtítulos van encima;
 *   · el mismo clip nunca dos veces en un video (si la elegida ya se usó, va la segunda).
 * Todo es determinista: la vista del celular y el video final coinciden.
 */
(function (raiz) {
  'use strict';

  /* «parte» es cuanto del video pueden ocupar las escenas en total. Sube junto con MAX (20-sep):
     si solo se alargaran las escenas sin tocar esto, cabrian MENOS y saldrian menos. */
  var CANTIDAD = {
    pocas: { cada: 18, aire: 10, parte: 0.22 },
    medio: { cada: 11, aire: 6, parte: 0.30 },
    muchas: { cada: 7, aire: 3.5, parte: 0.38 },
  };
  var MIN = 3.5, MAX = 5.0, INICIO = 2.0, FINAL = 1.5;      // 20-sep: con 3 s de tope se cortaban a mitad de frase (antes 2,0-3,0; el 19-sep ya se habia subido desde 1,5)

  /* ══ Lo que fija la persona desde el guion (20-sep) ══ cfg.fijos = {si:[{desde,hasta}], no:[...]}
     en números de palabra. «no» quita la escena que caiga ahí. «sí» obliga a que salga: se salta el
     cupo, el aire y el presupuesto de tiempo. */
  function zonas(v) {
    return (Array.isArray(v) ? v : []).map(function (z) {
      var o = { desde: Math.round(Number(z && z.desde)), hasta: Math.round(Number(z && z.hasta)) };
      // (24-sep) una escena fijada puede traer su duración (1–30 s)
      var s = Number(z && z.segundos);
      if (isFinite(s) && s >= 1) o.segundos = Math.min(30, Math.round(s * 10) / 10);
      return o;
    }).filter(function (z) { return isFinite(z.desde) && isFinite(z.hasta) && z.hasta >= z.desde; });
  }
  function limpiarFijos(f) {
    if (!f || typeof f !== 'object') return null;
    var si = zonas(f.si), no = zonas(f.no);
    return si.length || no.length ? { si: si, no: no } : null;
  }
  function enZona(m, zs) {
    return (zs || []).some(function (z) { return Number(m.desde) <= z.hasta && Number(m.hasta) >= z.desde; });
  }

  function limpiar(cfg) {
    if (!cfg || typeof cfg !== 'object' || !CANTIDAD[cfg.cantidad]) return null;
    // (24-sep) soloFijas: las automáticas apagadas, pero lo que fijó la persona sale igual
    var o = { cantidad: cfg.cantidad, fijos: limpiarFijos(cfg.fijos) };
    if (cfg.soloFijas) { if (!o.fijos || !o.fijos.si.length) return null; o.soloFijas = true; }
    return o;
  }

  /* Tiempo de las palabras (nominal) → tiempo del video real (cada corte dura un poquito más de lo nominal) */
  function reloj(nominales, reales) {
    if (!Array.isArray(nominales) || !Array.isArray(reales) || nominales.length !== reales.length || !reales.length) return function (t) { return t; };
    var ini = [], desp = [], an = 0, ar = 0;
    nominales.forEach(function (d, i) { ini.push(an); desp.push(ar - an); an += Number(d); ar += Number(reales[i]); });
    return function (t) { var k = 0; while (k + 1 < ini.length && t >= ini[k + 1] - 0.0005) k++; return t + desp[k]; };
  }

  /* ══ Cuáles se usan ══ apoyo: {momentos}, palabras: [{start,end}], aReal: función de tiempo, dur: duración del video,
     ocupados: [{t0,t1}] son los GRAFICOS, que se colocan antes: una escena no puede taparlos (20-sep). */
  function elegir(apoyo, palabras, aReal, cfg, dur, ocupados) {
    cfg = limpiar(cfg);
    var momentos = apoyo && Array.isArray(apoyo.momentos) ? apoyo.momentos : [];
    if (!cfg || !momentos.length || !Array.isArray(palabras) || !palabras.length) return [];
    var f = aReal || function (t) { return t; };
    var reglas = CANTIDAD[cfg.cantidad];
    dur = Number(dur) || f(Number(palabras[palabras.length - 1].end) || 0);
    var tope = Math.max(1, Math.floor(dur / reglas.cada)), topeTiempo = dur * reglas.parte;
    // primero los que más se prestan; a igual fuerza, el que va antes
    var fijos = cfg.fijos || null;
    // (24-sep) las zonas «sí» CON duración se ponen aparte (abajo); las de antes, sin duración, siguen igual
    /* (24-sep) Las marcas de antes (sin duración) solo obligaban a una escena que la IA YA tuviera ahí; si no había
       ninguna, el botón quedaba marcado y no salía nada (Sergio, en el segundo 11: seis líneas marcadas, cero
       escenas). Ahora se juntan las seguidas y cada grupo es una escena fijada con la duración de sus líneas
       (mínimo 3,5 s, como las de Cherry). */
    var siConDur = fijos ? fijos.si.filter(function (z) { return z.segundos; }) : [];
    var viejas = fijos ? fijos.si.filter(function (z) { return !z.segundos; }).sort(function (a, b) { return a.desde - b.desde; }) : [];
    var unidas = [];
    viejas.forEach(function (z) {
      var u = unidas[unidas.length - 1];
      if (u && z.desde <= u.hasta + 1) u.hasta = Math.max(u.hasta, z.hasta); else unidas.push({ desde: z.desde, hasta: z.hasta });
    });
    unidas.forEach(function (u) {
      var a = palabras[u.desde], b = palabras[Math.min(u.hasta, palabras.length - 1)];
      var span = a && b ? f(Number(b.end)) - f(Number(a.start)) : 0;
      u.segundos = Math.max(MIN, Math.round(span * 10) / 10);
      siConDur.push(u);
    });
    var siViejas = [];
    var pedido = function (m) { return !!(siViejas.length && enZona(m, siViejas)); };
    var vetado = function (m) { return !!(fijos && enZona(m, fijos.no)); };
    // las que pidió la persona van primero; después las demás por fuerza
    var orden = momentos.map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) {
        var pa = pedido(a.m) ? 1 : 0, pb = pedido(b.m) ? 1 : 0;
        return pb - pa || (b.m.fuerza || 1) - (a.m.fuerza || 1) || a.m.desde - b.m.desde;
      });
    var usados = {}, puestos = [], tiempo = 0, auto = 0;         // «auto» = las que pone Cherry sola
    var usadosM = {};

    /* (24-sep) LAS QUE FIJASTE CON SU DURACIÓN: empiezan en la primera palabra de su línea y duran lo que pediste.
       La toma: la del momento de la IA que cae ahí; si no hay, la del más cercano. Van antes que todo, sin cupo. */
    siConDur.slice().sort(function (a, b) { return a.desde - b.desde; }).forEach(function (z) {
      var wz = palabras[z.desde];
      if (!wz) return;
      var t0 = Math.max(0, f(Number(wz.start)));
      var D = Math.min(z.segundos, dur - 0.2 - t0);
      var antes = puestos.filter(function (p) { return p.t0 <= t0 && p.t1 > t0; })[0];
      if (antes) { D -= antes.t1 - t0; t0 = antes.t1; }             // dos fijadas que se pisan: la segunda espera
      var despues = puestos.filter(function (p) { return p.t0 > t0; }).sort(function (a, b) { return a.t0 - b.t0; })[0];
      if (despues) D = Math.min(D, despues.t0 - t0);
      if (D < 1) return;
      /* Las tomas, de la más cercana a lo que dices a la más lejana: primero las del momento que cae ahí.
         ⚠️ Cada toma trae SU trozo del clip (ini–fin, ~4 s) que es lo que corresponde a lo que dices; estirar una
         sola a 9 s metía lo que había antes y después en el clip (en la prueba, una piscina en una escena de café).
         Así que una escena larga se llena con varias tomas seguidas, cada una en su trozo. */
      var cands = momentos.map(function (m, i) {
        var dist = m.hasta < z.desde ? z.desde - m.hasta : m.desde > z.hasta ? m.desde - z.hasta : 0;
        return { m: m, i: i, dist: dist };
      }).filter(function (c) { return !usadosM[c.i]; })
        .sort(function (a, b) { return a.dist - b.dist || (b.m.fuerza || 1) - (a.m.fuerza || 1); });
      var cola = [];
      cands.forEach(function (c) {
        (c.m.escenas || []).forEach(function (e) { if (e && e.s3_key && !usados[e.clip_id]) cola.push({ e: e, i: c.i, m: c.m }); });
      });
      var t = t0, queda = D, tomadas = {};
      while (queda >= 1 && cola.length) {
        var x = cola.shift();
        if (tomadas[x.e.clip_id]) continue;
        var e = x.e, cd = Number(e.clip_dur) || 0, trozo = Math.max(0, Number(e.fin) - Number(e.ini));
        var L = Math.max(2.5, trozo);
        if (queda - L < 1.5) L = queda;                                // lo que sobraría es muy poco: esta lo cubre
        L = Math.min(L, queda, cd || queda);
        if (L < 1) continue;
        var ss = trozo >= L ? Number(e.ini) + (trozo - L) / 2
          : Math.max(0, Math.min((cd || L) - L, (Number(e.ini) + Number(e.fin)) / 2 - L / 2));
        tomadas[e.clip_id] = true; usados[e.clip_id] = true; usadosM[x.i] = true;
        puestos.push({ t0: r3(t), t1: r3(t + L), ss: r3(ss), s3_key: e.s3_key, clip_id: e.clip_id, rotar: Number(e.rotar) || 0,
                       texto: e.texto, busqueda: x.m.busqueda, fuerza: 3, fija: true });
        t += L; queda -= L;
      }
    });

    for (var k = 0; k < orden.length; k++) {
      var m = orden[k].m, w0 = palabras[m.desde], w1 = palabras[m.hasta];
      if (!w0 || !w1) continue;
      if (usadosM[orden[k].i]) continue;                         // su toma ya la usa una que fijaste
      if (cfg.soloFijas && !pedido(m)) continue;                 // automáticas apagadas: solo lo fijado
      if (vetado(m)) continue;                                   // aquí NO, dijo la persona
      var suyo = pedido(m);                                      // aquí SÍ: va aparte del cupo y del aire
      if (!suyo && auto >= tope) continue;                       // el nivel limita a Cherry, no a la persona
      var t0 = f(Number(w0.start)), t1 = f(Number(w1.end));
      var L = Math.max(MIN, Math.min(MAX, t1 - t0));
      t1 = t0 + L;
      // los bordes (la cara engancha al principio; el final necesita aire) ceden ante lo que PIDE la persona
      if (t0 < INICIO) { if (!suyo) continue; t0 = INICIO; t1 = t0 + L; }
      if (t1 > dur - FINAL) { if (!suyo) continue; t1 = dur - FINAL; t0 = t1 - L; if (t0 < INICIO) continue; }
      if (!suyo && tiempo + L > topeTiempo) continue;
      var aire = suyo ? 0 : reglas.aire;
      var choca = puestos.some(function (p) { return t0 < p.t1 + aire && t1 > p.t0 - aire; }) ||
        (!suyo && (ocupados || []).some(function (o) { return t0 < o.t1 + 0.6 && t1 > o.t0 - 0.6; }));
      if (choca) continue;
      var esc = (m.escenas || []).filter(function (e) { return e && e.s3_key && !usados[e.clip_id]; })[0];
      if (!esc) continue;
      // qué parte del clip: el centro de la escena elegida (si la escena es corta, lo que alcance del clip)
      var cd = Math.max(L, Number(esc.clip_dur) || L), medio = (Number(esc.ini) + Number(esc.fin)) / 2;
      var ss = Math.max(0, Math.min(cd - L, medio - L / 2));
      if (Number(esc.fin) - Number(esc.ini) >= L) ss = Math.max(Number(esc.ini), Math.min(Number(esc.fin) - L, ss));
      usados[esc.clip_id] = true; tiempo += L; if (!suyo) auto++;
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

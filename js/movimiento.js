/* movimiento.js — el MOVIMIENTO de cámara de Cherry (19-sep-2026).
 *
 * EL MISMO ARCHIVO corre en el ensamblador (Node) y en la página (navegador), igual que motor-color.js:
 * la página lo usa para mostrar el movimiento en vivo en el celular y el ensamblador para hornearlo en el
 * video final. Si se cambia aquí, se copia tal cual a los dos sitios (video-editor/js y assembler-v4).
 *
 * La persona solo escoge QUÉ efectos quiere, con qué curva de velocidad y con qué intensidad; el DIRECTOR
 * decide dónde va cada uno, pedazo por pedazo (un pedazo = lo que hay entre dos cortes):
 *   1. Nunca dos iguales seguidos.
 *   2. Los cortes se disimulan cambiando el encuadre: con «Golpe de zoom» elegido, los pedazos se turnan entre el encuadre
 *      normal y uno más cerca, y los movimientos lentos van ENCIMA de ese encuadre (así en cada corte cambia la distancia;
 *      19-sep: con acercar y alejar seguidos, el corte quedaba a la misma distancia y se notaba el salto).
 *   3. Las frases de impacto pegan: acercamiento rápido justo en su primera palabra (tampoco dos seguidos).
 *   4. Nada queda quieto mucho rato: pedazos largos (> 3 s) se acercan o se alejan despacio.
 *   5. Pedazos cortos (< 1,5 s): golpe o sacudida (no alcanza para un movimiento lento).
 *   6. Arranque y cierre: el gancho (primer pedazo) va con más fuerza; el final se cierra alejándose.
 *   7. Siempre hacia la cara (ANCLA: centro, en la parte alta del cuadro).
 *   8. Los subtítulos no se mueven: el movimiento se aplica al video ANTES de quemar las letras.
 *   9. El ritmo de Edición manda: más dinámico = un poco más fuerte.
 * Todo es determinista: el mismo video con las mismas opciones da exactamente el mismo movimiento
 * (la vista del navegador y el archivo final coinciden).
 *
 * En el video final se hace con el filtro `perspective` de ffmpeg (existe en el 4.1 de la Lambda) con
 * evaluación por cuadro: recorta con precisión de subpíxel, así los acercamientos lentos no tiemblan
 * (medido 19-sep: temblor 0,003 px contra 0,6 px del filtro zoompan).
 */
(function (raiz) {
  'use strict';

  var EFECTOS = ['lento', 'aleja', 'golpe', 'impacto', 'mano', 'sacude'];
  var NOMBRES = { lento: 'Acercamiento lento', aleja: 'Alejamiento lento', golpe: 'Golpe de zoom', impacto: 'Zoom de impacto',
                  mano: 'Cámara en mano', sacude: 'Sacudida', nada: 'Sin movimiento' };
  var ANCLA = { x: 0.5, y: 0.36 };      // la cara suele estar al centro, en el tercio de arriba
  var MAX = 1.25;                       // nunca más cerca que esto (se perdería nitidez)
  var INTENSIDAD = { sutil: 0.55, media: 1, fuerte: 1.5 };
  var RAMPA_IMPACTO = 0.35;             // segundos que tarda el zoom de impacto en llegar
  var DURA_SACUDIDA = 0.45;

  /* ── Curvas de velocidad (u de 0 a 1). Las mismas fórmulas van escritas para ffmpeg en curvaFF ── */
  var CURVAS = {
    suave: function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
    energico: function (u) { return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u); },
    rebote: function (u) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    parejo: function (u) { return u; },
  };
  function curvaFF(nombre, u) {
    switch (nombre) {
      case 'energico': return 'if(gte(' + u + ',1),1,1-pow(2,-10*' + u + '))';
      case 'rebote': return '(1+2.70158*pow(' + u + '-1,3)+1.70158*pow(' + u + '-1,2))';
      case 'parejo': return u;
      default: return 'if(lt(' + u + ',0.5),4*pow(' + u + ',3),1-pow(-2*' + u + '+2,3)/2)';
    }
  }

  /* ── Opciones: lo que llega de la página (o de un render viejo) se deja en limpio ── */
  function limpiar(cfg) {
    if (!cfg || typeof cfg !== 'object') return null;
    var ef = Array.isArray(cfg.efectos) ? cfg.efectos.filter(function (e) { return EFECTOS.indexOf(e) >= 0; }) : [];
    if (!ef.length) return null;                                  // sin efectos = sin movimiento
    return {
      efectos: EFECTOS.filter(function (e) { return ef.indexOf(e) >= 0; }),
      curva: CURVAS[cfg.curva] ? cfg.curva : 'suave',
      intensidad: INTENSIDAD[cfg.intensidad] ? cfg.intensidad : 'media',
      ritmo: Math.max(0, Math.min(100, Number(cfg.ritmo) || 50)),
    };
  }

  /* ── Los pedazos entre cortes, en el tiempo del video (duraciones reales de cada corte) ── */
  function piezasDe(duraciones) {
    var out = [], t = 0;
    (duraciones || []).forEach(function (d) { d = Number(d) || 0; if (d > 0) { out.push({ t0: t, t1: t + d }); t += d; } });
    return out;
  }

  /* Tiempo de las palabras (nominal) → tiempo del video real: cada corte dura un poquito más de lo nominal */
  function reloj(nominales, reales) {
    if (!Array.isArray(nominales) || !Array.isArray(reales) || nominales.length !== reales.length || !reales.length) return function (t) { return t; };
    var ini = [], desp = [], an = 0, ar = 0;
    nominales.forEach(function (d, i) { ini.push(an); desp.push(ar - an); an += Number(d); ar += Number(reales[i]); });
    return function (t) { var k = 0; while (k + 1 < ini.length && t >= ini[k + 1] - 0.0005) k++; return t + desp[k]; };
  }

  /* Inicio de cada frase de impacto (las que llevan `estilo`), ya en el tiempo del video */
  function impactosDe(palabras, frases, aReal) {
    var f = aReal || function (t) { return t; };
    var out = [];
    (frases || []).forEach(function (fr) {
      if (!fr || !fr.estilo) return;
      var w = palabras && palabras[fr.desde];
      if (w && isFinite(Number(w.start))) out.push(f(Number(w.start)));
    });
    return out.sort(function (a, b) { return a - b; });
  }

  /* Elección «al azar» pero siempre la misma para el mismo pedazo */
  function elegir(lista, i) { return lista[((i + 1) * 2654435761 >>> 0) % lista.length]; }

  /* ══ EL DIRECTOR ══ piezas [{t0,t1}] + impactos [t] + opciones → plan [{t0,t1,e,...}] */
  function dirigir(piezas, impactos, cfg) {
    cfg = limpiar(cfg);
    if (!cfg || !piezas || !piezas.length) return [];
    var hay = function (e) { return cfg.efectos.indexOf(e) >= 0; };
    var k = INTENSIDAD[cfg.intensidad] * (0.85 + 0.3 * cfg.ritmo / 100);
    var cerca = 1 + 0.1 * k;                                  // el encuadre cercano (se turna con el normal si hay golpe de zoom)
    var plan = [], antes = null, finAntes = 1, ultimaSacudida = -9;
    piezas.forEach(function (p, i) {
      var d = p.t1 - p.t0, ultimo = i === piezas.length - 1;
      var ti = null;
      for (var j = 0; j < (impactos || []).length; j++) {
        if (impactos[j] >= p.t0 - 0.05 && impactos[j] <= p.t1 - 0.25) { ti = Math.max(p.t0, impactos[j]); break; }
      }
      var e;
      // el zoom de impacto tampoco se repite seguido (19-sep: con muchas frases de impacto salía en 12 de 20 pedazos)
      if (ti != null && hay('impacto') && antes !== 'impacto') e = 'impacto';
      else if (ultimo && d >= 1.2 && hay('aleja')) e = 'aleja';
      else if (i === 0 && d >= 1.5 && hay('lento')) e = 'lento';
      else {
        var pool = d < 1.5 ? ['golpe', 'sacude'] : d > 3 ? ['lento', 'aleja', 'mano'] : ['golpe', 'lento', 'aleja', 'mano'];
        pool = pool.filter(function (x) { return hay(x) && x !== antes && (x !== 'sacude' || i - ultimaSacudida >= 4); });
        e = pool.length ? elegir(pool, i) : (hay('golpe') && antes !== 'golpe' ? 'golpe' : 'nada');
      }
      var pz = { t0: p.t0, t1: p.t1, e: e, k: i === 0 ? k * 1.3 : k };      // el gancho, con más fuerza
      // encuadre del pedazo: se turna normal ↔ cerca (solo con golpe de zoom); el primero y el cierre, normales
      pz.b = hay('golpe') && i % 2 === 1 && !(ultimo && e === 'aleja') ? cerca : 1;
      if (e === 'impacto') pz.ti = ti;
      if (e === 'golpe') pz.z = finAntes > 1.06 ? 1 : Math.min(MAX, 1 + 0.16 * pz.k);   // cambia la distancia respecto al final del pedazo anterior
      if (e === 'sacude') ultimaSacudida = i;
      plan.push(pz);
      finAntes = estado(pz, p.t1 - 1e-3, cfg.curva).s;
      antes = e;
    });
    return plan;
  }

  /* ── Cómo está la cámara en el instante t dentro de un pedazo: escala, corrimiento (fracción del ancho/alto) y giro ── */
  function estado(p, t, curva) {
    var f = CURVAS[curva] || CURVAS.suave, k = p.k || 1;
    var d = Math.max(1e-3, p.t1 - p.t0), tt = Math.max(0, t - p.t0), u = Math.min(1, tt / d);
    var s = 1, dx = 0, dy = 0, r = 0, b = p.b || 1;
    switch (p.e) {
      case 'lento': s = b + 0.1 * k * f(u); break;
      case 'aleja': s = b + 0.1 * k * (1 - f(u)); break;
      case 'golpe': s = p.z || 1; break;
      case 'impacto': s = b + 0.18 * k * f(Math.max(0, Math.min(1, (t - p.ti) / RAMPA_IMPACTO))); break;
      case 'mano':
        s = Math.max(b, 1.05 + 0.02 * k);
        dx = Math.sin(tt * 1.3) * 0.009 * k; dy = Math.cos(tt * 1.7) * 0.006 * k; r = Math.sin(tt * 0.9) * 0.006 * k;
        break;
      case 'sacude':
        s = Math.max(b, 1.06 + 0.02 * k);
        if (tt < DURA_SACUDIDA) { var a = (1 - tt / DURA_SACUDIDA) * 0.012 * k; dx = Math.sin(tt * 90) * a; dy = Math.cos(tt * 70) * a * 0.7; }
        break;
    }
    return { s: Math.max(1, Math.min(MAX, s)), dx: dx, dy: dy, r: r };
  }

  /* En el instante t del video completo */
  function valor(plan, t, cfg) {
    if (!plan || !plan.length) return { s: 1, dx: 0, dy: 0, r: 0 };
    var i = 0;
    while (i < plan.length - 1 && t >= plan[i].t1) i++;
    return estado(plan[i], t, (cfg && cfg.curva) || 'suave');
  }
  function piezaEn(plan, t) {
    if (!plan || !plan.length) return null;
    var i = 0;
    while (i < plan.length - 1 && t >= plan[i].t1) i++;
    return plan[i];
  }

  /* Para la vista del navegador: el transform de CSS (con transform-origin en el ANCLA) */
  function css(v) {
    return 'translate(' + (v.dx * 100).toFixed(3) + '%,' + (v.dy * 100).toFixed(3) + '%) rotate(' + v.r.toFixed(5) + 'rad) scale(' + v.s.toFixed(5) + ')';
  }

  /* ══ ffmpeg ══ El filtro perspective que hace lo mismo que css() en el video final.
     opts: { fps, c0 (primer cuadro del pedazo en la rejilla del video completo), desde, hasta } — sin pedazos: c0 = 0.
     El tiempo de cada cuadro es (in - 1 + c0) / fps: perspective cuenta los cuadros desde 1 (también en el 4.1;
     medido 19-sep: sin el -1 todo iba un cuadro adelantado). Por cada esquina de la pantalla se calcula de qué punto del
     cuadro original sale (lo inverso de escalar, girar y correr alrededor del ANCLA). */
  function num(x) { return (Math.round(x * 1e6) / 1e6).toString(); }
  function ramaFF(p, curva) {
    var k = p.k || 1, b = p.b || 1, d = Math.max(1e-3, p.t1 - p.t0), T = 'ld(5)', tt = '(' + T + '-' + num(p.t0) + ')';
    var u = 'clip(' + tt + '/' + num(d) + ',0,1)';
    var s = '1', dx = '0', dy = '0', r = '0';
    switch (p.e) {
      case 'lento': s = num(b) + '+' + num(0.1 * k) + '*' + curvaFF(curva, 'ld(4)'); break;
      case 'aleja': s = num(b) + '+' + num(0.1 * k) + '*(1-' + curvaFF(curva, 'ld(4)') + ')'; break;
      case 'golpe': s = num(p.z || 1); break;
      case 'impacto':
        s = num(b) + '+' + num(0.18 * k) + '*' + curvaFF(curva, 'ld(4)');
        u = 'clip((' + T + '-' + num(p.ti) + ')/' + num(RAMPA_IMPACTO) + ',0,1)';
        break;
      case 'mano':
        s = num(Math.max(b, 1.05 + 0.02 * k));
        dx = 'sin(' + tt + '*1.3)*' + num(0.009 * k); dy = 'cos(' + tt + '*1.7)*' + num(0.006 * k); r = 'sin(' + tt + '*0.9)*' + num(0.006 * k);
        break;
      case 'sacude':
        s = num(Math.max(b, 1.06 + 0.02 * k));
        var a = '(1-' + tt + '/' + num(DURA_SACUDIDA) + ')*' + num(0.012 * k);
        dx = 'if(lt(' + tt + ',' + num(DURA_SACUDIDA) + '),sin(' + tt + '*90)*' + a + ',0)';
        dy = 'if(lt(' + tt + ',' + num(DURA_SACUDIDA) + '),cos(' + tt + '*70)*' + a + '*0.7,0)';
        break;
    }
    // 4 = u, 0 = escala (con tope 1..MAX), 1/2 = corrimiento, 3 = giro
    return 'st(4,' + u + ');st(0,clip(' + s + ',1,' + num(MAX) + '));st(1,' + dx + ');st(2,' + dy + ');st(3,' + r + ')';
  }
  function ffmpeg(plan, cfg, opts) {
    if (!plan || !plan.length) return null;
    opts = opts || {};
    var fps = Number(opts.fps) || 30, c0 = Number(opts.c0) || 0;
    var desde = opts.desde != null ? opts.desde - 0.5 : -1e9, hasta = opts.hasta != null ? opts.hasta + 0.5 : 1e9;
    var curva = (cfg && cfg.curva) || 'suave';
    var usar = plan.filter(function (p) { return p.t1 >= desde && p.t0 <= hasta; });
    if (!usar.length) return null;
    // cadena de si-entonces por pedazo (ffmpeg solo evalúa la rama que toca)
    var cadena = ramaFF(usar[usar.length - 1], curva);
    for (var i = usar.length - 2; i >= 0; i--) cadena = 'if(lt(ld(5),' + num(usar[i].t1) + '),' + ramaFF(usar[i], curva) + ',' + cadena + ')';
    var pre = 'st(5,(in-1+' + c0 + ')/' + num(fps) + ');' + cadena + ';';
    var AX = '(W*' + ANCLA.x + ')', AY = '(H*' + ANCLA.y + ')';
    function esquina(px, py, eje) {
      var X = '(' + px + '-' + AX + '-ld(1)*W)', Y = '(' + py + '-' + AY + '-ld(2)*H)';
      return eje === 'x'
        ? pre + AX + '+(cos(ld(3))*' + X + '+sin(ld(3))*' + Y + ')/ld(0)'
        : pre + AY + '+(cos(ld(3))*' + Y + '-sin(ld(3))*' + X + ')/ld(0)';
    }
    var q = function (x) { return "'" + x + "'"; };
    return 'perspective=x0=' + q(esquina('0', '0', 'x')) + ':y0=' + q(esquina('0', '0', 'y')) +
      ':x1=' + q(esquina('W', '0', 'x')) + ':y1=' + q(esquina('W', '0', 'y')) +
      ':x2=' + q(esquina('0', 'H', 'x')) + ':y2=' + q(esquina('0', 'H', 'y')) +
      ':x3=' + q(esquina('W', 'H', 'x')) + ':y3=' + q(esquina('W', 'H', 'y')) +
      ':sense=source:eval=frame:interpolation=linear';
  }

  /* Resumen para mostrar (cuántos pedazos de cada efecto) */
  function resumen(plan) {
    var n = {};
    (plan || []).forEach(function (p) { n[p.e] = (n[p.e] || 0) + 1; });
    return n;
  }

  var API = {
    EFECTOS: EFECTOS, NOMBRES: NOMBRES, CURVAS: CURVAS, INTENSIDAD: INTENSIDAD, ANCLA: ANCLA, MAX: MAX,
    limpiar: limpiar, piezasDe: piezasDe, reloj: reloj, impactosDe: impactosDe,
    dirigir: dirigir, estado: estado, valor: valor, piezaEn: piezaEn, css: css, ffmpeg: ffmpeg, resumen: resumen,
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherryMov = API;
})(typeof window !== 'undefined' ? window : this);

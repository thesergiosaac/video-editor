/* resumen-cuenta.js — lo que Cherry sabe de tu cuenta, en números (22-sep-2026)
 *
 * De aquí sale la tarjeta del inicio: el perfil de Instagram arriba y el resumen abajo. Lee el
 * MISMO documento que guarda el Laboratorio (herramientas_datos › laboratorio) y no escribe nada.
 *
 * ⚠️ Los cortes y la forma de medir son los del Laboratorio, copiados aquí para que el inicio no
 * tenga que cargar sus 300 KB. Si cambian allí (herramientas/laboratorio.html › CORTE, MINIMO_UMBRAL,
 * peldanos, umbral), hay que cambiarlos aquí también. Están marcados uno por uno.
 *
 * Regla que manda en todo el archivo: NO se inventa ni un número. Si el dato no está, la cifra se
 * devuelve null y la tarjeta enseña un guion — nunca un cero que parezca una medición.
 */
(function () {
  'use strict';

  /* ⚠️ copiado de laboratorio.html › CORTE */
  var CORTE = { scroll: 55, entrada: 50, cuerpo: 45, vale: 1.0 };
  /* ⚠️ copiado de laboratorio.html › MINIMO_UMBRAL */
  var MINIMO_UMBRAL = 5;
  /* ── El camino a viral ──────────────────────────────────────────────────────
     Cuántos videos hacen falta para tenerlo todo dicho, y cuántas piezas magnéticas.
     ⚠️ Son de Sergio: si un día le parece que 30 videos es mucho o poco, se cambian aquí. */
  var VIDEOS_PARA_TODO = 30;
  /* Diez, no seis: con seis la calidad marcaba lleno demasiado pronto y el ejemplo de los 20
     videos daba 67 % cuando Sergio dijo 50 %. Diez piezas validadas repartidas entre ideas,
     ganchos, estructuras y formatos es lo que de verdad significa «ya sé lo que me funciona». */
  var MAGNETICAS_PARA_TODO = 10;
  /* Suelo de la calidad: tener videos publicados vale algo aunque nada esté validado todavía.
     Sin este suelo, la cuenta de alguien que empieza marcaría 0 % para siempre y no diría nada. */
  var CALIDAD_MINIMA = 0.15;

  /* Con menos de esto no hay tendencia: dos videos no son una racha. */
  var MINIMO_TENDENCIA = 4;

  var num = function (x) { var n = Number(x); return isFinite(n) ? n : 0; };
  var hay = function (x) { return x != null && x !== '' && isFinite(Number(x)); };

  function mediana(xs) {
    var a = xs.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function media(xs) { return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : 0; }

  /* ⚠️ copiado de laboratorio.html › enSegundo */
  function enSegundo(curva, seg) {
    if (!curva || curva.length < 2) return null;
    if (seg <= curva[0].seg) return curva[0].pct;
    for (var i = 1; i < curva.length; i++) {
      if (seg <= curva[i].seg) {
        var a = curva[i - 1], b = curva[i];
        var t = (seg - a.seg) / Math.max(0.001, b.seg - a.seg);
        return Math.round(a.pct + (b.pct - a.pct) * t);
      }
    }
    return curva[curva.length - 1].pct;
  }

  /* Cuántos peldaños seguidos tiene resueltos UN video, empezando por el primero.
     ⚠️ los cuatro juicios son los de laboratorio.html › peldanos, reducidos a su «ok».
     Un peldaño sin datos corta la cuenta: no se puede dar por resuelto lo que no se ha medido. */
  function peldanosDe(v) {
    var d = v.desmontaje || {};
    var finGancho = (d.gancho && d.gancho.seg) || 3;
    var dur = num(v.dur) || (v.curva && v.curva.length ? v.curva[v.curva.length - 1].seg : 0);

    var ok = [];
    ok.push(hay(v.omisiones) ? num(v.omisiones) <= CORTE.scroll : null);

    var pasa = enSegundo(v.curva, finGancho);
    if (pasa == null && v.caida && v.caida <= finGancho + 1) pasa = 0;
    ok.push(pasa == null ? null : pasa >= CORTE.entrada);

    var alFinal = enSegundo(v.curva, dur || 9999);
    var aguanta = (pasa && alFinal != null && pasa > 0) ? Math.round((alFinal / pasa) * 100) : null;
    ok.push(aguanta == null ? null : aguanta >= CORTE.cuerpo);

    var vis = num(v.visitas);
    var mueve = num(v.guardados) + num(v.reposts) + num(v.enviados);
    var pct = vis > 0 ? Math.round((mueve / vis) * 1000) / 10 : null;
    var pocos = vis > 0 && vis < 300;   // con cuatro gatos esto no dice nada
    ok.push(pct == null || pocos ? null : pct >= CORTE.vale);

    var n = 0;
    for (var i = 0; i < ok.length; i++) { if (ok[i] !== true) break; n++; }
    return n;
  }

  /* ⚠️ copiado de laboratorio.html › umbral. A partir de qué retención despega ESTA cuenta:
     se ordenan por retención y se busca el escalón más grande en visitas. */
  function umbral(vs) {
    var con = vs.filter(function (v) { return hay(v.retencion) && num(v.visitas) > 0; });
    if (con.length < MINIMO_UMBRAL) return null;

    var orden = con.slice().sort(function (a, b) { return a.retencion - b.retencion; });
    var mejor = null;
    for (var i = 1; i < orden.length; i++) {
      var abajo = orden.slice(0, i), arriba = orden.slice(i);
      if (abajo.length < 2 || arriba.length < 2) continue;
      var salto = orden[i].visitas / Math.max(1, orden[i - 1].visitas);
      if (!mejor || salto > mejor.salto) {
        mejor = { salto: salto, corte: (orden[i - 1].retencion + orden[i].retencion) / 2,
                  mA: mediana(abajo.map(function (v) { return v.visitas; })),
                  mB: mediana(arriba.map(function (v) { return v.visitas; })) };
      }
    }
    if (mejor) mejor.veces = mejor.mA > 0 ? mejor.mB / mejor.mA : 0;
    if (!mejor || mejor.salto < 2 || mejor.veces < 2) return null;   // todavía no se ve el escalón
    return { corte: Math.round(mejor.corte), firme: con.length >= 10 };
  }

  /* Dónde se fue la mitad de la gente. Es el dato del video que de verdad importa. */
  function mitad(v) {
    var c = v.curva;
    if (!c || c.length < 2) return null;
    for (var i = 1; i < c.length; i++) {
      if (c[i].pct <= 50 && c[i - 1].pct > 50) {
        var t = (c[i - 1].pct - 50) / Math.max(0.001, c[i - 1].pct - c[i].pct);
        return Math.round((c[i - 1].seg + (c[i].seg - c[i - 1].seg) * t) * 10) / 10;
      }
    }
    return null;   // nunca bajó del 50%: no hay punto de caída que contar
  }

  var interaccionesDe = function (v) {
    return num(v.meGusta) + num(v.comentarios) + num(v.reposts) + num(v.enviados) + num(v.guardados);
  };

  /* Los puntos de la curva llevados a una línea SVG de 100×42, para pintarla dentro del marco.
     Suavizada: Instagram da pocos puntos y uniéndolos con rectas sale un pico anguloso que no se
     parece a como cae la retención. La línea pasa por los MISMOS puntos medidos; lo único que
     cambia es el camino entre uno y otro. */
  function lineaCurva(v) {
    var c = v.curva;
    if (!c || c.length < 2) return null;
    var fin = c[c.length - 1].seg || 1;
    var ps = c.map(function (p) {
      return { x: Math.round((p.seg / fin) * 1000) / 10,
               y: Math.round((1 - Math.max(0, Math.min(100, p.pct)) / 100) * 420) / 10 };
    });
    var d = 'M' + ps[0].x + ' ' + ps[0].y;
    var r = function (n) { return Math.round(n * 10) / 10; };
    for (var i = 0; i < ps.length - 1; i++) {
      var p0 = ps[i - 1] || ps[i], p1 = ps[i], p2 = ps[i + 1], p3 = ps[i + 2] || p2;
      d += ' C' + r(p1.x + (p2.x - p0.x) / 6) + ' ' + r(p1.y + (p2.y - p0.y) / 6) +
           ',' + r(p2.x - (p3.x - p1.x) / 6) + ' ' + r(p2.y - (p3.y - p1.y) / 6) +
           ',' + p2.x + ' ' + p2.y;
    }
    return d;
  }

  function hace(fecha) {
    if (!fecha) return '';
    var d = Math.round((Date.now() - new Date(fecha + 'T12:00:00').getTime()) / 86400000);
    if (!isFinite(d)) return '';
    if (d <= 0) return 'hoy';
    if (d === 1) return 'ayer';
    if (d < 30) return 'hace ' + d + ' días';
    var m = Math.round(d / 30);
    return 'hace ' + m + (m === 1 ? ' mes' : ' meses');
  }

  function mil(n) {
    if (n == null) return '—';
    if (n >= 1000000) return (Math.round(n / 100000) / 10).toString().replace('.', ',') + ' mill.';
    if (n >= 10000) return Math.round(n / 1000) + ' mil';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ── El resumen entero ──
     Recibe el documento del Laboratorio tal cual está guardado. Devuelve siempre un objeto: si la
     cuenta está vacía, `n` vale 0 y las cifras van en null, que es lo que pinta los guiones. */
  /* Cuántas piezas del baúl están validadas.
     ⚠️ Una pieza es MAGNÉTICA cuando se usó dos veces o más y nunca falló. Basta un fallo para
     que baje. Es la misma regla de laboratorio.html › `estadoDe`, reducida: si se cambia allí,
     hay que cambiarla aquí. */
  function magneticasDe(D, cuenta, corte) {
    var vs = (D.videos || []).filter(function (v) {
      return v && cuenta && v.cuenta === cuenta.id && hay(v.retencion);
    });
    var total = 0;
    ['idea', 'gancho', 'estructura', 'formato'].forEach(function (tipo) {
      var por = {};
      vs.forEach(function (v) {
        var id = v.piezas && v.piezas[tipo];
        if (!id) return;
        if (!por[id]) por[id] = { n: 0, aciertos: 0 };
        por[id].n++;
        if (num(v.retencion) >= corte) por[id].aciertos++;
      });
      Object.keys(por).forEach(function (id) {
        var u = por[id];
        if (u.n >= 2 && u.aciertos === u.n) total++;
      });
    });
    return total;
  }

  /* El porcentaje del camino. NO mide lo bueno que fue un video: mide cuánta evidencia tienes
     acumulada sobre lo que te funciona.

     Los dos factores se MULTIPLICAN, no se suman, y esa es la decisión importante: 50 videos sin
     nada validado no está cerca de viral, y 2 videos perfectos tampoco. Sumando, cualquiera de
     los dos alto dispararía el número; multiplicando, hacen falta los dos. */
  function caminoAViral(D, cuenta, medidos, retMejor, u) {
    var corte = (u && u.corte) || CORTE.cuerpo;
    var evidencia = Math.min(medidos.length / VIDEOS_PARA_TODO, 1);
    var magneticas = magneticasDe(D, cuenta, corte);
    var porPiezas = Math.min(magneticas / MAGNETICAS_PARA_TODO, 1);
    var rendimiento = retMejor != null ? Math.min(retMejor / corte, 1) : 0;
    var calidad = Math.max(CALIDAD_MINIMA, (porPiezas + rendimiento) / 2);
    return {
      modo: 'camino',
      pct: Math.max(0, Math.min(100, Math.round(evidencia * calidad * 100))),
      videos: medidos.length, magneticas: magneticas,
      corte: corte, retMejor: retMejor,
      /* para poder explicar el número en vez de solo enseñarlo */
      porque: { evidencia: Math.round(evidencia * 100), calidad: Math.round(calidad * 100) },
    };
  }

  function resumen(D) {
    D = D || {};
    var cuentas = D.cuentas || [];
    var cuenta = cuentas.filter(function (c) { return c.id === D.activa; })[0] || cuentas[0] || null;
    var vs = (D.videos || []).filter(function (v) { return v && cuenta && v.cuenta === cuenta.id; })
      .sort(function (a, b) { return String(a.fecha || a.creado || '').localeCompare(String(b.fecha || b.creado || '')); });

    var medidos = vs.filter(function (v) { return hay(v.visitas) || hay(v.retencion); });
    var perfil = {
      usuario: (cuenta && cuenta.nombre) || '',
      real: (cuenta && cuenta.real) || '',
      bio: (cuenta && cuenta.bio) || '',
      foto: (cuenta && cuenta.foto) || '',
      publicaciones: cuenta && hay(cuenta.publicaciones) ? num(cuenta.publicaciones) : null,
      seguidos: cuenta && hay(cuenta.seguidos) ? num(cuenta.seguidos) : null,
      /* Los seguidores se escriben en el perfil de la marca. Lo intenté sacándolos del último
         video, pero el campo de un video son los seguidores NUEVOS que trajo ese video, no el
         total: la tarjeta decía «1 seguidores» con 50 mil detrás. */
      seguidores: cuenta && hay(cuenta.seguidores) ? num(cuenta.seguidores) : null,
    };

    var R = { cuenta: cuenta, perfil: perfil, n: medidos.length, videos: [], barras: [],
              visitas: null, interacciones: null, retMedia: null, retMejor: null,
              tendencia: null, veces: null, aro: null, desde: '' };
    /* ⚠️ Sin un solo video medido el aro también es un porcentaje, y vale 0. Antes devolvía la
       forma vieja de peldaños y la tarjeta pintaba un aro distinto según la marca que miraras. */
    if (!medidos.length) {
      R.aro = { modo: 'camino', pct: 0, videos: 0, magneticas: 0, corte: CORTE.cuerpo,
                retMejor: null, porque: { evidencia: 0, calidad: 0 } };
      return R;
    }

    var conVisitas = medidos.filter(function (v) { return hay(v.visitas); });
    var conRet = medidos.filter(function (v) { return hay(v.retencion); });
    if (conVisitas.length) R.visitas = conVisitas.reduce(function (a, v) { return a + num(v.visitas); }, 0);
    R.interacciones = medidos.reduce(function (a, v) { return a + interaccionesDe(v); }, 0) || null;
    if (conRet.length) {
      R.retMedia = Math.round(media(conRet.map(function (v) { return num(v.retencion); })));
      R.retMejor = Math.max.apply(null, conRet.map(function (v) { return num(v.retencion); }));
    }
    R.desde = hace(medidos[0].fecha || medidos[0].creado);

    /* ⚠️ EL ARO ES SIEMPRE UN PORCENTAJE. Antes eran «2 de 4 peldaños» mientras no hubiera
       umbral, y el salto de una cosa a otra era confuso: el mismo aro medía dos cosas distintas
       según cuántos videos llevaras. Ahora mide una sola, desde el primer video. */
    var u = umbral(medidos);
    R.aro = caminoAViral(D, cuenta, medidos, R.retMejor, u);
    if (u) { R.aro.firme = u.firme; R.aro.faltan = Math.max(0, u.corte - (R.retMejor || 0)); }

    /* El avance: una barra por video, en orden, sumando visitas e interacciones — que es como
       Sergio lo pidió: si el primero hizo 100 y el segundo 200, eso es avance. */
    var pesos = medidos.map(function (v) { return num(v.visitas) + interaccionesDe(v); });
    var tope = Math.max.apply(null, pesos) || 1;
    /* Con la raiz: de 820 a 18.400 en linea recta deja las primeras en un pixel y no se ve la
       forma del crecimiento, que es justo lo que la grafica tiene que contar. */
    R.barras = pesos.map(function (p) { return Math.max(6, Math.round(Math.sqrt(p / tope) * 100)); });
    if (pesos.length >= 2 && pesos[0] > 0) R.veces = Math.round((pesos[pesos.length - 1] / pesos[0]) * 10) / 10;

    /* La tendencia: la mitad reciente contra la mitad antigua. Un solo video bueno no es una racha,
       y comparar el último con el anterior convierte cualquier casualidad en flecha verde. */
    if (medidos.length >= MINIMO_TENDENCIA) {
      var corte = Math.floor(medidos.length / 2);
      var viejos = medidos.slice(0, corte), nuevos = medidos.slice(medidos.length - corte);
      var cambio = function (saca) {
        var a = media(viejos.map(saca)), b = media(nuevos.map(saca));
        return a > 0 ? Math.round(((b - a) / a) * 100) : null;
      };
      R.tendencia = { visitas: cambio(function (v) { return num(v.visitas); }),
                      interacciones: cambio(interaccionesDe) };
    }

    /* Los videos que rotan en la tarjeta: los más recientes primero, hasta tres. */
    R.videos = medidos.slice().reverse().slice(0, 3).map(function (v) {
      return {
        id: v.id,
        titulo: v.titulo || 'Sin título',
        cuando: hace(v.fecha || v.creado),
        ret: hay(v.retencion) ? num(v.retencion) : null,
        visitas: hay(v.visitas) ? num(v.visitas) : null,
        interacciones: interaccionesDe(v) || null,
        mitad: mitad(v),
        curva: lineaCurva(v),
        tapa: v.tapa || '',
      };
    });
    return R;
  }

  window.CherryResumen = { resumen: resumen, mil: mil, hace: hace, CORTE: CORTE };
})();

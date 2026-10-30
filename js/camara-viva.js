/* camara-viva.js — TÚ HABLANDO en el estilo «Cámara viva» (29-oct-2026). EL MISMO ARCHIVO corre en la página y en el
 * ensamblador, como movimiento.js: del plan del director (servidor/director.ts) y de dónde está tu cara saca
 *   1. la CÁMARA: los encuadres (keyframes) que movimiento.js aplica a tu video (CSS en el celular, ffmpeg en el final);
 *   2. los TÍTULOS: dónde va cada uno (al lado de tu cara, nunca encima; o arriba) y cuándo entra.
 *
 * Los números son los del reel del Día 4 («Cherry 9», aprobado por Sergio; guía en Cherry Taller\camara-viva):
 *   · «corre»: curva en S de ×1 a ×1,5 en 0,95 s, corriéndote 268 px hacia el lado donde ya estás (así queda libre el otro)
 *     y 120 px abajo para que tu cabeza no se suba; el título entra al 85 % de la curva.
 *   · «golpe»: zoom inmediato (un cuadro) a ×1,32 y vuelve a ×1 en 1 s; el título va arriba.
 *   · «suave»: acercamiento lento a ×1,14.
 *   · el gancho (el primer momento): arranca en ×1,66 sobre tu cara y se aleja a ×1 en 1,1 s; su título va arriba.
 *   · nunca quieta: entre cambios se sigue acercando despacio (×0,024 por segundo).
 *   · zona segura de las letras: 96 px a los lados, 260 arriba, 420 abajo (Instagram tapa abajo).
 * Todo en el cuadro de 1080 × 1920. */
(function (raiz) {
  'use strict';

  var W = 1080, H = 1920;
  var MARGEN = { lado: 96, arriba: 260, abajo: 420 };
  var DERIVA = 0.024;

  /* ── tu cara: la más cercana a t en la lista [[t, x, y, w, h], …] (x, y = su centro). Sin dato: centro y no segura. ── */
  function caraEn(caras, t) {
    var mejor = null, dist = 9;
    for (var i = 0; i < (caras || []).length; i++) {
      var c = caras[i];
      if (c[1] == null) continue;
      var d = Math.abs(c[0] - t);
      if (d < dist) { dist = d; mejor = c; }
      if (c[0] > t + 1.5) break;
    }
    return mejor ? { x: mejor[1], y: mejor[2], w: mejor[3], h: mejor[4], dist: dist } : { x: 540, y: 760, w: 300, h: 300, dist: 9 };
  }
  function ladoDe(caras, t) { return caraEn(caras, t).x < 560 ? -1 : 1; }

  /* ── los encuadres: [{ t, z, x, y, dur, n }] (x, y en px; n = fuerza de la S) ── */
  /* (29-oct) Sergio: «hace un par de movimientos y repite el mismo ciclo». Cada cámara tiene variantes que se turnan:
       corre  — normal · rápida · barrido (entra desde el otro lado)
       golpe  — vuelve · se queda empujando despacio
       suave  — se acerca · se aleja · paneo lento de lado a lado
     (30-oct) Y el director a veces pide casi siempre «corre» (medido en el Proyecto 14: 13 de 16, siempre al mismo lado):
     aquí nunca van más de 2 seguidos (el siguiente va como golpe o suave, con el título arriba) y uno de cada dos corre
     va hacia el otro lado si tu cara está cerca del centro (si no, el título no cabría a tu lado).
     (30-oct) Los turnos se cuentan con lo que armó el DIRECTOR (m.orig): editar un momento no cambia la cámara de los demás. Lo que la
     persona escogió (camaraFija) o la lámina que quitó van aparte. `camaras[i]` = la que se ve (la que marca el editor). */
  function planos(momentos, caras) {
    var kf = [], titulos = [], ultimo = null, turno = { corre: 0, golpe: 0, suave: 0 }, seguidas = 0, relevo = 0, nLado = 0, camaras = {};
    (momentos || []).forEach(function (m, i) {
      var o = m.orig || m, t = m.t0, gancho = i === 0 && t < 0.3;
      // el turno, siempre sobre lo del director (y aunque la persona haya cambiado este)
      var base = null, nTurno = 0, otroLado = false;
      if (o.tipo === 'hablando') {
        base = o.camara;
        if (base === 'corre') { if (seguidas >= 2) { base = relevo++ % 2 ? 'suave' : 'golpe'; seguidas = 0; } else seguidas++; } else seguidas = 0;
        if (!gancho && turno[base] != null) nTurno = turno[base]++;
        if (!gancho && base === 'corre') otroLado = !!(nLado++ % 2);
      }
      if (m.tipo !== 'hablando') { ultimo = null; return; }
      var tt = m.titulo || null, a, donde = 'lado';
      var vieneDeCorte = !ultimo;                                // después de una lámina (o al empezar) arranca un plano nuevo
      var fija = !!m.camaraFija, camara = fija ? m.camara : base || 'suave';
      if (fija) { nTurno = 0; otroLado = false; }
      camaras[i] = gancho && !fija ? 'golpe' : camara;
      if (gancho && !fija) {                                      // el gancho
        kf.push({ t: 0, z: 1.66, y: 150, dur: 0.01 }, { t: 0.04, z: 1, dur: 1.1, n: 2.5 });
        a = 0.05; donde = 'arriba';
      } else if (camara === 'golpe') {
        var vg = nTurno % 2;
        if (vg === 0) kf.push({ t: t, z: 1.32, y: 90, dur: 0.01 }, { t: t + 0.02, z: 1, dur: 1, n: 2.5 });   // golpe y vuelve
        else kf.push({ t: t, z: 1.18, y: 130, dur: 0.01 }, { t: t + 0.02, z: 1.26, y: 170, dur: Math.max(1.2, m.t1 - t), n: 1.6 });   // y sigue empujando (bajo: el título va arriba y tu pelo no lo puede tapar)
        a = t + 0.02; donde = 'arriba';
      } else if (camara === 'corre') {
        var vc = nTurno % 3, ld = ladoDe(caras, t + 0.6);
        if (otroLado && Math.abs(caraEn(caras, t + 0.6).x - W / 2) < 130) ld = -ld;
        if (vc === 2) kf.push({ t: t, z: 1.32, x: -200 * ld, y: 100, dur: 0.01 });   // barrido: entra desde el otro lado
        else if (vieneDeCorte) kf.push({ t: t, z: 1, dur: 0.01 });
        var pl = vc === 1 ? { t: t + 0.04, z: 1.42, x: 250 * ld, y: 140, dur: 0.6, n: 3 }    // rápida
          : { t: t + 0.06, z: 1.5, x: 268 * ld, y: 120, dur: vc === 2 ? 0.75 : 0.95 };
        kf.push(pl); a = pl.t + pl.dur * 0.85;
      } else {                                                    // suave
        var vs = nTurno % 3, dura = Math.max(1.3, m.t1 - t - 0.1), ls = (nTurno + 1) % 2 ? 1 : -1;
        if (vs === 1) kf.push({ t: t, z: 1.22, y: 90, dur: 0.01 }, { t: t + 0.02, z: 1.02, y: 20, dur: dura, n: 1.6 });   // se aleja
        else if (vs === 2) kf.push({ t: t, z: 1.12, x: -55 * ls, y: 60, dur: 0.01 }, { t: t + 0.02, z: 1.12, x: 55 * ls, y: 60, dur: dura, n: 1.4 });   // paneo
        else {
          if (vieneDeCorte) kf.push({ t: t, z: 1, dur: 0.01 });
          kf.push({ t: t + 0.06, z: 1.14, y: 70, dur: 1.3 });                                          // se acerca
        }
        a = t + 0.2; donde = 'arriba';
      }
      if (tt && tt.gruesa) titulos.push({ a: a, b: Math.max(a + 0.6, m.t1 - 0.05), donde: donde, titulo: tt });
      ultimo = m;
    });
    kf.sort(function (p, q) { return p.t - q.t; });
    return { kf: kf, titulos: titulos, camaras: camaras };
  }

  /* ── la curva en S y el encuadre en el instante t (mismo cálculo que movimiento.js manda a ffmpeg) ── */
  function S(x, n) { return x < 0.5 ? Math.pow(2, n - 1) * Math.pow(x, n) : 1 - Math.pow(-2 * x + 2, n) / 2; }
  function deriva(d) { return DERIVA * d * Math.min(1, Math.max(0, d / 0.6)); }
  function limita(z, x, y) {
    var zz = Math.max(1, z), mx = (zz - 1) * W / 2, my = (zz - 1) * H / 2;
    return { z: zz, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  }
  /* Cada keyframe arranca desde donde iba la cámara (con su deriva) y llega a su valor con la S; después deriva despacio.
     tramos() lo deja precalculado: { t, d, n, z0, x0, y0, z1, x1, y1 } por keyframe (lo usan esta función y ffmpeg). */
  function tramos(kf) {
    var out = [], z = 1, x = 0, y = 0, llegada = 0;
    (kf || []).forEach(function (k) {
      var zIni = z + deriva(Math.max(0, k.t - llegada));
      var tr = { t: k.t, d: Math.max(0.01, k.dur != null ? k.dur : 1.2), n: k.n || 2.5, z0: zIni, x0: x, y0: y,
                 z1: k.z, x1: k.x || 0, y1: k.y || 0 };
      out.push(tr);
      z = tr.z1; x = tr.x1; y = tr.y1; llegada = tr.t + tr.d;
    });
    return out;
  }
  function encuadre(tr, t) {
    if (!tr || !tr.length || t < tr[0].t) return { z: 1, x: 0, y: 0 };
    var i = 0;
    while (i < tr.length - 1 && t >= tr[i + 1].t) i++;
    var r = tr[i], u = (t - r.t) / r.d;
    if (u < 1) { var k = S(Math.max(0, u), r.n); return limita(r.z0 + (r.z1 - r.z0) * k, r.x0 + (r.x1 - r.x0) * k, r.y0 + (r.y1 - r.y0) * k); }
    return limita(r.z1 + deriva(t - r.t - r.d), r.x1, r.y1);
  }

  /* ── dónde cae tu cara en la pantalla después de la cámara (la de YuNet se agranda para el pelo y las orejas) ── */
  function caraPantalla(caras, tr, t) {
    var c = caraEn(caras, t), e = encuadre(tr, t);
    var w = c.w * 1.45 * e.z, h = c.h * 1.65 * e.z;
    var cx = W / 2 + (c.x - W / 2) * e.z + e.x, cy = H / 2 + (c.y - H / 2) * e.z + e.y - c.h * 0.15 * e.z;
    return { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2, seguro: c.dist < 0.35 };
  }

  /* ── la caja de un título: al lado con más espacio (mín. 330 px), y si no cabe o no se sabe dónde está tu cara, arriba ── */
  function cajaTitulo(caras, tr, ti, ancho, alto) {
    ancho = ancho || 400; alto = alto || 300;
    var arriba = { left: MARGEN.lado, top: MARGEN.arriba, width: W - 2 * MARGEN.lado, align: 'center', donde: 'arriba' };
    if (ti.donde === 'arriba') return arriba;
    var c = caraPantalla(caras, tr, ti.a + 0.15), gap = 40;
    if (!c.seguro) return arriba;
    var libreDer = W - MARGEN.lado - (c.r + gap), libreIzq = c.l - gap - MARGEN.lado;
    var top = Math.max(MARGEN.arriba, Math.min(H - MARGEN.abajo - alto, (c.t + c.b) / 2 - alto / 2));
    if (libreDer >= 330 && libreDer >= libreIzq) { var an = Math.min(ancho, libreDer); return { left: c.r + gap + Math.min(30, libreDer - an), top: top, width: an, align: 'left', donde: 'der' }; }
    if (libreIzq >= 330) { var an2 = Math.min(ancho, libreIzq); return { left: c.l - gap - an2 - Math.min(30, libreIzq - an2), top: top, width: an2, align: 'right', donde: 'izq' }; }
    return arriba;
  }

  /* ── todo junto: del plan del director a la cámara y los títulos con su lugar ── */
  function preparar(plan, caras) {
    var momentos = (plan && plan.momentos) || [];
    var p = planos(momentos, caras), tr = tramos(p.kf);
    p.titulos.forEach(function (ti) { ti.caja = cajaTitulo(caras, tr, ti); ti.estilo = (plan && plan.estiloTexto) || null; ti.acento = (plan && plan.acento) || null; });
    return { kf: p.kf, tramos: tr, titulos: p.titulos, camaras: p.camaras };
  }

  /* ── LAS LÁMINAS del plan, listas para dibujar (premium/src/cv/laminas.tsx, v4): cuándo entra cada línea (en la palabra
     en que la dices), cuándo va el zoom inmediato, el color del fondo y el objeto. material(m, i) da el recorte: el de la
     persona o, si todavía no hay, uno de EJEMPLO (Sergio, 29-oct: «nunca nada provisional: siempre como va a quedar»). ── */
  var norm = function (w) { return String(w || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u00f1]/g, ''); };
  function tiempoDe(texto, m, palabras, siNo) {
    var w0 = norm(String(texto || '').split(' ')[0]);
    if (w0 && palabras) for (var k = m.desde; k <= m.hasta && k < palabras.length; k++) if (norm(palabras[k].word || palabras[k].w) === w0) return Math.max(m.t0, palabras[k].start != null ? palabras[k].start - 0.12 : palabras[k].s - 0.12);
    return siNo;
  }
  var nPal = function (x) { return String(x || '').split(' ').filter(Boolean).length; };
  /* (30-oct) LÁMINA Y LÁMINA. Sergio: «no siempre debe ser video lámina video lámina… la cámara hace el movimiento a la derecha y descubre
     otra imagen o un gráfico; parece una sola lámina y el resto de la información está fuera de pantalla» (referencia de kayn.marketing).
     Dos láminas pegadas (menos de 0,6 s entre ellas) comparten el fondo y la cámara viaja de una a la otra. Hacia la derecha casi siempre
     y de vez en cuando hacia abajo, como la referencia. Si las dos llevan tu video no se puede (es uno solo): ahí la segunda entra como siempre. */
  var RUMBOS = ['der', 'der', 'abajo'], PEGADA = 0.6;
  var conHueco = function (o, mat) { return !o || o.tipo === 'clip' || (o.tipo === 'imagen' && !(mat && mat.objeto)); };
  function piezas(plan, palabras, material) {
    var out = [], fondo = (plan && plan.fondo) || null, nRumbo = 0, ms = (plan && plan.momentos) || [];
    ms.forEach(function (m, i) {
      if (m.tipo !== 'lamina') return;
      var tx = m.texto || {}, a = m.t0;
      var tC = tiempoDe(tx.chica, m, palabras, a + 0.05);
      var tG = Math.max(tx.chica ? tC + 0.2 + nPal(tx.chica) * 0.06 : a + 0.05, tiempoDe(tx.gruesa, m, palabras, tC + 0.3 + nPal(tx.chica) * 0.06));
      tG = Math.min(tG, Math.max(a + 0.05, m.t1 - 0.7));          // la gruesa nunca entra cuando ya se va la lámina
      var z = (m.zoom || [])[0], pz = palabras && z != null && palabras[z] ? (palabras[z].start != null ? palabras[z].start : palabras[z].s) - 0.06 : null;
      var mm = { plantilla: 'lamina', t0: m.t0, t1: m.t1, fondo: m.fondo || fondo, texto: tx, objeto: m.objeto || { tipo: 'clip' },
                 zoomT: pz, semilla: i, orden: out.length, tiempos: { chica: tC, gruesa: tG }, estiloTexto: (plan && plan.estiloTexto) || null, acento: (plan && plan.acento) || null };
      var mat = material ? material(mm, out.length) : {}, ant = out[out.length - 1];
      if (ant && ms[i - 1] && ms[i - 1].tipo === 'lamina' && mm.t0 - ant.m.t1 < PEGADA) {
        ant.m.t1 = mm.t0;                                         // sin hueco: nunca se asoma tu video entre las dos
        mm.t00 = ant.m.t00 != null ? ant.m.t00 : ant.m.t0;
        mm.ladoG = ant.m.ladoG != null ? ant.m.ladoG : ant.m.semilla;
        mm.nPasos = ant.m.nPasos || 0;
        if (!(conHueco(ant.m.objeto, ant.mat) && conHueco(mm.objeto, mat))) {
          ant.m.sigue = true;
          mm.nPasos++;
          mm.paso = { dir: RUMBOS[nRumbo++ % RUMBOS.length], ant: { m: Object.assign({}, ant.m, { paso: null }), mat: ant.mat } };
        }
      }
      out.push({ m: mm, mat: mat });
    });
    return out;
  }

  var API = { W: W, H: H, MARGEN: MARGEN, caraEn: caraEn, planos: planos, tramos: tramos, encuadre: encuadre, S: S,
              deriva: deriva, caraPantalla: caraPantalla, cajaTitulo: cajaTitulo, preparar: preparar, piezas: piezas };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.CherryCV = API;
})(typeof window !== 'undefined' ? window : this);

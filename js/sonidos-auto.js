/* sonidos-auto.js — Cherry pone los efectos de sonido en TODO el video (24-sep-2026)
 *
 * Sergio: «en la tarjeta de sonido quisiera un botón para agregar efectos de sonido a criterio de Cherry en todo el
 * video. Cherry mismo analizará dónde agregarlos y qué sonidos. Te recomiendo agregarlo siempre en todos los
 * movimientos de cámara. Y yo desde el guion voy a poder borrar los que no me gusten o añadir otros».
 *
 * DÓNDE: en lo que se VE que pasa, con los mismos cálculos que el ensamblador (así el sonido cae en el cuadro justo):
 *   · cada movimiento de cámara (CherryMov.dirigir: el mismo director que hornea el movimiento) — golpe de zoom,
 *     zoom de impacto, sacudida, acercamiento y alejamiento; «cámara en mano» no tiene un instante, no lleva;
 *   · la entrada de cada escena de apoyo, de cada grabación de pantalla y de cada gráfico;
 *   · las frases de impacto (si la cámara no les pone ya su zoom).
 *   Mientras una escena tapa a la persona no se oye su cámara (no se ve). Entre dos efectos, al menos HUECO: si dos
 *   caen juntos, gana el más importante. Los que Sergio puso a mano se respetan (no se ponen otros encima).
 * QUÉ: cada momento tiene su familia de sonidos cortos (un golpe de zoom es un whoosh rápido, un gráfico es un «pop»)
 *   y se van turnando: nunca el mismo dos veces seguidas.
 *
 * (2-oct-2026) CADA GRÁFICO SUENA EN SUS PROPIOS MOMENTOS. Antes un gráfico llevaba UN «pop» en su entrada. Ahora cada
 *   tipo dice lo que pasa por dentro y cuándo (medido en sus plantillas: ver docs/SONIDOS.md › «Sonidos atados al
 *   gráfico»): entra, aterriza, cada ficha que aparece, la cuenta del número, el remate (la insignia, el «listo»), el
 *   sello y la salida. Algunos van en dos capas, como en los videos de Sergio (whoosh + golpe en el corte de la
 *   persiana, golpe hondo + seco en el sello). Dentro de un gráfico basta PISTA_HUECO entre efectos; la cámara que se
 *   mueva mientras el gráfico está en pantalla no suena (se oye el gráfico).
 *
 * Quedan como sonidos normales del Guion, marcados `auto` (con su `motivo`): se cambian, se mueven o se borran igual
 * que los puestos a mano. El que Sergio toca deja de ser de Cherry (ver sonidos-guion.js): «Volver a repartir» y
 * «Quitar los de Cherry» ya no lo tocan.
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const S = () => window.CherrySonidos || null;
  const MOV = () => window.CherryMov || null;
  const lista = () => (Array.isArray(C.state.sonidos) ? C.state.sonidos : []);

  const HUECO = 0.9;          // segundos mínimos entre dos golpes de efecto
  /* Cada momento: de qué grupo es (para el resumen), qué tanto manda si choca con otro, a qué volumen y con qué sonidos.
     La entrada de una escena o una pantalla es una transición y va antes que una frase de impacto (con el proyecto 21, al
     revés, de 5 escenas solo 2 sonaban).
     VOLUMEN (24-sep, noche): Sergio, «los que puso Cherry casi no los escucho, deben sonar más, que realmente se noten».
     Iban de 35 % a 65 % y, con la voz de estudio, 3 dB más abajo: el acercamiento lento quedaba al ~25 %, tapado por
     la voz. Ahora van de 85 % a 110 %. */
  const TIPOS = {
    impacto:  { grupo: 'camara',   prio: 9, vol: 110, sonidos: ['impact-hit-1', 'impact-hit-3', 'impact-hit', 'impact-hit-4', 'impact-hit-2', 'swoosh-sharp-hit-2'] },
    frase:    { grupo: 'frase',    prio: 7, vol: 100, sonidos: ['impact-hit-3', 'impact-hit-1', 'impact-hit-4', 'impact-hit'] },
    escena:   { grupo: 'escena',   prio: 8, vol: 100, sonidos: ['swoosh-sharp-hit', 'short-whoosh-metal', 'swish-slicing', 'swoosh-crash', 'swoosh'] },
    pantalla: { grupo: 'pantalla', prio: 8, vol: 100, sonidos: ['swoosh-1', 'swish-1', 'whoosh-achievement'] },
    grafico:  { grupo: 'grafico',  prio: 6, vol: 90, sonidos: ['pop-sound', 'ui-sound-4', 'button-pressed', 'ui-sound-6', 'ui-back-sound'] },
    sacude:   { grupo: 'camara',   prio: 5, vol: 100, sonidos: ['inception-thump', 'impact-hit-launch', 'swoosh-crash'] },
    golpe:    { grupo: 'camara',   prio: 4, vol: 100, sonidos: ['fast-whoosh', 'swish-2', 'swoosh-fast-1', 'swoosh-quick-low', 'simple-whoosh-1', 'swoosh-fast-with-thud'] },
    aleja:    { grupo: 'camara',   prio: 3, vol: 90, sonidos: ['cinematic-reverse-6', 'cinematic-reverse-10', 'cinematic-reverse-5'] },
    lento:    { grupo: 'camara',   prio: 2, vol: 85, sonidos: ['swoosh', 'swoosh2', 'swish-3', 'swoosh-5'] },
  };
  /* (2-oct) Los momentos de dentro de un gráfico: qué suena (se turnan) y a qué volumen. `capas`: suenan JUNTOS. */
  const PISTA_HUECO = 0.18;   // segundos mínimos entre dos efectos del mismo gráfico
  const PAPELES = {
    entra:    { prio: 6.5, vol: 70, sonidos: ['swoosh-fast-1', 'fast-whoosh', 'swoosh-quick-low', 'simple-whoosh-1'] },
    abre:     { prio: 6.5, vol: 75, sonidos: ['swoosh-quick-low', 'swoosh-sharp-hit', 'whoosh-achievement'] },
    aterriza: { prio: 6, vol: 65, sonidos: ['pop-sound', 'ui-sound-4', 'button-pressed'] },
    ficha:    { prio: 5, vol: 50, sonidos: ['click-button', 'pop-sound', 'button-pressed'] },
    cuenta:   { prio: 5, vol: 50, sonidos: ['ui-sound-4'] },
    tic:      { prio: 4.5, vol: 40, sonidos: ['click-button'] },          // una rueda que gira: siempre el mismo tic
    apaga:    { prio: 6.5, vol: 55, sonidos: ['cinematic-reverse-6', 'cinematic-reverse-10'] },   // el color se va (blanco y negro)
    vuelve:   { prio: 4, vol: 55, sonidos: ['whoosh-achievement'] },                             // el color vuelve
    aviso:    { prio: 5.5, vol: 55, sonidos: ['notification-1'] },                               // llega una notificación
    anillo:   { prio: 6.5, vol: 70, sonidos: ['deep-whoosh-3', 'deep-whoosh-2'] },               // un anillo se abre alrededor
    cambia:   { prio: 6.5, vol: 75, sonidos: ['swish-2', 'swoosh-quick-low', 'fast-whoosh', 'swoosh-fast-1'] },   // la tarjeta cambia de golpe
    remate:   { prio: 5.5, vol: 50, sonidos: ['success', 'chime', 'notification-1'] },
    sello:    { prio: 8.5, capas: [['cinematic-heavy-hit', 95], ['deep-hit-3', 75]] },
    corte:    { prio: 7.5, capas: [['swoosh-sharp-hit', 80], ['impact-hit-1', 55]] },
    cae:      { prio: 7, vol: 85, sonidos: ['inception-thump', 'deep-hit-3', 'impact-hit-3'] },
    cursiva:  { prio: 4, vol: 45, sonidos: ['swish-2', 'simple-whoosh-1'] },
    sale:     { prio: 3, vol: 40, sonidos: ['swoosh-quick-low', 'simple-whoosh-1', 'swish-2'] },
  };
  /* La tarjeta de vidrio: entra en t0 (pico del movimiento a +0,15), aterriza con su rebote (+0,40), sale en t1-0,5 (la
     mitad de su salida, t1-0,3). Los de pantalla partida o completa: el video se encoge (t0+0,3) y vuelve (t1-0,55). */
  const GRUPO = ['porcentaje', 'comparacion', 'medidor', 'reparto', 'cuota', 'balanza'];
  /* Lo que pasa dentro de un gráfico: [[segundo del video, papel], …]. Tiempos medidos en sus plantillas (premium). */
  function pistasGrafico(g) {
    const t0 = Number(g.t0), t1 = Number(g.t1), tipo = String(g.tipo || '');
    const m = (Array.isArray(g.marcas) && g.marcas.length ? g.marcas : [t0 + 0.4]).map(Number);
    const ml = m[m.length - 1], d = g.datos || {};
    const P = [];
    const pon = (t, papel) => { if (isFinite(t) && t >= t0 - 0.05 && t <= t1 + 0.05) P.push([t, papel]); };
    const fichas = (dt) => m.slice(0, 5).forEach((x) => pon(x + dt, 'ficha'));
    if (tipo === 'pe_reto') {
      /* (2-oct) LA BARRA DEL RETO: la tarjeta entra, el número cuenta, aparece la meta (ficha) y la barra se llena (remate) */
      const tm = m.length > 1 ? m[1] : t0 + 0.9;
      pon(t0 + 0.15, 'entra'); pon(t0 + 0.4, 'cuenta'); pon(tm, 'ficha'); pon(tm + 0.9, 'remate'); pon(t1 - 0.3, 'sale');
      return P;
    }
    if (tipo === 'pe_noche') {
      /* (2-oct) NOCHE Y AMANECER: la imagen se apaga (reverso), llega la notificación, el reloj aparece (ui) y, si amanece,
         el whoosh largo; la salida suave. El amanecer: la segunda marca si cae dentro (graficos.js › tramosNoche). */
      pon(t0 + 0.12, 'apaga');
      if (d.aviso) pon(t0 + 0.35, 'aviso');
      if (d.hora) pon(t0 + 0.6, 'cuenta');
      if (m.length > 1 && m[1] > t0 + 1 && m[1] < t1 - 1) pon(m[1] + 0.1, 'vuelve');
      pon(t1 - 0.3, 'sale');
      return P;
    }
    if (tipo === 'pe_anillos') {
      /* (2-oct) ANILLOS: cada anillo se abre con un whoosh grave, el contador hace tic, y en el último salen las ondas */
      m.slice(0, 3).forEach((x, i) => { pon(x + 0.15, 'anillo'); if (d.items && d.items[i] && Number(d.items[i].valor) > 0) pon(x + 0.45, 'cuenta'); });
      pon(m[Math.min(2, m.length - 1)] + 0.7, 'vuelve');
      pon(t1 - 0.3, 'sale');
      return P;
    }
    if (tipo === 'pe_bn') {
      /* (2-oct) BLANCO Y NEGRO + TU COLOR: el color se va (reverso), el número cuenta (ui) y aterriza (campanita), la nota a mano
         (swish) y el color vuelve (whoosh). La nota: en la segunda marca si cae dentro, si no a 1,4 s (plantilla bn.tsx). */
      const dura = t1 - t0, tn = m.length > 1 && m[1] - t0 > 0.6 && m[1] - t0 < dura - 0.8 ? m[1] - t0 : Math.min(1.4, dura - 1);
      pon(t0 + 0.12, 'apaga');
      pon(t0 + 0.3, 'cuenta');
      pon(t0 + 1.7, 'remate');
      if (d.nota) pon(t0 + tn + 0.05, 'cursiva');
      pon(t1 - 0.2, 'vuelve');
      return P;
    }
    if (tipo === 'pe_plena') {
      /* (2-oct) LA TARJETA PLENA: entra con el corte doble y cada cambio de tarjeta es un whoosh seco; sale suave */
      pon(t0 + 0.04, 'corte');
      m.slice(1, 4).forEach((x) => pon(x - 0.04, 'cambia'));
      pon(t1 - 0.15, 'sale');
      return P;
    }
    if (tipo === 'pe_falso') {
      /* (2-oct) LA PANTALLA CON SELLO: sube (whoosh), la rueda de la alarma hace tic cada vez más espaciado hasta frenar (o el
         interruptor hace clic), y en la corrección cae el sello con el golpe doble. El sello: en la corrección si llega entre
         1,2 y 5 s después; si no, 2 s después (graficos.js › selloDe). */
      const b1 = m.length > 1 ? m[1] : NaN, a1 = t0 + 0.04;
      const ts = isFinite(b1) && b1 - a1 >= 1.2 && b1 - a1 <= 5 ? b1 : a1 + 2.0;
      pon(t0 + 0.2, 'abre');
      if (d.hora) [0.45, 0.62, 0.8, 1.0, 1.25].forEach((k) => { const x = t0 + 0.15 + (ts - t0 - 0.4) * k; if (x < ts - 0.2) pon(x, 'tic'); });
      else pon(t0 + 0.7, 'ficha');
      pon(ts, 'sello');
      pon(t1 - 0.2, 'sale');
      return P;
    }
    if (/^pe_/.test(tipo)) {
      /* LA PERSIANA: corte en seco en la palabra, la palabra que cae (aterriza a los 0,5 s de empezar a caer) y la cursiva */
      const T = { pe_tarjeta: [0.5, 0.75], pe_cifra: [0.5, null], pe_vs: [0.5, null], pe_clipv: [0.9, 1.1], pe_cliph: [0.8, 1.05],
                  pe_foto: [0.85, 1.05], pe_ventana: [0.95, 1.15], pe_empuja: [1.0, 1.25], pe_sales: [0.9, 1.1], pe_tu: [0.5, 1.1] }[tipo] || [0.5, null];
      pon(t0 + 0.04, 'corte');
      if (tipo === 'pe_lista') m.slice(0, 5).forEach((x) => pon(x + 0.34, 'cae'));
      else pon(t0 + T[0], 'cae');
      if (/^pe_(clipv|cliph|foto)$/.test(tipo)) pon(t0 + 0.5, 'aterriza');           // el clip o la foto cae antes que la palabra
      if (tipo === 'pe_vs') pon(t0 + 0.8, 'cae');                                         // la de abajo
      if (tipo === 'pe_cifra') { pon(t0 + 0.55, 'cuenta'); pon(t0 + Math.max(0.8, Math.min(1.7, (t1 - t0) - 0.7)), 'remate'); }
      if (T[1] != null) pon(t0 + T[1], 'cursiva');
      if (/^pe_(ventana|empuja|sales)$/.test(tipo)) pon(t1 - 0.25, 'sale');               // tu video vuelve
      return P;
    }
    if (tipo === 'mito') {
      pon(m[0], 'entra'); pon(m[0] + 0.3, 'aterriza'); pon(m[0] + 0.55, 'sello');      // MITO entra y lo tachan
      if (m[1] != null) { pon(m[1], 'entra'); pon(m[1] + 0.3, 'remate'); }               // REALIDAD y su visto bueno
      pon(t1 - 0.5, 'sale');
      return P;
    }
    if (GRUPO.indexOf(tipo) >= 0) { pon(t0 + 0.3, 'abre'); pon(t1 - 0.55, 'sale'); }
    else { pon(t0 + 0.15, 'entra'); pon(t0 + 0.4, 'aterriza'); pon(t1 - 0.3, 'sale'); }
    switch (tipo) {
      case 'numero': case 'meta': pon(m[0], 'cuenta'); pon(m[0] + 1.25, 'remate'); break;
      case 'porcentaje': pon(m[0], 'cuenta'); pon(m[0] + 1.2, 'remate'); break;
      case 'lista': {
        fichas(0.05);
        const u = Math.max(ml + 0.9, t1 - 1.45);                                           // todas se prenden juntas
        if (u < t1 - 0.6) pon(u + 0.1, 'remate');
        break;
      }
      case 'linea': fichas(-0.03); break;
      case 'cita': pon(m[0] + Math.max(1.2, Number(g.fin) - m[0] || 0) + 0.2, 'cursiva'); break;
      case 'ranking': case 'evolucion': case 'flujo': case 'tabla': case 'claves': case 'reparto': fichas(0); break;
      case 'rango': pon(m[0], 'ficha'); if (m[1] != null) { pon(m[1], 'ficha'); pon(m[1] + 0.4, 'remate'); } break;
      case 'multiplo': {
        const N = Math.max(2, Math.min(8, Math.round(Number(d.veces) || 3)));
        for (let k = 0; k < N; k++) pon(m[0] + 0.28 * k, 'ficha');
        pon(m[0] + 0.28 * N + 0.45, 'remate');
        break;
      }
      case 'comparacion': pon(m[0], 'ficha'); if (m[1] != null) { pon(m[1] + 0.43, 'sello'); pon(m[1] + 0.8, 'remate'); } break;
      case 'medidor': pon(t0 + 0.45, 'ficha'); pon(m[0], 'entra'); pon(m[0] + 1.05, 'remate'); break;
      case 'cuota': {
        pon(m[0], 'cuenta');
        pon(m[0] + 0.17 * Math.max(1, Math.min(10, Math.round(Number(d.llenas || d.de) || 3))) + 0.4, 'remate');
        break;
      }
      case 'balanza': pon(m[0], 'ficha'); if (m[1] != null) pon(m[1] + 0.4, 'sello'); break;
      default: break;
    }
    return P;
  }

  const GRUPOS = [['camara', 'en movimientos de cámara', 'en un movimiento de cámara'], ['escena', 'en escenas', 'en una escena'],
                  ['pantalla', 'en pantallas', 'en una pantalla'], ['grafico', 'en gráficos', 'en un gráfico'],
                  ['frase', 'en frases de impacto', 'en una frase de impacto']];

  /* Lo que pasa en el video y cuándo (segundos del video) */
  function momentos(M) {
    const ev = [];
    const escenas = M.escenas || [], pant = M.pantallas || [];
    const tapado = (t) => escenas.some((e) => t > Number(e.t0) + 0.05 && t < Number(e.t1) - 0.05);
    const mv = MOV(), cfg = mv && C.movCfg ? mv.limpiar(C.movCfg()) : null;
    if (cfg && Array.isArray(M.duraciones) && M.duraciones.length) {
      const impactos = mv.impactosDe(M.palabras, M.frases, M.aReal);
      let plan = mv.dirigir(mv.piezasDe(M.duraciones), impactos, cfg);
      if (pant.length && mv.quieto) plan = mv.quieto(plan, pant.map((p) => ({ t0: Number(p.t0), t1: Number(p.t1) })));
      plan.forEach((p) => {
        if (!TIPOS[p.e]) return;                                  // cámara en mano o quieta: no hay un instante
        const t = p.e === 'impacto' ? Number(p.ti) : Number(p.t0);
        if ((p.e === 'lento' || p.e === 'aleja') && t < 0.3) return;   // sin lugar para que arranque antes del 0
        if (tapado(t)) return;                                    // una escena tapa a la persona: su cámara no se ve
        ev.push({ t, tipo: p.e });
      });
    }
    escenas.forEach((e) => ev.push({ t: Number(e.t0), tipo: 'escena' }));
    pant.forEach((p) => ev.push({ t: Number(p.t0), tipo: 'pantalla' }));
    /* (2-oct) cada gráfico, en sus momentos de dentro; `g` = cuál gráfico (para el hueco corto entre los suyos) */
    (M.graficos || []).forEach((g, gi) => pistasGrafico(g).forEach(([t, papel]) =>
      ev.push({ t, tipo: 'grafico', papel, g: gi, v0: Number(g.t0), v1: Number(g.t1) })));
    (M.frases || []).forEach((f) => {
      if (!f || !(f.estilo || f.impacto)) return;
      const w = M.palabras[Number(f.desde)];
      if (w) ev.push({ t: M.aReal(Number(w.start)), tipo: 'frase' });
    });
    return ev.filter((e) => isFinite(e.t) && e.t >= 0);
  }

  /* Los que entran: primero los más importantes; ninguno a menos de HUECO de otro (ni de los puestos a mano) */
  const prioDe = (e) => (e.papel ? PAPELES[e.papel].prio : TIPOS[e.tipo].prio);
  /* (2-oct) el hueco que hace falta entre dos: corto entre los de un mismo gráfico; 0,35 s entre un gráfico y otra cosa
     (sus momentos van seguidos y un HUECO entero los borraría); HUECO entre lo demás */
  const huecoEntre = (a, b) => (a.papel && b.papel && a.g === b.g ? PISTA_HUECO : (a.papel || b.papel ? 0.35 : HUECO));
  function escoger(ev, ocupados) {
    const graf = ev.filter((e) => e.papel);
    const enGrafico = (t) => graf.some((e) => t > e.v0 - 0.3 && t < e.v1 + 0.1);
    /* con un gráfico en pantalla, lo que se ve es el gráfico: la frase de impacto de ese rato cede ante sus momentos */
    const prio = (e) => (e.tipo === 'frase' && enGrafico(e.t) ? 4.5 : prioDe(e));
    const puestos = [];
    ev.slice().sort((a, b) => prio(b) - prio(a) || a.t - b.t).forEach((e) => {
      if (TIPOS[e.tipo].grupo === 'camara' && e.tipo !== 'impacto' && enGrafico(e.t)) return;   // se oye el gráfico
      if (ocupados.some((t) => Math.abs(t - e.t) < (e.papel ? 0.25 : HUECO))) return;
      if (puestos.some((p) => Math.abs(p.t - e.t) < huecoEntre(p, e))) return;
      puestos.push(e);
    });
    return puestos.sort((a, b) => a.t - b.t);
  }

  /* Atado a la palabra más cercana; `mover` lleva el golpe al instante exacto */
  function anclar(t, M) {
    let mejor = -1, d = 1e9;
    M.palabras.forEach((w, i) => { const x = Math.abs(M.aReal(Number(w.start)) - t); if (x < d) { d = x; mejor = i; } });
    if (mejor < 0) return null;
    const mover = Math.round((t - M.aReal(Number(M.palabras[mejor].start))) * 1000) / 1000;
    return Math.abs(mover) <= 2 ? { palabra: mejor, mover } : null;
  }

  /* Dónde cae el golpe de un sonido ya puesto (para no poner otro encima) */
  function golpeDe(x, M) {
    const w = M.palabras[Math.round(Number(x.palabra))];
    return w ? M.aReal(Number(w.start)) + (Number(x.mover) || 0) : null;
  }

  function proponer(M) {
    const Sx = S();
    const mios = lista().filter((x) => !x.auto);
    const ocupados = mios.map((x) => golpeDe(x, M)).filter((t) => t != null);
    const turno = {};
    let anterior = null;
    const sello = Date.now().toString(36);
    const salen = [];
    escoger(momentos(M), ocupados).forEach((e, k) => {
      const T = e.papel ? PAPELES[e.papel] : TIPOS[e.tipo];
      const a = anclar(e.t, M);
      if (!a) return;
      const uno = (id, vol, c) => salen.push(Object.assign({ id: 'sa' + sello + k.toString(36) + (c || ''), palabra: a.palabra, mover: a.mover,
        sonido: id, vol: vol, auto: true, motivo: e.tipo }, e.papel ? { papel: e.papel } : {}));
      if (T.capas) { T.capas.filter((c) => Sx.porId(c[0])).forEach((c, i) => uno(c[0], c[1], 'c' + i)); return; }
      const clave = e.papel || e.tipo;
      const disponibles = T.sonidos.filter((id) => Sx.porId(id));
      if (!disponibles.length) return;
      let n = turno[clave] || 0, id = disponibles[n % disponibles.length];
      if (id === anterior && disponibles.length > 1) { n++; id = disponibles[n % disponibles.length]; }
      turno[clave] = n + 1;
      anterior = id;
      uno(id, T.vol);
    });
    return salen;
  }

  /* ── Lo que usa la tarjeta Sonido ── */
  const estado = { aviso: null };
  function poner() {
    const Sx = S(), M = C.cortesVivo && C.cortesVivo.momentos ? C.cortesVivo.momentos() : null;
    if (!Sx || !MOV()) { estado.aviso = 'No se pudo cargar la librería de sonidos. Recarga la página.'; C.render(); return; }
    if (!M) { estado.aviso = 'Todavía no está el video: hazlo primero y luego Cherry le pone los efectos.'; C.render(); return; }
    const nuevos = proponer(M);
    C.setState({ sonidos: lista().filter((x) => !x.auto).concat(nuevos), sonidoAbierto: null });
    estado.aviso = nuevos.length ? null : 'No encontré dónde ponerlos: prende Movimiento de cámara, escenas o gráficos, o pon frases de impacto.';
    C.render();
  }
  function quitar() {
    C.setState({ sonidos: lista().filter((x) => !x.auto), sonidoAbierto: null });
    estado.aviso = null;
    C.render();
  }
  /* «Cherry puso 18: 9 en movimientos de cámara, 4 en escenas…» */
  function resumen() {
    const auto = lista().filter((x) => x.auto), mios = lista().length - auto.length;
    if (!auto.length) return mios ? 'Tienes ' + mios + (mios === 1 ? ' efecto puesto' : ' efectos puestos') + ' a mano.' : null;
    const n = {};
    auto.forEach((x) => { const g = (TIPOS[x.motivo] || {}).grupo || 'otro'; n[g] = (n[g] || 0) + 1; });
    /* (2-oct) un gráfico ahora lleva varios: «12 en gráficos» se lee como efectos, está bien */
    const partes = GRUPOS.filter((g) => n[g[0]]).map((g) => n[g[0]] + ' ' + (n[g[0]] === 1 ? g[2] : g[1]));
    return 'Cherry puso ' + auto.length + ': ' + partes.join(', ') + '.' + (mios ? ' Y ' + mios + ' tuyos.' : '');
  }
  const hayAuto = () => lista().some((x) => x.auto);

  C.sonidosAuto = { poner, quitar, resumen, hayAuto, aviso: () => estado.aviso, _proponer: proponer, _momentos: momentos, TIPOS, _pistasGrafico: pistasGrafico, PAPELES };
})();

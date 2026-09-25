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
    (M.graficos || []).forEach((g) => ev.push({ t: Number(g.t0), tipo: 'grafico' }));
    (M.frases || []).forEach((f) => {
      if (!f || !(f.estilo || f.impacto)) return;
      const w = M.palabras[Number(f.desde)];
      if (w) ev.push({ t: M.aReal(Number(w.start)), tipo: 'frase' });
    });
    return ev.filter((e) => isFinite(e.t) && e.t >= 0);
  }

  /* Los que entran: primero los más importantes; ninguno a menos de HUECO de otro (ni de los puestos a mano) */
  function escoger(ev, ocupados) {
    const puestos = [];
    ev.slice().sort((a, b) => TIPOS[b.tipo].prio - TIPOS[a.tipo].prio || a.t - b.t).forEach((e) => {
      if (ocupados.some((t) => Math.abs(t - e.t) < HUECO) || puestos.some((p) => Math.abs(p.t - e.t) < HUECO)) return;
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
    return escoger(momentos(M), ocupados).map((e, k) => {
      const T = TIPOS[e.tipo];
      const disponibles = T.sonidos.filter((id) => Sx.porId(id));
      if (!disponibles.length) return null;
      let n = turno[e.tipo] || 0, id = disponibles[n % disponibles.length];
      if (id === anterior && disponibles.length > 1) { n++; id = disponibles[n % disponibles.length]; }
      turno[e.tipo] = n + 1;
      anterior = id;
      const a = anclar(e.t, M);
      if (!a) return null;
      return { id: 'sa' + Date.now().toString(36) + k.toString(36), palabra: a.palabra, mover: a.mover, sonido: id, vol: T.vol,
               auto: true, motivo: e.tipo };
    }).filter(Boolean);
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
    const partes = GRUPOS.filter((g) => n[g[0]]).map((g) => n[g[0]] + ' ' + (n[g[0]] === 1 ? g[2] : g[1]));
    return 'Cherry puso ' + auto.length + ': ' + partes.join(', ') + '.' + (mios ? ' Y ' + mios + ' tuyos.' : '');
  }
  const hayAuto = () => lista().some((x) => x.auto);

  C.sonidosAuto = { poner, quitar, resumen, hayAuto, aviso: () => estado.aviso, _proponer: proponer, _momentos: momentos, TIPOS };
})();

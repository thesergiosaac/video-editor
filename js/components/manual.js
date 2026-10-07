/* manual.js — el editor MANUAL (8-oct-2026, Sergio)
 *
 * «quiero que haya un switch entre el editor que ya tenemos y … un editor manual, con el resultado que ya tenemos pero una
 * línea de tiempo con cada elemento… que como un editor tradicional podamos tocar algo y borrarlo, o tocar un gráfico y
 * darle en generar uno diferente». Diseño aprobado en la propuesta v5.1 (artefacto «Editor manual de Cherry»):
 * el interruptor Automático / Manual junto a «‹ Inicio», el celular grande en el mismo sitio, arriba el panel con
 * «Lo escogido · Tus clips · ＋ Agregar» y abajo la línea de tiempo con un interruptor por pista. La línea de tiempo NO
 * cambia de alto: entre menos pistas se vean, más alta queda cada una (hasta 130 px). La página nunca hace scroll; solo
 * la línea de tiempo, por dentro.
 *
 * PARTE 1 — solo lo que YA llega al video final (vista previa = video final, sin excepción):
 *   · subtítulos: corregir una palabra, la palabra clave, el estilo de esa frase (o de todas) y quitarla;
 *   · efectos de sonido: moverlos, cambiarlos, su volumen, quitarlos y agregar de la biblioteca (100 sonidos);
 *   · escenas de apoyo: moverlas, su duración, otra toma, otra categoría, quitarlas y agregar por categoría;
 *   · gráficos: quitar uno o pedir otro.
 * Todo se guarda en lo que ya existía y el ensamblador ya sabe poner: C.state.sonidos, guionFijos (escenas y gráficos
 * por número de palabra) y la edición de subtítulos (editarSubs → renders.subtitle_edits). Las tomas (recortar, partir,
 * duplicar), los textos propios, los gráficos desde tu descripción y la música son las partes 2 a 5.
 *
 * Lo que se toca aquí queda FIJO (✎): al mover los ajustes de Automático, Cherry no lo cambia.
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const { h } = C;

  const ORDEN = ['subtitulos', 'graficos', 'escenas', 'tomas', 'voz', 'efectos'];
  const NOMBRE = { subtitulos: 'Subtítulos', graficos: 'Gráficos', escenas: 'Escenas', tomas: 'Tomas', voz: 'Voz', efectos: 'Efectos' };
  const TIPO = { subtitulos: 'Subtítulo', graficos: 'Gráfico', escenas: 'Escena de apoyo', tomas: 'Toma', voz: 'Voz', efectos: 'Efecto de sonido' };
  const COLOR = { subtitulos: '#FFC93C', graficos: '#FF2D8A', escenas: '#2BD9C7', tomas: '#CFC3BA', voz: '#9B7BFF', efectos: '#FF6B3D' };
  const ALTO = { subtitulos: 34, graficos: 34, escenas: 40, tomas: 56, voz: 46, efectos: 28 };
  const ETQ_W = 132, TOPE = 130, DUR_ESCENA = 4;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (t) => { t = Math.round(Math.max(0, t || 0) * 10) / 10; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  const fmtC = (t) => { t = Math.max(0, Math.round(t || 0)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); };
  const coma = (n, d) => (Math.round(n * Math.pow(10, d || 1)) / Math.pow(10, d || 1)).toString().replace('.', ',');
  const nuevoId = () => 'so' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ══ El interruptor ══ (cada quien se queda en el modo en que lo dejó, en su computador) */
  function leerModo() { try { return localStorage.getItem('cherry-editor-modo') === 'manual' ? 'manual' : 'auto'; } catch (_) { return 'auto'; } }
  function modoActual() { const s = C.state; if (s.modoEditor == null) s.modoEditor = leerModo(); return s.modoEditor; }
  function ponerModo(m) {
    try { localStorage.setItem('cherry-editor-modo', m); } catch (_) {}
    if (m !== 'manual') { U.sel = null; U.tab = 'escogido'; }
    C.setState({ modoEditor: m, openCard: null });
  }

  /* ══ Lo que ve la línea de tiempo ══ */
  function leerVer() {
    const v = {}; ORDEN.forEach((p) => { v[p] = true; });
    try { const g = JSON.parse(localStorage.getItem('cherry-manual-ver') || 'null'); if (g) ORDEN.forEach((p) => { if (typeof g[p] === 'boolean') v[p] = g[p]; }); } catch (_) {}
    return v;
  }
  function guardarVer() { try { localStorage.setItem('cherry-manual-ver', JSON.stringify(U.ver)); } catch (_) {} }

  const U = { tab: 'escogido', sel: null, seccion: 'efectos', catSon: 'whoosh', catEsc: '', zoom: 1, ver: leerVer(),
              arr: null, ficha: null, regen: null, buscando: null, raf: 0, aviso: '', avisoT: 0, lw: 600, escribiendo: false };
  let R = null;                 // { raiz, cab, cuerpo, herr, ver, tl, lienzo, reloj, play, aviso }
  let X = null;                 // los datos de la última pintada
  let firmaL = '', firmaP = '', tamL = '';

  /* ══ Los subtítulos que se ven ══ La edición a mano si la hay; si no, las frases que muestra la vista previa (con el nivel
     de impacto escogido). Solo al primer cambio pasan a ser una edición (y desde ahí el nivel de Automático no las toca). */
  function subsActual() {
    const s = C.state, D = C.cortesVivo.datosVista(), id = C.cortesVivo.idBase();
    if (!D) return null;
    if (D.editadas && s.editorSubs && s.editorFila === id && Array.isArray(s.editorSubs.palabras) && s.editorSubs.palabras.length === D.palabras.length) return s.editorSubs;
    return C.cortesVivo.subsVisibles ? C.cortesVivo.subsVisibles() : null;
  }
  function editarSubs(nuevo) {
    const s = C.state, id = C.cortesVivo.idBase();
    if (!nuevo || !id) return;
    const actual = subsActual();
    if (s.editorSubs !== actual || s.editorFila !== id) C.setState({ editorSubs: actual, editorFila: id }, { render: false });
    C.cortesVivo.refrescarEdicion(nuevo);              // la vista previa lo muestra ya
    C.actions.editarSubs(nuevo);                       // se guarda solo (y en este computador al instante)
  }

  /* ══ Los datos: todo en segundos del video que se ve ══ */
  function palabraCerca(t, P, aR) {
    let mejor = 0, d = Infinity;
    for (let i = 0; i < P.length; i++) { const x = Math.abs(aR(Number(P[i].start)) - t); if (x < d) { d = x; mejor = i; } }
    return mejor;
  }
  function hastaPorSeg(desde, seg, P, aR) {
    const fin = aR(Number(P[desde].start)) + seg - 0.05;
    let k = desde;
    for (let i = desde; i < P.length; i++) { if (aR(Number(P[i].start)) < fin) k = i; else break; }
    return k;
  }
  function palabrasEntre(t0, t1, P, aR) {
    let a = -1, b = -1;
    for (let i = 0; i < P.length; i++) {
      if (a < 0 && aR(Number(P[i].end)) > t0 + 0.02) a = i;
      if (aR(Number(P[i].start)) < t1 - 0.02) b = i;
    }
    if (a < 0) a = P.length - 1;
    return { desde: a, hasta: Math.max(a, b) };
  }
  function datos() {
    const CV = C.cortesVivo;
    if (!CV || !CV.vistaLista || !CV.vistaLista()) return null;
    const m = CV.momentos(), D = CV.datosVista();
    if (!m || !D || !Array.isArray(m.palabras) || !m.palabras.length) return null;
    const aR = m.aReal, P = m.palabras, s = C.state;
    const durs = (D.duraciones || []).map(Number);
    const total = CV.duracion() || durs.reduce((a, b) => a + b, 0) || 1;
    const cuts = D.cortes && Array.isArray(D.cortes.cuts) ? D.cortes.cuts : [];
    const clips = s.clips || [];
    let e = 0;
    const tomas = durs.map((d, i) => {
      const c = cuts[i] || {};
      const o = { id: 't' + i, i, t0: e, t1: e + d, texto: c.text || '', clip: clips.find((x) => x.id === c.clipId) || null, ini: Number(c.startTime), fin: Number(c.endTime) };
      e += d; return o;
    });
    const subs = subsActual();
    const impacto = C.subs.modoImpacto(s);
    const frases = subs ? subs.frases.map((f, i) => {
      const w0 = P[f.desde], w1 = P[f.hasta];
      if (!w0 || !w1) return null;
      const texto = subs.palabras.slice(f.desde, f.hasta + 1).map((w) => w.word).join(' ');
      const corregidas = subs.palabras.slice(f.desde, f.hasta + 1).some((w) => w.original != null);
      return { id: 'f' + i, i, f, t0: aR(Number(w0.start)), t1: aR(Number(w1.end)) + 0.12, texto,
               off: f.estilo === 'ninguno', imp: f.estilo !== 'ninguno' && (impacto ? !!(f.impacto || f.estilo) : !!f.estilo),
               mano: !!(D.editadas && (f.estilo || corregidas)) };
    }).filter(Boolean) : [];
    frases.forEach((f, k) => { const n = frases[k + 1]; if (n && f.t1 > n.t0) f.t1 = n.t0; });
    const fij = s.guionFijos || {};
    const zG = (fij.graficos && fij.graficos.si) || [];
    const graficos = (m.graficos || []).map((g) => ({ id: 'g' + g.desde + '-' + g.tipo, g, t0: Number(g.t0), t1: Number(g.t1),
      mano: zG.some((z) => Number(z.desde) <= g.hasta && Number(z.hasta) >= g.desde) }));
    const zE = (fij.escenas && fij.escenas.si) || [];
    const escenas = (m.escenas || []).map((x) => {
      let zona = null;
      if (x.fija) {
        // la zona fijada de donde salió (una zona larga puede poner varias tomas seguidas)
        let d = Infinity;
        zE.forEach((z) => {
          const w = P[z.desde]; if (!w) return;
          const z0 = aR(Number(w.start)), z1 = z0 + (Number(z.segundos) || DUR_ESCENA);
          const dist = x.t0 >= z0 - 0.3 && x.t0 < z1 ? 0 : Math.abs(x.t0 - z0);
          if (dist < d) { d = dist; zona = z; }
        });
      }
      return { id: 'e' + Math.round(Number(x.t0) * 1000), x, t0: Number(x.t0), t1: Number(x.t1), zona, mano: !!zona };
    });
    const Sx = window.CherrySonidos;
    const efectos = (Array.isArray(s.sonidos) ? s.sonidos : []).map((x) => {
      const so = Sx && Sx.porId(x.sonido), w = P[Math.round(Number(x.palabra))];
      if (!so || !w) return null;
      const ini = aR(Number(w.start)) + (Number(x.mover) || 0) - (so.golpe || 0);
      return { id: x.id, x, so, t0: Math.max(0, ini), t1: Math.max(0, ini) + so.dur, mano: !x.auto };
    }).filter(Boolean);
    return { m, D, aR, P, total, tomas, frases, graficos, escenas, efectos, subs, impacto };
  }
  const listaDe = (p) => !X ? [] : p === 'subtitulos' ? X.frases : p === 'voz' ? X.tomas : X[p] || [];
  const buscar = (p, id) => listaDe(p).find((x) => x.id === id) || null;

  /* Las líneas de cada pista: lo que se tapa pasa a la línea de abajo (líneas infinitas) */
  function acomodar(items) {
    const fin = [];
    items.slice().sort((a, b) => a.t0 - b.t0).forEach((it) => {
      let f = 0; while (fin[f] !== undefined && fin[f] > it.t0 + 0.01) f++;
      it.fila = f; fin[f] = it.t1;
    });
    return Math.max(1, fin.length);
  }

  /* ══ Deshacer / rehacer: un historial propio (subtítulos aparte del resto) ══ */
  const HIST = [], FUT = [];
  function foto(tipo) {
    return tipo === 'subs' ? { tipo, v: subsActual() } : { tipo, v: { sonidos: C.state.sonidos || [], guionFijos: C.state.guionFijos || {} } };
  }
  function guardarHist(tipo) { HIST.push(foto(tipo)); if (HIST.length > 80) HIST.shift(); FUT.length = 0; }
  function volver(de, a) {
    const f = de.pop(); if (!f) return;
    a.push(foto(f.tipo));
    if (f.tipo === 'subs') editarSubs(f.v);
    else C.setState({ sonidos: f.v.sonidos, guionFijos: f.v.guionFijos });
    aviso(de === HIST ? 'Deshecho' : 'Rehecho');
  }

  /* ══ Cambiar lo fijado (escenas y gráficos), por números de palabra — lo mismo que hace el Guion ══ */
  function opZona(todo, que, vieja, tipo, nueva) {
    const f = Object.assign({ si: [], no: [] }, todo[que] || {});
    const es = (z, x) => x && Number(z.desde) === Number(x.desde) && Number(z.hasta) === Number(x.hasta);
    const cruza = (z) => nueva && Number(z.desde) <= Number(nueva.hasta) && Number(z.hasta) >= Number(nueva.desde);
    const fuera = (lista) => (lista || []).filter((z) => !es(z, vieja) && !cruza(z));
    f.si = fuera(f.si); f.no = fuera(f.no);
    if (tipo === 'si') f.si = f.si.concat([nueva]);
    else if (tipo === 'no') f.no = f.no.concat([nueva]);
    todo[que] = f;
  }
  function zonas(ops, txt) {
    guardarHist('estado');
    const todo = Object.assign({}, C.state.guionFijos || {});
    ops.forEach((o) => opZona(todo, o[0], o[1], o[2], o[3]));
    C.setState({ guionFijos: todo });
    if (txt) aviso(txt);
  }

  /* ══ Efectos de sonido ══ El golpe del efecto cae en una palabra (± 2 s): así viaja y así lo pone el ensamblador */
  function anclar(tGolpe) {
    const k = palabraCerca(tGolpe, X.P, X.aR);
    return { palabra: k, mover: clamp(Math.round((tGolpe - X.aR(Number(X.P[k].start))) * 20) / 20, -2, 2) };
  }
  const sonidos = () => (Array.isArray(C.state.sonidos) ? C.state.sonidos : []);
  function cambiarSonido(id, c, txt) {
    guardarHist('estado');
    C.setState({ sonidos: sonidos().map((x) => (x.id === id ? Object.assign({}, x, c, { auto: false }) : x)) });
    if (txt) aviso(txt);
  }
  function agregarSonido(sonidoId, tIni) {
    const so = window.CherrySonidos && window.CherrySonidos.porId(sonidoId);
    if (!so || !X) return;
    const a = anclar(clamp(tIni, 0, X.total - 0.1) + (so.golpe || 0));
    const n = { id: nuevoId(), palabra: a.palabra, mover: a.mover, sonido: so.id, vol: 100 };
    guardarHist('estado');
    U.sel = { pista: 'efectos', id: n.id }; U.tab = 'escogido';
    C.setState({ sonidos: sonidos().concat([n]) });
    aviso('«' + so.nombre + '» en ' + fmt(tIni));
  }
  let audio = null;
  function oir(so, vol) {
    try { if (audio) audio.pause(); audio = new Audio(so.url); audio.volume = clamp((vol == null ? 100 : vol) / 100, 0, 1); audio.play().catch(() => {}); } catch (_) {}
  }

  /* ══ Escenas de apoyo ══ */
  const CATS = { lista: null, pidiendo: false };
  function categorias() {
    if (CATS.lista || CATS.pidiendo || !C.api || !C.api.edgeFetch) return CATS.lista || [];
    CATS.pidiendo = true;
    C.api.edgeFetch('biblioteca', { accion: 'categorias' }).then((r) => {
      CATS.lista = (r && Array.isArray(r.categorias) ? r.categorias : []).map((c) => c.categoria).filter(Boolean);
      firmaP = ''; pintarPanel();
    }).catch(() => { CATS.pidiendo = false; });
    return [];
  }
  function textoDe(desde, hasta) { return X.subs ? X.subs.palabras.slice(desde, hasta + 1).map((w) => w.word).join(' ') : ''; }
  /* La escena en una zona: con categoría se buscan antes sus tomas (las que mejor van con lo que dices ahí) */
  function ponerEscena(z, cat, quitarAntes, txt) {
    if (!cat) { zonas([].concat(quitarAntes || [], [['escenas', z.vieja || null, 'si', z.nueva]]), txt); return; }
    U.buscando = cat; aviso('Buscando tomas de «' + cat + '»…'); pintarPanel();
    C.api.edgeFetch('biblioteca', { accion: 'tomas', categoria: cat, texto: textoDe(z.nueva.desde, z.nueva.hasta) }).then((r) => {
      U.buscando = null;
      const tomas = r && Array.isArray(r.tomas) ? r.tomas : [];
      if (!tomas.length) { aviso('No hay tomas en «' + cat + '»'); pintarPanel(); return; }
      zonas([].concat(quitarAntes || [], [['escenas', z.vieja || null, 'si', Object.assign({}, z.nueva, { categoria: cat, tomas, saltar: 0 })]]), txt);
    }).catch(() => { U.buscando = null; aviso('No se pudo buscar. Inténtalo otra vez.'); pintarPanel(); });
  }
  function agregarEscena(cat, t) {
    if (!X) return;
    const w = palabraCerca(clamp(t, 0, X.total), X.P, X.aR);
    const nueva = { desde: w, hasta: hastaPorSeg(w, DUR_ESCENA, X.P, X.aR), segundos: DUR_ESCENA };
    U.tab = 'escogido'; U.sel = null; U.selEscena = w;
    ponerEscena({ nueva }, cat, null, cat ? 'Escena de «' + cat + '» en ' + fmt(t) : 'Cherry escoge la escena para ' + fmt(t));
  }
  /* La toma que se ve, para fijarla tal cual (al mover una escena de Cherry no cambia de toma) */
  function tomaDe(it) {
    const x = it.x;
    return { clip_id: x.clip_id, s3_key: x.s3_key, clip_dur: 0, rotar: x.rotar || 0, ini: Number(x.ss) || 0,
             fin: (Number(x.ss) || 0) + (it.t1 - it.t0), texto: x.texto || '', categoria: '' };
  }
  /* Cada toma trae SU trozo del clip (~4 s): una escena más larga se llena con varias seguidas (apoyo.js). La primera es la
     que se ve; detrás, las de los momentos más cercanos a lo que dices ahí, igual que las escoge Cherry. */
  function tomasCerca(desde, hasta, primera) {
    const ms = (X.D.apoyo && Array.isArray(X.D.apoyo.momentos)) ? X.D.apoyo.momentos : [];
    const out = primera ? [primera] : [];
    ms.map((m) => ({ m, d: m.hasta < desde ? desde - m.hasta : m.desde > hasta ? m.desde - hasta : 0 }))
      .sort((a, b) => a.d - b.d || (b.m.fuerza || 1) - (a.m.fuerza || 1))
      .forEach((c) => (c.m.escenas || []).forEach((e) => {
        if (e && e.s3_key && out.length < 12 && !out.some((o) => o.clip_id === e.clip_id)) out.push(e);
      }));
    return out;
  }
  function zonaDePieza(it, desde, seg) {
    const segundos = clamp(Math.round(seg * 10) / 10, 1, 30);
    return { desde, hasta: hastaPorSeg(desde, segundos, X.P, X.aR), segundos };
  }
  function moverEscena(it, t0) {
    const w = palabraCerca(t0, X.P, X.aR);
    U.selEscena = w;                                   // al moverla cambia su id (su segundo): sigue escogida
    if (it.zona) {
      const z = it.zona;
      zonas([['escenas', z, 'si', Object.assign({}, z, zonaDePieza(it, w, Number(z.segundos) || DUR_ESCENA))]], 'Escena movida');
      return;
    }
    // una de Cherry: queda fija donde la soltaste, con la misma toma, y donde estaba ya no va
    const viejas = palabrasEntre(it.t0, it.t1, X.P, X.aR);
    const z0 = zonaDePieza(it, w, it.t1 - it.t0);
    const nueva = Object.assign(z0, { tomas: tomasCerca(z0.desde, z0.hasta, tomaDe(it)) });
    zonas([['escenas', null, 'no', viejas], ['escenas', null, 'si', nueva]], 'Escena movida');
  }
  function durarEscena(it, seg) {
    const z = it.zona, txt = 'Ahora dura ' + coma(seg) + ' s';
    if (z) {
      const n = Object.assign({}, z, zonaDePieza(it, z.desde, seg));
      // la de una categoría sigue con sus tomas; la que se fijó al moverla se completa con las cercanas
      if (!z.categoria && Array.isArray(z.tomas) && z.tomas.length) n.tomas = tomasCerca(n.desde, n.hasta, z.tomas[0]);
      zonas([['escenas', z, 'si', n]], txt);
      return;
    }
    const n = zonaDePieza(it, palabraCerca(it.t0, X.P, X.aR), seg);
    zonas([['escenas', null, 'si', Object.assign(n, { tomas: tomasCerca(n.desde, n.hasta, tomaDe(it)) })]], txt);
  }
  function quitarEscena(it) {
    const z = it.zona;
    const zona = z ? { desde: z.desde, hasta: z.hasta } : palabrasEntre(it.t0, it.t1, X.P, X.aR);
    zonas([['escenas', z || null, 'no', zona]], 'Escena quitada');
  }
  function otraToma(it) {
    const z = it.zona;
    if (z) { zonas([['escenas', z, 'si', Object.assign({}, z, { saltar: (Number(z.saltar) || 0) + 1 })]], 'Otra toma'); return; }
    const w = palabraCerca(it.t0, X.P, X.aR);
    zonas([['escenas', null, 'si', Object.assign(zonaDePieza(it, w, it.t1 - it.t0), { saltar: 1 })]], 'Otra toma');
  }
  function categoriaEscena(it, cat) {
    const z = it.zona, w = z ? z.desde : palabraCerca(it.t0, X.P, X.aR);
    const nueva = z ? { desde: z.desde, hasta: z.hasta, segundos: Number(z.segundos) || DUR_ESCENA } : zonaDePieza(it, w, it.t1 - it.t0);
    ponerEscena({ vieja: z || null, nueva }, cat, null, cat ? 'Escena de «' + cat + '»' : 'La escoge Cherry');
  }
  /* Enlaces de la biblioteca (privada): para ver la toma en el panel */
  const ENL = {};                // s3_key → enlace | 'pidiendo' | false (no se pudo: no se vuelve a pedir)
  function enlace(key) {
    if (!key) return false;
    if (ENL[key] === undefined && C.api && C.api.enlacesBiblioteca) {
      ENL[key] = 'pidiendo';
      C.api.enlacesBiblioteca([key]).then((e) => { ENL[key] = (e && e[key]) || false; firmaP = ''; pintarPanel(); }).catch(() => { ENL[key] = false; firmaP = ''; pintarPanel(); });
    }
    return ENL[key] === undefined ? false : ENL[key];
  }

  /* ══ Gráficos ══ Quitar = «aquí no» en sus palabras (como el Guion). Otro = la IA vuelve a marcar SOLO ese. */
  function quitarGrafico(it) { zonas([['graficos', null, 'no', { desde: it.g.desde, hasta: it.g.hasta }]], 'Gráfico quitado'); }
  async function otrosGraficos(it) {
    const render = C.cortesVivo.idBase();
    if (!render || U.regen) return;
    const ms = (C.grafVivo && C.grafVivo.momentos && C.grafVivo.momentos()) || [];
    const PE = (window.CherryGraf && window.CherryGraf.PALABRA_PE) || [];
    let quedan = [];
    if (it) {
      const i = ms.findIndex((m) => Number(m.desde) === Number(it.g.desde) && (m.tipo === it.g.tipo || (it.g.variante && PE.indexOf(m.tipo) >= 0)));
      quedan = ms.map((_, k) => k).filter((k) => k !== i);
    }
    const eta = window.CherryEta ? window.CherryEta.empezar('regenerar', 35) : null;
    U.regen = { id: it ? it.id : '*', eta };
    firmaL = ''; pintar();
    try {
      const r = await C.api.regenerarGraficos(render, quedan, (C.grafCfg().familias) || ['vidrio']);
      if (!r || !r.graficos) throw new Error((r && r.error) || 'sin respuesta');
      if (eta) eta.fin();
      if (C.cortesVivo.ponerGraficos) C.cortesVivo.ponerGraficos(r.graficos);
      if (C.grafVivo && C.grafVivo.refrescar) C.grafVivo.refrescar(r.graficos);
      U.regen = null; U.sel = null;
      aviso(it ? 'Gráfico nuevo listo' : r.graficos.momentos.length + ' gráficos nuevos');
      C.setState({});
    } catch (e) {
      console.warn('[Manual] no se pudieron pedir otros gráficos', e);
      if (eta) eta.parar();
      U.regen = null; aviso('No salió. Inténtalo otra vez.');
      firmaL = ''; C.setState({});
    }
  }

  /* ══ Subtítulos ══ */
  function cambiarFrase(it, cambio, txt) {
    const subs = subsActual(); if (!subs) return;
    guardarHist('subs');
    const frases = subs.frases.slice();
    frases[it.i] = Object.assign({}, frases[it.i], cambio);
    Object.keys(cambio).forEach((k) => { if (cambio[k] === undefined) delete frases[it.i][k]; });
    soltarTitulo(it.f);
    editarSubs(Object.assign({}, subs, { frases }));
    if (txt) aviso(txt);
  }
  /* Un título fijado en el Guion (Automático) volvería a poner o quitar la plantilla: lo que se hace aquí manda */
  function soltarTitulo(f) {
    const g = C.state.guionFijos || {};
    if (!Array.isArray(g.titulos) || !g.titulos.length) return;
    const resto = g.titulos.filter((z) => !(Number(z.desde) <= f.hasta && Number(z.hasta) >= f.desde) || (z.y != null && !z.tipo));
    if (resto.length !== g.titulos.length) C.setState({ guionFijos: Object.assign({}, g, { titulos: resto }) }, { render: false });
  }
  function corregir(i, valor) {
    const subs = subsActual(); if (!subs) return;
    const texto = String(valor || '').replace(/\s+/g, ' ').trim(), w = subs.palabras[i];
    if (!w || !texto || texto === w.word) { firmaP = ''; pintarPanel(); return; }
    const original = w.original != null ? w.original : w.word;
    const palabras = subs.palabras.slice();
    palabras[i] = texto === original ? { word: original, start: w.start, end: w.end } : { word: texto, start: w.start, end: w.end, original };
    guardarHist('subs');
    editarSubs(Object.assign({}, subs, { palabras }));
    aviso(texto === original ? 'Vuelve a decir «' + original + '»' : 'Corregida: «' + texto + '»');
  }
  function estiloATodas(estilo) {
    const subs = subsActual(); if (!subs) return;
    guardarHist('subs');
    const frases = subs.frases.map((f) => { const o = Object.assign({}, f); if (estilo) o.estilo = estilo; else delete o.estilo; return o; });
    editarSubs(Object.assign({}, subs, { frases }));
    aviso('Ese estilo en todas las frases');
  }
  /* Cómo sale una frase: lo mismo que decide la vista previa (cortesvivo › estiloDe) */
  function opcionesEstilo(impacto) {
    const S = C.subs;
    if (impacto) return [{ id: 'normal', name: 'Normal' }, { id: 'impacto', name: 'Impacto' }, { id: 'ninguno', name: 'Sin subtítulo' }];
    return [{ id: '', name: 'Como todo el video' }].concat(S.PLANTILLAS.map((p) => ({ id: p.id, name: p.name })), [{ id: S.SIMPLE.id, name: S.SIMPLE.name }, { id: 'ninguno', name: 'Sin subtítulo' }]);
  }
  function estiloDeFrase(f, impacto) {
    if (f.estilo === 'ninguno') return 'ninguno';
    if (impacto) return f.impacto || f.estilo ? 'impacto' : 'normal';
    return f.estilo || '';
  }
  function ponerEstilo(it, id, impacto) {
    if (impacto) {
      const c = id === 'ninguno' ? { estilo: 'ninguno' } : id === 'impacto' ? { impacto: true, estilo: undefined } : { impacto: false, estilo: undefined };
      cambiarFrase(it, c, id === 'ninguno' ? 'Frase sin subtítulo' : id === 'impacto' ? 'Ahora es de impacto' : 'Ahora va normal');
    } else cambiarFrase(it, { estilo: id || undefined }, id === 'ninguno' ? 'Frase sin subtítulo' : 'Estilo cambiado');
  }

  /* ══ Quitar lo escogido (Supr) ══ */
  function quitar(sel) {
    const it = sel && buscar(sel.pista, sel.id);
    if (!it) return;
    if (sel.pista === 'efectos') {
      guardarHist('estado'); U.sel = null;
      C.setState({ sonidos: sonidos().filter((x) => x.id !== it.id) }); aviso('Efecto quitado');
    } else if (sel.pista === 'escenas') { U.sel = null; quitarEscena(it); }
    else if (sel.pista === 'graficos') { U.sel = null; quitarGrafico(it); }
    else if (sel.pista === 'subtitulos') ponerEstilo(it, 'ninguno', X.impacto);
  }

  /* ══ Escoger: se va a ese momento (si no está sonando) ══ */
  function escoger(pista, id, sinSaltar) {
    U.sel = pista ? { pista, id } : null;
    if (U.sel) U.tab = 'escogido';
    const it = U.sel && buscar(pista, id);
    if (it && !sinSaltar && !sonando()) {
      const t = C.cortesVivo.tiempo();
      if (t < it.t0 || t >= it.t1) C.cortesVivo.irA(it.t0 + Math.min(pista === 'graficos' ? 0.9 : 0.05, (it.t1 - it.t0) / 2));
    }
    firmaL = ''; firmaP = ''; pintar();
  }
  function sonando() { const v = C.videoFijo.get('base-previa'); return !!(v && !v.paused); }

  /* ══ La línea de tiempo ══ */
  function altos(filas) {
    let lineas = 0, base = 0, grupos = 0;
    ORDEN.forEach((p) => { if (!U.ver[p]) return; grupos++; lineas += filas[p]; base += filas[p] * ALTO[p]; });
    const libre = R.tl.clientHeight - 24 - 10 - lineas * 4 - grupos * 5;
    const f = base > 0 && libre > base ? libre / base : 1, a = {};
    ORDEN.forEach((p) => { a[p] = Math.min(TOPE, Math.floor(ALTO[p] * f)); });
    return a;
  }
  function px(t) { return ETQ_W + 6 + (t / X.total) * U.lw; }
  function pintarLinea() {
    if (!R || !X) return;
    const T = X.total, pct = (t) => (clamp(t, 0, T) / T * 100) + '%';
    U.lw = Math.max(300, (R.tl.clientWidth - ETQ_W - 18) * U.zoom);
    const filas = {};
    ORDEN.forEach((p) => { filas[p] = p === 'tomas' || p === 'voz' ? 1 : acomodar(listaDe(p)); });
    const H = altos(filas);
    const sel = U.sel || {};
    const bloque = (p, it, cuerpo, clase, estilo) =>
      '<div class="mn-bl mn-bl--' + p + (clase ? ' ' + clase : '') + (sel.pista === p && sel.id === it.id ? ' mn-bl--sel' : '') + '" data-pista="' + p + '" data-id="' + esc(it.id) +
      '" style="left:' + pct(it.t0) + ';width:calc(' + (Math.max(0.04, Math.min(it.t1, T) - it.t0) / T * 100) + '% - 1px);' + (estilo || '') + '">' +
      (it.mano ? '<span class="mn-mano" title="Hecho a mano: Cherry no lo cambia">✎</span>' : '') + cuerpo + '</div>';
    const cuerpo = (p, f) => {
      let o = '';
      if (p === 'voz') return '<canvas class="mn-onda"></canvas>';
      listaDe(p).forEach((it) => {
        if (p !== 'tomas' && it.fila !== f) return;
        if (p === 'subtitulos') o += bloque(p, it, esc(it.texto), (it.off ? 'mn-off' : '') + (it.imp ? ' mn-imp' : ''));
        else if (p === 'graficos') {
          const G = window.CherryGraf, n = (G && G.NOMBRES && G.NOMBRES[it.g.tipo]) || it.g.tipo;
          o += bloque(p, it, U.regen && (U.regen.id === it.id || U.regen.id === '*') ? '✦ buscando otro…' : esc(n), U.regen && U.regen.id === it.id ? 'mn-gen' : '');
        } else if (p === 'escenas') o += bloque(p, it, esc(it.x.texto || it.x.busqueda || 'Escena'));
        else if (p === 'efectos') o += bloque(p, it, esc(it.so.nombre));
        else if (p === 'tomas') o += bloque(p, it, '<b>' + (it.i + 1) + '</b>', '', it.clip && it.clip.thumbnail_url ? 'background-image:url(' + esc(it.clip.thumbnail_url) + ')' : '');
      });
      return o;
    };
    let o = '<div class="mn-fila mn-fila--regla"><div class="mn-etq">pistas</div><div class="mn-carril mn-regla" style="width:' + U.lw + 'px">';
    const visible = T / U.zoom, paso = visible > 60 ? 10 : visible > 30 ? 5 : visible > 12 ? 2 : 1;
    for (let t = 0; t <= T + 0.01; t += paso) o += '<span style="left:' + pct(t) + '">' + fmtC(t) + '</span>';
    o += '</div></div>';
    let alguna = false;
    ORDEN.forEach((p) => {
      if (!U.ver[p]) return;
      alguna = true;
      for (let f = 0; f < filas[p]; f++) {
        const etq = '<i style="background:' + COLOR[p] + '"></i><span>' + (f === 0 ? NOMBRE[p] : 'línea ' + (f + 1)) + '</span>';
        o += '<div class="mn-fila' + (f === 0 ? ' mn-fila--ini' : ' mn-fila--extra') + '" data-grupo="' + p + '" data-fila="' + f + '"><div class="mn-etq">' + etq + '</div>' +
          '<div class="mn-carril' + (H[p] >= 52 ? ' mn-carril--alta' : '') + '" data-carril="' + p + '" style="width:' + U.lw + 'px;height:' + H[p] + 'px">' + cuerpo(p, f) + '</div></div>';
      }
    });
    if (!alguna) o += '<p class="mn-dato" style="padding:14px 18px">Prende arriba la pista que quieras ver.</p>';
    o += '<div class="mn-cabezal"></div>';
    R.lienzo.innerHTML = o;
    R.lienzo.style.width = (ETQ_W + 12 + U.lw) + 'px';
    pintarOnda(); pintarTiempo(true);
  }

  /* La voz: la onda de la base (se decodifica una vez por video) */
  const ONDA = { url: null, picos: null, paso: 0.02, error: false, pidiendo: false };
  function pedirOnda(url) {
    if (!url || ONDA.pidiendo || (ONDA.url === url && (ONDA.picos || ONDA.error))) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { ONDA.url = url; ONDA.error = true; return; }
    ONDA.pidiendo = true; ONDA.url = url; ONDA.picos = null; ONDA.error = false;
    fetch(url, { mode: 'cors' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((buf) => { const ac = new AC(); return ac.decodeAudioData(buf).then((ab) => { try { ac.close(); } catch (_) {} return ab; }); })
      .then((ab) => {
        const n = Math.ceil(ab.duration / ONDA.paso), picos = new Float32Array(n), por = Math.max(1, Math.floor(ab.sampleRate * ONDA.paso));
        const canales = []; for (let c = 0; c < Math.min(2, ab.numberOfChannels); c++) canales.push(ab.getChannelData(c));
        let max = 0;
        for (let i = 0; i < n; i++) {
          let m = 0; const a = i * por, b = Math.min(a + por, canales[0].length);
          for (let k = a; k < b; k += 4) for (let c = 0; c < canales.length; c++) { const v = Math.abs(canales[c][k]); if (v > m) m = v; }
          picos[i] = m; if (m > max) max = m;
        }
        if (max > 0) for (let i = 0; i < n; i++) picos[i] = Math.sqrt(picos[i] / max);
        if (ONDA.url === url) ONDA.picos = picos;
      })
      .catch((e) => { console.warn('[Manual] sin onda de la voz', e); if (ONDA.url === url) ONDA.error = true; })
      .then(() => { ONDA.pidiendo = false; pintarOnda(); });
  }
  function pintarOnda() {
    const c = R && R.lienzo.querySelector('.mn-onda');
    if (!c || !X) return;
    pedirOnda(X.D.url);
    const w = c.clientWidth, hh = c.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!w || !hh) return;
    c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
    const sel = U.sel && U.sel.pista === 'voz' ? U.sel.id : null;
    X.tomas.forEach((s) => {
      const x0 = s.t0 / X.total * w, x1 = s.t1 / X.total * w, on = sel === s.id;
      g.fillStyle = on ? 'rgba(155,123,255,.3)' : 'rgba(155,123,255,.11)';
      g.beginPath(); if (g.roundRect) g.roundRect(x0 + 0.5, 2, Math.max(1, x1 - x0 - 1), hh - 4, 6); else g.rect(x0 + 0.5, 2, Math.max(1, x1 - x0 - 1), hh - 4); g.fill();
      g.fillStyle = on ? '#fff' : '#9B7BFF';
      for (let x = x0 + 2; x < x1 - 2; x += 2.5) {
        const t = x / w * X.total;
        const v = ONDA.picos ? (ONDA.picos[Math.floor(t / ONDA.paso)] || 0) : 0.12;
        const a = Math.max(1, v * (hh - 8));
        g.fillRect(x, (hh - a) / 2, 1.5, a);
      }
    });
    if (!ONDA.picos && !ONDA.error) { g.font = '500 10px DM Mono, monospace'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('leyendo tu voz…', 8, hh / 2 + 3); }
  }

  function pintarTiempo(forzar) {
    if (!R || !X) return;
    const t = C.cortesVivo.tiempo() || 0, son = sonando();
    const c = R.lienzo.querySelector('.mn-cabezal');
    if (c) { const x = px(t); c.style.left = x + 'px'; c.style.visibility = x < R.tl.scrollLeft + ETQ_W ? 'hidden' : 'visible'; }
    const txt = fmt(t);
    if (forzar || R.reloj._t !== txt) { R.reloj._t = txt; R.reloj.firstChild.textContent = txt + ' '; R.reloj.lastChild.textContent = '/ ' + fmt(X.total); }
    if (R.play._son !== son) { R.play._son = son; R.play.innerHTML = son ? '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="#fff"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="#fff"/></svg>'; }
    if (c && U.zoom > 1 && son && !U.arr) { const xx = px(t); if (xx < R.tl.scrollLeft + ETQ_W + 20 || xx > R.tl.scrollLeft + R.tl.clientWidth - 40) R.tl.scrollLeft = xx - ETQ_W - 60; }
  }
  function bucle() {
    U.raf = 0;
    if (!R || !R.raiz.isConnected) return;
    pintarTiempo();
    // lo que llega sin repintar la app (la base lista, los gráficos y escenas que vienen después, los titulares): cada 0,4 s
    const ahora = performance.now();
    if (ahora - (U.revisado || 0) > 400 && !U.arr && !U.ficha) { U.revisado = ahora; pintar(); }
    U.raf = requestAnimationFrame(bucle);
  }
  function teDeX(clientX) { const r = R.lienzo.querySelector('.mn-regla').getBoundingClientRect(); return clamp((clientX - r.left) / r.width * X.total, 0, X.total); }

  /* ══ Arrastrar en la línea de tiempo: el cabezal, los efectos y las escenas (de lado; las escenas también se estiran) ══ */
  function alBajar(ev) {
    if (!X || ev.button > 0) return;
    if (ev.target.closest('.mn-etq')) return;
    if (ev.target.closest('.mn-regla')) { U.arr = { modo: 'cabezal' }; C.cortesVivo.irA(teDeX(ev.clientX)); R.lienzo.setPointerCapture(ev.pointerId); return; }
    if (ev.target.classList.contains('mn-onda')) {
      const t = teDeX(ev.clientX), s = X.tomas.find((x) => t >= x.t0 && t < x.t1);
      if (s) escoger('voz', s.id, true);
      C.cortesVivo.irA(t);
      return;
    }
    const b = ev.target.closest('.mn-bl');
    if (!b) { if (ev.target.closest('.mn-carril')) { C.cortesVivo.irA(teDeX(ev.clientX)); escoger(null); } return; }
    const p = b.dataset.pista, id = b.dataset.id, it = buscar(p, id);
    if (!it) return;
    const r = b.getBoundingClientRect(), x = ev.clientX - r.left;
    let modo = 'nada';
    if (p === 'efectos') modo = 'mover';
    if (p === 'escenas') modo = x > r.width - 8 && r.width > 18 ? 'der' : 'mover';
    U.arr = { modo, pista: p, id, it, x0: ev.clientX, movido: false, b, izq: b.style.left, ancho: b.style.width };
    R.lienzo.setPointerCapture(ev.pointerId);
    if (!(U.sel && U.sel.pista === p && U.sel.id === id)) escoger(p, id);
    // escoger vuelve a pintar la línea: el bloque que se arrastra es el nuevo
    U.arr.b = R.lienzo.querySelector('.mn-bl[data-pista="' + p + '"][data-id="' + CSS.escape(id) + '"]');
  }
  function alMover(ev) {
    if (U.ficha) { moverFicha(ev); return; }
    const A = U.arr;
    if (!A) {
      const b = ev.target.closest && ev.target.closest('.mn-bl');
      if (b) { const r = b.getBoundingClientRect(), p = b.dataset.pista; b.style.cursor = p === 'escenas' && ev.clientX - r.left > r.width - 8 ? 'ew-resize' : (p === 'efectos' || p === 'escenas' ? 'grab' : 'pointer'); }
      return;
    }
    if (A.modo === 'cabezal') { C.cortesVivo.irA(teDeX(ev.clientX)); return; }
    if (A.modo === 'nada' || !A.b) return;
    const dx = ev.clientX - A.x0;
    if (!A.movido && Math.abs(dx) < 3) return;
    A.movido = true;
    const dt = dx / U.lw * X.total, it = A.it, T = X.total;
    if (A.modo === 'mover') {
      A.t0 = clamp(it.t0 + dt, 0, T - 0.2);
      A.b.style.left = (A.t0 / T * 100) + '%';
      marcarDestino(A.t0);
    } else {
      A.t1 = clamp(it.t1 + dt, it.t0 + 1, Math.min(T, it.t0 + 30));
      A.b.style.width = 'calc(' + ((A.t1 - it.t0) / T * 100) + '% - 1px)';
      marcarDestino(A.t1, coma(A.t1 - it.t0) + ' s');
    }
  }
  function alSubir() {
    if (U.ficha) { soltarFicha(); return; }
    const A = U.arr; U.arr = null;
    marcarDestino(null);
    if (!A || !A.movido) return;
    if (A.pista === 'efectos' && A.t0 != null) {
      const a = anclar(A.t0 + (A.it.so.golpe || 0));
      cambiarSonido(A.id, { palabra: a.palabra, mover: a.mover }, 'Efecto movido a ' + fmt(A.t0));
    } else if (A.pista === 'escenas' && A.modo === 'mover' && A.t0 != null) moverEscena(A.it, A.t0);
    else if (A.pista === 'escenas' && A.modo === 'der' && A.t1 != null) durarEscena(A.it, Math.round((A.t1 - A.it.t0) * 10) / 10);
  }
  function marcarDestino(t, txt) {
    let d = R.lienzo.querySelector('.mn-destino');
    if (t == null) { if (d) d.remove(); return; }
    if (!d) { d = document.createElement('div'); d.className = 'mn-destino'; R.lienzo.appendChild(d); }
    d.style.left = px(t) + 'px'; d.setAttribute('data-t', txt || fmt(t));
  }

  /* Las fichas de «＋ Agregar» se arrastran a la línea de tiempo (o «＋ Agregar» las pone donde está la línea blanca) */
  function bajarFicha(ev, ficha) {
    if (ev.button > 0) return;
    ev.preventDefault();
    U.ficha = Object.assign({ x0: ev.clientX, y0: ev.clientY, dentro: false, fantasma: null }, ficha);
    document.addEventListener('pointermove', alMover);
    document.addEventListener('pointerup', alSubirDoc);
  }
  function alSubirDoc() { document.removeEventListener('pointermove', alMover); document.removeEventListener('pointerup', alSubirDoc); alSubir(); }
  function moverFicha(ev) {
    const F = U.ficha;
    if (!F.fantasma) {
      if (Math.abs(ev.clientX - F.x0) + Math.abs(ev.clientY - F.y0) < 5) return;
      F.fantasma = h('div', { class: 'mn-fantasma mn-fantasma--' + F.tipo }, F.nombre);
      document.body.appendChild(F.fantasma); document.body.classList.add('mn-arrastrando');
    }
    F.fantasma.style.transform = 'translate(' + (ev.clientX + 12) + 'px,' + (ev.clientY + 10) + 'px)';
    const r = R.tl.getBoundingClientRect();
    F.dentro = ev.clientX > r.left + ETQ_W && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
    if (F.dentro && X) { F.t = teDeX(ev.clientX); marcarDestino(F.t); } else marcarDestino(null);
  }
  function soltarFicha() {
    const F = U.ficha; U.ficha = null;
    marcarDestino(null);
    if (F.fantasma) F.fantasma.remove();
    document.body.classList.remove('mn-arrastrando');
    if (!F.fantasma || !F.dentro || F.t == null) return;
    if (F.tipo === 'efectos') agregarSonido(F.ref, F.t);
    else if (F.tipo === 'escenas') agregarEscena(F.ref, F.t);
  }

  /* ══ El panel de arriba ══ */
  function aviso(t) {
    U.aviso = t; U.avisoT = Date.now();
    if (R) { R.aviso.textContent = t; R.aviso.classList.add('mn-aviso--on'); }
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => { if (R) R.aviso.classList.remove('mn-aviso--on'); }, 2200);
  }
  const boton = (txt, fn, clase, extra) => h('button', Object.assign({ type: 'button', class: 'mn-acc' + (clase ? ' ' + clase : ''), onClick: fn }, extra || {}), txt);
  const chip = (txt, on, fn, extra) => h('button', Object.assign({ type: 'button', class: 'mn-chip', 'aria-pressed': on ? 'true' : 'false', onClick: fn }, extra || {}), txt);
  const campo = (etq, ...hijos) => h('div', { class: 'mn-campo' }, h('span', null, etq), ...hijos);
  function titulo(p, txt, meta, mano) {
    return h('div', { class: 'mn-titulo' },
      h('span', { class: 'mn-chip-tipo', style: { background: COLOR[p], color: p === 'graficos' || p === 'voz' ? '#fff' : '#160910' } }, TIPO[p]),
      h('h3', null, txt),
      meta && meta.filter(Boolean).length ? h('span', { class: 'mn-meta' }, meta.filter(Boolean).map((m) => h('span', null, m))) : null,
      mano ? h('span', { class: 'mn-badge-mano', title: 'Cherry no lo cambia aunque muevas los ajustes de Automático' }, '✎ a mano') : null);
  }
  const vistaSel = (vis, ctl) => h('div', { class: 'mn-sel' }, h('div', { class: 'mn-sel-vis' }, vis), h('div', { class: 'mn-sel-ctl' }, ctl));
  const tiempoDe = (it) => fmt(it.t0) + ' – ' + fmt(it.t1);

  function panelFrase(it) {
    const s = C.state, subs = X.subs, f = it.f, impacto = X.impacto, pl = s.subsPlantilla || 'editorial';
    const actual = estiloDeFrase(f, impacto);
    const visto = actual === 'ninguno' ? 'ninguno' : impacto ? (actual === 'impacto' ? pl : 'simple') : (actual || pl);
    const vista = { palabras: subs.palabras.slice(f.desde, f.hasta + 1).map((w) => w.word),
                    clave: Array.isArray(f.clave) ? [f.clave[0] - f.desde, f.clave[1] - f.desde] : [-1, -1], cierra: !!f.cierra };
    let previa;
    try { previa = visto === 'ninguno' ? h('div', { class: 'mn-subprev mn-subprev--off' }, 'sin subtítulo') : h('div', { class: 'mn-subprev' }, C.subs.marco(visto, vista, C.subs.simpleVista(s))); }
    catch (_) { previa = h('div', { class: 'mn-subprev mn-subprev--off' }, it.texto); }
    const palabras = [];
    for (let i = f.desde; i <= f.hasta; i++) {
      const w = subs.palabras[i], clave = Array.isArray(f.clave) && i >= f.clave[0] && i <= f.clave[1];
      palabras.push(h('input', {
        class: 'mn-palabra' + (w.original != null ? ' mn-palabra--corregida' : '') + (clave ? ' mn-palabra--clave' : ''),
        value: w.word, size: String(Math.max(2, Array.from(w.word).length + 1)), spellcheck: 'true',
        title: w.original != null ? 'Antes decía «' + w.original + '» · escríbelo igual para deshacer' : 'Escribe la palabra correcta',
        onFocus: () => { U.escribiendo = true; },
        onBlur: () => { U.escribiendo = false; if (U.sucio) { U.sucio = false; setTimeout(() => { firmaP = ''; pintarPanel(); }, 0); } },
        onInput: (e) => { e.target.size = Math.max(2, Array.from(e.target.value).length + 1); },
        onChange: (e) => corregir(i, e.target.value),
        onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = w.word; e.target.blur(); } },
      }));
    }
    const claves = [];
    for (let i = f.desde; i <= f.hasta; i++) {
      const on = Array.isArray(f.clave) && f.clave[0] === i && f.clave[1] === i;
      claves.push(chip(subs.palabras[i].word, on, () => cambiarFrase(it, { clave: [i, i] }, 'Palabra clave: «' + subs.palabras[i].word + '»')));
    }
    const ops = opcionesEstilo(impacto);
    return vistaSel(previa, [
      titulo('subtitulos', it.texto, [tiempoDe(it), 'frase ' + (it.i + 1) + ' de ' + subs.frases.length], it.mano),
      h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Corregir lo que dice (se oyó mal)'), h('div', { class: 'mn-palabras' }, palabras)),
      campo('Palabra clave', h('div', { class: 'mn-chips' }, claves)),
      campo('Cómo sale esta frase', h('div', { class: 'mn-chips' }, ops.map((o) => chip(o.name, actual === o.id, () => ponerEstilo(it, o.id, impacto)))),
        !impacto && actual !== '' ? h('div', null, boton('Este estilo a todas', () => estiloATodas(actual === '' ? null : actual), 'mn-acc--chico')) : null),
    ]);
  }

  function panelGrafico(it) {
    const G = window.CherryGraf, g = it.g;
    let res = '';
    try { res = G && G.resumen ? G.resumen(g) : ''; } catch (_) { res = ''; }
    const gen = U.regen && (U.regen.id === it.id || U.regen.id === '*');
    return vistaSel(
      h('div', { class: 'mn-graf-vis' }, h('b', null, (G && G.NOMBRES && G.NOMBRES[g.tipo]) || g.tipo), res ? h('span', null, res) : null),
      [
        titulo('graficos', (G && G.NOMBRES && G.NOMBRES[g.tipo]) || g.tipo, [tiempoDe(it), coma(it.t1 - it.t0) + ' s'], it.mano),
        h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Lo que dices ahí'), h('div', { class: 'mn-cita mn-cita--graf' }, '«' + textoDe(g.desde, g.hasta) + '»')),
        h('div', { class: 'mn-campo mn-ancho' }, h('span', null, '¿No te gusta?'),
          gen
            ? h('div', { class: 'mn-dato' }, h('span', { class: 'spinner' }), ' Cherry está buscando otro',
                U.regen.eta ? [' · ', h('span', { 'data-eta': U.regen.eta.id }, U.regen.eta.texto())] : '…')
            : h('div', { class: 'mn-fila-acc' },
                boton('✦ Generar otro', () => otrosGraficos(it), 'mn-acc--prim', { title: 'La IA vuelve a marcar este momento; los demás se quedan' }),
                boton('Quitar', () => { U.sel = null; quitarGrafico(it); }, 'mn-acc--peligro'))),
      ]);
  }

  function panelEscena(it) {
    const x = it.x, z = it.zona, url = enlace(x.s3_key);
    const vis = url && url !== 'pidiendo'
      ? h('video', { class: 'mn-escena-vid', src: url + '#t=' + (Number(x.ss) || 0), muted: 'muted', autoplay: 'autoplay', loop: 'loop', playsinline: 'playsinline', preload: 'auto' })
      : h('div', { class: 'mn-escena-vid mn-escena-vid--cargando' }, url === 'pidiendo' ? h('span', { class: 'spinner' }) : h('span', { class: 'mn-dato' }, '▣'));
    const cats = categorias(), catActual = z && z.categoria ? z.categoria : '';
    const seg = Math.round((it.t1 - it.t0) * 10) / 10;
    return vistaSel(vis, [
      titulo('escenas', x.texto || 'Escena de apoyo', [tiempoDe(it), coma(seg) + ' s'], it.mano),
      campo('Dura',
        h('div', { class: 'mn-fila-acc' },
          h('input', { class: 'mn-entrada mn-entrada--num', type: 'number', min: '1', max: '30', step: '0.5', value: String(z && z.segundos ? z.segundos : seg),
            onFocus: () => { U.escribiendo = true; }, onBlur: () => { U.escribiendo = false; },
            onChange: (e) => { const v = clamp(Number(String(e.target.value).replace(',', '.')) || 0, 1, 30); if (v) durarEscena(it, v); } }),
          h('span', { class: 'mn-dato' }, 'segundos · o estira su borde derecho en la línea de tiempo'))),
      campo('Categoría',
        U.buscando ? h('div', { class: 'mn-dato' }, h('span', { class: 'spinner' }), ' Buscando tomas de «' + U.buscando + '»…')
          : h('div', { class: 'mn-chips' },
              chip('La que escoja Cherry', !catActual, () => categoriaEscena(it, '')),
              cats.length ? cats.map((c) => chip(c, catActual === c, () => categoriaEscena(it, c))) : h('span', { class: 'mn-dato' }, 'Cargando categorías…'))),
      h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'La toma'),
        h('div', { class: 'mn-fila-acc' },
          boton('↻ Otra toma', () => otraToma(it), '', { title: '¿No te gusta? Pasa a la siguiente' }),
          boton('Quitar', () => { U.sel = null; quitarEscena(it); }, 'mn-acc--peligro'),
          z ? boton('↺ Que decida Cherry', () => { U.sel = null; zonas([['escenas', z, null, null]], 'Lo decide Cherry'); }, '', { title: 'Quitar lo que fijaste: Cherry decide si va o no' }) : null)),
    ]);
  }

  function panelEfecto(it) {
    const Sx = window.CherrySonidos, x = it.x, so = it.so, vol = x.vol == null ? 100 : Number(x.vol);
    const cat = U.catSonSel && U.catSonSel.id === it.id ? U.catSonSel.cat : so.cat;
    const w = X.subs && X.subs.palabras[Math.round(Number(x.palabra))];
    return vistaSel(
      h('button', { type: 'button', class: 'mn-son-grande', title: 'Escucharlo', onClick: () => oir(so, vol) }, '▶'),
      [
        titulo('efectos', so.nombre, [fmt(it.t0), coma(so.dur) + ' s', w ? 'golpe en «' + w.word + '»' : ''], it.mano),
        campo('Volumen',
          h('div', { class: 'mn-fila-acc' },
            h('input', { type: 'range', min: '0', max: '150', step: '5', value: String(vol), class: 'mn-rango',
              onInput: (e) => { const l = e.target.parentNode.querySelector('.mn-vol'); if (l) l.textContent = e.target.value + ' %'; },
              onChange: (e) => cambiarSonido(it.id, { vol: Number(e.target.value) }, 'Volumen ' + e.target.value + ' %') }),
            h('span', { class: 'mn-dato mn-vol' }, vol + ' %'))),
        campo('Correrlo una décima',
          h('div', { class: 'mn-fila-acc' },
            boton('− 0,1 s', () => cambiarSonido(it.id, { mover: Math.max(-2, Math.round(((Number(x.mover) || 0) - 0.1) * 10) / 10) }), 'mn-acc--chico'),
            boton('+ 0,1 s', () => cambiarSonido(it.id, { mover: Math.min(2, Math.round(((Number(x.mover) || 0) + 0.1) * 10) / 10) }), 'mn-acc--chico'),
            h('span', { class: 'mn-dato' }, 'o arrástralo en la línea de tiempo'))),
        h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Cambiarlo por otro'),
          h('div', { class: 'mn-chips' }, Sx.CATEGORIAS.map((c) => chip(c.nombre, c.id === cat, () => { U.catSonSel = { id: it.id, cat: c.id }; firmaP = ''; pintarPanel(); }))),
          h('div', { class: 'mn-lista-son' }, Sx.deCategoria(cat).map((o) => h('span', { class: 'mn-son' + (o.id === so.id ? ' mn-son--on' : '') },
            h('button', { type: 'button', class: 'mn-son-oir', title: 'Escuchar', onClick: () => oir(o, vol) }, '▶'),
            h('button', { type: 'button', class: 'mn-son-n', title: 'Usar este', onClick: () => { cambiarSonido(it.id, { sonido: o.id }, 'Ahora suena «' + o.nombre + '»'); oir(o, vol); } }, o.nombre))))),
        h('div', { class: 'mn-fila-acc mn-ancho' }, boton('Quitar este efecto', () => quitar({ pista: 'efectos', id: it.id }), 'mn-acc--peligro')),
      ]);
  }

  function panelToma(it, voz) {
    const cl = it.clip, s = C.state;
    const foto = cl && cl.thumbnail_url ? h('img', { class: 'mn-toma-foto', src: cl.thumbnail_url, alt: '' }) : h('div', { class: 'mn-toma-foto' });
    const ctl = [
      titulo(voz ? 'voz' : 'tomas', (voz ? 'Voz de la toma ' : 'Toma ') + (it.i + 1), [tiempoDe(it), coma(it.t1 - it.t0) + ' s', cl ? cl.file_name : ''].filter(Boolean)),
      it.texto ? h('div', { class: 'mn-cita mn-ancho' }, '«' + it.texto + '»') : null,
    ];
    if (voz && C.controlVoz) ctl.push(h('div', { class: 'mn-ancho mn-voz' }, C.controlVoz(s)));
    if (!voz) ctl.push(h('p', { class: 'mn-dato mn-ancho' }, 'Esta toma sale de ' + (cl ? cl.file_name : 'tu clip') + (isFinite(it.ini) ? ', del segundo ' + coma(it.ini) + ' al ' + coma(it.fin) : '') + '.'));
    return vistaSel(foto, ctl);
  }

  function panelVacio() {
    return h('div', { class: 'mn-vacio' },
      h('div', null,
        h('span', { class: 'mn-kicker' }, 'Editor manual'),
        h('h3', null, 'Toca cualquier cosa de la línea de tiempo para cambiarla'),
        h('p', { class: 'mn-dato' }, 'Corrige una palabra del subtítulo, mueve un efecto, cambia una escena o pide otro gráfico. Lo que tocas aquí queda ', h('b', null, 'fijo (✎)'), ': Cherry no lo cambia aunque muevas los ajustes de Automático.')),
      h('div', null,
        h('span', { class: 'mn-kicker' }, 'En tu video'),
        h('ul', { class: 'mn-cuentas' },
          ['subtitulos', 'graficos', 'escenas', 'efectos'].map((p) => h('li', null, h('i', { style: { background: COLOR[p] } }), h('b', null, String(listaDe(p).length)), ' ' + NOMBRE[p].toLowerCase())))),
      h('div', null,
        h('span', { class: 'mn-kicker' }, 'Atajos'),
        h('ul', { class: 'mn-atajos' },
          h('li', null, h('kbd', null, 'Espacio'), ' reproducir o pausar'),
          h('li', null, h('kbd', null, 'Supr'), ' quitar lo escogido'),
          h('li', null, h('kbd', null, 'Ctrl Z'), ' deshacer · ', h('kbd', null, 'Ctrl Y'), ' rehacer'),
          h('li', null, h('kbd', null, 'Esc'), ' soltar lo escogido'))));
  }

  function panelClips() {
    const clips = C.state.clips || [];
    return h('div', { class: 'mn-clips' }, clips.map((c) => {
      const usos = X.tomas.filter((t) => t.clip && t.clip.id === c.id).map((t) => t.i + 1);
      return h('button', { type: 'button', class: 'mn-clip', title: usos.length ? 'Ver dónde va' : 'Este clip no quedó en el video',
        onClick: () => { const t = X.tomas.find((x) => x.clip && x.clip.id === c.id); if (t) escoger('tomas', t.id); } },
        h('span', { class: 'mn-clip-foto' }, c.thumbnail_url ? h('img', { src: c.thumbnail_url, alt: '' }) : null, h('em', null, fmtC(Number(c.duration_sec) || 0))),
        h('b', null, c.file_name || 'Clip'),
        h('span', { class: 'mn-clip-uso' + (usos.length ? ' mn-clip-uso--si' : '') }, usos.length ? (usos.length === 1 ? 'toma ' : 'tomas ') + usos.join(', ') : 'no quedó en el video'));
    }));
  }

  function panelAgregar() {
    const Sx = window.CherrySonidos, s = C.state;
    const secciones = [['efectos', '♪', 'Efecto de sonido'], ['escenas', '▣', 'Escena de apoyo'], ['graficos', '✦', 'Gráficos']];
    let cuerpo;
    if (U.seccion === 'efectos') {
      cuerpo = [
        h('p', { class: 'mn-dato mn-ancho' }, 'Arrastra el que quieras a la línea de tiempo, o toca ', h('b', null, '＋ Agregar'), ' y queda donde está la línea blanca.'),
        h('div', { class: 'mn-chips mn-ancho' }, Sx.CATEGORIAS.map((c) => chip(c.nombre, U.catSon === c.id, () => { U.catSon = c.id; firmaP = ''; pintarPanel(); }))),
        h('div', { class: 'mn-lista-son mn-lista-son--agregar mn-ancho' }, Sx.deCategoria(U.catSon).map((o) => h('span', {
          class: 'mn-son mn-ficha', title: 'Arrástralo a la línea de tiempo',
          onPointerdown: (ev) => { if (ev.target.closest('button')) return; bajarFicha(ev, { tipo: 'efectos', ref: o.id, nombre: '♪ ' + o.nombre }); } },
          h('button', { type: 'button', class: 'mn-son-oir', title: 'Escuchar', onClick: () => oir(o, 100) }, '▶'),
          h('span', { class: 'mn-son-n' }, o.nombre, h('small', null, coma(o.dur) + ' s')),
          h('button', { type: 'button', class: 'mn-son-mas', title: 'Ponerlo donde está la línea blanca', onClick: () => agregarSonido(o.id, C.cortesVivo.tiempo() || 0) }, '＋ Agregar')))),
      ];
    } else if (U.seccion === 'escenas') {
      const cats = categorias();
      cuerpo = [
        h('p', { class: 'mn-dato mn-ancho' }, 'Escoge la categoría y Cherry busca dentro de ella la toma que mejor va con lo que dices ahí. Arrástrala a la línea de tiempo o toca ', h('b', null, '＋ Agregar'), ' (queda donde está la línea blanca). Dura ' + DUR_ESCENA + ' s; luego la estiras.'),
        h('div', { class: 'mn-escena-rec mn-ancho mn-ficha', onPointerdown: (ev) => { if (ev.target.closest('button')) return; bajarFicha(ev, { tipo: 'escenas', ref: '', nombre: '▣ La que recomiende Cherry' }); } },
          h('b', null, '✦ Que Cherry recomiende'), h('span', { class: 'mn-dato' }, 'Busca en toda la biblioteca por lo que dices'),
          boton('＋ Agregar', () => agregarEscena('', C.cortesVivo.tiempo() || 0), 'mn-acc--prim mn-acc--chico')),
        U.buscando ? h('div', { class: 'mn-dato mn-ancho' }, h('span', { class: 'spinner' }), ' Buscando tomas de «' + U.buscando + '»…') : null,
        h('div', { class: 'mn-cats mn-ancho' }, cats.length ? cats.map((c) => h('span', { class: 'mn-cat mn-ficha', title: 'Arrástrala a la línea de tiempo',
          onPointerdown: (ev) => { if (ev.target.closest('button')) return; bajarFicha(ev, { tipo: 'escenas', ref: c, nombre: '▣ ' + c }); } },
          h('span', null, c), h('button', { type: 'button', class: 'mn-son-mas', onClick: () => agregarEscena(c, C.cortesVivo.tiempo() || 0) }, '＋ Agregar')))
          : h('span', { class: 'mn-dato' }, h('span', { class: 'spinner' }), ' Cargando la biblioteca…')),
      ];
    } else {
      const gen = U.regen && U.regen.id === '*';
      cuerpo = [
        s.grafOn
          ? h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Otros gráficos para todo el video'),
              h('p', { class: 'mn-dato' }, 'La IA vuelve a leer lo que dices y marca otros momentos. Para cambiar uno solo, tócalo en la línea de tiempo y dale «Generar otro».'),
              gen ? h('div', { class: 'mn-dato' }, h('span', { class: 'spinner' }), ' Buscando otros gráficos', U.regen.eta ? [' · ', h('span', { 'data-eta': U.regen.eta.id }, U.regen.eta.texto())] : '…')
                : h('div', null, boton('✦ Cambiar todos', () => otrosGraficos(null), 'mn-acc--prim')))
          : h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Tu video no lleva gráficos'),
              h('p', { class: 'mn-dato' }, 'Cherry marca los momentos de tu video que se entienden mejor con un gráfico (una cifra, una lista, un antes y después).'),
              h('div', null, boton('✦ Poner gráficos', () => { C.setState({ grafOn: true }); aviso('Gráficos puestos'); }, 'mn-acc--prim'))),
      ];
    }
    return h('div', { class: 'mn-agregar' },
      h('div', { class: 'mn-ag-lista' }, secciones.map((x) => h('button', { type: 'button', 'aria-pressed': U.seccion === x[0] ? 'true' : 'false',
        onClick: () => { U.seccion = x[0]; firmaP = ''; pintarPanel(); } }, h('i', { style: { color: COLOR[x[0]] } }, x[1]), x[2]))),
      h('div', { class: 'mn-ag-panel' }, cuerpo));
  }

  function pintarPanel() {
    if (!R) return;
    if (U.escribiendo) { U.sucio = true; return; }
    const s = C.state;
    if (!X) {
      R.tabs.replaceChildren();
      R.cuerpo.replaceChildren(h('div', { class: 'mn-espera' }, h('span', { class: 'spinner spinner--lg' }),
        h('b', null, 'Preparando tu video'),
        h('span', { class: 'mn-dato' }, (s.clips || []).length ? 'Cuando la vista previa esté lista, aquí aparece todo tu video pista por pista.' : 'Sube tus clips en Automático y aquí aparece todo tu video pista por pista.')));
      return;
    }
    const it = U.sel && buscar(U.sel.pista, U.sel.id);
    if (U.sel && !it) U.sel = null;
    const firma = JSON.stringify([U.tab, U.sel, U.seccion, U.catSon, U.buscando, !!U.regen, s.grafOn, s.vozEstudio, (s.clips || []).length,
      it ? [it.t0, it.t1, it.f || it.x || it.g || null, it.zona || null] : null, X.subs && it && it.f ? X.subs.palabras.slice(it.f.desde, it.f.hasta + 1) : null,
      CATS.lista ? CATS.lista.length : 0, U.catSonSel || null, it && it.x && it.x.s3_key ? String(ENL[it.x.s3_key]) : '']);
    if (firma === firmaP) return;
    firmaP = firma;
    R.tabs.replaceChildren(...[
      h('button', { type: 'button', role: 'tab', 'aria-selected': U.tab === 'escogido' ? 'true' : 'false', onClick: () => { U.tab = 'escogido'; firmaP = ''; pintarPanel(); } },
        it ? [h('i', { style: { background: COLOR[U.sel.pista] } }), 'Lo escogido · ' + TIPO[U.sel.pista]] : 'Lo escogido'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': U.tab === 'clips' ? 'true' : 'false', onClick: () => { U.tab = 'clips'; firmaP = ''; pintarPanel(); } },
        'Tus clips ', h('small', null, String((s.clips || []).length))),
      h('button', { type: 'button', role: 'tab', 'aria-selected': U.tab === 'agregar' ? 'true' : 'false', onClick: () => { U.tab = 'agregar'; firmaP = ''; pintarPanel(); } }, '＋ Agregar'),
      U.tab === 'escogido' && it ? h('button', { type: 'button', class: 'mn-x', title: 'Soltar lo escogido (Esc)', 'aria-label': 'Soltar lo escogido', onClick: () => escoger(null) }, '✕') : null].filter(Boolean));
    let cuerpo;
    try {
      if (U.tab === 'clips') cuerpo = panelClips();
      else if (U.tab === 'agregar') cuerpo = panelAgregar();
      else if (!it) cuerpo = panelVacio();
      else if (U.sel.pista === 'subtitulos') cuerpo = panelFrase(it);
      else if (U.sel.pista === 'graficos') cuerpo = panelGrafico(it);
      else if (U.sel.pista === 'escenas') cuerpo = panelEscena(it);
      else if (U.sel.pista === 'efectos') cuerpo = panelEfecto(it);
      else cuerpo = panelToma(it, U.sel.pista === 'voz');
    } catch (e) {
      console.error('[Manual] panel', e);
      cuerpo = h('p', { class: 'mn-dato', style: { padding: '16px' } }, 'No se pudo mostrar esto. Toca otra cosa.');
    }
    R.cuerpo.replaceChildren(cuerpo);
  }

  function pintarVer() {
    const cuantos = (p) => (p === 'voz' ? X.tomas.length : listaDe(p).length);
    R.ver.replaceChildren(h('span', { class: 'mn-ver-etq' }, 'Ver'),
      ...ORDEN.map((p) => h('button', { type: 'button', class: 'mn-vsw', role: 'switch', style: { '--c': COLOR[p] }, 'aria-checked': U.ver[p] ? 'true' : 'false',
        title: (U.ver[p] ? 'Quitar de la línea de tiempo' : 'Ver en la línea de tiempo') + ' (el video no cambia)',
        onClick: () => { U.ver[p] = !U.ver[p]; guardarVer(); firmaL = ''; pintar(); } },
        h('span', { class: 'mn-sw' }), NOMBRE[p], X ? h('small', null, String(cuantos(p))) : null)),
      h('button', { type: 'button', class: 'mn-ver-todo', onClick: () => { ORDEN.forEach((p) => { U.ver[p] = true; }); guardarVer(); firmaL = ''; pintar(); } }, 'Ver todo'));
  }

  /* ══ Armar la isla una vez ══ C.render() rehace toda la app en cada cambio; esta parte vive aparte (su scroll, lo que se
     arrastra, lo que se escribe) y solo se vuelve a pintar lo que cambió. */
  function armar() {
    const reloj = h('span', { class: 'mn-reloj' }, '0:00.0 ', h('span', null, '/ 0:00.0'));
    const play = h('button', { type: 'button', class: 'mn-play', 'aria-label': 'Reproducir o pausar', onClick: () => C.actions.togglePlay() });
    const tabs = h('div', { class: 'mn-tabs', role: 'tablist' });
    const franja = h('div', { class: 'mn-franja' });
    const cuerpo = h('div', { class: 'mn-cuerpo' });
    const ver = h('div', { class: 'mn-ver', role: 'group', 'aria-label': 'Qué pistas ver en la línea de tiempo' });
    const lienzo = h('div', { class: 'mn-lienzo' });
    const tl = h('div', { class: 'mn-tl' }, lienzo);
    const avisoEl = h('div', { class: 'mn-aviso', role: 'status' });
    const herr = h('div', { class: 'mn-herr' }, play, reloj,
      h('button', { type: 'button', class: 'mn-hbtn', title: 'Quitar lo escogido (Supr)', onClick: () => quitar(U.sel) }, '🗑 Quitar'),
      h('button', { type: 'button', class: 'mn-hbtn', title: 'Deshacer (Ctrl+Z)', 'aria-label': 'Deshacer', onClick: () => volver(HIST, FUT) }, '↶'),
      h('button', { type: 'button', class: 'mn-hbtn', title: 'Rehacer (Ctrl+Y)', 'aria-label': 'Rehacer', onClick: () => volver(FUT, HIST) }, '↷'),
      h('span', { class: 'mn-sep' }),
      h('button', { type: 'button', class: 'mn-hbtn', onClick: () => { U.tab = 'agregar'; firmaP = ''; pintarPanel(); } }, '＋ Agregar'),
      h('span', { class: 'mn-der' },
        h('span', { class: 'mn-dato mn-dato--mini' }, 'acercar'),
        h('button', { type: 'button', class: 'mn-hbtn', 'aria-label': 'Alejar', onClick: () => zoom(U.zoom / 1.6) }, '−'),
        h('button', { type: 'button', class: 'mn-hbtn', 'aria-label': 'Acercar', onClick: () => zoom(U.zoom * 1.6) }, '＋')));
    const raiz = h('div', { class: 'mn' },
      h('section', { class: 'mn-panel' }, h('div', { class: 'mn-cab' }, tabs, franja), cuerpo),
      h('section', { class: 'mn-linea' }, herr, ver, tl, avisoEl));
    lienzo.addEventListener('pointerdown', alBajar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSubir);
    lienzo.addEventListener('pointercancel', () => { U.arr = null; marcarDestino(null); });
    tl.addEventListener('scroll', () => { const c = lienzo.querySelector('.mn-cabezal'); if (c && X) c.style.visibility = px(C.cortesVivo.tiempo() || 0) < tl.scrollLeft + ETQ_W ? 'hidden' : 'visible'; });
    if (window.ResizeObserver) new ResizeObserver(() => {
      const k = tl.clientWidth + 'x' + tl.clientHeight;
      if (k !== tamL && tl.clientWidth) { tamL = k; firmaL = ''; pintar(); }
    }).observe(tl);
    R = { raiz, tabs, franja, cuerpo, ver, tl, lienzo, reloj, play, aviso: avisoEl, herr };
  }
  function zoom(z) {
    const t = C.cortesVivo.tiempo() || 0;
    U.zoom = clamp(z, 1, 24);
    firmaL = ''; pintar();
    if (X) R.tl.scrollLeft = Math.max(0, px(t) - R.tl.clientWidth / 2);
  }

  function pintar() {
    if (!R) return;
    X = datos();
    const s = C.state;
    if (X && U.selEscena != null) {
      const e = X.escenas.find((x) => x.zona && Number(x.zona.desde) === U.selEscena);
      if (e) { U.sel = { pista: 'escenas', id: e.id }; U.selEscena = null; }
    }
    const firma = !X ? 'nada' : JSON.stringify([X.total, X.tomas.length, X.frases.map((f) => [f.t0, f.texto, f.off, f.imp, f.mano]), X.graficos.map((g) => [g.id, g.t0, g.t1, g.mano]),
      X.escenas.map((e) => [e.id, e.t1, e.mano]), X.efectos.map((e) => [e.id, e.t0, e.so.id, e.mano]), U.ver, U.zoom, U.sel, U.regen && U.regen.id, tamL,
      (s.clips || []).map((c) => c.thumbnail_url || '').join('|')]);
    if (firma !== firmaL) {
      firmaL = firma;
      if (X) { pintarVer(); pintarLinea(); }
      else { R.ver.replaceChildren(); R.lienzo.innerHTML = ''; }
      R.herr.style.visibility = X ? '' : 'hidden';
    }
    pintarPanel();
  }

  /* ══ Lo que pinta main.js ══ */
  C.Manual = function () {
    if (!R) armar();
    // lo que se estaba viendo de la línea de tiempo y lo que se estaba escribiendo vuelven después de que C.render la mueve
    const sl = R.tl.scrollLeft, st = R.tl.scrollTop, foco = R.raiz.contains(document.activeElement) ? document.activeElement : null;
    const selIni = foco && foco.selectionStart != null ? [foco.selectionStart, foco.selectionEnd] : null;
    pintar();
    R.franja.replaceChildren(C.fabricar ? C.fabricar.franja(C.state) : '');
    Promise.resolve().then(() => {
      if (!R.raiz.isConnected) return;
      R.tl.scrollLeft = sl; R.tl.scrollTop = st;
      if (foco && R.raiz.contains(foco) && document.activeElement !== foco) { foco.focus({ preventScroll: true }); if (selIni) try { foco.setSelectionRange(selIni[0], selIni[1]); } catch (_) {} }
      const k = R.tl.clientWidth + 'x' + R.tl.clientHeight;
      if (k !== tamL && R.tl.clientWidth) { tamL = k; firmaL = ''; pintar(); }
      if (!U.raf) U.raf = requestAnimationFrame(bucle);
    });
    return R.raiz;
  };

  C.ModoEditor = function () {
    const man = modoActual() === 'manual';
    return h('div', { class: 'modo-ed' + (man ? ' modo-ed--manual' : ''), role: 'radiogroup', 'aria-label': 'Modo del editor' },
      h('span', { class: 'modo-ed__pulgar' }),
      h('button', { type: 'button', role: 'radio', 'aria-checked': man ? 'false' : 'true', title: 'Escoges el estilo y Cherry lo pone todo', onClick: () => { if (man) ponerModo('auto'); } }, '✦ Automático'),
      h('button', { type: 'button', role: 'radio', 'aria-checked': man ? 'true' : 'false', title: 'Tocas cada cosa por separado en una línea de tiempo', onClick: () => { if (!man) ponerModo('manual'); } }, '✎ Manual'));
  };

  /* Atajos de teclado (solo en Manual y fuera de los campos de texto) */
  document.addEventListener('keydown', (e) => {
    if (!R || !R.raiz.isConnected || modoActual() !== 'manual') return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (document.querySelector('.modal-wrap')) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (k === 'z' || k === 'Z') && !e.shiftKey) { e.preventDefault(); volver(HIST, FUT); return; }
    if (ctrl && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { e.preventDefault(); volver(FUT, HIST); return; }
    if (ctrl || e.altKey) return;
    if (k === ' ') { e.preventDefault(); C.actions.togglePlay(); }
    else if ((k === 'Delete' || k === 'Backspace') && U.sel) { e.preventDefault(); quitar(U.sel); }
    else if (k === 'Escape' && U.sel) escoger(null);
  });

  C.manual = { activo: () => modoActual() === 'manual', modo: ponerModo };
})();

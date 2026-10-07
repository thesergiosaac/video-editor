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
    if (!CV || !CV.datosVista) return null;
    const TM = CV.tomas, modo = TM ? TM.modo() : null;
    const m = CV.momentos(), D = CV.datosVista();
    if (!m || !D || !Array.isArray(m.palabras) || !m.palabras.length) return null;
    const aR = m.aReal, P = m.palabras, s = C.state;
    const trans = modo === 'transicion', rapida = modo === 'rapida';
    const rg = trans ? TM.rangos() : null, FV = trans ? TM.fuenteV() : rapida ? TM.plan() : null;
    if ((trans && (!rg || !FV)) || (rapida && !FV)) return null;
    const durs = (D.duraciones || []).map(Number);
    const total = CV.duracion() || durs.reduce((a, b) => a + b, 0) || 1;
    const cuts = D.cortes && Array.isArray(D.cortes.cuts) ? D.cortes.cuts : [];
    const clips = s.clips || [];
    const clipDe = (id) => clips.find((x) => x.id === id) || null;
    /* Mientras se arma la base de unas tomas a mano, lo que se ve es la fuente saltando lo recortado (lo de la fuente,
       segundos b0–b1, se dibuja donde cae en la lista nueva, t0–t1; lo que se quitó no se dibuja) o, si alargaste o metiste
       un clip, la vista rápida: tus clips de corte en corte, solo con subtítulos (gráficos, escenas y efectos vuelven en
       cuanto llega la base: así lo muestra el celular). */
    const aV = (b0, b1) => {
      if (rapida) return null;
      if (!trans) return [b0, b1];
      for (let i = 0; i < rg.length; i++) {
        const r = rg[i], a = Math.max(b0, r.r0), b = Math.min(b1, r.r1);
        if (b - a > 0.04) return [r.v0 + (a - r.r0), r.v0 + (b - r.r0)];
      }
      return null;
    };
    const aBase = (tv) => {
      if (!trans) return tv;
      let r = rg.find((x) => tv < x.v0 + (x.r1 - x.r0));
      if (!r) r = rg[rg.length - 1];
      return r.r0 + Math.max(0, Math.min(r.r1 - r.r0, tv - r.v0));
    };
    let tomas, voz = null, filasTomas = 1, lineasTomas = [], finPrincipal = total, finC = total;
    const L = TM ? TM.lista() : null, mano = !!(TM && TM.activa());
    /* (8-oct) La pista de las tomas sale de TU lista: la línea principal y las tomas de encima (js/recorte.js · aplanar).
       Cada pedazo que va al video está donde lo pone el reproductor (la base, la fuente saltando o la vista rápida): así
       la línea de tiempo y el celular dicen lo mismo. Lo de la principal que tapa una toma de encima se ve oscuro. */
    const RCx = window.CherryRecorte, F = TM && TM.fuente ? TM.fuente() : null;
    const PL = L && RCx && F ? RCx.aplanar(L, F) : null;
    const vivos = PL ? PL.partes.filter((p) => !p.fuera) : [];
    let pos;   // de cada pedazo: [desde, hasta] en el video y [desde, hasta] en el reloj de sus palabras
    if (trans) pos = rg.map((r) => [r.v0, r.v0 + (r.r1 - r.r0), r.nv0, r.nv0 + (r.r1 - r.r0)]);
    else if (rapida) pos = FV.cortes.map((c) => [c.ini, c.ini + c.dur, c.ini, c.ini + c.dur]);
    else { let e = 0; pos = durs.map((d) => { const o = [e, e + d, e, e + d]; e += d; return o; }); }
    if (PL && vivos.length && pos.length === vivos.length) {
      const real = (t, fin) => {
        for (let i = 0; i < vivos.length; i++) {
          const p = vivos[i], q = pos[i];
          if (fin ? t > p.t0 + 1e-6 && t <= p.t1 + 1e-6 : t >= p.t0 - 1e-6 && t < p.t1 - 1e-6) return q[0] + Math.min(q[1] - q[0], Math.max(0, t - p.t0));
        }
        for (let i = 0; i < vivos.length; i++) if (vivos[i].t0 >= t - 1e-6) return pos[i][0];
        return pos[pos.length - 1][1];
      };
      const dichas = (i) => (trans || rapida ? FV.palabras.filter((w) => w.start >= pos[i][2] - 0.01 && w.start < pos[i][3])
        : P.filter((w) => { const x = aR(Number(w.start)); return x >= pos[i][0] - 0.01 && x < pos[i][1]; })).map((w) => w.word).join(' ');
      const textos = {}, suyos = {};
      vivos.forEach((p, i) => {
        const k = p.j != null ? 'o' + p.j : 't' + p.n;
        textos[k] = (textos[k] ? textos[k] + ' ' : '') + dichas(i);
        (suyos[k] = suyos[k] || []).push([pos[i][0], pos[i][1]]);
      });
      const clipC = (c) => clipDe(c.k >= 0 && F.cuts[c.k] ? F.cuts[c.k].clipId : c.clipId);
      lineasTomas = [...new Set((L.encima || []).map((e) => Math.max(1, Number(e.fila) || 1)))].sort((a, b) => a - b);
      filasTomas = lineasTomas.length + 1;
      finPrincipal = real(PL.fin, true); finC = PL.fin;
      // lo tapado de una toma de la principal (para verlo oscuro): lo que no es suyo dentro de ella
      const tapado = (k, t0, t1) => {
        const out = []; let x = t0;
        (suyos[k] || []).slice().sort((a, b) => a[0] - b[0]).forEach((r) => { if (r[0] > x + 0.03) out.push([x, Math.min(r[0], t1)]); x = Math.max(x, r[1]); });
        if (t1 > x + 0.03) out.push([x, t1]);
        return out;
      };
      tomas = L.cortes.map((c, n) => {
        const r = PL.principal[n];
        if (!r || !(r[1] > r[0])) return null;
        const t0 = real(r[0]), t1 = real(r[1], true);
        return { id: 't' + n, i: n, k: c.k, c, c0: r[0], t0, t1, b0: t0, b1: t1, texto: (textos['t' + n] || '').trim(), clip: clipC(c),
                 ini: c.a, fin: c.b, mano, linea: 0, fila: lineasTomas.length, tapado: tapado('t' + n, t0, t1) };
      }).filter(Boolean).concat((L.encima || []).map((e, j) => {
        const r = PL.encima[j], ln = Math.max(1, Number(e.fila) || 1);
        if (!r || !(r[1] > r[0])) return null;
        const t0 = real(r[0]), t1 = real(r[1], true);
        return { id: 'o' + j, i: -1, j, encima: true, k: e.k, c: e, c0: r[0], t0, t1, b0: t0, b1: t1, texto: (textos['o' + j] || '').trim(), clip: clipC(e),
                 ini: e.a, fin: e.b, mano: true, linea: ln, fila: lineasTomas.length - 1 - lineasTomas.indexOf(ln), tapado: tapado('o' + j, t0, t1) };
      }).filter(Boolean));
      // la voz: lo que se oye, pedazo por pedazo
      voz = vivos.map((p, i) => {
        const de = tomas.find((x) => (p.j != null ? x.encima && x.j === p.j : !x.encima && x.i === p.n));
        return de ? Object.assign({}, de, { id: 'v' + i, t0: pos[i][0], t1: pos[i][1], b0: pos[i][0], b1: pos[i][1], toma: de.id, fila: 0 }) : null;
      }).filter(Boolean);
    } else if (trans || rapida) {
      const piezas = trans ? rg.map((r) => ({ v0: r.v0, dur: r.r1 - r.r0, nv0: r.nv0 })) : FV.cortes.map((c) => ({ v0: c.ini, dur: c.dur, nv0: c.ini, clipId: c.clipId }));
      tomas = piezas.map((r, n) => {
        const lt = L && L.cortes[n], c = lt && lt.k >= 0 ? cuts[lt.k] : null;
        const texto = FV.palabras.filter((w) => w.start >= r.nv0 - 0.01 && w.start < r.nv0 + r.dur).map((w) => w.word).join(' ');
        return { id: 't' + n, i: n, k: lt ? lt.k : -1, t0: r.v0, t1: r.v0 + r.dur, b0: r.v0, b1: r.v0 + r.dur, texto,
                 clip: clipDe(c ? c.clipId : (lt && lt.clipId) || r.clipId), ini: lt ? lt.a : NaN, fin: lt ? lt.b : NaN, mano };
      });
    } else {
      let e = 0;
      tomas = durs.map((d, i) => {
        const c = cuts[i] || {};
        const o = { id: 't' + i, i, k: i, t0: e, t1: e + d, b0: e, b1: e + d, texto: c.text || '', clip: clipDe(c.clipId), ini: Number(c.startTime), fin: Number(c.endTime), mano };
        e += d; return o;
      });
    }
    if (!voz) voz = tomas;
    // (8-oct) una edición hecha a mano: sus capas son los gráficos; esconde los subtítulos en sus ventanas «oculto»
    const ed = m.edicion || null;
    const ocultas = ed ? ed.subs.filter((v) => v.modo === 'oculto') : [];
    const oculta = (b0, b1) => ocultas.some((v) => b0 < v.t1 && b1 > v.t0 && Math.min(b1, v.t1) - Math.max(b0, v.t0) >= (b1 - b0) * 0.5);
    const subs = subsActual();
    const impacto = C.subs.modoImpacto(s);
    const frase = (f, i, id, t0, t1, b0, b1, pal, desde, hasta) => {
      const texto = pal.slice(desde, hasta + 1).map((w) => w.word).join(' ');
      const corregidas = pal.slice(desde, hasta + 1).some((w) => w.original != null);
      const edOculta = !rapida && oculta(b0, b1);
      return { id, i, f, t0, t1, texto, edOculta,
               off: f.estilo === 'ninguno' || edOculta, imp: f.estilo !== 'ninguno' && (impacto ? !!(f.impacto || f.estilo) : !!f.estilo),
               mano: !!(D.editadas && (f.estilo || corregidas)) };
    };
    let frases;
    if (trans || rapida) {
      // las frases de la lista nueva; cada una sabe de qué frase de la fuente sale (lo que se edita es la de la fuente)
      const veces = {};
      const vr = (tn) => {
        if (rapida) return tn;
        const r = rg.find((x) => tn >= x.nv0 - 0.01 && tn < x.nv0 + (x.r1 - x.r0) + 0.01) || rg[0];
        return r.v0 + (tn - r.nv0);
      };
      frases = subs ? (FV.frasesIA || []).map((g) => {
        const fi = g._fi, f = fi != null ? subs.frases[fi] : null, w0 = FV.palabras[g.desde], w1 = FV.palabras[g.hasta];
        if (!w0 || !w1) return null;
        const t0 = vr(Number(w0.start)), t1 = vr(Number(w1.end)) + 0.12;
        // una frase de lo que alargaste o de un clip nuevo: se ve, y se edita cuando llegue la base
        if (!f) return Object.assign(frase(g, -1, 'fn' + g.desde, t0, t1, t0, t1, FV.palabras, g.desde, g.hasta), { nueva: true });
        veces[fi] = (veces[fi] || 0) + 1;
        return frase(f, fi, 'f' + fi + (veces[fi] > 1 ? '-' + veces[fi] : ''), t0, t1, aBase(t0), aBase(t1), FV.palabras, g.desde, g.hasta);
      }).filter(Boolean) : [];
    } else {
      frases = subs ? subs.frases.map((f, i) => {
        const w0 = P[f.desde], w1 = P[f.hasta];
        if (!w0 || !w1) return null;
        const t0 = aR(Number(w0.start)), t1 = aR(Number(w1.end)) + 0.12;
        return frase(f, i, 'f' + i, t0, t1, t0, t1, subs.palabras, f.desde, f.hasta);
      }).filter(Boolean) : [];
    }
    // (8-oct, Sergio) una frase sin subtítulo (la quitaste, o la esconde la edición a mano) no sale en el celular: aquí tampoco
    frases = frases.filter((f) => !f.off);
    frases.sort((a, b) => a.t0 - b.t0);
    frases.forEach((f, k) => { const n = frases[k + 1]; if (n && f.t1 > n.t0) f.t1 = n.t0; });
    const enLista = (o) => { const v = aV(o.b0, o.b1); return v ? Object.assign(o, { t0: v[0], t1: v[1] }) : null; };
    const fij = s.guionFijos || {};
    const zG = (fij.graficos && fij.graficos.si) || [];
    let graficos = (m.graficos || []).map((g) => enLista({ id: 'g' + g.desde + '-' + g.tipo, g, b0: Number(g.t0), b1: Number(g.t1),
      mano: !!g.editado || zG.some((z) => Number(z.desde) <= g.hasta && Number(z.hasta) >= g.desde) })).filter(Boolean);
    // las pantallas (grabaciones de pantalla del Guion) se ven en el celular: también aquí, en Gráficos
    graficos = graficos.concat((m.pantallas || []).map((p) => enLista({ id: 'p' + p.pantalla, p, pantalla: true, b0: Number(p.t0), b1: Number(p.t1), mano: true })).filter(Boolean));
    if (ed) graficos = graficos.concat(ed.capas.map((c, n) => enLista({ id: 'c' + n, n, cap: c, capa: true, b0: Number(c.t0), b1: Number(c.t1), mano: true })).filter(Boolean));
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
      return enLista({ id: 'e' + Math.round(Number(x.t0) * 1000), x, b0: Number(x.t0), b1: Number(x.t1), zona, mano: !!zona });
    }).filter(Boolean);
    const Sx = window.CherrySonidos;
    const efectos = (Array.isArray(s.sonidos) ? s.sonidos : []).map((x) => {
      const so = Sx && Sx.porId(x.sonido), w = P[Math.round(Number(x.palabra))];
      if (!so || !w) return null;
      const ini = Math.max(0, aR(Number(w.start)) + (Number(x.mover) || 0) - (so.golpe || 0));
      return enLista({ id: x.id, x, so, b0: ini, b1: ini + so.dur, mano: !x.auto });
    }).filter(Boolean);
    return { m, D, aR, P, total, tomas, voz, filasTomas, lineasTomas, finPrincipal, finC, frases, graficos, escenas, efectos, subs, impacto, trans, rapida, modo, aBase, lista: L, ed };
  }
  const listaDe = (p) => !X ? [] : p === 'subtitulos' ? X.frases : p === 'voz' ? X.voz : X[p] || [];
  const buscar = (p, id) => listaDe(p).find((x) => x.id === id) || null;

  /* ══ Las LÍNEAS de cada pista (líneas infinitas) ══ (8-oct, Sergio: «arrastro un subtítulo hacia abajo o hacia arriba y no
     pasa nada: tiene que crear una línea nueva y ponerse ahí»). Lo que la persona movió va en su línea; lo demás, en la
     primera donde no se tape con nada. Las líneas vacías se cierran. Hoy nada se superpone en el video dentro de una misma
     pista (Cherry no pone dos gráficos ni dos escenas a la vez; los efectos se mezclan), así que la línea es el orden en que
     tú los quieres ver. Se guarda: los subtítulos en su frase (fila), lo demás en s.lineas[pista][clave]. */
  const CON_LINEAS = { subtitulos: true, graficos: true, escenas: true, efectos: true };
  function claveLinea(p, it) {
    if (p === 'efectos') return it.id;
    if (p === 'graficos') return it.capa ? null : it.pantalla ? 'p' + it.p.pantalla : 'g' + it.g.desde + '-' + it.g.tipo;
    if (p === 'escenas') return 'e' + it.x.clip_id;
    return null;
  }
  function lineaGuardada(p, it) {
    if (p === 'subtitulos') return it.f && Number.isInteger(it.f.fila) ? it.f.fila : null;
    const L = (C.state.lineas || {})[p] || {}, k = claveLinea(p, it);
    return k && Number.isInteger(L[k]) ? L[k] : null;
  }
  function acomodar(items, p) {
    const usado = [];
    const libre = (f, it) => !(usado[f] || []).some((r) => it.t0 < r[1] - 0.01 && it.t1 > r[0] + 0.01);
    const poner = (f, it) => { (usado[f] = usado[f] || []).push([it.t0, it.t1]); it.fila = f; };
    const pedidos = [], sueltos = [];
    items.forEach((it) => { const g = p ? lineaGuardada(p, it) : null; if (g != null) { it.pedida = g; pedidos.push(it); } else sueltos.push(it); });
    pedidos.sort((a, b) => a.pedida - b.pedida || a.t0 - b.t0).forEach((it) => { let f = Math.max(0, it.pedida); while (!libre(f, it)) f++; poner(f, it); });
    sueltos.sort((a, b) => a.t0 - b.t0).forEach((it) => { let f = 0; while (!libre(f, it)) f++; poner(f, it); });
    const llenas = [...new Set(items.map((x) => x.fila))].sort((a, b) => a - b);
    items.forEach((x) => { x.fila = llenas.indexOf(x.fila); });
    return Math.max(1, llenas.length);
  }
  /* El elemento pasa a otra línea ('arriba' / 'abajo' = una nueva): se guardan las líneas de toda la pista como se ven */
  function aplicarLinea(p, it, destino) {
    const items = listaDe(p), lineas = new Map(items.map((x) => [x, x.fila || 0]));
    if (destino === 'arriba') { items.forEach((x) => { if (x !== it) lineas.set(x, lineas.get(x) + 1); }); lineas.set(it, 0); }
    else if (destino === 'abajo') lineas.set(it, Math.max(0, ...lineas.values()) + 1);
    else lineas.set(it, Number(destino));
    const txt = typeof destino === 'number' ? 'Pasó a la línea ' + (destino + 1) : 'En una línea nueva';
    if (p === 'subtitulos') {
      const subs = subsActual();
      if (!subs) return;
      const porFrase = {};
      lineas.forEach((f, x) => { if (x.i >= 0 && porFrase[x.i] == null) porFrase[x.i] = f; });
      guardarHist('subs');
      editarSubs(Object.assign({}, subs, { frases: subs.frases.map((f, i) => (porFrase[i] != null ? Object.assign({}, f, { fila: porFrase[i] }) : f)) }));
    } else {
      const m = {};
      lineas.forEach((f, x) => { const k = claveLinea(p, x); if (k) m[k] = f; });
      guardarHist('estado');
      C.setState({ lineas: Object.assign({}, C.state.lineas || {}, { [p]: m }) });
    }
    aviso(txt);
  }
  /* en qué línea de la pista cae el puntero: un número, o 'arriba' / 'abajo' (= línea nueva) */
  function filaBajo(p, clientY, lejos) {
    const filas = [...R.lienzo.querySelectorAll('.mn-fila[data-grupo="' + p + '"]')];
    if (!filas.length) return null;
    const primera = filas[0].getBoundingClientRect(), ultima = filas[filas.length - 1].getBoundingClientRect();
    // (lejos: las tomas) todo lo de más arriba de la pista es una línea nueva encima
    if (clientY < primera.top + 5) return lejos || clientY > primera.top - 30 ? 'arriba' : null;
    if (clientY > ultima.bottom - 5) return lejos || clientY < ultima.bottom + 30 ? 'abajo' : null;
    for (const f of filas) { const r = f.getBoundingClientRect(); if (clientY >= r.top && clientY <= r.bottom) return Number(f.dataset.fila); }
    return null;
  }
  function marcarFila(p, destino) {
    R.lienzo.querySelectorAll('.mn-fila--destino').forEach((f) => f.classList.remove('mn-fila--destino'));
    const ln = R.lienzo.querySelector('.mn-linea-nueva');
    if (ln) ln.remove();
    if (destino == null || !p) return;
    if (typeof destino === 'number') {
      const f = R.lienzo.querySelector('.mn-fila[data-grupo="' + p + '"][data-fila="' + destino + '"]');
      if (f) f.classList.add('mn-fila--destino');
      return;
    }
    const filas = [...R.lienzo.querySelectorAll('.mn-fila[data-grupo="' + p + '"]')];
    if (!filas.length) return;
    const ref = destino === 'arriba' ? filas[0] : filas[filas.length - 1], li = R.lienzo.getBoundingClientRect(), rr = ref.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'mn-linea-nueva';
    d.style.left = (ETQ_W + 6) + 'px'; d.style.width = U.lw + 'px';
    d.style.top = ((destino === 'arriba' ? rr.top - 2 : rr.bottom + 1) - li.top) + 'px';
    R.lienzo.appendChild(d);
  }

  /* ══ Deshacer / rehacer: un historial propio (subtítulos aparte del resto) ══ */
  const HIST = [], FUT = [];
  function foto(tipo) {
    if (tipo === 'subs') return { tipo, v: subsActual(), fila: C.cortesVivo.idBase() };
    if (tipo === 'tomas') return { tipo, v: C.state.tomasMano || null };
    if (tipo === 'graficos') return { tipo, v: C.cortesVivo.graficosBase ? C.cortesVivo.graficosBase() : null, fila: C.cortesVivo.idBase() };
    return { tipo, v: { sonidos: C.state.sonidos || [], guionFijos: C.state.guionFijos || {}, lineas: C.state.lineas || {} }, espacio: C.state.indicesDe };
  }
  function guardarHist(tipo) { HIST.push(foto(tipo)); if (HIST.length > 80) HIST.shift(); FUT.length = 0; }
  function volver(de, a) {
    const f = de.pop(); if (!f) return;
    // (8-oct) con las tomas a mano cambia la base: lo de antes se pasa palabra por palabra o ya no se deshace
    if (f.tipo === 'subs' && f.fila !== C.cortesVivo.idBase()) { aviso('Eso ya no se puede deshacer: cambiaron las tomas'); return; }
    if (f.tipo === 'edicion') {
      const ed = f.v.fila, ahora = C.edicionVivo && C.edicionVivo.fila();
      a.push({ tipo: 'edicion', v: { fila: ahora || ed, capas: ahora ? ahora.capas : ed.capas, activa: !!ahora } });
      C.api.editarEdicion(ed.id, { capas: f.v.capas, activa: f.v.activa })
        .then(() => { C.edicionVivo.cambiar(f.v.activa ? Object.assign({}, ed, { capas: f.v.capas, activa: true }) : null); aviso(de === HIST ? 'Deshecho' : 'Rehecho'); C.setState({}); })
        .catch(() => aviso('No se pudo deshacer'));
      return;
    }
    if (f.tipo === 'graficos') {
      if (f.fila !== C.cortesVivo.idBase() || !f.v) { aviso('Eso ya no se puede deshacer: cambiaron las tomas'); return; }
      a.push(foto('graficos'));
      ponerGraf(f.v); guardarGraf(f.v, true);
      aviso(de === HIST ? 'Deshecho' : 'Rehecho');
      return;
    }
    if (f.tipo === 'pantallas') {
      a.push({ tipo: 'pantallas', v: (C.state.pantallas || []).slice() });
      C.setState({ pantallas: f.v });
      if (C.api && C.api.guardarPantallas) C.api.guardarPantallas(f.v.filter((x) => x && x.url)).catch(() => null);
      aviso(de === HIST ? 'Deshecho' : 'Rehecho');
      return;
    }
    let v = f.v;
    if (f.tipo === 'estado' && f.espacio && f.espacio !== C.state.indicesDe) {
      const pasado = C.cortesVivo.tomas && C.cortesVivo.tomas.pasarEstado(v, f.espacio);
      if (!pasado) { aviso('Eso ya no se puede deshacer: cambiaron las tomas'); return; }
      v = { sonidos: pasado.sonidos, guionFijos: pasado.guionFijos, lineas: v.lineas };
    }
    a.push(foto(f.tipo));
    if (f.tipo === 'subs') editarSubs(v);
    else if (f.tipo === 'tomas') C.setState({ tomasMano: v });
    else C.setState({ sonidos: v.sonidos, guionFijos: v.guionFijos, lineas: v.lineas || C.state.lineas || {} });
    aviso(de === HIST ? 'Deshecho' : 'Rehecho');
  }

  /* ══ Las TOMAS (parte 2) ══ Se recorta (estirando sus bordes), se parte, se duplica o se quita: la lista nueva va a
     cortesvivo (tomas.poner), que la muestra al instante saltando lo recortado y pide la base nueva en segundo plano. */
  const r3 = (x) => Math.round(x * 1000) / 1000;
  function tomasLista() { const TM = C.cortesVivo.tomas; return TM ? TM.lista() : null; }
  function cambiarTomas(fn, txt) {
    const L = tomasLista();
    if (!L) { aviso('Espera un momento: tu video se está preparando'); return; }
    const encima = (L.encima || []).map((e) => Object.assign({}, e));
    const nuevo = fn(L.cortes.map((c) => Object.assign({}, c)), encima);
    if (!nuevo) return;
    if (!nuevo.length) { aviso('Tiene que quedar al menos una toma en la línea principal'); return; }
    guardarHist('tomas');
    C.cortesVivo.tomas.poner({ de: L.de, auto: L.auto, cortes: nuevo, encima });
    if (txt) aviso(txt);
  }
  /* hasta dónde se puede estirar la toma n: lo que hay de su corte en la base de donde sale */
  /* (8-oct, Sergio) «un clip también se debe poder alargar… un poquito»: hasta ALARGAR segundos más allá de donde lo dejó
     el corte (sin salirse del clip). Un clip que se metió entero, de punta a punta del clip. */
  const ALARGAR = 3;
  function limites(c) {
    const TM = C.cortesVivo.tomas, F = TM && TM.fuente();
    if (!c || !TM) return null;
    if (!(c.k >= 0)) { const d = TM.clipDur(c.clipId); return [0, d || Number(c.b)]; }
    const cut = F && F.cuts[c.k];
    if (!cut) return null;
    const d = TM.clipDur(cut.clipId) || Infinity;
    // (8-oct) una toma partida por una de encima trae su clip en dos cortes: cuentan todos los del clip que toca
    let lo = Number(cut.startTime), hi = lo + Number(F.nominales[c.k]);
    F.cuts.forEach((x, i) => {
      if (String(x.clipId) !== String(cut.clipId)) return;
      const x0 = Number(x.startTime), x1 = x0 + Number(F.nominales[i]);
      if (x1 > Number(c.a) - 0.01 && x0 < Number(c.b) + 0.01) { lo = Math.min(lo, x0); hi = Math.max(hi, x1); }
    });
    return [Math.max(0, Math.min(lo - ALARGAR, Number(c.a))), Math.min(d, Math.max(hi + ALARGAR, Number(c.b)))];
  }
  /* Un clip de «Tus clips» entra como toma nueva donde está la línea blanca (lo que se dice en él, con un poco de aire) */
  function agregarClip(cl) {
    const TM = C.cortesVivo.tomas, tr = TM && TM.transcripciones();
    if (!tr) { aviso('Un momento: leyendo lo que dices en tus clips…'); return; }
    const ws = (tr[cl.id] || []).filter((w) => isFinite(Number(w.start)) && isFinite(Number(w.end)));
    const d = Number(cl.duration_sec) || 0;
    const a = ws.length ? Math.max(0, Number(ws[0].start) - 0.25) : 0;
    const b = ws.length ? Math.min(d || Infinity, Number(ws[ws.length - 1].end) + 0.35) : d;
    if (!(b - a >= 0.3)) { aviso('Ese clip está vacío'); return; }
    const t = C.cortesVivo.tiempo() || 0, it = tomaEn(t, true);
    cambiarTomas((cs) => {
      const i = it ? (t - it.t0 < (it.t1 - it.t0) / 2 ? it.i : it.i + 1) : cs.length;
      cs.splice(i, 0, { k: -1, clipId: cl.id, a: r3(a), b: r3(b) });
      return cs;
    }, '«' + (cl.file_name || 'Clip') + '» entra en ' + fmt(t));
  }
  function partirToma(it, t) {
    if (!(t > it.t0 + 0.3 && t < it.t1 - 0.3)) { aviso('Pon la línea blanca dentro de la toma, lejos de sus bordes'); return; }
    if (it.encima) { partirEncima(it, t); return; }
    cambiarTomas((cs) => {
      const c = cs[it.i]; if (!c) return null;
      const m = r3(c.a + (t - it.t0));
      cs.splice(it.i, 1, Object.assign({}, c, { b: m }), Object.assign({}, c, { a: m }));
      return cs;
    }, 'Toma partida en ' + fmt(t));
  }
  function duplicarToma(it) { cambiarTomas((cs) => (cs[it.i] ? (cs.splice(it.i + 1, 0, Object.assign({}, cs[it.i])), cs) : null), 'Toma duplicada'); }
  function quitarToma(it) {
    if (it.encima) { quitarEncima(it); return; }
    cambiarTomas((cs) => { if (!cs[it.i]) return null; if (cs.length <= 1) return []; cs.splice(it.i, 1); U.sel = null; return cs; }, 'Toma quitada');
  }
  function recortarToma(it, a, b) {
    if (it.encima) { recortarEncima(it, a, b); return; }
    cambiarTomas((cs) => (cs[it.i] ? (cs[it.i] = Object.assign({}, cs[it.i], { a: r3(a), b: r3(b) }), cs) : null), 'Toma recortada · ' + coma(b - a) + ' s');
  }
  /* la toma que se ve en ese segundo: la de encima más alta, si hay (principal = solo la línea principal) */
  function tomaEn(t, principal) {
    if (!X) return null;
    const arriba = principal ? [] : X.tomas.filter((x) => x.encima && t >= x.t0 && t < x.t1).sort((a, b) => b.linea - a.linea);
    return arriba[0] || X.tomas.find((x) => !x.encima && t >= x.t0 && t < x.t1) || null;
  }
  /* Cambiar de puesto en la línea principal: va antes de la primera toma cuyo centro queda después del suyo */
  function puestoEn(t0, dur, menos) {
    const centro = t0 + dur / 2;
    const sig = X.tomas.find((x) => !x.encima && x.i !== menos && (x.t0 + x.t1) / 2 > centro);
    return sig ? sig.i : null;
  }
  function moverToma(it, t0) {
    const antes = puestoEn(t0, it.t1 - it.t0, it.i);
    const n = antes == null ? X.lista.cortes.length - 1 : antes - (antes > it.i ? 1 : 0);
    if (n === it.i) return;
    cambiarTomas((cs) => {
      const c = cs.splice(it.i, 1)[0]; if (!c) return null;
      cs.splice(n, 0, c);
      U.sel = { pista: 'tomas', id: 't' + n };
      return cs;
    }, 'La toma ' + (it.i + 1) + ' pasó a ser la ' + (n + 1));
  }

  /* ══ (8-oct) Tomas ENCIMA ══ Sergio: «si un pedazo de un clip lo subo debe crearse otra línea con el mismo estilo de línea
     de tiempo de clips», y escogió «encima, con su sonido» (como en CapCut): sale encima del video en su momento con su voz
     y deja la línea principal, que se cierra; lo de abajo sigue sin verse ni oírse. La línea más alta tapa a las de abajo.
     Para el video es una lista de cortes más (js/recorte.js · aplanar): se ve al instante y sale igual en el video final. */
  function lineaLibre(t0, t1) {
    for (let ln = 1; ; ln++) if (!X.tomas.some((x) => x.encima && x.linea === ln && x.t0 < t1 - 0.01 && x.t1 > t0 + 0.01)) return ln;
  }
  function subirToma(it, ln, en) {
    cambiarTomas((cs, ens) => {
      const c = cs[it.i]; if (!c) return null;
      if (cs.length <= 1) { aviso('Tiene que quedar al menos una toma abajo, en la línea principal'); return null; }
      cs.splice(it.i, 1);
      const fin = cs.reduce((a, x) => a + Math.max(0, Number(x.b) - Number(x.a)), 0);
      ens.push(Object.assign({}, c, { en: r3(clamp(en, 0, fin)), fila: ln }));
      U.sel = { pista: 'tomas', id: 'o' + (ens.length - 1) };
      return cs;
    }, 'La toma ' + (it.i + 1) + ' quedó encima, con su sonido: lo de abajo no se ve ni se oye mientras dura');
  }
  function moverEncima(it, cambio, txt) {
    cambiarTomas((cs, ens) => { if (!ens[it.j]) return null; ens[it.j] = Object.assign({}, ens[it.j], cambio); return cs; }, txt);
  }
  function bajarEncima(it, t0) {
    const antes = puestoEn(t0, it.t1 - it.t0, -1);
    cambiarTomas((cs, ens) => {
      const e = ens[it.j]; if (!e) return null;
      ens.splice(it.j, 1);
      const c = Object.assign({}, e); delete c.en; delete c.fila;
      const n = antes == null ? cs.length : antes;
      cs.splice(n, 0, c);
      U.sel = { pista: 'tomas', id: 't' + n };
      return cs;
    }, 'La toma volvió a la línea principal');
  }
  function quitarEncima(it) {
    cambiarTomas((cs, ens) => { if (!ens[it.j]) return null; ens.splice(it.j, 1); U.sel = null; return cs; }, 'Toma de encima quitada: vuelve a verse lo de abajo');
  }
  function partirEncima(it, t) {
    cambiarTomas((cs, ens) => {
      const e = ens[it.j]; if (!e) return null;
      const m = r3(Number(e.a) + (t - it.t0));
      ens.splice(it.j, 1, Object.assign({}, e, { b: m, en: r3(it.c0) }), Object.assign({}, e, { a: m, en: r3(it.c0 + (m - Number(e.a))) }));
      return cs;
    }, 'Toma partida en ' + fmt(t));
  }
  function recortarEncima(it, a, b) {
    cambiarTomas((cs, ens) => {
      const e = ens[it.j]; if (!e) return null;
      ens[it.j] = Object.assign({}, e, { a: r3(a), b: r3(b), en: r3(Math.max(0, it.c0 + (a - Number(e.a)))) });
      return cs;
    }, 'Toma recortada · ' + coma(b - a) + ' s');
  }
  /* la línea de una fila de la pista de tomas (0 = la principal; 'arriba' = una nueva encima de todas) */
  function lineaDeFila(dest) {
    if (dest == null || dest === 'abajo') return null;
    const n = X.filasTomas - 1, ls = X.lineasTomas;
    if (dest === 'arriba') return (ls.length ? ls[ls.length - 1] : 0) + 1;
    if (dest === n) return 0;
    return ls[n - 1 - dest] != null ? ls[n - 1 - dest] : null;
  }
  /* arrastrar una toma: arriba o abajo cambia de línea; de lado, la de encima cambia de momento y la principal de puesto */
  function arrastrarToma(A, ev, dx, dy) {
    const it = A.it, T = X.total, d = it.t1 - it.t0;
    const dest = Math.abs(dy) > 12 ? filaBajo('tomas', ev.clientY, true) : null;
    let ln = lineaDeFila(dest);
    if (ln === it.linea) ln = null;
    A.linea = ln; A.abajo = dest === 'abajo';
    marcarFila('tomas', ln == null ? null : dest);
    let t0 = clamp(it.t0 + dx / U.lw * T, 0, Math.max(0, T - 0.1));
    // imán (8 px): los bordes de las tomas de la principal y la línea blanca
    const iman = 8 / U.lw * T;
    let mejor = null;
    const probar = (v) => { if (Math.abs(v - t0) < iman && (mejor == null || Math.abs(v - t0) < Math.abs(mejor - t0))) mejor = v; };
    X.tomas.filter((x) => !x.encima && x !== it).forEach((x) => { probar(x.t0); probar(x.t1); probar(x.t0 - d); probar(x.t1 - d); });
    const tc = C.cortesVivo.tiempo() || 0;
    probar(tc); probar(tc - d);
    if (mejor != null) t0 = Math.max(0, mejor);
    A.dt = t0 - it.t0;
    A.b.style.transform = 'translate(' + (A.dt / T * U.lw) + 'px,' + (Math.abs(dy) > 4 ? dy : 0) + 'px)';
    A.b.style.zIndex = '9';
    const queda = it.encima ? (ln == null ? it.linea : ln) : (ln == null || ln === 0 ? 0 : ln);   // la línea donde va a quedar
    if (queda === 0 && (Math.abs(A.dt) > 0.05 || (it.encima && ln === 0))) {
      const antes = puestoEn(t0, d, it.encima ? -1 : it.i), sig = antes == null ? null : X.tomas.find((x) => !x.encima && x.i === antes);
      const ult = X.tomas.filter((x) => !x.encima).pop();
      marcarDestino(sig ? sig.t0 : ult ? ult.t1 : t0, 'aquí');
    } else if (queda !== 0 && (Math.abs(A.dt) > 0.05 || ln != null)) marcarDestino(t0, 'encima · ' + fmt(t0));
    else marcarDestino(null);
  }
  function soltarToma(A) {
    const it = A.it, dt = A.dt || 0, ln = A.linea;
    if (A.abajo && ln == null && !it.encima) { aviso('Las tomas de encima van arriba de la línea principal: súbela'); return; }
    if (!it.encima) {
      if (ln != null && ln > 0) { subirToma(it, ln, it.c0 + dt); return; }
      if (Math.abs(dt) > 0.05) moverToma(it, it.t0 + dt);
      return;
    }
    if (ln === 0) { bajarEncima(it, it.t0 + dt); return; }
    const cambio = {};
    if (ln != null) cambio.fila = ln;
    if (Math.abs(dt) > 0.02) cambio.en = r3(clamp(it.c0 + dt, 0, X.finC));
    const txt = [cambio.fila != null ? 'Pasó a la línea ' + cambio.fila + ' de encima' : '', cambio.en != null ? 'sale en ' + fmt(it.t0 + dt) : ''].filter(Boolean).join(' · ');
    if (Object.keys(cambio).length) moverEncima(it, cambio, txt.charAt(0).toUpperCase() + txt.slice(1));
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
  function zonas(ops, txt, sinRellenar) {
    guardarHist('estado');
    let todo = Object.assign({}, C.state.guionFijos || {});
    ops.forEach((o) => opZona(todo, o[0], o[1], o[2], o[3]));
    if (sinRellenar) todo = sinRelleno(todo);
    C.setState({ guionFijos: todo });
    if (txt) aviso(txt);
  }
  /* (8-oct) Quitar UNO no debe traer otro. Cherry pone hasta un cupo de gráficos y escenas: al quitar uno, llenaba el cupo
     con el siguiente que tenía, en otra parte del video (Sergio: «cuando los borro no concuerdan»). Se prueba la cuenta
     (la misma de la vista previa y del ensamblador) y lo que aparecería de nuevo se veta ahí mismo. */
  const claveG = (p) => 'g' + p.desde + '-' + p.tipo;
  const claveE = (p) => String(p.clip_id) + '@' + Math.round(Number(p.t0) * 10);
  function sinRelleno(todo) {
    const m0 = C.cortesVivo.momentos();
    if (!m0 || !X) return todo;
    const antesG = new Set(m0.graficos.map(claveG)), antesE = new Set(m0.escenas.map(claveE));
    const guardado = C.state.guionFijos;
    try {
      for (let n = 0; n < 12; n++) {
        C.state.guionFijos = todo;
        const m = C.cortesVivo.momentos();
        const nG = m.graficos.filter((x) => !antesG.has(claveG(x))), nE = m.escenas.filter((x) => !antesE.has(claveE(x)));
        if (!nG.length && !nE.length) break;
        todo = Object.assign({}, todo);
        nG.forEach((x) => opZona(todo, 'graficos', null, 'no', { desde: x.desde, hasta: x.hasta }));
        nE.forEach((x) => opZona(todo, 'escenas', null, 'no', palabrasEntre(Number(x.t0), Number(x.t1), X.P, X.aR)));
      }
    } finally { C.state.guionFijos = guardado; }
    return todo;
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
    const a = anclar(X.aBase(clamp(tIni, 0, X.total - 0.1)) + (so.golpe || 0));
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
    const w = palabraCerca(X.aBase(clamp(t, 0, X.total)), X.P, X.aR);
    const nueva = { desde: w, hasta: hastaPorSeg(w, DUR_ESCENA, X.P, X.aR), segundos: DUR_ESCENA };
    U.tab = 'escogido'; U.sel = null; U.selEscena = w;
    ponerEscena({ nueva }, cat, null, cat ? 'Escena de «' + cat + '» en ' + fmt(t) : 'Cherry escoge la escena para ' + fmt(t));
  }
  /* La toma que se ve, para fijarla tal cual (al mover una escena de Cherry no cambia de toma) */
  function tomaDe(it) {
    const x = it.x;
    return { clip_id: x.clip_id, s3_key: x.s3_key, clip_dur: 0, rotar: x.rotar || 0, ini: Number(x.ss) || 0,
             fin: (Number(x.ss) || 0) + (it.b1 - it.b0), texto: x.texto || '', categoria: '' };
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
    const w = palabraCerca(X.aBase(t0), X.P, X.aR);
    U.selEscena = w;                                   // al moverla cambia su id (su segundo): sigue escogida
    if (it.zona) {
      const z = it.zona;
      zonas([['escenas', z, 'si', Object.assign({}, z, zonaDePieza(it, w, Number(z.segundos) || DUR_ESCENA))]], 'Escena movida');
      return;
    }
    // una de Cherry: queda fija donde la soltaste, con la misma toma, y donde estaba ya no va
    const viejas = palabrasEntre(it.b0, it.b1, X.P, X.aR);
    const z0 = zonaDePieza(it, w, it.b1 - it.b0);
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
    const n = zonaDePieza(it, palabraCerca(it.b0, X.P, X.aR), seg);
    zonas([['escenas', null, 'si', Object.assign(n, { tomas: tomasCerca(n.desde, n.hasta, tomaDe(it)) })]], txt);
  }
  function quitarEscena(it) {
    const z = it.zona;
    const zona = z ? { desde: z.desde, hasta: z.hasta } : palabrasEntre(it.b0, it.b1, X.P, X.aR);
    zonas([['escenas', z || null, 'no', zona]], 'Escena quitada', true);
  }
  function otraToma(it) {
    const z = it.zona;
    if (z) { zonas([['escenas', z, 'si', Object.assign({}, z, { saltar: (Number(z.saltar) || 0) + 1 })]], 'Otra toma'); return; }
    const w = palabraCerca(it.b0, X.P, X.aR);
    zonas([['escenas', null, 'si', Object.assign(zonaDePieza(it, w, it.b1 - it.b0), { saltar: 1 })]], 'Otra toma');
  }
  function categoriaEscena(it, cat) {
    const z = it.zona, w = z ? z.desde : palabraCerca(it.b0, X.P, X.aR);
    const nueva = z ? { desde: z.desde, hasta: z.hasta, segundos: Number(z.segundos) || DUR_ESCENA } : zonaDePieza(it, w, it.b1 - it.b0);
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
  function quitarGrafico(it) { zonas([['graficos', null, 'no', { desde: it.g.desde, hasta: it.g.hasta }]], 'Gráfico quitado', true); }

  /* ══ (8-oct) La EDICIÓN HECHA A MANO (tabla ediciones): sus capas van en Gráficos. Quitar una capa o la edición entera
     (con la edición no van los gráficos ni las escenas de Cherry; sin ella, vuelven). Se deshace. ══ */
  async function cambiarEdicion(campos, txt, hist) {
    const ed = C.edicionVivo && C.edicionVivo.fila();
    if (!ed || !C.api || !C.api.editarEdicion) return;
    const antes = { capas: ed.capas, activa: ed.activa !== false };
    try {
      await C.api.editarEdicion(ed.id, campos);
      C.edicionVivo.cambiar(campos.activa === false ? null : Object.assign({}, ed, campos));
      if (hist !== false) { HIST.push({ tipo: 'edicion', v: Object.assign({ fila: ed }, antes) }); FUT.length = 0; }
      U.sel = null; aviso(txt); C.setState({});
    } catch (e) { console.warn('[Manual] la edición no cambió', e); aviso('No se pudo. Inténtalo otra vez.'); }
  }
  function quitarCapa(it) {
    const ed = C.edicionVivo && C.edicionVivo.fila();
    if (!ed) return;
    const capas = (ed.capas || []).filter((c) => !(c.key === it.cap.key && Number(c.t0) === Number(it.cap.t0)));
    cambiarEdicion({ capas }, 'Capa quitada');
  }
  function quitarPantalla(it) {
    if (!C.pantallas || !C.pantallas.quitar) return;
    HIST.push({ tipo: 'pantallas', v: (C.state.pantallas || []).slice() }); FUT.length = 0;
    U.sel = null; C.pantallas.quitar(it.p.pantalla); aviso('Pantalla quitada');
  }
  /* ══ (8-oct) EDITAR un gráfico de Cherry: sus textos y cifras, y MOVERLO en el celular ══ Sergio: «ese gráfico tiene un
     dato… si en lugar de 1000 quiero colocar 2000 debería poder cambiarlo manteniendo el mismo gráfico» y «debería yo
     poder arrastrarlo hacia donde quiera en la pantalla». Lo cambiado va en su momento (renders.graficos de la base que
     se ve, `editado`, `pos`): el celular lo dibuja al instante y el video final lo toma de ahí (orchestrate copia los
     gráficos de la base al fabricar; graficos.js › corrimiento corre su capa en el ensamblador). La animación no se toca,
     y un dato que dejaría el gráfico mal (una cifra vacía, una lista de un punto) no se aplica: la MISMA limpieza del
     ensamblador (graficos.js › limpiarDatos). */
  function momentoDe(g) {
    const gr = C.cortesVivo.graficosBase && C.cortesVivo.graficosBase();
    const ms = gr && Array.isArray(gr.momentos) ? gr.momentos : [];
    const PE = (window.CherryGraf && window.CherryGraf.PALABRA_PE) || [];
    const i = g ? ms.findIndex((m) => Number(m.desde) === Number(g.desde) && (m.tipo === g.tipo || (g.variante && PE.indexOf(m.tipo) >= 0))) : -1;
    return i >= 0 ? { gr, i, m: ms[i] } : null;
  }
  function ponerGraf(gr) {
    C.cortesVivo.ponerGraficos(gr);
    if (C.grafVivo && C.grafVivo.refrescar) C.grafVivo.refrescar(gr);
    firmaL = '';
  }
  let guardaG = 0, grPendiente = null;
  function guardarGraf(gr, ya) {
    const id = C.cortesVivo.idBase();
    if (!id || !C.api || !C.api.guardarGraficos) return;
    grPendiente = { id, gr };
    clearTimeout(guardaG);
    const ir = () => {
      const p = grPendiente; grPendiente = null;
      if (p) C.api.guardarGraficos(p.id, p.gr).catch((e) => { console.warn('[Manual] el gráfico no se guardó', e); aviso('No se pudo guardar el cambio del gráfico. Revisa tu conexión e inténtalo otra vez.'); });
    };
    if (ya) ir(); else guardaG = setTimeout(ir, 600);
  }
  window.addEventListener('pagehide', () => { if (grPendiente) { clearTimeout(guardaG); const p = grPendiente; grPendiente = null; C.api.guardarGraficos(p.id, p.gr).catch(() => null); } });
  /* cambia el momento con fn(m, datosQueSeDibujan); false si no se pudo (o si quedaría mal) */
  function cambiarMomento(g, fn, op) {
    const x = momentoDe(g), G = window.CherryGraf;
    if (!x || !G || !G.limpiarDatos) return false;
    const nPal = X && X.P ? X.P.length : 1e6;
    const m = JSON.parse(JSON.stringify(x.m));
    const limpio = G.limpiarDatos(m, nPal);
    if (!limpio) return false;
    fn(m, limpio.datos);
    if (!G.limpiarDatos(m, nPal)) return false;
    m.editado = true;
    const momentos = x.gr.momentos.slice(); momentos[x.i] = m;
    const gr = Object.assign({}, x.gr, { momentos });
    ponerGraf(gr);
    if (!(op && op.sinGuardar)) guardarGraf(gr);
    return true;
  }
  /* «1.000», «2.500,5», «2,5», «1500» → número (como se escribe en Colombia) */
  function leerNumero(s) {
    let t = String(s == null ? '' : s).trim().replace(/\s/g, '');
    if (!t) return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d+(,\d+)?$/.test(t)) t = t.replace(',', '.');
    else if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    const n = Number(t);
    return isFinite(n) ? n : null;
  }
  const verNumero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const decimalesDe = (s) => { const m = /[,.](\d{1,2})$/.exec(String(s || '').trim()); return m && !/^\d{1,3}(\.\d{3})+$/.test(String(s).trim()) ? m[1].length : 0; };
  // los nombres de cada dato, como los lee la persona (lo que no se nombra aquí sale con su nombre tal cual)
  const ETQ_G = { valor: 'Cifra', prefijo: 'Antes de la cifra', sufijo: 'Después de la cifra', etiqueta: 'Etiqueta', titulo: 'Título',
    texto: 'Texto', autor: 'Quién lo dijo', meta: 'Meta', pie: 'Nota de abajo', pieMeta: 'Nota de la meta', desde: 'Desde', hasta: 'Hasta',
    veces: 'Veces', total: 'Total', llenas: 'Llenas', mito: 'Lo que creen', realidad: 'Lo que es', grande: 'Palabra grande',
    chica: 'Texto pequeño', unidad: 'Qué es', arriba: 'Arriba', abajo: 'Abajo', medio: 'En medio', chip: 'Etiqueta pequeña',
    insignia: 'Insignia', hora: 'Hora', sello: 'Sello', a: 'Primero', b: 'Segundo', items: 'Punto', pasos: 'Paso',
    claves: 'Clave', hitos: 'Fecha', filas: 'Fila', fecha: 'Fecha', sub: 'Debajo', nota: 'Nota', creencia: 'Lo que creen' };
  const OCULTO_G = { decimales: 1, fondo: 1, ganador: 1, insignia: 1 };   // (la insignia «×1,8» y quién gana se calculan solos)
  /* los campos de lo que se dibuja: [{ ruta, v, num, etq }] (las listas de pares —nombre y cifra— salen por fila) */
  function camposDe(v, ruta, etq, out) {
    if (v == null || typeof v === 'boolean') return out;
    if (typeof v === 'number' || typeof v === 'string') { out.push({ ruta, v, num: typeof v === 'number', etq: etq || 'Dato' }); return out; }
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        if (Array.isArray(x)) x.forEach((y, k) => camposDe(y, ruta.concat([i, k]), typeof y === 'number' ? 'Cifra ' + (i + 1) : etq + ' ' + (i + 1), out));
        else if (x && typeof x === 'object') Object.keys(x).forEach((k) => { if (!OCULTO_G[k]) camposDe(x[k], ruta.concat([i, k]), (ETQ_G[k] || k) + ' ' + (i + 1), out); });
        else camposDe(x, ruta.concat([i]), etq + ' ' + (i + 1), out);
      });
      return out;
    }
    if (typeof v === 'object') Object.keys(v).forEach((k) => { if (!OCULTO_G[k]) camposDe(v[k], ruta.concat([k]), (etq ? etq + ' · ' : '') + (ETQ_G[k] || k), out); });
    return out;
  }
  function ponerEn(obj, ruta, valor) { let o = obj; for (let i = 0; i < ruta.length - 1; i++) o = o[ruta[i]]; o[ruta[ruta.length - 1]] = valor; }
  function editarDato(g, campo, texto, input) {
    let valor = texto;
    if (campo.num) { valor = leerNumero(texto); if (valor == null) { input.classList.add('mn-entrada--mal'); return; } }
    const ok = cambiarMomento(g, (m, dibujo) => {
      const d = JSON.parse(JSON.stringify(dibujo));
      ponerEn(d, campo.ruta, valor);
      if (campo.num && 'decimales' in d) d.decimales = Math.max(Number(d.decimales) || 0, Math.min(2, decimalesDe(texto)));
      // lo que el gráfico calcula de los demás datos (la insignia «×5», quién gana la balanza) se vuelve a calcular
      if (!(m.datos && m.datos.insignia)) delete d.insignia;
      if (!(m.datos && m.datos.ganador)) delete d.ganador;
      m.datos = d;
    });
    input.classList.toggle('mn-entrada--mal', !ok);
    input.title = ok ? '' : 'Así el gráfico no se puede dibujar (falta un dato o no es una cifra)';
  }
  function camposGrafico(it) {
    const G = window.CherryGraf, x = momentoDe(it.g);
    if (!G || !x || !X) return null;
    const limpio = G.limpiarDatos(JSON.parse(JSON.stringify(x.m)), X.P.length);
    if (!limpio) return null;
    const campos = camposDe(limpio.datos, [], '', []);
    const movible = !!(G.MOVIBLE && G.MOVIBLE[it.g.forma]);
    const pos = G.limpiarPos ? G.limpiarPos(x.m.pos) : null;
    const tamano = Math.round(((pos && pos.s) || 1) * 100);
    const ponerTam = (pc, guardar) => cambiarMomento(it.g, (m) => {
      const p = G.limpiarPos(Object.assign({ x: 0, y: 0 }, G.limpiarPos(m.pos) || {}, { s: pc / 100 }));
      if (p) m.pos = p; else delete m.pos;
    }, { sinGuardar: !guardar });
    const cajas = campos.map((c, k) => h('label', { class: 'mn-gd' }, h('span', null, c.etq),
      h('input', { class: 'mn-entrada' + (c.num ? ' mn-entrada--cifra' : ''), value: c.num ? verNumero(c.v) : c.v, inputmode: c.num ? 'decimal' : null,
        spellcheck: c.num ? 'false' : 'true', 'data-campo': String(k),
        onFocus: () => { U.escribiendo = true; if (!U.histG) { U.histG = true; guardarHist('graficos'); } },
        onBlur: () => { U.escribiendo = false; U.histG = false; if (grPendiente) guardarGraf(grPendiente.gr, true);
          if (U.sucio) { U.sucio = false; setTimeout(() => { firmaP = ''; pintarPanel(); }, 0); } },
        onInput: (e) => editarDato(it.g, c, e.target.value, e.target),
        onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } })));
    return h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Lo que dice el gráfico'),
      cajas.length ? h('div', { class: 'mn-gds' }, cajas) : h('p', { class: 'mn-dato' }, 'Este gráfico no tiene textos ni cifras para cambiar.'),
      movible ? h('label', { class: 'mn-gd mn-gd--tam' }, h('span', null, 'Tamaño · ' + tamano + ' %'),
        h('input', { type: 'range', min: '40', max: '200', step: '5', value: String(tamano), class: 'mn-rango',
          onPointerdown: () => guardarHist('graficos'),
          onInput: (e) => { ponerTam(Number(e.target.value), false); e.target.previousSibling.textContent = 'Tamaño · ' + e.target.value + ' %'; },
          onChange: (e) => { ponerTam(Number(e.target.value), true); firmaP = ''; } })) : null,
      h('div', { class: 'mn-fila-acc' },
        h('span', { class: 'mn-dato' }, movible ? '✥ Para cambiarlo de lugar, arrástralo en el celular; para agrandarlo o achicarlo, la esquina del marco.' : 'Este gráfico ocupa toda la pantalla: no se mueve ni cambia de tamaño.'),
        pos ? boton('↺ A su lugar y tamaño', () => { guardarHist('graficos'); cambiarMomento(it.g, (m) => { delete m.pos; }); aviso('El gráfico volvió a su lugar y tamaño'); }, 'mn-acc--chico') : null));
  }

  /* El gráfico escogido se ARRASTRA en el celular (como en CapCut): un marco sobre su caja mientras se ve. Un toque sin
     arrastrar reproduce o pausa, como el celular. */
  const MV = { el: null, arr: null, it: null, q: null };
  function cuadroCel(v, caja) {
    const We = caja.clientWidth, He = caja.clientHeight, vw = v.videoWidth || 1080, vh = v.videoHeight || 1920, k = Math.max(We / vw, He / vh);
    return { W: vw * k, H: vh * k, x: (We - vw * k) / 2, y: (He - vh * k) / 2 };
  }
  function crearMover() {
    const el = document.createElement('div');
    el.className = 'mn-mover'; el.hidden = true;
    el.innerHTML = '<span>✥ Arrástralo</span><i class="mn-mover-tam" title="Arrastra para agrandarlo o achicarlo"></i>';
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button > 0 || !MV.it) return;
      ev.preventDefault(); ev.stopPropagation();
      const G = window.CherryGraf, p0 = Object.assign({ x: 0, y: 0, s: 1 }, (G.limpiarPos && G.limpiarPos(MV.it.g.pos)) || {});
      // (8-oct) el asa de la esquina cambia el TAMAÑO (desde el centro); lo demás lo mueve
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const tam = !!(ev.target && ev.target.classList && ev.target.classList.contains('mn-mover-tam'));
      MV.arr = { x0: ev.clientX, y0: ev.clientY, pos0: p0, pos: p0, g: MV.it.g, q: MV.q, movido: false, tam, cx, cy,
                 r0: Math.max(10, Math.hypot(ev.clientX - cx, ev.clientY - cy)) };
      try { el.setPointerCapture(ev.pointerId); } catch (_) { /* sin captura */ }
    });
    el.addEventListener('pointermove', (ev) => {
      const A = MV.arr;
      if (!A || !A.q) return;
      const dx = ev.clientX - A.x0, dy = ev.clientY - A.y0;
      if (!A.movido && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!A.movido) { A.movido = true; guardarHist('graficos'); el.classList.add('mn-mover--arr'); }
      let x = A.pos0.x, y = A.pos0.y, s = A.pos0.s;
      if (A.tam) {
        s = A.pos0.s * Math.hypot(ev.clientX - A.cx, ev.clientY - A.cy) / A.r0;
        if (Math.abs(s - 1) < 0.04) s = 1;       // imán: su tamaño de siempre
      } else {
        x = A.pos0.x + dx / A.q.W; y = A.pos0.y + dy / A.q.H;
        if (Math.abs(x) < 0.015) x = 0;          // imán: centrado
        if (Math.abs(y) < 0.015) y = 0;          // imán: su altura de siempre
      }
      const G = window.CherryGraf;
      A.pos = Object.assign({ x: 0, y: 0, s: 1 }, G.limpiarPos({ x, y, s }) || {});
      cambiarMomento(A.g, (m) => { const p = G.limpiarPos(A.pos); if (p) m.pos = p; else delete m.pos; }, { sinGuardar: true });
      pintarMover();
    });
    const soltar = () => {
      const A = MV.arr; MV.arr = null;
      el.classList.remove('mn-mover--arr');
      if (!A) return;
      if (!A.movido) { C.actions.togglePlay(); return; }
      const gr = C.cortesVivo.graficosBase && C.cortesVivo.graficosBase();
      if (gr) guardarGraf(gr, true);
      firmaP = '';
      aviso(A.tam ? 'Tamaño: ' + Math.round(A.pos.s * 100) + ' %' : (A.pos.x || A.pos.y ? 'Gráfico movido' : 'El gráfico quedó en su lugar de siempre'));
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    // (8-oct, Sergio: «con el video pausado, al arrastrar el gráfico se vuelve a reproducir») el clic que sigue al soltar
    // llegaba al celular (.cv › alternar): se queda aquí; el toque sin arrastrar ya lo resuelve soltar()
    el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });
    return el;
  }
  function pintarMover() {
    const G = window.CherryGraf;
    const it = U.sel && U.sel.pista === 'graficos' && X ? buscar('graficos', U.sel.id) : null;
    const v = C.videoFijo && C.videoFijo.get('base-previa'), caja = v && v.isConnected ? v.parentNode : null;
    const t = C.cortesVivo.tiempo() || 0;
    const ok = !!(it && it.g && !it.capa && !it.pantalla && G && G.MOVIBLE && G.MOVIBLE[it.g.forma] && caja &&
      t >= it.t0 - 0.05 && t < it.t1 && modoActual() === 'manual' && C.state.grafOn !== false);
    if (!ok && !MV.arr) { if (MV.el && !MV.el.hidden) MV.el.hidden = true; return; }
    if (!caja) return;
    if (!MV.el) MV.el = crearMover();
    if (MV.el.parentNode !== caja) caja.appendChild(MV.el);
    if (it) MV.it = it;
    const g = MV.arr ? MV.arr.g : MV.it.g;
    const q = cuadroCel(v, caja); MV.q = q;
    const premium = (C.grafCfg ? C.grafCfg().estilo : '') === 'premium';
    const B = (premium ? G.cajaPremium : G.caja)(g, q.W, q.H);
    const pos = MV.arr ? MV.arr.pos : (G.limpiarPos(g.pos) || null);
    const L = G.colocar(Object.assign({}, g, { pos }), B, q.W, q.H);
    Object.assign(MV.el.style, { left: (q.x + L.x).toFixed(1) + 'px', top: (q.y + L.y).toFixed(1) + 'px',
      width: L.w.toFixed(1) + 'px', height: L.h.toFixed(1) + 'px' });
    if (MV.el.hidden) MV.el.hidden = false;
  }

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
    else if (sel.pista === 'graficos') { if (it.capa) quitarCapa(it); else if (it.pantalla) quitarPantalla(it); else { U.sel = null; quitarGrafico(it); } }
    else if (sel.pista === 'subtitulos') ponerEstilo(it, 'ninguno', X.impacto);
    else if (sel.pista === 'tomas' || sel.pista === 'voz') quitarToma(it);
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
    ORDEN.forEach((p) => { filas[p] = p === 'tomas' ? X.filasTomas || 1 : p === 'voz' ? 1 : acomodar(listaDe(p), p); });
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
        if ((it.fila || 0) !== f) return;
        if (p === 'subtitulos') o += bloque(p, it, esc(it.texto), (it.off ? 'mn-off' : '') + (it.imp ? ' mn-imp' : ''));
        else if (p === 'graficos' && it.capa) o += bloque(p, it, '✎ Edición a mano', 'mn-capa');
        else if (p === 'graficos' && it.pantalla) o += bloque(p, it, '▭ ' + esc(it.p.titulo || 'Pantalla'), 'mn-pant');
        else if (p === 'graficos') {
          const G = window.CherryGraf, n = (G && G.NOMBRES && G.NOMBRES[it.g.tipo]) || it.g.tipo;
          o += bloque(p, it, U.regen && (U.regen.id === it.id || U.regen.id === '*') ? '✦ buscando otro…' : esc(n), U.regen && U.regen.id === it.id ? 'mn-gen' : '');
        } else if (p === 'escenas') o += bloque(p, it, esc(it.x.texto || it.x.busqueda || 'Escena'));
        else if (p === 'efectos') o += bloque(p, it, esc(it.so.nombre));
        else if (p === 'tomas') {
          // lo tapado por una toma de encima, oscuro (no se ve ni se oye)
          const w = Math.max(0.01, it.t1 - it.t0);
          const tapa = (it.tapado || []).map((r) => '<i class="mn-tapa" style="left:' + ((r[0] - it.t0) / w * 100) + '%;width:' + ((r[1] - r[0]) / w * 100) + '%"></i>').join('');
          o += bloque(p, it, tapa + '<b>' + (it.encima ? 'encima' : it.i + 1) + '</b>', it.encima ? 'mn-encima' : '', it.clip && it.clip.thumbnail_url ? 'background-image:url(' + esc(it.clip.thumbnail_url) + ')' : '');
        }
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
        const nE = (X.filasTomas || 1) - 1;   // en Tomas, las líneas de encima van arriba de la principal
        const nombre = p === 'tomas' ? (f === nE ? NOMBRE[p] : 'encima' + (nE > 1 ? ' ' + (nE - f) : '')) : f === 0 ? NOMBRE[p] : 'línea ' + (f + 1);
        const etq = '<i style="background:' + COLOR[p] + '"></i><span>' + nombre + '</span>';
        const extra = p === 'tomas' ? f !== nE : f !== 0;
        o += '<div class="mn-fila' + (f === 0 ? ' mn-fila--ini' : '') + (extra ? ' mn-fila--extra' : '') + '" data-grupo="' + p + '" data-fila="' + f + '"><div class="mn-etq">' + etq + '</div>' +
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
    X.voz.forEach((s) => {
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
    // (8-oct) con transform y en su propia capa: moverla no vuelve a pintar toda la línea de tiempo en cada cuadro
    if (c) { const x = px(t), tr = 'translateX(' + x.toFixed(1) + 'px)', vis = x < R.tl.scrollLeft + ETQ_W ? 'hidden' : 'visible';
      if (c.style.transform !== tr) c.style.transform = tr; if (c.style.visibility !== vis) c.style.visibility = vis; }
    const txt = fmt(t);
    if (forzar || R.reloj._t !== txt) { R.reloj._t = txt; R.reloj.firstChild.textContent = txt + ' '; R.reloj.lastChild.textContent = '/ ' + fmt(X.total); }
    if (R.play._son !== son) { R.play._son = son; R.play.innerHTML = son ? '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="#fff"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="#fff"/></svg>'; }
    if (c && U.zoom > 1 && son && !U.arr) { const xx = px(t); if (xx < R.tl.scrollLeft + ETQ_W + 20 || xx > R.tl.scrollLeft + R.tl.clientWidth - 40) R.tl.scrollLeft = xx - ETQ_W - 60; }
  }
  function bucle() {
    U.raf = 0;
    if (!R || !R.raiz.isConnected) { if (MV.el) MV.el.hidden = true; return; }
    pintarTiempo();
    pintarMover();
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
      const t = teDeX(ev.clientX), s = X.voz.find((x) => t >= x.t0 && t < x.t1);
      if (s) escoger('voz', s.id, true);
      C.cortesVivo.irA(t);
      return;
    }
    const b = ev.target.closest('.mn-bl');
    if (!b) { if (ev.target.closest('.mn-carril')) { C.cortesVivo.irA(teDeX(ev.clientX)); escoger(null); } return; }
    const p = b.dataset.pista, id = b.dataset.id, it = buscar(p, id);
    if (!it) return;
    const r = b.getBoundingClientRect(), x = ev.clientX - r.left;
    if (p === 'tomas' && C.cortesVivo.tomas) C.cortesVivo.tomas.transcripciones();   // para alargar: lo que se dice fuera del corte
    let modo = 'nada';
    if (p === 'tomas') modo = r.width > 24 && x < 8 ? 'izq' : r.width > 24 && x > r.width - 8 ? 'der' : it.c ? 'mover' : 'nada';
    if (p === 'efectos') modo = 'mover';
    if (p === 'escenas') modo = x > r.width - 8 && r.width > 18 ? 'der' : 'mover';
    if (p === 'subtitulos' || (p === 'graficos' && !it.capa)) modo = 'linea';
    U.arr = { modo, pista: p, id, it, x0: ev.clientX, y0: ev.clientY, movido: false, b, izq: b.style.left, ancho: b.style.width, destino: null };
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
      if (b) {
        const r = b.getBoundingClientRect(), p = b.dataset.pista, x = ev.clientX - r.left;
        b.style.cursor = (p === 'escenas' && x > r.width - 8) || (p === 'tomas' && r.width > 24 && (x < 8 || x > r.width - 8)) ? 'ew-resize'
          : (p === 'efectos' || p === 'escenas' || p === 'tomas' ? 'grab' : 'pointer');
      }
      return;
    }
    if (A.modo === 'cabezal') { C.cortesVivo.irA(teDeX(ev.clientX)); return; }
    if (A.modo === 'nada' || !A.b) return;
    const dx = ev.clientX - A.x0, dy = ev.clientY - A.y0;
    if (!A.movido && Math.abs(dx) < 3 && Math.abs(dy) < 6) return;
    A.movido = true;
    const dt = dx / U.lw * X.total, it = A.it, T = X.total;
    if (A.pista === 'tomas' && A.modo === 'mover') { arrastrarToma(A, ev, dx, dy); return; }
    // a otra línea (o una nueva): arriba o abajo
    if (CON_LINEAS[A.pista] && (A.modo === 'mover' || A.modo === 'linea')) {
      let dest = Math.abs(dy) > 8 ? filaBajo(A.pista, ev.clientY) : null;
      if (dest === (it.fila || 0)) dest = null;
      A.destino = dest;
      marcarFila(A.pista, dest);
      A.b.style.transform = Math.abs(dy) > 4 ? 'translateY(' + dy + 'px)' : '';
      A.b.style.zIndex = '9';
      if (A.modo === 'linea') return;
    }
    if (A.pista === 'tomas') {
      const c = it.c || (X.lista && X.lista.cortes[it.i]), lim = A.lim || (A.lim = limites(c));
      if (!lim || !c) return;
      if (A.modo === 'izq') {
        A.na = clamp(c.a + dt, it.encima ? Math.max(lim[0], c.a - it.c0) : lim[0], c.b - 0.3);
        const d = A.na - c.a;
        A.b.style.left = ((it.t0 + d) / T * 100) + '%';
        A.b.style.width = 'calc(' + ((it.t1 - it.t0 - d) / T * 100) + '% - 1px)';
        marcarDestino(it.t0 + d, coma(c.b - A.na) + ' s');
      } else {
        A.nb = clamp(c.b + dt, c.a + 0.3, lim[1]);
        const d = A.nb - c.b;
        A.b.style.width = 'calc(' + ((it.t1 - it.t0 + d) / T * 100) + '% - 1px)';
        marcarDestino(it.t1 + d, coma(A.nb - c.a) + ' s');
      }
      return;
    }
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
    marcarFila(null);
    if (!A || !A.movido) return;
    if (A.b) { A.b.style.transform = ''; A.b.style.zIndex = ''; }
    if (A.pista === 'tomas' && A.modo === 'mover') { soltarToma(A); return; }
    // (8-oct) a otra línea: sin moverlo de lado (o además de moverlo, en efectos y escenas)
    const destino = A.destino;
    const masTarde = destino != null && CON_LINEAS[A.pista] ? () => aplicarLinea(A.pista, A.it, destino) : null;
    if (A.modo === 'linea') { if (masTarde) masTarde(); return; }
    if (masTarde) setTimeout(masTarde, 0);
    if (A.pista === 'tomas' && (A.na != null || A.nb != null)) {
      const c = A.it.c || (X.lista && X.lista.cortes[A.it.i]);
      if (c) recortarToma(A.it, A.na != null ? A.na : c.a, A.nb != null ? A.nb : c.b);
      return;
    }
    if (A.pista === 'efectos' && A.t0 != null) {
      const a = anclar(X.aBase(A.t0) + (A.it.so.golpe || 0));
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

  function panelCapa(it) {
    const ed = C.edicionVivo && C.edicionVivo.fila();
    const forma = { capa: 'Encima de tu video', dividida: 'Tu video se encoge a su tarjeta', profundo: 'Detrás de ti' }[it.cap.forma] || 'Encima de tu video';
    return vistaSel(
      h('div', { class: 'mn-graf-vis mn-graf-vis--ed' }, h('b', null, 'Edición a mano'), h('span', null, forma)),
      [
        titulo('graficos', 'Capa ' + (it.n + 1) + ' de la edición a mano', [tiempoDe(it), coma(it.t1 - it.t0) + ' s'], true),
        h('p', { class: 'mn-dato mn-ancho' }, 'Es de «' + ((ed && ed.nombre) || 'la edición a mano') + '» y va en el video tal cual. ',
          'Mientras esté, Cherry no pone sus gráficos ni sus escenas. Si cambias las tomas, la edición se quita (sus capas ya no calzan).'),
        h('div', { class: 'mn-fila-acc mn-ancho' },
          boton('Quitar esta capa', () => quitarCapa(it), 'mn-acc--peligro'),
          boton('Quitar toda la edición a mano', () => cambiarEdicion({ activa: false }, 'Se quitó la edición a mano: vuelven los gráficos y escenas de Cherry'),
            '', { title: 'Vuelven los gráficos y las escenas de Cherry. Se deshace con Ctrl+Z.' })),
      ]);
  }
  function panelPantalla(it) {
    const p = it.p;
    return vistaSel(
      h('div', { class: 'mn-graf-vis mn-graf-vis--pant' }, h('b', null, 'Pantalla'), h('span', null, p.tipo === 'navegador' ? 'Tu grabación en el navegador' : 'Tu grabación de pantalla')),
      [
        titulo('graficos', p.titulo || 'Pantalla', [tiempoDe(it), coma(it.t1 - it.t0) + ' s'], true),
        h('p', { class: 'mn-dato mn-ancho' }, 'La pusiste en el Guion; va donde la pusiste y manda sobre los gráficos de Cherry.'),
        h('div', { class: 'mn-fila-acc mn-ancho' }, boton('Quitar la pantalla', () => quitarPantalla(it), 'mn-acc--peligro')),
      ]);
  }
  function panelFrase(it) {
    if (it.nueva) {
      return vistaSel(h('div', { class: 'mn-subprev mn-subprev--off' }, it.texto), [
        titulo('subtitulos', it.texto, [tiempoDe(it)]),
        h('p', { class: 'mn-dato mn-ancho' }, 'Es de lo que alargaste o del clip que metiste: se corrige y se le cambia el estilo en cuanto quede listo tu corte (unos segundos).'),
      ]);
    }
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
        camposGrafico(it),
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

  /* cómo van los cortes hechos a mano (la vista previa ya los muestra; la base fina llega en un momento) */
  function estadoCortes() {
    const TM = C.cortesVivo.tomas, e = TM && TM.estado();
    if (!e || e.estado === 'lista') return null;
    if (e.estado === 'error') return h('div', { class: 'mn-cortes mn-cortes--mal mn-ancho' }, 'No se pudieron aplicar tus cortes. ',
      boton('Reintentar', () => { if (TM.reintentar) TM.reintentar(); aviso('Otra vez…'); }, 'mn-acc--chico'));
    return h('div', { class: 'mn-cortes mn-ancho' }, h('span', { class: 'spinner' }), ' Aplicando tus cortes',
      e.eta ? [' · ', h('span', { 'data-eta': e.eta.id }, e.eta.texto())] : '…',
      h('small', null, 'Ya lo ves así en el celular; en un momento queda listo para fabricar.'));
  }
  function panelToma(it, voz) {
    const cl = it.clip, s = C.state, TM = C.cortesVivo.tomas;
    const foto = cl && cl.thumbnail_url ? h('img', { class: 'mn-toma-foto', src: cl.thumbnail_url, alt: '' }) : h('div', { class: 'mn-toma-foto' });
    const ctl = [
      titulo(voz ? 'voz' : 'tomas', it.encima ? (voz ? 'Voz de la toma de encima' : 'Toma encima') : (voz ? 'Voz de la toma ' : 'Toma ') + (it.i + 1),
        [tiempoDe(it), coma(it.t1 - it.t0) + ' s', cl ? cl.file_name : ''].filter(Boolean), it.mano),
      estadoCortes(),
      X.ed ? h('p', { class: 'mn-dato mn-ancho mn-ojo' }, '⚠ Tu edición a mano va con estas tomas: si recortas, partes, duplicas o quitas una, se quita (sus capas ya no calzan) y vuelven los gráficos y escenas de Cherry.') : null,
      it.texto ? h('div', { class: 'mn-cita mn-ancho' }, '«' + it.texto + '»') : null,
    ];
    if (voz && C.controlVoz) ctl.push(h('div', { class: 'mn-ancho mn-voz' }, C.controlVoz(s)));
    if (!voz) {
      ctl.push(h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Esta toma'),
        h('div', { class: 'mn-fila-acc' },
          boton('✂ Partir en la línea blanca', () => partirToma(it, C.cortesVivo.tiempo() || 0), '', { title: 'Atajo: S' }),
          it.encima ? null : boton('⧉ Duplicar', () => duplicarToma(it), '', { title: 'Una copia justo después' }),
          it.c && !it.encima ? boton('⤒ Ponerla encima', () => subirToma(it, lineaLibre(it.t0, it.t1), it.c0), '', { title: 'Sale encima del video, con su sonido (o arrástrala hacia arriba)' }) : null,
          it.encima ? boton('⤓ A la línea principal', () => bajarEncima(it, it.t0), '', { title: 'Vuelve entre las demás tomas (o arrástrala hacia abajo)' }) : null,
          boton('Quitar la toma', () => quitarToma(it), 'mn-acc--peligro'))));
      if (it.encima) ctl.push(h('p', { class: 'mn-dato mn-ancho mn-ojo' }, 'Sale encima de tu video con su sonido: mientras dura, lo de abajo no se ve ni se oye. Arrástrala de lado para cambiar cuándo sale.'));
      ctl.push(h('p', { class: 'mn-dato mn-ancho' }, 'Para recortarla, estira sus bordes en la línea de tiempo' + (it.c && !it.encima ? '; para cambiarla de puesto, arrástrala de lado; para ponerla encima del video, arrástrala hacia arriba' : '') +
        '. Sale de ' + (cl ? cl.file_name : 'tu clip') + (isFinite(it.ini) ? ', del segundo ' + coma(it.ini) + ' al ' + coma(it.fin) : '') + '.'));
      if (TM && TM.activa()) ctl.push(h('div', { class: 'mn-ancho' }, boton('↺ Volver a los cortes de Cherry', () => {
        guardarHist('tomas'); TM.soltar(); aviso('Volvieron los cortes de Cherry');
      }, '', { title: 'Quita tus recortes, partes y duplicados' })));
    }
    return vistaSel(foto, ctl);
  }

  function panelVacio() {
    return h('div', { class: 'mn-vacio' },
      h('div', null,
        h('span', { class: 'mn-kicker' }, 'Editor manual'),
        h('h3', null, 'Toca cualquier cosa de la línea de tiempo para cambiarla'),
        h('p', { class: 'mn-dato' }, 'Recorta una toma estirando sus bordes, corrige una palabra del subtítulo, mueve un efecto, cambia una escena o pide otro gráfico. Lo que tocas aquí queda ', h('b', null, 'fijo (✎)'), ': Cherry no lo cambia aunque muevas los ajustes de Automático.')),
      h('div', null,
        h('span', { class: 'mn-kicker' }, 'En tu video'),
        h('ul', { class: 'mn-cuentas' },
          ['subtitulos', 'graficos', 'escenas', 'efectos'].map((p) => h('li', null, h('i', { style: { background: COLOR[p] } }), h('b', null, String(listaDe(p).length)), ' ' + NOMBRE[p].toLowerCase())))),
      h('div', null,
        h('span', { class: 'mn-kicker' }, 'Atajos'),
        h('ul', { class: 'mn-atajos' },
          h('li', null, h('kbd', null, 'Espacio'), ' reproducir o pausar'),
          h('li', null, h('kbd', null, 'Supr'), ' quitar lo escogido'),
          h('li', null, h('kbd', null, 'S'), ' partir la toma en la línea blanca'),
          h('li', null, h('kbd', null, 'Ctrl Z'), ' deshacer · ', h('kbd', null, 'Ctrl Y'), ' rehacer'),
          h('li', null, h('kbd', null, '+'), ' ', h('kbd', null, '−'), ' o ', h('kbd', null, 'Ctrl'), ' + rueda: acercar y alejar la línea de tiempo'),
          h('li', null, h('kbd', null, 'Esc'), ' soltar lo escogido'))));
  }

  function panelClips() {
    const clips = C.state.clips || [];
    return h('div', { class: 'mn-clips' }, clips.map((c) => {
      const usos = X.tomas.filter((t) => t.clip && t.clip.id === c.id).map((t) => (t.encima ? 'encima' : t.i + 1));
      return h('div', { class: 'mn-clip', title: usos.length ? 'Ver dónde va' : 'Este clip no quedó en el video',
        onClick: (ev) => { if (ev.target.closest('.mn-clip-mas')) return; const t = X.tomas.find((x) => x.clip && x.clip.id === c.id); if (t) escoger('tomas', t.id); } },
        h('span', { class: 'mn-clip-foto' }, c.thumbnail_url ? h('img', { src: c.thumbnail_url, alt: '' }) : null, h('em', null, fmtC(Number(c.duration_sec) || 0))),
        h('b', null, c.file_name || 'Clip'),
        h('span', { class: 'mn-clip-uso' + (usos.length ? ' mn-clip-uso--si' : '') }, usos.length ? (usos.length === 1 ? 'toma ' : 'tomas ') + usos.join(', ') : 'no quedó en el video'),
        h('button', { type: 'button', class: 'mn-clip-mas', title: 'Meterlo como toma nueva donde está la línea blanca', onClick: () => agregarClip(c) }, '＋ Agregar'));
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
        X.ed
          ? h('div', { class: 'mn-campo mn-ancho' }, h('span', null, 'Tu video lleva una edición a mano'),
              h('p', { class: 'mn-dato' }, 'Sus capas son los gráficos de este video: mientras esté, Cherry no pone los suyos ni sus escenas (así sale en el video final).'),
              h('div', null, boton('Quitar toda la edición a mano', () => cambiarEdicion({ activa: false }, 'Se quitó la edición a mano: vuelven los gráficos y escenas de Cherry'))))
          : s.grafOn
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
      X.frases.length, X.graficos.length, X.escenas.length, X.efectos.length, X.modo, !!X.ed,
      it ? [it.t0, it.t1, it.f || it.x || it.g || null, it.zona || null] : null, X.subs && it && it.f ? X.subs.palabras.slice(it.f.desde, it.f.hasta + 1) : null,
      CATS.lista ? CATS.lista.length : 0, U.catSonSel || null, it && it.x && it.x.s3_key ? String(ENL[it.x.s3_key]) : '',
      (C.cortesVivo.tomas && C.cortesVivo.tomas.estado() || {}).estado || '']);
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
      else if (U.sel.pista === 'graficos') cuerpo = it.capa ? panelCapa(it) : it.pantalla ? panelPantalla(it) : panelGrafico(it);
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
    const cuantos = (p) => listaDe(p).length;
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
        h('button', { type: 'button', class: 'mn-hbtn', 'aria-label': 'Alejar', title: 'Alejar (tecla −, o Ctrl + rueda del mouse)', onClick: () => zoom(U.zoom / 1.6) }, '−'),
        h('button', { type: 'button', class: 'mn-hbtn', 'aria-label': 'Acercar', title: 'Acercar (tecla +, o Ctrl + rueda del mouse)', onClick: () => zoom(U.zoom * 1.6) }, '＋')));
    const raiz = h('div', { class: 'mn' },
      h('section', { class: 'mn-panel' }, h('div', { class: 'mn-cab' }, tabs, franja), cuerpo),
      h('section', { class: 'mn-linea' }, herr, ver, tl, avisoEl));
    lienzo.addEventListener('pointerdown', alBajar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSubir);
    lienzo.addEventListener('pointercancel', () => { U.arr = null; marcarDestino(null); marcarFila(null); firmaL = ''; pintar(); });
    // (8-oct) Ctrl + rueda (o pellizcar en el panel táctil): acercar y alejar donde está el mouse
    tl.addEventListener('wheel', (ev) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      zoom(U.zoom * (ev.deltaY < 0 ? 1.25 : 0.8), ev.clientX);
    }, { passive: false });
    tl.addEventListener('scroll', () => { const c = lienzo.querySelector('.mn-cabezal'); if (c && X) c.style.visibility = px(C.cortesVivo.tiempo() || 0) < tl.scrollLeft + ETQ_W ? 'hidden' : 'visible'; });
    if (window.ResizeObserver) new ResizeObserver(() => {
      const k = tl.clientWidth + 'x' + tl.clientHeight;
      if (k !== tamL && tl.clientWidth) { tamL = k; firmaL = ''; pintar(); }
    }).observe(tl);
    R = { raiz, tabs, franja, cuerpo, ver, tl, lienzo, reloj, play, aviso: avisoEl, herr };
  }
  /* Acercar o alejar la línea de tiempo. Con la rueda (Ctrl + rueda) se queda quieto el segundo que está bajo el mouse;
     con las teclas + y −, la línea blanca. */
  function zoom(z, clientX) {
    const r = R.tl.getBoundingClientRect();
    const x = clientX != null ? clientX - r.left : null;
    const t = X ? (x != null ? clamp((R.tl.scrollLeft + x - ETQ_W - 6) / U.lw * X.total, 0, X.total) : C.cortesVivo.tiempo() || 0) : 0;
    const antes = U.zoom;
    U.zoom = clamp(z, 1, 40);
    if (U.zoom === antes) return;
    firmaL = ''; pintar();
    if (X) R.tl.scrollLeft = Math.max(0, px(t) - (x != null ? x : R.tl.clientWidth / 2));
  }

  function pintar() {
    if (!R) return;
    X = datos();
    const s = C.state;
    if (X && U.selEscena != null) {
      const e = X.escenas.find((x) => x.zona && Number(x.zona.desde) === U.selEscena);
      if (e) { U.sel = { pista: 'escenas', id: e.id }; U.selEscena = null; }
    }
    const firma = !X ? 'nada' : JSON.stringify([X.total, X.trans, s.lineas || null, X.tomas.map((t) => [t.id, t.t0, t.t1, t.mano, t.fila, t.tapado]), X.voz.map((v) => [v.t0, v.t1]), X.frases.map((f) => [f.t0, f.texto, f.off, f.imp, f.mano, f.f && f.f.fila]), X.graficos.map((g) => [g.id, g.t0, g.t1, g.mano]),
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
    else if (k === 's' || k === 'S') { const t = C.cortesVivo.tiempo() || 0, it = tomaEn(t); if (it) { e.preventDefault(); partirToma(it, t); } }
    else if (k === '+' || k === '=') { e.preventDefault(); zoom(U.zoom * 1.6); }
    else if (k === '-' || k === '_') { e.preventDefault(); zoom(U.zoom / 1.6); }
    else if (k === 'Escape' && U.sel) escoger(null);
  });

  C.manual = { activo: () => modoActual() === 'manual', modo: ponerModo };
})();

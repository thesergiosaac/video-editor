/* subtitulos.js — plantillas de subtítulos (17-sep-2026)
   Catálogo + vista previa en CSS con las MISMAS medidas y reglas del generador del servidor
   (Lambda carrete-layer2 v4, subtitulos.js): lo que se ve aquí es lo que sale en el video.
   Medidas en cqw: 100cqw = ancho del video (1080 px en el final). */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  /* ── Catálogo (los id son los que entiende el servidor) ── */
  const PLANTILLAS = [
    { id: 'editorial',  name: 'Editorial',  ref: 'serif gigante + oro',    desc: 'Frase pequeña en oro y la palabra clave enorme en serif cursiva.' },
    { id: 'contraste',  name: 'Contraste',  ref: 'titular con rojo',       desc: 'A la izquierda, cursiva gruesa, clave en serif roja y una línea fina.' },
    { id: 'dorado',     name: 'Dorado',     ref: 'estilo pódcast',         desc: 'Comienzo en cursiva fina y la idea principal grande en dorado.' },
    { id: 'cinematico', name: 'Cinemático', ref: '1-2 palabras con brillo', desc: 'Palabras grandes y blancas que entran desenfocadas.' },
    { id: 'firma',      name: 'Firma',      ref: 'se enciende al hablar',  desc: 'Minúsculas que se encienden al decirse y clave en serif crema.' },
    { id: 'premium',    name: 'Premium',    ref: 'delgada → gruesa',       desc: 'Minúsculas limpias que pasan de delgadas a gruesas.' },
  ];
  const SIMPLE = { id: 'simple', name: 'A tu gusto', ref: 'sin animaciones en medio', desc: 'Tú eliges letra, color, tamaño, posición, entrada y salida.' };

  /* Letras del modo «a tu gusto» (clave = la del servidor) */
  const LETRAS = [
    { id: 'montserrat-extrabold',  name: 'Montserrat ExtraBold', css: "800 1em 'Montserrat'" },
    { id: 'montserrat-black',      name: 'Montserrat Black',     css: "900 1em 'Montserrat'" },
    { id: 'montserrat-medium',     name: 'Montserrat Medium',    css: "500 1em 'Montserrat'" },
    { id: 'poppins-extrabold',     name: 'Poppins ExtraBold',    css: "800 1em 'Poppins'" },
    { id: 'intertight-extrabold',  name: 'Inter Tight ExtraBold', css: "800 1em 'Inter Tight'" },
    { id: 'manrope-bold',          name: 'Manrope Bold',         css: "700 1em 'Manrope'" },
    { id: 'manrope',               name: 'Manrope',              css: "400 1em 'Manrope'" },
    { id: 'roboto-bold',           name: 'Roboto Bold',          css: "700 1em 'Roboto'" },
    { id: 'instrument',            name: 'Instrument Serif',     css: "400 1em 'Instrument Serif'" },
    { id: 'instrument-italic',     name: 'Instrument Serif cursiva', css: "italic 400 1em 'Instrument Serif'" },
    { id: 'playfair-black-italic', name: 'Playfair Display cursiva', css: "italic 900 1em 'Playfair Display'" },
  ];
  const POSICIONES = [{ id: 'arriba', name: 'Arriba', y: 22 }, { id: 'centro', name: 'Centro', y: 50 }, { id: 'abajo', name: 'Abajo', y: 72 }];
  const ENTRADAS = [{ id: 'ninguna', name: 'Ninguna' }, { id: 'suave', name: 'Suave' }, { id: 'subir', name: 'Subir' }, { id: 'crecer', name: 'Crecer' }];
  const SALIDAS = [{ id: 'ninguna', name: 'Ninguna' }, { id: 'suave', name: 'Suave' }, { id: 'encoger', name: 'Encoger' }];
  /* Dónde va la plantilla: en todo el video o solo en las frases de impacto (el resto con «a tu gusto») */
  const MODOS = [{ id: 'todo', name: 'En todo el video' }, { id: 'impacto', name: 'Solo en frases de impacto' }];
  const IMPACTOS = [{ id: 'pocas', name: 'Pocas · 1 cada 20 s' }, { id: 'medio', name: 'Medio · 1 cada 10 s' }, { id: 'muchas', name: 'Muchas · 1 cada 5 s' }];
  const modoImpacto = (s) => s.subsModo === 'impacto' && (s.subsPlantilla || 'editorial') !== 'simple';

  /* ── Reglas de cada plantilla (espejo de PLANTILLAS en el servidor) ── */
  const ROLES = {
    editorial: {
      chico:  { fuente: "800 100px 'Montserrat'", cq: 5.4, esp: -0.01 },
      grande: { fuente: "italic 400 100px 'Instrument Serif'", cq: 19, esp: -0.02 },
    },
    contraste: {
      sans:   { fuente: "italic 800 100px 'Montserrat'", cq: 8.4, esp: -0.035 },
      chica:  { fuente: "500 100px 'Montserrat'", cq: 5.6, esp: -0.01 },
      acento: { fuente: "italic 900 100px 'Playfair Display'", cq: 15, esp: -0.03 },
    },
    dorado: {
      chico:  { fuente: "italic 400 100px 'Poppins'", cq: 5.8, esp: 0 },
      grande: { fuente: "800 100px 'Poppins'", cq: 12.5, esp: -0.04 },
    },
    cinematico: { cine: { fuente: "800 100px 'Inter Tight'", cq: 14, esp: -0.045 } },
  };
  const CONF = {
    editorial:  { tipo: 'niveles', caso: 'min', punto: true, ancho: 84 },
    contraste:  { tipo: 'niveles', caso: 'orig', punto: true, ancho: 82 },
    dorado:     { tipo: 'niveles', caso: 'orig', mayusClave: true, ancho: 84 },
    cinematico: { tipo: 'niveles', caso: 'orig', ancho: 84 },
    firma:      { tipo: 'flujo', caso: 'min', clave: true },
    premium:    { tipo: 'flujo', caso: 'min', clave: false },
  };

  const rango = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
  const trozos = (ids, n) => { const o = []; for (let i = 0; i < ids.length; i += n) o.push(ids.slice(i, i + n)); return o; };
  const limpiar = (w) => String(w || '').replace(/[¡!¿?.,;:…"«»“”{}\\]/g, '').trim();

  function lineasDe(estilo, n, clave) {
    const antes = rango(0, clave[0] - 1), cl = rango(clave[0], clave[1]), despues = rango(clave[1] + 1, n - 1);
    if (estilo === 'contraste') {
      const L = [];
      if (antes.length && antes.length <= 3) L.push({ rol: 'sans', ids: antes });
      if (antes.length > 3) { const m = Math.ceil(antes.length / 2); L.push({ rol: 'sans', ids: antes.slice(0, m) }); L.push({ rol: 'chica', ids: antes.slice(m) }); }
      L.push({ rol: 'acento', ids: cl });
      if (despues.length) L.push({ rol: 'sans', ids: despues });
      L[L.length - 1].raya = true;
      return L;
    }
    if (estilo === 'cinematico') return [{ rol: 'cine', ids: cl }];   // en la vista previa se muestra el bloque de la palabra clave
    const L = [];
    if (antes.length) L.push({ rol: 'chico', ids: antes });
    L.push({ rol: 'grande', ids: cl });
    if (despues.length) L.push({ rol: 'chico', ids: despues });
    return L;
  }

  /* Medir con las letras reales (canvas): ancho en em */
  const lienzo = document.createElement('canvas').getContext('2d');
  function anchoEm(fuente, texto, esp) {
    lienzo.font = fuente;
    return lienzo.measureText(texto).width / 100 + (esp || 0) * Array.from(texto).length;
  }

  function textoDe(palabras, i, conf, frase, primeraDeGrande) {
    let t = limpiar(palabras[i]);
    if (!t) return '';
    if (conf.caso === 'min') t = t.toLocaleLowerCase('es');
    if (conf.mayusClave && primeraDeGrande) t = t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
    if (conf.punto && frase.cierra && i === palabras.length - 1) t += '.';
    return t;
  }

  const SWOOSH = '<svg class="sp-swoosh" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12.5 C 50 3.5, 130 .5, 200 2.2 C 132 5.8, 54 9.4, 0 12.5 Z"/></svg>';

  /* Página de subtítulo lista para poner dentro de un marco con container-type
     frase: { palabras: ['nadie', 'edita', …], clave: [a, b], cierra, dichas? }  (índices dentro de la frase) */
  function pagina(estilo, frase, simple, animar) {
    const palabras = frase.palabras || [];
    const n = palabras.length;
    const clave = frase.clave && frase.clave[0] >= 0 && frase.clave[0] < n ? [frase.clave[0], Math.min(n - 1, frase.clave[1])] : [n - 1, n - 1];
    if (!n || estilo === 'ninguno') return h('div', { class: 'sp-page sp-vacia' }, estilo === 'ninguno' ? 'sin subtítulo' : '');
    if (estilo === 'simple' || !CONF[estilo]) return paginaSimple(palabras, simple || {}, animar);

    const conf = CONF[estilo];
    const clase = 'sp-page sp-t-' + estilo + (animar ? ' sp-in' : '');

    if (conf.tipo === 'flujo') {
      const dichas = frase.dichas != null ? frase.dichas : Math.ceil(n / 2);
      return h('div', { class: clase },
        h('div', { class: 'sp-line sp-flujo' },
          palabras.map((_, i) => {
            const t = textoDe(palabras, i, conf, frase, false);
            if (!t) return null;
            const esClave = conf.clave && i >= clave[0] && i <= clave[1];
            return h('span', { class: 'sp-w' + (esClave ? ' sp-k' : '') + (i < dichas ? ' sp-dicha' : ''), 'data-t': t, 'data-i': i }, t);
          })
        )
      );
    }

    const roles = ROLES[estilo];
    const max = conf.ancho;
    return h('div', { class: clase },
      lineasDe(estilo, n, clave).map((ln, li) => {
        const R = roles[ln.rol];
        const textos = ln.ids.map((i, k) => textoDe(palabras, i, conf, frase, ln.rol === 'grande' && k === 0)).filter(Boolean);
        if (!textos.length) return null;
        let escala = 1, partir = false;
        const w = anchoEm(R.fuente, textos.join(' '), R.esp) * R.cq;
        if (w > max) {
          const r = max / w;
          if (r < 0.72 && textos.length > 1) {
            const mayor = Math.max(...textos.map((t) => anchoEm(R.fuente, t, R.esp) * R.cq));
            escala = Math.min(0.85, (max / mayor) * 0.97);
            partir = true;
          } else {
            escala = Math.max(0.45, r * 0.97);
          }
        }
        const estiloLinea = { animationDelay: (estilo === 'cinematico' ? 0 : li * 0.12) + 's' };
        if (escala !== 1) estiloLinea.fontSize = (R.cq * escala).toFixed(2) + 'cqw';
        return h('div', { class: 'sp-line sp-' + ln.rol + (partir ? ' sp-line--wrap' : '') + (ln.raya ? ' sp-raya' : ''), style: estiloLinea },
          textos.map((t) => h('span', { class: 'sp-w' }, t)),
          ln.raya && h('span', { class: 'sp-raya__svg', html: SWOOSH })
        );
      })
    );
  }

  function paginaSimple(palabras, c, animar) {
    const letra = LETRAS.find((l) => l.id === c.letra) || LETRAS[0];
    const pos = POSICIONES.find((p) => p.id === c.posicion) || POSICIONES[2];
    const cq = Math.max(3, Math.min(14, Number(c.cq) || 6.4));
    const sombras = [];
    if (c.sombra !== false) sombras.push('0 .4cqw 2cqw rgba(0,0,0,.6)');
    const estilo = {
      top: pos.y + '%', font: letra.css, fontSize: cq + 'cqw', color: c.color || '#FFFFFF',
      textTransform: c.mayusculas ? 'uppercase' : 'none', textShadow: sombras.join(', ') || 'none',
    };
    if (c.borde) {
      estilo.webkitTextStroke = (Number(c.bordeCq || 0.5) * 2).toFixed(2) + 'cqw ' + (c.bordeColor || '#000000');
      estilo.paintOrder = 'stroke fill';
    }
    const texto = palabras.map(limpiar).filter(Boolean).join(' ');
    return h('div', { class: 'sp-page sp-t-simple' + (animar && c.entrada && c.entrada !== 'ninguna' ? ' sp-in sp-e-' + c.entrada : ''), style: estilo }, texto);
  }

  /* Marco 9:16 con foto de fondo (o tu propio video sin subtítulos, en la vista del celular) */
  function marco(estilo, frase, simple, opts) {
    const o = opts || {};
    let fondo = null;
    if (o.fondo) {
      fondo = C.videoFijo('previa-fondo', C.urlVideo(o.fondo), {
        class: 'sp-fondo', muted: true, autoplay: true, loop: true, playsinline: true, preload: 'auto',
        onLoadedmetadata: (e) => { if (e.target.currentTime < 1 && e.target.duration > 8) e.target.currentTime = 3; },
      });
      fondo.muted = true;
      if (fondo.paused) fondo.play().catch(() => null);
    }
    return h('div', { class: 'sp-frame' + (fondo ? ' sp-frame--video' : '') + (o.clase ? ' ' + o.clase : '') },
      fondo,
      h('div', { class: 'sp-dim' }),
      h('div', { class: 'sp-slot' + (o.vivo ? ' js-sp-vivo' : '') }, pagina(estilo, frase, simple, !!o.animar)),
      o.vivo && h('div', { class: 'sp-etiqueta js-sp-etiqueta' }, o.etiqueta || '')
    );
  }
  function pausarFondo() {
    const f = C.videoFijo.get('previa-fondo');
    if (f && !document.body.contains(f)) f.pause();
  }

  /* Frases de muestra */
  const partir = (t) => t.split(' ');
  const MUESTRAS = [
    { palabras: partir('nadie edita tan rápido como tú'), clave: [3, 3], cierra: true },
    { palabras: partir('esto va a cambiar tu contenido'), clave: [5, 5], cierra: true },
    { palabras: partir('el secreto son los primeros segundos'), clave: [5, 5], cierra: true },
    { palabras: partir('nadie te va a contar esto'), clave: [4, 4], cierra: true },   // 4 muestras: en modo impacto alternan parejo
  ];

  /* Configuración que se manda al servidor */
  function simpleDe(s) {
    const pos = POSICIONES.find((p) => p.id === s.simplePos) || POSICIONES[2];
    return {
      letra: s.simpleLetra, cq: s.simpleCq, color: s.simpleColor,
      borde: s.simpleBorde ? { color: s.simpleBordeColor, cq: s.simpleBordeCq } : null,
      sombra: !!s.simpleSombra, mayusculas: !!s.simpleMayus, y: pos.y,
      entrada: s.simpleEntrada, salida: s.simpleSalida,
    };
  }
  /* La misma configuración en la forma que usa la vista previa */
  function simpleVista(s) {
    return {
      letra: s.simpleLetra, cq: s.simpleCq, color: s.simpleColor, borde: s.simpleBorde, bordeColor: s.simpleBordeColor,
      bordeCq: s.simpleBordeCq, sombra: s.simpleSombra, mayusculas: s.simpleMayus, posicion: s.simplePos, entrada: s.simpleEntrada,
    };
  }
  function config(s) {
    const c = { plantilla: s.subsPlantilla || 'editorial', simple: simpleDe(s) };
    if (modoImpacto(s)) { c.modo = 'impacto'; c.impacto = s.subsImpacto || 'medio'; }
    return c;
  }
  const nombre = (id) => (id === 'simple' ? SIMPLE.name : id === 'ninguno' ? 'Sin subtítulo' : ((PLANTILLAS.find((p) => p.id === id) || PLANTILLAS[0]).name));

  /* Galería de la tarjeta Texto */
  function galeria(s) {
    const simple = simpleVista(s);
    return h('div', { class: 'sp-gal' },
      PLANTILLAS.concat([SIMPLE]).map((p) => {
        const sel = (s.subsPlantilla || 'editorial') === p.id;
        return h('button', { class: 'sp-tile' + (sel ? ' sp-tile--sel' : ''), title: p.desc, onClick: () => { if (!sel || C.state.previaEnfoque) C.setState({ subsPlantilla: p.id, previaEnfoque: null }); } },
          marco(p.id, MUESTRAS[0], simple),
          h('span', { class: 'sp-tile__name' }, p.name),
          h('span', { class: 'sp-tile__ref' }, p.ref)
        );
      })
    );
  }

  /* Vista en el celular: frases de muestra que ENTRAN y SALEN con las animaciones elegidas (sin redibujar la página).
     En modo impacto alterna frase normal / frase de impacto; mientras se ajusta «A tu gusto», solo frases normales. */
  let reloj = null, turno = 0;
  function estiloVivo(s, t) {
    const plantilla = s.subsPlantilla || 'editorial';
    if (!modoImpacto(s)) return plantilla;
    if (s.previaEnfoque === 'simple') return 'simple';
    return t % 2 === 1 ? plantilla : 'simple';
  }
  function etiquetaVivo(s, estilo) {
    if (modoImpacto(s)) return estilo === 'simple' ? 'Frase normal · A tu gusto' : 'Frase de impacto · ' + nombre(estilo);
    return 'Vista previa · ' + nombre(estilo);
  }
  function mostrarTurno(animar) {
    const slot = document.querySelector('.js-sp-vivo');
    if (!slot) return false;
    const s = C.state, estilo = estiloVivo(s, turno);
    slot.replaceChildren(pagina(estilo, Object.assign({}, MUESTRAS[turno], { dichas: animar ? 0 : null }), simpleVista(s), animar));
    if (animar) encender(slot);
    document.querySelectorAll('.js-sp-etiqueta').forEach((el) => (el.textContent = etiquetaVivo(s, estilo)));
    return true;
  }
  function ciclo() {
    clearTimeout(reloj);
    reloj = setTimeout(() => {
      const slot = document.querySelector('.js-sp-vivo');
      if (!slot) { reloj = null; pausarFondo(); return; }
      // Salida: la de «a tu gusto» para frases normales; las plantillas salen con un fundido corto (como en el video)
      const s = C.state, pag = slot.firstElementChild;
      const salida = estiloVivo(s, turno) === 'simple' ? (s.simpleSalida || 'suave') : 'suave';
      if (pag) pag.classList.add('sp-out', 'sp-s-' + salida);
      reloj = setTimeout(() => {
        turno = (turno + 1) % MUESTRAS.length;
        if (mostrarTurno(true)) ciclo(); else { reloj = null; pausarFondo(); }
      }, salida === 'ninguna' ? 0 : 230);
    }, 2600);
  }
  function vivo(s) {
    const estilo = estiloVivo(s, turno);
    const frame = marco(estilo, Object.assign({}, MUESTRAS[turno], { dichas: 0 }), simpleVista(s), {
      vivo: true, animar: true, clase: 'sp-frame--celular', fondo: s.fondoPrevia, etiqueta: etiquetaVivo(s, estilo),
    });
    setTimeout(() => { const slot = document.querySelector('.js-sp-vivo'); if (slot) encender(slot); }, 0);
    ciclo();
    return frame;
  }
  // Firma y Premium: las palabras se encienden una a una como si se estuvieran diciendo
  function encender(slot) {
    const ws = slot.querySelectorAll('.sp-flujo .sp-w');
    ws.forEach((w, k) => setTimeout(() => w.classList.add('sp-dicha'), 350 + k * 260));
  }
  // Al arrastrar un deslizador de «a tu gusto»: la frase del celular se redibuja al instante (sin animación)
  function alMover() {
    C.state.previaEnfoque = 'simple';
    mostrarTurno(false);
  }

  /* ── Vista en vivo sobre el video (editor, 17-sep) ──
     Mismas páginas y tiempos que arma el servidor (carrete-layer2 armarPaginas): el texto aparece 0,08 s antes,
     se queda hasta 0,5 s y nunca pisa la página siguiente; Cinemático va en bloques de hasta 2 palabras. */
  const ADELANTO = 0.08, PERMANENCIA = 0.5;
  function paginasVivo(subs) {
    const pal = subs.palabras || [];
    const paginas = [];
    (subs.frases || []).forEach((f) => {
      const estilo = f.estilo || subs.plantilla || 'simple';
      const n = f.hasta - f.desde + 1;
      if (n <= 0) return;
      const ids = rango(f.desde, f.hasta);
      const cierra = !!f.cierra && !/^¿/.test(String((pal[f.desde] || {}).word || ''));
      const clave = [f.clave[0] - f.desde, f.clave[1] - f.desde];
      let grupos;
      if (estilo === 'cinematico') {
        const antes = ids.slice(0, clave[0]), cl = ids.slice(clave[0], clave[1] + 1), despues = ids.slice(clave[1] + 1);
        grupos = trozos(antes, 2).concat([cl]).concat(trozos(despues, 2)).filter((g) => g.length);
      } else grupos = [ids];
      grupos.forEach((g) => {
        const esTodo = g.length === ids.length;
        paginas.push({
          estilo, ids: g,
          ini: Math.max(0, Number(pal[g[0]].start) - ADELANTO),
          vista: {
            palabras: g.map((i) => pal[i].word),
            clave: esTodo ? clave : [0, g.length - 1],
            cierra: cierra && g[g.length - 1] === f.hasta,
          },
        });
      });
    });
    paginas.forEach((p, k) => {
      const ultima = pal[p.ids[p.ids.length - 1]];
      let fin = Number(ultima.end || ultima.start) + PERMANENCIA;
      if (paginas[k + 1]) fin = Math.min(fin, paginas[k + 1].ini);
      p.fin = Math.max(fin, p.ini + 0.3);
    });
    return paginas;
  }
  /* Tiempo del video real → tiempo con el que trabajan las frases (cada corte real dura un poco más que el nominal) */
  function relojNominal(nominales, reales) {
    if (!Array.isArray(nominales) || !Array.isArray(reales) || nominales.length !== reales.length || !reales.length) return (t) => t;
    const iniReal = [], desp = [];
    let an = 0, ar = 0;
    nominales.forEach((d, i) => { iniReal.push(ar); desp.push(ar - an); an += Number(d); ar += Number(reales[i]); });
    return (t) => {
      let k = 0;
      while (k + 1 < iniReal.length && t >= iniReal[k + 1]) k++;
      return t - desp[k];
    };
  }
  /* «A tu gusto» guardado en el video → controles de la tarjeta Texto (para que exportar use el mismo) */
  function simpleAEstado(c) {
    if (!c || typeof c !== 'object') return null;
    const pos = POSICIONES.reduce((m, p) => (Math.abs(p.y - Number(c.y)) < Math.abs(m.y - Number(c.y)) ? p : m), POSICIONES[2]);
    return {
      simpleLetra: LETRAS.some((l) => l.id === c.letra) ? c.letra : LETRAS[0].id,
      simpleCq: Number(c.cq) || 6.4, simpleColor: c.color || '#ffffff',
      simpleBorde: !!c.borde, simpleBordeColor: (c.borde && c.borde.color) || '#000000', simpleBordeCq: (c.borde && Number(c.borde.cq)) || 0.5,
      simpleSombra: c.sombra !== false, simpleMayus: !!c.mayusculas, simplePos: pos.id,
      simpleEntrada: c.entrada || 'suave', simpleSalida: c.salida || 'suave',
    };
  }

  /* Letras listas → medir de nuevo (la primera medida pudo hacerse con la letra de respaldo) */
  if (document.fonts && document.fonts.load) {
    Promise.all([
      "italic 400 40px 'Instrument Serif'", "400 40px 'Instrument Serif'", "italic 900 40px 'Playfair Display'",
      "500 40px 'Montserrat'", "800 40px 'Montserrat'", "italic 800 40px 'Montserrat'", "900 40px 'Montserrat'",
      "italic 400 40px 'Poppins'", "800 40px 'Poppins'", "800 40px 'Inter Tight'", "400 40px 'Manrope'", "700 40px 'Manrope'",
    ].map((f) => document.fonts.load(f, 'áéíóúñ Aa'))).then(() => {
      if (C.render && C.session && C.session.user && C.apiReady) C.render();
    }, () => null);
  }

  C.subs = { PLANTILLAS, SIMPLE, LETRAS, POSICIONES, ENTRADAS, SALIDAS, MODOS, IMPACTOS, MUESTRAS, pagina, marco, galeria, vivo, config, simpleDe, simpleVista, nombre, modoImpacto,
    paginasVivo, relojNominal, simpleAEstado, alMover, pausarFondo };
})();

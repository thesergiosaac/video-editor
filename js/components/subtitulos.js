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
  /* Cada cuántas frases se resalta una palabra */
  const CADAS = [
    { id: 1, name: 'En todas' }, { id: 2, name: 'Una de cada 2' },
    { id: 3, name: 'Una de cada 3' }, { id: 5, name: 'Una de cada 5' },
  ];
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
    contraste:  { tipo: 'niveles', caso: 'orig', punto: true, ancho: 82, alinear: 'izquierda', unRenglon: true },   // cada renglón en UNA fila (18-sep)
    dorado:     { tipo: 'niveles', caso: 'orig', mayusClave: true, ancho: 84 },
    cinematico: { tipo: 'niveles', caso: 'orig', ancho: 84 },
    firma:      { tipo: 'flujo', caso: 'min', clave: true },
    premium:    { tipo: 'flujo', caso: 'min', clave: false },
  };

  /* Colores de cada plantilla (18-sep): «texto» = lo que no es la palabra clave, «acento» = la palabra clave. Sin acento en
     Cinemático y Premium. Se cambian con --c-texto / --c-acento (styles.css) y viajan en simple.colores[plantilla]. */
  const COLORES_BASE = {
    editorial:  { texto: '#F6C445', acento: '#FFFFFF' },
    contraste:  { texto: '#FFFFFF', acento: '#E3262E' },
    dorado:     { texto: '#FFFFFF', acento: '#F7C21A' },
    cinematico: { texto: '#FFFFFF' },
    firma:      { texto: '#FFFFFF', acento: '#D9CBAE' },
    premium:    { texto: '#FFFFFF' },
  };
  const hexValido = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null);
  /* Solo lo que cambió la persona y es válido (lo de siempre no viaja) */
  function coloresLimpios(todos) {
    const out = {};
    Object.keys(COLORES_BASE).forEach((pl) => {
      const c = todos && todos[pl];
      if (!c) return;
      const o = {};
      ['texto', 'acento'].forEach((k) => { const v = hexValido(c[k]); if (v && COLORES_BASE[pl][k] && v.toUpperCase() !== COLORES_BASE[pl][k]) o[k] = v; });
      if (Object.keys(o).length) out[pl] = o;
    });
    return out;
  }

  /* Altura base de cada plantilla (los MISMOS números del servidor) y tamaño del bloque en «flujo» */
  const Y_BASE = { editorial: 60, contraste: 62, dorado: 64, cinematico: 50, firma: 66, premium: 64 };
  const CQ_FLUJO = { firma: 6.2, premium: 6.4 };
  /* Lo que eligió la persona: tamaño (multiplica) y posición (sube o baja) */
  const ajuste = () => ({
    escala: Math.max(0.7, Math.min(1.5, Number(C.state.subsEscala) || 1)),
    dy: Math.max(-45, Math.min(45, Number(C.state.subsDy) || 0)),
    dx: Math.max(-35, Math.min(35, Number(C.state.subsDx) || 0)),
  });
  /* Márgenes laterales de cada plantilla (los mismos del servidor) para poder correrla a los lados */
  const LADO_BASE = { editorial: 8, contraste: 9, dorado: 8, cinematico: 8, firma: 8, premium: 8 };

  /* ── Zona segura (18-sep): lo que no tapan los botones de Instagram, TikTok y YouTube Shorts ──
     En % del video. Los MISMOS números y reglas del servidor (carrete-layer2 subtitulos.js: ZONA, cajaZona, encajarY). */
  const ZONA = { arriba: 12, abajo: 24, izq: 6, der: 15 };
  /* La caja de la plantilla en el sitio que eligió la persona (18-sep): la POSICIÓN manda y el ANCHO se ajusta al espacio
     que queda hasta el borde (zona segura, o la pantalla con 4 % de margen): una frase larga se achica o baja de renglón
     en vez de correrse. Igual que cajaPosicion del servidor. */
  const BORDE_PANTALLA = 4, ANCHO_MINIMO = 30;
  function cajaPosicion(izq, der, dx, alinear, zona) {
    const l0 = zona ? ZONA.izq : BORDE_PANTALLA, l1 = 100 - (zona ? ZONA.der : BORDE_PANTALLA);
    const W = 100 - izq - der;
    if (alinear === 'izquierda') {
      const L = Math.max(l0, Math.min(l1 - ANCHO_MINIMO, izq + dx));
      const w = Math.min(W, l1 - L);
      return { izq: L, der: 100 - L - w, dx: 0 };
    }
    const cx = Math.max(l0 + ANCHO_MINIMO / 2, Math.min(l1 - ANCHO_MINIMO / 2, 50 + dx));
    const w2 = Math.min(W, 2 * Math.min(cx - l0, l1 - cx));
    return { izq: (100 - w2) / 2, der: (100 - w2) / 2, dx: cx - 50 };
  }
  /* Posición de maquetación (sin transformaciones ni animaciones) de un elemento dentro del marco */
  function izqEn(el, marcoEl) { let x = 0; while (el && el !== marcoEl) { x += el.offsetLeft; el = el.offsetParent; } return x; }
  /* Arriba/abajo: el bloque ya dibujado se mide y se corre para que quepa en la zona (si no cabe, queda centrado
     en ella), igual que encajarY del servidor. Se hace cuando ya está en pantalla: antes no tiene alto. */
  function encajar(el) {
    if (!el.isConnected) { requestAnimationFrame(() => { if (el.isConnected) encajar(el); }); return; }
    const marcoEl = el.offsetParent;
    const F = marcoEl && marcoEl.clientHeight, alto = el.offsetHeight;
    if (!F || !alto) return;
    if (el.dataset.y0 == null) el.dataset.y0 = String((el.offsetTop / F) * 100);   // centro pedido (top + translateY(-50%))
    const zA = F * ZONA.arriba / 100, zB = F * (100 - ZONA.abajo) / 100;
    const centro = Number(el.dataset.y0) * F / 100;
    const arriba = alto >= zB - zA ? zA + (zB - zA - alto) / 2 : Math.max(zA, Math.min(zB - alto, centro - alto / 2));
    el.style.top = (((arriba + alto / 2) / F) * 100).toFixed(3) + '%';
    // A los lados: el TEXTO de verdad (las palabras), no la caja, se corre lo necesario para quedar en la zona
    const W = marcoEl.clientWidth, palabras = el.querySelectorAll('.sp-w');
    if (!W || !palabras.length) return;
    let x0 = Infinity, x1 = -Infinity;
    palabras.forEach((w) => { const a = izqEn(w, marcoEl); x0 = Math.min(x0, a); x1 = Math.max(x1, a + w.offsetWidth); });
    const zI = W * ZONA.izq / 100, zD = W * (100 - ZONA.der) / 100;
    const aLaIzq = el.classList.contains('sp-t-contraste');
    const mover = x1 - x0 > zD - zI ? (aLaIzq ? zI - x0 : (zI + zD) / 2 - (x0 + x1) / 2) : x0 < zI ? zI - x0 : x1 > zD ? zD - x1 : 0;
    if (Math.abs(mover) < 0.5) return;
    const L = el.offsetLeft, R = W - el.offsetLeft - el.offsetWidth;     // corre la caja entera: el ancho no cambia
    el.style.left = (((L + mover) / W) * 100).toFixed(3) + '%';
    el.style.right = (((R - mover) / W) * 100).toFixed(3) + '%';
  }

  const rango = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
  const trozos = (ids, n) => { const o = []; for (let i = 0; i < ids.length; i += n) o.push(ids.slice(i, i + n)); return o; };
  const limpiar = (w) => String(w || '').replace(/[¡!¿?.,;:…"«»“”{}\\]/g, '').trim();

  /* La raya de Contraste NO va en todas (18-sep, Sergio: «de 10 frases, en 6»): patrón fijo de 5 → sí, no, sí, sí, no.
     `vez` = cuántas frases con esa plantilla van antes (0 = la primera, que siempre la lleva). Igual que el servidor. */
  const PATRON_RAYA = [true, false, true, true, false];
  const conRaya = (vez) => PATRON_RAYA[(Number(vez) || 0) % PATRON_RAYA.length];

  function lineasDe(estilo, n, clave, vez) {
    const antes = rango(0, clave[0] - 1), cl = rango(clave[0], clave[1]), despues = rango(clave[1] + 1, n - 1);
    if (estilo === 'contraste') {
      // Nunca más de 3 renglones (18-sep): con palabras DESPUÉS de la clave, lo de antes va en un solo renglón
      // (5 palabras o más → la delgada, que cabe). Igual que el servidor.
      const L = [];
      if (despues.length) {
        if (antes.length) L.push({ rol: antes.length <= 4 ? 'sans' : 'chica', ids: antes });
        L.push({ rol: 'acento', ids: cl });
        L.push({ rol: despues.length <= 4 ? 'sans' : 'chica', ids: despues });
      } else {
        if (antes.length && antes.length <= 3) L.push({ rol: 'sans', ids: antes });
        if (antes.length > 3) { const m = Math.ceil(antes.length / 2); L.push({ rol: 'sans', ids: antes.slice(0, m) }); L.push({ rol: 'chica', ids: antes.slice(m) }); }
        L.push({ rol: 'acento', ids: cl });
      }
      L[L.length - 1].raya = conRaya(vez);
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
    const el = armarPagina(estilo, frase, simple, animar);
    const col = simple && simple.colores && simple.colores[estilo];      // colores propios de la plantilla (18-sep)
    if (col) {
      if (hexValido(col.texto)) el.style.setProperty('--c-texto', col.texto);
      if (hexValido(col.acento)) el.style.setProperty('--c-acento', col.acento);
    }
    // zona segura: se corre arriba/abajo apenas quede en pantalla (antes de pintarse, así no salta)
    if (simple && simple.zona && el.classList.contains('sp-page') && !el.classList.contains('sp-vacia')) queueMicrotask(() => encajar(el));
    return el;
  }
  function armarPagina(estilo, frase, simple, animar) {
    const palabras = frase.palabras || [];
    const n = palabras.length;
    const clave = frase.clave && frase.clave[0] >= 0 && frase.clave[0] < n ? [frase.clave[0], Math.min(n - 1, frase.clave[1])] : [n - 1, n - 1];
    if (!n || estilo === 'ninguno') return h('div', { class: 'sp-page sp-vacia' }, estilo === 'ninguno' ? 'sin subtítulo' : '');
    /* `clave` también lo usa «a tu gusto» para resaltar una palabra */
    if (estilo === 'simple' || !CONF[estilo]) return paginaSimple(palabras, simple || {}, animar, clave, frase.resalta);

    const conf = CONF[estilo];
    const clase = 'sp-page sp-t-' + estilo + (animar ? ' sp-in' : '');

    const aj = ajuste();
    const estiloPagina = {};
    if (Y_BASE[estilo] != null && aj.dy) estiloPagina.top = (Y_BASE[estilo] + aj.dy) + '%';   // top gana sobre --y del CSS
    const lado = LADO_BASE[estilo] != null ? LADO_BASE[estilo] : 8;
    const zonaOn = !!(simple && simple.zona);
    const caja = zonaOn || aj.dx ? cajaPosicion(lado, lado, aj.dx, conf.alinear, zonaOn) : { izq: lado, der: lado, dx: 0 };
    if (caja.dx || caja.izq !== lado || caja.der !== lado) {         // en el sitio elegido, con el ancho que queda hasta el borde
      estiloPagina.left = (caja.izq + caja.dx) + '%';
      estiloPagina.right = (caja.der - caja.dx) + '%';
    }

    if (conf.tipo === 'flujo') {
      const dichas = frase.dichas != null ? frase.dichas : Math.ceil(n / 2);
      return h('div', { class: clase, style: estiloPagina },
        h('div', { class: 'sp-line sp-flujo', style: aj.escala !== 1 ? { fontSize: ((CQ_FLUJO[estilo] || 6.3) * aj.escala).toFixed(2) + 'cqw' } : null },
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
    const max = Math.min(conf.ancho, 100 - caja.izq - caja.der);
    return h('div', { class: clase, style: estiloPagina },
      lineasDe(estilo, n, clave, frase.vez).map((ln, li) => {
        const R = roles[ln.rol];
        const textos = ln.ids.map((i, k) => textoDe(palabras, i, conf, frase, ln.rol === 'grande' && k === 0)).filter(Boolean);
        if (!textos.length) return null;
        let escala = 1, partir = false;
        const cqUsuario = R.cq * aj.escala;                 // el tamaño que pidió la persona
        const w = anchoEm(R.fuente, textos.join(' '), R.esp) * cqUsuario;
        if (w > max) {
          const r = max / w;
          if (r < 0.72 && textos.length > 1 && !conf.unRenglon) {
            const mayor = Math.max(...textos.map((t) => anchoEm(R.fuente, t, R.esp) * cqUsuario));
            escala = Math.min(0.85, (max / mayor) * 0.97);
            partir = true;
          } else {
            escala = Math.max(conf.unRenglon ? 0.3 : 0.45, r * 0.97);
          }
        }
        const estiloLinea = { animationDelay: (estilo === 'cinematico' ? 0 : li * 0.12) + 's' };
        if (escala !== 1 || aj.escala !== 1) estiloLinea.fontSize = (cqUsuario * escala).toFixed(2) + 'cqw';
        return h('div', { class: 'sp-line sp-' + ln.rol + (partir ? ' sp-line--wrap' : '') + (ln.raya ? ' sp-raya' : ''), style: estiloLinea },
          textos.map((t) => h('span', { class: 'sp-w' }, t)),
          ln.raya && h('span', { class: 'sp-raya__svg', html: SWOOSH })
        );
      })
    );
  }

  function paginaSimple(palabras, c, animar, clave, resalta) {
    const letra = LETRAS.find((l) => l.id === c.letra) || LETRAS[0];
    const pos = POSICIONES.find((p) => p.id === c.posicion) || POSICIONES[2];
    const cq = Math.max(3, Math.min(14, Number(c.cq) || 6.4));
    const sombras = [];
    if (c.sombra !== false) sombras.push('0 .4cqw 2cqw rgba(0,0,0,.6)');
    const estilo = {
      top: pos.y + '%', font: letra.css, fontSize: cq + 'cqw', color: c.color || '#FFFFFF',
      textTransform: c.mayusculas ? 'uppercase' : 'none', textShadow: sombras.join(', ') || 'none',
    };
    if (c.italica) estilo.fontStyle = 'italic';          // va después de `font`, así que manda
    // interlineado e interletrado (18-sep) — `font` reinicia line-height, por eso van después
    estilo.lineHeight = String(Math.max(0.8, Math.min(2, Number(c.alto) || 1.2)));
    const esp = Math.max(-0.08, Math.min(0.3, Number(c.esp) || 0));
    if (esp) estilo.letterSpacing = esp + 'em';            // se hereda en px: la palabra resaltada usa el mismo (como el servidor)
    if (c.zona) { const z = cajaPosicion(8, 8, 0, 'centro', true); estilo.left = z.izq + '%'; estilo.right = z.der + '%'; }
    if (c.borde) {
      estilo.webkitTextStroke = (Number(c.bordeCq || 0.5) * 2).toFixed(2) + 'cqw ' + (c.bordeColor || '#000000');
      estilo.paintOrder = 'stroke fill';
    }
    const clase = 'sp-page sp-t-simple' + (animar && c.entrada && c.entrada !== 'ninguna' ? ' sp-in sp-e-' + c.entrada : '');
    const R = c.clave && c.clave.activo && resalta !== false ? c.clave : null;
    if (!R || !clave) {
      const texto = palabras.map(limpiar).filter(Boolean).join(' ');
      return h('div', { class: clase, style: estilo }, texto);
    }
    /* Una palabra con estilo propio: mismo resultado que el servidor */
    const letraK = LETRAS.find((l) => l.id === R.letra) || letra;
    const estiloK = {
      font: letraK.css, fontSize: (cq * Math.max(0.6, Math.min(2, Number(R.escala) || 1))) + 'cqw',
      lineHeight: estilo.lineHeight,          // `font` lo reinicia a «normal»: la resaltada también obedece el interlineado
      color: R.color || '#FFC93C',
      fontWeight: R.negrilla ? '900' : null,
      fontStyle: R.italica ? 'italic' : (c.italica ? 'italic' : null),
      textDecoration: R.subrayado ? 'underline' : null,
    };
    /* El espacio va AFUERA de cada palabra: dentro de una caja inline-block el navegador borra el espacio del final,
       y al achicar la letra todo quedaba pegado en un renglón («nadieeditatan…», 18-sep) */
    const hijos = [];
    palabras.forEach((w, i) => {
      const t = limpiar(w);
      if (!t) return;
      const esClave = i >= clave[0] && i <= clave[1];
      if (hijos.length) hijos.push(' ');
      hijos.push(h('span', { class: 'sp-w' + (esClave ? ' sp-w--clave' : ''), style: esClave ? estiloK : null }, t));
    });
    return h('div', { class: clase, style: estilo }, hijos);
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
      // la zona segura se ve punteada en el celular mientras está encendida (solo aquí: no sale en el video)
      o.vivo && simple && simple.zona && h('div', { class: 'sp-zona-guia', style: {
        top: ZONA.arriba + '%', bottom: ZONA.abajo + '%', left: ZONA.izq + '%', right: ZONA.der + '%' } },
        h('span', null, 'Zona segura')),
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
    const o = {
      letra: s.simpleLetra, cq: s.simpleCq, color: s.simpleColor,
      borde: s.simpleBorde ? { color: s.simpleBordeColor, cq: s.simpleBordeCq } : null,
      sombra: !!s.simpleSombra, mayusculas: !!s.simpleMayus, italica: !!s.simpleItalica, y: pos.y,
      entrada: s.simpleEntrada, salida: s.simpleSalida,
      clave: claveDe(s),
    };
    // 18-sep: interlineado, interletrado y zona segura, solo si se usan (lo de siempre viaja igual que antes).
    // La zona vale para TODOS los subtítulos (también las plantillas), pero viaja aquí porque orchestrate
    // pasa `simple` completo al servidor sin tocarlo.
    if (Number(s.simpleAlto) && Number(s.simpleAlto) !== 1.2) o.alto = Number(s.simpleAlto);
    if (Number(s.simpleEsp)) o.esp = Number(s.simpleEsp);
    if (s.subsZona) o.zona = true;
    const col = coloresLimpios(s.subsColores);                 // colores propios de las plantillas (18-sep)
    if (Object.keys(col).length) o.colores = col;
    return o;
  }
  /* Palabra resaltada: la clave que marcó la IA, con el estilo que eligió la persona */
  function claveDe(s) {
    if (!s.simpleClaveOn) return null;
    return {
      activo: true,
      cada: Math.max(1, Math.min(10, Number(s.simpleClaveCada) || 1)),
      color: s.simpleClaveColor || '#FFC93C',
      escala: Math.max(0.6, Math.min(2, Number(s.simpleClaveEscala) || 1)),
      letra: s.simpleClaveLetra || null,
      negrilla: !!s.simpleClaveNegrilla,
      italica: !!s.simpleClaveItalica,
      subrayado: !!s.simpleClaveSubrayado,
    };
  }

  /* La misma configuración en la forma que usa la vista previa */
  function simpleVista(s) {
    return {
      letra: s.simpleLetra, cq: s.simpleCq, color: s.simpleColor, borde: s.simpleBorde, bordeColor: s.simpleBordeColor,
      bordeCq: s.simpleBordeCq, sombra: s.simpleSombra, mayusculas: s.simpleMayus, italica: s.simpleItalica, posicion: s.simplePos, entrada: s.simpleEntrada,
      clave: claveDe(s),
      alto: s.simpleAlto, esp: s.simpleEsp, zona: !!s.subsZona, colores: coloresLimpios(s.subsColores),
    };
  }
  function config(s) {
    const c = { plantilla: s.subsPlantilla || 'editorial', simple: simpleDe(s) };
    const esc = Math.max(0.7, Math.min(1.5, Number(s.subsEscala) || 1));
    const dy = Math.max(-45, Math.min(45, Number(s.subsDy) || 0));
    const dx = Math.max(-35, Math.min(35, Number(s.subsDx) || 0));
    if (esc !== 1) c.escala = esc;
    if (dy) c.y = dy;
    if (dx) c.x = dx;
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
    slot.replaceChildren(pagina(estilo, Object.assign({}, MUESTRAS[turno], { dichas: animar ? 0 : null, vez: turno }), simpleVista(s), animar));
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
    const frame = marco(estilo, Object.assign({}, MUESTRAS[turno], { dichas: 0, vez: turno }), simpleVista(s), {
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
    /* Al mover tamaño o posición de la plantilla se mira la plantilla, no «a tu gusto» */
    const plantilla = (C.state.subsPlantilla || 'editorial') !== 'simple';
    C.state.previaEnfoque = plantilla ? null : 'simple';
    mostrarTurno(false);
  }

  /* ── Vista en vivo sobre el video (editor, 17-sep) ──
     Mismas páginas y tiempos que arma el servidor (carrete-layer2 armarPaginas): el texto aparece 0,08 s antes,
     se queda hasta 0,5 s y nunca pisa la página siguiente; Cinemático va en bloques de hasta 2 palabras. */
  const ADELANTO = 0.08, PERMANENCIA = 0.5;
  function paginasVivo(subs) {
    const pal = subs.palabras || [];
    const paginas = [];
    const cadaClave = Math.max(1, Math.min(10, Number(C.state.simpleClaveCada) || 1));
    const veces = {};
    (subs.frases || []).forEach((f, iFrase) => {
      const estilo = f.estilo || subs.plantilla || 'simple';
      const vez = veces[estilo] = veces[estilo] == null ? 0 : veces[estilo] + 1;   // para la raya (igual que el servidor)
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
            resalta: iFrase % cadaClave === 0,      // «una de cada tantas», igual que en el servidor
            cierra: cierra && g[g.length - 1] === f.hasta,
            vez,
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
      // 18-sep: faltaban la inclinada y la palabra resaltada (al abrir el proyecto la página quedaba distinta al video)
      simpleItalica: !!c.italica,
      simpleClaveOn: !!(c.clave && c.clave.activo),
      ...(c.clave && c.clave.activo ? {
        simpleClaveCada: Number(c.clave.cada) || 1, simpleClaveColor: c.clave.color || '#FFC93C',
        simpleClaveEscala: Number(c.clave.escala) || 1, simpleClaveLetra: c.clave.letra || '',
        simpleClaveNegrilla: !!c.clave.negrilla, simpleClaveItalica: !!c.clave.italica, simpleClaveSubrayado: !!c.clave.subrayado,
      } : {}),
      simpleAlto: Number(c.alto) || 1.2, simpleEsp: Number(c.esp) || 0, subsZona: !!c.zona,
      subsColores: coloresLimpios(c.colores),
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

  C.subs = { PLANTILLAS, SIMPLE, LETRAS, POSICIONES, ENTRADAS, SALIDAS, MODOS, IMPACTOS, CADAS, MUESTRAS, pagina, marco, galeria, vivo, config, simpleDe, simpleVista, nombre, modoImpacto,
    paginasVivo, relojNominal, simpleAEstado, alMover, pausarFondo, COLORES_BASE };
})();

/* pantallas.js — las GRABACIONES DE PANTALLA dentro de la plantilla del navegador (24-sep-2026)
 *
 * Sergio: «voy a explicar algo en la pantalla del computador; esa pantalla tiene que ir en la plantilla, no a
 * pantalla completa». Escogió dos formas: «tú arriba, la pantalla abajo» y «la pantalla arriba, detrás de ti»
 * (su pelo y sus hombros quedan delante de la ventana).
 *
 * Se ponen desde el GUION: en la línea donde empieza a explicar toca «Pantalla», sube su grabación, escoge la
 * forma y hasta qué línea dura. Queda atada a sus PALABRAS (de la 22 a la 40), no a segundos: si cambia los
 * cortes o las pausas, la pantalla se mueve con la frase. La misma cuenta (graficos.js › piezasPantallas) la
 * hacen la vista previa y el ensamblador.
 *
 * Viven en `projects.pantallas` (se guardan solas) y viajan en cada render. La grabación sube a S3 por trozos
 * (función `pantalla`) y la Lambda la deja lista y pública en clips/pantallas/<id>.mp4|png con un <id>.json.
 */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const BUCKET = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/';
  const TROZO = 8 * 1024 * 1024;
  const FORMAS = [
    { id: 'partida', name: 'Tú arriba, pantalla abajo' },
    { id: 'invertida', name: 'Pantalla arriba, tú abajo' },
    { id: 'profundo', name: 'Pantalla arriba, detrás de ti' },
  ];

  const lista = () => (Array.isArray(C.state.pantallas) ? C.state.pantallas : []);
  const lista_ = (p) => !!(p && p.url);                     // solo las que ya tienen su grabación lista
  const nuevoId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const toca = (p, l) => Number(p.desde) <= l.hasta && Number(p.hasta) >= l.desde;

  /* ── Guardar (solas, al rato de tocar) ─────────────────────────────────────────────────────── */
  let reloj = null;
  function poner(nueva, redibujar) {
    C.setState({ pantallas: nueva }, redibujar === false ? { render: false } : undefined);
    clearTimeout(reloj);
    const pid = C.session.projectId;
    reloj = setTimeout(() => {
      if (pid !== C.session.projectId) return;
      C.api.guardarPantallas(nueva.filter(lista_)).catch((e) => console.warn('[Pantallas] no se guardaron', e));
    }, 700);
  }
  function cambiar(id, cambios, redibujar) {
    poner(lista().map((p) => (p.id === id ? Object.assign({}, p, cambios) : p)), redibujar);
  }

  async function cargar() {
    try {
      const l = await C.api.leerPantallas();
      C.setState({ pantallas: Array.isArray(l) ? l : [], pantallaAbierta: null }, { render: false });
    } catch (e) { console.warn('[Pantallas] no se pudieron leer', e); }
  }

  /* ── Subir la grabación ────────────────────────────────────────────────────────────────────── */
  const subiendo = {};                                       // id → { pct, fase, error }
  function pintarEstado(id) {
    document.querySelectorAll('.js-pan-estado-' + id).forEach((el) => { el.textContent = textoEstado(lista().find((p) => p.id === id)); });
  }
  function textoEstado(p) {
    if (!p) return '';
    const s = subiendo[p.id];
    if (s && s.error) return 'No se pudo: ' + s.error;
    if (s && s.fase === 'subiendo') return 'Subiendo ' + s.pct + ' %…';
    if (s && s.fase === 'preparando') return 'Preparándola…' + (s.seg ? ' ' + s.seg + ' s' : '');
    if (!p.url) return 'Sube tu grabación de pantalla (video o imagen).';
    return (p.tipo === 'imagen' ? 'Imagen' : 'Grabación de ' + seg(p.dur)) + ' · ' + p.ancho + '×' + p.alto;
  }
  const seg = (x) => (Number(x) || 0).toFixed(1).replace('.', ',') + ' s';

  function elegirArchivo(id) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'video/*,image/*';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) subir(id, f); };
    inp.click();
  }

  async function subir(id, file) {
    subiendo[id] = { pct: 0, fase: 'subiendo' };
    C.render();
    const pid = C.session.projectId;
    try {
      const partes = Math.max(1, Math.ceil(file.size / TROZO));
      const ini = await C.api.edgeFetch('pantalla', { action: 'iniciar', project_id: pid, nombre: file.name, partes });
      if (!ini || !ini.upload_id || !Array.isArray(ini.part_urls)) throw new Error((ini && ini.error) || 'no se pudo abrir la subida');
      const cargado = new Array(partes).fill(0), etags = [];
      const cola = ini.part_urls.slice();
      async function obrero() {
        while (cola.length) {
          const { part_number, url } = cola.shift();
          const trozo = file.slice((part_number - 1) * TROZO, part_number * TROZO);
          for (let intento = 1; intento <= 4; intento++) {
            try {
              const etag = await new Promise((ok, mal) => {
                const x = new XMLHttpRequest();
                x.open('PUT', url);
                x.timeout = 180000;
                x.upload.onprogress = (e) => {
                  if (!e.lengthComputable) return;
                  cargado[part_number - 1] = e.loaded;
                  subiendo[id].pct = Math.min(99, Math.round(cargado.reduce((a, b) => a + b, 0) / file.size * 100));
                  pintarEstado(id);
                };
                x.onload = () => (x.status === 200 ? ok(x.getResponseHeader('ETag') || '') : mal(new Error('trozo ' + part_number + ': ' + x.status)));
                x.onerror = () => mal(new Error('se cortó la red'));
                x.ontimeout = () => mal(new Error('la red no contestó'));
                x.send(trozo);
              });
              etags.push({ part_number, etag });
              break;
            } catch (e) {
              if (intento === 4) throw e;
              cargado[part_number - 1] = 0;
              await new Promise((r) => setTimeout(r, intento * 1500));
            }
          }
        }
      }
      await Promise.all([obrero(), obrero(), obrero(), obrero()].slice(0, Math.min(4, partes)));
      etags.sort((a, b) => a.part_number - b.part_number);
      const fin = await C.api.edgeFetch('pantalla', { action: 'completar', project_id: pid, id: ini.id, key: ini.key, upload_id: ini.upload_id, parts: etags });
      if (!fin || !fin.ok) throw new Error((fin && fin.error) || 'no se pudo cerrar la subida');

      // la Lambda la prepara: se mira su <id>.json público
      subiendo[id] = { pct: 100, fase: 'preparando', seg: 0 };
      pintarEstado(id);
      const t0 = Date.now();
      let meta = null;
      while (Date.now() - t0 < 15 * 60000) {
        await new Promise((r) => setTimeout(r, 2000));
        subiendo[id].seg = Math.round((Date.now() - t0) / 1000);
        pintarEstado(id);
        try {
          const r = await fetch(BUCKET + 'clips/pantallas/' + ini.id + '.json?t=' + Date.now(), { cache: 'no-store' });
          if (r.ok) { meta = await r.json(); break; }
        } catch (_) { /* aún no está */ }
      }
      if (!meta) throw new Error('tardó demasiado en prepararse');
      if (!meta.ok) throw new Error(meta.error || 'no se pudo preparar');
      delete subiendo[id];
      if (pid !== C.session.projectId) return;
      // (24-sep) la pantalla dura lo que dura tu grabación (una imagen, 5 s); el editor la reparte por las líneas
      const antes = lista().find((x) => x.id === id) || {};
      const segundos = antes.segundos || (meta.tipo === 'imagen' ? 5 : Math.round((Number(meta.dur) || 5) * 10) / 10);
      cambiar(id, { url: meta.url, tapa: meta.tapa || '', tipo: meta.tipo, ancho: meta.ancho, alto: meta.alto, dur: meta.dur || 0, inicio: 0, segundos });
    } catch (e) {
      subiendo[id] = { error: String((e && e.message) || e).slice(0, 120) };
      C.render();
    }
  }

  /* ── Crear, alargar, quitar ────────────────────────────────────────────────────────────────── */
  function nueva(l) {
    // (24-sep) hereda el color de la pantalla anterior: se escoge una vez
    const previa = lista().filter((x) => x.color).pop();
    const p = { id: nuevoId(), desde: l.desde, hasta: l.hasta, forma: 'partida', url: '', etiqueta: '', titulo: '', dir: '', color: previa ? previa.color : '' };
    poner(lista().concat([p]));
    C.setState({ pantallaAbierta: p.id });
    elegirArchivo(p.id);
  }
  function quitar(id) {
    delete subiendo[id];
    poner(lista().filter((p) => p.id !== id));
    C.setState({ pantallaAbierta: null });
  }
  /* (24-sep) «hasta dónde» sale de la DURACIÓN. Sergio: «debería preguntarme la duración, así el sistema lo
     distribuye entre las líneas siguientes». La pantalla aparece 0,35 s antes de su primera palabra y se va 0,6 s
     después de la última (graficos.js › piezasPantallas): se busca la última palabra que termina a tiempo para que
     todo junto dure lo pedido. Nunca menos que la primera palabra. */
  const ANTES = 0.35, DESPUES = 0.6;
  function hastaPorDuracion(p, lineas, segundos) {
    const D = Number(segundos);
    if (!(D > 0)) return p.hasta;
    const i0 = lineas.findIndex((l) => l.desde <= p.desde && l.hasta >= p.desde);
    if (i0 < 0) return p.hasta;
    const pal = [];
    for (let k = i0; k < lineas.length; k++) {
      const L = lineas[k];
      const conTp = Array.isArray(L.tp) && L.tp.length === L.hasta - L.desde + 1;
      const tp = conTp ? L.tp : [[L.t0, L.t1 != null ? L.t1 : L.t0]];   // sin palabras: la línea entera
      tp.forEach((x, j) => { const idx = conTp ? L.desde + j : L.hasta; if (idx >= p.desde) pal.push({ idx, t0: x[0], t1: x[1] }); });
    }
    if (!pal.length) return p.hasta;
    const fin = pal[0].t0 - ANTES + D - DESPUES;
    let hasta = pal[0].idx;
    for (let k = 0; k < pal.length; k++) { if (pal[k].t1 <= fin + 0.05) hasta = pal[k].idx; else break; }
    return Math.max(Number(p.desde), hasta);
  }
  function duracion(p, lineas) {
    const a = lineas.find((l) => toca(p, l)), b = lineas.filter((l) => toca(p, l)).pop();
    if (!a || !b) return { n: 0, s: 0 };
    const n = lineas.filter((l) => toca(p, l)).length;
    // lo que dura de verdad en pantalla: de su primera palabra a su última, con lo que aparece antes y se va después
    const tw = (L, idx) => (Array.isArray(L.tp) && L.tp[idx - L.desde]) || null;
    const w0 = tw(a, Number(p.desde)), w1 = tw(b, Number(p.hasta));
    const s = w0 && w1 ? w1[1] - w0[0] + ANTES + DESPUES : Math.max(0, (b.t1 != null ? b.t1 : b.t0) - a.t0);
    return { n, s, ultima: b };
  }

  /* ── En el guion ───────────────────────────────────────────────────────────────────────────── */
  function mando(l) {
    const p = lista().find((x) => toca(x, l));
    const abierta = p && C.state.pantallaAbierta === p.id;
    return h('button', {
      class: 'gu-b ' + (p ? 'gu-b--pan' : 'gu-b--auto') + (abierta ? ' gu-b--abierta' : ''), type: 'button',
      title: p ? 'Aquí va tu grabación de pantalla. Toca para cambiarla.' : 'Pon aquí una grabación de tu pantalla, dentro de la plantilla del navegador.',
      onClick: (ev) => { ev.preventDefault(); if (p) C.setState({ pantallaAbierta: abierta ? null : p.id }); else nueva(l); },
    }, h('span', { class: 'gu-b__i' }, p ? '▣' : '+'), 'Pantalla');
  }
  function marca(l) {
    const p = lista().find((x) => toca(x, l));
    return p ? h('span', { class: 'gu-m gu-m--p' }, p.forma === 'profundo' ? 'Pantalla · detrás' : 'Pantalla') : null;
  }

  /* (24-sep) «Color de la ventana»: el brillo, el borde y la barra de la plantilla. Los mismos colores que Gráficos,
     «Mis colores» y uno a mano. Sin escoger, sale el de Gráficos (rosado si están apagados). */
  const NOMBRE_COLOR = { cherry: 'Cherry', dorado: 'Dorado', oceano: 'Océano', lima: 'Lima', coral: 'Coral', lila: 'Lila', crema: 'Crema' };
  function colorVentana(p) {
    const GR = window.CherryGraf;
    if (!GR || !GR.COLORES) return null;
    const mios = ((C.misColores && C.misColores.lista()) || []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 4);
    const colores = Object.keys(GR.COLORES).map((k) => ({ id: k, hex: GR.COLORES[k], name: NOMBRE_COLOR[k] || k }))
      .concat(mios.map((hex) => ({ id: hex.toLowerCase(), hex, name: 'Tuyo' })));
    const elegido = p.color || (C.state.grafOn && C.state.grafColor) || 'cherry';
    const hex = GR.COLORES[elegido] || elegido;
    const aMano = !colores.some((c) => c.id === elegido);
    return h('div', { class: 'pan-color' },
      h('div', { class: 'label', style: { margin: '12px 0 6px' } }, 'Color de la ventana'),
      h('div', { class: 'gr-colores', role: 'group', 'aria-label': 'Color de la ventana' },
        colores.map((c) => h('button', {
          type: 'button', class: 'gr-color' + (elegido === c.id ? ' on' : ''), 'aria-pressed': String(elegido === c.id), title: c.name,
          onClick: () => cambiar(p.id, { color: c.id }),
        }, h('i', { style: { background: c.hex } }), c.name)),
        h('label', { class: 'gr-color pan-color__otro' + (aMano ? ' on' : ''), title: 'Escoge cualquier color' },
          h('input', { type: 'color', value: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ff2d8a',
            onChange: (e) => cambiar(p.id, { color: String(e.target.value).toLowerCase() }) }), 'Otro'),
        aMano && C.misColores && h('button', { type: 'button', class: 'mis-colores__guardar', title: 'Guardar este color en Mis colores',
          onClick: () => C.misColores.agregar(hex) }, '+ Guardar color')));
  }

  function editor(l, lineas) {
    let p = lista().find((x) => x.id === C.state.pantallaAbierta);
    // se dibuja una sola vez: debajo de la línea donde EMPIEZA
    if (!p || !(Number(p.desde) >= l.desde && Number(p.desde) <= l.hasta)) return null;
    const s = subiendo[p.id];
    const ocupada = !!(s && !s.error);
    /* (24-sep) si se pidió una duración, el «hasta» sale de ella con el reloj de ESTE video */
    if (p.segundos) {
      const h2 = hastaPorDuracion(p, lineas, p.segundos);
      if (h2 !== Number(p.hasta)) { setTimeout(() => cambiar(p.id, { hasta: h2 }), 0); p = Object.assign({}, p, { hasta: h2 }); }
    }
    const d = duracion(p, lineas);
    // las últimas palabras que salen con la pantalla (puede terminar a mitad de una línea)
    const ultimas = d.ultima ? d.ultima.texto.split(' ').slice(0, Math.max(1, Number(p.hasta) - d.ultima.desde + 1)).slice(-3).join(' ') : '';
    const campo = (k, rotulo, ejemplo, max) => h('label', { class: 'pan-campo' },
      h('span', null, rotulo),
      h('input', { type: 'text', value: p[k] || '', placeholder: ejemplo, maxlength: String(max),
        onChange: (e) => cambiar(p.id, { [k]: e.target.value.slice(0, max) }) }));
    return h('div', { class: 'pan' },
      h('div', { class: 'pan-arriba' },
        p.tapa ? h('img', { class: 'pan-tapa', src: p.tapa, alt: '' }) : h('div', { class: 'pan-tapa pan-tapa--vacia' }, '▣'),
        h('div', { class: 'pan-estado' },
          h('div', { class: 'pan-estado__t js-pan-estado-' + p.id }, textoEstado(p))),
        h('button', { class: 'btn plano', type: 'button', disabled: ocupada ? 'disabled' : null, onClick: () => elegirArchivo(p.id) },
          p.url ? 'Cambiar' : 'Subir')),
      C.ui.chips(FORMAS, p.forma, (f) => cambiar(p.id, { forma: f }), { margin: '12px 0 4px' }),
      p.forma === 'profundo'
        ? h('div', { class: 'row__desc pan-nota' }, 'La ventana va arriba del todo, sin título. En la vista previa te tapa; en el video final tu cabeza y tu pelo quedan por delante.')
        : p.forma === 'invertida'
          ? h('div', { class: 'row__desc pan-nota' }, 'La ventana va arriba y tu video llena la mitad de abajo. Los subtítulos quedan entre los dos.')
          : h('div', { class: 'row__desc pan-nota' }, 'Tu video llena la mitad de arriba y la ventana va justo debajo.'),
      colorVentana(p),
      /* (24-sep) cuánto dura; Cherry la reparte por las líneas que siguen */
      h('div', { class: 'pan-dura' },
        h('label', { class: 'pan-seg' }, 'Dura ',
          h('input', { type: 'number', min: '1', max: '600', step: '0.5',
            value: String(p.segundos || Math.round(d.s * 10) / 10 || ''),
            onChange: (e) => {
              const v = Math.max(1, Math.min(600, Number(String(e.target.value).replace(',', '.')) || 0));
              if (!v) return;
              cambiar(p.id, { segundos: v, hasta: hastaPorDuracion(p, lineas, v) });
            } }), ' segundos'),
        h('span', null, 'Va por ' + d.n + (d.n === 1 ? ' línea' : ' líneas') +
          (ultimas ? ', hasta «' + ultimas + '»' : '') + ' · ' + seg(d.s))),
      /* (24-sep) sin etiqueta: ocupaba la franja entre tu video y la ventana. Título solo en «tú arriba» */
      h('div', { class: 'pan-campos' },
        p.forma === 'profundo' ? null : campo('titulo', 'Título (debajo de la ventana)', 'Así se ve tu panel', 60),
        campo('dir', 'Dirección (en la barra)', 'cherrysweet.app', 60)),
      h('div', { class: 'pan-pie' },
        h('button', { class: 'gu-b gu-b--no', type: 'button', onClick: () => quitar(p.id) }, 'Quitar pantalla'),
        h('button', { class: 'gu-b', type: 'button', onClick: () => C.setState({ pantallaAbierta: null }) }, 'Listo')));
  }

  /* ── Para la vista previa y el servidor ────────────────────────────────────────────────────── */
  const paraServidor = () => lista().filter(lista_).map((p) => ({
    id: p.id, desde: p.desde, hasta: p.hasta, forma: p.forma, url: p.url, tipo: p.tipo, tapa: p.tapa || '',
    ancho: p.ancho, alto: p.alto, dur: p.dur || 0, inicio: p.inicio || 0,
    titulo: p.titulo || '', etiqueta: p.etiqueta || '', dir: p.dir || '', color: p.color || '' }));

  C.pantallas = { cargar, mando, marca, editor, paraServidor, lista, FORMAS };
})();

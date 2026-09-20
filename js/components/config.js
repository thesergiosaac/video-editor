/* config.js — zona «configuración» (diseño "very sweet")
   Un solo módulo: tarjetas ⇄ detalle con ←. Primitivas C.ui.* + los paneles con TODOS los ajustes reales. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data, U = C.util;

  /* ---------------- Primitivas ---------------- */
  const ui = (C.ui = {
    label(t, style) { return h('div', { class: 'label', style: style || null }, t); },
    sublabel(t) { return h('div', { class: 'sublabel' }, t); },
    divider(style) { return h('div', { class: 'divider', style: style || null }); },
    gap(px) { return h('div', { style: { height: (px || 18) + 'px' } }); },

    chips(items, value, onSelect, style) {
      return h('div', { class: 'chips', style: style || null },
        items.map((it) => h('button', { class: 'chip' + (value === it.id ? ' chip--sel' : ''), onClick: () => onSelect(it.id) }, it.name))
      );
    },
    select(items, value, onChange, style) {
      return h('div', { class: 'select-wrap', style: style || null },
        h('select', { onChange: (e) => onChange(e.target.value) },
          items.map((it) => h('option', { value: it.id, selected: value === it.id ? 'selected' : null }, it.name))
        ),
        h('i', null, '▾')
      );
    },
    switch(on, onToggle) {
      return h('button', { class: 'switch' + (on ? ' switch--on' : ''), onClick: onToggle }, h('i'));
    },
    switchRow(title, desc, on, onToggle, style) {
      return h('div', { class: 'row', style: style || null },
        h('div', { style: { minWidth: '0' } },
          h('div', { class: 'row__title' }, title),
          desc && h('div', { class: 'row__desc' }, desc)
        ),
        ui.switch(on, onToggle)
      );
    },
    /* Deslizador: mientras se arrastra actualiza estado y etiqueta SIN redibujar; al soltar redibuja */
    slider({ key, label, labelFn, min = 0, max = 100, step = 1, style }) {
      const lab = 'js-lab-' + key;
      const fmt = labelFn || ((v) => String(v));
      return h('div', { style: style || null },
        h('div', { class: 'row' },
          h('span', { class: 'label', style: { marginBottom: '0' } }, label),
          h('span', { class: 'meta ' + lab }, fmt(C.state[key]))
        ),
        h('div', { style: { marginTop: '10px' } },
          h('input', {
            type: 'range', min, max, step, value: C.state[key],
            onInput: (e) => {
              const v = Number(e.target.value);
              C.state[key] = v;
              document.querySelectorAll('.' + lab).forEach((el) => (el.textContent = fmt(v)));
              // el celular muestra el cambio al instante, sin redibujar toda la app
              if (/^(simple|subsEscala|subsDy|subsDx)/.test(key) && C.subs) C.subs.alMover();
            },
            onChange: () => C.render(),
          })
        )
      );
    },
    swatches(value, onSelect) {
      return h('div', { class: 'swatches' },
        D.brandColors.map((c) => h('button', { class: 'swatch' + (value === c ? ' swatch--sel' : ''), style: { background: c }, onClick: () => onSelect(c) }))
      );
    },
    color(value, onChange) {
      return h('input', { type: 'color', class: 'color-in', value, onChange: (e) => onChange(e.target.value) });
    },
    colorRow(title, desc, value, onChange, style) {
      return h('div', { style: style || null },
        h('div', { class: 'row' },
          h('div', { style: { minWidth: '0' } },
            h('div', { class: 'row__title' }, title),
            desc && h('div', { class: 'row__desc' }, desc)
          ),
          ui.color(value, onChange)
        ),
        ui.misColores(value, onChange)
      );
    },
    /* «Mis colores» (18-sep, Sergio): guardar el color que se escogió y reusarlo en cualquier otro selector */
    misColores(value, onChange) {
      const M = C.misColores, lista = M ? M.lista() : [];
      const actual = String(value || '').toLowerCase();
      return h('div', { class: 'mis-colores' },
        lista.map((c) => h('span', { class: 'mis-colores__item' },
          h('button', { class: 'mis-colores__c' + (c === actual ? ' mis-colores__c--sel' : ''), style: { background: c }, title: 'Usar ' + c, onClick: () => onChange(c) }),
          h('button', { class: 'mis-colores__x', title: 'Quitar de Mis colores', onClick: () => M.quitar(c) }, '×')
        )),
        M && /^#[0-9a-f]{6}$/.test(actual) && !lista.includes(actual) &&
          h('button', { class: 'mis-colores__guardar', title: 'Guardar este color en Mis colores', onClick: () => M.agregar(actual) }, '+ Guardar color')
      );
    },
    cards(items, value, onSelect, swatchFn) {
      return h('div', { class: 'cards' },
        items.map((it) =>
          h('div', { class: 'card' + (value === it.id ? ' card--sel' : ''), onClick: () => onSelect(it.id) },
            swatchFn && swatchFn(it),
            h('div', { class: 'card__title' }, it.name),
            it.desc && h('div', { class: 'card__desc' }, it.desc),
            h('div', { class: 'card__check' }, '✓')
          )
        )
      );
    },
    section(t) { return h('div', { class: 'section' }, h('span', null, t), h('i')); },

    /* Pestañas de un módulo (18-sep): «qué quiero cambiar». `lista` = [{ id, name }]; recuerda la elegida por módulo */
    pestanas(modulo, lista) {
      const activa = pestanaDe(modulo, lista);
      return h('div', { class: 'pestanas' },
        lista.map((p) => h('button', {
          class: 'pestana' + (p.id === activa ? ' pestana--sel' : ''),
          onClick: () => C.setState({ pestanas: Object.assign({}, C.state.pestanas, { [modulo]: p.id }) }),
        }, p.name))
      );
    },
    /* Grupo plegable con el resumen de lo elegido: cerrado se ve la configuración sin abrir nada; uno abierto a la vez */
    grupo(modulo, id, titulo, resumen, cuerpo) {
      const abierto = (C.state.grupos || {})[modulo] === id;
      return h('div', { class: 'grupo' + (abierto ? ' grupo--abierto' : '') },
        h('button', {
          class: 'grupo__cabeza',
          onClick: () => C.setState({ grupos: Object.assign({}, C.state.grupos, { [modulo]: abierto ? null : id }) }),
        },
          h('span', { class: 'grupo__titulo' }, titulo),
          h('span', { class: 'grupo__resumen' }, resumen),
          h('span', { class: 'grupo__flecha' }, abierto ? '▴' : '▾')
        ),
        abierto && h('div', { class: 'grupo__cuerpo' }, typeof cuerpo === 'function' ? cuerpo() : cuerpo)
      );
    },
    /* Circulito de color para los resúmenes */
    punto(c) { return h('span', { class: 'grupo__punto', style: { background: c } }); },
  });
  /* La pestaña activa de un módulo; si ya no aplica (p. ej. «Plantilla» con «A tu gusto»), la primera */
  function pestanaDe(modulo, lista) {
    const quiere = (C.state.pestanas || {})[modulo];
    return lista.some((p) => p.id === quiere) ? quiere : lista[0].id;
  }


  /* ── «Mis colores» (18-sep): en la cuenta (tabla preferencias_usuario) y copia en este navegador. Si la tabla aún no
     existe, quedan solo en el navegador; cuando exista, lo guardado aquí se sube solo. ── */
  C.misColores = (function () {
    const LLAVE = 'cherry-mis-colores', MAX = 16;
    const valido = (c) => /^#[0-9a-f]{6}$/.test(c);
    let lista = [], enCuenta = false;
    try { lista = (JSON.parse(localStorage.getItem(LLAVE) || '[]') || []).map((c) => String(c).toLowerCase()).filter(valido).slice(0, MAX); } catch (_) {}
    const guardarAqui = () => { try { localStorage.setItem(LLAVE, JSON.stringify(lista)); } catch (_) {} };
    const subir = () => { if (enCuenta && C.api.guardarPreferencias) C.api.guardarPreferencias({ colores: lista }).catch(() => null); };
    async function cargar() {
      if (!C.api || !C.api.getPreferencias || !C.session.user) return;
      try {
        const filas = await C.api.getPreferencias();
        if (!filas) return;                                   // la tabla todavía no existe: se queda en el navegador
        enCuenta = true;
        const nube = ((filas[0] && filas[0].colores) || []).map((c) => String(c).toLowerCase()).filter(valido);
        const juntos = nube.concat(lista.filter((c) => !nube.includes(c))).slice(0, MAX);
        const cambio = juntos.length !== lista.length || juntos.some((c, i) => c !== lista[i]);
        lista = juntos; guardarAqui();
        if (juntos.length !== nube.length) subir();            // lo que solo estaba en este navegador sube a la cuenta
        if (cambio && C.render) C.render();
      } catch (_) {}
    }
    if (C.onApiReady) C.onApiReady.push(cargar);
    return {
      lista: () => lista,
      agregar(c) { c = String(c).toLowerCase(); if (!valido(c)) return; lista = [c].concat(lista.filter((x) => x !== c)).slice(0, MAX); guardarAqui(); subir(); if (C.render) C.render(); },
      quitar(c) { lista = lista.filter((x) => x !== c); guardarAqui(); subir(); if (C.render) C.render(); },
      cargar,
    };
  })();

  const set = (key) => (v) => C.setState({ [key]: v });
  const flip = (key) => () => C.toggle(key);

  /* «A tu gusto»: subtítulo simple, sin animaciones en medio (mismos datos que usa el servidor) */
  /* «A tu gusto» en grupos (18-sep): Letra · Color, borde y sombra · Palabra resaltada · Posición y animación */
  function panelSimple(s) {
    const S = C.subs;
    // Al tocar un control de «a tu gusto», el celular muestra solo frases normales para ver exactamente eso
    const set = (key) => (v) => C.setState({ [key]: v, previaEnfoque: 'simple' });
    const flip = (key) => () => C.setState({ [key]: !C.state[key], previaEnfoque: 'simple' });
    const letra = (S.LETRAS.find((l) => l.id === s.simpleLetra) || S.LETRAS[0]).name;
    const nom = (lista, id) => ((lista.find((x) => x.id === id) || {}).name || '').toLowerCase();
    const resumenLetra = [letra, Math.round(s.simpleCq * 10.8) + ' px', s.simpleMayus && 'mayúsculas', s.simpleItalica && 'inclinada',
      Math.abs((Number(s.simpleAlto) || 1.2) - 1.2) > 0.001 && 'interlineado ' + Math.round((s.simpleAlto / 1.2) * 100) + '%',
      Number(s.simpleEsp) && 'interletrado ' + (s.simpleEsp > 0 ? '+' : '−') + Math.round(Math.abs(s.simpleEsp) * 100)].filter(Boolean).join(' · ');
    return C.frag(
      S.modoImpacto(s) && h('div', { class: 'row__desc', style: { marginBottom: '12px' } },
        'Así salen las frases normales; las de impacto llevan la plantilla ' + S.nombre(s.subsPlantilla) + '.'),
      ui.grupo('texto', 'letra', 'Letra', resumenLetra, () => C.frag(
        ui.label('Letra'),
        ui.select(S.LETRAS, s.simpleLetra, set('simpleLetra'), { marginBottom: '16px' }),
        ui.slider({ key: 'simpleCq', label: 'Tamaño', min: 4, max: 10, step: 0.2, labelFn: (v) => Math.round(v * 10.8) + 'px', style: { marginBottom: '16px' } }),
        /* 18-sep (Sergio): espacio entre renglones y entre letras */
        ui.slider({ key: 'simpleAlto', label: 'Interlineado · entre renglones', min: 0.8, max: 2, step: 0.05,
          labelFn: (v) => (Math.abs(v - 1.2) < 0.001 ? 'Normal' : Math.round((v / 1.2) * 100) + '%'), style: { marginBottom: '16px' } }),
        ui.slider({ key: 'simpleEsp', label: 'Interletrado · entre letras', min: -0.05, max: 0.25, step: 0.01,
          labelFn: (v) => (Math.abs(v) < 0.001 ? 'Normal' : (v > 0 ? '+' : '−') + Math.round(Math.abs(v) * 100)), style: { marginBottom: '16px' } }),
        ui.switchRow('Mayúsculas', null, s.simpleMayus, flip('simpleMayus'), { marginBottom: '12px' }),
        ui.switchRow('Inclinada', 'La letra queda en cursiva', s.simpleItalica, flip('simpleItalica'))
      )),
      ui.grupo('texto', 'color', 'Color, borde y sombra',
        h('span', null, ui.punto(s.simpleColor), (s.simpleBorde ? ' con borde' : ' sin borde') + (s.simpleSombra ? ' · sombra' : '')), () => C.frag(
        ui.colorRow('Color del texto', null, s.simpleColor, set('simpleColor'), { marginBottom: '12px' }),
        ui.switchRow('Borde', 'Contorno alrededor de las letras', s.simpleBorde, flip('simpleBorde'), { marginBottom: '12px' }),
        s.simpleBorde && ui.colorRow('Color del borde', null, s.simpleBordeColor, set('simpleBordeColor'), { marginBottom: '12px' }),
        s.simpleBorde && s.simpleColor.toLowerCase() === s.simpleBordeColor.toLowerCase() &&
          h('div', { class: 'aviso' }, '⚠ Texto y borde son el mismo color: el borde no se va a notar.'),
        s.simpleBorde && ui.slider({ key: 'simpleBordeCq', label: 'Grosor del borde', min: 0.2, max: 1.5, step: 0.1, labelFn: (v) => Math.round(v * 10.8) + 'px', style: { marginBottom: '16px' } }),
        ui.switchRow('Sombra suave', 'Ayuda a leer sobre fondos claros', s.simpleSombra, flip('simpleSombra'))
      )),
      /* Palabra resaltada: la clave que ya marca la IA, pintada como quiera la persona */
      ui.grupo('texto', 'clave', 'Palabra resaltada',
        s.simpleClaveOn ? h('span', null, nom(C.subs.CADAS, s.simpleClaveCada) + ' · ', ui.punto(s.simpleClaveColor)) : 'Apagada', () => C.frag(
        ui.switchRow('Resaltar una palabra', 'La palabra clave de la frase, con su propio estilo',
          s.simpleClaveOn, flip('simpleClaveOn'), { marginBottom: s.simpleClaveOn ? '12px' : '0' }),
        s.simpleClaveOn && C.frag(
          ui.label('¿En cuántas frases?'),
          ui.chips(C.subs.CADAS, s.simpleClaveCada, set('simpleClaveCada'), { marginBottom: '12px' }),
          ui.colorRow('Color de la palabra', null, s.simpleClaveColor, set('simpleClaveColor'), { marginBottom: '10px' }),
          ui.swatches(s.simpleClaveColor, set('simpleClaveColor')),
          ui.slider({ key: 'simpleClaveEscala', label: 'Tamaño de la palabra', min: 0.6, max: 2, step: 0.05,
            labelFn: (v) => Math.round(v * 100) + '%', style: { margin: '12px 0 14px' } }),
          ui.label('Letra de la palabra'),
          ui.select([{ id: '', name: 'La misma de la frase' }].concat(C.subs.LETRAS), s.simpleClaveLetra, set('simpleClaveLetra'), { marginBottom: '12px' }),
          ui.switchRow('Negrilla', null, s.simpleClaveNegrilla, flip('simpleClaveNegrilla'), { marginBottom: '10px' }),
          ui.switchRow('Inclinada', null, s.simpleClaveItalica, flip('simpleClaveItalica'), { marginBottom: '10px' }),
          ui.switchRow('Subrayada', null, s.simpleClaveSubrayado, flip('simpleClaveSubrayado'))
        )
      )),
      ui.grupo('texto', 'posicion', 'Posición y animación',
        [nom(S.POSICIONES, s.simplePos), 'entra ' + nom(S.ENTRADAS, s.simpleEntrada), 'sale ' + nom(S.SALIDAS, s.simpleSalida)].join(' · '), () => C.frag(
        ui.label('Posición'),
        ui.chips(S.POSICIONES, s.simplePos, set('simplePos'), { marginBottom: '16px' }),
        ui.label('Animación de entrada'),
        ui.chips(S.ENTRADAS, s.simpleEntrada, set('simpleEntrada'), { marginBottom: '16px' }),
        ui.label('Animación de salida'),
        ui.chips(S.SALIDAS, s.simpleSalida, set('simpleSalida'))
      ))
    );
  }

  /* Colores propios de la plantilla (18-sep, Sergio): el blanco y el rojo de Contraste, el oro de Dorado… cada plantilla
     recuerda los suyos; «Volver a los originales» los quita. Viajan al video (simple.colores). */
  function panelColoresPlantilla(s) {
    const pl = s.subsPlantilla || 'editorial';
    const base = C.subs.COLORES_BASE && C.subs.COLORES_BASE[pl];
    if (!base) return null;
    const mios = (s.subsColores || {})[pl] || {};
    const poner = (parte) => (v) => C.setState({
      subsColores: Object.assign({}, s.subsColores, { [pl]: Object.assign({}, mios, { [parte]: v }) }), previaEnfoque: null,
    });
    return C.frag(
      ui.colorRow('Color del texto', null, (mios.texto || base.texto).toLowerCase(), poner('texto'), { marginBottom: '12px' }),
      base.acento && ui.colorRow('Color de la palabra clave', null, (mios.acento || base.acento).toLowerCase(), poner('acento'), { marginBottom: '12px' }),
      Object.keys(mios).length > 0 && h('button', {
        class: 'btn btn--ghost', style: { padding: '9px' },
        onClick: () => { const o = Object.assign({}, s.subsColores); delete o[pl]; C.setState({ subsColores: o }); },
      }, 'Volver a los colores originales')
    );
  }

  /* ---------------- Paneles ---------------- */
  const P = {};

  /* Edición en pestañas (18-sep, Sergio): Color · Formato y ritmo */
  P.edicion = function () {
    const s = C.state;
    const lista = [{ id: 'color', name: 'Color' }, { id: 'formato', name: 'Formato y ritmo' }, { id: 'escenas', name: 'Escenas' }, { id: 'graficos', name: 'Gráficos' }];
    const tab = pestanaDe('edicion', lista);
    const preset = D.presets.find((p) => p.id === s.style);
    const modo = D.editModes.find((m) => m.id === s.editMode);
    const aspecto = D.aspects.find((a) => a.id === s.aspect);
    const formato = () => C.frag(
      ui.grupo('edicion', 'formato', 'Formato', aspecto ? aspecto.ratio : '', () =>
        h('div', { class: 'chips' },
          D.aspects.map((a) => {
            const sel = s.aspect === a.id;
            return h('button', { class: 'chip' + (sel ? ' chip--sel' : ''), style: { display: 'flex', alignItems: 'center', gap: '8px' }, onClick: () => C.setState({ aspect: a.id }) },
              h('span', { style: { width: a.w + 'px', height: a.h + 'px', flex: 'none', borderRadius: '3px', border: '2px solid ' + (sel ? 'var(--bg)' : 'rgba(247,233,224,.5)') } }),
              h('span', { style: { fontWeight: '800' } }, a.ratio)
            );
          })
        )),
      ui.grupo('edicion', 'modo', 'Modo', modo ? modo.name : '', () => ui.cards(D.editModes, s.editMode, set('editMode'))),
      ui.grupo('edicion', 'ritmo', 'Ritmo y cortes', U.pacingLabel(s.pacing) + ' · aire ' + U.aireLabel(s.aire).toLowerCase(), () => C.frag(
        h('div', { class: 'row__desc', style: { marginBottom: '12px' } }, 'Cambiar esto vuelve a cortar el video (se regenera completo).'),
        ui.slider({ key: 'pacing', label: 'Ritmo', labelFn: U.pacingLabel, style: { marginBottom: '18px' } }),
        /* 19-sep (Sergio): el aire va en segundos y se mide con el silencio real de tu audio */
        ui.slider({ key: 'aire', label: 'Aire entre cortes', min: 0, max: 0.5, step: 0.02, labelFn: U.aireLabel, style: { marginBottom: '8px' } }),
        h('div', { class: 'row__desc', style: { marginBottom: '18px' } },
          s.aire < 0.01 ? 'Pegado: cada corte empieza justo donde empiezas a hablar y acaba cuando terminas.'
            : 'Deja ' + U.aireLabel(s.aire).split('· ')[1] + ' de silencio a cada lado de cada corte.'),
        ui.slider({ key: 'clipGap', label: 'Eliminar silencios largos', labelFn: U.clipGapLabel })
      )),
      ui.grupo('edicion', 'estilo', 'Estilo', preset ? preset.name : '', () =>
        ui.cards(D.presets, s.style, set('style'), (p) =>
          h('div', { class: 'card__swatch', style: { boxShadow: 'inset 10px 0 0 ' + p.c1 + ', inset -10px 0 0 ' + p.c2 } })))
    );
    return C.frag(
      ui.pestanas('edicion', lista),
      /* Color (18-sep): va dentro de Edición, no como tarjeta aparte — lo pidió Sergio */
      tab === 'color' && seccionColor(),
      tab === 'formato' && formato(),
      tab === 'escenas' && seccionEscenas(),
      tab === 'graficos' && seccionGraficos()
    );
  };

  /* Escenas de apoyo (19-sep): la persona solo dice si las quiere y cuántas; Cherry escoge dónde y cuál */
  const CANTIDADES = [
    { id: 'pocas', name: 'Pocas', d: 'una cada ~18 s, solo las que más se prestan' },
    { id: 'medio', name: 'Medio', d: 'una cada ~11 s' },
    { id: 'muchas', name: 'Muchas', d: 'una cada ~7 s' },
  ];
  function seccionEscenas() {
    const s = C.state;
    const lista = C.apoyoVivo ? C.apoyoVivo.lista() : null;
    const cant = CANTIDADES.find((c) => c.id === (s.escenasCantidad || 'medio')) || CANTIDADES[1];
    const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    return C.frag(
      ui.switchRow('Escenas de apoyo', 'Cherry pone escenas de la biblioteca donde lo que dices se presta para ilustrarlo. Tu voz sigue sonando y los subtítulos quedan encima.',
        !!s.escenasOn, () => C.setState({ escenasOn: !s.escenasOn }), { marginBottom: '16px' }),
      s.escenasOn && C.frag(
        ui.label('Cuántas'),
        ui.chips(CANTIDADES, cant.id, set('escenasCantidad'), { marginBottom: '8px' }),
        h('div', { class: 'row__desc', style: { marginBottom: '16px' } }, cant.name + ': ' + cant.d + '. Nunca en los primeros 2 segundos ni dos muy seguidas.'),
        lista == null
          ? h('div', { class: 'row__desc' }, 'Las escenas se escogen cuando tu video está cortado: las verás en el celular.')
          : !lista.length
            ? h('div', { class: 'row__desc' }, 'En este video no hay momentos que se presten con esta cantidad. Prueba con más.')
            : h('div', { class: 'ap-lista' },
                h('div', { class: 'label', style: { marginBottom: '8px' } }, 'En tu video (' + lista.length + ')'),
                lista.map((a) => h('div', { class: 'ap-item' },
                  h('span', { class: 'ap-item__t mono' }, mmss(a.t0)),
                  h('span', { class: 'ap-item__txt' }, a.texto || a.busqueda))))
      )
    );
  }

  /* Gráficos (19-sep): la persona dice si los quiere, cuántos y de qué color; Cherry escoge dónde y cuál */
  const CANT_GRAF = [
    { id: 'pocos', name: 'Pocos', d: 'uno cada ~26 s, solo los datos más fuertes' },
    { id: 'medio', name: 'Medio', d: 'uno cada ~15 s' },
    { id: 'muchos', name: 'Muchos', d: 'uno cada ~9 s' },
  ];
  const NOMBRE_COLOR = { cherry: 'Cherry', dorado: 'Dorado', oceano: 'Océano', lima: 'Lima', coral: 'Coral', lila: 'Lila', crema: 'Crema' };
  const ESTILOS_GRAF = [
    { id: 'clasico', name: 'Clásico', d: 'limpio y directo, con tus colores' },
    { id: 'premium', name: 'Premium', d: 'vidrio de verdad, números que ruedan, chispas y más movimiento' },
  ];
  function seccionGraficos() {
    const s = C.state, GR = window.CherryGraf;
    if (!GR) return h('div', { class: 'row__desc' }, 'Los gráficos no cargaron. Recarga la página.');
    const lista = C.grafVivo ? C.grafVivo.lista() : null;
    const cant = CANT_GRAF.find((c) => c.id === (s.grafCantidad || 'medio')) || CANT_GRAF[1];
    const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    const mios = ((C.misColores && C.misColores.lista()) || []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 4);
    const colores = Object.keys(GR.COLORES).map((k) => ({ id: k, hex: GR.COLORES[k], name: NOMBRE_COLOR[k] || k }))
      .concat(mios.map((hex) => ({ id: hex, hex, name: 'Tuyo' })));
    const elegido = s.grafColor || 'cherry';
    return C.frag(
      ui.switchRow('Gráficos', 'Cuando dices una cifra, un porcentaje, una lista, un ranking, un antes y después, un reparto, un rango, fechas o una cita, Cherry pone un gráfico animado justo en ese momento. Los subtítulos quedan encima.',
        !!s.grafOn, () => C.setState({ grafOn: !s.grafOn }), { marginBottom: '16px' }),
      s.grafOn && C.frag(
        ui.label('Cuántos'),
        ui.chips(CANT_GRAF, cant.id, set('grafCantidad'), { marginBottom: '8px' }),
        h('div', { class: 'row__desc', style: { marginBottom: '16px' } }, cant.name + ': ' + cant.d + '. Nunca encima de una escena de apoyo.'),
        ui.label('Estilo'),
        ui.chips(ESTILOS_GRAF, s.grafEstilo === 'premium' ? 'premium' : 'clasico', set('grafEstilo'), { marginBottom: '8px' }),
        h('div', { class: 'row__desc', style: { marginBottom: '16px' } },
          (s.grafEstilo === 'premium' ? 'Premium: ' : 'Clásico: ') + (ESTILOS_GRAF.find((e) => e.id === (s.grafEstilo || 'clasico')) || ESTILOS_GRAF[0]).d +
          (s.grafEstilo === 'premium' ? '. Los dibuja Remotion en la nube: el video tarda un poco más.' : '.')),
        ui.label('Color'),
        h('div', { class: 'gr-colores', role: 'group', 'aria-label': 'Color de los gráficos' }, colores.map((c) => h('button', {
          type: 'button', class: 'gr-color' + (elegido === c.id ? ' on' : ''), 'aria-pressed': String(elegido === c.id), title: c.name,
          onClick: () => C.setState({ grafColor: c.id }),
        }, h('i', { style: { background: c.hex } }), c.name))),
        lista == null
          ? h('div', { class: 'row__desc' }, 'Los gráficos se escogen cuando tu video está cortado: los verás en el celular.')
          : !lista.length
            ? h('div', { class: 'row__desc' }, 'En este video no hay datos para graficar con esta cantidad. Prueba con más, o habla de cifras, listas o fechas.')
            : h('div', { class: 'ap-lista' },
                h('div', { class: 'label', style: { marginBottom: '8px' } }, 'En tu video (' + lista.length + ')'),
                lista.map((p) => {
                  const i = indiceMomento(p);
                  const marcado = (s.grafCambiar || []).indexOf(i) >= 0;
                  return h('label', { class: 'ap-item gr-item' + (marcado ? ' gr-item--marcado' : '') },
                    h('input', { type: 'checkbox', class: 'gr-item__chk', checked: marcado, disabled: i < 0,
                      onChange: () => alternarCambiar(i) }),
                    h('span', { class: 'ap-item__t mono' }, mmss(p.t0)),
                    h('span', { class: 'ap-item__txt' }, h('b', { class: 'gr-item__tipo' }, GR.NOMBRES[p.tipo] || p.tipo), ' · ' + GR.resumen(p)));
                }),
                botonesRegenerar(s, lista))
      )
    );
  }

  /* ══ Regenerar gráficos (20-sep) ══ La IA no da lo mismo dos veces: con la MISMA petición marca de 3 a
     5 momentos, y en sitios distintos. Medido. Por eso se puede volver a pedir — enteros, o quedándose
     con los que gustaron y cambiando solo el resto. */
  function indiceMomento(p) {
    const ms = (C.grafVivo && C.grafVivo.momentos && C.grafVivo.momentos()) || [];
    return ms.findIndex((m) => Number(m.desde) === Number(p.desde) && m.tipo === p.tipo);
  }
  function alternarCambiar(i) {
    if (i < 0) return;
    const hoy = C.state.grafCambiar || [];
    C.setState({ grafCambiar: hoy.indexOf(i) >= 0 ? hoy.filter((x) => x !== i) : hoy.concat([i]) });
  }
  async function pedirOtros(soloMarcados) {
    const id = C.cortesVivo && C.cortesVivo.idBase ? C.cortesVivo.idBase() : null;
    const render = id || C.state.renderId;
    if (!render) { C.setState({ grafAviso: 'Espera a que tu video esté cortado.' }); return; }
    const ms = (C.grafVivo && C.grafVivo.momentos && C.grafVivo.momentos()) || [];
    const cambiar = C.state.grafCambiar || [];
    // se QUEDAN los que no están marcados para cambiar
    const quedan = soloMarcados ? ms.map((_, i) => i).filter((i) => cambiar.indexOf(i) < 0) : [];
    C.setState({ grafPidiendo: true, grafAviso: '' });
    try {
      const r = await C.api.regenerarGraficos(render, quedan);
      if (!r || !r.graficos) throw new Error((r && r.error) || 'sin respuesta');
      if (C.cortesVivo && C.cortesVivo.ponerGraficos) C.cortesVivo.ponerGraficos(r.graficos);
      if (C.grafVivo && C.grafVivo.refrescar) C.grafVivo.refrescar(r.graficos);
      C.setState({ grafPidiendo: false, grafCambiar: [],
        grafAviso: r.graficos.momentos.length + ' gráficos nuevos. Si no te convencen, vuelve a pedirlos.' });
    } catch (e) {
      console.warn('[Gráficos] no se pudieron regenerar', e);
      C.setState({ grafPidiendo: false, grafAviso: 'No se pudieron cambiar. Inténtalo otra vez.' });
    }
  }
  function botonesRegenerar(s, lista) {
    const marcados = (s.grafCambiar || []).length;
    if (s.grafPidiendo) {
      return h('div', { class: 'gr-regen' },
        h('span', { class: 'row__desc' }, h('span', { class: 'spinner' }), ' Buscando otros gráficos…'));
    }
    return h('div', { class: 'gr-regen' },
      h('button', { class: 'btn plano', type: 'button', onClick: () => pedirOtros(false),
        title: 'Cherry marca otra vez todo el video: saldrán otros gráficos' }, 'Cambiar todos'),
      marcados
        ? h('button', { class: 'btn plano gr-regen__solo', type: 'button', onClick: () => pedirOtros(true),
            title: 'Deja los que no marcaste y busca otros para los marcados' },
            'Cambiar ' + marcados + (marcados === 1 ? ' marcado' : ' marcados'))
        : h('span', { class: 'row__desc gr-regen__pista' }, 'Marca los que no te gusten para cambiar solo esos.'),
      s.grafAviso ? h('div', { class: 'row__desc gr-regen__aviso' }, s.grafAviso) : null);
  }

  /* ══ GUION (20-sep, idea de Sergio) ══ «usar la parte que dice guion... ahí puede pasar la
     transcripción exacta con tiempos... desde ahí podríamos controlar todo».
     Fase 1: VER. La transcripción de lo que dijo, con su minuto y con lo que Cherry puso en cada línea.
     Ya con esto se entiende de un vistazo por qué el video quedó como quedó. */
  P.guion = function () {
    const s = C.state;
    const lineas = C.cortesVivo && C.cortesVivo.guion ? C.cortesVivo.guion() : null;
    const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    const GR = window.CherryGraf;

    if (!lineas) {
      return h('div', { class: 'gu' },
        h('div', { class: 'row__desc' },
          s.scriptText
            ? 'Este es el guion que escribiste. Cuando Cherry corte tu video, aquí verás lo que dijiste de verdad, línea por línea, con lo que puso en cada momento.'
            : 'Aquí verás lo que dices en tu video, línea por línea, con lo que Cherry puso en cada momento. Aparece cuando tu video está cortado.'),
        s.scriptText ? h('div', { class: 'gu-escrito' }, h('div', { class: 'label' }, 'Lo que escribiste'), h('p', null, s.scriptText)) : null);
    }

    const conGraf = lineas.filter((l) => l.graficos.length).length;
    const conEsc = lineas.filter((l) => l.escenas).length;
    const conImp = lineas.filter((l) => l.impacto).length;

    return h('div', { class: 'gu' },
      h('div', { class: 'row__desc', style: { marginBottom: '14px' } },
        'Lo que dices en tu video, línea por línea. Al lado, lo que Cherry puso en cada momento.'),
      h('div', { class: 'gu-resumen' },
        h('span', null, h('i', { class: 'gu-p gu-p--g' }), conGraf + ' con gráfico'),
        h('span', null, h('i', { class: 'gu-p gu-p--e' }), conEsc + ' con escena'),
        h('span', null, h('i', { class: 'gu-p gu-p--i' }), conImp + ' resaltadas')),
      h('div', { class: 'gu-lista' }, lineas.map((l) => h('div', { class: 'gu-l' + (l.graficos.length || l.escenas || l.impacto ? ' gu-l--con' : '') },
        h('span', { class: 'gu-t mono' }, mmss(l.t0)),
        h('span', { class: 'gu-x' },
          h('span', { class: 'gu-txt' }, l.texto),
          h('span', { class: 'gu-marcas' },
            l.graficos.map((t) => h('span', { class: 'gu-m gu-m--g' }, (GR && GR.NOMBRES[t]) || t)),
            l.escenas ? h('span', { class: 'gu-m gu-m--e' }, l.escenas > 1 ? l.escenas + ' escenas' : 'Escena') : null,
            l.impacto ? h('span', { class: 'gu-m gu-m--i' }, 'Resaltada') : null),
          h('span', { class: 'gu-mandos' }, mando(l, 'graficos', 'Gráfico'), mando(l, 'escenas', 'Escena')))))),
      h('div', { class: 'row__desc gu-pie' },
        'Toca «Gráfico» o «Escena» en una línea para fijar que ahí SÍ va, o para quitarlo. '
        + 'Lo que fijes manda sobre lo que decide Cherry, y va aparte del nivel que elegiste.'));
  };

  /* Los tres estados de cada mando: Cherry decide · aquí sí · aquí no. Se guarda por números de
     palabra (no por número de línea) para que aguante si cambian los cortes. */
  function estadoFijo(que, l) {
    const f = (C.state.guionFijos || {})[que] || {};
    const toca = (z) => Number(z.desde) <= l.hasta && Number(z.hasta) >= l.desde;
    if ((f.si || []).some(toca)) return 'si';
    if ((f.no || []).some(toca)) return 'no';
    return 'auto';
  }
  function fijar(que, l) {
    const todo = Object.assign({}, C.state.guionFijos || {});
    const f = Object.assign({ si: [], no: [] }, todo[que] || {});
    const fuera = (lista) => (lista || []).filter((z) => !(Number(z.desde) <= l.hasta && Number(z.hasta) >= l.desde));
    const ahora = estadoFijo(que, l);
    const zona = { desde: l.desde, hasta: l.hasta };
    // auto → sí → no → auto
    if (ahora === 'auto') { f.si = fuera(f.si).concat([zona]); f.no = fuera(f.no); }
    else if (ahora === 'si') { f.si = fuera(f.si); f.no = fuera(f.no).concat([zona]); }
    else { f.si = fuera(f.si); f.no = fuera(f.no); }
    todo[que] = f;
    C.setState({ guionFijos: todo });
  }
  function mando(l, que, nombre) {
    const e = estadoFijo(que, l);
    const titulo = e === 'si' ? 'Aquí va sí o sí. Toca otra vez para quitarlo.'
      : e === 'no' ? 'Aquí no va nada. Toca otra vez para que decida Cherry.'
      : 'Lo decide Cherry. Toca para fijar que aquí sí va.';
    return h('button', { class: 'gu-b gu-b--' + e, type: 'button', title: titulo,
      onClick: (ev) => { ev.preventDefault(); fijar(que, l); } },
      h('span', { class: 'gu-b__i' }, e === 'si' ? '✓' : e === 'no' ? '✕' : '·'), nombre);
  }

  /* Texto en pestañas (18-sep, Sergio): Estilo · Plantilla · A tu gusto · General; cada una con grupos plegables */
  P.texto = function () {
    const s = C.state, S = C.subs;
    const pl = s.subsPlantilla || 'editorial';
    const conPlantilla = pl !== 'simple' && pl !== 'ninguno';
    const conSimple = pl === 'simple' || S.modoImpacto(s);
    const lista = [{ id: 'estilo', name: 'Estilo' }]
      .concat(conPlantilla ? [{ id: 'plantilla', name: 'Plantilla' }] : [])
      .concat(conSimple ? [{ id: 'gusto', name: 'A tu gusto' }] : [])
      .concat([{ id: 'general', name: 'General' }]);
    const tab = pestanaDe('texto', lista);
    const conSigno = (v, menos, mas, cero) => (v === 0 ? cero : (v < 0 ? menos + ' ' : mas + ' ') + Math.abs(v));
    const base = (S.COLORES_BASE || {})[pl] || {}, mios = (s.subsColores || {})[pl] || {};

    const estilo = () => C.frag(
      ui.label('Estilo de subtítulos'),
      S.galeria(s),
      h('button', {
        class: 'btn ' + (s.typographyPreview ? 'btn--accent' : 'btn--ghost'), style: { margin: '14px 0 12px' },
        onClick: () => C.setState({ typographyPreview: !s.typographyPreview }),
      }, s.typographyPreview ? '▶ Ver mi video en el celular' : '👁 Ver la vista previa en el celular'),
      conPlantilla && ui.grupo('texto', 'donde', '¿Dónde usar la plantilla?',
        s.subsModo === 'impacto' ? 'Solo frases de impacto · ' + ((S.IMPACTOS.find((x) => x.id === s.subsImpacto) || {}).name || '').split(' ·')[0].toLowerCase() : 'En todo el video',
        () => C.frag(
          ui.chips(S.MODOS, s.subsModo, set('subsModo'), { marginBottom: s.subsModo === 'impacto' ? '12px' : '0' }),
          s.subsModo === 'impacto' && C.frag(
            ui.label('¿Cuántas frases de impacto?'),
            ui.chips(S.IMPACTOS, s.subsImpacto, set('subsImpacto'), { marginBottom: '10px' }),
            h('div', { class: 'row__desc' },
              'La IA escoge las frases más llamativas (el gancho, cifras, afirmaciones fuertes) para la plantilla ' +
              S.nombre(pl) + '. Las demás salen con tu estilo «A tu gusto».')
          )
        ))
    );

    const plantilla = () => C.frag(
      ui.grupo('texto', 'tam', 'Tamaño y posición',
        [Math.round((Number(s.subsEscala) || 1) * 100) + ' %', conSigno(Number(s.subsDy) || 0, 'arriba', 'abajo', 'altura normal'),
          conSigno(Number(s.subsDx) || 0, 'izquierda', 'derecha', 'centrado')].join(' · '),
        () => C.frag(
          /* Tamaño y posición de la plantilla: se ven en el celular al instante y viajan al video */
          ui.slider({ key: 'subsEscala', label: 'Tamaño', min: 0.7, max: 1.5, step: 0.05,
            labelFn: (v) => Math.round(v * 100) + '%', style: { marginBottom: '14px' } }),
          ui.slider({ key: 'subsDy', label: 'Arriba / abajo', min: -45, max: 45, step: 1,
            labelFn: (v) => (v === 0 ? 'Como viene' : (v < 0 ? 'Arriba ' : 'Abajo ') + Math.abs(v)), style: { marginBottom: '14px' } }),
          ui.slider({ key: 'subsDx', label: 'Izquierda / derecha', min: -35, max: 35, step: 1,
            labelFn: (v) => (v === 0 ? 'Centrado' : (v < 0 ? 'Izquierda ' : 'Derecha ') + Math.abs(v)) })
        )),
      base.texto && ui.grupo('texto', 'colores', 'Colores',
        h('span', null, 'texto ', ui.punto(mios.texto || base.texto), base.acento ? ' · clave ' : '', base.acento ? ui.punto(mios.acento || base.acento) : null),
        () => panelColoresPlantilla(s))
    );

    const general = () => C.frag(
      /* 18-sep (Sergio): que nada quede debajo de los iconos de las redes */
      ui.switchRow('Zona segura', 'Ningún subtítulo queda debajo de los botones de Instagram, TikTok o YouTube',
        s.subsZona, flip('subsZona'), { marginBottom: '14px' }),
      h('button', { class: 'btn btn--amber', style: { marginBottom: '14px' }, onClick: () => C.setState({ scriptOpen: true }) }, '✎ Abrir editor de guión'),
      h('div', { class: 'row__desc' },
        'La IA escoge la palabra clave de cada frase y corrige palabras mal oídas. Después de generar, en el editor del resultado puedes cambiar todo frase por frase.')
    );

    return C.frag(
      ui.switchRow('Subtítulos automáticos', 'Transcritos del audio', s.captions, flip('captions'), { paddingBottom: '14px' }),
      s.captions && C.frag(
        ui.pestanas('texto', lista),
        tab === 'estilo' && estilo(),
        tab === 'plantilla' && plantilla(),
        tab === 'gusto' && panelSimple(s),
        tab === 'general' && general()
      ),
      !s.captions && h('button', { class: 'btn btn--amber', style: { marginTop: '4px' }, onClick: () => C.setState({ scriptOpen: true }) }, '✎ Abrir editor de guión')
    );
  };

  /* Movimiento de cámara (19-sep): la persona escoge efectos, curva e intensidad; Cherry decide dónde va cada uno */
  const MOV_EFECTOS = [
    { k: 'lento', n: 'Acercamiento lento', d: 'Se acerca poco a poco durante el pedazo.' },
    { k: 'aleja', n: 'Alejamiento lento', d: 'Empieza cerca y se abre despacio. Cierra el video.' },
    { k: 'golpe', n: 'Golpe de zoom', d: 'Justo después del corte ya está más cerca: disimula los cortes.' },
    { k: 'impacto', n: 'Zoom de impacto', d: 'Se acerca rápido en la primera palabra de cada frase de impacto.' },
    { k: 'mano', n: 'Cámara en mano', d: 'Un vaivén muy suave, como si alguien sostuviera la cámara.' },
    { k: 'sacude', n: 'Sacudida', d: 'Un temblor cortito en algunos pedazos cortos. Con moderación.' },
  ];
  const MOV_CURVAS = [{ k: 'suave', n: 'Suave' }, { k: 'energico', n: 'Enérgico' }, { k: 'rebote', n: 'Rebote' }, { k: 'parejo', n: 'Parejo' }];
  const MOV_INTENS = [{ id: 'sutil', name: 'Sutil' }, { id: 'media', name: 'Media' }, { id: 'fuerte', name: 'Fuerte' }];
  function curvaSVG(k) {
    const f = window.CherryMov ? window.CherryMov.CURVAS[k] : (u) => u;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push((4 + u * 56).toFixed(1) + ',' + (26 - f(u) * 20).toFixed(1)); }
    return '<svg viewBox="0 0 64 30" aria-hidden="true"><line x1="4" y1="26" x2="60" y2="26"/><line x1="4" y1="6" x2="60" y2="6"/><path d="M' + pts.join(' L') + '"/></svg>';
  }
  P.mov = function () {
    const s = C.state;
    const ef = s.movEfectos || {};
    const n = MOV_EFECTOS.filter((e) => ef[e.k]).length;
    const flipEf = (k) => () => C.setState({ movEfectos: Object.assign({}, ef, { [k]: !ef[k] }) });
    const hayVista = !!(s.fondoPrevia || (C.cortesVivo && C.cortesVivo.listo && C.cortesVivo.listo(s)));
    return C.frag(
      h('div', { class: 'row__desc', style: { marginBottom: '14px' } },
        'Escoge los movimientos que te gustan: Cherry decide dónde va cada uno según tus cortes y tus frases de impacto. ' +
        (hayVista ? 'Míralo en el celular.' : 'Lo verás en el celular apenas tu video esté cortado.')),
      h('div', { class: 'row', style: { marginBottom: '9px' } },
        h('span', { class: 'label', style: { marginBottom: '0' } }, 'Efectos'),
        h('span', { class: 'meta' }, n ? n + (n === 1 ? ' elegido' : ' elegidos') : 'ninguno: sin movimiento')),
      h('div', { class: 'mov-efectos' }, MOV_EFECTOS.map((e) =>
        h('button', { class: 'mov-ef' + (ef[e.k] ? ' mov-ef--on' : ''), onClick: flipEf(e.k), 'aria-pressed': ef[e.k] ? 'true' : 'false' },
          h('span', { class: 'mov-mini' }, h('i', { class: 'mov-mini--' + e.k })),
          h('span', { class: 'mov-ef__txt' }, h('b', null, e.n), h('small', null, e.d)),
          h('span', { class: 'mov-ef__caja' }, '✓')))),
      ui.label('Estilo del movimiento (curva de velocidad)', { marginTop: '18px' }),
      h('div', { class: 'mov-curvas' }, MOV_CURVAS.map((c) =>
        h('button', { class: 'mov-curva' + ((s.movCurva || 'suave') === c.k ? ' mov-curva--sel' : ''), onClick: () => C.setState({ movCurva: c.k }) },
          h('span', { html: curvaSVG(c.k) }), c.n))),
      ui.label('Intensidad', { marginTop: '18px' }),
      ui.chips(MOV_INTENS, s.movIntensidad || 'media', set('movIntensidad'), { marginBottom: '8px' }),
      h('div', { class: 'row__desc', style: { marginTop: '10px' } }, 'Los subtítulos no se mueven: el movimiento es solo del video.')
    );
  };

  P.audio = function () {
    const s = C.state;
    return C.frag(
      ui.select(D.musics, s.music, set('music'), { marginBottom: '10px' }),
      h('div', { class: 'mono beat' },
        h('span', { class: 'beat__bars' }, [5, 11, 7, 10].map((hh) => h('span', { style: { height: hh + 'px' } }))),
        'Beat sync · cortes al ritmo'
      ),
      ui.slider({ key: 'musicVol', label: 'Música vs. voz', labelFn: (v) => v + '%', style: { marginBottom: '18px' } }),
      ui.divider({ marginBottom: '14px' }),
      ui.switchRow('Efectos de sonido', 'Whooshes, impactos, risers', s.sfxOn, flip('sfxOn')),
      h('button', { class: 'btn btn--accent', style: { marginTop: '12px' }, onClick: () => C.setState({ sfxOpen: true }) }, '♪ Abrir librería de SFX')
    );
  };

  P.salida = function () {
    const s = C.state;
    return C.frag(
      ui.label('Duración máxima'),
      ui.chips(D.durations, s.duration, set('duration'), { marginBottom: '18px' }),
      ui.label('Calidad'),
      ui.chips(D.qualities, s.quality, set('quality'), { marginBottom: '18px' }),
      h('button', { class: 'btn btn--ghost', style: { marginBottom: '12px' }, onClick: () => C.setState({ visualsOpen: true }) }, '▦ Explorar banco de stock'),
      ui.divider({ marginBottom: '4px' }),
      D.advRows.map((r) =>
        h('div', { class: 'row row--pad' },
          h('div', { style: { minWidth: '0' } },
            h('div', { style: { fontWeight: '600', fontSize: '12.5px' } }, r.name),
            h('div', { style: { fontSize: '10px', color: 'rgba(247,233,224,.42)', lineHeight: '1.35' } }, r.desc)
          ),
          ui.switch(s.adv[r.k], () => C.toggleAdv(r.k))
        )
      )
    );
  };

  /* ── Color: looks de Cherry sobre todo el video, con vista en vivo en el celular.
        Es la primera sección de Edición (antes fue una tarjeta propia: 17 y 18-sep). ── */
  const conSigno = (v) => (v === 0 ? 'como viene' : (v > 0 ? '+' : '−') + Math.abs(v));
  function seccionColor() {
    const s = C.state;
    const MC = window.CherryColor;
    const hayLook = s.look !== 'ninguno' && D.looks.some((l) => l.id === s.look);
    const ajustes = MC ? MC.AJUSTES : [];
    const tocado = s.lookFuerza !== 100 || ajustes.some((a) => Number(s['aj_' + a.k]));
    const enVivo = C.colorVivo && C.colorVivo.fuente(s);
    return h('div', null,
      ui.label('Look'),
      h('div', { class: 'looks' },
        D.looks.map((l) => h('button', {
          class: 'look' + (s.look === l.id ? ' look--sel' : ''), title: l.desc,
          onClick: () => C.setState({ look: l.id }),
        },
          h('span', { class: 'look__foto look__foto--' + l.id }),
          h('span', { class: 'look__nom' }, l.name)
        ))
      ),
      h('div', { class: 'row__desc', style: { margin: '10px 0 16px' } },
        (D.looks.find((l) => l.id === s.look) || D.looks[0]).desc),

      hayLook && ui.grupo('edicion', 'ajustes', 'Intensidad y ajustes',
        s.lookFuerza + ' %' + (ajustes.filter((a) => Number(s['aj_' + a.k])).length
          ? ' · ' + ajustes.filter((a) => Number(s['aj_' + a.k])).length + ' ajustes' : ' · sin ajustes'),
        () => h('div', null,
          ui.slider({ key: 'lookFuerza', label: 'Intensidad', min: 10, max: 100, step: 5,
            labelFn: (v) => v + '%', style: { marginBottom: '18px' } }),
          h('div', { class: 'aj-cabeza' },
            h('span', { class: 'label', style: { marginBottom: '0' } }, 'Ajustar el look'),
            tocado && h('button', { class: 'aj-reset', onClick: () => C.restablecerLook() }, 'Restablecer')
          ),
          ajustes.map((a) => h('div', { class: 'aj' },
            ui.slider({ key: 'aj_' + a.k, label: a.nombre, min: -100, max: 100, step: 5, labelFn: conSigno }),
            h('div', { class: 'aj__extremos' }, h('span', null, a.menos), h('span', null, a.mas))
          ))
        )),

      ui.switchRow('Revelado', 'Le quita el velo al video: mide tus clips y hace que el negro sea negro. Va antes del look.',
        s.revelado, () => C.toggle('revelado'), { margin: '6px 0 14px' }),
      h('div', { class: 'row__desc' }, enVivo
        ? 'Lo que ves en el celular es como va a salir. Mantén presionado el botón del celular para compararlo sin color.'
        : 'Sube un clip para ver el color en vivo en el celular. El color se aplica a todo el video, antes de los subtítulos.')
    );
  }

  P.marca = function () {
    const s = C.state;
    return C.frag(
      // Fuente y color de marca (antes estaban en Texto): se guardan como identidad; todavía no cambian el video
      ui.label('Fuente de marca'),
      ui.select(D.fonts, s.font, set('font'), { marginBottom: '16px' }),
      ui.label('Color de marca'),
      ui.swatches(s.brandColor, set('brandColor')),
      ui.gap(14),
      ui.divider({ marginBottom: '6px' }),
      h('div', { class: 'row row--pad' },
        h('span', { style: { fontSize: '12.5px', fontWeight: '500' } }, 'Sonidos guardados'),
        h('span', { class: 'mono', style: { fontSize: '10.5px', color: 'rgba(247,233,224,.55)' } }, '3 efectos · 1 jingle')
      ),
      ui.switchRow('Aplicar automáticamente', 'A cada proyecto nuevo', s.brandAuto, flip('brandAuto'), { padding: '14px 0' }),
      h('button', { class: 'btn btn--magenta', onClick: () => C.actions.saveBrand() }, 'Guardar identidad'),
      s.brandSaved && h('div', { class: 'hand', style: { fontSize: '18px', color: 'var(--teal)', textAlign: 'center', marginTop: '10px' } }, '✓ guardada y aplicada')
    );
  };

  P.graficos = function () {
    const s = C.state;
    return C.frag(
      ui.label('Colores del texto'),
      ui.colorRow('Color protagonista', 'Palabra grande en cada escena', s.graphicsHeroColor, set('graphicsHeroColor'), { marginBottom: '12px' }),
      ui.colorRow('Color de soporte', 'Línea de texto secundaria', s.graphicsSupColor, set('graphicsSupColor'), { marginBottom: '18px' }),
      ui.label('Fondo'),
      ui.chips(D.graphicsBgs, s.graphicsBg, set('graphicsBg'), { marginBottom: '18px' }),
      ui.divider({ marginBottom: '14px' }),
      ui.switchRow('Textura de papel', 'Grano orgánico sobre el fondo', s.graphicsPaper, flip('graphicsPaper'), { marginBottom: '14px' }),
      ui.switchRow('Granito (grain)', 'Partículas de ruido animado', s.graphicsGrain, flip('graphicsGrain'), { marginBottom: '14px' }),
      ui.switchRow('FPS bajos (cinematic)', 'Movimiento de cámara a 14 fps', s.graphicsLowFps, flip('graphicsLowFps'), { marginBottom: '18px' }),
      ui.label('Combo de estilo'),
      ui.chips(D.graphicsCombos, s.graphicsCombo, set('graphicsCombo'))
    );
  };

  C.panels = P;

  /* Ilustración de la tarjeta: imagen o video corto en bucle (el video se conserva entre redibujos) */
  function mediaTarjeta(c) {
    if (/\.(mp4|webm|mov)$/i.test(c.media || '')) {
      const v = C.videoFijo('tarjeta-' + c.k, c.media, { muted: true, autoplay: true, loop: true, playsinline: true, preload: 'auto' });
      v.muted = true;
      if (v.paused) v.play().catch(() => null);
      return v;
    }
    return C.imgFija('tarjeta-' + c.k, c.media, { alt: '', onError: (e) => { e.target.style.display = 'none'; } });
  }

  /* ---------------- Módulo único ---------------- */
  C.Config = function () {
    const s = C.state, A = C.actions;
    const open = D.configCards.find((c) => c.k === s.openCard);

    if (!open) {
      return h('div', { class: 'glass glass--full' },
        h('div', { class: 'cfg__head' },
          h('div', null,
            h('div', { class: 'h-module', style: { fontSize: '22px' } }, 'configuración'),
            h('div', { class: 'kicker', style: { marginTop: '5px' } }, 'Toca una tarjeta para entrar')
          ),
          h('span', { class: 'hand', style: { fontSize: '18px', color: 'var(--magenta)', transform: 'rotate(-2deg)' } }, D.configCards.length + ' módulos')
        ),
        h('div', { class: 'cfg__grid', 'data-scroll': 'cfg-grid' },
          D.configCards.map((c) =>
            h('div', { class: 'tile', onClick: () => A.openCard(c.k) },
              h('div', { class: 'tile__media' }, mediaTarjeta(c)),
              h('div', { class: 'tile__body' },
                h('span', { class: 'tile__tag' }, c.tag),
                h('div', { class: 'tile__name' }, c.name),
                h('div', { class: 'tile__desc' }, c.desc),
                h('div', { class: 'tile__foot' },
                  h('span', { class: 'tile__badge', style: { background: c.accent } }, c.glyph),
                  h('span', { class: 'tile__sum' }, U.cardSummary(c.k, s))
                )
              )
            )
          )
        )
      );
    }

    return h('div', { class: 'glass glass--full' },
      h('div', { class: 'cfg__detail-head' },
        h('button', { class: 'btn-round btn-round--ghost', title: 'Volver a los módulos', onClick: () => A.backToGrid() }, '←'),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'h-detail' }, open.name),
          h('div', { class: 'kicker truncate', style: { marginTop: '5px' } }, U.cardSummary(open.k, s))
        ),
        h('span', { class: 'cfg__badge', style: { color: open.accent } }, open.glyph)
      ),
      h('div', { class: 'cfg__body', 'data-scroll': 'cfg-' + open.k }, P[open.k]())
    );
  };
})();

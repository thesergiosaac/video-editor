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
    slider({ key, label, labelFn, min = 0, max = 100, step = 1, style, pista }) {
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
            class: pista ? 'rango-pista' : null, style: pista ? { background: pista } : null,
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
          // (28-sep) al cambiar de grupo se apagan el gotero y «Ver qué cambia» del HSL
          onClick: () => C.setState({ grupos: Object.assign({}, C.state.grupos, { [modulo]: abierto ? null : id }), hslGotero: null, hslVer: false }),
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
  /* (30-sep) Letras de marca: color del acento (la paleta aprobada + cualquiera), letra base blanca o negra y qué papeles
     se pintan con el acento (varios a la vez). Viajan al video en simple.colores[plantilla] = {acento, texto, pinta}. */
  const PAPELES_MARCA = {
    marca_blur: [{ k: 'C', n: 'Línea de arriba' }, { k: 'A', n: 'Palabra grande' }],
    marca_cinematic: [{ k: 'A', n: 'Palabra grande' }, { k: 'B', n: 'Cursiva' }, { k: 'C', n: 'Línea pequeña' }],
    marca_citadel: [{ k: 'B', n: 'Caligrafía' }, { k: 'A', n: 'Palabra grande' }, { k: 'C', n: 'Línea pequeña' }],
    marca_pairings: [{ k: 'C', n: 'Línea de arriba' }, { k: 'A', n: 'Palabra grande' }],
  };
  function panelColoresMarca(s, pl) {
    const M = C.subs.MARCA[pl], mios = (s.subsColores || {})[pl] || {};
    const acento = (mios.acento || M.acento).toUpperCase(), texto = (mios.texto || M.texto).toUpperCase();
    const pinta = typeof mios.pinta === 'string' ? mios.pinta : M.pinta;
    const poner = (o) => C.setState({ subsColores: Object.assign({}, s.subsColores, { [pl]: Object.assign({}, mios, o) }), previaEnfoque: null });
    return C.frag(
      ui.label('Color del acento'),
      h('div', { class: 'lm-paleta', role: 'group', 'aria-label': 'Color del acento' },
        C.subs.PALETA_MARCA.map((c) => h('button', { type: 'button', class: c.toUpperCase() === acento ? 'on' : '', 'aria-pressed': String(c.toUpperCase() === acento),
          title: c, style: { background: c }, onClick: () => poner({ acento: c }) }))),
      ui.colorRow('Otro color', 'Cualquier color para el acento', acento.toLowerCase(), (v) => poner({ acento: v }), { marginBottom: '14px' }),
      ui.label('Letra base'),
      ui.chips([{ id: '#FFFFFF', name: 'Blanca' }, { id: '#111111', name: 'Negra' }], texto === '#111111' ? '#111111' : '#FFFFFF', (v) => poner({ texto: v }), { marginBottom: '14px' }),
      ui.label('Qué se pinta con el acento'),
      h('div', { class: 'chips', style: { marginBottom: '14px' } }, (PAPELES_MARCA[pl] || []).map((p) => {
        const on = pinta.indexOf(p.k) >= 0;
        return h('button', { class: 'chip' + (on ? ' chip--sel' : ''), 'aria-pressed': String(on),
          onClick: () => poner({ pinta: on ? pinta.replace(p.k, '') : ['A', 'B', 'C'].filter((k) => k === p.k || pinta.indexOf(k) >= 0).join('') }) }, p.n);
      })),
      /* (30-sep) la sombra: para que el acento se lea sobre cualquier fondo (el lima sobre una pared clara) */
      ui.label('Sombra'),
      ui.chips(Object.keys(C.subs.SOMBRA_MARCA).map((k) => ({ id: k, name: C.subs.SOMBRA_MARCA[k] })),
        C.subs.SOMBRA_MARCA[mios.sombra] ? mios.sombra : C.subs.SOMBRA_MARCA_BASE, (v) => poner({ sombra: v }), { marginBottom: '6px' }),
      h('div', { class: 'row__desc', style: { marginBottom: '14px' } }, 'Una sombra suave y difuminada detrás de cada palabra. Viene en Fuerte, para que se lea hasta sobre fondos blancos; bájala si tu fondo es oscuro.'),
      pl === 'marca_pairings' && h('div', { class: 'row__desc', style: { marginBottom: '12px' } }, 'La caja del remate siempre va con el acento.'),
      pl === 'marca_blur' && h('div', { class: 'row__desc', style: { marginBottom: '12px' } }, 'A los lados, la primera palabra de la izquierda va con la letra base y la de la derecha con el acento.'),
      Object.keys(mios).length > 0 && h('button', {
        class: 'btn btn--ghost', style: { padding: '9px' },
        onClick: () => { const o = Object.assign({}, s.subsColores); delete o[pl]; C.setState({ subsColores: o }); },
      }, 'Volver a los colores originales')
    );
  }
  function panelColoresPlantilla(s) {
    const pl = s.subsPlantilla || 'editorial';
    if (C.subs.MARCA && C.subs.MARCA[pl]) return panelColoresMarca(s, pl);
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
      ui.grupo('edicion', 'ritmo', 'Ritmo y cortes',
        s.sinCortes ? 'sin recortes' : U.pacingLabel(s.pacing) + ' · aire ' + U.aireLabel(s.aire).toLowerCase(),
        () => C.frag(
        /* 23-sep (Sergio): «tenemos que tener una opción para dejar el video natural», para cuando
           sube algo que ya recortó él y solo quiere subtítulos, color o gráficos encima. */
        ui.switchRow('No recortes el video',
          'Déjalo como lo subí y ponle solo lo de encima: subtítulos, color, gráficos y escenas.',
          s.sinCortes, flip('sinCortes')),
        s.sinCortes
          /* ⚠️ Los tres mandos de abajo son AJUSTES DEL CORTE. Dejarlos a la vista cuando no se
             corta es prometer algo que no va a pasar. */
          ? h('div', { class: 'row__desc', style: { marginTop: '12px' } },
              'El video entra entero, tal cual lo subiste. El ritmo, el aire y los silencios no se '
              + 'tocan porque no hay cortes que ajustar.')
          : C.frag(
        h('div', { class: 'row__desc', style: { margin: '12px 0' } }, 'Cambiar esto vuelve a cortar el video (se regenera completo).'),
        ui.slider({ key: 'pacing', label: 'Ritmo', labelFn: U.pacingLabel, style: { marginBottom: '18px' } }),
        /* 19-sep (Sergio): el aire va en segundos y se mide con el silencio real de tu audio */
        ui.slider({ key: 'aire', label: 'Aire entre cortes', min: 0, max: 0.5, step: 0.02, labelFn: U.aireLabel, style: { marginBottom: '8px' } }),
        h('div', { class: 'row__desc', style: { marginBottom: '18px' } },
          s.aire < 0.01 ? 'Pegado: cada corte empieza justo donde empiezas a hablar y acaba cuando terminas.'
            : 'Deja ' + U.aireLabel(s.aire).split('· ')[1] + ' de silencio a cada lado de cada corte.'),
        ui.slider({ key: 'clipGap', label: 'Eliminar silencios largos', labelFn: U.clipGapLabel })
          )
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
  /* (29-sep) FAMILIAS de gráficos: se escogen como las plantillas de los subtítulos. Una sola = todos de esa familia;
     varias = Cherry las mezcla y las reparte por el video. Siempre queda al menos una. */
  const FAMILIAS_GRAF = [
    { id: 'vidrio', name: 'Vidrio', ref: 'cifras, listas, antes y después', muestra: 'assets/graficos/familia-vidrio.mp4',
      d: 'tarjetas de vidrio encima de tu video, con cifras que ruedan' },
    { id: 'persiana', name: 'La persiana', ref: 'la palabra clave que cae', muestra: 'assets/graficos/familia-persiana.mp4',
      d: 'corte seco a una tarjeta de color con la luz de una persiana: la palabra clave cae y se asienta' },
  ];
  const FONDOS_PERSIANA = [
    { id: 'marca', name: 'Tu color' }, { id: 'blanco', name: 'Blanco' }, { id: 'papel', name: 'Papel' }, { id: 'alterna', name: 'Alternar' },
  ];
  const familiasDe = (s) => {
    const f = (Array.isArray(s.grafFamilias) ? s.grafFamilias : []).filter((x) => FAMILIAS_GRAF.some((F) => F.id === x));
    return f.length ? f : ['vidrio'];
  };
  function alternarFamilia(id) {
    const hoy = familiasDe(C.state);
    const nueva = hoy.indexOf(id) >= 0 ? hoy.filter((x) => x !== id) : hoy.concat([id]);
    if (!nueva.length) return;
    C.setState({ grafFamilias: FAMILIAS_GRAF.map((F) => F.id).filter((x) => nueva.indexOf(x) >= 0) });
  }
  // la muestra de cada familia: un video corto en bucle que sobrevive a los redibujos (no vuelve a empezar)
  function muestraFamilia(F) {
    const v = C.videoFijo('familia-' + F.id, F.muestra, { class: 'gr-fam__vid', loop: true, autoplay: true, muted: true,
      playsinline: true, preload: 'auto', 'aria-hidden': 'true' });
    v.muted = true;
    if (v.paused) setTimeout(() => { if (v.isConnected && v.paused) v.play().catch(() => null); }, 0);
    return v;
  }
  function galeriaFamilias(s) {
    const fams = familiasDe(s);
    return h('div', { class: 'gr-fam', role: 'group', 'aria-label': 'Familias de gráficos' },
      FAMILIAS_GRAF.map((F) => {
        const sel = fams.indexOf(F.id) >= 0;
        return h('button', { type: 'button', class: 'sp-tile gr-fam__tile' + (sel ? ' sp-tile--sel' : ''), 'aria-pressed': String(sel),
          title: F.name + ': ' + F.d, onClick: () => alternarFamilia(F.id) },
          h('span', { class: 'gr-fam__marco' }, muestraFamilia(F), sel ? h('span', { class: 'gr-fam__si' }, 'Puesta') : null),
          h('span', { class: 'sp-tile__name' }, F.name),
          h('span', { class: 'sp-tile__ref' }, F.ref));
      }));
  }
  /* «Poner foto o clip» en una tarjeta de la persiana: nace una pantalla «en tarjeta» sobre la palabra de esa tarjeta, con
     su palabra grande y su cursiva, y se abre el selector de archivo. La pantalla manda: la tarjeta pasa a llevar tu
     foto, captura o clip (vertical cae girando, horizontal entra de lado, foto como polaroid). */
  function ponerMaterial(p) {
    const i = indiceMomento(p);
    const m = i >= 0 ? ((C.grafVivo && C.grafVivo.momentos && C.grafVivo.momentos()) || [])[i] : null;
    const palabra = m && Array.isArray(m.marcas) && m.marcas.length ? Number(m.marcas[0]) : Number(p.desde);
    const d = p.datos || {};
    C.pantallas.nuevaEn({ desde: palabra, hasta: palabra, forma: 'tarjeta', titulo: d.grande || '', etiqueta: d.chica || '' });
  }
  // la pantalla «en tarjeta» que se está subiendo para esa tarjeta (aún sin archivo listo)
  function materialPendiente(p) {
    const i = indiceMomento(p);
    const m = i >= 0 ? ((C.grafVivo && C.grafVivo.momentos && C.grafVivo.momentos()) || [])[i] : null;
    const palabra = m && Array.isArray(m.marcas) && m.marcas.length ? Number(m.marcas[0]) : Number(p.desde);
    return ((C.pantallas && C.pantallas.lista()) || []).find((x) => x.forma === 'tarjeta' && !x.url && Number(x.desde) === palabra) || null;
  }
  /* (29-sep) Las piezas de UNA palabra de la persiana se cambian entre sí: la tarjeta, la ventana, empuja, te sales y tú
     delante. Se guarda por la palabra donde empieza el gráfico (cfg.variantes) y viaja al video final. */
  const VARIANTES = [
    { id: 'pe_tarjeta', name: 'Tarjeta' }, { id: 'pe_ventana', name: 'Ventana' }, { id: 'pe_empuja', name: 'Empuja' },
    { id: 'pe_sales', name: 'Te sales' }, { id: 'pe_tu', name: 'Tú delante' },
  ];
  function variantesItem(p) {
    const GR = window.CherryGraf;
    if (!GR || !GR.PALABRA_PE || p.pantalla || GR.PALABRA_PE.indexOf(p.tipo) < 0) return null;
    const para = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    return h('span', { class: 'gr-var', role: 'group', 'aria-label': 'Cambiar la pieza' },
      VARIANTES.map((v) => h('button', { type: 'button', class: p.tipo === v.id ? 'on' : '', 'aria-pressed': String(p.tipo === v.id),
        onClick: para(() => C.setState({ grafVariantes: Object.assign({}, C.state.grafVariantes || {}, { [p.desde]: v.id }) })) }, v.name)));
  }
  function accionesItem(p) {
    const GR = window.CherryGraf;
    if (!C.pantallas || !C.pantallas.nuevaEn) return null;
    const para = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if (p.pantalla && p.forma === 'tarjeta') {
      return h('button', { type: 'button', class: 'gr-item__foto', title: 'Quitar tu foto o clip: vuelve la tarjeta de Cherry',
        onClick: para(() => C.pantallas.quitar(p.pantalla)) }, 'Quitar');
    }
    if (p.pantalla || p.tipo !== 'pe_tarjeta' || !GR) return null;
    const pend = materialPendiente(p);
    if (pend) {
      return h('span', { class: 'gr-item__subiendo' },
        h('span', { class: 'js-pan-estado-' + pend.id }, C.pantallas.textoEstado(pend)),
        h('button', { type: 'button', class: 'gr-item__foto', onClick: para(() => C.pantallas.quitar(pend.id)) }, 'Cancelar'));
    }
    return h('button', { type: 'button', class: 'gr-item__foto', title: 'Pon aquí tu foto, captura de pantalla o clip: la tarjeta lo lleva en este momento',
      onClick: para(() => ponerMaterial(p)) }, 'Poner foto o clip');
  }

  function seccionGraficos() {
    const s = C.state, GR = window.CherryGraf;
    if (!GR) return h('div', { class: 'row__desc' }, 'Los gráficos no cargaron. Recarga la página.');
    const lista = C.grafVivo ? C.grafVivo.lista() : null;
    const cant = CANT_GRAF.find((c) => c.id === (s.grafCantidad || 'medio')) || CANT_GRAF[1];
    const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    const mios = ((C.misColores && C.misColores.lista()) || []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 4);
    const colores = Object.keys(GR.COLORES).map((k) => ({ id: k, hex: GR.COLORES[k], name: NOMBRE_COLOR[k] || k }))
      .concat(mios.map((hex) => ({ id: hex, hex, name: 'Tuyo' })));
    /* (2-oct) «Tus títulos»: el mismo acento de tus títulos (Sergio, Proyecto 25: los gráficos en el lima de sus letras) */
    const deTitulos = C.subs && C.subs.acentoDe ? C.subs.acentoDe(s) : null;
    if (deTitulos && !colores.some((c) => String(c.hex).toLowerCase() === deTitulos)) colores.unshift({ id: deTitulos, hex: deTitulos, name: 'Tus títulos' });
    else if (deTitulos) colores.forEach((c) => { if (String(c.hex).toLowerCase() === deTitulos) c.name += ' · tus títulos'; });
    const elegido = s.grafColor || 'cherry';
    const hexElegido = GR.COLORES[elegido] || elegido;
    const aMano = !colores.some((c) => c.id === elegido);
    const fams = familiasDe(s), conVidrio = fams.indexOf('vidrio') >= 0, conPersiana = fams.indexOf('persiana') >= 0;
    const fondo = FONDOS_PERSIANA.find((f) => f.id === s.grafFondo) || FONDOS_PERSIANA[0];
    return C.frag(
      ui.switchRow('Gráficos', 'Cuando dices algo que se presta (una cifra, una lista, un antes y después, una palabra clave), Cherry pone un gráfico animado justo en ese momento. Tú escoges la familia.',
        !!s.grafOn, () => C.setState({ grafOn: !s.grafOn }), { marginBottom: '16px' }),
      s.grafOn && C.frag(
        ui.label('Familia'),
        galeriaFamilias(s),
        h('div', { class: 'row__desc', style: { margin: '8px 0 16px' } },
          fams.length > 1 ? 'Escogiste dos: Cherry las mezcla y las reparte por el video.' : 'Toca otra familia para mezclarlas en el mismo video.'),
        s.grafMarcando ? h('div', { class: 'row__desc', style: { marginBottom: '16px' } }, h('span', { class: 'spinner' }), ' Cherry está buscando dónde van en tu video…') : null,
        ui.label('Cuántos'),
        ui.chips(CANT_GRAF, cant.id, set('grafCantidad'), { marginBottom: '8px' }),
        h('div', { class: 'row__desc', style: { marginBottom: '16px' } }, cant.name + ': ' + cant.d + '. Nunca encima de una escena de apoyo.'),
        conPersiana && C.frag(
          ui.label('Fondo de la persiana'),
          ui.chips(FONDOS_PERSIANA, fondo.id, set('grafFondo'), { marginBottom: '8px' }),
          h('div', { class: 'row__desc', style: { marginBottom: '16px' } },
            (fondo.id === 'alterna' ? 'Cada tarjeta cambia: tu color, blanco y papel. ' : '') +
            'Mientras está la tarjeta, los subtítulos no se ven. La dibuja Remotion en la nube: el video tarda un poco más. ' +
            'En cada gráfico de una palabra puedes cambiar la pieza: Tarjeta, Ventana, Empuja, Te sales o Tú delante. Te sales y Tú delante usan tu recorte: en la vista previa ves la tarjeta y en el video final sales tú. ' +
            'Cuando dices algo que la gente cree y lo desmientes, sale La pantalla con sello: una pantalla del celular detrás de ti y el sello «FALSO» (en la vista previa la pantalla te tapa; en el video final quedas delante).')),
        conVidrio && C.frag(
          ui.label(conPersiana ? 'Estilo del vidrio' : 'Estilo'),
          ui.chips(ESTILOS_GRAF, s.grafEstilo === 'premium' ? 'premium' : 'clasico', set('grafEstilo'), { marginBottom: '8px' }),
          h('div', { class: 'row__desc', style: { marginBottom: '16px' } },
            (s.grafEstilo === 'premium' ? 'Premium: ' : 'Clásico: ') + (ESTILOS_GRAF.find((e) => e.id === (s.grafEstilo || 'clasico')) || ESTILOS_GRAF[0]).d +
            (s.grafEstilo === 'premium' ? '. Los dibuja Remotion en la nube: el video tarda un poco más.' : '.')),
          /* «Detrás de ti» (20-sep, idea de Sergio): un interruptor y el gráfico deja de taparte.
             Cherry saca tu silueta cuadro a cuadro y lo mete por detrás; tú quedas siempre delante. */
          ui.switchRow('Detrás de ti', 'En vez de ir encima, el gráfico pasa por detrás tuyo: Cherry te recorta del fondo y tú quedas delante. Nada te tapa la cara. Tarda un poco más en hacerse.',
            !!s.grafDetras, () => C.setState({ grafDetras: !s.grafDetras }), { marginBottom: '16px' })),
        ui.label(conPersiana ? 'Color (también el de la persiana)' : 'Color'),
        h('div', { class: 'gr-colores', role: 'group', 'aria-label': 'Color de los gráficos' }, colores.map((c) => h('button', {
          type: 'button', class: 'gr-color' + (elegido === c.id ? ' on' : ''), 'aria-pressed': String(elegido === c.id), title: c.name,
          onClick: () => C.setState({ grafColor: c.id }),
        }, h('i', { style: { background: c.hex } }), c.name)).concat([
          /* (2-oct) cualquier color, como en las pantallas */
          h('label', { class: 'gr-color pan-color__otro' + (aMano ? ' on' : ''), title: 'Escoge cualquier color' },
            h('input', { type: 'color', value: /^#[0-9a-fA-F]{6}$/.test(hexElegido) ? hexElegido : '#ff2d8a',
              onChange: (e) => C.setState({ grafColor: String(e.target.value).toLowerCase() }) }), 'Otro'),
          aMano && C.misColores ? h('button', { type: 'button', class: 'mis-colores__guardar', title: 'Guardar este color en Mis colores',
            onClick: () => C.misColores.agregar(hexElegido) }, '+ Guardar color') : null,
        ])),
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
                    h('span', { class: 'ap-item__txt' }, h('b', { class: 'gr-item__tipo' }, GR.NOMBRES[p.tipo] || p.tipo), ' · ' + GR.resumen(p)),
                    accionesItem(p), variantesItem(p));
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
    const PAL = (window.CherryGraf && window.CherryGraf.PALABRA_PE) || [];
    return ms.findIndex((m) => Number(m.desde) === Number(p.desde) && (m.tipo === p.tipo || (p.variante && PAL.indexOf(m.tipo) >= 0)));
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
      const r = await C.api.regenerarGraficos(render, quedan, (C.grafCfg().familias) || ['vidrio']);
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

    if (!lineas && s.renderId && s.phase !== 'idle') {
      // (24-sep) con el video ya hecho las líneas salen de él: se están leyendo
      return h('div', { class: 'gu' }, h('div', { class: 'row__desc' }, h('span', { class: 'spinner' }), ' Leyendo lo que dices en tu video…'));
    }
    if (!lineas) {
      return h('div', { class: 'gu' },
        h('div', { class: 'row__desc' },
          s.scriptText
            ? 'Este es el guion que escribiste. Cuando Cherry corte tu video, aquí verás lo que dijiste de verdad, línea por línea, con lo que puso en cada momento.'
            : 'Aquí verás lo que dices en tu video, línea por línea, con lo que Cherry puso en cada momento. Aparece cuando tu video está cortado.'),
        s.scriptText ? h('div', { class: 'gu-escrito' }, h('div', { class: 'label' }, 'Lo que escribiste'), h('p', null, s.scriptText)) : null);
    }

    normalizarEscenas(lineas);
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
            chipTitulo(l),
            C.pantallas ? C.pantallas.marca(l) : null,
            C.sonidosGuion ? C.sonidosGuion.marca(l) : null),
          h('span', { class: 'gu-mandos' }, mando(l, 'graficos', 'Gráfico'), mandoEscena(l, lineas), mandoTitulo(l),
            C.pantallas ? C.pantallas.mando(l) : null,
            C.sonidosGuion ? C.sonidosGuion.mando(l) : null),
          editorEscena(l, lineas),
          editorTitulo(l),
          C.pantallas ? C.pantallas.editor(l, lineas) : null,
          C.sonidosGuion ? C.sonidosGuion.editor(l) : null)))),
      h('div', { class: 'row__desc gu-pie' },
        'Toca «Gráfico» en una línea para fijar que ahí SÍ va, o para quitarlo. '
        + '«Escena» pone una toma de apoyo desde esa línea y tú le dices cuánto dura. '
        + '«Pantalla» pone una grabación de tu pantalla en la plantilla del navegador, desde esa línea. '
        + '«Sonido» pone un efecto justo en la palabra que escojas. '
        + (C.subs && C.subs.modoImpacto(s) ? 'Toca «Resaltada» para quitar el título de una línea, y «Mover título» para subir o bajar solo ese. ' : '')
        + 'Lo que fijes manda sobre lo que decide Cherry, y va aparte del nivel que elegiste.'));
  };

  /* ══ (27-sep) EL TÍTULO de impacto desde el Guion ══ Sergio: «quiero quitar la palabra de impacto de esa línea, ahí la
     veo pero no se deja quitar, no es cliqueable» y «haz que solamente ese título lo pueda reubicar sin que se afecten las
     otras frases de impacto». Se guarda en guionFijos.titulos con los números de palabra de la línea: tipo 'no' (sin
     título), 'si' (con título) y `y` (su altura, los mismos puntos del «Arriba / abajo» de Texto). Solo en «solo frases
     de impacto»: con la plantilla en todo el video no hay títulos aparte. */
  function fijoTitulo(l) {
    return ((C.state.guionFijos || {}).titulos || []).find((z) => Number(z.desde) === l.desde && Number(z.hasta) === l.hasta) || null;
  }
  function conTitulo(l, cambio) {
    const todo = Object.assign({}, C.state.guionFijos || {});
    const lista = (todo.titulos || []).filter((z) => !(Number(z.desde) === l.desde && Number(z.hasta) === l.hasta));
    const z = Object.assign({ desde: l.desde, hasta: l.hasta }, fijoTitulo(l) || {}, cambio);
    Object.keys(z).forEach((k) => { if (z[k] == null) delete z[k]; });
    if (z.tipo || z.y != null) lista.push(z);
    todo.titulos = lista;
    return todo;
  }
  const titulosEditables = () => !!(C.subs && C.subs.modoImpacto && C.subs.modoImpacto(C.state));
  function chipTitulo(l) {
    if (l.quitado) {
      return titulosEditables() ? h('button', { class: 'gu-m gu-m--i gu-m--quitado', type: 'button',
        title: 'Esta línea va sin título. Toca para volver a ponerlo.',
        onClick: (e) => { e.preventDefault(); C.setState({ guionFijos: conTitulo(l, { tipo: 'si' }) }); } }, 'Sin título') : null;
    }
    if (!l.impacto) return null;
    if (!titulosEditables()) return h('span', { class: 'gu-m gu-m--i' }, 'Resaltada');
    return h('button', { class: 'gu-m gu-m--i gu-m--toca', type: 'button', title: 'Toca para quitar el título de esta línea',
      onClick: (e) => {
        e.preventDefault();
        C.setState({ guionFijos: conTitulo(l, { tipo: 'no', y: null }), tituloAbierto: C.state.tituloAbierto === l.desde ? null : C.state.tituloAbierto });
      } },
      'Resaltada', h('span', { class: 'gu-m__x', 'aria-hidden': 'true' }, '×'));
  }
  function mandoTitulo(l) {
    if (!l.impacto || !titulosEditables()) return null;
    const abierta = C.state.tituloAbierto === l.desde;
    return h('button', { class: 'gu-b gu-b--' + (l.tituloY != null ? 'tit' : 'auto') + (abierta ? ' gu-b--abierta' : ''), type: 'button',
      title: 'Sube o baja solo este título; los demás se quedan donde están.',
      onClick: (e) => {
        e.preventDefault();
        C.setState({ tituloAbierto: abierta ? null : l.desde, escenaAbierta: null, pantallaAbierta: null });
        // el celular salta a ese título para verlo mientras se mueve
        if (!abierta && C.cortesVivo && C.cortesVivo.listo && C.cortesVivo.listo(C.state) && C.cortesVivo.irA) C.cortesVivo.irA(l.t0 + 0.15);
      } },
      h('span', { class: 'gu-b__i' }, '↕'), 'Mover título');
  }
  const alturaTexto = (v) => (v === 0 ? 'Como viene' : (v < 0 ? 'Arriba ' : 'Abajo ') + Math.abs(v));
  function editorTitulo(l) {
    if (C.state.tituloAbierto !== l.desde || !l.impacto || !titulosEditables()) return null;
    const propia = l.tituloY != null;
    const general = Math.max(-45, Math.min(45, Number(C.state.subsDy) || 0));
    const valor = propia ? l.tituloY : general;
    const cerrar = () => C.setState({ tituloAbierto: null });
    return h('div', { class: 'pan pan--titulo' },
      h('div', { class: 'label', style: { marginBottom: '6px' } }, 'Mover solo este título'),
      h('div', { class: 'row__desc pan-nota' }, propia
        ? 'Este título va a su propia altura. Los demás siguen donde los dejaste en Texto.'
        : 'Va a la misma altura que los demás. Muévelo y solo este cambia.'),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('span', { class: 'label', style: { marginBottom: '0' } }, 'Arriba / abajo'),
        h('span', { class: 'meta js-titulo-y' }, alturaTexto(valor))),
      h('div', { style: { marginTop: '10px' } },
        h('input', { type: 'range', min: -45, max: 45, step: 1, value: valor,
          // mientras se arrastra, el celular lo muestra sin redibujar la página; al soltar se guarda
          onInput: (e) => {
            const v = Number(e.target.value);
            C.state.guionFijos = conTitulo(l, { y: v });
            document.querySelectorAll('.js-titulo-y').forEach((el) => { el.textContent = alturaTexto(v); });
          },
          onChange: (e) => C.setState({ guionFijos: conTitulo(l, { y: Number(e.target.value) }) }) })),
      h('div', { class: 'pan-pie' },
        propia && h('button', { class: 'gu-b', type: 'button', title: 'Que vuelva a la altura de los demás',
          onClick: () => C.setState({ guionFijos: conTitulo(l, { y: null }) }) }, 'Como los demás'),
        h('button', { class: 'gu-b', type: 'button', onClick: cerrar }, 'Listo')));
  }

  /* ══ (24-sep) LA ESCENA desde el Guion, con su duración ══ Sergio: «cuando tocamos en escena no nos da ninguna
     opción; debería darnos la opción de colocar la duración, así como la de la pantalla, y automáticamente el sistema
     lo adapta a las líneas». Se guarda como una zona «sí» de guionFijos.escenas con `segundos`: apoyo.js la pone desde
     la primera palabra de la línea y dura eso. Tocarla abre su panel; una línea sin nada fijado estrena una de 4 s. */
  const DUR_ESCENA = 4;
  function zonaEscena(l) {
    const f = (C.state.guionFijos || {}).escenas || {};
    const toca = (z) => Number(z.desde) <= l.hasta && Number(z.hasta) >= l.desde;
    const si = (f.si || []).find(toca);
    if (si) return { tipo: 'si', z: si };
    const no = (f.no || []).find(toca);
    return no ? { tipo: 'no', z: no } : null;
  }
  // la última palabra que EMPIEZA antes de que se acabe la escena (cruza las líneas que haga falta)
  function hastaEscena(desde, lineas, segundos) {
    const i0 = lineas.findIndex((x) => x.desde <= desde && x.hasta >= desde);
    if (i0 < 0) return desde;
    const L0 = lineas[i0], w0 = Array.isArray(L0.tp) ? L0.tp[desde - L0.desde] : null;
    const fin = (w0 ? w0[0] : L0.t0) + Number(segundos) - 0.05;
    let hasta = desde;
    for (let k = i0; k < lineas.length; k++) {
      const L = lineas[k];
      const tp = Array.isArray(L.tp) && L.tp.length === L.hasta - L.desde + 1 ? L.tp : null;
      if (!tp) { if (L.t0 < fin) { hasta = Math.max(hasta, L.hasta); continue; } break; }
      let sigue = true;
      tp.forEach((x, j) => { const idx = L.desde + j; if (idx < desde || !sigue) return; if (x[0] < fin) hasta = idx; else sigue = false; });
      if (!sigue) break;
    }
    return hasta;
  }
  // cambia la zona `vieja` por `nueva` (tipo 'si' | 'no'), o la quita (tipo null); lo que se cruce con la nueva sale
  function cambiarZonaEscena(vieja, tipo, nueva) {
    const todo = Object.assign({}, C.state.guionFijos || {});
    const f = Object.assign({ si: [], no: [] }, todo.escenas || {});
    const es = (z, x) => x && Number(z.desde) === Number(x.desde) && Number(z.hasta) === Number(x.hasta);
    const cruza = (z) => nueva && Number(z.desde) <= Number(nueva.hasta) && Number(z.hasta) >= Number(nueva.desde);
    const fuera = (lista) => (lista || []).filter((z) => !es(z, vieja) && !cruza(z));
    f.si = fuera(f.si); f.no = fuera(f.no);
    if (tipo === 'si') f.si = f.si.concat([nueva]);
    else if (tipo === 'no') f.no = f.no.concat([nueva]);
    todo.escenas = f;
    C.setState({ guionFijos: todo });
  }
  /* (24-sep) Las marcas de antes (sin duración): las seguidas se juntan en una escena con la duración de sus líneas
     (mínimo 3,5 s) — lo mismo que hace apoyo.js — y se guarda, para que el panel diga cuánto dura de verdad. */
  let normalizando = false;
  function normalizarEscenas(lineas) {
    const f = (C.state.guionFijos || {}).escenas;
    if (normalizando || !f || !(f.si || []).some((z) => !z.segundos)) return;
    const t = (idx, fin) => {
      const L = lineas.find((x) => x.desde <= idx && x.hasta >= idx);
      const w = L && Array.isArray(L.tp) ? L.tp[idx - L.desde] : null;
      return w ? w[fin ? 1 : 0] : null;
    };
    const con = f.si.filter((z) => z.segundos);
    const unidas = [];
    f.si.filter((z) => !z.segundos).sort((a, b) => a.desde - b.desde).forEach((z) => {
      const u = unidas[unidas.length - 1];
      if (u && z.desde <= u.hasta + 1) u.hasta = Math.max(u.hasta, z.hasta); else unidas.push({ desde: z.desde, hasta: z.hasta });
    });
    unidas.forEach((u) => {
      const a = t(u.desde, false), b = t(u.hasta, true);
      u.segundos = Math.max(3.5, a != null && b != null ? Math.round((b - a) * 10) / 10 : DUR_ESCENA);
      u.hasta = Math.max(u.hasta, hastaEscena(u.desde, lineas, u.segundos));
    });
    normalizando = true;
    setTimeout(() => {
      normalizando = false;
      const todo = Object.assign({}, C.state.guionFijos || {});
      todo.escenas = Object.assign({}, f, { si: con.concat(unidas) });
      C.setState({ guionFijos: todo });
    }, 0);
  }
  function mandoEscena(l, lineas) {
    const e = zonaEscena(l);
    const abierta = !!(e && C.state.escenaAbierta === Number(e.z.desde));
    const titulo = !e ? 'Pon aquí una escena de apoyo y dile cuánto dura.'
      : e.tipo === 'si' ? 'Aquí va una escena. Toca para cambiarle la duración o quitarla.'
      : 'Aquí no va ninguna escena. Toca para cambiarlo.';
    return h('button', { class: 'gu-b gu-b--' + (e ? e.tipo : 'auto') + (abierta ? ' gu-b--abierta' : ''), type: 'button', title: titulo,
      onClick: (ev) => {
        ev.preventDefault();
        if (!e) {
          const z = { desde: l.desde, hasta: hastaEscena(l.desde, lineas, DUR_ESCENA), segundos: DUR_ESCENA };
          cambiarZonaEscena(null, 'si', z);
          C.setState({ escenaAbierta: z.desde, pantallaAbierta: null });
        } else C.setState({ escenaAbierta: abierta ? null : Number(e.z.desde), pantallaAbierta: null });
      } },
      h('span', { class: 'gu-b__i' }, e ? (e.tipo === 'si' ? '✓' : '✕') : '·'), 'Escena');
  }
  /* (24-sep) Las categorías de la biblioteca (una vez) y las tomas que se están buscando */
  const CATS = { lista: null, pidiendo: false };
  const buscandoTomas = {};
  function categoriasEscena() {
    if (CATS.lista || CATS.pidiendo || !C.api || !C.api.edgeFetch) return CATS.lista || [];
    CATS.pidiendo = true;
    C.api.edgeFetch('biblioteca', { accion: 'categorias' }).then((r) => {
      CATS.lista = (r && Array.isArray(r.categorias) ? r.categorias : []).map((c) => ({ id: c.categoria, name: c.categoria }));
      C.render();
    }).catch(() => { CATS.pidiendo = false; });
    return [];
  }
  function escogerCategoria(zs, cat, lineas) {
    const base = { desde: zs.desde, hasta: zs.hasta, segundos: zs.segundos || DUR_ESCENA };
    if (!cat) { cambiarZonaEscena(zs, 'si', base); return; }
    const texto = lineas.filter((x) => Number(zs.desde) <= x.hasta && Number(zs.hasta) >= x.desde).map((x) => x.texto).join(' ');
    buscandoTomas[zs.desde] = cat; C.render();
    C.api.edgeFetch('biblioteca', { accion: 'tomas', categoria: cat, texto }).then((r) => {
      delete buscandoTomas[zs.desde];
      const tomas = r && Array.isArray(r.tomas) ? r.tomas : [];
      if (!tomas.length) { C.render(); return; }
      cambiarZonaEscena(zs, 'si', Object.assign(base, { categoria: cat, tomas }));
    }).catch(() => { delete buscandoTomas[zs.desde]; C.render(); });
  }
  function editorEscena(l, lineas) {
    const ab = C.state.escenaAbierta;
    if (ab == null || !(Number(ab) >= l.desde && Number(ab) <= l.hasta)) return null;   // debajo de donde EMPIEZA
    const f = (C.state.guionFijos || {}).escenas || {};
    const zs = (f.si || []).find((z) => Number(z.desde) === Number(ab));
    const zn = zs ? null : (f.no || []).find((z) => Number(z.desde) === Number(ab));
    const z = zs || zn;
    if (!z) return null;
    const cubre = lineas.filter((x) => Number(z.desde) <= x.hasta && Number(z.hasta) >= x.desde);
    const ult = cubre[cubre.length - 1];
    const ultimas = ult ? ult.texto.split(' ').slice(0, Math.max(1, Number(z.hasta) - ult.desde + 1)).slice(-3).join(' ') : '';
    const cerrar = () => C.setState({ escenaAbierta: null });
    return h('div', { class: 'pan pan--escena' },
      h('div', { class: 'label', style: { marginBottom: '6px' } }, 'Escena de apoyo'),
      zs
        ? h('div', null,
            h('div', { class: 'row__desc pan-nota' }, 'Cherry pone aquí, desde esta línea, una toma de su biblioteca que va con lo que dices.'),
            h('div', { class: 'pan-dura' },
              h('label', { class: 'pan-seg' }, 'Dura ',
                h('input', { type: 'number', min: '1', max: '30', step: '0.5', value: String(zs.segundos || DUR_ESCENA),
                  onChange: (ev) => {
                    const v = Math.max(1, Math.min(30, Number(String(ev.target.value).replace(',', '.')) || 0));
                    if (!v) return;
                    // conserva la categoría, sus tomas y «otra toma»
                    cambiarZonaEscena(zs, 'si', Object.assign({}, zs, { hasta: hastaEscena(zs.desde, lineas, v), segundos: v }));
                  } }), ' segundos'),
              h('span', null, 'Va por ' + cubre.length + (cubre.length === 1 ? ' línea' : ' líneas') + (ultimas ? ', hasta «' + ultimas + '»' : ''))),
            /* (24-sep) la categoría: Cherry busca dentro de ella lo que mejor va con lo que dices */
            h('div', { class: 'pan-cat' },
              h('span', { class: 'pan-cat__r' }, 'Categoría'),
              ui.select([{ id: '', name: 'La que escoja Cherry' }].concat(categoriasEscena()), zs.categoria || '',
                (v) => escogerCategoria(zs, v, lineas))),
            buscandoTomas[zs.desde]
              ? h('div', { class: 'row__desc pan-nota' }, h('span', { class: 'spinner' }), ' Buscando tomas de «' + buscandoTomas[zs.desde] + '»…')
              : h('div', { class: 'pan-toma' },
                  h('span', { class: 'pan-toma__t' }, zs.tomas && zs.tomas.length
                    ? 'Toma: ' + zs.tomas[(zs.saltar || 0) % zs.tomas.length].texto
                    : 'Toma: la escoge Cherry'),
                  h('button', { class: 'gu-b', type: 'button', title: '¿No te gusta? Pasa a la siguiente',
                    onClick: () => cambiarZonaEscena(zs, 'si', Object.assign({}, zs, { saltar: (zs.saltar || 0) + 1 })) }, 'Otra toma')))
        : h('div', { class: 'row__desc pan-nota' }, 'Aquí no va ninguna escena: Cherry no pondrá una.'),
      h('div', { class: 'pan-pie' },
        zs
          ? h('button', { class: 'gu-b gu-b--no', type: 'button', title: 'Que en esta parte no salga ninguna escena',
              onClick: () => cambiarZonaEscena(zs, 'no', { desde: zs.desde, hasta: zs.hasta }) }, 'Aquí no va escena')
          : h('button', { class: 'gu-b', type: 'button',
              onClick: () => cambiarZonaEscena(zn, 'si', { desde: zn.desde, hasta: hastaEscena(zn.desde, lineas, DUR_ESCENA), segundos: DUR_ESCENA }) }, 'Poner escena'),
        h('button', { class: 'gu-b', type: 'button', title: 'Quitar lo que fijaste: Cherry decide si va o no',
          onClick: () => { cambiarZonaEscena(z, null, null); cerrar(); } }, 'Que decida Cherry'),
        h('button', { class: 'gu-b', type: 'button', onClick: cerrar }, 'Listo')));
  }

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
        (S.MARCA && S.MARCA[pl])
          ? h('span', null, 'acento ', ui.punto(mios.acento || base.acento), ' · letra ' + ((mios.texto || base.texto).toUpperCase() === '#111111' ? 'negra' : 'blanca'))
          : h('span', null, 'texto ', ui.punto(mios.texto || base.texto), base.acento ? ' · clave ' : '', base.acento ? ui.punto(mios.acento || base.acento) : null),
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

  /* (24-sep) LA VOZ DE ESTUDIO. Sergio escogió de oído «Estudio» (Auphonic «Studio Voice»). La pone el ensamblador
     sobre la voz ya cortada; aquí se prende y se dice cómo salió el video que se está viendo (renders.voz_estudio). */
  const vozVista = { renderId: null, dato: null, pidiendo: false };
  function estadoVoz(s) {
    if (s.renderId && vozVista.renderId !== s.renderId && !vozVista.pidiendo) {
      vozVista.pidiendo = true;
      const id = s.renderId;
      C.api.getRenderData(id).then((d) => {
        vozVista.renderId = id; vozVista.dato = d ? { v: d.voz_estudio || null, pedida: !!(d.subtitle_config && d.subtitle_config.voz === 'estudio') } : null;
      }).catch(() => { vozVista.renderId = id; vozVista.dato = null; }).then(() => { vozVista.pidiendo = false; C.render(); });
    }
    const d = vozVista.renderId === s.renderId ? vozVista.dato : null;
    if (!s.vozEstudio) return d && d.v && d.v.estado === 'lista' ? 'Este video tiene la voz de estudio: al apagarla, Cherry lo rehace con tu voz normal.' : null;
    const v = d && d.v;
    if (v && v.estado === 'lista') return '✓ Este video ya tiene tu voz de estudio.';
    if (v && v.estado === 'cortinilla') return '⚠ Este video salió con tu voz normal: la cuenta de Auphonic es la gratis y le pone su cortinilla. Con crédito en Auphonic, vuelve a generar.';
    if (v && (v.estado === 'error' || v.estado === 'tarde')) return '⚠ Este video salió con tu voz normal (' + (v.detalle || 'no se pudo mejorar') + '). Vuelve a generar para intentarlo otra vez.';
    return 'Va en el próximo video: Cherry lo rehace solo en segundo plano. La primera vez tarda 1–2 minutos más.';
  }

  P.audio = function () {
    const s = C.state;
    const aviso = estadoVoz(s);
    return C.frag(
      ui.switchRow('Voz de estudio', 'Limpia tu voz y la reconstruye como grabada en estudio', s.vozEstudio, flip('vozEstudio')),
      aviso ? h('div', { class: 'row__desc voz-aviso' + (/^⚠/.test(aviso) ? ' voz-aviso--mal' : /^✓/.test(aviso) ? ' voz-aviso--bien' : '') }, aviso) : null,
      s.vozEstudio ? h('div', { class: 'row__desc voz-nota' }, 'Se procesa una vez por video. Cambiar sonidos, gráficos o subtítulos no la repite; cambiar los cortes sí.') : null,
      ui.divider({ margin: '12px 0 14px' }),
      seccionEfectos(s),
      ui.divider({ margin: '14px 0 14px' }),
      ui.label('Música'),
      ui.select(D.musics, s.music, set('music'), { marginBottom: '10px' }),
      h('div', { class: 'mono beat' },
        h('span', { class: 'beat__bars' }, [5, 11, 7, 10].map((hh) => h('span', { style: { height: hh + 'px' } }))),
        'Beat sync · cortes al ritmo'
      ),
      ui.slider({ key: 'musicVol', label: 'Música vs. voz', labelFn: (v) => v + '%', style: { marginBottom: '6px' } })
    );
  };

  /* (24-sep) EFECTOS DE SONIDO CON CHERRY. Sergio: «un botón para agregar efectos a criterio de Cherry en todo el video
     (siempre en todos los movimientos de cámara), y yo desde el guion borro los que no me gusten o añado otros».
     Reemplaza el interruptor y la «librería de SFX» de muestra (no hacían nada). */
  function seccionEfectos(s) {
    const A = C.sonidosAuto;
    if (!A) return null;
    const hayVideo = !!(s.renderId && s.phase === 'done');
    const M = hayVideo && C.cortesVivo && C.cortesVivo.momentos ? C.cortesVivo.momentos() : null;
    const hay = A.hayAuto(), res = A.resumen(), aviso = A.aviso();
    const movOn = !!(C.movCfg && C.movCfg());
    return C.frag(
      ui.label('Efectos de sonido'),
      h('div', { class: 'row__desc', style: { marginBottom: '8px' } },
        'Cherry los pone en ' + (movOn ? 'cada movimiento de cámara, ' : '') + 'las escenas, los gráficos, las pantallas y las frases de impacto. ' +
        'Los cambias o borras desde el Guion.'),
      !movOn ? h('div', { class: 'row__desc voz-nota' }, 'Con Movimiento de cámara apagado no hay movimientos que sonar.') : null,
      h('div', { class: 'son-auto' },
        h('button', { class: 'btn btn--accent', type: 'button', disabled: !M, onClick: () => A.poner() },
          !hayVideo ? 'Primero haz el video' : !M ? 'Leyendo el video…' : hay ? '✦ Volver a repartir' : '✦ Que Cherry los ponga'),
        hay ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => A.quitar() }, 'Quitar los de Cherry') : null,
        (s.sonidos || []).length ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => C.actions.openCard('guion') }, 'Ver en el Guion') : null),
      res ? h('div', { class: 'row__desc voz-aviso voz-aviso--bien' }, res) : null,
      aviso ? h('div', { class: 'row__desc voz-aviso voz-aviso--mal' }, aviso) : null,
      hay ? h('div', { class: 'row__desc voz-nota' }, 'Se oyen ya en la vista previa; Cherry rehace el video con ellos en segundo plano. El que cambies en el Guion pasa a ser tuyo.') : null
    );
  }

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

  /* ── (28-sep) HSL: un color con su tono, saturación y luz. Sergio: «seleccionar un color y modificarlo: si hay una
        planta verde, selecciono verde y ese verde lo puedo cambiar a rojo… o aumentarle o disminuirle la saturación,
        pero solamente de ese color». Los 8 colores y «Tu color» (se escoge tocando el video). Las pistas de los
        controles muestran a qué color va. El motor lo hace natural (motor-color.js › aplicarHsl). ── */
  // gotero: ícono «pipette» de Lucide (licencia ISC)
  const PIPETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';
  // «Ver qué cambia»: ícono «eye» de Lucide (licencia ISC)
  const OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>';
  const aCss = (c) => 'rgb(' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',') + ')';
  const VISTAS_COLOR = [{ id: 'luz', name: 'Luz y color' }, { id: 'hsl', name: 'Un color (HSL)' }];
  function panelHsl(sec) {
    const s = C.state, MC = window.CherryColor, p = C.PREFIJO_HSL[sec];
    const BANDAS = MC.BANDAS;
    const hayPropio = s[p + 'propio_h'] != null;
    let sel = s[p + 'sel'] || 'verde';
    if (sel === 'propio' && !hayPropio) sel = 'verde';
    const banda = BANDAS.find((b) => b.k === sel);
    const h0 = sel === 'propio' ? Number(s[p + 'propio_h']) : banda.h;
    const apuntando = s.hslGotero === sec;
    const escoger = () => C.setState({ hslGotero: apuntando ? null : sec, hslAviso: '' });
    // (lo que se ve en el celular con «Ver qué cambia»: colorvivo.js › receta)
    const elegir = (k) => C.setState({ [p + 'sel']: k, hslAviso: '' });
    // pistas: el tono da la vuelta completa alrededor del color; la saturación va del gris al color; la luz, de oscuro a claro
    const pistas = {
      tono: 'linear-gradient(90deg,' + Array.from({ length: 13 }, (_, i) => aCss(MC.colorDeTono(h0 + (i / 6 - 1) * 180, 62, 40))).join(',') + ')',
      sat: 'linear-gradient(90deg,' + aCss(MC.colorDeTono(h0, 62, 0)) + ',' + aCss(MC.colorDeTono(h0, 62, 60)) + ')',
      luz: 'linear-gradient(90deg,' + aCss(MC.colorDeTono(h0, 18, 18)) + ',' + aCss(MC.colorDeTono(h0, 55, 40)) + ',' + aCss(MC.colorDeTono(h0, 92, 14)) + ')',
    };
    const extremos = {
      tono: ['Hacia el ' + MC.bandaDeTono(h0 - 60).uno, 'Hacia el ' + MC.bandaDeTono(h0 + 60).uno],
      sat: ['Menos color', 'Más color'], luz: ['Más oscuro', 'Más claro'],
    };
    const nombres = { tono: 'Tono', sat: 'Saturación', luz: 'Luz' };
    return h('div', { class: 'hsl' },
      h('div', { class: 'hsl-muestras' },
        BANDAS.map((b) => h('button', {
          class: 'hsl-m' + (sel === b.k ? ' hsl-m--sel' : '') + (C.hslMovido(sec, b.k) ? ' hsl-m--movido' : ''),
          style: { background: b.muestra }, title: b.nombre, 'aria-label': b.nombre, onClick: () => elegir(b.k),
        })),
        // «Tu color»: el que se tocó en el video; sin escoger todavía, el gotero
        h('button', {
          class: 'hsl-m hsl-m--tuyo' + (sel === 'propio' ? ' hsl-m--sel' : '') + (hayPropio ? '' : ' hsl-m--vacio') +
            (hayPropio && C.hslMovido(sec, 'propio') ? ' hsl-m--movido' : '') + (apuntando ? ' hsl-m--apuntando' : ''),
          style: hayPropio ? { background: s[p + 'propio_hex'] } : null,
          title: hayPropio ? 'Tu color' : 'Escoge un color tocando el video', 'aria-label': 'Tu color',
          onClick: () => (hayPropio && sel !== 'propio' ? elegir('propio') : escoger()),
          html: hayPropio ? null : PIPETA,
        })
      ),
      h('div', { class: 'aj-cabeza' },
        h('span', { class: 'label', style: { marginBottom: '0' } }, 'Ajustar: ' + (sel === 'propio' ? 'Tu color' : banda.nombre)),
        C.hslMovido(sec, sel) && h('button', { class: 'aj-reset', onClick: () => C.restablecerHsl(sec, sel) }, 'Restablecer')),
      // tocar el video para escoger «Tu color» · ver en el celular qué agarra el color escogido (lo demás en gris)
      h('div', { class: 'hsl-acciones' },
        h('button', { class: 'aj-reset hsl-gotero' + (apuntando ? ' hsl-gotero--on' : ''), onClick: escoger, title: 'Escoger un color tocando el video' },
          h('span', { class: 'hsl-gotero__ic', html: PIPETA }), apuntando ? 'Cancelar' : 'Tocar el video'),
        h('button', { class: 'aj-reset hsl-gotero' + (s.hslVer ? ' hsl-gotero--on' : ''), onClick: () => C.setState({ hslVer: !s.hslVer }),
          title: 'En el celular: lo que cambia va en color y lo demás en gris' },
          h('span', { class: 'hsl-gotero__ic', html: OJO }), s.hslVer ? 'Volver al color' : 'Ver qué cambia')),
      (apuntando || s.hslAviso) && h('div', { class: 'hsl-aviso' + (apuntando ? ' hsl-aviso--apuntando' : '') },
        apuntando ? 'Toca en el video el color que quieres cambiar.' : s.hslAviso),
      C.CONTROLES_HSL.map((k) => h('div', { class: 'aj' },
        ui.slider({ key: p + sel + '_' + k, label: nombres[k], min: -100, max: 100, step: 5, labelFn: conSigno, pista: pistas[k] }),
        h('div', { class: 'aj__extremos' }, h('span', null, extremos[k][0]), h('span', null, extremos[k][1]))))
    );
  }
  const coloresMovidos = (sec) => C.COLORES_HSL.filter((b) => C.hslMovido(sec, b) && (b !== 'propio' || C.state[C.PREFIJO_HSL[sec] + 'propio_h'] != null)).length;

  function seccionColor() {
    const s = C.state;
    const MC = window.CherryColor;
    const hayLook = s.look !== 'ninguno' && D.looks.some((l) => l.id === s.look) && (s.look !== 'referencia' || !!(s.lookRef && s.lookRef.receta));
    const lookSel = hayLook && MC ? MC.lookDe(s.look, s.lookRef && s.lookRef.receta) : null;
    const ajustes = MC ? MC.AJUSTES : [];
    const tocado = s.lookFuerza !== 100 || ajustes.some((a) => Number(s['aj_' + a.k]));
    const enVivo = C.colorVivo && C.colorVivo.fuente(s);
    // (27-sep) corrección general: otro grupo, aparte del look y encima de él
    const correccion = MC && MC.CORRECCION ? MC.CORRECCION : [];
    const nCorr = correccion.filter((a) => Number(s['cg_' + a.k])).length;
    const nHslG = coloresMovidos('general');
    const conMascara = !!(lookSel && lookSel.mascara);
    return h('div', null,
      ui.label('Look'),
      h('div', { class: 'looks' },
        D.looks.map((l) => {
          // (fase 3) «Tu referencia»: sin referencia todavía, tocarla abre el selector de archivos
          const esRef = l.id === 'referencia', conRef = esRef && s.lookRef && s.lookRef.receta;
          return h('button', {
            class: 'look' + (s.look === l.id && (!esRef || conRef) ? ' look--sel' : ''), title: l.desc,
            onClick: () => (esRef && !conRef ? C.referenciaColor && C.referenciaColor.escoger() : C.setState(C.patchDeLook ? C.patchDeLook(l.id) : { look: l.id })),
          },
            h('span', { class: 'look__foto look__foto--' + l.id + (conRef && s.lookRef.img ? ' look__foto--img' : ''),
              style: conRef && s.lookRef.img ? { backgroundImage: 'url(' + s.lookRef.img + ')' } : null }),
            h('span', { class: 'look__nom' }, l.name)
          );
        })
      ),
      (s.refEstado || s.refError) && h('div', { class: 'ref-aviso' + (s.refError ? ' ref-aviso--error' : '') }, s.refEstado || s.refError),
      s.look === 'referencia' && s.lookRef && s.lookRef.receta && h('div', { class: 'ref-caja' },
        s.lookRef.img && h('img', { class: 'ref-caja__img', src: s.lookRef.img, alt: '' }),
        h('div', { class: 'ref-caja__txt' },
          h('span', { class: 'label', style: { marginBottom: '2px' } }, 'Lo que Cherry vio'),
          h('span', { class: 'row__desc' }, s.lookRef.desc || 'El color de la imagen que subiste, llevado a tus tomas.'),
          h('button', { class: 'aj-reset', style: { justifySelf: 'start', marginTop: '6px' }, onClick: () => C.referenciaColor && C.referenciaColor.escoger() }, 'Cambiar la referencia'))),
      h('div', { class: 'row__desc', style: { margin: '10px 0 16px' } },
        (D.looks.find((l) => l.id === s.look) || D.looks[0]).desc,
        conMascara && h('span', { style: { display: 'block', marginTop: '6px' } }, 'Cherry recorta a la persona para colorearla aparte: la primera vez tarda unos segundos por video.')),

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

      ui.grupo('edicion', 'correccion', 'Corrección general',
        [nCorr ? nCorr + (nCorr === 1 ? ' ajuste' : ' ajustes') : '', nHslG ? nHslG + (nHslG === 1 ? ' color' : ' colores') : '']
          .filter(Boolean).join(' · ') || 'sin tocar',
        () => h('div', null,
          ui.chips(VISTAS_COLOR, s.cgVista === 'hsl' ? 'hsl' : 'luz', (v) => C.setState({ cgVista: v, hslGotero: null, hslAviso: '', hslVer: false }), { marginBottom: '12px' }),
          s.cgVista === 'hsl' ? panelHsl('general') : h('div', null,
            h('div', { class: 'aj-cabeza' },
              h('span', { class: 'row__desc', style: { margin: '0' } }, 'Va encima del look y no cambia sus valores. También sirve sin look.'),
              nCorr > 0 && h('button', { class: 'aj-reset', onClick: () => C.restablecerCorreccion() }, 'Restablecer')
            ),
            // en dos columnas: los 8 caben en una pantalla, sin bajar
            h('div', { class: 'cg-rejilla' }, correccion.map((a) => h('div', { class: 'aj' },
              ui.slider({ key: 'cg_' + a.k, label: a.nombre, min: -100, max: 100, step: 5, labelFn: conSigno }),
              h('div', { class: 'aj__extremos' }, h('span', null, a.menos), h('span', null, a.mas))
            ))))
        )),

      /* (28-sep) ZONAS: el fondo, la piel y la ropa por separado, encima del look. Sergio: «lo que nunca debe cambiar es
         el borde entre la persona y el fondo»: la silueta va suavizada (la misma del look Selectivo). */
      (() => {
        const MZ = MC && MC.ZONAS ? MC.ZONAS : [];
        const sel = MZ.some((z) => z.k === s.zonaSel) ? s.zonaSel : 'piel';
        const pre = C.PREFIJO_ZONA[sel];
        const tocadas = MZ.filter((z) => correccion.some((a) => Number(s[C.PREFIJO_ZONA[z.k] + a.k])) || coloresMovidos(z.k));
        const tocadaSel = correccion.some((a) => Number(s[pre + a.k]));
        const enHsl = s.zVista === 'hsl';
        return ui.grupo('edicion', 'zonas', 'Fondo, piel y ropa', tocadas.length ? tocadas.map((z) => z.nombre.toLowerCase()).join(', ') : 'sin tocar',
          () => h('div', null,
            h('div', { class: 'row__desc', style: { margin: '0 0 12px' } },
              'Cada zona con sus controles, encima del look. El borde entre tú y el fondo siempre queda integrado. La primera vez Cherry recorta a la persona: tarda unos segundos por video.'),
            ui.chips(MZ.map((z) => ({ id: z.k, name: z.nombre })), sel, (v) => C.setState({ zonaSel: v, hslGotero: null, hslAviso: '' }), { marginBottom: '10px' }),
            ui.chips(VISTAS_COLOR, enHsl ? 'hsl' : 'luz', (v) => C.setState({ zVista: v, hslGotero: null, hslAviso: '', hslVer: false }), { marginBottom: '12px' }),
            enHsl ? panelHsl(sel) : h('div', null,
              h('div', { class: 'aj-cabeza' },
                h('span', { class: 'label', style: { marginBottom: '0' } }, 'Ajustar: ' + (MZ.find((z) => z.k === sel) || {}).nombre),
                tocadaSel && h('button', { class: 'aj-reset', onClick: () => C.restablecerZona(sel) }, 'Restablecer')),
              h('div', { class: 'cg-rejilla' }, correccion.map((a) => h('div', { class: 'aj' },
                ui.slider({ key: pre + a.k, label: a.nombre, min: -100, max: 100, step: 5, labelFn: conSigno }),
                h('div', { class: 'aj__extremos' }, h('span', null, a.menos), h('span', null, a.mas))))))));
      })(),

      /* (28-sep, fase 4) OSCILOSCOPIOS: la forma de onda, el vectorscopio con la línea de piel y los avisos (negros
         lavados, blancos quemados, piel fuera de rango) con su arreglo. Miden lo que se ve en el celular. */
      enVivo && C.osciloscopio && ui.grupo('edicion', 'osciloscopios', 'Osciloscopios', 'revisa negros, blancos y piel',
        () => C.osciloscopio.caja()),

      ui.switchRow('Revelado', 'Iguala tus tomas: Cherry mide cada clip y deja el negro en su sitio, el blanco neutro y tu piel con la misma luz y el mismo tono en todas. Va antes del look.',
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

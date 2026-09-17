/* result.js — «corte final» (diseño "night shift") con los datos reales del render:
   video real, transcripción editable, escenas gráficas editables y exportar con cambios. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data, U = C.util;

  // El <video> del editor sale de C.videoFijo (mientras se redibuja todavía no está en el documento)
  const videoEditor = () => {
    const v = C.videoFijo.get('editor');
    const url = C.state.editorVideoUrl;
    return v && url && v.getAttribute('src') === C.urlVideo(url) ? v : null;
  };

  function fmtMs(ms) { return U.fmtTime((ms || 0) / 1000); }

  /* Duración de la línea de tiempo: la del video si ya se sabe */
  function duracionTotal(s) {
    const v = videoEditor();
    if (v && v.duration) return v.duration;
    const sc = s.editorScenes || [];
    return sc.length ? Math.max(60, Math.round(sc[sc.length - 1].timestamp_ms / 1000) + 15) : 60;
  }

  /* ── Celular con el video real ── */
  function telefono(s) {
    const url = s.editorVideoUrl;
    let pantalla;
    if (!url) {
      pantalla = [
        h('div', { class: 'screen__off-sheen' }),
        h('div', { class: 'screen__off-body' },
          h('div', { class: 'screen__off-ring' }, '◦'),
          h('div', { class: 'screen__off-kicker' }, 'sin video'),
          h('div', { class: 'screen__off-copy' }, 'El video aparece aquí tras generar'))
      ];
    } else {
      const v = C.videoFijo('editor', C.urlVideo(url), {
        class: 'ed-video screen__video', playsinline: true, preload: 'auto',
        onTimeupdate: (e) => {
          const t = e.target;
          document.querySelectorAll('.js-ed-tc').forEach((el) => (el.textContent = U.fmtTime(t.currentTime)));
          if (t.duration) document.querySelectorAll('.js-ed-head').forEach((el) => (el.style.left = (t.currentTime / t.duration) * 100 + '%'));
        },
        onLoadedmetadata: (e) => document.querySelectorAll('.js-ed-total').forEach((el) => (el.textContent = U.fmtTime(e.target.duration))),
        onPlay: () => document.querySelectorAll('.js-ed-play').forEach((el) => { el.className = 'js-ed-play pause'; el.innerHTML = '<i></i><i></i>'; }),
        onPause: () => document.querySelectorAll('.js-ed-play').forEach((el) => { el.className = 'js-ed-play tri tri--dark'; el.innerHTML = ''; }),
        onClick: (e) => { const t = e.target; if (t.paused) t.play().catch(() => null); else t.pause(); },
      });
      pantalla = [
        v,
        h('div', { class: 'chip-tc', style: { position: 'absolute', top: '7%', left: '8%' } },
          h('span', { class: 'js-ed-tc' }, U.fmtTime(v.currentTime || 0)), ' / ',
          h('span', { class: 'js-ed-total' }, U.fmtTime(v.duration || 0)))
      ];
    }
    return h('div', { class: 'result__col' },
      h('div', { class: 'result__phone' }, h('div', { class: 'result__screen' }, pantalla, h('div', { class: 'screen__island' }))),
      h('div', { class: 'kicker', style: { textAlign: 'center' } }, 'Haz clic en la línea de tiempo para editar un elemento')
    );
  }

  /* ── Transcripción editable ── */
  function transcripcion(s) {
    const words = s.editorTranscript || [];
    if (s.renderId && !s.editorData && words.length === 0) {
      return h('div', { class: 'ed-empty' }, h('span', { class: 'spinner' }), 'Cargando transcripción…');
    }
    if (!words.length) {
      return h('div', { class: 'ed-empty' }, 'Disponible en el próximo render: el sistema guarda la transcripción completa para editarla aquí.');
    }
    // Frases por pausas de más de 1 s
    const phrases = []; let cur = [];
    words.forEach((w) => {
      if (cur.length && Number(w.start) - Number(cur[cur.length - 1].end) > 1.0) { phrases.push(cur); cur = []; }
      cur.push(w);
    });
    if (cur.length) phrases.push(cur);
    const removedCount = words.filter((w) => w.removed).length;

    return h('div', null,
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        ui().label('Texto', { marginBottom: '0' }),
        removedCount > 0 && h('span', { class: 'ed-badge' }, removedCount + ' eliminadas')
      ),
      h('div', { class: 'ed-transcript', 'data-scroll': 'ed-transcript' },
        phrases.map((phrase) =>
          h('div', { class: 'ed-phrase' },
            h('span', { class: 'ed-phrase__time' }, U.fmtTime(Number(phrase[0].start))),
            h('span', { class: 'ed-phrase__words' },
              phrase.map((w) => {
                const removed = w.removed;
                return h('span', {
                  class: 'ed-word' + (removed ? ' ed-word--removed' : ''),
                  title: removed ? 'Eliminada — clic para restaurar' : 't=' + U.fmtTime(w.start),
                  contentEditable: removed ? 'false' : 'true',
                  onClick: removed
                    ? () => {
                        const wi = words.indexOf(w);
                        if (wi >= 0) {
                          const updated = words.slice();
                          updated[wi] = Object.assign({}, w, { removed: false });
                          C.setState({ editorTranscript: updated });
                        }
                      }
                    : () => { const v = videoEditor(); if (v) v.currentTime = Number(w.start); },
                  onBlur: removed ? null : (e) => {
                    const wi = words.indexOf(w);
                    if (wi >= 0) {
                      const updated = words.slice();
                      updated[wi] = Object.assign({}, w, { word: e.target.textContent || w.word });
                      C.state.editorTranscript = updated;
                    }
                  },
                }, w.word);
              })
            )
          )
        )
      ),
      h('div', { class: 'ed-legend' },
        h('span', null, '■ Normal'),
        h('span', { style: { color: 'var(--magenta)' } }, '■ Eliminada (clic = restaurar)'))
    );
  }

  /* ── Subtítulos frase por frase (17-sep): estilo de cada frase + palabra clave ──
     s.editorSubs = { plantilla, palabras[], frases[{ desde, hasta, clave:[a,b], cierra, estilo? }] } */
  function frasesSubs(s) {
    const S = C.subs;
    const subs = s.editorSubs;
    const pal = subs.palabras;
    const frases = subs.frases;
    const sel = Math.min(Math.max(0, s.editorFraseSel || 0), frases.length - 1);

    const cambiar = (fi, cambio) => {
      const nuevas = frases.slice();
      nuevas[fi] = Object.assign({}, frases[fi], cambio);
      C.setState({ editorSubs: Object.assign({}, subs, { frases: nuevas }), editorFraseSel: fi });
    };
    const opcionesGeneral = S.PLANTILLAS.concat([S.SIMPLE]).map((p) => ({ id: p.id, name: p.name }));
    const opcionesFrase = [{ id: '', name: 'General' }].concat(opcionesGeneral, [{ id: 'ninguno', name: 'Sin subtítulo' }]);
    const estiloDe = (f) => f.estilo || subs.plantilla;
    // Corregir el texto de una palabra (lo mal oído); los tiempos no cambian. Si vuelve a lo que decía, deja de estar marcada
    const corregir = (i, valor) => {
      const texto = String(valor || '').replace(/\s+/g, ' ').trim();
      const w = pal[i];
      const original = w.original != null ? w.original : w.word;
      if (!texto || texto === w.word) { C.render(); return; }
      const nuevas = pal.slice();
      nuevas[i] = texto === original
        ? { word: original, start: w.start, end: w.end }
        : { word: texto, start: w.start, end: w.end, original };
      C.setState({ editorSubs: Object.assign({}, subs, { palabras: nuevas }) });
    };
    const corregidas = pal.filter((w) => w.original != null).length;

    // Varias frases a la vez: marcar (Shift = rango desde la última marcada) y aplicar un estilo de un solo toque
    const marcadas = new Set((s.editorMarcadas || []).filter((i) => i < frases.length));
    const marcar = (fi, rango) => {
      const nuevo = new Set(marcadas);
      const ultima = s.editorUltimaMarca;
      if (rango && ultima != null && ultima < frases.length) {
        const a = Math.min(ultima, fi), b = Math.max(ultima, fi);
        for (let i = a; i <= b; i++) nuevo.add(i);
      } else if (nuevo.has(fi)) nuevo.delete(fi);
      else nuevo.add(fi);
      C.setState({ editorMarcadas: Array.from(nuevo).sort((x, y) => x - y), editorUltimaMarca: fi });
    };
    const aplicarLote = (valor) => {
      const nuevas = frases.map((f, i) => (marcadas.has(i) ? Object.assign({}, f, { estilo: valor || undefined }) : f));
      C.setState({ editorSubs: Object.assign({}, subs, { frases: nuevas }) });
    };

    // Vista previa de la frase elegida con su estilo
    const f0 = frases[sel];
    const vista = {
      palabras: pal.slice(f0.desde, f0.hasta + 1).map((w) => w.word),
      clave: [f0.clave[0] - f0.desde, f0.clave[1] - f0.desde],
      cierra: !!f0.cierra,
    };
    const propias = frases.filter((f) => f.estilo).length;

    return h('div', null,
      ui().label('Estilo general'),
      ui().select(opcionesGeneral, subs.plantilla, (v) => C.setState({ editorSubs: Object.assign({}, subs, { plantilla: v }) }), { marginBottom: '14px' }),
      h('div', { class: 'ed-subs-prev' }, S.marco(estiloDe(f0), vista, S.simpleVista(s))),
      ui().label('Corregir palabras de esta frase', { marginBottom: '6px' }),
      h('div', { class: 'ed-corrige' },
        rangoIdx(f0.desde, f0.hasta).map((i) => {
          const w = pal[i];
          return h('input', {
            class: 'ed-corrige__in' + (w.original != null ? ' ed-corrige__in--cambiada' : ''),
            value: w.word, size: Math.max(2, Array.from(w.word).length + 1), spellcheck: 'true',
            title: w.original != null ? 'Antes decía «' + w.original + '» · escríbelo igual para deshacer' : 'Escribe la palabra correcta',
            onInput: (e) => { e.target.size = Math.max(2, Array.from(e.target.value).length + 1); },
            onChange: (e) => corregir(i, e.target.value),
            onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
          });
        })
      ),
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        ui().label('Frases', { marginBottom: '0' }),
        h('span', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          corregidas > 0 && h('span', { class: 'ed-badge ed-badge--teal' }, corregidas + (corregidas === 1 ? ' corregida' : ' corregidas')),
          propias > 0 && h('span', { class: 'ed-badge' }, propias + ' con estilo propio'))
      ),
      h('div', { class: 'ed-lote' + (marcadas.size ? ' ed-lote--on' : '') },
        marcadas.size
          ? C.frag(
              h('span', { class: 'ed-lote__n' }, marcadas.size + (marcadas.size === 1 ? ' marcada' : ' marcadas')),
              h('select', {
                class: 'ed-frase__estilo ed-lote__estilo', title: 'Estilo para las frases marcadas',
                onChange: (e) => { if (e.target.value !== '__') aplicarLote(e.target.value); },
              },
                h('option', { value: '__', selected: 'selected' }, 'Aplicar estilo…'),
                opcionesFrase.map((o) => h('option', { value: o.id }, o.name))),
              h('button', { class: 'ed-lote__btn', onClick: () => C.setState({ editorMarcadas: [], editorUltimaMarca: null }) }, 'Quitar marcas')
            )
          : C.frag(
              h('span', { class: 'ed-lote__ayuda' }, 'Marca varias frases (Shift = rango) para darles un estilo de una vez'),
              h('button', { class: 'ed-lote__btn', onClick: () => C.setState({ editorMarcadas: frases.map((_, i) => i), editorUltimaMarca: null }) }, 'Marcar todas')
            )
      ),
      h('div', { class: 'ed-frases', 'data-scroll': 'ed-frases' },
        frases.map((f, fi) =>
          h('div', {
            class: 'ed-frase' + (fi === sel ? ' ed-frase--sel' : '') + (estiloDe(f) === 'ninguno' ? ' ed-frase--off' : '') + (marcadas.has(fi) ? ' ed-frase--marcada' : ''),
            onClick: () => { if (fi !== sel) C.setState({ editorFraseSel: fi }); },
          },
            h('button', {
              class: 'ed-frase__marca' + (marcadas.has(fi) ? ' ed-frase__marca--on' : ''),
              title: 'Marcar esta frase (Shift = marcar un rango)', 'aria-pressed': marcadas.has(fi) ? 'true' : 'false',
              onClick: (e) => { e.stopPropagation(); marcar(fi, e.shiftKey); },
            }, marcadas.has(fi) ? '✓' : ''),
            h('button', {
              class: 'ed-frase__time', title: 'Ir a este momento',
              onClick: (e) => { e.stopPropagation(); const v = videoEditor(); if (v) { v.currentTime = Number(pal[f.desde].start) || 0; v.play().catch(() => null); } },
            }, U.fmtTime(Number(pal[f.desde].start))),
            h('span', { class: 'ed-frase__words' },
              rangoIdx(f.desde, f.hasta).map((i) =>
                h('span', {
                  class: 'ed-fw' + (i >= f.clave[0] && i <= f.clave[1] ? ' ed-fw--clave' : '') + (pal[i].original != null ? ' ed-fw--corregida' : ''),
                  title: (pal[i].original != null ? 'Corregida (antes: «' + pal[i].original + '») · ' : '') + 'Tocar para volverla la palabra clave',
                  onClick: (e) => { e.stopPropagation(); if (!(f.clave[0] === i && f.clave[1] === i)) cambiar(fi, { clave: [i, i] }); },
                }, pal[i].word)
              )
            ),
            h('select', {
              class: 'ed-frase__estilo' + (f.estilo ? ' ed-frase__estilo--propio' : ''), title: 'Estilo de esta frase',
              onClick: (e) => e.stopPropagation(),
              onChange: (e) => cambiar(fi, { estilo: e.target.value || undefined }),
            }, opcionesFrase.map((o) => h('option', { value: o.id, selected: (f.estilo || '') === o.id ? 'selected' : null }, o.name)))
          )
        )
      ),
      h('div', { class: 'ed-legend' },
        h('span', null, '■ Toca una palabra para volverla la clave'),
        h('span', { style: { color: 'var(--teal)' } }, '┄ Corregida (mal oída)'),
        h('span', { style: { color: 'var(--magenta)' } }, '■ Exportar aplica los cambios')),
      s.editorSubs && estiloDe(f0) === 'simple' && h('div', { class: 'ed-note', style: { marginTop: '10px' } },
        'La letra, el color y las animaciones de «A tu gusto» se ajustan en la tarjeta Texto.')
    );
  }
  const rangoIdx = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

  /* ── Escenas gráficas editables ── */
  function escenas(s) {
    const scenes = s.editorScenes || [];
    if (!scenes.length) return h('div', { class: 'ed-empty' }, 'Sin escenas gráficas — genera un video primero.');
    return h('div', { class: 'ed-scenes', 'data-scroll': 'ed-scenes' },
      scenes.map((sc, si) =>
        h('div', { class: 'ed-scene' + (s.editorSelScene === si ? ' ed-scene--sel' : ''), onClick: () => { if (s.editorSelScene !== si) C.setState({ editorSelScene: si }); } },
          h('div', { class: 'row', style: { marginBottom: '8px' } },
            h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--amber)' } }, fmtMs(sc.timestamp_ms)),
            h('button', {
              class: 'btn-round btn-round--sm', title: 'Ir a este momento',
              onClick: (e) => { e.stopPropagation(); const v = videoEditor(); if (v) { v.currentTime = (sc.timestamp_ms || 0) / 1000; v.play().catch(() => null); } },
            }, h('span', { class: 'tri tri--dark' }))
          ),
          ui().label('Protagonista', { marginBottom: '6px' }),
          h('input', {
            class: 'ed-input ed-input--hero', value: sc.hero || '', maxlength: 8,
            onInput: (e) => { e.target.value = e.target.value.toLowerCase().slice(0, 8); C.state.editorScenes[si] = Object.assign({}, C.state.editorScenes[si], { hero: e.target.value }); },
            onChange: () => C.render(),
          }),
          ui().label('Apoyo', { margin: '10px 0 6px' }),
          h('input', {
            class: 'ed-input', value: sc.support || '',
            onInput: (e) => { C.state.editorScenes[si] = Object.assign({}, C.state.editorScenes[si], { support: e.target.value }); },
            onChange: () => C.render(),
          })
        )
      )
    );
  }

  const ui = () => C.ui;

  /* ── Panel de propiedades según la pista ── */
  function propiedades(s) {
    const U2 = ui();
    let body;
    if (s.selTrack === 'subs') {
      body = s.editorSubs
        ? frasesSubs(s)
        : C.frag(
            s.editorData && h('div', { class: 'ed-note' },
              'Este video se hizo con los subtítulos anteriores. Al exportar sale con la plantilla elegida en la tarjeta Texto (' +
              C.subs.nombre(s.subsPlantilla) + '), y desde ahí ya puedes editar frase por frase.'),
            transcripcion(s)
          );
    } else if (s.selTrack === 'clips') {
      const clips = s.clips || [];
      body = C.frag(
        clips.length > 0 && h('div', { class: 'ed-thumbs' },
          clips.slice(0, 12).map((c, i) =>
            h('div', { class: 'ed-thumb', title: c.file_name },
              c.thumbnail_url ? h('img', { src: c.thumbnail_url, alt: '' }) : h('div', { class: 'clip__fill', style: { background: D.clipTones[i % D.clipTones.length] } }),
              h('span', { class: 'clip__tag clip__tag--n' }, String(i + 1).padStart(2, '0'))))
        ),
        h('div', { class: 'ed-note' }, 'Los cortes entre clips se generan automáticamente.'),
        h('div', { class: 'ed-note' }, 'Para recortar: elimina palabras en la transcripción (pista Subtítulos). Se excluyen del video exportado.')
      );
    } else if (s.selTrack === 'zoom') {
      body = C.frag(
        U2.label('Tipo de zoom'),
        U2.chips(D.zoomTypes, s.zoomType, (v) => C.setState({ zoomType: v }), { marginBottom: '18px' }),
        U2.slider({ key: 'zoomFreq', label: 'Intensidad', labelFn: U.zoomFreqLabel })
      );
    } else if (s.selTrack === 'motion') {
      body = escenas(s);
    } else if (s.selTrack === 'music') {
      body = C.frag(
        U2.label('Pista'),
        U2.select(D.musics, s.music, (v) => C.setState({ music: v }), { marginBottom: '16px' }),
        U2.slider({ key: 'musicVol', label: 'Música de fondo', labelFn: (v) => v + '%', style: { marginBottom: '16px' } }),
        U2.slider({ key: 'voiceVol', label: 'Voz original', labelFn: (v) => v + '%' })
      );
    } else {
      body = C.frag(
        h('div', { class: 'ed-note' }, 'Efecto colocado en este punto del video.'),
        h('button', { class: 'btn btn--amber', style: { margin: '6px 0 14px' }, onClick: () => C.setState({ sfxOpen: true }) }, '♪ Cambiar sonido'),
        U2.slider({ key: 'sfxVol', label: 'Volumen', labelFn: (v) => v + '%' })
      );
    }

    return h('div', { class: 'glass result__props', 'data-scroll': 'ed-props-' + s.selTrack },
      h('div', { class: 'mono', style: { fontSize: '10px', letterSpacing: '.18em', color: 'var(--amber)', marginBottom: '4px' } }, 'PROPIEDADES'),
      h('div', { class: 'h-detail', style: { fontSize: '22px', marginBottom: '18px' } }, D.trackNames[s.selTrack]),
      body
    );
  }

  /* ── Línea de tiempo ── */
  function segmentos(trackId, s, totalSec) {
    const scenes = s.editorScenes || [];
    if (trackId === 'motion') {
      return scenes.map((sc, si) => ({ left: (sc.timestamp_ms / 1000 / totalSec) * 100, width: Math.max(1.5, (7 / totalSec) * 100), label: (sc.hero || '').toUpperCase(), scene: si }));
    }
    if (trackId === 'clips') {
      const n = Math.max(1, Math.min(8, (s.clips || []).length || 5));
      return Array.from({ length: n }, (_, i) => ({ left: (i / n) * 100 + 0.5, width: 100 / n - 1, label: 'Clip ' + (i + 1) }));
    }
    if (trackId === 'subs') return [{ left: 1, width: 97 }];
    const t = D.tracks.find((x) => x.id === trackId);
    return (t.segs || []).map((g) => ({ left: g[0], width: g[1] - 1 }));
  }

  function lineaDeTiempo(s) {
    const totalSec = duracionTotal(s);
    const v = videoEditor();
    const reproduciendo = v && !v.paused;
    return h('div', { class: 'timeline' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' } },
        h('button', { class: 'btn-round btn-round--sm', onClick: () => { const vv = videoEditor(); if (vv) { if (vv.paused) vv.play().catch(() => null); else vv.pause(); } } },
          reproduciendo ? h('span', { class: 'js-ed-play pause', html: '<i></i><i></i>' }) : h('span', { class: 'js-ed-play tri tri--dark' })),
        h('span', { class: 'mono', style: { fontSize: '12px' } },
          h('span', { class: 'js-ed-tc' }, U.fmtTime(v ? v.currentTime : 0)), ' ',
          h('span', { style: { color: 'rgba(247,233,224,.4)' } }, '/ ', h('span', { class: 'js-ed-total' }, U.fmtTime(totalSec)))),
        h('div', { style: { flex: '1', minWidth: '20px' } }),
        h('span', { class: 'mono', style: { fontSize: '10.5px', color: 'var(--ink-45)' } }, U.nameOf(D.qualities, s.quality) + ' · línea de tiempo')
      ),
      D.tracks.map((t) => {
        const sel = s.selTrack === t.id;
        return h('div', { class: 'track' + (sel ? ' track--sel' : ''), onClick: () => { if (!sel) C.setState({ selTrack: t.id }); } },
          h('div', { class: 'track__label' }, h('span', { class: 'track__dot', style: { background: t.color } }), t.name),
          h('div', { class: 'track__lane' },
            segmentos(t.id, s, totalSec).map((g) =>
              h('div', {
                class: 'seg' + (g.scene != null && s.editorSelScene === g.scene ? ' seg--on' : ''),
                title: g.label || '',
                style: { left: g.left + '%', width: Math.max(0.5, g.width) + '%', background: t.color },
                onClick: g.scene != null
                  ? (e) => { e.stopPropagation(); C.setState({ selTrack: 'motion', editorSelScene: g.scene }); }
                  : null,
              })
            ),
            h('div', { class: 'track__head js-ed-head', style: { left: v && v.duration ? (v.currentTime / v.duration) * 100 + '%' : '0%' } })
          )
        );
      })
    );
  }

  /* ── Estado de exportación ── */
  function exportando(s) {
    if (s.editorExportDone) {
      return h('span', { class: 'hand', style: { fontSize: '18px', color: 'var(--teal)' } }, '✓ listo');
    }
    if (s.editorExporting) {
      return h('span', { class: 'mono js-export-pct', style: { fontSize: '11px', color: 'var(--amber)' } }, 'Exportando ' + (s.editorExportProgress || 2) + '%…');
    }
    return null;
  }

  C.ResultEditor = function () {
    const s = C.state;
    if (!s.resultEdit) return null;

    return h('div', { class: 'result' },
      h('div', { class: 'bg-blob bg-blob--magenta' }),
      h('div', { class: 'glass topbar', style: { zIndex: '2' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
          h('button', { class: 'chip', onClick: () => { const v = videoEditor(); if (v) v.pause(); C.setState({ resultEdit: false }); } }, '← Volver'),
          h('div', { class: 'modal__title', style: { fontSize: '23px' } }, 'corte final'),
          h('div', { class: 'hand', style: { fontSize: '18px', color: 'var(--magenta)', transform: 'rotate(-4deg)' } }, 'edición manual')
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' } },
          exportando(s),
          h('button', { class: 'btn-round btn-round--sm btn-round--ghost', title: 'Deshacer' }, '↩'),
          h('button', { class: 'btn-round btn-round--sm btn-round--ghost', title: 'Rehacer' }, '↪'),
          s.downloadUrl
            ? h('a', { class: 'chip', href: C.urlVideo(s.downloadUrl), target: '_blank', rel: 'noopener', download: 'video-carrete.mp4' }, 'Descargar')
            : h('span', { class: 'chip', style: { opacity: '.5' } }, 'Descargar'),
          h('button', {
            class: 'chip chip--sel chip--magenta', disabled: s.editorExporting,
            onClick: () => C.actions.exportWithEdits(),
          }, s.editorExporting ? 'Exportando…' : 'Exportar →')
        )
      ),
      h('div', { class: 'result__grid' },
        telefono(s),
        propiedades(s)
      ),
      lineaDeTiempo(s)
    );
  };
})();

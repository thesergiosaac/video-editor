/* sonidos-guion.js — efectos de sonido puestos desde el GUION (24-sep-2026)
 *
 * Sergio: «donde editamos desde el guion, aparte de escena, gráfico o pantalla, también añadir sonido: ahí colocas
 * la librería de sonidos para que en una parte específica podamos colocar ese sonido». Y: «ayúdame a pensar cómo
 * colocarlo en el momento exacto: una línea es larga pero el sonido es corto, un whoosh».
 *
 * Cómo se ubica: la persona toca la PALABRA donde quiere el sonido, y Cherry hace caer ahí el GOLPE del efecto (el
 * instante en que suena más fuerte, medido en cada archivo: ver js/sonidos.js), no su principio. Una subida arranca
 * antes y revienta en la palabra; un whoosh pasa sobre ella; un impacto pega en ella. Si hace falta, «− 0,1 s /
 * + 0,1 s» lo corre una décima.
 *
 * Queda atado a la palabra (número de palabra, como las pantallas): si cambian los cortes, se mueve con la frase.
 * Se guarda en el estado (`sonidos`) y viaja con cada video en subtitle_config.sonidos; el ensamblador lo mezcla.
 *
 * VARIOS POR LÍNEA (24-sep, noche). Sergio: «ya que una línea tiene varias palabras, quisiera poder agregar varios
 * sonidos por línea». Arriba del panel van los sonidos de la línea (se toca uno para editarlo) y «+ Otro sonido»;
 * el nuevo cae en la primera palabra de la línea que todavía no tiene sonido.
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const { h } = C;
  const S = () => window.CherrySonidos || null;
  const lista = () => (Array.isArray(C.state.sonidos) ? C.state.sonidos : []);
  const nuevoId = () => 'so' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const enLinea = (x, l) => Number(x.palabra) >= l.desde && Number(x.palabra) <= l.hasta;
  const deLinea = (l) => lista().filter((y) => enLinea(y, l)).sort((a, b) => Number(a.palabra) - Number(b.palabra));
  const poner = (nueva) => C.setState({ sonidos: nueva });
  const cambiar = (id, c) => poner(lista().map((x) => (x.id === id ? Object.assign({}, x, c) : x)));
  const catVista = {};           // qué categoría se está mirando en el panel de cada sonido
  let audio = null;

  /* Escucharlo: con su volumen (el navegador llega hasta 100 %) */
  function oir(s, vol) {
    try {
      if (audio) audio.pause();
      audio = new Audio(s.url);
      audio.volume = Math.max(0, Math.min(1, (vol == null ? 100 : vol) / 100));
      audio.play().catch(() => {});
    } catch (_) { /* sin audio en este navegador */ }
  }

  /* El sonido nuevo sale de la categoría del último que se usó: se escoge una vez */
  function sonidoInicial() {
    const Sx = S();
    const ult = lista()[lista().length - 1];
    const s = ult && Sx.porId(ult.sonido);
    return s || Sx.deCategoria('whoosh')[0] || Sx.LISTA[0];
  }

  /* Uno nuevo en la línea: en la primera palabra que todavía no tiene sonido (si todas tienen, en la del abierto) */
  function agregar(l, cerca) {
    const s0 = sonidoInicial();
    const usadas = {};
    deLinea(l).forEach((y) => { usadas[Math.round(Number(y.palabra))] = true; });
    let p = l.desde;
    while (p <= l.hasta && usadas[p]) p++;
    if (p > l.hasta) p = cerca != null ? Number(cerca) : l.desde;
    const n = { id: nuevoId(), palabra: p, sonido: s0.id, vol: 100, mover: 0 };
    poner(lista().concat([n]));
    C.setState({ sonidoAbierto: n.id, escenaAbierta: null, pantallaAbierta: null });
  }

  function mando(l) {
    const Sx = S();
    if (!Sx) return null;
    const xs = deLinea(l);
    const abierto = xs.some((y) => C.state.sonidoAbierto === y.id);
    return h('button', {
      class: 'gu-b ' + (xs.length ? 'gu-b--son' : 'gu-b--auto') + (abierto ? ' gu-b--abierta' : ''), type: 'button',
      title: xs.length ? 'Aquí van ' + (xs.length > 1 ? xs.length + ' sonidos' : 'un sonido') + '. Toca para cambiarlos o agregar otro.'
                       : 'Pon aquí un efecto de sonido (whoosh, impacto, subida…).',
      onClick: (ev) => {
        ev.preventDefault();
        if (xs.length) { C.setState({ sonidoAbierto: abierto ? null : xs[0].id, escenaAbierta: null, pantallaAbierta: null }); return; }
        agregar(l);
      },
    }, h('span', { class: 'gu-b__i' }, xs.length ? '♪' : '+'), xs.length > 1 ? 'Sonidos · ' + xs.length : 'Sonido');
  }

  function marca(l) {
    const Sx = S();
    const xs = deLinea(l);
    if (!Sx || !xs.length) return null;
    const s = Sx.porId(xs[0].sonido);
    return h('span', { class: 'gu-m gu-m--s' }, 'Sonido · ' + (s ? s.nombre : '') + (xs.length > 1 ? ' +' + (xs.length - 1) : ''));
  }

  const decimas = (v) => { const n = Math.round((Number(v) || 0) * 10) / 10; return (n > 0 ? '+' : '') + String(n).replace('.', ',') + ' s'; };

  function editor(l) {
    const Sx = S();
    const x = lista().find((y) => y.id === C.state.sonidoAbierto);
    if (!Sx || !x || !enLinea(x, l)) return null;
    const actual = Sx.porId(x.sonido) || Sx.LISTA[0];
    const cat = catVista[x.id] || actual.cat;
    const palabras = String(l.texto || '').split(' ');
    const vol = x.vol == null ? 100 : Number(x.vol);
    const xs = deLinea(l);
    const otros = {};              // las palabras donde suenan los OTROS sonidos de la línea
    xs.forEach((y) => { if (y.id !== x.id) otros[Math.round(Number(y.palabra))] = true; });
    return h('div', { class: 'pan pan--sonido' },
      h('div', { class: 'label', style: { marginBottom: '6px' } }, xs.length > 1 ? 'Sonidos de esta línea' : 'Sonido'),
      // los sonidos de la línea: se toca uno para editarlo, o se agrega otro
      h('div', { class: 'son-tabs' },
        xs.length > 1 ? xs.map((y) => {
          const sy = Sx.porId(y.sonido), wy = palabras[Math.round(Number(y.palabra)) - l.desde] || '';
          return h('button', { type: 'button', class: 'son-tab' + (y.id === x.id ? ' on' : ''),
            title: 'Editar este sonido', onClick: () => C.setState({ sonidoAbierto: y.id }) },
            '♪ ' + (sy ? sy.nombre : '') + ' · «' + wy + '»');
        }) : null,
        h('button', { type: 'button', class: 'son-tab son-tab--mas', title: 'Poner otro sonido en esta misma línea',
          onClick: () => agregar(l, x.palabra) }, '+ Otro sonido')),
      h('div', { class: 'row__desc pan-nota' }, 'Toca la palabra donde quieres que suene: el golpe del efecto cae justo ahí.' +
        (xs.length > 1 ? ' Las palabras con ♪ ya tienen otro sonido.' : '')),
      h('div', { class: 'son-palabras' }, palabras.map((w, j) => {
        const idx = l.desde + j;
        return h('button', { type: 'button', class: 'son-p' + (idx === Number(x.palabra) ? ' on' : '') + (otros[idx] ? ' son-p--otro' : ''),
          onClick: () => cambiar(x.id, { palabra: idx, mover: 0 }) }, (otros[idx] && idx !== Number(x.palabra) ? '♪ ' : '') + w);
      })),
      h('div', { class: 'pan-cat' },
        h('span', { class: 'pan-cat__r' }, 'Categoría'),
        C.ui.select(Sx.CATEGORIAS.map((c) => ({ id: c.id, name: c.nombre })), cat, (v) => { catVista[x.id] = v; C.render(); })),
      h('div', { class: 'son-lista' }, Sx.deCategoria(cat).map((s) => h('span', { class: 'son-i' + (s.id === x.sonido ? ' on' : '') },
        h('button', { type: 'button', class: 'son-oir', title: 'Escuchar', onClick: () => oir(s, vol) }, '▶'),
        h('button', { type: 'button', class: 'son-n', title: s.dur.toFixed(1).replace('.', ',') + ' s',
          onClick: () => { cambiar(x.id, { sonido: s.id }); oir(s, vol); } }, s.nombre)))),
      h('div', { class: 'son-ajustes' },
        h('label', { class: 'pan-seg' }, 'Volumen ',
          h('input', { type: 'range', min: '0', max: '150', step: '5', value: String(vol),
            onChange: (e) => cambiar(x.id, { vol: Number(e.target.value) }) }),
          h('span', { class: 'mono' }, vol + ' %')),
        h('span', { class: 'son-fino' },
          h('button', { class: 'gu-b', type: 'button', title: 'Que suene una décima antes',
            onClick: () => cambiar(x.id, { mover: Math.max(-2, Math.round(((Number(x.mover) || 0) - 0.1) * 10) / 10) }) }, '− 0,1 s'),
          h('span', { class: 'mono' }, decimas(x.mover)),
          h('button', { class: 'gu-b', type: 'button', title: 'Que suene una décima después',
            onClick: () => cambiar(x.id, { mover: Math.min(2, Math.round(((Number(x.mover) || 0) + 0.1) * 10) / 10) }) }, '+ 0,1 s'))),
      h('div', { class: 'pan-pie' },
        h('button', { class: 'gu-b gu-b--no', type: 'button', onClick: () => {
          // se quita este; si en la línea quedan otros, el panel sigue abierto en el siguiente
          const resto = xs.filter((y) => y.id !== x.id);
          poner(lista().filter((y) => y.id !== x.id));
          C.setState({ sonidoAbierto: resto.length ? resto[0].id : null });
        } }, 'Quitar este sonido'),
        h('button', { class: 'gu-b', type: 'button', onClick: () => C.setState({ sonidoAbierto: null }) }, 'Listo')));
  }

  /* Lo que viaja con el video: cada sonido con su archivo y su golpe (el ensamblador no lee el catálogo) */
  function paraServidor() {
    const Sx = S();
    if (!Sx) return [];
    return lista().map((x) => {
      const s = Sx.porId(x.sonido);
      return s ? { id: x.id, sonido: s.id, url: s.url, golpe: s.golpe, dur: s.dur, palabra: Math.round(Number(x.palabra)),
                   vol: x.vol == null ? 100 : Number(x.vol), mover: Number(x.mover) || 0 } : null;
    }).filter(Boolean);
  }

  C.sonidosGuion = { mando, marca, editor, paraServidor };
})();

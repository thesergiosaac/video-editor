/* instagram.js — vista «como se ve publicado» (17-sep-2026)
   Dibuja encima del celular la interfaz real de los reels de Instagram: barra de estado,
   Reels/Amigos, la columna de iconos, la cuenta con la descripción y la barra de abajo.
   Sirve para ver qué tapa Instagram antes de publicar (sobre todo los subtítulos).
   Todo va en cqw: el contenedor .screen tiene container-type:inline-size, así que escala solo. */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  const svg = (d, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + d + '</svg>';

  const ICONOS = {
    mas: svg('<path d="M12 5v14M5 12h14"/>'),
    corazon: svg('<path d="M12 20.5C7 17 3.5 14 3.5 10.2 3.5 7.6 5.5 5.6 8 5.6c1.6 0 3.1.8 4 2.1.9-1.3 2.4-2.1 4-2.1 2.5 0 4.5 2 4.5 4.6 0 3.8-3.5 6.8-8.5 10.3z"/>'),
    comentario: svg('<path d="M20.5 11.6c0 4.2-3.8 7.6-8.5 7.6-1 0-2-.2-2.9-.5L4 20.5l1.5-4.2c-.9-1.2-1.5-2.7-1.5-4.4C4 7.7 7.8 4.3 12.5 4.3S20.5 7.7 20.5 11.6z"/>'),
    repost: svg('<path d="M17 3l3 3-3 3"/><path d="M20 6H8a4 4 0 0 0-4 4v1"/><path d="M7 21l-3-3 3-3"/><path d="M4 18h12a4 4 0 0 0 4-4v-1"/>'),
    enviar: svg('<path d="M21.5 3.5L2.8 9.9c-.7.2-.7 1.2 0 1.4l7.4 2.4 2.4 7.4c.2.7 1.2.7 1.4 0l6.4-18.7c.2-.6-.4-1.1-.9-.9z"/><path d="M10.2 13.7L21.5 3.5"/>'),
    puntos: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
    casa: svg('<path d="M3.5 10.5L12 3.8l8.5 6.7V20a.8.8 0 0 1-.8.8h-4.4v-6.2H8.7v6.2H4.3a.8.8 0 0 1-.8-.8z"/>'),
    reels: svg('<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.6"/><path d="M3.6 8.6h16.8M9.4 3.6l2.8 5M15.2 3.6l2.8 5"/><path d="M10.4 11.8l4.2 2.4-4.2 2.4z" fill="currentColor" stroke="none"/>'),
    lupa: svg('<circle cx="11" cy="11" r="6.6"/><path d="M16 16l4.4 4.4"/>'),
    mensaje: svg('<path d="M21.5 3.5L2.8 9.9c-.7.2-.7 1.2 0 1.4l7.4 2.4 2.4 7.4c.2.7 1.2.7 1.4 0l6.4-18.7c.2-.6-.4-1.1-.9-.9z"/>'),
    camara: svg('<rect x="3" y="6.5" width="14" height="11" rx="2.6"/><path d="M17 11l4-2.4v6.8L17 13z"/>'),
  };

  const icono = (k, clase) => h('span', { class: 'ig-ic' + (clase ? ' ' + clase : ''), html: ICONOS[k] });

  function accion(k, numero) {
    return h('div', { class: 'ig-accion' }, icono(k), numero && h('span', null, numero));
  }

  /* La interfaz de Instagram encima del video. No recibe clics: es solo para ver. */
  C.MarcoInstagram = function () {
    const s = C.state;
    const perfil = s.perfil || {};
    const cuenta = (perfil.full_name || (C.session.user && C.session.user.email) || 'tu cuenta').split('@')[0].toLowerCase().replace(/\s+/g, '');
    const texto = (s.scriptText || '').trim().split('\n')[0] || 'Escribe aquí la descripción de tu publicación';

    return h('div', { class: 'ig', 'aria-hidden': 'true' },
      /* barra de estado del celular */
      h('div', { class: 'ig-estado' },
        h('span', null, '9:41'),
        h('span', { class: 'ig-estado__der' },
          h('i', { class: 'ig-senal' }), h('i', { class: 'ig-wifi' }), h('i', { class: 'ig-bateria' }))
      ),
      /* Reels · Amigos */
      h('div', { class: 'ig-arriba' },
        icono('mas', 'ig-ic--mas'),
        h('div', { class: 'ig-pestanas' },
          h('b', null, 'Reels'),
          h('span', null, 'Amigos')
        ),
        icono('camara', 'ig-ic--camara')
      ),
      /* columna de acciones */
      h('div', { class: 'ig-acciones' },
        accion('corazon', '31,2 mil'),
        accion('comentario', '225'),
        accion('repost', '1.918'),
        accion('enviar', '15,7 mil'),
        accion('puntos'),
        h('div', { class: 'ig-audio' })
      ),
      /* cuenta y descripción */
      h('div', { class: 'ig-pie' },
        h('div', { class: 'ig-cuenta' },
          h('span', { class: 'ig-avatar' }, cuenta.charAt(0).toUpperCase()),
          h('b', null, cuenta),
          h('span', { class: 'ig-seguir' }, 'Seguir')
        ),
        h('div', { class: 'ig-desc' }, texto)
      ),
      /* barra de abajo */
      h('div', { class: 'ig-abajo' },
        h('span', { class: 'ig-linea' }),
        h('div', { class: 'ig-nav' },
          icono('casa'), icono('lupa'), icono('reels', 'ig-ic--reels'), icono('mensaje'),
          h('span', { class: 'ig-yo' })
        )
      )
    );
  };
})();

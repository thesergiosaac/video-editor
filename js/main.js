/* main.js — arranque + render principal (diseño "very sweet": 3 zonas sin scroll de página) */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const appEl = document.getElementById('app');

  function App() {
    /* Sin sesión no se muestra el editor */
    if (!C.auth.checked) return C.frag(C.LoginScreen.cargando());
    if (!C.session.user || !C.apiReady) return C.frag(C.LoginScreen());

    if (C.state.pantalla !== 'editor') return C.frag(C.Inicio());

    /* (8-oct) En Manual, multimedia y configuración dejan su sitio a la línea de tiempo (manual.js); el celular no se mueve */
    const manual = !!(C.manual && C.manual.activo() && C.Manual);
    /* (22-oct) En el celular (≤760 px) la misma pantalla queda fija, como CapCut: los módulos son la barra de abajo y el que
       se abre sube como hoja; «✓ Fabricar» de la barra de arriba abre su propia hoja (.zone--hoja). En el computador
       estas clases no cambian nada y la hoja no se ve. */
    const s = C.state;
    const hoja = s.fabHoja ? HojaFabricar : null;
    return C.frag(
      h('div', { class: 'app' + (s.openCard ? ' app--carta' : '') + (hoja ? ' app--hoja' : '') },
        C.TopBar(),
        h('div', { class: 'zones' + (manual ? ' zones--manual' : '') },
          h('div', { class: 'zone zone--player' }, C.Phone(), C.Player()),
          manual ? h('div', { class: 'zone zone--manual' }, C.Manual()) : [
            h('div', { class: 'zone zone--media' }, C.Media()),
            h('div', { class: 'zone zone--config' }, C.Config())],
          hoja && h('div', { class: 'zone zone--hoja' }, hoja())
        )
      ),
      C.Overlays(),
      C.ResultEditor()
    );
  }

  /* Las hojas del celular que no son un módulo: título, «Listo» (o bajarla con el dedo) y lo de adentro */
  function Hoja(titulo, cerrar, ...cuerpo) {
    return h('div', { class: 'glass glass--full hoja' },
      h('div', { class: 'hoja__cab', onTouchstart: C.hojaDedo(cerrar) },
        h('div', { class: 'h-detail' }, titulo),
        h('button', { type: 'button', class: 'hoja__listo', onClick: cerrar }, 'Listo')),
      h('div', { class: 'hoja__cuerpo', 'data-scroll': 'hoja' }, ...cuerpo)
    );
  }
  /* «✓ Fabricar»: la misma franja de multimedia (subir, fabricar, descargar, publicar) */
  function HojaFabricar() {
    return Hoja('Fabricar', () => C.setState({ fabHoja: false }),
      h('div', { class: 'strip strip--gen' }, C.franjaFabricar ? C.franjaFabricar() : null));
  }

  /* Bajar una hoja con el dedo la cierra (se arrastra de su cabecera, como en CapCut) */
  C.hojaDedo = function (cerrar) {
    return (e) => {
      if (e.target.closest('button') || !window.matchMedia('(max-width:760px)').matches) return;
      const hoja = e.currentTarget.closest('.hoja');
      const y0 = e.touches[0].clientY;
      let dy = 0;
      const mover = (ev) => {
        dy = Math.max(0, ev.touches[0].clientY - y0);
        if (hoja) hoja.style.transform = 'translateY(' + dy + 'px)';
      };
      const soltar = () => {
        window.removeEventListener('touchmove', mover);
        window.removeEventListener('touchend', soltar);
        window.removeEventListener('touchcancel', soltar);
        if (dy > 70) cerrar();
        else if (hoja) hoja.style.transform = '';
      };
      window.addEventListener('touchmove', mover, { passive: true });
      window.addEventListener('touchend', soltar);
      window.addEventListener('touchcancel', soltar);
    };
  };

  C.render = function () {
    // Conservar el scroll de las zonas que se desplazan por dentro (clips, módulos, transcripción…)
    const scrolls = {};
    appEl.querySelectorAll('[data-scroll]').forEach((el) => { scrolls[el.getAttribute('data-scroll')] = el.scrollTop; });
    appEl.replaceChildren(App());
    appEl.querySelectorAll('[data-scroll]').forEach((el) => {
      const top = scrolls[el.getAttribute('data-scroll')];
      if (top) el.scrollTop = top;
    });
    ajustarTarjetas();
  };

  /* Las tarjetas de configuración tienen que caber TODAS sin scroll:
     si no caben en 3 columnas pasan a 4; si aún no caben, se esconde la descripción */
  // Se mide una sola vez por tamaño de ventana; en los demás redibujos se reutiliza (medir obliga a recalcular la página)
  let modoTarjetas = { clave: '', clases: [] };
  function ajustarTarjetas(forzar) {
    const g = appEl.querySelector('.cfg__grid');
    if (!g) return;
    const clave = window.innerWidth + 'x' + window.innerHeight + ':' + g.children.length;
    if (!forzar && modoTarjetas.clave === clave) {
      if (modoTarjetas.clases.length) g.classList.add(...modoTarjetas.clases);
      return;
    }
    const clases = [];
    g.classList.remove('cfg__grid--4', 'cfg__grid--mini');
    if (g.scrollHeight > g.clientHeight + 1) { g.classList.add('cfg__grid--4'); clases.push('cfg__grid--4'); }
    if (g.scrollHeight > g.clientHeight + 1) { g.classList.add('cfg__grid--mini'); clases.push('cfg__grid--mini'); }
    modoTarjetas = { clave, clases };
  }
  let ajustePendiente = null;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(ajustePendiente);
    ajustePendiente = requestAnimationFrame(() => ajustarTarjetas(true));
  });

  /* Clic fuera de los menús de la barra superior: cerrarlos */
  document.addEventListener('mousedown', (e) => {
    const s = C.state;
    if (!s || (!s.projOpen && !s.userOpen)) return;
    if (e.target.closest('.menu, .pill, .avatar')) return;
    C.actions.closeMenus();
  });

  /* Las herramientas (herramientas/*.html) usan esta misma sesión:
     ?volver=herramientas/<página>  → quien entró desde una herramienta vuelve a ella
     ?abrir=<proyecto>             → abre en el Editor Pro el proyecto que creó Guiones o Storyboard */
  C.onApiReady.push(() => {
    const q = new URLSearchParams(location.search);
    /* (6-oct) ?ir=proyectos | ?ir=editor: «Mis proyectos» y «Editor Pro» de la barra de la izquierda de las herramientas
       (herramientas/lado.js). El editor abre el último proyecto, el mismo que ya eligió elegirProyecto(). */
    const volver = q.get('volver'), abrir = q.get('abrir'), ir = q.get('ir');
    if (volver && /^herramientas\/[a-z]+\.html(\?[^#]*)?$/.test(volver)) { location.replace(volver); return; }
    if (ir === 'proyectos' || ir === 'editor') {
      history.replaceState(null, '', location.pathname);
      C.setState(ir === 'proyectos' ? { inicioSeccion: 'proyectos' } : { pantalla: 'editor' });
      return;
    }
    if (abrir) {
      history.replaceState(null, '', location.pathname);
      if (abrir === C.session.projectId) {
        if (C.api && C.api.recordarProyecto) C.api.recordarProyecto(abrir);
        C.setState({ pantalla: 'editor' });
      }
    }
  });

  C.render();
})();

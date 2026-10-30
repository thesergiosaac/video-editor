/* login.js — pantalla de entrada. (30-oct) Una sola puerta: con el correo, Cherry sabe qué sigue.
   Tiene cuenta → contraseña (y «¿Olvidaste tu contraseña?») · no tiene → crearla y confirmar el correo con un código ·
   la abrimos por dentro → crear su contraseña (primer ingreso) · entró con Google → Google. El registro está cerrado hasta el lanzamiento. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const CANAL = 'https://whatsapp.com/channel/0029Vb8xw0WCRs1wSMOitV35';

  /* Estado local de la pantalla (no va en C.state para no mezclarlo con el editor) */
  const L = { paso: 'correo', correo: '', clave: '', clave2: '', nombre: '', codigo: '', para: 'registro', error: '', cargando: false, espera: 0, google: false, googleVisto: false };

  function set(patch) {
    Object.assign(L, patch);
    C.render();
    setTimeout(() => {
      const el = document.querySelector('.cl [data-foco]');
      if (el && document.activeElement !== el) el.focus();
    }, 0);
  }

  function reiniciar() {
    Object.assign(L, { paso: 'correo', clave: '', clave2: '', nombre: '', codigo: '', error: '', cargando: false, espera: 0 });
  }
  /* Se reparte el tiempo para pedir otro código sin volver a pintar la pantalla (no se pierde lo escrito) */
  setInterval(() => {
    if (L.espera <= 0) return;
    L.espera--;
    const b = document.querySelector('.js-reenviar');
    if (b) { b.textContent = L.espera > 0 ? 'Enviar otro código en 0:' + String(L.espera).padStart(2, '0') : 'Enviar otro código'; b.disabled = L.espera > 0; }
  }, 1000);

  async function continuarCorreo(e) {
    e.preventDefault();
    if (L.cargando) return;
    const correo = L.correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return set({ error: 'Escribe un correo válido.' });
    C.auth.aviso = null;
    set({ correo, cargando: true, error: '' });
    let r = await C.api.entrada('estado', { correo });
    if (!r.ok && !r.tipo) {   // si la función nueva no contesta, sigue el camino de antes: quien tiene cuenta debe poder entrar
      const v = await C.api.esPrimerIngreso(correo);
      if (!v.ok) return set({ cargando: false, error: v.error });
      r = { tipo: v.primeraVez ? 'primera' : 'clave' };
    }
    const base = { cargando: false, clave: '', clave2: '', codigo: '' };
    if (r.tipo === 'primera') return set({ ...base, paso: 'crear' });
    if (r.tipo === 'google') return set({ ...base, paso: 'google' });
    if (r.tipo === 'clave') return set({ ...base, paso: 'clave' });
    return set({ ...base, paso: r.cerrado ? 'cerrado' : 'nueva' });
  }

  async function entrar(e) {
    e.preventDefault();
    if (L.cargando) return;
    if (!L.clave) return set({ error: 'Escribe tu contraseña.' });
    set({ cargando: true, error: '' });
    const r = await C.api.login(L.correo, L.clave);
    if (!r.ok) return set({ cargando: false, clave: '', error: r.error });
    reiniciar(); // la app ya se pintó al entrar
  }

  async function crear(e) {
    e.preventDefault();
    if (L.cargando) return;
    if (L.clave.length < 8) return set({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    if (L.clave !== L.clave2) return set({ error: 'Las dos contraseñas no coinciden.' });
    set({ cargando: true, error: '' });
    const r = await C.api.crearClave(L.correo, L.clave);
    if (!r.ok) return set({ cargando: false, error: r.error });
    reiniciar();
  }

  async function registrar(e) {
    e.preventDefault();
    if (L.cargando) return;
    if (!L.nombre.trim()) return set({ error: 'Escribe tu nombre.' });
    if (L.clave.length < 8) return set({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    set({ cargando: true, error: '' });
    const r = await C.api.entrada('registrar', { correo: L.correo, clave: L.clave, nombre: L.nombre.trim() });
    if (r.cerrado) return set({ cargando: false, paso: 'cerrado' });
    if (!r.ok) return set({ cargando: false, error: r.error || 'No se pudo crear la cuenta.' });
    set({ cargando: false, paso: 'codigo', para: 'registro', codigo: '', espera: r.espera || 45 });
  }

  async function confirmar(e) {
    e.preventDefault();
    if (L.cargando) return;
    if (L.codigo.length !== 6) return set({ error: 'Escribe los 6 números.' });
    set({ cargando: true, error: '' });
    const r = await C.api.entrada('confirmar', { correo: L.correo, codigo: L.codigo });
    if (!r.ok) return set({ cargando: false, codigo: '', error: r.error || 'No se pudo confirmar.' });
    const d = await C.api.login(L.correo, L.clave);
    if (!d.ok) return set({ cargando: false, paso: 'clave', clave: '', error: d.error });
    reiniciar();
  }

  async function pedirRecuperar() {
    if (L.cargando) return;
    set({ cargando: true, error: '' });
    const r = await C.api.entrada('recuperar', { correo: L.correo });
    if (!r.ok) return set({ cargando: false, error: r.error || 'No se pudo enviar el código.' });
    set({ cargando: false, paso: 'recuperar', para: 'recuperar', codigo: '', clave: '', espera: r.espera || 45 });
  }

  async function cambiarClave(e) {
    e.preventDefault();
    if (L.cargando) return;
    if (L.codigo.length !== 6) return set({ error: 'Escribe los 6 números.' });
    if (L.clave.length < 8) return set({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    set({ cargando: true, error: '' });
    const r = await C.api.entrada('cambiar_clave', { correo: L.correo, codigo: L.codigo, clave: L.clave });
    if (!r.ok) return set({ cargando: false, codigo: '', error: r.error || 'No se pudo cambiar la contraseña.' });
    const d = await C.api.login(L.correo, L.clave);
    if (!d.ok) return set({ cargando: false, paso: 'clave', clave: '', error: d.error });
    reiniciar();
  }

  async function reenviar() {
    if (L.espera > 0 || L.cargando) return;
    const r = await C.api.entrada('reenviar', { correo: L.correo, para: L.para });
    if (!r.ok) return set({ error: r.error || 'No se pudo enviar.' });
    set({ error: '', espera: r.espera || 45 });
  }

  const otroCorreo = () => set({ paso: 'correo', clave: '', clave2: '', codigo: '', error: '' });

  function Marca(grande) {
    const k = grande ? 'g' : 'n';   // (4-oct) el logo nuevo; el de papel solo se ve si la entrada está en papel
    return h('div', { class: 'cl-marca' + (grande ? ' cl-marca--grande' : '') },
      C.imgFija('cl-noche-' + k, 'assets/marca/cherry-lockup-noche.svg', { class: 'cl-logo cl-logo--noche', alt: 'Cherry very sweet', width: 778, height: 240 }),
      C.imgFija('cl-papel-' + k, 'assets/marca/cherry-lockup-papel.svg', { class: 'cl-logo cl-logo--papel', alt: '', width: 778, height: 240 }));
  }

  function MensajeError() {
    return L.error ? h('div', { class: 'login__error', role: 'alert' }, L.error) : null;
  }

  function Boton(texto) {
    return h('button', { class: 'login__btn', type: 'submit', disabled: L.cargando }, texto);
  }

  function CampoClave(id, etiqueta, valor, auto, onInput, foco) {
    return [
      h('label', { class: 'login__label', for: id }, etiqueta),
      h('input', {
        id, class: 'login__input', type: 'password', autocomplete: auto, value: valor,
        'data-foco': foco ? '1' : null, onInput,
      }),
    ];
  }

  /* Campo de correo escondido: le dice al gestor de contraseñas de qué cuenta es la clave */
  function CorreoOculto() {
    return h('input', {
      class: 'login__oculto', type: 'email', name: 'email', autocomplete: 'username',
      value: L.correo, tabindex: '-1', 'aria-hidden': 'true', readonly: true,
    });
  }

  const GOOGLE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.8 3.3-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.500-1 7.200-2.700l-3.500-2.700c-1 .7-2.200 1-3.700 1-2.800 0-5.200-1.900-6.100-4.500H2.300v2.800A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.900 14.100a6.600 6.600 0 0 1 0-4.200V7.100H2.300a11 11 0 0 0 0 9.800z"/><path fill="#EA4335" d="M12 5.400c1.600 0 3 .5 4.100 1.600l3.100-3.100A11 11 0 0 0 2.300 7.100l3.600 2.800C6.800 7.300 9.200 5.400 12 5.400z"/></svg>';
  function BotonGoogle() {
    return h('button', { class: 'login__google', type: 'button', onClick: () => C.api.entrarConGoogle() }, h('span', { html: GOOGLE, style: 'display:flex' }), 'Continuar con Google');
  }
  /* Los 6 números: una sola casilla (el celular sugiere el código que llega) pintada como seis cuadritos */
  function CampoCodigo() {
    const pinta = (ev) => {
      const v = ev.target.value.replace(/\D/g, '').slice(0, 6);
      ev.target.value = v; L.codigo = v;
      document.querySelectorAll('.login__caja i').forEach((c, n) => { c.textContent = v[n] || ''; });
    };
    return h('div', { class: 'login__caja' },
      [0, 1, 2, 3, 4, 5].map((n) => h('i', null, L.codigo[n] || '')),
      h('input', { class: 'login__codigo', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, value: L.codigo, 'aria-label': 'Código de 6 números', 'data-foco': '1', onInput: pinta }));
  }
  function Reenviar() {
    return h('button', { class: 'login__link js-reenviar', type: 'button', disabled: L.espera > 0, onClick: reenviar },
      L.espera > 0 ? 'Enviar otro código en 0:' + String(L.espera).padStart(2, '0') : 'Enviar otro código');
  }

  function PasoCorreo() {
    if (!L.googleVisto) { L.googleVisto = true; C.api.googleListo().then((si) => { if (si) set({ google: true }); }); }
    return h('form', { class: 'login__form', onSubmit: continuarCorreo, novalidate: true },
      h('h1', { class: 'login__titulo' }, 'Entra a tu estudio'),
      h('p', { class: 'login__texto' }, 'Con tu correo, tengas cuenta o no.'),
      L.google ? BotonGoogle() : null,
      L.google ? h('div', { class: 'login__o' }, h('span', null, 'o')) : null,
      h('label', { class: 'login__label', for: 'login-correo' }, 'Correo'),
      h('input', {
        id: 'login-correo', class: 'login__input', type: 'email', name: 'email',
        autocomplete: 'username', inputmode: 'email', value: L.correo, 'data-foco': '1',
        onInput: (e) => { L.correo = e.target.value; },
      }),
      MensajeError(),
      Boton(L.cargando ? 'Revisando…' : 'Continuar'),
      h('p', { class: 'login__legal' }, 'Al continuar aceptas los ', h('a', { href: 'terminos.html', target: '_blank', rel: 'noopener' }, 'Términos'), ' y la ', h('a', { href: 'privacidad.html', target: '_blank', rel: 'noopener' }, 'Política de privacidad'), '.')
    );
  }

  function PasoClave() {
    return h('form', { class: 'login__form', onSubmit: entrar, novalidate: true },
      h('h1', { class: 'login__titulo' }, 'Escribe tu contraseña'),
      h('div', { class: 'login__correo' }, L.correo),
      CorreoOculto(),
      CampoClave('login-clave', 'Contraseña', L.clave, 'current-password', (e) => { L.clave = e.target.value; }, true),
      MensajeError(),
      Boton(L.cargando ? 'Entrando…' : 'Entrar'),
      h('button', { class: 'login__link', type: 'button', onClick: pedirRecuperar }, '¿Olvidaste tu contraseña?'),
      h('button', { class: 'login__link', type: 'button', onClick: otroCorreo }, 'Usar otro correo')
    );
  }

  function PasoCrear() {
    return h('form', { class: 'login__form', onSubmit: crear, novalidate: true },
      h('h1', { class: 'login__titulo' }, 'Crea tu contraseña'),
      h('p', { class: 'login__texto' }, 'Es el primer ingreso de esta cuenta. La contraseña que pongas aquí es la que usarás siempre.'),
      h('div', { class: 'login__correo' }, L.correo),
      CorreoOculto(),
      CampoClave('login-nueva', 'Contraseña nueva', L.clave, 'new-password', (e) => { L.clave = e.target.value; }, true),
      h('p', { class: 'login__pista' }, 'Mínimo 8 caracteres.'),
      CampoClave('login-nueva-2', 'Repite la contraseña', L.clave2, 'new-password', (e) => { L.clave2 = e.target.value; }, false),
      MensajeError(),
      Boton(L.cargando ? 'Guardando…' : 'Crear contraseña y entrar'),
      h('button', { class: 'login__link', type: 'button', onClick: otroCorreo }, 'Usar otro correo')
    );
  }

  function PasoNueva() {
    return h('form', { class: 'login__form', onSubmit: registrar, novalidate: true },
      h('h1', { class: 'login__titulo' }, 'Crea tu cuenta'),
      h('p', { class: 'login__texto' }, 'Es tu primera vez con este correo.'),
      h('div', { class: 'login__correo' }, L.correo),
      CorreoOculto(),
      h('label', { class: 'login__label', for: 'login-nombre' }, 'Tu nombre'),
      h('input', { id: 'login-nombre', class: 'login__input', type: 'text', autocomplete: 'name', maxlength: 60, value: L.nombre, 'data-foco': '1', onInput: (e) => { L.nombre = e.target.value; } }),
      CampoClave('login-registro', 'Contraseña', L.clave, 'new-password', (e) => { L.clave = e.target.value; }, false),
      h('p', { class: 'login__pista' }, 'Mínimo 8 caracteres.'),
      MensajeError(),
      Boton(L.cargando ? 'Creando…' : 'Crear mi cuenta'),
      h('button', { class: 'login__link', type: 'button', onClick: otroCorreo }, 'Usar otro correo')
    );
  }

  function PasoCodigo() {
    return h('form', { class: 'login__form', onSubmit: confirmar, novalidate: true },
      h('h1', { class: 'login__titulo' }, 'Revisa tu correo'),
      h('p', { class: 'login__texto' }, 'Te enviamos un código de 6 números a'),
      h('div', { class: 'login__correo' }, L.correo),
      CampoCodigo(),
      MensajeError(),
      Boton(L.cargando ? 'Confirmando…' : 'Confirmar'),
      Reenviar(),
      h('button', { class: 'login__link', type: 'button', onClick: otroCorreo }, 'Usar otro correo')
    );
  }

  function PasoRecuperar() {
    return h('form', { class: 'login__form', onSubmit: cambiarClave, novalidate: true },
      h('h1', { class: 'login__titulo' }, 'Cambia tu contraseña'),
      h('p', { class: 'login__texto' }, 'Escribe el código que te enviamos y tu contraseña nueva.'),
      h('div', { class: 'login__correo' }, L.correo),
      CorreoOculto(),
      CampoCodigo(),
      CampoClave('login-cambio', 'Contraseña nueva', L.clave, 'new-password', (e) => { L.clave = e.target.value; }, false),
      h('p', { class: 'login__pista' }, 'Mínimo 8 caracteres.'),
      MensajeError(),
      Boton(L.cargando ? 'Guardando…' : 'Guardar y entrar'),
      Reenviar(),
      h('button', { class: 'login__link', type: 'button', onClick: otroCorreo }, 'Usar otro correo')
    );
  }

  function PasoGoogle() {
    return h('div', { class: 'login__form' },
      h('h1', { class: 'login__titulo' }, 'Entra con Google'),
      h('p', { class: 'login__texto' }, 'Esta cuenta se creó con Google.'),
      h('div', { class: 'login__correo' }, L.correo),
      BotonGoogle(),
      MensajeError(),
      h('button', { class: 'login__link', type: 'button', onClick: pedirRecuperar }, 'Prefiero crear una contraseña'),
      h('button', { class: 'login__link', type: 'button', onClick: otroCorreo }, 'Usar otro correo')
    );
  }

  /* El registro todavía no abre */
  function PasoCerrado() {
    return h('div', { class: 'login__form' },
      h('h1', { class: 'login__titulo' }, 'Cherry abre muy pronto'),
      h('p', { class: 'login__texto' }, 'Todavía no se pueden crear cuentas nuevas. Únete al canal de WhatsApp y te avisamos el día que abra.'),
      h('a', { class: 'login__btn', href: CANAL, target: '_blank', rel: 'noopener', style: 'text-align:center;text-decoration:none' }, 'Unirme al canal'),
      h('button', { class: 'login__link', type: 'button', onClick: otroCorreo }, 'Usar otro correo')
    );
  }

  /* 19-sep (aprobado por Sergio): el mundo del inicio. La estatua del editor se asoma detrás de la tarjeta. */
  C.LoginScreen = function () {
    const aviso = C.auth && C.auth.aviso;
    const PASOS = { clave: PasoClave, crear: PasoCrear, nueva: PasoNueva, codigo: PasoCodigo, recuperar: PasoRecuperar, google: PasoGoogle, cerrado: PasoCerrado };
    const paso = (PASOS[L.paso] || PasoCorreo)();
    return h('div', { class: 'cl' },
      h('section', { class: 'cl-entrar', 'aria-label': 'Entrar a Cherry' },
        C.imgFija('cl-asoma', 'assets/inicio/editor.webp?v=20260918', { class: 'cl-asoma', alt: '', 'aria-hidden': 'true', draggable: 'false' }),
        h('div', { class: 'cl-tarjeta' },
          Marca(),
          aviso && L.paso === 'correo' ? h('div', { class: 'login__aviso' }, aviso) : null,
          paso
        ),
        h('span', { class: 'cl-pie' }, 'Estudio de contenido con IA')
      )
    );
  };

  /* Mientras se revisa si hay una sesión guardada: la estatua infla su chicle. app.html trae la MISMA pantalla escrita
     a mano para que se vea desde el primer instante (si se cambia aquí, cambiarla allá). */
  const PEDAZOS = [[-30, -22], [-6, -34], [22, -28], [34, -2], [26, 26], [-4, 34], [-30, 18], [-38, -4]];
  C.LoginScreen.cargando = function () {
    return h('div', { class: 'cl' },
      h('section', { class: 'cl-carga', 'aria-live': 'polite', 'aria-label': 'Cargando Cherry' },
        h('div', { class: 'cl-escena' },
          h('span', { class: 'cl-puntos', 'aria-hidden': 'true' }),
          h('div', { class: 'cl-figura' },
            C.imgFija('cl-estatua', 'assets/inicio/sonido_boca.webp?v=20261008sin', { class: 'cl-estatua', alt: 'Busto clásico con audífonos rosados inflando una bomba de chicle' }),
            h('span', { class: 'cl-chicle', 'aria-hidden': 'true' }),
            h('span', { class: 'cl-pedazos', 'aria-hidden': 'true' }, h('b'), PEDAZOS.map(([x, y]) => h('i', { style: '--x:' + x + 'px;--y:' + y + 'px' })))
          )
        ),
        Marca(true),
        h('div', { class: 'cl-barra', 'aria-hidden': 'true' }, h('i')),
        h('span', { class: 'cl-frase js-cl-frase' }, 'Preparando tu estudio')
      )
    );
  };
  /* Si la carga tarda, la frase va diciendo en qué va (sirve también para la pantalla escrita en app.html) */
  const FRASES = ['Preparando tu estudio', 'Trayendo tus proyectos', 'Casi listo'];
  let frase = 0;
  setInterval(() => {
    const el = document.querySelector('.js-cl-frase');
    if (!el) return;
    frase = (frase + 1) % FRASES.length;
    el.textContent = FRASES[frase];
  }, 1600);
})();

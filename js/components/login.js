/* login.js — pantalla de entrada
   Paso 1: correo. Paso 2: contraseña, o crearla si es el primer ingreso de la cuenta. */
(function () {
  const C = window.CARRETE;
  const { h } = C;

  /* Estado local de la pantalla (no va en C.state para no mezclarlo con el editor) */
  const L = { paso: 'correo', correo: '', clave: '', clave2: '', error: '', cargando: false };

  function set(patch) {
    Object.assign(L, patch);
    C.render();
    setTimeout(() => {
      const el = document.querySelector('.login [data-foco]');
      if (el && document.activeElement !== el) el.focus();
    }, 0);
  }

  function reiniciar() {
    Object.assign(L, { paso: 'correo', clave: '', clave2: '', error: '', cargando: false });
  }

  async function continuarCorreo(e) {
    e.preventDefault();
    if (L.cargando) return;
    const correo = L.correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return set({ error: 'Escribe un correo válido.' });
    C.auth.aviso = null;
    set({ correo, cargando: true, error: '' });
    const r = await C.api.esPrimerIngreso(correo);
    if (!r.ok) return set({ cargando: false, error: r.error });
    set({ cargando: false, paso: r.primeraVez ? 'crear' : 'clave', clave: '', clave2: '' });
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

  const otroCorreo = () => set({ paso: 'correo', clave: '', clave2: '', error: '' });

  function Marca() {
    return h('div', { class: 'login__marca' },
      h('div', { class: 'logo' }, 'carrete'),
      h('div', { class: 'logo-hand' }, 'night shift')
    );
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

  function PasoCorreo() {
    return h('form', { class: 'login__form', onSubmit: continuarCorreo, novalidate: true },
      h('h1', { class: 'login__titulo' }, 'Entra a tu editor'),
      h('p', { class: 'login__texto' }, 'Escribe el correo de tu cuenta.'),
      h('label', { class: 'login__label', for: 'login-correo' }, 'Correo'),
      h('input', {
        id: 'login-correo', class: 'login__input', type: 'email', name: 'email',
        autocomplete: 'username', inputmode: 'email', value: L.correo, 'data-foco': '1',
        onInput: (e) => { L.correo = e.target.value; },
      }),
      MensajeError(),
      Boton(L.cargando ? 'Revisando…' : 'Continuar')
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

  C.LoginScreen = function () {
    const aviso = C.auth && C.auth.aviso;
    const paso = L.paso === 'clave' ? PasoClave() : L.paso === 'crear' ? PasoCrear() : PasoCorreo();
    return h('div', { class: 'login' },
      h('div', { class: 'login__card' },
        Marca(),
        aviso && L.paso === 'correo' ? h('div', { class: 'login__aviso' }, aviso) : null,
        paso
      )
    );
  };

  /* Mientras se revisa si hay una sesión guardada */
  C.LoginScreen.cargando = function () {
    return h('div', { class: 'login' },
      h('div', { class: 'login__cargando' }, Marca(), h('div', { class: 'login__spin' }))
    );
  };
})();

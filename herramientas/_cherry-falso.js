/* Un CherryApp de mentira, solo para mirar la pantalla sin cuenta ni servidor.
 *
 * No habla con Supabase: devuelve una ficha con su guion ya escrito para poder ver la ficha
 * «un paso a la vez» con la tira de estilos. Lo que SÍ es de verdad son las miniaturas de
 * assets/estilos, que es lo que hay que juzgar.
 *
 * NUNCA se publica: vive junto a la página de prueba y no lo carga la herramienta real.
 */
(function () {
  'use strict';

  var PASOS = [
    { paso: 'Gancho', dice: 'Llevas tres años cobrando mal y no lo sabes.',
      ve: 'primer plano, mira a la cámara' },
    { paso: 'Contexto', dice: 'Cada domicilio que entra por el chat lo estás anotando aparte.',
      ve: 'plano medio en la cocina' },
    { paso: 'Open loop', dice: 'Y hay un número ahí que nadie mira.', ve: '' },
    { paso: 'Desarrollo', dice: '', ve: 'detalle de las manos con la comanda' },
    { paso: 'Prueba', dice: '', ve: '' },
    { paso: 'Cierre', dice: '', ve: '' },
  ];

  var DOC = {
    cuentas: [{ id: 'a', nombre: 'El Parche', rasgos: '' }],
    activa: 'a',
    fichas: [],
    videos: [],
    /* ⚠️ La ficha abierta sale de D.planes — `planVivo()` mira ahí, no en `fichas`. */
    planes: [{
      id: 'f1', titulo: 'El cobro que se pierde', dur: 45, cuenta: 'a',
      estilo: 'semireal', grabado: false,
      piezas: { idea: 'i1', estructura: 'e1' },
      guion: PASOS,
    }],
    piezas: {
      idea: [{ id: 'i1', texto: 'Lo que se pierde por cobrar a mano', cuenta: 'a' }],
      estructura: [{ id: 'e1', texto: 'La cadena', cuenta: 'a', pasos: PASOS.map(function (p) { return p.paso; }) }],
      gancho: [], formato: [],
    },
  };

  var USUARIO = { id: '00000000-0000-0000-0000-0000000000aa', email: 'prueba@cherry' };

  window.CherryApp = {
    usuario: function () { return USUARIO; },
    hayUsuario: function () { return Promise.resolve(USUARIO); },
    cargar: function () { return Promise.resolve(JSON.parse(JSON.stringify(DOC))); },
    guardar: function (h, d, avisa) { if (avisa) avisa('ok'); return Promise.resolve(); },
    copiaLocal: function () { return null; },
    marca: function () { return Promise.resolve({ nombre: 'El Parche' }); },
    guardarMarca: function () {},
    /* El saldo responde de verdad; dibujar, no: aquí no se gastan créditos. */
    ia: function (nombre, cuerpo) {
      if (nombre === 'sb-vineta' && cuerpo && cuerpo.modo === 'saldo') {
        return Promise.resolve({ usadas: 6, tope: 45, quedan: 39, mes: '2026-09' });
      }
      if (nombre === 'sb-vineta') {
        return Promise.reject(new Error('En la prueba no se dibuja: cuesta créditos de verdad.'));
      }
      return Promise.reject(new Error('sin servidor en la prueba'));
    },
    videosListos: function () { return Promise.resolve([]); },
    transcripcion: function () { return Promise.resolve(null); },
    proyectoConGuion: function () { return Promise.resolve(null); },
    abrirEditor: function () {}, irA: function () {},
    misColores: function () { return Promise.resolve(null); },
    guardarMisColores: function () {},
    perfil: function () { return Promise.resolve({ full_name: 'Sergio' }); },
    barra: function () {},
    rest: function () { return Promise.reject(new Error('sin servidor en la prueba')); },
    urlVideo: function (u) { return u; },
    funcionArchivo: function () { return Promise.reject(new Error('sin servidor en la prueba')); },
    base: function () { return ''; },
  };
})();

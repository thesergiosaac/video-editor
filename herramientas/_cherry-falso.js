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
    { escena: 'Gancho', dice: 'Llevas tres años cobrando mal y no lo sabes.',
      ve: 'primer plano, mira a la cámara' },
    { escena: 'Contexto', dice: 'Cada domicilio que entra por el chat lo estás anotando aparte.',
      ve: 'plano medio en la cocina' },
    { escena: 'Open loop', dice: 'Y hay un número ahí que nadie mira.', ve: '' },
    { escena: 'Desarrollo', dice: '', ve: 'detalle de las manos con la comanda' },
    { escena: 'Prueba', dice: '', ve: '' },
    { escena: 'Cierre', dice: '', ve: '' },
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
      estructura: [{ id: 'e1', texto: 'La cadena', cuenta: 'a', pasos: PASOS.map(function (p) { return p.escena; }) }],
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
      /* El guion entero, de mentira: sirve para ver la pantalla, no para juzgar el texto. */
      if (nombre === 'lab_escribir') {
        return new Promise(function (ok) {
          setTimeout(function () {
            ok({
              momento: 'Son las siete, el local está lleno y entra un pedido por WhatsApp.',
              remate: '«Ya no, gracias.»',
              porque: 'Del objetivo: mostrar cómo funciona WhatsApp.',
              palabras: 164, segundos: 49,
              quejas: [],
              escenas: (cuerpo.escenas || []).map(function (x, i) {
                return { escena: x.escena, dice: 'Frase de prueba número ' + (i + 1) + '.',
                         ve: 'plano de prueba ' + (i + 1) };
              }),
            });
          }, 600);
        });
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

/* frase.js — familia «Frase que se repite» (copia de @juadelazuaje, «Quería ser su amiga hasta que…»).
 * Solo tipografía: fondo liso, la MISMA frase de arranque en todas las láminas y lo que cambia es el final. Letra
 * geométrica gruesa color crema con UNA palabra en letra delgada, rúbrica arriba a la derecha y abajo a la izquierda
 * (sin @) y una estrellita de 4 puntas. La frase va centrada en alto y se achica si pasa de ~900 px. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var W = 1080;

  // las letras se piden apenas carga el archivo (la frase se centra midiendo su alto con la letra real)
  function precargar(letras, pesos) {
    letras.forEach(function (n) {
      LZ.cargarLetra(n);
      var l = document.querySelector('link[data-lz-letra="' + n + '"]');
      var ir = function () { pesos.forEach(function (p) { document.fonts.load(p + ' 40px "' + n + '"').catch(function () {}); }); };
      if (!l || l.sheet) ir(); else l.addEventListener('load', ir);
    });
  }
  precargar(['Poppins'], ['300', '400', '800']);

  function limpio(s) { return String(s || '').replace(/\*/g, ''); }
  // La palabra *delgada* es la excepción: en el elemento la frase es delgada y todo lo demás va *en negrita*
  // (así la palabra resaltada del editor, en modo «Negrita», es el resto de la frase y se puede editar normal).
  function invertir(inicio, fin) {
    var t = (String(inicio || '').trim() + ' ' + String(fin || '').trim()).trim();
    var partes = t.split(/\*([^*]+)\*/), out = '';
    partes.forEach(function (p, i) {
      if (i % 2) { out += p; return; }                    // la delgada, tal cual
      var m = p.match(/^(\s*)([\s\S]*?)(\s*)$/);           // los espacios quedan por fuera de la negrita
      out += m[1] + (m[2] ? '*' + m[2] + '*' : '') + m[3];
    });
    return out;
  }
  // tamaño de la frase: 118 px, y se achica de a 4 px si se pasa de ~900 px de alto (como la referencia)
  function tamano(txt) {
    var ps = limpio(txt).split(/\s+/), t = 118;
    for (; t > 70; t -= 4) {
      var cabe = 900 / (.50 * t), n = 1, act = 0;
      ps.forEach(function (p) { var l = p.length + (act ? 1 : 0); if (act && act + l > cabe) { n++; act = p.length; } else act += l; });
      if (n * t * .98 <= 900) break;
    }
    return t;
  }

  FAMILIAS.registrar('frase', {
    catalogo: {
      letras: { titular: 'Poppins', mano: 'Poppins', cuerpo: 'Poppins' },
      colores: { principal: '#FFF1BE', acento: '#FFF1BE', fondo: '#4A0E14', texto: '#FFF1BE' }
    },
    esquema: {
      nombre: 'Frase que se repite', nItems: 3, iconos: U.ICONOS_OK,
      guia: 'Solo texto, para humor u opinión sobre las frustraciones del oficio: la MISMA frase de arranque se repite en todas las láminas y lo único que cambia es el final, cada vez más absurdo o más cierto. Cada final lleva UNA palabra *resaltada* (va en letra delgada). No sirve para enseñar paso a paso.',
      portada: {
        final: { max: 50, desc: 'el primer final, el que engancha, con UNA palabra *resaltada* (p. ej. «dijo que la *retención* no importa»)' }
      },
      item: {
        final: { max: 50, desc: 'otro final distinto para la misma frase de arranque, con UNA palabra *resaltada* (p. ej. «dijo que el *gancho* va al final»)' }
      },
      cierre: {
        final: { max: 50, desc: 'el último final, el que remata, con UNA palabra *resaltada* (p. ej. «me pidió un reel *viral* para mañana»)' }
      },
      comun: {
        inicio: { max: 34, desc: 'la frase de arranque que se repite igual en todas las láminas y deja en suspenso (p. ej. «Quería ser su amigo hasta que»)' },
        firma: { max: 24, desc: 'rúbrica corta de arriba a la derecha, sin @ con el nombre de la MARCA que te doy (p. ej. «Ana · finanzas»)' },
        rubrica: { max: 28, desc: 'rúbrica de abajo a la izquierda, en minúscula (p. ej. «hablemos de contenido»)' }
      }
    },
    armar: function (c, mat, alto) {
      var H = alto || 1350, com = c.comun || {};
      var finales = [(c.portada || {}).final].concat((c.items || []).map(function (it) { return it && it.final; })).concat([(c.cierre || {}).final]);
      return finales.map(function (f, i) { return lamina(f || '', i); });

      function lamina(fin, i) {
        var txt = invertir(com.inicio, fin), els = [];
        if (com.firma) els.push(T({ nombre: 'Rúbrica de arriba', papel: 'rubrica-arriba', txt: com.firma, y: 80, fuente: '@cuerpo', tam: 26, peso: 400, color: '@texto', op: .8, z: 5, _der: W - 90 }));
        els.push(T({ nombre: 'La frase', papel: 'frase', txt: txt, w: W - 180, fuente: '@titular', tam: tamano(txt), peso: 300, interl: .98, espac: -.035, color: '@texto', colorAc: '@texto', modoAc: 'negrita', z: 5, _pila: { grupo: 'f', x: 90, w: W - 180, y: 0, h: H } }));
        if (com.rubrica) els.push(T({ nombre: 'Rúbrica de abajo', papel: 'rubrica-abajo', txt: com.rubrica, x: 90, y: H - 90 - 36, fuente: '@cuerpo', tam: 28, peso: 400, color: '@texto', op: .9, z: 5 }));
        els.push({ id: nid(), tipo: 'flecha', nombre: 'Estrellita', papel: 'estrella', src: U.BASE + 'piezas/frase/estrella.svg', color: '@texto', x: W - 90 - 44, y: H - 82 - 44, w: 44, h: 44, z: 5, rot: 0, op: 1 });
        return { fondo: '@fondo', els: els };
      }
    }
  });
})();

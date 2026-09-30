/* stickers.js — familia «Calcomanías» (variación de texto de «Hooks con cara pegada», copia de @lauradigitalcontent).
 * Fondo crema con rayas verticales suaves, pastilla vino en letra gruesa + serifa negra estrecha debajo, párrafo con
 * palabras en negrita del color, tarjeta blanca con el ejemplo, antes/después con lo viejo tachado y cierre en bloque
 * vino. Las calcomanías son OBJETOS reales con borde blanco (reloj, reloj de arena, papel, borrador, taza):
 * Sergio rechazó las manos y bocas sacadas de sus fotos, así que aquí no hay partes del cuerpo.
 */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var P = U.BASE + 'piezas/stickers/';
  // objetos CC0 del banco, ya con borde blanco de 12 px: [ancho, alto] para la proporción
  var CALCOS = { reloj: [442, 600], arena: [256, 600], papel: [600, 572], goma: [600, 445], taza: [600, 549] };
  var NOMBRES = { reloj: 'Reloj', arena: 'Reloj de arena', papel: 'Papel arrugado', goma: 'Borrador', taza: 'Taza' };

  // la flechita recta del pie de la portada (línea + punta), del color que se escoja
  LZ.tipo('stk-flecha', function (el, base, attrs, u) {
    var c = u.res(el.color), w = el.w, h = el.h;
    return '<div ' + attrs + ' style="' + base + '"><svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" style="display:block;overflow:visible"><path d="M4 ' + (h / 2) + ' H' + (w - 8) + ' M' + (w - 22) + ' ' + (h / 2 - 10) + ' L' + (w - 6) + ' ' + (h / 2) + ' L' + (w - 22) + ' ' + (h / 2 + 10) + '" stroke="' + c + '" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
  });

  FAMILIAS.registrar('stickers', {
    catalogo: {
      letras: { titular: 'Playfair Display', mano: 'Poppins', cuerpo: 'Poppins' },
      colores: { principal: '#6B0F1A', acento: '#6B0F1A', fondo: '#F8F2E4', texto: '#3D1016' },
      calcos: Object.keys(CALCOS).map(function (k) { return { id: k, nombre: NOMBRES[k], src: P + k + '.webp' }; }),
    },
    esquema: {
      nombre: 'Calcomanías', nItems: 4, iconos: U.ICONOS_OK,
      guia: 'Carrusel de texto para enseñar algo en pocos puntos: cada lámina es un punto numerado con una pastilla grande, un complemento en serifa, un párrafo corto con palabras en *negrita* y un ejemplo que se dice tal cual. Una lámina puede ser antes/después (lo que no se dice tachado). Calcomanías de objetos que acompañan el tema.',
      portada: {
        arriba: { max: 24, desc: 'primera línea, normal (p. ej. «Lo que tienes que decir»)' },
        pastilla: { max: 15, desc: 'lo que va en la pastilla vino (p. ej. «en los primeros»)' },
        grande: { max: 10, desc: 'remate gigante en serifa, una o dos palabras (p. ej. «3 segundos»)' },
        calcos: { lista: 3, desc: '3 calcomanías que acompañan el tema', campos: { n: { max: 6, desc: 'una de: reloj, arena, papel, goma, taza' } } },
      },
      item: {
        forma: { max: 9, desc: 'punto (lo normal) o contraste (antes/después); máximo UNA lámina contraste por carrusel' },
        pastilla: { max: 13, desc: 'el punto en 1–2 palabras, va en la pastilla (p. ej. «La promesa»)' },
        serif: { max: 15, desc: 'complemento en serifa debajo (p. ej. «en una frase»)' },
        texto: { max: 190, desc: 'dos frases cortas separadas por un renglón en blanco (\\n\\n), con 2 partes en *negrita* (p. ej. «Después dile *qué se va a llevar* si se queda.\\n\\nSi la promesa es vaga, *se va*.»)' },
        antes: { max: 60, desc: 'solo en contraste: lo que NO se dice, tal cual (p. ej. «Hola, ¿cómo están? Hoy les quiero hablar de…»)' },
        ejemplo: { max: 70, desc: 'el ejemplo que se dice tal cual, sin comillas (en contraste: la versión buena)' },
        calco: { max: 6, desc: 'calcomanía que acompaña este punto: reloj, arena, papel, goma o taza' },
      },
      cierre: {
        frase: { max: 44, desc: 'frase final en minúscula que invita a guardar (p. ej. «guárdalo y úsalo en tu próximo reel.»)' },
        calcos: { lista: 2, desc: '2 calcomanías', campos: { n: { max: 6, desc: 'una de: reloj, arena, papel, goma, taza' } } },
      },
      comun: {
        rubrica: { max: 24, desc: 'rúbrica pequeña arriba: nombre y tema, sin @ con el nombre de la MARCA que te doy (p. ej. «Ana · finanzas»)' },
        antes: { max: 10, desc: 'palabra de la pastilla de lo viejo (p. ej. «Antes»)' },
        despues: { max: 10, desc: 'palabra de la pastilla de lo nuevo (p. ej. «Después»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1350, comun = c.comun || {};
      var laminas = [portada()], nC = 0;
      (c.items || []).forEach(function (it, i) {
        var f = it.forma === 'contraste' && !nC && it.antes ? 'contraste' : 'punto';
        if (f === 'contraste') nC++;
        laminas.push(f === 'contraste' ? contraste(it) : punto(it, i + 1));
      });
      laminas.push(cierre());
      return laminas;

      function base() {
        return [
          { id: nid(), tipo: 'forma', nombre: 'Rayas del fondo', papel: 'rayas-fondo', fondo: 'repeating-linear-gradient(90deg,transparent 0 78px,rgba(160,105,15,.08) 78px 156px)', x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1, radio: 0, bloqueado: true },
          T({ nombre: 'Rúbrica', papel: 'rubrica', txt: comun.rubrica || '', x: 0, y: 18, w: W, alin: 'center', tam: 24, peso: 500, color: '@principal', op: .85, z: 6 }),
        ];
      }
      function calco(n, x, y, h, rot, maxW) {
        n = CALCOS[n] ? n : 'reloj';
        var r = CALCOS[n], w = Math.round(h * r[0] / r[1]);
        if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }   // los objetos anchos se achican para caber en su hueco
        if (x + w > W - 24) x = W - 24 - w;          // que no se salga por la derecha
        return { id: nid(), tipo: 'imagen', calco: true, nombre: 'Calcomanía (' + NOMBRES[n] + ')', papel: 'calco', src: P + n + '.webp', x: x, y: y, w: w, h: h, z: 7, rot: rot, op: 1 };
      }
      function pastilla(nombre, papel, txt, x, y, tam, padH) {
        return T({ nombre: nombre, papel: papel, txt: txt || '', x: x, y: y, fuente: '@cuerpo', tam: tam, peso: 800, espac: -.035, interl: 1, color: '#FFFFFF', caja: { fondo: '@principal', radio: 999, padV: Math.round(tam * .17), padH: padH }, z: 5 });
      }
      function serif(nombre, papel, txt, x, y, tam, extra) {
        return T(Object.assign({ nombre: nombre, papel: papel, txt: txt || '', x: x, y: y, fuente: '@titular', tam: tam, peso: 900, espac: -.06, interl: .9, color: '@principal', z: 5 }, extra || {}));
      }
      function tarjeta(nombre, papel, txt, x, y, w, extra) {
        return T(Object.assign({ nombre: nombre, papel: papel, txt: txt || '', x: x, y: y, w: w, tam: 40, peso: 600, interl: 1.3, color: '@texto', caja: { fondo: '#FFFFFF', radio: 30, padV: 44, padH: 48 }, z: 5 }, extra || {}));
      }
      function portada() {
        var els = base(), p = c.portada || {}, cs = (p.calcos || []).map(function (x) { return x && x.n; });
        els.push(
          T({ nombre: 'Primera línea', papel: 'arriba', txt: p.arriba, x: 120, y: 250, fuente: '@cuerpo', tam: 78, peso: 700, espac: -.04, interl: 1, color: '@principal' }),
          pastilla('Pastilla', 'pastilla-portada', p.pastilla, 120, 370, 100, 50),
          serif('Remate en serifa', 'grande', p.grande, 330, 548, 150),
          calco(cs[0] || 'reloj', 90, 560, 240, -8, 215),
          calco(cs[1] || 'reloj', 720, 880, 300, 10),
          calco(cs[2] || 'arena', 170, 920, 300, -12),
          { id: nid(), tipo: 'stk-flecha', nombre: 'Flecha', papel: 'flecha', color: '@principal', x: 480, y: H - 100, w: 120, h: 30, z: 6, rot: 0, op: 1 }
        );
        return { fondo: '@fondo', els: els };
      }
      function punto(it, k) {
        var els = base(), lado = k % 2;
        els.push(
          { id: nid(), tipo: 'forma', nombre: 'Círculo del número', papel: 'circulo', fondo: '@principal', radio: 999, x: 90, y: 170, w: 150, h: 150, z: 4, rot: 0, op: 1 },
          T({ nombre: 'Número', papel: 'numero', txt: String(k), x: 90, y: 196, w: 150, alin: 'center', fuente: '@cuerpo', tam: 96, peso: 800, interl: 1, color: '#FFFFFF', z: 5 }),
          pastilla('Pastilla', 'pastilla', it.pastilla, 270, 180, 92, 40),
          serif('Serifa', 'serif', it.serif, 290, 305, 96),
          T({ nombre: 'Texto', papel: 'texto', txt: it.texto, x: 110, y: 520, w: 860, tam: 44, peso: 500, interl: 1.35, color: '@texto', colorAc: '@principal', modoAc: 'negrita' }),
          tarjeta('Ejemplo', 'ejemplo', '«' + (it.ejemplo || '') + '»', 110, lado ? 950 : 930, 640),
          lado ? calco(it.calco, 790, 860, 360, 12, 250) : calco(it.calco, 780, 1110, 210, -10, 260)
        );
        return { fondo: '@fondo', els: els };
      }
      function contraste(it) {
        var els = base(), otro = it.calco === 'goma' ? 'papel' : 'goma';
        var txt = '«' + (it.antes || '') + '»';
        els.push(
          pastilla('Pastilla «Antes»', 'pastilla-antes', comun.antes || 'Antes', 90, 160, 100, 44),
          tarjeta('Lo de antes', 'antes', txt, 90, 320, 900, { color: '#9A8F86' }),
          calco(it.calco || 'papel', 780, 170, 190, 14),
          pastilla('Pastilla «Después»', 'pastilla-despues', comun.despues || 'Después', 90, 640, 100, 44),
          tarjeta('Lo de después', 'despues', '«' + (it.ejemplo || '') + '»', 90, 800, 900, { tam: 42, peso: 700 }),
          calco(otro, 110, 1080, 170, -14)
        );
        // la raya que tacha cada renglón de lo de antes (medida con la letra de la marca)
        lineas(txt, '600 40px "' + LZ.res('@cuerpo') + '", sans-serif', 804).forEach(function (w, i) {
          els.push({ id: nid(), tipo: 'forma', nombre: 'Tachón', papel: 'tachon', fondo: '@principal', radio: 2, x: 90 + 48, y: 320 + 44 + i * 52 + 27, w: Math.round(w), h: 4, z: 6, rot: 0, op: 1 });
        });
        return { fondo: '@fondo', els: els };
      }
      function cierre() {
        var els = base(), cs = ((c.cierre || {}).calcos || []).map(function (x) { return x && x.n; });
        els.push(
          serif('Frase final', 'frase-cierre', (c.cierre || {}).frase, 80, 470, 112, { w: 920, alin: 'center', interl: .95, color: '#FFFFFF', caja: { fondo: '@principal', radio: 0, padV: 65, padH: 50 } }),
          calco(cs[0] || 'reloj', 810, 250, 280, -12),
          calco(cs[1] || 'taza', 80, 880, 260, -6)
        );
        return { fondo: '@fondo', els: els };
      }
      // ancho de cada renglón del texto partido en un ancho dado (para el tachón)
      function lineas(txt, font, max) {
        var cv = document.createElement('canvas').getContext('2d'), k = 1; cv.font = font;
        // si la letra de la marca todavía no ha llegado, mide con la de reserva (sans-serif) y la ensancha: Poppins es ~4 % más ancha
        var fam = LZ.res('@cuerpo'), lista = false;
        if (document.fonts && document.fonts.forEach) document.fonts.forEach(function (f) { if (f.family.replace(/["']/g, '') === fam && f.status === 'loaded') lista = true; });
        if (!lista) k = 1.04;
        var out = [], cur = '';
        String(txt).split(/\s+/).forEach(function (p) {
          var prueba = cur ? cur + ' ' + p : p;
          if (cv.measureText(prueba).width * k > max && cur) { out.push(cv.measureText(cur).width * k); cur = p; } else cur = prueba;
        });
        if (cur) out.push(cv.measureText(cur).width * k);
        return out;
      }
    },
  });
})();

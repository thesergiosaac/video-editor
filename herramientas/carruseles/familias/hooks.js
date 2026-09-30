/* hooks.js — familia «Hooks con cara pegada» (copia de @lauradigitalcontent, «Hooks visuales que puedes intentar»). ANIMADA.
 * Fondo crema con rayas verticales suaves; cada hook en una pastilla vino (letra gruesa blanca) con una CALCOMANÍA de la
 * cara del usuario pegada a su borde derecho (sacada de SU foto analizada: la cabeza del recorte con borde blanco y
 * sombra, nunca manos ni bocas), una segunda línea en serifa gruesa y, debajo, un celular negro con el clip que MUESTRA
 * ese hook corriendo (el clip arranca en el segundo 0: el hook ES el arranque). Portada y cierre con el mismo sistema.
 */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var P = { x: 374, y: 444, w: 402, h: 802, r: 40 };   // pantalla del celular — la misma medida de hooks.py
  var DUR = 4.5;                                        // hooks.py corta cada clip en 4,5 s

  /* La calcomanía de la cara: la cabeza del recorte del usuario (máscara elíptica abajo, sin corte recto) con borde
     blanco y sombra. caraRel = la cara dentro del recorte (fracciones), asp = alto/ancho del recorte. */
  LZ.tipo('hk-cara', function (el, base, attrs, u) {
    var c = el.caraRel || [.35, .1, .3, .2], w = el.w, h = el.h;
    var fw = w * .68, IW = fw / c[2], IH = IW * (el.asp || 1);             // la cara ocupa ~2/3 del ancho: cabe el pelo
    var left = w / 2 - (c[0] + c[2] / 2) * IW, top = h * .85 - (c[1] + c[3]) * IH;   // la barbilla queda al 85 % del alto
    var b = Math.max(2, Math.round((el.bw == null ? h * .03 : el.bw) / 2 * 10) / 10), bc = u.res(el.borde || '#FFFFFF');
    // borde blanco: la sombra dura se suma a sí misma en 4 direcciones (queda un contorno parejo de 2·b px)
    var borde = ['drop-shadow(' + b + 'px 0 0 ' + bc + ')', 'drop-shadow(-' + b + 'px 0 0 ' + bc + ')', 'drop-shadow(' + b + 'px 0 0 ' + bc + ')', 'drop-shadow(-' + b + 'px 0 0 ' + bc + ')',
      'drop-shadow(0 ' + b + 'px 0 ' + bc + ')', 'drop-shadow(0 -' + b + 'px 0 ' + bc + ')', 'drop-shadow(0 ' + b + 'px 0 ' + bc + ')', 'drop-shadow(0 -' + b + 'px 0 ' + bc + ')',
      'drop-shadow(0 6px 10px rgba(60,10,20,.25))'].join(' ');
    // óvalo que corta el cuello y los hombros; arriba y a los lados manda la silueta del recorte (el pelo)
    var mask = 'radial-gradient(ellipse 50% 52% at 50% 44%,#000 97%,transparent 100%)';   // de -8 % a 96 % del alto: corta justo bajo la barbilla
    return '<div ' + attrs + ' style="' + base + 'filter:' + borde + '">' +
      '<div style="position:absolute;inset:0;overflow:hidden;-webkit-mask-image:' + mask + ';mask-image:' + mask + '">' +
      (el.src ? '<img src="' + u.esc(el.src) + '" draggable="false" crossorigin="anonymous" style="position:absolute;left:' + left.toFixed(1) + 'px;top:' + top.toFixed(1) + 'px;width:' + IW.toFixed(1) + 'px;height:' + IH.toFixed(1) + 'px;max-width:none">' : '') +
      '</div></div>';
  });
  // la flechita recta del pie de la portada
  LZ.tipo('hk-flecha', function (el, base, attrs, u) {
    var c = u.res(el.color), w = el.w, h = el.h;
    return '<div ' + attrs + ' style="' + base + '"><svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" style="display:block;overflow:visible"><path d="M4 ' + (h / 2) + ' H' + (w - 8) + ' M' + (w - 22) + ' ' + (h / 2 - 10) + ' L' + (w - 6) + ' ' + (h / 2) + ' L' + (w - 22) + ' ' + (h / 2 + 10) + '" stroke="' + c + '" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
  });
  // la muesca del celular (va ENCIMA del clip: sale en la capa de frente)
  LZ.tipo('hk-muesca', function (el, base, attrs, u) {
    var c = u.res(el.color || '#0B0B0B');
    return '<div ' + attrs + ' style="' + base + '"><div style="position:absolute;inset:0;border-radius:0 0 20px 20px;background:' + c + '"></div>' +
      '<div style="position:absolute;left:50px;top:10px;width:44px;height:6px;border-radius:3px;background:#333"></div>' +
      '<div style="position:absolute;left:106px;top:8px;width:10px;height:10px;border-radius:50%;background:#1b2a3a"></div></div>';
  });

  // ancho aproximado de un texto (para centrar la pastilla + calcomanía antes de que llegue la letra)
  function ancho(txt, peso, tam, fuente, espac) {
    var cv = ancho.cv || (ancho.cv = document.createElement('canvas').getContext('2d'));
    var f = peso + ' ' + tam + 'px "' + LZ.res(fuente) + '"', k = 1;
    var lista = false; try { lista = document.fonts.check(f); } catch (e) {}
    if (!lista) { f = peso + ' ' + tam + 'px Arial, sans-serif'; k = 1.12; }   // Poppins es ~12 % más ancha que la de reserva
    cv.font = f;
    var t = String(txt || '').replace(/\*/g, '');
    return cv.measureText(t).width * k + t.length * tam * (espac || 0);
  }

  FAMILIAS.registrar('hooks', {
    catalogo: {
      letras: { titular: 'Playfair Display', mano: 'Poppins', cuerpo: 'Poppins' },
      colores: { principal: '#6B0F1A', acento: '#6B0F1A', fondo: '#F8F2E4', texto: '#6B0F1A' },
    },
    esquema: {
      nombre: 'Hooks con cara pegada', nItems: 4, iconos: U.ICONOS_OK,
      guia: 'Carrusel animado de GANCHOS VISUALES o técnicas para arrancar un video: cada lámina es UN hook dicho en 2 partes (una palabra fuerte en la pastilla + el complemento en serifa) y debajo el clip que muestra ese hook en acción. Portada que promete los hooks y cierre que pide comentar una palabra.',
      portada: {
        arriba: { max: 16, desc: 'primera línea, corta (p. ej. «Deja de iniciar»)' },
        arriba2: { max: 11, desc: 'segunda línea, antes de la palabra en círculo (p. ej. «tus videos»)' },
        circulo: { max: 10, desc: 'UNA palabra que va encerrada en un óvalo (p. ej. «aburridos»)' },
        grande: { max: 15, desc: 'el tema en letra gigante, 1–2 palabras (p. ej. «Hooks visuales»)' },
        pastilla: { max: 11, desc: 'lo que va en la pastilla vino (p. ej. «que puedes»)' },
        serif: { max: 9, desc: 'remate en serifa, UNA palabra (p. ej. «intentar»)' },
      },
      item: {
        pastilla: { max: 12, desc: 'la acción del hook en UNA palabra, va en la pastilla (p. ej. «Deslizándote», «Inicia», «Asomándote»)' },
        serif: { max: 14, desc: 'el complemento en serifa debajo (p. ej. «a un lado», «caminando», «desde el borde»)' },
      },
      cierre: {
        frase: { max: 46, desc: 'llamado a comentar una palabra en mayúsculas, en minúscula lo demás (p. ej. «comenta HOOK y te envío más ideas a tu dm.»)' },
      },
      comun: {
        rubrica: { max: 24, desc: 'rúbrica pequeña arriba: nombre y tema, sin @, con el nombre de la MARCA que te doy (p. ej. «Ana · contenido»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1350, comun = c.comun || {};
      var fotos = (mat && mat.fotos) || [], clips = (mat && mat.clips) || [];
      // las fotos que sirven para calcomanía: con cara Y con recorte (se van turnando lámina por lámina)
      var caras = fotos.filter(function (f) { return f && f.cara && f.recorte_url && f.recorte_caja; });
      caras.sort(function (a, b) { return (b.cara[2] * b.cara[3]) / (b.w * b.h) - (a.cara[2] * a.cara[3]) / (a.w * a.h); });
      var laminas = [portada()];
      (c.items || []).forEach(function (it, i) { laminas.push(interior(it, i)); });
      laminas.push(cierre());
      return laminas;

      function base() {
        return [
          { id: nid(), tipo: 'forma', nombre: 'Rayas del fondo', papel: 'rayas-fondo', fondo: 'repeating-linear-gradient(90deg,transparent 0 78px,rgba(160,105,15,.075) 78px 156px)', x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1, radio: 0, bloqueado: true },
          T({ nombre: 'Rúbrica', papel: 'rubrica', txt: comun.rubrica || '', x: 0, y: 18, w: W, alin: 'center', fuente: '@cuerpo', tam: 24, peso: 500, color: '@principal', op: .85, z: 6 }),
        ];
      }
      function cara(k, x, y, h, rot, extra) {
        var f = caras.length ? caras[k % caras.length] : null; if (!f) return null;
        var r = f.recorte_caja, fc = f.cara;
        return Object.assign({ id: nid(), tipo: 'hk-cara', nombre: 'Calcomanía de tu cara', papel: 'cara', src: f.recorte_url, ref: { foto: f.id, campo: 'recorte' },
          caraRel: [(fc[0] - r[0]) / r[2], (fc[1] - r[1]) / r[3], fc[2] / r[2], fc[3] / r[3]], asp: r[3] / r[2],
          x: x, y: y, w: Math.round(h * .72), h: h, z: 7, rot: rot || 0, op: 1 }, extra || {});
      }
      function pastilla(nombre, papel, txt, x, y, tam, padV1, padH, padV2, extra) {
        return T(Object.assign({ nombre: nombre, papel: papel, txt: txt || '', x: x, y: y, fuente: '@cuerpo', tam: tam, peso: 800, espac: -.035, interl: 1, color: '#FFFFFF',
          caja: { fondo: '@principal', radio: 999, padV: Math.round((padV1 + padV2) / 2), padH: padH }, z: 5 }, extra || {}));
      }
      function serif(nombre, papel, txt, x, y, tam, extra) {
        return T(Object.assign({ nombre: nombre, papel: papel, txt: txt || '', x: x, y: y, fuente: '@titular', tam: tam, peso: 900, espac: -.06, interl: .9, color: '@principal', z: 5 }, extra || {}));
      }
      function portada() {
        var els = base(), p = c.portada || {};
        var circ = T({ nombre: 'Palabra en óvalo', papel: 'circulo', txt: p.circulo || '', fuente: '@cuerpo', tam: 56, peso: 600, espac: -.03, interl: 1, color: '@principal', rot: -4,
          caja: { borde: '@principal', bw: 5, radio: 999, padV: 3, padH: 20 }, x: 0, y: 432, z: 5, _fila: { grupo: 'l2', x: 180, gap: 18 } });
        els.push(
          T({ nombre: 'Primera línea', papel: 'arriba', txt: p.arriba || '', x: 180, y: 330, fuente: '@cuerpo', tam: 84, peso: 700, espac: -.04, interl: 1, color: '@principal' }),
          T({ nombre: 'Segunda línea', papel: 'arriba2', txt: p.arriba2 || '', x: 180, y: 420, fuente: '@cuerpo', tam: 72, peso: 800, espac: -.05, interl: 1, color: '@principal', _fila: { grupo: 'l2', x: 180, gap: 18 } }),
          circ,
          T({ nombre: 'Tema en grande', papel: 'grande', txt: p.grande || '', x: 0, y: 690, w: W, alin: 'center', fuente: '@cuerpo', tam: 128, peso: 800, espac: -.06, interl: 1, color: '@principal' }),
          pastilla('Pastilla', 'pastilla-portada', p.pastilla, 170, 850, 112, 10, 60, 20),
          serif('Remate en serifa', 'serif-portada', p.serif, 540, 990, 150),
          { id: nid(), tipo: 'hk-flecha', nombre: 'Flecha', papel: 'flecha', color: '@principal', x: 470, y: H - 90, w: 120, h: 30, z: 6, rot: 0, op: 1 }
        );
        var k = cara(0, 230, 960, 250, 0); if (k) els.push(k);
        return { fondo: '@fondo', els: els };
      }
      function interior(it, i) {
        var els = base(), txt = String(it.pastilla || '');
        var tam = txt.length > 12 ? 88 : txt.length > 8 ? 100 : 112;
        var k = cara(i + (caras.length > 1 ? 1 : 0), 0, 118, 170, 0);
        // pastilla + calcomanía centradas juntas (la calcomanía se monta 20 px sobre el borde de la pastilla)
        var wP = ancho(txt, 800, tam, '@cuerpo', -.035) + 88, tot = wP + (k ? 150 : 0), x0 = Math.round(540 - tot / 2);
        els.push(pastilla('Hook', 'pastilla', txt, x0, 140, tam, 14, 44, 22, k ? { _fila: { grupo: 'hk', x: x0, gap: -20 } } : {}));
        if (k) { k._fila = { grupo: 'hk', x: x0, gap: 0 }; els.push(k); }
        // la serifa arranca en la mitad (x 500, como la referencia); si no cabe, se recuesta al margen derecho
        var s = serif('Complemento en serifa', 'serif', it.serif, 500, 278, 104, { espac: -.06 });
        if (ancho(it.serif, 900, 104, '@titular', -.06) > 1020 - 500) { delete s.x; s._der = 1020; }
        els.push(s);
        // el celular: cuerpo y botones DETRÁS del clip; la muesca, ENCIMA
        els.push(
          { id: nid(), tipo: 'forma', nombre: 'Celular', papel: 'celular-cuerpo', fondo: '#0B0B0B', radio: 58, sombra: true, x: P.x - 18, y: P.y - 18, w: P.w + 36, h: P.h + 36, z: 2, rot: 0, op: 1 },
          { id: nid(), tipo: 'forma', nombre: 'Botón lateral', papel: 'celular-boton', interno: true, fondo: '#0B0B0B', radio: 5, x: P.x - 26, y: P.y + 120, w: 10, h: 80, z: 2, rot: 0, op: 1 },
          { id: nid(), tipo: 'forma', nombre: 'Botón lateral', papel: 'celular-boton', interno: true, fondo: '#0B0B0B', radio: 5, x: P.x + P.w + 16, y: P.y + 170, w: 10, h: 120, z: 2, rot: 0, op: 1 },
          { id: nid(), tipo: 'hk-muesca', nombre: 'Muesca del celular', papel: 'muesca', color: '#0B0B0B', x: P.x + P.w / 2 - 80, y: P.y - 2, w: 160, h: 34, z: 8, rot: 0, op: 1 }
        );
        var clip = clips.length ? clips[i % clips.length] : null, foto = !clip && fotos.length ? fotos[i % fotos.length] : null;
        if (clip) els.push({ id: nid(), tipo: 'video', nombre: 'Clip del hook', papel: 'clip', src: clip.video, poster: clip.url, ini: 0, dur: Math.min(DUR, clip.dur || DUR),
          x: P.x, y: P.y, w: P.w, h: P.h, radio: P.r, posY: 50, sombra: false, borde: null, bw: 0, z: 3, rot: 0, op: 1, ref: { clip: clip.id } });
        else if (foto) els.push(U.fotoEl(foto, { x: P.x, y: P.y, w: P.w, h: P.h }, { nombre: 'Foto del hook', papel: 'clip', radio: P.r, z: 3 }));
        else els.push({ id: nid(), tipo: 'forma', nombre: 'Pantalla', papel: 'pantalla', fondo: '#1C1C1E', radio: P.r, x: P.x, y: P.y, w: P.w, h: P.h, z: 3, rot: 0, op: 1 });
        return { fondo: '@fondo', els: els };
      }
      function cierre() {
        var els = base();
        els.push(serif('Frase final', 'frase-cierre', (c.cierre || {}).frase, 80, 500, 118, { w: 920, alin: 'center', interl: .95, color: '#FFFFFF', caja: { fondo: '@principal', radio: 0, padV: 65, padH: 50 } }));
        var k = cara(caras.length > 1 ? caras.length - 1 : 0, 70, 900, 280, -6); if (k) els.push(k);
        return { fondo: '@fondo', els: els };
      }
    },
  });
})();

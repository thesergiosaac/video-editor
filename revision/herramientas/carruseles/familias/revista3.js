/* revista3.js — familia «Revista de tendencias» (copia de @social.unicorns, «October Social Trends»). ANIMADA.
 * Portada tipo revista: el mes en serifa cursiva + titular en sans negra + tres tarjetas con clips. Interior partido:
 * un bloque de color de 540 px (café, rosa, amarillo… alternando el lado) con el título y el texto, y el otro lado crema
 * con rayas finas, cabecera «Formatos / MES AÑO», el clip de ejemplo en una tarjeta alta y la rúbrica en cursiva.
 * Cierre con «parte 2», la pastilla para comentar y la persona recortada abajo.
 */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  // tarjetas de video — las mismas medidas de revista3.py
  var V_IZQ = { x: 600, y: 300, w: 420, h: 740, r: 30 }, V_DER = { x: 60, y: 300, w: 420, h: 740, r: 30 };
  var PORT = [{ x: 50, y: 790, w: 300, h: 440, r: 26 }, { x: 390, y: 790, w: 300, h: 440, r: 26 }, { x: 730, y: 790, w: 300, h: 440, r: 26 }];
  var AMARILLO = '#F4EDC6';   // el tercer bloque de la referencia (parte del diseño, no de la marca)

  FAMILIAS.registrar('revista3', {
    catalogo: {
      letras: { titular: 'Oswald', mano: 'Playfair Display', cuerpo: 'Inter' },
      colores: { principal: '#4A2A26', acento: '#F3D3DA', fondo: '#F6F0DF', texto: '#4A2A26' },
    },
    esquema: {
      nombre: 'Revista de tendencias', nItems: 4, iconos: U.ICONOS_OK,
      guia: 'Carrusel animado tipo revista para RECOPILAR formatos o tendencias del mes: portada con el mes y el tema; cada lámina del medio es UN formato con su nombre, cómo se hace y para qué sirve (con palabras en *negrita*), al lado de un clip que lo muestra; el cierre anuncia la parte 2 y pide comentar una palabra.',
      portada: {
        rotulo: { max: 22, desc: 'rótulo de arriba con el mes (p. ej. «Mes: octubre 2026»)' },
        mes: { max: 10, desc: 'el mes o la palabra grande en cursiva, UNA palabra (p. ej. «Octubre»)' },
        titular: { max: 24, desc: 'el tema en 2 renglones cortos separados con \\n, máx. 11 letras por renglón (p. ej. «Formatos\\npara grabar»)' },
      },
      item: {
        titulo: { max: 24, desc: 'nombre del formato en 2 renglones cortos separados con \\n, máx. 12 letras por renglón (p. ej. «Caminando\\na la cámara»)' },
        texto: { max: 260, desc: 'dos párrafos cortos separados por un renglón en blanco (\\n\\n): cómo se graba y para qué sirve, con 2 o 3 partes en *negrita* (p. ej. «Arranca lejos y *camina hacia la cámara* mientras dices el gancho.\\n\\nFunciona para *marca personal e historias*.»)' },
      },
      cierre: {
        grande: { max: 24, desc: 'anuncio en 2 renglones separados con \\n, en mayúsculas (p. ej. «PARTE 2\\nMUY PRONTO»)' },
        sub: { max: 28, desc: 'frase en cursiva en 2 renglones separados con \\n (p. ej. «Sígueme para\\nno perderla»)' },
        boton: { max: 60, desc: 'pastilla para comentar una palabra entre comillas angulares (p. ej. «Comenta «FORMATOS» y te paso la lista completa del mes»)' },
      },
      comun: {
        rubrica: { max: 24, desc: 'rúbrica en cursiva: nombre y tema, sin @, con el nombre de la MARCA que te doy (p. ej. «Ana · contenido»)' },
        cabecera: { max: 12, desc: 'palabra de la cabecera de cada lámina, lo que se recopila (p. ej. «Formatos», «Tendencias»)' },
        fecha: { max: 16, desc: 'debajo de la cabecera: mes y año (p. ej. «Octubre 2026»)' },
        pie_clip: { max: 22, desc: 'rótulo pequeño debajo del clip (p. ej. «clip de ejemplo»)' },
      },
    },
    armar: function (c, mat, alto) {
      var W = 1080, H = alto || 1350, comun = c.comun || {};
      var fotos = (mat && mat.fotos) || [], clips = (mat && mat.clips) || [];
      var laminas = [portada()];
      (c.items || []).forEach(function (it, i) { laminas.push(interior(it, i)); });
      laminas.push(cierre());
      return laminas;

      function rayas() {
        return { id: nid(), tipo: 'forma', nombre: 'Rayas del fondo', papel: 'rayas-fondo', fondo: 'repeating-linear-gradient(90deg,transparent 0 26px,rgba(140,105,30,.11) 26px 30px,transparent 30px 64px)', x: 0, y: 0, w: W, h: H, z: 0, rot: 0, op: 1, radio: 0, bloqueado: true };
      }
      function rubrica(extra) { return T(Object.assign({ nombre: 'Rúbrica', papel: 'rubrica', txt: comun.rubrica || '', fuente: '@mano', tam: 28, peso: 500, cursiva: true, color: '@texto', z: 5 }, extra)); }
      // la tarjeta de un clip (o, sin clips, una foto; sin nada, una tarjeta vacía del color del texto muy suave)
      function tarjeta(R, k, nombre) {
        var clip = clips.length ? clips[k % clips.length] : null, foto = !clip && fotos.length ? fotos[k % fotos.length] : null;
        if (clip) return { id: nid(), tipo: 'video', nombre: nombre, papel: 'clip', src: clip.video, poster: clip.url, ini: 0, dur: Math.min(6, clip.dur || 6),
          x: R.x, y: R.y, w: R.w, h: R.h, radio: R.r, posY: 50, sombra: false, borde: null, bw: 0, z: 3, rot: 0, op: 1, ref: { clip: clip.id } };
        if (foto) return U.fotoEl(foto, { x: R.x, y: R.y, w: R.w, h: R.h }, { nombre: nombre.replace('Clip', 'Foto'), papel: 'clip', radio: R.r, z: 3 });
        return { id: nid(), tipo: 'forma', nombre: 'Tarjeta', papel: 'clip', fondo: 'rgba(74,42,38,.1)', radio: R.r, x: R.x, y: R.y, w: R.w, h: R.h, z: 3, rot: 0, op: 1 };
      }
      function portada() {
        var p = c.portada || {};
        var els = [rayas(),
          T({ nombre: 'Rótulo del mes', papel: 'rotulo', txt: p.rotulo || '', x: 60, y: 60, fuente: '@cuerpo', tam: 22, peso: 500, espac: .04, mayus: true, color: '@texto', z: 5 }),
          rubrica({ y: 52, _der: W - 60 }),
          T({ nombre: 'Mes en cursiva', papel: 'mes', txt: p.mes || '', x: 0, y: 170, w: W, alin: 'center', fuente: '@mano', tam: 180, peso: 500, cursiva: true, interl: 1, color: '@texto', z: 5 }),
          T({ nombre: 'Titular', papel: 'titular-portada', txt: p.titular || '', x: 0, y: 370, w: W, alin: 'center', fuente: '@cuerpo', tam: 150, peso: 800, interl: .92, espac: -.05, color: '@texto', z: 5 }),
        ];
        PORT.forEach(function (R, k) { els.push(tarjeta(R, k, 'Clip ' + (k + 1) + ' de la portada')); });
        return { fondo: '@fondo', els: els };
      }
      function interior(it, i) {
        var izq = i % 2 === 0, V = izq ? V_IZQ : V_DER, px = izq ? 0 : 540, lx = izq ? 600 : 60;
        var tono = i % 3, bg = ['@principal', '@acento', AMARILLO][tono], tx = tono === 0 ? '@fondo' : '@texto';
        var pila = { grupo: 'b', x: px + 56, w: 434, y: 250, h: 0, gap: 80 };   // h 0: la pila arranca arriba (y 250) y baja
        var els = [rayas(),
          { id: nid(), tipo: 'forma', nombre: 'Bloque de color', papel: 'bloque', fondo: bg, radio: 0, x: px, y: 0, w: 540, h: H, z: 1, rot: 0, op: 1 },
          T({ nombre: 'Título', papel: 'titulo', txt: it.titulo || '', w: 434, fuente: '@cuerpo', tam: 60, peso: 800, interl: 1, espac: -.03, color: tx, _pila: pila, z: 5 }),
          T({ nombre: 'Texto', papel: 'cuerpo', txt: it.texto || '', w: 428, fuente: '@cuerpo', tam: 28, peso: 400, interl: 1.42, color: tx, colorAc: tx, modoAc: 'negrita', _pila: pila, z: 5 }),
          T({ nombre: 'Cabecera', papel: 'cabecera', txt: comun.cabecera || '', x: lx, y: 60, fuente: '@titular', tam: 44, peso: 500, interl: 1, espac: -.01, color: '@texto', z: 5 }),
          T({ nombre: 'Fecha', papel: 'fecha', txt: comun.fecha || '', x: lx, y: 112, fuente: '@cuerpo', tam: 22, peso: 500, espac: .04, mayus: true, color: '@texto', z: 5 }),
          tarjeta(V, i, 'Clip de ejemplo'),
          T({ nombre: 'Pie del clip', papel: 'pie-clip', txt: comun.pie_clip || '', x: V.x, y: V.y + V.h + 22, w: V.w, alin: 'center', fuente: '@cuerpo', tam: 22, peso: 500, color: '@texto', z: 5 }),
          rubrica({ x: lx, y: 1270 }),
        ];
        return { fondo: '@fondo', els: els };
      }
      function cierre() {
        var q = c.cierre || {};
        var els = [rayas(),
          T({ nombre: 'Anuncio', papel: 'grande-cierre', txt: q.grande || '', x: 0, y: 120, w: W, alin: 'center', fuente: '@titular', tam: 120, peso: 500, interl: .95, espac: -.01, color: '@texto', z: 5 }),
          T({ nombre: 'Frase en cursiva', papel: 'sub-cierre', txt: q.sub || '', x: 0, y: 400, w: W, alin: 'center', fuente: '@mano', tam: 88, peso: 500, cursiva: true, interl: 1.05, color: '@texto', z: 5 }),
          T({ nombre: 'Botón comentar', papel: 'boton', txt: q.boton || '', x: 150, y: 640, w: 780, alin: 'center', fuente: '@cuerpo', tam: 36, peso: 700, cursiva: true, interl: 1.25, color: '#FFFFFF', caja: { fondo: '@principal', radio: 22, padV: 22, padH: 30 }, z: 5 }),
        ];
        // la persona recortada, abajo y a la derecha del centro (como la referencia); se sale por abajo
        // de pie se ve mejor: la foto cuyo recorte es más alto que ancho (con cara, si hay empate)
        var rec = fotos.filter(function (x) { return x && x.recorte_url && x.recorte_caja; });
        rec.sort(function (a, b) { return (b.recorte_caja[3] / b.recorte_caja[2] + (b.cara ? .2 : 0)) - (a.recorte_caja[3] / a.recorte_caja[2] + (a.cara ? .2 : 0)); });
        var f = rec[0];
        if (f) {
          var k = f.recorte_caja, s = 900 / k[3];                 // la cabeza queda cerca de y 780 y el cuerpo se sale por abajo
          if (k[2] * s > 760) s = 760 / k[2];
          var w = Math.round(k[2] * s), h = Math.round(k[3] * s), x = Math.round(Math.min(W - w + 40, Math.max(-40, 720 - w / 2)));
          els.push({ id: nid(), tipo: 'imagen', nombre: 'Tú (recorte)', papel: 'persona', src: f.recorte_url, ref: { foto: f.id, campo: 'recorte' },
            x: x, y: Math.max(780, H + 60 - h), w: w, h: h, z: 6, rot: 0, op: 1, radio: 0, zoom: 1, brillo: 1, contraste: 1, sat: 1 });
        }
        return { fondo: '@fondo', els: els };
      }
    },
  });
})();

/* crema.js — familia «Crema con serifa» (copia de @nicofastt, «Hasta nunca agencias»).
 * Portada de estudio: la persona recortada y agrandada sobre un fondo de un color (el principal oscurecido, con un
 * brillo de lado) y el titular arriba. Interior crema: pastilla «PASO N», titular en serifa con UNA palabra en cursiva
 * de color, subtítulo corto, tarjeta negra redondeada con la lista (o la captura real) y una frase en negrita.
 * Pie con rúbrica en cursiva (sin @). Cierre: «Comenta» + la palabra gigante en cursiva. */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var W = 1080, NEGRO = '#0E0E0E';

  /* Las letras de la familia se piden apenas carga este archivo, CON la cursiva: LZ.listas solo espera la letra derecha,
     y si la cursiva no ha llegado cuando se mide, la palabra en cursiva queda mal ubicada en su fila. */
  function precargar(letras, estilos) {
    letras.forEach(function (n) {
      LZ.cargarLetra(n);
      var l = document.querySelector('link[data-lz-letra="' + n + '"]');
      var ir = function () { estilos.forEach(function (s) { document.fonts.load(s + ' 40px "' + n + '"').catch(function () {}); }); };
      if (!l || l.sheet) ir(); else l.addEventListener('load', ir);
    });
  }
  precargar(['Instrument Serif'], ['400', 'italic 400']);
  precargar(['Inter'], ['500', '600', '700', '900']);

  function limpio(s) { return String(s || '').replace(/\*/g, ''); }
  /* El ancho de un texto, calculado AQUÍ (no al medir): LZ.listas no espera la hoja de letras de Google ni la cursiva,
     y si se mide con la letra de reemplazo la palabra en cursiva queda corrida. Con la letra ya cargada se mide en un
     lienzo; si no, con la tabla de anchos de la letra de muestra (Instrument Serif, centésimas de em por letra). */
  var LETRAS = "abcdefghijklmnopqrstuvwxyzáéíóúñüABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ0123456789 .,;:¿?¡!…-«»()'\"";
  var TABLA = {
    n: [40,44,34,46,36,29,40,47,22,22,45,22,70,47,41,44,44,32,31,26,45,39,60,39,40,35,40,36,22,41,45,47,45,46,48,48,53,45,41,52,55,25,25,50,41,67,54,54,47,54,51,41,46,54,46,65,55,48,43,46,45,25,54,54,54,46,25,40,37,39,38,40,36,43,40,17,21,22,22,21,32,32,24,24,53,43,41,41,34,34,23,37],
    i: [47,43,35,47,35,27,40,48,29,27,45,24,75,52,41,45,43,37,30,27,51,41,61,45,42,39,47,35,29,41,51,52,51,46,48,48,54,45,41,51,55,25,25,50,41,67,54,54,47,54,53,42,46,54,46,65,55,48,43,46,45,25,54,54,54,46,25,40,37,39,39,41,37,44,41,17,22,22,30,30,36,36,27,28,54,43,42,42,35,35,24,37]
  };
  var lienzo = null;
  function cargada(fam, cursiva) {
    var ok = false;
    try { document.fonts.forEach(function (f) { if (f.family.replace(/["']/g, '') === fam && f.status === 'loaded' && (f.style === 'italic') === !!cursiva) ok = true; }); } catch (e) {}
    return ok;
  }
  function ancho(txt, fam, cursiva, peso, tam, espac) {
    txt = String(txt || ''); var w;
    if (cargada(fam, cursiva)) {
      lienzo = lienzo || document.createElement('canvas').getContext('2d');
      lienzo.font = (cursiva ? 'italic ' : '') + peso + ' ' + tam + 'px "' + fam + '"';
      w = lienzo.measureText(txt).width;
    } else if (fam === 'Instrument Serif') {
      var tb = TABLA[cursiva ? 'i' : 'n']; w = 0;
      for (var i = 0; i < txt.length; i++) { var k = LETRAS.indexOf(txt[i]); w += (k < 0 ? 42 : tb[k]) * tam / 100; }
    } else w = txt.length * tam * (peso >= 600 ? .56 : .5);
    return w + (espac || 0) * tam * txt.length;
  }
  // «Sube tus *clips*» → antes / cursiva / después (si no marcó nada, la cursiva es la última palabra)
  function partes(t) {
    t = String(t || '').trim();
    var m = t.match(/^([^*]*)\*([^*]+)\*(.*)$/);
    if (m) return [m[1].trim(), m[2].trim(), m[3].trim()];
    var ps = t.split(/\s+/); if (ps.length < 2) return ['', t, ''];
    return [ps.slice(0, -1).join(' '), ps[ps.length - 1], ''];
  }
  function lineas(txt, porLinea) { var n = 0; String(txt || '').split('\n').forEach(function (l) { n += Math.max(1, Math.ceil(l.length / porLinea)); }); return n; }
  // el color principal al 10 % (fondo de la pastilla), leído del kit de ese momento
  function suave(a) {
    var h = LZ.res('@principal');
    if (!/^#[0-9a-f]{6}$/i.test(h)) return 'rgba(225,37,27,' + a + ')';
    var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  FAMILIAS.registrar('crema', {
    catalogo: {
      letras: { titular: 'Instrument Serif', mano: 'Instrument Serif', cuerpo: 'Inter' },
      colores: { principal: '#E1251B', acento: '#0E0E0E', fondo: '#F3EFE7', texto: '#151515' }
    },
    esquema: {
      nombre: 'Crema con serifa', nItems: 4, iconos: U.ICONOS_OK,
      guia: 'Estilo editorial limpio para enseñar un sistema o vender un servicio paso a paso: portada con tu foto de estudio y un titular de «antes y ahora»; cada lámina del medio es UN paso con titular en serifa (una palabra en cursiva de color), una explicación corta, una tarjeta negra con la lista o la captura real, y una frase en negrita. Cierra pidiendo que comenten una palabra.',
      portada: {
        antes: { max: 18, desc: 'arranque corto con coma (p. ej. «Hasta nunca,»)' },
        titular: { max: 16, desc: 'lo que queda atrás, 2 o 3 palabras (p. ej. «edición a mano»)' },
        sub: { max: 36, desc: 'lo de ahora, con UNA palabra *en cursiva* (la marca o la herramienta) y una flecha al final (p. ej. «Ahora *Cherry* edita mis videos →»)' }
      },
      item: {
        forma: { max: 8, desc: 'UNA de: «lista» (tarjeta con 3 o 4 puntos), «captura» (una captura real de la pantalla + 4 puntos cortos), «flujo» (lista + el sistema en 3 pasos). La «captura» solo si hay una foto de la pantalla para ese paso; «flujo» casi al final.' },
        rotulo: { max: 22, desc: 'solo en «flujo»: nombre corto del sistema en mayúscula (p. ej. «Editar sin editar»); vacío en las demás' },
        titulo: { max: 30, desc: 'el paso en pocas palabras con UNA palabra *en cursiva* (p. ej. «Sube tus *clips*», «Cherry *corta* por ti.»). En «flujo» puede ser más largo, hasta 40 letras (p. ej. «En lugar de pasar horas *editando*…»)' },
        sub: { max: 90, desc: 'qué hace la persona en este paso, una o dos frases (p. ej. «Graba como siempre y súbelos a Cherry desde el celular o el computador.»)' },
        lista: { lista: 4, desc: '3 o 4 puntos cortos de la tarjeta (en «captura», 4 puntos muy cortos)', campos: { t: { max: 30, desc: 'punto corto, sin punto final (p. ej. «Tus clips en bruto»)' } } },
        flujo: { lista: 3, desc: 'solo en «flujo»: el sistema en 3 pasos de una o dos palabras; el del medio es tu herramienta o tu método (p. ej. «Tus clips», «Cherry», «Publicas»)', campos: { t: { max: 12, desc: 'una o dos palabras' } } },
        frase: { max: 70, desc: 'la conclusión del paso en negrita, una frase (p. ej. «Cherry usa esto para editar tu video con tu estilo.»); vacía en «flujo»' }
      },
      cierre: {
        antes: { max: 14, desc: 'la acción (p. ej. «Comenta»)' },
        palabra: { max: 10, desc: 'la palabra para comentar, en mayúscula (p. ej. «CEREZA»)' },
        texto: { max: 60, desc: 'lo que recibe, en dos líneas separadas con salto de línea (p. ej. «y te envío el acceso\\npara que lo pruebes.»)' }
      },
      comun: {
        pastilla: { max: 10, desc: 'la palabra de la pastilla de cada paso (p. ej. «Paso»)' },
        firma: { max: 24, desc: 'rúbrica corta del pie, sin @ (p. ej. «Contenido con IA»)' }
      }
    },
    armar: function (c, mat, alto) {
      var H = alto || 1350, items = c.items || [], n = items.length, fotos = (mat && mat.fotos) || [], usadas = [];
      var com = c.comun || {};
      precargar([LZ.res('@titular'), LZ.res('@mano')], ['400', 'italic 400']);   // si la marca cambió las letras
      var laminas = [portada()];
      items.forEach(function (it, k) { laminas.push(interior(it, k + 1)); });
      laminas.push(cierre());
      return laminas;

      function pie(els) {
        if (com.firma) els.push(T({ nombre: 'Rúbrica', papel: 'rubrica', txt: com.firma, y: H - 60 - 36, fuente: '@mano', cursiva: true, tam: 30, peso: 400, color: '@principal', z: 5, _der: W - 90 }));
      }

      function portada() {
        var p = c.portada || {}, els = [];
        els.push(
          { id: nid(), tipo: 'forma', nombre: 'Sombra del fondo', papel: 'fondo-sombra', fondo: 'radial-gradient(90% 70% at 50% 35%,rgba(0,0,0,.6) 0%,rgba(0,0,0,.8) 55%,rgba(0,0,0,.92) 100%)', x: 0, y: 0, w: W, h: H, z: 1, rot: 0, op: 1, radio: 0 },
          { id: nid(), tipo: 'forma', nombre: 'Brillo del fondo', papel: 'fondo-brillo', fondo: 'radial-gradient(40% 30% at 70% 30%,rgba(255,140,90,.25),transparent 70%)', x: 0, y: 0, w: W, h: H, z: 2, rot: 0, op: 1, radio: 0 }
        );
        // la persona recortada, de pie y agrandada: la más vertical (y con cara) sirve más para una foto de estudio
        var con = fotos.filter(function (f) { return f && f.recorte_url && f.recorte_caja; });
        con.sort(function (a, b) { return pts(b) - pts(a); });
        function pts(f) { var k = f.recorte_caja; return k[3] / k[2] + (f.cara ? 1 : 0); }
        var pF = con[0];
        if (pF) {
          usadas.push(pF.id);
          var k = pF.recorte_caja, arriba = Math.round(H * .31);
          var s = pF.cara ? 210 / pF.cara[2] : W * .62 / k[2];
          s = Math.max(s, (H - arriba) / k[3]);              // que llegue hasta abajo
          s = Math.min(s, W * 1.05 / k[2]);                  // y que no se salga mucho de lado
          var w = Math.round(k[2] * s), h = Math.round(k[3] * s);
          els.push({ id: nid(), tipo: 'imagen', nombre: 'Tú (recorte)', papel: 'persona', src: pF.recorte_url, ref: { foto: pF.id, campo: 'recorte' },
            x: Math.round((W - w) / 2), y: arriba, w: w, h: h, z: 6, rot: 0, op: 1, radio: 0, zoom: 1, brillo: 1, contraste: 1.05, sat: 1 });
        }
        var tt = limpio(p.titular), tamT = 122;   // _cabe lo achica al medir si no cabe en UN renglón de 1000 px (antes se partía y pisaba el subtítulo)
        els.push(
          T({ nombre: 'Arranque', papel: 'antes', txt: limpio(p.antes), x: 0, y: 80, w: W, alin: 'center', tam: 64, peso: 600, espac: -.02, color: '#FFFFFF', z: 5 }),
          T({ nombre: 'Titular', papel: 'titular-portada', txt: tt, x: 0, y: 80 + 82, w: W, alin: 'center', _cabe: 1000, tam: tamT, peso: 900, interl: 1, espac: -.045, mayus: true, color: '#FFFFFF', z: 5 })
        );
        // «Ahora *Cherry* edita mis videos →»: la palabra en cursiva va aparte (otra letra), la línea queda centrada
        var sp = partes(p.sub), y3 = 80 + 82 + Math.round(tamT * 1.15) + 14;
        var fs = [sp[0] ? [sp[0], 'antes'] : null, [sp[1], 'cursiva'], sp[2] ? [sp[2], 'despues'] : null].filter(Boolean);
        var fC = LZ.res('@cuerpo'), fM2 = LZ.res('@mano');
        var anchos = fs.map(function (f) { return f[1] === 'cursiva' ? ancho(f[0], fM2, true, 400, 58, 0) : ancho(f[0], fC, false, 600, 44, -.01); });
        var hueco = 12, tot = anchos.reduce(function (a, b) { return a + b; }, 0) + hueco * (fs.length - 1), x3 = (W - tot) / 2;
        fs.forEach(function (f, i) {
          var cur = f[1] === 'cursiva';
          els.push(T({ nombre: cur ? 'Palabra en cursiva' : 'Subtítulo', papel: cur ? 'sub-cursiva' : 'sub-portada', txt: f[0], x: Math.round(x3), y: cur ? y3 - 9 : y3, fuente: cur ? '@mano' : '@cuerpo', cursiva: cur, tam: cur ? 58 : 44, peso: cur ? 400 : 600, espac: cur ? 0 : -.01, color: '#FFFFFF', z: 5 }));
          x3 += anchos[i] + hueco;
        });
        return { fondo: '@principal', els: els };
      }

      // el titular en serifa: «antes» derecho + palabra en cursiva de color + «después», en una o dos filas
      function titulo(els, t, y, base) {
        var p = partes(t), g = limpio(t).length, tam = base, filas;
        if (g * .31 * base <= 900) filas = [[p[0], p[1], p[2]]];
        else {
          filas = p[0] ? [[p[0], '', ''], ['', p[1], p[2]]] : [['', p[1], p[2]]];
          var larga = Math.max.apply(null, filas.map(function (f) { return (f[0] + f[1] + f[2]).length + 1; }));
          tam = Math.min(base, 104, Math.floor(900 / (.33 * larga)));
        }
        var alto = Math.round(tam * .95), esp = Math.round(tam * .16), fT = LZ.res('@titular'), fM = LZ.res('@mano');
        filas.forEach(function (f, i) {
          var yy = y + i * alto, x = 90;
          var pegado = /^[.,;:!?…)»]/.test(f[2] || '');   // «editando…»: el signo va pegado a la cursiva
          if (f[0]) { els.push(T({ nombre: 'Titular', papel: 'titular', txt: f[0], x: x, y: yy, fuente: '@titular', tam: tam, peso: 400, interl: .95, espac: -.015, color: '@texto', z: 5 })); x += ancho(f[0], fT, false, 400, tam, -.015) + esp; }
          if (f[1]) { els.push(T({ nombre: 'Palabra en cursiva', papel: 'titular-cursiva', txt: f[1], x: Math.round(x), y: yy, fuente: '@mano', cursiva: true, tam: tam, peso: 400, interl: .95, espac: -.015, color: '@principal', z: 5 })); x += ancho(f[1], fM, true, 400, tam, -.015) + (pegado ? 2 : esp); }
          if (f[2]) els.push(T({ nombre: 'Titular (final)', papel: 'titular', txt: f[2], x: Math.round(x), y: yy, fuente: '@titular', tam: tam, peso: 400, interl: .95, espac: -.015, color: '@texto', z: 5 }));
        });
        return y + filas.length * alto;
      }
      function tarjeta(nombre, papel, x, y, w, h) { return { id: nid(), tipo: 'forma', nombre: nombre, papel: papel, fondo: NEGRO, radio: 30, sombra: true, x: x, y: y, w: w, h: h, z: 3, rot: 0, op: 1 }; }
      function chulos(lista) { return lista.map(function (t) { return '*✓*  ' + t; }).join('\n'); }

      function interior(it, k) {
        var els = [], forma = String(it.forma || '').toLowerCase().trim();
        var lista = (it.lista || []).map(function (e) { return limpio(e && e.t !== undefined ? e.t : e); }).filter(Boolean);
        var flujo = (it.flujo || []).map(function (e) { return limpio(e && e.t !== undefined ? e.t : e); }).filter(Boolean);
        if (forma === 'flujo' && flujo.length < 2) forma = 'lista';
        var fotoCap = null;
        if (forma === 'captura') { fotoCap = fotos.filter(function (f) { return usadas.indexOf(f.id) < 0; })[0] || fotos[k % Math.max(1, fotos.length)] || null; if (fotoCap) usadas.push(fotoCap.id); else forma = 'lista'; }
        if (['lista', 'captura', 'flujo'].indexOf(forma) < 0) forma = 'lista';
        var pas = it.rotulo && forma === 'flujo' ? (k + 1 < 10 ? '0' : '') + (k + 1) + ' / ' + (n + 2 < 10 ? '0' : '') + (n + 2) + ' — ' + limpio(it.rotulo) : (com.pastilla || 'Paso') + ' ' + k;
        els.push(T({ nombre: 'Pastilla del paso', papel: 'pastilla', txt: pas, x: 90, y: 110, tam: 22, peso: 700, espac: .12, mayus: true, color: '@principal', caja: { fondo: suave(.1), radio: 8, padV: 10, padH: 20 }, z: 5 }));
        var y = titulo(els, it.titulo, 180, forma === 'flujo' ? 104 : 140);
        y += 45;
        var nSub = 0;
        if (it.sub) {
          nSub = lineas(limpio(it.sub), 46);
          els.push(T({ nombre: 'Subtítulo', papel: 'subtitulo', txt: limpio(it.sub), x: 90, y: y, w: 870, tam: 34, peso: 500, interl: 1.3, color: '@texto', op: .85, z: 5 }));
          y += Math.round(nSub * 34 * 1.3);
        }
        if (forma === 'lista' && !lista.length) y += 60;
        else if (forma === 'lista') {
          var yC = y + 92, hC = 80 + 48 * Math.max(1, lista.length);
          els.push(tarjeta('Tarjeta negra', 'tarjeta', 210, yC, 760, hC));
          els.push(T({ nombre: 'Lista', papel: 'lista', txt: chulos(lista), x: 256, y: yC + 40, w: 668, tam: 32, peso: 500, interl: 1.5, color: '#FFFFFF', colorAc: '@principal', modoAc: 'negrita', z: 4 }));
          els.push({ id: nid(), tipo: 'flecha', nombre: 'Flecha', papel: 'flecha', src: U.BASE + 'piezas/crema/flecha.svg', color: '@principal', x: 90, y: Math.round(yC + hC / 2 - 20), w: 80, h: 40, z: 5, rot: 0, op: 1 });
          y = yC + hC + 150;
        } else if (forma === 'captura') {
          var conPuntos = lista.length > 0, yK = y + 66, hK = conPuntos ? 420 : 560;
          if (yK + hK > H - 380 && conPuntos) hK = Math.max(300, H - 380 - yK);
          els.push(tarjeta('Marco de la captura', 'tarjeta', 110, yK, 860, hK));
          els.push({ id: nid(), tipo: 'imagen', nombre: 'Tu captura', papel: 'captura', src: fotoCap.url, ref: { foto: fotoCap.id, campo: 'foto' }, x: 128, y: yK + 18, w: 824, h: hK - 36, z: 4, rot: 0, op: 1, radio: 16, zoom: 1, brillo: 1, contraste: 1, sat: 1, bn: false });
          y = yK + hK + 40;
          if (conPuntos) {
            var filas = [];
            for (var i = 0; i < lista.length; i += 2) filas.push(lista.slice(i, i + 2));
            filas.forEach(function (f) {
              var alto = Math.max.apply(null, f.map(function (t) { return lineas(t, 24); })) * 40;
              f.forEach(function (t, j) { els.push(T({ nombre: 'Punto «' + t + '»', papel: 'punto', txt: '*✓* ' + t, x: 110 + j * 445, y: y, w: 415, tam: 32, peso: 600, interl: 1.25, color: '@texto', colorAc: '@principal', modoAc: 'negrita', z: 5 })); });
              y += alto + 10;
            });
            y += 40;
          } else y += 10;
        } else { // flujo
          var yL = y + 36, hL = 80 + 48 * Math.max(1, lista.length);
          if (lista.length) {
            els.push(tarjeta('Tarjeta negra', 'tarjeta', 110, yL, 860, hL));
            els.push(T({ nombre: 'Lista', papel: 'lista', txt: chulos(lista), x: 156, y: yL + 40, w: 768, tam: 32, peso: 500, interl: 1.5, color: '#FFFFFF', colorAc: '@principal', modoAc: 'negrita', z: 4 }));
            y = yL + hL;
          }
          var yF = Math.min(y + 168, H - 330), m = flujo.length, cw = m > 3 ? 180 : 220, fl = 40, sep = 26;
          var tot = m * cw + (m - 1) * (fl + sep * 2), x = Math.round((W - tot) / 2);
          flujo.forEach(function (t, i) {
            var medio = m === 3 ? i === 1 : false;
            els.push(tarjeta('Paso del sistema «' + t + '»', 'flujo-tarjeta', x, yF, cw, 160));
            els.push(T({ nombre: medio ? 'Paso del sistema (cursiva)' : 'Paso del sistema', papel: medio ? 'flujo-cursiva' : 'flujo-texto', txt: t, x: x, y: yF + (medio ? 49 : 62), w: cw, alin: 'center', fuente: medio ? '@mano' : '@cuerpo', cursiva: medio, tam: medio ? 52 : 30, peso: medio ? 400 : 700, interl: 1.15, color: '#FFFFFF', z: 4 }));
            x += cw;
            if (i < m - 1) { els.push({ id: nid(), tipo: 'flecha', nombre: 'Flechita', papel: 'flechita', src: U.BASE + 'piezas/crema/flecha.svg', color: '@principal', x: x + sep, y: yF + 70, w: fl, h: 20, z: 5, rot: 0, op: 1 }); x += fl + sep * 2; }
          });
          y = yF + 160 + 50;
        }
        if (it.frase && forma !== 'flujo') els.push(T({ nombre: 'Frase en negrita', papel: 'frase', txt: limpio(it.frase), x: 90, y: Math.min(y, H - 200), w: 870, tam: 34, peso: 700, interl: 1.3, color: '@texto', z: 5 }));
        pie(els);
        return { fondo: '@fondo', els: els };
      }

      function cierre() {
        var cc = c.cierre || {}, els = [], pila = { grupo: 'c', x: 0, w: W, y: 0, h: H, gap: 22 };
        var pal = limpio(cc.palabra), tamP = Math.min(230, Math.floor(980 / (.42 * Math.max(1, pal.length))));
        if (cc.antes) els.push(T({ nombre: 'Acción', papel: 'antes-cierre', txt: limpio(cc.antes), w: W, alin: 'center', tam: 50, peso: 600, color: '@texto', z: 5, _pila: pila }));
        els.push(T({ nombre: 'Palabra para comentar', papel: 'palabra', txt: pal, w: W, alin: 'center', fuente: '@mano', cursiva: true, tam: tamP, peso: 400, interl: .95, espac: -.015, color: '@principal', z: 5, _pila: pila }));
        if (cc.texto) els.push(T({ nombre: 'Lo que recibe', papel: 'texto-cierre', txt: limpio(cc.texto), w: W, alin: 'center', tam: 44, peso: 700, interl: 1.3, color: '@texto', z: 5, _pila: pila }));
        pie(els);
        return { fondo: '@fondo', els: els };
      }
    }
  });
})();

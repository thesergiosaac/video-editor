/* historias.js — las plantillas de la herramienta HISTORIAS (8-oct-2026), 1080×1920.
 * Copia de la tanda 1 que Sergio aprobó (todas «lo usaría yo»), hecha en Remotion con su tablero de Pinterest
 * «Secuencia historias» y la H45. Cada una es una secuencia: portada → partes del medio → cierre.
 *   h_conocemos · «¿Nos conocemos?»   rojo + papel rasgado + tu recorte
 *   h_foto      · «Foto con titular»  tu foto a sangre oscurecida + titular editorial + pastilla
 *   h_gigante   · «Letra gigante»     crema/negro, titular enorme con UNA palabra en itálica, recorte en B/N
 *   h_palabra   · «Palabra gigante»   palabra partida en sílabas, enorme, y caja de preguntas
 * Zona segura de Instagram: nada importante en los 250 px de arriba ni en los 340 de abajo.
 * Letras y colores por papel: @titular (gruesa), @mano (la itálica del remate), @principal (el acento). */
(function () {
  'use strict';
  var U = FAMILIAS.util, T = U.T, nid = U.nid;
  var W = 1080, H = 1920, ARR = 250, ABA = H - 340;
  var BLANCO = '#FFFFFF';

  function limpio(s) { return String(s || '').replace(/\*/g, ''); }
  // la letra más grande con la que el texto cabe en `lineas` renglones de `w` px (ancho medio de letra: k·tam)
  function tamTit(txt, w, lineas, max, min, k) {
    var ps = limpio(txt).split(/\s+/).filter(Boolean), t = max;
    for (; t > (min || 40); t -= 4) {
      var cabe = w / ((k || .5) * t), n = 1, act = 0, larga = false;
      ps.forEach(function (p) { if (p.length > cabe) larga = true; var l = p.length + (act ? 1 : 0); if (act && act + l > cabe) { n++; act = p.length; } else act += l; });
      if (n <= lineas && !larga) break;
    }
    return t;
  }
  function renglones(txt, w, tam, k) {
    var ps = limpio(txt).split(/\s+/).filter(Boolean), cabe = w / ((k || .5) * tam), n = ps.length ? 1 : 0, act = 0;
    ps.forEach(function (p) { var l = p.length + (act ? 1 : 0); if (act && act + l > cabe) { n++; act = p.length; } else act += l; });
    return n;
  }
  // la gruesa del manual: minúscula, apretada
  function gruesa(o) { return T(Object.assign({ fuente: '@titular', peso: 800, espac: -.045, interl: .9, color: '@texto', colorAc: '@principal', modoAc: 'serifa' }, o)); }
  // el remate: la itálica con trazo
  function remate(o) { return T(Object.assign({ fuente: '@mano', peso: 400, cursiva: true, trazo: .035, interl: .9, color: '@principal' }, o)); }

  // ── siluetas ──
  function rasgado(n, alto) {   // borde rasgado arriba y abajo
    n = n || 26; alto = alto || 18; var p = [], i;
    for (i = 0; i <= n; i++) p.push((i / n * 100).toFixed(2) + '% ' + (i % 2 ? alto : 0) + 'px');
    for (i = n; i >= 0; i--) p.push((i / n * 100).toFixed(2) + '% calc(100% - ' + (i % 2 ? 0 : alto) + 'px)');
    return 'polygon(' + p.join(',') + ')';
  }
  function estallido() {
    var p = [], n = 18;
    for (var i = 0; i < n * 2; i++) { var r = i % 2 ? .62 : 1, a = i / (n * 2) * Math.PI * 2; p.push((50 + Math.cos(a) * 50 * r).toFixed(2) + '% ' + (50 + Math.sin(a) * 50 * r).toFixed(2) + '%'); }
    return 'polygon(' + p.join(',') + ')';
  }
  function forma(o) { return Object.assign({ id: nid(), tipo: 'forma', z: 2, rot: 0, op: 1, radio: 0 }, o); }
  function grano(op, mezcla) { return { id: nid(), tipo: 'grano', nombre: 'Textura de papel', papel: 'grano', z: 90, op: op, mezcla: mezcla || 'multiply', x: 0, y: 0, w: W, h: H, rot: 0 }; }

  // ── fotos ──
  // las fotos con recorte, para irlas rotando por parte (sin repetir mientras alcancen)
  function rueda(mat) {
    var fs = ((mat && mat.fotos) || []).filter(function (f) { return f && f.w; });
    var conRec = fs.filter(function (f) { return f.recorte_url && f.recorte_caja; });
    var iR = 0, iF = 0;
    return {
      recorte: function () { return conRec.length ? conRec[iR++ % conRec.length] : null; },
      foto: function () { return fs.length ? fs[iF++ % fs.length] : null; },
    };
  }
  /* la persona recortada, sola, dentro de una caja: cabe entera (contain), pegada abajo y al lado que se pida.
     busto: si la foto es de cuerpo entero (angosta), va grande, de la cintura para arriba, y el resto se sale por abajo
     (como en las aprobadas: la persona llena la caja, no queda un muñequito) */
  function persona(f, caja, o) {
    if (!f) return null; o = o || {};
    var k = f.recorte_caja, ar = k[2] / k[3], w = caja.w, h = Math.round(w / ar), y;
    if (o.busto && ar < .62) { w = Math.round(caja.w * .82); h = Math.round(w / ar); y = caja.y; }
    else { if (h > caja.h) { h = caja.h; w = Math.round(h * ar); } y = caja.y + caja.h - h; }
    var x = o.lado === 'der' ? caja.x + caja.w - w : o.lado === 'izq' ? caja.x : Math.round(caja.x + (caja.w - w) / 2);
    return { id: nid(), tipo: 'imagen', nombre: 'Tú (recorte)', papel: 'persona', src: f.recorte_url, ref: { foto: f.id, campo: 'recorte' },
      x: x, y: y, w: w, h: h, z: o.z || 4, rot: 0, op: 1, radio: 0, zoom: 1, brillo: 1, contraste: o.bn ? 1.1 : 1, sat: 1, bn: !!o.bn, sombraFig: true };
  }

  function partes(c) { return [c.portada || {}].concat(c.items || []).concat([c.cierre || {}]); }
  function catalogo(extra) {
    return Object.assign({
      letras: { titular: 'Urbanist', mano: 'Libre Caslon Text', cuerpo: 'Urbanist' },
      colores: { principal: '#9B111E', acento: '#9B111E', fondo: '#EFE8DD', texto: '#16120F' }
    }, extra || {});
  }
  var SECUENCIA = 'Es una secuencia de HISTORIAS de Instagram (9:16, se ven una tras otra), NO un carrusel: frases cortas que se leen en 3 segundos, en minúscula, tono cercano. ';

  /* ══════════ S1 · «¿Nos conocemos?» ══════════ */
  FAMILIAS.registrar('h_conocemos', {
    catalogo: catalogo(),
    esquema: {
      nombre: '¿Nos conocemos?', nItems: 2, iconos: U.ICONOS_OK,
      guia: SECUENCIA + 'Para presentarte a la gente nueva: portada que saluda, cada parte del medio cuenta UN dato tuyo o de tu historia (en primera persona) con una nota corta, y el cierre dice a quién le sirve quedarse (lista con chulos) y le pide que responda.',
      portada: {
        titular: { max: 20, desc: 'la pregunta que saluda, en minúscula (p. ej. «¿nos conocemos?»)' },
        remate: { max: 22, desc: 'complemento corto en itálica (p. ej. «un poco mejor»)' },
        saludo: { max: 10, desc: 'saludo a mano (p. ej. «¡hola!»)' }
      },
      item: {
        frase: { max: 40, desc: 'un dato tuyo en primera persona, en minúscula (p. ej. «empecé editando los videos de»)' },
        remate: { max: 24, desc: 'el final de la frase, en itálica (p. ej. «mi restaurante»)' },
        nota: { max: 64, desc: 'nota corta que lo aterriza, con UNA o dos palabras *resaltadas* (p. ej. «Hoy ayudo a creadores a crecer *sin pautar*.»)' }
      },
      cierre: {
        rotulo: { max: 18, desc: 'rótulo de la lista (p. ej. «te quedas si…»)' },
        lista: { lista: 4, desc: '4 razones para quedarse, a quién le sirve tu cuenta', campos: { t: { max: 42, desc: 'una razón, empezando en mayúscula (p. ej. «Quieres crecer en redes sin pagar pauta»)' } } },
        remate: { max: 14, desc: 'bienvenida en itálica (p. ej. «bienvenido»)' },
        pregunta: { max: 44, desc: 'lo que le pides que responda (p. ej. «respóndeme: ¿de qué es tu cuenta?»)' }
      },
      comun: {}
    },
    armar: function (c, mat) {
      var R = rueda(mat), ps = partes(c), n = ps.length;
      return ps.map(function (p, i) { return i === 0 ? portada(p) : i === n - 1 ? cierre(p) : medio(p); });

      function portada(p) {
        var pila = { grupo: 't', x: 60, w: 960, y: 260, h: 560, ancla: 'arriba', gap: 6 };
        var els = [
          gruesa({ nombre: 'Titular', papel: 'titular', txt: p.titular || '', w: 960, tam: tamTit(p.titular, 960, 2, 190, 90, .52), alin: 'center', color: BLANCO, z: 6, _pila: pila }),
          remate({ nombre: 'Remate', papel: 'remate', txt: p.remate || '', w: 960, tam: 92, alin: 'center', color: BLANCO, z: 6, _pila: pila }),
          forma({ nombre: 'Papel rasgado', papel: 'papel', fondo: '@fondo', clip: rasgado(), x: 90, y: 860, w: 900, h: 1100, rot: -2 })
        ];
        var per = persona(R.recorte(), { x: 140, y: 900, w: 800, h: 1020 }, { busto: true }); if (per) els.push(per);
        if (p.saludo) els.push(remate({ nombre: 'Saludo', papel: 'saludo', txt: p.saludo, tam: 58, rot: -6, y: 870, z: 6, _der: W - 120 }));
        els.push(grano(.14));
        return { fondo: '@principal', els: els };
      }
      function medio(p) {
        var pila = { grupo: 'f', x: 80, w: 920, y: 420, h: 480, ancla: 'arriba', gap: 8 };
        var els = [
          remate({ nombre: 'Comillas', papel: 'comillas', txt: '“', x: 80, y: 250, tam: 260, interl: .8, z: 5 }),
          gruesa({ nombre: 'Frase', papel: 'frase', txt: p.frase || '', w: 920, tam: tamTit(p.frase, 920, 3, 96, 60, .5), z: 6, _pila: pila }),
          remate({ nombre: 'Remate', papel: 'remate', txt: p.remate || '', w: 920, tam: 84, z: 6, _pila: pila }),
          forma({ nombre: 'Estallido', papel: 'estallido', fondo: '@principal', clip: estallido(), x: 160, y: 900, w: 760, h: 760 })
        ];
        var per = persona(R.recorte(), { x: 150, y: 960, w: 780, h: 960 }, { bn: true, busto: true }); if (per) els.push(per);
        if (p.nota) els.push(T({ nombre: 'Nota', papel: 'nota', txt: p.nota, w: 560, y: 1410, tam: 34, peso: 700, interl: 1.2, color: '@texto', colorAc: '@principal', modoAc: 'negrita', rot: 2, z: 7,
          caja: { fondo: BLANCO, radio: 4, padV: 18, padH: 26, sombra: true }, _der: 1000 }));
        els.push(grano(.12));
        return { fondo: '@fondo', els: els };
      }
      function cierre(p) {
        var lista = (p.lista || []).filter(function (x) { return x && x.t; }).slice(0, 5);
        var els = [T({ nombre: 'Rótulo', papel: 'rotulo', txt: p.rotulo || '', x: 80, y: 270, tam: 30, peso: 800, espac: .14, mayus: true, color: BLANCO, op: .85, z: 6 })];
        var y = 360 + 50, filas = [];
        lista.forEach(function (x) {
          var alto = renglones(x.t, 752, 46, .45) * 46 * 1.12;
          filas.push({ t: x.t, y: Math.round(y) }); y += Math.max(54, alto) + 34;
        });
        var fin = Math.round(y - 34 + 50);
        els.push(forma({ nombre: 'Papel rasgado', papel: 'papel', fondo: '@fondo', clip: rasgado(22, 16), x: 80, y: 360, w: 920, h: Math.max(300, fin - 360) }));
        filas.forEach(function (f, k) {
          els.push(T({ nombre: 'Chulo ' + (k + 1), papel: 'chulo', txt: '✓', x: 126, y: f.y, w: 54, tam: 30, peso: 800, interl: 1, alin: 'center', color: BLANCO, z: 6, caja: { fondo: '@principal', radio: 10, padV: 12, padH: 0 } }));
          els.push(T({ nombre: 'Razón ' + (k + 1), papel: 'razon', txt: f.t, x: 202, y: f.y, w: 752, tam: 46, peso: 700, interl: 1.12, color: '@texto', z: 6 }));
        });
        var y2 = Math.max(fin + 70, 1100);
        els.push(remate({ nombre: 'Bienvenida', papel: 'remate', txt: p.remate || '', x: 80, y: y2, w: 920, tam: 110, alin: 'center', color: BLANCO, z: 6 }));
        if (p.pregunta) els.push(T({ nombre: 'Pregunta', papel: 'pregunta', txt: p.pregunta, x: 80, y: y2 + 120, w: 920, tam: 36, peso: 700, alin: 'center', color: BLANCO, z: 6 }));
        els.push(grano(.14));
        return { fondo: '@principal', els: els };
      }
    }
  });

  /* ══════════ S2 · «Foto con titular» ══════════ */
  FAMILIAS.registrar('h_foto', {
    catalogo: catalogo(),
    esquema: {
      nombre: 'Foto con titular', nItems: 2, iconos: U.ICONOS_OK,
      guia: SECUENCIA + 'Para enseñar algo en pasos: portada con la promesa, cada parte del medio es UN paso (titular corto + remate + un ejemplo que se dice tal cual) y el cierre deja la idea que nadie dice y pide que le escriban una palabra.',
      portada: {
        pastilla: { max: 22, desc: 'el tema en la pastilla roja, en mayúsculas (p. ej. «IA PARA CREADORES»)' },
        titular: { max: 32, desc: 'la promesa, en minúscula (p. ej. «cómo uso la IA para crear»)' },
        remate: { max: 28, desc: 'el final en itálica (p. ej. «una semana de contenido»)' }
      },
      item: {
        titular: { max: 26, desc: 'el paso, en minúscula (p. ej. «le pido 30 ideas»)' },
        remate: { max: 26, desc: 'el detalle en itálica (p. ej. «con mi nicho exacto»)' },
        ejemplo: { max: 100, desc: 'el ejemplo que se dice o se escribe TAL CUAL, con lo clave *resaltado* (p. ej. «Dame 30 ideas de reels para *marketing para restaurantes*, con su gancho.»)' }
      },
      cierre: {
        pastilla: { max: 22, desc: 'pastilla del cierre, en mayúsculas (p. ej. «LO QUE NADIE DICE»)' },
        titular: { max: 30, desc: 'la idea final, en minúscula (p. ej. «la IA no sabe quién eres»)' },
        remate: { max: 14, desc: 'el golpe en itálica (p. ej. «tú sí»)' },
        llamada: { max: 64, desc: 'lo que pides que te escriban (p. ej. «Escríbeme «cómo» y te paso mi forma de pedírselo.»)' }
      },
      comun: {
        paso: { max: 10, desc: 'la palabra de la pastilla de los pasos, en singular (p. ej. «paso», «truco», «error»)' }
      }
    },
    armar: function (c, mat) {
      var R = rueda(mat), ps = partes(c), n = ps.length, com = c.comun || {};
      return ps.map(function (p, i) { return lamina(p, i === 0 ? 'portada' : i === n - 1 ? 'cierre' : 'medio', i); });

      function lamina(p, tipo, i) {
        var els = [], f = R.foto();
        if (f) {
          var g = U.encuadre(f, W, H, { alturaCara: .3 });
          var foto = U.fotoEl(f, g); els.push(foto);
          els.push(forma({ nombre: 'Sombra sobre la foto', papel: 'sombra', interno: true, de: foto.id, fondo: 'linear-gradient(180deg,rgba(22,18,15,.55),rgba(22,18,15,.2) 40%,rgba(22,18,15,.85) 88%)', x: 0, y: 0, w: W, h: H }));
        }
        var past = tipo === 'medio' ? ((com.paso || 'paso') + ' ' + i + ' de ' + (n - 2)) : (p.pastilla || '');
        if (past) els.push(T({ nombre: 'Pastilla', papel: 'pastilla', txt: past, x: 80, y: 270, tam: 28, peso: 800, espac: .12, mayus: true, color: BLANCO, z: 6, caja: { fondo: '@principal', radio: 999, padV: 10, padH: 20 } }));
        var pila = { grupo: 'b', x: 80, w: 920, y: 760, h: ABA - 760, ancla: 'abajo', gap: 14 };
        var tTit = tamTit(p.titular, 920, tipo === 'medio' ? 2 : 3, tipo === 'medio' ? 108 : 118, 64, .5);
        els.push(gruesa({ nombre: 'Titular', papel: 'titular', txt: p.titular || '', w: 920, tam: tTit, color: BLANCO, colorAc: BLANCO, z: 6, _pila: pila }));
        if (p.remate) els.push(remate({ nombre: 'Remate', papel: 'remate', txt: p.remate, w: 920, tam: tipo === 'cierre' ? 90 : 70, color: BLANCO, z: 6, _pila: pila }));
        if (tipo === 'medio' && p.ejemplo) els.push(T({ nombre: 'Ejemplo', papel: 'ejemplo', txt: '«' + String(p.ejemplo).replace(/^«|»$/g, '') + '»', w: 920, tam: 32, peso: 500, interl: 1.35, color: BLANCO, colorAc: BLANCO, modoAc: 'negrita', z: 6, _pila: pila,
          caja: { fondo: 'rgba(255,255,255,.12)', borde: 'rgba(255,255,255,.25)', bw: 1, radio: 18, padV: 22, padH: 26 } }));
        if (tipo === 'cierre' && p.llamada) els.push(T({ nombre: 'Llamada', papel: 'llamada', txt: p.llamada, w: 920, tam: 34, peso: 700, interl: 1.25, color: BLANCO, op: .9, z: 6, _pila: pila }));
        return { fondo: '@texto', els: els };
      }
    }
  });

  /* ══════════ S3 · «Letra gigante» ══════════ */
  FAMILIAS.registrar('h_gigante', {
    catalogo: catalogo(),
    esquema: {
      nombre: 'Letra gigante', nItems: 2, iconos: U.ICONOS_OK,
      guia: SECUENCIA + 'Para una idea fuerte o motivación: cada parte es UNA frase enorme de 3 a 5 palabras con UNA palabra *resaltada* (sale en itálica de otro color), más un texto corto. El cierre dice el siguiente paso concreto.',
      portada: {
        titular: { max: 26, desc: 'frase enorme de 3 a 5 palabras, en minúscula, con la ÚLTIMA palabra *resaltada* (p. ej. «es hora de crear tu *marca*»)' },
        texto: { max: 90, desc: 'una frase que la explica, con UNA o dos palabras *resaltadas* (p. ej. «Una marca no es un logo: es lo que la gente reconoce *en un segundo*.»)' }
      },
      item: {
        titular: { max: 26, desc: 'frase enorme de 3 a 5 palabras, en minúscula, con lo último *resaltado* (p. ej. «tu idea vale más *que tu cámara*»)' },
        circulo: { max: 28, desc: 'frase cortísima para el círculo rojo (p. ej. «el celular que tienes sirve»)' }
      },
      cierre: {
        titular: { max: 20, desc: 'frase enorme de 2 o 3 palabras con la última *resaltada* (p. ej. «tu siguiente *paso*»)' },
        llamada: { max: 56, desc: 'el paso concreto que pides (p. ej. «Graba hoy tu primer video con lo que tienes.»)' }
      },
      comun: {
        rotulo: { max: 14, desc: 'rótulo de arriba de todas las partes, una palabra (p. ej. «laboratorio»)' }
      }
    },
    armar: function (c, mat) {
      var R = rueda(mat), ps = partes(c), n = ps.length, com = c.comun || {};
      return ps.map(function (p, i) { return lamina(p, i === 0 ? 'portada' : i === n - 1 ? 'cierre' : 'medio', i); });

      function lamina(p, tipo, i) {
        var oscuro = tipo === 'medio' && i % 2 === 1, tinta = oscuro ? BLANCO : '@texto';
        var els = [
          T({ nombre: 'Rótulo', papel: 'rotulo', txt: com.rotulo || '', x: 70, y: 260, tam: 22, peso: 800, espac: .14, mayus: true, color: tinta, op: oscuro ? .7 : 1, z: 6 }),
          T({ nombre: 'Número', papel: 'numero', txt: '№ ' + String(i + 1).padStart(2, '0'), y: 260, tam: 22, peso: 800, espac: .14, color: tinta, op: oscuro ? .7 : 1, z: 6, _der: W - 70 })
        ];
        var max = tipo === 'cierre' ? 230 : tipo === 'medio' ? 210 : 200;
        var tTit = tamTit(p.titular, 952, 3, max, 90, .52);
        els.push(gruesa({ nombre: 'Titular', papel: 'titular', txt: p.titular || '', x: 64, y: tipo === 'portada' ? 320 : 340, w: 952, tam: tTit, color: tinta, z: 6 }));
        var bajo = (tipo === 'portada' ? 320 : 340) + renglones(p.titular, 952, tTit, .52) * tTit * .9;
        if (tipo === 'portada') {
          var per = persona(R.recorte(), { x: 440, y: 1100, w: 640, h: 820 }, { bn: true, lado: 'der', busto: true }); if (per) els.push(per);
          if (p.texto) els.push(T({ nombre: 'Texto', papel: 'texto', txt: p.texto, x: 70, y: Math.max(1180, bajo + 80), w: 380, tam: 32, peso: 500, interl: 1.3, color: '@texto', colorAc: '@principal', modoAc: 'negrita', z: 6 }));
        } else if (tipo === 'medio') {
          var per2 = persona(R.recorte(), { x: 540, y: 1060, w: 520, h: 860 }, { bn: true, lado: 'der', busto: true }); if (per2) els.push(per2);
          if (p.circulo) {
            var yC = Math.max(1060, bajo + 80), tC = renglones(p.circulo, 280, 40, .52) > 3 ? 34 : 40, alto = renglones(p.circulo, 280, tC, .52) * tC * 1.1;
            els.push(forma({ nombre: 'Círculo', papel: 'circulo', fondo: '@principal', radio: 999, x: 64, y: yC, w: 360, h: 360, z: 5 }));
            els.push(T({ nombre: 'Texto del círculo', papel: 'texto-circulo', txt: p.circulo, x: 104, y: Math.round(yC + 180 - alto / 2), w: 280, tam: tC, peso: 800, interl: 1.1, alin: 'center', color: BLANCO, z: 6 }));
          }
        } else {
          var yL = Math.max(1180, bajo + 90);
          els.push(forma({ nombre: 'Línea', papel: 'linea', fondo: '@texto', x: 64, y: yL, w: 952, h: 4, z: 5 }));
          if (p.llamada) els.push(T({ nombre: 'Llamada', papel: 'llamada', txt: p.llamada, x: 64, y: yL + 40, w: 640, tam: 40, peso: 700, interl: 1.2, color: '@texto', z: 6 }));
          els.push(forma({ nombre: 'Círculo', papel: 'circulo', fondo: '@principal', radio: 999, x: 876, y: yL + 40, w: 140, h: 140, z: 5 }));
          els.push(T({ nombre: 'Flecha', papel: 'flecha', txt: '→', x: 876, y: yL + 68, w: 140, tam: 70, peso: 800, interl: 1, alin: 'center', color: BLANCO, z: 6 }));
        }
        if (!oscuro) els.push(grano(.12));
        return { fondo: oscuro ? '@texto' : '@fondo', els: els };
      }
    }
  });

  /* ══════════ S4 · «Palabra gigante» ══════════ */
  // «pre— / gún— / tame» → renglones; si viene entera, se parte de a 5 letras
  function partir(s) {
    s = limpio(s).trim(); if (!s) return [];
    if (s.indexOf('/') >= 0) return s.split('/').map(function (x) { return x.trim(); }).filter(Boolean);
    var w = s.replace(/[—\-\s]+/g, ''), out = [];
    if (w.length <= 6) return [w];
    var k = Math.ceil(w.length / Math.ceil(w.length / 5));
    for (var i = 0; i < w.length; i += k) out.push(w.slice(i, i + k));
    return out.map(function (x, j) { return j < out.length - 1 ? x + '—' : x; });
  }
  FAMILIAS.registrar('h_palabra', {
    catalogo: catalogo({ colores: { principal: '#9B111E', acento: '#9B111E', fondo: '#FFFFFF', texto: '#16120F' } }),
    esquema: {
      nombre: 'Palabra gigante', nItems: 2, iconos: U.ICONOS_OK,
      guia: SECUENCIA + 'Para preguntas y respuestas: portada con UNA palabra enorme partida en sílabas, cada parte del medio es una pregunta que te hicieron (en la caja de preguntas de Instagram) con tu respuesta corta, y el cierre es otra palabra enorme que remata con un texto corto.',
      portada: {
        palabra: { max: 18, desc: 'UNA palabra (o dos cortas) partida en 2 o 3 renglones por sílabas, separados con « / » y con «—» al final de los que siguen, máx. 5 letras por renglón (p. ej. «pre— / gún— / tame»)' },
        lateral: { max: 18, desc: 'frase cortísima que va de lado, en mayúsculas (p. ej. «LO QUE QUIERAS»)' }
      },
      item: {
        pregunta: { max: 64, desc: 'una pregunta que te hacen de verdad sobre tu tema, como la escribiría un seguidor (p. ej. «¿Cuánto te demoras editando un reel?»)' },
        respuesta: { max: 80, desc: 'tu respuesta corta, con lo clave *resaltado* (p. ej. «Antes tres horas. Ahora *diez minutos*.»)' }
      },
      cierre: {
        palabra: { max: 18, desc: 'la palabra que remata, partida igual que la portada (p. ej. «tu— / tur— / no»)' },
        texto: { max: 90, desc: 'el remate en una frase, con UNA palabra *resaltada* (p. ej. «Mándame tu pregunta en la cajita y te respondo *mañana*.»)' }
      },
      comun: {
        caja: { max: 22, desc: 'el título de la caja de preguntas (p. ej. «Hazme una pregunta»)' },
        encabezado: { max: 18, desc: 'lo que va encima de la caja, en minúscula (p. ej. «me preguntaron»)' },
        rotulo: { max: 12, desc: 'rótulo de abajo, una palabra en mayúsculas (p. ej. «PREGUNTAS»)' }
      }
    },
    armar: function (c, mat) {
      var R = rueda(mat), ps = partes(c), n = ps.length, com = c.comun || {};
      return ps.map(function (p, i) { return i === 0 ? extremo(p, true, i) : i === n - 1 ? extremo(p, false, i) : medio(p, i); });

      function pie(i) {
        return [
          T({ nombre: 'Rótulo', papel: 'rotulo', txt: com.rotulo || '', x: 70, y: ABA - 70, tam: 30, peso: 800, espac: .12, mayus: true, color: '@texto', z: 8 }),
          T({ nombre: 'Contador', papel: 'contador', txt: (i + 1) + '/' + n, y: ABA - 70, tam: 30, peso: 800, espac: .12, color: '@texto', z: 8, _der: W - 70 })
        ];
      }
      function extremo(p, esPortada, i) {
        var rs = partir(p.palabra), largo = Math.max.apply(null, rs.map(function (r) { return r.length; }).concat([1]));
        var tam = Math.min(330, Math.floor(980 / (.6 * largo)));
        var els = [gruesa({ nombre: 'Palabra', papel: 'palabra', txt: rs.join('\n'), x: 50, y: 250, tam: tam, color: '@principal', z: 6 })];
        var bajo = 250 + rs.length * tam * .9;
        if (esPortada) {
          if (p.lateral) {
            var L = limpio(p.lateral).length * 52 * .8;
            els.push(T({ nombre: 'De lado', papel: 'lateral', txt: p.lateral, x: Math.round(1014 - L / 2), y: Math.round(300 + L / 2 - 26), tam: 52, peso: 800, espac: .18, mayus: true, interl: 1, color: '@texto', rot: 90, z: 6 }));
          }
          var per = persona(R.recorte(), { x: 330, y: Math.max(900, bajo + 20), w: 700, h: H - Math.max(900, bajo + 20) }, { bn: true }); if (per) els.push(per);
        } else {
          var per2 = persona(R.recorte(), { x: 420, y: 1060, w: 660, h: 860 }, { bn: true, lado: 'der' }); if (per2) els.push(per2);
          if (p.texto) els.push(T({ nombre: 'Texto', papel: 'texto', txt: p.texto, x: 70, y: Math.max(1250, bajo + 60), w: 360, tam: 34, peso: 600, interl: 1.3, color: '@texto', colorAc: '@principal', modoAc: 'serifa', z: 7 }));
        }
        return { fondo: BLANCO, els: els.concat(pie(i)) };
      }
      function medio(p, i) {
        var els = [];
        if (com.encabezado) els.push(remate({ nombre: 'Encabezado', papel: 'encabezado', txt: com.encabezado, x: 70, y: 280, w: 940, tam: 90, alin: 'center', z: 6 }));
        var tP = 44, lP = renglones(p.pregunta, 732, tP, .5), cab = 110, cuerpo = 88 + lP * tP * 1.2, y0 = 450;
        els.push(forma({ nombre: 'Caja de preguntas', papel: 'caja', fondo: '#F4F1EE', radio: 36, sombra: 2, x: 140, y: y0, w: 800, h: Math.round(cab + cuerpo), z: 3 }));
        els.push(forma({ nombre: 'Cabeza de la caja', papel: 'caja-cabeza', interno: true, fondo: '@texto', radio: 36, x: 140, y: y0, w: 800, h: cab, z: 4 }));
        els.push(forma({ nombre: 'Cabeza de la caja (borde)', papel: 'caja-cabeza', interno: true, fondo: '@texto', x: 140, y: y0 + cab - 40, w: 800, h: 40, z: 4 }));
        els.push(T({ nombre: 'Título de la caja', papel: 'caja-titulo', txt: com.caja || 'Hazme una pregunta', x: 140, y: y0 + 34, w: 800, tam: 36, peso: 800, interl: 1.15, alin: 'center', color: BLANCO, z: 5 }));
        els.push(T({ nombre: 'Pregunta', papel: 'pregunta', txt: p.pregunta || '', x: 174, y: Math.round(y0 + cab + 44), w: 732, tam: tP, peso: 700, interl: 1.2, alin: 'center', color: '@texto', z: 5 }));
        var yR = Math.round(y0 + cab + cuerpo + 70);
        if (p.respuesta) els.push(T({ nombre: 'Respuesta', papel: 'respuesta', txt: p.respuesta, x: 110, y: yR, w: 860, tam: 46, peso: 700, interl: 1.2, alin: 'center', color: '@texto', colorAc: '@principal', modoAc: 'serifa', z: 6 }));
        var yP = yR + (p.respuesta ? renglones(p.respuesta, 860, 46, .5) * 46 * 1.2 : 0) + 50;
        var per = persona(R.recorte(), { x: 330, y: Math.max(1100, yP), w: 420, h: H - Math.max(1100, yP) }, { bn: true }); if (per) els.push(per);
        return { fondo: BLANCO, els: els.concat(pie(i)) };
      }
    }
  });
})();

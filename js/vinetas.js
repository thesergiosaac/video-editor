/* vinetas.js — corta la tira en sus viñetas (23-sep-2026)
 *
 * El servidor devuelve UNA imagen con hasta tres viñetas seguidas, porque Cloudflare cobra por
 * píxeles y tres juntas cuestan la tercera parte que tres sueltas. Aquí se parte, y partirla no
 * cuesta nada: lo hace el navegador con un canvas.
 *
 * ⚠️ Cortar por tercios NO basta, y no es teoría: la primera versión lo hacía y dejaba un filo
 * blanco en el lado izquierdo de la segunda y la tercera viñeta. El tamaño lo pedimos nosotros,
 * así que los tercios caen donde tienen que caer, pero la franja que separa los paneles la pinta
 * el modelo del ancho que le da la gana y hacia el lado que le da la gana. Un margen fijo se
 * queda corto o se come media cara.
 *
 * Así que la franja se BUSCA: alrededor de cada tercio se miran las columnas que son claras de
 * arriba abajo, y se corta por fuera de ellas. Si el modelo no pintó ninguna franja, se vuelve
 * al tercio exacto con un margen pequeño.
 *
 * ⚠️ Tampoco usa `img.onload` a secas: una imagen que viene de una `data:` URL también tarda en
 * decodificarse, y dibujar antes de tiempo da un canvas en blanco sin ningún error.
 */
(function () {
  'use strict';

  /* Cuántas viñetas trae la tira, sin fiarse de lo que diga el servidor si no cuadra. */
  function cuantas(r) {
    var n = Number(r && r.paneles) || 1;
    return Math.max(1, Math.min(3, Math.round(n)));
  }

  function cargar(src) {
    return new Promise(function (bien, mal) {
      var img = new Image();
      img.onload = function () {
        if (!img.decode) return bien(img);
        /* ⚠️ decode() puede no resolver NUNCA con la pestaña en segundo plano. Pasó aquí: el
           corte se quedaba colgado para siempre, sin error y sin nada que mirar. Y es justo
           cuando va a pasar de verdad — uno manda a dibujar el storyboard y se va a otra
           pestaña. Así que se le da un respiro y se sigue: `onload` ya garantiza que se puede
           dibujar, y decode() solo era por si el navegador tardaba en tenerla lista. */
        var seguido = false;
        var sigue = function () { if (!seguido) { seguido = true; bien(img); } };
        img.decode().then(sigue, sigue);
        setTimeout(sigue, 300);
      };
      img.onerror = function () { mal(new Error('No se pudo abrir la tira.')); };
      img.src = src;
    });
  }

  /* ── Buscar la franja ──────────────────────────────────────────────────────────────────
     Una columna es franja si es clara casi de arriba abajo. Se miran 24 filas repartidas en
     vez de todas: con 448 px de alto sobra para distinguir una franja de un reflejo, y cuesta
     veinte veces menos. */
  var CLARO = 232;          // luminancia a partir de la cual contamos «clara»
  var CUANTAS_FILAS = 24;
  var MINIMO_CLARAS = 0.9;  // 22 de las 24 filas

  function esFranja(datos, W, H, x) {
    var claras = 0;
    for (var k = 0; k < CUANTAS_FILAS; k++) {
      var y = Math.floor((k + 0.5) * H / CUANTAS_FILAS);
      var i = (y * W + x) * 4;
      var l = 0.299 * datos[i] + 0.587 * datos[i + 1] + 0.114 * datos[i + 2];
      if (l >= CLARO) claras++;
    }
    return claras / CUANTAS_FILAS >= MINIMO_CLARAS;
  }

  /* Devuelve {desde, hasta} de la franja que cruza el tercio, o null si no hay ninguna.
     Solo se busca cerca del tercio: una pared blanca en medio de un panel no nos interesa. */
  function franjaEn(datos, W, H, x0, ventana) {
    var ini = Math.max(0, x0 - ventana), fin = Math.min(W - 1, x0 + ventana);
    /* El punto de partida: alguna columna clara dentro de la ventana, la más cercana al tercio. */
    var semilla = -1, mejor = Infinity;
    for (var x = ini; x <= fin; x++) {
      if (esFranja(datos, W, H, x) && Math.abs(x - x0) < mejor) { mejor = Math.abs(x - x0); semilla = x; }
    }
    if (semilla < 0) return null;
    var desde = semilla, hasta = semilla;
    while (desde - 1 >= ini && esFranja(datos, W, H, desde - 1)) desde--;
    while (hasta + 1 <= fin && esFranja(datos, W, H, hasta + 1)) hasta++;
    return { desde: desde, hasta: hasta };
  }

  /* ── Quitarle el marco a una viñeta ────────────────────────────────────────────────────
     El modelo pinta un recuadro alrededor de cada cuadro por mucho que el prompt le diga que
     no. Medido en la primera tira de verdad: arriba y abajo deja un margen BLANCO (luz 254,8)
     y a los lados una línea OSCURA. O sea que «marco» no es claro ni oscuro, es las dos cosas:
     la regla es «esta línea no es dibujo», y no es dibujo cuando casi toda ella es muy clara o
     muy oscura.

     Se recorre desde el borde hacia adentro sin soltar, porque el marco es continuo. Dos
     tanteos que NO sirven, y los dos se probaron:
       · pararse en la primera línea que no es marco — el corte deja a veces un filo de dibujo
         por fuera de la línea oscura, y el marco se quedaba puesto;
       · buscar la línea de marco más profunda — se comía 54 píxeles de un cielo claro.
     Por eso se toleran HUECO líneas seguidas y ni una más. */
  var CLARO_M = 235, OSCURO_M = 85;
  var MAYORIA = 0.7;     // cuánta parte de la línea tiene que ser marco
  var TOPE = 0.12;       // nunca recortar más de esto por lado
  var HUECO = 2;         // líneas seguidas sin marco que se toleran antes de parar
  var MUESTRAS = 40;

  function recortarMarco(g, W, H) {
    var d = g.getImageData(0, 0, W, H).data;
    var luz = function (x, y) {
      var i = (y * W + x) * 4;
      return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    };
    var xs = [], ys = [], k;
    for (k = 0; k < MUESTRAS; k++) {
      xs.push(Math.floor((k + 0.5) * W / MUESTRAS));
      ys.push(Math.floor((k + 0.5) * H / MUESTRAS));
    }
    var esMarco = function (vals) {
      var fuera = 0;
      for (var i = 0; i < vals.length; i++) if (vals[i] >= CLARO_M || vals[i] <= OSCURO_M) fuera++;
      return fuera / vals.length >= MAYORIA;
    };
    var col = function (x) { return ys.map(function (y) { return luz(x, y); }); };
    var fil = function (y) { return xs.map(function (x) { return luz(x, y); }); };

    var hasta = function (tope, linea) {
      var fondo = -1, seguidas = 0;
      for (var i = 0; i < tope; i++) {
        if (esMarco(linea(i))) { fondo = i; seguidas = 0; }
        else if (++seguidas > HUECO) break;
      }
      return fondo >= 0 ? fondo + 2 : 0;
    };

    var maxX = Math.floor(W * TOPE), maxY = Math.floor(H * TOPE);
    var a = hasta(maxX, function (i) { return col(i); });
    var b = W - 1 - hasta(maxX, function (i) { return col(W - 1 - i); });
    var c = hasta(maxY, function (i) { return fil(i); });
    var e = H - 1 - hasta(maxY, function (i) { return fil(H - 1 - i); });
    a = Math.min(a, W - 3); c = Math.min(c, H - 3);
    return { x: a, y: c, ancho: Math.max(b, a + 2) - a + 1, alto: Math.max(e, c + 2) - c + 1 };
  }

  /* ── El corte ───────────────────────────────────────────────────────────────────────── */
  function cortar(r) {
    if (!r || !r.imagen) return Promise.reject(new Error('No llegó ninguna tira.'));
    var n = cuantas(r);
    var margen = Number((r.corte || {}).margen) || 0;

    return cargar(r.imagen).then(function (img) {
      var W = img.naturalWidth, H = img.naturalHeight;
      var lienzo = document.createElement('canvas');
      lienzo.width = W; lienzo.height = H;
      var g = lienzo.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);

      /* Los bordes de cada viñeta. Se empieza por los tercios y se corrigen con las franjas. */
      var anchoPanel = W / n;
      var tope = Math.min(margen, Math.floor(anchoPanel / 8));
      var bordes = [];
      for (var i = 0; i < n; i++) bordes.push({ a: Math.round(i * anchoPanel), b: Math.round((i + 1) * anchoPanel) });
      bordes[0].a = tope;
      bordes[n - 1].b = W - tope;

      if (n > 1) {
        var datos = g.getImageData(0, 0, W, H).data;
        var ventana = Math.round(anchoPanel * 0.12);
        for (var j = 1; j < n; j++) {
          var x0 = Math.round(j * anchoPanel);
          var f = franjaEn(datos, W, H, x0, ventana);
          if (f) { bordes[j - 1].b = f.desde; bordes[j].a = f.hasta + 1; }
          else { bordes[j - 1].b = x0 - tope; bordes[j].a = x0 + tope; }
        }
      }

      return bordes.map(function (e) {
        var ancho = Math.max(1, e.b - e.a);

        /* Primero se separa la viñeta, y sobre ella ya suelta se le busca el marco: el marco de
           cada cuadro es suyo y no está a la misma altura en los tres. */
        var suelta = document.createElement('canvas');
        suelta.width = ancho; suelta.height = H;
        var gs = suelta.getContext('2d', { willReadFrequently: true });
        gs.drawImage(lienzo, e.a, 0, ancho, H, 0, 0, ancho, H);

        var m = recortarMarco(gs, ancho, H);
        if (m.ancho === ancho && m.alto === H) return suelta.toDataURL('image/jpeg', 0.9);

        var limpia = document.createElement('canvas');
        limpia.width = m.ancho; limpia.height = m.alto;
        limpia.getContext('2d').drawImage(suelta, m.x, m.y, m.ancho, m.alto, 0, 0, m.ancho, m.alto);
        return limpia.toDataURL('image/jpeg', 0.9);
      });
    });
  }

  /* ── Guardar y recuperar ───────────────────────────────────────────────────────────────
     Las viñetas NO viajan dentro de la ficha: una son ~80 KB y nueve serían casi un mega en
     cada guardado. Van a un bucket privado —llevan la cara de alguien— y en la ficha queda
     solo la ruta.

     El bucket no es público, así que una `<img src>` a pelo no la ve nadie: hay que pedir una
     dirección firmada. Se piden todas de golpe.

     ⚠️ (24-sep) Una firma VENCE. Antes se pedía por una hora y se recordaba para siempre: con la pestaña abierta más
     de una hora, todas las viñetas salían rotas (Sergio lo vio en la ficha, y le iba a pasar grabando el
     storyboard). Ahora se firma por 12 h, se sabe cuándo vence cada una, se renueva sola antes de que venza y, si
     una imagen falla igual (el portátil se durmió), se vuelve a firmar y se cambia en su sitio, sin repintar. */
  var firmadas = {};      // ruta -> { url: dirección que sí se puede pintar, vence: ms }
  var FIRMA = 12 * 3600;                  // segundos que dura una firma
  var ANTES = 30 * 60 * 1000;             // se renueva cuando le queda menos de esto

  function dataAblob(dataUrl) {
    var partes = String(dataUrl).split(',');
    var tipo = (/data:([^;]+)/.exec(partes[0]) || [])[1] || 'image/jpeg';
    var bin = atob(partes[1]);
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: tipo });
  }

  /* Sube y devuelve la ruta. El nombre lleva un sello de tiempo para que reemplazar una viñeta
     no se quede pillado en la caché del navegador con la anterior. */
  function guardar(dataUrl, ficha, paso) {
    var u = window.CherryApp && CherryApp.usuario();
    if (!u || !u.id) return Promise.reject(new Error('Entra otra vez: se perdió la sesión.'));
    var ruta = u.id + '/' + ficha + '/' + paso + '-' + Date.now() + '.jpg';
    var cuerpo = dataAblob(dataUrl);
    return CherryApp.rest('/storage/v1/object/vinetas/' + ruta, {
      method: 'POST', body: cuerpo,
      headers: { 'Content-Type': cuerpo.type, 'x-upsert': 'true' },
    }).then(function () {
      /* Ya la tenemos delante: se recuerda para que se pinte al instante, sin ir a firmarla. */
      firmadas[ruta] = { url: dataUrl, vence: Infinity };
      return ruta;
    });
  }

  function vigente(r) { var f = firmadas[r]; return !!(f && f.vence - Date.now() > ANTES); }

  /* Pide la firma de `rutas` y, si alguna ya estaba pintada con su firma vieja, le cambia la dirección a la
     imagen en su sitio (sin repintar: no se pierde lo que se esté escribiendo ni el sitio del scroll). */
  function firmar(rutas) {
    return CherryApp.rest('/storage/v1/object/sign/vinetas', {
      method: 'POST', body: JSON.stringify({ expiresIn: FIRMA, paths: rutas }),
    }).then(function (lista) {
      var vence = Date.now() + FIRMA * 1000;
      (lista || []).forEach(function (x) {
        if (!x || !x.path || !x.signedURL) return;
        var vieja = firmadas[x.path] && firmadas[x.path].url;
        /* `signedURL` viene relativa («/object/sign/…»), así que se le pega el origen. */
        var nueva = CherryApp.base() + '/storage/v1' + x.signedURL;
        firmadas[x.path] = { url: nueva, vence: vence };
        if (vieja && vieja !== nueva) cambiarEnPagina(vieja, nueva);
      });
    });
  }
  function cambiarEnPagina(vieja, nueva) {
    document.querySelectorAll('img').forEach(function (img) {
      if (img.getAttribute('src') === vieja || img.src === vieja) img.src = nueva;
    });
  }

  /* Direcciones firmadas de varias rutas a la vez: las que no tiene o están por vencer. */
  function mirar(rutas) {
    var faltan = (rutas || []).filter(function (r) { return r && !vigente(r); });
    if (!faltan.length) return Promise.resolve(firmadas);
    return firmar(faltan).then(function () { return firmadas; }).catch(function (e) {
      /* Que no se pueda firmar no puede tumbar la ficha: se queda el boceto y se sigue. */
      console.warn('[vinetas] no pude firmar:', String(e));
      return firmadas;
    });
  }

  function url(ruta) { var f = ruta && firmadas[ruta]; return f ? f.url : ''; }

  /* Renovar antes de que venzan: cada 5 min se miran las que ya se firmaron. */
  setInterval(function () {
    var pronto = Object.keys(firmadas).filter(function (r) { return firmadas[r].vence !== Infinity && !vigente(r); });
    if (pronto.length) mirar(pronto);
  }, 5 * 60 * 1000);

  /* Y si una viñeta falla igual, se vuelve a firmar esa sola (una vez por minuto como mucho). */
  var reintento = {};
  document.addEventListener('error', function (ev) {
    var img = ev.target;
    if (!img || img.tagName !== 'IMG') return;
    var src = img.getAttribute('src') || '';
    var ruta = Object.keys(firmadas).filter(function (r) { return firmadas[r].url === src || firmadas[r].url === img.src; })[0];
    if (!ruta || firmadas[ruta].vence === Infinity) return;
    if (reintento[ruta] && Date.now() - reintento[ruta] < 60000) return;
    reintento[ruta] = Date.now();
    firmadas[ruta].vence = 0;
    mirar([ruta]);
  }, true);

  window.CherryVinetas = { cortar: cortar, guardar: guardar, mirar: mirar, url: url };
})();

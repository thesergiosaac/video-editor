/* letras-propias.js — las letras que sube cada quien (8-oct-2026)
 *
 * En Identidad de marca se puede subir una letra propia (.ttf, .otf, .woff o .woff2, hasta 5 MB) y escogerla para
 * títulos, texto o remate. El archivo vive en el depósito PRIVADO de los carruseles, en la carpeta de cada quien:
 *   carruseles/<user_id>/letras/<id>          (sin extensión: el navegador reconoce la letra por dentro)
 * Borrar la cuenta lo borra con todo lo demás (servidor/borrar-cuenta.ts). En la identidad solo queda la ficha:
 *   letrasPropias: [{ id: 'lp-…', nombre: 'Gilroy ExtraBold', tipo: 'font/otf' }]
 *
 * Cada letra se registra en el navegador con la familia «Cherry letra <id>». Quien pinte con la marca (Identidad de
 * marca, Carruseles, Historias) llama cargar(lista) o cargarFamilia(familia). Se guarda también como data: porque
 * html-to-image no alcanza archivos de otro dominio: css() devuelve los @font-face para meterlos en las descargas.
 * Lo ya bajado queda en la caché del navegador: la segunda vez la letra está al instante.
 */
(function () {
  'use strict';
  var TIPOS = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
  /* TOPE 2 (una para títulos y otra para texto): con 3, en un portátil de 1366×700 la pestaña Letras ya no cabe sin bajar */
  var MAX = 5 * 1024 * 1024, TOPE = 2, PREFIJO = 'Cherry letra ', CACHE = 'cherry-letras-v1';
  var cargadas = {};   // familia → promesa de { familia, dato } (o null si no se pudo)
  var nombres = {};    // familia → nombre que ve la gente

  function familia(id) { return PREFIJO + id; }
  function esPropia(fam) { return typeof fam === 'string' && fam.indexOf(PREFIJO) === 0; }
  function idDe(fam) { return esPropia(fam) ? fam.slice(PREFIJO.length) : null; }
  function uid() { var u = window.CherryApp && CherryApp.usuario(); return u && u.id; }
  function ruta(id) { return uid() + '/letras/' + id; }
  function valida(l) { return l && typeof l.id === 'string' && /^lp-[a-z0-9]+$/.test(l.id) && typeof l.nombre === 'string'; }
  /* «Gilroy-ExtraBold.otf» → «Gilroy ExtraBold» */
  function nombreDe(archivo) {
    return String(archivo || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ').trim().slice(0, 32) || 'Tu letra';
  }
  function aDato(buf, tipo) {
    return new Promise(function (ok, mal) {
      var fr = new FileReader();
      fr.onload = function () { ok(fr.result); }; fr.onerror = mal;
      fr.readAsDataURL(new Blob([buf], { type: tipo || 'font/ttf' }));
    });
  }
  /* El archivo cubre TODOS los pesos: así el navegador no le inventa una negrita encima */
  function registrar(fam, buf, tipo) {
    var f = new FontFace(fam, buf, { weight: '1 1000', style: 'normal', display: 'swap' });
    return f.load().then(function (ff) {
      document.fonts.add(ff);
      return aDato(buf, tipo).then(function (d) { return { familia: fam, dato: d }; });
    });
  }

  /* ── La caché del navegador: la clave es la ruta, no la dirección firmada (esa cambia cada vez) ── */
  function claveCache(r) { return location.origin + '/__cherry-letras/' + r; }
  function deCache(r) {
    try {
      if (!window.caches) return Promise.resolve(null);
      return caches.open(CACHE).then(function (c) { return c.match(claveCache(r)); })
        .then(function (res) { return res ? res.arrayBuffer() : null; }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function aCache(r, buf, tipo) {
    try {
      if (window.caches) caches.open(CACHE).then(function (c) { return c.put(claveCache(r), new Response(buf, { headers: { 'Content-Type': tipo || 'font/ttf' } })); }).catch(function () {});
    } catch (e) { /* sin caché también sirve */ }
  }
  function bajar(r) {
    return CherryApp.rest('/storage/v1/object/sign/carruseles', { method: 'POST', body: JSON.stringify({ expiresIn: 600, paths: [r] }) })
      .then(function (x) {
        var f = x && x[0];
        if (!f || !f.signedURL) throw new Error('no encontré la letra');
        return fetch(CherryApp.base() + '/storage/v1' + f.signedURL);
      })
      .then(function (res) { if (!res.ok) throw new Error('la letra no bajó (' + res.status + ')'); return res.arrayBuffer(); });
  }

  /* Una letra por su familia: de la caché o del depósito. Si no se puede, sale la letra de reemplazo (null). */
  function cargarFamilia(fam, tipo) {
    var id = idDe(fam);
    if (!id || !uid()) return Promise.resolve(null);
    if (cargadas[fam]) return cargadas[fam];
    var r = ruta(id);
    cargadas[fam] = deCache(r).then(function (buf) {
      if (buf) return buf;
      return bajar(r).then(function (b) { aCache(r, b, tipo); return b; });
    }).then(function (buf) { return registrar(fam, buf, tipo); })
      .catch(function (e) { console.warn('Letra propia', fam, e); delete cargadas[fam]; return null; });
    return cargadas[fam];
  }
  function cargar(lista) {
    lista = (Array.isArray(lista) ? lista : []).filter(valida);
    lista.forEach(function (l) { nombres[familia(l.id)] = l.nombre; });
    return Promise.all(lista.map(function (l) { return cargarFamilia(familia(l.id), l.tipo); }));
  }

  /* Subir: primero se revisa y se registra aquí (la letra se ve AL INSTANTE); el archivo sube detrás.
     Devuelve { ficha, subida }: `subida` se cumple cuando el archivo ya está en la cuenta. */
  function subir(archivo) {
    var ext = (/\.([a-z0-9]+)$/i.exec(archivo && archivo.name || '') || [])[1];
    ext = ext && ext.toLowerCase();
    if (!archivo || !TIPOS[ext]) return Promise.reject(new Error('Ese archivo no es una letra. Sube un .ttf, .otf, .woff o .woff2.'));
    if (archivo.size > MAX) return Promise.reject(new Error('La letra pesa más de 5 MB. Prueba con otra versión (la .woff2 pesa menos).'));
    if (!uid()) return Promise.reject(new Error('Tu sesión se cerró. Vuelve a entrar para subir la letra.'));
    var id = 'lp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fam = familia(id), tipo = TIPOS[ext];
    return archivo.arrayBuffer().then(function (buf) {
      var registro = registrar(fam, buf.slice(0), tipo).catch(function () { throw new Error('No pude abrir esa letra: el archivo está dañado o no es una letra. Prueba con otro.'); });
      return registro.then(function (x) {
        cargadas[fam] = Promise.resolve(x);
        var ficha = { id: id, nombre: nombreDe(archivo.name), tipo: tipo };
        nombres[fam] = ficha.nombre;
        var r = ruta(id);
        var subida = CherryApp.rest('/storage/v1/object/carruseles/' + r, { method: 'POST', headers: { 'Content-Type': tipo, 'x-upsert': 'true' }, body: new Blob([buf], { type: tipo }) })
          .then(function () { aCache(r, buf, tipo); return ficha; });
        return { ficha: ficha, subida: subida };
      });
    });
  }

  /* Los @font-face de las letras propias ya cargadas, con el archivo adentro (para las descargas) */
  function css() {
    var fams = Object.keys(cargadas);
    return Promise.all(fams.map(function (f) { return cargadas[f]; })).then(function (xs) {
      return xs.filter(Boolean).map(function (x) {
        return '@font-face{font-family:"' + x.familia + '";src:url(' + x.dato + ');font-weight:1 1000;font-style:normal;font-display:block}';
      }).join('\n');
    });
  }
  function nombre(fam, lista) {
    if (!esPropia(fam)) return fam;
    var l = (lista || []).filter(function (x) { return valida(x) && familia(x.id) === fam; })[0];
    return l ? l.nombre : (nombres[fam] || 'Tu letra');
  }

  window.CherryLetras = {
    TOPE: TOPE, ACEPTA: '.ttf,.otf,.woff,.woff2',
    familia: familia, esPropia: esPropia, valida: valida, nombre: nombre,
    cargar: cargar, cargarFamilia: cargarFamilia, subir: subir, css: css
  };
})();

/* caras.js — (29-oct-2026) DÓNDE ESTÁ TU CARA en tu video, para que los títulos de la Cámara viva vayan al lado y nunca
 * encima (js/camara-viva.js › cajaTitulo). Corre en el navegador de la persona, gratis: el detector de caras de MediaPipe
 * (Google) sobre la base del video, una muestra cada 0,25 s. Devuelve [[t, x, y, w, h], …] en el cuadro de 1080 × 1920
 * (x, y = centro de la cara), igual que las caras de YuNet del reel del Día 4; sin cara en una muestra: [t, null, …].
 * Lo que sale se guarda con el proyecto para que el video final ponga los títulos en el mismo sitio que la vista previa.
 *   CherryCaras.detectar(urlDelVideo, { cada: 0.25, alAvanzar: (fraccion) => … }) → Promise<lista> */
(function () {
  'use strict';
  var VERSION = '0.10.14';
  var CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION;
  var MODELO = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  var detector = null;

  async function cargar() {
    if (detector) return detector;
    var vision = await import(CDN + '/vision_bundle.mjs');
    var archivos = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
    detector = await vision.FaceDetector.createFromOptions(archivos, {
      baseOptions: { modelAssetPath: MODELO, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: 0.5,
    });
    return detector;
  }

  function irA(v, t) {
    return new Promise(function (ok) {
      var listo = function () { v.removeEventListener('seeked', listo); ok(); };
      v.addEventListener('seeked', listo);
      v.currentTime = t;
      setTimeout(listo, 3000);   // si el cuadro no llega, se sigue (esa muestra queda sin cara)
    });
  }

  async function detectar(url, opciones) {
    opciones = opciones || {};
    var cada = opciones.cada || 0.25;
    var d = await cargar();
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.src = url;
    await new Promise(function (ok, mal) { v.addEventListener('loadeddata', ok, { once: true }); v.addEventListener('error', mal, { once: true }); });
    // se mira en pequeño (360 de ancho): sobra para una cara y va rápido
    var cv = document.createElement('canvas'), ancho = 360, alto = Math.round(360 * v.videoHeight / v.videoWidth);
    cv.width = ancho; cv.height = alto;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    var kx = 1080 / ancho, ky = 1920 / alto, lista = [], total = v.duration || 0;
    try {
      for (var t = 0; t <= total + 1e-6; t += cada) {
        await irA(v, Math.min(t, Math.max(0, total - 0.05)));
        cx.drawImage(v, 0, 0, ancho, alto);
        var r = d.detect(cv), mejor = null;
        (r.detections || []).forEach(function (q) {   // la más grande (la persona que habla)
          var b = q.boundingBox;
          if (b && (!mejor || b.width * b.height > mejor.width * mejor.height)) mejor = b;
        });
        var tt = Math.round(t * 100) / 100;
        lista.push(mejor ? [tt, Math.round((mejor.originX + mejor.width / 2) * kx), Math.round((mejor.originY + mejor.height / 2) * ky),
          Math.round(mejor.width * kx), Math.round(mejor.height * ky)] : [tt, null, null, null, null]);
        if (opciones.alAvanzar) opciones.alAvanzar(total ? Math.min(1, t / total) : 1);
      }
    } finally { v.removeAttribute('src'); try { v.load(); } catch (_) {} }
    return lista;
  }

  window.CherryCaras = { detectar: detectar, VERSION: VERSION };
})();

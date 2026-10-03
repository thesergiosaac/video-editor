/* personavivo.js — TU RECORTE EN LA VISTA PREVIA (2-oct-2026)
 *
 * Sergio: «siempre la vista previa debe mostrar exactamente como va a quedar el video final, sin excepción». Las piezas que
 * usan tu recorte (la pantalla con sello, los anillos, Te sales, Tú delante y los gráficos «Detrás de ti») en el video final
 * te ponen DELANTE con un recorte que saca el ensamblador. Aquí se hace lo mismo en vivo:
 *   · la silueta es la MISMA de todo el video que ya usa el color por zonas (colorvivo.js › siluetaPara: la pide una vez a
 *     color-silueta y queda junto al video), y corre escondida al mismo segundo que el video;
 *   · un lienzo pinta tu imagen —con el color ya puesto, si la vista de color está activa— y le quita todo lo que no eres tú
 *     con la silueta, con el mismo corte del ensamblador (lut (val-90)*255/80 sobre la silueta, ver carrete-assembler ›
 *     prepararPersonas);
 *   · ese lienzo lo pone CADA PLANTILLA justo donde va tu recorte (premium-vista: lib/personaVista.tsx), con su misma
 *     animación; en «Detrás de ti» va encima del gráfico y debajo de los subtítulos (movvivo.js).
 * Mientras la silueta no está (la primera vez se recorta, 1-2 min), la vista previa lo dice en lugar de mostrar otra cosa.
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const lienzo = document.createElement('canvas');
  lienzo.className = 'persona-vivo';
  lienzo.setAttribute('aria-hidden', 'true');
  lienzo.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
  const mascara = document.createElement('canvas');
  const E = { estado: '', ultimo: -1 };

  /* La fuente con tu color: el lienzo de la vista de color si se está viendo; si no, el video */
  function fuente(ctx) {
    const L = ctx.elementos && ctx.elementos[1];
    if (L && L.tagName === 'CANVAS' && L.width > 0 && L.offsetParent !== null && getComputedStyle(L).display !== 'none') return L;
    return ctx.video;
  }

  /* (2-oct) una silueta propia (la de una edición hecha a mano, `silueta_key`: la misma que usa el ensamblador ahí) */
  const PROPIAS = new Map();
  function siluetaPropia(url) {
    let e = PROPIAS.get(url);
    if (!e) {
      const sv = document.createElement('video');
      sv.crossOrigin = 'anonymous'; sv.muted = true; sv.playsInline = true; sv.preload = 'auto'; sv.src = url;
      sv.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1';
      document.body.appendChild(sv);
      e = { estado: 'lista', video: sv };
      sv.addEventListener('error', () => { e.estado = 'error'; });
      PROPIAS.set(url, e);
    }
    return e;
  }
  /* Pinta el cuadro de ahora. Devuelve '' si quedó listo, o el aviso de por qué no (para mostrarlo en la vista previa).
     `silueta` (opcional): la dirección de otra silueta de todo el video (la de una edición hecha a mano). */
  function pintar(ctx, silueta) {
    const v = ctx && ctx.video, CV = C.colorVivo;
    if (!v || !CV || !CV.siluetaPara) { E.estado = 'sin silueta'; return 'Tu recorte no está disponible en esta vista.'; }
    const e = silueta ? siluetaPropia(silueta) : CV.siluetaPara(v);
    if (!e || e.estado === 'error') { E.estado = 'error'; return 'No se pudo recortar tu silueta: en el video final esta pieza no sale.'; }
    if (e.estado !== 'lista' || !e.video) { E.estado = 'esperando'; return 'Cherry está recortando tu silueta (la primera vez tarda 1 o 2 minutos)…'; }
    const sv = e.video;
    if (CV.sincronizar) CV.sincronizar(sv, v);
    if (sv.readyState < 2) { E.estado = 'cargando'; return 'Cargando tu silueta…'; }
    const vw = v.videoWidth || 1080, vh = v.videoHeight || 1920;
    // media resolución: igual que el ensamblador (la persona va a 1080 de ancho; en el celular se ve a ~400 px)
    const W = Math.min(720, vw), H = Math.round((vh * W) / vw);
    if (lienzo.width !== W || lienzo.height !== H) { lienzo.width = W; lienzo.height = H; }
    const mw = Math.round(W / 2), mh = Math.round(H / 2);
    if (mascara.width !== mw || mascara.height !== mh) { mascara.width = mw; mascara.height = mh; }
    const m = mascara.getContext('2d', { willReadFrequently: true });
    m.drawImage(sv, 0, 0, mw, mh);
    const img = m.getImageData(0, 0, mw, mh), px = img.data;
    // la silueta llega en gris (blanco = tú): el corte del ensamblador, pasado de y limitado a RGB completo (90→86, 170→179)
    for (let i = 0; i < px.length; i += 4) {
      const a = Math.max(0, Math.min(255, ((px[i] - 86) * 255) / 93));
      px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = a;
    }
    m.putImageData(img, 0, 0);
    const g = lienzo.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.drawImage(fuente(ctx), 0, 0, W, H);
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.drawImage(mascara, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    E.estado = 'lista';
    return '';
  }

  C.personaVivo = { lienzo: () => lienzo, pintar, estado: () => E.estado };
  // para las plantillas de Remotion de la vista previa (lib/personaVista.tsx)
  window.CherryPersonaVista = { lienzo: () => lienzo };
})();

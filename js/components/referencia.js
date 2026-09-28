/* referencia.js — (28-sep-2026, fase 3 del color) «Tu referencia»: el color de una foto o un video que le guste a la
   persona. Sergio lo escogió así: «subes una foto o un video cuyo color te guste. Una IA lo mira y Cherry lleva tus
   tomas a ese color, respetando la piel».

   1 · Se leen hasta 3 cuadros de lo que se subió (una foto: ella misma; un video: al 20, 50 y 80 %).
   2 · La IA (servidor › color-referencia) marca lo que NO es escena para no medirlo (texto, logos, interfaz) y dice en
       palabras qué color tiene. Si falla, se mide la imagen entera.
   3 · motor-color.js mide la referencia y tu video objeto por objeto y arma la receta (recetaDeReferencia): queda como
       un look más, con su intensidad y sus ajustes, igual en la vista previa y en el video. */
(function () {
  const C = window.CARRETE;
  const LADO = 720;                 // lo que se mide: el lado largo, en pixeles
  const LADO_IA = 768;              // lo que ve la IA

  function avisar(texto, error) { C.setState({ refEstado: error ? '' : texto, refError: error ? texto : '' }); }

  function cargarImagen(url) {
    return new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error('No se pudo abrir la imagen.')); im.src = url; });
  }
  function cargarVideo(url) {
    return new Promise((ok, mal) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onloadeddata = () => ok(v); v.onerror = () => mal(new Error('No se pudo abrir el video.'));
    });
  }
  function irA(v, t) { return new Promise((ok) => { v.onseeked = () => ok(); v.currentTime = t; }); }
  function aLienzo(fuente, w0, h0, lado) {
    const k = Math.min(1, lado / Math.max(w0, h0)), w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d', { willReadFrequently: true }).drawImage(fuente, 0, 0, w, h);
    return cv;
  }
  /* los cuadros de lo que se subió, todos del mismo tamaño */
  async function cuadrosDe(archivo) {
    const url = URL.createObjectURL(archivo);
    try {
      if (/^video\//.test(archivo.type)) {
        const v = await cargarVideo(url), fuentes = [];
        for (const p of [0.2, 0.5, 0.8]) { await irA(v, (v.duration || 1) * p); fuentes.push(aLienzo(v, v.videoWidth, v.videoHeight, LADO)); }
        return fuentes;
      }
      const im = await cargarImagen(url);
      return [aLienzo(im, im.naturalWidth, im.naturalHeight, LADO)];
    } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  }
  /* la miniatura que se guarda con el video (pequeña: viaja en la configuración) */
  function miniatura(cv) {
    const m = aLienzo(cv, cv.width, cv.height, 120);
    return m.toDataURL('image/jpeg', 0.6);
  }

  async function medir(archivo) {
    const MC = window.CherryColor;
    avisar('Abriendo tu referencia…');
    const cuadros = await cuadrosDe(archivo);
    const W = cuadros[0].width, H = cuadros[0].height;
    // 2 · la IA marca lo que no es escena
    avisar('Cherry está mirando tu referencia…');
    let cajas = cuadros.map(() => []), desc = '';
    try {
      const r = await C.api.edgeFetch('color-referencia', { imagenes: cuadros.map((cv) => aLienzo(cv, cv.width, cv.height, LADO_IA).toDataURL('image/jpeg', 0.85)) });
      if (r && Array.isArray(r.imagenes)) cajas = cuadros.map((_, i) => (r.imagenes[i] && r.imagenes[i].excluir) || []);
      desc = (r && r.descripcion) || '';
    } catch (e) { console.warn('[Referencia] la IA no contestó; se mide la imagen entera:', e); }
    // 3 · medir la referencia (todos los cuadros juntos, sin lo marcado) y tu video
    avisar('Midiendo el color…');
    const px = new Uint8ClampedArray(W * H * 4 * cuadros.length);
    cuadros.forEach((cv, i) => px.set(cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, i * W * H * 4));
    const fuera = (i) => {
      const q = Math.floor(i / (W * H)), j = i % (W * H), x = (j % W) / W * 1000, y = Math.floor(j / W) / H * 1000;
      return (cajas[q] || []).some((c) => y >= c[0] && y <= c[2] && x >= c[1] && x <= c[3]);
    };
    const ref = MC.medirParaReferencia(px, 4, W, H, fuera);
    const tuyo = C.colorVivo && C.colorVivo.muestrasParaReferencia ? C.colorVivo.muestrasParaReferencia() : null;
    if (!tuyo) throw new Error('Pon a correr tu video en el celular un momento para que Cherry lo mida, y vuelve a subir la referencia.');
    const src = MC.medirParaReferencia(tuyo.px, 4, null, null, null, tuyo.antes);
    const receta = MC.recetaDeReferencia(ref, src);
    if (!ref || !src || !receta) throw new Error('No se pudo medir el color de esa imagen.');
    return { receta, img: miniatura(cuadros[0]), desc };
  }

  /* Abre el selector de archivos (lo llama un clic) y deja la referencia puesta como look */
  function escoger() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*,video/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const r = await medir(f);
        const patch = { look: 'referencia', lookRef: r, lookFuerza: 100, refEstado: '', refError: '' };
        (window.CherryColor.AJUSTES || []).forEach((a) => { patch['aj_' + a.k] = 0; });
        C.setState(patch);
      } catch (e) {
        console.warn('[Referencia]', e);
        avisar(e && e.message ? e.message : 'No se pudo usar esa referencia.', true);
      }
    };
    inp.click();
  }

  C.referenciaColor = { escoger, _medir: medir };      // _medir: para las pruebas (sin el selector de archivos)
})();

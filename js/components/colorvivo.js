/* colorvivo.js — el color EN VIVO sobre el celular (18-sep-2026).
 *
 * Mientras el módulo Edición está abierto (ahí vive el color), el celular muestra tu video SIN color
 * (el de sin_subtitulos del último render o, si todavía no hay render, tu primer
 * clip) y encima lo pinta con WebGL usando motor-color.js — el MISMO archivo que
 * usa el ensamblador para el video final. Lo que se ve es lo que sale.
 *
 * · El revelado se mide aquí igual que en el servidor: cuadros chiquitos del video
 *   (hasta 40, uno cada ~1 s mientras se reproduce). El servidor mide el video entero,
 *   así que la vista puede diferir un pelo al principio y se va acercando.
 * · Revelado + look van en UNA tabla 3D; la viñeta se calcula en el shader con la
 *   misma fórmula del filtro vignette de ffmpeg.
 * · Los deslizadores escriben en C.state sin redibujar: el bucle lee el estado en
 *   cada cuadro y rehace la tabla solo cuando algo cambió.
 * · Botón «Mantén para ver el original»: muestra el video crudo mientras se presiona.
 */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const MC = window.CherryColor;
  const N = 33;                      // tamaño de la tabla, igual que en el ensamblador

  /* ── ¿De dónde sale el video sin color? ── */
  function fuente(s) {
    if (s.fondoPrevia) return C.urlVideo(s.fondoPrevia);
    const clip = (s.clips || []).find((c) => c && c.mp4_path);
    return clip && C.urlClip ? C.urlClip(clip.mp4_path) : null;
  }

  /* el color vive dentro de Edición: con ese módulo abierto el celular muestra el color en vivo */
  // 19-sep: también con Movimiento abierto (movvivo.js le pone el movimiento encima)
  function activo(s) { return (s.openCard === 'edicion' || s.openCard === 'mov') && !!fuente(s) && !!MC; }

  /* ── Receta actual (lo que el bucle compara para saber si rehacer la tabla) ── */
  function receta(s) {
    const look = s.look && s.look !== 'ninguno' && MC.CATALOGO[s.look] ? s.look : null;
    const aj = {};
    MC.AJUSTES.forEach((a) => { aj[a.k] = Number(s['aj_' + a.k]) || 0; });
    return { look, fuerza: (Number(s.lookFuerza) || 100) / 100, aj, revelado: s.revelado !== false };
  }

  /* ── Estado del lienzo (vive entre redibujos) ── */
  const E = {
    envoltura: null, lienzo: null, gl: null, prog: null, texVideo: null, texLut: null,
    video: null, fuenteActual: null, externo: null,        // externo: función que da el video a pintar (vista de cortes)
    muestras: [], medida: null, versionMedida: 0, ultimaMuestra: 0,
    claveLut: '', angulo: 0, original: false, sinWebGL: false, bucle: 0,
    // cuadros nuevos: solo se sube el cuadro a la tarjeta de video cuando el video presenta uno (no 60 veces/s)
    vigilado: null, cuadroNuevo: true, subido: null,
  };

  /* ══ WebGL ══ */
  const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = vec2((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
  /* uv.y = 0 arriba, igual que ffmpeg mide la y de la viñeta */
  const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uVideo;
uniform sampler3D uLut;
uniform float uN, uAngulo, uOriginal, uCentroY, uAspecto;
uniform vec2 uTam;
in vec2 uv;
out vec4 color;
void main() {
  vec3 c = texture(uVideo, uv).rgb;
  if (uOriginal < 0.5) {
    c = texture(uLut, c * ((uN - 1.0) / uN) + 0.5 / uN).rgb;
    if (uAngulo > 0.0) {
      vec2 px = uv * uTam;
      vec2 d = vec2(px.x - uTam.x * 0.5, (px.y - uTam.y * uCentroY) * uAspecto);
      float dn = length(d) / length(uTam * 0.5);
      float k = dn > 1.0 ? 0.0 : cos(uAngulo * dn);
      c *= k * k * k * k;
    }
  }
  color = vec4(c, 1.0);
}`;

  function prepararGL(lienzo) {
    const gl = lienzo.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    const sh = (tipo, src) => {
      const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    E.texVideo = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, E.texVideo);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    E.texLut = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, E.texLut);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TEXTURE_WRAP_R'].forEach((w) => gl.texParameteri(gl.TEXTURE_3D, gl[w], gl.CLAMP_TO_EDGE));

    gl.uniform1i(gl.getUniformLocation(prog, 'uVideo'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uLut'), 1);
    gl.uniform1f(gl.getUniformLocation(prog, 'uN'), N);
    gl.uniform1f(gl.getUniformLocation(prog, 'uCentroY'), MC.VINETA_Y);
    gl.uniform1f(gl.getUniformLocation(prog, 'uAspecto'), MC.VINETA_ASPECTO);
    E.prog = prog;
    return gl;
  }

  /* ── Tabla: revelado (medido) + look (receta + ajustes), una sola ── */
  function subirLut(r) {
    const gl = E.gl;
    let P = null;
    if (r.look) P = MC.ajustar(MC.CATALOGO[r.look].base, r.aj);
    const lut = MC.generarLutCompleta(r.revelado ? E.medida : null, P, N, r.fuerza);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, E.texLut);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, N, N, N, 0, gl.RGB, gl.FLOAT, lut);
    E.angulo = P ? MC.anguloVineta(P.vineta * r.fuerza) : 0;
    gl.uniform1f(gl.getUniformLocation(E.prog, 'uAngulo'), E.angulo);
  }

  /* ── Medir el revelado con cuadros chiquitos del video, como el servidor ── */
  let muestreo = null;
  function tomarMuestra(v) {
    if (!v.videoWidth) return false;
    if (!muestreo) { muestreo = document.createElement('canvas'); }
    const w = 128, hh = Math.round((v.videoHeight / v.videoWidth) * w / 2) * 2;
    muestreo.width = w; muestreo.height = hh;
    const cx = muestreo.getContext('2d', { willReadFrequently: true });
    cx.drawImage(v, 0, 0, w, hh);
    let d;
    try { d = cx.getImageData(0, 0, w, hh).data; }
    catch (e) { console.warn('[Color] el video no deja leer sus pixeles (CORS):', e); return false; }
    E.muestras.push(d);
    // medir con todo lo juntado (RGBA → paso 4)
    const total = E.muestras.reduce((a, m) => a + m.length, 0);
    const todo = new Uint8Array(total);
    let o = 0; E.muestras.forEach((m) => { todo.set(m, o); o += m.length; });
    E.medida = MC.medirRevelado(todo, 1, 4);
    E.versionMedida++;
    return true;
  }

  /* ── Bucle: sube el cuadro del video y rehace la tabla solo si algo cambió ── */
  function cuadro() {
    E.bucle = 0;
    if (!E.lienzo || !document.body.contains(E.lienzo)) { pausar(); return; }
    const v = E.externo ? E.externo() : E.video, gl = E.gl;
    // el video propio del color corre siempre mientras se ve: si un redibujo lo sacó un instante (pausar) mientras
    // cargaba, el `autoplay` ya no lo vuelve a arrancar y quedaba quieto en el segundo 0
    if (!E.externo && v && v.paused && v.readyState >= 2 && document.body.contains(v)) v.play().catch(() => null);
    if (gl && v && v.readyState >= 2) {
      if (v.videoWidth && (E.lienzo.width !== v.videoWidth >> 1)) {
        E.lienzo.width = v.videoWidth >> 1; E.lienzo.height = v.videoHeight >> 1;
        gl.viewport(0, 0, E.lienzo.width, E.lienzo.height);
        gl.uniform2f(gl.getUniformLocation(E.prog, 'uTam'), v.videoWidth, v.videoHeight);
      }
      // revelado: la primera muestra enseguida, luego una por segundo hasta 40
      const ahora = performance.now();
      if (E.muestras.length < 40 && (!E.muestras.length || (!v.paused && ahora - E.ultimaMuestra > 1000))) {
        if (tomarMuestra(v)) E.ultimaMuestra = ahora;
      }
      const r = receta(C.state);
      const clave = JSON.stringify(r) + '|' + (r.revelado ? E.versionMedida : 0);
      if (clave !== E.claveLut) { subirLut(r); E.claveLut = clave; }

      // ¿hay algo nuevo que pintar? cuadro nuevo del video, otra tabla, otro video o el botón «sin color»
      if (v !== E.vigilado) {
        E.vigilado = v; E.cuadroNuevo = true;
        if (v.requestVideoFrameCallback) {
          const avisar = () => { if (E.vigilado !== v) return; E.cuadroNuevo = true; v.requestVideoFrameCallback(avisar); };
          v.requestVideoFrameCallback(avisar);
        }
      }
      // Subir el cuadro (lo caro: 1080×1920) solo cuando el video presenta uno nuevo...
      const sinAviso = !v.requestVideoFrameCallback;   // navegadores sin aviso de cuadros: se sube siempre
      if (E.cuadroNuevo || sinAviso || E.subido !== v) {
        E.cuadroNuevo = false; E.subido = v;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, E.texVideo);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
      }
      // ...pero PINTAR siempre (barato: la imagen ya está en la tarjeta). Cada redibujo de la página vuelve a
      // colocar el lienzo y el navegador lo borra: con el video pausado no llega cuadro nuevo y quedaba NEGRO
      // (lo reportó Sergio el 18-sep al abrir Color).
      gl.uniform1f(gl.getUniformLocation(E.prog, 'uOriginal'), E.original ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    E.bucle = requestAnimationFrame(cuadro);
  }
  function arrancar() { if (!E.bucle) E.bucle = requestAnimationFrame(cuadro); }
  function pausar() {
    if (E.bucle) cancelAnimationFrame(E.bucle);
    E.bucle = 0;
    if (E.video && !document.body.contains(E.video)) E.video.pause();
  }

  /* ── El lienzo sobre OTRO reproductor (la vista de cortes: dos videos que se turnan).
        `clave` identifica el material: si cambia, el revelado se vuelve a medir. ── */
  function crearLienzo() {
    if (!E.lienzo) {
      E.lienzo = h('canvas', { class: 'cv-lienzo' });
      try { E.gl = prepararGL(E.lienzo); } catch (e) { console.warn('[Color] WebGL falló:', e); E.gl = null; }
      E.sinWebGL = !E.gl;
    }
  }
  function sobre(obtenerVideo, clave) {
    if (clave !== E.fuenteActual) {
      E.fuenteActual = clave; E.muestras = []; E.medida = null; E.versionMedida++; E.claveLut = '';
    }
    E.externo = obtenerVideo;
    crearLienzo();
    setTimeout(arrancar, 0);
    return E.sinWebGL ? null : E.lienzo;
  }

  /* ── Lo que se pinta dentro del celular ── */
  function pantalla(s) {
    E.externo = null;
    const src = fuente(s);
    if (src !== E.fuenteActual) {                 // otro video: se vuelve a medir
      E.fuenteActual = src; E.muestras = []; E.medida = null; E.versionMedida++; E.claveLut = '';
    }
    E.video = C.videoFijo('color-fondo', src, {
      class: 'cv-video', crossorigin: 'anonymous', muted: true, autoplay: true, loop: true, playsinline: true, preload: 'auto',
      onLoadedmetadata: (e) => { if (e.target.currentTime < 1 && e.target.duration > 8) e.target.currentTime = 2; },
    });
    E.video.muted = true;
    if (C.corsConRespaldo) C.corsConRespaldo(E.video);   // si el CDN niega el permiso CORS → directo a S3 (no negro)
    if (E.video.paused) E.video.play().catch(() => null);

    // el video grande del celular no sigue sonando por detrás
    const grande = C.videoFijo.get('vista');
    if (grande && !grande.paused) grande.pause();

    crearLienzo();
    const r = receta(s);
    const nombre = r.look ? MC.CATALOGO[r.look].nombre : (r.revelado ? 'Solo revelado' : 'Sin color');

    const enMov = s.openCard === 'mov';
    const mantener = (on) => (e) => { e.preventDefault(); if (enMov) { if (C.movVivo) C.movVivo.sinMovimiento(on); } else E.original = on; };
    setTimeout(arrancar, 0);
    return h('div', { class: 'cv' },
      E.video,
      !E.sinWebGL && E.lienzo,
      h('div', { class: 'cv-etiqueta' }, enMov ? 'Movimiento en vivo' : E.sinWebGL ? 'Este navegador no puede mostrar el color en vivo' : 'Color en vivo · ' + nombre),
      !E.sinWebGL && h('button', {
        class: 'cv-original',
        onPointerdown: mantener(true), onPointerup: mantener(false), onPointerleave: mantener(false), onPointercancel: mantener(false),
        onContextmenu: (e) => e.preventDefault(),
      }, enMov ? 'Mantén para ver sin movimiento' : 'Mantén para ver sin color')
    );
  }

  /* _estado y _cuadro: para revisar desde la consola (una pestaña oculta no corre requestAnimationFrame) */
  C.colorVivo = { activo, pantalla, sobre, pausar, fuente, original: (on) => { E.original = !!on; }, _estado: E, _cuadro: () => { cuadro(); cancelAnimationFrame(E.bucle); E.bucle = 0; } };
})();

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
 * · (27-sep) Corrección general: va dentro de la misma tabla, después del look (como en el servidor).
 * · (27-sep) Looks con máscara (Selectivo): una tabla para el fondo y otra para la persona, mezcladas por la
 *   silueta de la persona — la misma que usa el ensamblador (`<video>_silueta.mp4`, la saca el servidor una vez).
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
    const k = {};
    (MC.CORRECCION || []).forEach((a) => { k[a.k] = Number(s['cg_' + a.k]) || 0; });
    return { look, fuerza: (Number(s.lookFuerza) || 100) / 100, aj, revelado: s.revelado !== false, k };
  }

  /* ── Estado del lienzo (vive entre redibujos) ── */
  const E = {
    envoltura: null, lienzo: null, gl: null, prog: null, texVideo: null, texLut: null, texLutP: null, texMascara: null,
    hayPersona: false, silActiva: null, mascaraSubida: null, aviso: '', avisoPintado: null,
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
uniform sampler2D uMascara;
uniform sampler3D uLut;
uniform sampler3D uLutP;
uniform float uN, uAngulo, uOriginal, uCentroY, uAspecto, uModo;
uniform vec2 uTam;
in vec2 uv;
out vec4 color;
void main() {
  vec3 c = texture(uVideo, uv).rgb;
  if (uOriginal < 0.5) {
    vec3 q = c * ((uN - 1.0) / uN) + 0.5 / uN;
    // uModo: 0 = una tabla · 1 = fondo y persona por la silueta · 2 = la de la persona en todo (sin silueta todavía)
    if (uModo > 1.5) c = texture(uLutP, q).rgb;
    else {
      c = texture(uLut, q).rgb;
      if (uModo > 0.5) {
        // el mismo umbral que el ensamblador (lut sobre la Y del video de la silueta, rango 16-235)
        float y = 16.0 + texture(uMascara, uv).r * 219.0;
        c = mix(c, texture(uLutP, q).rgb, clamp((y - 50.0) / 150.0, 0.0, 1.0));
      }
    }
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

    const tabla3D = (unidad) => {
      const tx = gl.createTexture();
      gl.activeTexture(unidad);
      gl.bindTexture(gl.TEXTURE_3D, tx);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TEXTURE_WRAP_R'].forEach((w) => gl.texParameteri(gl.TEXTURE_3D, gl[w], gl.CLAMP_TO_EDGE));
      return tx;
    };
    E.texLut = tabla3D(gl.TEXTURE1);
    E.texLutP = tabla3D(gl.TEXTURE3);          // la de la persona (looks con máscara)

    E.texMascara = gl.createTexture();         // la silueta (looks con máscara)
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, E.texMascara);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));

    gl.uniform1i(gl.getUniformLocation(prog, 'uVideo'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uLut'), 1);
    gl.uniform1i(gl.getUniformLocation(prog, 'uMascara'), 2);
    gl.uniform1i(gl.getUniformLocation(prog, 'uLutP'), 3);
    gl.uniform1f(gl.getUniformLocation(prog, 'uN'), N);
    gl.uniform1f(gl.getUniformLocation(prog, 'uCentroY'), MC.VINETA_Y);
    gl.uniform1f(gl.getUniformLocation(prog, 'uAspecto'), MC.VINETA_ASPECTO);
    E.prog = prog;
    return gl;
  }

  /* ── Tabla: revelado (medido) + look (receta + ajustes) + corrección general, una sola.
        Con un look de máscara, una segunda tabla con la receta de la persona (igual que revelado.js del ensamblador). ── */
  function cargarTabla(tx, unidad, lut) {
    const gl = E.gl;
    gl.activeTexture(unidad);
    gl.bindTexture(gl.TEXTURE_3D, tx);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, N, N, N, 0, gl.RGB, gl.FLOAT, lut);
  }
  function subirLut(r) {
    const gl = E.gl;
    const L = r.look ? MC.CATALOGO[r.look] : null;
    const P = L ? MC.ajustar(L.base, r.aj) : null;
    const Pp = L && L.persona && r.fuerza > 0 ? MC.ajustar(L.persona, r.aj) : null;
    const K = MC.correccionDe ? MC.correccionDe(r.k) : null;
    const medida = r.revelado ? E.medida : null;
    cargarTabla(E.texLut, gl.TEXTURE1, MC.generarLutCompleta(medida, P, N, r.fuerza, K));
    if (Pp) cargarTabla(E.texLutP, gl.TEXTURE3, MC.generarLutCompleta(medida, Pp, N, r.fuerza, K));
    E.hayPersona = !!Pp;
    E.angulo = P ? MC.anguloVineta(P.vineta * r.fuerza) : 0;
    gl.uniform1f(gl.getUniformLocation(E.prog, 'uAngulo'), E.angulo);
  }

  /* ══ La silueta de la persona (27-sep, looks con máscara) ══
     La saca el servidor UNA vez por video (color-silueta → ensamblador en modo «silueta») y queda junto al video.
     Aquí se reproduce escondida, al mismo segundo que el video que se pinta. Mientras no esté, la receta de la
     persona va en todo el cuadro — lo mismo que hace el ensamblador si no pudo recortar: nunca piel naranja. */
  const SIL = new Map();              // dirección S3 del video → { estado, url, video, desde, nuevo }
  const ESPERA_MAX = 8 * 60000;
  let escondite = null;
  function esconder(v) {
    if (!escondite) {
      escondite = document.createElement('div');
      escondite.setAttribute('aria-hidden', 'true');
      escondite.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1';
      document.body.appendChild(escondite);
    }
    escondite.appendChild(v);
  }
  function siluetaDe(v) {
    const url = C.urlS3 ? C.urlS3(v.currentSrc || v.src) : null;
    if (!url || !C.api) return null;
    let e = SIL.get(url);
    if (!e) {
      e = { estado: 'pidiendo', url: null, video: null, desde: Date.now(), nuevo: false };
      SIL.set(url, e);
      pedirSilueta(url, e);
    }
    return e;
  }
  async function pedirSilueta(url, e) {
    try {
      const r = await C.api.edgeFetch('color-silueta', { url });
      if (!r || !r.ok || !r.url) { e.estado = 'error'; console.warn('[Color] sin silueta:', r && r.error); return; }
      e.url = r.url;
      if (r.listo) cargarSilueta(e);
      else { e.estado = 'esperando'; setTimeout(() => sondearSilueta(e), 8000); }
    } catch (err) { e.estado = 'error'; console.warn('[Color] sin silueta:', err); }
  }
  async function sondearSilueta(e) {
    if (e.estado !== 'esperando') return;
    let hay = false;
    try { hay = (await fetch(e.url, { method: 'HEAD', cache: 'no-store' })).ok; } catch (err) { /* sigue esperando */ }
    if (hay) { cargarSilueta(e); return; }
    if (Date.now() - e.desde > ESPERA_MAX) { e.estado = 'error'; console.warn('[Color] la silueta no llegó a tiempo'); return; }
    setTimeout(() => sondearSilueta(e), 4000);
  }
  function cargarSilueta(e) {
    const sv = document.createElement('video');
    sv.crossOrigin = 'anonymous'; sv.muted = true; sv.playsInline = true; sv.preload = 'auto';
    sv.src = C.urlVideo ? C.urlVideo(e.url) : e.url;
    if (C.corsConRespaldo) C.corsConRespaldo(sv);    // si el CDN niega el permiso CORS → directo a S3
    // si tampoco carga directo de S3, se deja de esperar: la receta de la persona va en todo el cuadro
    sv.addEventListener('error', () => { const src = sv.currentSrc || sv.src; if (C.urlS3 && C.urlS3(src) === src) e.estado = 'error'; });
    esconder(sv);
    e.video = sv; e.estado = 'lista'; e.nuevo = true;
    if (sv.requestVideoFrameCallback) {
      const avisar = () => { e.nuevo = true; sv.requestVideoFrameCallback(avisar); };
      sv.requestVideoFrameCallback(avisar);
    }
  }
  /* La silueta al mismo segundo que el video: corre con él y se corrige si se aleja (saltos, cortes, vueltas) */
  function sincronizar(sv, v) {
    if (sv.readyState < 1) return;
    const dif = Math.abs(sv.currentTime - v.currentTime);
    if (v.paused) {
      if (!sv.paused) sv.pause();
      if (dif > 0.02 && !sv.seeking) sv.currentTime = v.currentTime;
      return;
    }
    if (sv.playbackRate !== v.playbackRate) sv.playbackRate = v.playbackRate;
    if (dif > 0.08 && !sv.seeking) sv.currentTime = Math.min(v.currentTime + 0.03, Math.max(0, (sv.duration || 1e9) - 0.05));
    if (sv.paused && !sv.seeking) sv.play().catch(() => null);
  }
  function soltarSilueta() {
    if (E.silActiva && !E.silActiva.paused) E.silActiva.pause();
    E.silActiva = null;
  }
  /* 0 = una tabla · 1 = con silueta · 2 = receta de la persona en todo (la silueta aún no está) */
  function modoMascara(v, gl) {
    if (!E.hayPersona) { soltarSilueta(); E.aviso = ''; return 0; }
    const e = siluetaDe(v);
    const sv = e && e.estado === 'lista' ? e.video : null;
    if (sv !== E.silActiva) { soltarSilueta(); E.silActiva = sv; E.mascaraSubida = null; }
    if (sv) sincronizar(sv, v);
    E.aviso = !e || e.estado === 'error' ? 'sin silueta: tu piel va natural en todo el cuadro'
      : e.estado === 'lista' ? (sv.readyState >= 2 ? '' : 'cargando la silueta…') : 'recortando a la persona…';
    if (!sv || sv.readyState < 2) return 2;
    if (e.nuevo || E.mascaraSubida !== sv || !sv.requestVideoFrameCallback) {
      e.nuevo = false; E.mascaraSubida = sv;
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, E.texMascara);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sv);
    }
    return 1;
  }
  function pintarAviso() {
    if (E.aviso === E.avisoPintado) return;
    E.avisoPintado = E.aviso;
    document.querySelectorAll('.js-cv-aviso').forEach((el) => { el.textContent = E.aviso ? ' · ' + E.aviso : ''; });
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
      gl.uniform1f(gl.getUniformLocation(E.prog, 'uModo'), modoMascara(v, gl));
      pintarAviso();
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
    soltarSilueta();
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
      h('div', { class: 'cv-etiqueta' }, enMov ? 'Movimiento en vivo' : E.sinWebGL ? 'Este navegador no puede mostrar el color en vivo' : 'Color en vivo · ' + nombre,
        !enMov && !E.sinWebGL && h('span', { class: 'js-cv-aviso' }, E.aviso ? ' · ' + E.aviso : '')),
      !E.sinWebGL && h('button', {
        class: 'cv-original',
        onPointerdown: mantener(true), onPointerup: mantener(false), onPointerleave: mantener(false), onPointercancel: mantener(false),
        onContextmenu: (e) => e.preventDefault(),
      }, enMov ? 'Mantén para ver sin movimiento' : 'Mantén para ver sin color')
    );
  }

  /* _estado y _cuadro: para revisar desde la consola (una pestaña oculta no corre requestAnimationFrame) */
  C.colorVivo = { activo, pantalla, sobre, pausar, fuente, original: (on) => { E.original = !!on; }, _estado: E, _siluetas: SIL, _cuadro: () => { cuadro(); cancelAnimationFrame(E.bucle); E.bucle = 0; } };
})();

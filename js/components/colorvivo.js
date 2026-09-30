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
 * · (28-sep) Tomas igualadas: un video que ya las trae (F1) no se revela otra vez; en la vista de cortes cada toma lleva
 *   su corrección (`extra.primaria`, la MISMA cuenta que F1: motor-color.js › igualarTomas).
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
    // (fase 3) «Tu referencia» es un look con su receta (motor-color.js › lookDe)
    const ref = s.look === 'referencia' && s.lookRef ? s.lookRef.receta : null;
    const look = s.look && s.look !== 'ninguno' && MC.lookDe(s.look, ref) ? s.look : null;
    const aj = {};
    MC.AJUSTES.forEach((a) => { aj[a.k] = Number(s['aj_' + a.k]) || 0; });
    const k = {};
    (MC.CORRECCION || []).forEach((a) => { k[a.k] = Number(s['cg_' + a.k]) || 0; });
    // (28-sep) zonas: fondo, piel y ropa (solo lo que se movió)
    const z = C.zonasDeEstado ? C.zonasDeEstado() : null;
    // (28-sep) HSL general (el de cada zona va dentro de z)
    const g = C.hslDeEstado ? C.hslDeEstado('general') : null;
    return { look, ref: look === 'referencia' ? ref : null, fuerza: (Number(s.lookFuerza) || 100) / 100, aj, revelado: s.revelado !== false, k, z, g, ver: verSeleccion(s) };
  }
  /* (28-sep) «Ver qué cambia»: solo con el HSL a la vista (la general o la zona abierta); el color que se está ajustando */
  function seccionHslAbierta(s) {
    const g = s.grupos && s.grupos.edicion;
    const enColor = !s.pestanas || !s.pestanas.edicion || s.pestanas.edicion === 'color';
    if (!enColor || !C.PREFIJO_HSL) return null;
    if (g === 'correccion' && s.cgVista === 'hsl') return 'general';
    if (g === 'zonas' && s.zVista === 'hsl') return C.PREFIJO_ZONA && C.PREFIJO_ZONA[s.zonaSel] ? s.zonaSel : 'piel';
    return null;
  }
  function verSeleccion(s) {
    const sec = s.hslVer ? seccionHslAbierta(s) : null;
    if (!sec) return null;
    const p = C.PREFIJO_HSL[sec], sel = s[p + 'sel'] || 'verde';
    if (sel !== 'propio' || s[p + 'propio_h'] == null) return { k: sel === 'propio' ? 'verde' : sel };
    const pr = { h: Number(s[p + 'propio_h']) };
    if (s[p + 'propio_l0'] != null && s[p + 'propio_l1'] != null) { pr.l0 = Number(s[p + 'propio_l0']); pr.l1 = Number(s[p + 'propio_l1']); }
    return { propio: pr };
  }

  /* ── Estado del lienzo (vive entre redibujos) ── */
  const E = {
    envoltura: null, lienzo: null, gl: null, prog: null, texVideo: null, texLut: null, texLutP: null, texMascara: null,
    hayPersona: false, silActiva: null, mascaraSubida: null, aviso: '', avisoPintado: null,
    extra: null, tablas: new Map(),      // (28-sep) sobre otro reproductor: { igualado, primaria() } · tablas ya hechas
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
uniform vec2 uTam, uPasoM;
in vec2 uv;
out vec4 color;
// (28-sep) la silueta como la usa el ensamblador (silueta.js › filtrosMascara): la NATURAL del recorte (el video ya
// llega 0–1), encogida 2/360 del ancho y suavizada ~3/360: la transición queda sobre el borde real, sin halo
float encogida(vec2 p) {
  return min(min(texture(uMascara, p).r, min(texture(uMascara, p + vec2(uPasoM.x, 0.0)).r, texture(uMascara, p - vec2(uPasoM.x, 0.0)).r)),
             min(texture(uMascara, p + vec2(0.0, uPasoM.y)).r, texture(uMascara, p - vec2(0.0, uPasoM.y)).r));
}
float mascaraSuave(vec2 p) {
  float s = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += encogida(p + vec2(float(i), float(j)) * uPasoM * 1.5);
  return s / 9.0;
}
void main() {
  vec3 c = texture(uVideo, uv).rgb;
  if (uOriginal < 0.5) {
    vec3 q = c * ((uN - 1.0) / uN) + 0.5 / uN;
    // uModo: 0 = una tabla · 1 = fondo y persona por la silueta · 2 = la de la persona en todo (sin silueta todavía)
    if (uModo > 1.5) c = texture(uLutP, q).rgb;
    else {
      c = texture(uLut, q).rgb;
      if (uModo > 0.5) {
        c = mix(c, texture(uLutP, q).rgb, clamp(mascaraSuave(uv), 0.0, 1.0));
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
  function cargarTabla(tx, unidad, lut, n) {
    const gl = E.gl;
    n = n || N;
    gl.activeTexture(unidad);
    gl.bindTexture(gl.TEXTURE_3D, tx);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, n, n, n, 0, gl.RGB, gl.FLOAT, lut);
    gl.uniform1f(gl.getUniformLocation(E.prog, 'uN'), n);
  }

  /* ── (28-sep) Con HSL la tabla va de 64 puntos, como en el ensamblador (motor-color.js › N_CON_HSL): mientras se mueve
        un control se ve la de 33 al instante y, un momento después, la de 64 — hecha en un obrero (Web Worker) para
        que la página no se trabe; si el navegador no deja, en el hilo principal. ── */
  const FINA = { obrero: undefined, enCurso: null, siguiente: null, reloj: 0 };
  E.finas = new Map();
  function hacerFina(d) {
    const n = MC.N_CON_HSL;
    return { lut: MC.generarLutCompleta(d.medida, d.P, n, d.fuerza, d.K, d.Zf, d.G),
             lutP: d.conPersona ? MC.generarLutCompleta(d.medida, d.Pp, n, d.fuerza, d.K, d.Zp, d.G) : null };
  }
  function obrero() {
    if (FINA.obrero !== undefined) return FINA.obrero;
    FINA.obrero = null;
    try {
      const src = (document.querySelector('script[src*="motor-color.js"]') || {}).src;
      if (!src || !window.Worker || !window.Blob) return null;
      const codigo = 'importScripts(' + JSON.stringify(src) + ');' +
        'self.onmessage=function(e){var d=e.data,M=self.CherryColor,n=M.N_CON_HSL;' +
        'var a=M.generarLutCompleta(d.medida,d.P,n,d.fuerza,d.K,d.Zf,d.G);' +
        'var b=d.conPersona?M.generarLutCompleta(d.medida,d.Pp,n,d.fuerza,d.K,d.Zp,d.G):null;' +
        'self.postMessage({clave:d.clave,lut:a,lutP:b},b?[a.buffer,b.buffer]:[a.buffer]);};';
      const ob = new Worker(URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' })));
      ob.onmessage = (e) => recibirFina(e.data.clave, e.data.lut, e.data.lutP);
      ob.onerror = (e) => { console.warn('[Color] el obrero de la tabla fina falló; va en la página', e && e.message); FINA.obrero = null; const t = FINA.enCurso; FINA.enCurso = null; if (t) { FINA.siguiente = FINA.siguiente || t; lanzarFina(); } };
      FINA.obrero = ob;
    } catch (e) { FINA.obrero = null; }
    return FINA.obrero;
  }
  function pedirFina(clave, datos) {
    if (E.finas.has(clave)) return;
    FINA.siguiente = { clave, datos };
    if (!FINA.enCurso && !FINA.reloj) FINA.reloj = setTimeout(lanzarFina, 180);
  }
  function lanzarFina() {
    FINA.reloj = 0;
    const t = FINA.siguiente; FINA.siguiente = null;
    if (!t || E.finas.has(t.clave)) return;
    if (t.clave !== E.claveLut) { return; }           // ya se movió a otra receta: esa pedirá la suya
    FINA.enCurso = t;
    const ob = obrero();
    if (ob) { try { ob.postMessage(Object.assign({ clave: t.clave }, t.datos)); return; } catch (e) { FINA.obrero = null; } }
    const r = hacerFina(t.datos);
    recibirFina(t.clave, r.lut, r.lutP);
  }
  function recibirFina(clave, lut, lutP) {
    FINA.enCurso = null;
    E.finas.set(clave, { lut, lutP });
    if (E.finas.size > 4) E.finas.delete(E.finas.keys().next().value);
    if (clave === E.claveLut && E.gl) usarFina(clave);
    if (FINA.siguiente && !FINA.reloj) FINA.reloj = setTimeout(lanzarFina, 60);
  }
  function usarFina(clave) {
    const f = E.finas.get(clave), gl = E.gl;
    if (!f) return false;
    cargarTabla(E.texLut, gl.TEXTURE1, f.lut, MC.N_CON_HSL);
    if (f.lutP) cargarTabla(E.texLutP, gl.TEXTURE3, f.lutP, MC.N_CON_HSL);
    return true;
  }
  function subirLut(r, prim, clave) {
    const gl = E.gl;
    // (28-sep) en la vista de cortes la tabla cambia en cada toma: se guardan las hechas (no se recalculan al volver)
    let hecha = E.tablas.get(clave);
    if (!hecha && r.ver) {
      // «Ver qué cambia»: lo que agarra el color escogido, en color; lo demás en gris (sin look: se ve el material)
      const medidaV = prim || (r.revelado && !r.igualado ? E.medida : null);
      hecha = { lut: MC.generarLutSeleccion(medidaV, r.ver, N), lutP: null, angulo: 0, soloZonas: false,
                cadena: { medida: medidaV, G: MC.hslDe ? MC.hslDe(r.g) : null } };
      E.tablas.set(clave, hecha);
    }
    if (!hecha) {
      const L = r.look ? MC.lookDe(r.look, r.ref) : null;
      const P = L ? MC.ajustar(L.base, r.aj) : null;
      const K = MC.correccionDe ? MC.correccionDe(r.k) : null;
      // (28-sep) zonas: la tabla del fondo lleva la zona «fondo»; la de la persona, «piel» y «ropa» (misma receta si el
      // look no trae una de persona) — lo mismo que revelado.js › escribirColor del ensamblador
      const Z = MC.zonasDe ? MC.zonasDe(r.z) : null;
      const G = MC.hslDe ? MC.hslDe(r.g) : null;          // (28-sep) HSL general
      const recetaPersona = L && L.persona && r.fuerza > 0 ? MC.ajustar(L.persona, r.aj) : null;
      const conPersona = !!(recetaPersona || Z);
      // la corrección de la toma, o el revelado de todo el video (nunca en un video que ya trae las tomas igualadas)
      const medida = prim || (r.revelado && !r.igualado ? E.medida : null);
      hecha = { lut: MC.generarLutCompleta(medida, P, N, r.fuerza, K, Z ? { fondo: Z.fondo, fondoHsl: Z.fondoHsl } : null, G),
                lutP: conPersona ? MC.generarLutCompleta(medida, recetaPersona || P, N, r.fuerza, K,
                  Z ? { piel: Z.piel, ropa: Z.ropa, pielHsl: Z.pielHsl, ropaHsl: Z.ropaHsl } : null, G) : null,
                angulo: P ? MC.anguloVineta(P.vineta * r.fuerza) : 0,
                soloZonas: !!Z && !recetaPersona,
                // lo que va antes del HSL: para escoger «Tu color» tocando el video (escogerColor)
                cadena: { medida, G },
                // con HSL: lo que necesita la tabla de 64
                fina: MC.llevaHsl && MC.llevaHsl(G, Z) ? { medida, P, Pp: recetaPersona || P, fuerza: r.fuerza, K, G, conPersona,
                  Zf: Z ? { fondo: Z.fondo, fondoHsl: Z.fondoHsl } : null,
                  Zp: Z ? { piel: Z.piel, ropa: Z.ropa, pielHsl: Z.pielHsl, ropaHsl: Z.ropaHsl } : null } : null };
      if (E.tablas.size > 40) E.tablas.clear();
      E.tablas.set(clave, hecha);
    }
    // la de 64 si ya está hecha; si no, la de 33 ya y la de 64 enseguida (pedirFina)
    if (!(hecha.fina && usarFina(clave))) {
      cargarTabla(E.texLut, gl.TEXTURE1, hecha.lut, N);
      if (hecha.lutP) cargarTabla(E.texLutP, gl.TEXTURE3, hecha.lutP, N);
      if (hecha.fina) setTimeout(() => pedirFina(clave, hecha.fina), 0);
    }
    E.hayPersona = !!hecha.lutP;
    E.soloZonas = !!hecha.soloZonas;
    E.cadena = hecha.cadena;
    E.angulo = hecha.angulo;
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
    // sin silueta todavía: Selectivo lleva la receta de la persona en todo; con solo zonas, la tabla del fondo (como el
    // ensamblador cuando no pudo recortar: no se pueden separar)
    if (!sv || sv.readyState < 2) return E.soloZonas ? 0 : 2;
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

  /* ── (28-sep, fase 3) Muestras de tu video para medirlo contra una referencia (referencia.js) ── */
  let muestreoRef = null;
  function muestraRef(v) {
    if (!v.videoWidth) return null;
    if (!muestreoRef) muestreoRef = document.createElement('canvas');
    const w = 128, hh = Math.round((v.videoHeight / v.videoWidth) * w / 2) * 2;
    muestreoRef.width = w; muestreoRef.height = hh;
    const cx = muestreoRef.getContext('2d', { willReadFrequently: true });
    cx.drawImage(v, 0, 0, w, hh);
    try { return cx.getImageData(0, 0, w, hh).data; } catch (e) { return null; }
  }
  /* lo que va antes del look en cada muestra: la corrección de su toma, o el revelado de todo el video */
  function muestrasParaReferencia() {
    const ms = E.muestrasRef || [];
    if (!ms.length) return null;
    const total = ms.reduce((a, m) => a + m.px.length, 0), px = new Uint8Array(total), cortes = [];
    let o = 0;
    ms.forEach((m) => { px.set(m.px, o); cortes.push({ hasta: o + m.px.length, m }); o += m.px.length; });
    let k = 0;
    // la corrección va aquí, pixel por pixel, porque cada muestra puede traer la suya (la de su toma)
    for (const c of cortes) {
      const med = c.m.prim || (!c.m.igualado ? E.medida : null);
      if (!med) { k = c.hasta; continue; }
      for (; k < c.hasta; k += 4) {
        const q = med.primaria ? MC.primariaColor(med, px[k] / 255, px[k + 1] / 255, px[k + 2] / 255) : MC.reveladoColor(med, px[k] / 255, px[k + 1] / 255, px[k + 2] / 255);
        px[k] = Math.round(Math.min(1, Math.max(0, q[0])) * 255); px[k + 1] = Math.round(Math.min(1, Math.max(0, q[1])) * 255); px[k + 2] = Math.round(Math.min(1, Math.max(0, q[2])) * 255);
      }
    }
    return { px, antes: null };
  }

  /* (28-sep, fase 4) Las muestras de varios momentos del video con el color de ahora (la tabla, sin la viñeta): para
     que los osciloscopios revisen todo el video, no solo el cuadro que se ve */
  function muestrasConColor() {
    const hecha = E.tablas.get(E.claveLut), lut = hecha && hecha.lut;
    if (!lut) return [];
    const n = N, f = (x) => Math.min(n - 1, Math.max(0, x * (n - 1)));
    return (E.muestrasRef || []).map((m) => {
      const d = new Uint8ClampedArray(m.px.length);
      for (let i = 0; i < d.length; i += 4) {
        const x = f(m.px[i] / 255), y = f(m.px[i + 1] / 255), z = f(m.px[i + 2] / 255);
        const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), z1 = Math.min(n - 1, z0 + 1);
        const dx = x - x0, dy = y - y0, dz = z - z0, at = (a, b, cc, k) => lut[((cc * n + b) * n + a) * 3 + k];
        for (let k = 0; k < 3; k++) {
          const c00 = at(x0, y0, z0, k) * (1 - dx) + at(x1, y0, z0, k) * dx, c10 = at(x0, y1, z0, k) * (1 - dx) + at(x1, y1, z0, k) * dx;
          const c01 = at(x0, y0, z1, k) * (1 - dx) + at(x1, y0, z1, k) * dx, c11 = at(x0, y1, z1, k) * (1 - dx) + at(x1, y1, z1, k) * dx;
          d[i + k] = Math.round(((c00 * (1 - dy) + c10 * dy) * (1 - dz) + (c01 * (1 - dy) + c11 * dy) * dz) * 255);
        }
        d[i + 3] = 255;
      }
      return { px: d, w: m.w || 128, h: Math.round(m.px.length / 4 / (m.w || 128)), t: m.t };
    });
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
        gl.uniform2f(gl.getUniformLocation(E.prog, 'uPasoM'), 2 / 360, (2 / 360) * v.videoWidth / v.videoHeight);
      }
      // (28-sep) ¿el video ya trae las tomas igualadas? ¿o esta toma lleva su corrección (vista de cortes)?
      const ext = E.externo ? E.extra : null;
      const prim = ext && ext.primaria ? ext.primaria() : null;
      const r = receta(C.state);
      r.igualado = E.externo ? !!(ext && ext.igualado) : !!C.state.fondoIgualado;
      r.toma = prim ? prim.id : null;
      // revelado: la primera muestra enseguida, luego una por segundo hasta 40 (solo si hace falta)
      const ahora = performance.now();
      if (!prim && !r.igualado && E.muestras.length < 40 && (!E.muestras.length || (!v.paused && ahora - E.ultimaMuestra > 1000))) {
        if (tomarMuestra(v)) E.ultimaMuestra = ahora;
      }
      if ((E.muestrasRef || []).length < 12 && (!E.muestrasRef || (!v.paused && ahora - (E.ultimaRef || 0) > 2000))) {
        const m = muestraRef(v); if (m) { (E.muestrasRef = E.muestrasRef || []).push({ px: m, prim: prim ? prim.valor : null, igualado: r.igualado, t: v.currentTime, w: 128 }); E.ultimaRef = ahora; }
      }
      const clave = JSON.stringify(r) + '|' + (r.revelado && !r.igualado && !prim ? E.versionMedida : 0) + '|' + (E.fuenteActual || '');
      if (clave !== E.claveLut) { subirLut(r, prim ? prim.valor : null, clave); E.claveLut = clave; }

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
      const marco = E.lienzo.parentElement;
      if (marco) marco.classList.toggle('cv-apuntando', !!C.state.hslGotero);
      gl.uniform1f(gl.getUniformLocation(E.prog, 'uModo'), modoMascara(v, gl));
      pintarAviso();
      gl.uniform1f(gl.getUniformLocation(E.prog, 'uOriginal'), E.original ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // (28-sep, fase 4) los osciloscopios leen el cuadro recién pintado (solo se puede aquí)
      if (C.osciloscopio && !E.original) C.osciloscopio.alPintar(E.lienzo);
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
  function sobre(obtenerVideo, clave, extra) {
    if (clave !== E.fuenteActual) {
      E.fuenteActual = clave; E.muestras = []; E.medida = null; E.versionMedida++; E.claveLut = ''; E.tablas.clear();
    }
    E.externo = obtenerVideo;
    E.extra = extra || null;      // (28-sep) { igualado, primaria() }
    crearLienzo();
    setTimeout(arrancar, 0);
    return E.sinWebGL ? null : E.lienzo;
  }

  /* ── Lo que se pinta dentro del celular ── */
  function pantalla(s) {
    E.externo = null; E.extra = null;
    const src = fuente(s);
    if (src !== E.fuenteActual) {                 // otro video: se vuelve a medir
      E.fuenteActual = src; E.muestras = []; E.muestrasRef = []; E.medida = null; E.versionMedida++; E.claveLut = ''; E.tablas.clear();
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
    const nombre = r.look ? MC.lookDe(r.look, r.ref).nombre : (r.revelado ? 'Solo revelado' : 'Sin color');

    const enMov = s.openCard === 'mov';
    const mantener = (on) => (e) => { e.preventDefault(); if (enMov) { if (C.movVivo) C.movVivo.sinMovimiento(on); } else E.original = on; };
    setTimeout(arrancar, 0);
    return h('div', { class: 'cv' },
      E.video,
      !E.sinWebGL && E.lienzo,
      h('div', { class: 'cv-etiqueta' + (!enMov && (s.hslGotero || r.ver) ? ' cv-etiqueta--gotero' : '') },
        enMov ? 'Movimiento en vivo' : E.sinWebGL ? 'Este navegador no puede mostrar el color en vivo'
          : s.hslGotero ? 'Toca el color que quieres cambiar' : r.ver ? 'En color: lo que cambia' : 'Color en vivo · ' + nombre,
        !enMov && !E.sinWebGL && !s.hslGotero && !r.ver && h('span', { class: 'js-cv-aviso' }, E.aviso ? ' · ' + E.aviso : '')),
      !E.sinWebGL && h('button', {
        class: 'cv-original',
        onPointerdown: mantener(true), onPointerup: mantener(false), onPointerleave: mantener(false), onPointercancel: mantener(false),
        onContextmenu: (e) => e.preventDefault(),
      }, enMov ? 'Mantén para ver sin movimiento' : 'Mantén para ver sin color')
    );
  }

  /* ══ (28-sep) HSL: escoger «Tu color» tocando el video ══
     Con el gotero encendido (C.state.hslGotero = la sección), un toque sobre el video lee el pixel ORIGINAL (7×7,
     promedio: sin el ruido de la compresión), lo pasa por lo que va antes del HSL de esa sección (el revelado o la
     corrección de la toma; en una zona, también el HSL general — el look va DESPUÉS del HSL) y guarda su tono. */
  let gota = null;
  /* un parche de lado×lado alrededor del toque (11 en un video de 720 de ancho): la lista de colores, fila por fila */
  function leerParche(v, x, y, lado) {
    if (!gota) gota = document.createElement('canvas');
    gota.width = lado; gota.height = lado;
    const cx = gota.getContext('2d', { willReadFrequently: true });
    const m = (lado - 1) / 2;
    const x0 = Math.max(0, Math.min(v.videoWidth - lado, Math.round(x - m))), y0 = Math.max(0, Math.min(v.videoHeight - lado, Math.round(y - m)));
    cx.drawImage(v, x0, y0, lado, lado, 0, 0, lado, lado);
    const d = cx.getImageData(0, 0, lado, lado).data, o = [];
    for (let i = 0; i < d.length; i += 4) o.push([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]);
    return o;
  }
  /* el punto tocado, en pixeles del video (el lienzo va «cover»: recorta los lados) */
  function puntoEnVideo(ev, v) {
    const L = E.lienzo;
    if (!L || !L.isConnected || !v.videoWidth) return null;
    const rc = L.getBoundingClientRect();
    if (ev.clientX < rc.left || ev.clientX > rc.right || ev.clientY < rc.top || ev.clientY > rc.bottom) return null;
    const vw = v.videoWidth, vh = v.videoHeight, ajuste = getComputedStyle(L).objectFit;
    let x, y;
    if (ajuste === 'fill') { x = ((ev.clientX - rc.left) / rc.width) * vw; y = ((ev.clientY - rc.top) / rc.height) * vh; }
    else {
      const esc = ajuste === 'contain' ? Math.min(rc.width / vw, rc.height / vh) : Math.max(rc.width / vw, rc.height / vh);
      x = (ev.clientX - rc.left - (rc.width - vw * esc) / 2) / esc;
      y = (ev.clientY - rc.top - (rc.height - vh * esc) / 2) / esc;
    }
    return x < 0 || y < 0 || x >= vw || y >= vh ? null : [x, y];
  }
  const aHex = (c) => '#' + c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('');
  function escogerColor(sec, v, pt) {
    const lado = Math.max(7, Math.round((v.videoWidth / 720) * 11) | 1);
    let lista;
    try { lista = leerParche(v, pt[0], pt[1], lado); }
    catch (e) { C.setState({ hslGotero: null, hslAviso: 'Este video no deja leer sus colores. Escoge uno de los 8 de arriba.' }); return; }
    const k = E.cadena || {}, G = sec === 'general' ? null : k.G || null;
    const m = MC.muestraDeColor(lista.map((c) => MC.colorAntesDeHsl(k.medida || null, G, c[0], c[1], c[2])), lado);
    // un gris, un blanco o un negro no tienen tono: el HSL casi no los mueve (a propósito: así no se mancha la pared)
    if (m.gris) {
      C.setState({ hslGotero: null, hslAviso: 'Ahí casi no hay color (es gris, blanco o negro) y el HSL no lo cambia. Toca algo con más color.' });
      return;
    }
    const p = C.PREFIJO_HSL[sec], r1 = (x) => Math.round(x * 10) / 10;
    C.setState({ [p + 'propio_h']: r1(m.h), [p + 'propio_l0']: r1(m.l0), [p + 'propio_l1']: r1(m.l1),
      [p + 'propio_hex']: aHex(MC.colorDeTono(m.h, m.L, m.croma)), [p + 'sel']: 'propio', hslGotero: null, hslAviso: '' });
  }
  let tragarClic = 0;
  document.addEventListener('pointerdown', (ev) => {
    const sec = C.state.hslGotero;
    if (!sec || !E.lienzo || E.sinWebGL) return;
    const v = E.externo ? E.externo() : E.video;
    if (!v || v.readyState < 2) return;
    const pt = puntoEnVideo(ev, v);
    if (!pt) return;
    ev.preventDefault(); ev.stopPropagation();
    tragarClic = performance.now();              // el clic que sigue no pausa el video ni abre nada
    escogerColor(sec, v, pt);
  }, true);
  document.addEventListener('click', (ev) => {
    if (tragarClic && performance.now() - tragarClic < 800) { ev.preventDefault(); ev.stopPropagation(); tragarClic = 0; }
  }, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && C.state.hslGotero) C.setState({ hslGotero: null }); });

  /* _estado y _cuadro: para revisar desde la consola (una pestaña oculta no corre requestAnimationFrame) */
  C.colorVivo = { activo, pantalla, sobre, pausar, fuente, muestrasParaReferencia, muestrasConColor, original: (on) => { E.original = !!on; }, _estado: E, _siluetas: SIL, _cuadro: () => { cuadro(); cancelAnimationFrame(E.bucle); E.bucle = 0; } };
})();

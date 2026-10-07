/* vidriogl.js — EL VIDRIO DE LOS GRÁFICOS PREMIUM, DIBUJADO POR LA TARJETA GRÁFICA (8-oct-2026, piloto)
 *
 * Sergio: «que el editor sea supremamente fluido en absolutamente todo… sin que nos aumente el costo». Medido en su
 * Proyecto 23: sin gráfico la vista previa iba a 60 cuadros por segundo y con la tarjeta de vidrio, la primera vez, a 17.
 * Lo caro era el `backdrop-filter` (el desenfoque de lo que pasa detrás, recalculado por el navegador en cada cuadro).
 *
 * Ahora la tarjeta de vidrio (premium/src/lib/Piezas.tsx › Tarjeta, en la vista previa) no lleva backdrop-filter: avisa
 * aquí dónde quedan sus 4 esquinas (con su perspectiva), su radio y su opacidad (`CherryVidrioGL.poner`). Este archivo,
 * en un lienzo WebGL justo debajo del gráfico:
 *   1. toma el cuadro que se ve (el lienzo del color, o el video si no hay color),
 *   2. lo achica a 120 px de ancho y lo desenfoca con 3 pasadas de caja (la cuenta del ensamblador: boxblur 24:3 sobre
 *      1080 = 2,2 % del ancho), saturación 1,4 y brillo -0,05 (capa.js),
 *   3. lo pinta SOLO dentro de la tarjeta (rectángulo redondeado en perspectiva, con su opacidad).
 * Todo en la tarjeta gráfica: unos pocos miles de píxeles por cuadro. El video final no cambia (lo hace el ensamblador).
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const ANCHO = 120;                 // el desenfoque se hace en chico: a 120 px de ancho
  const RADIO = 3;                   // 2,2 % de 120 ≈ 2,7 → caja de 7 (radio 3), 3 pasadas
  const V = { gl: null, lienzo: null, listo: false, falla: false, prog: {}, fb: [], tex: [], texFuente: null, vbo: null,
              reportes: new Map(), w: 0, h: 0 };

  // la tarjeta (premium-vista.js) avisa aquí en cada cuadro que dibuja
  const API = window.CherryVidrioGL = {
    activo: false,
    poner(r) { if (r && r.k) { r.recibido = performance.now(); V.reportes.set(r.k, r); } },
  };

  const VS_LLENO = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  // 1) la fuente (lienzo del color o video) a chico; la fuente viene con la fila 0 ARRIBA: se voltea
  const FS_BAJAR = `#version 300 es
precision mediump float; in vec2 vUv; out vec4 o; uniform sampler2D uTex;
void main() { o = vec4(texture(uTex, vec2(vUv.x, 1.0 - vUv.y)).rgb, 1.0); }`;
  // 2) caja separable (dir = (1/ancho, 0) o (0, 1/alto))
  const FS_CAJA = `#version 300 es
precision mediump float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;
void main() {
  vec3 s = vec3(0.0);
  for (int i = -${RADIO}; i <= ${RADIO}; i++) s += texture(uTex, vUv + uDir * float(i)).rgb;
  o = vec4(s / ${(RADIO * 2 + 1).toFixed(1)}, 1.0);
}`;
  // 3) la tarjeta: clip ya en perspectiva (w de cada esquina); vLocal en px de la placa (interpolado con perspectiva)
  const VS_TARJETA = `#version 300 es
in vec4 aClip; in vec2 aLocal; out vec2 vLocal;
void main() { vLocal = aLocal; gl_Position = aClip; }`;
  const FS_TARJETA = `#version 300 es
precision highp float; in vec2 vLocal; out vec4 o;
uniform sampler2D uTex; uniform vec2 uLienzo; uniform vec2 uTam; uniform float uR; uniform float uOp;
void main() {
  vec2 p = vLocal - uTam * 0.5, b = uTam * 0.5 - vec2(uR);
  vec2 q = abs(p) - b;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uR;
  float aa = max(fwidth(d), 0.5);
  float a = (1.0 - smoothstep(-aa, aa, d)) * uOp;
  if (a <= 0.001) discard;
  vec3 c = texture(uTex, gl_FragCoord.xy / uLienzo).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(vec3(l) + (c - vec3(l)) * 1.4 - 0.05, 0.0, 1.0);    // eq=saturation=1.4:brightness=-0.05
  o = vec4(c * a, a);                                            // premultiplicado
}`;

  function compilar(gl, vs, fs) {
    const sh = (tipo, src) => { const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function preparar() {
    if (V.listo || V.falla) return V.listo;
    try {
      const lz = document.createElement('canvas');
      lz.className = 'vidrio-gl'; lz.setAttribute('aria-hidden', 'true');
      lz.style.cssText = 'position:absolute;pointer-events:none;display:none';
      const gl = lz.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false });
      if (!gl) throw new Error('sin WebGL2');
      V.prog.bajar = compilar(gl, VS_LLENO, FS_BAJAR);
      V.prog.caja = compilar(gl, VS_LLENO, FS_CAJA);
      V.prog.tarjeta = compilar(gl, VS_TARJETA, FS_TARJETA);
      V.lleno = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, V.lleno);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      V.vbo = gl.createBuffer();
      V.texFuente = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, V.texFuente);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      V.gl = gl; V.lienzo = lz; V.listo = true;
      lz.addEventListener('webglcontextlost', (e) => { e.preventDefault(); V.listo = false; V.falla = true; API.activo = false; });
      API.activo = true;
    } catch (e) {
      console.warn('[Vidrio] sin vidrio en la tarjeta gráfica: va el de siempre', e && e.message);
      V.falla = true; API.activo = false;
    }
    return V.listo;
  }
  // los dos lienzos chicos (ping-pong) del tamaño del desenfoque
  function fbs(w, h) {
    const gl = V.gl;
    if (V.w === w && V.h === h && V.fb.length) return;
    V.fb.forEach((f) => gl.deleteFramebuffer(f)); V.tex.forEach((t) => gl.deleteTexture(t));
    V.fb = []; V.tex = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      V.fb.push(f); V.tex.push(t);
    }
    V.w = w; V.h = h;
  }
  function pasada(prog, destino, w, h, tex, uniformes) {
    const gl = V.gl;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, destino);
    gl.viewport(0, 0, w, h);
    gl.bindBuffer(gl.ARRAY_BUFFER, V.lleno);
    const a = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
    if (uniformes) uniformes(gl, prog);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function ocultar() {
    V.llave = '';
    if (V.lienzo && V.lienzo.style.display !== 'none') V.lienzo.style.display = 'none';
  }

  /* Cada cuadro, con un gráfico premium en pantalla (movvivo.js › grafPremium):
     o = { pantalla, caja (el elemento del gráfico), q (cuadro del video), L (colocar: x, y, s), alto (px de la caja),
           pieza ('tipo@desde'), t, fuente (lienzo del color o video) } */
  function cuadro(o) {
    if (!o || !o.pantalla || !preparar()) { ocultar(); return; }
    const ahora = performance.now();
    // las tarjetas de ESTE gráfico que avisaron hace poco y en este momento del video
    const tarjetas = [];
    V.reportes.forEach((r, k) => {
      if (ahora - r.recibido > 1500) { V.reportes.delete(k); return; }
      if (r.pieza === o.pieza && Math.abs(r.t - o.t) < 0.25 && r.op > 0.002) tarjetas.push(r);
    });
    if (!tarjetas.length) { ocultar(); return; }
    const gl = V.gl, lz = V.lienzo, q = o.q;
    // el lienzo cubre el cuadro del video, a la mitad de la densidad de la pantalla (el vidrio es borroso)
    const dens = Math.min(2, window.devicePixelRatio || 1) * 0.75;
    const W = Math.max(2, Math.round(q.W * dens)), H = Math.max(2, Math.round(q.H * dens));
    if (lz.width !== W || lz.height !== H) { lz.width = W; lz.height = H; }
    if (lz.parentNode !== o.pantalla || lz.nextSibling !== o.caja) o.pantalla.insertBefore(lz, o.caja);
    const st = lz.style;
    const l = q.x.toFixed(2) + 'px', t = q.y.toFixed(2) + 'px', w = q.W.toFixed(2) + 'px', h = q.H.toFixed(2) + 'px';
    if (st.left !== l) st.left = l; if (st.top !== t) st.top = t; if (st.width !== w) st.width = w; if (st.height !== h) st.height = h;
    if (st.display !== 'block') st.display = 'block';
    // solo se vuelve a pintar si cambió el cuadro del video o alguna tarjeta (el lienzo guarda lo de antes)
    const llave = W + 'x' + H + '|' + (o.tv || 0).toFixed(3) + '|' + tarjetas.map((r) => r.k + ':' + r.t.toFixed(3) + ':' + r.op.toFixed(3)).join('|') +
      '|' + o.L.x + ',' + o.L.y + ',' + o.L.s;
    if (llave === V.llave) return;
    V.llave = llave;
    // 1) la fuente → chica → desenfocada
    const fu = o.fuente;
    try {
      if (fu && fu.tagName === 'CANVAS' && C.colorVivo && C.colorVivo.pintarAhora) C.colorVivo.pintarAhora();
      gl.bindTexture(gl.TEXTURE_2D, V.texFuente);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fu);
    } catch (e) { ocultar(); return; }
    const bw = ANCHO, bh = Math.max(2, Math.round(ANCHO * q.H / q.W));
    fbs(bw, bh);
    gl.disable(gl.BLEND);
    pasada(V.prog.bajar, V.fb[0], bw, bh, V.texFuente);
    for (let i = 0; i < 3; i++) {
      pasada(V.prog.caja, V.fb[1], bw, bh, V.tex[0], (g, p) => g.uniform2f(g.getUniformLocation(p, 'uDir'), 1 / bw, 0));
      pasada(V.prog.caja, V.fb[0], bw, bh, V.tex[1], (g, p) => g.uniform2f(g.getUniformLocation(p, 'uDir'), 0, 1 / bh));
    }
    // 2) las tarjetas, en el lienzo
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const P = V.prog.tarjeta;
    gl.useProgram(P);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, V.tex[0]);
    gl.uniform1i(gl.getUniformLocation(P, 'uTex'), 0);
    gl.uniform2f(gl.getUniformLocation(P, 'uLienzo'), W, H);
    const aClip = gl.getAttribLocation(P, 'aClip'), aLocal = gl.getAttribLocation(P, 'aLocal');
    gl.bindBuffer(gl.ARRAY_BUFFER, V.vbo);
    tarjetas.forEach((r) => {
      // del dibujo (1080 × Dh) a la caja del gráfico en la pantalla (movida y escalada como la caja: colocar)
      const kx = (q.W / r.Dw) * o.L.s, ky = (o.alto / r.Dh) * o.L.s;
      const x0 = o.L.x, y0 = o.L.y;                     // la caja respecto al cuadro del video
      const loc = [[0, 0], [r.w, 0], [r.w, r.h], [0, r.h]];
      const datos = [];
      [0, 1, 2, 0, 2, 3].forEach((i) => {
        const e = r.c[i], ww = e[2];
        const sx = x0 + (r.o[0] + e[0] / ww) * kx, sy = y0 + (r.o[1] + e[1] / ww) * ky;
        const nx = (sx / q.W) * 2 - 1, ny = 1 - (sy / q.H) * 2;
        datos.push(nx * ww, ny * ww, 0, ww, loc[i][0], loc[i][1]);
      });
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aClip); gl.vertexAttribPointer(aClip, 4, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(aLocal); gl.vertexAttribPointer(aLocal, 2, gl.FLOAT, false, 24, 16);
      gl.uniform2f(gl.getUniformLocation(P, 'uTam'), r.w, r.h);
      gl.uniform1f(gl.getUniformLocation(P, 'uR'), r.r);
      gl.uniform1f(gl.getUniformLocation(P, 'uOp'), Math.max(0, Math.min(1, r.op)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
  }

  C.vidrioGL = { cuadro, ocultar, preparar };
  // se arma apenas carga: así la tarjeta ya sabe (CherryVidrioGL.activo) que no debe usar backdrop-filter
  preparar();
})();

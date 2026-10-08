/* lienzo.ts — LOS GRÁFICOS DIBUJADOS EN LIENZO (8-oct-2026, piloto con «Número gigante»)
 *
 * Sergio aprobó que los gráficos se hagan para la tarjeta gráfica: en la vista previa iban pesados porque cada gráfico era
 * una página web que el navegador repintaba en cada cuadro (y el desenfoque de movimiento la repetía 5 veces), y así
 * tampoco se pueden fabricar rápido en el navegador (medido: 191 s para una capa de 7,5 s). Aquí, lo que comparten los
 * gráficos en lienzo:
 *   · dibujo 2D: rectángulo redondeado, degradado elíptico (el radial-gradient de CSS), sombras de caja (box-shadow con su
 *     desenfoque, corrimiento y «spread»), bordes interiores (inset), el grano y el barrido de luz;
 *   · el PROYECTOR (WebGL, uno solo para toda la página): pone un lienzo 2D como placa en 3D con la MISMA perspectiva del
 *     CSS de la tarjeta de vidrio (perspective 1700 · translate3d · rotateX · rotateY · scale), con el desenfoque de
 *     movimiento por muestras (lo mismo que CameraMotionBlur, pero sin volver a dibujar la tarjeta en cada muestra).
 * Las medidas van en px del dibujo de 1080 de ancho, igual que las plantillas de siempre; `k` = px reales por px del dibujo.
 */

export type Pose = {fx: number; ty: number; rotX: number; ry: number; sc: number};
export type Esquina = [number, number, number];
export const PERSPECTIVA = 1700;

/* un punto (px, py) de una placa con origen (ox, oy) y esa pose → [X, Y, w] relativos al origen, ANTES de dividir
   (pantalla = origen + X/w). La cuenta del CSS, de derecha a izquierda: scale → rotateY → rotateX → translate → perspective */
export const proyectar = (px: number, py: number, ox: number, oy: number, n: Pose): Esquina => {
  const ax = (n.rotX * Math.PI) / 180, ay = (n.ry * Math.PI) / 180;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  let X = (px - ox) * n.sc, Y = (py - oy) * n.sc, Z = 0;
  const x1 = X * cy + Z * sy, z1 = -X * sy + Z * cy; X = x1; Z = z1;          // rotateY
  const y2 = Y * cx - Z * sx, z2 = Y * sx + Z * cx; Y = y2; Z = z2;           // rotateX
  X += n.fx; Y += n.ty;                                                        // translate3d
  return [X, Y, 1 - Z / PERSPECTIVA];                                          // perspective
};
/* las 4 esquinas (arriba-izq, arriba-der, abajo-der, abajo-izq) del rectángulo local x0..x1 × y0..y1 de una placa cuyo
   origen local (ox, oy) cae en (OX, OY) del dibujo: [X, Y, w] ABSOLUTOS antes de dividir (pantalla = X/w, Y/w) */
export const esquinasDe = (x0: number, y0: number, x1: number, y1: number, ox: number, oy: number, OX: number, OY: number, n: Pose): Esquina[] =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([px, py]) => {
    const [X, Y, w] = proyectar(px, py, ox, oy, n);
    return [OX * w + X, OY * w + Y, w] as Esquina;
  });

/* ── 2D ── */
export const lienzo = (w = 1, h = 1): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
/* pone el lienzo en ese tamaño (solo si cambió: cambiar el tamaño lo borra) y lo deja limpio, sin transformación */
export const preparar = (c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D => {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
  g.clearRect(0, 0, w, h);
  return g;
};
export const redondeado = (g: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!(g instanceof Path2D)) g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
};
/* radial-gradient(RX RY at CX CY, …) de CSS sobre la caja (x, y, w, h): elipse con centro (cx, cy) y radios (rx, ry)
   relativos a la caja; las paradas van de 0 a 1 sobre el radio (lo de después toma el último color) */
export const elipse = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  cx: number, cy: number, rx: number, ry: number, paradas: [number, string][]) => {
  if (rx <= 0 || ry <= 0) return;
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(x + cx, y + cy); g.scale(rx, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  paradas.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr;
  g.fillRect(-1e4, -1e4, 2e4, 2e4);
  g.restore();
};
/* box-shadow: 0 dy blur spread color de un rectángulo redondeado. Como en CSS, la sombra NO queda debajo de la caja
   (se recorta por fuera). El lienzo no escala las sombras con la transformación: por eso va `k`. */
export const sombra = (g: CanvasRenderingContext2D, k: number, x: number, y: number, w: number, h: number, r: number,
  dy: number, blur: number, spread: number, color: string) => {
  g.save();
  const fuera = new Path2D();
  fuera.rect(x - 4000, y - 4000, w + 8000, h + 8000);
  redondeado(fuera, x, y, w, h, r);
  g.clip(fuera, 'evenodd');
  const lejos = 20000;
  g.shadowColor = color; g.shadowBlur = blur * k; g.shadowOffsetX = lejos * k; g.shadowOffsetY = dy * k;
  redondeado(g, x - spread - lejos, y - spread, w + spread * 2, h + spread * 2, r + spread);
  g.fillStyle = '#000'; g.fill();
  g.restore();
};
/* box-shadow inset: con dy ≠ 0 una línea pegada al borde de arriba (dy > 0) o de abajo (dy < 0); con ancho > 0 el borde
   entero de ese grosor. Dentro de la forma, sin desenfoque. */
export const bordeInterior = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
  dy: number, ancho: number, color: string) => {
  g.save();
  redondeado(g, x, y, w, h, r); g.clip();
  const p = new Path2D();
  p.rect(x - 50, y - 50, w + 100, h + 100);
  if (ancho > 0) redondeado(p, x + ancho, y + ancho, w - ancho * 2, h - ancho * 2, Math.max(0, r - ancho));
  else redondeado(p, x, y + dy, w, h, r);
  g.fillStyle = color;
  g.fill(p, 'evenodd');
  g.restore();
};
/* el grano de la tarjeta (GRANO de tema.ts: ruido blanco con alfa ≈ 0,55 · ruido, en baldosas de 220): se hace una vez */
let granoC: HTMLCanvasElement | null = null;
export const grano = (): HTMLCanvasElement => {
  if (granoC) return granoC;
  const c = lienzo(220, 220);
  const g = c.getContext('2d')!;
  const im = g.createImageData(220, 220);
  let s = 12345;
  const azar = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < im.data.length; i += 4) {
    im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
    im.data[i + 3] = Math.round(255 * 0.55 * (0.25 + 0.5 * azar()));
  }
  g.putImageData(im, 0, 0);
  granoC = c;
  return c;
};
/* el barrido de luz (Brillo de Piezas): una banda inclinada 20° que cruza la caja (0..w × 0..h), en «screen» */
export const barrido = (g: CanvasRenderingContext2D, p: number, w: number, h: number, fuerza = 1) => {
  if (p <= 0 || p >= 1) return;
  const banda = Math.max(220, w * 0.42);
  const x = (-banda - h * 0.4) + (w + h * 0.4 - (-banda - h * 0.4)) * p;
  g.save();
  g.globalCompositeOperation = 'screen';
  g.translate(x + banda / 2, h / 2);
  g.rotate((20 * Math.PI) / 180);
  const gr = g.createLinearGradient(-banda / 2, 0, banda / 2, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.35, `rgba(255,255,255,${0.07 * fuerza})`);
  gr.addColorStop(0.5, `rgba(255,255,255,${0.2 * fuerza})`);
  gr.addColorStop(0.65, `rgba(255,255,255,${0.07 * fuerza})`);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(-banda / 2, -h * 1.5, banda, h * 3);
  g.restore();
};
/* medidas de una letra: el alto que usa el navegador para «line-height: normal» (ascenso + descenso) */
const medidas = new Map<string, {asc: number; desc: number}>();
export const metricas = (g: CanvasRenderingContext2D, fuente: string) => {
  let m = medidas.get(fuente);
  if (!m) {
    g.font = fuente;
    const x = g.measureText('0');
    m = {asc: x.fontBoundingBoxAscent, desc: x.fontBoundingBoxDescent};
    if (document.fonts && document.fonts.check(fuente)) medidas.set(fuente, m);
  }
  return m;
};

/* ── El proyector: UN WebGL para toda la página (los navegadores dan pocos), dibuja y se copia al lienzo 2D del gráfico ── */
const VS = `attribute vec4 aClip; attribute vec2 aUv; varying vec2 vUv; void main(){ vUv = aUv; gl_Position = aClip; }`;
const FS = `precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uAlfa;
void main(){ gl_FragColor = texture2D(uTex, vUv) * uAlfa; }`;

class Proyector {
  lienzo = lienzo(2, 2);
  gl: WebGLRenderingContext | null = null;
  prog: WebGLProgram | null = null;
  buf: WebGLBuffer | null = null;
  aClip = 0; aUv = 0; uAlfa: WebGLUniformLocation | null = null;
  texturas = new Map<HTMLCanvasElement, {tex: WebGLTexture; version: string}>();
  Dw = 1; Dh = 1;
  constructor() {
    const gl = this.lienzo.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false}) as WebGLRenderingContext | null;
    if (!gl) return;
    const sh = (tipo: number, src: string) => { const o = gl.createShader(tipo)!; gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    this.gl = gl; this.prog = p; this.buf = gl.createBuffer();
    this.aClip = gl.getAttribLocation(p, 'aClip'); this.aUv = gl.getAttribLocation(p, 'aUv'); this.uAlfa = gl.getUniformLocation(p, 'uAlfa');
    this.lienzo.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.gl = null; });
  }
  /* empieza un cuadro de Pw × Ph px reales que muestra el dibujo de Dw × Dh */
  empezar(Pw: number, Ph: number, Dw: number, Dh: number) {
    const gl = this.gl; if (!gl) return false;
    if (this.lienzo.width !== Pw || this.lienzo.height !== Ph) { this.lienzo.width = Pw; this.lienzo.height = Ph; }
    this.Dw = Dw; this.Dh = Dh;
    gl.viewport(0, 0, Pw, Ph);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND);
    return true;
  }
  /* la textura de `fuente`; solo se vuelve a subir si cambió su versión ('' = siempre) */
  textura(fuente: HTMLCanvasElement, version: string) {
    const gl = this.gl!;
    let t = this.texturas.get(fuente);
    if (!t) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      t = {tex, version: '\u0000'};
      this.texturas.set(fuente, t);
    }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    if (!version || t.version !== version) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
      t.version = version;
    }
  }
  /* pone `fuente` como placa una vez por muestra (sus 4 esquinas absolutas y su opacidad).
     modo 'suma': las muestras se suman (cada una con alfa/n: el promedio del desenfoque de movimiento);
     modo 'detras': va DEBAJO de lo que ya está dibujado (destination-over) */
  placa(fuente: HTMLCanvasElement, version: string, muestras: {c: Esquina[]; alfa: number}[], modo: 'suma' | 'detras' | 'encima') {
    const gl = this.gl; if (!gl || !this.prog || !muestras.length) return;
    this.textura(fuente, version);
    if (modo === 'suma') gl.blendFunc(gl.ONE, gl.ONE);
    else if (modo === 'detras') gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(this.aClip); gl.enableVertexAttribArray(this.aUv);
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const Dw = this.Dw, Dh = this.Dh;
    muestras.forEach(({c, alfa}) => {
      if (alfa <= 0.001) return;
      const d: number[] = [];
      [0, 1, 2, 0, 2, 3].forEach((i) => {
        const [X, Y, w] = c[i];
        d.push((X / Dw) * 2 - w, w - (Y / Dh) * 2, 0, w, uv[i][0], uv[i][1]);
      });
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.aClip, 4, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 24, 16);
      gl.uniform1f(this.uAlfa, alfa);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
  }
  /* olvida las texturas de un lienzo que ya no se usa */
  soltar(fuente: HTMLCanvasElement) {
    const t = this.texturas.get(fuente);
    if (t && this.gl) this.gl.deleteTexture(t.tex);
    this.texturas.delete(fuente);
  }
}
let proyector: Proyector | null = null;
export const elProyector = (): Proyector | null => {
  if (!proyector || !proyector.gl) proyector = new Proyector();
  return proyector.gl ? proyector : null;
};

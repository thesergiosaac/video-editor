/* escena.tsx — EL MOTOR DE LOS GRÁFICOS EN LIENZO (8-oct-2026)
 *
 * Un gráfico se describe en cada cuadro como un árbol de NODOS: cajas con su lienzo (que se pinta SOLO cuando cambia su
 * `firma`), su transform de CSS (perspective, translate, rotateX/Y/Z, scale), su opacidad, desenfoque, mezcla y recorte
 * redondeado. Lo mismo que hacían los <div> de las plantillas, pero sin repintar letras ni SVG en cada cuadro.
 *   · En el CELULAR (vista) cada nodo es un <div> con ese transform y un <canvas>: el 3D, las opacidades y los filtros los
 *     hace el navegador por su lado (no traban el video ni el audio).
 *   · En la NUBE y al fabricar en el navegador (sin 3D en CSS) un WebGL los compone con la MISMA cuenta del CSS: cada
 *     nodo es un cuadrilátero con perspectiva; los grupos (opacidad con hijos, recorte, desenfoque, mezcla, aislamiento)
 *     se arman aparte y se ponen como uno, igual que el navegador.
 * Medidas en px del dibujo de 1080 de ancho; k = px reales por px del dibujo.
 */
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, random} from 'remotion';
import {createNoise2D} from 'simplex-noise';
import {useG} from './anim';
import {lienzo, preparar} from './lienzo';

/* ── el transform, como lista: ['p', d] perspective · ['t', x, y] translate · ['t3', x, y, z] · ['rx'|'ry'|'rz', grados] · ['s', e] · ['s2', ex, ey] ── */
export type Op = ['p', number] | ['t', number, number] | ['t3', number, number, number] | ['rx', number] | ['ry', number] | ['rz', number] | ['s', number] | ['s2', number, number];
export type Nodo = {
  id: string;
  x: number; y: number; w: number; h: number;      // la caja en coordenadas del padre
  tr?: Op[]; origen?: [number, number];             // transform y transform-origin (px dentro de la caja; por defecto el centro)
  persp?: number;                                   // la propiedad perspective (la ven los hijos; origen en el centro)
  op?: number; blur?: number;                       // opacidad; filter: blur(px)
  mezcla?: 'plus-lighter' | 'screen'; aislar?: boolean;
  recorte?: number;                                 // overflow hidden con border-radius (px)
  vidrioCss?: number;                               // SOLO celular: backdrop-filter del vidrio con ese radio (sin el vidrio WebGL de la página)
  m?: number;                                       // margen del lienzo (lo que se sale de la caja)
  firma?: string; pintar?: (g: CanvasRenderingContext2D) => void;   // coords locales: (0, 0) = esquina de la caja
  fuente?: string;                                  // varios nodos pueden mostrar el MISMO lienzo (las muestras del desenfoque)
  hijos?: (Nodo | null | false | undefined)[];
};
const hijosDe = (n: Nodo) => (n.hijos || []).filter(Boolean) as Nodo[];

/* ── las letras: se espera a que estén cargadas DE VERDAD (document.fonts.check dice «sí» antes de registrarlas) ── */
export type Letra = [string, string];   // [familia, peso]
const familia = (f: string) => f.replace(/["']/g, '').split(',')[0].trim();
const letrasYa = new Set<string>();
let letrasVersion = 0;
export const letrasListas = (l: Letra[]) => {
  if (typeof document === 'undefined' || !document.fonts) return true;
  return l.every(([fam0, peso]) => {
    const fam = familia(fam0), clave = fam + '|' + peso;
    if (letrasYa.has(clave)) return true;
    let ok = false;
    document.fonts.forEach((f) => { if (!ok && f.family.replace(/["']/g, '') === fam && String(f.weight) === peso && f.status === 'loaded') ok = true; });
    if (ok) { letrasYa.add(clave); letrasVersion++; }
    return ok;
  });
};
/* en una plantilla: ¿ya llegaron las letras? Si no, espera (en la nube el cuadro no se toma hasta que estén) y vuelve a
   dibujar la plantilla entera cuando lleguen (las medidas de las letras cambian, no basta con repintar) */
export const useLetras = (l: Letra[]) => {
  const [, otraVez] = useState(0);
  const listo = letrasListas(l);
  const espera = useRef<number | null>(null);
  if (!listo && espera.current == null) {
    espera.current = delayRender('Letras del gráfico');
    esperarLetras(l, () => otraVez((v) => v + 1));
  }
  useEffect(() => {
    if (listo && espera.current != null) { const h = espera.current; espera.current = null; continueRender(h); }
  });
  return listo;
};
export const esperarLetras = (l: Letra[], listo: () => void) => {
  const t0 = Date.now();
  try { l.forEach(([fam, peso]) => { document.fonts.load(`${peso} 40px "${familia(fam)}"`).catch(() => null); }); } catch (_) { /* nada */ }
  const mirar = () => { if (letrasListas(l) || Date.now() - t0 > 15000) listo(); else setTimeout(mirar, 50); };
  mirar();
};

/* ── el ruido de @remotion/noise › noise2D (createNoise2D(() => random(semilla))), guardando TODAS las semillas: aquel
   guarda solo 10 y con más lo rehace en cada cuadro ── */
const RUIDOS = new Map<string, (x: number, y: number) => number>();
export const ruido2D = (semilla: string, x: number, y: number) => {
  let f = RUIDOS.get(semilla);
  if (!f) { f = createNoise2D(() => random(semilla)); RUIDOS.set(semilla, f); }
  return f(x, y);
};

/* ── matrices (4×4 por filas; el CSS aplica la lista de derecha a izquierda) ── */
type M4 = number[];
const I4: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a: M4, b: M4): M4 => {
  const r = new Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let q = 0; q < 4; q++) s += a[i * 4 + q] * b[q * 4 + j];
    r[i * 4 + j] = s;
  }
  return r;
};
const tras = (x: number, y: number, z = 0): M4 => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
const matOp = (o: Op): M4 => {
  const rad = (d: number) => (d * Math.PI) / 180;
  switch (o[0]) {
    case 'p': return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / o[1], 1];
    case 't': return tras(o[1], o[2]);
    case 't3': return tras(o[1], o[2], o[3]);
    case 'rx': { const c = Math.cos(rad(o[1])), s = Math.sin(rad(o[1])); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; }
    case 'ry': { const c = Math.cos(rad(o[1])), s = Math.sin(rad(o[1])); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; }
    case 'rz': { const c = Math.cos(rad(o[1])), s = Math.sin(rad(o[1])); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
    case 's': return [o[1], 0, 0, 0, 0, o[1], 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    case 's2': return [o[1], 0, 0, 0, 0, o[2], 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }
  return I4;
};
export const cssDe = (tr?: Op[]) => !tr || !tr.length ? undefined : tr.map((o) => {
  switch (o[0]) {
    case 'p': return `perspective(${o[1]}px)`;
    case 't': return `translate(${o[1]}px, ${o[2]}px)`;
    case 't3': return `translate3d(${o[1]}px, ${o[2]}px, ${o[3]}px)`;
    case 'rx': return `rotateX(${o[1]}deg)`;
    case 'ry': return `rotateY(${o[1]}deg)`;
    case 'rz': return `rotate(${o[1]}deg)`;
    case 's': return `scale(${o[1]})`;
    case 's2': return `scale(${o[1]}, ${o[2]})`;
  }
  return '';
}).join(' ');
const origenDe = (n: Nodo): [number, number] => n.origen || [n.w / 2, n.h / 2];
/* de las coordenadas del nodo a las de su padre (con la perspective del padre, si tiene) */
const localAPadre = (n: Nodo, padre: Nodo | null): M4 => {
  let m = tras(n.x, n.y);
  if (n.tr && n.tr.length) {
    const [ox, oy] = origenDe(n);
    let f = I4;
    n.tr.forEach((o) => { f = mul(f, matOp(o)); });
    m = mul(m, mul(tras(ox, oy), mul(f, tras(-ox, -oy))));
  }
  if (padre && padre.persp) {
    const px = padre.w / 2, py = padre.h / 2;
    m = mul(mul(tras(px, py), mul(matOp(['p', padre.persp]), tras(-px, -py))), m);
  }
  return m;
};
// el plano z = 0 de un nodo, aplanado en el de su padre: una homografía 3×3
type H3 = number[];
const H3de = (m: M4): H3 => [m[0], m[1], m[3], m[4], m[5], m[7], m[12], m[13], m[15]];
const mul3 = (a: H3, b: H3): H3 => {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
};
const I3: H3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/* ── los lienzos de cada contenido (se repintan solo si cambia la firma) ── */
type Fuente = {c: HTMLCanvasElement; firma: string; v: number};
type Fuentes = Map<string, Fuente>;
const pintarFuentes = (nodos: Nodo[], fuentes: Fuentes, k: number) => {
  const visto = new Set<string>();
  const ir = (n: Nodo) => {
    if (n.pintar) {
      const id = n.fuente || n.id;
      if (!visto.has(id)) {
        visto.add(id);
        let f = fuentes.get(id);
        if (!f) { f = {c: lienzo(), firma: '\u0000', v: 0}; fuentes.set(id, f); }
        const m = n.m || 0;
        const firma = `${n.firma || ''}|${n.w}|${n.h}|${m}|${k}|${letrasVersion}`;
        if (f.firma !== firma) {
          const g = preparar(f.c, (n.w + 2 * m) * k, (n.h + 2 * m) * k);
          g.setTransform(k, 0, 0, k, m * k, m * k);
          n.pintar(g);
          f.firma = firma; f.v++;
        }
      }
    }
    hijosDe(n).forEach(ir);
  };
  nodos.forEach(ir);
};

/* ══ CELULAR: cada nodo es un <div> con su transform; su <canvas> copia el lienzo de su contenido. Se arma y se actualiza
   a mano (sin React): en cada cuadro solo se escriben los estilos que cambiaron ══ */
type Vivo = {el: HTMLDivElement; cv: HTMLCanvasElement | null; estilo: Record<string, string>; hijos: Map<string, Vivo>; marca: {f: Fuente; v: number} | null};
const poner = (v: Vivo, prop: string, valor: string) => {
  if (v.estilo[prop] === valor) return;
  v.estilo[prop] = valor;
  (v.el.style as any)[prop] = valor;
};
function sincronizar(padre: HTMLElement, mapa: Map<string, Vivo>, nodos: Nodo[], fuentes: Fuentes, desde: Element | null) {
  const usados = new Set<string>();
  let antes: Element | null = desde;
  nodos.forEach((n) => {
    usados.add(n.id);
    let v = mapa.get(n.id);
    if (!v) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      v = {el, cv: null, estilo: {}, hijos: new Map(), marca: null};
      mapa.set(n.id, v);
    }
    // el orden de los hermanos es el orden de pintado
    if (v.el !== antes) padre.insertBefore(v.el, antes);
    antes = v.el.nextElementSibling;
    const m = n.m || 0;
    const [ox, oy] = origenDe(n);
    poner(v, 'left', n.x + 'px'); poner(v, 'top', n.y + 'px'); poner(v, 'width', n.w + 'px'); poner(v, 'height', n.h + 'px');
    poner(v, 'transform', cssDe(n.tr) || '');
    poner(v, 'transformOrigin', n.tr ? `${ox}px ${oy}px` : '');
    poner(v, 'perspective', n.persp ? `${n.persp}px` : '');
    poner(v, 'opacity', n.op == null ? '' : String(Math.max(0, Math.min(1, n.op))));
    poner(v, 'filter', n.blur && n.blur > 0.05 ? `blur(${n.blur.toFixed(2)}px)` : '');
    poner(v, 'mixBlendMode', n.mezcla || '');
    poner(v, 'isolation', n.aislar ? 'isolate' : '');
    poner(v, 'overflow', n.recorte != null ? 'hidden' : '');
    poner(v, 'borderRadius', n.recorte != null ? n.recorte + 'px' : n.vidrioCss != null ? n.vidrioCss + 'px' : '');
    const vidrio = n.vidrioCss != null ? 'blur(24.5px) saturate(1.4) brightness(.9)' : '';
    poner(v, 'backdropFilter', vidrio); poner(v, 'webkitBackdropFilter', vidrio);
    if (n.pintar) {
      if (!v.cv) {
        v.cv = document.createElement('canvas');
        v.cv.style.position = 'absolute';
        v.el.insertBefore(v.cv, v.el.firstChild);
      }
      const cs = v.cv.style;
      if (cs.left !== -m + 'px') { cs.left = -m + 'px'; cs.top = -m + 'px'; }
      if (cs.width !== n.w + 2 * m + 'px') cs.width = n.w + 2 * m + 'px';
      if (cs.height !== n.h + 2 * m + 'px') cs.height = n.h + 2 * m + 'px';
      const f = fuentes.get(n.fuente || n.id);
      if (f && !(v.marca && v.marca.f === f && v.marca.v === f.v)) {
        const g = preparar(v.cv, f.c.width, f.c.height);
        g.drawImage(f.c, 0, 0);
        v.marca = {f, v: f.v};
      }
    } else if (v.cv) { v.cv.remove(); v.cv = null; v.marca = null; }
    // los hijos cuelgan del mismo <div> (para que vean su perspective), después del lienzo propio
    const hs = hijosDe(n);
    if (hs.length || v.hijos.size) sincronizar(v.el, v.hijos, hs, fuentes, v.cv ? v.cv.nextElementSibling : v.el.firstElementChild);
  });
  mapa.forEach((v, id) => { if (!usados.has(id)) { v.el.remove(); mapa.delete(id); } });
}
/* ══ NUBE: el compositor WebGL ══ */
const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
const VS = `attribute vec4 aClip; attribute vec2 aUv; varying vec2 vUv; void main(){ vUv = aUv; gl_Position = aClip; }`;
const FS_TEX = PREC + `varying vec2 vUv; uniform sampler2D uTex; uniform float uAlfa; void main(){ gl_FragColor = texture2D(uTex, vUv) * uAlfa; }`;
const FS_MASCARA = PREC + `uniform vec4 uRect; uniform float uR; uniform float uAA;
void main(){ vec2 p = gl_FragCoord.xy; vec2 c = uRect.xy + uRect.zw * 0.5; vec2 q = abs(p - c) - uRect.zw * 0.5 + uR;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uR; gl_FragColor = vec4(clamp(0.5 - d / uAA, 0.0, 1.0)); }`;
const FS_BLUR = PREC + `varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uPaso; uniform float uSigma; uniform float uSalto;
void main(){ vec4 s = vec4(0.0); float tot = 0.0; float rad = ceil(uSigma * 3.0 / uSalto);
  for (int i = -40; i <= 40; i++) { float x = float(i); if (abs(x) > rad) continue; float d = x * uSalto; float w = exp(-0.5 * d * d / (uSigma * uSigma));
    s += texture2D(uTex, vUv + uPaso * d) * w; tot += w; }
  gl_FragColor = s / tot; }`;

type Destino = {fb: WebGLFramebuffer | null; pw: number; ph: number; ox: number; oy: number; k: number};
type FBO = {fb: WebGLFramebuffer; tex: WebGLTexture; pw: number; ph: number; libre: boolean};

class Compositor {
  lienzo = lienzo(2, 2);
  gl: WebGLRenderingContext | null = null;
  pTex: WebGLProgram | null = null; pMas: WebGLProgram | null = null; pBlur: WebGLProgram | null = null;
  buf: WebGLBuffer | null = null;
  texturas = new Map<HTMLCanvasElement, {tex: WebGLTexture; v: number}>();
  fbos: FBO[] = [];
  constructor() {
    const gl = this.lienzo.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false}) as WebGLRenderingContext | null;
    if (!gl) return;
    const sh = (tipo: number, src: string) => { const o = gl.createShader(tipo)!; gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const prog = (fs: string) => { const p = gl.createProgram()!; gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
    this.gl = gl; this.pTex = prog(FS_TEX); this.pMas = prog(FS_MASCARA); this.pBlur = prog(FS_BLUR); this.buf = gl.createBuffer();
    this.lienzo.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.gl = null; });
  }
  private textura(c: HTMLCanvasElement, v: number) {
    const gl = this.gl!;
    let t = this.texturas.get(c);
    if (!t) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      t = {tex, v: -1};
      this.texturas.set(c, t);
    }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    if (t.v !== v) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      t.v = v;
    }
    return t.tex;
  }
  private fbo(pw: number, ph: number): FBO {
    const gl = this.gl!;
    pw = Math.max(1, Math.ceil(pw)); ph = Math.max(1, Math.ceil(ph));
    let f = this.fbos.find((x) => x.libre && x.pw === pw && x.ph === ph);
    if (!f) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      f = {fb, tex, pw, ph, libre: true};
      this.fbos.push(f);
      if (this.fbos.length > 24) {
        // no guardar demasiados: se sueltan los libres más viejos
        const sobra = this.fbos.filter((x) => x.libre && x !== f).slice(0, this.fbos.length - 24);
        sobra.forEach((x) => { gl.deleteFramebuffer(x.fb); gl.deleteTexture(x.tex); });
        this.fbos = this.fbos.filter((x) => !sobra.includes(x));
      }
    }
    f.libre = false;
    return f;
  }
  private usar(d: Destino) {
    const gl = this.gl!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
    gl.viewport(0, 0, d.pw, d.ph);
  }
  private atributos(p: WebGLProgram, datos: number[]) {
    const gl = this.gl!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos), gl.DYNAMIC_DRAW);
    const aC = gl.getAttribLocation(p, 'aClip'), aU = gl.getAttribLocation(p, 'aUv');
    gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 4, gl.FLOAT, false, 24, 0);
    if (aU >= 0) { gl.enableVertexAttribArray(aU); gl.vertexAttribPointer(aU, 2, gl.FLOAT, false, 24, 16); }
  }
  private mezcla(m?: string) {
    const gl = this.gl!;
    gl.enable(gl.BLEND);
    if (m === 'plus-lighter') gl.blendFunc(gl.ONE, gl.ONE);
    else if (m === 'screen') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  /* un cuadrilátero: el rectángulo local (x0, y0)–(x1, y1) llevado por H al destino, con la textura tex */
  private quad(H: H3, x0: number, y0: number, x1: number, y1: number, tex: WebGLTexture, deFBO: boolean, alfa: number, mezcla: string | undefined, d: Destino) {
    const gl = this.gl!;
    if (alfa <= 0.001) return;
    this.usar(d);
    gl.useProgram(this.pTex);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(this.pTex!, 'uTex'), 0);
    gl.uniform1f(gl.getUniformLocation(this.pTex!, 'uAlfa'), Math.min(1, alfa));
    const esq = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const uv = deFBO ? [[0, 1], [1, 1], [1, 0], [0, 0]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    const datos: number[] = [];
    [0, 1, 2, 0, 2, 3].forEach((i) => {
      const [u, v] = esq[i];
      const X = H[0] * u + H[1] * v + H[2], Y = H[3] * u + H[4] * v + H[5], W = H[6] * u + H[7] * v + H[8];
      datos.push(((X - d.ox * W) * d.k / d.pw) * 2 - W, W - ((Y - d.oy * W) * d.k / d.ph) * 2, 0, W, uv[i][0], uv[i][1]);
    });
    this.atributos(this.pTex!, datos);
    this.mezcla(mezcla);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  private pantallaCompleta(p: WebGLProgram) {
    this.atributos(p, [-1, -1, 0, 1, 0, 0, 1, -1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, -1, -1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1, -1, 1, 0, 1, 0, 1]);
    this.gl!.drawArrays(this.gl!.TRIANGLES, 0, 6);
  }
  /* recorta lo dibujado en d al rectángulo redondeado (x, y, w, h, r) en coords locales del destino */
  private recortar(d: Destino, x: number, y: number, w: number, h: number, r: number) {
    const gl = this.gl!;
    this.usar(d);
    gl.useProgram(this.pMas);
    const rx = (x - d.ox) * d.k, ry = d.ph - (y - d.oy + h) * d.k;
    gl.uniform4f(gl.getUniformLocation(this.pMas!, 'uRect'), rx, ry, w * d.k, h * d.k);
    gl.uniform1f(gl.getUniformLocation(this.pMas!, 'uR'), Math.min(r, w / 2, h / 2) * d.k);
    gl.uniform1f(gl.getUniformLocation(this.pMas!, 'uAA'), 1.0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
    this.pantallaCompleta(this.pMas!);
  }
  /* desenfoque gaussiano (sigma en px reales), en dos pasadas */
  private desenfocar(f: FBO, sigma: number) {
    const gl = this.gl!;
    if (sigma < 0.3) return;
    const otro = this.fbo(f.pw, f.ph);
    const salto = Math.max(1, sigma / 13);
    const pasada = (de: FBO, a: FBO, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb); gl.viewport(0, 0, a.pw, a.ph);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.pBlur);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, de.tex);
      gl.uniform1i(gl.getUniformLocation(this.pBlur!, 'uTex'), 0);
      gl.uniform2f(gl.getUniformLocation(this.pBlur!, 'uPaso'), dx / de.pw, dy / de.ph);
      gl.uniform1f(gl.getUniformLocation(this.pBlur!, 'uSigma'), sigma);
      gl.uniform1f(gl.getUniformLocation(this.pBlur!, 'uSalto'), salto);
      gl.disable(gl.BLEND);
      this.pantallaCompleta(this.pBlur!);
    };
    pasada(f, otro, 1, 0);
    pasada(otro, f, 0, 1);
    otro.libre = true;
  }
  private grupo(n: Nodo) {
    const hs = hijosDe(n);
    return !!((hs.length && n.op != null && n.op < 0.999) || n.recorte != null || (n.blur && n.blur > 0.05) || n.aislar || (hs.length && n.mezcla));
  }
  private nodo(n: Nodo, H: H3, d: Destino, fuentes: Fuentes) {
    if (n.vidrioCss != null && !n.pintar && !hijosDe(n).length) return;
    const f = n.pintar ? fuentes.get(n.fuente || n.id) : undefined;
    const m = n.m || 0;
    const op = n.op == null ? 1 : Math.max(0, Math.min(1, n.op));
    if (op <= 0.001) return;
    if (!this.grupo(n)) {
      if (f) this.quad(H, -m, -m, n.w + m, n.h + m, this.textura(f.c, f.v), false, op, n.mezcla, d);
      hijosDe(n).forEach((h) => this.nodo(h, mul3(H, H3de(localAPadre(h, n))), d, fuentes));
      return;
    }
    const sigma = n.blur && n.blur > 0.05 ? n.blur : 0;
    const mg = Math.max(m, Math.ceil(sigma * 3)) + 2;
    const fb = this.fbo((n.w + 2 * mg) * d.k, (n.h + 2 * mg) * d.k);
    const sub: Destino = {fb: fb.fb, pw: fb.pw, ph: fb.ph, ox: -mg, oy: -mg, k: d.k};
    const gl = this.gl!;
    this.usar(sub); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (f) this.quad(I3, -m, -m, n.w + m, n.h + m, this.textura(f.c, f.v), false, 1, undefined, sub);
    hijosDe(n).forEach((h) => this.nodo(h, H3de(localAPadre(h, n)), sub, fuentes));
    if (n.recorte != null) this.recortar(sub, 0, 0, n.w, n.h, n.recorte);
    if (sigma) this.desenfocar(fb, sigma * d.k);
    this.quad(H, -mg, -mg, n.w + mg, n.h + mg, fb.tex, true, op, n.mezcla, d);
    fb.libre = true;
  }
  componer(nodos: Nodo[], Pw: number, Ph: number, k: number, fuentes: Fuentes) {
    const gl = this.gl;
    if (!gl) return false;
    if (this.lienzo.width !== Pw || this.lienzo.height !== Ph) { this.lienzo.width = Pw; this.lienzo.height = Ph; }
    const d: Destino = {fb: null, pw: Pw, ph: Ph, ox: 0, oy: 0, k};
    this.usar(d);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    nodos.forEach((n) => this.nodo(n, H3de(localAPadre(n, null)), d, fuentes));
    return true;
  }
}
let compositor: Compositor | null = null;
const elCompositor = () => {
  if (!compositor || !compositor.gl) compositor = new Compositor();
  return compositor.gl ? compositor : null;
};

/* ══ el componente: <Escena nodos={…} letras={…} /> dentro de una plantilla (ocupa el dibujo entero, 1080 × Dh) ══ */
export const Escena: React.FC<{nodos: (Nodo | null | false | undefined)[]; Dh: number; letras: Letra[]}> = ({nodos: crudos, Dh, letras}) => {
  const {vista, dibujo, esc} = useG();
  const nodos = crudos.filter(Boolean) as Nodo[];
  const kFijo = dibujo || esc;
  const yo = useRef<{k: number; fuentes: Fuentes; arbol: Map<string, Vivo>}>({k: 0, fuentes: new Map(), arbol: new Map()});
  const raiz = useRef<HTMLDivElement>(null);
  const nube = useRef<HTMLCanvasElement>(null);
  const pintar = () => {
    const s = yo.current;
    if (vista) {
      if (!s.k && raiz.current) {
        // los px que de verdad se ven (una sola vez: medir en cada cuadro obliga a la página a recalcular todo)
        const rc = raiz.current.getBoundingClientRect();
        if (rc.width > 0) s.k = Math.max(0.25, Math.min(kFijo, Math.round(((rc.width * (window.devicePixelRatio || 1)) / 1080) * 20) / 20));
      }
      const k = s.k || kFijo;
      pintarFuentes(nodos, s.fuentes, k);
      if (raiz.current) sincronizar(raiz.current, s.arbol, nodos, s.fuentes, raiz.current.firstElementChild);
    } else if (nube.current) {
      const k = kFijo;
      const Pw = Math.max(2, Math.round(1080 * k)), Ph = Math.max(2, Math.round(Dh * k));
      pintarFuentes(nodos, s.fuentes, k);
      const out = preparar(nube.current, Pw, Ph);
      const C = elCompositor();
      if (C && C.componer(nodos, Pw, Ph, k, s.fuentes)) out.drawImage(C.lienzo, 0, 0);
    }
  };
  useLayoutEffect(() => {
    letrasListas(letras);   // la plantilla espera las letras con useLetras; aquí solo se anota si ya llegaron
    pintar();
  });
  useEffect(() => {
    const otraVez = () => { yo.current.k = 0; };
    window.addEventListener('resize', otraVez);
    return () => window.removeEventListener('resize', otraVez);
  }, []);
  if (!vista) return <canvas ref={nube} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Dh}} />;
  return (
    <div ref={raiz} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Dh}} />
  );
};

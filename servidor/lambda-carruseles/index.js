/* carrete-carruseles (30-sep-2026) — el ojo de los carruseles: mira UNA foto y devuelve dónde está la persona.
 *
 * Por foto:
 *   · la silueta de la persona con Robust Video Matting (el mismo modelo de «detrás de ti», rvm.onnx). Una foto es un
 *     solo cuadro, así que se le pasa SEIS veces seguidas: el modelo recuerda el cuadro anterior y al final la
 *     silueta sale «caliente», con el pelo bien.
 *   · la cara con YuNet (yunet.onnx, 230 KB), la misma de las pruebas en el banco (detectar.py).
 *   · una rejilla chiquita (120 de ancho) con cuánta persona, cuánto detalle y cuánta luz hay en cada celda: con eso la
 *     página escoge dónde va el texto para CUALQUIER tamaño de lámina, sin volver a llamar aquí.
 *   · el recorte de la persona en PNG con transparencia (solo el rectángulo donde está, para que pese poco).
 * Nada se guarda aquí: la función «carruseles» sube el recorte y guarda el análisis.
 *
 * Evento: { accion: 'analizar', url: '<dirección firmada de la foto>' }
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ort = require('onnxruntime-node');

const FF = process.env.FFMPEG || '/opt/bin/ffmpeg';
const RVM = path.join(__dirname, 'rvm.onnx');
const YUNET = path.join(__dirname, 'yunet.onnx');
const MAX = 1600;          // lado mayor con que se trabaja (las fotos suben a 1600)
const REJ = 120;           // ancho de la rejilla

let sesRvm = null, sesCara = null;
const cargar = async () => {
  if (!sesRvm) sesRvm = await ort.InferenceSession.create(RVM, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
  if (!sesCara) sesCara = await ort.InferenceSession.create(YUNET, { executionProviders: ['cpu'] });
};
const ff = (args, ms) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout: ms || 60000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 30 });

function medidas(archivo) {
  // ffmpeg sin salida escribe las medidas en su error: «Stream ... 1080x1440»
  let err = '';
  try { execFileSync(FF, ['-hide_banner', '-i', archivo], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { err = String(e.stderr || ''); }
  const m = err.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  if (!m) throw new Error('no es una imagen que se pueda leer');
  return [Number(m[1]), Number(m[2])];
}

/* ── la cara (YuNet con entrada fija de 640×640: la foto se achica y se pega arriba a la izquierda) ── */
async function buscarCara(rgb, W, H) {
  const k = 640 / Math.max(W, H), nw = Math.round(W * k), nh = Math.round(H * k);
  const x = new Float32Array(3 * 640 * 640), N = 640 * 640;
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(H - 1, Math.floor(y / k));
    for (let xx = 0; xx < nw; xx++) {
      const sx = Math.min(W - 1, Math.floor(xx / k)), s = (sy * W + sx) * 3, d = y * 640 + xx;
      x[d] = rgb[s + 2]; x[N + d] = rgb[s + 1]; x[2 * N + d] = rgb[s];     // BGR, 0-255, como OpenCV
    }
  }
  const o = await sesCara.run({ input: new ort.Tensor('float32', x, [1, 3, 640, 640]) });
  let mejor = null;
  for (const st of [8, 16, 32]) {
    const cols = 640 / st, cl = o['cls_' + st].data, ob = o['obj_' + st].data, bb = o['bbox_' + st].data;
    for (let i = 0; i < cl.length; i++) {
      const sc = Math.sqrt(Math.min(1, Math.max(0, cl[i])) * Math.min(1, Math.max(0, ob[i])));
      if (sc < 0.7 || (mejor && sc <= mejor.sc)) continue;       // la cara más segura (la principal)
      const r = Math.floor(i / cols), c = i % cols;
      const cx = (c + bb[i * 4]) * st, cy = (r + bb[i * 4 + 1]) * st, bw = Math.exp(bb[i * 4 + 2]) * st, bh = Math.exp(bb[i * 4 + 3]) * st;
      mejor = { sc, caja: [(cx - bw / 2) / k, (cy - bh / 2) / k, bw / k, bh / k].map(Math.round) };
    }
  }
  return mejor ? mejor.caja : null;
}

exports.handler = async function (ev) {
  const t0 = Date.now();
  const dir = '/tmp/car_' + t0 + '_' + Math.random().toString(36).slice(2, 7);
  fs.mkdirSync(dir, { recursive: true });
  try {
    if (ev.accion !== 'analizar') return { ok: false, error: 'acción desconocida' };
    const url = String(ev.url || '');
    if (!/^https?:\/\//.test(url)) return { ok: false, error: 'falta la dirección de la foto' };
    const r = await fetch(url);
    if (!r.ok) return { ok: false, error: 'no pude bajar la foto (' + r.status + ')' };
    const ent = path.join(dir, 'foto');
    fs.writeFileSync(ent, Buffer.from(await r.arrayBuffer()));

    // 1 · a crudo RGB, lado mayor 1600 y medidas pares
    let [W0, H0] = medidas(ent);
    const k = Math.min(1, MAX / Math.max(W0, H0));
    const W = Math.max(2, Math.round(W0 * k / 2) * 2), H = Math.max(2, Math.round(H0 * k / 2) * 2);
    const crudo = path.join(dir, 'foto.rgb');
    ff(['-i', ent, '-frames:v', '1', '-vf', `scale=${W}:${H}:flags=lanczos`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', crudo]);
    const rgb = fs.readFileSync(crudo);
    const n = W * H;
    if (rgb.length < n * 3) return { ok: false, error: 'la foto salió incompleta' };
    await cargar();

    // 2 · la silueta: seis pasadas para que el modelo «caliente» (medido: con 6 sale más limpia)
    const src = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) { src[i] = rgb[i * 3] / 255; src[n + i] = rgb[i * 3 + 1] / 255; src[2 * n + i] = rgb[i * 3 + 2] / 255; }
    const tSrc = new ort.Tensor('float32', src, [1, 3, H, W]);
    const cero = new ort.Tensor('float32', new Float32Array(1), [1, 1, 1, 1]);
    const ratio = new ort.Tensor('float32', new Float32Array([Math.min(1, 512 / Math.max(W, H))]), [1]);
    let st = { r1: cero, r2: cero, r3: cero, r4: cero }, pha = null;
    for (let p = 0; p < 6; p++) {
      const o = await sesRvm.run({ src: tSrc, r1i: st.r1, r2i: st.r2, r3i: st.r3, r4i: st.r4, downsample_ratio: ratio });
      st = { r1: o.r1o, r2: o.r2o, r3: o.r3o, r4: o.r4o }; pha = o.pha.data;
    }
    const alfa = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const v = pha[i] * 255; alfa[i] = v < 0 ? 0 : v > 255 ? 255 : v; }

    // 3 · dónde está la persona
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alfa[y * W + x] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const persona = x1 >= 0 ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null;
    const cara = await buscarCara(rgb, W, H);

    // 4 · la rejilla: persona, detalle (bordes) y luz por celda
    const gw = REJ, gh = Math.max(1, Math.round(H * REJ / W));
    const sumA = new Float64Array(gw * gh), sumB = new Float64Array(gw * gh), sumL = new Float64Array(gw * gh), cnt = new Float64Array(gw * gh);
    const gris = new Uint8Array(n);
    for (let i = 0; i < n; i++) gris[i] = (rgb[i * 3] * 77 + rgb[i * 3 + 1] * 150 + rgb[i * 3 + 2] * 29) >> 8;
    for (let y = 1; y < H - 1; y++) {
      const cy = Math.min(gh - 1, Math.floor(y * gh / H));
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x, c = cy * gw + Math.min(gw - 1, Math.floor(x * gw / W));
        const gx = gris[i + 1] - gris[i - 1], gy = gris[i + W] - gris[i - W];
        sumA[c] += alfa[i]; sumL[c] += gris[i]; sumB[c] += (Math.abs(gx) + Math.abs(gy)) > 60 ? 1 : 0; cnt[c]++;
      }
    }
    const byte = (arr, f) => Buffer.from(Array.from(arr, (v, i) => Math.max(0, Math.min(255, Math.round(cnt[i] ? f(v / cnt[i]) : 0))))).toString('base64');
    const rejilla = { w: gw, h: gh, persona: byte(sumA, (v) => v), bordes: byte(sumB, (v) => v * 255), luz: byte(sumL, (v) => v) };

    // 5 · el recorte (solo el rectángulo de la persona, con margen) en PNG transparente
    let recorte = null;
    if (persona) {
      const m = Math.round(Math.max(W, H) * 0.02);
      const rx = Math.max(0, persona[0] - m), ry = Math.max(0, persona[1] - m);
      const rw = Math.min(W, persona[0] + persona[2] + m) - rx, rh = Math.min(H, persona[1] + persona[3] + m) - ry;
      const rgba = Buffer.allocUnsafe(rw * rh * 4);
      for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
        const s = (ry + y) * W + rx + x, d = (y * rw + x) * 4;
        rgba[d] = rgb[s * 3]; rgba[d + 1] = rgb[s * 3 + 1]; rgba[d + 2] = rgb[s * 3 + 2]; rgba[d + 3] = alfa[s];
      }
      const crudoA = path.join(dir, 'rec.rgba'), png = path.join(dir, 'rec.png');
      fs.writeFileSync(crudoA, rgba);
      ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${rw}x${rh}`, '-i', crudoA, '-frames:v', '1', '-compression_level', '9', png]);
      recorte = { x: rx, y: ry, w: rw, h: rh, png: fs.readFileSync(png).toString('base64') };
    }

    return { ok: true, w: W, h: H, persona, cara, rejilla, recorte, segundos: (Date.now() - t0) / 1000 };
  } catch (e) {
    console.log('[carruseles] falló: ' + String(e && e.message).slice(0, 300));
    return { ok: false, error: String(e && e.message).slice(0, 300) };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }
};

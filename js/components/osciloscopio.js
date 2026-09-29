/* osciloscopio.js — (28-sep-2026, fase 4 del color) Los osciloscopios de un colorista, en el editor. Sergio escogió:
   «antes de publicar, Cherry revisa cada toma con osciloscopios (negros lavados, blancos quemados, piel fuera de
   rango) y la corrige o te avisa».

   Miden lo que se VE en el celular (el cuadro ya con el color: lo que sale en el video):
   · Forma de onda: la luz de cada columna de la imagen, de abajo (negro) a arriba (blanco).
   · Vectorscopio: el color de cada pixel (el centro es gris; más lejos, más color) y la LÍNEA DE PIEL, donde cae la
     piel de cualquier persona bien coloreada.
   · Avisos con arreglo de un toque: negros lavados, blancos quemados, piel fuera de la línea (con los controles de
     siempre: la corrección general o la zona «piel», así que se ve y se deshace igual que a mano).
   · «Revisar todo el video»: los mismos avisos en cuadros de varios momentos del video.

   colorvivo.js llama `alPintar(lienzo)` justo después de pintar cada cuadro (el lienzo de WebGL solo se puede leer ahí). */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const MC = () => window.CherryColor;
  const ANCHO = 120;                         // la muestra: 120 pixeles de ancho
  const W_ONDA = 240, H_ONDA = 128, L_VEC = 128;
  const O = { caja: null, onda: null, vec: null, avisos: null, todo: null, muestra: null, ultimo: 0, avisosTxt: null };   // null: la primera medida siempre se pinta

  /* ── medir un cuadro (RGBA) ── */
  function medirCuadro(d, w, hh) {
    const M = MC(), n = w * hh;
    const histY = new Uint32Array(256);
    let quemados = 0, pielW = 0, pielA = 0, pielB = 0, pielC = 0;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      histY[y]++;
      if (Math.max(r, g, b) >= 252) quemados++;
      if (i % 3 === 0 && M) {                  // la piel: uno de cada tres (basta)
        const w0 = M.pesoPiel(r / 255, g / 255, b / 255);
        if (w0 > 0.35) {
          const lab = M.aLab(r / 255, g / 255, b / 255);
          pielW += w0; pielA += w0 * lab[1]; pielB += w0 * lab[2]; pielC += w0 * Math.hypot(lab[1], lab[2]);
        }
      }
    }
    const pct = (p) => { let a = 0; for (let k = 0; k < 256; k++) { a += histY[k]; if (a >= n * p) return k; } return 255; };
    const piel = pielW / (n / 3) > 0.01 ? { h: (Math.atan2(pielB, pielA) * 180 / Math.PI + 360) % 360, C: pielC / pielW } : null;
    return { p1: pct(0.01), p50: pct(0.5), quemados: quemados / n, piel };
  }
  /* los avisos, dichos como a una persona, cada uno con su arreglo (un control de los de siempre) */
  function avisosDe(m) {
    const s = C.state, a = [];
    if (!m) return a;
    if (m.quemados > 0.015) a.push({ k: 'blancos', t: 'Blancos quemados: el ' + (m.quemados * 100).toFixed(1).replace('.', ',') + ' % de la imagen es blanco puro, sin detalle.',
      boton: 'Bajar las luces', arreglo: { cg_luces: Math.max(-100, (Number(s.cg_luces) || 0) - 20) } });
    if (m.p1 > 30 && m.p50 < 200) a.push({ k: 'negros', t: 'Negros lavados: lo más oscuro llega apenas al ' + Math.round(m.p1 / 2.55) + ' % (se ve gris).',
      boton: 'Bajar las sombras', arreglo: { cg_sombras: Math.max(-100, (Number(s.cg_sombras) || 0) - 15) } });
    if (m.piel) {
      if (m.piel.C > 36) a.push({ k: 'piel', t: 'Piel muy saturada: puede verse naranja.', boton: 'Piel con menos color', arreglo: { zp_saturacion: Math.max(-100, (Number(s.zp_saturacion) || 0) - 20) } });
      else if (m.piel.C < 9) a.push({ k: 'piel', t: 'Piel sin color: puede verse gris.', boton: 'Piel con más color', arreglo: { zp_saturacion: Math.min(100, (Number(s.zp_saturacion) || 0) + 20) } });
      if (m.piel.h < 38) a.push({ k: 'pieltono', t: 'La piel se va hacia el rojo (fuera de la línea de piel).', boton: 'Piel más cálida', arreglo: { zp_temperatura: Math.min(100, (Number(s.zp_temperatura) || 0) + 15) } });
      else if (m.piel.h > 74) a.push({ k: 'pieltono', t: 'La piel se va hacia el amarillo (fuera de la línea de piel).', boton: 'Piel menos amarilla', arreglo: { zp_temperatura: Math.max(-100, (Number(s.zp_temperatura) || 0) - 15) } });
    }
    return a;
  }

  /* ── dibujar ── */
  function pintarOnda(ctx, d, w, hh) {
    const img = ctx.createImageData(W_ONDA, H_ONDA), cnt = new Float32Array(W_ONDA * H_ONDA);
    for (let y0 = 0; y0 < hh; y0++) for (let x0 = 0; x0 < w; x0++) {
      const i = (y0 * w + x0) * 4, Y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const x = Math.floor(x0 / w * W_ONDA), y = H_ONDA - 1 - Math.round(Y / 255 * (H_ONDA - 1));
      cnt[y * W_ONDA + x] += 1; if (x + 1 < W_ONDA) cnt[y * W_ONDA + x + 1] += 1;
    }
    const k = 255 / Math.max(4, hh / 10);
    for (let p = 0; p < cnt.length; p++) {
      const v = Math.min(255, cnt[p] * k);
      img.data[p * 4] = 255; img.data[p * 4 + 1] = 214; img.data[p * 4 + 2] = 120; img.data[p * 4 + 3] = v;
    }
    ctx.clearRect(0, 0, W_ONDA, H_ONDA);
    ctx.putImageData(img, 0, 0);
    // guías: 0, 50 y 100 % (lo que queda arriba de 100 es blanco quemado; abajo de 0, negro aplastado)
    ctx.strokeStyle = 'rgba(247,233,224,.18)'; ctx.lineWidth = 1; ctx.font = '9px DM Mono, monospace'; ctx.fillStyle = 'rgba(247,233,224,.45)';
    [[0, '100'], [0.5, '50'], [1, '0']].forEach(([f, t]) => { const y = Math.round(f * (H_ONDA - 1)) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W_ONDA, y); ctx.stroke(); ctx.fillText(t, 2, Math.min(H_ONDA - 2, Math.max(9, y - 2))); });
  }
  function pintarVector(ctx, d, w, hh) {
    const img = ctx.createImageData(L_VEC, L_VEC), S = new Float32Array(L_VEC * L_VEC * 4), c = L_VEC / 2, k = L_VEC * 0.9;
    for (let i = 0; i < w * hh; i++) {
      const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const cb = (b - Y) / 1.8556, cr = (r - Y) / 1.5748;
      const x = Math.round(c + cb * k), y = Math.round(c - cr * k);
      if (x < 0 || y < 0 || x >= L_VEC || y >= L_VEC) continue;
      const p = (y * L_VEC + x) * 4; S[p] += r; S[p + 1] += g; S[p + 2] += b; S[p + 3] += 1;
    }
    for (let p = 0; p < L_VEC * L_VEC; p++) {
      const nn = S[p * 4 + 3]; if (!nn) continue;
      // cada punto con el color de sus pixeles, un poco más vivo para que se lea
      const m = Math.max(S[p * 4], S[p * 4 + 1], S[p * 4 + 2]) / nn || 1;
      img.data[p * 4] = Math.min(255, S[p * 4] / nn / m * 255); img.data[p * 4 + 1] = Math.min(255, S[p * 4 + 1] / nn / m * 255);
      img.data[p * 4 + 2] = Math.min(255, S[p * 4 + 2] / nn / m * 255); img.data[p * 4 + 3] = Math.min(255, 70 + nn * 40);
    }
    ctx.clearRect(0, 0, L_VEC, L_VEC);
    ctx.strokeStyle = 'rgba(247,233,224,.16)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c, 2); ctx.lineTo(c, L_VEC - 2); ctx.moveTo(2, c); ctx.lineTo(L_VEC - 2, c); ctx.stroke();
    // la línea de piel: 123° (entre el rojo y el amarillo), la de cualquier colorista
    const ang = 123 * Math.PI / 180;
    ctx.strokeStyle = 'rgba(255,201,60,.75)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(ang) * (c - 3), c - Math.sin(ang) * (c - 3)); ctx.stroke(); ctx.setLineDash([]);
    const capa = document.createElement('canvas'); capa.width = L_VEC; capa.height = L_VEC; capa.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(capa, 0, 0);
  }
  function pintarAvisos(lista, destino, vacio) {
    destino.innerHTML = '';
    if (!lista.length) { destino.appendChild(h('span', { class: 'osc-ok' }, vacio)); return; }
    lista.forEach((a) => destino.appendChild(h('div', { class: 'osc-aviso' },
      h('span', null, a.t),
      a.arreglo && h('button', { class: 'aj-reset', onClick: () => C.setState(a.arreglo) }, a.boton))));
  }

  /* ── lo que llama colorvivo.js después de pintar ── */
  function alPintar(lienzo) {
    if (!O.caja || !O.caja.isConnected || !lienzo || !lienzo.width) return;
    const ahora = performance.now();
    if (ahora - O.ultimo < 350) return;
    O.ultimo = ahora;
    const w = ANCHO, hh = Math.max(2, Math.round(lienzo.height / lienzo.width * ANCHO));
    if (!O.muestra) O.muestra = document.createElement('canvas');
    O.muestra.width = w; O.muestra.height = hh;
    const cx = O.muestra.getContext('2d', { willReadFrequently: true });
    try { cx.drawImage(lienzo, 0, 0, w, hh); } catch (e) { return; }
    let d;
    try { d = cx.getImageData(0, 0, w, hh).data; } catch (e) { return; }
    pintarOnda(O.onda.getContext('2d'), d, w, hh);
    pintarVector(O.vec.getContext('2d'), d, w, hh);
    const av = avisosDe(medirCuadro(d, w, hh));
    const clave = av.map((a) => a.t).join('|');
    if (clave !== O.avisosTxt) { O.avisosTxt = clave; pintarAvisos(av, O.avisos, 'Todo en rango: negros, blancos y piel.'); }
  }

  /* ── «Revisar todo el video»: los mismos avisos en cuadros de varios momentos (colorvivo › muestras) ── */
  function revisarTodo() {
    const cv = C.colorVivo, ms = cv && cv.muestrasConColor ? cv.muestrasConColor() : [];
    if (!ms.length) { pintarAvisos([], O.todo, 'Deja correr el video unos segundos y vuelve a revisar.'); return; }
    const res = [];
    ms.forEach((m) => {
      const av = avisosDe(medirCuadro(m.px, m.w, m.h));
      av.forEach((a) => res.push({ t: (m.t != null ? C.util && C.util.fmt ? C.util.fmt(m.t) : Math.floor(m.t / 60) + ':' + String(Math.floor(m.t % 60)).padStart(2, '0') : '') + ' · ' + a.t, arreglo: a.arreglo, boton: a.boton, k: a.k }));
    });
    // un aviso por tipo (el primero): el arreglo es el mismo para todo el video
    const vistos = {}, unicos = res.filter((a) => (vistos[a.k] ? false : (vistos[a.k] = true)));
    pintarAvisos(unicos, O.todo, 'Revisé ' + ms.length + ' momentos del video: todo en rango.');
  }

  /* ── la caja (vive entre redibujos, como el lienzo del color) ── */
  function caja() {
    if (!O.caja) {
      O.onda = h('canvas', { class: 'osc-onda', width: W_ONDA, height: H_ONDA });
      O.vec = h('canvas', { class: 'osc-vec', width: L_VEC, height: L_VEC });
      O.avisos = h('div', { class: 'osc-avisos' });
      O.todo = h('div', { class: 'osc-avisos' });
      O.caja = h('div', { class: 'osc' },
        h('div', { class: 'osc-pantallas' },
          h('figure', null, O.onda, h('figcaption', null, 'Forma de onda · luz')),
          h('figure', null, O.vec, h('figcaption', null, 'Vectorscopio · color y línea de piel'))),
        O.avisos,
        h('div', { class: 'osc-todo' },
          h('button', { class: 'aj-reset', onClick: revisarTodo }, 'Revisar todo el video'),
          O.todo));
      pintarAvisos([], O.avisos, 'Pon a correr el video para medirlo.');
    }
    return O.caja;
  }

  C.osciloscopio = { caja, alPintar, medirCuadro, avisosDe };
})();

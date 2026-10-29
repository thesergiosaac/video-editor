/* media.js — zona «multimedia» (diseño "very sweet"): clips reales, guión y generar.
   La lógica de subida y de carga es la misma que tenía rail.js. */
(function () {
  const C = window.CARRETE;
  const { h } = C;
  const D = C.data;

  /* ── Extracción de audio comprimido para Whisper (se hace en el navegador) ──
     El video original sube intacto. Este audio es solo para que Whisper lo analice.
     Resultado: WAV mono 16kHz (~1.9 MB/min vs ~200 MB/min del video en 1080p)      */
  async function extractAudioForWhisper(videoFile) {
    try {
      /* Leer el video como ArrayBuffer */
      const arrayBuffer = await videoFile.arrayBuffer();

      /* Decodificar el audio — con timeout de 45s por si el navegador se traba */
      const audioCtx = new AudioContext();
      let audioBuffer;
      try {
        const decodePromise = audioCtx.decodeAudioData(arrayBuffer);
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout decodificando audio')), 45000)
        );
        audioBuffer = await Promise.race([decodePromise, timeout]);
      } finally {
        audioCtx.close();
      }

      /* Resamplear a 16kHz mono — formato óptimo para Whisper */
      const TARGET_RATE = 16000;
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(audioBuffer.duration * TARGET_RATE),
        TARGET_RATE
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start();
      const rendered = await offlineCtx.startRendering();

      /* Convertir muestras float a PCM 16-bit */
      const samples = rendered.getChannelData(0);
      const pcm16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
      }

      /* Construir archivo WAV (header estándar PCM + datos) */
      const dataBytes = pcm16.byteLength;
      const wav = new ArrayBuffer(44 + dataBytes);
      const v = new DataView(wav);
      const w = (off, s) => [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)));
      w(0,  'RIFF'); v.setUint32(4,  36 + dataBytes, true);
      w(8,  'WAVE');
      w(12, 'fmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);            /* PCM */
      v.setUint16(22, 1, true);            /* mono */
      v.setUint32(24, TARGET_RATE, true);  /* sample rate */
      v.setUint32(28, TARGET_RATE * 2, true); /* byte rate */
      v.setUint16(32, 2, true);            /* block align */
      v.setUint16(34, 16, true);           /* bits per sample */
      w(36, 'data'); v.setUint32(40, dataBytes, true);
      new Int16Array(wav, 44).set(pcm16);

      const blob = new Blob([wav], { type: 'audio/wav' });
      blob.duracion = audioBuffer.duration;   // (22-oct) la subida rápida la manda con el audio
      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      console.log(`[CARRETE] Audio extraído: ${sizeMB} MB (original: ${(videoFile.size/1024/1024).toFixed(2)} MB)`);
      return blob;
    } catch (e) {
      console.warn('[CARRETE] No se pudo extraer audio comprimido (se usará video original):', e.message);
      return null;
    }
  }

  /* ── Subida de clips ── */
  /* (22-oct) Sergio, en el iPhone: escoge 5 videos, toca el ✓ y «no sale ningún aviso… se queda cargando pero no hay nada
     que nos indique que está cargando, así que una persona normalmente se saldría de esa pantalla». El iPhone alista
     (comprime) los videos ANTES de entregárselos a la página, y con varios tarda; mientras tanto no había nada en pantalla.
     Ahora, desde que se abre el selector, la franja dice que se están preparando (s.esperandoClips) hasta que llegan
     (empieza «Subiendo…») o se cancela. Y el selector va dentro de la página: suelto, el iPhone a veces lo bota mientras
     está abierto y la subida nunca empieza. */
  let selector = null;
  function soltarSelector() { if (selector) { selector.remove(); selector = null; } }
  function dejarDeEsperar() { soltarSelector(); SUB.reemplazar = null; C.setState({ esperandoClips: false }); }
  /* (22-oct) en un video nuevo, primero «¿Qué lleva tu video?» (js/arranque.js); su botón abre el selector en el mismo toque */
  function triggerUpload() {
    const s = C.state;
    if (C.arranque && C.arranque.antesDeSubir && !(s.clips || []).length && !s.arranque) { C.arranque.antesDeSubir(abrirSelector); return; }
    abrirSelector();
  }
  function abrirSelector() {
    soltarSelector();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    selector = input;
    input.addEventListener('cancel', dejarDeEsperar);
    C.setState({ esperandoClips: true });
    input.onchange = () => {
      const files = Array.from(input.files);
      if (selector === input) soltarSelector();
      if (!files.length) { SUB.reemplazar = null; C.setState({ esperandoClips: false }); return; }
      subirArchivos(files);
    };
    input.click();
  }

  /* ── (22-oct) Subida rápida, etapa 1: ninguna subida se queda trabada en silencio ──
     Sergio subió 5 clips desde el iPhone y 2 se quedaron en «subiendo» para siempre: el motor de cortes espera a TODOS
     los clips, así que el video entero esperaba y nadie lo decía. Ahora:
     1. el clip que no sube se quita al momento (multipart-upload › quitar) y la franja ofrece «Reintentar» con los mismos
        archivos, sin escogerlos otra vez;
     2. los que quedaron trabados de antes (se salió de Cherry, la página se cerró) se intentan RESCATAR pidiendo que los
        procesen (si alcanzaron a subir, siguen solos); si no subieron, el servidor los marca «error» y la franja dice
        cuáles, con «Escoger otra vez» o «Quitarlos»;
     3. si la subida se detiene más de 30 s, la franja lo dice. */
  const SUB = { activos: new Set(), terminados: new Map(), rescatados: new Map(), fallas: [], reemplazar: null,
                subiendo: false, ultimo: 0, reloj: 0, revisando: 0, admin: null, audio: null,
                pct: new Map() };          // (29-oct) los que se están subiendo aquí y cuánto va cada uno (clipGrid)
  const RESCATE_TRAS_MS = 90000;          // terminó de subir aquí y sigue «subiendo»: no se le pidió procesarlo
  const ANTIGUO_MS = 10 * 60000;          // «subiendo» de otra vez (la página se cerró a mitad)
  const ESPERA_RESCATE_MS = 120000;       // tras pedir que lo procesen: si sigue igual, no subió
  /* (22-oct) con la subida rápida un clip queda «processed» con su audio ANTES de que llegue su video: lo que dice si su
     video llegó es `mp4_path`. Hacer la copia de un 4K tarda minutos: a esos se les da más tiempo. */
  const COPIA_TRAS_MS = 6 * 60000, COPIA_ANTIGUO_MS = 15 * 60000, COPIA_ESPERA_MS = 10 * 60000;

  /* ── (22-oct) Subida rápida, etapa 2: el AUDIO primero ──
     Apenas se crea cada clip, el celular saca su audio (16 kHz, una sola voz: ~2 MB por minuto contra cientos de MB del
     video en 4K) y lo sube; con eso la transcripción y el corte arrancan mientras el video sigue subiendo. De a uno (leer un
     video entero ocupa memoria) y los muy pesados van como siempre. Si algo falla, ese clip sigue el camino de siempre.
     (29-oct) Abierta para todos (antes solo administradores, mientras se probaba). */
  const RAPIDA_PARA_TODOS = true;
  const AUDIO_TOPE = 400 * 1048576;
  let colaAudio = Promise.resolve();
  async function subidaRapida() {
    if (RAPIDA_PARA_TODOS) return true;
    if (SUB.admin == null) { try { SUB.admin = !!(await C.api.cobroYAdmin()).admin; } catch (_) { SUB.admin = false; } }
    return SUB.admin;
  }
  function audioPrimero(file, clipId, AUD) {
    if (file.size > AUDIO_TOPE) return;
    colaAudio = colaAudio.then(async () => {
      const t0 = performance.now();
      try {
        const wav = await extractAudioForWhisper(file);
        if (!wav) return;
        const r = await C.api.subirAudioRapido(clipId, wav, wav.duracion);
        if (r && r.aplicado) { AUD.listos++; pintarAudio(); }
        console.log('[CARRETE] audio primero', file.name, Math.round(performance.now() - t0) + ' ms', r);
      } catch (e) { console.warn('[CARRETE] audio primero falló (ese clip sube como siempre):', file.name, e); }
    });
  }
  /* ── (22-oct) Subida rápida, etapa 3: los clips escogidos en ESTE aparato, para verlos mientras suben ──
     La vista rápida (cortesvivo.js) los reproduce desde el mismo celular hasta que llega la copia del servidor. Solo si este
     navegador los puede mostrar (en Windows, los .MOV del iPhone a veces no traen imagen): se prueba con sus datos. Se
     pierden al recargar la página (los archivos no se pueden volver a leer solos).
     (29-oct) De paso se saca su MINIATURA (un cuadro del archivo): Sergio subió 18 clips y «multimedia» dijo «Sin clips
     aún» hasta que terminaron todos. Ahora cada clip aparece apenas se crea, con su foto y «Subiendo». */
  C.clipsLocales = C.clipsLocales || {};
  C.miniLocal = C.miniLocal || {};
  function guardarLocal(file, clipId, rapida) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'metadata';
    let hecho = false;
    const soltar = () => {
      if (hecho) return;
      hecho = true;
      v.removeAttribute('src'); try { v.load(); } catch (_) {}
      if (C.clipsLocales[clipId] !== url) URL.revokeObjectURL(url);
    };
    v.addEventListener('loadedmetadata', () => {
      if (!(v.videoWidth > 0)) { console.log('[CARRETE] este navegador no muestra', file.name, ': se espera la copia'); soltar(); return; }
      if (rapida) { C.clipsLocales[clipId] = url; if (C.cortesVivo && C.cortesVivo.leer) C.cortesVivo.leer(true); }
      v.addEventListener('seeked', () => { fotoLocal(v, clipId); soltar(); }, { once: true });
      try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (_) { soltar(); }
    }, { once: true });
    v.addEventListener('error', soltar, { once: true });
    setTimeout(soltar, 8000);   // si el cuadro no llega (algunos celulares no lo dan sin tocar «play»), queda su color
    v.src = url;
  }
  function fotoLocal(v, clipId) {
    try {
      const alto = 240, ancho = Math.max(1, Math.round(alto * v.videoWidth / v.videoHeight));
      const cv = document.createElement('canvas'); cv.width = ancho; cv.height = alto;
      cv.getContext('2d').drawImage(v, 0, 0, ancho, alto);
      C.miniLocal[clipId] = cv.toDataURL('image/jpeg', 0.72);
      refrescar();
    } catch (e) { console.warn('[CARRETE] sin miniatura del clip', clipId, e); }
  }
  /* (29-oct) mientras suben, la lista se vuelve a leer (de a una vez aunque lleguen varios avisos juntos) */
  let relojLista = 0;
  function refrescar() {
    clearTimeout(relojLista);
    relojLista = setTimeout(() => { loadClips().catch((e) => console.warn('[CARRETE] no se pudo leer la lista de clips:', e)); }, 700);
  }
  function pctClip(id, pct) {
    SUB.pct.set(id, pct);
    document.querySelectorAll('.js-clip-pct[data-clip="' + id + '"]').forEach((el) => { el.textContent = pct + ' %'; });
  }
  function textoAudio() {
    const A = SUB.audio;
    return A && A.listos ? 'Cherry ya está armando tus cortes con el audio (' + A.listos + ' de ' + A.total + ')' : '';
  }
  function pintarAudio() {
    const t = textoAudio();
    document.querySelectorAll('.js-upload-audio').forEach((el) => { el.textContent = t; el.hidden = !t; });
  }
  async function subirArchivos(files) {
      const habia = (C.state.clips || []).length;   // (18-oct) si es el primero, se pregunta con qué arranca (js/arranque.js)
      /* Progreso por archivo — promediamos para mostrar % total */
      const total = files.length;
      const perFile = new Array(total).fill(0);
      const updateProgress = () => {
        const avg = Math.round(perFile.reduce((a, b) => a + b, 0) / files.length);
        C.state.uploadProgress = avg;
        SUB.ultimo = Date.now();
        document.querySelectorAll('.js-upload-pct-bar').forEach(el => el.style.width = avg + '%');
        document.querySelectorAll('.js-upload-pct').forEach(el => el.textContent = avg + '%');
      };

      C.setState({ esperandoClips: false, uploadingClips: true, uploadingFile: total + ' clip' + (total > 1 ? 's' : ''), uploadProgress: 0, subidaAviso: '' });
      SUB.fallas = [];
      updateProgress();
      // «Escoger otra vez»: los que quedaron trabados se quitan antes de subir los nuevos (sin rearmar: los nuevos lo harán)
      if (SUB.reemplazar) {
        const ids = SUB.reemplazar; SUB.reemplazar = null;
        try { await C.api.quitarClips(ids, false); } catch (e) { console.warn('[CARRETE] no se pudieron quitar los trabados:', e); }
      }
      // si la subida se detiene (por ejemplo, se salió de Cherry), la franja lo dice en vez de quedarse quieta
      SUB.subiendo = true; SUB.ultimo = Date.now();
      clearInterval(SUB.reloj);
      SUB.reloj = setInterval(() => {
        const quieta = SUB.subiendo && Date.now() - SUB.ultimo > 30000;
        document.querySelectorAll('.js-upload-quieta').forEach((el) => { el.hidden = !quieta; });
      }, 3000);

      /* Subir videos en paralelo controlado: máx 3 archivos a la vez (cada uno con 5 workers) */
      const newClipEntries = []; // { id, i, fileName } — guarda posición original
      const fallados = [];       // los que no subieron (los archivos, para «Reintentar»)
      const quitar = [];         // (22-oct) sus clips: se quitan para que el video no los espere
      // (22-oct) etapa 2: el audio de cada clip sube antes que su video; el clip toma su puesto desde que se crea
      const rapida = await subidaRapida();
      const porNombre = files.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      const AUD = SUB.audio = rapida ? { listos: 0, total: files.length } : null;
      const alCrear = (file) => (id) => {
        SUB.activos.add(id); SUB.pct.set(id, 0);
        guardarLocal(file, id, rapida);   // (29-oct) su miniatura y, con la subida rápida, la vista rápida
        refrescar();                      // (29-oct) aparece en «multimedia» desde ya, con «Subiendo»
        if (!rapida) return;
        C.api.ordenClip(id, habia + porNombre.indexOf(file)).catch(() => null).then(refrescar);
        audioPrimero(file, id, AUD);
      };
      const fileQueue = files.map((file, i) => ({ file, i }));
      const FILE_WORKERS = Math.min(3, files.length);
      const filePool = [];
      for (let w = 0; w < FILE_WORKERS; w++) {
        filePool.push((async () => {
          while (fileQueue.length) {
            const { file, i } = fileQueue.shift();
            let suId = null;
            try {
              const result = await C.api.uploadClipViaS3(file, (pct) => { perFile[i] = pct; updateProgress(); if (suId) pctClip(suId, pct); },
                (id) => { suId = id; alCrear(file)(id); });
              if (result && result.id) {
                newClipEntries.push({ id: result.id, i, fileName: file.name });
                SUB.activos.delete(result.id); SUB.terminados.set(result.id, Date.now());
                SUB.pct.delete(result.id); refrescar();
              }
              perFile[i] = 100;
              updateProgress();
            } catch (e) {
              /* ⚠️ Antes esto solo se escribía en la consola y la subida seguía, así que un clip
                 que fallaba desaparecía en silencio y uno creía que estaban todos. */
              console.error('[CARRETE] Error subiendo clip ' + file.name + ':', e);
              fallados.push(file);
              if (e && e.clipId) { SUB.activos.delete(e.clipId); SUB.pct.delete(e.clipId); quitar.push(e.clipId); }
            }
          }
        })());
      }
      await Promise.all(filePool);
      SUB.subiendo = false; clearInterval(SUB.reloj);
      document.querySelectorAll('.js-upload-quieta').forEach((el) => { el.hidden = true; });
      /* (22-oct) los que no subieron no dejan esperando a los demás: su clip se quita ya y el motor arma con los que sí
         están (si aún faltan transcripciones, responde «esperando» sin gastar nada) */
      if (quitar.length) {
        try { await C.api.quitarClips(quitar, true); } catch (e) { console.warn('[CARRETE] no se pudieron quitar los que no subieron:', e); }
      }

      /* Esperar a que Lambda procese los clips recién subidos (polling cada 4s, max 5 min) */
      if (newClipEntries.length > 0) {
        C.setState({ uploadingClips: true, uploadingFile: 'procesando ' + newClipEntries.length + ' clip(s)…' });
        const start = Date.now();
        while (Date.now() - start < 300000) {
          await new Promise(r => setTimeout(r, 4000));
          const clips = await C.api.getClips();
          const firma = (l) => (l || []).map((c) => c.id + c.status + (c.thumbnail_url ? '+' : '')).join('|');
          if (clips && firma(clips) !== firma(C.state.clips)) C.setState({ clips });   // (29-oct)
          const failed  = (clips || []).filter(c => newClipEntries.some(function(e){return e.id===c.id;}) && c.status === 'error').length;
          const pending = (clips || []).filter(c => newClipEntries.some(function(e){return e.id===c.id;}) && !['processed','transcribed','error'].includes(c.status)).length;
          if (pending === 0) break;
          const msg = failed > 0 ? 'procesando ' + pending + ' — ' + failed + ' fallaron' : 'procesando ' + pending + ' clip(s)…';
          document.querySelectorAll('.js-upload-pct').forEach(el => el.textContent = msg);
        }
      }

      C.setState({ uploadingClips: false, uploadProgress: 0, uploadingFile: '' });
      /* ⚠️ Si alguno no subio se DICE. Antes se perdia en la consola y uno se quedaba creyendo
         que estaban todos — que es peor que el fallo. */
      if (fallados.length) {
        SUB.fallas = fallados;   // la franja dice cuáles y ofrece «Reintentar» con estos mismos archivos (avisoSubida)
        console.warn('[CARRETE] no subieron:', fallados.map((f) => f.name));
      }

      // Auto-asignar order_index basado en el nombre de archivo para garantizar orden correcto.
      // created_at no es fiable (subidas en paralelo); file_name sí (los archivos se seleccionan en orden).
      if (newClipEntries.length > 0) {
        try {
          const allClips = await C.api.getClips();
          if (allClips && allClips.length > 0) {
            const sorted = allClips.slice().sort(function(a, b) {
              return a.file_name.localeCompare(b.file_name, undefined, { numeric: true, sensitivity: 'base' });
            });
            await C.api.saveClipOrder(sorted.map(function(c) { return c.id; }));
          }
        } catch(e) { console.warn('[CARRETE] No se pudo guardar orden:', e); }
      }

      await loadClips(); // refrescar lista
      if (C.arranque) C.arranque.alSubir(habia);
  }
  function revisarTrabados() {
    const s = C.state, ahora = Date.now();
    if (s.pantalla !== 'editor' || !C.apiReady) return;
    (s.clips || []).forEach((c) => {
      if (c.mp4_path || c.status === 'error' || SUB.activos.has(c.id) || SUB.rescatados.has(c.id)) return;
      const fin = SUB.terminados.get(c.id), sube = c.status === 'uploading';
      const espera = fin ? (sube ? RESCATE_TRAS_MS : COPIA_TRAS_MS) : (sube ? ANTIGUO_MS : COPIA_ANTIGUO_MS);
      if (ahora - (fin || Date.parse(c.created_at)) < espera) return;
      SUB.rescatados.set(c.id, ahora);
      console.log('[CARRETE] se pide procesar el clip trabado', c.file_name);
      C.api.edgeFetch('process-upload', { clip_id: c.id }).catch((e) => console.warn('[CARRETE] no se pudo pedir', c.file_name, e));
    });
    // mientras haya clips sin terminar que no se están subiendo aquí, se vuelve a mirar
    clearTimeout(SUB.revisando);
    if ((s.clips || []).some((c) => !c.mp4_path && c.status !== 'error' && !SUB.activos.has(c.id))) {
      SUB.revisando = setTimeout(() => { if (C.state.uploadingClips) revisarTrabados(); else loadClips(); }, 20000);
    }
  }
  function trabados(s) {
    const ahora = Date.now();
    return (s.clips || []).filter((c) => !SUB.activos.has(c.id) && (c.status === 'error' || (!c.mp4_path && SUB.rescatados.has(c.id) &&
      ahora - SUB.rescatados.get(c.id) > (c.status === 'uploading' ? ESPERA_RESCATE_MS : COPIA_ESPERA_MS))));
  }
  function hayAvisoSubida(s) { return !s.uploadingClips && !s.esperandoClips && (SUB.fallas.length > 0 || trabados(s).length > 0); }
  function avisoSubida(s) {
    if (!hayAvisoSubida(s)) return null;
    if (SUB.fallas.length) {
      const f = SUB.fallas, n = f.length;
      return h('div', { class: 'gen__falla', role: 'status' },
        h('b', null, n === 1 ? 'No subió ' + f[0].name : 'No subieron ' + n + ' clips'),
        h('span', null, (n > 1 ? f.map((x) => x.name).join(', ') + '. ' : '') + 'Los demás siguen sin esperarlos. Puedes volver a intentarlo.'),
        h('div', { class: 'gen__falla-bts' },
          h('button', { type: 'button', class: 'gen__bt gen__bt--fuerte', onClick: () => { SUB.fallas = []; subirArchivos(f); } }, 'Reintentar'),
          h('button', { type: 'button', class: 'gen__bt', onClick: () => { SUB.fallas = []; C.setState({}); } }, 'Dejarlos así')));
    }
    const t = trabados(s), n = t.length;
    return h('div', { class: 'gen__falla', role: 'status' },
      h('b', null, n === 1 ? t[0].file_name + ' no terminó de subir' : n + ' clips no terminaron de subir'),
      h('span', null, (n > 1 ? t.map((c) => c.file_name).join(', ') + '. ' : '') +
        'Tu video los está esperando: escógelos otra vez para terminar de subirlos, o quítalos y sigue con los demás.'),
      h('div', { class: 'gen__falla-bts' },
        h('button', { type: 'button', class: 'gen__bt gen__bt--fuerte', onClick: () => { SUB.reemplazar = t.map((c) => c.id); abrirSelector(); } }, 'Escoger otra vez'),
        h('button', { type: 'button', class: 'gen__bt', onClick: () => quitarTrabados(t) }, n === 1 ? 'Quitarlo' : 'Quitarlos')));
  }
  async function quitarTrabados(t) {
    try { await C.api.quitarClips(t.map((c) => c.id), true); }
    catch (e) { C.setState({ subidaAviso: 'No se pudieron quitar. Prueba otra vez en un momento.' }); return; }
    await loadClips();
  }

  /* ── Cargar clips desde Supabase ── */
  async function loadClips() {
    if (!C.apiReady) return;
    const clips = await C.api.getClips();
    C.setState({ clips: clips || [] });
    revisarTrabados();   // (22-oct) los que quedaron trabados: rescatarlos o decir cuáles
  }

  /* ── Cargar guión desde Supabase ── */
  async function loadScript() {
    if (!C.apiReady) return;
    const text = await C.api.getScript();
    if (text) C.setState({ scriptText: text }, { render: false });
  }

  /* ── Al estar lista la sesión: cargar el proyecto activo ── */
  C.onApiReady.push(() => C.cargarProyecto());

  /* ── Al entrar: proyectos y perfil para la barra superior ── */
  async function loadCuenta() {
    if (!C.apiReady) return;
    try {
      const [lista, perfil] = await Promise.all([C.api.getProjects(), C.api.getPerfil()]);
      C.setState({ projects: Array.isArray(lista) ? lista : [], perfil: perfil || null });
    } catch (e) { console.warn('[CARRETE] No se pudo cargar la cuenta:', e); }
  }
  C.onApiReady.push(loadCuenta);

  /* Cargar todo lo del proyecto activo (al entrar o al cambiar de proyecto) */
  /* (6-oct) FABRICAR AL FINAL: el proyecto ya no se abre «con su video hecho» en el celular. Se abre SIEMPRE en la vista
     previa en vivo (cortesvivo.js) con los controles como los dejaste: primero como se hizo su último video y encima el
     borrador, si es más nuevo. El último video fabricado lo lleva js/fabricar.js (Descargar ya, o fabricar otra versión). */
  C.cargarProyecto = async function () {
    const pid = C.session && C.session.projectId;
    if (C.fabricar) C.fabricar._B.listo = false;           // mientras carga, el borrador no se toca
    const [prev, borr] = await Promise.all([C.api.getLatestRender(),
      pid && C.api.leerBorrador ? C.api.leerBorrador(pid).catch(() => null) : null,
      loadClips(), loadScript(), C.pantallas ? C.pantallas.cargar() : null]);
    if (C.session.projectId !== pid) return;
    if (prev && prev.status === 'done' && prev.output_url) {
      // los controles quedan como se hizo ESE video (color, plantilla, tamaño, posición)
      C.restaurarDeRender(prev.subtitle_config);
    }
    const conBorrador = C.fabricar ? C.fabricar.aplicarBorrador(borr, prev && prev.status === 'done' ? prev : null) : false;
    /* (6-oct) los originales ya se borraron (15 días después de fabricar, servidor/sql/21-limpieza.sql): no hay vista previa
       posible; el celular muestra el video terminado y la franja lo explica */
    const sinOriginales = !!(borr && borr.originales_borrados);
    if (C.fabricar) C.fabricar._F.sinOriginales = sinOriginales ? borr.originales_borrados : null;
    if (sinOriginales && prev && prev.status === 'done' && prev.output_url) {
      const url = prev.layer2_url && /^https:/.test(prev.layer2_url) ? prev.layer2_url : prev.output_url;
      C.setState({ phase: 'done', renderUrl: url, downloadUrl: url, renderId: prev.id || null, fondoPrevia: null });
      if (C.fabricar) { C.fabricar.borradorListo(); C.fabricar.alAbrir(); }
      return;
    }
    // fondoPrevia: el fondo de la muestra de plantillas (Texto)
    C.setState({ phase: 'idle', renderUrl: null, downloadUrl: null, renderId: null,
      fondoPrevia: (prev && prev.video_sin_subtitulos) || null, fondoIgualado: !!prev && (prev.igualado === true || prev.igualado === 'true') });
    if (conBorrador) console.log('[CARRETE] Borrador del proyecto aplicado');
    if (C.fabricar) { C.fabricar.borradorListo(); C.fabricar.alAbrir(); }
  };

  /* ── Cuadrícula de clips con arrastrar para reordenar ── */
  let dragSrcIdx = null;

  function duracion(sec) {
    return sec ? C.util.fmtTime(sec).replace(/^0(\d:)/, '$1') : '';
  }

  function clipGrid() {
    const clips = C.state.clips || [];
    const malos = new Set(trabados(C.state).map((c) => c.id));   // (22-oct) los que no terminaron de subir
    const celdas = clips.map((clip, i) => {
      /* (29-oct) el que se está subiendo aquí: su foto (del archivo, mientras llega la del servidor) con «Subiendo» y
         cuánto va; no se arrastra ni se quita hasta que termine */
      const sube = SUB.pct.has(clip.id), foto = clip.thumbnail_url || C.miniLocal[clip.id];
      return h('div', {
        class: 'clip' + (sube ? ' clip--sube' : ''),
        draggable: !sube,
        title: clip.file_name,
        onDragStart: (e) => {
          dragSrcIdx = i;
          e.dataTransfer.effectAllowed = 'move';
          e.currentTarget.style.opacity = '0.45';
        },
        onDragEnd: (e) => {
          e.currentTarget.style.opacity = '';
          document.querySelectorAll('.clip--over').forEach((el) => el.classList.remove('clip--over'));
        },
        onDragOver: (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          e.currentTarget.classList.add('clip--over');
        },
        onDragLeave: (e) => e.currentTarget.classList.remove('clip--over'),
        onDrop: async (e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('clip--over');
          const destIdx = i;
          if (dragSrcIdx === null || dragSrcIdx === destIdx) return;
          const newClips = [...C.state.clips];
          const [moved] = newClips.splice(dragSrcIdx, 1);
          newClips.splice(destIdx, 0, moved);
          dragSrcIdx = null;
          C.setState({ clips: newClips });
          C.api.saveClipOrder(newClips.map((c) => c.id)).catch((err) => console.warn('Error guardando orden:', err));
        },
      },
        foto
          ? C.imgFija('clip-' + clip.id, foto, { class: 'clip__img', alt: '' })
          : h('div', { class: 'clip__fill', style: { background: D.clipTones[i % D.clipTones.length] } }),
        malos.has(clip.id) ? h('div', { class: 'clip__mal', title: 'No terminó de subir' }, '!')
          : sube ? h('div', { class: 'clip__proc clip__proc--sube' }, h('span', { class: 'spinner' }),
              h('span', { class: 'clip__sube' }, 'Subiendo', h('b', { class: 'js-clip-pct', 'data-clip': clip.id }, (SUB.pct.get(clip.id) || 0) + ' %')))
          : !['processed', 'transcribed'].includes(clip.status) && h('div', { class: 'clip__proc' }, h('span', { class: 'spinner' })),
        h('span', { class: 'clip__tag clip__tag--n' }, String(i + 1).padStart(2, '0')),
        h('span', { class: 'clip__tag clip__tag--dur' },
          duracion(clip.duration_sec) || (clip.file_name.length > 10 ? clip.file_name.substring(0, 8) + '…' : clip.file_name)),
        !sube && h('button', { class: 'clip__del', title: 'Quitar clip', onClick: (e) => { e.stopPropagation(); deleteClip(clip.id); } }, '✕')
      );
    });
    celdas.push(h('button', { class: 'clip-add', title: 'Subir clips', onClick: triggerUpload }, '＋'));
    return h('div', { class: 'clips', 'data-scroll': 'clips' }, celdas);
  }

  /* ── Franja de generar: subiendo / listo para generar / generando / terminado ── */
  function genStrip() {
    const s = C.state;

    /* ⚠️ Los clips que no subieron. El editor no tiene avisos, así que va donde ya se mira, y se
       queda hasta que se toca: un fallo que se borra solo es un fallo que nadie lee. */
    const aviso = !s.subidaAviso ? avisoSubida(s) : h('div', {
          class: 'gen__meta',
          style: { marginBottom: '11px', padding: '9px 12px', borderRadius: '12px',
                   cursor: 'pointer', background: 'rgba(255,201,60,.09)',
                   border: '1px solid rgba(255,201,60,.3)', color: 'var(--amber)',
                   lineHeight: '1.45' },
          title: 'Tocar para quitar el aviso',
          onClick: () => C.setState({ subidaAviso: '' }),
        }, s.subidaAviso);

    /* (22-oct) del ✓ del selector hasta que el celular entrega los videos (ver triggerUpload) */
    if (s.esperandoClips && !s.uploadingClips) {
      const cel = window.matchMedia('(max-width:760px)').matches;
      return [
        aviso,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' } },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen__title' }, cel ? 'Preparando tus videos…' : 'Escoge tus clips…')
        ),
        h('div', { class: 'gen__nota' }, cel
          ? 'Tu celular los alista antes de subirlos; con varios videos puede tardar un rato. No salgas de esta pantalla: apenas estén, empiezan a subir.'
          : 'En la ventana que se abrió. Apenas los escojas, empiezan a subir.'),
        h('button', { type: 'button', class: 'gen__mano-btn gen__no', onClick: dejarDeEsperar }, 'No escogí ninguno')
      ];
    }

    if (s.uploadingClips) {
      const revisando = /^procesando/.test(s.uploadingFile || '');
      return [
        aviso,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' } },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen__title' }, revisando ? 'Cherry está revisando tus clips…' : 'Subiendo ' + (s.uploadingFile || 'clips') + '…')
        ),
        h('div', { class: 'bar' }, h('i', { class: 'js-upload-pct-bar', style: { width: (s.uploadProgress || 0) + '%' } })),
        h('div', { class: 'gen__meta' }, h('span', { class: 'js-upload-pct' }, (s.uploadProgress || 0) + '%')),
        h('div', { class: 'gen__nota gen__audio js-upload-audio', hidden: textoAudio() ? null : 'hidden' }, textoAudio()),
        h('div', { class: 'gen__nota' }, 'No salgas de esta pantalla hasta que terminen.'),
        h('div', { class: 'gen__nota gen__quieta js-upload-quieta', hidden: 'hidden' },
          'La subida está detenida. Si saliste de Cherry, quédate en esta pantalla: sigue sola.')
      ];
    }

    /* (8-oct) las tomas recortadas en Manual mandan sobre los ajustes de corte de aquí (y los clips nuevos no entran solos) */
    const mano = s.tomasMano && C.cortesVivo && C.cortesVivo.tomas ? h('div', { class: 'gen__meta gen__mano' },
      h('span', null, '✎ Tus tomas van recortadas a mano (Manual): los ajustes de corte de aquí y los clips nuevos no las cambian.'),
      h('button', { type: 'button', class: 'gen__mano-btn', onClick: () => C.cortesVivo.tomas.soltar() }, '↺ Volver a las de Cherry')) : null;

    /* (6-oct) fabricar al final: ya no hay «generar video»: se ve en vivo y se fabrica al Descargar o Publicar */
    if (C.fabricar && (s.phase === 'idle' || C.fabricar._F.sinOriginales)) return [aviso, mano, C.fabricar.franja(s)];

    if (s.phase === 'idle') {
      const hasClips = (s.clips || []).length > 0;
      return [
        aviso,
        h('button', {
          class: 'btn-generate' + (hasClips ? '' : ' btn-generate--off'),
          onClick: hasClips ? () => C.actions.generate() : null,
          title: hasClips ? '' : 'Sube al menos un clip primero',
        }, 'generar video'),
        h('div', { class: 'gen__meta' },
          h('span', null, hasClips ? 'Tiempo est. ~40s' : 'Sube al menos un clip primero'),
          h('span', { style: { color: 'var(--amber)' } }, '◆ 12 créditos'))
      ];
    }

    if (s.phase === 'rendering') {
      return [
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' } },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen__title' }, 'Editando con IA…')
        ),
        h('div', { class: 'bar' }, h('i', { class: 'js-render-bar', style: { width: s.renderProgress + '%' } })),
        h('div', { class: 'gen__meta' },
          h('span', { class: 'js-render-stage' }, C.util.renderStage(s.renderProgress)),
          h('span', { class: 'js-render-pct' }, Math.round(s.renderProgress) + '%'))
      ];
    }

    /* terminado */
    return [
      h('div', { class: 'hand', style: { fontSize: '24px', color: 'var(--teal)', marginBottom: '10px' } }, '¡tu video está listo!'),
      h('button', { class: 'btn btn--result', onClick: () => C.actions.openEditor() }, '✎ Editar resultado'),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn--ghost', title: 'Volver a empezar', style: { width: 'auto', padding: '12px 15px' }, onClick: () => C.actions.resetRender() }, '↺'),
        // Descargar SIEMPRE da el video tal como se ve: si hay cambios, el render adelantado los aplica en segundo plano
        C.adelantado
          ? h('span', { class: 'js-ad-descargar ad-zona' }, C.adelantado.botonDescargar(s))
          : (s.downloadUrl
            ? h('a', { class: 'btn btn--download', href: C.urlVideo(s.downloadUrl), download: 'video-cherry.mp4', target: '_blank', rel: 'noopener' }, 'Descargar')
            : h('span', { class: 'btn btn--download btn--wait' }, h('span', { class: 'spinner' }), 'Preparando HD…')),
        // (24-sep) Publicar lleva al Calendario con este video (antes no hacía nada)
        C.adelantado && C.adelantado.botonPublicar
          ? h('span', { class: 'js-ad-publicar ad-zona ad-zona--publicar' }, C.adelantado.botonPublicar(s))
          : h('button', { class: 'btn btn--publish', onClick: () => { location.href = 'herramientas/calendario?programar=' + encodeURIComponent('vid:' + C.session.projectId) + '&t=' + Date.now(); } }, 'Publicar →')
      )
    ];
  }

  C.Media = function () {
    const s = C.state;
    const clips = s.clips || [];
    const total = clips.reduce((acc, c) => acc + (Number(c.duration_sec) || 0), 0);
    const meta = clips.length
      ? clips.length + ' clip' + (clips.length > 1 ? 's' : '') + (total ? ' · ' + C.util.fmtTime(total) : '')
      : 'Sin clips aún';
    const palabras = C.util.words(s.scriptText);

    /* 23-sep (Sergio): «una opción de B-roll; escoger uno de los guiones que ya tenemos y
       Cherry nos dice qué video va en cada escena». Es la MISMA zona, no una pantalla aparte:
       lo que cambia es qué se sube, no dónde. */
    const brl = C.brollEstado ? C.brollEstado() : { on: false };

    return h('div', { class: 'glass glass--full' },
      h('div', { class: 'media__head' },
        h('div', { style: { minWidth: '0' } },
          h('div', { class: 'h-module' }, 'multimedia'),
          h('div', { class: 'kicker', style: { marginTop: '4px' } },
            brl.on ? 'video de escenas' : meta)
        ),
        !brl.on && h('button', { class: 'btn btn--upload', onClick: triggerUpload }, '＋ Subir clips'),
        C.arranque && C.arranque.pastilla ? C.arranque.pastilla(s) : null   // (22-oct) solo se ve en el celular
      ),

      C.Broll && h('div', { class: 'br-modo' },
        h('button', { class: brl.on ? '' : 'on',
          onClick: () => { C.brollEstado().on = false; C.setState({}); } }, 'Tomas mías'),
        h('button', { class: brl.on ? 'on' : '',
          onClick: () => { C.brollEstado().on = true; C.setState({}); } }, 'Video de escenas')
      ),

      brl.on && C.Broll ? C.Broll() : clipGrid(),

      !brl.on && h('div', { class: 'strip' },
        h('div', { class: 'row', style: { marginBottom: '6px' } },
          h('span', { class: 'kicker kicker--strip' }, 'Guión'),
          h('span', { class: 'hand', style: { fontSize: '17px', color: 'var(--amber)', cursor: 'pointer' },
            onClick: () => C.setState({ scriptOpen: true }) }, 'editar ✎')
        ),
        h('div', { class: 'script__quote' },
          s.scriptText ? '"' + s.scriptText + '"' : 'Sin guión todavía. Toca «editar» para escribir uno.'),
        s.scriptText && h('div', { class: 'script__count' }, palabras + ' palabras')
      ),

      /* (22-oct) en el celular esta franja vive en la hoja de «✓ Fabricar» (main.js); aquí solo asoma para avisar de una subida */
      h('div', { class: 'strip strip--gen' + (s.uploadingClips || s.esperandoClips || s.subidaAviso || hayAvisoSubida(s) ? ' strip--avisa' : '') }, genStrip())
    );
  };
  C.franjaFabricar = genStrip;

  /* Exponer para que overlays.js pueda refrescar después de guardar guión */
  C.loadClips  = loadClips;
  C.loadScript = loadScript;
  async function deleteClip(clipId) {
    const SK = C.session.token;
    // Borrar de la DB
    await fetch('https://xsptcepijtnmowqauyxw.supabase.co/rest/v1/clips?id=eq.' + clipId, {
      method: 'DELETE',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ',
        'Authorization': 'Bearer ' + SK,
      }
    });
    await loadClips();
  }

})();

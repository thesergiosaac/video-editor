/* media.js — zona «multimedia» (diseño "night shift"): clips reales, guión y generar.
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
      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      console.log(`[CARRETE] Audio extraído: ${sizeMB} MB (original: ${(videoFile.size/1024/1024).toFixed(2)} MB)`);
      return blob;
    } catch (e) {
      console.warn('[CARRETE] No se pudo extraer audio comprimido (se usará video original):', e.message);
      return null;
    }
  }

  /* ── Subida de clips ── */
  function triggerUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*';
    input.onchange = async () => {
      const files = Array.from(input.files);
      if (!files.length) return;
      /* Progreso por archivo — promediamos para mostrar % total */
      const total = files.length;
      const perFile = new Array(total).fill(0);
      const updateProgress = () => {
        const avg = Math.round(perFile.reduce((a, b) => a + b, 0) / files.length);
        C.state.uploadProgress = avg;
        document.querySelectorAll('.js-upload-pct-bar').forEach(el => el.style.width = avg + '%');
        document.querySelectorAll('.js-upload-pct').forEach(el => el.textContent = avg + '%');
      };

      C.setState({ uploadingClips: true, uploadingFile: total + ' clip' + (total > 1 ? 's' : ''), uploadProgress: 0 });
      updateProgress();

      /* Subir videos en paralelo controlado: máx 3 archivos a la vez (cada uno con 5 workers) */
      const newClipEntries = []; // { id, i, fileName } — guarda posición original
      const fileQueue = files.map((file, i) => ({ file, i }));
      const FILE_WORKERS = Math.min(3, files.length);
      const filePool = [];
      for (let w = 0; w < FILE_WORKERS; w++) {
        filePool.push((async () => {
          while (fileQueue.length) {
            const { file, i } = fileQueue.shift();
            try {
              const result = await C.api.uploadClipViaS3(file, (pct) => { perFile[i] = pct; updateProgress(); });
              if (result && result.id) newClipEntries.push({ id: result.id, i, fileName: file.name });
              perFile[i] = 100;
              updateProgress();
            } catch (e) {
              console.error('[CARRETE] Error subiendo clip ' + file.name + ':', e);
            }
          }
        })());
      }
      await Promise.all(filePool);

      /* Esperar a que Lambda procese los clips recién subidos (polling cada 4s, max 5 min) */
      if (newClipEntries.length > 0) {
        C.setState({ uploadingClips: true, uploadingFile: 'procesando ' + newClipEntries.length + ' clip(s)…' });
        const start = Date.now();
        while (Date.now() - start < 300000) {
          await new Promise(r => setTimeout(r, 4000));
          const clips = await C.api.getClips();
          const failed  = (clips || []).filter(c => newClipEntries.some(function(e){return e.id===c.id;}) && c.status === 'error').length;
          const pending = (clips || []).filter(c => newClipEntries.some(function(e){return e.id===c.id;}) && !['processed','transcribed','error'].includes(c.status)).length;
          if (pending === 0) break;
          const msg = failed > 0 ? 'procesando ' + pending + ' — ' + failed + ' fallaron' : 'procesando ' + pending + ' clip(s)…';
          document.querySelectorAll('.js-upload-pct').forEach(el => el.textContent = msg);
        }
      }

      C.setState({ uploadingClips: false, uploadProgress: 0, uploadingFile: '' });

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
    };
    input.click();
  }

  /* ── Cargar clips desde Supabase ── */
  async function loadClips() {
    if (!C.apiReady) return;
    const clips = await C.api.getClips();
    C.setState({ clips: clips || [] });
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
  C.cargarProyecto = async function () {
    loadClips();
    loadScript();
    const prev = await C.api.getLatestRender();
    if (prev && prev.status === 'done' && prev.output_url) {
      const hasL2 = prev.layer2_url && prev.layer2_url.startsWith('https://');
      const url = hasL2 ? prev.layer2_url : prev.output_url;
      C.setState({ phase: 'done', renderProgress: 100, renderUrl: url, downloadUrl: url });
    }
  };

  /* ── Cuadrícula de clips con arrastrar para reordenar ── */
  let dragSrcIdx = null;

  function duracion(sec) {
    return sec ? C.util.fmtTime(sec).replace(/^0(\d:)/, '$1') : '';
  }

  function clipGrid() {
    const clips = C.state.clips || [];
    const celdas = clips.map((clip, i) =>
      h('div', {
        class: 'clip',
        draggable: true,
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
        clip.thumbnail_url
          ? h('img', { class: 'clip__img', src: clip.thumbnail_url, alt: '' })
          : h('div', { class: 'clip__fill', style: { background: D.clipTones[i % D.clipTones.length] } }),
        !['processed', 'transcribed'].includes(clip.status) && h('div', { class: 'clip__proc' }, h('span', { class: 'spinner' })),
        h('span', { class: 'clip__tag clip__tag--n' }, String(i + 1).padStart(2, '0')),
        h('span', { class: 'clip__tag clip__tag--dur' },
          duracion(clip.duration_sec) || (clip.file_name.length > 10 ? clip.file_name.substring(0, 8) + '…' : clip.file_name)),
        h('button', { class: 'clip__del', title: 'Quitar clip', onClick: (e) => { e.stopPropagation(); deleteClip(clip.id); } }, '✕')
      )
    );
    celdas.push(h('button', { class: 'clip-add', title: 'Subir clips', onClick: triggerUpload }, '＋'));
    return h('div', { class: 'clips', 'data-scroll': 'clips' }, celdas);
  }

  /* ── Franja de generar: subiendo / listo para generar / generando / terminado ── */
  function genStrip() {
    const s = C.state;

    if (s.uploadingClips) {
      return [
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' } },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen__title' }, 'Subiendo ' + (s.uploadingFile || 'clips') + '…')
        ),
        h('div', { class: 'bar' }, h('i', { class: 'js-upload-pct-bar', style: { width: (s.uploadProgress || 0) + '%' } })),
        h('div', { class: 'gen__meta' }, h('span', { class: 'js-upload-pct' }, (s.uploadProgress || 0) + '%'))
      ];
    }

    if (s.phase === 'idle') {
      const hasClips = (s.clips || []).length > 0;
      return [
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
        s.downloadUrl
          ? h('a', { class: 'btn btn--download', href: C.urlVideo(s.downloadUrl), download: 'video-carrete.mp4', target: '_blank', rel: 'noopener' }, 'Descargar')
          : h('span', { class: 'btn btn--download btn--wait' }, h('span', { class: 'spinner' }), 'Preparando HD…'),
        h('button', { class: 'btn btn--publish' }, 'Publicar →')
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

    return h('div', { class: 'glass glass--full' },
      h('div', { class: 'media__head' },
        h('div', { style: { minWidth: '0' } },
          h('div', { class: 'h-module' }, 'multimedia'),
          h('div', { class: 'kicker', style: { marginTop: '4px' } }, meta)
        ),
        h('button', { class: 'btn btn--upload', onClick: triggerUpload }, '＋ Subir clips')
      ),

      clipGrid(),

      h('div', { class: 'strip' },
        h('div', { class: 'row', style: { marginBottom: '6px' } },
          h('span', { class: 'kicker kicker--strip' }, 'Guión'),
          h('span', { class: 'hand', style: { fontSize: '17px', color: 'var(--amber)', cursor: 'pointer' },
            onClick: () => C.setState({ scriptOpen: true }) }, 'editar ✎')
        ),
        h('div', { class: 'script__quote' },
          s.scriptText ? '"' + s.scriptText + '"' : 'Sin guión todavía. Toca «editar» para escribir uno.'),
        s.scriptText && h('div', { class: 'script__count' }, palabras + ' palabras')
      ),

      h('div', { class: 'strip strip--gen' }, genStrip())
    );
  };

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

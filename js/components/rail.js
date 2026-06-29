/* rail.js — rail derecho con clips reales, guión y caja Generar */
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

  /* ── Llamar a load cuando la API esté lista ── */
  if (C.apiReady) {
    loadClips();
    loadScript();
  } else {
    C.onApiReady.push(async () => {
      loadClips();
      loadScript();
      // Restaurar render previo si ya existe
      const prev = await C.api.getLatestRender();
      if (prev && prev.status === 'done' && prev.output_url) {
        C.setState({ phase: 'done', renderProgress: 100, renderUrl: prev.output_url });
      }
    });
  }

  /* ── Miniaturas de clips con drag-and-drop ── */
  let dragSrcIdx = null;   // índice del clip que se está arrastrando

  function clipGrid() {
    const clips = C.state.clips || [];
    if (!clips.length) {
      return h('div', { class: 'clip-grid clip-grid--empty' },
        h('div', { class: 'clip-empty' },
          h('div', { class: 'clip-empty__icon' }, '▶'),
          h('div', { class: 'clip-empty__text' }, 'Sube tus clips para empezar')
        )
      );
    }
    return h('div', { class: 'clip-grid' },
      clips.map((clip, i) =>
        h('div', {
          class: 'clip',
          style: { position: 'relative', cursor: 'grab' },
          draggable: true,
          onDragStart: (e) => {
            dragSrcIdx = i;
            e.dataTransfer.effectAllowed = 'move';
            e.currentTarget.style.opacity = '0.45';
          },
          onDragEnd: (e) => {
            e.currentTarget.style.opacity = '';
            // Quitar resaltado de todos
            document.querySelectorAll('.clip--over').forEach(el => el.classList.remove('clip--over'));
          },
          onDragOver: (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            e.currentTarget.classList.add('clip--over');
          },
          onDragLeave: (e) => {
            e.currentTarget.classList.remove('clip--over');
          },
          onDrop: async (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('clip--over');
            const destIdx = i;
            if (dragSrcIdx === null || dragSrcIdx === destIdx) return;

            // Reordenar en estado local
            const newClips = [...C.state.clips];
            const [moved] = newClips.splice(dragSrcIdx, 1);
            newClips.splice(destIdx, 0, moved);
            dragSrcIdx = null;

            // Actualizar UI inmediatamente
            C.setState({ clips: newClips });

            // Persistir en Supabase (no-await para no bloquear UI)
            C.api.saveClipOrder(newClips.map(c => c.id)).catch(err =>
              console.warn('Error guardando orden:', err)
            );
          },
        },
          clip.thumbnail_url
            ? h('img', {
                src: clip.thumbnail_url,
                style: {
                  position: 'absolute', inset: '0',
                  width: '100%', height: '100%',
                  objectFit: 'cover', borderRadius: '6px',
                  display: 'block', pointerEvents: 'none',
                },
              })
            : h('div', { class: 'clip__bg', style: { background: D.clipGrads[i % D.clipGrads.length] } }),
          clip.status !== 'processed' && h('div', { class: 'clip__scan' }),
          h('span', { class: 'clip__tag clip__n' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'clip__tag clip__dur' },
            clip.file_name.length > 12
              ? clip.file_name.substring(0, 10) + '…'
              : clip.file_name
          ),
          h('button', {
            style: {
              position: 'absolute', top: '4px', right: '4px',
              background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
              color: '#fff', width: '18px', height: '18px', fontSize: '10px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: '1', padding: '0', zIndex: '2',
            },
            onClick: (e) => { e.stopPropagation(); deleteClip(clip.id); }
          }, '✕')
        )
      )
    );
  }

  /* ── Caja Generar ── */
  function genBox() {
    const s = C.state;

    if (s.uploadingClips) {
      return C.frag(
        h('div', { class: 'gen-render__head' },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen-render__title' }, 'Subiendo ' + (s.uploadingFile || 'clips') + '…')
        ),
        h('div', { class: 'progress' },
          h('div', { class: 'progress__fill js-upload-pct-bar', style: { width: (s.uploadProgress || 0) + '%' } })
        ),
        h('div', { class: 'gen-render__meta' },
          h('span', { class: 'js-upload-pct' }, (s.uploadProgress || 0) + '%')
        )
      );
    }

    if (s.phase === 'idle') {
      const clips = s.clips || [];
      const hasClips = clips.length > 0;
      return C.frag(
        h('button', {
          class: 'gen-btn' + (hasClips ? '' : ' gen-btn--disabled'),
          onClick: hasClips ? () => C.actions.generate() : null,
          title: hasClips ? '' : 'Sube al menos un clip primero'
        }, '✦ GENERAR VIDEO'),
        h('div', { class: 'gen-meta' },
          h('span', null, 'Tiempo est. ~40s'),
          h('span', { class: 'amber' }, '◆ 12 créditos')
        )
      );
    }

    if (s.phase === 'rendering') {
      return C.frag(
        h('div', { class: 'gen-render__head' },
          h('span', { class: 'spinner' }),
          h('span', { class: 'gen-render__title' }, 'Editando con IA…')
        ),
        h('div', { class: 'progress' },
          h('div', { class: 'progress__fill', style: { width: s.renderProgress + '%' } })
        ),
        h('div', { class: 'gen-render__meta' },
          h('span', null, C.util.renderStage(s.renderProgress)),
          h('span', null, Math.round(s.renderProgress) + '%')
        )
      );
    }

    /* done */
    return C.frag(
      h('div', { class: 'gen-done__head' },
        h('span', { class: 'check' }, '✓'),
        h('span', { class: 'gen-done__title' }, '¡Tu video está listo!')
      ),
      h('button', { class: 'editar-btn', onClick: () => C.setState({ resultEdit: true }) }, '✎ Editar resultado'),
      h('div', { class: 'done-actions' },
        h('button', { class: 'icon-btn', onClick: () => C.actions.resetRender() }, '↺'),
        h('button', {
          class: 'btn-cream',
          onClick: () => {
            if (C.state.renderUrl) window.open(C.state.renderUrl, '_blank');
          }
        }, 'Descargar'),
        h('button', { class: 'btn-coral' }, 'Publicar →')
      )
    );
  }

  C.Rail = function () {
    const s = C.state;
    const clips = s.clips || [];
    const meta = clips.length
      ? clips.length + ' clip' + (clips.length > 1 ? 's' : '') + ' subido' + (clips.length > 1 ? 's' : '')
      : 'Sin clips aún';

    return h('div', { class: 'rail sb sb-dark' },
      h('div', { class: 'rail-head' },
        h('span', { class: 'rail-head__label' }, 'Tu material'),
        h('span', { class: 'rail-head__line' }),
        h('span', { class: 'rail-head__meta' }, meta)
      ),
      clipGrid(),
      h('button', {
        class: 'upload-btn upload-btn--dark',
        style: { marginBottom: '24px' },
        onClick: triggerUpload
      }, '＋ Subir clips'),

      h('div', { class: 'rail-head' },
        h('span', { class: 'rail-head__label' }, 'Guión'),
        h('span', { class: 'rail-head__line' }),
        h('span', { class: 'rail-head__edit', onClick: () => C.setState({ scriptOpen: true }) }, 'editar')
      ),
      h('div', { class: 'script-card' },
        h('div', { class: 'script-card__tab' }),
        h('div', { class: 'script-card__text' },
          s.scriptText
            ? '"' + s.scriptText.substring(0, 120) + (s.scriptText.length > 120 ? '…' : '') + '"'
            : 'Sin guión todavía. Haz clic en editar para escribir uno.'
        ),
        s.scriptText && h('div', { class: 'script-card__meta' },
          s.scriptText.trim().split(/\s+/).filter(Boolean).length + ' palabras'
        )
      ),

      h('div', { class: 'spacer' }),
      h('div', { class: 'gen-box' }, genBox())
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

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

      /* Subir TODOS los videos en paralelo directo a S3 */
      await Promise.all(files.map(async (file, i) => {
        try {
          await C.api.uploadClipViaS3(file, (pct) => { perFile[i] = pct; updateProgress(); });
          perFile[i] = 100;
          updateProgress();
        } catch (e) {
          console.error('[CARRETE] Error subiendo clip ' + file.name + ':', e);
          // NO marcamos 100% — dejamos el porcentaje donde está para que el error sea visible
        }
      }));

      /* Esperar a que Lambda procese los clips (polling cada 3s, max 3 min) */
      C.setState({ uploadingClips: true, uploadingFile: 'procesando audio…' });
      const start = Date.now();
      while (Date.now() - start < 180000) {
        await new Promise(r => setTimeout(r, 3000));
        const clips = await C.api.getClips();
        const pending = (clips || []).filter(c => c.status === 'uploading').length;
        if (pending === 0) break;
        document.querySelectorAll('.js-upload-pct').forEach(el =>
          el.textContent = 'procesando ' + pending + ' clip(s)…'
        );
      }

      C.setState({ uploadingClips: false, uploadProgress: 0, uploadingFile: '' });
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

  /* ── Miniaturas de clips ── */
  function clipGrid() {
    const clips = C.state.clips || [];
    if (!clips.length) {
      /* Placeholder mientras no hay clips */
      return h('div', { class: 'clip-grid clip-grid--empty' },
        h('div', { class: 'clip-empty' },
          h('div', { class: 'clip-empty__icon' }, '▶'),
          h('div', { class: 'clip-empty__text' }, 'Sube tus clips para empezar')
        )
      );
    }
    return h('div', { class: 'clip-grid' },
      clips.map((clip, i) =>
        h('div', { class: 'clip', style: { position: 'relative' } },
          h('div', { class: 'clip__bg', style: { background: D.clipGrads[i % D.clipGrads.length] } }),
          h('div', { class: 'clip__scan' }),
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
              lineHeight: '1', padding: '0',
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

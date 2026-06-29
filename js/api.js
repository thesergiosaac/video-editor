/* ============================================================
   api.js
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});

  const SUPABASE_URL  = 'https://xsptcepijtnmowqauyxw.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ';
  const FN_BASE       = SUPABASE_URL + '/functions/v1';
  const DEV_EMAIL    = 'dev@carrete.app';
  const DEV_PASSWORD = 'carrete2026dev';
  const DEV_PROJECT  = '00000000-0000-0000-0000-000000000001';

  C.session = { user: null, token: null, projectId: DEV_PROJECT };

  async function apiFetch(path, opts = {}, _retry = true) {
    const headers = {
      'apikey': SUPABASE_ANON,
      'Content-Type': 'application/json',
      ...(C.session.token ? { 'Authorization': 'Bearer ' + C.session.token } : {}),
      ...(opts.headers || {}),
    };
    const res = await fetch(SUPABASE_URL + path, { ...opts, headers });
    // Auto-refresh: si JWT expiró (401), re-login y reintenta una vez
    if (res.status === 401 && _retry) {
      console.warn('[CARRETE] Token expirado — renovando sesión...');
      const ok = await login(DEV_EMAIL, DEV_PASSWORD);
      if (ok) return apiFetch(path, opts, false);
    }
    return res.json();
  }

  async function edgeFetch(fn, body, _retry = true) {
    const res = await fetch(FN_BASE + '/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + C.session.token,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 && _retry) {
      console.warn('[CARRETE] Token expirado en edgeFetch — renovando...');
      const ok = await login(DEV_EMAIL, DEV_PASSWORD);
      if (ok) return edgeFetch(fn, body, false);
    }
    return res.json();
  }

  async function login(email, password) {
    const data = await apiFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      C.session.user  = data.user;
      C.session.token = data.access_token;
      return true;
    }
    console.error('[CARRETE] Login fallido:', data);
    return false;
  }

  async function getProjects() {
    return apiFetch('/rest/v1/projects?select=id,title,status,created_at&order=created_at.desc');
  }

  async function createProject(title) {
    const data = await apiFetch('/rest/v1/projects', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ user_id: C.session.user.id, title, status: 'draft' }),
    });
    return Array.isArray(data) ? data[0] : data;
  }

  async function uploadClip(file, onProgress) {
    const projectId = C.session.projectId;
    const userId    = C.session.user.id;
    const path      = userId + '/' + projectId + '/' + Date.now() + '_' + file.name;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', SUPABASE_URL + '/storage/v1/object/clips/' + path);
      xhr.setRequestHeader('apikey', SUPABASE_ANON);
      xhr.setRequestHeader('Authorization', 'Bearer ' + C.session.token);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const row = await apiFetch('/rest/v1/clips', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({ project_id: projectId, user_id: userId, file_name: file.name, storage_path: path, status: 'uploaded' }),
          });
          resolve(Array.isArray(row) ? row[0] : row);
        } else {
          reject(new Error('Upload failed: ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
  }

  async function getClips() {
    return apiFetch('/rest/v1/clips?project_id=eq.' + C.session.projectId + '&select=id,file_name,storage_path,audio_path,mp4_path,status,thumbnail_url,order_index,created_at&order=order_index.asc.nullslast,created_at.asc');
  }

  async function uploadAudio(audioBlob, clipId, originalName) {
    const projectId = C.session.projectId;
    const userId    = C.session.user.id;
    const baseName  = originalName.replace(/\.[^.]+$/, '');
    const path      = userId + '/' + projectId + '/audio_' + Date.now() + '_' + baseName + '.wav';
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', SUPABASE_URL + '/storage/v1/object/clips/' + path);
      xhr.setRequestHeader('apikey', SUPABASE_ANON);
      xhr.setRequestHeader('Authorization', 'Bearer ' + C.session.token);
      xhr.setRequestHeader('Content-Type', 'audio/wav');
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          await apiFetch('/rest/v1/clips?id=eq.' + clipId, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ audio_path: path }),
          });
          console.log('[CARRETE] Audio comprimido guardado:', path);
          resolve({ audio_path: path });
        } else {
          console.warn('[CARRETE] Audio upload fallo:', xhr.status);
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.send(audioBlob);
    });
  }

  async function getSignedUrl(storagePath) {
    const data = await apiFetch('/storage/v1/object/sign/clips/' + storagePath, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    return data.signedURL ? SUPABASE_URL + data.signedURL : null;
  }

  async function saveScript(text) {
    return apiFetch('/rest/v1/scripts', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ project_id: C.session.projectId, content: text }),
    });
  }

  async function getScript() {
    const rows = await apiFetch('/rest/v1/scripts?project_id=eq.' + C.session.projectId + '&select=content&limit=1');
    return Array.isArray(rows) && rows.length ? rows[0].content : '';
  }

  async function generateVideo(settings) {
    // Llama orchestrate — transcribe clips sin transcripción, genera receta nueva y renderiza
    return edgeFetch('orchestrate', {
      project_id:   C.session.projectId,
      user_id:      (C.session.user && C.session.user.id) ? C.session.user.id : 'dev-user',
      clipGap: (() => { const p = (settings && settings.clipGap != null) ? settings.clipGap : 50; return p <= 50 ? Math.round((p - 50) * 2) : Math.round((p - 50) * 40); })(),
      clipStart: (settings && settings.clipStart != null) ? settings.clipStart : 100,
      captions:        (settings && settings.captions        != null) ? settings.captions        : true,
      captionStyle:    (settings && settings.captionStyle    != null) ? settings.captionStyle    : 'minimal',
      captionPosition: (settings && settings.captionPosition != null) ? settings.captionPosition : 'chin',
      captionTypo: {
        font:         (settings && settings.captionFont)         || 'roboto-bold',
        fontSize:     (settings && settings.captionFontSize)     || 52,
        color:        (settings && settings.captionColor)        || '#ffffff',
        outlineColor: (settings && settings.captionOutlineColor) || '#000000',
        outlineSize:  (settings && settings.captionOutlineEnabled === false) ? 0 : ((settings && settings.captionOutlineSize != null) ? settings.captionOutlineSize : 2.5),
        shadow:       (settings && settings.captionShadow)       || 0,
        shadowBlur:   (settings && settings.captionShadowBlur   != null) ? settings.captionShadowBlur   : 0,
        shadowOpacity:(settings && settings.captionShadowOpacity != null) ? settings.captionShadowOpacity : 0.95,
        glow:         (settings && settings.captionGlow)         || 0,
        bold:         (settings && settings.captionBold != null) ? settings.captionBold : true,
        italic:       (settings && settings.captionItalic)       || false,
        underline:    (settings && settings.captionUnderline)    || false,
        uppercase:    (settings && settings.captionUppercase != null) ? settings.captionUppercase : true,
      },
      impact: (settings && settings.impact) || false,
      impactSettings: {
        bigFont:      (settings && settings.impactBigFont)      || 'roboto-bold',
        bigSize:      (settings && settings.impactBigSize)      || 90,
        bigColor:     (settings && settings.impactBigColor)     || '#ffffff',
        bigUppercase: (settings && settings.impactBigUppercase) !== false,
        bigSpacing:   (settings && settings.impactBigSpacing)   || 0,
        supFont:      (settings && settings.impactSupFont)      || 'roboto-bold',
        supSize:      (settings && settings.impactSupSize)      || 32,
        supColor:     (settings && settings.impactSupColor)     || '#ffffff',
        supOpacity:   (settings && settings.impactSupOpacity    != null) ? settings.impactSupOpacity : 0.65,
        supPosition:  (settings && settings.impactSupPosition)  || 'arriba',
        supSpacing:   (settings && settings.impactSupSpacing)   || 3,
        entrance:     (settings && settings.impactEntrance)     || 'blur',
        entranceDur:  (settings && settings.impactEntranceDur)  || 550,
        exit:         (settings && settings.impactExit)         || 'blur',
        exitDur:      (settings && settings.impactExitDur)      || 400,
      },
    });
  }

  async function getPipelineStatus(renderId) {
    // Si tenemos render_id, filtramos por ese ID exacto (evita mostrar renders viejos)
    const filter = renderId
      ? '/rest/v1/renders?id=eq.' + renderId + '&select=output_url,layer2_url,preview_url,status,error_message,remotion_render_id'
      : '/rest/v1/renders?project_id=eq.' + C.session.projectId + '&select=output_url,layer2_url,preview_url,status,error_message,remotion_render_id&order=created_at.desc&limit=1';
    const rows = await apiFetch(filter);
    const latest = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!latest) return { status: 'rendering', progress_pct: 0 }; // aún no existe la fila, esperar
    const progressPct = latest.status === 'done' ? 100 : 0;
    return {
      status:        latest.status,
      output_url:    latest.output_url  || null,
      layer2_url:    latest.layer2_url  || null,
      preview_url:   latest.preview_url || null,
      error_message: latest.error_message || null,
      progress_pct:  progressPct,
    };
  }

  async function getLatestRender() {
    const rows = await apiFetch(
      '/rest/v1/renders?project_id=eq.' + C.session.projectId +
      '&select=output_url,status,remotion_render_id&order=created_at.desc&limit=1'
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function saveBrand(brandData) {
    return apiFetch('/rest/v1/brands', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: C.session.user.id, ...brandData }),
    });
  }

  async function getBrand() {
    const rows = await apiFetch('/rest/v1/brands?user_id=eq.' + C.session.user.id + '&limit=1');
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  function warmupLambda() {
    // Ping ligero a deploy-lambda para mantener el contenedor caliente
    fetch(FN_BASE + '/deploy-lambda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + C.session.token },
      body: JSON.stringify({ action: 'ping' }),
    })
      .then(r => r.json())
      .then(d => console.log('[CARRETE] Lambda precalentada:', d.msg || 'ok'))
      .catch(e => console.warn('[CARRETE] Warm-up fallo:', e.message));
  }

  C.apiReady = false;
  C.onApiReady = [];
  async function uploadClipViaS3(file, onProgress) {
    const projectId = C.session.projectId;
    const CHUNK = 8 * 1024 * 1024; // 8 MB por parte

    let clipId, s3Key;

    if (file.size >= CHUNK) {
      // ── Multipart Upload (archivos grandes: paralelo por chunks) ──────────
      const numParts = Math.ceil(file.size / CHUNK);
      const init = await edgeFetch('multipart-upload', {
        action:     'initiate',
        file_name:  file.name,
        file_type:  file.type || 'video/quicktime',
        project_id: projectId,
        num_parts:  numParts,
      });
      if (!init.clip_id || !init.upload_id) throw new Error('No se pudo iniciar multipart upload');

      clipId = init.clip_id;
      s3Key  = init.s3_key;

      // Subir partes en paralelo (máx 5 simultáneas)
      const partProgress = new Array(numParts).fill(0);
      const etags = [];

      const uploadPart = async (partInfo) => {
        const { part_number, url } = partInfo;
        const start = (part_number - 1) * CHUNK;
        const chunk = file.slice(start, start + CHUNK);

        // Reintentos para tolerar cortes momentáneos de red
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const etag = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('PUT', url);
              xhr.timeout = 120000; // 2 min por parte
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  partProgress[part_number - 1] = e.loaded;
                  const loaded = partProgress.reduce((a, b) => a + b, 0);
                  if (onProgress) onProgress(Math.min(99, Math.round(loaded / file.size * 100)));
                }
              };
              xhr.onload = () => {
                if (xhr.status === 200) resolve(xhr.getResponseHeader('ETag') || '');
                else reject(new Error('Parte ' + part_number + ' status ' + xhr.status));
              };
              xhr.onerror = () => reject(new Error('Error de red parte ' + part_number));
              xhr.ontimeout = () => reject(new Error('Timeout parte ' + part_number));
              xhr.send(chunk);
            });
            partProgress[part_number - 1] = chunk.size;
            etags.push({ part_number, etag });
            return;
          } catch (partErr) {
            if (attempt === 4) throw partErr;
            console.warn('[CARRETE] parte ' + part_number + ' intento ' + attempt + ' falló, reintentando en ' + attempt + 's:', partErr.message);
            partProgress[part_number - 1] = 0;
            await new Promise(r => setTimeout(r, attempt * 1000));
          }
        }
      };

      // Pool de concurrencia: máx 5 simultáneas
      const queue = init.part_urls.slice();
      const CONCURRENCY = 5;
      const workers = [];
      for (let w = 0; w < Math.min(CONCURRENCY, queue.length); w++) {
        workers.push((async () => {
          while (queue.length) await uploadPart(queue.shift());
        })());
      }
      await Promise.all(workers);

      // Completar multipart en S3
      // try-catch: si el EF falla/timeout, el archivo ya esta en S3, seguir de todas formas
      try {
        await edgeFetch('multipart-upload', {
          action: 'complete', clip_id: clipId, s3_key: s3Key,
          upload_id: init.upload_id, project_id: projectId,
          parts: etags.sort((a, b) => a.part_number - b.part_number),
        });
      } catch (completeErr) {
        console.warn('[CARRETE] complete EF fallo, continuando:', completeErr.message);
      }

      if (onProgress) onProgress(100);

    } else {
      // ── Upload simple para archivos pequeños (< 8 MB) ─────────────────────
      const res = await edgeFetch('get-upload-url', {
        file_name:  file.name,
        file_type:  file.type || 'video/quicktime',
        project_id: projectId,
      });
      if (!res.clip_id || !res.upload_url) throw new Error('No se pudo obtener URL de subida');
      clipId = res.clip_id;
      s3Key  = res.s3_key;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', res.upload_url);
        xhr.setRequestHeader('Content-Type', file.type || 'video/quicktime');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error('S3 upload failed: ' + xhr.status));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
      });
    }

    // ── Disparar procesamiento (igual para ambas rutas) ───────────────────
    const triggerProcessing = async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await edgeFetch('process-upload', {
            storage_path: s3Key,
            clip_id:      clipId,
            project_id:   projectId,
          });
          if (result?.ok || result?.lambda_status) {
            console.log('[CARRETE] process-upload OK intento', attempt);
            return;
          }
        } catch (e) {
          console.warn('[CARRETE] process-upload intento', attempt, 'falló:', e);
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }
      console.error('[CARRETE] process-upload falló 3 veces para clip', clipId);
    };
    triggerProcessing();

    // ── Medir duración optimista ──────────────────────────────────────────
    try {
      const duration = await new Promise((resolve) => {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => { URL.revokeObjectURL(vid.src); resolve(vid.duration); };
        vid.onerror = () => { URL.revokeObjectURL(vid.src); resolve(null); };
        vid.src = URL.createObjectURL(file);
      });
      if (duration && isFinite(duration)) {
        await apiFetch('/rest/v1/clips?id=eq.' + clipId, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ duration_sec: duration }),
        });
      }
    } catch(e) { console.warn('[CARRETE] No se pudo medir duración:', e); }

    return { id: clipId };
  }


  async function saveClipOrder(orderedIds) {
    // PATCH order_index para cada clip según su posición en el array
    await Promise.all(orderedIds.map((id, idx) =>
      apiFetch('/rest/v1/clips?id=eq.' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ order_index: idx }),
      })
    ));
  }

  async function triggerLayer2(renderId, settings) {
    return edgeFetch('render-captions', {
      render_id: renderId,
      caption_config: {
        font:         (settings && settings.captionFont)         || 'montserrat',
        fontSize:     (settings && settings.captionFontSize)     || 56,
        color:        (settings && settings.captionColor)        || '#ffffff',
        italic:       (settings && settings.captionItalic)       || false,
        uppercase:    (settings && settings.captionUppercase != null) ? settings.captionUppercase : false,
        shadowBlur:   (settings && settings.captionShadowBlur   != null) ? settings.captionShadowBlur   : 8,
        shadowOpacity:(settings && settings.captionShadowOpacity != null) ? settings.captionShadowOpacity : 0.75,
        position:     (settings && settings.captionPosition)    || 'chin',
      },
    });
  }
  C.api = { login, getProjects, createProject, uploadClip, uploadClipViaS3, getClips, uploadAudio, getSignedUrl, saveScript, getScript, generateVideo, triggerLayer2, getPipelineStatus, getLatestRender, saveBrand, getBrand, saveClipOrder };

  (async function init() {
    const ok = await login(DEV_EMAIL, DEV_PASSWORD);
    if (ok) {
      C.apiReady = true;
      console.log('[CARRETE] Sesion iniciada:', C.session.user.email, '| proyecto:', C.session.projectId);
      C.onApiReady.forEach(fn => fn());
      warmupLambda();
    } else {
      console.error('[CARRETE] No se pudo iniciar sesion');
    }
  })();

})();

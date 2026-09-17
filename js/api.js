/* ============================================================
   api.js
   Sesión: se entra con correo + contraseña (Supabase Auth).
   Sin sesión no se muestra la app ni se llama al servidor.
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});

  const SUPABASE_URL  = 'https://xsptcepijtnmowqauyxw.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ';
  const FN_BASE       = SUPABASE_URL + '/functions/v1';
  const LLAVE_SESION  = 'carrete-sesion';

  /* Videos: se sirven por CloudFront (punto en Bogotá) y no directo desde Virginia,
     que desde Colombia entrega ~2-3 Mbps y no alcanza para reproducir fluido. */
  const S3_VIDEOS  = 'https://remotionlambda-useast1-editorvideo.s3.us-east-1.amazonaws.com/';
  const CDN_VIDEOS = 'https://d2b7db4md5k57t.cloudfront.net/'; // distribución E3UX0EIIUVEGSH
  C.urlVideo = function (url) {
    return (CDN_VIDEOS && typeof url === 'string' && url.indexOf(S3_VIDEOS) === 0)
      ? CDN_VIDEOS + url.slice(S3_VIDEOS.length)
      : url;
  };

  C.session = { user: null, token: null, refresh: null, expiresAt: 0, projectId: null };
  C.auth = { checked: false, aviso: null };

  /* ── Sesión guardada en este navegador ── */
  function guardarSesion(data) {
    C.session.user      = data.user || C.session.user;
    C.session.token     = data.access_token;
    C.session.refresh   = data.refresh_token;
    C.session.expiresAt = data.expires_at ? data.expires_at * 1000 : Date.now() + (data.expires_in || 3600) * 1000;
    try {
      localStorage.setItem(LLAVE_SESION, JSON.stringify({
        user: C.session.user, token: C.session.token, refresh: C.session.refresh, expiresAt: C.session.expiresAt,
      }));
    } catch (_) { /* sin almacenamiento: la sesión dura mientras la pestaña esté abierta */ }
  }

  function borrarSesion() {
    C.session.user = null; C.session.token = null; C.session.refresh = null;
    C.session.expiresAt = 0; C.session.projectId = null;
    C.apiReady = false;
    try { localStorage.removeItem(LLAVE_SESION); } catch (_) {}
  }

  /* true = renovada · false = ya no sirve · null = sin conexión (se deja la actual) */
  let refrescando = null;
  function refrescarSesion() {
    if (!C.session.refresh) return Promise.resolve(false);
    if (!refrescando) {
      refrescando = fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: C.session.refresh }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.access_token) { guardarSesion(data); return true; }
          return false;
        })
        .catch(() => null)
        .finally(() => { refrescando = null; });
    }
    return refrescando;
  }

  /* Si el token vence en menos de 1 minuto, se renueva antes de usarlo */
  async function tokenVigente() {
    if (C.session.token && C.session.expiresAt - Date.now() > 60000) return true;
    return refrescarSesion();
  }

  /* La sesión ya no sirve (vencida o cerrada): volver a la pantalla de entrada */
  function sesionPerdida() {
    if (!C.session.token) return;
    borrarSesion();
    C.auth.aviso = 'Tu sesión se cerró. Vuelve a entrar.';
    if (C.render) C.render();
  }

  async function apiFetch(path, opts = {}, _retry = true) {
    await tokenVigente();
    const headers = {
      'apikey': SUPABASE_ANON,
      'Content-Type': 'application/json',
      ...(C.session.token ? { 'Authorization': 'Bearer ' + C.session.token } : {}),
      ...(opts.headers || {}),
    };
    const res = await fetch(SUPABASE_URL + path, { ...opts, headers });
    if (res.status === 401 && _retry) {
      const r = await refrescarSesion();
      if (r === true) return apiFetch(path, opts, false);
      if (r === false) sesionPerdida();
    }
    return res.json();
  }

  async function edgeFetch(fn, body, _retry = true) {
    await tokenVigente();
    const res = await fetch(FN_BASE + '/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + C.session.token,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 && _retry) {
      const r = await refrescarSesion();
      if (r === true) return edgeFetch(fn, body, false);
      if (r === false) sesionPerdida();
    }
    return res.json();
  }

  /* ── Entrar / salir ── */
  async function login(email, password) {
    try {
      const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.access_token) {
        guardarSesion(data);
        try {
          await iniciarApp();
        } catch (e) {
          console.error('[CARRETE] No se pudo abrir el proyecto:', e);
          borrarSesion();
          return { ok: false, error: 'Entraste, pero no se pudo abrir tu proyecto. Intenta de nuevo.' };
        }
        return { ok: true };
      }
      if (res.status === 400 || res.status === 401) return { ok: false, error: 'Correo o contraseña incorrectos.' };
      if (res.status === 429) return { ok: false, error: 'Demasiados intentos. Espera unos minutos.' };
      return { ok: false, error: 'No se pudo entrar. Intenta de nuevo.' };
    } catch (_) {
      return { ok: false, error: 'Sin conexión con el servidor. Revisa tu internet.' };
    }
  }

  /* Primer ingreso: la cuenta la registra Carrete y la persona crea su contraseña una sola vez */
  async function primerIngreso(accion, correo, clave) {
    try {
      const res = await fetch(FN_BASE + '/primer-ingreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, correo, clave }),
      });
      const data = await res.json().catch(() => ({}));
      return { ...data, ok: res.ok };
    } catch (_) {
      return { ok: false, error: 'Sin conexión con el servidor. Revisa tu internet.' };
    }
  }

  async function esPrimerIngreso(correo) {
    const r = await primerIngreso('estado', correo);
    return r.ok ? { ok: true, primeraVez: r.primera_vez === true } : { ok: false, error: r.error || 'No se pudo revisar el correo.' };
  }

  async function crearClave(correo, clave) {
    const r = await primerIngreso('crear', correo, clave);
    if (!r.ok) return { ok: false, error: r.error || 'No se pudo crear la contraseña.' };
    return login(correo, clave);
  }

  async function logout() {
    const token = C.session.token;
    borrarSesion();
    try { localStorage.removeItem(LLAVE_PROYECTO); } catch (_) {}
    if (token) {
      await Promise.race([
        fetch(SUPABASE_URL + '/auth/v1/logout', {
          method: 'POST', headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token },
        }).catch(() => null),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
    location.reload(); // limpia todo lo que la sesión tenía en memoria
  }

  /* Proyecto de trabajo: el último que se abrió en este navegador; si no, el más antiguo; si no hay, se crea */
  const LLAVE_PROYECTO = 'carrete-proyecto';
  function recordarProyecto(id) {
    try { localStorage.setItem(LLAVE_PROYECTO, id); } catch (_) {}
  }
  async function elegirProyecto() {
    const filas = await apiFetch('/rest/v1/projects?select=id,title&order=created_at.asc');
    if (!C.session.token) throw new Error('Sesión perdida');
    if (Array.isArray(filas) && filas.length) {
      let guardado = null;
      try { guardado = localStorage.getItem(LLAVE_PROYECTO); } catch (_) {}
      const elegido = filas.find((p) => p.id === guardado) || filas[0];
      return elegido.id;
    }
    const nuevo = await createProject('Mi primer proyecto');
    return nuevo && nuevo.id ? nuevo.id : null;
  }

  /* Nombre, plan y créditos de quien inició sesión */
  async function getPerfil() {
    if (!C.session.user) return null;
    const filas = await apiFetch('/rest/v1/profiles?select=full_name,plan,credits_remaining&id=eq.' + C.session.user.id);
    return Array.isArray(filas) && filas.length ? filas[0] : null;
  }

  async function iniciarApp() {
    const projectId = await elegirProyecto();
    if (!projectId) throw new Error('Sin proyecto');
    C.session.projectId = projectId;
    C.apiReady = true;
    C.auth.checked = true;
    C.auth.aviso = null;
    console.log('[CARRETE] Sesión iniciada:', C.session.user && C.session.user.email, '| proyecto:', projectId);
    if (C.render) C.render();
    C.onApiReady.forEach((fn) => { try { fn(); } catch (e) { console.error('[CARRETE]', e); } });
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
    return apiFetch('/rest/v1/clips?project_id=eq.' + C.session.projectId + '&select=id,file_name,storage_path,audio_path,mp4_path,status,thumbnail_url,order_index,duration_sec,created_at&order=order_index.asc.nullslast,created_at.asc');
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
      // Plantilla de subtítulos (17-sep): { plantilla, simple }. Sin esto el servidor hace el subtítulo plano de antes
      subtitulos: (settings && settings.subtitulos) || null,
      // Tweaks para F3 (Daily Chat Reel) — enviados planos, orchestrate los lee directo
      combo:     (settings && settings.graphicsCombo)     || 'Creativ',
      heroColor: (settings && settings.graphicsHeroColor) || '#ffffff',
      supColor:  (settings && settings.graphicsSupColor)  || '#dedad4',
      bg:        (settings && settings.graphicsBg)        || 'Papel',
      grain:     (settings && settings.graphicsGrain)     !== false,
      lowFps:    (settings && settings.graphicsLowFps)    || false,
      paper:     (settings && settings.graphicsPaper)     !== false,
    });
  }

  async function getPipelineStatus(renderId) {
    // Si tenemos render_id, filtramos por ese ID exacto (evita mostrar renders viejos)
    const filter = renderId
      ? '/rest/v1/renders?id=eq.' + renderId + '&select=output_url,layer2_url,preview_url,status,error_message,remotion_render_id,video_sin_subtitulos'
      : '/rest/v1/renders?project_id=eq.' + C.session.projectId + '&select=output_url,layer2_url,preview_url,status,error_message,remotion_render_id&order=created_at.desc&limit=1';
    const rows = await apiFetch(filter);
    const latest = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!latest) return { status: 'rendering', progress_pct: 0 }; // aún no existe la fila, esperar
    const progressPct = latest.status === 'done' ? 100 : 0;
    return {
      status:        latest.status,
      output_url:    latest.output_url  || null,
      layer2_url:    (latest.layer2_url && latest.layer2_url.startsWith('https://')) ? latest.layer2_url : null,
      preview_url:   latest.preview_url || null,
      error_message: latest.error_message || null,
      video_sin_subtitulos: latest.video_sin_subtitulos || null,
      progress_pct:  progressPct,
    };
  }

  async function getLatestRender() {
    const rows = await apiFetch(
      '/rest/v1/renders?project_id=eq.' + C.session.projectId +
      '&status=eq.done&select=id,output_url,layer2_url,status,remotion_render_id,video_sin_subtitulos&order=created_at.desc&limit=1'
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

  async function getRenderData(renderId) {
    const rows = await apiFetch(
      '/rest/v1/renders?id=eq.' + renderId +
      '&select=id,graphics_json,clean_words_json,subtitle_phrases,subtitle_config,subtitle_edits,video_sin_subtitulos,duraciones_reales,segments_json,layer2_url,output_url,status'
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  /* Guardar la edición de subtítulos del editor (17-sep). Se confirma con la fila devuelta:
     si la base no la devuelve (sin permiso, sin sesión…) NO se da por guardado */
  async function guardarEdicion(renderId, edicion) {
    const filas = await apiFetch('/rest/v1/renders?id=eq.' + renderId + '&select=id', {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ subtitle_edits: edicion }),
    });
    if (!Array.isArray(filas) || filas.length !== 1) throw new Error((filas && filas.message) || 'La base no confirmó el guardado');
    return true;
  }

  async function reExportWithEdits(scenesOverride, cutsOverride, settings) {
    return edgeFetch('orchestrate', {
      project_id:      C.session.projectId,
      user_id:         (C.session.user && C.session.user.id) ? C.session.user.id : 'dev-user',
      clipGap:         0,
      clipStart:       100,
      captions:        true,
      captionStyle:    (settings && settings.captionStyle)    || 'carrete',
      captionPosition: (settings && settings.captionPosition) || 'bottom',
      captionTypo:     (settings && settings.captionTypo)     || {},
      combo:           (settings && settings.combo)           || 'Creativ',
      heroColor:       (settings && settings.heroColor)       || '#ffffff',
      supColor:        (settings && settings.supColor)        || '#dedad4',
      bg:              (settings && settings.bg)              || 'Ventana',
      grain:           false,
      lowFps:          false,
      paper:           false,
      scenesOverride:  scenesOverride || null,
      cutsOverride:    cutsOverride   || null,
      subtitulos:      (settings && settings.subtitulos) || null,
      // Exportar rápido: reutiliza cortes y video sin subtítulos de este render (solo se rehacen los subtítulos)
      reusar_render:   (settings && settings.reusarRender) || null,
    });
  }

  C.api = { login, logout, esPrimerIngreso, crearClave, recordarProyecto, getPerfil, getProjects, createProject, uploadClip, uploadClipViaS3, getClips, uploadAudio, getSignedUrl, saveScript, getScript, generateVideo, getPipelineStatus, getLatestRender, saveBrand, getBrand, saveClipOrder, getRenderData, reExportWithEdits, guardarEdicion };

  /* Al abrir la página: si hay una sesión guardada y sigue viva, se entra directo */
  (async function init() {
    let guardada = null;
    try { guardada = JSON.parse(localStorage.getItem(LLAVE_SESION) || 'null'); } catch (_) {}
    if (guardada && guardada.refresh) {
      C.session.user      = guardada.user;
      C.session.token     = guardada.token;
      C.session.refresh   = guardada.refresh;
      C.session.expiresAt = guardada.expiresAt || 0;
      const vigente = await tokenVigente();
      if (vigente === false) {
        borrarSesion();
      } else {
        try { await iniciarApp(); return; }
        catch (e) {
          // Sin conexión u otro fallo pasajero: no se borra la sesión, se avisa para recargar
          console.warn('[CARRETE] No se pudo abrir la sesión guardada:', e);
          if (C.session.token) C.auth.aviso = 'No se pudo conectar con el servidor. Revisa tu internet y recarga la página.';
        }
      }
    }
    C.auth.checked = true;
    if (C.render) C.render();
  })();

})();

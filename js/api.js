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

  async function apiFetch(path, opts = {}) {
    const headers = {
      'apikey': SUPABASE_ANON,
      'Content-Type': 'application/json',
      ...(C.session.token ? { 'Authorization': 'Bearer ' + C.session.token } : {}),
      ...(opts.headers || {}),
    };
    const res = await fetch(SUPABASE_URL + path, { ...opts, headers });
    return res.json();
  }

  async function edgeFetch(fn, body) {
    const res = await fetch(FN_BASE + '/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + C.session.token,
      },
      body: JSON.stringify(body),
    });
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
    return apiFetch('/rest/v1/clips?project_id=eq.' + C.session.projectId + '&select=id,file_name,storage_path,audio_path,status,created_at&order=created_at.asc');
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
    // Llama render-video directamente — crea un render nuevo cada vez
    return edgeFetch('render-video', { project_id: C.session.projectId, clipGap: (settings && settings.clipGap != null) ? settings.clipGap : 30 });
  }

  async function getPipelineStatus() {
    // Consultar tabla renders directamente para estado real y actualizado
    const rows = await apiFetch(
      '/rest/v1/renders?project_id=eq.' + C.session.projectId +
      '&select=output_url,status,remotion_render_id&order=created_at.desc&limit=1'
    );
    const latest = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!latest) return { status: 'idle', progress_pct: 0 };
    return {
      status:      latest.status,
      output_url:  latest.output_url || null,
      progress_pct: latest.status === 'done' ? 100 : latest.status === 'rendering' ? 50 : 0,
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
    fetch(FN_BASE + '/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + C.session.token },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then(d => console.log('[CARRETE] Lambda precalentada:', d.msg || 'ok'))
      .catch(e => console.warn('[CARRETE] Warm-up fallo:', e.message));
  }

  C.apiReady = false;
  C.onApiReady = [];

  async function uploadClipViaS3(file, onProgress) {
    const projectId = C.session.projectId;

    // 1. Pedir URL prefirmada y crear registro en DB
    const res = await edgeFetch('get-upload-url', {
      file_name: file.name,
      file_type: file.type || 'video/quicktime',
      project_id: projectId,
    });
    if (!res.clip_id || !res.upload_url) throw new Error('No se pudo obtener URL de subida');

    // 2. Subir video directo a S3
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

    return { id: res.clip_id };
  }

  C.api = { login, getProjects, createProject, uploadClip, uploadClipViaS3, getClips, uploadAudio, getSignedUrl, saveScript, getScript, generateVideo, getPipelineStatus, getLatestRender, saveBrand, getBrand };

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

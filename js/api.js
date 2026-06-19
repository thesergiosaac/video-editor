/* ============================================================
   api.js — capa de conexión entre el editor y Supabase.

   MODO DESARROLLO: auto-login con usuario de prueba.
   El login/registro real se construirá después.

   Expone: window.CARRETE.api  con todos los métodos del backend.
   Expone: window.CARRETE.session  con { user, token, projectId }
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});

  /* ── Configuración ── */
  const SUPABASE_URL  = 'https://xsptcepijtnmowqauyxw.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ';
  const FN_BASE       = SUPABASE_URL + '/functions/v1';

  /* Usuario y proyecto de prueba (desarrollo) */
  const DEV_EMAIL    = 'dev@carrete.app';
  const DEV_PASSWORD = 'carrete2026dev';
  const DEV_PROJECT  = '00000000-0000-0000-0000-000000000001';

  /* Estado de sesión */
  C.session = { user: null, token: null, projectId: DEV_PROJECT };

  /* ── Helper fetch autenticado ── */
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

  /* ── Auth ── */
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

  /* ── Proyectos ── */
  async function getProjects() {
    return apiFetch('/rest/v1/projects?select=id,title,status,created_at&order=created_at.desc');
  }

  async function createProject(title) {
    const data = await apiFetch('/rest/v1/projects', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        user_id: C.session.user.id,
        title,
        status: 'draft',
      }),
    });
    return Array.isArray(data) ? data[0] : data;
  }

  /* ── Clips ── */
  async function uploadClip(file, onProgress) {
    const projectId = C.session.projectId;
    const userId    = C.session.user.id;
    const path      = userId + '/' + projectId + '/' + Date.now() + '_' + file.name;

    /* Subida a Supabase Storage con XHR para seguimiento de progreso */
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
          /* Guardar referencia en la tabla clips */
          const row = await apiFetch('/rest/v1/clips', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({
              project_id: projectId,
              user_id: userId,
              file_name: file.name,
              storage_path: path,
              status: 'uploaded',
            }),
          });
          resolve(Array.isArray(row) ? row[0] : row);
        } else {
          reject(new Error('Upload failed: ' + xhr.status + ' ' + xhr.responseText));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
  }

  async function getClips() {
    return apiFetch('/rest/v1/clips?project_id=eq.' + C.session.projectId + '&select=id,file_name,storage_path,status,created_at&order=created_at.asc');
  }

  async function getSignedUrl(storagePath) {
    const data = await apiFetch('/storage/v1/object/sign/clips/' + storagePath, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    return data.signedURL ? SUPABASE_URL + data.signedURL : null;
  }

  /* ── Guión ── */
  async function saveScript(text) {
    const projectId = C.session.projectId;
    /* upsert: si ya existe para este proyecto, actualiza */
    return apiFetch('/rest/v1/scripts', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ project_id: projectId, content: text }),
    });
  }

  async function getScript() {
    const rows = await apiFetch('/rest/v1/scripts?project_id=eq.' + C.session.projectId + '&select=content&limit=1');
    return Array.isArray(rows) && rows.length ? rows[0].content : '';
  }

  /* ── Pipeline (generar video) ── */
  async function generateVideo(settings) {
    return edgeFetch('orchestrate', {
      project_id: C.session.projectId,
      settings,   /* todos los parámetros del sidebar */
    });
  }

  async function getPipelineStatus() {
    const res = await fetch(
      FN_BASE + '/orchestrate?project_id=' + C.session.projectId,
      { headers: { 'Authorization': 'Bearer ' + C.session.token } }
    );
    return res.json();
  }

  async function getLatestRender() {
    const rows = await apiFetch(
      '/rest/v1/renders?project_id=eq.' + C.session.projectId +
      '&select=output_url,status,render_id&order=created_at.desc&limit=1'
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  /* ── Marca ── */
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

  /* ── Warm-up de Lambda (precalentar Remotion en background) ── */
  function warmupLambda() {
    fetch(FN_BASE + '/orchestrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + C.session.token,
      },
      body: JSON.stringify({}), // sin project_id = solo warm-up
    })
      .then(r => r.json())
      .then(d => console.log('[CARRETE] ✓ Lambda precalentada:', d.msg || 'ok'))
      .catch(e => console.warn('[CARRETE] Warm-up Lambda falló (no crítico):', e.message));
  }

  /* ── Init: auto-login en desarrollo ── */
  C.apiReady = false;
  C.onApiReady = [];

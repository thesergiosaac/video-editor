/* ============================================================
   api.js — conexión frontend ↔ Supabase (Video Editor)

   MODO DESARROLLO: auto-login silencioso con usuario de prueba.
   El login/registro real se construye después.

   Expone: window.CARRETE.api      — métodos del backend
           window.CARRETE.session  — { user, token, projectId }
           window.CARRETE.apiReady — true cuando el login terminó
           window.CARRETE.onApiReady — array de callbacks
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});

  const SUPABASE_URL  = 'https://xsptcepijtnmowqauyxw.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ';
  const FN_BASE       = SUPABASE_URL + '/functions/v1';

  /* Usuario y proyecto de prueba */
  const DEV_EMAIL    = 'dev@carrete.app';
  const DEV_PASSWORD = 'carrete2026dev';
  const DEV_PROJECT  = '00000000-0000-0000-0000-000000000001';

  C.session   = { user: null, token: null, projectId: DEV_PROJECT };
  C.apiReady  = false;
  C.onApiReady = [];

  /* ── Helpers de fetch ── */
  function headers(extra) {
    return {
      'apikey': SUPABASE_ANON,
      'Content-Type': 'application/json',
      ...(C.session.token ? { 'Authorization': 'Bearer ' + C.session.token } : {}),
      ...(extra || {}),
    };
  }

  async function rest(path, opts) {
    const res = await fetch(SUPABASE_URL + path, {
      ...opts,
      headers: headers(opts && opts.headers),
    });
    if (!res.ok && res.status !== 201) {
      const err = await res.text();
      throw new Error('REST ' + res.status + ': ' + err);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function edge(fn, body) {
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
    const data = await rest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data && data.access_token) {
      C.session.user  = data.user;
      C.session.token = data.access_token;
      return true;
    }
    return false;
  }

  /* ── Proyectos ── */
  async function getProjects() {
    return rest('/rest/v1/projects?select=id,title,status,created_at&order=created_at.desc');
  }

  async function createProject(title) {
    const rows = await rest('/rest/v1/projects', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ user_id: C.session.user.id, title, status: 'draft' }),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  /* ── Clips ── */
  async function uploadClip(file, onProgress) {
    const pid  = C.session.projectId;
    const uid  = C.session.user.id;
    const path = uid + '/' + pid + '/' + Date.now() + '_' + file.name.replace(/\s/g, '_');

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
          /* Guardar en tabla clips */
          const rows = await rest('/rest/v1/clips', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({
              project_id:   pid,
              user_id:      uid,
              file_name:    file.name,
              storage_path: path,
              status:       'uploaded',
            }),
          });
          resolve(Array.isArray(rows) ? rows[0] : rows);
        } else {
          reject(new Error('Upload error ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
  }

  async function getClips() {
    return rest('/rest/v1/clips?project_id=eq.' + C.session.projectId +
      '&select=id,file_name,storage_path,status,created_at&order=created_at.asc');
  }

  async function getSignedUrl(storagePath) {
    const data = await rest('/storage/v1/object/sign/clips/' + storagePath, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    return data && data.signedURL ? SUPABASE_URL + data.signedURL : null;
  }

  /* ── Guión ── */
  async function saveScript(text) {
    /* Verificar si ya existe un guión para este proyecto */
    const existing = await rest('/rest/v1/scripts?project_id=eq.' + C.session.projectId + '&select=id&limit=1');
    if (existing && existing.length > 0) {
      /* UPDATE */
      return rest('/rest/v1/scripts?project_id=eq.' + C.session.projectId, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ content: text, updated_at: new Date().toISOString() }),
      });
    } else {
      /* INSERT */
      return rest('/rest/v1/scripts', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ project_id: C.session.projectId, content: text }),
      });
    }
  }

  async function getScript() {
    const rows = await rest('/rest/v1/scripts?project_id=eq.' + C.session.projectId + '&select=content&limit=1');
    return rows && rows.length ? rows[0].content : '';
  }

  /* ── Pipeline ── */
  async function generateVideo(settings) {
    return edge('orchestrate', { project_id: C.session.projectId, settings });
  }

  async function getPipelineStatus() {
    const res = await fetch(
      FN_BASE + '/orchestrate?project_id=' + C.session.projectId,
      { headers: { 'Authorization': 'Bearer ' + C.session.token } }
    );
    return res.json();
  }

  async function getLatestRender() {
    const rows = await rest(
      '/rest/v1/renders?project_id=eq.' + C.session.projectId +
      '&select=output_url,status,render_id&order=created_at.desc&limit=1'
    );
    return rows && rows.length ? rows[0] : null;
  }

  /* ── Marca ── */
  async function saveBrand(data) {
    const uid = C.session.user.id;
    const existing = await rest('/rest/v1/brands?user_id=eq.' + uid + '&select=id&limit=1');
    const payload = {
      user_id:       uid,
      primary_color: data.primary_color,
      font:          data.font,
    };
    if (existing && existing.length > 0) {
      return rest('/rest/v1/brands?user_id=eq.' + uid, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(payload),
      });
    } else {
      return rest('/rest/v1/brands', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...payload, name: 'Mi marca' }),
      });
    }
  }

  async function getBrand() {
    const rows = await rest('/rest/v1/brands?user_id=eq.' + C.session.user.id + '&limit=1');
    return rows && rows.length ? rows[0] : null;
  }

  /* ── Exponer API ── */
  C.api = {
    login, getProjects, createProject,
    uploadClip, getClips, getSignedUrl,
    saveScript, getScript,
    generateVideo, getPipelineStatus, getLatestRender,
    saveBrand, getBrand,
  };

  /* ── Init: auto-login desarrollo ── */
  (async function init() {
    try {
      const ok = await login(DEV_EMAIL, DEV_PASSWORD);
      if (ok) {
        C.apiReady = true;
        console.log('[CARRETE] ✓ Sesión activa:', C.session.user.email, '| proyecto:', C.session.projectId);
        C.onApiReady.forEach(fn => fn());
      } else {
        console.error('[CARRETE] ✗ Login fallido');
      }
    } catch(e) {
      console.error('[CARRETE] ✗ Error de conexión:', e);
    }
  })();

})();

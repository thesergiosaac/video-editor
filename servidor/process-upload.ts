// process-upload v4 — llama a la Lambda con SigV4 propio, sin npm:@aws-sdk (29-oct-2026)
// process-upload v3 — exige sesión iniciada; ruta y proyecto salen de la base, no del pedido (16-sep-2026)
// process-upload v2
// (29-oct) ya no usa npm: ver invocarProcesador()
// El frontend llama esto inmediatamente tras subir a S3 — debe arrancar siempre en frío.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SVC_JWT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AWS_KEY_ID   = Deno.env.get('AWS_ACCESS_KEY_ID') ?? '';
const AWS_SECRET   = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// ── Sesión obligatoria (16-sep-2026) ─────────────────────────────────────────
// Solo pasa quien inició sesión de verdad: el servidor de Auth valida el token.
// La llave pública de la página (anon) NO es una sesión y se rechaza.
const SESION_URL  = Deno.env.get('SUPABASE_URL') ?? ''
const SESION_ANON = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ'
const SESION_SRV  = Deno.env.get('SVC_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function usuarioDeSesion(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  try {
    const r = await fetch(`${SESION_URL}/auth/v1/user`, { headers: { apikey: SESION_ANON, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = await r.json()
    return typeof u?.id === 'string' && ES_UUID.test(u.id) ? u.id : null
  } catch (_) { return null }
}

// Devuelve la fila si pertenece al usuario; null si no existe o es de otro.
async function filaDelUsuario(tabla: 'projects' | 'clips', id: unknown, userId: string, campos = 'id'): Promise<any | null> {
  if (typeof id !== 'string' || !ES_UUID.test(id)) return null
  try {
    const r = await fetch(`${SESION_URL}/rest/v1/${tabla}?id=eq.${id}&user_id=eq.${userId}&select=${campos}&limit=1`, {
      headers: { apikey: SESION_SRV, Authorization: `Bearer ${SESION_SRV}` },
    })
    if (!r.ok) return null
    const filas = await r.json()
    return Array.isArray(filas) && filas[0] ? filas[0] : null
  } catch (_) { return null }
}

// ── (29-oct) La Lambda se llama con la firma de Amazon hecha aquí (SigV4), como invoke-lambda.ts ──
// Antes: import('npm:@aws-sdk/client-lambda@3'). El 29-oct falló ~1 de cada 3 veces al cargar («Could not find constraint
// '@aws-sdk/client-lambda@3' in the list of packages»): con 18 clips, 2 se quedaron sin copia tras los 3 intentos de la
// página. Sin librería no hay nada que cargar.
const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';
async function invocarProcesador(payload: object): Promise<Response> {
  const enc = new TextEncoder();
  const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  const sha = async (t: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));
  const hmac = async (key: ArrayBuffer, msg: string) => {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', k, enc.encode(msg));
  };
  const bodyStr = JSON.stringify(payload);
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const host = `lambda.${AWS_REGION}.amazonaws.com`;
  const path = `/2015-03-31/functions/carrete-media-processor/invocations`;
  const canonHeaders = `host:${host}\nx-amz-date:${amzDate}\nx-amz-invocation-type:Event\n`;
  const signedHeaders = 'host;x-amz-date;x-amz-invocation-type';
  const canonReq = `POST\n${path}\n\n${canonHeaders}\n${signedHeaders}\n${await sha(bodyStr)}`;
  const credScope = `${dateStamp}/${AWS_REGION}/lambda/aws4_request`;
  const strToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${await sha(canonReq)}`;
  let key = await hmac(enc.encode('AWS4' + AWS_SECRET).buffer as ArrayBuffer, dateStamp);
  key = await hmac(key, AWS_REGION);
  key = await hmac(key, 'lambda');
  key = await hmac(key, 'aws4_request');
  const signature = hex(await hmac(key, strToSign));
  return fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Amz-Date': amzDate, 'X-Amz-Invocation-Type': 'Event',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${AWS_KEY_ID}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: bodyStr,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const userId = await usuarioDeSesion(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Inicia sesión para procesar clips' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { clip_id } = body;

    if (!clip_id) {
      return new Response(JSON.stringify({ error: 'clip_id es requerido' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // El clip tiene que ser del usuario; la ruta y el proyecto se toman de la base
    const clip = await filaDelUsuario('clips', clip_id, userId, 'id,storage_path,project_id');
    if (!clip || !clip.storage_path) {
      return new Response(JSON.stringify({ error: 'Ese clip no es tuyo' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }
    const storage_path = clip.storage_path;
    const project_id = clip.project_id;

    // async (Event): Amazon responde 202 de una y la Lambda trabaja aparte
    const resp = await invocarProcesador({
      clip_id,
      storage_path,
      project_id: project_id ?? '00000000-0000-0000-0000-000000000001',
    });
    if (resp.status !== 202 && resp.status !== 200) {
      throw new Error(`Lambda respondió ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 200)}`);
    }
    console.log(`[process-upload] clip=${clip_id} lambda_status=${resp.status}`);

    return new Response(JSON.stringify({ ok: true, lambda_status: resp.status }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[process-upload] Error:', msg);

    // Marcar clip como error si tenemos el id
    try {
      const b = await req.json().catch(() => ({}));
      if ((b as any).clip_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/clips?id=eq.${(b as any).clip_id}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error' }),
        });
      }
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});

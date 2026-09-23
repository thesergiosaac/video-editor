// process-upload v3 — exige sesión iniciada; ruta y proyecto salen de la base, no del pedido (16-sep-2026)
// process-upload v2
// CRÍTICO: imports de npm DENTRO del handler (no top-level) para evitar BOOT_ERROR en Deno
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

    // Import dinámico DENTRO del handler — evita BOOT_ERROR en arranque en frío
    const { LambdaClient, InvokeCommand } = await import('npm:@aws-sdk/client-lambda@3');

    const lambda = new LambdaClient({
      region: 'us-east-1',
      credentials: { accessKeyId: AWS_KEY_ID, secretAccessKey: AWS_SECRET }
    });

    const payload = JSON.stringify({
      clip_id,
      storage_path,
      project_id: project_id ?? '00000000-0000-0000-0000-000000000001',
    });

    const cmd = new InvokeCommand({
      FunctionName: 'carrete-media-processor',
      InvocationType: 'Event', // async — responde 202 inmediato
      Payload: new TextEncoder().encode(payload),
    });

    const resp = await lambda.send(cmd);
    console.log(`[process-upload] clip=${clip_id} lambda_status=${resp.StatusCode}`);

    return new Response(JSON.stringify({ ok: true, lambda_status: resp.StatusCode }), {
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

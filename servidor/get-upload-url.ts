// get-upload-url — exige sesión iniciada y que el proyecto sea del usuario (16-sep-2026)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AWS_KEY_ID    = Deno.env.get("AWS_ACCESS_KEY_ID") ?? "";
const AWS_SECRET    = Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "";
const AWS_REGION    = Deno.env.get("AWS_REGION") ?? "us-east-1";
const BUCKET        = Deno.env.get("REMOTION_BUCKET_NAME") ?? "remotionlambda-useast1-editorvideo";


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

async function supabaseInsert(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DB insert failed ${res.status}: ${text}`);
  }
}

async function presignedPut(key: string): Promise<string> {
  const enc = new TextEncoder();
  const now = new Date();
  const ymd = now.toISOString().slice(0,10).replace(/-/g,"");
  const dt  = now.toISOString().replace(/[:\-]/g,"").replace(/\.\d+Z/,"") + "Z";
  const host = `${BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
  const scope = `${ymd}/${AWS_REGION}/s3/aws4_request`;
  const cred  = `${AWS_KEY_ID}/${scope}`;

  const qs = [
    "X-Amz-Algorithm=AWS4-HMAC-SHA256",
    `X-Amz-Credential=${encodeURIComponent(cred)}`,
    `X-Amz-Date=${dt}`,
    "X-Amz-Expires=3600",
    "X-Amz-SignedHeaders=host",
  ].join("&");

  const canon = `PUT\n/${key}\n${qs}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const hash = async (s: string) => Array.from(new Uint8Array(
    await crypto.subtle.digest("SHA-256", enc.encode(s))
  )).map(b=>b.toString(16).padStart(2,"0")).join("");

  const toSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await hash(canon)}`;

  let k: ArrayBuffer = enc.encode("AWS4" + AWS_SECRET).buffer as ArrayBuffer;
  for (const m of [ymd, AWS_REGION, "s3", "aws4_request"]) {
    const ck = await crypto.subtle.importKey("raw", k, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
    k = await crypto.subtle.sign("HMAC", ck, enc.encode(m));
  }
  const ck  = await crypto.subtle.importKey("raw", k, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", ck, enc.encode(toSign)))).map(b=>b.toString(16).padStart(2,"0")).join("");

  return `https://${host}/${key}?${qs}&X-Amz-Signature=${sig}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const userId = await usuarioDeSesion(req);
    if (!userId) return Response.json({ error: "Inicia sesión para subir clips" }, { status: 401, headers: CORS });

    const { file_name, file_type: _ft, project_id } = await req.json();
    if (!file_name || !project_id) return Response.json({ error: "Faltan parámetros" }, { status: 400, headers: CORS });
    if (!(await filaDelUsuario("projects", project_id, userId))) return Response.json({ error: "Ese proyecto no es tuyo" }, { status: 403, headers: CORS });

    // Solo el nombre del archivo: sin carpetas, para que no pueda escribir fuera de uploads/<proyecto>/<clip>/
    const nombre = String(file_name).split(/[\\/]/).pop() || "clip";
    const clipId = crypto.randomUUID();
    const s3Key  = `uploads/${project_id}/${clipId}/${nombre}`;

    await supabaseInsert("clips", {
      id: clipId, project_id, user_id: userId,
      file_name: nombre, storage_path: s3Key, status: "uploading",
    });

    const upload_url = await presignedPut(s3Key);
    return Response.json({ clip_id: clipId, upload_url, s3_key: s3Key }, { headers: CORS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});

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

// ── firma de subidas (inicio) ── (29-oct-2026) igual en multipart-upload.ts y get-upload-url.ts
// Las SUBIDAS van por su propia dirección de Amazon: la «global» del mismo cubo (mismos permisos y mismas reglas). El
// navegador abre máximo 6 conexiones con cada dirección, y la de siempre la ocupa la vista previa (tu video, los sonidos):
// subiendo 18 clips, una se quedaba esperando a la otra. La de siempre queda de RESPALDO (`_r`): si una parte no sube por
// la nueva, el editor la reintenta por esa (api.js › subirClipS3).
// La llave va codificada por partes (RFC 3986), como la firma Amazon: un nombre con espacios o tildes ya no la daña.
const HOST_SUBIDAS = `${BUCKET}.s3.amazonaws.com`
const HOST_SIEMPRE = `${BUCKET}.s3.${AWS_REGION}.amazonaws.com`
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("")
let LLAVE_DIA: { dia: string, k: CryptoKey } | null = null
async function llaveDelDia(dia: string): Promise<CryptoKey> {
  if (LLAVE_DIA && LLAVE_DIA.dia === dia) return LLAVE_DIA.k
  const enc = new TextEncoder()
  let k: ArrayBuffer = enc.encode("AWS4" + AWS_SECRET).buffer as ArrayBuffer
  for (const m of [dia, AWS_REGION, "s3", "aws4_request"]) {
    const ck = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    k = await crypto.subtle.sign("HMAC", ck, enc.encode(m))
  }
  const llave = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  LLAVE_DIA = { dia, k: llave }
  return llave
}
// PUT firmado por 1 h. `extra`: partNumber y uploadId para una parte de la subida por partes.
async function presignedPut(key: string, extra: Record<string, string> = {}, host = HOST_SUBIDAS, ahora = new Date()): Promise<string> {
  const enc = new TextEncoder()
  const dia = ahora.toISOString().slice(0, 10).replace(/-/g, "")
  const dt  = ahora.toISOString().replace(/[:\-]/g, "").replace(/\.\d+Z/, "") + "Z"
  const scope = `${dia}/${AWS_REGION}/s3/aws4_request`
  const q: Record<string, string> = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${AWS_KEY_ID}/${scope}`,
    "X-Amz-Date": dt, "X-Amz-Expires": "3600", "X-Amz-SignedHeaders": "host", ...extra }
  const qs = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join("&")
  const ruta = "/" + key.split("/").map(codificar).join("/")
  const canon = `PUT\n${ruta}\n${qs}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`
  const toSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${hex(await crypto.subtle.digest("SHA-256", enc.encode(canon)))}`
  const sig = hex(await crypto.subtle.sign("HMAC", await llaveDelDia(dia), enc.encode(toSign)))
  return `https://${host}${ruta}?${qs}&X-Amz-Signature=${sig}`
}
// ── firma de subidas (fin) ──

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

    // (29-oct) por la dirección de las subidas; la de siempre, de respaldo (upload_url_r)
    const upload_url = await presignedPut(s3Key);
    const upload_url_r = await presignedPut(s3Key, {}, HOST_SIEMPRE);
    return Response.json({ clip_id: clipId, upload_url, upload_url_r, s3_key: s3Key }, { headers: CORS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});

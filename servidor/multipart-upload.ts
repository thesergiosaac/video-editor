// multipart-upload v4 — SUBIDA RÁPIDA (22-oct-2026): acciones «audio» (dirección para subir el audio del clip, sacado en el
//   celular) y «audio_listo» (el clip queda «processed» con ese audio: la transcripción arranca sin esperar el video).
//   «quitar» ahora también quita un clip sin copia de video (el que transcribió con el audio y su video no subió).
// multipart-upload v3 — acción «quitar» (22-oct-2026): los clips que no terminaron de subir se quitan para que el video
//   no los espere para siempre (el motor de tomas espera a TODOS los clips). Solo los del usuario y solo si no se
//   procesaron (subiendo o error). Con `rearmar`, avisa al motor para que arme los cortes con los que sí están.
// multipart-upload v2 — exige sesión iniciada; proyecto y clip deben ser del usuario (16-sep-2026)
// multipart-upload v1
// Orquesta Multipart Upload de S3 para clips grandes
// action=initiate → crea fila en DB + inicia multipart en S3 → devuelve URLs de partes
// action=complete → completa el multipart en S3

import { createClient } from "npm:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SVC_JWT")!
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// (22-oct) para firmar la subida del audio (la misma firma que get-upload-url)
const AWS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID") ?? ""
const AWS_SECRET = Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? ""
const AWS_REGION = Deno.env.get("AWS_REGION") ?? "us-east-1"
const BUCKET     = Deno.env.get("REMOTION_BUCKET_NAME") ?? "remotionlambda-useast1-editorvideo"
async function presignedPut(key: string): Promise<string> {
  const enc = new TextEncoder()
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "")
  const dt  = now.toISOString().replace(/[:\-]/g, "").replace(/\.\d+Z/, "") + "Z"
  const host = `${BUCKET}.s3.${AWS_REGION}.amazonaws.com`
  const scope = `${ymd}/${AWS_REGION}/s3/aws4_request`
  const cred  = `${AWS_KEY_ID}/${scope}`
  const qs = [
    "X-Amz-Algorithm=AWS4-HMAC-SHA256",
    `X-Amz-Credential=${encodeURIComponent(cred)}`,
    `X-Amz-Date=${dt}`,
    "X-Amz-Expires=3600",
    "X-Amz-SignedHeaders=host",
  ].join("&")
  const canon = `PUT\n/${key}\n${qs}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`
  const hash = async (s: string) => Array.from(new Uint8Array(
    await crypto.subtle.digest("SHA-256", enc.encode(s))
  )).map((b) => b.toString(16).padStart(2, "0")).join("")
  const toSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await hash(canon)}`
  let k: ArrayBuffer = enc.encode("AWS4" + AWS_SECRET).buffer as ArrayBuffer
  for (const m of [ymd, AWS_REGION, "s3", "aws4_request"]) {
    const ck = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    k = await crypto.subtle.sign("HMAC", ck, enc.encode(m))
  }
  const ck  = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", ck, enc.encode(toSign)))).map((b) => b.toString(16).padStart(2, "0")).join("")
  return `https://${host}/${key}?${qs}&X-Amz-Signature=${sig}`
}


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

async function invokeLambdaSync(payload: object): Promise<any> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/invoke-lambda`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sync: true, payload }),
  })
  const data = await resp.json() as any
  if (!resp.ok) throw new Error(`invoke-lambda ${resp.status}: ${JSON.stringify(data).slice(0,200)}`)
  if (data.functionError) throw new Error(`Lambda error: ${JSON.stringify(data.result).slice(0,300)}`)
  return data.result
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const userId = await usuarioDeSesion(req)
    if (!userId) return jsonResp({ error: "Inicia sesión para subir clips" }, 401)

    const body = await req.json()
    const { action, project_id } = body

    // ── INITIATE ────────────────────────────────────────────────────────────
    if (action === "initiate") {
      const { file_name, file_type, num_parts } = body
      if (!file_name || !project_id || !num_parts) {
        return jsonResp({ error: "file_name, project_id, num_parts requeridos" }, 400)
      }

      if (!(await filaDelUsuario("projects", project_id, userId))) return jsonResp({ error: "Ese proyecto no es tuyo" }, 403)

      // Solo el nombre del archivo: sin carpetas
      const nombre = String(file_name).split(/[\\/]/).pop() || "clip"
      const clipId = crypto.randomUUID()
      const s3Key  = `uploads/${project_id}/${clipId}/${nombre}`

      // Crear fila en DB
      const { error: dbErr } = await sb.from("clips").insert({
        id: clipId, project_id, user_id: userId,
        file_name: nombre, storage_path: s3Key, status: "uploading",
      })
      if (dbErr) throw new Error(`DB insert: ${dbErr.message}`)

      // Llamar Lambda para iniciar multipart y obtener URLs de partes
      const result = await invokeLambdaSync({
        mode:      "multipartInitiate",
        s3_key:    s3Key,
        num_parts: Math.min(num_parts, 1000),
      })
      if (!result?.ok) throw new Error(`multipartInitiate falló: ${JSON.stringify(result)}`)

      console.log(`[multipart-upload] initiate OK | clip=${clipId} | parts=${num_parts}`)
      return jsonResp({
        clip_id:   clipId,
        s3_key:    s3Key,
        upload_id: result.upload_id,
        part_urls: result.part_urls,
      })
    }

    // ── COMPLETE ─────────────────────────────────────────────────────────────
    if (action === "complete") {
      const { clip_id, s3_key, upload_id, parts } = body
      if (!clip_id || !s3_key || !upload_id || !parts) {
        return jsonResp({ error: "clip_id, s3_key, upload_id, parts requeridos" }, 400)
      }

      // El clip tiene que ser del usuario y la ruta tiene que ser la suya
      const clip = await filaDelUsuario("clips", clip_id, userId, "id,storage_path")
      if (!clip || clip.storage_path !== s3_key) return jsonResp({ error: "Ese clip no es tuyo" }, 403)

      // Completar multipart en S3
      const result = await invokeLambdaSync({
        mode:      "multipartComplete",
        s3_key,
        upload_id,
        parts,
      })
      if (!result?.ok) throw new Error(`multipartComplete falló: ${JSON.stringify(result)}`)

      console.log(`[multipart-upload] complete OK | clip=${clip_id}`)
      return jsonResp({ ok: true, clip_id, s3_key })
    }

    // ── AUDIO (22-oct-2026): subida rápida, el audio del clip antes que su video ─────────────
    // «audio» da la dirección para subirlo; «audio_listo» deja el clip «processed» con ese audio (el disparador de la base
    // llama a transcribe-clip y, con todas las palabras, el motor arma el corte). Si el servidor ya procesó el video, sobra.
    if (action === "audio" || action === "audio_listo") {
      const clip = await filaDelUsuario("clips", body.clip_id, userId, "id,storage_path,status,mp4_path")
      if (!clip || !clip.storage_path) return jsonResp({ error: "Ese clip no es tuyo" }, 403)
      if (clip.mp4_path) return jsonResp({ ok: true, ya: true })
      const key = String(clip.storage_path).replace(/\/[^/]+$/, "/audio_rapido.wav")
      if (action === "audio") return jsonResp({ ok: true, key, url: await presignedPut(key) })
      const cambio: Record<string, unknown> = { audio_path: key, status: "processed" }
      const dur = Number(body.duracion)
      if (isFinite(dur) && dur > 0 && dur < 7200) cambio.duration_sec = dur
      const { data, error } = await sb.from("clips").update(cambio)
        .eq("id", clip.id).eq("status", "uploading").is("mp4_path", null).select("id")
      if (error) throw new Error(`DB update: ${error.message}`)
      console.log(`[multipart-upload] audio_listo | clip=${clip.id} | aplicado=${Array.isArray(data) && data.length > 0}`)
      return jsonResp({ ok: true, aplicado: Array.isArray(data) && data.length > 0 })
    }

    // ── QUITAR (22-oct-2026) ───────────────────────────────────────────────
    if (action === "quitar") {
      const ids: string[] = Array.isArray(body.clip_ids)
        ? body.clip_ids.filter((x: unknown) => typeof x === "string" && ES_UUID.test(x)).slice(0, 50) : []
      if (!ids.length || !project_id) return jsonResp({ error: "clip_ids y project_id requeridos" }, 400)
      if (!(await filaDelUsuario("projects", project_id, userId))) return jsonResp({ error: "Ese proyecto no es tuyo" }, 403)

      // nunca un clip ya procesado: solo los que no tienen copia de video (siguen subiendo, o transcribieron con el audio
      // y su video no llegó) o quedaron en «error»
      const { data: filas, error: e1 } = await sb.from("clips").select("id")
        .in("id", ids).eq("user_id", userId).eq("project_id", project_id).or("mp4_path.is.null,status.eq.error")
      if (e1) throw new Error(`DB select: ${e1.message}`)
      const borrar = (filas || []).map((f: any) => f.id)
      if (borrar.length) {
        await sb.from("transcriptions").delete().in("clip_id", borrar)
        const { error: e2 } = await sb.from("clips").delete().in("id", borrar)
        if (e2) throw new Error(`DB delete: ${e2.message}`)
      }
      if (body.rearmar === true) {
        // en segundo plano: si aún faltan clips por transcribir, el motor responde «esperando» sin gastar IA
        EdgeRuntime.waitUntil(fetch(`${SUPABASE_URL}/functions/v1/motor-tomas`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ project_id, guardar: true, enSegundoPlano: true }),
        }).catch((e) => console.warn(`[multipart-upload] motor-tomas: ${String(e)}`)))
      }
      console.log(`[multipart-upload] quitar | ${borrar.length} de ${ids.length} | rearmar=${body.rearmar === true}`)
      return jsonResp({ ok: true, quitados: borrar })
    }

    return jsonResp({ error: `action desconocida: ${action}` }, 400)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[multipart-upload] ERROR: ${msg}`)
    return jsonResp({ error: msg }, 500)
  }
})

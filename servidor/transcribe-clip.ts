// transcribe-clip v6 — al terminar avisa al motor de tomas (en vez de align-script) (16-sep-2026)
// transcribe-clip v5 — solo acepta llamadas internas del servidor (16-sep-2026)
// transcribe-clip v4 — igual que v3 + guarda silences en clip_metadata
// Los silencios vienen de la Lambda (silencedetect) y los usa align-script
// para corregir timestamps de palabras con duracion anomala (intento fallido oculto)

import { createClient } from "npm:@supabase/supabase-js@2"

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SVC_JWT")!
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY")!

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

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
  if (!resp.ok) throw new Error(`invoke-lambda ${resp.status}: ${JSON.stringify(data).slice(0, 200)}`)
  if (data.functionError) throw new Error(`Lambda error: ${JSON.stringify(data.result).slice(0, 300)}`)
  return data.result
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  })
}

// El motor de tomas arma el corte limpio cuando TODOS los clips del proyecto ya están transcritos
// (si faltan clips, responde «esperando» sin gastar IA). Trabaja en segundo plano.
async function callAlignScript(projectId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/motor-tomas`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, guardar: true, enSegundoPlano: true }),
    })
  } catch (e) {
    console.error("[transcribe-clip] no se pudo avisar al motor de tomas:", String(e))
  }
}


// ── Solo llamadas internas del servidor (16-sep-2026) ───────────────────────
// La usan la base de datos (disparador de clips) y otras funciones con la llave de servicio.
const INTERNA_URL = Deno.env.get('SUPABASE_URL') ?? ''
async function esLlamadaInterna(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return false
  const conocidas = [Deno.env.get('SVC_JWT'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter((v) => !!v)
  if (conocidas.includes(token)) return true
  try {
    // Solo la llave de servicio puede leer la lista de usuarios: si responde, es interna.
    const r = await fetch(`${INTERNA_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    })
    return r.ok
  } catch (_) { return false }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  if (!(await esLlamadaInterna(req))) return jsonResp({ error: "No autorizado" }, 401)

  const body   = await req.json()
  const clipId = body.clip_id
  if (!clipId) return jsonResp({ error: "clip_id requerido" }, 400)

  const { data: clip } = await sb.from("clips")
    .select("id,project_id,storage_path,audio_path,mp4_path,file_name,status,clip_metadata")
    .eq("id", clipId).single()

  if (!clip) return jsonResp({ error: "Clip no encontrado" }, 404)

  const { data: existingTx } = await sb.from("transcriptions")
    .select("id").eq("clip_id", clipId).single()

  if (existingTx) {
    console.log(`[transcribe-clip v4] ${clipId} ya transcrito, disparando align-script`)
    if (clip.status !== "transcribed") {
      await sb.from("clips").update({ status: "transcribed" }).eq("id", clipId)
    }
    EdgeRuntime.waitUntil(callAlignScript(clip.project_id))
    return jsonResp({ success: true, clip_id: clipId, cached: true })
  }

  await sb.from("clips").update({ status: "transcribing" }).eq("id", clipId)

  try {
    const isS3Clip = clip.storage_path?.startsWith("uploads/") || clip.mp4_path

    let whisper: any
    let silences: any[] = []

    if (isS3Clip && (clip.audio_path || clip.mp4_path)) {
      const audioPath = clip.audio_path || clip.mp4_path
      console.log(`[transcribe-clip v4] Invocando Lambda transcribeAudio | audio=${audioPath}`)
      const lambdaResult = await invokeLambdaSync({
        mode: "transcribeAudio",
        audio_path: audioPath,
        openaiKey: OPENAI_KEY,
      })
      if (!lambdaResult?.ok || !lambdaResult?.transcription) {
        throw new Error(`Lambda transcribeAudio fallo: ${JSON.stringify(lambdaResult).slice(0, 200)}`)
      }
      whisper   = lambdaResult.transcription
      silences  = lambdaResult.silences ?? []
    } else {
      const pathForWhisper = clip.audio_path || clip.storage_path
      const fileNameForWhisper = clip.audio_path
        ? (clip.file_name || "audio").replace(/[.][^.]+$/, "") + ".wav"
        : (clip.file_name || "file")
      const { data: urlData } = await sb.storage.from("clips").createSignedUrl(pathForWhisper, 300)
      if (!urlData?.signedUrl) throw new Error("No se pudo generar URL firmada de Storage")
      const fileResp = await fetch(urlData.signedUrl)
      if (!fileResp.ok) throw new Error(`Error descargando clip: ${fileResp.status}`)
      const audioBuffer = await fileResp.arrayBuffer()
      const formData = new FormData()
      formData.append("file", new Blob([audioBuffer]), fileNameForWhisper)
      formData.append("model", "whisper-1")
      formData.append("language", "es")
      formData.append("response_format", "verbose_json")
      formData.append("timestamp_granularities[]", "word")
      const wResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
        body: formData,
      })
      if (!wResp.ok) throw new Error(`Whisper ${wResp.status}: ${await wResp.text()}`)
      whisper = await wResp.json()
    }

    const txData: any = {
      clip_id: clipId,
      project_id: clip.project_id,
      full_text: whisper.text,
      words: (whisper.words ?? []).map((w: any) => ({ word: w.word, start: w.start, end: w.end })),
      language: whisper.language ?? "es",
    }

    await sb.from("transcriptions").upsert(txData, { onConflict: "clip_id" })

    const updatedMeta = { ...(clip.clip_metadata ?? {}), silences }
    await sb.from("clips").update({ status: "transcribed", clip_metadata: updatedMeta }).eq("id", clipId)

    EdgeRuntime.waitUntil(callAlignScript(clip.project_id))

    return jsonResp({
      success: true,
      clip_id: clipId,
      words_count: txData.words.length,
      silences_count: silences.length,
      text: whisper.text,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[transcribe-clip v4] Error: ${msg}`)
    await sb.from("clips").update({ status: "error" }).eq("id", clipId)
    return jsonResp({ error: msg }, 500)
  }
})